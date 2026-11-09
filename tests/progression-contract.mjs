import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const game = readFileSync('src/game.html', 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
// Captured from 1.3.2 before Stage I. Browser tests cover behavior; these
// checks also catch edits to protected rules outside the exercised fixtures.
const sections = [
  ['var QDEF =', 'function activeIdx', 'd7c664e15e45fa8a38ae1413730f52234392f2d9d3aab62b861bd5a262ba985d'],
  ['function trialOf(', 'var ROOM_ITEMS =', '10ddf6e74091c1d3146a39d4b955728c0b294af819ab6ccbebd234f8c80eac69'],
  ['function pointsInfo(', 'function saveFx(', '1485befeb63f9cca4646876b1c6b22c6eb4be3920e9e5b27dfbcc4c9f4b36596'],
  ['function citadelRoomLevel(', 'function citadelRenderBuilding(', 'f3957cdf1e3c867f8136bcd2beede955bfa559f1eb1be18e6d6322047431bd26'],
  ['function toggleQ(', "  $('kcal').addEventListener", '82d33c76818040355e614f0a6626dd4696251c0ea40b9f419f935f1c61339505'],
];
for (const [start, end, expected] of sections) {
  const from = game.indexOf(start);
  const to = game.indexOf(end, from);
  assert(from >= 0 && to > from, start);
  assert.equal(hash(game.slice(from, to)), expected, start);
}
for (const [path, expected] of [
  ['src/chains.js', 'be34630ff6596846e9753257bc0917e6b1dc08248b2b60f52430863eae7c29c1'],
  ['src/citadel-world.js', '96f39bad7c3044c413c8cdd6b320d2d096f8f6fcf5984765c75afb8b11fd5186'],
  ['src/forge-awards.js', 'c60b2f6f6cc0867a1b6ec4045a7475323a01f8d7408ba6a946163ed292a6f81e'],
]) {
  assert.equal(hash(readFileSync(path)), expected, path);
}
console.log('1.3.2 progression, economy and resident rules verified');
