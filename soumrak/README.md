# Soumrak

Deník nálady. Offline PWA, žádný backend, žádné závislosti.
Data zůstávají v telefonu (IndexedDB) a nikam se neodesílají.

---

## Co aplikace umí

**Zápis dne**

- Nálada −3…+3 se slovními kotvami u každého stupně, energie a úzkost 1–5
  — u pětistupňových škál jsou popsané **všechny stupně, ne jen okraje**;
  jen popsané konce vedou k driftu škály
- Živý kvadrant Russellova cirkumplexu z nálady a energie
- Spánek: hodiny po půlhodinách a kvalita 1–5
- **Slovník emocí** — 26 pojmenovaných pocitů ve čtyřech kvadrantech.
  Odlišit úzkost od podrážděnosti pomáhá zvolit jinou reakci
- **Strategie zvládání** — co dnes pomáhalo. Postupy s krátkodobou úlevou
  jsou označené, ne schované
- Štítky a k nim „co z toho pomohlo" — spojení činnosti a nálady je
  u deprese účinná složka, ne ozdoba
- Za tlačítkem *Přidat víc*: strategie, léky a poznámka se stropem 280 znaků
- Průběžné ukládání po každém ťuknutí; telefonát uprostřed zápisu nic nestojí
- Platný záznam vznikne už samotnou náladou, zbytek je dobrovolný

**Dotazníky**

- **WHO-5** (týdně), **PHQ-9** a **GAD-7** (po 14 dnech) v ověřených
  formulacích a s oficiálními možnostmi odpovědí
- Vyhodnocovací okno se nezkracuje — kratší okno by dalo číslo, které
  se s publikovanými normami srovnat nedá
- Pásma závažnosti s vysvětlením, **nikdy diagnóza**
- Práh spolehlivé změny: rozdíl pod 5 body (PHQ-9) nebo 4 body (GAD-7)
  se nevydává za posun
- **Položka 9 PHQ-9**: jakákoli odpověď mimo „Vůbec ne" vyvolá klidnou,
  neblokující kartu s krizovými linkami hned za skóre
- Historie se stupňovitým grafem nad pruhy závažnosti a tabulkou
- Rozepsaný dotazník přežije zavření aplikace

**Záznam myšlenky (kognitivní přerámování)**

- Osm kroků podle Beckova záznamu automatických myšlenek
- Situace → pocity a jejich síla → myšlenka a míra přesvědčení →
  kognitivní zkreslení → důkazy pro → důkazy proti → vyvážená verze →
  **přeměření**
- Bez přeměření se nedá poznat, jestli to k něčemu bylo; posun se ukazuje
  živě už při tažení posuvníku
- Ukládá se průběžně, dá se kdykoli přerušit a vrátit se
- Záznamy se vážou ke dni a jsou vidět i v detailu dne

**Čtení a opravy**

- Po uložení se *Dnes* přepne na souhrn a přestane se ptát
- **Včerejšek se ukáže až po uložení** — dřív by fungoval jako kotva
- Kalendář: měsíční mapa v barvách škály, ťuknutím se otevře detail dne
- Detail dne: všechno zapsané, úprava i smazání
- Doplnění chybějícího dne až 7 dní zpět, označené jako zpětné
- Zápis mezi 00:00 a 04:00 se počítá k předchozímu dni

**Přehled**

- Období 30 dní / 90 dní / rok. Rok se slučuje po týdnech
- Průměr a graf až od 7 zápisů; pod polovinou zapsaných dní se přidá
  upozornění, že z toho průměr vychází opatrně
- Ťuknutím do grafu se vypíše konkrétní den nebo týden
- Rozložení hodnot: kolikrát padl který stupeň škály
- Pod každým grafem je **tabulka** — graf nesmí být jediná cesta k datům
- Karta **Jak to číst**: co z grafu plyne a co ne

**Data a nastavení**

- Export do JSON včetně dotazníků, záznamů myšlenek i popisků štítků
- **Obnova ze zálohy** — nedestruktivní, doplní jen chybějící
- Připomenutí zálohy po 14 zápisech
- Vlastní štítky a léky; odebrané se archivují, takže popisek v historii zůstane
- Rod v dotazníku WHO-5 (neutrální / mužský / ženský)
- Tmavší pozadí pro AMOLED
- Krizové linky trvale ve *Více*, nezávisle na tom, co ukazují grafy

### Co ještě není

Souvislosti mezi spánkem, štítky a náladou včetně dnů v týdnu (fáze 5),
zámek aplikace, zpráva pro lékaře a bezbariérová paleta (fáze 6).

---

## Přístupnost a čitelnost

Tři pravidla, která drží `app.css` a která se nesmí obcházet:

1. **Žádný text pod 12 px.** Kotvy škály měly 8,5 px; na telefonu
   ve večerním světle to nešlo přečíst.
