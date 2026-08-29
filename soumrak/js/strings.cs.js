/* Všechny české texty na jednom místě. Klíče a data zůstávají anglicky,
   aby export a případná změna jazyka nerozbily historii. */

export const MOOD_ANCHORS = {
  '-3': 'velmi špatný',
  '-2': 'špatný',
  '-1': 'spíš špatný',
   '0': 'neutrální',
   '1': 'spíš dobrý',
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

export const ENERGY_ENDS  = ['vyčerpaný', 'nabitý'];
export const ANXIETY_ENDS = ['klid', 'panika'];
export const SLEEPQ_ENDS  = ['mizerná', 'výborná'];

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

/* Kvadranty Russellova cirkumplexu */
export const QUADRANT = {
  'hi-hi': ['Elán, nadšení',      'vysoká valence · vysoká aktivace'],
  'hi-lo': ['Klid, spokojenost',  'vysoká valence · nízká aktivace'],
  'lo-hi': ['Napětí, neklid',     'nízká valence · vysoká aktivace'],
  'lo-lo': ['Útlum, skleslost',   'nízká valence · nízká aktivace'],
  'mid'  : ['Neutrální den',      'střed obou os']
};

export const WEEKDAYS_SHORT = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];
export const WEEKDAYS_LONG  = ['pondělí','úterý','středa','čtvrtek','pátek','sobota','neděle'];
export const MONTHS_IN      = ['ledna','února','března','dubna','května','června',
                               'července','srpna','září','října','listopadu','prosince'];
export const MONTHS_NOM     = ['Leden','Únor','Březen','Duben','Květen','Červen',
                               'Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

export const T = {
  today:            'Dnes',
  yesterday:        'Včera',
  saveHint:         'Vyber náladu',
  save:             'Uložit den',
  saved:            'Uloženo',
  edit:             'Upravit',
  question:         'Jak byl dnešek?',
  energy:           'Energie',
  anxiety:          'Úzkost',
  sleep:            'Spánek',
  sleepHours:       'Kolik hodin',
  sleepQuality:     'Kvalita spánku',
  sleepUnknown:     'nevím',
  hoursShort:       'h',
  tags:             'Co dnes hrálo roli?',
  tagsMore:         'Upravit štítky',
  helped:           'Co z toho pomohlo?',
  helpedHint:       'Označ, co dnešek zlepšilo. Právě tohle spojení činnosti a nálady je u deprese účinná složka.',
  meds:             'Léky',
  medsTaken:        'vzato',
  medsNone:         'Žádné léky nejsou nastavené. Přidat je jde ve Více.',
  note:             'Poznámka',
  noteOptional:     'nepovinné',
  notePlaceholder:  'Jedna věta o dnešku…',
  noteCounter:      (n, max) => `${n} / ${max}`,
  noteWhyCapped:    'Strop je záměr. Otevřené večerní psaní je u deprese známý spouštěč ruminace.',
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
  back:             'Zpět',

  moreTags:         'Štítky',
  moreTagsSub:      (n) => `${n} aktivních`,
  moreMeds:         'Léky',
  moreMedsSub:      (n) => n ? `${n} nastavených` : 'žádné',
  addTag:           'Přidat štítek',
  addMed:           'Přidat lék',
  namePlaceholder:  'Název',
  remove:           'Odebrat',
  tagInUse:         'Štítek se používá v zápisech, zůstane v historii',
  quadrantEmpty:    'Zatím nevybráno',
  quadrantAxes:     'valence × aktivace',
  quadrantNeedEnergy:'doplň energii pro kvadrant',
  last7:            'Posledních 7 dní',
  yesterdayNote:    'Včerejšek se ukazuje až teď, aby neovlivnil dnešní hodnocení.',
  backfillTitle:    'Včerejšek chybí',
  backfillBody:     'Doplnit jde 7 dní zpět. Zpětný zápis se označí.',
  backfillCta:      'Doplnit',
  backfillHeading:  'Doplnění',
  retroBadge:       'doplněno zpětně',
  dateOverride:     'Zapisuje se den',

  legendMissing:    'Přerušovaný obrys = nezapsáno · tenký rámeček = doplněno zpětně',
  monthAvg:         'průměr',
  daysGenitive:     (n) => n === 1 ? 'den' : (n >= 2 && n <= 4 ? 'dny' : 'dní'),
  countOf:          (a, b) => `${a} z ${b} ${T.daysGenitive(b)}`,

  insightsAvg:      'Průměrná nálada',
  insightsTrend:    'Vývoj',
  insightsNeedMore: (n, need) => `Ještě málo dat — ${n} z ${need} ${T.daysGenitive(need)}`,
  insightsLater:    'Souvislosti se štítky, spánkem a dny v týdnu přibudou ve fázi 5, dotazníky ve fázi 4.',

  ranges:           [[30, '30 dní'], [90, '90 dní'], [365, 'Rok']],
  rangeLabel:       'Období',
  coverage:         (n, total) => `${n} z ${total} ${T.daysGenitive(total)} zapsáno`,
  coverageThin:     'Málo zapsaných dní — průměr i graf z toho vycházejí opatrně.',

  chartDaily:       'Tenká čára = denní hodnoty · plná = klouzavý sedmidenní průměr.',
  chartWeekly:      'Body = týdenní průměry · plná = klouzavý čtyřtýdenní průměr.',
  chartGaps:        'Mezery se nedopočítávají.',
  chartTapHint:     'Ťukni do grafu pro konkrétní den',
  readoutEmpty:     '—',

  distribution:     'Rozložení hodnot',
  distributionNote: 'Kam se hodnocení posouvá. Soustavný příklon k jednomu konci škály je sám o sobě informace.',
  distributionEmpty:'Zatím není co rozdělovat.',

  tableShow:        'Tabulka',
  tableHide:        'Skrýt tabulku',
  tableDay:         'Den',
  tableMood:        'Nálada',
  tableWeek:        'Týden',
  tableAvg:         'Průměr',
  tableCount:       'Počet',
  tableShare:       'Podíl',
  tableNoData:      'nezapsáno',

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
  moreVersion:      'Fáze 1 · kostra',
  moreDisclaimer:   'Soumrak není zdravotnický prostředek. Nenahrazuje diagnózu ani péči odborníka.',

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
  importOk:         (a, k) => a === 0
                      ? `Nic nového — všech ${k} ${T.daysGenitive(k)} už v aplikaci bylo`
                      : `Přidáno ${a} ${T.daysGenitive(a)}` + (k ? `, ${k} ponecháno beze změny` : ''),
  importBadFile:    'Tohle není záloha Soumraku',
  importFail:       'Obnova se nepovedla',
  saveFail:         'Uložení se nepovedlo. Zkus to prosím znovu.'
};
