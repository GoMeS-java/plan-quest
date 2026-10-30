/* Переходы и жители Цитадели: автономная демонстрационная логика. */
(function(root){
'use strict';
function sortedRooms(state){return state.rooms.slice().sort(function(a,b){return Number(a.floor.slice(1))-Number(b.floor.slice(1))||a.start-b.start;});}
function route(state,fromId,toId){
 var rooms=sortedRooms(state),from=rooms.findIndex(function(r){return r.id===fromId;}),to=rooms.findIndex(function(r){return r.id===toId;});
 if(from<0||to<0)return [];
 var step=from<=to?1:-1,out=[];
 for(var i=from;i!==to+step;i+=step)out.push(rooms[i].id);
 return out;
}
function residents(state,now){
 var model=root.Citadel;
 return Object.keys(model.inhabitants).map(function(id){
  var npc=model.inhabitants[id],activity=model.npcActivity(id,now);
  var preferred=state.rooms.find(function(r){return r.kind===npc.home;});
  var quarters=state.rooms.find(function(r){return r.kind==='quarters';});
  var throne=state.rooms.find(function(r){return r.kind==='throne';});
  var location=activity==='work'&&preferred?preferred:activity==='social'&&throne?throne:quarters||throne||preferred;
  return {id:id,name:npc.name,activity:activity,roomId:location?location.id:null};
 });
}
var lines={
 archivist:{work:'В Архиве ещё столько непрочитанных страниц.',social:'Порой лучшие мысли рождаются за беседой.',rest:'Книги подождут до утра.'},
 guard:{work:'Стены крепки. Я проверю ворота ещё раз.',social:'Сегодня в Цитадели спокойно.',rest:'Даже стражам нужен отдых.'},
 treasurer:{work:'Порядок в сокровищнице начинается с учёта.',social:'Хорошая беседа не требует платы.',rest:'Подсчёты продолжим завтра.'},
 smith:{work:'Горн горяч. Металл ждёт своей формы.',social:'После работы приятно посидеть у огня.',rest:'Пусть угли остывают.'}
};
function dialogue(id,activity){var entry=lines[id];return entry&&(entry[activity]||entry.work)||'Приветствую тебя в Цитадели.';}
root.CitadelLife=Object.freeze({route:route,residents:residents,dialogue:dialogue});
})(window);
