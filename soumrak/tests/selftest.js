/* Autotest Soumraku.
   Běží v prohlížeči, takže se dá spustit i na telefonu — to je smysl:
   ověřit chování na tom zařízení, kde aplikace opravdu poběží.

   Testy dat běží nad oddělenou databází, ostrých záznamů se nedotknou. */

import * as db from '../js/db.js';
import * as M from '../js/model.js';
import * as INS from '../js/instruments.js';
import * as TH from '../js/thoughts.js';
import { mean, rollingMean, segments, seriesFor, distribution, buckets } from '../js/stats.js';
import {
  T, MOOD_ANCHORS, MOOD_PHRASE, QUADRANT, ENERGY_ANCHORS, ANXIETY_ANCHORS,
  SLEEPQ_ANCHORS, EMOTIONS, STRATEGIES, gender, hyphenate
} from '../js/strings.cs.js';

const TEST_DB = 'soumrak-selftest';

/* ── mikroskopický testovací rámec ───────────────────────────── */

const results = [];
let group = '';

function describe(name) { group = name; }

function it(name, fn) {
  const rec = { group, name, ok: false, detail: '' };
  try {
    const r = fn();
    if (r instanceof Promise) {
      return r.then(() => { rec.ok = true; results.push(rec); })
              .catch((e) => { rec.detail = e.message; results.push(rec); });
    }
    rec.ok = true;
  } catch (e) {
    rec.detail = e.message;
  }
  results.push(rec);
  return Promise.resolve();
}

