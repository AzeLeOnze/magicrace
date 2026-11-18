/* MagicRace — catalogue : raretés, billes de collection, effets, cartes et options de personnalisation */
(function (MR) {
  'use strict';

  MR.RARITIES = [
    { id: 'common',    rank: 0, name: 'Commune',     plural: 'Communes',     chance: 70,  color: '#cfc8e0' },
    { id: 'uncommon',  rank: 1, name: 'Peu commune', plural: 'Peu communes', chance: 20,  color: '#4ee08a' },
    { id: 'rare',      rank: 2, name: 'Rare',        plural: 'Rares',        chance: 8,   color: '#3d9bff' },
    { id: 'epic',      rank: 3, name: 'Épique',      plural: 'Épiques',      chance: 1.5, color: '#b65cff' },
    { id: 'legendary', rank: 4, name: 'Légendaire',  plural: 'Légendaires',  chance: 0.5, color: '#ffcf4a' }
  ];
  MR.rarity = function (id) {
    for (let i = 0; i < MR.RARITIES.length; i++) if (MR.RARITIES[i].id === id) return MR.RARITIES[i];
    return MR.RARITIES[0];
  };

  // Apparences de bille. Chacune correspond à un shader de marbleGL.js (même id).
  MR.SKINS = [
    { id: 'solid',      rarity: null,        name: 'Couleur unie' },
    // peu communes
    { id: 'creme',      rarity: 'uncommon',  name: 'Crème',            accent: '#ffc9d8', blurb: 'Chantilly à la fraise' },
    { id: 'gourmand',   rarity: 'uncommon',  name: 'Gourmand',         accent: '#d08a4a', blurb: 'Chocolat, caramel, vermicelles' },
    { id: 'spatial',    rarity: 'uncommon',  name: 'Spatial',          accent: '#5aa8ff', blurb: 'Une petite planète à rayures' },
    { id: 'vanille',    rarity: 'uncommon',  name: 'Vanille',          accent: '#ffe7a3', blurb: 'Glace vanille aux grains noirs' },
    { id: 'black',      rarity: 'uncommon',  name: 'Black',            accent: '#c9c4dc', blurb: 'Noir laqué, reflets pétrole' },
    { id: 'cdrom',      rarity: 'uncommon',  name: 'CD-ROM',           accent: '#d6dcef', blurb: 'Disque argenté arc-en-ciel' },
    { id: 'osier',      rarity: 'uncommon',  name: 'Osier',            accent: '#c49a5e', blurb: 'Panier tressé à la main' },
    { id: 'flower',     rarity: 'uncommon',  name: 'Flower',           accent: '#ffa6c9', blurb: 'Petites fleurs des champs' },
    { id: 'extra',      rarity: 'uncommon',  name: 'Extra',            accent: '#ffe14d', blurb: 'Points pop art, bande dessinée' },
    { id: 'pasteque',   rarity: 'uncommon',  name: 'Pastèque',         accent: '#4fb83a', blurb: 'Rayures de l’écorce' },
    { id: 'bulle',      rarity: 'uncommon',  name: 'Bulle',            accent: '#c9f2ff', blurb: 'Savon et reflets irisés' },
    { id: 'camo',       rarity: 'uncommon',  name: 'Camo',             accent: '#8b9358', blurb: 'Camouflage kaki' },
    { id: 'granit',     rarity: 'uncommon',  name: 'Granit',           accent: '#b5b0aa', blurb: 'Pierre polie mouchetée' },
    { id: 'epice',      rarity: 'uncommon',  name: 'Épice',            accent: '#d9652b', blurb: 'Paprika, cannelle et poivre' },
    { id: 'magique',    rarity: 'uncommon',  name: 'Magique',          accent: '#a85cff', blurb: 'Poussière d’étoiles qui scintille' },
    { id: 'neige',      rarity: 'uncommon',  name: 'Neige',            accent: '#eaf6ff', blurb: 'Boule de neige, flocons qui brillent' },
    { id: 'roche',      rarity: 'uncommon',  name: 'Roche',            accent: '#8d8a86', blurb: 'Caillou brut, fissures et mousse' },
    { id: 'menthe',     rarity: 'uncommon',  name: 'Menthe',           accent: '#5fe3b0', blurb: 'Bonbon à la menthe tourbillon' },
    { id: 'sable',      rarity: 'uncommon',  name: 'Sable',            accent: '#e8c98f', blurb: 'Dunes de la plage disco' },
    { id: 'lavande',    rarity: 'uncommon',  name: 'Lavande',          accent: '#b49cff', blurb: 'Champ de lavande en fleurs' },
    { id: 'pepite',     rarity: 'uncommon',  name: 'Pépite',           accent: '#ffc63a', blurb: 'Une pépite d’or brut qui brille' },
    // rares
    { id: 'chrome',     rarity: 'rare',      name: 'Chrome',           accent: '#dfe6f2', blurb: 'Miroir poli, néons dans le reflet' },
    { id: 'damier',     rarity: 'rare',      name: 'Damier',           accent: '#f2f2f2', blurb: 'Le drapeau de l’arrivée' },
    { id: 'sucre',      rarity: 'rare',      name: 'Sucre d’orge',     accent: '#ff3b5c', blurb: 'Spirale rouge et blanche' },
    { id: 'glace',      rarity: 'rare',      name: 'Glace',            accent: '#9fe8ff', blurb: 'Glaçon fêlé, givré au bord' },
    { id: 'vinyle',     rarity: 'rare',      name: 'Vinyle',           accent: '#ff4fa0', blurb: 'Un 45 tours qui tourne' },
    { id: 'boise',      rarity: 'rare',      name: 'Boisé',            accent: '#b5763a', blurb: 'Bois verni, cernes et nœuds' },
    { id: 'fraise',     rarity: 'rare',      name: 'Fraise',           accent: '#ff3b4f', blurb: 'Bien mûre, avec ses akènes' },
    { id: 'verre',      rarity: 'rare',      name: 'Verre',            accent: '#bff3ff', blurb: 'Verre soufflé, bulles et reflets' },
    { id: 'ecailles',   rarity: 'rare',      name: 'Écailles',         accent: '#2fd6a0', blurb: 'Écailles de dragon irisées' },
    { id: 'marbre',     rarity: 'rare',      name: 'Marbre',           accent: '#f2eee6', blurb: 'Marbre blanc veiné d’or' },
    { id: 'ambre',      rarity: 'rare',      name: 'Ambre',            accent: '#ffa526', blurb: 'Résine fossile, lumière de miel' },
    { id: 'coquillage', rarity: 'rare',      name: 'Coquillage',       accent: '#ffc2b0', blurb: 'Spirale nacrée de la plage' },
    { id: 'tiedye',     rarity: 'rare',      name: 'Tie-dye',          accent: '#ff6ad5', blurb: 'Tourbillon de teinture hippie' },
    { id: 'cuivre',     rarity: 'rare',      name: 'Cuivre',           accent: '#d9824a', blurb: 'Cuivre poli, patine vert-de-gris' },
    // épiques
    { id: 'lavalamp',   rarity: 'epic',      name: 'Lampe à lave',     accent: '#ff7a3d', blurb: 'La cire qui monte, années 70' },
    { id: 'aurore',     rarity: 'epic',      name: 'Aurore boréale',   accent: '#3dffb0', blurb: 'Rideaux de lumière sur la neige' },
    { id: 'diamant',    rarity: 'epic',      name: 'Diamant',          accent: '#cfe9ff', blurb: 'Taille brillant, feux prismatiques' },
    { id: 'hypnose',    rarity: 'epic',      name: 'Hypnose',          accent: '#ff3ea5', blurb: 'Une spirale sans fin' },
    { id: 'abysses',    rarity: 'epic',      name: 'Abysses',          accent: '#2fd6ff', blurb: 'Rayons, caustiques et plancton' },
    { id: 'chocolat',   rarity: 'epic',      name: 'Chocolat',         accent: '#8a4a22', blurb: 'Noir, lait et blanc qui fondent' },
    { id: 'aqua',       rarity: 'epic',      name: 'Aqua',             accent: '#2fe0e6', blurb: 'Vagues, reflets et bulles' },
    { id: 'deepfire',   rarity: 'epic',      name: 'Deep Fire',        accent: '#ff5a14', blurb: 'Des flammes dans le verre' },
    { id: 'arcade',     rarity: 'epic',      name: 'Arcade',           accent: '#7b5cff', blurb: 'Pixels et écran cathodique' },
    { id: 'trounoir',   rarity: 'epic',      name: 'Trou noir',        accent: '#ffb347', blurb: 'Disque d’accrétion, lumière courbée' },
    { id: 'kaleido',    rarity: 'epic',      name: 'Kaléidoscope',     accent: '#ff6ad5', blurb: 'Huit miroirs qui tournent' },
    { id: 'orage',      rarity: 'epic',      name: 'Orage',            accent: '#9fb3d9', blurb: 'Nuages noirs et éclairs' },
    // légendaires
    { id: 'nebula',     rarity: 'legendary', name: 'Nébuleuse',        accent: '#b46bff', blurb: 'Gaz cosmiques et étoiles' },
    { id: 'magma',      rarity: 'legendary', name: 'Magma',            accent: '#ff6a1f', blurb: 'Croûte basaltique, fissures de lave' },
    { id: 'opal',       rarity: 'legendary', name: 'Opale holo',       accent: '#8ff3ff', blurb: 'Nacre irisée et éclats de feu' },
    { id: 'plasma',     rarity: 'legendary', name: 'Plasma',           accent: '#8c7bff', blurb: 'Orbe électrique, filaments vivants' },
    { id: 'disco',      rarity: 'legendary', name: 'Boule disco',      accent: '#ffe7a3', blurb: 'Facettes miroir de la piste' },
    { id: 'vertue',     rarity: 'legendary', name: 'Vertue',           accent: '#ffe9b0', blurb: 'Nacre, filigrane d’or et lumière' },
    { id: 'iridextra',  rarity: 'legendary', name: 'Iridescent extra', accent: '#c6a8ff', blurb: 'Film irisé, hologramme vivant' },
    { id: 'deepaqua',   rarity: 'legendary', name: 'Deep Aqua',        accent: '#16b6ff', blurb: 'Tourbillon des grands fonds' },
    { id: 'electrique', rarity: 'legendary', name: 'Électrique',       accent: '#ffe14d', blurb: 'Réseau d’éclairs qui crépite' },
    { id: 'sunshine',   rarity: 'legendary', name: 'Sunshine',         accent: '#ffb020', blurb: 'Un petit soleil, éruptions comprises' },
    { id: 'aze',        rarity: 'legendary', name: 'Aze',              accent: '#3ff0ff', blurb: 'Cyan, magenta, jaune : la signature' },
    { id: 'rypoint',    rarity: 'legendary', name: 'Rypoint',          accent: '#ff7a1a', blurb: 'Le protogen aux yeux d’or' }
  ];
  MR.COLLECTIBLE_SKINS = MR.SKINS.filter(function (s) { return !!s.rarity; });
  MR.skin = function (id) {
    for (let i = 0; i < MR.SKINS.length; i++) if (MR.SKINS[i].id === id) return MR.SKINS[i];
    return MR.SKINS[0];
  };

  // 12 couleurs de base (toujours libres) + 8 couleurs à gagner en cartes communes
  MR.COLORS = ['#ff3ea5', '#ff5a4e', '#ff9f2e', '#ffe14d', '#a6ff4d', '#2fe6a3',
               '#3ff0ff', '#3d8bff', '#7a5cff', '#c45cff', '#f3f0fa', '#3a3550'];
  const COLOR_NAMES = ['Rose disco', 'Corail', 'Mandarine', 'Citron', 'Pomme', 'Menthe',
                       'Lagon', 'Saphir', 'Indigo', 'Lilas', 'Nacre', 'Onyx'];
  MR.EXTRA_COLORS = [
    { c: '#e34234', n: 'Vermillon' }, { c: '#ff8c69', n: 'Saumon' }, { c: '#a39b5a', n: 'Kaki' },
    { c: '#f3e5c0', n: 'Crémeux' }, { c: '#c9a86a', n: 'Soja' }, { c: '#22d3c5', n: 'Turquoise' },
    { c: '#8e3b73', n: 'Prune' }, { c: '#8ecbff', n: 'Ciel' },
    { c: '#e0245e', n: 'Framboise' }, { c: '#93c572', n: 'Pistache' }, { c: '#cc7a22', n: 'Ocre' }, { c: '#6c8cf0', n: 'Bleuet' }
  ];

  // Effets : « aucun » est toujours libre, le reste se gagne en cartes (rareté indiquée)
  MR.TRAILS = [
    { id: 'none', name: 'Aucune' },
    { id: 'ribbon', name: 'Ruban', rarity: 'common', blurb: 'Traînée · ruban de lumière' },
    { id: 'comet', name: 'Comète', rarity: 'uncommon', blurb: 'Traînée · queue de comète' },
    { id: 'smoke', name: 'Fumée', rarity: 'uncommon', blurb: 'Traînée · volutes de fumée' },
    { id: 'sparks', name: 'Étincelles', rarity: 'rare', blurb: 'Traînée · gerbe d’étincelles' },
    { id: 'pixels', name: 'Pixels', rarity: 'rare', blurb: 'Traînée · pixels rétro' },
    { id: 'piano', name: 'Piano', rarity: 'rare', blurb: 'Traînée · touches de piano et notes' },
    { id: 'rainbow', name: 'Arc-en-ciel', rarity: 'epic', blurb: 'Traînée · arc-en-ciel' },
    { id: 'glitter', name: 'Paillettes', rarity: 'epic', blurb: 'Traînée · pluie de paillettes' }
  ];
  MR.SOUNDS = [
    { id: 'none', name: 'Muet' },
    { id: 'glass', name: 'Verre', rarity: 'common', blurb: 'Bruit · tintement de verre' },
    { id: 'wood', name: 'Bois', rarity: 'common', blurb: 'Bruit · petit bloc de bois' },
    { id: 'clap', name: 'Clap', rarity: 'common', blurb: 'Bruit · clap de disco' },
    { id: 'bell', name: 'Clochette', rarity: 'uncommon', blurb: 'Bruit · clochette musicale' },
    { id: 'chip', name: '8-bit', rarity: 'uncommon', blurb: 'Bruit · blip de console' },
    { id: 'boing', name: 'Boing', rarity: 'rare', blurb: 'Bruit · ressort qui rebondit' },
    { id: 'laser', name: 'Laser', rarity: 'rare', blurb: 'Bruit · tir laser' },
    { id: 'cowbell', name: 'Cowbell', rarity: 'epic', blurb: 'Bruit · cloche à vache' }
  ];
  MR.OUTLINES = [
    { id: 'none', name: 'Aucun' },
    { id: 'neon', name: 'Néon', rarity: 'common', blurb: 'Contour · néon fin' },
    { id: 'dashed', name: 'Pointillés', rarity: 'uncommon', blurb: 'Contour · pointillés qui tournent' },
    { id: 'pulse', name: 'Pulsation', rarity: 'uncommon', blurb: 'Contour · bat en rythme' },
    { id: 'gold', name: 'Or', rarity: 'rare', blurb: 'Contour · anneau d’or' },
    { id: 'electric', name: 'Électrique', rarity: 'rare', blurb: 'Contour · arc électrique' },
    { id: 'aura', name: 'Aura', rarity: 'epic', blurb: 'Contour · halo lumineux' },
    { id: 'rainbow', name: 'Arc-en-ciel', rarity: 'epic', blurb: 'Contour · anneau arc-en-ciel' }
  ];
  MR.labelOf = function (list, id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return '';
  };
  const FX_KIND = { trail: { list: MR.TRAILS, pre: 'tr-', field: 'trail' }, sound: { list: MR.SOUNDS, pre: 'so-', field: 'sound' }, outline: { list: MR.OUTLINES, pre: 'ou-', field: 'outline' } };
  MR.FX_KIND = FX_KIND;

  // Toutes les cartes
  MR.CARDS = [];
  MR.COLORS.forEach(function (c, i) {
    MR.CARDS.push({ id: 'col-' + c.slice(1), kind: 'color', name: COLOR_NAMES[i], rarity: 'common', skin: 'solid', color: c, blurb: 'Bille de verre, œil-de-chat' });
  });
  MR.EXTRA_COLORS.forEach(function (o) {
    MR.CARDS.push({ id: 'col-' + o.c.slice(1), kind: 'color', name: o.n, rarity: 'common', skin: 'solid', color: o.c, blurb: 'Nouvelle couleur de bille' });
  });
  MR.COLLECTIBLE_SKINS.forEach(function (s) {
    MR.CARDS.push({ id: s.id, kind: 'skin', name: s.name, rarity: s.rarity, skin: s.id, color: s.accent, blurb: s.blurb });
  });
  Object.keys(FX_KIND).forEach(function (k) {
    FX_KIND[k].list.forEach(function (e) {
      if (!e.rarity) return;
      MR.CARDS.push({ id: FX_KIND[k].pre + e.id, kind: k, effect: e.id, name: e.name, rarity: e.rarity, skin: 'solid', color: MR.rarity(e.rarity).color, blurb: e.blurb });
    });
  });
  const KIND_ORDER = { skin: 0, color: 1, trail: 2, sound: 3, outline: 4 };
  MR.CARDS.forEach(function (c, i) { c._o = KIND_ORDER[c.kind] * 1000 + i; });
  MR.card = function (id) {
    for (let i = 0; i < MR.CARDS.length; i++) if (MR.CARDS[i].id === id) return MR.CARDS[i];
    return null;
  };
  MR.KIND_LABEL = { color: 'Couleur', skin: 'Bille', trail: 'Traînée', sound: 'Bruit', outline: 'Contour' };

  MR.NAMES = ['Bouboule', 'Paillette', 'Disco Dan', 'Groovy', 'Comète', 'Funky', 'Saphir', 'Rubis',
    'Boogie', 'Nova', 'Mambo', 'Éclair', 'Velours', 'Cerise', 'Prisme', 'Tango', 'Pépite', 'Zigzag',
    'Turbo', 'Glitter', 'Soul Sister', 'Bebop', 'Moonwalk', 'Cosmo', 'Jive', 'Lambada',
    'Mirage', 'Strass', 'Vortex', 'Bijou', 'Fuzz', 'Sirocco', 'Galaxie', 'Volt', 'Rumba', 'Cha-Cha',
    'Satin', 'Paprika', 'Roller', 'Hula', 'Minuit', 'Fièvre', 'Lamé', 'Spirale', 'Kaléido', 'Opaline',
    'Rocket', 'Tornade', 'Mojo', 'Zébulon', 'Pastille', 'Gloss', 'Bongo', 'Swing', 'Twist', 'Fusée',
    'Caramel', 'Météore', 'Big Funk', 'Lady Boule', 'Groove Box'];

  MR.uniqueName = function (taken, prefer) {
    const set = new Set((taken || []).map(function (n) { return String(n).toLowerCase(); }));
    if (prefer && !set.has(String(prefer).toLowerCase())) return prefer;
    const pool = MR.shuffle(MR.NAMES.slice());
    for (let i = 0; i < pool.length; i++) if (!set.has(pool[i].toLowerCase())) return pool[i];
    const base = prefer || MR.pick(MR.NAMES);
    let k = 2;
    while (set.has((base + ' ' + k).toLowerCase())) k++;
    return base + ' ' + k;
  };

  function has(list, id) { return list.some(function (x) { return x.id === id; }); }
  function owns(id) { return MR.Cards ? MR.Cards.owns(id) : false; }
  function unlocked(id) { return id === 'solid' || owns(id); }
  MR.isSkinUnlocked = unlocked;
  MR.isEffectUnlocked = function (kind, id) { return id === 'none' || owns(FX_KIND[kind].pre + id); };
  // couleurs proposées dans l'éditeur : les 12 de base + celles gagnées en cartes
  MR.availableColors = function () {
    return MR.COLORS.concat(MR.EXTRA_COLORS.filter(function (o) { return owns('col-' + o.c.slice(1)); }).map(function (o) { return o.c; }));
  };
  function ownedEffects(kind) {
    return FX_KIND[kind].list.filter(function (e) { return e.id !== 'none' && MR.isEffectUnlocked(kind, e.id); }).map(function (e) { return e.id; });
  }
  function pickEffect(kind, pNone) {
    const o = ownedEffects(kind);
    return o.length && Math.random() >= pNone ? MR.pick(o) : 'none';
  }

  // apparence au hasard, uniquement parmi ce qui est débloqué
  MR.randomLook = function () {
    const owned = MR.COLLECTIBLE_SKINS.filter(function (s) { return unlocked(s.id); });
    const useSkin = owned.length && Math.random() < 0.35;
    const skin = useSkin ? MR.pick(owned) : MR.SKINS[0];
    const cols = MR.availableColors();
    const color = useSkin ? skin.accent : MR.pick(cols.filter(function (c) { return c !== '#3a3550' && c !== '#f3f0fa'; }));
    return {
      skin: skin.id,
      color: color,
      trail: pickEffect('trail', 0.15),
      sound: pickEffect('sound', 0.1),
      outline: pickEffect('outline', 0.45),
      outlineColor: MR.pick(['#ffffff', '#3ff0ff', '#ff3ea5', '#ffcf4a', color]),
      seed: Math.random()
    };
  };

  // bille neutre : une couleur au hasard, sans motif ni effet (0.2.0)
  MR.plainLook = function () {
    const cols = MR.availableColors().filter(function (c) { return c !== '#3a3550' && c !== '#f3f0fa'; });
    const color = MR.pick(cols);
    return { skin: 'solid', color: color, trail: 'none', sound: 'none', outline: 'none', outlineColor: '#ffffff', seed: Math.random() };
  };

  MR.randomMarble = function (taken) {
    const look = MR.plainLook();
    look.id = MR.uid();
    look.name = MR.uniqueName(taken);
    return look;
  };

  // bille prête à courir à partir d'une carte de la collection (neutre, sauf ce que donne la carte)
  MR.marbleFromCard = function (card, taken) {
    const look = MR.plainLook();
    if (card.kind === 'color' || card.kind === 'skin') { look.skin = card.skin; look.color = card.color; }
    else look[FX_KIND[card.kind].field] = card.effect;
    look.id = MR.uid();
    look.name = MR.uniqueName(taken, card.name);
    return look;
  };

  MR.firstMarble = function () {
    return { id: MR.uid(), name: 'Bouboule', skin: 'solid', color: '#ff3ea5', trail: 'none',
      sound: 'none', outline: 'none', outlineColor: '#3ff0ff', seed: 0.37, me: true };
  };

  // copie d'une bille : même apparence, nouvel identifiant, nom numéroté (« Bouboule 2 »)
  MR.duplicateMarble = function (src, taken) {
    const set = new Set((taken || []).map(function (n) { return String(n).toLowerCase(); }));
    const base = String(src.name).replace(/\s+\d+$/, '').slice(0, 15);
    let k = 2;
    while (set.has((base + ' ' + k).toLowerCase())) k++;
    const c = Object.assign({}, src);
    c.id = MR.uid();
    c.name = (base + ' ' + k).slice(0, 18);
    c.me = false;
    return c;
  };

  MR.normalizeMarble = function (o) {
    if (!o || typeof o !== 'object') return null;
    const d = MR.randomMarble([]);
    const m = {
      id: typeof o.id === 'string' && o.id ? o.id : d.id,
      name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 18) : d.name,
      skin: has(MR.SKINS, o.skin) ? o.skin : 'solid',
      color: MR.isHex(o.color) ? o.color : d.color,
      trail: has(MR.TRAILS, o.trail) ? o.trail : d.trail,
      sound: has(MR.SOUNDS, o.sound) ? o.sound : d.sound,
      outline: has(MR.OUTLINES, o.outline) ? o.outline : 'none',
      outlineColor: MR.isHex(o.outlineColor) ? o.outlineColor : '#ffffff',
      seed: typeof o.seed === 'number' && isFinite(o.seed) ? o.seed : d.seed,
      me: o.me === true
    };
    // ce qui n'est pas débloqué redevient libre : la bille garde sa couleur
    if (!unlocked(m.skin)) m.skin = 'solid';
    if (!MR.isEffectUnlocked('trail', m.trail)) m.trail = 'none';
    if (!MR.isEffectUnlocked('sound', m.sound)) m.sound = 'none';
    if (!MR.isEffectUnlocked('outline', m.outline)) m.outline = 'none';
    return m;
  };
})(window.MR);
