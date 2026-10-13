import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTargets, calculateCaloriesFromMacros, calculateCaloriesFromMacroMultipliers, defaultProfile, defaultDayState } from '../src/shared/domain/nutrition.ts';

test('lower protein multiplier reduces both displayed and saved calories', () => {
  const macroMultipliers = { protein: 2.04, carbs: 4.1, fat: 0.9 };
  const before = calculateTargets({...defaultProfile,macroMultipliers},defaultDayState);
  const lower = {...macroMultipliers,protein:1.5};
  const after = calculateTargets({...defaultProfile,macroMultipliers:lower},defaultDayState);
  assert.ok(after.calories < before.calories);
  assert.equal(after.calories,calculateCaloriesFromMacroMultipliers(defaultProfile.weightKg,lower));
  assert.equal(after.calories,calculateCaloriesFromMacros(after));
  assert.equal(after.carbs,before.carbs);assert.equal(after.fat,before.fat);
});
test('all macro controls and weight keep target calories in sync after rounding', () => {
  for (const weightKg of [55.5,68,92.3]) {
    for (const macroMultipliers of [{protein:0.8,carbs:0.8,fat:0.35},{protein:2.04,carbs:4.1,fat:0.9},{protein:2.6,carbs:6,fat:1.25}]) {
      const target = calculateTargets({...defaultProfile,weightKg,macroMultipliers},defaultDayState);
      assert.equal(target.calories,calculateCaloriesFromMacroMultipliers(weightKg,macroMultipliers));
      assert.equal(target.calories,calculateCaloriesFromMacros(target));
    }
  }
});
test('fiber changes do not double count energy; saved and reloaded multipliers agree', () => {
  const profile = {...defaultProfile,macroMultipliers:{protein:2,carbs:3,fat:0.8},fiberGrams:25};
  const before=calculateTargets(profile,defaultDayState);
  const after=calculateTargets(JSON.parse(JSON.stringify({...profile,fiberGrams:40})),defaultDayState);
  assert.equal(before.calories,after.calories);assert.equal(after.fiber,40);
});
