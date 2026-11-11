import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir, readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {chromium} from 'playwright';
import vm from 'node:vm';
import '../src/world-history.js';

const day='2026-12-20', nextDay='2026-12-21', oldDay='2026-12-19';
const first=Date.parse(day+'T12:00:00Z'), second=Date.parse(nextDay+'T12:00:00Z');
const history=VkachWorldHistory, path='world-history/'+day;
const calendar=at=>new Date(at).toISOString().slice(0,10);
assert(history.isPath(path));
assert(!history.isPath('world-history/2026-02-29'));
assert(!history.isPath('world-history/2026-12-20/child'));
const obs=(at,frame)=>({version:1,at,frame});
const a=obs(first,{rooms:{rest:1}}), b=obs(first,{rooms:{rest:3}});
assert.deepEqual(history.merge(a,b),history.merge(b,a));
assert.equal(history.merge(obs(first+2,b.frame),a).frame,b.frame);
assert.equal(history.merge({version:2,at:first-100},a).version,2);
const olderClient={TextEncoder};
vm.runInNewContext(execFileSync('git',['show','e054337:src/world-history.js'],{encoding:'utf8'}),olderClient);
const recentTree={version:2,at:first,frame:{tree:{}}};
assert.equal(olderClient.VkachWorldHistory.capture({get:()=>recentTree},day,second,a.frame),'unsupported');
assert.equal(olderClient.VkachWorldHistory.merge(recentTree,obs(second,a.frame)),recentTree);

const recorded={
  ['days/'+oldDay]:{d:{steps:500,q:[true,false]},u:first},
  ['per/'+oldDay]:{d:{pushup:[first-86400000,first-86400000,second],pushupR:[20,20,500]},u:first},
  'weights/real':{d:{date:oldDay,kg:145},u:first},
  'goals/missing-date':{d:{done:true,ts:first-86400000},u:first},
  'goals/done':{d:{done:true,completedAt:first-86400000},u:first},
  'buys/citadel-rest-2':{d:{kind:'citadel-room',room:'rest',level:2,ts:first-86400000},u:first},
  'cfg/ascension':{d:{nodes:{'body-1':first-86400000,'body-2':second}},u:first},
  'tx/private':{d:{amt:50000,date:oldDay},u:first}
};
const events=history.datedEvents(recorded,[{id:'real-mark',date:oldDay},{id:'future-mark',date:nextDay}],day,calendar,first);
assert.deepEqual(events.map(row=>row.kind),['activity','room','goal','mark','seal','weight']);
assert.deepEqual(events[0],{id:'activity/'+oldDay,date:oldDay,kind:'activity',steps:500,sets:1,reps:20,tasks:1});
assert.deepEqual(history.frames(recorded),[],'dated facts cannot create old appearance');
const filled=Object.fromEntries(Array.from({length:12},(_,i)=>[
  'world-history/2026-11-'+String(i+1).padStart(2,'0'),{d:obs(first,{data:'x'.repeat(30000)}),u:first}
]));
const tx={get:key=>filled[key]?.d,list:()=>Object.entries(filled).map(([key,row])=>({id:key.split('/')[1],...row.d})),
  set(){assert.fail('full history must leave existing rows intact');}};
assert.equal(history.capture(tx,day,first,a.frame),'full');
assert.equal(Object.keys(filled).length,12);

