import { CareerError } from "../backend.ts";
import type { BrowserLink, CdpSession } from "../browser/cdp.ts";
import {
  careersOf,
  fieldsFromResume,
  fingerprint,
  labelOf,
  normalizeMonth,
  normalizeText,
  outOfScopeFromResume,
  parseField,
  type GetWantedResumeArgs,
  type ParsedField,
  type ProjectPeriod,
  type ResumeApi,
  type UpdateWantedResumeArgs,
} from "./fields.ts";
import {
  editReadyScript,
  editUrl,
  fieldValueScript,
  listResumesScript,
  listUrl,
  pageStateScript,
  readPeriodsScript,
  readResumeScript,
  setPeriodSteps,
  setTextScript,
  type PageTarget,
} from "./page.ts";

// The two Wanted tools (design: docs/features/profile-browser-sync/design.md).
// The read tool may hand the screen to a person. The write tool runs as an approved execution,
// where a handoff result would be dropped by fos-assistant, so every stop there is a normal `stopped` result.

export type FieldState = "inserted" | "failed" | "not_inserted";
export type StopReason =
  | "fingerprint_mismatch"
  | "stopped_earlier"
  | "time_limit"
  | "page_changed"
  | "not_saved"
  | "login_required"
  | "browser_in_use"
  | "browser_taken"
  | "browser_unreachable"
  | "too_long";
export type FieldResult = { field: string; label: string; state: FieldState; reason?: StopReason };

type Handoff = {
  status: "HUMAN_ACTION_REQUIRED";
  message: string;
  handoff: { code: string; need: "login" | "human_browser"; tab?: string };
};

/**
 * fos-assistant waits 60 seconds for an approved call, and a result that arrives later is lost.
 * `budgetMs` is the latest a text field may start; a period field needs `periodMs` more because it reloads the page.
 * `deadlineMs` bounds the whole run: every page step gets at most the time left, so a hung step ends the run in time.
 */
export type Timing = {
  budgetMs: number;
  periodMs: number;
  deadlineMs: number;
  waitMs: number;
  pollMs: number;
  stepMs: number;
};
const defaultTiming: Timing = {
  budgetMs: 45_000,
  periodMs: 15_000,
  deadlineMs: 55_000,
  waitMs: 5_000,
  pollMs: 250,
  stepMs: 10_000,
};

const pageChanged = () => new CareerError("CAREER_WANTED_PAGE_CHANGED");

/** A stop inside the write loop: the reason for the current field and whether it was being written. */
class Stop {
  constructor(
    readonly reason: StopReason,
    readonly touched = false,
  ) {}
}

type ReadOk = { status: "OK"; resume: ResumeApi; ai: unknown };
type ReadResult = ReadOk | { status: "LOGIN" | "NOT_FOUND" | "ERROR" };

export class WantedTools {
  /** A tab the read tool left for a handoff; the next call in this process closes it. */
  private leftTab: string | undefined;
  /** End of the running write's time; page steps never wait past it. Unset for reads. */
  private deadline: number | undefined;

  constructor(
    private readonly browser: BrowserLink | undefined,
    private readonly now: () => number = Date.now,
    private readonly timing: Timing = defaultTiming,
  ) {}

