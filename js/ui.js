/* MagicRace — interface : HUD, panneau de contrôle, éditeur de bille, résultats */
(function (MR) {
  'use strict';

  const UI = { boardDirty: true };
  let G = null;
  const $ = function (s) { return document.querySelector(s); };

  let panelOpen = false, frameN = 0, boardT = 0, lastClock = '';
  let draft = null, editingId = null, ed = null;
  const listPrev = [];
  const shaderPrev = [];
  let bannerTimer = null, toastTimer = null, cdTimer = null;
  const segSync = {};

  function fmtSpeed(v) { return (Math.round(v * 100) / 100).toString().replace('.', ',') + '×'; }
  function tagsOf(c) {
    const sk = c.skin === 'solid' ? 'Unie' : MR.skin(c.skin).name;
    const parts = [sk, MR.labelOf(MR.TRAILS, c.trail), MR.labelOf(MR.SOUNDS, c.sound)];
    if (c.outline !== 'none') parts.push(MR.labelOf(MR.OUTLINES, c.outline));
    return parts.join(' · ');
  }
  function ordinal(n) { return n === 1 ? '1er' : n + 'e'; }

  function seg(el, key, opts, onSet) {
    el.innerHTML = opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '">' + MR.esc(o[1]) + '</button>'; }).join('');
    const sync = function () {
      el.querySelectorAll('button').forEach(function (b) {
        const on = b.dataset.v === G.settings[key];
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    };
    el.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      onSet(b.dataset.v);
      sync();
    });
    segSync[key] = sync;
    sync();
  }

  // puces d'effets : celles qui ne sont pas gagnées en cartes restent verrouillées (couleur = rareté)
  function chips(el, list, field, onPick) {
    el.innerHTML = list.map(function (o) {
      const rc = o.rarity ? MR.rarity(o.rarity).color : 'transparent';
      return '<button type="button" class="chip" data-v="' + o.id + '" style="--rc:' + rc + '">' + (o.rarity ? '<i class="rdot"></i>' : '') + MR.esc(o.name) + '</button>';
    }).join('');
    el.addEventListener('click', function (e) {
      const b = e.target.closest('.chip');
      if (!b || !draft) return;
      if (b.classList.contains('locked')) {
        if (onPick) onPick(b.dataset.v);
        const it = list.find(function (o) { return o.id === b.dataset.v; });
        UI.toast(it.name + ' : à gagner dans les cartes (' + MR.rarity(it.rarity).name.toLowerCase() + ')');
        return;
      }
      draft[field] = b.dataset.v;
      if (onPick) onPick(b.dataset.v);
      syncEditor();
    });
  }
  function buildSwatches() {
    $('#edColors').innerHTML = MR.availableColors().map(function (c) {
      return '<button type="button" class="sw" data-c="' + c + '" style="--c:' + c + '" aria-label="Couleur ' + c + '"></button>';
    }).join('');
  }

  /* ---------------- initialisation ---------------- */
  UI.init = function (game) {
    G = game;
    $('#hudVer').textContent = 'v' + MR.VERSION;
    $('#panelVer').textContent = 'v' + MR.VERSION;

    $('#pToggle').addEventListener('click', function () { UI.setPanel(true); });
    $('#pClose').addEventListener('click', function () { UI.setPanel(false); });
    document.querySelectorAll('.sec-head').forEach(function (h) {
      h.addEventListener('click', function () {
        const closed = h.parentElement.classList.toggle('closed');
        h.setAttribute('aria-expanded', String(!closed));
      });
    });

    // course
    const sel = $('#levelSel');
    sel.innerHTML = MR.ZONES.map(function (z) {
      const lv = MR.LEVELS.filter(function (l) { return l.zone === z.id; });
      let h = '<optgroup label="' + MR.esc(z.name) + ' · ' + lv.length + '/' + z.size + ' niveaux">';
      lv.forEach(function (l) { h += '<option value="' + l.id + '">Niveau ' + l.num + ' — ' + MR.esc(l.name) + '</option>'; });
      for (let n = lv.length + 1; n <= z.size; n++) h += '<option disabled>Niveau ' + n + ' — bientôt</option>';
      return h + '</optgroup>';
    }).join('') + '<optgroup label="Prochaine zone"><option disabled>🔒 Bientôt</option></optgroup>';
    sel.value = G.levelDef.id;
    sel.addEventListener('change', function () { G.loadLevel(sel.value); });

    $('#bStart').addEventListener('click', function () { G.start(); });
    $('#bigStart').addEventListener('click', function () { G.start(); });
    $('#bPause').addEventListener('click', function () { G.togglePause(); });
    $('#bReset').addEventListener('click', function () { G.stopRun(true); G.reset(G.state !== 'ready', false); });
    // mode run : les niveaux à la suite
    const runToggle = function () { if (G.run) G.stopRun(); else { UI.hideResults(); G.startRun(); } };
    $('#bRun').addEventListener('click', runToggle);
    $('#bigRun').addEventListener('click', runToggle);

    const sp = $('#speed');
    sp.value = G.settings.speed;
    $('#speedOut').textContent = fmtSpeed(G.settings.speed);
    sp.addEventListener('input', function () {
      const v = parseFloat(sp.value);
      G.setSetting('speed', v);
      $('#speedOut').textContent = fmtSpeed(v);
    });
    seg($('#camSeg'), 'camera', [['leader', 'Leader'], ['pack', 'Peloton'], ['overview', 'Tout le niveau']], function (v) { G.setSetting('camera', v); });
    seg($('#namesSeg'), 'names', [['all', 'Tous'], ['top3', 'Top 3'], ['none', 'Aucun']], function (v) { G.setSetting('names', v); });

    // billes
    const cnt = $('#cntInput');
    cnt.max = MR.MAX_MARBLES;
    cnt.addEventListener('change', function () { G.setCount(parseInt(cnt.value, 10)); });
    cnt.addEventListener('keydown', function (e) { if (e.key === 'Enter') cnt.blur(); });
    $('#cntMinus').addEventListener('click', function () { G.setCount(G.roster.length - 1); });
    $('#cntPlus').addEventListener('click', function () { G.setCount(G.roster.length + 1); });
    $('#bAdd').addEventListener('click', function () { UI.openEditor(null); });

    // cartes
    $('#cToggle').addEventListener('click', function () { MR.Packs.show('packs'); });
    $('#bPacks').addEventListener('click', function () { MR.Packs.show('packs'); });
    $('#bColl').addEventListener('click', function () { MR.Packs.show('coll'); });
    // aide des paquets : cachée derrière un petit « ? »
    $('#cardsHelpBtn').addEventListener('click', function () {
      const b = $('#cardsHelpBtn'), open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      $('#cardsHelp').hidden = !open;
    });
    $('#odds').innerHTML = MR.RARITIES.map(function (r) {
      return '<li style="--rc:' + r.color + '"><b>' + String(r.chance).replace('.', ',') + ' %</b>' + MR.esc(r.name) + '</li>';
    }).join('');

    // son
    const mOn = $('#musicOn'), mVol = $('#musicVol'), sOn = $('#sfxOn'), sVol = $('#sfxVol');
    mOn.checked = G.settings.music; mVol.value = G.settings.musicVol;
    sOn.checked = G.settings.sfx; sVol.value = G.settings.sfxVol;
    mOn.addEventListener('change', function () { G.setSetting('music', mOn.checked); if (mOn.checked) MR.Audio.unlock(); });
    mVol.addEventListener('input', function () { G.setSetting('musicVol', parseFloat(mVol.value)); });
    sOn.addEventListener('change', function () { G.setSetting('sfx', sOn.checked); if (sOn.checked) { MR.Audio.unlock(); MR.Audio.uiTick(); } });
    sVol.addEventListener('input', function () { G.setSetting('sfxVol', parseFloat(sVol.value)); });

    // classement : toucher un nom pour suivre la bille
    $('#board').addEventListener('pointerdown', function (e) {
      const li = e.target.closest('.brow');
      if (li) G.follow(li.dataset.id);
    });

    buildEditor();

    $('#resReplay').addEventListener('click', function () { stopRunTimer(); UI.hideResults(); G.start(); });
    $('#resClose').addEventListener('click', function () {
      stopRunTimer();
      if (G.run) G.stopRun(true);
      UI.hideResults();
    });

    document.addEventListener('keydown', onKey);

    UI.renderList();
    const stored = MR.store.get('magicrace.panel', null);
    UI.setPanel(stored === null ? window.innerWidth >= 1100 : !!stored, true);
  };

  UI.syncControls = function () {
    Object.keys(segSync).forEach(function (k) { segSync[k](); });
    $('#musicOn').checked = G.settings.music;
    $('#sfxOn').checked = G.settings.sfx;
    $('#musicVol').value = G.settings.musicVol;
    $('#sfxVol').value = G.settings.sfxVol;
    $('#levelSel').value = G.levelDef.id;
    $('#speed').value = G.settings.speed;
    $('#speedOut').textContent = fmtSpeed(G.settings.speed);
    $('#fps').hidden = !G.settings.fps;
    UI.boardDirty = true;
  };

  UI.setPanel = function (open, silent) {
    panelOpen = !!open;
    MR.Render.panelOpen = panelOpen;
    document.body.classList.toggle('panel-open', panelOpen);
    $('#pToggle').setAttribute('aria-expanded', String(panelOpen));
    if (!silent) MR.store.set('magicrace.panel', panelOpen);
    if (!panelOpen && document.activeElement && $('#panel').contains(document.activeElement)) $('#pToggle').focus();
  };

  function onKey(e) {
    if (MR.Packs && MR.Packs.isOpen()) return; // la surcouche des cartes gère ses propres touches
    if (MR.Settings && MR.Settings.isOpen()) return;
    if (MR.Profile && MR.Profile.isOpen()) return;
    const tag = (e.target && e.target.tagName) || '';
    if (e.key === 'Escape') {
      if (!$('#editor').hidden) { UI.closeEditor(); return; }
      if (!$('#results').hidden) { UI.hideResults(); return; }
      if (panelOpen) { UI.setPanel(false); return; }
      return;
    }
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === ' ') {
      if (tag === 'BUTTON') return;
      e.preventDefault();
      if (G.state === 'racing' || G.state === 'countdown') G.togglePause(); else G.start();
    } else if (k === 'p') G.togglePause();
    else if (k === 'm') { G.setSetting('music', !G.settings.music); if (G.settings.music) MR.Audio.unlock(); UI.syncControls(); UI.toast(G.settings.music ? 'Musique activée' : 'Musique coupée'); }
    else if (k === 'c') UI.setPanel(!panelOpen);
    else if (k === 'k') MR.Packs.show('packs');
    else if (k === 's') MR.Settings.open();
    else if (k === 'l') MR.Profile.open('prog');
    else if (k === 'j') MR.Profile.openDaily();
    else if (k === 'v') {
      const order = ['leader', 'pack', 'overview'];
      const next = order[(order.indexOf(G.settings.camera) + 1) % order.length];
      G.setSetting('camera', next);
      UI.syncControls();
      UI.toast({ leader: 'Caméra : leader', pack: 'Caméra : peloton', overview: 'Caméra : tout le niveau' }[next]);
    }
  }

  /* ---------------- état de la course ---------------- */
  UI.onState = function () {
    const st = G.state;
    const label = G.paused ? 'Pause' : { ready: 'Prêt', countdown: 'Départ', racing: 'En course', finished: 'Terminé' }[st];
    const R = G.run;
    $('#status').textContent = R ? 'Run ' + (R.idx + 1) + '/' + R.levels.length + ' · ' + label : label;
    const big = $('#bigStart');
    big.hidden = !(st === 'ready' || st === 'finished');
    big.textContent = R && st === 'finished' ? (R.done ? '↺ Nouvelle run' : '▶ Niveau suivant') : st === 'finished' ? '↺ Rejouer' : '▶ Lancer la course';
    $('#bigRun').hidden = big.hidden || !!R;
    $('#bStart').textContent = st === 'ready' ? '▶ Lancer' : '↺ Rejouer';
    $('#bRun').textContent = R ? '■ Arrêter la run' : '🏁 Mode run : tous les niveaux à la suite';
    $('#bRun').classList.toggle('on', !!R);
    const bp = $('#bPause');
    bp.disabled = !(st === 'racing' || st === 'countdown');
    bp.textContent = G.paused ? '▶ Reprendre' : '❚❚ Pause';
    $('#pausedTag').hidden = !G.paused;
    UI.boardDirty = true;
  };

  UI.countdown = function (txt) {
    const el = $('#countdown');
    clearTimeout(cdTimer);
    if (!txt) { el.innerHTML = ''; return; }
    el.innerHTML = '<span>' + MR.esc(txt) + '</span>';
    cdTimer = setTimeout(function () { el.innerHTML = ''; }, 980);
  };

  UI.banner = function (name, survival) {
    const el = $('#banner');
    el.innerHTML = '<span class="crown" aria-hidden="true">♛</span><span class="bn">' + MR.esc(name) + (survival ? ' est la dernière bille en vie !' : ' remporte la course !') + '</span>';
    el.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(UI.hideBanner, 4200);
  };
  UI.hideBanner = function () { clearTimeout(bannerTimer); $('#banner').hidden = true; };

  UI.toast = function (msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2300);
  };

  function updateBoard() {
    const bs = G.settings.board, rk = G.ranking;
    $('#board').hidden = bs === 'hidden';
    $('#hudHint').hidden = bs === 'hidden' || window.innerWidth < 640;
    if (bs === 'hidden') return;
    const max = bs === '5' ? 5 : bs === '10' ? 10 : bs === 'all' ? rk.length : (window.innerWidth < 640 ? 5 : window.innerHeight < 760 ? 6 : 10);
    const surv = !!G.level.elim;
    let html = '';
    for (let i = 0; i < Math.min(rk.length, max); i++) {
      const m = rk[i];
      let right = '';
      if (m.out) right = '💥 ' + MR.formatTime(m.elimAt);
      else if (m.dnf) right = 'abandon';
      else if (m.finished) right = surv ? 'survivante' : MR.formatTime(m.time);
      else if (surv) right = G.state === 'racing' ? 'en vie' : '';
      else if (G.state !== 'ready' && G.state !== 'countdown') right = Math.round(G.progress(m)) + ' %';
      const cls = 'brow' + (m.finished && !m.dnf ? ' done' : '') + (i === 0 && G.state !== 'ready' ? ' gold' : '') + (G.followId === m.id ? ' follow' : '') + (m.cfg.me ? ' me' : '');
      html += '<li class="' + cls + '" data-id="' + m.id + '" style="--c:' + m.cfg.color + '" title="Suivre ' + MR.esc(m.cfg.name) + '">' +
        '<span class="rk">' + (i + 1) + '</span><span class="dot"></span><span class="nm">' + (m.cfg.me ? '★ ' : '') + MR.esc(m.cfg.name) + '</span><span class="tm">' + right + '</span></li>';
    }
    // la bille du joueur reste visible même hors du top
    const mine = rk.findIndex(function (m) { return m.cfg.me; });
    if (mine >= max) {
      const m = rk[mine];
      html += '<li class="brow me' + (G.followId === m.id ? ' follow' : '') + '" data-id="' + m.id + '" style="--c:' + m.cfg.color + '"><span class="rk">' + (mine + 1) +
        '</span><span class="dot"></span><span class="nm">★ ' + MR.esc(m.cfg.name) + '</span><span class="tm">' +
        (m.out ? '💥' : m.finished && !m.dnf ? (surv ? 'survivante' : MR.formatTime(m.time)) : (G.state === 'racing' ? (surv ? 'en vie' : Math.round(G.progress(m)) + ' %') : '')) + '</span></li>';
    }
    if (rk.length > max) html += '<li class="board-more">+ ' + (rk.length - max) + ' autre' + (rk.length - max > 1 ? 's' : '') + '</li>';
    $('#board').innerHTML = html;
    $('#hudHint').textContent = G.followId ? 'Touchez à nouveau le nom pour lâcher la caméra' : 'Touchez un nom ou une bille pour la suivre';
  }

  /* ---------------- liste des billes ---------------- */
  UI.renderList = function () {
    const ul = $('#marbleList');
    ul.innerHTML = '';
    listPrev.length = 0;
    const single = G.roster.length <= 1;
    G.roster.forEach(function (cfg) {
      const li = document.createElement('li');
      li.className = 'mrow';
      const cv = document.createElement('canvas');
      cv.width = 80; cv.height = 80;
      cv.setAttribute('aria-hidden', 'true');
      const info = document.createElement('div');
      info.className = 'info';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'mname'; inp.id = 'mname-' + cfg.id;
      inp.value = cfg.name; inp.maxLength = 18; inp.spellcheck = false; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', 'Nom de la bille');
      inp.addEventListener('input', function () { G.renameMarble(cfg.id, inp.value); });
      inp.addEventListener('change', function () {
        const c = G.roster.find(function (r) { return r.id === cfg.id; });
        if (c) inp.value = c.name;
        G.commitRename();
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
      const tags = document.createElement('span');
      tags.className = 'tags';
      tags.textContent = tagsOf(cfg);
      info.append(inp, tags);
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'icon-btn';
      edit.setAttribute('aria-label', 'Personnaliser ' + cfg.name);
      edit.title = 'Personnaliser';
      edit.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/></svg>';
      edit.addEventListener('click', function () { UI.openEditor(cfg.id); });
      const me = document.createElement('button');
      me.type = 'button'; me.className = 'icon-btn star' + (cfg.me ? ' on' : '');
      me.setAttribute('aria-label', cfg.me ? cfg.name + ' est ta bille' : 'Faire de ' + cfg.name + ' ta bille');
      me.setAttribute('aria-pressed', String(!!cfg.me));
      me.title = cfg.me ? 'Ta bille' : 'Choisir comme ta bille';
      me.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
      me.addEventListener('click', function () { G.setMe(cfg.id); });
      const dup = document.createElement('button');
      dup.type = 'button'; dup.className = 'icon-btn';
      dup.setAttribute('aria-label', 'Dupliquer ' + cfg.name);
      dup.title = 'Dupliquer';
      dup.disabled = G.roster.length >= MR.MAX_MARBLES;
      dup.innerHTML = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';
      dup.addEventListener('click', function () {
        const c = G.duplicateMarble(cfg);
        if (c) UI.toast(c.name + ' rejoint la course');
      });
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'icon-btn';
      del.setAttribute('aria-label', 'Retirer ' + cfg.name);
      del.title = single ? 'Il faut au moins une bille' : 'Retirer';
      del.disabled = single;
      del.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      del.addEventListener('click', function () { G.removeMarble(cfg.id); });
      li.className = 'mrow' + (cfg.me ? ' me' : '');
      li.append(cv, info, me, edit, dup, del);
      ul.append(li);
      listPrev.push({ id: cfg.id, ctx: cv.getContext('2d'), spec: {} });
    });
    const me = G.me(), n = G.roster.length;
    $('#meInfo').innerHTML = (me ? 'Ta bille : <b>★ ' + MR.esc(me.name) + '</b>. ' : '') +
      'Avec au moins ' + G.REWARD_MIN + ' billes en course, si elle finit 1re : un paquet premium (rare ou mieux), 2e : deux paquets, 3e : un paquet.' +
      (n < G.REWARD_MIN ? ' <span class="warn">Il manque ' + (G.REWARD_MIN - n) + ' bille' + (G.REWARD_MIN - n > 1 ? 's' : '') + '.</span>' : ' <span class="ok">Récompenses actives.</span>');
    $('#cntInput').value = G.roster.length;
    $('#countBadge').textContent = G.roster.length;
    $('#cntMinus').disabled = G.roster.length <= 1;
    $('#cntPlus').disabled = G.roster.length >= MR.MAX_MARBLES;
    $('#bAdd').disabled = G.roster.length >= MR.MAX_MARBLES;
  };

  function drawListPreviews() {
    const GL = MR.MarbleGL;
    const specs = listPrev.map(function (p, i) {
      const cfg = G.roster.find(function (r) { return r.id === p.id; });
      return cfg ? GL.spec(cfg, G.time * 0.6 + i * 0.7, p.spec) : null;
    });
    const slots = GL.ok ? GL.render(specs, 64, G.time, 1) : [];
    listPrev.forEach(function (p, i) {
      p.ctx.clearRect(0, 0, 80, 80);
      if (slots[i]) GL.blit(p.ctx, slots[i], 4, 4, 72, 72);
      else {
        const cfg = G.roster.find(function (r) { return r.id === p.id; });
        if (cfg) GL.fallback(p.ctx, 40, 40, 36, cfg);
      }
    });
  }

  /* ---------------- éditeur ---------------- */
  function buildEditor() {
    const sw = $('#edColors');
    buildSwatches();
    sw.addEventListener('click', function (e) {
      const b = e.target.closest('.sw');
      if (!b || !draft) return;
      draft.skin = 'solid'; draft.color = b.dataset.c;
      $('#edCustom').value = draft.color;
      syncEditor();
    });
    $('#edCustom').addEventListener('input', function (e) {
      if (!draft) return;
      draft.skin = 'solid'; draft.color = e.target.value;
      syncEditor();
    });

    const sh = $('#edShaders');
    buildSkinRows();
    sh.addEventListener('click', function (e) {
      const b = e.target.closest('.shd');
      if (!b || !draft) return;
      if (b.classList.contains('locked')) { UI.toast('Bille à débloquer : ouvre des paquets de cartes'); return; }
      const s = MR.skin(b.dataset.s);
      draft.skin = s.id; draft.color = s.accent;
      syncEditor();
    });
    $('#edToCards').addEventListener('click', function () { MR.Packs.show('coll'); });

    // image perso : réduite à 64×64 et compressée en JPEG avant d'être gardée
    const file = $('#edPhotoFile');
    $('#edPhoto').addEventListener('click', function () {
      if (!draft) return;
      if (draft.img && draft.skin !== 'photo') { draft.skin = 'photo'; syncEditor(); }
      else file.click();
    });
    $('#edPhotoX').addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f || !draft) return;
      const target = draft;
      MR.compressImage(f, target.color).then(function (url) {
        target.img = url; target.skin = 'photo';
        if (draft === target) syncEditor();
      }).catch(function () { UI.toast('Cette image ne peut pas être lue'); });
    });

    chips($('#edTrail'), MR.TRAILS, 'trail');
    chips($('#edSound'), MR.SOUNDS, 'sound', function (id) { MR.Audio.unlock(); MR.Audio.hit(id, 0.85, 0); });
    chips($('#edOutline'), MR.OUTLINES, 'outline');
    $('#edOutlineColor').addEventListener('input', function (e) { if (draft) { draft.outlineColor = e.target.value; syncEditor(); } });

    const name = $('#edName');
    name.addEventListener('input', function () { if (draft) draft.name = name.value; });
    name.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveEditor(); });
    $('#edDice').addEventListener('click', function () {
      if (!draft) return;
      draft.name = MR.uniqueName(G.roster.filter(function (r) { return r.id !== editingId; }).map(function (r) { return r.name; }));
      name.value = draft.name;
    });
    $('#edShuffle').addEventListener('click', function () {
      if (!draft) return;
      Object.assign(draft, MR.randomLook());
      $('#edCustom').value = draft.skin === 'solid' ? draft.color : $('#edCustom').value;
      syncEditor();
    });
    $('#edBack').addEventListener('click', UI.closeEditor);
    $('#edCancel').addEventListener('click', UI.closeEditor);
    $('#edSave').addEventListener('click', saveEditor);
    $('#edDup').addEventListener('click', function () {
      if (!draft) return;
      const c = G.duplicateMarble(Object.assign({}, draft, { name: (draft.name || '').trim() || 'Bille' }));
      if (c) UI.toast('Copie ajoutée : ' + c.name);
    });
  }

  // billes de collection, rangées par rareté ; celles qui ne sont pas obtenues restent des silhouettes
  function buildSkinRows() {
    const sh = $('#edShaders');
    sh.innerHTML = '';
    shaderPrev.length = 0;
    ['uncommon', 'rare', 'epic', 'legendary'].forEach(function (rid) {
      const r = MR.rarity(rid);
      const skins = MR.COLLECTIBLE_SKINS.filter(function (s) { return s.rarity === rid; });
      const owned = skins.filter(function (s) { return MR.isSkinUnlocked(s.id); }).length;
      const row = document.createElement('div');
      row.style.setProperty('--rc', r.color);
      row.innerHTML = '<div class="skin-head"><span>' + r.plural + '</span><span>' + owned + '/' + skins.length + '</span></div>';
      const grid = document.createElement('div');
      grid.className = 'shaders';
      skins.forEach(function (s) {
        const un = MR.isSkinUnlocked(s.id);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'shd' + (un ? '' : ' locked');
        b.dataset.s = s.id;
        b.setAttribute('aria-label', un ? 'Bille ' + s.name : 'Bille ' + r.name.toLowerCase() + ' verrouillée');
        b.innerHTML = '<canvas width="96" height="96" aria-hidden="true"></canvas><span>' + (un ? MR.esc(s.name) : '???') + '</span>';
        grid.appendChild(b);
        const ctx = b.querySelector('canvas').getContext('2d');
        if (un) shaderPrev.push({ skin: s, ctx: ctx });
        else MR.MarbleGL.silhouette(ctx, 48, 48, 42);
      });
      row.appendChild(grid);
      sh.appendChild(row);
    });
  }

  // après l'ouverture d'un paquet : verrous de l'éditeur et étiquettes de la liste
  UI.refreshUnlocks = function () {
    buildSkinRows();
    buildSwatches();
    syncEditor();
    UI.renderList();
  };

  function syncEditor() {
    if (!draft) return;
    const solid = draft.skin === 'solid';
    let known = false;
    document.querySelectorAll('#edColors .sw').forEach(function (b) {
      const on = solid && b.dataset.c.toLowerCase() === draft.color.toLowerCase();
      if (on) known = true;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('#edCustomWrap').classList.toggle('on', solid && !known);
    document.querySelectorAll('#edShaders .shd').forEach(function (b) {
      const on = b.dataset.s === draft.skin;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    [['#edTrail', 'trail'], ['#edSound', 'sound'], ['#edOutline', 'outline']].forEach(function (p) {
      document.querySelectorAll(p[0] + ' .chip').forEach(function (b) {
        const on = b.dataset.v === draft[p[1]];
        const lock = !MR.isEffectUnlocked(p[1], b.dataset.v);
        b.classList.toggle('on', on);
        b.classList.toggle('locked', lock);
        b.setAttribute('aria-pressed', String(on));
        b.title = lock ? 'À gagner dans les cartes' : '';
      });
    });
    $('#edOutlineColor').value = draft.outlineColor;
    const pb = $('#edPhoto');
    pb.classList.toggle('on', draft.skin === 'photo');
    pb.setAttribute('aria-pressed', String(draft.skin === 'photo'));
    $('#edPhotoLbl').textContent = draft.img ? 'Mon image' : 'Mettre ma propre image';
    $('#edPhotoX').hidden = !draft.img;
    drawPhotoThumb(draft.img);
  }
  let thumbSrc = undefined;
  function drawPhotoThumb(src) {
    if (thumbSrc === src) return;
    thumbSrc = src;
    const cv = $('#edPhotoPrev'), c = cv.getContext('2d');
    c.clearRect(0, 0, 56, 56);
    if (!src) {
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(28, 17); c.lineTo(28, 39); c.moveTo(17, 28); c.lineTo(39, 28); c.stroke();
      return;
    }
    const im = new Image();
    im.onload = function () {
      if (thumbSrc !== src) return;
      c.save(); c.beginPath(); c.arc(28, 28, 28, 0, MR.TAU); c.clip();
      c.drawImage(im, 0, 0, 56, 56); c.restore();
    };
    im.src = src;
  }

  UI.openEditor = function (id) {
    const cfg = id ? G.roster.find(function (r) { return r.id === id; }) : null;
    if (!cfg && G.roster.length >= MR.MAX_MARBLES) { UI.toast(MR.MAX_MARBLES + ' billes maximum'); return; }
    editingId = cfg ? cfg.id : null;
    draft = cfg ? Object.assign({}, cfg) : MR.randomMarble(G.roster.map(function (r) { return r.name; }));
    $('#edTitle').textContent = cfg ? 'Personnaliser la bille' : 'Nouvelle bille';
    $('#edSave').textContent = cfg ? 'Enregistrer' : 'Ajouter la bille';
    $('#edName').value = draft.name;
    if (draft.skin === 'solid') $('#edCustom').value = draft.color;
    const cv = $('#edPreview');
    ed = {
      cv: cv, ctx: cv.getContext('2d'), bloom: new MR.Bloom(), sys: new MR.FX.System(), t: 0, lastTrail: null,
      m: { id: 'preview', cfg: draft, x: 0, y: 0, vx: 0, vy: 0, r: 20, angle: 0, hist: [], emit: 0, rgb: [255, 255, 255], orgb: [255, 255, 255], seedN: 1, spec: {} }
    };
    if (!panelOpen) UI.setPanel(true);
    $('#editor').hidden = false;
    document.querySelector('.ed-scroll').scrollTop = 0;
    syncEditor();
    $('#edBack').focus();
  };

  UI.closeEditor = function () {
    $('#editor').hidden = true;
    draft = null; editingId = null; ed = null;
    const btn = $('#bAdd');
    if (btn) btn.focus();
  };

  function saveEditor() {
    if (!draft) return;
    const taken = G.roster.filter(function (r) { return r.id !== editingId; }).map(function (r) { return r.name; });
    draft.name = (draft.name || '').trim().slice(0, 18) || MR.uniqueName(taken);
    const wasNew = !editingId, name = draft.name;
    if (editingId) G.updateMarble(Object.assign({}, draft));
    else if (!G.addMarble(Object.assign({}, draft))) return;
    UI.closeEditor();
    UI.toast(wasNew ? name + ' rejoint la course' : name + ' est à jour');
  }

  function drawEditor(dt) {
    if (!ed || !draft) return;
    const GL = MR.MarbleGL;
    // la zone des aperçus de l'atlas ne tient que 64 cases de 128 : on rend les billes de collection par paquets
    // (chaque paquet est copié dans ses vignettes avant que le suivant ne réutilise les cases)
    const TILE = 128, cap = Math.max(1, Math.floor(GL.ATLAS_W / TILE) * Math.floor((GL.ATLAS_H - GL.MAIN_H) / TILE));
    for (let start = 0; start < shaderPrev.length; start += cap) {
      const chunk = shaderPrev.slice(start, start + cap);
      const specs = chunk.map(function (o, k) {
        const i = start + k;
        return { skin: o.skin.id, col: MR.hexToRgb(o.skin.accent), seed: 0.37 + i * 0.13, angle: G.time * 0.5 + i };
      });
      const slots = GL.ok ? GL.render(specs, TILE, G.time, 1) : [];
      chunk.forEach(function (o, k) {
        o.ctx.clearRect(0, 0, 96, 96);
        if (slots[k]) GL.blit(o.ctx, slots[k], 3, 3, 90, 90);
        else GL.fallback(o.ctx, 48, 48, 44, { skin: o.skin.id, color: o.skin.accent });
      });
    }
    const m = ed.m;
    m.cfg = draft;
    const own = GL.ok ? GL.render([GL.spec(draft, m.angle, m.spec)], TILE, G.time, 1) : [];
    drawPreviewScene(dt, own[0]);
  }

  function drawPreviewScene(dt, slot) {
    const P = ed, cv = P.cv, m = P.m;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 340, h = cv.clientHeight || 150;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    P.bloom.resize(w, h, 3);
    m.rgb = MR.hexToRgb255(draft.color);
    m.orgb = MR.hexToRgb255(draft.outlineColor);
    m.seedN = Math.floor((draft.seed || 0) * 1000);
    if (P.lastTrail !== draft.trail) { m.hist.length = 0; P.sys.clear(); P.lastTrail = draft.trail; }
    P.t += dt;
    const cx = w / 2, cy = h / 2 + 6, ax = Math.min(w * 0.36, 150), ay = h * 0.24;
    const nx = cx + Math.sin(P.t * 1.3) * ax, ny = cy + Math.sin(P.t * 2.6) * ay;
    if (dt > 0 && P.t > dt) { m.vx = (nx - m.x) / dt; m.vy = (ny - m.y) / dt; }
    m.x = nx; m.y = ny;
    m.angle += (m.vx / m.r) * dt;
    MR.FX.trailTick(P.sys, m, dt, G.time);
    P.sys.update(dt);

    const c = P.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#120822'); g.addColorStop(1, '#06030b');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(244,237,255,0.07)';
    for (let y = 12; y < h; y += 24) for (let x = 12; x < w; x += 24) c.fillRect(x - 1, y - 1, 2, 2);

    const b = P.bloom.begin();
    b.setTransform(1 / 3, 0, 0, 1 / 3, 0, 0);
    const beat = MR.Audio.beat();
    MR.FX.drawTrail(c, b, m, G.time);
    P.sys.drawUnder(c, b);
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.beginPath(); c.ellipse(m.x + 4, m.y + 6, m.r, m.r * 0.95, 0, 0, MR.TAU); c.fill();
    MR.FX.drawOutlineUnder(c, b, m, G.time, beat);
    b.fillStyle = MR.rgbStr(m.rgb, 0.35);
    b.beginPath(); b.arc(m.x, m.y, m.r * 1.15, 0, MR.TAU); b.fill();
    if (slot) MR.MarbleGL.blit(c, slot, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    else MR.MarbleGL.fallback(c, m.x, m.y, m.r, draft);
    MR.FX.drawOutline(c, b, m, G.time, beat);
    P.sys.drawOver(c, b);
    P.bloom.apply(c, 0.9);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.font = '700 13px Outfit, system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.lineWidth = 3.5; c.strokeStyle = 'rgba(8,4,15,0.85)'; c.lineJoin = 'round';
    const label = (draft.name || '').trim() || '…';
    c.strokeText(label, m.x, m.y - m.r - 8);
    c.fillStyle = '#f4edff';
    c.fillText(label, m.x, m.y - m.r - 8);
  }

  /* ---------------- résultats ---------------- */
  UI.showResults = function () {
    const rk = G.ranking, GL = MR.MarbleGL;
    const done = rk.filter(function (m) { return m.finished && !m.dnf; });
    const winner = done[0], surv = !!G.level.elim;
    const boom = rk.filter(function (m) { return m.out && m.dnf; }).length;
    $('#resTitle').textContent = 'Classement';
    $('#resSub').textContent = G.levelDef.name + ' · ' + rk.length + ' bille' + (rk.length > 1 ? 's' : '') +
      (winner ? (surv ? ' · dernière en vie après ' : ' · victoire en ') + MR.formatTime(surv ? G.raceTime : winner.time) : '') +
      (boom ? ' · ' + boom + ' bille' + (boom > 1 ? 's' : '') + ' coincée' + (boom > 1 ? 's' : '') + ' (💥)' : '');
    const rw = $('#resReward');
    let rwHtml = G.reward ? '★ Ta bille finit ' + (G.reward.rank === 1 ? '1re' : G.reward.rank + 'e') + ' : tu gagnes <b>' + MR.esc(G.reward.text) + '</b>' : '';
    if (G.raceXP) rwHtml += (rwHtml ? '<br>' : '') + '<span class="chip-xp">+' + G.raceXP + ' XP</span> pour cette course' + (rk.length < 30 ? ' (500 XP max avec 30 billes ou plus)' : '');
    rw.hidden = !rwHtml;
    rw.innerHTML = rwHtml;
    const top = done.slice(0, 3);
    const order = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
    const pod = $('#podium');
    pod.innerHTML = '';
    const specs = [], ctxs = [];
    order.forEach(function (idx) {
      const m = top[idx];
      if (!m) return;
      const d = document.createElement('div');
      d.className = 'pod p' + (idx + 1);
      const cv = document.createElement('canvas');
      cv.width = 116; cv.height = 116;
      cv.setAttribute('aria-hidden', 'true');
      const pn = document.createElement('span'); pn.className = 'pn'; pn.textContent = m.cfg.name;
      const pt = document.createElement('span'); pt.className = 'pt'; pt.textContent = surv ? (idx === 0 ? 'survivante' : '💥 ' + MR.formatTime(m.time)) : MR.formatTime(m.time);
      const blk = document.createElement('div'); blk.className = 'blk'; blk.textContent = String(idx + 1);
      d.append(cv, pn, pt, blk);
      pod.append(d);
      specs.push(GL.spec(m.cfg, 0.4, {}));
      ctxs.push({ ctx: cv.getContext('2d'), cfg: m.cfg });
    });
    const slots = GL.ok ? GL.render(specs, 128, G.time, 1) : [];
    ctxs.forEach(function (o, i) {
      if (slots[i]) GL.blit(o.ctx, slots[i], 4, 4, 108, 108);
      else GL.fallback(o.ctx, 58, 58, 54, o.cfg);
    });
    let html = '';
    rk.forEach(function (m, i) {
      const tm = m.out && m.dnf ? '💥 coincée' : m.dnf ? 'abandon' : surv ? (m.out ? '💥 ' + MR.formatTime(m.time) : 'survivante') : MR.formatTime(m.time);
      html += '<li style="--c:' + m.cfg.color + '"' + (m.cfg.me ? ' class="me"' : '') + '><span class="rk">' + (m.dnf ? '—' : ordinal(i + 1)) + '</span><span class="dot"></span><span class="nm">' +
        (m.cfg.me ? '★ ' : '') + MR.esc(m.cfg.name) + '</span><span class="tm">' + tm + '</span></li>';
    });
    const list = $('#resList');
    list.innerHTML = html;
    list.hidden = rk.length <= 1;
    renderRun();
    $('#results').hidden = false;
    $('#resReplay').focus();
  };
  UI.hideResults = function () { stopRunTimer(); $('#results').hidden = true; };

  // classement cumulé de la run, puis passage automatique au niveau suivant
  let runTimer = null;
  function stopRunTimer() { if (runTimer) { clearInterval(runTimer); runTimer = null; } }
  function renderRun() {
    stopRunTimer();
    const R = G.run, box = $('#resRun'), replay = $('#resReplay'), close = $('#resClose');
    if (!R) {
      box.hidden = true;
      replay.textContent = '↺ Rejouer'; close.textContent = 'Fermer';
      return;
    }
    const st = G.runStandings(), races = R.races;
    if (R.done) $('#resTitle').textContent = 'Classement de la run';
    let h = '<h3>' + (R.done ? 'Run terminée · ' + races.length + ' niveaux' : 'Run · niveau ' + (R.idx + 1) + ' sur ' + R.levels.length) +
      ' <small>points : nombre de billes − place + 1</small></h3><div class="run-table"><div class="run-row run-th"><span>#</span><span>Bille</span>' +
      races.map(function (r) { return '<span title="' + MR.esc(r.name) + '">N' + r.num + '</span>'; }).join('') + '<span>Total</span></div>';
    const meIdx = st.findIndex(function (t) { return t.me; });
    st.forEach(function (t, i) {
      if (i >= 10 && i !== meIdx) return;
      h += '<div class="run-row' + (t.me ? ' me' : '') + (i < 3 ? ' p' + (i + 1) : '') + '" style="--c:' + t.color + '"><span>' + (i + 1) + '</span><span class="rn"><i class="dot"></i>' + (t.me ? '★ ' : '') + MR.esc(t.name) + '</span>' +
        races.map(function (r, k) { return '<span>' + (t.per[k] || 0) + '</span>'; }).join('') + '<span class="rt">' + t.pts + '</span></div>';
    });
    h += '</div><h3 class="run-last">Course ' + races.length + ' : niveau ' + G.levelDef.num + ' — ' + MR.esc(G.levelDef.name) + '</h3>';
    box.innerHTML = h;
    box.hidden = false;
    // la run la plus haute : la bille gagnante de la run en tête du podium
    if (R.done) {
      close.textContent = 'Fermer';
      replay.textContent = '↺ Nouvelle run';
      $('#resSub').textContent = st[0] ? st[0].name + ' gagne la run avec ' + st[0].pts + ' points' : '';
      if (R.xp) {
        const rw = $('#resReward');
        rw.innerHTML = '<span class="chip-xp">+' + R.xp + ' XP</span> pour ta bille ★, ' + (R.myPos === 1 ? '1re' : R.myPos + 'e') + ' de la run';
        rw.hidden = false;
      }
      return;
    }
    close.textContent = 'Arrêter la run';
    let left = 8;
    const label = function () { replay.textContent = '▶ Niveau suivant (' + left + ')'; };
    label();
    runTimer = setInterval(function () {
      left--;
      if (left <= 0) { stopRunTimer(); G.runNext(); return; }
      label();
    }, 1000);
  }

  /* ---------------- par image ---------------- */
  let fpsN = 0, fpsT = 0;
  UI.frame = function (dt) {
    if (MR.Packs) MR.Packs.frame(dt);
    if (MR.Profile) MR.Profile.frame(dt);
    if (G.settings.fps) {
      fpsN++; fpsT += dt;
      if (fpsT >= 0.5) { $('#fps').textContent = Math.round(fpsN / fpsT) + ' i/s'; fpsN = 0; fpsT = 0; }
    }
    const txt = MR.formatTime(G.state === 'countdown' ? 0 : G.raceTime);
    if (txt !== lastClock) { $('#clock').textContent = txt; lastClock = txt; }
    boardT -= dt;
    if (boardT <= 0 || UI.boardDirty) { boardT = 0.25; UI.boardDirty = false; updateBoard(); }
    if (!panelOpen) return;
    frameN++;
    if (ed && draft) drawEditor(dt);
    else if (frameN % 3 === 0) drawListPreviews();
  };

  MR.UI = UI;
})(window.MR);
