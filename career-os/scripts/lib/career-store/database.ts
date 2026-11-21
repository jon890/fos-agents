import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { SCHEMA_STEPS } from "./ddl.ts";
import { CareerStoreError } from "./errors.ts";

type Environment = Record<string, string | undefined>;

/** 실행 공간이 마운트하는 커리어 작업 폴더의 기본 위치다. */
export const DEFAULT_CAREER_WORKSPACE_ROOT = "/workspace/career";

const DEFAULT_BUSY_TIMEOUT_MS = 5_000;

export type SqlValue = string | number | bigint | boolean | null | undefined;
type Row = Record<string, unknown>;

/** 커리어 작업 폴더의 루트다. 데이터 파일, 맥락 문서 입력, 실행 폴더, 리포트가 이 아래에 있다. */
export function resolveCareerStoreRoot(environment: Environment = process.env): string {
  const configured = environment.CAREER_WORKSPACE_ROOT?.trim();
  return configured ? resolve(configured) : DEFAULT_CAREER_WORKSPACE_ROOT;
}

export function careerStorePath(root: string): string {
  return join(root, "state", "career.sqlite");
}

function bind(value: SqlValue): string | number | bigint | null {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function sqliteCode(error: unknown): string {
  return typeof (error as { code?: unknown })?.code === "string"
    ? (error as { code: string }).code
    : "";
}

function isBusy(error: unknown): boolean {
  return /^SQLITE_(BUSY|LOCKED)/.test(sqliteCode(error));
}

function busyError(): CareerStoreError {
  return new CareerStoreError(
    503,
    "CAREER_STORE_BUSY",
    "다른 실행이 커리어 데이터 파일을 쓰고 있어 이번 실행을 끝냅니다. 다음 실행이 이어 갑니다.",
  );
}

function corruptError(): CareerStoreError {
  return new CareerStoreError(
    500,
    "CAREER_STORE_CORRUPT",
    "커리어 데이터 파일(state/career.sqlite)을 읽을 수 없습니다. 덮어쓰지 않았습니다. 작업 폴더에서 이 파일과 같은 이름의 -wal, -shm 파일을 지우면 빈 상태로 다시 쌓습니다.",
  );
}

/**
 * SQLite 연결 하나를 감싼다. 질의는 동기지만 저장소 코드가 Backend 의 비동기 모양을 그대로 쓰도록
 * 여기서는 값만 돌려주고, 감싸는 쪽이 `async` 로 부른다.
 */
export class CareerDatabase implements SqlClient {
  private depth = 0;

  constructor(
    readonly raw: Database,
    readonly root: string,
  ) {}

  all<T extends Row = Row>(sql: string, params: SqlValue[] = []): T[] {
    return this.raw.query(sql).all(...params.map(bind)) as T[];
  }

  get<T extends Row = Row>(sql: string, params: SqlValue[] = []): T | undefined {
    return (this.raw.query(sql).get(...params.map(bind)) as T | null) ?? undefined;
  }

  async queryRaw<T = Row[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    const query = fragment(strings, values);
    return this.all(query.text, query.params) as T;
  }

  async executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number> {
    const query = fragment(strings, values);
    return this.run(query.text, query.params);
  }

  async queryRawUnsafe<T = Row[]>(text: string, ...params: unknown[]): Promise<T> {
    return this.all(text, params as SqlValue[]) as T;
  }

  /** 바뀐 행 수를 돌려준다. */
  run(sql: string, params: SqlValue[] = []): number {
    return this.raw.query(sql).run(...params.map(bind)).changes;
  }

  /**
   * 쓰기 transaction 을 연다. `BEGIN IMMEDIATE` 가 파일 전체의 쓰기 잠금을 먼저 잡으므로
   * Backend 가 행 잠금으로 세우던 순서를 이 잠금 하나가 대신한다.
   * 이미 transaction 안이면 그 안에서 그대로 돈다.
   */
  async transaction<T>(callback: () => Promise<T> | T): Promise<T> {
    if (this.depth > 0) return callback();
    try {
      this.raw.exec("BEGIN IMMEDIATE");
    } catch (error) {
      throw isBusy(error) ? busyError() : error;
    }
    this.depth += 1;
    try {
      const result = await callback();
      this.raw.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.raw.exec("ROLLBACK");
      } catch {
        // 이미 되돌려진 transaction 이면 원래 오류만 올린다.
      }
      throw isBusy(error) ? busyError() : error;
    } finally {
      this.depth -= 1;
    }
  }
}

