import assert from 'node:assert/strict';
import test from 'node:test';
import { lib } from './helpers/load-ts.mjs';

const { parseFeedback, parseProfile, parseDay, coerceDay } = lib('shared/api/validate.ts');
const { legacyToImport, sanitizeImport } = lib('shared/api/import.ts');
const { entryRowToFood, foodToEntryPayload, sanitizeMacros } = lib('shared/api/mappers.ts');
const { mapRpcError } = lib('shared/api/errors.ts');

const macros = { protein: 20, carbs: 30, fat: 5, calories: 250, fiber: 3 };
const uuid = '11111111-1111-4111-8111-111111111111';
const profile = { heightCm: 172, weightKg: 68, gender: 'male', age: 28, bmrKcal: 1630, goal: 'muscle', targetWeightKg: 72, trainingStyle: '三分化', eatingPattern: '三餐正常' };
const day = { isTrainingDay: true, trainingPart: '全身', intensity: 'medium', trainingSets: 10, durationMinutes: 60, dietStatus: 'normal' };

test('feedback input is trimmed, bounded and needs a stable dedupe id', () => {
  assert.deepEqual(parseFeedback({ dedupeId: uuid, kind: 'issue', message: '  hello  ', contact: '  ' }), { dedupeId: uuid, kind: 'issue', message: 'hello', contact: null });
  for (const bad of [null, {}, { dedupeId: 'x', kind: 'issue', message: 'hello' }, { dedupeId: uuid, kind: 'spam', message: 'hello' },
    { dedupeId: uuid, kind: 'other', message: ' a ' }, { dedupeId: uuid, kind: 'other', message: 'x'.repeat(2001) },
    { dedupeId: uuid, kind: 'other', message: 'ok', contact: 5 }, { dedupeId: uuid, kind: 'other', message: 'ok', contact: 'x'.repeat(201) }]) {
    assert.equal(parseFeedback(bad), null, JSON.stringify(bad)?.slice(0, 60));
  }
});

test('profile and day validation reject out-of-range or malformed values', () => {
  assert.ok(parseProfile(profile));
  assert.equal(parseProfile({ ...profile, weightKg: 9999 }), null);
  assert.equal(parseProfile({ ...profile, goal: 'bulk' }), null);
  assert.equal(parseProfile({ ...profile, age: 28.5 }), null);
  assert.equal(parseProfile({ ...profile, macroMultipliers: { protein: 9, carbs: 3, fat: 0.7 } }), null);
  assert.ok(parseProfile({ ...profile, macroMultipliers: { protein: 1.8, carbs: 3, fat: 0.7 }, fiberGrams: 30 }));
  assert.ok(parseDay(day));
  assert.equal(parseDay({ ...day, intensity: 'extreme' }), null);
  assert.equal(coerceDay({ intensity: 'extreme' }).intensity, 'medium');
});

test('macros must be complete, finite and non-negative', () => {
  assert.deepEqual(sanitizeMacros(macros), macros);
  for (const bad of [null, {}, { ...macros, fat: -1 }, { ...macros, protein: 'a' }, { ...macros, calories: 1e9 }, { ...macros, fiber: NaN }]) assert.equal(sanitizeMacros(bad), null);
});

test('foods round-trip through the entry payload and row mapping', () => {
  const food = { id: 'local-1', name: '燕麦', brand: '品牌', foodType: '主食', portionLabel: '一碗', portionScale: 1.5, meal: 'breakfast', source: 'manual',
    baseMacros: macros, macros, loggedAt: '2026-10-13T00:00:00Z', savedToCalendar: false, nameEn: 'Oats' };
  const payload = foodToEntryPayload(food, 'manual');
  assert.equal(payload.portionScale, 1.5);
  assert.equal(payload.item.nameEn, 'Oats');
  for (const key of ['id', 'macros', 'baseMacros', 'savedToCalendar', 'loggedAt', 'source']) assert.equal(key in payload.item, false, key);
  const row = { id: uuid, request_id: null, source: 'manual', name: payload.name, brand: payload.brand, meal: payload.meal, item: payload.item,
    base_macros: macros, portion_scale: 1.5, final_macros: macros, status: 'confirmed', entry_date: '2026-10-13', confirmed_at: '2026-10-13T01:00:00Z', created_at: '2026-10-13T00:00:00Z' };
  const back = entryRowToFood(row);
  assert.equal(back.id, uuid);
  assert.equal(back.savedToCalendar, true);
  assert.equal(back.cloud, true);
  assert.equal(back.entryDate, '2026-10-13');
  assert.equal(back.nameEn, 'Oats');
  assert.equal(foodToEntryPayload({ ...food, baseMacros: undefined, macros: { protein: -1 } }, 'manual').baseMacros, null);
});

