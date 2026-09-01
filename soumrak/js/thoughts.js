/* Záznam myšlenky — kognitivní přerámování.
   Sedm sloupců podle Beckova záznamu automatických myšlenek, v podobě, jakou
   používá „Mind Over Mood" (Greenberger & Padesky).

   Proč to v deníku nálady vůbec je: samotné měření nálady nic nemění.
   Přerámování je nejlépe doložená složka KBT a jediné místo, kde tahle
   aplikace přechází od sledování k něčemu, co se dá dělat. Klíčové jsou
   dvě čísla na začátku a na konci — bez přeměření se člověk nedozví, jestli
   mu to k něčemu bylo.

   Deník ani záznam myšlenky nenahrazují terapii. U vleklých potíží je
   tohle nanejvýš doplněk. */

export const SCHEMA_VERSION = 1;

/** Kroky formuláře. Pořadí není libovolné: myšlenka se hledá až po tom,
    co je popsaná situace a pojmenovaný pocit — jinak se popisuje domněnka. */
export const STEPS = [
  {
    key: 'situation',
    title: 'Co se stalo?',
    hint: 'Kdy, kde, s kým. Jen fakta, jako by to zaznamenala kamera — bez hodnocení.',
    placeholder: 'Ráno na poradě padla poznámka k mému návrhu…',
    kind: 'text',
    max: 400
  },
  {
    key: 'emotions',
    title: 'Co jsi cítil{|a}?',
    hint: 'Vyber jeden nebo víc pocitů a nastav, jak silné byly.',
    kind: 'emotions'
  },
  {
    key: 'thought',
    title: 'Co ti prolétlo hlavou?',
    hint: 'Ta věta, která to spustila. Nejsilnější myšlenka bývá krátká a zní jako soud: „jsem k ničemu", „nezvládnu to".',
    placeholder: 'Nikdy to neudělám pořádně.',
    kind: 'text',
    max: 300
  },
  {
    key: 'distortions',
    title: 'Nepřipomíná to některý ze vzorců?',
    hint: 'Nepovinné. Pojmenovat vzorec pomáhá odstoupit od obsahu myšlenky. Žádný z nich neznamená, že je myšlenka nutně nepravdivá.',
    kind: 'distortions'
  },
  {
    key: 'evidenceFor',
    title: 'Co tu myšlenku podporuje?',
    hint: 'Fakta, ne dojmy. Co by o tom řekl někdo, kdo tam byl?',
    placeholder: 'Návrh se opravdu vrátil k přepracování.',
    kind: 'text',
    max: 400
  },
  {
    key: 'evidenceAgainst',
    title: 'Co jí odporuje?',
    hint: 'Tenhle sloupec bývá nejtěžší a je nejdůležitější. Co by řekl někdo, komu na tobě záleží? Co ti vyšlo minule?',
    placeholder: 'Předchozí dva návrhy prošly bez připomínek.',
    kind: 'text',
    max: 400
  },
  {
    key: 'alternative',
    title: 'Jak by se to dalo říct vyváženě?',
    hint: 'Ne pozitivně za každou cenu — přesněji. Věta, která unese oba sloupce nad sebou.',
    placeholder: 'Tenhle návrh potřebuje přepracovat. Neznamená to, že mi práce nejde.',
    kind: 'text',
    max: 400
  },
  {
    key: 'after',
    title: 'A teď?',
    hint: 'Znovu změř totéž co na začátku. Posun bývá malý — i malý je posun.',
    kind: 'after'
  }
];

/* ── kognitivní zkreslení ────────────────────────────────────────
   Zavedený seznam z KBT. Popisky jsou schválně bez obviňujícího tónu:
   jsou to běžné zkratky myšlení, ne chyby charakteru. */

