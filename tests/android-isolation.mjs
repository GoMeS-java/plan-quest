// Only synthetic data; localhost here is a secure-context browser test, not a physical Android test.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve('.'), errors=[], requests=[];
const server=createServer(async(req,res)=>{try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
 if(!file.startsWith(root+'/android-test/')&&!file.startsWith(root+'/docs/'))throw Error();
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'text/plain');
 res.setHeader('Cache-Control','no-cache');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} )});
const shotDir=resolve(process.env.TEST_OUTPUT||'test-results');await mkdir(shotDir,{recursive:true});
let passed=0;
try{
 const ctx=await browser.newContext({viewport:{width:320,height:640},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'allow'});
 await ctx.route('https://**/*',route=>{requests.push(route.request().url());return route.fulfill({body:'',contentType:'text/css'});});
 // Simulate unrelated production data, authentication and cache on the same origin.
 const production=JSON.stringify({v:1,docs:{'cfg/production-sentinel':{d:{value:'unchanged'},u:1}}});
 await ctx.addInitScript(production=>{localStorage.setItem('plan.shell.classic.v1','1');if(!localStorage.getItem('qa-init')){localStorage.setItem('plan.store.v1',production);localStorage.setItem('plan.meta.v1',JSON.stringify({signed:true,sheetId:'PRODUCTION_DO_NOT_USE'}));localStorage.setItem('plan.tok',JSON.stringify({t:'synthetic-production-token',exp:Date.now()+3600000}));localStorage.setItem('qa-init','1');}},production);
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(url+'/android-test/');
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!window.PlanSync);
 await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
 const dismiss=()=>p.evaluate(()=>{for(const id of ['achup','lvup','setup','trophy']){const n=document.getElementById(id);if(n)n.hidden=true;}});await dismiss();
 assert.equal(await p.title(),'Вкач · ТЕСТ');
 const testManifest=await p.evaluate(async()=>await (await fetch('manifest.json')).json());
 assert.equal(testManifest.name,'Вкач · ТЕСТ');assert.equal(testManifest.short_name,'Вкач ТЕСТ');
 assert.equal(testManifest.id,'./android-test');
 for(const icon of testManifest.icons){const response=await p.request.get(url+'/android-test/'+icon.src);assert.equal(response.status(),200);assert.equal(response.headers()['content-type'],'image/png');assert((await response.body()).length>1000);}
 const productionManifest=JSON.parse(await readFile(resolve(root,'docs/manifest.json'),'utf8'));
 assert.equal(productionManifest.name,'Вкач');assert.equal(productionManifest.short_name,'Вкач');
 assert.equal(productionManifest.start_url,'./');assert.equal(productionManifest.scope,'./');
 assert.equal(productionManifest.display,'standalone');
 // Branding is metadata-only: the installed application's origin/scope and
 // the local-save namespace must stay stable through an update.
 const oldManifest={name:'Заклятие Кошмара',short_name:'Кошмар',start_url:'./',scope:'./',display:'standalone',orientation:'any',background_color:'#100f19',theme_color:'#17121f',lang:'ru'};
 for(const key of ['start_url','scope','display','orientation','background_color','theme_color','lang'])assert.equal(productionManifest[key],oldManifest[key],'renaming must preserve '+key);
 assert.equal(productionManifest.id,undefined,'do not change production PWA identity');
 assert.deepEqual(productionManifest.icons.map(i=>[i.src,i.sizes,i.purpose]),[['icon-192.png','192x192','any'],['icon-512.png','512x512','any'],['icon-512-maskable.png','512x512','maskable']]);
 for(const icon of productionManifest.icons){const data=await readFile(resolve(root,'docs',icon.src));assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(data.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}

 assert.equal(await p.evaluate(()=>PLAN_CONFIG.cloudEnabled),false);assert.equal(await p.evaluate(()=>PLAN_CONFIG.clientId),'');
 assert.equal(await p.evaluate(()=>localStorage.getItem('plan.store.v1')),production);
 assert.equal(await p.evaluate(()=>!!PlanSync._docs()['cfg/production-sentinel']),false);
 await p.evaluate(()=>caches.open('plan-unrelated-production-cache').then(c=>c.put('/production-sentinel',new Response('unchanged'))));
 await p.locator('.pl-chip').click();assert(await p.locator('.pl-menu').getByRole('button',{name:'ВОЙТИ ЧЕРЕЗ GOOGLE',exact:true}).isDisabled());
 await p.evaluate(async()=>{await PlanSync.sync(true);await PlanSync.sync(false);});
 assert(!requests.some(u=>u.includes('accounts.google.com')||u.includes('sheets.googleapis.com')||u.includes('/drive/')),'test must not request OAuth, Drive or Sheets');
 console.log('PASS isolated build never reads production save or uses production auth');passed++;
 const original=await p.evaluate(()=>JSON.parse(JSON.stringify(PlanSync._docs())));
 const downloadEvent=p.waitForEvent('download');await p.locator('.pl-menu').getByRole('button',{name:'СОХРАНИТЬ РЕЗЕРВНУЮ КОПИЮ',exact:true}).click();const download=await downloadEvent;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));assert.deepEqual(backup.docs,original);assert(!JSON.stringify(backup).includes('synthetic-production-token'));
 await p.locator('.pl-menu').getByRole('button',{name:'ЗАКРЫТЬ',exact:true}).click();await dismiss();
 await p.locator('#qlist button.q').first().click();await p.waitForFunction(()=>Object.entries(PlanSync._docs()).some(([k,v])=>k.startsWith('days/')&&v.d?.q?.[0]));await dismiss();assert(await p.evaluate(()=>!!localStorage.getItem('plan.android-test.store.v1')));
 const saved=await p.evaluate(()=>JSON.parse(JSON.stringify(PlanSync._docs())));await ctx.setOffline(true);await p.reload();await dismiss();await p.waitForFunction(()=>!!window.PlanSync);
 assert.deepEqual(await p.evaluate(()=>PlanSync._docs()),saved);
 assert.equal(await p.evaluate(()=>localStorage.getItem('plan.store.v1')),production);
 assert(await p.evaluate(()=>caches.has('plan-unrelated-production-cache')));
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.locator('.pl-chip').click();p.once('dialog',d=>d.accept());const fileEvent=p.waitForEvent('filechooser');await p.locator('.pl-menu').getByRole('button',{name:'ВОССТАНОВИТЬ КОПИЮ ИЗ ФАЙЛА',exact:true}).click();const chooser=await fileEvent;
 await chooser.setFiles({name:'test-copy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await p.waitForFunction(()=>JSON.parse(localStorage.getItem('plan.android-test.meta.v1')).syncPaused===true);
 for(const [k,v]of Object.entries(original))assert.deepEqual((await p.evaluate(()=>PlanSync._docs()))[k].d,v.d);
 assert.equal(await p.evaluate(()=>localStorage.getItem('plan.store.v1')),production);await ctx.setOffline(false);await p.evaluate(()=>PlanSync.sync(true));
 assert(!requests.some(u=>u.includes('accounts.google.com')||u.includes('sheets.googleapis.com')||u.includes('/drive/')));
 console.log('PASS isolated PWA offline write, reload, JSON restore and reconnect preserve production sentinel');passed++;
 const manifest=JSON.parse(await readFile('android-test/manifest.json','utf8'));assert.equal(manifest.short_name,'Вкач ТЕСТ');assert.equal(manifest.id,'./android-test');
 // Activate another scoped worker; it must not remove the first app shell cache.
 const before=await p.evaluate(()=>caches.keys());const q=await ctx.newPage();await q.goto(url+'/docs/');await q.evaluate(()=>navigator.serviceWorker.ready);await q.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const after=await p.evaluate(()=>caches.keys());for(const name of before)assert(after.includes(name),'another scope removed '+name);
 await ctx.setOffline(true);await p.reload();await p.waitForFunction(()=>!!PlanSync);assert.equal(await p.title(),'Вкач · ТЕСТ');
 console.log('PASS separate manifest and scoped service worker caches coexist');passed++;
 await ctx.close();
 // Exercise the exact isolated release bundle, not an instrumented production page.
 for(const [width,height] of [[320,760],[360,800],[390,844],[430,900],[844,390]])for(const populated of [false,true]){
  const mobile=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  const day=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'}),seed={};
  if(populated){seed['cfg/opening']={cash:5000,card:10000};seed['tx/test-wheel']={amt:125.5,kind:'out',acc:'cash',cat:'Продукты',what:'Тестовая операция',date:day,ts:1,counted:true};}
  await mobile.addInitScript(seed=>{localStorage.setItem('plan.android-test.store.v1',JSON.stringify({v:1,docs:Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]))}));},seed);
  await mobile.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));
  const t=await mobile.newPage();t.on('pageerror',e=>errors.push(String(e)));await t.goto(url+'/android-test/');
  await t.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
  await t.evaluate(()=>{for(const id of ['achup','lvup','setup','trophy'])document.getElementById(id).hidden=true;});
  await t.evaluate(()=>PlanSync.beforeUpdate());
  const financial=()=>t.evaluate(()=>Object.fromEntries(Object.entries(PlanSync._docs()).filter(([k])=>k==='cfg/opening'||k==='cfg/abyss-economy'||k.startsWith('tx/')||k.startsWith('buys/'))));
  const before=await financial(),version=(await readFile('src/version.txt','utf8')).trim();
  assert.equal(await t.evaluate(()=>APP_VERSION),version);assert.equal(await t.evaluate(()=>PLAN_CONFIG.cloudEnabled),false);
  if(!(await t.locator('.citadel-shell-nav').isVisible())){if(await t.locator('.citadel-shell-menu-toggle').isVisible())await t.locator('.citadel-shell-menu-toggle').click();else await t.locator('.citadel-shell-dock button').last().click();}
  await t.locator('.citadel-shell-nav [data-section="money"]').click();
  for(const id of ['wheel','spend','money','avito','wheel']){
   await t.locator('[data-finance="'+id+'"]').click();
   assert.equal(await t.locator('.citadel-finance-nav [aria-selected="true"]').getAttribute('data-finance'),id);
   assert(await t.locator('.citadel-finance-nav button').evaluateAll(ns=>ns.every(n=>n.scrollWidth<=n.clientWidth&&n.getBoundingClientRect().height>=44)));
   assert(await t.locator('.citadel-system-content').evaluate(n=>n.scrollWidth<=n.clientWidth));
  }
  assert.equal(await t.locator('#donutwrap').isVisible(),populated);
  if(populated)assert.match(await t.locator('#dc-sum').innerText(),/126/);else assert(await t.locator('.finance-empty').isVisible());
  if(width===390)await t.screenshot({path:resolve(shotDir,'android-069-test-wheel-'+(populated?'filled':'empty')+'-390.png')});
  await t.locator('.citadel-system-dialog header button').click();
  const camera=t.locator('.citadel-shell-camera');await camera.getByRole('button',{name:'Общий вид',exact:true}).click();
  await t.locator('[data-croom="study"]').click();await t.locator('#citadel-interior').waitFor({state:'visible'});
  await t.locator('[data-room-view="overview"]').click();
  await camera.getByRole('button',{name:'+',exact:true}).click();
  for(let repeat=0;repeat<3;repeat++){
   await camera.getByRole('button',{name:'К комнате',exact:true}).click();
   assert(await t.locator('.citadel-viewport').evaluate(v=>{const r=document.querySelector('[data-croom="study"]').getBoundingClientRect(),b=v.getBoundingClientRect();let ancestors=true;for(let n=v.parentElement;n;n=n.parentElement)if(n.scrollLeft!==0||n.scrollTop!==0)ancestors=false;return ancestors&&r.right>b.left&&r.left<b.right&&r.bottom>b.top&&r.top<b.bottom;}));
  }
  if(width===390&&!populated)await t.screenshot({path:resolve(shotDir,'android-069-test-room-focus-390.png')});
  await camera.getByRole('button',{name:'Общий вид',exact:true}).click();
  assert(await t.locator('.citadel-viewport').evaluate(v=>v.scrollLeft===0&&v.scrollTop===0&&document.querySelector('#citadel-castle').getBoundingClientRect().width<=v.clientWidth+1));
  if(width===390&&!populated)await t.screenshot({path:resolve(shotDir,'android-069-test-overview-390.png')});
  assert(await t.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(await financial(),before);assert.equal(await t.evaluate(()=>localStorage.getItem('plan.store.v1')),null);
  await mobile.close();
 }
 console.log('PASS isolated mobile wheel navigation and camera at 320, 360, 390, 430 and landscape preserve synthetic finances and economy');passed++;
 // Defense in depth against accidentally enabling the production client or wrong origin.
 const fakeOrigin='https://android-isolation.invalid';
 for(const cfg of [
  {cloudEnabled:true,clientId:'PROD',productionClientId:'PROD',allowedOrigin:fakeOrigin},
  {cloudEnabled:true,clientId:'TEST',productionClientId:'PROD',allowedOrigin:'https://wrong-origin.invalid'},
  {cloudEnabled:false,clientId:'TEST',productionClientId:'PROD',allowedOrigin:fakeOrigin},
  {cloudEnabled:true,clientId:'TEST',productionClientId:'PROD',allowedOrigin:fakeOrigin,fileName:'plan-data'}
 ]){
  const c=await browser.newContext({serviceWorkers:'block'});let external=0;
  await c.route('**/*',async route=>{const u=route.request().url();if(u===fakeOrigin+'/config.js')return route.fulfill({contentType:'text/javascript',body:'window.PLAN_CONFIG='+JSON.stringify({testMode:true,fileName:'plan-data-android-test',...cfg})});if(!u.startsWith(fakeOrigin+'/')){if(/accounts.google.com|sheets.googleapis.com|\/drive\//.test(u))external++;return route.fulfill({body:'',contentType:'text/css'});}const path=new URL(u).pathname;return route.fulfill({path:resolve('android-test','.'+(path==='/'?'/index.html':path))});});
  const t=await c.newPage();await t.goto(fakeOrigin+'/');await t.waitForFunction(()=>!!PlanSync);await t.evaluate(()=>PlanSync.sync(true));assert.equal(external,0);await c.close();
 }
 console.log('PASS invalid test OAuth configuration fails closed');passed++;
 assert.deepEqual(errors,[]);console.log('PASS '+passed+' Android-build isolation groups; no runtime errors');
}catch(e){console.error('FAIL Android-build isolation:',e?.stack||String(e));process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));}
