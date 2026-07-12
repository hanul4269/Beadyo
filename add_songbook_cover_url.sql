-- 노래책 커버 이미지 URL 컬럼 추가
alter table public.songbook
  add column if not exists cover_url text;
