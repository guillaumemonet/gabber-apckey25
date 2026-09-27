// Aide de chaque fenêtre (bouton ? de la barre de titre), en français et en anglais.
import { lang } from './i18n.js';

const HELP = {
  en: {
    pads: `
      <p>The 40-pad sampler, laid out like the APC grid (pads 1-8 at the bottom).</p>
      <ul>
        <li><b>Click</b> a pad (or hit it on the APC) to play it; <b>Shift + click</b> selects it without playing.</li>
        <li><b>✎</b> on a pad opens the <b>pad editor</b>: name, colour, playback mode, knobs, loop tempo.</li>
        <li><b>Drop an audio file</b> (WAV, MP3, FLAC, OGG…) on a pad to load it.</li>
        <li>Playback modes: <b>one-shot</b> (plays to the end), <b>hold</b> (as long as the pad is pressed), <b>loop</b> (starts on the next bar, press again to stop).</li>
        <li><b>Banks 1-15</b> (column on the right). APC: SCENE LAUNCH 1-5 = banks 1-5, Shift + SCENE LAUNCH = 6-10, a second time = 11-15.</li>
        <li><b>Export bank / Export all / Import…</b>: <code>.apckit</code> files with the sounds and their settings.</li>
      </ul>`,
    editor: `
      <p>Settings of the selected pad.</p>
      <ul>
        <li><b>Name</b> and <b>LED colour</b> (with an mk1, only its 3 colours are offered).</li>
        <li><b>Load a sound…</b>, <b>Play</b>, <b>Clear</b>. You can also drop an audio file here.</li>
        <li><b>Mode</b>: one-shot, hold or loop.</li>
        <li><b>8 knobs</b>: volume, pitch, pan, filter, start point, delay and reverb sends, mode. They are also on the APC knobs (Pad page, track button 3). Double-click = default value.</li>
        <li><b>Loop tempo</b>: original tempo of the sound, so the loop follows the global tempo. <b>Auto</b> guesses it, assuming the file lasts a whole number of bars.</li>
      </ul>`,
    tr: `
      <p>TR-909 emulation: 11 synthesised instruments and a 16-step sequencer in sync with the timeline and the loops.</p>
      <ul>
        <li><b>Click a step</b>: note → accent → off. <b>Click an instrument name</b> to play and select it.</li>
        <li><b>Patterns 1-8</b> (4 presets: gabber, rave, breakbeat, kick roll). A change waits for the next bar.</li>
        <li><b>Accent</b>: how much louder the accented steps are.</li>
        <li><b>Knobs</b> (TR-909 page of the Knobs window): K1-K4 = parameters of the selected instrument, K5 = <b>drive</b>, K6 = distortion <b>shape</b> (soft, hard, tube, fold, crush), K7 = shuffle, K8 = 909 volume.</li>
        <li><b>APC grid</b> (Shift + PLAY): rows 1-2 = the 16 steps, row 3-4 = instruments, Accent, Clear, Mute, row 5 = patterns. A SCENE LAUNCH button brings the pads back.</li>
        <li>The bass drum also triggers the <b>sidechain</b> (Mixer window).</li>
      </ul>`,
    piano: `
      <p>The keyboard synth: 35 presets in 10 families, 8 expression knobs, chord mode, arpeggiator and pad generator.</p>
      <ul>
        <li><b>Families and presets</b>: click, or on the APC <b>Shift + white key</b> = preset of the family, <b>Shift + C# / D#</b> = previous / next family.</li>
        <li><b>8 knobs</b> adapted to the family (brightness, resonance, attack, release, width, vibrato, ensemble or drive, glide, detune, reverb). Double-click = back to the preset's value.</li>
        <li><b>Chords</b>: one key plays a whole chord; <b>In key (F minor)</b> builds the right chord of the scale on each key. APC: Shift + F#.</li>
        <li><b>Arpeggio</b>: the held notes are played one after another in time with the tempo (1/8, 1/16, 1/32; order; 1-3 octaves; note length; <b>Hold</b>). APC: Shift + G# = on / off, Shift + A# = speed.</li>
        <li><b>Pad generator → timeline</b>: type a progression (<code>Fm Db Eb Cm</code>), choose a sound, register, bars per chord, repeats, rhythm and bass, then <b>Generate</b>: the chord blocks are placed from the playhead, each with its own preset.</li>
        <li>Computer keyboard: middle row (A S D F… on QWERTY), Z / X = octave.</li>
      </ul>`,
    knobs: `
      <p>The 8 on-screen knobs follow the APC knobs K1-K8, page by page.</p>
      <ul>
        <li><b>Synth</b>: the 8 expression knobs of the current synth family.</li>
        <li><b>Effects</b>: delay time, feedback and send, reverb send and size, synth volume, pad volume, master volume.</li>
        <li><b>Pad</b>: the knobs of the selected pad.</li>
        <li><b>EQ</b>: 5 bands (±15 dB), low-pass, high-pass, output gain. SUSTAIN on the APC opens it (held = only while pressed).</li>
        <li><b>TR-909</b> and <b>mixer</b> pages (Shift + track 1-4 on the APC).</li>
        <li>APC: track buttons 1-4 = Synth / Effects / Pad / EQ. <b>Shift + knob</b> = fine tuning; double-click on screen = default value.</li>
      </ul>`,
    perf: `
      <p>Live effects on the whole mix, in time with the grid. Hold to use them (Pump is on / off).</p>
      <ul>
        <li><b>Rolls</b> 1/4, 1/8, 1/16, 1/32: repeat the sound, starting on the next 16th note.</li>
        <li><b>Filter ↓ / ↑</b>: low-pass or high-pass sweep over one bar.</li>
        <li><b>Tape stop</b>: slows everything down to a stop.</li>
        <li><b>Pump</b>: the synth fades out on every beat (for a real sidechain triggered by the kicks, see the Mixer window).</li>
        <li>APC: track buttons 5-8 (held), Shift + 5-8 for the second row.</li>
      </ul>`,
    mix: `
      <p>One channel per tool (Pads, Synth, TR-909, Timeline), then the master.</p>
      <ul>
        <li>Each channel: insert effects (<b>+ FX</b>, up to 4: distortion, filter, compressor, reverb), reverb and delay sends, pan, fader, <b>M</b>ute, <b>S</b>olo, meter. Double-click = reset.</li>
        <li><b>Sidechain</b> (top): every kick ducks the synth and the melodic sounds (bass, pads, leads, keys, voices), which come back up smoothly. Triggered by <b>the kicks</b> (909, kick pads and blocks, kicks of the GabberKey loops) or on <b>every beat</b> (for other loops). Depth, release, targets; the meter shows the ducking.</li>
        <li>APC: Shift + track 1 / 2 / 3 / 4 = volumes / pans / delay / reverb (K1 Pads, K2 Synth, K3 TR-909, K4 Timeline, K8 master).</li>
      </ul>`,
    scenes: `
      <p>40 snapshots of the session, laid out like the APC grid.</p>
      <ul>
        <li>A scene stores the playing loops, the 909 pattern and mutes, the mixer, the synth preset, the tempo and the transport.</li>
        <li><b>Click</b> = launch on the next bar. <b>Shift + click</b> (or <b>Save mode</b>) = store the current state. <b>Right-click</b> = clear.</li>
        <li>APC: <b>Shift + STOP ALL CLIPS</b> turns the pads into scenes (pad = launch, Shift + pad = save). LEDs: green = stored, red = current, blinking = waiting for the next bar.</li>
      </ul>`,
    monitor: `
      <p>Every MIDI message received from the APC, to check the connection.</p>
      <ul>
        <li>The ports in use are shown at the top. If the pads and the keyboard are swapped, use the swap button.</li>
        <li>Nothing arrives? Unplug and plug the APC back in, then reload the page (Windows can freeze its MIDI driver).</li>
      </ul>`,
  },
  fr: {
    pads: `
      <p>Le sampler de 40 pads, disposé comme la grille de l'APC (pads 1 à 8 en bas).</p>
      <ul>
        <li><b>Clic</b> sur un pad (ou frappe sur l'APC) pour le jouer ; <b>Maj + clic</b> le sélectionne sans le jouer.</li>
        <li><b>✎</b> sur un pad ouvre l'<b>éditeur de pad</b> : nom, couleur, mode de lecture, potards, tempo de boucle.</li>
        <li><b>Glisse un fichier audio</b> (WAV, MP3, FLAC, OGG…) sur un pad pour le charger.</li>
        <li>Modes : <b>one-shot</b> (joue jusqu'au bout), <b>maintenu</b> (tant que le pad est appuyé), <b>boucle</b> (démarre à la mesure suivante, un nouvel appui l'arrête).</li>
        <li><b>Banques 1 à 15</b> (colonne de droite). APC : SCENE LAUNCH 1-5 = banques 1-5, Maj + SCENE LAUNCH = 6-10, une deuxième fois = 11-15.</li>
        <li><b>Exporter la banque / Exporter tout / Importer…</b> : fichiers <code>.apckit</code> avec les sons et leurs réglages.</li>
      </ul>`,
    editor: `
      <p>Les réglages du pad sélectionné.</p>
      <ul>
        <li><b>Nom</b> et <b>couleur de la LED</b> (avec un mk1, seules ses 3 couleurs sont proposées).</li>
        <li><b>Charger un son…</b>, <b>Jouer</b>, <b>Vider</b>. Tu peux aussi glisser un fichier audio ici.</li>
        <li><b>Mode</b> : one-shot, maintenu ou boucle.</li>
        <li><b>8 potards</b> : volume, hauteur, panoramique, filtre, point de départ, envois delay et reverb, mode. Ils sont aussi sur les potards de l'APC (page Pad, bouton de piste 3). Double-clic = valeur par défaut.</li>
        <li><b>Tempo de la boucle</b> : tempo d'origine du son, pour que la boucle suive le tempo global. <b>Auto</b> le devine, en supposant que le fichier dure un nombre entier de mesures.</li>
      </ul>`,
    tr: `
      <p>Émulation de la TR-909 : 11 instruments synthétisés et un séquenceur de 16 pas calé sur la timeline et les boucles.</p>
      <ul>
        <li><b>Clic sur un pas</b> : note → accent → silence. <b>Clic sur le nom d'un instrument</b> pour le jouer et le choisir.</li>
        <li><b>Patterns 1 à 8</b> (4 préréglés : gabber, rave, breakbeat, roulement de kick). Un changement attend la mesure suivante.</li>
        <li><b>Accent</b> : de combien les pas accentués sont plus forts.</li>
        <li><b>Potards</b> (page TR-909 de la fenêtre Potards) : K1-K4 = paramètres de l'instrument choisi, K5 = <b>drive</b>, K6 = <b>forme</b> de distorsion (douce, dure, lampe, repli, crush), K7 = shuffle, K8 = volume 909.</li>
        <li><b>Grille de l'APC</b> (Maj + PLAY) : rangées 1-2 = les 16 pas, rangées 3-4 = instruments, Accent, Effacer, Muet, rangée 5 = patterns. Un bouton SCENE LAUNCH ramène les pads.</li>
        <li>La grosse caisse déclenche aussi le <b>sidechain</b> (fenêtre Mixeur).</li>
      </ul>`,
    piano: `
      <p>Le synthé du clavier : 35 presets en 10 familles, 8 potards d'expression, mode accords, arpégiateur et générateur de nappes.</p>
      <ul>
        <li><b>Familles et presets</b> : clic, ou sur l'APC <b>Maj + touche blanche</b> = preset de la famille, <b>Maj + do# / ré#</b> = famille précédente / suivante.</li>
        <li><b>8 potards</b> adaptés à la famille (brillance, résonance, attaque, relâche, largeur, vibrato, ensemble ou saturation, glissé, désaccord, réverb). Double-clic = retour à la valeur du preset.</li>
        <li><b>Accords</b> : une touche joue un accord complet ; <b>Dans la tonalité (fa mineur)</b> construit sur chaque touche l'accord juste de la gamme. APC : Maj + fa#.</li>
        <li><b>Arpège</b> : les notes tenues sont jouées l'une après l'autre, calées sur le tempo (1/8, 1/16, 1/32 ; ordre ; 1 à 3 octaves ; durée des notes ; <b>Tenue</b>). APC : Maj + sol# = oui / non, Maj + la# = vitesse.</li>
        <li><b>Générateur de nappes → timeline</b> : tape une suite d'accords (<code>Fm Db Eb Cm</code>), choisis le son, le registre, les mesures par accord, les répétitions, le rythme et la basse, puis <b>Générer</b> : les blocs d'accords sont posés à partir de la tête de lecture, chacun avec son propre preset.</li>
        <li>Clavier de l'ordinateur : rangée du milieu (Q S D F… en AZERTY), W / X = octave.</li>
      </ul>`,
    knobs: `
      <p>Les 8 potards à l'écran suivent les potards K1-K8 de l'APC, page par page.</p>
      <ul>
        <li><b>Synthé</b> : les 8 potards d'expression de la famille du synthé.</li>
        <li><b>Effets</b> : temps, répétitions et envoi du delay, envoi et taille de la reverb, volume du synthé, volume des pads, volume général.</li>
        <li><b>Pad</b> : les potards du pad sélectionné.</li>
        <li><b>EQ</b> : 5 bandes (±15 dB), passe-bas, passe-haut, gain de sortie. SUSTAIN sur l'APC l'ouvre (maintenu = le temps de l'appui).</li>
        <li>Pages <b>TR-909</b> et <b>mixeur</b> (Maj + piste 1-4 sur l'APC).</li>
        <li>APC : boutons de piste 1-4 = Synthé / Effets / Pad / EQ. <b>Maj + potard</b> = réglage fin ; double-clic à l'écran = valeur par défaut.</li>
      </ul>`,
    perf: `
      <p>Effets en direct sur tout le mix, calés sur la grille. Maintiens pour les utiliser (Pump est en marche / arrêt).</p>
      <ul>
        <li><b>Rolls</b> 1/4, 1/8, 1/16, 1/32 : répètent le son, à partir de la double-croche suivante.</li>
        <li><b>Filtre ↓ / ↑</b> : balayage passe-bas ou passe-haut sur une mesure.</li>
        <li><b>Tape-stop</b> : ralentit tout jusqu'à l'arrêt.</li>
        <li><b>Pump</b> : le synthé s'efface à chaque temps (pour un vrai sidechain déclenché par les kicks, voir la fenêtre Mixeur).</li>
        <li>APC : boutons de piste 5-8 (maintenus), Maj + 5-8 pour la 2e ligne.</li>
      </ul>`,
    mix: `
      <p>Une voie par outil (Pads, Synthé, TR-909, Timeline), puis le master.</p>
      <ul>
        <li>Chaque voie : effets d'insert (<b>+ FX</b>, jusqu'à 4 : distorsion, filtre, compresseur, reverb), envois reverb et delay, panoramique, fader, <b>M</b>uet, <b>S</b>olo, vumètre. Double-clic = remise à zéro.</li>
        <li><b>Sidechain</b> (en haut) : chaque kick fait baisser le synthé et les sons mélodiques (basses, nappes, leads, claviers, voix), qui remontent en douceur. Déclenché par <b>les kicks</b> (909, pads et blocs de kick, kicks des boucles GabberKey) ou à <b>chaque temps</b> (pour les autres boucles). Profondeur, relâche, cibles ; le témoin montre la baisse.</li>
        <li>APC : Maj + piste 1 / 2 / 3 / 4 = volumes / panos / delay / reverb (K1 Pads, K2 Synthé, K3 TR-909, K4 Timeline, K8 master).</li>
      </ul>`,
    scenes: `
      <p>40 instantanés de la session, disposés comme la grille de l'APC.</p>
      <ul>
        <li>Une scène garde les boucles en cours, le pattern et les muets de la 909, le mixeur, le preset du synthé, le tempo et le transport.</li>
        <li><b>Clic</b> = lancer à la mesure suivante. <b>Maj + clic</b> (ou <b>Mode enregistrement</b>) = garder l'état actuel. <b>Clic droit</b> = effacer.</li>
        <li>APC : <b>Maj + STOP ALL CLIPS</b> transforme les pads en scènes (pad = lancer, Maj + pad = enregistrer). LEDs : vert = enregistrée, rouge = en cours, clignotant = attend la mesure suivante.</li>
      </ul>`,
    monitor: `
      <p>Tous les messages MIDI reçus de l'APC, pour vérifier la connexion.</p>
      <ul>
        <li>Les ports utilisés sont affichés en haut. Si les pads et le clavier sont inversés, utilise le bouton d'inversion.</li>
        <li>Rien n'arrive ? Débranche et rebranche l'APC, puis recharge la page (Windows peut bloquer son pilote MIDI).</li>
      </ul>`,
  },
};

export const helpHtml = id => HELP[lang]?.[id] ?? HELP.en[id] ?? '';
