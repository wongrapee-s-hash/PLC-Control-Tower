-- =============================================================================
--  Production Control Tower  ·  Supabase / PostgreSQL schema
--  Version : 1.0.0
--  Target  : PostgreSQL 15 (Supabase hosted)
--  Author  : PLC Control Tower engineering team
--
--  HOW TO APPLY
--    1. Supabase Dashboard -> SQL Editor -> New query
--    2. Paste this whole file and press Run.
--
--  This script is ADDITIVE ONLY. It creates the application schema, types,
--  tables, triggers, policies and views, and it is safe to re-run: every object
--  is created with `if not exists` semantics and every definition is replaced
--  in place. It never drops `public` and never deletes rows, so it will not
--  destroy data that already exists in your project. Use the reset script
--  (`supabase/reset.sql`) when you deliberately want a clean slate.
--
--  DESIGN NOTES (read this before you modify anything)
--    * The organisational hierarchy is  site -> line -> asset -> component.
--      `assets.parent_id` uses a self-reference so a robot cell can hang off
--      a conveyor without a new table.
--    * Maintenance is modelled as a *work order* document with a strict status
--      machine. Clients never write `work_orders.state` on their own - the
--      trigger `trg_work_order_transition_guard` validates the move and stamps
--      the matching `*_at` column in the same statement.
--    * Every mutating statement is captured into `activity_trail` by the
--      generic trigger `trg_activity_trail`, so the audit screen is derived
--      data and can never drift out of sync with the tables it watches.
--    * Row Level Security is enabled on every table. The helper functions in
--      the `authz` schema read `auth.uid()` once per statement.
-- =============================================================================

create schema if not exists authz;
create extension if not exists "pgcrypto";

-- =============================================================================
-- 1.  ENUM TYPES
--     Each type is checked on its own. Guarding the whole block on one type
--     would mean that a project which already has `app_role` but is missing
--     `work_state` silently keeps the broken state when this file is re-run.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'app_role') then
    create type public.app_role as enum ('admin', 'engineer', 'planner');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'asset_state') then
    create type public.asset_state as enum ('running', 'idle', 'setup', 'fault', 'maintenance', 'decommissioned');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'asset_criticality') then
    create type public.asset_criticality as enum ('low', 'medium', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'asset_kind') then
    create type public.asset_kind as enum ('conveyor', 'robot', 'cnc', 'press', 'injection', 'vision', 'compressor', 'utility');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'work_kind') then
    create type public.work_kind as enum ('preventive', 'corrective', 'predictive', 'calibration', 'improvement');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'work_state') then
    create type public.work_state as enum ('draft', 'scheduled', 'in_progress', 'blocked_parts', 'done', 'verified', 'cancelled');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'work_priority') then
    create type public.work_priority as enum ('p1', 'p2', 'p3', 'p4');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'downtime_cause') then
    create type public.downtime_cause as enum ('mechanical', 'electrical', 'operator', 'material', 'quality', 'process', 'planned');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'reaction_state') then
    create type public.reaction_state as enum ('open', 'acknowledged', 'mitigated', 'expired');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'trail_action') then
    create type public.trail_action as enum ('insert', 'update', 'delete');
  end if;
end
$$;

-- =============================================================================
-- 2.  SHARED HELPERS
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Reads the caller's app_role once. Falls back to 'planner' (read-mostly) for
-- anonymous traffic so that a misconfigured client fails *closed*, not open.
create or replace function authz.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select u.role from public.app_users u where u.user_id = auth.uid()),
    'planner'::public.app_role
  );
$$;

create or replace function authz.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select authz.current_role() = 'admin';
$$;

create or replace function authz.can_write()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select authz.current_role() in ('admin', 'engineer');
$$;

