// Câblage : débrancher la 303 du master la coupe, la faire passer par une boîte de distorsion la rend audible,
// une boucle est refusée, câbles tirés et retirés à la souris, réglages d'une boîte, export à travers une boîte.
const rms = (ch, a, b) => { let s = 0; for (let i = a; i < b; i++) s += ch[i] * ch[i]; return Math.sqrt(s / Math.max(1, b - a)); };

export default async function (t, A) {
  const S = A.state, E = A.engine;
  const buf = new Float32Array(2048);
  const master = async ms => {
    let peak = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { E.analyser.getFloatTimeDomainData(buf); for (const v of buf.slice(0, 1024)) peak = Math.max(peak, Math.abs(v)); await t.wait(20); }
    return peak;
  };
  S.acid.link = false;
  A.acid.start();
  const direct = await master(700);
  t.ok(direct > 0.05, 'la 303 sonne, branchée au master', direct);
  S.patch.links = S.patch.links.filter(l => l.from !== 'acid');
  A.patch.rebuild();
  await master(300);
  const unplugged = await master(500);
  t.ok(unplugged < 0.01, 'débranchée, elle se tait', unplugged);
  t.ok(A.acid.playing, 'elle continue de jouer (en silence)');
  A.addBox('dist');
  const box = S.patch.boxes.at(-1);
  A.addLink('acid', box.id);
  const boxOnly = await master(500);
  t.ok(boxOnly < 0.01, 'une boîte non reliée au master reste muette', boxOnly);
  A.addLink(box.id, 'master');
  const viaBox = await master(700);
  t.ok(viaBox > 0.05, 'à travers la distorsion jusqu\'au master, elle sonne', viaBox);
  A.acid.stop();
  A.addBox('delay');
  const b2 = S.patch.boxes.at(-1);
  A.addLink(box.id, b2.id);
  const n = S.patch.links.length;
  A.addLink(b2.id, box.id);
  t.eq(S.patch.links.length, n, 'une boucle est refusée');
  t.ok(t.$('#toast')?.textContent.length > 0, 'avec un message');

  // Fenêtre : câble tiré à la souris, retiré d'un clic.
  Object.assign(S.windows.patch, { x: 300, y: 110, w: 1040, h: 600 });
  A.wm.toggle('patch', true);
  await t.wait(500);
  t.ok(t.$$('.patch-node').length >= 8, 'un bloc par outil et par boîte');
  const wires = () => t.$$('#patch-wires .wire:not(.temp)').length;
  const w0 = wires();
  const out = t.$('.jack.out[data-node="decks"]');
  const tgt = t.$(`.patch-node[data-node="${b2.id}"]`);
  const r1 = out.getBoundingClientRect(), r2 = tgt.getBoundingClientRect();
  out.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: r1.left + 7, clientY: r1.top + 7 }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: r2.left + 40, clientY: r2.top + 20 }));
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: r2.left + 40, clientY: r2.top + 20 }));
  await t.wait(100);
  t.eq(wires(), w0 + 1, 'un câble tiré à la souris est ajouté');
  t.ok(S.patch.links.some(l => l.from === 'decks' && l.to === b2.id), 'il relie les platines à la boîte');
  t.$('#patch-wires .wire:not(.temp)').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await t.wait(100);
  t.eq(wires(), w0, 'un clic sur un câble le retire');
  tgt.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  await t.wait(100);
  t.ok(t.$$('#fx-editor .fx-param').length > 0, 'double-clic : réglages de la boîte');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  // Export : la timeline passe par une boîte PCF.
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; });
  const find = nm => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === nm) return p; };
  const pad = find('Supersaw chords');
  await A.tlPlaceItem({ sampleId: 'lib:' + pad.file, name: pad.name, cat: pad.cat, bpm: pad.bpm, loop: true, bars: 4 }, 0, 0);
  S.patch.links = S.patch.links.filter(l => l.from !== 'tl');
  S.patch.links.push({ from: 'tl', to: 'master' });
  A.patch.rebuild();
  const dry = (await A.renderSong())[0];
  A.addBox('pcf');
  const pcf = S.patch.boxes.at(-1);
  S.patch.links = S.patch.links.filter(l => l.from !== 'tl');
  A.addLink('tl', pcf.id);
  A.addLink(pcf.id, 'master');
  const wet = (await A.renderSong())[0];
  const N = Math.min(dry.length, wet.length);
  let d = 0;
  for (let i = 0; i < N; i += 5) d += (dry[i] - wet[i]) ** 2;
  t.ok(rms(dry, 0, N) > 0.01 && rms(wet, 0, N) > 0.01, 'l\'export sonne avec et sans la boîte');
  t.ok(Math.sqrt(d / (N / 5)) > 0.01, 'l\'export passe par la boîte PCF (même câblage qu\'en direct)');
  t.$('[data-win="patch"] .win-help').click();
  t.ok(t.$$('.win-help-pop li').length > 0, 'l\'aide de la fenêtre s\'ouvre');
}
