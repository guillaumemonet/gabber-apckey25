# Mixage et effets

← [Générateur : accords et mélodie](generateur.md) · [Sommaire](README.md) · [Live : platines, scènes, visualiseur](live.md) →

Designer d'effet, table de mixage et sidechain, câblage des boîtes à effets.

## Designer d'effet

[![Designer d'effet : formes de départ, l'éditeur de courbe avec sa grille, profondeur et lissage](../screenshots/curve-fr.png)](../screenshots/curve-fr.png)

Dessinez comment un réglage d'une piste bouge sur **1, 2 ou 4 temps** : la forme se répète en boucle, calée sur le tempo, tant que son bloc dure sur la timeline (une pompe sidechain faite main, un gate trance, un wobble de filtre, un balancier de panoramique…).

- **Réglage piloté** : volume, filtre passe-bas, filtre passe-haut, panoramique, saturation, envoi reverb ou envoi delay.
- **Édition** : clic pour ajouter un point, puis glissez-le (aimanté à la grille : 1/4, 1/8, 1/16, 1/32 et triolets ; **Maj** = libre), double-clic ou clic droit sur un point pour le supprimer. Le **losange** entre deux points courbe le trait (glissez-le vers le haut ou le bas) ; double-clic dessus pour un **palier** : la valeur reste jusqu'au point suivant.
- **Profondeur** ramène la courbe vers « sans effet » (en pointillés), **Lissage** arrondit les paliers pour qu'ils ne claquent jamais. Pour les filtres, la coupure extrême et la résonance.
- **Écouter** joue une boucle de la bibliothèque (batterie, basse, cordes ou hoover) à travers la courbe, avec une tête de lecture : chaque retouche s'entend tout de suite.
- **14 formes de départ** : pompe sidechain, pompe double, gate trance, gate 3-3-2, stutter 1/32, respiration, wobble filtre, dent de scie filtre, balayage passe-haut, ping-pong, balancier, impulsion saturée, queue de reverb, écho à contretemps. Modifiez-en une, puis **Enregistrer dans la bibliothèque** : elle devient votre courbe.
- **Sur la timeline** : vos courbes sont dans la bibliothèque, **Effets › Courbes**. Glissez-en une sur une piste comme un effet de piste, ou cliquez sur **Sur la timeline** (à la tête de lecture, sur la piste du bloc sélectionné). Le bloc montre la forme. Retoucher votre courbe change tous ses blocs d'un coup, même pendant la lecture ; double-clic sur un bloc de courbe pour l'ouvrir dans le designer.
- Vos courbes sont sauvegardées avec le projet, voyagent dans les fichiers morceau et sont dans l'export WAV et les stems.

## Table de mixage

[![Table de mixage : voies, effets d'insert et sidechain, avec les effets de performance](../screenshots/mixer-fr.png)](../screenshots/mixer-fr.png)

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

[![Fenêtre Câblage : les outils à gauche, les boîtes à effets au milieu, le master à droite](../screenshots/patch-fr.png)](../screenshots/patch-fr.png)

- À gauche, un bloc par **outil** : pads, synthé, TR-909, timeline, TB-303, platines, synthé à oscillateurs. Chaque outil garde sa **voie de mixage** (volume, pano, muet, solo, effets d'insert, envois) ; le câblage décide où va cette voie. À droite, le **Master**.
- **Boîtes à effets** : **Distorsion** (drive, les 5 formes de la 909, tonalité, mélange), **PCF** (filtre rythmique LP / BP relancé par un motif de 16 pas, toujours calé sur la grille du tempo), **Filtre** (LP, HP ou BP avec un LFO calé sur le tempo), **Delay** (en valeurs de note : 1/4, 1/8, 1/8 pointée, 1/16, noire de triolet), **Reverb**, **Compresseur**, **Bitcrusher**. Double-clic sur une boîte pour ses réglages, ✕ la retire.
- **Câbler** : tirez depuis une sortie (prise de droite) vers une boîte ou vers le master. Une sortie peut aller à plusieurs endroits, une boîte peut recevoir plusieurs sources, et les boîtes peuvent s'enchaîner. Un câble qui créerait une boucle est refusé. **Clic sur un câble** pour le débrancher. Un outil qui ne va nulle part est muet : le mixeur indique où va chaque voie, sous son nom.
- **Tout sur le master** recâble chaque outil directement sur le master. L'export WAV rapide et les stems reconstruisent exactement le même câblage.

---

← [Générateur : accords et mélodie](generateur.md) · [Sommaire](README.md) · [Live : platines, scènes, visualiseur](live.md) →
