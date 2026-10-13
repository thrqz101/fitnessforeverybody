import assert from 'node:assert/strict';
import test from 'node:test';
import { formatScorePercent, weightedScore } from '../lib/score.ts';

const targets = { protein: 100, carbs: 200, fat: 60, calories: 2000, fiber: 30 };
const none = { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 };

test('five items at target score 100% and overshoot adds nothing', () => {
  assert.equal(weightedScore(targets, targets), 1);
  assert.equal(weightedScore({ protein: 999, carbs: 999, fat: 999, calories: 2000, fiber: 999 }, targets), 1);
  assert.equal(weightedScore(none, targets), 0);
});

test('weights are protein 25, calories 25, carbs 20, fat 15, fiber 15', () => {
  assert.equal(weightedScore({ ...none, protein: 100 }, targets), 0.25);
  assert.equal(weightedScore({ ...none, calories: 2000 }, targets), 0.25);
  assert.equal(weightedScore({ ...none, carbs: 200 }, targets), 0.2);
  assert.equal(weightedScore({ ...none, fat: 60 }, targets), 0.15);
  assert.equal(weightedScore({ ...none, fiber: 30 }, targets), 0.15);
});

test('exactly 50% is displayed as 50.0 and 49.99% is not rounded up', () => {
  assert.equal(formatScorePercent(weightedScore({ ...none, protein: 100, calories: 2000 }, targets)), '50.0');
  const justUnder = weightedScore({ ...none, protein: 100, calories: 1999 }, targets);
  assert.ok(justUnder < 0.5);
  assert.equal(formatScorePercent(justUnder), '49.9');
  assert.equal(formatScorePercent(0.99999), '99.9');
  assert.equal(formatScorePercent(1), '100.0');
});

test('non-positive targets contribute nothing instead of dividing by zero', () => {
  assert.equal(weightedScore(targets, { ...targets, calories: 0 }), 0.75);
});
