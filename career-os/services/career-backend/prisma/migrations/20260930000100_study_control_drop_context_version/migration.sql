-- 공부 추천의 기준 버전은 learning-interests 후보자 맥락 문서의 version 에서 계산한다. ADR-131 을 따른다.
-- 사람이 따로 올리던 control 행의 기준 버전 칸은 더 읽지 않으므로 지운다.
ALTER TABLE study_recommendation_control DROP COLUMN candidate_context_version;
