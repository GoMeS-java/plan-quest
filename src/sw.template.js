/* Service worker: версия кэша = хэш файлов (подставляет build.py). */
var VERSION = '__VERSION__';
var CACHE_PREFIX = 'plan-shell-' + encodeURIComponent(self.registration.scope) + '-';
var CACHE = CACHE_PREFIX + VERSION;
var FONT_CACHE = CACHE_PREFIX + 'fonts';
var SHELL = __SHELL__;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(SHELL.map(function (u) { return fetch(new Request(u, { cache: 'reload' })).then(function (r) { if (!r.ok) throw new Error(u); return c.put(u, r); }); })); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE && k !== FONT_CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'APP_BUILD' && e.ports[0]) e.ports[0].postMessage('__APP_BUILD__');
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
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return c.match('index.html');
      return fetch(req);
    });
  }));
});
