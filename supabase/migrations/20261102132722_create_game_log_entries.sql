-- Prepared only. Execute against the intended project only after explicit approval.
-- Prerequisite: public.is_beadyo_editor() already exists and authorizes site editors.
-- No existing function, table, row, UPDATE policy, or DELETE policy is changed.

begin;

create table public.game_log_entries (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    genres text[] not null default '{}'::text[],
    played_date date,
    official_url text,
    source_url text,
    notes text,
    created_at timestamptz not null default now(),

    constraint game_log_entries_title_check check (
        char_length(title) between 1 and 160
        and title = btrim(title)
        and title !~ '(^[[:space:]])|([[:space:]]$)'
    ),
    constraint game_log_entries_genres_check check (
        cardinality(genres) <= 16
        and case when coalesce(array_ndims(genres), 1) = 1 then
            array_position(genres, null) is null
            and genres <@ array[
            'action', 'adventure', 'rpg', 'strategy', 'simulation',
            'horror', 'puzzle', 'shooter', 'sports', 'racing', 'rhythm',
            'board-card', 'party-social', 'platformer', 'survival', 'quiz'
            ]::text[]
        else false end
    ),
    constraint game_log_entries_official_url_check check (
        official_url is null or (
            char_length(official_url) between 1 and 2048
            and official_url = btrim(official_url)
            and official_url ~* '^https?://[^[:space:]]+$'
        )
    ),
    constraint game_log_entries_source_url_check check (
        source_url is null or (
            char_length(source_url) between 1 and 2048
            and source_url = btrim(source_url)
            and source_url ~* '^https?://[^[:space:]]+$'
        )
    ),
    constraint game_log_entries_notes_check check (
        notes is null or char_length(notes) <= 2000
    )
);

-- Prevent duplicate additions to this table, ignoring case and surrounding spaces.
-- The application separately checks the existing static game catalog.
create unique index game_log_entries_title_key
    on public.game_log_entries (lower(btrim(title)));

alter table public.game_log_entries enable row level security;

-- Override any broad default privileges on this newly created table only.
revoke all on table public.game_log_entries from public, anon, authenticated;
grant select on table public.game_log_entries to anon, authenticated;
grant insert on table public.game_log_entries to authenticated;

create policy "game_log_entries public read"
    on public.game_log_entries
    for select
    to anon, authenticated
    using (true);

create policy "game_log_entries editor insert"
    on public.game_log_entries
    for insert
    to authenticated
    with check ((select public.is_beadyo_editor()));

commit;
