-- =============================================================================
--  Production Control Tower  ·  destructive reset
--  Version : 1.0.0
--
--  THIS SCRIPT DELETES DATA. `schema.sql` is additive and never drops
--  anything; this one exists for the case where you deliberately want to start
--  over on a scratch project.
--
--  HOW TO APPLY
--    Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--    Run `schema.sql` afterwards, then `seed.sql`.
--
--  WARNING
--    `drop schema public cascade` removes every table, view and function in the
--    `public` schema, including objects that have nothing to do with this
--    project. Never run it against a project that holds data you care about.
-- =============================================================================

drop schema if exists public cascade;
create schema public;

-- Put back the grants the Supabase platform expects on a fresh `public` schema.
grant usage on schema public to postgres, anon, authenticated, service_role;
alter schema public grant owner to postgres;

-- Auth lives in its own schema and is owned by the platform; nothing above
-- touched it, so existing sign-ins and user accounts survive.
