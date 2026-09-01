/* Všechny české texty na jednom místě. Klíče a data zůstávají anglicky,
   aby export a případná změna jazyka nerozbily historii.

   Pozor na mezery: v kotvách škál musí být obyčejná mezera (U+0020).
   Nezlomitelná mezera by zabránila zalomení a text by přetekl ze sloupce. */

/* ── rod v oslovení ──────────────────────────────────────────────
   Čeština v minulém čase rod vyžaduje. WHO-5 se ptá v první osobě, takže
   se tomu nejde vyhnout; položky proto nesou značku {m|f} a vykreslí se
   podle nastavení. Denní škály jsou schválně formulované podstatnými
   jmény, aby rod vůbec nepotřebovaly. */

/** „Cítil{|a} jsem se" → m: „Cítil", f: „Cítila", neutral: „Cítil/a". */
export function gender(text, address = 'neutral') {
  return String(text).replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, m, f) => {
    if (address === 'm') return m;
    if (address === 'f') return f;
    return m === '' ? '/' + f : m + '/' + f;
  });
}

/* ── škála nálady ────────────────────────────────────────────── */

export const MOOD_ANCHORS = {
  '-3': 'velmi špatný',
  '-2': 'špatný',
  '-1': 'spíš špatný',
   '0': 'neutrální',
   '1': 'spíš dobrý',
   '2': 'dobrý',
   '3': 'skvělý'
};

/* delší varianta pro souhrn dne */
export const MOOD_PHRASE = {
  '-3': 'Velmi špatný den',
  '-2': 'Špatný den',
  '-1': 'Spíš špatný den',
   '0': 'Neutrální den',
   '1': 'Spíš dobrý den',
   '2': 'Dobrý den',
   '3': 'Skvělý den'
};

/**
 * Měkký rozdělovník pro slova, která se do sloupce škály nevejdou.
 * Není to zkratka — slovo zůstává celé pro čtečku i pro kopírování
 * a rozdělí se jen tehdy, když na řádek jinak nevyjde. Kotvy musí být
 * vidět celé, jinak se škála během měsíců posune (SPEC §2.5, drift škály).
 */
const SHY = '­';
const HYPHENATE = {
  'neutrální':    'neu' + SHY + 'trál' + SHY + 'ní',
  'vyčerpání':    'vy' + SHY + 'čer' + SHY + 'pání',
  'průměrná':     'prů' + SHY + 'měr' + SHY + 'ná',
  'výborná':      'vý' + SHY + 'bor' + SHY + 'ná',
  'mizerná':      'mi' + SHY + 'zer' + SHY + 'ná',
  'podrážděnost': 'po' + SHY + 'dráž' + SHY + 'dě' + SHY + 'nost',
  'nadšení':      'nad' + SHY + 'šení'
};

/** Vloží měkké rozdělovníky do dlouhých slov. Význam zůstává stejný. */
export function hyphenate(text) {
  return String(text).split(' ').map((w) => HYPHENATE[w] || w).join(' ');
}

/* ── pětistupňové škály — všech pět kotev, ne jen okraje ──────────
   Popsané jen konce zvou ke driftu: střed si každý vyloží po svém
   a po půl roce znamená „3" něco jiného než na začátku. */

export const ENERGY_ANCHORS  = ['vyčerpání', 'únava', 'běžná energie', 'svěžest', 'plná energie'];
export const ANXIETY_ANCHORS = ['klid', 'mírné napětí', 'napětí', 'silná úzkost', 'panika'];
export const SLEEPQ_ANCHORS  = ['mizerná', 'špatná', 'průměrná', 'dobrá', 'výborná'];

/* Štítky: id anglicky a natrvalo, popisek česky. Přejmenování popisku
   nikdy neosiří historii. */
export const DEFAULT_TAGS = [
  { id: 'work',      label: 'Práce' },
  { id: 'family',    label: 'Rodina' },
  { id: 'friends',   label: 'Přátelé' },
  { id: 'relation',  label: 'Vztah' },
  { id: 'sport',     label: 'Sport' },
  { id: 'outdoors',  label: 'Venku' },
  { id: 'rest',      label: 'Odpočinek' },
  { id: 'creative',  label: 'Tvorba' },
  { id: 'conflict',  label: 'Konflikt' },
  { id: 'illness',   label: 'Nemoc' },
  { id: 'alcohol',   label: 'Alkohol' },
  { id: 'caffeine',  label: 'Káva' },
  { id: 'alone',     label: 'Samota' },
  { id: 'travel',    label: 'Cestování' }
];

