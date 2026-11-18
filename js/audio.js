/* MagicRace — audio : musique « Velvet Mirrorball » (dark disco swinguée, synthétisée en direct) + bruitages. */
(function (MR) {
  'use strict';

  const A = {};
  const BPM = 116, SPB = 60 / BPM, S16 = SPB / 4, SWING = 0.17;
  A.BPM = BPM;

  let ctx = null, master, comp, musicBus, sfxBus, drumBus, pumpBus, revSend, delaySend, noiseBuf, sfxRev;
  let seqTimer = null, nextTime = 0, stepIdx = 0, musicStart = 0, running = false;
  let voices = 0;
  const S = { music: true, musicVol: 0.55, sfx: true, sfxVol: 0.75 };

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function makeIR(sec, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * sec);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  A.init = function () {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);

    musicBus = ctx.createGain(); musicBus.gain.value = S.music ? S.musicVol : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = S.sfx ? S.sfxVol : 0; sfxBus.connect(master);
    drumBus = ctx.createGain(); drumBus.gain.value = 0.9; drumBus.connect(musicBus);
    pumpBus = ctx.createGain(); pumpBus.gain.value = 1; pumpBus.connect(musicBus);

    const rev = ctx.createConvolver(); rev.buffer = makeIR(2.4, 3.2);
    const revOut = ctx.createGain(); revOut.gain.value = 0.34;
    rev.connect(revOut); revOut.connect(musicBus);
    revSend = ctx.createGain(); revSend.connect(rev);

    const delay = ctx.createDelay(1.5); delay.delayTime.value = S16 * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.36;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    delay.connect(dlp); dlp.connect(fb); fb.connect(delay);
    const dOut = ctx.createGain(); dOut.gain.value = 0.42; dlp.connect(dOut); dOut.connect(musicBus);
    delaySend = ctx.createGain(); delaySend.connect(delay);

    const srev = ctx.createConvolver(); srev.buffer = makeIR(1.1, 4);
    const srevOut = ctx.createGain(); srevOut.gain.value = 0.25;
    srev.connect(srevOut); srevOut.connect(sfxBus);
    sfxRev = ctx.createGain(); sfxRev.connect(srev);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  };

  // à appeler depuis un geste de l'utilisateur
  A.unlock = function () {
    if (!A.init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (S.music && !running) A.startMusic();
  };
  A.ready = function () { return !!ctx; };

  function noise(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
    return s;
  }
  function send(node, dest, amount) {
    const g = ctx.createGain(); g.gain.value = amount;
    node.connect(g); g.connect(dest);
  }

  /* ---------------- instruments ---------------- */
  function kick(t, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.95 * v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g); g.connect(drumBus);
    o.start(t); o.stop(t + 0.45);
    const n = noise(t, 0.02), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    ng.gain.setValueAtTime(0.22 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
    n.connect(hp); hp.connect(ng); ng.connect(drumBus);
    // pompe façon sidechain
    pumpBus.gain.setValueAtTime(0.36, t);
    pumpBus.gain.linearRampToValueAtTime(1, t + 0.22);
  }
  function clap(t, v) {
    const n = noise(t, 0.3), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1350; bp.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.011;
      g.gain.setValueAtTime(0.5 * v, tt);
      g.gain.exponentialRampToValueAtTime(0.05, tt + 0.009);
    }
    g.gain.setValueAtTime(0.42 * v, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    n.connect(bp); bp.connect(g); g.connect(drumBus);
    send(g, revSend, 0.5);
  }
  function hat(t, open, v) {
    const dur = open ? 0.2 : 0.045;
    const n = noise(t, dur), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = open ? 6500 : 8200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((open ? 0.15 : 0.1) * v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(hp); hp.connect(g); g.connect(drumBus);
  }
  function tom(t, f, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(drumBus); send(g, revSend, 0.35);
    o.start(t); o.stop(t + 0.32);
  }
  function crash(t) {
    const n = noise(t, 1.6), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 5200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    n.connect(hp); hp.connect(g); g.connect(drumBus); send(g, revSend, 0.4);
  }
  function riser(t, dur) {
    const n = noise(t, dur), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 5;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(bp); bp.connect(g); g.connect(musicBus); send(g, revSend, 0.5);
  }
  function bass(t, note, dur, v, open) {
    const f = midi(note);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'sawtooth'; o1.frequency.value = f;
    o2.type = 'square'; o2.frequency.value = f; o2.detune.value = -8;
    lp.type = 'lowpass'; lp.Q.value = 7;
    const peak = 280 + 1500 * v * open;
    lp.frequency.setValueAtTime(peak, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(110, peak * 0.22), t + Math.min(dur, 0.25));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.006);
    g.gain.setValueAtTime(0.3 * v, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(pumpBus);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function stab(t, notes, dur, v) {
    const lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(600, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.065 * v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (let i = 0; i < notes.length; i++) {
      for (let k = -1; k <= 1; k += 2) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = midi(notes[i]); o.detune.value = 9 * k;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
      }
    }
    lp.connect(g); g.connect(pumpBus);
    send(g, delaySend, 0.35); send(g, revSend, 0.4);
  }
  function pad(t, notes, dur) {
    const lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.04, t + 0.6);
    g.gain.setValueAtTime(0.04, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    for (let i = 0; i < notes.length; i++) {
      for (let k = -1; k <= 1; k += 2) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = midi(notes[i]); o.detune.value = 12 * k;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.5);
      }
    }
    lp.connect(g); g.connect(pumpBus); send(g, revSend, 0.8);
  }
  function pluck(t, note, v) {
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = midi(note);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045 * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(lp); lp.connect(g); g.connect(pumpBus);
    send(g, delaySend, 0.5); send(g, revSend, 0.25);
    o.start(t); o.stop(t + 0.2);
  }
  function lead(t, note, dur, v) {
    const f = midi(note);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 6;
    lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + 0.18);
    lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
    lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(1300, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.05);
    lp.frequency.exponentialRampToValueAtTime(1500, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.075 * v, t + 0.02);
    g.gain.setValueAtTime(0.075 * v, t + Math.max(0.03, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musicBus);
    send(g, delaySend, 0.35); send(g, revSend, 0.35);
    o.start(t); o2.start(t); lfo.start(t);
    o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }

  /* ---------------- partition ---------------- */
  // ré mineur : Dm9 | Bbmaj7 | Gm9 | A7(b9) — voicings sans fondamentale
  const CHORDS = [
    { root: 38, pick: 10, pad: [57, 60, 64, 65, 69] },
    { root: 34, pick: 7, pad: [57, 62, 65, 69] },
    { root: 31, pick: 10, pad: [57, 58, 62, 65] },
    { root: 33, pick: 7, pad: [55, 58, 61, 64] }
  ];
  // [pas, décalage (12 = octave, -1 = note de passage), durée en pas, vélocité]
  const BASS = [[0, 0, 2, 1], [2, 12, 1, 0.75], [4, 0, 2, 0.95], [6, 12, 1, 0.75], [7, 12, 1, 0.45],
    [8, 0, 2, 1], [10, 12, 1, 0.75], [12, 0, 2, 0.95], [14, 12, 1, 0.75], [15, -1, 1, 0.55]];
  const STABS = [3, 6, 11, 14];
  const ARP = [0, 1, 2, 3, 1, 2, 3, 0, 2, 3, 0, 1, 3, 2, 1, 0];
  const MELODY = [
    [[0, 69, 3], [3, 72, 3], [6, 74, 2], [8, 72, 2], [10, 69, 4]],
    [[0, 65, 2], [2, 69, 2], [4, 70, 4], [8, 69, 2], [10, 65, 2], [12, 62, 4]],
    [[0, 67, 3], [3, 70, 3], [6, 74, 4], [10, 77, 2], [12, 76, 2], [14, 74, 2]],
    [[0, 73, 4], [4, 76, 2], [6, 79, 2], [8, 77, 2], [10, 76, 2], [12, 73, 4]]
  ];
  // cycle de 32 mesures : groove A, groove B (+arpège), break, montée, sommet (+mélodie)
  function section(bar) {
    const b = bar % 32;
    if (b < 8) return 'A';
    if (b < 16) return 'B';
    if (b < 20) return 'BREAK';
    if (b < 24) return 'BUILD';
    return 'PEAK';
  }

  function scheduleStep(i, tg) {
    const bar = Math.floor(i / 16), s = i % 16, b32 = bar % 32, sec = section(bar);
    const ch = CHORDS[bar % 4];
    const t = tg + (s % 2 ? SWING * S16 : 0);
    const groove = sec !== 'BREAK';

    // batterie
    if (groove) {
      if (s % 4 === 0) kick(tg, 1);
      if (s === 4 || s === 12) clap(tg, 1);
      if (s % 4 === 2) hat(tg, true, 0.9);
      if (s % 2 === 1) hat(t, false, s % 4 === 3 ? 0.6 : 0.85);
    } else if (s % 2 === 1) hat(t, false, 0.45);
    if ((sec === 'A' || sec === 'B' || sec === 'PEAK') && b32 % 8 === 7 && s >= 12) tom(t, [196, 165, 131, 110][s - 12], 0.8);
    if (sec === 'BUILD') {
      const sub = b32 - 20;
      if (sub >= 2) {
        const every = sub === 2 ? 4 : (s < 8 ? 2 : 1);
        if (s % every === 0) clap(t, 0.3 + 0.5 * ((sub - 2) * 16 + s) / 32);
      }
      if (sub === 2 && s === 0) riser(tg, S16 * 32);
    }
    if (s === 0 && (b32 === 24 || (b32 === 0 && bar > 0))) crash(tg);

    // basse
    if (sec === 'BREAK') {
      if (s === 0) bass(tg, ch.root + 12, S16 * 15, 0.7, 0.35);
    } else {
      const open = sec === 'BUILD' ? 0.5 + 0.15 * (b32 - 20) : 1;
      for (let k = 0; k < BASS.length; k++) {
        const e = BASS[k];
        if (e[0] !== s) continue;
        const off = e[1] === -1 ? ch.pick : e[1];
        bass(t, ch.root + off, e[2] * S16 * 0.9, e[3], open);
      }
    }
    // accords
    if (sec === 'B' || sec === 'PEAK' || (sec === 'A' && (s === 6 || s === 14))) {
      if (STABS.indexOf(s) >= 0) stab(t, ch.pad, s === 14 ? 0.22 : 0.16, s === 3 ? 0.8 : 1);
    }
    if ((sec === 'BREAK' || sec === 'BUILD' || sec === 'PEAK') && s === 0) pad(tg, ch.pad, SPB * 4);
    // arpège
    if (sec === 'B' || sec === 'BREAK' || sec === 'BUILD') pluck(t, ch.pad[ARP[s] % ch.pad.length] + 12, s % 4 === 0 ? 1 : 0.7);
    // mélodie
    if (sec === 'PEAK') {
      const mel = MELODY[bar % 4];
      for (let k = 0; k < mel.length; k++) if (mel[k][0] === s) lead(t, mel[k][1], mel[k][2] * S16 * 0.95, 1);
    }
  }

  function tick() {
    if (!ctx || !running) return;
    const now = ctx.currentTime;
    if (nextTime < now - 0.05) { // onglet en arrière-plan : on saute en avant plutôt que de rejouer en rafale
      const skip = Math.ceil((now - nextTime) / S16);
      stepIdx += skip; nextTime += skip * S16;
    }
    while (nextTime < now + 0.14) {
      scheduleStep(stepIdx, nextTime);
      nextTime += S16;
      stepIdx++;
    }
  }

  A.startMusic = function () {
    if (!ctx || running) return;
    running = true;
    stepIdx = 0;
    nextTime = ctx.currentTime + 0.08;
    musicStart = nextTime;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(S.musicVol, ctx.currentTime, 0.05);
    seqTimer = setInterval(tick, 25);
    tick();
  };
  A.stopMusic = function () {
    running = false;
    if (seqTimer) clearInterval(seqTimer);
    seqTimer = null;
    if (ctx) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  };

  // temps musical (en temps) pour synchroniser les lumières
  A.beat = function () {
    if (ctx && running) return Math.max(0, (ctx.currentTime - musicStart) / SPB);
    return performance.now() / 1000 / SPB;
  };

  A.settings = S;
  A.setMusic = function (on) {
    S.music = !!on;
    if (!ctx) return;
    if (S.music) A.startMusic(); else A.stopMusic();
  };
  A.setMusicVol = function (v) {
    S.musicVol = clamp(v, 0, 1);
    if (ctx && running) musicBus.gain.setTargetAtTime(S.musicVol, ctx.currentTime, 0.05);
  };
  A.setSfx = function (on) {
    S.sfx = !!on;
    if (ctx) sfxBus.gain.setTargetAtTime(S.sfx ? S.sfxVol : 0, ctx.currentTime, 0.03);
  };
  A.setSfxVol = function (v) {
    S.sfxVol = clamp(v, 0, 1);
    if (ctx && S.sfx) sfxBus.gain.setTargetAtTime(S.sfxVol, ctx.currentTime, 0.03);
  };

  /* ---------------- bruitages ---------------- */
  const PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84];

  function out(pan) {
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan || 0, -1, 1);
      p.connect(sfxBus);
      return p;
    }
    return sfxBus;
  }
  function voice(dur) {
    if (voices > 26) return false;
    voices++;
    setTimeout(function () { voices--; }, (dur + 0.05) * 1000);
    return true;
  }
  function tone(type, f, t, peak, dec, dest, f2, fdur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (fdur || dec));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dec + 0.02);
    return g;
  }

  A.hit = function (type, intensity, pan) {
    if (!ctx || !S.sfx || !type || type === 'none') return;
    const v = clamp(intensity, 0.04, 1);
    const t = ctx.currentTime + 0.004;
    let d;
    switch (type) {
      case 'glass': {
        if (!voice(0.3)) return;
        d = out(pan);
        const base = 2100 * MR.rand(0.88, 1.16);
        tone('sine', base, t, 0.2 * v, 0.28, d);
        tone('sine', base * 2.76, t, 0.09 * v, 0.14, d);
        tone('sine', base * 5.4, t, 0.04 * v, 0.07, d);
        break;
      }
      case 'wood': {
        if (!voice(0.12)) return;
        d = out(pan);
        tone('triangle', 720 * MR.rand(0.9, 1.1), t, 0.34 * v, 0.1, d, 430, 0.05);
        const n = noise(t, 0.04), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 3;
        g.gain.setValueAtTime(0.18 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
        n.connect(bp); bp.connect(g); g.connect(d);
        break;
      }
      case 'bell': {
        if (!voice(1)) return;
        d = out(pan);
        const f = midi(MR.pick(PENTA) + 12);
        const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
        car.type = 'sine'; car.frequency.value = f;
        mod.type = 'sine'; mod.frequency.value = f * 3.5;
        mg.gain.setValueAtTime(f * 2.2 * v, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.6);
        mod.connect(mg); mg.connect(car.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15 * v, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
        car.connect(g); g.connect(d); send(g, sfxRev, 0.6);
        car.start(t); mod.start(t); car.stop(t + 1); mod.stop(t + 1);
        break;
      }
      case 'laser': {
        if (!voice(0.18)) return;
        d = out(pan);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(d);
        tone('square', 1600 * MR.rand(0.85, 1.15), t, 0.08 * v, 0.16, lp, 170, 0.14);
        break;
      }
      case 'boing': {
        if (!voice(0.4)) return;
        d = out(pan);
        const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(520 * MR.rand(0.9, 1.1), t + 0.13);
        lfo.frequency.value = 22; lg.gain.value = 45; lfo.connect(lg); lg.connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
        o.connect(g); g.connect(d);
        o.start(t); lfo.start(t); o.stop(t + 0.38); lfo.stop(t + 0.38);
        break;
      }
      case 'clap': {
        if (!voice(0.18)) return;
        d = out(pan);
        const n = noise(t, 0.16), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 1600 * MR.rand(0.9, 1.1); bp.Q.value = 1;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.setValueAtTime(0.38 * v, t); g.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
        g.gain.setValueAtTime(0.34 * v, t + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        n.connect(bp); bp.connect(g); g.connect(d); send(g, sfxRev, 0.4);
        break;
      }
      case 'chip': {
        if (!voice(0.14)) return;
        d = out(pan);
        const note = MR.pick(PENTA) + 12;
        tone('square', midi(note), t, 0.06 * v, 0.05, d);
        tone('square', midi(note + 7), t + 0.045, 0.06 * v, 0.08, d);
        break;
      }
      case 'cowbell': {
        if (!voice(0.3)) return;
        d = out(pan);
        const bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 880; bp.Q.value = 2.5;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.32 * v, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.08 * v, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        [562, 845].forEach(function (f) {
          const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * MR.rand(0.97, 1.03);
          o.connect(bp); o.start(t); o.stop(t + 0.3);
        });
        bp.connect(g); g.connect(d);
        break;
      }
    }
  };

  A.bumper = function (pan) {
    if (!ctx || !S.sfx || !voice(0.2)) return;
    const t = ctx.currentTime + 0.004, d = out(pan);
    tone('sine', 260, t, 0.3, 0.16, d, 980, 0.07);
    tone('triangle', 1960, t, 0.06, 0.08, d);
  };
  A.countBeep = function (go) {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.01;
    if (go) {
      tone('square', 880, t, 0.09, 0.5, sfxBus);
      tone('square', 1318.5, t, 0.07, 0.6, sfxBus);
      send(tone('triangle', 1760, t, 0.08, 0.7, sfxBus), sfxRev, 0.5);
    } else {
      tone('square', 587.3, t, 0.08, 0.22, sfxBus);
    }
  };
  A.finishChime = function (rank) {
    if (!ctx || !S.sfx || !voice(0.6)) return;
    const t = ctx.currentTime + 0.01;
    const top = rank <= 3 ? 84 : 79;
    [0, 3, 7].forEach(function (k, i) {
      send(tone('triangle', midi(top - 12 + [0, 5, 10][i]), t + i * 0.06, 0.09, 0.5, sfxBus), sfxRev, 0.5);
    });
  };
  A.fanfare = function () {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.02;
    const notes = [62, 65, 69, 74, 77, 81];
    notes.forEach(function (n, i) { send(tone('square', midi(n), t + i * 0.07, 0.05, 0.35, sfxBus), sfxRev, 0.5); });
    [62, 69, 72, 77].forEach(function (n) { send(tone('sawtooth', midi(n), t + 0.45, 0.035, 1.4, sfxBus), sfxRev, 0.6); });
  };
  A.uiTick = function () {
    if (!ctx || !S.sfx) return;
    tone('sine', 1800, ctx.currentTime + 0.002, 0.04, 0.05, sfxBus);
  };

  /* ---------------- cartes à jouer ---------------- */
  // baisse la musique pendant les révélations épiques et légendaires
  A.duck = function (on) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const full = S.music && running ? S.musicVol : 0;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(on ? full * 0.22 : full, t, on ? 0.12 : 0.4);
  };
  function sweepNoise(t, dur, f0, f1, q, peak, dest, attack) {
    const n = noise(t, dur), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (attack == null ? dur * 0.85 : attack));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    n.connect(bp); bp.connect(g); g.connect(dest);
    return g;
  }
  A.packCharge = function (dur) {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.01;
    sweepNoise(t, dur, 400, 2600, 4, 0.16, sfxBus);
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(440, t + dur);
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(lp); lp.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.1);
  };
  A.packRip = function () {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.005;
    for (let i = 0; i < 6; i++) {
      const tt = t + i * 0.028 + Math.random() * 0.01;
      const n = noise(tt, 0.05), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 2200 + Math.random() * 2600; bp.Q.value = 1.4;
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.32 * (1 - i * 0.1), tt + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.045);
      n.connect(bp); bp.connect(g); g.connect(sfxBus);
    }
    tone('sine', 140, t, 0.3, 0.18, sfxBus, 55, 0.15);
    send(sweepNoise(t + 0.05, 0.5, 5000, 900, 1.2, 0.08, sfxBus, 0.02), sfxRev, 0.5);
  };
  A.cardWhoosh = function () {
    if (!ctx || !S.sfx || !voice(0.25)) return;
    sweepNoise(ctx.currentTime + 0.005, 0.2, 500, 2600, 2.5, 0.12, out(MR.rand(-0.5, 0.5)), 0.12);
  };
  A.cardFlip = function () {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.004;
    const n = noise(t, 0.02), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 3500;
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(hp); hp.connect(g); g.connect(sfxBus);
    sweepNoise(t, 0.16, 900, 3200, 2, 0.08, sfxBus, 0.06);
  };
  A.whoosh = function () {
    if (!ctx || !S.sfx) return;
    sweepNoise(ctx.currentTime + 0.005, 0.5, 300, 2400, 3, 0.14, sfxBus, 0.3);
  };
  A.riser = function (dur, big) {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.01;
    send(sweepNoise(t, dur, 200, big ? 7500 : 5000, 7, big ? 0.2 : 0.15, sfxBus), sfxRev, 0.4);
    const lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(big ? 4200 : 3000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(big ? 0.07 : 0.055, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    lp.connect(g); g.connect(sfxBus);
    (big ? [1, 1.5, 2] : [1, 2]).forEach(function (k, i) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.detune.value = i * 7;
      o.frequency.setValueAtTime(55 * k, t); o.frequency.exponentialRampToValueAtTime(220 * k * (big ? 2 : 1), t + dur);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    });
  };
  A.heartbeat = function (k) {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.005, v = 0.35 + 0.35 * (k || 0);
    tone('sine', 78, t, v, 0.22, sfxBus, 42, 0.18);
    tone('sine', 70, t + 0.15, v * 0.6, 0.2, sfxBus, 40, 0.16);
  };
  A.crackle = function () {
    if (!ctx || !S.sfx || !voice(0.06)) return;
    const t = ctx.currentTime + 0.003;
    const n = noise(t, 0.05), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 2500 + Math.random() * 3000;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(hp); hp.connect(g); g.connect(out(MR.rand(-0.6, 0.6)));
  };
  function boom(t, big) {
    tone('sine', 120, t, big ? 1 : 0.85, big ? 1.5 : 1, sfxBus, 30, big ? 1.2 : 0.8);
    const n = noise(t, 0.8), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(90, t + 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(big ? 0.6 : 0.45, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    n.connect(lp); lp.connect(g); g.connect(sfxBus); send(g, sfxRev, 0.6);
    if (big) {
      const c = noise(t, 2.4), hp = ctx.createBiquadFilter(), cg = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 4200;
      cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
      c.connect(hp); hp.connect(cg); cg.connect(sfxBus); send(cg, sfxRev, 0.5);
    }
  }
  function bell(t, note, v) {
    const f = midi(note);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sine'; car.frequency.value = f;
    mod.type = 'sine'; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.5);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    car.connect(g); g.connect(sfxBus); send(g, sfxRev, 0.6);
    car.start(t); mod.start(t); car.stop(t + 1); mod.stop(t + 1);
  }
  function chord(t, notes, dur, v, type, cutoff) {
    const lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(cutoff * 0.3, t); lp.frequency.exponentialRampToValueAtTime(cutoff, t + 0.08);
    lp.frequency.exponentialRampToValueAtTime(cutoff * 0.35, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    notes.forEach(function (nn) {
      for (let k = -1; k <= 1; k += 2) {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = midi(nn); o.detune.value = 8 * k;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
      }
    });
    lp.connect(g); g.connect(sfxBus); send(g, sfxRev, 0.8);
  }
  A.reveal = function (rarity) {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.01;
    if (rarity === 'common') {
      send(tone('triangle', midi(86), t, 0.1, 0.35, sfxBus), sfxRev, 0.4);
    } else if (rarity === 'uncommon') {
      send(tone('triangle', midi(86), t, 0.1, 0.4, sfxBus), sfxRev, 0.5);
      send(tone('triangle', midi(93), t + 0.08, 0.1, 0.6, sfxBus), sfxRev, 0.5);
    } else if (rarity === 'rare') {
      [74, 77, 81, 86].forEach(function (nn, i) { bell(t + i * 0.07, nn + 12, 0.11); });
      tone('sine', 90, t, 0.4, 0.4, sfxBus, 45, 0.3);
    } else if (rarity === 'epic') {
      boom(t, false);
      chord(t + 0.02, [50, 53, 57, 60, 64, 69], 2.2, 0.05, 'sawtooth', 3200);
      [74, 77, 81, 84, 88, 93].forEach(function (nn, i) { send(tone('square', midi(nn + 12), t + 0.25 + i * 0.05, 0.025, 0.3, sfxBus), sfxRev, 0.6); });
    } else {
      boom(t, true);
      chord(t + 0.02, [50, 54, 57, 61, 64, 69, 73], 3.6, 0.055, 'sawtooth', 4200);
      chord(t + 0.02, [38, 45], 3.0, 0.08, 'triangle', 900);
      [86, 88, 90, 93, 95, 98, 100, 102, 105, 107].forEach(function (nn, i) {
        send(tone('triangle', midi(nn), t + 0.3 + i * 0.045, 0.05, 0.5, sfxBus), sfxRev, 0.7);
      });
    }
  };
  A.newBadge = function () {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.005;
    tone('triangle', 1568, t, 0.06, 0.15, sfxBus);
    send(tone('triangle', 2093, t + 0.07, 0.06, 0.3, sfxBus), sfxRev, 0.5);
  };

  /* ---------------- 0.2.0 : explosions, cercles, progression ---------------- */
  // bille éliminée : détonation courte et grave, plus un éclat de verre
  A.explode = function (pan, v) {
    if (!ctx || !S.sfx || !voice(0.8)) return;
    const t = ctx.currentTime + 0.004, d = out(pan), k = clamp(v == null ? 1 : v, 0.2, 1);
    tone('sine', 150, t, 0.7 * k, 0.55, d, 38, 0.45);
    const n = noise(t, 0.5), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * k, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    n.connect(lp); lp.connect(g); g.connect(d); send(g, sfxRev, 0.45);
    [2637, 3520, 4186].forEach(function (f, i) { tone('triangle', f * MR.rand(0.95, 1.05), t + 0.02 + i * 0.025, 0.05 * k, 0.18, d); });
  };
  // un cercle du niveau 4 se brise
  A.ringBreak = function (pan) {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.01, d = out(pan);
    sweepNoise(t, 0.35, 6000, 900, 3, 0.18, d, 0.01);
    [88, 91, 95, 100].forEach(function (nn, i) { send(tone('triangle', midi(nn), t + i * 0.035, 0.05, 0.45, d), sfxRev, 0.6); });
  };
  // pulsation des cercles sur le temps
  A.pulse = function () {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.004;
    tone('sine', 196, t, 0.05, 0.12, sfxBus, 392, 0.06);
  };
  A.questDone = function () {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.01;
    [72, 76, 79, 84].forEach(function (nn, i) { bell(t + i * 0.08, nn + 12, 0.08); });
  };
  A.levelUp = function () {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.02;
    boom(t, false);
    chord(t + 0.05, [50, 57, 62, 65, 69, 74], 2.4, 0.05, 'sawtooth', 3600);
    [74, 77, 81, 86, 89, 93, 98].forEach(function (nn, i) { send(tone('square', midi(nn), t + 0.2 + i * 0.06, 0.03, 0.35, sfxBus), sfxRev, 0.6); });
  };
  A.coin = function () {
    if (!ctx || !S.sfx) return;
    const t = ctx.currentTime + 0.004;
    tone('square', 988, t, 0.05, 0.08, sfxBus);
    send(tone('square', 1319, t + 0.07, 0.05, 0.3, sfxBus), sfxRev, 0.4);
  };

  MR.Audio = A;
})(window.MR);
