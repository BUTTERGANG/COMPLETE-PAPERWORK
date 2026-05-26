-- Enable RLS on events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own events
CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own events" ON events
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (auth.uid()::text = user_id);

-- Note: bucket is kept public so getPublicUrl() works for <img> tags.
-- Access is still controlled by RLS policies below.
INSERT INTO storage.buckets (id, name, public) VALUES ('paperwork', 'paperwork', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own paperwork" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'paperwork' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own paperwork" ON storage.objects
  FOR SELECT USING (bucket_id = 'paperwork' AND (storage.foldername(name))[1] = auth.uid()::text);
