/* Firebase stays lazy and origin-gated; offline play never waits for its SDK. */
(function (root) {
  'use strict';
  const sdk = name => import('https://www.gstatic.com/firebasejs/13.2.0/firebase-' + name + '.js');

  async function connect(config) {
    const [app,auth,db] = await Promise.all(['app','auth','database'].map(sdk));
    const project = app.initializeApp(config.firebase,'vkach-cloud');
    const session = auth.getAuth(project), database = db.getDatabase(project);
    await auth.setPersistence(session,auth.browserLocalPersistence);
    const redirected = config.authMode === 'redirect' ? auth.getRedirectResult(session) : Promise.resolve();
    const authError = redirected.catch(error=>error);
    let connected = false, messaging, stopRevision;
    const vault = uid => 'vaults/' + uid;
    const ref = path => db.ref(database,path);
    const online = () => connected && navigator.onLine;
    const sameHead = (left,right) => (left?.revision || 0) === (right?.revision || 0) && left?.op === right?.op;
    function checkUser(uid) {
      if (session.currentUser?.uid !== uid || !online()) throw Object.assign(new Error('No active Firebase session'),{code:'auth'});
    }

    return {
      online,
      authError,
      observe(onUser,onRevision) {
        db.onValue(ref('.info/connected'), snapshot => {
          connected = snapshot.val() === true;
          if (connected) onRevision(Symbol('connection'));
        });
        auth.onAuthStateChanged(session,user=>{
          stopRevision?.();
          onUser(user ? {uid:user.uid,email:user.email || ''} : null);
          if (user) stopRevision = db.onValue(ref(vault(user.uid)+'/head/revision'),snapshot=>onRevision(snapshot.val() || 0),()=>onRevision(Symbol('access')));
        });
      },
      signIn() {
        const provider = new auth.GoogleAuthProvider();
        provider.setCustomParameters({prompt:'select_account'});
        return config.authMode === 'redirect' ? auth.signInWithRedirect(session,provider) :
          auth.signInWithPopup(session,provider);
      },
      signOut:() => auth.signOut(session),
      async head(uid) {
        checkUser(uid);
        return (await db.get(ref(vault(uid)+'/head'))).val();
      },
      async commit(uid,expected,candidate) {
        checkUser(uid);
        const target = ref(vault(uid));
        const cached = (await db.get(target)).val();
        checkUser(uid);
        if (!sameHead(cached?.head,expected)) return null;
        const result = await db.runTransaction(target,current=>{
          if (current === null && cached !== null) current = cached;
          if (!sameHead(current?.head,expected)) return;
          return root.VkachCloudSync.nextVault(current,{...candidate,savedAt:db.serverTimestamp()});
        },{applyLocally:false});
        return result.committed ? result.snapshot.val().head : null;
      },
      async history(uid) {
        checkUser(uid);
        return Object.values((await db.get(ref(vault(uid)+'/history'))).val() || {});
      },
      async pushToken(registration) {
        messaging ||= sdk('messaging').then(api=>({api,client:api.getMessaging(project)}));
        const {api,client} = await messaging;
        return api.getToken(client,{vapidKey:config.vapidKey,serviceWorkerRegistration:registration});
      },
      async deletePushToken() {
        messaging ||= sdk('messaging').then(api=>({api,client:api.getMessaging(project)}));
        const {api,client} = await messaging;
        return api.deleteToken(client);
      },
      async subscription(uid,device,proof) {
        checkUser(uid);
        return db.set(ref('subscriptions/'+uid+'/'+device),proof ? {...proof,observedAt:db.serverTimestamp()} : null);
      },
      async testPush(uid,device) {
        checkUser(uid);
        const api=await sdk('functions');
        checkUser(uid);
        const call=api.httpsCallable(api.getFunctions(project),'sendCitadelTestPush',{timeout:15000});
        return (await call({device})).data?.accepted===true;
      }
    };
  }

  root.VkachFirebase = Object.freeze({connect});
})(globalThis);
