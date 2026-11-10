/* A weather event belongs to the world, never to a save or a room. */
(function (root) {
  'use strict';

  const minute = 60_000;
  const events = {
    clear:       {label:'Ясное небо', weight:23, levels:[1]},
    clouds:      {label:'Облачность', weight:16, levels:[1,2,3]},
    drizzle:     {label:'Лёгкий дождь', weight:12, levels:[1,2]},
    downpour:    {label:'Сильный дождь', weight:8, levels:[2,3]},
    thunder:     {label:'Гроза', weight:5, levels:[1,2,3]},
    flurries:    {label:'Лёгкий снег', weight:9, levels:[1,2]},
    snowfall:    {label:'Снегопад', weight:8, levels:[2,3]},
    blizzard:    {label:'Метель', weight:4, levels:[2,3]},
    fog:         {label:'Густой туман', weight:9, levels:[1,2,3]},
    'spellstorm':{label:'Магическая буря', weight:2, levels:[1,2,3]}
  };
  const phases={morning:'УТРО',day:'ДЕНЬ',evening:'ВЕЧЕР',night:'НОЧЬ'};
  const storageKey = () => root.PLAN_CONFIG?.testMode ? 'plan.android-test.world-weather.v1' : 'plan.world-weather.v1';
  function phaseAt(now) {
    const hour=new Date(now).getHours();
    return hour<6||hour>=23?'night':hour<12?'morning':hour<18?'day':'evening';
  }

  function valid(event) {
    return event?.version===1 && typeof event.id==='string' && /^[a-z0-9-]{1,90}$/.test(event.id) &&
      Object.hasOwn(events,event.type) && events[event.type].levels.includes(event.intensity) &&
      Number.isSafeInteger(event.startedAt) && Number.isSafeInteger(event.endsAt) &&
      event.endsAt-event.startedAt>=15*minute && event.endsAt-event.startedAt<=45*minute;
  }
  const active=(event,now)=>valid(event)&&event.startedAt<=now&&event.endsAt>now;

  function draw(startedAt, random = Math.random, lastType, length) {
    const entries=Object.entries(events).filter(([type])=>type!==lastType);
    let ticket=random()*entries.reduce((sum,[,entry])=>sum+entry.weight,0);
    const [type,entry]=entries.find(([,row])=>(ticket-=row.weight)<0) || entries.at(-1);
    const intensity=entry.levels[Math.floor(random()*entry.levels.length)];
    const duration=length??(15+Math.floor(random()*31))*minute;
    return {version:1,id:'w-'+startedAt.toString(36)+'-'+Math.floor(random()*0x100000000).toString(36),
      type,intensity,startedAt,endsAt:startedAt+duration};
  }

  function seeded(seed) {
    return () => {
      seed=(seed+0x6d2b79f5)|0;
      let value=Math.imul(seed^(seed>>>15),seed|1);
      value^=value+Math.imul(value^(value>>>7),value|61);
      return ((value^(value>>>14))>>>0)/0x100000000;
    };
  }

  // A shared UTC schedule keeps file previews and browsers without Web Locks in agreement.
  function scheduled(now) {
    const hour=Math.floor(now/(60*minute));
    const start=hour*60*minute;
    const split=(15+Math.floor(seeded(hour)()*31))*minute;
    const first=draw(start,seeded(hour*2+17231),null,split);
    return now<first.endsAt?first:draw(first.endsAt,seeded(hour*2+17232),first.type,60*minute-split);
  }

  function start(onUpdate) {
    const key=storageKey();
    let timer=0, pending=null, current='', stopped=false, request=0;
    function read() {
      try {const event=JSON.parse(root.localStorage.getItem(key));return valid(event)?event:null;}
      catch (_) {return null;}
    }
    function persist(event) {
      try {root.localStorage.setItem(key,JSON.stringify(event));return true;}
      catch (_) {return false;}
    }
    function fallback() {
      const now=Date.now(), saved=read();
      if(active(saved,now))return saved;
      const event=scheduled(now);
      persist(event);
      return event;
    }
    async function acquire() {
      try {
        if(root.navigator?.locks?.request)return await root.navigator.locks.request(key,()=>{
          const now=Date.now(), saved=read();
          if(active(saved,now))return saved;
          const event=draw(now,Math.random,saved?.type);
          return persist(event)?event:scheduled(now);
        });
      } catch (_) { /* Local schedule also works if the lock is unavailable. */ }
      return fallback();
    }
    async function refresh() {
      const ticket=++request;
      clearTimeout(timer);
      const saved=read(), now=Date.now();
      const event=active(saved,now)?saved:await (pending??=acquire().finally(()=>{pending=null;}));
      if(stopped||ticket!==request)return;
      const at=Date.now(), phase=phaseAt(at), stamp=event.id+'|'+phase;
      if(current!==stamp){
        current=stamp;
        onUpdate(event,phase);
      }
      if(!root.document.hidden){
        const nextMinute=(Math.floor(at/minute)+1)*minute;
        timer=setTimeout(refresh,Math.max(1,Math.min(event.endsAt,nextMinute)-at));
      }
    }
    const onStorage=event=>{if(event.key===key||event.key===null)refresh();};
    root.addEventListener('storage',onStorage);
    root.addEventListener('pageshow',refresh);
    root.document.addEventListener('visibilitychange',refresh);
    refresh();
    return ()=>{
      stopped=true;
      clearTimeout(timer);
      root.removeEventListener('storage',onStorage);
      root.removeEventListener('pageshow',refresh);
      root.document.removeEventListener('visibilitychange',refresh);
    };
  }

  function mount(surfaces) {
    const layers=Array.from(surfaces,surface=>{
      const slots=[0,1].map(()=>{
        const layer=root.document.createElement('div');
        layer.className='world-weather-slot';
        const particles=root.document.createElement('div');
        particles.className='world-weather-particles';
        layer.append(particles);
        surface.append(layer);
        return layer;
      });
      return slots;
    });
    let previous='', slot=0;
    return (event)=>{
      if(previous===event.id)return;
      previous=event.id;
      slot=1-slot;
      for(const pair of layers){
        const layer=pair[slot];
        layer.dataset.kind=event.type;
        layer.dataset.intensity=event.intensity;
        layer.style.setProperty('--weather-offset',-(Math.max(0,Date.now()-event.startedAt)%12000)+'ms');
        pair[1-slot].classList.remove('is-current');
        layer.classList.add('is-current');
      }
    };
  }

  root.CitadelWeather=Object.freeze({active,draw,mount,phaseAt,phaseLabel:phase=>phases[phase],label:type=>events[type]?.label,scheduled,start});
})(globalThis);
