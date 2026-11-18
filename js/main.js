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
  const RACE_LIMIT = 180; // secondes : au-delà, les billes restantes abandonnent

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
    return { v: 2, cards: MR.Cards.exportState(), roster: G.roster.map(function (m) { return Object.assign({}, m); }), rosterAt: rosterAt };
  };
  G.importSave = function (d) {
    if (!d || typeof d !== 'object') return;
    const before = MR.Cards.distinct();
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
    if (rosterChangedNow) G.reset(false, false);
    if (rosterChangedNow || MR.Cards.distinct() > before) MR.UI.toast('Progression récupérée depuis ton compte');
  };

  /* ---------------- billes ---------------- */
  function makeBody(cfg, slot, r) {
    const m = {
      id: cfg.id, cfg: cfg, x: slot.x + MR.rand(-2, 2), y: slot.y, vx: 0, vy: 0, r: r,
      angle: Math.random() * MR.TAU, spin: 0, spinT: 0, touch: false,
      finished: false, dnf: false, rank: 0, time: 0, still: 0, lastSound: -1, pos: 0,
      hist: [], emit: 0, spec: null, boost: 0
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
    G.levelDef = MR.levelById(id);
    G.settings.levelId = G.levelDef.id;
    saveSettings();
    G.level = G.levelDef.build();
    G.reset(false, true);
  };

  G.reset = function (announce, snap) {
    const L = G.level;
    G.world = MR.Physics.createWorld(L);
    const slots = L.spawnSlots(G.roster.length);
    G.marbles = G.roster.map(function (cfg, i) { return makeBody(cfg, slots[i] || slots[0], L.marbleR); });
    G.world.marbles = G.marbles;
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
    if (G.drag) { G.drag.m.held = false; G.drag = null; }
    // une bille déplacée à la main repart de l'enclos : départ équitable
    if (G.state !== 'ready' || G.moved) G.reset(false, false);
    G.state = 'countdown';
    G.cd = G.settings.countdown ? 3 : 0.01; G.cdShown = 4;
    G.paused = false;
    MR.UI.onState();
  };

  function go() {
    G.state = 'racing';
    G.raceTime = 0;
    G.world.arms.forEach(function (a) { if (a.kind === 'door') a.omega = a.openSpeed; });
    MR.UI.countdown('GO');
    MR.Audio.countBeep(true);
    MR.UI.onState();
  }

  G.togglePause = function () {
    if (G.state !== 'racing' && G.state !== 'countdown') { G.paused = false; return; }
    G.paused = !G.paused;
    MR.UI.onState();
  };

  function finish(m) {
    m.finished = true;
    m.rank = ++G.finishCount;
    m.time = G.raceTime;
    MR.Audio.finishChime(m.rank);
    MR.FX.burst(G.fx, m.x, m.y, m.rgb, m.rank === 1 ? 40 : 18);
    // récompense si c'est la bille du joueur, sur le podium, avec au moins 30 billes en course
    if (m.cfg.me && m.rank <= 3 && G.marbles.length >= G.REWARD_MIN && !G.simulating) {
      const R = [null, { premium: 1, text: 'un paquet premium' }, { packs: 2, text: '2 paquets de cartes' }, { packs: 1, text: 'un paquet de cartes' }][m.rank];
      MR.Cards.grant(R.packs || 0, R.premium || 0);
      G.reward = { rank: m.rank, text: R.text };
      MR.Packs.updateCounters();
      setTimeout(function () { MR.UI.toast('Ta bille finit ' + (m.rank === 1 ? '1re' : m.rank + 'e') + ' : tu gagnes ' + R.text + ' !'); MR.Audio.newBadge(); }, m.rank === 1 ? 1500 : 200);
    }
    if (m.rank === 1) {
      MR.UI.banner(m.cfg.name);
      MR.Audio.fanfare();
      const b = G.level.finish.box;
      MR.FX.confetti(G.fx, b.x0 + 60, b.x1 - 60, b.y1 - 40, 140);
    }
    MR.UI.boardDirty = true;
  }

  function endRace() {
    G.state = 'finished';
    G.resultsIn = 1.6;
    G.followId = null;
    MR.UI.onState();
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
      const f = G.level.finish;
      let left = 0;
      for (let i = 0; i < G.marbles.length; i++) {
        const m = G.marbles[i];
        if (m.finished) continue;
        if (m.y > f.y && m.x > f.box.x0 && m.x < f.box.x1) { finish(m); continue; }
        left++;
        const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
        // dans un sas, attendre est normal : pas de coup de pouce
        let calm = false;
        const cz = G.level.calm || [];
        for (let k = 0; k < cz.length; k++) { const z = cz[k]; if (m.x > z.x0 && m.x < z.x1 && m.y > z.y0 && m.y < z.y1) { calm = true; break; } }
        if (sp < 20 && !calm) m.still += dt; else m.still = Math.max(0, m.still - dt * 2);
        if (m.still > 2) {
          m.vx += MR.rand(-180, 180);
          m.vy = -MR.rand(200, 320);
          m.still = 0;
        }
      }
      if (!left) endRace();
      else if (G.raceTime > RACE_LIMIT) {
        G.marbles.forEach(function (m) { if (!m.finished) { m.finished = true; m.dnf = true; m.rank = 0; } });
        endRace();
      }
    } else if (G.state === 'finished' && G.resultsIn > 0) {
      G.resultsIn -= dtR;
      if (G.resultsIn <= 0) MR.UI.showResults();
    }
  }

  // avancement d'une bille sur le parcours : la hauteur par défaut, ou la fonction du niveau
  function prog(m) { return G.level.progress ? G.level.progress(m) : m.y; }
  G.progressVal = prog;
  function computeRanking() {
    const r = G.ranking = G.marbles.slice();
    r.forEach(function (m) { m.pv = prog(m); });
    r.sort(function (a, b) {
      if (a.finished && !a.dnf && b.finished && !b.dnf) return a.rank - b.rank;
      if (a.finished && !a.dnf) return -1;
      if (b.finished && !b.dnf) return 1;
      return b.pv - a.pv;
    });
    for (let i = 0; i < r.length; i++) r[i].pos = i + 1;
  }
  G.progress = function (m) {
    return MR.clamp(prog(m) / (G.level.progressMax || G.level.finish.y) * 100, 0, 99);
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
        MR.FX.burst(G.fx, e.obj.x, e.obj.y, [255, 62, 165], 6);
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
  }

  /* ---------------- caméra ---------------- */
  function cameraTarget() {
    const L = G.level, vw = MR.Render.vw - MR.Render.insetTarget(), vh = MR.Render.vh, mode = G.settings.camera;
    if (mode === 'overview' && !G.followId) {
      return { x: L.W / 2, y: L.H / 2, s: Math.min(vw / L.W, vh / L.H) * 0.96 };
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
    if (snap) { c.x = t.x; c.y = t.y; c.s = t.s; return; }
    const rate = { soft: 1.6, normal: 3.2, fast: 6.5 }[G.settings.camSmooth] || 3.2;
    const k = 1 - Math.exp(-dt * rate), ks = 1 - Math.exp(-dt * rate * 0.8);
    c.x += (t.x - c.x) * k;
    c.y += (t.y - c.y) * k;
    c.s += (t.s - c.s) * ks;
  }

  /* ---------------- API pour le panneau ---------------- */
  function rosterChanged(countChanged) {
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
    c.name = n;
    saveRoster();
    MR.UI.boardDirty = true;
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
        for (let i = 0; i < SUB; i++) MR.Physics.step(G.world, FIXED / SUB);
        acc -= FIXED; n++;
      }
      if (n >= 12) acc = 0;
      if (G.state === 'racing') G.raceTime += dt;
      stateUpdate(dt, dtR);
      for (let i = 0; i < G.marbles.length; i++) MR.FX.trailTick(G.fx, G.marbles[i], dt, G.time);
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
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < SUB; i++) MR.Physics.step(G.world, FIXED / SUB);
      G.raceTime += FIXED;
      stateUpdate(FIXED, FIXED);
      G.world.events.length = 0;
      if (G.state !== 'racing') break;
    }
    computeRanking();
    G.simulating = false;
    return {
      time: +G.raceTime.toFixed(2),
      finished: G.marbles.filter(function (m) { return m.finished && !m.dnf; }).length,
      total: G.marbles.length,
      first: G.ranking[0] && G.ranking[0].finished ? +G.ranking[0].time.toFixed(2) : null,
      last: G.ranking.length && G.ranking[G.ranking.length - 1].finished ? +G.ranking[G.ranking.length - 1].time.toFixed(2) : null,
      stuck: G.marbles.filter(function (m) { return !m.finished; }).map(function (m) { return [Math.round(m.x), Math.round(m.y)]; })
    };
  };

  function init() {
    loadSettings();
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
    MR.UI.syncControls();
    G.reset(false, true);
    MR.MarbleGL.warm();
    MR.Sync.init();
    if (MR.store.get(KEY_SEEN, null) !== MR.VERSION) {
      MR.store.set(KEY_SEEN, MR.VERSION);
      setTimeout(function () { MR.UI.toast('Nouveau en ' + MR.VERSION + ' : les paquets de cartes ! Bouton « Cartes » en haut à droite'); }, 900);
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
        const d = Math.hypot(m.x - p.x, m.y - p.y) - m.r;
        if (d < lim && d < bd) { bd = d; best = m; }
      });
      return { m: best, p: p };
    }
    function canDrag() { return G.state === 'ready' || G.state === 'finished'; }
    stage.addEventListener('pointerdown', function (e) {
      const hit = pick(e);
      if (!hit.m) return;
      if (!canDrag()) { G.follow(hit.m.id); return; }
      G.drag = { m: hit.m, id: e.pointerId, ox: hit.m.x - hit.p.x, oy: hit.m.y - hit.p.y, sx: e.clientX, sy: e.clientY, moved: false };
      hit.m.held = true;
      hit.m.hx = hit.m.x; hit.m.hy = hit.m.y;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      stage.style.cursor = 'grabbing';
    });
    stage.addEventListener('pointermove', function (e) {
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

    if (document.fonts && document.fonts.load) {
      document.fonts.load('40px Monoton').catch(function () {});
      document.fonts.load('600 12px Outfit').catch(function () {});
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.MR);
