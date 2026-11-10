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
const veteran={rank:7,advancedExercise:true,studyAspect:true,chainsAspect:true,marks:new Set([
  'ascent-body','ascent-walk','ascent-rhythm','ascent-chains','ascent-forge','ascent-goal',
  'rebuild01','rebuild03','rebuild11',...Array.from({length:11},(_,i)=>'past-'+i)
])};
assert.equal(model.reconcile(tx,veteran,200).length,11);
assert.equal(ledger.nodes['body-1'],100);
assert.deepEqual(model.view(ledger,veteran).map(branch=>branch.nodes.filter(node=>node.state==='open').length),[3,3,3,3,3]);
assert.deepEqual(model.reconcile(tx,veteran,300),[]);
const withReceipt={...veteran,receipts:new Map([['mystery-road',300]])};
assert.equal(model.view(ledger,withReceipt).length,5,'even a qualifying receipt is invisible until the node is persisted');
assert.deepEqual(model.reconcile(tx,withReceipt,300),['body-hidden-1']);
assert.deepEqual(model.view(ledger,progress([])).at(-1).nodes.map(node=>node.state),['open','next']);
assert.equal(model.view(ledger,progress([])).at(-1).nodes[1].name,'Печать в тумане');
assert.deepEqual(model.reconcile(tx,progress([]),400),[],'editing the source does not close a secret branch');

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
    docs['cfg/realm-achievements']={u:1,d:{version:1,unlocked:{rebuild09:{version:1,at:Date.parse('2026-09-02T09:00Z'),presented:true}}}};
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
  const shots=process.env.ASCENSION_SHOTS||'test-results/ascension';
  await mkdir(shots,{recursive:true});
  await page.screenshot({path:resolve(shots,'01-achievements.png'),animations:'disabled'});
  await page.locator('#ascension-open').tap();
  const dialog=page.locator('#ascension[open]');
  assert.equal(await dialog.locator('.ascension-seal').count(),15);
  assert.equal(await dialog.locator('[data-node="will-1"]').getAttribute('class'),'ascension-seal open');
  await dialog.locator('[data-node="will-1"] .ascension-hit').tap();
  assert.equal(await dialog.locator('.ascension-node-title').textContent(),'Своя воля');
  assert(!await dialog.textContent().then(text=>text.includes('Свобода среди руин')));
  const bounds=await dialog.boundingBox();
  assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=360&&bounds.y+bounds.height<=800);
  await page.screenshot({path:resolve(shots,'02-ascension.png'),animations:'disabled'});
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
  const cdp=await context.newCDPSession(page);
  const mid={x:map.x+map.width/2,y:map.y+map.height/2};
  const points=distance=>[{x:mid.x-distance,y:mid.y,id:1},{x:mid.x+distance,y:mid.y,id:2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(25)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(55)});
  await page.waitForFunction(()=>document.querySelector('.ascension-stage').getAttribute('transform')!=='translate(0 0) scale(1)');
  const pinched=await stage.getAttribute('transform');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(55).map(p=>({...p,x:p.x+20,y:p.y+12}))});
  await page.waitForFunction(previous=>document.querySelector('.ascension-stage').getAttribute('transform')!==previous,pinched,{timeout:5000});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.setViewportSize({width:800,height:360});
  const landscape=await dialog.boundingBox();
  assert(landscape.x>=0&&landscape.y>=0&&landscape.x+landscape.width<=800&&landscape.y+landscape.height<=360);
  await dialog.getByRole('button',{name:'Закрыть древо'}).waitFor();
  await page.setViewportSize({width:360,height:800});
  await page.goBack();
  await dialog.waitFor({state:'hidden'});
  assert(await trophy.isVisible(),'Android back returns to the collection');
  await page.locator('#ascension-open').click();
  await dialog.waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert(await trophy.isVisible(),'Escape closes the map first');

  await page.evaluate(async()=>{
    const model=VkachFood;
    await PlanDB.runTransaction(tx=>{
      const draft=model.putDraft(tx,{id:'synthetic-meal',date:'2026-11-10',kind:'breakfast',
        items:[{id:'item',name:'Синтетический завтрак',grams:100,mode:'unknown'}]},null);
      model.finishMeal(tx,draft);
    });
  });
  await page.waitForFunction(()=>PlanSync._docs()['cfg/realm-achievements']?.d.unlocked.refectory01);
  await trophy.locator('[data-achievement="refectory01"]').waitFor();
  assert.equal(await trophy.locator('[data-achievement="rebuild09"] time').textContent(),'Получено 02.09.2026');
  const dismiss=()=>page.evaluate(()=>{
    for(let i=0;i<12&&!document.querySelector('#achup').hidden;i++)document.querySelector('#ac-ok').click();
    document.querySelector('#lvup').hidden=true;
  });
  await dismiss();
  await trophy.evaluate(node=>{node.scrollTop=0;});
  await trophy.getByRole('button',{name:'Тайны',exact:true}).tap();
  const mysteries=trophy.locator('#achievement-mysteries');
  assert.equal(await mysteries.locator('[data-stage="0"]').count(),5);
  assert.equal(await mysteries.locator('[data-achievement],[data-rarity],time,button').count(),0);
  assert.equal(await mysteries.getByText(/Иней на путевых камнях|Отзвук под северным склоном/).count(),0);
  await page.evaluate(()=>localStorage.setItem('wsum','2026-11-23'));
  await page.clock.setSystemTime(new Date('2026-11-25T09:00Z'));
  const recordWalks=(from,to)=>page.evaluate(async ([from,to])=>{
    await PlanDB.runTransaction(tx=>{
      for(let i=from;i<=to;i++){
        const key='days/2026-11-'+i;
        tx.set(key,{steps:5000,...(i<=13?{q:[false,false,false,false,false,false,false,true]}:{})});
      }
    });
  },[from,to]);
  await recordWalks(11,13);
  await mysteries.locator('[data-stage="1"]').first().waitFor();
  await recordWalks(14,18);
  await mysteries.locator('[data-stage="2"]').waitFor();
  for(const width of [320,360,430]){
    await page.setViewportSize({width,height:800});
    assert(await mysteries.locator('.mystery-card').evaluateAll(cards=>cards.every(card=>{
      const {left,right}=card.getBoundingClientRect();
      return left>=0&&right<=innerWidth&&card.scrollWidth<=card.clientWidth+1;
    })), 'mystery cards fit at '+width);
  }
  await page.setViewportSize({width:360,height:800});
  await dismiss();
  await page.clock.runFor(6000);
  await page.screenshot({path:resolve(shots,'04-mystery-stages.png'),animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await mysteries.locator('[data-stage="2"] .mystery-seal').evaluate(seal=>getComputedStyle(seal,'::after').animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await trophy.locator('#ascension-open').click();
  await dialog.waitFor();
  assert.equal(await dialog.locator('.ascension-offshoot').count(),0);
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  await recordWalks(19,22);
  await page.waitForFunction(()=>PlanSync._docs()['cfg/realm-achievements']?.d.unlocked['mystery-road']?.presented&&
    PlanSync._docs()['cfg/ascension']?.d.nodes['body-hidden-1']);
  await page.locator('#achup.mystery-awakening:not([hidden])').waitFor();
  await page.screenshot({path:resolve(shots,'05-mystery-awakening.png'),animations:'disabled'});
  await dismiss();
  await trophy.evaluate(node=>{node.scrollTop=0;});
  await trophy.getByRole('button',{name:'Отметины',exact:true}).tap();
  const earnedMystery=trophy.locator('[data-achievement="mystery-road"]');
  await earnedMystery.locator('summary').tap();
  await earnedMystery.getByText('Направление · Тело',{exact:true}).waitFor();
  await earnedMystery.getByText('Подтверждено · Записи о ходьбе в разные дни',{exact:true}).waitFor();
  await trophy.evaluate(node=>{node.scrollTop=0;});
  await trophy.locator('#ascension-open').click();
  await dialog.waitFor();
  await dialog.locator('.ascension-reveal').waitFor();
  assert.equal(await dialog.locator('.ascension-offshoot').count(),1);
  assert.equal(await dialog.locator('[data-node="body-hidden-1"].open').count(),1);
  await page.screenshot({path:resolve(shots,'06-mystery-branch.png'),animations:'disabled'});
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  await page.evaluate(()=>PlanDB.doc('days/2026-11-22').delete());
  assert(await earnedMystery.isVisible(),'an earned mark survives deletion');
  await page.evaluate(()=>{
    for(let i=0;i<12&&!document.querySelector('#achup').hidden;i++)document.querySelector('#ac-ok').click();
    document.querySelector('#trophy-x').click();
  });
  await trophy.waitFor({state:'hidden'});
  await page.evaluate(()=>document.querySelector('#gear').click());
  const settings=page.locator('#push-settings');
  assert(await settings.locator('#push-test').isDisabled());
  await settings.locator('summary').tap();
  assert(await settings.getByRole('button',{name:'Отправить тест'}).isDisabled());
  await settings.getByRole('checkbox',{name:'Дневник питания'}).check();
  await settings.getByLabel('Время напоминания о питании').fill('19:30');
  await settings.getByRole('button',{name:'Сохранить расписание'}).tap();
  await page.waitForFunction(()=>PlanSync._docs()['cfg/push-reminders']?.d.times.food==='19:30');
  await settings.locator('summary').evaluate(node=>{
    document.activeElement?.blur();
    const overlay=node.closest('#setup');
    overlay.scrollLeft=0;
    overlay.scrollTop+=node.getBoundingClientRect().top-overlay.querySelector('.shead').getBoundingClientRect().bottom-8;
  });
  await page.screenshot({path:resolve(shots,'03-push-settings.png'),animations:'disabled'});
  for(const width of [320,360,430]){
    await page.setViewportSize({width,height:800});
    assert(await settings.evaluate(node=>{
      const bounds=node.getBoundingClientRect();
      return bounds.left>=0&&bounds.right<=document.documentElement.clientWidth+1&&node.scrollWidth<=node.clientWidth+2;
    }),'push inputs fit at '+width);
  }
  await page.setViewportSize({width:360,height:800});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>PlanSync._docs()['cfg/ascension']?.d.nodes['will-1']);
  assert(await page.evaluate(()=>PlanSync._docs()['cfg/ascension'].d.nodes['body-hidden-1']&&
    PlanSync._docs()['cfg/realm-achievements'].d.unlocked['mystery-road'].presented));
  assert.equal(await page.evaluate(()=>PlanSync._docs()['cfg/push-reminders'].d.times.food),'19:30');
  assert.deepEqual(errors,[]);
  console.log('PASS Ascension gates, secrecy, merge, mobile gestures, meal unlock, settings, mystery stages, branches and offline restore');
} finally {
  await browser?.close();
  server.close();
}
