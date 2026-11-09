/* localdb.js: локальная документная база приложения «Вкач»,
   плюс синхронизация с файлом на Google Диске.

   Формат хранилища (и файла на Диске):
   { "v": 1, "docs": { "tx/abc": { "d": {...данные...} | null, "u": 1792528658167 } } }
   d = null означает удалённую запись. u = время последнего изменения, мс.
   При слиянии побеждает запись с большим u. */
(function () {
  'use strict';
  var CFG = window.PLAN_CONFIG || {};
  var PREFIX = CFG.testMode ? 'plan.android-test.' : 'plan.';
  var KEY = PREFIX + 'store.v1';
  var META = PREFIX + 'meta.v1';
  var UPGRADE = PREFIX + 'pre-update.v1';
  var RECOVERY = PREFIX + 'recovery.v1', CONFLICT = PREFIX + 'conflict.v1';
  var TOKEN_KEY = PREFIX + 'tok', CHECKPOINT = PREFIX + 'checkpoint.v1';
  var CLOUD_META = PREFIX + 'cloud136.v1';
  var firebaseConfigured = !CFG.testMode && window.VkachCloudSync?.configured(CFG.cloud,location.origin);
  // The isolated Android build has no cloud access until a separate OAuth
  // client and its exact HTTPS origin have been explicitly configured.
  var cloudAllowed = !firebaseConfigured && (!CFG.testMode || (CFG.cloudEnabled === true &&
    CFG.clientId && CFG.clientId !== CFG.productionClientId &&
    /^https:\/\//.test(CFG.allowedOrigin || '') && CFG.allowedOrigin === location.origin &&
    CFG.fileName === 'plan-data-android-test'));
  var FILE_NAME = CFG.fileName || 'plan-data';
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';

  var docs = {};      // path -> {d, u}
  var meta = {};      // fileId, lastSync, user
  var subs = [];      // {path|col, kind, cb}
  var dirty = false, revision = 0, writeFailure = false, corruptRaw = null;
  var pendingConflict = loadConflict();
  var saveHistory = window.VkachSaveHistory?.create(PREFIX + 'save-history.v1', backupFor);

  function jget(k, def) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function loadConflict() {
    try {
      var raw = localStorage.getItem(CONFLICT);
      if (!raw) return null;
      var copy = JSON.parse(raw);
      if (!copy || !Array.isArray(copy.paths) || !copy.paths.every(function (path) { return typeof path === 'string'; })) throw new Error('bad format');
      validateIncoming(copy.docs);
      return copy;
    } catch (_) { return {invalid:true}; }
  }

  try { docs = persistedDocs(); } catch (e) {
    // Keep the original bytes. Valid siblings remain readable; no automatic
    // migration, merge or game write may turn corruption into an empty profile.
    try { corruptRaw = localStorage.getItem(KEY); } catch (_) { corruptRaw = ''; }
    var partial = jget(KEY, null);
    if (partial && partial.docs && typeof partial.docs === 'object') Object.keys(partial.docs).forEach(function (p) {
      try { var one = {}; one[p] = partial.docs[p]; validDocs(one); docs[p] = partial.docs[p]; } catch (_) {}
    });
  }
  meta = jget(META, {}) || {};
  var upgradeBlocked = corruptRaw !== null;
  // Runs before game subscriptions can write, including an update from older
  // clients which did not yet have a backup button.
  if (!upgradeBlocked && window.APP_VERSION && meta.dataVersion !== window.APP_VERSION) {
    try {
      var beforeUpdate = persistedDocs();
      if (Object.keys(beforeUpdate).length && !jset(UPGRADE, { v: 1, docs: beforeUpdate })) throw storageError();
      meta.dataVersion = window.APP_VERSION;
      if (!jset(META, meta)) throw storageError();
    } catch (e) { upgradeBlocked = true; }
  }

  function saveMeta() { jset(META, meta); }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function segs(p) { return p.split('/'); }
  function colOf(p) { var s = segs(p); s.pop(); return s.join('/'); }
  function idOf(p) { var s = segs(p); return s[s.length - 1]; }
  function rid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---- подписки -------------------------------------------------------
  function snapDoc(p) {
    var r = docs[p], ex = !!(r && r.d != null);
    return { exists: ex, id: idOf(p), data: function () { return clone(ex ? r.d : undefined); } };
  }
  function snapCol(c) {
    var out = [];
    Object.keys(docs).forEach(function (p) {
      var r = docs[p];
      if (r.d != null && colOf(p) === c) out.push({ id: idOf(p), data: (function (rr) { return function () { return clone(rr.d); }; })(r) });
    });
    return { docs: out };
  }
  var tick = null;
  function notify() {
    archiveDay();
    scheduleCloud();
    if (firebaseConfigured) {
      clearTimeout(pushTimer);
      pushTimer=setTimeout(refreshPushLocal,200);
    }
    if (tick) return;
    tick = setTimeout(function () {
      tick = null;
      subs.slice().forEach(function (s) {
        try { s.cb(s.kind === 'doc' ? snapDoc(s.path) : snapCol(s.path)); } catch (e) { if (window.console) console.error(e); }
      });
    }, 0);
  }

  // Один снимок содержит и оплату, и результат покупки. Callback синхронный:
  // между проверкой остатка и фиксацией никто не может изменить этот снимок.
  function mutate(fn) {
    function commit() {
      if (upgradeBlocked) throw storageError();
      var previous=persistedDocs(), next = clone(previous), changed = false;
      var tx = {
        get: function (p) { return next[p] && clone(next[p].d); },
        list: function (c) { return Object.keys(next).filter(function (p) { return colOf(p) === c && next[p].d != null; }).map(function (p) { return Object.assign({}, clone(next[p].d), { id: idOf(p) }); }); },
        set: function (p, d) { next[p] = { d: clone(d), u: Math.max(Date.now(), (next[p] && next[p].u || 0) + 1) }; changed = true; },
        delete: function (p) { tx.set(p, null); }
      };
      var result = fn(tx);
      if (result && typeof result.then === 'function') throw new Error('Transaction callback must be synchronous');
      if (changed) {
        validDocs(next);
        if (Object.keys(previous).length && !jset(CHECKPOINT, {v:1,docs:previous,savedAt:Date.now()})) { writeFailure=true; renderChip(); throw storageError(); }
        if (!jset(KEY, { v: 1, docs: next })) { writeFailure = true; renderChip(); var error = new Error('Storage unavailable'); error.code = 'quota_exceeded'; throw error; }
        docs = next; writeFailure = false; dirty = true; revision++; notify(); renderChip(); scheduleSync();
      }
      return result;
    }
    if (navigator.locks) return navigator.locks.request(KEY, commit);
    return Promise.resolve().then(commit);
  }
  function write(p, d) { return mutate(function (tx) { tx.set(p, d); }); }
  window.addEventListener('storage', function (e) {
    if (e.key === CONFLICT) { pendingConflict = loadConflict(); renderChip(); }
    if (e.key === META) { meta = jget(META, {}) || {}; renderChip(); }
    if (e.key === TOKEN_KEY) { readToken(); renderChip(); }
    if (e.key === CLOUD_META && firebaseConfigured) { renderChip(); scheduleCloud(); }
    if (e.key === KEY) { try { docs = persistedDocs(); dirty = true; revision++; notify(); scheduleSync(); } catch (_) { corruptRaw = e.newValue; upgradeBlocked = true; } renderChip(); }
  });

  var db = {
    runTransaction: mutate,
    doc: function (p) {
      return {
        onSnapshot: function (cb) { subs.push({ kind: 'doc', path: p, cb: cb }); setTimeout(function () { cb(snapDoc(p)); }, 0); },
        set: function (d) { return write(p, clone(d)); },
        update: function (d) {
          return mutate(function (tx) {
            var cur = tx.get(p) || {};
            Object.keys(d).forEach(function (k) { if (d[k] && d[k].__delete__) delete cur[k]; else cur[k] = clone(d[k]); });
            tx.set(p, cur);
          });
        },
        delete: function () { return write(p, null); }
      };
    },
    collection: function (c) {
      return {
        onSnapshot: function (cb) { subs.push({ kind: 'col', path: c, cb: cb }); setTimeout(function () { cb(snapCol(c)); }, 0); },
        add: function (d) { var id = rid(); return write(c + '/' + id, clone(d)).then(function () { return { id: id }; }); }
      };
    }
  };
  window.PlanDB = Object.freeze(db);

  // ---- atomic merge / recovery ----------------------------------------
  function storageError() { var e = new Error('Storage unavailable'); e.code = 'quota_exceeded'; return e; }
  function validDocs(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('bad format');
    Object.keys(value).forEach(function (p) {
      var r = value[p];
      if (p.indexOf('/') < 1 || p.split('/').some(function (part) { return !part || part === '__proto__' || part === 'constructor' || part === 'prototype'; }) ||
          !r || typeof r !== 'object' || !Object.prototype.hasOwnProperty.call(r, 'd') ||
          (r.d !== null && (typeof r.d !== 'object' || Array.isArray(r.d))) || !Number.isFinite(r.u) || r.u < 0) throw new Error('bad format');
    });
    return value;
  }
  function persistedDocs() {
    var raw = localStorage.getItem(KEY), saved = raw ? JSON.parse(raw) : { docs: {} };
    if (!saved || (saved.v !== undefined && saved.v !== 1)) throw new Error('unsupported schema');
    return validDocs(saved.docs);
  }
  function exclusive(fn) { return navigator.locks ? navigator.locks.request(KEY, fn) : Promise.resolve().then(fn); }
  function archiveDay() {
    if (!upgradeBlocked) saveHistory?.daily(docs).then(refreshHistory).catch(historyFailure);
  }
  function archiveChange(copy) {
    if (!copy || !Number.isFinite(copy.savedAt)) return;
    saveHistory?.change(copy.id || copy.savedAt, copy.savedAt, copy.docs, copy.remote, copy.reason || 'restore').then(refreshHistory).catch(historyFailure);
  }
  function refreshHistory(entry) { if (entry && !menu?.hidden) loadHistory?.(); }
  function historyFailure() { historyWriteFailed = true; if (!menu?.hidden) loadHistory?.(); }
  function recovery(local, remote, reason) {
    // Never replace progress if the pre-change copy cannot be written.
    var copy = { v: 1, id: rid(), docs: local, remote: remote || {}, reason: reason,
      savedAt: Date.now(), originalDamagedStore: corruptRaw };
    var previous = jget(RECOVERY, null);
    if (!jset(RECOVERY, copy)) throw storageError();
    archiveChange(previous);
    archiveChange(copy);
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  // Discovery receipts are monotonic; preference follows the selected snapshot.
  var discoveryPaths = ['cfg/fate','cfg/legends','cfg/realm-achievements','cfg/shelter-items','cfg/forge-discoveries','cfg/chains-discoveries'];
  function retainDiscovery(path, local, incoming) {
    if(!local && !incoming)return null;
    if(path==='cfg/chains-discoveries')return window.VkachChains.mergeAwards(local,incoming);
    var engine=path==='cfg/forge-discoveries'?window.VkachForgeAwards:path==='cfg/shelter-items'?window.VkachShelter:path==='cfg/fate'?window.VkachFate:path==='cfg/realm-achievements'?window.VkachRealm:window.VkachLegends;
    if(!engine||!engine.merge)throw new Error('Discovery engine unavailable');
    return engine.merge(local,incoming);
  }
  function merge(remote, options) {
    options = options || {};
    var rd = clone(options.detect ? validateIncoming(remote && remote.docs) : validDocs(remote && remote.docs));
    return exclusive(function () {
      if (upgradeBlocked) throw storageError();
      var local = persistedDocs(), next = clone(local), changedLocal = false, changedRemote = false, conflicts = [];
      if (options.expected && !same(local, options.expected)) throw new Error('changed since preview');
      Object.keys(rd).forEach(function (p) {
        var l = local[p], r = rd[p];
        if(discoveryPaths.includes(p)&&(l&&l.d||r.d)){
          var fate=retainDiscovery(p,l&&l.d,r.d);
          if(l&&l.d&&l.u>r.u&&Object.prototype.hasOwnProperty.call(l.d,'active'))fate.active=l.d.active;
          if(!l||!same(l.d,fate)){next[p]={d:fate,u:Math.max(Date.now(),(l&&l.u||0)+1,r.u+1)};changedLocal=true;}
          else if(r.u>l.u){next[p]={d:fate,u:r.u};changedLocal=true;}
          if(!same(r.d,fate))changedRemote=true;
          return;
        }
        // This is detection, not a distributed transaction. Device clock skew
        // and concurrent full-sheet uploads still require manual verification.
        // Legacy monthly reports are derived records, not the original diary.
        if (options.detect && !p.startsWith('chains-ledger/') && l && !same(l.d, r.d) &&
            (l.u === r.u || (l.u > (meta.lastSync || 0) && r.u > (meta.lastSync || 0))) &&
            !(meta.accepted && meta.accepted[p] === JSON.stringify(r))) conflicts.push(p);
        if (!l || r.u > l.u) { next[p] = clone(r); changedLocal = true; }
        else if (l.u > r.u || !same(l.d, r.d)) changedRemote = true;
      });
      Object.keys(local).forEach(function (p) { if (!rd[p]) changedRemote = true; });
      if (conflicts.length) {
        recovery(local, rd, 'conflict');
        var pending = { docs: rd, paths: conflicts };
        if (!jset(CONFLICT, pending)) throw storageError();
        pendingConflict = pending;
        throw new Error('conflict');
      }
      if (changedLocal) {
        recovery(local, rd, options.detect ? 'sync' : 'import');
        if (options.pauseSync) {
          firebaseCloud?.pause();
          if (firebaseConfigured) refreshPushLocal();
          meta = jget(META,{}) || {};
          meta.syncPaused = true;
          if (!jset(META,meta)) throw storageError();
        }
        if (!jset(KEY, { v: 1, docs: next })) throw storageError();
        docs = next; revision++; notify();
      } else docs = local;
      return { local: changedLocal, remote: changedRemote };
    });
  }
  // The store and Sheets keep v1. Portable backups have their own version;
  // the digest covers metadata and all records, independent of object order.
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (k) { return JSON.stringify(k) + ':' + canonical(value[k]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  function digest(value) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value))).then(function (bytes) {
      return Array.from(new Uint8Array(bytes)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function backupFor(records, at) {
    var copy = { v: 2, format: 'vkach-backup', createdAt: new Date(at ?? Date.now()).toISOString(), appVersion: window.APP_VERSION || 'legacy', docs: clone(validDocs(records)) };
    return digest(copy).then(function (hash) { copy.integrity = { algorithm: 'SHA-256', value: hash }; return copy; });
  }
  function parseBackupText(text) {
    var value=JSON.parse(text), at=0;
    function ws(){while(/\s/.test(text.charAt(at))&&at<text.length)at++;}
    function str(){var start=at++;while(at<text.length){var c=text.charAt(at++);if(c==='\\')at++;else if(c==='"')break;}return JSON.parse(text.slice(start,at));}
    function scan(depth){if(depth>64)throw new Error('bad format');ws();var c=text.charAt(at);
      if(c==='{'){at++;ws();var keys=new Set();if(text.charAt(at)==='}'){at++;return;}while(at<text.length){ws();var key=str();if(keys.has(key))throw new Error('duplicate record');keys.add(key);ws();at++;scan(depth+1);ws();if(text.charAt(at++)==='}')return;}}
      else if(c==='['){at++;ws();if(text.charAt(at)===']'){at++;return;}while(at<text.length){scan(depth+1);ws();if(text.charAt(at++)===']')return;}}
      else if(c==='"')str();else while(at<text.length&&!/[\s,}\]]/.test(text.charAt(at)))at++;
    }
    scan(0);return value;
  }
  function validateIncoming(records) {
    function check(value, depth) {
      if (depth > 60 || typeof value === 'number' && !Number.isFinite(value)) throw new Error('bad format');
      if (value && typeof value === 'object') Object.keys(value).forEach(function (key) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('bad format');
        check(value[key], depth + 1);
      });
    }
    validDocs(records);
    Object.values(records).forEach(function (record) {
      if (!Number.isSafeInteger(record.u) || record.u >= Number.MAX_SAFE_INTEGER-1) throw new Error('bad format');
    });
    check(records, 0);
    return records;
  }
  function validateBackup(o, restore) {
    return Promise.resolve().then(function () {
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('bad format');
      if (o.v !== undefined && o.v !== 1 && o.v !== 2) throw new Error('unsupported schema');
      if (o.v === 2) {
        if (o.format !== 'vkach-backup' || !o.createdAt || !Number.isFinite(Date.parse(o.createdAt)) || typeof o.appVersion !== 'string' ||
            !o.integrity || o.integrity.algorithm !== 'SHA-256' || !/^[a-f0-9]{64}$/.test(o.integrity.value)) throw new Error('bad format');
        var records = validateIncoming(o.docs), unsigned = clone(o); delete unsigned.integrity;
        return digest(unsigned).then(function (hash) { if (hash !== o.integrity.value) throw new Error('integrity'); return clone(records); });
      }
      var incoming;
      if (o.seed && !restore) {
        incoming = Object.create(null);
        Object.keys(o.seed).forEach(function (p) { incoming[p] = { d: o.seed[p], u: 1 }; });
      } else if (o.docs) incoming = o.docs;
      else throw new Error('bad format');
      return clone(validateIncoming(incoming));
    });
  }
  function importObj(o, restore) {
    return validateBackup(o, restore).then(function (incoming) { return applyImport(incoming, restore); });
  }
  function applyImport(incoming, restore, expected) {
    if (restore) return syncExclusive(function () { return exclusive(function () {
      meta = jget(META, {}) || {};
      var local = corruptRaw !== null ? clone(docs) : persistedDocs(), next = {}, now = Date.now();
      if (expected && !same(local, expected)) throw new Error('changed since preview');
      recovery(local, incoming, 'restore');
      Object.keys(Object.assign({}, local, incoming)).forEach(function (p) {
        next[p] = { d: discoveryPaths.includes(p)&&((local[p]&&local[p].d)||(incoming[p]&&incoming[p].d)) ? retainDiscovery(p,local[p]&&local[p].d,incoming[p]&&incoming[p].d) : incoming[p] ? incoming[p].d : null, u: Math.max(now, (local[p] && local[p].u || 0) + 1, (incoming[p] && incoming[p].u || 0) + 1) };
      });
      // Persist the cloud pause before replacing data, even if later storage fails.
      firebaseCloud?.pause();
      if (firebaseConfigured) refreshPushLocal();
      meta.signed = false; meta.syncPaused = true;
      if (!jset(META, meta)) throw storageError();
      if (!jset(KEY, { v: 1, docs: next })) throw storageError();
      docs = next; corruptRaw = null; upgradeBlocked = false; writeFailure = false; dirty = true; revision++; notify();
      localStorage.removeItem(CONFLICT); pendingConflict = null; renderChip();
      return Object.keys(incoming).length;
    }); });
    function mergeImport() {
      return merge({docs:incoming},{expected:expected,pauseSync:Boolean(expected)}).then(function () {
        dirty = true; revision++; notify(); scheduleSync(); return Object.keys(incoming).length;
      });
    }
    return expected ? syncExclusive(mergeImport) : mergeImport();
  }
  function resolveConflict(choice, reviewed) {
    if (!pendingConflict || ['local', 'remote'].indexOf(choice) < 0) return Promise.reject(new Error('conflict'));
    return syncExclusive(function () { return exclusive(function () {
      pendingConflict = loadConflict();
      if (!pendingConflict || pendingConflict.invalid) throw new Error('conflict');
      var local = persistedDocs(), remote = validDocs(pendingConflict.docs), next = clone(local), accepted = Object.assign({}, meta.accepted || {});
      if (reviewed && (!same(local, reviewed.local) || !same(pendingConflict, reviewed.conflict))) throw new Error('changed since preview');
      recovery(local, remote, 'conflict');
      Object.keys(remote).forEach(function (p) {
        var l = local[p], r = remote[p], conflict = pendingConflict.paths.indexOf(p) >= 0;
        if (conflict) { next[p] = { d: choice === 'remote' ? r.d : l ? l.d : null, u: Math.max(Date.now(), (l && l.u || 0) + 1, r.u + 1) }; accepted[p] = JSON.stringify(r); }
        else if (!l || r.u > l.u) next[p] = clone(r);
      });
      discoveryPaths.forEach(function(path){
        if(!((local[path]&&local[path].d)||(remote[path]&&remote[path].d)))return;
        var prior=local[path],chosen=next[path];
        var combined=retainDiscovery(path,prior&&prior.d,remote[path]&&remote[path].d);if(chosen&&chosen.d&&Object.prototype.hasOwnProperty.call(chosen.d,'active'))combined.active=chosen.d.active;
        next[path]={d:combined,u:Math.max(Date.now(),(prior&&prior.u||0)+1,(chosen&&chosen.u||0)+1)};
      });
      meta.accepted = accepted; meta.syncPaused = true;
      if (!jset(META, meta)) throw storageError();
      if (!jset(KEY, { v: 1, docs: next })) throw storageError();
      docs = next; dirty = true; revision++; notify();
      localStorage.removeItem(CONFLICT); pendingConflict = null; clearTimeout(syncTimer);
      setStatus('Выбор сохранён на телефоне. Сверьте копии и запустите синхронизацию вручную.', 'warn');
    }); });
  }
  function downloadSnapshot(value, name) {
    var blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportBackup() {
    return Promise.resolve(window.PlanSync.beforeUpdate ? window.PlanSync.beforeUpdate() : null).catch(function(e){if(!upgradeBlocked || corruptRaw!==null)throw e;}).then(function () {
      return exclusive(function () { return backupFor(persistedDocs()).then(function (copy) { downloadSnapshot(copy, CFG.testMode ? 'vkach-test-backup' : 'vkach-backup'); setStatus('Файл копии подготовлен. Проверьте его в загрузках устройства.', 'ok'); }); });
    });
  }

  function backupDate(at) {
    return at ? new Date(at).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}) : '—';
  }
  function profileSummary(records) {
    var rank = records['cfg/abyss-economy']?.d?.rank, count = 0, marks = 0, latest = 0;
    Object.entries(records).forEach(function (entry) {
      var row = entry[1];
      latest = Math.max(latest,row.u);
      if (row.d === null) return;
      count++;
      if (entry[0].startsWith('days/') && Array.isArray(row.d.q)) marks += row.d.q.filter(Boolean).length;
    });
    return (Number.isFinite(rank) ? 'Сохранённый ранг ' + rank + ' · ' : '') + count + ' записей · ' +
      marks + ' ежедневных отметок · изменение ' + backupDate(latest);
  }
  function changeSummary(local, incoming, paths) {
    var groups = {
      days:'Задания и привычки', per:'Задания и привычки', weeks:'Задания и привычки', goals:'Цели', forge:'Цели и задания',
      tx:'Финансы', items:'Финансы', weights:'Вес', buys:'Покупки и улучшения', 'room-notes':'Заметки',
      'room-projects':'Проекты', 'room-recovery':'Восстановление', chains:'Разрыв оков'
    };
    var counts = new Map();
    (paths || new Set(Object.keys(local).concat(Object.keys(incoming)))).forEach(function (path) {
      if (same(local[path]?.d ?? null,incoming[path]?.d ?? null)) return;
      var key = path.split('/')[0], title = key.startsWith('food-') ? 'Питание' : groups[key] || 'Другие записи';
      counts.set(title,(counts.get(title)||0)+1);
    });
    return Array.from(counts, function (pair) { return pair.join(' · '); });
  }
  function reviewBackup(incoming, restoring) {
    var local = docs, changes = changeSummary(local,incoming,restoring ? undefined : Object.keys(incoming));
    var summary = (restoring ? 'Восстановить прогресс из копии? Записи, которых нет в копии, будут сняты. ' :
      'Объединить записи с файлом? Более новые записи могут заменить текущие. ') +
      '\n\nВ копии: ' + profileSummary(incoming) + '\nНа устройстве: ' + profileSummary(local) +
      (changes.length ? '\nРазличия по разделам: ' + changes.join(', ') : '') +
      '\n\nПеред заменой текущий прогресс будет сохранён отдельно.';
    if (!window.confirm(summary)) { setStatus('Операция отменена. Данные не изменены.',''); return Promise.resolve(); }
    setStatus('Проверенная копия: сохраняем данные.', 'work');
    return Promise.resolve(window.PlanSync.beforeUpdate?.()).then(function () {
      return applyImport(incoming, restoring, local);
    }).then(function (n) {
      setStatus('Сохранено записей: ' + n + '. Проверьте прогресс перед ручной синхронизацией.', 'ok');
    });
  }
  function backupFailure(e) {
    setStatus(e.message === 'integrity' ? 'Копия повреждена: проверка целостности не пройдена. Данные не заменены.' :
      e.message === 'unsupported schema' ? 'Эта версия копии пока не поддерживается. Данные не заменены.' :
      e.message === 'changed since preview' ? 'Сохранение изменилось после просмотра. Откройте копию ещё раз.' :
      'Копия не применена. Проверьте файл и свободное место.', 'warn');
  }

  var firebaseCloud, firebaseTransport, firebaseConnecting=false, cloudTimer, cloudRetry=false, firebaseError='', archivedCloud=null;
  var firebaseQueue=Promise.resolve();
  var pushTimer, remindersForPush, pushStatus='', lastPushProof='', lastPushAt=0;
  var pushQueues={remote:Promise.resolve(),worker:Promise.resolve()};
  var PUSH_KEY = PREFIX + 'push136.v1';
  function firebaseMeta() { return jget(CLOUD_META,{}) || {}; }
  function firebaseSerial(fn) {
    if (navigator.locks) return navigator.locks.request(KEY+'.firebase',fn);
    var next=firebaseQueue.then(fn,fn);
    firebaseQueue=next.catch(function () {});
    return next;
  }
  function scheduleCloud() {
    if (!firebaseCloud?.state().enabled) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(runCloud,8000);
  }
  function runCloud() {
    clearTimeout(cloudTimer); cloudTimer=null;
    if (!firebaseCloud?.state().enabled || !firebaseTransport.online()) return;
    if (firebaseCloud.state().busy) { cloudRetry=true; return; }
    cloudRetry=false;
    firebaseCloud.tick().then(refreshPush).catch(function (error) {
      cloudRetry=!['invalid-remote','missing-remote','local-blocked','too-large','empty-local'].includes(error.code);
    });
  }
  async function verifiedArchive(id, local, incoming, reason) {
    if (!saveHistory) throw storageError();
    await saveHistory.change(id,Date.now(),local,incoming,reason);
    var stored = await saveHistory.read('change-'+id);
    var prior = await validateBackup(stored?.local,true);
    if (await digest(prior) !== await digest(local)) throw storageError();
    if (incoming && await digest(await validateBackup(stored?.incoming,true)) !== await digest(incoming)) throw storageError();
    refreshHistory(true);
  }
  function replaceFromCloud(expected, incoming) {
    return exclusive(function () {
      if (upgradeBlocked || loadConflict() || !firebaseCloud?.state().enabled) throw storageError();
      var local = persistedDocs();
      if (!same(local,expected)) throw Object.assign(new Error('Local profile changed'),{code:'changed-local'});
      var next = clone(incoming);
      for (var path of discoveryPaths) {
        if (!local[path]?.d) continue;
        var earned = retainDiscovery(path,local[path].d,next[path]?.d);
        if (!same(earned,next[path]?.d)) next[path]={d:earned,u:Math.max(Date.now(),local[path].u,next[path]?.u || 0)};
      }
      recovery(local,incoming,'cloud-restore');
      if (!jset(KEY,{v:1,docs:next})) throw storageError();
      docs=next; revision++; writeFailure=false; notify();
    });
  }
  async function startFirebase() {
    if (!firebaseConfigured || firebaseCloud || firebaseConnecting || !navigator.onLine) return;
    firebaseConnecting=true;
    try {
      firebaseTransport=await window.VkachFirebase.connect(CFG.cloud);
      firebaseCloud=window.VkachCloudSync.create({
        meta:firebaseMeta,
        setMeta:function (value) { if (!jset(CLOUD_META,value)) throw storageError(); },
        changed:renderChip, schedule:scheduleCloud,
        serial:firebaseSerial,
        blocked:function () { return upgradeBlocked || Boolean(pendingConflict); },
        read:function () { return exclusive(persistedDocs); },
        hash:function (records) { return digest(validateIncoming(records)); },
        encode:async function (records) { return JSON.stringify(await backupFor(records)); },
        decode:function (payload) {
          var envelope=parseBackupText(payload);
          if (envelope?.v !== 2) throw new Error('Unsupported cloud backup');
          return validateBackup(envelope,true);
        },
        archive:verifiedArchive, replace:replaceFromCloud, disablePush:disablePushForSignOut
      },firebaseTransport);
      firebaseError='';
      firebaseTransport.authError.then(function (error) { if (error) reportFirebaseError(error); });
    } catch (error) { reportFirebaseError(error); }
    finally { firebaseConnecting=false; }
    renderChip();
  }
  function reportFirebaseError(error) {
    firebaseError=error.code === 'auth/popup-blocked' ? 'Браузер заблокировал окно Google. Откройте игру в Chrome и повторите вход.' :
      error.code === 'auth/popup-closed-by-user' ? 'Вход отменён.' :
      'Не удалось подключиться к Firebase. Данные доступны на устройстве.';
    renderChip();
  }
  function bindReminders(controller) { remindersForPush=controller; }
  function pushSerial(kind,fn) {
    if (navigator.locks) return navigator.locks.request(KEY+'.push-'+kind,fn);
    var next=pushQueues[kind].then(fn,fn);
    pushQueues[kind]=next.catch(function () {});
    return next;
  }
  function workerPushState(readState) {
    return pushSerial('worker',async function () {
      var registration = await navigator.serviceWorker.getRegistration();
      var scope = registration?.scope || new URL('./',location.href).href;
      var cache = await caches.open('vkach-push-' + scope);
      var path = new URL('__vkach_push_state__',scope), state=readState();
      if (state && registration?.active) await cache.put(path,new Response(JSON.stringify(state)));
      else await cache.delete(path);
      return registration;
    });
  }
  function currentSubscription(expected) {
    return same(jget(PUSH_KEY,null),expected);
  }
  async function enablePush() {
    var state=firebaseCloud?.state(), uid=state?.user?.uid;
    if (!uid || !state.enabled || !firebaseMeta().revision || !firebaseTransport.online() || !CFG.cloud.vapidKey ||
        !('Notification' in window) || !('PushManager' in window)) throw new Error('Push unavailable');
    if (await Notification.requestPermission() !== 'granted') throw new Error('Push permission');
    var subscription=await pushSerial('remote',async function () {
      if (!firebaseCloud.state().enabled || firebaseCloud.state().user?.uid!==uid) throw new Error('Push unavailable');
      var registration = await workerPushState(()=>null);
      if (!registration?.active) throw new Error('Worker inactive');
      var prior = jget(PUSH_KEY,null), token = await firebaseTransport.pushToken(registration);
      if (!token || !currentSubscription(prior) || firebaseCloud.state().user?.uid!==uid || !firebaseCloud.state().enabled) throw new Error('Push unavailable');
      var next={uid,device:prior?.uid===uid?prior.device:crypto.randomUUID(),token,consent:crypto.randomUUID(),enabled:true};
      if (!jset(PUSH_KEY,next)) throw storageError();
      return next;
    });
    try { await refreshPush(); }
    catch (error) { if (currentSubscription(subscription)) await disablePush(); throw error; }
    if (!currentSubscription(subscription)) return;
    pushStatus='Фоновые уведомления включены на этом устройстве.';
    renderChip();
  }
  async function disablePush() {
    var prior=jget(PUSH_KEY,null);
    if (!prior) return;
    var disabled={...prior,enabled:false};
    if (!jset(PUSH_KEY,disabled)) {
      await workerPushState(()=>null).catch(()=>{});
      throw storageError();
    }
    lastPushProof=''; lastPushAt=0;
    var cleared=await workerPushState(pushMarker).then(()=>true,()=>false);
    var removed=false;
    if (firebaseTransport.online()) {
      removed=await pushSerial('remote',async function () {
        if (!currentSubscription(disabled) || !firebaseTransport.online() || firebaseCloud.state().user?.uid!==disabled.uid) return false;
        await firebaseTransport.subscription(disabled.uid,disabled.device,null);
        await firebaseTransport.deletePushToken();
        if (cleared && currentSubscription(disabled)) jset(PUSH_KEY,null);
        return true;
      }).catch(()=>false);
    }
    var current=jget(PUSH_KEY,null);
    if (current?.enabled) return;
    pushStatus=removed||!current?'Фоновые уведомления отключены на этом устройстве.' :
      'На устройстве уведомления отключены. Подписку удалим при подключении.';
    renderChip();
  }
  async function disablePushForSignOut() {
    var timer;
    try {
      await Promise.race([disablePush(),new Promise(resolve=>{timer=setTimeout(resolve,3000);})]);
    } finally { clearTimeout(timer); }
  }
  function pushMarker() {
    var subscription=jget(PUSH_KEY,null), info=firebaseMeta(), state=firebaseCloud?.state();
    if (!subscription?.enabled || !remindersForPush || !state?.enabled || state.review) return null;
    var proof=remindersForPush.pushState();
    return {device:subscription.device,day:proof.day,revision:info.revision,needed:proof.needed};
  }
  function refreshPushLocal() {
    if (jget(PUSH_KEY,null)) workerPushState(pushMarker).catch(function () {});
  }
  async function refreshPush() {
    var subscription=jget(PUSH_KEY,null);
    if (!subscription || !remindersForPush || !firebaseTransport.online() || firebaseCloud.state().user?.uid!==subscription.uid) return;
    if (!subscription.enabled) return disablePush();
    await pushSerial('remote',async function () {
      var info=firebaseMeta(), state=firebaseCloud.state();
      if (!currentSubscription(subscription) || !state.enabled || !info.revision || state.review) return;
      var local=persistedDocs(), localRevision=revision, proof=remindersForPush.pushState();
      if (await digest(local) !== info.base || !currentSubscription(subscription) || !firebaseCloud.state().enabled ||
          firebaseMeta().revision !== info.revision || localRevision !== revision || firebaseCloud.state().review) return;
      var payload={...proof,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,revision:info.revision,token:subscription.token};
      var stamp=JSON.stringify(payload);
      if (stamp!==lastPushProof || Date.now()-lastPushAt>=3600000) {
        await firebaseTransport.subscription(subscription.uid,subscription.device,payload);
        if (currentSubscription(subscription)) { lastPushProof=stamp; lastPushAt=Date.now(); }
      }
    });
    refreshPushLocal();
  }
  async function pushShownToday(date) {
    if (!firebaseConfigured || !jget(PUSH_KEY,null)?.enabled) return false;
    var registration=await navigator.serviceWorker.getRegistration();
    if (!registration?.active) return false;
    var cache=await caches.open('vkach-push-'+registration.scope);
    var item=await cache.match(new URL('__vkach_push_last__',registration.scope));
    if (!item) return false;
    var receipt=await item.json();
    return receipt.day===date && receipt.device===jget(PUSH_KEY,null)?.device;
  }

  // ---- Google Диск -----------------------------------------------------
  var token = null, tokenExp = 0, tokenOwner = '', gsiLoading = null;
  function readToken() {
    var saved = jget(TOKEN_KEY, null);
    token = cloudAllowed && saved?.t || null;
    tokenExp = saved?.exp || 0;
    tokenOwner = saved?.owner || '';
  }
  readToken();
  var status = { text: '', cls: '' };
  var busy = false, syncTimer = null, waiting = null;

  function setStatus(t, cls) { status = { text: t, cls: cls || '' }; renderChip(); }
  function haveToken() { return token && Date.now() < tokenExp - 30000; }
  function verifyAccount(access, expiry) {
    return fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers:{Authorization:'Bearer ' + access}, cache:'no-store'
    }).then(function (response) {
      if (!response.ok) throw new Error(response.status === 401 ? 'auth' : 'identity');
      return response.json();
    }).then(function (info) {
      var email = info?.user?.emailAddress, owner = typeof email === 'string' && email.trim().toLowerCase();
      if (!owner) throw new Error('identity');
      var previousOwner = meta.owner || meta.hint?.toLowerCase();
      if (previousOwner && previousOwner !== owner) throw new Error('account_changed');
      if (!meta.owner) delete meta.sheetId; // Re-discover previously unbound file IDs.
      meta.owner = owner; meta.hint = email; meta.signed = true;
      if (!jset(META,meta) || !jset(TOKEN_KEY,{t:access,exp:expiry,owner:owner})) throw storageError();
      readToken();
      return token;
    });
  }

  function loadGsi() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gsiLoading) return gsiLoading;
    gsiLoading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { gsiLoading = null; rej(new Error('offline')); };
      document.head.appendChild(s);
    });
    return gsiLoading;
  }

  function getToken(interactive) {
    if (!cloudAllowed) return Promise.reject(new Error('testcloud'));
    if (haveToken()) {
      if (tokenOwner && tokenOwner === meta.owner && meta.signed) return Promise.resolve(token);
      return verifyAccount(token,tokenExp).catch(function (error) {
        if (error.message === 'auth' || error.message === 'account_changed') { jset(TOKEN_KEY,null); readToken(); }
        throw error;
      });
    }
    if (!interactive) return Promise.reject(new Error('auth'));
    if (!CFG.clientId) return Promise.reject(new Error('noclient'));
    if (!navigator.onLine) return Promise.reject(new Error('offline'));
    return loadGsi().then(function () {
      return new Promise(function (res, rej) {
        var timeout = setTimeout(function () { finish(new Error('auth')); },90000);
        function finish(error, response) {
          if (timeout === null) return;
          clearTimeout(timeout); timeout = null;
          if (error) { rej(error); return; }
          verifyAccount(response.access_token,Date.now() + (Number(response.expires_in) || 3600) * 1000).then(res,rej);
        }
        var client = google.accounts.oauth2.initTokenClient({
          client_id: CFG.clientId, scope: SCOPE,
          callback: function (r) {
            finish(r?.access_token ? null : new Error(r?.error || 'auth'),r);
          },
          error_callback: function (e) { finish(new Error(e?.type || 'auth')); }
        });
        try { client.requestAccessToken(meta.hint ? {prompt:'',hint:meta.hint} : {prompt:'select_account'}); }
        catch (error) { finish(error); }
      });
    });
  }

  function api(url, opt) {
    if (!cloudAllowed) return Promise.reject(new Error('testcloud'));
    opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + token }, opt.headers || {});
    return fetch(url, opt).then(function (r) {
      if (r.status === 401) { jset(TOKEN_KEY,null); readToken(); throw new Error('auth'); }
      if (!r.ok) throw new Error('http' + r.status);
      return r;
    });
  }

  var TAB = 'data';
  function findFile() {
    if (meta.sheetId) return Promise.resolve(meta.sheetId);
    var literal = function (value) { return "'" + value.replace(/[\\']/g,'\\$&') + "'"; };
    var q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and name=" + literal(FILE_NAME) +
      ' and trashed=false and ' + literal(meta.owner) + ' in owners');
    return api('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=nextPageToken,incompleteSearch,files(id,name)&spaces=drive')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!Array.isArray(j.files) || j.incompleteSearch || j.nextPageToken || j.files.length > 1) throw new Error('ambiguous cloud');
        if (!j.files.length) return null;
        meta.sheetId = j.files[0].id; saveMeta(); return meta.sheetId;
      });
  }
  // Таблица: строка = запись. Колонки: path | json | u. Пустой json = запись удалена.
  function readRows(id) {
    return api('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values/' + TAB + '!A:C?valueRenderOption=UNFORMATTED_VALUE')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var out = Object.create(null);
        if (!Array.isArray(j.values)) throw new Error('incomplete remote data');
        j.values.forEach(function (row, i) {
          if (i === 0 && row[0] === 'path') return;
          if (!Array.isArray(row)) throw new Error('bad remote row');
          if (!row.length) return;
          var path = row[0]; if (!path || typeof path !== 'string' || row.length < 3 || row[2] === '' || !Number.isFinite(Number(row[2])) || Number(row[2]) < 0) throw new Error('bad remote row');
          if (Object.prototype.hasOwnProperty.call(out, path)) throw new Error('duplicate remote record');
          var d = null, js = row[1];
          if (js !== undefined && js !== '') { d = parseBackupText(String(js)); }
          out[path] = { d: d, u: Number(row[2]) };
        });
        return { docs: validDocs(out), rowCount: j.values.length };
      });
  }
  function rowsOut(previousRowCount) {
    var rows = [['path', 'json', 'u']];
    Object.keys(docs).sort().forEach(function (p) {
      var r = docs[p];
      rows.push([p, r.d == null ? '' : JSON.stringify(r.d), r.u || 0]);
    });
    // Sheets values.update does not clear cells beyond its submitted range.
    // Explicitly blank old trailing rows or a later download may resurrect
    // records removed from the local snapshot.
    while (rows.length < (previousRowCount || 0)) rows.push(['', '', '']);
    return rows;
  }
  function writeAll(id, previousRowCount) {
    var rows = rowsOut(previousRowCount), sentRevision = revision;
    return api('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values/' + TAB + '!A1:C' + rows.length + '?valueInputOption=RAW', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: TAB + '!A1:C' + rows.length, majorDimension: 'ROWS', values: rows })
    }).then(function (response) {
      // Запись, сделанная во время HTTP-запроса, ещё не попала в отправленные строки.
      dirty = revision !== sentRevision;
      return response;
    });
  }
  function createFile() {
    return api('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { title: FILE_NAME }, sheets: [{ properties: { title: TAB } }] })
    }).then(function (r) { return r.json(); }).then(function (j) {
      meta.sheetId = j.spreadsheetId; saveMeta();
      return writeAll(meta.sheetId).then(function () { return meta.sheetId; });
    });
  }

  // Recovery and sync take locks in the same order: sync lock, then data
  // lock. A delayed network response must finish before recovery is committed.
  // The promise queue provides the same ordering in a single tab without Locks.
  var syncQueue = Promise.resolve();
  function syncExclusive(fn) {
    if (navigator.locks) return navigator.locks.request(KEY + '.sync', fn);
    var next = syncQueue.then(fn, fn);
    syncQueue = next.catch(function () {});
    return next;
  }
  function sync(interactive) { return syncExclusive(function () { return doSync(interactive); }); }
  function signOut() {
    return syncExclusive(function () {
      meta = jget(META,{}) || {};
      readToken();
      try { if (window.google && token) google.accounts.oauth2.revoke(token,function () {}); } catch (_) {}
      if (!jset(TOKEN_KEY,null)) throw storageError();
      readToken();
      meta.signed = false; meta.owner ||= meta.hint?.toLowerCase();
      delete meta.sheetId; delete meta.hint;
      if (!jset(META,meta)) throw storageError();
      clearTimeout(syncTimer); setStatus('Выход выполнен. Прогресс остался на устройстве.','');
    });
  }
  function doSync(interactive) {
    if (!cloudAllowed) { setStatus('ТЕСТОВАЯ ВЕРСИЯ: Google отключён. Данные остаются только на этом устройстве.', 'warn'); return Promise.resolve(); }
    meta = jget(META, meta) || {}; pendingConflict = loadConflict();
    readToken();
    if (!interactive && !meta.signed) return Promise.resolve();
    if (meta.syncPaused && !interactive) { setStatus('Автосинхронизация приостановлена. Проверьте копию и синхронизируйте вручную.', 'warn'); return Promise.resolve(); }
    if (upgradeBlocked) { setStatus('Прогресс открыт только для чтения: не удалось создать копию перед обновлением. Скачайте данные, освободите место и перезагрузите приложение.', 'warn'); return Promise.resolve(); }
    if (pendingConflict) { setStatus('Конфликт устройств. Сохраните обе копии и выберите данные в меню.', 'warn'); return Promise.resolve(); }
    if (busy) return waiting || Promise.resolve();
    if (interactive) { meta.syncPaused = false; saveMeta(); }
    var succeeded = false;
    busy = true; setStatus('Синхронизация…', 'work');
    waiting = getToken(!!interactive).then(function () { return findFile(); }).then(function (id) {
      if (!id) return createFile().then(function () { return { created: true }; });
      return readRows(id).then(function (remote) {
        return merge(remote, { detect: true }).then(function (m) {
          if (m.remote || dirty) return writeAll(id, remote.rowCount).then(function () { return m; });
          return m;
        });
      });
    }).then(function () {
      succeeded = true; meta.lastSync = Date.now(); delete meta.accepted; saveMeta();
      setStatus('', 'ok');
    }).catch(function (e) {
      var m = e && e.message;
      if (m === 'conflict') setStatus('Конфликт устройств: облачная запись остановлена. Сохраните обе копии в меню.', 'warn');
      else if (e && e.code === 'quota_exceeded') setStatus('Не удалось сохранить данные на телефоне. Облако не изменено; освободите место и повторите.', 'warn');
      else if (m === 'duplicate remote record' || m === 'incomplete remote data' || m === 'bad remote row' || m === 'bad format' || e instanceof SyntaxError) setStatus('Ошибка в облачной копии. Локальные данные сохранены; отправка остановлена.', 'warn');
      else if (m === 'noclient') setStatus('Вход в Google не настроен', 'warn');
      else if (m === 'account_changed') setStatus('Этот профиль связан с другим аккаунтом Google. Данные не отправлены.', 'warn');
      else if (m === 'identity') setStatus('Не удалось проверить аккаунт Google. Данные не отправлены.', 'warn');
      else if (m === 'ambiguous cloud') setStatus('Не удалось однозначно найти таблицу Google. Данные не отправлены.', 'warn');
      else if (m === 'offline' || m === 'Failed to fetch') setStatus('Нет сети: всё сохранено на телефоне', 'off');
      else if (m === 'auth' || m === 'popup_closed' || m === 'popup_failed_to_open' || m === 'access_denied' || m === 'interaction_required') setStatus('Нужно войти в Google', 'warn');
      else setStatus('Не удалось синхронизировать', 'warn');
    }).then(function () { busy = false; waiting = null; renderChip(); if (succeeded && dirty && haveToken() && navigator.onLine) scheduleSync(); });
    return waiting;
  }
  function scheduleSync() {
    if (!meta.signed || meta.syncPaused || pendingConflict) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { if (haveToken()) sync(false); else renderChip(); }, 3000);
  }

  // ---- плашка и меню ---------------------------------------------------
  var chip, menu, updateReady = false, swReg = null;
  function fmtAgo(t) {
    if (!t) return 'ещё не синхронизировалось';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'синхронизировано только что';
    if (m < 60) return 'синхронизировано ' + m + ' мин назад';
    var h = Math.round(m / 60);
    if (h < 48) return 'синхронизировано ' + h + ' ч назад';
    return 'синхронизировано ' + Math.round(h / 24) + ' дн назад';
  }
  function renderChip() {
    if (!chip) return;
    var txt, cls;
    if (upgradeBlocked || writeFailure || pendingConflict) { txt = '!'; cls = 'warn'; }
    else if (updateReady) { txt = 'ОБНОВИТЬ'; cls = 'upd'; }
    else if (firebaseConfigured) {
      var cloud=firebaseCloud?.state();
      if (!navigator.onLine) { txt='ОФЛАЙН'; cls='off'; }
      else if (cloud?.busy) { txt='…'; cls='work'; }
      else if (cloud?.review || cloud?.error || cloud?.blocked || firebaseError) { txt='!'; cls='warn'; }
      else if (cloud?.enabled && cloud.lastSync && !cloudTimer) { txt='✓'; cls='ok'; }
      else { txt=cloud?.user ? '●' : 'ВОЙТИ'; cls='work'; }
    }
    else if (CFG.testMode && !cloudAllowed) { txt = 'ТЕСТ'; cls = 'warn'; }
    else if (!navigator.onLine) { txt = 'ОФЛАЙН'; cls = 'off'; }
    else if (busy) { txt = '…'; cls = 'work'; }
    else if (!meta.signed || !haveToken()) { txt = meta.signed ? 'ВХОД ↻' : 'ВОЙТИ'; cls = 'warn'; }
    else if (upgradeBlocked || pendingConflict || status.cls === 'warn') { txt = '!'; cls = 'warn'; }
    else if (dirty) { txt = '●'; cls = 'work'; }
    else { txt = '✓'; cls = 'ok'; }
    chip.textContent = txt; chip.className = 'pl-chip ' + cls;
    if (menu && !menu.hidden) renderMenu();
  }
  var dataHistoryOpen=false,dataHost=null, historyExpanded=false, conflictExpanded=false, conflictDeferred=false;
  var loadHistory, historyWriteFailed=false;
  function restoreDataHost(){
    if(!dataHost)return;var saved=dataHost;dataHost=null;
    saved.blocked.forEach(function(row){row[0].inert=row[1];});
    saved.parent.insertBefore(menu,saved.next);
    if(saved.focus&&saved.focus.isConnected&&saved.focus.getClientRects().length)saved.focus.focus({preventScroll:true});
  }
  function openData(){
    if(!menu.hidden)return;
    conflictDeferred=false;
    var dialog=document.querySelector('.citadel-system-dialog[open]');
    if(dialog){var host=dialog.querySelector('#setup:not([hidden])')||dialog;dataHost={parent:menu.parentNode,next:menu.nextSibling,focus:document.activeElement,blocked:[]};host.appendChild(menu);dataHost.blocked=Array.from(host.children).filter(function(n){return n!==menu;}).map(function(n){var old=n.inert;n.inert=true;return [n,old];});}
    menu.hidden=false;renderMenu();dataHistoryOpen=true;history.pushState(Object.assign({},history.state,{planData:true}),'');
    requestAnimationFrame(function(){if(!menu.hidden){var first=menu.querySelector('button');if(first)first.focus({preventScroll:true});}});
  }
  function closeData(){menu.hidden=true;restoreDataHost();if(history.state&&history.state.planData)history.back();}
  window.addEventListener('popstate',function(event){if(menu)menu.hidden=true;restoreDataHost();if(dataHistoryOpen){dataHistoryOpen=false;event.stopImmediatePropagation();}},true);
  window.addEventListener('keydown',function(event){if(event.key==='Escape'&&menu&&!menu.hidden){event.preventDefault();event.stopImmediatePropagation();closeData();}},true);
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function dataButton(label, action) {
    var button = el('button','pl-b',label);
    button.type = 'button';
    button.onclick = action;
    return button;
  }
  function renderSaveHistory() {
    var history = el('details','pl-section'), summary = el('summary',null,'История резервных копий');
    var list = el('div','pl-history');
    history.open = historyExpanded;
    history.ontoggle = function () { if (history.isConnected) historyExpanded = history.open; };
    history.append(summary,list);
    menu.appendChild(history);
    function action(entry, side, restoring) {
      return function () {
        saveHistory.read(entry.id).then(function (copies) {
          var backup = copies?.[side];
          return validateBackup(backup,true).then(function (incoming) {
            if (restoring) return reviewBackup(incoming,true);
            downloadSnapshot(backup,'vkach-history');
          });
        }).catch(backupFailure);
      };
    }
    var generation = 0;
    loadHistory = function () {
      var request = ++generation;
      Promise.resolve(saveHistory?.list()).then(function (entries) {
        if (!history.isConnected || request !== generation) return;
        if (!entries) throw new Error('history unavailable');
        list.replaceChildren();
        if (historyWriteFailed) list.append(el('p','pl-s','Не удалось записать одну из копий. Текущее сохранение доступно для экспорта.'));
        if (!entries.length) { list.append(el('p','pl-s','Копий в истории пока нет. Можно скачать JSON текущего сохранения.')); return; }
        summary.textContent = 'Последняя копия · ' + backupDate(entries[0].at);
        var names = {daily:'Автоматическая копия',restore:'До восстановления',conflict:'Копии при конфликте',import:'До импорта',sync:'До обновления из Google Sheets',
          'cloud-first':'До первой отправки в Firebase','cloud-conflict':'Две версии при конфликте','cloud-restore':'До получения версии из Firebase'};
        for (var row of entries) {
          var card = el('section','pl-history-entry');
          card.append(el('strong',null,names[row.reason] || 'Сохранённая копия'),el('small',null,backupDate(row.at)));
          card.append(dataButton('Восстановить копию',action(row,'local',true)),
            dataButton('Скачать копию',action(row,'local',false)));
          if (row.paired) card.append(dataButton('Скачать вторую версию',action(row,'incoming',false)));
          list.append(card);
        }
      }).catch(function () {
        if (history.isConnected && request === generation) list.replaceChildren(el('p','pl-s','История недоступна. Проверьте предыдущую копию или скачайте JSON.'));
      });
    };
    loadHistory();
  }
  function renderConflict() {
    var snapshot = pendingConflict, local = docs;
    if (snapshot.invalid) {
      menu.append(el('p','pl-s','Сохранённое сравнение повреждено. Синхронизация остановлена. Используйте проверенную резервную копию.'));
      return;
    }
    if (conflictDeferred) { menu.append(dataButton('Сравнить копии',function () { conflictDeferred=false; renderMenu(); })); return; }
    var compare = el('section','pl-section');
    compare.append(el('strong',null,'Сравнение сохранений'),el('p','pl-s','Телефон · ' + profileSummary(local)),
      el('p','pl-s','Google Sheets · ' + profileSummary(snapshot.docs)));
    var details = el('details');
    details.open = conflictExpanded;
    details.ontoggle = function () { if (details.isConnected) conflictExpanded=details.open; };
    details.append(el('summary',null,'Подробные различия'));
    var changes = changeSummary(local,snapshot.docs);
    for (var label of changes) details.append(el('p','pl-s',label));
    compare.append(details,dataButton('СОХРАНИТЬ ОБЛАЧНУЮ КОПИЮ',function () {
      backupFor(snapshot.docs).then(function (copy) { downloadSnapshot(copy,'plan-cloud'); }).catch(backupFailure);
    }));
    ['local', 'remote'].forEach(function (choice) {
      compare.append(dataButton(choice === 'local' ? 'ОСТАВИТЬ ДАННЫЕ ТЕЛЕФОНА' : 'ПРИНЯТЬ КОНФЛИКТУЮЩИЕ ДАННЫЕ ОБЛАКА',function () {
        if (window.confirm('Применить выбор к конфликтующим записям? Обе версии будут сохранены. Отправка в Google Sheets останется ручной.')) {
          resolveConflict(choice,{local:local,conflict:snapshot}).catch(backupFailure);
        }
      }));
    });
    compare.append(dataButton('Отложить решение',function () { conflictDeferred=true; renderMenu(); }));
    menu.append(compare);
  }
  function renderFirebase() {
    var panel=el('section','pl-section'), state=firebaseCloud?.state();
    panel.append(el('strong',null,'Защищённое хранилище'));
    var messages={
      'invalid-remote':'Облачная копия не прошла проверку целостности. Синхронизация остановлена.',
      'missing-remote':'Последняя версия отсутствует в облаке. Автоматическая замена остановлена.',
      'changed-remote':'Облачная версия изменилась. Проверим сохранения снова.',
      'changed-local':'Данные на устройстве изменились. Проверим сохранения снова.',
      'changed-review':'Копии изменились после просмотра. Откройте сравнение заново.',
      'local-blocked':'Перед подключением восстановите локальное сохранение или завершите сравнение Google Sheets.',
      'too-large':'Снимок превышает лимит 2 МиБ. Скачайте JSON и сохраните его отдельно.',
      'empty-local':'Пустое сохранение нельзя отправить вместо облачного.',
      'quota_exceeded':'Не удалось записать защитную копию. Данные не заменены.'
    };
    var detail = firebaseError || (state?.error && (messages[state.error] || 'Синхронизация не завершена. Локальный прогресс доступен.'));
    if (state?.blocked) detail='Сохранение связано с другим аккаунтом Firebase.';
    if (detail) panel.append(el('p','pl-s',detail));
    if (!state?.user) {
      var login=dataButton('Войти через Google · Firebase',function () {
        firebaseError=''; firebaseCloud.signIn().catch(reportFirebaseError);
      });
      login.disabled=!firebaseCloud || !navigator.onLine;
      panel.append(login);
    } else {
      panel.append(el('p','pl-s',state.user.email || 'Аккаунт Google'));
      if (state.signingOut) {
        panel.append(el('p','pl-s','Выходим из аккаунта…'));
        menu.append(panel);
        return;
      }
      panel.append(el('p','pl-s',state.busy ? 'Сверяем версии…' : !navigator.onLine ? 'Офлайн · изменения остаются на устройстве' :
        state.lastSync ? 'Последнее согласование · '+backupDate(state.lastSync) : 'Ожидает первоначального согласования'));
      if (!state.enabled && !state.blocked) panel.append(dataButton('Включить синхронизацию',function () {
        if (window.confirm('Подключить этот профиль? Перед первой отправкой игра сохранит проверенную локальную копию. Если версии различаются, потребуется выбор.')) {
          firebaseError=''; firebaseCloud.enable().then(refreshPush).catch(function () {});
        }
      }));
      if (state.enabled && !state.busy) panel.append(dataButton('Проверить синхронизацию',runCloud));
      panel.append(dataButton('Выйти из Firebase',function () {
        firebaseCloud.signOut().catch(reportFirebaseError);
      }));
      if (state.review) renderFirebaseReview(panel,state.review);
      if (!state.blocked && firebaseMeta().uid===state.user.uid) {
        panel.append(dataButton('Облачные версии',function () {
          firebaseCloud.history().then(function (rows) { archivedCloud={uid:state.user.uid,rows:rows}; renderChip(); }).catch(reportFirebaseError);
        }));
        if (archivedCloud?.uid===state.user.uid) {
          if (!archivedCloud.rows.length) panel.append(el('p','pl-s','Предыдущих облачных версий пока нет.'));
          for (const row of archivedCloud.rows) {
            panel.append(el('p','pl-s','Версия '+row.head.revision+' · '+backupDate(row.head.savedAt)),
              dataButton('Восстановить версию '+row.head.revision,()=>reviewBackup(row.records,true).catch(backupFailure)),
              dataButton('Скачать версию '+row.head.revision,()=>downloadSnapshot(JSON.parse(row.head.payload),'vkach-cloud')));
          }
        }
      }
      if (CFG.cloud.vapidKey && !state.blocked) renderPushSettings(panel,state);
    }
    menu.append(panel);
  }
  function renderFirebaseReview(panel,review) {
    if (conflictDeferred) { panel.append(dataButton('Сравнить версии Firebase',()=>{conflictDeferred=false;renderMenu();})); return; }
    var compare=el('section','pl-section');
    compare.append(el('strong',null,'Конфликт сохранений'),
      el('p','pl-s','Устройство · '+profileSummary(review.local)),
      el('p','pl-s','Облачная версия '+review.revision+' · '+profileSummary(review.remote)));
    var details=el('details');
    details.append(el('summary',null,'Подробные различия'));
    for (var label of changeSummary(review.local,review.remote)) details.append(el('p','pl-s',label));
    compare.append(details);
    for (const [choice,title] of [['local','Оставить локальную версию'],['remote','Использовать облачную версию']]) {
      compare.append(dataButton(title,()=>{
        if (window.confirm(title+'? Обе версии уже сохранены в истории копий.')) {
          firebaseCloud.resolve(choice).then(refreshPush).catch(function () { scheduleCloud(); });
        }
      }));
    }
    compare.append(dataButton('Отложить решение',()=>{conflictDeferred=true;renderMenu();}));
    panel.append(compare);
  }
  function renderPushSettings(panel,state) {
    var subscription=jget(PUSH_KEY,null), enabled=Boolean(subscription?.enabled && subscription.uid===state.user.uid);
    panel.append(el('p','pl-s',pushStatus || (enabled?'Фоновые уведомления включены':'Фоновые уведомления отключены')));
    var button=dataButton(enabled?'Отключить Push':'Включить Push',function () {
      button.disabled=true;
      (enabled?disablePush():enablePush()).catch(function () {
        pushStatus='Не удалось изменить Push. Проверьте подключение и разрешение Chrome.';
        renderChip();
      });
    });
    button.disabled=!enabled && (!state.enabled || !firebaseMeta().revision);
    panel.append(button);
  }
  function renderMenu() {
    menu.textContent = '';
    menu.appendChild(el('div', 'pl-t', 'АККАУНТ И СОХРАНЕНИЯ'));
    if (window.APP_VERSION) menu.appendChild(el('div', 'pl-s', 'Версия ' + window.APP_VERSION));
    if (CFG.testMode) menu.appendChild(el('div', 'pl-s', 'ТЕСТОВАЯ ВЕРСИЯ · отдельные сохранения. ' + (cloudAllowed ? 'Тестовая таблица Google.' : 'Google отключён. Основная таблица не используется.')));
    var line = (corruptRaw !== null ? 'Обнаружено повреждение сохранения. Доступ только для чтения. Скачайте исходный файл и восстановите проверенную копию.' : writeFailure ? 'Последнее изменение не сохранено: недостаточно места или хранилище недоступно. Скачайте копию сохранённых данных, освободите место и повторите действие.' : upgradeBlocked ? 'Прогресс только для чтения. Скачайте копию, освободите место и перезагрузите приложение.' : pendingConflict ? 'Конфликт устройств. Синхронизация приостановлена. Сохраните обе копии перед выбором.' : status.text) || (!navigator.onLine ? 'Нет сети: всё сохранено на телефоне' : firebaseConfigured ? 'Локальные копии доступны без подключения' : (meta.signed ? fmtAgo(meta.lastSync) : 'Данные только на этом телефоне'));
    menu.appendChild(el('div', 'pl-s', line));
    if (cloudAllowed && meta.signed) menu.appendChild(el('div','pl-s',(meta.hint || 'Аккаунт Google') +
      ' · Google Sheets · ' + (meta.lastSync ? 'Последняя синхронизация ' + backupDate(meta.lastSync) : 'Синхронизации ещё не было')));
    var b;
    if (corruptRaw !== null) { b = el('button', 'pl-b', 'СКАЧАТЬ ПОВРЕЖДЁННЫЙ ОРИГИНАЛ'); b.onclick = function () { downloadSnapshot({ format: 'vkach-damaged-store', raw: corruptRaw }, 'vkach-damaged'); }; menu.appendChild(b); }
    b = el('button', 'pl-b', 'СОХРАНИТЬ РЕЗЕРВНУЮ КОПИЮ'); b.onclick = function () { exportBackup().catch(function () { setStatus('Не удалось создать копию', 'warn'); }); }; menu.appendChild(b);
    if (pendingConflict) renderConflict();
    if (updateReady) {
      b = el('button', 'pl-b go', 'ОБНОВИТЬ ПРИЛОЖЕНИЕ'); b.onclick = function () { Promise.resolve(window.PlanSync.beforeUpdate ? window.PlanSync.beforeUpdate() : null).then(function () { return exclusive(function () { if (!jset(UPGRADE, { v: 1, docs: persistedDocs() })) throw storageError(); if (swReg && swReg.waiting) swReg.waiting.postMessage('SKIP_WAITING'); }); }).catch(function () { setStatus('Обновление отложено: не удалось сохранить резервную копию. Скачайте копию и освободите место.', 'warn'); }); }; menu.appendChild(b);
    }
    if (firebaseConfigured) renderFirebase();
    else {
      b = el('button', 'pl-b go', meta.signed ? 'СИНХРОНИЗИРОВАТЬ' : 'ВОЙТИ ЧЕРЕЗ GOOGLE');
      b.onclick = function () { sync(true); }; b.disabled = !cloudAllowed; menu.appendChild(b);
    }
    if (meta.signed && !firebaseConfigured) {
      b = el('button', 'pl-b', 'ВЫЙТИ'); b.onclick = function () {
        b.disabled=true;
        signOut().catch(function () { setStatus('Не удалось сохранить состояние выхода.','warn'); });
      }; menu.appendChild(b);
    }
    b = el('button', 'pl-b', 'ИМПОРТ ИЗ ФАЙЛА');
    b.onclick = function () { restoreFile = false; fileIn.click(); }; menu.appendChild(b);
    b = el('button', 'pl-b', 'ВОССТАНОВИТЬ КОПИЮ ИЗ ФАЙЛА'); b.onclick = function () { restoreFile = true; fileIn.click(); }; menu.appendChild(b);
    renderSaveHistory();
    if (jget(UPGRADE, null)) {
      b = el('button', 'pl-b', 'СКАЧАТЬ КОПИЮ ДО ОБНОВЛЕНИЯ'); b.onclick = function () { var copy = jget(UPGRADE, null); if (copy) downloadSnapshot(copy, 'plan-before-update'); }; menu.appendChild(b);
    }
    if (jget(CHECKPOINT, null)) {
      b = el('button', 'pl-b', 'СКАЧАТЬ ПРЕДЫДУЩЕЕ СОХРАНЕНИЕ'); b.onclick = function () { var copy=jget(CHECKPOINT,null); if(copy)backupFor(copy.docs).then(function(value){downloadSnapshot(value,'vkach-previous');}).catch(function(){setStatus('Не удалось прочитать предыдущую копию.','warn');}); }; menu.appendChild(b);
    }
    if (jget(RECOVERY, null)) {
      b = el('button', 'pl-b', 'СКАЧАТЬ КОПИЮ ДО ПОСЛЕДНЕЙ ЗАМЕНЫ'); b.onclick = function () { var copy = jget(RECOVERY, null); if (copy) downloadSnapshot({ v: 1, docs: copy.docs }, 'plan-recovery'); }; menu.appendChild(b);
    }
    menu.appendChild(el('div', 'pl-s', 'Перед сменой устройства завершите синхронизацию. Не расходуйте общий запас одновременно офлайн на двух устройствах. Восстановление из файла отключает автосинхронизацию до входа.'));
    b = el('button', 'pl-b', 'ЗАКРЫТЬ'); b.onclick = closeData; menu.appendChild(b);
  }
  var fileIn, restoreFile = false;
  function ui() {
    var st = document.createElement('style');
    st.textContent =
      '.pl-bar{position:static;display:flex;gap:6px;align-items:stretch}.pl-chip{position:static;font:9px/1 var(--font-display,monospace);padding:7px 8px;border:2px solid var(--line,#4a3d2f);background:var(--panel,#261f18);color:var(--muted,#a99a83);cursor:pointer;opacity:.9}' +
      '.pl-chip.ok{color:var(--good,#86c05e)}.pl-chip.warn{color:var(--gold,#e8b13c)}.pl-chip.off{color:var(--muted,#a99a83)}.pl-chip.upd{color:#111;background:var(--gold,#e8b13c)}.pl-chip.work{color:var(--fg,#f0e6d3)}' +
      '.pl-menu{position:fixed;top:44px;left:6px;z-index:9999;width:min(300px,calc(100vw - 12px));background:var(--panel,#261f18);border:3px solid var(--line,#4a3d2f);padding:12px;max-height:calc(100dvh - 56px);overflow:auto;display:flex;flex-direction:column;gap:8px}' +
      '.pl-menu{box-sizing:border-box;overflow-wrap:anywhere}.pl-b{min-height:44px}.pl-menu[hidden]{display:none}.pl-t{font:10px/1.4 var(--font-display,monospace);color:var(--gold,#e8b13c)}.pl-s{font:18px/1.2 var(--font-body,monospace);color:var(--fg,#f0e6d3)}' +
      '.pl-b{font:9px/1.3 var(--font-display,monospace);padding:10px;border:3px solid var(--line,#4a3d2f);background:var(--bg,#1a1511);color:var(--fg,#f0e6d3);cursor:pointer;text-align:center}.pl-b.go{border-color:var(--gold,#e8b13c);color:var(--gold,#e8b13c)}';
    document.head.appendChild(st);
    chip = el('button', 'pl-chip', '');
    chip.type = 'button';
    menu = el('div', 'pl-menu'); menu.hidden = true; menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','Аккаунт и сохранения');
    fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.hidden = true;
    fileIn.onchange = function () {
      var f = fileIn.files && fileIn.files[0], restoring = restoreFile; if (!f) return;
      if (f.size > 16 * 1024 * 1024) { fileIn.value=''; setStatus('Файл копии слишком большой. Данные не изменены.','warn'); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var value;
        try { value = parseBackupText(rd.result); } catch (e) { setStatus('Не удалось прочитать файл', 'warn'); fileIn.value = ''; return; }
        validateBackup(value, restoring).then(function (incoming) { return reviewBackup(incoming,restoring); }).catch(backupFailure);
        fileIn.value = '';
      };
      rd.onerror = function () { fileIn.value = ''; setStatus('Не удалось открыть файл. Данные не заменены.', 'warn'); };
      rd.readAsText(f);
    };
    chip.onclick = function () {
      if(menu.hidden)openData();else closeData();
    };
    var bar = el('div', 'pl-bar'); bar.appendChild(chip);
    var tbtn = document.getElementById('trophy-btn'); if (tbtn) bar.appendChild(tbtn);
    var gear = document.getElementById('gear'); if (gear) bar.appendChild(gear);
    var slot = document.getElementById('plslot');
    if (slot) slot.appendChild(bar); else { bar.style.cssText = 'position:absolute;top:12px;left:84px;z-index:9999'; document.body.appendChild(bar); }
    document.body.appendChild(menu); document.body.appendChild(fileIn);
    renderChip();
  }

  // ---- service worker --------------------------------------------------
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    var reloading = false, controllerAtLoad = navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      var current = navigator.serviceWorker.controller;
      if (!controllerAtLoad || current === controllerAtLoad) { controllerAtLoad = current; return; }
      if (reloading) return;
      reloading = true;
      // A newly loaded page can receive the delayed clients.claim event for
      // its own build. Reload only when the controller serves different code.
      var version = new Promise(function (resolve) {
        var channel = new MessageChannel(), timeout = setTimeout(function () { channel.port1.close(); resolve(null); }, 1500);
        channel.port1.onmessage = function (event) { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
        current.postMessage('APP_BUILD', [channel.port2]);
      });
      version.then(function (build) {
        if (build && build === window.APP_BUILD) { controllerAtLoad = current; reloading = false; return; }
        return Promise.resolve(window.PlanSync.beforeUpdate ? window.PlanSync.beforeUpdate() : null).then(function () { location.reload(); });
      }).catch(function(){reloading=false;setStatus('Обновление отложено: есть несохранённое изменение. Скачайте копию и повторите действие.','warn');});
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      swReg = reg;
      function check() {
        var ready = !!(reg.waiting && navigator.serviceWorker.controller);
        if (ready !== updateReady) { updateReady = ready; renderChip(); }
      }
      function watchInstall() {
        var worker = reg.installing;
        if (worker) worker.addEventListener('statechange', check);
        check();
      }
      function checkOnline() {
        if (!document.hidden && navigator.onLine) reg.update().then(check).catch(function () {});
      }
      watchInstall();
      reg.addEventListener('updatefound', watchInstall);
      document.addEventListener('visibilitychange', checkOnline);
      window.addEventListener('online', checkOnline);
      if (navigator.serviceWorker.controller) checkOnline();
    }).catch(function () {});
  }

  // ---- запуск ------------------------------------------------------------
  function start() {
    archiveDay();
    archiveChange(jget(RECOVERY,null));
    ui(); registerSW();
    startFirebase();
    window.addEventListener('online', function () {
      renderChip();
      if (firebaseConfigured) { if (firebaseCloud) scheduleCloud(); else startFirebase(); }
      else if (meta.signed) sync(false);
    });
    window.addEventListener('offline', renderChip);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && meta.signed && navigator.onLine) sync(false);
    });
    setInterval(function () {
      renderChip();
      if (firebaseConfigured) {
        if (cloudRetry) runCloud();
        else refreshPush().catch(function () {});
      } else if (!document.hidden && meta.signed && navigator.onLine && haveToken()) sync(false);
    }, 60000);
    if (meta.signed && navigator.onLine) sync(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.PlanSync = { sync: sync, importObj: importObj, exportBackup: exportBackup, backupFor: backupFor, validateBackup: validateBackup, openData: openData, resolveConflict: resolveConflict, bindReminders:bindReminders, pushShownToday:pushShownToday, _docs: function () { return docs; }, _merge: merge };
})();