/** `IN (?, ?, …)` 에 넣을 자리표시자를 값 개수만큼 만든다. */
export function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}

function userVersion(db: Database): number {
  return Number((db.query("PRAGMA user_version").get() as { user_version: number }).user_version);
}

/**
 * 모자란 스키마 단계만 적용한다. 쓰기 잠금을 잡은 뒤 버전을 다시 읽어,
 * 두 실행이 동시에 처음 열어도 같은 단계를 두 번 적용하지 않는다.
 */
function migrate(db: Database): void {
  if (userVersion(db) > SCHEMA_STEPS.length) throw corruptError();
  if (userVersion(db) === SCHEMA_STEPS.length) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (let step = userVersion(db); step < SCHEMA_STEPS.length; step += 1) {
      db.exec(SCHEMA_STEPS[step]!);
      db.exec(`PRAGMA user_version = ${step + 1}`);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const opened = new Map<string, CareerDatabase>();

/**
 * 작업 폴더의 커리어 데이터 파일을 연다. 없으면 빈 상태로 만든다.
 * 이미 있는 파일이 열리지 않거나 검사에 실패하면 덮어쓰지 않고 `CAREER_STORE_CORRUPT` 로 던진다.
 */
export function openCareerStore(
  environment: Environment = process.env,
  options: { busyTimeoutMs?: number } = {},
): CareerDatabase {
  const root = resolveCareerStoreRoot(environment);
  const file = careerStorePath(root);
  const cached = opened.get(file);
  if (cached) return cached;

  const existed = existsSync(file);
  if (!existed) mkdirSync(join(root, "state"), { recursive: true });
  let db: Database | undefined;
  try {
    db = new Database(file, { create: true });
    db.exec(`PRAGMA busy_timeout = ${Math.trunc(options.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS)}`);
    if (existed) {
      const check = db.query("PRAGMA integrity_check").all() as Array<{ integrity_check: string }>;
      if (check.length !== 1 || check[0]?.integrity_check !== "ok") throw corruptError();
    }
    db.exec("PRAGMA journal_mode = WAL");
    migrate(db);
  } catch (error) {
    db?.close();
    if (error instanceof CareerStoreError) throw error;
    if (isBusy(error)) throw busyError();
    if (existed) throw corruptError();
    throw error;
  }
  const store = new CareerDatabase(db, root);
  opened.set(file, store);
  return store;
}

/** 열어 둔 연결을 모두 닫는다. 테스트가 임시 작업 폴더를 지우기 전에 부른다. */
export function closeCareerStores(): void {
  for (const store of opened.values()) store.raw.close();
  opened.clear();
}

/** 질의 조각이다. 값은 자리표시자로 빠지고 조각끼리는 그대로 이어 붙는다. */
export class SqlFragment {
  constructor(
    readonly text: string,
    readonly params: SqlValue[],
  ) {}
}

function fragment(strings: readonly string[], values: readonly unknown[]): SqlFragment {
  let text = strings[0] ?? "";
  const params: SqlValue[] = [];
  values.forEach((value, index) => {
    if (value instanceof SqlFragment) {
      text += value.text;
      params.push(...value.params);
    } else {
      text += "?";
      params.push(value as SqlValue);
    }
    text += strings[index + 1] ?? "";
  });
  return new SqlFragment(text, params);
}

/** Backend 저장소 코드가 쓰던 질의 조립 도구와 같은 모양이다. 옮긴 질의를 그대로 읽을 수 있게 둔다. */
export const Sql = {
  sql(strings: TemplateStringsArray, ...values: unknown[]): SqlFragment {
    return fragment(strings, values);
  },
  join(values: readonly SqlValue[]): SqlFragment {
    return new SqlFragment(placeholders(values), [...values]);
  },
  empty: new SqlFragment("", []),
};

/** 태그 붙은 템플릿으로 질의를 실행한다. `${값}` 은 자리표시자로 묶인다. */
export interface SqlClient {
  queryRaw<T = Row[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  queryRawUnsafe<T = Row[]>(text: string, ...params: unknown[]): Promise<T>;
}