  async getResume(args: GetWantedResumeArgs): Promise<unknown> {
    const browser = this.requireBrowser();
    await this.closeLeftTab(browser);
    let tab: { tabId: string; session: CdpSession };
    try {
      tab = await browser.openTab("about:blank");
    } catch (error) {
      if (isInUse(error)) return humanBrowser(tabOf(error));
      throw error;
    }
    let leave = false;
    try {
      const { session, tabId } = tab;
      let resumeKey = args.resumeKey;
      let listedTitle = "";
      if (!resumeKey) {
        await session.navigate(listUrl(), this.stepTime());
        const state = await this.value<string>(session, pageStateScript());
        if (state === "LOGIN") return ((leave = true), login(tabId));
        if (state !== "LIST") throw pageChanged();
        // The list renders after the load event; an empty list after waiting is a changed page, not "no resume".
        let resumes: { resumeKey: string; title: string; updatedAt: string }[] = [];
        await this.poll(async () => {
          resumes = await this.value(session, listResumesScript());
          return Array.isArray(resumes) && resumes.length > 0;
        });
        if (!Array.isArray(resumes) || resumes.length === 0) throw pageChanged();
        if (resumes.length > 1) return { status: "choose", resumes };
        resumeKey = resumes[0]!.resumeKey;
        listedTitle = resumes[0]!.title;
      }
      await session.navigate(editUrl(resumeKey), this.stepTime());
      const state = await this.value<string>(session, pageStateScript());
      if (state === "LOGIN") return ((leave = true), login(tabId));
      if (state !== "EDIT") throw pageChanged();
      if (!(await this.poll(async () => (await this.value<boolean>(session, editReadyScript())) === true)))
        throw pageChanged();
      const read = await this.readServer(session, resumeKey);
      if (read.status === "LOGIN") return ((leave = true), login(tabId));
      if (read.status === "NOT_FOUND") throw new CareerError("CAREER_WANTED_RESUME_NOT_FOUND");
      if (read.status !== "OK") throw pageChanged();
      const careers = careersOf(read.resume);
      const titles = careers.flatMap((career) => career.projects.map((project) => project.title));
      const shown = await this.value<({ start: string; end: string } | null)[]>(session, readPeriodsScript(titles));
      if (!Array.isArray(shown) || shown.length !== titles.length) throw pageChanged();
      let index = 0;
      const periods: ProjectPeriod[] = careers.flatMap((career, c) =>
        career.projects.map((_, p) => {
          const period = shown[index++];
          return period ? { c, p, start: period.start, end: period.end } : null;
        }),
      );
      const { fields, unreadable } = fieldsFromResume(read.resume, periods);
      const apiTitle = typeof read.resume.resume?.title === "string" ? read.resume.resume.title : "";
      return {
        status: "ok",
        resumeKey,
        // The API's own title first: the write compares resumeTitle with it.
        resumeTitle: normalizeText(apiTitle || listedTitle) || "이력서",
        fields,
        unreadable,
        outOfScope: outOfScopeFromResume(read.resume, read.ai),
      };
    } catch (error) {
      if (isInUse(error)) return ((leave = true), humanBrowser(tabOf(error) ?? tab.tabId));
      throw error;
    } finally {
      tab.session.close();
      if (leave) this.leftTab = tab.tabId;
      else await browser.closeTab(tab.tabId);
    }
  }

  async updateResume(args: UpdateWantedResumeArgs): Promise<unknown> {
    const browser = this.requireBrowser();
    const start = this.now();
    this.deadline = start + this.timing.deadlineMs;
    const results: FieldResult[] = [];
    const finish = (stop?: Stop) => {
      const done = results.length;
      args.changes.slice(done).forEach((change, offset) => {
        // The reason belongs to the field where the run stopped. Login, time and a held browser
        // apply to every field left, the rest only waited behind the stop.
        const own = offset === 0 && stop;
        const shared = stop && ["login_required", "time_limit", "browser_in_use", "browser_unreachable"].includes(stop.reason);
        const state: FieldState = own && stop!.touched ? "failed" : "not_inserted";
        const reason: StopReason = own || shared ? stop!.reason : "stopped_earlier";
        results.push({ field: change.field, label: change.label, state, reason });
      });
      return {
        status: results.every((result) => result.state === "inserted") ? "done" : "stopped",
        resumeKey: args.resumeKey,
        results,
      };
    };

    let tab: { tabId: string; session: CdpSession };
    try {
      tab = await browser.openTab("about:blank");
    } catch (error) {
      if (isInUse(error)) return finish(new Stop("browser_in_use"));
      throw error;
    }
    const { session } = tab;
    let touching = false;
    try {
      await this.openEditPage(session, args.resumeKey);
      // Field ids are API positions. Before touching anything, every label must still name the same field:
      // an item added since the read shifts positions, and a same-valued neighbour would pass the fingerprint.
      const first = await this.readServer(session, args.resumeKey);
      if (first.status === "NOT_FOUND") throw new CareerError("CAREER_WANTED_RESUME_NOT_FOUND");
      const initial = expectRead(first, false);
      const apiTitle = typeof initial.resume?.title === "string" ? normalizeText(initial.resume.title) : "";
      const wrongResume = apiTitle !== "" && apiTitle !== normalizeText(args.resumeTitle);
      const shifted = args.changes.map(
        (change) => wrongResume || labelOf(initial, parseField(change.field)!) !== normalizeText(change.label),
      );
      if (shifted.some(Boolean)) {
        // Nothing is touched. The fields whose label no longer matches carry the reason; the rest only waited.
        for (const [index, change] of args.changes.entries())
          results.push({
            field: change.field,
            label: change.label,
            state: "not_inserted",
            reason: shifted[index] ? "page_changed" : "stopped_earlier",
          });
        return finish();
      }
      for (const change of args.changes) {
        const field = parseField(change.field)!;
        const isPeriod = field.kind === "project" && (field.part === "start" || field.part === "end");
        const latest = this.timing.budgetMs - (isPeriod ? this.timing.periodMs : 0);
        if (this.now() - start > latest) return finish(new Stop("time_limit"));
        const resume = expectRead(await this.readServer(session, args.resumeKey), false);
        const located = await this.currentValue(session, args.resumeKey, resume, field);
        if (fingerprint(located.value) !== change.before) return finish(new Stop("fingerprint_mismatch"));
        const shown = await this.value<unknown>(session, fieldValueScript(located.target));
        if (!sameOnPage(shown, located.value, located.period)) return finish(new Stop("page_changed"));
        touching = true;
        if (located.period) await this.setPeriod(session, args.resumeKey, located, change.value);
        else await this.setText(session, args.resumeKey, located, field, change.value);
        touching = false;
        results.push({ field: change.field, label: change.label, state: "inserted" });
      }
      return finish();
    } catch (error) {
      if (error instanceof Stop) return finish(error);
      if (isInUse(error)) return finish(new Stop(touching ? "browser_taken" : "browser_in_use", touching));
      if (error instanceof CareerError && error.code === "CAREER_WANTED_RESUME_NOT_FOUND") throw error;
      if (error instanceof CareerError && error.code === "CAREER_BROWSER_UNREACHABLE")
        return finish(new Stop(this.pastDeadline() ? "time_limit" : "browser_unreachable", touching));
      // An unexpected page or a reply of an unexpected shape keeps the per-field results instead of an error.
      return finish(new Stop("page_changed", touching));
    } finally {
      this.deadline = undefined;
      session.close();
      await browser.closeTab(tab.tabId);
    }
  }

