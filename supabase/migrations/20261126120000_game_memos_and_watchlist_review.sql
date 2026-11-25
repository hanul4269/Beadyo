-- 구슬요의 메모: 플레이한 게임 메모 표 + 같이보기 후기 칸 (2026-11-26, 사용자 승인)
-- 누구나 읽고, 편집자(is_beadyo_editor)만 쓰기·수정·삭제.
-- 기존 표·행·정책은 바꾸지 않습니다. 새 표 1개와 새 칸 1개만 추가합니다.
--
-- 되돌리기:
--   drop table public.game_log_memos;
--   alter table public.watchlist_entries drop constraint watchlist_review_len_check;
--   alter table public.watchlist_entries drop column review;

begin;

-- 1) 게임 메모 (game_id = data/game-log.json의 id 또는 'custom-<uuid>')
create table public.game_log_memos (
    game_id text primary key,
    memo text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint game_log_memos_game_id_check check (game_id ~ '^[a-z0-9][a-z0-9-]{0,159}$'),
    constraint game_log_memos_memo_check check (char_length(btrim(memo)) between 1 and 2000)
);

create trigger game_log_memos_touch_updated_at
    before update on public.game_log_memos
    for each row execute function public.touch_beadyo_record_updated_at();

alter table public.game_log_memos enable row level security;
revoke all on table public.game_log_memos from public, anon, authenticated;
grant select on table public.game_log_memos to anon, authenticated;
grant insert, update, delete on table public.game_log_memos to authenticated;

create policy "game_log_memos public read" on public.game_log_memos
    for select to anon, authenticated using (true);
create policy "game_log_memos editor insert" on public.game_log_memos
    for insert to authenticated with check ((select public.is_beadyo_editor()));
create policy "game_log_memos editor update" on public.game_log_memos
    for update to authenticated
    using ((select public.is_beadyo_editor()))
    with check ((select public.is_beadyo_editor()));
create policy "game_log_memos editor delete" on public.game_log_memos
    for delete to authenticated using ((select public.is_beadyo_editor()));

-- 2) 같이보기 후기 (기존 작품은 빈 칸으로 시작)
alter table public.watchlist_entries add column review text;
alter table public.watchlist_entries add constraint watchlist_review_len_check
    check (review is null or char_length(review) <= 2000);

commit;
