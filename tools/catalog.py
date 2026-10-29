"""Catalogue de la bibliothèque de sons (sounds/library.json) : famille, type, note et étiquettes de chaque son.

Les banques (sounds/banks.json) désignent les sons et gardent leur nom, leur tempo et leur catégorie de mixage ; le
catalogue les range dans l'arbre de la bibliothèque (famille › type › sons). Ce script ajoute au catalogue, déjà classé,
tout son des banques qui n'y est pas encore, et retire les entrées dont le fichier n'existe plus. Les entrées déjà
présentes ne sont pas touchées : on peut les corriger à la main dans library.json.

    python tools/catalog.py           # synchronise
    python tools/catalog.py --check   # vérifie seulement (code de sortie 1 si le catalogue n'est pas à jour)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOUNDS = ROOT / 'sounds'

# Arbre de la bibliothèque : familles et types, dans l'ordre d'affichage (noms anglais, dans les deux langues).
TREE = {
    'Drums': ['Kicks', 'Snares', 'Claps', 'Closed Hats', 'Open Hats', 'Cymbals', 'Toms', 'Percussion', 'Beats', 'Fills & Rolls', 'Breaks'],
    'Bass': ['Synth Bass', 'Reese', 'Reverse Bass', 'Kick Bass', 'Sub Bass'],
    'Leads': ['Hoovers', 'Screeches', 'Supersaws', 'Synth Leads', 'Horns', 'Acid', 'Melodies'],
    'Keys': ['Stabs', 'Pianos', 'Bells', 'Plucks', 'Brass'],
    'Pads & Strings': ['Pads', 'Strings', 'Orchestral Hits', 'Textures'],
    'Vocals': ['Shouts', 'Choirs', 'Vocal FX'],
    'FX': ['Risers', 'Downlifters', 'Impacts', 'Sub Drops', 'Sirens', 'Lasers & Zaps', 'Noise', 'Scratches', 'Glitches', 'Bleeps', 'Foley'],
    'Guitars': ['Power Chords', 'Riffs'],
}

# Style des banques (étiquettes) ; les banques d'échantillons libres n'ont pas de style.
BANK_STYLES = {
    'Gabber': ['gabber'], 'Gabber 2': ['gabber'], 'Hardcore': ['hardcore'], 'Oldschool': ['rave', 'oldschool'],
    'Mainstream': ['hardcore', 'mainstream'], 'New wave': ['hardcore'], 'Hardstyle': ['hardstyle'],
    'Melodies': ['hardcore'], 'Hardstyle melodies': ['hardstyle'], 'Anthems': ['hardcore', 'anthem'],
    'Anthem drums': ['hardcore', 'anthem'], 'Anthem leads': ['hardcore', 'anthem'], 'Anthem chords': ['hardcore', 'anthem'],
    'Anthem bass & drops': ['hardcore', 'anthem'], 'Anthem guitars & choirs': ['hardcore', 'anthem'],
    'Early hardcore': ['hardcore', 'early'],
}
MOODS = ['epic', 'euphoric', 'dark', 'andalusian']
WORD_TAGS = {'raw': 'raw', 'zaag': 'raw', 'terror': 'terror', 'speedcore': 'terror', 'uptempo': 'uptempo', 'frenchcore': 'frenchcore',
             'industrial': 'industrial', 'rotterdam': 'gabber', 'doomcore': 'doomcore', 'amen': 'breakbeat', 'break': 'breakbeat',
             'trance': 'trance', 'dnb': 'drum and bass', 'acid': 'acid', '909': '909', '808': '808'}

NOTE = re.compile(r'(?:^|\s)([A-Ga-g])([#b]?)(m|dim)?(\+|\d)?$')


def note_of(name):
    """Note ou accord à la fin du nom (« Kick F# », « Stab Cm », « bass hard c ») -> « F# », « Cm », « C »."""
    m = NOTE.search(name.strip())
    if not m or ' beat ' in f' {name.lower()} ':   # « arovane beat a » : une variante, pas une note
        return None
    letter, acc, qual, _ = m.groups()
    return letter.upper() + acc + (qual or '')


def classify(name, cat, loop):
    """-> (famille, type) d'après le nom, la catégorie de mixage et boucle / coup."""
    n = name.lower()
    has = lambda *w: any(x in n for x in w)
    if cat == 'kick':
        return 'Drums', 'Kicks'
    if cat == 'guitar':
        return 'Guitars', 'Power Chords' if not loop else 'Riffs'
    if cat == 'drums':
        if loop:
            if has('amen', 'break', 'chopped', 'compus', 'garzul', 'arovane', 'mika', 'safari'):
                return 'Drums', 'Breaks'
            if has('roll', 'fill', 'build', 'snare build', 'triplets'):
                return 'Drums', 'Fills & Rolls'
            return 'Drums', 'Beats'
        if has('clap'): return 'Drums', 'Claps'
        if has('hat snap'): return 'Drums', 'Closed Hats'
        if has('snare', 'sn ', 'snap', 'rim'): return 'Drums', 'Snares'
        if has('open hat', 'cymbal open', 'offbeat hat', 'off-hat'): return 'Drums', 'Open Hats'
        if has('hat', 'cymbal closed', 'cymbal pedal', 'charley'): return 'Drums', 'Closed Hats'
        if has('crash', 'ride', 'splash', 'cymbal', 'china'): return 'Drums', 'Cymbals'
        if has('tom'): return 'Drums', 'Toms'
        if has('roll'): return 'Drums', 'Fills & Rolls'
        if has('industrial hit'): return 'FX', 'Impacts'
        if has('door', 'till', 'crow'): return 'FX', 'Foley'
        return 'Drums', 'Percussion'
    if cat == 'bass':
        if has('reese'): return 'Bass', 'Reese'
        if has('reverse'): return 'Bass', 'Reverse Bass'
        if has('kick'): return 'Bass', 'Kick Bass'
        if has('sub'): return 'Bass', 'Sub Bass'
        return 'Bass', 'Synth Bass'
    if cat == 'lead':
        if has('hoover'): return 'Leads', 'Hoovers'
        if has('screech', 'scream'): return 'Leads', 'Screeches'
        if has('supersaw'): return 'Leads', 'Supersaws'
        if has('horn'): return 'Leads', 'Horns'
        if has('acid'): return 'Leads', 'Acid'
        if has('pluck'): return 'Keys', 'Plucks'
        if loop: return 'Leads', 'Melodies'
        return 'Leads', 'Synth Leads'
    if cat == 'keys':
        if has('piano'): return 'Keys', 'Pianos'
        if has('bell'): return 'Keys', 'Bells'
        if has('pluck'): return 'Keys', 'Plucks'
        if has('brass'): return 'Keys', 'Brass'
        if has('rave zap'): return 'FX', 'Lasers & Zaps'
        if has('e fifths', 'e slide', 'em9', 'harmonics'): return 'Keys', 'Plucks' if has('slide') else 'Pianos'
        return 'Keys', 'Stabs'
    if cat == 'pad':
        if has('orchestra'): return 'Pads & Strings', 'Orchestral Hits'
        if has('string', 'staccato'): return 'Pads & Strings', 'Strings'
        if has('drone', 'hum', 'rub', 'lunar', 'sauna', 'buzz', 'woosh', 'swoosh', 'cineboom'): return 'Pads & Strings', 'Textures'
        return 'Pads & Strings', 'Pads'
    if cat == 'voice':
        if has('shout'): return 'Vocals', 'Shouts'
        if has('choir', 'voices'): return 'Vocals', 'Choirs'
        return 'Vocals', 'Vocal FX'
    # fx
    if has('downlifter'): return 'FX', 'Downlifters'
    if has('riser', 'uplifter', 'build', 'siren rise', 'tunnel'): return 'FX', 'Risers' if not has('siren rise') else 'Sirens'
    if has('sub drop', 'sub boom', 'deep sub'): return 'FX', 'Sub Drops'
    if has('impact', 'hit', 'blast', 'cineboom'): return 'FX', 'Impacts'
    if has('siren', 'air raid', 'whistle'): return 'FX', 'Sirens'
    if has('laser', 'zap'): return 'FX', 'Lasers & Zaps'
    if has('reverse crash'): return 'FX', 'Downlifters'
    if has('noise', 'hiss', 'swoosh', 'swash'): return 'FX', 'Noise'
    if has('scratch', 'backspin', 'rewind', 'tape stop'): return 'FX', 'Scratches'
    if has('glitch', 'robot', 'perc', 'burp'): return 'FX', 'Glitches'
    if has('phone', 'door', 'wood', 'pop', 'tick', 'twang', 'flip'): return 'FX', 'Foley'
    return 'FX', 'Bleeps'


def tags_of(name, bank):
    n = name.lower()
    tags = list(BANK_STYLES.get(bank, []))
    tags += [m for m in MOODS if m in n]
    tags += [t for w, t in WORD_TAGS.items() if re.search(rf'\b{re.escape(w)}', n)]
    return sorted(set(tags))


def entries_from_banks(manifest):
    for bank in manifest['banks']:
        for p in bank['pads']:
            if p:
                yield bank['name'], p


def main():
    check = '--check' in sys.argv
    manifest = json.loads((SOUNDS / 'banks.json').read_text(encoding='utf-8'))
    path = SOUNDS / 'library.json'
    lib = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'version': 1, 'sounds': []}
    known = {s['file']: s for s in lib['sounds']}
    problems = []
    for bank, p in entries_from_banks(manifest):
        if p['file'] in known:
            continue
        if check:
            problems.append(f"son de banque absent du catalogue : {p['file']} ({bank})")
            continue
        family, typ = classify(p['name'], p.get('cat', 'drums'), p.get('mode') == 2)
        entry = {'file': p['file'], 'family': family, 'type': typ}
        if note_of(p['name']): entry['note'] = note_of(p['name'])
        if tags_of(p['name'], bank): entry['tags'] = tags_of(p['name'], bank)
        known[p['file']] = entry
    for f, s in list(known.items()):
        if not (SOUNDS / f).exists():
            problems.append(f'fichier manquant : {f}')
            if not check: del known[f]
        if s['family'] not in TREE or s['type'] not in TREE[s['family']]:
            problems.append(f"famille / type inconnus : {f} ({s['family']} › {s['type']})")
    if check:
        for line in problems: print(line)
        sys.exit(1 if problems else 0)
    order = {(fam, typ): (i, j) for i, (fam, types) in enumerate(TREE.items()) for j, typ in enumerate(types)}
    lib['sounds'] = sorted(known.values(), key=lambda s: (order.get((s['family'], s['type']), (99, 99)), s['file']))
    lib['tree'] = TREE
    path.write_text(json.dumps(lib, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for line in problems: print(line)
    print(f"{len(lib['sounds'])} sons au catalogue")


if __name__ == '__main__':
    main()
