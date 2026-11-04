/* Personal Forge discoveries. Only earned receipts are returned to the UI. */
(function(root){
  'use strict';
  var path='cfg/forge-discoveries';
  var taskId=/^custom-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  var receiptId=/^forge-custom-[a-f0-9-]{36}-[123]$/i;
  var names=['Первый след','Свой ритм','Закалённый путь'];
  var rarities=['mark','rare','superrare'];
  function civil(s){
    if(typeof s!=='string'||!/^\d{4}-\d\d-\d\d$/.test(s))return NaN;
    var t=Date.parse(s+'T00:00:00Z');
    return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s?t:NaN;
  }
  function week(t){return t-((new Date(t).getUTCDay()+6)%7)*86400000;}
  function hash(text){
    var h=2166136261;for(var i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
    return h>>>0;
  }
  function valid(id,row){
    return receiptId.test(id)&&row&&Number.isFinite(civil(row.date))&&typeof row.task==='string'&&row.task.length>0&&row.task.length<=80;
  }
  function owned(ledger){
    return Object.entries(ledger?.unlocked||{}).filter(([id,row])=>valid(id,row)).map(([id,row])=>{
      var level=Number(id.slice(-1)),seed=hash(id);
      return {id:id,date:row.date,kind:rarities[level-1],name:names[level-1],task:row.task,
        background:level===3&&seed%4!==0?'fg-'+id.slice(13,-2):'',seed:seed,presented:!!row.presented};
    });
  }
  function evidence(task,rows,today){
    var dates=[],revisions=task.revisions;
    rows.forEach(record=>{
      var date=civil(record.id);
      if(!Number.isFinite(date)||date>today||task.kind==='weekly'&&week(date)!==date)return;
      var rule=revisions.findLast(r=>Number.isFinite(civil(r.from))&&civil(r.from)<=date);
      if(!rule||rule.archived)return;
      var mark=record.forgeDone?.[task.id];
      if(task.kind==='weekly'){
        var written=civil(mark);
        if(!Number.isFinite(written)||written>today||week(written)!==date)return;
        dates.push(written);return;
      }
      var anchor=civil(rule.anchor||rule.from);
      if(mark===true&&(rule.schedule!=='alternate'||Number.isFinite(anchor)&&(date-anchor)/86400000%2===0))dates.push(date);
    });
    return [...new Set(dates)].sort((a,b)=>a-b);
  }
  function pending(tx,date){
    var today=civil(date),old=tx.get(path)||{},flags=old.unlocked||{},result={};
    if(!Number.isFinite(today))return result;
    var tasks=tx.list('forge-tasks').filter(t=>taskId.test(t.id)&&['daily','weekly'].includes(t.kind)&&Array.isArray(t.revisions));
    if(!tasks.length)return result;
    var rows={daily:tx.list('days'),weekly:tx.list('weeks')};
    tasks.forEach(task=>{
      var rule=task.revisions.findLast(r=>civil(r.from)<=today);
      if(!rule||rule.archived||typeof rule.title!=='string'||!rule.title.trim()||rule.title.length>80)return;
      var dates=evidence(task,rows[task.kind],today),weeks=new Set(dates.map(week));
      var span=dates.length?(dates.at(-1)-dates[0])/86400000:0;
      var checkpoints=task.kind==='weekly'?[dates.length>=2,dates.length>=6&&span>=35,dates.length>=20&&span>=133]:
        [dates.length>=3&&span>=4,dates.length>=15&&weeks.size>=5&&span>=28,dates.length>=48&&weeks.size>=16&&span>=105];
      checkpoints.forEach((reached,index)=>{
        var id='forge-'+task.id+'-'+(index+1);
        if(reached&&!valid(id,flags[id]))result[id]={date:date,task:rule.title,presented:false};
      });
    });
    return result;
  }
  function merge(a,b){
    a=a||{};b=b||{};
    var unlocked={...a.unlocked,...b.unlocked};
    Object.keys(unlocked).forEach(id=>{
      var x=a.unlocked?.[id],y=b.unlocked?.[id];
      if(valid(id,x)&&valid(id,y)){
        var preferred=x.date<y.date||x.date===y.date&&x.task<=y.task?x:y;
        unlocked[id]={...preferred,presented:!!(x.presented||y.presented)};
      }else if(valid(id,x))unlocked[id]=x;
    });
    return {...a,...b,unlocked:unlocked};
  }
  function claim(tx,date){
    var old=tx.get(path)||{},ledger={...old,unlocked:{...old.unlocked,...pending(tx,date)}};
    var fresh=owned(ledger).filter(row=>!row.presented);
    if(fresh.length){
      fresh.forEach(row=>{ledger.unlocked[row.id]={...ledger.unlocked[row.id],presented:true};});
      tx.set(path,ledger);
    }
    return fresh;
  }
  root.VkachForgeAwards=Object.freeze({path,owned,merge,claim,needs:function(tx,date){return owned(tx.get(path)).some(row=>!row.presented)||Object.keys(pending(tx,date)).length>0;}});
})(globalThis);
