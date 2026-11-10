/* Private 1.1 discovery rules. UI receives earned rows only. No currency rewards. */
(function(root){
 'use strict';
 var rooms=['rest','throne','study','archive','forge','observatory','gatehouse','refectory','cloister','vault'];
 var clothing={
  rw_knit:{slot:'top',shape:'knit',name:'Свитер хранителя',c:{base:'#456e73',alt:'#75a4a2',shade:'#29484f'},reward:'rebuild'},
  rw_coat:{slot:'outer',shape:'coat',name:'Пальто зодчего',c:{base:'#504066',alt:'#77618e',shade:'#30273f',btn:'#d1b37a'},reward:'rebuild'},
  rw_memory:{slot:'outer',shape:'plaid',name:'Куртка летописца',c:{base:'#c2c5cd',gray:'#65758a',dark:'#394459',tan:'#b99465',collar:'#232839',collar2:'#485265',edge:'#718099',btn:'#c9ab72'},reward:'rebuild'}
 };
 var defs=[
  {id:'rebuild01',name:'Первый положенный камень',title:'НАЧИНАЮЩИЙ ЗОДЧИЙ',test:s=>s.upgrades>=1},
  {id:'rebuild02',name:'Комната обрела голос',title:'МАСТЕР ПОКОЕВ',test:s=>s.finished>=1},
  {id:'rebuild03',name:'Соседние огни',title:'СОБИРАТЕЛЬ ОЧАГОВ',test:s=>s.rooms>=3},
  {id:'rebuild04',name:'Личная печать',title:'ХРАНИТЕЛЬ УЮТА',test:s=>s.decor>=3&&s.active>=7},
  {id:'rebuild05',name:'Надёжная оболочка',title:'СОБРАННЫЙ В ПУТЬ',clothes:'rw_knit',test:s=>s.dressed&&s.active>=14},
  {id:'rebuild06',name:'Собственный почерк',title:'МЕСТНЫЙ МОДЕЛЬЕР',test:s=>s.customEquipped&&s.active>=14},
  {id:'rebuild07',name:'Не прерывая запись',title:'НАБЛЮДАТЕЛЬ ПЕРЕМЕН',test:s=>s.weightWeeks>=4&&s.active>=14},
  {id:'rebuild08',name:'Три следа на камне',title:'СМОТРИТЕЛЬ ВИТРИНЫ',test:s=>s.showcase===3&&s.title&&s.active>=14},
  {id:'rebuild09',name:'Дело тяжелее слов',title:'ДЕРЖАЩИЙ СЛОВО',test:s=>s.heavy>=5&&s.active>=14},
  {id:'rebuild10',name:'Единый образ',title:'УЗНАВАЕМЫЙ',test:s=>s.appearance===3&&s.dressed&&s.active>=30},
  {id:'rebuild11',name:'Огни всех крыльев',title:'ХРАНИТЕЛЬ ДЕСЯТИ ОЧАГОВ',kind:'superrare',cos:['fr_rebuilt'],test:s=>s.rooms===10&&s.active>=30},
  {id:'rebuild12',name:'Замок, который помнит',title:'ЗОДЧИЙ ВОЗВРАЩЕНИЯ',kind:'superrare',cos:['b_rebuilt','au_rebuilt'],clothes:'rw_coat',test:s=>s.finished===10&&s.active>=90},
  {id:'rebuild13',name:'Звёзды над летописью',title:'СОХРАНИВШИЙ СВЕТ',kind:'superrare',cos:['b_stillnight','fr_constellation'],test:s=>s.rooms>=6&&s.showcase===3&&s.active>=60&&s.steps>=180000},
  {id:'rebuild14',name:'Нить долгого пути',title:'ЛЕТОПИСЕЦ ВОЗВРАЩЕНИЯ',kind:'superrare',cos:['au_memory'],clothes:'rw_memory',test:s=>s.rooms>=6&&s.weightWeeks>=12&&s.active>=60&&s.heavy>=12},
  {id:'refectory01',name:'Первая трапеза',title:'ХРАНИТЕЛЬ ТРАПЕЗЫ',test:s=>s.foodDays>=1},
  {id:'refectory02',name:'Хлеб насущный',title:'ЛЕТОПИСЕЦ ТРАПЕЗ',kind:'rare',test:s=>s.foodDays>=7},
  {id:'refectory03',name:'Привычка у очага',title:'ВЕРНЫЙ РИТМУ',kind:'rare',test:s=>s.foodDays>=30}
 ];
 function day(k,today){return typeof k==='string'&&/^\d{4}-\d\d-\d\d$/.test(k)&&k<=today&&Number.isFinite(Date.parse(k))&&new Date(k+'T12:00:00Z').toISOString().slice(0,10)===k;}
 function valid(r){return r&&r.version===1&&Number.isFinite(r.at)&&r.at>0;}
 function owned(ledger){var flags=ledger&&ledger.unlocked||{};return defs.filter(d=>Object.prototype.hasOwnProperty.call(flags,d.id)&&valid(flags[d.id])).map(d=>({id:d.id,name:d.name,title:d.title,kind:d.kind||'mark',cos:d.cos||[],clothes:d.clothes||'',at:flags[d.id].at,presented:!!flags[d.id].presented}));}
 function facts(tx,today,proof){
  proof=proof||{};var s={upgrades:0,rooms:0,finished:0,decor:0,active:0,steps:0,heavy:0,weightWeeks:0,foodDays:0,showcase:0,title:false,appearance:0,dressed:false,customEquipped:false},renovated={},weeks={};
  tx.list('buys').forEach(r=>{if(r.kind!=='citadel-room'||r.currency!=='abyss'||rooms.indexOf(r.room)<0||![2,3].includes(r.level)||!(r.cost>0)||r.id!=='citadel-'+r.room+'-'+r.level||!Number.isFinite(r.ts)||r.ts<=0||!Number.isFinite(new Date(r.ts).getTime())||!day(new Date(r.ts).toISOString().slice(0,10),today))return;s.upgrades++;renovated[r.room]=Math.max(renovated[r.room]||1,r.level);});
  s.rooms=Object.keys(renovated).length;s.finished=Object.values(renovated).filter(v=>v===3).length;
  tx.list('days').forEach(r=>{if(!day(r.id,today))return;if(Array.isArray(r.q)&&r.q.some(v=>v===true))s.active++;if(Number.isFinite(r.steps)&&r.steps>0)s.steps+=r.steps;});
  tx.list('spont').forEach(r=>{if(r.done===true&&r.heavy===true&&day(r.date,today))s.heavy++;});
  tx.list('weights').forEach(r=>{if(!(Number(r.kg)>30&&Number(r.kg)<400)||!day(r.date,today))return;var dt=new Date(r.date+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()-(dt.getUTCDay()+6)%7);weeks[dt.toISOString().slice(0,10)]=true;});s.weightWeeks=Object.keys(weeks).length;
  // Count completed and still-present meals, not drafts, taps or deleted records.
  var foodDates=new Set();tx.list('food-meals').forEach(r=>{if(r.deleted!==false||!day(r.date,today)||!Array.isArray(r.items)||!r.items.length)return;foodDates.add(r.date);});s.foodDays=foodDates.size;
  var decor=(tx.get('cfg/citadel')||{}).decor||{};rooms.forEach(r=>{if(['banner','lantern','crystal','tapestry'].includes(decor[r]))s.decor++;});
  var wardrobe=tx.list('wardrobe'),outfit=tx.get('cfg/outfit')||{},lookup={};wardrobe.forEach(r=>lookup[r.id]=r);
  s.dressed=['coat_camel','jacket_black','puffer_black','plaid_sherpa'].includes(outfit.outer)||!!(lookup[outfit.outer]&&lookup[outfit.outer].slot==='outer');
  s.customEquipped=['top','bottom','outer'].some(slot=>lookup[outfit[slot]]&&lookup[outfit[slot]].slot===slot&&!lookup[outfit[slot]].reward);
  var look=tx.get('cfg/look')||{},marks=new Set((proof.marks||[]).concat(owned(tx.get('cfg/realm-achievements')).map(r=>r.id))),cos=new Set(proof.cos||[]);
  s.showcase=new Set((Array.isArray(look.showcase)?look.showcase:[]).filter(id=>marks.has(id))).size;s.title=marks.has(look.title);
  ['bg','aura','frame'].forEach(cat=>{if(cos.has(look[cat]))s.appearance++;});return s;
 }
 function reconcile(tx,today,now,proof){
  if(!Number.isFinite(now)||now<=0)return [];
  var old=tx.get('cfg/realm-achievements')||{},unlocked=Object.assign({},old.unlocked||{}),s=facts(tx,today,proof),added=[];
  defs.forEach(d=>{if(!valid(unlocked[d.id])&&d.test(s)){unlocked[d.id]={version:1,at:now,presented:false};added.push(d.id);}});
  if(added.length)tx.set('cfg/realm-achievements',Object.assign({},old,{version:1,unlocked}));
  owned({unlocked}).forEach(d=>{if(d.clothes&&!tx.get('wardrobe/'+d.clothes))tx.set('wardrobe/'+d.clothes,Object.assign({ts:now},clothing[d.clothes]));});return added;
 }
 function merge(a,b){a=a||{};b=b||{};var unlocked=Object.assign({},a.unlocked||{},b.unlocked||{});Object.keys(unlocked).forEach(id=>{var x=a.unlocked&&a.unlocked[id],y=b.unlocked&&b.unlocked[id];if(valid(x)&&valid(y))unlocked[id]=Object.assign({},x,y,{at:Math.min(x.at,y.at),presented:!!(x.presented||y.presented)});else if(valid(x))unlocked[id]=x;else if(valid(y))unlocked[id]=y;});return Object.assign({},a,b,{version:1,unlocked});}
 function needs(tx,today,proof){var old=tx.get('cfg/realm-achievements')||{},flags=old.unlocked||{},s=facts(tx,today,proof);return defs.some(d=>!valid(flags[d.id])&&d.test(s))||owned(old).some(d=>!d.presented||d.clothes&&!tx.get('wardrobe/'+d.clothes));}
 function claim(tx){var old=tx.get('cfg/realm-achievements')||{},pending=owned(old).filter(d=>!d.presented);if(!pending.length)return [];var unlocked=Object.assign({},old.unlocked);pending.forEach(d=>unlocked[d.id]=Object.assign({},unlocked[d.id],{presented:true}));tx.set('cfg/realm-achievements',Object.assign({},old,{unlocked}));return pending;}
 root.VkachRealm=Object.freeze({owned,reconcile,claim,merge,needs});
})(typeof window==='undefined'?globalThis:window);
