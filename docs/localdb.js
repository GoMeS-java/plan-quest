/* localdb.js: локальная база с тем же интерфейсом, что давал claude.use('db'),
   плюс синхронизация с файлом на Google Диске.

   Формат хранилища (и файла на Диске):
   { "v": 1, "docs": { "tx/abc": { "d": {...данные...} | null, "u": 1792528658167 } } }
   d = null означает удалённую запись. u = время последнего изменения, мс.
   При слиянии побеждает запись с большим u. */
(function () {
  'use strict';
  var CFG = window.PLAN_CONFIG || {};
  var KEY = 'plan.store.v1';
  var META = 'plan.meta.v1';
  var FILE_NAME = CFG.fileName || 'plan-data';
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';

  var docs = {};      // path -> {d, u}
  var meta = {};      // fileId, lastSync, user
  var subs = [];      // {path|col, kind, cb}
  var dirty = false;

  function jget(k, def) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  docs = (jget(KEY, { docs: {} }) || {}).docs || {};
  meta = jget(META, {}) || {};

  function save() { jset(KEY, { v: 1, docs: docs }); }
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

  function write(p, d) {
    docs[p] = { d: d, u: Date.now() };
    save(); dirty = true; notify(); scheduleSync();
    return Promise.resolve();
  }

  var db = {
    doc: function (p) {
      return {
        onSnapshot: function (cb) { subs.push({ kind: 'doc', path: p, cb: cb }); setTimeout(function () { cb(snapDoc(p)); }, 0); },
        set: function (d) { return write(p, clone(d)); },
        update: function (d) {
          var cur = docs[p] && docs[p].d != null ? clone(docs[p].d) : {};
          Object.keys(d).forEach(function (k) { if (d[k] && d[k].__delete__) delete cur[k]; else cur[k] = clone(d[k]); });
          return write(p, cur);
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

  // ---- слияние ---------------------------------------------------------
  function merge(remote) {
    var changedLocal = false, changedRemote = false;
    var rd = (remote && remote.docs) || {};
    Object.keys(rd).forEach(function (p) {
      var l = docs[p], r = rd[p];
      if (!l || (r.u || 0) > (l.u || 0)) { docs[p] = { d: r.d, u: r.u || 0 }; changedLocal = true; }
      else if ((l.u || 0) > (r.u || 0)) changedRemote = true;
    });
    Object.keys(docs).forEach(function (p) { if (!rd[p]) changedRemote = true; });
    if (changedLocal) { save(); notify(); }
    return { local: changedLocal, remote: changedRemote };
  }

  // ---- импорт из файла (seed или полный формат) ------------------------
  function importObj(o) {
    var n = 0;
    if (o && o.seed) {
      Object.keys(o.seed).forEach(function (p) {
        if (!docs[p]) { docs[p] = { d: o.seed[p], u: 1 }; n++; }
      });
    } else if (o && o.docs) {
      var m = merge(o); n = Object.keys(o.docs).length; void m;
    } else throw new Error('bad format');
    save(); dirty = true; notify(); scheduleSync();
    return n;
  }

  // ---- Google Диск -----------------------------------------------------
  var token = null, tokenExp = 0, tokClient = null, gsiLoading = null;
  (function () { var t = jget('plan.tok', null); if (t && t.t && t.exp > Date.now() + 60000) { token = t.t; tokenExp = t.exp; } })();
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
              jset('plan.tok', { t: token, exp: tokenExp });
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
    opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + token }, opt.headers || {});
    return fetch(url, opt).then(function (r) {
      if (r.status === 401) { token = null; tokenExp = 0; jset('plan.tok', null); throw new Error('auth'); }
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
          if (js !== undefined && js !== '') { try { d = JSON.parse(String(js)); } catch (e) { return; } }
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
    var rows = rowsOut();
    return api('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values/' + TAB + '!A1:C' + rows.length + '?valueInputOption=RAW', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: TAB + '!A1:C' + rows.length, majorDimension: 'ROWS', values: rows })
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

  function sync(interactive) {
    if (busy) return waiting || Promise.resolve();
    busy = true; setStatus('Синхронизация…', 'work');
    waiting = getToken(!!interactive).then(function () { return findFile(); }).then(function (id) {
      if (!id) return createFile().then(function () { return { created: true }; });
      return readRows(id).then(function (remote) {
        var m = merge(remote);
        if (m.remote || dirty) return writeAll(id).then(function () { return m; });
        return m;
      });
    }).then(function () {
      dirty = false; meta.lastSync = Date.now(); saveMeta();
      setStatus('', 'ok');
    }).catch(function (e) {
      var m = e && e.message;
      if (m === 'noclient') setStatus('Вход в Google не настроен', 'warn');
      else if (m === 'offline' || m === 'Failed to fetch') setStatus('Нет сети: всё сохранено на телефоне', 'off');
      else if (m === 'auth' || m === 'popup_closed' || m === 'popup_failed_to_open' || m === 'access_denied' || m === 'interaction_required') setStatus('Нужно войти в Google', 'warn');
      else setStatus('Не удалось синхронизировать', 'warn');
    }).then(function () { busy = false; waiting = null; });
    return waiting;
  }
  function scheduleSync() {
    if (!meta.signed) return;
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
    if (updateReady) { txt = 'ОБНОВИТЬ'; cls = 'upd'; }
    else if (!navigator.onLine) { txt = 'ОФЛАЙН'; cls = 'off'; }
    else if (busy) { txt = '…'; cls = 'work'; }
    else if (!meta.signed || !haveToken()) { txt = meta.signed ? 'ВХОД ↻' : 'ВОЙТИ'; cls = 'warn'; }
    else if (status.cls === 'warn') { txt = '!'; cls = 'warn'; }
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
    var line = status.text || (!navigator.onLine ? 'Нет сети: всё сохранено на телефоне' : (meta.signed ? fmtAgo(meta.lastSync) : 'Данные только на этом телефоне'));
    menu.appendChild(el('div', 'pl-s', line));
    var b;
    if (updateReady) {
      b = el('button', 'pl-b go', 'ОБНОВИТЬ ПРИЛОЖЕНИЕ'); b.onclick = function () { if (swReg && swReg.waiting) swReg.waiting.postMessage('SKIP_WAITING'); }; menu.appendChild(b);
    }
    b = el('button', 'pl-b go', meta.signed ? 'СИНХРОНИЗИРОВАТЬ' : 'ВОЙТИ ЧЕРЕЗ GOOGLE');
    b.onclick = function () { sync(!meta.signed); }; menu.appendChild(b);
    if (meta.signed) {
      b = el('button', 'pl-b', 'ВЫЙТИ'); b.onclick = function () {
        try { if (window.google && token) google.accounts.oauth2.revoke(token, function () {}); } catch (e) {}
        token = null; tokenExp = 0; jset('plan.tok', null); meta.signed = false; delete meta.sheetId; delete meta.hint; saveMeta(); setStatus('', ''); renderChip();
      }; menu.appendChild(b);
    }
    b = el('button', 'pl-b', 'ИМПОРТ ИЗ ФАЙЛА');
    b.onclick = function () { fileIn.click(); }; menu.appendChild(b);
    b = el('button', 'pl-b', 'ЗАКРЫТЬ'); b.onclick = function () { menu.hidden = true; }; menu.appendChild(b);
  }
  var fileIn;
  function ui() {
    var st = document.createElement('style');
    st.textContent =
      '.pl-bar{position:static;display:flex;gap:6px;align-items:stretch}.pl-chip{position:static;font:9px/1 var(--font-display,monospace);padding:7px 8px;border:2px solid var(--line,#4a3d2f);background:var(--panel,#261f18);color:var(--muted,#a99a83);cursor:pointer;opacity:.9}' +
      '.pl-chip.ok{color:var(--good,#86c05e)}.pl-chip.warn{color:var(--gold,#e8b13c)}.pl-chip.off{color:var(--muted,#a99a83)}.pl-chip.upd{color:#111;background:var(--gold,#e8b13c)}.pl-chip.work{color:var(--fg,#f0e6d3)}' +
      '.pl-menu{position:fixed;top:44px;left:6px;z-index:9999;width:min(300px,calc(100vw - 12px));background:var(--panel,#261f18);border:3px solid var(--line,#4a3d2f);padding:12px;display:flex;flex-direction:column;gap:8px}' +
      '.pl-menu[hidden]{display:none}.pl-t{font:10px/1.4 var(--font-display,monospace);color:var(--gold,#e8b13c)}.pl-s{font:18px/1.2 var(--font-body,monospace);color:var(--fg,#f0e6d3)}' +
      '.pl-b{font:9px/1.3 var(--font-display,monospace);padding:10px;border:3px solid var(--line,#4a3d2f);background:var(--bg,#1a1511);color:var(--fg,#f0e6d3);cursor:pointer;text-align:center}.pl-b.go{border-color:var(--gold,#e8b13c);color:var(--gold,#e8b13c)}';
    document.head.appendChild(st);
    chip = el('button', 'pl-chip', '');
    chip.type = 'button';
    menu = el('div', 'pl-menu'); menu.hidden = true;
    fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.hidden = true;
    fileIn.onchange = function () {
      var f = fileIn.files && fileIn.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try { var n = importObj(JSON.parse(rd.result)); setStatus('Импортировано записей: ' + n, 'ok'); }
        catch (e) { setStatus('Не удалось прочитать файл', 'warn'); }
        fileIn.value = '';
      };
      rd.readAsText(f);
    };
    chip.onclick = function () {
      if (!updateReady && meta.signed && !haveToken() && navigator.onLine && !busy) { sync(false); return; }
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
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (reloading) return; reloading = true; location.reload(); });
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

  window.PlanSync = { sync: sync, importObj: importObj, _docs: function () { return docs; }, _merge: merge };
})();
