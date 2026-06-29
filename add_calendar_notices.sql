-- =====================================================
-- 캘린더 공지사항 팝업 테이블
-- Supabase Dashboard -> SQL Editor에서 실행하세요
-- =====================================================

create table if not exists calendar_notices (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique,
  title      text not null default '공지사항',
  image_url  text not null,
  link_url   text,
  link_label text not null default '공지 보러가기',
  button_bg_color text not null default '#d9a53a',
  button_text_color text not null default '#6f280b',
  header_bg_color text not null default '#190a07',
  header_text_color text not null default '#fff3cf',
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

alter table calendar_notices add column if not exists button_bg_color text not null default '#d9a53a';
alter table calendar_notices add column if not exists button_text_color text not null default '#6f280b';
alter table calendar_notices add column if not exists header_bg_color text not null default '#190a07';
alter table calendar_notices add column if not exists header_text_color text not null default '#fff3cf';

create or replace function public.is_beadyo_editor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'riosniper12@gmail.com'
    or exists (
      select 1
      from public.editors e
      where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

alter table calendar_notices enable row level security;

drop policy if exists "calendar_notices public read" on calendar_notices;
drop policy if exists "calendar_notices authenticated insert" on calendar_notices;
drop policy if exists "calendar_notices authenticated update" on calendar_notices;
drop policy if exists "calendar_notices authenticated delete" on calendar_notices;
drop policy if exists "calendar_notices editor insert" on calendar_notices;
drop policy if exists "calendar_notices editor update" on calendar_notices;
drop policy if exists "calendar_notices editor delete" on calendar_notices;

create policy "calendar_notices public read" on calendar_notices
  for select using (true);

create policy "calendar_notices editor insert" on calendar_notices
  for insert to authenticated with check (public.is_beadyo_editor());

create policy "calendar_notices editor update" on calendar_notices
  for update to authenticated using (public.is_beadyo_editor()) with check (public.is_beadyo_editor());

create policy "calendar_notices editor delete" on calendar_notices
  for delete to authenticated using (public.is_beadyo_editor());

insert into calendar_notices (
  slug,
  title,
  image_url,
  link_url,
  link_label,
  button_bg_color,
  button_text_color,
  header_bg_color,
  header_text_color,
  is_active,
  sort_order
) values (
  'bosikham-season2-20260627',
  '공지사항',
  'notice-bosikham-season2-20260627.png',
  'https://www.sooplive.com/station/beadyo97/post/199734125',
  '공지 보러가기',
  '#d9a53a',
  '#6f280b',
  '#190a07',
  '#fff3cf',
  true,
  0
)
on conflict (slug) do update set
  title = excluded.title,
  image_url = excluded.image_url,
  link_url = excluded.link_url,
  link_label = excluded.link_label,
  button_bg_color = excluded.button_bg_color,
  button_text_color = excluded.button_text_color,
  header_bg_color = excluded.header_bg_color,
  header_text_color = excluded.header_text_color,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