function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} očekáváno ${b}, dostal ${a}`);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'nepravda'); }

/* ── datum ───────────────────────────────────────────────────── */

async function testDates() {
  describe('Datum a klíče');

  await it('dateKey používá lokální čas, ne UTC', () => {
    // 23:30 lokálně je v UTC už další den — klíč musí zůstat u lokálního dne
    eq(M.dateKey(new Date(2026, 6, 30, 23, 30)), '2026-07-30');
    eq(M.dateKey(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
  });

  await it('klíč a Date jsou navzájem převoditelné', () => {
    for (const k of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) {
      eq(M.dateKey(M.keyToDate(k)), k, k);
    }
  });

  await it('noční hranice 04:00 posílá zápis na předchozí den', () => {
    eq(M.logicalToday(new Date(2026, 6, 30, 0, 0)), '2026-07-29', 'půlnoc:');
    eq(M.logicalToday(new Date(2026, 6, 30, 3, 59)), '2026-07-29', '3:59:');
    eq(M.logicalToday(new Date(2026, 6, 30, 4, 0)), '2026-07-30', '4:00:');
    eq(M.logicalToday(new Date(2026, 6, 30, 21, 0)), '2026-07-30', '21:00:');
  });

  await it('noční hranice přes měsíc, rok a přestupný den', () => {
    eq(M.logicalToday(new Date(2026, 7, 1, 1, 0)), '2026-07-31', 'přes měsíc:');
    eq(M.logicalToday(new Date(2026, 0, 1, 2, 0)), '2025-12-31', 'přes rok:');
    eq(M.logicalToday(new Date(2028, 2, 1, 1, 0)), '2028-02-29', 'přestupný:');
  });

  await it('addDays zvládá konce měsíců, roků i přestupný rok', () => {
    eq(M.addDays('2026-01-31', 1), '2026-02-01');
    eq(M.addDays('2026-12-31', 1), '2027-01-01');
    eq(M.addDays('2027-01-01', -1), '2026-12-31');
    eq(M.addDays('2028-02-28', 1), '2028-02-29', 'přestupný rok:');
    eq(M.addDays('2026-02-28', 1), '2026-03-01', 'nepřestupný rok:');
    eq(M.addDays('2026-07-30', -29), '2026-07-01', 'okno 30 dní:');
  });

  await it('diffDays přežije přechod na letní a zimní čas', () => {
    // ČR 2026: letní čas začíná 29. 3., končí 25. 10.
    // Ty dny mají 23 a 25 hodin — dělení 86 400 000 by bez zaokrouhlení selhalo.
    eq(M.diffDays('2026-03-29', '2026-03-30'), 1, 'den s 23 hodinami:');
    eq(M.diffDays('2026-10-25', '2026-10-26'), 1, 'den s 25 hodinami:');
    eq(M.diffDays('2026-03-01', '2026-04-01'), 31, 'březen přes přechod:');
    eq(M.diffDays('2026-10-01', '2026-11-01'), 31, 'říjen přes přechod:');
    eq(M.diffDays('2026-01-01', '2027-01-01'), 365, 'celý rok:');
    eq(M.diffDays('2028-01-01', '2029-01-01'), 366, 'přestupný rok:');
  });

  await it('diffDays je konzistentní na dlouhém úseku', () => {
    // Deset let po dnech — kdyby se chyba z přechodů času kumulovala, tady vyleze.
    // 2026→2036 je 3652 dní: 10 × 365 + 2 přestupné roky (2028 a 2032).
    let key = '2026-01-01';
    for (let i = 0; i < 3652; i++) {
      eq(M.diffDays(key, M.addDays(key, 1)), 1, `krok ${i} (${key}):`);
      key = M.addDays(key, 1);
    }
    eq(key, '2036-01-01', 'konec:');
    eq(M.diffDays('2026-01-01', '2036-01-01'), 3652, 'jedním výpočtem:');
  });

  await it('weekIndex má pondělí jako nulu', () => {
    eq(M.weekIndex('2026-07-27'), 0, 'pondělí:');
    eq(M.weekIndex('2026-07-30'), 3, 'čtvrtek:');
    eq(M.weekIndex('2026-07-26'), 6, 'neděle:');
  });

  await it('české formátování data', () => {
    eq(M.formatLong('2026-07-30'), 'čtvrtek 30. července');
    eq(M.formatLong('2026-01-01'), 'čtvrtek 1. ledna');
    eq(M.formatShort('2026-07-01'), '1. 7.');
  });
}

/* ── model ───────────────────────────────────────────────────── */

async function testModel() {
  describe('Model záznamu');

  await it('nový záznam má všechna pole pozdějších fází', () => {
    const e = M.makeEntry('2026-07-30');
    for (const k of ['schemaVersion','day','createdAt','updatedAt','retrospective',
                     'mood','energy','anxiety','sleep','meds','tags','note','helped',
                     'emotions','strategies']) {
      ok(k in e, `chybí pole ${k}`);
    }
    eq(e.mood, null); eq(e.tags, []); eq(e.schemaVersion, M.SCHEMA_VERSION);
  });

  await it('platnost záznamu drží jen nálada', () => {
    const e = M.makeEntry('2026-07-30');
    ok(!M.isValid(e), 'prázdný nesmí být platný');
    e.energy = 3;
    ok(!M.isValid(e), 'samotná energie nestačí');
    e.mood = 0;
    ok(M.isValid(e), 'nulová nálada je platná hodnota');
    e.mood = -3;
    ok(M.isValid(e), 'záporná nálada je platná');
  });

  await it('has() nerozlišuje null a undefined, ale nula projde', () => {
    ok(M.has(0), 'nula je hodnota');
    ok(M.has(-3), 'záporné číslo je hodnota');
    ok(!M.has(null)); ok(!M.has(undefined));
  });

  await it('zpětný zápis se pozná od včerejška', () => {
    const now = new Date(2026, 6, 30, 21, 0);
    ok(!M.isRetrospective('2026-07-30', now), 'dnešek není zpětný');
    ok(!M.isRetrospective('2026-07-29', now), 'včerejšek ještě není zpětný');
    ok(M.isRetrospective('2026-07-28', now), 'předevčírem už je zpětný');
    ok(M.isRetrospective('2026-07-01', now), 'měsíc zpět je zpětný');
  });

  await it('příznak zpětného zápisu se rozhoduje při vzniku záznamu', () => {
    // Všechny časy se předávají výslovně — test se nesmí opírat o systémové hodiny.
    const same = M.makeEntry('2026-07-25', new Date(2026, 6, 25, 21, 30));
    eq(same.retrospective, false, 'zápis v ten samý večer není zpětný');

    const late = M.makeEntry('2026-07-25', new Date(2026, 6, 30, 21, 30));
    eq(late.retrospective, true, 'záznam založený o pět dní později je zpětný');
  });

  await it('pozdější oprava záznamu z něj neudělá vzpomínku', () => {
    // Kdyby se příznak počítal při každém uložení, stačilo by po týdnu
    // opravit překlep a poctivě zapsaný den by se navždy tvářil jako doplněný.
    const e = M.makeEntry('2026-07-25', new Date(2026, 6, 25, 21, 30));
    const t1 = new Date(2026, 6, 30, 21, 0);
    M.touch(e, t1);
    eq(e.updatedAt, t1.toISOString(), 'updatedAt musí odpovídat předanému času');
    eq(e.retrospective, false, 'oprava nesmí přepsat příznak');

    const t2 = new Date(2026, 6, 31, 9, 15);
    M.touch(e, t2);
    ok(e.updatedAt > t1.toISOString(), 'pozdější úprava musí posunout čas dopředu');
    ok(e.createdAt <= e.updatedAt, 'vznik nesmí být po poslední úpravě');
  });

  await it('kvadrant pokrývá všech devět kombinací', () => {
    eq(M.quadrantKey(2, 5), 'hi-hi'); eq(M.quadrantKey(2, 1), 'hi-lo');
    eq(M.quadrantKey(-2, 5), 'lo-hi'); eq(M.quadrantKey(-2, 1), 'lo-lo');
    eq(M.quadrantKey(0, 5), 'mid', 'neutrální valence:');
    eq(M.quadrantKey(2, 3), 'mid', 'střední aktivace:');
    eq(M.quadrantKey(null, 3), null); eq(M.quadrantKey(2, null), null);
    eq(M.quadrantKey(undefined, undefined), null, 'undefined nesmí spadnout na lo-lo');
  });

  await it('každý kvadrant má text', () => {
    for (const k of ['hi-hi','hi-lo','lo-hi','lo-lo','mid']) {
      ok(QUADRANT[k] && QUADRANT[k][0] && QUADRANT[k][1], `chybí text pro ${k}`);
    }
  });

  await it('škála má sedm barev a krajní hodnoty se ořezávají', () => {
    const ramp = [-3,-2,-1,0,1,2,3].map(M.moodColor);
    eq(ramp, ['#F44D4D','#EA726A','#D89388','#B1B1C1','#95CFA0','#7DE68F','#63FB78']);
    eq(new Set(ramp).size, 7, 'barvy se nesmí opakovat');
    eq(M.moodColor(-9), '#F44D4D', 'ořez dole:');
    eq(M.moodColor(9), '#63FB78', 'ořez nahoře:');
  });

  await it('každý stupeň má slovní kotvu i větu', () => {
    for (let v = -3; v <= 3; v++) {
      ok(MOOD_ANCHORS[String(v)], `chybí kotva ${v}`);
      ok(MOOD_PHRASE[String(v)], `chybí věta ${v}`);
    }
  });

  await it('normalize doplní chybějící pole staršího záznamu', () => {
    // záznam, jaký by mohl přijít ze zálohy dřívější verze
    const e = M.normalize({ day: '2026-07-30', mood: 2 });
    eq(e.tags, []); eq(e.helped, []); eq(e.note, '');
    eq(e.sleep, { hours: null, quality: null, bedtime: null, wake: null });
    eq(e.anxiety, null);
    eq(e.schemaVersion, M.SCHEMA_VERSION);
    ok(e.createdAt && e.updatedAt, 'chybí razítka');
  });

  await it('záznam z verze 1 dostane pole, která tehdy neexistovala', () => {
    // Regrese: souhrn dne sahal na e.emotions.length a na každém dni
    // zapsaném starší verzí spadl. Migrace úložiště přidá nová úložiště,
    // ale uvnitř uložených objektů nic nemění — dorovnat tvar musí čtenář.
    const v1 = {
      schemaVersion: 1, day: '2026-06-01', createdAt: '2026-06-01T19:00:00.000Z',
      updatedAt: '2026-06-01T19:00:00.000Z', retrospective: false,
      mood: -2, energy: 2, anxiety: 4,
      sleep: { hours: 6, quality: 2, bedtime: null, wake: null },
      meds: null, tags: ['work'], note: 'stará poznámka', helped: []
    };
    const e = M.normalize(v1);
    eq(e.emotions, [], 'chybějící emotions:');
    eq(e.strategies, [], 'chybějící strategies:');
    // a nic z toho, co v záznamu bylo, se nesmí ztratit
    eq(e.mood, -2); eq(e.energy, 2); eq(e.anxiety, 4);
    eq(e.tags, ['work']); eq(e.note, 'stará poznámka');
    eq(e.sleep.hours, 6); eq(e.sleep.quality, 2);
    eq(e.createdAt, v1.createdAt, 'razítko vzniku se nesmí přepsat');
    eq(e.retrospective, false, 'příznak se nesmí přepočítat');
  });

  await it('hodiny spánku se zaokrouhlují na půlhodiny a drží se v rozsahu', () => {
    eq(M.clampSleep(6.3), 6.5); eq(M.clampSleep(6.2), 6);
    eq(M.clampSleep(-4), M.SLEEP_MIN, 'pod rozsahem:');
    eq(M.clampSleep(99), M.SLEEP_MAX, 'nad rozsahem:');
  });

  await it('hodiny se píšou česky a celé bez desetinné části', () => {
    eq(M.formatHours(7), '7 h');
    eq(M.formatHours(6.5), '6,5 h');
    eq(M.formatHours(null), '—');
    eq(M.formatHours(0), '0 h', 'nula je platná hodnota');
  });

  await it('normalize ošetří spánek, léky a poznámku', () => {
    const e = M.normalize({ day: '2026-07-30', mood: 1,
      sleep: { hours: 25, quality: 9 }, note: 'x'.repeat(400),
      meds: [{ id: 'a', taken: true }, { id: 'b' }, { nonsens: 1 }] });
    eq(e.sleep.hours, null, 'hodiny mimo rozsah:');
    eq(e.sleep.quality, null, 'kvalita mimo rozsah:');
    eq(e.note.length, M.NOTE_MAX, 'poznámka se ořízne na strop');
    eq(e.meds, [{ id: 'a', taken: true }, { id: 'b', taken: false }], 'léky:');
  });

  await it('„pomohlo" nikdy neukazuje na štítek, který na dni není', () => {
    const e = M.normalize({ day: '2026-07-30', mood: 1,
      tags: ['sport'], helped: ['sport', 'work', 'neexistuje'] });
    eq(e.helped, ['sport'], 'musí to být podmnožina štítků');
  });

  await it('normalize odmítne poškozený vstup', () => {
    eq(M.normalize(null), null);
    eq(M.normalize({}), null, 'bez dne:');
    eq(M.normalize({ day: '30.7.2026' }), null, 'špatný formát dne:');
    eq(M.normalize({ day: '2026-07-30', mood: 99 }).mood, null, 'nálada mimo škálu:');
    eq(M.normalize({ day: '2026-07-30', mood: -4 }).mood, null, 'nálada pod škálou:');
    eq(M.normalize({ day: '2026-07-30', energy: 0 }).energy, null, 'energie mimo škálu:');
    eq(M.normalize({ day: '2026-07-30', tags: 'work' }).tags, [], 'štítky nejsou pole:');
  });

  await it('normalize zachová platná data beze změny', () => {
    const orig = M.makeEntry('2026-07-30');
    orig.mood = -3; orig.energy = 5; orig.anxiety = 1;
    orig.tags = ['work', 'sport']; orig.note = 'text';
    const e = M.normalize(JSON.parse(JSON.stringify(orig)));
    eq(e.mood, -3); eq(e.energy, 5); eq(e.anxiety, 1);
    eq(e.tags, ['work', 'sport']); eq(e.note, 'text');
    eq(e.createdAt, orig.createdAt, 'vznik se nesmí přepsat');
  });

  await it('čísla se znaménkem a českou čárkou', () => {
    eq(M.signed(0.16), '+0,2'); eq(M.signed(-1.24), '−1,2');
    eq(M.signed(0, 0), '0'); eq(M.signed(-3, 0), '−3'); eq(M.signed(3, 0), '+3');
    ok(M.signed(-1, 0).charCodeAt(0) === 0x2212, 'musí to být typografické minus');
    // znaménko se řídí zaokrouhlenou hodnotou, ne původní
    eq(M.signed(-0.047), '0,0', 'záporná nula:');
    eq(M.signed(0.047), '0,0', 'kladná nula:');
    eq(M.signed(-0.06), '−0,1', 'těsně pod nulou:');
  });

  await it('skloňování dnů', () => {
    eq(T.daysGenitive(1), 'den'); eq(T.daysGenitive(2), 'dny');
    eq(T.daysGenitive(4), 'dny'); eq(T.daysGenitive(5), 'dní');
    eq(T.daysGenitive(30), 'dní'); eq(T.daysGenitive(0), 'dní');
  });
}

/* ── statistika ──────────────────────────────────────────────── */

async function testStats() {
  describe('Statistika');

  await it('průměr ignoruje chybějící dny, nepočítá je jako nulu', () => {
    eq(mean([2, null, 2]), 2, 'null nesmí stáhnout průměr');
    eq(mean([]), null); eq(mean([null, null]), null);
    eq(mean([-3, 3]), 0);
  });

  await it('klouzavý průměr se přeruší, když v okně chybí data', () => {
    const v = [1,1,1,1,null,null,null,null,null,1,1,1,1];
    const r = rollingMean(v, 7, 4);
    ok(r.some((x) => x === null), 'uprostřed díry musí vzniknout null');
    ok(r[0] !== null, 'kraj s dostatkem dat se počítat má');
    ok(r[6] === null, 'střed díry se počítat nesmí');
  });

  await it('klouzavý průměr respektuje práh minN', () => {
    eq(rollingMean([1, null, null, null, null], 7, 4)[0], null, 'málo dat:');
    eq(rollingMean([1, 1, 1, 1, null], 7, 4)[0], 1, 'dost dat:');
  });

  await it('segments dělí řadu na souvislé úseky', () => {
    eq(segments([1, 2, null, 3, 4]), [[1, 2], [3, 4]]);
    eq(segments([null, null]), []);
    eq(segments([1, 2, 3]), [[1, 2, 3]]);
  });

  await it('seriesFor doplní chybějící dny jako null, ne jako díru v poli', () => {
    const entries = [
      { day: '2026-07-01', mood: 1 },
      { day: '2026-07-03', mood: -1 }
    ];
    const s = seriesFor(entries, '2026-07-01', 4, M.addDays);
    eq(s.keys, ['2026-07-01','2026-07-02','2026-07-03','2026-07-04']);
    eq(s.values, [1, null, -1, null]);
  });

  await it('nálada 0 se v řadě nesmí splést s chybějícím dnem', () => {
    const s = seriesFor([{ day: '2026-07-01', mood: 0 }], '2026-07-01', 2, M.addDays);
    eq(s.values, [0, null], 'nula je hodnota, druhý den chybí');
  });

  await it('rozložení počítá všech sedm stupňů a ignoruje mezery', () => {
    eq(distribution([-3, -3, 0, 3, null, undefined]), [2, 0, 0, 1, 0, 0, 1]);
    eq(distribution([]), [0, 0, 0, 0, 0, 0, 0]);
    eq(distribution([null]), [0, 0, 0, 0, 0, 0, 0], 'samé mezery:');
  });

  await it('rozložení nespadne na hodnotě mimo škálu', () => {
    eq(distribution([99, -99, 1]), [0, 0, 0, 0, 1, 0, 0], 'mimo rozsah se zahodí');
    eq(distribution([-3, 3]).reduce((a, b) => a + b, 0), 2, 'krajní hodnoty se počítají');
  });

  await it('bloky slučují po zadaném počtu dní a zvládnou neúplný konec', () => {
    const b = buckets([1, 1, 1, 3, 3, 3, 2, 2], 3, 1);
    eq(b.length, 3, 'poslední blok je kratší:');
    eq(b[0], { from: 0, to: 2, value: 1, n: 3 });
    eq(b[1], { from: 3, to: 5, value: 3, n: 3 });
    eq(b[2], { from: 6, to: 7, value: 2, n: 2 });
  });

  await it('blok s málo zápisy se nevydává za plný týden', () => {
    const b = buckets([2, null, null, null, null, null, null], 7, 2);
    eq(b[0].value, null, 'jediný zápis v týdnu nestačí');
    eq(b[0].n, 1, 'počet se ale hlásí');
    eq(buckets([2, 2, null, null, null, null, null], 7, 2)[0].value, 2, 'dva už stačí');
  });

  await it('rok se poskládá do 53 týdenních bloků', () => {
    const year = new Array(365).fill(1);
    const b = buckets(year, 7, 2);
    eq(b.length, 53);
    eq(b[b.length - 1].to, 364, 'poslední den musí být uvnitř');
    eq(b.reduce((a, x) => a + x.n, 0), 365, 'žádný den se nesmí ztratit');
  });
}

/* ── databáze ────────────────────────────────────────────────── */

async function testDb() {
  describe('Databáze');

  db.useDatabase(TEST_DB);
  await new Promise((res) => {
    const r = indexedDB.deleteDatabase(TEST_DB);
    r.onsuccess = r.onerror = r.onblocked = res;
  });

  await it('nenalezený záznam vrací undefined, ne IDBRequest', async () => {
    const r = await db.getDay('1999-01-01');
    eq(r, undefined, 'chybějící den:');
    ok(!(r && typeof r === 'object' && 'readyState' in r), 'prosákl IDBRequest');
  });

  await it('uložení a načtení zachová celý záznam', async () => {
    const e = M.makeEntry('2026-07-30');
    e.mood = -1; e.energy = 2; e.tags = ['work'];
    await db.putDay(e);
    const back = await db.getDay('2026-07-30');
    eq(back.mood, -1); eq(back.energy, 2); eq(back.tags, ['work']);
    eq(back.schemaVersion, M.SCHEMA_VERSION);
  });

  await it('nálada 0 přežije uložení jako nula, ne jako prázdno', async () => {
    const e = M.makeEntry('2026-07-20'); e.mood = 0;
    await db.putDay(e);
    const back = await db.getDay('2026-07-20');
    eq(back.mood, 0);
    ok(M.isValid(back), 'nulový den musí zůstat platný');
  });

  await it('opakované uložení téhož dne přepíše, nezaloží duplicitu', async () => {
    const before = await db.countDays();
    const e = await db.getDay('2026-07-30');
    e.mood = 3;
    await db.putDay(e);
    eq(await db.countDays(), before, 'počet se nesmí změnit');
    eq((await db.getDay('2026-07-30')).mood, 3);
  });

  await it('daysBetween vrací rozsah včetně obou krajů a seřazený', async () => {
    for (const d of ['2026-08-01','2026-08-02','2026-08-03','2026-08-04']) {
      const e = M.makeEntry(d); e.mood = 1; await db.putDay(e);
    }
    const r = await db.daysBetween('2026-08-02', '2026-08-03');
    eq(r.map((x) => x.day), ['2026-08-02','2026-08-03']);
    const all = await db.daysBetween('2026-01-01', '2026-12-31');
    const keys = all.map((x) => x.day);
    eq(keys, [...keys].sort(), 'musí být chronologicky');
  });

  await it('rozsah přes přelom roku', async () => {
    for (const d of ['2026-12-31', '2027-01-01']) {
      const e = M.makeEntry(d); e.mood = 2; await db.putDay(e);
    }
    const r = await db.daysBetween('2026-12-30', '2027-01-02');
    eq(r.map((x) => x.day), ['2026-12-31', '2027-01-01']);
  });

  await it('nastavení a meta mají funkční výchozí hodnotu', async () => {
    eq(await db.getSetting('neexistuje', 'výchozí'), 'výchozí');
    await db.setSetting('reminderTime', '21:00');
    eq(await db.getSetting('reminderTime'), '21:00');
    await db.setSetting('flag', false);
    eq(await db.getSetting('flag', true), false, 'uložené false nesmí spadnout na výchozí');
    await db.setMeta('lastBackupAt', 'x');
    eq(await db.getMeta('lastBackupAt'), 'x');
  });

  await it('deset let záznamů se uloží i načte v rozumném čase', async () => {
    const t0 = performance.now();
    let key = '2030-01-01';
    const rows = [];
    for (let i = 0; i < 3650; i++) {
      const e = M.makeEntry(key);
      e.mood = (i % 7) - 3;
      e.energy = (i % 5) + 1;
      rows.push(e);
      key = M.addDays(key, 1);
    }
    for (const r of rows) await db.putDay(r);
    const tWrite = performance.now() - t0;

    const t1 = performance.now();
    const all = await db.allDays();
    const tRead = performance.now() - t1;

    const t2 = performance.now();
    const month = await db.daysBetween('2035-06-01', '2035-06-30');
    const tRange = performance.now() - t2;

    ok(all.length >= 3650, `načteno ${all.length}`);
    eq(month.length, 30, 'měsíc uprostřed:');
    ok(tRange < 150, `výběr měsíce trval ${tRange.toFixed(0)} ms`);
    ok(tRead < 3000, `načtení všeho trvalo ${tRead.toFixed(0)} ms`);
    window.__perf = { zapis: Math.round(tWrite), cteniVseho: Math.round(tRead), vyberMesice: Math.round(tRange) };
  });

  await it('hromadný zápis je v jedné transakci a je řádově rychlejší', async () => {
    const rows = [];
    let key = '2040-01-01';
    for (let i = 0; i < 365; i++) { const e = M.makeEntry(key); e.mood = 1; rows.push(e); key = M.addDays(key, 1); }

    const t0 = performance.now();
    eq(await db.putDays(rows), 365, 'počet zapsaných:');
    const bulk = performance.now() - t0;

    eq((await db.daysBetween('2040-01-01', '2040-12-31')).length, 365, 'rok zpět:');
    ok(bulk < 800, `hromadný zápis roku trval ${bulk.toFixed(0)} ms`);
    window.__perf = Object.assign(window.__perf || {}, { hromadnyRok: Math.round(bulk) });
  });

  await it('export je platný JSON a dá se zase načíst', async () => {
    const days = await db.allDays();
    const payload = { app: 'soumrak', schemaVersion: M.SCHEMA_VERSION,
                      exportedAt: new Date().toISOString(), days };
    const round = JSON.parse(JSON.stringify(payload));
    eq(round.days.length, days.length);
    eq(round.days[0].day, days[0].day);
    ok(round.exportedAt, 'chybí razítko exportu');
  });

  describe('Záloha a obnova');

  await it('parseBackup odmítne cizí nebo poškozený soubor', () => {
    eq(M.parseBackup(null), null);
    eq(M.parseBackup({}), null, 'prázdný objekt:');
    eq(M.parseBackup({ app: 'neco-jineho', days: [] }), null, 'cizí aplikace:');
    eq(M.parseBackup({ app: 'soumrak' }), null, 'chybí days:');
    eq(M.parseBackup({ app: 'soumrak', days: 'ne' }), null, 'days není pole:');
  });

  await it('parseBackup odmítne zálohu z novější verze schématu', () => {
    eq(M.parseBackup({ app: 'soumrak', schemaVersion: M.SCHEMA_VERSION + 1, days: [] }), null);
    ok(M.parseBackup({ app: 'soumrak', schemaVersion: M.SCHEMA_VERSION, days: [] }) !== null,
       'stejná verze musí projít');
  });

  await it('parseBackup zahodí vadné dny a duplicity, zbytek zachová', () => {
    const { days } = M.parseBackup({ app: 'soumrak', days: [
      { day: '2026-07-01', mood: 1 },
      { day: 'nesmysl', mood: 1 },
      null,
      { day: '2026-07-01', mood: -3 },     // duplicita
      { day: '2026-07-02', mood: 0 }
    ]});
    eq(days.map((d) => d.day), ['2026-07-01', '2026-07-02']);
    eq(days[0].mood, 1, 'první výskyt vyhrává');
    eq(days[1].mood, 0, 'nula je platná nálada');
  });

  await it('obnova doplní chybějící dny a stávající nepřepíše', async () => {
    db.useDatabase(TEST_DB + '-restore');
    await new Promise((res) => {
      const r = indexedDB.deleteDatabase(TEST_DB + '-restore');
      r.onsuccess = r.onerror = r.onblocked = res;
    });

    const mine = M.makeEntry('2026-09-01'); mine.mood = 3;
    await db.putDay(mine);

    const backup = { app: 'soumrak', schemaVersion: 1, days: [
      { day: '2026-09-01', mood: -3 },      // konflikt — musí zůstat moje trojka
      { day: '2026-09-02', mood: 1 },
      { day: '2026-09-03', mood: 2 }
    ]};

    const parsed = M.parseBackup(backup).days;
    const existing = new Set((await db.allDays()).map((e) => e.day));
    const toAdd = parsed.filter((e) => !existing.has(e.day));
    const kept = parsed.length - toAdd.length;
    await db.putDays(toAdd);

    eq(toAdd.length, 2, 'přidané dny:');
    eq(kept, 1, 'ponechané dny:');
    eq((await db.getDay('2026-09-01')).mood, 3, 'existující den se nesmí přepsat');
    eq((await db.getDay('2026-09-02')).mood, 1, 'chybějící den se doplní');
    eq(await db.countDays(), 3);

    await new Promise((res) => {
      const r = indexedDB.deleteDatabase(TEST_DB + '-restore');
      r.onsuccess = r.onerror = r.onblocked = res;
    });
    db.useDatabase(TEST_DB);
  });

  await it('celý okruh export → obnova zachová data beze ztráty', async () => {
    db.useDatabase(TEST_DB + '-round');
    await new Promise((res) => {
      const r = indexedDB.deleteDatabase(TEST_DB + '-round');
      r.onsuccess = r.onerror = r.onblocked = res;
    });

    const original = [];
    let key = '2026-05-01';
    for (let i = 0; i < 40; i++) {
      const e = M.makeEntry(key);
      e.mood = (i % 7) - 3;
      e.energy = (i % 5) + 1;
      e.tags = i % 3 === 0 ? ['work', 'sport'] : [];
      e.helped = i % 3 === 0 ? ['sport'] : [];
      e.anxiety = (i % 5) + 1;
      e.sleep = { hours: 6 + (i % 4) * 0.5, quality: (i % 5) + 1, bedtime: null, wake: null };
      e.meds = [{ id: 'sertralin', taken: i % 2 === 0 }];
      e.note = i % 4 === 0 ? 'poznámka s diakritikou: šžčř' : '';
      original.push(e);
      key = M.addDays(key, 1);
    }
    await db.putDays(original);

    // export
    const exported = JSON.parse(JSON.stringify({
      app: 'soumrak', schemaVersion: M.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(), days: await db.allDays()
    }));

    // ztráta dat
    await new Promise((res) => {
      const r = indexedDB.deleteDatabase(TEST_DB + '-round');
      r.onsuccess = r.onerror = r.onblocked = res;
    });
    db.useDatabase(TEST_DB + '-round');
    eq(await db.countDays(), 0, 'databáze má být prázdná');

    // obnova
    await db.putDays(M.parseBackup(exported).days);
    const back = await db.allDays();
    eq(back.length, 40, 'počet dní:');
    eq(back.map((e) => e.mood), original.map((e) => e.mood), 'nálady:');
    eq(back.map((e) => e.energy), original.map((e) => e.energy), 'energie:');
    eq(back.find((e) => e.note).note, 'poznámka s diakritikou: šžčř', 'diakritika:');
    eq(back.filter((e) => e.tags.length).length, original.filter((e) => e.tags.length).length, 'štítky:');
    eq(back.map((e) => e.anxiety), original.map((e) => e.anxiety), 'úzkost:');
    eq(back.map((e) => e.sleep.hours), original.map((e) => e.sleep.hours), 'hodiny spánku:');
    eq(back.map((e) => e.sleep.quality), original.map((e) => e.sleep.quality), 'kvalita spánku:');
    eq(back.map((e) => e.helped), original.map((e) => e.helped), 'co pomohlo:');
    eq(back.map((e) => e.meds), original.map((e) => e.meds), 'léky:');

    await new Promise((res) => {
      const r = indexedDB.deleteDatabase(TEST_DB + '-round');
      r.onsuccess = r.onerror = r.onblocked = res;
    });
    db.useDatabase(TEST_DB);
  });

  // úklid, ať test nenechává po sobě databázi
  db.useDatabase(TEST_DB);
  await new Promise((res) => {
    const r = indexedDB.deleteDatabase(TEST_DB);
    r.onsuccess = r.onerror = r.onblocked = res;
  });
  db.useDatabase('soumrak');
}

/* ── texty a kotvy škál ──────────────────────────────────────── */

async function testText() {
  describe('Texty a kotvy');

  await it('kotvy neobsahují nezlomitelnou mezeru', () => {
    // Regrese: kotvy měly mezi slovy U+00A0. Text se pak nemohl zalomit,
    // vytekl ze sloupce mřížky a všech sedm popisků splynulo v jednu řádku.
    const NBSP = String.fromCharCode(0x00A0);
    const all = [
      ...Object.values(MOOD_ANCHORS), ...Object.values(MOOD_PHRASE),
      ...ENERGY_ANCHORS, ...ANXIETY_ANCHORS, ...SLEEPQ_ANCHORS,
      ...EMOTIONS.map((e) => e.label), ...STRATEGIES.map((x) => x.label)
    ];
    for (const t of all) {
      ok(!t.includes(NBSP), `nezlomitelná mezera v "${t}"`);
      ok(t.trim() === t, `přebytečná mezera v "${t}"`);
      ok(t.length > 0, 'prázdná kotva');
    }
  });

  await it('každý stupeň škály má kotvu i větu', () => {
    for (let v = -3; v <= 3; v++) {
      ok(MOOD_ANCHORS[String(v)], `chybí kotva pro ${v}`);
      ok(MOOD_PHRASE[String(v)], `chybí věta pro ${v}`);
    }
    // Pět kotev, ne jen dva okraje — popsané jen konce vedou k driftu škály.
    eq(ENERGY_ANCHORS.length, 5, 'energie:');
    eq(ANXIETY_ANCHORS.length, 5, 'úzkost:');
    eq(SLEEPQ_ANCHORS.length, 5, 'kvalita spánku:');
  });

  await it('měkký rozdělovník slovo nemění, jen ho umí zalomit', () => {
    const SHY = String.fromCharCode(0x00AD);
    for (const w of ['neutrální', 'vyčerpání', 'výborná', 'mizerná', 'průměrná']) {
      const h = hyphenate(w);
      ok(h.includes(SHY), `"${w}" se do sloupce nevejde, ale chybí rozdělovník`);
      eq(h.split(SHY).join(''), w, `"${w}" po odstranění rozdělovníků:`);
    }
    eq(hyphenate('dobrý'), 'dobrý', 'krátké slovo se nechává být');
    eq(hyphenate('spíš dobrý'), 'spíš dobrý');
  });

  await it('escapování ošetří všech pět znaků', () => {
    eq(M.esc('<b>'), '&lt;b&gt;');
    eq(M.esc('a & b'), 'a &amp; b');
    eq(M.esc('"x"'), '&quot;x&quot;');
    eq(M.esc("'x'"), '&#39;x&#39;');
    eq(M.esc(null), ''); eq(M.esc(undefined), '');
    // Ampersand musí jít první, jinak by z &lt; vzniklo &amp;lt;
    eq(M.esc('<img onerror=x>'), '&lt;img onerror=x&gt;');
  });

  await it('rod se doplní podle nastavení', () => {
    eq(gender('Cítil{|a} jsem se', 'm'), 'Cítil jsem se');
    eq(gender('Cítil{|a} jsem se', 'f'), 'Cítila jsem se');
    eq(gender('Cítil{|a} jsem se', 'neutral'), 'Cítil/a jsem se');
    eq(gender('odpočat{ý|á}', 'f'), 'odpočatá');
    eq(gender('odpočat{ý|á}', 'neutral'), 'odpočatý/á');
    eq(gender('bez značky', 'f'), 'bez značky');
  });
}

/* ── dotazníky ───────────────────────────────────────────────── */

async function testInstruments() {
  describe('Dotazníky');

  await it('každý dotazník má tolik položek, kolik má mít', () => {
    eq(INS.INSTRUMENTS.PHQ9.items.length, 9);
    eq(INS.INSTRUMENTS.GAD7.items.length, 7);
    eq(INS.INSTRUMENTS.WHO5.items.length, 5);
    for (const id of INS.ORDER) {
      const def = INS.INSTRUMENTS[id];
      ok(def.items.every((t) => typeof t === 'string' && t.length > 5), `${id}: prázdná položka`);
      ok(def.options.length >= 4, `${id}: málo možností`);
      ok(def.stem.length > 10, `${id}: chybí úvodní otázka`);
    }
  });

  await it('vyhodnocovací okno se nezkracuje', () => {
    // Okno je součástí dotazníku. Týdenní PHQ-9 by tytéž dny počítal dvakrát.
    eq(INS.INSTRUMENTS.PHQ9.everyDays, 14);
    eq(INS.INSTRUMENTS.GAD7.everyDays, 14);
    eq(INS.INSTRUMENTS.WHO5.everyDays, 7);
  });

  await it('WHO-5 se přepočítává na stovku', () => {
    eq(INS.rawScore('WHO5', [5, 5, 5, 5, 5]), 25, 'hrubý skór:');
    eq(INS.total('WHO5', [5, 5, 5, 5, 5]), 100, 'přepočtený:');
    eq(INS.total('WHO5', [0, 0, 0, 0, 0]), 0);
    eq(INS.total('WHO5', [2, 2, 2, 2, 2]), 40);
  });

  await it('částečný dotazník nemá skór', () => {
    eq(INS.rawScore('PHQ9', [0, 1, 2]), null, 'málo položek:');
    eq(INS.rawScore('PHQ9', [0, 1, 2, null, 0, 0, 0, 0, 0]), null, 'nevyplněná položka:');
    eq(INS.total('PHQ9', [0, 1, 2]), null);
    eq(INS.evaluate('PHQ9', [0, 1, 2]), null);
    eq(INS.rawScore('neznamy', [0]), null, 'cizí dotazník:');
  });

  await it('pásma sedí na publikovaných hranicích', () => {
    const b = (id, n) => INS.bandFor(id, n).key;
    eq(b('PHQ9', 4), 'minimal'); eq(b('PHQ9', 5), 'mild');
    eq(b('PHQ9', 9), 'mild');    eq(b('PHQ9', 10), 'mod');
    eq(b('PHQ9', 14), 'mod');    eq(b('PHQ9', 15), 'modsev');
    eq(b('PHQ9', 19), 'modsev'); eq(b('PHQ9', 20), 'severe');
    eq(b('PHQ9', 27), 'severe');

    eq(b('GAD7', 4), 'minimal'); eq(b('GAD7', 5), 'mild');
    eq(b('GAD7', 14), 'mod');    eq(b('GAD7', 15), 'severe');

    eq(b('WHO5', 28), 'low');    eq(b('WHO5', 29), 'mid');
    eq(b('WHO5', 50), 'mid');    eq(b('WHO5', 51), 'ok');
  });

  await it('každé pásmo má popisek i vysvětlení a mluví o pásmu, ne o diagnóze', () => {
    for (const id of INS.ORDER) {
      for (const band of INS.INSTRUMENTS[id].bands) {
        ok(band.label && band.hint, `${id}/${band.key}: chybí text`);
        ok(/pásmo|pohoda/i.test(band.label), `${id}/${band.key}: popisek má mluvit o pásmu`);
      }
    }
  });

  await it('termín dalšího vyplnění vychází z vyhodnocovacího okna', () => {
    const now = new Date(2026, 8, 15, 20, 0);
    const d10 = new Date(2026, 8, 5, 20, 0).toISOString();
    eq(INS.daysUntilDue('PHQ9', d10, now), 4, 'čtrnáctidenní:');
    eq(INS.daysUntilDue('WHO5', d10, now), -3, 'týdenní už je po termínu:');
    ok(!INS.isDue('PHQ9', d10, now), 'PHQ-9 ještě není na řadě');
    ok(INS.isDue('WHO5', d10, now), 'WHO-5 už na řadě je');
    eq(INS.daysUntilDue('PHQ9', null, now), null, 'nikdy nevyplněný nemá termín');
    ok(INS.isDue('PHQ9', null, now), 'nikdy nevyplněný je na řadě');
  });

  await it('spolehlivá změna zná směr i práh', () => {
    // PHQ-9: vyšší skór je horší, takže pokles je zlepšení.
    eq(INS.reliableChange('PHQ9', 10, 14), null, 'rozdíl 4 nedosáhne prahu 5:');
    const better = INS.reliableChange('PHQ9', 9, 15);
    eq(better.diff, -6); eq(better.better, true, 'pokles PHQ-9 je zlepšení');
    const worse = INS.reliableChange('PHQ9', 16, 10);
    eq(worse.better, false, 'vzestup PHQ-9 je zhoršení');
    eq(INS.reliableChange('GAD7', 6, 10).better, true, 'pokles GAD-7 je zlepšení');
    eq(INS.reliableChange('PHQ9', 10, 'x'), null, 'chybějící minulý skór:');
  });

  await it('bezpečnostní karta se spustí jen položkou 9 v PHQ-9', () => {
    eq(INS.SAFETY_ITEM.index, 8, 'položka 9 má index 8');
    const zero = new Array(9).fill(0);
    ok(!INS.triggersSafetyCard('PHQ9', zero), 'samé nuly kartu nespouští');
    const flagged = zero.slice(); flagged[8] = 1;
    ok(INS.triggersSafetyCard('PHQ9', flagged), 'jednička u položky 9 kartu spustí');
    const other = zero.slice(); other[0] = 3;
    ok(!INS.triggersSafetyCard('PHQ9', other), 'jiná položka kartu nespouští');
    ok(!INS.triggersSafetyCard('GAD7', [1, 1, 1, 1, 1, 1, 1]), 'GAD-7 tuhle položku nemá');
  });

  await it('normalizace odmítne poškozený dotazník', () => {
    eq(INS.normalizeAssessment(null), null);
    eq(INS.normalizeAssessment({ instrument: 'XX', items: [], takenAt: '2026-01-01T00:00:00Z' }), null);
    eq(INS.normalizeAssessment({ instrument: 'GAD7', items: [1, 2], takenAt: '2026-01-01T00:00:00Z' }),
      null, 'špatný počet položek:');
    eq(INS.normalizeAssessment({ instrument: 'GAD7', items: [0, 0, 0, 0, 0, 0, 9],
      takenAt: '2026-01-01T00:00:00Z' }), null, 'hodnota mimo škálu:');
    eq(INS.normalizeAssessment({ instrument: 'GAD7', items: [0, 0, 0, 0, 0, 0, 0],
      takenAt: 'nesmysl' }), null, 'neplatné datum:');

    const good = INS.normalizeAssessment({
      instrument: 'GAD7', items: [1, 1, 1, 1, 1, 1, 1],
      takenAt: '2026-01-01T00:00:00.000Z', day: '2026-01-01'
    });
    eq(good.total, 7); eq(good.band, 'mild');
  });
}

/* ── záznam myšlenky ─────────────────────────────────────────── */

async function testThoughts() {
  describe('Záznam myšlenky');

  await it('formulář má osm kroků v pořadí, které dává smysl', () => {
    eq(TH.STEPS.length, 8);
    eq(TH.STEPS.map((x) => x.key), ['situation', 'emotions', 'thought', 'distortions',
      'evidenceFor', 'evidenceAgainst', 'alternative', 'after']);
    // Myšlenka se hledá až po situaci a pocitu, jinak se popisuje domněnka.
    ok(TH.STEPS.findIndex((x) => x.key === 'thought')
      > TH.STEPS.findIndex((x) => x.key === 'situation'), 'myšlenka až po situaci');
    // Protidůkaz musí přijít až po důkazu, ne naopak.
    ok(TH.STEPS.findIndex((x) => x.key === 'evidenceAgainst')
      > TH.STEPS.findIndex((x) => x.key === 'evidenceFor'), 'protidůkaz až po důkazu');
    ok(TH.STEPS.every((x) => x.title && x.hint), 'každý krok má nadpis i nápovědu');
  });

  await it('záznam je platný od situace nebo myšlenky', () => {
    const r = TH.makeRecord('2026-09-01');
    ok(!TH.isValid(r), 'prázdný záznam se neukládá');
    r.situation = 'Porada.';
    ok(TH.isValid(r), 'samotná situace stačí');
    ok(!TH.isComplete(r), 'k dokončení chybí alternativa i přeměření');
    r.thought = 'Nezvládnu to.';
    r.alternative = 'Tenhle úkol je těžký.';
    r.intensityAfter = 40;
    ok(TH.isComplete(r), 'dokončený záznam');
  });

  await it('posun se počítá jen z obou měření', () => {
    const r = TH.makeRecord('2026-09-01');
    r.intensityBefore = 80;
    eq(TH.shift(r), null, 'bez druhého měření není posun');
    r.intensityAfter = 55;
    eq(TH.shift(r), -25, 'zmírnění je záporné číslo');
    r.beliefBefore = 90; r.beliefAfter = 90;
    eq(TH.beliefShift(r), 0, 'beze změny je nula, ne null');
  });

  await it('normalizace ořeže hodnoty a zahodí neznámé vzorce', () => {
    eq(TH.normalize(null), null);
    eq(TH.normalize({ day: 'nesmysl', thought: 'x' }), null, 'špatný klíč dne:');
    eq(TH.normalize({ day: '2026-09-01' }), null, 'prázdný záznam:');

    const r = TH.normalize({
      day: '2026-09-01',
      thought: 'Nezvládnu to.',
      emotions: ['anxiety', 'anxiety', 42],
      distortions: ['catastrophizing', 'vymyslene'],
      intensityBefore: 250, intensityAfter: -10, beliefBefore: 61.4
    });
    eq(r.emotions, ['anxiety'], 'duplicity a nesmysly pryč:');
    eq(r.distortions, ['catastrophizing'], 'neznámý vzorec pryč:');
    eq(r.intensityBefore, 100, 'nad rozsah:');
    eq(r.intensityAfter, 0, 'pod rozsah:');
    eq(r.beliefBefore, 61, 'zaokrouhlení:');
  });

  await it('každý vzorec má popisek i vysvětlení', () => {
    ok(TH.DISTORTIONS.length >= 10, 'málo vzorců');
    const ids = new Set();
    for (const d of TH.DISTORTIONS) {
      ok(d.label && d.desc, `${d.id}: chybí text`);
      ok(!ids.has(d.id), `duplicitní id ${d.id}`);
      ids.add(d.id);
    }
  });
}

/* ── nová úložiště ───────────────────────────────────────────── */

async function testNewStores() {
  describe('Historie dotazníků a myšlenek');

  db.useDatabase(TEST_DB + '-v2');
  await new Promise((res) => {
    const r = indexedDB.deleteDatabase(TEST_DB + '-v2');
    r.onsuccess = r.onerror = r.onblocked = res;
  });

  await it('dotazníky se ukládají a čtou seřazené podle času', async () => {
    const mk = (instrument, day, items) => ({
      instrument, takenAt: new Date(day + 'T20:00:00').toISOString(), day,
      items, total: INS.total(instrument, items),
      band: INS.bandFor(instrument, INS.total(instrument, items)).key
    });
    // Schválně v opačném pořadí, než v jakém se mají vrátit.
    await db.putAssessment(mk('PHQ9', '2026-08-15', new Array(9).fill(2)));
    await db.putAssessment(mk('PHQ9', '2026-08-01', new Array(9).fill(1)));
    await db.putAssessment(mk('GAD7', '2026-08-10', new Array(7).fill(1)));

    const phq = await db.assessmentsFor('PHQ9');
    eq(phq.length, 2, 'index nesmí míchat dotazníky dohromady');
    eq(phq.map((a) => a.day), ['2026-08-01', '2026-08-15'], 'pořadí:');
    eq((await db.lastAssessment('PHQ9')).total, 18, 'poslední vyplnění:');
    eq((await db.lastAssessment('GAD7')).total, 7);
    eq(await db.countAssessments(), 3);
    eq(await db.lastAssessment('WHO5'), undefined, 'nevyplněný dotazník nemá poslední záznam');
  });

  await it('záznamy myšlenek se ukládají, hledají podle dne a mažou', async () => {
    const a = TH.makeRecord('2026-08-20'); a.thought = 'Nezvládnu to.';
    const b = TH.makeRecord('2026-08-20'); b.thought = 'Nikoho to nezajímá.';
    const c = TH.makeRecord('2026-08-21'); c.situation = 'Jiný den.';

    const idA = await db.putThought(a);
    await db.putThought(b);
    await db.putThought(c);

    eq(await db.countThoughts(), 3);
    eq((await db.thoughtsForDay('2026-08-20')).length, 2, 'dva záznamy v jednom dni');
    eq((await db.thoughtsForDay('2026-08-21')).length, 1);
    eq((await db.thoughtsForDay('2026-08-22')).length, 0, 'den bez záznamu');

    const loaded = await db.getThought(idA);
    eq(loaded.thought, 'Nezvládnu to.', 'záznam se načte podle klíče');

    await db.deleteThought(idA);
    eq(await db.countThoughts(), 2);
    eq(await db.getThought(idA), undefined, 'smazaný záznam je pryč');
  });

  await it('záloha unese dny, dotazníky i záznamy myšlenek najednou', async () => {
    const payload = JSON.parse(JSON.stringify({
      app: 'soumrak',
      schemaVersion: M.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      days: await db.allDays(),
      assessments: await db.allAssessments(),
      thoughts: await db.allThoughts()
    }));

    const parsed = M.parseBackup(payload);
    ok(parsed !== null, 'záloha musí projít');
    eq(parsed.assessments.length, 3, 'dotazníky:');
    eq(parsed.thoughts.length, 2, 'záznamy myšlenek:');
    eq(parsed.assessments[0].total, INS.total('PHQ9', new Array(9).fill(2)), 'skór přežil kolo');

    // Starší záloha bez nových částí je pořád platná.
    const old = M.parseBackup({ app: 'soumrak', days: [{ day: '2026-07-01', mood: 1 }] });
    eq(old.days.length, 1);
    eq(old.assessments, [], 'chybějící dotazníky jsou prázdné pole, ne undefined');
    eq(old.thoughts, []);
  });

  await new Promise((res) => {
    const r = indexedDB.deleteDatabase(TEST_DB + '-v2');
    r.onsuccess = r.onerror = r.onblocked = res;
  });

  await it('přechod z verze 1 nesmí sáhnout na existující dny', async () => {
    const NAME = TEST_DB + '-migrate';
    await new Promise((res) => {
      const r = indexedDB.deleteDatabase(NAME);
      r.onsuccess = r.onerror = r.onblocked = res;
    });

    // Databáze tak, jak ji nechala fáze 1 — jen tři úložiště, verze 1.
    await new Promise((res, rej) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('days', { keyPath: 'day' });
        d.createObjectStore('settings', { keyPath: 'k' });
        d.createObjectStore('meta', { keyPath: 'k' });
      };
      req.onsuccess = () => {
        const d = req.result;
        const t = d.transaction('days', 'readwrite');
        t.objectStore('days').put({ schemaVersion: 1, day: '2026-06-01', mood: -2, tags: ['work'] });
        t.oncomplete = () => { d.close(); res(); };
        t.onerror = () => rej(t.error);
      };
      req.onerror = () => rej(req.error);
    });

    db.useDatabase(NAME);
    const kept = await db.getDay('2026-06-01');
    eq(kept.mood, -2, 'starý zápis musí migraci přežít');
    eq(kept.tags, ['work'], 'i se štítky');
    eq(await db.countAssessments(), 0, 'nová úložiště vzniknou prázdná');
    eq(await db.countThoughts(), 0);

    // A rovnou ověřit, že se do nich po migraci dá psát.
    const r = TH.makeRecord('2026-06-01');
    r.thought = 'test';
    await db.putThought(r);
    eq(await db.countThoughts(), 1);

    await new Promise((res) => {
      const rq = indexedDB.deleteDatabase(NAME);
      rq.onsuccess = rq.onerror = rq.onblocked = res;
    });
  });

  db.useDatabase('soumrak');
}

/* ── běh ─────────────────────────────────────────────────────── */

export async function run() {
  results.length = 0;
  await testDates();
  await testModel();
  await testText();
  await testStats();
  await testInstruments();
  await testThoughts();
  await testDb();
  await testNewStores();
  return results;
}
