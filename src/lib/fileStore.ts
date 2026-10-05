/**
 * Stockage des fichiers originaux (factures, cartes grises…) dans IndexedDB, dans le
 * navigateur de l'utilisateur. Le texte extrait et les données validées sont conservés
 * avec les données du client ; le fichier original sert à la consultation et à l'audit.
 * Toutes les opérations tolèrent un stockage indisponible (navigation privée, quota).
 */
const DB_NAME = 'carbon-jar-files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const r = run(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}

export const saveFile = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id)).then((r) => r !== undefined);
export const loadFile = (id: string) => tx<Blob>('readonly', (s) => s.get(id));
export const deleteFile = (id: string) => tx('readwrite', (s) => s.delete(id));
