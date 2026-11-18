/* MagicRace — ouverture des paquets de cartes (animations), collection et fiche de carte */
(function (MR) {
  'use strict';

  const P = {};
  const TAU = Math.PI * 2;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = function (s) { return document.querySelector(s); };

  let ov, stage, deal, coll, spot, spotTitle, spotHint, dim, flashEl, zoom, packBtn;
  let midCv, midCtx, frontCv, frontCtx, dpr = 1, W = 1, H = 1;
  let isOpen = false, tab = 'packs', phase = 'idle', busy = false, auto = false, packType = 'normal';
  let pulls = [], cards = [], lastTilt = null, tapResolve = null, collIO = null;
  let counterT = 0, lastPacks = -1;
  const arts = [];

  function reduced() { return MR.Render && MR.Render.reducedMotion; }
  // réglages « ouverture rapide » et « secousses et flashs » du menu Paramètres
  function fast() { return !!(MR.Game && MR.Game.settings.cardFast); }
  function calm() { return reduced() || !(MR.Game && MR.Game.settings.shake); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function anim(el, kf, opt) {
    try { return el.animate(kf, opt).finished.catch(function () {}); } catch (e) { return Promise.resolve(); }
  }
  function rgbOf(hex) { return MR.hexToRgb255(hex); }
  function rs(rgb, a) { return MR.rgbStr(rgb, a); }
  function center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r }; }
  function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }
  // 70 → « 70 % », 1.5 → « 1,5 % », 0.25 → « 0,25 % » (on ne retire que les zéros après la virgule)
  function pct(v) {
    let s = v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : String(Math.round(v));
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',') + ' %';
  }

  /* =====================================================================
   * Effets (deux canvas : rayons derrière la carte, particules devant)
   * ===================================================================== */
  const fx = { parts: [], rings: [], bolts: [], rays: { a: 0, target: 0, x: 0, y: 0, rgb: [255, 255, 255], rot: 0, scale: 1 }, implode: null, rain: 0, boltZone: null };

  function resizeFx() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    [midCv, frontCv].forEach(function (cv) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); });
  }

  function implode(x, y, rgb, ms, rate, scale) {
    fx.implode = { x: x, y: y, rgb: rgb, until: performance.now() + ms, rate: reduced() ? rate * 0.3 : rate, acc: 0, scale: scale || 1 };
  }
  function sparks(x, y, rgb, n, power, dir, spread) {
    if (reduced()) n = Math.ceil(n * 0.4);
    for (let i = 0; i < n; i++) {
      const a = dir == null ? Math.random() * TAU : dir + MR.rand(-(spread || 0.9), spread || 0.9);
      const s = MR.rand(200, 900) * (power || 1), l = MR.rand(0.5, 1.2);
      fx.parts.push({ k: 'spark', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 420, drag: 1.8, life: l, max: l,
        size: MR.rand(1.4, 3.2), rgb: Math.random() < 0.3 ? [255, 255, 255] : rgb });
    }
  }
  function glitter(x, y, n, hue0, hue1, power) {
    if (reduced()) n = Math.ceil(n * 0.4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = MR.rand(60, 520) * (power || 1), l = MR.rand(0.8, 1.8);
      fx.parts.push({ k: 'glit', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, g: 160, drag: 1.4, life: l, max: l,
        size: MR.rand(2.5, 6), hue: MR.rand(hue0, hue1), rot: Math.random() * TAU, spin: MR.rand(-9, 9) });
    }
  }
  function confetti(x, y, n, fromTop) {
    if (reduced()) n = Math.ceil(n * 0.3);
    for (let i = 0; i < n; i++) {
      const l = MR.rand(2, 3.6);
      fx.parts.push(fromTop
        ? { k: 'conf', x: MR.rand(0, W), y: -20, vx: MR.rand(-40, 40), vy: MR.rand(60, 200), g: 120, drag: 0.8, life: l, max: l, size: MR.rand(4, 8), hue: MR.pick([45, 50, 330, 190, 275, 30]), rot: Math.random() * TAU, spin: MR.rand(-8, 8) }
        : { k: 'conf', x: x, y: y, vx: MR.rand(-650, 650), vy: MR.rand(-900, -200), g: 700, drag: 1.2, life: l, max: l, size: MR.rand(4, 9), hue: MR.pick([45, 50, 330, 190, 275, 30]), rot: Math.random() * TAU, spin: MR.rand(-12, 12) });
    }
  }
  function ring(x, y, rgb, speed, width, life) {
    fx.rings.push({ x: x, y: y, r: 10, vr: speed || 900, w: width || 6, life: life || 0.7, max: life || 0.7, rgb: rgb });
  }
  function boltsOn(rect, rgb, ms, sparse) {
    fx.boltZone = { rect: rect, rgb: rgb, until: performance.now() + ms, acc: 1, sparse: !!sparse };
  }
  function makeBolts() {
    const z = fx.boltZone, R = z.rect;
    fx.bolts.length = 0;
    const n = z.sparse ? 1 + (Math.random() < 0.5 ? 1 : 0) : 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const side = Math.floor(Math.random() * 4);
      let x, y, a;
      if (side === 0) { x = R.x + Math.random() * R.w; y = R.y; a = -Math.PI / 2; }
      else if (side === 1) { x = R.x + R.w; y = R.y + Math.random() * R.h; a = 0; }
      else if (side === 2) { x = R.x + Math.random() * R.w; y = R.y + R.h; a = Math.PI / 2; }
      else { x = R.x; y = R.y + Math.random() * R.h; a = Math.PI; }
      const pts = [[x, y]];
      const segs = 6 + Math.floor(Math.random() * 7);
      for (let k = 0; k < segs; k++) {
        a += MR.rand(-0.85, 0.85);
        const len = MR.rand(10, 28);
        x += Math.cos(a) * len; y += Math.sin(a) * len;
        pts.push([x, y]);
      }
      fx.bolts.push({ pts: pts, rgb: z.rgb });
    }
    if (!z.sparse && Math.random() < 0.6) MR.Audio.crackle();
  }

  function fxUpdate(dt) {
    const now = performance.now();
    const R = fx.rays;
    R.a += (R.target - R.a) * Math.min(1, dt * 3);
    R.rot += dt * (reduced() ? 0.05 : 0.32);
    const im = fx.implode;
    if (im && now < im.until) {
      im.acc += dt * im.rate;
      while (im.acc >= 1) {
        im.acc -= 1;
        const a = Math.random() * TAU, rad = MR.rand(220, 560) * im.scale;
        fx.parts.push({ k: 'ember', cx: im.x, cy: im.y, a: a, rad: rad, w: MR.rand(1.2, 3) * (Math.random() < 0.5 ? 1 : -1), sp: MR.rand(150, 300),
          life: 4, max: 4, rgb: Math.random() < 0.25 ? [255, 255, 255] : im.rgb, size: MR.rand(1.4, 3.4), x: im.x + Math.cos(a) * rad, y: im.y + Math.sin(a) * rad, px: 0, py: 0 });
      }
    } else fx.implode = null;
    if (fx.rain > 0) {
      fx.rain -= dt;
      if (Math.random() < dt * 45) confetti(0, 0, 1, true);
      if (Math.random() < dt * 30) {
        const l = MR.rand(1.5, 2.6);
        fx.parts.push({ k: 'glit', x: MR.rand(0, W), y: -10, vx: MR.rand(-20, 20), vy: MR.rand(80, 200), g: 40, drag: 0.4, life: l, max: l, size: MR.rand(2.5, 5), hue: MR.rand(38, 55), rot: 0, spin: MR.rand(-6, 6) });
      }
    }
    const bz = fx.boltZone;
    if (bz && now < bz.until) {
      bz.acc += dt;
      if (bz.acc > (bz.sparse ? 0.12 : 0.07)) { bz.acc = 0; makeBolts(); }
    } else { fx.boltZone = null; fx.bolts.length = 0; }

    const p = fx.parts;
    let j = 0;
    for (let i = 0; i < p.length; i++) {
      const q = p[i];
      q.life -= dt;
      if (q.life <= 0) continue;
      if (q.k === 'ember') {
        q.px = q.x; q.py = q.y;
        q.rad -= q.sp * dt * (1 + 2.6 * (1 - Math.min(1, q.rad / 560)));
        q.a += q.w * dt;
        q.x = q.cx + Math.cos(q.a) * q.rad; q.y = q.cy + Math.sin(q.a) * q.rad;
        if (q.rad < 12) continue;
      } else {
        if (q.g) q.vy += q.g * dt;
        if (q.drag) { const f = Math.max(0, 1 - q.drag * dt); q.vx *= f; q.vy *= f; }
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.spin) q.rot += q.spin * dt;
        if (q.y > H + 40) continue;
      }
      p[j++] = q;
    }
    p.length = j;
    if (p.length > 2200) p.splice(0, p.length - 2200);
    let k = 0;
    for (let i = 0; i < fx.rings.length; i++) {
      const g = fx.rings[i];
      g.life -= dt;
      if (g.life <= 0) continue;
      g.r += g.vr * dt; g.vr *= Math.max(0, 1 - dt * 1.6);
      fx.rings[k++] = g;
    }
    fx.rings.length = k;
  }

  function drawRays(c) {
    const R = fx.rays;
    if (R.a < 0.01) return;
    const len = Math.hypot(W, H) * 0.8;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.translate(R.x, R.y);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 380 * R.scale);
    g.addColorStop(0, rs(R.rgb, 0.55 * R.a)); g.addColorStop(1, rs(R.rgb, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 380 * R.scale, 0, TAU); c.fill();
    [[16, R.rot, 0.075, 0.24], [10, -R.rot * 0.7 + 0.3, 0.045, 0.16]].forEach(function (L) {
      c.save();
      c.rotate(L[1]);
      const gr = c.createRadialGradient(0, 0, 30, 0, 0, len);
      gr.addColorStop(0, rs(R.rgb, L[3] * R.a)); gr.addColorStop(1, rs(R.rgb, 0));
      c.fillStyle = gr;
      for (let i = 0; i < L[0]; i++) {
        const a = i / L[0] * TAU;
        c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, len, a - L[2], a + L[2]); c.closePath(); c.fill();
      }
      c.restore();
    });
    c.restore();
  }

  function fxDraw() {
    midCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    midCtx.clearRect(0, 0, W, H);
    drawRays(midCtx);
    const c = frontCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const p = fx.parts;
    // confettis (opaques)
    for (let i = 0; i < p.length; i++) {
      const q = p[i];
      if (q.k !== 'conf') continue;
      const k = q.life / q.max;
      c.save();
      c.translate(q.x, q.y); c.rotate(q.rot);
      c.fillStyle = 'hsla(' + q.hue + ',95%,62%,' + Math.min(1, k * 3).toFixed(3) + ')';
      c.fillRect(-q.size, -q.size * 0.45 * Math.cos(q.rot * 2), q.size * 2, q.size * 0.9 * Math.cos(q.rot * 2));
      c.restore();
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < p.length; i++) {
      const q = p[i], k = q.life / q.max;
      if (q.k === 'spark') {
        c.strokeStyle = rs(q.rgb, k); c.lineWidth = q.size;
        c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); c.stroke();
      } else if (q.k === 'ember') {
        const near = 1 - Math.min(1, q.rad / 560);
        c.strokeStyle = rs(q.rgb, 0.35 + 0.65 * near); c.lineWidth = q.size;
        c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.px || q.x, q.py || q.y); c.stroke();
      } else if (q.k === 'glit') {
        const tw = 0.5 + 0.5 * Math.sin(q.rot * 3), s = q.size * (0.5 + 0.9 * tw);
        c.fillStyle = 'hsla(' + q.hue.toFixed(0) + ',100%,74%,' + Math.min(1, k * 1.5 * (0.5 + 0.5 * tw)).toFixed(3) + ')';
        c.fillRect(q.x - s, q.y - s * 0.16, s * 2, s * 0.32);
        c.fillRect(q.x - s * 0.16, q.y - s, s * 0.32, s * 2);
      }
    }
    for (let i = 0; i < fx.rings.length; i++) {
      const g = fx.rings[i], k = g.life / g.max;
      c.strokeStyle = rs(g.rgb, k * 0.9); c.lineWidth = g.w * k + 1;
      c.beginPath(); c.arc(g.x, g.y, g.r, 0, TAU); c.stroke();
      c.strokeStyle = rs([255, 255, 255], k * 0.5); c.lineWidth = 1.5;
      c.beginPath(); c.arc(g.x, g.y, g.r * 0.97, 0, TAU); c.stroke();
    }
    for (let i = 0; i < fx.bolts.length; i++) {
      const b = fx.bolts[i];
      const path = function () { c.beginPath(); b.pts.forEach(function (pt, n) { if (n) c.lineTo(pt[0], pt[1]); else c.moveTo(pt[0], pt[1]); }); };
      path(); c.strokeStyle = rs(b.rgb, 0.3); c.lineWidth = 8; c.stroke();
      c.strokeStyle = rs(b.rgb, 0.95); c.lineWidth = 2.6; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 1; c.stroke();
    }
    c.restore();
  }

  function flash(alpha, rgb, ms) {
    if (calm()) alpha *= 0.25;
    flashEl.style.background = rs(rgb, 1);
    anim(flashEl, [{ opacity: alpha }, { opacity: 0 }], { duration: ms, easing: 'cubic-bezier(.2,.6,.3,1)' });
  }
  function shake(el, amp, ms) {
    if (calm()) return Promise.resolve();
    const n = Math.max(4, Math.round(ms / 35)), kf = [];
    for (let i = 0; i <= n; i++) {
      const a = amp * (1 - i / n);
      kf.push({ transform: i === n ? 'none' : 'translate(' + MR.rand(-a, a).toFixed(1) + 'px,' + MR.rand(-a, a).toFixed(1) + 'px)' });
    }
    return anim(el, kf, { duration: ms, easing: 'linear' });
  }

  /* =====================================================================
   * Cartes (DOM) et rendu animé des billes dessus
   * ===================================================================== */
  function makeCard(card, o) {
    o = o || {};
    const r = MR.rarity(card.rarity);
    const el = document.createElement('div');
    el.className = 'card r-' + card.rarity + (o.mini ? ' mini' : '') + (o.faceUp ? ' flipped noanim' : ' down') + (o.locked ? ' locked' : '');
    el.style.setProperty('--rc', r.color);
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', o.faceUp ? (o.locked ? 'Carte ' + r.name.toLowerCase() + ' pas encore obtenue' : card.name + ', carte ' + r.name.toLowerCase()) : 'Carte face cachée, la retourner');
    let pips = '';
    for (let i = 0; i <= r.rank; i++) pips += '<i></i>';
    el.innerHTML =
      '<div class="card-tilt"><div class="card-inner">' +
        '<div class="face back"><span class="back-rays"></span><span class="back-ball"></span><span class="back-logo">MagicRace</span><span class="back-sub">Carte bille</span></div>' +
        '<div class="face front"><div class="cf">' +
          '<div class="cf-top"><span class="cf-rar">' + r.name + '</span><span class="cf-pips">' + pips + '</span></div>' +
          '<div class="cf-art"><canvas></canvas></div>' +
          '<div class="cf-name">' + (o.locked ? '???' : MR.esc(card.name)) + '</div>' +
          '<div class="cf-blurb">' + (o.locked ? 'Pas encore obtenue' : MR.esc(card.blurb)) + '</div>' +
        '</div><div class="cf-foil"></div><div class="cf-glare"></div></div>' +
      '</div></div>';
    if (o.count > 1) {
      const b = document.createElement('span');
      b.className = 'count-tag'; b.textContent = '×' + o.count;
      el.appendChild(b);
    }
    if (o.isNew) addNew(el, false);
    const cv = el.querySelector('canvas');
    const art = { cv: cv, ctx: cv.getContext('2d'), card: card, el: el, locked: !!o.locked, spec: {}, phase: Math.random() * 6, drawn: false };
    arts.push(art);
    el._art = art;
    return el;
  }
  function addNew(el, stamp) {
    if (el.querySelector('.new-tag')) return;
    const b = document.createElement('span');
    b.className = 'new-tag' + (stamp ? ' stamp' : '');
    b.textContent = 'Nouveau !';
    el.appendChild(b);
  }

  // dessine les billes des cartes visibles (shaders animés)
  function renderArts(time) {
    const GL = MR.MarbleGL;
    for (let i = arts.length - 1; i >= 0; i--) if (!arts[i].el.isConnected) arts.splice(i, 1);
    const groups = {};
    for (let i = 0; i < arts.length; i++) {
      const a = arts[i];
      const css = a.cv.clientWidth;
      if (!css) continue;
      if (a.locked) {
        if (!a.drawn) {
          a.cv.width = a.cv.height = 160;
          GL.silhouette(a.ctx, 80, 80, 74);
          a.drawn = true;
        }
        continue;
      }
      if (a.el.classList.contains('down') && !a.el.classList.contains('flipped') && !a.forceArt) continue;
      if (a.vis === false) continue; // carte de la collection hors de l'écran
      const px = Math.min(384, Math.max(48, Math.ceil(css * dpr / 32) * 32));
      (groups[px] = groups[px] || []).push(a);
    }
    Object.keys(groups).forEach(function (key) {
      const list = groups[key], tile = +key;
      const cap = Math.max(1, Math.floor(GL.ATLAS_W / tile) * Math.floor((GL.ATLAS_H - GL.MAIN_H) / tile));
      for (let start = 0; start < list.length; start += cap) {
        const chunk = list.slice(start, start + cap);
        const specs = chunk.map(function (a) { return GL.spec(a.card, time * 0.55 + a.phase, a.spec); });
        const slots = GL.ok ? GL.render(specs, tile, time, 1) : [];
        chunk.forEach(function (a, i) {
          if (a.cv.width !== tile) { a.cv.width = a.cv.height = tile; }
          const k = a.card.kind;
          if (k === 'trail' || k === 'sound' || k === 'outline') { effectScene(a, slots[i], tile, time); return; }
          a.ctx.clearRect(0, 0, tile, tile);
          if (slots[i]) GL.blit(a.ctx, slots[i], 0, 0, tile, tile);
          else GL.fallback(a.ctx, tile / 2, tile / 2, tile / 2 - 2, a.card);
        });
      }
    });
  }

  // carte d'effet : une petite scène animée qui montre la traînée, le contour ou le bruit
  function effectScene(a, slot, S, time) {
    const c = a.ctx, k = a.card.kind, GL = MR.MarbleGL;
    let f = a.fx;
    if (!f || f.S !== S) {
      const col = MR.hexToRgb255(a.card.color);
      f = a.fx = { S: S, sys: new MR.FX.System(), t: a.phase, last: time, ph: 1,
        m: { id: 'card', x: S / 2, y: S / 2, vx: 0, vy: 0, r: S * (k === 'trail' ? 0.1 : k === 'sound' ? 0.14 : 0.2), angle: 0, hist: [], emit: 0, rgb: col, orgb: col, seedN: 7,
          cfg: { skin: 'solid', color: a.card.color, trail: k === 'trail' ? a.card.effect : 'none', sound: 'none', outline: k === 'outline' ? a.card.effect : 'none', outlineColor: a.card.color, seed: 0.5 } } };
    }
    const dt = Math.min(0.05, Math.max(0, time - f.last));
    f.last = time; f.t += dt;
    const m = f.m, floor = S * 0.8;
    if (k === 'trail') {
      const nx = S / 2 + Math.sin(f.t * 1.6) * S * 0.3, ny = S / 2 + Math.sin(f.t * 3.2) * S * 0.16;
      if (dt > 0) { m.vx = (nx - m.x) / dt; m.vy = (ny - m.y) / dt; }
      m.x = nx; m.y = ny; m.angle += m.vx / m.r * dt;
      MR.FX.trailTick(f.sys, m, dt, time);
    } else if (k === 'outline') {
      m.x = S / 2; m.y = S / 2 + Math.sin(f.t * 2) * S * 0.03; m.angle += dt * 0.8;
    } else {
      const ph = Math.abs(Math.sin(f.t * 2.6));
      m.x = S / 2; m.y = floor - m.r - ph * S * 0.34; m.angle += dt;
      if (ph < 0.1 && f.ph >= 0.1) {
        f.sys.add({ kind: 'ring', x: m.x, y: floor, vx: 0, vy: 0, life: 0.6, max: 0.6, size: m.r * 0.5, grow: S * 0.3, rgb: m.rgb });
        f.sys.add({ kind: 'ring', x: m.x, y: floor, vx: 0, vy: 0, life: 0.45, max: 0.45, size: m.r * 0.3, grow: S * 0.18, rgb: [255, 255, 255] });
      }
      f.ph = ph;
    }
    f.sys.update(dt);
    const beat = MR.Audio.beat();
    c.clearRect(0, 0, S, S);
    if (k === 'sound') {
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = Math.max(1, S * 0.012);
      c.beginPath(); c.moveTo(S * 0.18, floor); c.lineTo(S * 0.82, floor); c.stroke();
      c.fillStyle = MR.rgbStr(m.rgb, 0.9);
      c.font = '700 ' + Math.round(S * 0.2) + 'px Outfit, system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('♪', S * 0.2, S * 0.24 + Math.sin(f.t * 3) * S * 0.02);
      c.fillText('♫', S * 0.8, S * 0.3 + Math.cos(f.t * 3) * S * 0.02);
    }
    MR.FX.drawTrail(c, null, m, time);
    f.sys.drawUnder(c, null);
    MR.FX.drawOutlineUnder(c, null, m, time, beat);
    if (slot) GL.blit(c, slot, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    else GL.fallback(c, m.x, m.y, m.r, a.card);
    MR.FX.drawOutline(c, null, m, time, beat);
    f.sys.drawOver(c, null);
  }

  // inclinaison 3D + reflet holographique qui suit le pointeur
  function onTilt(e) {
    const card = e.target.closest ? e.target.closest('.card.tiltable') : null;
    if (lastTilt && lastTilt !== card) untilt(lastTilt);
    if (!card) return;
    lastTilt = card;
    const r = card.getBoundingClientRect();
    const x = MR.clamp((e.clientX - r.left) / r.width, 0, 1), y = MR.clamp((e.clientY - r.top) / r.height, 0, 1);
    const k = card.classList.contains('mini') ? 0.6 : 1;
    card.style.setProperty('--rx', ((0.5 - y) * 20 * k).toFixed(2) + 'deg');
    card.style.setProperty('--ry', ((x - 0.5) * 24 * k).toFixed(2) + 'deg');
    card.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
    card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    card.style.setProperty('--fx', (x * 100).toFixed(1) + '%');
    card.style.setProperty('--fy', (y * 100).toFixed(1) + '%');
    card.classList.add('tilting');
  }
  function untilt(card) {
    card.classList.remove('tilting');
    ['--rx', '--ry'].forEach(function (k) { card.style.setProperty(k, '0deg'); });
  }

  /* =====================================================================
   * Ouverture
   * ===================================================================== */
  function setPhase(p) {
    phase = p;
    ['idle', 'opening', 'dealing', 'reveal', 'done'].forEach(function (k) { ov.classList.toggle('ph-' + k, k === p); });
  }

  function resetPack() {
    packBtn.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); });
    packBtn.classList.remove('charging');
    deal.innerHTML = '';
    cards = []; pulls = [];
    fx.rays.target = 0;
  }

  async function startOpen(demo) {
    if (busy) return;
    const prem = !demo && curType() === 'premium';
    packBtn.classList.toggle('premium', prem);
    const got = demo ? MR.Cards.demo() : MR.Cards.open(prem);
    if (!got) { MR.UI.toast('Pas de paquet pour le moment : le prochain arrive bientôt'); return; }
    MR.Audio.unlock();
    busy = true; auto = false;
    if (phase !== 'idle') { resetPack(); setPhase('idle'); await wait(30); }
    pulls = got;
    P.updateCounters();
    if (!demo) MR.UI.refreshUnlocks();
    const best = MR.rarity(pulls[pulls.length - 1].card.rarity);
    const hint = best.rank >= 2 ? rgbOf(best.color) : [255, 236, 200];
    setPhase('opening');
    const pc = center(packBtn), pr = pc.r;

    // 1) le paquet se charge d'énergie (la couleur trahit la meilleure carte à partir de Rare)
    MR.Audio.packCharge(1.0);
    packBtn.style.setProperty('--hint', rs(hint, 1));
    packBtn.classList.add('charging');
    implode(pc.x, pc.y, hint, 950, best.rank >= 3 ? 110 : 60, 0.7);
    fx.rays.x = pc.x; fx.rays.y = pr.top + pr.height * 0.12; fx.rays.rgb = hint; fx.rays.scale = 0.7;
    fx.rays.target = best.rank >= 3 ? 0.45 : 0.2;
    const amp = reduced() ? 0 : 7, kf = [];
    for (let i = 0; i <= 24; i++) {
      const a = amp * (i / 24) * (i / 24);
      kf.push({ transform: 'translate(' + MR.rand(-a, a).toFixed(1) + 'px,' + MR.rand(-a, a).toFixed(1) + 'px) rotate(' + MR.rand(-a, a).toFixed(1) * 0.4 + 'deg)' });
    }
    await anim(packBtn, kf, { duration: 1000, easing: 'linear' });

    // 2) déchirure
    MR.Audio.packRip();
    const top = packBtn.querySelector('.pack-top');
    anim(top, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: 'translate(170px,-280px) rotate(44deg)', opacity: 0 }],
      { duration: 700, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    const tx = pc.x, ty = pr.top + pr.height * 0.12;
    sparks(tx, ty, hint, 80, 1, -Math.PI / 2, 1.1);
    glitter(tx, ty, 30, best.rank >= 2 ? 0 : 35, best.rank >= 2 ? 360 : 55, 0.8);
    ring(tx, ty, hint, 700, 5, 0.6);
    fx.rays.x = tx; fx.rays.y = ty; fx.rays.scale = 1;
    fx.rays.target = best.rank >= 3 ? 0.95 : 0.6;
    flash(0.3, hint, 380);
    await wait(450);

    // 3) les cartes sortent du paquet et se posent face cachée
    setPhase('dealing');
    buildDeal();
    anim(packBtn, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(70px) scale(.88)', opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
    fx.rays.target = 0;
    cards.forEach(function (d, i) {
      const c = center(d.el);
      d.el.animate([
        { transform: 'translate(' + (pc.x - c.x) + 'px,' + (pc.y - c.y) + 'px) scale(.3) rotate(' + MR.rand(-35, 35).toFixed(0) + 'deg)', opacity: 0 },
        { transform: 'none', opacity: 1 }
      ], { duration: 580, delay: 120 + i * 110, easing: 'cubic-bezier(.2,.9,.25,1.12)', fill: 'backwards' });
      setTimeout(function () { MR.Audio.cardWhoosh(); }, 120 + i * 110);
    });
    await wait(700 + 4 * 110);
    setPhase('reveal');
    busy = false;
    if (cards[0]) cards[0].el.focus({ preventScroll: true });
  }

  function buildDeal() {
    deal.innerHTML = '';
    cards = pulls.map(function (pu) {
      const el = makeCard(pu.card, {});
      el.addEventListener('click', function () { onCardClick(d); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(d); } });
      const r = MR.rarity(pu.card.rarity);
      el.style.setProperty('--hint', r.rank >= 2 ? r.color : 'rgba(255,255,255,.55)');
      const d = { card: pu.card, isNew: pu.isNew, demo: pu.demo, el: el, revealed: false };
      deal.appendChild(el);
      return d;
    });
  }

  function onCardClick(d) {
    if (d.revealed) { openZoom(d.card); return; }
    reveal(d);
  }

  async function reveal(d) {
    if (d.revealed || busy) return;
    busy = true;
    const rank = MR.rarity(d.card.rarity).rank;
    if (rank >= 3) await cinematic(d, rank === 4);
    else await simpleFlip(d, rank);
    d.revealed = true;
    d.el.classList.remove('down');
    d.el.classList.add('tiltable');
    d.el.setAttribute('aria-label', d.card.name + ', carte ' + MR.rarity(d.card.rarity).name.toLowerCase());
    if (d.isNew && rank < 3) { addNew(d.el, true); MR.Audio.newBadge(); }
    else if (d.isNew) addNew(d.el, false);
    busy = false;
    if (cards.every(function (x) { return x.revealed; })) finishReveal();
  }

  async function simpleFlip(d, rank) {
    const rgb = rgbOf(MR.rarity(d.card.rarity).color);
    const lift = [1.05, 1.09, 1.15][rank];
    MR.Audio.cardFlip();
    await anim(d.el, [{ transform: 'none' }, { transform: 'translateY(-18px) scale(' + lift + ')' }], { duration: rank === 2 ? 240 : 150, easing: 'ease-out', fill: 'forwards' });
    d.el.classList.add('flipped');
    await wait(rank === 2 ? 240 : 200);
    const c = center(d.el);
    MR.Audio.reveal(d.card.rarity);
    if (rank === 0) { sparks(c.x, c.y, [235, 230, 250], 14, 0.55); }
    else if (rank === 1) { ring(c.x, c.y, rgb, 650, 4, 0.55); sparks(c.x, c.y, rgb, 34, 0.8); }
    else {
      ring(c.x, c.y, rgb, 950, 6, 0.75); ring(c.x, c.y, [255, 255, 255], 600, 3, 0.5);
      sparks(c.x, c.y, rgb, 70, 1.1); glitter(c.x, c.y, 24, 190, 230, 0.9);
      fx.rays.x = c.x; fx.rays.y = c.y; fx.rays.rgb = rgb; fx.rays.scale = 0.8; fx.rays.target = 0.5;
      setTimeout(function () { if (!ov.classList.contains('cine')) fx.rays.target = 0; }, 650);
    }
    await wait(rank === 2 ? 460 : 260);
    await anim(d.el, [{ transform: 'translateY(-18px) scale(' + lift + ')' }, { transform: 'none' }], { duration: 300, easing: 'ease-in-out', fill: 'forwards' });
    d.el.getAnimations().forEach(function (a) { a.cancel(); });
  }

  // fissures de lumière sur le dos de la carte (légendaire)
  function addCracks(cardEl, ms) {
    const back = cardEl.querySelector('.face.back');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 140');
    svg.setAttribute('class', 'cracks');
    const paths = [];
    for (let i = 0; i < 8; i++) {
      let x = 50 + MR.rand(-10, 10), y = 62 + MR.rand(-12, 12), a = Math.random() * TAU;
      let d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
      for (let k = 0; k < 8; k++) {
        a += MR.rand(-0.7, 0.7);
        const len = MR.rand(5, 11);
        x += Math.cos(a) * len; y += Math.sin(a) * len;
        d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
      paths.push(path);
    }
    back.appendChild(svg);
    paths.forEach(function (p, i) {
      const len = p.getTotalLength ? p.getTotalLength() : 80;
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      anim(p, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: ms * 0.55, delay: ms * 0.25 + i * ms * 0.035, easing: 'ease-in', fill: 'forwards' });
    });
  }

  function showTitle(text, rgb, legend) {
    spotTitle.innerHTML = text.split('').map(function (ch, i) {
      return '<span style="--i:' + i + '">' + (ch === ' ' ? '&nbsp;' : MR.esc(ch)) + '</span>';
    }).join('');
    spotTitle.style.setProperty('--rc', rs(rgb, 1));
    spotTitle.className = 'spot-title show ' + (legend ? 't-legend' : 't-epic');
  }
  function waitTap(timeout) {
    return new Promise(function (res) {
      let t = null;
      const done = function () { if (t) clearTimeout(t); tapResolve = null; res(); };
      tapResolve = done;
      if (timeout) t = setTimeout(done, timeout);
    });
  }

  async function cinematic(d, L) {
    const rar = MR.rarity(d.card.rarity), rgb = rgbOf(rar.color);
    const red = reduced();
    ov.classList.add('cine', L ? 'cine-l' : 'cine-e');
    const r0 = d.el.getBoundingClientRect();
    const clone = makeCard(d.card, {});
    clone.classList.add('spot-card');
    clone.style.setProperty('--cw', r0.width + 'px');
    clone._art.forceArt = true;
    spot.appendChild(clone);
    spot.classList.add('active');
    d.el.style.visibility = 'hidden';
    const vw = window.innerWidth, vh = window.innerHeight;
    const S = Math.min((vh * 0.56) / r0.height, (vw * 0.72) / r0.width, 2.8);
    const tx = vw / 2 - r0.width * S / 2, ty = vh / 2 - r0.height * S / 2 + vh * 0.02;
    const from = 'translate(' + r0.left + 'px,' + r0.top + 'px) scale(1)';
    const to = 'translate(' + tx + 'px,' + ty + 'px) scale(' + S + ')';
    clone.style.transform = to;
    MR.Audio.duck(true);
    MR.Audio.whoosh();
    await anim(clone, [{ transform: from }, { transform: 'translate(' + tx + 'px,' + (ty + 30) + 'px) scale(' + S * 0.92 + ') rotate(-4deg)', offset: 0.7 }, { transform: to }],
      { duration: L ? 950 : 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const c = { x: vw / 2, y: ty + r0.height * S / 2 };
    const rect = { x: tx, y: ty, w: r0.width * S, h: r0.height * S };

    // charge : rayons, particules aspirées, éclairs (épique) ou fissures + battements de cœur (légendaire)
    const ms = red ? 700 : fast() ? (L ? 1100 : 700) : (L ? 2500 : 1450);
    MR.Audio.riser(ms / 1000, L);
    fx.rays.x = c.x; fx.rays.y = c.y; fx.rays.rgb = rgb; fx.rays.scale = 1.4;
    fx.rays.target = L ? 0.55 : 0.35;
    implode(c.x, c.y, rgb, ms - 150, L ? 170 : 95, 1.25);
    if (L) {
      boltsOn(rect, [255, 240, 200], ms, true);
      addCracks(clone, ms);
      const beats = [0, 0.26, 0.47, 0.64, 0.77, 0.87, 0.94];
      beats.forEach(function (b, i) {
        setTimeout(function () {
          MR.Audio.heartbeat(i / beats.length);
          const tilt = clone.querySelector('.card-tilt');
          if (tilt && !red) anim(tilt, [{ transform: 'scale(1)' }, { transform: 'scale(' + (1.03 + i * 0.008) + ')' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
        }, b * ms);
      });
    } else boltsOn(rect, rgb, ms, false);
    clone.style.setProperty('--charge', ms + 'ms');
    clone.classList.add('charging');
    if (!red) {
      const n = Math.round(ms / 40), kf = [], amp = L ? 9 : 6;
      for (let i = 0; i <= n; i++) {
        const k = i / n, a = amp * k * k;
        kf.push({ transform: 'translate(' + (tx + MR.rand(-a, a)).toFixed(1) + 'px,' + (ty + MR.rand(-a, a)).toFixed(1) + 'px) scale(' + (S * (1 + 0.05 * k)).toFixed(4) + ') rotate(' + (MR.rand(-a, a) * 0.22).toFixed(2) + 'deg)' });
      }
      clone.animate(kf, { duration: ms, easing: 'linear', fill: 'forwards' });
    }
    await wait(ms);
    if (L) {
      // une demi-seconde de silence avant l'explosion
      fx.rays.target = 0.12;
      fx.implode = null;
      await wait(red ? 0 : 320);
    }

    // révélation
    clone.getAnimations().forEach(function (a) { a.cancel(); });
    clone.style.transform = to;
    clone.classList.remove('charging', 'down');
    clone.classList.add('flipped', 'noanim', 'tiltable', 'revealed');
    const cr = clone.querySelector('.cracks');
    if (cr) cr.remove();
    flash(L ? 0.95 : 0.7, L ? [255, 255, 255] : [235, 210, 255], L ? 1000 : 650);
    ring(c.x, c.y, rgb, L ? 1500 : 1100, L ? 10 : 7, L ? 1 : 0.8);
    ring(c.x, c.y, [255, 255, 255], L ? 1000 : 750, 4, 0.7);
    if (L) setTimeout(function () { ring(c.x, c.y, rgb, 1300, 6, 1.1); }, 160);
    sparks(c.x, c.y, rgb, L ? 220 : 130, L ? 1.5 : 1.2);
    glitter(c.x, c.y, L ? 110 : 60, L ? 35 : 265, L ? 58 : 320, L ? 1.4 : 1.1);
    if (L) { confetti(c.x, c.y, 140, false); fx.rain = 4; }
    fx.rays.target = L ? 1 : 0.6;
    shake(stage, L ? 18 : 10, 600);
    shake(spot, L ? 14 : 8, 600);
    MR.Audio.reveal(d.card.rarity);
    showTitle(rar.name, rgb, L);
    if (d.isNew) setTimeout(function () { addNew(clone, true); MR.Audio.newBadge(); }, L ? 900 : 650);
    await wait(red || fast() ? 300 : 1000);
    spotHint.classList.add('show');
    await waitTap(fast() ? 1400 : auto ? (L ? 3200 : 2400) : 0);

    // retour à sa place
    spotHint.classList.remove('show');
    spotTitle.className = 'spot-title';
    fx.rays.target = 0;
    ov.classList.remove('cine', 'cine-l', 'cine-e');
    const r1 = d.el.getBoundingClientRect();
    clone.classList.remove('tiltable');
    untilt(clone);
    await anim(clone, [{ transform: to }, { transform: 'translate(' + r1.left + 'px,' + r1.top + 'px) scale(1)' }], { duration: 480, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    d.el.classList.add('flipped', 'noanim');
    d.el.style.visibility = '';
    clone.remove();
    spot.classList.remove('active');
    MR.Audio.duck(false);
  }

  async function revealAll() {
    if (busy) return;
    auto = true;
    for (let i = 0; i < cards.length; i++) {
      if (!isOpen) break;
      if (!cards[i].revealed) { await reveal(cards[i]); await wait(140); }
    }
    auto = false;
  }

  function finishReveal() {
    setPhase('done');
    const n = MR.Cards.packs() + MR.Cards.premium();
    const next = $('#bNext');
    next.hidden = n <= 0;
    next.textContent = 'Ouvrir le suivant (' + n + ')';
    MR.UI.refreshUnlocks();
    P.updateCounters();
  }

  /* =====================================================================
   * Collection et fiche
   * ===================================================================== */
  function buildCollection() {
    coll.innerHTML = '';
    const total = MR.CARDS.length, have = MR.Cards.distinct();
    const head = document.createElement('div');
    head.className = 'coll-head';
    head.innerHTML = '<div><b>' + have + ' / ' + total + '</b> cartes différentes · ' + plural(MR.Cards.opened(), 'paquet ouvert', 'paquets ouverts') +
      '</div><div class="coll-bar"><i style="width:' + (have / total * 100).toFixed(1) + '%"></i></div>';
    coll.appendChild(head);
    // seules les cartes visibles à l'écran sont animées
    if (collIO) collIO.disconnect();
    collIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.target._art) e.target._art.vis = e.isIntersecting; });
    }, { root: coll, rootMargin: '120px' }) : null;
    MR.RARITIES.slice().reverse().forEach(function (r) {
      const list = MR.CARDS.filter(function (c) { return c.rarity === r.id; }).sort(function (a, b) { return a._o - b._o; });
      const owned = list.filter(function (c) { return MR.Cards.owns(c.id); }).length;
      const sec = document.createElement('section');
      sec.className = 'coll-sec r-' + r.id;
      sec.style.setProperty('--rc', r.color);
      sec.innerHTML = '<h3><span class="cs-name">' + r.plural + '</span><span class="cs-n">' + owned + '/' + list.length + '</span><small>' +
        pct(r.chance) + ' des cartes · ' + pct(r.chance / list.length) + ' chacune</small></h3>';
      const grid = document.createElement('div');
      grid.className = 'coll-grid';
      list.forEach(function (card) {
        const own = MR.Cards.owns(card.id);
        const el = makeCard(card, { mini: true, faceUp: true, locked: !own, count: MR.Cards.count(card.id), isNew: MR.Cards.isFresh(card.id) });
        el.classList.add('tiltable');
        el.addEventListener('click', function () { openZoom(card); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openZoom(card); } });
        grid.appendChild(el);
        if (collIO) { el._art.vis = false; collIO.observe(el); }
      });
      sec.appendChild(grid);
      coll.appendChild(sec);
    });
  }

  function openZoom(card) {
    const own = MR.Cards.owns(card.id), r = MR.rarity(card.rarity);
    zoom.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'zoom-box';
    const big = makeCard(card, { faceUp: true, locked: !own });
    big.classList.add('tiltable', 'zoom-card');
    const info = document.createElement('div');
    info.className = 'zoom-info';
    const chance = MR.Cards.chanceOf(card);
    const perPack = (1 - Math.pow(1 - chance / 100, MR.Cards.PER_PACK)) * 100;
    info.innerHTML = '<span class="zi-rar" style="color:' + r.color + '">' + r.name + '</span>' +
      '<h3>' + (own ? MR.esc(card.name) : '???') + '</h3>' +
      '<p>' + (own ? MR.esc(card.blurb) + '<br>Possédée ×' + MR.Cards.count(card.id) : 'Pas encore obtenue.') + '</p>' +
      '<p class="zi-odds">' + pct(chance) + ' par carte tirée · environ ' + pct(perPack) + ' par paquet</p>';
    const btns = document.createElement('div');
    btns.className = 'zoom-btns';
    if (own && card.kind === 'sound') {
      const play = document.createElement('button');
      play.type = 'button'; play.className = 'btn';
      play.textContent = '♪ Écouter';
      play.addEventListener('click', function () { MR.Audio.unlock(); MR.Audio.hit(card.effect, 0.9, 0); });
      btns.appendChild(play);
    }
    if (own) {
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'btn primary';
      add.textContent = card.kind === 'skin' || card.kind === 'color' ? 'Ajouter à la course' : 'Essayer sur une nouvelle bille';
      add.addEventListener('click', function () {
        const m = MR.marbleFromCard(card, MR.Game.roster.map(function (x) { return x.name; }));
        if (MR.Game.addMarble(m)) MR.UI.toast(m.name + ' rejoint la course');
      });
      btns.appendChild(add);
    }
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'btn';
    close.textContent = 'Fermer';
    close.addEventListener('click', closeZoom);
    btns.appendChild(close);
    info.appendChild(btns);
    box.append(big, info);
    zoom.appendChild(box);
    zoom.hidden = false;
    anim(box, [{ transform: 'scale(.85)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
    MR.Cards.markSeen(card.id);
    close.focus();
  }
  function closeZoom() { zoom.hidden = true; zoom.innerHTML = ''; }

  /* =====================================================================
   * Affichage général
   * ===================================================================== */
  function setTab(t) {
    tab = t;
    $('#tabPacks').setAttribute('aria-selected', String(t === 'packs'));
    $('#tabColl').setAttribute('aria-selected', String(t === 'coll'));
    $('#coPacks').hidden = t !== 'packs';
    coll.hidden = t !== 'coll';
    if (t === 'coll') {
      buildCollection();
      coll.scrollTop = 0;
      // les badges « Nouveau » restent affichés cette fois, puis disparaissent
      MR.CARDS.forEach(function (c) { if (MR.Cards.isFresh(c.id)) MR.Cards.markSeen(c.id); });
    }
    P.updateCounters();
  }

  P.show = function (t) {
    if (!ov) return;
    MR.Audio.unlock();
    isOpen = true;
    ov.hidden = false;
    document.body.classList.add('cards-open');
    resizeFx();
    if (phase === 'done' || phase === 'idle') { resetPack(); setPhase('idle'); }
    setTab(t || 'packs');
    anim(ov, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    $('#coClose').focus();
  };
  P.hide = function () {
    if (!isOpen || busy) return;
    isOpen = false;
    ov.hidden = true;
    closeZoom();
    document.body.classList.remove('cards-open');
    fx.parts.length = 0; fx.rings.length = 0; fx.rays.a = fx.rays.target = 0;
    if (phase !== 'reveal') { resetPack(); setPhase('idle'); }
    const btn = $('#cToggle');
    if (btn) btn.focus();
  };
  P.isOpen = function () { return isOpen; };

  // type de paquet sélectionné (normal ou premium), en retombant sur celui qui est disponible
  function curType() {
    const n = MR.Cards.packs(), p = MR.Cards.premium();
    if (packType === 'premium' && p > 0) return 'premium';
    if (packType === 'normal' && n > 0) return 'normal';
    return p > 0 && n <= 0 ? 'premium' : 'normal';
  }

  P.updateCounters = function () {
    const n = MR.Cards.packs(), p = MR.Cards.premium(), ms = MR.Cards.msToNext();
    const mm = Math.floor(ms / 60000), ss = Math.floor(ms / 1000) % 60;
    const clock = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
    const full = n >= MR.Cards.MAX;
    let ready = n > 0 ? plural(n, 'paquet prêt', 'paquets prêts') : 'Aucun paquet prêt';
    if (p > 0) ready += ' + ' + p + ' premium';
    const timer = full ? 'réserve pleine (10 max)' : 'prochain dans ' + clock;
    const set = function (id, txt) { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; };
    set('cBadge', String(n + p));
    set('pkBadge', String(n + p));
    set('pkCount', ready);
    set('pkTimer', full ? 'Réserve pleine : 10 paquets max' : 'Prochain paquet dans ' + clock);
    set('ovPacks', ready);
    set('ovTimer', timer);
    set('tabPackN', String(n + p));
    const coll = MR.Cards.distinct() + '/' + MR.CARDS.length;
    set('tabCollN', coll);
    set('pkColl', coll);
    const bar = document.getElementById('pkBar');
    if (bar) bar.style.width = (MR.Cards.cycleProgress() * 100).toFixed(1) + '%';
    const cb = document.getElementById('cToggle');
    if (cb) cb.classList.toggle('has-packs', n + p > 0);
    const badge = document.getElementById('cBadge');
    if (badge) badge.hidden = n + p <= 0;
    if (ov) {
      const t = curType(), cnt = t === 'premium' ? p : n;
      set('packCountTag', '×' + cnt);
      set('ppN', String(n)); set('ppP', String(p));
      const pick = $('#packPick');
      pick.hidden = p <= 0;
      pick.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
      // pendant une ouverture, on ne touche plus à l'apparence du paquet (sinon le premium redevient normal)
      if (phase === 'idle' && !busy) {
        packBtn.classList.toggle('premium', t === 'premium');
        set('packTitle', t === 'premium' ? 'Paquet premium' : 'Paquet de billes');
        set('packSub', t === 'premium' ? '5 cartes · rare ou mieux' : '5 cartes');
      }
      ov.classList.toggle('nopack', cnt <= 0);
      $('#packStack').dataset.n = String(Math.min(3, cnt));
      const bo = $('#bOpen');
      bo.disabled = cnt <= 0;
      bo.textContent = cnt > 0 ? (t === 'premium' ? 'Ouvrir le paquet premium' : 'Ouvrir le paquet') : 'Prochain paquet dans ' + clock;
    }
  };

  P.frame = function (dt) {
    counterT -= dt;
    if (counterT <= 0) {
      counterT = 0.5;
      const gained = MR.Cards.tick();
      const n = MR.Cards.packs();
      if (gained > 0 && lastPacks >= 0) MR.UI.toast(gained > 1 ? gained + ' nouveaux paquets de cartes sont prêts' : 'Un nouveau paquet de cartes est prêt');
      lastPacks = n;
      P.updateCounters();
    }
    if (!isOpen) return;
    const time = MR.Game.time;
    fxUpdate(dt);
    fxDraw();
    renderArts(time);
  };

  P.init = function () {
    ov = $('#cardsOv');
    stage = $('#coStage');
    deal = $('#deal');
    coll = $('#coColl');
    spot = $('#spot');
    spotTitle = $('#spotTitle');
    spotHint = $('#spotHint');
    dim = $('#coDim');
    flashEl = $('#coFlash');
    zoom = $('#zoom');
    packBtn = $('#pack');
    midCv = $('#fxMid'); midCtx = midCv.getContext('2d');
    frontCv = $('#fxFront'); frontCtx = frontCv.getContext('2d');

    // illustration du paquet : une boule disco qui tourne
    const pa = $('#packArt');
    arts.push({ cv: pa, ctx: pa.getContext('2d'), card: { skin: 'disco', color: '#ffe7a3', seed: 0.42 }, el: pa, locked: false, spec: {}, phase: 0, forceArt: true });

    packBtn.addEventListener('click', function () { if (phase === 'idle') startOpen(false); });
    $('#bOpen').addEventListener('click', function () { startOpen(false); });
    $('#bDemo').addEventListener('click', function () { startOpen(true); });
    $('#bDemo').hidden = location.hash !== '#demo';
    $('#bRevealAll').addEventListener('click', revealAll);
    $('#bNext').addEventListener('click', function () { startOpen(false); });
    $('#packPick').addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b || phase !== 'idle') return;
      packType = b.dataset.t;
      P.updateCounters();
    });
    $('#bToColl').addEventListener('click', function () { setTab('coll'); });
    $('#tabPacks').addEventListener('click', function () { if (!busy) setTab('packs'); });
    $('#tabColl').addEventListener('click', function () { if (!busy) setTab('coll'); });
    $('#coClose').addEventListener('click', P.hide);
    zoom.addEventListener('click', function (e) { if (e.target === zoom) closeZoom(); });
    spot.addEventListener('pointerdown', function () { if (tapResolve) tapResolve(); });
    ov.addEventListener('pointermove', onTilt);
    ov.addEventListener('pointerleave', function () { if (lastTilt) untilt(lastTilt); lastTilt = null; });
    ov.addEventListener('keydown', function (e) {
      if (tapResolve && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); tapResolve(); return; }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!zoom.hidden) closeZoom(); else P.hide();
      }
    });
    window.addEventListener('resize', function () { if (isOpen) resizeFx(); });
    window.addEventListener('hashchange', function () { $('#bDemo').hidden = location.hash !== '#demo'; });
    setPhase('idle');
    lastPacks = MR.Cards.packs();
    P.updateCounters();
  };

  MR.Packs = P;
})(window.MR);
