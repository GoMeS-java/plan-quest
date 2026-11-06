/* Calendar and accounting for Break the Chains. Entries are the source of truth. */
(function (root) {
  'use strict';
  const start = '2026-11-06', end = '2027-05-06', zero = '2027-02-15';
  const zone = 'Europe/Moscow', day = 86400000;
  const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const asDay = key => Date.parse(key + 'T00:00:00Z') / day;
  const keyOf = n => new Date(n * day).toISOString().slice(0, 10);
  const validDate = key => /^\d{4}-\d\d-\d\d$/.test(key) && Number.isFinite(asDay(key)) && keyOf(asDay(key)) === key;
  const today = (now = Date.now()) => dateFormat.format(now);
  const shift = (key, n) => keyOf(asDay(key) + n);
  const weekday = key => (new Date(asDay(key) * day).getUTCDay() + 6) % 7;
  const monday = key => shift(key, -weekday(key));
  const first = asDay(start), firstMonday = asDay(monday(start));
  const week = key => Math.max(0, 1 + Math.floor((asDay(key) - firstMonday) / 7));
  const limit = key => key < start ? null : Math.max(0, 16 - week(key));

  // Fixed UTC instants for midnight Moscow on the two agreed civil dates.
  const beginsAt = Date.parse(start + 'T00:00:00+03:00');
  const endsAt = Date.parse(end + 'T00:00:00+03:00');
  function clock(now = Date.now()) {
    const total = (endsAt - beginsAt) / day;
    const elapsed = Math.min(total, Math.max(0, (now - beginsAt) / day));
    return { ratio: elapsed / total, total, gone: Math.floor(elapsed), left: Math.ceil(total - elapsed), complete: now >= endsAt };
  }

  const collection = 'chains', prefs = 'cfg/chains';
  const reasonOptions = ['Стресс', 'Скука', 'После еды', 'Работа', 'Другое'];
  function summarize(events, date) {
    const days = {}, completed = [], weeks = [];
    for (const event of events) {
      if (!validDate(event.date) || event.date < start || event.date > date || event.voidAt) continue;
      const entry = days[event.date] ??= { count: 0, confirmed: false, events: [], cravings: [] };
      if (event.kind === 'smoke') {
        entry.count++;
        entry.events.push(event);
      }
      if (event.kind === 'confirm') entry.confirmed = true;
      if (event.kind === 'craving') entry.cravings.push(event);
    }
    let streak = 0, best = 0, free = 0, weekPassed = true;
    const observed = [];
    for (let n = first; n < asDay(date); n++) {
      const key = keyOf(n), entry = days[key];
      const logged = !!entry && (entry.count > 0 || entry.confirmed);
      const passed = logged && entry.count <= limit(key);
      if (logged) observed.push([key, entry]);
      if (passed) completed.push(key);
      if (logged && entry.count === 0) { free++; streak++; best = Math.max(best, streak); }
      else streak = 0;
      weekPassed &&= passed;
      if ((n - firstMonday) % 7 === 6) {
        if (weekPassed) weeks.push(key);
        weekPassed = true;
      }
    }
    const recent = observed.filter(([key]) => key >= shift(date, -14));
    const mean = recent.length ? recent.reduce((sum, [, row]) => sum + row.count, 0) / recent.length : null;
    const stage = streak >= 14 ? 3 : recent.length >= 7 && mean <= 10 ? 2 : 1;
    return { days, completed, weeks, success: completed.length, free, streak, best, mean, stage };
  }

  const awardsPath = 'cfg/chains-discoveries';
  const aspectKey = 'chains-aspect';
  const aspectName = 'Свободное дыхание';
  const aspectText = 'Подтверди день с нулём сигарет. После закрытия дня ты получишь дополнительный осколок.';
  const dayReward = 1, weekReward = 3;
  const discoveries = {
    'chains-first': { kind: 'mark', name: 'Звено дрогнуло', points: 2 },
    'chains-rhythm': { kind: 'rare', name: 'Привычка теряет голос', title: 'КРЕПКИЙ ДУХ', points: 5 },
    'chains-body': { kind: 'rare', name: 'Договор с собой', title: 'ДЕРЖАЩИЙ СЛОВО', points: 0 },
    'chains-free': { kind: 'superrare', name: 'Тишина после звона', title: 'СОКРУШИТЕЛЬ ОКОВ', points: 10 },
    'chains-fate': { kind: 'superrare', name: 'Пепел последней песчинки', title: 'ПЕРЕЖИВШИЙ ПЕСОК', points: 10 }
  };
  function pendingAwards(data, date, ledger) {
    const rules = {
      'chains-first': data.success >= 4,
      'chains-rhythm': data.weeks.length >= 4 && data.free >= 9,
      'chains-free': data.best >= 45,
      'chains-fate': date >= end && data.streak >= 30
    };
    const pending = Object.keys(discoveries).filter(id => rules[id] && !validDate(ledger[id]));
    if (data.best >= 14 && !validDate(ledger[aspectKey])) pending.push(aspectKey);
    return pending;
  }
  function mergeAwards(a, b) {
    const merged = {};
    for (const id of [...Object.keys(discoveries), aspectKey]) {
      const dates = [a?.[id], b?.[id]].filter(validDate).sort();
      if (dates.length) merged[id] = dates[0];
    }
    return merged;
  }
  function owned(ledger) {
    return Object.entries(mergeAwards(ledger, null)).filter(([id]) => id !== aspectKey).map(([id, date]) => ({ id, date,
      ...discoveries[id], description: 'Заклятие запомнило твой путь.' }));
  }
  function progression(data, ledger, date) {
    const aspectDate = ledger[aspectKey];
    const aspect = validDate(aspectDate) && aspectDate <= date ? { date: aspectDate, name: aspectName, text: aspectText } : null;
    const marks = owned(ledger).filter(row => row.date <= date);
    const byDay = {};
    function give(key, amount) { byDay[key] = (byDay[key] || 0) + amount; }
    for (const key of data.completed) give(shift(key, 1), dayReward + (aspect && key >= aspect.date && data.days[key].count === 0 ? 1 : 0));
    for (const key of data.weeks) give(shift(key, 1), weekReward);
    for (const row of marks) if (row.points) give(row.date, row.points);
    return { byDay, aspect, marks };
  }
  root.VkachChains = Object.freeze({ start, end, zero, zone, validDate, today, shift, monday, week, limit, clock,
    collection, prefs, reasonOptions, summarize, awardsPath, pendingAwards, mergeAwards, owned, progression, dayReward, weekReward });
})(globalThis);
