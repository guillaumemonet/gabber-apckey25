// Traductions : anglais par défaut, français si le navigateur est en français.
// Forcer une langue : ajouter ?lang=fr ou ?lang=en à l'adresse.

const forced = new URLSearchParams(location.search).get('lang');
export const lang = (forced || navigator.languages?.[0] || navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
document.documentElement.lang = lang;

const STRINGS = {
  en: {
    'start.subtitle': '40-pad sampler + synth for the Akai APC Key 25',
    'start.button': 'Start',
    'start.hint': 'Browsers require a click before playing sound.',
    'start.generating': 'Generating sounds…',
    'start.loading': 'Loading sounds… {done}/{total}',
    'start.error': 'Startup error: {msg}',

    'status.none': 'No controller',
    'status.connected': 'APC Key 25 {model}',
    'status.notFound': 'APC Key 25 not found ({seen})',
    'status.portsSeen': 'ports seen: {ports}',
    'status.noPorts': 'no MIDI port detected',
    'status.portBusy': 'Port “{port}” unavailable: close Ableton / FL Studio / any app using it, then reload the page ({msg})',
    'status.denied': 'MIDI access denied: click the icon left of the address bar → MIDI devices → Allow, then reload the page',
    'status.noWebMidi': 'Web MIDI is not supported (use Chrome or Edge).',
    'meter.aria': 'Output level',

    'tempo.title': 'Global tempo: loops follow it and start on the next bar',
    'tap.title': 'Tap several times in rhythm to set the tempo',
    'rec.title': 'Record the output to WAV (APC REC button)',
    'rec.done': 'Recording downloaded',
    'panic.label': 'Stop all',
    'panic.title': 'Stops every sound (STOP ALL CLIPS button)',
    'reset.label': 'Reset',
    'reset.title': 'Back to the starter kit',
    'reset.confirm': 'Delete all imported sounds and go back to the starter kit?',

    'pads.title': 'Pads',
    'pads.hint': 'Click = play · Shift + click = select · drop an audio file on a pad to load it',
    'pad.empty': 'empty',
    'bank.title1': 'Bank {n}: SCENE LAUNCH {n}',
    'bank.title2': 'Bank {n}: Shift + SCENE LAUNCH {m}',
    'banks.aria': 'Banks (SCENE LAUNCH buttons)',

    'kit.exportBank': 'Export bank',
    'kit.exportBank.title': 'Save the displayed bank (sounds + settings) to a file',
    'kit.exportAll': 'Export all',
    'kit.exportAll.title': 'Save the 10 banks and every setting',
    'kit.import': 'Import…',
    'kit.import.title': 'Load an .apckit file (bank or session)',
    'kit.exportingBank': 'Exporting bank…',
    'kit.exportedBank': 'Bank exported',
    'kit.exportingAll': 'Exporting session…',
    'kit.exportedAll': 'Session exported',
    'kit.importing': 'Importing…',
    'kit.imported': 'Import complete',
    'kit.confirmSession': 'Replace the 10 banks and all settings with this session?',
    'kit.confirmBank': 'Replace the content of bank {n}?',
    'kit.failed': 'Import failed: {msg}',
    'kit.badFile': 'This file is not a GabberKey kit.',
    'kit.file.bank': 'gabberkey-bank{n}',
    'lib.added': 'New sound bank “{name}” added to bank {n}',

    'editor.title': 'Pad {pad} · Bank {bank}',
    'editor.name': 'Name',
    'editor.load': 'Load a sound…',
    'editor.play': 'Preview',
    'editor.clear': 'Clear',
    'editor.color': 'Colour (LED)',
    'editor.mode': 'Playback mode',
    'editor.bpm': 'Loop’s original tempo (empty = no sync)',
    'editor.bpmAuto.title': 'Computes the tempo assuming the file lasts a whole number of bars',
    'editor.emptyWave': 'Empty pad: drop an audio file here or on the pad',
    'editor.unreadable': 'Cannot read “{name}” (unsupported format).',

    'knobs.title': 'Knobs',
    'knobs.hint': 'Shift + knob = fine tuning · double-click = default value',
    'pages.aria': 'Pages (track buttons 1 to 4)',
    'page.title': 'Track button {n}',
    'page.synth': 'Synth',
    'page.fx': 'Effects',
    'page.pad': 'Pad',
    'page.eq': 'EQ',

    'perf.title': 'Performance',
    'perf.hint': 'Hold · APC: track buttons 5-8, Shift + 5-8 for the second row',
    'perf.filterDown': 'Filter ↓',
    'perf.filterUp': 'Filter ↑',
    'perf.track': 'Track {n}',
    'perf.shift': 'Shift + {n}',

    'piano.title': 'Keyboard',
    'piano.hint': 'Computer keyboard: middle row (A S D F… on QWERTY) · Z / X = octave',
    'presets.aria': 'Synth presets (Shift + piano key)',
    'preset.title': 'Shift + {key} on the APC keyboard',
    'preset.toast': 'Synth: {name}',
    'notes': ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],

    'monitor.title': 'MIDI monitor',
    'monitor.swap': 'Swap keyboard / controls ports',
    'monitor.roleAll': 'all',

    'wave': ['Sine', 'Triangle', 'Saw', 'Square'],
    'mode': ['One-shot', 'Hold', 'Loop'],
    'fmt.semitones': 'st',
    'fmt.left': 'L',
    'fmt.right': 'R',

    'synth.wave': 'Wave', 'synth.detune': 'Detune', 'synth.cutoff': 'Cutoff', 'synth.reso': 'Resonance',
    'synth.fenv': 'Filter env.', 'synth.attack': 'Attack', 'synth.release': 'Release', 'synth.synthVol': 'Synth vol.',
    'fx.dTime': 'Delay time', 'fx.dFb': 'Delay feedb.', 'fx.dSend': 'Synth delay', 'fx.rSend': 'Synth reverb',
    'fx.rSize': 'Reverb size', 'fx.drive': 'Drive', 'fx.padVol': 'Pads vol.', 'fx.master': 'Master vol.',
    'eq.eqLow': 'Low 100Hz', 'eq.eqLowMid': 'Low-mid 350', 'eq.eqMid': 'Mid 1.2k', 'eq.eqHiMid': 'High-mid 3.5k',
    'eq.eqHigh': 'High 9k', 'eq.eqLP': 'Low-pass', 'eq.eqHP': 'High-pass', 'eq.eqGain': 'EQ gain',
    'pad.volume': 'Volume', 'pad.pitch': 'Pitch', 'pad.pan': 'Pan', 'pad.cutoff': 'Filter',
    'pad.start': 'Start', 'pad.dSend': 'Delay', 'pad.rSend': 'Reverb', 'pad.mode': 'Mode',

    'preset.init': 'Init', 'preset.hoover': 'Hoover', 'preset.acid': 'Acid 303', 'preset.screech': 'Screech',
    'preset.stab': 'Rave stab', 'preset.bass': 'Dist. bass', 'preset.horn': 'Horn', 'preset.kick': 'Tuned kick',
  },

  fr: {
    'start.subtitle': 'Sampler 40 pads + synthé pour Akai APC Key 25',
    'start.button': 'Démarrer',
    'start.hint': 'Le navigateur exige un clic avant de jouer du son.',
    'start.generating': 'Génération des sons…',
    'start.loading': 'Chargement des sons… {done}/{total}',
    'start.error': 'Erreur au démarrage : {msg}',

    'status.none': 'Aucun contrôleur',
    'status.connected': 'APC Key 25 {model}',
    'status.notFound': 'APC Key 25 introuvable ({seen})',
    'status.portsSeen': 'ports vus : {ports}',
    'status.noPorts': 'aucun port MIDI détecté',
    'status.portBusy': 'Port « {port} » inaccessible : ferme Ableton / FL Studio / tout logiciel qui l\'utilise, puis recharge la page ({msg})',
    'status.denied': 'Accès MIDI refusé : clique sur l\'icône à gauche de l\'adresse → Appareils MIDI → Autoriser, puis recharge la page',
    'status.noWebMidi': 'Web MIDI non supporté (utilise Chrome ou Edge).',
    'meter.aria': 'Niveau de sortie',

    'tempo.title': 'Tempo global : les boucles suivent ce tempo et démarrent sur la mesure suivante',
    'tap.title': 'Tape plusieurs fois en rythme pour régler le tempo',
    'rec.title': 'Enregistrer la sortie en WAV (bouton REC de l\'APC)',
    'rec.done': 'Enregistrement téléchargé',
    'panic.label': 'Tout couper',
    'panic.title': 'Coupe tous les sons (bouton STOP ALL CLIPS)',
    'reset.label': 'Réinitialiser',
    'reset.title': 'Revenir au kit de départ',
    'reset.confirm': 'Effacer tous les sons importés et revenir au kit de départ ?',

    'pads.title': 'Pads',
    'pads.hint': 'Clic = jouer · Maj + clic = sélectionner · glisser un fichier audio sur un pad pour le charger',
    'pad.empty': 'vide',
    'bank.title1': 'Banque {n} : SCENE LAUNCH {n}',
    'bank.title2': 'Banque {n} : Maj + SCENE LAUNCH {m}',
    'banks.aria': 'Banques (boutons SCENE LAUNCH)',

    'kit.exportBank': 'Exporter la banque',
    'kit.exportBank.title': 'Enregistre la banque affichée (sons + réglages) dans un fichier',
    'kit.exportAll': 'Exporter tout',
    'kit.exportAll.title': 'Enregistre les 10 banques et tous les réglages',
    'kit.import': 'Importer…',
    'kit.import.title': 'Charge un fichier .apckit (banque ou session)',
    'kit.exportingBank': 'Export de la banque…',
    'kit.exportedBank': 'Banque exportée',
    'kit.exportingAll': 'Export de la session…',
    'kit.exportedAll': 'Session exportée',
    'kit.importing': 'Import…',
    'kit.imported': 'Import terminé',
    'kit.confirmSession': 'Remplacer les 10 banques et tous les réglages par cette session ?',
    'kit.confirmBank': 'Remplacer le contenu de la banque {n} ?',
    'kit.failed': 'Import impossible : {msg}',
    'kit.badFile': 'Ce fichier n\'est pas un kit GabberKey.',
    'kit.file.bank': 'gabberkey-banque{n}',
    'lib.added': 'Nouvelle banque de sons « {name} » ajoutée en banque {n}',

    'editor.title': 'Pad {pad} · Banque {bank}',
    'editor.name': 'Nom',
    'editor.load': 'Charger un son…',
    'editor.play': 'Écouter',
    'editor.clear': 'Vider',
    'editor.color': 'Couleur (LED)',
    'editor.mode': 'Mode de lecture',
    'editor.bpm': 'Tempo d\'origine de la boucle (vide = pas de synchro)',
    'editor.bpmAuto.title': 'Calcule le tempo en supposant que le fichier dure un nombre entier de mesures',
    'editor.emptyWave': 'Pad vide : glisse un fichier audio ici ou sur le pad',
    'editor.unreadable': 'Impossible de lire « {name} » (format non supporté).',

    'knobs.title': 'Potentiomètres',
    'knobs.hint': 'Maj + potard = réglage fin · double-clic = valeur par défaut',
    'pages.aria': 'Pages (boutons de piste 1 à 4)',
    'page.title': 'Bouton de piste {n}',
    'page.synth': 'Synthé',
    'page.fx': 'Effets',
    'page.pad': 'Pad',
    'page.eq': 'EQ',

    'perf.title': 'Performance',
    'perf.hint': 'Maintenir · APC : boutons de piste 5-8, Maj + 5-8 pour la 2e ligne',
    'perf.filterDown': 'Filtre ↓',
    'perf.filterUp': 'Filtre ↑',
    'perf.track': 'Piste {n}',
    'perf.shift': 'Maj + {n}',

    'piano.title': 'Clavier',
    'piano.hint': 'Clavier de l\'ordinateur : rangée du milieu (Q S D F… en AZERTY) · W / X = octave',
    'presets.aria': 'Presets du synthé (Maj + touche du piano)',
    'preset.title': 'Maj + {key} sur le clavier de l\'APC',
    'preset.toast': 'Synthé : {name}',
    'notes': ['do', 'do#', 'ré', 'ré#', 'mi', 'fa', 'fa#', 'sol', 'sol#', 'la', 'la#', 'si'],

    'monitor.title': 'Moniteur MIDI',
    'monitor.swap': 'Inverser ports clavier / contrôles',
    'monitor.roleAll': 'tout',

    'wave': ['Sinus', 'Triangle', 'Scie', 'Carré'],
    'mode': ['One-shot', 'Maintien', 'Boucle'],
    'fmt.semitones': 'dt',
    'fmt.left': 'G',
    'fmt.right': 'D',

    'synth.wave': 'Onde', 'synth.detune': 'Désaccord', 'synth.cutoff': 'Coupure', 'synth.reso': 'Résonance',
    'synth.fenv': 'Env. filtre', 'synth.attack': 'Attaque', 'synth.release': 'Relâche', 'synth.synthVol': 'Vol. synthé',
    'fx.dTime': 'Delay temps', 'fx.dFb': 'Delay répét.', 'fx.dSend': 'Delay synthé', 'fx.rSend': 'Reverb synthé',
    'fx.rSize': 'Reverb taille', 'fx.drive': 'Saturation', 'fx.padVol': 'Vol. pads', 'fx.master': 'Vol. général',
    'eq.eqLow': 'Grave 100Hz', 'eq.eqLowMid': 'Bas-méd. 350', 'eq.eqMid': 'Médium 1.2k', 'eq.eqHiMid': 'Haut-méd. 3.5k',
    'eq.eqHigh': 'Aigu 9k', 'eq.eqLP': 'Passe-bas', 'eq.eqHP': 'Passe-haut', 'eq.eqGain': 'Gain EQ',
    'pad.volume': 'Volume', 'pad.pitch': 'Hauteur', 'pad.pan': 'Panoramique', 'pad.cutoff': 'Filtre',
    'pad.start': 'Début', 'pad.dSend': 'Delay', 'pad.rSend': 'Reverb', 'pad.mode': 'Mode',

    'preset.init': 'Init', 'preset.hoover': 'Hoover', 'preset.acid': 'Acid 303', 'preset.screech': 'Screech',
    'preset.stab': 'Stab rave', 'preset.bass': 'Basse dist.', 'preset.horn': 'Horn', 'preset.kick': 'Kick accordé',
  },
};

