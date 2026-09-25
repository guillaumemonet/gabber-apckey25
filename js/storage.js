// Sauvegarde locale (IndexedDB) : réglages + fichiers audio importés.

const DB_NAME = 'apc-studio';
let dbPromise;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('state');
      req.result.createObjectStore('samples');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const loadState = () => tx('state', 'readonly', s => s.get('main'));
export const saveState = state => tx('state', 'readwrite', s => s.put(state, 'main'));
export const loadSample = id => tx('samples', 'readonly', s => s.get(id));
export const saveSample = (id, sample) => tx('samples', 'readwrite', s => s.put(sample, id));
export const deleteSample = id => tx('samples', 'readwrite', s => s.delete(id));
export const clearAll = () => Promise.all([
  tx('state', 'readwrite', s => s.clear()),
  tx('samples', 'readwrite', s => s.clear()),
]);
