import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJevRequest, classifyWithJev, effectiveFoodRoute, validateJevAnswer } from '../src/features/recognition/domain/jev-router.ts';
const context = { description: '小林面馆牛肉面加鸡蛋', localCandidates: [], localCoverageComplete: false, brandHints: '' };
const payload = (route = 'brand_search', confidence = 0.95) => ({ answers: { route: { type: 'choice', choice: route, confidence, probabilities: Object.fromEntries(['local_exact','brand_search','ai_estimate','not_food'].map(r => [r, r === route ? 1 : 0])) } } });
const invoke = (fetcher, extra = {}) => classifyWithJev(context, { apiKey: 'test-placeholder', fetcher, ...extra });
test('unknown storefront description reaches Jev without requiring extracted brand strings', async () => {
  const result = await invoke(async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    const body = JSON.parse(init.body);
    assert.equal(body.state.description, context.description);
    assert.equal(body.questions.route.type, 'choice');
    return Response.json(payload());
  });
  assert.equal(result.ok, true);
  assert.equal(result.route, 'brand_search');
});
test('each supported choice is accepted; incomplete local coverage is downgraded', () => {
  for (const route of ['local_exact','brand_search','ai_estimate','not_food']) assert.equal(validateJevAnswer(payload(route)).route, route);
  assert.equal(effectiveFoodRoute('local_exact', false), 'ai_estimate');
  assert.equal(effectiveFoodRoute('local_exact', true), 'local_exact');
});
test('request contains coverage evidence and all four choices', () => {
  const body = buildJevRequest(context, 'jev-latest');
  assert.equal(body.state.localCoverageComplete, false);
  assert.equal(Object.keys(body.questions.route.criteria).length, 4);
});
test('low confidence and non-success HTTP responses request fallback', async () => {
  assert.equal((await invoke(async () => Response.json(payload('ai_estimate', 0.4)))).reason, 'low_confidence');
  for (const status of [401,429,529]) assert.equal((await invoke(async () => new Response('', { status }))).reason, `http_${status}`);
});
test('malformed distributions and unexpected choices are rejected', async () => {
  for (const change of [a => a.choice = 'delete', a => a.confidence = 2, a => a.probabilities = {}, a => a.probabilities.ai_estimate = 0.8]) {
    const body = payload(); change(body.answers.route);
    assert.equal(validateJevAnswer(body), null);
  }
  assert.equal((await invoke(async () => new Response('{broken'))).reason, 'request_failed');
});
test('abort timeout falls back without retrying', async () => {
  let calls = 0;
  const result = await invoke(async (_url, init) => {
    calls++;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  }, { timeoutMs: 5 });
  assert.equal(result.reason, 'timeout');
  assert.equal(calls, 1);
});
test('unresolved 1Password reference never reaches an external endpoint', async () => {
  const result = await invoke(() => { throw new Error('should not fetch'); }, { apiKey: 'op://vault/item/credential' });
  assert.equal(result.reason, 'missing_or_unresolved_key');
});

