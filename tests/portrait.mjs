import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const source=readFileSync('src/game.html','utf8'),renderer=readFileSync('src/portrait.js','utf8'),previous=execFileSync('git',['show','cb692f7:src/game.html'],{encoding:'utf8'});
const block=s=>s.slice(s.indexOf('  var W = 32, H = 52;'),s.indexOf('  // ---- helpers'));
assert(block(source)===block(previous),'approved canonical sprite, outfit palettes and body deformation stay identical');
const ctx=vm.createContext({});vm.runInContext(block(source),ctx);vm.runInContext(renderer,ctx);
const tops=ctx.BUILTIN.filter(i=>i.slot==='top'),pants=ctx.BUILTIN.filter(i=>i.slot==='bottom'),outers=[null,...ctx.BUILTIN.filter(i=>i.slot==='outer')];let variants=0;
for(const shape of [1,.8,.6])for(const top of tops)for(const bottom of pants)for(const outer of outers){
 ctx.bodyShapeNow=shape;const outfit={top,bottom,outer},sprite=ctx.buildSprite(outfit),before=JSON.stringify([sprite,outfit,ctx.C]),pixels=ctx.VkachPortrait.pixels(sprite,outfit,ctx.C);assert.equal(pixels.length,192*192*4);assert.equal(JSON.stringify([sprite,outfit,ctx.C]),before,'portrait never mutates appearance');let varied=0;
 for(let y=0;y<192;y++)for(let x=0;x<192;x++){const c=sprite[Math.floor(y/6)*32+Math.floor(x/6)],i=(y*192+x)*4;assert.equal(pixels[i+3],c?255:0,'detailed silhouette follows canonical mask at every body size');if(c){const rgb=Number.parseInt(c.slice(1),16);if(pixels[i]!==((rgb>>16)&255)||pixels[i+1]!==((rgb>>8)&255)||pixels[i+2]!==(rgb&255))varied++;}}
 assert(varied>1000,'detail adds face and material shading beyond nearest-neighbor enlargement');variants++;
}
assert.equal(variants,90);assert(ctx.VkachPortrait.pixels([],{},{}).every(v=>v===0));
const worker=readFileSync('docs/sw.js','utf8');assert(worker.includes('portrait.js'));assert.equal(readFileSync('docs/portrait.js','utf8'),renderer);
console.log('PASS 90 equipment/body portrait combinations, exact shared silhouette, extra detail, immutable inputs and offline renderer');
