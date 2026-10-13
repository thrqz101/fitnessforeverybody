-- Fitness for Everybody: Supabase backend (profiles, recognition, food log, daily activity, feedback).
--
-- Access model
--   * Browsers read their own rows through RLS (select only).
--   * Every write goes through the Next.js API, which verifies the session, takes the user id
--     from it, and calls the functions below with the service_role key.
--   * The functions are NOT executable by anon/authenticated, so nobody can spoof targets,
--     recognition output, flow counts or the effective flag from the browser.
--
-- Day semantics: Asia/Shanghai calendar day. A day is writable only while it is "today" and
-- not finalized. Finalization recomputes everything from confirmed food_entries.

create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.app_today() returns date
language sql stable set search_path = public, pg_temp
as $$ select (now() at time zone 'Asia/Shanghai')::date $$;

-- {protein, carbs, fat, calories, fiber}: all numbers in [0, 20000].
create or replace function public.macros_valid(m jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp
as $$
declare k text;
begin
  if m is null or jsonb_typeof(m) <> 'object' then return false; end if;
  foreach k in array array['protein', 'carbs', 'fat', 'calories', 'fiber'] loop
    if coalesce(jsonb_typeof(m -> k), '') <> 'number' then return false; end if;
    if (m ->> k)::numeric < 0 or (m ->> k)::numeric > 20000 then return false; end if;
  end loop;
  return true;
end $$;

-- Same rounding as lib/nutrition.ts scaleMacros (Math.round on non-negative values).
create or replace function public.scale_macros(m jsonb, s numeric) returns jsonb
language sql immutable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'protein', round((m ->> 'protein')::numeric * s),
    'carbs', round((m ->> 'carbs')::numeric * s),
    'fat', round((m ->> 'fat')::numeric * s),
    'calories', round((m ->> 'calories')::numeric * s),
    'fiber', round((m ->> 'fiber')::numeric * s)
  )
$$;

-- Weights v1: protein 25, calories 25, carbs 20, fat 15, fiber 15.
-- Each item is min(actual / target, 1). Returned unrounded (0..1); the 50% gate uses this value.
create or replace function public.weighted_score(totals jsonb, targets jsonb) returns numeric
language sql immutable set search_path = public, pg_temp
as $$
  select coalesce(sum(v.w * least((totals ->> v.k)::numeric / (targets ->> v.k)::numeric, 1)), 0)
  from (values
    ('protein', 0.25::numeric), ('calories', 0.25::numeric), ('carbs', 0.20::numeric),
    ('fat', 0.15::numeric), ('fiber', 0.15::numeric)
  ) as v(k, w)
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  height_cm numeric check (height_cm between 50 and 260),
  weight_kg numeric check (weight_kg between 20 and 400),
  gender text check (gender in ('male', 'female')),
  age integer check (age between 10 and 120),
  bmr_kcal numeric check (bmr_kcal between 500 and 6000),
  goal text check (goal in ('muscle', 'fat_loss', 'weight_loss', 'health')),
  target_weight_kg numeric check (target_weight_kg between 20 and 400),
  target_body_fat numeric check (target_body_fat between 2 and 70),
  body_fat numeric check (body_fat between 2 and 70),
  training_style text check (char_length(training_style) <= 40),
  eating_pattern text check (char_length(eating_pattern) <= 40),
  macro_multipliers jsonb check (macro_multipliers is null or jsonb_typeof(macro_multipliers) = 'object'),
  fiber_grams numeric check (fiber_grams between 0 and 200),
  setup_completed boolean not null default false,
  feedback_progress jsonb not null default '{}'::jsonb check (octet_length(feedback_progress::text) < 8192),
  local_import_state text not null default 'pending' check (local_import_state in ('pending', 'imported', 'skipped')),
  is_test boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recognition_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  input_text text not null check (char_length(input_text) between 1 and 2000),
  status text not null default 'processing' check (status in ('processing', 'succeeded', 'not_food', 'failed')),
  route text,
  output jsonb check (output is null or octet_length(output::text) < 262144),
  error_class text check (char_length(error_class) <= 80),
  first_confirmed_at timestamptz,
  counted_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, request_id),
  check ((first_confirmed_at is null) = (counted_date is null))
);
create index recognition_requests_user_created_idx on public.recognition_requests (user_id, created_at desc);
create index recognition_requests_user_counted_idx on public.recognition_requests (user_id, counted_date) where counted_date is not null;

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid references public.recognition_requests (id) on delete cascade,
  client_id text check (char_length(client_id) <= 80),
  source text not null check (source in ('ai-text', 'manual', 'recommendation', 'import')),
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 200),
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'midnight')),
  item jsonb not null default '{}'::jsonb check (octet_length(item::text) < 32768),
  base_macros jsonb not null check (public.macros_valid(base_macros)),
  portion_scale numeric not null default 1 check (portion_scale between 0.1 and 10),
  final_macros jsonb not null check (public.macros_valid(final_macros)),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'deleted')),
  entry_date date not null,
  confirmed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index food_entries_user_day_idx on public.food_entries (user_id, entry_date, status);
