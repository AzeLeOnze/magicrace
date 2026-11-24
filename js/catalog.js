/* MagicRace — catalogue : raretés, billes de collection, effets, cartes et options de personnalisation */
(function (MR) {
  'use strict';

  MR.RARITIES = [
    { id: 'common',    rank: 0, name: 'Commune',     plural: 'Communes',     chance: 49,  color: '#cfc8e0' },
    { id: 'uncommon',  rank: 1, name: 'Peu commune', plural: 'Peu communes', chance: 32,  color: '#4ee08a' },
    { id: 'rare',      rank: 2, name: 'Rare',        plural: 'Rares',        chance: 13.5, color: '#3d9bff' },
    { id: 'epic',      rank: 3, name: 'Épique',      plural: 'Épiques',      chance: 3.3, color: '#b65cff' },
    { id: 'legendary', rank: 4, name: 'Légendaire',  plural: 'Légendaires',  chance: 1.2, color: '#ffcf4a' }
  ];
  MR.rarity = function (id) {
    for (let i = 0; i < MR.RARITIES.length; i++) if (MR.RARITIES[i].id === id) return MR.RARITIES[i];
    return MR.RARITIES[0];
  };

  // Apparences de bille. Chacune correspond à un shader de marbleGL.js (même id).
  MR.SKINS = [
    { id: 'solid',      rarity: null,        name: 'Couleur unie' },
    { id: 'photo',      rarity: null,        name: 'Mon image' },
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
    { id: 'perle',      rarity: 'uncommon',  name: 'Perle',            accent: '#f4eee8', blurb: 'Perle fine aux reflets nacrés' },
    { id: 'cafe',       rarity: 'uncommon',  name: 'Latte',            accent: '#8a5a36', blurb: 'Un latte et son cœur de mousse' },
    { id: 'citrouille', rarity: 'uncommon',  name: 'Citrouille',       accent: '#ff8a1f', blurb: 'Côtes orange et petite tige' },
    { id: 'nuage',      rarity: 'uncommon',  name: 'Nuage',            accent: '#8fd0ff', blurb: 'Ciel bleu, nuages qui passent' },
    { id: 'agrume',     rarity: 'uncommon',  name: 'Agrume',           accent: '#ffd23a', blurb: 'Tranche de citron bien juteuse' },
    { id: 'chewing',    rarity: 'uncommon',  name: 'Chewing-gum',      accent: '#ff7ac6', blurb: 'Rose bonbon, prêt à faire une bulle' },
    { id: 'yinyang',    rarity: 'uncommon',  name: 'Yin et Yang',      accent: '#f2efe8', blurb: 'L’équilibre parfait, noir et blanc' },
    { id: 'tennis',     rarity: 'uncommon',  name: 'Balle de tennis',  accent: '#cdf23a', blurb: 'Feutre fluo et couture blanche' },
    { id: 'basket',     rarity: 'uncommon',  name: 'Basket',           accent: '#e8661c', blurb: 'Cuir orange et lignes noires' },
    { id: 'coccinelle', rarity: 'uncommon',  name: 'Coccinelle',       accent: '#e3241b', blurb: 'Rouge à pois, porte-bonheur' },
    { id: 'point',      rarity: 'uncommon',  name: 'Point',            accent: '#f5f5f2', blurb: 'Un point noir sur fond blanc, tout simplement' },
    { id: 'grains',     rarity: 'uncommon',  name: 'Café',             accent: '#6b3e1f', blurb: 'Grains de café bien torréfiés' },
    { id: 'cola',       rarity: 'uncommon',  name: 'Cola',             accent: '#7a2e10', blurb: 'Pétillant, plein de bulles qui remontent' },
    { id: 'orange', rarity: 'uncommon', name: 'Orange', accent: '#ff8a14', blurb: 'Peau d’orange et son nombril' },
    { id: 'kiwi', rarity: 'uncommon', name: 'Kiwi', accent: '#7cc23a', blurb: 'Coupé en deux, pépins en couronne' },
    { id: 'pois', rarity: 'uncommon', name: 'À pois', accent: '#ff6ab0', blurb: 'Des pois de toutes les couleurs' },
    { id: 'mariniere', rarity: 'uncommon', name: 'Marinière', accent: '#1c2f6e', blurb: 'Rayures bleu marine, cap sur la piste' },
    { id: 'jean', rarity: 'uncommon', name: 'Jean', accent: '#3d5f9a', blurb: 'Denim délavé et surpiqûre orange' },
    { id: 'paques', rarity: 'uncommon', name: 'Œuf de Pâques', accent: '#ffb3d9', blurb: 'Bandes pastel en zigzag' },
    { id: 'foot', rarity: 'uncommon', name: 'Ballon de foot', accent: '#f2f2f2', blurb: 'Hexagones blancs, pentagones noirs' },
    { id: 'golf', rarity: 'uncommon', name: 'Balle de golf', accent: '#f4f6fa', blurb: 'Blanche et pleine d’alvéoles' },
    { id: 'billard', rarity: 'uncommon', name: 'Boule de billard', accent: '#111111', blurb: 'La boule noire numéro 8' },
    { id: 'lune', rarity: 'uncommon', name: 'Lune', accent: '#b8b8c0', blurb: 'Cratères et mers de poussière' },
    { id: 'terre', rarity: 'uncommon', name: 'Terre', accent: '#2a7ad8', blurb: 'Océans, continents et nuages qui tournent' },
    { id: 'myrtille', rarity: 'uncommon', name: 'Myrtille', accent: '#3a3a86', blurb: 'Bleu nuit poudré et petite couronne' },
    { id: 'zebre', rarity: 'uncommon', name: 'Zèbre', accent: '#f0eee8', blurb: 'Rayures noires et blanches' },
    { id: 'leopard', rarity: 'uncommon', name: 'Léopard', accent: '#d99a45', blurb: 'Rosettes tachetées' },
    { id: 'pixel', rarity: 'uncommon', name: 'Pixel', accent: '#7a5cff', blurb: 'Des gros pixels qui changent parfois' },
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
    { id: 'dream',      rarity: 'rare',      name: 'Dream',            accent: '#c9a6ff', blurb: 'Pastels de rêve et petites étoiles' },
    { id: 'crystal',    rarity: 'rare',      name: 'Crystal',          accent: '#d8f4ff', blurb: 'Cristal taillé aux reflets prisme' },
    { id: 'emeraude',   rarity: 'rare',      name: 'Émeraude',         accent: '#1fd18a', blurb: 'Gemme verte aux mille facettes' },
    { id: 'neon',       rarity: 'rare',      name: 'Néon',             accent: '#ff4fd8', blurb: 'Tubes de néon dans du verre fumé' },
    { id: 'fourrure',   rarity: 'rare',      name: 'Fourrure',         accent: '#c98a52', blurb: 'Pelage tout doux, poils en bataille' },
    { id: 'donut',      rarity: 'rare',      name: 'Donut',            accent: '#ff73b0', blurb: 'Glaçage rose et vermicelles' },
    { id: 'cookie',     rarity: 'rare',      name: 'Cookie',           accent: '#c98a45', blurb: 'Pépites de chocolat, tout juste sorti du four' },
    { id: 'creepsmile', rarity: 'rare',      name: 'Creep Smile',      accent: '#ffd21a', blurb: 'Un sourire… un peu trop grand' },
    { id: 'star',       rarity: 'rare',      name: 'Star',             accent: '#ffd34a', blurb: 'Une étoile d’or sur un ciel de nuit' },
    { id: 'saturne',    rarity: 'rare',      name: 'Saturne',          accent: '#e3c48c', blurb: 'La planète aux anneaux, en orbite sur la piste' },
    { id: 'oeilchat',   rarity: 'rare',      name: 'Œil de chat',      accent: '#9be33a', blurb: 'Une pupille fendue qui s’ouvre et se referme' },
    { id: 'cassoulet',  rarity: 'rare',      name: 'Cassoulet',        accent: '#b8652a', blurb: 'Haricots, saucisse et croûte dorée' },
    { id: 'cafecreme',  rarity: 'rare',      name: 'Café Crème',       accent: '#c99a6a', blurb: 'Café noir et tourbillon de crème' },
    { id: 'pizza',      rarity: 'rare',      name: 'Pizza',            accent: '#e8a43a', blurb: 'Fromage fondu, pepperoni et basilic' },
    { id: 'dark',       rarity: 'rare',      name: 'Dark',             accent: '#3a2a5a', blurb: 'Obsidienne mate et veines violettes' },
    { id: 'aquarium', rarity: 'rare', name: 'Aquarium', accent: '#2aa8d8', blurb: 'Poissons, algues, sable et bulles' },
    { id: 'arcenciel', rarity: 'rare', name: 'Arc-en-ciel', accent: '#7ac8ff', blurb: 'Un arc-en-ciel au-dessus des nuages' },
    { id: 'mosaique', rarity: 'rare', name: 'Mosaïque', accent: '#2a8ac8', blurb: 'Carreaux de faïence bleus et dorés' },
    { id: 'sushi', rarity: 'rare', name: 'Sushi', accent: '#ff7a4a', blurb: 'Un maki : riz, saumon et avocat' },
    { id: 'cible', rarity: 'rare', name: 'Cible', accent: '#e61e28', blurb: 'En plein dans le mille' },
    { id: 'boussole', rarity: 'rare', name: 'Boussole', accent: '#d9a443', blurb: 'L’aiguille cherche toujours le nord' },
    { id: 'horloge', rarity: 'rare', name: 'Horloge', accent: '#e8d9b0', blurb: 'Les aiguilles tournent pour de vrai' },
    { id: 'circuit', rarity: 'rare', name: 'Circuit', accent: '#22a05a', blurb: 'Circuit imprimé, le courant y circule' },
    { id: 'vitrail', rarity: 'rare', name: 'Vitrail', accent: '#c84ad8', blurb: 'Verre coloré serti de plomb' },
    { id: 'automne', rarity: 'rare', name: 'Automne', accent: '#e8741a', blurb: 'Un tas de feuilles mortes' },
    { id: 'tournesol', rarity: 'rare', name: 'Tournesol', accent: '#ffc81a', blurb: 'Pétales dorés et graines en spirale' },
    { id: 'tigre', rarity: 'rare', name: 'Tigre', accent: '#f2761a', blurb: 'Pelage orange rayé de noir' },
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
    { id: 'hacker',     rarity: 'epic',      name: 'Hacker',           accent: '#33ff77', blurb: 'Pluie de code vert sur écran noir' },
    { id: 'glitch',     rarity: 'epic',      name: 'Glitch',           accent: '#ff3ec8', blurb: 'Image qui bugue et se décale' },
    { id: 'vhs',        rarity: 'epic',      name: 'VHS',              accent: '#ff6a3d', blurb: 'Cassette des années 80, bobines qui tournent et image qui saute' },
    { id: 'neonveines', rarity: 'epic',      name: 'Veines néon',      accent: '#39ffb4', blurb: 'Lumière arc-en-ciel parcourue de veines sombres' },
    { id: 'encrefluo',  rarity: 'epic',      name: 'Encre fluo',       accent: '#ff3ec8', blurb: 'De l’encre noire qui tourbillonne dans le néon' },
    { id: 'ectoplasme', rarity: 'epic',      name: 'Ectoplasme',       accent: '#9dff2e', blurb: 'Matière fluo vivante et cellules sombres' },
    { id: 'oeilloup',   rarity: 'epic',      name: 'Œil de loup',      accent: '#ffb21a', blurb: 'Un regard ambré qui guette la course' },
    { id: 'paillettes', rarity: 'epic',      name: 'Paillettes d’or',  accent: '#ffd34a', blurb: 'Mille paillettes qui scintillent' },
    { id: 'obscur',     rarity: 'epic',      name: 'Obscur',           accent: '#5a2aa8', blurb: 'Une ombre vivante et ses braises violettes' },
    { id: 'meduse', rarity: 'epic', name: 'Méduse', accent: '#ff6ad5', blurb: 'Une méduse lumineuse qui flotte dans le noir' },
    { id: 'hyperespace', rarity: 'epic', name: 'Hyperespace', accent: '#9ab8ff', blurb: 'Les étoiles filent à la vitesse lumière' },
    { id: 'reacteur', rarity: 'epic', name: 'Réacteur', accent: '#3ff0ff', blurb: 'Un cœur d’énergie et ses anneaux' },
    { id: 'hologramme', rarity: 'epic', name: 'Hologramme', accent: '#5ad8ff', blurb: 'Un globe holographique qui grésille' },
    { id: 'feufollet', rarity: 'epic', name: 'Feu follet', accent: '#5affc8', blurb: 'Des flammes fantômes qui dansent' },
    { id: 'geode', rarity: 'epic', name: 'Géode', accent: '#a05aff', blurb: 'Améthyste scintillante dans la roche' },
    { id: 'synthwave', rarity: 'epic', name: 'Synthwave', accent: '#ff4fa8', blurb: 'Soleil rétro et grille néon des années 80' },
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
    { id: 'rypoint',    rarity: 'legendary', name: 'Rypoint',          accent: '#ff7a1a', blurb: 'Le protogen aux yeux d’or' },
    { id: 'ultrasmoke', rarity: 'legendary', name: 'Ultra smoke',      accent: '#b46bff', blurb: 'Fumée vivante aux reflets néon' },
    { id: 'galaxium',   rarity: 'legendary', name: 'Galaxium',         accent: '#9a7bff', blurb: 'Une galaxie spirale noyée de nébuleuses' },
    { id: 'oeildragon', rarity: 'legendary', name: 'Œil de dragon',    accent: '#ff7a1a', blurb: 'Il s’ouvre de temps en temps… et il te regarde' },
    { id: 'tenebres',   rarity: 'legendary', name: 'Ténèbres',         accent: '#9a1a4a', blurb: 'Un abîme sans fond… où quelque chose ouvre les yeux' },
    { id: 'phenix', rarity: 'legendary', name: 'Phénix', accent: '#ff6a1a', blurb: 'L’oiseau de feu déploie ses ailes' },
    { id: 'supernova', rarity: 'legendary', name: 'Supernova', accent: '#c8a8ff', blurb: 'Une étoile qui explose encore et encore' },
    { id: 'chronos', rarity: 'legendary', name: 'Chronos', accent: '#e8b84a', blurb: 'Des engrenages de laiton et le temps qui coule' }
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
    { c: '#e0245e', n: 'Framboise' }, { c: '#93c572', n: 'Pistache' }, { c: '#cc7a22', n: 'Ocre' }, { c: '#6c8cf0', n: 'Bleuet' },
    { c: '#ffaa33', n: 'Mangue' }, { c: '#2a55e0', n: 'Cobalt' }, { c: '#8a1e3f', n: 'Bordeaux' }, { c: '#13b37a', n: 'Jade' },
    { c: '#ff9e7a', n: 'Pêche' }, { c: '#5f7184', n: 'Ardoise' }, { c: '#e5279b', n: 'Fuchsia' }, { c: '#d9b21c', n: 'Moutarde' },
    { c: '#c8143c', n: 'Cerise' }, { c: '#7d8a2a', n: 'Olive' }, { c: '#b8ecff', n: 'Glacier' },
    { c: '#9c5b2e', n: 'Noisette' }, { c: '#4b1f5e', n: 'Aubergine' }, { c: '#1e6b45', n: 'Sapin' }, { c: '#1c2f73', n: 'Marine' },
    { c: '#ffbfdc', n: 'Dragée' }, { c: '#8a8f98', n: 'Gris triste' }, { c: '#33363c', n: 'Gris anthracite' }, { c: '#10194a', n: 'Bleu nuit' },
    { c: '#0f5257', n: 'Pétrole' }, { c: '#fbb36b', n: 'Abricot' }, { c: '#c2593a', n: 'Terracotta' }, { c: '#d8c3a0', n: 'Beige' },
    { c: '#e8a5b8', n: 'Rose poudré' }, { c: '#d4a017', n: 'Or' }, { c: '#c0c4cc', n: 'Argent' }
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
    { id: 'piano', name: 'Piano', rarity: 'rare', blurb: 'Bruit · une note de piano' },
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
  function unlocked(id) { return id === 'solid' || id === 'photo' || owns(id); }
  // image perso d'une bille : petite image JPEG en data URL (64×64, très compressée)
  MR.isMarbleImg = function (v) {
    return typeof v === 'string' && v.length < 16000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
  };
  MR.compressImage = function (file, bg) {
    return new Promise(function (res, rej) {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = function () {
        const S = 64, cv = document.createElement('canvas');
        cv.width = S; cv.height = S;
        const c = cv.getContext('2d');
        c.fillStyle = bg || '#ffffff';
        c.fillRect(0, 0, S, S);
        const k = Math.min(im.naturalWidth, im.naturalHeight);
        c.imageSmoothingQuality = 'high';
        c.drawImage(im, (im.naturalWidth - k) / 2, (im.naturalHeight - k) / 2, k, k, 0, 0, S, S);
        URL.revokeObjectURL(url);
        let out = cv.toDataURL('image/jpeg', 0.62);
        if (!MR.isMarbleImg(out)) out = cv.toDataURL('image/jpeg', 0.4);
        if (MR.isMarbleImg(out)) res(out); else rej(new Error('image'));
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('image')); };
      im.src = url;
    });
  };
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
    if (MR.isMarbleImg(o.img)) m.img = o.img;
    if (m.skin === 'photo' && !m.img) m.skin = 'solid';
    // ce qui n'est pas débloqué redevient libre : la bille garde sa couleur
    if (!unlocked(m.skin)) m.skin = 'solid';
    if (!MR.isEffectUnlocked('trail', m.trail)) m.trail = 'none';
    if (!MR.isEffectUnlocked('sound', m.sound)) m.sound = 'none';
    if (!MR.isEffectUnlocked('outline', m.outline)) m.outline = 'none';
    return m;
  };
})(window.MR);
