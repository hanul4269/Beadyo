-- Prepared only. Execute against the intended project only after explicit approval.
-- Prerequisite: public.is_beadyo_editor() already exists and authorizes site editors.
-- Creates two NEW tables only. No existing function, table, row, policy or storage bucket is changed.
-- Photos reuse the existing public 'content-images' bucket (path prefix participation/), whose
-- editor-only upload policies already exist, so no storage policy is added here.

begin;

-- ─────────────────────────────────────────────
-- 1. 참가 콘텐츠 (구슬요가 외부 콘텐츠에 참가한 이력)
-- ─────────────────────────────────────────────
create table public.participation_entries (
    id uuid primary key default gen_random_uuid(),
    title text not null,                              -- 콘텐츠명
    category text not null,                           -- 분류 (아래 5개 중 하나)
    tags text[] not null default '{}'::text[],        -- 보조 분류 (예: 왁타버스 + VR 둘 다 해당할 때)
    host text,                                        -- 주최
    year smallint not null,                           -- 참가 연도
    month smallint,                                   -- 참가 월 (모르면 비움)
    event_date date,                                  -- 정확한 날짜를 알 때만
    team text,                                        -- 팀 이름
    role text,                                        -- 설정한 역할(RP)
    nickname text,                                    -- 콘텐츠 안 닉네임
    result text,                                      -- 성적·특이사항 (여러 줄 가능)
    application_url text,                             -- 신청글
    result_links jsonb not null default '[]'::jsonb,  -- 결과 시트·출전명단 등 [{label, url}]
    replay_url text,                                  -- 다시보기
    image_url text,                                   -- 대표 사진
    notes text,                                       -- 메모
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint participation_title_check check (char_length(btrim(title)) between 1 and 200),
    constraint participation_category_check check (
        category in ('왁타버스', 'VR', '마인크래프트', '기타 게임', 'SOOP 콘텐츠')
    ),
    constraint participation_tags_check check (cardinality(tags) <= 12),
    constraint participation_when_check check (
        year between 2015 and 2100
        and (month is null or month between 1 and 12)
    ),
    constraint participation_result_links_check check (
        jsonb_typeof(result_links) = 'array' and jsonb_array_length(result_links) <= 10
    ),
    constraint participation_text_len_check check (
        coalesce(char_length(host), 0) <= 120
        and coalesce(char_length(team), 0) <= 120
        and coalesce(char_length(role), 0) <= 200
        and coalesce(char_length(nickname), 0) <= 120
        and coalesce(char_length(result), 0) <= 2000
        and coalesce(char_length(notes), 0) <= 2000
    ),
    constraint participation_urls_check check (
        (replay_url is null or replay_url ~* '^https?://[^[:space:]]+$')
        and (application_url is null or application_url ~* '^https?://[^[:space:]]+$')
        and (image_url is null or image_url ~* '^https?://[^[:space:]]+$')
    )
);

create index participation_entries_when_idx
    on public.participation_entries (year desc, month desc nulls last);

-- ─────────────────────────────────────────────
-- 2. 같이 본 작품 (영화·애니메이션)
-- ─────────────────────────────────────────────
create table public.watchlist_entries (
    id uuid primary key default gen_random_uuid(),
    title text not null,                              -- 작품 제목
    kind text not null,                               -- 영화 | 애니메이션 | 기타
    watched_date date,                                -- 본 날짜 (방송일)
    episodes text,                                    -- 애니 회차 범위 등 (예: 1~12화)
    replay_url text,                                  -- 다시보기
    notes text,                                       -- 한 줄 메모
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint watchlist_title_check check (char_length(btrim(title)) between 1 and 200),
    constraint watchlist_kind_check check (kind in ('영화', '애니메이션', '기타')),
    constraint watchlist_text_len_check check (
        coalesce(char_length(episodes), 0) <= 60
        and coalesce(char_length(notes), 0) <= 1000
    ),
    constraint watchlist_url_check check (replay_url is null or replay_url ~* '^https?://[^[:space:]]+$')
);

create index watchlist_entries_watched_date_idx
    on public.watchlist_entries (watched_date desc nulls last);

-- ─────────────────────────────────────────────
-- 3. updated_at 자동 갱신 (새 함수, 기존 함수 변경 없음)
-- ─────────────────────────────────────────────
create function public.touch_beadyo_record_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger participation_entries_touch_updated_at
    before update on public.participation_entries
    for each row execute function public.touch_beadyo_record_updated_at();

create trigger watchlist_entries_touch_updated_at
    before update on public.watchlist_entries
    for each row execute function public.touch_beadyo_record_updated_at();

-- ─────────────────────────────────────────────
-- 4. 권한: 누구나 읽기, 편집자만 추가·수정·삭제
-- ─────────────────────────────────────────────
alter table public.participation_entries enable row level security;
alter table public.watchlist_entries enable row level security;

revoke all on table public.participation_entries from public, anon, authenticated;
revoke all on table public.watchlist_entries from public, anon, authenticated;
grant select on table public.participation_entries, public.watchlist_entries to anon, authenticated;
grant insert, update, delete on table public.participation_entries, public.watchlist_entries to authenticated;

create policy "participation public read" on public.participation_entries
    for select to anon, authenticated using (true);
create policy "participation editor insert" on public.participation_entries
    for insert to authenticated with check ((select public.is_beadyo_editor()));
create policy "participation editor update" on public.participation_entries
    for update to authenticated
    using ((select public.is_beadyo_editor()))
    with check ((select public.is_beadyo_editor()));
create policy "participation editor delete" on public.participation_entries
    for delete to authenticated using ((select public.is_beadyo_editor()));

create policy "watchlist public read" on public.watchlist_entries
    for select to anon, authenticated using (true);
create policy "watchlist editor insert" on public.watchlist_entries
    for insert to authenticated with check ((select public.is_beadyo_editor()));
create policy "watchlist editor update" on public.watchlist_entries
    for update to authenticated
    using ((select public.is_beadyo_editor()))
    with check ((select public.is_beadyo_editor()));
create policy "watchlist editor delete" on public.watchlist_entries
    for delete to authenticated using ((select public.is_beadyo_editor()));

commit;
