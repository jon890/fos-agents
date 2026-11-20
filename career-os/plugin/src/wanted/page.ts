// Expressions evaluated inside the Wanted tab with `Runtime.evaluate`.
// They port skills/sync-profile/scripts/wanted_*.sh. Each returns a fixed marker or a JSON-able value.
// Values are embedded with JSON.stringify, so quotes, backslashes and newlines survive without base64.

export const WANTED_ORIGIN = "https://www.wanted.co.kr";
export const listUrl = () => `${WANTED_ORIGIN}/cv/list`;
export const editUrl = (resumeKey: string) => `${WANTED_ORIGIN}/cv/${encodeURIComponent(resumeKey)}`;

export type PageTarget =
  | { kind: "about" }
  | { kind: "title" | "description" | "start" | "end"; projectTitle: string };

/** Marker strings a page expression may return instead of a value. */
export const pageMarkers = ["OK", "NO_ELEMENT", "AMBIGUOUS", "BOUNDARY", "TOO_LONG", "INSERT_FAIL", "NO_PROPS"] as const;

/**
 * Helpers shared by the expressions. A project box is found from the one title field whose value equals the
 * project's current title, then the nearest ancestor holding exactly that one title and exactly two period buttons.
 * `title` and `description` keys are also used by other items, so the page order is never trusted.
 */
const PRELUDE = `
  var norm = function(v){ return String(v == null ? "" : v).replace(/\\r\\n?/g, "\\n").trim(); };
  var isPeriod = function(b){ var s = (b.textContent || "").trim(); return s === "YYYY.MM" || /^\\d{4}\\.\\d{1,2}$/.test(s); };
  var periodButtons = function(box){ return Array.from(box.querySelectorAll("button")).filter(isPeriod); };
  var findBox = function(projectTitle){
    var titles = Array.from(document.querySelectorAll("[data-agent-field-key=title]"))
      .filter(function(e){ return norm(e.value) === norm(projectTitle); });
    if (!titles.length) return "NO_ELEMENT";
    if (titles.length > 1) return "AMBIGUOUS";
    var box = titles[0].parentElement;
    for (var n = 0; n < 12 && box; n++) {
      var inside = box.querySelectorAll("[data-agent-field-key=title]").length;
      if (inside > 1) return "BOUNDARY";
      // A project box has exactly its own start and end and one description; a career box around it would
      // show more buttons, and a career box whose project buttons are not drawn yet has no description of its own.
      if (periodButtons(box).length === 2 && box.querySelectorAll("[data-agent-field-key=description]").length === 1)
        return { box: box, title: titles[0] };
      box = box.parentElement;
    }
    return "NO_ELEMENT";
  };
  var findTarget = function(target){
    if (target.kind === "about") {
      var abouts = document.querySelectorAll("[data-agent-field-key=about]");
      return abouts.length === 1 ? { el: abouts[0] } : (abouts.length ? "AMBIGUOUS" : "NO_ELEMENT");
    }
    var found = findBox(target.projectTitle);
    if (typeof found === "string") return found;
    if (target.kind === "title") return { el: found.title };
    if (target.kind === "description") {
      var d = found.box.querySelectorAll("[data-agent-field-key=description]");
      return d.length === 1 ? { el: d[0] } : (d.length ? "AMBIGUOUS" : "NO_ELEMENT");
    }
    var buttons = periodButtons(found.box);
    return { button: buttons[target.kind === "start" ? 0 : 1], box: found.box };
  };
  var periodText = function(button){
    var s = (button.textContent || "").trim();
    var m = /^(\\d{4})\\.(\\d{1,2})$/.exec(s);
    return m ? m[1] + "-" + (m[2].length === 1 ? "0" + m[2] : m[2]) : "";
  };
`;

const iife = (body: string) => `(function(){${PRELUDE}${body}})()`;
const asyncIife = (body: string) => `(async function(){${PRELUDE}${body}})()`;
const json = (value: unknown) => JSON.stringify(value);

/** "EDIT", "LIST", "LOGIN" or "OTHER" from the address and the page. */
export function pageStateScript(): string {
  return iife(`
    var u = new URL(location.href);
    var path = u.pathname;
    // about:blank, chrome-error:// and the like are not a login page.
    if (u.protocol !== "https:" && u.protocol !== "http:") return "OTHER";
    if (/login|signin|signup/i.test(path + u.search) || u.hostname !== "www.wanted.co.kr") return "LOGIN";
    if (path === "/cv/list" || path === "/cv/list/") return "LIST";
    if (/^\\/cv\\/[^/]+\\/?$/.test(path)) return "EDIT";
    return "OTHER";
  `);
}

/** True once the edit form has drawn its fields; the load event fires before React renders them. */
export function editReadyScript(): string {
  return `!!document.querySelector("[data-agent-field-key]")`;
}

/** Resume entries on the list page: [{resumeKey, title, updatedAt}]. Entries without a /cv/<key> link are skipped. */
export function listResumesScript(): string {
  return iife(`
    var items = Array.from(document.querySelectorAll("[class*=ResumeItem_ResumeItem__title__]"));
    var seen = {};
    return items.map(function(t){
      var card = t.closest("[class*=ResumeItem_ResumeItem__]") || t.parentElement;
      var link = t.closest("a[href*='/cv/']") || (card && card.querySelector("a[href*='/cv/']"));
      var m = link ? /\\/cv\\/([^/?#]+)/.exec(link.getAttribute("href") || "") : null;
      if (!m || m[1] === "list" || seen[m[1]]) return null;
      seen[m[1]] = true;
      var date = /(\\d{4}\\.\\d{2}\\.\\d{2})/.exec((card && card.textContent) || "");
      return { resumeKey: decodeURIComponent(m[1]), title: norm(t.textContent), updatedAt: date ? date[1] : "" };
    }).filter(Boolean);
  `);
}

