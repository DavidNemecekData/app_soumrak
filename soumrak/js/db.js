/* IndexedDB — tenká obálka bez závislostí.
   Úložiště: days (klíč = "YYYY-MM-DD"), assessments, thoughts, settings, meta.
   Verze schématu se zvyšuje jen v onupgradeneeded, aby šlo migrovat. */

const DB_VERSION = 2;

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

    req.onupgradeneeded = () => {
      const db = req.result;

      // Verze 1 — deník. Existující dny se při žádné pozdější migraci
      // nesmí dotknout; nové úložiště se jen přidá vedle.
      if (!db.objectStoreNames.contains('days')) {
        db.createObjectStore('days', { keyPath: 'day' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'k' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'k' });
      }

      // Verze 2 — dotazníky a záznamy myšlenek.
      if (!db.objectStoreNames.contains('assessments')) {
        const s = db.createObjectStore('assessments', { keyPath: 'id', autoIncrement: true });
        // Složený index drží historii jednoho dotazníku rovnou seřazenou
        // podle času, takže poslední vyplnění je čtení jednoho klíče.
        s.createIndex('by_instrument', ['instrument', 'takenAt']);
        s.createIndex('by_taken', 'takenAt');
      }
      if (!db.objectStoreNames.contains('thoughts')) {
        const s = db.createObjectStore('thoughts', { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_day', 'day');
        s.createIndex('by_created', 'createdAt');
      }
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

/* ── dotazníky ───────────────────────────────────────────────── */

/** Uloží vyplněný dotazník. Bez `id` se založí nový, s `id` se přepíše. */
export function putAssessment(a) {
  return tx('assessments', 'readwrite', (s) => s.put(a));
}

export function putAssessments(list) {
  return tx('assessments', 'readwrite', (s) => {
    for (const a of list) s.put(a);
    return list.length;
  });
}

export function deleteAssessment(id) {
  return tx('assessments', 'readwrite', (s) => s.delete(id));
}

export function allAssessments() {
  return tx('assessments', 'readonly', (s) => s.getAll());
}

/** Historie jednoho dotazníku, od nejstaršího. */
export function assessmentsFor(instrument) {
  return tx('assessments', 'readonly', (s) => s.index('by_instrument').getAll(
    IDBKeyRange.bound([instrument, ''], [instrument, '￿'])
  ));
}

/** Poslední vyplnění daného dotazníku, nebo undefined. */
export function lastAssessment(instrument) {
  return assessmentsFor(instrument).then((list) => list[list.length - 1]);
}

export function countAssessments() {
  return tx('assessments', 'readonly', (s) => s.count());
}

/* ── záznamy myšlenek ────────────────────────────────────────── */

export function putThought(r) {
  return tx('thoughts', 'readwrite', (s) => s.put(r));
}

export function putThoughts(list) {
  return tx('thoughts', 'readwrite', (s) => {
    for (const r of list) s.put(r);
    return list.length;
  });
}

export function getThought(id) {
  return tx('thoughts', 'readonly', (s) => s.get(id));
}

export function deleteThought(id) {
  return tx('thoughts', 'readwrite', (s) => s.delete(id));
}

export function allThoughts() {
  return tx('thoughts', 'readonly', (s) => s.getAll());
}

export function thoughtsForDay(day) {
  return tx('thoughts', 'readonly', (s) => s.index('by_day').getAll(IDBKeyRange.only(day)));
}

export function countThoughts() {
  return tx('thoughts', 'readonly', (s) => s.count());
}

/* ── nastavení a meta ────────────────────────────────────────── */

export function getSetting(k, fallback = null) {
  return tx('settings', 'readonly', (s) => s.get(k))
    .then((r) => (r === undefined ? fallback : r.v));
}

export function setSetting(k, v) {
  return tx('settings', 'readwrite', (s) => s.put({ k, v }));
}

export function allSettings() {
  return tx('settings', 'readonly', (s) => s.getAll());
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
