/* MagicRace — menu Paramètres (0.1.0) : affichage, caméra, course, son, cartes */
(function (MR) {
  'use strict';

  const S = {};
  let G = null, ov = null, body = null, isOpen = false;
  const $ = function (s) { return document.querySelector(s); };
  const pct = function (v) { return Math.round(v * 100) + ' %'; };

  const SCHEMA = [
    { sec: 'Affichage', items: [
      { key: 'quality', type: 'seg', label: 'Qualité d’image', opts: [['auto', 'Auto'], ['high', 'Haute'], ['medium', 'Moyenne'], ['low', 'Basse']],
        hint: 'Baisse la qualité si le jeu saccade sur ton téléphone.' },
      { key: 'bloom', type: 'range', label: 'Bloom (lueurs néon)', min: 0, max: 1.5, step: 0.05, fmt: pct },
      { key: 'glow', type: 'range', label: 'Halo autour des billes', min: 0, max: 2, step: 0.1, fmt: pct },
      { key: 'particles', type: 'range', label: 'Particules et traînées', min: 0, max: 1, step: 0.1, fmt: pct },
      { key: 'beams', type: 'toggle', label: 'Faisceaux et lumières du fond' },
      { key: 'vignette', type: 'toggle', label: 'Assombrir les bords de l’écran' },
      { key: 'fps', type: 'toggle', label: 'Afficher les images par seconde' }
    ] },
    { sec: 'Caméra', items: [
      { key: 'camera', type: 'seg', label: 'Cadrage', opts: [['leader', 'Leader'], ['pack', 'Peloton'], ['overview', 'Tout le niveau']] },
      { key: 'zoom', type: 'range', label: 'Zoom de suivi', min: 0.6, max: 1.6, step: 0.05, fmt: pct },
      { key: 'camSmooth', type: 'seg', label: 'Mouvement de la caméra', opts: [['soft', 'Doux'], ['normal', 'Normal'], ['fast', 'Vif']] },
      { key: 'followMe', type: 'toggle', label: 'Suivre ma bille ★ pendant la course' }
    ] },
    { sec: 'Course', items: [
      { key: 'speed', type: 'range', label: 'Vitesse de la course', min: 0.25, max: 2, step: 0.25, fmt: function (v) { return String(v).replace('.', ',') + '×'; } },
      { key: 'countdown', type: 'toggle', label: 'Compte à rebours 3, 2, 1' },
      { key: 'names', type: 'seg', label: 'Noms au-dessus des billes', opts: [['all', 'Tous'], ['top3', 'Top 3'], ['none', 'Aucun']] },
      { key: 'labelSize', type: 'range', label: 'Taille des noms', min: 9, max: 18, step: 1, fmt: function (v) { return v + ' px'; } },
      { key: 'board', type: 'seg', label: 'Classement à l’écran', opts: [['auto', 'Auto'], ['5', '5'], ['10', '10'], ['all', 'Tous'], ['hidden', 'Masqué']] }
    ] },
    { sec: 'Son', items: [
      { key: 'music', type: 'toggle', label: 'Musique' },
      { key: 'musicVol', type: 'range', label: 'Volume de la musique', min: 0, max: 1, step: 0.05, fmt: pct },
      { key: 'sfx', type: 'toggle', label: 'Bruitages' },
      { key: 'sfxVol', type: 'range', label: 'Volume des bruitages', min: 0, max: 1, step: 0.05, fmt: pct },
      { key: 'sfxMarble', type: 'toggle', label: 'Petits chocs entre les billes' }
    ] },
    { sec: 'Cartes', items: [
      { key: 'cardFast', type: 'toggle', label: 'Ouverture rapide des épiques et légendaires' },
      { key: 'shake', type: 'toggle', label: 'Secousses et flashs' }
    ] }
  ];

  // ---------- Application : installation sur l'appareil + lien vers le site PC / téléphone ----------
  const SITE = 'https://azeleonze.github.io/magicrace/';
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvt = e;
    if (body) buildApp();
  });
  window.addEventListener('appinstalled', function () {
    installEvt = null;
    if (body) buildApp();
  });
  function standalone() {
    try { return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; }
    catch (e) { return false; }
  }
  function buildApp() {
    let s = document.getElementById('setApp');
    if (!s) {
      s = document.createElement('section');
      s.className = 'set-sec';
      s.id = 'setApp';
      body.appendChild(s);
    }
    const onSite = location.hostname === 'azeleonze.github.io';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let html = '<h3>Application</h3>';
    if (standalone()) {
      html += '<p class="set-note">MagicRace est installé sur cet appareil ✓</p>';
    } else if (installEvt) {
      html += '<div class="set-row"><span class="set-lbl">Installer MagicRace sur cet appareil</span>' +
        '<button class="btn" id="setInstall" type="button">Installer</button></div>';
    } else if (onSite && ios) {
      html += '<p class="set-note">Sur iPhone et iPad : touche <b>Partager</b>, puis <b>Sur l’écran d’accueil</b> pour l’avoir comme une app.</p>';
    } else if (onSite) {
      html += '<p class="set-note">Pour l’installer : menu du navigateur, puis <b>Installer l’application</b> (ou <b>Ajouter à l’écran d’accueil</b>).</p>';
    }
    if (!onSite) {
      html += '<div class="set-row"><span class="set-lbl">Jouer sur PC et téléphone</span>' +
        '<a class="btn" href="' + SITE + '" target="_blank" rel="noopener">Ouvrir le site</a></div>' +
        '<p class="set-hint">azeleonze.github.io/magicrace : s’installe comme une app, marche hors ligne. Les cartes et billes sont gardées sur chaque appareil.</p>';
    } else {
      html += '<p class="set-hint">Les cartes et billes sont gardées sur cet appareil, même hors ligne.</p>';
    }
    s.innerHTML = html;
    const ib = document.getElementById('setInstall');
    if (ib) ib.addEventListener('click', function () {
      const ev = installEvt;
      if (!ev) return;
      installEvt = null;
      ev.prompt();
      Promise.resolve(ev.userChoice).then(function (r) {
        if (r && r.outcome === 'accepted') MR.UI.toast('MagicRace s’installe sur ton appareil');
        buildApp();
      }).catch(function () { buildApp(); });
    });
  }

  function set(key, v) {
    G.setSetting(key, v);
    if ((key === 'music' || key === 'sfx') && v) MR.Audio.unlock();
    MR.UI.syncControls();
  }

  function build() {
    body.innerHTML = '';
    SCHEMA.forEach(function (sec) {
      const s = document.createElement('section');
      s.className = 'set-sec';
      s.innerHTML = '<h3>' + sec.sec + '</h3>';
      sec.items.forEach(function (it) {
        const row = document.createElement('div');
        row.className = 'set-row' + (it.type === 'seg' ? ' wide' : '');
        const id = 'set-' + it.key;
        if (it.type === 'toggle') {
          row.innerHTML = '<span class="set-lbl" id="' + id + '-l">' + it.label + '</span>' +
            '<label class="switch"><input type="checkbox" id="' + id + '" aria-labelledby="' + id + '-l"><span></span></label>';
          row.querySelector('input').addEventListener('change', function (e) { set(it.key, e.target.checked); });
        } else if (it.type === 'range') {
          row.innerHTML = '<label class="set-lbl" for="' + id + '">' + it.label + ' <output id="' + id + '-o"></output></label>' +
            '<input type="range" id="' + id + '" min="' + it.min + '" max="' + it.max + '" step="' + it.step + '">';
          row.querySelector('input').addEventListener('input', function (e) {
            const v = parseFloat(e.target.value);
            set(it.key, v);
            $('#' + id + '-o').textContent = it.fmt(v);
          });
        } else {
          row.innerHTML = '<span class="set-lbl">' + it.label + '</span><div class="seg" id="' + id + '" role="group" aria-label="' + it.label + '">' +
            it.opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
          row.querySelector('.seg').addEventListener('click', function (e) {
            const b = e.target.closest('button');
            if (!b) return;
            set(it.key, b.dataset.v);
            S.sync();
          });
        }
        if (it.hint) {
          const h = document.createElement('p');
          h.className = 'set-hint';
          h.textContent = it.hint;
          row.appendChild(h);
        }
        s.appendChild(row);
      });
      body.appendChild(s);
    });
    buildApp();
  }

  // remet chaque contrôle sur la valeur actuelle des réglages
  S.sync = function () {
    if (!body) return;
    SCHEMA.forEach(function (sec) {
      sec.items.forEach(function (it) {
        const el = document.getElementById('set-' + it.key), v = G.settings[it.key];
        if (!el) return;
        if (it.type === 'toggle') el.checked = !!v;
        else if (it.type === 'range') { el.value = v; $('#set-' + it.key + '-o').textContent = it.fmt(v); }
        else el.querySelectorAll('button').forEach(function (b) {
          const on = b.dataset.v === String(v);
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', String(on));
        });
      });
    });
  };

  S.open = function () {
    isOpen = true;
    ov.hidden = false;
    S.sync();
    $('#setClose').focus();
  };
  S.close = function () {
    isOpen = false;
    ov.hidden = true;
    resetArmed = false;
    $('#setReset').textContent = 'Rétablir les réglages par défaut';
    const b = $('#sToggle');
    if (b) b.focus();
  };
  S.isOpen = function () { return isOpen; };

  let resetArmed = false;
  S.init = function (game) {
    G = game;
    ov = $('#settingsOv');
    body = $('#setBody');
    build();
    $('#setClose').addEventListener('click', S.close);
    ov.addEventListener('click', function (e) { if (e.target === ov) S.close(); });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); S.close(); } });
    $('#sToggle').addEventListener('click', S.open);
    const pb = $('#bSettings');
    if (pb) pb.addEventListener('click', S.open);
    $('#setVer').textContent = 'MagicRace v' + MR.VERSION;
    // remise à zéro en deux clics (les boîtes de confirmation du navigateur ne marchent pas partout)
    $('#setReset').addEventListener('click', function () {
      const btn = $('#setReset');
      if (!resetArmed) { resetArmed = true; btn.textContent = 'Confirmer la remise à zéro'; return; }
      resetArmed = false;
      btn.textContent = 'Rétablir les réglages par défaut';
      Object.keys(G.DEFAULTS).forEach(function (k) { if (k !== 'levelId') G.setSetting(k, G.DEFAULTS[k]); });
      MR.UI.syncControls();
      S.sync();
      MR.UI.toast('Réglages par défaut rétablis');
    });
  };

  MR.Settings = S;
})(window.MR);
