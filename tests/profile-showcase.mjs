import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('src/game.html','utf8');
const begin=source.indexOf('  var profilePickSlot=-1;');
const end=source.indexOf('  function equipItem(',begin);
assert(begin>=0&&end>begin,'profile code exists');

let writes=0;
const record={};
const context={
  S:{look:{title:'known-title',theme:'existing-theme'},days:{}},cachedLook:null,
  lastGI:{ach:{earned1:'2026-10-20',earned2:'2026-10-21'}},
  LEG:[{id:'earned1',title:'Earned one'},{id:'hidden',title:'Secret'}],
  ACH:[{id:'earned2',t:'Скрытая отметина',d:'Completed milestone'}],
  ROOM_OF:{},cosOf:()=>'',
  db:{doc:()=>({set:next=>{writes++;Object.assign(record,structuredClone(next));}})},
  enqueue:fn=>fn(),$:()=>null,localStorage:{setItem:()=>{}}
};
vm.createContext(context);
const collectionStart=source.indexOf('  function achievementStamp(');
const collectionEnd=source.indexOf('  function achievementSigil(',collectionStart);
vm.runInContext(source.slice(collectionStart,collectionEnd)+source.slice(begin,end),context);

assert.equal(context.profileEarned().length,2,'only earned achievements are selectable');
assert(!context.profileEarned().some(x=>x.id==='hidden'),'unearned achievement never appears');
assert.equal(context.profileEarned().find(x=>x.id==='earned2').name,'Completed milestone');
context.profileSaveShowcase(['earned1','hidden','earned1']);
assert.deepEqual(Array.from(context.profileSelected()),['earned1','',''],'unearned and duplicate IDs rejected');
assert.equal(record.title,'known-title','existing title preserved');
assert.equal(record.theme,'existing-theme','existing appearance preserved');
assert.equal(writes,1,'one save transaction requested');
context.profileSaveShowcase(['earned2','earned1','']);
assert.deepEqual(Array.from(context.profileSelected()),['earned2','earned1','']);
assert.equal(writes,2);
console.log('PASS profile showcase: earned only, 3 slots, preserved appearance, no duplicates');
