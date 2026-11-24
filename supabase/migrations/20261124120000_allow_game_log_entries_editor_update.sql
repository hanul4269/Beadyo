-- Allow site editors to edit games they added on the game log page.
-- Only the editable columns are granted; id and created_at stay fixed.
-- No DELETE permission is added.

begin;

grant update (title, genres, played_date, official_url, source_url, notes)
    on table public.game_log_entries to authenticated;

create policy "game_log_entries editor update"
    on public.game_log_entries
    for update
    to authenticated
    using ((select public.is_beadyo_editor()))
    with check ((select public.is_beadyo_editor()));

commit;
