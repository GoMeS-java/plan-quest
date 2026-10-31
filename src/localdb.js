/* localdb.js: локальная база с тем же интерфейсом, что давал claude.use('db'),
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
  var TOKEN_KEY = PREFIX + 'tok';
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
  var dirty = false, revision = 0;
  var pendingConflict = jget(CONFLICT, null);

  function jget(k, def) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  docs = (jget(KEY, { docs: {} }) || {}).docs || {};
  meta = jget(META, {}) || {};
  var upgradeBlocked = false;
  // Runs before game subscriptions can write, including an update from older
  // clients which did not yet have a backup button.
  if (window.APP_VERSION && meta.dataVersion !== window.APP_VERSION) {
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
      var raw = localStorage.getItem(KEY), persisted = raw ? JSON.parse(raw) : { docs: {} };
      if (!persisted || !persisted.docs || typeof persisted.docs !== 'object' || Array.isArray(persisted.docs)) throw new Error('Invalid saved database');
      var next = clone(persisted.docs || {}), changed = false;
      var tx = {
        get: function (p) { return next[p] && clone(next[p].d); },
        list: function (c) { return Object.keys(next).filter(function (p) { return colOf(p) === c && next[p].d != null; }).map(function (p) { return Object.assign({}, clone(next[p].d), { id: idOf(p) }); }); },
        set: function (p, d) { next[p] = { d: clone(d), u: Math.max(Date.now(), (next[p] && next[p].u || 0) + 1) }; changed = true; },
        delete: function (p) { tx.set(p, null); }
      };
      var result = fn(tx);
      if (result && typeof result.then === 'function') throw new Error('Transaction callback must be synchronous');
      if (changed) {
        if (!jset(KEY, { v: 1, docs: next })) { var error = new Error('Storage unavailable'); error.code = 'quota_exceeded'; throw error; }
        docs = next; dirty = true; revision++; notify(); scheduleSync();
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
    if (e.key === KEY) { docs = (jget(KEY, { docs: {} }) || {}).docs || {}; dirty = true; revision++; notify(); scheduleSync(); }
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
  window.claude = window.claude || {};
  if (!window.claude.use) window.claude.use = function (n) { return Promise.resolve(n === 'db' ? db : null); };

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
    return validDocs(saved.docs);
  }
  function exclusive(fn) { return navigator.locks ? navigator.locks.request(KEY, fn) : Promise.resolve().then(fn); }
  function recovery(local, remote) {
    // Never replace progress if the pre-change copy cannot be written.
    if (!jset(RECOVERY, { v: 1, docs: local, remote: remote || {}, savedAt: Date.now() })) throw storageError();
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function merge(remote, options) {
    options = options || {};
    var rd = clone(validDocs(remote && remote.docs));
    return exclusive(function () {
      if (upgradeBlocked) throw storageError();
      var local = persistedDocs(), next = clone(local), changedLocal = false, changedRemote = false, conflicts = [];
      Object.keys(rd).forEach(function (p) {
        var l = local[p], r = rd[p];
        // This is detection, not a distributed transaction. Device clock skew
        // and concurrent full-sheet uploads still require manual verification.
        if (options.detect && l && !same(l.d, r.d) &&
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
  function importObj(o, restore) {
    var incoming;
    if (o && o.seed && !restore) {
      incoming = {};
      Object.keys(o.seed).forEach(function (p) { incoming[p] = { d: o.seed[p], u: 1 }; });
    } else if (o && o.docs) incoming = o.docs;
    else return Promise.reject(new Error('bad format'));
    try { incoming = clone(validDocs(incoming)); } catch (e) { return Promise.reject(e); }
    if (restore) return syncExclusive(function () { return exclusive(function () {
      meta = jget(META, {}) || {};
      var local = persistedDocs(), next = {}, now = Date.now();
      recovery(local, incoming);
      Object.keys(Object.assign({}, local, incoming)).forEach(function (p) {
        next[p] = { d: incoming[p] ? incoming[p].d : null, u: Math.max(now, (local[p] && local[p].u || 0) + 1, (incoming[p] && incoming[p].u || 0) + 1) };
      });
      // Persist the cloud pause before replacing data, even if later storage fails.
      meta.signed = false; meta.syncPaused = true;
      if (!jset(META, meta)) throw storageError();
      if (!jset(KEY, { v: 1, docs: next })) throw storageError();
      docs = next; dirty = true; revision++; notify();
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
    return Promise.resolve(window.PlanSync.beforeUpdate ? window.PlanSync.beforeUpdate() : null).then(function () {
      return exclusive(function () { downloadSnapshot({ v: 1, docs: persistedDocs() }, CFG.testMode ? 'plan-test-backup' : 'plan-backup'); });
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
        (j.values || []).forEach(function (row, i) {
          if (i === 0 && row[0] === 'path') return;
          var path = row[0]; if (!path || typeof path !== 'string') return;
          var d = null, js = row[1];
          if (js !== undefined && js !== '') { d = JSON.parse(String(js)); }
          out[path] = { d: d, u: Number(row[2]) || 0 };
        });
        return { docs: out };
      });
  }
  function rowsOut() {
    var rows = [['path', 'json', 'u']];
    Object.keys(docs).sort().forEach(function (p) {
      var r = docs[p];
      rows.push([p, r.d == null ? '' : JSON.stringify(r.d), r.u || 0]);
    });
    return rows;
  }
  function writeAll(id) {
    var rows = rowsOut(), sentRevision = revision;
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
          if (m.remote || dirty) return writeAll(id).then(function () { return m; });
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
    if (upgradeBlocked || pendingConflict) { txt = '!'; cls = 'warn'; }
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
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function renderMenu() {
    menu.textContent = '';
    menu.appendChild(el('div', 'pl-t', 'СИНХРОНИЗАЦИЯ'));
    if (window.APP_VERSION) menu.appendChild(el('div', 'pl-s', 'Версия ' + window.APP_VERSION));
    if (CFG.testMode) menu.appendChild(el('div', 'pl-s', 'ТЕСТОВАЯ ВЕРСИЯ · отдельные сохранения. ' + (cloudAllowed ? 'Тестовая таблица Google.' : 'Google отключён. Основная таблица не используется.')));
    var line = (upgradeBlocked ? 'Прогресс только для чтения. Скачайте копию, освободите место и перезагрузите приложение.' : pendingConflict ? 'Конфликт устройств. Синхронизация приостановлена. Сохраните обе копии перед выбором.' : status.text) || (!navigator.onLine ? 'Нет сети: всё сохранено на телефоне' : (meta.signed ? fmtAgo(meta.lastSync) : 'Данные только на этом телефоне'));
    menu.appendChild(el('div', 'pl-s', line));
    var b;
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
    if (jget(RECOVERY, null)) {
      b = el('button', 'pl-b', 'СКАЧАТЬ КОПИЮ ДО ПОСЛЕДНЕЙ ЗАМЕНЫ'); b.onclick = function () { var copy = jget(RECOVERY, null); if (copy) downloadSnapshot({ v: 1, docs: copy.docs }, 'plan-recovery'); }; menu.appendChild(b);
    }
    menu.appendChild(el('div', 'pl-s', 'Перед сменой устройства завершите синхронизацию. Не расходуйте общий запас одновременно офлайн на двух устройствах. Восстановление из файла отключает автосинхронизацию до входа.'));
    b = el('button', 'pl-b', 'ЗАКРЫТЬ'); b.onclick = function () { menu.hidden = true; }; menu.appendChild(b);
  }
  var fileIn, restoreFile = false;
  function ui() {
    var st = document.createElement('style');
    st.textContent =
      '.pl-bar{position:static;display:flex;gap:6px;align-items:stretch}.pl-chip{position:static;font:9px/1 var(--font-display,monospace);padding:7px 8px;border:2px solid var(--line,#4a3d2f);background:var(--panel,#261f18);color:var(--muted,#a99a83);cursor:pointer;opacity:.9}' +
      '.pl-chip.ok{color:var(--good,#86c05e)}.pl-chip.warn{color:var(--gold,#e8b13c)}.pl-chip.off{color:var(--muted,#a99a83)}.pl-chip.upd{color:#111;background:var(--gold,#e8b13c)}.pl-chip.work{color:var(--fg,#f0e6d3)}' +
      '.pl-menu{position:fixed;top:44px;left:6px;z-index:9999;width:min(300px,calc(100vw - 12px));background:var(--panel,#261f18);border:3px solid var(--line,#4a3d2f);padding:12px;max-height:calc(100dvh - 56px);overflow:auto;display:flex;flex-direction:column;gap:8px}' +
      '.pl-menu[hidden]{display:none}.pl-t{font:10px/1.4 var(--font-display,monospace);color:var(--gold,#e8b13c)}.pl-s{font:18px/1.2 var(--font-body,monospace);color:var(--fg,#f0e6d3)}' +
      '.pl-b{font:9px/1.3 var(--font-display,monospace);padding:10px;border:3px solid var(--line,#4a3d2f);background:var(--bg,#1a1511);color:var(--fg,#f0e6d3);cursor:pointer;text-align:center}.pl-b.go{border-color:var(--gold,#e8b13c);color:var(--gold,#e8b13c)}';
    document.head.appendChild(st);
    chip = el('button', 'pl-chip', '');
    chip.type = 'button';
    menu = el('div', 'pl-menu'); menu.hidden = true;
    fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.hidden = true;
    fileIn.onchange = function () {
      var f = fileIn.files && fileIn.files[0], restoring = restoreFile; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var value;
        try { value = JSON.parse(rd.result); } catch (e) { setStatus('Не удалось прочитать файл', 'warn'); fileIn.value = ''; return; }
        if (restoring && !window.confirm('Восстановить весь прогресс из копии? Текущий прогресс будет сохранён отдельно; автосинхронизация отключится.')) { fileIn.value = ''; return; }
        if (restoring) setStatus('Восстановление: ожидаем завершения текущей синхронизации. Не закрывайте приложение.', 'work');
        importObj(value, restoring).then(function (n) { setStatus('Сохранено записей: ' + n + (restoring ? '. Для облака войдите заново после проверки.' : ''), 'ok'); })
          .catch(function () { setStatus('Импорт не сохранён. Проверьте файл и свободное место.', 'warn'); });
        fileIn.value = '';
      };
      rd.readAsText(f);
    };
    chip.onclick = function () {
      menu.hidden = !menu.hidden; if (!menu.hidden) renderMenu();
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
      });
    });
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      swReg = reg;
      function check() { if (reg.waiting && navigator.serviceWorker.controller) { updateReady = true; renderChip(); } }
      check();
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (nw) nw.addEventListener('statechange', function () { if (nw.state === 'installed') check(); });
      });
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
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

  window.PlanSync = { sync: sync, importObj: importObj, exportBackup: exportBackup, resolveConflict: resolveConflict, _docs: function () { return docs; }, _merge: merge };
})();
