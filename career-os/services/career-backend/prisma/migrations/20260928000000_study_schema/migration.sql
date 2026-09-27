CREATE TABLE study_sources (
  source_key VARCHAR(100) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  adapter ENUM('feed', 'page', 'youtube') NOT NULL,
  url VARCHAR(2048) NULL,
  feed_url VARCHAR(2048) NULL,
  enabled BOOLEAN NOT NULL,
  note VARCHAR(500) NULL,
  version INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_study_sources_url_required CHECK (url IS NOT NULL OR feed_url IS NOT NULL),
  CONSTRAINT chk_study_sources_url_https CHECK (url IS NULL OR url LIKE 'https://%'),
  CONSTRAINT chk_study_sources_feed_url_https CHECK (feed_url IS NULL OR feed_url LIKE 'https://%')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_source_cursors (
  source_key VARCHAR(100) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  cursor_json JSON NULL,
  version INT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (source_key, mode),
  CONSTRAINT fk_study_source_cursors_source FOREIGN KEY (source_key)
    REFERENCES study_sources(source_key) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_study_source_cursors_mode CHECK (mode IN ('recent', 'archive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_materials (
  content_key VARCHAR(191) PRIMARY KEY,
  canonical_url VARCHAR(2048) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  title VARCHAR(500) NOT NULL,
  published VARCHAR(100) NOT NULL,
  published_at DATETIME(3) NULL,
  excerpt TEXT NULL,
  kind ENUM('feed-article', 'feed-video', 'page-link', 'page-video') NOT NULL,
  first_collected_at DATETIME(3) NOT NULL,
  last_collected_at DATETIME(3) NOT NULL,
  KEY idx_study_materials_published (published_at, content_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_material_sources (
  content_key VARCHAR(191) NOT NULL,
  source_key VARCHAR(100) NOT NULL,
  first_collected_at DATETIME(3) NOT NULL,
  PRIMARY KEY (content_key, source_key),
  KEY idx_study_material_sources_source (source_key, first_collected_at, content_key),
  CONSTRAINT fk_study_material_sources_material FOREIGN KEY (content_key)
    REFERENCES study_materials(content_key) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_study_material_sources_source FOREIGN KEY (source_key)
    REFERENCES study_sources(source_key) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_recommendation_control (
  singleton_id TINYINT UNSIGNED PRIMARY KEY,
  candidate_context_version VARCHAR(191) NOT NULL,
  history_version INT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_study_recommendation_control_singleton CHECK (singleton_id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_recommendation_runs (
  report_id VARCHAR(40) PRIMARY KEY,
  generated_at DATETIME(3) NOT NULL,
  candidate_context_version VARCHAR(191) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_study_recommendation_runs_generated (generated_at, report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_recommendation_topics (
  report_id VARCHAR(40) NOT NULL,
  topic_key VARCHAR(191) NOT NULL,
  title VARCHAR(500) NOT NULL,
  career_question VARCHAR(300) NULL,
  position SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (report_id, topic_key),
  UNIQUE KEY uq_study_recommendation_topics_position (report_id, position),
  CONSTRAINT fk_study_recommendation_topics_run FOREIGN KEY (report_id)
    REFERENCES study_recommendation_runs(report_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_recommended_materials (
  report_id VARCHAR(40) NOT NULL,
  content_key VARCHAR(191) NOT NULL,
  topic_key VARCHAR(191) NOT NULL,
  summary VARCHAR(300) NULL,
  reason VARCHAR(300) NULL,
  career_value VARCHAR(40) NULL,
  position SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (report_id, content_key),
  UNIQUE KEY uq_study_recommended_materials_content (content_key),
  UNIQUE KEY uq_study_recommended_materials_topic_position (report_id, topic_key, position),
  CONSTRAINT fk_study_recommended_materials_run FOREIGN KEY (report_id)
    REFERENCES study_recommendation_runs(report_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_study_recommended_materials_material FOREIGN KEY (content_key)
    REFERENCES study_materials(content_key) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_study_recommended_materials_topic FOREIGN KEY (report_id, topic_key)
    REFERENCES study_recommendation_topics(report_id, topic_key) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_study_recommended_materials_career_value CHECK (
    career_value IS NULL OR career_value IN ('current-work', 'target-role', 'engineering-judgment', 'product-business')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_material_verdicts (
  content_key VARCHAR(191) NOT NULL,
  candidate_context_version VARCHAR(191) NOT NULL,
  verdict ENUM('rejected') NOT NULL,
  reason VARCHAR(300) NOT NULL,
  report_id VARCHAR(40) NOT NULL,
  judged_at DATETIME(3) NOT NULL,
  valid_until DATE NOT NULL,
  PRIMARY KEY (content_key, candidate_context_version),
  KEY idx_study_material_verdicts_context (candidate_context_version, valid_until),
  KEY idx_study_material_verdicts_report (report_id),
  CONSTRAINT fk_study_material_verdicts_material FOREIGN KEY (content_key)
    REFERENCES study_materials(content_key) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_study_material_verdicts_run FOREIGN KEY (report_id)
    REFERENCES study_recommendation_runs(report_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_publications (
  publication_id CHAR(36) PRIMARY KEY,
  report_id VARCHAR(40) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  url VARCHAR(2048) NULL,
  external_id VARCHAR(255) NOT NULL,
  published_at DATETIME(3) NOT NULL,
  KEY idx_study_publications_report (report_id),
  CONSTRAINT fk_study_publications_run FOREIGN KEY (report_id)
    REFERENCES study_recommendation_runs(report_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO study_recommendation_control
  (singleton_id, candidate_context_version, history_version, updated_at)
VALUES (1, 'initial', 0, CURRENT_TIMESTAMP(3));
