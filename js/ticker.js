// Une seule boucle d'affichage pour toute l'application : vumètres, têtes de lecture, visualiseur, compteur de charge…
// s'y inscrivent au lieu d'avoir chacun la leur. Une tâche peut dire quand elle sert (fenêtre ouverte, lecture en
// cours) : elle n'est appelée qu'à ce moment-là. La boucle s'arrête quand il n'y a plus de tâche.

const tasks = new Set();
let running = false;

/**
 * Appelle fn(maintenant) à chaque image (quand when() est vrai, s'il est donné). -> fonction qui retire la tâche.
 */
export function everyFrame(fn, when = null) {
  const task = { fn, when };
  tasks.add(task);
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
  return () => tasks.delete(task);
}

function tick(now) {
  for (const task of tasks) {
    if (task.when && !task.when()) continue;
    try { task.fn(now); } catch (err) { console.warn('Image', err); }
  }
  if (tasks.size) requestAnimationFrame(tick);
  else running = false;
}
