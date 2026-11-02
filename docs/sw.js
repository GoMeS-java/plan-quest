/* Service worker: версия кэша = хэш файлов (подставляет build.py). */
var VERSION = '3d4d6981a2';
var CACHE_PREFIX = 'plan-shell-' + encodeURIComponent(self.registration.scope) + '-';
var CACHE = CACHE_PREFIX + VERSION;
var FONT_CACHE = CACHE_PREFIX + 'fonts';
var SHELL = ["./", "index.html", "manifest.json", "config.js", "localdb.js", "awakening.js", "citadel-world.js", "citadel-space.js", "legends.js", "fate.js", "icon-192.png", "icon-512.png", "icon-512-maskable.png", "citadel.html", "citadel.js", "citadel-life.js", "citadel-weather.js", "citadel-art.css", "rpg-ui.css", "assets/citadel/abandoned.svg", "assets/citadel/archive-depth-2.svg", "assets/citadel/archive-depth-3.svg", "assets/citadel/archive-interior-1.svg", "assets/citadel/archive-interior-2.svg", "assets/citadel/archive-interior-3.svg", "assets/citadel/archive-ruins.svg", "assets/citadel/archive-scene0.svg", "assets/citadel/archive-scene1.svg", "assets/citadel/archive-scene2.svg", "assets/citadel/archive-upgrade.svg", "assets/citadel/archive-upgrade3.svg", "assets/citadel/archive.webp", "assets/citadel/archivist.svg", "assets/citadel/cloister-depth-2.svg", "assets/citadel/cloister-depth-3.svg", "assets/citadel/cloister-interior-1.svg", "assets/citadel/cloister-interior-2.svg", "assets/citadel/cloister-interior-3.svg", "assets/citadel/cloister-ruins.svg", "assets/citadel/cloister-scene0.svg", "assets/citadel/cloister-scene1.svg", "assets/citadel/cloister-scene2.svg", "assets/citadel/cloister-upgrade.svg", "assets/citadel/cloister-upgrade3.svg", "assets/citadel/cloister.webp", "assets/citadel/forge-depth-2.svg", "assets/citadel/forge-depth-3.svg", "assets/citadel/forge-interior-1.svg", "assets/citadel/forge-interior-2.svg", "assets/citadel/forge-interior-3.svg", "assets/citadel/forge-ruins.svg", "assets/citadel/forge-scene0.svg", "assets/citadel/forge-scene1.svg", "assets/citadel/forge-scene2.svg", "assets/citadel/forge-upgrade.svg", "assets/citadel/forge-upgrade3.svg", "assets/citadel/forge.webp", "assets/citadel/gatehouse-depth-2.svg", "assets/citadel/gatehouse-depth-3.svg", "assets/citadel/gatehouse-interior-1.svg", "assets/citadel/gatehouse-interior-2.svg", "assets/citadel/gatehouse-interior-3.svg", "assets/citadel/gatehouse-ruins.svg", "assets/citadel/gatehouse-scene0.svg", "assets/citadel/gatehouse-scene1.svg", "assets/citadel/gatehouse-scene2.svg", "assets/citadel/gatehouse-upgrade.svg", "assets/citadel/gatehouse-upgrade3.svg", "assets/citadel/gatehouse.webp", "assets/citadel/guardian.svg", "assets/citadel/observatory-depth-2.svg", "assets/citadel/observatory-depth-3.svg", "assets/citadel/observatory-interior-1.svg", "assets/citadel/observatory-interior-2.svg", "assets/citadel/observatory-interior-3.svg", "assets/citadel/observatory-ruins.svg", "assets/citadel/observatory-scene0.svg", "assets/citadel/observatory-scene1.svg", "assets/citadel/observatory-scene2.svg", "assets/citadel/observatory-upgrade.svg", "assets/citadel/observatory-upgrade3.svg", "assets/citadel/observatory.webp", "assets/citadel/refectory-depth-2.svg", "assets/citadel/refectory-depth-3.svg", "assets/citadel/refectory-interior-1.svg", "assets/citadel/refectory-interior-2.svg", "assets/citadel/refectory-interior-3.svg", "assets/citadel/refectory-ruins.svg", "assets/citadel/refectory-scene0.svg", "assets/citadel/refectory-scene1.svg", "assets/citadel/refectory-scene2.svg", "assets/citadel/refectory-upgrade.svg", "assets/citadel/refectory-upgrade3.svg", "assets/citadel/refectory.webp", "assets/citadel/rest-depth-2.svg", "assets/citadel/rest-depth-3.svg", "assets/citadel/rest-interior-1.svg", "assets/citadel/rest-interior-2.svg", "assets/citadel/rest-interior-3.svg", "assets/citadel/rest-restoration-2.svg", "assets/citadel/rest-restoration-3.svg", "assets/citadel/rest-ruins.svg", "assets/citadel/rest-scene0.svg", "assets/citadel/rest-scene1.svg", "assets/citadel/rest-scene2.svg", "assets/citadel/rest-structure.svg", "assets/citadel/rest-upgrade.svg", "assets/citadel/rest-upgrade3.svg", "assets/citadel/rest.webp", "assets/citadel/roof.svg", "assets/citadel/sky.webp", "assets/citadel/smith.svg", "assets/citadel/snow-roof.svg", "assets/citadel/stairs.svg", "assets/citadel/stone.svg", "assets/citadel/study-depth-2.svg", "assets/citadel/study-depth-3.svg", "assets/citadel/study-interior-1.svg", "assets/citadel/study-interior-2.svg", "assets/citadel/study-interior-3.svg", "assets/citadel/study-ruins.svg", "assets/citadel/study-scene0.svg", "assets/citadel/study-scene1.svg", "assets/citadel/study-scene2.svg", "assets/citadel/study-upgrade.svg", "assets/citadel/study-upgrade3.svg", "assets/citadel/study.webp", "assets/citadel/throne-depth-2.svg", "assets/citadel/throne-depth-3.svg", "assets/citadel/throne-interior-1.svg", "assets/citadel/throne-interior-2.svg", "assets/citadel/throne-interior-3.svg", "assets/citadel/throne-ruins.svg", "assets/citadel/throne-scene0.svg", "assets/citadel/throne-scene1.svg", "assets/citadel/throne-scene2.svg", "assets/citadel/throne-upgrade.svg", "assets/citadel/throne-upgrade3.svg", "assets/citadel/throne.webp", "assets/citadel/treasurer.svg", "assets/citadel/vault-depth-2.svg", "assets/citadel/vault-depth-3.svg", "assets/citadel/vault-interior-1.svg", "assets/citadel/vault-interior-2.svg", "assets/citadel/vault-interior-3.svg", "assets/citadel/vault-ruins.svg", "assets/citadel/vault-scene0.svg", "assets/citadel/vault-scene1.svg", "assets/citadel/vault-scene2.svg", "assets/citadel/vault-upgrade.svg", "assets/citadel/vault-upgrade3.svg", "assets/citadel/vault.webp"];

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
  if (e.data === 'APP_BUILD' && e.ports[0]) e.ports[0].postMessage('1277c293759e');
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
