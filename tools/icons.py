# Icônes des boutons : régénère le bloc « Icônes des boutons » à la fin de css/style.css.
# Chaque icône est un SVG 24×24 (traits ou formes pleines) utilisé comme masque CSS : elle prend la couleur du texte.
# Un bouton l'affiche avec data-icon="nom" (ajouter class="icon-only" pour un bouton sans texte).
# Usage : python tools/icons.py
import os
import urllib.parse

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def S(d, extra=''):
    return f'<path d="{d}" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>{extra}'


def F(d):
    return f'<path d="{d}" fill="#000"/>'


DOT = lambda x, y, r=2: f'<circle cx="{x}" cy="{y}" r="{r}" fill="#000"/>'
BOX = lambda x, y, w, h: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="1" fill="#000"/>'

ICONS = {
    # Transport, fichiers
    'play': F('M7 4.5v15l12.5-7.5z'),
    'stop': F('M6 6h12v12H6z'),
    'pause': F('M6 5h4v14H6zM14 5h4v14h-4z'),
    'rec': DOT(12, 12, 6.5),
    'loop': S('M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4'),
    'undo': S('M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3'),
    'redo': S('M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3'),
    'download': S('M12 3v12M7 10l5 5 5-5M5 21h14'),
    'upload': S('M12 15V3M7 8l5-5 5 5M5 21h14'),
    'stems': S('M12 2l10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5'),
    'save': S('M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-6h8v6'),
    'folder': S('M3 6h6l2 2h10v11H3z'),
    'trash': S('M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14'),
    'fullscreen': S('M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'),
    # En-tête
    'star': S('M12 2.5l2.9 6.2 6.6.7-4.9 4.6 1.4 6.6L12 17.3l-6 3.3 1.4-6.6-4.9-4.6 6.6-.7z'),
    'tap': S('M8 21h8L13.5 3h-3zM12 15l6-9'),
    'panic': S('M8 2h8l6 6v8l-6 6H8l-6-6V8zM8 12h8'),
    'layout': S('M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'),
    'reset': S('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5'),
    # Plugins
    'pads': S('M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z'),
    'tr': S('M2 6h20v12H2z', DOT(7, 12) + DOT(12, 12) + DOT(17, 12)),
    'acid': S('M2 18l5-12 1 12 5-12 1 12 5-12 3 12'),
    'keys': S('M3 4h18v16H3zM8 4v10M12 4v16M16 4v10'),
    'osc': S('M2 12c2.5-8 5.5-8 8 0s5.5 8 8 0 2-4 4-4'),
    'decks': S('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', DOT(12, 12, 2.5)),
    'roll': S('M3 4h18v16H3zM6 8h5M10 12h7M7 16h4'),
    'editor': S('M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4'),
    'kick': S('M4 8c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8'),
    'mix': S('M6 3v18M12 3v18M18 3v18', BOX(3.5, 13, 5, 3.5) + BOX(9.5, 6, 5, 3.5) + BOX(15.5, 15, 5, 3.5)),
    'patch': S('M7 18c7 0 3-12 10-12', DOT(5, 18, 2.6) + DOT(19, 6, 2.6)),
    'scenes': S('M3 9h18v11H3zM3 9l2-5 16 0-2 5M9 4l-2 5M15 4l-2 5'),
    'perf': F('M13 2L4 14h7l-1.5 8L20 10h-7z'),
    'monitor': S('M2 12h4l3-8 4 16 3-8h6'),
    'viz': S('M4 20V12M9 20V6M14 20v-9M19 20V4'),
    # Outils
    'plus': S('M12 5v14M5 12h14'),
    'magnet': S('M6 3v8a6 6 0 0 0 12 0V3M6 7h4M14 7h4'),
    'merge': S('M6 3v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3M12 14v7'),
    'steps': S('M3 19h5v-5h5V9h5V4h3'),
    'dice': S('M4 4h16v16H4z', DOT(8.5, 8.5, 1.6) + DOT(15.5, 15.5, 1.6) + DOT(12, 12, 1.6)),
    'link': S('M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1'),
    'rest': S('M5 12h14'),
    'wand': S('M4 20L15 9M17 3v3M21 7h-3M14 4l1.5 1.5M19.5 11L18 9.5'),
    'swap': S('M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7'),
    'lib': S('M4 4v16M9 4v16M14 5l5 15'),
    'phones': S('M4 16v-4a8 8 0 0 1 16 0v4M4 15h3v6H4zM17 15h3v6h-3z'),
    'grid': S('M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18'),
    'user': S('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6'),
    # Formes d'onde, filtres
    'w-saw': S('M2 18L12 6v12L22 6v12'),
    'w-pulse': S('M2 18V6h6v12h8V6h6'),
    'w-square': S('M2 18V6h10v12h10V6'),
    'w-tri': S('M2 18L7 6l5 12 5-12 5 12'),
    'w-sine': S('M2 12C5 2 9 2 12 12s7 10 10 0'),
    'f-lp': S('M2 8h11c3 0 4 2 5 5l4 7'),
    'f-hp': S('M22 8H11C8 8 7 10 6 13l-4 7'),
    'f-bp': S('M2 20l5-8c2-4 3-5 5-5s3 1 5 5l5 8'),
    # Visualiseur
    'v-spectrum': S('M3 21h18', BOX(4, 11, 3, 8) + BOX(9, 5, 3, 14) + BOX(14, 9, 3, 10) + BOX(19, 14, 2, 5)),
    'v-milk': S('M12 12a2 2 0 1 1 2 2 4 4 0 1 1 2-6 6 6 0 1 1-8 8 8 8 0 1 1 12-12'),
    'v-tunnel': S('M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3.5 7.5l5 2.5M20.5 7.5l-5 2.5M3.5 16.5l5-2.5M20.5 16.5l-5-2.5'),
    'v-terrain': S('M2 20l5-7 4 4 5-9 6 12M2 20h20M12 4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0'),
    'v-blob': S('M12 3c4 0 7 2.5 7.5 6s-1 4-.5 6.5S17 21 12 21 4 19 4.5 15.5 3.5 10 5 7.5 8 3 12 3z', '<circle cx="9.5" cy="9.5" r="1.6" fill="#000"/>'),
    'v-vu': S('M3 17a9 9 0 0 1 18 0M12 17l4-7M6.5 11.5l1 1M17.5 11.5l-1 1M12 8v1.5'),
}