  private requireBrowser(): BrowserLink {
    if (!this.browser) throw new CareerError("CAREER_BROWSER_UNREACHABLE");
    return this.browser;
  }

  private async closeLeftTab(browser: BrowserLink) {
    const left = this.leftTab;
    this.leftTab = undefined;
    if (left) await browser.closeTab(left);
  }

  private async openEditPage(session: CdpSession, resumeKey: string, touched = false) {
    await session.navigate(editUrl(resumeKey), this.stepTime());
    const state = await this.value<string>(session, pageStateScript());
    if (state === "LOGIN") throw new Stop("login_required", touched);
    if (state !== "EDIT") throw new Stop("page_changed", touched);
    if (!(await this.poll(async () => (await this.value<boolean>(session, editReadyScript())) === true)))
      throw new Stop("page_changed", touched);
  }

  private async readServer(session: CdpSession, resumeKey: string): Promise<ReadResult> {
    const read = await this.value<ReadResult>(session, readResumeScript(resumeKey));
    if (!read || typeof read !== "object" || typeof read.status !== "string") throw pageChanged();
    if (read.status === "OK" && (!read.resume || typeof read.resume !== "object")) throw pageChanged();
    return read;
  }

  /** The server's current value of a field and how to find it on the page. Periods come from the page itself. */
  private async currentValue(
    session: CdpSession,
    resumeKey: string,
    resume: ResumeApi,
    field: ParsedField,
  ): Promise<{ value: string; target: PageTarget; period: boolean; projectTitle?: string }> {
    if (field.kind === "about") {
      const about = typeof resume.resume?.about === "string" ? resume.resume.about : "";
      return { value: about, target: { kind: "about" }, period: false };
    }
    const project = careersOf(resume)[field.c]?.projects[field.p];
    if (!project) throw new Stop("page_changed");
    const target: PageTarget = { kind: field.part, projectTitle: project.title };
    if (field.part === "title" || field.part === "description")
      return { value: project[field.part], target, period: false, projectTitle: project.title };
    // Months are not read from the API (the key is undocumented). Reopen the edit page so the value is the
    // server's current one, not what the page showed when the run started.
    await this.openEditPage(session, resumeKey);
    const shown = await this.value<({ start: string; end: string } | null)[]>(session, readPeriodsScript([project.title]));
    const period = Array.isArray(shown) ? shown[0] : null;
    if (!period) throw new Stop("page_changed");
    return { value: period[field.part], target, period: true, projectTitle: project.title };
  }

  private async setText(
    session: CdpSession,
    resumeKey: string,
    located: { target: PageTarget },
    field: ParsedField,
    next: string,
  ) {
    const marker = await this.value<string>(session, setTextScript(located.target, next));
    // These markers come before the first keystroke, so the field is untouched.
    if (marker === "TOO_LONG") throw new Stop("too_long", false);
    if (marker === "NO_ELEMENT" || marker === "AMBIGUOUS" || marker === "BOUNDARY") throw new Stop("page_changed", false);
    if (marker !== "OK") throw new Stop("page_changed", true);
    // onBlur sends the PATCH asynchronously; read the server until it shows the value or time runs out.
    const saved = await this.poll(async () => {
      const read = expectRead(await this.readServer(session, resumeKey), true);
      return normalizeText(serverText(read, field)) === normalizeText(next);
    });
    if (!saved) throw new Stop("not_saved", true);
  }

