/* MagicRace — outils communs */
window.MR = window.MR || {};
(function (MR) {
  'use strict';

  MR.VERSION = '0.2.3';
  MR.MAX_MARBLES = 60;
  MR.TAU = Math.PI * 2;

  MR.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  MR.lerp = function (a, b, t) { return a + (b - a) * t; };
  MR.rand = function (a, b) { return a + Math.random() * (b - a); };
  MR.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  MR.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  MR.uid = function () { return Math.random().toString(36).slice(2, 10); };
  MR.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  // bruit pseudo-aléatoire stable (0..1)
  MR.hash = function (a, b) {
    const s = Math.sin(a * 127.1 + (b || 0) * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  MR.isHex = function (s) { return typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s); };
  MR.hexToRgb255 = function (hex) {
    let h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  MR.hexToRgb = function (hex) {
    const c = MR.hexToRgb255(hex);
    return [c[0] / 255, c[1] / 255, c[2] / 255];
  };
  MR.rgbStr = function (rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
  };
  MR.mixRgb = function (a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  };

  MR.formatTime = function (t) {
    if (!(t >= 0)) t = 0;
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0');
  };

  MR.store = {
    get: function (key, def) {
      try {
        const v = window.localStorage.getItem(key);
        return v == null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set: function (key, val) {
      try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* stockage indisponible */ }
    }
  };

  MR.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
})(window.MR);
