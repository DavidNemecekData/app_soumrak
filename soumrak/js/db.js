/* IndexedDB — tenká obálka bez závislostí.
   Úložiště: days (klíč = "YYYY-MM-DD"), settings, meta.
   Verze schématu se zvyšuje jen v onupgradeneeded, aby šlo migrovat. */

const DB_VERSION = 1;

let dbName = 'soumrak';
let _db = null;

/** Přepne se na jinou databázi. Používá to jen autotest, aby si nesáhl
    na ostrá data. Zavře se tím i případné otevřené spojení. */
export function useDatabase(name) {
  if (_db) { _db.close(); }
  _db = null;
  dbName = name;
}

export function currentDatabase() {
  return dbName;
}

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = req.result;
      // Fáze 1 zakládá jen to, co používá. Dotazníky přibudou ve verzi 2
      // vlastním upgradem, existující dny se nesmí dotknout.
      if (!db.objectStoreNames.contains('days')) {
        db.createObjectStore('days', { keyPath: 'day' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'k' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'k' });
      }
      void e;
    };

    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => { _db.close(); _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Databáze je blokovaná jiným oknem.'));
  });
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    try { out = fn(s); } catch (err) { reject(err); return; }
    // Pozor: u nenalezeného záznamu je out.result rovno undefined, takže se
    // nesmí testovat na hodnotu — jinak by se ven vrátil samotný IDBRequest.
    t.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/* ── dny ─────────────────────────────────────────────────────── */

export function getDay(day) {
  return tx('days', 'readonly', (s) => s.get(day));
}

export function putDay(entry) {
  return tx('days', 'readwrite', (s) => s.put(entry));
}

export function deleteDay(day) {
  return tx('days', 'readwrite', (s) => s.delete(day));
}

/** Hromadné uložení v jedné transakci. Po jednom trvá obnova roční zálohy
    jednotky sekund, takhle desítky milisekund. */
export function putDays(entries) {
  return tx('days', 'readwrite', (s) => {
    for (const e of entries) s.put(e);
    return entries.length;
  });
}

/** Všechny dny vzestupně podle klíče. */
export function allDays() {
  return tx('days', 'readonly', (s) => s.getAll());
}

/** Dny v rozsahu včetně obou krajů, klíče "YYYY-MM-DD". */
export function daysBetween(from, to) {
  return tx('days', 'readonly', (s) => s.getAll(IDBKeyRange.bound(from, to)));
}

export function countDays() {
  return tx('days', 'readonly', (s) => s.count());
}

/* ── nastavení a meta ────────────────────────────────────────── */

export function getSetting(k, fallback = null) {
  return tx('settings', 'readonly', (s) => s.get(k))
    .then((r) => (r === undefined ? fallback : r.v));
}

export function setSetting(k, v) {
  return tx('settings', 'readwrite', (s) => s.put({ k, v }));
}

export function getMeta(k, fallback = null) {
  return tx('meta', 'readonly', (s) => s.get(k))
    .then((r) => (r === undefined ? fallback : r.v));
}

export function setMeta(k, v) {
  return tx('meta', 'readwrite', (s) => s.put({ k, v }));
}

/* ── trvalé úložiště ─────────────────────────────────────────── */

/** Android smí data neperzistentního původu při nedostatku místa smazat.
    Vrací true, jen když je perzistence skutečně přiznaná. */
export async function requestPersistence() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isPersisted() {
  if (!navigator.storage || !navigator.storage.persisted) return false;
  try { return await navigator.storage.persisted(); } catch { return false; }
}

export async function estimate() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try { return await navigator.storage.estimate(); } catch { return null; }
}
