/* MagicRace — compte joueur et classement (0.2.0).
 * Le compte (un pseudo) n'est pas obligatoire, mais il faut en avoir un pour voir le classement.
 * En ligne, le compte s'appuie sur la connexion claude.ai (base partagée de l'artifact, collection « leaderboard ») :
 * chaque joueur n'écrit que sa propre ligne. Hors claude.ai (site GitHub, fichier local), le classement n'est pas joignable. */
(function (MR) {
  'use strict';

  const KEY = 'magicrace.account.v1';
  const A = { status: 'checking' };
  let acc = null, pushTimer = null, lastPushed = '', writing = false, again = false;
  let listeners = [];

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

  A.online = function () { return !!(MR.Sync && MR.Sync.db && MR.Sync.uid); };
  A.uid = function () { return MR.Sync ? MR.Sync.uid : null; };

  // 'checking' → 'online' (classement joignable), 'readonly' (lecture seule : pas le droit d'écrire), 'offline' (hors claude.ai)
  A.init = async function () {
    A.status = 'checking'; emit();
    const S = await MR.Sync.ready;
    if (!S.db || !S.uid) { A.status = 'offline'; emit(); return; }
    let can = null;
    try { can = S.user && S.user.can ? await S.user.can('data.write') : null; } catch (e) { can = null; }
    A.status = can === false ? 'readonly' : 'online';
    emit();
    if (acc && A.status === 'online') push(true);
  };

  function entry() {
    const me = MR.Game.me ? MR.Game.me() : null, info = MR.Prog.info(), s = MR.Prog.stats();
    return { name: acc.pseudo, key: keyOf(acc.pseudo), xp: MR.Prog.xp(), level: info.level, races: s.races, wins: s.top1,
      color: me && MR.isHex(me.color) ? me.color : '#ff3ea5', skin: me ? String(me.skin || 'solid').slice(0, 24) : 'solid' };
  }
  async function push(now) {
    if (!acc || A.status !== 'online') return false;
    if (writing) { again = true; return false; }
    const e = entry(), sig = JSON.stringify(e);
    if (!now && sig === lastPushed) return true;
    writing = true;
    let ok = false;
    try {
      e.updatedAt = Date.now();
      await MR.Sync.db.doc('leaderboard/' + MR.Sync.uid).set(e);
      lastPushed = sig;
      ok = true;
    } catch (err) {
      if (err && err.code === 'invalid_argument') { A.status = 'readonly'; emit(); }
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

  async function taken(pseudo) {
    try {
      const snap = await MR.Sync.db.collection('leaderboard').where('key', '==', keyOf(pseudo)).limit(5).get();
      return snap.docs.some(function (d) { return d.id !== MR.Sync.uid; });
    } catch (e) { return false; }
  }

  // crée (ou renomme) le compte ; renvoie { ok, msg }
  A.create = async function (pseudo) {
    const p = A.tidy(pseudo);
    if (!A.valid(p)) return { ok: false, msg: 'Pseudo de 3 à 16 caractères : lettres, chiffres, espace, point, tiret.' };
    if (A.status === 'checking') return { ok: false, msg: 'Connexion en cours, réessaie dans quelques secondes.' };
    if (A.status === 'offline') return { ok: false, msg: 'Pas de compte possible sur cette page : elle n’a pas de serveur pour garder les comptes. Ouvre MagicRace sur claude.ai pour créer ton compte.' };
    if (A.status === 'readonly') return { ok: false, msg: 'Tu peux voir ce MagicRace mais pas y écrire : demande au propriétaire l’accès « Contributeur ».' };
    if (await taken(p)) return { ok: false, msg: '« ' + p + ' » est déjà pris, choisis un autre pseudo.' };
    const before = acc;
    acc = { pseudo: p, createdAt: before ? before.createdAt : Date.now() };
    lastPushed = '';
    const ok = await push(true);
    if (!ok) {
      acc = before;
      return { ok: false, msg: A.status === 'readonly' ? 'Tu peux voir ce MagicRace mais pas y écrire : demande au propriétaire l’accès « Contributeur ».' : 'Impossible d’enregistrer le compte pour le moment, réessaie.' };
    }
    save();
    emit();
    return { ok: true, msg: before ? 'Pseudo changé : ' + p : 'Compte créé : bienvenue ' + p + ' !' };
  };
  // supprime le compte et sa ligne du classement
  A.remove = async function () {
    if (!acc) return;
    if (A.status === 'online') {
      try { await MR.Sync.db.doc('leaderboard/' + MR.Sync.uid).delete(); } catch (e) { /* ignore */ }
    }
    acc = null; lastPushed = '';
    save();
    emit();
  };

  // classement : les 100 meilleurs XP, en direct (un seul abonnement à la fois)
  let unsub = null;
  A.watchBoard = function (cb, onError) {
    A.unwatchBoard();
    if (!A.online()) { onError('offline'); return; }
    try {
      unsub = MR.Sync.db.collection('leaderboard').orderBy('xp', 'desc').limit(100).onSnapshot(function (snap) {
        const rows = snap.docs.map(function (d) {
          const v = d.data() || {};
          return { id: d.id, name: A.valid(A.tidy(v.name)) ? A.tidy(v.name) : 'Joueur', xp: Math.max(0, Math.floor(+v.xp || 0)),
            level: Math.max(1, Math.floor(+v.level || 1)), races: Math.max(0, Math.floor(+v.races || 0)), wins: Math.max(0, Math.floor(+v.wins || 0)),
            color: MR.isHex(v.color) ? v.color : '#a99cc6', me: d.id === MR.Sync.uid };
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
