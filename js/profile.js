/* MagicRace — interface de progression (0.2.0) : badge de niveau, profil (progression, succès, stats, classement),
 * récompense quotidienne, notifications et passage de niveau. */
(function (MR) {
  'use strict';

  const PR = {};
  let G = null, ov = null, dov = null, tab = 'prog', isOpen = false, dailyOpen = false;
  let boardRows = null, boardState = 'idle', boardCache = false, deleteArmed = false;
  const $ = function (s) { return document.querySelector(s); };
  const esc = function (s) { return MR.esc(s); };
  const fmt = function (n) { return Math.round(n).toLocaleString('fr-FR'); };
  function pct(a, b) { return b > 0 ? Math.round(a / b * 100) + ' %' : '—'; }
  function clock(ms) {
    const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
    return (h ? h + ' h ' : '') + String(m).padStart(2, '0') + ' min ' + String(s).padStart(2, '0') + ' s';
  }
  function duration(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60;
    return h ? h + ' h ' + String(m).padStart(2, '0') : m + ' min ' + String(Math.floor(sec) % 60).padStart(2, '0') + ' s';
  }
  // petits paquets dessinés en CSS (normal, premium, ultra) pour les récompenses
  function packIcons(r, big) {
    let h = '';
    [['packs', ''], ['premium', ' premium'], ['ultra', ' ultra']].forEach(function (k) {
      const n = r[k[0]] || 0;
      if (n) h += '<span class="mp" title="' + n + ' ' + (k[0] === 'packs' ? 'paquet' + (n > 1 ? 's' : '') : 'paquet' + (n > 1 ? 's ' : ' ') + k[0]) + '"><span class="mini-pack' + k[1] + (big ? ' big' : '') + '"><i></i></span>' + (n > 1 ? '<b>×' + n + '</b>' : '') + '</span>';
    });
    return h;
  }
  function rewardChips(xp, r) {
    let h = xp ? '<span class="chip-xp">+' + fmt(xp) + ' XP</span>' : '';
    if (r) h += packIcons(r);
    if (r && r.storage) h += '<span class="chip-xp store">+1 réserve</span>';
    return h;
  }

  /* ---------------- badge de niveau et bouton cadeau ---------------- */
  PR.refresh = function () {
    const i = MR.Prog.info();
    const b = $('#lvToggle');
    if (b) {
      $('#lvNum').textContent = String(i.level);
      b.style.setProperty('--p', (i.into / i.need * 100).toFixed(1));
      b.setAttribute('aria-label', 'Profil : niveau ' + i.level + ', ' + fmt(i.into) + ' sur ' + fmt(i.need) + ' XP');
    }
    const d = MR.Prog.daily();
    const g = $('#giftToggle');
    if (g) g.classList.toggle('ready', d.claimable);
    if (isOpen) render();
    if (dailyOpen) renderDaily();
  };

  /* ---------------- notifications ---------------- */
  const queue = [];
  let shown = 0;
  function busy() { return MR.Packs && MR.Packs.isBusy && MR.Packs.isBusy(); }
  // un passage de niveau passe devant les autres notifications
  function pushNote(n) {
    if (n.type === 'level') {
      let i = 0;
      while (i < queue.length && queue[i].type === 'level') i++;
      queue.splice(i, 0, n);
    } else queue.push(n);
    pump();
  }
  function pump() {
    if (busy()) { setTimeout(pump, 700); return; }
    while (queue.length && shown < 3) {
      const n = queue.shift();
      if (n.type === 'level') { levelUp(n); continue; }
      showNote(n);
    }
  }
  function showNote(n) {
    const box = $('#notifs');
    const el = document.createElement('div');
    el.className = 'note n-' + n.type;
    let icon = '★', title = '', sub = '';
    if (n.type === 'ach') { icon = '🏆'; title = 'Succès : ' + n.name; sub = rewardChips(n.xp, n.rewards); }
    else if (n.type === 'quest') { icon = '✔'; title = 'Quête du jour réussie'; sub = esc(n.text) + ' ' + rewardChips(n.xp, { packs: 1 }); }
    else if (n.type === 'info') { icon = n.icon || '✦'; title = n.title; sub = n.sub || ''; }
    el.innerHTML = '<span class="n-ic" aria-hidden="true">' + icon + '</span><div class="n-tx"><b>' + esc(title) + '</b><span>' + sub + '</span></div>';
    el.addEventListener('click', function () { PR.open(n.type === 'ach' ? 'ach' : 'prog'); });
    box.appendChild(el);
    shown++;
    if (n.type === 'ach') MR.Audio.newBadge(); else MR.Audio.questDone();
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); shown--; pump(); }, 400);
    }, 3800);
  }
  // XP gagnée : le badge de niveau pulse et un « +300 XP » s'en échappe
  function xpPop(amount) {
    const b = $('#lvToggle');
    if (!b) return;
    PR.refresh();
    b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
    const f = document.createElement('span');
    f.className = 'xp-float';
    f.textContent = '+' + fmt(amount) + ' XP';
    b.appendChild(f);
    setTimeout(function () { f.remove(); }, 1600);
  }
  // passage de niveau : grande annonce au centre de l'écran
  function levelUp(n) {
    const el = $('#levelUp');
    shown++;
    el.innerHTML = '<div class="lu-card"><span class="lu-kicker">Niveau supérieur</span><span class="lu-num">' + n.level + '</span>' +
      '<span class="lu-sub">Récompenses</span><div class="lu-rw">' + packIcons(n.rewards, true) +
      (n.rewards.storage ? '<span class="chip-xp store">+1 place de réserve (' + MR.Cards.max() + ' max)</span>' : '') + '</div>' +
      '<span class="lu-txt">' + esc(MR.Prog.rewardText(n.rewards)) + '</span>' +
      '<span class="lu-hint">Touchez pour continuer</span></div>';
    el.hidden = false;
    MR.Audio.levelUp();
    burstDom(el.querySelector('.lu-card'), 70);
    let done = false;
    const close = function () {
      if (done) return;
      done = true;
      el.classList.add('out');
      setTimeout(function () { el.hidden = true; el.classList.remove('out'); shown--; pump(); }, 350);
    };
    el.onclick = close;
    setTimeout(close, 4200);
  }
  // confettis en DOM (au-dessus des fenêtres)
  function burstDom(anchor, n) {
    if (!anchor || (MR.Render && MR.Render.reducedMotion)) return;
    const r = anchor.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const layer = $('#confetti');
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
      p.style.left = cx + 'px'; p.style.top = cy + 'px';
      p.style.background = 'hsl(' + Math.round(Math.random() * 360) + ',95%,62%)';
      layer.appendChild(p);
      const anim = p.animate([
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + (Math.cos(a) * d).toFixed(0) + 'px,' + (Math.sin(a) * d + 160).toFixed(0) + 'px) rotate(' + Math.round(MR.rand(-540, 540)) + 'deg)', opacity: 0 }
      ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.15,.7,.3,1)' });
      anim.onfinish = function () { p.remove(); };
    }
  }

  /* ---------------- fenêtre du profil ---------------- */
  PR.open = function (t) {
    if (MR.Packs && MR.Packs.isOpen()) MR.Packs.hide();
    tab = t || tab;
    isOpen = true;
    ov.hidden = false;
    render();
    $('#prClose').focus();
  };
  PR.close = function () {
    isOpen = false;
    ov.hidden = true;
    MR.Account.unwatchBoard();
    boardState = 'idle';
    deleteArmed = false;
    const b = $('#lvToggle');
    if (b) b.focus();
  };
  PR.isOpen = function () { return isOpen || dailyOpen; };

  function header() {
    const i = MR.Prog.info(), acc = MR.Account.get(), me = G.me();
    const next = MR.Prog.rewardsFor(i.level + 1);
    return '<div class="pr-id"><span class="pr-av" style="--c:' + (me ? me.color : '#ff3ea5') + '"></span><div><b>' + (acc ? esc(acc.pseudo) : 'Joueur sans compte') + '</b>' +
      '<span>' + (acc ? 'Compte MagicRace' : 'Crée un compte dans « Classement »') + '</span></div></div>' +
      '<div class="pr-lv"><span class="pr-lvn">Niveau <b>' + i.level + '</b></span><div class="pr-bar"><i style="width:' + (i.into / i.need * 100).toFixed(1) + '%"></i></div>' +
      '<span class="pr-xp">' + fmt(i.into) + ' / ' + fmt(i.need) + ' XP · total ' + fmt(MR.Prog.xp()) + ' XP</span>' +
      '<span class="pr-next">Niveau ' + (i.level + 1) + ' : ' + rewardChips(0, next) + '</span></div>';
  }

  function render() {
    $('#prHead').innerHTML = header();
    ov.querySelectorAll('.pr-tabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.t === tab)); });
    const body = $('#prBody');
    if (tab === 'prog') body.innerHTML = renderProg();
    else if (tab === 'ach') body.innerHTML = renderAch();
    else if (tab === 'stats') body.innerHTML = renderStats();
    else renderBoard(body);
    if (tab !== 'board') { MR.Account.unwatchBoard(); boardState = 'idle'; }
  }

  function renderProg() {
    const qs = MR.Prog.quests(), d = MR.Prog.daily(), lv = MR.Prog.level();
    let h = '<section class="pr-sec"><h3>Quêtes du jour <small>nouvelles quêtes dans <span class="js-mid">' + clock(MR.Prog.msToMidnight()) + '</span></small></h3><div class="quests">';
    qs.forEach(function (q) {
      h += '<div class="quest' + (q.done ? ' done' : '') + '"><div class="q-tx"><b>' + esc(q.text) + '</b>' + (q.sub ? '<span>' + esc(q.sub) + '</span>' : '') +
        '<div class="q-bar"><i style="width:' + (q.prog / q.goal * 100).toFixed(1) + '%"></i></div></div>' +
        '<div class="q-rw">' + (q.done ? '<span class="q-ok">✔ Réussie</span>' : '<span class="q-n">' + q.prog + ' / ' + q.goal + '</span>') + rewardChips(MR.Prog.QUEST_XP, { packs: 1 }) + '</div></div>';
    });
    h += '</div></section>';
    h += '<section class="pr-sec"><h3>Récompense quotidienne</h3><div class="pr-daily"><span>' +
      (d.claimable ? 'Ta récompense du jour ' + (d.idx + 1) + ' t’attend !' : 'Récupérée. Prochaine dans <span class="js-mid">' + clock(d.next) + '</span>') +
      '</span><button class="btn' + (d.claimable ? ' primary' : '') + '" type="button" data-act="daily">' + (d.claimable ? 'Récupérer' : 'Voir le calendrier') + '</button></div></section>';
    h += '<section class="pr-sec"><h3>Prochaines récompenses de niveau</h3><ul class="lv-list">';
    let shownN = 0;
    for (let L = lv + 1; shownN < 7 && L < lv + 120; L++) {
      const r = MR.Prog.rewardsFor(L);
      if (L > lv + 1 && !r.premium && !r.ultra && !r.storage) continue;
      shownN++;
      h += '<li><span class="lv-n">Niveau ' + L + '</span><span class="lv-xp">' + fmt(MR.Prog.xpForLevel(L)) + ' XP</span><span class="lv-rw">' + rewardChips(0, r) + '</span></li>';
    }
    h += '</ul><p class="hint">Chaque niveau donne un paquet ; tous les 5 niveaux, un paquet premium en plus ; au niveau 50 et 100, des paquets ultra. Réserve de paquets : <b>' + MR.Cards.max() + '</b> (+1 aux niveaux 10, 20… 100).</p></section>';
    return h;
  }

  function renderAch() {
    const list = MR.Prog.achievements(), groups = {};
    const done = list.filter(function (a) { return a.done; }).length;
    list.forEach(function (a) { (groups[a.group] = groups[a.group] || []).push(a); });
    let h = '<div class="ach-head"><b>' + done + ' / ' + list.length + '</b> succès débloqués<div class="pr-bar"><i style="width:' + (done / list.length * 100).toFixed(1) + '%"></i></div>' +
      '<p class="hint">Les succès « Finir… » comptent pour ta bille ★ dans une course de 30 billes ou plus.</p></div>';
    Object.keys(groups).forEach(function (g) {
      h += '<section class="pr-sec"><h3>' + esc(g) + '</h3><ul class="ach-list">';
      groups[g].forEach(function (a) {
        const goal = a.goal > 1 ? '<span class="a-n">' + fmt(a.val) + ' / ' + fmt(a.goal) + '</span>' : '';
        h += '<li class="' + (a.done ? 'done' : '') + '"><span class="a-ic" aria-hidden="true">' + (a.done ? '🏆' : '🔒') + '</span><div class="a-tx"><b>' + esc(a.name) + '</b>' +
          (a.done ? '' : '<div class="q-bar"><i style="width:' + (a.val / a.goal * 100).toFixed(1) + '%"></i></div>') + '</div>' + goal +
          '<span class="a-rw">' + rewardChips(a.xp, a.rw) + '</span></li>';
      });
      h += '</ul></section>';
    });
    return h;
  }

  function renderStats() {
    const s = MR.Prog.stats();
    const top = function (map) {
      let best = null;
      Object.keys(map || {}).forEach(function (k) { if (!best || map[k] > map[best]) best = k; });
      return best ? esc(best) + ' <small>(' + map[best] + ')</small>' : '—';
    };
    const tiles = [
      ['Courses', fmt(s.races)], ['Runs terminées', fmt(s.runs || 0)], ['Victoires ★', fmt(s.top1)], ['Top 3 ★', fmt(s.top3)], ['Top 5 ★', fmt(s.top5)],
      ['Paquets ouverts', fmt(s.packs) + ' <small>dont ' + s.premium + ' premium, ' + s.ultra + ' ultra</small>'],
      ['Paquets cachés trouvés', fmt(s.hidden)],
      ['Collection', MR.Cards.distinct() + ' / ' + MR.CARDS.length],
      ['Temps de course', duration(s.time)],
      ['Billes qui ont explosé', fmt(s.explosions) + ' <small>dont la tienne ' + s.elim + ' fois</small>'],
      ['Quêtes réussies', fmt(s.quests)],
      ['Bille préférée', top(s.fav)],
      ['Bille qui gagne le plus', top(s.winners)]
    ];
    let h = '<div class="st-grid">' + tiles.map(function (t) { return '<div class="st-tile"><span>' + t[0] + '</span><b>' + t[1] + '</b></div>'; }).join('') + '</div>';
    h += '<section class="pr-sec"><h3>Ta bille ★ par niveau</h3><div class="st-table" role="table"><div class="st-row st-th" role="row"><span>Niveau</span><span>Courses</span><span>1re</span><span>Top 3</span><span>Top 5</span><span>Meilleur</span></div>';
    MR.LEVELS.forEach(function (L) {
      const b = s.byLevel[L.id] || { races: 0, t1: 0, t3: 0, t5: 0, best: 0, posSum: 0, posN: 0 };
      h += '<div class="st-row" role="row"><span><b>' + L.num + '.</b> ' + esc(L.name) + '</span><span>' + b.races + '</span><span>' + pct(b.t1, b.races) + '</span><span>' + pct(b.t3, b.races) +
        '</span><span>' + pct(b.t5, b.races) + '</span><span>' + (b.best ? MR.formatTime(b.best) : '—') + '</span></div>';
    });
    h += '</div><p class="hint">Probabilité que ta bille ★ finisse 1re, dans le top 3 ou le top 5, d’après tes courses dans chaque niveau.</p></section>';
    return h;
  }

  function renderBoard(body) {
    const acc = MR.Account.get(), st = MR.Account.status;
    let h = '';
    if (!acc) {
      h += '<section class="pr-sec"><h3>Créer ton compte</h3><p>Le compte n’est pas obligatoire, mais il faut en avoir un pour voir le classement des joueurs (trié par XP).</p>';
      if (st === 'offline') h += '<p class="pr-warn">' + offlineText() + '</p>';
      else if (st === 'checking') h += '<p class="hint">Connexion en cours…</p>';
      h += accountForm('Créer mon compte', '');
      if (MR.Account.isFirebase()) {
        h += '<p class="hint">Tu as déjà un compte relié à Google (sur un autre appareil) ?</p>' +
          '<button class="btn google-btn" type="button" data-act="google">' + G_ICON + 'Se connecter avec Google</button><p class="g-msg acc-msg" aria-live="polite"></p>';
      }
      h += '</section>';
      body.innerHTML = h;
      bindForm(body);
      return;
    }
    h += '<section class="pr-sec"><h3>Classement des joueurs <small>par XP</small></h3><div id="boardBox">' + boardHtml() + '</div></section>';
    let gh = '';
    if (MR.Account.isFirebase()) {
      gh = MR.Account.isGoogle()
        ? '<p class="g-ok">✔ Compte relié à Google : tu le retrouves sur PC et téléphone.</p><button class="btn" type="button" data-act="signout">Se déconnecter de cet appareil</button>'
        : '<p class="hint">Relie ton compte à Google pour le retrouver (avec ta progression) sur tous tes appareils.</p><button class="btn google-btn" type="button" data-act="google">' + G_ICON + 'Relier à Google</button>';
      gh += '<p class="g-msg acc-msg" aria-live="polite"></p>';
    }
    h += '<section class="pr-sec"><h3>Mon compte</h3><p>Pseudo : <b>' + esc(acc.pseudo) + '</b></p>' + accountForm('Changer de pseudo', acc.pseudo) + gh +
      '<button class="btn danger" type="button" data-act="delacc">' + (deleteArmed ? 'Confirmer : supprimer mon compte' : 'Supprimer mon compte') + '</button>' +
      '<p class="hint">Supprimer le compte retire ta ligne du classement. Ta progression (niveau, cartes) reste.</p></section>';
    body.innerHTML = h;
    bindForm(body);
    if (boardState === 'idle') {
      boardState = 'loading';
      boardRows = null;
      const timer = setTimeout(function () { if (boardState === 'loading') { boardState = 'slow'; updBoard(); } }, 10000);
      MR.Account.watchBoard(function (rows, cache) {
        boardRows = rows; boardCache = !!cache;
        if (!cache) clearTimeout(timer);
        boardState = 'ok';
        updBoard();
      }, function (code) {
        clearTimeout(timer);
        boardState = code === 'offline' ? 'offline' : 'error';
        updBoard();
      });
    }
  }
  function updBoard() { const b = document.getElementById('boardBox'); if (b) b.innerHTML = boardHtml(); }
  function boardHtml() {
    if (MR.Account.status === 'offline' || boardState === 'offline') return '<p class="pr-warn">' + offlineText() + '</p>';
    if (boardState === 'error' && MR.Account.isFirebase()) return '<p class="pr-warn">Classement injoignable (connexion internet, ou règles Firestore pas encore en place).</p>';
    if (boardState === 'error') return '<p class="pr-warn">Classement injoignable pour le moment.</p>';
    if (!boardRows) return '<p class="hint">' + (boardState === 'slow' ? 'Le classement met du temps à répondre…' : 'Chargement du classement…') + '</p>';
    if (!boardRows.length) return '<p class="hint">Personne pour l’instant : gagne de l’XP pour apparaître ici.</p>';
    let h = '<ol class="lb">';
    boardRows.forEach(function (r, i) {
      h += '<li class="' + (r.me ? 'me' : '') + (i < 3 ? ' p' + (i + 1) : '') + '"><span class="lb-rk">' + (i + 1) + '</span><span class="lb-dot" style="--c:' + r.color + '"></span>' +
        '<span class="lb-nm">' + esc(r.name) + (r.me ? ' <small>(toi)</small>' : '') + '</span><span class="lb-lv">Nv ' + r.level + '</span><span class="lb-xp">' + fmt(r.xp) + ' XP</span></li>';
    });
    h += '</ol>';
    if (boardCache) h += '<p class="hint">Peut-être pas à jour : en attente du serveur…</p>';
    if (MR.Account.status === 'readonly') h += '<p class="pr-warn">Tu peux voir le classement mais pas y apparaître : demande au propriétaire de MagicRace l’accès « Contributeur ».</p>';
    return h;
  }
  const G_ICON = '<svg class="g-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5z"/><path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5z"/><path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z"/><path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3C6.5 7.1 9 5.1 12 5.1z"/></svg>';
  function offlineText() {
    return MR.FB && MR.FB.enabled
      ? 'Le serveur des comptes est injoignable pour le moment (pas de connexion internet ?). Ta progression reste enregistrée sur cet appareil.'
      : 'Ici (fichier ou autre site), il n’y a pas de serveur pour les comptes : ils marchent sur azeleonze.github.io/magicrace et dans la version claude.ai. Ta progression reste enregistrée sur cet appareil.';
  }
  function accountForm(label, val) {
    return '<form class="acc-form" autocomplete="off"><input class="txt" type="text" name="pseudo" maxlength="16" minlength="3" spellcheck="false" placeholder="Ton pseudo (3 à 16 caractères)" value="' + esc(val) + '" aria-label="Pseudo">' +
      '<button class="btn primary" type="submit">' + label + '</button></form><p class="acc-msg" aria-live="polite"></p>';
  }
  function bindForm(root) {
    const f = root.querySelector('.acc-form');
    if (f) f.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msg = root.querySelector('.acc-msg'), btn = f.querySelector('button');
      btn.disabled = true; msg.textContent = 'Enregistrement…';
      const r = await MR.Account.create(f.pseudo.value);
      btn.disabled = false;
      msg.textContent = r.msg;
      msg.classList.toggle('bad', !r.ok);
      if (r.ok) { MR.Audio.questDone(); boardState = 'idle'; setTimeout(render, 700); }
    });
    root.querySelectorAll('[data-act="google"],[data-act="signout"]').forEach(function (b) {
      b.addEventListener('click', async function (e) {
        e.stopPropagation();
        const msg = root.querySelector('.g-msg');
        b.disabled = true;
        if (b.dataset.act === 'signout') {
          await MR.Account.signOut();
          MR.UI.toast('Déconnecté de cet appareil');
          boardState = 'idle'; render();
          return;
        }
        if (msg) { msg.textContent = 'Connexion à Google…'; msg.classList.remove('bad'); }
        const r = await MR.Account.google();
        b.disabled = false;
        if (msg) { msg.textContent = r.msg; msg.classList.toggle('bad', !r.ok); }
        if (r.ok) { MR.Audio.questDone(); boardState = 'idle'; setTimeout(render, 900); }
      });
    });
  }

  /* ---------------- récompense quotidienne ---------------- */
  PR.openDaily = function () {
    dailyOpen = true;
    dov.hidden = false;
    renderDaily();
    const b = $('#dlClaim');
    (b && !b.disabled ? b : $('#dlClose')).focus();
  };
  PR.closeDaily = function () {
    dailyOpen = false;
    dov.hidden = true;
    const g = $('#giftToggle');
    if (g) g.focus();
  };
  function renderDaily() {
    const d = MR.Prog.daily();
    let h = '';
    d.rewards.forEach(function (r, i) {
      const past = i < d.idx, today = i === d.idx && d.claimable, big = i === 6 || i === 13;
      h += '<div class="dl-day' + (past ? ' past' : '') + (today ? ' today' : '') + (big ? ' big' : '') + '" data-i="' + i + '"><span class="dl-n">Jour ' + (i + 1) + '</span>' +
        '<span class="dl-rw">' + packIcons(r) + '</span>' + (past ? '<span class="dl-ok" aria-label="récupérée">✔</span>' : '') + '</div>';
    });
    $('#dlGrid').innerHTML = h;
    let info;
    if (d.claimable) {
      info = d.lost ? 'Série interrompue : on repart du jour 1.' : d.grace ? 'Tu as raté hier, mais tu as jusqu’à midi pour garder ta série !' : 'Jour ' + (d.idx + 1) + ' de ta série : récupère ta récompense !';
    } else info = 'Récompense du jour récupérée. Prochaine dans <b class="js-mid">' + clock(d.next) + '</b>.';
    $('#dlInfo').innerHTML = info;
    $('#dlStreak').textContent = d.streak > 0 ? 'Série : ' + d.streak + ' jour' + (d.streak > 1 ? 's' : '') : '';
    const b = $('#dlClaim');
    b.disabled = !d.claimable;
    b.textContent = d.claimable ? 'Récupérer la récompense' : 'Revenir demain';
  }
  function claimDaily() {
    const tile = document.querySelector('.dl-day.today');
    const got = MR.Prog.claimDaily();
    if (!got) return;
    MR.Audio.unlock();
    MR.Audio.levelUp();
    if (tile) {
      tile.classList.add('claimed');
      burstDom(tile, 60);
      flyToCards(tile);
    }
    setTimeout(function () {
      renderDaily();
      PR.refresh();
      MR.UI.toast('Jour ' + got.day + ' : ' + MR.Prog.rewardText(got.rw) + ' ajouté' + ((got.rw.packs || 0) + (got.rw.premium || 0) + (got.rw.ultra || 0) > 1 ? 's' : '') + ' à tes cartes');
    }, 650);
  }
  // les paquets gagnés filent vers le bouton « Cartes »
  function flyToCards(from) {
    const to = $('#cToggle');
    if (!to || (MR.Render && MR.Render.reducedMotion)) return;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      const p = document.createElement('span');
      p.className = 'mini-pack fly';
      p.innerHTML = '<i></i>';
      p.style.left = (a.left + a.width / 2) + 'px'; p.style.top = (a.top + a.height / 2) + 'px';
      $('#confetti').appendChild(p);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const an = p.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + (dx * 0.4 + MR.rand(-60, 60)).toFixed(0) + 'px), calc(-50% + ' + (dy * 0.4 - 80).toFixed(0) + 'px)) scale(1.3)', opacity: 1, offset: 0.4 },
        { transform: 'translate(calc(-50% + ' + dx.toFixed(0) + 'px), calc(-50% + ' + dy.toFixed(0) + 'px)) scale(.4)', opacity: 0.2 }
      ], { duration: 900 + i * 120, delay: i * 90, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' });
      an.onfinish = function () { p.remove(); to.classList.remove('pulse'); void to.offsetWidth; to.classList.add('pulse'); };
    }
  }

  /* ---------------- mise en place ---------------- */
  let tickT = 0;
  PR.frame = function (dt) {
    tickT -= dt;
    if (tickT > 0) return;
    tickT = 1;
    const d = MR.Prog.daily(), g = $('#giftToggle');
    if (g) g.classList.toggle('ready', d.claimable);
    // comptes à rebours (minuit) dans les fenêtres ouvertes
    if (isOpen || dailyOpen) {
      document.querySelectorAll('.js-mid').forEach(function (el) {
        el.textContent = clock(el.closest('.dl-info') ? d.next : MR.Prog.msToMidnight());
      });
      if (dailyOpen && d.claimable !== !$('#dlClaim').disabled) renderDaily();
    }
  };

  PR.init = function (game) {
    G = game;
    ov = $('#profileOv');
    dov = $('#dailyOv');
    MR.Prog.onNotify(function (n) {
      if (G.simulating) return;
      if (n.type === 'xp') { setTimeout(function () { xpPop(n.amount); }, 120); return; }
      pushNote(n);
    });
    $('#lvToggle').addEventListener('click', function () { PR.open('prog'); });
    $('#giftToggle').addEventListener('click', PR.openDaily);
    $('#prClose').addEventListener('click', PR.close);
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { PR.close(); return; }
      const t = e.target.closest('[data-t]');
      if (t && t.closest('.pr-tabs')) { tab = t.dataset.t; deleteArmed = false; render(); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'daily') { PR.close(); PR.openDaily(); }
      else if (a.dataset.act === 'delacc') {
        if (!deleteArmed) { deleteArmed = true; a.textContent = 'Confirmer : supprimer mon compte'; return; }
        deleteArmed = false;
        MR.Account.remove().then(function () { MR.UI.toast('Compte supprimé'); boardState = 'idle'; render(); });
      }
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); PR.close(); } });
    $('#dlClose').addEventListener('click', PR.closeDaily);
    $('#dlClaim').addEventListener('click', claimDaily);
    dov.addEventListener('click', function (e) { if (e.target === dov) PR.closeDaily(); });
    dov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); PR.closeDaily(); } });
    MR.Account.onChange(function () { if (isOpen && tab === 'board') render(); else if (isOpen) $('#prHead').innerHTML = header(); });
    PR.refresh();
    // récompense du jour disponible : la fenêtre s'ouvre toute seule peu après l'arrivée
    if (MR.Prog.daily().claimable) setTimeout(function () { if (!MR.Packs.isOpen() && !PR.isOpen() && !(MR.Settings && MR.Settings.isOpen())) PR.openDaily(); }, 1600);
  };

  MR.Profile = PR;
})(window.MR);
