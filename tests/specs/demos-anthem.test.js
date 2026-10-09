// Démos 3, 4 et 5 (bibliothèque Anthem) : chargement, sons présents, noms traduits, structure, rendu sans écrêtage.
const missing = A => [...new Set(A.state.tl.tracks.flatMap(tr => tr.clips.map(c => c.sampleId)).filter(Boolean))].filter(id => !A.clipBuffer(id));

export default async function (t, A) {
  const S = A.state;
  for (const n of [3, 4, 5]) {
    t.$('#tl-demo').click();
    await t.wait(100);
    t.$(`.demo-pick[data-demo="${n}"]`).click();
    t.ok(await t.until(() => S.tl.bars === 64 && S.tl.tracks.some(tr => tr.clips.some(c => c.sampleId?.startsWith('lib:anthem-'))), 20000), `démo ${n} chargée`);
    await t.until(() => !missing(A).length, 15000);
    t.eq(missing(A), [], `démo ${n} : tous les sons sont là`);
    t.ok(S.tl.tracks.every(tr => tr.clips.every(c => !c.sampleId || c.sampleId.startsWith('lib:anthem-'))), `démo ${n} : uniquement la bibliothèque Anthem`);
    const fx = S.tl.tracks.flatMap(tr => tr.fx);
    t.ok(fx.length >= 10, `démo ${n} : des effets de piste`, fx.length);
    t.ok(fx.some(b => b.fx === 'curve'), `démo ${n} : des courbes du designer`);
    t.ok(fx.every(b => !/^b:/.test(b.name)), `démo ${n} : noms des courbes traduits`, fx.map(b => b.name));
    const ch = await A.renderSong();
    const sr = A.engine.ctx.sampleRate, seg = Math.round(8 * 4 * 60 / S.bpm * sr), sections = [];
    let peak = 0;
    for (let s = 0; s < ch[0].length; s += seg) {
      let r = 0, m = 0;
      for (let i = s; i < Math.min(ch[0].length, s + seg); i += 4) for (const c of ch) { r += c[i] * c[i]; peak = Math.max(peak, Math.abs(c[i])); m++; }
      sections.push(Math.sqrt(r / m));
    }
    t.ok(peak > 0.5 && peak < 1, `démo ${n} : rendu sans écrêtage`, peak);
    t.ok(Math.max(sections[2], sections[3]) > sections[0] * 1.5, `démo ${n} : le drop est plus fort que l'intro`, sections.map(x => +x.toFixed(3)));
  }
}
