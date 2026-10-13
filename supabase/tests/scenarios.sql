-- Database scenario tests for the Supabase backend.
-- Run as the postgres role (SQL editor / MCP execute_sql). Everything happens inside one DO block and
-- ends with an exception, so no test data is ever committed: success is reported as
--   ERROR: ALL_PASSED: <n> scenarios
-- Any other error message is a failed assertion.

create or replace function pg_temp.tg() returns jsonb language sql as
$$ select '{"protein":100,"carbs":200,"fat":60,"calories":2000,"fiber":30}'::jsonb $$;

create or replace function pg_temp.food(p numeric, k numeric) returns jsonb language sql as
$$ select jsonb_build_object('name', 'test food', 'meal', 'lunch',
     'baseMacros', jsonb_build_object('protein', p, 'carbs', 0, 'fat', 0, 'calories', k, 'fiber', 0)) $$;

create or replace function pg_temp.mk_user(snapshot boolean default true) returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (u, u::text || '@test.invalid');
  if snapshot then
    perform public.upsert_day_snapshot(u, '{}'::jsonb, pg_temp.tg(), '{}'::jsonb);
  end if;
  return u;
end $$;

create or replace function pg_temp.mk_flow(u uuid, foods jsonb) returns jsonb language plpgsql as $$
declare r uuid := gen_random_uuid();
begin
  perform public.begin_recognition(u, r, 'test input ' || r::text);
  return public.complete_recognition(u, r, 'succeeded', 'local_exact', '{}'::jsonb, null, foods);
end $$;

