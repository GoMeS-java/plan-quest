import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const source=readFileSync('src/game.html','utf8');
const sealed={id:'sealed'};Object.defineProperty(sealed,'title',{get(){throw Error('unowned title inspected');}});
const ctx={S:{look:{}},cachedLook:{},LEG:[{id:'later',title:'Owned later'},sealed],ACH:[{id:'earlier',title:'Owned earlier'}],lastGI:{ach:{earlier:'2026-11-01',later:'2026-11-02'}}};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('  function titleList()'),source.indexOf('  function lookGroupDefinitions()')),ctx);
assert.deepEqual(Array.from(ctx.titleList(),t=>t.id),['earlier','later']);assert.equal(ctx.heroTitle(),'Owned later');ctx.S.look.title='earlier';assert.equal(ctx.heroTitle(),'Owned earlier');ctx.S.look.title='__none__';assert.equal(ctx.heroTitle(),'СПЯЩИЙ');ctx.S.look.title='sealed';assert.equal(ctx.heroTitle(),'Owned later');ctx.lastGI.ach=Object.create({later:'2026-11-02'});assert.equal(ctx.titleList().length,0);assert.equal(ctx.heroTitle(),'СПЯЩИЙ');
const previous=execFileSync('git',['show','bd27e97:src/game.html'],{encoding:'utf8'});
for(const name of ['ACH','LEG']){const marker='  var '+name+' = [';const part=s=>{const i=s.indexOf(marker);assert(i>=0);return s.slice(i,s.indexOf('];',i)+2);};assert(part(source)===part(previous),'existing conditions and rewards remain identical');}
for(const path of ['src/fate.js','src/legends.js','src/citadel-world.js']){
 const prior=execFileSync('git',['show','bd27e97:'+path],{encoding:'utf8'}).replace(/\r\n/g,'\n');
 const approved=path==='src/citadel-world.js'?prior.replace('archive:10,forge:15','archive:10,forge:5'):prior;
 assert.equal(readFileSync(path,'utf8').replace(/\r\n/g,'\n'),approved,'only the agreed Forge entrance changes the public world rules');
}
console.log('PASS title ownership, untouched secret getters, auto/remove/replace, unchanged reward definitions and discovery rules');
