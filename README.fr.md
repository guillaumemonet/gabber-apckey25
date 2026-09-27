# GabberKey

**Une groovebox hardcore / gabber pour l'Akai APC Key 25, qui tourne dans le navigateur.**

*Par Guillaume Monet* · [English version](README.md)

GabberKey transforme l'Akai APC Key 25 (mk1 ou mk2) en instrument autonome. Il n'y a ni logiciel de musique, ni plugin, ni rien à installer à part un navigateur :

- **Sampler 40 pads** avec 10 banques, des LEDs synchronisées avec l'écran, et le glisser-déposer de tes propres sons
- **358 sons prêts à jouer** :
  - quatre **banques hardcore / gabber synthétisées** : kicks Rotterdam et terror distordus, hoovers, stabs rave, screeches, basses hardcore, cordes dramatiques, pianos rave oldschool, breakbeats, effets et boucles à 190 BPM ;
  - cinq banques d'échantillons **libres de droits (CC0)**.
- **Émulation TR-909** : les 11 instruments synthétisés en direct, avec une **distorsion par instrument (drive + 5 formes)** sur les potentiomètres et un séquenceur 16 pas (8 patterns) calé sur les boucles.
- **Table de mixage** : une voie par outil (pads, synthé, TR-909) avec volume, panoramique, envois delay et reverb, muet / solo, vumètres et jusqu'à 4 effets d'insert (distorsion, filtre, compresseur, reverb).
- **Espace de travail en grille magnétique** : chaque panneau d'outil se déplace et se redimensionne ; la disposition est sauvegardée.
- **Synthé polyphonique** au clavier, avec 8 presets gabber : Hoover, Acid 303, Screech, Stab rave, Basse distordue, Horn, Kick accordé…
- **Boucles synchronisées** : chaque boucle démarre sur la mesure suivante et suit le tempo global (avec un bouton Tap).
- **Effets de performance** : rolls (répétitions de 1/4 à 1/32), balayages de filtre, tape-stop, pump.
- **Égaliseur général** (5 bandes + passe-bas / passe-haut) sur les potentiomètres, ouvert avec le bouton SUSTAIN.
- **Enregistrement WAV** de ta session.
- **Export / import de kits** : partage une banque ou une session complète dans un seul fichier.
- Interface en **français ou en anglais**, selon la langue du navigateur.

---

## Prérequis

- Un **Akai APC Key 25**, mk1 ou mk2. Il est facultatif : tout marche aussi à la souris et au clavier de l'ordinateur.
- **Google Chrome**, **Microsoft Edge** ou **Firefox** (version 108 ou plus). Safari ne gère pas le Web MIDI.
- **Python 3**, uniquement pour servir la page en local (le Web MIDI exige `localhost` ou HTTPS).

## Installation

```bash
git clone https://github.com/guillaumemonet/gabber-apckey25.git
cd gabber-apckey25
```

Ou télécharge le ZIP depuis GitHub et décompresse-le.

## Lancement

1. Branche l'APC Key 25.
2. Lance le serveur local :
   - **Windows** : double-clic sur `start.bat`.
   - **macOS / Linux** : `./start.sh`.
   - **Partout** : `python tools/serve.py`, puis ouvre http://localhost:8025.
3. Dans le navigateur, clique sur **Démarrer**, puis **autorise les appareils MIDI** quand le navigateur le demande.

L'en-tête affiche **APC Key 25 (mk1)** ou **APC Key 25 mk2** avec un point vert quand le contrôleur est détecté.

## Commandes sur l'APC

