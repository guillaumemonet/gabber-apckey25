# Tests

GabberKey a deux sortes de tests, lancés par une seule commande :

```
npm test
```

(il faut Node.js 18 ou plus et Firefox ; aucun paquet à installer)

## Vérifications statiques — `npm run check`

Quelques secondes, sans navigateur (`tests/check.js`) :

- la **syntaxe** de tous les modules JavaScript ;
- les **traductions** : chaque clé existe en anglais et en français, et aucune clé utilisée dans `index.html` ou dans le code (`t('…')`) n'est inconnue ;
- l'**aide** : chaque fenêtre a sa page d'aide dans les deux langues ;
- la **bibliothèque** : chaque son déclaré dans `sounds/banks.json` existe sur le disque, et les démos sont présentes.

## Tests dans le navigateur — `npm run test:browser`

`tests/run.js` lance un petit serveur, puis, pour chaque fichier `tests/specs/*.test.js`, ouvre **Firefox sans fenêtre** avec un profil neuf sur une page de test générée en mémoire : l'application, un accès à toutes ses variables internes, et le test. Chaque test vérifie lui-même ce qui doit être vrai ; le lanceur affiche ✓ ou ✗ avec le détail des vérifications qui échouent.

- Lancer une partie des tests : `node tests/run.js pads timeline` (filtre sur le nom des fichiers).
- Variables : `FIREFOX` (chemin de Firefox s'il n'est pas trouvé), `TEST_JOBS` (tests en parallèle, 2 par défaut), `TEST_TIMEOUT` (secondes par test, 180 par défaut).
- Les tests tournent aussi sur GitHub à chaque envoi (`.github/workflows/tests.yml`, Firefox sous Linux avec une carte son virtuelle).

## Écrire un test

Un fichier `tests/specs/domaine-sujet.test.js` :

```js
// Ce que le test vérifie, en une phrase.
export default async function (t, A) {
  A.setBank(16);                                  // A : toutes les variables internes (js/main.js, js/app/, moteurs)
  t.eq(A.state.bank, 16, 'la banque 17 est affichée');
  await t.until(() => A.timeline.playing, 2000);  // attendre une condition
  t.near(A.timeline.position(), 4, 0.5, 'la tête de lecture avance');
}
```

Ce que `t` propose (`tests/harness.js`) :

| | |
|---|---|
| `t.ok(cond, message, détail)` | une vérification ; le détail s'affiche si elle échoue |
| `t.eq(a, b, message)` | égalité (valeurs simples ou objets) |
| `t.near(a, b, tolérance, message)` | égalité à une tolérance près (temps, niveaux audio) |
| `t.wait(ms)`, `t.until(fn, ms)` | attendre ; `until` renvoie la valeur de `fn` dès qu'elle est vraie, sinon `null` |
| `t.$(sélecteur)`, `t.$$(sélecteur)` | éléments de la page |
| `t.press(élément, dx, dy)` | clic « réel » (pointerdown + pointerup), comme la souris |
| `t.meter(nœud)` | renvoie une fonction qui lit le niveau crête d'un nœud audio |

Options du fichier :

- `export async function seed(t)` : s'exécute **avant** le clic sur « Démarrer » (par exemple pour écrire une ancienne sauvegarde dans IndexedDB et vérifier qu'elle se charge toujours) ;
- `export const start = false` : ne pas démarrer l'application.

Une erreur JavaScript non rattrapée pendant le test le fait échouer : c'est voulu.

Bonnes pratiques : des tolérances pour tout ce qui dépend du temps réel (le son tourne vraiment), `renderSong()` pour vérifier un rendu audio de façon reproductible, et un test par domaine (pads, timeline, effets, fichiers…), nommé d'après lui.
