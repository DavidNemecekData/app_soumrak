# Soumrak — mood journal
## Product & technical specification v1.0

A private, offline, single-user mood journal for Android. One entry per evening,
30 seconds. Validated clinical instruments underneath. Charts that refuse to
claim more than the data supports.

- **Target device:** Samsung Galaxy A55 · Android 16 · One UI 8.5 · 1080×2340 (≈393×851 CSS px @ DPR 2.75)
- **Platform:** installable PWA (HTML/CSS/JS + service worker), no framework, no backend
- **UI language:** Czech · **code, data keys and exports:** English
- **Theme:** Dracula (dark only, by design)

---

## 0. Name

**Soumrak** ("dusk"). It names the ritual — the entry is made when the day is
complete — and it fits the requested vampire register without being morbid.

One caveat worth stating: for a tool used on bad days, "dusk" carries a faint
melancholy. If that bothers you in use, `Deník` or `Kotva` ("anchor") swap in
cleanly; the name appears in exactly three places (manifest, launcher label,
onboarding headline).

---

## 1. Blocking technical constraint — read first

**You cannot copy this to the phone and open the file.** Chrome on Android treats
`file://` as an opaque origin: IndexedDB, localStorage and service workers are all
unavailable there. The app would launch and lose every entry on close.

A PWA needs a secure origin. Three ways to get one, in order of recommendation:

| Path | Effort | Result |
|---|---|---|
| **A. Static hosting** (GitHub Pages, Netlify Drop, Cloudflare Pages) | Drag a folder in, once | Real install, offline after first load, persistent storage. Network touched only when the app shell updates. |
| **B. APK via PWABuilder / Bubblewrap** | Needs path A first anyway | A sideloadable `.apk`. Same app in a Trusted Web Activity wrapper. |
| **C. Capacitor wrapper** | Android Studio toolchain | A real APK from the same source, no hosting. Heaviest option. |

**Recommendation: A.** "Offline" is preserved — the service worker caches
everything on first visit, and all data lives in on-device IndexedDB. Nothing is
ever uploaded. Hosting only serves the static files.

If hosting is unacceptable for privacy reasons, note that the hosted files are
public HTML with no data in them; the diary content never touches the server. Use
an unlisted repo name if that helps. Otherwise take path C.

---

## 2. Measurement design

The scientific claim of this app is modest and specific: *self-report captured
daily, close to the event, on anchored scales, is more trustworthy than
retrospective recall.* Everything below serves that.

### 2.1 Daily core — the circumplex

Mood is captured on **two dimensions**, following Russell's circumplex model of
affect (1980), rather than the single happy-to-sad axis most consumer apps use.
Valence and arousal are near-orthogonal; collapsing them loses the distinction
between *tired-flat* and *tense-agitated*, which is precisely the distinction that
matters in depression and anxiety.

| Field | Scale | Anchors (CS) |
|---|---|---|
| `mood` (valence) | −3 … +3, 7 points, true neutral | Velmi špatný · Špatný · Spíš špatný · Neutrální · Spíš dobrý · Dobrý · Skvělý |
| `energy` (arousal) | 1 … 5 | Vyčerpaný · Unavený · Normální · Svěží · Nabitý |
| `anxiety` | 1 … 5 | Klid · Mírné napětí · Napětí · Silná úzkost · Panika |

