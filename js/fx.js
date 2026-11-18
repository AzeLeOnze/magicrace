/* MagicRace — effets : bloom, particules, traînées et contours des billes */
(function (MR) {
  'use strict';

  const TAU = Math.PI * 2;
  const MAXP = 2400;
  const FX = {};

  /* ---------------- Bloom (flou par réductions successives, composé en additif) ---------------- */
  function Bloom() {
    this.a = document.createElement('canvas');
    this.b = document.createElement('canvas');
    this.c = document.createElement('canvas');
    this.ac = this.a.getContext('2d');
    this.bc = this.b.getContext('2d');
    this.cc = this.c.getContext('2d');
    this.k = 4; this.w = 1; this.h = 1;
  }
  Bloom.prototype.resize = function (w, h, k) {
    this.k = k; this.w = w; this.h = h;
    const fit = function (cv, d) {
      const W = Math.max(1, Math.ceil(w / d)), H = Math.max(1, Math.ceil(h / d));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    };
    fit(this.a, k); fit(this.b, k * 2); fit(this.c, k * 4);
  };
  Bloom.prototype.begin = function () {
    const c = this.ac;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, this.a.width, this.a.height);
    return c;
  };
  Bloom.prototype.apply = function (ctx, strength) {
    const s = strength == null ? 1 : strength, k = this.k;
    const aw = this.w / k, ah = this.h / k, bw = aw / 2, bh = ah / 2, cw = aw / 4, ch = ah / 4;
    this.bc.setTransform(1, 0, 0, 1, 0, 0);
    this.bc.clearRect(0, 0, this.b.width, this.b.height);
    this.bc.drawImage(this.a, 0, 0, aw, ah, 0, 0, bw, bh);
    this.cc.setTransform(1, 0, 0, 1, 0, 0);
    this.cc.clearRect(0, 0, this.c.width, this.c.height);
    this.cc.drawImage(this.b, 0, 0, bw, bh, 0, 0, cw, ch);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.5 * s; ctx.drawImage(this.a, 0, 0, aw, ah, 0, 0, W, H);
    ctx.globalAlpha = 0.62 * s; ctx.drawImage(this.b, 0, 0, bw, bh, 0, 0, W, H);
    ctx.globalAlpha = 0.8 * s; ctx.drawImage(this.c, 0, 0, cw, ch, 0, 0, W, H);
    ctx.restore();
  };
  MR.Bloom = Bloom;

  /* ---------------- Particules ---------------- */
  function System() { this.p = []; }
  System.prototype.clear = function () { this.p.length = 0; };
  System.prototype.add = function (q) { if (this.p.length < MAXP) this.p.push(q); };
  System.prototype.update = function (dt) {
    const p = this.p;
    let j = 0;
    for (let i = 0; i < p.length; i++) {
      const q = p[i];
      q.life -= dt;
      if (q.life <= 0) continue;
      if (q.g) q.vy += q.g * dt;
      if (q.drag) { const f = Math.max(0, 1 - q.drag * dt); q.vx *= f; q.vy *= f; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.spin) q.rot += q.spin * dt;
      p[j++] = q;
    }
    p.length = j;
  };
  // particules opaques (sous les billes)
  System.prototype.drawUnder = function (c, b) {
    const p = this.p;
    for (let i = 0; i < p.length; i++) {
      const q = p[i], k = q.life / q.max;
      if (q.kind === 'smoke') {
        const rr = q.size * (1 + (1 - k) * 1.8);
        c.fillStyle = MR.rgbStr(q.rgb, 0.24 * k);
        c.beginPath(); c.arc(q.x, q.y, rr, 0, TAU); c.fill();
      } else if (q.kind === 'pixel') {
        const a = Math.ceil(k * 4) / 4, s = q.size;
        const x = Math.round(q.x / s) * s, y = Math.round(q.y / s) * s;
        c.fillStyle = MR.rgbStr(q.rgb, a * 0.95);
        c.fillRect(x - s / 2, y - s / 2, s, s);
        if (b) { b.fillStyle = MR.rgbStr(q.rgb, a * 0.6); b.fillRect(x - s / 2, y - s / 2, s, s); }
      } else if (q.kind === 'confetti') {
        c.save();
        c.translate(q.x, q.y); c.rotate(q.rot);
        c.fillStyle = 'hsla(' + q.hue + ',95%,62%,' + Math.min(1, k * 3).toFixed(3) + ')';
        c.fillRect(-q.size, -q.size * 0.45 * Math.cos(q.rot * 2), q.size * 2, q.size * 0.9 * Math.cos(q.rot * 2));
        c.restore();
      }
    }
  };
  // particules lumineuses (additives, au-dessus)
  System.prototype.drawOver = function (c, b) {
    const p = this.p;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    if (b) b.lineCap = 'round';
    for (let i = 0; i < p.length; i++) {
      const q = p[i], k = q.life / q.max;
      if (q.kind === 'spark') {
        const s = MR.rgbStr(q.rgb, k);
        c.strokeStyle = s; c.lineWidth = q.size;
        c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); c.stroke();
        if (b) { b.strokeStyle = s; b.lineWidth = q.size * 2.5; b.beginPath(); b.moveTo(q.x, q.y); b.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); b.stroke(); }
      } else if (q.kind === 'glitter') {
        const tw = 0.5 + 0.5 * Math.sin(q.rot * 3);
        const s = q.size * (0.5 + 0.9 * tw);
        c.fillStyle = 'hsla(' + q.hue.toFixed(0) + ',100%,76%,' + (k * (0.5 + 0.5 * tw)).toFixed(3) + ')';
        c.fillRect(q.x - s, q.y - s * 0.17, s * 2, s * 0.34);
        c.fillRect(q.x - s * 0.17, q.y - s, s * 0.34, s * 2);
        if (b) { b.fillStyle = c.fillStyle; b.beginPath(); b.arc(q.x, q.y, s, 0, TAU); b.fill(); }
      } else if (q.kind === 'ring') {
        const rr = q.size + (1 - k) * q.grow;
        const s = MR.rgbStr(q.rgb, k * 0.9);
        c.strokeStyle = s; c.lineWidth = 2.5 * k + 0.5;
        c.beginPath(); c.arc(q.x, q.y, rr, 0, TAU); c.stroke();
        if (b) { b.strokeStyle = s; b.lineWidth = 6 * k + 1; b.beginPath(); b.arc(q.x, q.y, rr, 0, TAU); b.stroke(); }
      } else if (q.kind === 'shard') {
        // éclat de cercle brisé : petit trait néon qui tourne en s'éloignant
        const s = MR.rgbStr(q.rgb, Math.min(1, k * 1.4));
        const ex = Math.cos(q.rot) * q.size, ey = Math.sin(q.rot) * q.size;
        c.strokeStyle = s; c.lineWidth = q.w || 4;
        c.beginPath(); c.moveTo(q.x - ex, q.y - ey); c.lineTo(q.x + ex, q.y + ey); c.stroke();
        if (b) { b.strokeStyle = s; b.lineWidth = (q.w || 4) * 3; b.beginPath(); b.moveTo(q.x - ex, q.y - ey); b.lineTo(q.x + ex, q.y + ey); b.stroke(); }
      } else if (q.kind === 'dot') {
        const s = MR.rgbStr(q.rgb, k * 0.8);
        c.fillStyle = s;
        c.beginPath(); c.arc(q.x, q.y, q.size * (0.4 + 0.6 * k), 0, TAU); c.fill();
        if (b) { b.fillStyle = s; b.beginPath(); b.arc(q.x, q.y, q.size * 1.6, 0, TAU); b.fill(); }
      }
    }
    c.restore();
  };
  FX.System = System;

  /* ---------------- Traînées ---------------- */
  const TRAIL_DUR = { ribbon: 0.42, comet: 0.26, rainbow: 0.55 };
  const WHITE = [255, 255, 255];

  function spawnTrail(sys, m, t) {
    const r = m.r, rgb = m.rgb;
    const ang = Math.random() * TAU, rr = Math.random() * r * 0.6;
    const x = m.x + Math.cos(ang) * rr, y = m.y + Math.sin(ang) * rr;
    let l;
    switch (t) {
      case 'sparks':
        l = MR.rand(0.3, 0.6);
        sys.add({ kind: 'spark', x: x, y: y, vx: -m.vx * 0.18 + MR.rand(-140, 140), vy: -m.vy * 0.18 + MR.rand(-170, 50),
          g: 650, drag: 0.5, life: l, max: l, size: MR.rand(1.4, 2.6), rgb: MR.mixRgb(rgb, WHITE, 0.45) });
        break;
      case 'smoke':
        l = MR.rand(0.7, 1.1);
        sys.add({ kind: 'smoke', x: x, y: y, vx: -m.vx * 0.06 + MR.rand(-15, 15), vy: -m.vy * 0.06 + MR.rand(-30, 0),
          g: -40, drag: 1.4, life: l, max: l, size: r * MR.rand(0.45, 0.7), rgb: MR.mixRgb(rgb, [150, 140, 170], 0.55) });
        break;
      case 'pixels':
        l = MR.rand(0.4, 0.7);
        sys.add({ kind: 'pixel', x: x, y: y, vx: MR.rand(-20, 20), vy: MR.rand(-20, 20), drag: 2, life: l, max: l,
          size: MR.pick([5, 6, 8]), rgb: MR.mixRgb(rgb, WHITE, Math.random() * 0.4) });
        break;
      case 'glitter':
        l = MR.rand(0.6, 1.1);
        sys.add({ kind: 'glitter', x: x, y: y, vx: MR.rand(-50, 50) - m.vx * 0.05, vy: MR.rand(-60, 20) - m.vy * 0.05,
          g: 90, drag: 1.2, life: l, max: l, size: MR.rand(2, 4), hue: Math.random() * 360, rot: Math.random() * TAU, spin: MR.rand(-6, 6) });
        break;
    }
  }

  FX.trailTick = function (sys, m, dt, time) {
    const t = m.cfg.trail, dur = TRAIL_DUR[t], h = m.hist;
    if (dur) {
      const last = h.length ? h[h.length - 1] : null;
      if (!last || (m.x - last.x) * (m.x - last.x) + (m.y - last.y) * (m.y - last.y) > 4) h.push({ x: m.x, y: m.y, t: time });
      while (h.length && time - h[0].t > dur) h.shift();
      if (h.length > 60) h.splice(0, h.length - 60);
    } else if (h.length) h.length = 0;
    if (dt <= 0) return;
    const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
    let rate = 0;
    if (t === 'sparks') rate = sp > 70 ? Math.min(70, sp / 7) : 0;
    else if (t === 'smoke') rate = sp > 40 ? 24 : 0;
    else if (t === 'pixels') rate = sp > 40 ? 34 : 0;
    else if (t === 'glitter') rate = sp > 30 ? 26 : 0;
    rate *= MR.fxDensity == null ? 1 : MR.fxDensity; // réglage « particules » du menu Paramètres
    if (!rate) return;
    m.emit = (m.emit || 0) + rate * dt;
    let guard = 0;
    while (m.emit >= 1 && guard++ < 6) { m.emit -= 1; spawnTrail(sys, m, t); }
    if (m.emit > 1) m.emit = 0;
  };

  FX.drawTrail = function (c, b, m, time) {
    const t = m.cfg.trail, h = m.hist, n = h.length;
    if (!n || !TRAIL_DUR[t]) return;
    if (t === 'comet') {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const k = (i + 1) / (n + 1), rr = m.r * (0.2 + 0.8 * k);
        c.fillStyle = MR.rgbStr(m.rgb, 0.22 * k);
        c.beginPath(); c.arc(h[i].x, h[i].y, rr, 0, TAU); c.fill();
        if (b) { b.fillStyle = MR.rgbStr(m.rgb, 0.35 * k); b.beginPath(); b.arc(h[i].x, h[i].y, rr * 1.05, 0, TAU); b.fill(); }
      }
      c.restore();
      return;
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (b) { b.lineCap = 'round'; b.lineJoin = 'round'; }
    let px = h[0].x, py = h[0].y;
    for (let i = 1; i <= n; i++) {
      const x = i < n ? h[i].x : m.x, y = i < n ? h[i].y : m.y;
      const k = i / n;
      let col;
      if (t === 'rainbow') col = 'hsla(' + (((time * 260 - i * 16) % 360) + 360) % 360 + ',100%,62%,' + (0.78 * k).toFixed(3) + ')';
      else col = MR.rgbStr(m.rgb, 0.6 * k);
      const lw = m.r * (t === 'rainbow' ? 1.35 : 1.5) * (0.22 + 0.78 * k);
      c.strokeStyle = col; c.lineWidth = lw;
      c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke();
      if (b) { b.strokeStyle = col; b.lineWidth = lw * 1.2; b.beginPath(); b.moveTo(px, py); b.lineTo(x, y); b.stroke(); }
      px = x; py = y;
    }
  };

  /* ---------------- Contours ---------------- */
  function ring(c, x, y, r, w, style) {
    c.strokeStyle = style; c.lineWidth = w;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  }

  // dessiné AVANT la bille (halo)
  FX.drawOutlineUnder = function (c, b, m, time, beat) {
    if (m.cfg.outline !== 'aura') return;
    const ph = beat - Math.floor(beat), kick = Math.exp(-ph * 5);
    const x = m.x, y = m.y, r = m.r, rgb = m.orgb;
    const R2 = r * (2.3 + 0.3 * kick);
    const g = c.createRadialGradient(x, y, r * 0.85, x, y, R2);
    g.addColorStop(0, MR.rgbStr(rgb, 0.55));
    g.addColorStop(1, MR.rgbStr(rgb, 0));
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, R2, 0, TAU); c.fill();
    c.restore();
    if (b) { b.fillStyle = MR.rgbStr(rgb, 0.3); b.beginPath(); b.arc(x, y, r * 1.7, 0, TAU); b.fill(); }
  };

  // dessiné APRÈS la bille
  FX.drawOutline = function (c, b, m, time, beat) {
    const o = m.cfg.outline;
    if (!o || o === 'none' || o === 'aura') return;
    const x = m.x, y = m.y, r = m.r, rgb = m.orgb;
    const ph = beat - Math.floor(beat), kick = Math.exp(-ph * 5);
    switch (o) {
      case 'neon':
        ring(c, x, y, r + 2.2, 2.8, MR.rgbStr(rgb, 1));
        ring(c, x, y, r + 2.2, 1, 'rgba(255,255,255,0.85)');
        if (b) ring(b, x, y, r + 2.5, 5, MR.rgbStr(rgb, 0.7));
        break;
      case 'gold': {
        const a = time * 1.6;
        const g = c.createLinearGradient(x + Math.cos(a) * r, y + Math.sin(a) * r, x - Math.cos(a) * r, y - Math.sin(a) * r);
        g.addColorStop(0, '#fff6c2'); g.addColorStop(0.25, '#ffcf4a'); g.addColorStop(0.5, '#9a6512');
        g.addColorStop(0.75, '#ffd970'); g.addColorStop(1, '#7a4c0c');
        ring(c, x, y, r + 2.3, 4.2, g);
        ring(c, x, y, r + 0.4, 1, 'rgba(40,20,0,0.6)');
        ring(c, x, y, r + 4.2, 0.8, 'rgba(255,240,190,0.7)');
        if (b) ring(b, x, y, r + 2.5, 5, 'rgba(255,200,80,0.55)');
        break;
      }
      case 'pulse': {
        const e = r + 3 + ph * 20;
        ring(c, x, y, r + 2.5 + kick * 4, 2 + kick * 1.5, MR.rgbStr(rgb, 0.55 + 0.45 * kick));
        ring(c, x, y, e, 1.5, MR.rgbStr(rgb, (1 - ph) * 0.6));
        if (b) { ring(b, x, y, r + 3 + kick * 4, 6, MR.rgbStr(rgb, 0.4 + 0.6 * kick)); ring(b, x, y, e, 3, MR.rgbStr(rgb, (1 - ph) * 0.6)); }
        break;
      }
      case 'rainbow': {
        const segs = 24, rr = r + 2.6;
        c.lineWidth = 3.4;
        if (b) b.lineWidth = 7;
        for (let i = 0; i < segs; i++) {
          const a0 = i / segs * TAU + time * 2, a1 = a0 + TAU / segs + 0.03;
          const s = 'hsl(' + ((i / segs * 360 + time * 120) % 360).toFixed(0) + ',100%,62%)';
          c.strokeStyle = s; c.beginPath(); c.arc(x, y, rr, a0, a1); c.stroke();
          if (b) { b.strokeStyle = s; b.beginPath(); b.arc(x, y, rr, a0, a1); b.stroke(); }
        }
        break;
      }
      case 'dashed':
        c.save();
        c.setLineDash([6, 5]); c.lineDashOffset = -time * 40;
        ring(c, x, y, r + 3.5, 2.2, MR.rgbStr(rgb, 1));
        c.setLineDash([2, 7]); c.lineDashOffset = time * 30;
        ring(c, x, y, r + 8, 1.6, MR.rgbStr(rgb, 0.65));
        c.restore();
        if (b) ring(b, x, y, r + 4, 4, MR.rgbStr(rgb, 0.45));
        break;
      case 'electric': {
        const seed = Math.floor(time * 18) + (m.seedN || 0);
        const pts = 26;
        const path = function (cc) {
          cc.beginPath();
          for (let i = 0; i <= pts; i++) {
            const a = i / pts * TAU;
            const jr = r + 2.5 + MR.hash(i % pts, seed) * 6;
            const px = x + Math.cos(a) * jr, py = y + Math.sin(a) * jr;
            if (i === 0) cc.moveTo(px, py); else cc.lineTo(px, py);
          }
        };
        c.lineJoin = 'miter';
        path(c); c.strokeStyle = MR.rgbStr(rgb, 1); c.lineWidth = 1.9; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.7; c.stroke();
        if (b) { path(b); b.strokeStyle = MR.rgbStr(rgb, 1); b.lineWidth = 4.5; b.stroke(); }
        break;
      }
    }
  };

  /* ---------------- Célébrations ---------------- */
  FX.burst = function (sys, x, y, rgb, n) {
    n = Math.round((n || 26) * (MR.fxDensity == null ? 1 : MR.fxDensity));
    for (let i = 0; i < 3; i++) {
      const l = 0.6 + i * 0.15;
      sys.add({ kind: 'ring', x: x, y: y, vx: 0, vy: 0, life: l, max: l, size: 14 + i * 4, grow: 60 + i * 30, rgb: rgb });
    }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = MR.rand(80, 320), l = MR.rand(0.6, 1.3);
      sys.add({ kind: 'glitter', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, g: 260, drag: 1.5,
        life: l, max: l, size: MR.rand(2.5, 5), hue: Math.random() * 360, rot: Math.random() * TAU, spin: MR.rand(-8, 8) });
    }
  };
  FX.confetti = function (sys, x0, x1, y, n) {
    n = Math.round(n * (MR.fxDensity == null ? 1 : MR.fxDensity));
    for (let i = 0; i < n; i++) {
      const l = MR.rand(1.8, 3.2);
      sys.add({ kind: 'confetti', x: MR.rand(x0, x1), y: y + MR.rand(-60, 20), vx: MR.rand(-160, 160), vy: MR.rand(-700, -250),
        g: 520, drag: 1.1, life: l, max: l, size: MR.rand(4, 8), hue: Math.random() * 360, rot: Math.random() * TAU, spin: MR.rand(-10, 10) });
    }
  };

  // bille éliminée : flash, ondes de choc, éclats lumineux, débris de sa couleur et fumée
  FX.explode = function (sys, x, y, rgb, r) {
    const d = MR.fxDensity == null ? 1 : MR.fxDensity, k = (r || 16) / 16;
    const hot = MR.mixRgb(rgb, [255, 255, 255], 0.6);
    sys.add({ kind: 'dot', x: x, y: y, vx: 0, vy: 0, life: 0.22, max: 0.22, size: 38 * k, rgb: [255, 255, 255] });
    sys.add({ kind: 'dot', x: x, y: y, vx: 0, vy: 0, life: 0.45, max: 0.45, size: 26 * k, rgb: hot });
    for (let i = 0; i < 3; i++) {
      const l = 0.45 + i * 0.18;
      sys.add({ kind: 'ring', x: x, y: y, vx: 0, vy: 0, life: l, max: l, size: 10 * k, grow: (110 + i * 70) * k, rgb: i ? rgb : [255, 255, 255] });
    }
    const n = Math.round(30 * d);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = MR.rand(260, 900) * k, l = MR.rand(0.35, 0.8);
      sys.add({ kind: 'spark', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 500, drag: 2.2, life: l, max: l, size: MR.rand(2, 3.5), rgb: Math.random() < 0.4 ? [255, 240, 200] : hot });
    }
    const m = Math.round(16 * d);
    for (let i = 0; i < m; i++) {
      const a = Math.random() * TAU, s = MR.rand(120, 520) * k, l = MR.rand(0.6, 1.2);
      sys.add({ kind: 'pixel', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 160, g: 1100, drag: 0.8, life: l, max: l, size: MR.rand(3, 6) * k, rgb: rgb });
    }
    const sm = Math.round(7 * d);
    for (let i = 0; i < sm; i++) {
      const a = Math.random() * TAU, s = MR.rand(20, 90), l = MR.rand(0.8, 1.5);
      sys.add({ kind: 'smoke', x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, drag: 1.5, life: l, max: l, size: MR.rand(10, 18) * k, rgb: [60, 40, 80] });
    }
  };
  // cercle brisé (niveau 4) : le cercle vole en éclats autour de son centre
  FX.shatterRing = function (sys, cx, cy, R, rgb, a0) {
    const d = MR.fxDensity == null ? 1 : MR.fxDensity;
    const n = Math.max(10, Math.round(Math.min(80, R / 9) * (0.4 + 0.6 * d)));
    for (let i = 0; i < n; i++) {
      const a = (a0 || 0) + (i + Math.random() * 0.6) / n * TAU;
      const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
      const s = MR.rand(120, 420), l = MR.rand(0.7, 1.4);
      sys.add({ kind: 'shard', x: px, y: py, vx: Math.cos(a) * s + MR.rand(-60, 60), vy: Math.sin(a) * s + MR.rand(-60, 60), g: 300, drag: 1.4,
        life: l, max: l, size: MR.rand(6, 14), w: MR.rand(2.5, 4.5), rot: a + Math.PI / 2, spin: MR.rand(-9, 9), rgb: Math.random() < 0.25 ? [255, 255, 255] : rgb });
    }
    sys.add({ kind: 'ring', x: cx, y: cy, vx: 0, vy: 0, life: 0.7, max: 0.7, size: R, grow: 160, rgb: rgb });
  };

  MR.FX = FX;
})(window.MR);
