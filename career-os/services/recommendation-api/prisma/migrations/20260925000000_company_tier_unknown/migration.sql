ALTER TABLE company_tier_assessments
  MODIFY COLUMN recommended_tier TINYINT UNSIGNED NULL,
  MODIFY COLUMN confidence ENUM('low', 'medium', 'high') NULL,
  ADD COLUMN assessment TEXT NULL AFTER reason;

-- MySQL CHECK는 UNKNOWN(NULL)을 통과시킨다. 기존 범위 제한은 유지한다.
