# Fichiers et enregistrement

← [Live : platines, scènes, visualiseur](live.md) · [Sommaire](README.md) · [Dépannage](depannage.md) →

Enregistrer et ouvrir projets, morceaux et réglages ; export WAV et stems ; kits ; fichiers MIDI et modules de tracker.

## Enregistrer et ouvrir

GabberKey enregistre tout automatiquement dans le navigateur, et vous pouvez aussi garder votre travail dans des **fichiers `.gabber`** (pour le sauvegarder, le passer sur un autre ordinateur ou le partager) :
- **Enregistrer le projet** (en-tête) : tout le projet dans un fichier : timeline, tempo, pads et banques, chaque outil, mixeur, câblage, scènes, fenêtres, avec vos sons et vos enregistrements dedans. **Ouvrir…** le recharge (tout est remplacé, puis l'application redémarre dessus).
- **Morceau** (boutons 📁 / 💾 de la barre de la timeline) : la timeline seule (pistes, blocs, effets de piste, longueur, tempo) avec les enregistrements qu'elle utilise. Ouvrir un morceau remplace la timeline (Ctrl+Z ramène la précédente).
- **Réglages d'un outil** : les boutons 📁 / 💾 dans la barre de titre des fenêtres TR-909 (patterns et potentiomètres), TB-303, Synthé, Synthé à oscillateurs (avec vos presets), Designer de kick, Mixeur (avec le sidechain et la section master), Câblage, Scènes, Générateur, Breizh generator, Designer de montée, Générateur de voix, Correction de justesse, Designer d'effet (vos courbes), Platines (avec leurs sons), Lanceur, Bus, Visualiseur et MIDI (commandes apprises, appareils, horloge). Dans les fenêtres **Pads** et **Banques**, 📁 / 💾 ouvrent et enregistrent la banque (fichier `.apckit`, voir plus bas).
- Chaque bouton **Ouvrir** accepte n'importe quel fichier GabberKey : il reconnaît ce qu'il contient et le charge au bon endroit. Les sons de la bibliothèque sont désignés par leur nom ; les sons importés et les enregistrements sont embarqués.

## Enregistrement et kits

- **⤓ WAV** (barre de la timeline) exporte le morceau en WAV, **calculé en quelques secondes** au lieu d'être rejoué en temps réel : de la mesure 1 à la fin du dernier bloc, avec le synthé, les pads, la table de mixage, les effets d'insert et le sidechain tels que vous les entendez (environ 3 s pour la démo d'une minute).
- **⤓ Stems** exporte chaque piste non vide dans son propre fichier WAV, sur toute la durée du morceau, le tout dans une archive ZIP, prête à être mixée dans un autre logiciel. Les stems sortent **sans la chaîne master** (ni compresseur ni limiteur) : c'est au mixage final d'en décider.
- À la fin d'un export WAV, le message donne la **sonie intégrée** du fichier (en LUFS) et sa **crête** ; elles restent affichées dans la chaîne master du mixeur.
- **● REC** dans l'en-tête enregistre la sortie générale en direct, y compris ce que vous jouez et les effets de performance. Un second appui télécharge un fichier WAV.
- 💾 (barre de titre des fenêtres **Pads** et **Banques**) enregistre la banque, **Tout exporter** (fenêtre Banques) toute la session, dans un fichier `.apckit` autonome, avec les sons et les réglages. 📁 le recharge : une banque va dans la banque affichée, une session remplace tout.

Vos banques, vos sons et vos réglages sont sauvegardés automatiquement dans le navigateur.

## Fichiers MIDI

- **MIDI** (barre de la timeline, à côté de WAV et Stems) exporte les **blocs de notes** dans un fichier `.mid`, au tempo du morceau, à ouvrir dans n'importe quel autre logiciel : une piste MIDI par piste de la timeline (motifs dépliés sur toute la longueur des blocs, transpositions comprises). Les coups de pads posés sur la timeline vont sur le **canal 10** (notes 36 et suivantes). Un fichier MIDI contient des notes, pas des sons : les blocs audio n'y sont pas.
- **Ouvrir…** (en-tête ou timeline) importe aussi un fichier `.mid` : chaque piste du fichier devient un **bloc de notes**, posé à la mesure de la tête de lecture, sur une piste libre pendant sa durée (des pistes sont ajoutées s'il en manque). Les blocs jouent avec le synthé du clavier ; retouchez-les dans le piano roll ou choisissez leur son dans son menu. Le tempo du morceau ne change pas (celui du fichier est indiqué).

## Modules de tracker (.mod, .xm)

**Ouvrir…** importe aussi les modules des trackers d'Amiga et de PC : `.mod` (ProTracker et compatibles, de 4 à 32 voies) et `.xm` (FastTracker 2).
- Les **samples** du module vont sur les pads de la **première banque vide** (à partir de la banque affichée), avec leur nom ; ils rejoignent aussi « Mes sons » dans la bibliothèque. Un module de plus de 40 samples prend plusieurs banques à la suite.
- Chaque **voie** du module devient un **bloc de notes** joué par l'**instrument échantillon** : il joue le son d'un pad à la hauteur de chaque note, avec sa boucle (les boucles aller-retour comprises). Les blocs sont posés à la mesure de la tête de lecture, sur des pistes libres.
- Le **tempo** du module est repris si la timeline est vide (4 lignes par temps à la vitesse de départ) ; sinon le morceau garde le sien et les notes sont recalées pour garder la même durée.
- Le morceau est rejoué tick par tick comme dans le tracker : vitesse et tempo, ordre des patterns, sauts, fins et répétitions de pattern, volumes, glissements de volume et de hauteur, glissement vers la note, vibrato, trémolo, arpèges, départ dans le sample, notes coupées, retardées et rejouées, panoramique, volume global, et les **enveloppes de volume** des instruments XM. Ces mouvements sont gardés dans chaque note. Les effets rares qui ne sont pas joués sont comptés dans le message de fin d'import.
- Dans le **piano roll**, le menu des sons d'un de ces blocs montre **Samples du module (pads)** : choisissez un autre son pour le jouer avec un synthé, revenez-y quand vous voulez. Remplacer le son d'un pad change aussi l'instrument dans les blocs qui le jouent.

## Entrée audio (micro, carte son)

- La fenêtre **Entrée audio** (barre des plugins, groupe Système) : **Activer l'entrée** (le navigateur demande l'autorisation la première fois), choix de l'**appareil** (micro, entrée de carte son), **niveau** et vumètre.
- **Enregistrer** : choisissez **Entrée audio** comme source d'une piste armée (panneau de la piste) ou dans **Enregistrer**, puis **REC**. La prise devient un bloc audio (et un son de la rubrique Enregistrements), comme celles de la TR-909 ou des platines ; elle peut être enregistrée en même temps que d'autres pistes.
- **Latence** : en jouant par-dessus le morceau, vous l'entendez un peu en retard, et l'entrée arrive elle aussi en retard. La prise est recalée de cette latence pour tomber en place : **automatique** par défaut (d'après ce qu'annonce le navigateur), ou réglée à la main si une prise reste un peu en retard ou en avance.
- **Écoute de retour** : envoie l'entrée vers les haut-parleurs (par la voie Timeline du mixeur). Laissez-la coupée avec un micro près des haut-parleurs : larsen.

---

← [Live : platines, scènes, visualiseur](live.md) · [Sommaire](README.md) · [Dépannage](depannage.md) →
