/* MagicRace — niveaux. Chaque niveau s'enregistre avec MR.registerLevel({ id, num, name, build }). */
(function (MR) {
  'use strict';

  MR.LEVELS = [];
  MR.registerLevel = function (def) { MR.LEVELS.push(def); };
  MR.levelById = function (id) {
    for (let i = 0; i < MR.LEVELS.length; i++) if (MR.LEVELS[i].id === id) return MR.LEVELS[i];
    return MR.LEVELS[0];
  };

  // Petit constructeur de géométrie partagé par tous les niveaux.
  function Builder(W, H) {
    const L = {
      W: W, H: H, gravity: 1000, marbleR: 16,
      segs: [], circles: [], arms: [], hubs: [], boosts: [], pistons: [], sliders: [], zones: [], shapes: [], signs: [], voids: [], calm: [],
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

      // entonnoir final
      const my = 2400;
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
      L.gravity = T.g || 600;
      L.marbleR = r;
      L.theme = 'beach';
      L.mode = 'survival';
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
        // vitesse de bord à peu près constante : le trou défile aussi vite sur les petits que sur les grands cercles
        const v = (T.v || 240) * (0.75 + Math.random() * 0.5);
        L.rings.push({ cx: cx, cy: cy, R: R, t: 5, gap: Math.max((r * 2.1 + 4) / R, T.gapA || 0.19), angle: Math.random() * MR.TAU,
          omega: (Math.random() < 0.5 ? -1 : 1) * MR.clamp(v / R, T.wmin || 0.5, 2.2), e: T.e || 0.9, hue: hue, rgb: hsl(hue, 0.95, 0.6) });
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

  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = function (n) { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
  }
})(window.MR);
