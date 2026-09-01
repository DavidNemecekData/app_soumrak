/* Validované dotazníky: WHO-5, PHQ-9, GAD-7.
   Skórování, pásma a plánování termínů. Žádné vykreslování — to je v ui.js.

   Dvě pravidla, na kterých stojí smysl celého souboru:

   1. Vyhodnocovací okno se nezkracuje. PHQ-9 i GAD-7 se ptají na „poslední
      dva týdny"; kdo tu otázku položí na tři dny, dostane číslo, které
      s publikovanými normami nemá nic společného.
   2. Z pásma nikdy nevzniká diagnóza. Pásmo je odkaz na normu, ne nález. */

export const OPTIONS_PHQ = [
  { v: 0, label: 'Vůbec ne' },
  { v: 1, label: 'Několik dní' },
  { v: 2, label: 'Více než polovinu dní' },
  { v: 3, label: 'Téměř každý den' }
];

/* WHO-5 se na oficiálním formuláři nabízí od nejvyšší odpovědi dolů. */
export const OPTIONS_WHO = [
  { v: 5, label: 'Neustále' },
  { v: 4, label: 'Většinu času' },
  { v: 3, label: 'Více než polovinu času' },
  { v: 2, label: 'Necelou polovinu času' },
  { v: 1, label: 'Občas' },
  { v: 0, label: 'Nikdy' }
];