create index food_entries_request_idx on public.food_entries (request_id) where request_id is not null;

create table public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  day_settings jsonb not null default '{}'::jsonb,
  profile_snapshot jsonb,
  targets jsonb check (targets is null or public.macros_valid(targets)),
  totals jsonb not null default '{"protein":0,"carbs":0,"fat":0,"calories":0,"fiber":0}'::jsonb check (public.macros_valid(totals)),
  confirmed_flows integer not null default 0,
  score numeric check (score between 0 and 1),
  weights_version integer not null default 1,
  migrated boolean not null default false,
  finalized_at timestamptz,
  is_effective boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, activity_date)
);
create index daily_activity_open_idx on public.daily_activity (activity_date) where finalized_at is null;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dedupe_id uuid not null,
  kind text not null check (kind in ('suggestion', 'issue', 'other')),
  message text not null check (char_length(message) between 2 and 2000),
  contact text check (char_length(contact) <= 200),
  status text not null default 'new' check (status in ('new', 'reviewed', 'archived')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  unique (user_id, dedupe_id)
);
create index feedback_user_created_idx on public.feedback (user_id, created_at desc);

-- Operational log (finalization failures etc.). Not exposed to any API role.
create table public.job_log (
  id bigint generated always as identity primary key,
  job text not null,
  ran_at timestamptz not null default now(),
  processed integer not null default 0,
  failed integer not null default 0,
  detail jsonb
);

-- ---------------------------------------------------------------------------
-- RLS + privileges: owners may read their own rows; nothing else from the API roles.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.recognition_requests enable row level security;
alter table public.food_entries enable row level security;
alter table public.daily_activity enable row level security;
alter table public.feedback enable row level security;
alter table public.job_log enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy recognition_requests_select_own on public.recognition_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy food_entries_select_own on public.food_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy daily_activity_select_own on public.daily_activity for select to authenticated
  using ((select auth.uid()) = user_id);
create policy feedback_select_own on public.feedback for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.recognition_requests, public.food_entries,
  public.daily_activity, public.feedback, public.job_log from anon, authenticated;
grant select on public.profiles, public.recognition_requests, public.food_entries,
  public.daily_activity, public.feedback to authenticated;