test('database errors map to stable status codes and never leak messages', () => {
  assert.deepEqual(mapRpcError({ message: 'day_closed' }), { status: 409, code: 'day_closed' });
  assert.deepEqual(mapRpcError({ message: 'entry_not_found' }), { status: 404, code: 'entry_not_found' });
  assert.deepEqual(mapRpcError({ message: 'rate_limited' }), { status: 429, code: 'rate_limited' });
  assert.deepEqual(mapRpcError({ message: 'invalid_targets' }), { status: 400, code: 'invalid_input' });
  assert.deepEqual(mapRpcError({ code: '23514', message: 'violates check constraint secret_name' }), { status: 400, code: 'invalid_input' });
  assert.deepEqual(mapRpcError({ message: 'connection refused to 10.0.0.1' }), { status: 502, code: 'backend_error' });
});

const legacy = JSON.stringify({
  '2026-10-10': { day: day, foods: [
    { id: 'a', name: '鸡胸肉', meal: 'lunch', portionScale: 1, baseMacros: macros, macros, savedToCalendar: true },
    { id: 'b', name: '草稿', meal: 'lunch', baseMacros: macros, macros, savedToCalendar: false },
    { id: 'c', name: '坏数据', meal: 'lunch', macros: { protein: -5 } }] },
  '2026-10-12': { day, foods: [] },
  '2026-10-14': { day, foods: [{ id: 'f', name: '未来', baseMacros: macros, macros }] },
  'not-a-date': { foods: [{ id: 'g', name: 'x', baseMacros: macros, macros }] }
});

test('legacy local records become an import payload: saved foods only, no future days, no empty days', () => {
  const payload = legacyToImport(legacy, '2026-10-13');
  assert.equal(payload.dayCount, 1);
  assert.equal(payload.foodCount, 1);
  assert.equal(payload.records[0].date, '2026-10-10');
  assert.equal(payload.records[0].foods[0].clientId, '2026-10-10:a');
  assert.deepEqual(legacyToImport(null, '2026-10-13').records, []);
  assert.deepEqual(legacyToImport('{broken', '2026-10-13').records, []);
});

test('server re-validation drops bad foods and rejects malformed structure', () => {
  const good = legacyToImport(legacy, '2026-10-13');
  const checked = sanitizeImport({ records: good.records }, '2026-10-13');
  assert.equal(checked.foodCount, 1);
  const tampered = { records: [{ date: '2026-10-10', day, foods: [
    { clientId: 'x', name: 'ok', baseMacros: macros, macros, portionScale: 1, item: {} },
    { clientId: 'y', name: 'neg', baseMacros: { ...macros, fat: -1 }, macros, portionScale: 1, item: {} },
    { clientId: 'z', name: 'scale', baseMacros: macros, macros, portionScale: 99, item: {} }] }] };
  assert.equal(sanitizeImport(tampered, '2026-10-13').foodCount, 1);
  assert.equal(sanitizeImport({ records: [{ date: '2026-10-20', foods: [] }] }, '2026-10-13'), null);
  assert.equal(sanitizeImport({ records: 'x' }, '2026-10-13'), null);
  assert.equal(sanitizeImport({ records: [{ date: '2026-10-10', foods: 'x' }] }, '2026-10-13'), null);
});
