# Instruments

← [Timeline, bibliothèque et piano roll](timeline.md) · [Sommaire](README.md) · [Générateur : accords et mélodie](generateur.md) →

TR-909, TB-303, synthé en couches, synthé à oscillateurs et designer de kick.

## TR-909

[![Fenêtre TR-909 : séquenceur 16 pas, et les potentiomètres avec la distorsion par instrument](../screenshots/tr-fr.png)](../screenshots/tr-fr.png)

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

## TB-303

[![Fenêtre TB-303 : grille avec octaves, accents et slides, et ses potentiomètres](../screenshots/acid-fr.png)](../screenshots/acid-fr.png)

Une ligne de basse acid façon Roland TB-303, synthétisée en direct : oscillateur (scie ou carré), filtre passe-bas 24 dB résonant piloté par une enveloppe, accent, slide, puis distorsion avec les 5 formes de la 909.

- **Grille** : 16 pas (doubles-croches) × une octave de fa à fa aigu. Clic sur une case pour poser une note, un second clic pour un silence. Les lignes **Oct + / Oct −** décalent un pas d'une octave, **Accent** le rend plus fort avec un filtre plus claquant, **Slide** glisse vers la note suivante sans relancer l'enveloppe (le fameux « squelch »).
- **Presets de son** : 15 sons tout prêts en 4 catégories : **Acid** (classique, squelch, screamer, Rotterdam, hoover), **Basse** (caoutchouc, sub, roulante sombre), **Lead** (lead scie, couinement, lead gabber) et **FX** (laser, sirène, écrasée, zap). Tourner un potentiomètre rend le son personnalisé ; donnez-lui un nom et une catégorie puis **Enregistrer** pour garder vos propres presets (★), enregistrés avec la session et dans les fichiers de réglages de la TB-303.
- **Potentiomètres** : accord, coupure, résonance, quantité d'enveloppe, déclin, accent, **slide** (durée du glissé entre notes liées), drive, forme, volume. Sur l'APC, **Maj + REC** ouvre la page de potentiomètres TB-303 (K1 coupure … K8 volume).
- **8 patterns**, dont 4 tout prêts en fa mineur (acid gabber, roulement de doubles-croches, glissés « squelch », minimal à contretemps). Un changement de pattern attend la mesure suivante. **Aléatoire** écrit une nouvelle ligne acid en fa mineur ; **Effacer** vide le pattern.
- **Suivre la 909** (activé par défaut) : la 303 joue sur l'horloge de la TR-909, shuffle compris, et ▶ lance les deux. Désactivez-le pour jouer la 303 seule, sur la grille des mesures des boucles.
- **Saisie** : activez **Saisie** et jouez la ligne au clavier de l'APC (ou de l'ordinateur). Chaque note va dans le pas choisi et le curseur avance ; une frappe forte ajoute un accent, **Silence** laisse un pas vide, un clic sur un numéro de pas déplace le curseur.
- La 303 a sa propre **voie de mixage** (K5 sur les pages de potentiomètres du mixeur), est baissée par le **sidechain** avec les sons mélodiques, est gardée dans les **scènes** (pattern et marche) et peut être **enregistrée** en audio dans la timeline (source TB-303).

## Synthé

[![Fenêtre Synthé : familles, presets, potentiomètres d'expression, accords et arpégiateur](../screenshots/synth-fr.png)](../screenshots/synth-fr.png)

Le clavier joue un synthé en couches pensé pour le hardcore : chaque preset empile jusqu'à 3 **couches** d'oscillateurs (scie, carré, triangle, sinus ou impulsion, chacune avec son unisson, son octave et son niveau), avec des **formants** (résonance de caisse des cordes, voyelles « a » / « o » des chœurs), un **ensemble** stéréo, l'unisson étalé dans la stéréo, et un vibrato qui arrive après un instant.

**40 presets en 11 familles** (fenêtre Synthé, ou **Maj + touche blanche** sur l'APC = preset de la famille, **Maj + do# / ré#** = famille précédente / suivante) :

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
| Breizh | Bombarde, Biniou kozh, Cornemuse, Bagad (pupitre), Bourdon |
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

## Synthé à oscillateurs

[![Synthé à oscillateurs : presets, trois oscillateurs, bruit / anneau / FM / enveloppe de hauteur, filtre, deux enveloppes, LFO calé sur le tempo et réglages de voix](../screenshots/osc-fr.png)](../screenshots/osc-fr.png)

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

## Designer de kick

[![Designer de kick : presets, 12 potentiomètres et la forme d'onde](../screenshots/kick-fr.png)](../screenshots/kick-fr.png)

Fabriquez votre propre kick gabber / hardcore, calculé par le navigateur en quelques millisecondes à partir de 12 potentiomètres :

- **Presets** : Rotterdam, Mainstream, Uptempo, Raw, Terror, Industrial, Early, Frenchcore (boutons), aussi dans un menu par catégorie (Gabber, Hardcore, Mainstream / uptempo) avec vos propres kicks. Tourner un potentiomètre rend le son personnalisé ; tapez un nom, choisissez une catégorie et **Enregistrer** pour garder le vôtre (★ dans le menu), la corbeille le supprime.
- **Queue** : **Note** (accordée avec les banques), **Punch** et **Chute** (de combien la hauteur part haut et à quelle vitesse elle tombe), **Plongée** (de combien elle continue de descendre), **Longueur**, **Zaag** (scie pour la queue brute et bourdonnante des kicks uptempo).
- **Distorsion** : **Drive** et **Forme** (les 5 formes de la 909), puis **Formant** et **Mordant**, qui font « parler » la queue.
- **Attaque** : **Clic** (bruit) et **Attaque** (couche courte et percutante).
- **Écoute auto** joue le kick à chaque potentiomètre relâché ; la forme d'onde et la longueur s'affichent.
- **→ Pad** le met sur le pad sélectionné, **→ Bibliothèque** l'ajoute à la catégorie **Kicks** de la bibliothèque (à glisser sur la timeline ; clic droit dessus pour le retirer), **⤓ WAV** le télécharge. Vos kicks déclenchent le sidechain comme les autres.

---

← [Timeline, bibliothèque et piano roll](timeline.md) · [Sommaire](README.md) · [Générateur : accords et mélodie](generateur.md) →