-- ---------------------------------------------------------------------------
-- Core functions (service_role only; p_user comes from the verified server session)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_profile(p_user uuid) returns public.profiles
language plpgsql set search_path = public, pg_temp
as $$
declare r public.profiles;
begin
  insert into public.profiles (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into r from public.profiles where user_id = p_user;
  return r;
end $$;

create or replace function public.upsert_profile(p_user uuid, p_profile jsonb, p_expected_version integer default null)
returns public.profiles
language plpgsql set search_path = public, pg_temp
as $$
declare r public.profiles;
begin
  perform public.ensure_profile(p_user);
  select * into r from public.profiles where user_id = p_user for update;
  if p_expected_version is not null and r.version <> p_expected_version then
    raise exception 'version_conflict';
  end if;
  if p_profile ->> 'heightCm' is null or p_profile ->> 'weightKg' is null or p_profile ->> 'gender' is null
     or p_profile ->> 'age' is null or p_profile ->> 'bmrKcal' is null or p_profile ->> 'goal' is null
     or p_profile ->> 'targetWeightKg' is null then
    raise exception 'invalid_profile';
  end if;
  update public.profiles set
    height_cm = (p_profile ->> 'heightCm')::numeric,
    weight_kg = (p_profile ->> 'weightKg')::numeric,
    gender = p_profile ->> 'gender',
    age = (p_profile ->> 'age')::integer,
    bmr_kcal = (p_profile ->> 'bmrKcal')::numeric,
    goal = p_profile ->> 'goal',
    target_weight_kg = (p_profile ->> 'targetWeightKg')::numeric,
    target_body_fat = (p_profile ->> 'targetBodyFat')::numeric,
    body_fat = (p_profile ->> 'bodyFat')::numeric,
    training_style = p_profile ->> 'trainingStyle',
    eating_pattern = p_profile ->> 'eatingPattern',
    macro_multipliers = nullif(p_profile -> 'macroMultipliers', 'null'::jsonb),
    fiber_grams = (p_profile ->> 'fiberGrams')::numeric,
    setup_completed = true,
    version = version + 1,
    updated_at = now()
  where user_id = p_user
  returning * into r;
  return r;
end $$;

create or replace function public.update_feedback_progress(p_user uuid, p_progress jsonb)
returns public.profiles
language plpgsql set search_path = public, pg_temp
as $$
declare r public.profiles;
begin
  perform public.ensure_profile(p_user);
  update public.profiles set feedback_progress = coalesce(p_progress, '{}'::jsonb), updated_at = now()
  where user_id = p_user returning * into r;
  return r;
end $$;

-- Recompute totals / flow count / score for one day. p_finalize also stamps the day closed.
-- Callers lock the daily_activity row first; the select ... for update here is re-entrant.
create or replace function public.recompute_day(p_user uuid, p_date date, p_finalize boolean default false)
returns public.daily_activity
language plpgsql set search_path = public, pg_temp
as $$
declare r public.daily_activity; t jsonb; f integer; sc numeric;
begin
  select * into r from public.daily_activity where user_id = p_user and activity_date = p_date for update;
  if not found then raise exception 'day_not_ready'; end if;

  select jsonb_build_object(
    'protein', coalesce(sum((final_macros ->> 'protein')::numeric), 0),
    'carbs', coalesce(sum((final_macros ->> 'carbs')::numeric), 0),
    'fat', coalesce(sum((final_macros ->> 'fat')::numeric), 0),
    'calories', coalesce(sum((final_macros ->> 'calories')::numeric), 0),
    'fiber', coalesce(sum((final_macros ->> 'fiber')::numeric), 0))
  into t
  from public.food_entries
  where user_id = p_user and entry_date = p_date and status = 'confirmed';

  select count(*) into f
  from public.recognition_requests q
  where q.user_id = p_user and q.counted_date = p_date
    and exists (select 1 from public.food_entries e
                where e.request_id = q.id and e.status = 'confirmed' and e.entry_date = p_date);

  sc := case when r.targets is null then null else public.weighted_score(t, r.targets) end;

  update public.daily_activity set
    totals = t,
    confirmed_flows = f,
    score = sc,
    updated_at = now(),
    finalized_at = case when p_finalize then now() else finalized_at end,
    is_effective = case
      when not p_finalize then is_effective
      when migrated or sc is null then null
      else (f >= 2 and sc >= 0.5)
    end
  where id = r.id
  returning * into r;
  return r;
end $$;

-- Today's goal snapshot. Targets are computed by trusted server code (lib/nutrition.ts).
create or replace function public.upsert_day_snapshot(p_user uuid, p_day jsonb, p_targets jsonb, p_profile jsonb)
returns public.daily_activity
language plpgsql set search_path = public, pg_temp
as $$
declare d date := public.app_today(); r public.daily_activity; k text;
begin
  if not public.macros_valid(p_targets) then raise exception 'invalid_targets'; end if;
  foreach k in array array['protein', 'carbs', 'fat', 'calories', 'fiber'] loop
    if (p_targets ->> k)::numeric <= 0 then raise exception 'invalid_targets'; end if;
  end loop;

  insert into public.daily_activity (user_id, activity_date) values (p_user, d)
  on conflict (user_id, activity_date) do nothing;
  select * into r from public.daily_activity where user_id = p_user and activity_date = d for update;
  if r.finalized_at is not null then raise exception 'day_closed'; end if;

  update public.daily_activity set
    day_settings = coalesce(p_day, '{}'::jsonb),
    targets = p_targets,
    profile_snapshot = p_profile,
    updated_at = now()
  where id = r.id;
  return public.recompute_day(p_user, d);
end $$;

-- Idempotent entry point for a recognition. Returns:
--   {state:'new'}                        caller should run recognition, then complete_recognition
--   {state:'processing'}                 another attempt is in flight
--   {state:'done', status, entries, ..}  finished earlier; reuse result
create or replace function public.begin_recognition(p_user uuid, p_request_id uuid, p_input text)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare q public.recognition_requests; n integer;
begin
  if p_input is null or char_length(btrim(p_input)) = 0 or char_length(p_input) > 2000 then
    raise exception 'invalid_input';
  end if;

  select * into q from public.recognition_requests where user_id = p_user and request_id = p_request_id for update;
  if not found then
    select count(*) into n from public.recognition_requests
    where user_id = p_user and created_at > now() - interval '1 hour';
    if n >= 60 then raise exception 'rate_limited'; end if;
    select count(*) into n from public.recognition_requests
    where user_id = p_user and created_at > now() - interval '24 hours';
    if n >= 300 then raise exception 'rate_limited'; end if;

    insert into public.recognition_requests (user_id, request_id, input_text)
    values (p_user, p_request_id, p_input)
    on conflict (user_id, request_id) do nothing
    returning * into q;
    if found then
      return jsonb_build_object('state', 'new', 'id', q.id);
    end if;
    select * into q from public.recognition_requests where user_id = p_user and request_id = p_request_id for update;
  end if;

  if q.input_text <> p_input then raise exception 'request_conflict'; end if;

  if q.status = 'processing' then
    if q.updated_at < now() - interval '2 minutes' then
      update public.recognition_requests set updated_at = now() where id = q.id;
      return jsonb_build_object('state', 'new', 'id', q.id);
    end if;
    return jsonb_build_object('state', 'processing', 'id', q.id);
  end if;

  if q.status = 'failed' then
    update public.recognition_requests
    set status = 'processing', error_class = null, updated_at = now() where id = q.id;
    return jsonb_build_object('state', 'new', 'id', q.id);
  end if;

  return jsonb_build_object(
    'state', 'done', 'id', q.id, 'status', q.status, 'route', q.route, 'output', q.output,
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at, e.id)
                         from public.food_entries e
                         where e.request_id = q.id and e.status <> 'deleted'), '[]'::jsonb));
