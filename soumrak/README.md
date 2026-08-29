# Soumrak — fáze 1 až 3

Deník nálady. Offline PWA, žádný backend, žádné závislosti.
Data zůstávají v telefonu (IndexedDB) a nikam se neodesílají.

---

## Co aplikace umí

**Zápis dne**

- Nálada −3…+3 se slovními kotvami, energie a úzkost 1–5
- Živý kvadrant Russellova cirkumplexu z nálady a energie
- Spánek: hodiny po půlhodinách a kvalita 1–5
- Štítky a k nim **„co z toho pomohlo"** — spojení činnosti a nálady je u deprese
  účinná složka, ne ozdoba
- Za tlačítkem *Přidat víc*: léky a poznámka se stropem 280 znaků
- Průběžné ukládání po každém ťuknutí; telefonát uprostřed zápisu nic nestojí
- Platný záznam vznikne už samotnou náladou, zbytek je dobrovolný

**Čtení a opravy**

- Po uložení se *Dnes* přepne na souhrn a přestane se ptát
- **Včerejšek se ukáže až po uložení** — dřív by fungoval jako kotva
- Kalendář: měsíční mapa v barvách škály, ťuknutím se otevře detail dne
- Detail dne: všechno zapsané, úprava i smazání
- Doplnění chybějícího dne až 7 dní zpět, označené jako zpětné
- Zápis mezi 00:00 a 04:00 se počítá k předchozímu dni

**Přehled**

- Období 30 dní / 90 dní / rok. Rok se slučuje po týdnech — 365 bodů na šířku
  telefonu je kaše, týdenní průměry se dají přečíst
- Průměr a graf až od 7 zápisů; pod polovinou zapsaných dní se přidá upozornění,
  že z toho průměr vychází opatrně
- Ťuknutím do grafu se vypíše konkrétní den nebo týden
- Rozložení hodnot: kolikrát padl který stupeň škály, s počtem i podílem
- Pod každým grafem je **tabulka** — graf nesmí být jediná cesta k datům
- Kalendář má pod mřížkou shrnutí měsíce: kolik dní je zapsáno, nejlepší a nejhorší

**Data**
- Export do JSON a **obnova ze zálohy** (nedestruktivní — doplní jen chybějící dny)
- Připomenutí zálohy po 14 zápisech, když záloha chybí nebo je starší 30 dní
- Vlastní štítky a léky; odebrané se archivují, takže popisek v historii zůstane
- Krizové linky trvale ve *Více*, nezávisle na tom, co ukazují grafy

### Co ještě není

Dotazníky PHQ-9 / GAD-7 / WHO-5 (fáze 4), souvislosti mezi spánkem, štítky
a náladou včetně dnů v týdnu (fáze 5), zámek aplikace, zpráva pro lékaře,
režim AMOLED a bezbariérová paleta (fáze 6).

---

## Autotest

```
/tests/
```

Otevři tu adresu na tom zařízení, kde aplikace poběží — **na telefonu, ne jen
na počítači**. Projde datum a přechody na letní čas, model záznamu, statistiku,
databázi i celý okruh záloha → ztráta dat → obnova. Testy běží nad oddělenou
databází, ostrých záznamů se nedotknou.

---

## Vyzkoušení na počítači

```bash
node serve.js
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

### Netlify Drop — nejrychlejší cesta

1. Otevři <https://app.netlify.com/drop>
2. Přetáhni tam **složku `soumrak/`** (ne celý `app_mood/`)
3. Dostaneš adresu typu `https://neco-nahodneho.netlify.app`

### GitHub Pages

1. Nahraj obsah složky `soumrak/` do repozitáře
2. Settings → Pages → Deploy from branch → `main` / `root`
3. Adresa bude `https://uzivatel.github.io/nazev-repozitare/`

Relativní cesty jsou v kódu všude, takže podadresář nevadí.

---

## Instalace do telefonu (Galaxy A55)

1. V Chromu otevři adresu z nasazení
2. Menu **⋮** → **Přidat na plochu** / **Instalovat aplikaci**
3. Spustí se na celou obrazovku, bez adresního řádku

**Dlouhý stisk ikony** nabídne zkratku *Rychlý zápis*, která skočí rovnou
na škálu nálady.

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
- **Obnova** je ve *Více → Obnovit ze zálohy*. Je nedestruktivní: doplní jen dny,
  které v aplikaci chybí, a existující nikdy nepřepíše. Po ztrátě dat je
  databáze prázdná, takže se obnoví všechno.

---

## Struktura

```
soumrak/
  index.html              kostra všech obrazovek
  app.css                 tokeny, komponenty, bezpečné zóny
  sw.js                   service worker, cache-first
  manifest.webmanifest    instalace, ikony, zkratka
  icons/                  192, 512 a maskable 512
  js/
    db.js                 IndexedDB, hromadný zápis, trvalé úložiště
    model.js              datum, model záznamu, normalizace, cirkumplex, barvy
    stats.js              průměr, klouzavý průměr, dělení na úseky
    strings.cs.js         všechny české texty a výchozí štítky
    ui.js                 obrazovky, směrování, vykreslování
  tests/                  autotest, nasazuje se s aplikací
```

Klíče dat a názvy polí jsou anglicky, texty česky. Odebraný štítek se
archivuje, nikdy nemaže — jinak by starší zápisy místo „Alkohol" ukazovaly
holé id `alcohol`.

Klíče dat a názvy polí jsou anglicky, texty česky. Přejmenování štítku tak
nikdy neosiří historii.

---

*Soumrak není zdravotnický prostředek. Nenahrazuje diagnózu ani péči odborníka.*

**Linka první psychické pomoci 116 123** · zdarma, nonstop
**Linka bezpečí 116 111** · do 26 let
**Záchranná služba 155**
