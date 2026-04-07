-- Session 21: 曜日別タスク機能

-- 曜日別タスク定義テーブル
CREATE TABLE IF NOT EXISTS weekly_tasks (
  id serial PRIMARY KEY,
  day_of_week integer NOT NULL,          -- 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  title text NOT NULL,
  scope text NOT NULL DEFAULT 'all',     -- 'all', 'building:1', 'building:2', 'store:1' 等
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- 曜日別タスク完了記録テーブル（日付ごとに完了を追跡）
CREATE TABLE IF NOT EXISTS weekly_task_completions (
  id serial PRIMARY KEY,
  weekly_task_id integer NOT NULL REFERENCES weekly_tasks(id) ON DELETE CASCADE,
  date date NOT NULL,
  completed_by text DEFAULT '',
  completed_at timestamp DEFAULT now(),
  UNIQUE(weekly_task_id, date)
);

-- RLS（Row Level Security）
ALTER TABLE weekly_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_tasks_all" ON weekly_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "weekly_task_completions_all" ON weekly_task_completions FOR ALL USING (true) WITH CHECK (true);

-- Realtime有効化
ALTER PUBLICATION supabase_realtime ADD TABLE weekly_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE weekly_task_completions;
