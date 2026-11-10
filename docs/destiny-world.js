(function (root) {
  'use strict';

  const width = 800;
  const height = 900;
  const art = 'assets/citadel/';
  const states = ['Сковано', 'Ослаблено', 'Пробуждено'];
  const layout = {
    body: {points:[[288,390],[237,371],[162,347]], vein:'M347 520l-10-59-19-45-30-26-51-19-40-17-35-7-35-17',
      chain:[[226,417],[346,469],[439,411]], fork:'M237 371l-30-31-35-29-31-14', forkPoints:[[207,340],[172,311]]},
    will: {points:[[414,339],[475,264],[553,221]], vein:'M405 485l-9-68 18-78 25-44 36-31 43-24 35-19 46-16',
      chain:[[407,349],[509,342],[576,228]], fork:'M475 264l26-49 33-55 41-47', forkPoints:[[501,215],[534,160]]},
    mind: {points:[[343,338],[310,286],[247,207]], vein:'M377 464l-20-64-14-62-33-52-36-43-27-36-31-33',
      chain:[[262,293],[333,379],[434,370]]},
    path: {points:[[455,472],[529,464],[605,445]], vein:'M403 554l19-43 33-39 39-12 35 4 35-17 41-2 48-11',
      chain:[[314,481],[444,549],[592,450]]},
    citadel: {points:[[391,581],[375,673],[308,761]], vein:'M417 493l-16 43-10 45-7 55-9 37-29 42-38 46-51 41',
      horizonVein:'M415 514l-8-54 11-34-9-35 13-33-5-24 13-22',
      chain:[[249,703],[370,696],[484,642]], fork:'M375 673l-55 17-56 47-52 26', forkPoints:[[320,690],[264,737]]}
  };
  const stone = 'M0-18L13-12 18 0 12 13 0 18-13 12-18 0-12-13Z';
  const windows = [[661,390],[628,420],[690,433],[599,445],[718,455],[661,406],[633,438],[683,453],[611,466],[710,477],[652,425],[672,436],[637,471],[681,480],[623,483],[700,466]];
  const svg = (tag, attributes = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  };

  function project(rows, roomLevels) {
    const branches = Object.entries(layout).map(([id, shape]) => {
      const main = rows.find(row => row.id === id);
      const fork = shape.forkPoints && rows.find(row => row.from && row.id.startsWith(id + '-'));
      const nodes = (main?.nodes || []).map((node, i) => ({
        id:node.id, name:node.name, description:node.description, open:node.state === 'open', point:shape.points[i]
      }));
      const extra = (fork?.nodes || []).map((node, i) => ({
        id:node.id, name:node.name, description:node.description, open:node.state === 'open', point:shape.forkPoints[i]
      }));
      const opened = nodes.filter(node => node.open).length;
      return {id,label:main?.label || '',glyph:main?.glyph || '',state:opened===3?2:opened>0?1:0,opened,nodes,extra};
    });
    const levels = roomLevels.filter(level => level === 2 || level === 3);
    const lamps = Math.min(windows.length, 1 + levels.reduce((count,level) => count + level - 1,0));
    return {branches,lamps};
  }

  function artImage(name) {
    return svg('image',{href:art+name,width,height,'pointer-events':'none'});
  }

  function drawVeins(layer, branch, shape, distant) {
    const lines=svg('g',{class:'destiny-veins','data-direction':branch.id,'data-state':branch.state});
    const trace=distant&&shape.horizonVein?shape.horizonVein:shape.vein;
    lines.append(svg('path',{d:trace,class:'destiny-vein-glow'}),svg('path',{d:trace,class:'destiny-vein-core'}));
    if(branch.extra.length) lines.append(svg('path',{d:shape.fork,class:'destiny-vein-glow destiny-secret'}),svg('path',{d:shape.fork,class:'destiny-vein-core destiny-secret'}));
    layer.append(lines);
    return lines;
  }

  function chainArt(points, id) {
    const [a,b,c]=points;
    const chain=svg('g',{class:'destiny-chain','data-direction':id});
    const length=Math.hypot(c[0]-a[0],c[1]-a[1]);
    const count=Math.ceil(length/19);
    for(let i=0;i<=count;i++){
      const t=i/count,u=1-t;
      const x=u*u*a[0]+2*u*t*b[0]+t*t*c[0], y=u*u*a[1]+2*u*t*b[1]+t*t*c[1];
      const angle=Math.atan2(u*(b[1]-a[1])+t*(c[1]-b[1]),u*(b[0]-a[0])+t*(c[0]-b[0]))*180/Math.PI;
      const link=svg('g',{class:i<2||i>count-2?'destiny-chain-tip':'destiny-chain-link',transform:'translate('+x+' '+y+') rotate('+angle+')'});
      const ring={rx:i%2?10:12,ry:i%2?3.6:7.5};
      link.append(svg('ellipse',{...ring,class:'destiny-link-shadow'}),svg('ellipse',{...ring,class:'destiny-link-metal'}));
      if(i===Math.floor(count/2))link.append(svg('path',{class:'destiny-chain-crack',d:'M-4-8l-2 6 5 4-2 7M2-7L0-4l4 3'}));
      chain.append(link);
    }
    return chain;
  }

  function horizonArt(horizon) {
    horizon.append(artImage('destiny-tree.svg'));
    const layer=svg('g');
    horizon.append(layer);
    return model=>{
      layer.replaceChildren();
      for(const branch of model.branches)drawVeins(layer,branch,layout[branch.id],true);
    };
  }

  function cameraFor(map, foreground, background, tools) {
    const pointers=new Map();
    let x=0,y=0,scale=1,drag=false;
    const center=[width/2,height/2];
    function draw(nx,ny,nz) {
      scale=Math.max(1,Math.min(2.7,nz));
      x=Math.max(width*(1-scale),Math.min(0,nx));
      y=Math.max(height*(1-scale),Math.min(0,ny));
      foreground.setAttribute('transform','translate('+x+' '+y+') scale('+scale+')');
      background.setAttribute('transform','translate('+x*.18+' '+y*.18+') scale('+(1+(scale-1)*.18)+')');
      map.dataset.zoom=String(scale);
    }
    function zoom(factor, from=center, to=from) {
      const next=Math.max(1,Math.min(2.7,scale*factor));
      const ratio=next/scale;
      draw(to[0]-(from[0]-x)*ratio,to[1]-(from[1]-y)*ratio,next);
    }
    function point(event) {
      const coords=map.createSVGPoint();
      coords.x=event.clientX;coords.y=event.clientY;
      const local=coords.matrixTransform(map.getScreenCTM().inverse());
      return [local.x,local.y];
    }
    function gesture() {
      const [a,b]=pointers.values();
      return b?{at:[(a[0]+b[0])/2,(a[1]+b[1])/2],distance:Math.hypot(a[0]-b[0],a[1]-b[1])}:{at:a,distance:0};
    }
    map.addEventListener('pointerdown',event=>{
      if(event.button!==0||pointers.size===2)return;
      if(!pointers.size)drag=false;
      pointers.set(event.pointerId,point(event));
      if(pointers.size===2)drag=true;
      event.target.setPointerCapture(event.pointerId);
    });
    map.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId))return;
      const before=gesture(), next=point(event);
      if(!drag&&Math.hypot(next[0]-before.at[0],next[1]-before.at[1])<10)return;
      drag=true;pointers.set(event.pointerId,next);
      const after=gesture();
      zoom(before.distance&&after.distance?after.distance/before.distance:1,before.at,after.at);
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])map.addEventListener(name,event=>pointers.delete(event.pointerId));
    map.addEventListener('click',event=>{if(drag&&event.detail!==0){event.preventDefault();event.stopPropagation();}},true);
    map.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0?1.13:1/1.13,point(event));},{passive:false});
    tools.querySelector('[data-destiny-zoom="in"]').onclick=()=>zoom(1.3);
    tools.querySelector('[data-destiny-zoom="out"]').onclick=()=>zoom(1/1.3);
    const reset=()=>{pointers.clear();drag=false;draw(0,0,1);};
    tools.querySelector('[data-destiny-zoom="reset"]').onclick=reset;
    return reset;
  }

  function mount(dialog, horizon, home, suspendCastle) {
    const syncHorizon=horizonArt(horizon);
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const map=dialog.querySelector('.destiny-world-art');
    const far=map.querySelector('.destiny-world-far'), near=map.querySelector('.destiny-world-near');
    const lights=svg('g',{class:'destiny-castle-windows'});
    windows.forEach(([x,y])=>lights.append(svg('path',{d:'M'+x+' '+y+'l2-4 2 4v5h-4z',class:'destiny-window'})));
    far.append(artImage('destiny-valley.svg'),lights,
      svg('path',{class:'destiny-haze',d:'M34 553q176-28 313 0t418-51m-752 86q197-30 351 0t424-39M57 621q174-25 315 5t375-33'}));
    const veins=svg('g'), chains=svg('g'), seals=svg('g',{class:'destiny-world-seals'});
    const embers=svg('g',{class:'destiny-embers','aria-hidden':'true'});
    for(const [x,y] of [[89,633],[153,720],[193,488],[267,588],[310,536],[347,648],[455,702],[517,587],[556,690],[614,517],[687,641],[733,583]]){
      embers.append(svg('path',{d:'M'+x+' '+y+'l2-4 2 4-2 3z'}));
    }
    near.append(artImage('destiny-tree.svg'),veins,chains,seals,embers);
    const reset=cameraFor(map,near,far,dialog);
    const close=dialog.querySelector('.destiny-world-back');
    const tabs=dialog.querySelector('.destiny-branches'), nodeList=dialog.querySelector('.destiny-node-list');
    const heading=dialog.querySelector('.destiny-branch-title'), phase=dialog.querySelector('.destiny-branch-phase');
    const desc=dialog.querySelector('.destiny-node-description'), status=dialog.querySelector('.destiny-status');
    const fog=document.getElementById('destiny-travel-fog');
    const released=new Set(), pending=new Set(), visuals=new Map();
    let model=null, signature='', branchId='body', nodeId='', timer=0, travelling=false, opener=null;

    for(const [id,shape] of Object.entries(layout)){
      const chain=chainArt(shape.chain,id);
      chains.append(chain);
      const tab=document.createElement('button');
      tab.type='button';tab.dataset.direction=id;
      tab.onclick=()=>select(id);
      tabs.append(tab);
      visuals.set(id,{chain,tab});
    }

    function select(id, target) {
      if(!model)return;
      if(id!==branchId)nodeId='';
      branchId=id;
      const branch=model.branches.find(row=>row.id===id), nodes=branch.nodes.concat(branch.extra);
      const selected=nodes.find(node=>node.id===(target||nodeId))||nodes.find(node=>node.open)||nodes[0];
      nodeId=selected?.id||'';
      heading.textContent=branch.label;
      phase.textContent=states[branch.state]+' · '+branch.opened+' / '+branch.nodes.length+' печатей';
      desc.textContent=selected ? selected.name+' · '+(selected.open?'Открыто. ':'')+selected.description : 'Записи проявятся, когда загрузится профиль.';
      tabs.querySelectorAll('button').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.direction===id)));
      seals.querySelectorAll('[role="button"]').forEach(seal=>seal.setAttribute('aria-pressed',String(seal.dataset.node===nodeId)));
      const focused=nodeList.contains(document.activeElement)?document.activeElement.dataset.node:null;
      nodeList.replaceChildren(...nodes.map((node,index)=>{
        const button=document.createElement('button');
        button.type='button';button.textContent=String(index+1);button.dataset.node=node.id;
        button.setAttribute('aria-label',node.name+(node.open?' · открыто':''));
        button.setAttribute('aria-pressed',String(node.id===nodeId));button.classList.toggle('is-open',node.open);
        button.onclick=()=>select(id,node.id);
        return button;
      }));
      if(focused)Array.from(nodeList.children).find(button=>button.dataset.node===focused)?.focus({preventScroll:true});
    }

    function playPending() {
      if(!dialog.open||document.hidden)return;
      for(const id of pending){
        const {chain,line}=visuals.get(id);
        if(!reduce.matches){
          chain.classList.add('is-breaking');
          line.classList.add('is-surging');
        }
        status.textContent='Цепь разомкнулась · '+model.branches.find(branch=>branch.id===id).label;
      }
      pending.clear();
    }
    chains.addEventListener('animationend',event=>{
      if(event.animationName==='destiny-chain-break')event.target.closest('.is-breaking')?.classList.remove('is-breaking');
    });
    veins.addEventListener('animationend',event=>{
      if(event.animationName==='destiny-vein-surge')event.target.closest('.is-surging')?.classList.remove('is-surging');
    });
    function stopRelease(){
      dialog.querySelectorAll('.is-breaking,.is-surging').forEach(el=>el.classList.remove('is-breaking','is-surging'));
    }
    reduce.addEventListener('change',()=>{if(reduce.matches)stopRelease();});

    function sync(next) {
      const stamp=JSON.stringify(next);
      if(signature===stamp)return;
      signature=stamp;
      syncHorizon(next);
      Array.from(lights.children).forEach((lamp,index)=>lamp.classList.toggle('is-lit',index<next.lamps));
      // Commit animation only for a new change seen in this session, never for a loaded snapshot.
      for(const branch of next.branches){
        const previous=model?.branches.find(row=>row.id===branch.id);
        if(branch.state===2&&!released.has(branch.id)){
          if(previous&&previous.state<2)pending.add(branch.id);
          released.add(branch.id);
        }
        const visual=visuals.get(branch.id);
        visual.tab.textContent=branch.label;
        visual.tab.dataset.state=branch.state;
        visual.chain.dataset.state=branch.state;
      }
      model=next;
      veins.replaceChildren();
      const focus=seals.contains(document.activeElement)?document.activeElement.dataset.node:null;
      seals.replaceChildren();
      for(const branch of next.branches){
        const shape=layout[branch.id],visual=visuals.get(branch.id);
        visual.line=drawVeins(veins,branch,shape);
        for(const node of branch.nodes.concat(branch.extra)){
          const seal=svg('g',{class:'destiny-seal'+(node.open?' is-open':''),'data-direction':branch.id,
            role:'button',tabindex:0,'aria-label':node.name+(node.open?' · открыто':''),transform:'translate('+node.point.join(' ')+')'});
          seal.dataset.node=node.id;
          seal.append(svg('circle',{class:'destiny-hit',r:25}),svg('path',{class:'destiny-stone',d:stone}),
            svg('path',{class:'destiny-rune',d:node.open?branch.glyph:'M-5-1H5V7H-5ZM-3-1V-6H3V-1'}));
          seal.addEventListener('click',()=>select(branch.id,node.id));
          seal.addEventListener('keydown',event=>{
            if(event.key==='Enter'||event.key===' '){event.preventDefault();select(branch.id,node.id);}
          });
          seals.append(seal);
        }
      }
      select(branchId,nodeId);
      if(focus)Array.from(seals.children).find(seal=>seal.dataset.node===focus)?.focus({preventScroll:true});
      playPending();
    }

    function clearTravel() {
      clearTimeout(timer);
      timer=0;
      travelling=false;
      fog.hidden=true;
      home.classList.remove('destiny-departure');
    }
    function leave() {
      clearTravel();
      dialog.classList.remove('is-returning');
      if(dialog.open)dialog.close();
      delete document.documentElement.dataset.destinyScene;
      suspendCastle(false);
      stopRelease();
      status.textContent='';
      if(!reduce.matches){
        home.classList.add('destiny-homecoming');
        setTimeout(()=>home.classList.remove('destiny-homecoming'),440);
      }
      const target=opener?.getClientRects().length?opener:home.querySelector('.citadel-map-toggle');
      target?.focus({preventScroll:true});
    }
    function back() {
      if(!dialog.open||travelling)return;
      travelling=true;
      if(!history.state?.destinyWorld){leave();return;}
      if(reduce.matches){history.back();return;}
      dialog.classList.add('is-returning');
      timer=setTimeout(()=>history.back(),350);
    }
    function enter() {
      clearTravel();reset();
      document.documentElement.dataset.destinyScene='active';
      dialog.showModal();
      suspendCastle(true);
      dialog.scrollTop=0;
      close.focus({preventScroll:true});
      playPending();
    }
    function open(trigger) {
      if(dialog.open||travelling||!model)return;
      opener=trigger;
      travelling=true;
      home.classList.remove('destiny-homecoming');
      history.pushState({...history.state,destinyWorld:true},'');
      if(reduce.matches){enter();return;}
      fog.hidden=false;home.classList.add('destiny-departure');
      timer=setTimeout(enter,340);
    }
    close.onclick=back;
    dialog.addEventListener('cancel',event=>{event.preventDefault();back();});
    dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();back();}});
    document.addEventListener('visibilitychange',playPending);
    window.addEventListener('popstate',event=>{
      if(event.state?.destinyWorld&&model){
        event.stopImmediatePropagation();
        if(!dialog.open&&!travelling)enter();
      }else if(dialog.open||travelling){
        event.stopImmediatePropagation();
        leave();
      }
    },true);
    return {sync,open};
  }

  root.VkachDestinyWorld=Object.freeze({project,mount});
})(globalThis);
