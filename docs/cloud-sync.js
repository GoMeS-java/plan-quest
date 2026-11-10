/* The local profile remains the source of offline work. A cloud write replaces
   one versioned snapshot; client clocks never decide which profile wins. */
(function (root) {
  'use strict';
  const MAX_PAYLOAD = 2 * 1024 * 1024;
  const hashPattern = /^[a-f0-9]{64}$/;
  const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
  const fail = code => Object.assign(new Error(code), {code});
  const history = () => root.VkachWorldHistory;
  const gameplay = records => Object.fromEntries(Object.entries(records).filter(([path])=>!history()?.isPath(path)));
  const hasRecords = records => Object.values(gameplay(records)).some(row=>row.d!==null);

  function configured(config, origin) {
    if (!config || config.enabled !== true || config.origin !== origin || !origin.startsWith('https://')) return false;
    try {
      const {apiKey,appId,projectId,authDomain,databaseURL} = config.firebase;
      const db = new URL(databaseURL);
      return Boolean(apiKey && appId && projectId && authDomain && db.protocol === 'https:' &&
        /^([a-z0-9-]+\.firebaseio\.com|[a-z0-9-]+\.[a-z0-9-]+\.firebasedatabase\.app)$/.test(db.hostname) &&
        db.pathname === '/' && !db.username && !db.password && !db.search && !db.hash &&
        (config.authMode !== 'redirect' || 'https://' + authDomain === origin));
    } catch (_) { return false; }
  }

  function decide(local, remote, base, empty) {
    if (local === remote) return 'equal';
    if (!remote) return base ? 'missing' : empty ? 'empty' : 'push';
    if (local === base || (!base && empty)) return 'pull';
    if (remote === base) return 'push';
    return 'conflict';
  }

  function nextVault(current, candidate) {
    const revision = (current?.head.revision || 0) + 1;
    const history = current?.head ? {a:current.head} : {};
    if (current?.history?.a) history.b = current.history.a;
    if (current?.history?.b) history.c = current.history.b;
    return {head:{...candidate,revision},...(history.a ? {history} : {})};
  }

  function create(bridge, transport) {
    let user = null, review = null, busy = false, signingOut = null, lastError = '', observed = 0;
    const meta = () => bridge.meta();
    const emit = () => bridge.changed();
    const active = () => !signingOut && user && meta().uid === user.uid && meta().enabled;
    const ensureUser = uid => { if (!user || user.uid !== uid) throw fail('auth'); };
    const ensureActive = uid => {
      ensureUser(uid);
      if (!active()) throw fail('paused');
      if (bridge.blocked()) throw fail('local-blocked');
    };
    const publicState = () => ({
      user, busy, signingOut:Boolean(signingOut), enabled:Boolean(active()), lastSync:meta().lastSync || 0, error:lastError,
      blocked:Boolean(user && meta().uid && meta().uid !== user.uid),
      review:review ? {local:review.local,remote:review.remote.records,revision:review.remote.head.revision} : null
    });
    const saveMeta = value => bridge.setMeta(value);

    async function unpack(head) {
      if (!head) return null;
      if (!Number.isSafeInteger(head.revision) || head.revision < 1 || !Number.isFinite(head.savedAt) || head.savedAt <= 0 || !idPattern.test(head.op) ||
          !hashPattern.test(head.hash) || typeof head.payload !== 'string' ||
          new TextEncoder().encode(head.payload).byteLength > MAX_PAYLOAD) throw fail('invalid-remote');
      try {
        const records = await bridge.decode(head.payload);
        if (!hasRecords(records) || await bridge.hash(records) !== head.hash) throw fail('invalid-remote');
        return {head,records};
      } catch (_) { throw fail('invalid-remote'); }
    }

    const gameplayHash = (records, hash) => history() ? bridge.hash(gameplay(records)) : Promise.resolve(hash);

    function acknowledge(info, hash, revision, baseGame) {
      saveMeta({...info,base:hash,baseGame,revision,lastSync:Date.now(),pending:null});
    }

    async function write(uid, local, hash, remote, info) {
      if (!hasRecords(local)) throw fail('empty-local');
      const op = info.pending?.hash === hash ? info.pending.op : crypto.randomUUID();
      const payload = await bridge.encode(local);
      const gameHash = await gameplayHash(local,hash);
      if (new TextEncoder().encode(payload).byteLength > MAX_PAYLOAD) throw fail('too-large');
      if (!info.firstUpload) await bridge.archive('first-'+op,local,null,'cloud-first');
      ensureActive(uid);
      const pending = {...info,pending:{hash,op}};
      saveMeta(pending);
      const head = await transport.commit(uid,remote?.head || null,{op,hash,payload});
      ensureActive(uid);
      if (!head || head.op !== op || head.hash !== hash) throw fail('changed-remote');
      acknowledge({...pending,firstUpload:true},hash,head.revision,gameHash);
      review = null;
    }

    async function keepHistory(uid, local, hash, remote, remoteGame) {
      const combined=history()?.join(local,remote.records)||local;
      const combinedHash=combined===local?hash:await bridge.hash(combined);
      if(combinedHash!==hash)await bridge.replace(local,combined);
      ensureActive(uid);
      if(combinedHash!==remote.head.hash)return write(uid,combined,combinedHash,remote,meta());
      acknowledge(meta(),combinedHash,remote.head.revision,remoteGame);
      review=null;
    }

    async function reconcile() {
      if (!active() || !transport.online()) return;
      if (bridge.blocked()) throw fail('local-blocked');
      const uid = user.uid, local = await bridge.read(), hash = await bridge.hash(local);
      const remote = await unpack(await transport.head(uid));
      const remoteGame = remote ? await gameplayHash(remote.records,remote.head.hash) : null;
      ensureActive(uid);
      let info = meta();
      if (info.revision && (remote?.head.revision || 0) < info.revision) throw fail('missing-remote');
      if (remote && info.pending?.op === remote.head.op && info.pending.hash === remote.head.hash) {
        acknowledge({...info,firstUpload:true},remote.head.hash,remote.head.revision,remoteGame);
        info = meta();
      }
      let action = decide(hash,remote?.head.hash,info.base,!hasRecords(local));
      if (action === 'conflict' && history()) {
        const localGame=await gameplayHash(local,hash);
        ensureActive(uid);
        // A new observation on either device does not fork the gameplay data.
        if(localGame===remoteGame)return keepHistory(uid,local,hash,remote,remoteGame);
        if(info.baseGame===localGame)action='pull';
        else if(info.baseGame===remoteGame)action='push';
      }
      if (action === 'missing') throw fail('missing-remote');
      if (action === 'empty') { review = null; return; }
      if (action === 'equal') {
        if (info.base !== hash || info.revision !== remote.head.revision || info.baseGame !== remoteGame)
          acknowledge(info,hash,remote.head.revision,remoteGame);
        review = null;
        return;
      }
      if (action === 'push') return remote ? keepHistory(uid,local,hash,remote,remoteGame) : write(uid,local,hash,remote,info);
      if (action === 'pull') {
        await bridge.replace(local,remote.records);
        ensureActive(uid);
        acknowledge(info,remote.head.hash,remote.head.revision,remoteGame);
        review = null;
        return;
      }
      if (review?.hash !== hash || review?.remote.head.op !== remote.head.op) {
        await bridge.archive('conflict-'+crypto.randomUUID(),local,remote.records,'cloud-conflict');
        ensureActive(uid);
        review = {local,hash,remote};
      }
    }

    function run(task) {
      return bridge.serial(async () => {
        busy = true; lastError = ''; emit();
        try { return await task(); }
        catch (error) { lastError = error.code || 'cloud-error'; throw error; }
        finally { busy = false; emit(); }
      });
    }

    const api = {
      state:publicState,
      signIn:() => transport.signIn(),
      signOut:() => {
        if (signingOut) return signingOut;
        signingOut = Promise.resolve().then(async () => {
          try {
            if (meta().enabled && meta().uid === user?.uid) saveMeta({...meta(),enabled:false});
          } finally {
            try { await bridge.disablePush?.(); } catch (_) { /* Auth logout is independent of Push. */ }
            await transport.signOut();
            lastError = '';
          }
        }).finally(() => { signingOut = null; emit(); });
        review = null;
        emit();
        return signingOut;
      },
      enable:() => run(async () => {
        if (signingOut) throw fail('paused');
        if (!user || (meta().uid && meta().uid !== user.uid)) throw fail('wrong-account');
        saveMeta({...meta(),uid:user.uid,enabled:true});
        await reconcile();
      }),
      pause:() => {
        if (meta().enabled) saveMeta({...meta(),enabled:false});
        review = null;
      },
      tick:() => run(reconcile),
      resolve:choice => {
        const expected = review;
        return run(async () => {
          if (!active() || !expected || review !== expected || !['local','remote'].includes(choice)) throw fail('changed-review');
          const uid = user.uid, local = await bridge.read();
          const remote = await unpack(await transport.head(uid));
          ensureActive(uid);
          if (await bridge.hash(local) !== expected.hash || remote?.head.op !== expected.remote.head.op ||
              remote.head.revision !== expected.remote.head.revision) throw fail('changed-review');
          const remoteGame=await gameplayHash(remote.records,remote.head.hash);
          ensureActive(uid);
          if (choice === 'local') return keepHistory(uid,local,expected.hash,remote,remoteGame);
          await bridge.replace(local,remote.records);
          ensureActive(uid);
          acknowledge(meta(),remote.head.hash,remote.head.revision,remoteGame);
          review = null;
        });
      },
      history:async () => {
        if (!user || meta().uid !== user.uid || !transport.online()) throw fail('auth');
        const uid = user.uid, rows = await transport.history(uid);
        const result = await Promise.all(rows.map(unpack));
        ensureUser(uid);
        return result.filter(Boolean).sort((a,b)=>b.head.revision-a.head.revision);
      }
    };

    transport.observe(next => {
      if (user?.uid !== next?.uid) { review = null; observed = 0; }
      user = next;
      emit();
      if (active()) bridge.schedule();
    }, revision => {
      if (revision !== observed) { observed = revision; if (active()) bridge.schedule(); }
    });
    return api;
  }

  root.VkachCloudSync = Object.freeze({configured,decide,nextVault,create,MAX_PAYLOAD});
})(globalThis);
