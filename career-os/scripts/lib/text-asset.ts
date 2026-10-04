/**
 * 텍스트 import(`with { type: "text" }`) 로 읽은 값을 문자열로 확정한다.
 * Bun 타입은 `.html` 을 `HTMLBundle` 로 선언하지만 런타임 값은 문자열이라, 여기서 확인한 뒤 넘긴다.
 */
export function textAsset(value: unknown, name: string): string {
  if (typeof value === "string") return value;
  throw new Error(`텍스트 자산이 문자열이 아니다: ${name}`);
}
