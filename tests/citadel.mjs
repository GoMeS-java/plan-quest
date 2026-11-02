// Synthetic saves only. Never print achievement definitions or personal save data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve, extname, sep} from 'node:path';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = resolve('docs'), out = resolve(process.env.TEST_OUTPUT || 'test-results');
const currentVersion = (await readFile(resolve('src/version.txt'),'utf8')).trim();
await mkdir(out, {recursive:true});
const expose = `window.__qa={cosmeticsIdle:function(){return (typeof fateBusy==='undefined'||!fateBusy&&Object.keys(fateQueued||{}).length===0&&(!window.VkachFate||VkachFate.pending(S.fate).length===0)&&fateSignature===JSON.stringify([lastGI.ach,S.fate]))&&(typeof legendBusy==='undefined'||!legendBusy&&legendSignature===legendInputSignature()&&!legendOwned().some(function(d){return !d.presented;}));},privateNotesSafe:function(){var t=document.querySelector('.release-notes').textContent.toLocaleLowerCase();return LEG.every(function(g){var item=ROOM_OF[g.id]&&ROOM_ITEMS[ROOM_OF[g.id]];return !item||!!lastGI.ach[g.id]||!t.includes(item.n.toLocaleLowerCase());});},scene:typeof legendScene==='function'?legendScene:null,equip:typeof equipItem==='function'?equipItem:null,progressSequence:function(){return typeof heroProgressSequence==='undefined'?0:heroProgressSequence;},faceResidents:typeof citadelFaceResidents==='function'?citadelFaceResidents:null,loading:function(){return loaded;},readiness:function(){return {loaded,pending,seen:Object.keys(seen)};},sheet:function(){return citadelHeroSheet;},shape:typeof bodyShape==='function'?bodyShape:null,outfitCheck:function(){var old=bodyShapeNow;try{return [.6,.76,1].every(function(f){bodyShapeNow=f;return BUILTIN.every(function(it){var ids={top:"knit_beige",bottom:"pants_brown",outer:"none"};ids[it.slot]=it.id;var a=buildSprite(outfitFrom(allItems(),ids));return a.length===32*52&&a.some(function(c,i){return Math.floor(i/32)===50&&c;})&&a.some(function(c,i){return Math.floor(i/32)===35&&(i%32<10||i%32>21)&&c&&c!==C.out;});});});}finally{bodyShapeNow=old;}},writeDay:typeof dayWrite==='function'?dayWrite:null,exercise:typeof doExercise==='function'?doExercise:null,undoExercise:typeof undoExercise==='function'?undoExercise:null,trialAdd:typeof trialAdd==='function'?trialAdd:null,toggleMeet:typeof toggleMeet==='function'?toggleMeet:null,markProgress:typeof recordRare==='function'?recordRare:null,S:S,balance:balances,points:pointsInfo,trial:trialOf,trialProg:trialProg,render:renderAll,steps:stepInfo,idle:function(){return chain;},upgrade:typeof citadelUpgrade==='function'?citadelUpgrade:null,abyssEvents:typeof abyssEvents==='function'?abyssEvents:null,roomLevel:typeof citadelRoomLevel==='function'?citadelRoomLevel:null,decor:typeof citadelSetDecor==='function'?citadelSetDecor:null,buy:buy,npcState:typeof citadelNpcState==='function'?function(key){return citadelNpcState(citadelPeople.find(p=>p.key===key));}:null,move:typeof citadelMove==='function'?citadelMove:null};`;
// The visual fixture is injected only into this test server, never into a build or save.
const backgroundFixture=`window.__qa.backgroundVisualFixture=function(){window.__qaBackgroundArt={};var rows=Object.keys(COS).filter(function(id){return COS[id].cat==='bg';}).map(function(id){window.__qaBackgroundArt[id]=true;return {id:id,key:COS[id].key};});applyLook();renderLook();return rows;};`;
function instrument(html) { html=html.replace('function renderAllInner() {','function renderAllInner() { window.__qaRenderCount=(window.__qaRenderCount||0)+1;').replace('function unlockedCos() {','function unlockedCos() { if(window.__qaBackgroundArt)return window.__qaBackgroundArt;');const i=html.lastIndexOf('})();'); assert(i>0); return html.slice(0,i)+expose+backgroundFixture+html.slice(i); }
const game = await readFile(resolve(root,'index.html'),'utf8');
// Normalize only the historical fixture's storage bootstrap to the current local adapter.
const baselineSrc = execFileSync('git',['show',process.env.BASELINE_REF || 'c65a44e:src/game.html'],{encoding:'utf8'}).replace(/var cl = window\.\w+;/, 'var cl = {use: function(){return Promise.resolve(window.PlanDB);}};');
const baseline = '<!doctype html><html><head><meta charset="utf-8"><script src="/config.js"></script><script src="/localdb.js"></script></head><body>'+baselineSrc+'</body></html>';
const servedOverrides=new Map();
const server=createServer(async(req,res)=>{try { const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname); const file=resolve(root,'.'+(path==='/'?'/index.html':path)); if(!file.startsWith(root+sep))throw Error(); const body=servedOverrides.has(file)?servedOverrides.get(file):await readFile(file); if(file.endsWith(sep+'sw.js'))res.setHeader('Cache-Control','no-cache'); res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'text/plain');res.end(body); }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} )});
console.log('Browser',browser.version());
const errors=[];let passed=0,currentCheck='setup';
async function check(name,fn){if(process.env.TEST_FILTER&&!new RegExp(process.env.TEST_FILTER).test(name))return;currentCheck=name;await fn();passed++;console.log('PASS',name);}
const date='2026-10-30';
const initial={'cfg/opening':{cash:1200.5,card:3400},'weights/test':{kg:143.7,date,ts:1},['days/'+date]:{q:[false,false,false,false,false,false,false,false,false,false],steps:1200,kcal:2100},'spont/old':{name:'Synthetic task',date,done:false,heavy:true,ts:1},'cfg/outfit':{outer:'none'}};
// Computed keys are assigned separately to remain compatible with plain JavaScript.
async function open({width=390,height=844,mobile=width<600,seed=initial,legacy={},base=false,day=date,sw=false,failUpgrade=false,shell=false,slowCPU=false,fresh=false}={}){
 const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,timezoneId:'Europe/Moscow',reducedMotion:'reduce',serviceWorkers:sw?'allow':'block'});
 context.setDefaultTimeout(15000);
 const page=await context.newPage();const session=slowCPU?await context.newCDPSession(page):null;if(session)await session.send('Emulation.setCPUThrottlingRate',{rate:4});page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
 if(slowCPU)await page.clock.setFixedTime(new Date(day+'T14:00:00+03:00'));else await page.clock.install({time:new Date(day+'T14:00:00+03:00')});
 await context.addInitScript(({seed,legacy,day,failUpgrade,shell,fresh})=>{if(!shell)localStorage.setItem('plan.shell.classic.v1','1');if(!localStorage.getItem('qa-init')){const docs=Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]));if(!fresh)localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs}));for(const [k,v]of Object.entries(legacy))localStorage.setItem(k,v);localStorage.setItem('qa-init','1');}localStorage.setItem('wsum',day.slice(0,7)+'-26');localStorage.setItem('msum',day.slice(0,7));localStorage.setItem('trialSeen',day);if(failUpgrade&&!localStorage.getItem('qa-upgrade-failed')){localStorage.setItem('qa-upgrade-failed','1');window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.pre-update.v1')throw new DOMException('Synthetic full','QuotaExceededError');return window.__originalSetItem.call(this,k,v);};}},{seed,legacy,day,failUpgrade,shell,fresh});
 await context.route('**/*',async route=>{const u=route.request().url();if(u===url+'/'||u===url+'/__baseline')return route.fulfill({contentType:'text/html',body:instrument(base?baseline:game)});if(!u.startsWith(url))return route.fulfill({status:200,body:'',contentType:'text/css'});return route.continue();});
 await page.goto(url+(base?'/__baseline':'/'));try{await page.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');}catch(e){console.log('Initial profile diagnostic',await page.evaluate(()=>({title:document.title,rank:document.querySelector('#citadel-live-rank')?.textContent,readiness:window.__qa?.readiness?.()})).catch(()=>({pageUnavailable:true})),errors);throw e;}
 if(!base&&!failUpgrade){try{await page.waitForFunction(()=>window.__qa?.S.abyss?.version===1&&__qa.S.abyss.rank>=__qa.points().L);}catch(e){if(slowCPU)console.log('CPU startup diagnostic',await page.evaluate(()=>({ready:__qa.loading(),rank:__qa.points().L,economyRank:__qa.S.abyss?.rank,transactions:__qa.S.tx.length,weights:__qa.S.weights.length,tasks:__qa.S.spont.length,renders:window.__qaRenderCount})),errors);throw e;}await page.evaluate(()=>__qa.idle());await page.waitForFunction(()=>__qa.cosmeticsIdle());}
 if(!shell)await page.addLocatorHandler(page.locator('#achup:not([hidden]),#lvup:not([hidden]),#setup:not([hidden]),#trophy:not([hidden]),#legend-scene[open]').first(),()=>dismiss(page));
 await dismiss(page);return {page,context,session};
}
async function dismiss(p){for(let n=0;n<12;n++){await p.evaluate(()=>{document.querySelector('#legend-scene[open]')?.close();for(const id of ['achup','lvup','setup','trophy']){const n=document.getElementById(id);if(n)n.hidden=true;}});await p.clock.runFor(30).catch(()=>{});await p.waitForTimeout(15);if(!await p.locator('#legend-scene[open]').count())return;}}
async function castle(p){await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.locator('#citadel-home').evaluate(n=>n.open=true);await p.waitForFunction(()=>!!document.querySelector('[data-croom][aria-pressed="true"]'));if(await p.locator('#citadel-home').evaluate(n=>n.classList.contains('citadel-shell'))){if(await p.locator('.citadel-system-dialog').isVisible())await p.locator('.citadel-system-dialog header button').first().click();if(await p.locator('#citadel-home').getAttribute('data-ui-view')!=='overview')await p.locator('[data-room-view="overview"]').click();}}
async function shellMenu(p){if(await p.locator('.citadel-shell-menu-toggle').isVisible())await p.locator('.citadel-shell-menu-toggle').click();else await p.locator('.citadel-shell-dock button').last().click();}
async function shellNav(p,label){
 if(await p.locator('.citadel-system-dialog').isVisible()){await p.locator('.citadel-system-dialog header button').first().click();await p.waitForFunction(()=>!document.querySelector('.citadel-system-dialog').open);}
 const quick={'Цитадель':'overview','Задания':'today','Профиль':'wardrobe','Воспоминания':'shop'};
 if(quick[label]){
  const dock=p.locator('.citadel-shell-dock [data-section="'+quick[label]+'"]');
  if(await dock.isVisible()){await dock.click();return;}
 }
 if(label==='Настройки'||label==='Достижения'){
  if(!(await p.locator('.citadel-shell-nav').isVisible()))await shellMenu(p);
  const group=p.locator('.citadel-shell-nav .citadel-menu-group').filter({has:p.locator('summary').filter({hasText:'СИСТЕМА'})});
  if(!(await group.evaluate(n=>n.open)))await group.locator('summary').click();
  await group.locator('[data-section="'+(label==='Настройки'?'settings':'achievements')+'"]').click();
  return;
 }
 if(!(await p.locator('.citadel-shell-nav').isVisible()))await shellMenu(p);
 const target=p.locator('.citadel-shell-nav button').filter({hasText:label}).first();
 await target.evaluate(n=>{const group=n.closest('details');if(group)group.open=true;});
 await target.click();
}
async function shellDrawer(p,side){const b=p.locator('.citadel-shell-tail.'+side);if(!(await p.locator('.citadel-shell-nav').isVisible()))await shellMenu(p);await b.evaluate(n=>{const group=n.closest('details');if(group)group.open=true;});await b.click();}
async function docs(p){return p.evaluate(()=>JSON.parse(JSON.stringify(PlanSync._docs())));}
async function write(p,path,data){await p.evaluate(async({path,data})=>{const db=window.PlanDB;await db.doc(path).set(data);},{path,data});await p.waitForTimeout(40);await dismiss(p);}
function advancedSeed(){
 const seed=structuredClone(initial);
 seed['cfg/abyss-economy']={version:1,rank:1,earned:1000,claims:{}};
 for(let n=0;n<180;n++){const dt=new Date('2026-10-19T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+n);const k=dt.toISOString().slice(0,10),t=dt.getTime();seed['days/'+k]={q:Array(10).fill(true),steps:50000,kcal:2100};seed['per/'+k]={squat:[t,t+7200000,t+14400000],pushup:[t,t+7200000,t+14400000],squatR:[100,100,100],pushupR:[100,100,100],workout:[t]};}
 return seed;
}
function landscapeSeed(){
 const seed=advancedSeed();
 for(let n=0;n<320;n++){const dt=new Date('2026-10-19T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+n);const k=dt.toISOString().slice(0,10),t=dt.getTime();seed['days/'+k]={q:Array(10).fill(true),steps:50000,kcal:2100};seed['per/'+k]={squat:[t,t+7200000,t+14400000],pushup:[t,t+7200000,t+14400000],squatR:[100,100,100],pushupR:[100,100,100],workout:[t]};}
 return seed;
}
async function achievementPreview(p,name){
 await p.evaluate(()=>__qa.idle());await p.waitForFunction(()=>__qa.cosmeticsIdle());
 await p.evaluate(()=>{window.__achievementShot=[];document.querySelectorAll('.achievement-card h3,.achievement-card-details>p,.achievement-history button,.legend-replay').forEach(n=>{__achievementShot.push([n,n.textContent]);n.textContent=n.matches('h3,button')?'Полученная отметина':n.classList.contains('achievement-rewards')?'Полученные награды скрыты в демонстрации.':'Описание скрыто в демонстрации.';});var note=document.createElement('p');note.id='achievement-shot-note';note.className='hint';note.textContent='Демонстрация: названия, условия и награды скрыты.';document.querySelector('#trophy .shead').after(note);});
 try{await p.screenshot({path:resolve(out,name)});}finally{await p.evaluate(()=>{for(const [n,text]of window.__achievementShot||[])if(n.isConnected)n.textContent=text;document.querySelector('#achievement-shot-note')?.remove();delete window.__achievementShot;});}
}
try {

 await check('1.1 every existing background has an applied pixel landscape and private owned preview',async()=>{
  const {page:p,context}=await open({shell:true,seed:landscapeSeed(),day:'2027-09-15',width:430});const before=await docs(p);const variants=await p.evaluate(()=>__qa.backgroundVisualFixture());let n=0;
  await p.emulateMedia({reducedMotion:'no-preference'});
  for(const row of variants){
   await shellNav(p,'Настройки');const sec=p.locator('[data-look-category="bg"]');await sec.evaluate(n=>n.closest('details').open=true);const choice=sec.locator('[data-look-id="'+row.id+'"]');
   assert.equal(await choice.locator('.look-landscape').count(),1);await choice.evaluate(n=>{for(const t of n.childNodes)if(t.nodeType===3)t.textContent='Полученный фон';});
   if(row.key==='winter')assert.equal(await choice.locator('.citadel-realm-detail').evaluate(n=>getComputedStyle(n,'::before').backgroundImage),'none','winter preview must not inherit another selected environment lights');
   await choice.screenshot({path:resolve(out,'v11-all-background-'+String(++n).padStart(2,'0')+'-preview.png')});await choice.click();await p.clock.runFor(80);await p.evaluate(()=>__qa.idle());
   assert.equal(await p.evaluate(()=>document.documentElement.dataset.citadelBg),row.key);assert(await p.locator('.citadel-sky').evaluate((el,key)=>getComputedStyle(el).backgroundImage.includes('realm-'+key+'.svg'),row.key));
   if(row.key!=='winter'){
    const details=await p.locator('.citadel-sky>.citadel-realm-detail').evaluate(n=>({art:getComputedStyle(n,'::before').backgroundImage,name:getComputedStyle(n,'::before').animationName,pointer:getComputedStyle(n).pointerEvents}));assert(details.art.includes('realm-'+row.key+'-life-1.svg'));assert.notEqual(details.name,'none');assert.equal(details.pointer,'none');
    if(['city','beach','cave','aurora'].includes(row.key)){
     await shellNav(p,'Настройки');await sec.evaluate(n=>n.closest('details').open=true);await choice.evaluate(n=>{for(const t of n.childNodes)if(t.nodeType===3)t.textContent='Полученный фон';});await choice.hover();assert.equal(await choice.locator('.citadel-realm-detail').evaluate(n=>getComputedStyle(n,'::before').animationPlayState),'running');
     let first,last;for(let frame=0;frame<8;frame++){await p.waitForTimeout(250);last=await choice.screenshot({path:resolve(out,'v11-live-'+row.key+'-frame-'+frame+'.png')});if(!first)first=last;}assert.notDeepEqual(last,first,'the themed preview must visibly animate');
     await p.locator('#setup-x').click();
    }
   }
  }
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.citadel-sky>.citadel-realm-detail').evaluate(n=>getComputedStyle(n,'::before').animationName),'none');await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('#citadel-home').evaluate(n=>n.classList.add('citadel-suspended'));assert.equal(await p.locator('.citadel-sky>.citadel-realm-detail').evaluate(n=>getComputedStyle(n,'::before').animationPlayState),'paused');await p.locator('#citadel-home').evaluate(n=>n.classList.remove('citadel-suspended'));
  const count=await p.locator('.citadel-window-weather').count();await p.evaluate(()=>{__qa.render();__qa.render();});assert.equal(await p.locator('.citadel-window-weather').count(),count,'render does not accumulate weather layers');assert.equal(await p.locator('.citadel-sky>.citadel-realm-detail').count(),1);
  const after=await docs(p);for(const data of [before,after]){delete data['cfg/look'];delete data['cfg/citadel'];}assert.deepEqual(after,before,'visual fixtures and selection cannot grant achievements or rewards');await context.close();
 });
 await check('1.1 winter fills top and bottom panes while preserving frames and foreground at every stage',async()=>{
  const day='2027-09-15';const {page:p,context}=await open({shell:true,seed:{...landscapeSeed(),'cfg/rare':{z02:day},'cfg/look':{bg:'b_winter'}},day,width:1280,height:940,mobile:false});
  const pixels=await p.evaluate(async()=>{
   async function mask(level){const img=new Image();img.src='assets/citadel/rest-windows-'+level+'.svg';await img.decode();const c=document.createElement('canvas');c.width=480;c.height=320;const x=c.getContext('2d');x.drawImage(img,0,0,480,320);return x.getImageData(0,0,480,320).data;}
   const a=await mask(1),b=await mask(3);let top=0,bottom=0,occluded=0;const upper=[],lower=[];for(let y=31;y<176;y++)for(let x=106;x<150;x++){const i=(y*480+x)*4;if(b[i]>240){if(y<39)top++;if(y>143)bottom++;if(y>40&&y<58)upper.push([x,y]);if(y>147&&y<162)lower.push([x,y]);}}for(let i=0;i<a.length;i+=4)if(a[i]>240&&b[i]<10)occluded++;return {top,bottom,occluded,mullion:b[(119*480+128)*4],points:[upper[Math.floor(upper.length/2)],lower[Math.floor(lower.length/2)]]};
  });assert(pixels.top>0,'glass above the old mask must be filled');assert(pixels.bottom>100,'lower pane must be filled');assert(pixels.occluded>0,'stage furniture is cut out of the exterior mask');assert.equal(pixels.mullion,0,'mullions are preserved');
  for(const level of [1,2,3]){
   await p.evaluate(async level=>{__qa.move('rest');document.querySelector('#citadel-enter').click();if(level>1){await __qa.upgrade('rest',level-1);await __qa.idle();}},level);
   const sample=await p.locator('#citadel-interior-stage .citadel-daylight').evaluate(n=>({mask:getComputedStyle(n,'::after').maskImage,opacity:getComputedStyle(n,'::after').opacity,weather:getComputedStyle(n.querySelector('.citadel-window-weather')).zIndex,backdrop:getComputedStyle(n,'::after').zIndex}));assert(sample.mask.includes('rest-windows-'+level+'.svg'));assert.equal(sample.opacity,'1','old yellow glass cannot bleed through the winter scene');assert(Number(sample.weather)>Number(sample.backdrop));
  }
  await p.emulateMedia({reducedMotion:'reduce'});const stage=p.locator('#citadel-interior-stage');const geometry=await stage.evaluate(n=>({width:n.clientWidth,height:n.clientHeight,left:n.clientLeft,top:n.clientTop}));const shot=await stage.screenshot({path:resolve(out,'v11-winter-complete-panes.png')});
  const colors=await p.evaluate(async({png,points,g})=>{const img=new Image();img.src=png;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return points.map(([px,py])=>Array.from(x.getImageData(Math.round(g.left+(px+.5)*g.width/480),Math.round(g.top+(py+.5)*g.height/320),1,1).data).slice(0,3));},{png:'data:image/png;base64,'+shot.toString('base64'),points:pixels.points,g:geometry});
  assert(colors.every(c=>c[2]>=c[0]),'upper and lower glass must show cold exterior colors, never yellow letterboxing');await context.close();
 });
 await check('1.1 earned winter taiga has quiet roof snow, window blizzard and frost with reduced motion',async()=>{
  const day='2027-09-15',seed={...landscapeSeed(),'cfg/rare':{z02:day}};const {page:p,context}=await open({shell:true,seed,day,width:1280,height:940,mobile:false});
  await p.emulateMedia({reducedMotion:'no-preference'});await shellNav(p,'Настройки');const sec=p.locator('[data-look-category="bg"]');await sec.evaluate(n=>n.closest('details').open=true);await sec.locator('[data-look-id="b_winter"]').click();await p.clock.runFor(80);await p.evaluate(()=>__qa.idle());await castle(p);
  const sky=p.locator('.citadel-sky');assert((await sky.evaluate(n=>getComputedStyle(n).backgroundImage)).includes('realm-winter.svg'));
  const outside=await p.locator('.citadel-realm-particles').evaluate(n=>({name:getComputedStyle(n).animationName,duration:getComputedStyle(n).animationDuration,snow:getComputedStyle(n,'::before').backgroundImage}));assert.equal(outside.name,'citadelQuietSnow');assert.equal(outside.duration,'18s');assert(outside.snow.includes('snow-roof.svg'));
  await sky.screenshot({path:resolve(out,'v11-winter-castle-desktop.png')});
  for(let frame=0;frame<8;frame++){await p.waitForTimeout(180);await sky.screenshot({path:resolve(out,'v11-winter-sky-frame-'+frame+'.png')});}
  await p.evaluate(async()=>{__qa.move('rest');document.querySelector('#citadel-enter').click();await __qa.upgrade('rest',1);await __qa.idle();await __qa.upgrade('rest',2);await __qa.idle();});
  const stage=p.locator('#citadel-interior-stage');const weather=stage.locator('.citadel-window-weather');const snow=await weather.evaluate(n=>({mask:getComputedStyle(n).maskImage,name:getComputedStyle(n).animationName,duration:getComputedStyle(n).animationDuration,pointer:getComputedStyle(n).pointerEvents}));assert(snow.mask.includes('rest-windows-3.svg'));assert.equal(snow.name,'citadelWindowBlizzard');assert.equal(snow.duration,'1.8s');assert.equal(snow.pointer,'none');assert((await stage.locator('.citadel-window-frost').evaluate(n=>getComputedStyle(n).backgroundImage)).includes('rest-frost-3.svg'));
  await stage.screenshot({path:resolve(out,'v11-winter-room-desktop.png')});
  for(let frame=0;frame<8;frame++){await p.waitForTimeout(180);await stage.screenshot({path:resolve(out,'v11-winter-room-frame-'+frame+'.png')});}
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await weather.evaluate(n=>getComputedStyle(n).animationName),'none');assert.equal(await p.locator('.citadel-realm-particles').evaluate(n=>getComputedStyle(n).animationName),'none');
  await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('#citadel-home').evaluate(n=>n.classList.add('citadel-suspended'));assert.equal(await weather.evaluate(n=>getComputedStyle(n).animationPlayState),'paused');await p.locator('#citadel-home').evaluate(n=>n.classList.remove('citadel-suspended'));
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await p.evaluate(()=>__qa.idle());await p.waitForFunction(()=>__qa.cosmeticsIdle());await dismiss(p);assert.equal(await p.evaluate(()=>document.documentElement.dataset.citadelBg),'winter');await context.close();
 });
 await check('1.1 winter frost and blizzard stay in real apertures across rooms and Android widths',async()=>{
  const day='2027-09-15';const {page:p,context}=await open({shell:true,seed:{...landscapeSeed(),'cfg/rare':{z02:day},'cfg/look':{bg:'b_winter'}},day});const before=await docs(p);
  for(const room of ['rest','throne','study','archive','forge','observatory','gatehouse','refectory','cloister','vault']){
   await p.evaluate(room=>{__qa.move(room);document.querySelector('#citadel-enter').click();},room);const layer=p.locator('#citadel-interior-stage .citadel-daylight');
   if(room==='vault')assert.equal(await layer.evaluate(n=>getComputedStyle(n).display),'none','closed vault has no invented window');else{assert((await layer.locator('.citadel-window-weather').evaluate(n=>getComputedStyle(n).maskImage)).includes(room+'-windows-1.svg'));assert((await layer.locator('.citadel-window-frost').evaluate(n=>getComputedStyle(n).backgroundImage)).includes(room+'-frost-1.svg'));}
  }
  await p.evaluate(()=>{__qa.move('rest');document.querySelector('#citadel-enter').click();});
  for(const width of [320,360,390,430,844,1280]){await p.setViewportSize({width,height:width===844?390:900});await p.clock.runFor(80);assert(await p.locator('#citadel-interior-stage').evaluate(n=>n.scrollWidth<=n.clientWidth+1));if(width===390)await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'v11-winter-room-mobile.png')});}
  await p.evaluate(()=>__qa.idle());const after=await docs(p);for(const data of [before,after])delete data['cfg/citadel'];assert.deepEqual(after,before,'weather rendering is read only');await context.close();
 });

 await check('1.1 earned landscape previews apply to sky and real apertures, persist and remove without gameplay writes',async()=>{
  const {page:p,context}=await open({shell:true,seed:landscapeSeed(),day:'2027-09-15'});const before=await docs(p);
  for(const key of ['forest','beach','cave']){
   await shellNav(p,'Настройки');const sec=p.locator('[data-look-category="bg"]');await sec.evaluate(n=>n.closest('details').open=true);
   const choice=sec.locator('[data-look-id="b_'+key+'"]');assert.equal(await choice.count(),1,'existing progress owns this fixture variant');assert(await choice.locator('.look-landscape').evaluate(n=>getComputedStyle(n).backgroundImage.includes('realm-')));
   await choice.evaluate(n=>{for(const t of n.childNodes)if(t.nodeType===3)t.textContent='Полученный фон';});await choice.screenshot({path:resolve(out,'v11-landscape-'+key+'-preview.png')});
   await choice.click();await p.evaluate(()=>__qa.idle());await p.clock.runFor(80);await p.waitForFunction(k=>document.documentElement.dataset.citadelBg===k,key);await castle(p);
   assert(await p.locator('.citadel-sky').evaluate((n,k)=>getComputedStyle(n).backgroundImage.includes('realm-'+k+'.svg'),key));
   await p.screenshot({path:resolve(out,'v11-landscape-'+key+'-390.png')});
   await p.locator('[data-croom="rest"]').click();await p.clock.runFor(80);await p.locator('#citadel-interior').waitFor({state:'visible'});
   const layer=await p.locator('#citadel-interior-stage .citadel-daylight').evaluate(n=>({mask:getComputedStyle(n,'::after').maskImage,art:getComputedStyle(n,'::after').backgroundImage,pointer:getComputedStyle(n,'::after').pointerEvents}));
   assert(layer.mask.includes('rest-windows-1.svg'));assert(layer.art.includes('realm-'+key+'.svg'));assert.equal(layer.pointer,'none');
   await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'v11-landscape-'+key+'-room-390.png')});
   await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await p.evaluate(()=>__qa.idle());await p.waitForFunction(()=>__qa.cosmeticsIdle());await dismiss(p);assert.equal(await p.evaluate(()=>document.documentElement.dataset.citadelBg),key);
  }
  await shellNav(p,'Настройки');const sec=p.locator('[data-look-category="bg"]');await sec.evaluate(n=>n.closest('details').open=true);await sec.locator('[data-look-id=""]').click();await p.evaluate(()=>__qa.idle());assert.equal(await p.evaluate(()=>document.documentElement.dataset.citadelBg),'');assert(!(await p.locator('.citadel-sky').evaluate(n=>getComputedStyle(n).backgroundImage)).includes('realm-'));
  const after=await docs(p);for(const data of [before,after]){delete data['cfg/look'];delete data['cfg/citadel'];}assert.deepEqual(after,before,'selection changes no openings, resources, achievements or progress');await context.close();
 });
 await check('1.1 landscape choices fit mobile and desktop and forged locked selections expose no previews',async()=>{
  const {page:p,context}=await open({shell:true,seed:landscapeSeed(),day:'2027-09-15'});await shellNav(p,'Настройки');const sec=p.locator('[data-look-category="bg"]');await sec.evaluate(n=>n.closest('details').open=true);
  for(const width of [320,360,390,430,844,1280]){
   await p.setViewportSize({width,height:width===844?390:844});await p.clock.runFor(100);
   assert(await sec.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'background selection must not overflow');
   assert(await sec.locator('.realm-choice').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44&&n.getBoundingClientRect().width>=44)));
  }
  await context.close();const locked=await open({shell:true,seed:{...initial,'cfg/look':{bg:'b_forest'}}});assert.equal(await locked.page.evaluate(()=>document.documentElement.dataset.citadelBg),'');await shellNav(locked.page,'Настройки');assert.equal(await locked.page.locator('.look-landscape').count(),0);await locked.context.close();
 });

 await check('1.1 landscape selection rolls back after storage failure and retry preserves sibling appearance',async()=>{
  const {page:p,context}=await open({shell:true,seed:{...landscapeSeed(),'cfg/look':{futureField:'preserve',showcase:['','','']}},day:'2027-09-15'});await shellNav(p,'Настройки');const sec=p.locator('[data-look-category="bg"]');await sec.evaluate(n=>n.closest('details').open=true);
  await p.evaluate(()=>{window.__landscapeStorage=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='plan.store.v1')throw new DOMException('Synthetic full','QuotaExceededError');return __landscapeStorage.call(this,key,value);};});
  await sec.locator('[data-look-id="b_forest"]').click();await p.evaluate(()=>__qa.idle());await p.waitForTimeout(80);assert.equal((await docs(p))['cfg/look'].d.bg||'','');assert.equal(await p.evaluate(()=>document.documentElement.dataset.citadelBg),'','failed selection must not remain applied');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('look')).bg||''),'');
  await p.evaluate(()=>Storage.prototype.setItem=window.__landscapeStorage);await dismiss(p);await shellNav(p,'Настройки');await sec.evaluate(n=>n.closest('details').open=true);await sec.locator('[data-look-id="b_forest"]').click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(()=>document.documentElement.dataset.citadelBg==='forest');const saved=(await docs(p))['cfg/look'].d;assert.equal(saved.bg,'b_forest');assert.equal(saved.futureField,'preserve');assert.deepEqual(saved.showcase,['','','']);await context.close();
 });

 await check('1.1 RPG achievement collection keeps unopened definitions and counts out of the interface',async()=>{
  const {page:p,context}=await open({shell:true});const before=await docs(p);await shellNav(p,'Достижения');
  assert.equal(await p.locator('.achievement-card').count(),0);assert.equal(await p.locator('[data-achievement-filter="marks"]').count(),0);assert.equal(await p.locator('[data-achievement-filter="images"]').count(),0);
  await p.locator('[data-achievement-filter="history"]').click();assert(await p.locator('#achievement-history').isVisible());assert.equal(await p.locator('#achievement-history li').count(),1);
  assert(!/\d+\s*(\/|из)\s*\d+|осталось|%/.test(await p.locator('#alist').innerText()),'empty collection must not reveal target totals');assert.deepEqual(await docs(p),before);await context.close();
 });

 await check('1.1 RPG achievement cards, chronology and showcase use existing earned records without new rewards',async()=>{
  const {page:p,context}=await open({shell:true,seed:advancedSeed(),day:'2027-04-16'});const before=await docs(p);await shellNav(p,'Достижения');const count=await p.locator('.achievement-card').count();assert(count>0);
  await p.locator('[data-achievement-filter="marks"]').click();assert(await p.locator('#achievement-grid').isVisible());assert(await p.locator('#achievement-images').isHidden());assert(await p.locator('#sklist').isHidden());
  await p.locator('#trophy').evaluate(n=>n.scrollTop=0);await achievementPreview(p,'v11-achievements-cards-390.png');
  const rare=p.locator('[data-achievement-filter="superrare"]');if(await rare.count()){await rare.click();assert.equal(await p.locator('.achievement-card[data-rarity="mark"]:visible').count(),0);assert(await p.locator('.achievement-card[data-rarity="superrare"]:visible').count()>0);assert.equal(await p.locator('.achievement-card[data-rarity="superrare"]').first().evaluate(n=>getComputedStyle(n,'::after').animationName),'none');await achievementPreview(p,'v11-achievements-rare-390.png');await p.locator('[data-achievement-filter="marks"]').click();}
  const card=p.locator('.achievement-card').first(),id=await card.getAttribute('data-achievement');await card.locator('summary').click();assert(await card.locator('.achievement-card-details').evaluate(n=>n.open));
  const canvas=await card.locator('canvas').evaluate(n=>n.toDataURL());assert(canvas.length>100);await card.locator('[data-showcase-slot="1"]').click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(id=>PlanSync._docs()['cfg/look']?.d.showcase?.[1]===id,id);
  assert.equal(await card.locator('[data-showcase-slot="1"]').getAttribute('aria-pressed'),'true');assert(await card.locator('details').evaluate(n=>n.open),'detail survives preference save');assert.equal(await p.locator('#profile-showcase .profile-award').count(),3);
  await card.locator('[data-showcase-slot="2"]').click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(id=>PlanSync._docs()['cfg/look']?.d.showcase?.[2]===id,id);assert.equal((await docs(p))['cfg/look'].d.showcase.filter(v=>v===id).length,1,'an achievement occupies only one chosen slot');
  await achievementPreview(p,'v11-achievements-detail-390.png');
  await p.locator('[data-achievement-filter="history"]').click();assert.equal(await p.locator('#achievement-history button').count(),count);const dates=await p.locator('#achievement-history time[datetime]').evaluateAll(ns=>ns.map(n=>n.dateTime));assert.deepEqual(dates,dates.slice().sort().reverse());
  await p.locator('#trophy').evaluate(n=>n.scrollTop=0);await achievementPreview(p,'v11-achievements-history-390.png');await p.locator('#achievement-history button').first().click();assert(await p.locator('.achievement-card').first().locator('details').evaluate(n=>n.open));
  const after=await docs(p);delete before['cfg/look'];delete after['cfg/look'];assert.deepEqual(after,before,'collection navigation and showcase do not alter gameplay data');await context.close();
 });

 await check('1.1 RPG collection cards and history fit narrow, landscape and desktop screens',async()=>{
  for(const [width,height]of [[320,760],[430,900],[844,390],[1280,1000]]){
   const {page:p,context}=await open({width,height,shell:true,mobile:width<900,seed:advancedSeed(),day:'2027-04-16'});await shellNav(p,'Достижения');await p.locator('[data-achievement-filter="marks"]').click();await p.locator('.achievement-card').first().locator('summary').click();
   assert(await p.locator('#trophy .sbox').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'card overflow at '+width);assert(await p.locator('.achievement-showcase-actions button').first().evaluate(n=>n.getBoundingClientRect().height>=44));
   if(width===1280)await achievementPreview(p,'v11-achievements-cards-desktop.png');await p.locator('[data-achievement-filter="history"]').click();assert(await p.locator('#trophy .sbox').evaluate(n=>n.scrollWidth<=n.clientWidth+1));await context.close();
  }
 });

 await check('1.1 achievement showcase rejects failed storage without a false selected badge and can retry',async()=>{
  const {page:p,context}=await open({shell:true,seed:{...advancedSeed(),'cfg/look':{showcase:['','',''],futureField:'preserve'}},day:'2027-04-16'});await shellNav(p,'Достижения');await p.locator('[data-achievement-filter="marks"]').click();const card=p.locator('.achievement-card').first(),id=await card.getAttribute('data-achievement');await card.locator('summary').click();
  await p.evaluate(()=>{window.__showcaseStorage=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='plan.store.v1')throw new DOMException('Synthetic full','QuotaExceededError');return __showcaseStorage.call(this,key,value);};});
  await card.locator('[data-showcase-slot="0"]').click();await p.evaluate(()=>__qa.idle());await p.waitForTimeout(80);
  assert.equal((await docs(p))['cfg/look'].d.showcase[0],'');assert.equal(await card.locator('[data-showcase-slot="0"]').getAttribute('aria-pressed'),'false','failed save must not look committed');
  await p.evaluate(()=>{Storage.prototype.setItem=window.__showcaseStorage;});await card.locator('[data-showcase-slot="0"]').click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(id=>PlanSync._docs()['cfg/look']?.d.showcase[0]===id,id);assert.equal((await docs(p))['cfg/look'].d.futureField,'preserve');await context.close();
 });

 await check('1.1 Android nested settings remain interactive above profile and Back unwinds to room',async()=>{
  const {page:p,context}=await open({shell:true,seed:advancedSeed(),day:'2027-04-16'});await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});await shellNav(p,'Профиль');
  const category=p.locator('#profile-collections button:not(:disabled)').first();await category.click();await p.waitForFunction(()=>!document.querySelector('#setup').hidden);
  assert(await p.locator('#setup').evaluate(n=>n.parentElement.matches('.citadel-system-dialog')),'nested settings must be inside the native top layer');
  await p.locator('#fx-shake').selectOption('off');assert.equal(await p.locator('#fx-shake').inputValue(),'off');
  await p.goBack();await p.waitForFunction(()=>document.querySelector('#setup').hidden);assert(await p.locator('.citadel-system-dialog #wardrobe').isVisible());assert(await category.evaluate(n=>n===document.activeElement),'focus returns to the category');
  await category.click();await p.locator('#data-management').click();const menu=p.locator('.pl-menu');await menu.waitFor({state:'visible'});assert(await menu.evaluate(n=>!!n.closest('.citadel-system-dialog')),'backup controls share the active top layer');await p.locator('.citadel-system-dialog').screenshot({path:resolve(out,'v11-android-nested-backup.png')});
  const downloadEvent=p.waitForEvent('download');await menu.getByRole('button',{name:'СОХРАНИТЬ РЕЗЕРВНУЮ КОПИЮ',exact:true}).click();const backup=await downloadEvent;assert(backup.suggestedFilename().endsWith('.json'));
  p.once('dialog',d=>d.accept());const chooserEvent=p.waitForEvent('filechooser');await menu.getByRole('button',{name:'ВОССТАНОВИТЬ КОПИЮ ИЗ ФАЙЛА',exact:true}).click();const chooser=await chooserEvent;await chooser.setFiles([]);
  await p.keyboard.press('Escape');await menu.waitFor({state:'hidden'});assert(await p.locator('#setup').isVisible());assert(await p.locator('.citadel-system-dialog #wardrobe').isVisible());
  await p.locator('#data-management').click();await menu.waitFor({state:'visible'});await p.goBack();await menu.waitFor({state:'hidden'});assert(await p.locator('#setup').isVisible(),'Back closes backup controls before nested settings');
  await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('#setup').hidden);assert(await p.locator('.citadel-system-dialog #wardrobe').isVisible(),'Escape must close only nested settings');
  await p.goBack();await p.waitForFunction(()=>!document.querySelector('.citadel-system-dialog').open);assert.equal(await p.locator('#citadel-home').getAttribute('data-ui-view'),'room');
  await p.goBack();await p.waitForFunction(()=>document.querySelector('#citadel-home').dataset.uiView==='overview');assert.equal(new URL(p.url()).origin,url);await context.close();
 });

 await check('1.1 Android visual keyboard viewport preserves form draft and accessible controls through rotation',async()=>{
  const {page:p,context}=await open({shell:true});await shellNav(p,'Авито');await p.locator('#av-name').fill('Synthetic keyboard draft');
  await p.evaluate(()=>{window.__nativeViewport=window.visualViewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:330,width:390,offsetTop:18,scale:1}});window.dispatchEvent(new Event('resize'));});await p.locator('#av-name').focus();await p.clock.runFor(80);
  const small=await p.locator('.citadel-system-dialog').evaluate(n=>{var r=n.getBoundingClientRect(),a=document.querySelector('#av-name').getBoundingClientRect();return {top:r.top,bottom:r.bottom,inputTop:a.top,inputBottom:a.bottom,keyboard:document.documentElement.classList.contains('citadel-keyboard-open')};});
  assert(small.keyboard);assert(small.top>=18&&small.bottom<=349);assert(small.inputTop>=small.top&&small.inputBottom<=small.bottom,'focused input must be above the visual keyboard');
  await p.locator('.citadel-system-dialog').screenshot({path:resolve(out,'v11-android-keyboard-form.png')});
  await p.setViewportSize({width:844,height:390});await p.clock.runFor(80);assert.equal(await p.locator('#av-name').inputValue(),'Synthetic keyboard draft');assert(await p.locator('.citadel-system-content').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  await p.evaluate(()=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:window.__nativeViewport});window.dispatchEvent(new Event('resize'));});await p.setViewportSize({width:390,height:844});await p.clock.runFor(80);
  assert(!await p.locator('html').evaluate(n=>n.classList.contains('citadel-keyboard-open')));await p.locator('.citadel-system-dialog header button').click();assert(await p.locator('.citadel-shell-dock').isVisible());await context.close();
 });

 await check('1.1 Android background flush restores last section, scroll and camera without progress writes',async()=>{
  const {page:p,context}=await open({shell:true,seed:advancedSeed(),day:'2027-04-16'});await p.clock.runFor(80);const before=await docs(p);
  await p.locator('.citadel-shell-camera button').filter({hasText:'+'}).click();await p.locator('.citadel-viewport').evaluate(n=>n.scrollTo(120,180));await p.clock.runFor(20);
  const camera=await p.locator('.citadel-viewport').evaluate(n=>({left:n.scrollLeft,top:n.scrollTop}));await shellNav(p,'Профиль');await p.locator('.citadel-system-content').evaluate(n=>n.scrollTop=150);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'));});
  const saved=await p.evaluate(()=>({camera:JSON.parse(localStorage.getItem('plan.citadel.camera.v1')),view:JSON.parse(localStorage.getItem('plan.citadel.view.v1'))}));assert.equal(saved.view.section,'wardrobe');assert.equal(saved.camera.left,camera.left);assert.equal(saved.camera.top,camera.top);assert(saved.view.scroll>=100);
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading()&&document.querySelector('.citadel-system-dialog').open&&document.querySelector('#wardrobe').closest('.citadel-system-dialog'));await p.clock.runFor(80);assert(await p.locator('.citadel-system-content').evaluate(n=>n.scrollTop>=100));
  const after=await docs(p);delete before['cfg/citadel'];delete after['cfg/citadel'];assert.deepEqual(after,before,'only presentation preferences may be flushed');
  await p.locator('.citadel-system-dialog').screenshot({path:resolve(out,'v11-android-restored-profile.png')});await context.close();
  const damaged=await open({shell:true,legacy:{'plan.citadel.camera.v1':'{"left":"invalid","top":null,"zoom":999}','plan.citadel.view.v1':'{"version":1,"section":"__proto__","scroll":999999}'}});assert(await damaged.page.locator('#citadel-home').isVisible());assert(!await damaged.page.locator('.citadel-system-dialog').isVisible());await damaged.context.close();
 });

 await check('1.1 lighting follows real apertures, phases and restored sources without game writes',async()=>{
  const {page:p,context}=await open({width:960,height:1000,shell:true,seed:advancedSeed(),day:'2027-04-16'});
  for(const room of ['rest','forge','vault','observatory','cloister']){
   await p.evaluate(async room=>{__qa.move(room);document.querySelector('#citadel-enter').click();await __qa.upgrade(room,1);await __qa.idle();await __qa.upgrade(room,2);await __qa.idle();},room);
  }
  await p.waitForFunction(()=>__qa.cosmeticsIdle());await p.evaluate(()=>__qa.idle());
  const before=await docs(p);
  for(const hour of [14,1]){
   await p.clock.setSystemTime(new Date('2027-04-16T'+String(hour).padStart(2,'0')+':00:00+03:00'));await p.evaluate(()=>__qa.render());await dismiss(p);
   for(const room of ['rest','forge','vault','observatory','cloister']){
    await p.evaluate(room=>{__qa.move(room);document.querySelector('#citadel-enter').click();},room);
    const sample=await p.locator('#citadel-interior-stage').evaluate(n=>({phase:n.dataset.phase,ambient:parseFloat(getComputedStyle(n).getPropertyValue('--ambient')),filter:getComputedStyle(n,'::before').filter,layer:getComputedStyle(n.querySelector('.citadel-daylight')).display,mask:getComputedStyle(n.querySelector('.citadel-daylight'),'::before').maskImage,flame:getComputedStyle(n.querySelector('.citadel-room-light')).backgroundImage,animation:getComputedStyle(n.querySelector('.citadel-room-light')).animationName}));
    assert.equal(sample.phase,hour===14?'ДЕНЬ':'НОЧЬ');assert.equal(sample.ambient,hour===14?1:.66);
    assert.equal(sample.filter,hour===14?'brightness(1)':'brightness(0.66)','actual scene brightness follows time, not only the variable');
    if(room==='vault')assert.equal(sample.layer,'none','closed vault never gains a false window');else assert(sample.mask.includes(room+'-daylight.svg'));
    assert.equal(sample.animation,'none','reduced motion stops local light flicker');
    if(room==='rest'||room==='forge')assert(sample.flame.includes('radial-gradient'),'real restored hearth illuminates nearby floor');
    await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,`v11-light-${room}-${hour===14?'day':'night'}.png`)});
   }
  }
  await p.evaluate(()=>__qa.idle());const after=await docs(p);
  assert.deepEqual(after['cfg/citadel']?.d,before['cfg/citadel']?.d,'final selected room and decoration remain unchanged');
  delete before['cfg/citadel'];delete after['cfg/citadel'];assert.deepEqual(after,before,'time and atmosphere do not change gameplay records');
  await p.evaluate(()=>{__qa.move('rest');document.querySelector('#citadel-enter').click();});
  await p.evaluate(()=>document.documentElement.dataset.citadelBg='rain');
  const rain=await p.locator('.citadel-interior-stage .citadel-daylight').evaluate(n=>{document.documentElement.dataset.citadelBg='rain';return {mask:getComputedStyle(n,'::after').maskImage,mode:getComputedStyle(n,'::after').maskMode,events:getComputedStyle(n).pointerEvents,opacity:getComputedStyle(n,'::after').opacity};});
  assert(rain.mask.includes('rest-apertures.svg'));assert.equal(rain.mode,'luminance');assert.equal(rain.events,'none');assert(Number(rain.opacity)>0);
  await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'v11-light-rest-rain.png')});
  await context.close();
 });

 await check('1.1 profile journey shows actual records, shared equipment and earned collection categories',async()=>{
  const seed=structuredClone(initial);seed['days/2026-10-29']={q:Array(10).fill(true),steps:6500};seed['weights/new']={kg:142.5,date:'2026-10-30',ts:2};
  const {page:p,context}=await open({shell:true,seed});const before=await docs(p);
  await shellNav(p,'Профиль');assert.equal(await p.locator('#profile-week .profile-day').count(),7);assert.equal(await p.locator('#profile-equipment .profile-equipped').count(),3);assert.equal(await p.locator('#profile-collections button').count(),4);
  assert.match(await p.locator('#profile-body-history').innerText(),/142.5 кг/);assert.match(await p.locator('#profile-body-history').innerText(),/-1.2 кг/);
  assert(await p.locator('.profile-day[data-date="2026-10-29"]').getAttribute('aria-label').then(t=>t.includes('6500')));
  const meters=await p.locator('#profile-rank-meter').evaluate(n=>({value:n.value,max:n.max})),points=await p.evaluate(()=>__qa.points());assert.equal(meters.value,points.P);assert.equal(meters.max,points.need);
  const sprites=await p.evaluate(()=>{const a=document.querySelector('#profile-hero'),b=document.querySelector('#citadel-interior-hero');return [a.toDataURL(),b.toDataURL()];});assert.equal(sprites[0],sprites[1],'profile uses current body geometry and exactly the equipped hero');
  await p.locator('.citadel-system-dialog').screenshot({path:resolve(out,'v11-profile-hero-mobile.png')});
  await p.locator('.profile-journey').scrollIntoViewIfNeeded();await p.locator('.citadel-system-dialog').screenshot({path:resolve(out,'v11-profile-journey-mobile.png')});
  assert.deepEqual(await docs(p),before,'history and category navigation must not write progress');
  const category=p.locator('#profile-collections button:not(:disabled)').first();if(await category.count()){await category.click();assert(await p.locator('#setup').isVisible());assert.equal(await p.locator('#looklist .look-group[open]').count(),1);await p.locator('#setup-x').click();}
  await write(p,'days/2026-10-29',{q:Array(10).fill(false),steps:2200});
  assert.match(await p.locator('.profile-day[data-date="2026-10-29"]').getAttribute('aria-label'),/задания 0 из .*шаги 2200/,'corrected existing day updates the profile');
  await write(p,'weights/new',{kg:145,date:'2026-10-30',ts:3});assert.match(await p.locator('#profile-body-history').innerText(),/145 кг/);assert.match(await p.locator('#profile-body-history').innerText(),/\+1.3 кг/);
  assert(await p.evaluate(()=>document.querySelector('#profile-hero').toDataURL()===document.querySelector('#citadel-interior-hero').toDataURL()),'corrected body record updates both shared sprites');
  await p.locator('[data-profile-path="today"]').click();assert(await p.locator('#today').isVisible());
  await context.close();
 });

 await check('1.1 interior residents stand on reachable floor and conversations approach beside them',async()=>{
  const {page:p,context}=await open({width:390,height:844,shell:true,seed:advancedSeed(),day:'2027-04-16'});
  const before=await docs(p);delete before['cfg/citadel'];
  for(const key of ['guardian','archivist','smith','treasurer']){
   const state=await p.evaluate(key=>__qa.npcState(key),key);assert(!state.moving);
   await p.evaluate(room=>{__qa.move(room);document.querySelector('#citadel-enter').click();},state.room);
   const actor=p.locator('#citadel-interior-stage [data-person="'+key+'"]');await actor.waitFor({state:'visible'});
   const floor=await actor.evaluate(n=>{const s=n.closest('.citadel-interior-stage'),point={x:Number(n.dataset.floorX),y:Number(n.dataset.floorY)},nearest=CitadelSpace.nearest(s.dataset.room,Number(s.dataset.level),point);return {point,nearest};});assert.deepEqual(floor.point,floor.nearest,'NPC feet stay outside furniture');assert(floor.point.y<=306&&floor.point.y>=228);
   await actor.focus();await p.keyboard.press('Enter');assert(await p.locator('#citadel-room-conversation').isVisible());
   const spacing=await p.locator('#citadel-interior-stage').evaluate((n,key)=>{const a=n.querySelector('[data-person="'+key+'"]'),h=n.querySelector('.citadel-hero-sprite'),ar=a.getBoundingClientRect(),hr=h.getBoundingClientRect();return Math.abs(ar.left+ar.width/2-hr.left-hr.width/2)/n.clientWidth;},key);assert(spacing>.04,'hero approaches beside the resident');
   await p.locator('#citadel-room-npc-close').click();
  }
  await p.evaluate(()=>__qa.idle());const after=await docs(p);delete after['cfg/citadel'];assert.deepEqual(after,before,'resident geometry does not alter schedules or progress');await context.close();
 });

 await check('1.1 earned aura selection is shared by profile and Citadel and survives reload',async()=>{
  const {page:p,context}=await open({shell:true,seed:advancedSeed(),day:'2027-04-16'});
  await shellNav(p,'Настройки');const auras=p.locator('#looklist .looksec').filter({has:p.locator('b').filter({hasText:/^АУРА ПЕРСОНАЖА$/})});
  await auras.locator('button.chip').nth(1).click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(()=>!!document.documentElement.dataset.aura);
  const choice=await p.evaluate(()=>document.documentElement.dataset.aura),before=await docs(p);await p.locator('#setup-x').click();await shellNav(p,'Профиль');
  const filters=await p.evaluate(()=>[document.querySelector('#profile-hero'),document.querySelector('.citadel-interior-stage .citadel-hero-sprite')].map(n=>getComputedStyle(n).filter));assert.equal(filters[0],filters[1]);assert(!filters[0].includes('rgba(0, 0, 0, 0)'),'selected earned aura is visible in both views');
  await p.locator('.citadel-system-dialog').screenshot({path:resolve(out,'v11-profile-aura-mobile.png')});
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await p.evaluate(()=>__qa.idle());assert.equal(await p.evaluate(()=>document.documentElement.dataset.aura),choice);
  const after=await docs(p);assert.equal(after['cfg/citadel']?.d.selectedRoom||'rest',before['cfg/citadel']?.d.selectedRoom||'rest');assert.deepEqual(after['cfg/citadel']?.d.decor||{},before['cfg/citadel']?.d.decor||{});delete before['cfg/citadel'];delete after['cfg/citadel'];assert.deepEqual(after,before,'appearance reload cannot grant or spend gameplay resources');await context.close();
  const locked=await open({shell:true,seed:{...initial,'cfg/look':{aura:'au_warm'}}});assert.equal(await locked.page.evaluate(()=>document.documentElement.dataset.aura),'','unearned selection remains unavailable');await locked.context.close();
 });

 await check('1.1 restored room responses animate visible light once and respect reduced motion',async()=>{
  const {page:p,context}=await open({shell:true,seed:advancedSeed(),day:'2027-04-16'});await p.locator('[data-croom="rest"]').click();
  for(const tier of [2,3]){
   await p.evaluate(tier=>__qa.upgrade('rest',tier-1),tier);await p.waitForFunction(tier=>document.querySelector('#citadel-interior-stage').dataset.level===String(tier),tier);await p.evaluate(()=>__qa.idle());await p.waitForFunction(()=>__qa.cosmeticsIdle());const before=await docs(p);
   await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('[data-room-inspect]').click();await p.locator('[data-room-inspect]').click();
   const response=await p.locator('#citadel-interior-stage').evaluate(n=>{const light=n.querySelector('.citadel-room-light'),old=n.querySelector('.citadel-interior-renovation');return {visible:getComputedStyle(light).display!=='none',light:light.getAnimations().filter(a=>!a.animationName).length,hidden:old.getAnimations().filter(a=>!a.animationName).length};});assert(response.visible);assert.equal(response.light,1);assert.equal(response.hidden,0);
   await p.emulateMedia({reducedMotion:'reduce'});await p.locator('[data-room-inspect]').click();assert.equal(await p.locator('#citadel-interior-stage .citadel-room-light').evaluate(n=>n.getAnimations().filter(a=>!a.animationName).length),0);assert.deepEqual(await docs(p),before,'visual response cannot charge resources');
  }
  await context.close();
 });

 await check('1.1 actual personal quarters visuals at all three room levels',async()=>{
  const {page:p,context}=await open({width:390,height:844,mobile:true,shell:true,seed:advancedSeed(),day:'2027-04-16'});
  await p.locator('[data-croom="rest"]').click();
  await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'v11-real-rest-level-1.png')});
  await shellDrawer(p,'right');
  await p.locator('.citadel-shell-drawer.right button').getByText('Улучшить',{exact:true}).click();
  for(const level of [2,3]){
   await p.locator('#citadel-upgrade').click();
   await p.waitForFunction(level=>document.querySelector('#citadel-interior-stage').dataset.level===String(level),level);
   await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'v11-real-rest-level-'+level+'.png')});
  }
  await context.close();
 });

 await check('1.1 all 30 actual room stages, twenty purchases and repeat protection',async()=>{
  const {page:p,context}=await open({width:960,height:1000,mobile:false,shell:true,seed:advancedSeed(),day:'2027-04-16'});
  const before=await docs(p),roomIds=await p.locator('[data-croom]').evaluateAll(ns=>ns.map(n=>n.dataset.croom));
  assert.equal(roomIds.length,10);
  for(const room of roomIds){
   await p.evaluate(room=>{__qa.move(room);document.querySelector('#citadel-enter').click();},room);
   for(const level of [1,2,3]){
    if(level>1){await p.evaluate(({room,level})=>__qa.upgrade(room,level-1),{room,level});await p.evaluate(()=>__qa.idle());}
    await p.waitForFunction(level=>document.querySelector('#citadel-interior-stage').dataset.level===String(level),level);
    assert((await p.locator('#citadel-interior-stage').evaluate(n=>getComputedStyle(n,'::before').backgroundImage)).includes(room+'-interior-'+level+'.svg'),'actual scene must use its own room and stage');
    await p.locator('#citadel-interior-object').click();
    assert.equal(await p.locator('#citadel-interior-object').getAttribute('data-inspected'),'true');
    await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,`v11-room-${room}-level-${level}.png`)});
    if(level>1){const saved=await docs(p);await p.evaluate(({room,level})=>__qa.upgrade(room,level-1),{room,level});await p.evaluate(()=>__qa.idle());assert.deepEqual(await docs(p),saved,'same upgrade must not charge twice');}
   }
  }
  const after=await docs(p);
  for(const key of Object.keys(before).filter(k=>/^(tx|weights|days|per|spont|habits|goals)\//.test(k)))assert.deepEqual(after[key],before[key],key+' preserved');
  assert.equal(Object.keys(after).filter(k=>k.startsWith('buys/citadel-')).length,20);
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await p.evaluate(()=>__qa.idle());
  assert.deepEqual((await docs(p))['buys/citadel-vault-3'],after['buys/citadel-vault-3']);
  await context.close();
 });

 await check('1.1 floor position survives reload as a local preference without game writes',async()=>{
  const {page:p,context}=await open({shell:true,seed:{...initial,'cfg/citadel':{selectedRoom:'rest',decor:{}}}});await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
  const before=await docs(p);await p.locator('#citadel-interior-stage').focus();await p.keyboard.press('ArrowRight');
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.citadel.walk.v1')).rest);assert(saved.x>.5);
  assert.deepEqual(await docs(p),before,'walking must never write progress');
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await p.locator('#citadel-interior').waitFor({state:'visible'});assert.equal(await p.locator('#citadel-home').getAttribute('data-ui-view'),'room','reload restores the room directly');
  const actual=await p.locator('#citadel-interior-stage').evaluate(n=>{const h=n.querySelector('.citadel-hero-sprite');return {x:(parseFloat(h.style.left)+h.offsetWidth/2)/n.clientWidth,y:parseFloat(h.style.bottom)/n.clientHeight};});
  assert(Math.abs(actual.x-saved.x)<.02&&Math.abs(actual.y-saved.y)<.02);assert.deepEqual(await docs(p),before);await context.close();
 });

 await check('1.1 profile shows current progress, three achievement slots and a compact wardrobe',async()=>{
  const {page:p,context}=await open({shell:true});
  const before=await docs(p);
  await shellNav(p,'Профиль');
  assert(await p.locator('#profile-hero').isVisible());
  assert.equal(await p.locator('#profile-showcase .profile-award').count(),3);
  assert.equal(await p.locator('#profile-days').innerText(),'1');
  assert.equal(await p.locator('#profile-checks').innerText(),'0');
  assert(await p.locator('#profile-rank').innerText());
  assert(!(await p.locator('#profile-wardrobe').evaluate(n=>n.open)));
  await p.locator('#profile-showcase .profile-award').first().click();
  assert(await p.locator('#profile-picker').isVisible());
  assert.equal(await p.locator('#profile-achievements button').count(),1,'unearned achievements must not be exposed in the picker');
  await p.locator('#profile-picker-close').click();
  await p.locator('#profile-title-open').click();
  assert(await p.locator('#profile-titles').isVisible());
  await p.locator('#profile-title-open').click();
  await p.locator('#profile-gear-open').click();
  assert(await p.locator('#profile-wardrobe').evaluate(n=>n.open));
  assert.equal(await p.locator('.wardrobe-worn').count(),3);
  assert.deepEqual(await docs(p),before,'viewing the profile must not change progress records');
  await context.close();
 });

 await check('1.0 Awakening stays voluntary for existing profiles and navigates real sections without game writes',async()=>{
  const {page:p,context}=await open({shell:true});
  assert(await p.locator('#awakening-coach').isHidden());
  const before=await docs(p);
  await shellNav(p,'Настройки');await p.locator('#awakening-start').click();
  for(let step=0;step<10;step++){
   assert.match(await p.locator('.awakening-count').innerText(),new RegExp((step+1)+' / 10$'));
   assert(await p.locator('#awakening-coach').isVisible());
   assert(await p.locator('.awakening-target').count()>0,'real visible interface target at step '+step);
   if(step===1)assert(await p.locator('#wardrobe').isVisible());
   if(step===2)assert(await p.locator('#qlist').isVisible());
   if(step===3){await p.locator('[data-finance="wheel"]').click();assert(await p.locator('#spend').isVisible());assert(await p.locator('#awakening-coach').isVisible());}
   if(step===4)assert(await p.locator('#diet').isVisible());
   if(step===7){assert(await p.locator('#trophy').isVisible());assert(!await p.locator('.awakening-copy').innerText().then(t=>/условие:|награда:|echo\d|f0\d/.test(t)));}
   if(step===8)assert(await p.locator('#data-management').isVisible());
   if(step===7||step===8)assert(await p.locator(step===7?'#trophy-x':'#setup-x').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'coach must leave the window close button exposed');
   if([0,2,3,7,8].includes(step))await p.screenshot({path:resolve(out,'awakening-step-'+step+'.png')});
   await p.locator('[data-coach="next"]').click();
  }
  assert(await p.locator('#awakening-coach').isHidden());
  await p.evaluate(()=>__qa.idle());assert.deepEqual(await docs(p),before,'tour must not write game records or award progress');
  await p.reload();await p.waitForFunction(()=>__qa.loading());assert(await p.locator('#awakening-coach').isHidden());await context.close();
 });
 await check('1.0 Awakening pause, reload, resume, Back, skip and replay preserve the checkpoint and economy',async()=>{
  const {page:p,context}=await open({shell:true,seed:{...initial,'cfg/citadel':{selectedRoom:'rest',decor:{}}}});await shellNav(p,'Настройки');await p.locator('#awakening-start').click();
  await p.locator('[data-coach="next"]').click();await p.locator('[data-coach="next"]').click();
  const before=await docs(p);await p.reload();await p.waitForFunction(()=>__qa.loading());
  await p.waitForFunction(()=>!document.getElementById('awakening-coach').hidden);assert.match(await p.locator('.awakening-count').innerText(),/3 \/ 10$/);
  await p.locator('[data-coach="pause"]').click();await p.reload();await p.waitForFunction(()=>__qa.loading());assert(await p.locator('#awakening-coach').isHidden());
  if(await p.locator('.citadel-system-dialog').isVisible())await p.locator('.citadel-system-dialog>header button').click();await shellNav(p,'Настройки');assert.match(await p.locator('#awakening-start').innerText(),/ПРОДОЛЖИТЬ/);await p.locator('#awakening-start').click();assert.match(await p.locator('.awakening-count').innerText(),/3 \/ 10$/);
  await p.locator('.citadel-system-dialog>header button').click();await p.waitForFunction(()=>document.getElementById('awakening-coach').hidden);
  await shellNav(p,'Настройки');await p.locator('#awakening-start').click();assert.match(await p.locator('.awakening-count').innerText(),/3 \/ 10$/);
  await p.goBack();assert(await p.locator('#awakening-coach').isHidden());
  await shellNav(p,'Настройки');await p.locator('#awakening-start').click();await p.locator('[data-coach="skip"]').click();
  if(await p.locator('.citadel-system-dialog').isVisible())await p.locator('.citadel-system-dialog>header button').click();await shellNav(p,'Настройки');await p.locator('#awakening-restart').click();assert.match(await p.locator('.awakening-count').innerText(),/1 \/ 10$/);
  await p.locator('[data-coach="skip"]').click();assert.deepEqual(await docs(p),before);await context.close();
 });
 await check('1.0 new profiles receive Awakening once and failed preference writes remain visible',async()=>{
  const {page:p,context}=await open({shell:true,fresh:true,seed:{}});
  await p.waitForFunction(()=>!document.getElementById('awakening-coach').hidden);assert.match(await p.locator('.awakening-count').innerText(),/1 \/ 10$/);
  await p.locator('[data-coach="skip"]').click();await p.reload();await p.waitForFunction(()=>__qa.loading());assert(await p.locator('#awakening-coach').isHidden());
  await shellNav(p,'Настройки');await p.evaluate(()=>{window.__realPrefWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.awakening.v1')throw new DOMException('Synthetic full','QuotaExceededError');return __realPrefWrite.call(this,k,v);};});
  await p.locator('#awakening-restart').click();assert(await p.locator('.awakening-warning').isVisible());
  await p.evaluate(()=>{Storage.prototype.setItem=window.__realPrefWrite;});await p.locator('[data-coach="next"]').click();assert(await p.locator('.awakening-warning').isHidden());await p.locator('[data-coach="pause"]').click();await context.close();
 });
 await check('1.0 Awakening fits narrow, keyboard-sized and landscape viewports with accessible controls',async()=>{
  const {page:p,context}=await open({shell:true});await shellNav(p,'Настройки');await p.locator('#awakening-start').click();
  for(let step=0;step<10;step++){
   for(const [width,height]of [[320,480],[390,360],[844,390],[390,844]]){
    await p.setViewportSize({width,height});await p.waitForTimeout(25);
    assert(await p.locator('#awakening-coach').evaluate(n=>n.scrollWidth<=n.clientWidth),'coach must wrap at step '+step);
    await p.locator('[data-coach="next"]').scrollIntoViewIfNeeded();
    assert(await p.locator('[data-coach="next"]').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&r.height>=44;}),'next remains reachable at step '+step);
   }
   await p.locator('[data-coach="next"]').click();
  }
  await context.close();
 });

 await check('1.0 Awakening resumes offline and backup restore leaves tutorial separate from game records',async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow',serviceWorkers:'allow',reducedMotion:'reduce'});
  context.setDefaultTimeout(20000);
  await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));
  await context.addInitScript(seed=>{if(!localStorage.getItem('qa-init')){localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs:Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]))}));localStorage.setItem('qa-init','1');}localStorage.setItem('wsum','2026-10-26');localStorage.setItem('msum','2026-10');localStorage.setItem('trialSeen','2026-10-30');},{...initial,'cfg/citadel':{selectedRoom:'rest',decor:{}}});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.clock.install({time:new Date('2026-10-30T14:00:00+03:00')});
  await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller&&PlanSync._docs()['cfg/abyss-economy']?.d?.rank>=1);await dismiss(p);await p.evaluate(()=>PlanSync.beforeUpdate());
  const before=await docs(p);await shellNav(p,'Настройки');await p.locator('#awakening-start').click();
  for(let n=0;n<3;n++)await p.locator('[data-coach="next"]').click();
  await context.setOffline(true);await p.reload();await p.waitForFunction(()=>!document.getElementById('awakening-coach').hidden);
  assert.match(await p.locator('.awakening-count').innerText(),/4 \/ 10$/);assert(await p.evaluate(async()=>!!await caches.match(new URL('awakening.js',location.href))));
  await p.locator('[data-coach="pause"]').click();
  assert.deepEqual(await docs(p),before);const content=records=>Object.fromEntries(Object.entries(records).map(([k,v])=>[k,v.d]));
  const roundtrip=await p.evaluate(async()=>{const copy=await PlanSync.backupFor(PlanSync._docs());await PlanSync.validateBackup(copy);await PlanSync.importObj(copy,true);return true;});assert(roundtrip);
  assert.deepEqual(content(await docs(p)),content(before));await p.reload();await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');assert(await p.locator('#awakening-coach').isHidden());
  await shellNav(p,'Настройки');await p.locator('#awakening-start').click();assert.match(await p.locator('.awakening-count').innerText(),/4 \/ 10$/);assert.deepEqual(content(await docs(p)),content(before));await context.close();
 });

 await check('0.90 identical newer discovery snapshots advance the preference clock against stale devices',async()=>{
  const seed=structuredClone(initial);
  seed['cfg/legends']={version:1,active:'echo01',unlocked:{echo01:{version:1,at:1,presented:true}}};
  seed['cfg/fate']={version:1,active:'f01',entries:{f01:{pieces:{0:{version:1,at:1,presented:true}}}}};
  const {page:p,context}=await open({shell:true,seed});
  for(const path of ['cfg/legends','cfg/fate']){
   const prior=(await docs(p))[path],newer=structuredClone(prior);newer.u=Date.now()+100000;
   await p.evaluate(({path,record})=>PlanSync._merge({docs:{[path]:record}}),{path,record:newer});
   assert.equal((await docs(p))[path].u,newer.u);
   const stale=structuredClone(newer);stale.u--;stale.d.active='';
   await p.evaluate(({path,record})=>PlanSync._merge({docs:{[path]:record}}),{path,record:stale});
   assert.equal((await docs(p))[path].d.active,prior.d.active);
  }
  await context.close();
 });
 await check('0.90 cosmetic merges keep both histories, presentation receipts and the selected preference',async()=>{
  for(const choice of ['local','remote']){
   const seed=structuredClone(initial);seed['cfg/legends']={version:1,active:'echo01',unlocked:{echo01:{version:1,at:1793358000000,presented:true}}};
   const {page:p,context}=await open({shell:true,seed});const prior=await docs(p);
   const remote={...structuredClone(prior),'cfg/legends':{d:{version:1,active:'',unlocked:{echo01:{version:1,at:1793358001000,presented:false},echo02:{version:1,at:1793358002000,presented:true}}},u:1},'cfg/opening':{d:{cash:42,card:7},u:Date.now()+100000}};
   const conflict=await p.evaluate(async remote=>{try{await PlanSync._merge({docs:remote},{detect:true});return false;}catch{return true;}},remote);assert(conflict);
   await p.evaluate(choice=>PlanSync.resolveConflict(choice),choice);await p.waitForTimeout(60);
   const data=await docs(p),ledger=data['cfg/legends'].d;
   assert(Object.keys(ledger.unlocked).length===2&&Object.values(ledger.unlocked).every(r=>r.presented),'both histories and receipts must survive either choice');
   assert.equal(ledger.active,'echo01');assert.equal(data['cfg/opening'].d.cash,choice==='local'?prior['cfg/opening'].d.cash:42);
   const older={v:1,docs:{'cfg/legends':{d:{version:1,active:'',unlocked:{}},u:0}}};await p.evaluate(copy=>PlanSync.importObj(copy),older);
   assert.equal((await docs(p))['cfg/legends'].d.active,'echo01');
   older.docs['cfg/legends'].u=Date.now()+200000;await p.evaluate(copy=>PlanSync.importObj(copy),older);
   assert.equal((await docs(p))['cfg/legends'].d.active,'');
   assert(Object.keys((await docs(p))['cfg/legends'].d.unlocked).length===2);await context.close();
  }
 });
 await check('0.90 unrelated saves preserve collection focus and avoid avatar rasterization, appearance changes invalidate cache',async()=>{
  const seed=structuredClone(initial);seed['cfg/legends']={version:1,active:'echo01',unlocked:{echo01:{version:1,at:1793358000000,presented:true}}};
  const {page:p,context}=await open({shell:true,seed});await p.evaluate(()=>document.querySelector('#trophy-btn').click());
  await p.evaluate(()=>{window.__stableButton=document.querySelector('.legend-entry button');__stableButton.focus();window.__avatarPaints=0;for(const id of ['citadel-avatar-canvas','citadel-interior-hero']){const canvas=document.getElementById(id),ctx=canvas.getContext('2d'),original=ctx.clearRect.bind(ctx);ctx.clearRect=function(...args){window.__avatarPaints++;return original(...args);};}});
  const before=await p.locator('#citadel-avatar-canvas').evaluate(n=>n.toDataURL());await write(p,'tx/cache-test',{date,amt:1,type:'out',what:'Synthetic expense',ts:2});
  await p.waitForTimeout(60);
  assert.equal(await p.evaluate(()=>__avatarPaints),0);assert(await p.evaluate(()=>__stableButton===document.querySelector('.legend-entry button')),'collection nodes must survive unrelated saves');
  // write() dismisses overlays; reopen to check the retained node itself.
  await p.evaluate(()=>document.querySelector('#trophy-btn').click());await p.waitForTimeout(20);
  await p.evaluate(()=>__stableButton.focus());
  assert(await p.evaluate(()=>document.activeElement===__stableButton),'focus must be acquired before the save');
  await p.evaluate(()=>PlanDB.doc('tx/cache-test').update({amt:2}));await p.waitForTimeout(60);
  assert(await p.evaluate(()=>document.activeElement===__stableButton),'unrelated subscriptions must retain focus');
  await write(p,'weights/cache-test',{kg:110,date,ts:3});
  assert(await p.evaluate(()=>__avatarPaints>0));assert.notEqual(await p.locator('#citadel-avatar-canvas').evaluate(n=>n.toDataURL()),before);
  const slim=await p.locator('#citadel-avatar-canvas').evaluate(n=>n.toDataURL());
  await write(p,'cfg/outfit',{top:'synthetic-unowned',bottom:'pants_brown',outer:'none'});
  assert.equal(await p.locator('#citadel-avatar-canvas').evaluate(n=>n.toDataURL()),slim,'unknown equipment keeps the existing fallback');
  await context.close();
 });
 await check('0.90 finance inputs, close button and scroll remain usable after keyboard-sized resize and orientation changes',async()=>{
  const {page:p,context}=await open({shell:true});await shellNav(p,'Финансы');
  await p.locator('#what').fill('Synthetic keyboard draft');await p.locator('#amt').fill('12');
  for(const [width,height]of [[390,360],[320,480],[844,390],[390,844]]){
   await p.setViewportSize({width,height});await p.locator('#what').focus();await p.waitForTimeout(40);
   assert.equal(await p.locator('#what').inputValue(),'Synthetic keyboard draft');
   assert(await p.locator('.citadel-system-dialog>header button').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth;}));
   assert(await p.locator('.citadel-system-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth));
   await p.locator('#what').scrollIntoViewIfNeeded();assert(await p.locator('#what').isVisible());
  }
  await p.goBack();assert(await p.locator('.citadel-system-dialog').isHidden());await context.close();
 });

 await check('0.90 older restores retain prior cosmetic discoveries and presentation receipts',async()=>{
  const seed=structuredClone(initial);seed['cfg/legends']={version:1,active:'echo01',unlocked:{echo01:{version:1,at:1793358000000,presented:true}}};
  const {page:p,context}=await open({shell:true,seed});
  const prior=(await docs(p))['cfg/legends'].d;
  await p.evaluate(async()=>{const old={v:1,docs:{'cfg/opening':{d:{cash:42,card:7},u:1}}};await PlanSync.importObj(old,true);});
  assert(JSON.stringify((await docs(p))['cfg/legends']?.d)===JSON.stringify(prior),'old copy must retain earned cosmetic ledger');
  assert.equal((await docs(p))['cfg/opening'].d.cash,42);
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await dismiss(p);
  assert(JSON.stringify((await docs(p))['cfg/legends']?.d)===JSON.stringify(prior),'reload must retain earned cosmetic ledger');
  assert(await p.locator('#legend-scene').isHidden());await context.close();
 });

 await check('0.79 real achievement progress discovers partial pixels and survives reload without repeat delivery',async()=>{
  const seed=structuredClone(initial);for(let n=0;n<4;n++){const k='2026-10-'+(19+n);seed['days/'+k]={q:Array(10).fill(false),steps:12000};}
  const {page:p,context}=await open({shell:true,seed});
  await p.waitForFunction(()=>VkachFate.discovered(__qa.S.fate).some(d=>!d.complete));
  await p.waitForFunction(()=>VkachFate.pending(__qa.S.fate).length===0);await p.evaluate(()=>__qa.idle());await dismiss(p);
  const before=await docs(p);await p.evaluate(()=>document.querySelector('#trophy-btn').click());assert(await p.locator('.fate-entry').count()>0);
  const safe=await p.evaluate(()=>{const entries=VkachFate.discovered(__qa.S.fate),text=document.querySelector('#alist').textContent;return entries.every(d=>d.complete||d.name==='Неизвестный образ'&&d.object==='Незавершённый образ')&&!/\d+\s*\/\s*\d+|%|осталось|услови/i.test(document.querySelector('.fate-entry').textContent);});assert(safe);
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await p.evaluate(()=>__qa.idle());assert.equal(JSON.stringify((await docs(p))['cfg/fate'].d),JSON.stringify(before['cfg/fate'].d));assert(await p.locator('#legend-scene').isHidden());await context.close();
 });
 await check('0.79 receipt claims are atomic across two tabs and failed storage has no award',async()=>{
  const {page:p,context}=await open({shell:true});const b=await context.newPage();await b.goto(url);await b.waitForFunction(()=>window.__qa?.loading());await dismiss(b);
  const result=await p.evaluate(async()=>{const achievements=Object.fromEntries(Array.from({length:120},(_,n)=>['x'+String(n+1).padStart(2,'0'),true]));const original=Storage.prototype.setItem;let failed=false;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic full','QuotaExceededError');return original.call(this,k,v);};try{await PlanDB.runTransaction(tx=>VkachFate.reconcile(tx,achievements,Date.now()));}catch{failed=true;}finally{Storage.prototype.setItem=original;}const untouched=!PlanSync._docs()['cfg/fate'];await PlanDB.runTransaction(tx=>VkachFate.reconcile(tx,achievements,Date.now()));return {failed,untouched};});assert.deepEqual(result,{failed:true,untouched:true});
  await p.waitForFunction(()=>VkachFate.pending(__qa.S.fate).length===0);await b.waitForFunction(()=>VkachFate.pending(__qa.S.fate).length===0);await p.evaluate(()=>__qa.idle());await b.evaluate(()=>__qa.idle());
  const received=await p.evaluate(()=>VkachFate.discovered(__qa.S.fate).map(d=>d.id));for(const id of received){const claims=await Promise.all([p,b].map(page=>page.evaluate(id=>PlanDB.runTransaction(tx=>VkachFate.claim(tx,id)),id)));assert(claims.every(c=>c===null));}
  await context.close();
 });
 await check('0.79 restore old backups and divergent devices retain discovery receipts without changing other data',async()=>{
  const {page:p,context}=await open({shell:true});const old=await p.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));
  await p.evaluate(async()=>{const ach=Object.fromEntries(Array.from({length:120},(_,n)=>['x'+String(n+1).padStart(2,'0'),true]));await PlanDB.runTransaction(tx=>VkachFate.reconcile(tx,ach,Date.now()));});await p.waitForFunction(()=>VkachFate.pending(__qa.S.fate).length===0);await p.evaluate(()=>__qa.idle());await dismiss(p);
  const before=(await docs(p))['cfg/fate'].d;await p.evaluate(copy=>PlanSync.importObj(copy,true),old);await p.waitForTimeout(60);assert.deepEqual((await docs(p))['cfg/fate'].d,before);
  const divergent=structuredClone((await docs(p))['cfg/fate']);for(const r of Object.values(divergent.d.entries))for(const piece of Object.values(r.pieces))piece.presented=false;divergent.u+=1000;
  await p.evaluate(record=>PlanSync.importObj({v:1,docs:{'cfg/fate':record}}),divergent);await p.waitForTimeout(60);assert.deepEqual((await docs(p))['cfg/fate'].d,before);
  const older=structuredClone(divergent);older.u=0;older.d.active='';await p.evaluate(record=>PlanSync.importObj({v:1,docs:{'cfg/fate':record}}),older);await p.waitForTimeout(40);assert.equal((await docs(p))['cfg/fate'].d.active,before.active);
  for(const [path,record]of Object.entries(old.docs))assert.deepEqual((await docs(p))[path].d,record.d);await context.close();
 });
 await check('0.79 conflict choices retain discoveries from both devices even with an older remote ledger',async()=>{
  for(const choice of ['local','remote']){
   const seed=structuredClone(initial);seed['cfg/fate']={version:1,active:'',entries:{f01:{pieces:{0:{version:1,at:1,presented:true}}}}};
   const {page:p,context}=await open({shell:true,seed});const before=await docs(p),remote=structuredClone(before);remote['cfg/opening'].d.cash+=100;remote['cfg/fate']={u:0,d:{version:1,active:'',entries:{f01:{pieces:{1:{version:1,at:2,presented:true}}}}}};
   const conflict=await p.evaluate(async remote=>{try{await PlanSync._merge({docs:remote},{detect:true});return false;}catch{return true;}},remote);assert(conflict);
   await p.evaluate(choice=>PlanSync.resolveConflict(choice),choice);await p.waitForTimeout(60);
   assert.equal(await p.evaluate(()=>VkachFate.discovered(PlanSync._docs()['cfg/fate'].d)[0].revealed.length),2);assert.equal(await p.evaluate(()=>VkachFate.pending(PlanSync._docs()['cfg/fate'].d).length),0);
   assert.equal((await docs(p))['cfg/opening'].d.cash,choice==='local'?before['cfg/opening'].d.cash:remote['cfg/opening'].d.cash);await context.close();
  }
 });
 await check('0.79 mobile scenes assemble actual pixels, honor sound and reduced motion, and Back preserves collection',async()=>{
  const seed=structuredClone(initial);seed['cfg/effects']={shake:'off',flash:'off',sound:'off'};
  seed['cfg/fate']={version:1,active:'f01',entries:{f01:{pieces:{0:{version:1,at:1,presented:true},1:{version:1,at:2,presented:true}}}}};
  const {page:p,context}=await open({shell:true,seed});await p.evaluate(()=>document.querySelector('#trophy-btn').click());const before=await docs(p);await p.evaluate(()=>{window.__qaAudioCalls=0;window.AudioContext=window.webkitAudioContext=function(){window.__qaAudioCalls++;throw Error('Unexpected audio');};});
  for(const [width,height]of [[320,640],[390,844],[844,390]]){
   await p.setViewportSize({width,height});await p.locator('.fate-entry').getByRole('button',{name:'ОСМОТРЕТЬ ОБРАЗ'}).click();
   assert.equal(await p.locator('#legend-scene').getAttribute('data-motion'),'reduce');assert.equal(await p.locator('#legend-scene').getAttribute('data-assembled'),'true');
   assert(await p.locator('#legend-scene button').evaluate(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44;}));
   assert(await p.locator('#legend-scene').evaluate(n=>n.scrollWidth<=n.clientWidth));await p.goBack();assert(await p.locator('#trophy').isVisible());
  }
  await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('.fate-entry').getByRole('button',{name:'ОСМОТРЕТЬ ОБРАЗ'}).click();const first=await p.locator('#legend-scene canvas').first().evaluate(n=>n.toDataURL());
  assert(await p.locator('.fate-shard').isVisible());assert(await p.locator('.fate-assembly').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));await p.screenshot({path:resolve(out,'fate-partial-scene.png')});await p.clock.runFor(1700);const next=await p.locator('#legend-scene canvas').first().evaluate(n=>n.toDataURL());assert.notEqual(first,next);assert.equal(await p.locator('#legend-scene').getAttribute('data-assembled'),'true');
  await p.locator('#legend-scene button').click();await p.clock.runFor(450);await p.evaluate(()=>__qa.idle());assert.equal(await p.evaluate(()=>window.__qaAudioCalls),0);assert.deepEqual(await docs(p),before);
  await p.locator('.fate-entry').getByRole('button',{name:'УБРАТЬ ИЗ ЦИТАДЕЛИ'}).click();await p.evaluate(()=>__qa.idle());await p.waitForTimeout(40);assert.equal((await docs(p))['cfg/fate'].d.active,'');
  await p.locator('.fate-entry').getByRole('button',{name:'ОСТАВИТЬ В ЦИТАДЕЛИ'}).click();await p.evaluate(()=>__qa.idle());await p.waitForTimeout(40);assert(await p.locator('#citadel-avatar-canvas').evaluate(n=>n.classList.contains('legend-hero')));
  await context.close();
 });

 await check('0.78 atomic cosmetic delivery is one-time across retries, reload and storage failure',async()=>{
  const {page:p,context}=await open({shell:true});const before=await docs(p);
  const result=await p.evaluate(async()=>{
   function deliver(){return PlanDB.runTransaction(tx=>{const proxy={get:tx.get,set:tx.set,list:function(c){const out=[];for(let n=0;n<240;n++){const id=new Date(Date.UTC(2026,9,19+n)).toISOString().slice(0,10);out.push(c==='days'?{id,q:Array(10).fill(true)}:{id:'synthetic'+n,date:id,done:true});}return out;}};return VkachLegends.reconcile(proxy,'2027-07-01',Date.now());});}
   const original=Storage.prototype.setItem;let failed=false;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic failure','QuotaExceededError');return original.call(this,k,v);};
   try{await deliver();}catch{failed=true;}finally{Storage.prototype.setItem=original;}
   const untouched=!PlanSync._docs()['cfg/legends'];const awarded=await deliver(),again=await deliver();return {failed,untouched,hasAward:awarded.length>0,repeated:again.length};
  });assert.deepEqual(result,{failed:true,untouched:true,hasAward:true,repeated:0});
  await p.waitForTimeout(80);await p.evaluate(()=>__qa.idle());await dismiss(p);const earned=(await docs(p))['cfg/legends'].d;
  for(const [path,record]of Object.entries(before))assert.deepEqual((await docs(p))[path].d,record.d);
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await dismiss(p);assert.deepEqual((await docs(p))['cfg/legends'].d,earned);await context.close();
 });

 await check('0.78 earned collection, replay, cosmetic selection and reload are read-only for economy',async()=>{
  const seed=structuredClone(initial);seed['cfg/legends']={version:1,active:'echo01',unlocked:{echo01:{version:1,at:1793358000000,presented:true}}};
  const {page:p,context}=await open({shell:true,seed});const before=await docs(p);
  await p.evaluate(()=>document.querySelector('#trophy-btn').click());assert.equal(await p.locator('.legend-entry').count(),1);
  await p.locator('.legend-entry').getByRole('button',{name:'ВСПОМНИТЬ',exact:true}).click();assert(await p.locator('#legend-scene').isVisible());
  assert.equal(await p.locator('#legend-scene').getAttribute('data-motion'),'reduce');
  await p.goBack();assert(await p.locator('#legend-scene').isHidden());assert(await p.locator('#trophy').isVisible());
  assert.deepEqual(await docs(p),before);
  await p.locator('.legend-entry').getByRole('button',{name:'УБРАТЬ ОФОРМЛЕНИЕ'}).click();await p.evaluate(()=>__qa.idle());await p.waitForTimeout(50);
  assert.equal((await docs(p))['cfg/legends'].d.active,'');
  await p.locator('.legend-entry').getByRole('button',{name:'ПРИМЕНИТЬ ОФОРМЛЕНИЕ'}).click();await p.evaluate(()=>__qa.idle());await p.waitForTimeout(50);
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await dismiss(p);
  assert.equal((await docs(p))['cfg/legends'].d.active,'echo01');assert(await p.locator('#citadel-avatar-canvas').evaluate(n=>n.classList.contains('legend-hero')));
  for(const [path,record]of Object.entries(before))if(path!=='cfg/legends')assert.deepEqual((await docs(p))[path].d,record.d);
  await context.close();
 });
 await check('0.78 scene timeout, skip, Escape and animation failure always release input',async()=>{
  const seed=structuredClone(initial);seed['cfg/legends']={version:1,unlocked:{echo01:{version:1,at:1793358000000,presented:true}}};
  const {page:p,context}=await open({shell:true,seed});await p.evaluate(()=>document.querySelector('#trophy-btn').click());
  for(const method of ['skip','escape','timeout','failed-animation','failed-canvas','failed-modal']){
   if(method==='failed-animation')await p.evaluate(()=>{Element.prototype.animate=function(){throw Error('Synthetic animation failure');};});
   if(method==='failed-canvas')await p.evaluate(()=>{document.querySelector('#legend-scene canvas').getContext=function(){throw Error('Synthetic canvas failure');};});
   if(method==='failed-modal')await p.evaluate(()=>{const d=document.querySelector('#legend-scene');d.showModal=function(){throw Error('Synthetic modal failure');};});
   await p.locator('.legend-entry').getByRole('button',{name:'ВСПОМНИТЬ',exact:true}).click();
   if(method==='failed-modal'){assert(await p.locator('#legend-scene').isHidden());assert(await p.locator('#trophy').isVisible());continue;}
   assert(await p.locator('#legend-scene').isVisible());
   if(method==='escape')await p.keyboard.press('Escape');else if(method==='timeout')await p.clock.runFor(7300);else await p.locator('#legend-scene button').click();
   await p.waitForTimeout(80);assert(await p.locator('#legend-scene').isHidden());assert(await p.locator('#trophy').isVisible());
  }
  await context.close();
 });
 await check('0.78 narrow collection and sealed rooms keep earned atmosphere outside unknown interiors',async()=>{
  const seed=structuredClone(initial);seed['cfg/legends']={version:1,active:'echo01',unlocked:{echo01:{version:1,at:1793358000000,presented:true}}};
  const {page:p,context}=await open({shell:true,seed,width:320});
  await p.evaluate(()=>{__qa.move('rest');document.querySelector('#citadel-enter').click();});assert(await p.locator('#legend-room-object').isVisible());
  await p.evaluate(()=>{__qa.move('study');document.querySelector('#citadel-enter').click();});assert(await p.locator('#legend-room-object').isHidden());
  assert(await p.locator('.is-locked').evaluateAll(ns=>ns.every(n=>!n.classList.contains('has-legend-echo')&&getComputedStyle(n).backgroundColor==='rgb(0, 0, 0)'&&getComputedStyle(n,'::after').display==='none')));
  await p.evaluate(()=>document.querySelector('#trophy-btn').click());
  for(const [width,height]of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   await p.setViewportSize({width,height});assert(await p.locator('#trophy').evaluate(n=>n.scrollWidth<=n.clientWidth));
   await p.locator('.legend-entry').getByRole('button',{name:'ВСПОМНИТЬ',exact:true}).click();assert(await p.locator('#legend-scene').evaluate(n=>n.scrollWidth<=n.clientWidth&&n.getBoundingClientRect().height<=innerHeight));await p.locator('#legend-scene button').click();await p.waitForTimeout(40);
  }
  await context.close();
 });
 await check('0.78 Android Back closes the top scene and preserves a mystery dialog underneath',async()=>{
  const seed=structuredClone(initial);seed['cfg/legends']={version:1,unlocked:{echo01:{version:1,at:1793358000000,presented:true}}};
  const {page:p,context}=await open({shell:true,seed});await p.evaluate(()=>__qa.move('vault'));assert(await p.locator('#citadel-mystery').isVisible());
  await p.evaluate(()=>__qa.scene('echo01'));assert(await p.locator('#legend-scene').isVisible());await p.goBack();assert(await p.locator('#legend-scene').isHidden());assert(await p.locator('#citadel-mystery').isVisible());
  await p.goBack();assert(await p.locator('#citadel-mystery').isHidden());await context.close();
 });
 await check('0.78 no unopened definitions, counts or target progress enter collection',async()=>{
  const {page:p,context}=await open({shell:true});await p.evaluate(()=>document.querySelector('#trophy-btn').click());
  const safe=await p.evaluate(()=>{const text=document.querySelector('#alist').textContent;return !VkachLegends.earned({unlocked:{echo01:{version:1,at:1},echo02:{version:1,at:1},echo03:{version:1,at:1}}}).some(d=>text.includes(d.name)||text.includes(d.object)||text.includes(d.aura));});assert(safe);assert.equal(await p.locator('.legend-entry').count(),0);assert(await p.evaluate(()=>__qa.privateNotesSafe()));assert(!/Суперредкая цель|осталось|\d+ из \d+/.test(await p.locator('#alist').innerText()));await context.close();
 });
 await check('0.78 persisted unlocks survive backup restore without replay grants',async()=>{
  const seed=structuredClone(initial);seed['cfg/legends']={version:1,active:'echo01',unlocked:{echo01:{version:1,at:1793358000000,presented:true}}};
  const {page:p,context}=await open({shell:true,seed});const before=await docs(p),ev=p.waitForEvent('download');await p.evaluate(()=>PlanSync.exportBackup());const download=await ev,copy=JSON.parse(await readFile(await download.path(),'utf8'));assert.deepEqual(copy.docs,before);
  await write(p,'cfg/legends',{version:1,unlocked:{}});await p.evaluate(copy=>PlanSync.importObj(copy,true),copy);await p.waitForTimeout(70);await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await dismiss(p);assert.deepEqual((await docs(p))['cfg/legends'].d,before['cfg/legends'].d);
  await context.close();
 });

 await check('0.77 quiet actions in every room are responsive, repeatable and strictly read-only',async()=>{
  const {page:p,context}=await open({shell:true,seed:advancedSeed(),day:'2027-04-16'});
  const rooms=await p.evaluate(()=>Object.keys(CitadelWorld.ranks));
  for(const [width,height] of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   await p.setViewportSize({width,height});
   for(const room of rooms){
    await p.evaluate(room=>{__qa.move(room);document.querySelector('#citadel-enter').click();},room);await p.evaluate(()=>__qa.idle());
    const before=await docs(p),action=p.locator('[data-room-moment]');
    assert(await action.isVisible());assert(await action.evaluate(n=>n.getBoundingClientRect().height>=44));
    await action.click();const text=await p.locator('#citadel-object-status').innerText();assert(text.length>40);
    for(let i=0;i<5;i++)await action.click();assert.equal(await p.locator('#citadel-object-status').innerText(),text);
    assert.deepEqual(await docs(p),before,'quiet action must not mutate any save document');
    assert(await p.locator('#citadel-interior').evaluate(n=>n.scrollWidth<=n.clientWidth));
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   }
  }
  await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'077-room-action-844.png')});await context.close();
 });
 await check('0.77 room actions do not expose locked rooms and new cues do not weaken black masks',async()=>{
  const {page:p,context}=await open({shell:true,width:320});
  await p.locator('[data-croom="study"]').click();await p.evaluate(()=>__qa.idle());const before=await docs(p);
  await p.locator('[data-room-moment]').click();const text=await p.locator('#citadel-object-status').innerText();
  assert(!/Обсерватория|Мастерская|Казначейство|летопис/i.test(text));assert.deepEqual(await docs(p),before);
  await p.evaluate(()=>__qa.move('vault'));assert(await p.locator('#citadel-mystery').isVisible());
  assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),'study');
  assert(await p.locator('.is-locked').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).backgroundColor==='rgb(0, 0, 0)'&&getComputedStyle(n,'::after').display==='none')));
  assert.deepEqual(await docs(p),before);await context.close();
 });
 await check('0.77 occupations, nearby responses and treasury dialogue follow real public state',async()=>{
  const {page:p,context}=await open({shell:true,seed:advancedSeed(),day:'2027-04-16'});
  await p.evaluate(()=>{__qa.move('forge');document.querySelector('#citadel-enter').click();});await p.evaluate(()=>__qa.idle());const before=await docs(p);
  const smith=p.locator('#citadel-interior-stage [data-person="smith"]');assert.equal(await smith.getAttribute('data-occupation'),'craft');
  assert(await smith.locator('.citadel-occupation-prop').isVisible());await p.locator('[data-room-moment]').click();
  assert.match(await p.locator('#citadel-object-status').innerText(),/Кузнец/);
  await smith.click();assert.equal(await smith.getAttribute('data-mode'),'interaction');assert(await smith.locator('.citadel-occupation-prop').isHidden());
  assert.deepEqual(await docs(p),before);
  await p.evaluate(()=>{document.querySelector('#citadel-room-npc-close').click();__qa.move('vault');document.querySelector('#citadel-enter').click();});
  await p.locator('#citadel-interior-stage [data-person="treasurer"]').click();assert.match(await p.locator('#citadel-room-speech').innerText(),/Для обустройства:.*Эссенции Бездны/);
  assert(!/одну казну/.test(await p.locator('#citadel-room-speech').innerText()));
  await p.clock.setFixedTime(new Date('2027-04-16T18:02:00+03:00'));await p.evaluate(()=>__qa.render());await dismiss(p);
  await p.evaluate(()=>{__qa.move('refectory');document.querySelector('#citadel-enter').click();});
  assert.equal(await p.locator('#citadel-interior-stage [data-occupation="meal"]').count(),4);
  await p.locator('[data-room-moment]').click();assert.match(await p.locator('#citadel-object-status').innerText(),/Страж/);await context.close();
 });
 await check('0.77 treasury reactions acknowledge an existing essence conflict without optimistic reassurance',async()=>{
  const seed=advancedSeed();seed['cfg/abyss-economy']={version:1,rank:100000,earned:-100000,claims:{}};seed['cfg/citadel']={selectedRoom:'vault',decor:{}};
  const {page:p,context}=await open({shell:true,seed,day:'2027-04-16'});
  await p.clock.runFor(64);await p.evaluate(()=>{__qa.move('vault');document.querySelector('#citadel-enter').click();});await p.evaluate(()=>__qa.idle());const before=await docs(p);
  await p.locator('[data-room-moment]').click();const text=await p.locator('#citadel-object-status').innerText();
  assert.match(text,/Расходы требуют сверки/);assert(!/Записи сходятся/.test(text));
  await p.locator('#citadel-interior-stage [data-person="treasurer"]').click();assert.match(await p.locator('#citadel-room-speech').innerText(),/несогласованные расходы/);
  assert.deepEqual(await docs(p),before);await context.close();
 });
 await check('0.77 clock jumps and resize recover NPC routes without interpolating across rooms',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);await p.emulateMedia({reducedMotion:'no-preference'});
  await p.clock.setFixedTime(new Date('2027-04-16T10:00:07+03:00'));await p.evaluate(()=>__qa.render());
  const smith=p.locator('#citadel-castle > [data-person="smith"]');assert.equal(await smith.getAttribute('data-smooth'),'false');
  await p.clock.setFixedTime(new Date('2027-04-16T10:00:07.500+03:00'));await p.evaluate(()=>__qa.render());assert.equal(await smith.getAttribute('data-smooth'),'true');
  await p.setViewportSize({width:430,height:844});await p.evaluate(()=>window.dispatchEvent(new Event('resize')));await p.clock.runFor(32);assert.equal(await smith.getAttribute('data-smooth'),'false');
  await p.clock.setFixedTime(new Date('2027-04-16T18:00:07+03:00'));await p.evaluate(()=>__qa.render());assert.equal(await smith.getAttribute('data-smooth'),'false');
  assert.equal(await smith.evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
  const state=await p.evaluate(()=>__qa.npcState('smith'));assert(state.path.length>1);assert(state.path.includes('hall-2'));
  await context.close();
 });
 await check('0.77 progress source links and equipped badges navigate existing panels without awards',async()=>{
  for(const [width,height] of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,shell:true});await shellDrawer(p,'left');
   await p.locator('.citadel-progress-sources summary').click();await p.evaluate(()=>__qa.idle());const before=await docs(p);
   assert(await p.locator('.citadel-progress-sources').evaluate(n=>n.scrollWidth<=n.clientWidth));
   for(const tab of ['today','week','diet','money']){
    if(tab!=='today')await shellDrawer(p,'left');
    await p.locator('.citadel-progress-sources [data-progress-tab="'+tab+'"]').click();assert(await p.locator('.citadel-system-dialog').isVisible());
    assert(await p.locator('#'+tab).isVisible());await p.locator('.citadel-system-dialog>header button').click();
   }
   assert.deepEqual(await docs(p),before);
   await shellNav(p,'Профиль');assert.equal(await p.locator('.wardrobe-worn').count(),3);
   assert.equal(await p.locator('.witem[aria-pressed="false"] .wardrobe-worn').count(),0);
   await context.close();
  }
 });
 await check('0.76 locked rooms have neutral DOM, accessibility labels and black scenery',async()=>{
  const {page:p,context}=await open({shell:true});
  const result=await p.locator('[data-croom].is-locked').evaluateAll(nodes=>nodes.map(n=>({
   name:n.querySelector('.citadel-room-name').textContent,label:n.getAttribute('aria-label'),title:n.title,
   bg:getComputedStyle(n).backgroundColor,before:getComputedStyle(n,'::before').display,after:getComputedStyle(n,'::after').display,
   visibleDetails:Array.from(n.children).filter(c=>!c.matches('.citadel-room-name,.citadel-lock')&&getComputedStyle(c).display!=='none').length
  })));
  assert(result.length>=1);for(const r of result){assert.equal(r.name,'Неизведанная комната');assert.match(r.label,/Неизведанная комната, закрыто/);assert.equal(r.title,'');assert.equal(r.bg,'rgb(0, 0, 0)');assert.equal(r.before,'none');assert.equal(r.after,'none');assert.equal(r.visibleDetails,0);}
  const tree=await p.locator('#citadel-castle').ariaSnapshot();assert(!/Обсерватория|Архив|Мастерская|Трапезная|Казначейство/i.test(tree));
  assert.equal(await p.locator('.is-locked .citadel-person').count(),0);await context.close();
 });
 await check('0.76 mystery dialog preserves selection, charges nothing and supports Back on Android sizes',async()=>{
  for(const [width,height] of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,shell:true});await p.clock.runFor(64);await p.evaluate(()=>__qa.idle());
   const before=await docs(p),selected=await p.locator('[data-croom][aria-pressed="true"]').getAttribute('data-croom');
   await p.locator('[data-croom="archive"]').dispatchEvent('click');assert(await p.locator('#citadel-mystery').isVisible());
   assert.match(await p.locator('#citadel-mystery').innerText(),/Неизведанная комната/);assert(!/Архив|стеллаж|летопис/i.test(await p.locator('#citadel-mystery').innerText()));
   const bounds=await p.locator('#citadel-mystery').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+.5&&bounds.y>=0&&bounds.y+bounds.height<=height+.5);
   assert.equal(await p.locator('[data-croom][aria-pressed="true"]').getAttribute('data-croom'),selected);assert(await p.locator('#citadel-interior').isHidden());
   await p.goBack();await p.locator('#citadel-mystery').waitFor({state:'hidden'});assert.deepEqual(await docs(p),before);
   await p.locator('.citadel-shell-camera button').filter({hasText:'К комнате'}).click();await p.clock.runFor(64);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('#citadel-home').evaluate(n=>n.scrollTop),0);
   if(width===390)await p.screenshot({path:resolve(out,'android-076-mystery-390.png')});await context.close();
  }
 });
 await check('0.76 reload during mystery dialog clears history marker and keeps keyboard and Back usable',async()=>{
  const seed={...structuredClone(initial),'cfg/citadel':{selectedRoom:'rest',decor:{}}};
  const {page:p,context}=await open({shell:true,seed});await p.clock.runFor(64);await p.evaluate(()=>__qa.idle());const before=await docs(p);
  await p.locator('[data-croom="archive"]').focus();await p.keyboard.press('Enter');await p.locator('#citadel-mystery').waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>history.state.citadelMystery),true);
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await dismiss(p);await p.clock.runFor(64);
  assert(await p.locator('#citadel-mystery').isHidden());assert.equal(await p.evaluate(()=>!!history.state?.citadelMystery),false);assert.deepEqual(await docs(p),before);
  await shellNav(p,'Задания');assert.equal(await p.evaluate(()=>!!history.state?.citadelMystery),false);await p.locator('.citadel-system-dialog header button').click();await p.waitForFunction(()=>history.state?.citadelOverlay!=='system');
  await p.locator('[data-croom="archive"]').focus();await p.keyboard.press('Enter');await p.locator('#citadel-mystery').waitFor({state:'visible'});await p.goBack();await p.locator('#citadel-mystery').waitFor({state:'hidden'});assert(await p.locator('#citadel-castle').isVisible());
  await p.locator('[data-croom="archive"]').focus();await p.keyboard.press('Enter');await p.locator('#citadel-mystery').waitFor({state:'visible'});await p.keyboard.press('Escape');await p.locator('#citadel-mystery').waitFor({state:'hidden'});assert(await p.locator('#citadel-castle').isVisible());await context.close();
 });
 await check('0.76 travel, drawers, activities, building and purchase history do not disclose locked content',async()=>{
  const seed=structuredClone(initial);seed['buys/citadel-archive-2']={kind:'citadel-room',currency:'abyss',room:'archive',level:2,name:'Цитадель: Новые стеллажи',cost:5};
  const {page:p,context}=await open({seed,shell:true});await p.locator('[data-croom="study"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
  const exits=await p.locator('#citadel-exits').innerText();assert.match(exits,/Неизведанная комната/);assert(!/Архив|Мастерская|Обсерватория/i.test(exits));
  const tree=await p.locator('#citadel-interior').ariaSnapshot();assert(!/Архив|стеллаж|Мастерская|Обсерватория/i.test(tree));
  await shellDrawer(p,'right');const drawer=await p.locator('.citadel-shell-drawer.right').innerText();assert(!/Архив|стеллаж|Мастерская|Обсерватория/i.test(drawer));await p.goBack();
  await shellNav(p,'Воспоминания');assert.match(await p.locator('#shop').innerText(),/Улучшение неизведанной комнаты/);assert(!/стеллаж/i.test(await p.locator('#shop').innerText()));await context.close();
 });
 await check('0.76 rank unlock uses durable shared progress, reveals old upgrades and never charges again',async()=>{
  const seed=structuredClone(initial),full=advancedSeed();seed['buys/citadel-archive-2']={kind:'citadel-room',currency:'abyss',room:'archive',level:2,cost:5,name:'Цитадель: Новые стеллажи'};
  const {page:p,context}=await open({seed,day:'2027-04-16',shell:true});await p.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await p.locator('[data-croom="archive"]').getAttribute('data-revealed'),'false');const before=await docs(p);
  await p.evaluate(async full=>{await PlanDB.runTransaction(tx=>{for(const [key,value]of Object.entries(full))if(key.startsWith('days/')||key.startsWith('per/'))tx.set(key,value);});},full);
  await p.waitForFunction(()=>document.querySelector('[data-croom="archive"]').dataset.revealed==='true');await dismiss(p);
  assert.match(await p.locator('[data-croom="archive"] .citadel-room-name').innerText(),/АРХИВ/);
  assert.equal(await p.locator('[data-croom="archive"]').evaluate(n=>n._reveal?.effect?.getTiming().duration),650);
  await p.clock.runFor(800);await p.locator('[data-croom="archive"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
  assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),'archive');assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-level'),'2');
  assert.equal(await p.locator('.is-locked').count(),0);await p.evaluate(()=>__qa.idle());
  const after=await docs(p);assert.deepEqual(after['buys/citadel-archive-2'],before['buys/citadel-archive-2']);assert.equal(Object.keys(after).filter(k=>k.startsWith('buys/')).length,1);
  await p.reload();await p.waitForFunction(()=>document.querySelector('[data-croom="archive"]').dataset.revealed==='true');await dismiss(p);
  assert.equal(await p.locator('[data-croom="archive"]').evaluate(n=>!!n._reveal),false);await p.locator('#citadel-interior').waitFor({state:'visible'});assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),'archive');assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-level'),'2');await context.close();
 });
 await check('0.76 failed progress write cannot reveal a room or spend resources',async()=>{
  const {page:p,context}=await open({day:'2027-04-16',shell:true});const before=await docs(p);
  const failed=await p.evaluate(async full=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic full','QuotaExceededError');return original.call(this,k,v);};try{await PlanDB.runTransaction(tx=>{for(const [key,value]of Object.entries(full))if(key.startsWith('days/')||key.startsWith('per/'))tx.set(key,value);});return false;}catch{return true;}finally{Storage.prototype.setItem=original;}},advancedSeed());assert(failed);
  assert.equal(await p.locator('[data-croom="archive"]').getAttribute('data-revealed'),'false');assert.deepEqual(await docs(p),before);await context.close();
 });
 await check('0.78 old 0.74 through 0.77 save envelopes restore exactly with unlocked rooms and reduced motion',async()=>{
  for(const version of ['0.74','0.75','0.76','0.77']){
   const {page:p,context}=await open({day:'2027-04-16',shell:true});const docsToRestore=Object.fromEntries(Object.entries(advancedSeed()).map(([k,d])=>[k,{d,u:1}]));
   docsToRestore['cfg/citadel']={d:{selectedRoom:'archive',decor:{archive:'banner'},future:{keep:version}},u:1};
   await p.evaluate(async({docs,version})=>{await PlanSync.importObj({v:1,appVersion:version,docs},true);},{docs:docsToRestore,version});
   await p.waitForFunction(()=>document.querySelector('[data-croom="archive"]').dataset.revealed==='true');await dismiss(p);
   assert.equal(await p.locator('[data-croom="archive"]').evaluate(n=>!!n._reveal),false);
   assert.deepEqual((await docs(p))['cfg/citadel'].d.future,{keep:version});await p.reload();await p.waitForFunction(()=>window.__qa?.loading());await dismiss(p);
   assert.equal(await p.locator('[data-croom="archive"]').getAttribute('data-revealed'),'true');assert.equal(await p.locator('[data-croom="archive"]').evaluate(n=>!!n._reveal),false);await context.close();
  }
 });
 await check('0.76 room visibility updates across two tabs using saved rank, without a separate unlock ledger',async()=>{
  const {page:p,context}=await open({day:'2027-04-16',shell:true});
  const other=await context.newPage();await other.clock.install({time:new Date('2027-04-16T14:00:00+03:00')});await other.goto(url);await other.waitForFunction(()=>window.__qa?.loading());await dismiss(other);
  assert.equal(await other.locator('[data-croom="archive"]').getAttribute('data-revealed'),'false');
  await p.evaluate(async full=>{await PlanDB.runTransaction(tx=>{for(const [key,value]of Object.entries(full))if(key.startsWith('days/')||key.startsWith('per/'))tx.set(key,value);});},advancedSeed());
  await other.waitForFunction(()=>document.querySelector('[data-croom="archive"]').dataset.revealed==='true');await dismiss(other);
  assert.deepEqual((await docs(other))['buys/citadel-archive-2'],undefined);await context.close();
 });
 await check('0.76 partially unlocked castle matches existing rank gates and NPC routes at every hour',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2026-11-17',shell:true});
  const rooms=await p.locator('[data-croom]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.croom,rank:CitadelWorld.ranks[n.dataset.croom],open:n.dataset.revealed==='true'})));const rank=await p.evaluate(()=>__qa.points().L);
  assert(rooms.some(r=>r.open)&&rooms.some(r=>!r.open));for(const room of rooms)assert.equal(room.open,rank>=room.rank);
  for(const hour of [0,7,10,14,18,21,23]){await p.clock.setSystemTime(new Date('2026-11-17T'+String(hour).padStart(2,'0')+':15:05+03:00'));await p.evaluate(()=>__qa.render());
   assert.equal(await p.locator('.is-locked .citadel-person').count(),0);
   assert(await p.evaluate(()=>['guardian','archivist','smith','treasurer'].every(key=>{const s=__qa.npcState(key),rank=__qa.points().L;return s.path.every(id=>CitadelWorld.available(id,rank));})));
  }await context.close();
 });
 await check('0.75 committed daily action updates hero feedback, survives reload without extra rewards',async()=>{
  const {page:p,context}=await open({shell:true});
  const initial=await p.evaluate(()=>({points:__qa.points(),seq:__qa.progressSequence()}));
  assert.equal(initial.seq,0);await p.evaluate(async()=>{const day='2026-10-30',cur=__qa.S.days[day],q=cur.q.slice();q[0]=true;await __qa.writeDay(day,cur,{q});});
  await p.waitForFunction(()=>document.querySelector('#daily-progress-feedback').textContent.includes('Дело дня сохранено'));
  const committed=await docs(p);assert(committed['days/'+date].d.q[0]);
  const after=await p.evaluate(()=>({points:__qa.points(),seq:__qa.progressSequence(),meter:document.querySelector('#citadel-rank-meter').value}));
  assert.equal(after.seq,1);assert.equal(after.meter,after.points.P);
  await p.evaluate(()=>__qa.render());assert.equal(await p.evaluate(()=>__qa.progressSequence()),1);
  await p.reload();await p.waitForFunction(()=>__qa?.loading());await p.evaluate(()=>__qa.idle());await dismiss(p);
  assert.equal(await p.evaluate(()=>__qa.progressSequence()),0);assert.equal(await p.locator('#daily-progress-feedback').innerText(),'');
  assert.deepEqual(await p.evaluate(()=>__qa.points()),after.points);
  assert.deepEqual((await docs(p))['days/'+date],committed['days/'+date]);await context.close();
 });
 await check('0.75 failed daily and equipment writes never acknowledge success or change inventory',async()=>{
  const {page:p,context}=await open();await p.evaluate(()=>__qa.idle());const before=await docs(p);
  await p.evaluate(async()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic full','QuotaExceededError');return original.call(this,k,v);};try{const cur=__qa.S.days['2026-10-30'],q=cur.q.slice();q[0]=true;await __qa.writeDay('2026-10-30',cur,{q});await __qa.equip('outer','coat');}finally{Storage.prototype.setItem=original;}});
  assert.equal(await p.evaluate(()=>__qa.progressSequence()),0);assert.match(await p.locator('#wardrobe-status').innerText(),/не сохранена/);
  const after=await docs(p);assert.deepEqual(after['days/'+date],before['days/'+date]);assert.deepEqual(after['cfg/outfit'],before['cfg/outfit']);await context.close();
 });
 await check('0.75 a failed action replaces the preceding success and retry confirms only durable progress',async()=>{
  const {page:p,context}=await open();
  await p.evaluate(async()=>{const cur=__qa.S.days['2026-10-30'],q=cur.q.slice();q[0]=true;await __qa.writeDay('2026-10-30',cur,{q});});
  await p.waitForFunction(()=>document.querySelector('#daily-progress-feedback').textContent.includes('Дело дня сохранено'));const before=await docs(p);
  await p.evaluate(async()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic full','QuotaExceededError');return original.call(this,k,v);};try{const cur=__qa.S.days['2026-10-30'],q=cur.q.slice();q[1]=true;await __qa.writeDay('2026-10-30',cur,{q});}finally{Storage.prototype.setItem=original;}});
  assert.match(await p.locator('#daily-progress-feedback').innerText(),/не сохранена/);assert.match(await p.locator('#citadel-progress-feedback').textContent(),/не сохранена/);assert.equal(await p.evaluate(()=>__qa.progressSequence()),1);assert.deepEqual((await docs(p))['days/'+date],before['days/'+date]);
  await p.evaluate(async()=>{const cur=__qa.S.days['2026-10-30'],q=cur.q.slice();q[1]=true;await __qa.writeDay('2026-10-30',cur,{q});});
  await p.waitForFunction(()=>document.querySelector('#daily-progress-feedback').textContent.includes('Дело дня сохранено'));assert.equal(await p.evaluate(()=>__qa.progressSequence()),2);assert((await docs(p))['days/'+date].d.q[1]);await context.close();
 });
 await check('0.75 equipment preserves concurrent sibling slots and unknown save fields',async()=>{
  const seed=structuredClone(initial);seed['cfg/outfit']={top:'knit_beige',bottom:'pants_brown',outer:'none',future:{keep:true}};
  const {page:p,context}=await open({seed});
  const ids=await p.locator('#wd-top .witem').evaluateAll(ns=>ns.map(n=>n.dataset.item));const chosen=ids.find(x=>x!=='knit_beige');assert(chosen);
  await p.evaluate(async chosen=>{const task=__qa.equip('top',chosen);await __qa.idle();await task;},chosen);
  await p.waitForFunction(()=>document.querySelector('#wardrobe-status').textContent.includes('Сохранено'));
  const saved=(await docs(p))['cfg/outfit'].d;assert.equal(saved.top,chosen);assert.equal(saved.bottom,'pants_brown');assert.equal(saved.outer,'none');assert.deepEqual(saved.future,{keep:true});
  const sheet=await p.evaluate(()=>__qa.sheet());await p.reload();await p.waitForFunction(()=>__qa?.loading());await dismiss(p);assert.equal(await p.evaluate(()=>__qa.sheet()),sheet);assert.equal((await docs(p))['cfg/outfit'].d.top,chosen);
  const selected=p.locator('#wd-top .witem[data-item="'+chosen+'"]');assert.equal(await selected.getAttribute('aria-pressed'),'true');assert.match(await p.locator('#wardrobe-equipped').innerText(),/Надето:/);await context.close();
 });

 await check('0.75 equipment transactions merge concurrent sibling slots and reject competing same-slot changes',async()=>{
  for(const conflict of [false,true]){
   const {page:p,context}=await open();
   const variants=await p.locator('#wd-top .witem').evaluateAll(ns=>ns.map(n=>n.dataset.item));assert(variants.length>=3);
   const result=await p.evaluate(async({variants,conflict})=>{
    // Hold the real storage lock while both operations queue, so selection
    // captures the old UI and the sibling transaction commits first.
    let concurrent,selection;
    await navigator.locks.request('plan.store.v1',function(){
     concurrent=PlanDB.runTransaction(function(tx){const current=tx.get('cfg/outfit')||{};current.future={preserved:true};if(conflict)current.top=variants[2];else current.bottom='pants_black';tx.set('cfg/outfit',current);});
     selection=__qa.equip('top',variants[1]);
    });
    await concurrent;await selection;await __qa.idle();return PlanSync._docs()['cfg/outfit'].d;
   },{variants,conflict});
   assert.deepEqual(result.future,{preserved:true});assert.equal(result.top,conflict?variants[2]:variants[1]);
   if(conflict)assert.match(await p.locator('#wardrobe-status').innerText(),/не сохранена/);else assert.equal(result.bottom,'pants_black');await context.close();
  }
 });
 await check('0.75 responsive progress stays in the existing drawer and room inspection is read-only',async()=>{
  for(const [width,height]of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,shell:true});await shellDrawer(p,'left');
   assert(await p.locator('#citadel-rank-meter').isVisible());const b=await p.locator('#citadel-hero-progress').boundingBox();assert(b.width>50&&b.x>=0&&b.x+b.width<=width);
   await p.evaluate(()=>{__qa.move('study');document.querySelector('#citadel-enter').click();});await p.evaluate(()=>__qa.idle());const before=await docs(p);
   await p.locator('#citadel-interior-object').evaluate(n=>n.click());assert.match(await p.locator('#citadel-object-status').innerText(),/В книге дня:/);
   for(let i=0;i<8;i++)await p.locator('#citadel-interior-object').evaluate(n=>n.click());assert.deepEqual(await docs(p),before);
   assert.equal(await p.locator('#citadel-interior-stage').evaluate(n=>n.querySelector('.citadel-interior-furniture').getAnimations().length),0,'reduced motion has no object effect');
   await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('#citadel-interior-object').evaluate(n=>{for(let i=0;i<10;i++)n.click();});
   assert.equal(await p.locator('#citadel-interior-stage .citadel-room-light').evaluate(n=>getComputedStyle(n).display!=='none'&&n.getAnimations().filter(a=>!a.animationName).length),1,'repeated taps replace the visible finite response');
   assert.deepEqual(await docs(p),before);await context.close();
  }
 });
 await check('0.75 resident proximity faces shared hero while professions retain distinct work cadence',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16',shell:true,width:390});await p.evaluate(()=>{__qa.move('forge');document.querySelector('#citadel-enter').click();});
  const npc=p.locator('#citadel-interior-stage [data-person="smith"]');assert.equal(await npc.count(),1);
  await p.evaluate(()=>{const stage=document.querySelector('#citadel-interior-stage'),npc=stage.querySelector('[data-person="smith"]'),hero=stage.querySelector('.citadel-hero-sprite');npc.style.left=hero.style.left;__qa.faceResidents();});assert.equal(await npc.getAttribute('data-near'),'true');assert.match(await npc.getAttribute('data-facing'),/left|right/);
  await p.emulateMedia({reducedMotion:'no-preference'});const cadence=await p.evaluate(()=>{const stage=document.querySelector('#citadel-interior-stage'),durations=[];for(const person of ['guardian','archivist','smith','treasurer']){const n=document.createElement('span');n.className='citadel-person';n.dataset.person=person;n.dataset.mode='work';stage.appendChild(n);durations.push(getComputedStyle(n).animationDuration);n.remove();}return durations;});assert.equal(new Set(cadence).size,4);await context.close();
 });

 await check('0.74 final desktop interiors expose both doors between permanent side panels',async()=>{
  for(const width of [1050,1280,1440]){
   const {page:p,context}=await open({width,height:900,shell:true});await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
   const stage=await p.locator('#citadel-interior-stage').boundingBox(),left=await p.locator('.citadel-shell-drawer.left').boundingBox(),right=await p.locator('.citadel-shell-drawer.right').boundingBox();
   assert(stage.x>=left.x+left.width&&stage.x+stage.width<=right.x,'interior must fit between drawers');
   for(const door of await p.locator('#citadel-interior-stage .citadel-scene-door').all())assert(await door.evaluate(n=>{const b=n.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return n===hit||n.contains(hit);}),'both scene doors must receive real pointer hits');
   const destination=await p.locator('#citadel-interior-stage .citadel-scene-door').first().getAttribute('data-stage-door');await p.locator('#citadel-interior-stage .citadel-scene-door').first().click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),destination);
   if(width===1280)await p.screenshot({path:resolve(out,'final-074-desktop-interior.png')});await context.close();
  }
 });
 await check('0.74 final furniture regions remain touchable in every existing room',async()=>{
  for(const [width,height]of [[320,760],[360,800],[390,844],[430,900],[844,390],[1280,900]]){
   const {page:p,context}=await open({width,height,shell:true,seed:advancedSeed(),day:'2027-04-16'});
   for(const room of await p.locator('[data-croom]').evaluateAll(nodes=>nodes.map(n=>n.dataset.croom))){
    await p.evaluate(room=>{__qa.move(room);document.querySelector('#citadel-enter').click();},room);const object=p.locator('#citadel-interior-object'),box=await object.boundingBox(),stage=await p.locator('#citadel-interior-stage').boundingBox();assert(box.width>=44&&box.height>=44);assert(box.x>=stage.x&&box.x+box.width<=stage.x+stage.width&&box.y>=stage.y&&box.y+box.height<=stage.y+stage.height);
    await object.click();assert.equal(await object.getAttribute('data-inspected'),'true');assert.match(await p.locator('#citadel-object-status').innerText(),/:/);
   }
   if(width===390)await p.screenshot({path:resolve(out,'final-074-interaction-390.png')});await context.close();
  }
 });
 await check('0.74 final interrupted walking freezes position and faces the actual next target',async()=>{
  const {page:p,context}=await open({shell:true});await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});await p.emulateMedia({reducedMotion:'no-preference'});await p.evaluate(()=>__qa.idle());const before=await docs(p);
  // Freeze the finite WAAPI walk at a deterministic point, then redirect to a
  // target between the current position and the old destination.
  const state=await p.evaluate(()=>{
   const stage=document.querySelector('#citadel-interior-stage'),hero=stage.querySelector('.citadel-hero-sprite');
   stage.focus();stage.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
   const walk=hero.getAnimations().find(a=>!a.animationName);if(!walk)throw Error('finite walk missing');walk.pause();walk.currentTime=20;
   const actual=parseFloat(getComputedStyle(hero).left),target=parseFloat(hero.style.left),css=getComputedStyle(hero).animationName;
   return {actual,target,css};
  });
  assert(state.target>state.actual);assert.match(state.css,/citadelHeroStride/,'walking must use stride, not the idle breathing rule');
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.moving==='false');
  const stopped=await p.locator('#citadel-interior-stage .citadel-hero-sprite').evaluate(n=>parseFloat(getComputedStyle(n).left));assert(Math.abs(stopped-state.actual)<1,'cancelling must not jump to the old destination');assert(await p.locator('#citadel-walk-target').isHidden());
  await p.emulateMedia({reducedMotion:'no-preference'});
  await p.evaluate(()=>{const stage=document.querySelector('#citadel-interior-stage');stage.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));const hero=stage.querySelector('.citadel-hero-sprite'),walk=hero.getAnimations().find(a=>!a.animationName);walk.pause();walk.currentTime=20;const r=stage.getBoundingClientRect(),actual=parseFloat(getComputedStyle(hero).left),target=parseFloat(hero.style.left),mid=(actual+target)/2+hero.offsetWidth/2;stage.dispatchEvent(new MouseEvent('click',{clientX:r.left+stage.clientLeft+mid,clientY:r.bottom-stage.clientHeight*.08,bubbles:true}));});
  // The new target is left of the old destination but right of the hero.
  // Facing must follow the rendered path, not the old destination.
  const facing=await p.locator('#citadel-interior-stage').evaluate(stage=>{const hero=stage.querySelector('.citadel-hero-sprite'),walk=hero.getAnimations().find(a=>!a.animationName),f=walk.effect.getKeyframes();return {actual:stage.dataset.facing,expected:parseFloat(f[1].left)<parseFloat(f[0].left)?'left':'right'};});assert.equal(facing.actual,facing.expected);
  await p.emulateMedia({reducedMotion:'reduce'});assert.deepEqual(await docs(p),before);await context.close();
 });
 await check('0.74 final room light follows tiers and civil time without intercepting actions or writing progress',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16',shell:true});await p.locator('[data-croom="study"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});await p.evaluate(()=>__qa.idle());const before=await docs(p);
  assert.equal(await p.locator('.citadel-room-light').count(),11);assert.equal(await p.locator('#citadel-interior-stage .citadel-room-light').evaluate(n=>getComputedStyle(n).pointerEvents),'none');
  const day=await p.locator('#citadel-interior-stage').evaluate(n=>getComputedStyle(n).getPropertyValue('--window-color'));
  await p.clock.setSystemTime(new Date('2027-04-16T23:02:00+03:00'));await p.evaluate(()=>__qa.render());assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-phase'),'НОЧЬ');assert.notEqual(await p.locator('#citadel-interior-stage').evaluate(n=>getComputedStyle(n).getPropertyValue('--window-color')),day);
  const powers=await p.locator('#citadel-interior-stage').evaluate(stage=>{const light=stage.querySelector('.citadel-room-light'),level=stage.dataset.level,values=[];for(const tier of [1,2,3]){stage.dataset.level=tier;values.push(Number(getComputedStyle(light).opacity));}stage.dataset.level=level;return values;});assert(powers[0]<powers[1]&&powers[1]<powers[2]);
  await p.locator('[data-room-inspect]').click();assert.equal(await p.locator('#citadel-interior-object').getAttribute('data-inspected'),'true');assert.equal(await p.locator('#citadel-interior-stage .citadel-light-source').evaluate(n=>getComputedStyle(n).animationName),'none');
  await p.emulateMedia({reducedMotion:'no-preference'});assert.notEqual(await p.locator('#citadel-interior-stage .citadel-light-source').evaluate(n=>getComputedStyle(n).animationName),'none');await p.emulateMedia({reducedMotion:'reduce'});
  // Return to the original civil time before comparing persisted game state.
  await p.clock.setSystemTime(new Date('2027-04-16T14:00:00+03:00'));await p.evaluate(()=>__qa.render());assert.deepEqual(await docs(p),before);await context.close();
 });

 await check('0.74 resident arrival clears corridor coordinates and stays inside the destination room',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);
  await p.clock.setSystemTime(new Date('2027-04-16T14:15:05+03:00'));await p.evaluate(()=>__qa.render());
  const traveller=p.locator('#citadel-castle .citadel-person[data-person="guardian"]');const original=await traveller.elementHandle();assert.equal(await traveller.getAttribute('class'),'citadel-person is-travelling');assert.notEqual(await traveller.evaluate(n=>n.style.top),'');
  await p.clock.setSystemTime(new Date('2027-04-16T14:16:30+03:00'));await p.evaluate(()=>__qa.render());
  assert(await traveller.evaluate((n,old)=>n===old,original));assert.equal(await traveller.evaluate(n=>n.style.top),'','a resident must not keep castle coordinates inside a room');assert.equal(await traveller.evaluate(n=>n.style.left),'');
  assert(await traveller.evaluate(n=>{const a=n.getBoundingClientRect(),r=n.parentElement.getBoundingClientRect();return n.parentElement.dataset.croom==='observatory'&&a.left>=r.left&&a.right<=r.right&&a.top>=r.top&&a.bottom<=r.bottom;}),'arrived resident must be drawn in its destination');await context.close();
 });

 await check('0.74 resident controls and sprites keep focus while other schedules change',async()=>{
  const {page:p,context}=await open({seed:advancedSeed(),day:'2027-04-16'});await castle(p);
  const card=p.locator('[data-resident="guardian"] button');await card.focus();const original=await card.elementHandle();
  await p.clock.setSystemTime(new Date('2027-04-16T14:15:05+03:00'));await p.evaluate(()=>__qa.render());
  assert(await card.evaluate((n,old)=>n===old&&document.activeElement===n,original),'another errand must not replace the focused card');
  await p.clock.setSystemTime(new Date('2027-04-16T14:16:15+03:00'));await p.evaluate(()=>__qa.render());
  await p.locator('[data-croom="observatory"]').click();await p.locator('#citadel-enter').click();const actor=p.locator('#citadel-interior-stage [data-person="guardian"]');await actor.focus();const sprite=await actor.elementHandle();
  await p.evaluate(()=>__qa.idle());const before=await docs(p);
  await p.clock.setSystemTime(new Date('2027-04-16T14:16:19+03:00'));await p.evaluate(()=>__qa.render());
  assert(await actor.evaluate((n,old)=>n===old&&document.activeElement===n,sprite),'a stationary actor must retain focus and animation identity');
  const inspect=p.locator('[data-room-inspect]');await inspect.focus();const control=await inspect.elementHandle();
  await p.clock.setSystemTime(new Date('2027-04-16T14:16:30+03:00'));await p.evaluate(()=>__qa.render());
  assert(await inspect.evaluate((n,old)=>n===old&&document.activeElement===n,control));assert.deepEqual(await docs(p),before);await context.close();
 });
 await check('0.74 departing conversation restores room focus and companions face the hero',async()=>{
  const {page:p,context}=await open({width:320,seed:advancedSeed(),day:'2027-04-16',shell:true});
  await p.clock.setSystemTime(new Date('2027-04-16T09:59:59+03:00'));await p.evaluate(()=>__qa.render());await p.locator('[data-croom="study"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
  await p.locator('[data-room-talk="smith"]').click();const actor=p.locator('#citadel-interior-stage [data-person="smith"]');
  assert.equal(await actor.getAttribute('data-mode'),'interaction');assert(await actor.evaluate(n=>{const a=n.getBoundingClientRect(),h=document.querySelector('#citadel-interior-stage .citadel-hero-sprite').getBoundingClientRect();return n.dataset.facing===(h.left+h.width/2<a.left+a.width/2?'left':'right');}));
  assert.equal(await actor.evaluate(n=>getComputedStyle(n,'::after').content),'"◆"');await p.evaluate(()=>__qa.idle());const before=await docs(p);
  await p.clock.setSystemTime(new Date('2027-04-16T10:00:10+03:00'));await p.evaluate(()=>__qa.render());
  assert(await p.locator('#citadel-room-conversation').isHidden());assert(await p.locator('#citadel-interior-stage').evaluate(n=>document.activeElement===n),'departing NPC must return focus to the playable room');
  assert.equal(await p.locator('[data-room-talk="smith"]').count(),0);assert.deepEqual(await docs(p),before);await context.close();
 });
 await check('0.74 inspected objects give consistent touch and keyboard feedback without save writes',async()=>{
  for(const [width,height]of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,mobile:true,shell:true});await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});await p.evaluate(()=>__qa.idle());const before=await docs(p);
   const object=p.locator('#citadel-interior-object');await object.focus();await p.keyboard.press('Enter');assert.equal(await object.getAttribute('data-inspected'),'true');assert.match(await p.locator('#citadel-object-status').innerText(),/Старая кровать/);assert.equal(await object.evaluate(n=>getComputedStyle(n,'::before').animationName),'none');
   await p.keyboard.press('Space');await p.locator('[data-room-inspect]').click();assert.deepEqual(await docs(p),before);
   if(width===390)await p.screenshot({path:resolve(out,'android-074-object-390.png')});
   await context.close();
  }
 });

 await check('0.73 weight mirrors use the same valid dated measurement as the shared hero',async()=>{
  const seed=structuredClone(initial);seed['weights/start']={kg:160,date:'2026-01-01',ts:0};seed['weights/test']={kg:145,date,ts:1};
  const {page:p,context}=await open({seed});await castle(p);const shape=await p.evaluate(()=>__qa.shape());
  await write(p,'weights/backdated',{kg:130,date:'2026-10-29',ts:999,futureField:'keep'});
  assert.equal(await p.locator('#cur-weight').textContent(),'145','later entry time must not replace the latest calendar measurement');
  await write(p,'weights/outside-range',{kg:500,date,ts:1000,futureField:'keep'});await write(p,'weights/impossible',{kg:80,date:'2026-02-31',ts:1001});
  assert.equal(await p.locator('#citadel-live-body').textContent(),'ВЕС 145 КГ');assert.equal(await p.locator('#cur-weight').textContent(),'145');assert.equal(await p.evaluate(()=>__qa.shape()),shape);
  await p.locator('#citadel-activity-actions').getByRole('button',{name:'Осмотреть облик'}).click();assert.match(await p.locator('#citadel-activity-feedback').innerText(),/145 кг/);
  await p.evaluate(async()=>{const db=window.PlanDB;await db.doc('weights/test').delete();await db.doc('weights/backdated').delete();});await p.waitForFunction(()=>!__qa.S.weights.some(w=>w.id==='test'||w.id==='backdated'));
  assert.equal(await p.locator('#citadel-live-body').textContent(),'ВЕС 160 КГ');assert.equal(await p.locator('#cur-weight').textContent(),'160');
  const before=await docs(p);assert.equal(before['weights/outside-range'].d.kg,500);assert.equal(before['weights/impossible'].d.date,'2026-02-31');
  await p.reload();await castle(p);assert.equal(await p.locator('#citadel-live-body').textContent(),'ВЕС 160 КГ');assert.equal(await p.locator('#cur-weight').textContent(),'160');
  const copy=await p.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));await p.evaluate(copy=>PlanSync.importObj(copy,true),copy);await p.waitForFunction(()=>__qa.S.weights.some(w=>w.id==='start'));
  const after=await docs(p);for(const key of ['weights/start','weights/outside-range','weights/impossible'])assert.deepEqual(after[key].d,before[key].d,'invalid source records must remain recoverable');
  await context.close();
 });
 await check('0.73 interior walking, inspection and stable doors work at Android widths without progress writes',async()=>{
  for(const [width,height]of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,mobile:true,shell:true});await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});await p.evaluate(()=>__qa.idle());
   const before=await docs(p),stage=p.locator('#citadel-interior-stage'),hero=stage.locator('.citadel-hero-sprite');const box=await stage.boundingBox(),first=await hero.boundingBox();
   await stage.click({position:{x:box.width*.8,y:box.height*.93}});const walked=await hero.boundingBox();assert(walked.x>first.x,'a floor tap must move the actual sprite');
   await stage.focus();await p.keyboard.press('ArrowLeft');assert((await hero.boundingBox()).x<walked.x);
   await p.locator('[data-room-inspect]').click();assert.match(await p.locator('#citadel-object-status').innerText(),/Старая кровать/);assert.equal(await p.locator('[data-room-talk]').count(),0,'no residents before their rank');
   const door=stage.locator('.citadel-scene-door').first(),handle=await door.elementHandle();assert((await door.locator('small').innerText()).length>3);await door.focus();await p.evaluate(()=>__qa.render());
   assert(await door.evaluate((n,previous)=>n===previous&&document.activeElement===n,handle),'refresh must retain the focused door');
   const a=await hero.boundingBox(),b=await stage.boundingBox();assert(a.x>=b.x&&a.x+a.width<=b.x+b.width&&a.y+a.height<=b.y+b.height);
   assert(await p.locator('#citadel-room-actions').evaluate(n=>n.scrollWidth<=n.clientWidth));assert.deepEqual(await docs(p),before);
   if(width===390)await p.screenshot({path:resolve(out,'android-073-interior-390.png')});
   await context.close();
  }
 });
 await check('0.73 nearby resident actions follow schedules and Android Back closes conversation before room',async()=>{
  const {page:p,context}=await open({width:320,seed:advancedSeed(),day:'2027-04-16',shell:true});
  await p.clock.setSystemTime(new Date('2027-04-16T18:02:00+03:00'));await p.evaluate(()=>__qa.render());await p.locator('[data-croom="refectory"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
  assert.equal(await p.locator('[data-room-talk]').count(),4);await p.evaluate(()=>__qa.idle());const before=await docs(p);
  await p.locator('[data-room-talk="smith"]').click();assert(await p.locator('#citadel-room-conversation').isVisible());assert.match(await p.locator('#citadel-room-speech').innerText(),/Кузнец/);assert(await p.locator('#citadel-room-npc-action').evaluate(n=>{var b=n.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return hit===n||n.contains(hit);}),'conversation action must be reachable above the Android dock');
  const hero=await p.locator('#citadel-interior-stage .citadel-hero-sprite').boundingBox();
  for(const npc of await p.locator('#citadel-interior-stage .citadel-person,#citadel-interior-stage .citadel-scene-door,#citadel-interior-stage .citadel-scene-door small').all()){const b=await npc.boundingBox();assert(hero.x+hero.width<=b.x||hero.x>=b.x+b.width||hero.y+hero.height<=b.y||hero.y>=b.y+b.height,'hero must stop clear of residents, doors and labels');}
  await p.goBack();await p.waitForFunction(()=>document.querySelector('#citadel-room-conversation').hidden);assert.equal(await p.locator('#citadel-home').getAttribute('data-ui-view'),'room');
  await p.locator('[data-room-talk="smith"]').click();await p.keyboard.press('Escape');assert(await p.locator('#citadel-room-conversation').isHidden());assert.equal(await p.locator('#citadel-home').getAttribute('data-ui-view'),'room');
  await p.goBack();await p.waitForFunction(()=>document.querySelector('#citadel-home').dataset.uiView==='overview');
  await p.locator('[data-croom="refectory"]').click();await p.locator('[data-room-talk="smith"]').click();
  await p.clock.setSystemTime(new Date('2027-04-16T23:00:10+03:00'));await p.evaluate(()=>__qa.render());assert.equal(await p.locator('[data-room-talk]').count(),0);assert(await p.locator('#citadel-room-conversation').isHidden());
  assert.deepEqual(await docs(p),before);await context.close();
 });
 await check('0.73 walking animation stops for reduced motion and keeps the shared hero on resize',async()=>{
  const {page:p,context}=await open({shell:true});await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});await p.emulateMedia({reducedMotion:'no-preference'});
  const stage=p.locator('#citadel-interior-stage'),b=await stage.boundingBox();await stage.click({position:{x:b.width*.8,y:b.height*.93}});assert.equal(await stage.getAttribute('data-moving'),'true');
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.moving==='false');assert.equal(await stage.locator('.citadel-hero-sprite').evaluate(n=>n.getAnimations().length),0);
  await p.setViewportSize({width:320,height:700});await p.evaluate(()=>window.dispatchEvent(new Event('resize')));const hero=await stage.locator('.citadel-hero-sprite').boundingBox(),box=await stage.boundingBox();assert(hero.x>=box.x&&hero.x+hero.width<=box.x+box.width);
  const pixels=await p.evaluate(()=>['hero','citadel-interior-hero'].map(id=>Array.from(document.getElementById(id).getContext('2d').getImageData(0,0,32,52).data)));assert.deepEqual(pixels[0],pixels[1]);await context.close();
 });
 await check('0.72 Android finance create edit delete date and comma decimals keep one durable operation',async()=>{
  for(const [width,height]of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,mobile:true,shell:true});await shellNav(p,'Финансы');
   const before=await p.evaluate(()=>__qa.balance());
   await p.locator('#amt').fill('125,45');await p.locator('#what').fill('Synthetic long expense '.repeat(12));await p.locator('#tx-date').fill('2026-10-29');await p.locator('#cat').selectOption({label:'Продукты'});
   await p.evaluate(()=>{document.querySelector('#add').click();document.querySelector('#add').click();});
   await p.waitForFunction(()=>__qa.S.tx.length===1);await p.evaluate(()=>__qa.idle());
   const record=(await p.evaluate(()=>__qa.S.tx))[0];assert.equal(record.amt,125.45);assert.equal(record.date,'2026-10-29');assert.equal(await p.locator('#amt').inputValue(),'');
   assert.deepEqual(await p.evaluate(()=>__qa.balance()),{cash:1075.05,card:3400});
   await p.locator('#log [data-txid="'+record.id+'"] button[aria-label="Изменить операцию"]').click();
   await p.locator('#amt').fill('35.55');await p.locator('#what').fill('Synthetic edited');await p.locator('#kind').selectOption('in');await p.locator('#acc').selectOption('card');await p.locator('#tx-date').fill('2026-10-28');await p.locator('#add').click();
   await p.waitForFunction(()=>__qa.S.tx.length===1&&__qa.S.tx[0].amt===35.55);assert.equal((await p.evaluate(()=>__qa.S.tx))[0].id,record.id);
   assert.deepEqual(await p.evaluate(()=>__qa.balance()),{cash:1200.5,card:3435.55});
   await p.locator('#amt').fill('12,34');await p.locator('#what').fill('Unsaved synthetic draft');await p.locator('.citadel-finance-nav [data-finance="wheel"]').click();await p.locator('.citadel-finance-nav [data-finance="money"]').click();
   assert.equal(await p.locator('#amt').inputValue(),'12,34');assert.equal(await p.locator('#what').inputValue(),'Unsaved synthetic draft');assert.equal((await p.evaluate(()=>__qa.S.tx)).length,1);
   assert(await p.locator('.citadel-system-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth));
   if(width===390)await p.screenshot({path:resolve(out,'android-072-finance-390.png')});
   p.once('dialog',d=>d.dismiss());await p.locator('#log button[aria-label="Удалить запись"]').click();assert.equal((await p.evaluate(()=>__qa.S.tx)).length,1);
   p.once('dialog',d=>d.accept());await p.locator('#log button[aria-label="Удалить запись"]').click();await p.waitForFunction(()=>__qa.S.tx.length===0);assert.deepEqual(await p.evaluate(()=>__qa.balance()),before);
   await p.reload();await castle(p);assert.equal((await p.evaluate(()=>__qa.S.tx)).length,0);assert.deepEqual(await p.evaluate(()=>__qa.balance()),before);await context.close();
  }
 });
 await check('0.72 finance failures and stale edits retain drafts and preserve newer data',async()=>{
  const {page:p,context}=await open({shell:true});await shellNav(p,'Финансы');await p.locator('#amt').fill('12,34');await p.locator('#what').fill('Synthetic retained');
  const before=await docs(p);
  await p.evaluate(async()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,k,v);};try{document.querySelector('#add').click();await __qa.idle();}finally{Storage.prototype.setItem=original;}});
  assert.deepEqual(await docs(p),before);assert.equal(await p.locator('#amt').inputValue(),'12,34');assert.match(await p.locator('#tx-status').innerText(),/Не сохранено/);
  await p.locator('#add').click();await p.waitForFunction(()=>__qa.S.tx.length===1);const id=(await p.evaluate(()=>__qa.S.tx))[0].id;
  await p.locator('#log button[aria-label="Изменить операцию"]').click();await p.locator('#amt').fill('20,25');
  await p.evaluate(async id=>{const db=window.PlanDB;await db.doc('tx/'+id).update({amt:99.99,futureField:'preserved'});},id);await p.waitForFunction(()=>__qa.S.tx[0].amt===99.99);
  await p.locator('#add').click();await p.evaluate(()=>__qa.idle());assert.equal((await docs(p))['tx/'+id].d.amt,99.99);assert.equal(await p.locator('#amt').inputValue(),'20,25');assert.match(await p.locator('#tx-status').innerText(),/изменилась/);
  await p.locator('#tx-cancel').click();await p.locator('#log button[aria-label="Изменить операцию"]').click();await p.locator('#amt').fill('15,25');await p.locator('#add').click();await p.waitForFunction(()=>__qa.S.tx[0].amt===15.25);assert.equal((await docs(p))['tx/'+id].d.futureField,'preserved');
  await context.close();
 });
 await check('0.72 finance and Avito drafts survive unrelated writes and actual totals update',async()=>{
  const seed={...structuredClone(initial),'avito/one':{name:'Synthetic account',amt:10,ts:1}};const {page:p,context}=await open({seed,shell:true});await shellNav(p,'Финансы');
  await p.locator('#n-comm').fill('Keep draft');await p.locator('#a-comm').fill('42,50');
  await write(p,'weights/unrelated',{kg:130,date,ts:2});assert.equal(await p.locator('#n-comm').inputValue(),'Keep draft');assert.equal(await p.locator('#a-comm').inputValue(),'42,50');
  await p.locator('.citadel-finance-nav [data-finance="avito"]').click();const value=p.locator('#av-value-one');await value.fill('25,55');
  await write(p,'days/'+date,{q:Array(10).fill(false),steps:1234});assert.equal(await value.inputValue(),'25,55');
  await p.locator('#av-name').focus();await p.waitForFunction(()=>__qa.S.avito[0].amt===25.55);assert.match(await p.locator('#av-total').innerText(),/25,55/);
  await p.evaluate(async()=>{const db=window.PlanDB;await db.doc('avito/one').update({amt:30.25});});await p.waitForFunction(()=>__qa.S.avito[0].amt===30.25);assert.equal(await value.inputValue(),'30.25');
  await p.locator('#av-name').fill('Synthetic new');await p.locator('#av-amt').fill('4,75');await p.evaluate(()=>{document.querySelector('#av-add').click();document.querySelector('#av-add').click();});await p.waitForFunction(()=>__qa.S.avito.length===2);assert.match(await p.locator('#av-total').innerText(),/35/);
  await p.reload();await p.waitForFunction(()=>__qa.S.avito.length===2);assert.equal((await p.evaluate(()=>__qa.S.avito)).reduce((n,r)=>n+r.amt,0),35);await context.close();
 });
 await check('0.72 concurrent day patches and trial deltas preserve sibling history and unknown fields',async()=>{
  const seed=structuredClone(initial);seed['days/'+date].futureField='keep';const {page:p,context}=await open({seed});const other=await context.newPage();await other.goto(url);await other.waitForFunction(()=>__qa.S.days['2026-10-30']);
  await Promise.all([p.evaluate(()=>{const d=__qa.S.days['2026-10-30'];const q=d.q.slice();q[0]=true;return __qa.writeDay('2026-10-30',d,{q,steps:5432});}),other.evaluate(()=>{const d=__qa.S.days['2026-10-30'];const q=d.q.slice();q[2]=true;return __qa.writeDay('2026-10-30',d,{q,kcal:2000});})]);
  await p.waitForFunction(()=>__qa.S.days['2026-10-30']?.q?.[0]&&__qa.S.days['2026-10-30']?.q?.[2]);await other.waitForFunction(()=>__qa.S.days['2026-10-30']?.q?.[0]&&__qa.S.days['2026-10-30']?.q?.[2]);const day=await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.store.v1')).docs['days/2026-10-30'].d);assert(day.q[0]&&day.q[2]);assert.equal(day.steps,5432);assert.equal(day.kcal,2000);assert.equal(day.futureField,'keep');
  await Promise.all([p.evaluate(()=>{__qa.trialAdd('2026-10-30','sq',10);__qa.trialAdd('2026-10-30','sq',25);return __qa.idle();}),other.evaluate(()=>{__qa.trialAdd('2026-10-30','pu',10);return __qa.idle();})]);
  await Promise.all([p,other].map(tab=>tab.waitForFunction(()=>{const d=JSON.parse(localStorage.getItem('plan.store.v1')).docs['trial/2026-10-30']?.d;return d?.sq===35&&d?.pu===10;})));
  const trial=await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.store.v1')).docs['trial/2026-10-30'].d);assert.equal(trial.sq,35);assert.equal(trial.pu,10);await context.close();
 });
 await check('0.72 stale same-field progress rejects visibly while sibling updates and retries succeed',async()=>{
  const {page:p,context}=await open();const original=await p.evaluate(()=>structuredClone(__qa.S.days['2026-10-30']));
  await write(p,'days/'+date,{...original,steps:6000,futureField:'keep'});
  assert.equal(await p.evaluate(old=>__qa.writeDay('2026-10-30',old,{steps:3000}),original),false);
  assert.equal((await docs(p))['days/'+date].d.steps,6000);assert.match(await p.locator('#toast').innerText(),/Запись уже изменена/);
  assert.equal(await p.evaluate(old=>__qa.writeDay('2026-10-30',old,{kcal:1900}),original),true);
  assert.equal((await docs(p))['days/'+date].d.steps,6000);assert.equal((await docs(p))['days/'+date].d.kcal,1900);assert.equal((await docs(p))['days/'+date].d.futureField,'keep');
  await p.waitForFunction(()=>__qa.S.days['2026-10-30'].steps===6000);
  assert.equal(await p.evaluate(()=>__qa.writeDay('2026-10-30',__qa.S.days['2026-10-30'],{steps:7000})),true);
  await p.reload();await p.waitForFunction(()=>__qa.loading());assert.equal((await docs(p))['days/'+date].d.steps,7000);await context.close();
 });
 await check('0.73 conflicting task detail updates reject stale values and retain independent detail keys',async()=>{
  const {page:p,context}=await open();const key='days/'+date;
  await write(p,key,{...structuredClone(initial[key]),ex:{eng:1,futureDetail:{nested:['keep',42]}}});const old=await p.evaluate(()=>structuredClone(__qa.S.days['2026-10-30']));
  await p.evaluate(async()=>{const db=window.PlanDB;await db.doc('days/2026-10-30').update({ex:{eng:2,futureDetail:{nested:['keep',42]}}});});await p.waitForFunction(()=>__qa.S.days['2026-10-30'].ex.eng===2);
  assert.equal(await p.evaluate(old=>__qa.writeDay('2026-10-30',old,{ex:{...old.ex,eng:3}}),old),false,'a stale detail must not overwrite a newer value');
  assert.equal((await docs(p))[key].d.ex.eng,2);assert.match(await p.locator('#toast').innerText(),/Запись уже изменена/);
  assert.equal(await p.evaluate(old=>__qa.writeDay('2026-10-30',old,{ex:{...old.ex,cook:2}}),old),true);
  assert.deepEqual((await docs(p))[key].d.ex,{eng:2,cook:2,futureDetail:{nested:['keep',42]}});await p.reload();await p.waitForFunction(()=>__qa.loading());assert.deepEqual((await docs(p))[key].d.ex,{eng:2,cook:2,futureDetail:{nested:['keep',42]}});await context.close();
 });
 await check('0.72 exercise repeats respect the existing gap while separate types survive rapid input',async()=>{
  const {page:p,context}=await open();await p.evaluate(()=>{__qa.exercise('squat',10);__qa.exercise('pushup',10);__qa.exercise('squat',10);return __qa.idle();});
  let record=(await docs(p))['per/'+date].d;assert.equal(record.squat.length,1);assert.equal(record.pushup.length,1);
  await p.evaluate(()=>{__qa.undoExercise('squat');return __qa.idle();});record=(await docs(p))['per/'+date].d;assert.equal(record.squat.length,0);assert.equal(record.pushup.length,1);
  await p.reload();await p.waitForFunction(()=>__qa.S.per['2026-10-30']?.pushup?.length===1);await context.close();
 });
 await check('0.72 spontaneous tasks prevent pending duplicate adds, rename and survive failed saves',async()=>{
  const {page:p,context}=await open({shell:true});await shellNav(p,'Задания');await p.locator('#sp-name').fill('Synthetic daily task');
  await p.evaluate(()=>{document.querySelector('#sp-add').click();document.querySelector('#sp-add').click();});await p.waitForFunction(()=>__qa.S.spont.filter(r=>r.name==='Synthetic daily task').length===1);
  const row=p.locator('#slist2>div').filter({hasText:'Synthetic daily task'});p.once('dialog',d=>d.accept('Synthetic renamed'));await row.getByRole('button',{name:'изменить',exact:true}).click();await p.waitForFunction(()=>__qa.S.spont.some(r=>r.name==='Synthetic renamed'));
  await p.locator('#sp-name').fill('Keep failed task');await p.evaluate(async()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,k,v);};try{document.querySelector('#sp-add').click();await __qa.idle();}finally{Storage.prototype.setItem=original;}});
  assert.equal(await p.locator('#sp-name').inputValue(),'Keep failed task');assert(!(await p.evaluate(()=>__qa.S.spont)).some(r=>r.name==='Keep failed task'));
  await p.locator('#sp-add').click();await p.waitForFunction(()=>__qa.S.spont.some(r=>r.name==='Keep failed task'));await p.reload();await p.waitForFunction(()=>__qa.S.spont.some(r=>r.name==='Synthetic renamed'));await context.close();
 });
 await check('0.72 large profile retains history paging and reuses unchanged finance and weight DOM',async()=>{
  const seed=structuredClone(initial);for(let n=0;n<500;n++)seed['tx/history-'+n]={amt:1.25,kind:'out',acc:'cash',date,ts:n+1,cat:'Продукты',what:'Synthetic history '+n,counted:true};
  for(let n=0;n<300;n++)seed['weights/history-'+n]={kg:160-n/10,date,ts:n+2};
  const {page:p,context}=await open({seed,shell:true});await shellNav(p,'Финансы');assert.equal(await p.locator('#log li').count(),40);await p.locator('#tx-more').click();assert.equal(await p.locator('#log li').count(),80);
  const row=await p.locator('#log li').first().elementHandle(),chart=await p.locator('#spark svg').elementHandle();
  const duration=await p.evaluate(()=>{const start=performance.now();for(let i=0;i<5;i++)__qa.render();return Math.round(performance.now()-start);});
  assert(await p.locator('#log li').first().evaluate((n,old)=>n===old,row));assert(await p.locator('#spark svg').evaluate((n,old)=>n===old,chart));assert.deepEqual(await p.evaluate(()=>__qa.balance()),{cash:575.5,card:3400});
  console.log('Large synthetic profile, five refreshes ms:',duration);await context.close();
 });
 await check('0.73 large profile remains usable with CPU slowdown and bounded room DOM',async()=>{
  const seed=advancedSeed(),day='2027-04-16';
  for(let n=0;n<1000;n++)seed['tx/load-'+n]={amt:1.25,kind:'out',acc:'cash',date:day,ts:n+1,cat:'Продукты',what:'Synthetic load '+n,counted:true};
  for(let n=0;n<500;n++)seed['weights/load-'+n]={kg:160-n/20,date:'2026-10-30',ts:n+2};
  for(let n=0;n<300;n++)seed['spont/load-'+n]={name:'Synthetic task '+n,date:day,done:n%2===0,heavy:false,ts:n+1};
  const started=performance.now();const {page:p,context,session}=await open({seed,day,shell:true,slowCPU:true});const startupWallMs=Math.round(performance.now()-started);const startupRenders=await p.evaluate(()=>window.__qaRenderCount);await session.send('Performance.enable');
  await shellNav(p,'Финансы');assert.equal(await p.locator('#log li').count(),40);await p.locator('#tx-more').click();assert.equal(await p.locator('#log li').count(),80);
  await p.locator('.citadel-finance-nav [data-finance="wheel"]').click();assert(await p.locator('#spend').isVisible());await p.locator('.citadel-system-dialog header button').click();
  await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
  await session.send('HeapProfiler.collectGarbage');const initialMetrics=await session.send('Performance.getMetrics');
  const baseline=await p.evaluate(()=>document.querySelectorAll('*').length);
  for(let n=0;n<8;n++){await p.locator('#citadel-exits [data-travel="study"]').click();await p.locator('#citadel-exits [data-travel="rest"]').click();}
  await p.evaluate(()=>__qa.idle());assert.equal((await p.evaluate(()=>__qa.S.tx)).length,1000);assert.equal((await p.evaluate(()=>__qa.S.weights)).length,501);assert.equal((await p.evaluate(()=>__qa.S.spont)).length,301);
  const nodes=await p.evaluate(()=>document.querySelectorAll('*').length);assert(nodes<=baseline+8,'round trips must not accumulate room controls or sprites');
  await session.send('HeapProfiler.collectGarbage');const finalMetrics=await session.send('Performance.getMetrics');
  function metric(m,key){return m.metrics.find(x=>x.name===key)?.value;}
  console.log('Synthetic CPU4x profile:',JSON.stringify({transactions:1000,weights:501,tasks:301,startupWallMs,startupRenders,nodesBefore:baseline,nodesAfter:nodes,heapBefore:metric(initialMetrics,'JSHeapUsedSize'),heapAfter:metric(finalMetrics,'JSHeapUsedSize'),taskSeconds:metric(finalMetrics,'TaskDuration')-metric(initialMetrics,'TaskDuration')}));
  await session.send('Emulation.setCPUThrottlingRate',{rate:1});await context.close();
 });
 await check('0.72 unknown opening balances do not hide a new account operation history',async()=>{
  const {page:p,context}=await open({seed:{},shell:true});await shellNav(p,'Финансы');await p.locator('#amt').fill('10,50');await p.locator('#what').fill('Synthetic first expense');await p.locator('#add').click();await p.waitForFunction(()=>__qa.S.tx.length===1);
  assert.match(await p.locator('#log').innerText(),/Synthetic first expense/);assert.equal(await p.locator('#b-cash').innerText(),'нет данных');assert.match(await p.locator('#b-free3').innerText(),/баланс пока неизвестен/);assert.equal(await p.locator('#b-free').evaluate(n=>n.style.color),'');await context.close();
 });
 await check('0.72 restores an unchanged synthetic 0.71 backup with finance tasks and shared body state',async()=>{
  const copy=JSON.parse(await readFile(resolve('tests/fixtures/backup-071-synthetic.json'),'utf8'));
  const {page:p,context}=await open();await p.evaluate(copy=>PlanSync.importObj(copy,true),copy);await p.waitForFunction(()=>__qa.S.weights.length===2&&__qa.S.tx.length===1);
  const after=await docs(p);for(const [key,record]of Object.entries(copy.docs))assert.deepEqual(after[key].d,record.d);
  assert.deepEqual(await p.evaluate(()=>__qa.balance()),{cash:874.75,card:2000});const shape=await p.evaluate(()=>__qa.shape());
  assert(shape<1);await p.reload();await castle(p);assert.equal(await p.evaluate(()=>__qa.shape()),shape);assert.equal((await p.evaluate(()=>__qa.S.spont))[0].done,true);
  await context.close();
 });
 await check('0.72 independent progress flags and weekly marks preserve sibling fields across tabs',async()=>{
  const seed=structuredClone(initial);seed['weeks/2026-10-26']={meet:false,futureField:'keep'};seed['cfg/rare']={syntheticExisting:'2026-10-29'};
  const {page:p,context}=await open({seed});const other=await context.newPage();await other.goto(url);await other.waitForFunction(()=>__qa.markProgress&&__qa.S.rare.syntheticExisting&&document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
  await Promise.all([p,other].map(tab=>tab.waitForFunction(()=>__qa.loading())));
  await Promise.all([p.evaluate(()=>{__qa.toggleMeet();return __qa.markProgress('syntheticFirst');}),other.evaluate(()=>__qa.markProgress('syntheticSecond'))]);
  await Promise.all([p,other].map(tab=>tab.waitForFunction(()=>{const d=JSON.parse(localStorage.getItem('plan.store.v1')).docs['cfg/rare'].d;return d.syntheticFirst&&d.syntheticSecond&&d.syntheticExisting;})));
  const records=await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.store.v1')).docs);assert.equal(records['weeks/2026-10-26'].d.futureField,'keep');assert.equal(records['weeks/2026-10-26'].d.meet,true);
  assert(records['cfg/rare'].d.syntheticFirst&&records['cfg/rare'].d.syntheticSecond&&records['cfg/rare'].d.syntheticExisting);await context.close();
 });
 await check('0.72 progress commits survive twelve cross-tab orders, replay, offline and reload',async()=>{
  for(let attempt=0;attempt<12;attempt++){
   const seed=structuredClone(initial);seed['cfg/rare']={syntheticExisting:'2026-10-29',future:{nested:'keep'}};seed['weeks/2026-10-26']={meet:false,futureField:'keep'};
   const {page:p,context}=await open({seed});const other=await context.newPage();await other.goto(url);
   await Promise.all([p,other].map(tab=>tab.waitForFunction(()=>__qa.loading())));
   await context.setOffline(true);
   // Hold the real Web Lock, enqueue in either order, then release it. No
   // timer or sleep decides when the operation is considered complete.
   const holder=attempt%2?p:other;
   await holder.evaluate(()=>{window.__held=false;window.__hold=navigator.locks.request('plan.store.v1',()=>new Promise(resolve=>{window.__release=resolve;window.__held=true;}));});
   await holder.waitForFunction(()=>window.__held);
   const order=attempt%3?[p,other]:[other,p];
   for(const tab of order)await tab.evaluate(first=>{window.__operation=__qa.markProgress(first?'syntheticFirst':'syntheticSecond');window.__operation.catch(()=>{});},tab===p);
   await holder.evaluate(()=>window.__release());
   assert.deepEqual(await Promise.all([p,other].map(tab=>tab.evaluate(()=>window.__operation))),[true,true]);
   await p.evaluate(()=>{__qa.toggleMeet();const day=__qa.S.days['2026-10-30'];return __qa.writeDay('2026-10-30',day,{steps:4321});});await p.evaluate(()=>__qa.idle());
   await Promise.all([p,other].map(tab=>tab.waitForFunction(()=>{const d=JSON.parse(localStorage.getItem('plan.store.v1')).docs;return d['cfg/rare'].d.syntheticFirst&&d['cfg/rare'].d.syntheticSecond&&d['weeks/2026-10-26'].d.meet&&d['days/2026-10-30'].d.steps===4321;})));
   const before=(await docs(p))['cfg/rare'];
   assert.deepEqual(await Promise.all([p,other].map(tab=>tab.evaluate(()=>__qa.markProgress('syntheticFirst')))),[false,false]);
   assert.deepEqual((await docs(p))['cfg/rare'],before,'replay must not rewrite first observation or its revision');
   assert.deepEqual(before.d.future,{nested:'keep'});assert.equal((await docs(p))['weeks/2026-10-26'].d.futureField,'keep');
   await context.setOffline(false);await p.reload();await p.waitForFunction(()=>__qa.loading());
   assert.deepEqual((await docs(p))['cfg/rare'],before);assert.equal((await docs(p))['days/2026-10-30'].d.steps,4321);
   await context.close();
  }
 });
 await check('0.72 failed progress persistence rejects without optimistic success and can be retried',async()=>{
  const {page:p,context}=await open();const before=await docs(p);
  assert(await p.evaluate(async()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,k,v);};try{try{await __qa.markProgress('syntheticFailed');return false;}catch(e){return e.code==='quota_exceeded'&&!__qa.S.rare.syntheticFailed;}}finally{Storage.prototype.setItem=original;}}));
  assert.deepEqual(await docs(p),before);assert.equal(await p.evaluate(()=>__qa.markProgress('syntheticFailed')),true);
  await p.waitForFunction(()=>__qa.S.rare.syntheticFailed);await p.reload();await p.waitForFunction(()=>__qa.loading());assert((await docs(p))['cfg/rare'].d.syntheticFailed);await context.close();
 });
 await check('0.72 repeated completion and date changes keep durable history without duplicate resources',async()=>{
  const {page:p,context}=await open();
  async function completion(done){await p.evaluate(async done=>{const db=window.PlanDB;await db.doc('days/2026-10-30').update({q:Array(10).fill(done),steps:12000,kcal:2100});},done);await p.clock.runFor(900);await p.evaluate(()=>__qa.idle());}
  await completion(true);const earned=await p.evaluate(()=>__qa.S.abyss.earned);await completion(false);await completion(true);assert.equal(await p.evaluate(()=>__qa.S.abyss.earned),earned);
  await p.clock.setSystemTime(new Date('2026-10-31T00:01:00+03:00'));await p.clock.runFor(1100);assert.equal(await p.locator('#tx-date').inputValue(),'2026-10-31');
  await p.locator('#amt').evaluate(n=>n.value='9,99');await p.locator('#what').evaluate(n=>n.value='Synthetic unfinished draft');
  await p.clock.setSystemTime(new Date('2026-11-01T00:01:00+03:00'));await p.clock.runFor(1100);assert.equal(await p.locator('#tx-date').inputValue(),'2026-10-31');assert.equal(await p.locator('#amt').inputValue(),'9,99');
  await p.clock.setSystemTime(new Date('2026-10-30T15:00:00+03:00'));await p.clock.runFor(1100);assert((await docs(p))['days/2026-10-30'].d.q.every(Boolean));
  await context.close();
 });
 await check('optional body goal and new weight input synchronize the existing journal without parallel progress',async()=>{
  const seed=structuredClone(initial);seed['weights/start']={kg:165,date:'2026-10-19',ts:0};seed['weights/test']={kg:150,date,ts:1};
  const {page:p,context}=await open({shell:true,seed});await shellNav(p,'Тело');
  await p.locator('#body-goal').evaluate(n=>n.closest('details').open=true);
  await p.locator('#body-goal').fill('130');await p.locator('#body-goal-save').click();await p.waitForFunction(()=>__qa.S.bodyAppearance?.goal===130);
  const before=await p.evaluate(()=>__qa.shape());await p.locator('#in-weight').fill('145');await p.locator('#w-add').click();await p.waitForFunction(()=>__qa.S.weights.some(w=>w.kg===145));await p.evaluate(()=>__qa.idle());
  assert((await p.evaluate(()=>__qa.shape()))<before);
  const saved=await docs(p);assert.deepEqual(saved['weights/test'].d,seed['weights/test']);assert.deepEqual(saved['weights/start'].d,seed['weights/start']);
  const shape=await p.evaluate(()=>__qa.shape());await p.reload();await p.waitForFunction(()=>window.__qa?.S.bodyAppearance?.goal===130&&__qa.S.weights.some(w=>w.kg===145));await dismiss(p);assert.equal(await p.evaluate(()=>__qa.shape()),shape);
  await write(p,'weights/future',{kg:80,date:'2099-01-01',ts:999});assert.equal(await p.evaluate(()=>__qa.shape()),shape);
  await context.close();
 });
 await check('weight edits, deletion and invalid calendar records recover the correct shared silhouette',async()=>{
  const seed=structuredClone(initial);seed['weights/start']={kg:160,date:'2026-01-01',ts:0};seed['weights/test']={kg:145,date,ts:1};
  const {page:p,context}=await open({shell:true,seed});const middle=await p.evaluate(()=>__qa.shape());
  await write(p,'weights/test',{kg:130,date,ts:2});assert((await p.evaluate(()=>__qa.shape()))<middle);
  await write(p,'weights/invalid',{kg:80,date:'2026-02-31',ts:99});
  await p.evaluate(async()=>{const db=window.PlanDB;await db.doc('weights/test').delete();});
  await p.waitForFunction(()=>!__qa.S.weights.some(w=>w.id==='test'));await p.evaluate(()=>__qa.render());
  const restored=await p.evaluate(()=>__qa.shape());assert(restored>middle,'deletion must restore the last valid entry, ignoring an impossible calendar date');
  const source=(await docs(p))['weights/start'];assert.deepEqual(source.d,seed['weights/start']);
  await p.evaluate(async()=>{const db=window.PlanDB;await db.doc('weights/start').delete();});await p.waitForFunction(()=>!__qa.S.weights.some(w=>w.id==='start'));assert.equal(await p.evaluate(()=>__qa.shape()),1);
  await context.close();
 });
 await check('body geometry follows latest weight reversibly across shared sprites and every outfit',async()=>{
  const {page:p,context}=await open({seed:{...initial,'weights/test':{kg:165,date,ts:1}}});
  const original=await docs(p),samples=[];
  for(const kg of [160,145,130,115,100,145,160]){
   await write(p,'weights/test',{kg,date,ts:2});await p.waitForFunction(k=>__qa.S.weights.some(w=>w.kg===k),kg);await p.evaluate(()=>__qa.render());
   const sample=await p.evaluate(()=>{const ids=['hero','citadel-avatar-canvas','citadel-interior-hero'];return {f:__qa.shape(),pixels:ids.map(id=>Array.from(document.getElementById(id).getContext('2d').getImageData(0,0,32,52).data))};});
   assert.deepEqual(sample.pixels[0],sample.pixels[1]);assert.deepEqual(sample.pixels[1],sample.pixels[2]);
   const frames=await p.evaluate(async()=>{const im=new Image();im.src=__qa.sheet();await im.decode();const c=document.createElement('canvas');c.width=128;c.height=52;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return [0,1,2,3].map(f=>Array.from(ctx.getImageData(f*32,0,32,52).data));});
   for(const frame of frames){assert.deepEqual(frame.slice(0,9*128),sample.pixels[0].slice(0,9*128),'hair and upper face stay fixed in all animation frames');assert(frame.some((v,i)=>i%4===3&&Math.floor(i/128)>=33&&Math.floor(i/128)<=37&&v),'walking must retain hands and sleeves');}
   assert.notDeepEqual(frames[2],frames[0]);assert.notDeepEqual(frames[3],frames[0]);
   const opaque=sample.pixels[0].filter((_,i)=>i%4===3&&sample.pixels[0][i]>0).length;
   const rows=Array.from({length:52},(_,y)=>sample.pixels[0].slice(y*128,(y+1)*128).some((v,i)=>i%4===3&&v));assert.equal(rows.findIndex(Boolean),0);assert.equal(rows.lastIndexOf(true),51);
   const torso=Array.from({length:32},(_,x)=>sample.pixels[0][(25*32+x)*4+3]).map((a,x)=>a?x:-1).filter(x=>x>=0);const width=torso[torso.length-1]-torso[0]+1;
   const hair=sample.pixels[0].slice(0,12*32*4);if(samples.length)assert.deepEqual(hair,samples[0].hair);
   samples.push({kg,f:sample.f,opaque,width,hair,pixels:sample.pixels[0]});
   if([160,145,130,115,100].includes(kg))await p.locator('.stage').screenshot({path:resolve(out,'body-'+kg+'-synthetic.png')});
  }
  for(let i=1;i<5;i++){assert(samples[i].f<samples[i-1].f);assert(samples[i].opaque<samples[i-1].opaque);assert(samples[i].width<samples[i-1].width);}
  assert.deepEqual(samples[5].pixels,samples[1].pixels);assert.deepEqual(samples[6].pixels,samples[0].pixels);
  // Render every built-in outfit at both endpoints without persisting changes.
  assert(await p.evaluate(()=>__qa.outfitCheck()),'all garments retain skin pixels and fixed height at both shapes');
  await write(p,'weights/test',{kg:140,date,ts:3});await p.evaluate(()=>__qa.render());const pixels=await p.locator('#hero').evaluate(c=>c.toDataURL());
  await p.reload();await p.waitForFunction(()=>window.__qa?.loading()&&__qa.S.weights.some(w=>w.kg===140));await dismiss(p);await p.evaluate(()=>__qa.render());assert.equal(await p.locator('#hero').evaluate(c=>c.toDataURL()),pixels);
  const after=await docs(p);for(const[k,v]of Object.entries(original))if(k==='cfg/opening'||k==='cfg/outfit'||k.startsWith('tx/')||k.startsWith('buys/')||k.startsWith('days/'))assert.deepEqual(after[k],v);
  await context.close();
 });
 await check('0.70 original ginger silhouette is shared by profile and both Citadel sprites',async()=>{
  const {page:p,context}=await open({shell:true,seed:initial});
  await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
  const pixels=await p.evaluate(()=>['hero','citadel-avatar-canvas','citadel-interior-hero'].map(id=>{const c=document.getElementById(id);return Array.from(c.getContext('2d').getImageData(0,0,32,52).data);}));
  assert.deepEqual(pixels[1],pixels[2]);assert.deepEqual(pixels[0],pixels[1]);
  assert(pixels[1][(1*32+12)*4+3]>0,'original crown of ginger hair must be restored');
  await p.locator('#citadel-interior-object').click();assert.equal(await p.locator('.citadel-interior-stage .citadel-hero-sprite').evaluate(n=>n.getAnimations().length),0,'reduced motion keeps sprite still');
  await p.screenshot({path:resolve(out,'hero-070-room-390.png')});await context.close();
 });
 await check('0.70 idle and interaction animation use pixel steps without changing synthetic progress',async()=>{
  const {page:p,context}=await open({shell:true});await p.emulateMedia({reducedMotion:'no-preference'});
  await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
  const before=await docs(p);const sprite=p.locator('.citadel-interior-stage .citadel-hero-sprite');
  assert(await sprite.evaluate(n=>getComputedStyle(n).imageRendering==='pixelated'));
  assert(await sprite.evaluate(n=>n.getAnimations().some(a=>a.animationName==='citadelHeroBlink')));
  await p.locator('#citadel-interior-object').click();assert(await sprite.evaluate(n=>n._reaction?.effect.getTiming().duration===320));
  await p.clock.runFor(400);assert.deepEqual(await docs(p),before,'animation must not write game progress');
  await shellNav(p,'Профиль');await p.screenshot({path:resolve(out,'hero-070-wardrobe-390.png')});await context.close();
 });
 await check('Android 0.69 finance wheel uses the existing chart and persistent four-tab navigation',async()=>{
  for(const [width,height] of [[320,760],[360,800],[390,844],[430,900],[844,390]])for(const populated of [false,true]){
   const seed=populated?structuredClone(initial):{};
   if(populated)seed['tx/wheel']={amt:125.5,kind:'out',acc:'cash',cat:'Продукты',what:'Synthetic wheel',date,ts:1,counted:true};
   const {page:p,context}=await open({width,height,mobile:true,shell:true,seed});
   const before=await docs(p),balance=await p.evaluate(()=>__qa.balance());
   await p.evaluate(()=>window.__sameDocument={});const marker=await p.evaluateHandle(()=>window.__sameDocument);
   await shellNav(p,'Финансы');
   const nav=p.locator('.citadel-finance-nav');assert(await nav.isVisible());
   assert.deepEqual(await nav.locator('button').allTextContents(),['Траты','Деньги','Авито','Колесо']);
   assert(await nav.locator('button').evaluateAll(ns=>ns.every(n=>n.scrollWidth<=n.clientWidth&&n.getBoundingClientRect().height>=44)));
   const originalChart=await p.locator('#donut').elementHandle();
   for(const id of ['wheel','spend','money','avito','wheel','money','wheel']){
    await nav.locator('[data-finance="'+id+'"]').click();await p.clock.runFor(32);
    assert.equal(await nav.locator('[aria-selected="true"]').getAttribute('data-finance'),id);
    assert(await nav.isVisible());assert.equal(await p.locator('.citadel-system-content .panel').count(),1);
    assert(await p.locator('.citadel-system-content #'+(id==='wheel'?'spend':id)).isVisible());
    assert.equal(await p.evaluate(m=>window.__sameDocument===m,marker),true,'tab switches must not reload');
    if(id==='wheel'||id==='spend'){
     assert.equal(await p.locator('#donut').count(),1);assert(await p.locator('#donut').evaluate((n,old)=>n===old,originalChart),'chart must be moved, never cloned');
     assert.equal(await p.locator('#donutwrap').isVisible(),populated);
     if(populated)assert.match(await p.locator('#dc-sum').innerText(),/126/);else assert(await p.locator('.finance-empty').isVisible());
    }
    assert(await p.locator('.citadel-system-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth));
    assert(await p.locator('.citadel-system-content').evaluate(n=>n.scrollWidth<=n.clientWidth));
   }
   for(const period of ['p-week','p-month','p-day']){await p.locator('#'+period).click();assert.equal(await p.locator('#'+period).getAttribute('aria-pressed'),'true');}
   if(width===390)await p.screenshot({path:resolve(out,'android-069-wheel-'+(populated?'filled':'empty')+'-390.png')});
   assert.deepEqual(await docs(p),before);assert.deepEqual(await p.evaluate(()=>__qa.balance()),balance);
   await p.goBack();assert(!(await p.locator('.citadel-system-dialog').isVisible()));
   await context.close();
  }
 });
 await check('1.0 finance wheel shows historical months after restoring older expenses without editing saves',async()=>{
  const seed={
   'cfg/opening':{cash:1000,card:2000},
   'tx/september':{amt:40,kind:'out',acc:'cash',cat:'Продукты',date:'2026-09-20',ts:1,counted:true},
   'tx/october':{amt:125,kind:'out',acc:'cash',cat:'Продукты',date:'2026-10-30',ts:2,counted:true}
  };
  for(const width of [320,390]){
   const {page:p,context}=await open({width,height:844,mobile:true,shell:true,seed,day:'2026-11-02'});
   const before=await docs(p),balance=await p.evaluate(()=>__qa.balance());
   await shellNav(p,'Финансы');await p.locator('[data-finance="wheel"]').click();
   await p.locator('#p-month').click();
   assert(await p.locator('#sp-history').isVisible());
   assert.match(await p.locator('#sp-history-label').innerText(),/ноябрь 2026/i);
   assert(await p.locator('#sp-next').isDisabled());
   await p.locator('#sp-prev').click();
   assert.match(await p.locator('#sp-history-label').innerText(),/октябрь 2026/i);
   assert.match(await p.locator('#dc-sum').innerText(),/125/);
   await p.locator('#sp-prev').click();
   assert.match(await p.locator('#sp-history-label').innerText(),/сентябрь 2026/i);
   assert.match(await p.locator('#dc-sum').innerText(),/40/);
   assert(await p.locator('#sp-prev').isDisabled());
   await p.locator('#sp-next').click();await p.locator('#sp-next').click();
   assert(await p.locator('#sp-next').isDisabled());
   await p.locator('#p-day').click();assert(await p.locator('#sp-history').isHidden());
   assert.deepEqual(await docs(p),before);assert.deepEqual(await p.evaluate(()=>__qa.balance()),balance);
   assert(await p.locator('.citadel-system-content').evaluate(n=>n.scrollWidth<=n.clientWidth));
   await context.close();
  }
 });
 await check('Android 0.69 room focus, overview and zoom move only the camera without accumulating drift',async()=>{
  for(const [width,height]of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,mobile:true,shell:true,seed:advancedSeed(),day:'2027-04-16'});
   await p.clock.runFor(64);const viewport=p.locator('.citadel-viewport'),camera=p.locator('.citadel-shell-camera');
   async function shellGeometry(){return p.evaluate(()=>{const v=document.querySelector('.citadel-viewport'),r=v.getBoundingClientRect(),anc=[];for(let n=v.parentElement;n;n=n.parentElement)anc.push([n.id||n.className,n.scrollLeft,n.scrollTop]);return {anc,rect:[r.left,r.top,r.width,r.height]};});}
   const geometry=await shellGeometry();
   const economy=await p.evaluate(()=>({balance:__qa.balance(),abyss:JSON.parse(JSON.stringify(__qa.S.abyss)),buys:JSON.parse(JSON.stringify(__qa.S.buys))}));
   for(const room of ['study','rest','vault','study']){
    await p.evaluate(id=>__qa.move(id),room);await p.evaluate(()=>__qa.idle());await p.clock.runFor(64);
    for(let repeat=0;repeat<3;repeat++){
     const expected=await viewport.evaluate((v,id)=>{const r=document.querySelector('[data-croom="'+id+'"]').getBoundingClientRect(),b=v.getBoundingClientRect();return {left:Math.max(0,Math.min(v.scrollWidth-v.clientWidth,v.scrollLeft+r.left-b.left-v.clientLeft+(r.width-v.clientWidth)/2)),top:Math.max(0,Math.min(v.scrollHeight-v.clientHeight,v.scrollTop+r.top-b.top-v.clientTop+(r.height-v.clientHeight)/2))};},room);
     await camera.getByRole('button',{name:'К комнате',exact:true}).click();await p.clock.runFor(64);
     const pos=await viewport.evaluate(v=>({left:v.scrollLeft,top:v.scrollTop}));
     assert(Math.abs(pos.left-expected.left)<=1&&Math.abs(pos.top-expected.top)<=1,'focus must center and clamp inside viewport: '+JSON.stringify({width,room,pos,expected}));
     assert.deepEqual(await shellGeometry(),geometry,'focus must not scroll shell ancestors or displace the viewport');
    }
    if(width===390&&room==='study')await p.screenshot({path:resolve(out,'android-069-room-focus-390.png')});
    for(const name of ['+','−']){await camera.getByRole('button',{name,exact:true}).click();await p.clock.runFor(64);assert.deepEqual(await shellGeometry(),geometry);}
    await camera.getByRole('button',{name:'Общий вид',exact:true}).click();await p.clock.runFor(64);
    assert(await viewport.evaluate(v=>v.scrollLeft===0&&v.scrollTop===0&&document.querySelector('#citadel-castle').getBoundingClientRect().width<=v.clientWidth+1));
    assert.deepEqual(await shellGeometry(),geometry);
    assert(await p.locator('.citadel-floor-caption,.citadel-skyline').evaluateAll(ns=>{const v=document.querySelector('.citadel-viewport').getBoundingClientRect();return ns.every(n=>{const r=n.getBoundingClientRect();return r.left>=v.left&&r.right<=v.right;});}));
   }
   if(width===390)await p.screenshot({path:resolve(out,'android-069-overview-390.png')});
   // Pinch uses actual rendered castle bounds, including centered margins at overview scale.
   await viewport.evaluate(v=>{const r=v.getBoundingClientRect(),y=r.top+Math.min(100,r.height/2),x=r.left+r.width/2;function touches(d){return [new Touch({identifier:1,target:v,clientX:x-d,clientY:y}),new Touch({identifier:2,target:v,clientX:x+d,clientY:y})];}v.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:touches(30)}));v.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:touches(60)}));v.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}));});
   await p.clock.runFor(500);assert.deepEqual(await shellGeometry(),geometry,'pinch must never scroll ancestors');
   await camera.getByRole('button',{name:'Общий вид',exact:true}).click();await p.clock.runFor(64);
   await camera.getByRole('button',{name:'+',exact:true}).click();await camera.getByRole('button',{name:'К комнате',exact:true}).click();await p.clock.runFor(500);
   const position=await viewport.evaluate(v=>({left:v.scrollLeft,top:v.scrollTop}));
   await p.reload();await p.waitForFunction(()=>window.__qa?.S.abyss?.rank>=24);await dismiss(p);await p.clock.runFor(500);
   const restored=await viewport.evaluate(v=>({left:v.scrollLeft,top:v.scrollTop}));assert.deepEqual(restored,position,'camera preference survives reload without shifting ancestors');
   assert.deepEqual(await shellGeometry(),geometry);
   assert.deepEqual(await p.evaluate(()=>({balance:__qa.balance(),abyss:JSON.parse(JSON.stringify(__qa.S.abyss)),buys:JSON.parse(JSON.stringify(__qa.S.buys))})),economy);
   await p.setViewportSize({width:height,height:width});await p.clock.runFor(64);await dismiss(p);await camera.getByRole('button',{name:'Общий вид',exact:true}).click();await p.clock.runFor(64);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await context.close();
  }
 });
 await check('landscape mobile castle keeps rooms and camera reachable',async()=>{
  const {page:p,context}=await open({width:844,height:390,mobile:true,shell:true,seed:advancedSeed()});
  assert(await p.locator('#citadel-castle').isVisible());
  assert.equal(await p.locator('[data-croom]').count(),10);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:resolve(out,'graphics-landscape-844x390.png')});
  await p.locator('.citadel-shell-camera button').filter({hasText:'+'}).click();
  await p.locator('[data-croom="gatehouse"]').evaluate(n=>n.scrollIntoView({block:'center',inline:'center'}));
  const target=await p.locator('[data-croom="gatehouse"]').evaluate(n=>{const r=n.getBoundingClientRect(),x=Math.round(r.left+40),y=Math.round(r.top+35);return {x,y,visible:document.elementFromPoint(x,y)?.closest('[data-croom="gatehouse"]')===n,room:[r.left,r.top,r.right,r.bottom],viewport:[innerWidth,innerHeight]};});
  assert(target.visible,'landscape camera must expose selected room: '+JSON.stringify(target));
  await p.touchscreen.tap(target.x,target.y);
  await p.waitForFunction(()=>document.querySelector('#citadel-home').dataset.uiView==='room');
  assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),'gatehouse');
  await p.screenshot({path:resolve(out,'graphics-landscape-gatehouse-844x390.png')});
  await context.close();
 });
 await check('single Citadel shell, drawers, mobile camera and real game panels',async()=>{
  for(const width of [320,360,390,430,768,1280]){
   const {page:p,context}=await open({width,shell:true,seed:advancedSeed(),day:'2027-04-16'});
   await p.waitForFunction(()=>!!window.__citadelShell);
   assert(await p.locator('#citadel-castle').isVisible());assert(!(await p.locator('.stage').isVisible()));
   assert.equal(await p.locator('[data-croom]').count(),10);
   assert.match(await p.locator('.citadel-shell-drawer.left').innerText(),/Ранг 24/);
   if(width<700)await shellMenu(p);
   assert(await p.locator('.citadel-shell-nav .pl-chip').isVisible());await p.locator('.citadel-shell-nav .pl-chip').click();assert(await p.locator('.pl-menu').isVisible());await p.locator('.pl-menu').getByRole('button',{name:'ЗАКРЫТЬ',exact:true}).click();
   if(width<700)await shellMenu(p);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390){await p.locator('.citadel-shell-dock button').last().click();assert.equal(await p.locator('.citadel-shell-menu-toggle').getAttribute('aria-expanded'),'true');await p.screenshot({path:resolve(out,'shell-menu-390.png')});await shellMenu(p);}
   if(width<1050){await shellDrawer(p,'left');assert.equal(await p.locator('#citadel-home').getAttribute('data-drawer'),'left');
   if(width===390)await p.screenshot({path:resolve(out,'shell-left-390.png')});await p.locator('.citadel-shell-shade').click({position:{x:width-5,y:100}});assert.equal(await p.locator('#citadel-home').getAttribute('data-drawer'),'');
   if(width===390){for(const [label,id] of [['Хроника','week'],['Траты','spend'],['Авито','avito']]){await shellNav(p,label);assert(await p.locator('.citadel-system-dialog #'+id).isVisible());await p.locator('.citadel-system-dialog header button').click();}}
   await shellDrawer(p,'right');assert.equal(await p.locator('#citadel-home').getAttribute('data-drawer'),'right');
   if(width===390)await p.screenshot({path:resolve(out,'shell-right-390.png')});await p.locator('.citadel-shell-shade').click({position:{x:5,y:100}});}
   await shellNav(p,'Задания');assert(await p.locator('.citadel-system-dialog').isVisible());assert.equal(await p.evaluate(()=>!!history.state?.citadelMystery),false,'ordinary panels must not add mystery history entries');assert(await p.locator('.citadel-system-dialog #qlist').isVisible());if(width===390)await p.screenshot({path:resolve(out,'rpg-tasks-390.png')});
   await p.locator('.citadel-system-dialog header button').click();assert(await p.locator('#citadel-castle').isVisible());
   for(const [label,id] of [['Финансы','money'],['Воспоминания','shop'],['Профиль','wardrobe']]){await shellNav(p,label);assert(await p.locator('.citadel-system-dialog #'+id).isVisible());if(width===390)await p.screenshot({path:resolve(out,'rpg-'+id+'-390.png')});await p.locator('.citadel-system-dialog header button').click();}
   if(width===390){await shellNav(p,'Настройки');assert(await p.locator('#setup').isVisible());await p.screenshot({path:resolve(out,'rpg-settings-390.png')});await p.locator('#setup-x').click();await shellNav(p,'Достижения');assert(await p.locator('#trophy').isVisible());await p.screenshot({path:resolve(out,'rpg-achievements-390.png')});await p.locator('#trophy-x').click();}
   await p.locator('.citadel-shell-camera button').filter({hasText:'+'}).click();assert(await p.locator('#citadel-castle').evaluate(n=>n.clientWidth>600));
   await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});if(width===390)await p.screenshot({path:resolve(out,'shell-room-390.png')});
   await shellNav(p,'Цитадель');assert(await p.locator('#citadel-castle').isVisible());
   await p.screenshot({path:resolve(out,'shell-game-'+width+'.png')});
   if(width===390){
    const pinch=await p.locator('.citadel-viewport').evaluate(n=>{const castle=document.querySelector('#citadel-castle'),before=castle.clientWidth,t=(id,x)=>new Touch({identifier:id,target:n,clientX:x,clientY:400}),send=(type,a,b)=>n.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:[t(1,a),t(2,b)],targetTouches:[t(1,a),t(2,b)]}));send('touchstart',120,220);send('touchmove',70,270);n.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],targetTouches:[]}));return {before,after:castle.clientWidth};});assert(pinch.after>pinch.before,'two-finger gesture must enlarge the castle');await p.clock.runFor(500);
    await shellDrawer(p,'left');await p.goBack();assert.equal(await p.locator('#citadel-home').getAttribute('data-drawer'),'');
    await shellNav(p,'Задания');await p.goBack();assert(!(await p.locator('.citadel-system-dialog').isVisible()));
    await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});await p.goBack();await p.waitForFunction(()=>document.querySelector('#citadel-home').dataset.uiView==='overview');assert(await p.locator('#citadel-castle').isVisible());
    // Finish the room-to-overview animation frame before issuing a new pan.
    await p.clock.runFor(64);
    // Camera offsets are clamped by the real viewport dimensions; compare with the actual scroll position.
    const cameraBefore=await p.locator('.citadel-viewport').evaluate(n=>{n.scrollLeft=150;n.scrollTop=95;return {left:n.scrollLeft,top:n.scrollTop};});
    assert(cameraBefore.left>0||cameraBefore.top>0,'camera viewport must allow panning after pinch zoom');
    await p.clock.runFor(64); // deliver native scroll and its persistence debounce
    await p.clock.runFor(450);
    await p.waitForFunction(expected=>{const c=JSON.parse(localStorage.getItem('plan.citadel.camera.v1')||'null');return c&&Math.abs(c.left-expected.left)<=2&&Math.abs(c.top-expected.top)<=2;},cameraBefore);
    await p.reload();await p.waitForFunction(()=>!!window.__citadelShell);
    await p.waitForFunction(expected=>{const n=document.querySelector('.citadel-viewport');return n&&Math.abs(n.scrollLeft-expected.left)<=2&&Math.abs(n.scrollTop-expected.top)<=2;},cameraBefore);
   }
   await context.close();
  }
 });
 await check('saved renovation controls visible room artwork, purchase and reload',async()=>{
  const fresh=await open({width:390,shell:true,seed:initial});
  assert.equal(await fresh.page.evaluate(()=>__qa.roomLevel('study')),1);
  assert(await fresh.page.locator('[data-croom="study"]').evaluate(n=>getComputedStyle(n,'::before').backgroundImage.includes('study-interior-1.svg')));
  await fresh.page.locator('[data-croom="study"]').click();
  await fresh.page.waitForFunction(()=>!document.querySelector('#citadel-interior').hidden&&document.querySelector('#citadel-interior-stage').dataset.room==='study');
  assert.equal(await fresh.page.locator('#citadel-interior-stage').getAttribute('data-level'),'1');
  assert(await fresh.page.locator('#citadel-interior-stage').evaluate(n=>getComputedStyle(n,'::before').backgroundImage.includes('study-interior-1.svg')));
  await fresh.page.locator('#citadel-interior-stage').screenshot({path:resolve(out,'progress-study-abandoned-390.png')});
  await fresh.context.close();
  for(const [width,height] of [[320,844],[360,844],[390,844],[430,844],[844,390]]){
  const {page:p,context}=await open({width,height,mobile:true,shell:true,seed:advancedSeed(),day:'2027-04-16'});
  const original=await docs(p);
  const balance=()=>p.evaluate(()=>{const d=PlanSync._docs();return d['cfg/abyss-economy'].d.earned-Object.entries(d).reduce((sum,[key,v])=>sum+(key.startsWith('buys/')&&v.d.currency==='abyss'?v.d.cost:0),0);});
  const essence=await balance();
  assert((await p.evaluate(()=>__qa.S.buys)).length===0);
  await p.locator('[data-croom="rest"]').click();
  assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-level'),'1');
  assert(await p.locator('.citadel-finish-detail').isHidden());
  await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'progress-rest-abandoned-'+width+'x'+height+'.png')});
  // The shell hides the classic art navigation. Use the same room drawer as a player.
  assert(!(await p.locator('[data-art-view="upgrades"]').isVisible()));
  await shellDrawer(p,'right');
  await p.locator('.citadel-shell-drawer.right button').getByText('Улучшить',{exact:true}).click();
  assert.equal(await p.locator('#citadel-home').getAttribute('data-ui-view'),'upgrades');
  assert(await p.locator('#citadel-upgrade').isVisible(),'upgrade panel must open from the room');
  assert(await p.locator('#citadel-upgrade').isEnabled(),await p.locator('#citadel-building-next').innerText()+' '+await p.locator('#citadel-building-balance').innerText());
  await p.locator('#citadel-upgrade').click();await p.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.level==='2');
  assert.equal(await balance(),essence-5);
  assert(await p.locator('.citadel-finish-detail').isVisible());
  const restoredTrim=await p.locator('.citadel-finish-detail').evaluate(n=>getComputedStyle(n).borderTopWidth);
  const paidOnce=await docs(p);
  await p.evaluate(()=>{__qa.upgrade('rest',1);__qa.upgrade('rest',1);return __qa.idle();});
  assert.deepEqual(await docs(p),paidOnce,'stale repeated purchase must not write or charge');
  await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'progress-rest-restored-'+width+'x'+height+'.png')});
  await p.locator('#citadel-upgrade').click();await p.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.level==='3');
  assert.equal(await balance(),essence-17);
  assert.notEqual(await p.locator('.citadel-finish-detail').evaluate(n=>getComputedStyle(n).borderTopWidth),restoredTrim);
  assert(await p.locator('#citadel-upgrade').isDisabled());
  const completed=await docs(p);
  for(const [key,value] of Object.entries(original))assert.deepEqual(completed[key],value,'shell renovation modified '+key);
  await p.locator('#citadel-interior-stage').screenshot({path:resolve(out,'progress-rest-grand-'+width+'x'+height+'.png')});
  await p.reload();await p.waitForFunction(()=>!!window.__citadelShell&&document.querySelector('[data-croom="rest"]').dataset.roomLevel==='3');
  assert.equal(await p.evaluate(()=>__qa.roomLevel('rest')),3);
  assert.equal(await p.evaluate(()=>__qa.roomLevel('study')),1);
  assert.equal(await balance(),essence-17);
  const reloaded=await docs(p);
  for(const [key,value] of Object.entries(completed))assert.deepEqual(reloaded[key],value,'reload modified '+key);
  await context.close();
  }
 });
 await check('Android RPG panels are compact, scrollable, keyboard safe and keep real changes',async()=>{
  for(const [width,height] of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,mobile:true,shell:true});
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width<700){assert(!(await p.locator('.citadel-shell-menu-toggle').isVisible()));assert(await p.locator('.citadel-shell-dock').isVisible());}
   await shellNav(p,'Задания');
   assert(await p.locator('#qh').evaluate(n=>{const r=n.getBoundingClientRect(),h=document.querySelector('.citadel-system-dialog>header').getBoundingClientRect();return r.top>=h.bottom;}),'quest heading must be below dialog header');
   assert(await p.locator('#qlist .q').first().evaluate(n=>{const r=n.getBoundingClientRect();return r.height>=44&&r.height<140&&parseFloat(getComputedStyle(n.querySelector('.t b')).fontSize)<=16;}));
   assert(await p.locator('.citadel-system-content').evaluate(n=>n.scrollWidth<=n.clientWidth));
   await p.locator('#qlist button.q').first().click();await p.evaluate(()=>__qa.idle());await dismiss(p);
   const saved=await docs(p);
   assert(await p.locator('#qlist button.q').first().getAttribute('aria-pressed')==='true');
   if(width===390)await p.screenshot({path:resolve(out,'android-067-tasks-390.png')});
   await p.locator('.citadel-system-dialog header button').click();
   for(const [label,id] of [['Профиль','wardrobe'],['Финансы','money'],['Воспоминания','shop'],['Тело','diet'],['Путь','goals']]){
    await shellNav(p,label);assert(await p.locator('.citadel-system-dialog #'+id).isVisible());
    assert(await p.locator('.citadel-system-content').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'overflow in '+id+' at '+width);
    if(width===390)await p.screenshot({path:resolve(out,'android-067-'+id+'-390.png')});
    await p.locator('.citadel-system-dialog header button').click();
   }
   await shellNav(p,'Настройки');
   assert(await p.locator('#setup h2').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize)<=14));
   assert(!(await p.locator('.release-notes').getAttribute('open')));
   assert(await p.locator('#setup .sbox').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
   assert(await p.locator('#fx-shake').evaluate(n=>n.getBoundingClientRect().height>=44));
   await p.locator('#fx-shake').selectOption('off');
   if(width===390)await p.screenshot({path:resolve(out,'android-067-settings-390.png')});
   await p.goBack();assert(!(await p.locator('#setup').isVisible()),'Android Back closes settings first');
   await shellNav(p,'Достижения');
   assert(await p.locator('#trophy .sbox').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
   if(width===390)await p.screenshot({path:resolve(out,'android-067-achievements-390.png')});
   await p.goBack();assert(!(await p.locator('#trophy').isVisible()));
   if(width<700){await shellMenu(p);await p.goBack();assert.equal(await p.locator('#citadel-home').getAttribute('data-menu'),'');}
   await p.reload();await p.waitForFunction(()=>!!window.__citadelShell);await dismiss(p);
   const after=await docs(p);for(const [key,value]of Object.entries(saved))assert.deepEqual(after[key],value,'UI reload altered '+key);
   await shellNav(p,'Настройки');assert.equal(await p.locator('#fx-shake').inputValue(),'off');await p.locator('#setup-x').click();
   await context.close();
  }
 });
 await check('all ten shell rooms use opaque ruins and two real paid states without save migration',async()=>{
  const {page:p,context}=await open({width:390,shell:true,seed:advancedSeed(),day:'2027-04-16'});
  const rooms=['throne','observatory','rest','study','archive','forge','gatehouse','refectory','cloister','vault'];
  await p.addLocatorHandler(p.locator('#achup:not([hidden])'),()=>p.locator('#ac-ok').click());
  for(const room of rooms){
   if(!(await p.locator('#citadel-castle').isVisible()))await p.locator('[data-room-view="overview"]').click();
   await p.locator('[data-croom="'+room+'"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
   assert.equal(await p.evaluate(room=>__qa.roomLevel(room),room),1);
   assert.equal(await p.locator('#citadel-room-condition').innerText(),'Заброшенная');
   assert(await p.locator('#citadel-interior-title').evaluate(n=>n.getBoundingClientRect().top>=document.querySelector('.citadel-room-tools').getBoundingClientRect().bottom),'room title must not scroll behind the toolbar');
   const art=await p.locator('#citadel-interior-stage').evaluate(n=>getComputedStyle(n,'::before').backgroundImage);
   assert(art.includes(room+'-interior-1.svg')&&!art.includes('.webp'),'abandoned room cannot reveal luxury backdrop');
   assert(await p.evaluate(src=>new Promise(r=>{const im=new Image();im.onload=()=>r(im.naturalWidth>0);im.onerror=()=>r(false);im.src=src;}),'assets/citadel/'+room+'-interior-1.svg'));
   await p.screenshot({path:resolve(out,'android-067-'+room+'-state0.png')});
   await p.locator('[data-room-view="upgrades"]').click();
   for(const level of [2,3]){await p.locator('#citadel-upgrade').click();await p.evaluate(()=>__qa.idle());await p.waitForFunction(({room,level})=>__qa.roomLevel(room)===level,{room,level});assert.equal(await p.locator('#citadel-room-condition').innerText(),level===2?'Восстановленная':'Роскошная');await p.screenshot({path:resolve(out,'android-067-'+room+'-state'+(level-1)+'.png')});}
  }
  const paid=await docs(p);assert.equal(Object.keys(paid).filter(k=>/^buys\/citadel-/.test(k)).length,20);
  await p.reload();await p.waitForFunction(()=>!!window.__citadelShell&&window.__qa&&__qa.roomLevel('vault')===3);await dismiss(p);
  for(const room of rooms){if(!(await p.locator('#citadel-castle').isVisible()))await p.locator('[data-room-view="overview"]').click();await p.locator('[data-croom="'+room+'"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-level'),'3');}
  await context.close();
 });
 await check('Android 0.68 camera captions, unobstructed scenes and dock survive pan and rotation',async()=>{
  for(const [width,height] of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,mobile:true,shell:true,seed:{}});
   await p.clock.runFor(64);
   const viewport=p.locator('.citadel-viewport');
   assert.equal(await viewport.evaluate(n=>n.scrollLeft),0,'fresh camera starts at the readable left edge');
   async function captions(){await p.clock.runFor(64);await p.waitForFunction(()=>{const v=document.querySelector('.citadel-viewport').getBoundingClientRect();return Array.from(document.querySelectorAll('.citadel-floor-caption,.citadel-skyline,.citadel-room-name')).filter(n=>getComputedStyle(n).visibility!=='hidden').every(n=>{const r=n.getBoundingClientRect();return r.left>=v.left-1&&r.right<=v.right+1;});});}
   await captions();
   assert(await p.locator('.citadel-skyline').evaluate(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.left+3,r.top+r.height/2)?.closest('.citadel-skyline')===n;}),'castle wall must not cover the first letter of the title');
   if(width===390)await p.screenshot({path:resolve(out,'android-068-castle-default-390.png')});
   if(width<700){assert.equal(await p.locator('.citadel-shell-dock [data-section="shop"]').innerText(),'Память');assert(await p.locator('.citadel-shell-dock button').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth&&n.getBoundingClientRect().height>=44)));}
   assert(await p.locator('.citadel-shell-tail').evaluateAll(nodes=>nodes.every(n=>{if(!n.getClientRects().length)return true;const a=n.getBoundingClientRect(),target=document.querySelector('#citadel-home').dataset.uiView==='overview'?document.querySelector('.citadel-viewport'):document.querySelector('#citadel-interior-stage'),b=target.getBoundingClientRect();return a.bottom<=b.top||a.top>=b.bottom||a.right<=b.left||a.left>=b.right;})),'drawer triggers must stay outside the artwork');
   await viewport.evaluate(n=>{n.scrollLeft=155;n.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:1,target:n,clientX:240,clientY:300})]}));n.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[new Touch({identifier:1,target:n,clientX:70,clientY:305})]}));});
   await captions();assert(!(await p.locator('#pg-a').evaluate(n=>n.hidden)),'castle pan must never switch to legacy finance page');assert(await p.locator('#citadel-home').isVisible());
   if(width===390)await p.screenshot({path:resolve(out,'android-068-castle-panned-390.png')});
   await p.locator('.citadel-shell-camera button').filter({hasText:'Общий вид'}).click();await captions();
   assert(await viewport.evaluate(n=>document.querySelector('#citadel-castle').getBoundingClientRect().width<=n.clientWidth+1),'explicit overview fits both room columns');
   if(width===390)await p.screenshot({path:resolve(out,'android-068-castle-overview-390.png')});
   await p.locator('.citadel-shell-camera button').filter({hasText:'+'}).click();await captions();
   await p.locator('[data-croom="rest"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});
   assert(await p.locator('.citadel-shell-tail').evaluateAll(nodes=>nodes.every(n=>{if(!n.getClientRects().length)return true;const a=n.getBoundingClientRect(),target=document.querySelector('#citadel-home').dataset.uiView==='overview'?document.querySelector('.citadel-viewport'):document.querySelector('#citadel-interior-stage'),b=target.getBoundingClientRect();return a.bottom<=b.top||a.top>=b.bottom||a.right<=b.left||a.left>=b.right;})),'drawer triggers must stay outside the artwork');
   assert.equal(await p.locator('#citadel-room-condition').innerText(),'Заброшенная');
   if(width===390)await p.screenshot({path:resolve(out,'android-068-room-390.png')});
   await p.locator('[data-room-view="overview"]').click();await captions();
   await p.setViewportSize({width:height,height:width});await p.clock.runFor(64);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await context.close();
  }
 });
 await check('Android 0.68 empty and populated finances preserve balances, chart and transaction history',async()=>{
  const filled=structuredClone(initial);filled['cfg/opening']={cash:50000,card:100000};
  const tx=[['food',{amt:125.5,kind:'out',acc:'cash',cat:'Продукты',what:'Synthetic food'}],['taxi',{amt:75.25,kind:'out',acc:'card',cat:'Такси',what:'Synthetic taxi'}],['work',{amt:200,kind:'out',acc:'cash',cat:'Работа: такси',what:'Synthetic work',work:true}],['large',{amt:25000,kind:'out',acc:'card',cat:'Покупки',what:'Synthetic large'}],['income',{amt:500,kind:'in',acc:'card',cat:'Работа: другое',what:'Synthetic income'}],['transfer',{amt:100,kind:'xfer',acc:'cash',what:'Synthetic transfer'}]];
  tx.forEach(([id,t],i)=>filled['tx/'+id]={...t,date,ts:100+i,counted:true});
  const baseline=await open({seed:filled,base:true});const originalBalance=await baseline.page.evaluate(()=>__qa.balance());await baseline.context.close();
  for(const [width,height]of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   for(const populated of [false,true]){
    const {page:p,context}=await open({width,height,mobile:true,shell:true,seed:populated?filled:{}});
    await shellNav(p,'Траты');
    assert.equal(await p.locator('#donutwrap').isVisible(),populated);
    if(!populated){assert(await p.locator('.finance-empty').evaluate(n=>n.getBoundingClientRect().height<150));}
    else{assert.match(await p.locator('#dc-sum').innerText(),/201/);assert.deepEqual(await p.evaluate(()=>__qa.balance()),originalBalance);}
    assert(await p.locator('.citadel-system-content').evaluate(n=>n.scrollWidth<=n.clientWidth));
    if(width===390)await p.screenshot({path:resolve(out,'android-068-spend-'+(populated?'filled':'empty')+'-390.png')});
    await p.locator('.citadel-system-dialog header button').click();await shellNav(p,'Финансы');
    assert(await p.locator('#money .accounts').evaluate(n=>n.getBoundingClientRect().height<100));
    assert(await p.locator('.citadel-system-content').evaluate(n=>n.scrollWidth<=n.clientWidth));
    assert(await p.locator('.finance-form').evaluate(n=>Array.from(n.children).filter(c=>!c.hidden).every(c=>c.getBoundingClientRect().height>=44&&c.scrollWidth<=c.clientWidth+1)));
    if(width===390)await p.screenshot({path:resolve(out,'android-068-money-'+(populated?'filled':'empty')+'-390.png')});
    if(populated){
     await p.locator('#amt').fill('37.25');await p.locator('#acc').selectOption('card');await p.locator('#kind').selectOption('out');await p.locator('#cat').selectOption({label:'Продукты'});await p.locator('#what').fill('Synthetic browser purchase');await p.locator('#add').click();await p.waitForFunction(()=>__qa.S.tx.some(t=>t.what==='Synthetic browser purchase'));await p.evaluate(()=>__qa.idle());await dismiss(p);
     const paid=await docs(p),balance=await p.evaluate(()=>__qa.balance());assert.equal(balance.cash,originalBalance.cash);assert.equal(balance.card,originalBalance.card-37.25);
     await p.reload();await p.waitForFunction(()=>!!window.__qa&&!!__qa.S.opening&&document.querySelector('#citadel-live-rank').textContent!=='РАНГ …'&&__qa.S.tx.some(t=>t.what==='Synthetic browser purchase'));await dismiss(p);await shellNav(p,'Финансы');assert.deepEqual(await p.evaluate(()=>__qa.balance()),balance);
     const reloaded=await docs(p);for(const[key,value]of Object.entries(paid))if(key.startsWith('tx/')||key==='cfg/opening')assert.deepEqual(reloaded[key],value);
    }
    await p.goBack();assert(!(await p.locator('.citadel-system-dialog').isVisible()));assert(await p.locator('#citadel-home').isVisible());
    await context.close();
   }
  }
 });
 await check('graphics assets, renovation layers, live mobile RPG views and animation lifecycle',async()=>{
  const images=['sky','throne','observatory','rest','study','archive','forge','gatehouse','refectory','cloister','vault'];
  for(const width of [320,360,390,430,768,1280]){
   const {page:p,context}=await open({width,seed:advancedSeed(),day:'2027-04-16'});await castle(p);
   const loadedArt=await p.evaluate(async names=>Promise.all(names.map(name=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im.naturalWidth>0);im.onerror=()=>resolve(false);im.src='assets/citadel/'+name+'.webp';}))),images);
   assert(loadedArt.every(Boolean),'all original scenes must decode');
   if(width===390){const scenes=['throne','observatory','rest','study','archive','forge','gatehouse','refectory','cloister','vault'].flatMap(room=>[1,2,3].map(tier=>room+'-interior-'+tier+'.svg'));const decoded=await p.evaluate(async names=>Promise.all(names.map(name=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im.naturalWidth>0);im.onerror=()=>resolve(false);im.src='assets/citadel/'+name;}))),scenes);assert(decoded.every(Boolean),'all 30 room-state layers must decode');assert(await p.locator('[data-croom="rest"]').evaluate(n=>getComputedStyle(n,'::before').backgroundImage.includes('stone.svg')),'saved room tier must select its own pixel layer');}
   assert.equal(await p.locator('[data-croom]').count(),10);assert.equal(await p.locator('.citadel-floor').count(),5);
   assert(await p.locator('[data-croom="rest"]').evaluate(n=>getComputedStyle(n,'::before').backgroundImage.includes('stone.svg')));
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
  await p.evaluate(async()=>{const db=window.PlanDB;await db.doc('spont/old').delete();});await p.evaluate(()=>PlanSync.sync(false));assert.equal(rows.find(r=>r[0]==='spont/old')[1],'');await context.close();
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
  await p.locator('#citadel-upgrade').click();await p.evaluate(()=>__qa.idle());assert.deepEqual(await docs(p),original,'failed persistence must not grant a room or charge');assert.match(await p.locator('#toast').innerText(),/Изменение не сохранено/);
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
 await check('0.71 complete backup v2 integrity, legacy migration and repeated restores preserve all records',async()=>{
  const seed=advancedSeed();
  Object.assign(seed,{
   'cfg/outfit':{top:'knit_beige',bottom:'pants_brown',outer:'none'},
   'cfg/citadel':{selectedRoom:'study',decor:{study:'banner'},futureState:{preserved:true}},
   'tx/profile':{amt:125.45,kind:'out',acc:'cash',date,ts:1,cat:'Продукты',what:'Synthetic',counted:true},
   'items/profile':{list:'debts',dir:'owe',amt:321.09,hold:true,ts:1},
   'avito/profile':{name:'Synthetic',amt:456.78,ts:1},'jar/profile':{a:12.34,date,ts:1},
   'goals/profile':{name:'Synthetic',done:true,ts:1},'weeks/profile':{meet:true},
   'wardrobe/profile':{name:'Synthetic stored item',slot:'top',id:'profile',futureField:'keep'}
  });
  for(const room of ['throne','observatory','rest','study','archive','forge','gatehouse','refectory','cloister','vault'])for(const level of [2,3])seed['buys/citadel-'+room+'-'+level]={kind:'citadel-room',currency:'abyss',room,level,item:'citadel-'+room+'-'+level,cost:level===2?5:12,ts:1};
  const {page:p,context}=await open({seed,day:'2027-04-16',legacy:{fxset:JSON.stringify({shake:'off',flash:'weak',sound:'off'})}});
  await write(p,'cfg/body-appearance',{goal:100});await write(p,'cfg/future-compatible',{unknown:{nested:['retained',42]}});
  await p.evaluate(()=>__qa.idle());const before=await docs(p),shape=await p.evaluate(()=>__qa.shape());
  const copy=await p.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));
  assert.equal(copy.v,2);assert.equal(copy.format,'vkach-backup');assert.match(copy.integrity.value,/^[a-f0-9]{64}$/);assert(Number.isFinite(Date.parse(copy.createdAt)));
  assert.deepEqual(copy.docs,before);assert.deepEqual(copy.docs['cfg/effects'].d,{shake:'off',flash:'weak',sound:'off'});
  for(const backup of [copy,{v:1,docs:copy.docs},copy]){
   await write(p,'weights/test',{kg:160,date,ts:1});await write(p,'tx/after-copy',{amt:123.45,kind:'out',acc:'cash',date});
   await p.evaluate(copy=>PlanSync.importObj(copy,true),backup);await p.waitForTimeout(50);
   const after=await docs(p);for(const [key,value]of Object.entries(before))assert.deepEqual(after[key].d,value.d);
   assert.equal(after['tx/after-copy'].d,null);assert.equal(await p.evaluate(()=>__qa.shape()),shape);
  }
  await p.reload();await castle(p);assert.equal(await p.evaluate(()=>__qa.shape()),shape);
  assert.deepEqual((await docs(p))['cfg/effects'].d,before['cfg/effects'].d);
  await p.locator('#gear').click();assert.equal(await p.locator('#fx-sound').inputValue(),'off');
  await context.close();
 });
 await check('0.71 damaged, incomplete and future backup schemas never touch live data',async()=>{
  const {page:p,context}=await open();const before=await docs(p),valid=await p.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));
  const corrupt=structuredClone(valid);corrupt.docs['weights/test'].d.kg=160;
  for(const bad of [corrupt,{...valid,v:999},{v:2,docs:before},{v:1},{v:1,docs:[]},{v:1,docs:{'weights/x':{d:[],u:1}}}]){
   assert(await p.evaluate(async o=>{try{await PlanSync.importObj(o,true);return false;}catch{return true;}},bad));assert.deepEqual(await docs(p),before);
  }
  // File validation happens before confirmation. A valid file can be cancelled.
  await p.locator('.pl-chip').click();const button=p.getByRole('button',{name:'ВОССТАНОВИТЬ КОПИЮ ИЗ ФАЙЛА',exact:true});
  let dialogs=0;p.on('dialog',async d=>{dialogs++;await d.dismiss();});
  async function upload(o){const chooserEvent=p.waitForEvent('filechooser');await button.click();const chooser=await chooserEvent;await chooser.setFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(o))});await p.waitForTimeout(80);}
  await upload(corrupt);assert.equal(dialogs,0);assert.match(await p.locator('.pl-menu').innerText(),/целостности/);
  const dupeEvent=p.waitForEvent('filechooser');await button.click();const dupeChooser=await dupeEvent;await dupeChooser.setFiles({name:'duplicate.json',mimeType:'application/json',buffer:Buffer.from('{"v":1,"docs":{"weights/test":{"d":{"kg":100},"u":1},"weights/test":{"d":{"kg":160},"u":2}}}')});await p.waitForTimeout(80);assert.equal(dialogs,0);assert.deepEqual(await docs(p),before);
  await upload(valid);assert.equal(dialogs,1);assert.deepEqual(await docs(p),before);
  await context.close();
 });
 await check('0.71 failed save is visible, export does not claim success and idempotent retry retains profile',async()=>{
  const {page:p,context}=await open();const before=await docs(p);
  const result=await p.evaluate(async()=>{
   const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,k,v);};
   try{const db=window.PlanDB;try{await db.doc('weights/retry').set({kg:115,date:'2026-10-30',ts:2});return false;}catch(e){return e.code==='quota_exceeded';}}finally{Storage.prototype.setItem=original;}
  });assert(result);assert.deepEqual(await docs(p),before);
  await p.locator('.pl-chip').click();assert.match(await p.locator('.pl-menu').innerText(),/не сохранено/);
  await write(p,'weights/retry',{kg:115,date,ts:2});await write(p,'weights/retry',{kg:115,date,ts:2});
  assert.equal(Object.keys(await docs(p)).filter(k=>k==='weights/retry').length,1);
  // The normal queued gameplay action reports its rejection to export/update.
  assert(await p.evaluate(async()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,k,v);};try{document.querySelector('#qlist button').click();await __qa.idle();try{await PlanSync.exportBackup();return false;}catch{return true;}}finally{Storage.prototype.setItem=original;}}));
  assert.match(await p.locator('#toast').innerText(),/не сохранено/);await context.close();
 });
 await check('0.71 failed restore preserves durable snapshot and recovery copy, retry completes atomically',async()=>{
  const {page:p,context}=await open();const before=await docs(p),incoming={'weights/new':{d:{kg:100,date,ts:1},u:10}};
  for(const failedKey of ['plan.recovery.v1','plan.meta.v1','plan.store.v1']){
   assert(await p.evaluate(async({incoming,failedKey})=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===failedKey)throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,k,v);};try{try{await PlanSync.importObj({v:1,docs:incoming},true);return false;}catch{return true;}}finally{Storage.prototype.setItem=original;}},{incoming,failedKey}));
   assert.deepEqual(await docs(p),before);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.store.v1')).docs),before);
  }
  await p.evaluate(incoming=>PlanSync.importObj({v:1,docs:incoming},true),incoming);assert.deepEqual((await docs(p))['weights/new'].d,incoming['weights/new'].d);
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.recovery.v1')).docs),before);await context.close();
 });
 await check('0.71 damaged startup keeps valid siblings read-only and original bytes recoverable',async()=>{
  const {page:p,context}=await open();const before=await docs(p),copy=await p.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));
  const damaged={v:1,docs:{...before,'weights/bad':{d:'broken',u:1}}},raw=JSON.stringify(damaged);
  await p.evaluate(raw=>localStorage.setItem('plan.store.v1',raw),raw);await p.reload();await castle(p);
  assert.equal(await p.evaluate(()=>localStorage.getItem('plan.store.v1')),raw);
  assert.deepEqual((await docs(p))['weights/test'],before['weights/test']);assert.equal((await docs(p))['weights/bad'],undefined);
  await p.locator('.pl-chip').click();assert.match(await p.locator('.pl-menu').innerText(),/повреждение/);
  assert(await p.evaluate(async()=>{try{const db=window.PlanDB;await db.doc('weights/blocked').set({kg:100});return false;}catch{return true;}}));
  await p.evaluate(copy=>PlanSync.importObj(copy,true),copy);await p.waitForTimeout(40);
  for(const [key,value]of Object.entries(before))assert.deepEqual((await docs(p))[key].d,value.d);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.recovery.v1')).originalDamagedStore),raw);await context.close();
 });
 await check('0.71 malformed and duplicate Sheets rows block uploads without changing local records',async()=>{
  for(const rows of [[['path','json','u'],['weights/remote','{"kg":100}',2],['weights/remote','{"kg":160}',3]],[['path','json','u'],['weights/remote','{"kg":',2]]]){
   const {page:p,context}=await open();const before=await docs(p);let puts=0;
   await context.route('**/*googleapis.com/**',async route=>{const req=route.request(),u=req.url();if(u.includes('fonts.googleapis.com'))return route.fulfill({contentType:'text/css',body:''});let data={};if(u.includes('drive/v3/files?'))data={files:[{id:'QA_SHEET'}]};else if(u.includes('/about?'))data={user:{emailAddress:'qa@example.invalid'}};else if(u.includes('values/data!A:C'))data={values:rows};else if(req.method()==='PUT')puts++;await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});});
   await p.evaluate(()=>{window.google={accounts:{oauth2:{initTokenClient:opt=>({requestAccessToken:()=>opt.callback({access_token:'synthetic',expires_in:3600})})}}};});
   await p.evaluate(()=>PlanSync.sync(true));assert.equal(puts,0);assert.deepEqual(await docs(p),before);await context.close();
  }
 });
 await check('0.71 rolling checkpoint preserves the previous snapshot and fails closed when full',async()=>{
  const {page:p,context}=await open();const before=await docs(p);
  await write(p,'weights/checkpoint',{kg:100,date,ts:2});
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.checkpoint.v1')).docs),before);
  const durable=await docs(p);
  assert(await p.evaluate(async()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.checkpoint.v1')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,k,v);};try{try{const db=window.PlanDB;await db.doc('weights/checkpoint').set({kg:110});return false;}catch{return true;}}finally{Storage.prototype.setItem=original;}}));
  assert.deepEqual(await docs(p),durable);await context.close();
 });
 await check('0.71 commission payout is atomic and repeated activation cannot duplicate cash',async()=>{
  const seed={...structuredClone(initial),'items/comm':{list:'comm',amt:100.25,ts:1},'items/subs':{list:'subs',amt:200.5,ts:2}};
  const {page:p,context}=await open({seed});const before=await docs(p);
  await p.evaluate(async()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='plan.store.v1')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,k,v);};try{document.querySelector('#payout').click();document.querySelector('#payout').click();await __qa.idle();}finally{Storage.prototype.setItem=original;}});
  assert.deepEqual(await docs(p),before);
  await p.evaluate(async()=>{const b=document.querySelector('#payout');b.click();b.click();b.click();b.click();await __qa.idle();});await p.waitForTimeout(40);
  const after=await docs(p),payments=Object.entries(after).filter(([k])=>k.startsWith('tx/payout-'));
  assert.equal(payments.length,1);assert.equal(payments[0][1].d.amt,300.75);assert.equal(after['items/comm'].d,null);assert.equal(after['items/subs'].d,null);
  await context.close();
 });
 await check('0.71 Android data controls fit narrow screens, export private records only and Back closes panel',async()=>{
  for(const [width,height]of [[320,760],[360,800],[390,844],[430,900],[844,390]]){
   const {page:p,context}=await open({width,height,mobile:true,shell:true});await shellNav(p,'Настройки');
   await p.locator('#data-management').click();const menu=p.locator('.pl-menu');assert(await menu.isVisible());
   assert(await menu.evaluate(n=>n.scrollWidth<=n.clientWidth&&n.getBoundingClientRect().right<=innerWidth));
   assert(await menu.locator('button').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44)));
   const before=await docs(p);await p.evaluate(()=>{localStorage.setItem('plan.tok',JSON.stringify({t:'NEVER_EXPORT_SECRET',exp:Date.now()+3600000}));});
   const event=p.waitForEvent('download');await menu.getByRole('button',{name:'СОХРАНИТЬ РЕЗЕРВНУЮ КОПИЮ',exact:true}).click();const file=await event;
   const raw=await readFile(await file.path(),'utf8'),backup=JSON.parse(raw);assert(!raw.includes('NEVER_EXPORT_SECRET'));assert.deepEqual(backup.docs,before);assert.equal(backup.v,2);
   if(width===390)await p.screenshot({path:resolve(out,'android-071-data-390.png')});
   await p.goBack();await menu.waitFor({state:'hidden'});assert.deepEqual(await docs(p),before);await context.close();
  }
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
  const rejected=await p.evaluate(async()=>{try{const db=window.PlanDB;await db.doc('cfg/blocked').set({value:true});return false;}catch{return true;}});assert(rejected);assert.deepEqual(await docs(p),before);
  await p.locator('.pl-chip').click();assert.match(await p.locator('.pl-menu').innerText(),/только для чтения/);
  const downloaded=p.waitForEvent('download');await p.locator('.pl-menu').getByRole('button',{name:'СОХРАНИТЬ РЕЗЕРВНУЮ КОПИЮ',exact:true}).click();const file=await downloaded;assert.deepEqual(JSON.parse(await readFile(await file.path(),'utf8')).docs,before);
  await p.reload();await castle(p);await write(p,'cfg/recovered',{value:true});assert((await docs(p))['cfg/recovered']);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.pre-update.v1')).docs),before);await context.close();
 });
 await check('rank advancement is observed from actual shared progress without NPC save writes',async()=>{
  const complete=advancedSeed(),seed=structuredClone(complete),restore={};
  for(let d=1;d<=30;d++){const k='2027-03-'+String(d).padStart(2,'0');for(const col of ['days','per']){restore[col+'/'+k]=seed[col+'/'+k];delete seed[col+'/'+k];}}
  const {page:p,context}=await open({seed,day:'2027-04-16'});await castle(p);const before=await p.evaluate(()=>__qa.points().L);assert(before>=5);
  await p.locator('#citadel-residents button').filter({hasText:'Страж'}).click();
  await p.evaluate(async restore=>{const db=window.PlanDB;await db.runTransaction(tx=>{for(const [path,value]of Object.entries(restore))tx.set(path,value);});},restore);
  await p.waitForTimeout(100);await dismiss(p);assert(await p.evaluate(()=>__qa.points().L)>before);
  assert.match(await p.locator('#citadel-npc-dialogue').innerText(),/Новый ранг/);const saved=await docs(p);await p.evaluate(()=>__qa.render());assert.deepEqual(await docs(p),saved);await context.close();
 });
 function expectedEconomyUpgrade(before,after){
  const expected=structuredClone(before),old=expected['cfg/abyss-economy'],baseline=expected['cfg/abyss-economy-backup'];
  if(old&&old.d.version===1&&!old.d.rankSeeded&&baseline&&Number.isFinite(Number(baseline.d.rank))){
   old.d.earned=Number(old.d.earned||0)+5*Math.max(0,Number(baseline.d.rank)-1);old.d.rankSeeded=true;
   assert(after['cfg/abyss-economy'].u>=old.u,'migration clock cannot go backwards');old.u=after['cfg/abyss-economy'].u;
  }
  return expected;
 }
 await check('0.73 through 0.90 to current PWA upgrade preserves saves and offline room secrecy',async()=>{
  for(const [oldVersion,previous] of [['0.73','2b40210b50924748a6d0d7a1d18cc91f31828205'],['0.74','f167bf4498f73393ad103c7abb42fd3cffc6862e'],['0.75','88cd086ad5bf5b7f70e5dacae7ed198de1fa8504'],['0.76','bdd690216a1899e612a03144e39dfb212862f8d7'],['0.77','ee0f42865972388be5731f54cf927d9470cc658d'],['0.78','1eeac78c66601f11fb966a616ebfe2b6c968f538'],['0.79','d35fb9295b0bc2237ae51d38af62843eac54e3fe'],['0.90','fd0c953138015a790709c396c0b40b1f2cdb0778']]){
  for(const name of ['index.html','localdb.js','sw.js','rpg-ui.css','citadel-art.css',...(['0.79','0.90'].includes(oldVersion)?['legends.js','fate.js','citadel-world.js','config.js']:[])])servedOverrides.set(resolve(root,name),execFileSync('git',['show',previous+':docs/'+name]));
  const expectedBuild=/window.APP_BUILD="([^"]+)"/.exec(game)[1];
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow',serviceWorkers:'allow',reducedMotion:'reduce'});
  context.setDefaultTimeout(15000);const seed={...structuredClone(initial),'cfg/citadel':{selectedRoom:'rest',decor:{}},'cfg/future-synthetic':{nested:{keep:42}}};if(['0.79','0.90'].includes(oldVersion)){seed['cfg/legends']={version:1,active:'',unlocked:{echo01:{version:1,at:1,presented:true}}};seed['cfg/fate']={version:1,active:'',entries:{f01:{pieces:{0:{version:1,at:1,presented:true}}}}};}
  await context.addInitScript(seed=>{if(!localStorage.getItem('qa-init')){localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs:Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]))}));localStorage.setItem('qa-init','1');}localStorage.setItem('wsum','2026-10-26');localStorage.setItem('msum','2026-10');localStorage.setItem('trialSeen','2026-10-30');},seed);
  await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.clock.install({time:new Date('2026-10-30T14:00:00+03:00')});
  await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller&&PlanSync._docs()['cfg/abyss-economy']?.d?.rank>=1);await dismiss(p);
  assert.equal(await p.evaluate(()=>APP_VERSION),oldVersion);assert.notEqual(await p.evaluate(()=>APP_BUILD),expectedBuild);await p.evaluate(()=>PlanSync.beforeUpdate());const before=await docs(p);
  servedOverrides.clear();await p.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});await p.waitForFunction(()=>document.querySelector('.pl-chip').textContent==='ОБНОВИТЬ');
  await shellMenu(p);await p.locator('.pl-chip').click();await p.locator('.pl-menu').getByRole('button',{name:'ОБНОВИТЬ ПРИЛОЖЕНИЕ',exact:true}).click();
  await p.waitForFunction(build=>APP_BUILD===build&&document.querySelector('#citadel-live-rank').textContent!=='РАНГ …',expectedBuild);await dismiss(p);assert.equal(await p.evaluate(()=>APP_VERSION),currentVersion);
  const migrated=await docs(p);assert.deepEqual(migrated,expectedEconomyUpgrade(before,migrated),'only the existing rank-seeding migration may change economy metadata');assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.pre-update.v1')).docs),before);
  await context.setOffline(true);await p.reload();await p.waitForFunction(build=>APP_BUILD===build&&document.querySelector('#citadel-live-rank').textContent!=='РАНГ …',expectedBuild);assert.deepEqual(await docs(p),migrated);assert.equal(await p.locator('[data-croom="archive"]').getAttribute('data-revealed'),'false');assert.equal(await p.locator('[data-croom="archive"] .citadel-room-name').textContent(),'Неизведанная комната');assert.equal(await p.locator('[data-croom="rest"]').getAttribute('data-revealed'),'true');await context.close();
  }
 });
 await check('0.68 to 0.69 PWA update replaces cached UI while preserving synthetic saves',async()=>{
  for(const name of ['index.html','localdb.js','sw.js','rpg-ui.css'])servedOverrides.set(resolve(root,name),execFileSync('git',['show','fbe6f935569a798b5b9ed3109b7a260668e8b96a:docs/'+name]));
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow',serviceWorkers:'allow',reducedMotion:'reduce'});context.setDefaultTimeout(20000);
  const seed=advancedSeed();seed['buys/citadel-study-2']={kind:'citadel-room',currency:'abyss',room:'study',level:2,item:'citadel-study-2',name:'Synthetic renovation',cost:5,ts:1};
  await context.addInitScript(seed=>{if(!localStorage.getItem('qa-init')){localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs:Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]))}));localStorage.setItem('qa-init','1');}localStorage.setItem('wsum','2027-04-12');localStorage.setItem('msum','2027-04');localStorage.setItem('trialSeen','2027-04-16');},seed);
  await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.clock.install({time:new Date('2027-04-16T14:00:00+03:00')});
  await p.addLocatorHandler(p.locator('#achup:not([hidden]),#lvup:not([hidden])').first(),()=>dismiss(p));
  await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller&&document.querySelector('[data-croom="study"]').dataset.roomLevel==='2');await dismiss(p);assert.equal(await p.evaluate(()=>APP_VERSION),'0.68');
  await p.waitForFunction(()=>PlanSync._docs()['cfg/abyss-economy'].d.rank>=24);await p.evaluate(()=>PlanSync.beforeUpdate());
  const before=await docs(p);servedOverrides.clear();await p.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});await p.waitForFunction(()=>document.querySelector('.pl-chip').textContent==='ОБНОВИТЬ');
  await shellMenu(p);await p.locator('.pl-chip').click();await p.locator('.pl-menu').getByRole('button',{name:'ОБНОВИТЬ ПРИЛОЖЕНИЕ',exact:true}).click();await p.waitForFunction(v=>APP_VERSION===v,currentVersion);await p.waitForFunction(()=>!!navigator.serviceWorker.controller&&document.querySelector('[data-croom="study"]').dataset.roomLevel==='2');await dismiss(p);
  assert.equal(await p.locator('.citadel-shell-dock [data-section="shop"]').innerText(),'Память');assert.equal(await p.locator('.citadel-shell-tail.left').evaluate(n=>n.closest('.citadel-shell-nav')?.id),'citadel-shell-nav');
  assert(await p.evaluate(async()=>{const response=await caches.match(new URL('rpg-ui.css',location.href));return response&&(await response.text()).includes('0.69 — persistent finance tabs');}),'new stylesheet must replace cached 0.68 CSS');
  const after=await docs(p),expected=expectedEconomyUpgrade(before,after);for(const[key,value]of Object.entries(expected))assert.deepEqual(after[key],value,'update changed '+key);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('plan.pre-update.v1')).docs),before);
  await p.clock.runFor(1000);await context.setOffline(true);await p.reload();await p.waitForFunction(v=>APP_VERSION===v&&document.querySelector('[data-croom="study"]').dataset.roomLevel==='2',currentVersion);await dismiss(p);await shellNav(p,'Траты');await p.locator('[data-finance="wheel"]').click();assert(!(await p.locator('#donutwrap').isVisible()));assert(await p.locator('.finance-empty').isVisible());assert.equal(await p.locator('[data-finance="wheel"]').getAttribute('aria-selected'),'true');await context.close();
 });
 await check('production PWA upgrades previous release and keeps a pre-update recovery copy',async()=>{
  for(const name of ['index.html','localdb.js','sw.js'])servedOverrides.set(resolve(root,name),execFileSync('git',['show','893e9be:docs/'+name]));
  const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow',serviceWorkers:'allow',reducedMotion:'reduce'});context.setDefaultTimeout(20000);
  await context.addInitScript(seed=>{localStorage.setItem('plan.shell.classic.v1','1');if(!localStorage.getItem('qa-init')){localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs:Object.fromEntries(Object.entries(seed).map(([k,d])=>[k,{d,u:1}]))}));localStorage.setItem('qa-init','1');}localStorage.setItem('wsum','2027-04-12');localStorage.setItem('msum','2027-04');localStorage.setItem('trialSeen','2027-04-16');},advancedSeed());
  await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.clock.install({time:new Date('2027-04-16T14:00:00+03:00')});
  await p.addLocatorHandler(p.locator('#achup:not([hidden]),#lvup:not([hidden]),#setup:not([hidden]),#trophy:not([hidden]),#legend-scene[open]').first(),()=>dismiss(p));
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
  await p.addLocatorHandler(p.locator('#achup:not([hidden]),#lvup:not([hidden]),#setup:not([hidden]),#trophy:not([hidden]),#legend-scene[open]').first(),()=>dismiss(p));
  await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await castle(p);
  await context.setOffline(true);await p.reload();await castle(p);assert(await p.evaluate(()=>!!window.CitadelWorld));const artCache=await p.evaluate(async()=>Promise.all(['citadel-space.js',...['throne','observatory','rest','study','archive','forge','gatehouse','refectory','cloister','vault'].flatMap(room=>[1,2,3].map(level=>'assets/citadel/'+room+'-interior-'+level+'.svg')),'rpg-ui.css','assets/citadel/rest-ruins.svg','citadel-art.css','assets/citadel/rest.webp','assets/citadel/sky.webp','assets/citadel/roof.svg','assets/citadel/abandoned.svg','assets/citadel/guardian.svg','assets/citadel/rest-upgrade3.svg'].map(path=>caches.match(new URL(path,location.href)).then(Boolean))));assert(artCache.every(Boolean),'offline shell must include textures, roof, room states, sprites and renovation art');await p.locator('[data-croom="gatehouse"]').click();await p.locator('#citadel-enter').click();await p.locator('#citadel-exits [data-travel="archive"]').click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-room'),'archive');await p.locator('[data-croom="study"]').click();await p.locator('#citadel-enter').click();const before=await p.locator('#upg').innerText();
  await p.locator('#citadel-upgrade').click();await p.waitForFunction(()=>!!PlanSync._docs()['buys/citadel-study-2']);await p.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.level==='2');
  assert.equal(Number(await p.locator('#upg').innerText()),Number(before));await p.reload();await castle(p);await p.locator('#citadel-enter').click();assert.equal(await p.locator('#citadel-interior-stage').getAttribute('data-level'),'2');
  assert.equal(Object.keys(await docs(p)).filter(k=>k==='buys/citadel-study-2').length,1);assert.equal(Number(await p.locator('#upg').innerText()),Number(before));await context.close();
 });
 await check('production PWA offline reload and offline writes persist',async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/css'}));const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await p.reload();await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.evaluate(async()=>{const db=window.PlanDB;await db.doc('cfg/citadel').set({selectedRoom:'study',decor:{study:'banner'}});});await p.reload();await p.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');await p.waitForFunction(()=>!!window.__citadelShell&&!!document.querySelector('[data-croom="study"][aria-pressed="true"]'));await p.locator('[data-croom="study"]').click();await p.locator('#citadel-interior').waitFor({state:'visible'});assert.equal(await p.locator('#citadel-interior-decoration').getAttribute('data-decor'),'banner');await context.close();
 });
 assert.deepEqual(errors,[],'browser runtime errors');console.log(`PASS ${passed} scenario groups; no runtime errors`);
} catch(error) {console.error('Runtime errors',errors);console.error('FAIL',currentCheck,error.name,String(error.message).slice(0,2800),String(error.stack).split('\n').find(line=>/citadel\.mjs:\d/.test(line))||'');process.exitCode=1;} finally {await browser.close();await new Promise(r=>server.close(r));}
