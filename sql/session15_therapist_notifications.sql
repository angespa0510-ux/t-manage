-- セラピストお知らせ
CREATE TABLE IF NOT EXISTS therapist_notifications (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  target_therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE therapist_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON therapist_notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_select" ON therapist_notifications
  FOR SELECT TO anon USING (true);
