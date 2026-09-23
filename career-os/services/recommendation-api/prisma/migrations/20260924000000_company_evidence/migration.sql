-- 회사별 공개 사실을 파일 대신 이 table 이 담는다. ADR-123 을 따른다.
-- collation 은 기존 table 과 같은 utf8mb4_unicode_ci 로 고정한다.
-- 서버 기본값이 다른 곳에서 만들면 company_key 가 다른 table 의 같은 열과 비교되지 않는다.
--
-- url_hash 는 url 의 SHA-256 16진 표기다. 같은 출처를 다시 모았는지 판정하는 고유 키가
-- (company_key, source_type, url) 인데 url 이 VARCHAR(2048) 이라 utf8mb4 에서 8KB 를 넘어
-- InnoDB 의 index key 상한 3072 바이트를 넘긴다. 앞부분만 잘라 index 를 걸면 앞 570자가 같은
-- 서로 다른 url 이 같은 행으로 취급돼 갱신이 엉뚱한 행에 적용된다.
-- positions 의 identity_hash 와 같은 방식으로 전체 값을 해시해 그 해시에 고유 키를 건다.
CREATE TABLE IF NOT EXISTS company_evidence (
  company_evidence_id CHAR(36) PRIMARY KEY,
  company_key VARCHAR(191) NOT NULL,
  source_type ENUM(
    'dart-employment',
    'dart-financial',
    'tech-blog',
    'github',
    'conference',
    'review',
    'job-posting',
    'official',
    'other'
  ) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  url_hash CHAR(64) NOT NULL,
  title VARCHAR(500) NULL,
  summary TEXT NOT NULL,
  payload_json JSON NOT NULL,
  observed_at DATETIME(3) NOT NULL,
  valid_until DATE NOT NULL,
  UNIQUE KEY uq_company_evidence_source (company_key, source_type, url_hash),
  KEY idx_company_evidence_valid (company_key, valid_until),
  CONSTRAINT chk_company_evidence_https CHECK (url LIKE 'https://%'),
  CONSTRAINT chk_company_evidence_valid_until CHECK (valid_until >= DATE(observed_at))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
