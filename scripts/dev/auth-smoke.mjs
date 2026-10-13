// Real-backend auth smoke test. Run with: npm run auth:smoke (resolves op:// references via op run).
// Creates a throwaway test user, signs in with a one-time code generated through the admin API
// (no email is sent and no login bypass exists in the app), checks RLS and the service-only
// functions as that user, then deletes the user. Credentials only live in this process.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret || [publishable, secret].some((value) => value.startsWith('op://'))) {
  console.error('Missing or unresolved Supabase env vars. Run through `npm run auth:smoke`.');
  process.exit(2);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `smoke+${Date.now()}@test.invalid`;
let userId;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); };

try {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  await admin.rpc('ensure_profile', { p_user: userId });
  await admin.from('profiles').update({ is_test: true }).eq('user_id', userId);

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const otp = link.data.properties.email_otp;
  check('admin generated a 6-digit code', /^\d{6}$/.test(otp), String(otp).length);

  const wrong = await client.auth.verifyOtp({ email, token: otp === '000000' ? '111111' : '000000', type: 'email' });
  check('wrong code is rejected', Boolean(wrong.error));

  const verified = await client.auth.verifyOtp({ email, token: otp, type: 'email' });
  check('correct code signs in', !verified.error && verified.data.user?.id === userId, verified.error?.message);

  const me = await client.auth.getUser();
  check('session resolves to the same user id', me.data.user?.id === userId);

  const own = await client.from('profiles').select('user_id,setup_completed').eq('user_id', userId);
  check('user can read own profile through RLS', own.data?.length === 1, own.error?.message);

  const others = await client.from('profiles').select('user_id').neq('user_id', userId);
  check('user sees no other profiles', (others.data ?? []).length === 0, others.error?.message);

  const write = await client.from('profiles').update({ is_test: false, version: 99 }).eq('user_id', userId);
  check('direct table update is denied', Boolean(write.error), 'update unexpectedly succeeded');

  const rpc = await client.rpc('confirm_entry', { p_user: userId, p_entry_id: crypto.randomUUID() });
  check('write functions are not callable by the signed-in user', Boolean(rpc.error) && /permission denied/i.test(rpc.error.message), rpc.error?.message);

  const anon = await createClient(url, publishable, { auth: { persistSession: false } }).from('profiles').select('user_id');
  check('anonymous callers see nothing', (anon.data ?? []).length === 0);

  const out = await client.auth.signOut();
  check('sign out succeeds', !out.error, out.error?.message);
  const after = await client.from('profiles').select('user_id').eq('user_id', userId);
  check('signed-out client no longer reads the profile', (after.data ?? []).length === 0);
} catch (error) {
  check('smoke run completed without exceptions', false, error?.message ?? String(error));
} finally {
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId);
    check('test user deleted (cascade clears its rows)', !removed.error, removed.error?.message);
  }
}

const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
