import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir, readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {chromium} from 'playwright';
import '../src/ascension.js';
import '../src/destiny-world.js';

const blank={rank:1,marks:new Set()};
const model=(nodes,levels=[])=>VkachDestinyWorld.project(VkachAscension.view({nodes},blank),levels);
const baseline=model({});
assert.deepEqual(baseline.branches.map(row=>row.state),[0,0,0,0,0]);
assert(baseline.branches.every(row=>row.extra.length===0));
assert.equal(baseline.lamps,1);
assert.equal(baseline.restoration,0);
assert.equal(model({'body-1':123},[1,2,3]).branches[0].state,1);
assert.equal(model({'body-1':123,'body-2':124,'body-3':125}).branches[0].state,2);
assert.equal(model({'body-hidden-1':123}).branches[0].extra.length,2);

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
const shots=resolve(process.env.DESTINY_SHOTS||'test-results/destiny-world');
await mkdir(shots,{recursive:true});
const url='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Moscow'});
  await context.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/css'}));
  await context.addInitScript(()=>{
    const prefix='plan.android-test.';
    localStorage.setItem(prefix+'awakening.v1',JSON.stringify({version:1,step:12,status:'done'}));
    localStorage.setItem(prefix+'rebuild-guide.v1',JSON.stringify({version:1,step:2,status:'done'}));
    localStorage.setItem('wsum','2026-12-14');
    localStorage.setItem('msum','2026-12');
    localStorage.setItem('trialSeen','2026-12-20');
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-12-20T12:00:00Z')});
  await page.goto(url);
  const home=page.locator('#citadel-home');
  const horizon=home.locator('.destiny-horizon');
  const viewport=home.locator('.citadel-viewport');
  const dialog=page.locator('#destiny-world');
  const map=dialog.locator('.destiny-world-art');
  const dock=home.locator('.citadel-shell-dock');
  const sectionMenu=home.locator('#citadel-shell-nav');
  const screenshot=name=>page.screenshot({path:resolve(shots,name+'.png'),animations:'disabled'});
  const snapshot=()=>page.evaluate(()=>JSON.stringify(PlanSync._docs()));
  await horizon.locator('.destiny-veins').first().waitFor();
  await page.waitForFunction(()=>PlanSync._docs()['cfg/realm-achievements']?.d.mysterySince);
  async function dismiss(){
    await page.evaluate(()=>{
      for(let i=0;i<15&&!document.querySelector('#achup').hidden;i++)document.querySelector('#ac-ok').click();
      if(!document.querySelector('#lvup').hidden)document.querySelector('#lv-ok').click();
    });
  }
  await dismiss();
  await viewport.evaluate(el=>{el.scrollTop=0;});
  assert(await horizon.evaluate(svg=>getComputedStyle(svg).pointerEvents==='none'));
  assert(await horizon.locator('image[href$="destiny-tree.svg"]').count());
  const skyline=await home.locator('.citadel-skyline').boundingBox();
  const distant=await horizon.boundingBox();
  assert(skyline&&distant&&distant.y<skyline.y&&distant.x<390);
  await screenshot('01-citadel-distant-tree');

  async function open(search=false){
    await dock.getByRole('button',{name:'Все разделы игры'}).click();
    if(search){
      await sectionMenu.getByRole('searchbox',{name:'Поиск по Вкачу'}).fill('Древо Судьбы');
      await sectionMenu.locator('.citadel-search-results').getByRole('button',{name:/Древо Судьбы/}).click();
    }else{
      const all=sectionMenu.locator('.citadel-all-functions');
      const group=all.locator('.citadel-menu-group').filter({hasText:'ПУТЬ И ПРОГРЕСС'});
      if(await all.getAttribute('open')===null)await all.locator(':scope > summary').click();
      if(await group.getAttribute('open')===null)await group.locator(':scope > summary').click();
      await group.getByRole('button',{name:'Древо Судьбы',exact:true}).click();
    }
    await dialog.waitFor();
  }
  async function returnHome(){
    await dialog.getByRole('button',{name:'В Цитадель',exact:false}).click();
    await dialog.waitFor({state:'hidden'});
    await horizon.waitFor();
  }
  const chain=dialog.locator('.destiny-chain[data-direction="citadel"]');
  const distantCitadelBranch=horizon.locator('.destiny-veins[data-direction="citadel"]');
  const tab=dialog.getByRole('button',{name:'ЦИТАДЕЛЬ',exact:true});
  const before=await snapshot();
  await open();
  assert.equal(await map.locator('image[href$="destiny-valley.svg"]').count(),1);
  for(const asset of ['destiny-tree.svg','destiny-valley.svg']){
    const response=await page.request.get(url+'/assets/citadel/'+asset);
    assert(response.ok());
  }
  assert.equal(await chain.getAttribute('data-state'),'0');
  assert.equal(await map.locator('.destiny-window.is-lit').count(),1);
  assert.equal(await home.locator('.citadel-sky').getAttribute('data-restoration'),'0');
  await tab.click();
  assert.match(await dialog.locator('.destiny-branch-phase').textContent(),/Сковано/);
  await screenshot('02-tree-and-citadel');
  const manualZoom=dialog.getByRole('button',{name:'Приблизить Древо'});
  await manualZoom.click();
  assert.equal(await map.getAttribute('data-zoom'),'1.3');
  const near=map.locator('.destiny-world-near');
  const oldPan=await near.getAttribute('transform');
  const box=await map.boundingBox();
  const middle=[box.x+box.width*.47,box.y+box.height*.51];
  await page.mouse.move(...middle);
  await page.mouse.down();
  await page.mouse.move(middle[0]-28,middle[1]-22,{steps:5});
  await page.mouse.up();
  assert.notEqual(await near.getAttribute('transform'),oldPan);
  await dialog.getByRole('button',{name:'Вернуться к центру Древа'}).click();
  assert.equal(await map.getAttribute('data-zoom'),'1');

  const session=await context.newCDPSession(page);
  const touches=spread=>[{x:middle[0]-spread,y:middle[1],id:1},{x:middle[0]+spread,y:middle[1],id:2}];
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(26)});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(54)});
  await page.waitForFunction(()=>Number(document.querySelector('.destiny-world-art').dataset.zoom)>1);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await dialog.getByRole('button',{name:'Вернуться к центру Древа'}).click();
  for(const [width,height] of [[320,680],[360,800],[430,900],[800,360]]){
    await page.setViewportSize({width,height});
    const bounds=await dialog.boundingBox();
    assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1);
    assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'horizontal overflow at '+width);
    assert(await dialog.getByRole('button',{name:/В Цитадель/}).isVisible());
  }
  await page.setViewportSize({width:390,height:844});
  await page.goBack();
  await dialog.waitFor({state:'hidden'});
  await page.goForward();
  await dialog.waitFor();
  await returnHome();
  assert.equal(await snapshot(),before,'camera, navigation and selection must be read-only');

  await page.evaluate(()=>PlanDB.doc('buys/citadel-rest-2').set({
    kind:'citadel-room',currency:'abyss',room:'rest',level:2,cost:5,ts:Date.now()
  }));
  await page.waitForFunction(()=>document.querySelector('.destiny-horizon [data-direction="citadel"]').dataset.state==='1');
  await dismiss();
  await open();
  assert.equal(await chain.getAttribute('data-state'),'1');
  assert.equal(await distantCitadelBranch.getAttribute('data-state'),'1');
  assert.equal(await map.locator('.destiny-window.is-lit').count(),2);
  assert.equal(await map.locator('.destiny-castle-renewal').getAttribute('data-restoration'),'1');
  assert.equal(await chain.locator('.destiny-chain-crack').evaluate(el=>getComputedStyle(el).display),'block');
  await tab.click();
  await screenshot('03-chain-weakened');

  await page.evaluate(async()=>{
    const track=document.querySelector('.destiny-chain[data-direction="citadel"]');
    window.testBreaks=0;
    new MutationObserver(()=>{if(track.classList.contains('is-breaking'))window.testBreaks++;})
      .observe(track,{attributes:true,attributeFilter:['class']});
    await PlanDB.runTransaction(tx=>{
      for(const room of ['rest','study','throne']){
        for(const level of [2,3]){
          tx.set('buys/citadel-'+room+'-'+level,{kind:'citadel-room',currency:'abyss',room,level,cost:5,ts:Date.now()});
        }
      }
      for(let i=0;i<30;i++){
        const date=new Date(Date.UTC(2026,10,12+i)).toISOString().slice(0,10);
        tx.set('days/'+date,{q:[true]});
      }
    });
  });
  await page.waitForFunction(()=>window.testBreaks===1);
  await page.waitForFunction(()=>!document.querySelector('.destiny-chain[data-direction="citadel"]').classList.contains('is-breaking'));
  assert.equal(await chain.getAttribute('data-state'),'2');
  assert.equal(await distantCitadelBranch.getAttribute('data-state'),'2');
  assert.equal(await map.locator('.destiny-window.is-lit').count(),7);
  assert.equal(await map.locator('.destiny-castle-renewal').getAttribute('data-restoration'),'2');
  assert.equal(await home.locator('.citadel-sky').getAttribute('data-restoration'),'2');
  assert.equal(await distantCitadelBranch.locator('.destiny-vein-sparks').count(),1);
  assert.equal(await chain.locator('.destiny-chain-link').first().evaluate(el=>getComputedStyle(el).display),'none');
  await tab.click();
  await dialog.locator('.destiny-node-list button').nth(2).click();
  assert.match(await dialog.locator('.destiny-branch-phase').textContent(),/Пробуждено/);
  assert.match(await dialog.locator('.destiny-node-description').textContent(),/Открыто/);
  await screenshot('04-tree-awakened');
  await returnHome();
  await dismiss();
  await screenshot('05-citadel-awakened');

  const earned=await snapshot();
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(true);
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await chain.getAttribute('data-state'),'2');
  assert.equal(await page.evaluate(()=>window.testBreaks),1);
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.equal(await snapshot(),earned,'revisiting must not create rewards or save records');
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.destiny-horizon [data-direction="citadel"]')?.dataset.state==='2');
  await dismiss();
  await open();
  assert.equal(await chain.getAttribute('data-state'),'2');
  assert.equal(await dialog.locator('.is-breaking').count(),0);
  assert.equal(await map.locator('.destiny-window.is-lit').count(),7);
  await returnHome();
  const room=home.locator('[data-croom="rest"]');
  await room.click();
  await page.locator('#citadel-interior:not([hidden])').waitFor();
  assert.equal(await page.locator('#citadel-interior-stage').getAttribute('data-room'),'rest');
  assert.deepEqual(errors,[]);
  console.log('PASS Destiny World views, confirmed progression, one-time chains, pinch/pan, back/forward, reduced motion, 320–430 px and offline reload');
}finally{
  await browser?.close();
  server.close();
}
