-- =============================================================================
--  RLS behaviour checks.
--
--  Run against a database that already has schema.sql + seed.sql applied:
--    psql -U postgres -f supabase/tests/rls.sql
--
--  Every case runs inside its own transaction and is rolled back, so one
--  failure cannot influence the next. A case raises an exception, which
--  aborts the run, so a clean exit means every assertion held.
-- =============================================================================

\set ON_ERROR_STOP on

-- Switches the calling identity the way PostgREST does before each request.
-- Committed on its own so the helper survives the rollback of the fixtures.
create or replace function pg_temp.assume(p_id uuid, p_email text)
returns void language plpgsql as $fn$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id::text, 'email', p_email)::text,
    true);
end;
$fn$;

-- Identities live for the whole run and are removed at the end.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'supervisor@factory.th'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'engineer@factory.th'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'planner@factory.th')
on conflict do nothing;

insert into public.app_users (user_id, email, display_name, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'supervisor@factory.th', 'Supervisor', 'admin'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'engineer@factory.th',   'Engineer',   'engineer'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'planner@factory.th',    'Planner',    'planner')
on conflict (user_id) do nothing;

grant all on public.sites, public.production_lines, public.assets, public.spare_parts,
      public.work_orders, public.work_order_parts, public.production_runs,
      public.downtime_events, public.activity_trail, public.app_users to authenticated;

commit;

-- -----------------------------------------------------------------------------
\echo '1. anonymous traffic falls back to the least privileged role'
begin;
  set local role authenticated;
  do $case$
  begin
    if authz.current_role() <> 'planner' then
      raise exception 'expected the anonymous fallback to be planner, got %',
        authz.current_role();
    end if;
    if (select count(*) from public.activity_trail) <> 0 then
      raise exception 'anonymous traffic must not see the audit trail';
    end if;
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '2. admin reads the whole audit trail and cannot alter it'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000001', 'supervisor@factory.th');

  do $case$
  declare v_total integer;
  begin
    select count(*) into v_total from public.activity_trail;
    if v_total = 0 then
      raise exception 'admin sees no audit rows, expected the seeded ones';
    end if;
  end $case$;

  -- append-only: these must quietly affect zero rows and never raise
  do $case$
  begin
    update public.activity_trail set summary = 'tampered' where trail_id = 1;
    if found then
      raise exception 'an audit row was updated';
    end if;
  end $case$;

  do $case$
  begin
    delete from public.activity_trail;
    if found then
      raise exception 'the audit trail was deleted';
    end if;
  end $case$;

  do $case$
  declare v_after integer;
  begin
    select count(*) into v_after from public.activity_trail;
    if v_after = 0 then
      raise exception 'the audit trail was emptied';
    end if;
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '3. admin writes reference data'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000001', 'supervisor@factory.th');
  insert into public.sites (code, name) values ('RLS-1', 'admin wrote this');
rollback;

-- -----------------------------------------------------------------------------
\echo '4. an engineer may not write reference data'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000002', 'engineer@factory.th');
  do $case$
  begin
    insert into public.sites (code, name) values ('RLS-2', 'engineer must not');
    raise exception 'an engineer was able to insert a site';
  exception
    when insufficient_privilege then null;  -- refused, as expected
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '5. an engineer writes assets'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000002', 'engineer@factory.th');
  -- An UPDATE that a policy filters out updates zero rows and raises nothing,
  -- so the assertion has to look at FOUND rather than wait for an error.
  do $case$
  begin
    update public.assets set name = name where asset_tag = 'AST-PRN-001';
    if not found then
      raise exception 'an engineer could not update an asset';
    end if;
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '6. a planner may not write assets'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000003', 'planner@factory.th');
  do $case$
  begin
    update public.assets set name = name where asset_tag = 'AST-PRN-001';
    if found then
      raise exception 'a planner was able to update an asset';
    end if;
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '7. nobody but admin sees the audit trail'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000002', 'engineer@factory.th');
  do $case$
  begin
    if (select count(*) from public.activity_trail) <> 0 then
      raise exception 'an engineer could read the audit trail';
    end if;
  end $case$;
rollback;

begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000003', 'planner@factory.th');
  do $case$
  begin
    if (select count(*) from public.activity_trail) <> 0 then
      raise exception 'a planner could read the audit trail';
    end if;
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '8. a planner may open preventive work in a planning state'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000003', 'planner@factory.th');

  do $case$
  begin
    insert into public.work_orders
      (work_order_id, wo_number, asset_id, kind, state, priority, title, planned_for)
    select
      gen_random_uuid(), 'RLS-PM-1',
      (select asset_id from public.assets where asset_tag = 'AST-PRN-001'),
      'preventive', 'draft', 'p3', 'planner preventive draft', now();
  end $case$;

  do $case$
  begin
    insert into public.work_orders
      (work_order_id, wo_number, asset_id, kind, state, priority, title, planned_for)
    select
      gen_random_uuid(), 'RLS-PM-2',
      (select asset_id from public.assets where asset_tag = 'AST-PRN-001'),
      'preventive', 'scheduled', 'p3', 'planner preventive scheduled', now();
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '9. a planner may not open corrective work'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000003', 'planner@factory.th');
  do $case$
  begin
    insert into public.work_orders
      (work_order_id, wo_number, asset_id, kind, state, priority, title, planned_for)
    select
      gen_random_uuid(), 'RLS-CM-1',
      (select asset_id from public.assets where asset_tag = 'AST-PRN-001'),
      'corrective', 'draft', 'p1', 'planner corrective draft', now();
    raise exception 'a planner was able to open corrective work';
  exception
    when insufficient_privilege then null;  -- refused, as expected
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '10. a planner may not open preventive work that claims to be running'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000003', 'planner@factory.th');
  do $case$
  begin
    insert into public.work_orders
      (work_order_id, wo_number, asset_id, kind, state, priority, title, planned_for)
    select
      gen_random_uuid(), 'RLS-PM-3',
      (select asset_id from public.assets where asset_tag = 'AST-PRN-001'),
      'preventive', 'in_progress', 'p3', 'planner preventive running', now();
    raise exception 'a planner opened preventive work already in progress';
  exception
    when insufficient_privilege then null;  -- refused, as expected
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '11. a user cannot promote their own profile'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000002', 'engineer@factory.th');
  do $case$
  begin
    update public.app_users set role = 'admin' where email = 'engineer@factory.th';
    raise exception 'an engineer promoted their own role to admin';
  exception
    when insufficient_privilege then null;  -- refused, as expected
  end $case$;
rollback;

-- -----------------------------------------------------------------------------
\echo '12. a user may edit their own profile'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000002', 'engineer@factory.th');
  update public.app_users set display_name = 'Renamed Engineer'
    where email = 'engineer@factory.th';
rollback;

-- -----------------------------------------------------------------------------
\echo '13. an admin may manage another profile'
begin;
  set local role authenticated;
  select pg_temp.assume('aaaaaaaa-0000-4000-8000-000000000001', 'supervisor@factory.th');
  update public.app_users set display_name = 'Renamed By Admin'
    where email = 'engineer@factory.th';
rollback;

\echo ''
\echo 'All RLS assertions passed.'

-- Remove the test identities again.
begin;
  delete from public.app_users where email in
    ('supervisor@factory.th', 'engineer@factory.th', 'planner@factory.th');
  delete from auth.users where id in
    ('aaaaaaaa-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-4000-8000-000000000002',
     'aaaaaaaa-0000-4000-8000-000000000003');
commit;
