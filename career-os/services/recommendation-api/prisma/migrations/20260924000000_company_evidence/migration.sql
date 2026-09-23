-- 회사별 공개 사실을 파일 대신 이 table 이 담는다. ADR-123 을 따른다.
-- collation 은 기존 table 과 같은 utf8mb4_unicode_ci 로 고정한다.
-- 서버 기본값이 다른 곳에서 만들면 company_key 가 다른 table 의 같은 열과 비교되지 않는다.
--
-- url_hash 는 url 의 SHA-256 16진 표기다. 같은 출처를 다시 모았는지 판정하는 고유 키가
-- (company_key, source_type, url) 인데 url 이 VARCHAR(2048) 이라 utf8mb4 에서 8KB 를 넘어
-- InnoDB 의 index key 상한 3072 바이트를 넘긴다. 앞부분만 잘라 index 를 걸면 앞 570자가 같은
-- 서로 다른 url 이 같은 행으로 취급돼 갱신이 엉뚱한 행에 적용된다.
-- 생성 열로 두어 url 과 어긋난 값을 넣을 수 없게 한다.
--
-- https 판정은 utf8mb4_bin 으로 비교한다. 이 table 의 collation 인 utf8mb4_unicode_ci 로
-- 비교하면 HTTPS://example.com 처럼 대문자로 적은 url 이 통과하는데,
-- 계약의 url 검사는 대소문자를 가려 그런 행이 조회 응답 검증에서 거절된다.
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
  url_hash CHAR(64) GENERATED ALWAYS AS (SHA2(url, 256)) STORED,
  title VARCHAR(500) NULL,
  summary TEXT NOT NULL,
  payload_json JSON NOT NULL,
  observed_at DATETIME(3) NOT NULL,
  valid_until DATE NOT NULL,
  UNIQUE KEY uq_company_evidence_source (company_key, source_type, url_hash),
  KEY idx_company_evidence_valid (company_key, valid_until),
  CONSTRAINT chk_company_evidence_https CHECK (LEFT(url, 8) COLLATE utf8mb4_bin = 'https://'),
  CONSTRAINT chk_company_evidence_valid_until CHECK (valid_until >= DATE(observed_at))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
