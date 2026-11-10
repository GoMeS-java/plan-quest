import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';
import '../src/citadel-weather.js';

const weather=globalThis.CitadelWeather, minute=60_000;
const originTime=Date.parse('2026-12-20T14:58:00Z');
const frequency=new Map();
let seed=230557;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let i=0;i<6000;i++){
  const event=weather.draw(originTime+i*minute,random);
  frequency.set(event.type,(frequency.get(event.type)||0)+1);
  assert(weather.active(event,event.startedAt));
  assert(!weather.active(event,event.endsAt));
}
assert.equal(frequency.size,10);
assert([...frequency].every(([type,count])=>type==='spellstorm'||count>frequency.get('spellstorm')));
for(let i=0;i<180;i++){
  const now=originTime+i*minute, a=weather.scheduled(now);
  assert(weather.active(a,now));
  assert.deepEqual(a,weather.scheduled(now));
  assert.equal(weather.scheduled(a.endsAt-1).id,a.id);
  assert.notEqual(weather.scheduled(a.endsAt).id,a.id);
}

const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webp':'image/webp'};
const root=resolve('android-test');
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep))throw Error('Invalid path');
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const shots=resolve(process.env.WEATHER_SHOTS||'test-results/weather');
await mkdir(shots,{recursive:true});
const url='http://127.0.0.1:'+server.address().port;
const key='plan.android-test.world-weather.v1';
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow'});
  const weatherNetwork=[];
  await context.route('https://**/*',route=>{
    if(/open-meteo|weatherapi|openweathermap/i.test(route.request().url()))weatherNetwork.push(route.request().url());
    return route.fulfill({body:'',contentType:'text/css'});
  });
  await context.addInitScript(({key,originTime})=>{
    const prefix='plan.android-test.';
    window.weatherWrites=0;
    const put=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){
      if(name===key)window.weatherWrites++;
      return put.call(this,name,value);
    };
    localStorage.setItem(prefix+'awakening.v1',JSON.stringify({version:1,step:12,status:'done'}));
    localStorage.setItem(prefix+'rebuild-guide.v1',JSON.stringify({version:1,step:2,status:'done'}));
    localStorage.setItem('wsum','2026-12-14');
    localStorage.setItem('msum','2026-12');
    localStorage.setItem('trialSeen','2026-12-20');
    if(localStorage.getItem('weather-synthetic'))return;
    localStorage.setItem('weather-synthetic','1');
    const docs={
      'cfg/rare':{d:{z02:'2026-11-10'},u:originTime},
      'cfg/look':{d:{bg:'b_forest'},u:originTime},
      'cfg/citadel':{d:{selectedRoom:'rest',decor:{}},u:originTime},
      'cfg/future-synthetic':{d:{marker:'keep'},u:originTime}
    };
    for(let i=0;i<26;i++){
      const day=new Date(Date.UTC(2026,10,2+i)).toISOString().slice(0,10);
      docs['days/'+day]={d:{steps:50000},u:originTime};
    }
    localStorage.setItem(prefix+'store.v1',JSON.stringify({v:1,docs}));
  },{key,originTime});
  const page=await context.newPage(), other=await context.newPage(), errors=[];
  for(const tab of [page,other]){
    tab.on('pageerror',error=>errors.push(error.message));
    await tab.clock.setFixedTime(new Date(originTime));
  }
  const identity=tab=>tab.evaluate(()=>document.documentElement.dataset.worldWeatherId);
  const ready=tab=>tab.waitForFunction(()=>!!document.documentElement.dataset.worldWeatherId);
  const getStored=tab=>tab.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  const writes=async()=>await page.evaluate(()=>window.weatherWrites)+await other.evaluate(()=>window.weatherWrites);
  await Promise.all([page.goto(url),other.goto(url)]);
  await Promise.all([ready(page),ready(other)]);
  assert.equal(await identity(page),await identity(other));
  assert.equal(await writes(),1,'startup shares one atomic draw across tabs');
  assert(await page.evaluate(()=>typeof navigator.locks.request==='function'));
  const first=await getStored(page);
  const boundary=first.endsAt+minute;
  for(const tab of [page,other])await tab.clock.setFixedTime(new Date(boundary));
  await Promise.all([page,other].map(tab=>tab.evaluate(()=>window.dispatchEvent(new Event('pageshow')))));
  await Promise.all([page,other].map(tab=>tab.waitForFunction(id=>document.documentElement.dataset.worldWeatherId!==id,first.id)));
  const second=await getStored(page);
  assert.equal(await identity(page),await identity(other));
  assert.notEqual(second.id,first.id);
  assert.notEqual(second.type,first.type);
  assert.equal(await writes(),2,'expiration produces a single new event');
  for(const tab of [page,other])await tab.clock.setFixedTime(new Date(originTime));

  const screenshot=(name,fullMotion=false)=>page.screenshot({path:resolve(shots,name+'.png'),animations:fullMotion?'allow':'disabled'});
  async function dismiss(){
    await page.evaluate(()=>{
      document.querySelector('#legend-scene[open]')?.close();
      for(let i=0;i<20&&!document.querySelector('#achup').hidden;i++)document.querySelector('#ac-ok').click();
      if(!document.querySelector('#lvup').hidden)document.querySelector('#lv-ok').click();
    });
  }
  const rootElement=page.locator('html');
  const castle=page.locator('.citadel-world-weather');
  const tree=page.locator('.destiny-weather');
  const dialog=page.locator('#destiny-world');
  const viewport=page.locator('.citadel-viewport');
  const state=type=>page.waitForFunction(type=>document.documentElement.dataset.worldWeather===type,type);
  const texture=host=>host.locator('.is-current .world-weather-particles').evaluate(el=>getComputedStyle(el).backgroundImage);
  let shotNumber=0;
  async function fixture(type,intensity){
    const id='demo-weather-'+(++shotNumber);
    await other.evaluate(({key,id,type,intensity,originTime})=>{
      localStorage.setItem(key,JSON.stringify({version:1,id,type,intensity,startedAt:originTime-1000,endsAt:originTime-1000+30*60_000}));
    },{key,id,type,intensity,originTime});
    await page.waitForFunction(id=>document.documentElement.dataset.worldWeatherId===id,id);
    return id;
  }
  await page.waitForFunction(()=>document.documentElement.dataset.citadelBg==='forest'&&PlanSync._docs()['cfg/realm-achievements']?.d.mysterySince);
  await dismiss();
  const backup=await page.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));
  assert(!JSON.stringify(backup).includes('world-weather'));
  const slotCount=await page.locator('.world-weather-slot').count();

  await fixture('flurries',2);
  assert((await texture(castle)).includes('weather-snow.svg'),'snow is available on the forest background');
  const rain=await fixture('downpour',3);
  await viewport.evaluate(el=>{el.scrollTop=0;});
  assert((await texture(castle)).includes('weather-rain.svg'));
  assert.equal(await castle.locator('.is-current').getAttribute('data-intensity'),'3');
  assert.equal(await tree.locator('.is-current').getAttribute('data-kind'),'downpour');
  await screenshot('01-forest-rain');

  await page.evaluate(()=>document.querySelector('#gear').click());
  const appearances=page.locator('[data-look-category="bg"]');
  await appearances.evaluate(node=>{node.closest('details').open=true;});
  await appearances.locator('[data-look-id="b_winter"]').click();
  await page.waitForFunction(()=>document.documentElement.dataset.citadelBg==='winter');
  assert.equal(await identity(page),rain,'changing an earned background does not reroll the weather');
  if(await page.locator('#setup-x').isVisible())await page.locator('#setup-x').click();
  await page.locator('#setup').waitFor({state:'hidden'});
  await dismiss();

  await fixture('blizzard',3);
  assert((await texture(castle)).includes('weather-snow.svg'));
  assert.equal(await castle.locator('.world-weather-slot').count(),2);
  assert.equal(await castle.locator('.world-weather-slot:not(.is-current)').getAttribute('data-kind'),'downpour','the outgoing texture remains during crossfade');
  await screenshot('02-winter-citadel');
  await viewport.evaluate(el=>{el.scrollTop=0;});
  await page.locator('[data-croom="rest"]').click();
  const interior=page.locator('#citadel-interior:not([hidden])');
  await interior.waitFor();
  const glass=interior.locator('.citadel-window-weather');
  assert((await glass.evaluate(n=>getComputedStyle(n).maskImage)).includes('rest-windows-1.svg'));
  assert((await texture(glass)).includes('weather-snow.svg'));
  assert.equal(await interior.locator('.citadel-window-frost').evaluate(el=>getComputedStyle(el).display),'block');
  await screenshot('03-winter-blizzard-window');
  const exitRoom=page.locator('#citadel-interior-close');
  if(await exitRoom.isVisible())await exitRoom.click();
  else await page.locator('[data-room-view="overview"]').click();
  await interior.waitFor({state:'hidden'});

  async function openTree(){
    await page.waitForFunction(()=>/^РАНГ \d+/.test(document.querySelector('#citadel-live-rank')?.textContent));
    await page.getByRole('button',{name:'Все разделы игры'}).click();
    const nav=page.locator('#citadel-shell-nav');
    const all=nav.locator('.citadel-all-functions');
    const group=all.locator('.citadel-menu-group').filter({hasText:'ПУТЬ И ПРОГРЕСС'});
    if(await all.getAttribute('open')===null)await all.locator(':scope > summary').click();
    if(await group.getAttribute('open')===null)await group.locator(':scope > summary').click();
    await group.getByRole('button',{name:'Древо Судьбы',exact:true}).click();
    await dialog.waitFor();
  }
  async function closeTree(){
    await dialog.getByRole('button',{name:/В Цитадель/}).click();
    await dialog.waitFor({state:'hidden'});
  }
  const storm=await fixture('spellstorm',3);
  await openTree();
  assert.equal(await identity(page),storm);
  assert.equal(await tree.locator('.is-current').getAttribute('data-kind'),'spellstorm');
  assert((await texture(tree)).includes('weather-snow.svg'),'winter turns the storm particles into snow');
  assert.match(await dialog.locator('.destiny-weather-label').textContent(),/Магическая буря · день/);
  assert.equal(await rootElement.getAttribute('data-world-phase'),'day');
  await screenshot('04-winter-spellstorm-tree');
  await page.clock.setFixedTime(new Date(originTime+3*minute));
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
  await page.waitForFunction(()=>document.querySelector('.destiny-weather-label').textContent.includes('вечер'));
  assert.equal(await identity(page),storm,'crossing dusk keeps the same event');
  await fixture('fog',3);
  await state('fog');
  assert.equal(await tree.locator('.is-current').evaluate(el=>getComputedStyle(el,'::before').animationName),'world-weather-mist');
  await screenshot('05-fog-tree');
  const thunder=await fixture('thunder',3);
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.destiny-weather .is-current')).opacity)>.99);
  await tree.locator('.is-current').evaluate(el=>{
    const bolt=el.getAnimations({subtree:true}).find(a=>a.animationName==='world-weather-bolt');
    if(bolt){bolt.pause();bolt.currentTime=10_170+bolt.effect.getTiming().delay;}
  });
  assert(Number(await tree.locator('.is-current').evaluate(el=>getComputedStyle(el,'::after').opacity))>.4);
  await screenshot('06-thunder-tree',true);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await tree.locator('.is-current .world-weather-particles').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await tree.locator('.is-current').evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
  await closeTree();
  const cpu=await context.newCDPSession(page);
  await cpu.send('Emulation.setCPUThrottlingRate',{rate:4});
  for(let i=0;i<2;i++){await openTree();await closeTree();}
  await cpu.send('Emulation.setCPUThrottlingRate',{rate:1});
  assert.equal(await page.locator('.world-weather-slot').count(),slotCount,'repeated transitions never append another effect layer');
  assert.equal(await identity(page),thunder);
  await page.evaluate(copy=>PlanSync.importObj(copy,true),backup);
  await page.waitForFunction(()=>document.documentElement.dataset.citadelBg==='forest');
  assert.equal(await identity(page),thunder,'restoring a save preserves the weather event');
  assert.equal(await page.evaluate(()=>PlanSync._docs()['cfg/future-synthetic'].d.marker),'keep');

  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await ready(page);
  assert.equal(await identity(page),thunder,'the active event survives an offline restart');
  await dismiss();
  await openTree();
  assert.equal(await tree.locator('.is-current').getAttribute('data-kind'),'thunder');
  await closeTree();
  await other.goto(url+'/citadel.html');
  await other.getByText('Гроза',{exact:true}).waitFor();
  assert.equal(await other.locator('#weather-city,#refresh-weather').count(),0);
  assert.deepEqual(weatherNetwork,[]);
  assert.deepEqual(errors,[]);
  const timerContext=await browser.newContext({serviceWorkers:'block'});
  await timerContext.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/css'}));
  const timed=await timerContext.newPage();
  await timed.clock.install({time:new Date(originTime)});
  await timed.addInitScript(({key,originTime})=>{
    localStorage.setItem(key,JSON.stringify({version:1,id:'automatic-expiry',type:'clear',intensity:1,startedAt:originTime-15*60_000,endsAt:originTime+5000}));
  },{key,originTime});
  await timed.goto(url);
  await timed.waitForFunction(()=>document.documentElement.dataset.worldWeatherId==='automatic-expiry');
  await timed.clock.runFor(7000);
  await timed.waitForFunction(()=>document.documentElement.dataset.worldWeatherId!=='automatic-expiry');
  assert.notEqual((await getStored(timed)).type,'clear');
  await timerContext.close();
  console.log('PASS ten weather events, cross-tab generation and renewal, backgrounds, masked windows, crossfade, travel, restore and offline reload');
}finally{
  await browser?.close();
  server.close();
}
