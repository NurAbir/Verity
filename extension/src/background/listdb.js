// IndexedDB adapter for downloaded lists (too big for chrome.storage). One object store, one transaction per write.
const DB_NAME = 'verity-lists';
const STORE = 'lists';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = work(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(out); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Storage transaction failed')); };
  });
}

export const idbStore = {
  async getAll(keys) {
    const out = {};
    await run('readonly', (s) => keys.forEach((k) => { const r = s.get(k); r.onsuccess = () => { if (r.result !== undefined) out[k] = r.result; }; }));
    return out;
  },
  putMany: (entries) => run('readwrite', (s) => Object.entries(entries).forEach(([k, v]) => s.put(v, k))),
  clear: () => run('readwrite', (s) => s.clear()),
};
