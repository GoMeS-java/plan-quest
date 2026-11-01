/* Private discovery rules. Never log definitions, requirements or future rewards. */
(function(root){
 'use strict';
 var rules=[
  {id:'f01',name:'Компас без звёзд',object:'Компас без звёзд',story:'Север не исчезал. Он ждал, пока ты снова сделаешь шаг.',color:'#86bcc9',motif:0,room:'gatehouse',parts:[['x01','x80'],['x02','x90'],['x03','x81'],['x04','x82']]},
  {id:'f02',name:'Сердце наковальни',object:'Сердце наковальни',story:'В холодном металле осталось тепло твоего упорства.',color:'#dbac78',motif:1,room:'forge',parts:[['x18','x10'],['x19','x97'],['x11','x14'],['x12','x16']]},
  {id:'f03',name:'Лист ненаписанной книги',object:'Лист ненаписанной книги',story:'Знаки сложились в строку. Продолжение ещё принадлежит тебе.',color:'#b5a1df',motif:2,room:'study',parts:[['x105','x106'],['x107','x109'],['x108','x110'],['x108','x111']]},
  {id:'f04',name:'Свет под пеплом',object:'Свет под пеплом',story:'Дом хранит свет даже в те ночи, когда его никто не видит.',color:'#c9bd88',motif:3,room:'rest',parts:[['x73','x75'],['x74','x76'],['x77','x94'],['x99','x104']]},
  {id:'f05',name:'Весы сумерек',object:'Весы сумерек',story:'Не всё, что удерживает равновесие, можно взвесить.',color:'#85b9a6',motif:4,room:'rest',parts:[['x83','x109'],['x84','x110'],['x95','x111'],['x102','x112']]}
 ];
 function rule(id){return rules.find(function(r){return r.id===id;});}
 function valid(p){return p&&p.version===1&&Number.isFinite(p.at)&&p.at>0;}
 function pieces(record){var p=record&&record.pieces||{};return [0,1,2,3].filter(function(n){return valid(p[n]);});}
 function view(id,record){var r=rule(id),found=pieces(record);if(!r||!found.length)return null;var complete=found.length===r.parts.length;
  return {id:id,fate:true,name:complete?r.name:'Неизвестный образ',phrase:complete?r.story:'Края находки отозвались друг другу. В темноте проступило нечто знакомое.',reaction:complete?'В камне отозвалась память о найденном.':'Стены будто ждут продолжения.',color:r.color,motif:r.motif,room:complete?r.room:'rest',object:complete?r.object:'Незавершённый образ',complete:complete,revealed:found,at:Math.min.apply(null,found.map(function(n){return record.pieces[n].at;}))};
 }
 function discovered(ledger){var entries=ledger&&ledger.entries||{};return Object.keys(entries).map(function(id){return view(id,entries[id]);}).filter(Boolean);}
 function reconcile(tx,ach,now){
  if(!Number.isFinite(now)||now<=0)return [];
  var old=tx.get('cfg/fate')||{},entries=Object.assign({},old.entries||{}),added=[];
  rules.forEach(function(r){var prev=entries[r.id]||{},p=Object.assign({},prev.pieces||{}),changed=false;
   r.parts.forEach(function(ids,n){if(!valid(p[n])&&ids.every(function(id){return !!(ach&&ach[id]);})){p[n]={version:1,at:now,presented:false};changed=true;added.push(r.id+':'+n);}});
   if(changed)entries[r.id]=Object.assign({},prev,{pieces:p});
  });
  if(added.length)tx.set('cfg/fate',Object.assign({},old,{version:1,entries:entries,active:old.active===undefined?((tx.get('cfg/legends')||{}).active?'':added[0].split(':')[0]):old.active}));return added;
 }
 function pending(ledger){return discovered(ledger).filter(function(d){return d.revealed.some(function(n){return !ledger.entries[d.id].pieces[n].presented;});});}
 function claim(tx,id){var old=tx.get('cfg/fate')||{},record=old.entries&&old.entries[id],d=view(id,record);if(!d)return null;var before=d.revealed.filter(function(n){return !!record.pieces[n].presented;});if(before.length===d.revealed.length)return null;
  var p=Object.assign({},record.pieces);d.revealed.forEach(function(n){p[n]=Object.assign({},p[n],{presented:true});});
  var entries=Object.assign({},old.entries);entries[id]=Object.assign({},record,{pieces:p});tx.set('cfg/fate',Object.assign({},old,{entries:entries}));return {before:before,after:d.revealed};
 }
 // Grow-only discovery data, including presentation receipts, survives old backups
 // and concurrent devices. Preference follows the chosen snapshot.
 function merge(a,b){a=a||{};b=b||{};var entries=Object.assign({},a.entries||{},b.entries||{});
  Object.keys(entries).forEach(function(id){var left=a.entries&&a.entries[id]||{},right=b.entries&&b.entries[id]||{},p=Object.assign({},left.pieces||{},right.pieces||{});
   Object.keys(p).forEach(function(n){var x=left.pieces&&left.pieces[n],y=right.pieces&&right.pieces[n];if(valid(x)&&valid(y))p[n]=Object.assign({},x,y,{at:Math.min(x.at,y.at),presented:!!(x.presented||y.presented)});else if(valid(x))p[n]=x;});entries[id]=Object.assign({},left,right,{pieces:p});
  });return Object.assign({},a,b,{version:1,entries:entries});
 }
 // Pixel art is drawn under a piece mask; unseen pixels never reach the canvas.
 function draw(canvas,d,revealed){canvas.width=64;canvas.height=64;var c;try{c=canvas.getContext('2d');}catch(e){return;}if(!c)return;c.clearRect(0,0,64,64);var mask=revealed||d.revealed||[];
  for(var y=0;y<32;y++)for(var x=0;x<32;x++){
   var dx=x-15.5,dy=y-15.5,sector=Math.abs(dx)>Math.abs(dy)?(dx<0?0:2):(dy<0?1:3);if(mask.indexOf(sector)<0)continue;
   var ax=Math.abs(dx),ay=Math.abs(dy),ink=false,bright=false;
   if(d.motif===0){ink=Math.abs(ax+ay-12)<1.2||(ax<1&&ay<13)||(ay<1&&ax<13);bright=ax+ay<4;}
   else if(d.motif===1){ink=(y>=11&&y<=16&&x>=5&&x<=26)||(y>=17&&y<=22&&ax<5)||(y>=23&&y<=25&&ax<10);bright=y<14&&x<21;}
   else if(d.motif===2){ink=(x>=8&&x<=24&&y>=5&&y<=26)&&!(x>20&&y<9);bright=(y===11||y===15||y===19||y===23)&&x>=12&&x<=20;}
   else if(d.motif===3){ink=(ax<10&&y>=16&&y<27)||(ay<10&&ax+ay<12&&y<17);bright=y<16&&ax<4||y===20&&ax<7;}
   else {ink=(ax<1&&y>6&&y<26)||(y===9&&ax<12)||(y===25&&ax<7)||(y>=10&&y<19&&(Math.abs(ax-10)<1||y===18&&ax>6));bright=y===9||ax<1;}
   if(ink){c.fillStyle=bright?'#efe1c3':d.color;c.globalAlpha=bright?1:.65+((x+y)%3)*.1;c.fillRect(x*2,y*2,2,2);}
  }c.globalAlpha=1;
 }
 root.VkachFate=Object.freeze({discovered:discovered,reconcile:reconcile,pending:pending,claim:claim,merge:merge,draw:draw});
})(typeof window==='undefined'?globalThis:window);
