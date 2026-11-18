/* MagicRace — cartes à jouer : paquets (1 toutes les 10 min, 10 en réserve + bonus de niveau), tirage, collection.
 * 0.2.0 : paquet ultra (épique 82 %, légendaire 18 %) ; un paquet des 10 minutes peut cacher un premium (0,8 %) ou un ultra (0,3 %). */
(function (MR) {
  'use strict';

  const KEY = 'magicrace.cards.v1';
  const PERIOD = 10 * 60 * 1000;
  const MAX_PACKS = 10;
  const PER_PACK = 5;
  const HARD_MAX = 99; // les paquets gagnés en course peuvent dépasser la réserve de 10

  // paquet premium (récompense) : jamais de commune ni de peu commune
  const PREMIUM = [{ id: 'rare', chance: 80 }, { id: 'epic', chance: 15 }, { id: 'legendary', chance: 5 }];
  // paquet ultra : encore mieux que le premium
  const ULTRA = [{ id: 'epic', chance: 82 }, { id: 'legendary', chance: 18 }];
  const HIDDEN_ULTRA = 0.003, HIDDEN_PREMIUM = 0.008;
  const TABLES = { normal: null, premium: PREMIUM, ultra: ULTRA };

  const C = { PERIOD: PERIOD, BASE_MAX: MAX_PACKS, PER_PACK: PER_PACK, PREMIUM: PREMIUM, ULTRA: ULTRA, HIDDEN_ULTRA: HIDDEN_ULTRA, HIDDEN_PREMIUM: HIDDEN_PREMIUM };
  // réserve : 10 paquets, +1 aux niveaux 10, 20… 100 (voir progress.js)
  function maxPacks() { return MAX_PACKS + (MR.Prog && MR.Prog.storageBonus ? MR.Prog.storageBonus() : 0); }
  C.max = maxPacks;
  let st = null;

  function fresh() {
    // un paquet de bienvenue, puis un toutes les 10 minutes
    return { packs: 1, premium: 0, ultra: 0, secret: [], anchor: Date.now(), owned: {}, fresh: {}, opened: 0, updatedAt: 0 };
  }
  function clean(s) {
    if (!s || typeof s !== 'object') return null;
    const o = fresh();
    if (typeof s.packs === 'number' && isFinite(s.packs)) o.packs = MR.clamp(Math.floor(s.packs), 0, HARD_MAX);
    if (typeof s.premium === 'number' && isFinite(s.premium)) o.premium = MR.clamp(Math.floor(s.premium), 0, HARD_MAX);
    if (typeof s.ultra === 'number' && isFinite(s.ultra)) o.ultra = MR.clamp(Math.floor(s.ultra), 0, HARD_MAX);
    if (Array.isArray(s.secret)) o.secret = s.secret.filter(function (t) { return t === 'premium' || t === 'ultra'; }).slice(0, o.packs);
    if (typeof s.anchor === 'number' && isFinite(s.anchor)) o.anchor = s.anchor;
    if (typeof s.opened === 'number' && isFinite(s.opened)) o.opened = Math.max(0, Math.floor(s.opened));
    if (typeof s.updatedAt === 'number' && isFinite(s.updatedAt)) o.updatedAt = s.updatedAt;
    ['owned', 'fresh'].forEach(function (k) {
      if (s[k] && typeof s[k] === 'object') {
        Object.keys(s[k]).forEach(function (id) {
          const n = Math.floor(s[k][id]);
          if (MR.card(id) && n > 0) o[k][id] = Math.min(n, 99999);
        });
      }
    });
    return o;
  }

  C.load = function () {
    st = clean(MR.store.get(KEY, null)) || fresh();
    regen();
    MR.store.set(KEY, st);
  };

  // touch = vrai changement (ouverture de paquet, carte vue) : daté et envoyé au nuage
  C.save = function (touch) {
    if (touch) st.updatedAt = Date.now();
    MR.store.set(KEY, st);
    if (touch && MR.Sync) MR.Sync.changed();
  };

  // recharge des paquets selon l'heure
  function regen() {
    const now = Date.now(), MAX = maxPacks();
    if (st.anchor > now) st.anchor = now;
    if (st.packs >= MAX) { st.anchor = now; return 0; }
    const n = Math.floor((now - st.anchor) / PERIOD);
    if (n <= 0) return 0;
    const before = st.packs;
    st.packs = Math.min(MAX, st.packs + n);
    st.anchor = st.packs >= MAX ? now : st.anchor + n * PERIOD;
    // chaque paquet des 10 minutes peut cacher un paquet premium ou ultra (surprise à l'ouverture)
    for (let i = before; i < st.packs; i++) {
      const x = Math.random();
      if (x < HIDDEN_ULTRA) st.secret.push('ultra');
      else if (x < HIDDEN_ULTRA + HIDDEN_PREMIUM) st.secret.push('premium');
    }
    MR.store.set(KEY, st);
    return st.packs - before;
  }
  C.tick = function () { return regen(); };
  C.packs = function () { regen(); return st.packs; };
  C.msToNext = function () {
    regen();
    return st.packs >= maxPacks() ? 0 : Math.max(0, st.anchor + PERIOD - Date.now());
  };
  C.cycleProgress = function () {
    regen();
    return st.packs >= maxPacks() ? 1 : MR.clamp((Date.now() - st.anchor) / PERIOD, 0, 1);
  };

  function rollRarity(table) {
    let x = Math.random() * 100;
    for (let i = 0; i < table.length; i++) {
      const r = table[i];
      if (x < r.chance) return r.id;
      x -= r.chance;
    }
    return table[0].id;
  }
  function rollCard(type) {
    const rid = rollRarity(TABLES[type] || MR.RARITIES);
    return MR.pick(MR.CARDS.filter(function (c) { return c.rarity === rid; }));
  }
  function sortByRank(list) {
    return list.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      return (MR.rarity(a.x.card.rarity).rank - MR.rarity(b.x.card.rarity).rank) || (a.i - b.i);
    }).map(function (o) { return o.x; });
  }

  // Ouvre un paquet ('normal', 'premium' ou 'ultra') : 5 cartes, triées de la plus commune à la plus rare.
  // Le résultat porte .type (le vrai type du paquet) et .secret (paquet normal qui cachait un premium ou un ultra).
  C.open = function (type) {
    regen();
    if (type === true) type = 'premium';
    if (type !== 'premium' && type !== 'ultra') type = 'normal';
    let secret = false;
    if (type === 'premium' || type === 'ultra') {
      if (st[type] <= 0) return null;
      st[type]--;
    } else {
      if (st.packs <= 0) return null;
      // l'un des paquets de la réserve cachait-il une surprise ?
      if (st.secret.length && Math.random() < st.secret.length / st.packs) { type = st.secret.pop(); secret = true; }
      st.packs--;
      if (st.secret.length > st.packs) st.secret.length = st.packs;
      if (st.packs === maxPacks() - 1) st.anchor = Date.now();
    }
    const pulls = [];
    for (let i = 0; i < PER_PACK; i++) {
      const card = rollCard(type);
      const isNew = !st.owned[card.id];
      st.owned[card.id] = (st.owned[card.id] || 0) + 1;
      if (isNew) st.fresh[card.id] = 1;
      pulls.push({ card: card, isNew: isNew });
    }
    st.opened++;
    C.save(true);
    const out = sortByRank(pulls);
    out.type = type;
    out.secret = secret;
    if (MR.Prog) { MR.Prog.onPackOpened(type); if (secret) MR.Prog.onSecret(); }
    return out;
  };

  // Paquet de démonstration (une carte de chaque rareté), sans rien ajouter à la collection.
  C.demo = function () {
    return MR.RARITIES.map(function (r) {
      return { card: MR.pick(MR.CARDS.filter(function (c) { return c.rarity === r.id; })), isNew: false, demo: true };
    });
  };

  // récompense de course
  C.grant = function (packs, premium, ultra) {
    regen();
    st.packs = Math.min(HARD_MAX, st.packs + (packs || 0));
    st.premium = Math.min(HARD_MAX, st.premium + (premium || 0));
    st.ultra = Math.min(HARD_MAX, st.ultra + (ultra || 0));
    C.save(true);
    if (MR.Packs && MR.Packs.updateCounters) MR.Packs.updateCounters();
  };
  C.premium = function () { return st.premium; };
  C.ultra = function () { return st.ultra; };
  C.total = function () { regen(); return st.packs + st.premium + st.ultra; };
  // nombre de cartes possédées d'une rareté (toutes si rid est vide), pour les succès de collection
  C.ownedOf = function (rid) { return MR.CARDS.filter(function (c) { return (!rid || c.rarity === rid) && (st.owned[c.id] || 0) > 0; }).length; };

  C.count = function (id) { return st.owned[id] || 0; };
  C.owns = function (id) { return (st.owned[id] || 0) > 0; };
  C.isSkinUnlocked = function (skin) { return skin === 'solid' || (st && (st.owned[skin] || 0) > 0); };
  C.isFresh = function (id) { return !!st.fresh[id]; };
  C.freshCount = function () { return Object.keys(st.fresh).length; };
  C.markSeen = function (id) {
    if (!st.fresh[id]) return;
    delete st.fresh[id];
    C.save(false);
  };
  C.distinct = function () { return MR.CARDS.filter(function (c) { return (st.owned[c.id] || 0) > 0; }).length; };
  C.opened = function () { return st.opened; };
  // probabilité de tirer cette carte précise sur une carte
  C.chanceOf = function (card) {
    const r = MR.rarity(card.rarity);
    const n = MR.CARDS.filter(function (c) { return c.rarity === card.rarity; }).length;
    return r.chance / n;
  };

  /* ---------- synchronisation ---------- */
  C.updatedAt = function () { return st.updatedAt; };
  C.exportState = function () {
    return { packs: st.packs, premium: st.premium, ultra: st.ultra, secret: st.secret.slice(), anchor: st.anchor, owned: Object.assign({}, st.owned), fresh: Object.assign({}, st.fresh), opened: st.opened, updatedAt: st.updatedAt };
  };
  // fusion : aucune carte n'est jamais perdue ; le minuteur vient de la sauvegarde la plus récente
  C.importState = function (remote) {
    const r = clean(remote);
    if (!r) return;
    Object.keys(r.owned).forEach(function (id) { st.owned[id] = Math.max(st.owned[id] || 0, r.owned[id]); });
    Object.keys(r.fresh).forEach(function (id) { st.fresh[id] = 1; });
    if (r.updatedAt >= st.updatedAt) { st.packs = r.packs; st.premium = r.premium; st.ultra = r.ultra; st.secret = r.secret; st.anchor = r.anchor; st.updatedAt = r.updatedAt; }
    st.opened = Math.max(st.opened, r.opened);
    regen();
    MR.store.set(KEY, st);
  };

  MR.Cards = C;
})(window.MR);
