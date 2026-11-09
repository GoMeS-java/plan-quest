import assert from 'node:assert/strict';
import {withApprovedCalorieLabels} from './fixtures/approved-copy.mjs';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const source=await readFile('src/game.html','utf8'),worker=await readFile('docs/sw.js','utf8');
const context=vm.createContext({});vm.runInContext(source.match(/function framePixels\(key\)\s*\{[\s\S]*?\n  \}/)[0],context);
const keys=new Set([...source.matchAll(/COS\.fr_[\w]+\s*=\s*\{\s*cat:\s*'frame'[^}]*?key:\s*'([^']+)'/g)].map(m=>m[1]));
for(const m of source.matchAll(/\['fr_[\w]+',\s*'frame',\s*'[^']+',\s*'[^']+',\s*'([^']+)'/g))keys.add(m[1]);
assert(keys.size>1);
for(const key of keys){
 const path=context.framePixels(key);assert(path,'every existing frame has art');
 for(const name of [path,path.replace('.svg','-light.svg')]){const svg=await readFile('src/'+name,'utf8');assert(svg.includes('shape-rendering="crispEdges"'));assert(svg.includes('viewBox="0 0 120 120"'));assert(worker.includes(name),'both border layers are cached offline');assert.equal(await readFile('docs/'+name,'utf8'),svg);}
}
for(const key of ['','constructor','__proto__','../../private','unknown'])assert.equal(context.framePixels(key),'');
const previous=withApprovedCalorieLabels(execFileSync('git',['show','90e1505:src/game.html'],{encoding:'utf8'}));
for(const name of ['ACH','LEG']){const marker='  var '+name+' = [';const part=s=>{const i=s.indexOf(marker);assert(i>=0);return s.slice(i,s.indexOf('];',i)+2);};assert.equal(part(source),part(previous),'existing conditions and rewards stay unchanged');}
console.log('PASS existing frame coverage, native border/light cache and unchanged achievement definitions');