end $$;

-- Stores the recognition result and creates draft entries. p_foods items:
--   {name, brand?, meal, baseMacros, portionScale?, item?}
create or replace function public.complete_recognition(
  p_user uuid, p_request_id uuid, p_status text, p_route text, p_output jsonb,
  p_error_class text default null, p_foods jsonb default '[]'::jsonb)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare q public.recognition_requests; f jsonb; scale numeric; n integer;
begin
  if p_status not in ('succeeded', 'not_food', 'failed') then raise exception 'invalid_status'; end if;
  select * into q from public.recognition_requests where user_id = p_user and request_id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;

  if q.status in ('succeeded', 'not_food') then
    return jsonb_build_object('status', q.status, 'id', q.id,
      'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at, e.id)
                           from public.food_entries e where e.request_id = q.id and e.status <> 'deleted'), '[]'::jsonb));
  end if;

  update public.recognition_requests set
    status = p_status, route = p_route, output = p_output, error_class = p_error_class,
    completed_at = now(), updated_at = now()
  where id = q.id;

  if p_status = 'succeeded' then
    if coalesce(jsonb_typeof(p_foods), '') <> 'array' then raise exception 'invalid_foods'; end if;
    n := jsonb_array_length(p_foods);
    if n = 0 or n > 12 then raise exception 'invalid_foods'; end if;
    for f in select value from jsonb_array_elements(p_foods) loop
      scale := coalesce((f ->> 'portionScale')::numeric, 1);
      insert into public.food_entries (user_id, request_id, source, name, brand, meal, item,
                                       base_macros, portion_scale, final_macros, entry_date)
      values (p_user, q.id, 'ai-text', f ->> 'name', f ->> 'brand', coalesce(f ->> 'meal', 'snack'),
              coalesce(f -> 'item', '{}'::jsonb), f -> 'baseMacros', scale,
              public.scale_macros(f -> 'baseMacros', scale), public.app_today());
    end loop;
  end if;

  return jsonb_build_object('status', p_status, 'id', q.id,
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at, e.id)
                         from public.food_entries e where e.request_id = q.id and e.status <> 'deleted'), '[]'::jsonb));
