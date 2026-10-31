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
const currentVersion = (await readFile(resolve('src/version.txt'),'utf8')).trim();
await mkdir(out, {recursive:true});
const expose = `window.__qa={S:S,points:pointsInfo,trial:trialOf,trialProg:trialProg,render:renderAll,steps:stepInfo,idle:function(){return chain;},upgrade:typeof citadelUpgrade==='function'?citadelUpgrade:null,abyssEvents:typeof abyssEvents==='function'?abyssEvents:null,roomLevel:typeof citadelRoomLevel==='function'?citadelRoomLevel:null,decor:typeof citadelSetDecor==='function'?citadelSetDecor:null,buy:buy,npcState:typeof citadelNpcState==='function'?function(key){return citadelNpcState(citadelPeople.find(p=>p.key===key));}:null,move:typeof citadelMove==='function'?citadelMove:null};`;
function instrument(html) { const i=html.lastIndexOf('})();'); assert(i>0); return html.slice(0,i)+expose+html.slice(i); }
const game = await readFile(resolve(root,'index.html'),'utf8');
const baselineSrc = execFileSync('git',['show',process.env.BASELINE_REF || 'c65a44e:src/game.html'],{encoding:'utf8'});
const baseline = '<!doctype html><html><head><meta charset="utf-8"><script src="/config.js"></script><script src="/localdb.js"></script></head><body>'+baselineSrc+'</body></html>';
const servedOverrides=new Map();
const server=createServer(async(req,res)=>{try { const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname); const file=resolve(root,'.'+(path==='/'?'/index.html':path)); if(!file.startsWith(root+'/'))throw Error(); const body=servedOverrides.has(file)?servedOverrides.get(file):await readFile(file); if(file.endsWith('/sw.js'))res.setHeader('Cache-Control','no-cache'); res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'text/plain');res.end(body); }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} )});
console.log('Browser',browser.version());
const errors=[];let passed=0,currentCheck='setup';
async function check(name,fn){if(process.env.TEST_FILTER&&!new RegExp(process.env.TEST_FILTER).test(name))return;currentCheck=name;await fn();passed++;console.log('PASS',name);}
const date='2026-10-30';
const initial={'cfg/opening':{cash:1200.5,card:3400},'weights/test':{kg:143.7,date,ts:1},['days/'+date]:{q:[false,false,false,false,false,false,false,false,false,false],steps:1200,kcal:2100},'spont/old':{name:'Synthetic task',date,done:false,heavy:true,ts:1},'cfg/outfit':{outer:'none'}};
// Computed keys are assigned separately to remain compatible with plain JavaScript.
async function open({width=390,height=844,seed=initial,legacy={},base=false,day=date,sw=false,failUpgrade=false,shell=false}={}){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600,timezoneId:'Europe/Moscow',reducedMotion:'reduce',serviceWorkers:sw?'allow':'block'});
 context.setDefaultTimeout(15000);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
 await page.clock.install({time:new Date(day+'T14:00:00+03:00')});
 await context.addInitScript(({seed,legacy,day,failUpgrade,shell})=>{if(!shell)localStorage.setItem('plan.shell.classic.v1','1');if(!localStorage.getItem('qa-init')){const docs=Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]));localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs}));for(const [k,v]of Object.entries(legacy))localStorage.setItem(k,v);localStorage.setItem('qa-init','1');}localStorage.setItem('wsum',day.slice(0,7)+'-26');localStorage.setItem('msum',day.slice(0,7));localStorage.setItem('trialSeen',day);if(failUpgrade&&!localStorage.getItem('qa-upgrade-failed')){localStorage.setItem('qa-upgrade-failed','1');window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.pre-update.v1')throw new DOMException('Synthetic full','QuotaExceededError');return window.__originalSetItem.call(this,k,v);};}},{seed,legacy,day,failUpgrade,shell});
 await context.route('**/*',async route=>{const u=route.request().url();if(u===url+'/'||u===url+'/__baseline')return route.fulfill({contentType:'text/html',body:instrument(base?baseline:game)});if(!u.startsWith(url))return route.fulfill({status:200,body:'',contentType:'text/css'});return route.continue();});
 await page.goto(url+(base?'/__baseline':'/'));await page.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
 if(!base&&!failUpgrade){await page.waitForFunction(()=>window.__qa?.S.abyss?.version===1&&__qa.S.abyss.rank>=__qa.points().L);await page.evaluate(()=>__qa.idle());}
 if(!shell)await page.addLocatorHandler(page.locator('#achup:not([hidden]),#lvup:not([hidden]),#setup:not([hidden]),#trophy:not([hidden])').first(),()=>dismiss(page));
 await dismiss(page);return {page,context};
}
async function dismiss(p){await p.evaluate(()=>{for(const id of ['achup','lvup','setup','trophy']){const n=document.getElementById(id);if(n)n.hidden=true;}});}
async function castle(p){await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.locator('#citadel-home').evaluate(n=>n.open=true);await p.waitForFunction(()=>!!document.querySelector('[data-croom][aria-pressed="true"]'));}
async function docs(p){return p.evaluate(()=>JSON.parse(JSON.stringify(PlanSync._docs())));}
async function write(p,path,data){await p.evaluate(async({path,data})=>{const db=await claude.use('db');await db.doc(path).set(data);},{path,data});await p.waitForTimeout(40);await dismiss(p);}
function advancedSeed(){
 const seed=structuredClone(initial);
 seed['cfg/abyss-economy']={version:1,rank:1,earned:1000,claims:{}};
 for(let n=0;n<180;n++){const dt=new Date('2026-10-19T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+n);const k=dt.toISOString().slice(0,10),t=dt.getTime();seed['days/'+k]={q:Array(10).fill(true),steps:50000,kcal:2100};seed['per/'+k]={squat:[t,t+7200000,t+14400000],pushup:[t,t+7200000,t+14400000],squatR:[100,100,100],pushupR:[100,100,100],workout:[t]};}
 return seed;
}
try {
 await check('single Citadel shell, drawers, mobile camera and real game panels',async()=>{
  for(const width of [320,360,390,430,768,1280]){
   const {page:p,context}=await open({width,shell:true,seed:advancedSeed(),day:'2027-04-16'});
   await p.waitForFunction(()=>!!window.__citadelShell);
   assert(await p.locator('#citadel-castle').isVisible());assert(!(await p.locator('.stage').isVisible()));
   assert.equal(await p.locator('[data-croom]').count(),10);
   assert.match(await p.locator('.citadel-shell-drawer.left').innerText(),/Ранг 24/);
   assert(await p.locator('.citadel-shell-header .pl-chip').isVisible());await p.locator('.citadel-shell-header .pl-chip').click();assert(await p.locator('.pl-menu').isVisible());await p.locator('.pl-menu').getByRole('button',{name:'ЗАКРЫТЬ',exact:true}).click();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width<1050){await p.locator('.citadel-shell-tail.left').click();assert.equal(await p.locator('#citadel-home').getAttribute('data-drawer'),'left');
   if(width===390)await p.screenshot({path:resolve(out,'shell-left-390.png')});await p.locator('.citadel-shell-shade').click({position:{x:width-5,y:100}});assert.equal(await p.locator('#citadel-home').getAttribute('data-drawer'),'');
   if(width===390){for(const [label,id] of [['Хроника','week'],['Траты','spend'],['Авито','avito']]){await p.locator('.citadel-shell-tail.left').click();await p.locator('.citadel-shell-drawer.left button').filter({hasText:label}).click();assert(await p.locator('.citadel-system-dialog #'+id).isVisible());await p.locator('.citadel-system-dialog header button').click();}}
   await p.locator('.citadel-shell-tail.right').click();assert.equal(await p.locator('#citadel-home').getAttribute('data-drawer'),'right');
   if(width===390)await p.screenshot({path:resolve(out,'shell-right-390.png')});await p.locator('.citadel-shell-shade').click({position:{x:5,y:100}});}
   await p.locator('.citadel-shell-nav button').filter({hasText:'Задания'}).click();assert(await p.locator('.citadel-system-dialog').isVisible());assert(await p.locator('.citadel-system-dialog #qlist').isVisible());
   await p.locator('.citadel-system-dialog header button').click();assert(await p.locator('#citadel-castle').isVisible());
   for(const [label,id] of [['Финансы','money'],['Воспоминания','shop'],['Профиль','wardrobe']]){await p.locator('.citadel-shell-nav button').filter({hasText:label}).click();assert(await p.locator('.citadel-system-dialog #'+id).isVisible());await p.locator('.citadel-system-dialog header button').click();}
   if(width===390){await p.locator('.citadel-shell-nav button').filter({hasText:'Настройки'}).click();assert(await p.locator('#setup').isVisible());await p.locator('#setup-x').click();await p.locator('.citadel-shell-nav button').filter({hasText:'Достижения'}).click();assert(await p.locator('#trophy').isVisible());await p.locator('#trophy-x').click();}
   await p.locator('.citadel-shell-camera button').filter({hasText:'+'}).click();assert(await p.locator('#citadel-castle').evaluate(n=>n.clientWidth>600));
   await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});if(width===390)await p.screenshot({path:resolve(out,'shell-room-390.png')});
   await p.locator('.citadel-shell-nav button').filter({hasText:'Цитадель'}).click();assert(await p.locator('#citadel-castle').isVisible());
   await p.screenshot({path:resolve(out,'shell-game-'+width+'.png')});
   if(width===390){
    await p.locator('.citadel-shell-tail.left').click();await p.goBack();assert.equal(await p.locator('#citadel-home').getAttribute('data-drawer'),'');
    await p.locator('.citadel-shell-nav button').filter({hasText:'Задания'}).click();await p.goBack();assert(!(await p.locator('.citadel-system-dialog').isVisible()));
    await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});await p.goBack();assert(await p.locator('#citadel-castle').isVisible());
    await p.locator('.citadel-viewport').evaluate(n=>{n.scrollLeft=150;n.scrollTop=95;});await p.waitForTimeout(400);await p.reload();await p.waitForFunction(()=>!!window.__citadelShell);await p.waitForFunction(()=>document.querySelector('.citadel-viewport').scrollLeft>=100&&document.querySelector('.citadel-viewport').scrollTop>=75);
   }
   await context.close();
  }
 });
 await check('graphics assets, renovation layers, live mobile RPG views and animation lifecycle',async()=>{
  const images=['sky','throne','observatory','rest','study','archive','forge','gatehouse','refectory','cloister','vault'];
  for(const width of [320,360,390,430,768,1280]){
   const {page:p,context}=await open({width,seed:advancedSeed(),day:'2027-04-16'});await castle(p);
   const loadedArt=await p.evaluate(async names=>Promise.all(names.map(name=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im.naturalWidth>0);im.onerror=()=>resolve(false);im.src='assets/citadel/'+name+'.webp';}))),images);
   assert(loadedArt.every(Boolean),'all original scenes must decode');
   assert.equal(await p.locator('[data-croom]').count(),10);assert.equal(await p.locator('.citadel-floor').count(),5);
   assert(await p.locator('[data-croom="rest"]').evaluate(n=>getComputedStyle(n,'::before').backgroundImage.includes('rest.webp')));
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.locator('#citadel-castle').screenshot({path:resolve(out,'graphics-castle-'+width+'.png')});
   await p.locator('[data-art-view="room"]').click();assert(await p.locator('#citadel-interior').isVisible());
   await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'graphics-rest-'+width+'.png')});
   await p.locator('[data-art-view="upgrades"]').click();assert(await p.locator('#citadel-upgrade').evaluate(n=>{const r=n.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}));
   const before=await p.locator('#citadel-interior-stage').screenshot();await p.locator('#citadel-upgrade').click();await p.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.level==='2');
   const middle=await p.locator('#citadel-interior-stage').screenshot();assert(!before.equals(middle),'paid tier 2 must change rendered pixels');
   await p.locator('#citadel-upgrade').click();await p.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.level==='3');
   const after=await p.locator('#citadel-interior-stage').screenshot();assert(!middle.equals(after),'paid tier 3 must change rendered pixels');
   if(width===390||width===1280)await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'graphics-rest-upgraded-'+width+'.png')});
   await p.locator('[data-art-view="people"]').click();assert(await p.locator('#citadel-residents').evaluate(n=>{const r=n.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}));
   await p.locator('#citadel-fullscreen').click();assert(await p.locator('#citadel-home').evaluate(n=>n.classList.contains('citadel-expanded')));
   await p.locator('[data-art-view="overview"]').click();assert(await p.locator('#citadel-castle').isVisible());assert(!(await p.locator('#citadel-interior').isVisible()));
   await p.clock.runFor(32);assert(await p.locator('#citadel-avatar').evaluate(n=>{const a=n.getBoundingClientRect(),b=document.querySelector('[data-croom][aria-pressed="true"]').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;}),'hero must fit its selected room after immersive resize');await p.screenshot({path:resolve(out,'graphics-game-screen-'+width+'.png')});
   // Capture the whole interactive cutaway without viewport clipping on tall mobile scenes.
   await p.setViewportSize({width,height:1300});await p.clock.runFor(32);
   await p.locator('#citadel-castle').screenshot({path:resolve(out,'graphics-full-castle-'+width+'.png')});
   await p.locator('[data-art-view="room"]').click();assert(await p.locator('#citadel-interior').isVisible());
   const door=p.locator('#citadel-interior-stage [data-stage-door]').first(),destination=await door.getAttribute('data-stage-door');
   await door.click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),destination);
   const roomName=(await p.locator('[data-croom="'+destination+'"] .citadel-room-name').textContent()).replace(/ · \d+$/,'');
   assert.equal(await p.locator('#citadel-interior-title').innerText(),roomName,'immersive door must update the title without reading hidden castle coordinates');
   await p.locator('[data-art-view="people"]').click();assert(await p.locator('#citadel-residents').isVisible());
   await p.goBack();assert(!(await p.locator('#citadel-home').evaluate(n=>n.classList.contains('citadel-expanded'))));
   await context.close();
  }
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);await p.emulateMedia({reducedMotion:'no-preference'});
  await p.clock.setFixedTime(new Date('2027-04-16T10:00:07+03:00'));await p.evaluate(()=>__qa.render());
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert(await p.locator('#citadel-home').evaluate(n=>n.getAnimations({subtree:true}).every(a=>a.playState==='paused'||a.playState==='finished')),'hidden scene must pause animation');
  await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await p.emulateMedia({reducedMotion:'reduce'});assert(await p.locator('#citadel-home').evaluate(n=>n.getAnimations({subtree:true}).every(a=>a.playState==='finished')));
  await context.close();
 });
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
 await check('citadel journal reflects original daily quest completion without mutating saves',async()=>{
  const {page:p,context}=await open();await castle(p);
  const before=await docs(p);
  await p.locator('.citadel-daily-journal summary').click();
  const rows=p.locator('#citadel-daily-details .citadel-daily-quest');
  assert.equal(await rows.count(),7);
  assert.deepEqual(await docs(p),before,'opening journal must not write to storage');
  await p.locator('#qlist button.q').first().click();await p.waitForTimeout(60);await dismiss(p);
  assert.equal(await p.locator('#citadel-daily-details .citadel-daily-quest.is-done').count(),1);
  await context.close();
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
  const {page:p,context}=await open();await p.evaluate(()=>{const b=document.querySelectorAll('#qlist button');b[0].click();b[1].click();});await p.waitForFunction(()=>{const d=PlanSync._docs()['days/2026-10-30'];return d&&d.d.q[0]&&d.d.q[2];});const saved=await docs(p);assert(saved['days/'+date].d.q[0]&&saved['days/'+date].d.q[2],'rapid daily writes must preserve both marks');
  const scheduled=await p.evaluate(()=>{for(let n=1;n<=90;n++){const d=new Date(2026,10,n),k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),t=__qa.trial(k);if(t&&t.sq)return {k,t};}});await context.close();assert(scheduled);
  const b=await open({day:scheduled.k});await b.page.evaluate(()=>{const plus=[...document.querySelectorAll('#trialbox button')].find(b=>b.textContent==='+10');plus.click();plus.click();});await b.page.evaluate(()=>__qa.idle());await b.page.waitForFunction(k=>PlanSync._docs()['trial/'+k]?.d.sq===20,scheduled.k);assert.equal((await docs(b.page))['trial/'+scheduled.k].d.sq,20);await b.context.close();
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
 await check('room construction spends essence, preserves shop cores and rejects replay',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);
  await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-enter').click();
  const before=await docs(p),points=await p.evaluate(()=>__qa.points()),essence=before['cfg/abyss-economy'].d.earned;
  await p.locator('#citadel-upgrade').click();await p.evaluate(()=>__qa.idle());
  await p.waitForFunction(()=>__qa.roomLevel('rest')===2);
  assert.equal((await docs(p))['buys/citadel-rest-2'].d.cost,5);
  await p.evaluate(()=>{__qa.upgrade('rest',1);__qa.upgrade('rest',1);});await p.evaluate(()=>__qa.idle());
  assert.equal(await p.evaluate(()=>__qa.points().avail),points.avail);
  await p.locator('#citadel-upgrade').click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(()=>__qa.roomLevel('rest')===3);
  const after=await docs(p),now=await p.evaluate(()=>__qa.points());
  assert.deepEqual({...now,avail:points.avail},points,'construction must preserve shop cores');
  assert.equal(now.avail,points.avail);
  assert.equal(after['buys/citadel-rest-3'].d.cost,12);
  assert.equal(after['cfg/abyss-economy'].d.earned,essence);
  for(const [key,value]of Object.entries(before))assert.deepEqual(after[key],value,'construction modified pre-existing '+key);
  assert(await p.locator('#citadel-upgrade').isDisabled());assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-level'),'3');
  await p.reload();await castle(p);await p.locator('#citadel-enter').click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-level'),'3');
  await p.locator('#citadel-castle').screenshot({path:resolve(out,'citadel-castle-mobile.png')});await p.locator('#citadel-interior').screenshot({path:resolve(out,'citadel-interior-mobile.png')});await p.screenshot({path:resolve(out,'citadel-renovated-mobile.png'),fullPage:true});await p.setViewportSize({width:1280,height:900});await p.screenshot({path:resolve(out,'citadel-renovated-desktop.png'),fullPage:true});await context.close();
 });
 await check('rank, funds and failed durable storage block construction without partial charge',async()=>{
  const low=await open();await castle(low.page);await low.page.locator('#citadel-enter').click();assert(await low.page.locator('#citadel-upgrade').isDisabled());
  const before=await docs(low.page);await low.page.evaluate(()=>__qa.upgrade('rest',1));await low.page.evaluate(()=>__qa.idle());assert.deepEqual(await docs(low.page),before);await low.context.close();
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);await p.locator('#citadel-enter').click();const original=await docs(p);
  await p.evaluate(()=>{window.__realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic storage full','QuotaExceededError');return window.__realSet.call(this,k,v);};});
  await p.locator('#citadel-upgrade').click();await p.evaluate(()=>__qa.idle());assert.deepEqual(await docs(p),original,'failed persistence must not grant a room or charge');assert.match(await p.locator('#toast').innerText(),/База заполнена/);
  await p.evaluate(()=>{Storage.prototype.setItem=window.__realSet;});await p.locator('#citadel-upgrade').click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(()=>__qa.roomLevel('rest')===2);await context.close();
 });
 await check('concurrent tabs share last essence and shop cores remain independent',async()=>{
  const seed=advancedSeed(),probe=await open({seed,day:'2027-04-16'}),points=await probe.page.evaluate(()=>__qa.points()),claims=await probe.page.evaluate(()=>__qa.abyssEvents());await probe.context.close();
  seed['buys/previous']={name:'Synthetic prior purchase',cost:points.upgrades-1};
  seed['cfg/abyss-economy']={version:1,rank:points.L,earned:5,claims};
  const {page:p,context}=await open({seed,day:'2027-04-16'});await castle(p);await p.locator('#citadel-enter').click();
  const other=await context.newPage();await other.clock.install({time:new Date('2027-04-16T14:00:00+03:00')});await other.goto(url);await other.waitForFunction(()=>window.__qa&&document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await dismiss(other);
  await Promise.all([p.evaluate(()=>{__qa.upgrade('rest',1);return __qa.idle();}),other.evaluate(()=>{__qa.upgrade('study',1);return __qa.idle();})]);
  await p.waitForFunction(()=>Object.keys(PlanSync._docs()).some(k=>k.startsWith('buys/citadel-')));await other.waitForTimeout(80);
  let saved=await docs(p);assert.equal(Object.keys(saved).filter(k=>/^buys\/citadel-/.test(k)).length,1);assert.equal(await p.evaluate(()=>__qa.points().avail),1);
  const cart={id:'qa-shop',cost:1,at:1};
  cart.at=1;await write(p,'cfg/cart',cart);
  await p.evaluate(id=>{__qa.buy({id,name:'Synthetic stale shop purchase'});return __qa.idle();},cart.id);
  saved=await docs(p);assert(Object.keys(saved).some(k=>k.startsWith('buys/shop-')));assert.equal(await p.evaluate(()=>__qa.points().avail),0);
  await context.close();
 });
 await check('shop purchase is atomic and keeps original 24 hour wait',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});const points=await p.evaluate(()=>__qa.points());
  const now=await p.evaluate(()=>Date.now());await write(p,'cfg/cart',{id:'qa-item',cost:1,at:now});
  await p.evaluate(()=>{__qa.buy({id:'qa-item',name:'Synthetic item'});return __qa.idle();});assert.equal(await p.evaluate(()=>__qa.points().avail),points.avail);
  await write(p,'cfg/cart',{id:'qa-item',cost:1,at:1});
  await p.evaluate(()=>{__qa.buy({id:'qa-item',name:'Synthetic item'});__qa.buy({id:'qa-item',name:'Synthetic item'});return __qa.idle();});
  await p.waitForFunction(()=>__qa.S.cart===null);assert.equal(await p.evaluate(()=>__qa.points().avail),points.avail-1);assert.equal((await docs(p))['cfg/cart'].d,null);await context.close();
 });
 await check('resident schedules, progress-aware dialogue and room journals read original state',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);
  const clock=async hour=>{await p.clock.setSystemTime(new Date('2027-04-16T'+String(hour).padStart(2,'0')+':00:00+03:00'));await p.evaluate(()=>__qa.render());await dismiss(p);};
  for(const [hour,room,count]of [[2,'rest',4],[8,'study',4],[14,'forge',1],[19,'refectory',4],[22,'forge',1]]){
   await clock(hour);assert.equal(await p.locator('[data-croom="'+room+'"] .citadel-person').count(),count);assert(await p.locator('[data-croom="'+room+'"] .citadel-person').evaluateAll(nodes=>nodes.every(n=>{const a=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return getComputedStyle(n).position==='absolute'&&a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;})), 'resident sprites must be visible inside rooms');
  }
  await clock(14);const before=await docs(p);await p.locator('#citadel-residents button').filter({hasText:'Хранительница'}).click();assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/завершены/);assert.deepEqual(await docs(p),before);
  await write(p,'days/2027-04-16',{q:Array(10).fill(false),steps:0,kcal:2500});assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/0 из/);
  await p.locator('#citadel-npc-actions button').filter({hasText:'Где ты?'}).click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),'archive');assert.match(await p.locator('#citadel-room-journal').innerText(),/Летопись недели/);
  await p.locator('#citadel-room-journal-open').click();assert(await p.locator('#week').isVisible());
  await p.locator('[data-croom="study"]').click();await p.locator('#citadel-enter').click();assert.match(await p.locator('#citadel-room-journal').innerText(),/0 \//);await context.close();
 });
 await check('all room upgrades and interiors stay usable at narrow and desktop sizes',async()=>{
  const {page:p,context}=await open({width:320,seed:advancedSeed(),day:'2027-04-16'});await castle(p);const before=await p.evaluate(()=>__qa.points().avail);
  for(const room of ['throne','observatory','rest','study','archive','forge']){
   await p.locator('[data-croom="'+room+'"]').click();await p.locator('#citadel-enter').click();
   await p.setViewportSize({width:390,height:900});await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'graphics-room-'+room+'-level-1.png')});
   for(const level of [2,3]){const beforePixels=await p.locator('#citadel-interior-stage').screenshot();await p.locator('#citadel-upgrade').click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(({room,level})=>__qa.roomLevel(room)===level,{room,level});const afterPixels=await p.locator('#citadel-interior-stage').screenshot();assert(!beforePixels.equals(afterPixels),'renovation must change visible pixels: '+room+' '+level);await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'graphics-room-'+room+'-level-'+level+'.png')});}
   for(const width of [320,360,390,430,768,1280]){
    await p.setViewportSize({width,height:900});
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+room+' at '+width);
    assert(await p.locator('#citadel-interior').evaluate(n=>n.scrollWidth<=n.clientWidth),'interior overflow '+room+' at '+width+' '+JSON.stringify(await p.locator('#citadel-interior').evaluate(n=>({self:{w:n.clientWidth,sw:n.scrollWidth,r:n.getBoundingClientRect().right},children:Array.from(n.querySelectorAll('*')).map(c=>({id:c.id,cls:c.className,w:c.getBoundingClientRect().width,r:c.getBoundingClientRect().right,sw:c.scrollWidth,cw:c.clientWidth})).filter(c=>c.r>n.getBoundingClientRect().right-1)}))));
    assert.equal(await p.locator('.citadel-interior-renovation').evaluate(n=>getComputedStyle(n).display),'block');
    await p.locator('#citadel-interior-object').focus();await p.keyboard.press('Enter');assert((await p.locator('#citadel-object-status').innerText()).includes(':'));
   }
   await dismiss(p);await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'citadel-room-'+room+'.png')});
  }
  assert.equal(await p.evaluate(()=>__qa.points().avail),before);await p.reload();await castle(p);
  assert(await p.evaluate(()=>['throne','observatory','rest','study','archive','forge'].every(room=>__qa.roomLevel(room)===3)));
  await context.close();
 });
 await check('construction during a slow Sheets upload is automatically sent afterwards',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});
  let rows=[['path','json','u']],hold=false,release,onStart;
  const started=new Promise(r=>onStart=r),blocked=new Promise(r=>release=r);
  await context.route('**/*googleapis.com/**',async route=>{
   const req=route.request(),u=req.url();let data={};
   if(u.includes('drive/v3/files?'))data={files:[{id:'QA_SHEET',name:'plan-data'}]};
   else if(u.includes('/about?'))data={user:{emailAddress:'qa@example.invalid'}};
   else if(u.includes('values/data!A:C'))data={values:rows};
   else if(u.includes('values/data!A1')&&req.method()==='PUT'){rows=JSON.parse(req.postData()).values;if(hold){hold=false;onStart();await blocked;}}
   else throw Error('Unexpected synthetic API request');
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await p.evaluate(()=>{window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'synthetic-token',expires_in:3600})})}}};});
  await p.evaluate(()=>PlanSync.sync(true));
  await write(p,'cfg/citadel',{selectedRoom:'study',decor:{}});hold=true;
  await p.evaluate(()=>{window.__slowUpload=PlanSync.sync(false);});await started;
  await p.evaluate(()=>{__qa.upgrade('study',1);return __qa.idle();});await p.waitForFunction(()=>__qa.roomLevel('study')===2);
  await p.clock.runFor(3100);release();await p.evaluate(()=>window.__slowUpload);
  await p.clock.runFor(3200);
  // Wait on actual API traffic rather than assuming fetch finishes on the clock tick.
  await p.waitForFunction(()=>document.querySelector('.pl-chip').textContent==='✓');
  assert(rows.some(r=>r[0]==='buys/citadel-study-2'),'the new payment must be sent without a manual sync');
  await context.close();
 });
 await check('connected castle graph excludes locked rooms and every tier has real exits',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);
  const graph=await p.evaluate(()=>{
   const w=CitadelWorld,rooms=Object.keys(w.ranks),paths=[];
   for(const from of rooms)for(const to of rooms)paths.push({from,to,path:w.route(from,to,99)});
   return {rooms,paths,graph:w.graph,locked:w.route('rest','vault',1),unknown:w.route('missing','rest',99),short:w.route('rest','study',1)};
  });
  assert.equal(graph.rooms.length,10);assert.deepEqual(graph.locked,[]);assert.deepEqual(graph.unknown,[]);assert.deepEqual(graph.short,['rest','hall-1','study']);
  for(const {from,to,path}of graph.paths){assert.equal(path[0],from);assert.equal(path.at(-1),to);for(let i=1;i<path.length;i++)assert(graph.graph[path[i-1]].includes(path[i]),'nonadjacent route edge');}
  await p.locator('[data-croom="gatehouse"]').click();await p.locator('#citadel-enter').click();
  assert((await p.locator('#citadel-exits [data-travel]').count())>=3);
  await p.locator('#citadel-exits [data-travel="archive"]').click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),'archive');
  assert.equal(await p.locator('#citadel-avatar').getAttribute('data-route'),'gatehouse hall-3 hall-2 archive');
  await p.evaluate(()=>__qa.idle());await p.reload();await castle(p);assert.equal(await p.locator('[data-croom="archive"]').getAttribute('aria-pressed'),'true');
  await context.close();
 });
 await check('a new player can return from the gatehouse through stairs past locked rooms',async()=>{
  const {page:p,context}=await open({width:320});await castle(p);assert.equal(await p.evaluate(()=>__qa.points().L),1);
  await p.locator('[data-croom="gatehouse"]').click();await p.locator('#citadel-enter').click();assert(await p.locator('#citadel-exits [data-travel="archive"]').isDisabled());
  await p.locator('#citadel-exits [data-travel="rest"]').click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),'rest');assert.equal(await p.locator('#citadel-avatar').getAttribute('data-route'),'gatehouse hall-3 hall-2 hall-1 rest');await context.close();
 });
 await check('all new rooms, paid renovations, doors and objects work at six viewport widths',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);const before=await p.evaluate(()=>__qa.points());
  for(const room of ['gatehouse','refectory','cloister','vault']){
   await p.locator('[data-croom="'+room+'"]').click();await p.locator('#citadel-enter').click();
   await p.setViewportSize({width:390,height:900});await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'graphics-room-'+room+'-level-1.png')});
   for(const level of [2,3]){const beforePixels=await p.locator('#citadel-interior-stage').screenshot();await p.locator('#citadel-upgrade').click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(({room,level})=>__qa.roomLevel(room)===level,{room,level});const afterPixels=await p.locator('#citadel-interior-stage').screenshot();assert(!beforePixels.equals(afterPixels),'renovation must change visible pixels: '+room+' '+level);await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'graphics-room-'+room+'-level-'+level+'.png')});}
   for(const width of [320,360,390,430,768,1280]){
    await p.setViewportSize({width,height:900});
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+room+' at '+width);
    assert(await p.locator('#citadel-interior').evaluate(n=>n.scrollWidth<=n.clientWidth),'interior overflow '+room+' at '+width+' '+JSON.stringify(await p.locator('#citadel-interior').evaluate(n=>({self:{w:n.clientWidth,sw:n.scrollWidth,r:n.getBoundingClientRect().right},children:Array.from(n.querySelectorAll('*')).map(c=>({id:c.id,cls:c.className,w:c.getBoundingClientRect().width,r:c.getBoundingClientRect().right,sw:c.scrollWidth,cw:c.clientWidth})).filter(c=>c.r>n.getBoundingClientRect().right-1)}))));
    await p.locator('#citadel-interior-object').focus();await p.keyboard.press('Enter');assert.match(await p.locator('#citadel-object-status').innerText(),/:/);
    assert(await p.locator('#citadel-exits button:enabled').count());
    if(width===320||width===1280)await p.locator('#citadel-interior').screenshot({path:resolve(out,'cycle2-'+room+'-'+width+'.png')});
   }
  }
  const after=await p.evaluate(()=>__qa.points());assert.deepEqual({...after,avail:before.avail},before);assert.equal(after.avail,before.avail);
  await p.setViewportSize({width:390,height:844});await p.locator('#citadel-castle').screenshot({path:resolve(out,'cycle2-five-tiers.png')});
  await p.reload();await castle(p);assert(await p.evaluate(()=>['gatehouse','refectory','cloister','vault'].every(r=>__qa.roomLevel(r)===3)));await context.close();
 });
 await check('NPCs visibly traverse stairs, recover the same route after reload and complete errands',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);
  const time=async text=>{await p.clock.setFixedTime(new Date('2027-04-16T'+text+'+03:00'));await p.evaluate(()=>__qa.render());await dismiss(p);};
  await time('10:00:07');let st=await p.evaluate(()=>__qa.npcState('smith'));assert(st.moving);assert(st.path.includes('hall-2'));assert.equal(st.destination,'forge');
  const sprite=p.locator('#citadel-castle > .citadel-person[data-person="smith"]');assert.equal(await sprite.count(),1);
  const a=await sprite.boundingBox();await time('10:00:09');const b=await sprite.boundingBox();assert(a.x!==b.x||a.y!==b.y,'resident must physically move');
  st=await p.evaluate(()=>__qa.npcState('smith'));await p.reload();await castle(p);const restored=await p.evaluate(()=>__qa.npcState('smith'));assert.equal(restored.node,st.node);assert.equal(restored.next,st.next);assert(Math.abs(restored.fraction-st.fraction)<.1);
  await p.setViewportSize({width:320,height:700});await p.evaluate(()=>window.dispatchEvent(new Event('resize')));await p.waitForTimeout(40);
  assert(await sprite.evaluate(n=>{const a=n.getBoundingClientRect(),b=document.querySelector('#citadel-castle').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right;}));
  await time('10:02:00');assert.equal(await p.locator('[data-croom="forge"] .citadel-person[data-person="smith"]').count(),1);assert.equal(await p.locator('#citadel-castle > .is-travelling').count(),0);
  await time('14:15:05');assert((await p.evaluate(()=>__qa.npcState('guardian'))).moving);
  await time('14:15:40');assert.equal((await p.evaluate(()=>__qa.npcState('guardian'))).room,'gatehouse');
  await time('14:17:00');assert.equal((await p.evaluate(()=>__qa.npcState('guardian'))).room,'observatory');
  await time('18:00:09');assert((await p.evaluate(()=>__qa.npcState('archivist'))).moving);
  await time('18:02:00');assert.equal(await p.locator('[data-croom="refectory"] .citadel-person').count(),4);
  await p.locator('[data-croom="refectory"]').click();await p.locator('#citadel-enter').click();await p.locator('#citadel-interior-stage [data-person="smith"]').focus();await p.keyboard.press('Enter');assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/Кузнец/);assert.equal(await p.locator('#citadel-interior-stage [data-person="smith"]').getAttribute('data-mode'),'interaction');
  await time('23:00:10');assert((await p.evaluate(()=>__qa.npcState('smith'))).moving);await time('23:02:00');assert.equal(await p.locator('[data-croom="rest"] .citadel-person').count(),4);
  const before=await p.evaluate(()=>__qa.npcState('smith'));await p.clock.setSystemTime(new Date('2027-04-17T00:01:00+03:00'));await p.evaluate(()=>__qa.render());assert.equal((await p.evaluate(()=>__qa.npcState('smith'))).room,before.room);
  await context.close();
 });
 await check('resident timer moves through a departure without manual renders or save writes',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);
  await p.locator('#citadel-home').evaluate(n=>n.open=false);await p.clock.setSystemTime(new Date('2027-04-16T18:00:00+03:00'));await castle(p);
  const before=await docs(p);const a=await p.locator('#citadel-castle > [data-person="guardian"]').boundingBox();await p.clock.runFor(7000);
  const b=await p.locator('#citadel-castle > [data-person="guardian"]').boundingBox();assert(a.x!==b.x||a.y!==b.y);
  await p.clock.runFor(65000);assert.equal(await p.locator('[data-croom="refectory"] .citadel-person').count(),4);assert.deepEqual(await docs(p),before,'NPC simulation must not write progress');await context.close();
 });
 await check('animation follows connected hero path and reduced motion disables animation',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);
  await p.emulateMedia({reducedMotion:'no-preference'});await p.evaluate(()=>__qa.move('vault'));
  const info=await p.locator('#citadel-avatar').evaluate(n=>({route:n.dataset.route,frames:n.getAnimations().flatMap(a=>a.effect.getKeyframes()).filter(k=>k.left)}));
  assert.equal(info.route,'rest hall-1 hall-2 hall-3 hall-4 vault');assert.equal(info.frames.length,6);
  await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>__qa.move('study'));assert.equal(await p.locator('#citadel-avatar').evaluate(n=>n.getAnimations().length),0);
  await p.locator('#citadel-home').evaluate(n=>n.open=false);await p.clock.setSystemTime(new Date('2027-04-16T18:02:00+03:00'));await castle(p);await p.waitForFunction(()=>document.querySelectorAll('[data-croom="refectory"] .citadel-person').length===4);await context.close();
 });
 await check('room conversations stay near the resident, navigate to their task and close on departure',async()=>{
  const {page:p,context}=await open({width:320,seed:advancedSeed(),day:'2027-04-16'});await castle(p);
  await p.locator('[data-croom="forge"]').click();await p.locator('#citadel-enter').click();await p.locator('#citadel-interior-stage [data-person="smith"]').dispatchEvent('click');
  assert(await p.locator('#citadel-room-conversation').isVisible());assert.match(await p.locator('#citadel-room-speech').innerText(),/Кузнец/);assert(await p.locator('#citadel-room-conversation').evaluate(n=>n.scrollWidth<=n.clientWidth));
  const before=await docs(p);await p.locator('#citadel-room-npc-action').click();assert(await p.locator('#wardrobe').isVisible());
  // Return through the existing task tab, then finish the conversation.
  await p.locator('.tab[data-t="today"]').click();await p.locator('#citadel-room-npc-close').click();assert(await p.locator('#citadel-room-conversation').isHidden());assert.deepEqual(await docs(p),before);
  await p.locator('#citadel-interior-stage [data-person="smith"]').dispatchEvent('click');await p.clock.setFixedTime(new Date('2027-04-16T18:00:09+03:00'));await p.evaluate(()=>__qa.render());assert(await p.locator('#citadel-room-conversation').isHidden());
  const dest=await p.locator('.citadel-scene-door').first().getAttribute('data-stage-door');assert(await p.locator('.citadel-scene-door').first().evaluate(n=>n.getBoundingClientRect().width>=44));await p.locator('.citadel-scene-door').first().click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),dest);await context.close();
 });
 await check('two tab cosmetic patches retain other rooms and current selected destination',async()=>{
  const seed=structuredClone(initial);seed['cfg/citadel']={selectedRoom:'study',decor:{}};const {page:p,context}=await open({seed});await castle(p);const other=await context.newPage();await other.clock.install({time:new Date(date+'T14:00:00+03:00')});await other.goto(url);await castle(other);await dismiss(other);
  await Promise.all([p.evaluate(()=>__qa.decor('rest','banner')),other.evaluate(()=>__qa.decor('study','banner'))]);
  await p.evaluate(()=>__qa.idle());await other.evaluate(()=>__qa.idle());await p.waitForFunction(()=>PlanSync._docs()['cfg/citadel']?.d.decor?.study==='banner'&&PlanSync._docs()['cfg/citadel']?.d.decor?.rest==='banner');
  assert.equal((await docs(p))['cfg/citadel'].d.decor.rest,'banner');assert.equal((await docs(p))['cfg/citadel'].d.selectedRoom,'study');await context.close();
 });
 await check('independent offline device spends expose conflict after merge and block further construction',async()=>{
  const seed=advancedSeed(),probe=await open({seed,day:'2027-04-16'}),points=await probe.page.evaluate(()=>__qa.points()),claims=await probe.page.evaluate(()=>__qa.abyssEvents());await probe.context.close();seed['cfg/abyss-economy']={version:1,rank:points.L,earned:5,claims};
  const a=await open({seed,day:'2027-04-16'}),b=await open({seed,day:'2027-04-16'});
  await Promise.all([a.page.evaluate(()=>{__qa.upgrade('gatehouse',1);return __qa.idle();}),b.page.evaluate(()=>{__qa.upgrade('study',1);return __qa.idle();})]);
  const remote=await docs(b.page);await a.page.evaluate(remote=>PlanSync.importObj({v:1,docs:remote}),remote);await a.page.waitForFunction(()=>Object.keys(PlanSync._docs()).filter(k=>k.startsWith('buys/citadel-')).length===2);
  await castle(a.page);await a.page.locator('[data-croom="rest"]').click();await a.page.locator('#citadel-enter').click();assert(await a.page.locator('#citadel-upgrade').isDisabled());assert.match(await a.page.locator('#citadel-building-balance').innerText(),/Эссенция Бездны: -5/);
  const before=await docs(a.page);await a.page.evaluate(()=>{__qa.upgrade('rest',1);return __qa.idle();});assert.deepEqual(await docs(a.page),before);await a.context.close();await b.context.close();
 });
 await check('NPC event reactions follow durable quests, weekly progress, renovations, resources and development',async()=>{
  const day='2027-04-16',seed=advancedSeed();seed['days/'+day]={q:Array(10).fill(false),steps:0,kcal:2500};
  const {page:p,context}=await open({seed,day});await castle(p);
  const speak=async name=>{await p.locator('#citadel-residents button').filter({hasText:name}).click();return p.locator('#citadel-npc-dialogue').innerText();};
  const first=await speak('Хранительница');const second=await speak('Хранительница');assert.notEqual(first,second,'explicit conversations should vary');
  await p.evaluate(()=>__qa.render());assert.equal(await p.locator('#citadel-npc-dialogue').innerText(),second,'idle renders must not rotate speech');
  await p.locator('#qlist button.q').first().click();await p.evaluate(()=>__qa.idle());await p.waitForTimeout(70);await dismiss(p);
  assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/ещё одно дело завершено/);
  const changed=structuredClone((await docs(p))['days/'+day].d);changed.q[7]=true;await write(p,'days/'+day,changed);
  assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/Недельные записи продвинулись/);
  await p.evaluate(()=>{__qa.upgrade('forge',1);return __qa.idle();});await p.waitForFunction(()=>__qa.roomLevel('forge')===2);
  assert.match(await speak('Кузнец'),/Мастерская улучшена/);assert.match(await speak('Казначей'),/Расход занесён/);
  await p.clock.fastForward(31*60000);await p.evaluate(()=>__qa.render());
  await write(p,'weights/development',{date:day,kg:140,ts:2});assert.match(await speak('Кузнец'),/перемены в твоей подготовке/);
  const before=await docs(p);await p.locator('#citadel-npc-actions button').filter({hasText:'Завершить разговор'}).click();assert.equal(await p.locator('#citadel-npc-dialogue').innerText(),'');
  await speak('Страж');await p.keyboard.press('Escape');assert.equal(await p.locator('#citadel-npc-actions button').count(),0);assert.deepEqual(await docs(p),before);
  await p.reload();await castle(p);assert.match(await speak('Кузнец'),/Горн обустроен/);await context.close();
 });
 await check('guardian reacts to real trial completion and yesterday failure without applying extra rewards',async()=>{
  const probe=await open({seed:advancedSeed(),day:'2027-04-16'});
  const trial=await probe.page.evaluate(()=>{for(let n=1;n<10;n++){const d=new Date(2027,3,n),k=d.getFullYear()+'-04-'+String(n).padStart(2,'0'),t=__qa.trial(k);if(t)return {k,t};}});await probe.context.close();assert(trial);
  const seed=advancedSeed();seed['days/'+trial.k]={q:Array(10).fill(true),steps:0,kcal:2100};seed['trial/'+trial.k]={sq:0,pu:0};
  const {page:p,context}=await open({seed,day:trial.k});await castle(p);await p.locator('#citadel-residents button').filter({hasText:'Страж'}).click();assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/ещё активно/);
  await write(p,'trial/'+trial.k,{sq:trial.t.sq,pu:trial.t.pu});await write(p,'days/'+trial.k,{q:Array(10).fill(true),steps:Math.max(50000,trial.t.st),kcal:2100});assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/Испытание выдержано/);
  const points=await p.evaluate(()=>__qa.points());for(let i=0;i<3;i++)await p.locator('#citadel-residents button').filter({hasText:'Страж'}).click();assert.deepEqual(await p.evaluate(()=>__qa.points()),points);
  await write(p,'trial/'+trial.k,{sq:0,pu:0});await write(p,'days/'+trial.k,{q:Array(10).fill(true),steps:0,kcal:2100});
  await p.clock.setSystemTime(new Date(trial.k+'T14:00:00+03:00').getTime()+86400000);await p.evaluate(()=>__qa.render());await dismiss(p);await p.locator('#citadel-residents button').filter({hasText:'Страж'}).click();assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/Вчерашнее испытание осталось незавершённым/);await context.close();
 });
 await check('atomic merge and import reject storage failure and malformed records without changing progress',async()=>{
  const {page:p,context}=await open();const before=await docs(p);
  const remote={'cfg/citadel':{d:{selectedRoom:'study',decor:{}},u:Date.now()}};
  const fail=await p.evaluate(async remote=>{
   const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic full','QuotaExceededError');return original.call(this,k,v);};
   try{await PlanSync.importObj({v:1,docs:remote});return false;}catch{return true;}finally{Storage.prototype.setItem=original;}
  },remote);assert(fail);assert.deepEqual(await docs(p),before);
  await p.reload();await castle(p);assert.deepEqual(await docs(p),before,'reload must retain original durable snapshot');
  for(const bad of [{docs:{'days/bad':{d:{q:[]},u:'invalid'}}},{docs:{'bad':{d:{},u:1}}},{docs:{'cfg/invalid':{d:[],u:1}}}]){
   assert(await p.evaluate(async bad=>{try{await PlanSync.importObj(bad);return false;}catch{return true;}},bad));assert.deepEqual(await docs(p),before);
  }
  await p.evaluate(remote=>PlanSync.importObj({v:1,docs:remote}),remote);await p.waitForTimeout(60);assert((await docs(p))['cfg/citadel']);
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.recovery.v1')).docs),before);await context.close();
 });
 await check('backup download and explicit restore round trip preserve progress and disable automatic cloud writes',async()=>{
  const {page:p,context}=await open();const before=await docs(p);
  const downloadEvent=p.waitForEvent('download');await p.evaluate(()=>PlanSync.exportBackup());const download=await downloadEvent;
  const copy=JSON.parse(await readFile(await download.path(),'utf8'));assert.deepEqual(copy.docs,before);assert.equal(Object.keys(copy).includes('token'),false);
  await write(p,'days/'+date,{q:Array(10).fill(true),steps:8000});await write(p,'spont/after-backup',{name:'Synthetic later entry',done:true,date});
  await p.locator('.pl-chip').click();const menu=p.locator('.pl-menu');assert(await menu.isVisible());
  p.once('dialog',d=>d.accept());const chooserEvent=p.waitForEvent('filechooser');await menu.getByRole('button',{name:'ВОССТАНОВИТЬ КОПИЮ ИЗ ФАЙЛА',exact:true}).click();const chooser=await chooserEvent;
  await chooser.setFiles({name:'synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(copy))});
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('plan.meta.v1'))?.syncPaused===true);await p.waitForTimeout(70);const after=await docs(p);
  for(const [path,record]of Object.entries(before))assert.deepEqual(after[path].d,record.d);assert.equal(after['spont/after-backup'].d,null);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.meta.v1')).signed),false);
  await p.reload();await castle(p);assert.deepEqual((await docs(p))['days/'+date].d,before['days/'+date].d);await context.close();
 });
 await check('Sheets conflicts survive reload, pause uploads, export both copies and resolve by explicit choice',async()=>{
  for(const choice of ['local','remote']){
   const {page:p,context}=await open();let puts=0,rows=[['path','json','u']];
   await context.route('**/*googleapis.com/**',async route=>{const req=route.request(),u=req.url();if(u.includes('fonts.googleapis.com'))return route.fulfill({contentType:'text/css',body:''});let data={};if(u.includes('drive/v3/files?'))data={files:[{id:'QA_SHEET'}]};else if(u.includes('/about?'))data={user:{emailAddress:'qa@example.invalid'}};else if(u.includes('values/data!A:C'))data={values:rows};else if(req.method()==='PUT'){puts++;rows=JSON.parse(req.postData()).values;}else throw Error('Unexpected synthetic request');await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});});
   await p.evaluate(()=>{window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'synthetic-token',expires_in:3600})})}}};});
   await p.evaluate(()=>PlanSync.sync(true));const uploaded=puts;
   await p.clock.fastForward(1000);await write(p,'days/'+date,{q:Array(10).fill(true),steps:8000});const local=await docs(p);
   const remote={q:Array(10).fill(false),steps:9000};rows=rows.map(r=>r[0]==='days/'+date?[r[0],JSON.stringify(remote),local['days/'+date].u+5]:r);
   await p.evaluate(()=>PlanSync.sync(false));assert.equal(puts,uploaded);assert.deepEqual(await docs(p),local);assert(await p.evaluate(()=>!!localStorage.getItem('plan.conflict.v1')));
   await p.reload();await castle(p);await p.evaluate(()=>PlanSync.sync(false));assert.equal(puts,uploaded,'reload must not silently upload conflict');
   await p.locator('.pl-chip').click();const menu=p.locator('.pl-menu');assert.match(await menu.innerText(),/Конфликт устройств/);
   const downloadEvent=p.waitForEvent('download');await menu.getByRole('button',{name:'СОХРАНИТЬ ОБЛАЧНУЮ КОПИЮ',exact:true}).click();const download=await downloadEvent;assert.deepEqual(JSON.parse(await readFile(await download.path(),'utf8')).docs['days/'+date].d,remote);
   p.once('dialog',d=>d.accept());await menu.getByRole('button',{name:choice==='local'?'ОСТАВИТЬ ДАННЫЕ ТЕЛЕФОНА':'ПРИНЯТЬ КОНФЛИКТУЮЩИЕ ДАННЫЕ ОБЛАКА',exact:true}).click();await p.waitForFunction(()=>!localStorage.getItem('plan.conflict.v1'));
   await p.clock.runFor(65000);assert.equal(puts,uploaded,'resolution waits for manual synchronization');
   await p.evaluate(()=>PlanSync.sync(true));assert.equal(puts,uploaded+1,'approved resolution must not conflict forever');assert.deepEqual(JSON.parse(rows.find(r=>r[0]==='days/'+date)[1]),choice==='local'?local['days/'+date].d:remote);
   await context.close();
  }
 });
 await check('reload during a queued purchase leaves no partial charge and a committed purchase survives immediate reload',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);const before=await p.evaluate(()=>__qa.points().avail);
  const other=await context.newPage();await other.clock.install({time:new Date('2027-04-16T14:00:00+03:00')});await other.goto(url);await castle(other);
  await other.evaluate(()=>{window.__held=false;window.__block=navigator.locks.request('plan.store.v1',()=>{window.__held=true;return new Promise(r=>{window.__release=r;});});});await other.waitForFunction(()=>__held);
  await p.evaluate(()=>{__qa.upgrade('rest',1);});await p.waitForFunction(async()=>{const state=await navigator.locks.query();return state.pending.some(l=>l.name==='plan.store.v1');});
  await p.reload();await other.evaluate(()=>__release());await other.evaluate(()=>__block);await castle(p);
  assert.equal((await docs(p))['buys/citadel-rest-2'],undefined);assert.equal(await p.evaluate(()=>__qa.points().avail),before);
  await p.evaluate(()=>{__qa.upgrade('rest',1);});await p.waitForFunction(()=>!!JSON.parse(localStorage.getItem('plan.store.v1')).docs['buys/citadel-rest-2']);
  await p.reload();await castle(p);assert.equal(await p.evaluate(()=>__qa.points().avail),before);assert.equal(await p.evaluate(()=>__qa.roomLevel('rest')),2);
  assert.equal(Object.keys(await docs(p)).filter(k=>k==='buys/citadel-rest-2').length,1);await context.close();
 });
 await check('backup includes the gameplay action queued immediately before download',async()=>{
  const {page:p,context}=await open();const event=p.waitForEvent('download');
  await p.evaluate(()=>{document.querySelector('#qlist button').click();return PlanSync.exportBackup();});
  const download=await event,copy=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(copy.docs['days/'+date].d.q[0],true,'download must include preceding queued quest');await context.close();
 });
 await check('expired Google session still opens backup and conflict controls without authorization',async()=>{
  const {page:p,context}=await open();
  await p.evaluate(()=>{const m=JSON.parse(localStorage.getItem('plan.meta.v1'));m.signed=true;localStorage.setItem('plan.meta.v1',JSON.stringify(m));localStorage.setItem('plan.conflict.v1',JSON.stringify({docs:{'cfg/conflict':{d:{value:true},u:1}},paths:['cfg/conflict']}));});
  await p.reload();await castle(p);await p.locator('.pl-chip').click();assert(await p.locator('.pl-menu').isVisible(),'backup menu must open even when token expired');
  assert(await p.locator('.pl-menu').getByRole('button',{name:'СОХРАНИТЬ ОБЛАЧНУЮ КОПИЮ',exact:true}).isVisible());await context.close();
 });
 await check('restore waits for in-flight Sheets synchronization in the same and another tab',async()=>{
  for(const otherTab of [false,true]){
   const {page:p,context}=await open();let rows=[['path','json','u']],puts=0,hold=false,release,onRead;
   const started=new Promise(r=>onRead=r),blocked=new Promise(r=>release=r);
   await context.route('**/*googleapis.com/**',async route=>{const req=route.request(),u=req.url();let data={};if(u.includes('fonts.googleapis.com'))return route.fulfill({body:'',contentType:'text/css'});if(u.includes('drive/v3/files?'))data={files:[{id:'QA_SHEET'}]};else if(u.includes('/about?'))data={user:{emailAddress:'qa@example.invalid'}};else if(u.includes('values/data!A:C')){if(hold){hold=false;onRead();await blocked;}data={values:rows};}else if(req.method()==='PUT'){puts++;rows=JSON.parse(req.postData()).values;}else throw Error('Unexpected synthetic request');await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});});
   let target=p;if(otherTab){target=await context.newPage();await target.clock.install({time:new Date(date+'T14:00:00+03:00')});await target.goto(url);await castle(target);}
   await p.evaluate(()=>{window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'synthetic-token',expires_in:3600})})}}};});
   await p.evaluate(()=>PlanSync.sync(true));const copy=await docs(p);await write(p,'cfg/after-copy',{value:true});
   hold=true;await p.evaluate(()=>{window.__sync=PlanSync.sync(false);});await started;
   await target.evaluate(copy=>{window.__restoreDone=false;window.__restore=PlanSync.importObj({v:1,docs:copy},true).then(()=>{window.__restoreDone=true;});},copy);
   await target.waitForTimeout(80);assert.equal(await target.evaluate(()=>__restoreDone),false,'restore must wait rather than be overwritten by a delayed cloud response');
   release();await p.evaluate(()=>__sync);await target.evaluate(()=>__restore);const after=await docs(target),uploaded=puts;
   for(const [path,record]of Object.entries(copy))assert.deepEqual(after[path].d,record.d);assert.equal(after['cfg/after-copy'].d,null);
   await p.evaluate(()=>PlanSync.sync(false));await target.evaluate(()=>PlanSync.sync(false));assert.equal(puts,uploaded,'no automatic writes after completed restore');
   assert.equal(await target.evaluate(()=>JSON.parse(localStorage.getItem('plan.meta.v1')).syncPaused),true);await context.close();
  }
 });
 await check('failed pre-update copy keeps old save read-only until storage recovers',async()=>{
  const {page:p,context}=await open({failUpgrade:true});const before=await docs(p);
  const rejected=await p.evaluate(async()=>{try{const db=await claude.use('db');await db.doc('cfg/blocked').set({value:true});return false;}catch{return true;}});assert(rejected);assert.deepEqual(await docs(p),before);
  await p.locator('.pl-chip').click();assert.match(await p.locator('.pl-menu').innerText(),/только для чтения/);
  const downloaded=p.waitForEvent('download');await p.locator('.pl-menu').getByRole('button',{name:'СОХРАНИТЬ РЕЗЕРВНУЮ КОПИЮ',exact:true}).click();const file=await downloaded;assert.deepEqual(JSON.parse(await readFile(await file.path(),'utf8')).docs,before);
  await p.reload();await castle(p);await write(p,'cfg/recovered',{value:true});assert((await docs(p))['cfg/recovered']);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.pre-update.v1')).docs),before);await context.close();
 });
 await check('rank advancement is observed from actual shared progress without NPC save writes',async()=>{
  const complete=advancedSeed(),seed=structuredClone(complete),restore={};
  for(let d=1;d<=30;d++){const k='2027-03-'+String(d).padStart(2,'0');for(const col of ['days','per']){restore[col+'/'+k]=seed[col+'/'+k];delete seed[col+'/'+k];}}
  const {page:p,context}=await open({seed,day:'2027-04-16'});await castle(p);const before=await p.evaluate(()=>__qa.points().L);assert(before>=5);
  await p.locator('#citadel-residents button').filter({hasText:'Страж'}).click();
  await p.evaluate(async restore=>{const db=await claude.use('db');await db.runTransaction(tx=>{for(const [path,value]of Object.entries(restore))tx.set(path,value);});},restore);
  await p.waitForTimeout(100);await dismiss(p);assert(await p.evaluate(()=>__qa.points().L)>before);
  assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/Новый ранг/);const saved=await docs(p);await p.evaluate(()=>__qa.render());assert.deepEqual(await docs(p),saved);await context.close();
 });
 await check('production PWA upgrades previous release and keeps a pre-update recovery copy',async()=>{
  for(const name of ['index.html','localdb.js','sw.js'])servedOverrides.set(resolve(root,name),execFileSync('git',['show','893e9be:docs/'+name]));
  const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow',serviceWorkers:'allow',reducedMotion:'reduce'});context.setDefaultTimeout(20000);
  await context.addInitScript(seed=>{localStorage.setItem('plan.shell.classic.v1','1');if(!localStorage.getItem('qa-init')){localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs:Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]))}));localStorage.setItem('qa-init','1');}localStorage.setItem('wsum','2027-04-12');localStorage.setItem('msum','2027-04');localStorage.setItem('trialSeen','2027-04-16');},advancedSeed());
  await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.clock.install({time:new Date('2027-04-16T14:00:00+03:00')});
  await p.addLocatorHandler(p.locator('#achup:not([hidden]),#lvup:not([hidden]),#setup:not([hidden]),#trophy:not([hidden])').first(),()=>dismiss(p));
  await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await castle(p);assert.equal(await p.evaluate(()=>APP_VERSION),'0.57');
  await p.locator('[data-croom="study"]').click();await p.locator('#citadel-enter').click();await p.locator('#citadel-upgrade').click();await p.waitForFunction(()=>!!PlanSync._docs()['buys/citadel-study-2']);
  const before=await docs(p);servedOverrides.clear();await p.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});await p.waitForFunction(()=>document.querySelector('.pl-chip').textContent==='ОБНОВИТЬ');
  await p.locator('.pl-chip').click();await p.locator('.pl-menu').getByRole('button',{name:'ОБНОВИТЬ ПРИЛОЖЕНИЕ',exact:true}).click();await p.waitForFunction(v=>window.APP_VERSION===v,currentVersion);await p.waitForLoadState('load');await p.waitForFunction(()=>navigator.serviceWorker.controller?.state==='activated');await castle(p);
  const migrated=await docs(p);for(const [key,value]of Object.entries(before))if(key!=='cfg/abyss-economy')assert.deepEqual(migrated[key],value,'update must preserve '+key);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.pre-update.v1')).docs),before);
  await p.clock.runFor(1000);await context.setOffline(true);await p.reload();await castle(p);assert.equal(await p.evaluate(()=>APP_VERSION),currentVersion);for(const [key,value]of Object.entries(before))if(key!=='cfg/abyss-economy')assert.deepEqual((await docs(p))[key],value);await p.locator('#citadel-enter').click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-level'),'2');await context.close();
 });
 await check('production PWA construction offline survives reload with one durable payment',async()=>{
  const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow',serviceWorkers:'allow',reducedMotion:'reduce'});context.setDefaultTimeout(15000);
  await context.addInitScript(seed=>{localStorage.setItem('plan.shell.classic.v1','1');if(!localStorage.getItem('qa-init')){localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs:Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]))}));localStorage.setItem('qa-init','1');}localStorage.setItem('wsum','2027-04-12');localStorage.setItem('msum','2027-04');localStorage.setItem('trialSeen','2027-04-16');},advancedSeed());
  await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.clock.install({time:new Date('2027-04-16T14:00:00+03:00')});
  await p.addLocatorHandler(p.locator('#achup:not([hidden]),#lvup:not([hidden]),#setup:not([hidden]),#trophy:not([hidden])').first(),()=>dismiss(p));
  await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await castle(p);
  await context.setOffline(true);await p.reload();await castle(p);assert(await p.evaluate(()=>!!window.CitadelWorld));const artCache=await p.evaluate(async()=>Promise.all(['citadel-art.css','assets/citadel/rest.webp','assets/citadel/sky.webp','assets/citadel/roof.svg','assets/citadel/abandoned.svg','assets/citadel/guardian.svg','assets/citadel/rest-upgrade3.svg'].map(path=>caches.match(new URL(path,location.href)).then(Boolean))));assert(artCache.every(Boolean),'offline shell must include textures, roof, room states, sprites and renovation art');await p.locator('[data-croom="gatehouse"]').click();await p.locator('#citadel-enter').click();await p.locator('#citadel-exits [data-travel="archive"]').click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),'archive');await p.locator('[data-croom="study"]').click();await p.locator('#citadel-enter').click();const before=await p.locator('#upg').innerText();
  await p.locator('#citadel-upgrade').click();await p.waitForFunction(()=>!!PlanSync._docs()['buys/citadel-study-2']);await p.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.level==='2');
  assert.equal(Number(await p.locator('#upg').innerText()),Number(before));await p.reload();await castle(p);await p.locator('#citadel-enter').click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-level'),'2');
  assert.equal(Object.keys(await docs(p)).filter(k=>k==='buys/citadel-study-2').length,1);assert.equal(Number(await p.locator('#upg').innerText()),Number(before));await context.close();
 });
 await check('production PWA offline reload and offline writes persist',async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await p.reload();await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.evaluate(async()=>{const db=await claude.use('db');await db.doc('cfg/citadel').set({selectedRoom:'study',decor:{study:'banner'}});});await p.reload();await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.waitForFunction(()=>!!window.__citadelShell&&!!document.querySelector('[data-croom="study"][aria-pressed="true"]'));await p.locator('[data-croom="study"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});assert.equal(await p.locator('#citadel-interior-decoration').getAttribute('data-decor'),'banner');await context.close();
 });
 assert.deepEqual(errors,[],'browser runtime errors');console.log(`PASS ${passed} scenario groups; no runtime errors`);
} catch(error) {console.error('FAIL',currentCheck,error.name,String(error.message).split('Call log:')[0].split('\n')[0],String(error.stack).split('\n').find(line=>/citadel\.mjs:\d/.test(line))||'');process.exitCode=1;} finally {await browser.close();await new Promise(r=>server.close(r));}
