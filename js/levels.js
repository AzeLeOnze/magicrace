/* MagicRace — niveaux. Chaque niveau s'enregistre avec MR.registerLevel({ id, num, name, build }). */
(function (MR) {
  'use strict';

  MR.LEVELS = [];
  // zones : 10 niveaux de course chacune (0.2.14 : la Zone Disco est complète)
  MR.ZONES = [{ id: 'disco', name: 'Zone Disco', size: 10 }];
  MR.registerLevel = function (def) { if (!def.zone) def.zone = 'disco'; MR.LEVELS.push(def); };
  MR.levelById = function (id) {
    for (let i = 0; i < MR.LEVELS.length; i++) if (MR.LEVELS[i].id === id) return MR.LEVELS[i];
    return MR.LEVELS[0];
  };

  // Petit constructeur de géométrie partagé par tous les niveaux.
  function Builder(W, H) {
    const L = {
      W: W, H: H, gravity: 1000, marbleR: 16,
      segs: [], circles: [], arms: [], hubs: [], boosts: [], pistons: [], sliders: [], zones: [], shapes: [], signs: [], voids: [], calm: [], liquids: [],
      gzones: [], portals: [],
      spawn: null, finish: null, startView: { x: W / 2, y: 300 }
    };
    L.seg = function (ax, ay, bx, by, o) {
      o = o || {};
      L.segs.push({ ax: ax, ay: ay, bx: bx, by: by, t: o.t || 7, e: o.e != null ? o.e : 0.3, kind: o.kind || 'ramp' });
    };
    L.poly = function (pts, o) {
      for (let i = 0; i < pts.length - 1; i++) L.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o);
    };
    L.peg = function (x, y, r) {
      L.circles.push({ x: x, y: y, r: r || 10, e: 0.5, kick: 0, kind: 'peg' });
    };
    L.bumper = function (x, y, r, kick, fw) {
      L.circles.push({ x: x, y: y, r: r || 24, e: 0.75, kick: kick || 240, kind: 'bumper', fw: !!fw });
    };
    // bord rebondissant rouge (triangles, barres) : renvoie la bille avec une poussée `kick`
    L.sling = function (ax, ay, bx, by, kick, t) {
      L.segs.push({ ax: ax, ay: ay, bx: bx, by: by, t: t || 8, e: 0.8, kind: 'sling', kick: kick || 380 });
    };
    // dalle de piste de danse : s'allume et fait sauter les billes sur chaque temps
    L.pad = function (ax, ay, bx, by, kick) {
      L.segs.push({ ax: ax, ay: ay, bx: bx, by: by, t: 7, e: 0.3, kind: 'pad', beat: true, kick: kick || 200 });
    };
    // piste de danse : rampe découpée en dalles
    L.danceFloor = function (ax, ay, bx, by, n, kick) {
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        L.pad(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, kick);
      }
    };
    // enceinte : souffle (ax, ay) seulement sur le temps de la musique
    L.speaker = function (x0, y0, x1, y1, ax, ay, side) {
      L.zones.push({ x0: x0, y0: y0, x1: x1, y1: y1, ax: ax, ay: ay, hot: 0, beat: true, speaker: side || 1 });
    };
    // engrenage : roue dentée qui tourne (moyeu + dents)
    L.gear = function (cx, cy, R, teeth, omega, phase) {
      for (let k = 0; k < teeth; k++) {
        L.arms.push({ px: cx, py: cy, len: R + 26, angle: (phase || 0) + k * MR.TAU / teeth, omega: omega, t: 9, e: 0.4, kind: 'gear' });
      }
      L.hubs.push({ x: cx, y: cy, r: R });
      L.circles.push({ x: cx, y: cy, r: R, e: 0.35, kick: 0, kind: 'gearhub', rot: omega, grip: 0.04 });
    };
    // aiguillage : volet qui bascule entre a0 et a1 et envoie les billes d'un côté puis de l'autre
    L.flap = function (px, py, len, a0, a1, period, off) {
      const half = period / 2;
      L.arms.push({ px: px, py: py, len: len, angle: a0, omega: 0, t: 8, e: 0.3, kind: 'flap',
        cycle: { period: period, closed: half - 0.25, move: 0.25, a0: a0, a1: a1, off: off || 0 } });
      L.hubs.push({ x: px, y: py, r: 12 });
      L.circles.push({ x: px, y: py, r: 12, e: 0.4, kick: 0, kind: 'hub' });
    };
    // boule à facettes géante qui tourne et renvoie les billes
    L.mirrorBall = function (x, y, r, rot, kick) {
      L.circles.push({ x: x, y: y, r: r, e: 0.6, kick: kick || 120, kind: 'turntable', rot: rot, angle: 0, grip: 0.03 });
    };
    // platine vinyle : disque qui tourne et entraîne les billes
    L.vinyl = function (x, y, r, rot) {
      L.circles.push({ x: x, y: y, r: r, e: 0.3, kick: 0, kind: 'vinyl', rot: rot, angle: 0, grip: 0.06 });
    };
    // laser : barrière qui s'ouvre et se ferme en rythme (un temps sur deux)
    L.laser = function (ax, ay, bx, by, dx, dy, off) {
      L.sliders.push({ ax: ax, ay: ay, bx: bx, by: by, dx: dx, dy: dy, t: 5, e: 0.2, kind: 'laser', cycle: { move: 0.14 },
        hold: { beat: true, beatOff: off || 0, every: 4 } });
    };
    // auvent d'un demi-tour de rayon 125 centré en (cx, cy) : side = 1 virage à droite, -1 virage à gauche
    L.hood = function (cx, cy, side, kind) {
      L.seg(cx - 21.7, cy - 123, cx - side * 130 - (side < 0 ? 22 : 0), cy - 172, { kind: kind || 'wall', e: 0.3 });
    };
    // flipper (0.2.9) : bras pivotant en (px, py), au repos à l'angle a0, qui se lève d'un coup jusqu'à a1 sur le temps
    L.flipper = function (px, py, len, a0, a1, o) {
      o = o || {};
      L.arms.push({ px: px, py: py, len: len, angle: a0, omega: 0, t: o.t || 11, e: 0.25, kind: 'flipper', side: a0 < Math.PI / 2 ? 1 : -1,
        flip: { a0: a0, a1: a1, every: o.every || 2, off: o.off || 0, upSpeed: o.upSpeed || 9, downSpeed: o.downSpeed || 5, hold: o.hold || 0.22 } });
      L.circles.push({ x: px, y: py, r: (o.t || 11) + 3, e: 0.3, kick: 0, kind: 'fliphub' });
    };
    // fiole (0.2.9) : verre de largeur w (intérieur x0..x1), fond arrondi en yBot, bec verseur côté `side` (-1 gauche, 1 droite)
    // à la hauteur lipY ; le liquide monte jusqu'à yTop, porte les billes, les déverse par le bec, puis redescend.
    L.flask = function (x0, x1, yWall, lipY, yBot, side, o) {
      o = o || {};
      const R = (x1 - x0) / 2, cx = (x0 + x1) / 2, cy = yBot - R;
      const lipX = side < 0 ? x0 : x1, backX = side < 0 ? x1 : x0;
      L.seg(lipX, lipY, lipX, cy, { kind: 'glass', e: 0.25, t: 7 });
      L.seg(backX, yWall, backX, cy, { kind: 'glass', e: 0.25, t: 7 });
      L.arc(cx, cy, R, 0, 180, 12, { kind: 'glass', e: 0.25, t: 7 });
      L.liquids.push({ x0: x0 + 8, x1: x1 - 8, yTop: o.yTop != null ? o.yTop : lipY - 34, yBot: yBot, lipX: lipX, lipY: lipY, side: side,
        cx: cx, cy: cy, R: R, empty: o.empty || 1.2, fill: o.fill || 3, hold: o.hold || 3, drain: o.drain || 1.8, off: o.off || 0,
        buoy: o.buoy || 2.1, drag: o.drag || 3, flow: (o.flow || 700) * side, c1: o.c1 || '#ff4fa8', c2: o.c2 || '#6a1fd6' });
      L.calm.push({ x0: x0, y0: Math.min(yWall, lipY) - 40, x1: x1, y1: yBot + 10 });
    };
    // zone sans gravité (0.2.13) : g = part de la gravité (0 = apesanteur), courant (ax, ay), freinage drag
    L.zeroG = function (x0, y0, x1, y1, o) {
      o = o || {};
      L.gzones.push({ x0: x0, y0: y0, x1: x1, y1: y1, g: o.g || 0, ax: o.ax || 0, ay: o.ay != null ? o.ay : 140, drag: o.drag != null ? o.drag : 0.5 });
    };
    // portail à sens unique : entre en (ax, ay), ressort en (bx, by) ; dir = direction de sortie (radians) ou garde la vitesse
    L.portal = function (ax, ay, bx, by, o) {
      o = o || {};
      L.portals.push({ ax: ax, ay: ay, bx: bx, by: by, r: o.r || 34, dir: o.dir != null ? o.dir : null, hue: o.hue != null ? o.hue : 190 });
    };
    // marche d'escalier lumineuse
    L.step = function (x0, y0, x1, y1) { L.segs.push({ ax: x0, ay: y0, bx: x1, by: y1, t: 7, e: 0.35, kind: 'step' }); };
    // destructeur : lame électrique bleue, la bille qui la touche explose
    L.killer = function (ax, ay, bx, by) {
      L.segs.push({ ax: ax, ay: ay, bx: bx, by: by, t: 6, e: 0.3, kind: 'kill', kill: true });
    };
    // scie destructrice ronde (elle grossit pendant les prolongations)
    L.saw = function (x, y, r) {
      L.circles.push({ x: x, y: y, r: r, e: 0.4, kick: 0, kind: 'saw', kill: true });
    };
    // trampoline : segment rebondissant qui renvoie la bille avec une poussée `kick`
    L.tramp = function (ax, ay, bx, by, kick) {
      L.segs.push({ ax: ax, ay: ay, bx: bx, by: by, t: 7, e: 0.6, kind: 'tramp', kick: kick || 300 });
    };
    // porte de regroupement (0.2.0) : segment a→b qui glisse de (dx, dy) pour s'ouvrir. Elle reste fermée tant que
    // `ratio` des billes encore derrière elle n'attendent pas dans `zone` (ou `maxWait` s après la première arrivée),
    // puis s'ouvre pour de bon. `pv` = avancement (classement) à l'endroit de la porte.
    L.hold = function (ax, ay, bx, by, dx, dy, zone, o) {
      o = o || {};
      L.sliders.push({ ax: ax, ay: ay, bx: bx, by: by, dx: dx, dy: dy, t: 6, e: 0.15, kind: 'gate', cycle: { move: o.move || 0.5 },
        hold: { zone: zone, ratio: o.ratio || 0.85, maxWait: o.maxWait || 10, pv: o.pv != null ? o.pv : Math.max(ay, by), label: o.label || null } });
      L.calm.push(zone);
    };
    // avancement sur le parcours L.path pour un point fixe (porte, panneau)
    L.pathPos = function (x, y) {
      const P = L.path;
      let best = 0, bd = Infinity, acc = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const ax = P[i][0], ay = P[i][1], bx = P[i + 1][0], by = P[i + 1][1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, len = Math.sqrt(l2);
        let u = ((x - ax) * dx + (y - ay) * dy) / l2;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const ex = ax + dx * u - x, ey = ay + dy * u - y, d = ex * ex + ey * ey;
        if (d < bd) { bd = d; best = acc + u * len; }
        acc += len;
      }
      return best;
    };
    // moulin : `arms` bras de longueur `len` autour de (cx, cy), vitesse angulaire omega (rad/s)
    L.rotor = function (cx, cy, len, arms, omega, phase, hubR, kind) {
      for (let k = 0; k < arms; k++) {
        L.arms.push({ px: cx, py: cy, len: len, angle: (phase || 0) + k * MR.TAU / arms, omega: omega, t: 7, e: 0.45, kind: kind || 'rotor' });
      }
      L.hubs.push({ x: cx, y: cy, r: hubR || 13 });
      L.circles.push({ x: cx, y: cy, r: hubR || 13, e: 0.4, kick: 0, kind: 'hub' });
    };
    // arc de cercle en segments, de l'angle a0 à a1 (degrés, sens horaire à l'écran quand a1 > a0)
    L.arc = function (cx, cy, r, a0, a1, n, o) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      L.poly(pts, o);
    };
    // zone d'accélération (ascenseur, tapis roulant) : ajoute (ax, ay) à la vitesse chaque seconde
    L.zone = function (x0, y0, x1, y1, ax, ay) {
      L.zones.push({ x0: x0, y0: y0, x1: x1, y1: y1, ax: ax, ay: ay, hot: 0 });
    };
    // rampe ondulée (vagues) : la ligne a→b avec des bosses d'amplitude amp tous les `wl`, nulles aux extrémités
    L.wavy = function (x0, y0, x1, y1, amp, wl, n, o) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t;
        pts.push([x, y0 + (y1 - y0) * t + amp * Math.sin(MR.TAU * Math.abs(x - x0) / wl) * Math.sin(Math.PI * t)]);
      }
      L.poly(pts, o);
    };
    // forme décorée (remplie d'un motif) : ses bords sont de vrais murs
    L.shape = function (pts, style, kind) {
      L.shapes.push({ pts: pts, style: style });
      L.poly(pts.concat([pts[0]]), { kind: kind || 'diamond', e: 0.4 });
    };
    // trappe : pivote de `angle` vers `target` à la vitesse `speed` quand la course démarre
    L.door = function (px, py, len, angle, target, speed) {
      L.arms.push({ px: px, py: py, len: len, angle: angle, omega: 0, target: target, openSpeed: speed, t: 6, e: 0.15, kind: 'door' });
    };
    // porte de sas : pivote entre a0 (fermée) et a1 (ouverte) selon un cycle ; zone calme = pas de coup de pouce anti-blocage
    // porte coulissante de sas : segment (a→b) qui glisse de (dx, dy) pour ouvrir, selon un cycle ;
    // zone calme = les billes qui attendent dedans ne reçoivent pas de coup de pouce anti-blocage
    L.gate = function (ax, ay, bx, by, dx, dy, cycle, calm) {
      L.sliders.push({ ax: ax, ay: ay, bx: bx, by: by, dx: dx, dy: dy, t: 6, e: 0.15, kind: 'gate',
        cycle: { period: cycle.period, closed: cycle.closed, move: cycle.move || 0.4, off: cycle.off || 0 } });
      if (calm) L.calm.push(calm);
    };
    // booster posé sur une rampe (de a vers b)
    L.boost = function (ax, ay, bx, by, power) {
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      let nx = dy / len, ny = -dx / len;
      if (ny > 0) { nx = -nx; ny = -ny; }
      L.boosts.push({ ax: ax, ay: ay, bx: bx, by: by, dx: dx / len, dy: dy / len, nx: nx, ny: ny, len: len, power: power });
    };
    // plateau tournant façon boule à facettes : tourne dans un sens puis dans l'autre et projette les billes
    L.turntable = function (x, y, r, spin, freq, ph) {
      L.circles.push({ x: x, y: y, r: r, e: 0.35, kick: 0, kind: 'turntable', spin: spin, freq: freq, ph: ph || 0, omega: 0, angle: 0 });
    };
    // piston d'égaliseur : barre verticale qui sort du sol (base = surface) jusqu'à hmax
    L.piston = function (x, base, hmax, period, phase) {
      L.pistons.push({ x: x, base: base, hmax: hmax, period: period, phase: phase, t: 7, e: 0.25 });
    };
    L.sign = function (text, x, y, size, color) {
      L.signs.push({ text: text, x: x, y: y, size: size, color: color });
    };
    // cases de départ : grille dans l'enclos, de bas en haut, mélangées à chaque course
    L.spawnSlots = function (n) {
      const s = L.spawn, gap = s.gap;
      const cols = Math.floor((s.x1 - s.x0) / gap) + 1;
      const slots = [];
      for (let row = 0; slots.length < Math.max(n, cols) + cols; row++) {
        const y = s.y - row * gap;
        const off = row % 2 ? gap / 2 : 0;
        for (let c = 0; c < cols; c++) {
          const x = s.x0 + off + c * gap;
          if (x <= s.x1) slots.push({ x: x, y: y, row: row });
        }
        if (row > 40) break;
      }
      // remplit d'abord les rangées du bas, mélange à l'intérieur de chaque rangée
      const out = [];
      let row = 0;
      while (out.length < n) {
        const inRow = MR.shuffle(slots.filter(function (p) { return p.row === row; }));
        for (let i = 0; i < inRow.length && out.length < n; i++) out.push(inRow[i]);
        row++;
        if (row > 60) break;
      }
      return MR.shuffle(out);
    };
    return L;
  }
  MR.LevelBuilder = Builder;

  /* ------------------------------------------------------------------ *
   * Niveau 1 — Descente Disco (refait en 0.0.4 d'après le schéma de l'auteur)
   * Enclos à trappes → champ de picots → entonnoir → diamant disco →
   * grand V à pistons d'égaliseur → chicane → entonnoir final → piste lumineuse.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'descente-disco',
    num: 1,
    name: 'Descente Disco',
    build: function () {
      const W = 1600, H = 2840;
      const L = Builder(W, H);
      L.gravity = 1000;
      L.marbleR = 16;

      // cadre : aucune bille ne peut sortir
      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.2 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // enclos de départ + trappes
      const penL = 560, penR = 1040, penTop = 80, penY = 300;
      L.seg(penL, penTop, penL, penY, { kind: 'wall', e: 0.2 });
      L.seg(penR, penTop, penR, penY, { kind: 'wall', e: 0.2 });
      L.door(penL, penY, 240, 0, Math.PI / 2, 7);
      L.door(penR, penY, 240, Math.PI, Math.PI / 2, -7);
      L.spawn = { x0: penL + 26, x1: penR - 26, y: penY - 6 - 17, gap: 34 };
      L.startView = { x: 800, y: 420 };
      L.sign('DÉPART', 800, 44, 30, '#ffcf4a');

      // champ de picots et ses guides
      for (let row = 0; row < 4; row++) {
        const y = 640 + row * 82;
        const off = row % 2 ? 60 : 0;
        for (let x = 260 + off; x <= 1340; x += 120) if (x > 270 && x < 1330) L.peg(x, y, 11);
      }
      L.seg(220, 520, 220, 950, { kind: 'wall', e: 0.35 });
      L.seg(1380, 520, 1380, 950, { kind: 'wall', e: 0.35 });

      // entonnoir sous les picots
      L.seg(220, 950, 725, 1150, { kind: 'disco', e: 0.25 });
      L.seg(1380, 950, 875, 1150, { kind: 'disco', e: 0.25 });

      // diamant disco : les billes tombent sur sa pointe et partent à gauche ou à droite
      L.shape([[800, 1215], [930, 1360], [800, 1560], [670, 1360]], 'diamond', 'diamond');

      // grand V avec pistons d'égaliseur qui retiennent puis relâchent les billes
      const k = 280 / 722;
      const vl = function (x) { return 1440 + x * k; };
      const vr = function (x) { return 1440 + (1600 - x) * k; };
      L.seg(0, 1440, 722, vl(722), { kind: 'disco', e: 0.25 });
      L.seg(1600, 1440, 878, vr(878), { kind: 'disco', e: 0.25 });
      [470, 570, 660].forEach(function (x, i) { L.piston(x, vl(x), 40, 1.3, i * 0.9); });
      [1130, 1030, 940].forEach(function (x, i) { L.piston(x, vr(x), 40, 1.3, i * 0.9); });
      L.calm.push({ x0: 380, y0: 1560, x1: 1220, y1: 1740 });

      // chicane : à droite sur la rampe du haut, puis à gauche sur celle du bas
      L.seg(0, 1560, 940, 1560 + 940 * k, { kind: 'disco', e: 0.25 });
      L.seg(1600, 1700, 840, 2090, { kind: 'disco', e: 0.25 });

      // entonnoir final (faire la queue avant l'arrivée n'est pas être coincé)
      const my = 2400;
      L.calm.push({ x0: 0, y0: 2080, x1: 1600, y1: my + 20 });
      L.seg(0, 2100, 700, my, { kind: 'funnel', e: 0.25 });
      L.seg(1600, 2140, 900, my, { kind: 'funnel', e: 0.25 });
      // bassin d'arrivée
      L.poly([[700, my], [260, my + 130], [260, H]], { kind: 'finish', e: 0.3 });
      L.poly([[900, my], [1340, my + 130], [1340, H]], { kind: 'finish', e: 0.3 });
      L.voids.push([[0, 2100], [700, my], [260, my + 130], [260, H], [0, H]]);
      L.voids.push([[1600, 2140], [900, my], [1340, my + 130], [1340, H], [1600, H]]);

      L.finish = {
        y: my + 25,
        mouth: { x0: 700, x1: 900, y: my },
        basin: [[700, my], [900, my], [1340, my + 130], [1340, H - 10], [260, H - 10], [260, my + 130]],
        box: { x0: 260, x1: 1340, y0: my, y1: H - 10 },
        label: { text: 'ARRIVÉE', x: 800, y: my + 210, size: 64 }
      };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 2 — La Grande Roue (0.0.4, rallongé en 0.2.0)
   * Enclos → 4 rampes accélérées en zigzag → SAS DISCO (regroupement) → grande roue → ascenseur →
   * pluie de picots → rampes du bas → VESTIAIRE (regroupement) → bumpers → arrivée.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'grande-roue',
    num: 2,
    name: 'La Grande Roue',
    build: function () {
      const W = 2600, H = 2820;
      const L = Builder(W, H);
      L.gravity = 1000;
      L.marbleR = 16;

      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.2 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // parcours suivi par le classement (centre de la piste, dans l'ordre)
      L.path = [[300, 150], [300, 480], [860, 515], [960, 560], [1050, 615], [1000, 700], [900, 708], [160, 742], [60, 790], [28, 850], [90, 925],
        [140, 932], [860, 960], [960, 1005], [1050, 1060], [1000, 1150], [900, 1153], [160, 1188], [60, 1235], [28, 1300], [90, 1372],
        [140, 1377], [1340, 1420], [1440, 1490], [1580, 1530], [1740, 1490], [1850, 1420], [1960, 1440], [1960, 800], [2060, 750], [2180, 820],
        [2300, 950], [2300, 1480], [2295, 1580], [2280, 1625], [1270, 1730], [1170, 1820], [1140, 1880], [1200, 1950], [1260, 1915],
        [2100, 1940], [2210, 2020], [2290, 2080], [2230, 2165], [2140, 2135], [1150, 2160], [1050, 2245], [950, 2295], [950, 2400], [950, 2530]];

      // enclos de départ
      L.seg(120, 40, 120, 260, { kind: 'wall', e: 0.2 });
      L.seg(480, 40, 480, 260, { kind: 'wall', e: 0.2 });
      L.door(120, 260, 180, 0, Math.PI / 2, 7);
      L.door(480, 260, 180, Math.PI, Math.PI / 2, -7);
      L.spawn = { x0: 146, x1: 454, y: 260 - 6 - 17, gap: 34 };
      L.startView = { x: 700, y: 520 };
      L.sign('DÉPART', 650, 150, 28, '#ffcf4a');

      // zigzag : quatre rampes accélérées reliées par des demi-tours
      L.seg(0, 500, 860, 530, { kind: 'disco', e: 0.25 });
      L.boost(20, 500 + 20 * 30 / 860, 780, 500 + 780 * 30 / 860, 650);
      L.arc(930, 600, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      L.seg(908, 724, 150, 760, { kind: 'disco', e: 0.25 });
      L.boost(935, 724 - 27 * 36 / 758, 260, 724 + 648 * 36 / 758, 650);
      L.arc(140, 820, 125, 260, 100, 14, { kind: 'wall', e: 0.2 });
      L.seg(118, 945, 860, 975, { kind: 'wave', e: 0.25 });
      L.boost(300, 945 + 182 * 30 / 742, 780, 945 + 662 * 30 / 742, 520);
      L.arc(930, 1045, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      L.seg(908, 1169, 150, 1205, { kind: 'wave', e: 0.25 });
      L.boost(935, 1169 - 27 * 36 / 758, 300, 1169 + 608 * 36 / 758, 520);
      L.arc(140, 1265, 125, 260, 100, 14, { kind: 'wall', e: 0.2 });
      L.sign('ZIGZAG', 520, 860, 26, '#3ff0ff');

      // couloir vers la roue, fermé par le SAS DISCO : la porte s'enfonce dans le sol quand le peloton est là
      const yc = function (x) { return 1390 + (x - 118) * 45 / 1225; };
      L.seg(118, 1390, 1343, 1435, { kind: 'disco', e: 0.25 });
      L.hold(640, 1196, 640, yc(640) - 8, 0, 222, { x0: 0, y0: 1200, x1: 652, y1: 1420 },
        { pv: L.pathPos(640, yc(640)), label: { x: 400, y: 1320 } });
      L.boost(700, yc(700), 1200, yc(1200), 300);
      L.sign('SAS DISCO', 330, 1250, 24, '#ff6ac1');

      // la grande roue : carter ouvert à gauche (entrée) et à droite (sortie), 4 rayons qui tournent
      const cx = 1580, cy = 1205, R = 330;
      L.arc(cx, cy, R, 40, 136, 12, { kind: 'wall', e: 0.2 });
      L.arc(cx, cy, R, 215, 338, 14, { kind: 'wall', e: 0.2 });
      L.rotor(cx, cy, 312, 4, -1.1, 0.3, 58, 'wheel');
      L.sign('GRANDE ROUE', 1500, 775, 30, '#ff6ac1');

      // ascenseur : couloir vertical qui propulse les billes vers le haut, capot qui les renvoie à droite
      L.seg(1886, 1081, 1910, 885, { kind: 'wall', e: 0.3 });
      L.arc(2040, 885, 130, 180, 350, 12, { kind: 'wall', e: 0.3 });
      L.seg(1833, 1417, 2030, 1495, { kind: 'wall', e: 0.25 });
      L.seg(2030, 965, 2030, 1495, { kind: 'wall', e: 0.3 });
      L.zone(1915, 775, 2024, 1490, 0, -2300);

      // pluie de picots, bumpers en bas
      L.seg(2560, 695, 2545, 1405, { kind: 'wall', e: 0.35 });
      for (let row = 0; row < 5; row++) {
        const y = 1005 + row * 72;
        const off = row % 2 ? 42 : 0;
        // pas de picot collé au mur de droite (une bille s'y coinçait)
        for (let x = 2085 + off; x <= 2470; x += 85) L.peg(x, y, 10);
      }
      L.bumper(2130, 1375, 24, 230);
      L.bumper(2460, 1357, 24, 230);
      L.bumper(2295, 1420, 20, 200);
      L.sign('PLUIE DE PICOTS', 2300, 915, 22, '#c08bff');
      L.seg(2030, 1495, 2225, 1545, { kind: 'funnel', e: 0.25 });
      L.seg(2545, 1405, 2365, 1545, { kind: 'funnel', e: 0.25 });

      // rampes du bas : à gauche, demi-tour, à droite, demi-tour, à gauche (de la place sous la sortie des picots)
      const yh = function (x) { return 1650 + (2600 - x) * 100 / 1330; };
      L.seg(2600, 1650, 1270, 1750, { kind: 'disco', e: 0.25 });
      L.boost(2580, yh(2580), 1400, yh(1400), 620);
      L.arc(1260, 1810, 125, 260, 100, 14, { kind: 'wall', e: 0.2 });
      L.seg(1238, 1935, 2100, 1960, { kind: 'wave', e: 0.25 });
      L.boost(1350, 1935 + 112 * 25 / 862, 2020, 1935 + 782 * 25 / 862, 480);
      L.arc(2170, 2030, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      const yj = function (x) { return 2154 + (2148 - x) * 24 / 998; };
      L.seg(2148, 2154, 1150, 2178, { kind: 'disco', e: 0.25 });
      L.boost(2175, yj(2175), 1250, yj(1250), 450);
      L.sign('DESCENTE', 1700, 1830, 24, '#ffcf4a');

      // VESTIAIRE : bac de regroupement, la trappe du fond glisse quand le peloton est là
      L.seg(720, 2065, 720, 2205, { kind: 'wall', e: 0.3 });
      L.seg(720, 2205, 870, 2287, { kind: 'wall', e: 0.25 });
      L.seg(1250, 2205, 1030, 2287, { kind: 'wall', e: 0.25 });
      L.seg(1250, yj(1250) + 11, 1250, 2205, { kind: 'wall', e: 0.25 });
      L.hold(864, 2295, 1036, 2295, -170, 0, { x0: 700, y0: 2055, x1: 1260, y1: 2305 },
        { pv: L.pathPos(950, 2295), label: { x: 960, y: 2110 } });
      L.sign('VESTIAIRE', 960, 2045, 22, '#3ff0ff');

      // finale : bumpers au-dessus de l'entonnoir d'arrivée (bords épais, large ouverture)
      L.bumper(790, 2395, 24, 230, true);
      L.bumper(1110, 2395, 24, 230, true);
      L.bumper(950, 2445, 18, 180, true);
      const my = 2540;
      L.calm.push({ x0: 440, y0: 2420, x1: 1460, y1: my + 20 });
      L.seg(440, 2135, 440, 2350, { kind: 'wall', t: 10, e: 0.3 });
      L.seg(1460, yj(1460) + 12, 1460, 2350, { kind: 'wall', t: 10, e: 0.3 });
      L.seg(440, 2350, 860, my, { kind: 'funnel', t: 12, e: 0.25 });
      L.seg(1460, 2350, 1040, my, { kind: 'funnel', t: 12, e: 0.25 });
      L.poly([[860, my], [660, my + 80], [660, H]], { kind: 'finish', t: 12, e: 0.3 });
      L.poly([[1040, my], [1240, my + 80], [1240, H]], { kind: 'finish', t: 12, e: 0.3 });
      L.voids.push([[0, 2350], [440, 2350], [860, my], [660, my + 80], [660, H], [0, H]]);
      L.voids.push([[1460, 2350], [2600, 2350], [2600, H], [1240, H], [1240, my + 80], [1040, my]]);

      // niveau large : la caméra zoome et suit la course
      L.camera = { fit: 'min', viewW: 1300, viewH: 800, span: 850, ahead: 0.04 };
      L.finish = {
        y: my + 25,
        mouth: { x0: 860, x1: 1040, y: my },
        basin: [[860, my], [1040, my], [1240, my + 80], [1240, H - 10], [660, H - 10], [660, my + 80]],
        box: { x0: 660, x1: 1240, y0: my, y1: H - 10 },
        label: { text: 'ARRIVÉE', x: 950, y: 2700, size: 40 }
      };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 3 — Plage Disco (0.1.0, plus pêchu en 0.2.0) : long parcours sur fond de plage de nuit
   * Départ → Promenade (bumpers) → Vagues → Bar de plage (regroupement) → Toboggan → Dance floor →
   * Cocotiers (regroupement) → La Jetée (trampolines) → Concert (regroupement) → Feu d'artifice → arrivée.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'plage-disco',
    num: 3,
    name: 'Plage Disco',
    build: function () {
      const W = 1600, H = 6990;
      const L = Builder(W, H);
      L.gravity = 1000;
      L.marbleR = 16;
      L.theme = 'beach';

      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.2 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // départ : enclos, picots, entonnoir
      L.seg(560, 80, 560, 300, { kind: 'wall', e: 0.2 });
      L.seg(1040, 80, 1040, 300, { kind: 'wall', e: 0.2 });
      L.door(560, 300, 240, 0, Math.PI / 2, 7);
      L.door(1040, 300, 240, Math.PI, Math.PI / 2, -7);
      L.spawn = { x0: 586, x1: 1014, y: 277, gap: 34 };
      L.startView = { x: 800, y: 420 };
      L.sign('PLAGE DISCO', 800, 44, 30, '#3ff0ff');
      for (let row = 0; row < 4; row++) {
        const y = 640 + row * 82, off = row % 2 ? 60 : 0;
        for (let x = 260 + off; x <= 1340; x += 120) {
          if (x < 270 || x > 1330) continue;
          if (row === 1 && (x === 560 || x === 1040)) L.bumper(x, y, 15, 170, true);
          else L.peg(x, y, 11);
        }
      }
      L.seg(220, 520, 220, 950, { kind: 'wall', e: 0.35 });
      L.seg(1380, 520, 1380, 950, { kind: 'wall', e: 0.35 });
      L.seg(220, 950, 725, 1150, { kind: 'disco', e: 0.25 });
      L.seg(1380, 950, 875, 1150, { kind: 'disco', e: 0.25 });

      // la Promenade : deux rampes accélérées, bumpers dans la chute entre les deux
      L.seg(520, 1240, 1420, 1330, { kind: 'disco', e: 0.25 });
      L.boost(640, 1240 + 120 * 90 / 900, 1340, 1240 + 820 * 90 / 900, 380);
      L.bumper(1500, 1385, 22, 210, true);
      const y2 = function (x) { return 1480 + (1600 - x) * 150 / 1420; };
      L.seg(1600, 1480, 180, 1630, { kind: 'ramp', e: 0.25 });
      L.boost(1300, y2(1300), 500, y2(500), 520);
      L.sign('PROMENADE', 1000, 1420, 26, '#ffcf4a');

      // les Vagues : rampe ondulée, poussée tout du long
      L.wavy(0, 1780, 1420, 1930, 10, 220, 52, { kind: 'wave', e: 0.25 });
      L.boost(120, 1780 + 120 * 150 / 1420, 1340, 1780 + 1340 * 150 / 1420, 260);
      L.bumper(1510, 1975, 20, 200, true);
      L.sign('VAGUES', 700, 1700, 28, '#3ff0ff');

      // Bar de plage : bac de regroupement, la trappe s'ouvre quand le peloton est arrivé
      L.seg(240, 1990, 240, 2120, { kind: 'wall', e: 0.3 });
      L.seg(240, 2120, 640, 2320, { kind: 'wall', e: 0.25 });
      L.seg(1600, 2060, 960, 2320, { kind: 'disco', e: 0.25 });
      L.hold(636, 2328, 964, 2328, -330, 0, { x0: 240, y0: 2000, x1: 1600, y1: 2345 }, { label: { x: 800, y: 2160 } });
      L.sign('BAR DE PLAGE', 620, 2060, 26, '#ff6ac1');

      // Toboggan : rampes accélérées et trois demi-tours
      L.seg(480, 2440, 1000, 2470, { kind: 'disco', e: 0.25 });
      L.boost(560, 2440 + 80 * 30 / 520, 940, 2440 + 460 * 30 / 520, 420);
      L.arc(1070, 2540, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      const yt2 = function (x) { return 2664 + (1048 - x) * 36 / 628; };
      L.seg(1048, 2664, 420, 2700, { kind: 'wave', e: 0.25 });
      L.boost(1075, yt2(1075), 520, yt2(520), 480);
      L.arc(410, 2760, 125, 260, 100, 14, { kind: 'wall', e: 0.2 });
      const yt3 = function (x) { return 2884 + (x - 388) * 36 / 662; };
      L.seg(388, 2884, 1050, 2920, { kind: 'wave', e: 0.25 });
      L.boost(480, yt3(480), 960, yt3(960), 480);
      L.arc(1120, 2990, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      L.seg(1098, 3114, 420, 3150, { kind: 'wave', e: 0.25 });
      L.boost(1125, 3114 - 27 * 36 / 678, 520, 3114 + 578 * 36 / 678, 420);
      L.sign('TOBOGGAN', 1380, 2700, 28, '#ffcf4a');

      // Dance floor : piste accélérée sous des bumpers lumineux, entonnoir, boule à facettes tournante
      L.seg(100, 3170, 100, 3240, { kind: 'wall', e: 0.3 });
      const yp = function (x) { return 3240 + (x - 100) * 86 / 800; };
      L.seg(100, 3240, 900, 3326, { kind: 'ramp', e: 0.25 });
      L.boost(140, yp(140), 860, yp(860), 420);
      [360, 560, 760].forEach(function (x) { L.bumper(x, yp(x) - 72, 15, 150, true); });
      L.seg(840, 3400, 985, 3480, { kind: 'disco', e: 0.25 });
      L.seg(1300, 3360, 1145, 3480, { kind: 'disco', e: 0.25 });
      L.turntable(1065, 3570, 44, 3.4, 0.8, 0.6);
      L.sign('DANCE FLOOR', 1360, 3230, 26, '#ff3ea5');

      // Cocotiers : grand V à bumpers, fermé par une trappe de regroupement
      L.seg(0, 3700, 640, 3949, { kind: 'disco', e: 0.25 });
      L.seg(1600, 3700, 960, 3949, { kind: 'disco', e: 0.25 });
      L.bumper(300, 3745, 24, 220, true);
      L.bumper(1300, 3745, 24, 220, true);
      L.bumper(560, 3800, 20, 200, true);
      L.bumper(1040, 3800, 20, 200, true);
      L.hold(636, 3957, 964, 3957, -340, 0, { x0: 0, y0: 3690, x1: 1600, y1: 3970 }, { label: { x: 800, y: 3860 } });
      L.sign('COCOTIERS', 800, 3730, 26, '#4ee08a');

      // La Jetée : rampe, vagues, trampolines, bumper, longue rampe accélérée
      L.seg(560, 4090, 1420, 4180, { kind: 'ramp', e: 0.25 });
      L.boost(640, 4090 + 80 * 90 / 860, 1340, 4090 + 780 * 90 / 860, 380);
      L.wavy(1600, 4330, 180, 4480, 10, 220, 52, { kind: 'wave', e: 0.25 });
      L.boost(1500, 4330 + 100 * 150 / 1420, 300, 4330 + 1300 * 150 / 1420, 300);
      L.tramp(14, 4600, 250, 4690, 120);
      L.seg(240, 4745, 1420, 4800, { kind: 'ramp', e: 0.25 });
      L.boost(400, 4745 + 160 * 55 / 1180, 1340, 4745 + 1100 * 55 / 1180, 420);
      L.bumper(1535, 4955, 20, 160, true);
      const yj4 = function (x) { return 5040 + (1600 - x) * 120 / 1420; };
      L.seg(1600, 5040, 180, 5160, { kind: 'ramp', e: 0.25 });
      L.boost(1300, yj4(1300), 400, yj4(400), 480);
      L.sign('LA JETÉE', 800, 4260, 28, '#ffcf4a');
      L.sign('TRAMPOLINES', 760, 4650, 20, '#3ff0ff');

      // Concert : bac de regroupement contre le mur gauche
      L.seg(470, 5150, 470, 5200, { kind: 'wall', e: 0.3 });
      L.seg(470, 5200, 330, 5320, { kind: 'wall', e: 0.25 });
      L.hold(12, 5328, 334, 5328, 330, 0, { x0: 0, y0: 5090, x1: 480, y1: 5340 }, { label: { x: 250, y: 5130 } });
      L.sign('CONCERT', 900, 5250, 30, '#c08bff');

      // Feu d'artifice : picots et bumpers qui éclatent en couleurs, au-dessus de l'entonnoir final
      L.seg(0, 5440, 760, 5522, { kind: 'ramp', e: 0.25 });
      for (let row = 0; row < 5; row++) {
        const y = 5640 + row * 80, off = row % 2 ? 60 : 0;
        for (let x = 320 + off; x <= 1280; x += 120) {
          if (x < 330 || x > 1270) continue;
          if ((row === 1 || row === 3) && (x === 560 || x === 800 || x === 1040)) L.bumper(x, y, 15, 120, true);
          else L.peg(x, y, 11);
        }
      }
      L.seg(270, 5560, 270, 6020, { kind: 'wall', e: 0.35 });
      L.seg(1330, 5560, 1330, 6020, { kind: 'wall', e: 0.35 });
      L.sign('FEU D’ARTIFICE', 1060, 5480, 24, '#ff9f2e');

      const my = 6550;
      L.calm.push({ x0: 0, y0: 6240, x1: 1600, y1: my + 20 });
      L.seg(0, 6250, 700, my, { kind: 'funnel', e: 0.25 });
      L.seg(1600, 6290, 900, my, { kind: 'funnel', e: 0.25 });
      L.bumper(520, 6400, 24, 220, true);
      L.bumper(1080, 6405, 24, 220, true);
      L.bumper(800, 6460, 18, 180, true);
      L.poly([[700, my], [260, my + 130], [260, H]], { kind: 'finish', e: 0.3 });
      L.poly([[900, my], [1340, my + 130], [1340, H]], { kind: 'finish', e: 0.3 });
      L.voids.push([[0, 6250], [700, my], [260, my + 130], [260, H], [0, H]]);
      L.voids.push([[1600, 6290], [900, my], [1340, my + 130], [1340, H], [1600, H]]);
      L.finish = {
        y: my + 25,
        mouth: { x0: 700, x1: 900, y: my },
        basin: [[700, my], [900, my], [1340, my + 130], [1340, H - 10], [260, H - 10], [260, my + 130]],
        box: { x0: 260, x1: 1340, y0: my, y1: H - 10 },
        label: { text: 'ARRIVÉE', x: 800, y: my + 210, size: 64 }
      };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 4 — Les Cercles (0.2.0, d'après le schéma de l'auteur) : survie sur la plage disco.
   * Autant de cercles que de billes moins une, tous de tailles différentes, qui tournent. Les billes partent du milieu ;
   * une bille qui passe par le trou du plus petit cercle explose et ce cercle se brise. La dernière bille gagne.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'cercles',
    num: 4,
    name: 'Les Cercles',
    perCount: true,
    build: function (count) {
      const n = Math.max(1, Math.min(MR.MAX_MARBLES, count || (MR.Game && MR.Game.roster ? MR.Game.roster.length : 10)));
      const r = 14, rings = n - 1, dR = 20;
      const R0 = Math.max(120, r * (2.2 + 1.3 * Math.sqrt(n)));
      const outer = R0 + Math.max(0, rings - 1) * dR;
      const half = Math.ceil(outer + 260);
      const W = half * 2, H = half * 2, cx = half, cy = half;
      const L = Builder(W, H);
      const T = MR.L4 || {};   // réglages de test
      // pas de gravité : les billes rebondissent sur les cercles sans perdre de vitesse
      L.gravity = 0;
      L.elastic = true;
      L.lockUntilStart = true;
      L.speed = T.speed || 520;
      L.speedPerR = T.perR || 1.3;
      L.openDelay = T.open || 0.35;
      L.marbleR = r;
      L.theme = 'beach';
      L.mode = 'survival';
      L.elim = true;
      L.noStuck = true;
      L.timeLimit = 900;
      L.beatKick = T.kick || 220;
      L.beatEvery = T.every || 2;
      L.hunt = T.hunt || 2.6;
      L.center = { x: cx, y: cy };
      L.ringR0 = R0;
      L.outerR = outer;
      L.startView = { x: cx, y: cy };

      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // les cercles : arc-en-ciel néon de l'intérieur vers l'extérieur, trou d'environ 3,4 billes de large
      L.rings = [];
      for (let k = 0; k < rings; k++) {
        const R = R0 + k * dR;
        const hue = (k * 360 / Math.max(6, Math.min(rings, 24)) + 300) % 360;
        // tous les trous partent vers le haut ; chaque cercle tourne 1,045× plus vite que le précédent (59 cercles max : ×12,9 au dernier)
        L.rings.push({ cx: cx, cy: cy, R: R, t: 5, gap: Math.max((r * 2.1 + 4) / R, T.gapA || 0.19), angle: -Math.PI / 2,
          omega: (T.w0 || 0.26) * Math.pow(1.045, k), e: 1, hue: hue, rgb: hsl(hue, 0.95, 0.6) });
      }
      // départ au milieu : grille hexagonale serrée dans le plus petit cercle
      L.spawnSlots = function (k) {
        const pts = [], g = r * 2 + 3, lim = R0 - r - 8;
        for (let j = -20; j <= 20; j++) {
          for (let i = -20; i <= 20; i++) {
            const x = (i + (j & 1) * 0.5) * g, y = j * g * 0.866;
            if (x * x + y * y <= lim * lim) pts.push({ x: cx + x, y: cy + y, d: x * x + y * y });
          }
        }
        pts.sort(function (a, b) { return a.d - b.d; });
        const out = pts.slice(0, k);
        while (out.length < k) out.push({ x: cx + MR.rand(-20, 20), y: cy + MR.rand(-20, 20) });
        return MR.shuffle(out);
      };
      L.spawn = { x0: cx - R0, x1: cx + R0, y: cy, gap: 30 };
      L.sign('LES CERCLES', cx, cy - outer - 110, 44, '#3ff0ff');
      L.sign('LE DERNIER EN VIE GAGNE', cx, cy + outer + 110, 26, '#ffcf4a');
      // pas de zone d'arrivée : la boîte sert aux confettis et à la caméra
      L.finish = { y: Infinity, none: true, box: { x0: cx - R0, x1: cx + R0, y0: cy - R0, y1: cy + R0 } };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 5 — Soleil Levant (0.2.3, refait symétrique en 0.2.4) : flipper éliminatoire au lever du soleil.
   * Les billes tombent de l'enclos dans la salle (bumpers, picots, roues, triangles), ressortent par le bas sur le toit,
   * remontent par les couloirs accélérés et retombent dans la salle. Les destructeurs bleus font exploser les billes ;
   * la dernière en vie gagne. Tout est tracé côté gauche puis reflété à l'identique côté droit.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'soleil-levant',
    num: 5,
    zone: 'disco',
    name: 'Soleil Levant',
    build: function () {
      // repère du schéma (553 × 873), × 3 ; l'axe de symétrie est au milieu
      const X = function (x) { return (x - 10) * 3; }, Y = function (y) { return (y - 8) * 3; };
      const W = X(545), H = Y(865), MX = function (x) { return 555 - x; };
      const L = Builder(W, H);
      L.gravity = 1000;
      L.marbleR = 15;
      L.theme = 'sunrise';
      L.mode = 'arena';
      L.elim = true;
      L.timeLimit = 600;
      const T = MR.L5 || {};   // réglages de test
      L.overtime = T.over || 100;
      L.sawGrow = T.grow || 2.5;
      L.sawMax = 2.4;
      // chaque élément de gauche et son reflet à droite
      const both = function (fn, x1, y1, x2, y2, a, b) { fn(x1, y1, x2, y2, a, b); fn(MX(x1), y1, MX(x2), y2, a, b); };
      const wall = function (x1, y1, x2, y2) { L.seg(X(x1), Y(y1), X(x2), Y(y2), { kind: 'wall', e: 0.35 }); };
      const sling = function (x1, y1, x2, y2, k) { L.sling(X(x1), Y(y1), X(x2), Y(y2), k); };
      const killer = function (x1, y1, x2, y2) { L.killer(X(x1), Y(y1), X(x2), Y(y2)); };

      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.2 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // enclos de départ centré et ses trappes
      both(wall, 207, 14, 207, 75);
      const half = (X(348) - X(207)) / 2;
      L.door(X(207), Y(75), half, 0, Math.PI / 2, 7);
      L.door(X(348), Y(75), half, Math.PI, Math.PI / 2, -7);
      L.spawn = { x0: X(207) + 22, x1: X(348) - 22, y: Y(75) - 6 - 16, gap: 31 };
      L.startView = { x: W / 2, y: 620 };

      // la salle (murs verts)
      both(wall, 103, 150, 142, 112);
      both(wall, 103, 150, 108, 620);
      both(wall, 108, 620, 126, 636);
      both(wall, 126, 636, 200, 576);
      // le toit sous la salle, les couloirs extérieurs et leurs pans du haut
      L.poly([[X(10), Y(748)], [X(58), Y(748)], [X(277.5), Y(596)], [X(497), Y(748)], [X(545), Y(748)]], { kind: 'wall', e: 0.3 });
      both(wall, 10, 163, 95, 8);
      // couloirs accélérés (flèches jaunes) sur toute la hauteur, puis poussée vers la salle tout en haut
      L.zone(X(10), Y(110), X(100), Y(748), 0, -2700);
      L.zone(X(455), Y(110), X(545), Y(748), 0, -2700);
      L.zone(X(10), Y(8), X(150), Y(118), T.side || 2600, -800);
      L.zone(X(405), Y(8), X(545), Y(118), -(T.side || 2600), -800);
      // poches du bas de la salle : elles renvoient les billes vers le haut
      L.zone(X(116), Y(560), X(180), Y(632), 900, -2600);
      L.zone(X(375), Y(560), X(439), Y(632), -900, -2600);

      // bumpers ronds et picots
      L.bumper(X(277.5), Y(126), 56, 280);
      L.bumper(X(172), Y(133), 30, 240); L.bumper(X(MX(172)), Y(133), 30, 240);
      L.bumper(X(214), Y(192), 24, 220); L.bumper(X(MX(214)), Y(192), 24, 220);
      [[205, 156], [162, 192], [203, 234]].forEach(function (q) { L.peg(X(q[0]), Y(q[1]), 11); L.peg(X(MX(q[0])), Y(q[1]), 11); });
      L.peg(X(277.5), Y(176), 11); L.peg(X(277.5), Y(226), 11);
      // petits triangles du haut : rebondissants, sans destructeur
      both(sling, 103, 150, 133, 172, 400);
      both(wall, 133, 172, 106, 198);
      // coupes pièges : demi-cercle vert, courte lame bleue au fond
      L.arc(X(172), Y(272), 46, 0, 180, 10, { kind: 'wall', e: 0.3 });
      L.arc(X(MX(172)), Y(272), 46, 0, 180, 10, { kind: 'wall', e: 0.3 });
      killer(165, 281, 180, 281); killer(MX(180), 281, MX(165), 281);
      // deux roues qui tournent en miroir (violet)
      L.rotor(X(200), Y(335), 105, 4, 1.5, 0.2, 14, 'wheel');
      L.rotor(X(MX(200)), Y(335), 105, 4, -1.5, Math.PI - 0.2, 14, 'wheel');
      // grands triangles : bord rebondissant, destructeur seulement au milieu de la face du bas
      both(sling, 106, 348, 175, 381, 460);
      both(wall, 175, 381, 108, 416);
      both(killer, 158, 389, 128, 405);
      // barres rebondissantes et scie destructrice au centre
      sling(240, 382, 315, 382, 300);
      sling(277.5, 413, 277.5, 460, 300); sling(277.5, 504, 277.5, 556, 300);
      L.saw(X(277.5), Y(482), 32);
      L.sign('LA DERNIÈRE BILLE EN VIE GAGNE', X(277.5), Y(800), 34, '#ffb347');
      L.finish = { y: Infinity, none: true, box: { x0: X(103), x1: X(452), y0: Y(110), y1: Y(620) } };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 6 — Beach Party (0.2.5) : la plage au lever du soleil.
   * Bols en cascade → pistes de danse en zigzag (les dalles font sauter les billes sur le temps) → engrenage →
   * aiguillage (picots à gauche, trampolines à droite) → boule à facettes géante → bar (regroupement) → arrivée.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'beach-party',
    num: 6,
    zone: 'disco',
    name: 'Beach Party',
    build: function () {
      const W = 1600, H = 5330;
      const L = Builder(W, H);
      L.gravity = 1000;
      L.marbleR = 16;
      L.theme = 'sunrise';
      const T = MR.L6 || {};
      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.2 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // départ
      L.seg(560, 80, 560, 300, { kind: 'wall', e: 0.2 });
      L.seg(1040, 80, 1040, 300, { kind: 'wall', e: 0.2 });
      L.door(560, 300, 240, 0, Math.PI / 2, 7);
      L.door(1040, 300, 240, Math.PI, Math.PI / 2, -7);
      L.spawn = { x0: 586, x1: 1014, y: 277, gap: 34 };
      L.startView = { x: 800, y: 440 };
      L.sign('BEACH PARTY', 800, 44, 30, '#ffb347');

      // bols en cascade : chaque bol est percé au fond et déborde sur les côtés
      const bowl = function (cx, cy, R) {
        L.arc(cx, cy, R, 14, 76, 6, { kind: 'disco', e: 0.25 });
        L.arc(cx, cy, R, 104, 166, 6, { kind: 'disco', e: 0.25 });
      };
      L.seg(140, 330, 140, 1170, { kind: 'wall', e: 0.35 });
      L.seg(1460, 330, 1460, 1170, { kind: 'wall', e: 0.35 });
      bowl(800, 470, 150);
      bowl(520, 720, 140); bowl(1080, 720, 140);
      bowl(340, 970, 130); bowl(800, 970, 130); bowl(1260, 970, 130);
      L.peg(800, 690, 12); L.peg(330, 790, 12); L.peg(1270, 790, 12);
      L.seg(140, 1160, 700, 1330, { kind: 'funnel', e: 0.25 });
      L.seg(1460, 1160, 900, 1330, { kind: 'funnel', e: 0.25 });

      // pistes de danse en zigzag : les dalles font sauter les billes sur chaque temps
      const K = T.pad || 200;
      L.seg(280, 1213, 280, 1320, { kind: 'wall', e: 0.3 });
      L.arc(360, 1320, 80, 90, 180, 6, { kind: 'disco', e: 0.2 });
      L.danceFloor(360, 1400, 1300, 1500, 10, K);
      L.boost(360, 1400, 900, 1457.4, 140);
      L.arc(1370, 1570, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      L.boost(1375, 1694, 1150, 1711, 420);
      L.danceFloor(1348, 1694, 300, 1774, 10, K);
      L.arc(290, 1834, 125, 260, 100, 14, { kind: 'wall', e: 0.2 });
      L.danceFloor(268, 1959, 1300, 2039, 10, K);
      L.arc(1370, 2109, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      L.boost(1375, 2233, 1150, 2250, 420);
      L.danceFloor(1348, 2233, 520, 2300, 8, K);
      L.hood(1370, 1570, 1); L.hood(290, 1834, -1); L.hood(1370, 2109, 1);
      L.sign('DANCE FLOOR', 800, 1660, 26, '#ff6ac1');

      // engrenage doré qui tourne et lance les billes
      L.seg(380, 2370, 640, 2440, { kind: 'disco', e: 0.25 });
      L.seg(300, 1962, 300, 2900, { kind: 'wall', e: 0.35 });
      L.seg(1300, 2400, 1300, 2900, { kind: 'wall', e: 0.35 });
      L.gear(800, 2650, 150, 14, 0.85, 0.1);
      L.seg(300, 2900, 700, 3030, { kind: 'funnel', e: 0.25 });
      L.seg(1300, 2900, 900, 3030, { kind: 'funnel', e: 0.25 });

      // aiguillage : le volet envoie les billes à gauche (picots) puis à droite (trampolines)
      L.flap(800, 3085, 120, Math.PI / 2 - 0.7, Math.PI / 2 + 0.7, 2.4, 0);
      L.seg(200, 3060, 200, 3700, { kind: 'wall', e: 0.35 });
      L.seg(1400, 3060, 1400, 3700, { kind: 'wall', e: 0.35 });
      L.seg(800, 3205, 800, 3640, { kind: 'wall', e: 0.35 });
      for (let row = 0; row < 5; row++) {
        const y = 3270 + row * 72, off = row % 2 ? 40 : 0;
        for (let x = 280 + off; x <= 730; x += 80) L.peg(x, y, 11);
      }
      L.tramp(830, 3270, 1120, 3335, 200);
      L.tramp(1375, 3440, 1090, 3505, 200);
      L.tramp(808, 3586, 1110, 3640, 180);
      L.seg(200, 3700, 700, 3820, { kind: 'funnel', e: 0.25 });
      L.seg(1400, 3700, 900, 3820, { kind: 'funnel', e: 0.25 });
      L.seg(200, 3060, 700, 3030, { kind: 'wall', e: 0.3 });
      L.seg(1400, 3060, 900, 3030, { kind: 'wall', e: 0.3 });

      // boule à facettes géante
      L.seg(200, 3830, 200, 4290, { kind: 'wall', e: 0.35 });
      L.seg(1400, 3830, 1400, 4290, { kind: 'wall', e: 0.35 });
      L.mirrorBall(800, 4070, 120, 2.2, 110);
      L.bumper(470, 3990, 26, 230); L.bumper(1130, 3990, 26, 230);
      L.bumper(560, 4210, 22, 210); L.bumper(1040, 4210, 22, 210);

      // bar : bac de regroupement, puis finale
      L.seg(200, 4290, 640, 4470, { kind: 'disco', e: 0.25 });
      L.seg(1400, 4290, 960, 4470, { kind: 'disco', e: 0.25 });
      L.hold(636, 4478, 964, 4478, -340, 0, { x0: 200, y0: 4280, x1: 1400, y1: 4492 }, { label: { x: 800, y: 4380 } });
      L.bumper(560, 4650, 24, 220, true); L.bumper(1040, 4650, 24, 220, true); L.bumper(800, 4730, 18, 180, true);
      const my = 4890;
      L.calm.push({ x0: 0, y0: 4560, x1: 1600, y1: my + 20 });
      L.seg(0, 4560, 700, my, { kind: 'funnel', e: 0.25 });
      L.seg(1600, 4560, 900, my, { kind: 'funnel', e: 0.25 });
      L.poly([[700, my], [260, my + 130], [260, H]], { kind: 'finish', e: 0.3 });
      L.poly([[900, my], [1340, my + 130], [1340, H]], { kind: 'finish', e: 0.3 });
      L.voids.push([[0, 4560], [700, my], [260, my + 130], [260, H], [0, H]]);
      L.voids.push([[1600, 4560], [900, my], [1340, my + 130], [1340, H], [1600, H]]);
      L.finish = {
        y: my + 25,
        mouth: { x0: 700, x1: 900, y: my },
        basin: [[700, my], [900, my], [1340, my + 130], [1340, H - 10], [260, H - 10], [260, my + 130]],
        box: { x0: 260, x1: 1340, y0: my, y1: H - 10 },
        label: { text: 'ARRIVÉE', x: 800, y: my + 210, size: 64 }
      };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 7 — Le Club (0.2.5) : dans la discothèque, tout bouge en rythme.
   * Escaliers lumineux → platines vinyles → fosse aux enceintes (souffle sur le temps) →
   * rampes coupées par des lasers en rythme → piste de danse finale sous la boule à facettes → arrivée.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'le-club',
    num: 7,
    zone: 'disco',
    name: 'Le Club',
    build: function () {
      const W = 1600, H = 4250, o = 190;
      const L = Builder(W, H);
      L.gravity = 1000;
      L.marbleR = 16;
      L.theme = 'club';
      const T = MR.L7 || {};
      const mir = function (x) { return W - x; };
      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.2 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // départ
      L.seg(560, 80, 560, 300, { kind: 'wall', e: 0.2 });
      L.seg(1040, 80, 1040, 300, { kind: 'wall', e: 0.2 });
      L.door(560, 300, 240, 0, Math.PI / 2, 7);
      L.door(1040, 300, 240, Math.PI, Math.PI / 2, -7);
      L.spawn = { x0: 586, x1: 1014, y: 277, gap: 34 };
      L.startView = { x: 800, y: 460 };
      L.sign('LE CLUB', 800, 44, 32, '#ff3ea5');

      // escaliers lumineux de part et d'autre (marches légèrement penchées vers l'extérieur)
      L.seg(690, 660, 800, 600, { kind: 'disco', e: 0.3 });
      L.seg(910, 660, 800, 600, { kind: 'disco', e: 0.3 });
      for (let k = 0; k < 5; k++) {
        const x = 690 - 90 * k, y = 660 + 45 * k;
        L.step(x, y, x - 90, y + 9); L.step(mir(x), y, mir(x - 90), y + 9);
        L.step(x - 90, y + 9, x - 90, y + 45); L.step(mir(x - 90), y + 9, mir(x - 90), y + 45);
      }
      L.seg(100, 380, 100, 1010, { kind: 'wall', e: 0.35 }); L.seg(mir(100), 380, mir(100), 1010, { kind: 'wall', e: 0.35 });
      L.seg(100, 1010, 720, 1190, { kind: 'disco', e: 0.25 }); L.seg(mir(100), 1010, mir(720), 1190, { kind: 'disco', e: 0.25 });
      // à partir d'ici, tout est décalé de o vers le bas
      const Ls = L.seg, Lv = L.vinyl, Lsp = L.speaker, Ldf = L.danceFloor, Lla = L.laser, Lar = L.arc, Lbo = L.boost, Lsi = L.sign, Lmb = L.mirrorBall;
      L.seg = function (ax, ay, bx, by, opt) { Ls(ax, ay + o, bx, by + o, opt); };
      L.vinyl = function (x, y, r, rot) { Lv(x, y + o, r, rot); };
      L.speaker = function (x0, y0, x1, y1, ax, ay) { Lsp(x0, y0 + o, x1, y1 + o, ax, ay); };
      L.danceFloor = function (ax, ay, bx, by, n, k) { Ldf(ax, ay + o, bx, by + o, n, k); };
      L.laser = function (ax, ay, bx, by, dx, dy, off) { Lla(ax, ay + o, bx, by + o, dx, dy, off); };
      // (L.arc passe par L.seg, déjà décalé)
      L.boost = function (ax, ay, bx, by, pw) { Lbo(ax, ay + o, bx, by + o, pw); };
      L.sign = function (t, x, y, sz, c) { Lsi(t, x, y + o, sz, c); };
      L.mirrorBall = function (x, y, r, rot, k) { Lmb(x, y + o, r, rot, k); };

      // platines : deux vinyles qui tournent en sens inverse
      L.vinyl(800, 1185, 135, T.rot || 1.5);
      L.seg(180, 1080, 180, 1300, { kind: 'wall', e: 0.35 }); L.seg(mir(180), 1080, mir(180), 1300, { kind: 'wall', e: 0.35 });
      L.seg(180, 1300, 700, 1440, { kind: 'disco', e: 0.25 }); L.seg(mir(180), 1300, mir(700), 1440, { kind: 'disco', e: 0.25 });
      L.vinyl(800, 1620, 135, -(T.rot || 1.5));
      L.seg(180, 1500, 180, 1740, { kind: 'wall', e: 0.35 }); L.seg(mir(180), 1500, mir(180), 1740, { kind: 'wall', e: 0.35 });
      L.seg(180, 1740, 700, 1880, { kind: 'disco', e: 0.25 }); L.seg(mir(180), 1740, mir(700), 1880, { kind: 'disco', e: 0.25 });
      L.sign('PLATINES', 800, 960, 26, '#3ff0ff');

      // fosse aux enceintes : elles soufflent vers le centre sur chaque temps, le sol fait danser
      L.seg(180, 1960, 180, 2400, { kind: 'wall', e: 0.35 }); L.seg(mir(180), 1960, mir(180), 2400, { kind: 'wall', e: 0.35 });
      L.speaker(190, 2080, 560, 2380, T.blast || 3000, -600);
      L.speaker(mir(560), 2080, mir(190), 2380, -(T.blast || 3000), -600);
      L.danceFloor(180, 2400, 700, 2500, 6, T.pad || 220);
      L.danceFloor(mir(180), 2400, mir(700), 2500, 6, T.pad || 220);
      L.boost(180, 2400, 700, 2500, 140); L.boost(mir(180), 2400, mir(700), 2500, 140);

      // rampes coupées par des lasers qui s'ouvrent un temps sur deux
      L.seg(720, 2597.8, 1300, 2640, { kind: 'ramp', e: 0.25 });
      L.seg(640, 2492.5, 720, 2597.8, { kind: 'disco', e: 0.2 });
      L.boost(800, 2603.6, 1040, 2621.1, T.lb1 || 260);
      L.arc(1370, 2710, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      L.boost(1375, 2834, 1150, 2851, 420);
      L.seg(1348, 2834, 300, 2914, { kind: 'ramp', e: 0.25 });
      L.boost(950, 2864.4, 712, 2882.6, T.lb || 320);
      L.laser(700, 2788, 700, 2875, 0, -108, 2);
      L.arc(290, 2974, 125, 260, 100, 14, { kind: 'wall', e: 0.2 });
      L.seg(268, 3099, 1300, 3179, { kind: 'ramp', e: 0.25 });
      L.boost(750, 3136.4, 990, 3155, T.lb || 320);
      L.laser(1000, 3062, 1000, 3148, 0, -104, 0);
      L.hood(1370, 2710, 1); L.hood(290, 2974, -1);
      L.sign('LASERS', 640, 2700, 26, '#ff5a5a');

      // piste de danse finale sous la boule à facettes
      L.seg(1300, 3179, 1300, 3190, { kind: 'wall', e: 0.3 });
      L.danceFloor(100, 3300, 700, 3560, 8, T.pad2 || 200);
      L.danceFloor(1500, 3300, 900, 3560, 8, T.pad2 || 200);
      L.seg(100, 3180, 100, 3300, { kind: 'wall', e: 0.3 }); L.seg(1500, 2860, 1500, 3300, { kind: 'wall', e: 0.3 });
      L.mirrorBall(800, 3390, 72, 2.4, 140);
      L.seg = Ls; L.vinyl = Lv; L.speaker = Lsp; L.danceFloor = Ldf; L.laser = Lla; L.arc = Lar; L.boost = Lbo; L.sign = Lsi; L.mirrorBall = Lmb;
      const my = 3560 + o;
      L.calm.push({ x0: 100, y0: 3300 + o, x1: 1500, y1: my + 20 });
      L.poly([[700, my], [260, my + 130], [260, H]], { kind: 'finish', e: 0.3 });
      L.poly([[900, my], [1340, my + 130], [1340, H]], { kind: 'finish', e: 0.3 });
      L.voids.push([[0, 3300 + o], [100, 3300 + o], [700, my], [260, my + 130], [260, H], [0, H]]);
      L.voids.push([[1600, 3300 + o], [1500, 3300 + o], [900, my], [1340, my + 130], [1340, H], [1600, H]]);
      L.finish = {
        y: my + 25,
        mouth: { x0: 700, x1: 900, y: my },
        basin: [[700, my], [900, my], [1340, my + 130], [1340, H - 10], [260, H - 10], [260, my + 130]],
        box: { x0: 260, x1: 1340, y0: my, y1: H - 10 },
        label: { text: 'ARRIVÉE', x: 800, y: my + 210, size: 64 }
      };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 8 — Bar Disco (0.2.9) : deux tables de flipper et deux fioles à cocktail.
   * Enclos → 1re table (bumpers, slingshots, flippers en rythme) → aiguillage vers deux fioles qui se remplissent,
   * portent les billes jusqu'au bec et les déversent → grand bol de regroupement → 2e table de flipper → arrivée.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'bar-disco',
    num: 8,
    zone: 'disco',
    name: 'Bar Disco',
    build: function () {
      const W = 1600, H = 3400;
      const L = Builder(W, H);
      L.gravity = 1000;
      L.marbleR = 16;
      L.theme = 'bar';
      const T = MR.L8 || {};
      const mir = function (x) { return W - x; };
      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // départ
      L.seg(560, 80, 560, 300, { kind: 'wall', e: 0.2 });
      L.seg(1040, 80, 1040, 300, { kind: 'wall', e: 0.2 });
      L.door(560, 300, 240, 0, Math.PI / 2, 7);
      L.door(1040, 300, 240, Math.PI, Math.PI / 2, -7);
      L.spawn = { x0: 586, x1: 1014, y: 277, gap: 34 };
      L.startView = { x: 800, y: 520 };
      L.sign('BAR DISCO', 800, 44, 32, '#ffb347');

      // côtés de la salle, de haut en bas
      L.seg(180, 60, 180, 2720, { kind: 'wall', e: 0.35 });
      L.seg(mir(180), 60, mir(180), 2720, { kind: 'wall', e: 0.35 });

      // 1re table : bumpers, slingshots et deux flippers qui frappent sur le temps
      const K = T.bump || 250;
      L.bumper(800, 560, 42, K); L.bumper(625, 720, 40, K); L.bumper(975, 720, 40, K);
      L.bumper(400, 520, 30, K * 0.9); L.bumper(mir(400), 520, 30, K * 0.9);
      L.sling(250, 830, 370, 950, 340); L.sling(mir(250), 830, mir(370), 950, 340);
      L.seg(180, 1000, 640, 1140, { kind: 'funnel', e: 0.25 });
      L.seg(mir(180), 1000, mir(640), 1140, { kind: 'funnel', e: 0.25 });
      L.flipper(640, 1140, 120, 0.5, -0.45, { off: 0 });
      L.flipper(mir(640), 1140, 120, Math.PI - 0.5, Math.PI + 0.45, { off: 0 });
      L.seg(640, 1140, 720, 1250, { kind: 'wall', e: 0.3 });
      L.seg(mir(640), 1140, mir(720), 1250, { kind: 'wall', e: 0.3 });

      // aiguillage vers les deux fioles
      L.seg(800, 1262, 545, 1385, { kind: 'ramp', e: 0.25 });
      L.seg(800, 1262, mir(545), 1385, { kind: 'ramp', e: 0.25 });
      // fioles : le liquide monte, porte les billes et les déverse par le bec (côté extérieur)
      L.seg(300, 1250, 300, 1405, { kind: 'glass', e: 0.25 });
      L.seg(mir(300), 1250, mir(300), 1405, { kind: 'glass', e: 0.25 });
      const fo = { fill: T.fill || 3, hold: T.hold || 3.2, empty: 1.2, drain: 1.8, flow: T.flow || 700 };
      L.flask(300, 560, 1395, 1478, 2000, -1, Object.assign({}, fo, { off: 0, c1: '#ff4fa8', c2: '#6a1fd6' }));
      L.flask(mir(560), mir(300), 1395, 1478, 2000, 1, Object.assign({}, fo, { off: 4.6, c1: '#ffb020', c2: '#e0283c' }));
      L.sign('COCKTAILS', 800, 1560, 26, '#ff6ac1');

      // grand bol : les billes se regroupent avant la 2e table
      L.seg(180, 2120, 720, 2370, { kind: 'funnel', e: 0.25 });
      L.seg(mir(180), 2120, mir(720), 2370, { kind: 'funnel', e: 0.25 });
      L.hold(720, 2380, 880, 2380, -180, 0, { x0: 180, y0: 2000, x1: 1420, y1: 2390 },
        { ratio: 0.85, maxWait: T.wait || 12, label: { x: 800, y: 2300 } });
      // logement de la porte une fois ouverte : fermé, pour qu'aucune bille ne se coince entre elle et le bol
      L.seg(540, 2286, 540, 2386, { kind: 'wall', e: 0.3 });

      // 2e table : bumpers et grands flippers, la sortie passe entre eux
      L.peg(680, 2470, 12); L.peg(920, 2470, 12);
      L.bumper(520, 2560, 34, K); L.bumper(1080, 2560, 34, K); L.bumper(800, 2690, 40, K);
      L.sling(230, 2600, 330, 2700, 320); L.sling(mir(230), 2600, mir(330), 2700, 320);
      L.seg(180, 2720, 590, 2880, { kind: 'funnel', e: 0.25 });
      L.seg(mir(180), 2720, mir(590), 2880, { kind: 'funnel', e: 0.25 });
      L.flipper(590, 2880, 140, 0.42, -0.5, { off: 1 });
      L.flipper(mir(590), 2880, 140, Math.PI - 0.42, Math.PI + 0.5, { off: 1 });

      // arrivée
      const my = 3010;
      L.seg(590, 2880, 700, my, { kind: 'wall', e: 0.3 });
      L.seg(mir(590), 2880, 900, my, { kind: 'wall', e: 0.3 });
      L.calm.push({ x0: 600, y0: 2900, x1: 1000, y1: my + 20 });
      L.poly([[700, my], [260, my + 130], [260, H]], { kind: 'finish', e: 0.3 });
      L.poly([[900, my], [1340, my + 130], [1340, H]], { kind: 'finish', e: 0.3 });
      L.voids.push([[0, 2720], [180, 2720], [590, 2880], [700, my], [260, my + 130], [260, H], [0, H]]);
      L.voids.push([[1600, 2720], [1420, 2720], [1010, 2880], [900, my], [1340, my + 130], [1340, H], [1600, H]]);
      L.finish = {
        y: my + 25,
        mouth: { x0: 700, x1: 900, y: my },
        basin: [[700, my], [900, my], [1340, my + 130], [1340, H - 10], [260, H - 10], [260, my + 130]],
        box: { x0: 260, x1: 1340, y0: my, y1: H - 10 },
        label: { text: 'ARRIVÉE', x: 800, y: my + 210, size: 64 }
      };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 9 — Orbite Disco (0.2.13) : une station spatiale.
   * Rampe de lancement (bumpers, bras qui tournent) → sas → grande chambre en apesanteur (astéroïdes,
   * bras de station, propulseurs qui soufflent sur le temps, portails de téléportation) → retour de la gravité → arrivée.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'orbite-disco',
    num: 9,
    zone: 'disco',
    name: 'Orbite Disco',
    build: function () {
      const W = 1600, H = 3660;
      const L = Builder(W, H);
      L.gravity = 1000;
      L.marbleR = 16;
      L.theme = 'space';
      const T = MR.L9 || {};
      const mir = function (x) { return W - x; };
      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // départ
      L.seg(560, 80, 560, 300, { kind: 'wall', e: 0.2 });
      L.seg(1040, 80, 1040, 300, { kind: 'wall', e: 0.2 });
      L.door(560, 300, 240, 0, Math.PI / 2, 7);
      L.door(1040, 300, 240, Math.PI, Math.PI / 2, -7);
      L.spawn = { x0: 586, x1: 1014, y: 277, gap: 34 };
      L.startView = { x: 800, y: 520 };
      L.sign('ORBITE DISCO', 800, 44, 30, '#3ff0ff');

      // coque de la station, de haut en bas
      L.seg(180, 60, 180, 3010, { kind: 'wall', e: 0.35 });
      L.seg(mir(180), 60, mir(180), 3010, { kind: 'wall', e: 0.35 });

      // rampe de lancement : bumpers et deux bras qui tournent en sens inverse
      L.bumper(800, 560, 40, 240);
      L.rotor(520, 640, 120, 2, T.rot || 2.2, 0, 16);
      L.rotor(mir(520), 640, 120, 2, -(T.rot || 2.2), Math.PI / 2, 16);
      for (let row = 0; row < 3; row++) {
        const y = 800 + row * 62, off = row % 2 ? 50 : 0;
        for (let x = 300 + off; x <= 1300; x += 100) if (Math.abs(x - 800) > 30 || row !== 1) L.peg(x, y, 10);
      }
      L.sling(230, 860, 330, 960, 320); L.sling(mir(230), 860, mir(330), 960, 320);
      L.seg(180, 1000, 720, 1150, { kind: 'funnel', e: 0.25 });
      L.seg(mir(180), 1000, mir(720), 1150, { kind: 'funnel', e: 0.25 });
      // sas : on attend le gros du peloton avant de partir en apesanteur
      L.hold(720, 1160, 880, 1160, -170, 0, { x0: 180, y0: 880, x1: 1420, y1: 1166 },
        { ratio: 0.85, maxWait: T.wait || 10, label: { x: 800, y: 1080 } });
      L.seg(550, 1104, 550, 1168, { kind: 'wall', e: 0.3 });

      // chambre en apesanteur : les billes flottent et dérivent doucement vers le bas
      const g0 = 1240, g1 = 2560;
      L.zeroG(180, g0, 1420, g1, { ay: T.drift || 95, drag: T.drag || 0.45 });
      L.sign('ZÉRO G', 800, 1300, 30, '#9fe8ff');
      L.bumper(470, 1520, 54, 200); L.bumper(mir(470), 1520, 54, 200);
      L.bumper(800, 1860, 70, 220);
      L.bumper(440, 2190, 46, 200); L.bumper(mir(440), 2190, 46, 200);
      L.rotor(800, 1480, 150, 3, T.station || 1.1, 0, 30, 'rotor');
      L.rotor(800, 2300, 120, 2, -(T.station || 1.1) * 1.4, 0.4, 24, 'rotor');
      // propulseurs : soufflent vers le centre sur le temps de la musique
      L.speaker(190, 2330, 330, 2540, 1800, -250);
      L.speaker(mir(330), 2330, mir(190), 2540, -1800, -250);
      // portails : à gauche en haut → à droite en bas, et l'inverse
      L.portal(310, 1730, 1270, 2080, { hue: 190, r: 44 });
      L.portal(1290, 1730, 330, 2080, { hue: 320, r: 44 });

      // retour de la gravité : entonnoir, boule à facettes et arrivée
      L.seg(180, g1, 720, 2700, { kind: 'funnel', e: 0.25 });
      L.seg(mir(180), g1, mir(720), 2700, { kind: 'funnel', e: 0.25 });
      L.mirrorBall(800, 2880, 80, 2.0, 120);
      L.seg(200, 3000, 690, 3200, { kind: 'ramp', e: 0.25 });
      L.seg(mir(200), 3000, mir(690), 3200, { kind: 'ramp', e: 0.25 });
      const my = 3260;
      L.seg(690, 3200, 700, my, { kind: 'wall', e: 0.3 });
      L.seg(mir(690), 3200, 900, my, { kind: 'wall', e: 0.3 });
      L.calm.push({ x0: 600, y0: 3150, x1: 1000, y1: my + 20 });
      L.poly([[700, my], [260, my + 130], [260, H]], { kind: 'finish', e: 0.3 });
      L.poly([[900, my], [1340, my + 130], [1340, H]], { kind: 'finish', e: 0.3 });
      L.voids.push([[0, 3010], [180, 3010], [200, 3000], [690, 3200], [700, my], [260, my + 130], [260, H], [0, H]]);
      L.voids.push([[1600, 3010], [1420, 3010], [1400, 3000], [910, 3200], [900, my], [1340, my + 130], [1340, H], [1600, H]]);
      L.finish = {
        y: my + 25,
        mouth: { x0: 700, x1: 900, y: my },
        basin: [[700, my], [900, my], [1340, my + 130], [1340, H - 10], [260, H - 10], [260, my + 130]],
        box: { x0: 260, x1: 1340, y0: my, y1: H - 10 },
        label: { text: 'ARRIVÉE', x: 800, y: my + 210, size: 64 }
      };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 10 — Le Grand Final (0.2.14), dans l'esprit du niveau 4 : survie en apesanteur, la dernière bille gagne.
   * Une boule à facettes géante tourne au centre, les cercles en carreaux de miroir tournent un sens puis l'autre,
   * leurs trous respirent au rythme de la musique, et chaque cercle brisé lance un feu d'artifice sur la scène.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'grand-final',
    num: 10,
    zone: 'disco',
    name: 'Le Grand Final',
    perCount: true,
    build: function (count) {
      const n = Math.max(1, Math.min(MR.MAX_MARBLES, count || (MR.Game && MR.Game.roster ? MR.Game.roster.length : 10)));
      const T = MR.L10 || {};
      const r = 14, rings = n - 1, dR = 22, ballR = T.ball || 58;
      const R0 = Math.max(160, Math.sqrt((n * 900 + Math.PI * (ballR + 20) * (ballR + 20)) / Math.PI) + 26);
      const outer = R0 + Math.max(0, rings - 1) * dR;
      const half = Math.ceil(outer + 300);
      const W = half * 2, H = half * 2, cx = half, cy = half;
      const L = Builder(W, H);
      L.gravity = 0;
      L.elastic = true;
      L.lockUntilStart = true;
      L.speed = T.speed || 540;
      L.speedPerR = T.perR || 1.3;
      L.openDelay = T.open || 0.35;
      L.marbleR = r;
      L.theme = 'finale';
      L.ringStyle = 'disco';
      L.breathe = T.breathe != null ? T.breathe : 0.45;
      L.mode = 'survival';
      L.elim = true;
      L.noStuck = true;
      L.timeLimit = 900;
      L.beatKick = T.kick || 220;
      L.beatEvery = T.every || 2;
      L.hunt = T.hunt || 2.6;
      L.center = { x: cx, y: cy };
      L.ringR0 = R0;
      L.outerR = outer;
      L.startView = { x: cx, y: cy };

      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // la boule à facettes géante au centre (les billes rebondissent dessus)
      L.mirrorBall(cx, cy, ballR, T.spin || 1.4, 0);
      // les cercles : or, rose et cyan en alternance ; un sens puis l'autre, chacun un peu plus rapide que le précédent
      const HUES = [45, 320, 185, 275];
      L.rings = [];
      for (let k = 0; k < rings; k++) {
        const R = R0 + k * dR;
        const hue = HUES[k % 4];
        const gap = Math.max((r * 2.1 + 4) / R, T.gapA || 0.19);
        L.rings.push({ cx: cx, cy: cy, R: R, t: 5, gap: gap, gapBase: gap, angle: -Math.PI / 2,
          omega: (T.w0 || 0.3) * Math.pow(1.04, k) * (k % 2 ? -1 : 1), e: 1, hue: hue, rgb: hsl(hue, 0.95, 0.62) });
      }
      // départ : grille serrée autour de la boule
      L.spawnSlots = function (k) {
        const pts = [], g = r * 2 + 3, lim = R0 - r - 8, inner = ballR + r + 6;
        for (let j = -24; j <= 24; j++) {
          for (let i = -24; i <= 24; i++) {
            const x = (i + (j & 1) * 0.5) * g, y = j * g * 0.866, d = x * x + y * y;
            if (d <= lim * lim && d >= inner * inner) pts.push({ x: cx + x, y: cy + y, d: d });
          }
        }
        pts.sort(function (a, b) { return a.d - b.d; });
        const out = pts.slice(0, k);
        while (out.length < k) { const a = Math.random() * MR.TAU; out.push({ x: cx + Math.cos(a) * (inner + 10), y: cy + Math.sin(a) * (inner + 10) }); }
        return MR.shuffle(out);
      };
      L.spawn = { x0: cx - R0, x1: cx + R0, y: cy, gap: 30 };
      L.sign('LE GRAND FINAL', cx, cy - outer - 130, 52, '#ffcf4a');
      L.sign('LE DERNIER EN VIE GAGNE', cx, cy + outer + 120, 28, '#ff6ac1');
      L.finish = { y: Infinity, none: true, box: { x0: cx - R0, x1: cx + R0, y0: cy - R0, y1: cy + R0 } };
      return L;
    }
  });

  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = function (n) { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
  }
})(window.MR);
