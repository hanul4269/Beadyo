-- ============================
-- 1. 노래책 테이블
-- ============================
create table if not exists songbook (
  id        serial primary key,
  category  text    not null,   -- KPOP | POP | JPOP | ETC | 애교송 | 오리지널
  tags      text[] default '{}',
  sort_order integer,
  title     text    not null,
  artist    text,
  cover_url text,
  mr_url    text,
  clip_url  text,
  skill_level integer default 0,  -- 0~5 (💚 개수)
  memo      text
);

alter table songbook enable row level security;
create policy "공개 읽기" on songbook for select using (true);

-- ============================
-- 2. 라이브 기록 테이블
-- ============================
create table if not exists live_songs (
  id             serial  primary key,
  year           smallint not null,   -- 2022~2026
  performed_date date,
  title          text    not null,
  artist         text,
  memo           text,
  clip_url       text,
  times_sung     integer,
  exclude_from_stats boolean default false
);

alter table live_songs enable row level security;
create policy "공개 읽기" on live_songs for select using (true);

-- 검색 성능을 위한 인덱스
create index if not exists idx_songbook_category on songbook(category);
create index if not exists idx_live_songs_year   on live_songs(year);
create index if not exists idx_live_songs_date   on live_songs(performed_date desc);
