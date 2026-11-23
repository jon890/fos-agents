import { CareerError, configuredValue } from "../errors.ts";

// A small CDP client for the owner's browser behind the fos-assistant relay.
// The relay is called like Chrome's own debugging endpoint: HTTP `json/*` plus a page WebSocket.
// Same contract as fos-assistant's naver-blog plugin; written here because that code lives in another repository.

/** Proxy variables Bun's fetch and WebSocket read. The relay address is private, so a proxy cannot reach it. */
const PROXY_ENVIRONMENT_KEYS = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"];

const HTTP_TIMEOUT_MS = 5_000;
const COMMAND_TIMEOUT_MS = 30_000;
/** The relay answers HTTP with 423 while a person holds the browser. */
const HUMAN_HELD_STATUS = 423;
/** The relay closes WebSockets with this code when a person takes the browser. */
export const HUMAN_HELD_CLOSE = 4423;

/**
 * Runs `start` with the proxy variables removed, then puts them back, as fos-assistant's naver-blog plugin does.
 * Measured on Bun 1.3.14: a proxy set when the process starts is still used, so this only helps when the
 * variables change at run time. The fos-assistant MCP environment sets no proxy; restoring keeps Backend
 * and GitHub calls unaffected either way.
 */
function withoutProxy<T>(start: () => T): T {
  const saved = PROXY_ENVIRONMENT_KEYS.map((key) => [key, process.env[key]] as const);
  for (const key of PROXY_ENVIRONMENT_KEYS) delete process.env[key];
  try {
    return start();
  } finally {
    for (const [key, value] of saved) if (value !== undefined) process.env[key] = value;
  }
}

const unreachable = () => new CareerError("CAREER_BROWSER_UNREACHABLE");
const humanHeld = (tab?: string) => new CareerError("CAREER_BROWSER_IN_USE", tab ? { tab } : undefined);

/** The relay address the install puts in `CAREER_BROWSER_URL`, or undefined when it is empty or unset. */
export function browserEndpoint(env: Record<string, string | undefined>): string | undefined {
  const value = configuredValue(env.CAREER_BROWSER_URL);
  return value ? value.replace(/\/+$/, "") : undefined;
}

