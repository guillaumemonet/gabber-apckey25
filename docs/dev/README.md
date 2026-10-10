# Documentation technique

Pour qui veut comprendre ou modifier le code de GabberKey.

- [Architecture du code](architecture.md) : les deux couches (moteurs et application), le rôle de chaque module de `js/app/`, les règles d'import et de partage des variables.
- [Tests](tests.md) : lancer les tests, en écrire un.
- Banques de sons : voir [Régénérer les banques de sons](../manuel/depannage.md#régénérer-les-banques-de-sons-facultatif) dans le manuel.

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
js/chords.js          suites d'accords (générateur)
js/melody.js          générateur de mélodie (lead)
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
