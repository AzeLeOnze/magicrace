/* MagicRace — compte joueur et classement (0.2.0).
 * Le compte (un pseudo) n'est pas obligatoire, mais il faut en avoir un pour voir le classement.
 * Deux serveurs possibles, même interface (doc/collection/get/set/onSnapshot) :
 *  - site public (GitHub Pages) : Firebase (firebase.js) — compte anonyme ou Google, pseudos uniques (collection
 *    « names »), classement « leaderboard », sauvegarde « saves/<uid> » (PC + téléphone avec Google) ;
 *  - claude.ai : base partagée de l'artifact, liée à la connexion claude.ai. */
(function (MR) {
  'use strict';

  const KEY = 'magicrace.account.v1';
  const A = { status: 'checking', backend: null };
  let acc = null, pushTimer = null, lastPushed = '', writing = false, again = false;
  let listeners = [];
  let db = null, uid = null;

  function clean(a) {
    if (!a || typeof a !== 'object' || typeof a.pseudo !== 'string') return null;
    const p = A.tidy(a.pseudo);
    if (!A.valid(p)) return null;
    return { pseudo: p, createdAt: typeof a.createdAt === 'number' ? a.createdAt : Date.now() };
  }
  A.tidy = function (p) { return String(p || '').replace(/\s+/g, ' ').trim().slice(0, 16); };
  A.valid = function (p) {
    return typeof p === 'string' && p.length >= 3 && p.length <= 16 && /^[\p{L}\p{N}][\p{L}\p{N} _.\-']*$/u.test(p);
  };
  function keyOf(p) { return A.tidy(p).toLowerCase(); }

  A.load = function () { acc = clean(MR.store.get(KEY, null)); };
  A.get = function () { return acc; };
  function save() {
    MR.store.set(KEY, acc);
    if (MR.Sync) MR.Sync.changed();
  }
  function emit() { listeners.forEach(function (fn) { try { fn(A.status); } catch (e) { /* ignore */ } }); }
  A.onChange = function (fn) { listeners.push(fn); };

  A.online = function () { return !!(db && uid); };
  A.uid = function () { return uid; };
  A.isFirebase = function () { return A.backend === 'firebase'; };
  A.isGoogle = function () { return A.isFirebase() && MR.FB.isGoogle(); };

  // 'checking' → 'online' (classement joignable), 'readonly' (pas le droit d'écrire), 'offline' (aucun serveur)
  A.init = async function () {
    A.status = 'checking'; emit();
    if (MR.FB && MR.FB.enabled) { await initFirebase(); return; }
    const S = await MR.Sync.ready;
    if (!S.db || !S.uid) { A.status = 'offline'; emit(); return; }
    A.backend = 'claude'; db = S.db; uid = S.uid;
    let can = null;
    try { can = S.user && S.user.can ? await S.user.can('data.write') : null; } catch (e) { can = null; }
    A.status = can === false ? 'readonly' : 'online';
    emit();
    if (acc && A.status === 'online') push(true);
  };

  async function initFirebase() {
    const FB = await MR.FB.init();
    if (!FB) { A.status = 'offline'; emit(); return; }
    A.backend = 'firebase'; db = FB.db;
    A.status = 'online';
    await useFirebaseUser();
    emit();
  }
  // session Firebase active : retrouve le pseudo du compte et branche la sauvegarde
  async function useFirebaseUser() {
    const u = MR.FB.user();
    uid = u ? u.uid : null;
    if (!uid) { if (acc) { acc = null; save(); } return; }
    try {
      const d = await db.doc('leaderboard/' + uid).get();
      if (d.exists && A.valid(A.tidy((d.data() || {}).name))) {
        const p = A.tidy(d.data().name);
        if (!acc || acc.pseudo !== p) { acc = { pseudo: p, createdAt: acc ? acc.createdAt : Date.now() }; MR.store.set(KEY, acc); }
      } else if (acc) { lastPushed = ''; }
    } catch (e) { /* hors ligne : on garde le pseudo local */ }
    if (acc) {
      await MR.Sync.attach(db.doc('saves/' + uid));
      push(true);
    }
  }

  function entry() {
    const me = MR.Game.me ? MR.Game.me() : null, info = MR.Prog.info(), s = MR.Prog.stats();
    return { name: acc.pseudo, key: keyOf(acc.pseudo), xp: Math.floor(MR.Prog.xp()), level: info.level, races: Math.floor(s.races), wins: Math.floor(s.top1),
      color: me && MR.isHex(me.color) ? me.color : '#ff3ea5', skin: me ? String(me.skin || 'solid').slice(0, 24) : 'solid' };
  }
  async function push(now) {
    if (!acc || !uid || A.status !== 'online') return false;
    if (writing) { again = true; return false; }
    const e = entry(), sig = JSON.stringify(e);
    if (!now && sig === lastPushed) return true;
    writing = true;
    let ok = false;
    try {
      e.updatedAt = Date.now();
      await db.doc('leaderboard/' + uid).set(e);
      lastPushed = sig;
      ok = true;
    } catch (err) {
      if (err && err.code === 'invalid_argument') { A.status = 'readonly'; emit(); }
      A.lastError = err && err.code;
    }
    writing = false;
    if (again) { again = false; push(false); }
    return ok;
  }
  // l'XP a changé : mise à jour groupée de la ligne du classement
  A.changed = function () {
    if (!acc) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push(false); }, 2500);
  };

  async function takenClaude(pseudo) {
    try {
      const snap = await db.collection('leaderboard').where('key', '==', keyOf(pseudo)).limit(5).get();
      return snap.docs.some(function (d) { return d.id !== uid; });
    } catch (e) { return false; }
  }
  // Firebase : le pseudo est réservé dans names/<pseudo en minuscules> (les règles empêchent les doublons)
  async function reserveName(pseudo) {
    const ref = db.doc('names/' + keyOf(pseudo));
    const d = await ref.get();
    if (d.exists) return (d.data() || {}).uid === uid ? 'mine' : 'taken';
    try { await ref.set({ uid: uid, at: Date.now() }); return 'ok'; } catch (e) { return e && e.code === 'permission-denied' ? 'taken' : 'error'; }
  }

  const ERR_RULES = 'Le serveur refuse l’écriture : les règles Firestore ne sont pas encore en place.';
  // crée (ou renomme) le compte ; renvoie { ok, msg }
  A.create = async function (pseudo) {
    const p = A.tidy(pseudo);
    if (!A.valid(p)) return { ok: false, msg: 'Pseudo de 3 à 16 caractères : lettres, chiffres, espace, point, tiret.' };
    if (A.status === 'checking') return { ok: false, msg: 'Connexion en cours, réessaie dans quelques secondes.' };
    if (A.status === 'offline') return { ok: false, msg: 'Impossible de joindre le serveur des comptes (pas de connexion internet ?). Réessaie plus tard.' };
    if (A.status === 'readonly') return { ok: false, msg: 'Tu peux voir ce MagicRace mais pas y écrire : demande au propriétaire l’accès « Contributeur ».' };
    const before = acc;
    if (A.isFirebase()) {
      try {
        if (!MR.FB.user()) await MR.FB.signInAnon();
        uid = MR.FB.user().uid;
      } catch (e) {
        return { ok: false, msg: e && e.code === 'auth/operation-not-allowed' ? 'La connexion anonyme n’est pas activée dans Firebase (Authentication → Anonyme).' : 'Connexion au serveur impossible pour le moment, réessaie.' };
      }
      let r;
      try { r = await reserveName(p); } catch (e) { r = e && e.code === 'permission-denied' ? 'rules' : 'error'; }
      if (r === 'taken') return { ok: false, msg: '« ' + p + ' » est déjà pris, choisis un autre pseudo.' };
      if (r === 'rules') return { ok: false, msg: ERR_RULES };
      if (r === 'error') return { ok: false, msg: 'Impossible de réserver ce pseudo pour le moment, réessaie.' };
    } else if (await takenClaude(p)) return { ok: false, msg: '« ' + p + ' » est déjà pris, choisis un autre pseudo.' };
    acc = { pseudo: p, createdAt: before ? before.createdAt : Date.now() };
    lastPushed = '';
    const ok = await push(true);
    if (!ok) {
      acc = before;
      return { ok: false, msg: A.status === 'readonly' ? 'Tu peux voir ce MagicRace mais pas y écrire : demande au propriétaire l’accès « Contributeur ».'
        : A.lastError === 'permission-denied' ? ERR_RULES : 'Impossible d’enregistrer le compte pour le moment, réessaie.' };
    }
    // ancien pseudo libéré
    if (A.isFirebase() && before && keyOf(before.pseudo) !== keyOf(p)) { try { await db.doc('names/' + keyOf(before.pseudo)).delete(); } catch (e) { /* ignore */ } }
    save();
    if (A.isFirebase() && !before) MR.Sync.attach(db.doc('saves/' + uid));
    emit();
    return { ok: true, msg: before ? 'Pseudo changé : ' + p : 'Compte créé : bienvenue ' + p + ' !' };
  };
  // supprime le compte et sa ligne du classement (la progression reste sur l'appareil)
  A.remove = async function () {
    if (!acc) return;
    if (A.status === 'online' && uid) {
      try { await db.doc('leaderboard/' + uid).delete(); } catch (e) { /* ignore */ }
      if (A.isFirebase()) {
        try { await db.doc('names/' + keyOf(acc.pseudo)).delete(); } catch (e) { /* ignore */ }
        try { await db.doc('saves/' + uid).delete(); } catch (e) { /* ignore */ }
        MR.Sync.detach();
      }
    }
    acc = null; lastPushed = '';
    save();
    emit();
  };

  // Firebase : relier le compte à Google (même compte sur PC et téléphone), ou retrouver un compte Google
  A.google = async function () {
    if (!A.isFirebase()) return { ok: false, msg: 'Indisponible ici.' };
    try {
      const how = await MR.FB.google();
      MR.Sync.detach();
      await useFirebaseUser();
      emit();
      if (how === 'linked') return { ok: true, msg: 'Compte relié à Google : tu le retrouveras sur tous tes appareils.' };
      return { ok: true, msg: acc ? 'Connecté : bon retour ' + acc.pseudo + ' !' : 'Connecté avec Google. Choisis maintenant ton pseudo.' };
    } catch (e) {
      const c = e && e.code;
      if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return { ok: false, msg: 'Connexion annulée.' };
      if (c === 'auth/operation-not-allowed') return { ok: false, msg: 'La connexion Google n’est pas activée dans Firebase (Authentication → Google).' };
      if (c === 'auth/unauthorized-domain') return { ok: false, msg: 'Ce site n’est pas dans les domaines autorisés de Firebase.' };
      if (c === 'auth/popup-blocked') return { ok: false, msg: 'Le navigateur a bloqué la fenêtre de connexion : autorise les pop-ups.' };
      return { ok: false, msg: 'Connexion Google impossible (' + (c || 'erreur') + ').' };
    }
  };
  A.signOut = async function () {
    if (!A.isFirebase()) return;
    MR.Sync.detach();
    await MR.FB.signOut();
    uid = null; acc = null; lastPushed = '';
    MR.store.set(KEY, null);
    emit();
  };

  // classement : les 100 meilleurs XP, en direct (un seul abonnement à la fois)
  let unsub = null;
  A.watchBoard = function (cb, onError) {
    A.unwatchBoard();
    if (!A.online()) { onError('offline'); return; }
    try {
      unsub = db.collection('leaderboard').orderBy('xp', 'desc').limit(100).onSnapshot(function (snap) {
        const rows = snap.docs.map(function (d) {
          const v = d.data() || {};
          return { id: d.id, name: A.valid(A.tidy(v.name)) ? A.tidy(v.name) : 'Joueur', xp: Math.max(0, Math.floor(+v.xp || 0)),
            level: Math.max(1, Math.floor(+v.level || 1)), races: Math.max(0, Math.floor(+v.races || 0)), wins: Math.max(0, Math.floor(+v.wins || 0)),
            color: MR.isHex(v.color) ? v.color : '#a99cc6', me: d.id === uid };
        });
        cb(rows, snap.metadata && snap.metadata.fromCache);
      }, function (e) { onError(e && e.code || 'unavailable'); });
    } catch (e) { onError('unavailable'); }
  };
  A.unwatchBoard = function () { if (unsub) { try { unsub(); } catch (e) { /* ignore */ } unsub = null; } };

  A.exportState = function () { return acc ? { pseudo: acc.pseudo, createdAt: acc.createdAt } : null; };
  A.importState = function (r) {
    const c = clean(r);
    if (c && !acc) { acc = c; MR.store.set(KEY, acc); emit(); if (A.status === 'online') push(true); }
  };

  MR.Account = A;
})(window.MR);
