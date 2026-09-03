-- =====================================================
-- CONTENT 아카이브
-- Supabase Dashboard → SQL Editor에서 한 번 실행하세요.
-- =====================================================

create extension if not exists pgcrypto;

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

create table if not exists public.content_archive (
  id uuid primary key default gen_random_uuid(),
  broadcast_date date not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  summary text,
  description text,
  categories text[] not null default '{}',
  planning_type text,
  planners text[] not null default '{}',
  hosts text[] not null default '{}',
  cast_members text[] not null default '{}',
  tags text[] not null default '{}',
  thumbnail_url text,
  rules text[] not null default '{}',
  segments text[] not null default '{}',
  highlights text[] not null default '{}',
  related_contents text[] not null default '{}',
  notes text,
  sources text[] not null default '{}',
  replays jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_archive_replays_array check (jsonb_typeof(replays) = 'array')
);

create index if not exists idx_content_archive_broadcast_date
  on public.content_archive(broadcast_date desc);
create index if not exists idx_content_archive_categories
  on public.content_archive using gin(categories);
create index if not exists idx_content_archive_tags
  on public.content_archive using gin(tags);

create or replace function public.touch_content_archive_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_archive_touch_updated_at on public.content_archive;
create trigger content_archive_touch_updated_at
before update on public.content_archive
for each row execute function public.touch_content_archive_updated_at();

alter table public.content_archive enable row level security;

drop policy if exists "CONTENT 공개 읽기" on public.content_archive;
create policy "CONTENT 공개 읽기" on public.content_archive
  for select using (true);

drop policy if exists "CONTENT 편집자 삽입" on public.content_archive;
create policy "CONTENT 편집자 삽입" on public.content_archive
  for insert to authenticated with check (public.is_beadyo_editor());

drop policy if exists "CONTENT 편집자 수정" on public.content_archive;
create policy "CONTENT 편집자 수정" on public.content_archive
  for update to authenticated
  using (public.is_beadyo_editor())
  with check (public.is_beadyo_editor());

drop policy if exists "CONTENT 편집자 삭제" on public.content_archive;
create policy "CONTENT 편집자 삭제" on public.content_archive
  for delete to authenticated using (public.is_beadyo_editor());

grant select on table public.content_archive to anon, authenticated;
grant insert, update, delete on table public.content_archive to authenticated;

-- 포스터 파일은 공개 읽기, 기존 편집자만 업로드/수정 가능하게 합니다.
-- 콘텐츠 삭제 시 파일은 자동 삭제되지 않습니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-images',
  'content-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "CONTENT 이미지 공개 읽기" on storage.objects;
create policy "CONTENT 이미지 공개 읽기" on storage.objects
  for select using (bucket_id = 'content-images');

drop policy if exists "CONTENT 이미지 편집자 업로드" on storage.objects;
create policy "CONTENT 이미지 편집자 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'content-images' and public.is_beadyo_editor());

drop policy if exists "CONTENT 이미지 편집자 수정" on storage.objects;
create policy "CONTENT 이미지 편집자 수정" on storage.objects
  for update to authenticated
  using (bucket_id = 'content-images' and public.is_beadyo_editor())
  with check (bucket_id = 'content-images' and public.is_beadyo_editor());
