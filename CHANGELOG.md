# MagicRace — journal des versions

## 0.1.0 — 18 novembre 2026
La version PC et téléphone.

- MagicRace est en ligne : https://azeleonze.github.io/magicrace/ (code sur GitHub). Le site s'installe comme une application sur PC, Android et iPhone, et marche hors ligne. Nouvelle icône boule à facettes.
- Format téléphone : boutons plus grands sous le doigt, classement et barre du haut qui ne se chevauchent plus, fenêtres qui défilent sur petit écran, encoches de l'écran respectées, pas de zoom accidentel.
- Nouveau niveau 3 « Plage Disco » : un parcours environ 2,5 fois plus long que le niveau 1, sur une plage de nuit (lune, mer qui scintille au rythme de la musique, palmiers, guirlandes). Étapes : Promenade, Vagues, Bar de plage (sas), Toboggan à 4 virages, Dance floor (pistons et plateau tournant), Cocotiers (bumpers), La Jetée, Concert (sas), Feu d'artifice (picots et bumpers), puis l'arrivée.
- Menu Paramètres (bouton ⚙ ou touche S) : qualité d'image, bloom, halo des billes, particules, lumières du fond, bords assombris, images par seconde ; cadrage, zoom et douceur de la caméra, suivre ta bille ★ ; vitesse, compte à rebours, noms (lesquels, taille), classement à l'écran ; musique, bruitages, volumes, petits chocs ; ouverture rapide des cartes, secousses et flashs. Remise à zéro des réglages en deux clics. Section Application : installer le jeu, lien vers le site.
- Nouvelle bille légendaire « Rypoint », inspirée d'un protogen : fourrure orange flammée, oreilles à pointes jaunes, visière noire brillante avec yeux LED dorés qui clignent et bouche « :3 », casque bleu aux écouteurs cyan. 84 cartes au total.
- Corrigé : sur téléphone, les fenêtres des paramètres et des résultats pouvaient dépasser de l'écran.

## 0.0.4 — 18 novembre 2026
- Niveau 1 « Descente Disco » refait d'après le schéma : enclos et picots conservés, entonnoir, diamant disco doré (rayons qui tournent, facettes qui scintillent), grand V avec pistons d'égaliseur, chicane, entonnoir final et piste lumineuse conservés.
- Nouveau niveau 2 « La Grande Roue » : rampes accélérées avec demi-tours, couloir, grande roue à 4 rayons qui tourne, ascenseur à chevrons, chambre à picots avec 3 bumpers, arrivée.
- Le classement suit le vrai parcours sur le niveau 2.
- 21 nouvelles billes : 6 légendaires (Vertue, Iridescent extra, Deep Aqua, Électrique, Sunshine, Aze), 7 épiques (Chocolat, Aqua, Deep Fire, Arcade, Trou noir, Kaléidoscope, Orage), 8 peu communes (CD-ROM, Osier, Flower, Extra, Pastèque, Bulle, Camo, Granit), 8 couleurs communes (Vermillon, Saumon, Kaki, Crémeux, Soja, Turquoise, Prune, Ciel).
- Traînées, bruits et contours sont maintenant des cartes à gagner, chacun avec sa rareté (seuls « Aucun » et « Muet » restent libres). Leurs cartes montrent l'effet en animation. 83 cartes au total.
- Les couleurs gagnées s'ajoutent à la palette de l'éditeur.
- Corrigé : le bas des cartes était coupé et la bille chevauchait le nom.
- Corrigé : au survol du paquet, les bandes dorées ne suivaient pas l'agrandissement.
- Corrigé : le paquet premium redevenait un paquet normal pendant son ouverture.
- Corrigé : la collection affichait « 7 % » au lieu de 70 % pour les communes.

