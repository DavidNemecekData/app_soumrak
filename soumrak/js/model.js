/* Datový model a práce s datem.
   Klíč dne je lokální "YYYY-MM-DD" — nikdy ne toISOString(), ta počítá v UTC
   a v našem pásmu by večerní zápis spadl na následující den. */

import { WEEKDAYS_LONG, MONTHS_IN, QUADRANT } from './strings.cs.js';

export const SCHEMA_VERSION = 1;

/** Hodina, do které se zápis ještě počítá k předchozímu dni. */
export const NIGHT_CUTOFF_HOUR = 4;

/** Kolik dní zpět jde doplňovat. */
export const BACKFILL_LIMIT = 7;

export const SLEEP_MIN = 0;
export const SLEEP_MAX = 14;
export const SLEEP_STEP = 0.5;

/** Strop poznámky. Není to technické omezení, ale rozhodnutí — viz SPEC §2.2. */
export const NOTE_MAX = 280;

/** „6,5 h" — česká desetinná čárka, celé hodiny bez desetinné části. */
export function formatHours(h) {
  if (!has(h)) return '—';
  const s = Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ',');
  return `${s} h`;
}

export function clampSleep(h) {
  return Math.max(SLEEP_MIN, Math.min(SLEEP_MAX, Math.round(h / SLEEP_STEP) * SLEEP_STEP));
}

export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Den, ke kterému zápis patří. Mezi půlnocí a 4:00 je to ještě včerejšek —
    kdo píše ve dvě ráno, hodnotí den, který právě skončil. */
export function logicalToday(now = new Date()) {
  const d = new Date(now.getTime());
  if (d.getHours() < NIGHT_CUTOFF_HOUR) d.setDate(d.getDate() - 1);
  return dateKey(d);
}

export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Počet dní mezi dvěma klíči (b - a). */
export function diffDays(a, b) {
  const ms = keyToDate(b).getTime() - keyToDate(a).getTime();
  return Math.round(ms / 86400000);
}

/** Pondělí = 0 … neděle = 6. */
export function weekIndex(key) {
  return (keyToDate(key).getDay() + 6) % 7;
}

export function formatLong(key) {
  const d = keyToDate(key);
  return `${WEEKDAYS_LONG[weekIndex(key)]} ${d.getDate()}. ${MONTHS_IN[d.getMonth()]}`;
}

export function formatShort(key) {
  const d = keyToDate(key);
  return `${d.getDate()}. ${d.getMonth() + 1}.`;
}

export function formatTime(iso) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ── záznam ──────────────────────────────────────────────────── */

export function makeEntry(day, now = new Date()) {
  const stamp = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    day,
    createdAt: stamp,
    updatedAt: stamp,
    retrospective: false,
    mood: null,
    energy: null,
    // Pole níž se v aplikaci zatím nevyplňují, ale jsou v modelu od začátku,
    // aby pozdější fáze nemusely migrovat existující záznamy.
    anxiety: null,
    sleep: { hours: null, quality: null, bedtime: null, wake: null },
    meds: null,
    tags: [],
    note: '',
    helped: []
  };
}

/** Záznam je platný, jakmile má náladu. Všechno ostatní je dobrovolné. */
export function isValid(entry) {
  return !!entry && has(entry.mood);
}