/* ── slovník emocí ───────────────────────────────────────────────
   Rozlišování emocí předpovídá lepší zvládání: kdo umí odlišit úzkost od
   podrážděnosti, sáhne po jiné reakci než ten, kdo cítí jen „blbě". Dvě osy
   cirkumplexu na to nestačí — proto pojmenovaný slovník, uspořádaný podle
   kvadrantů, ne abecedně. */

export const EMOTIONS = [
  { id: 'sadness',     label: 'smutek',       q: 'lo-lo' },
  { id: 'emptiness',   label: 'prázdnota',    q: 'lo-lo' },
  { id: 'hopeless',    label: 'beznaděj',     q: 'lo-lo' },
  { id: 'lonely',      label: 'osamělost',    q: 'lo-lo' },
  { id: 'disappoint',  label: 'zklamání',     q: 'lo-lo' },
  { id: 'shame',       label: 'stud',         q: 'lo-lo' },
  { id: 'guilt',       label: 'vina',         q: 'lo-lo' },
  { id: 'tired',       label: 'vyčerpání',    q: 'lo-lo' },

  { id: 'anxiety',     label: 'úzkost',       q: 'lo-hi' },
  { id: 'fear',        label: 'strach',       q: 'lo-hi' },
  { id: 'tension',     label: 'napětí',       q: 'lo-hi' },
  { id: 'anger',       label: 'vztek',        q: 'lo-hi' },
  { id: 'irritation',  label: 'podrážděnost', q: 'lo-hi' },
  { id: 'frustration', label: 'frustrace',    q: 'lo-hi' },
  { id: 'overwhelm',   label: 'přetížení',    q: 'lo-hi' },
  { id: 'restless',    label: 'neklid',       q: 'lo-hi' },

  { id: 'calm',        label: 'klid',         q: 'hi-lo' },
  { id: 'content',     label: 'spokojenost',  q: 'hi-lo' },
  { id: 'relief',      label: 'úleva',        q: 'hi-lo' },
  { id: 'gratitude',   label: 'vděčnost',     q: 'hi-lo' },
  { id: 'safe',        label: 'bezpečí',      q: 'hi-lo' },

  { id: 'joy',         label: 'radost',       q: 'hi-hi' },
  { id: 'excitement',  label: 'nadšení',      q: 'hi-hi' },
  { id: 'pride',       label: 'hrdost',       q: 'hi-hi' },
  { id: 'interest',    label: 'zájem',        q: 'hi-hi' },
  { id: 'hope',        label: 'naděje',       q: 'hi-hi' }
];

export const EMOTION_GROUPS = [
  ['lo-lo', 'Nepříjemné, utlumené'],
  ['lo-hi', 'Nepříjemné, nabuzené'],
  ['hi-lo', 'Příjemné, klidné'],
  ['hi-hi', 'Příjemné, nabuzené']
];

/* ── strategie zvládání ──────────────────────────────────────────
   Grossův procesní model emoční regulace. `shortTerm` označuje postupy,
   které uleví hned, ale potíže spíš udržují. Není to výtka — sledovat je
   má smysl právě proto, že jinak zůstanou neviditelné. */

export const STRATEGIES = [
  { id: 'reappraisal', label: 'Jiný pohled na věc' },
  { id: 'problem',     label: 'Řešení problému' },
  { id: 'acceptance',  label: 'Přijetí toho, co nejde změnit' },
  { id: 'breathing',   label: 'Dech, zklidnění těla' },
  { id: 'movement',    label: 'Pohyb' },
  { id: 'social',      label: 'Mluvení s někým' },
  { id: 'pleasant',    label: 'Příjemná činnost' },
  { id: 'expression',  label: 'Vypsání, vyjádření' },
  { id: 'selfcare',    label: 'Jídlo, spánek, klid' },
  { id: 'distraction', label: 'Odvedení pozornosti' },
  { id: 'avoidance',   label: 'Vyhnutí se',         shortTerm: true },
  { id: 'suppression', label: 'Potlačení',          shortTerm: true },
  { id: 'rumination',  label: 'Přemílání dokola',   shortTerm: true },
  { id: 'substance',   label: 'Alkohol nebo látky', shortTerm: true }
];

/* Kvadranty Russellova cirkumplexu */
export const QUADRANT = {
  'hi-hi': ['Elán, nadšení',     'vysoká valence · vysoká aktivace'],
  'hi-lo': ['Klid, spokojenost', 'vysoká valence · nízká aktivace'],
  'lo-hi': ['Napětí, neklid',    'nízká valence · vysoká aktivace'],
  'lo-lo': ['Útlum, skleslost',  'nízká valence · nízká aktivace'],
  'mid'  : ['Střed obou os',     'ani jeden pól nepřevažuje']
};

export const WEEKDAYS_SHORT = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];
export const WEEKDAYS_LONG  = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];
export const MONTHS_IN      = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
                               'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
