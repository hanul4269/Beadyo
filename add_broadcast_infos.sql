CREATE TABLE IF NOT EXISTS broadcast_infos (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date       DATE NOT NULL UNIQUE,
    start_time TIME,
    end_time   TIME,
    vod_urls   TEXT,
    memo       TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE broadcast_infos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_broadcast_infos" ON broadcast_infos;
DROP POLICY IF EXISTS "write_broadcast_infos" ON broadcast_infos;

CREATE POLICY "read_broadcast_infos"
ON broadcast_infos
FOR SELECT
USING (true);

CREATE POLICY "write_broadcast_infos"
ON broadcast_infos
FOR ALL
USING (true)
WITH CHECK (true);
