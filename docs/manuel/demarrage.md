# Premiers pas

[Sommaire](README.md) · [Le contrôleur APC Key 25](apc.md) →

Ce qu'il faut, l'installation, le lancement et la langue de l'interface.

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

## Langue

L'interface suit la langue du navigateur : français si le navigateur est en français, anglais sinon. Pour forcer une langue, ajoutez `?lang=fr` ou `?lang=en` à l'adresse.

## Compatibilité matérielle

GabberKey est développé et testé avec un **Akai APC Key 25 mk1**. Le **mk2** est pris en charge d'après la documentation MIDI d'Akai Professional, mais n'a pas encore été essayé sur un vrai appareil. Tout fonctionne aussi à la souris et au clavier de l'ordinateur.

---

[Sommaire](README.md) · [Le contrôleur APC Key 25](apc.md) →
