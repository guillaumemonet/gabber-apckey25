# Architecture du code

GabberKey est une page web sans étape de compilation : des modules JavaScript (ES modules) chargés tels quels par le navigateur. Il n'y a aucune dépendance à installer.

## Deux couches

- **Les moteurs** (`js/*.js`) : le son et les données, sans interface. Chacun est autonome et ne connaît pas les autres : `audio.js` (synthé, sampler, effets du master), `timeline.js` (lecture des pistes), `tr909.js`, `acid.js`, `decks.js`, `mixer.js`, `trackfx.js`, `osc.js`, etc.
- **L'application** (`js/main.js` et `js/app/*.js`) : l'interface, le contrôleur APC et les liaisons entre les moteurs. Un module par domaine.

`js/main.js` est le point d'entrée : au clic sur « Démarrer », il crée les moteurs, les relie (table de mixage, sidechain, câblage), puis construit chaque fenêtre.

## Modules de l'application (`js/app/`)

| Module | Rôle |
|---|---|
| `core.js` | Socle partagé : l'état (`state`), les moteurs créés au démarrage, constantes et petits utilitaires |
| `save.js` | Sauvegarde dans le navigateur, restauration au démarrage, import des banques de la bibliothèque |
| `actions.js` | Actions communes à la souris et au contrôleur : pads, banques, pages, potentiomètres, quantification |
| `controller.js` | Contrôleur APC Key 25 : boutons, pads, potentiomètres, clavier, LED |
| `knobs.js` | Potentiomètres : réglages globaux, pages pilotées par l'APC, rangées de potentiomètres à l'écran |
| `pads.js` | Fenêtre des pads et éditeur de pad |
| `piano.js` | Clavier à l'écran, clavier de l'ordinateur, bouton SUSTAIN (page EQ) |
| `tempo.js` | Tempo : champ BPM, tap tempo |
| `play.js` | Mode accords et arpégiateur |
| `perf-fx.js` | Effets de performance |
| `scenes.js` | Scènes : instantanés rappelés à la mesure suivante |
| `tl.js` | Timeline : enregistrement, pistes, blocs, dessin, temps de lecture |
| `tl-select.js` | Timeline : sélection multiple, glisser, lasso, copier / coller, raccourcis |
| `tl-record.js` | Timeline : enregistrement en jouant (pads et clavier → blocs posés en direct) |
| `tl-listen.js` | Écoute d'un bloc de la timeline (double-clic) |
| `undo.js` | Annuler / rétablir dans la timeline |
| `roll-ui.js` | Piano roll : édition des blocs de notes, écoute du motif |
| `trackfx-ui.js` | Effets de piste : blocs d'effet et leur éditeur |
| `curve-ui.js` | Designer d'effet : courbes dessinées sur 1, 2 ou 4 temps |
| `gen.js` | Générateur de nappes : blocs d'accords posés sur la timeline |
| `synth-ui.js` | Fenêtre du synthé en couches : presets, familles, potentiomètres d'expression |
| `osc-ui.js` | Fenêtre du synthé à oscillateurs |
| `tr909-ui.js` | Fenêtre de la TR-909 et grille de l'APC en mode 909 |
| `acid-ui.js` | Fenêtre de la TB-303 |
| `kick-ui.js` | Fenêtre du designer de kick |
| `decks-ui.js` | Fenêtre des platines : chargement, scratch, transition automatique |
| `mixer-ui.js` | Fenêtre de la table de mixage |
| `patch-ui.js` | Page de câblage : boîtes à effets et câbles |
| `sidechain-ui.js` | Sidechain : kicks des sons et fenêtre de réglage |
| `library-ui.js` | Fenêtre de la bibliothèque de sons |
| `presets-bar.js` | Barre de presets des instruments |
| `metro-ui.js` | Métronome et indicateur de charge (CPU) |
| `viz-ui.js` | Visualiseur et fenêtre projecteur |
| `plugins.js` | Barre des plugins et ouverture des fenêtres |
| `files.js` | Fichiers : kits, projet, morceau, réglages de chaque outil |
| `export.js` | Enregistrement du master et export rapide (WAV, stems) hors temps réel |
| `demo.js` | Morceaux de démonstration |
| `misc.js` | Divers : message temporaire, vumètre, rendu global, boutons Panique et Réinitialiser |

## Règles

**Imports explicites.** Chaque module importe exactement ce qu'il utilise, des moteurs (`../timeline.js`) comme des autres modules de l'application (`./tl.js`). Toutes les déclarations de haut niveau d'un module sont exportées (les tests y accèdent aussi).

**Modules qui s'importent mutuellement.** Les modules de l'application forment des cycles d'imports (la timeline appelle les pads, qui appellent la timeline…). C'est sans danger parce que leur code s'exécute au démarrage ou sur un événement, quand tous les modules sont chargés. Une seule règle : **au chargement d'un module, ne rien appeler d'un autre module de `js/app/`** (sauf `core.js`). `core.js` n'importe aucun module de l'application, il est donc toujours prêt le premier.

**Variables partagées.** Un module peut lire les variables d'un autre (les imports suivent leur valeur), mais pas les modifier directement : le module qui déclare la variable fournit une fonction pour cela.

- Les moteurs créés au démarrage (`engine`, `timeline`, `mixer`, `decks`…) sont déclarés dans `core.js` et enregistrés par `provide({ engine: new Engine() })`.
- Les autres variables ont une fonction `setNom(valeur)` à côté de leur déclaration, par exemple `setTlSel(null)` dans `tl.js`, `setShiftHeld(true)` dans `core.js`.

**État.** Tout ce qui est enregistré (dans le navigateur ou dans un fichier projet) est dans `state` (`core.js`). Après une modification, appeler `save()` (`save.js`) : la sauvegarde est regroupée et différée.

**Nouveau module.** L'ajouter à l'import map d'`index.html` (avec la version `?v=` des autres). `npm run check` signale un module oublié.

**Version des scripts.** Après une modification, incrémenter la version `?v=` dans `index.html` (toutes les lignes de l'import map et la balise de `main.js`) pour que les navigateurs ne gardent pas l'ancienne version en cache.

## Tests

Voir [tests.md](tests.md). Dans un test, `A` donne accès à toutes les variables de `js/main.js` et des modules de `js/app/`.
