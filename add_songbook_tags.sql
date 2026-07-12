alter table public.songbook add column if not exists tags text[] default '{}';
