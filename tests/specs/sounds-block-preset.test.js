// Bloc de notes avec son propre preset : il garde sa saturation et son chorus, quels que soient ceux du synthé du clavier
// (avant, toutes les pistes passaient par la saturation du preset en cours : les accords écrasés par celle du lead).
export default async function (t, A) {
  const S = A.state;
  const peak = ch => { let p = 0; for (const c of ch) for (const v of c) p = Math.max(p, Math.abs(v)); return 20 * Math.log10(p); };
  S.bpm = 150;
  S.tl.tracks.forEach(tr => { tr.clips = []; });
  S.tl.tracks[0].clips = [{ id: 'ch', type: 'note', start: 0, len: 4, loop: false, pat: 4, preset: 'dark_strings', name: 'Fm', cat: 'pad',
    seq: [53, 56, 60].map(note => ({ t: 0, len: 4, note, vel: 0.8 })) }];
  const keep = { ...S.globals };
  Object.assign(S.globals, { drive: 0, chorus: 0 });
  const clean = peak(await A.renderSong(0, { freeze: true }));
  Object.assign(S.globals, { drive: 0.95, chorus: 0.85 });
  const loud = peak(await A.renderSong(0, { freeze: true }));
  t.near(loud, clean, 0.5, 'saturation et chorus du clavier sans effet sur un bloc qui a son preset (dB)');
  // Sans preset, le bloc joue le synthé du clavier, avec ses réglages.
  S.tl.tracks[0].clips[0].preset = undefined;
  S.preset = 'dark_strings';
  const keyboard = peak(await A.renderSong(0, { freeze: true }));
  Object.assign(S.globals, { drive: 0, chorus: 0 });
  t.ok(Math.abs(keyboard - peak(await A.renderSong(0, { freeze: true }))) > 1, 'un bloc sans preset passe par la saturation du clavier');
  // Le preset du bloc garde sa propre saturation : la basse (drive 0,85) plus forte en crête qu'avec sa saturation coupée.
  S.tl.tracks[0].clips = [{ id: 'b', type: 'note', start: 0, len: 4, loop: false, pat: 4, preset: 'bass', name: 'B', cat: 'bass',
    seq: [0, 1, 2, 3].map(b => ({ t: b + 0.5, len: 0.4, note: 29, vel: 0.6 })) }];
  const driven = peak(await A.renderSong(0, { freeze: true }));
  const P = A.presetPatch('bass'), d = P.values.drive;
  P.values.drive = 0;
  const dry = peak(await A.renderSong(0, { freeze: true }));
  P.values.drive = d;
  t.ok(driven > dry + 3, 'la saturation du preset du bloc s’applique', { driven, dry });
  Object.assign(S.globals, keep);
}
