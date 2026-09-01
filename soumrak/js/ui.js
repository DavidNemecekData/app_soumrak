/* Obrazovky, směrování a vykreslování. Bez frameworku — je to
   jednouživatelská aplikace a stav se vejde do jednoho objektu.

   Jedno pravidlo platí v celém souboru bez výjimky: text, který mohl
   napsat uživatel — vlastní štítek, poznámka, záznam myšlenky — projde
   přes M.esc(). Obrazovky se skládají přes innerHTML a jediná ostrá
   závorka ve štítku by jinak rozbila celou kartu. */

import * as db from './db.js';
import * as M from './model.js';
import * as INS from './instruments.js';
import * as TH from './thoughts.js';
import { mean, rollingMean, segments, seriesFor, distribution, buckets } from './stats.js';
import {
  T, MOOD_ANCHORS, MOOD_PHRASE, ENERGY_ANCHORS, ANXIETY_ANCHORS, SLEEPQ_ANCHORS,
  DEFAULT_TAGS, WEEKDAYS_SHORT, MONTHS_NOM, EMOTIONS, EMOTION_GROUPS, STRATEGIES,
  gender, hyphenate
} from './strings.cs.js';

/* ── stav ────────────────────────────────────────────────────── */

const state = {
  screen: 'today',
  targetDay: M.logicalToday(),   // který den formulář upravuje
  entry: null,                   // záznam pro targetDay
  yesterday: null,
  editing: false,                // vynucený formulář i u platného záznamu
  showTier2: false,              // rozbalená volitelná část zápisu
  showEmotions: false,           // rozbalený slovník emocí
  calMonth: null,                // {y, m} zobrazený měsíc
  dayView: null,                 // záznam otevřený v detailu dne
  dayViewKey: null,
  tags: [],                      // {id, label}
  meds: [],
  totalDays: 0,
  persisted: false,
  range: 30,                     // 30 | 90 | 365 dní v Přehledu
  readout: null,                 // index bodu vybraného ťuknutím do grafu
  tables: {},                    // které grafy mají rozbalenou tabulku
  address: 'neutral',            // rod v dotazníku WHO-5
  amoled: false,

  quiz: null,                    // {instrument, index, items, result}
  instrumentView: null,          // rozbalená historie jednoho dotazníku
  thoughts: [],                  // seznam záznamů myšlenek
  thought: null,                 // rozepsaný nebo otevřený záznam
  thoughtStep: 0,
  thoughtMode: 'view',
  onbStep: 0
};

/* ── drobné pomůcky ──────────────────────────────────────────── */

const $ = (sel) => document.querySelector(sel);
const esc = M.esc;

/** Rod podle nastavení. Používá se všude, kde text nese značku {m|f}. */
const g = (text) => gender(text, state.address);

function haptic(ms = 8) {
  if (navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* nevadí */ } }
}

function announce(msg) {
  const live = $('#live');
  if (live) live.textContent = msg;
}

let toastTimer = null;
function toast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
  announce(msg);
}

/** Položky nabízené k výběru — archivované zůstávají jen pro čtení historie. */
const active = (list) => list.filter((x) => !x.archived);

function labelsFor(ids, list) {
  return ids.map((id) => {
    const found = list.find((x) => x.id === id);
    return found ? found.label : id;   // odebraný štítek zůstává v historii pod id
  });
}

const emotionLabel = (id) => (EMOTIONS.find((e) => e.id === id) || { label: id }).label;
const strategyById = (id) => STRATEGIES.find((s) => s.id === id) || { id, label: id };

/**
 * Doplní graf do místa, které je pro něj v kartě připravené, a předá mu
 * skutečnou naměřenou šířku. Grafy se proto kreslí 1:1 — dřív měly pevný
 * viewBox 344 px, prohlížeč je zmenšil na šířku displeje a s nimi i popisky
 * os, z 9 px na 8. Tohle je jediný důvod, proč se vykresluje na dvě fáze.
 */
function fillChart(slotId, build) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  const w = Math.max(240, Math.round(slot.clientWidth));
  slot.innerHTML = build(w);
}

/* ── grafy ───────────────────────────────────────────────────── */

const AXIS_FONT = 12;   /* spodní hranice čitelnosti, viz app.css */

/**
 * Připraví body grafu podle délky období. Rok po dnech je na telefonu kaše
 * (365 bodů na 344 px), proto se od 90 dní výš slučuje po týdnech.
 * Okno klouzavého průměru se posouvá spolu s tím.
 */
function buildSeries(values, keys, range) {
  if (range <= 90) {
    return {
      mode: 'daily',
      marks: values.map((v, i) => ({
        value: v, key: keys[i], label: M.formatShort(keys[i]), n: v === null ? 0 : 1
      })),
      roll: rollingMean(values, 7, 4),
      note: T.chartDaily
    };
  }
  const bs = buckets(values, 7, 2);
  return {
    mode: 'weekly',
    marks: bs.map((b) => ({
      value: b.value,
      key: keys[b.from],
      label: `${M.formatShort(keys[b.from])}–${M.formatShort(keys[b.to])}`,
      n: b.n
    })),
    roll: rollingMean(bs.map((b) => b.value), 4, 2),
    note: T.chartWeekly
  };
}

/**
 * Čárový graf nálady. Body jsou naměřené hodnoty, plná čára klouzavý průměr.
 * Mezery se nepřemosťují — každý souvislý úsek je vlastní <path>.
 * Přes graf leží neviditelné terče na ťuknutí, široké aspoň 8 px.
 */
function trendChart(series, w, h, selected) {
  const marks = series.marks;
  const n = marks.length;
  if (!n) return '';
  const PL = 22, PR = 8, PT = 10, PB = 20;
  const x = (i) => PL + (n === 1 ? (w - PL - PR) / 2 : (i * (w - PL - PR)) / (n - 1));
  const y = (v) => PT + ((3 - v) * (h - PT - PB)) / 6;

  let s = '';
  for (const gv of [3, 0, -3]) {
    s += `<line x1="${PL}" y1="${y(gv).toFixed(1)}" x2="${w - PR}" y2="${y(gv).toFixed(1)}" `
      + `stroke="#44475A" stroke-width="1" opacity="${gv === 0 ? 0.85 : 0.45}"/>`
      + `<text x="0" y="${(y(gv) + 4).toFixed(1)}" fill="#A2A9CC" font-size="${AXIS_FONT}">`
      + `${gv > 0 ? '+' + gv : gv}</text>`;
  }

  const r = series.mode === 'daily' ? (n > 45 ? 1.8 : 2.4) : 3;
  marks.forEach((m, i) => {
    if (m.value === null) return;
    s += `<circle cx="${x(i).toFixed(1)}" cy="${y(m.value).toFixed(1)}" r="${r}" `
      + `fill="${M.moodColor(Math.round(m.value))}" opacity="0.8"/>`;
  });

  const pts = series.roll.map((v, i) => (v === null ? null : [x(i), y(v)]));
  for (const seg of segments(pts)) {
    if (seg.length < 2) continue;
    s += `<path d="M${seg.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}" `
      + `fill="none" stroke="#BD93F9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  let last = series.roll.length - 1;
  while (last >= 0 && series.roll[last] === null) last--;
  if (last >= 0) {
    s += `<circle cx="${x(last).toFixed(1)}" cy="${y(series.roll[last]).toFixed(1)}" r="4.5" `
      + `fill="#BD93F9" stroke="#21222C" stroke-width="2"/>`;
  }

  if (selected !== null && marks[selected] && marks[selected].value !== null) {
    const cx = x(selected), cy = y(marks[selected].value);
    s += `<line x1="${cx.toFixed(1)}" y1="${PT}" x2="${cx.toFixed(1)}" y2="${h - PB}" `
      + `stroke="#F8F8F2" stroke-width="1" opacity="0.4"/>`
      + `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5.5" `
      + `fill="${M.moodColor(Math.round(marks[selected].value))}" stroke="#21222C" stroke-width="2"/>`;
  }

  s += `<text x="${PL}" y="${h - 4}" fill="#A2A9CC" font-size="${AXIS_FONT}">`
    + `${esc(marks[0].label.split('–')[0])}</text>`
    + `<text x="${w - PR}" y="${h - 4}" fill="#A2A9CC" font-size="${AXIS_FONT}" text-anchor="end">`
    + `${esc(marks[n - 1].label.split('–').pop())}</text>`;

  // terče na ťuknutí — vždy aspoň 8 px široké, i když je bodů hodně
  const step = n > 1 ? (w - PL - PR) / (n - 1) : w;
  const tw = Math.max(step, 8);
  marks.forEach((m, i) => {
    if (m.value === null) return;
    // fill="none" + pointer-events="all" je jednoznačné napříč prohlížeči;
    // u fill="transparent" závisí zásah na výkladu visiblePainted.
    s += `<rect x="${(x(i) - tw / 2).toFixed(1)}" y="0" width="${tw.toFixed(1)}" height="${h}" `
      + `fill="none" pointer-events="all" data-i="${i}" class="hit"/>`;
  });

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
      data-chart="trend" role="img" aria-label="Průběh nálady">${s}</svg>`;
}

/** Malý sedmidenní přehled bez os. */
function sparkline(values, w, h = 56) {
  const n = values.length;
  const P = 8;
  const x = (i) => P + (n === 1 ? (w - 2 * P) / 2 : (i * (w - 2 * P)) / (n - 1));
  const y = (v) => P + ((3 - v) * (h - 2 * P)) / 6;
  let s = `<line x1="${P}" y1="${y(0)}" x2="${w - P}" y2="${y(0)}" stroke="#44475A" stroke-width="1" opacity="0.6"/>`;
  const pts = values.map((v, i) => (v === null ? null : [x(i), y(v)]));
  for (const seg of segments(pts)) {
    if (seg.length < 2) continue;
    s += `<path d="M${seg.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}" `
      + `fill="none" stroke="#BD93F9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  values.forEach((v, i) => {
    if (v === null) return;
    const lastOne = i === n - 1;
    s += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${lastOne ? 4.5 : 3}" `
      + `fill="${M.moodColor(v)}" stroke="#21222C" stroke-width="${lastOne ? 2 : 0}"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
      role="img" aria-label="Posledních sedm dní">${s}</svg>`;
}

/**
 * Historie dotazníku: stupňovitá čára nad pruhy závažnosti. Pásma jsou
 * měřítko, ne ozdoba — bez nich je číslo 12 samo o sobě nic.
 */
