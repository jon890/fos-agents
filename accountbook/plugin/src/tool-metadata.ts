import connector from "../connector.json";

// 표시 설명의 정본은 manifest다. 승인과 실행 정책은 기존 경로에서 별도로 판정한다.
export function toolDescription(name: keyof typeof connector.tools): string {
  return connector.tools[name].description;
}
