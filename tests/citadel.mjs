// Synthetic saves only. Never print achievement definitions or personal save data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve, extname} from 'node:path';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = resolve('docs'), out = resolve(process.env.TEST_OUTPUT || 'test-results');
await mkdir(out, {recursive:true});
const expose = `window.__qa={S:S,points:pointsInfo,trial:trialOf,trialProg:trialProg,render:renderAll,steps:stepInfo};`;
function instrument(html) { const i=html.lastIndexOf('})();'); assert(i>0); return html.slice(0,i)+expose+html.slice(i); }
const game = await readFile(resolve(root,'index.html'),'utf8');
const baselineSrc = execFileSync('git',['show',process.env.BASELINE_REF || 'c65a44e:src/game.html'],{encoding:'utf8'});
const baseline = '<!doctype html><html><head><meta charset="utf-8"><script src="/config.js"></script><script src="/localdb.js"></script></head><body>'+baselineSrc+'</body></html>';
const server=createServer(async(req,res)=>{try { const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname); const file=resolve(root,'.'+(path==='/'?'/index.html':path)); if(!file.startsWith(root+'/'))throw Error(); const body=await readFile(file); res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(file)]||'text/plain');res.end(body); }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} )});
const errors=[];let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
const date='2026-10-30';
const initial={'cfg/opening':{cash:1200.5,card:3400},'weights/test':{kg:152,date,ts:1},['days/'+date]:{q:[false,false,false,false,false,false,false,false,false,false],steps:1200,kcal:2100},'spont/old':{name:'Synthetic task',date,done:false,heavy:true,ts:1},'cfg/outfit':{outer:'none'}};
// Computed keys are assigned separately to remain compatible with plain JavaScript.
async function open({width=390,height=844,seed=initial,legacy={},base=false,day=date,sw=false}={}){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600,timezoneId:'Europe/Moscow',reducedMotion:'reduce',serviceWorkers:sw?'allow':'block'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
 await page.clock.install({time:new Date(day+'T14:00:00+03:00')});
 await context.addInitScript(({seed,legacy,day})=>{if(!localStorage.getItem('qa-init')){const docs=Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]));localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs}));for(const [k,v]of Object.entries(legacy))localStorage.setItem(k,v);localStorage.setItem('qa-init','1');}localStorage.setItem('wsum',day.slice(0,7)+'-26');localStorage.setItem('msum',day.slice(0,7));localStorage.setItem('trialSeen',day);},{seed,legacy,day});
 await context.route('**/*',async route=>{const u=route.request().url();if(u===url+'/'||u===url+'/__baseline')return route.fulfill({contentType:'text/html',body:instrument(base?baseline:game)});if(!u.startsWith(url))return route.fulfill({status:200,body:'',contentType:'text/css'});return route.continue();});
 await page.goto(url+(base?'/__baseline':'/'));await page.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
 await dismiss(page);return {page,context};
}
async function dismiss(p){await p.evaluate(()=>{for(const id of ['achup','lvup','setup','trophy']){const n=document.getElementById(id);if(n)n.hidden=true;}});}
async function castle(p){await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.locator('#citadel-home').evaluate(n=>n.open=true);await p.waitForFunction(()=>!!document.querySelector('[data-croom][aria-pressed="true"]'));}
async function docs(p){return p.evaluate(()=>JSON.parse(JSON.stringify(PlanSync._docs())));}
async function write(p,path,data){await p.evaluate(async({path,data})=>{const db=await claude.use('db');await db.doc(path).set(data);},{path,data});await p.waitForTimeout(40);await dismiss(p);}
try {
 await check('original economy and progress parity on synthetic saves',async()=>{
  for(const complete of [false,true]){const seed=structuredClone(initial);for(let d=19;d<=30;d++)seed['days/2026-10-'+d]={q:Array(10).fill(complete),steps:complete?12000:0,kcal:complete?2100:2500};const a=await open({seed}),b=await open({seed,base:true});assert.deepEqual(await a.page.evaluate(()=>__qa.points()),await b.page.evaluate(()=>__qa.points()));assert.deepEqual(await a.page.evaluate(()=>__qa.steps()),await b.page.evaluate(()=>__qa.steps()));await a.context.close();await b.context.close();}
 });
 await check('mobile and desktop layout, rooms, keyboard, resize, mirrors and shared cosmetics',async()=>{
  for(const width of [320,360,390,430,768,1280]){
   const {page:p,context}=await open({width});await castle(p);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);
   assert.match(await p.locator('#citadel-live-cash').innerText(),/4\s?600,50/);
   const before=await docs(p);
   await p.locator('[data-croom="study"]').click();await p.locator('#citadel-enter').click();
   await p.locator('#citadel-interior-object').focus();await p.keyboard.press('Enter');const feedback=await p.locator('#citadel-object-status').innerText();assert.match(feedback,/Книга записей/);
   await p.locator('#citadel-decor-options button').filter({hasText:'Штандарт'}).click();await p.waitForTimeout(50);
   await p.setViewportSize({width:width+8,height:700});await p.waitForTimeout(40);
   assert(await p.locator('#citadel-interior').isVisible());assert.equal(await p.locator('#citadel-object-status').innerText(),feedback);
   await p.locator('#citadel-fullscreen').click();assert(await p.locator('#citadel-interior').isVisible());
   await p.locator('[data-croom="archive"]').dispatchEvent('click');assert.match(await p.locator('#citadel-room-info').innerText(),/закрыта/);assert.equal(await p.locator('[data-croom="study"]').getAttribute('aria-pressed'),'true');
   const after=await docs(p);for(const [k,v]of Object.entries(before))assert.deepEqual(after[k],v,'room interaction changed '+k);
   assert.equal(after['cfg/citadel'].d.decor.study,'banner');
   await p.reload();await castle(p);assert.equal(await p.locator('[data-croom="study"]').getAttribute('aria-pressed'),'true');await p.locator('#citadel-enter').click();assert.equal(await p.locator('#citadel-interior-decoration').getAttribute('data-decor'),'banner');
   await p.screenshot({path:resolve(out,'citadel-'+width+'.png'),fullPage:true});await context.close();
  }
 });
 await check('legacy cosmetics migrate once and shared data wins on another device',async()=>{
  const legacy={'plan.citadel.selectedRoom.v1':'study','plan.citadel.decor.v1.study':'banner'};
  const a=await open({legacy});await a.page.waitForTimeout(60);const saved=await docs(a.page);assert.equal(saved['cfg/citadel'].d.decor.study,'banner');await a.context.close();
  const seed=Object.fromEntries(Object.entries(saved).map(([k,v])=>[k,v.d]));const b=await open({seed,legacy:{'plan.citadel.decor.v1.study':'none'}});await castle(b.page);await b.page.locator('#citadel-enter').click();assert.equal(await b.page.locator('#citadel-interior-decoration').getAttribute('data-decor'),'banner');await b.context.close();
 });
 await check('daily navigation resets yesterday and all existing tabs work',async()=>{
  const {page:p,context}=await open();await p.locator('#d-yest').click();await castle(p);await p.locator('[data-citadel-tab="today"]').click();assert.equal(await p.locator('#d-today').getAttribute('aria-pressed'),'true');
  await p.locator('[data-citadel-tab="week"]').click();assert(await p.locator('#week').isVisible());
  for(const tab of ['today','week','shop','diet','goals']){await p.locator('.tab[data-t="'+tab+'"]').click();assert(await p.locator('#'+tab).isVisible());}
  await p.locator('#pg-btn-b').click();for(const tab of ['spend','money','avito']){await p.locator('.tab[data-t="'+tab+'"]').click();assert(await p.locator('#'+tab).isVisible());}await p.locator('#pg-btn-a').click();
  await context.close();
 });
 await check('daily, steps, spontaneous and weekly writes update mirrors and survive reload',async()=>{
  const {page:p,context}=await open();await p.locator('#qlist button').first().click();await p.waitForTimeout(50);await dismiss(p);
  await p.locator('#steps').fill('6000');await p.locator('#steps').blur();await p.waitForTimeout(50);await dismiss(p);
  await p.locator('#sp-name').fill('Synthetic new task');await p.locator('#sp-add').click();await p.waitForTimeout(50);await p.locator('#slist2 button.q').filter({hasText:'Synthetic new task'}).click();await p.waitForTimeout(50);await dismiss(p);
  const saved=await docs(p);assert.equal(saved['days/'+date].d.steps,6000);assert(saved['days/'+date].d.q[0]);assert(Object.values(saved).some(v=>v.d?.name==='Synthetic new task'&&v.d.done));assert.equal(saved['spont/old'].d.heavy,true);
  await castle(p);assert.match(await p.locator('#citadel-daily-list').innerText(),/6\s?000/);assert.match(await p.locator('#citadel-weekly-count').innerText(),/1 \/ 4/);
  await p.reload();await castle(p);assert.match(await p.locator('#citadel-daily-count').innerText(),/1 \/ 7/);assert.equal((await docs(p))['days/'+date].d.steps,6000);await context.close();
 });
 await check('trial completion, reward and next-day penalty match original implementation',async()=>{
  const first=await open();const trial=await first.page.evaluate(()=>{for(let d=1;d<=30;d++){let k='2026-11-'+String(d).padStart(2,'0'),t=__qa.trial(k);if(t)return {k,t};}});await first.context.close();assert(trial);
  for(const complete of [false,true]){
   const seed=structuredClone(initial);seed['trial/'+trial.k]={sq:complete?trial.t.sq:0,pu:complete?trial.t.pu:0};seed['days/'+trial.k]={q:Array(10).fill(false),steps:complete?trial.t.st:0};
   const a=await open({seed,day:trial.k}),b=await open({seed,day:trial.k,base:true});await castle(a.page);assert.equal(await a.page.locator('#citadel-trial-state').innerText(),complete?'ПРОЙДЕНО':'АКТИВНО');assert.deepEqual(await a.page.evaluate(()=>__qa.points()),await b.page.evaluate(()=>__qa.points()));
   await a.page.clock.fastForward(11*3600000);await b.page.clock.fastForward(11*3600000);assert.deepEqual(await a.page.evaluate(()=>__qa.points()),await b.page.evaluate(()=>__qa.points()));await a.context.close();await b.context.close();
  }
 });
 await check('rapid quest taps and trial counters retain every write',async()=>{
  const {page:p,context}=await open();await p.evaluate(()=>{const b=document.querySelectorAll('#qlist button');b[0].click();b[1].click();});await p.waitForTimeout(60);const saved=await docs(p);assert(saved['days/'+date].d.q[0]&&saved['days/'+date].d.q[2],'rapid daily writes must preserve both marks');
  const scheduled=await p.evaluate(()=>{for(let n=1;n<=90;n++){const d=new Date(2026,10,n),k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),t=__qa.trial(k);if(t&&t.sq)return {k,t};}});await context.close();assert(scheduled);
  const b=await open({day:scheduled.k});await b.page.evaluate(()=>{const plus=[...document.querySelectorAll('#trialbox button')].find(b=>b.textContent==='+10');plus.click();plus.click();});await b.page.waitForTimeout(60);assert.equal((await docs(b.page))['trial/'+scheduled.k].d.sq,20);await b.context.close();
 });
 await check('midnight refresh keeps current-day mirror and quest screen aligned',async()=>{
  const {page:p,context}=await open();await castle(p);await p.clock.fastForward(11*3600000);assert.match(await p.locator('#citadel-daily-count').innerText(),/0 \/ 7/);assert.equal(await p.locator('#steps').inputValue(),'');await context.close();
 });
 await check('unlocked rooms, residents, wardrobe navigation and shared avatar',async()=>{
  const seed=structuredClone(initial);for(let n=0;n<180;n++){const dt=new Date('2026-10-19T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+n);const k=dt.toISOString().slice(0,10),t=dt.getTime();seed['days/'+k]={q:Array(10).fill(true),steps:50000,kcal:2100};seed['per/'+k]={squat:[t,t+7200000,t+14400000],pushup:[t,t+7200000,t+14400000],squatR:[100,100,100],pushupR:[100,100,100],workout:[t]};}
  const {page:p,context}=await open({seed,day:'2027-04-16'});await castle(p);assert(await p.evaluate(()=>__qa.points().L>=20));
  for(const room of ['throne','observatory','rest','study','archive','forge']){await dismiss(p);await p.locator('[data-croom="'+room+'"]').click();await p.locator('#citadel-enter').click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),room);}
  await p.locator('#citadel-activity-actions button').click();assert(await p.locator('#wardrobe').isVisible());
  for(const button of await p.locator('#citadel-residents button').all()){await button.click();assert((await p.locator('#citadel-npc-dialogue').innerText()).length>15);}
  const sprites=await p.evaluate(()=>['hero','citadel-avatar-canvas','citadel-interior-hero'].map(id=>document.getElementById(id).toDataURL()));assert.equal(sprites[0],sprites[1]);assert.equal(sprites[1],sprites[2]);await context.close();
 });
 await check('mock Sheets merge, cosmetics import/export and deletion round trip',async()=>{
  const {page:p,context}=await open();let rows=[['path','json','u'],['cfg/citadel',JSON.stringify({selectedRoom:'study',decor:{study:'banner'}}),new Date(date+'T13:59:00+03:00').getTime()]];
  await context.route('**/*googleapis.com/**',async route=>{const req=route.request(),u=req.url();let data={};if(u.includes('drive/v3/files?'))data={files:[{id:'QA_SHEET',name:'plan-data'}]};else if(u.includes('/about?'))data={user:{emailAddress:'qa@example.invalid'}};else if(u.includes('values/data!A:C'))data={values:rows};else if(u.includes('values/data!A1')&&req.method()==='PUT'){rows=JSON.parse(req.postData()).values;}else throw Error('Unexpected mock API request');await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});});
  await p.evaluate(()=>{window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'synthetic-token',expires_in:3600})})}}};});
  await p.evaluate(()=>PlanSync.sync(true));await p.waitForTimeout(60);await dismiss(p);await castle(p);await p.locator('#citadel-enter').click();assert.equal(await p.locator('#citadel-interior-decoration').getAttribute('data-decor'),'banner');assert(rows.some(r=>r[0]==='weights/test'));
  await p.locator('#citadel-decor-options button').filter({hasText:'Без украшения'}).click();await p.waitForTimeout(60);await p.evaluate(()=>PlanSync.sync(false));assert.equal(JSON.parse(rows.find(r=>r[0]==='cfg/citadel')[1]).decor.study,'none');
  await p.evaluate(async()=>{const db=await claude.use('db');await db.doc('spont/old').delete();});await p.evaluate(()=>PlanSync.sync(false));assert.equal(rows.find(r=>r[0]==='spont/old')[1],'');await context.close();
 });
 await check('production PWA offline reload and offline writes persist',async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await p.reload();await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.evaluate(async()=>{const db=await claude.use('db');await db.doc('cfg/citadel').set({selectedRoom:'study',decor:{study:'banner'}});});await p.reload();await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.locator('#citadel-home').evaluate(n=>n.open=true);await p.waitForFunction(()=>!!document.querySelector('[data-croom="study"][aria-pressed="true"]'));await p.locator('#citadel-enter').click();assert.equal(await p.locator('#citadel-interior-decoration').getAttribute('data-decor'),'banner');await context.close();
 });
 assert.deepEqual(errors,[],'browser runtime errors');console.log(`PASS ${passed} scenario groups; no runtime errors`);
} finally {await browser.close();await new Promise(r=>server.close(r));}