function bandChart(instrument, list, w, h = 150) {
  const def = INS.INSTRUMENTS[instrument];
  const PL = 30, PR = 8, PT = 10, PB = 22;
  const maxV = def.displayMax;
  const y = (v) => PT + ((maxV - v) * (h - PT - PB)) / maxV;
  const n = list.length;
  const x = (i) => PL + (n === 1 ? (w - PL - PR) / 2 : (i * (w - PL - PR)) / (n - 1));

  const TONE = { good: '#50FA7B', warning: '#F1FA8C', serious: '#FFB86C', critical: '#FF5555' };

  let s = '';
  let lo = 0;
  for (const b of def.bands) {
    const top = y(b.max), bot = y(lo);
    s += `<rect x="${PL}" y="${top.toFixed(1)}" width="${(w - PL - PR).toFixed(1)}" `
      + `height="${Math.max(0, bot - top).toFixed(1)}" fill="${TONE[b.tone]}" opacity="0.10"/>`
      + `<line x1="${PL}" y1="${top.toFixed(1)}" x2="${w - PR}" y2="${top.toFixed(1)}" `
      + `stroke="${TONE[b.tone]}" stroke-width="1" opacity="0.35"/>`;
    lo = b.max;
  }

  s += `<text x="0" y="${(y(maxV) + 4).toFixed(1)}" fill="#A2A9CC" font-size="${AXIS_FONT}">${maxV}</text>`
    + `<text x="0" y="${(y(0) + 4).toFixed(1)}" fill="#A2A9CC" font-size="${AXIS_FONT}">0</text>`;

  if (n) {
    // Stupňovitá čára: mezi dvěma vyplněními se nic neměřilo, takže se
    // hodnota drží a pak skočí. Šikmá spojnice by předstírala plynulý vývoj.
    let d = '';
    list.forEach((a, i) => {
      const px = x(i), py = y(a.total);
      if (i === 0) { d += `M${px.toFixed(1)},${py.toFixed(1)}`; return; }
      const prev = y(list[i - 1].total);
      d += `L${px.toFixed(1)},${prev.toFixed(1)}L${px.toFixed(1)},${py.toFixed(1)}`;
    });
    if (n > 1) {
      s += `<path d="${d}" fill="none" stroke="#BD93F9" stroke-width="2" `
        + `stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    list.forEach((a, i) => {
      const tone = TONE[INS.bandFor(instrument, a.total).tone];
      s += `<circle cx="${x(i).toFixed(1)}" cy="${y(a.total).toFixed(1)}" r="4" `
        + `fill="${tone}" stroke="#21222C" stroke-width="2"/>`;
    });
    s += `<text x="${PL}" y="${h - 4}" fill="#A2A9CC" font-size="${AXIS_FONT}">`
      + `${esc(M.formatShort(dayOf(list[0])))}</text>`;
    if (n > 1) {
      s += `<text x="${w - PR}" y="${h - 4}" fill="#A2A9CC" font-size="${AXIS_FONT}" text-anchor="end">`
        + `${esc(M.formatShort(dayOf(list[n - 1])))}</text>`;
    }
  }

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
      role="img" aria-label="Historie dotazníku ${esc(def.name)}">${s}</svg>`;
}

const dayOf = (a) => a.day || M.dateKey(new Date(a.takenAt));

/* ── tabulky pod grafy ───────────────────────────────────────── */

function distributionHTML(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return `<p class="note tight">${T.distributionEmpty}</p>`;
  const max = Math.max(...counts);

  let s = '<div class="dist">';
  for (let v = 3; v >= -3; v--) {
    const c = counts[v + 3];
    const pct = Math.round((c / total) * 100);
    s += `<div class="dist-row">
        <span class="k">${M.signed(v, 0)}</span>
        <span class="track"><i style="width:${max ? (c / max) * 100 : 0}%;
          background:${M.moodColor(v)}"></i></span>
        <span class="v">${c}</span>
        <span class="p">${pct} %</span>
      </div>`;
  }
  return s + '</div>';
}

function distributionTable(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  let rows = '';
  for (let v = 3; v >= -3; v--) {
    const c = counts[v + 3];
    rows += `<tr><td>${M.signed(v, 0)} · ${esc(MOOD_ANCHORS[String(v)])}</td>`
      + `<td class="num">${c}</td>`
      + `<td class="num">${total ? Math.round((c / total) * 100) : 0} %</td></tr>`;
  }
  return `<table class="datatable"><thead><tr>
      <th>${T.tableMood}</th><th class="num">${T.tableCount}</th><th class="num">${T.tableShare}</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function trendTable(series) {
  const rows = series.marks.map((m) => {
    const val = m.value === null
      ? `<span class="muted">${T.tableNoData}</span>`
      : series.mode === 'daily'
        ? `${M.signed(m.value, 0)} · ${esc(MOOD_ANCHORS[String(Math.round(m.value))])}`
        : M.signed(m.value);
    return `<tr><td>${esc(m.label)}</td><td class="num">${val}</td></tr>`;
  }).join('');
  return `<table class="datatable"><thead><tr>
      <th>${series.mode === 'daily' ? T.tableDay : T.tableWeek}</th>
      <th class="num">${series.mode === 'daily' ? T.tableMood : T.tableAvg}</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

/** Přepínač tabulky pod grafem — bez něj by graf byl jediná cesta k datům. */
function tableToggle(id, open) {
  return `<button class="tabletoggle" data-table="${id}" aria-expanded="${open}">
      ${open ? T.tableHide : T.tableShow}
    </button>`;
}

/* ── společné kusy formuláře ─────────────────────────────────── */

function moodRowHTML(selected) {
  let s = '<div class="moodrow" id="moodrow" role="group" aria-label="Nálada">';
  for (let v = -3; v <= 3; v++) {
    const on = selected === v;
    const glyph = M.signed(v, 0);
    s += `<button class="mood" data-m="${v}" aria-pressed="${on}" `
      + `aria-label="${glyph} — ${esc(MOOD_ANCHORS[String(v)])}">${glyph}</button>`;
  }
  s += '</div><div class="anchors" aria-hidden="true">';
  for (let v = -3; v <= 3; v++) {
    s += `<span>${esc(hyphenate(MOOD_ANCHORS[String(v)]))}</span>`;
  }
  return s + '</div>';
}

function quadrantHTML(entry) {
  const q = M.quadrantLabel(entry.mood, entry.energy);
  let title, sub, color;
  if (!M.has(entry.mood)) {
    title = T.quadrantEmpty; sub = T.quadrantAxes; color = 'var(--muted)';
  } else if (!M.has(entry.energy)) {
    title = MOOD_PHRASE[String(entry.mood)]; sub = T.quadrantNeedEnergy; color = M.moodColor(entry.mood);
  } else {
    title = q[0]; sub = q[1]; color = M.moodColor(entry.mood);
  }
  return `<div class="quadrant">
      <span class="dot" style="background:${color}"></span>
      <span><b>${esc(title)}</b><span class="sub">${esc(sub)}</span></span>
    </div>`;
}

/**
 * Pětistupňová škála se všemi pěti kotvami. Popsané jen konce znamenají,
 * že si střed každý vyloží po svém a po půl roce znamená „3" něco jiného
 * než na začátku — přesně ten drift, kvůli kterému má celé měření cenu.
 */
function scale5HTML(field, selected, anchors, label, tone = '') {
  let s = `<div class="scale5 ${tone}" data-scale="${field}" role="group" aria-label="${esc(label)}">`;
  for (let v = 1; v <= 5; v++) {
    s += `<button data-v="${v}" aria-pressed="${selected === v}" `
      + `aria-label="${v} z 5 — ${esc(anchors[v - 1])}">${v}</button>`;
  }
  s += '</div><div class="scale-anchors" aria-hidden="true">';
  for (let v = 1; v <= 5; v++) {
    s += `<span data-on="${selected === v}">${esc(hyphenate(anchors[v - 1]))}</span>`;
  }
  return s + '</div>';
}

function sleepHTML(entry) {
  const h = entry.sleep.hours;
  return `<div class="card">
      <span class="card-label">${T.sleep}</span>
      <div class="stepper">
        <button data-act="sleep-down" aria-label="Ubrat půl hodiny">−</button>
        <span class="val" id="sleep-val" aria-live="polite">${M.has(h) ? M.formatHours(h) : '—'}</span>
        <button data-act="sleep-up" aria-label="Přidat půl hodiny">+</button>
      </div>
      <div class="ends">
        <span>${T.sleepHours}</span>
        ${M.has(h) ? `<button class="linkbtn" data-act="sleep-clear">${T.sleepUnknown}</button>` : '<span></span>'}
      </div>
      <span class="card-label mt-4">${T.sleepQuality}</span>
      ${scale5HTML('sleepQuality', entry.sleep.quality, SLEEPQ_ANCHORS, T.sleepQuality, 'cy')}
    </div>`;
}

function tagsHTML(entry, allTags) {
  // Nabízí se aktivní štítky plus ty archivované, které na dnešku už visí —
  // jinak by se odznačit nedaly.
  const tags = allTags.filter((t) => !t.archived || entry.tags.includes(t.id));
  const chips = tags.map((t) =>
    `<button class="chip${entry.tags.includes(t.id) ? ' on' : ''}" data-tag="${esc(t.id)}" `
    + `aria-pressed="${entry.tags.includes(t.id)}">${esc(t.label)}</button>`).join('');

  // „Co pomohlo" se ukáže, až je co označit — jinak je to prázdná otázka.
  const chosen = tags.filter((t) => entry.tags.includes(t.id));
  const helped = chosen.length ? `
      <span class="card-label mt-4">${T.helped}</span>
      <div class="chips">${chosen.map((t) =>
        `<button class="chip alt${entry.helped.includes(t.id) ? ' on' : ''}" data-helped="${esc(t.id)}" `
        + `aria-pressed="${entry.helped.includes(t.id)}">${esc(t.label)}</button>`).join('')}</div>
      <p class="note">${T.helpedHint}</p>` : '';

  return `<div class="card">
      <span class="card-label">${T.tags}</span>
      <div class="chips">${chips}</div>
      ${helped}
    </div>`;
}

/** Slovník emocí — rozbalovací, aby večer, kdy na to není nálada, nepřekážel. */
function emotionsHTML(entry) {
  const n = entry.emotions.length;
  const head = `<button class="disclosure" data-act="toggle-emotions" aria-expanded="${state.showEmotions}">
      ${T.emotions}${n ? ` · ${T.emotionsChosen(n)}` : ''}
    </button>`;
  if (!state.showEmotions) {
    return `<div class="card">
        ${head}
        ${n ? `<div class="chips mt-3">${entry.emotions.map((id) =>
          `<span class="chip on static">${esc(emotionLabel(id))}</span>`).join('')}</div>` : ''}
      </div>`;
  }
  const groups = EMOTION_GROUPS.map(([q, title]) => {
    const list = EMOTIONS.filter((e) => e.q === q);
    return `<span class="card-label mt-3">${esc(title)}</span>
      <div class="chips">${list.map((e) =>
        `<button class="chip warm${entry.emotions.includes(e.id) ? ' on' : ''}" `
        + `data-emotion="${esc(e.id)}" aria-pressed="${entry.emotions.includes(e.id)}">`
        + `${esc(e.label)}</button>`).join('')}</div>`;
  }).join('');
  return `<div class="card">
      ${head}
      ${groups}
      <p class="note">${T.emotionsHint}</p>
    </div>`;
}

/** Strategie zvládání. Krátkodobé úlevy jsou označené, ne schované. */
function strategiesHTML(entry) {
  return `<div class="card">
      <span class="card-label">${T.strategies}</span>
      <div class="chips">${STRATEGIES.map((s) => {
        const on = entry.strategies.includes(s.id);
        return `<button class="chip${on ? ' on' : ''}" data-strategy="${esc(s.id)}" `
          + `aria-pressed="${on}">${esc(s.label)}`
          + (s.shortTerm ? `<span class="badge">· ${T.strategyShort}</span>` : '')
          + '</button>';
      }).join('')}</div>
      <p class="note">${T.strategiesHint}</p>
    </div>`;
}

function medsHTML(entry, allMeds) {
  const meds = allMeds.filter((m) => !m.archived);
  if (!meds.length) return '';
  const taken = new Map((entry.meds || []).map((m) => [m.id, m.taken]));
  return `<div class="card">
      <span class="card-label">${T.meds}</span>
      <div class="chips">${meds.map((m) =>
        `<button class="chip${taken.get(m.id) ? ' on' : ''}" data-med="${esc(m.id)}" `
        + `aria-pressed="${!!taken.get(m.id)}">${esc(m.label)}</button>`).join('')}</div>
    </div>`;
}

function noteHTML(entry) {
  const n = entry.note || '';
  return `<div class="card">
      <span class="card-label">${T.note} · ${T.noteOptional}</span>
      <textarea id="note" maxlength="${M.NOTE_MAX}" rows="3"
        placeholder="${esc(T.notePlaceholder)}">${esc(n)}</textarea>
      <div class="ends">
        <span>${T.noteWhyCapped}</span>
        <span id="note-count">${T.noteCounter(n.length, M.NOTE_MAX)}</span>
      </div>
    </div>`;
}

/* ── DNES ────────────────────────────────────────────────────── */

function renderTodayForm(body) {
  const e = state.entry;
  const isToday = state.targetDay === M.logicalToday();

  let s = '';

  // Zapisuje se jiný den, než jaký ukazuje kalendář na zdi — musí to být vidět.
  if (!isToday) {
    s += `<div class="card accent"><div class="rowbetween">
        <div>
          <b>${T.dateOverride}</b>
          <span class="note tight">${esc(M.formatLong(state.targetDay))}</span>
        </div>
        <button class="btn-ghost" data-act="target-today">${T.backToToday}</button>
      </div></div>`;
  }

  s += `<div class="card">
      <div class="q">${isToday ? T.question : T.questionOther}</div>
      ${moodRowHTML(e.mood)}
      ${quadrantHTML(e)}
    </div>
    <div class="card">
      <span class="card-label">${T.energy}</span>
      ${scale5HTML('energy', e.energy, ENERGY_ANCHORS, T.energy)}
      <p class="note">${T.energyHint}</p>
    </div>
    <div class="card">
      <span class="card-label">${T.anxiety}</span>
      ${scale5HTML('anxiety', e.anxiety, ANXIETY_ANCHORS, T.anxiety, 'pk')}
    </div>
    ${sleepHTML(e)}
    ${tagsHTML(e, state.tags)}
    ${emotionsHTML(e)}`;

  // Vrstva 2 je schovaná: většina večerů skončí výš a nemá se prokousávat
  // poli, která nevyplní.
  s += `<button class="disclosure" data-act="toggle-more" aria-expanded="${state.showTier2}">
      ${state.showTier2 ? T.addLess : T.addMore}
    </button>`;
  if (state.showTier2) {
    s += strategiesHTML(e) + medsHTML(e, state.meds) + noteHTML(e);
  }

  body.innerHTML = s;

  const bar = $('#today-savebar');
  bar.hidden = false;
  const btn = $('#btn-save');
  btn.disabled = !M.isValid(e);
  btn.textContent = M.isValid(e) ? (isToday ? T.save : T.saveOther) : T.saveHint;
}

function renderTodaySummary(body, due) {
  const e = state.entry;
  const y = state.yesterday;

  let s = `<div class="card">
      <div class="summary-head">
        <span class="moodbadge" style="background:${M.moodColor(e.mood)}">${M.signed(e.mood, 0)}</span>
        <span class="t">
          <b>${esc(MOOD_PHRASE[String(e.mood)])}</b>
          <span>${e.retrospective ? T.retroBadge + ' · ' : ''}${M.formatTime(e.updatedAt)}</span>
        </span>
        <button class="btn-ghost" data-act="edit">${T.edit}</button>
      </div>
      <div class="cells">
        <div class="cell"><div class="k">${T.energy}</div>
          <div class="v">${M.has(e.energy) ? e.energy + ' / 5' : '—'}</div></div>
        <div class="cell"><div class="k">${T.anxiety}</div>
          <div class="v">${M.has(e.anxiety) ? e.anxiety + ' / 5' : '—'}</div></div>
        <div class="cell"><div class="k">${T.sleep}</div>
          <div class="v">${M.formatHours(e.sleep.hours)}</div></div>
      </div>
      ${e.tags.length ? `<div class="chips mt-3">${
        labelsFor(e.tags, state.tags).map((l) => `<span class="chip on static">${esc(l)}</span>`).join('')
      }</div>` : ''}
      ${e.emotions.length ? `<div class="chips mt-3">${
        e.emotions.map((id) => `<span class="chip warm on static">${esc(emotionLabel(id))}</span>`).join('')
      }</div>` : ''}
    </div>`;

  // Včerejšek se ukazuje až tady. Před hodnocením by fungoval jako kotva.
  if (y && M.isValid(y)) {
    s += `<div class="card">
        <span class="card-label">${T.yesterday}</span>
        <div class="summary-head plain" style="margin-bottom:0">
          <span class="moodbadge sm" style="background:${M.moodColor(y.mood)}">${M.signed(y.mood, 0)}</span>
          <span class="t"><b>${esc(MOOD_PHRASE[String(y.mood)])}</b></span>
        </div>
        <p class="note">${T.yesterdayNote}</p>
      </div>`;
  } else if (state.targetDay === M.logicalToday()) {
    const yKey = M.addDays(state.targetDay, -1);
    s += `<div class="card accent"><div class="rowbetween">
        <div>
          <b>${T.backfillTitle}</b>
          <span class="note tight">${esc(M.formatLong(yKey))}</span>
        </div>
        <button class="btn-chip" data-act="backfill" data-day="${yKey}">${T.backfillCta}</button>
      </div></div>`;
  }

  // Dotazník, který je na řadě. Nikdy neblokuje a nikdy se nevnucuje víc
  // než jednou kartou.
  if (due.length) {
    const d = due[0];
    const def = INS.INSTRUMENTS[d.instrument];
    s += `<div class="card accent"><div class="rowbetween">
        <div>
          <b>${esc(def.name)} — ${esc(def.full.toLowerCase())}</b>
          <span class="note tight">${d.never ? 'zatím nevyplněno' : 'je na řadě'} · ${def.items.length} otázek</span>
        </div>
        <button class="btn-chip" data-act="start-quiz" data-instrument="${d.instrument}">Vyplnit</button>
      </div></div>`;
  }

  s += `<div class="card">
      <div class="rowbetween">
        <div>
          <b>Záznam myšlenky</b>
          <span class="note tight">Když se něco pořád vrací. Osm kroků, dá se přerušit.</span>
        </div>
        <button class="btn-ghost" data-act="new-thought">Začít</button>
      </div>
    </div>`;

  s += `<div class="card">
      <span class="card-label">${T.last7}</span>
      <div id="spark-slot"></div>
    </div>`;

  body.innerHTML = s;
  $('#today-savebar').hidden = true;
}

/** Dotazníky, které jsou na řadě. Nikdy neblokují zápis. */
async function dueInstruments() {
  const out = [];
  for (const id of INS.ORDER) {
    const last = await db.lastAssessment(id);
    if (!last) { out.push({ instrument: id, never: true }); continue; }
    if (INS.isDue(id, last.takenAt)) out.push({ instrument: id, never: false });
  }
  return out;
}

async function renderToday() {
  const body = $('#today-body');
  const today = M.logicalToday();

  $('#today-title').textContent = state.targetDay === today ? T.today : T.backfillHeading;
  $('#today-date').textContent = M.formatLong(state.targetDay);

  const showForm = !M.isValid(state.entry) || state.editing;

  // počítadlo za posledních 30 dní — načítá se před vykreslením, aby se
  // po uložení první nálady přepsalo hned, ne až po přepnutí obrazovky
  const from = M.addDays(today, -29);
  const rows = await db.daysBetween(from, today);
  const logged = rows.filter(M.isValid).length;
  $('#today-count').textContent = T.countOf(logged, 30);

  if (showForm) {
    renderTodayForm(body);
    return;
  }

  renderTodaySummary(body, await dueInstruments());
  const week = seriesFor(rows, M.addDays(today, -6), 7, M.addDays);
  fillChart('spark-slot', (w) => sparkline(week.values, w));
}

/* ── KALENDÁŘ ────────────────────────────────────────────────── */

async function renderCalendar() {
  const { y, m } = state.calMonth;
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;               // pondělí = 0
  const fromKey = M.dateKey(first);
  const toKey = M.dateKey(new Date(y, m, daysInMonth));
  const today = M.logicalToday();

  const rows = await db.daysBetween(fromKey, toKey);
  const byDay = new Map(rows.map((e) => [e.day, e]));
  const vals = rows.filter(M.isValid).map((e) => e.mood);
  const avg = mean(vals);

  $('#cal-title').textContent = MONTHS_NOM[m];
  $('#cal-sub').textContent = avg === null
    ? `${y}`
    : `${y} · ${T.monthAvg} ${M.signed(avg)} · ${vals.length} ${T.daysGenitive(vals.length)}`;

  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="cal empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = M.dateKey(new Date(y, m, d));
    const e = byDay.get(key);
    if (key > today) {
      cells += `<div class="cal future">${d}</div>`;
    } else if (!e || !M.isValid(e)) {
      cells += `<button class="cal none" data-day="${key}" `
        + `aria-label="${esc(M.formatLong(key))} — ${T.notLogged}">${d}</button>`;
    } else {
      const cls = 'cal' + (e.retrospective ? ' retro' : '') + (key === today ? ' today' : '');
      cells += `<button class="${cls}" data-day="${key}" style="background:${M.moodColor(e.mood)}" `
        + `aria-label="${esc(M.formatLong(key))} — ${esc(MOOD_PHRASE[String(e.mood)])}">${d}</button>`;
    }
  }

  $('#calendar-body').innerHTML = `
    <div class="card">
      <div class="calhead">${WEEKDAYS_SHORT.map((w) => `<span>${w.toUpperCase()}</span>`).join('')}</div>
      <div class="calgrid">${cells}</div>
      <div class="legend">
        <span>−3</span>
        <span class="bars">${[-3, -2, -1, 0, 1, 2, 3]
          .map((v) => `<i style="background:${M.moodColor(v)}"></i>`).join('')}</span>
        <span>+3</span>
      </div>
      <p class="note">${T.legendMissing}</p>
    </div>
    ${monthSummaryHTML(rows, daysInMonth, today, fromKey, toKey)}`;
}

/** Shrnutí měsíce pod mřížkou — kolik dní je zapsáno a kde byly krajní hodnoty. */
function monthSummaryHTML(rows, daysInMonth, today, fromKey, toKey) {
  const valid = rows.filter(M.isValid);
  if (!valid.length) return '';

  // Neuplynulé dny se do jmenovatele nepočítají, jinak by běžící měsíc
  // vypadal vždycky jako propadák.
  const elapsed = today > toKey ? daysInMonth
    : today < fromKey ? 0
      : M.diffDays(fromKey, today) + 1;

  const best = valid.reduce((a, b) => (b.mood > a.mood ? b : a));
  const worst = valid.reduce((a, b) => (b.mood < a.mood ? b : a));

  return `<div class="card">
      <div class="cells">
        <div class="cell"><div class="k">${T.monthLogged}</div>
          <div class="v">${valid.length}${elapsed ? ` / ${elapsed}` : ''}</div></div>
        <div class="cell"><div class="k">${T.monthBest}</div>
          <div class="v"><span class="swatch" style="background:${M.moodColor(best.mood)}"></span>
            ${M.keyToDate(best.day).getDate()}.</div></div>
        <div class="cell"><div class="k">${T.monthWorst}</div>
          <div class="v"><span class="swatch" style="background:${M.moodColor(worst.mood)}"></span>
            ${M.keyToDate(worst.day).getDate()}.</div></div>
      </div>
    </div>`;
}

/* ── DETAIL DNE ──────────────────────────────────────────────── */

async function renderDay() {
  const key = state.dayViewKey;
  const e = state.dayView;
  const today = M.logicalToday();
  const age = M.diffDays(key, today);

  $('#day-title').textContent = T.dayDetail;
  $('#day-date').textContent = M.formatLong(key);

  if (!e || !M.isValid(e)) {
    const tooOld = age > M.BACKFILL_LIMIT;
    const future = age < 0;
    $('#day-body').innerHTML = `<div class="card">
      <div class="empty-state">
        <span class="ico">🌑</span><b>${T.notLogged}</b>
        <p>${future ? T.futureDay : tooOld ? T.tooOldToBackfill(M.BACKFILL_LIMIT) : ''}</p>
      </div>
      ${(future || tooOld) ? '' : `<button class="btn-save" data-act="log-this-day">${T.logThisDay}</button>`}
    </div>`;
    return;
  }

  const rows = [];
  if (M.has(e.energy)) rows.push([T.energy, `${e.energy} / 5`]);
  if (M.has(e.anxiety)) rows.push([T.anxiety, `${e.anxiety} / 5`]);
  if (M.has(e.sleep.hours)) rows.push([T.sleep, M.formatHours(e.sleep.hours)]);
  if (M.has(e.sleep.quality)) rows.push([T.sleepQuality, `${e.sleep.quality} / 5`]);

  const q = M.quadrantLabel(e.mood, e.energy);
  // Kvadrant se nevypisuje, když by jen zopakoval větu nad ním.
  const qText = q && q[0] !== MOOD_PHRASE[String(e.mood)] ? q[0] : '';
  const tagLabels = labelsFor(e.tags, state.tags);
  const helpedLabels = labelsFor(e.helped, state.tags);
  const takenMeds = (e.meds || []).filter((m) => m.taken);
  const dayThoughts = await db.thoughtsForDay(key);

  $('#day-body').innerHTML = `
    <div class="card">
      <div class="summary-head">
        <span class="moodbadge" style="background:${M.moodColor(e.mood)}">${M.signed(e.mood, 0)}</span>
        <span class="t">
          <b>${esc(MOOD_PHRASE[String(e.mood)])}</b>
          <span>${esc(qText)}${e.retrospective ? (qText ? ' · ' : '') + T.retroBadge : ''}</span>
        </span>
        <button class="btn-ghost" data-act="edit-day">${T.edit}</button>
      </div>
      ${rows.length ? `<div class="kv">${rows.map(([k, v]) =>
    `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
    </div>

    ${e.emotions.length ? `<div class="card">
      <span class="card-label">${T.emotions}</span>
      <div class="chips">${e.emotions.map((id) =>
    `<span class="chip warm on static">${esc(emotionLabel(id))}</span>`).join('')}</div>
    </div>` : ''}

    ${tagLabels.length ? `<div class="card">
      <span class="card-label">${T.tags}</span>
      <div class="chips">${tagLabels.map((l) => `<span class="chip on static">${esc(l)}</span>`).join('')}</div>
      ${helpedLabels.length ? `<span class="card-label mt-3">${T.helped}</span>
        <div class="chips">${helpedLabels.map((l) =>
    `<span class="chip alt on static">${esc(l)}</span>`).join('')}</div>` : ''}
    </div>` : ''}

    ${e.strategies.length ? `<div class="card">
      <span class="card-label">${T.strategies}</span>
      <div class="chips">${e.strategies.map((id) =>
    `<span class="chip on static">${esc(strategyById(id).label)}</span>`).join('')}</div>
    </div>` : ''}

    ${takenMeds.length ? `<div class="card">
      <span class="card-label">${T.meds}</span>
      <div class="chips">${labelsFor(takenMeds.map((m) => m.id), state.meds)
    .map((l) => `<span class="chip on static">${esc(l)} · ${T.medsTaken}</span>`).join('')}</div>
    </div>` : ''}

    ${e.note ? `<div class="card">
      <span class="card-label">${T.note}</span>
      <p>${esc(e.note)}</p>
    </div>` : ''}

    ${dayThoughts.length ? `<div class="card">
      <span class="card-label">Záznamy myšlenek</span>
      <div class="list">${dayThoughts.map((r) => `
        <button data-open-thought="${r.id}">
          <span>${esc((r.thought || r.situation || '').slice(0, 70))}
            <span class="sub">${shiftLabel(r)}</span></span>
          <span class="val">›</span>
        </button>`).join('')}</div>
    </div>` : ''}

    <div class="card">
      <p class="note tight">
        Zapsáno ${M.formatTime(e.createdAt)}${e.updatedAt !== e.createdAt
    ? ` · upraveno ${M.formatTime(e.updatedAt)}` : ''}
      </p>
      <button class="btn-ghost danger mt-2" data-act="delete-day" style="width:100%;margin-top:.5rem">
        ${T.deleteDay}
      </button>
    </div>`;
}

async function openDay(key) {
  state.dayViewKey = key;
  state.dayView = hydrate(await db.getDay(key));
  await go('day');
}

/* ── PŘEHLED ─────────────────────────────────────────────────── */

function rangeSelectorHTML() {
  return `<div class="segmented" role="group" aria-label="${T.rangeLabel}">
      ${T.ranges.map(([n, label]) =>
    `<button data-range="${n}" aria-pressed="${state.range === n}">${label}</button>`).join('')}
    </div>`;
}

async function renderInsights() {
  const today = M.logicalToday();
  const range = state.range;
  const from = M.addDays(today, -(range - 1));
  const rows = await db.daysBetween(from, today);
  const { keys, values } = seriesFor(rows, from, range, M.addDays);
  const present = values.filter((v) => v !== null);
  const logged = present.length;

  const body = $('#insights-body');
  $('#insights-range').textContent = T.ranges.find(([n]) => n === range)[1].toLowerCase();

  if ((await db.countDays()) === 0) {
    body.innerHTML = rangeSelectorHTML() + `<div class="card"><div class="empty-state">
        <span class="ico">🌑</span><b>${T.noDataTitle}</b><p>${T.noDataBody}</p>
      </div></div>`;
    return;
  }

  // Práh: průměr ze dvou zápisů není průměr, je to náhoda.
  const NEED = 7;
  let s = rangeSelectorHTML();

  if (logged < NEED) {
    s += `<div class="card"><div class="empty-state">
        <span class="ico">🌘</span><b>${T.insightsNeedMore(logged, NEED)}</b>
        <p>Graf a průměr se objeví, až bude z čeho počítat.</p>
      </div></div>`;
    body.innerHTML = s;
    return;
  }

  const series = buildSeries(values, keys, range);
  const sel = state.readout !== null && state.readout < series.marks.length ? state.readout : null;
  const chosen = sel !== null ? series.marks[sel] : null;

  const readout = chosen && chosen.value !== null
    ? `<span class="dot" style="background:${M.moodColor(Math.round(chosen.value))}"></span>
       <b>${esc(chosen.label)}</b>
       <span>${series.mode === 'daily'
    ? `${M.signed(chosen.value, 0)} · ${esc(MOOD_ANCHORS[String(Math.round(chosen.value))])}`
    : `${M.signed(chosen.value)} · ${chosen.n} ${T.daysGenitive(chosen.n)}`}</span>`
    : `<span class="dot" style="background:var(--edge)"></span><span>${T.chartTapHint}</span>`;

  const openTrend = !!state.tables.trend;
  const openDist = !!state.tables.dist;
  const counts = distribution(values);

  s += `<div class="card">
      <span class="card-label">${T.insightsAvg}</span>
      <div class="stat">
        <span class="big">${M.signed(mean(present))}</span>
        <span class="unit">${T.coverage(logged, range)}</span>
      </div>
      <div class="mt-3" id="trend-slot"></div>
      <div class="readout">${readout}</div>
      <p class="note">${series.note} <strong>${T.chartGaps}</strong></p>
      ${logged / range < 0.5 ? `<p class="note">${T.coverageThin}</p>` : ''}
      ${tableToggle('trend', openTrend)}
      ${openTrend ? `<div class="tablewrap">${trendTable(series)}</div>` : ''}
    </div>

    <div class="card">
      <span class="card-label">${T.distribution}</span>
      ${distributionHTML(counts)}
      <p class="note">${T.distributionNote}</p>
      ${tableToggle('dist', openDist)}
      ${openDist ? `<div class="tablewrap">${distributionTable(counts)}</div>` : ''}
    </div>

    <div class="callout info">
      <b>${T.howToRead}</b>
      <p>${T.howToReadBody}</p>
      <p><strong>${T.howToReadCause}</strong></p>
    </div>

    <div class="card"><p class="note tight">${T.insightsLater}</p></div>`;

  body.innerHTML = s;
  fillChart('trend-slot', (w) => trendChart(series, w, 130, sel));
}

/* ── DOTAZNÍKY ───────────────────────────────────────────────── */

function bandChip(instrument, score) {
  const b = INS.bandFor(instrument, score);
  return `<span class="band" data-tone="${b.tone}"><span class="dot"></span>${esc(b.label)}</span>`;
}

async function renderInstruments() {
  const body = $('#instruments-body');
  let s = `<div class="callout info">
      <b>K čemu jsou</b>
      <p>Denní škála zachytí, jak se věci hýbou. Tyhle tři dotazníky říkají,
      kde ta hladina leží proti tomu, co je u ostatních lidí běžné. Vyhodnocovací
      okno jsou dva týdny a nezkracuje se — kratší okno by z čísla udělalo něco,
      co se s ničím srovnat nedá.</p>
      <p><strong>Pásmo není diagnóza.</strong> Je to odkaz na normu a podnět
      k rozhovoru, ne nález.</p>
    </div>`;

  for (const id of INS.ORDER) {
    const def = INS.INSTRUMENTS[id];
    const list = await db.assessmentsFor(id);
    const last = list[list.length - 1];
    const prev = list[list.length - 2];
    const due = last ? INS.daysUntilDue(id, last.takenAt) : null;
    const open = state.instrumentView === id;

    const change = last && prev ? INS.reliableChange(id, last.total, prev.total) : null;

    s += `<div class="card">
      <div class="rowbetween">
        <div>
          <b>${esc(def.name)}</b>
          <span class="note tight">${esc(def.full)}</span>
        </div>
        <button class="btn-chip" data-act="start-quiz" data-instrument="${id}">
          ${last ? 'Vyplnit znovu' : 'Vyplnit'}
        </button>
      </div>
      <p class="note">${esc(def.purpose)}</p>`;

    if (last) {
      s += `<div class="score mt-3">
          <span class="n">${last.total}</span>
          <span class="of">/ ${def.displayMax}</span>
          ${bandChip(id, last.total)}
        </div>
        <p class="note tight">Naposledy ${esc(M.formatDate(dayOf(last)))}
          ${due !== null ? (due > 0
    ? ` · další za ${due} ${T.daysGenitive(due)}`
    : ' · je na řadě') : ''}</p>`;

      if (change) {
        s += `<p class="note">Změna oproti minule: <strong>${change.diff > 0 ? '+' : '−'}${Math.abs(change.diff)}
          ${change.better ? 've prospěch zlepšení' : 'směrem k horšímu'}</strong>.
          Rozdíl přesahuje práh ${def.reliableChange} bodů, takže ho lze brát vážněji než kolísání měření.</p>`;
      } else if (prev) {
        s += `<p class="note">Oproti minule beze změny, kterou by šlo odlišit od chyby měření
          (práh je ${def.reliableChange} bodů).</p>`;
      }

      if (list.length >= 2) {
        s += `<button class="tabletoggle" data-instrument-view="${id}" aria-expanded="${open}">
            ${open ? 'Skrýt historii' : `Historie · ${list.length}`}
          </button>`;
        if (open) {
          s += `<div class="mt-3" id="band-slot-${id}"></div>
            <div class="tablewrap">${assessmentTable(id, list)}</div>`;
        }
      }
    } else {
      s += `<p class="note">Zatím nevyplněno. ${def.items.length} otázek, zabere to pár minut.</p>`;
    }

    s += '</div>';
  }

  body.innerHTML = s;

  if (state.instrumentView) {
    const list = await db.assessmentsFor(state.instrumentView);
    if (list.length >= 2) {
      fillChart(`band-slot-${state.instrumentView}`, (w) => bandChart(state.instrumentView, list, w));
    }
  }
}

function assessmentTable(id, list) {
  const rows = [...list].reverse().map((a) => `<tr>
      <td>${esc(M.formatDate(dayOf(a)))}</td>
      <td class="num">${a.total}</td>
      <td class="muted">${esc(INS.bandFor(id, a.total).label)}</td>
    </tr>`).join('');
  return `<table class="datatable"><thead><tr>
      <th>${T.tableDay}</th><th class="num">${T.tableScore}</th><th>${T.tableBand}</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

/* ── vyplňování dotazníku ────────────────────────────────────── */

async function startQuiz(instrument) {
  const def = INS.INSTRUMENTS[instrument];
  const draft = await db.getSetting('quizDraft', null);
  if (draft && draft.instrument === instrument && Array.isArray(draft.items)
      && draft.items.length === def.items.length) {
    state.quiz = { instrument, index: draft.index || 0, items: draft.items, result: null };
  } else {
    state.quiz = { instrument, index: 0, items: new Array(def.items.length).fill(null), result: null };
  }
  await go('quiz');
}

async function saveQuizDraft() {
  if (!state.quiz || state.quiz.result) return;
  await db.setSetting('quizDraft', {
    instrument: state.quiz.instrument,
    index: state.quiz.index,
    items: state.quiz.items
  });
}

function renderQuiz() {
  const q = state.quiz;
  if (!q) return;
  const def = INS.INSTRUMENTS[q.instrument];
  const body = $('#quiz-body');
  const bar = $('#quiz-savebar');

  $('#quiz-title').textContent = def.name;

  if (q.result) {
    $('#quiz-sub').textContent = 'výsledek';
    bar.hidden = true;
    renderQuizResult(body, q);
    return;
  }

  const i = q.index;
  const answered = q.items.filter((v) => v !== null).length;
  $('#quiz-sub').textContent = `otázka ${i + 1} z ${def.items.length}`;

  body.innerHTML = `
    <div class="card">
      <div class="q-progress">
        <span class="track"><i style="width:${(answered / def.items.length) * 100}%"></i></span>
        <span class="n">${answered} / ${def.items.length}</span>
      </div>
      <p class="q-stem mt-3">${esc(g(def.stem))}</p>
      <p class="q-item">${esc(g(def.items[i]))}</p>
      <div class="q-opts">
        ${def.options.map((o) => `
          <button class="q-opt" data-opt="${o.v}" aria-pressed="${q.items[i] === o.v}">
            <span class="radio" aria-hidden="true"></span>
            <span>${esc(o.label)}</span>
            <span class="pts">${o.v}</span>
          </button>`).join('')}
      </div>
    </div>
    <div class="card">
      <p class="note tight">Odpovídej za <strong>poslední dva týdny</strong>, ne za dnešek.
        Okno je součástí dotazníku — zkrácené okno dá číslo, které se s ničím nedá srovnat.</p>
    </div>`;

  bar.hidden = false;
  const next = $('#quiz-next');
  const isLast = i === def.items.length - 1;
  const allAnswered = q.items.every((v) => v !== null);
  next.disabled = q.items[i] === null;
  next.textContent = isLast ? (allAnswered ? 'Vyhodnotit' : 'Další nezodpovězená') : 'Další';
}

function renderQuizResult(body, q) {
  const def = INS.INSTRUMENTS[q.instrument];
  const { total, band } = q.result;
  const change = q.result.change;

  let s = `<div class="card">
      <span class="card-label">${esc(def.name)} · ${esc(M.formatDate(M.logicalToday()))}</span>
      <div class="score">
        <span class="n">${total}</span>
        <span class="of">/ ${def.displayMax}</span>
      </div>
      ${bandChip(q.instrument, total)}
      <p class="note">${esc(band.hint)}</p>
    </div>`;

  if (change) {
    s += `<div class="callout ${change.better ? 'good' : 'serious'}">
        <b>Změna oproti minule</b>
        <p>${change.diff > 0 ? '+' : '−'}${Math.abs(change.diff)} bodů —
        rozdíl přesahuje práh ${def.reliableChange} bodů, takže ho lze brát vážněji
        než kolísání měření.</p>
      </div>`;
  }

  // Bezpečnostní karta u položky 9. Klidná, neblokující, hned za skórem.
  if (INS.triggersSafetyCard(q.instrument, q.items)) {
    s += safetyCardHTML();
  }

  s += `<div class="callout info">
      <b>Co to není</b>
      <p>Tohle číslo není diagnóza a nic o tobě nerozhoduje. Je to hodnota
      dotazníku, který se používá jako první orientace — a jako podklad pro
      rozhovor s někým, kdo s tím umí pracovat.</p>
    </div>
    <div class="card">
      <button class="btn-save" data-act="quiz-done">Hotovo</button>
    </div>`;

  body.innerHTML = s;
}

function safetyCardHTML() {
  return `<div class="card crisis">
      <span class="card-label" style="color:var(--orange)">Ještě něco</span>
      <p class="note tight">U poslední otázky byla zvolena jiná odpověď než „Vůbec ne".
        Takové myšlenky jsou u deprese časté a nejsou selháním. Nemusí se to řešit o samotě.</p>
      ${crisisLinesHTML()}
    </div>`;
}

function crisisLinesHTML() {
  return T.crisis.map(([name, num, sub]) =>
    `<a class="line" href="tel:${num.replace(/\s/g, '')}">
       <span class="name">${esc(name)}<span class="sub">${esc(sub)}</span></span>
       <span class="num">${esc(num)}</span>
     </a>`).join('');
}

async function answerQuiz(value) {
  const q = state.quiz;
  const def = INS.INSTRUMENTS[q.instrument];
  q.items[q.index] = value;
  haptic();
  await saveQuizDraft();

  // Posun na další nezodpovězenou. Automatický skok drží tempo, ale poslední
  // otázka se nevyhodnotí sama — přečíst si výsledek má být rozhodnutí.
  if (q.index < def.items.length - 1) {
    setTimeout(() => {
      if (state.quiz !== q || q.result || state.screen !== 'quiz') return;
      q.index += 1;
      renderQuiz();
      saveQuizDraft();
    }, 180);
    renderQuiz();
    return;
  }
  renderQuiz();
}

async function finishQuiz() {
  const q = state.quiz;
  const def = INS.INSTRUMENTS[q.instrument];

  // Nezodpovězená otázka: skočíme na ni místo vyhodnocení. Částečný dotazník
  // nemá skór, který by šlo srovnávat s normou.
  const missing = q.items.findIndex((v) => v === null);
  if (missing >= 0) {
    q.index = missing;
    renderQuiz();
    return;
  }

  const evalResult = INS.evaluate(q.instrument, q.items);
  const prev = await db.lastAssessment(q.instrument);
  const change = prev ? INS.reliableChange(q.instrument, evalResult.total, prev.total) : null;

  const record = {
    instrument: q.instrument,
    takenAt: new Date().toISOString(),
    day: M.logicalToday(),
    items: q.items.slice(),
    total: evalResult.total,
    band: evalResult.band.key
  };

  try {
    await db.putAssessment(record);
    await db.setSetting('quizDraft', null);
  } catch (err) {
    console.error('assessment:', err);
    toast(T.saveFail);
    return;
  }

  q.result = { total: evalResult.total, band: evalResult.band, change };
  haptic(14);
  announce(`${def.name}: ${evalResult.total} — ${evalResult.band.label}`);
  renderQuiz();
}

/* ── ZÁZNAM MYŠLENKY ─────────────────────────────────────────── */

function shiftLabel(r) {
  const s = TH.shift(r);
  if (s === null) return 'nedokončeno';
  if (s === 0) return 'beze změny';
  return s < 0 ? `síla emoce −${Math.abs(s)}` : `síla emoce +${s}`;
}

async function renderThoughts() {
  const list = (await db.allThoughts()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  state.thoughts = list;

  let s = `<div class="callout info">
      <b>K čemu to je</b>
      <p>Sledovat náladu samo o sobě nic nemění. Tohle je jediné místo, kde
      aplikace přechází od měření k něčemu, co se dá dělat: rozebrat jednu
      myšlenku na díly a zkusit ji říct přesněji.</p>
      <p>Osm kroků, dá se kdykoli přerušit a vrátit se. Rozepsaný záznam
      se ukládá průběžně.</p>
    </div>
    <div class="card">
      <button class="btn-save" data-act="new-thought">Nový záznam</button>
    </div>`;

  if (!list.length) {
    s += `<div class="card"><div class="empty-state">
        <span class="ico">🌘</span><b>Zatím žádný záznam</b>
        <p>Nejlíp se to dělá krátce po tom, co se něco stalo — dokud je ta věta
        ještě čerstvá.</p>
      </div></div>`;
  } else {
    s += `<div class="card">
      <span class="card-label">Historie · ${list.length}</span>
      <div class="list">${list.map((r) => `
        <button data-open-thought="${r.id}">
          <span>${esc((r.thought || r.situation || '—').slice(0, 80))}
            <span class="sub">${esc(M.formatDate(r.day))} · ${shiftLabel(r)}</span></span>
          <span class="val">${TH.isComplete(r) ? '✓' : '…'}</span>
        </button>`).join('')}</div>
    </div>`;
  }

  $('#thoughts-body').innerHTML = s;
}

function rangeHTML(id, label, value) {
  return `<span class="card-label">${esc(label)}</span>
    <div class="range">
      <input type="range" min="0" max="${TH.INTENSITY_MAX}" step="${TH.INTENSITY_STEP}"
        value="${value === null ? 50 : value}" data-range-field="${id}"
        aria-label="${esc(label)}">
      <span class="val" data-range-val="${id}">${value === null ? 50 : value}</span>
    </div>`;
}

function renderThought() {
  const r = state.thought;
  if (!r) return;
  const body = $('#thought-body');
  const bar = $('#thought-savebar');

  if (state.thoughtMode === 'view') {
    bar.hidden = true;
    renderThoughtDetail(body, r);
    return;
  }

  const step = TH.STEPS[state.thoughtStep];
  $('#thought-title').textContent = 'Záznam myšlenky';
  $('#thought-sub').textContent = `krok ${state.thoughtStep + 1} z ${TH.STEPS.length}`;

  let inner = '';
  switch (step.key) {
    case 'emotions':
      inner = EMOTION_GROUPS.map(([q, title]) => {
        const list = EMOTIONS.filter((e) => e.q === q);
        return `<span class="card-label mt-3">${esc(title)}</span>
          <div class="chips">${list.map((e) =>
    `<button class="chip warm${r.emotions.includes(e.id) ? ' on' : ''}" `
            + `data-tr-emotion="${esc(e.id)}" aria-pressed="${r.emotions.includes(e.id)}">`
            + `${esc(e.label)}</button>`).join('')}</div>`;
      }).join('')
        + `<div class="mt-4">${rangeHTML('intensityBefore', 'Jak silné to bylo?', r.intensityBefore)}</div>`;
      break;

    case 'distortions':
      inner = `<div class="chips">${TH.DISTORTIONS.map((d) =>
        `<button class="chip${r.distortions.includes(d.id) ? ' on' : ''}" `
        + `data-tr-distortion="${esc(d.id)}" aria-pressed="${r.distortions.includes(d.id)}">`
        + `${esc(d.label)}</button>`).join('')}</div>
        ${r.distortions.length ? `<div class="stack mt-3">${TH.DISTORTIONS
    .filter((d) => r.distortions.includes(d.id))
    .map((d) => `<p class="note tight"><strong>${esc(d.label)}</strong> — ${esc(d.desc)}</p>`)
    .join('')}</div>` : ''}`;
      break;

    case 'after':
      // Obě čísla se předvyplní hodnotou „před". Kdyby zůstala prázdná,
      // posuvník by ukazoval jedno a záznam držel druhé — a hlavně by
      // přehled posunu zůstal prázdný právě ve chvíli, kvůli které
      // celý formulář existuje.
      if (r.beliefAfter === null) r.beliefAfter = r.beliefBefore;
      if (r.intensityAfter === null) r.intensityAfter = r.intensityBefore;
      inner = `<div class="mt-3">${rangeHTML('beliefAfter',
        'Jak moc té původní myšlence věříš teď?', r.beliefAfter)}</div>
        <div class="mt-4">${rangeHTML('intensityAfter',
    'Jak silná je ta emoce teď?', r.intensityAfter)}</div>
        <div id="tr-shift">${shiftHTML(r)}</div>`;
      break;

    case 'thought':
      inner = `<textarea data-tr-field="thought" maxlength="${step.max}" rows="3"
          placeholder="${esc(step.placeholder)}">${esc(r.thought)}</textarea>
        <div class="mt-4">${rangeHTML('beliefBefore', g('Jak moc jsi tomu v tu chvíli věřil{|a}?'), r.beliefBefore)}</div>`;
      break;

    default:
      inner = `<textarea data-tr-field="${step.key}" maxlength="${step.max}" rows="4"
        placeholder="${esc(step.placeholder || '')}">${esc(r[step.key] || '')}</textarea>`;
  }

  body.innerHTML = `
    <div class="steps" aria-hidden="true">${TH.STEPS.map((_, i) =>
    `<i data-on="${i === state.thoughtStep}" data-done="${i < state.thoughtStep}"></i>`).join('')}</div>
    <div class="card">
      <div class="tr-title">${esc(g(step.title))}</div>
      <p class="tr-hint">${esc(g(step.hint))}</p>
      <div class="mt-3">${inner}</div>
    </div>
    ${state.thoughtStep === 0 ? `<div class="card">
      <p class="note tight">Rozepsaný záznam se ukládá sám. Když to teď nedojde do konce,
      zůstane rozdělané a dá se v něm pokračovat.</p>
    </div>` : ''}`;

  bar.hidden = false;
  $('#thought-prev').textContent = state.thoughtStep === 0 ? 'Zavřít' : 'Zpět';
  $('#thought-next').textContent = state.thoughtStep === TH.STEPS.length - 1 ? 'Uložit' : 'Dál';
}

function shiftHTML(r) {
  const s = TH.shift(r);
  const b = TH.beliefShift(r);
  if (s === null && b === null) return '';
  const cell = (k, from, to, diff) => `
    <div class="cell">
      <div class="k">${esc(k)}</div>
      <div class="v">${from} <span class="arrow">→</span> ${to}
        ${diff !== null && diff !== 0
    ? `<span class="${diff < 0 ? 'down' : 'up'}">${diff < 0 ? '−' : '+'}${Math.abs(diff)}</span>`
    : ''}</div>
    </div>`;
  return `<div class="shift mt-4">
      ${s !== null ? cell('Síla emoce', r.intensityBefore, r.intensityAfter, s) : ''}
      ${b !== null ? cell('Věřím tomu', r.beliefBefore, r.beliefAfter, b) : ''}
    </div>
    <p class="note">Posun bývá malý a to je v pořádku. Cílem není myšlenku vyvrátit,
    ale přestat ji brát jako jediný možný popis toho, co se stalo.</p>`;
}

function renderThoughtDetail(body, r) {
  $('#thought-title').textContent = 'Záznam myšlenky';
  $('#thought-sub').textContent = M.formatLong(r.day);

  const block = (k, v, quote = false) => (v && String(v).trim() ? `
    <div class="tr-block">
      <div class="k">${esc(k)}</div>
      <div class="v${quote ? ' quote' : ''}">${esc(v)}</div>
    </div>` : '');

  body.innerHTML = `
    <div class="card">
      <div class="tr-summary">
        ${block('Situace', r.situation)}
        ${r.emotions.length ? `<div class="tr-block">
          <div class="k">Pocity</div>
          <div class="chips mt-2">${r.emotions.map((id) =>
    `<span class="chip warm on static">${esc(emotionLabel(id))}</span>`).join('')}</div>
        </div>` : ''}
        ${block('Automatická myšlenka', r.thought, true)}
        ${r.distortions.length ? `<div class="tr-block">
          <div class="k">Vzorce</div>
          <div class="chips mt-2">${r.distortions.map((id) => {
    const d = TH.DISTORTIONS.find((x) => x.id === id);
    return `<span class="chip on static">${esc(d ? d.label : id)}</span>`;
  }).join('')}</div>
        </div>` : ''}
        ${block('Co ji podporuje', r.evidenceFor)}
        ${block('Co jí odporuje', r.evidenceAgainst)}
        ${block('Vyvážená verze', r.alternative, true)}
      </div>
      ${shiftHTML(r)}
    </div>
    <div class="card">
      <div class="btn-row">
        <button class="btn-ghost" data-act="edit-thought">${T.edit}</button>
        <button class="btn-ghost danger" data-act="delete-thought">Smazat</button>
      </div>
      <p class="note">Zapsáno ${esc(M.formatDate(r.day))} v ${M.formatTime(r.createdAt)}</p>
    </div>`;
}

async function persistThought() {
  const r = state.thought;
  if (!r || !TH.isValid(r)) return;
  r.updatedAt = new Date().toISOString();
  try {
    const id = await db.putThought(r);
    if (r.id === undefined) r.id = id;
  } catch (err) {
    console.error('thought:', err);
    toast(T.saveFail);
  }
}

async function newThought() {
  state.thought = TH.makeRecord(M.logicalToday());
  state.thoughtStep = 0;
  state.thoughtMode = 'edit';
  await go('thought');
}

async function openThought(id) {
  const r = await db.getThought(id);
  if (!r) return;
  state.thought = r;
  state.thoughtMode = 'view';
  await go('thought');
}

/* ── VÍCE ────────────────────────────────────────────────────── */

async function renderMore() {
  const total = await db.countDays();
  state.totalDays = total;
  state.persisted = await db.isPersisted();
  const nAssess = await db.countAssessments();
  const nThoughts = await db.countThoughts();
  const due = await dueInstruments();

  // Připomenutí zálohy. Nemá smysl otravovat od prvního dne, ale po dvou
  // týdnech už by ztráta dat mrzela.
  const lastBackup = await db.getMeta('lastBackupAt');
  const daysSince = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
    : null;
  const needsBackup = total >= 14 && (daysSince === null || daysSince >= 30);
  const backupCard = needsBackup ? `
    <div class="card accent">
      <div class="rowbetween">
        <div>
          <b>${T.backupTitle}</b>
          <span class="note tight">${daysSince === null ? T.backupNever : T.backupStale(daysSince)}</span>
        </div>
        <button class="btn-chip" data-act="export">Zálohovat</button>
      </div>
    </div>` : '';

  $('#more-body').innerHTML = backupCard + `
    <div class="card crisis">
      <span class="card-label" style="color:var(--orange)">${T.moreHelp}</span>
      <p class="note tight">${T.moreHelpBody}</p>
      ${crisisLinesHTML()}
    </div>

    <div class="card">
      <span class="card-label">Nástroje</span>
      <div class="list">
        <button data-act="go-instruments">
          <span>Dotazníky<span class="sub">WHO-5 · PHQ-9 · GAD-7</span></span>
          <span class="val ${due.length ? 'warn' : ''}">${due.length ? `${due.length} na řadě` : `${nAssess}`}</span>
        </button>
        <button data-act="go-thoughts">
          <span>Záznam myšlenky<span class="sub">přerámování, osm kroků</span></span>
          <span class="val">${nThoughts}</span>
        </button>
      </div>
    </div>

    <div class="card">
      <span class="card-label">${T.moreData}</span>
      <div class="list">
        <button data-act="export">
          <span>${T.moreExport}<span class="sub">${T.moreExportSub}</span></span>
          <span class="val">↓</span>
        </button>
        <button data-act="import">
          <span>${T.moreImport}<span class="sub">${T.moreImportSub}</span></span>
          <span class="val">↑</span>
        </button>
        <div class="row">
          <span>${T.moreStorage}</span>
          <span class="val ${state.persisted ? 'ok' : 'warn'}">
            ${state.persisted ? T.moreStorageOn : T.moreStorageOff}</span>
        </div>
        <div class="row">
          <span>${T.moreEntries}</span>
          <span class="val big">${total}</span>
        </div>
      </div>
      ${state.persisted ? '' : `<p class="note">${T.moreStorageHint}</p>`}
    </div>

    <div class="card">
      <span class="card-label">${T.moreSettings}</span>
      <div class="list">
        <button class="switch" data-act="toggle-amoled" aria-pressed="${state.amoled}">
          <span class="t">${T.moreAmoled}<span class="sub">${T.moreAmoledSub}</span></span>
          <span class="knob" aria-hidden="true"></span>
        </button>
        <button data-act="onboarding">
          <span>${T.moreOnboarding}<span class="sub">${T.moreOnboardingSub}</span></span>
          <span class="val">›</span>
        </button>
      </div>
      <span class="card-label mt-4">${T.moreAddress}</span>
      <div class="segmented" role="group" aria-label="${T.moreAddress}">
        <button data-address="neutral" aria-pressed="${state.address === 'neutral'}">${T.addressNeutral}</button>
        <button data-address="m" aria-pressed="${state.address === 'm'}">${T.addressM}</button>
        <button data-address="f" aria-pressed="${state.address === 'f'}">${T.addressF}</button>
      </div>
      <p class="note">${T.addressHint}</p>
    </div>

    <div class="card">
      <span class="card-label">${T.moreTags}</span>
      <div class="chips">${active(state.tags).map((t) =>
    `<span class="chip static">${esc(t.label)}<button class="x" data-rmtag="${esc(t.id)}"
           aria-label="${T.remove} ${esc(t.label)}">×</button></span>`).join('')}</div>
      <div class="addrow">
        <input type="text" id="new-tag" placeholder="${T.namePlaceholder}" maxlength="24">
        <button class="btn-chip" data-act="add-tag">${T.addTag}</button>
      </div>
      <p class="note">${T.tagInUse}</p>
    </div>

    <div class="card">
      <span class="card-label">${T.moreMeds}</span>
      ${active(state.meds).length
    ? `<div class="chips">${active(state.meds).map((m) =>
      `<span class="chip static">${esc(m.label)}<button class="x" data-rmmed="${esc(m.id)}"
               aria-label="${T.remove} ${esc(m.label)}">×</button></span>`).join('')}</div>`
    : `<p class="note tight">${T.medsNone}</p>`}
      <div class="addrow">
        <input type="text" id="new-med" placeholder="${T.namePlaceholder}" maxlength="32">
        <button class="btn-chip" data-act="add-med">${T.addMed}</button>
      </div>
    </div>

    <div class="card">
      <span class="card-label">${T.moreAbout}</span>
      <p class="note tight">Soumrak · ${T.moreVersion}<br>
        Data zůstávají v telefonu. Aplikace nikam nic neposílá.</p>
      <p class="note"><strong>${T.moreDisclaimer}</strong></p>
    </div>`;
}

/* ── ÚVOD ────────────────────────────────────────────────────── */

const ONB = [
  {
    h: 'Soumrak',
    p: [
      'Deník nálady na jeden večer denně. Zápis trvá čtvrt minuty a všechno pod ním je dobrovolné.',
      'Smysl není mít vyplněno. Smysl je vidět po pár týdnech, co se opakuje — a to jde jen z toho, co se zapíše blízko po tom, co se stalo. Vzpomínka po měsíci je nespolehlivá.',
      '<strong>Soumrak není zdravotnický prostředek a nenahrazuje odbornou péči.</strong> Krizové linky jsou trvale ve Více → Když je zle, nezávisle na tom, co ukazují grafy.'
    ]
  },
  {
    h: 'Dvě osy, ne jedna',
    p: [
      'Nálada se měří zvlášť na dvou škálách: jak <strong>příjemný</strong> den byl (−3 až +3) a kolik v něm bylo <strong>energie</strong> (1 až 5).',
      'Jedna osa by sloučila vyčerpanou skleslost s napjatým neklidem. To jsou dva různé stavy a dělá se s nimi něco jiného. Proto je tu i úzkost zvlášť.',
      'Škála má poctivý střed. Nula je platná odpověď, ne vyhýbání — nutit se na plochý den k náklonu na jednu stranu je chyba měření.'
    ]
  },
  {
    h: 'Čemu se aplikace vyhýbá',
    p: [
      '<strong>Žádná série dnů.</strong> Vynechaný den je chybějící údaj, ne selhání. V hlavičce stojí „zapsáno 27 z 30", ne přetržený řetěz.',
      '<strong>Včerejšek se ukáže až po uložení.</strong> Kdyby svítil dřív, fungoval by jako kotva a dnešek by se k němu přitáhl.',
      '<strong>Poznámka má strop 280 znaků.</strong> Otevřené večerní psaní je u deprese známý spouštěč přemílání. Jedna konkrétní věta pomáhá víc než odstavec.',
      '<strong>Žádná statistika, dokud na ni nejsou data.</strong> Průměr ze šesti dní se nezobrazí.'
    ]
  },
  {
    h: 'Dvě praktické věci',
    p: [
      '<strong>Připomenutí neumíme.</strong> Webová aplikace na Androidu nedokáže spolehlivě naplánovat oznámení. Založ si opakovaný budík v hodinách telefonu na čas, kdy chceš zapisovat. Je to neelegantní a spustí se to vždycky.',
      '<strong>Zálohuj jednou za měsíc.</strong> Více → Export do JSON. Prohlížeč není trezor; při nedostatku místa může systém data smazat.'
    ],
    address: true
  }
];

function renderOnboarding() {
  const el = $('#onboarding');
  const step = ONB[state.onbStep];
  const last = state.onbStep === ONB.length - 1;

  el.innerHTML = `
    <div class="steps" aria-hidden="true">${ONB.map((_, i) =>
    `<i data-on="${i === state.onbStep}" data-done="${i < state.onbStep}"></i>`).join('')}</div>
    <div class="onb-body">
      <h2>${step.h}</h2>
      ${step.p.map((p) => `<p>${p}</p>`).join('')}
      ${step.address ? `
        <span class="card-label mt-4">${T.moreAddress}</span>
        <div class="segmented" role="group" aria-label="${T.moreAddress}">
          <button data-address="neutral" aria-pressed="${state.address === 'neutral'}">${T.addressNeutral}</button>
          <button data-address="m" aria-pressed="${state.address === 'm'}">${T.addressM}</button>
          <button data-address="f" aria-pressed="${state.address === 'f'}">${T.addressF}</button>
        </div>
        <p class="note">${T.addressHint}</p>` : ''}
    </div>
    <div class="onb-foot">
      <button class="btn-ghost" data-onb="back" ${state.onbStep === 0 ? 'hidden' : ''}>Zpět</button>
      <button class="btn-save" data-onb="next">${last ? 'Začít' : 'Dál'}</button>
    </div>`;
  el.hidden = false;
}

async function finishOnboarding() {
  await db.setMeta('onboardedAt', new Date().toISOString());
  $('#onboarding').hidden = true;
  $('#app').hidden = false;
  history.replaceState({ screen: 'today' }, '');
  await go('today', false);
}

/* ── export a obnova ─────────────────────────────────────────── */

async function exportJSON() {
  try {
    const payload = {
      app: 'soumrak',
      schemaVersion: M.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      days: await db.allDays(),
      assessments: await db.allAssessments(),
      thoughts: await db.allThoughts(),
      // Popisky štítků a léků patří do zálohy: bez nich by se v obnovené
      // historii místo „Alkohol" ukazovalo holé id.
      tags: state.tags,
      meds: state.meds
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soumrak-${M.dateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await db.setMeta('lastBackupAt', new Date().toISOString());
    toast(T.exportOk);
    renderMore();
  } catch (err) {
    console.error('export:', err);
    toast(T.exportFail);
  }
}

/**
 * Obnova ze zálohy. Zásadně nedestruktivní: doplní jen dny, které v aplikaci
 * chybí. Po ztrátě dat je databáze prázdná a obnoví se všechno; při slučování
 * se nikdy nepřepíše den, který už něco obsahuje.
 */
async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    const parsed = M.parseBackup(data);
    if (!parsed) {
      toast(T.importBadFile);
      return;
    }

    const existing = new Set((await db.allDays()).map((e) => e.day));
    const toAdd = [];
    let kept = 0;
    for (const e of parsed.days) {
      if (existing.has(e.day)) { kept++; continue; }
      toAdd.push(e);
    }
    if (toAdd.length) await db.putDays(toAdd);

    // Dotazníky a záznamy myšlenek se poznají podle času vyplnění, ne podle
    // dne — za jeden den jich může být víc.
    const haveA = new Set((await db.allAssessments()).map((a) => a.instrument + '|' + a.takenAt));
    const newA = parsed.assessments.filter((a) => !haveA.has(a.instrument + '|' + a.takenAt));
    if (newA.length) await db.putAssessments(newA.map(({ id, ...rest }) => rest));

    const haveT = new Set((await db.allThoughts()).map((t) => t.createdAt));
    const newT = parsed.thoughts.filter((t) => !haveT.has(t.createdAt));
    if (newT.length) await db.putThoughts(newT.map(({ id, ...rest }) => rest));

    await mergeNamedLists(data);

    let msg = T.importOk(toAdd.length, kept);
    const extra = [];
    if (newA.length) extra.push(T.importAssessments(newA.length));
    if (newT.length) extra.push(T.importThoughts(newT.length));
    if (extra.length) msg += ' · ' + extra.join(', ');
    toast(msg);

    await renderMore();
  } catch (err) {
    console.error('import:', err);
    toast(T.importFail);
  }
}

/** Doplní z zálohy štítky a léky, které v aplikaci nejsou — jinak by se
    v obnovené historii ukazovala holá id. Existující se nepřepisují. */
async function mergeNamedLists(data) {
  for (const [key, list] of [['tags', state.tags], ['meds', state.meds]]) {
    const incoming = Array.isArray(data[key]) ? data[key] : null;
    if (!incoming) continue;
    let changed = false;
    for (const item of incoming) {
      if (!item || typeof item.id !== 'string' || typeof item.label !== 'string') continue;
      if (list.some((x) => x.id === item.id)) continue;
      list.push({ id: item.id, label: item.label, ...(item.archived ? { archived: true } : {}) });
      changed = true;
    }
    if (changed) await db.setSetting(key, list);
  }
}

/** Odvodí stabilní id z názvu. Popisek jde přejmenovat, id zůstává. */
function slugify(label) {
  const base = label.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // pryč s diakritikou
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return base || 'x';
}

async function addNamed(inputSel, key) {
  const input = $(inputSel);
  const label = (input.value || '').trim();
  if (!label) return;

  const list = key === 'tags' ? state.tags : state.meds;
  const id = slugify(label);

  // Shoda i podle popisku: výchozí štítky mají anglická id („alcohol") s českým
  // popiskem („Alkohol"), takže samotný slug by je minul a vznikl by druhý
  // štítek pro tutéž věc — a statistika by se rozpadla na dvě půlky.
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const existing = list.find((x) => x.id === id || same(x.label, label));

  if (existing) {
    // Stejný název jako archivovaná položka: oživit ji, ne založit dvojče.
    if (!existing.archived) { input.value = ''; return; }
    delete existing.archived;
    existing.label = label;
  } else {
    list.push({ id, label });
  }

  await db.setSetting(key, list);
  input.value = '';
  haptic();
  await renderMore();
}

function pickBackupFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) importJSON(input.files[0]);
  });
  input.click();
}

/* ── ukládání ────────────────────────────────────────────────── */

/** Průběžné uložení. Telefonát uprostřed zápisu nesmí stát celý večer.
    Když se uložit nepovede, musí se to říct — tichá ztráta zápisu je horší
    než hláška. */
async function persist() {
  M.touch(state.entry);
  try {
    await db.putDay(state.entry);
    return true;
  } catch (err) {
    console.error('persist:', err);
    toast(T.saveFail);
    return false;
  }
}

/**
 * Načte záznam a doplní ho na dnešní tvar modelu.
 *
 * Bez toho spadne obrazovka na každém dni zapsaném starší verzí aplikace:
 * záznam z verze 1 nemá pole `emotions` ani `strategies` a souhrn si sáhne
 * na `.length` čehosi, co neexistuje. Migrace úložiště přidá nová úložiště,
 * ale uvnitř uložených objektů nic nemění — dorovnat tvar musí čtenář.
 */
function hydrate(raw) {
  return raw ? (M.normalize(raw) || raw) : null;
}

async function loadDay(key) {
  state.targetDay = key;
  state.entry = hydrate(await db.getDay(key)) || M.makeEntry(key);
  state.yesterday = hydrate(await db.getDay(M.addDays(key, -1)));
}

/* ── směrování ───────────────────────────────────────────────── */

const RENDER = {
  today: renderToday,
  calendar: renderCalendar,
  day: renderDay,
  insights: renderInsights,
  instruments: renderInstruments,
  quiz: renderQuiz,
  thoughts: renderThoughts,
  thought: renderThought,
  more: renderMore
};

/* Podřízené obrazovky nejsou záložky — v liště zůstane zvýrazněná ta,
   ze které se otevřely. */
const TAB_FOR = {
  today: 'today', calendar: 'calendar', day: 'calendar', insights: 'insights',
  more: 'more', instruments: 'more', quiz: 'more', thoughts: 'more', thought: 'more'
};

/** Kam vede tlačítko zpět v hlavičce, když není historie prohlížeče. */
const PARENT = {
  day: 'calendar', instruments: 'more', quiz: 'instruments',
  thoughts: 'more', thought: 'thoughts'
};

async function go(screen, push = true) {
  state.screen = screen;
  for (const el of document.querySelectorAll('.screen')) {
    el.hidden = el.dataset.screen !== screen;
  }
  for (const b of document.querySelectorAll('#tabbar button')) {
    const on = b.dataset.go === TAB_FOR[screen];
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  if (screen === 'calendar' && !state.calMonth) {
    const d = M.keyToDate(M.logicalToday());
    state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
  }
  // Historie prohlížeče drží systémové tlačítko Zpět. Bez toho by na
  // Androidu první stisk zavřel celou aplikaci i z podobrazovky.
  if (push) history.pushState({ screen }, '');
  await RENDER[screen]();
  document.querySelector(`[data-screen="${screen}"] .body`)?.scrollTo(0, 0);
}

/** Zpět: přednostně systémovou historií, jinak na nadřazenou obrazovku. */
function goBack() {
  if (history.state && history.state.screen && history.length > 1) {
    history.back();
    return;
  }
  go(PARENT[state.screen] || 'today');
}

/* ── události ────────────────────────────────────────────────── */

function wire() {
  $('#tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-go]');
    if (!b) return;
    haptic(6);
    go(b.dataset.go);
  });

  for (const b of document.querySelectorAll('[data-back]')) {
    b.addEventListener('click', () => { haptic(6); goBack(); });
  }

  window.addEventListener('popstate', (e) => {
    const screen = (e.state && e.state.screen) || 'today';
    go(screen, false);
  });

  /* ── obrazovka Dnes ──────────────────────────────────────── */
  $('#screen-today').addEventListener('click', async (e) => {
    const moodBtn = e.target.closest('.mood');
    if (moodBtn) {
      state.entry.mood = Number(moodBtn.dataset.m);
      haptic();
      await persist();
      renderTodayForm($('#today-body'));
      return;
    }
    // Opakovaný tap na tutéž hodnotu ji zruší — omyl se opraví bez rušení.
    const scaleBtn = e.target.closest('.scale5 button');
    if (scaleBtn) {
      const field = scaleBtn.closest('.scale5').dataset.scale;
      const v = Number(scaleBtn.dataset.v);
      if (field === 'sleepQuality') {
        state.entry.sleep.quality = state.entry.sleep.quality === v ? null : v;
      } else {
        state.entry[field] = state.entry[field] === v ? null : v;
      }
      haptic();
      await persist();
      renderTodayForm($('#today-body'));
      return;
    }

    const tagBtn = e.target.closest('[data-tag]');
    if (tagBtn) {
      const id = tagBtn.dataset.tag;
      const i = state.entry.tags.indexOf(id);
      if (i >= 0) {
        state.entry.tags.splice(i, 1);
        // odznačený štítek nemůže dál platit jako „pomohlo"
        state.entry.helped = state.entry.helped.filter((t) => t !== id);
      } else {
        state.entry.tags.push(id);
      }
      haptic();
      await persist();
      renderTodayForm($('#today-body'));
      return;
    }

    const toggleList = [
      ['data-helped', 'helped'], ['data-emotion', 'emotions'], ['data-strategy', 'strategies']
    ];
    for (const [attr, field] of toggleList) {
      const btn = e.target.closest(`[${attr}]`);
      if (!btn) continue;
      const id = btn.getAttribute(attr);
      const arr = state.entry[field];
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
      haptic();
      await persist();
      renderTodayForm($('#today-body'));
      return;
    }

    const medBtn = e.target.closest('[data-med]');
    if (medBtn) {
      const id = medBtn.dataset.med;
      const list = state.entry.meds || [];
      const cur = list.find((m) => m.id === id);
      if (cur) cur.taken = !cur.taken;
      else list.push({ id, taken: true });
      state.entry.meds = list;
      haptic();
      await persist();
      renderTodayForm($('#today-body'));
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;

    switch (act.dataset.act) {
      case 'edit':
        state.editing = true;
        await renderToday();
        break;
      case 'backfill':
        await loadDay(act.dataset.day);
        state.editing = true;
        await renderToday();
        break;
      case 'target-today':
        await loadDay(M.logicalToday());
        state.editing = false;
        await renderToday();
        break;
      case 'toggle-more':
        state.showTier2 = !state.showTier2;
        renderTodayForm($('#today-body'));
        break;
      case 'toggle-emotions':
        state.showEmotions = !state.showEmotions;
        renderTodayForm($('#today-body'));
        break;
      case 'start-quiz':
        await startQuiz(act.dataset.instrument);
        break;
      case 'new-thought':
        await newThought();
        break;
      case 'sleep-up':
      case 'sleep-down': {
        const cur = M.has(state.entry.sleep.hours) ? state.entry.sleep.hours : 7;
        const next = act.dataset.act === 'sleep-up' ? cur + M.SLEEP_STEP : cur - M.SLEEP_STEP;
        // první tap nastaví 7 h jako rozumný výchozí bod, ne 0
        state.entry.sleep.hours = M.has(state.entry.sleep.hours) ? M.clampSleep(next) : 7;
        haptic();
        await persist();
        renderTodayForm($('#today-body'));
        break;
      }
      case 'sleep-clear':
        state.entry.sleep.hours = null;
        haptic();
        await persist();
        renderTodayForm($('#today-body'));
        break;
    }
  });

  // Poznámka se ukládá se zpožděním — psaní nesmí spustit zápis na každé písmeno.
  let noteTimer = null;
  $('#screen-today').addEventListener('input', (e) => {
    if (e.target.id !== 'note') return;
    const val = e.target.value.slice(0, M.NOTE_MAX);
    state.entry.note = val;
    const c = $('#note-count');
    if (c) c.textContent = T.noteCounter(val.length, M.NOTE_MAX);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(persist, 500);
  });

  $('#btn-save').addEventListener('click', async () => {
    if (!M.isValid(state.entry)) return;
    haptic(14);
    await persist();
    state.editing = false;
    // Doplňoval-li se jiný den, vrátíme se na dnešek.
    if (state.targetDay !== M.logicalToday()) await loadDay(M.logicalToday());
    await renderToday();
    toast(T.saved);
  });

  /* ── kalendář ────────────────────────────────────────────── */
  $('#calendar-body').addEventListener('click', (e) => {
    const cell = e.target.closest('.cal[data-day]');
    if (!cell) return;
    haptic(6);
    openDay(cell.dataset.day);
  });

  $('#cal-prev').addEventListener('click', () => {
    const { y, m } = state.calMonth;
    state.calMonth = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    haptic(6);
    renderCalendar();
  });
  $('#cal-next').addEventListener('click', () => {
    const { y, m } = state.calMonth;
    state.calMonth = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
    haptic(6);
    renderCalendar();
  });

  /* ── detail dne ──────────────────────────────────────────── */
  $('#screen-day').addEventListener('click', async (e) => {
    const openTh = e.target.closest('[data-open-thought]');
    if (openTh) {
      haptic(6);
      await openThought(Number(openTh.dataset.openThought));
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const key = state.dayViewKey;

    switch (act.dataset.act) {
      case 'edit-day':
      case 'log-this-day':
        haptic();
        await loadDay(key);
        state.editing = true;
        state.showTier2 = false;
        await go('today');
        break;
      case 'delete-day': {
        if (!confirm(T.deleteConfirm)) return;
        await db.deleteDay(key);
        haptic(14);
        toast(T.deleted);
        // Smazaný den nesmí zůstat načtený ve formuláři.
        if (state.targetDay === key) await loadDay(state.targetDay);
        await go('calendar');
        break;
      }
    }
  });

  /* ── přehled ─────────────────────────────────────────────── */
  $('#screen-insights').addEventListener('click', async (e) => {
    const rangeBtn = e.target.closest('[data-range]');
    if (rangeBtn) {
      state.range = Number(rangeBtn.dataset.range);
      state.readout = null;          // vybraný bod z jiného období nedává smysl
      haptic(6);
      await renderInsights();
      return;
    }

    const hit = e.target.closest('.hit');
    if (hit) {
      const i = Number(hit.dataset.i);
      state.readout = state.readout === i ? null : i;   // druhé ťuknutí zruší výběr
      haptic();
      await renderInsights();
      return;
    }

    const tbl = e.target.closest('[data-table]');
    if (tbl) {
      const id = tbl.dataset.table;
      state.tables[id] = !state.tables[id];
      haptic(6);
      await renderInsights();
    }
  });

  /* ── dotazníky ───────────────────────────────────────────── */
  $('#screen-instruments').addEventListener('click', async (e) => {
    const start = e.target.closest('[data-act="start-quiz"]');
    if (start) { await startQuiz(start.dataset.instrument); return; }

    const view = e.target.closest('[data-instrument-view]');
    if (view) {
      const id = view.dataset.instrumentView;
      state.instrumentView = state.instrumentView === id ? null : id;
      haptic(6);
      await renderInstruments();
    }
  });

  $('#screen-quiz').addEventListener('click', async (e) => {
    const opt = e.target.closest('[data-opt]');
    if (opt) { await answerQuiz(Number(opt.dataset.opt)); return; }

    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'quiz-done') {
      state.quiz = null;
      state.instrumentView = null;
      await go('instruments');
    }
  });

  $('#quiz-next').addEventListener('click', async () => {
    const q = state.quiz;
    if (!q) return;
    const def = INS.INSTRUMENTS[q.instrument];
    if (q.index < def.items.length - 1) {
      q.index += 1;
      haptic(6);
      renderQuiz();
      await saveQuizDraft();
      return;
    }
    await finishQuiz();
  });

  /* ── záznam myšlenky ─────────────────────────────────────── */
  $('#screen-thoughts').addEventListener('click', async (e) => {
    const open = e.target.closest('[data-open-thought]');
    if (open) { haptic(6); await openThought(Number(open.dataset.openThought)); return; }
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'new-thought') await newThought();
  });

  $('#screen-thought').addEventListener('click', async (e) => {
    const r = state.thought;

    for (const [attr, field] of [['data-tr-emotion', 'emotions'], ['data-tr-distortion', 'distortions']]) {
      const btn = e.target.closest(`[${attr}]`);
      if (!btn) continue;
      const id = btn.getAttribute(attr);
      const i = r[field].indexOf(id);
      if (i >= 0) r[field].splice(i, 1); else r[field].push(id);
      haptic();
      await persistThought();
      renderThought();
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'edit-thought':
        state.thoughtMode = 'edit';
        state.thoughtStep = 0;
        renderThought();
        break;
      case 'delete-thought':
        if (!confirm('Smazat tento záznam myšlenky?')) return;
        if (r.id !== undefined) await db.deleteThought(r.id);
        state.thought = null;
        haptic(14);
        toast('Záznam smazán');
        await go('thoughts');
        break;
    }
  });

  let trTimer = null;
  $('#screen-thought').addEventListener('input', (e) => {
    const r = state.thought;
    if (!r) return;

    const field = e.target.getAttribute('data-tr-field');
    if (field) {
      r[field] = e.target.value;
      clearTimeout(trTimer);
      trTimer = setTimeout(persistThought, 500);
      return;
    }

    const rangeField = e.target.getAttribute('data-range-field');
    if (rangeField) {
      const v = Number(e.target.value);
      r[rangeField] = v;
      const out = document.querySelector(`[data-range-val="${rangeField}"]`);
      if (out) out.textContent = v;
      // Přepočítat jen přehled posunu, ne celý krok — překreslení formuláře
      // by pod prstem zrušilo tažení posuvníku.
      const shiftBox = document.getElementById('tr-shift');
      if (shiftBox) shiftBox.innerHTML = shiftHTML(r);
      clearTimeout(trTimer);
      trTimer = setTimeout(persistThought, 400);
    }
  });

  $('#thought-prev').addEventListener('click', async () => {
    haptic(6);
    if (state.thoughtStep === 0) {
      await persistThought();
      // Prázdný rozepsaný záznam se neukládá, aby v historii nezůstávaly slupky.
      goBack();
      return;
    }
    state.thoughtStep -= 1;
    renderThought();
  });

  $('#thought-next').addEventListener('click', async () => {
    haptic(6);
    await persistThought();
    if (state.thoughtStep < TH.STEPS.length - 1) {
      state.thoughtStep += 1;
      renderThought();
      return;
    }
    if (!TH.isValid(state.thought)) {
      toast('Zatím není co uložit — chybí situace i myšlenka.');
      return;
    }
    state.thoughtMode = 'view';
    haptic(14);
    toast('Záznam uložen');
    renderThought();
  });

  /* ── více ────────────────────────────────────────────────── */
  $('#screen-more').addEventListener('click', async (e) => {
    // Odebrání = archivace. Kdyby se položka smazala, starší zápisy by místo
    // „Alkohol" ukazovaly holé id `alcohol`. Popisek musí historii přežít.
    const rmTag = e.target.closest('[data-rmtag]');
    if (rmTag) {
      const t = state.tags.find((x) => x.id === rmTag.dataset.rmtag);
      if (t) t.archived = true;
      await db.setSetting('tags', state.tags);
      haptic();
      await renderMore();
      return;
    }
    const rmMed = e.target.closest('[data-rmmed]');
    if (rmMed) {
      const m = state.meds.find((x) => x.id === rmMed.dataset.rmmed);
      if (m) m.archived = true;
      await db.setSetting('meds', state.meds);
      haptic();
      await renderMore();
      return;
    }

    const addr = e.target.closest('[data-address]');
    if (addr) {
      state.address = addr.dataset.address;
      await db.setSetting('address', state.address);
      haptic(6);
      await renderMore();
      return;
    }

    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'export': exportJSON(); break;
      case 'import': pickBackupFile(); break;
      case 'add-tag': await addNamed('#new-tag', 'tags'); break;
      case 'add-med': await addNamed('#new-med', 'meds'); break;
      case 'go-instruments': state.instrumentView = null; await go('instruments'); break;
      case 'go-thoughts': await go('thoughts'); break;
      case 'toggle-amoled':
        state.amoled = !state.amoled;
        applyAmoled();
        await db.setSetting('amoled', state.amoled);
        haptic(6);
        await renderMore();
        break;
      case 'onboarding':
        state.onbStep = 0;
        $('#app').hidden = true;
        renderOnboarding();
        break;
    }
  });

  /* ── úvod ────────────────────────────────────────────────── */
  $('#onboarding').addEventListener('click', async (e) => {
    const addr = e.target.closest('[data-address]');
    if (addr) {
      state.address = addr.dataset.address;
      await db.setSetting('address', state.address);
      haptic(6);
      renderOnboarding();
      return;
    }
    const b = e.target.closest('[data-onb]');
    if (!b) return;
    haptic(6);
    if (b.dataset.onb === 'back') {
      state.onbStep = Math.max(0, state.onbStep - 1);
      renderOnboarding();
      return;
    }
    if (state.onbStep < ONB.length - 1) {
      state.onbStep += 1;
      renderOnboarding();
      return;
    }
    await finishOnboarding();
  });

  // Návrat po delší době: den se mohl přehoupnout, formulář musí patřit
  // ke správnému datu.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const today = M.logicalToday();
    if (state.targetDay !== today && !state.editing) {
      await loadDay(today);
      if (state.screen === 'today') await renderToday();
    }
  });
}

function applyAmoled() {
  document.documentElement.dataset.amoled = state.amoled ? 'true' : '';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.amoled ? '#000000' : '#282A36');
}

/* ── start ───────────────────────────────────────────────────── */

async function main() {
  try {
    await loadDay(M.logicalToday());
  } catch (err) {
    document.getElementById('boot').innerHTML =
      `<p style="padding:2rem;text-align:center;color:#FF7B7B;font-size:.9375rem;line-height:1.6">
         Úložiště není dostupné.<br><br>
         Aplikace musí běžet z adresy http(s), ne ze souboru.<br>
         Viz README.
       </p>`;
    console.error(err);
    return;
  }

  await db.requestPersistence();

  const savedTags = await db.getSetting('tags', null);
  state.tags = Array.isArray(savedTags) ? savedTags : DEFAULT_TAGS.slice();
  const savedMeds = await db.getSetting('meds', null);
  state.meds = Array.isArray(savedMeds) ? savedMeds : [];
  state.address = await db.getSetting('address', 'neutral');
  state.amoled = !!(await db.getSetting('amoled', false));
  applyAmoled();

  wire();
  document.getElementById('boot').remove();

  const onboarded = await db.getMeta('onboardedAt', null);
  if (!onboarded) {
    state.onbStep = 0;
    renderOnboarding();
  } else {
    document.getElementById('app').hidden = false;
    history.replaceState({ screen: 'today' }, '');
    await go('today', false);

    // Zkratka z dlouhého stisku ikony míří rovnou na škálu nálady.
    if (new URLSearchParams(location.search).get('action') === 'quick') {
      if (M.isValid(state.entry)) {
        state.editing = true;
        await renderToday();
      }
      document.getElementById('moodrow')?.scrollIntoView({ block: 'center' });
    }
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW:', e));
  }
}

main();
