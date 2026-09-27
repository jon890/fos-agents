CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE position_sources (
  source_key VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_successful_collection_at DATETIME(3) NULL
) ENGINE=InnoDB;

CREATE TABLE position_collection_runs (
  run_id VARCHAR(191) PRIMARY KEY,
  idempotency_key VARCHAR(200) NOT NULL UNIQUE,
  collected_at DATETIME(3) NOT NULL,
  status ENUM('processing', 'completed', 'failed') NOT NULL,
  active_count INT UNSIGNED NOT NULL DEFAULT 0,
  personal_excluded_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE position_source_run_diagnostics (
  run_id VARCHAR(191) NOT NULL,
  source_key VARCHAR(100) NOT NULL,
  status ENUM('ok', 'partial', 'failed') NOT NULL,
  collected_count INT UNSIGNED NOT NULL,
  imported_count INT UNSIGNED NOT NULL,
  skipped_count INT UNSIGNED NOT NULL,
  failed_count INT UNSIGNED NOT NULL,
  public_message VARCHAR(500) NOT NULL DEFAULT '',
  PRIMARY KEY (run_id, source_key),
  CONSTRAINT fk_position_diagnostics_run
    FOREIGN KEY (run_id) REFERENCES position_collection_runs(run_id) ON DELETE CASCADE,
  CONSTRAINT fk_position_diagnostics_source
    FOREIGN KEY (source_key) REFERENCES position_sources(source_key) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE positions (
  position_id CHAR(36) PRIMARY KEY,
  source_key VARCHAR(100) NOT NULL,
  identity_hash VARCHAR(512) NOT NULL,
  normalized_url VARCHAR(2048) NOT NULL,
  company_key VARCHAR(191) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  lifecycle ENUM('active', 'closed', 'not_seen') NOT NULL,
  first_seen_at DATETIME(3) NOT NULL,
  last_seen_at DATETIME(3) NOT NULL,
  pending_since DATETIME(3) NULL,
  UNIQUE KEY uq_positions_source_identity (source_key, identity_hash),
  CONSTRAINT fk_positions_source
    FOREIGN KEY (source_key) REFERENCES position_sources(source_key) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE position_versions (
  position_version_id CHAR(36) PRIMARY KEY,
  position_id CHAR(36) NOT NULL,
  content_hash CHAR(71) NOT NULL,
  snapshot_json JSON NOT NULL,
  observed_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_position_versions_hash (position_id, content_hash),
  CONSTRAINT fk_position_versions_position
    FOREIGN KEY (position_id) REFERENCES positions(position_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE position_collection_items (
  run_id VARCHAR(191) NOT NULL,
  position_id CHAR(36) NOT NULL,
  position_version_id CHAR(36) NOT NULL,
  posting_status ENUM('active', 'open') NOT NULL,
  close_urgency ENUM('urgent', 'soon', 'normal', 'no_deadline', 'unknown') NOT NULL,
  PRIMARY KEY (run_id, position_id),
  CONSTRAINT fk_position_collection_items_run
    FOREIGN KEY (run_id) REFERENCES position_collection_runs(run_id) ON DELETE CASCADE,
  CONSTRAINT fk_position_collection_items_position
    FOREIGN KEY (position_id) REFERENCES positions(position_id) ON DELETE RESTRICT,
  CONSTRAINT fk_position_collection_items_version
    FOREIGN KEY (position_version_id) REFERENCES position_versions(position_version_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE position_analysis_policy (
  singleton_id TINYINT PRIMARY KEY,
  candidate_context_version VARCHAR(191) NOT NULL,
  daily_analysis_limit TINYINT UNSIGNED NOT NULL,
  priority_slots TINYINT UNSIGNED NOT NULL,
  aging_slots TINYINT UNSIGNED NOT NULL,
  stale_after_days SMALLINT UNSIGNED NOT NULL,
  default_company_tier TINYINT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_position_policy_singleton CHECK (singleton_id = 1),
  CONSTRAINT chk_position_policy_limit CHECK (daily_analysis_limit BETWEEN 1 AND 20),
  CONSTRAINT chk_position_policy_slots CHECK (priority_slots + aging_slots = daily_analysis_limit),
  CONSTRAINT chk_position_policy_tier CHECK (default_company_tier BETWEEN 1 AND 3)
) ENGINE=InnoDB;

CREATE TABLE company_preferences (
  company_key VARCHAR(191) PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  tier TINYINT UNSIGNED NOT NULL,
  disposition ENUM('analyze', 'exclude') NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_company_preference_tier CHECK (tier BETWEEN 1 AND 3)
) ENGINE=InnoDB;

CREATE TABLE position_analysis_runs (
  analysis_run_id CHAR(36) PRIMARY KEY,
  collection_run_id VARCHAR(191) NOT NULL UNIQUE,
  candidate_context_version VARCHAR(191) NOT NULL,
  contract_version INT UNSIGNED NOT NULL,
  status ENUM('pending', 'partial', 'completed') NOT NULL,
  analyzed_now_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  CONSTRAINT fk_position_analysis_runs_collection
    FOREIGN KEY (collection_run_id) REFERENCES position_collection_runs(run_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE position_analyses (
  analysis_id CHAR(36) PRIMARY KEY,
  position_id CHAR(36) NOT NULL,
  position_version_id CHAR(36) NOT NULL,
  candidate_context_version VARCHAR(191) NOT NULL,
  contract_version INT UNSIGNED NOT NULL,
  created_by_analysis_run_id CHAR(36) NULL,
  analyzed_at DATETIME(3) NOT NULL,
  valid_until DATE NOT NULL,
  company_tier_at_analysis TINYINT UNSIGNED NOT NULL,
  decision ENUM('recommend', 'consider', 'hold') NOT NULL,
  fit_score TINYINT UNSIGNED NOT NULL,
  role_fit TINYINT UNSIGNED NOT NULL,
  scope_upside TINYINT UNSIGNED NOT NULL,
  company_opportunity TINYINT UNSIGNED NOT NULL,
  constraints_score TINYINT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  details_json JSON NOT NULL,
  next_actions_json JSON NOT NULL,
  UNIQUE KEY uq_position_analysis_version_context_contract
    (position_version_id, candidate_context_version, contract_version),
  CONSTRAINT fk_position_analyses_position
    FOREIGN KEY (position_id) REFERENCES positions(position_id) ON DELETE RESTRICT,
  CONSTRAINT fk_position_analyses_version
    FOREIGN KEY (position_version_id) REFERENCES position_versions(position_version_id) ON DELETE RESTRICT,
  CONSTRAINT fk_position_analyses_created_run
    FOREIGN KEY (created_by_analysis_run_id)
    REFERENCES position_analysis_runs(analysis_run_id) ON DELETE RESTRICT,
  CONSTRAINT chk_position_analysis_fit CHECK (fit_score BETWEEN 0 AND 100),
  CONSTRAINT chk_position_analysis_sum CHECK (
    fit_score = role_fit + scope_upside + company_opportunity + constraints_score
  )
) ENGINE=InnoDB;

CREATE TABLE position_analysis_run_items (
  analysis_run_id CHAR(36) NOT NULL,
  position_id CHAR(36) NOT NULL,
  position_version_id CHAR(36) NOT NULL,
  selection_order SMALLINT UNSIGNED NOT NULL,
  analysis_status ENUM('new', 'changed', 'stale') NOT NULL,
  selection_reason ENUM('priority', 'aging', 'overflow') NOT NULL,
  company_tier TINYINT UNSIGNED NOT NULL,
  result_status ENUM('pending', 'created', 'reused', 'failed') NOT NULL DEFAULT 'pending',
  analysis_id CHAR(36) NULL,
  failure_code VARCHAR(64) NULL,
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  completed_at DATETIME(3) NULL,
  PRIMARY KEY (analysis_run_id, position_id),
  UNIQUE KEY uq_position_analysis_order (analysis_run_id, selection_order),
  KEY idx_position_analysis_items_analysis (analysis_id),
  CONSTRAINT fk_position_analysis_items_run
    FOREIGN KEY (analysis_run_id) REFERENCES position_analysis_runs(analysis_run_id) ON DELETE CASCADE,
  CONSTRAINT fk_position_analysis_items_position
    FOREIGN KEY (position_id) REFERENCES positions(position_id) ON DELETE RESTRICT,
  CONSTRAINT fk_position_analysis_items_version
    FOREIGN KEY (position_version_id) REFERENCES position_versions(position_version_id) ON DELETE RESTRICT,
  CONSTRAINT fk_position_analysis_items_analysis
    FOREIGN KEY (analysis_id) REFERENCES position_analyses(analysis_id) ON DELETE RESTRICT,
  CONSTRAINT chk_position_analysis_item_result CHECK (
    (result_status = 'pending'
      AND analysis_id IS NULL AND completed_at IS NULL AND failure_code IS NULL)
    OR (result_status IN ('created', 'reused')
      AND analysis_id IS NOT NULL AND completed_at IS NOT NULL AND failure_code IS NULL)
    OR (result_status = 'failed'
      AND analysis_id IS NULL AND completed_at IS NOT NULL AND failure_code IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE position_recommendation_runs (
  recommendation_run_id CHAR(36) PRIMARY KEY,
  analysis_run_id CHAR(36) NOT NULL UNIQUE,
  collection_run_id VARCHAR(191) NOT NULL,
  generated_at DATETIME(3) NOT NULL,
  analyzed_now_count INT UNSIGNED NOT NULL,
  reused_count INT UNSIGNED NOT NULL,
  pending_count INT UNSIGNED NOT NULL,
  pending_candidates_json JSON NOT NULL,
  personal_excluded_count INT UNSIGNED NOT NULL,
  CONSTRAINT fk_position_recommendation_analysis_run
    FOREIGN KEY (analysis_run_id) REFERENCES position_analysis_runs(analysis_run_id) ON DELETE RESTRICT,
  CONSTRAINT fk_position_recommendation_collection_run
    FOREIGN KEY (collection_run_id) REFERENCES position_collection_runs(run_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE position_recommendation_items (
  recommendation_run_id CHAR(36) NOT NULL,
  position_id CHAR(36) NOT NULL,
  analysis_id CHAR(36) NOT NULL,
  rank_number INT UNSIGNED NOT NULL,
  decision ENUM('recommend', 'consider', 'hold') NOT NULL,
  company_tier TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (recommendation_run_id, position_id),
  UNIQUE KEY uq_position_recommendation_rank (recommendation_run_id, rank_number),
  CONSTRAINT fk_position_recommendation_items_run
    FOREIGN KEY (recommendation_run_id) REFERENCES position_recommendation_runs(recommendation_run_id) ON DELETE CASCADE,
  CONSTRAINT fk_position_recommendation_items_position
    FOREIGN KEY (position_id) REFERENCES positions(position_id) ON DELETE RESTRICT,
  CONSTRAINT fk_position_recommendation_items_analysis
    FOREIGN KEY (analysis_id) REFERENCES position_analyses(analysis_id) ON DELETE RESTRICT,
  CONSTRAINT chk_position_recommendation_tier CHECK (company_tier BETWEEN 1 AND 3)
) ENGINE=InnoDB;

CREATE TABLE request_receipts (
  idempotency_key VARCHAR(200) PRIMARY KEY,
  request_hash CHAR(71) NOT NULL,
  state ENUM('processing', 'completed') NOT NULL,
  response_status SMALLINT UNSIGNED NULL,
  response_body JSON NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS company_tier_assessment_runs (
  company_tier_run_id CHAR(36) PRIMARY KEY,
  collection_run_id VARCHAR(191) NOT NULL UNIQUE,
  candidate_context_version VARCHAR(191) NOT NULL,
  contract_version INT UNSIGNED NOT NULL,
  status ENUM('pending', 'partial', 'completed') NOT NULL,
  assessed_now_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  CONSTRAINT fk_company_tier_runs_collection
    FOREIGN KEY (collection_run_id) REFERENCES position_collection_runs(run_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS company_tier_assessments (
  company_tier_assessment_id CHAR(36) PRIMARY KEY,
  company_key VARCHAR(191) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  candidate_context_version VARCHAR(191) NOT NULL,
  contract_version INT UNSIGNED NOT NULL,
  created_by_company_tier_run_id CHAR(36) NULL,
  recommended_tier TINYINT UNSIGNED NOT NULL,
  confidence ENUM('low', 'medium', 'high') NOT NULL,
  reason TEXT NOT NULL,
  signals_json JSON NOT NULL,
  evidence_json JSON NOT NULL,
  assumptions_json JSON NOT NULL,
  assessed_at DATETIME(3) NOT NULL,
  valid_until DATE NOT NULL,
  KEY idx_company_tier_assessment_lookup
    (company_key, candidate_context_version, contract_version, valid_until, assessed_at),
  CONSTRAINT fk_company_tier_assessments_created_run
    FOREIGN KEY (created_by_company_tier_run_id)
    REFERENCES company_tier_assessment_runs(company_tier_run_id) ON DELETE RESTRICT,
  CONSTRAINT chk_company_tier_assessment_tier CHECK (recommended_tier BETWEEN 1 AND 3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS company_tier_assessment_run_items (
  company_tier_run_id CHAR(36) NOT NULL,
  company_key VARCHAR(191) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  selection_order SMALLINT UNSIGNED NOT NULL,
  assessment_status ENUM('new', 'stale') NOT NULL,
  selection_reason ENUM('discovery', 'refresh') NOT NULL,
  prior_tier TINYINT UNSIGNED NULL,
  active_position_count INT UNSIGNED NOT NULL DEFAULT 0,
  result_status ENUM('pending', 'created', 'reused', 'failed') NOT NULL DEFAULT 'pending',
  company_tier_assessment_id CHAR(36) NULL,
  failure_code ENUM('research_unavailable', 'model_unavailable', 'contract_rejected',
    'internal_error', 'lease_expired') NULL,
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  completed_at DATETIME(3) NULL,
  PRIMARY KEY (company_tier_run_id, company_key),
  UNIQUE KEY uq_company_tier_item_order (company_tier_run_id, selection_order),
  KEY idx_company_tier_items_assessment (company_tier_assessment_id),
  CONSTRAINT fk_company_tier_items_run
    FOREIGN KEY (company_tier_run_id)
    REFERENCES company_tier_assessment_runs(company_tier_run_id) ON DELETE CASCADE,
  CONSTRAINT fk_company_tier_items_assessment
    FOREIGN KEY (company_tier_assessment_id)
    REFERENCES company_tier_assessments(company_tier_assessment_id) ON DELETE RESTRICT,
  CONSTRAINT chk_company_tier_item_selection CHECK (
    (assessment_status = 'new' AND selection_reason = 'discovery' AND prior_tier IS NULL)
    OR (assessment_status = 'stale' AND selection_reason = 'refresh'
      AND prior_tier BETWEEN 1 AND 3)
  ),
  CONSTRAINT chk_company_tier_item_result CHECK (
    (result_status = 'pending'
      AND company_tier_assessment_id IS NULL AND completed_at IS NULL AND failure_code IS NULL)
    OR (result_status IN ('created', 'reused')
      AND company_tier_assessment_id IS NOT NULL AND completed_at IS NOT NULL
      AND failure_code IS NULL)
    OR (result_status = 'failed'
      AND company_tier_assessment_id IS NULL AND completed_at IS NOT NULL
      AND failure_code IS NOT NULL)
  )
) ENGINE=InnoDB;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_analysis_policy ADD COLUMN daily_company_tier_limit TINYINT UNSIGNED NULL")
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_analysis_policy'
    AND COLUMN_NAME = 'daily_company_tier_limit'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_analysis_policy ADD COLUMN company_tier_stale_after_days SMALLINT UNSIGNED NULL")
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_analysis_policy'
    AND COLUMN_NAME = 'company_tier_stale_after_days'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE position_analysis_policy SET daily_company_tier_limit = 5
WHERE daily_company_tier_limit IS NULL;

UPDATE position_analysis_policy SET company_tier_stale_after_days = 90
WHERE company_tier_stale_after_days IS NULL;

ALTER TABLE position_analysis_policy
  MODIFY COLUMN daily_company_tier_limit TINYINT UNSIGNED NOT NULL;

ALTER TABLE position_analysis_policy
  MODIFY COLUMN company_tier_stale_after_days SMALLINT UNSIGNED NOT NULL;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_analysis_policy ADD CONSTRAINT chk_position_policy_company_tier_limit CHECK (daily_company_tier_limit BETWEEN 1 AND 20)")
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_analysis_policy'
    AND CONSTRAINT_NAME = 'chk_position_policy_company_tier_limit'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_analysis_policy ADD CONSTRAINT chk_position_policy_company_tier_stale CHECK (company_tier_stale_after_days BETWEEN 1 AND 365)")
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_analysis_policy'
    AND CONSTRAINT_NAME = 'chk_position_policy_company_tier_stale'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_analysis_run_items ADD COLUMN company_tier_source ENUM('manual', 'model', 'default') NULL")
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_analysis_run_items'
    AND COLUMN_NAME = 'company_tier_source'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_analysis_run_items ADD COLUMN company_tier_assessment_id CHAR(36) NULL")
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_analysis_run_items'
    AND COLUMN_NAME = 'company_tier_assessment_id'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_recommendation_items ADD COLUMN company_tier_source ENUM('manual', 'model', 'default') NULL")
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_recommendation_items'
    AND COLUMN_NAME = 'company_tier_source'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_recommendation_items ADD COLUMN company_tier_assessment_id CHAR(36) NULL")
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_recommendation_items'
    AND COLUMN_NAME = 'company_tier_assessment_id'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE position_analysis_run_items SET company_tier_source = 'default'
WHERE company_tier_source IS NULL;

UPDATE position_recommendation_items SET company_tier_source = 'default'
WHERE company_tier_source IS NULL;

ALTER TABLE position_analysis_run_items
  MODIFY COLUMN company_tier_source ENUM('manual', 'model', 'default') NOT NULL;

ALTER TABLE position_recommendation_items
  MODIFY COLUMN company_tier_source ENUM('manual', 'model', 'default') NOT NULL;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_analysis_run_items ADD CONSTRAINT chk_position_analysis_item_tier_source CHECK ((company_tier_source = 'model' AND company_tier_assessment_id IS NOT NULL) OR (company_tier_source <> 'model' AND company_tier_assessment_id IS NULL))")
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_analysis_run_items'
    AND CONSTRAINT_NAME = 'chk_position_analysis_item_tier_source'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    "SELECT 1",
    "ALTER TABLE position_recommendation_items ADD CONSTRAINT chk_position_recommendation_item_tier_source CHECK ((company_tier_source = 'model' AND company_tier_assessment_id IS NOT NULL) OR (company_tier_source <> 'model' AND company_tier_assessment_id IS NULL))")
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_recommendation_items'
    AND CONSTRAINT_NAME = 'chk_position_recommendation_item_tier_source'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
