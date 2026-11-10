import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import '../src/ascension.js';

const model=globalThis.VkachAscension;
const progress=marks=>({rank:1,marks:new Set(marks)});
const unlocked=progress(['ascent-body','ascent-walk','rebuild01','rebuild03']);
let ledger, writes=0;
const tx={get:()=>ledger,set:(path,value)=>{assert.equal(path,model.path);ledger=value;writes++;}};
assert.equal(model.reconcile(tx,progress(['ascent-walk']),100).length,0,'a later condition cannot bypass its parent');
assert.deepEqual(model.reconcile(tx,unlocked,100),['body-1','body-2','citadel-1','citadel-2']);
assert.deepEqual(model.reconcile(tx,unlocked,200),[]);
assert.equal(writes,1);
assert.deepEqual(model.merge(ledger,{nodes:{'body-1':50,'will-1':200}}).nodes,
  {'body-1':50,'body-2':100,'citadel-1':100,'citadel-2':100,'will-1':200});
assert.equal(model.view(ledger,progress([]))[0].nodes[0].state,'open','a saved unlock survives edits to evidence');
const sealed=model.view(ledger,unlocked)[0].nodes[2];
assert.equal(sealed.name,'Тайна Заклятия');
assert(!JSON.stringify(sealed).includes('Сила под сводами'));

const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'};
const root=resolve('android-test');
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep))throw Error('Invalid path');
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
  const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow'});
  await context.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/css'}));
  await context.addInitScript(()=>{
    const prefix='plan.android-test.';
    localStorage.setItem(prefix+'awakening.v1',JSON.stringify({version:1,step:12,status:'done'}));
    localStorage.setItem(prefix+'rebuild-guide.v1',JSON.stringify({version:1,step:2,status:'done'}));
    localStorage.setItem('wsum','2026-11-09');
    localStorage.setItem('msum','2026-11');
    if(localStorage.getItem('ascension-test'))return;
    localStorage.setItem('ascension-test','1');
    const docs={};
    for(let day=1;day<=7;day++)docs['days/2026-11-0'+day]={d:{q:[true,false,false,false]},u:1};
    localStorage.setItem(prefix+'store.v1',JSON.stringify({v:1,docs}));
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-11-10T09:00:00Z')});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>PlanSync._docs()['cfg/ascension']?.d.nodes['will-1']);
  await page.evaluate(()=>{
    for(let i=0;i<12&&!document.querySelector('#achup').hidden;i++)document.querySelector('#ac-ok').click();
    document.querySelector('#lvup').hidden=true;
    document.querySelector('#trophy-btn').click();
  });
  const trophy=page.locator('#trophy');
  await trophy.locator('[data-achievement="ascent-rhythm"]').waitFor();
  assert.equal(await trophy.locator('[data-achievement="ascent-body"]').count(),0);
  const shots=process.env.ASCENSION_SHOTS;
  if(shots){
    await mkdir(shots,{recursive:true});
    await page.screenshot({path:resolve(shots,'01-achievements.png'),animations:'disabled'});
  }
  await page.locator('#ascension-open').tap();
  const dialog=page.locator('#ascension[open]');
  assert.equal(await dialog.locator('.ascension-seal').count(),15);
  assert.equal(await dialog.locator('[data-node="will-1"]').getAttribute('class'),'ascension-seal open');
  await dialog.locator('[data-node="will-1"] .ascension-hit').tap();
  assert.equal(await dialog.locator('.ascension-node-title').textContent(),'Своя воля');
  assert(!await dialog.textContent().then(text=>text.includes('Свобода среди руин')));
  const bounds=await dialog.boundingBox();
  assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=360&&bounds.y+bounds.height<=800);
  if(shots)await page.screenshot({path:resolve(shots,'02-ascension.png'),animations:'disabled'});
  await dialog.getByRole('button',{name:'Увеличить'}).tap();
  const stage=dialog.locator('.ascension-stage');
  const before=await stage.getAttribute('transform');
  assert(before.includes('scale(1.25)'));
  const map=await dialog.locator('svg').boundingBox();
  await page.mouse.move(map.x+map.width/2,map.y+map.height/2);
  await page.mouse.down();
  await page.mouse.move(map.x+map.width/2-30,map.y+map.height/2-20,{steps:5});
  await page.mouse.up();
  assert.notEqual(await stage.getAttribute('transform'),before);
  await dialog.getByRole('button',{name:'Сбросить масштаб'}).tap();
  assert.equal(await stage.getAttribute('transform'),'translate(0 0) scale(1)');
  await page.goBack();
  await dialog.waitFor({state:'hidden'});
  assert(await trophy.isVisible(),'Android back returns to the collection');
  await page.reload();
  await page.waitForFunction(()=>PlanSync._docs()['cfg/ascension']?.d.nodes['will-1']);
  assert.deepEqual(errors,[]);
  console.log('PASS Ascension gates, secrecy, merge, mobile selection, zoom, pan, back and persisted unlocks');
} finally {
  await browser?.close();
  server.close();
}
