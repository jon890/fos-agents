/**
 * 커리어 데이터 파일의 스키마 단계다. 실행기가 열 때 `user_version` 보다 큰 단계만 적용한다.
 * 이미 적용된 단계는 고치지 않고 새 단계를 뒤에 더한다.
 *
 * 테이블과 열 이름은 커리어 Backend 의 MySQL 스키마와 같다. 시각은 UTC ISO 문자열,
 * 날짜는 `YYYY-MM-DD` 문자열, JSON 은 문자열, 참·거짓은 1 과 0 으로 저장한다.
 */
const STEP_1 = `
CREATE TABLE request_receipts (
  idempotency_key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE position_analysis_policy (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  daily_analysis_limit INTEGER NOT NULL,
  priority_slots INTEGER NOT NULL,
  aging_slots INTEGER NOT NULL,
  stale_after_days INTEGER NOT NULL,
  default_company_tier INTEGER NOT NULL,
  daily_company_tier_limit INTEGER NOT NULL,
  company_tier_stale_after_days INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE company_preferences (
  company_key TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  tier INTEGER,
  disposition TEXT NOT NULL,
  tech_blog_feed_url TEXT,
  github_org TEXT,
  dart_corp_code TEXT,
  blind_company_slug TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE position_exclusions (
  position_exclusion_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  company_key TEXT,
  source_key TEXT,
  identity_hash TEXT,
  normalized_url TEXT,
  title_keywords_json TEXT,
  decision_kind TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_urls_json TEXT NOT NULL,
  confidence TEXT,
  decided_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE company_evidence (
  company_evidence_id TEXT PRIMARY KEY,
  company_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  UNIQUE (company_key, source_type, url)
);
CREATE INDEX idx_company_evidence_valid ON company_evidence (company_key, valid_until);

CREATE TABLE position_sources (
  source_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL
);

CREATE TABLE positions (
  position_id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL,
  identity_hash TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  company_key TEXT NOT NULL,
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  pending_since TEXT,
  UNIQUE (source_key, identity_hash)
);
CREATE INDEX idx_positions_company ON positions (company_key, lifecycle);

CREATE TABLE position_versions (
  position_version_id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  UNIQUE (position_id, content_hash)
);

CREATE TABLE position_collection_runs (
  run_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  collected_at TEXT NOT NULL,
  status TEXT NOT NULL,
  active_count INTEGER NOT NULL,
  personal_excluded_count INTEGER NOT NULL
);

CREATE TABLE position_collection_items (
  run_id TEXT NOT NULL,
  position_id TEXT NOT NULL,
  position_version_id TEXT NOT NULL,
  posting_status TEXT NOT NULL,
  close_urgency TEXT NOT NULL,
  PRIMARY KEY (run_id, position_id)
);
CREATE INDEX idx_position_collection_items_position ON position_collection_items (position_id);
CREATE INDEX idx_position_collection_items_version ON position_collection_items (position_version_id);

CREATE TABLE position_source_run_diagnostics (
  run_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  status TEXT NOT NULL,
  collected_count INTEGER NOT NULL,
  imported_count INTEGER NOT NULL,
  skipped_count INTEGER NOT NULL,
  failed_count INTEGER NOT NULL,
  public_message TEXT NOT NULL,
  PRIMARY KEY (run_id, source_key)
);

CREATE TABLE company_tier_assessment_runs (
  company_tier_run_id TEXT PRIMARY KEY,
  collection_run_id TEXT NOT NULL UNIQUE,
  candidate_context_version TEXT NOT NULL,
  contract_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  assessed_now_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE company_tier_assessment_run_items (
  company_tier_run_id TEXT NOT NULL,
  company_key TEXT NOT NULL,
  company_name TEXT NOT NULL,
  selection_order INTEGER NOT NULL,
  assessment_status TEXT NOT NULL,
  selection_reason TEXT NOT NULL,
  prior_tier INTEGER,
  active_position_count INTEGER NOT NULL,
  result_status TEXT NOT NULL,
  company_tier_assessment_id TEXT,
  failure_code TEXT,
  attempt_count INTEGER NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (company_tier_run_id, company_key),
  UNIQUE (company_tier_run_id, selection_order)
);
CREATE INDEX idx_company_tier_items_company ON company_tier_assessment_run_items (company_key, result_status);

CREATE TABLE company_tier_assessments (
  company_tier_assessment_id TEXT PRIMARY KEY,
  company_key TEXT NOT NULL,
  company_name TEXT NOT NULL,
  candidate_context_version TEXT NOT NULL,
  contract_version INTEGER NOT NULL,
  created_by_company_tier_run_id TEXT,
  recommended_tier INTEGER,
  confidence TEXT,
  reason TEXT NOT NULL,
  assessment TEXT,
  signals_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  assumptions_json TEXT NOT NULL,
  assessed_at TEXT NOT NULL,
  valid_until TEXT NOT NULL
);
CREATE INDEX idx_company_tier_assessment_lookup
  ON company_tier_assessments (company_key, candidate_context_version, contract_version, valid_until, assessed_at);

CREATE TABLE position_analysis_runs (
  analysis_run_id TEXT PRIMARY KEY,
  collection_run_id TEXT NOT NULL UNIQUE,
  candidate_context_version TEXT NOT NULL,
  contract_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  analyzed_now_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE position_analysis_run_items (
  analysis_run_id TEXT NOT NULL,
  position_id TEXT NOT NULL,
  position_version_id TEXT NOT NULL,
  selection_order INTEGER NOT NULL,
  analysis_status TEXT NOT NULL,
  selection_reason TEXT NOT NULL,
  company_tier INTEGER NOT NULL,
  company_tier_source TEXT NOT NULL,
  company_tier_assessment_id TEXT,
  result_status TEXT NOT NULL,
  analysis_id TEXT,
  failure_code TEXT,
  attempt_count INTEGER NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (analysis_run_id, position_id),
  UNIQUE (analysis_run_id, selection_order)
);

CREATE TABLE position_analyses (
  analysis_id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  position_version_id TEXT NOT NULL,
  candidate_context_version TEXT NOT NULL,
  contract_version INTEGER NOT NULL,
  created_by_analysis_run_id TEXT,
  analyzed_at TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  company_tier_at_analysis INTEGER NOT NULL,
  decision TEXT NOT NULL,
  fit_score INTEGER NOT NULL,
  role_fit INTEGER NOT NULL,
  scope_upside INTEGER NOT NULL,
  company_opportunity INTEGER NOT NULL,
  constraints_score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details_json TEXT NOT NULL,
  next_actions_json TEXT NOT NULL,
  UNIQUE (position_version_id, candidate_context_version, contract_version)
);
CREATE INDEX idx_position_analyses_position ON position_analyses (position_id);

CREATE TABLE position_recommendation_runs (
  recommendation_run_id TEXT PRIMARY KEY,
  analysis_run_id TEXT NOT NULL UNIQUE,
  collection_run_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  analyzed_now_count INTEGER NOT NULL,
  reused_count INTEGER NOT NULL,
  pending_count INTEGER NOT NULL,
  pending_candidates_json TEXT NOT NULL,
  personal_excluded_count INTEGER NOT NULL
);

CREATE TABLE position_recommendation_items (
  recommendation_run_id TEXT NOT NULL,
  position_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  rank_number INTEGER NOT NULL,
  decision TEXT NOT NULL,
  company_tier INTEGER NOT NULL,
  company_tier_source TEXT NOT NULL,
  company_tier_assessment_id TEXT,
  PRIMARY KEY (recommendation_run_id, position_id),
  UNIQUE (recommendation_run_id, rank_number)
);

CREATE TABLE study_sources (
  source_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  adapter TEXT NOT NULL,
  url TEXT,
  feed_url TEXT,
  enabled INTEGER NOT NULL,
  note TEXT,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE study_source_cursors (
  source_key TEXT NOT NULL,
  mode TEXT NOT NULL,
  cursor_json TEXT,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source_key, mode)
);

CREATE TABLE study_materials (
  content_key TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  published TEXT NOT NULL,
  published_at TEXT,
  excerpt TEXT,
  kind TEXT NOT NULL,
  first_collected_at TEXT NOT NULL,
  last_collected_at TEXT NOT NULL
);
CREATE INDEX idx_study_materials_published ON study_materials (published_at, content_key);

CREATE TABLE study_material_sources (
  content_key TEXT NOT NULL,
  source_key TEXT NOT NULL,
  first_collected_at TEXT NOT NULL,
  PRIMARY KEY (content_key, source_key)
);

CREATE TABLE study_recommendation_control (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  history_version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO study_recommendation_control (singleton_id, history_version, updated_at)
VALUES (1, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE study_recommendation_runs (
  report_id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  candidate_context_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_study_recommendation_runs_generated ON study_recommendation_runs (generated_at, report_id);

CREATE TABLE study_recommendation_topics (
  report_id TEXT NOT NULL,
  topic_key TEXT NOT NULL,
  title TEXT NOT NULL,
  career_question TEXT,
  position INTEGER NOT NULL,
  PRIMARY KEY (report_id, topic_key),
  UNIQUE (report_id, position)
);

CREATE TABLE study_recommended_materials (
  report_id TEXT NOT NULL,
  content_key TEXT NOT NULL UNIQUE,
  topic_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  reason TEXT NOT NULL,
  career_value TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (report_id, content_key),
  UNIQUE (report_id, topic_key, position)
);

CREATE TABLE study_material_verdicts (
  content_key TEXT NOT NULL,
  candidate_context_version TEXT NOT NULL,
  verdict TEXT NOT NULL,
  reason TEXT NOT NULL,
  report_id TEXT NOT NULL,
  judged_at TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  PRIMARY KEY (content_key, candidate_context_version)
);

CREATE TABLE study_publications (
  publication_id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  url TEXT,
  external_id TEXT,
  published_at TEXT NOT NULL
);
CREATE INDEX idx_study_publications_report ON study_publications (report_id);
`;

export const SCHEMA_STEPS: readonly string[] = [STEP_1];