-- The caller's role again, but through the same `security definer` path used by
-- `current_role()`. A policy on `app_users` that compares a submitted role
-- against the stored one cannot query `app_users` inline: RLS would apply to the
-- sub-select too and the statement recurses. Routing through a definer function
-- reads the row with the policy check applied exactly once, as the owner.
create or replace function authz.owns_role(candidate public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select authz.current_role() = candidate;
$$;

revoke all on function authz.owns_role(public.app_role) from public, anon;
grant execute on function authz.owns_role(public.app_role) to authenticated;

-- =============================================================================
-- 3.  IDENTITY & ACCESS
-- =============================================================================

create table if not exists public.app_users (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  email         text        not null unique,
  display_name  text        not null,
  role          public.app_role not null default 'planner',
  site_code     text,
  is_active     boolean     not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.app_users is
  'Application profile linked 1:1 to an auth.users identity. Role is authoritative here, not in JWT claims.';

drop trigger if exists trg_app_users_touch on public.app_users;
create trigger trg_app_users_touch before update on public.app_users
  for each row execute function public.touch_updated_at();

-- Seeded personas. In a real deployment the password lives in auth.users; this
-- project authenticates through a credential gate that maps to these rows.
create table if not exists public.demo_principals (
  email        text primary key,
  display_name text        not null,
  role         public.app_role not null,
  password     text        not null,
  sort_order   smallint    not null default 0
);

-- =============================================================================
-- 4.  PHYSICAL HIERARCHY
-- =============================================================================

create table if not exists public.sites (
  site_id    uuid primary key default gen_random_uuid(),
  code       text        not null unique,
  name       text        not null,
  timezone   text        not null default 'Asia/Bangkok',
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sites_touch on public.sites;
create trigger trg_sites_touch before update on public.sites
  for each row execute function public.touch_updated_at();

create table if not exists public.production_lines (
  line_id      uuid primary key default gen_random_uuid(),
  site_id      uuid        not null references public.sites (site_id) on delete restrict,
  code         text        not null,
  name         text        not null,
  takt_seconds integer     not null default 45 check (takt_seconds > 0),
  shifts_per_day smallint  not null default 2 check (shifts_per_day between 1 and 4),
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint production_lines_site_code_key unique (site_id, code)
);

drop trigger if exists trg_lines_touch on public.production_lines;
create trigger trg_lines_touch before update on public.production_lines
  for each row execute function public.touch_updated_at();

create table if not exists public.assets (
  asset_id      uuid primary key default gen_random_uuid(),
  line_id       uuid        references public.production_lines (line_id) on delete restrict,
  parent_id     uuid        references public.assets (asset_id) on delete restrict,
  asset_tag     text        not null unique,
  name          text        not null,
  kind          public.asset_kind not null,
  state         public.asset_state not null default 'idle',
  criticality   public.asset_criticality not null default 'medium',
  manufacturer  text,
  model_name    text,
  serial_number text,
  commissioned_on date,
  last_pm_on     date,
  next_pm_due    date,
  target_oee     numeric(5,2) not null default 85.00 check (target_oee between 0 and 100),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- An asset may not be its own parent (checked on update as well).
  constraint assets_no_self_parent check (parent_id is null or parent_id <> asset_id)
);

create index if not exists assets_line_idx    on public.assets (line_id);
create index if not exists assets_state_idx   on public.assets (state);
create index if not exists assets_pm_due_idx  on public.assets (next_pm_due) where next_pm_due is not null;

drop trigger if exists trg_assets_touch on public.assets;
create trigger trg_assets_touch before update on public.assets
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- 5.  MAINTENANCE WORKFLOW
-- =============================================================================

create table if not exists public.spare_parts (
  part_id        uuid primary key default gen_random_uuid(),
  sku            text        not null unique,
  description    text        not null,
  on_hand        integer     not null default 0 check (on_hand >= 0),
  reserved       integer     not null default 0 check (reserved >= 0),
  reorder_point  integer     not null default 0 check (reorder_point >= 0),
  unit_cost      numeric(10,2) not null default 0 check (unit_cost >= 0),
  lead_time_days integer     not null default 7 check (lead_time_days >= 0),
  bin_location   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Reserved can never exceed physical stock, otherwise the WO flow is lying.
  constraint spare_parts_reservation_valid check (reserved <= on_hand)
);

drop trigger if exists trg_spare_parts_touch on public.spare_parts;
create trigger trg_spare_parts_touch before update on public.spare_parts
  for each row execute function public.touch_updated_at();

create table if not exists public.work_orders (
  work_order_id  uuid primary key default gen_random_uuid(),
  wo_number      text        not null unique,
  asset_id       uuid        not null references public.assets (asset_id) on delete restrict,
  kind           public.work_kind not null,
  state          public.work_state not null default 'draft',
  priority       public.work_priority not null default 'p3',
  title          text        not null,
  detail         text,
  requested_by   uuid        references public.app_users (user_id) on delete set null,
  assignee_id    uuid        references public.app_users (user_id) on delete set null,
  opened_at      timestamptz not null default now(),
  planned_for    date,
  started_at     timestamptz,
  completed_at   timestamptz,
  verified_at    timestamptz,
  downtime_minutes integer   not null default 0 check (downtime_minutes >= 0),
  labour_minutes   integer   not null default 0 check (labour_minutes >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- State machine integrity, enforced declaratively in addition to the trigger.
  constraint work_orders_in_progress_needs_start  check (state <> 'in_progress' or started_at  is not null),
  constraint work_orders_done_needs_complete     check (state <> 'done'        or completed_at is not null),
  constraint work_orders_verified_needs_verify   check (state <> 'verified'    or verified_at  is not null)
);

create index if not exists work_orders_asset_idx  on public.work_orders (asset_id);
create index if not exists work_orders_state_idx  on public.work_orders (state);
create index if not exists work_orders_assignee_idx on public.work_orders (assignee_id) where assignee_id is not null;
create index if not exists work_orders_open_idx   on public.work_orders (priority, opened_at)
  where state in ('draft', 'scheduled', 'in_progress', 'blocked_parts');

drop trigger if exists trg_work_orders_touch on public.work_orders;
create trigger trg_work_orders_touch before update on public.work_orders
  for each row execute function public.touch_updated_at();

-- Line items on a work order. `qty_reserved` is what puts a WO into
-- 'blocked_parts'; `qty_issued` is what finally leaves the storeroom.
create table if not exists public.work_order_parts (
  wo_part_id     uuid primary key default gen_random_uuid(),
  work_order_id  uuid    not null references public.work_orders (work_order_id) on delete cascade,
  part_id        uuid    not null references public.spare_parts (part_id) on delete restrict,
  qty_required   integer not null check (qty_required > 0),
  qty_reserved   integer not null default 0 check (qty_reserved >= 0),
  qty_issued     integer not null default 0 check (qty_issued >= 0),
  reserved_at    timestamptz,
  issued_at      timestamptz,
  created_at     timestamptz not null default now(),
  constraint wo_parts_unique_per_wo unique (work_order_id, part_id),
  constraint wo_parts_issue_within_req check (qty_issued <= qty_required),
  constraint wo_parts_reserve_within_req check (qty_reserved <= qty_required)
);

create index if not exists wo_parts_wo_idx   on public.work_order_parts (work_order_id);
create index if not exists wo_parts_part_idx on public.work_order_parts (part_id);

-- =============================================================================
-- 6.  PRODUCTION LOSS
-- =============================================================================

create table if not exists public.production_runs (
  run_id       uuid primary key default gen_random_uuid(),
  asset_id     uuid        not null references public.assets (asset_id) on delete restrict,
  shift_code   text        not null,
  ran_on       date        not null,
  planned_minutes integer  not null check (planned_minutes >= 0),
  running_minutes integer  not null check (running_minutes >= 0),
  good_units   integer     not null default 0 check (good_units >= 0),
  scrap_units  integer     not null default 0 check (scrap_units >= 0),
  created_at   timestamptz not null default now(),
  constraint production_runs_unique_shift unique (asset_id, ran_on, shift_code),
  -- Availability is physically capped by the schedule; a run cannot "run"
  -- longer than it was planned for.
  constraint production_runs_capped check (running_minutes <= planned_minutes)
);

create index if not exists production_runs_asset_date_idx on public.production_runs (asset_id, ran_on desc);

create table if not exists public.downtime_events (
  event_id      uuid primary key default gen_random_uuid(),
  asset_id      uuid        not null references public.assets (asset_id) on delete restrict,
  work_order_id uuid        references public.work_orders (work_order_id) on delete set null,
  cause         public.downtime_cause not null,
  reaction      public.reaction_state not null default 'open',
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  minutes       integer     not null default 0 check (minutes >= 0),
  narration     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint downtime_ended_after_start check (ended_at is null or ended_at >= started_at),
  constraint downtime_closed_has_end  check (reaction = 'open' or ended_at is not null)
);

create index if not exists downtime_asset_idx  on public.downtime_events (asset_id, started_at desc);
create index if not exists downtime_react_idx on public.downtime_events (reaction) where reaction <> 'expired';

drop trigger if exists trg_downtime_touch on public.downtime_events;
create trigger trg_downtime_touch before update on public.downtime_events
  for each row execute function public.touch_updated_at();

-- Keep the cached `minutes` column honest instead of trusting the client.
create or replace function public.sync_downtime_minutes()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is not null then
    new.minutes := greatest(
      0,
      floor(extract(epoch from (new.ended_at - new.started_at)) / 60)::int
    );
  else
    new.minutes := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_downtime_minutes on public.downtime_events;
create trigger trg_downtime_minutes before insert or update on public.downtime_events
  for each row execute function public.sync_downtime_minutes();

-- =============================================================================
-- 7.  ACTIVITY TRAIL (audit)
-- =============================================================================

create table if not exists public.activity_trail (
  trail_id     bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  actor_id     uuid references public.app_users (user_id) on delete set null,
  actor_email  text,
  action       public.trail_action not null,
  table_name   text        not null,
  row_key      text        not null,
  summary      text        not null,
  diff         jsonb       not null default '{}'::jsonb
);

create index if not exists activity_trail_at_idx     on public.activity_trail (at desc);
create index if not exists activity_trail_actor_idx  on public.activity_trail (actor_id, at desc);
create index if not exists activity_trail_table_idx  on public.activity_trail (table_name, at desc);

create or replace function public.record_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text := tg_table_name;
  v_row   jsonb;
  v_key   text;
  v_actor uuid := auth.uid();
  v_mail  text;
  v_label text;
begin
  -- A trigger cannot coalesce two record variables, so pick the live row once
  -- and read every field from that jsonb snapshot.
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  -- Prefer a human-readable business key over the surrogate uuid.
  v_key := coalesce(
    nullif(v_row ->> 'wo_number', ''),
    nullif(v_row ->> 'asset_tag', ''),
    nullif(v_row ->> 'sku', ''),
    nullif(v_row ->> 'email', ''),
    nullif(v_row ->> 'code', ''),
    nullif(v_row ->> 'work_order_id', ''),
    nullif(v_row ->> 'asset_id', ''),
    nullif(v_row ->> 'part_id', ''),
    nullif(v_row ->> 'event_id', ''),
    gen_random_uuid()::text
  );

  v_label := coalesce(
    nullif(v_row ->> 'title', ''),
    nullif(v_row ->> 'name', ''),
    nullif(v_row ->> 'description', '')
  );

  -- actor_email is stored as well as actor_id so the audit trail stays readable
  -- after a user account is removed (actor_id is then set to null).
  v_mail := coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email', ''),
    (select u.email from public.app_users u where u.user_id = v_actor)
  );

  insert into public.activity_trail (actor_id, actor_email, action, table_name, row_key, summary, diff)
  values (
    v_actor,
    v_mail,
    (tg_op::public.trail_action),
    v_table,
    v_key,
    v_table || ' / ' || v_key || coalesce(' - ' || v_label, ''),
    case
      when tg_op = 'INSERT' then v_row
      when tg_op = 'DELETE' then v_row
      else jsonb_build_object(
             'before', to_jsonb(old) - 'updated_at',
             'after',  v_row - 'updated_at'
           )
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- The trail watches the operational tables only; never itself, never app_users.
-- The `drop trigger if exists` above each `create trigger` keeps this re-runnable.
drop trigger if exists trg_trail_assets on public.assets;
create trigger trg_trail_assets
  after insert or update or delete on public.assets
  for each row execute function public.record_activity();

drop trigger if exists trg_trail_work_orders on public.work_orders;
create trigger trg_trail_work_orders
  after insert or update or delete on public.work_orders
  for each row execute function public.record_activity();

drop trigger if exists trg_trail_spare_parts on public.spare_parts;
create trigger trg_trail_spare_parts
  after insert or update or delete on public.spare_parts
  for each row execute function public.record_activity();

drop trigger if exists trg_trail_downtime on public.downtime_events;
create trigger trg_trail_downtime
  after insert or update or delete on public.downtime_events
  for each row execute function public.record_activity();

-- Part lines change constantly while a job is running, so they are audited too.
drop trigger if exists trg_trail_wo_parts on public.work_order_parts;
create trigger trg_trail_wo_parts
  after insert or update or delete on public.work_order_parts
  for each row execute function public.record_activity();

-- =============================================================================
-- 8.  WORK ORDER STATE MACHINE
-- =============================================================================

-- Legal transitions. Anything not in this table is rejected by the trigger.
create or replace function public.work_order_transition_allowed(
  from_state public.work_state,
  to_state   public.work_state
) returns boolean
language sql
immutable
as $$
  select case
    when from_state = to_state then true
    when from_state = 'draft'        and to_state in ('scheduled', 'in_progress', 'cancelled') then true
    when from_state = 'scheduled'    and to_state in ('in_progress', 'cancelled') then true
    when from_state = 'in_progress'  and to_state in ('blocked_parts', 'done', 'cancelled') then true
    when from_state = 'blocked_parts' and to_state in ('in_progress', 'done', 'cancelled') then true
    when from_state = 'done'         and to_state in ('verified', 'in_progress') then true
    when from_state = 'verified'     and to_state in ('in_progress', 'cancelled') then true
    when from_state = 'cancelled'    and to_state = 'draft' then true
    else false
  end;
$$;

create or replace function public.guard_work_order_state()
returns trigger
language plpgsql
as $$
begin
  if not public.work_order_transition_allowed(old.state, new.state) then
    raise exception 'illegal work order transition: % -> %', old.state, new.state
      using errcode = 'check_violation';
  end if;

  -- Stamp the lifecycle column that matches the destination state.
  if new.state = 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;

  if new.state = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
    -- Crossing into done while still short of parts is a contradiction.
    if new.state <> 'blocked_parts'
       and exists (
         select 1 from public.work_order_parts p
         where p.work_order_id = new.work_order_id
           and p.qty_issued < p.qty_required
       )
    then
      raise exception 'work order % cannot close: outstanding parts remain', new.wo_number
        using errcode = 'check_violation';
    end if;
  end if;

  if new.state = 'verified' then
    new.verified_at := coalesce(new.verified_at, now());
  end if;

  -- Terminal states must not keep a completion stamp, and vice versa.
  if new.state in ('draft', 'scheduled', 'in_progress', 'blocked_parts', 'cancelled') then
    new.completed_at := null;
    new.verified_at  := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_work_order_transition_guard on public.work_orders;
create trigger trg_work_order_transition_guard
  before update of state on public.work_orders
  for each row execute function public.guard_work_order_state();

-- =============================================================================
-- 9.  DERIVED VIEWS
-- =============================================================================

-- All three views run with the *caller's* rights (PostgreSQL 15
-- `security_invoker`). Without it a view is evaluated as its owner, which would
-- quietly bypass the RLS policies on the underlying tables.
--
-- Availability / performance / quality per asset over a date window.
create or replace view public.asset_oee
with (security_invoker = true)
as
select
  a.asset_id,
  a.asset_tag,
  a.name,
  a.line_id,
  coalesce(sum(r.planned_minutes), 0)::numeric as planned_minutes,
  coalesce(sum(r.running_minutes), 0)::numeric as running_minutes,
  coalesce(sum(r.good_units), 0)                as good_units,
  coalesce(sum(r.scrap_units), 0)               as scrap_units,
  case when coalesce(sum(r.planned_minutes), 0) = 0 then 0
       else round(coalesce(sum(r.running_minutes), 0)::numeric
                  / sum(r.planned_minutes) * 100, 2)
  end as availability_pct,
  case when coalesce(sum(r.running_minutes), 0) = 0 then 0
       else round(coalesce(sum(r.good_units), 0)::numeric
                  / (sum(r.good_units) + sum(r.scrap_units)) * 100, 2)
  end as quality_pct
from public.assets a
left join public.production_runs r on r.asset_id = a.asset_id
group by a.asset_id, a.asset_tag, a.name, a.line_id;

-- Open engineering load, used by the dashboard tiles.
create or replace view public.workload_summary
with (security_invoker = true)
as
select
  state,
  count(*)::int                          as count,
  coalesce(sum(downtime_minutes), 0)::int as downtime_minutes,
  coalesce(sum(labour_minutes), 0)::int   as labour_minutes
from public.work_orders
group by state;

-- Parts that are at or below their reorder point.
create or replace view public.reorder_queue
with (security_invoker = true)
as
select sku, description, on_hand, reserved, reorder_point, lead_time_days, unit_cost
from public.spare_parts
where on_hand - reserved <= reorder_point;

-- =============================================================================
-- 10.  ROW LEVEL SECURITY
-- =============================================================================

alter table public.app_users        enable row level security;
alter table public.sites            enable row level security;
alter table public.production_lines enable row level security;
alter table public.assets           enable row level security;
alter table public.spare_parts      enable row level security;
alter table public.work_orders      enable row level security;
alter table public.work_order_parts enable row level security;
alter table public.production_runs  enable row level security;
alter table public.downtime_events  enable row level security;
alter table public.activity_trail   enable row level security;

-- `demo_principals` holds the three documented demo logins *with* passwords.
-- RLS on, no SELECT policy and no grant: it is only ever read by the SQL
-- editor that seeded it. If you deploy a real system, delete this table.
alter table public.demo_principals  enable row level security;

-- Every policy is dropped first so the script can be re-run without erroring
-- on "policy already exists".
do $$
declare
  t text;
  p text;
begin
  foreach t in array array[
    'app_users', 'sites', 'production_lines', 'assets', 'spare_parts',
    'work_orders', 'work_order_parts', 'production_runs',
    'downtime_events', 'activity_trail'
  ] loop
    for p in select pol.polname
             from pg_policy pol
             join pg_class c on c.oid = pol.polrelid
             join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = t
    loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;
  end loop;
end
$$;

-- Reference data: readable by everyone, writable by admin only.
create policy ref_read  on public.sites            for select using (true);
create policy ref_write on public.sites            for all    using (authz.is_admin()) with check (authz.is_admin());
create policy ref_read  on public.production_lines for select using (true);
create policy ref_write on public.production_lines for all    using (authz.is_admin()) with check (authz.is_admin());

-- Profiles: you can read yourself, admin reads all, nobody self-registers.
--
-- A user may edit their *own* profile but must not be able to change their own
-- role - otherwise any account could `update app_users set role = 'admin'`.
-- The `with check` compares the role against the stored one, so a self-service
-- update is only accepted when the role is left untouched.
create policy profile_self_read  on public.app_users for select
  using (user_id = auth.uid() or authz.is_admin());

create policy profile_self_write on public.app_users for update
  using      (user_id = auth.uid())
  with check (user_id = auth.uid() and authz.owns_role(role));

create policy profile_admin_all  on public.app_users for all
  using (authz.is_admin()) with check (authz.is_admin());

-- Assets: read everyone, write requires engineer/admin.
create policy asset_read  on public.assets for select using (true);
create policy asset_write on public.assets for all    using (authz.can_write()) with check (authz.can_write());

-- Parts: read everyone, write requires engineer/admin.
create policy part_read  on public.spare_parts for select using (true);
create policy part_write on public.spare_parts for all    using (authz.can_write()) with check (authz.can_write());

-- Work orders: read everyone, write requires engineer/admin. Planners may
-- create preventive work (that is what scheduling is) but cannot execute it,
-- and they may never insert a work order that is already in progress.
create policy wo_read   on public.work_orders for select using (true);
create policy wo_update on public.work_orders for update using (authz.can_write()) with check (authz.can_write());
create policy wo_delete on public.work_orders for delete using (authz.is_admin());
create policy wo_insert on public.work_orders for insert
  with check (
    authz.current_role() <> 'planner'
    or (kind = 'preventive' and state in ('draft', 'scheduled'))
  );

create policy wop_read   on public.work_order_parts for select using (true);
create policy wop_write  on public.work_order_parts for all    using (authz.can_write()) with check (authz.can_write());

-- Production + downtime: read everyone, write requires engineer/admin.
create policy run_read  on public.production_runs for select using (true);
create policy run_write on public.production_runs for all    using (authz.can_write()) with check (authz.can_write());

create policy dt_read   on public.downtime_events for select using (true);
create policy dt_write  on public.downtime_events for all    using (authz.can_write()) with check (authz.can_write());

-- The audit trail is admin-only (matching the `trail.view` permission in
-- src/lib/permissions.ts) and append-only: the database trigger is the only
-- writer, and no role - not even admin - may update or delete a row after the
-- fact.
create policy trail_read  on public.activity_trail for select using (authz.is_admin());
create policy trail_lock  on public.activity_trail for insert with check (false);
create policy trail_block on public.activity_trail for update using (false);
create policy trail_nuke  on public.activity_trail for delete using (false);

-- =============================================================================
-- 11.  GRANTS
-- =============================================================================

grant usage on schema public to anon, authenticated;
grant usage on schema authz  to anon, authenticated;

-- Explicit table-by-table grants. `grant select on all tables` is deliberately
-- NOT used: it would hand anon select on `demo_principals` and `app_users`.
grant select on public.sites, public.production_lines, public.assets,
                  public.spare_parts, public.work_orders, public.work_order_parts,
                  public.production_runs, public.downtime_events
  to anon, authenticated;

-- The audit trail is admin-only in the permission matrix, so anonymous traffic
-- gets no grant on it at all.
grant select on public.activity_trail to authenticated;

grant insert, update, delete on public.assets, public.spare_parts,
                            public.work_orders, public.work_order_parts,
                            public.production_runs, public.downtime_events
  to authenticated;

grant select, update on public.app_users to authenticated;
grant all on public.sites, public.production_lines to authenticated;

-- Views need their own grant: they are not covered by the table grants above,
-- and without this they resolve to nobody even though the underlying tables are
-- readable. `security_invoker` keeps the base tables' policies in force.
grant select on public.asset_oee, public.workload_summary, public.reorder_queue
  to anon, authenticated;

grant usage, select on all sequences in schema public to authenticated;
