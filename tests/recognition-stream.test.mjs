import assert from 'node:assert/strict';
import test from 'node:test';
import { readRecognitionResponse, requestFoodAi } from '../lib/recognition-client.ts';
import { streamRecognition, updateRecognitionSteps } from '../lib/recognition-events.ts';
import { normalizeSearchEvidence, safeExternalUrl } from '../lib/search-evidence.ts';

const step={id:'search',status:'active',labelZh:'正在联网搜索…',labelEn:'Searching the web…'};
const terminal={type:'result',status:200,result:{ok:true,isFoodRelated:true,foods:[{name:'奶茶'}]}};
function chunked(text){
  const bytes=new TextEncoder().encode(text);
  return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();}}),{headers:{'Content-Type':'application/x-ndjson'}});
}
test('client handles split Chinese UTF-8, partial JSON and a missing trailing newline',async()=>{
  const steps=[];const result=await readRecognitionResponse(chunked(JSON.stringify({type:'progress',step})+'\n'+JSON.stringify(terminal)),s=>steps.push(s));
  assert.equal(steps[0].labelZh,step.labelZh);assert.equal(result.result.foods[0].name,'奶茶');
});
test('a truncated stream with no terminal result cannot be treated as success',async()=>{
  await assert.rejects(readRecognitionResponse(chunked(JSON.stringify({type:'progress',step})+'\n')),/without a result/);
  await assert.rejects(readRecognitionResponse(chunked('{broken')),/JSON|property|Unexpected/);
});
test('shared request sends one opt-in POST and honors streamed failure statuses',async()=>{
  let calls=0;const form=new FormData();form.set('description','麦当劳巨无霸');
  const result=await requestFoodAi(form,'zh',{fetcher:async(_url,init)=>{
    calls++;assert.equal(init.headers.Accept,'application/x-ndjson');assert.equal(init.body,form);
    return chunked(JSON.stringify({type:'result',status:503,result:{ok:false,needsConfig:true,message:'未配置'}}));
  }});
  assert.equal(result.ok,false);assert.equal(result.retryable,false);assert.equal(calls,1);
});
test('existing JSON responses still work without an extra request',async()=>{
  const result=await requestFoodAi(new FormData(),'en',{fetcher:async()=>Response.json(terminal.result)});
  assert.equal(result.ok,true);
});
test('client timeouts abort a hanging request and report an error milestone',async()=>{
  const steps=[];
  const result=await requestFoodAi(new FormData(),'zh',{timeoutMs:5,onProgress:s=>steps.push(s),fetcher:async(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))});
  assert.equal(result.ok,false);assert.equal(steps.at(-1).status,'error');assert.ok(steps.at(-1).labelZh.includes('超时'));
});
test('progress rows update in place and stop spinning after a terminal failure',()=>{
  let rows=updateRecognitionSteps([],step);rows=updateRecognitionSteps(rows,{...step,status:'complete'});
  assert.equal(rows.length,1);assert.equal(rows[0].status,'complete');
  rows=updateRecognitionSteps(rows,{...step,id:'organize'});rows=updateRecognitionSteps(rows,{...step,id:'result',status:'error'});
  assert.equal(rows.some(s=>s.status==='active'),false);
});
test('cancelling the response stream aborts the underlying work',async()=>{
  let aborted;const gotAbort=new Promise(resolve=>{aborted=resolve;});
  const response=streamRecognition(async(report,signal)=>{
    report(step);await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted();resolve();},{once:true}));return Response.json({ok:false});
  },new AbortController().signal);
  const reader=response.body.getReader();await reader.read();await reader.cancel();await gotAbort;
});
test('stored evidence keeps only safe unique links and only the success state',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,x','https://user:pass@example.test/','file:///tmp/x'])assert.equal(safeExternalUrl(url),undefined);
  const evidence={id:'test',status:'succeeded',brands:[{name:'品牌',url:'javascript:x'}],sources:[{title:'产品',url:'https://example.test/menu'},{title:'重复',url:'https://example.test/menu'},{title:'坏链接',url:'javascript:x'}],foodNames:['汉堡']};
  const normalized=normalizeSearchEvidence(evidence);assert.equal(normalized.sources.length,1);assert.equal(normalized.brands[0].url,undefined);
  assert.equal(normalizeSearchEvidence({...evidence,status:'failed'}),undefined);
  assert.equal(normalizeSearchEvidence({...evidence,sources:[]}),undefined);
});
