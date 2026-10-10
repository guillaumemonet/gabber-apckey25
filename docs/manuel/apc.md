# Le contrôleur APC Key 25

← [Premiers pas](demarrage.md) · [Sommaire](README.md) · [Pads et banques](pads.md) →

Ce que fait chaque bouton de l'APC, les potentiomètres K1-K8 et les effets de performance.

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

## Autres claviers MIDI et MIDI learn

L'APC Key 25 n'est pas le seul appareil possible : **n'importe quel clavier ou contrôleur MIDI** branché en USB (sans pilote pour la plupart) est reconnu, en même temps que l'APC. La fenêtre **MIDI** (barre des plugins, groupe Système) les liste.

- **Ses touches** jouent le synthé de la fenêtre active, comme le clavier de l'APC (accords, arpégiateur, enregistrement dans la timeline compris) ; **sa pédale de sustain** tient les notes.
- **MIDI learn** : dans la fenêtre MIDI, cliquez sur **Apprendre** à côté d'une cible, puis tournez un potentiomètre, bougez un fader ou appuyez sur un bouton de l'appareil. Échap annule ; la corbeille retire une assignation.
- **Cibles** : les potentiomètres **K1 à K8 de la page active** (exactement comme ceux de l'APC : synthé, effets, pads, mixeur…), les **faders du mixeur**, le **volume général**, les **volumes des bus**, et le transport : **lecture / arrêt**, **arrêt**, **enregistrer**, **boucle**.
- Une commande ne pilote qu'une cible (la réassigner la retire de l'ancienne). Une touche ou un pad assigné à un bouton ne joue plus de note.
- Les assignations sont enregistrées avec le projet. En bas de la fenêtre, le **moniteur** affiche les derniers messages reçus de chaque appareil.

---

← [Premiers pas](demarrage.md) · [Sommaire](README.md) · [Pads et banques](pads.md) →
