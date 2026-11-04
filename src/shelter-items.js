/* Persistent receipts and room anchors, in the 480 × 320 art plane. */
(function (root) {
  'use strict';
  var path = 'cfg/shelter-items';
  var types = {
    wall: 'clock dart mirror garland pennant medal banner tapestry poster1 poster2 poster3 darkmirror chains',
    table: 'cat bag kettle scale globe monitors',
    pedestal: 'trophy lamp owl bolt shard lantern',
    floor: 'safe rug shelf desk pc abyssobelisk',
    arch: 'gate'
  };
  var names = {wall:'На стене',table:'На столе',pedestal:'На подставке',floor:'На полу',arch:'В нише'};
  // Anchors leave the foreground aisle and side exits clear.
  var rooms = {
    rest:        {wall:[224,155,1],table:[234,220,2],pedestal:[169,257,2],floor:[190,277,3]},
    study:       {wall:[227,137,1],table:[211,227,2],pedestal:[166,262,2],floor:[117,277,3]},
    archive:     {wall:[214,151,1],table:[244,226,2],pedestal:[190,257,2],floor:[192,277,3]},
    forge:       {wall:[187,153,1],table:[391,220,2],pedestal:[187,248,2],floor:[282,279,3]},
    throne:      {wall:[242,126,1],pedestal:[383,247,2],floor:[205,276,3],arch:[302,204,3]},
    observatory: {wall:[90,145,1],table:[83,208,2],pedestal:[372,252,2],floor:[175,279,3]},
    gatehouse:   {wall:[120,153,1],table:[215,228,2],pedestal:[390,256,2],floor:[283,277,3],arch:[323,193,3]},
    refectory:   {wall:[234,141,1],table:[217,219,2],pedestal:[110,251,2],floor:[345,280,3]},
    cloister:    {wall:[181,142,1],pedestal:[156,248,2],floor:[327,278,3],arch:[187,219,3]},
    vault:       {wall:[132,150,1],table:[96,206,2],pedestal:[319,256,2],floor:[337,277,3],arch:[316,199,3]}
  };
  var restrictions = {
    cat:'rest study archive refectory', bag:'rest study gatehouse refectory vault',
    kettle:'rest study forge refectory', scale:'forge refectory vault',
    globe:'study archive observatory', monitors:'rest study observatory',
    safe:'rest study gatehouse vault', rug:'rest study throne observatory refectory cloister',
    shelf:'rest study archive refectory vault', desk:'rest study archive observatory',
    pc:'rest study observatory', abyssobelisk:'throne observatory cloister vault',
    chains:'forge gatehouse vault', bolt:'forge observatory gatehouse vault',
    owl:'rest study archive observatory cloister'
  };
  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }
  function state(value) {
    var s = object(value);
    return Object.assign({}, s, {owned:{...object(s.owned)}, placements:{...object(s.placements)}});
  }
  function owns(s, key) {
    return Object.hasOwn(s.owned, key) && !!s.owned[key];
  }
  function anchor(key, room, slot, level) {
    if (!Object.hasOwn(rooms, room) || !Object.hasOwn(types, slot) || !types[slot].split(' ').includes(key)) return null;
    if (Object.hasOwn(restrictions,key) && !restrictions[key].split(' ').includes(room)) return null;
    var point = rooms[room][slot];
    return point && level >= point[2] ? {x:point[0], y:point[1], label:names[slot]} : null;
  }
  function slots(key, room, level) {
    return Object.keys(types).filter(function (slot) { return anchor(key, room, slot, level); });
  }
  function timestamp(row) {
    return Number.isSafeInteger(row && row.at) && row.at > 0 ? row.at : 0;
  }
  function grant(value, keys, now) {
    var s = state(value);
    keys.forEach(function (key) {
      if (!owns(s,key)) Object.defineProperty(s.owned,key,{value:now,enumerable:true,writable:true,configurable:true});
    });
    return s;
  }
  function active(value, room, level) {
    var s = state(value);
    return Object.entries(s.placements).filter(function ([key,row]) {
      return owns(s,key) && row && row.room === room && anchor(key,room,row.slot,level);
    });
  }
  function occupant(value, room, slot) {
    return active(value, room, 3).find(function ([,row]) {return row.slot === slot;})?.[0] || null;
  }
  function place(value, key, room, slot, level, expected, now) {
    var s = state(value);
    if (!owns(s,key) || (room !== null && !anchor(key,room,slot,level))) return null;
    var previous = room === null ? null : occupant(s,room,slot);
    if (previous !== expected) return null;
    var at = Math.max(now, timestamp(s.placements[key])+1, timestamp(s.placements[previous])+1);
    if (previous && previous !== key) s.placements[previous] = {...s.placements[previous], room:null, slot:null, at:at};
    s.placements[key] = {...s.placements[key], room:room, slot:slot, at:at};
    return s;
  }
  function merge(local, incoming) {
    var a = state(local), b = state(incoming);
    var out = {...a,...b,owned:{...a.owned},placements:{...a.placements}};
    Object.entries(b.owned).forEach(function ([key,receipt]) {
      if (receipt && (!owns(out,key) || receipt < out.owned[key])) {
        Object.defineProperty(out.owned,key,{value:receipt,enumerable:true,writable:true,configurable:true});
      }
    });
    Object.entries(b.placements).forEach(function ([key,row]) {
      var old = Object.hasOwn(a.placements,key) ? a.placements[key] : null;
      var incomingWins = !old || timestamp(row) > timestamp(old) ||
        (timestamp(row) === timestamp(old) && JSON.stringify(row) > JSON.stringify(old));
      var combined = incomingWins ? {...object(old),...object(row)} : {...object(row),...object(old)};
      Object.defineProperty(out.placements,key,{value:combined,enumerable:true,writable:true,configurable:true});
    });
    var taken = new Set();
    Object.entries(out.placements).sort(function ([ak,aRow],[bk,bRow]) {
      return timestamp(bRow)-timestamp(aRow) || (ak < bk ? -1 : ak === bk ? 0 : 1);
    }).forEach(function ([key,row]) {
      if (!row || !owns(out,key) || !anchor(key,row.room,row.slot,3)) return;
      var id = row.room+'/'+row.slot;
      if (taken.has(id)) out.placements[key] = {...row,room:null,slot:null,at:timestamp(row)+1};
      taken.add(id);
    });
    return out;
  }
  root.VkachShelter = Object.freeze({path,state,owns,grant,anchor,slots,active,occupant,place,merge});
})(globalThis);
