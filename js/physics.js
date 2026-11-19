/* MagicRace — moteur physique 2D (billes contre capsules, cercles et bras rotatifs) */
(function (MR) {
  'use strict';

  const ROLL = 0.00006;  // résistance au roulement, par sous-pas en contact
  const AIR = 0.00004;   // traînée de l'air, par sous-pas
  const VMAX = 2400;     // vitesse max (unités monde / s)

  function prepSeg(s) {
    const o = Object.assign({ flash: 0 }, s);
    o.minx = Math.min(s.ax, s.bx) - s.t;
    o.maxx = Math.max(s.ax, s.bx) + s.t;
    o.miny = Math.min(s.ay, s.by) - s.t;
    o.maxy = Math.max(s.ay, s.by) + s.t;
    return o;
  }
  function updArm(a) {
    a.ex = a.px + Math.cos(a.angle) * a.len;
    a.ey = a.py + Math.sin(a.angle) * a.len;
  }

  function createWorld(def) {
    const w = {
      W: def.W, H: def.H, g: def.gravity, r: def.marbleR,
      segs: def.segs.map(prepSeg),
      circles: def.circles.map(function (c) { return Object.assign({ flash: 0, r0: c.r }, c); }),
      arms: def.arms.map(function (a) { return Object.assign({ flash: 0 }, a); }),
      boosts: def.boosts.map(function (b) { return Object.assign({ hot: 0 }, b); }),
      zones: (def.zones || []).map(function (z) { return Object.assign({}, z, { hot: 0 }); }),
      pistons: (def.pistons || []).map(function (p) { return Object.assign({ flash: 0, top: p.base, vtop: 0 }, p); }),
      sliders: (def.sliders || []).map(function (s) {
        const o = Object.assign({ flash: 0, q: 0, vx: 0, vy: 0, x0: s.ax, y0: s.ay, x1: s.bx, y1: s.by }, s);
        if (s.hold) o.hold = Object.assign({}, s.hold, { open: false, first: -1, inside: 0, need: 0 });
        return o;
      }),
      // cercles tournants à trou (niveau 4) : seul le plus petit encore entier est solide
      rings: (def.rings || []).map(function (r) { return Object.assign({ flash: 0, alive: true, pulse: 0, gap0: r.gap, omega0: r.omega }, r); }),
      ringIdx: 0,
      // fioles (niveau 8) : un liquide monte, porte les billes jusqu'au bec verseur, puis se vide
      liquids: (def.liquids || []).map(function (l) { return Object.assign({ level: l.yBot, q: 0, vlev: 0, hot: 0 }, l); }),
      // niveau 4 : rebonds parfaits (aucune perte), cercles figés et fermés avant le départ, vitesse constante en course
      elastic: !!def.elastic,
      locked: !!def.lockUntilStart,
      constSpeed: 0,
      // rythme de la musique (main.js) : numéro du temps et courte fenêtre juste après chaque temps
      beatN: 0, beatOn: false,
      marbles: [],
      events: [],
      t: 0
    };
    w.arms.forEach(updArm);
    updPistons(w, 0);
    return w;
  }

  // pistons « égaliseur » : barres verticales qui montent et descendent en vague
  function pistonTop(p, t) {
    const s = Math.sin(MR.TAU * (t / p.period) + p.phase);
    const k = MR.clamp(s * 1.5, 0, 1);
    return p.base + 2 - p.hmax * k * k * (3 - 2 * k);
  }
  function updPistons(w, dt) {
    for (let i = 0; i < w.pistons.length; i++) {
      const p = w.pistons[i];
      const top = pistonTop(p, w.t);
      p.vtop = dt > 0 ? (top - p.top) / dt : 0;
      p.top = top;
    }
  }

  // Résout un contact (normale n, vitesse de surface sv). Retourne la vitesse normale d'approche.
  // grip : part de la vitesse tangentielle relative retirée (adhérence du plateau tournant)
  function contact(w, m, nx, ny, e, svx, svy, obj, kind, grip) {
    const rvx = m.vx - svx, rvy = m.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const imp = -vn;
      const ee = imp > 50 || w.elastic ? e : 0;
      m.vx -= (1 + ee) * vn * nx;
      m.vy -= (1 + ee) * vn * ny;
      if (imp > 60) {
        w.events.push({ m: m, s: imp, kind: kind, obj: obj });
        if (obj) obj.flash = Math.max(obj.flash, Math.min(1, imp / 420));
      }
    }
    const tx = -ny, ty = nx;
    const vt = (m.vx - svx) * tx + (m.vy - svy) * ty;
    const gr = grip || ROLL;
    m.vx -= vt * gr * tx;
    m.vy -= vt * gr * ty;
    m.touch = true;
    // rotation suivie seulement quand la bille roule vraiment (au repos, elle ne doit pas osciller)
    m.spinT = Math.abs(vt) < 18 ? 0 : vt / m.r;
    return vn;
  }

  // dernier contact de capsule (normale et vitesse d'approche), pour les trampolines
  const HIT = { nx: 0, ny: 0, vn: 0 };
  function capsule(w, m, ax, ay, bx, by, t, e, obj, kind, omega, px, py, svx0, svy0) {
    const abx = bx - ax, aby = by - ay, l2 = abx * abx + aby * aby;
    let u = l2 > 0 ? ((m.x - ax) * abx + (m.y - ay) * aby) / l2 : 0;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const cx = ax + abx * u, cy = ay + aby * u;
    const dx = m.x - cx, dy = m.y - cy;
    const R = m.r + t, d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return false;
    let d = Math.sqrt(d2), nx, ny;
    if (d < 1e-6) {
      const l = Math.sqrt(l2) || 1;
      nx = -aby / l; ny = abx / l;
      if (ny > 0) { nx = -nx; ny = -ny; }
      d = 0;
    } else { nx = dx / d; ny = dy / d; }
    m.x += nx * (R - d);
    m.y += ny * (R - d);
    let svx = svx0 || 0, svy = svy0 || 0;
    if (omega) { svx = -omega * (cy - py); svy = omega * (cx - px); }
    HIT.nx = nx; HIT.ny = ny;
    HIT.vn = contact(w, m, nx, ny, e, svx, svy, obj, kind);
    return true;
  }

  function wrapA(a) {
    while (a > Math.PI) a -= MR.TAU;
    while (a < -Math.PI) a += MR.TAU;
    return a;
  }
  // bille contre un cercle tournant percé d'un trou (angle du trou = rg.angle, demi-ouverture rg.gap)
  function ringContact(w, m, rg) {
    const dx = m.x - rg.cx, dy = m.y - rg.cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    if (Math.abs(d - rg.R) >= m.r + rg.t + 2) return;
    const rel = wrapA(Math.atan2(dy, dx) - rg.angle);
    // trou fermé : avant le départ, et un court instant après qu'un cercle plus petit s'est brisé
    const shut = w.locked || w.t < (rg.openAt || 0);
    let px, py;
    if (shut || Math.abs(rel) > rg.gap) { px = rg.cx + dx / d * rg.R; py = rg.cy + dy / d * rg.R; }
    else {
      const ea = rg.angle + (rel > 0 ? rg.gap : -rg.gap);
      px = rg.cx + Math.cos(ea) * rg.R; py = rg.cy + Math.sin(ea) * rg.R;
    }
    const qx = m.x - px, qy = m.y - py, RR = m.r + rg.t, q2 = qx * qx + qy * qy;
    if (q2 >= RR * RR) return;
    let q = Math.sqrt(q2), nx, ny;
    if (q < 1e-6) { nx = -dx / d; ny = -dy / d; q = 0; } else { nx = qx / q; ny = qy / q; }
    m.x += nx * (RR - q); m.y += ny * (RR - q);
    contact(w, m, nx, ny, rg.e, -rg.omega * (py - rg.cy), rg.omega * (px - rg.cx), rg, 'ring', 0);
  }

  function step(w, dt) {
    const ms = w.marbles, n = ms.length, g = w.g;
    let i, j, k;

    // éléments animés (moulins, trappes)
    for (k = 0; k < w.arms.length; k++) {
      const a = w.arms[k];
      if (a.flip) {
        // flipper : se lève d'un coup sur le temps de la musique (main.js règle flip.until), puis redescend
        const f = a.flip, up = w.t < (f.until || 0);
        const tgt = up ? f.a1 : f.a0, sp = (up ? f.upSpeed : f.downSpeed) * dt;
        const d = tgt - a.angle;
        const na = Math.abs(d) <= sp ? tgt : a.angle + Math.sign(d) * sp;
        a.omega = dt > 0 ? (na - a.angle) / dt : 0;
        a.angle = na;
        updArm(a);
        continue;
      }
      if (a.cycle) {
        // porte de sas : fermée, s'ouvre, reste ouverte, se referme, en boucle
        const c = a.cycle, ph = (w.t + c.off) % c.period;
        let q;
        if (ph < c.closed) q = 0;
        else if (ph < c.closed + c.move) q = (ph - c.closed) / c.move;
        else if (ph < c.period - c.move) q = 1;
        else q = 1 - (ph - (c.period - c.move)) / c.move;
        q = q * q * (3 - 2 * q);
        const na = c.a0 + (c.a1 - c.a0) * q;
        a.omega = dt > 0 ? (na - a.angle) / dt : 0;
        a.angle = na;
        a.open = q;
        updArm(a);
        continue;
      }
      if (!a.omega) continue;
      let na = a.angle + a.omega * dt;
      if (a.target != null && ((a.omega > 0 && na >= a.target) || (a.omega < 0 && na <= a.target))) {
        na = a.target; a.omega = 0;
      }
      a.angle = na;
      updArm(a);
    }
    w.t += dt;
    updPistons(w, dt);
    // portes coulissantes des sas : fermées, glissent dans le mur, restent ouvertes, reviennent
    for (k = 0; k < w.sliders.length; k++) {
      const s = w.sliders[k], c = s.cycle;
      let q;
      if (s.hold) {
        // porte de regroupement : la course (main.js) décide quand elle s'ouvre ; elle glisse puis reste ouverte
        s.hold.p = MR.clamp((s.hold.p || 0) + (s.hold.open ? 1 : -1) * dt / (c.move || 0.5), 0, 1);
        q = s.hold.p;
      } else {
        const ph = (w.t + c.off) % c.period;
        if (ph < c.closed) q = 0;
        else if (ph < c.closed + c.move) q = (ph - c.closed) / c.move;
        else if (ph < c.period - c.move) q = 1;
        else q = 1 - (ph - (c.period - c.move)) / c.move;
      }
      q = q * q * (3 - 2 * q);
      const dq = dt > 0 ? (q - s.q) / dt : 0;
      s.q = q;
      s.vx = s.dx * dq; s.vy = s.dy * dq;
      s.x0 = s.ax + s.dx * q; s.y0 = s.ay + s.dy * q;
      s.x1 = s.bx + s.dx * q; s.y1 = s.by + s.dy * q;
    }
    for (k = 0; k < w.circles.length; k++) {
      const c = w.circles[k];
      if (c.spin) { c.omega = c.spin * Math.sin(w.t * c.freq + (c.ph || 0)); c.angle = (c.angle || 0) + c.omega * dt; }
      else if (c.rot) { c.omega = c.rot; c.angle = (c.angle || 0) + c.rot * dt; }
    }
    // niveau des fioles : vide, se remplit, déborde un moment par le bec, se vide
    for (k = 0; k < w.liquids.length; k++) {
      const l = w.liquids[k], P = l.empty + l.fill + l.hold + l.drain;
      const ph = ((w.t + (l.off || 0)) % P + P) % P;
      let q;
      if (ph < l.empty) q = 0;
      else if (ph < l.empty + l.fill) { q = (ph - l.empty) / l.fill; q = q * q * (3 - 2 * q); }
      else if (ph < l.empty + l.fill + l.hold) q = 1;
      else { q = 1 - (ph - l.empty - l.fill - l.hold) / l.drain; q = q * q * (3 - 2 * q); }
      const lev = l.yBot + (l.yTop - l.yBot) * q;
      l.vlev = dt > 0 ? (lev - l.level) / dt : 0;
      l.level = lev; l.q = q;
      l.spill = ph >= l.empty + l.fill - 0.15 && ph < l.empty + l.fill + l.hold;
    }
    if (!w.locked) for (k = w.ringIdx; k < w.rings.length; k++) w.rings[k].angle += w.rings[k].omega * dt;
    const ring = w.rings[w.ringIdx] || null;

    // intégration (une bille tenue au curseur suit sa cible, sans gravité)
    for (i = 0; i < n; i++) {
      const m = ms[i];
      if (m.held) {
        m.vx = (m.hx - m.x) * 22; m.vy = (m.hy - m.y) * 22;
      } else m.vy += g * dt;
      if (!w.elastic) { m.vx *= 1 - AIR; m.vy *= 1 - AIR; }
      const sp2 = m.vx * m.vx + m.vy * m.vy;
      if (sp2 > VMAX * VMAX) { const f = VMAX / Math.sqrt(sp2); m.vx *= f; m.vy *= f; }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.touch = false;
    }

    for (let it = 0; it < 2; it++) {
      // billes entre elles (masses égales)
      for (i = 0; i < n; i++) {
        const a = ms[i];
        for (j = i + 1; j < n; j++) {
          const b = ms[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const R = a.r + b.r;
          if (dx > R || dx < -R || dy > R || dy < -R) continue;
          let d2 = dx * dx + dy * dy;
          if (d2 >= R * R) continue;
          if (d2 < 1e-8) { dx = Math.random() - 0.5; dy = -0.5; d2 = dx * dx + dy * dy; }
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = (R - d) * 0.5;
          a.x -= nx * pen; a.y -= ny * pen;
          b.x += nx * pen; b.y += ny * pen;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) {
            const e = w.elastic ? 1 : rv < -50 ? 0.6 : 0.05;
            const jj = -(1 + e) * rv * 0.5;
            a.vx -= jj * nx; a.vy -= jj * ny;
            b.vx += jj * nx; b.vy += jj * ny;
            if (it === 0 && rv < -160) w.events.push({ m: a, s: -rv, kind: 'marble', obj: null });
          }
        }
      }
      // décor
      for (i = 0; i < n; i++) {
        const m = ms[i];
        const x0 = m.x - m.r, x1 = m.x + m.r, y0 = m.y - m.r, y1 = m.y + m.r;
        for (k = 0; k < w.segs.length; k++) {
          const s = w.segs[k];
          if (x1 < s.minx || x0 > s.maxx || y1 < s.miny || y0 > s.maxy) continue;
          // trampoline : renvoie la bille avec une poussée supplémentaire
          const hitSeg = capsule(w, m, s.ax, s.ay, s.bx, s.by, s.t, s.e, s, s.kind, 0, 0, 0);
          if (hitSeg && s.kill) { m.doom = true; s.flash = 1; }
          else if (hitSeg && s.beat) {
            // dalle de piste de danse : fait sauter la bille sur chaque temps de la musique
            if (w.beatOn && m.padBeat !== w.beatN) {
              m.padBeat = w.beatN;
              m.vx += HIT.nx * s.kick; m.vy += HIT.ny * s.kick;
              s.flash = 1;
            }
          }
          else if (hitSeg && s.kick && HIT.vn < -40) {
            m.vx += HIT.nx * s.kick; m.vy += HIT.ny * s.kick;
            s.flash = 1;
            w.events.push({ m: m, s: 400, kind: 'tramp', obj: s });
          }
        }
        if (ring) ringContact(w, m, ring);
        for (k = 0; k < w.circles.length; k++) {
          const c = w.circles[k];
          const dx = m.x - c.x, dy = m.y - c.y, R = m.r + c.r;
          if (dx > R || dx < -R || dy > R || dy < -R) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 >= R * R) continue;
          const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
          m.x = c.x + nx * R; m.y = c.y + ny * R;
          const om = c.omega || 0;
          const vn = contact(w, m, nx, ny, c.e, -om * ny * c.r, om * nx * c.r, c, c.kind, om ? (c.grip || 0.02) : 0);
          if (c.kill) { m.doom = true; c.flash = 1; }
          else if (c.kick && vn < -10) { m.vx += nx * c.kick; m.vy += ny * c.kick; c.flash = 1; }
        }
        for (k = 0; k < w.arms.length; k++) {
          const a = w.arms[k];
          capsule(w, m, a.px, a.py, a.ex, a.ey, a.t, a.e, a, a.kind, a.omega, a.px, a.py);
        }
        for (k = 0; k < w.pistons.length; k++) {
          const p = w.pistons[k];
          if (Math.abs(m.x - p.x) > m.r + p.t || m.y + m.r < p.top - p.t || m.y - m.r > p.base + 30) continue;
          capsule(w, m, p.x, p.top, p.x, p.base + 24, p.t, p.e, p, 'piston', 0, 0, 0, 0, p.vtop);
        }
        for (k = 0; k < w.sliders.length; k++) {
          const s = w.sliders[k];
          capsule(w, m, s.x0, s.y0, s.x1, s.y1, s.t, s.e, s, 'gate', 0, 0, 0, s.vx, s.vy);
        }
      }
    }

    // boosters, rotation visuelle et garde-fous
    for (i = 0; i < n; i++) {
      const m = ms[i];
      for (k = 0; k < w.boosts.length; k++) {
        const b = w.boosts[k];
        const rx = m.x - b.ax, ry = m.y - b.ay;
        const u = rx * b.dx + ry * b.dy;
        if (u < 0 || u > b.len) continue;
        const h = rx * b.nx + ry * b.ny;
        if (h < 0 || h > m.r + 30) continue;
        m.vx += b.dx * b.power * dt;
        m.vy += b.dy * b.power * dt;
        m.boost = 1; b.hot = 1;
      }
      for (k = 0; k < w.zones.length; k++) {
        const z = w.zones[k];
        if (z.beat && !w.beatOn) continue;   // enceinte : souffle seulement sur le temps
        if (m.x > z.x0 && m.x < z.x1 && m.y > z.y0 && m.y < z.y1 && !m.held) {
          m.vx += z.ax * dt; m.vy += z.ay * dt;
          z.hot = 1;
        }
      }
      // liquide des fioles : poussée d'Archimède (la bille flotte à moitié immergée), freinage, courant vers le bec
      for (k = 0; k < w.liquids.length; k++) {
        const l = w.liquids[k];
        if (m.held || m.x < l.x0 || m.x > l.x1 || m.y + m.r < l.level || m.y > l.yBot + m.r) continue;
        const f = MR.clamp((m.y + m.r - l.level) / (2 * m.r), 0, 1);
        m.vy -= g * l.buoy * f * dt;
        const dr = Math.min(1, l.drag * f * dt);
        m.vx -= m.vx * dr;
        m.vy -= (m.vy - Math.min(0, l.vlev)) * dr;
        if (m.y - l.level < m.r * 2.5) m.vx += l.flow * f * dt;
        m.wet = 1; l.hot = 1;
      }
      // vitesse constante (niveau 4 en course) : chaque bille garde la même vitesse, seule sa direction change
      if (w.constSpeed && !m.held) {
        const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
        if (sp > 1) { m.vx *= w.constSpeed / sp; m.vy *= w.constSpeed / sp; }
        else { const a = Math.random() * MR.TAU; m.vx = Math.cos(a) * w.constSpeed; m.vy = Math.sin(a) * w.constSpeed; }
      }
      if (m.touch) m.spin += (m.spinT - m.spin) * 0.3;
      else m.spin *= 0.9995;
      m.angle += m.spin * dt;

      if (m.x !== m.x || m.y !== m.y || m.vx !== m.vx || m.vy !== m.vy) {
        m.x = w.W / 2; m.y = 40; m.vx = 0; m.vy = 0;
      }
      if (m.x < m.r) { m.x = m.r; m.vx = Math.abs(m.vx) * 0.4; }
      else if (m.x > w.W - m.r) { m.x = w.W - m.r; m.vx = -Math.abs(m.vx) * 0.4; }
      if (m.y < m.r) { m.y = m.r; m.vy = Math.abs(m.vy) * 0.4; }
      else if (m.y > w.H - m.r) { m.y = w.H - m.r; m.vy = -Math.abs(m.vy) * 0.3; }
    }
  }

  MR.Physics = { createWorld: createWorld, step: step };
})(window.MR);
