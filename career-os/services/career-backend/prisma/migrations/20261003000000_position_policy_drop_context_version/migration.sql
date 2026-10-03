-- 포지션 분석의 기준 버전은 position-preferences 후보자 맥락 문서의 version 에서 계산한다. ADR-134 를 따른다.
-- 정책 행의 기준 버전 칸은 더 읽지 않으므로 지운다.
ALTER TABLE position_analysis_policy DROP COLUMN candidate_context_version;