/** Reads the resume API and the AI experience API from inside the tab, with the tab's own login. */
export function readResumeScript(resumeKey: string): string {
  return asyncIife(`
    var key = ${json(resumeKey)};
    var r = await fetch("/api/chaos/resumes/v2/" + encodeURIComponent(key), { headers: { accept: "application/json" } });
    if (r.status === 401 || r.status === 403) return { status: "LOGIN" };
    if (r.status === 404) return { status: "NOT_FOUND" };
    if (!r.ok) return { status: "ERROR" };
    var resume = await r.json();
    var ai = null;
    try {
      var a = await fetch("/api/chaos/resumes/v1/" + encodeURIComponent(key) + "/ai-competencies", { headers: { accept: "application/json" } });
      if (a.ok) ai = (await a.json()).data;
    } catch (e) {}
    return { status: "OK", resume: resume, ai: ai };
  `);
}

/** For each project title, the two period buttons of its box as "YYYY-MM" or "". Null where the box is not found. */
export function readPeriodsScript(titles: string[]): string {
  return iife(`
    return ${json(titles)}.map(function(t){
      var found = findBox(t);
      if (typeof found === "string") return null;
      var b = periodButtons(found.box);
      return { start: periodText(b[0]), end: periodText(b[1]) };
    });
  `);
}

/** The current value of one field on the page, or NO_ELEMENT / AMBIGUOUS / BOUNDARY. */
export function fieldValueScript(target: PageTarget): string {
  return iife(`
    var t = findTarget(${json(target)});
    if (typeof t === "string") return t;
    if (t.button) return periodText(t.button);
    return { value: t.el.value || "" };
  `);
}

/** Same order as wanted_set_field.sh: insertText for the real input path, then React's onBlur sends the PATCH. */
export function setTextScript(target: PageTarget, value: string): string {
  return iife(`
    var v = ${json(value)};
    var t = findTarget(${json(target)});
    if (typeof t === "string") return t;
    var el = t.el;
    if (!el) return "NO_ELEMENT";
    if (el.maxLength > 0 && v.length > el.maxLength) return "TOO_LONG";
    el.scrollIntoView({ block: "center" });
    el.focus();
    if (typeof el.setSelectionRange === "function") el.setSelectionRange(0, (el.value || "").length);
    if (!document.execCommand("insertText", false, v)) return "INSERT_FAIL";
    var k = Object.keys(el).find(function(x){ return x.indexOf("__reactProps") === 0; });
    if (!k || !el[k] || typeof el[k].onBlur !== "function") return "NO_PROPS";
    el[k].onBlur({ target: el, currentTarget: el, type: "blur", preventDefault: function(){}, stopPropagation: function(){} });
    return "OK";
  `);
}

export type PeriodStep = { run: string; expect: string; waitFor?: string };

/** The four steps of wanted_set_period.sh: open the picker, pick the year, pick the month, confirm. */
export function setPeriodSteps(projectTitle: string, which: "start" | "end", year: number, month: number): PeriodStep[] {
  const grid = `document.querySelectorAll("div.wds-z4o2j")`;
  return [
    {
      run: iife(`
        var t = findTarget(${json({ kind: which, projectTitle })});
        if (typeof t === "string") return t;
        if (!t.button) return "NO_ELEMENT";
        t.box.scrollIntoView({ block: "center" });
        t.button.click();
        return "opened";
      `),
      expect: "opened",
      waitFor: `${grid}.length === 1`,
    },
    {
      run: iife(`
        var g = ${grid};
        if (g.length !== 1) return "AMBIGUOUS";
        var y = Array.from(g[0].querySelectorAll("button")).filter(function(x){ return (x.textContent || "").trim() === ${json(String(year))}; })[0];
        if (!y) return "NO_ELEMENT";
        y.click();
        return "year";
      `),
      expect: "year",
      waitFor: `(function(){ var g = ${grid}; return g.length === 1 && Array.from(g[0].querySelectorAll("button")).some(function(x){ return /월$/.test((x.textContent || "").trim()); }); })()`,
    },
    {
      run: iife(`
        var g = ${grid};
        if (g.length !== 1) return "AMBIGUOUS";
        var m = Array.from(g[0].querySelectorAll("button")).filter(function(x){ return (x.textContent || "").trim() === ${json(`${month}월`)}; })[0];
        if (!m) return "NO_ELEMENT";
        m.click();
        return "month";
      `),
      expect: "month",
    },
    {
      run: iife(`
        // Look for 확인 only in the picker around the grid, not anywhere on the page.
        var g = ${grid};
        if (g.length !== 1) return "AMBIGUOUS";
        var scope = g[0];
        for (var n = 0; n < 4 && scope; n++) {
          var ok = Array.from(scope.querySelectorAll("button")).filter(function(x){
            return (x.textContent || "").trim() === "확인" && x.getBoundingClientRect().width > 0;
          });
          if (ok.length === 1) { ok[0].click(); return "confirmed"; }
          if (ok.length > 1) return "AMBIGUOUS";
          scope = scope.parentElement;
        }
        return "NO_ELEMENT";
      `),
      expect: "confirmed",
    },
  ];
}
