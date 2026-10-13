import assert from 'node:assert/strict';
import test from 'node:test';
import data from '../data/food-brands.json' with { type: 'json' };
import { foodBrandCatalog, findFoodBrandMatches, normalizeBrandText, isBrandOnlyDescription } from '../lib/brand-catalog.ts';

const categories = ['western_fast_food','chinese_fast_food','noodles_rice','hotpot','malatang','tea_coffee','snack_bakery','convenience','casual_dining'];
test('catalog IDs, canonical names and aliases are unique and all new entries have provenance', () => {
  assert.equal(foodBrandCatalog.length,164);
  assert.equal(new Set(foodBrandCatalog.map(b=>b.id)).size,foodBrandCatalog.length);
  const owners = new Map();
  for (const brand of foodBrandCatalog) {
    assert.ok(categories.includes(brand.category),brand.brand);
    assert.ok(brand.brand.trim());
    if (brand.origin !== 'baseline') assert.equal(brand.sourceStatus,'verified',brand.brand);
    if (brand.sourceStatus === 'verified') {
      assert.ok(brand.sources.length,brand.brand);
      assert.match(brand.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
      for (const source of brand.sources) assert.equal(new URL(source.url).protocol,'https:');
    }
    for (const name of [brand.brand,...brand.aliases]) {
      const key=normalizeBrandText(name);
      assert.ok(!owners.has(key),`${name} collides with ${owners.get(key)}`);
      owners.set(key,brand.brand);
    }
  }
});
test('all active canonical names and aliases can recall their own brand', () => {
  for (const brand of foodBrandCatalog) {
    for (const name of [brand.brand,...brand.aliases]) assert.equal(findFoodBrandMatches(name)[0]?.id,brand.id,name);
  }
});
test('pending candidates are not silently enabled', () => {
  for (const candidate of data.pendingBrands) assert.equal(foodBrandCatalog.some(b=>b.brand===candidate.brand),false,candidate.brand);
});
test('Chinese, English, accent and punctuation variants resolve to the same brand', () => {
  for (const [query,brand] of [['太二一份酸菜鱼','太二酸菜鱼'],['塔可钟一份塔可','Taco Bell'],['J.CO甜甜圈','J.CO Donuts & Coffee'],['KOI The奶茶','KOI Thé'],['KOI Thé奶茶','KOI Thé'],['Koi The\u0301奶茶','KOI Thé'],["Peet’s Coffee拿铁",'Peet’s Coffee'],['Peets Coffee拿铁','Peet’s Coffee'],['Chick fil A chicken sandwich','Chick-fil-A'],['In–N–Out Burger汉堡','In-N-Out Burger'],['寿司郎三文鱼寿司','Sushiro'],['食其家牛肉饭','Sukiya']]) {
    assert.equal(findFoodBrandMatches(query)[0]?.brand,brand,query);
  }
});
test('generic foods, common phrases, transit and fictional characters do not become brands', () => {
  for (const query of ['一碗牛肉饭','一份炸串','绿茶一杯','加一点点盐','加1点点糖','今天全家一起吃饭','李先生喝了咖啡','我老娘舅做的米饭','十足的美味','I took the subway train','Sonic the Hedgehog','mind your manner','today I ate a sandwich','abcKOIThexyz']) {
    assert.equal(findFoodBrandMatches(query).length,0,query);
  }
});
test('short ambiguous aliases need food context; brand-only input remains detectable', () => {
  for (const query of ['subway sandwich','SONIC burger','MANNER拿铁','一点点珍珠奶茶','一点点一杯珍珠奶茶','全家饭团']) assert.ok(findFoodBrandMatches(query).length,query);
  for (const query of ['Chipotle','Taco Bell','寿司郎','我今天吃了麦当劳']) assert.equal(isBrandOnlyDescription(query,findFoodBrandMatches(query)),true,query);
});
