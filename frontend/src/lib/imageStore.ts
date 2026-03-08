// IndexedDB-backed image store — survives localStorage quota limits

const DB_NAME = 'adgen_images';
const DB_VERSION = 1;
const STORE_NAME = 'variant_images';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveImage(variantId: string, dataUrl: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrl, variantId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadImage(variantId: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(variantId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllImages(variantIds: string[]): Promise<Record<string, string>> {
  if (variantIds.length === 0) return {};
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result: Record<string, string> = {};
    let pending = variantIds.length;
    for (const id of variantIds) {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) result[id] = req.result;
        if (--pending === 0) resolve(result);
      };
      req.onerror = () => {
        if (--pending === 0) resolve(result);
      };
    }
  });
}

export async function deleteImage(variantId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(variantId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
