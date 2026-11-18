/* MagicRace — rendu de la scène (canvas 2D + couche bloom) */
(function (MR) {
  'use strict';

  const TAU = Math.PI * 2;
  const R = { vw: 1, vh: 1, dpr: 1, reducedMotion: false };
  const cam = { x: 800, y: 400, s: 1 };
  R.cam = cam;

  let cv, ctx, bloom, vignette = null;
  const KIND = {
    frame:  { core: '#ff3ea5', body: '#170a26', glow: 'rgba(255,62,165,0.85)' },
    ramp:   { core: '#3ff0ff', body: '#0f0b22', glow: 'rgba(63,240,255,0.75)' },
    wall:   { core: '#b98bff', body: '#140b28', glow: 'rgba(160,110,255,0.8)' },
    funnel: { core: '#ffcf4a', body: '#1a0f20', glow: 'rgba(255,190,70,0.8)' },
    finish: { core: '#ffe9a6', body: '#1a0f20', glow: 'rgba(255,215,120,0.9)' },
    door:   { core: '#ffcf4a', body: '#1a0f20', glow: 'rgba(255,190,70,0.85)' },
    disco:  { core: '#ff6ac1', body: '#1c0a24', glow: 'rgba(255,90,190,0.8)' },
    gate:   { core: '#ff5a4e', body: '#2a0a12', glow: 'rgba(255,90,78,0.9)' },
    diamond:{ core: '#ffe14d', body: '#2a1c05', glow: 'rgba(255,215,60,0.9)' },
    wheel:  { core: '#ff3ea5', body: '#24071c', glow: 'rgba(255,62,165,0.9)' },
    wave:   { core: '#5ff7e6', body: '#071a22', glow: 'rgba(80,240,220,0.8)' },
    rotor:  { core: '#c78bff', body: '#160a2a', glow: 'rgba(190,120,255,0.9)' },
    tramp:  { core: '#eafffb', body: '#0a3a3c', glow: 'rgba(63,240,255,0.95)' },
    open:   { core: '#7dffb0', body: '#0a2a18', glow: 'rgba(80,255,150,0.85)' }
  };
  // halo des billes dans la couche bloom (réduit en 0.0.3)
  const EMISSIVE = { solid: 0.12, nebula: 0.2, magma: 0.42, opal: 0.16, plasma: 0.38, disco: 0.2,
    lavalamp: 0.3, aurore: 0.2, rypoint: 0.25, sunshine: 0.4, deepfire: 0.35, electrique: 0.3, diamant: 0.24, hypnose: 0.26, abysses: 0.2, chrome: 0.16, glace: 0.16 };
  const BEAMS = [[255, 62, 165], [63, 240, 255], [155, 92, 255], [255, 207, 74]];
  const TILE_HUES = [330, 185, 270, 45];
  const bokeh = [];

  R.init = function (canvas) {
    cv = canvas;
    ctx = cv.getContext('2d', { alpha: false });
    bloom = new MR.Bloom();
    for (let i = 0; i < 46; i++) {
      bokeh.push({ x: Math.random(), y: Math.random(), z: MR.rand(0.15, 1), r: MR.rand(1, 3.2), c: MR.pick(BEAMS), ph: Math.random() * TAU });
    }
    try { R.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
    resize();
    window.addEventListener('resize', resize);
  };

  function resize() {
    const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
    // qualité d'image (menu Paramètres) : plafond de résolution et finesse du bloom
    const q = (MR.Game && MR.Game.settings && MR.Game.settings.quality) || 'auto';
    const mobile = Math.min(vw, vh) < 700;
    const cap = { high: 2, medium: 1.25, low: 0.8 }[q] || (mobile ? 1.5 : 2);
    let dpr = Math.min(window.devicePixelRatio || 1, cap);
    const maxPix = q === 'high' ? 6e6 : q === 'low' ? 1.6e6 : 4.2e6;
    if (vw * vh * dpr * dpr > maxPix) dpr = Math.sqrt(maxPix / (vw * vh));
    R.vw = vw; R.vh = vh; R.dpr = dpr;
    cv.width = Math.round(vw * dpr);
    cv.height = Math.round(vh * dpr);
    bloom.resize(vw, vh, q === 'low' ? 6 : 4);
    vignette = null;
  }
  R.resize = resize;

  // partie de l'écran masquée à droite par le panneau (sur grand écran)
  R.panelOpen = false;
  R.inset = 0;
  R.insetTarget = function () { return R.panelOpen && R.vw >= 900 ? Math.min(400, R.vw) : 0; };
  R.cx = function () { return (R.vw - R.inset) / 2; };

  R.screenToWorld = function (x, y) {
    return { x: (x - R.cx()) / cam.s + cam.x, y: (y - R.vh / 2) / cam.s + cam.y };
  };
  R.worldToScreen = function (x, y) {
    return { x: (x - cam.x) * cam.s + R.cx(), y: (y - cam.y) * cam.s + R.vh / 2 };
  };

  /* ---------------- fond ---------------- */
  /* ---------- fond « plage disco de nuit » (niveau 3) ---------- */
  const stars = [];
  for (let i = 0; i < 140; i++) stars.push({ x: Math.random(), y: Math.random(), r: MR.rand(0.4, 1.6), ph: Math.random() * TAU });
  function palm(x, base, h, lean, side) {
    // silhouette de palmier : tronc courbé + palmes, liseré néon
    const tx = x + lean, ty = base - h;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#07030d'; ctx.lineWidth = Math.max(6, h * 0.05);
    ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + lean * 0.15, base - h * 0.55, tx, ty); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,62,165,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 3, base); ctx.quadraticCurveTo(x + lean * 0.15 + 3, base - h * 0.55, tx + 2, ty); ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.48 + side * 0.15;
      const L = h * (0.42 + 0.08 * Math.sin(k * 2.1));
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + L * 0.35;
      ctx.strokeStyle = '#07030d'; ctx.lineWidth = Math.max(4, h * 0.035);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.7 - L * 0.1, ex, ey); ctx.stroke();
    }
  }
  function drawBeach(time, kick, beat, L) {
    const vw = R.vw, vh = R.vh;
    const prog = MR.clamp(cam.y / L.H, 0, 1);
    const hz = vh * (0.55 + 0.08 * (prog - 0.5));
    const sandY = vh * 0.86;
    let g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#04071d'); g.addColorStop(0.65, '#170d3b'); g.addColorStop(1, '#4a1a5c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, hz);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.1 + s.ph));
      ctx.fillStyle = 'rgba(255,250,235,' + (tw * 0.8).toFixed(3) + ')';
      ctx.fillRect(s.x * vw, s.y * hz * 0.92, s.r, s.r);
    }
    // lune
    const mx = vw * 0.78, my = hz * 0.3, mr = Math.min(vw, vh) * 0.06;
    g = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4);
    g.addColorStop(0, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    ctx.fillStyle = '#fff3d4'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,150,0.35)';
    [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.35, 0.12]].forEach(function (c) { ctx.beginPath(); ctx.arc(mx + c[0] * mr, my + c[1] * mr, c[2] * mr, 0, TAU); ctx.fill(); });
    // mer
    g = ctx.createLinearGradient(0, hz, 0, sandY);
    g.addColorStop(0, '#1c1452'); g.addColorStop(1, '#060820');
    ctx.fillStyle = g; ctx.fillRect(0, hz, vw, sandY - hz);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 34; k++) {
      const f = k / 34, y = hz + 3 + f * (sandY - hz - 6);
      const w = (mr * 0.6 + f * mr * 2.2) * (0.6 + 0.4 * Math.sin(time * 2.1 + k * 1.7));
      ctx.fillStyle = 'rgba(255,233,176,' + (0.3 * (1 - f * 0.7)).toFixed(3) + ')';
      ctx.fillRect(mx - w / 2 + Math.sin(time * 1.3 + k) * 6, y, w, 2);
      // reflets disco (magenta / cyan) au rythme
      if (k % 3 === 0) {
        const cx2 = vw * (0.15 + 0.6 * MR.hash(k, Math.floor(beat))), w2 = 30 + 60 * f;
        ctx.fillStyle = (k % 2 ? 'rgba(255,62,165,' : 'rgba(63,240,255,') + (0.18 * kick * (1 - f * 0.5)).toFixed(3) + ')';
        ctx.fillRect(cx2 - w2 / 2, y, w2, 2);
      }
    }
    ctx.restore();
    // sable et écume
    g = ctx.createLinearGradient(0, sandY, 0, vh);
    g.addColorStop(0, '#2b1834'); g.addColorStop(1, '#120a19');
    ctx.fillStyle = g; ctx.fillRect(0, sandY, vw, vh - sandY);
    ctx.strokeStyle = 'rgba(220,235,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= vw; x += 12) {
      const y = sandY + Math.sin(x * 0.02 + time * 1.4) * 3 + Math.sin(x * 0.007 - time * 0.8) * 4;
      if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // palmiers
    const ph = Math.min(vh * 0.5, vw * 0.55, 420);
    palm(vw * 0.05, vh + 10, ph, ph * 0.18, 1);
    palm(vw * 0.94, vh + 10, ph * 0.9, -ph * 0.2, -1);
    // guirlande d'ampoules
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const y0 = vh * 0.1, sag = vh * 0.06, cols = [[255, 62, 165], [63, 240, 255], [255, 207, 74], [155, 92, 255]];
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y0); ctx.quadraticCurveTo(vw / 2, y0 + sag * 2, vw, y0); ctx.stroke();
    const n = Math.max(8, Math.round(vw / 45)), bi = Math.floor(beat);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = t * vw, y = y0 + sag * 4 * t * (1 - t);
      const on = 0.35 + 0.65 * ((i + bi) % 4 === 0 ? kick : 0.4);
      const c = cols[i % 4];
      g = ctx.createRadialGradient(x, y + 4, 0, x, y + 4, 14);
      g.addColorStop(0, MR.rgbStr(c, on)); g.addColorStop(1, MR.rgbStr(c, 0));
      ctx.fillStyle = g; ctx.fillRect(x - 14, y - 10, 28, 28);
    }
    ctx.restore();
  }

  function drawBackground(time, kick, beat, L) {
    const vw = R.vw, vh = R.vh, S = MR.Game.settings;
    if (L && L.theme === 'beach') drawBeach(time, kick, beat, L);
    else {
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, '#0e0619'); g.addColorStop(0.6, '#08040f'); g.addColorStop(1, '#040208');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }
    if (!S.beams) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cx = vw * 0.5, cy = -vh * 0.2, len = Math.hypot(vw, vh) * 1.3;
    const speed = R.reducedMotion ? 0.03 : 0.21;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + Math.sin(time * speed + i * 1.7) * 0.85;
      const col = BEAMS[i % 4];
      const al = 0.03 + 0.03 * kick;
      const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
      const gr = ctx.createLinearGradient(cx, cy, ex, ey);
      gr.addColorStop(0, MR.rgbStr(col, al * 2.2));
      gr.addColorStop(0.7, MR.rgbStr(col, al * 0.5));
      gr.addColorStop(1, MR.rgbStr(col, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - 0.06) * len, cy + Math.sin(a - 0.06) * len);
      ctx.lineTo(cx + Math.cos(a + 0.06) * len, cy + Math.sin(a + 0.06) * len);
      ctx.closePath();
      ctx.fill();
    }
    const H = vh * 1.2;
    for (let i = 0; i < bokeh.length; i++) {
      const p = bokeh[i];
      const y = ((p.y * H - cam.y * 0.06 * p.z) % H + H) % H - vh * 0.1;
      const tw = 0.5 + 0.5 * Math.sin(time * 1.3 + p.ph);
      ctx.fillStyle = MR.rgbStr(p.c, (0.05 + 0.1 * tw) * p.z);
      ctx.beginPath(); ctx.arc(p.x * vw, y, p.r * (1 + p.z), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function polyPath(c, pts) {
    c.beginPath();
    for (let i = 0; i < pts.length; i++) { if (i) c.lineTo(pts[i][0], pts[i][1]); else c.moveTo(pts[i][0], pts[i][1]); }
    c.closePath();
  }

  function drawBoard(L, v) {
    ctx.fillStyle = L.theme === 'beach' ? 'rgba(20,10,40,0.2)' : 'rgba(32,16,56,0.42)';
    ctx.fillRect(0, 0, L.W, L.H);
    const step = 80;
    ctx.fillStyle = 'rgba(244,237,255,0.06)';
    const x0 = Math.max(0, Math.floor(v.x0 / step) * step), x1 = Math.min(L.W, v.x1);
    const y0 = Math.max(0, Math.floor(v.y0 / step) * step), y1 = Math.min(L.H, v.y1);
    for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    ctx.fillStyle = '#06030b';
    for (let i = 0; i < L.voids.length; i++) { polyPath(ctx, L.voids[i]); ctx.fill(); }
  }

  function neonText(b, text, x, y, size, color, glow) {
    ctx.save();
    ctx.font = size + 'px Monoton, Impact, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.globalAlpha = 0.35 + 0.6 * glow;
    ctx.fillText(text, x, y);
    ctx.restore();
    if (b) {
      b.save();
      b.font = size + 'px Monoton, Impact, sans-serif';
      b.textAlign = 'center'; b.textBaseline = 'middle';
      b.fillStyle = color; b.globalAlpha = glow;
      b.fillText(text, x, y);
      b.restore();
    }
  }

  function drawSigns(L, b, v, time, kick) {
    for (let i = 0; i < L.signs.length; i++) {
      const s = L.signs[i];
      if (s.y + 60 < v.y0 || s.y - 60 > v.y1) continue;
      const flick = MR.hash(Math.floor(time * 9), i * 3.1) > 0.965 ? 0.25 : 1;
      neonText(b, s.text, s.x, s.y, s.size, s.color, (0.65 + 0.25 * kick) * flick);
    }
  }

  /* ---------------- zone d'arrivée (bloom) ---------------- */
  function drawFinish(L, b, v, time, beat, kick) {
    const f = L.finish;
    if (!f || f.none) return;
    const bx = f.box;
    if (bx.y1 < v.y0 || bx.y0 - 120 > v.y1) return;
    const bi = Math.floor(beat), T = 60;
    const tiles = function (c, mul) {
      for (let y = bx.y1 - T; y > bx.y0 - T; y -= T) {
        for (let x = bx.x0; x < bx.x1; x += T) {
          const i = Math.round(x / T), j = Math.round(y / T);
          const h = MR.hash(i * 7 + j * 13, bi);
          if (h < 0.55) continue;
          const a = (0.12 + 0.25 * (h - 0.55) / 0.45) * (0.55 + 0.45 * kick) * mul;
          c.fillStyle = 'hsla(' + TILE_HUES[(i + j + bi) & 3] + ',95%,62%,' + Math.min(1, a).toFixed(3) + ')';
          c.fillRect(x + 3, y + 3, T - 6, T - 6);
        }
      }
    };
    ctx.save();
    polyPath(ctx, f.basin); ctx.clip();
    const g = ctx.createLinearGradient(0, bx.y0, 0, bx.y1);
    g.addColorStop(0, 'rgba(255,200,90,0.06)'); g.addColorStop(1, 'rgba(255,170,60,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(bx.x0, bx.y0, bx.x1 - bx.x0, bx.y1 - bx.y0);
    tiles(ctx, 1);
    ctx.restore();

    b.save();
    polyPath(b, f.basin); b.clip();
    const cx = (bx.x0 + bx.x1) / 2;
    const rg = b.createRadialGradient(cx, bx.y1, 0, cx, bx.y1, 720);
    rg.addColorStop(0, 'rgba(255,214,120,' + (0.42 + 0.18 * kick).toFixed(3) + ')');
    rg.addColorStop(0.5, 'rgba(255,150,60,0.2)');
    rg.addColorStop(1, 'rgba(255,90,160,0.05)');
    b.fillStyle = rg;
    b.fillRect(bx.x0, bx.y0, bx.x1 - bx.x0, bx.y1 - bx.y0);
    tiles(b, 0.9);
    b.restore();

    // ligne d'arrivée en damier
    const m = f.mouth, sq = 10;
    for (let x = m.x0; x < m.x1; x += sq) {
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = ((Math.round(x / sq) + k) & 1) ? '#fff6dc' : '#1a0d2a';
        ctx.fillRect(x, m.y - sq + k * sq, sq, sq);
      }
    }
    b.fillStyle = 'rgba(255,240,200,' + (0.6 + 0.3 * kick).toFixed(3) + ')';
    b.fillRect(m.x0, m.y - 12, m.x1 - m.x0, 24);
    const lb = f.label;
    ctx.save();
    ctx.font = lb.size + 'px Monoton, Impact, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(24,8,30,0.55)';
    ctx.strokeText(lb.text, lb.x, lb.y);
    ctx.restore();
    neonText(b, lb.text, lb.x, lb.y, lb.size, '#fff1c4', 0.45 + 0.2 * kick);
  }

  // formes décorées : le diamant disco (or, rayons qui tournent, facettes qui scintillent au rythme)
  function drawShapes(L, b, v, time, beat, kick) {
    for (let i = 0; i < L.shapes.length; i++) {
      const sh = L.shapes[i];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      sh.pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      if (x1 < v.x0 || x0 > v.x1 || y1 < v.y0 || y0 > v.y1) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      ctx.save();
      polyPath(ctx, sh.pts); ctx.clip();
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffc21a'); g.addColorStop(1, '#ff8a10');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.35);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      const len = Math.max(x1 - x0, y1 - y0);
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * TAU;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, len, a, a + TAU / 32); ctx.closePath(); ctx.fill();
      }
      ctx.rotate(-time * 0.35 + Math.PI / 4);
      const T = 22, bi = Math.floor(beat * 2);
      for (let gy = -len; gy < len; gy += T) {
        for (let gx = -len; gx < len; gx += T) {
          const h = MR.hash(gx * 1.7 + gy * 3.3, bi);
          ctx.fillStyle = h > 0.88 ? 'rgba(255,255,255,0.85)' : 'rgba(120,60,0,' + (0.08 + h * 0.12).toFixed(3) + ')';
          ctx.fillRect(gx + 2, gy + 2, T - 4, T - 4);
        }
      }
      ctx.restore();
      b.fillStyle = 'rgba(255,200,60,' + (0.35 + 0.3 * kick).toFixed(3) + ')';
      polyPath(b, sh.pts); b.fill();
    }
  }

  // zones d'ascenseur : colonnes de chevrons « ^ » qui défilent vers le haut
  function drawZones(W, b, v, time) {
    for (let i = 0; i < W.zones.length; i++) {
      const z = W.zones[i];
      if (z.x1 < v.x0 || z.x0 > v.x1 || z.y1 < v.y0 || z.y0 > v.y1) continue;
      const cx = (z.x0 + z.x1) / 2, sz = 14, up = z.ay < 0;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let y = z.y1 - 40; y > z.y0 + 20; y -= 60) {
        const k = (y - z.y0) / 60;
        const a = 0.2 + 0.8 * Math.max(0, Math.sin(time * 8 + (up ? k : -k) * 1.1));
        const col = 'rgba(255,225,77,' + a.toFixed(3) + ')';
        const d = up ? -1 : 1;
        const path = function (c) { c.beginPath(); c.moveTo(cx - sz, y - d * sz * 0.4); c.lineTo(cx, y + d * sz * 0.6); c.lineTo(cx + sz, y - d * sz * 0.4); };
        path(ctx); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
        path(b); b.strokeStyle = col; b.lineWidth = 8; b.stroke();
      }
    }
  }

  function drawBoosts(W, b, v, time) {
    for (let k = 0; k < W.boosts.length; k++) {
      const bo = W.boosts[k];
      if (Math.max(bo.ax, bo.bx) < v.x0 || Math.min(bo.ax, bo.bx) > v.x1 || bo.ay > v.y1 + 40 || bo.ay < v.y0 - 40) continue;
      const n = 7, sz = 7;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n * bo.len;
        const cx = bo.ax + bo.dx * u + bo.nx * 16, cy = bo.ay + bo.dy * u + bo.ny * 16;
        const a = 0.25 + 0.75 * Math.max(0, Math.sin(time * 9 - i * 1.1)) + bo.hot * 0.3;
        const tipx = cx + bo.dx * sz, tipy = cy + bo.dy * sz;
        const path = function (c) {
          c.beginPath();
          c.moveTo(cx - bo.dx * sz + bo.nx * sz, cy - bo.dy * sz + bo.ny * sz);
          c.lineTo(tipx, tipy);
          c.lineTo(cx - bo.dx * sz - bo.nx * sz, cy - bo.dy * sz - bo.ny * sz);
        };
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        path(ctx); ctx.strokeStyle = 'rgba(63,240,255,' + Math.min(1, a).toFixed(3) + ')'; ctx.lineWidth = 3.5; ctx.stroke();
        path(b); b.strokeStyle = 'rgba(63,240,255,' + Math.min(1, a).toFixed(3) + ')'; b.lineWidth = 7; b.stroke();
      }
    }
  }

  /* ---------------- décor physique ---------------- */
  function tube(b, ax, ay, bx2, by2, t, K, flash) {
    ctx.strokeStyle = K.core; ctx.lineWidth = t * 2 + 1;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
    ctx.strokeStyle = K.body; ctx.lineWidth = Math.max(1, t * 2 - 3);
    ctx.stroke();
    ctx.strokeStyle = K.core; ctx.globalAlpha = 0.85; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    b.strokeStyle = K.glow; b.lineWidth = t * 2 + 4 + (flash || 0) * 8;
    b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx2, by2); b.stroke();
  }

  function drawGeometry(W, b, v, time) {
    ctx.lineCap = 'round'; b.lineCap = 'round';
    for (let i = 0; i < W.segs.length; i++) {
      const s = W.segs[i];
      if (s.maxx < v.x0 || s.minx > v.x1 || s.maxy < v.y0 || s.miny > v.y1) continue;
      tube(b, s.ax, s.ay, s.bx, s.by, s.t, KIND[s.kind] || KIND.wall, s.kick ? 0.35 + s.flash : 0);
      if (s.kick) {
        // trampoline : ressorts dessinés sous la toile
        const dx = s.bx - s.ax, dy = s.by - s.ay, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, sg = ny < 0 ? -1 : 1;
        ctx.strokeStyle = 'rgba(63,240,255,0.55)'; ctx.lineWidth = 2;
        for (let k = 1; k < 5; k++) {
          const px = s.ax + dx * k / 5, py = s.ay + dy * k / 5, h = 16 - s.flash * 8;
          ctx.beginPath(); ctx.moveTo(px, py);
          for (let z = 1; z <= 4; z++) ctx.lineTo(px + nx * sg * h * z / 4 + (z % 2 ? 5 : -5), py + ny * sg * h * z / 4);
          ctx.stroke();
        }
      }
    }
    // pistons d'égaliseur : pile de LED qui suit la hauteur
    for (let i = 0; i < W.pistons.length; i++) {
      const p = W.pistons[i];
      if (p.x + 20 < v.x0 || p.x - 20 > v.x1 || p.base + 30 < v.y0 || p.base - 60 > v.y1) continue;
      const h = Math.max(0, p.base - 5 - (p.top - p.t));
      const n = Math.floor(h / 8);
      for (let k = 0; k < n; k++) {
        const y = p.base - 12 - k * 8;
        const col = k < 2 ? '#3dffb0' : k < 4 ? '#ffe14d' : '#ff3ea5';
        ctx.fillStyle = col; ctx.fillRect(p.x - 7, y, 14, 6);
        b.fillStyle = col; b.fillRect(p.x - 9, y - 1, 18, 8);
      }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x - 7, p.top - p.t, 14, 3);
    }
    for (let i = 0; i < W.sliders.length; i++) {
      const s = W.sliders[i];
      if (Math.max(s.x0, s.x1) < v.x0 || Math.min(s.x0, s.x1) > v.x1 || Math.max(s.y0, s.y1) + 20 < v.y0 || Math.min(s.y0, s.y1) - 20 > v.y1) continue;
      const open = s.hold && s.hold.open;
      tube(b, s.x0, s.y0, s.x1, s.y1, s.t, open ? KIND.open : KIND.gate, open ? s.flash : (1 - s.q) * 0.6 + (s.hold ? 0.25 * Math.abs(Math.sin(time * 5)) : 0));
    }
    for (let i = 0; i < W.arms.length; i++) {
      const a = W.arms[i];
      if (Math.max(a.px, a.ex) < v.x0 || Math.min(a.px, a.ex) > v.x1 || Math.max(a.py, a.ey) < v.y0 || Math.min(a.py, a.ey) > v.y1) continue;
      tube(b, a.px, a.py, a.ex, a.ey, a.t, KIND[a.kind] || KIND.rotor, a.flash);
    }
    for (let i = 0; i < W.circles.length; i++) {
      const c = W.circles[i];
      if (c.x + 40 < v.x0 || c.x - 40 > v.x1 || c.y + 40 < v.y0 || c.y - 40 > v.y1) continue;
      const f = c.flash;
      if (c.kind === 'peg') {
        ctx.fillStyle = '#1a0d2a';
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 1.2, 0, TAU); ctx.stroke();
        if (f > 0.02) { ctx.fillStyle = 'rgba(255,244,210,' + f.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 2, 0, TAU); ctx.fill(); }
        b.fillStyle = 'rgba(255,200,80,' + (0.4 + 0.6 * f).toFixed(3) + ')';
        b.beginPath(); b.arc(c.x, c.y, c.r * (1.2 + f * 0.9), 0, TAU); b.fill();
      } else if (c.kind === 'bumper') {
        const rr = c.r * (1 + 0.16 * f);
        ctx.fillStyle = '#26092e';
        ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ff3ea5'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(c.x, c.y, rr - 2, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,150,210,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c.x, c.y, rr * 0.55, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.55 * f).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(c.x, c.y, rr * 0.22, 0, TAU); ctx.fill();
        b.fillStyle = 'rgba(255,62,165,' + (0.55 + 0.45 * f).toFixed(3) + ')';
        b.beginPath(); b.arc(c.x, c.y, rr * (1.25 + f * 0.5), 0, TAU); b.fill();
      } else if (c.kind === 'turntable') {
        // boule à facettes qui tourne
        ctx.save();
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.clip();
        ctx.fillStyle = '#1a1230'; ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
        ctx.translate(c.x, c.y); ctx.rotate(c.angle || 0);
        const T = 11, bi = Math.floor(time * 6);
        for (let gy = -c.r; gy < c.r; gy += T) {
          for (let gx = -c.r; gx < c.r; gx += T) {
            const h = MR.hash(gx * 3.1 + gy * 7.7, bi + gx);
            const l = 35 + h * 45;
            ctx.fillStyle = h > 0.86 ? 'hsl(' + TILE_HUES[(Math.floor(h * 97)) & 3] + ',95%,70%)' : 'hsl(250,15%,' + l.toFixed(0) + '%)';
            ctx.fillRect(gx + 1, gy + 1, T - 2, T - 2);
          }
        }
        ctx.restore();
        const sh = ctx.createRadialGradient(c.x - c.r * 0.35, c.y - c.r * 0.4, 2, c.x, c.y, c.r);
        sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 1, 0, TAU); ctx.stroke();
        b.fillStyle = 'rgba(255,220,150,' + (0.45 + 0.4 * f).toFixed(3) + ')';
        b.beginPath(); b.arc(c.x, c.y, c.r * 1.25, 0, TAU); b.fill();
      } else if (c.kind === 'hub') {
        ctx.fillStyle = '#1b0b30';
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#c78bff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 1.5, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#f4edff';
        ctx.beginPath(); ctx.arc(c.x, c.y, 3.5, 0, TAU); ctx.fill();
        b.fillStyle = 'rgba(190,120,255,0.8)';
        b.beginPath(); b.arc(c.x, c.y, c.r * 1.4, 0, TAU); b.fill();
      }
    }
  }

  // portes de regroupement : compteur « billes arrivées / billes attendues », puis GO !
  function drawHolds(G, W, b, v, kick) {
    for (let i = 0; i < W.sliders.length; i++) {
      const h = W.sliders[i].hold;
      if (!h || !h.label) continue;
      const lb = h.label;
      if (lb.y + 60 < v.y0 || lb.y - 60 > v.y1 || lb.x + 200 < v.x0 || lb.x - 200 > v.x1) continue;
      if (h.open) {
        const t = G.raceTime - (h.openAt || 0);
        if (t < 2.2) neonText(b, 'GO !', lb.x, lb.y, 40, '#7dffb0', Math.max(0, 1 - t / 2.2));
      } else if (G.state === 'racing' && h.inside > 0) {
        neonText(b, h.inside + ' / ' + h.need, lb.x, lb.y, 30, '#ffcf4a', 0.55 + 0.35 * kick);
      }
    }
  }

  // niveau 4 : cercles néon qui tournent, vague lumineuse et ondes au rythme de la musique
  function drawRings(G, W, L, b, beat, kick) {
    if (!W.rings.length || !L.center) return;
    const c = L.center, ph = beat - Math.floor(beat);
    const act = W.rings[W.ringIdx];
    if (act) {
      for (let k = 0; k < 2; k++) {
        const p = (ph + k * 0.5) % 1, rr = act.R + 20 + p * 620;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.09 * (1 - p)).toFixed(3) + ')';
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, TAU); ctx.stroke();
        b.strokeStyle = MR.rgbStr(act.rgb, 0.3 * (1 - p)); b.lineWidth = 8;
        b.beginPath(); b.arc(c.x, c.y, rr, 0, TAU); b.stroke();
      }
      // halo intérieur qui bat la mesure
      const g = b.createRadialGradient(c.x, c.y, 0, c.x, c.y, act.R);
      g.addColorStop(0, MR.rgbStr(act.rgb, 0.05 + 0.12 * kick)); g.addColorStop(1, MR.rgbStr(act.rgb, 0));
      b.fillStyle = g; b.beginPath(); b.arc(c.x, c.y, act.R, 0, TAU); b.fill();
    }
    ctx.lineCap = 'round'; b.lineCap = 'round';
    for (let k = W.rings.length - 1; k >= W.ringIdx; k--) {
      const rg = W.rings[k], first = k === W.ringIdx;
      // une vague de lumière part du centre à chaque temps
      const dk = k - W.ringIdx - ph * 16, wave = Math.exp(-dk * dk / 5);
      const p = Math.max(rg.pulse, wave);
      const a0 = rg.angle + rg.gap, a1 = rg.angle + TAU - rg.gap;
      const core = first ? [255, 255, 255] : MR.mixRgb(rg.rgb, [255, 255, 255], 0.35 + 0.4 * p);
      ctx.strokeStyle = MR.rgbStr(core, first ? 1 : 0.55 + 0.45 * p);
      ctx.lineWidth = rg.t * 2 * (first ? 1.15 : 0.8) + p * 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, rg.R, a0, a1); ctx.stroke();
      b.strokeStyle = MR.rgbStr(rg.rgb, (first ? 0.9 : 0.35) + 0.5 * p);
      b.lineWidth = rg.t * 2 + (first ? 10 : 4) + p * 10;
      b.beginPath(); b.arc(c.x, c.y, rg.R, a0, a1); b.stroke();
      if (first) {
        // bords du trou bien visibles
        for (let s2 = -1; s2 <= 1; s2 += 2) {
          const ea = rg.angle + s2 * rg.gap, ex = c.x + Math.cos(ea) * rg.R, ey = c.y + Math.sin(ea) * rg.R;
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, ey, rg.t + 2, 0, TAU); ctx.fill();
          b.fillStyle = MR.rgbStr(rg.rgb, 1); b.beginPath(); b.arc(ex, ey, rg.t + 8, 0, TAU); b.fill();
        }
      }
    }
  }

  /* ---------------- billes ---------------- */
  const visible = [], specs = [];
  function drawMarbles(G, b, v, time, beat) {
    const ms = G.marbles;
    visible.length = 0;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (!m.out && m.x + 70 > v.x0 && m.x - 70 < v.x1 && m.y + 70 > v.y0 && m.y - 70 < v.y1) visible.push(m);
    }
    if (!visible.length) return;
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    for (let i = 0; i < visible.length; i++) {
      const m = visible[i];
      ctx.beginPath(); ctx.ellipse(m.x + 4, m.y + 6, m.r * 1.02, m.r * 0.97, 0, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < visible.length; i++) {
      const m = visible[i];
      MR.FX.drawOutlineUnder(ctx, b, m, time, beat);
      b.fillStyle = MR.rgbStr(m.rgb, (EMISSIVE[m.cfg.skin] || 0.14) * G.settings.glow);
      b.beginPath(); b.arc(m.x, m.y, m.r * 1.02, 0, TAU); b.fill();
    }
    const GL = MR.MarbleGL;
    if (GL.ok) {
      specs.length = 0;
      for (let i = 0; i < visible.length; i++) {
        const m = visible[i];
        m.spec = GL.spec(m.cfg, m.angle, m.spec);
        specs.push(m.spec);
      }
      const tile = Math.ceil(2 * visible[0].r * cam.s * R.dpr) + 2;
      const slots = GL.render(specs, tile, time, 0);
      for (let i = 0; i < visible.length; i++) {
        const m = visible[i];
        if (slots[i]) GL.blit(ctx, slots[i], m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
        else GL.fallback(ctx, m.x, m.y, m.r, m.cfg);
      }
    } else {
      for (let i = 0; i < visible.length; i++) GL.fallback(ctx, visible[i].x, visible[i].y, visible[i].r, visible[i].cfg);
    }
    for (let i = 0; i < visible.length; i++) MR.FX.drawOutline(ctx, b, visible[i], time, beat);

    if (G.followId) {
      for (let i = 0; i < visible.length; i++) {
        const m = visible[i];
        if (m.id !== G.followId) continue;
        const y = m.y - m.r - 10 - Math.abs(Math.sin(time * 4)) * 4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(m.x - 6, y - 9); ctx.lineTo(m.x + 6, y - 9); ctx.lineTo(m.x, y); ctx.closePath(); ctx.fill();
        b.fillStyle = 'rgba(255,255,255,0.8)';
        b.beginPath(); b.arc(m.x, y - 5, 7, 0, TAU); b.fill();
      }
    }
  }

  function ordinal(n) { return n === 1 ? '1er' : n + 'e'; }

  function drawNames(G) {
    const mode = G.settings.names;
    if (mode === 'none') return;
    const s = cam.s, vw = R.vw, vh = R.vh;
    const size = Math.round((G.settings.labelSize || 12) * (s < 0.45 ? 0.85 : 1));
    ctx.font = '600 ' + size + 'px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineJoin = 'round';
    const rk = G.ranking;
    const n = mode === 'top3' ? Math.min(3, rk.length) : rk.length;
    const cx = R.cx();
    const idx = [];
    for (let i = n - 1; i >= 0; i--) idx.push(i);
    for (let i = n; i < rk.length; i++) if (rk[i].cfg.me) idx.unshift(i); // ta bille garde toujours son nom
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], m = rk[i], me = m.cfg.me;
      if (m.out) continue;
      if (m.finished && i > 2 && m.id !== G.followId && !me) continue; // bassin d'arrivée : seul le podium garde son nom
      const sx = (m.x - cam.x) * s + cx, sy = (m.y - cam.y) * s + vh / 2 - m.r * s - 6;
      if (sx < -100 || sx > vw + 100 || sy < -20 || sy > vh + 40) continue;
      const name = (me ? '★ ' : '') + m.cfg.name;
      const label = m.finished && !m.dnf ? ordinal(m.rank) + ' · ' + name : name;
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(8,4,15,0.88)';
      ctx.strokeText(label, sx, sy);
      ctx.fillStyle = me ? '#7dfcff' : i === 0 && G.state !== 'ready' ? '#ffcf4a' : '#f4edff';
      ctx.fillText(label, sx, sy);
    }
  }

  function drawVignette() {
    if (!vignette) {
      vignette = ctx.createRadialGradient(R.vw / 2, R.vh / 2, Math.min(R.vw, R.vh) * 0.38, R.vw / 2, R.vh / 2, Math.hypot(R.vw, R.vh) * 0.62);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, R.vw, R.vh);
  }

  R.draw = function (G) {
    const L = G.level, W = G.world, time = G.time;
    const vw = R.vw, vh = R.vh, dpr = R.dpr, s = cam.s;
    const beat = MR.Audio.beat(), ph = beat - Math.floor(beat), kick = Math.exp(-ph * 4.5);
    const it = R.insetTarget();
    R.inset += (it - R.inset) * 0.14;
    if (Math.abs(it - R.inset) < 0.5) R.inset = it;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawBackground(time, kick, beat, L);

    const b = bloom.begin();
    const cxs = R.cx();
    const ox = cxs - cam.x * s, oy = vh / 2 - cam.y * s;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    b.setTransform(s / 4, 0, 0, s / 4, ox / 4, oy / 4);
    const v = { x0: cam.x - cxs / s - 60, x1: cam.x + (vw - cxs) / s + 60, y0: cam.y - vh / 2 / s - 60, y1: cam.y + vh / 2 / s + 60 };

    drawBoard(L, v);
    drawFinish(L, b, v, time, beat, kick);
    drawSigns(L, b, v, time, kick);
    drawShapes(L, b, v, time, beat, kick);
    drawBoosts(W, b, v, time);
    drawZones(W, b, v, time);
    drawRings(G, W, L, b, beat, kick);
    drawHolds(G, W, b, v, kick);
    for (let i = 0; i < G.marbles.length; i++) {
      const m = G.marbles[i];
      if (m.hist.length && m.x + 300 > v.x0 && m.x - 300 < v.x1 && m.y + 300 > v.y0 && m.y - 300 < v.y1) MR.FX.drawTrail(ctx, b, m, time);
    }
    G.fx.drawUnder(ctx, b);
    drawGeometry(W, b, v, time);
    drawMarbles(G, b, v, time, beat);
    G.fx.drawOver(ctx, b);

    if (G.settings.bloom > 0.01) bloom.apply(ctx, G.settings.bloom);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawNames(G);
    if (G.settings.vignette) drawVignette();
  };

  MR.Render = R;
})(window.MR);