/** Calls a debugging HTTP endpoint. Non-JSON answers come back as text. Bodies of failures are never kept. */
export async function httpJson(
  endpoint: string,
  path: string,
  { method = "GET", timeoutMs = HTTP_TIMEOUT_MS }: { method?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  let text: string;
  try {
    const response = await withoutProxy(() =>
      fetch(`${endpoint}${path}`, {
        method,
        signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
        redirect: "error",
      }),
    );
    if (response.status === HUMAN_HELD_STATUS) throw humanHeld();
    if (!response.ok) throw unreachable();
    text = await response.text();
  } catch (error) {
    if (error instanceof CareerError) throw error;
    throw unreachable();
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Takes only the path of the browser-given WebSocket URL and joins it to the host we were given.
 * The path must stay under our endpoint's path (the relay's access token) and `devtools/`.
 */
export function wsUrlFor(endpoint: string, webSocketDebuggerUrl: string): string {
  let base: URL;
  let debuggerPath: string;
  try {
    base = new URL(endpoint);
    debuggerPath = new URL(webSocketDebuggerUrl).pathname;
  } catch {
    throw unreachable();
  }
  const prefix = base.pathname.replace(/\/+$/, "");
  if (!debuggerPath.startsWith(`${prefix}/devtools/`)) throw unreachable();
  return `${base.protocol === "https:" ? "wss:" : "ws:"}//${base.host}${debuggerPath}`;
}

function pageOf(wsUrl: string): string | undefined {
  return /\/devtools\/page\/([A-Za-z0-9]+)$/.exec(wsUrl)?.[1];
}

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

export type Evaluation<T> = { ok: true; value: T } | { ok: false };

/** One CDP WebSocket. Commands are matched by id and each has a time limit. */
export class CdpSession {
  private nextId = 1;
  private closed = false;
  private failure: () => CareerError = unreachable;
  private readonly pending = new Map<number, Pending>();
  private readonly waiters = new Map<string, Set<() => void>>();

  private constructor(
    private readonly socket: WebSocket,
    readonly tab: string | undefined,
  ) {
    socket.addEventListener("message", (event) => this.receive(event.data));
    socket.addEventListener("close", (event) => {
      if (event.code === HUMAN_HELD_CLOSE) this.failure = () => humanHeld(this.tab);
      this.shutdown();
    });
    socket.addEventListener("error", () => this.shutdown());
  }

  /** Connects without an `Origin` header; the relay rejects requests that look like they came from a page. */
  static connect(wsUrl: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<CdpSession> {
    return new Promise((resolve, reject) => {
      let socket: WebSocket;
      try {
        socket = withoutProxy(() => new WebSocket(wsUrl));
      } catch {
        reject(unreachable());
        return;
      }
      const timer = setTimeout(() => {
        socket.close();
        reject(unreachable());
      }, Math.max(1, timeoutMs));
      const fail = (event: Event) => {
        clearTimeout(timer);
        reject((event as CloseEvent).code === HUMAN_HELD_CLOSE ? humanHeld(pageOf(wsUrl)) : unreachable());
      };
      socket.addEventListener("error", fail, { once: true });
      socket.addEventListener("close", fail, { once: true });
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          socket.removeEventListener("error", fail);
          socket.removeEventListener("close", fail);
          resolve(new CdpSession(socket, pageOf(wsUrl)));
        },
        { once: true },
      );
    });
  }

  /** Sends a command and waits for the reply with the same id. Browser error texts are dropped. */
  send<T = any>(method: string, params: Record<string, unknown> = {}, timeoutMs = COMMAND_TIMEOUT_MS): Promise<T> {
    if (this.closed) return Promise.reject(this.failure());
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(unreachable());
      }, Math.max(1, timeoutMs));
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(unreachable());
      }
    });
  }

  /** Runs an expression in the page. A page exception is `{ok: false}`; a lost connection still throws. */
  async evaluate<T>(expression: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<Evaluation<T>> {
    const reply = await this.send<{ result?: { value?: unknown }; exceptionDetails?: unknown }>(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      timeoutMs,
    );
    if (!reply || reply.exceptionDetails) return { ok: false };
    return { ok: true, value: reply.result?.value as T };
  }

  /** Navigates the tab and waits for its load event. */
  async navigate(url: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<void> {
    await this.send("Page.enable", {}, timeoutMs);
    const loaded = this.waitFor("Page.loadEventFired", timeoutMs);
    await this.send("Page.navigate", { url }, timeoutMs);
    await loaded;
  }

  close(): void {
    try {
      this.socket.close();
    } catch {
      // already closed
    }
    this.shutdown();
  }

  private waitFor(event: string, timeoutMs: number): Promise<void> {
    if (this.closed) return Promise.reject(this.failure());
    return new Promise((resolve, reject) => {
      const set = this.waiters.get(event) ?? new Set();
      this.waiters.set(event, set);
      const done = () => {
        clearTimeout(timer);
        set.delete(done);
        if (this.closed) reject(this.failure());
        else resolve();
      };
      const timer = setTimeout(() => {
        set.delete(done);
        reject(unreachable());
      }, Math.max(1, timeoutMs));
      set.add(done);
    });
  }

  private receive(data: unknown) {
    let message: { id?: number; method?: string; result?: unknown; error?: unknown };
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    if (typeof message.id === "number") {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(unreachable());
      else entry.resolve(message.result);
      return;
    }
    if (message.method) for (const done of [...(this.waiters.get(message.method) ?? [])]) done();
  }

  private shutdown() {
    if (this.closed) return;
    this.closed = true;
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(this.failure());
      this.pending.delete(id);
    }
    for (const set of this.waiters.values()) for (const done of [...set]) done();
  }
}

/** How tools open and close tabs. Tests pass a stand-in. */
export interface BrowserLink {
  openTab(url: string): Promise<{ tabId: string; session: CdpSession }>;
  closeTab(tabId: string): Promise<void>;
}

type TargetInfo = { id?: unknown; webSocketDebuggerUrl?: unknown };

export function relayBrowser(endpoint: string): BrowserLink {
  return {
    async openTab(url) {
      const target = (await httpJson(endpoint, `/json/new?${encodeURI(url)}`, { method: "PUT" })) as TargetInfo;
      if (typeof target?.id !== "string" || typeof target.webSocketDebuggerUrl !== "string") throw unreachable();
      const session = await CdpSession.connect(wsUrlFor(endpoint, target.webSocketDebuggerUrl));
      return { tabId: target.id, session };
    },
    async closeTab(tabId) {
      // A tab an open handoff card points at is refused with 409; that is expected and ignored.
      try {
        await httpJson(endpoint, `/json/close/${encodeURIComponent(tabId)}`);
      } catch {
        // ignore
      }
    },
  };
}
