-- Minimal Supabase shim so schema.sql can be validated on vanilla PostgreSQL.
-- Recreates only the three things the schema depends on: the auth schema,
-- the auth.users table and auth.uid(). Roles are created too because the
-- grants at the end of schema.sql target them by name.

create schema if not exists auth;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create table if not exists auth.users (
  id                 uuid primary key,
  email              text unique,
  encrypted_password text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

comment on table auth.users is 'Shim table standing in for Supabase Auth.';

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

comment on function auth.uid() is 'Shim returning the sub claim of the current JWT.';

-- Supabase grants the client roles access to the auth schema so PostgREST can
-- call auth.uid() from policies. Mirror that here.
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
