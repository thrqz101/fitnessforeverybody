import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as dbModule from '../lib/nutrition-db.ts';
const {getNutritionDb,resolveNutritionFood,searchNutritionDb,scalePer100gToGrams,matchWeightedNutrition,validateNutritionDb}=dbModule;
const db=getNutritionDb();

test('all records are per-100g edible food with traceable sources and flagged missing values',()=>{
  assert.ok(db.foods.length>0);
  if(fs.existsSync('data/nutrition-100g.json')) assert.ok(db.foods.length>=250);
  assert.equal(new Set(db.foods.map(f=>f.id)).size,db.foods.length);
  for(const f of db.foods){
    assert.equal(f.basisGrams,100);
    for(const k of ['protein','carbs','fat','calories','fiber']) assert.ok(Number.isFinite(f.per100g[k])&&f.per100g[k]>=0,`${f.id}/${k}`);
    for(const k of f.missingNutrients)assert.equal(f.per100g[k],0);
    if(f.foodKind==='single_food')assert.ok(f.source.fdcId&&f.source.url.startsWith('https://fdc.nal.usda.gov/'));
    else assert.ok(f.recipeId&&f.qualityFlags.includes('recipe_calculated_not_measured'));
  }
});
test('raw rice and cooked rice stay distinct; ambiguous chicken requires clarification',()=>{
  assert.equal(resolveNutritionFood('米饭').item.id,'rice-cooked');
  assert.equal(resolveNutritionFood('大米').item.id,'rice-raw');
  assert.ok(resolveNutritionFood('大米').item.per100g.calories>resolveNutritionFood('米饭').item.per100g.calories*2);
  assert.equal(resolveNutritionFood('鸡胸肉').reason,'ambiguous');
  assert.equal(resolveNutritionFood('熟鸡胸肉').item.id,'chicken-breast-cooked');
  assert.equal(resolveNutritionFood('青菜').item,undefined);
  assert.equal(resolveNutritionFood('韭菜').item,undefined);
  assert.equal(resolveNutritionFood('土豆淀粉').item,undefined);
  assert.equal(resolveNutritionFood('炒').item,undefined);
  assert.equal(resolveNutritionFood('海鲜米饭套餐').item,undefined);
});
test('grams and kg multiply original precision before rounding for display',()=>{
  const rice=resolveNutritionFood('米饭').item;
  for(const grams of [50,100,150,250,1000]){
    const matched=matchWeightedNutrition(`米饭 ${grams}g`);
    assert.equal(matched.complete,true);
    assert.equal(matched.matches[0].macros.calories, rice.per100g.calories*grams/100);
    assert.ok(Math.abs(matched.matches[0].macros.protein-rice.per100g.protein*grams/100)<1e-6);
  }
  assert.equal(matchWeightedNutrition('0.25kg 米饭').matches[0].grams,250);
  assert.equal(matchWeightedNutrition('米饭 .5 公斤').matches[0].grams,500);
  assert.equal(matchWeightedNutrition('100 grams cooked rice').matches[0].grams,100);
  assert.throws(()=>scalePer100gToGrams(rice.per100g,-1));
});
test('multi-item coverage and remaining food are explicit; no unsafe unit/state assumptions',()=>{
  const result=matchWeightedNutrition('我吃了米饭150g，熟鸡胸肉100克和番茄炒蛋200g');
  assert.equal(result.complete,true); assert.equal(result.matches.length,3);
  const partial=matchWeightedNutrition('米饭100g，神秘炖菜200g');
  assert.equal(partial.complete,false);assert.equal(partial.matches.length,1);assert.equal(partial.remainingDescription,'神秘炖菜200g');
  for(const input of ['鸡胸肉100g','米饭-100g','米饭100-150g','米饭0g','米饭100ml','米饭一碗','半碗米饭','米饭100g去掉一半','米饭200g其中100g留到明天','带骨鸡翅100g','米饭200g，其中100g留到明天','无糖燕麦粥100g加牛奶','米饭150g鸡胸肉100g'])assert.equal(matchWeightedNutrition(input).complete,false,input);
});
test('each recipe recomputes using edible input grams and final yield',{skip:!fs.existsSync('data/nutrition-recipes.json')},()=>{
  const recipes=JSON.parse(fs.readFileSync('data/nutrition-recipes.json','utf8')).recipes;
  const byId=new Map(db.foods.map(f=>[f.id,f]));
  for(const r of recipes){
    const f=byId.get('recipe-'+r.id);
    for(const k of Object.keys(f.per100g)){
      const subtotal=r.ingredients.reduce((t,i)=>t+byId.get(i.foodId).per100g[k]*i.edibleGrams/100,0);
      const expected=f.missingNutrients.includes(k)?0:subtotal/r.cookedYieldGrams*100*r.nutrientRetention;
      assert.ok(Math.abs(f.per100g[k]-expected)<1e-6,`${r.id}/${k}`);
    }
  }
});
test('invalid or old approximate DB is rejected instead of silently used',()=>{
  assert.throws(()=>validateNutritionDb({...db,version:'1.0.0'}));
  assert.throws(()=>validateNutritionDb({...db,foods:[{...db.foods[0],basisGrams:1000}]}));
  assert.throws(()=>validateNutritionDb({...db,foods:[{...db.foods[0],per100g:{...db.foods[0].per100g,protein:NaN}}]}));
});
test('fuzzy matches are suggestions and tool never picks an ambiguous first result',async()=>{
  assert.ok(searchNutritionDb('鸡胸').length>0);assert.equal(resolveNutritionFood('鸡胸').item,undefined);
  const module={};
  const code=ts.transpileModule(fs.readFileSync('lib/tools/food-nutrition.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports:module,require:()=>dbModule});
  const ambiguous=await module.queryLocalFoodDb({food:'鸡胸肉',grams:100});assert.equal(ambiguous.ok,false);assert.equal(ambiguous.needsClarification,true);
  const suggestion=await module.queryLocalFoodDb({food:'鸡胸',grams:100});assert.equal(suggestion.ok,false);
  const result=await module.queryLocalFoodDb({food:'米饭',grams:150});assert.equal(result.ok,true);assert.equal(result.macros.calories,195);
  assert.equal((await module.queryLocalFoodDb({food:'米饭',grams:-10})).reason,'invalid_weight');
});