const root=resolve('android-test');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try{
    const request=new URL(req.url,'http://localhost').pathname;
    const file=resolve(root,'.'+(request==='/'?'/index.html':request));
    if(!file.startsWith(root+sep))throw Error('invalid path');
    const content=await readFile(file);
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(content);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
  await context.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/css'}));
  await context.addInitScript(()=>{
    const prefix='plan.android-test.';
    localStorage.setItem(prefix+'awakening.v1',JSON.stringify({version:1,step:12,status:'done'}));
    localStorage.setItem(prefix+'rebuild-guide.v1',JSON.stringify({version:1,step:2,status:'done'}));
    localStorage.setItem('wsum','2026-12-21');localStorage.setItem('msum','2026-12');
    localStorage.setItem('trialSeen','2026-12-21');
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:first});
  await page.goto('http://127.0.0.1:'+server.address().port);
  const frames=()=>page.evaluate(()=>VkachWorldHistory.frames(PlanSync._docs()));
  await page.waitForFunction(key=>!!PlanSync._docs()[key],path);
  assert.equal((await frames())[0].rooms.rest,1);
  const old=await page.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));
  await page.evaluate(date=>PlanDB.runTransaction(tx=>{
    tx.set('days/'+date,{q:[true],steps:5600});
    tx.set('per/'+date,{pushup:[Date.now()-1000],pushupR:[20]});
    tx.set('weights/sample',{date,kg:145.3,ts:Date.now()});
    tx.set('cfg/outfit',{top:'knit_black',bottom:'pants_black',outer:'coat_camel'});
    tx.set('buys/citadel-rest-2',{kind:'citadel-room',currency:'abyss',room:'rest',level:2,cost:5,ts:Date.now()});
    tx.set('cfg/shelter-items',{owned:{cat:Date.now()},placements:{cat:{room:'rest',slot:'table',at:Date.now()}}});
    tx.set('cfg/ascension',{nodes:{'body-1':Date.now()-1000}});
  }),day);
  await page.waitForFunction(key=>{
    const frame=PlanSync._docs()[key]?.d.frame;
    return frame?.rooms.rest===2&&frame.clothes[0]?.[0]==='knit_black'&&frame.seals.includes('body-1')&&
      frame.seals.includes('citadel-1')&&frame.marks.includes('rebuild01');
  },path);
  const captured=(await frames())[0];
  assert.deepEqual(captured.weight,[day,145.3]);
  assert.deepEqual(captured.activity,[5600,1,20,1]);
  assert.deepEqual(captured.interior,[['cat','rest','table']]);
  assert.equal((await frames()).length,1);
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.clock.setSystemTime(second);
  await page.reload();
  const secondPath='world-history/'+nextDay;
  await page.waitForFunction(key=>!!PlanSync._docs()[key]?.d,secondPath);
  assert.deepEqual((await frames()).map(frame=>frame.date),[nextDay,day]);
  assert.deepEqual((await frames())[1],captured);
  const backup=await page.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));
  assert.equal(backup.docs[path].d.version,2,'older clients cannot overwrite recorded wood');
  assert.equal(backup.docs[path].d.frame.rooms.rest,2);
  assert.equal(backup.docs[secondPath].d.frame.rooms.rest,2);

  // Reopen the real profile UI on an isolated offline install.
  await page.evaluate(()=>{
    if(!document.querySelector('#lvup').hidden)document.querySelector('#lv-ok').click();
    for(let i=0;i<15&&!document.querySelector('#achup').hidden;i++)document.querySelector('#ac-ok').click();
  });
  await page.locator('.citadel-shell-dock').getByRole('button',{name:'Профиль',exact:true}).click();
  const panel=page.getByRole('region',{name:'Снимки мира'});
  await panel.waitFor();
  assert.match(await panel.innerText(),/ДНЕЙ ЗАПИСАНО · 2/);
  const dir=resolve(process.env.WORLD_HISTORY_SHOTS||'test-results/world-history');
  await mkdir(dir,{recursive:true});
  await panel.screenshot({path:resolve(dir,'01-profile-world-history.png'),animations:'disabled'});
  await panel.getByRole('button',{name:'ОТКРЫТЬ ЛЕТОПИСЬ'}).click();
  const chronicle=page.getByRole('dialog',{name:'Летопись Спящего'});
  await chronicle.waitFor();
  await chronicle.locator('.chronicle-frame summary').first().click();
  assert.equal(await chronicle.locator('.chronicle-frame[open] .chronicle-tree progress').count(),6);
  await chronicle.screenshot({path:resolve(dir,'02-sleepers-chronicle.png'),animations:'disabled'});
  await chronicle.getByLabel('Показать').selectOption('weight');
  assert.equal(await chronicle.locator('.chronicle-frame').count(),0);
  assert.match(await chronicle.innerText(),/145,3 кг/);
  await page.goBack();
  await chronicle.waitFor({state:'hidden'});
  assert.equal(await panel.getByRole('button',{name:'ОТКРЫТЬ ЛЕТОПИСЬ'}).evaluate(node=>node===document.activeElement),true);
  await page.evaluate(()=>PlanDB.doc('goals/synthetic').set({name:'Проверить новый зал',done:false,ts:Date.now()}));
  await page.waitForFunction(()=>document.querySelector('#gg-list .q'));
  await page.evaluate(()=>document.querySelector('#gg-list .q').click());
  await page.waitForFunction(()=>PlanSync._docs()['goals/synthetic'].d.completedAt);
  const goalDate=await page.evaluate(()=>new Date(PlanSync._docs()['goals/synthetic'].d.completedAt).toISOString().slice(0,10));
  assert.equal(goalDate,nextDay);

  await page.evaluate(copy=>PlanSync.importObj(copy,true),old);
  await page.waitForFunction(key=>PlanSync._docs()[key]?.d.frame.rooms.rest===1,secondPath);
  assert.deepEqual((await frames())[1],captured,'a restored older backup does not replace a better historical frame');
  await page.evaluate(({path,first,oldDay})=>PlanSync._merge({docs:{
    [path]:{d:{version:1,at:first-100,frame:{rooms:{rest:1}}},u:Date.now()+10},
    ['world-history/'+oldDay]:{d:{version:1,at:first-86400000,frame:{rooms:{rest:1}}},u:first}
  }},{detect:true}),{path,first,oldDay});
  const merged=await frames();
  assert.equal(merged.length,3);
  assert.deepEqual(merged[1],captured,'observation timestamp wins over a rewritten record timestamp');
  await panel.getByRole('button',{name:'ОТКРЫТЬ ЛЕТОПИСЬ'}).click();
  await chronicle.getByLabel('Показать').selectOption('frame');
  await chronicle.locator('.chronicle-frame summary').last().click();
  assert.match(await chronicle.locator('.chronicle-frame').last().innerText(),/Облик Древа на эту дату неизвестен/);
  await page.keyboard.press('Escape');
  await chronicle.waitFor({state:'hidden'});
  await page.reload();
  await page.waitForFunction(()=>VkachWorldHistory.frames(PlanSync._docs()).length===3);
  assert.deepEqual(errors,[]);
  console.log('PASS dated source events, historical cap, real observations, offline day change, verified backup, older restore and device merge');
}finally{
  await browser?.close();
  server.close();
}
