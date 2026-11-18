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
    L.bumper = function (x, y, r, kick) {
      L.circles.push({ x: x, y: y, r: r || 24, e: 0.75, kick: kick || 240, kind: 'bumper' });
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
        for (let x = 260 + off; x <= 1340; x += 120) L.peg(x, y, 11);
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
   * Niveau 2 — La Grande Roue (0.0.4, d'après le schéma de l'auteur)
   * Enclos → rampe accélérée → demi-tour → rampe accélérée → demi-tour →
   * couloir → grande roue qui tourne → ascenseur → chambre à picots et bumpers → arrivée.
   * ------------------------------------------------------------------ */
  MR.registerLevel({
    id: 'grande-roue',
    num: 2,
    name: 'La Grande Roue',
    build: function () {
      const W = 2600, H = 1400;
      const L = Builder(W, H);
      L.gravity = 1000;
      L.marbleR = 16;

      L.seg(0, 0, W, 0, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, 0, W, H, { kind: 'frame', t: 10, e: 0.4 });
      L.seg(W, H, 0, H, { kind: 'frame', t: 10, e: 0.2 });
      L.seg(0, H, 0, 0, { kind: 'frame', t: 10, e: 0.4 });

      // enclos de départ
      L.seg(120, 40, 120, 260, { kind: 'wall', e: 0.2 });
      L.seg(480, 40, 480, 260, { kind: 'wall', e: 0.2 });
      L.door(120, 260, 180, 0, Math.PI / 2, 7);
      L.door(480, 260, 180, Math.PI, Math.PI / 2, -7);
      L.spawn = { x0: 146, x1: 454, y: 260 - 6 - 17, gap: 34 };
      L.startView = { x: 700, y: 520 };
      L.sign('DÉPART', 650, 150, 28, '#ffcf4a');

      // rampe A (→) avec flèches de vitesse
      const ya = function (x) { return 500 + x * 30 / 860; };
      L.seg(0, 500, 860, 530, { kind: 'disco', e: 0.25 });
      L.boost(160, ya(160), 780, ya(780), 650);
      // demi-tour à droite
      L.arc(930, 600, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });

      // rampe B (←) avec flèches de vitesse
      const yb = function (x) { return 724 + (908 - x) * 36 / 758; };
      L.seg(908, 724, 150, 760, { kind: 'disco', e: 0.25 });
      L.boost(820, yb(820), 260, yb(260), 650);
      // demi-tour à gauche
      L.arc(140, 820, 125, 260, 100, 14, { kind: 'wall', e: 0.2 });

      // couloir vers la roue
      const yc = function (x) { return 945 + (x - 118) * 45 / 1225; };
      L.seg(118, 945, 1343, 990, { kind: 'disco', e: 0.25 });
      L.boost(300, yc(300), 1150, yc(1150), 260);

      // la grande roue : carter ouvert à gauche (entrée) et à droite (sortie), 4 rayons qui tournent
      const cx = 1580, cy = 760, R = 330;
      L.arc(cx, cy, R, 40, 136, 12, { kind: 'wall', e: 0.2 });
      L.arc(cx, cy, R, 215, 338, 14, { kind: 'wall', e: 0.2 });
      L.rotor(cx, cy, 312, 4, -1.1, 0.3, 58, 'wheel');
      L.sign('GRANDE ROUE', 1500, 330, 30, '#ff6ac1');

      // ascenseur : couloir vertical qui propulse les billes vers le haut, capot qui les renvoie à droite
      L.seg(1886, 636, 1910, 440, { kind: 'wall', e: 0.3 });
      L.arc(2040, 440, 130, 180, 350, 12, { kind: 'wall', e: 0.3 });
      L.seg(1833, 972, 2030, 1050, { kind: 'wall', e: 0.25 });
      L.seg(2030, 520, 2030, 1050, { kind: 'wall', e: 0.3 });
      L.zone(1915, 330, 2024, 1045, 0, -2300);

      // chambre à picots, bumpers en bas
      L.seg(2560, 250, 2545, 960, { kind: 'wall', e: 0.35 });
      for (let row = 0; row < 5; row++) {
        const y = 560 + row * 72;
        const off = row % 2 ? 42 : 0;
        for (let x = 2085 + off; x <= 2510; x += 85) L.peg(x, y, 10);
      }
      L.bumper(2130, 930, 24, 230);
      L.bumper(2460, 912, 24, 230);
      L.bumper(2295, 975, 20, 200);
      L.sign('PLUIE DE PICOTS', 2300, 470, 22, '#c08bff');

      // entonnoir d'arrivée et bassin
      L.seg(2030, 1050, 2225, 1100, { kind: 'funnel', e: 0.25 });
      L.seg(2545, 960, 2365, 1100, { kind: 'funnel', e: 0.25 });
      L.poly([[2225, 1100], [2120, 1170], [2120, H]], { kind: 'finish', e: 0.3 });
      L.poly([[2365, 1100], [2470, 1170], [2470, H]], { kind: 'finish', e: 0.3 });
      L.voids.push([[10, 960], [118, 958], [1343, 1003], [1400, 1060], [1580, 1100], [1760, 1060], [1833, 985], [2030, 1063], [2030, H], [0, H]]);
      L.voids.push([[2030, 1063], [2225, 1113], [2120, 1177], [2120, H], [2030, H]]);
      L.voids.push([[2365, 1113], [2545, 973], [2600, 960], [2600, H], [2470, H], [2470, 1177]]);

      // progression le long du parcours (le classement ne peut pas se fier à la hauteur ici)
      L.progress = function (m) {
        const x = m.x, y = m.y;
        if (x > 2030 && y < 1400) return 5200 + y;                       // chambre à picots
        if (x > 1890 && y < 1070) return 4400 + (1070 - y);              // ascenseur
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < 345 * 345) {                              // dans la roue
          let a = Math.atan2(dy, dx) * 180 / Math.PI;
          if (a < -40) a += 360;
          return 3400 + Math.max(0, 136 - a) * 9;
        }
        if (y >= 870) return 2000 + x;                                    // couloir vers la roue
        if (y >= 620 && x < 1080) return 1060 + (1060 - x);               // rampe B
        return Math.min(x, 1060) + y * 0.01;                              // enclos et rampe A
      };
      L.progressMax = 5200 + 1125;
      // niveau horizontal : la caméra zoome et suit la course (environ 1300 × 800 unités visibles)
      L.camera = { fit: 'min', viewW: 1300, viewH: 800, span: 850, ahead: 0.04 };

      L.finish = {
        y: 1125,
        mouth: { x0: 2225, x1: 2365, y: 1100 },
        basin: [[2225, 1100], [2365, 1100], [2470, 1170], [2470, H - 10], [2120, H - 10], [2120, 1170]],
        box: { x0: 2120, x1: 2470, y0: 1100, y1: H - 10 },
        label: { text: 'ARRIVÉE', x: 2295, y: 1290, size: 40 }
      };
      return L;
    }
  });

  /* ------------------------------------------------------------------ *
   * Niveau 3 — Plage Disco (0.1.0) : long parcours sur fond de plage de nuit
   * Départ → Promenade → Vagues → Bar de plage (sas) → Toboggan → Dance floor →
   * Cocotiers → La Jetée → Concert (sas) → Feu d'artifice → arrivée.
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
        for (let x = 260 + off; x <= 1340; x += 120) L.peg(x, y, 11);
      }
      L.seg(220, 520, 220, 950, { kind: 'wall', e: 0.35 });
      L.seg(1380, 520, 1380, 950, { kind: 'wall', e: 0.35 });
      L.seg(220, 950, 725, 1150, { kind: 'disco', e: 0.25 });
      L.seg(1380, 950, 875, 1150, { kind: 'disco', e: 0.25 });

      // la Promenade : deux rampes, flèches de vitesse sur la seconde
      L.seg(520, 1240, 1420, 1330, { kind: 'disco', e: 0.25 });
      const y2 = function (x) { return 1480 + (1600 - x) * 150 / 1420; };
      L.seg(1600, 1480, 180, 1630, { kind: 'ramp', e: 0.25 });
      L.boost(1300, y2(1300), 500, y2(500), 500);
      L.sign('PROMENADE', 1000, 1420, 26, '#ffcf4a');

      // les Vagues : rampe ondulée
      L.wavy(0, 1780, 1420, 1930, 10, 220, 52, { kind: 'wave', e: 0.25 });
      L.sign('VAGUES', 700, 1700, 28, '#3ff0ff');

      // Bar de plage : sas qui regroupe les billes
      L.seg(240, 1990, 240, 2120, { kind: 'wall', e: 0.3 });
      L.seg(240, 2120, 730, 2330, { kind: 'wall', e: 0.25 });
      L.seg(1600, 2060, 870, 2330, { kind: 'disco', e: 0.25 });
      L.gate(730, 2338, 870, 2338, -142, 0, { period: 5, closed: 3.4 }, { x0: 240, y0: 2000, x1: 1600, y1: 2350 });
      L.sign('BAR DE PLAGE', 620, 2060, 26, '#ff6ac1');

      // Toboggan : rampes accélérées et trois demi-tours
      L.seg(480, 2440, 1000, 2470, { kind: 'disco', e: 0.25 });
      L.arc(1070, 2540, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      const yt2 = function (x) { return 2664 + (1048 - x) * 36 / 628; };
      L.seg(1048, 2664, 420, 2700, { kind: 'wave', e: 0.25 });
      L.boost(980, yt2(980), 520, yt2(520), 450);
      L.arc(410, 2760, 125, 260, 100, 14, { kind: 'wall', e: 0.2 });
      const yt3 = function (x) { return 2884 + (x - 388) * 36 / 662; };
      L.seg(388, 2884, 1050, 2920, { kind: 'wave', e: 0.25 });
      L.boost(480, yt3(480), 960, yt3(960), 450);
      L.arc(1120, 2990, 125, -100, 100, 14, { kind: 'wall', e: 0.2 });
      L.seg(1098, 3114, 420, 3150, { kind: 'wave', e: 0.25 });
      L.sign('TOBOGGAN', 1380, 2700, 28, '#ffcf4a');

      // Dance floor : pistons d'égaliseur, entonnoir, boule à facettes tournante
      L.seg(100, 3170, 100, 3240, { kind: 'wall', e: 0.3 });
      const yp = function (x) { return 3240 + (x - 100) * 86 / 800; };
      L.seg(100, 3240, 900, 3326, { kind: 'ramp', e: 0.25 });
      [480, 600, 720].forEach(function (x, i) { L.piston(x, yp(x), 40, 1.3, -i * 0.9); });
      L.calm.push({ x0: 380, y0: 3180, x1: 900, y1: 3340 });
      L.seg(840, 3400, 985, 3480, { kind: 'disco', e: 0.25 });
      L.seg(1300, 3360, 1145, 3480, { kind: 'disco', e: 0.25 });
      L.turntable(1065, 3570, 44, 3.4, 0.8, 0.6);
      L.sign('DANCE FLOOR', 1360, 3230, 26, '#ff3ea5');

      // Cocotiers : grand V avec bumpers
      L.seg(0, 3700, 720, 3980, { kind: 'disco', e: 0.25 });
      L.seg(1600, 3700, 880, 3980, { kind: 'disco', e: 0.25 });
      L.bumper(300, 3745, 24, 220);
      L.bumper(1300, 3745, 24, 220);
      L.bumper(530, 3840, 22, 200);
      L.bumper(1070, 3840, 22, 200);
      L.sign('COCOTIERS', 800, 3730, 26, '#4ee08a');

      // La Jetée : quatre rampes, vagues, bumper dans la chute
      L.seg(560, 4090, 1420, 4180, { kind: 'ramp', e: 0.25 });
      L.wavy(1600, 4330, 180, 4480, 10, 220, 52, { kind: 'wave', e: 0.25 });
      L.seg(0, 4630, 1420, 4780, { kind: 'ramp', e: 0.25 });
      L.bumper(1500, 4860, 24, 240);
      const yj4 = function (x) { return 4930 + (1600 - x) * 150 / 1420; };
      L.seg(1600, 4930, 180, 5080, { kind: 'ramp', e: 0.25 });
      L.boost(1400, yj4(1400), 400, yj4(400), 500);
      L.sign('LA JETÉE', 800, 4260, 28, '#ffcf4a');

      // Concert : second sas contre le mur gauche
      L.seg(470, 5100, 470, 5180, { kind: 'wall', e: 0.3 });
      L.seg(470, 5180, 170, 5330, { kind: 'wall', e: 0.25 });
      L.gate(12, 5338, 172, 5338, 162, 0, { period: 5, closed: 3.4 }, { x0: 0, y0: 5090, x1: 480, y1: 5350 });
      L.sign('CONCERT', 900, 5250, 30, '#c08bff');

      // Feu d'artifice : picots puis bumpers au-dessus de l'entonnoir final
      L.seg(0, 5440, 760, 5522, { kind: 'ramp', e: 0.25 });
      for (let row = 0; row < 5; row++) {
        const y = 5640 + row * 80, off = row % 2 ? 60 : 0;
        for (let x = 320 + off; x <= 1280; x += 120) L.peg(x, y, 11);
      }
      L.seg(270, 5560, 270, 6020, { kind: 'wall', e: 0.35 });
      L.seg(1330, 5560, 1330, 6020, { kind: 'wall', e: 0.35 });
      L.sign('FEU D’ARTIFICE', 1060, 5480, 24, '#ff9f2e');

      const my = 6550;
      L.seg(0, 6250, 700, my, { kind: 'funnel', e: 0.25 });
      L.seg(1600, 6290, 900, my, { kind: 'funnel', e: 0.25 });
      L.bumper(520, 6400, 24, 220);
      L.bumper(1080, 6405, 24, 220);
      L.bumper(800, 6460, 18, 180);
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
})(window.MR);
