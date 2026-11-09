/* Separate, bounded recovery history. The live document store stays authoritative. */
(function (root) {
  'use strict';

  const maxBytes = 24 * 1024 * 1024;
  const limits = { daily: 7, change: 4 };
  const result = request => new Promise((resolve,reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  function create(name, backupFor) {
    let opening, dailyDay = '';

    function database() {
      if (!opening) {
        opening = Promise.resolve().then(() => {
          const request = indexedDB.open(name, 1);
          request.onupgradeneeded = () => {
            request.result.createObjectStore('entries', {keyPath:'id'});
            request.result.createObjectStore('copies');
          };
          return result(request);
        }).catch(error => { opening = null; throw error; });
      }
      return opening;
    }

    async function get(store, id) {
      const db = await database();
      const records = db.transaction(store).objectStore(store);
      return result(id === undefined ? records.getAll() : records.get(id));
    }

    async function put(entry, copies) {
      if (entry.bytes > maxBytes) throw new Error('backup too large');
      const db = await database();
      return new Promise((resolve,reject) => {
        const tx = db.transaction(['entries','copies'],'readwrite');
        const entries = tx.objectStore('entries'), payload = tx.objectStore('copies');
        tx.oncomplete = () => resolve(entry);
        tx.onabort = () => reject(tx.error || new Error('backup aborted'));
        const request = entries.getAll();
        request.onsuccess = () => {
          const previous = request.result;
          if (previous.some(row=>row.id===entry.id)) return;
          const used = { daily:0, change:0 };
          let bytes = 0;
          const ordered = [entry,...previous].sort((a,b)=>b.at-a.at || b.id.localeCompare(a.id));
          let retained = false;
          for (const row of ordered) {
            if (used[row.kind] >= limits[row.kind] || bytes + row.bytes > maxBytes) {
              entries.delete(row.id);
              payload.delete(row.id);
            } else {
              used[row.kind]++;
              bytes += row.bytes;
              if (row.id === entry.id) retained = true;
            }
          }
          if (retained) {
            entries.add(entry);
            payload.add(copies,entry.id);
          }
        };
      });
    }

    async function save(id, kind, at, local, incoming, reason) {
      if (await get('entries',id)) return;
      const copies = {local:await backupFor(local,at)};
      if (incoming) copies.incoming = await backupFor(incoming,at);
      const bytes = new TextEncoder().encode(JSON.stringify(copies)).byteLength;
      return put({id,kind,at,reason,bytes,paired:Boolean(incoming)},copies);
    }

    function daily(records, now = new Date()) {
      const day = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
      if (dailyDay === day) return Promise.resolve();
      if (!Object.values(records).some(row=>row.d!==null)) return Promise.resolve();
      dailyDay = day;
      return save('day-'+day,'daily',now.getTime(),records,null,'daily').catch(error=>{
        if (dailyDay === day) dailyDay = '';
        throw error;
      });
    }

    return {
      daily,
      change: (id,at,local,incoming,reason) => save('change-'+id,'change',at,local,incoming,reason),
      list: async () => (await get('entries')).sort((a,b)=>b.at-a.at || b.id.localeCompare(a.id)),
      read: id => get('copies',id)
    };
  }

  root.VkachSaveHistory = Object.freeze({create});
})(globalThis);
