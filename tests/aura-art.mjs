import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const source=await readFile('src/game.html','utf8'),css=await readFile('src/rpg-ui.css','utf8');
const context=vm.createContext({});vm.runInContext(source.match(/function auraPixels\(key\)\s*\{[\s\S]*?\n  \}/)[0],context);
const keys=new Set([...source.matchAll(/COS\.au_[\w]+\s*=\s*\{\s*cat:\s*'aura'[^}]*?key:\s*'([^']+)'/g)].map(m=>m[1]));
for(const m of source.matchAll(/\['au_[\w]+',\s*'aura',\s*'[^']+',\s*'[^']+',\s*'([^']+)'/g))keys.add(m[1]);
assert(keys.has('soft')&&keys.size>1);const worker=await readFile('docs/sw.js','utf8');
for(const key of keys){
 if(key==='soft'){assert.equal(context.auraPixels(key),'','approved glow has no new ornament');continue;}
 const path=context.auraPixels(key);assert(path,'every unapproved existing aura has art');const svg=await readFile('src/'+path,'utf8');assert(svg.includes('shape-rendering="crispEdges"'));assert.equal((svg.match(/clip-path="url\(#outside-hero\)"/g)||[]).length,4);assert(worker.includes(path));assert.equal(await readFile('docs/'+path,'utf8'),svg);
}
for(const key of ['','__proto__','constructor','../../private','unknown'])assert.equal(context.auraPixels(key),'');
const previous=execFileSync('git',['show','6780913:src/game.html'],{encoding:'utf8'});
for(const name of ['ACH','LEG']){const marker='  var '+name+' = [';const part=s=>{const i=s.indexOf(marker);assert(i>=0);return s.slice(i,s.indexOf('];',i)+2);};assert.equal(part(source),part(previous),'existing rewards are unchanged');}
const oldCSS=execFileSync('git',['show','6780913:src/rpg-ui.css'],{encoding:'utf8'});
const glow=s=>s.slice(s.indexOf('/* Earned aura selection'),s.indexOf('/* The visible Android viewport'));
assert.equal(glow(css),glow(oldCSS),'approved shared glow is preserved exactly');
console.log('PASS existing aura coverage, four-frame cached art, preserved soft/shared glow and unchanged rewards');
