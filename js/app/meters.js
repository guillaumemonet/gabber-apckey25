// Vumètres de l'interface (en-tête, table de mixage, bus, entrée audio) : un niveau qui retombe doucement, dessiné
// en vert, jaune puis rouge ; rien n'est redessiné tant que la barre ne bouge pas d'un pixel.

const color = lvl => (lvl > 0.95 ? '#ff5a36' : lvl > 0.7 ? '#ffd23f' : '#3dd68c');

/**
 * Vumètre sur un canvas. vertical : barre qui monte (sinon de gauche à droite) ; decay : retombée par image ;
 * yellow : false pour passer directement du vert au rouge. -> update(niveau 0..1+)
 */
export function levelMeter(cv, { vertical = false, decay = 0.88, yellow = true } = {}) {
  const g = cv.getContext('2d');
  let level = 0, drawn = -1, drawnColor = '';
  return value => {
    level = Math.max(value, level * decay);
    const len = Math.round(Math.min(1, level) * (vertical ? cv.height : cv.width));
    const c = yellow ? color(level) : level > 0.95 ? '#ff5a36' : '#3dd68c';
    if (len === drawn && c === drawnColor) return;
    drawn = len;
    drawnColor = c;
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = c;
    if (vertical) g.fillRect(0, cv.height - len, cv.width, len);
    else g.fillRect(0, 0, len, cv.height);
  };
}

/** Crête d'un signal (valeur absolue la plus grande). */
export function peakOf(data) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] < 0 ? -data[i] : data[i];
    if (v > peak) peak = v;
  }
  return peak;
}
