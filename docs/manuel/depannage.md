# Dépannage

← [Fichiers et enregistrement](fichiers.md) · [Sommaire](README.md)

Problèmes courants et régénération des banques de sons.

## Dépannage

| Symptôme | Solution |
|---|---|
| « Accès MIDI refusé » | Cliquez sur l'icône à gauche de l'adresse → Appareils MIDI → Autoriser, puis rechargez. |
| « Port inaccessible » | Un autre logiciel (Ableton, FL Studio…) utilise l'APC. Sous Windows, un port MIDI ne se partage pas : fermez ce logiciel et rechargez. |
| Détecté mais les pads ne font rien | Débranchez l'APC, attendez 10 secondes, rebranchez-le sur un autre port USB, puis rechargez. Le service MIDI de Windows peut cesser de transmettre après une mise en veille ou un branchement à chaud. |
| Pas de son | Cliquez d'abord sur **Démarrer** : les navigateurs bloquent le son avant un clic. |
| Une nouvelle banque de sons n'apparaît pas | Relancez `start.bat` / `start.sh`, puis rechargez. Une nouvelle banque de la bibliothèque va dans sa banque prévue si elle est vide, sinon dans la première banque vide (un message indique laquelle). |
| Voir ce qu'envoie l'APC | Ouvrez la fenêtre **MIDI** : son moniteur affiche les derniers messages reçus. |
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

---

← [Fichiers et enregistrement](fichiers.md) · [Sommaire](README.md)
