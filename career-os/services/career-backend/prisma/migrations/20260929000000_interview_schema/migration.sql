CREATE TABLE interview_topic_progress (
  drill_type ENUM('tech', 'behavioral') NOT NULL,
  topic VARCHAR(100) NOT NULL,
  pass_count INT UNSIGNED NOT NULL DEFAULT 0,
  fail_count INT UNSIGNED NOT NULL DEFAULT 0,
  next_review_date DATE NULL,
  last_passed_date DATE NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (drill_type, topic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE interview_attempts (
  attempt_id CHAR(36) NOT NULL,
  drill_type ENUM('tech', 'behavioral') NOT NULL,
  topic VARCHAR(100) NOT NULL,
  question_id VARCHAR(100) NOT NULL,
  question VARCHAR(2000) NOT NULL,
  score ENUM('pass', 'shallow', 'fail', 'unknown') NOT NULL,
  feedback VARCHAR(500) NULL,
  evaluated_on DATE NOT NULL,
  target_company VARCHAR(100) NULL,
  target_role VARCHAR(100) NULL,
  target_value_axis VARCHAR(100) NULL,
  root_question_id VARCHAR(100) NULL,
  parent_question VARCHAR(2000) NULL,
  follow_up_depth TINYINT UNSIGNED NULL,
  follow_up_axis ENUM('clarification', 'decision', 'counterexample', 'operations', 'evidence-boundary') NULL,
  stop_reason ENUM('depth-limit', 'needs-study', 'answer-complete', 'session-ended') NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (attempt_id),
  KEY idx_interview_attempts_topic (drill_type, topic, created_at),
  CONSTRAINT fk_interview_attempts_progress FOREIGN KEY (drill_type, topic)
    REFERENCES interview_topic_progress(drill_type, topic) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_interview_attempts_depth CHECK (follow_up_depth IS NULL OR follow_up_depth BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE interview_personal_questions (
  question_id VARCHAR(100) NOT NULL,
  drill_type ENUM('tech', 'behavioral') NOT NULL,
  topic VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (question_id),
  KEY idx_interview_personal_questions_type (drill_type, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
