import test from 'node:test';
import assert from 'node:assert/strict';
import { collectHttpTargets, runHttpCheckQueue, HTTP_BATCH_SIZE, HTTP_MAX_URLS } from '../dist/js/extension/http-queue.js';

const links = Array.from({length:320}, (_, i) => ({url:`https://store.example.test/products/${i}`}));
const verified = (batch) => batch.map(url=>({url,status:200,method:'HEAD',state:'verified',reason:'',redirected:false,finalUrl:url}));

test('320 anchors, fragment duplicates and an external URL are one bulk target list', () => {
  const input = [links[0], {url:'https://store.example.test/products/0#footer'}, ...links.slice(1),
    {url:'https://outside.example.org/about'}, {url:'javascript:alert(1)'}];
  const found=collectHttpTargets(input);
  assert.equal(found.total,321);
  assert.equal(found.urls.length,321);
  assert.equal(new Set(found.urls).size,321);
  assert.ok(found.urls.includes('https://outside.example.org/about'));
  assert.ok(!found.urls.some(url=>url.includes('#')));
});

test('one invocation automatically processes all 320 URLs with monotonic progress and bounded concurrency', async () => {
  const { urls }=collectHttpTargets(links);
  let concurrent=0, max=0, batches=0;
  const updates=[];
  const outcome=await runHttpCheckQueue(urls,async batch=>{
    concurrent++;max=Math.max(max,concurrent);batches++;
    await new Promise(resolve=>setTimeout(resolve,1));
    concurrent--;
    assert.ok(batch.length<=HTTP_BATCH_SIZE);
    return verified(batch);
  },(_results,progress)=>updates.push(progress.completed),()=>false);
  assert.deepEqual(outcome,{completed:320,total:320,stopped:false});
  assert.equal(batches,20);
  assert.ok(max>=2 && max<=2,`max concurrency: ${max}`);
  assert.equal(updates.length,20);
  assert.ok(updates.every((count,i)=>i===0 || count>updates[i-1]));
  assert.equal(updates.at(-1),320);
});

test('Stop cancels unscheduled batches without discarding in-flight results', async () => {
  const {urls}=collectHttpTargets(links);
  let stop=false;
  const seen=[];
  const outcome=await runHttpCheckQueue(urls,async batch=>{
    await new Promise(resolve=>setTimeout(resolve,2));
    return verified(batch);
  },(results)=>{seen.push(...results);stop=true;},()=>stop);
  assert.equal(outcome.stopped,true);
  assert.ok(outcome.completed>=16 && outcome.completed<=32);
  assert.equal(seen.length,outcome.completed);
});

test('the explicit safety cap is reported instead of silently checking a partial page',()=>{
  const input=Array.from({length:HTTP_MAX_URLS+14},(_,i)=>({url:`https://store.example.test/${i}`}));
  const selected=collectHttpTargets(input);
  assert.equal(selected.total,HTTP_MAX_URLS+14);
  assert.equal(selected.urls.length,HTTP_MAX_URLS);
});

test('incomplete batches fail explicitly instead of silently marking unchecked URLs complete',async()=>{
  await assert.rejects(
    runHttpCheckQueue(links.slice(0,20).map(x=>x.url),async batch=>verified(batch.slice(1)),()=>{},()=>false),
    /Incomplete HTTP response batch/,
  );
});
