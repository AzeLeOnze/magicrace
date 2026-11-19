/* MagicRace — progression (0.2.0) : XP et niveaux, quêtes du jour, succès, statistiques, récompenses quotidiennes.
 * Tout est gardé dans le navigateur (et dans la sauvegarde du compte claude.ai via sync.js). */
(function (MR) {
  'use strict';

  const KEY = 'magicrace.progress.v1';
  const P = {};
  let st = null;
  let notify = function () {};
  P.onNotify = function (fn) { notify = fn; };

  /* ---------------- niveaux ---------------- */
  // passer du niveau n au niveau n+1 coûte 500 XP au départ, puis 9 % de plus à chaque niveau (0.2.2)
  P.need = function (lv) { return Math.round(500 * Math.pow(1.09, lv - 1)); };
  P.levelOf = function (xp) {
    let lv = 1, rest = Math.max(0, xp || 0);
    while (rest >= P.need(lv) && lv < 5000) { rest -= P.need(lv); lv++; }
    return { level: lv, into: rest, need: P.need(lv) };
  };
  P.xpForLevel = function (lv) { let t = 0; for (let i = 1; i < lv; i++) t += P.need(i); return t; };
  // appellation de chaque niveau du compte (0.2.6) ; au-delà du dernier, on garde le dernier titre
  P.TITLES = [
    'Mini disco I', 'Mini disco II', 'Bébé disco I', 'Bébé disco II', 'Discoamateur I', 'Discoamateur II',
    'Discomaniaque I', 'Discomaniaque II', 'Discomaniaque III',
    'Discodancer I', 'Discodancer II', 'Discodancer III', 'Discodancer IV', 'Discodancer V',
    'Accro au Dancefloor I', 'Accro au Dancefloor II', 'Accro au Dancefloor III', 'Accro au Dancefloor IV',
    'Discobreaker I', 'Discobreaker II', 'Discobreaker III',
    'Ultra Discoman I', 'Ultra Discoman II', 'Ultra Discoman III',
    'Roi du Disco I', 'Roi du Disco II', 'Roi du Disco III',
    'Légende du Groove I', 'Légende du Groove II', 'Légende du Groove III',
    'Maître des Facettes I', 'Maître des Facettes II', 'Maître des Facettes III',
    'Disco Immortel', 'Dieu du Disco'
  ];
  P.title = function (lv) { return P.TITLES[Math.max(1, Math.min(lv || 1, P.TITLES.length)) - 1]; };
  // récompenses en atteignant un niveau : toujours un paquet, plus des bonus tous les 5 niveaux (le cycle recommence à chaque centaine)
  P.rewardsFor = function (lv) {
    const r = { packs: 1, premium: 0, ultra: 0, storage: 0 };
    const k = ((lv - 1) % 100) + 1;
    if (k === 100) { r.premium = 3; r.ultra = 2; }
    else if (k === 50) { r.premium = 2; r.ultra = 1; }
    else if (k % 5 === 0) r.premium = 1;
    if (lv <= 100 && lv % 10 === 0) r.storage = 1;
    return r;
  };
  P.level = function () { return P.levelOf(st.xp).level; };
  P.xp = function () { return st.xp; };
  P.info = function () { return P.levelOf(st.xp); };
  // places de réserve en plus : +1 aux niveaux 10, 20… jusqu'à 100
  P.storageBonus = function () { return st ? Math.floor(Math.min(st.lvClaimed, 100) / 10) : 0; };

  function rewardText(r) {
    const out = [];
    if (r.packs) out.push(r.packs + ' paquet' + (r.packs > 1 ? 's' : ''));
    if (r.premium) out.push(r.premium + ' premium');
    if (r.ultra) out.push(r.ultra + ' ultra');
    if (r.storage) out.push('+1 place de réserve');
    return out.join(' · ');
  }
  P.rewardText = rewardText;

  P.addXP = function (n, why) {
    if (!(n > 0)) return;
    const before = P.levelOf(st.xp).level;
    st.xp += Math.round(n);
    const after = P.levelOf(st.xp).level;
    while (st.lvClaimed < after) {
      st.lvClaimed++;
      const r = P.rewardsFor(st.lvClaimed);
      MR.Cards.grant(r.packs, r.premium, r.ultra);
      notify({ type: 'level', level: st.lvClaimed, rewards: r });
    }
    save(true);
    if (after > before && MR.Packs) MR.Packs.updateCounters();
    if (MR.Account) MR.Account.changed();
    notify({ type: 'xp', amount: Math.round(n), why: why || '' });
  };
  function grantPacks(r) {
    if (r && (r.packs || r.premium || r.ultra)) MR.Cards.grant(r.packs || 0, r.premium || 0, r.ultra || 0);
  }

  /* ---------------- quêtes du jour ---------------- */
  const QUEST_XP = 300;
  P.QUEST_XP = QUEST_XP;
  P.QUESTS = [
    { id: 'top5', text: 'Finir dans le top 5', sub: 'Ta bille ★, dans une course de 30 billes ou plus', goal: 1 },
    { id: 'races5', text: 'Faire 5 courses', goal: 5 },
    { id: 'levels3', text: 'Faire une course dans 3 niveaux différents', goal: 3 },
    { id: 'race60', text: 'Faire une course avec 60 billes', goal: 1 },
    { id: 'race30', text: 'Faire une course avec 30 billes ou plus', goal: 1 },
    { id: 'packs3', text: 'Ouvrir 3 paquets', goal: 3 }
  ];
  function quest(id) { for (let i = 0; i < P.QUESTS.length; i++) if (P.QUESTS[i].id === id) return P.QUESTS[i]; return null; }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function shiftDay(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12); }
  function msToMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).getTime() - now.getTime();
  }
  P.msToMidnight = msToMidnight;

  // 3 quêtes tirées au hasard chaque jour (minuit, heure du joueur)
  function ensureDay() {
    const today = dayKey(new Date());
    const Q = st.quests;
    if (Q.day === today && Q.ids.length === 3) return false;
    Q.day = today;
    Q.ids = MR.shuffle(P.QUESTS.map(function (q) { return q.id; })).slice(0, 3);
    Q.prog = {}; Q.done = {}; Q.levels = [];
    save(false);
    return true;
  }
  P.quests = function () {
    ensureDay();
    return st.quests.ids.map(function (id) {
      const q = quest(id);
      return { id: id, text: q.text, sub: q.sub || '', goal: q.goal, prog: Math.min(q.goal, st.quests.prog[id] || 0), done: !!st.quests.done[id] };
    });
  };
  function questAdd(id, n, setTo) {
    ensureDay();
    const Q = st.quests;
    if (Q.ids.indexOf(id) < 0 || Q.done[id]) return;
    Q.prog[id] = setTo != null ? Math.max(Q.prog[id] || 0, setTo) : (Q.prog[id] || 0) + n;
  }
  function checkQuests() {
    ensureDay();
    const Q = st.quests;
    Q.ids.forEach(function (id) {
      const q = quest(id);
      if (!Q.done[id] && (Q.prog[id] || 0) >= q.goal) {
        Q.done[id] = true;
        st.stats.quests++;
        MR.Cards.grant(1, 0, 0);
        notify({ type: 'quest', text: q.text, xp: QUEST_XP });
        P.addXP(QUEST_XP, 'Quête du jour');
      }
    });
  }

  /* ---------------- succès ---------------- */
  const ACH = [];
  function ach(id, group, name, xp, rw, goal, val) {
    ACH.push({ id: id, group: group, name: name, xp: xp, rw: rw || {}, goal: goal, val: val });
  }
  const S = function () { return st.stats; };
  ach('rename', 'Divers', 'Renommer une bille', 100, null, 1, function () { return S().renamed; });
  [[1, 100], [5, 200], [15, 350], [50, 500], [100, 800], [250, 1100], [500, 1750], [1000, 2500], [2000, 4000], [5000, 8000]].forEach(function (a) {
    ach('races' + a[0], 'Courses', a[0] === 1 ? 'Faire une course' : 'Faire ' + a[0] + ' courses', a[1], null, a[0], function () { return S().races; });
  });
  [[1, 200], [5, 400], [15, 600], [50, 1000], [100, 1600], [250, 2200], [500, 3250], [1000, 5000], [2000, 8000], [5000, 16000]].forEach(function (a) {
    ach('runs' + a[0], 'Runs', a[0] === 1 ? 'Faire une run' : 'Faire ' + a[0] + ' runs', a[1], null, a[0], function () { return S().runs; });
  });
  const TOPS = [['top1', 'Finir 1er', [[1, 200], [10, 1000], [50, 5000], [100, 10000]]],
    ['top3', 'Finir dans le top 3', [[1, 150], [10, 500], [50, 2000], [100, 8000]]],
    ['top5', 'Finir dans le top 5', [[1, 150], [10, 500], [50, 2000], [100, 8000]]]];
  TOPS.forEach(function (t) {
    t[2].forEach(function (a) {
      ach(t[0] + '-' + a[0], 'Victoires', t[1] + (a[0] > 1 ? ' ×' + a[0] : ''), a[1], null, a[0], function () { return S()[t[0]]; });
    });
  });
  // une course dans chaque niveau (le menu des niveaux se remplit tout seul)
  (MR.LEVELS || []).forEach(function (L) {
    ach('lvl-' + L.id, 'Niveaux', 'Faire une course dans le niveau ' + L.num + ' (' + L.name + ')', 150, null, 1, function () {
      const b = S().byLevel[L.id]; return b ? b.races : 0;
    });
  });
  const RAR = [['common', 'communes', 500, { packs: 1 }], ['uncommon', 'peu communes', 1000, { packs: 2 }], ['rare', 'rares', 1500, { premium: 1 }],
    ['epic', 'épiques', 3000, { premium: 2 }], ['legendary', 'légendaires', 5000, { ultra: 1 }]];
  RAR.forEach(function (r) {
    ach('all-' + r[0], 'Collection', 'Avoir toutes les billes et effets ' + r[1], r[2], r[3],
      function () { return MR.CARDS.filter(function (c) { return c.rarity === r[0]; }).length; },
      function () { return MR.Cards.ownedOf(r[0]); });
  });
  ach('all', 'Collection', 'Avoir toutes les billes et tous les effets', 20000, { packs: 3, premium: 2, ultra: 1 },
    function () { return MR.CARDS.length; }, function () { return MR.Cards.ownedOf(null); });
  ach('own-rypoint', 'Collection', 'Avoir la bille « Rypoint »', 621, { ultra: 1 }, 1, function () { return MR.Cards.count('rypoint') > 0 ? 1 : 0; });
  ach('own-aze', 'Collection', 'Avoir la bille « Aze »', 710, { ultra: 1 }, 1, function () { return MR.Cards.count('aze') > 0 ? 1 : 0; });
  [[1, 150], [5, 300], [15, 500, { packs: 1 }], [50, 750, { premium: 1 }], [100, 1000, { premium: 1 }], [250, 1750, { premium: 2 }],
    [500, 3000, { premium: 2 }], [1000, 8000, { premium: 2 }], [2000, 15000, { premium: 3 }], [5000, 30000, { premium: 3, ultra: 1 }]].forEach(function (a) {
    ach('packs' + a[0], 'Paquets', a[0] === 1 ? 'Ouvrir un paquet' : 'Ouvrir ' + a[0] + ' paquets', a[1], a[2], a[0], function () { return S().packs; });
  });
  [[1, 250], [5, 500], [15, 1000, { packs: 1 }], [50, 5000, { premium: 1 }], [100, 8000, { premium: 1 }], [250, 12500, { premium: 2 }],
    [500, 40000, { premium: 2 }], [1000, 100000, { premium: 2 }], [2000, 200000, { premium: 3 }], [5000, 500000, { premium: 3, ultra: 1 }]].forEach(function (a) {
    ach('prem' + a[0], 'Paquets premium', a[0] === 1 ? 'Ouvrir un paquet premium' : 'Ouvrir ' + a[0] + ' paquets premium', a[1], a[2], a[0], function () { return S().premium; });
  });
  P.ACH = ACH;
  function goalOf(a) { return typeof a.goal === 'function' ? a.goal() : a.goal; }
  P.achievements = function () {
    return ACH.map(function (a) {
      const g = goalOf(a);
      return { id: a.id, group: a.group, name: a.name, xp: a.xp, rw: a.rw, goal: g, val: Math.min(g, a.val() || 0), done: !!st.ach[a.id] };
    });
  };
  P.achCount = function () { return Object.keys(st.ach).length; };
  function checkAch() {
    ACH.forEach(function (a) {
      if (st.ach[a.id]) return;
      if ((a.val() || 0) >= goalOf(a)) {
        st.ach[a.id] = Date.now();
        grantPacks(a.rw);
        notify({ type: 'ach', name: a.name, xp: a.xp, rewards: a.rw });
        P.addXP(a.xp, 'Succès');
      }
    });
  }
  // contrôle groupé (après une course, après l'ouverture d'un paquet…)
  let checking = false;
  P.check = function () {
    if (!st || checking) return;
    checking = true;
    try { checkQuests(); checkAch(); } finally { checking = false; }
    save(true);
  };

  /* ---------------- statistiques ---------------- */
  function lvlStat(id) {
    const b = st.stats.byLevel;
    if (!b[id]) b[id] = { races: 0, t1: 0, t3: 0, t5: 0, best: 0, posSum: 0, posN: 0, big: 0, b1: 0, b3: 0, b5: 0 };
    return b[id];
  }
  function bump(map, key, n) {
    if (!key) return;
    map[key] = (map[key] || 0) + (n || 1);
    const keys = Object.keys(map);
    if (keys.length > 80) {
      keys.sort(function (a, b) { return map[b] - map[a]; }).slice(60).forEach(function (k) { delete map[k]; });
    }
  }
  /* fin d'une course (main.js) — info : levelId, count, rank (0 = éliminée ou abandon), time, myName, winnerName, raceTime, out */
  P.onRaceEnd = function (info) {
    const s = st.stats, big = info.count >= 30;
    s.races++;
    s.time += info.raceTime || 0;
    s.marbles += info.count;
    if (info.out) s.elim++;
    s.explosions += info.explosions || 0;
    bump(s.fav, info.myName);
    bump(s.winners, info.winnerName);
    const b = lvlStat(info.levelId);
    b.races++;
    const r = info.rank;
    if (r >= 1) {
      if (r === 1) b.t1++;
      if (r <= 3) b.t3++;
      if (r <= 5) b.t5++;
      if (info.count > 1) { b.posSum += (r - 1) / (info.count - 1); b.posN++; }
      if (info.time > 0 && info.mode !== 'survival' && info.mode !== 'arena' && (!b.best || info.time < b.best)) b.best = info.time;
    }
    if (big) {
      s.racesBig++;
      b.big++;
      if (r >= 1 && r <= 5) {
        s.top5++; b.b5++;
        if (r <= 3) { s.top3++; b.b3++; }
        if (r === 1) { s.top1++; b.b1++; }
      }
    }
    // quêtes du jour
    questAdd('races5', 1);
    ensureDay();
    if (st.quests.levels.indexOf(info.levelId) < 0) st.quests.levels.push(info.levelId);
    questAdd('levels3', 0, st.quests.levels.length);
    if (info.count >= 60) questAdd('race60', 1);
    if (big) questAdd('race30', 1);
    if (big && r >= 1 && r <= 5) questAdd('top5', 1);
    P.check();
    // XP de la course : 50 avec moins de 30 billes ; sinon 80, top 10 = 120, 3e = 200, 2e = 300, 1re = 500
    const xp = P.raceXP(info.count, r);
    P.addXP(xp, 'Course');
    return xp;
  };
  P.raceXP = function (count, rank) {
    if (count < 30) return 50;
    if (rank === 1) return 500;
    if (rank === 2) return 300;
    if (rank === 3) return 200;
    if (rank >= 1 && rank <= 10) return 120;
    return 80;
  };
  P.PACK_XP = { normal: 50, premium: 100, ultra: 200 };
  // ouverture d'un paquet (cards.js) : les gains sont contrôlés à la fin de la révélation (pour ne rien dévoiler)
  P.onPackOpened = function (type) {
    const s = st.stats;
    s.packs++;
    if (type === 'premium') s.premium++;
    if (type === 'ultra') s.ultra++;
    questAdd('packs3', 1);
    save(true);
    P.addXP(P.PACK_XP[type] || 50, 'Paquet');
  };
  // run terminée (main.js) : tous les niveaux enchaînés
  P.onRunEnd = function (pos) {
    st.stats.runs++;
    P.check();
    const xp = P.runXP(pos);
    P.addXP(xp, 'Run');
    return xp;
  };
  // XP selon la place de ta bille ★ au classement final de la run
  P.runXP = function (pos) {
    if (pos === 1) return 1000;
    if (pos === 2) return 600;
    if (pos === 3) return 450;
    if (pos === 4 || pos === 5) return 325;
    if (pos >= 6 && pos <= 10) return 250;
    return 150;
  };
  P.onSecret = function () { st.stats.hidden++; save(true); };
  P.onRename = function () {
    st.stats.renamed++;
    P.check();
  };
  P.stats = function () { return st.stats; };

  /* ---------------- récompenses quotidiennes ---------------- */
  P.DAILY = [
    { packs: 1 }, { packs: 2 }, { packs: 1 }, { packs: 2 }, { premium: 1 }, { premium: 1, packs: 1 }, { premium: 2 },
    { packs: 1 }, { packs: 2 }, { packs: 1 }, { packs: 2 }, { premium: 1 }, { premium: 1, ultra: 1, packs: 1 }, { premium: 2, ultra: 1, packs: 1 }
  ];
  // Une récompense par jour (à minuit, heure du joueur). Une journée manquée se rattrape jusqu'à midi le lendemain
  // (12 h de bonus) sans perdre la série ; au-delà, on repart du jour 1.
  P.daily = function () {
    const now = new Date(), D = st.daily;
    const today = dayKey(now), y1 = dayKey(shiftDay(now, -1)), y2 = dayKey(shiftDay(now, -2));
    const claimable = D.last !== today;
    const kept = !D.last || D.last === today || D.last === y1 || (D.last === y2 && now.getHours() < 12);
    const idx = claimable && !kept ? 0 : D.idx;
    return {
      claimable: claimable, idx: idx, lost: claimable && !kept && D.last != null,
      grace: claimable && D.last === y2 && now.getHours() < 12,
      next: msToMidnight(), streak: D.streak, rewards: P.DAILY
    };
  };
  P.claimDaily = function () {
    const d = P.daily();
    if (!d.claimable) return null;
    const rw = P.DAILY[d.idx];
    st.daily.streak = d.lost ? 1 : (st.daily.streak || 0) + 1;
    st.daily.best = Math.max(st.daily.best || 0, st.daily.streak);
    st.daily.idx = (d.idx + 1) % P.DAILY.length;
    st.daily.last = dayKey(new Date());
    st.stats.daily++;
    MR.Cards.grant(rw.packs || 0, rw.premium || 0, rw.ultra || 0);
    save(true);
    return { day: d.idx + 1, rw: rw };
  };

  /* ---------------- sauvegarde ---------------- */
  function freshStats() {
    return { races: 0, runs: 0, racesBig: 0, top1: 0, top3: 0, top5: 0, byLevel: {}, packs: 0, premium: 0, ultra: 0, hidden: 0, renamed: 0,
      elim: 0, explosions: 0, time: 0, marbles: 0, fav: {}, winners: {}, quests: 0, daily: 0 };
  }
  function fresh() {
    return { xp: 0, lvClaimed: 1, stats: freshStats(), ach: {}, quests: { day: '', ids: [], prog: {}, done: {}, levels: [] },
      daily: { idx: 0, last: null, streak: 0, best: 0 }, updatedAt: 0 };
  }
  function num(v, d) { return typeof v === 'number' && isFinite(v) && v >= 0 ? v : d; }
  function clean(s) {
    if (!s || typeof s !== 'object') return null;
    const o = fresh();
    o.xp = Math.floor(num(s.xp, 0));
    o.lvClaimed = Math.max(1, Math.floor(num(s.lvClaimed, 1)));
    o.updatedAt = num(s.updatedAt, 0);
    if (s.stats && typeof s.stats === 'object') {
      Object.keys(o.stats).forEach(function (k) {
        const v = s.stats[k];
        if (typeof o.stats[k] === 'number') o.stats[k] = num(v, 0);
        else if (v && typeof v === 'object') o.stats[k] = JSON.parse(JSON.stringify(v));
      });
    }
    if (s.ach && typeof s.ach === 'object') Object.keys(s.ach).forEach(function (k) { if (s.ach[k]) o.ach[k] = num(s.ach[k], 1) || 1; });
    if (s.quests && typeof s.quests === 'object' && Array.isArray(s.quests.ids)) {
      o.quests = { day: String(s.quests.day || ''), ids: s.quests.ids.filter(quest).slice(0, 3),
        prog: Object.assign({}, s.quests.prog || {}), done: Object.assign({}, s.quests.done || {}), levels: Array.isArray(s.quests.levels) ? s.quests.levels.slice(0, 10) : [] };
    }
    if (s.daily && typeof s.daily === 'object') {
      o.daily = { idx: MR.clamp(Math.floor(num(s.daily.idx, 0)), 0, P.DAILY.length - 1), last: typeof s.daily.last === 'string' ? s.daily.last : null,
        streak: Math.floor(num(s.daily.streak, 0)), best: Math.floor(num(s.daily.best, 0)) };
    }
    return o;
  }
  function save(touch) {
    if (touch) st.updatedAt = Date.now();
    MR.store.set(KEY, st);
    if (touch && MR.Sync) MR.Sync.changed();
  }
  P.load = function () {
    st = clean(MR.store.get(KEY, null)) || fresh();
    // le niveau atteint ne peut pas être sous le niveau déjà récompensé (sauvegarde ancienne)
    st.lvClaimed = Math.max(1, Math.min(st.lvClaimed, P.levelOf(st.xp).level));
    ensureDay();
    MR.store.set(KEY, st);
  };
  P.exportState = function () { return JSON.parse(JSON.stringify(st)); };
  // fusion : la sauvegarde la plus récente l'emporte, les succès déjà obtenus restent acquis
  P.importState = function (remote) {
    const r = clean(remote);
    if (!r) return false;
    const ach = Object.assign({}, st.ach, r.ach);
    if (r.updatedAt > st.updatedAt && r.xp >= st.xp) { st = r; }
    st.ach = ach;
    st.lvClaimed = Math.max(1, Math.min(st.lvClaimed, P.levelOf(st.xp).level));
    MR.store.set(KEY, st);
    return true;
  };

  MR.Prog = P;
})(window.MR);
