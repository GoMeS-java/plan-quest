/* Shared spatial model for the integrated castle. No persistence or rewards. */
(function(root){
 'use strict';
 var floors=[['throne','observatory'],['rest','study'],['archive','forge'],['gatehouse','refectory'],['cloister','vault']];
 var ranks={throne:1,observatory:5,rest:1,study:1,archive:10,forge:15,gatehouse:1,refectory:5,cloister:8,vault:20};
 var names={throne:'Тронный зал',observatory:'Обсерватория',rest:'Личные покои',study:'Кабинет',archive:'Архив',forge:'Мастерская',gatehouse:'Караульная',refectory:'Трапезная',cloister:'Крытая галерея',vault:'Казначейство'};
 var graph={};
 function link(a,b){(graph[a]||(graph[a]=[])).push(b);(graph[b]||(graph[b]=[])).push(a);}
 floors.forEach(function(rooms,i){var hall='hall-'+i;names[hall]=['Верхняя галерея','Жилой коридор','Коридор ремёсел','Вестибюль','Подземный переход'][i];rooms.forEach(function(r){link(r,hall);});if(i)link('hall-'+(i-1),hall);});
 function available(id,rank){return !!graph[id]&&(!ranks[id]||rank>=ranks[id]);}
 function route(from,to,rank){
  if(!available(from,rank)||!available(to,rank))return [];
  var queue=[[from]],seen={};seen[from]=true;
  for(var i=0;i<queue.length;i++){var path=queue[i],last=path[path.length-1];if(last===to)return path;graph[last].forEach(function(n){if(!seen[n]&&available(n,rank)){seen[n]=true;queue.push(path.concat(n));}});}
  return [];
 }
 function position(path,elapsed,step){
  if(!path.length)return null;
  var n=Math.max(0,elapsed/step),i=Math.min(path.length-1,Math.floor(n));
  return {node:path[i],next:path[Math.min(i+1,path.length-1)],fraction:i===path.length-1?0:n-i,moving:i<path.length-1};
 }
 // Destinations are recovered from local civil time, including after a reload.
 // An hourly work errand lasts only a few minutes; no random frame simulation.
 function schedule(person,date,rank){
  var h=date.getHours(),target,activity,line,mode;
  if(h<7||h>=23){target='rest';activity='Отдыхает';line='Тихо, Цитадель спит. Продолжим разговор утром.';mode='rest';}
  else if(h<10){target='study';activity='Планирует день';line='Утренний свет уже в кабинете. Посмотрим, что ждёт сегодня.';mode='work';}
  else if(h<18){target=person.home;activity={guardian:'Проверяет дозор',archivist:'Переписывает летопись',smith:'Работает у горна',treasurer:'Ведёт учёт'}[person.key];line='Дневная работа в самом разгаре.';mode='work';}
  else if(h<21){target='refectory';activity='За вечерним столом';line='Собираемся за столом и обсуждаем день.';mode='social';}
  else {target=person.home;activity='Завершает дела';line='Поздний час. Скоро погасим огни.';mode='work';}
  if(!available(target,rank))target='throne';
  return {room:target,activity:activity,line:line,mode:mode};
 }
 function resident(person,now,rank,index){
  var date=new Date(now),state=schedule(person,date,rank),start=new Date(date),h=date.getHours();
  var boundary=h<7?0:h<10?7:h<18?10:h<21?18:h<23?21:23;
  // Before midnight, both sides of midnight are at rest: no midnight teleport.
  start.setHours(boundary,0,0,0);
  var previous=schedule(person,new Date(start.getTime()-1),rank),from=previous.room,target=state.room;
  var elapsed=now-start.getTime()-(index||0)*2000,path=route(from,target,rank);
  var duration=Math.max(0,path.length-1)*4000;
  // Work errands: inspect gates / carry records / take a meal / report accounts.
  // Start at minute 15, stay briefly at the destination, then return by the same stairs.
  var errands={guardian:'gatehouse',archivist:'study',smith:'refectory',treasurer:'throne'};
  var hourStart=new Date(date);hourStart.setMinutes(15,0,0);
  var errand=errands[person.key],since=now-hourStart.getTime()-(index||0)*2000;
  if(h>=10&&h<18&&available(errand,rank)&&since>=0){
   var outward=route(state.room,errand,rank),travel=Math.max(0,outward.length-1)*4000;
   if(since<travel*2+30000){
    if(since<travel){path=outward;elapsed=since;target=errand;}
    else if(since<travel+30000){path=[errand];elapsed=0;target=errand;state.activity={guardian:'Осматривает ворота',archivist:'Сверяет книгу дня',smith:'Перерыв у очага',treasurer:'Докладывает о казне'}[person.key];state.mode='work';}
    else {path=outward.slice().reverse();elapsed=since-travel-30000;target=state.room;}
   }else {path=[state.room];elapsed=0;}
  }else if(elapsed>=duration){path=[state.room];elapsed=0;}
  var pos=position(path,Math.max(0,elapsed),4000)||position([state.room],0,4000);
  state.destination=target;state.room=pos.node;
  state.node=pos.node;state.next=pos.next;state.fraction=pos.fraction;state.moving=pos.moving;state.path=path;
  if(pos.moving){state.activity='В пути: '+names[target];state.mode='moving';state.line='Иду через '+names[pos.node].toLowerCase()+'. Скоро буду на месте.';}
  return state;
 }
 root.CitadelWorld=Object.freeze({floors:floors,ranks:ranks,names:names,graph:graph,available:available,route:route,position:position,resident:resident});
})(window);
