# GabberKey

**Un studio de musique complet dans le navigateur, né pour le hardcore / gabber, joué avec un Akai APC Key 25.**

*Par Guillaume Monet* · [English version](README.md) · <sub>[☕ Soutenir le projet](https://paypal.me/holythunderblade)</sub>

![GabberKey : bibliothèque de sons, timeline avec le morceau de démo, et la fenêtre des pads](docs/screenshots/overview-fr.png)

GabberKey s'organise autour d'une **timeline** : on glisse des sons d'une bibliothèque rangée par catégorie sur des pistes, les blocs se calent à la mesure et tout joue au même tempo. Les autres outils (pads du sampler, TR-909, synthé, table de mixage, effets…) sont des **plugins** qui s'ouvrent dans des fenêtres, et l'Akai APC Key 25 (mk1 ou mk2) les joue en direct. Rien à installer à part un navigateur :

- **Timeline** : 16 pistes au départ (jusqu'à 64), chacune avec ses potentiomètres (volume, pano, filtres, envois) ; glisser, allonger (les boucles se répètent), copier et déplacer des blocs ; jouez les pads ou le clavier pendant l'enregistrement et chaque coup devient un bloc, en direct, et les notes du synthé un bloc de notes ; retouchez les notes dans un **piano roll** ; la TR-909 s'enregistre en audio ; sélectionnez plusieurs blocs et copiez / collez-les.
- **Bibliothèque de sons** : 798 sons rangés en Kicks, Batterie, Basses, Leads, Stabs / claviers, Nappes / cordes, Voix, Effets et Guitares, à commencer par les nouvelles banques **Anthem** (200 sons faits pour construire un hymne hardcore, anciennes banques archivées), plus vos propres sons et vos enregistrements ; un clic pour écouter, glisser pour poser.
  - neuf **banques hardcore / gabber / hardstyle synthétisées** (sans doublons), dont deux banques de **80 mélodies** : kicks Rotterdam et terror distordus, hoovers, stabs rave, screeches, basses hardcore, cordes dramatiques, pianos rave oldschool, breakbeats, kicks et leads mainstream sombres, kicks uptempo modernes à queue brute, supersaws, cris, effets et boucles à 190 BPM ;
  - cinq banques d'échantillons **libres de droits (CC0)**.
- **Plugins** dans des fenêtres déplaçables et aimantées :
  - **Sampler 40 pads** avec 25 banques, des LEDs synchronisées avec l'écran, et le glisser-déposer de vos propres sons ;
  - **Émulation TR-909** : les 11 instruments synthétisés en direct, **distorsion par instrument (drive + 5 formes)**, séquenceur 16 pas et 8 patterns ;
  - **Piano roll** : éditez les notes des blocs du synthé (hauteur, durée, vélocité, copier / coller, quantification, saisie pas à pas au clavier de l'APC) ;
  - **Designer de kick** : fabriquez votre propre kick distordu avec 12 potentiomètres et 8 presets, puis envoyez-le sur un pad ou dans la bibliothèque ;
  - **Designer d'effet** : dessinez la courbe d'un effet (volume, filtres, panoramique, saturation, envois) sur 1, 2 ou 4 temps et posez-la sur n'importe quelle piste ;
  - **Platines** : deux decks avec disques à scratcher (en avant et en arrière), sync, cue, égaliseur, filtre DJ et crossfader ;
  - **Basse acid façon TB-303** : séquenceur 16 pas avec accent et slide, filtre résonant à enveloppe, distorsion, saisie au clavier de l'APC, calée sur la 909 ;
  - **Synthé à oscillateurs** : 3 oscillateurs avec unisson, FM, modulation en anneau, bruit, filtre 12 / 24 dB, 2 enveloppes, LFO calé sur le tempo, poly / mono / legato, 12 presets et les vôtres ;
  - **Synthé en couches** au clavier : 35 presets en 10 familles (cordes, nappes, chœurs, supersaw, hoovers, leads, basses, stabs, claviers, effets) avec ensemble, largeur stéréo, vibrato et 8 potentiomètres d'expression, mode accords et arpégiateur calé sur le tempo ;
  - **Table de mixage** : une voie par outil avec panoramique, envois delay et reverb, muet / solo, vumètres, jusqu'à 4 effets d'insert, et un **sidechain** déclenché par les kicks ;
  - **Câblage** : reliez librement les outils et des **boîtes à effets** (distorsion, PCF, filtre, delay, reverb, compresseur, bitcrusher), tout calé sur le tempo ;
  - **Visualiseur** dans l'esprit Winamp : 21 modes (spectre à LED, oscilloscope, tourbillons Milk, vumètres hi-fi, texte qui cogne, particules, barres Amiga, spectrogramme, et modes 3D / GPU : tunnel, paysage synthwave, blob, hyperespace, fractale, lasers, ville de spectre, mur de LED, metaballs, plasma, rotozoomer, fluide, réaction-diffusion), filtres empilables (CRT, kaléidoscope, glitch, stroboscope), et une fenêtre projecteur pour un deuxième écran ;
  - **Effets de performance** (rolls, balayages de filtre, tape-stop, pump), **égaliseur général**, **scènes** rappelées à la mesure suivante, **moniteur MIDI**.
- **Enregistrer et ouvrir** tout le projet, le morceau ou les réglages de chaque outil (fichiers `.gabber`), **export WAV rapide et stems**, **enregistrement WAV** de votre session et **export / import de kits**.
- Interface en **français ou en anglais**, selon la langue du navigateur.

> 🚧 **GabberKey est en constante évolution.** De nouvelles fonctions arrivent régulièrement, et plein d'autres sont en route : le MIDI learn pour d'autres contrôleurs, une version en ligne… et bien plus encore. Mettez une étoile ou suivez le dépôt pour voir ce qui arrive (voir la [feuille de route](#feuille-de-route)) !

---

## Captures d'écran

| | |
|---|---|
| **Pads du sampler et éditeur de pad**<br>[![Les 40 pads de la banque Hardstyle et l'éditeur de pad](docs/screenshots/pads-fr.png)](docs/screenshots/pads-fr.png) | **Synthé et générateur de nappes**<br>[![Fenêtre Synthé : familles, presets, potentiomètres d'expression, accords, arpégiateur et générateur de nappes](docs/screenshots/synth-fr.png)](docs/screenshots/synth-fr.png) |
| **TR-909**<br>[![Fenêtre TR-909 : séquenceur 16 pas, et les potentiomètres avec la distorsion par instrument](docs/screenshots/tr-fr.png)](docs/screenshots/tr-fr.png) | **TB-303**<br>[![Fenêtre TB-303 : grille avec octaves, accents et slides, et ses potentiomètres](docs/screenshots/acid-fr.png)](docs/screenshots/acid-fr.png) |
| **Designer de kick**<br>[![Designer de kick : presets, 12 potentiomètres et la forme d'onde](docs/screenshots/kick-fr.png)](docs/screenshots/kick-fr.png) | **Platines**<br>[![Platines : deux decks avec disques à scratcher, égaliseur, filtre et crossfader](docs/screenshots/decks-fr.png)](docs/screenshots/decks-fr.png) |
| **Table de mixage et sidechain**<br>[![Table de mixage : voies, effets d'insert et sidechain, avec les effets de performance](docs/screenshots/mixer-fr.png)](docs/screenshots/mixer-fr.png) | **Câblage**<br>[![Fenêtre Câblage : les outils à gauche, les boîtes à effets au milieu, le master à droite](docs/screenshots/patch-fr.png)](docs/screenshots/patch-fr.png) |
| **Effets de piste**<br>[![Timeline avec une ligne d'effets sous chaque piste, l'onglet Effets de la bibliothèque et les réglages d'un PCF](docs/screenshots/tlfx-fr.png)](docs/screenshots/tlfx-fr.png) | **Scènes et performance**<br>[![Fenêtre Scènes avec des scènes enregistrées, et les effets de performance](docs/screenshots/scenes-fr.png)](docs/screenshots/scenes-fr.png) |
| **Piano roll**<br>[![Piano roll : une mélodie de lead hardstyle sur deux mesures, avec ses accords et la bande des vélocités](docs/screenshots/roll-fr.png)](docs/screenshots/roll-fr.png) | **Synthé à oscillateurs**<br>[![Synthé à oscillateurs : trois oscillateurs, filtre, enveloppes, LFO et presets](docs/screenshots/osc-fr.png)](docs/screenshots/osc-fr.png) |
| **Visualiseur : fractale + kaléidoscope + glitch**<br>[![Visualiseur, Fractale 3D avec les filtres kaléidoscope et glitch empilés](docs/screenshots/viz-fr.png)](docs/screenshots/viz-fr.png) | **Visualiseur : Paysage 3D**<br>[![Visualiseur, Paysage 3D : grille synthwave façonnée par le spectre](docs/screenshots/viz3d-fr.png)](docs/screenshots/viz3d-fr.png) |

## Prérequis

- Un **Akai APC Key 25**, mk1 ou mk2. Il est facultatif : tout marche aussi à la souris et au clavier de l'ordinateur.
- **Google Chrome**, **Microsoft Edge** ou **Firefox** (version 108 ou plus). Safari ne gère pas le Web MIDI.
- **Python 3**, uniquement pour servir la page en local (le Web MIDI exige `localhost` ou HTTPS).
- Le **WebGL** (présent dans tous les navigateurs récents) pour les modes 3D et les filtres du visualiseur ; sans lui, les modes 2D marchent quand même.

## Installation

```bash
git clone https://github.com/guillaumemonet/gabber-apckey25.git
cd gabber-apckey25
```

Ou téléchargez le ZIP depuis GitHub et décompressez-le.

## Lancement

1. Branchez l'APC Key 25.
2. Lancez le serveur local :
   - **Windows** : double-clic sur `start.bat`.
   - **macOS / Linux** : `./start.sh`.
   - **Partout** : `python tools/serve.py`, puis ouvrez http://localhost:8025.
3. Dans le navigateur, cliquez sur **Démarrer**, puis **autorisez les appareils MIDI** quand le navigateur le demande.

L'en-tête affiche **APC Key 25 (mk1)** ou **APC Key 25 mk2** avec un point vert quand le contrôleur est détecté.

## Commandes sur l'APC

| Contrôle | Action |
|---|---|
| **Pads** | Jouer le son (le dernier pad frappé devient le pad sélectionné) |
| **Maj + pad** | Sélectionner un pad sans le jouer |
| **SCENE LAUNCH 1-5** | Banques 1-5 · **Maj +** SCENE LAUNCH = banques 6-10, puis 11-15, 16-20 et 21-25 à chaque nouvel appui (la LED clignote pour les banques 6 à 25 ; l'écran affiche le numéro de la banque) |
| **Boutons de piste 1 / 2 / 3 / 4** | Page des potentiomètres : Synthé / Effets / Pad sélectionné / EQ |
| **Boutons de piste 5 / 6 / 7 / 8** (maintenus) | Roll 1/8 · Roll 1/16 · Roll 1/32 · Filtre ↓ |
| **Maj + piste 5 / 6 / 7 / 8** | Roll 1/4 · Tape-stop · Filtre ↑ · Pump (marche/arrêt) |
| **Maj + piste 1 / 2 / 3 / 4** | Page de potentiomètres du mixeur : volumes / panos / envois delay / envois reverb (K1 Pads, K2 Synthé, K3 TR-909, K4 Timeline, K5 TB-303, K6 Platines, K7 Synthé à oscillateurs, K8 master) |
| **Potentiomètres K1-K8** | Paramètres de la page en cours, qui suit la fenêtre active (Maj = réglage fin) |
| **SUSTAIN** | Ouvre / ferme la page EQ (maintenu : EQ le temps de l'appui) |
| **Maj + touche blanche** | Preset de la famille du synthé (do = 1er, ré = 2e…) · **Maj + do# / ré#** = famille précédente / suivante · **Maj + fa# / sol# / la#** = type d'accord / arpège oui-non / vitesse de l'arpège |
| **Clavier** | Joue le synthé de la fenêtre active (Synthé ou Synthé à oscillateurs) |
| **PLAY** | Lancer / arrêter la timeline (la TR-909 a son propre ▶ dans sa fenêtre) |
| **Maj + PLAY** | Transformer la grille de pads en TR-909 (et revenir) |
| **REC** | Enregistrer l'outil choisi dans la piste armée de la timeline (et arrêter) · **Maj + REC** = page de potentiomètres TB-303, deux fois = platines |
| **STOP ALL CLIPS** | Coupe tout |
| **Maj + STOP ALL CLIPS** | Transformer la grille de pads en 40 scènes (et revenir) |

**LEDs** : un pad chargé prend sa couleur, et un son en cours est allumé à fond ou clignote. Le mk1 n'a que trois couleurs (rouge, vert, jaune), donc le sélecteur de couleur n'affiche que celles-là quand un mk1 est branché.

Tout se fait aussi à la souris. Sur le clavier de l'ordinateur, la rangée du milieu joue des notes (Q S D F… en AZERTY) et **W / X** changent d'octave.

## Banques

[![Les 40 pads de la banque Hardstyle et l'éditeur de pad](docs/screenshots/pads-fr.png)](docs/screenshots/pads-fr.png)

| Banque | Contenu |
|---|---|
| 1 | Kit de départ, synthétisé dans le navigateur |
| 2 | Batterie |
| 3 | Électro |
| 4 | Boucles (22 boucles à 120 BPM) |
| 5 | Textures et basses |
| 6 | Tabla et divers |
| 7 | **Gabber** : 8 kicks (Rotterdam, Early, Terror, Industrial, Frenchcore, Reverse…), percussions, hoovers, stabs, screeches, boucles à 190 BPM |
| 8 | **Gabber 2** : kicks « doomcore » plus sombres accordés de do à sol, effets (montée, descente, laser, impact…), 16 boucles (frenchcore, half-time, beat doomcore, kicks en triolets, deuxièmes riffs de hoover, de stab et d'acid, montée de caisse claire…), stabs rave |
| 9 | **Hardcore** : kicks plus durs (terror, uptempo, speedcore, industrial, mainstream…), basses distordues, accords de cordes (Fm, Db, Eb, Cm, Bbm, Ab), staccato et coup d'orchestre, boucles cordes / basse (ostinato, progression, offbeat, roulante, reese, morceau complet de 4 mesures) et boucles de batterie hardcore, le tout à 190 BPM |
| 10 | **Oldschool** (rave / hardcore début 90) : kicks 909 et 808, kit de breakbeat, pianos rave (Fm, Db, Eb, Cm, Bbm, Ab), stabs Mentasm et belge, chœur « ahh », vox stab, sifflet, sirène d'alerte, break façon Amen et break découpé, riff de piano, arpège rave, morceau oldschool de 4 mesures, le tout à 190 BPM |
| 11 | **Mainstream** (hardcore mainstream sombre, fa mineur harmonique) : kicks à queue tonale distordue (rageur, sombre, punchy, chute de hauteur, brut, accordés do# et sol#), clap dur et percussions, leads sombres et hurlants, screeches, hoover sombre, cloches « horreur », piano sombre, cris synthétisés (« hey », « oi », « yeah »), chœur et cordes sombres, nappe « horreur », boucles (beat, riff de lead, riff de screech, mélodie de cloches, nappe de breakdown, montée, morceau complet de 4 mesures), le tout à 190 BPM |
| 12 | **New wave** (hardcore moderne / uptempo) : kicks à longue queue « zaag » (zaag, brut, screech kick, attaque dure, tok, kick-basse), 8 kicks accordés (de fa à fa) pour les mélodies de kicks, lead et accords supersaw (Fm, Db, Ab, Eb), pluck, lead glissé, nappe euphorique, cris, montées, tunnel, bégaiement, boucles (beat uptempo, kick-basse, mélodie de kicks, galop, accords supersaw, mélodie pluck, montée, drop de 4 mesures), le tout à 190 BPM |
| 13 | **Hardstyle** (hardstyle / rawstyle, **150 BPM**) : kicks hardstyle, raw, screech, euphorique, zaag et punch, kicks accordés do# et sol#, **reverse bass** (fa, do#, ré#, sol#), gros clap, crash chinoise, screeches raw, lead et accord euphoriques, pluck, lead glissé, stab et hoover raw, cris (« hey », « raw », « go »), montée de hauteur, montée, chute de sub profonde, impact, corne de brume, boucles (beat hardstyle, le groove **reverse bass** en contretemps, reverse bass sur une suite d'accords, boucle rawstyle, montée de kicks, riff de screech, mélodie euphorique, drop de 4 mesures) |
| 14 | **Mélodies** (hardcore / gabber, 190 BPM, fa mineur) : 40 boucles mélodiques sans batterie, à poser sur n'importe quel beat : thèmes (hoover, screech, horn, lead sombre, mentasm, acid), thèmes émotionnels (piano, cordes, staccato, cloches, chœur, pluck, supersaw), hooks de 2 mesures, boucles d'accords / d'arpèges / de basse, et 8 thèmes complets (mélodie + accords + basse) sur les suites classiques Fm–Db–Eb–Cm, Fm–Db–Ab–Eb, Fm–Bbm–Db–C et Fm–Eb–Db–C |
| 15 | **Mélodies hardstyle** (150 BPM) : 40 boucles : leads euphoriques au supersaw, mélodies de screech raw, leads et hoover raw, plucks, intros au piano et aux cloches, chœur et cordes, accords euphoriques, lignes de reverse bass, et 8 hymnes complets (lead + accords + reverse bass) |
| 16 | **Anthems** (190 BPM, fa mineur, boucles de 4 mesures, toutes sur les mêmes accords Fm–Db–Eb–Cm pour qu'elles se **superposent**) : gros leads d'hymne (supersaw et hoover superposés à l'octave, plus des versions hoover, screech et horn), **guitares saturées** doublées en stéréo (étouffées, quintes, galop, riff, contretemps, breakdown, lead, guitare + kick), couches à empiler (nappe, cordes, chœur, stabs, arpège, cloches, basse en contretemps, sub), rythmiques d'hymne (beat, ride, galop, montée en roulement de kick, half-time, kick décalé, clap et tambour, toms tribaux), et 8 hymnes complets (lead / guitare + accords + basse + batterie) |
| 17 | **Anthem drums** (la nouvelle bibliothèque, faite pour construire un hymne hardcore ; 190 BPM, fa mineur) : 8 kicks hardcore (mainstream, mainstream long, zaag raw, screech en colère, punch uptempo, terror court, deux kicks 909 / tech distordus), le kick mainstream accordé sur 8 notes de la gamme (pour les mélodies de kick), clap, caisse claire, charley fermé / ouvert, ride, crash, crash inversé, impact, 8 boucles de beat (mainstream, raw, en colère, uptempo, galop terror, half-time, montée en roulement de kick, montée de caisse claire), montée, montée courte, descente, chute de sub, et 4 kicks longs pour les breaks |
| 18 | **Anthem leads** : 8 mélodies d'hymne et 8 hooks joués par de gros leads supersaw et trance, 8 riffs de screech, et le supersaw et le screech sur 8 notes de la gamme (tenus), pour jouer des mélodies en direct sur les pads |
| 19 | **Anthem chords** : cordes (tenues et staccato), super nappe (tenue et pompée), stabs et accords cuivrés, stabs sautillants, chacun sur les quatre grilles (épique Fm–Db–Eb–Cm, euphorique Fm–Db–Ab–Eb, sombre Fm–Bbm–Db–C, andalouse Fm–Eb–Db–C), 4 coups de stab et 8 accords de cordes à jouer en direct |
| 20 | **Anthem bass & drops** : arpèges et hooks au pluck, basses saturées en contretemps et roulantes (quatre grilles), le pluck sur 8 notes, et des boucles complètes : 4 breaks (lead, cordes, pluck), 4 montées (pluck qui s'ouvre, roulement de caisse claire, riser), 4 drops (kick, basse, lead et nappe pompés par le kick) et 4 drops raw (kick zaag, basse roulante, screech) |
| 21 | **Anthem guitars & choirs** : guitares saturées doublées en stéréo (quatre sons de guitare : étouffés, galop, quintes, riff, contretemps, breakdown et solo, sur les quatre grilles), 8 accords en quinte à jouer sur les pads (tenus), boucles de chœurs (profond, numérique, spatial, grégorien, voix fantômes) et 6 accords de chœur à jouer en direct |

La **bibliothèque** commence par ces cinq banques **Anthem** : toutes les boucles sont à 190 BPM en fa mineur sur les mêmes grilles d'accords, elles se superposent toutes. Les anciennes banques (1 à 16, et le kit de départ) sont **archivées** : masquées dans la bibliothèque sauf si vous cochez **Afficher les anciens sons (archives)** sous la recherche ; leurs voix (les cris) restent affichées, et vos pads, vos morceaux et les démos qui les utilisent fonctionnent toujours.

Pour mettre un **son de la bibliothèque** sur un pad, glissez-le de la bibliothèque sur le pad : il remplace le son du pad (le pad garde ses potentiomètres ; une boucle joue en boucle, calée sur le tempo). Pour charger votre propre son, glissez un fichier audio (WAV, MP3, FLAC, OGG…) sur un pad ou sur l'éditeur, ou utilisez **Charger un son…**. **Départ** (au-dessus des pads) règle quand un pad joué à la main démarre et s'arrête : **Libre** (tout de suite ; une boucle attend la mesure suivante si quelque chose joue déjà), ou calé sur la grille : **1, 2 ou 3 temps**, **1, 2 ou 4 mesures**. Le pad part alors à la division suivante, une boucle rappuyée s'arrête à la fin de la division, un pad tenu s'arrête à la division qui suit le relâchement ; pendant l'attente, le pad **clignote vite**, à l'écran et sur l'APC. Si rien ne joue, le premier pad part tout de suite et fixe la grille ; si la timeline ou la 909 jouent, la grille est la leur. En enregistrement, le coup est posé là où il sonne vraiment. **Vider la banque** (au-dessus des pads) vide la banque affichée, pour la remplir avec vos propres choix de sons ; une banque de la bibliothèque que vous avez vidée ne revient pas d'elle-même. Sous la grille des pads, **8 potentiomètres** règlent le pad sélectionné (volume, hauteur, panoramique, filtre, début, delay, reverb, mode), aussi sur les potentiomètres de l'APC quand la fenêtre Pads est active. Ils agissent tous **en direct** sur un pad qui joue, le début aussi : sur une boucle calée au tempo, il déplace le point de départ dans la boucle sans changer sa longueur (elle reste calée sur les mesures) ; sur une boucle libre, le son saute au nouveau début. Le **crayon ✎**, qui apparaît au survol d'un pad, ouvre l'**éditeur de pad** sur ce pad : nom, couleur de la LED, mode de lecture (**One-shot**, **Maintien** ou **Boucle**) et les **8 potentiomètres** du pad (volume, hauteur, panoramique, filtre, début, delay, reverb, mode), aussi sur les potentiomètres de l'APC.

## TR-909

[![Fenêtre TR-909 : séquenceur 16 pas, et les potentiomètres avec la distorsion par instrument](docs/screenshots/tr-fr.png)](docs/screenshots/tr-fr.png)

Une émulation de la Roland TR-909 avec ses 11 instruments : grosse caisse, caisse claire, 3 toms, rim shot, clap, charley fermé et ouvert, crash, ride. Chacun est synthétisé en direct, comme les circuits analogiques de la machine d'origine.

**Potentiomètres** (sous la grille de la fenêtre TR-909 ; aussi sur les potentiomètres de l'APC quand la fenêtre est active, ou avec Maj + PLAY) :

| K1-K4 | K5 | K6 | K7 | K8 |
|---|---|---|---|---|
| Paramètres de l'instrument choisi (ex. BD : Accord, Attaque, Déclin, Niveau) | **Drive** : quantité de distorsion | **Forme** : Douce, Dure, Lampe, Repli (wavefolder), Crush (réduction de bits) | Shuffle | Volume 909 |

Chaque instrument a sa propre distorsion. La grosse caisse démarre avec une saturation « Lampe », pour le son gabber. La quantité d'accent se règle avec le curseur à l'écran.

**Kits de son** (menu au-dessus de la grille) : les réglages des 11 instruments d'un coup, distorsion comprise : **Hardcore** (Gabber, Rotterdam, Terror, Industriel), **Classique** (909 propre, House, Techno) et **FX** (Lo-fi écrasé, Replié). Tourner un potentiomètre rend le son personnalisé ; tapez un nom, choisissez une catégorie et **Enregistrer** pour garder le vôtre (★ dans le menu), la corbeille le supprime. Les patterns ne font pas partie d'un kit.

**Séquenceur** : 16 pas et 8 patterns, dont 4 préréglés (gabber, rave, breakbeat, roulement de grosse caisse). Il suit le même tempo et la même grille de mesures que les boucles, donc il reste calé avec elles. Un changement de pattern attend la mesure suivante. À l'écran, un clic sur un pas fait défiler note → accent → silence, et un clic sur le nom d'un instrument le joue et le sélectionne.

**Grille de l'APC en mode 909** (Maj + PLAY) :

| Rangée | Pads |
|---|---|
| 1-2 | Les 16 pas de l'instrument choisi (rouge = tête de lecture, vert = note, jaune = accent) |
| 3 | BD, SD, LT, MT, HT, RS, HC, CH : jouer et sélectionner |
| 4 | OH, CR, RD, puis **Accent** (les pas posés sont accentués), **Effacer** (vide l'instrument), **Muet** |
| 5 | Patterns 1 à 8 |

Un appui sur un bouton SCENE LAUNCH ramène la grille aux pads du sampler.

## Démo

Cliquez sur **Démo** dans la barre de la timeline et choisissez un morceau. Appuyez sur ▶ pour l'écouter, puis modifiez-le comme vous voulez.

![Le menu Démo et la démo 2 dans la timeline : prises 909 et 303, blocs de notes des synthés, effets de piste sous les blocs](docs/screenshots/demo2-fr.png)

- **Démo 1 : boucles de la bibliothèque** : environ une minute à 190 BPM en fa mineur, construit avec les banques Gabber, Hardcore et Oldschool (intro aux cordes, montée gabber avec hoovers, premier drop, break oldschool avec break façon Amen, piano et chœurs, second drop hardcore avec screech et cordes, final en roulement de kicks). À écouter : [`demo/gabberkey-demo.ogg`](demo/gabberkey-demo.ogg) (rendu par `tools/render_demo.py` à partir de `demo/demo.json`).
- **Démo 2 : tous les outils** : 64 mesures de hardcore à 190 BPM en fa mineur (Fm, Db, Eb, C), faites dans l'application avec un maximum d'outils, sur 15 pistes nommées et colorées :
  - la **TR-909** (kit Rotterdam) et la **TB-303** (son Rotterdam) enregistrées en direct : beat gabber, roulement de kick, kick seul, ligne acid et ligne « squelch » ;
  - le **synthé à oscillateurs** : mélodie au hoover, basse reese à contretemps, supersaw à l'octave, pluck (chaque mélodie est un bloc de notes qui s'ouvre au **piano roll**) ;
  - le **synthé à couches** : cordes épiques et stabs de piano rave ;
  - un kick du **designer de kick** (Terror) sur chaque drop ;
  - des sons de la bibliothèque : charleys, montées de caisse claire, risers, crashs, impacts, cris, screech, sirène, chœur ;
  - les **effets de piste** : filtre qui s'ouvre et se ferme, filtre pompant, saturation qui monte, wobble, stutter, tape stop, gate, envois de reverb et de delay, autopan, et la **3D** : orbite, spirale, passage et zoom ;
  - les **potentiomètres de piste** : volume, panoramique, filtres, envois delay et reverb.

  Intro aux cordes et sirène, montée (ligne acid, roulement de caisse claire, « hey ! »), premier drop, break au piano avec un pluck qui tourne autour de vous en 3D, second drop avec supersaw, final. À écouter : [`demo/gabberkey-demo-2.ogg`](demo/gabberkey-demo-2.ogg). C'est un fichier morceau ([`demo/gabberkey-demo-2.gabber`](demo/gabberkey-demo-2.gabber)) : les prises 909 / 303 et le kick du designer voyagent dedans.
- **Démos 3, 4 et 5**, faites uniquement avec la nouvelle bibliothèque **Anthem** (64 mesures à 190 BPM en fa mineur, environ 1:20 chacune), avec des effets de piste, des courbes du designer d'effet et de la 3D :
  - **Anthem** (grille épique Fm–Db–Eb–Cm) : intro aux cordes, montée au pluck qui s'ouvre au filtre passe-haut, un premier drop avec le lead d'hymne supersaw, basse et nappe pompées par des courbes de pompe sidechain, un break avec le pluck qui tourne en 3D, une montée en roulement de kick, et un second drop avec le beat en colère, le hook supersaw, les cuivres et un screech découpé en gate 3-3-2. À écouter : [`demo/gabberkey-demo-3.ogg`](demo/gabberkey-demo-3.ogg).
  - **Raw** (grille sombre Fm–Bbm–Db–C) : intro aux cordes sombres, beat raw qui s'ouvre au filtre passe-haut, un premier drop avec le lead sombre, la basse roulante et la nappe pompée, un break ouvert par un kick zaag long avec les cordes en spirale 3D, une montée en roulement de kick, et un second drop au beat en colère où arrivent le screech (courbe wobble, passage en 3D) et les stabs en ping-pong. À écouter : [`demo/gabberkey-demo-4.ogg`](demo/gabberkey-demo-4.ogg).
  - **Euphoric** (grille euphorique Fm–Db–Ab–Eb) : beat uptempo, lead euphorique, hooks trance avec une courbe d'écho à contretemps, une nappe qui gonfle et respire, un pluck qui arrive en zoom 3D, et une mélodie jouée avec les kicks accordés avant le dernier drop. À écouter : [`demo/gabberkey-demo-5.ogg`](demo/gabberkey-demo-5.ogg).

## Timeline et bibliothèque de sons

L'écran principal : la **bibliothèque de sons** à gauche, la **timeline** à droite (16 pistes et 32 mesures au départ, − / + pour changer la longueur et le nombre de pistes, de 4 à 64, zoom, **Boucle**).

- **Bibliothèque** : deux onglets. **Sons** : choisissez une catégorie (Kicks, Batterie, Basses, Leads, Stabs / claviers, Nappes / cordes, Voix, Bruitages, Guitares, Mes sons, Enregistrements). **Effets** : les effets de piste, par famille (Volume, Filtre, Espace, Temps, Saturation, 3D, et vos Courbes du designer d'effet). Ou cherchez par nom. Un **clic** sur un son l'écoute (et le choisit) ; l'étiquette indique sa longueur en mesures (boucles) ou « 1 coup ».
- **Poser** : glissez un son sur une piste. Il se cale au début de la mesure (gardez **Maj** enfoncée pour le poser sur un temps). Un clic dans une case vide pose le dernier son choisi.
- **Modifier les blocs** : glissez un bloc pour le déplacer (vers une autre mesure ou une autre piste), tirez son **bord droit** pour l'allonger ou le raccourcir (une boucle se répète pour remplir le bloc), **Alt + glisser** le copie, un **double-clic** l'écoute (un bloc de notes s'ouvre dans le **piano roll**), un **clic droit** ou **Suppr** le retire. Chaque piste a un bouton muet.
- **Temps de lecture** (à côté de Rec) : le temps écoulé depuis le début du morceau, la position mesure.temps, et la durée du morceau (jusqu'à la fin de son dernier bloc) ; il suit la tête de lecture, en lecture ou quand vous la déplacez.
- **Écouter un bloc** : le bouton **▶** qui apparaît sur un bloc au survol de la souris (ou un double-clic sur un bloc de son) joue ce bloc seul, tel qu'il sonne dans le morceau : au tempo, sur toute sa longueur, avec les potentiomètres de sa piste (mais sans ses effets de piste) ; une barre avance sur le bloc et **■** l'arrête. Le morceau n'est pas dérangé s'il joue.
- **Nom et couleur** : double-clic sur le nom d'une piste pour la renommer ; son panneau (bouton cadran) propose aussi le nom et une couleur de fond pour la piste.
- **Potentiomètres de piste** : le bouton cadran de chaque piste ouvre son panneau et ses potentiomètres : **volume**, **pano**, filtres **passe-bas** et **passe-haut**, envois **delay** et **reverb**. Ils agissent sur tout ce que joue la piste, sont enregistrés avec le morceau, s'annulent avec Ctrl+Z et sont inclus dans l'export WAV et les stems. Le bouton s'allume dès qu'un potentiomètre n'est plus à sa valeur par défaut ; **Remise à zéro** les remet tous.
- **Sélectionner plusieurs blocs** : **Ctrl + clic** ajoute un bloc à la sélection (ou le retire), **glisser dans le vide** trace un cadre de sélection (Maj ou Ctrl pour ajouter à la sélection), **Ctrl+A** sélectionne tout. Glissez l'un d'eux pour déplacer tout le groupe (Alt = le copier). Les blocs d'effet des pistes se sélectionnent de la même façon.
- **Copier / coller** : **Ctrl+C** / **Ctrl+X**, puis **Ctrl+V** colle à la tête de lecture, sur les mêmes pistes (la tête de lecture passe à la fin du collage : un nouvel appui enchaîne les copies) ; **Ctrl+D** duplique la sélection juste après elle ; **Suppr** la retire ; **Échap** désélectionne.
- **Annuler / rétablir** : **↶ / ↷** dans la barre, ou **Ctrl+Z** / **Ctrl+Maj+Z** (ou **Ctrl+Y**). Toute modification de la timeline peut être annulée (blocs posés, déplacés, allongés ou supprimés, nappes générées, enregistrements, chargement de la démo…), jusqu'à 100 étapes.
- **Enregistrer en jouant (live)** : armez une ou **plusieurs pistes** (●), choisissez dans le panneau de chaque piste l'**instrument qu'elle enregistre** (Pads, Synthé, Synthé à oscillateurs, TR-909, TB-303, Platines, ou Auto = le menu **Enregistrer** de la barre ; l'en-tête de la piste montre son icône), placez la tête de lecture (clic sur la règle), puis **● Rec** (ou REC sur l'APC). Chaque piste armée enregistre son instrument en même temps, et la timeline joue (en boucle si Boucle est activé, sauf si un instrument s'enregistre en audio) :
  - **Pads** : chaque coup de pad devient un bloc de ce pad, là où vous l'avez frappé (calé à la double-croche). Le bloc rejoue le pad avec ses réglages.
  - **Synthé** : chaque note apparaît en direct et **s'allonge tant que vous tenez la touche** ; à l'arrêt, les notes de la prise deviennent **un seul bloc de notes** (d'une mesure à l'autre), qui rejoue avec le synthé joué (preset du synthé en cours, ou le synthé à oscillateurs) et s'ouvre dans le piano roll.
  - Les blocs apparaissent en direct pendant que vous jouez, sur la piste qui enregistre l'instrument. Si elle est occupée à ce moment-là, le bloc va sur la piste libre suivante (jamais sur une piste armée pour un autre instrument). Les notes vont à la piste du synthé que joue le clavier. Avec Boucle, vous pouvez ajouter des coups à chaque passage.
  - **TR-909** / **TB-303** / **Platines** : l'instrument démarre calé sur les mesures de la timeline et s'enregistre en audio dans un bloc (aussi rangé dans la bibliothèque, rubrique Enregistrements).
  - **■ Arrêter rec** (ou REC à nouveau) termine l'enregistrement.
- **Lire** : ▶ (ou PLAY sur l'APC) joue depuis la tête de lecture, et le même bouton arrête ; la vue suit la tête de lecture. Les boucles faites à un autre tempo suivent le tempo global. La timeline a sa propre voie dans la table de mixage.

### Effets de piste

[![Timeline avec une ligne d'effets sous chaque piste, l'onglet Effets de la bibliothèque et les réglages d'un PCF](docs/screenshots/tlfx-fr.png)](docs/screenshots/tlfx-fr.png)

Chaque piste a deux parties : les **sons** en haut, et une fine **ligne d'effets** en dessous. Glissez un effet de la catégorie **Effets de piste** de la bibliothèque sur une piste : il agit sur **tout ce que joue la piste** (blocs audio, notes et accords du synthé, coups de pads) **pendant la durée du bloc**, calé sur le tempo. Les effets se cumulent : un fondu d'entrée et un PCF en même temps s'appliquent tous les deux ; les blocs d'effet qui se chevauchent s'empilent sur plusieurs lignes.

- **Modifier** un bloc d'effet comme un bloc de son : le glisser (Alt = copie), tirer son bord droit pour changer sa longueur, clic droit ou **Suppr** pour le retirer, **double-clic** pour ouvrir ses réglages.
- **La banque d'effets** (30 effets, chacun avec ses réglages) :

| Famille | Effets |
|---|---|
| Volume | Fondu d'entrée, Fondu de sortie, Montée de volume, Gate 1/8 et 1/16, Coupure |
| Filtre | Montée passe-haut, Fermeture passe-bas, Wobble 1/4 et 1/8, **PCF** 1/8, 1/16, contretemps, galop, 3-3-2, passe-bande |
| Espace | Lancer de reverb, Lancer de delay (les échos continuent après le bloc), Auto-pan |
| Temps | Stutter 1/8, 1/16, 1/32, Tape stop |
| Saturation | Montée de distorsion, Montée de bitcrush |
| 3D | Orbite 3D, Passage 3D, Zoom avant / arrière 3D, Spirale 3D (binaural : idéal au casque) |

- Le **PCF** est un filtre rythmique : passe-bas (LP) ou passe-bande (BP), dont l'enveloppe repart à chaque pas actif d'un **motif** de 16 pas (1/8, 1/16, 1/4, contretemps, galop, 3-3-2, roulement), avec **Fréquence**, **Q**, **Quantité** et **Déclin**.
- Tout est programmé sur l'horloge audio : les effets restent calés, s'annulent avec Ctrl+Z, et sont inclus dans l'export WAV et les stems.

## Piano roll

[![Piano roll : une mélodie de lead hardstyle sur deux mesures, avec ses accords, la bande des vélocités et la barre d'outils](docs/screenshots/roll-fr.png)](docs/screenshots/roll-fr.png)

Éditez les notes d'un **bloc de notes** de la timeline (enregistrements du synthé, nappes générées, accords, arpèges, ou un nouveau bloc).

- **Ouvrir un bloc** : double-clic sur un bloc de notes de la timeline (quand la fenêtre est ouverte, un clic suffit), ou **+ Nouveau bloc** (1 mesure à la tête de lecture, sur la piste armée). Un **enregistrement du synthé devient un seul bloc de notes**, prêt à être retouché.
- **Dessiner** : clic dans le vide pour poser une note (glisser pour sa durée), glisser une note pour la déplacer (**Alt** = copie), tirer son bord droit pour sa durée, **clic droit** pour effacer. **Maj + glisser** sélectionne un groupe.
- **Touches** : Suppr, Ctrl+A / C / X / V (collage au curseur vert, placé d'un clic sur la règle), **Ctrl+D** duplique à la suite, ↑ / ↓ transposent (Maj = octave), ← / → déplacent d'une case (Maj = une mesure), **Q** quantifie, **Espace** écoute, Ctrl+Z annule.
- **Vélocité** : glisser dans la bande du bas.
- **Grille** de 1/4 à 1/32, avec les triolets ; **Quantifier** cale le début et la fin des notes. Les lignes de la gamme de fa mineur (la tonalité des banques) sont teintées.
- **Longueur** −/+ règle la longueur du **motif** : dans la timeline, le bloc le répète sur toute sa longueur (tirer son bord droit), comme une boucle. Des notes posées après la fin allongent le motif.
- **Son** : chaque bloc peut avoir son propre preset du synthé, ou jouer le son en cours au clavier. **Regrouper** rassemble en un seul les blocs de notes voisins de la piste (même son).
- **Pas à pas** : les notes jouées au clavier de l'APC (ou de l'ordinateur) sont posées au curseur, accords compris, et le curseur avance d'une case.
- **▶ Écouter** joue le motif seul en boucle ; pendant la lecture de la timeline, la tête de lecture s'affiche aussi dans le piano roll.

## TB-303

[![Fenêtre TB-303 : grille avec octaves, accents et slides, et ses potentiomètres](docs/screenshots/acid-fr.png)](docs/screenshots/acid-fr.png)

Une ligne de basse acid façon Roland TB-303, synthétisée en direct : oscillateur (scie ou carré), filtre passe-bas 24 dB résonant piloté par une enveloppe, accent, slide, puis distorsion avec les 5 formes de la 909.

- **Grille** : 16 pas (doubles-croches) × une octave de fa à fa aigu. Clic sur une case pour poser une note, un second clic pour un silence. Les lignes **Oct + / Oct −** décalent un pas d'une octave, **Accent** le rend plus fort avec un filtre plus claquant, **Slide** glisse vers la note suivante sans relancer l'enveloppe (le fameux « squelch »).
- **Presets de son** : 15 sons tout prêts en 4 catégories : **Acid** (classique, squelch, screamer, Rotterdam, hoover), **Basse** (caoutchouc, sub, roulante sombre), **Lead** (lead scie, couinement, lead gabber) et **FX** (laser, sirène, écrasée, zap). Tourner un potentiomètre rend le son personnalisé ; donnez-lui un nom et une catégorie puis **Enregistrer** pour garder vos propres presets (★), enregistrés avec la session et dans les fichiers de réglages de la TB-303.
- **Potentiomètres** : accord, coupure, résonance, quantité d'enveloppe, déclin, accent, **slide** (durée du glissé entre notes liées), drive, forme, volume. Sur l'APC, **Maj + REC** ouvre la page de potentiomètres TB-303 (K1 coupure … K8 volume).
- **8 patterns**, dont 4 tout prêts en fa mineur (acid gabber, roulement de doubles-croches, glissés « squelch », minimal à contretemps). Un changement de pattern attend la mesure suivante. **Aléatoire** écrit une nouvelle ligne acid en fa mineur ; **Effacer** vide le pattern.
- **Suivre la 909** (activé par défaut) : la 303 joue sur l'horloge de la TR-909, shuffle compris, et ▶ lance les deux. Désactivez-le pour jouer la 303 seule, sur la grille des mesures des boucles.
- **Saisie** : activez **Saisie** et jouez la ligne au clavier de l'APC (ou de l'ordinateur). Chaque note va dans le pas choisi et le curseur avance ; une frappe forte ajoute un accent, **Silence** laisse un pas vide, un clic sur un numéro de pas déplace le curseur.
- La 303 a sa propre **voie de mixage** (K5 sur les pages de potentiomètres du mixeur), est baissée par le **sidechain** avec les sons mélodiques, est gardée dans les **scènes** (pattern et marche) et peut être **enregistrée** en audio dans la timeline (source TB-303).

## Designer de kick

[![Designer de kick : presets, 12 potentiomètres et la forme d'onde](docs/screenshots/kick-fr.png)](docs/screenshots/kick-fr.png)

Fabriquez votre propre kick gabber / hardcore, calculé par le navigateur en quelques millisecondes à partir de 12 potentiomètres :

- **Presets** : Rotterdam, Mainstream, Uptempo, Raw, Terror, Industrial, Early, Frenchcore (boutons), aussi dans un menu par catégorie (Gabber, Hardcore, Mainstream / uptempo) avec vos propres kicks. Tourner un potentiomètre rend le son personnalisé ; tapez un nom, choisissez une catégorie et **Enregistrer** pour garder le vôtre (★ dans le menu), la corbeille le supprime.
- **Queue** : **Note** (accordée avec les banques), **Punch** et **Chute** (de combien la hauteur part haut et à quelle vitesse elle tombe), **Plongée** (de combien elle continue de descendre), **Longueur**, **Zaag** (scie pour la queue brute et bourdonnante des kicks uptempo).
- **Distorsion** : **Drive** et **Forme** (les 5 formes de la 909), puis **Formant** et **Mordant**, qui font « parler » la queue.
- **Attaque** : **Clic** (bruit) et **Attaque** (couche courte et percutante).
- **Écoute auto** joue le kick à chaque potentiomètre relâché ; la forme d'onde et la longueur s'affichent.
- **→ Pad** le met sur le pad sélectionné, **→ Bibliothèque** l'ajoute à la catégorie **Kicks** de la bibliothèque (à glisser sur la timeline ; clic droit dessus pour le retirer), **⤓ WAV** le télécharge. Vos kicks déclenchent le sidechain comme les autres.

## Designer d'effet

[![Designer d'effet : formes de départ, l'éditeur de courbe avec sa grille, profondeur et lissage](docs/screenshots/curve-fr.png)](docs/screenshots/curve-fr.png)

Dessinez comment un réglage d'une piste bouge sur **1, 2 ou 4 temps** : la forme se répète en boucle, calée sur le tempo, tant que son bloc dure sur la timeline (une pompe sidechain faite main, un gate trance, un wobble de filtre, un balancier de panoramique…).

- **Réglage piloté** : volume, filtre passe-bas, filtre passe-haut, panoramique, saturation, envoi reverb ou envoi delay.
- **Édition** : clic pour ajouter un point, puis glissez-le (aimanté à la grille : 1/4, 1/8, 1/16, 1/32 et triolets ; **Maj** = libre), double-clic ou clic droit sur un point pour le supprimer. Le **losange** entre deux points courbe le trait (glissez-le vers le haut ou le bas) ; double-clic dessus pour un **palier** : la valeur reste jusqu'au point suivant.
- **Profondeur** ramène la courbe vers « sans effet » (en pointillés), **Lissage** arrondit les paliers pour qu'ils ne claquent jamais. Pour les filtres, la coupure extrême et la résonance.
- **Écouter** joue une boucle de la bibliothèque (batterie, basse, cordes ou hoover) à travers la courbe, avec une tête de lecture : chaque retouche s'entend tout de suite.
- **14 formes de départ** : pompe sidechain, pompe double, gate trance, gate 3-3-2, stutter 1/32, respiration, wobble filtre, dent de scie filtre, balayage passe-haut, ping-pong, balancier, impulsion saturée, queue de reverb, écho à contretemps. Modifiez-en une, puis **Enregistrer dans la bibliothèque** : elle devient votre courbe.
- **Sur la timeline** : vos courbes sont dans la bibliothèque, **Effets › Courbes**. Glissez-en une sur une piste comme un effet de piste, ou cliquez sur **Sur la timeline** (à la tête de lecture, sur la piste du bloc sélectionné). Le bloc montre la forme. Retoucher votre courbe change tous ses blocs d'un coup, même pendant la lecture ; double-clic sur un bloc de courbe pour l'ouvrir dans le designer.
- Vos courbes sont sauvegardées avec le projet, voyagent dans les fichiers morceau et sont dans l'export WAV et les stems.

## Platines

[![Platines : deux decks avec disques à scratcher, égaliseur, filtre et crossfader](docs/screenshots/decks-fr.png)](docs/screenshots/decks-fr.png)

Deux decks pour mixer et scratcher n'importe quel son : boucles de la bibliothèque, vos enregistrements, vos propres fichiers audio.

- **Charger** : glissez un son de la bibliothèque (ou un fichier audio) sur un deck, ou cliquez sur un son de la bibliothèque puis sur **Charger**.
- **▶ / ❚❚** lecture / pause. **Cue** : en lecture, retour au point de cue et pause ; à l'arrêt, place le point de cue. Clic sur la forme d'onde pour s'y rendre.
- **Sync** : le deck suit le tempo global (quand le tempo du son est connu : boucles de la bibliothèque, ou deviné pour les longs fichiers), continue de le suivre quand vous changez le tempo, et démarre à la mesure suivante. Sans Sync, le curseur **Pitch** change la vitesse de ±8 %.
- **Scratch** : tenez le disque à la souris et bougez-le, en avant ou en arrière ; relâchez-le pour qu'il reparte. Comme sur une vraie platine, le disque suit la **position** de la main (pas sa vitesse), avec un peu d'inertie qui gomme les à-coups de la souris ; relâché, il garde l'élan de la main et le moteur le ramène à sa vitesse en un dixième de seconde. Le son est lu par un processeur audio dédié (interpolation sur 4 points, anti-crénelage quand ça va vite) : il joue vraiment à l'envers et suit la main.
- **Affichage** : une forme d'onde zoomée qui défile sous la tête de lecture, 4 mesures avec la grille des temps et les mesures numérotées, basses en orange (pour caler les kicks à l'œil) ; le son entier en dessous (clic pour s'y placer) ; le plateau avec ses points stroboscopiques, le disque et son étiquette, et le bras de lecture.
- **Transition auto** (à côté du crossfader) : mixe du deck qui joue vers l'autre, en choisissant la meilleure façon. L'arrivant part pile sur la prochaine **phrase** de celui qui joue (8 mesures, ou 4 si attendre 8 mesures serait trop long), en phase. La transition dure **16 mesures** quand le son qui arrive commence calme (une intro), **8** sinon, moins si celui qui part se termine avant. L'arrivant entre sans basses et un peu filtré, le crossfader va au milieu, les **basses s'échangent** net sur la mesure du milieu, puis le partant s'éloigne (filtre passe-haut, aigus baissés) et s'arrête ; ses réglages reviennent au neutre. On voit les potentiomètres bouger. Sans tempo connu : un fondu de 8 secondes. Toucher les platines (crossfader, potentiomètre, disque, ▶) reprend la main ; un nouveau clic sur le bouton l'arrête.
- Pour chaque deck : **Volume**, **Basses**, **Médiums**, **Aigus** (tout à gauche = coupé) et un **Filtre** DJ (à gauche = passe-bas, à droite = passe-haut) ; un **crossfader** à puissance constante entre A et B.
- Sur l'APC, **Maj + REC** deux fois ouvre la page de potentiomètres des platines (K1-K3 = volume, basses, filtre du deck A ; K4-K6 = deck B ; K7 = crossfader ; K8 = master). Les platines ont leur voie de mixage (K6 sur les pages mixeur) et peuvent être enregistrées dans la timeline (source Platines).

## Scènes

[![Fenêtre Scènes avec des scènes enregistrées, et les effets de performance](docs/screenshots/scenes-fr.png)](docs/screenshots/scenes-fr.png)

40 scènes disposées comme la grille de l'APC (1-8 en bas). Une scène mémorise :
- les boucles lancées ;
- le pattern de la TR-909 et ses instruments muets ;
- les niveaux, panoramiques, envois, muets et solos de la table de mixage ;
- le preset du synthé, le tempo, et l'état lecture ou arrêt.

- **Lancer** : clic sur une scène. Tout bascule **à la mesure suivante** : les nouvelles boucles démarrent, les autres s'arrêtent, les patterns changent et le mixeur suit.
- **Enregistrer** l'état actuel : Maj + clic, ou activez le **Mode enregistrement**. Un clic droit efface une scène.
- **APC** : **Maj + STOP ALL CLIPS** transforme la grille de pads en 40 scènes. Pad = lancer, Maj + pad = enregistrer, Maj + STOP ALL CLIPS à nouveau (ou un bouton SCENE LAUNCH) pour revenir. LEDs : vert = enregistrée, rouge = en cours, clignotant = en attente de la mesure suivante.

## Table de mixage

[![Table de mixage : voies, effets d'insert et sidechain, avec les effets de performance](docs/screenshots/mixer-fr.png)](docs/screenshots/mixer-fr.png)

Une voie par outil : **Pads**, **Synthé**, **TR-909**, **Timeline**, **TB-303**, **Platines** et **Synthé à oscillateurs**, puis le master (effets de performance, égaliseur général et limiteur). Le niveau de chaque son reste dans son outil (volume des pads, niveaux des instruments de la 909) ; la table de mixage équilibre les outils entre eux.

Chaque voie a des effets d'insert (**+ FX**, jusqu'à 4, appliqués dans l'ordre), des envois reverb et delay, un panoramique, un fader (0 dB aux trois quarts), **M**uet, **S**olo et un vumètre. Effets disponibles :
- **Distorsion** : drive et les 5 formes de la 909.
- **Filtre** : passe-bas ou passe-haut, coupure et résonance.
- **Compresseur** : seuil, ratio et gain.
- **Reverb** : taille et dosage.

Double-clic sur un réglage pour le remettre à zéro. Sur l'APC, **Maj + bouton de piste 1 / 2 / 3 / 4** transforme les potentiomètres en volumes / panoramiques / envois delay / envois reverb du mixeur : K1 = Pads, K2 = Synthé, K3 = TR-909, K4 = Timeline, K5 = TB-303, K6 = Platines, K7 = Synthé à oscillateurs, K8 = volume général. Les réglages du mixeur sont sauvegardés et inclus dans les exports de session.

### Sidechain

En haut de la fenêtre de la table de mixage. Quand il est **Activé**, chaque kick fait baisser le **synthé** et le **synthé à oscillateurs** (clavier, blocs de notes et d'accords), la **TB-303** et les **sons mélodiques** (pads et blocs de la timeline des catégories Basses, Leads, Stabs / claviers, Nappes / cordes et Voix), qui remontent ensuite en douceur : le morceau respire avec le kick. Les kicks et la batterie ne sont jamais baissés.

- **Déclenché par** :
  - **Les kicks** : la grosse caisse de la TR-909, les pads et blocs de kick, et les kicks des boucles de GabberKey (leur position exacte est enregistrée dans la bibliothèque : un galop, un roulement ou une montée baisse le son sur chacun de ses kicks). Un enregistrement de la 909 dans la timeline garde aussi la position de ses kicks.
  - **Chaque temps** : sur chaque temps de la grille, pour les boucles dont on ne connaît pas les kicks (boucles Sonic Pi, vos propres boucles).
- **Profondeur** (de combien le son baisse) et **Relâche** (le temps qu'il met à remonter) ; double-clic pour revenir à la valeur par défaut.
- **Baisse** : choisissez le synthé, les sons mélodiques, ou les deux. Le témoin montre la baisse en temps réel.
- La baisse est programmée à l'instant exact de chaque kick (sur l'horloge audio), et non détectée après coup : aucun retard, et elle reste calée à n'importe quel tempo.

## Câblage

La fenêtre **Câblage** relie librement les outils et des **boîtes à effets**, comme un rack de matériel. Par défaut, chaque outil va directement au master : rien ne change tant que vous n'y touchez pas.

[![Fenêtre Câblage : les outils à gauche, les boîtes à effets au milieu, le master à droite](docs/screenshots/patch-fr.png)](docs/screenshots/patch-fr.png)

- À gauche, un bloc par **outil** : pads, synthé, TR-909, timeline, TB-303, platines, synthé à oscillateurs. Chaque outil garde sa **voie de mixage** (volume, pano, muet, solo, effets d'insert, envois) ; le câblage décide où va cette voie. À droite, le **Master**.
- **Boîtes à effets** : **Distorsion** (drive, les 5 formes de la 909, tonalité, mélange), **PCF** (filtre rythmique LP / BP relancé par un motif de 16 pas, toujours calé sur la grille du tempo), **Filtre** (LP, HP ou BP avec un LFO calé sur le tempo), **Delay** (en valeurs de note : 1/4, 1/8, 1/8 pointée, 1/16, noire de triolet), **Reverb**, **Compresseur**, **Bitcrusher**. Double-clic sur une boîte pour ses réglages, ✕ la retire.
- **Câbler** : tirez depuis une sortie (prise de droite) vers une boîte ou vers le master. Une sortie peut aller à plusieurs endroits, une boîte peut recevoir plusieurs sources, et les boîtes peuvent s'enchaîner. Un câble qui créerait une boucle est refusé. **Clic sur un câble** pour le débrancher. Un outil qui ne va nulle part est muet : le mixeur indique où va chaque voie, sous son nom.
- **Tout sur le master** recâble chaque outil directement sur le master. L'export WAV rapide et les stems reconstruisent exactement le même câblage.

## Fenêtres des plugins

La barre sous l'en-tête ouvre et ferme les plugins, en quatre groupes : **Instruments** (Pads, TR-909, TB-303, Synthé, Synthé à oscillateurs, Platines), **Outils** (Piano roll, Éditeur de pad, Designer de kick, Designer d'effet), **Studio** (Mixeur, Câblage, Scènes, Performance, Visualiseur) et **Système** (Moniteur MIDI). Chacun s'ouvre dans une fenêtre au-dessus de la timeline :
- Chaque fenêtre a une barre de titre : le **titre** à gauche, **?** et **✕** à droite.
- La **fenêtre active** (au premier plan) est mise en valeur ; les fenêtres s'ouvrent et se ferment avec une transition 3D.
- **Déplacez**-la par sa barre de titre, **redimensionnez**-la par son coin en bas à droite ; elle **s'aimante** aux bords de l'écran et aux autres fenêtres.
- **?** ouvre l'**aide** du contenu de la fenêtre, à côté d'elle (**?** à nouveau, ✕ ou Échap la ferme).
- **✕** la ferme ; les fenêtres utilisées sont mémorisées avec leur position.
- Les outils dont on peut enregistrer les réglages (TR-909, TB-303, Synthé, Synthé à oscillateurs, Designer de kick, Mixeur, Câblage, Scènes) ont aussi des boutons **📁 / 💾** dans leur barre de titre (voir Enregistrer et ouvrir).
- Le bouton **Réorganiser les fenêtres** (quatre carrés, dans l'en-tête) les remet à leur place et à leur taille de départ.

## Synthé

[![Fenêtre Synthé : familles, presets, potentiomètres d'expression, accords, arpégiateur et générateur de nappes](docs/screenshots/synth-fr.png)](docs/screenshots/synth-fr.png)

Le clavier joue un synthé en couches pensé pour le hardcore : chaque preset empile jusqu'à 3 **couches** d'oscillateurs (scie, carré, triangle, sinus ou impulsion, chacune avec son unisson, son octave et son niveau), avec des **formants** (résonance de caisse des cordes, voyelles « a » / « o » des chœurs), un **ensemble** stéréo, l'unisson étalé dans la stéréo, et un vibrato qui arrive après un instant.

**35 presets en 10 familles** (fenêtre Synthé, ou **Maj + touche blanche** sur l'APC = preset de la famille, **Maj + do# / ré#** = famille précédente / suivante) :

| Famille | Presets |
|---|---|
| Cordes | Épiques, Sombres, Staccato, Vintage, Aiguës |
| Nappes | Thunderdome, Sombre, Chaude, De verre, Balayée |
| Chœurs | Rave, « Ooh », Sombre |
| Supersaw | Uplifting, Lead hardstyle, Nappe, Stab |
| Hoovers | Hoover, Mentasm |
| Leads | Init, Acid 303, Screech, Horn, Lead gabber |
| Basses | Distordue, Reese, Sub |
| Stabs | Rave, Belge, Coup d'orchestre |
| Claviers | Piano rave, Orgue |
| Effets | Kick accordé, Sirène, Laser |

**8 potentiomètres d'expression**, adaptés à la famille (dans la fenêtre Synthé et sur la page Synthé de l'APC) :
- cordes, nappes, chœurs, supersaw, stabs, claviers : Brillance, Résonance, Attaque, Relâche, **Largeur**, **Vibrato**, **Ensemble**, Réverb ;
- hoovers, leads, basses, effets : Brillance, Résonance, Attaque, Relâche, Saturation, **Glissé**, Désaccord, Réverb.

Double-clic sur un potentiomètre de la fenêtre Synthé pour revenir à la valeur du preset.

**Vos presets** : le menu sous les presets les liste tous par famille. Tourner un potentiomètre rend le son personnalisé ; tapez un nom, choisissez une catégorie et **Enregistrer** pour garder le vôtre (★ dans le menu), la corbeille le supprime. Un preset personnel garde son son de départ et vos 8 potentiomètres.

### Accords et arpégiateur

Sous les potentiomètres de la fenêtre Synthé :
- **Accords** : une touche joue un accord complet : mineur, majeur, sus2, sus4, mineur 7, quinte ou octave. **Dans la tonalité (fa mineur)** construit sur chaque touche l'accord juste de la gamme (fa → fa m, sol# → lab, do# → réb, ré# → mib…), pour rester accordé avec les banques.
- **Arpège** : les notes tenues (ou l'accord) sont jouées l'une après l'autre, calées sur le tempo et sur la même grille que les boucles. Vitesse 1/8, 1/16 ou 1/32 ; ordre montant, descendant, montant-descendant, aléatoire ou joué ; étendue de 1 à 3 octaves ; durée des notes ; **Tenue** garde l'arpège quand on lâche les touches (la touche suivante en commence un nouveau).
- Sur l'APC : **Maj + fa#** = type d'accord suivant, **Maj + sol#** = arpège oui / non, **Maj + la#** = vitesse de l'arpège.

Quand la timeline enregistre le synthé, les accords et les notes de l'arpège sont enregistrés aussi, dans le bloc de notes de la prise.

### Générateur de nappes

**Générateur de nappes → timeline**, dans la fenêtre Synthé, ouvre le générateur : il pose des blocs de cordes ou de nappes sur la timeline à partir d'une suite d'accords.

- **Suite d'accords** : tapez les accords séparés par des espaces ou des tirets (`Fm Db Eb Cm`, `Fm-Bbm-Db-C`…), ou cliquez sur une suite toute prête. Reconnus : majeur (`Db`), mineur (`Fm`), `7`, `m7`, `maj7`, `sus2`, `sus4`, `dim`, `aug`, `5`, `add9`, avec `#` / `b`.
- **Son** : le preset du synthé en cours, ou un preset parmi les familles cordes, nappes, chœurs, supersaw, stabs ou claviers. Chaque bloc garde **son propre preset** : vous pouvez jouer autre chose au clavier, ou changer de preset, sans changer les nappes.
- **Registre** (grave, médium, aigu), **mesures par accord** (1, 2 ou 4), **répétitions** (×1, ×2, ×4), **rythme** (tenu, chaque temps, contretemps, croches).
- **Basse** : aucune, sub (tenue), hardcore en contretemps ou reese (tenue), sur la fondamentale de chaque accord, sur une deuxième piste.
- Les accords s'enchaînent en douceur : les notes communes sont gardées et les autres bougent le moins possible.
- **▶ Écouter** joue le premier accord ; **Générer** pose les blocs à partir de la mesure de la tête de lecture, sur la première piste libre sur toute la durée, en partant de la piste armée. La timeline s'allonge si besoin.

Un bloc d'accord se manipule comme les autres : le déplacer, l'allonger, le copier (Alt), l'ouvrir dans le piano roll (double-clic) ou le supprimer.

## Synthé à oscillateurs

[![Synthé à oscillateurs : presets, trois oscillateurs, bruit / anneau / FM / enveloppe de hauteur, filtre, deux enveloppes, LFO calé sur le tempo et réglages de voix](docs/screenshots/osc-fr.png)](docs/screenshots/osc-fr.png)

Un synthé façon analogique pour fabriquer vos propres sons, à côté du synthé en couches.

- **Quel synthé joue le clavier** : le clavier de l'APC (et celui de l'ordinateur) joue le synthé de la **fenêtre active**. Cliquez sur la fenêtre Synthé à oscillateurs pour le jouer, sur la fenêtre Synthé pour revenir (le bouton **Clavier ici** montre lequel est joué). Le mode accords et l'arpégiateur marchent avec les deux.
- **3 oscillateurs** : scie, impulsion (avec sa **largeur**), triangle ou sinus ; octave, demi-ton, désaccord fin, niveau, **unisson** (jusqu'à 7 copies désaccordées, étalées en stéréo) et leur désaccord.
- **Bruit, modulation en anneau** (osc 1 × osc 2), **FM** (l'osc 3 module l'osc 1, pour les screechs et les cloches) et une **enveloppe de hauteur** (chaque note part plus haut ou plus bas et glisse jusqu'à sa hauteur : lasers, hoovers).
- **Filtre** : passe-bas, passe-haut ou passe-bande, **12 ou 24 dB**, coupure, résonance, quantité d'enveloppe (négative, elle le ferme), suivi du clavier, saturation avant le filtre.
- **Deux enveloppes ADSR** (filtre et volume), dessinées au-dessus de leurs potentiomètres.
- **LFO calé sur le tempo** : sinus, triangle, scie ou carré, de 1/1 à 1/32 avec les triolets, sur la hauteur, le filtre, la largeur d'impulsion ou le volume.
- **Voix** : polyphonique (8 notes), mono ou legato (pas de nouvelle attaque entre notes liées), glissé, largeur stéréo, volume.
- **12 presets** : hoover, screech FM, reese, lead gabber, basse acid, sub, supersaw, pluck, stab cuivré, nappe, wobble, laser, en boutons et dans un menu par catégorie (**Lead**, **Basse**, **Nappe**, **FX**). Tourner un potentiomètre rend le son personnalisé ; tapez un nom, choisissez une catégorie et **Enregistrer** pour garder le vôtre (★ dans le menu), la corbeille le supprime.
- **Potentiomètres de l'APC** : K1-K8 = coupure, résonance, enveloppe du filtre, déclin du filtre, saturation, quantité du LFO, relâche, volume (marqués à l'écran) quand la fenêtre est active.
- Il a sa propre **voie de mixage** (K7 sur les pages mixeur), se câble dans la fenêtre **Câblage** et est baissé par le **sidechain** comme le synthé. Ce que vous enregistrez dessus devient un bloc de notes avec son son, et dans le **piano roll** tout bloc de notes peut prendre un de ses presets.

## Visualiseur

[![Visualiseur, mode Paysage 3D : une grille synthwave dont le relief est le spectre, sous un soleil rayé](docs/screenshots/viz3d-fr.png)](docs/screenshots/viz3d-fr.png)

Un clin d'œil à Winamp, dans le groupe **Studio** : des visualisations de la musique qui suivent la sortie générale, faites pour être projetées en **plein écran** pendant un live.

- **Spectre** : des barres de LED des graves aux aigus (vert, jaune, rouge) avec des crêtes qui retombent doucement, et leur reflet.
- **Oscilloscope** : la forme d'onde lumineuse avec sa traînée, et une figure stéréo dans le coin.
- **Milk** : chaque image est réinjectée, zoomée et tournée, sous un cercle fait de la forme d'onde et des formes qui tournent : tourbillons et traînées qui cognent à chaque kick.
- **Vumètres** : deux vumètres à aiguille façon hi-fi (gauche / droite, avec voyants de crête) et une barre de LED par voie de mixage et pour le master.
- **Texte qui cogne** : vos propres mots (séparés par des virgules), un par mesure, écrasés sur chaque kick avec des couleurs séparées.
- **3D (WebGL)** : un **tunnel** de néons qui défile au tempo, un **paysage** synthwave dont le relief est le spectre des deux dernières mesures, un **blob** (une sphère déformée par le son), l'**hyperespace** (des étoiles qui filent vers vous, un saut à chaque kick), une **fractale 3D** (un vol dans une éponge de Menger infinie) et des **lasers** qui balaient la fumée au-dessus d'une foule qui saute.
- **Particules** (une sphère de points qui éclate à chaque kick), **barres Amiga** avec défileur sinusoïdal, **spectrogramme**, et d'autres modes 3D / GPU : **ville de spectre** (des tours de néon faites de l'historique du spectre), **mur de LED**, **metaballs**, **plasma**, **rotozoomer**, **fluide** et **réaction-diffusion**.
- **Filtres empilables** sur n'importe quel mode : **CRT**, **kaléidoscope**, **glitch** et **stroboscope** (3 flashs par seconde au plus). Changer de mode fait une transition (fondu, zoom ou bandes).
- **Potentiomètres** (à l'écran, et sur l'APC quand la fenêtre est active) : vitesse, teinte, force des flashs, sensibilité et quantité de chaque filtre.
- **Détection du drop** : quand les graves reviennent après un break, l'image explose (et change de mode en Auto).
- **Projecteur** : les visuels seuls dans une **deuxième fenêtre**, à glisser sur l'écran du projecteur et à mettre en plein écran (double-clic) pendant que vous continuez de jouer dans la fenêtre principale.
- Les couleurs avancent avec le tempo et chaque **kick** fait un flash. **Auto** change de mode toutes les 8 mesures. **Plein écran** (ou F, ou un double-clic) : un clic passe au mode suivant, Échap pour sortir. Les touches 1 à 9 et 0 choisissent le mode. Rien n'est dessiné quand la fenêtre est fermée.

## Tempo et boucles

Le tempo global (en-tête) pilote toutes les boucles. Chacune démarre sur la mesure suivante et reste calée quand vous changez le tempo. Pour vos propres boucles, indiquez leur tempo d'origine dans l'éditeur, ou cliquez sur **Auto** : le calcul suppose que le fichier dure un nombre entier de mesures. Réglez le tempo à 190 pour les banques Gabber, Hardcore, Oldschool, Mainstream et New wave : leurs boucles partagent la même tonalité (fa mineur) et les mêmes longueurs, elles restent donc calées entre elles. Les banques **Hardstyle** et **Mélodies hardstyle** sont faites à **150 BPM**, le tempo du style (leurs boucles suivent aussi le tempo global, mais sonnent le plus naturellement à 150).

**Tap** : cliquez en rythme, au moins deux fois ; chaque clic clignote et le tempo trouvé (moyenne des derniers clics) s'affiche sur le bouton.

**Métronome** (à côté du Tap) : un clic sur chaque temps de la grille, plus aigu sur le 1er temps de la mesure, avec quatre voyants qui battent la mesure. Son menu **▾** règle quand il clique (tout le temps, ou seulement pendant l'enregistrement), un **décompte d'une mesure avant REC** et son volume. Le clic part directement vers les haut-parleurs : il n'est jamais dans l'export WAV, les stems ni les enregistrements.

**CPU** (en-tête, à côté du vumètre) : deux petites barres. **Audio**, c'est la charge du moteur audio du navigateur : affichée en pourcentage quand le navigateur la mesure (rares sont ceux qui le font pour l'instant) ; sinon la barre reste sur **OK** et ne passe au rouge (**retard**) que si le moteur décroche, c'est-à-dire quand le son devient haché. **Interface**, c'est la part du temps où la page est trop occupée pour s'afficher. L'infobulle compte aussi les voix et les sons qui jouent. Si ça monte trop : coupez ou supprimez des pistes, mettez moins d'effets de piste (les effets 3D coûtent le plus), fermez le visualiseur.

## Potentiomètres

Il n'y a pas de fenêtre de potentiomètres globale : **chaque instrument a ses potentiomètres dans sa propre fenêtre** (synthé, synthé à oscillateurs, fenêtre des pads et éditeur de pad, TR-909 sous sa grille, TB-303, platines, designer de kick, visualiseur), et la table de mixage a une section **Master** (EQ du master, effets globaux et volumes).

Les 8 potentiomètres de l'APC (K1-K8) pilotent une **page** à la fois :
- la page **suit la fenêtre active** : clic sur la TB-303 et K1-K8 pilotent la TB-303, clic sur la TR-909 et ils pilotent l'instrument choisi de la 909, et ainsi de suite (synthé, synthé à oscillateurs, platines, éditeur de pad, mixeur, visualiseur) ;
- le menu **Potentiomètres APC** de l'en-tête affiche la page en cours et permet de la choisir ;
- les boutons de piste de l'APC la changent aussi (1-4 = Synthé / Effets / Pad / EQ, Maj + 1-4 = pages du mixeur, Maj + REC = TB-303 puis platines, Maj + PLAY = TR-909, SUSTAIN = EQ).

Le groupe de potentiomètres piloté par l'APC est entouré à l'écran, avec l'étiquette « APC K1-K8 ». Les pages :
- **Synthé** : les 8 potentiomètres d'expression de la famille du synthé (voir Synthé)
- **Effets** : temps, répétitions et envoi du delay, envoi et taille de la reverb, volume du synthé, volume des pads, volume général (section Master du mixeur)
- **Pad** : volume, hauteur, panoramique, filtre, point de départ, envois delay et reverb, et mode de lecture du pad sélectionné (éditeur de pad)
- **EQ** : grave 100 Hz, bas-médium 350 Hz, médium 1,2 kHz, haut-médium 3,5 kHz, aigu 9 kHz (±15 dB), passe-bas, passe-haut, gain de sortie (section Master du mixeur)
- **TR-909**, **TB-303**, **Platines**, **Oscillateurs** (voir Synthé à oscillateurs), **Visualiseur** (vitesse, teinte, flashs, sensibilité, filtres) et les quatre pages du **mixeur**.

Double-clic sur un potentiomètre à l'écran pour le remettre à zéro.

## Effets de performance

- **Rolls** (répétition) calés sur la grille : la répétition démarre sur la double-croche suivante.
- **Filtre ↓ / ↑** balaie un passe-bas ou un passe-haut sur une mesure tant que vous maintenez.
- **Tape-stop** ralentit tout jusqu'à l'arrêt.
- **Pump** fait s'effacer le synthé à chaque temps.

## Enregistrer et ouvrir

GabberKey enregistre tout automatiquement dans le navigateur, et vous pouvez aussi garder votre travail dans des **fichiers `.gabber`** (pour le sauvegarder, le passer sur un autre ordinateur ou le partager) :
- **Enregistrer le projet** (en-tête) : tout le projet dans un fichier : timeline, tempo, pads et banques, chaque outil, mixeur, câblage, scènes, fenêtres, avec vos sons et vos enregistrements dedans. **Ouvrir…** le recharge (tout est remplacé, puis l'application redémarre dessus).
- **Morceau** (boutons 📁 / 💾 de la barre de la timeline) : la timeline seule (pistes, blocs, effets de piste, longueur, tempo) avec les enregistrements qu'elle utilise. Ouvrir un morceau remplace la timeline (Ctrl+Z ramène la précédente).
- **Réglages d'un outil** : les boutons 📁 / 💾 dans la barre de titre des fenêtres TR-909 (patterns et potentiomètres), TB-303, Synthé, Synthé à oscillateurs (avec vos presets), Designer de kick, Mixeur (avec le sidechain et la section master), Câblage et Scènes.
- Chaque bouton **Ouvrir** accepte n'importe quel fichier GabberKey : il reconnaît ce qu'il contient et le charge au bon endroit. Les sons de la bibliothèque sont désignés par leur nom ; les sons importés et les enregistrements sont embarqués.

## Enregistrement et kits

- **⤓ WAV** (barre de la timeline) exporte le morceau en WAV, **calculé en quelques secondes** au lieu d'être rejoué en temps réel : de la mesure 1 à la fin du dernier bloc, avec le synthé, les pads, la table de mixage, les effets d'insert et le sidechain tels que vous les entendez (environ 3 s pour la démo d'une minute).
- **⤓ Stems** exporte chaque piste non vide dans son propre fichier WAV, sur toute la durée du morceau, le tout dans une archive ZIP, prête à être mixée dans un autre logiciel.
- **● REC** dans l'en-tête enregistre la sortie générale en direct, y compris ce que vous jouez et les effets de performance. Un second appui télécharge un fichier WAV.
- **Exporter la banque** / **Exporter tout** crée un fichier `.apckit` autonome, avec les sons et les réglages. **Importer…** le recharge : une banque va dans la banque affichée, une session remplace tout.

Vos banques, vos sons et vos réglages sont sauvegardés automatiquement dans le navigateur.

## Langue

L'interface suit la langue du navigateur : français si le navigateur est en français, anglais sinon. Pour forcer une langue, ajoutez `?lang=fr` ou `?lang=en` à l'adresse.

## Feuille de route

Ce qui est prévu, dans cet ordre :

1. **Séquenceur de pas pour n'importe quel son** : programmer les pads (kicks, claps, cris des banques…) sur une grille de 16 pas.
2. **Étirement temporel qui garde la hauteur** : les boucles suivent le tempo sans changer de tonalité (aujourd'hui, une boucle à 150 BPM jouée à 190 monte de 4 demi-tons).
3. **Sampler de voix et vocoder** : enregistrer au micro, découper, hauteur et formant, vocoder robotique du gabber.
4. **Designer de montées** : riser, bruit balayé, roulement de caisse claire et chute de sub, calés sur un nombre de mesures.
5. **Chaîne de mastering** : compresseur multibande, largeur stéréo, limiteur et vumètre en LUFS sur le master.

Ensuite : **plusieurs exemplaires** de la TB-303 et de la TR-909 (chacun câblé où vous voulez dans la fenêtre Câblage, tous synchronisés), et un **élément MIDI associé à chaque fenêtre**.

Autres idées gardées pour plus tard : un **découpeur de breaks** (un break coupé en 16 tranches sur les pads), un **designer de lead** (hoover, screech), une **TR-808**, une **entrée audio** pour réenregistrer n'importe quoi sur un pad, le **MIDI learn** pour d'autres contrôleurs, des **marqueurs, sections, zone de boucle et rampes de tempo** dans la timeline, l'enregistrement d'un outil dans la timeline **après** ses boîtes à effets, une **version en ligne** jouable sans rien installer, et un **générateur de boucles par IA** (un modèle de musique open source qui tourne sur votre machine : des boucles au tempo et dans la tonalité de la session, une couche ajoutée à votre morceau).

Les idées et suggestions sont les bienvenues dans les [issues](https://github.com/guillaumemonet/gabber-apckey25/issues).

## Compatibilité matérielle

GabberKey est développé et testé avec un **Akai APC Key 25 mk1**. Le **mk2** est pris en charge d'après la documentation MIDI d'Akai Professional, mais n'a pas encore été essayé sur un vrai appareil. Tout fonctionne aussi à la souris et au clavier de l'ordinateur.

> **Un mot pour les fabricants de matériel** 🙏
>
> Aujourd'hui, GabberKey se joue avec le seul contrôleur que je possède, un APC Key 25. Si vous fabriquez des contrôleurs MIDI, des claviers, des contrôleurs à pads ou des grooveboxes et que vous aimeriez vérifier si votre produit fonctionne avec GabberKey, je serais vraiment ravi de le rendre le plus compatible possible, et de partager librement le résultat avec toutes celles et ceux qui jouent sur vos instruments. Si vous aviez la gentillesse de prêter ou d'envoyer un appareil, n'hésitez surtout pas à me contacter en [ouvrant une issue](https://github.com/guillaumemonet/gabber-apckey25/issues) sur ce dépôt. Merci infiniment pour votre temps et votre bienveillance !

## Dépannage

| Symptôme | Solution |
|---|---|
| « Accès MIDI refusé » | Cliquez sur l'icône à gauche de l'adresse → Appareils MIDI → Autoriser, puis rechargez. |
| « Port inaccessible » | Un autre logiciel (Ableton, FL Studio…) utilise l'APC. Sous Windows, un port MIDI ne se partage pas : fermez ce logiciel et rechargez. |
| Détecté mais les pads ne font rien | Débranchez l'APC, attendez 10 secondes, rebranchez-le sur un autre port USB, puis rechargez. Le service MIDI de Windows peut cesser de transmettre après une mise en veille ou un branchement à chaud. |
| Pas de son | Cliquez d'abord sur **Démarrer** : les navigateurs bloquent le son avant un clic. |
| Une nouvelle banque de sons n'apparaît pas | Relancez `start.bat` / `start.sh`, puis rechargez. Une nouvelle banque de la bibliothèque va dans sa banque prévue si elle est vide, sinon dans la première banque vide (un message indique laquelle). |
| Voir ce qu'envoie l'APC | Ouvrez le plugin **Moniteur MIDI**. |
| La fenêtre projecteur du visualiseur ne s'ouvre pas | Le navigateur a bloqué la fenêtre pop-up : autorisez les pop-ups pour cette page (icône dans la barre d'adresse), puis recliquez sur **Projecteur**. |

## Régénérer les banques de sons (facultatif)

Le dossier `sounds/` est déjà fourni. Pour le régénérer, par exemple à un autre tempo :

```bash
python -m venv tools/.venv
tools/.venv/Scripts/pip install -r tools/requirements.txt    # Windows
# tools/.venv/bin/pip install -r tools/requirements.txt      # macOS / Linux
tools/.venv/Scripts/python tools/build_banks.py --bpm 128 --gabber-bpm 200
```

Le script travaille en deux temps :
- **Échantillons CC0** : il télécharge les échantillons de Sonic Pi, retire le silence initial et normalise le volume. Pour les boucles, il détecte le tempo, étire le son au tempo cible sans changer la hauteur (WSOLA) et coupe chaque boucle à un nombre exact de mesures.
- **Banques Gabber, Hardcore, Oldschool, Mainstream et New wave** : il les synthétise de zéro (`tools/gabber.py`).

Cliquez ensuite sur **Réinitialiser** dans l'appli (la flèche circulaire à droite de l'en-tête).

## Structure du projet

```
index.html            page
css/style.css         styles
js/main.js            point d'entrée : crée les moteurs et construit l'interface
js/app/               interface et liaisons, un module par domaine (voir docs/dev/architecture.md)
js/apc.js             détection de l'APC Key 25, lecture MIDI, LEDs (mk1 + mk2)
js/audio.js           moteur audio : synthé, sampler, effets, EQ, tempo
js/tr909.js           émulation TR-909 et séquenceur
js/acid.js            basse acid façon TB-303
js/kickdesign.js      designer de kick
js/decks.js           platines (deux decks, crossfader)
js/deck-worklet.js    lecteur à vitesse variable pour le scratch
js/timeline.js        timeline : pistes, blocs, lecture
js/trackfx.js         effets de piste (banque d'effets, PCF, 3D)
js/mixer.js           table de mixage : voies, envois, effets d'insert
js/patch.js           câblage : boîtes à effets et câbles
js/sidechain.js       sidechain (les kicks font baisser le synthé et les sons mélodiques)
js/library.js         bibliothèque de sons (catégories)
js/windows.js         fenêtres des plugins
js/zip.js             archive ZIP (stems)
js/history.js         annuler / rétablir
js/help.js            aide de chaque fenêtre (bouton ?)
js/presets.js         presets du synthé
js/performer.js       mode accords et arpégiateur
js/pianoroll.js       piano roll
js/osc.js             synthé à oscillateurs
js/visualizer.js      visualiseur (modes 2D)
js/viz3d.js           modes 3D du visualiseur (shaders WebGL)
js/project.js         fichiers .gabber (projet, morceau, réglages des outils)
js/notes.js           blocs de notes (motifs, regroupement, quantification)
js/chords.js          suites d'accords (générateur de nappes)
js/params.js          paramètres des potentiomètres
js/i18n.js            traductions anglais / français
js/kit.js             kit de départ (synthétisé)
js/kits.js            export / import de kits
js/recorder*.js       enregistrement WAV
js/storage.js         sauvegarde locale (IndexedDB)
tools/serve.py        serveur web local (sans cache)
tools/build_banks.py  construction des banques de sons
tools/gabber.py       synthèse des sons gabber
tools/icons.py        icônes des boutons (génère le CSS)
sounds/               banques générées + banks.json
tests/                tests (run.js, harness.js, check.js, specs/)
docs/dev/             documentation technique
```

## Tests

`npm test` vérifie le code (syntaxe, traductions, pages d'aide, fichiers de sons), puis lance une cinquantaine de tests dans Firefox (sans fenêtre), chacun sur un domaine de l'application : pads, instruments, timeline, effets, fichiers, platines, visualiseur, bibliothèque. Ils tournent aussi sur GitHub à chaque envoi. Il faut Node.js 18 ou plus et Firefox, rien à installer. Détails et écriture d'un test : [docs/dev/tests.md](docs/dev/tests.md).

## Crédits

- Conception et développement : **Guillaume Monet**
- Banques 2 à 6 : échantillons de [Sonic Pi](https://github.com/sonic-pi-net/sonic-pi), domaine public (CC0). Voir `sounds/CREDITS.md`.
- Banques gabber et kit de départ : synthétisés par le code de GabberKey.
- Protocole MIDI de l'APC Key 25 mk2 : documentation Akai Professional.

## Licence

Code publié sous [licence MIT](LICENSE) © 2026 Guillaume Monet. Les échantillons Sonic Pi des banques 2 à 6 restent dans le domaine public (CC0).

Akai Professional et APC sont des marques d'inMusic Brands, Inc. Roland, TR-909 et TB-303 sont des marques de Roland Corporation. GabberKey est un projet indépendant, sans lien avec ces sociétés ni soutien de leur part.
