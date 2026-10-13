// End-to-end API smoke test against a running dev server and the real Supabase project.
//   Terminal 1: npm run dev          Terminal 2: npm run api:smoke   (BASE_URL defaults to http://localhost:3000)
// Creates two throwaway test users, signs them in with admin-generated one-time codes (no email, no
// login bypass in the app), drives the HTTP API with their session cookies, then deletes both users.
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret || [publishable, secret].some((value) => value.startsWith('op://'))) {
  console.error('Missing or unresolved Supabase env vars. Run through `npm run api:smoke`.');
  process.exit(2);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); };
const created = [];

async function signIn(label) {
  const email = `api-smoke-${label}-${Date.now()}@test.invalid`;
  const user = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (user.error) throw user.error;
  created.push(user.data.user.id);
  await admin.rpc('ensure_profile', { p_user: user.data.user.id });
  await admin.from('profiles').update({ is_test: true }).eq('user_id', user.data.user.id);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const jar = new Map();
  const client = createServerClient(url, publishable, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)) }
  });
  const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (verified.error) throw verified.error;
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  return { id: user.data.user.id, cookie, email };
}

async function api(who, method, path, body) {
  const headers = { ...(who ? { Cookie: who.cookie } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) };
  const response = await fetch(`${base}${path}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

const profile = { heightCm: 172, weightKg: 68, gender: 'male', age: 28, bmrKcal: 1630, goal: 'muscle', targetWeightKg: 72, bodyFat: 18, targetBodyFat: 15, trainingStyle: '三分化', eatingPattern: '三餐正常' };
const day = { isTrainingDay: true, trainingPart: '全身', intensity: 'medium', trainingSets: 10, durationMinutes: 60, dietStatus: 'normal' };
const shake = { id: 'local-1', name: '蛋白奶昔', foodType: '饮品', portionLabel: '1 份', portionScale: 1, meal: 'snack', source: 'manual',
  baseMacros: { protein: 30, carbs: 10, fat: 3, calories: 180, fiber: 1 }, macros: { protein: 30, carbs: 10, fat: 3, calories: 180, fiber: 1 }, loggedAt: new Date().toISOString() };

try {
  const health = await fetch(`${base}/api/session`).catch(() => null);
  if (!health) { console.error(`No server at ${base}. Start it with npm run dev first.`); process.exit(2); }

  const a = await signIn('a');
  const b = await signIn('b');

  let r = await api(null, 'POST', '/api/sync');
  check('unauthenticated sync is rejected (401)', r.status === 401, r.status);

  r = await api(a, 'POST', '/api/sync');
  check('new account syncs with no profile', r.status === 200 && r.json.state.setupCompleted === false && r.json.state.profile === null, JSON.stringify(r.json)?.slice(0, 200));
  const today = r.json?.state?.today;
  check('server reports a Beijing date', /^\d{4}-\d{2}-\d{2}$/.test(today ?? ''), today);

  r = await api(a, 'POST', '/api/entries', { source: 'manual', food: shake, confirm: true });
  check('confirming before the profile exists is refused (409 day_not_ready)', r.status === 409 && r.json.code === 'day_not_ready', JSON.stringify(r.json));

  r = await api(a, 'PUT', '/api/profile', { profile: { ...profile, weightKg: 9999 }, day });
  check('out-of-range profile is rejected (400)', r.status === 400, r.status);
  r = await api(a, 'PUT', '/api/profile', { profile, day, expectedVersion: null });
  check('profile saved and today snapshot created', r.status === 200 && r.json.day?.targets?.calories > 0 && r.json.profileVersion >= 2, JSON.stringify(r.json)?.slice(0, 200));
  const firstVersion = r.json?.profileVersion;
  const trainingTargets = r.json?.day?.targets;

  r = await api(a, 'PUT', '/api/profile', { profile, day, expectedVersion: firstVersion - 1 });
  check('stale profile version conflicts (409)', r.status === 409 && r.json.code === 'version_conflict', JSON.stringify(r.json));

  r = await api(a, 'PUT', '/api/day', { day: { ...day, isTrainingDay: false, dietStatus: 'low_carb' } });
  check('changing today recomputes the goal snapshot', r.status === 200 && r.json.day.targets.calories !== trainingTargets.calories, JSON.stringify(r.json)?.slice(0, 200));

  r = await api(a, 'POST', '/api/entries', { source: 'manual', food: shake, confirm: true });
  const entryId = r.json?.food?.id;
  check('manual entry created and confirmed with a cloud id', r.status === 200 && r.json.food.cloud === true && r.json.food.savedToCalendar === true && entryId !== 'local-1', JSON.stringify(r.json)?.slice(0, 200));
  check('day totals reflect the confirmed entry', r.json?.day?.totals?.protein === 30 && r.json?.day?.flows === 0, JSON.stringify(r.json?.day));

  r = await api(a, 'POST', `/api/entries/${entryId}/confirm`, {});
  check('confirming again changes nothing', r.status === 200 && r.json.day.totals.protein === 30);

  r = await api(b, 'DELETE', `/api/entries/${entryId}`);
  check("another user cannot delete someone else's entry (404)", r.status === 404, r.status);
  r = await api(b, 'POST', `/api/entries/${entryId}/confirm`, {});
  check("another user cannot confirm someone else's entry", r.status === 404 || r.status === 409, r.status);
  r = await api(b, 'POST', '/api/sync');
  check('another user sees none of those foods', r.status === 200 && r.json.state.foods.length === 0);

  r = await api(a, 'POST', '/api/sync');
  check('sync returns the confirmed entry and today row', r.json.state.foods.some((food) => food.id === entryId && food.savedToCalendar) && r.json.state.days[today]?.totals.protein === 30);

  r = await api(a, 'DELETE', `/api/entries/${entryId}`);
  check('deleting a confirmed entry today works and totals drop', r.status === 200 && r.json.day.totals.protein === 0 && r.json.day.totals.calories === 0 && r.json.food.savedToCalendar === false, JSON.stringify(r.json)?.slice(0, 200));
  r = await api(a, 'POST', `/api/entries/${entryId}/confirm`, {});
  check('a deleted entry cannot be confirmed again (409)', r.status === 409 && r.json.code === 'entry_deleted', JSON.stringify(r.json));

  // Recognition: authentication, request ids, persistence and reuse.
  const form = (requestId, text = '一个苹果') => { const f = new FormData(); f.append('description', text); f.append('lang', 'zh'); if (requestId) f.append('requestId', requestId); return f; };
  r = await api(null, 'POST', '/api/food-ai', form(crypto.randomUUID()));
  check('recognition requires a session (401)', r.status === 401, r.status);
  r = await api(a, 'POST', '/api/food-ai', form(null));
  check('recognition requires a request id (400)', r.status === 400, r.status);

  const requestId = crypto.randomUUID();
  r = await api(a, 'POST', '/api/food-ai', form(requestId));
  const recognizedOk = r.status === 200 && r.json?.ok === true && r.json.isFoodRelated === true && r.json.foods?.length > 0;
  check('recognition succeeds and returns saved drafts with cloud ids', recognizedOk && r.json.foods.every((food) => food.cloud === true && food.savedToCalendar === false), `${r.status} ${JSON.stringify(r.json)?.slice(0, 200)}`);
  if (recognizedOk) {
    const ids = r.json.foods.map((food) => food.id);
    const again = await api(a, 'POST', '/api/food-ai', form(requestId));
    check('retrying with the same request id reuses the result (no duplicate foods)', again.status === 200 && JSON.stringify(again.json.foods.map((food) => food.id)) === JSON.stringify(ids), `${again.status} ${JSON.stringify(again.json)?.slice(0, 160)}`);
    const clash = await api(a, 'POST', '/api/food-ai', form(requestId, '一杯拿铁'));
    check('same request id with different text is refused (409)', clash.status === 409, clash.status);

    const synced = await api(a, 'POST', '/api/sync');
    const drafts = synced.json.state.foods.filter((food) => ids.includes(food.id));
    check('drafts survive a refresh (cross-device recovery)', drafts.length === ids.length && drafts.every((food) => !food.savedToCalendar));

    const first = await api(a, 'POST', `/api/entries/${ids[0]}/confirm`, {});
    check('confirming a recognized food counts exactly one flow', first.status === 200 && first.json.day.flows === 1, JSON.stringify(first.json?.day));
    if (ids.length > 1) {
      const second = await api(a, 'POST', `/api/entries/${ids[1]}/confirm`, {});
      check('confirming a second food of the same recognition does not add a flow', second.json.day.flows === 1, JSON.stringify(second.json?.day));
    }
  }

  // ---- Feedback ----
  const dedupeId = crypto.randomUUID();
  const feedback = { dedupeId, kind: 'issue', message: '按钮点了没反应', contact: ' me@example.com ' };
  r = await api(null, 'POST', '/api/feedback', feedback);
  check('feedback requires a session (401)', r.status === 401, r.status);
  r = await api(a, 'POST', '/api/feedback', { ...feedback, kind: 'spam' });
  check('feedback with an unknown type is rejected (400)', r.status === 400, r.status);
  r = await api(a, 'POST', '/api/feedback', { ...feedback, message: ' x ' });
  check('too-short feedback is rejected (400)', r.status === 400, r.status);
  r = await api(a, 'POST', '/api/feedback', feedback);
  const feedbackId = r.json?.id;
  check('feedback is stored and returns its id', r.status === 200 && Boolean(feedbackId), JSON.stringify(r.json));
  r = await api(a, 'POST', '/api/feedback', feedback);
  check('submitting the same feedback twice returns the same row', r.status === 200 && r.json.id === feedbackId);
  const stored = await admin.from('feedback').select('message,contact,status').eq('user_id', a.id);
  check('exactly one private row with trimmed contact and status new', stored.data?.length === 1 && stored.data[0].contact === 'me@example.com' && stored.data[0].status === 'new', JSON.stringify(stored.data));

  // ---- Local import ----
  const shift = (key, days) => { const d = new Date(`${key}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const food = (clientId, name, calories) => ({ clientId, name, meal: 'lunch', baseMacros: { protein: 20, carbs: 30, fat: 5, calories, fiber: 3 }, macros: { protein: 20, carbs: 30, fat: 5, calories, fiber: 3 }, portionScale: 1, item: { nameEn: name } });
  const records = [
    { date: shift(today, -6), day, foods: [food('d6:a', '旧记录甲', 400)] },
    { date: shift(today, -5), day, foods: [food('d5:a', '旧记录乙', 300), food('d5:b', '旧记录丙', 200)] },
    { date: today, day, foods: [food('t:a', '今天的旧记录', 100)] }
  ];
  const todayBefore = (await api(a, 'POST', '/api/sync')).json.state.days[today];
  r = await api(a, 'POST', '/api/import', { records: [{ date: shift(today, 3), foods: [] }] });
  check('importing a future day is rejected (400)', r.status === 400, r.status);
  r = await api(a, 'POST', '/api/import', { records });
  check('local records import (past days and today)', r.status === 200 && r.json.imported === 4, JSON.stringify(r.json));
  r = await api(a, 'POST', '/api/import', { records });
  check('importing again adds nothing', r.status === 200 && r.json.imported === 0, JSON.stringify(r.json));
  r = await api(a, 'POST', '/api/sync');
  const old = r.json.state.days[shift(today, -5)];
  check('imported past days are finalized, migrated and carry no verdict or flows', old?.migrated === true && old.finalized === true && old.effective === null && old.flows === 0 && old.score === null && old.totals.calories === 500, JSON.stringify(old));
  check('today import adds nutrition but never a recognition flow', r.json.state.days[today].totals.calories === todayBefore.totals.calories + 100 && r.json.state.days[today].flows === todayBefore.flows, JSON.stringify([todayBefore, r.json.state.days[today]]));
  check('import state is recorded as imported', r.json.state.localImportState === 'imported');

  // ---- Skip, then account deletion with cascade ----
  r = await api(b, 'PUT', '/api/profile', { profile, day, expectedVersion: null });
  r = await api(b, 'POST', '/api/entries', { source: 'manual', food: shake, confirm: true });
  await api(b, 'POST', '/api/feedback', { dedupeId: crypto.randomUUID(), kind: 'other', message: '要被删除的反馈' });
  const bForm = new FormData(); bForm.append('description', '一碗米饭'); bForm.append('lang', 'zh'); bForm.append('requestId', crypto.randomUUID());
  await api(b, 'POST', '/api/food-ai', bForm);
  r = await api(b, 'POST', '/api/import', { skip: true });
  check('declining the import is recorded', r.status === 200 && (await admin.from('profiles').select('local_import_state').eq('user_id', b.id).single()).data.local_import_state === 'skipped');

  const rows = async (id) => {
    const counts = {};
    for (const table of ['profiles', 'daily_activity', 'food_entries', 'recognition_requests', 'feedback']) {
      counts[table] = (await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', id)).count;
    }
    return counts;
  };
  const before = await rows(b.id);
  check('the account has data before deletion', before.profiles === 1 && before.food_entries >= 1 && before.feedback === 1 && before.daily_activity >= 1, JSON.stringify(before));
  r = await api(null, 'DELETE', '/api/account', { confirm: b.email });
  check('account deletion requires a session (401)', r.status === 401, r.status);
  r = await api(b, 'DELETE', '/api/account', { confirm: 'someone-else@example.com' });
  check('deletion with the wrong email is refused (400)', r.status === 400 && r.json.code === 'confirm_mismatch', JSON.stringify(r.json));
  check('nothing was deleted by the refused request', (await rows(b.id)).profiles === 1);
  r = await api(b, 'DELETE', '/api/account', { confirm: b.email.toUpperCase() });
  check('deletion with the typed email succeeds', r.status === 200, JSON.stringify(r.json));
  const after = await rows(b.id);
  check('profile, days, foods, recognitions and feedback are all gone', Object.values(after).every((n) => n === 0), JSON.stringify(after));
  r = await api(b, 'POST', '/api/sync');
  check('the deleted account can no longer use its old session', r.status === 401, r.status);
  check('other users are untouched by that deletion', (await rows(a.id)).profiles === 1);
} catch (error) {
  check('smoke run completed without exceptions', false, error?.message ?? String(error));
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id);
  console.log(`cleaned up ${created.length} test users`);
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
