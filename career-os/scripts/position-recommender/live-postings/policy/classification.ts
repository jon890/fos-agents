import { containsKeyword } from "../../../lib/text.ts";
import { AI_KEYWORDS } from "./keywords.ts";

const FINTECH_KEYWORDS = ["bank", "뱅크", "은행", "loan", "대출", "여신", "수신", "증권"];
const COMMERCE_KEYWORDS = [
  "commerce",
  "커머스",
  "order",
  "주문",
  "payment",
  "payments",
  "결제",
  "정산",
];
const SEARCH_KEYWORDS = ["검색", "rag", "opensearch", "elastic", "vector"];
const BACKEND_KEYWORDS = ["backend", "백엔드", "server", "서버", "spring", "java", "kafka"];

export function classify(text: string): string[] {
  const tags: string[] = [];
  if (containsKeyword(text, FINTECH_KEYWORDS)) tags.push("internet-bank/fintech");
  if (containsKeyword(text, COMMERCE_KEYWORDS)) tags.push("commerce/payment");
  if (containsKeyword(text, SEARCH_KEYWORDS)) tags.push("search/rag");
  if (containsKeyword(text, AI_KEYWORDS)) tags.push("ai-service");
  if (containsKeyword(text, BACKEND_KEYWORDS)) tags.push("backend-platform");
  return tags.length > 0 ? tags : ["other"];
}
