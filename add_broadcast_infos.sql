CREATE TABLE IF NOT EXISTS broadcast_infos (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date       DATE NOT NULL UNIQUE,
    start_time TIME,
    end_time   TIME,
    vod_urls   TEXT,
    vod_titles TEXT,
    memo       TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE broadcast_infos
ADD COLUMN IF NOT EXISTS vod_titles TEXT;

CREATE OR REPLACE FUNCTION public.is_beadyo_editor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'riosniper12@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.editors e
      WHERE lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

ALTER TABLE broadcast_infos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_broadcast_infos" ON broadcast_infos;
DROP POLICY IF EXISTS "write_broadcast_infos" ON broadcast_infos;
DROP POLICY IF EXISTS "editor_write_broadcast_infos" ON broadcast_infos;

CREATE POLICY "read_broadcast_infos"
ON broadcast_infos
FOR SELECT
USING (true);

CREATE POLICY "editor_write_broadcast_infos"
ON broadcast_infos
FOR ALL
TO authenticated
USING (public.is_beadyo_editor())
WITH CHECK (public.is_beadyo_editor());

ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS sort_order INTEGER;
