/**
 * GitHub 프로필의 월별 토큰 막대 차트(SVG)와 합계를 계산하는 순수 함수.
 *
 * plugin 이 번들하는 유일한 `scripts/` 파일이라 아무것도 import 하지 않는다.
 * 숫자는 0.1B(1억 토큰) 단위 정수로 다룬다. 부동소수점 합을 다시 반올림하면
 * 달별 값의 합과 전체 합계가 한 자리 어긋날 수 있기 때문이다.
 */

export type UsageTokens = { month: string; claudeTokens: number; codexTokens: number };
export type UsageBar = { month: string; claudeTenths: number; codexTenths: number };

const WIDTH = 760;
const HEIGHT = 236;
const LEFT = 64;
const RIGHT = 740;
const TOP = 44.0;
const BASE = 192.0;
const BAR_WIDTH = 94.6;
const FONT = 'font-family="ui-monospace,monospace"';

/** 토큰 수를 0.1B 단위 정수로 바꾼다. 5천만 이상을 올린다. */
export function toTenths(tokens: number): number {
  return Math.floor((tokens + 50_000_000) / 100_000_000);
}

export function selectUsageBars(
  records: UsageTokens[],
  months: string[],
): { bars: UsageBar[]; totalTenths: number; missing: string[] } {
  const byMonth = new Map(records.map((record) => [record.month, record]));
  const bars: UsageBar[] = [];
  const missing: string[] = [];
  for (const month of [...new Set(months)].sort()) {
    const record = byMonth.get(month);
    if (!record) {
      missing.push(month);
      continue;
    }
    bars.push({ month, claudeTenths: toTenths(record.claudeTokens), codexTenths: toTenths(record.codexTokens) });
  }
  const totalTenths = bars.reduce((sum, bar) => sum + bar.claudeTenths + bar.codexTenths, 0);
  return { bars, totalTenths, missing };
}

/** 0.1B 단위 정수를 `97.9B` 모양으로 찍는다. */
export function formatBillions(tenths: number): string {
  return `${Math.floor(tenths / 10)}.${tenths % 10}B`;
}

/** 소수 한 자리로 찍는다. 정확히 절반인 값(.25, .75)만 짝수 쪽으로 보내고 나머지는 toFixed 를 쓴다. */
function fixed1(value: number): string {
  // 소수부가 .25 나 .75 인 값만 이진수로 정확히 절반이다. 0.15 같은 값은 절반이 아니므로 toFixed 에 맡긴다.
  if (Math.abs((value * 4) % 1) === 0 && Math.abs((value * 2) % 1) !== 0) {
    const lower = Math.floor(value * 10);
    return ((lower % 2 === 0 ? lower : lower + 1) / 10).toFixed(1);
  }
  return value.toFixed(1);
}

function billions(value: number): string {
  return `${fixed1(value)}B`;
}

export function renderUsageChart(bars: UsageBar[]): string {
  const months = bars.map((bar) => ({ month: bar.month.replace("-", "."), claude: bar.claudeTenths / 10, codex: bar.codexTenths / 10 }));
  if (months.length === 0) throw new RangeError("막대가 하나도 없어 차트를 그릴 수 없다.");
  const peak = Math.max(...months.map((m) => m.claude + m.codex));
  if (!(peak > 0)) throw new RangeError("모든 막대의 값이 0 이라 차트를 그릴 수 없다.");
  const span = BASE - TOP;
  const slot = (RIGHT - LEFT) / months.length;
  const head = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Tokens processed per month">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0d1117" rx="8"/>`,
    `<text x="64" y="25" fill="#c9d1d9" font-size="13" font-weight="700" ${FONT}>Tokens processed / month</text>`,
    `<rect x="528" y="15" width="9" height="9" fill="#26d0ce" rx="2"/><text x="542" y="24" fill="#8b949e" font-size="11" ${FONT}>Claude Code</text>`,
    `<rect x="644" y="15" width="9" height="9" fill="#7b61ff" rx="2"/><text x="658" y="24" fill="#8b949e" font-size="11" ${FONT}>Codex</text>`,
  ];
  let body = "";
  let labels = "";
  const ticks: Array<[number, string]> = [
    [0, "0"],
    [0.5, billions(peak / 2)],
    [1, billions(peak)],
  ];
  for (const [fraction, label] of ticks) {
    const y = BASE - span * fraction;
    body +=
      `<line x1="${LEFT}" y1="${fixed1(y)}" x2="${RIGHT}" y2="${fixed1(y)}" stroke="#21262d" stroke-width="1"/>` +
      `<text x="54" y="${fixed1(y + 4)}" fill="#6e7681" font-size="10" text-anchor="end" ${FONT}>${label}</text>`;
  }
  months.forEach(({ month, claude, codex }, index) => {
    const center = LEFT + slot * (index + 0.5);
    const x = center - BAR_WIDTH / 2;
    const claudeHeight = (span * claude) / peak;
    const codexHeight = (span * codex) / peak;
    const claudeY = BASE - claudeHeight;
    const codexY = claudeY - codexHeight;
    if (codexHeight > 0.05) {
      body +=
        `<rect x="${fixed1(x)}" y="${fixed1(codexY)}" width="${BAR_WIDTH}" height="${fixed1(codexHeight)}" fill="#7b61ff" rx="4">` +
        `<animate attributeName="height" from="0" to="${fixed1(codexHeight)}" dur="1s" fill="freeze"/>` +
        `<animate attributeName="y" from="${fixed1(claudeY)}" to="${fixed1(codexY)}" dur="1s" fill="freeze"/></rect>`;
    }
    if (claudeHeight > 0.05) {
      body +=
        `<rect x="${fixed1(x)}" y="${fixed1(claudeY)}" width="${BAR_WIDTH}" height="${fixed1(claudeHeight)}" fill="#26d0ce" rx="4">` +
        `<animate attributeName="height" from="0" to="${fixed1(claudeHeight)}" dur="1s" fill="freeze"/>` +
        `<animate attributeName="y" from="${BASE.toFixed(0)}" to="${fixed1(claudeY)}" dur="1s" fill="freeze"/></rect>`;
    }
    labels +=
      `<text x="${fixed1(center)}" y="${fixed1(codexY - 10)}" fill="#e6edf3" font-size="15" font-weight="700" text-anchor="middle" ${FONT}>${billions(claude + codex)}</text>` +
      `<text x="${fixed1(center)}" y="213" fill="#8b949e" font-size="12" text-anchor="middle" ${FONT}>${month}</text>`;
  });
  return [...head, body + labels, "</svg>"].join("\n") + "\n";
}

/** README 의 Tokens 배지 값(`97.9B`)을 읽는다. 배지가 없거나 둘 이상이면 null 이다. */
export function readTokensBadge(readme: string): string | null {
  const matches = [...readme.matchAll(/img\.shields\.io\/badge\/Tokens-(\d+\.\d)B-/g)];
  return matches.length === 1 ? `${matches[0][1]}B` : null;
}
