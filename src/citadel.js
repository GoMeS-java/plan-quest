/* Цитадель Спящего: независимая модель мира, без изменения текущих сохранений. */
(function (root) {
  'use strict';
  var KEY = 'plan.citadel.v1';
  var ROOMS = {
    throne: { name: 'Тронный зал', size: 3, domain: 'rank' },
    quarters: { name: 'Личные покои', size: 1, domain: 'rest' },
    study: { name: 'Кабинет', size: 1, domain: 'knowledge' },
    wardrobe: { name: 'Гардероб', size: 1, domain: 'rank' },
    gallery: { name: 'Галерея трофеев', size: 2, domain: 'achievements' },
    lounge: { name: 'Гостиная', size: 2, domain: 'rest' },
    training: { name: 'Зал Испытаний', size: 2, domain: 'fitness' },
    archive: { name: 'Архив Разума', size: 2, domain: 'knowledge' },
    treasury: { name: 'Сокровищница', size: 2, domain: 'finance' },
    workshop: { name: 'Мастерская', size: 1, domain: 'rank' }
  };
  var NPC = {
    archivist: { name: 'Хранительница Архива', home: 'archive', traits: ['спокойная', 'любознательная'] },
    guard: { name: 'Страж Цитадели', home: 'training', traits: ['дисциплинированный', 'немногословный'] },
    treasurer: { name: 'Казначей', home: 'treasury', traits: ['рассудительный', 'ироничный'] },
    smith: { name: 'Кузнец Бездны', home: 'workshop', traits: ['сосредоточенный', 'упорный'] }
  };
  function initial() {
    return {
      schema: 1, createdAt: Date.now(), view: 'overview',
      weather: { mode: 'fantasy', selected: 'rain' },
      settings: { sound: false, particles: true, dayNight: true, reducedMotion: false },
      floors: [
        { id: 'f0', capacity: 6, unlocked: true },
        { id: 'f1', capacity: 6, unlocked: false }
      ],
      rooms: [
        { id: 'throne-1', kind: 'throne', floor: 'f0', start: 0, size: 3, level: 1, items: [] },
        { id: 'quarters-1', kind: 'quarters', floor: 'f0', start: 3, size: 1, level: 1, items: [] }
      ],
      hero: { roomId: 'throne-1', appearance: 'current', activity: 'idle' },
      inhabitants: [],
      inventory: [],
      lastVisited: Date.now()
    };
  }
  function validPlacement(state, floor, start, size, ignoreId) {
    var f = state.floors.find(function (x) { return x.id === floor && x.unlocked; });
    if (!f || !Number.isInteger(start) || start < 0 || start + size > f.capacity) return false;
    return !state.rooms.some(function (r) {
      return r.id !== ignoreId && r.floor === floor && start < r.start + r.size && r.start < start + size;
    });
  }
  function addRoom(state, kind, floor, start) {
    if (!ROOMS[kind]) throw new Error('Неизвестный тип комнаты');
    var size = ROOMS[kind].size;
    if (!validPlacement(state, floor, start, size)) throw new Error('Недоступный участок');
    var next = JSON.parse(JSON.stringify(state));
    next.rooms.push({ id: kind + '-' + Date.now(), kind: kind, floor: floor, start: start, size: size, level: 1, items: [] });
    return next;
  }
  function expandRoom(state, id, size) {
    var room = state.rooms.find(function (r) { return r.id === id; });
    if (!room || !Number.isInteger(size) || size < room.size || size > 6) throw new Error('Неверный размер');
    if (!validPlacement(state, room.floor, room.start, size, id)) throw new Error('Нет места для расширения');
    var next = JSON.parse(JSON.stringify(state));
    next.rooms.find(function (r) { return r.id === id; }).size = size;
    return next;
  }
  function environment(now, state) {
    var hour = new Date(now).getHours();
    var phase = hour < 6 ? 'deep-night' : hour < 12 ? 'morning' : hour < 18 ? 'day' : hour < 22 ? 'evening' : 'night';
    return { phase: phase, weather: state.weather.selected };
  }
  function npcActivity(id, now) {
    if (!NPC[id]) return null;
    var hour = new Date(now).getHours();
    if (hour < 7 || hour >= 23) return 'rest';
    if (hour < 10) return 'morning';
    if (hour < 18) return 'work';
    if (hour < 21) return 'social';
    return 'evening';
  }
  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (!raw) return initial();
      var data = JSON.parse(raw);
      return data && data.schema === 1 && Array.isArray(data.rooms) ? data : initial();
    } catch (_) { return initial(); }
  }
  function save(state) {
    if (!state || state.schema !== 1) throw new Error('Несовместимая версия данных');
    root.localStorage.setItem(KEY, JSON.stringify(state));
  }
  // Награды не создаются этим модулем. Полученные предметы импортируются
  // только из проверенной системы достижений, без раскрытия закрытого каталога.
  root.Citadel = Object.freeze({
    rooms: ROOMS, inhabitants: NPC, initial: initial, load: load, save: save,
    validPlacement: validPlacement, addRoom: addRoom, expandRoom: expandRoom,
    environment: environment, npcActivity: npcActivity
  });
})(window);