MARKER = '/* Icônes des boutons'


def build_css():
    css = [MARKER + ' (générées par tools/icons.py ; masques : elles prennent la couleur du texte). */',
           "[data-icon]::before { content: ''; display: inline-block; flex: none; width: 1.15em; height: 1.15em; vertical-align: -0.2em; margin-right: 0.42em;",
           "  background: currentColor; -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }",
           "[data-icon]:empty::before, [data-icon].icon-only::before { margin-right: 0; }",
           "[data-icon].icon-only { font-size: 0; padding-left: 9px; padding-right: 9px; }",
           "[data-icon].icon-only::before { width: 16px; height: 16px; }"]
    for name, body in ICONS.items():
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">{body}</svg>'
        css.append(f'[data-icon="{name}"] {{ --icon: url("data:image/svg+xml,{urllib.parse.quote(svg, safe=" =:/,.-")}"); }}')
    return '\n'.join(css) + '\n'


if __name__ == '__main__':
    p = os.path.join(root, 'css', 'style.css')
    s = open(p, encoding='utf-8').read()
    if MARKER in s:
        s = s[:s.index(MARKER)].rstrip('\n') + '\n'
    s = s.rstrip('\n') + '\n\n' + build_css()
    open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print(f'{len(ICONS)} icons written to css/style.css')
