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

  const collection = 'chains', plans = 'will-plans', body = 'will-days', prefs = 'cfg/chains', ledgerCollection = 'chains-ledger';
  const sources = ['nutrition', 'activity'];
  const reasonOptions = ['Стресс', 'Скука', 'После еды', 'Работа', 'Другое'];
  function summarize(events, planRows, bodyRows, date) {
    const days = {}, journal = [], periods = {};
    const bodyByDate = Object.fromEntries(bodyRows.map(row => [row.id, row]));
    const revisions = planRows.filter(row => validDate(row.id)).sort((a, b) => a.id.localeCompare(b.id));
    let revision = 0, plan = null;
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
    const push = (key, source, value) => journal.push({ id: source + ':' + key, date: key, source, value });
    const last = asDay(date);
    for (let n = first; n <= last; n++) {
      const key = keyOf(n), entry = days[key];
      const mk = monday(key), p = periods[mk] ??= { smoking: true, body: true, worked: false };
      const observed = entry && (entry.count > 0 || entry.confirmed);
      const passed = observed && entry.count <= limit(key);
      p.smoking &&= !!passed;
      if (key < date && observed) push(key, 'smoking', passed ? 1 : -4);
      while (revisions[revision]?.id <= key) plan = revisions[revision++];
      for (const source of sources) {
        if (!plan?.[source]?.label || !Array.isArray(plan[source].days) || !plan[source].days.includes((n - firstMonday) % 7)) continue;
        const status = bodyByDate[key]?.[source];
        if (status === 'excused') continue;
        p.body &&= status === 'done';
        p.worked ||= status === 'done';
        if (key < date && (status === 'done' || status === 'missed')) push(key, source, status === 'done' ? 1 : -2);
      }
      if (key < date && (n - firstMonday) % 7 === 6) {
        if (p.smoking) push(key, 'smoking-week', 3);
        if (p.body && p.worked) push(key, 'body-week', 3);
      }
    }
    const observed = Object.entries(days).filter(([key, row]) => key < date && (row.count > 0 || row.confirmed));
    const success = observed.filter(([key, row]) => row.count <= limit(key)).length;
    const free = observed.filter(([, row]) => row.count === 0).length;
    let streak = 0, best = 0, previous = null;
    for (const [key, row] of observed.sort(([a], [b]) => a.localeCompare(b))) {
      streak = row.count === 0 ? (previous === shift(key, -1) ? streak + 1 : 1) : 0;
      previous = key;
    }
    if (previous !== shift(date, -1)) streak = 0;
    let will = 0;
    for (const row of journal) {
      will += row.value;
      best = Math.max(best, will);
    }
    const recent = observed.filter(([key]) => key >= shift(date, -14));
    const mean = recent.length ? recent.reduce((sum, [, row]) => sum + row.count, 0) / recent.length : null;
    const stage = streak >= 14 ? 3 : recent.length >= 7 && mean <= 10 ? 2 : 1;
    return { days, journal, success, free, streak, will, best, mean, stage, revisions, bodyByDate };
  }
  function planAt(data, key) {
    return data.revisions.findLast(row => row.id <= key);
  }
  function ledgerByMonth(data) {
    const months = {};
    for (const entry of data.journal) {
      const month = entry.date.slice(0, 7), record = months[month] ??= {};
      record[entry.id] = entry.source === 'smoking'
        ? { ...entry, count: data.days[entry.date].count, limit: limit(entry.date) }
        : entry;
    }
    return months;
  }

  const awardsPath = 'cfg/chains-discoveries';
  const discoveries = {
    'chains-first': { kind: 'mark', name: 'Звено дрогнуло' },
    'chains-rhythm': { kind: 'rare', name: 'Привычка теряет голос', title: 'КРЕПКИЙ ДУХ' },
    'chains-body': { kind: 'rare', name: 'Договор с собой', title: 'ДЕРЖАЩИЙ СЛОВО' },
    'chains-free': { kind: 'superrare', name: 'Тишина после звона', title: 'СОКРУШИТЕЛЬ ОКОВ' },
    'chains-fate': { kind: 'superrare', name: 'Пепел последней песчинки', title: 'ПЕРЕЖИВШИЙ ПЕСОК' }
  };
  function pendingAwards(data, date, ledger) {
    const rules = {
      'chains-first': data.success >= 4,
      'chains-rhythm': data.journal.filter(row => row.source === 'smoking-week').length >= 4 && data.free >= 9,
      'chains-body': data.journal.filter(row => row.source === 'body-week').length >= 6,
      'chains-free': data.streak >= 45 && data.will >= 85,
      'chains-fate': date >= end && data.streak >= 30 && data.will >= 90
    };
    return Object.keys(discoveries).filter(id => rules[id] && !validDate(ledger[id]));
  }
  function mergeAwards(a, b) {
    const merged = {};
    for (const id of Object.keys(discoveries)) {
      const dates = [a?.[id], b?.[id]].filter(validDate).sort();
      if (dates.length) merged[id] = dates[0];
    }
    return merged;
  }
  function owned(ledger) {
    return Object.entries(mergeAwards(ledger, null)).map(([id, date]) => ({ id, date,
      ...discoveries[id], description: 'Заклятие запомнило твой путь.', points: 0 }));
  }
  root.VkachChains = Object.freeze({ start, end, zero, zone, validDate, today, shift, weekday, monday, week, limit, clock,
    collection, plans, body, prefs, ledgerCollection, ledgerByMonth, sources, reasonOptions, summarize, planAt, awardsPath, pendingAwards, mergeAwards, owned });
})(globalThis);