| Contrôle | Action |
|---|---|
| **Pads** | Jouer le son (le dernier pad frappé devient le pad sélectionné) |
| **Maj + pad** | Sélectionner un pad sans le jouer |
| **SCENE LAUNCH 1-5** | Banques 1-5 · **Maj +** SCENE LAUNCH = banques 6-10 |
| **Boutons de piste 1 / 2 / 3 / 4** | Page des potards : Synthé / Effets / Pad sélectionné / EQ |
| **Boutons de piste 5 / 6 / 7 / 8** (maintenus) | Roll 1/8 · Roll 1/16 · Roll 1/32 · Filtre ↓ |
| **Maj + piste 5 / 6 / 7 / 8** | Roll 1/4 · Tape-stop · Filtre ↑ · Pump (marche/arrêt) |
| **Maj + piste 1 / 2 / 3 / 4** | Page de potards du mixeur : volumes / panos / envois delay / envois reverb (K1 Pads, K2 Synthé, K3 TR-909, K8 master) |
| **Potards K1-K8** | Paramètres de la page active (Maj = réglage fin) |
| **SUSTAIN** | Ouvre / ferme la page EQ (maintenu : EQ le temps de l'appui) |
| **Maj + touche du piano** | Preset du synthé : do Hoover, ré Acid 303, mi Screech, fa Stab rave, sol Basse dist., la Horn, si Kick accordé, do# Init |
| **Clavier** | Joue le synthé |
| **PLAY** | Lancer / arrêter le séquenceur TR-909 |
| **Maj + PLAY** | Transformer la grille de pads en TR-909 (et revenir) |
| **REC** | Démarrer / arrêter l'enregistrement (télécharge un WAV) |
| **STOP ALL CLIPS** | Coupe tout |

**LEDs** : un pad chargé prend sa couleur, et un son en cours est allumé à fond ou clignote. Le mk1 n'a que trois couleurs (rouge, vert, jaune), donc le sélecteur de couleur n'affiche que celles-là quand un mk1 est branché.

Tout se fait aussi à la souris. Sur le clavier de l'ordinateur, la rangée du milieu joue des notes (Q S D F… en AZERTY) et **W / X** changent d'octave.

## Banques

| Banque | Contenu |
|---|---|
| 1 | Kit de départ, synthétisé dans le navigateur |
| 2 | Batterie |
| 3 | Électro |
| 4 | Boucles (22 boucles à 120 BPM) |
| 5 | Textures et basses |
| 6 | Tabla et divers |
| 7 | **Gabber** : 8 kicks (Rotterdam, Early, Terror, Industrial, Frenchcore, Reverse…), percussions, hoovers, stabs, screeches, boucles à 190 BPM |
| 8 | **Gabber 2** : kicks accordés de do à sol, effets (montée, descente, laser, impact…), 16 boucles, stabs rave |
| 9 | **Hardcore** : kicks plus durs (terror, uptempo, speedcore, industrial, mainstream…), basses distordues, accords de cordes (Fm, Db, Eb, Cm, Bbm, Ab), staccato et coup d'orchestre, boucles cordes / basse (ostinato, progression, offbeat, roulante, reese, morceau complet de 4 mesures) et boucles de batterie hardcore, le tout à 190 BPM |
| 10 | **Oldschool** (rave / hardcore début 90) : kicks 909 et 808, kit de breakbeat, pianos rave façon M1 (Fm, Db, Eb, Cm, Bbm, Ab), stabs Mentasm et belge, chœur « ahh », vox stab, sifflet, sirène d'alerte, break façon Amen et break découpé, riff de piano, arpège rave, morceau oldschool de 4 mesures, le tout à 190 BPM |

Pour charger ton propre son, glisse un fichier audio (WAV, MP3, FLAC, OGG…) sur un pad ou sur l'éditeur, ou utilise **Charger un son…**. Dans l'éditeur, tu peux aussi régler le nom, la couleur de la LED et le mode de lecture (**One-shot**, **Maintien** ou **Boucle**).

## TR-909

Une émulation de la Roland TR-909 avec ses 11 instruments : grosse caisse, caisse claire, 3 toms, rim shot, clap, charley fermé et ouvert, crash, ride. Chacun est synthétisé en direct, comme les circuits analogiques de la machine d'origine.

**Potentiomètres** (page TR-909, ouverte par Maj + PLAY ou l'onglet « TR-909 ») :

| K1-K4 | K5 | K6 | K7 | K8 |
|---|---|---|---|---|
| Paramètres de l'instrument choisi (ex. BD : Accord, Attaque, Déclin, Niveau) | **Drive** : quantité de distorsion | **Forme** : Douce, Dure, Lampe, Repli (wavefolder), Crush (réduction de bits) | Shuffle | Volume 909 |

Chaque instrument a sa propre distorsion. La grosse caisse démarre avec une saturation « Lampe », pour le son gabber. La quantité d'accent se règle avec le curseur à l'écran.

**Séquenceur** : 16 pas et 8 patterns, dont 4 préréglés (gabber, rave, breakbeat, roulement de grosse caisse). Il suit le même tempo et la même grille de mesures que les boucles, donc il reste calé avec elles. Un changement de pattern attend la mesure suivante. À l'écran, un clic sur un pas fait défiler note → accent → silence, et un clic sur le nom d'un instrument le joue et le sélectionne.

**Grille de l'APC en mode 909** (Maj + PLAY) :

| Rangée | Pads |
|---|---|
| 1-2 | Les 16 pas de l'instrument choisi (rouge = tête de lecture, vert = note, jaune = accent) |
| 3 | BD, SD, LT, MT, HT, RS, HC, CH : jouer et sélectionner |
| 4 | OH, CR, RD, puis **Accent** (les pas posés sont accentués), **Effacer** (vide l'instrument), **Muet** |
| 5 | Patterns 1 à 8 |

Un appui sur un bouton SCENE LAUNCH ramène la grille aux pads du sampler.

## Table de mixage

Une voie par outil : **Pads**, **Synthé** et **TR-909**, puis le master (effets de performance, égaliseur général et limiteur). Le niveau de chaque son reste dans son outil (volume des pads, niveaux des instruments de la 909) ; la table de mixage équilibre les outils entre eux.

Chaque voie a des effets d'insert (**+ FX**, jusqu'à 4, appliqués dans l'ordre), des envois reverb et delay, un panoramique, un fader (0 dB aux trois quarts), **M**uet, **S**olo et un vumètre. Effets disponibles :
- **Distorsion** : drive et les 5 formes de la 909.
- **Filtre** : passe-bas ou passe-haut, coupure et résonance.
- **Compresseur** : seuil, ratio et gain.
- **Reverb** : taille et dosage.

Double-clic sur un réglage pour le remettre à zéro. Sur l'APC, **Maj + bouton de piste 1 / 2 / 3 / 4** transforme les potards en volumes / panoramiques / envois delay / envois reverb du mixeur : K1 = Pads, K2 = Synthé, K3 = TR-909, K8 = volume général. Les réglages du mixeur sont sauvegardés et inclus dans les exports de session.

## Espace de travail

Chaque outil (pads, éditeur de pad, potentiomètres, performance, TR-909, table de mixage, clavier, moniteur MIDI) est un panneau posé sur une **grille magnétique** de 12 colonnes :
- **Déplacer** un panneau : tire-le par sa barre de titre. Il se cale sur la grille, et les panneaux qui gênent descendent.
- **Redimensionner** : utilise la poignée dans son coin en bas à droite (les pads grandissent avec leur panneau).
- Les panneaux ne se chevauchent jamais et remontent pour combler les vides. Ta disposition est sauvegardée.
- **Disposition par défaut** (en-tête) remet tout en place. Sur un écran étroit, les panneaux sont simplement empilés.

## Tempo et boucles

Le tempo global (en-tête, ou bouton **Tap**) pilote toutes les boucles. Chacune démarre sur la mesure suivante et reste calée quand tu changes le tempo. Pour tes propres boucles, indique leur tempo d'origine dans l'éditeur, ou clique sur **Auto** : le calcul suppose que le fichier dure un nombre entier de mesures. Règle le tempo à 190 pour les banques Gabber, Hardcore et Oldschool : leurs boucles partagent la même tonalité (fa mineur) et les mêmes longueurs, elles restent donc calées entre elles.

## Pages des potentiomètres

- **Synthé** : onde, désaccord, coupure, résonance, enveloppe de filtre, attaque, relâche, volume
- **Effets** : temps, répétitions et envoi du delay, envoi et taille de la reverb, saturation, volume des pads, volume général
- **Pad** : volume, hauteur, panoramique, filtre, point de départ, envois delay et reverb, et mode de lecture du pad sélectionné
- **EQ** : grave 100 Hz, bas-médium 350 Hz, médium 1,2 kHz, haut-médium 3,5 kHz, aigu 9 kHz (±15 dB), passe-bas, passe-haut, gain de sortie

Double-clic sur un potard à l'écran pour le remettre à zéro.

## Effets de performance

- **Rolls** (répétition) calés sur la grille : la répétition démarre sur la double-croche suivante.
- **Filtre ↓ / ↑** balaie un passe-bas ou un passe-haut sur une mesure tant que tu maintiens.
- **Tape-stop** ralentit tout jusqu'à l'arrêt.
- **Pump** fait s'effacer le synthé à chaque temps.

## Enregistrement et kits

- **● REC** (ou le bouton REC de l'APC) enregistre la sortie générale. Un second appui télécharge un fichier WAV.
- **Exporter la banque** / **Exporter tout** crée un fichier `.apckit` autonome, avec les sons et les réglages. **Importer…** le recharge : une banque va dans la banque affichée, une session remplace tout.

Tes banques, tes sons et tes réglages sont sauvegardés automatiquement dans le navigateur.

## Langue

L'interface suit la langue du navigateur : français si le navigateur est en français, anglais sinon. Pour forcer une langue, ajoute `?lang=fr` ou `?lang=en` à l'adresse.

## Dépannage

| Symptôme | Solution |
|---|---|
| « Accès MIDI refusé » | Clique sur l'icône à gauche de l'adresse → Appareils MIDI → Autoriser, puis recharge. |
| « Port inaccessible » | Un autre logiciel (Ableton, FL Studio…) utilise l'APC. Sous Windows, un port MIDI ne se partage pas : ferme ce logiciel et recharge. |
| Détecté mais les pads ne font rien | Débranche l'APC, attends 10 secondes, rebranche-le sur un autre port USB, puis recharge. Le service MIDI de Windows peut cesser de transmettre après une mise en veille ou un branchement à chaud. |
| Pas de son | Clique d'abord sur **Démarrer** : les navigateurs bloquent le son avant un clic. |
| Une nouvelle banque de sons n'apparaît pas | Relance `start.bat` / `start.sh`, puis recharge. Une nouvelle banque de la bibliothèque va dans sa banque prévue si elle est vide, sinon dans la première banque vide (un message indique laquelle). |
| Voir ce qu'envoie l'APC | Ouvre le **Moniteur MIDI** en bas de page. |

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
- **Banques Gabber, Hardcore et Oldschool** : il les synthétise de zéro (`tools/gabber.py`).

Clique ensuite sur **Réinitialiser** dans l'appli.

## Structure du projet

```
index.html            page
css/style.css         styles
js/main.js            interface et liaisons
js/apc.js             détection de l'APC Key 25, lecture MIDI, LEDs (mk1 + mk2)
js/audio.js           moteur audio : synthé, sampler, effets, EQ, tempo
js/tr909.js           émulation TR-909 et séquenceur
js/mixer.js           table de mixage : voies, envois, effets d'insert
js/layout.js          espace de travail en grille magnétique
js/presets.js         presets du synthé
js/params.js          paramètres des potards
js/i18n.js            traductions anglais / français
js/kit.js             kit de départ (synthétisé)
js/kits.js            export / import de kits
js/recorder*.js       enregistrement WAV
js/storage.js         sauvegarde locale (IndexedDB)
tools/serve.py        serveur web local (sans cache)
tools/build_banks.py  construction des banques de sons
tools/gabber.py       synthèse des sons gabber
sounds/               banques générées + banks.json
```

## Crédits

- Conception et développement : **Guillaume Monet**
- Banques 2 à 6 : échantillons de [Sonic Pi](https://github.com/sonic-pi-net/sonic-pi), domaine public (CC0). Voir `sounds/CREDITS.md`.
- Banques gabber et kit de départ : synthétisés par le code de GabberKey.
- Protocole MIDI de l'APC Key 25 mk2 : documentation Akai Professional.

## Licence

Code publié sous [licence MIT](LICENSE) © 2026 Guillaume Monet. Les échantillons Sonic Pi des banques 2 à 6 restent dans le domaine public (CC0).
