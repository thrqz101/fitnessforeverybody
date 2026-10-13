-- get_cloud_state: shape, window, and which entries are included. Rolled back; success is reported as
--   ERROR: ALL_PASSED: cloud_state
do $$
declare
  u uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); today date := public.app_today(); s jsonb;
  tg jsonb := '{"protein":100,"carbs":200,"fat":60,"calories":2000,"fiber":30}';
  m jsonb := '{"protein":10,"carbs":10,"fat":1,"calories":100,"fiber":1}';
begin
  insert into auth.users (id, email) values (u, u::text || '@test.invalid'), (u2, u2::text || '@test.invalid');
  s := public.get_cloud_state(u);
  assert s -> 'profile' ->> 'setup_completed' = 'false' and s ->> 'today' = today::text, 'new account: empty profile and Beijing today';
  assert jsonb_array_length(s -> 'days') = 0 and jsonb_array_length(s -> 'entries') = 0, 'new account: nothing else';

  perform public.upsert_day_snapshot(u, '{}'::jsonb, tg, '{}'::jsonb);
  -- today: one confirmed, one draft, one deleted; yesterday-ish: one confirmed, one stale draft; far past: outside the window
  insert into public.food_entries (user_id, source, name, meal, base_macros, final_macros, status, entry_date, confirmed_at) values
    (u, 'manual', 'confirmed today', 'lunch', m, m, 'confirmed', today, now()),
    (u, 'manual', 'draft today', 'lunch', m, m, 'draft', today, null),
    (u, 'manual', 'deleted today', 'lunch', m, m, 'deleted', today, null),
    (u, 'manual', 'confirmed old', 'lunch', m, m, 'confirmed', today - 10, now()),
    (u, 'manual', 'stale draft', 'lunch', m, m, 'draft', today - 1, null),
    (u, 'manual', 'outside window', 'lunch', m, m, 'confirmed', today - 500, now()),
    (u2, 'manual', 'someone else', 'lunch', m, m, 'confirmed', today, now());
  insert into public.daily_activity (user_id, activity_date, targets, finalized_at, migrated) values
    (u, today - 10, tg, now(), false), (u, today - 500, tg, now(), false);

  s := public.get_cloud_state(u);
  assert jsonb_array_length(s -> 'days') = 2, 'days: today and the in-window past day only';
  assert (s -> 'days' -> 0 ->> 'activity_date') = today::text, 'days are newest first';
  assert (select array_agg(e ->> 'name' order by e ->> 'name') from jsonb_array_elements(s -> 'entries') e)
       = array['confirmed old', 'confirmed today', 'draft today'], 'entries: confirmed in window + today''s draft, no deleted / stale / foreign rows';
  assert (select count(*) from jsonb_array_elements(s -> 'entries') e where e ->> 'user_id' <> u::text) = 0, 'only the caller''s rows';

  s := public.get_cloud_state(u, 400, 1);
  assert jsonb_array_length(s -> 'entries') = 1, 'entry limit is honoured';

  begin
    set local role authenticated;
    perform public.get_cloud_state(u);
    raise exception 'browser role unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  reset role;

  raise exception 'ALL_PASSED: cloud_state';
end $$;