**Why 7 points for valence.** Reliability of a single-item scale rises to about
7 categories and then plateaus; 5 (Daylio's faces) produces visible ceiling and
floor effects, 10 exceeds what people can discriminate and invites drift. Odd
count preserves a genuine neutral — forcing a lean on flat days is a measurement
error, not a nudge.

**Why anxiety is separate.** High-arousal negative affect is where anxiety lives,
but so is anger. An explicit item is cheaper than inferring it.

The two core dimensions render live into a **circumplex quadrant label** so the
user sees the model rather than just feeding it:

| | Low arousal | High arousal |
|---|---|---|
| **Positive valence** | Klid, spokojenost | Elán, nadšení |
| **Negative valence** | Útlum, skleslost | Napětí, úzkost |

### 2.2 Context factors

Captured daily, all optional. These are what make the insight screen possible —
without them the app can only tell you what you already felt.

- **Sleep:** `hours` (0–14, 0.5 steps), `quality` 1–5. Optional `bedtime`/`wake`.
- **Tags:** fixed starter set, user-extendable. Práce · Rodina · Přátelé · Sport ·
  Venku · Odpočinek · Konflikt · Nemoc · Alkohol · Káva · Samota · Tvorba ·
  Cestování · Peníze · Léky vynechány
- **Note:** free text, soft-capped at 280 characters.

**The 280-character cap is deliberate.** Open-ended evening journaling is a known
rumination trigger in depression. The prompt (`Jedna věta o dnešku…`) and the cap
push toward a specific record rather than a spiral. This is the one place the app
constrains the user on purpose, and it should be explained in onboarding, not
enforced silently.

**Tags exist because of behavioural activation.** Pairing activity with mood is
the active ingredient of BA, one of the better-evidenced treatments for
depression. The tag→mood association screen is therefore not a gimmick; it is the
closest the app comes to an intervention.

### 2.3 Validated instruments

Administered on their own schedule, not daily. Each uses its official recall
window — shortening it invalidates the norms.

| Instrument | Items | Range | Recall | Cadence | Bands |
|---|---|---|---|---|---|
| **WHO-5** wellbeing | 5 | 0–100 (raw ×4) | 2 weeks | weekly | <50 poor wellbeing · <28 screen for depression |
| **PHQ-9** depression | 9 | 0–27 | 2 weeks | every 14 days | 0–4 minimal · 5–9 mild · 10–14 moderate · 15–19 mod. severe · 20–27 severe |
| **GAD-7** anxiety | 7 | 0–21 | 2 weeks | every 14 days | 0–4 minimal · 5–9 mild · 10–14 moderate · 15–21 severe |

WHO-5 runs weekly because it is short, positively worded and carries no stigma —
it is the one people keep answering. PHQ-9 and GAD-7 run fortnightly to match
their two-week recall window; running them weekly double-counts days and inflates
apparent volatility.

Response options must use the officially validated Czech wordings so scores stay
comparable to published norms:

- PHQ-9 / GAD-7 stem: *"Jak často vás během posledních 2 týdnů obtěžovaly následující potíže?"*
  Options: `Vůbec ne` 0 · `Několik dní` 1 · `Více než polovinu dní` 2 · `Téměř každý den` 3
- WHO-5 stem: *"Za poslední dva týdny…"*
  Options: `Nikdy` 0 · `Občas` 1 · `Necelou polovinu času` 2 · `Více než polovinu času` 3 · `Většinu času` 4 · `Neustále` 5

### 2.4 PHQ-9 item 9 — safety handling

Item 9 asks about thoughts of self-harm or being better off dead. Any response
above `Vůbec ne` triggers a calm, non-blocking card shown immediately after
scoring — not a modal, not an alarm, not a red screen.

Copy (impersonal, so it carries no gendered participle):

> **Ještě něco.**
> U poslední otázky byla zvolena jiná odpověď než „Vůbec ne". Takové myšlenky jsou
> u deprese časté a nejsou selháním. Nemusí se to řešit o samotě.
>
> **Linka první psychické pomoci — 116 123** · zdarma, nonstop
> **Linka bezpečí — 116 111** · do 26 let
> **Záchranná služba — 155** nebo **112**

The same resources live permanently under **Více → Když je zle**, reachable in two
taps without taking a questionnaire. They are never hidden behind a score.

### 2.5 Bias controls

These are the details that separate a measurement tool from a mood diary.

| Bias | Control |
|---|---|
| **Anchoring** | Yesterday's rating is *never* shown before today's is entered. It appears immediately after saving. |
| **Retrospective recall** | Backfill is allowed up to 7 days, but flagged `retrospective: true`, marked in the calendar with a hairline outline, and excludable from statistics via a settings toggle. |
| **Scale drift** | Verbal anchors are always visible under the numbers, never on hover, never abbreviated to emoji alone. |
| **Peak–end effect** | The prompt asks for the day *overall*, and the note field prompts for one concrete thing — not "how do you feel now". |
| **Reactivity** | Entry is short by design. No daily questionnaire. |
| **Streak shame** | No unbroken-streak counter. The header reads `Zapsáno 27 z 30 dní`. A missed day is a missing data point, not a failure state. |

---

## 3. Colour system

Base palette is Dracula, unmodified, because it was chosen deliberately and its
neutrals are already hue-biased toward the accent — exactly what a considered dark
theme needs.

```
--bg          #282A36   ground
--surface     #21222C   recessed (cards sit below, not above)
--raised      #343746   raised surface, inputs
--line        #44475A   borders, dividers, grid
--muted       #6272A4   secondary ink, disabled, neutral data
--fg          #F8F8F2   primary ink

--purple      #BD93F9   primary accent, active state
--pink        #FF79C6   secondary accent
--cyan        #8BE9FD   sleep, informational
--green       #50FA7B   positive / good status
--orange      #FFB86C   elevated / serious status
--yellow      #F1FA8C   warning status  (reserved — never a data series)
--red         #FF5555   critical status
```

An **AMOLED variant** ships as a settings toggle: `--bg #000000`, `--surface
#0C0D12`. On the A55's OLED panel this measurably reduces battery draw during
evening use and deepens the theme. Accents are unchanged.

### 3.1 Mood ramp — diverging, seven steps

Two hues plus a neutral grey midpoint, generated in OKLCH, and — unusually —
**monotonic in lightness across all seven steps** rather than symmetric.

```
-3  #F44D4D    L 0.655   Velmi špatný
-2  #EA726A    L 0.692   Špatný
-1  #D89388    L 0.729   Spíš špatný
 0  #B1B1C1    L 0.766   Neutrální      ← neutral grey midpoint
+1  #95CFA0    L 0.803   Spíš dobrý
+2  #7DE68F    L 0.840   Dobrý
+3  #63FB78    L 0.877   Skvělý
```

The usual mood-app ramp (red → yellow → green) puts a *hue* at the midpoint and
keeps lightness symmetric, which makes −2 and +2 nearly identical under
deuteranopia. Stepping lightness monotonically means that even when the red and
green poles collapse to the same muddy hue, the scale still reads as **ordered**.

All seven steps clear 3:1 contrast against `#282A36` (validated).

**Hard rule, derived from measurement, not preference: mood is never encoded by
colour alone.** Adjacent steps in this ramp separate at ΔE ≈ 5 under simulated
deuteranopia against a floor of 15 — no seven-step ramp can pass that, in any
palette. Every surface therefore carries a second encoding:

- calendar cells — the day number is always present, and a settings toggle adds the value
- trend chart — y-axis position carries the value; colour is redundant
- lists and day detail — the verbal anchor is written out
- the ramp legend is always on screen wherever the ramp is used

The coarse read the calendar is actually *for* — "was this month mostly red or
mostly green?" — survives CVD because it reads the gradient, not the level.

A **`Bezbariérový režim`** setting swaps the poles to orange↔cyan (warm/cool
diverging, protan- and deutan-safe) for anyone who needs it.

### 3.2 Categorical — tags and factors

**Fixed order, never cycled:**

```
1  #BD93F9  purple      4  #FF79C6  pink
2  #FFB86C  orange      5  #50FA7B  green
3  #8BE9FD  cyan        6+ #6272A4  "Ostatní"
```

This order is not arbitrary. Validated at adjacent pairs it scores ΔE **12.1**
(deutan) with a normal-vision worst pair of **21.4**, and all five clear 3:1
contrast. Two constraints produced it:

- **Yellow is excluded.** `#F1FA8C` against `#50FA7B` scores ΔE 3.1 under protanopia. Yellow is reserved for the warning status role, where it always ships with an icon and a label.
- **Purple and pink are never adjacent.** That pair scores 13.1 even with full colour vision, below the floor of 15. Slots 1 and 4 keep them apart.

**Consequence to respect: no multi-colour scatter plots.** Across *all* pairs the
set fails (green↔orange, ΔE 3.3 deutan) because any two marks can end up side by
side. Sleep-vs-mood is therefore a single-hue scatter, and any "compare five tags"
view is a bar chart with a legend and direct labels — never a coloured
scatterplot.

I tested re-stepping the Dracula hues down into the validator's dark-mode
lightness band (L 0.48–0.67). It passes every check — and produces muddy olive and
teal that destroy the theme. Rejected: the band exists to guarantee contrast
against the surface, and the unmodified accents already clear 3:1 on `#282A36`.
Passing the check that matters beats passing the proxy for it.

### 3.3 Status — reserved, never a series

`good #50FA7B` · `warning #F1FA8C` · `serious #FFB86C` · `critical #FF5555`.
Always accompanied by an icon and a text label.

---

## 4. Typography, spacing, touch

Web-safe stack — no font CDN, no silent fallback, no download on a phone.

```css
--font-ui:   "Segoe UI", Roboto, system-ui, sans-serif;   /* One UI ships Roboto/OneUI Sans */
--font-data: "Roboto Mono", ui-monospace, monospace;      /* scores, dates, axis values */
```

Numerals in data contexts use `font-variant-numeric: tabular-nums` so score
columns and the calendar grid do not shimmer as values change.

| Token | Size | Use |
|---|---|---|
| `display` | 32 / 36 | screen title, hero score |
| `title` | 20 / 26 | section heading |
| `body` | 16 / 24 | default — never smaller for reading text |
| `label` | 14 / 20 | field labels, chips |
| `micro` | 12 / 16 | axis ticks, timestamps, captions only |

Spacing scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Radii: `8` controls, `16` cards,
`999` chips.

**Touch targets: 48×48 dp minimum, 8 dp between.** The seven mood buttons are the
tightest case — at 393 px wide, minus 16 px gutters and six 6 px gaps, each is
47 px. Acceptable, and they sit in a row with generous vertical padding, but they
must not shrink further. Anything smaller gets a transparent expanded hit area.

**One-handed reachability.** The A55 is 161 mm tall; the top third is out of thumb
reach. Therefore: all primary controls sit in the lower 60 % of the screen, the
save button is fixed above the bottom navigation, and screen titles at the top are
labels only — never interactive.

---

## 5. Information architecture

Four tabs. A fifth would push each target below comfortable width.

```
Dnes        entry + today's state          ← launch destination
Kalendář    month heatmap, tap a day
Přehled     trends, associations, scores
Více        questionnaires, settings, export, help
```

No floating action button: **Dnes** *is* the entry screen. The most common action
should not require a second tap to reach.

### Screen inventory

| # | Screen | Purpose |
|---|---|---|
| 1 | Onboarding (4 steps) | purpose · disclaimer · reminder setup · optional baseline questionnaires |
| 2 | **Dnes** | today's entry, or today's summary once saved |
| 3 | Entry sheet | the layered form (§6) |
| 4 | **Kalendář** | month heatmap + backfill entry point |
| 5 | Day detail | read view of one day, editable |
| 6 | **Přehled** | trend · weekday · sleep · tag associations · instrument history |
| 7 | Dotazníky | PHQ-9 / GAD-7 / WHO-5, due dates, history |
| 8 | Nastavení | reminder · appearance · lock · data |
| 9 | Export / Zpráva | CSV, JSON, printable clinician summary |
| 10 | Když je zle | crisis resources, always two taps away |

---

## 6. The entry flow

One vertically scrolling card stack with **progressive disclosure**. The critical
property: a valid entry can be completed at the first card. Everything below is
optional and can be abandoned at any point without losing what was entered.

```
┌─ Tier 0 · ~15 s ─────────── always visible, above the fold
│  Jak byl dnešek?          mood −3…+3
│  → live circumplex label once energy is also set
│  [ Uložit den ]            ← enabled the moment mood is set
│
├─ Tier 1 · ~45 s ─────────── one scroll
│  Energie 1–5 · Úzkost 1–5
│  Spánek: hodin + kvalita
│  Co dnes hrálo roli?       tag chips
│
├─ Tier 2 · ~2 min ────────── behind "Přidat víc"
│  Léky · Poznámka (280) · Co dnes pomohlo?
│
└─ Tier 3 · weekly / fortnightly ─ offered on Dnes when due, never blocking
   WHO-5 · PHQ-9 · GAD-7
```

**Autosave on every interaction.** A phone call mid-entry must not cost the entry.
Draft state persists to IndexedDB immediately; the save button commits and
timestamps.

### Anticipated behaviour, and the response

| What people actually do | Design response |
|---|---|
| Forget for three days, then feel behind | Calendar shows gaps quietly. `Doplnit` fills up to 7 days back, flagged as retrospective. No guilt copy, no broken streak. |
| Log at 02:00, meaning yesterday | Entries between 00:00 and 04:00 default to the **previous** day, with a visible, tappable date chip to override. |
| Rate everything 0 on flat days | Fine — that is data. The neutral point exists so this is honest rather than forced. |
| Open the app to *read*, not write | Once today is saved, **Dnes** flips to a summary card with the 7-day sparkline. It stops asking. |
| Want to change today's rating an hour later | Freely editable, `updatedAt` recorded. No penalty, no warning. |
| Abandon after two weeks | The one honest lever is the reminder plus a payoff that arrives early: the tag-association card unlocks at 14 entries and is announced in onboarding, so there is a reason to reach it. |
| Hand the phone to someone | App lock (PIN or biometric), and a blur on the app-switcher snapshot. |

---

## 7. Charts

Applies throughout: thin marks, 2 px lines, ≥8 px hit targets, 2 px surface gap
between adjacent fills, recessive grid (`--line` at 40 %), values in `--muted` ink
rather than the series colour, and **direct labels in preference to legends** where
there are ≤4 series. Every chart has a tap-to-inspect layer; every chart has a
table view behind a toggle.

**Never a dual y-axis.** Sleep and mood are two charts stacked on a shared x-axis,
never two scales on one frame.

| Chart | Form | Rule |
|---|---|---|
| **Mood trend** | line, 7-day centred rolling mean + faint daily dots | Rolling mean requires ≥4 of 7 days present, else the segment breaks. Gaps are *gaps* — never interpolated across. At 365 days the series aggregates to weekly means with a 4-week window (≥2 days per week), because 365 points across 344 px is mush, not data. |
| **Month heatmap** | 7×5 calendar grid, mood ramp fill | Day number always visible. Untracked days are outlined, not filled. Retrospective days get a hairline ring. |
| **Distribution** | horizontal bars, 7 mood levels | Shows drift toward a scale end. |
| **Weekday pattern** | bars, mean ± bootstrap 95 % CI | Suppressed until ≥3 observations per weekday. The CI is the point — it stops "Mondays are worse" from being read off noise. |
| **Sleep → next-day mood** | single-hue scatter + LOESS | Spearman ρ, suppressed below n = 20. Lag is deliberate: last night's sleep against today's mood. |
| **Tag associations** | diverging bars, sorted by effect | mean(mood │ tag) − mean(mood │ no tag), with Hedges' *g*. Suppressed below n = 5. |
| **Instrument history** | stepped line over shaded severity bands | Bands are the reference. A reliable-change marker appears only at PHQ-9 ≥5 / GAD-7 ≥4 points. |

### 7.1 Statistical honesty

Non-negotiable, and the main thing separating this from the consumer apps:

- **Minimum n before any statistic is shown at all.** An empty state that says
  `Ještě málo dat — potřebujeme 20 dní` is more useful than a correlation
  computed from six points.
- **Uncertainty is drawn, not hidden.** Confidence intervals on every aggregate.
- **Association language only.** `Dny se sportem: +0,8` — never *"sport zlepšuje
  tvou náladu"*. A permanent footnote reads `Souvislost, ne příčina.`
- **Non-parametric throughout.** Ordinal self-report on 7 points is not interval
  data. Spearman, not Pearson; Hodges–Lehmann median difference, not a t-test;
  permutation tests (2000 shuffles) for tag effects.
- **No diagnosis, ever.** A PHQ-9 of 17 renders as `Středně těžké pásmo — stojí za
  to to probrat s odborníkem`, never as a condition.

---

## 8. Data model

IndexedDB, four object stores, no dependencies (~40-line wrapper).

```js
// store: days — keyPath "day"
{
  schemaVersion: 1,
  day: "2026-07-30",          // local ISO date, the primary key
  createdAt: "2026-07-30T21:14:03+02:00",
  updatedAt: "2026-07-30T21:14:03+02:00",
  retrospective: false,       // true when logged >1 day after `day`
  mood:    -3,                // −3…3 | null  (the only field that makes an entry valid)
  energy:   2,                // 1…5   | null
  anxiety:  4,                // 1…5   | null
  sleep:  { hours: 6.5, quality: 2, bedtime: null, wake: null },
  meds:   [{ id: "sertralin", taken: true }],
  tags:   ["work", "conflict", "poor_sleep"],
  note:   "…",                // ≤280
  helped: ["walk"]            // "co dnes pomohlo"
}

// store: assessments — autoIncrement, index [instrument, takenAt]
{ id, instrument: "PHQ9"|"GAD7"|"WHO5", takenAt, items: [0,2,3,…], total, band }

// store: settings — single record
{ reminderTime: "21:00", lock: "pin"|"bio"|"off", amoled: false,
  cvdSafe: false, showValues: true, excludeRetrospective: false,
  address: "neutral"|"m"|"f", tags: [...], meds: [...] }

// store: meta
{ schemaVersion, lastBackupAt, installedAt, persistedStorage: true }
```

Tag and med **ids are English and stable**; Czech labels live in a separate string
table. Renaming a tag must never orphan history.

---

## 9. Platform integration — Android 16 / One UI 8.5

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#282A36">
<meta name="color-scheme" content="dark">   <!-- stops Chrome force-darkening -->
```

- `manifest.webmanifest`: `display: "standalone"`, `orientation: "portrait"`,
  `background_color`/`theme_color` `#282A36`, icons at 192/512 plus a **maskable**
  512 (One UI applies its own icon mask — a non-maskable icon gets cropped).
- **Manifest shortcut** `Rychlý zápis` → `/?action=quick`, so a long-press on the
  home-screen icon jumps straight to the mood row.
- Safe areas via `env(safe-area-inset-bottom)` — the bottom nav must clear the One
  UI gesture bar.
- `navigator.storage.persist()` requested on first save. **Without it Android may
  evict site data under storage pressure.** Settings shows the live status, and
  refusal downgrades the backup reminder from monthly to weekly.
- `navigator.vibrate(10)` on every scale selection. Cheap, and it makes a 7-button
  row feel like a physical control.
- `inputmode="decimal"` on sleep hours; no free-text input anywhere in Tier 0–1,
  so the keyboard never covers the form.
- Respect `prefers-reduced-motion`; respect user font scaling (`rem` throughout,
  no `px` font sizes, no `maximum-scale`).

### 9.1 Reminders — the honest position

**A PWA cannot reliably schedule a local notification on Android.** The
Notification Triggers API never shipped; `periodicSync` is heuristic and
Chrome-only; a service worker cannot wake itself on a timer. Anything promising
otherwise is a push server, which means a backend and an always-on network path.

v1 therefore does **not** claim a notification it cannot deliver:

1. Onboarding walks through creating a repeating **Samsung Clock alarm** or
   Google Calendar event at the chosen time, labelled `Zapsat den`. Ugly, but it
   fires with 100 % reliability, which no web API here can match.
2. The manifest shortcut makes acting on it a single tap.
3. On open, if yesterday is unlogged, **Dnes** offers `Doplnit včerejšek` inline.

Optional v2: Web Push via a minimal free endpoint (e.g. ntfy). Flagged clearly,
because it is the only feature that would require a network connection.

---

## 10. Privacy & data ownership

- **All data on-device.** No account, no analytics, no network call after install.
- **App lock:** PIN, or biometric via WebAuthn where available. Content blurred in
  the app switcher.
- **Export:** CSV (one row per day, English headers), JSON (full fidelity,
  re-importable), and a **printable clinician summary** — 30/90-day trend, current
  instrument scores with bands, medication adherence, using a print stylesheet
  that drops to ink-on-white.
- **Monthly backup prompt.** Browser storage is not a backup. The prompt writes to
  the phone's Downloads folder, where OneDrive already syncs.
- **Import** validates `schemaVersion` and merges by `day`, never silently
  overwriting a day that already holds data.

---

## 11. Build plan

Vanilla HTML/CSS/JS. No build step, no framework, no dependencies — this is a
single-user app of roughly 3,000 lines, and a toolchain would cost more than it
returns. Charts are hand-drawn SVG; every chart here is a line, a bar or a grid.

```
soumrak/
  index.html
  app.css                  tokens · components · screens
  js/
    db.js                  IndexedDB wrapper, migrations
    model.js               entry validation, derived fields
    stats.js               rolling mean, Spearman, permutation, bootstrap CI
    instruments.js         PHQ-9 / GAD-7 / WHO-5 items, scoring, bands
    charts.js              SVG renderers
    ui.js                  screens, routing, gestures
    strings.cs.js          every Czech string, one file
  sw.js                    precache app shell, cache-first
  manifest.webmanifest
  icons/                   192 · 512 · 512-maskable
```

| Phase | Scope | Done when |
|---|---|---|
| **1 — Skeleton** ✅ | tokens, shell, tabs, IndexedDB, Tier 0 entry, install + offline | You can log a mood on the A55 with aeroplane mode on, close, reopen, and it is still there. |
| **2 — Full entry** ✅ | Tiers 1–2, tags, sleep, day detail, edit, backfill | A complete day takes under a minute. |
| **3 — Seeing it** ✅ | calendar heatmap, mood trend, distribution | The month is readable at a glance. |
| **4 — Instruments** | PHQ-9 / GAD-7 / WHO-5, scheduling, band chart, item-9 safety card | Scores plot against severity bands. |
| **5 — Insight** | weekday, sleep lag, tag associations, all n-gates and CIs | No statistic appears before it is earned. |
| **6 — Trust** | lock, export/import, clinician report, backup prompt, AMOLED + CVD modes | The data can leave and come back intact. |

Phase 1 is genuinely usable on its own. Ship it to the phone before building
phase 2 — a week of real evening entries will reorder everything below it.

**Built ahead of schedule, and why.** Import/restore was specified for phase 6,
but export without import is a false safety net — after an eviction the backup
would be unreadable by the app that wrote it. It ships in phase 2. The crisis
resources also moved up from phase 4: shipping any mood tracker without them
isn't defensible.

**Test suite.** `soumrak/tests/` runs in the browser so it can be executed on the
A55 itself, which is the only device whose behaviour actually matters. 53 checks
covering date handling across DST and leap years, the entry model, statistics
gaps and aggregation, IndexedDB semantics, and a full backup → data-loss →
restore roundtrip.

---

## 12. Known risks

| Risk | Mitigation |
|---|---|
| `file://` has no storage or service worker | §1 — hosting or an APK wrapper. Non-negotiable. |
| Android evicts IndexedDB under storage pressure | `storage.persist()` + monthly export prompt + status shown in settings |
| No reliable PWA reminder | §9.1 — a system alarm, honestly presented, not a promise |
| Tracking increases rumination | Short entry, capped note, no daily questionnaire, no streak |
| Self-diagnosis from a chart | Band labels only, association language, permanent disclaimer |
| Item 9 disclosed to an app that does nothing | Crisis card on any non-zero response; resources permanently in **Více** |
| Seven mood levels indistinguishable under CVD | Mandatory second encoding everywhere + `Bezbariérový režim` |

---

*Soumrak není zdravotnický prostředek. Nenahrazuje diagnózu ani péči odborníka.*