2. **Kontrast aspoň 4,5 : 1** na podkladu, na kterém text leží.
   Barva `--muted` (#6272A4) má 3,0 : 1 a přestala být barvou písma —
   zůstává na linky a obrysy.
3. **Každá mřížka má sloupce `minmax(0,1fr)`, ne `1fr`.** Prosté `1fr`
   je `minmax(auto,1fr)` a odmítá se zúžit pod obsah; právě tím přetékala
   řada nálady a čísla krizových linek mizela za pravým okrajem displeje.

Ověřeno na 320, 375 a 393 px šířky, i při zvětšení písma v One UI na 125 %.

---

## Autotest

```
/tests/
```

Otevři tu adresu na tom zařízení, kde aplikace poběží — **na telefonu, ne jen
na počítači**. Projde datum a přechody na letní čas, model záznamu, texty
a kotvy, statistiku, dotazníky, záznam myšlenky, databázi, migraci z verze 1
i celý okruh záloha → ztráta dat → obnova. Testy běží nad oddělenou
databází, ostrých záznamů se nedotknou.

---

## Vyzkoušení na počítači

```bash
node serve.js
```

Bez Node.js posluž totéž Pythonem:

```bash
python serve.py
```

Otevře se na `http://localhost:5173`.

> **Pozor při úpravách:** service worker používá cache-first, takže po změně
> souborů uvidíš pořád starou verzi. Buď zvyš `VERSION` v `sw.js`, nebo si
> v DevTools → Application → Service Workers zaškrtni „Update on reload".

---

## Nasazení

**Aplikace nefunguje otevřením souboru z telefonu.** Chrome na Androidu považuje
`file://` za neprůhledný původ — IndexedDB, localStorage ani service worker tam
nejsou dostupné a každý zápis by se při zavření ztratil. Potřebuje adresu
`https://`.

### GitHub Pages

1. Nahraj obsah složky `soumrak/` do repozitáře
2. Settings → Pages → Deploy from branch → `main` / `root`
3. Adresa bude `https://uzivatel.github.io/nazev-repozitare/`

Relativní cesty jsou v kódu všude, takže podadresář nevadí.

### Netlify Drop

1. Otevři <https://app.netlify.com/drop>
2. Přetáhni tam **složku `soumrak/`** (ne celý `app_mood/`)

---

## Instalace do telefonu (Galaxy A55)

1. V Chromu otevři adresu z nasazení
2. Menu **⋮** → **Přidat na plochu** / **Instalovat aplikaci**
3. Spustí se na celou obrazovku, bez adresního řádku

**Dlouhý stisk ikony** nabídne zkratku *Rychlý zápis*, která skočí rovnou
na škálu nálady.

Systémové tlačítko **Zpět** se chová jako v běžné aplikaci — vrací se
po obrazovkách, nezavírá aplikaci z podobrazovky.

### Připomenutí

PWA neumí na Androidu spolehlivě naplánovat lokální notifikaci — Notification
Triggers API se nikdy nevydalo a service worker se sám na čas neprobudí.
Založ si proto **opakovaný budík v Samsung Clock** na čas, kdy chceš zapisovat
(třeba 21:00), s popiskem „Zapsat den". Je to neelegantní a spustí se to
se stoprocentní jistotou.

---

## Data a zálohy

- Všechno je v IndexedDB pod názvem `soumrak`, výhradně v telefonu.
- Aplikace si při prvním uložení řekne o **trvalé úložiště**. Když ho systém
  nepřidělí (ve *Více* pak svítí „nezaručeno"), může Android data při
  nedostatku místa smazat.
- **Zálohuj jednou za měsíc:** *Více → Export do JSON*. Soubor spadne do
  složky Stažené, kterou OneDrive už synchronizuje.
- **Obnova** je ve *Více → Obnovit ze zálohy*. Je nedestruktivní: doplní jen
  to, co v aplikaci chybí, a existující nikdy nepřepíše.

---

## Struktura

```
soumrak/
  index.html              kostra všech obrazovek
  app.css                 tokeny, komponenty, mřížka, bezpečné zóny
  sw.js                   service worker, cache-first
  manifest.webmanifest    instalace, ikony, zkratka
  icons/                  192, 512 a maskable 512
  js/
    db.js                 IndexedDB v2, migrace, hromadný zápis
    model.js              datum, model záznamu, normalizace, escapování
    stats.js              průměr, klouzavý průměr, dělení na úseky
    instruments.js        WHO-5 / PHQ-9 / GAD-7: položky, skóre, pásma, termíny
    thoughts.js           záznam myšlenky: kroky, zkreslení, posun
    strings.cs.js         všechny české texty, kotvy, emoce, strategie
    ui.js                 obrazovky, směrování, vykreslování
  tests/                  autotest, nasazuje se s aplikací
```

Klíče dat a názvy polí jsou anglicky, texty česky. Odebraný štítek se
archivuje, nikdy nemaže — jinak by starší zápisy místo „Alkohol" ukazovaly
holé id `alcohol`.

---

*Soumrak není zdravotnický prostředek. Nenahrazuje diagnózu ani péči odborníka.*

**Linka první psychické pomoci 116 123** · zdarma, nonstop
**Linka bezpečí 116 111** · do 26 let
**Záchranná služba 155**
