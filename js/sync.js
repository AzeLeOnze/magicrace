/* MagicRace — sauvegarde dans le compte claude.ai (cartes, billes, progression), quand la page tourne dans claude.ai.
 * Le stockage du navigateur reste la sauvegarde locale ; ce module n'ajoute que la copie privée du joueur.
 * 0.2.0 : expose aussi la base partagée et l'identifiant du joueur pour les comptes et le classement (account.js). */
(function (MR) {
  'use strict';

  const S = { connected: false, db: null, uid: null, user: null };
  let ref = null, timer = null, writing = false, again = false, retried = false;
  let readyResolve = null;
  S.ready = new Promise(function (res) { readyResolve = res; });

  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function timeout(p, ms) {
    return Promise.race([p, new Promise(function (res) { setTimeout(function () { res(null); }, ms); })]);
  }

  S.init = async function () {
    try {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') return;
      const user = await c.use('user');
      if (!user) return;
      const id = await user.id();
      if (!id) return;
      const db = await c.use('db');
      if (!db) return;
      S.db = db; S.uid = id; S.user = user;
      const r = db.doc('data/users/' + id + '/save');
      const snap = await timeout(r.get(), 10000);
      if (!snap) return; // stockage injoignable : on reste en local pour cette visite
      ref = r;
      S.connected = true;
      let remote = null;
      if (snap.exists) {
        remote = JSON.parse(JSON.stringify(snap.data() || {}));
        MR.Game.importSave(remote);
      }
      if (!remote || canon(MR.Game.exportSave()) !== canon(remote)) S.changed(true);
    } catch (e) {
      ref = null;
      S.connected = false;
    } finally {
      readyResolve(S);
    }
  };

  // site public : sauvegarde du compte dans Firebase (saves/<uid>), même fusion que dans claude.ai
  S.attach = async function (r) {
    try {
      const snap = await timeout(r.get(), 10000);
      if (!snap) return false;
      ref = r;
      S.connected = true;
      let remote = null;
      if (snap.exists) {
        remote = JSON.parse(JSON.stringify(snap.data() || {}));
        MR.Game.importSave(remote);
      }
      if (!remote || canon(MR.Game.exportSave()) !== canon(remote)) S.changed(true);
      return true;
    } catch (e) { return false; }
  };
  S.detach = function () { ref = null; S.connected = false; clearTimeout(timer); };

  S.changed = function (now) {
    if (!ref) return;
    clearTimeout(timer);
    timer = setTimeout(flush, now ? 50 : 1500);
  };

  async function flush() {
    if (!ref) return;
    if (writing) { again = true; return; }
    writing = true;
    try {
      await ref.set(JSON.parse(JSON.stringify(MR.Game.exportSave())));
      retried = false;
    } catch (e) {
      const code = e && e.code;
      if (code === 'unavailable' || code === 'resource_exhausted') {
        // un seul nouvel essai ; sinon la prochaine modification réessaiera
        if (!retried) { retried = true; setTimeout(function () { S.changed(true); }, 2000 + Math.random() * 2000); }
      } else { ref = null; S.connected = false; }
    }
    writing = false;
    if (again) { again = false; flush(); }
  }

  MR.Sync = S;
})(window.MR);
