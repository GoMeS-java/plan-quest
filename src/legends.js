/* Private rule definitions. Diagnostics must report only aggregate checks. */
(function(root){
 'use strict';
 var definitions=[
  {id:'echo01',name:'Хранящий тишину',phrase:'Камень запомнил то, чего не слышал никто.',color:'#b6a1e5',motif:0,room:'rest',object:'Печать безмолвия',atmosphere:'Сумеречный свет',aura:'Тихий ореол',reaction:'Даже камень теперь узнаёт твой шаг.',test:function(s){return s.care>=83&&s.home>=31&&s.english>=47;}},
  {id:'echo02',name:'Нить сквозь сумрак',phrase:'То, что повторялось в тишине, стало частью мира.',color:'#77c4c6',motif:1,room:'study',object:'Памятная нить',atmosphere:'Свет памяти',aura:'Искры памяти',reaction:'В этих стенах осталась память о твоём пути.',test:function(s){return s.english>=137&&s.recon>=97&&s.cook>=61;}},
  {id:'echo03',name:'Несущий рассвет',phrase:'Ночь отступает перед тем, кто продолжает путь.',color:'#e4ba76',motif:2,room:'gatehouse',object:'Осколок рассвета',atmosphere:'Янтарный отсвет',aura:'Знак рассвета',reaction:'Свет здесь изменился. Ты тоже это заметил?',test:function(s){return s.care>=191&&s.english>=173&&s.home>=73&&s.recon>=151;}}
 ];
 function facts(days,today,spont){
  var s={care:0,english:0,recon:0,cook:0,home:0};
  days.forEach(function(d){if(!/^\d{4}-\d\d-\d\d$/.test(d.id)||d.id>today)return;var q=d.q||[];if(q[4]&&q[6])s.care++;if(q[7])s.english++;if(q[9])s.recon++;if(q[3])s.cook++;});
  spont.forEach(function(d){if(d.done&&d.date&&d.date<=today)s.home++;});return s;
 }
 function find(id){return definitions.find(function(d){return d.id===id;});}
 function valid(record,id){return !!(find(id)&&record&&record.version===1&&Number.isFinite(record.at)&&record.at>0);}
 function earned(ledger){var a=ledger&&ledger.unlocked||{};return Object.keys(a).filter(function(id){return valid(a[id],id);}).map(function(id){return Object.assign({},find(id),{at:a[id].at,presented:!!a[id].presented});});}
 function reconcile(tx,today,now){
  var old=tx.get('cfg/legends')||{},unlocked=Object.assign({},old.unlocked||{}),s=facts(tx.list('days'),today,tx.list('spont')),added=[];
  definitions.forEach(function(d){if(!Object.prototype.hasOwnProperty.call(unlocked,d.id)&&d.test(s)){unlocked[d.id]={version:1,at:now,presented:false};added.push(d.id);}});
  if(added.length)tx.set('cfg/legends',Object.assign({},old,{version:1,unlocked:unlocked,active:old.active===undefined?added[0]:old.active}));return added;
 }
 // Optional 1.0 teaching state. No install/update trigger in this release.
 var Awakening=Object.freeze({version:1,steps:Object.freeze(['welcome','hero','tasks','finance','citadel','backup','context']),initial:function(){return {version:1,status:'idle',step:0};},transition:function(state,action){var n=Object.assign({},state||this.initial());if(action==='start'||action==='replay'){n.status='active';n.step=0;}else if(action==='skip')n.status='skipped';else if(action==='next'&&n.status==='active'){n.step=Math.min(this.steps.length,n.step+1);if(n.step===this.steps.length)n.status='complete';}return n;}});
 root.VkachLegends=Object.freeze({earned:earned,reconcile:reconcile,Awakening:Awakening});
})(typeof window==='undefined'?globalThis:window);
