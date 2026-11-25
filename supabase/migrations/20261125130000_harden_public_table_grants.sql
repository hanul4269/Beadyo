-- Defense in depth for the public schema.
--
-- Today every write is already blocked by RLS for the anon role, and only
-- editors pass the authenticated write policies. But Supabase's default
-- grants still give anon INSERT/UPDATE/DELETE and give both API roles
-- TRUNCATE/REFERENCES/TRIGGER on older tables. RLS does not apply to
-- TRUNCATE, so if any future function or misconfiguration let those roles run
-- SQL, they could wipe a table. This removes privileges the site never uses.
--
-- Not changed: anon SELECT (public pages read these tables) and authenticated
-- INSERT/UPDATE/DELETE (editor writes, still gated by RLS policies).

begin;

-- 1) No API role needs TRUNCATE, REFERENCES or TRIGGER on any public table.
revoke truncate, references, trigger
    on all tables in schema public
    from anon, authenticated;

-- 2) Signed-out visitors never write. There are no anon write policies today.
revoke insert, update, delete
    on all tables in schema public
    from anon;

-- 3) Keep tables created later by the dashboard/SQL editor from regaining them.
alter default privileges for role postgres in schema public
    revoke truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke insert, update, delete on tables from anon;

commit;
