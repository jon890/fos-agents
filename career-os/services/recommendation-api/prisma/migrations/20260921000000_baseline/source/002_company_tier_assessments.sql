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
