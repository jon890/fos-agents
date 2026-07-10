import { expect, test } from "bun:test";
import { parseKakaoBankPosting } from "./kakaobank-careers.ts";

const notice = { recruitNoticeSn: 257562, recruitNoticeName: "신용리스크 시스템 개발자", recruitClassName: "Core Banking", receiveStartDatetime: "2026-06-19 00:00:00", receiveEndDatetime: "2026-07-10 23:59:59" };
const detailHtml = `<h1>신용리스크 시스템 개발자</h1><p>지원하기</p><h2>담당할 업무</h2><p>Java와 Spring Boot 기반 신용리스크 시스템을 개발하고 운영합니다.</p><h2>필수 경험과 역량</h2><p>Java, Spring Boot 기반 백엔드 개발 경험과 RDBMS 설계 역량이 필요합니다.</p><h2>우대사항</h2><p>금융 리스크 시스템 경험이 있으면 좋습니다.</p><h2>근무 관련 정보</h2><p>정규직</p>`;

test("카카오뱅크 공식 공고를 서버 역할 Posting으로 정규화한다", () => {
  const posting = parseKakaoBankPosting(notice, detailHtml);
  expect(posting).toMatchObject({ source: "kakaobank-careers", company: "카카오뱅크", title: "신용리스크 시스템 개발자", postingStatus: "open" });
  expect(posting?.url).toBe("https://recruit.kakaobank.com/jobs/257562");
  expect(posting?.skills).toEqual(expect.arrayContaining(["Java", "Spring", "Spring Boot"]));
});

test("계약직 공고는 수집하지 않는다", () => {
  expect(parseKakaoBankPosting({ ...notice, recruitNoticeName: "시스템 개발자 (계약직)" }, detailHtml)).toBeNull();
});