end $$;

-- Draft entry for manual input or a recommendation (never counts as a recognition flow).
create or replace function public.create_manual_entry(p_user uuid, p_entry jsonb)
returns public.food_entries
language plpgsql set search_path = public, pg_temp
as $$
declare e public.food_entries; scale numeric := coalesce((p_entry ->> 'portionScale')::numeric, 1);
begin
  if coalesce(p_entry ->> 'source', '') not in ('manual', 'recommendation') then raise exception 'invalid_source'; end if;
  insert into public.food_entries (user_id, source, name, brand, meal, item, base_macros, portion_scale, final_macros, entry_date)
  values (p_user, p_entry ->> 'source', p_entry ->> 'name', p_entry ->> 'brand',
          coalesce(p_entry ->> 'meal', 'snack'), coalesce(p_entry -> 'item', '{}'::jsonb),
          p_entry -> 'baseMacros', scale, public.scale_macros(p_entry -> 'baseMacros', scale), public.app_today())
  returning * into e;
  return e;
end $$;

-- Confirm a draft into today's totals. Idempotent; the first confirmation of a recognition
-- request pins that request to today and is the only one that counts as a flow.
create or replace function public.confirm_entry(p_user uuid, p_entry_id uuid, p_portion_scale numeric default null)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare today date := public.app_today(); d public.daily_activity; e public.food_entries;
        q public.recognition_requests; scale numeric;
begin
  select * into d from public.daily_activity where user_id = p_user and activity_date = today for update;
  if not found or d.targets is null then raise exception 'day_not_ready'; end if;
  if d.finalized_at is not null then raise exception 'day_closed'; end if;

  select * into e from public.food_entries where id = p_entry_id and user_id = p_user for update;
  if not found then raise exception 'entry_not_found'; end if;
  if e.status = 'deleted' then raise exception 'entry_deleted'; end if;
  if e.status = 'confirmed' then
    return jsonb_build_object('entry', to_jsonb(e), 'day', to_jsonb(d));
  end if;

  scale := coalesce(p_portion_scale, e.portion_scale);
  if scale < 0.1 or scale > 10 then raise exception 'invalid_scale'; end if;

  if e.request_id is not null then
    select * into q from public.recognition_requests where id = e.request_id for update;
    if q.first_confirmed_at is null then
      update public.recognition_requests
      set first_confirmed_at = now(), counted_date = today, updated_at = now() where id = q.id;
    end if;
  end if;

  update public.food_entries set
    status = 'confirmed', entry_date = today, confirmed_at = now(),
    portion_scale = scale, final_macros = public.scale_macros(base_macros, scale), updated_at = now()
  where id = e.id returning * into e;

  d := public.recompute_day(p_user, today);
  return jsonb_build_object('entry', to_jsonb(e), 'day', to_jsonb(d));
end $$;

create or replace function public.delete_entry(p_user uuid, p_entry_id uuid)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare today date := public.app_today(); d public.daily_activity; e public.food_entries;
begin
  select * into e from public.food_entries where id = p_entry_id and user_id = p_user;
  if not found then raise exception 'entry_not_found'; end if;
  if e.status = 'deleted' then return jsonb_build_object('entry', to_jsonb(e), 'day', null); end if;

  if e.status = 'draft' then
    update public.food_entries set status = 'deleted', deleted_at = now(), updated_at = now()
    where id = e.id and status = 'draft' returning * into e;
    return jsonb_build_object('entry', to_jsonb(e), 'day', null);
  end if;

  if e.entry_date <> today then raise exception 'day_closed'; end if;
  select * into d from public.daily_activity where user_id = p_user and activity_date = today for update;
  if not found then raise exception 'day_not_ready'; end if;
  if d.finalized_at is not null then raise exception 'day_closed'; end if;

  select * into e from public.food_entries where id = p_entry_id and user_id = p_user for update;
  if e.status <> 'deleted' then
    update public.food_entries set status = 'deleted', deleted_at = now(), updated_at = now()
    where id = e.id returning * into e;
    d := public.recompute_day(p_user, today);
  end if;
  return jsonb_build_object('entry', to_jsonb(e), 'day', to_jsonb(d));
