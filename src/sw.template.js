/* Service worker: версия кэша = хэш файлов (подставляет build.py). */
var VERSION = '__VERSION__';
var CACHE_PREFIX = 'plan-shell-' + encodeURIComponent(self.registration.scope) + '-';
var CACHE = CACHE_PREFIX + VERSION;
var FONT_CACHE = CACHE_PREFIX + 'fonts';
var SHELL = __SHELL__;
var APP_BUILD = '__APP_BUILD__';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    return Promise.all(SHELL.map(async function (path) {
      // GitHub Pages can retain the previous response for an unversioned URL.
      var url = new URL(path, self.registration.scope);
      url.searchParams.set('build', APP_BUILD);
      var response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok) throw new Error(path);
      if (path === 'index.html' && !(await response.clone().text()).includes('window.APP_BUILD="' + APP_BUILD + '"')) {
        throw new Error('Cached index does not match this service worker');
      }
      return cache.put(path, response);
    }));
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE && k !== FONT_CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'APP_BUILD' && e.ports[0]) e.ports[0].postMessage(APP_BUILD);
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Шрифты Google: кладём в кэш при первом онлайн-открытии
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (r) { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
    return;
  }
  if (url.origin !== location.origin || !url.href.startsWith(self.registration.scope)) return;      // Google API и вход не трогаем
  e.respondWith(caches.open(CACHE).then(function (c) {
    if (req.mode === 'navigate') return c.match('index.html');
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req);
    });
  }));
});