export const MONTHS_NOM     = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
                               'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

export const T = {
  today:            'Dnes',
  yesterday:        'Včera',
  saveHint:         'Vyber náladu',
  save:             'Uložit den',
  saveOther:        'Uložit tento den',
  saved:            'Uloženo',
  edit:             'Upravit',
  question:         'Jak byl dnešek?',
  questionOther:    'Jaký byl ten den?',
  energy:           'Energie',
  energyHint:       'Míra aktivace, ne nálada. Vyčerpání a klid nejsou totéž.',
  anxiety:          'Úzkost',
  sleep:            'Spánek',
  sleepHours:       'Kolik hodin',
  sleepQuality:     'Kvalita spánku',
  sleepUnknown:     'nevím',
  tags:             'Co dnes hrálo roli?',
  helped:           'Co z toho pomohlo?',
  helpedHint:       'Označ, co dnešek zlepšilo. Spojení činnosti s náladou je u deprese účinná složka léčby, ne ozdoba.',
  emotions:         'Co to bylo za pocity?',
  emotionsHint:     'Nepovinné. Odlišit úzkost od podrážděnosti pomáhá zvolit jinou reakci — samotné pojmenování emoci o něco zmírní.',
  emotionsChosen:   (n) => `${n} vybráno`,
  strategies:       'Co dnes pomáhalo zvládnout?',
  strategiesHint:   'Některé způsoby uleví hned, ale dlouhodobě potíže spíš udržují. Jsou tu proto, aby byly vidět — ne aby se za ně platilo.',
  strategyShort:    'krátkodobá úleva',
  meds:             'Léky',
  medsTaken:        'vzato',
  medsNone:         'Žádné léky nejsou nastavené. Přidat je jde ve Více.',
  note:             'Poznámka',
  noteOptional:     'nepovinné',
  notePlaceholder:  'Jedna věta o dnešku…',
  noteCounter:      (n, max) => `${n} / ${max}`,
  noteWhyCapped:    'Strop je záměr: otevřené večerní psaní je u deprese známý spouštěč ruminace.',
  addMore:          'Přidat víc',
  addLess:          'Skrýt',

  dayDetail:        'Detail dne',
  notLogged:        'Tento den není zapsaný',
  logThisDay:       'Zapsat tento den',
  tooOldToBackfill: (n) => `Doplnit jde jen ${n} ${T.daysGenitive(n)} zpět`,
  futureDay:        'Budoucí den se zapsat nedá',
  deleteDay:        'Smazat zápis',
  deleteConfirm:    'Smazat zápis tohoto dne?',
  deleted:          'Zápis smazán',

  moreTags:         'Štítky',
  moreMeds:         'Léky',
  addTag:           'Přidat',
  addMed:           'Přidat',
  namePlaceholder:  'Název',
  remove:           'Odebrat',
  tagInUse:         'Odebraný štítek zůstane v historii, jen se přestane nabízet.',
  quadrantEmpty:    'Zatím nevybráno',
  quadrantAxes:     'valence × aktivace',
  quadrantNeedEnergy: 'doplň energii pro kvadrant',
  last7:            'Posledních 7 dní',
  yesterdayNote:    'Včerejšek se ukazuje až teď, aby neovlivnil dnešní hodnocení.',
  backfillTitle:    'Včerejšek chybí',
  backfillCta:      'Doplnit',
  backfillHeading:  'Doplnění',
  retroBadge:       'doplněno zpětně',
  dateOverride:     'Zapisuje se den',
  backToToday:      'Zpět na dnešek',

  legendMissing:    'Přerušovaný obrys = nezapsáno · tenký rámeček = doplněno zpětně',
  monthAvg:         'průměr',
  daysGenitive:     (n) => (n === 1 ? 'den' : (n >= 2 && n <= 4 ? 'dny' : 'dní')),
  /* Čeština má tři tvary: 1 dotazník · 2–4 dotazníky · 5+ dotazníků. */
  plural:           (n, one, few, many) => (n === 1 ? one : (n >= 2 && n <= 4 ? few : many)),
  countOf:          (a, b) => `${a} z ${b} ${T.daysGenitive(b)}`,

  insightsAvg:      'Průměrná nálada',
  insightsNeedMore: (n, need) => `Ještě málo dat — ${n} z ${need} ${T.daysGenitive(need)}`,
  insightsLater:    'Souvislosti se štítky, spánkem a dny v týdnu přibudou ve fázi 5.',
  howToRead:        'Jak to číst',
  howToReadBody:    'Graf ukazuje, co bylo zapsáno — ne proč. Krátké výkyvy jsou u nálady běžné; smysl má teprve směr přes několik týdnů. Jeden špatný týden není zhoršení a jeden dobrý není uzdravení.',
  howToReadCause:   'Souvislost, ne příčina.',

  ranges:           [[30, '30 dní'], [90, '90 dní'], [365, 'Rok']],
  rangeLabel:       'Období',
  coverage:         (n, total) => `${n} z ${total} ${T.daysGenitive(total)} zapsáno`,
  coverageThin:     'Málo zapsaných dní — průměr i graf z toho vycházejí opatrně.',

  chartDaily:       'Tenká čára = denní hodnoty · plná = klouzavý sedmidenní průměr.',
  chartWeekly:      'Body = týdenní průměry · plná = klouzavý čtyřtýdenní průměr.',
  chartGaps:        'Mezery se nedopočítávají.',
  chartTapHint:     'Ťukni do grafu pro konkrétní den',

  distribution:     'Rozložení hodnot',
  distributionNote: 'Kam se hodnocení posouvá. Soustavný příklon k jednomu konci škály je sám o sobě informace.',
  distributionEmpty: 'Zatím není co rozdělovat.',

  tableShow:        'Tabulka',
  tableHide:        'Skrýt tabulku',
  tableDay:         'Den',
  tableMood:        'Nálada',
  tableWeek:        'Týden',
  tableAvg:         'Průměr',
  tableCount:       'Počet',
  tableShare:       'Podíl',
  tableNoData:      'nezapsáno',
  tableScore:       'Skór',
  tableBand:        'Pásmo',

  monthLogged:      'Zapsáno',
  monthBest:        'Nejlepší',
  monthWorst:       'Nejhorší',
  noDataTitle:      'Zatím žádné zápisy',
  noDataBody:       'První nálada se zapíše na kartě Dnes. Pak se tu začne rýsovat průběh.',

  moreData:         'Data',
  moreExport:       'Export do JSON',
  moreExportSub:    'záloha, kterou jde vrátit zpět',
  moreStorage:      'Trvalé úložiště',
  moreStorageOn:    'zapnuto',
  moreStorageOff:   'nezaručeno',
  moreStorageHint:  'Bez trvalého úložiště může systém data při nedostatku místa smazat. Zálohuj export jednou za měsíc.',
  moreEntries:      'Počet zápisů',
  moreHelp:         'Když je zle',
  moreHelpBody:     'Tyhle linky jsou tu pořád, nezávisle na tom, co ukazují grafy.',
  moreAbout:        'O aplikaci',
  moreVersion:      'deník · přehled · dotazníky · záznam myšlenky',
  moreDisclaimer:   'Soumrak není zdravotnický prostředek. Nenahrazuje diagnózu ani péči odborníka.',
  moreSettings:     'Nastavení',
  moreAddress:      'Oslovení v dotazníku',
  addressNeutral:   'neutrální',
  addressM:         'mužský rod',
  addressF:         'ženský rod',
  addressHint:      'Týká se jen dotazníku WHO-5, kde se čeština rodu nevyhne.',
  moreAmoled:       'Tmavší pozadí',
  moreAmoledSub:    'černá místo tmavě šedé — na OLED šetří baterii',
  moreOnboarding:   'Projít úvod znovu',
  moreOnboardingSub: 'k čemu aplikace je a co čísla znamenají',

  crisis: [
    ['Linka první psychické pomoci', '116 123', 'zdarma, nonstop'],
    ['Linka bezpečí · do 26 let',    '116 111', 'zdarma, nonstop'],
    ['Záchranná služba',             '155',     'život ohrožující stav']
  ],

  moreImport:       'Obnovit ze zálohy',
  moreImportSub:    'přidá chybějící dny, stávající nechá být',

  backupTitle:      'Je čas zálohovat',
  backupNever:      'Zatím žádná záloha. Prohlížeč není trezor — data můžou zmizet s uvolňováním místa.',
  backupStale:      (d) => `Poslední záloha před ${d} ${T.daysGenitive(d)}. Stáhni si aktuální.`,

  exportOk:         'Záloha stažena',
  exportFail:       'Export se nepovedl',
  importOk:         (a, k) => (a === 0
    ? `Nic nového — všech ${k} ${T.daysGenitive(k)} už v aplikaci bylo`
    : `Přidáno ${a} ${T.daysGenitive(a)}` + (k ? `, ${k} ponecháno beze změny` : '')),
  importAssessments: (n) => `${n} ${T.plural(n, 'dotazník', 'dotazníky', 'dotazníků')}`,
  importThoughts:   (n) => `${n} ${T.plural(n, 'záznam', 'záznamy', 'záznamů')} myšlenky`,
  importBadFile:    'Tohle není záloha Soumraku',
  importFail:       'Obnova se nepovedla',
  saveFail:         'Uložení se nepovedlo. Zkus to prosím znovu.'
};
