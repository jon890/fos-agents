-- 달마다 한 행으로 에이전트 사용량을 담는다. ADR-133 을 따른다.
-- 세션 기록이 기기에서 지워진 뒤에는 그 달을 다시 셀 수 없어, 한 번 적은 값은 서버가 바꾸지 않는다.
-- 사람이 사유를 남겨 바꾼 경우에만 값이 바뀌고 그 사유는 note 에 남는다. 이력 table 은 두지 않는다.
CREATE TABLE agent_usage_snapshots (
  month CHAR(7) PRIMARY KEY,
  claude_tokens BIGINT UNSIGNED NOT NULL,
  codex_tokens BIGINT UNSIGNED NOT NULL,
  claude_cost_usd DECIMAL(12,2) NULL,
  codex_cost_usd DECIMAL(12,2) NULL,
  sessions INT UNSIGNED NULL,
  unpriced_tokens BIGINT UNSIGNED NOT NULL,
  measured_on DATE NOT NULL,
  source VARCHAR(20) NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT chk_agent_usage_snapshot_month CHECK (month REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT chk_agent_usage_snapshot_source CHECK (source IN ('MEASURED', 'BACKFILLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
