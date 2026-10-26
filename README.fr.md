# GabberKey

**Un studio de musique complet dans le navigateur, né pour le hardcore / gabber, joué avec un Akai APC Key 25.**

*Par Guillaume Monet* · [English version](README.md) · <sub>[☕ Soutenir le projet](https://paypal.me/holythunderblade)</sub>

![GabberKey : bibliothèque de sons, timeline avec le morceau de démo, et la fenêtre des pads](docs/screenshots/overview-fr.png)

GabberKey s'organise autour d'une **timeline** : on glisse des sons d'une bibliothèque rangée par catégorie sur des pistes, les blocs se calent à la mesure et tout joue au même tempo. Les autres outils (pads du sampler, TR-909, synthé, table de mixage, effets…) sont des **plugins** qui s'ouvrent dans des fenêtres, et l'Akai APC Key 25 (mk1 ou mk2) les joue en direct. Rien à installer à part un navigateur :

- **Timeline** : 16 pistes au départ (jusqu'à 64), chacune avec ses potentiomètres (volume, pano, filtres, envois) ; glisser, allonger (les boucles se répètent), copier et déplacer des blocs ; jouez les pads ou le clavier pendant l'enregistrement et chaque coup devient un bloc, en direct, et les notes du synthé un bloc de notes ; retouchez les notes dans un **piano roll** ; la TR-909 s'enregistre en audio ; sélectionnez plusieurs blocs et copiez / collez-les.
- **Geler une piste / rendre en audio** : une piste lourde est rendue une fois puis jouée en audio (lecture plus légère), son volume, son pano, ses envois et son bus restant réglables ; ou elle devient un bloc audio sur une nouvelle piste.
- **Bibliothèque de sons** : 838 sons rangés en Kicks, Batterie, Basses, Leads, Stabs / claviers, Nappes / cordes, Voix, Effets et Guitares, à commencer par les nouvelles banques **Anthem** (200 sons faits pour construire un hymne hardcore, anciennes banques archivées) et la banque **Early hardcore** (40 sons dans le style des soirées de Rotterdam du milieu des années 90 : kicks 909 distordus à longue queue qui gronde, claps énormes réverbérés, hoovers, stabs mentasm, sirènes, beats de 170 à 200 BPM), plus vos propres sons et vos enregistrements ; un clic pour écouter, glisser pour poser.
  - neuf **banques hardcore / gabber / hardstyle synthétisées** (sans doublons), dont deux banques de **80 mélodies** : kicks Rotterdam et terror distordus, hoovers, stabs rave, screeches, basses hardcore, cordes dramatiques, pianos rave oldschool, breakbeats, kicks et leads mainstream sombres, kicks uptempo modernes à queue brute, supersaws, cris, effets et boucles à 190 BPM ;
  - cinq banques d'échantillons **libres de droits (CC0)**.
- **Plugins** dans des fenêtres déplaçables et aimantées :
  - **Sampler 40 pads** avec 25 banques (les sons d'une banque se chargent quand vous l'affichez : démarrage rapide), des LEDs synchronisées avec l'écran, et le glisser-déposer de vos propres sons ;
  - **Émulation TR-909** : les 11 instruments synthétisés en direct, **distorsion par instrument (drive + 5 formes)**, séquenceur 16 pas et 8 patterns ;
  - **Émulation TR-808** : ses 13 instruments (grosse caisse à longue tenue, cloche, claves, maracas…), avec le même séquenceur, les mêmes kits et la même distorsion que la 909 ;
  - **Séquenceur pas à pas** : n'importe quel son de pad sur 16 à 64 pas, 8 patterns, posé sur la timeline en blocs de pads ou enregistré en jouant ;
  - **Découpeur de breaks** : un break coupé sur ses coups (ou en parts égales), un pad par tranche et le motif d'origine dans le séquenceur pas à pas, pour le jouer à n'importe quel tempo sans changer de hauteur ;
  - **Piano roll** : éditez les notes des blocs du synthé (hauteur, durée, vélocité, copier / coller, quantification, saisie pas à pas au clavier de l'APC) ;
  - **Designer de kick** : fabriquez votre propre kick distordu avec 12 potentiomètres et 12 presets, ou en mode expert couche par couche (clic, corps, queue avec deboom), accordez sa queue sur la tonalité du morceau, faites-lui jouer une mélodie de kick dans le piano roll, puis envoyez-le sur un pad ou dans la bibliothèque ;
  - **Designer d'effet** : dessinez la courbe d'un effet (volume, filtres, panoramique, saturation, envois) sur 1, 2 ou 4 temps et posez-la sur n'importe quelle piste ;
  - **Générateur** : accords et mélodie d'hymne à partir d'une suite d'accords, avec des suggestions qui apprennent votre goût ;
  - **Breizh generator** : des airs à la manière des sonneurs bretons (an dro, gavotte, marche, gwerz) joués par la bombarde, le biniou, la cornemuse, un couple de sonneurs ou un bagad, avec notes d'agrément et bourdons ;
  - **Correction de justesse** : la voix d'une prise recalée sur une tonalité (celle du Générateur) ou sur la mélodie d'un lead, de l'effet robotique à la correction naturelle (vitesse, humanisation, formants, mélange), consonnes et souffles intacts ;
  - **Designer de montée** : la montée avant un drop en un clic : riser de bruit, uplifter, roulement de caisse claire qui se resserre, roulement de kick, sub drop et impact, filtre qui monte et silence avant le drop ;
  - **Générateur de voix** : tapez un texte, une voix neuronale le chante, le scande ou le dit en robot sur les notes d'un lead ou d'une nappe, avec plusieurs voix (françaises et anglaises), chœur et harmonie ;
  - **Platines** : deux decks avec disques à scratcher (en avant et en arrière), sync, cue, égaliseur, filtre DJ et crossfader ;
  - **Basse acid façon TB-303** : séquenceur 16 pas avec accent et slide, filtre résonant à enveloppe, distorsion, saisie au clavier de l'APC, calée sur la 909 ;
  - **Synthé à oscillateurs** : 3 oscillateurs avec unisson, FM, modulation en anneau, bruit, filtre 12 / 24 dB, 2 enveloppes, LFO calé sur le tempo, poly / mono / legato, 15 presets et les vôtres ;
  - **Synthé en couches** au clavier : 46 presets en 11 familles (cordes, nappes, chœurs, supersaw, hoovers, leads, basses, stabs, claviers, Breizh, effets) avec ensemble, largeur stéréo, vibrato et 8 potentiomètres d'expression, mode accords et arpégiateur calé sur le tempo ;
  - **Table de mixage** : une voie par outil avec panoramique, envois delay et reverb, muet / solo, vumètres, jusqu'à 4 effets d'insert, un **sidechain** déclenché par les kicks, **4 bus** pour traiter des pistes ensemble, et une **chaîne master** (graves en mono et largeur stéréo, compresseur, compression multibande façon OTT, écrêteur, limiteur, sonie en LUFS, corrélation de phase) ; chaque piste de la timeline a aussi son solo et ses effets d'insert ;
  - **Câblage** : reliez librement les outils et des **boîtes à effets** (distorsion, PCF, filtre, delay, reverb, compresseur, bitcrusher), tout calé sur le tempo ;
  - **Visualiseur** dans l'esprit Winamp : 21 modes (spectre à LED, oscilloscope, tourbillons Milk, vumètres hi-fi, texte qui cogne, particules, barres Amiga, spectrogramme, et modes 3D / GPU : tunnel, paysage synthwave, blob, hyperespace, fractale, lasers, ville de spectre, mur de LED, metaballs, plasma, rotozoomer, fluide, réaction-diffusion), filtres empilables (CRT, kaléidoscope, glitch, stroboscope), et une fenêtre projecteur pour un deuxième écran ;
  - **Effets de performance** (rolls, balayages de filtre, tape-stop, pump), **égaliseur général**, **scènes** rappelées à la mesure suivante, **lanceur de clips** (aussi sur les 40 pads de l'APC), **horloge MIDI**, **MIDI learn** pour tout autre clavier ou contrôleur MIDI, avec un moniteur MIDI.
- **Enregistrer et ouvrir** tout le projet, le morceau ou les réglages de chaque outil (fichiers `.gabber`), **export WAV rapide et stems**, **enregistrement WAV** de votre session et **export / import de kits**.
- Interface en **français ou en anglais**, selon la langue du navigateur.

> 🚧 **GabberKey est en constante évolution.** De nouvelles fonctions arrivent régulièrement, et plein d'autres sont en route : le MIDI learn pour d'autres contrôleurs, une version en ligne… et bien plus encore. Mettez une étoile ou suivez le dépôt pour voir ce qui arrive (voir la [feuille de route](#feuille-de-route)) !

---

## Captures d'écran

| | |
|---|---|
| **Pads du sampler et éditeur de pad**<br>[![Les 40 pads de la banque Anthem drums et l'éditeur de pad](docs/screenshots/pads-fr.png)](docs/screenshots/pads-fr.png) | **Synthé**<br>[![Fenêtre Synthé : familles, presets, potentiomètres d'expression, accords et arpégiateur](docs/screenshots/synth-fr.png)](docs/screenshots/synth-fr.png) |
| **TR-909**<br>[![Fenêtre TR-909 : séquenceur 16 pas, et les potentiomètres avec la distorsion par instrument](docs/screenshots/tr-fr.png)](docs/screenshots/tr-fr.png) | **TB-303**<br>[![Fenêtre TB-303 : grille avec octaves, accents et slides, et ses potentiomètres](docs/screenshots/acid-fr.png)](docs/screenshots/acid-fr.png) |
| **Designer de kick**<br>[![Designer de kick : presets, 12 potentiomètres et la forme d'onde](docs/screenshots/kick-fr.png)](docs/screenshots/kick-fr.png) | **Platines**<br>[![Platines : deux decks avec disques à scratcher, égaliseur, filtre et crossfader](docs/screenshots/decks-fr.png)](docs/screenshots/decks-fr.png) |
| **Table de mixage et chaîne master**<br>[![Table de mixage : voies, effets d'insert, sidechain et chaîne master avec la sonie en LUFS](docs/screenshots/mixer-fr.png)](docs/screenshots/mixer-fr.png) | **Câblage**<br>[![Fenêtre Câblage : les outils à gauche, les boîtes à effets au milieu, le master à droite](docs/screenshots/patch-fr.png)](docs/screenshots/patch-fr.png) |
| **Effets de piste**<br>[![Timeline de la démo 2 avec une ligne d'effets sous chaque piste et l'onglet Effets de la bibliothèque](docs/screenshots/tlfx-fr.png)](docs/screenshots/tlfx-fr.png) | **Scènes et performance**<br>[![Fenêtre Scènes avec des scènes enregistrées, et les effets de performance](docs/screenshots/scenes-fr.png)](docs/screenshots/scenes-fr.png) |
| **Piano roll**<br>[![Piano roll : le hook de hoover de la démo 2, avec la bande des vélocités](docs/screenshots/roll-fr.png)](docs/screenshots/roll-fr.png) | **Synthé à oscillateurs**<br>[![Synthé à oscillateurs : trois oscillateurs, filtre, enveloppes, LFO et presets](docs/screenshots/osc-fr.png)](docs/screenshots/osc-fr.png) |
| **Visualiseur : fractale + kaléidoscope + glitch**<br>[![Visualiseur, Fractale 3D avec les filtres kaléidoscope et glitch empilés](docs/screenshots/viz-fr.png)](docs/screenshots/viz-fr.png) | **Visualiseur : Paysage 3D**<br>[![Visualiseur, Paysage 3D : grille synthwave façonnée par le spectre](docs/screenshots/viz3d-fr.png)](docs/screenshots/viz3d-fr.png) |
| **Générateur : accords et mélodie**<br>[![Fenêtre Générateur, onglet Mélodie : réglages de la mélodie et son brouillon dans le piano roll](docs/screenshots/gen-fr.png)](docs/screenshots/gen-fr.png) | **Designer d'effet**<br>[![Designer d'effet : une courbe de volume dessinée sur un temps](docs/screenshots/curve-fr.png)](docs/screenshots/curve-fr.png) |
| **Séquenceur pas à pas**<br>[![Séquenceur pas à pas : une ligne par son de pad, 16 pas, patterns et longueur](docs/screenshots/seq-fr.png)](docs/screenshots/seq-fr.png) | **Découpeur de breaks**<br>[![Découpeur de breaks : un break découpé sur ses coups, tranches numérotées](docs/screenshots/slicer-fr.png)](docs/screenshots/slicer-fr.png) |

## Démarrage rapide

1. Téléchargez le projet : `git clone https://github.com/guillaumemonet/gabber-apckey25.git`, ou le ZIP depuis GitHub.
2. Lancez `start.bat` (Windows) ou `./start.sh` (macOS / Linux), puis ouvrez http://localhost:8025 dans Chrome, Edge ou Firefox.
3. Cliquez sur **Démarrer** et autorisez les appareils MIDI. L'APC Key 25 est facultatif : tout fonctionne aussi à la souris et au clavier de l'ordinateur.

Il faut seulement Python 3, pour le petit serveur local. Détails : [Premiers pas](docs/manuel/demarrage.md).

## Manuel

Le mode d'emploi complet est dans [docs/manuel](docs/manuel/README.md) ; chaque fenêtre de l'application a aussi son aide (bouton **?**).

1. **[Premiers pas](docs/manuel/demarrage.md)** : Prérequis, Installation, Lancement, Langue, Compatibilité matérielle
2. **[Le contrôleur APC Key 25](docs/manuel/apc.md)** : Commandes sur l'APC, Potentiomètres, Effets de performance, Autres claviers MIDI et MIDI learn
3. **[Pads et banques](docs/manuel/pads.md)** : Banques, Tempo et boucles, Découpeur de breaks
4. **[Timeline, bibliothèque et piano roll](docs/manuel/timeline.md)** : Timeline et bibliothèque de sons, Automation, Marqueurs, Effets de piste, Geler une piste, Piano roll, Démo
5. **[Instruments](docs/manuel/instruments.md)** : TR-909, TR-808, Séquenceur pas à pas, TB-303, Synthé, Synthé à oscillateurs, Designer de kick
6. **[Générateur : accords et mélodie](docs/manuel/generateur.md)**
7. **[Mixage et effets](docs/manuel/mixage.md)** : Designer d'effet, Table de mixage, Bus, Chaîne master et sonie, Câblage
8. **[Live : platines, scènes, visualiseur](docs/manuel/live.md)** : Platines, Lanceur de clips, Scènes, Visualiseur, Fenêtres des plugins
9. **[Fichiers et enregistrement](docs/manuel/fichiers.md)** : Enregistrer et ouvrir, Enregistrement et kits, Fichiers MIDI, Entrée audio (micro, carte son)
10. **[Dépannage](docs/manuel/depannage.md)** : Dépannage, Régénérer les banques de sons (facultatif)

## Feuille de route

Objectif : faire de GabberKey un outil professionnel, au studio comme en live, étape par étape.

1. **Fondations** : tests automatiques, code découpé en modules, sons chargés à la demande, manuel complet. *(fait)*
2. **Mixage pro** : effets d'insert sur chaque piste, bus, chaîne de master (compresseur, limiteur, vumètre en LUFS), solo. *(fait)*
3. **Édition** : couper un bloc, fondus, gain, inversion, transposition, menu contextuel, marqueurs, annuler / rétablir partout. *(fait)*
4. **Automation** : des courbes de réglages dessinées sur la timeline. *(fait)*
5. **Live** : lanceur de clips, MIDI learn pour d'autres contrôleurs, horloge MIDI. *(fait)*
6. **Tonalité et étirement** : étirement temporel qui garde la hauteur et transposition des sons de la timeline et du lanceur. *(fait ; les boucles des pads suivront)*
7. **Entrées** : enregistrement audio (micro, carte son) et fichiers MIDI. *(fait)*

Idées gardées pour plus tard : un **sampler de voix et vocoder**, **plusieurs exemplaires** de la TB-303 et de la TR-909, une **version en ligne** jouable sans rien installer, et un **générateur de boucles par IA** (un modèle de musique open source qui tourne sur votre machine).

Les idées et suggestions sont les bienvenues dans les [issues](https://github.com/guillaumemonet/gabber-apckey25/issues).

## Compatibilité matérielle

GabberKey est développé et testé avec un **Akai APC Key 25 mk1**. Le **mk2** est pris en charge d'après la documentation MIDI d'Akai Professional, mais n'a pas encore été essayé sur un vrai appareil. Tout fonctionne aussi à la souris et au clavier de l'ordinateur, et **n'importe quel autre clavier MIDI** peut jouer le synthé et piloter les réglages par MIDI learn.

> **Un mot pour les fabricants de matériel** 🙏
>
> Aujourd'hui, GabberKey se joue avec le seul contrôleur que je possède, un APC Key 25. Si vous fabriquez des contrôleurs MIDI, des claviers, des contrôleurs à pads ou des grooveboxes et que vous aimeriez vérifier si votre produit fonctionne avec GabberKey, je serais vraiment ravi de le rendre le plus compatible possible, et de partager librement le résultat avec toutes celles et ceux qui jouent sur vos instruments. Si vous aviez la gentillesse de prêter ou d'envoyer un appareil, n'hésitez surtout pas à me contacter en [ouvrant une issue](https://github.com/guillaumemonet/gabber-apckey25/issues) sur ce dépôt. Merci infiniment pour votre temps et votre bienveillance !

## Pour les développeurs

GabberKey est une page web sans étape de compilation ni dépendance : des moteurs audio (`js/*.js`) et l'application, un module par domaine (`js/app/`). Organisation du code, conventions et structure du projet : [docs/dev](docs/dev/README.md).

`npm test` vérifie le code (syntaxe, traductions, pages d'aide, fichiers de sons), puis lance une cinquantaine de tests dans Firefox (sans fenêtre), chacun sur un domaine de l'application : pads, instruments, timeline, effets, fichiers, platines, visualiseur, bibliothèque. Ils tournent aussi sur GitHub à chaque envoi. Il faut Node.js 18 ou plus et Firefox, rien à installer. Détails et écriture d'un test : [docs/dev/tests.md](docs/dev/tests.md).

## Crédits

- Conception et développement : **Guillaume Monet**
- Banques 2 à 6 : échantillons de [Sonic Pi](https://github.com/sonic-pi-net/sonic-pi), domaine public (CC0). Voir `sounds/CREDITS.md`.
- Banques gabber et kit de départ : synthétisés par le code de GabberKey.
- Protocole MIDI de l'APC Key 25 mk2 : documentation Akai Professional.

## Licence

Code publié sous [licence MIT](LICENSE) © 2026 Guillaume Monet. Les échantillons Sonic Pi des banques 2 à 6 restent dans le domaine public (CC0).

Akai Professional et APC sont des marques d'inMusic Brands, Inc. Roland, TR-909 et TB-303 sont des marques de Roland Corporation. GabberKey est un projet indépendant, sans lien avec ces sociétés ni soutien de leur part.