/**
 * Doplní chybějící pole na dnešní tvar modelu. Používá se při obnově ze
 * zálohy: záznam z dřívější verze nesmí po načtení shodit obrazovku jen
 * proto, že v něm ještě nebylo `sleep` nebo `tags`.
 */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.day !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) return null;

  const base = makeEntry(raw.day);
  const e = { ...base, ...raw };

  e.schemaVersion = SCHEMA_VERSION;
  e.sleep = { ...base.sleep, ...(raw.sleep && typeof raw.sleep === 'object' ? raw.sleep : {}) };
  e.sleep.hours = has(e.sleep.hours) && e.sleep.hours >= SLEEP_MIN && e.sleep.hours <= SLEEP_MAX
    ? clampSleep(e.sleep.hours) : null;
  e.sleep.quality = has(e.sleep.quality) && e.sleep.quality >= 1 && e.sleep.quality <= 5
    ? e.sleep.quality : null;
  e.tags = Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string') : [];
  e.helped = Array.isArray(raw.helped) ? raw.helped.filter((t) => typeof t === 'string') : [];
  e.meds = Array.isArray(raw.meds)
    ? raw.meds.filter((m) => m && typeof m.id === 'string').map((m) => ({ id: m.id, taken: !!m.taken }))
    : null;
  e.note = typeof raw.note === 'string' ? raw.note.slice(0, NOTE_MAX) : '';
  // „pomohlo" musí být podmnožinou štítků, jinak by ukazovalo na nic
  e.helped = e.helped.filter((t) => e.tags.includes(t));
  e.createdAt = raw.createdAt || base.createdAt;
  e.updatedAt = raw.updatedAt || e.createdAt;
  e.retrospective = !!raw.retrospective;

  // hodnoty mimo rozsah škály jsou poškozená data, ne validní vstup
  e.mood = has(raw.mood) && raw.mood >= -3 && raw.mood <= 3 ? raw.mood : null;
  e.energy = has(raw.energy) && raw.energy >= 1 && raw.energy <= 5 ? raw.energy : null;
  e.anxiety = has(raw.anxiety) && raw.anxiety >= 1 && raw.anxiety <= 5 ? raw.anxiety : null;

  return e;
}

/** Zápis starší než jeden den se označí jako zpětný — retrospektivní
    vzpomínka je méně spolehlivá a statistiky ji musí umět vyloučit. */
export function isRetrospective(day, now = new Date()) {
  return diffDays(day, logicalToday(now)) > 1;
}

export function touch(entry, now = new Date()) {
  entry.updatedAt = now.toISOString();
  entry.retrospective = isRetrospective(entry.day, now);
  return entry;
}

/**
 * Ověří obálku zálohy a vrátí očištěné záznamy, nebo null, když to záloha
 * Soumraku není. Čistá funkce — jde na ni pustit test bez souboru a bez DB.
 */
export function parseBackup(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.app !== 'soumrak' || !Array.isArray(data.days)) return null;
  // Zálohu z novější verze schématu nedokážeme poctivě přečíst.
  if (typeof data.schemaVersion === 'number' && data.schemaVersion > SCHEMA_VERSION) return null;

  const seen = new Set();
  const out = [];
  for (const raw of data.days) {
    const e = normalize(raw);
    if (!e || seen.has(e.day)) continue;   // duplicitní den v souboru bereme jednou
    seen.add(e.day);
    out.push(e);
  }
  return out;
}

/* ── cirkumplex ──────────────────────────────────────────────── */

/** Vyplněná hodnota — null i undefined znamenají „nezadáno“. */
export function has(v) {
  return v !== null && v !== undefined;
}

export function quadrantKey(mood, energy) {
  if (!has(mood) || !has(energy)) return null;
  if (mood === 0 || energy === 3) return 'mid';
  return (mood > 0 ? 'hi' : 'lo') + '-' + (energy > 3 ? 'hi' : 'lo');
}

export function quadrantLabel(mood, energy) {
  const k = quadrantKey(mood, energy);
  return k ? QUADRANT[k] : null;
}

/* ── barvy škály ─────────────────────────────────────────────── */

const RAMP = ['#F44D4D', '#EA726A', '#D89388', '#B1B1C1', '#95CFA0', '#7DE68F', '#63FB78'];

export function moodColor(v) {
  return RAMP[Math.max(-3, Math.min(3, v)) + 3];
}

/** Číslo se znaménkem, česky s desetinnou čárkou a typografickým minus (U+2212).
    Spojovník je v číselném sloupci příliš krátký a sedí nízko. */
export function signed(n, digits = 1) {
  // Znaménko se řídí až zaokrouhlenou hodnotou. Průměr −0,047 se jinak
  // zobrazí jako „−0,0", což je matoucí a typograficky nesmysl.
  const rounded = Number(n.toFixed(digits));
  const body = Math.abs(rounded).toFixed(digits).replace('.', ',');
  if (rounded > 0) return '+' + body;
  if (rounded < 0) return '−' + body;
  return body;
}