export const DISTORTIONS = [
  { id: 'catastrophizing', label: 'Katastrofizace',
    desc: 'Rovnou ten nejhorší možný konec.' },
  { id: 'allornothing',    label: 'Všechno, nebo nic',
    desc: 'Buď dokonalé, nebo k ničemu. Mezi tím nic.' },
  { id: 'overgeneral',     label: 'Přehnané zobecnění',
    desc: 'Z jedné události pravidlo: „vždycky", „nikdy".' },
  { id: 'mindreading',     label: 'Čtení myšlenek',
    desc: 'Vím, co si druzí myslí — aniž to řekli.' },
  { id: 'fortunetelling',  label: 'Věštění budoucnosti',
    desc: 'Vím, jak to dopadne. Špatně.' },
  { id: 'filter',          label: 'Černý filtr',
    desc: 'Z celého dne zůstane jen ta jedna vada.' },
  { id: 'discount',        label: 'Znehodnocení dobrého',
    desc: 'Povedlo se to, ale to se nepočítá.' },
  { id: 'emotional',       label: 'Emoční usuzování',
    desc: 'Cítím se jako selhání, takže jím jsem.' },
  { id: 'shoulds',         label: 'Měl bych',
    desc: 'Pravidla, která platí jen na mě.' },
  { id: 'labeling',        label: 'Nálepka',
    desc: 'Ne „udělal jsem chybu", ale „jsem neschopný".' },
  { id: 'personalization', label: 'Vztahovačnost',
    desc: 'Může za to já — i to, co jsem neovlivnil.' }
];

export const INTENSITY_MAX = 100;
export const INTENSITY_STEP = 5;

export function makeRecord(day, now = new Date()) {
  const stamp = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: stamp,
    updatedAt: stamp,
    day,
    situation: '',
    emotions: [],
    intensityBefore: 50,
    beliefBefore: 70,
    thought: '',
    distortions: [],
    evidenceFor: '',
    evidenceAgainst: '',
    alternative: '',
    beliefAfter: null,
    intensityAfter: null
  };
}

/** Záznam má smysl ukládat, jakmile je popsaná situace nebo myšlenka. */
export function isValid(r) {
  return !!r && ((r.situation || '').trim().length > 0 || (r.thought || '').trim().length > 0);
}

/** Dokončený je ten, který došel až k vyvážené alternativě a přeměření. */
export function isComplete(r) {
  return !!r
    && (r.thought || '').trim().length > 0
    && (r.alternative || '').trim().length > 0
    && typeof r.intensityAfter === 'number';
}

/** Posun v síle emoce. Záporné číslo = zmírnění. */
export function shift(r) {
  if (!r || typeof r.intensityAfter !== 'number' || typeof r.intensityBefore !== 'number') return null;
  return r.intensityAfter - r.intensityBefore;
}

/** Posun v tom, jak moc myšlence věřím. */
export function beliefShift(r) {
  if (!r || typeof r.beliefAfter !== 'number' || typeof r.beliefBefore !== 'number') return null;
  return r.beliefAfter - r.beliefBefore;
}

const clamp01 = (v) => (typeof v === 'number' && Number.isFinite(v)
  ? Math.max(0, Math.min(INTENSITY_MAX, Math.round(v)))
  : null);

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Doplní chybějící pole na dnešní tvar. Používá se při obnově ze zálohy. */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) return null;

  const base = makeRecord(raw.day);
  const emotions = Array.isArray(raw.emotions)
    ? [...new Set(raw.emotions.filter((e) => typeof e === 'string'))]
    : [];
  const out = {
    ...base,
    day: raw.day,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    situation: str(raw.situation, 400),
    thought: str(raw.thought, 300),
    evidenceFor: str(raw.evidenceFor, 400),
    evidenceAgainst: str(raw.evidenceAgainst, 400),
    alternative: str(raw.alternative, 400),
    emotions,
    distortions: Array.isArray(raw.distortions)
      ? raw.distortions.filter((d) => DISTORTIONS.some((x) => x.id === d))
      : [],
    intensityBefore: clamp01(raw.intensityBefore),
    beliefBefore: clamp01(raw.beliefBefore),
    intensityAfter: clamp01(raw.intensityAfter),
    beliefAfter: clamp01(raw.beliefAfter)
  };
  out.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : out.createdAt;
  if (out.intensityBefore === null) out.intensityBefore = base.intensityBefore;
  if (out.beliefBefore === null) out.beliefBefore = base.beliefBefore;
  if (typeof raw.id === 'number') out.id = raw.id;
  if (!isValid(out)) return null;
  return out;
}
