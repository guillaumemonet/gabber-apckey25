# Générateur : accords et mélodie

← [Instruments](instruments.md) · [Sommaire](README.md) · [Mixage et effets](mixage.md) →

[![Fenêtre Générateur, onglet Mélodie : réglages de la mélodie et son brouillon dans le piano roll](../screenshots/gen-fr.png)](../screenshots/gen-fr.png)

La fenêtre **Générateur** (barre des plugins, groupe Outils) part d'une suite d'accords et pose sur la timeline, au choix (deux onglets), des **blocs d'accords** (cordes, nappes, chœurs…) ou une **mélodie (lead)** qui suit ces accords.

**Accords**

- **Suite d'accords** : tapez les accords séparés par des espaces ou des tirets (`Fm Db Eb Cm`, `Fm-Bbm-Db-C`…), ou cliquez sur une suite toute prête. Reconnus : majeur (`Db`), mineur (`Fm`), `7`, `m7`, `maj7`, `sus2`, `sus4`, `dim`, `aug`, `5`, `add9`, avec `#` / `b`.
- **Son** : le preset du synthé en cours, ou un preset parmi les familles cordes, nappes, chœurs, supersaw, stabs ou claviers. Chaque bloc garde **son propre preset** : vous pouvez jouer autre chose au clavier, ou changer de preset, sans changer les nappes.
- **Registre** (grave, médium, aigu), **mesures par accord** (1, 2 ou 4), **répétitions** (×1, ×2, ×4), **rythme** (tenu, chaque temps, contretemps, croches).
- **Basse** : aucune, sub (tenue), hardcore en contretemps ou reese (tenue), sur la fondamentale de chaque accord, sur une deuxième piste.
- Les accords s'enchaînent en douceur : les notes communes sont gardées et les autres bougent le moins possible.
- **▶ Écouter** joue le premier accord ; **Générer** pose les blocs à partir de la mesure de la tête de lecture, sur la première piste libre sur toute la durée, en partant de la piste armée. La timeline s'allonge si besoin.

Un bloc d'accord se manipule comme les autres : le déplacer, l'allonger, le copier (Alt), l'ouvrir dans le piano roll (double-clic) ou le supprimer.

**Mélodie (lead)**

- Même **suite d'accords**, mêmes **mesures par accord** et **répétitions** que l'onglet Accords : la mélodie suit l'harmonie.
- **Style** : **Hymne** (un motif repris sur chaque accord, comme un hook d'hymne hardcore), **Arpège**, **Riff hardcore** (notes courtes, octaves et quintes), **Question / réponse** (une phrase qui monte, une réponse qui descend). Les temps forts tombent sur les notes de l'accord ; entre eux, la mélodie passe par la gamme (sur un accord majeur en fa mineur, comme do, elle prend le mi bécarre).
- **Son** (supersaw, leads, hoovers, stabs ou le preset du synthé en cours), **densité** (aérée, moyenne, dense), **registre** (médium, aigu), **doublée à l'octave**.
- **Nouvelle idée** tire une autre mélodie et la fait écouter ; **Écouter** joue exactement ce que **Générer** posera (un deuxième clic arrête).
- La mélodie est posée en **un seul bloc de notes**, répété sur toute la durée : double-cliquez dessus pour la retoucher note par note dans le piano roll.

**Modifier les notes avant de les poser**

- Sous les réglages, un **piano roll** montre le **brouillon** de l'onglet affiché : les notes d'un passage de la suite d'accords (les accords dans l'onglet Accords, la mélodie dans l'onglet Mélodie). Il s'édite comme le [piano roll](timeline.md) : clic = poser une note, glisser = déplacer, bord droit = durée, clic droit = effacer, Maj + glisser = sélection ; touches Ctrl+C / Ctrl+V / Suppr / flèches quand il a le focus.
- Tant que le brouillon n'a pas été retouché, chaque réglage le recalcule. Une fois **retouché à la main**, les réglages ne le changent plus : **Recalculer** repart des réglages (Nouvelle idée aussi, pour la mélodie).
- **Écouter** et **Générer** utilisent le brouillon tel qu'il est affiché. Les accords sont posés en un bloc de notes par accord (chacun garde son nom), la mélodie en un seul bloc. Le brouillon est enregistré avec le projet.

---

← [Instruments](instruments.md) · [Sommaire](README.md) · [Mixage et effets](mixage.md) →