end $$;

create or replace function public.update_entry_portion(p_user uuid, p_entry_id uuid, p_portion_scale numeric)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare today date := public.app_today(); d public.daily_activity; e public.food_entries;
begin
  if p_portion_scale is null or p_portion_scale < 0.1 or p_portion_scale > 10 then raise exception 'invalid_scale'; end if;
  select * into e from public.food_entries where id = p_entry_id and user_id = p_user;
  if not found then raise exception 'entry_not_found'; end if;
  if e.status = 'deleted' then raise exception 'entry_deleted'; end if;

  if e.status = 'draft' then
    update public.food_entries set portion_scale = p_portion_scale,
      final_macros = public.scale_macros(base_macros, p_portion_scale), updated_at = now()
    where id = e.id and status = 'draft' returning * into e;
    return jsonb_build_object('entry', to_jsonb(e), 'day', null);
  end if;

  if e.entry_date <> today then raise exception 'day_closed'; end if;
  select * into d from public.daily_activity where user_id = p_user and activity_date = today for update;
  if not found then raise exception 'day_not_ready'; end if;
  if d.finalized_at is not null then raise exception 'day_closed'; end if;

  select * into e from public.food_entries where id = p_entry_id and user_id = p_user for update;
  if e.status = 'deleted' then raise exception 'entry_deleted'; end if;
  update public.food_entries set portion_scale = p_portion_scale,
    final_macros = public.scale_macros(base_macros, p_portion_scale), updated_at = now()
  where id = e.id returning * into e;
  d := public.recompute_day(p_user, today);
  return jsonb_build_object('entry', to_jsonb(e), 'day', to_jsonb(d));
end $$;

create or replace function public.submit_feedback(p_user uuid, p_dedupe_id uuid, p_kind text, p_message text, p_contact text default null)
returns public.feedback
language plpgsql set search_path = public, pg_temp
as $$
declare f public.feedback; n integer;
begin
  select * into f from public.feedback where user_id = p_user and dedupe_id = p_dedupe_id;
  if found then return f; end if;
  select count(*) into n from public.feedback where user_id = p_user and created_at > now() - interval '24 hours';
  if n >= 10 then raise exception 'rate_limited'; end if;
  insert into public.feedback (user_id, dedupe_id, kind, message, contact)
  values (p_user, p_dedupe_id, p_kind, btrim(p_message), nullif(btrim(coalesce(p_contact, '')), ''))
  on conflict (user_id, dedupe_id) do nothing
  returning * into f;
  if not found then
    select * into f from public.feedback where user_id = p_user and dedupe_id = p_dedupe_id;
  end if;
  return f;
end $$;

-- One-time import of this device's old local records. Past days become finalized, migrated
-- days (no goal snapshot, is_effective stays null, no recognition flows). Re-runnable:
-- entries are keyed by (user_id, client_id). Today's records require a ready day snapshot.
-- payload: {records:[{date, day, foods:[{clientId, name, brand, meal, baseMacros, macros, portionScale, item}]}]}
create or replace function public.import_local_records(p_user uuid, p_payload jsonb)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare today date := public.app_today(); rec jsonb; f jsonb; d date; r public.daily_activity;
        imported integer := 0; skipped_days integer := 0; inserted integer;