export const INSTRUMENTS = {
  WHO5: {
    id: 'WHO5',
    name: 'WHO-5',
    full: 'Index osobní pohody',
    purpose: 'Krátká míra duševní pohody. Ptá se na to, co je, ne na to, co chybí.',
    stem: 'Za poslední dva týdny…',
    options: OPTIONS_WHO,
    everyDays: 7,
    rawMax: 25,
    /* Skór se přepočítává na 0–100, jak předepisuje manuál. */
    transform: (raw) => raw * 4,
    displayMax: 100,
    higherIsBetter: true,
    /* Rod: čeština se mu v minulém čase nevyhne, viz strings.cs.js */
    items: [
      'Cítil{|a} jsem se vesele a v dobré náladě.',
      'Cítil{|a} jsem se klidně a uvolněně.',
      'Cítil{|a} jsem se aktivně a energicky.',
      'Probouzel{|a} jsem se svěží a odpočat{ý|á}.',
      'Můj běžný den byl naplněn věcmi, které mě zajímají.'
    ],
    bands: [
      { max: 28,  key: 'low',  label: 'Nízká pohoda',      tone: 'serious',
        hint: 'Skór pod 28 bodů je v manuálu WHO-5 hranicí, od které se doporučuje podrobnější vyšetření nálady. Není to diagnóza — je to důvod se o tom s někým pobavit.' },
      { max: 50,  key: 'mid',  label: 'Snížená pohoda',    tone: 'warning',
        hint: 'Pod 50 body manuál mluví o snížené osobní pohodě. Stojí za to sledovat, kam se to posune za pár týdnů.' },
      { max: 100, key: 'ok',   label: 'Přiměřená pohoda',  tone: 'good',
        hint: 'V pásmu, které manuál považuje za běžné.' }
    ]
  },

  PHQ9: {
    id: 'PHQ9',
    name: 'PHQ-9',
    full: 'Míra depresivních příznaků',
    purpose: 'Devět otázek podle diagnostických kritérií deprese. Screening, ne diagnóza.',
    stem: 'Jak často vás během posledních dvou týdnů obtěžovaly následující potíže?',
    options: OPTIONS_PHQ,
    everyDays: 14,
    rawMax: 27,
    displayMax: 27,
    higherIsBetter: false,
    /* Položka 9 má vlastní zacházení — viz SAFETY_ITEM níž. */
    items: [
      'Malý zájem o věci nebo radost z nich',
      'Skleslost, sklíčenost nebo pocit beznaděje',
      'Potíže s usínáním či spánkem, nebo naopak nadměrná spavost',
      'Únava nebo nedostatek energie',
      'Snížená chuť k jídlu, nebo naopak přejídání',
      'Špatné mínění o sobě — pocit selhání nebo zklamání sebe či rodiny',
      'Potíže se soustředěním, například při čtení nebo sledování televize',
      'Zpomalení pohybu a řeči natolik, že si toho mohli všimnout druzí — nebo naopak neklid a nutkání být pořád v pohybu',
      'Myšlenky na to, že by bylo lépe zemřít, nebo na sebepoškození'
    ],
    bands: [
      { max: 4,  key: 'minimal', label: 'Minimální pásmo',      tone: 'good',
        hint: 'Příznaky v této míře se běžně vyskytují i u lidí bez potíží.' },
      { max: 9,  key: 'mild',    label: 'Mírné pásmo',          tone: 'good',
        hint: 'Mírné příznaky. Obvyklý postup je sledovat vývoj a znovu se zeptat za dva týdny.' },
      { max: 14, key: 'mod',     label: 'Střední pásmo',        tone: 'warning',
        hint: 'Střední míra příznaků. Stojí za to to probrat s praktickým lékařem nebo s odborníkem na duševní zdraví.' },
      { max: 19, key: 'modsev',  label: 'Středně těžké pásmo',  tone: 'serious',
        hint: 'Středně těžké pásmo. Tady už se odborná pomoc doporučuje, ne jen zvažuje.' },
      { max: 27, key: 'severe',  label: 'Těžké pásmo',          tone: 'critical',
        hint: 'Těžké pásmo. Domluvit si odbornou péči je namístě co nejdřív.' }
    ],
    /* Rozdíl, od kterého se změna skóre považuje za spolehlivou, ne za šum. */
    reliableChange: 5
  },

  GAD7: {
    id: 'GAD7',
    name: 'GAD-7',
    full: 'Míra úzkostných příznaků',
    purpose: 'Sedm otázek na obavy a napětí za poslední dva týdny.',
    stem: 'Jak často vás během posledních dvou týdnů obtěžovaly následující potíže?',
    options: OPTIONS_PHQ,
    everyDays: 14,
    rawMax: 21,
    displayMax: 21,
    higherIsBetter: false,
    items: [
      'Pocity nervozity, úzkosti nebo napětí',
      'Neschopnost přestat se obávat nebo mít obavy pod kontrolou',
      'Přílišné obavy z různých věcí',
      'Potíže s uvolněním',
      'Takový neklid, že je těžké vydržet v klidu sedět',
      'Snadné podráždění nebo rozmrzelost',
      'Pocit strachu, jako by se mělo stát něco hrozného'
    ],
    bands: [
      { max: 4,  key: 'minimal', label: 'Minimální pásmo', tone: 'good',
        hint: 'Příznaky v této míře se běžně vyskytují i u lidí bez potíží.' },
      { max: 9,  key: 'mild',    label: 'Mírné pásmo',     tone: 'good',
        hint: 'Mírná úzkost. Obvyklý postup je sledovat vývoj.' },
      { max: 14, key: 'mod',     label: 'Střední pásmo',   tone: 'warning',
        hint: 'Střední míra úzkosti. Stojí za to to probrat s odborníkem.' },
      { max: 21, key: 'severe',  label: 'Těžké pásmo',     tone: 'critical',
        hint: 'Vysoká míra úzkosti. Domluvit si odbornou péči je namístě.' }
    ],
    reliableChange: 4
  }
};

export const ORDER = ['WHO5', 'PHQ9', 'GAD7'];

/** Index položky PHQ-9, která se ptá na myšlenky na smrt a sebepoškození. */
export const SAFETY_ITEM = { instrument: 'PHQ9', index: 8 };

/** Je odpověď na položku 9 jiná než „Vůbec ne"? */
export function triggersSafetyCard(instrument, items) {
  if (instrument !== SAFETY_ITEM.instrument || !Array.isArray(items)) return false;
  const v = items[SAFETY_ITEM.index];
  return typeof v === 'number' && v > 0;
}

