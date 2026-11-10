/* Service worker: версия кэша = хэш файлов (подставляет build.py). */
var VERSION = '__VERSION__';
var CACHE_PREFIX = 'plan-shell-' + encodeURIComponent(self.registration.scope) + '-';
var CACHE = CACHE_PREFIX + VERSION;
var FONT_CACHE = CACHE_PREFIX + 'fonts';
var SHELL = __SHELL__;
var APP_BUILD = '__APP_BUILD__';
var pushQueue = Promise.resolve();
var PUSH_TEXT = Object.freeze({
  daily:'Открой Цитадель, чтобы проверить незавершённые дела дня.',
  food:'Если ещё не успел, запиши приём пищи в дневник.',
  chains:'Проверь текущий дневной лимит в разделе «Разрыв Оков».',
  achievements:'В Цитадели появилась новая отметина. Загляни в достижения.',
  weekly:'Открой Цитадель и подведи итоги недели.',
  test:'Проверка фоновых уведомлений на этом устройстве.'
});

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

self.addEventListener('push', function (event) {
  if (!event.data) return;
  var data;
  try { data = event.data.json().data; } catch (_) { return; }
  if (!['1','2'].includes(data?.vkach) || typeof data.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(data.id) ||
      !(Number(data.expiresAt) > Date.now())) return;
  var legacy=data.vkach==='1', category=legacy?'daily':data.category, testing=category==='test';
  if (!Object.hasOwn(PUSH_TEXT,category) || !legacy && !Number.isFinite(Number(data.sentAt))) return;
  pushQueue = pushQueue.catch(function () {}).then(async function () {
    var scope = self.registration.scope, cache = await caches.open('vkach-push-' + scope);
    var stateKey = new URL('__vkach_push_state__',scope);
    async function stillWanted() {
      var response=await cache.match(stateKey), state=response && await response.json();
      if (!state || state.device!==data.device || state.revision!==Number(data.revision) ||
          Number(data.expiresAt)<=Date.now()) return false;
      if (legacy) return !state.policy && state.needed && state.day===data.day;
      if (testing) return true;
      if (!state.policy || state.policy!==data.policy || state.timezone!==data.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone!==data.timezone) return false;
      var day=new Intl.DateTimeFormat('sv-SE',{timeZone:state.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now());
      return day===data.day && (category!=='daily' || state.needed && state.day===data.day);
    }
    if (!await stillWanted()) return;
    var windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if (legacy && windows.some(client=>client.url.startsWith(scope)&&client.visibilityState==='visible')) return;
    var key = new URL(legacy?'__vkach_push_last__':'__vkach_push_last_'+category+'__',scope);
    var previous = await cache.match(key);
    var receipt=previous && await previous.json();
    if (receipt?.id===data.id || !legacy && receipt?.device===data.device && receipt.at>=Number(data.sentAt)) return;
    if (!await stillWanted()) return;
    await cache.put(key,new Response(JSON.stringify({id:data.id,day:data.day,device:data.device,at:Number(data.sentAt)||0})));
    await self.registration.showNotification('Вкач', {
      body:legacy?'Открой Цитадель, чтобы проверить дела дня.':PUSH_TEXT[category],
      icon:new URL('icon-192.png',scope).href, tag:'vkach-'+category, renotify:false
    });
  });
  event.waitUntil(pushQueue);
});
self.addEventListener('notificationclick', function (event) {
  if (!Object.keys(PUSH_TEXT).some(category=>event.notification.tag==='vkach-'+category)) return;
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function (clients) {
    var client = clients.find(item=>item.url.startsWith(self.registration.scope));
    return client ? client.focus() : self.clients.openWindow(self.registration.scope);
  }));
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
