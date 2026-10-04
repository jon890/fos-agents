import aiPlatform from "../../public/question-bank/ai-platform/questions.json" with { type: "json" };
import behavioral from "../../public/question-bank/behavioral/questions.json" with { type: "json" };
import cs from "../../public/question-bank/cs/questions.json" with { type: "json" };
import database from "../../public/question-bank/database/questions.json" with { type: "json" };
import javaSpring from "../../public/question-bank/java-spring/questions.json" with { type: "json" };
import operations from "../../public/question-bank/operations/questions.json" with { type: "json" };
import systemDesign from "../../public/question-bank/system-design/questions.json" with { type: "json" };
import type { SelectableQuestion } from "./question-selection.ts";

// 공개 질문 은행은 정적 import 로 번들에 들어가므로 실행 파일 위치나 작업 디렉터리와 무관하게 같은 질문을 읽는다.
// 기술 질문의 카테고리 순서가 공개 질문 선별 결과를 정한다. 순서를 바꾸면 노트북과 대화가 같은 날 다른 질문을 고른다.
// 은행 파일은 scripts/question-bank-collector/validate.ts 가 검증하므로 런타임에 다시 parse 하지 않는다.
export const publicTechQuestions = [
  ...javaSpring,
  ...database,
  ...cs,
  ...operations,
  ...systemDesign,
  ...aiPlatform,
] as unknown as SelectableQuestion[];
export const publicBehavioralQuestions = behavioral as unknown as SelectableQuestion[];