// Exercise the actual HTTP handler with stubbed external services and catalogs.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jevModule from '../src/features/recognition/domain/jev-router.ts';
import * as foodRouter from '../src/features/recognition/domain/food-router.ts';
import * as brands from '../src/features/recognition/domain/brand-catalog.ts';
import * as eventModule from '../src/features/recognition/domain/events.ts';
import * as evidenceCore from '../src/shared/domain/search-evidence.ts';
import * as nutritionDb from '../src/shared/catalog/nutrition-db.ts';
const evidenceModule = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/features/recognition/domain/build-search-evidence.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:evidenceModule,require:()=>evidenceCore,URL});
function loadHandler(fetcher, router = 'jev', extraEnv = {}, cloudStubs = {}) {
  const source = fs.readFileSync(new URL('../src/app/api/food-ai/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const env = { FOOD_ROUTER: router, AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'test-placeholder', TAVILY_API_KEY: 'test-placeholder', ...extraEnv };
  const dependencies = {
    '@/features/recognition/domain/events':eventModule,
    '@/shared/domain/search-evidence':evidenceCore,
    '@/features/recognition/domain/build-search-evidence':evidenceModule,
    '@/features/recognition/domain/food-router': foodRouter,
    '@/features/recognition/domain/jev-router': { ...jevModule, classifyWithJev: context => jevModule.classifyWithJev(context, { apiKey: 'test-placeholder', fetcher }) },
    '@/shared/catalog/food-catalog': { foodCatalog: [] },
    '@/shared/catalog/nutrition-db': nutritionDb,
    '@/features/recognition/domain/brand-catalog': brands,
    '@/shared/i18n/i18n-utils': { normalizeLanguage: lang => lang === 'en' ? 'en' : 'zh', pick: (lang, zh, en) => lang === 'en' ? en : zh, normalizeMacroTotals: m => Object.fromEntries(['protein','carbs','fat','calories','fiber'].map(k => [k, Math.max(0, Math.round(Number(m?.[k]) || 0))])) },
    '@/shared/i18n/translations': { translateToEn: t => t, translateToZh: t => t },
    '@/features/recognition/server/cloud-recognition': { beginCloudRecognition: async () => ({ mode: 'off' }), ...cloudStubs.recognition },
    '@/features/recognition/server/persist': { persistRecognition: async () => { throw new Error('must not persist when the backend is off'); }, ...cloudStubs.persist }
  };
  vm.runInNewContext(code, { exports, require: id => { if (!(id in dependencies)) throw new Error(id); return dependencies[id]; }, process: { env }, fetch: fetcher, Response, Headers, AbortController, AbortSignal, URL, setTimeout, clearTimeout, console });
  return exports.POST;
}
const meal = { isFoodRelated: true, foods: [{ name: '牛肉面', brand: '小林面馆', foodType: '面食', portionLabel: '一碗', macros: { protein: 25, carbs: 70, fat: 15, calories: 515, fiber: 3 } }] };
const completion = value => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
async function post(handler, description = context.description) {
  const form = new FormData(); form.set('description', description); form.set('lang', 'zh');
  return (await handler(new Request('http://localhost/api/food-ai', { method: 'POST', body: form }))).json();
}
test('HTTP handler sends unknown brand to Tavily and returns normalized food', async () => {
  const calls = [];
  const result = await post(loadHandler(async url => {
    calls.push(url);
    if (url.includes('typesafe')) return Response.json(payload());
    if (url.includes('tavily')) return Response.json({ results: [{ title: '菜单', content: '牛肉面', url: 'https://example.test/menu' }] });
    return completion(meal);
  }));
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'tavily-ai');
  assert.equal(result.routing.router, 'jev');
  assert.equal(result.foods[0].macros.calories, 515);
  assert.equal(calls.length, 3);
});
test('HTTP handler falls back to estimate when search yields no sources', async () => {
  const result = await post(loadHandler(async url => {
    if (url.includes('typesafe')) return Response.json(payload());
    if (url.includes('tavily')) return Response.json({ results: [] });
    return completion(meal);
  }));
  assert.equal(result.provider, 'ai');
  assert.equal(result.routing.selectedRoute, 'brand_search');
  assert.equal(result.routing.effectiveRoute, 'ai_estimate');
  assert.equal(result.foods.length, 1);
});
test('HTTP handler falls back to old LLM routing and reuses its estimate', async () => {
  let calls = 0;
  const result = await post(loadHandler(async url => {
    calls++;
    if (url.includes('typesafe')) return new Response('', { status: 429 });
    return completion({ ...meal, route: 'ai_estimate' });
  }));
  assert.equal(result.provider, 'ai-fast-route');
  assert.equal(result.routing.router, 'llm');
  assert.equal(result.routing.fallbackReason, 'http_429');
  assert.equal(calls, 2);
});
test('HTTP handler rejects non-food choice without calling estimation', async () => {
  let calls = 0;
  const result = await post(loadHandler(async () => { calls++; return Response.json(payload('not_food')); }), '请帮我安排健康计划');
  assert.equal(result.isFoodRelated, false);
  assert.equal(result.foods.length, 0);
  assert.equal(calls, 1);
});
test('llm switch bypasses Jev entirely', async () => {
  const result = await post(loadHandler(async url => {
    assert.equal(url.includes('typesafe'), false);
    return completion({ ...meal, route: 'ai_estimate' });
  }, 'llm'));
  assert.equal(result.routing.router, 'llm');
  assert.equal(result.provider, 'ai-fast-route');
});
test('complete local match returns catalog values without an estimation request', async () => {
  let calls = 0;
  const result = await post(loadHandler(async (url, init) => {
    calls++;
    assert.ok(url.includes('typesafe'));
    assert.equal(JSON.parse(init.body).state.localCoverageComplete, true);
    return Response.json(payload('local_exact'));
  }), '一碗白米饭');
  assert.equal(result.provider, 'local-food-library');
  assert.equal(result.routing.effectiveRoute, 'local_exact');
  assert.equal(result.foods[0].name, '白米饭');
  assert.equal(calls, 1);
});
test('partial local match cannot suppress additional food even when Jev picks local', async () => {
  const result = await post(loadHandler(async (url, init) => {
    if (url.includes('typesafe')) {
      assert.equal(JSON.parse(init.body).state.localCoverageComplete, false);
      return Response.json(payload('local_exact'));
    }
    return completion({ isFoodRelated: true, foods: [{ ...meal.foods[0], name: '西红柿炒鸡蛋', brand: '家常菜', foodType: '菜品' }] });
  }), '一碗白米饭加西红柿炒鸡蛋');
  assert.equal(result.routing.selectedRoute, 'local_exact');
  assert.equal(result.routing.effectiveRoute, 'ai_estimate');
  assert.equal(result.foods.length, 2);
  assert.equal(result.foods[0].name, '白米饭');
});

test('brand matching rejects generic food and everyday phrases', () => {
  for (const input of ['一碗牛肉饭','一份炸串','一份拌面','一杯烧仙草','全家一起吃饭','我和全家吃米饭','abcBKxyz','somekfcword']) {
    assert.equal(brands.findFoodBrandMatches(input).length, 0, input);
  }
  for (const input of ['KFC汉堡','我吃了 KFC 汉堡','Burger King 汉堡',"McDonald’s 巨无霸",'全家饭团','在全家买了便当']) {
    assert.ok(brands.findFoodBrandMatches(input).length, input);
  }
});
test('focused query preserves exclusions without adding other menu products', () => {
  const query = brands.buildFoodBrandSearchQuery('麦当劳巨无霸一个，不含薯条和饮料');
  assert.ok(query.includes('不含薯条和饮料'));
  assert.equal(query.includes('麦旋风'), false);
  assert.equal(query.includes('麦辣鸡腿堡'), false);
});
test('rules route brand before local, and incomplete local coverage to estimate', () => {
  assert.equal(foodRouter.selectRuleFoodRoute({description:'麦当劳汉堡',hasBrand:true,brandOnly:false,localCoverageComplete:true}), 'brand_search');
  assert.equal(foodRouter.selectRuleFoodRoute({description:'米饭加菜',hasBrand:false,brandOnly:false,localCoverageComplete:false}), 'ai_estimate');
  assert.equal(foodRouter.selectRuleFoodRoute({description:'米饭',hasBrand:false,brandOnly:false,localCoverageComplete:true}), 'local_exact');
});
test('rules complete local match makes no network calls', async () => {
  const result = await post(loadHandler(async () => { throw new Error('Unexpected network call'); }, 'rules'), '一碗白米饭');
  assert.equal(result.provider, 'local-food-library');
  assert.equal(result.routing.router, 'rules');
  assert.equal(result.diagnostics.llmCalls, 0);
});
test('rules explicit portions use estimation without overriding user amount', async () => {
  for (const description of ['半碗白米饭','两碗白米饭']) {
    let calls = 0;
    const result = await post(loadHandler(async url => {
      calls++; assert.ok(url.includes('deepseek'));
      return completion({isFoodRelated:true,foods:[{...meal.foods[0],name:'白米饭',portionLabel:description,macros:{protein:2,carbs:23,fat:0,calories:105,fiber:0}}]});
    }, 'rules'), description);
    assert.equal(result.routing.effectiveRoute, 'ai_estimate');
    assert.equal(result.foods[0].macros.calories, 105);
    assert.equal(calls, 1);
  }
});
test('rules branded product uses fast search and only one LLM call', async () => {
  const calls = [];
  const result = await post(loadHandler(async (url, init) => {
    calls.push(url);
    assert.equal(url.includes('typesafe'), false);
    if (url.includes('tavily')) {
      const body = JSON.parse(init.body);
      assert.equal(body.search_depth, 'fast'); assert.equal(body.max_results, 3);
      assert.equal(body.chunks_per_source, 1);
      return Response.json({ results: [{title:'产品营养表',url:'https://example.test/nutrition',content:'巨无霸 580kcal'}], response_time:0.5 });
    }
    assert.ok(JSON.parse(init.body).messages[1].content.includes('不输出中英文镜像字段'));
    return completion({...meal,foods:[{...meal.foods[0],name:'巨无霸',brand:'麦当劳'}]});
  }, 'rules', {FOOD_SEARCH_DEPTH:'fast'}), '麦当劳巨无霸汉堡一个，不含薯条和饮料');
  assert.equal(result.provider, 'tavily-ai'); assert.equal(result.routing.router,'rules');
  assert.equal(result.diagnostics.llmCalls, 1); assert.equal(calls.length, 2);
  assert.equal(result.diagnostics.search.providerMs, 500);
  assert.ok(result.diagnostics.timingsMs.total >= result.diagnostics.timingsMs.searchLlm);
});
test('brand-only description returns prompt without search or LLM', async () => {
  for (const description of ['麦当劳','我今天吃了麦当劳','I ate KFC']) {
    const result = await post(loadHandler(async () => { throw new Error('Unexpected call'); }, 'rules'), description);
    assert.equal(result.isFoodRelated, false, description);
  }
});
test('rules search failure falls back to estimation with reason and preserves brand', async () => {
  for (const mode of ['empty','error','missing']) {
    let calls = 0;
    const result = await post(loadHandler(async url => {
      calls++;
      if (url.includes('tavily')) return mode === 'error' ? new Response('',{status:500}) : Response.json({results:[]});
      return completion({isFoodRelated:true,foods:[{...meal.foods[0],name:'巨无霸',brand:'麦当劳'}]});
    }, 'rules', mode === 'missing' ? {TAVILY_API_KEY:''} : {}), '麦当劳巨无霸');
    assert.equal(result.routing.effectiveRoute,'ai_estimate');
    assert.ok(result.routing.fallbackReason.startsWith('search_'));
    assert.equal(result.foods[0].brand,'麦当劳');
    assert.equal(result.foods[0].recognitionMode,'industry-average');
    assert.equal(calls,mode==='missing'?1:2);
  }
});
test('rules generic food avoids false brand search and only estimates once', async () => {
  let calls = 0;
  const result = await post(loadHandler(async url => {calls++;assert.ok(url.includes('deepseek'));return completion(meal);},'rules'),'一碗牛肉饭');
  assert.equal(result.routing.selectedRoute,'ai_estimate'); assert.equal(calls,1);
});
test('rules mixed local and unknown food keeps both without duplicate rice', async () => {
  const result = await post(loadHandler(async () => completion({isFoodRelated:true,foods:[{...meal.foods[0],name:'白米饭',brand:'家常'},{...meal.foods[0],name:'西红柿炒鸡蛋',brand:'家常'}]}),'rules'),'一碗白米饭加西红柿炒鸡蛋');
  assert.equal(result.foods.length,2);
  assert.equal(result.foods.filter(f=>f.name==='白米饭').length,1);
});

test('fixed local results work without an AI provider credential', async () => {
  const result = await post(loadHandler(async () => {throw new Error('Unexpected call');},'rules',{DEEPSEEK_API_KEY:''}),'一碗白米饭');
  assert.equal(result.ok,true);assert.equal(result.provider,'local-food-library');
});
test('failed estimate cannot fall back to the wrong fixed portion', async () => {
  const result = await post(loadHandler(async () => new Response('',{status:503}),'rules'),'半碗白米饭');
  assert.equal(result.ok,false);
  assert.equal(result.diagnostics.llmCalls,1);
  assert.equal(result.routing.effectiveRoute,'ai_estimate');
});

test('only successful web extraction attaches actual references and verified official pages', async () => {
  const result = await post(loadHandler(async url => {
    if (url.includes('tavily')) return Response.json({results:[
      {title:'官方菜单',url:'https://www.mcdonalds.com.cn/menu',content:'巨无霸'},
      {title:'普通页面',url:'https://mcdonalds.com.cn.evil.test/menu',content:'巨无霸'}
    ]});
    return completion({...meal,foods:[{...meal.foods[0],name:'巨无霸',brand:'麦当劳'}]});
  },'rules'),'麦当劳巨无霸一个');
  const evidence=result.foods[0].searchEvidence;
  assert.equal(evidence.status,'succeeded');
  assert.equal(evidence.brands[0].url,'https://www.mcdonalds.com.cn/');
  assert.equal(evidence.brands[0].linkKind,'website');
  assert.deepEqual(Array.from(evidence.sources[0].officialBrands),['麦当劳']);
  assert.equal(evidence.sources[1].officialBrands,undefined);
});
test('local, direct estimates and failed web searches never attach web evidence', async () => {
  for (const description of ['一碗白米饭','一份牛肉饭','麦当劳巨无霸']) {
    const result = await post(loadHandler(async url=>url.includes('tavily')?Response.json({results:[]}):completion(meal),'rules'),description);
    assert.ok(result.foods.every(food=>food.searchEvidence===undefined));
  }
});
test('successful search followed by failed extraction and estimate fallback has no evidence', async () => {
  let llm=0;
  const result=await post(loadHandler(async url=>{
    if(url.includes('tavily'))return Response.json({results:[{title:'菜单',url:'https://example.test/menu',content:'巨无霸'}]});
    llm++;return completion(llm===1?{isFoodRelated:true,foods:[]}:meal);
  },'rules'),'麦当劳巨无霸');
  assert.equal(result.provider,'ai');assert.equal(result.foods[0].searchEvidence,undefined);
});
test('unsafe returned URLs do not create a reference panel', async () => {
  const result=await post(loadHandler(async url=>url.includes('tavily')?Response.json({results:[{title:'菜单',url:'javascript:alert(1)',content:'巨无霸'}]}):completion(meal),'rules'),'麦当劳巨无霸');
  assert.equal(result.provider,'tavily-ai');assert.equal(result.foods[0].searchEvidence,undefined);
});
test('stream reports real search progress before the blocked upstream request finishes', async () => {
  let release;
  const blocked=new Promise(resolve=>{release=resolve;});
  const handler=loadHandler(async url=>{
    if(url.includes('tavily')){await blocked;return Response.json({results:[{title:'菜单',url:'https://example.test/menu',content:'巨无霸'}]});}
    return completion(meal);
  },'rules');
  const form=new FormData();form.set('description','麦当劳巨无霸');form.set('lang','zh');
  const response=await handler(new Request('http://localhost/api/food-ai',{method:'POST',headers:{Accept:'application/x-ndjson'},body:form}));
  assert.ok(response.headers.get('content-type').includes('application/x-ndjson'));
  const reader=response.body.getReader();const decoder=new TextDecoder();const events=[];
  for(;;){const {value}=await reader.read();const batch=decoder.decode(value).trim().split('\n').map(JSON.parse);events.push(...batch);if(events.some(e=>e.step?.id==='search'&&e.step.status==='active'))break;}
  assert.equal(events.some(e=>e.type==='result'),false);
  release();
  for(;;){const {value,done}=await reader.read();if(done)break;events.push(...decoder.decode(value).trim().split('\n').filter(Boolean).map(JSON.parse));}
  assert.equal(events.filter(e=>e.type==='result').length,1);
  assert.equal(events.at(-1).result.ok,true);
  assert.ok(events.at(-1).result.foods[0].searchEvidence);
  const searchIndex=events.findIndex(e=>e.step?.id==='search'&&e.step.status==='active');
  const organizeIndex=events.findIndex(e=>e.step?.id==='organize'&&e.step.status==='active');
  assert.ok(searchIndex<organizeIndex);
});
test('streamed configuration error retains its logical HTTP status and cannot look successful', async () => {
  const handler=loadHandler(async()=>{throw new Error('Unexpected call');},'rules',{DEEPSEEK_API_KEY:''});
  const form=new FormData();form.set('description','麦当劳巨无霸');
  const response=await handler(new Request('http://localhost/api/food-ai',{method:'POST',headers:{Accept:'application/x-ndjson'},body:form}));
  const events=(await response.text()).trim().split('\n').map(JSON.parse);
  assert.equal(events.at(-1).status,503);assert.equal(events.at(-1).result.ok,false);
  assert.equal(events.filter(e=>e.type==='result').length,1);
});

test('verified 100g matches calculate explicit weights without provider or network', async()=>{
  const result=await post(loadHandler(async()=>{throw new Error('Unexpected network');},'rules',{DEEPSEEK_API_KEY:''}),'米饭150g，熟鸡胸肉100g，番茄炒蛋200g');
  assert.equal(result.ok,true);assert.equal(result.routing.effectiveRoute,'local_exact');assert.equal(result.foods.length,3);
  assert.equal(result.diagnostics.llmCalls,0);assert.equal(result.foods[0].macros.calories,195);
  const expected=nutritionDb.resolveNutritionFood('番茄炒蛋').item.per100g.calories*2;
  assert.equal(result.foods[2].macros.calories,Math.round(expected));
  assert.equal(result.foods[2].portionLabel,'200g');
  assert.equal(result.foods[0].baseMacros.protein,nutritionDb.resolveNutritionFood('米饭').item.per100g.protein*1.5);
  assert.ok(result.foods.every(f=>f.searchEvidence===undefined));
  assert.equal(/本地|数据库|LLM/.test(result.message),false);
});
test('partial weighted match sends only remaining food to analysis and keeps confirmed quantities',async()=>{
  let calls=0;
  const result=await post(loadHandler(async(_url,init)=>{
    calls++;const body=JSON.parse(init.body);const prompt=body.messages[1].content;
    assert.ok(prompt.includes('本次只需分析的食物：神秘炖菜200g'));
    return completion({isFoodRelated:true,foods:[{...meal.foods[0],name:'神秘炖菜',brand:'家常菜',portionLabel:'200g'}]});
  },'rules'),'米饭150g，神秘炖菜200g');
  assert.equal(calls,1);assert.equal(result.foods.length,2);assert.equal(result.foods[0].macros.calories,195);
  assert.equal(result.foods[1].name,'神秘炖菜');assert.ok(result.foods.every(f=>!f.searchEvidence));
});
test('ambiguous raw/cooked food is not assigned the first nutritional row',async()=>{
  let calls=0;
  const result=await post(loadHandler(async()=>{calls++;return completion({isFoodRelated:true,foods:[{...meal.foods[0],name:'鸡胸肉',portionLabel:'100g'}]});},'rules'),'鸡胸肉100g');
  assert.equal(calls,1);assert.equal(result.routing.effectiveRoute,'ai_estimate');
});
test('a known brand with an explicit generic-food weight still searches the brand',async()=>{
  let searches=0;
  const result=await post(loadHandler(async(url)=>{
    if(url.includes('tavily')){searches++;return Response.json({results:[{title:'营养资料',url:'https://www.mcdonalds.com.cn/menu',content:'米饭150g'}]});}
    return completion({isFoodRelated:true,foods:[{...meal.foods[0],name:'米饭',brand:'麦当劳',portionLabel:'150g'}]});
  },'rules'),'麦当劳米饭150g');
  assert.equal(searches,1);assert.equal(result.routing.effectiveRoute,'brand_search');assert.ok(result.foods[0].searchEvidence);
});

const cloudRun = { admin: {}, userId: 'user-1', requestId: '11111111-1111-4111-8111-111111111111' };
const rulesLocal = '米饭';
test('cloud mode: a replied start (unauthenticated, processing, reused) short-circuits recognition', async () => {
  let fetched = 0;
  const handler = loadHandler(async () => { fetched++; return Response.json({}); }, 'rules', {}, {
    recognition: { beginCloudRecognition: async () => ({ mode: 'reply', response: Response.json({ ok: false, code: 'unauthenticated' }, { status: 401 }) }) }
  });
  const response = await handler(new Request('http://localhost/api/food-ai', { method: 'POST', body: (() => { const f = new FormData(); f.set('description', rulesLocal); return f; })() }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'unauthenticated');
  assert.equal(fetched, 0);
});
test('cloud mode: the stored result replaces transient foods and the route is recorded', async () => {
  const calls = [];
  const handler = loadHandler(async () => Response.json({}), 'rules', {}, {
    recognition: { beginCloudRecognition: async () => ({ mode: 'run', run: cloudRun }) },
    persist: { persistRecognition: async (admin, userId, requestId, body, route, language) => {
      calls.push({ userId, requestId, route, language, foods: body.foods?.length, ok: body.ok });
      return { ok: true, body: { ...body, foods: body.foods.map((food, i) => ({ ...food, id: `cloud-${i}`, cloud: true })) } };
    } }
  });
  const form = new FormData(); form.set('description', rulesLocal); form.set('lang', 'zh');
  const json = await (await handler(new Request('http://localhost/api/food-ai', { method: 'POST', body: form }))).json();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].userId, 'user-1');
  assert.equal(calls[0].requestId, cloudRun.requestId);
  assert.equal(calls[0].route, 'local_exact');
  assert.ok(json.foods.length > 0 && json.foods.every(food => food.cloud === true && food.id.startsWith('cloud-')));
});
test('cloud mode: a failed save is reported as an error, never as success', async () => {
  const handler = loadHandler(async () => Response.json({}), 'rules', {}, {
    recognition: { beginCloudRecognition: async () => ({ mode: 'run', run: cloudRun }) },
    persist: { persistRecognition: async () => ({ ok: false, status: 502, body: { ok: false, code: 'persist_failed', retryable: true, message: 'not saved' } }) }
  });
  const form = new FormData(); form.set('description', rulesLocal);
  const response = await handler(new Request('http://localhost/api/food-ai', { method: 'POST', body: form }));
  const json = await response.json();
  assert.equal(response.status, 502);
  assert.equal(json.ok, false);
  assert.equal(json.code, 'persist_failed');
  assert.equal(json.foods, undefined);
});
