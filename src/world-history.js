/* Dated observations are separate from live records and never award progress. */
(function (root) {
  'use strict';

  const collection='world-history';
  const prefix=collection+'/';
  const budget=320*1024;
  const safeId=/^[a-zA-Z0-9_-]{1,100}$/;
  const validDay=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&
    Number.isFinite(Date.parse(date))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
  const isPath=path=>path.startsWith(prefix)&&validDay(path.slice(prefix.length));
  const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
  const time=value=>Number.isSafeInteger(value)&&value>0&&value<=8_640_000_000_000_000;
  const ids=values=>[...new Set(values.filter(id=>typeof id==='string'&&safeId.test(id)))].sort();
  const validWeight=value=>typeof value==='number'&&Number.isFinite(value)&&value>30&&value<400;
  const encoder=new TextEncoder();
  const snapshotSize=(day,row)=>encoder.encode(JSON.stringify([prefix+day,{d:row,u:row.at}])).byteLength+2;

  function activity(day, daily, exercise, until=Infinity) {
    let sets=0,reps=0;
    for(const key of ['squat','pushup']){
      const entries=Array.isArray(exercise?.[key])?exercise[key]:[];
      const seen=new Set();
      entries.forEach((at,i)=>{
        if(!time(at)||at>until||seen.has(at))return;
        seen.add(at);
        sets++;
        const recorded=count(exercise[key+'R']?.[i]);
        if(recorded)reps+=recorded;
      });
    }
    return {
      date:day,steps:count(daily?.steps),sets,reps,
      tasks:Array.isArray(daily?.q)?daily.q.filter(mark=>mark===true).length:0
    };
  }

  function wardrobeEntry(item,id){
    if(!item||typeof id!=='string'||!safeId.test(id))return null;
    const colors=Object.entries(item.c||{}).filter(([key,color])=>safeId.test(key)&&
      typeof color==='string'&&/^#[0-9a-f]{3,8}$/i.test(color)).sort(([a],[b])=>a.localeCompare(b,'en'));
    return [id,typeof item.shape==='string'&&safeId.test(item.shape)?item.shape:'',Object.fromEntries(colors)];
  }

  const directions=['body','will','mind','path','citadel','capital'];
  function treeState(tree){
    if(!directions.every(id=>Array.isArray(tree?.[id])&&tree[id].length===2&&
      tree[id].every(Number.isInteger)&&tree[id][0]>=0&&tree[id][0]<=12&&tree[id][1]>=0&&tree[id][1]<=4))return null;
    return Object.fromEntries(directions.map(id=>[id,tree[id].slice()]));
  }

  function observation(input) {
    const tree=treeState(input.tree);
    return {
      hero:[count(input.rank),count(input.bodyStage),Math.round(input.shape*1000)],
      rankProgress:input.rankProgress.map(value=>Number.isFinite(value)&&value>=0?value:0),
      clothes:input.clothes.map(([item,id])=>wardrobeEntry(item,id)),
      look:input.look.map(id=>typeof id==='string'&&safeId.test(id)?id:''),
      echo:typeof input.echo==='string'&&safeId.test(input.echo)?input.echo:'',
      rooms:Object.fromEntries(input.rooms),
      interior:input.interior.filter(parts=>parts.every(id=>typeof id==='string'&&safeId.test(id)))
        .sort(([a],[b])=>a.localeCompare(b,'en')),
      seals:ids(input.seals),
      marks:ids(input.marks),
      ...(tree?{tree}:{}),
      activity:[input.activity.steps,input.activity.sets,input.activity.reps,input.activity.tasks],
      weight:validWeight(input.weight?.kg)&&validDay(input.weight.date)?[input.weight.date,input.weight.kg]:null
    };
  }

  function same(row,frame) {
    const version=treeState(frame?.tree)?2:1;
    return row?.version===version&&JSON.stringify(row.frame)===JSON.stringify(frame);
  }

  function capture(tx,day,at,frame) {
    if(!validDay(day)||!time(at))return 'invalid';
    const path=prefix+day, previous=tx.get(path);
    const version=treeState(frame?.tree)?2:1;
    if(previous&&![1,version].includes(previous.version))return 'unsupported';
    if(same(previous,frame))return 'unchanged';
    if(previous&&previous.at>at)return 'unchanged';
    const row={version,at,frame};
    const bytes=tx.list(collection).filter(entry=>validDay(entry.id)&&entry.id!==day)
      .reduce((sum,{id,...entry})=>sum+snapshotSize(id,entry),snapshotSize(day,row));
    if(bytes>budget)return 'full';
    tx.set(path,row);
    return 'saved';
  }

  function stable(value) {
    if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
    if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';
    return JSON.stringify(value);
  }

  // Keep the newest observation whole; combining two half-frames invents a scene.
  function merge(a,b) {
    if(!a||!b)return a||b;
    const av=count(a.version),bv=count(b.version);
    if(av!==bv)return av>bv?a:b;
    const at=time(a.at)?a.at:0,bt=time(b.at)?b.at:0;
    if(at!==bt)return at>bt?a:b;
    return stable(a)>=stable(b)?a:b;
  }

  function join(selected,other) {
    const result={...selected};
    for(const [path,row] of Object.entries(other)){
      if(!isPath(path)||!row.d)continue;
      const current=result[path], preferred=merge(current?.d,row.d);
      if(preferred!==current?.d)result[path]={d:preferred,u:Math.max(current?.u||0,row.u)};
    }
    return result;
  }

  function frames(records) {
    return Object.entries(records).filter(([path,row])=>isPath(path)&&[1,2].includes(row?.d?.version)&&time(row.d.at)&&row.d.frame)
      .map(([path,row])=>({...row.d.frame,date:path.slice(prefix.length),at:row.d.at}))
      .sort((a,b)=>b.date.localeCompare(a.date));
  }

  function timeline(records,marks,today,dateFromTime,now){
    const days=new Map();
    const entry=date=>{
      if(!days.has(date))days.set(date,{date,frame:null,events:[]});
      return days.get(date);
    };
    for(const frame of frames(records))if(frame.date<=today)entry(frame.date).frame=frame;
    for(const event of datedEvents(records,marks,today,dateFromTime,now))entry(event.date).events.push(event);
    return [...days.values()].sort((a,b)=>b.date.localeCompare(a.date));
  }

  function datedEvents(records, marks, today, dateFromTime, now=Date.now()) {
    const events=[];
    function add(id,date,kind,detail) {
      if(validDay(date)&&date<=today)events.push({id,date,kind,...detail});
    }
    for(const [path,row] of Object.entries(records)){
      const item=row?.d;
      if(!item)continue;
      if(path.startsWith('days/')||path.startsWith('per/')){
        const date=path.slice(path.indexOf('/')+1);
        if(path.startsWith('per/')&&records['days/'+date]?.d)continue;
        const detail=activity(date,records['days/'+date]?.d,records['per/'+date]?.d,now);
        if(detail.steps||detail.sets||detail.tasks)add('activity/'+date,date,'activity',detail);
      }else if(path.startsWith('weights/')&&validWeight(Number(item.kg))&&(!time(item.ts)||item.ts<=now)){
        add(path,item.date,'weight',{kg:Number(item.kg)});
      }else if(path.startsWith('buys/citadel-')&&item.kind==='citadel-room'&&(item.level===2||item.level===3)&&
          path==='buys/citadel-'+item.room+'-'+item.level&&safeId.test(item.room)&&time(item.ts)&&item.ts<=now){
        add(path,dateFromTime(item.ts),'room',{room:item.room,level:item.level});
      }else if(path.startsWith('goals/')&&item.done===true&&time(item.completedAt)&&item.completedAt<=now){
        add(path,dateFromTime(item.completedAt),'goal',{});
      }
    }
    for(const [id,at] of Object.entries(records['cfg/ascension']?.d?.nodes||{})){
      if(safeId.test(id)&&time(at)&&at<=now)add('seal/'+id,dateFromTime(at),'seal',{seal:id});
    }
    for(const row of marks){
      if(safeId.test(row.id))add('mark/'+row.id,row.date,'mark',{mark:row.id});
    }
    return events.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  }

  root.VkachWorldHistory=Object.freeze({collection,isPath,activity,observation,same,capture,merge,join,frames,datedEvents,timeline,treeState});
})(globalThis);
