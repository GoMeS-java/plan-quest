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
assert.deepEqual(baseline.branches.map(row=>row.state),[0,0,0,0,0,0]);
assert(baseline.branches.every(row=>row.extra.length===0));
assert.equal(baseline.lamps,1);
assert.equal(baseline.restoration,0);
assert.equal(model({'body-1':123},[1,2,3]).branches[0].state,1);
assert.equal(model({'body-1':123,'body-2':124,'body-3':125}).branches[0].state,2);
assert.equal(model({'body-hidden-1':123}).branches[0].extra.length,2);
const branch=recent=>VkachDestinyWorld.project(VkachAscension.view(null,blank),[],{body:{days:9,recent}}).branches[0];
assert.equal(branch(0).tier,3,'real activity changes wood before a seal');
assert.equal(branch(8).tier,branch(0).tier,'inactivity does not remove wood');
assert(branch(8).warmth>branch(0).warmth);
assert.equal(baseline.awakening.percent,0);
const directions=baseline.branches.map(branch=>branch.id);
const recordedTree=tier=>Object.fromEntries(directions.map(id=>[id,[tier,0]]));
for(const [stage,tier] of [0,3,6,9,12].entries()){
  const historical=VkachDestinyWorld.historicalAppearance(recordedTree(tier));
  assert.deepEqual(historical.awakening,{stage,percent:stage*25,warmth:0});
}
assert.equal(VkachDestinyWorld.historicalAppearance(null),null);
assert.equal(model({'body-1':123,'body-2':124,'body-3':125}).awakening.stage,0,'a single direction cannot wake the whole tree');

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
  assert.equal(await dialog.locator('.destiny-branches button').count(),6);
  assert.equal(await map.locator('.destiny-wood[data-direction="capital"][data-tier="0"]').count(),1);
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
  await page.waitForFunction(()=>document.querySelector('.destiny-horizon .destiny-veins[data-direction="citadel"]').dataset.state==='1');
  await dismiss();
  await open();
  assert.equal(await chain.getAttribute('data-state'),'1');
  assert.equal(await distantCitadelBranch.getAttribute('data-state'),'1');
  assert.equal(await map.locator('.destiny-window.is-lit').count(),2);
  assert.equal(await map.locator('.destiny-castle-renewal').getAttribute('data-restoration'),'1');
  assert.equal(await chain.locator('.destiny-chain-crack').first().evaluate(el=>getComputedStyle(el).display),'block');
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

  await page.evaluate(async()=>{
    await PlanDB.runTransaction(tx=>{
      for(let i=1;i<=20;i++){
        const date='2026-12-'+String(i).padStart(2,'0');
        tx.set('jar/living-'+i,{date,a:500,ts:Date.now()-5000});
        tx.set('days/'+date,{q:[true,true,true,true,false,false,false,true],steps:6500});
      }
      tx.set('jar/living-last',{date:'2026-11-30',a:500,ts:Date.now()-5000});
    });
  });
  await page.waitForFunction(()=>Object.keys(PlanSync._docs()['cfg/ascension']?.d.nodes||{}).includes('capital-3')&&
    Object.values(PlanSync._docs()).some(row=>row.d?.frame?.tree?.capital?.[0]===12));
  await dismiss();
  await open();
  const gold=map.locator('.destiny-wood[data-direction="capital"]');
  assert.equal(await gold.getAttribute('data-tier'),'12');
  assert(await gold.locator('.destiny-crown.gold').count()>5);
  assert(await map.locator('.destiny-wood[data-direction="body"] .destiny-new-wood').count()>0);
  assert(await map.locator('.destiny-living-wood *').count()<220,'decoration has a fixed mobile rendering budget');
  await dialog.getByRole('button',{name:'КАПИТАЛ',exact:true}).click();
  await screenshot('06-living-roots-capital');
  await returnHome();
  await dismiss();

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
  await page.waitForFunction(()=>document.querySelector('.destiny-horizon .destiny-veins[data-direction="citadel"]')?.dataset.state==='2');
  await dismiss();
  await open();
  assert.equal(await chain.getAttribute('data-state'),'2');
  assert.equal(await gold.getAttribute('data-tier'),'12','capital form survives an offline reload');
  assert.equal(await dialog.locator('.is-breaking').count(),0);
  assert.equal(await map.locator('.destiny-window.is-lit').count(),7);
  const body=map.locator('.destiny-wood[data-direction="body"]');
  const bodyTier=await body.getAttribute('data-tier');
  await page.clock.setSystemTime(new Date('2027-01-06T12:00:00Z'));
  await page.clock.runFor(1250);
  await page.waitForFunction(()=>document.querySelector('#destiny-world .destiny-wood[data-direction="body"]').style.getPropertyValue('--warmth')==='0.26');
  assert.equal(await body.getAttribute('data-tier'),bodyTier);
  assert.equal(await gold.getAttribute('data-tier'),'12','inactivity leaves earned form in place');
  await page.evaluate(()=>PlanDB.doc('days/2027-01-06').set({steps:30000}));
  await page.waitForFunction(()=>Number(document.querySelector('#destiny-world .destiny-wood[data-direction="body"]').style.getPropertyValue('--warmth'))>.26);
  await returnHome();
  await dismiss();
  const room=home.locator('[data-croom="rest"]');
  await room.click();
  await page.locator('#citadel-interior:not([hidden])').waitFor();
  assert.equal(await page.locator('#citadel-interior-stage').getAttribute('data-room'),'rest');
  assert.deepEqual(errors,[]);

  const comparison=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
  await comparison.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/css'}));
  const noon=Date.parse('2026-12-20T12:00:00Z');
  await comparison.addInitScript(noon=>{
    const prefix='plan.android-test.';
    localStorage.setItem(prefix+'awakening.v1',JSON.stringify({version:1,step:12,status:'done'}));
    localStorage.setItem(prefix+'rebuild-guide.v1',JSON.stringify({version:1,step:2,status:'done'}));
    localStorage.setItem(prefix+'world-weather.v1',JSON.stringify({version:1,id:'heart-comparison',type:'clear',
      intensity:1,startedAt:noon-1000,endsAt:noon+29*60000}));
    localStorage.setItem('wsum','2026-12-14');
    localStorage.setItem('msum','2026-12');
    localStorage.setItem('trialSeen','2026-12-20');
  },noon);
  const example=await comparison.newPage();
  example.on('pageerror',error=>errors.push(error.message));
  await example.clock.setFixedTime(noon);
  await example.goto(url);
  const tree=example.locator('#destiny-world');
  const nearTree=tree.locator('.destiny-heart-tree');
  const farTree=example.locator('.destiny-horizon .destiny-heart-tree');
  const view=tree.locator('.destiny-world-view');
  await farTree.locator('.destiny-heart').waitFor();
  await example.waitForFunction(()=>PlanSync._docs()['world-history/2026-12-20']?.d.frame.tree);
  await example.evaluate(()=>{
    for(let i=0;i<15&&!document.querySelector('#achup').hidden;i++)document.querySelector('#ac-ok').click();
  });
  await example.locator('.citadel-shell-dock').getByRole('button',{name:'Все разделы игры'}).click();
  await example.getByRole('searchbox',{name:'Поиск по Вкачу'}).fill('Древо Судьбы');
  await example.locator('.citadel-search-results').getByRole('button',{name:/Древо Судьбы/}).click();
  await tree.waitFor();
  const weatherLabel=await tree.locator('.destiny-weather-label').innerText();
  assert.match(weatherLabel,/Ясное небо · день/);
  const size=await view.evaluate(el=>[el.clientWidth,el.clientHeight]);
  const comparisons=[
    [0,[0,0,0,0,0,0],'heart-00-dead'],
    [25,[1,1,1,1,0,0],'heart-25-breath'],
    [50,[3,2,2,2,0,0],'heart-50-awakening'],
    [75,[3,2,2,2,2,2],null],
    [100,[3,3,3,3,3,3],'heart-100-heart']
  ];
  let prior;
  for(const [percent,levels,filename] of comparisons){
    if(percent===75)await example.emulateMedia({reducedMotion:'no-preference'});
    if(percent===100)await example.emulateMedia({reducedMotion:'reduce'});
    if(percent)await example.evaluate(({directions,levels,percent})=>PlanDB.runTransaction(tx=>{
      const nodes={};
      directions.forEach((id,index)=>{
        for(let level=1;level<=levels[index];level++)nodes[id+'-'+level]=Date.now()-1000;
      });
      tx.set('cfg/ascension',{version:1,nodes});
      for(let index=0;index<5;index++){
        const date='2026-12-'+(15+index);
        if(percent===25)tx.set('days/'+date,{steps:6200});
        if(percent===75)tx.set('jar/heart-'+index,{date,a:10,ts:Date.now()-1000});
      }
    }),{directions,levels,percent});
    await nearTree.and(example.locator('[data-percent="'+percent+'"]')).waitFor();
    assert.equal(await farTree.getAttribute('data-percent'),String(percent));
    assert.equal(await nearTree.getAttribute('data-stage'),String(percent/25));
    assert.equal(await tree.locator('.destiny-weather-label').innerText(),weatherLabel);
    assert.equal(await tree.locator('.destiny-world-art').getAttribute('data-zoom'),'1');
    assert.deepEqual(await view.evaluate(el=>[el.clientWidth,el.clientHeight]),size);
    if(percent===75){
      await nearTree.locator('.destiny-trunk-wave.is-rising').waitFor({state:'attached'});
      assert.equal(await nearTree.locator('.destiny-trunk-wave').evaluate(el=>getComputedStyle(el).animationName),'destiny-trunk-rise');
      assert(await nearTree.locator('.destiny-heart-channel.is-flowing').count()>0);
    }
    if(filename){
      const image=await view.screenshot({path:resolve(shots,filename+'.png'),animations:'disabled'});
      if(prior)assert(!image.equals(prior),'each stage visibly changes the rendered tree');
      prior=image;
    }
  }
  assert.equal(await nearTree.locator('.destiny-heart-channel').count(),6);
  assert.equal(await nearTree.locator('.destiny-heart-halo').evaluate(node=>getComputedStyle(node).animationName),'none');
  for(const width of [320,360,430]){
    await example.setViewportSize({width,height:844});
    assert(await view.evaluate(host=>{
      const camera=host.querySelector('.destiny-camera').getBoundingClientRect();
      return [...host.querySelectorAll('.destiny-hit')].every(node=>{
        const seal=node.getBoundingClientRect();
        return seal.right<=camera.left||seal.left>=camera.right||seal.bottom<=camera.top||seal.top>=camera.bottom;
      });
    }),'zoom controls clear all seals at '+width+'px');
  }
  await example.setViewportSize({width:390,height:844});
  await example.emulateMedia({reducedMotion:'no-preference'});
  const comparisonCDP=await comparison.newCDPSession(example);
  await comparisonCDP.send('Emulation.setCPUThrottlingRate',{rate:4});
  const frameSample=await tree.evaluate(dialog=>new Promise(resolve=>{
    const times=[];
    function collect(time){
      times.push(time);
      if(time-times[0]<1050){requestAnimationFrame(collect);return;}
      const intervals=times.slice(1).map((current,index)=>current-times[index]).sort((a,b)=>a-b);
      const active=dialog.getAnimations({subtree:true}).filter(animation=>animation.playState==='running');
      resolve({frames:intervals.length,p95:Math.round(intervals[Math.floor(intervals.length*.95)]),active:active.length});
    }
    requestAnimationFrame(collect);
  }));
  assert(frameSample.frames>1&&frameSample.active>0&&frameSample.active<30);
  await tree.getByRole('button',{name:/В Цитадель/}).click();
  await tree.waitFor({state:'hidden'});
  assert.equal(await tree.evaluate(dialog=>dialog.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length),0);
  console.log('Chromium mobile viewport, CPU ×4:',JSON.stringify(frameSample));
  assert.deepEqual(errors,[]);
  console.log('PASS shared tree stages, six directions, four controlled screenshots, chains, mobile gestures and offline restoration');
}finally{
  await browser?.close();
  server.close();
}
