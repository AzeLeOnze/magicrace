/* MagicRace — Firebase (0.2.0) : comptes, classement et sauvegarde pour le site public (GitHub Pages).
 * Le SDK n'est chargé que sur le site (et en local pour les tests) : dans claude.ai, le jeu garde la base de l'artifact.
 * La configuration ci-dessous n'est pas secrète : ce sont les règles Firestore qui protègent les données. */
(function (MR) {
  'use strict';

  const CONFIG = {
    apiKey: 'AIzaSyCz5J6wZHtsocW9zZFX1phSKOPx0MXaNhA',
    authDomain: 'magicrace-cb748.firebaseapp.com',
    projectId: 'magicrace-cb748',
    storageBucket: 'magicrace-cb748.firebasestorage.app',
    messagingSenderId: '778159235543',
    appId: '1:778159235543:web:d07075be07463d0068ab92'
  };
  const VERSION = '10.12.2';
  const host = location.hostname;
  const FB = {
    enabled: host === 'azeleonze.github.io' || host === 'localhost' || host === '127.0.0.1',
    auth: null, db: null, ready: null
  };

  function load(src) {
    return new Promise(function (res, rej) {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error('script ' + src)); };
      document.head.appendChild(s);
    });
  }
  function timeout(p, ms) {
    return Promise.race([p, new Promise(function (res, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]);
  }

  // charge le SDK et attend que la session (si elle existe) soit restaurée ; renvoie FB ou null
  FB.init = function () {
    if (FB.ready) return FB.ready;
    FB.ready = (async function () {
      if (!FB.enabled) return null;
      try {
        const base = 'https://www.gstatic.com/firebasejs/' + VERSION + '/';
        await timeout(load(base + 'firebase-app-compat.js'), 15000);
        await timeout(Promise.all([load(base + 'firebase-auth-compat.js'), load(base + 'firebase-firestore-compat.js')]), 15000);
        const fb = window.firebase;
        fb.initializeApp(CONFIG);
        FB.auth = fb.auth();
        FB.db = fb.firestore();
        await timeout(new Promise(function (res) { const off = FB.auth.onAuthStateChanged(function () { off(); res(); }); }), 10000);
        return FB;
      } catch (e) {
        console.warn('[MagicRace] Firebase indisponible', e);
        return null;
      }
    })();
    return FB.ready;
  };

  FB.user = function () { return FB.auth ? FB.auth.currentUser : null; };
  FB.signInAnon = function () { return FB.auth.signInAnonymously(); };
  FB.isGoogle = function () {
    const u = FB.user();
    return !!(u && !u.isAnonymous && u.providerData.some(function (p) { return p.providerId === 'google.com'; }));
  };
  // connexion Google : relie le compte anonyme actuel, ou retrouve un compte Google déjà existant
  FB.google = async function () {
    const provider = new window.firebase.auth.GoogleAuthProvider();
    const u = FB.user();
    if (u && u.isAnonymous) {
      try { await u.linkWithPopup(provider); return 'linked'; } catch (e) {
        if (e && (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') && e.credential) {
          await FB.auth.signInWithCredential(e.credential);
          return 'switched';
        }
        throw e;
      }
    }
    await FB.auth.signInWithPopup(provider);
    return 'signed';
  };
  FB.signOut = function () { return FB.auth ? FB.auth.signOut() : Promise.resolve(); };

  MR.FB = FB;
})(window.MR);