// Noms de sons par défaut (anglais dans les fichiers) traduits en français.
const SOUNDS_FR = {
  'Tom low': 'Tom bas', 'Tom high': 'Tom haut', 'Closed HH': 'HH fermé', 'Open HH': 'HH ouvert',
  'Riser': 'Montée', 'Bass': 'Basse', 'Bell': 'Cloche',
  'Rotterdam hard': 'Rotterdam dur', 'Long doef': 'Doef long', 'Dirty clap': 'Clap saturé',
  'Open hat': 'Hat ouvert', 'Closed hat': 'Hat fermé', 'Siren': 'Sirène', 'Long siren': 'Sirène longue',
  'Downlifter': 'Descente', 'Reverse crash': 'Crash inversé', 'High horn': 'Horn aigu',
  'Acid only': 'Acid seul', 'Hoover only': 'Hoover seul', 'Stabs only': 'Stabs seuls',
  'Distorted tok': 'Tok distordu', 'Long tail': 'Queue longue', 'Strings': 'Cordes',
  'Orchestra hit': 'Coup d\'orchestre', 'String ostinato': 'Ostinato cordes', 'String pads': 'Nappes cordes',
  'Offbeat bass': 'Basse offbeat', 'Rolling bass': 'Basse roulante', 'Reese bass': 'Basse reese',
  'Bass + kick': 'Basse + kick', 'Strings + beat': 'Cordes + beat', 'Full track': 'Morceau complet',
  'Terror loop': 'Boucle terror', 'Kick gallop': 'Kick galop', 'Industrial loop': 'Boucle industrial',
  'Snare fill': 'Roulement snare', 'Breakdown hit': 'Impact breakdown',
};

export function t(key, vars = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s;
}

// Nom de son : exact, ou préfixe suivi d'un numéro / d'une note (« Bass 3 » -> « Basse 3 »).
export function soundName(name) {
  if (lang !== 'fr' || !name) return name;
  if (SOUNDS_FR[name]) return SOUNDS_FR[name];
  const m = name.match(/^(.*) (\S+)$/);
  return m && SOUNDS_FR[m[1]] ? `${SOUNDS_FR[m[1]]} ${m[2]}` : name;
}

// Textes statiques de la page : data-i18n (texte), data-i18n-title, data-i18n-aria.
export function translatePage() {
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
