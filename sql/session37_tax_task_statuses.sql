-- セッション37: 税理士ポータル Phase 2C 年間税務スケジュール
-- タスクの完了状況を期(年度)別に管理

CREATE TABLE IF NOT EXISTS tax_task_statuses (
  id bigserial PRIMARY KEY,
  task_id text NOT NULL,          -- 固定のタスクID (コード側で定義)
  fiscal_year int NOT NULL,       -- 期(年度) 例: 2026 = 第3期
  status text DEFAULT 'pending',  -- pending / in_progress / done
  note text DEFAULT '',
  updated_by_name text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(task_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_tax_task_statuses_fiscal_year ON tax_task_statuses(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_tax_task_statuses_task_id ON tax_task_statuses(task_id);

-- RLS無効化 (T-MANAGEの他テーブルと統一)
ALTER TABLE tax_task_statuses DISABLE ROW LEVEL SECURITY;