## 0.0.3 — 18 novembre 2026
- Hors course (avant le départ et après l'arrivée), chaque bille s'attrape au curseur et se lance. Une bille déplacée avant le départ revient dans l'enclos au lancement.
- Halo des billes réduit (moins de bloom).
- Dupliquer une bille : bouton dans la liste et dans l'éditeur.
- Les couloirs bleus des moulins sont remplacés par deux sas qui regroupent les billes : « FILE D'ATTENTE » (entonnoir fermé par une porte coulissante qui s'ouvre toutes les 5 s) puis « CARRÉ VIP » (même principe contre le mur gauche). La tête de course attend que le peloton la rattrape, puis tout le monde repart ensemble.
- La section TURBO devient le « DANCE FLOOR » : pistons d'égaliseur qui montent et descendent en vague, entonnoir disco, plateau boule à facettes qui tourne dans un sens puis dans l'autre, deux bumpers.
- Ta bille (★, choisie avec l'étoile dans la liste) : avec au moins 30 billes en course, 1re place = 1 paquet premium, 2e = 2 paquets, 3e = 1 paquet. Elle est mise en avant dans le classement et sur la piste.
- Paquet premium : 5 cartes rare (80 %), épique (15 %) ou légendaire (5 %), en noir et or. Les paquets gagnés peuvent dépasser la réserve de 10.
- Cartes : la description ne déborde plus en bas de la carte.

## 0.0.2 — 18 novembre 2026
Les cartes à jouer.

- Paquets de cartes : 1 paquet toutes les 10 minutes, jusqu'à 10 en réserve, 1 paquet offert au départ. Chaque paquet contient 5 cartes billes.
- Raretés par carte : Commune 70 %, Peu commune 20 %, Rare 8 %, Épique 1,5 %, Légendaire 0,5 %.
- 32 cartes : 12 communes (billes de couleur), 5 peu communes (Crème, Gourmand, Spatial, Vanille, Black), 5 rares (Chrome, Damier, Sucre d'orge, Glace, Vinyle), 5 épiques (Lampe à lave, Aurore boréale, Diamant, Hypnose, Abysses), 5 légendaires (Nébuleuse, Magma, Opale holo, Plasma, Boule disco).
- Toutes les billes de collection sont à débloquer ; les couleurs et la couleur perso restent libres. Les billes déjà créées avec un shader verrouillé gardent leur couleur.
- Ouverture animée : paquet qui se charge et se déchire, cartes distribuées face cachée, retournement par rareté, cinématiques épique (éclairs) et légendaire (fissures de lumière, battements de cœur, explosion dorée, confettis).
- Collection avec silhouettes, compteurs, chances par carte, fiche agrandie avec reflet holographique et bouton « Ajouter à la course ».
- Sauvegarde des cartes et des billes dans le compte claude.ai quand le jeu tourne dans claude.ai.
- Adresse se terminant par `#demo` : bouton « Paquet démo » (une carte de chaque rareté, sans gain).

## 0.0.1 — 18 novembre 2026
Première version.

- Course de billes 2D plein écran, piste entièrement fermée par des murs.
- Niveau 1 « Descente Disco » : enclos à trappes, champ de picots, 5 rampes en zigzag (bosse, deux moulins, bumper, boosters TURBO), entonnoir, piste d'arrivée lumineuse en bloom.
- Panneau de contrôle repliable : lancer / pause / départ, vitesse, caméra (leader, peloton, tout le niveau), noms affichés, son.
- Nombre de billes réglable (1 à 60), bouton « Ajouter une bille », renommage direct dans la liste.
- Personnalisation de chaque bille : nom, 12 couleurs + couleur perso, 5 shaders (Nébuleuse, Magma, Opale holo, Plasma, Boule disco), 8 traînées, 9 bruits d'impact, 8 effets de contour avec couleur.
- Musique « Velvet Mirrorball » : dark disco en ré mineur, 116 BPM, swing, synthétisée en direct.
- Classement en direct, suivi d'une bille au clic, podium et classement final.
