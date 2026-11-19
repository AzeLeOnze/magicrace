/* MagicRace — boucle de jeu, état de la course, caméra */
(function (MR) {
  'use strict';

  const KEY_ROSTER = 'magicrace.roster.v1';
  const KEY_SETTINGS = 'magicrace.settings.v1';
  const KEY_SYNC = 'magicrace.sync.v1';
  const KEY_SEEN = 'magicrace.seenVersion';
  const DEFAULTS = { levelId: 'descente-disco', speed: 1, camera: 'leader', names: 'all', music: true, musicVol: 0.55, sfx: true, sfxVol: 0.75,
    // menu Paramètres (0.1.0)
    quality: 'auto', bloom: 1, glow: 1, particles: 1, beams: true, vignette: true, fps: false,
    zoom: 1, camSmooth: 'normal', followMe: false, labelSize: 12, board: 'auto', countdown: true,
    sfxMarble: true, cardFast: false, shake: true };
  const FIXED = 1 / 120, SUB = 4;
  const RACE_LIMIT = 240; // secondes (par défaut) : au-delà, les billes restantes abandonnent
  const STUCK_T = 5;      // une bille qui ne bouge plus pendant 5 s (hors sas) est éliminée

  const G = MR.Game = {
    state: 'ready', paused: false, time: 0, raceTime: 0, cd: 0, cdShown: 0,
    roster: [], marbles: [], ranking: [], world: null, level: null, levelDef: null,
    settings: Object.assign({}, DEFAULTS), fx: null, followId: null,
    finishCount: 0, resultsIn: 0, quietUntil: 0
  };
  G.DEFAULTS = DEFAULTS;

  /* ---------------- sauvegarde ---------------- */
  function loadSettings() {
    const s = MR.store.get(KEY_SETTINGS, null);
    if (s && typeof s === 'object') {
      Object.keys(DEFAULTS).forEach(function (k) { if (typeof s[k] === typeof DEFAULTS[k]) G.settings[k] = s[k]; });
    }
    G.settings.speed = MR.clamp(G.settings.speed, 0.25, 2);
    G.settings.musicVol = MR.clamp(G.settings.musicVol, 0, 1);
    G.settings.sfxVol = MR.clamp(G.settings.sfxVol, 0, 1);
    if (['leader', 'pack', 'overview'].indexOf(G.settings.camera) < 0) G.settings.camera = 'leader';
    if (['all', 'top3', 'none'].indexOf(G.settings.names) < 0) G.settings.names = 'all';
    const S = G.settings;
    if (['auto', 'high', 'medium', 'low'].indexOf(S.quality) < 0) S.quality = 'auto';
    if (['soft', 'normal', 'fast'].indexOf(S.camSmooth) < 0) S.camSmooth = 'normal';
    if (['auto', '5', '10', 'all', 'hidden'].indexOf(S.board) < 0) S.board = 'auto';
    S.bloom = MR.clamp(S.bloom, 0, 1.5); S.glow = MR.clamp(S.glow, 0, 2); S.particles = MR.clamp(S.particles, 0, 1);
    S.zoom = MR.clamp(S.zoom, 0.6, 1.6); S.labelSize = MR.clamp(Math.round(S.labelSize), 9, 18);
    MR.fxDensity = S.particles;
  }
  function saveSettings() { MR.store.set(KEY_SETTINGS, G.settings); }

  function loadRoster() {
    const raw = MR.store.get(KEY_ROSTER, null);
    let list = Array.isArray(raw) ? raw.map(MR.normalizeMarble).filter(Boolean) : [];
    const seen = new Set();
    list.forEach(function (m) { if (seen.has(m.id)) m.id = MR.uid(); seen.add(m.id); });
    list = list.slice(0, MR.MAX_MARBLES);
    if (!list.length) list = [MR.firstMarble()];
    G.roster = list;
    ensureMe();
  }
  // il y a toujours exactement une bille du joueur (★)
  function ensureMe() {
    let found = false;
    G.roster.forEach(function (m) { if (m.me && !found) found = true; else m.me = false; });
    if (!found && G.roster[0]) G.roster[0].me = true;
  }
  G.me = function () { return G.roster.find(function (m) { return m.me; }) || null; };
  G.REWARD_MIN = 30; // il faut au moins 29 autres billes en course
  let saveTimer = null;
  let rosterAt = MR.store.get(KEY_SYNC, { rosterAt: 0 }).rosterAt || 0;
  function saveRoster() {
    rosterAt = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      MR.store.set(KEY_ROSTER, G.roster);
      MR.store.set(KEY_SYNC, { rosterAt: rosterAt });
    }, 250);
    if (MR.Sync) MR.Sync.changed();
  }

  /* ---------------- sauvegarde dans le compte (voir sync.js) ---------------- */
  G.exportSave = function () {
    return { v: 3, cards: MR.Cards.exportState(), roster: G.roster.map(function (m) { return Object.assign({}, m); }), rosterAt: rosterAt,
      prog: MR.Prog.exportState(), account: MR.Account.exportState() };
  };
  G.importSave = function (d) {
    if (!d || typeof d !== 'object') return;
    const before = MR.Cards.distinct(), xpBefore = MR.Prog.xp();
    if (d.prog) MR.Prog.importState(d.prog);
    if (d.account) MR.Account.importState(d.account);
    if (d.cards) MR.Cards.importState(d.cards);
    const remoteAt = typeof d.rosterAt === 'number' ? d.rosterAt : 0;
    let rosterChangedNow = false;
    if (Array.isArray(d.roster) && d.roster.length && remoteAt > rosterAt) {
      const list = d.roster.map(MR.normalizeMarble).filter(Boolean).slice(0, MR.MAX_MARBLES);
      if (list.length) {
        G.roster = list;
        ensureMe();
        rosterAt = remoteAt;
        MR.store.set(KEY_ROSTER, G.roster);
        MR.store.set(KEY_SYNC, { rosterAt: rosterAt });
        rosterChangedNow = true;
      }
    }
    MR.UI.refreshUnlocks();
    MR.Packs.updateCounters();
    if (MR.Profile) MR.Profile.refresh();
    if (rosterChangedNow) G.reset(false, false);
    if (rosterChangedNow || MR.Cards.distinct() > before || MR.Prog.xp() > xpBefore) MR.UI.toast('Progression récupérée depuis ton compte');
  };

  /* ---------------- billes ---------------- */
  function makeBody(cfg, slot, r) {
    const m = {
      id: cfg.id, cfg: cfg, x: slot.x + MR.rand(-2, 2), y: slot.y, vx: 0, vy: 0, r: r,
      angle: Math.random() * MR.TAU, spin: 0, spinT: 0, touch: false,
      finished: false, dnf: false, rank: 0, time: 0, still: 0, lastSound: -1, pos: 0,
      hist: [], emit: 0, spec: null, boost: 0,
      out: false, elimAt: 0, wp: 0, ax: 0, ay: 0, at: 0
    };
    refreshLook(m);
    return m;
  }
  function refreshLook(m) {
    m.rgb = MR.hexToRgb255(m.cfg.color);
    m.orgb = MR.hexToRgb255(m.cfg.outlineColor);
    m.seedN = Math.floor((m.cfg.seed || 0) * 1000);
    m.hist.length = 0;
  }

  /* ---------------- niveau & course ---------------- */
  G.loadLevel = function (id) {
    G.manualCam = null;
    if (G.run && !runLoading) G.stopRun();
    G.levelDef = MR.levelById(id);
    G.settings.levelId = G.levelDef.id;
    saveSettings();
    G.level = G.levelDef.build();
    G.reset(false, true);
  };

  G.reset = function (announce, snap) {
    // le niveau 4 dépend du nombre de billes (autant de cercles que de billes, moins une)
    if (G.levelDef.perCount) G.level = G.levelDef.build(G.roster.length);
    const L = G.level;
    G.world = MR.Physics.createWorld(L);
    const slots = L.spawnSlots(G.roster.length);
    G.marbles = G.roster.map(function (cfg, i) { return makeBody(cfg, slots[i] || slots[0], L.marbleR); });
    // la physique a sa propre liste : une bille éliminée en sort, mais reste au classement
    G.world.marbles = G.marbles.slice();
    G.beatN = -1; G.lastEscape = 0; G.counted = false; G.raceXP = 0;
    G.state = 'ready';
    G.paused = false;
    G.moved = false;
    G.drag = null;
    G.reward = null;
    G.raceTime = 0; G.finishCount = 0; G.resultsIn = 0; G.cd = 0;
    G.fx.clear();
    G.quietUntil = G.time + 0.8;
    if (G.followId && !G.marbles.some(function (m) { return m.id === G.followId; })) G.followId = null;
    computeRanking();
    if (snap) updateCamera(0, true);
    MR.UI.hideResults();
    MR.UI.hideBanner();
    MR.UI.countdown('');
    MR.UI.onState();
    if (announce) MR.UI.toast('Billes replacées au départ');
  };

  G.start = function () {
    MR.Audio.unlock();
    if (G.state === 'countdown') return;
    // en run, « relancer » après l'arrivée passe au niveau suivant (ou recommence une run terminée)
    if (G.run && G.state === 'finished') {
      if (G.run.done) G.startRun(); else G.runNext();
      return;
    }
    if (G.drag) { G.drag.m.held = false; G.drag = null; }
    // une bille déplacée à la main repart de l'enclos : départ équitable
    if (G.state !== 'ready' || G.moved) G.reset(false, false);
    G.state = 'countdown';
    G.cd = G.settings.countdown ? 3 : 0.01; G.cdShown = 4;
    G.paused = false;
    MR.UI.onState();
  };

  function go() {
    if (!G.navHeld) G.manualCam = null;
    G.state = 'racing';
    G.raceTime = 0;
    G.world.arms.forEach(function (a) { if (a.kind === 'door') a.omega = a.openSpeed; });
    G.marbles.forEach(function (m) { m.ax = m.x; m.ay = m.y; m.at = 0; });
    // niveau 4 : les cercles se débloquent et toutes les billes partent dans une direction au hasard
    if (G.level.mode === 'survival') {
      const W = G.world, v = G.level.speed || 520;
      W.locked = false;
      W.constSpeed = v;
      G.marbles.forEach(function (m) { const a = Math.random() * MR.TAU; m.vx = Math.cos(a) * v; m.vy = Math.sin(a) * v; });
    }
    MR.UI.countdown('GO');
    MR.Audio.countBeep(true);
    MR.UI.onState();
  }

  G.togglePause = function () {
    if (G.state !== 'racing' && G.state !== 'countdown') { G.paused = false; return; }
    G.paused = !G.paused;
    MR.UI.onState();
  };

  // récompense si c'est la bille du joueur, sur le podium, avec au moins 30 billes en course
  function award(m) {
    if (!m.cfg.me || m.rank < 1 || m.rank > 3 || G.marbles.length < G.REWARD_MIN || G.simulating) return;
    const R = [null, { premium: 1, text: 'un paquet premium' }, { packs: 2, text: '2 paquets de cartes' }, { packs: 1, text: 'un paquet de cartes' }][m.rank];
    MR.Cards.grant(R.packs || 0, R.premium || 0);
    G.reward = { rank: m.rank, text: R.text };
    MR.Packs.updateCounters();
    setTimeout(function () { MR.UI.toast('Ta bille finit ' + (m.rank === 1 ? '1re' : m.rank + 'e') + ' : tu gagnes ' + R.text + ' !'); MR.Audio.newBadge(); }, m.rank === 1 ? 1500 : 200);
  }

  function finish(m, rank) {
    m.finished = true;
    m.rank = rank || ++G.finishCount;
    m.time = G.raceTime;
    MR.Audio.finishChime(m.rank);
    MR.FX.burst(G.fx, m.x, m.y, m.rgb, m.rank === 1 ? 40 : 18);
    award(m);
    if (m.rank === 1) {
      MR.UI.banner(m.cfg.name, !!G.level.elim);
      MR.Audio.fanfare();
      const b = G.level.finish.box;
      MR.FX.confetti(G.fx, b.x0 + 60, b.x1 - 60, G.level.elim ? m.y : b.y1 - 40, 140);
    }
    MR.UI.boardDirty = true;
  }

  // élimination : la bille explose et sort de la piste (elle reste au classement)
  function eliminate(m, rank) {
    if (m.out) return;
    m.out = true;
    m.finished = true;
    m.elimAt = G.raceTime;
    m.time = G.raceTime;
    m.held = false;
    m.hist.length = 0;
    if (rank) { m.rank = rank; m.dnf = false; } else { m.rank = 0; m.dnf = true; }
    const i = G.world.marbles.indexOf(m);
    if (i >= 0) G.world.marbles.splice(i, 1);
    G.explosions = (G.explosions || 0) + 1;
    if (G.followId === m.id) G.followId = null;
    if (!G.simulating) {
      MR.FX.explode(G.fx, m.x, m.y, m.rgb, m.r);
      const cam = MR.Render.cam;
      MR.Audio.explode(MR.clamp((m.x - cam.x) * cam.s / (MR.Render.vw / 2), -1, 1) * 0.7, 0.8);
      if (m.cfg.me) MR.UI.toast(rank ? '💥 Ta bille est éliminée : ' + ordinalF(rank) : '💥 Ta bille était coincée : elle explose !');
    }
    award(m);
    MR.UI.boardDirty = true;
  }
  function ordinalF(n) { return n === 1 ? '1re' : n + 'e'; }
  G.eliminate = eliminate;

  function endRace() {
    G.state = 'finished';
    G.resultsIn = 1.6;
    G.followId = null;
    recordRace();
    recordRun();
    MR.UI.onState();
  }

  /* ---------------- mode run : tous les niveaux à la suite, classement cumulé ---------------- */
  // Chaque course rapporte des points à chaque bille : (nombre de billes − place + 1). Le total décide du classement de la run.
  G.run = null;
  let runLoading = false;
  G.startRun = function () {
    MR.Audio.unlock();
    G.run = { levels: MR.LEVELS.map(function (l) { return l.id; }), idx: 0, races: [], totals: {}, done: false };
    runLoad(0);
    MR.UI.toast('Mode run : ' + G.run.levels.length + ' niveaux à la suite, les points s’additionnent');
  };
  function runLoad(i) {
    G.run.idx = i;
    runLoading = true;
    G.loadLevel(G.run.levels[i]);
    runLoading = false;
    MR.UI.syncControls();
    G.start();
  }
  G.runNext = function () {
    // seulement une fois la course en cours terminée et comptée
    if (!G.run || G.run.done || G.run.races.length <= G.run.idx) return;
    MR.UI.hideResults();
    runLoad(G.run.idx + 1);
  };
  G.stopRun = function (silent) {
    if (!G.run) return;
    G.run = null;
    MR.UI.onState();
    if (!silent) MR.UI.toast('Run arrêtée');
  };
  G.runLoading = function () { return runLoading; };
  function recordRun() {
    const R = G.run;
    if (!R || G.simulating || R.races.length > R.idx) return;
    computeRanking();
    const n = G.ranking.length;
    const res = G.ranking.map(function (m, i) {
      return { id: m.id, name: m.cfg.name, color: m.cfg.color, me: !!m.cfg.me, pos: i + 1, pts: n - i };
    });
    R.races.push({ levelId: G.levelDef.id, num: G.levelDef.num, name: G.levelDef.name, res: res });
    res.forEach(function (r) {
      const t = R.totals[r.id] || (R.totals[r.id] = { id: r.id, pts: 0, sum: 0, best: 999, per: [] });
      t.name = r.name; t.color = r.color; t.me = r.me;
      t.pts += r.pts; t.sum += r.pos; t.best = Math.min(t.best, r.pos);
      t.per[R.races.length - 1] = r.pts;
    });
    if (R.idx >= R.levels.length - 1) {
      R.done = true;
      const st = G.runStandings();
      R.myPos = st.findIndex(function (t) { return t.me; }) + 1;
      R.xp = MR.Prog.onRunEnd(R.myPos);
    }
  }
  G.runStandings = function () {
    if (!G.run) return [];
    return Object.keys(G.run.totals).map(function (k) { return G.run.totals[k]; })
      .sort(function (a, b) { return b.pts - a.pts || a.sum - b.sum || a.best - b.best; });
  };
  // statistiques, quêtes et succès (pas pendant les simulations de test)
  function recordRace() {
    if (G.simulating || G.counted) return;
    G.counted = true;
    computeRanking();
    const me = G.marbles.find(function (m) { return m.cfg.me; });
    const win = G.ranking[0] && G.ranking[0].finished && !G.ranking[0].dnf ? G.ranking[0] : null;
    G.raceXP = MR.Prog.onRaceEnd({
      levelId: G.levelDef.id, mode: G.level.mode || 'race', count: G.marbles.length,
      rank: me && !me.dnf ? me.rank : 0, time: me && !me.dnf ? me.time : 0, out: !!(me && me.out && me.dnf),
      myName: me ? me.cfg.name : '', winnerName: win ? win.cfg.name : '', raceTime: G.raceTime, explosions: G.explosions || 0
    });
  }

  function inBox(m, z) { return m.x > z.x0 && m.x < z.x1 && m.y > z.y0 && m.y < z.y1; }

  // portes de regroupement : fermées tant que le gros du peloton n'est pas arrivé (ou qu'on attend depuis trop longtemps)
  // temps musical commun : dalles, enceintes et lasers suivent la musique (ou une horloge à 116 BPM en simulation)
  function setBeat() {
    const W = G.world;
    const bt = G.simulating || !MR.Audio.ready() ? (G.state === 'racing' ? G.raceTime : G.time) * 116 / 60 : MR.Audio.beat();
    const bn = Math.floor(bt);
    W.beatN = bn;
    W.beatOn = bt - bn < 0.16;
    // lasers en rythme : fermés un temps sur « every »
    for (let k = 0; k < W.sliders.length; k++) {
      const h = W.sliders[k].hold;
      if (h && h.beat) h.open = ((bn + (h.beatOff || 0)) % (h.every || 2)) !== 0;
    }
  }
  G.setBeat = setBeat;

  function updateHolds() {
    const sl = G.world.sliders;
    for (let k = 0; k < sl.length; k++) {
      const s = sl[k], h = s.hold;
      if (!h || h.open || h.beat) continue;
      let inside = 0, behind = 0;
      for (let i = 0; i < G.marbles.length; i++) {
        const m = G.marbles[i];
        if (m.finished) continue;
        if ((m.pv || 0) <= h.pv) behind++;
        if (inBox(m, h.zone)) inside++;
      }
      h.inside = inside;
      h.need = Math.max(1, Math.ceil(behind * h.ratio));
      if (inside > 0 && h.first < 0) h.first = G.raceTime;
      if ((inside > 0 && inside >= h.need) || (h.first >= 0 && G.raceTime - h.first > h.maxWait)) {
        h.open = true;
        h.openAt = G.raceTime;
        if (!G.simulating) { MR.Audio.countBeep(true); s.flash = 1; }
      }
    }
  }

  // niveau 4 : une bille qui passe par le trou du plus petit cercle explose, et le cercle se brise
  function updateSurvival(dt) {
    const W = G.world, L = G.level;
    let rg = W.rings[W.ringIdx] || null;
    const alive = G.marbles.filter(function (m) { return !m.out; });
    if (rg) {
      for (let i = 0; i < alive.length; i++) {
        const m = alive[i], dx = m.x - rg.cx, dy = m.y - rg.cy;
        if (dx * dx + dy * dy > Math.pow(rg.R + rg.t + m.r * 0.2, 2)) {
          eliminate(m, alive.length);
          rg.alive = false;
          W.ringIdx++;
          G.lastEscape = G.raceTime;
          if (!G.simulating) {
            MR.FX.shatterRing(G.fx, rg.cx, rg.cy, rg.R, rg.rgb, rg.angle);
            MR.Audio.ringBreak(0);
          }
          break;
        }
      }
    }
    const left = G.marbles.filter(function (m) { return !m.out; });
    if (left.length <= 1) {
      if (left[0]) finish(left[0], 1);
      endRace();
      return;
    }
    rg = W.rings[W.ringIdx] || null;
    if (!rg) return;
    // la vitesse des billes suit la taille du cercle actif (les grands cercles ne traînent pas)
    W.constSpeed = Math.max(L.speed || 520, rg.R * (L.speedPerR || 1.3));
    // chaque temps de la musique fait pulser les cercles
    const beat = G.simulating || !MR.Audio.ready() ? G.raceTime * 116 / 60 : MR.Audio.beat();
    const bn = Math.floor(beat);
    if (bn !== G.beatN) {
      G.beatN = bn;
      for (let k = W.ringIdx; k < W.rings.length; k++) W.rings[k].pulse = 1;
    }
  }

  // niveau 5 : pas d'arrivée ; une bille qui touche un destructeur (ou reste coincée) explose, la dernière en vie gagne
  function updateArena(dt) {
    const L = G.level, W = G.world;
    let alive = G.marbles.filter(function (m) { return !m.out; });
    for (let i = 0; i < alive.length; i++) {
      const m = alive[i];
      if (m.doom) { eliminate(m, G.marbles.filter(function (q) { return !q.out; }).length); continue; }
      if (m.held || (m.x - m.ax) * (m.x - m.ax) + (m.y - m.ay) * (m.y - m.ay) > 45 * 45) { m.ax = m.x; m.ay = m.y; m.at = G.raceTime; }
      else if (G.raceTime - m.at > STUCK_T) eliminate(m, G.marbles.filter(function (q) { return !q.out; }).length);
    }
    alive = G.marbles.filter(function (m) { return !m.out; });
    if (alive.length <= 1) {
      if (alive[0]) finish(alive[0], 1);
      endRace();
      return;
    }
    // prolongations : les scies grossissent peu à peu
    if (G.raceTime > (L.overtime || 90)) {
      for (let k = 0; k < W.circles.length; k++) {
        const c = W.circles[k];
        if (c.kill) c.r = Math.min(c.r0 * (L.sawMax || 2.6), c.r + (L.sawGrow || 2.5) * dt);
      }
    }
  }

  function stateUpdate(dt, dtR) {
    if (G.state === 'countdown') {
      G.cd -= dtR;
      const n = Math.ceil(G.cd);
      if (n !== G.cdShown && n > 0) {
        G.cdShown = n;
        MR.UI.countdown(String(n));
        MR.Audio.countBeep(false);
      }
      if (G.cd <= 0) go();
    } else if (G.state === 'racing') {
      const L = G.level;
      if (L.mode === 'survival') {
        updateSurvival(dt);
      } else if (L.mode === 'arena') {
        updateArena(dt);
      } else {
        const f = L.finish;
        let left = 0;
        const cz = L.calm || [];
        for (let i = 0; i < G.marbles.length; i++) {
          const m = G.marbles[i];
          if (m.finished) continue;
          if (m.y > f.y && m.x > f.box.x0 && m.x < f.box.x1) { finish(m); continue; }
          left++;
          // bille coincée : elle ne s'est pas éloignée de plus de 45 unités depuis 5 s (attendre dans un sas est normal)
          let calm = false;
          for (let k = 0; k < cz.length; k++) if (inBox(m, cz[k])) { calm = true; break; }
          if (calm || m.held || (m.x - m.ax) * (m.x - m.ax) + (m.y - m.ay) * (m.y - m.ay) > 45 * 45) { m.ax = m.x; m.ay = m.y; m.at = G.raceTime; }
          else if (G.raceTime - m.at > STUCK_T) { eliminate(m, 0); left--; }
        }
        updateHolds();
        if (left <= 0) endRace();
      }
      if (G.state === 'racing' && G.raceTime > (L.timeLimit || RACE_LIMIT)) {
        G.marbles.forEach(function (m) { if (!m.finished) { m.finished = true; m.dnf = true; m.rank = 0; } });
        endRace();
      }
    } else if (G.state === 'finished' && G.resultsIn > 0) {
      G.resultsIn -= dtR;
      if (G.resultsIn <= 0) MR.UI.showResults();
    }
  }

  // avancement d'une bille sur le parcours : la hauteur par défaut, ou la fonction du niveau
  // Parcours en ligne brisée (L.path) : chaque bille suit son tronçon, sans sauter vers une rampe voisine.
  function pathProg(L, m) {
    const P = L.path, cum = L._cum || (L._cum = buildCum(P));
    const w = m.wp || 0;
    let best = w, bd = Infinity, bu = 0;
    for (let i = Math.max(0, w - 1); i <= Math.min(P.length - 2, w + 3); i++) {
      const ax = P[i][0], ay = P[i][1], bx = P[i + 1][0], by = P[i + 1][1];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      let u = ((m.x - ax) * dx + (m.y - ay) * dy) / l2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = ax + dx * u - m.x, ey = ay + dy * u - m.y, d = ex * ex + ey * ey;
      if (d < bd) { bd = d; best = i; bu = u; }
    }
    m.wp = best;
    return cum[best] + bu * (cum[best + 1] - cum[best]);
  }
  function buildCum(P) {
    const c = [0];
    for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    return c;
  }
  function prog(m) {
    const L = G.level;
    if (L.path) return pathProg(L, m);
    return L.progress ? L.progress(m) : m.y;
  }
  G.progressVal = prog;
  function computeRanking() {
    const r = G.ranking = G.marbles.slice();
    r.forEach(function (m) { if (!m.out) m.pv = prog(m); });
    // groupes : arrivées (par place) → encore en piste → éliminées classées (niveau 4, par place) → éliminées sans place
    const grp = function (m) { return m.finished && !m.dnf ? (m.out ? 2 : 0) : m.dnf ? 3 : 1; };
    r.sort(function (a, b) {
      const ga = grp(a), gb = grp(b);
      if (ga !== gb) return ga - gb;
      if (ga === 0 || ga === 2) return a.rank - b.rank;
      if (ga === 3) return (b.elimAt || 0) - (a.elimAt || 0) || b.pv - a.pv;
      return b.pv - a.pv;
    });
    for (let i = 0; i < r.length; i++) r[i].pos = i + 1;
  }
  G.progress = function (m) {
    const L = G.level;
    const max = L.path ? (L._cum || (L._cum = buildCum(L.path)))[L.path.length - 1] : (L.progressMax || L.finish.y);
    return MR.clamp((m.pv != null ? m.pv : prog(m)) / max * 100, 0, 99);
  };

  /* ---------------- sons d'impact ---------------- */
  let lastMarbleClick = 0;
  function handleEvents() {
    const ev = G.world.events;
    if (!ev.length) return;
    if (G.time < G.quietUntil) { ev.length = 0; return; }
    ev.sort(function (a, b) { return b.s - a.s; });
    const cam = MR.Render.cam, vw = MR.Render.vw, vh = MR.Render.vh;
    let played = 0;
    for (let i = 0; i < ev.length && played < 6; i++) {
      const e = ev[i], m = e.m;
      if (G.time - m.lastSound < 0.065) continue;
      const sx = (m.x - cam.x) * cam.s, sy = (m.y - cam.y) * cam.s;
      const pan = MR.clamp(sx / (vw / 2), -1, 1) * 0.7;
      const onScreen = Math.abs(sx) < vw / 2 + 40 && Math.abs(sy) < vh / 2 + 40;
      const att = onScreen ? 1 : 0.3;
      m.lastSound = G.time;
      played++;
      if (e.kind === 'marble') {
        if (!G.settings.sfxMarble) continue;
        if (G.time - lastMarbleClick < 0.05) continue;
        lastMarbleClick = G.time;
        MR.Audio.hit('glass', Math.min(1, e.s / 900) * 0.3 * att, pan);
        continue;
      }
      if (e.kind === 'bumper') {
        MR.Audio.bumper(pan);
        MR.FX.burst(G.fx, e.obj.x, e.obj.y, e.obj.fw ? MR.pick([[255, 207, 74], [63, 240, 255], [255, 62, 165], [120, 255, 140]]) : [255, 62, 165], e.obj.fw ? 22 : 6);
      } else if (e.kind === 'tramp') {
        MR.Audio.bumper(pan);
        MR.FX.burst(G.fx, m.x, m.y + m.r, [63, 240, 255], 8);
        continue;
      }
      MR.Audio.hit(m.cfg.sound, MR.clamp((e.s - 50) / 650, 0.05, 1) * att, pan);
    }
    ev.length = 0;
  }

  function decay(dt) {
    const W = G.world, k = dt * 3;
    for (let i = 0; i < W.circles.length; i++) if (W.circles[i].flash > 0) W.circles[i].flash = Math.max(0, W.circles[i].flash - k);
    for (let i = 0; i < W.arms.length; i++) if (W.arms[i].flash > 0) W.arms[i].flash = Math.max(0, W.arms[i].flash - k);
    for (let i = 0; i < W.boosts.length; i++) W.boosts[i].hot *= Math.exp(-dt * 6);
    for (let i = 0; i < W.segs.length; i++) if (W.segs[i].flash > 0) W.segs[i].flash = Math.max(0, W.segs[i].flash - k);
    for (let i = 0; i < W.sliders.length; i++) if (W.sliders[i].flash > 0) W.sliders[i].flash = Math.max(0, W.sliders[i].flash - dt);
    for (let i = 0; i < W.rings.length; i++) if (W.rings[i].pulse > 0) W.rings[i].pulse = Math.max(0, W.rings[i].pulse - dt * 2.4);
  }

  /* ---------------- caméra ---------------- */
  // caméra libre (glisser / molette / pincer) : hors course elle reste où on l'a laissée,
  // en course elle revient au suivi automatique dès qu'on lâche
  G.manualCam = null;
  G.navHeld = false;
  function clampManual(mc) {
    const L = G.level, vw = MR.Render.vw - MR.Render.insetTarget(), vh = MR.Render.vh;
    const sMin = Math.min(vw / L.W, vh / L.H) * 0.9;
    mc.s = MR.clamp(mc.s, sMin, 3);
    mc.x = MR.clamp(mc.x, 0, L.W);
    mc.y = MR.clamp(mc.y, 0, L.H);
    return mc;
  }
  G.releaseNav = function () {
    G.navHeld = false;
    if (G.state === 'racing' || G.state === 'countdown') G.manualCam = null;
  };
  function cameraTarget() {
    if (G.manualCam) return clampManual(G.manualCam);
    const L = G.level, vw = MR.Render.vw - MR.Render.insetTarget(), vh = MR.Render.vh, mode = G.settings.camera;
    if (mode === 'overview' && !G.followId) {
      return { x: L.W / 2, y: L.H / 2, s: Math.min(vw / L.W, vh / L.H) * 0.96 };
    }
    // niveau 4 : la caméra reste au centre des cercles et recule à chaque cercle brisé
    if (L.mode === 'arena' && !G.followId) {
      const s = Math.max(Math.min(vw / (L.W * 1.02), vh / 1250), Math.min(vw, vh) / 950) * (G.settings.zoom || 1);
      let x = L.W / 2, y = L.startView.y;
      if (G.state === 'racing' || G.state === 'finished') {
        const live = G.marbles.filter(function (m) { return !m.out; });
        if (live.length) {
          x = 0; y = 0;
          live.forEach(function (m) { x += m.x; y += m.y; });
          x /= live.length; y /= live.length;
        }
      }
      const hw = vw / 2 / s, hh = vh / 2 / s;
      x = hw * 2 >= L.W ? L.W / 2 : MR.clamp(x, hw, L.W - hw);
      y = hh * 2 >= L.H ? L.H / 2 : MR.clamp(y, hh, L.H - hh);
      return { x: x, y: y, s: s };
    }
    if (L.mode === 'survival' && !G.followId) {
      const rg = G.world.rings[G.world.ringIdx];
      let R = rg ? rg.R : L.ringR0;
      if (G.state === 'ready' || G.state === 'countdown') R = Math.min(L.outerR, L.ringR0 * 1.9);
      const sv = Math.min(vw, vh) / (2 * (R + 80)) * (G.settings.zoom || 1);
      return { x: L.center.x, y: L.center.y, s: Math.min(sv, Math.min(vw, vh) / 300) };
    }
    // cadrage de suivi : chaque niveau peut fixer la taille de la zone visible (en unités du monde)
    const cam = L.camera || {};
    const s = (cam.fit === 'min'
      // niveau horizontal : montrer au moins viewW × viewH, sans jamais descendre sous `span` unités sur le petit côté
      ? Math.max(Math.min(vw / cam.viewW, vh / cam.viewH), Math.min(vw, vh) / (cam.span || 850))
      : Math.min(Math.max(vw / (cam.viewW || L.W), vh / (cam.viewH || 1500)), vw / 500)) * (G.settings.zoom || 1);
    let x, y, target = null, ahead = true, floorView = false;
    if (G.followId) {
      for (let i = 0; i < G.marbles.length; i++) if (G.marbles[i].id === G.followId) target = G.marbles[i];
    } else if (G.settings.followMe && G.state === 'racing') {
      // réglage « suivre ma bille » : la caméra reste sur la bille ★
      for (let i = 0; i < G.marbles.length; i++) if (G.marbles[i].cfg.me) target = G.marbles[i];
    }
    if (target) { x = target.x; y = target.y; }
    else if (G.state === 'ready' || G.state === 'countdown') { x = L.startView.x; y = L.startView.y; ahead = false; }
    else {
      const live = G.marbles.filter(function (m) { return !m.finished; });
      if (!live.length) {
        // le fond du bassin remonte au-dessus du bouton « Rejouer »
        x = (L.finish.box.x0 + L.finish.box.x1) / 2; y = L.finish.box.y1 - 0.26 * vh / s; ahead = false; floorView = true;
      } else if (mode === 'pack') {
        x = 0; y = 0;
        live.forEach(function (m) { x += m.x; y += m.y; });
        x /= live.length; y /= live.length; ahead = false;
      } else {
        let lead = live[0];
        live.forEach(function (m) { if (prog(m) > prog(lead)) lead = m; });
        x = lead.x; y = lead.y;
      }
    }
    if (ahead) y += (vh / s) * (cam.ahead != null ? cam.ahead : 0.12);
    const hw = vw / 2 / s, hh = vh / 2 / s;
    x = hw * 2 >= L.W ? L.W / 2 : MR.clamp(x, hw, L.W - hw);
    y = hh * 2 >= L.H ? L.H / 2 : MR.clamp(y, hh - 30, L.H - hh + (floorView ? 0.3 * vh / s : 30));
    return { x: x, y: y, s: s };
  }
  function updateCamera(dt, snap) {
    const t = cameraTarget(), c = MR.Render.cam;
    if (snap || G.manualCam) { c.x = t.x; c.y = t.y; c.s = t.s; return; }
    const rate = { soft: 1.6, normal: 3.2, fast: 6.5 }[G.settings.camSmooth] || 3.2;
    const k = 1 - Math.exp(-dt * rate), ks = 1 - Math.exp(-dt * rate * 0.8);
    c.x += (t.x - c.x) * k;
    c.y += (t.y - c.y) * k;
    c.s += (t.s - c.s) * ks;
  }

  /* ---------------- API pour le panneau ---------------- */
  function rosterChanged(countChanged) {
    if (countChanged && G.run) G.stopRun();
    saveRoster();
    if (countChanged) G.reset(G.state !== 'ready', false);
    MR.UI.renderList();
    MR.UI.boardDirty = true;
  }
  G.addMarble = function (cfg) {
    if (G.roster.length >= MR.MAX_MARBLES) { MR.UI.toast(MR.MAX_MARBLES + ' billes maximum'); return false; }
    G.roster.push(MR.normalizeMarble(cfg));
    rosterChanged(true);
    return true;
  };
  G.updateMarble = function (cfg) {
    const c = MR.normalizeMarble(cfg);
    const i = G.roster.findIndex(function (r) { return r.id === c.id; });
    if (i < 0) return;
    c.me = !!G.roster[i].me;
    G.roster[i] = c;
    if (G.roster[i].name !== c.name) MR.Prog.onRename();
    G.roster[i] = c;
    G.marbles.forEach(function (m) { if (m.id === c.id) { m.cfg = c; refreshLook(m); } });
    rosterChanged(false);
  };
  G.setMe = function (id) {
    G.roster.forEach(function (m) { m.me = m.id === id; });
    ensureMe();
    rosterChanged(false);
  };
  G.duplicateMarble = function (src) {
    if (G.roster.length >= MR.MAX_MARBLES) { MR.UI.toast(MR.MAX_MARBLES + ' billes maximum'); return null; }
    const c = MR.duplicateMarble(src, G.roster.map(function (r) { return r.name; }));
    G.roster.push(MR.normalizeMarble(c));
    rosterChanged(true);
    return c;
  };
  G.removeMarble = function (id) {
    if (G.roster.length <= 1) return;
    G.roster = G.roster.filter(function (r) { return r.id !== id; });
    ensureMe();
    if (G.followId === id) G.followId = null;
    rosterChanged(true);
  };
  G.renameMarble = function (id, name) {
    const n = String(name).trim().slice(0, 18);
    if (!n) return;
    const c = G.roster.find(function (r) { return r.id === id; });
    if (!c) return;
    if (c.name !== n) renamed = true;
    c.name = n;
    saveRoster();
    MR.UI.boardDirty = true;
  };
  // fin de la saisie d'un nom : compte pour le succès « Renommer une bille »
  let renamed = false;
  G.commitRename = function (force) {
    if (!renamed && !force) return;
    renamed = false;
    MR.Prog.onRename();
  };
  G.setCount = function (n) {
    n = MR.clamp(Math.round(n) || 1, 1, MR.MAX_MARBLES);
    if (n === G.roster.length) { MR.UI.renderList(); return; }
    while (G.roster.length < n) G.roster.push(MR.randomMarble(G.roster.map(function (r) { return r.name; })));
    if (G.roster.length > n) G.roster.length = n;
    ensureMe();
    rosterChanged(true);
  };
  G.setSetting = function (k, v) {
    G.settings[k] = v;
    saveSettings();
    if (k === 'music') MR.Audio.setMusic(v);
    else if (k === 'musicVol') MR.Audio.setMusicVol(v);
    else if (k === 'sfx') MR.Audio.setSfx(v);
    else if (k === 'sfxVol') MR.Audio.setSfxVol(v);
    else if (k === 'camera') G.followId = null;
    else if (k === 'quality') MR.Render.resize();
    else if (k === 'particles') MR.fxDensity = v;
    MR.UI.boardDirty = true;
  };
  G.follow = function (id) {
    G.followId = G.followId === id ? null : id;
    if (G.followId && G.settings.camera === 'overview') { G.settings.camera = 'leader'; saveSettings(); MR.UI.syncControls(); }
    MR.UI.boardDirty = true;
  };

  /* ---------------- boucle ---------------- */
  let last = 0, acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!last) last = now;
    let dtR = (now - last) / 1000;
    last = now;
    if (!(dtR > 0)) dtR = 0;
    if (dtR > 0.05) dtR = 0.05;
    tick(dtR);
  }
  // avance le jeu à la main (débogage) : MR.Game.advance(2)
  G.advance = function (seconds) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) tick(1 / 60);
  };
  function tick(dtR) {
    G.time += dtR;
    if (!G.paused) {
      const dt = dtR * G.settings.speed;
      acc += dt;
      let n = 0;
      while (acc >= FIXED && n < 12) {
        setBeat();
        for (let i = 0; i < SUB; i++) MR.Physics.step(G.world, FIXED / SUB);
        acc -= FIXED; n++;
      }
      if (n >= 12) acc = 0;
      if (G.state === 'racing') G.raceTime += dt;
      stateUpdate(dt, dtR);
      for (let i = 0; i < G.marbles.length; i++) if (!G.marbles[i].out) MR.FX.trailTick(G.fx, G.marbles[i], dt, G.time);
      G.fx.update(dt);
      decay(dt);
      handleEvents();
    } else {
      G.world.events.length = 0;
    }
    computeRanking();
    updateCamera(dtR, false);
    MR.Render.draw(G);
    MR.UI.frame(dtR);
  }

  /* ---------------- test sans affichage (débogage) ---------------- */
  G.simulate = function (seconds) {
    G.simulating = true;
    G.reset(false, false);
    go();
    const steps = Math.round(seconds / FIXED);
    const holds = [];
    for (let s = 0; s < steps; s++) {
      setBeat();
      for (let i = 0; i < SUB; i++) MR.Physics.step(G.world, FIXED / SUB);
      G.raceTime += FIXED;
      if (s % 4 === 0) computeRanking();
      stateUpdate(FIXED, FIXED);
      if (G.debugStep) G.debugStep(G.raceTime);
      G.world.sliders.forEach(function (sl, k) { if (sl.hold && sl.hold.open && holds[k] == null) holds[k] = +G.raceTime.toFixed(1); });
      G.world.events.length = 0;
      if (G.state !== 'racing') break;
    }
    computeRanking();
    G.simulating = false;
    const done = G.marbles.filter(function (m) { return m.finished && !m.dnf && !m.out; });
    return {
      time: +G.raceTime.toFixed(2),
      finished: G.marbles.filter(function (m) { return m.finished && !m.dnf; }).length,
      total: G.marbles.length,
      first: done.length ? +Math.min.apply(null, done.map(function (m) { return m.time; })).toFixed(2) : null,
      last: done.length ? +Math.max.apply(null, done.map(function (m) { return m.time; })).toFixed(2) : null,
      out: G.marbles.filter(function (m) { return m.out && m.dnf; }).map(function (m) { return [Math.round(m.x), Math.round(m.y), +m.elimAt.toFixed(1)]; }),
      holds: holds,
      stuck: G.marbles.filter(function (m) { return !m.finished; }).map(function (m) { return [Math.round(m.x), Math.round(m.y)]; })
    };
  };

  function init() {
    loadSettings();
    MR.Prog.load();
    MR.Account.load();
    MR.Cards.load();
    loadRoster();
    G.fx = new MR.FX.System();
    MR.Audio.settings.music = G.settings.music;
    MR.Audio.settings.musicVol = G.settings.musicVol;
    MR.Audio.settings.sfx = G.settings.sfx;
    MR.Audio.settings.sfxVol = G.settings.sfxVol;
    MR.MarbleGL.init();
    MR.Render.init(document.getElementById('stage'));
    G.levelDef = MR.levelById(G.settings.levelId);
    G.level = G.levelDef.build();
    MR.UI.init(G);
    MR.Packs.init();
    MR.Settings.init(G);
    MR.Profile.init(G);
    MR.UI.syncControls();
    G.reset(false, true);
    MR.MarbleGL.warm();
    MR.Sync.init();
    MR.Account.init();
    if (MR.store.get(KEY_SEEN, null) !== MR.VERSION) {
      MR.store.set(KEY_SEEN, MR.VERSION);
      setTimeout(function () { MR.UI.toast('Nouveau en ' + MR.VERSION + ' : ta propre image sur une bille, titres de niveau, Œil de dragon et 11 autres billes'); }, 900);
    }

    const unlock = function () {
      MR.Audio.unlock();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    // cliquer sur une bille pour la suivre ; hors course, on peut aussi la saisir et la lancer
    const stage = document.getElementById('stage');
    // appui long sur téléphone : pas de menu contextuel sur la piste
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    function pick(e) {
      const p = MR.Render.screenToWorld(e.clientX, e.clientY);
      let best = null, bd = Infinity;
      const lim = 16 / MR.Render.cam.s;
      G.marbles.forEach(function (m) {
        if (m.out) return;
        const d = Math.hypot(m.x - p.x, m.y - p.y) - m.r;
        if (d < lim && d < bd) { bd = d; best = m; }
      });
      return { m: best, p: p };
    }
    function canDrag() { return G.state === 'ready' || G.state === 'finished'; }
    const touches = new Map();
    let pan = null, pinch = null;
    function camNow() { const c = MR.Render.cam; return { x: c.x, y: c.y, s: c.s }; }
    function startPan(e) {
      pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cam: camNow(), moved: false };
    }
    stage.addEventListener('pointerdown', function (e) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && !G.drag) {
        // deux doigts : zoom
        const pts = Array.from(touches.values());
        pinch = { d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, cam: camNow() };
        pan = null;
        G.navHeld = true;
        G.manualCam = camNow();
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        return;
      }
      const hit = pick(e);
      if (!hit.m) {
        startPan(e);
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        return;
      }
      if (!canDrag()) { G.follow(hit.m.id); return; }
      G.drag = { m: hit.m, id: e.pointerId, ox: hit.m.x - hit.p.x, oy: hit.m.y - hit.p.y, sx: e.clientX, sy: e.clientY, moved: false };
      hit.m.held = true;
      hit.m.hx = hit.m.x; hit.m.hy = hit.m.y;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      stage.style.cursor = 'grabbing';
    });
    stage.addEventListener('pointermove', function (e) {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size >= 2) {
        const pts = Array.from(touches.values());
        const dd = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        G.manualCam = { x: pinch.cam.x, y: pinch.cam.y, s: pinch.cam.s * dd / pinch.d0 };
        return;
      }
      if (pan && pan.id === e.pointerId) {
        const dx = e.clientX - pan.sx, dy = e.clientY - pan.sy;
        if (!pan.moved && Math.hypot(dx, dy) > 5) { pan.moved = true; G.navHeld = true; stage.classList.add('panning'); }
        if (pan.moved) G.manualCam = { x: pan.cam.x - dx / pan.cam.s, y: pan.cam.y - dy / pan.cam.s, s: G.manualCam ? G.manualCam.s : pan.cam.s };
        return;
      }
      const d = G.drag;
      if (d && d.id === e.pointerId) {
        const p = MR.Render.screenToWorld(e.clientX, e.clientY);
        d.m.hx = MR.clamp(p.x + d.ox, 0, G.level.W);
        d.m.hy = MR.clamp(p.y + d.oy, 0, G.level.H);
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
        return;
      }
      if (e.pointerType === 'mouse') stage.style.cursor = canDrag() && pick(e).m ? 'grab' : (pick(e).m ? 'pointer' : '');
    });
    function release(e) {
      if (e) touches.delete(e.pointerId);
      if (pinch && touches.size < 2) { pinch = null; if (!touches.size) G.releaseNav(); }
      if (pan && (!e || pan.id === e.pointerId)) {
        pan = null;
        stage.classList.remove('panning');
        G.releaseNav();
      }
      const d = G.drag;
      if (!d || (e && d.id !== e.pointerId)) return;
      d.m.held = false;
      G.drag = null;
      stage.style.cursor = '';
      if (!d.moved) G.follow(d.m.id);
      else if (G.state === 'ready') G.moved = true;
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    // molette : zoom vers le curseur (en course, la vue revient au suivi peu après)
    let wheelTimer = null;
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      const c = MR.Render.cam, p = MR.Render.screenToWorld(e.clientX, e.clientY);
      const f = Math.exp(-e.deltaY * 0.0015);
      const mc = clampManual({ x: c.x, y: c.y, s: c.s * f });
      mc.x = p.x - (e.clientX - MR.Render.cx()) / mc.s;
      mc.y = p.y - (e.clientY - MR.Render.vh / 2) / mc.s;
      G.manualCam = mc;
      clearTimeout(wheelTimer);
      if (G.state === 'racing' || G.state === 'countdown') wheelTimer = setTimeout(function () { if (!G.navHeld) G.manualCam = null; }, 1400);
    }, { passive: false });

    if (document.fonts && document.fonts.load) {
      document.fonts.load('40px Monoton').catch(function () {});
      document.fonts.load('600 12px Outfit').catch(function () {});
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.MR);
