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
  // The isolated Android build has no cloud access until a separate OAuth
  // client and its exact HTTPS origin have been explicitly configured.
  var cloudAllowed = !CFG.testMode || (CFG.cloudEnabled === true &&
    CFG.clientId && CFG.clientId !== CFG.productionClientId &&
    /^https:\/\//.test(CFG.allowedOrigin || '') && CFG.allowedOrigin === location.origin &&
    CFG.fileName === 'plan-data-android-test');
  var FILE_NAME = CFG.fileName || 'plan-data';
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';

  var docs = {};      // path -> {d, u}
  var meta = {};      // fileId, lastSync, user
  var subs = [];      // {path|col, kind, cb}
  var dirty = false, revision = 0, writeFailure = false, corruptRaw = null;
  var pendingConflict = jget(CONFLICT, null);

  function jget(k, def) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

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
    if (e.key === CONFLICT) { pendingConflict = jget(CONFLICT, null); renderChip(); }
    if (e.key === META) { meta = jget(META, {}) || {}; renderChip(); }
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
  function recovery(local, remote) {
    // Never replace progress if the pre-change copy cannot be written.
    if (!jset(RECOVERY, { v: 1, docs: local, remote: remote || {}, savedAt: Date.now(), originalDamagedStore: corruptRaw })) throw storageError();
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
    var rd = clone(validDocs(remote && remote.docs));
    return exclusive(function () {
      if (upgradeBlocked) throw storageError();
      var local = persistedDocs(), next = clone(local), changedLocal = false, changedRemote = false, conflicts = [];
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
        // Rebuildable monthly Will reports are projections of the synced events.
        if (options.detect && !p.startsWith('chains-ledger/') && l && !same(l.d, r.d) &&
            (l.u === r.u || (l.u > (meta.lastSync || 0) && r.u > (meta.lastSync || 0))) &&
            !(meta.accepted && meta.accepted[p] === JSON.stringify(r))) conflicts.push(p);
        if (!l || r.u > l.u) { next[p] = clone(r); changedLocal = true; }
        else if (l.u > r.u || !same(l.d, r.d)) changedRemote = true;
      });
      Object.keys(local).forEach(function (p) { if (!rd[p]) changedRemote = true; });
      if (conflicts.length) {
        recovery(local, rd);
        var pending = { docs: rd, paths: conflicts };
        if (!jset(CONFLICT, pending)) throw storageError();
        pendingConflict = pending;
        throw new Error('conflict');
      }
      if (changedLocal) {
        recovery(local, rd);
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
  function backupFor(records) {
    var copy = { v: 2, format: 'vkach-backup', createdAt: new Date().toISOString(), appVersion: window.APP_VERSION || 'legacy', docs: clone(validDocs(records)) };
    return digest(copy).then(function (hash) { copy.integrity = { algorithm: 'SHA-256', value: hash }; return copy; });
  }
  function parseBackupText(text) {
    var value=JSON.parse(text), at=0;
    function ws(){while(/\s/.test(text.charAt(at))&&at<text.length)at++;}
    function str(){var start=at++;while(at<text.length){var c=text.charAt(at++);if(c==='\\')at++;else if(c==='"')break;}return JSON.parse(text.slice(start,at));}
    function scan(){ws();var c=text.charAt(at);
      if(c==='{'){at++;ws();var keys=new Set();if(text.charAt(at)==='}'){at++;return;}while(at<text.length){ws();var key=str();if(keys.has(key))throw new Error('duplicate record');keys.add(key);ws();at++;scan();ws();if(text.charAt(at++)==='}')return;}}
      else if(c==='['){at++;ws();if(text.charAt(at)===']'){at++;return;}while(at<text.length){scan();ws();if(text.charAt(at++)===']')return;}}
      else if(c==='"')str();else while(at<text.length&&!/[\s,}\]]/.test(text.charAt(at)))at++;
    }
    scan();return value;
  }
  function validateBackup(o, restore) {
    return Promise.resolve().then(function () {
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('bad format');
      if (o.v !== undefined && o.v !== 1 && o.v !== 2) throw new Error('unsupported schema');
      if (o.v === 2) {
        if (o.format !== 'vkach-backup' || !o.createdAt || !Number.isFinite(Date.parse(o.createdAt)) || typeof o.appVersion !== 'string' ||
            !o.integrity || o.integrity.algorithm !== 'SHA-256' || !/^[a-f0-9]{64}$/.test(o.integrity.value)) throw new Error('bad format');
        var unsigned = clone(o); delete unsigned.integrity;
        return digest(unsigned).then(function (hash) { if (hash !== o.integrity.value) throw new Error('integrity'); return clone(validDocs(o.docs)); });
      }
      var incoming;
      if (o.seed && !restore) {
        incoming = {};
        Object.keys(o.seed).forEach(function (p) { incoming[p] = { d: o.seed[p], u: 1 }; });
      } else if (o.docs) incoming = o.docs;
      else throw new Error('bad format');
      return clone(validDocs(incoming));
    });
  }
  function importObj(o, restore) {
    return validateBackup(o, restore).then(function (incoming) { return applyImport(incoming, restore); });
  }
  function applyImport(incoming, restore) {
    if (restore) return syncExclusive(function () { return exclusive(function () {
      meta = jget(META, {}) || {};
      var local = corruptRaw !== null ? clone(docs) : persistedDocs(), next = {}, now = Date.now();
      recovery(local, incoming);
      Object.keys(Object.assign({}, local, incoming)).forEach(function (p) {
        next[p] = { d: discoveryPaths.includes(p)&&((local[p]&&local[p].d)||(incoming[p]&&incoming[p].d)) ? retainDiscovery(p,local[p]&&local[p].d,incoming[p]&&incoming[p].d) : incoming[p] ? incoming[p].d : null, u: Math.max(now, (local[p] && local[p].u || 0) + 1, (incoming[p] && incoming[p].u || 0) + 1) };
      });
      // Persist the cloud pause before replacing data, even if later storage fails.
      meta.signed = false; meta.syncPaused = true;
      if (!jset(META, meta)) throw storageError();
      if (!jset(KEY, { v: 1, docs: next })) throw storageError();
      docs = next; corruptRaw = null; upgradeBlocked = false; writeFailure = false; dirty = true; revision++; notify();
      localStorage.removeItem(CONFLICT); pendingConflict = null; renderChip();
      return Object.keys(incoming).length;
    }); });
    return merge({ docs: incoming }).then(function () { dirty = true; revision++; notify(); scheduleSync(); return Object.keys(incoming).length; });
  }
  function resolveConflict(choice) {
    if (!pendingConflict || ['local', 'remote'].indexOf(choice) < 0) return Promise.reject(new Error('conflict'));
    return syncExclusive(function () { return exclusive(function () {
      pendingConflict = jget(CONFLICT, null);
      if (!pendingConflict) throw new Error('conflict');
      var local = persistedDocs(), remote = validDocs(pendingConflict.docs), next = clone(local), accepted = Object.assign({}, meta.accepted || {});
      recovery(local, remote);
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

  // ---- Google Диск -----------------------------------------------------
  var token = null, tokenExp = 0, tokClient = null, gsiLoading = null;
  (function () { var t = jget(TOKEN_KEY, null); if (t && t.t && t.exp > Date.now() + 60000) { token = t.t; tokenExp = t.exp; } })();
  var status = { text: '', cls: '' };
  var busy = false, syncTimer = null, waiting = null;

  function setStatus(t, cls) { status = { text: t, cls: cls || '' }; renderChip(); }
  function haveToken() { return token && Date.now() < tokenExp - 30000; }

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
    if (haveToken()) return Promise.resolve(token);
    if (!CFG.clientId) return Promise.reject(new Error('noclient'));
    if (!navigator.onLine) return Promise.reject(new Error('offline'));
    return loadGsi().then(function () {
      return new Promise(function (res, rej) {
        tokClient = google.accounts.oauth2.initTokenClient({
          client_id: CFG.clientId, scope: SCOPE,
          callback: function (r) {
            if (r && r.access_token) {
              token = r.access_token; tokenExp = Date.now() + (r.expires_in || 3600) * 1000;
              jset(TOKEN_KEY, { t: token, exp: tokenExp });
              meta.signed = true; saveMeta();
              if (!meta.hint) {
                fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { Authorization: 'Bearer ' + token } })
                  .then(function (x) { return x.json(); })
                  .then(function (j) { if (j && j.user && j.user.emailAddress) { meta.hint = j.user.emailAddress; saveMeta(); } })
                  .catch(function () {});
              }
              res(token);
            } else rej(new Error(r && r.error ? r.error : 'auth'));
          },
          error_callback: function (e) { rej(new Error((e && e.type) || 'auth')); }
        });
        tokClient.requestAccessToken(meta.hint ? { prompt: '', hint: meta.hint } : { prompt: interactive ? 'select_account' : '' });
      });
    });
  }

  function api(url, opt) {
    if (!cloudAllowed) return Promise.reject(new Error('testcloud'));
    opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + token }, opt.headers || {});
    return fetch(url, opt).then(function (r) {
      if (r.status === 401) { token = null; tokenExp = 0; jset(TOKEN_KEY, null); throw new Error('auth'); }
      if (!r.ok) throw new Error('http' + r.status);
      return r;
    });
  }

  var TAB = 'data';
  function findFile() {
    if (meta.sheetId) return Promise.resolve(meta.sheetId);
    var q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and name='" + FILE_NAME + "' and trashed=false");
    return api('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&spaces=drive')
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.files && j.files.length) { meta.sheetId = j.files[0].id; saveMeta(); return meta.sheetId; } return null; });
  }
  // Таблица: строка = запись. Колонки: path | json | u. Пустой json = запись удалена.
  function readRows(id) {
    return api('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values/' + TAB + '!A:C?valueRenderOption=UNFORMATTED_VALUE')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var out = {};
        if (!Array.isArray(j.values)) throw new Error('incomplete remote data');
        j.values.forEach(function (row, i) {
          if (i === 0 && row[0] === 'path') return;
          if (!Array.isArray(row)) throw new Error('bad remote row');
          if (!row.length) return;
          var path = row[0]; if (!path || typeof path !== 'string' || row.length < 3 || !Number.isFinite(Number(row[2])) || Number(row[2]) < 0) throw new Error('bad remote row');
          if (Object.prototype.hasOwnProperty.call(out, path)) throw new Error('duplicate remote record');
          var d = null, js = row[1];
          if (js !== undefined && js !== '') { d = JSON.parse(String(js)); }
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
  function doSync(interactive) {
    if (!cloudAllowed) { setStatus('ТЕСТОВАЯ ВЕРСИЯ: Google отключён. Данные остаются только на этом устройстве.', 'warn'); return Promise.resolve(); }
    meta = jget(META, meta) || {}; pendingConflict = jget(CONFLICT, null);
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
  var dataHistoryOpen=false,dataHost=null;
  function restoreDataHost(){
    if(!dataHost)return;var saved=dataHost;dataHost=null;
    saved.blocked.forEach(function(row){row[0].inert=row[1];});
    saved.parent.insertBefore(menu,saved.next);
    if(saved.focus&&saved.focus.isConnected&&saved.focus.getClientRects().length)saved.focus.focus({preventScroll:true});
  }
  function openData(){
    if(!menu.hidden)return;
    var dialog=document.querySelector('.citadel-system-dialog[open]');
    if(dialog){var host=dialog.querySelector('#setup:not([hidden])')||dialog;dataHost={parent:menu.parentNode,next:menu.nextSibling,focus:document.activeElement,blocked:[]};host.appendChild(menu);dataHost.blocked=Array.from(host.children).filter(function(n){return n!==menu;}).map(function(n){var old=n.inert;n.inert=true;return [n,old];});}
    menu.hidden=false;renderMenu();dataHistoryOpen=true;history.pushState(Object.assign({},history.state,{planData:true}),'');
    requestAnimationFrame(function(){if(!menu.hidden){var first=menu.querySelector('button');if(first)first.focus({preventScroll:true});}});
  }
  function closeData(){menu.hidden=true;restoreDataHost();if(history.state&&history.state.planData)history.back();}
  window.addEventListener('popstate',function(event){if(menu)menu.hidden=true;restoreDataHost();if(dataHistoryOpen){dataHistoryOpen=false;event.stopImmediatePropagation();}},true);
  window.addEventListener('keydown',function(event){if(event.key==='Escape'&&menu&&!menu.hidden){event.preventDefault();event.stopImmediatePropagation();closeData();}},true);
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function renderMenu() {
    menu.textContent = '';
    menu.appendChild(el('div', 'pl-t', 'ДАННЫЕ И РЕЗЕРВНЫЕ КОПИИ'));
    if (window.APP_VERSION) menu.appendChild(el('div', 'pl-s', 'Версия ' + window.APP_VERSION));
    if (CFG.testMode) menu.appendChild(el('div', 'pl-s', 'ТЕСТОВАЯ ВЕРСИЯ · отдельные сохранения. ' + (cloudAllowed ? 'Тестовая таблица Google.' : 'Google отключён. Основная таблица не используется.')));
    var line = (corruptRaw !== null ? 'Обнаружено повреждение сохранения. Доступ только для чтения. Скачайте исходный файл и восстановите проверенную копию.' : writeFailure ? 'Последнее изменение не сохранено: недостаточно места или хранилище недоступно. Скачайте копию сохранённых данных, освободите место и повторите действие.' : upgradeBlocked ? 'Прогресс только для чтения. Скачайте копию, освободите место и перезагрузите приложение.' : pendingConflict ? 'Конфликт устройств. Синхронизация приостановлена. Сохраните обе копии перед выбором.' : status.text) || (!navigator.onLine ? 'Нет сети: всё сохранено на телефоне' : (meta.signed ? fmtAgo(meta.lastSync) : 'Данные только на этом телефоне'));
    menu.appendChild(el('div', 'pl-s', line));
    var b;
    if (corruptRaw !== null) { b = el('button', 'pl-b', 'СКАЧАТЬ ПОВРЕЖДЁННЫЙ ОРИГИНАЛ'); b.onclick = function () { downloadSnapshot({ format: 'vkach-damaged-store', raw: corruptRaw }, 'vkach-damaged'); }; menu.appendChild(b); }
    b = el('button', 'pl-b', 'СОХРАНИТЬ РЕЗЕРВНУЮ КОПИЮ'); b.onclick = function () { exportBackup().catch(function () { setStatus('Не удалось создать копию', 'warn'); }); }; menu.appendChild(b);
    if (pendingConflict) {
      b = el('button', 'pl-b', 'СОХРАНИТЬ ОБЛАЧНУЮ КОПИЮ'); b.onclick = function () { downloadSnapshot({ v: 1, docs: pendingConflict.docs }, 'plan-cloud'); }; menu.appendChild(b);
      ['local', 'remote'].forEach(function (choice) {
        var button = el('button', 'pl-b', choice === 'local' ? 'ОСТАВИТЬ ДАННЫЕ ТЕЛЕФОНА' : 'ПРИНЯТЬ КОНФЛИКТУЮЩИЕ ДАННЫЕ ОБЛАКА');
        button.onclick = function () { if (window.confirm('Заменить конфликтующие записи выбранной копией? Предыдущие данные останутся в копии до следующего импорта или слияния.')) resolveConflict(choice).catch(function () { setStatus('Не удалось сохранить выбор. Копии не удалены.', 'warn'); }); };
        menu.appendChild(button);
      });
    }
    if (updateReady) {
      b = el('button', 'pl-b go', 'ОБНОВИТЬ ПРИЛОЖЕНИЕ'); b.onclick = function () { Promise.resolve(window.PlanSync.beforeUpdate ? window.PlanSync.beforeUpdate() : null).then(function () { return exclusive(function () { if (!jset(UPGRADE, { v: 1, docs: persistedDocs() })) throw storageError(); if (swReg && swReg.waiting) swReg.waiting.postMessage('SKIP_WAITING'); }); }).catch(function () { setStatus('Обновление отложено: не удалось сохранить резервную копию. Скачайте копию и освободите место.', 'warn'); }); }; menu.appendChild(b);
    }
    b = el('button', 'pl-b go', meta.signed ? 'СИНХРОНИЗИРОВАТЬ' : 'ВОЙТИ ЧЕРЕЗ GOOGLE');
    b.onclick = function () { sync(true); }; b.disabled = !cloudAllowed; menu.appendChild(b);
    if (meta.signed) {
      b = el('button', 'pl-b', 'ВЫЙТИ'); b.onclick = function () {
        try { if (window.google && token) google.accounts.oauth2.revoke(token, function () {}); } catch (e) {}
        token = null; tokenExp = 0; jset(TOKEN_KEY, null); meta.signed = false; delete meta.sheetId; delete meta.hint; saveMeta(); setStatus('', ''); renderChip();
      }; menu.appendChild(b);
    }
    b = el('button', 'pl-b', 'ИМПОРТ ИЗ ФАЙЛА');
    b.onclick = function () { restoreFile = false; fileIn.click(); }; menu.appendChild(b);
    b = el('button', 'pl-b', 'ВОССТАНОВИТЬ КОПИЮ ИЗ ФАЙЛА'); b.onclick = function () { restoreFile = true; fileIn.click(); }; menu.appendChild(b);
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
    menu = el('div', 'pl-menu'); menu.hidden = true; menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','Данные и резервные копии');
    fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.hidden = true;
    fileIn.onchange = function () {
      var f = fileIn.files && fileIn.files[0], restoring = restoreFile; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var value;
        try { value = parseBackupText(rd.result); } catch (e) { setStatus('Не удалось прочитать файл', 'warn'); fileIn.value = ''; return; }
        validateBackup(value, restoring).then(function (incoming) {
          var count = Object.keys(incoming).filter(function (p) { return incoming[p].d !== null; }).length;
          if (!window.confirm((restoring ? 'Восстановить весь прогресс? Записи, которых нет в копии, будут удалены. ' : 'Объединить записи с файлом? Более новые записи могут заменить текущие. ') +
              'В файле: ' + count + ' записей. Текущая копия будет сохранена отдельно. Можно отменить.')) {setStatus('Операция отменена. Данные не изменены.','');return;}
          setStatus('Проверенный файл: сохраняем данные. Не закрывайте приложение.', 'work');
          return Promise.resolve(window.PlanSync.beforeUpdate ? window.PlanSync.beforeUpdate() : null).then(function () { return applyImport(incoming, restoring); }).then(function (n) {
            setStatus('Сохранено записей: ' + n + (restoring ? '. Проверьте прогресс перед включением облака.' : ''), 'ok');
          });
        }).catch(function (e) {
          setStatus(e.message === 'integrity' ? 'Копия повреждена: проверка целостности не пройдена. Данные не заменены.' : e.message === 'unsupported schema' ?
            'Эта версия копии пока не поддерживается. Данные не заменены.' : 'Импорт не сохранён. Проверьте файл и свободное место.', 'warn');
        });
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
    ui(); registerSW();
    window.addEventListener('online', function () { renderChip(); if (meta.signed) sync(false); });
    window.addEventListener('offline', renderChip);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && meta.signed && navigator.onLine) sync(false);
    });
    setInterval(function () { renderChip(); if (!document.hidden && meta.signed && navigator.onLine && haveToken()) sync(false); }, 60000);
    if (meta.signed && navigator.onLine) sync(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.PlanSync = { sync: sync, importObj: importObj, exportBackup: exportBackup, backupFor: backupFor, validateBackup: validateBackup, openData: openData, resolveConflict: resolveConflict, _docs: function () { return docs; }, _merge: merge };
})();