/** Součet položek. Vrací null, dokud není vyplněno všechno — částečný
    dotazník nemá skór, který by šlo srovnávat s normou. */
export function rawScore(instrument, items) {
  const def = INSTRUMENTS[instrument];
  if (!def || !Array.isArray(items) || items.length !== def.items.length) return null;
  let sum = 0;
  for (const v of items) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    sum += v;
  }
  return sum;
}

/** Skór v jednotkách, ve kterých se dotazník vykazuje (WHO-5 přepočítává). */
export function total(instrument, items) {
  const raw = rawScore(instrument, items);
  if (raw === null) return null;
  const def = INSTRUMENTS[instrument];
  return def.transform ? def.transform(raw) : raw;
}

/** Pásmo pro daný skór. Nikdy nevrací diagnózu, jen odkaz na normu. */
export function bandFor(instrument, score) {
  const def = INSTRUMENTS[instrument];
  if (!def || score === null || score === undefined) return null;
  return def.bands.find((b) => score <= b.max) || def.bands[def.bands.length - 1];
}

/** Kompletní vyhodnocení: {total, band}. */
export function evaluate(instrument, items) {
  const t = total(instrument, items);
  if (t === null) return null;
  return { total: t, band: bandFor(instrument, t) };
}

/**
 * Kolik dní zbývá do dalšího vyplnění. Záporné číslo znamená, že už je po
 * termínu, null že dotazník ještě nikdy vyplněný nebyl.
 *
 * Termíny se drží vyhodnocovacích oken: WHO-5 týdně, PHQ-9 a GAD-7 po
 * čtrnácti dnech. Vyplňovat dvoutýdenní dotazník každý týden znamená
 * počítat tytéž dny dvakrát a nafukovat tím zdánlivou proměnlivost.
 */
export function daysUntilDue(instrument, lastTakenAt, now = new Date()) {
  const def = INSTRUMENTS[instrument];
  if (!def) return null;
  if (!lastTakenAt) return null;
  const elapsed = Math.floor((now.getTime() - new Date(lastTakenAt).getTime()) / 86400000);
  return def.everyDays - elapsed;
}

export function isDue(instrument, lastTakenAt, now = new Date()) {
  const d = daysUntilDue(instrument, lastTakenAt, now);
  return d === null || d <= 0;
}

/**
 * Spolehlivá změna oproti minulému vyplnění. U dotazníku, kde vyšší skór
 * znamená horší stav, je zlepšení záporný rozdíl — proto se směr počítá,
 * ne hádá. Vrací null, když práh není překročen: menší rozdíl je v mezích
 * chyby měření a tvářit se, že něco znamená, by bylo nepoctivé.
 */
export function reliableChange(instrument, current, previous) {
  const def = INSTRUMENTS[instrument];
  if (!def || !def.reliableChange) return null;
  if (typeof current !== 'number' || typeof previous !== 'number') return null;
  const diff = current - previous;
  if (Math.abs(diff) < def.reliableChange) return null;
  const better = def.higherIsBetter ? diff > 0 : diff < 0;
  return { diff, better };
}

/** Kontrola záznamu z importu — cizí nebo poškozený dotazník se zahodí. */
export function normalizeAssessment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const def = INSTRUMENTS[raw.instrument];
  if (!def) return null;
  if (!Array.isArray(raw.items) || raw.items.length !== def.items.length) return null;

  const maxOption = Math.max(...def.options.map((o) => o.v));
  const items = raw.items.map((v) =>
    (typeof v === 'number' && v >= 0 && v <= maxOption ? Math.round(v) : null));
  if (items.some((v) => v === null)) return null;

  const takenAt = typeof raw.takenAt === 'string' && !Number.isNaN(Date.parse(raw.takenAt))
    ? raw.takenAt : null;
  if (!takenAt) return null;

  const t = total(raw.instrument, items);
  return {
    instrument: raw.instrument,
    takenAt,
    day: typeof raw.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.day) ? raw.day : null,
    items,
    total: t,
    band: bandFor(raw.instrument, t).key
  };
}
