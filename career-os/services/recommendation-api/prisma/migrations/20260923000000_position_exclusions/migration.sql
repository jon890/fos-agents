-- 개인 공고 제외 규칙을 파일 대신 이 table 이 담는다. ADR-123 을 따른다.
-- collation 은 기존 table 과 같은 utf8mb4_unicode_ci 로 고정한다.
-- 서버 기본값이 다른 곳에서 만들면 company_key 가 다른 table 의 같은 열과 비교되지 않는다.
CREATE TABLE IF NOT EXISTS position_exclusions (
  position_exclusion_id CHAR(36) PRIMARY KEY,
  scope ENUM('posting', 'company', 'company-role') NOT NULL,
  company_key VARCHAR(191) NULL,
  source_key VARCHAR(100) NULL,
  identity_hash VARCHAR(512) NULL,
  normalized_url VARCHAR(2048) NULL,
  title_keywords_json JSON NULL,
  decision_kind ENUM('career-downside', 'manual') NOT NULL,
  reason TEXT NOT NULL,
  evidence_urls_json JSON NOT NULL,
  confidence ENUM('low', 'medium', 'high') NULL,
  decided_at DATE NOT NULL,
  expires_at DATE NULL,
  CONSTRAINT chk_position_exclusion_posting CHECK (
    scope <> 'posting'
    OR source_key IS NOT NULL
    OR identity_hash IS NOT NULL
    OR normalized_url IS NOT NULL
  ),
  CONSTRAINT chk_position_exclusion_company CHECK (
    scope NOT IN ('company', 'company-role') OR company_key IS NOT NULL
  ),
  CONSTRAINT chk_position_exclusion_company_role CHECK (
    scope <> 'company-role' OR title_keywords_json IS NOT NULL
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
