import { expect, test } from "bun:test";
import { parseKraftonJob } from "./krafton-careers.ts";

const baseJob = {
  id: 8581491002,
  title: "[AI Transformation Dept.] Sr. AI DevOps Engineer (7년 이상)",
  absolute_url: "https://job-boards.greenhouse.io/krafton/jobs/8581491002",
  content:
    "&lt;h3&gt;우리 팀과 함께할 미션을 소개합니다.&lt;/h3&gt;&lt;p&gt;AI 전환(AX)을 위한 DevOps 플랫폼을 구축합니다.&lt;/p&gt;" +
    "&lt;h3&gt;이런 경험을 가진 분과 함께 성장하고 싶습니다! (필수요건)&lt;/h3&gt;&lt;p&gt;Kubernetes, Terraform 기반 인프라 운영 경험이 필요합니다.&lt;/p&gt;" +
    "&lt;h3&gt;이런 경험들이 있다면 저희가 찾는 그 분입니다! (우대요건)&lt;/h3&gt;&lt;p&gt;LLM 서빙 인프라 경험이 있으면 좋습니다.&lt;/p&gt;" +
    "&lt;h3&gt;고용형태&lt;/h3&gt;&lt;p&gt;전문계약직&lt;/p&gt;",
  first_published: "2026-04-17T04:21:48-04:00",
  application_deadline: null,
  departments: [{ name: "IT Infra" }],
  metadata: [{ name: "Employment Type", value: "Professional Contractor" }],
};

test("크래프톤 AI/AX 공고를 direct posting으로 정규화한다", () => {
  const posting = parseKraftonJob(baseJob);
  expect(posting).toMatchObject({ source: "krafton-careers", company: "크래프톤", postingStatus: "open", linkType: "direct_posting" });
  expect(posting?.url).toBe("https://job-boards.greenhouse.io/krafton/jobs/8581491002");
  expect(posting?.closesAt).toBe("no_deadline");
  expect(posting?.skills).toEqual(expect.arrayContaining(["Kubernetes", "Terraform", "LLM"]));
});

test("전문계약직(Professional Contractor)은 수집한다", () => {
  expect(parseKraftonJob(baseJob)).not.toBeNull();
});

test("AI/AX 부서가 아닌 공고는 수집하지 않는다", () => {
  expect(parseKraftonJob({ ...baseJob, title: "[Infra Div.] Database Engineer (8년 이상)" })).toBeNull();
});

test("title에 (계약직)/(인턴)이 명시된 단기 공고는 제외한다", () => {
  expect(parseKraftonJob({ ...baseJob, title: "[AI Research Div.] Research Engineer (계약직)" })).toBeNull();
});

test("Internship/Contractor 고용형태는 제외한다", () => {
  expect(parseKraftonJob({ ...baseJob, metadata: [{ name: "Employment Type", value: "Internship" }] })).toBeNull();
});

test("연구·PM 등 비엔지니어링 title은 제외한다", () => {
  expect(parseKraftonJob({ ...baseJob, title: "[AI Frontier Div.] Product Owner (7년 이상)" })).toBeNull();
  expect(parseKraftonJob({ ...baseJob, title: "[AI Research Div.] Research Scientist - Foundation Models" })).toBeNull();
});
