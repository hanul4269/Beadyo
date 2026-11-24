-- Allow site editors to delete games they added on the game log page.
-- Only rows in game_log_entries (games added on the site) are affected.

begin;

grant delete on table public.game_log_entries to authenticated;

create policy "game_log_entries editor delete"
    on public.game_log_entries
    for delete
    to authenticated
    using ((select public.is_beadyo_editor()));

commit;