create or replace function pg_temp.expect_err(q text, code text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm = code or sqlstate = code then return; end if;
    raise exception 'wrong error for [%]: got % / %, expected %', q, sqlstate, sqlerrm, code;
  end;
  raise exception 'expected error % but statement succeeded: %', code, q;
end $$;

do $$
declare
  today date := public.app_today();
  passed integer := 0;
  u uuid; u2 uuid; r uuid; res jsonb; d public.daily_activity; e1 uuid; e2 uuid; n integer; ents jsonb;
begin
  -- S1: two confirmed flows and a score of exactly 50% is effective; finalized days are read-only.
  u := pg_temp.mk_user();
  e1 := (pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(50, 1000))) -> 'entries' -> 0 ->> 'id')::uuid;
  e2 := (pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(50, 1000))) -> 'entries' -> 0 ->> 'id')::uuid;
  perform public.confirm_entry(u, e1);
  res := public.confirm_entry(u, e2);
  assert (res -> 'day' ->> 'confirmed_flows')::int = 2, 'S1 flows';
  assert (res -> 'day' ->> 'score')::numeric = 0.5, 'S1 score is exactly 0.5';
  assert (res -> 'day' ->> 'is_effective') is null, 'S1 is_effective stays null during the day';
  d := public.recompute_day(u, today, true);
  assert d.is_effective is true and d.finalized_at is not null, 'S1 effective at exactly 50%';
  perform pg_temp.expect_err(format('select public.confirm_entry(%L, %L)', u, e1), 'day_closed');
  perform pg_temp.expect_err(format('select public.delete_entry(%L, %L)', u, e1), 'day_closed');
  perform pg_temp.expect_err(format('select public.upsert_day_snapshot(%L, ''{}'', %L, ''{}'')', u, pg_temp.tg()), 'day_closed');
  passed := passed + 1;

  -- S2: score 50% but only one flow is not effective.
  u := pg_temp.mk_user();
  e1 := (pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(100, 2000))) -> 'entries' -> 0 ->> 'id')::uuid;
  res := public.confirm_entry(u, e1);
  d := public.recompute_day(u, today, true);
  assert d.confirmed_flows = 1 and d.score = 0.5 and d.is_effective is false, 'S2 one flow is not effective';
  passed := passed + 1;

  -- S3: two flows but 49.99% (unrounded) is not effective.
  u := pg_temp.mk_user();
  e1 := (pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(100, 1000))) -> 'entries' -> 0 ->> 'id')::uuid;
  e2 := (pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(0, 999))) -> 'entries' -> 0 ->> 'id')::uuid;
  perform public.confirm_entry(u, e1);
  perform public.confirm_entry(u, e2);
  d := public.recompute_day(u, today, true);
  assert d.confirmed_flows = 2 and d.score < 0.5 and d.score > 0.4998 and d.is_effective is false, 'S3 49.99% is not effective';
  passed := passed + 1;

  -- S4: multi-food request counts once; double confirm is idempotent.
  u := pg_temp.mk_user();
  ents := pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(30, 500), pg_temp.food(30, 500))) -> 'entries';
  e1 := (ents -> 0 ->> 'id')::uuid;
  e2 := (ents -> 1 ->> 'id')::uuid;
  perform public.confirm_entry(u, e1);
  perform public.confirm_entry(u, e1);
  res := public.confirm_entry(u, e2);
  assert (res -> 'day' ->> 'confirmed_flows')::int = 1, 'S4 one flow for two foods';
  assert (res -> 'day' -> 'totals' ->> 'protein')::numeric = 60, 'S4 totals counted once per entry';
  res := public.confirm_entry(u, e1);
  assert (res -> 'day' ->> 'confirmed_flows')::int = 1 and (res -> 'day' -> 'totals' ->> 'protein')::numeric = 60, 'S4 repeat confirm changes nothing';
  passed := passed + 1;

  -- S5: deleting every counted food removes the flow; a deleted entry cannot be confirmed again.
  u := pg_temp.mk_user();
  e1 := (pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(40, 800))) -> 'entries' -> 0 ->> 'id')::uuid;
  res := public.confirm_entry(u, e1);
  assert (res -> 'day' ->> 'confirmed_flows')::int = 1, 'S5 flow counted';
  res := public.delete_entry(u, e1);
  assert (res -> 'day' ->> 'confirmed_flows')::int = 0 and (res -> 'day' -> 'totals' ->> 'calories')::numeric = 0, 'S5 flow removed';
  perform pg_temp.expect_err(format('select public.confirm_entry(%L, %L)', u, e1), 'entry_deleted');
  res := public.delete_entry(u, e1);
  assert (res -> 'entry' ->> 'status') = 'deleted', 'S5 delete is idempotent';
  passed := passed + 1;

  -- S6: a request belongs to the day of its first confirmation; later foods do not recount it elsewhere.
  u := pg_temp.mk_user();
  ents := pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(10, 100), pg_temp.food(10, 100))) -> 'entries';
  perform public.confirm_entry(u, (ents -> 0 ->> 'id')::uuid);
  update public.recognition_requests set counted_date = today - 1
    where id = (select request_id from public.food_entries where id = (ents -> 0 ->> 'id')::uuid);
  res := public.confirm_entry(u, (ents -> 1 ->> 'id')::uuid);
  assert (res -> 'day' ->> 'confirmed_flows')::int = 0, 'S6 request pinned to its first day is not recounted';
  assert (res -> 'day' -> 'totals' ->> 'protein')::numeric = 20, 'S6 nutrition still counts today';
  passed := passed + 1;

  -- S7: manual and recommendation entries add nutrition but never flows.
  u := pg_temp.mk_user();
  e1 := (pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(0, 0))) -> 'entries' -> 0 ->> 'id')::uuid;
  perform public.confirm_entry(u, e1);
  e2 := (public.create_manual_entry(u, jsonb_build_object('source', 'manual', 'name', 'shake', 'meal', 'snack',
          'baseMacros', jsonb_build_object('protein', 100, 'carbs', 0, 'fat', 0, 'calories', 2000, 'fiber', 0)))).id;
  res := public.confirm_entry(u, e2);
  assert (res -> 'day' ->> 'confirmed_flows')::int = 1 and (res -> 'day' ->> 'score')::numeric = 0.5, 'S7 manual adds score, not flows';
  d := public.recompute_day(u, today, true);
  assert d.is_effective is false, 'S7 one real flow is still ineffective';
  perform pg_temp.expect_err(format('select public.create_manual_entry(%L, %L)', u, '{"source":"ai-text","name":"x","baseMacros":{}}'::jsonb), 'invalid_source');
  passed := passed + 1;

  -- S8: retries reuse the same request and never duplicate foods.
  u := pg_temp.mk_user();
  r := gen_random_uuid();
  assert public.begin_recognition(u, r, 'chicken rice') ->> 'state' = 'new', 'S8 first attempt is new';
  assert public.begin_recognition(u, r, 'chicken rice') ->> 'state' = 'processing', 'S8 second attempt sees processing';
  perform pg_temp.expect_err(format('select public.begin_recognition(%L, %L, %L)', u, r, 'something else'), 'request_conflict');
  res := public.complete_recognition(u, r, 'succeeded', 'ai_estimate', '{"x":1}'::jsonb, null,
           jsonb_build_array(pg_temp.food(20, 300), pg_temp.food(5, 100)));
  assert jsonb_array_length(res -> 'entries') = 2, 'S8 two drafts created';
  ents := res -> 'entries';
  res := public.complete_recognition(u, r, 'succeeded', 'ai_estimate', '{"x":2}'::jsonb, null, jsonb_build_array(pg_temp.food(99, 99)));
  assert jsonb_array_length(res -> 'entries') = 2 and (res -> 'entries' -> 0 ->> 'id') = (ents -> 0 ->> 'id'), 'S8 completion is idempotent';
  res := public.begin_recognition(u, r, 'chicken rice');
  assert res ->> 'state' = 'done' and jsonb_array_length(res -> 'entries') = 2, 'S8 finished request is reused';
  select count(*) into n from public.food_entries where user_id = u;
  assert n = 2, 'S8 no duplicate food rows';
  passed := passed + 1;

  -- S9: failed requests can be retried; stale processing requests are retaken.
  u := pg_temp.mk_user();
  r := gen_random_uuid();
  perform public.begin_recognition(u, r, 'x');
  perform public.complete_recognition(u, r, 'failed', null, null, 'timeout');
  assert public.begin_recognition(u, r, 'x') ->> 'state' = 'new', 'S9 failed request retries';
  assert public.begin_recognition(u, r, 'x') ->> 'state' = 'processing', 'S9 retry is now processing';
  update public.recognition_requests set updated_at = now() - interval '5 minutes' where user_id = u and request_id = r;
  assert public.begin_recognition(u, r, 'x') ->> 'state' = 'new', 'S9 stale processing is retaken';
  perform public.complete_recognition(u, r, 'not_food', 'not_food', '{}'::jsonb);
  res := public.begin_recognition(u, r, 'x');
  assert res ->> 'state' = 'done' and res ->> 'status' = 'not_food', 'S9 not_food result reused';
  passed := passed + 1;

  -- S10: rate limit.
  u := pg_temp.mk_user();
  for n in 1..60 loop
    perform public.begin_recognition(u, gen_random_uuid(), 'bulk ' || n);
  end loop;
  perform pg_temp.expect_err(format('select public.begin_recognition(%L, %L, %L)', u, gen_random_uuid(), 'one more'), 'rate_limited');
  passed := passed + 1;

  -- S11: the sweep finalizes ended days once, atomically, and re-runs are no-ops.
  u := pg_temp.mk_user(false);
  insert into public.daily_activity (user_id, activity_date, targets) values (u, today - 2, pg_temp.tg());
  for n in 1..2 loop
    r := gen_random_uuid();
    insert into public.recognition_requests (id, user_id, request_id, input_text, status, first_confirmed_at, counted_date)
    values (r, u, r, 'past', 'succeeded', now() - interval '2 days', today - 2);
    insert into public.food_entries (user_id, request_id, source, name, meal, base_macros, final_macros, status, entry_date, confirmed_at)
    values (u, r, 'ai-text', 'past food', 'lunch', pg_temp.tg(), pg_temp.tg(), 'confirmed', today - 2, now() - interval '2 days');
  end loop;
  res := public.finalize_due_days();
  assert (res ->> 'finalized')::int >= 1 and (res ->> 'failed')::int = 0, 'S11 sweep finalized';
  select * into d from public.daily_activity where user_id = u and activity_date = today - 2;
  assert d.finalized_at is not null and d.is_effective is true and d.confirmed_flows = 2 and d.score = 1, 'S11 past day is effective';
  e1 := d.id;
  res := public.finalize_due_days();
  assert (res ->> 'finalized')::int = 0, 'S11 re-run has nothing to do';
  select * into d from public.daily_activity where id = e1;
  assert d.is_effective is true, 'S11 result unchanged on re-run';
  perform pg_temp.expect_err(format('select public.delete_entry(%L, %L)', u,
    (select id from public.food_entries where user_id = u limit 1)), 'day_closed');
  passed := passed + 1;

  -- S12: a failure on one day is logged and does not block the others.
  u := pg_temp.mk_user(false);
  insert into public.daily_activity (user_id, activity_date, targets) values (u, today - 3, pg_temp.tg());
  res := public.finalize_due_days();
  assert (res ->> 'finalized')::int >= 1, 'S12 empty ended day finalizes as not effective';
  select * into d from public.daily_activity where user_id = u and activity_date = today - 3;
  assert d.is_effective is false and d.finalized_at is not null, 'S12 inactive day is not effective';
  passed := passed + 1;

  -- S13: local import is idempotent, creates migrated days, never fakes effectiveness or flows.
  u := pg_temp.mk_user();
  res := public.import_local_records(u, jsonb_build_object('records', jsonb_build_array(
    jsonb_build_object('date', (today - 5)::text, 'day', '{}'::jsonb, 'foods', jsonb_build_array(
      jsonb_build_object('clientId', 'f1', 'name', 'old a', 'meal', 'lunch',
        'macros', jsonb_build_object('protein', 50, 'carbs', 100, 'fat', 20, 'calories', 800, 'fiber', 5)),
      jsonb_build_object('clientId', 'f2', 'name', 'old b', 'meal', 'dinner',
        'macros', jsonb_build_object('protein', 60, 'carbs', 100, 'fat', 30, 'calories', 900, 'fiber', 8)))))));
  assert (res ->> 'imported')::int = 2, 'S13 imported two foods';
  res := public.import_local_records(u, jsonb_build_object('records', jsonb_build_array(
    jsonb_build_object('date', (today - 5)::text, 'foods', jsonb_build_array(
      jsonb_build_object('clientId', 'f1', 'name', 'old a', 'meal', 'lunch',
        'macros', jsonb_build_object('protein', 50, 'carbs', 100, 'fat', 20, 'calories', 800, 'fiber', 5)))))));
  assert (res ->> 'imported')::int = 0, 'S13 re-import adds nothing';
  select * into d from public.daily_activity where user_id = u and activity_date = today - 5;
  assert d.migrated and d.finalized_at is not null and d.is_effective is null and d.confirmed_flows = 0 and d.score is null, 'S13 migrated day has no verdict';
  assert (d.totals ->> 'calories')::numeric = 1700, 'S13 migrated totals';
  perform public.finalize_due_days();
  select * into d from public.daily_activity where user_id = u and activity_date = today - 5;
  assert d.is_effective is null, 'S13 sweep leaves migrated days without a verdict';
  assert (select local_import_state from public.profiles where user_id = u) = 'imported', 'S13 import state recorded';
  passed := passed + 1;

  -- S14: readiness and ownership checks.
  u := pg_temp.mk_user(false);
  u2 := pg_temp.mk_user();
  e1 := (pg_temp.mk_flow(u2, jsonb_build_array(pg_temp.food(10, 100))) -> 'entries' -> 0 ->> 'id')::uuid;
  perform pg_temp.expect_err(format('select public.confirm_entry(%L, %L)', u, e1), 'day_not_ready');
  perform public.upsert_day_snapshot(u, '{}', pg_temp.tg(), '{}');
  perform pg_temp.expect_err(format('select public.confirm_entry(%L, %L)', u, e1), 'entry_not_found');
  perform pg_temp.expect_err(format('select public.delete_entry(%L, %L)', u, e1), 'entry_not_found');
  perform pg_temp.expect_err(format('select public.upsert_day_snapshot(%L, ''{}'', %L, ''{}'')', u,
    '{"protein":100,"carbs":200,"fat":60,"calories":0,"fiber":30}'::jsonb), 'invalid_targets');
  assert public.weighted_score(pg_temp.tg(), pg_temp.tg()) = 1, 'S14 five items at target score 100%';
  assert public.weighted_score('{"protein":999,"carbs":999,"fat":999,"calories":2000,"fiber":999}'::jsonb, pg_temp.tg()) = 1, 'S14 overshoot adds nothing';
  passed := passed + 1;

  -- S15: profile version conflicts and feedback de-duplication.
  u := pg_temp.mk_user();
  assert (public.ensure_profile(u)).version = 1, 'S15 initial version';
  assert (public.upsert_profile(u, '{"heightCm":172,"weightKg":68,"gender":"male","age":28,"bmrKcal":1630,"goal":"muscle","targetWeightKg":72}'::jsonb, 1)).version = 2, 'S15 first save';
  perform pg_temp.expect_err(format('select public.upsert_profile(%L, %L, 1)', u,
    '{"heightCm":172,"weightKg":68,"gender":"male","age":28,"bmrKcal":1630,"goal":"muscle","targetWeightKg":72}'::jsonb), 'version_conflict');
  perform pg_temp.expect_err(format('select public.upsert_profile(%L, %L, 2)', u, '{"heightCm":172}'::jsonb), 'invalid_profile');
  r := gen_random_uuid();
  perform public.submit_feedback(u, r, 'issue', 'it crashed', null);
  perform public.submit_feedback(u, r, 'issue', 'it crashed', null);
  select count(*) into n from public.feedback where user_id = u;
  assert n = 1, 'S15 duplicate submit stored once';
  perform pg_temp.expect_err(format('select public.submit_feedback(%L, %L, ''bogus'', ''hello'', null)', u, gen_random_uuid()), '23514');
  passed := passed + 1;

  -- S16: row isolation and locked-down privileges for browser roles.
  u := pg_temp.mk_user();
  u2 := pg_temp.mk_user();
  e1 := (pg_temp.mk_flow(u, jsonb_build_array(pg_temp.food(10, 100))) -> 'entries' -> 0 ->> 'id')::uuid;
  perform public.confirm_entry(u, e1);
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.food_entries where user_id = u;
  assert n = 0, 'S16 user B cannot read user A food entries';
  select count(*) into n from public.daily_activity where user_id = u;
  assert n = 0, 'S16 user B cannot read user A daily activity';
  select count(*) into n from public.recognition_requests where user_id = u;
  assert n = 0, 'S16 user B cannot read user A recognition requests';
  select count(*) into n from public.profiles where user_id = u;
  assert n = 0, 'S16 user B cannot read user A profile';
  begin
    update public.daily_activity set is_effective = true;
    raise exception 'S16 direct update unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.food_entries (user_id, source, name, meal, base_macros, final_macros, entry_date)
      values (u2, 'manual', 'x', 'lunch', '{"protein":0,"carbs":0,"fat":0,"calories":0,"fiber":0}', '{"protein":0,"carbs":0,"fat":0,"calories":0,"fiber":0}', current_date);
    raise exception 'S16 direct insert unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.confirm_entry(u, e1);
    raise exception 'S16 rpc unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.job_log;
    raise exception 'S16 job_log unexpectedly readable';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from ops.recognition_inputs;
    raise exception 'S16 ops views unexpectedly readable';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  select count(*) into n from public.food_entries;
  assert n = 1, 'S16 user A sees exactly their own entry';
  reset role;
  passed := passed + 1;

  raise exception 'ALL_PASSED: % scenarios', passed;
end $$;
