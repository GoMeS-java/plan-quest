import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile('src/game.html','utf8');
const keys=new Set([...source.matchAll(/COS\.b_[\w]+\s*=\s*\{\s*cat:\s*'bg'[^}]*?key:\s*'([^']+)'/g)].map(m=>m[1]));
for(const m of source.matchAll(/\['b_[\w]+',\s*'bg',\s*'[^']+',\s*'[^']+',\s*'([^']+)'/g))keys.add(m[1]);
assert(keys.has('winter')&&keys.size>3);
const context=vm.createContext({});vm.runInContext(source.match(/function lookLandscape\(key\)\s*\{[\s\S]*?\n  \}/)[0],context);
const worker=await readFile('docs/sw.js','utf8');
for(const key of keys){
 const path=context.lookLandscape(key);assert(path,'every existing background must have art');
 const svg=await readFile('src/'+path,'utf8');assert(svg.includes('shape-rendering="crispEdges"'));assert((svg.match(/<g id=/g)||[]).length>=3,'multiple depth planes');assert(worker.includes(path),'offline cache includes every landscape');
 assert.equal(await readFile('docs/'+path,'utf8'),svg);
 if(key!=='winter')for(const n of [1,2]){
  const life='assets/citadel/realm-'+key+'-life-'+n+'.svg';const art=await readFile('src/'+life,'utf8');assert(/<(rect|polygon|path)\b/.test(art),'every nonwinter background has a populated detail layer');assert(worker.includes(life),'detail layer is cached offline');assert.equal(await readFile('docs/'+life,'utf8'),art);
 }
}
const leg=source.slice(source.indexOf('  var LEG = ['),source.indexOf('];',source.indexOf('  var LEG = ['))+2);
const awarded=[...leg.matchAll(/cos:\s*'(b_[^']+)'/g)].map(m=>m[1]);
for(const id of awarded)assert(keys.has(id.slice(2)),'every existing superrare background is covered');
assert(context.lookLandscape('abyss'),'multi-part existing reward is covered');
for(const key of ['__proto__','constructor','not-owned','../../private'])assert.equal(context.lookLandscape(key),'');
const before=await import('node:child_process').then(({execFileSync})=>execFileSync('git',['show','ed7e43e:src/game.html'],{encoding:'utf8'}));
for(const name of ['ACH','LEG']){
 const start='  var '+name+' = [';const part=s=>{const i=s.indexOf(start);assert(i>=0);return s.slice(i,s.indexOf('];',i)+2);};assert.equal(part(source),part(before),'achievement definitions and rewards stay unchanged');
}
console.log('PASS all existing and superrare background art, depth planes, cache coverage and unchanged achievement definitions');
