"""Rend la démo (demo/demo.json) en fichier audio, avec les sons de la bibliothèque (sounds/).

Usage : tools/.venv/Scripts/python tools/render_demo.py
Sortie : demo/gabberkey-demo.ogg (+ niveaux par section affichés dans la console).
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 44100


def main():
    demo = json.loads((ROOT / 'demo' / 'demo.json').read_text(encoding='utf-8'))
    manifest = json.loads((ROOT / 'sounds' / 'banks.json').read_text(encoding='utf-8'))
    sounds = {(b['name'], p['name']): p for b in manifest['banks'] for p in b['pads'] if p}
    beat = 60 / demo['bpm']
    bar = 4 * beat
    total = int((demo['bars'] * bar + 3) * SR)
    mix = np.zeros((total, 2))

    for track in demo['tracks']:
        for e in track:
            p = sounds.get((e['bank'], e['sound']))
            if not p:
                raise SystemExit(f"Son introuvable : {e['bank']} / {e['sound']}")
            y, sr = sf.read(ROOT / 'sounds' / p['file'], always_2d=True)
            if sr != SR:
                raise SystemExit(f'Fréquence inattendue ({sr} Hz) : {p["file"]}')
            if y.shape[1] == 1:
                y = np.repeat(y, 2, axis=1)
            if p.get('bpm') and p['bpm'] != demo['bpm']:   # boucle à un autre tempo : lue plus vite / plus lentement
                rate = demo['bpm'] / p['bpm']
                idx = np.arange(0, len(y) - 1, rate)
                y = np.stack([np.interp(idx, np.arange(len(y)), y[:, c]) for c in range(2)], axis=1)
            if e.get('bars'):   # bloc de boucle : le son se répète pour remplir le bloc
                n = int(round(e['bars'] * bar * SR))
                y = np.tile(y, (int(np.ceil(n / len(y))), 1))[:n]
                y[-64:] *= np.linspace(1, 0, 64)[:, None]
            start = int(round(e['bar'] * bar * SR))
            end = min(total, start + len(y))
            mix[start:end] += y[:end - start] * e.get('gain', 1.0) * demo.get('gain', 1.0)

    # Niveaux avant le limiteur, par tranche de 4 mesures : aucune section ne doit être muette ou écrasée.
    print('mesures   crête   RMS')
    for b in range(0, demo['bars'], 4):
        seg = mix[int(b * bar * SR):int((b + 4) * bar * SR)]
        print(f'{b + 1:>3}-{b + 4:<3}  {np.max(np.abs(seg)):5.2f}  {np.sqrt(np.mean(seg ** 2)):5.3f}')

    # Limiteur doux (comme le master de l'appli), puis -2 dBFS (marge pour l'encodage Vorbis).
    drive = 1.4
    out = np.tanh(drive * mix / max(1.0, np.percentile(np.abs(mix), 99.9))) / np.tanh(drive)
    out *= 10 ** (-2 / 20) / np.max(np.abs(out))
    target = ROOT / 'demo' / 'gabberkey-demo.ogg'
    # Écriture par blocs : l'encodeur Vorbis de libsndfile plante sur les gros blocs.
    with sf.SoundFile(target, 'w', SR, 2, format='OGG', subtype='VORBIS') as f:
        for i in range(0, len(out), 4096):
            f.write(out[i:i + 4096].astype(np.float32))
    print(f'\n{target.relative_to(ROOT)} : {total / SR:.1f} s')


if __name__ == '__main__':
    main()
