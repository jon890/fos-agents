import { expect, test } from "bun:test";
import { extractKurlyDetailUrls, parseKurlyPosting } from "./kurly-careers.ts";

const detailHtml = `
  <html><head><title>핀테크 백엔드 개발자 (결제) | 컬리</title></head>
  <body>
    <h1>핀테크 백엔드 개발자 (결제)</h1>
    <p>지원하기</p>
    <h2>주요 업무</h2><p>Payment 및 Billing 시스템을 Java와 Kotlin, Spring으로 설계하고 운영합니다.</p>
    <h2>자격 요건</h2><p>Java/Kotlin과 Spring Framework 개발 경력 5년 이상이 필요합니다.</p>
    <h2>우대 사항</h2><p>AWS와 Kafka, SAP 또는 ERP 연동 경험이 있으면 좋습니다.</p>
    <h2>합류 여정</h2><p>서류 전형 후 면접을 진행합니다.</p>
  </body></html>
`;

test("컬리 공식 목록에서 개별 공고 URL만 찾는다", () => {
  expect(
    extractKurlyDetailUrls('<a href="/ko/o/198009">공고</a><a href="https://kurly.career.greetinghr.com/ko/o/198010">공고</a>')
  ).toEqual([
    "https://kurly.career.greetinghr.com/ko/o/198009",
    "https://kurly.career.greetinghr.com/ko/o/198010",
  ]);
});

test("공식 개별 공고의 적용 가능 상태와 JD를 Posting으로 정규화한다", () => {
  const posting = parseKurlyPosting("https://kurly.career.greetinghr.com/ko/o/198009", detailHtml);
  expect(posting).toMatchObject({
    source: "kurly-careers",
    company: "컬리",
    title: "핀테크 백엔드 개발자 (결제)",
    postingStatus: "open",
    linkType: "direct_posting",
  });
  expect(posting?.mainTasks).toContain("Payment");
  expect(posting?.requirements).toContain("5년 이상");
  expect(posting?.skills).toEqual(expect.arrayContaining(["Java", "Kotlin", "Spring", "AWS", "Kafka"]));
});

test("본문의 우연한 키워드만으로 비개발 직무를 수집하지 않는다", () => {
  const mdHtml = detailHtml
    .replace(/핀테크 백엔드 개발자 \(결제\)/g, "축산 MD")
    .replace("Payment 및 Billing 시스템을 Java와 Kotlin, Spring으로 설계하고 운영합니다.", "캠페인과 상품 운영을 담당합니다.");
  expect(parseKurlyPosting("https://kurly.career.greetinghr.com/ko/o/225792", mdHtml)).toBeNull();
});
