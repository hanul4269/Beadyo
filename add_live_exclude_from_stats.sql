alter table live_songs
add column if not exists exclude_from_stats boolean default false;