  private async setPeriod(
    session: CdpSession,
    resumeKey: string,
    located: { target: PageTarget; projectTitle?: string },
    next: string,
  ) {
    const month = normalizeMonth(next)!;
    const [year, monthNumber] = month.split("-").map(Number) as [number, number];
    const which = located.target.kind === "start" ? "start" : "end";
    for (const step of setPeriodSteps(located.projectTitle ?? "", which, year, monthNumber)) {
      if ((await this.value<string>(session, step.run)) !== step.expect) throw new Stop("page_changed", true);
      if (step.waitFor && !(await this.poll(async () => (await this.value<boolean>(session, step.waitFor!)) === true)))
        throw new Stop("page_changed", true);
    }
    // The period API key is not documented; reopen the edit page, which is drawn from the server, and read it there.
    const saved = await this.poll(async () => {
      await this.openEditPage(session, resumeKey, true);
      const shown = await this.value<({ start: string; end: string } | null)[]>(
        session,
        readPeriodsScript([located.projectTitle ?? ""]),
      );
      const period = Array.isArray(shown) ? shown[0] : null;
      return !!period && period[which] === month;
    });
    if (!saved) throw new Stop("not_saved", true);
  }

  /** Runs a page expression with a per-step time limit so one hung step cannot use up the whole run. */
  private async value<T>(session: CdpSession, expression: string): Promise<T> {
    const result = await session.evaluate<T>(expression, this.stepTime());
    if (!result.ok) throw pageChanged();
    return result.value;
  }

  /** A page step's time limit: the step limit, or what is left of the write's deadline. */
  private stepTime(): number {
    if (this.deadline === undefined) return this.timing.stepMs;
    const left = this.deadline - this.now();
    if (left <= 0) throw new CareerError("CAREER_BROWSER_UNREACHABLE");
    return Math.min(this.timing.stepMs, left);
  }

  private pastDeadline(): boolean {
    return this.deadline !== undefined && this.now() >= this.deadline;
  }

  private async poll(check: () => Promise<boolean>): Promise<boolean> {
    const deadline = this.now() + this.timing.waitMs;
    for (;;) {
      if (await check()) return true;
      if (this.now() >= deadline) return false;
      await Bun.sleep(this.timing.pollMs);
    }
  }
}

function expectRead(read: ReadResult, touched: boolean): ResumeApi {
  if (read.status === "LOGIN") throw new Stop("login_required", touched);
  if (read.status !== "OK") throw new Stop("page_changed", touched);
  return read.resume;
}

/** A text field's value on the server, by its API position. Edits do not reorder the API. */
function serverText(resume: ResumeApi, field: ParsedField): string {
  if (field.kind === "about") return typeof resume.resume?.about === "string" ? resume.resume.about : "";
  const project = careersOf(resume)[field.c]?.projects[field.p];
  if (!project || (field.part !== "title" && field.part !== "description")) return "";
  return project[field.part];
}

function sameOnPage(shown: unknown, current: string, period: boolean): boolean {
  if (period) return typeof shown === "string" && shown === current;
  const text = (shown as { value?: unknown } | null)?.value;
  return typeof text === "string" && normalizeText(text) === normalizeText(current);
}

function isInUse(error: unknown): error is CareerError {
  return error instanceof CareerError && error.code === "CAREER_BROWSER_IN_USE";
}

function tabOf(error: CareerError): string | undefined {
  const tab = error.details?.tab;
  return typeof tab === "string" ? tab : undefined;
}

function login(tab: string): Handoff {
  return {
    status: "HUMAN_ACTION_REQUIRED",
    message:
      "원티드 로그인이 필요합니다. 끝나지 않았고 결과가 없습니다. 사용자가 「내 브라우저」 에서 로그인하고 「다 했어요」 를 누를 때까지 다시 부르지 마세요.",
    handoff: { code: "CAREER_WANTED_LOGIN_REQUIRED", need: "login", tab },
  };
}

function humanBrowser(tab: string | undefined): Handoff {
  return {
    status: "HUMAN_ACTION_REQUIRED",
    message:
      "사용자가 「내 브라우저」 를 직접 쓰고 있습니다. 끝나지 않았고 결과가 없습니다. 「돌려주기」 를 누를 때까지 다시 부르지 마세요.",
    handoff: { code: "CAREER_BROWSER_IN_USE", need: "human_browser", ...(tab ? { tab } : {}) },
  };
}