begin
  if coalesce(jsonb_typeof(p_payload -> 'records'), '') <> 'array' or jsonb_array_length(p_payload -> 'records') > 400 then
    raise exception 'invalid_payload';
  end if;
  for rec in select value from jsonb_array_elements(p_payload -> 'records') loop
    d := (rec ->> 'date')::date;
    if d > today then raise exception 'invalid_payload'; end if;
    if coalesce(jsonb_typeof(rec -> 'foods'), '') <> 'array' or jsonb_array_length(rec -> 'foods') > 100 then
      raise exception 'invalid_payload';
    end if;

    if d < today then
      insert into public.daily_activity (user_id, activity_date, day_settings, migrated, finalized_at)
      values (p_user, d, coalesce(rec -> 'day', '{}'::jsonb), true, now())
      on conflict (user_id, activity_date) do nothing;
    end if;
    select * into r from public.daily_activity where user_id = p_user and activity_date = d for update;
    if not found or (d = today and r.targets is null) then raise exception 'day_not_ready'; end if;
    if d < today and not r.migrated then skipped_days := skipped_days + 1; continue; end if;
    if d = today and r.finalized_at is not null then raise exception 'day_closed'; end if;

    for f in select value from jsonb_array_elements(rec -> 'foods') loop
      insert into public.food_entries (user_id, client_id, source, name, brand, meal, item, base_macros,
                                       portion_scale, final_macros, status, entry_date, confirmed_at)
      values (p_user, f ->> 'clientId', 'import', f ->> 'name', f ->> 'brand', coalesce(f ->> 'meal', 'snack'),
              coalesce(f -> 'item', '{}'::jsonb), coalesce(f -> 'baseMacros', f -> 'macros'),
              coalesce((f ->> 'portionScale')::numeric, 1), f -> 'macros', 'confirmed', d, now())
      on conflict (user_id, client_id) do nothing;
      get diagnostics inserted = row_count;
      imported := imported + inserted;
    end loop;
    perform public.recompute_day(p_user, d);
  end loop;

  perform public.ensure_profile(p_user);
  update public.profiles set local_import_state = 'imported', updated_at = now() where user_id = p_user;
  return jsonb_build_object('imported', imported, 'skippedDays', skipped_days);
end $$;

-- Finalizes every ended, unfinalized day. Safe to re-run; failures are logged and retried.
create or replace function public.finalize_due_days() returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare r record; ok integer := 0; bad integer := 0; errs jsonb := '[]'::jsonb;
begin
  for r in
    select user_id, activity_date from public.daily_activity
    where finalized_at is null and activity_date < public.app_today()
    order by activity_date, user_id
  loop
    begin
      perform public.recompute_day(r.user_id, r.activity_date, true);
      ok := ok + 1;
    exception when others then
      bad := bad + 1;
      errs := errs || jsonb_build_object('user_id', r.user_id, 'date', r.activity_date, 'error', sqlerrm);
    end;
  end loop;
  if ok + bad > 0 then
    insert into public.job_log (job, processed, failed, detail)
    values ('finalize_due_days', ok, bad, case when bad > 0 then errs end);
  end if;
  return jsonb_build_object('finalized', ok, 'failed', bad);
end $$;

-- Lock the functions down to service_role.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ops views (SQL editor / postgres role only; schema is not exposed through the API)
-- ---------------------------------------------------------------------------

create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;

create view ops.daily_effective_users with (security_invoker = true) as
select d.activity_date,
       count(*) filter (where d.is_effective) as effective_users,
       count(*) as active_users,
       round(avg(d.score) * 100, 1) as avg_score_pct
from public.daily_activity d
join public.profiles p using (user_id)
where not p.is_test and d.finalized_at is not null and not d.migrated
group by d.activity_date
order by d.activity_date desc;

create view ops.recognition_inputs with (security_invoker = true) as
select q.created_at, q.user_id, q.input_text, q.status, q.route, q.error_class,
       q.first_confirmed_at, q.counted_date, q.output
from public.recognition_requests q
join public.profiles p using (user_id)
where not p.is_test
order by q.created_at desc;

create view ops.feedback_inbox with (security_invoker = true) as
select f.created_at, f.status, f.kind, f.message, f.contact, f.user_id
from public.feedback f
join public.profiles p using (user_id)
where not p.is_test
order by f.created_at desc;

revoke all on all tables in schema ops from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedules (UTC). Beijing midnight = 16:00 UTC (China has no DST); the 15-minute sweep
-- catches anything missed and is a no-op when nothing is due.
-- ---------------------------------------------------------------------------

select cron.schedule('finalize-day-midnight-bj', '0 16 * * *', $$select public.finalize_due_days()$$);
select cron.schedule('finalize-day-sweep', '*/15 * * * *', $$select public.finalize_due_days()$$);
