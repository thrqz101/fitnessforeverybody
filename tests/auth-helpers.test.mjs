import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAuthError, isPlausibleEmail, normalizeOtp, resendSecondsLeft, safeNextPath } from '../src/shared/auth/helpers.ts';

test('email validation accepts normal addresses and rejects junk', () => {
  assert.equal(isPlausibleEmail('  a.b+c@example.com '), true);
  for (const bad of ['', 'a', 'a@b', 'a@b.c', 'a b@example.com', 'a@@example.com']) assert.equal(isPlausibleEmail(bad), false, bad);
});

test('otp input keeps six digits only', () => {
  assert.equal(normalizeOtp('123 456'), '123456');
  assert.equal(normalizeOtp('12a3-4567'), '123456');
  assert.equal(normalizeOtp(''), '');
});

test('post-login redirects stay on this site', () => {
  assert.equal(safeNextPath('/workspace?view=calendar'), '/workspace?view=calendar');
  for (const bad of [null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'workspace']) {
    assert.equal(safeNextPath(bad), '/workspace', String(bad));
  }
});

test('resend countdown never goes negative and stops at 60 seconds', () => {
  assert.equal(resendSecondsLeft(1000, 1000), 60);
  assert.equal(resendSecondsLeft(1000, 31_000), 30);
  assert.equal(resendSecondsLeft(1000, 61_000), 0);
  assert.equal(resendSecondsLeft(1000, 999_000), 0);
});

test('auth errors map to user-facing categories', () => {
  assert.equal(classifyAuthError({ status: 429, code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 45 seconds.' }), 'rate_limited');
  assert.equal(classifyAuthError({ status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' }), 'invalid_code');
  assert.equal(classifyAuthError({ status: 400, code: 'email_address_invalid', message: 'Email address "x" is invalid' }), 'invalid_email');
  assert.equal(classifyAuthError({ status: 0, message: 'Failed to fetch' }), 'network');
  assert.equal(classifyAuthError(null), 'unknown');
});
