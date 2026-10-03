-- 원티드, LinkedIn, GitHub 에 올리는 프로필 원고와 그 이력을 이 두 table 이 담는다. ADR-133 을 따른다.
-- 문서 키는 셋으로 고정한다. 오타로 새 문서가 생기지 않게 CHECK 로도 막는다.
-- 이력 행은 고치거나 지우지 않는다. 문서 행도 지우지 않으므로 외래 키는 RESTRICT 다.
CREATE TABLE profile_documents (
  document_key VARCHAR(50) PRIMARY KEY,
  body MEDIUMTEXT NOT NULL,
  version INT UNSIGNED NOT NULL,
  note VARCHAR(500) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT chk_profile_document_key CHECK (document_key IN ('wanted', 'linkedin', 'github')),
  CONSTRAINT chk_profile_document_version CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE profile_document_revisions (
  document_key VARCHAR(50) NOT NULL,
  version INT UNSIGNED NOT NULL,
  body MEDIUMTEXT NOT NULL,
  note VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (document_key, version),
  CONSTRAINT fk_profile_document_revision_document FOREIGN KEY (document_key)
    REFERENCES profile_documents (document_key) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
