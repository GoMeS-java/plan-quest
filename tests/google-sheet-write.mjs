// Synthetic rows only. Verify shorter snapshots clear historical cloud rows.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('src/localdb.js', 'utf8');
const start = source.indexOf('  function readRows(');
const end = source.indexOf('  function createFile(', start);
assert(start >= 0 && end > start);
const requests = [];
let finish;
const ctx = vm.createContext({
  docs: {'tx/current': {d: {amount: 8}, u: 12}},
  revision: 1,
  dirty: true,
  TAB: 'data',
  validDocs: value => value,
  parseBackupText: JSON.parse,
  JSON,
  Object,
  api: (url, options) => {
    requests.push({url, options});
    if (!options) return Promise.resolve({json: async () => ({values: [
      ['path', 'json', 'u'], ['tx/current', '{"amount":8}', 12],
      ['tx/obsolete', '{"amount":1}', 9]
    ]})});
    return new Promise(resolve => { finish = resolve; });
  }
});
vm.runInContext(source.slice(start, end), ctx);

const previous = await vm.runInContext("readRows('sheet-id')", ctx);
assert.equal(previous.rowCount, 3);
assert.equal(previous.docs['tx/obsolete'].d.amount, 1);

ctx.previousRowCount = previous.rowCount;
const writing = vm.runInContext("writeAll('sheet-id', previousRowCount)", ctx);
assert.equal(requests.length, 2);
assert.match(requests[1].url, /A1:C3/);
const sent = JSON.parse(requests[1].options.body).values;
assert.equal(sent.length, 3);
assert.equal(sent[1][0], 'tx/current');
assert.deepEqual(Array.from(sent.slice(2), row => Array.from(row)), [['', '', '']]);
ctx.revision = 2; // New offline write while the HTTP response is pending.
finish({ok: true});
await writing;
assert.equal(ctx.dirty, true);

const next = vm.runInContext("writeAll('sheet-id', 2)", ctx);
assert.match(requests[2].url, /A1:C2/);
finish({ok: true});
await next;
assert.equal(ctx.dirty, false);
console.log('PASS Sheets stale-row clearing and in-flight local write preservation');
