(function (root) {
  'use strict';
  const path = 'cfg/ascension';
  const branches = [
    { id:'body', label:'ТЕЛО', color:'#ed9b88', glyph:'M0-10V9M-7 3H7M-4 9H4',
      labelAt:[180,22], points:[[180,138],[180,91],[180,45]], nodes:[
        ['Первый подход','Регулярно записывай приседания и отжимания или развивай аспект упражнения.',p=>p.exerciseAspect||p.marks.has('ascent-body')],
        ['Дальний переход','Продолжай ходить и записывать шаги изо дня в день.',p=>p.marks.has('ascent-walk')],
        ['Сила под сводами','',p=>p.rank>=6&&p.advancedExercise,true]
      ] },
    { id:'will', label:'ВОЛЯ', color:'#e7c27e', glyph:'M0-10L7 0 0 10-7 0ZM0-4V4',
      labelAt:[314,81], points:[[227,168],[270,141],[311,113]], nodes:[
        ['Своя воля','Сохраняй ежедневный ритм или продвигайся в «Разрыве Оков».',p=>p.marks.has('ascent-rhythm')||p.marks.has('chains-first')],
        ['Несбитый ритм','Продвинься в «Разрыве Оков» или укрепи свой режим питания.',p=>p.chainsAspect||p.marks.has('ascent-diet')],
        ['Свобода среди руин','',p=>p.marks.has('ascent-chains')||p.marks.has('chains-free'),true]
      ] },
    { id:'mind', label:'РАЗУМ', color:'#bdb0fb', glyph:'M-8-7H-2L0-4 2-7H8V6H2L0 9-2 6H-8ZM0-4V9',
      labelAt:[297,337], points:[[217,229],[251,267],[285,305]], nodes:[
        ['Ученик архива','Регулярно отмечай занятия английским или открой учебный аспект.',p=>p.studyAspect||p.marks.has('ascent-study')],
        ['Собственная формула','Наладь выполнение своих ежедневных и еженедельных дел Кузницы.',p=>p.marks.has('ascent-forge')],
        ['Имя на корешке','Сохрани завершённую долгосрочную цель и достигни пятого ранга.',p=>p.rank>=5&&p.marks.has('ascent-goal')]
      ] },
    { id:'path', label:'ПУТЬ', color:'#9cdbbf', glyph:'M-7 8L0-8 7 8M-4 3H4M-7 8H7',
      labelAt:[63,337], points:[[143,229],[109,267],[75,305]], nodes:[
        ['След на дороге','Сохраняй ежедневный ритм или достигни третьего ранга.',p=>p.rank>=3||p.marks.has('ascent-rhythm')],
        ['Дальний рубеж','Отметь долгосрочную цель выполненной и собери не менее десяти достижений.',p=>p.marks.size>=10&&p.marks.has('ascent-goal')],
        ['След сквозь туман','',p=>p.rank>=7&&p.marks.size>=20,true]
      ] },
    { id:'citadel', label:'ЦИТАДЕЛЬ', color:'#92cbe8', glyph:'M-8 8V-6H-4V-1H-2V-8H2V-1H4V-6H8V8ZM-2 8V3H2V8',
      labelAt:[48,81], points:[[133,168],[90,141],[49,113]], nodes:[
        ['Оживший камень','Выполни первое улучшение комнаты Цитадели.',p=>p.marks.has('rebuild01')],
        ['Свет в окнах','Продолжай обустраивать разные комнаты Цитадели.',p=>p.marks.has('rebuild03')],
        ['Над всеми башнями','',p=>p.marks.has('ascent-citadel')||p.marks.has('rebuild11'),true]
      ] }
  ];
  const center = [180,194];
  const valid = value => Number.isFinite(value) && value > 0;
  const nodeId = (branch, index) => branch.id+'-'+(index+1);
  function reached(ledger, progress) {
    const fresh = [];
    for (const branch of branches) {
      for (const [index, node] of branch.nodes.entries()) {
        const id = nodeId(branch,index);
        if (valid(ledger?.nodes?.[id])) continue;
        if (!node[2](progress)) break;
        fresh.push(id);
      }
    }
    return fresh;
  }
  function reconcile(tx, progress, now) {
    if (!valid(now)) return [];
    const old = tx.get(path);
    const fresh = reached(old,progress);
    if (!fresh.length) return fresh;
    const nodes = {...old?.nodes};
    for (const id of fresh) nodes[id]=now;
    tx.set(path,{...old,version:1,nodes});
    return fresh;
  }
  function merge(a,b) {
    const nodes = {...a?.nodes,...b?.nodes};
    for (const id of Object.keys(nodes)) {
      const dates=[a?.nodes?.[id],b?.nodes?.[id]].filter(valid);
      if (dates.length) nodes[id]=Math.min(...dates);
    }
    return {...a,...b,version:1,nodes};
  }
  function view(ledger, progress) {
    return branches.map(branch=>{
      let previous = true;
      const nodes = branch.nodes.map(([name,description,test,hidden],index)=>{
        const id = nodeId(branch,index), at = ledger?.nodes?.[id], open = valid(at);
        const state = open?'open':previous?'next':'locked';
        previous = open;
        const sealed = hidden&&!open;
        return {id,at:open?at:null,state,point:branch.points[index],name:sealed?'Тайна Заклятия':name,
          description:sealed?'Камень откроет своё имя, когда придёт время.':description||'Заклятие сохранило этот рубеж.',
          ready:!sealed&&!open&&state==='next'&&test(progress)};
      });
      return {id:branch.id,label:branch.label,color:branch.color,glyph:branch.glyph,labelAt:branch.labelAt,nodes};
    });
  }

  const svgElement = (tag,attrs={})=>{
    const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    return node;
  };
  function mount(dialog) {
    const map = dialog.querySelector('svg'), stage=map.querySelector('.ascension-stage');
    const title=dialog.querySelector('.ascension-node-title'), description=dialog.querySelector('.ascension-node-detail');
    const counter=dialog.querySelector('.ascension-counter'), state=dialog.querySelector('.ascension-node-state');
    let x=0,y=0,scale=1,rows=[],selected='',signature='',suppressClick=false;
    const pointers = new Map();
    function camera(nx,ny,nz) {
      scale=Math.max(1,Math.min(2.6,nz));
      const min=360*(1-scale);
      x=Math.max(min,Math.min(0,nx));y=Math.max(min,Math.min(0,ny));
      stage.setAttribute('transform',`translate(${x} ${y}) scale(${scale})`);
    }
    function zoom(factor,at=center,target=at) {
      const ratio=Math.max(1,Math.min(2.6,scale*factor))/scale;
      camera(target[0]-(at[0]-x)*ratio,target[1]-(at[1]-y)*ratio,scale*ratio);
    }
    function point(event) {
      const value = map.createSVGPoint();
      value.x=event.clientX;value.y=event.clientY;
      const local=value.matrixTransform(map.getScreenCTM().inverse());
      return [local.x,local.y];
    }
    function gesture() {
      const [a,b]=pointers.values();
      if (!b) return {at:a,distance:0};
      return {at:[(a[0]+b[0])/2,(a[1]+b[1])/2],distance:Math.hypot(a[0]-b[0],a[1]-b[1])};
    }
    map.addEventListener('pointerdown',event=>{
      if(event.button!==0||pointers.size>=2)return;
      if(!pointers.size)suppressClick=false;
      pointers.set(event.pointerId,point(event));
      if(pointers.size===2)suppressClick=true;
      event.target.setPointerCapture(event.pointerId);
    });
    map.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId))return;
      const before=gesture(), next=point(event);
      if(!suppressClick&&Math.hypot(next[0]-before.at[0],next[1]-before.at[1])<5)return;
      suppressClick=true;pointers.set(event.pointerId,next);
      const after=gesture();
      const factor=before.distance&&after.distance?after.distance/before.distance:1;
      zoom(factor,before.at,after.at);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      map.addEventListener(type,event=>pointers.delete(event.pointerId));
    }
    map.addEventListener('wheel',event=>{
      event.preventDefault();
      zoom(event.deltaY<0?1.12:1/1.12,point(event));
    },{passive:false});
    dialog.querySelector('[data-ascension-zoom="in"]').onclick=()=>zoom(1.25);
    dialog.querySelector('[data-ascension-zoom="out"]').onclick=()=>zoom(1/1.25);
    dialog.querySelector('[data-ascension-zoom="reset"]').onclick=()=>camera(0,0,1);
    function select(id) {
      selected=id;
      const branch=rows.find(row=>row.nodes.some(node=>node.id===id));
      const node=branch?.nodes.find(node=>node.id===id);
      title.textContent=node?.name||'Печать Восхождения';
      description.textContent=node?.description||'Выбери печать на карте, чтобы рассмотреть её. Узлы загораются по мере твоего продвижения.';
      state.textContent=node?(node.state==='open'?'ОТКРЫТО':node.ready?'ГОТОВО К ОТКРЫТИЮ':node.state==='next'?'СЛЕДУЮЩИЙ УЗЕЛ':'ЗАКРЫТО'):'ПЯТЬ НАПРАВЛЕНИЙ';
      state.style.color=branch?.color||'';
      stage.querySelectorAll('[role="button"]').forEach(element=>element.setAttribute('aria-pressed',String(element.dataset.node===id)));
    }
    function render(next) {
      const stamp=JSON.stringify(next);
      if(stamp===signature)return;
      const previouslyOpen=new Set(rows.flatMap(branch=>branch.nodes.filter(node=>node.at).map(node=>node.id)));
      const animate=dialog.open&&rows.length>0;
      signature=stamp;rows=next;
      const focused=stage.contains(document.activeElement)?document.activeElement.dataset.node:null;
      stage.replaceChildren(svgElement('circle',{cx:180,cy:194,r:121,class:'ascension-ring'}),svgElement('circle',{cx:180,cy:194,r:93,class:'ascension-ring inner'}));
      const hub=svgElement('g',{class:'ascension-hub',transform:'translate(180 194)'});
      hub.append(svgElement('path',{d:'M0-24L20-12V12L0 24-20 12V-12Z'}),svgElement('path',{d:'M0-13L10 0 0 13-10 0ZM0-6V6'}));
      stage.append(hub);
      let open=0;
      for(const branch of rows){
        const group=svgElement('g');
        group.style.setProperty('--branch',branch.color);
        let from=center;
        for(const {point,state} of branch.nodes){
          const [ax,ay]=from,[bx,by]=point;
          group.append(svgElement('path',{class:'ascension-link '+state,d:`M${ax} ${ay}L${(ax+bx)/2} ${ay+(by-ay)*.35}L${bx} ${by}`}));
          from=point;
        }
        const label=svgElement('text',{x:branch.labelAt[0],y:branch.labelAt[1],class:'ascension-label'});
        label.textContent=branch.label;group.append(label);
        for(const node of branch.nodes){
          if(node.at)open++;
          const seal=svgElement('g',{transform:`translate(${node.point.join(' ')})`,role:'button',tabindex:0,
            'aria-label':branch.label+' · '+node.name,class:'ascension-seal '+node.state+(node.ready?' ready':'')+
              (animate&&node.at&&!previouslyOpen.has(node.id)?' fresh':'')});
          seal.dataset.node=node.id;
          seal.append(svgElement('circle',{r:27,class:'ascension-hit'}),svgElement('path',{d:'M0-17L13-11 16 0 13 11 0 17-13 11-16 0-13-11Z',class:'ascension-stone'}),
            svgElement('path',{d:node.state==='locked'?'M-4-1H4V6H-4ZM-2-1V-5H2V-1':branch.glyph,class:'ascension-glyph'}));
          seal.addEventListener('click',()=>{if(!suppressClick)select(node.id);});
          seal.addEventListener('keydown',event=>{
            if(event.key==='Enter'||event.key===' '){event.preventDefault();select(node.id);}
          });
          group.append(seal);
        }
        stage.append(group);
      }
      counter.textContent=open+' / '+rows.reduce((sum,branch)=>sum+branch.nodes.length,0);
      select(selected);
      if(focused)stage.querySelector('[data-node="'+focused+'"]')?.focus({preventScroll:true});
    }
    dialog.addEventListener('close',()=>{pointers.clear();suppressClick=false;});
    return {render};
  }
  root.VkachAscension = Object.freeze({path,reached,reconcile,merge,view,mount});
})(globalThis);
