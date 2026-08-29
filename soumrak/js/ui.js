/* Obrazovky, směrování a vykreslování. Bez frameworku — je to
   jednouživatelská aplikace a stav se vejde do jednoho objektu. */

import * as db from './db.js';
import * as M from './model.js';
import { mean, rollingMean, segments, seriesFor, distribution, buckets } from './stats.js';
import {
  T, MOOD_ANCHORS, MOOD_PHRASE, ENERGY_ENDS, ANXIETY_ENDS, SLEEPQ_ENDS,
  DEFAULT_TAGS, WEEKDAYS_SHORT, MONTHS_NOM
} from './strings.cs.js';

/* ── stav ────────────────────────────────────────────────────── */

const state = {
  screen: 'today',
  targetDay: M.logicalToday(),   // který den formulář upravuje
  entry: null,                   // záznam pro targetDay
  yesterday: null,
  editing: false,                // vynucený formulář i u platného záznamu
  showTier2: false,              // rozbalená volitelná část zápisu
  calMonth: null,                // {y, m} zobrazený měsíc
  dayView: null,                 // záznam otevřený v detailu dne
  dayViewKey: null,
  tags: [],                      // {id, label}
  meds: [],
  totalDays: 0,
  persisted: false,
  range: 30,                     // 30 | 90 | 365 dní v Přehledu
  readout: null,                 // index bodu vybraného ťuknutím do grafu
  tables: {}                     // které grafy mají rozbalenou tabulku
};

/* ── drobné pomůcky ──────────────────────────────────────────── */

const $ = (sel) => document.querySelector(sel);

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
  toastTimer = setTimeout(() => el.remove(), 2200);
  announce(msg);
}

/* ── graf ────────────────────────────────────────────────────── */

/**
 * Připraví body grafu podle délky období. Rok po dnech je na telefonu kaše
 * (365 bodů na 344 px), proto se od 90 dní výš slučuje po týdnech.
 * Okno klouzavého průměru se posouvá spolu s tím.
 */
function buildSeries(values, keys, range) {
  if (range <= 90) {
    return {
      mode: 'daily',
      marks: values.map((v, i) => ({ value: v, key: keys[i], label: M.formatShort(keys[i]), n: v === null ? 0 : 1 })),
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
  const PL = 16, PR = 6, PT = 8, PB = 15;
  const x = (i) => PL + (n === 1 ? (w - PL - PR) / 2 : (i * (w - PL - PR)) / (n - 1));
  const y = (v) => PT + ((3 - v) * (h - PT - PB)) / 6;

  let s = '';
  for (const g of [3, 0, -3]) {
    s += `<line x1="${PL}" y1="${y(g).toFixed(1)}" x2="${w - PR}" y2="${y(g).toFixed(1)}" `
      +  `stroke="#44475A" stroke-width="1" opacity="${g === 0 ? 0.85 : 0.4}"/>`
      +  `<text x="0" y="${(y(g) + 3.5).toFixed(1)}" fill="#6272A4" font-size="9" `
      +  `font-family="Roboto Mono,monospace">${g > 0 ? '+' + g : g}</text>`;
  }

  const r = series.mode === 'daily' ? (n > 45 ? 1.6 : 2) : 2.6;
  marks.forEach((m, i) => {
    if (m.value === null) return;
    s += `<circle cx="${x(i).toFixed(1)}" cy="${y(m.value).toFixed(1)}" r="${r}" `
      +  `fill="${M.moodColor(Math.round(m.value))}" opacity="0.75"/>`;
  });

  const pts = series.roll.map((v, i) => (v === null ? null : [x(i), y(v)]));
  for (const seg of segments(pts)) {
    if (seg.length < 2) continue;
    s += `<path d="M${seg.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}" `
      +  `fill="none" stroke="#BD93F9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  let last = series.roll.length - 1;
  while (last >= 0 && series.roll[last] === null) last--;
  if (last >= 0) {
    s += `<circle cx="${x(last).toFixed(1)}" cy="${y(series.roll[last]).toFixed(1)}" r="4.5" `
      +  `fill="#BD93F9" stroke="#21222C" stroke-width="2"/>`;
  }

  // zvýraznění vybraného bodu
  if (selected !== null && marks[selected] && marks[selected].value !== null) {
    const cx = x(selected), cy = y(marks[selected].value);
    s += `<line x1="${cx.toFixed(1)}" y1="${PT}" x2="${cx.toFixed(1)}" y2="${h - PB}" `
      +  `stroke="#F8F8F2" stroke-width="1" opacity="0.35"/>`
      +  `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" `
      +  `fill="${M.moodColor(Math.round(marks[selected].value))}" stroke="#21222C" stroke-width="2"/>`;
  }

  s += `<text x="${PL}" y="${h - 2}" fill="#6272A4" font-size="9" `
    +  `font-family="Roboto Mono,monospace">${marks[0].label.split('–')[0]}</text>`
    +  `<text x="${w - PR}" y="${h - 2}" fill="#6272A4" font-size="9" text-anchor="end" `
    +  `font-family="Roboto Mono,monospace">${marks[n - 1].label.split('–').pop()}</text>`;

  // terče na ťuknutí — vždy aspoň 8 px široké, i když je bodů hodně
  const step = n > 1 ? (w - PL - PR) / (n - 1) : w;
  const tw = Math.max(step, 8);
  marks.forEach((m, i) => {
    if (m.value === null) return;
    // fill="none" + pointer-events="all" je jednoznačné napříč prohlížeči;
    // u fill="transparent" závisí zásah na výkladu visiblePainted.
    s += `<rect x="${(x(i) - tw / 2).toFixed(1)}" y="0" width="${tw.toFixed(1)}" height="${h}" `
      +  `fill="none" pointer-events="all" data-i="${i}" class="hit"/>`;
  });

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" data-chart="trend"
      role="img" aria-label="Průběh nálady">${s}</svg>`;
}

/**
 * Rozložení hodnot — vodorovné sloupce, nejlepší nahoře, aby směr
 * odpovídal svislé ose trendu. Počet je vypsaný u každého sloupce,
 * takže barva nikdy nenese hodnotu sama.
 */
function distributionHTML(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return `<p class="note" style="margin-top:0">${T.distributionEmpty}</p>`;
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
    rows += `<tr><td>${M.signed(v, 0)} · ${MOOD_ANCHORS[String(v)]}</td>`
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
        ? `${M.signed(m.value, 0)} · ${MOOD_ANCHORS[String(Math.round(m.value))]}`
        : M.signed(m.value);
    return `<tr><td>${m.label}</td><td class="num">${val}</td></tr>`;
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

/** Malý sedmidenní přehled bez os. */
function sparkline(values, w = 312, h = 54) {
  const n = values.length;
  const P = 6;
  const x = (i) => P + (n === 1 ? (w - 2 * P) / 2 : (i * (w - 2 * P)) / (n - 1));
  const y = (v) => P + ((3 - v) * (h - 2 * P)) / 6;
  let s = `<line x1="${P}" y1="${y(0)}" x2="${w - P}" y2="${y(0)}" stroke="#44475A" stroke-width="1" opacity="0.6"/>`;
  const pts = values.map((v, i) => (v === null ? null : [x(i), y(v)]));
  for (const seg of segments(pts)) {
    if (seg.length < 2) continue;
    s += `<path d="M${seg.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}" `
      +  `fill="none" stroke="#BD93F9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  values.forEach((v, i) => {
    if (v === null) return;
    const lastOne = i === n - 1;
    s += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${lastOne ? 4 : 2.6}" `
      +  `fill="${M.moodColor(v)}" stroke="#21222C" stroke-width="${lastOne ? 2 : 0}"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Posledních sedm dní">${s}</svg>`;
}

/* ── DNES ────────────────────────────────────────────────────── */

function moodRowHTML(selected) {
  let s = '<div class="moodrow" id="moodrow" role="group" aria-label="Nálada">';
  for (let v = -3; v <= 3; v++) {
    const on = selected === v;
    const glyph = M.signed(v, 0);
    s += `<button class="mood" data-m="${v}"${on ? ` data-v="${v}"` : ''} `
      +  `aria-pressed="${on}" aria-label="${glyph} — ${MOOD_ANCHORS[String(v)]}">${glyph}</button>`;
  }
  s += '</div><div class="anchors" aria-hidden="true">';
  for (let v = -3; v <= 3; v++) {
    s += `<span>${MOOD_ANCHORS[String(v)].replace(' ', '<br>')}</span>`;
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
      <span><b>${title}</b><span>${sub}</span></span>
    </div>`;
}

/** Pětistupňová škála. `field` se pak přečte z data atributu při kliknutí. */
function scale5HTML(field, selected, ends, label, tone = '') {
  let s = `<div class="scale5 ${tone}" data-scale="${field}" role="group" aria-label="${label}">`;
  for (let v = 1; v <= 5; v++) {
    s += `<button data-v="${v}" aria-pressed="${selected === v}" `
      +  `aria-label="${label} ${v} z 5">${v}</button>`;
  }
  return s + `</div><div class="scale-ends"><span>${ends[0]}</span><span>${ends[1]}</span></div>`;
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
      <div class="scale-ends">
        <span>${T.sleepHours}</span>
        ${M.has(h) ? `<button class="linkbtn" data-act="sleep-clear">${T.sleepUnknown}</button>` : '<span></span>'}
      </div>
      <div style="margin-top:.875rem">
        <span class="card-label">${T.sleepQuality}</span>
        ${scale5HTML('sleepQuality', entry.sleep.quality, SLEEPQ_ENDS, T.sleepQuality, 'cy')}
      </div>
    </div>`;
}

function tagsHTML(entry, allTags) {
  // Nabízí se aktivní štítky plus ty archivované, které na dnešku už visí —
  // jinak by se odznačit nedaly.
  const tags = allTags.filter((t) => !t.archived || entry.tags.includes(t.id));
  const chips = tags.map((t) =>
    `<button class="chip${entry.tags.includes(t.id) ? ' on' : ''}" data-tag="${t.id}" `
    + `aria-pressed="${entry.tags.includes(t.id)}">${t.label}</button>`).join('');

  // „Co pomohlo" se ukáže, až je co označit — jinak je to prázdná otázka.
  const chosen = tags.filter((t) => entry.tags.includes(t.id));
  const helped = chosen.length ? `
      <div style="margin-top:1rem">
        <span class="card-label">${T.helped}</span>
        <div class="chips">${chosen.map((t) =>
          `<button class="chip alt${entry.helped.includes(t.id) ? ' on' : ''}" data-helped="${t.id}" `
          + `aria-pressed="${entry.helped.includes(t.id)}">${t.label}</button>`).join('')}</div>
        <p class="note">${T.helpedHint}</p>
      </div>` : '';

  return `<div class="card">
      <span class="card-label">${T.tags}</span>
      <div class="chips">${chips}</div>
      ${helped}
    </div>`;
}

function medsHTML(entry, allMeds) {
  const meds = allMeds.filter((m) => !m.archived);
  if (!meds.length) return '';
  const taken = new Map((entry.meds || []).map((m) => [m.id, m.taken]));
  return `<div class="card">
      <span class="card-label">${T.meds}</span>
      <div class="chips">${meds.map((m) =>
        `<button class="chip${taken.get(m.id) ? ' on' : ''}" data-med="${m.id}" `
        + `aria-pressed="${!!taken.get(m.id)}">${m.label}</button>`).join('')}</div>
    </div>`;
}

function noteHTML(entry) {
  const n = entry.note || '';
  return `<div class="card">
      <span class="card-label">${T.note} · ${T.noteOptional}</span>
      <textarea id="note" maxlength="${M.NOTE_MAX}" rows="3"
        placeholder="${T.notePlaceholder}">${n.replace(/</g, '&lt;')}</textarea>
      <div class="scale-ends">
        <span>${T.noteWhyCapped}</span>
        <span id="note-count">${T.noteCounter(n.length, M.NOTE_MAX)}</span>
      </div>
    </div>`;
}

function renderTodayForm(body) {
  const e = state.entry;
  const isToday = state.targetDay === M.logicalToday();

  let s = '';

  // Zapisuje se jiný den, než jaký ukazuje kalendář na zdi — musí to být vidět.
  if (!isToday) {
    s += `<div class="card accent"><div class="rowbetween">
        <div><b style="font-size:.9375rem">${T.dateOverride}</b>
          <span class="sub" style="display:block;font-family:var(--mono);font-size:.75rem;color:var(--muted)">
            ${M.formatLong(state.targetDay)}</span></div>
        <button class="btn-ghost" data-act="target-today">Zpět na dnešek</button>
      </div></div>`;
  }

  s += `<div class="card">
      <div class="q">${T.question}</div>
      ${moodRowHTML(e.mood)}
      ${quadrantHTML(e)}
    </div>
    <div class="card">
      <span class="card-label">${T.energy}</span>
      ${scale5HTML('energy', e.energy, ENERGY_ENDS, T.energy)}
    </div>
    <div class="card">
      <span class="card-label">${T.anxiety}</span>
      ${scale5HTML('anxiety', e.anxiety, ANXIETY_ENDS, T.anxiety, 'pk')}
    </div>
    ${sleepHTML(e)}
    ${tagsHTML(e, state.tags)}`;

  // Vrstva 2 je schovaná: většina večerů skončí výš a nemá se prokousávat
  // poli, která nevyplní.
  s += `<button class="disclosure" data-act="toggle-more" aria-expanded="${state.showTier2}">
      ${state.showTier2 ? T.addLess : T.addMore}
    </button>`;
  if (state.showTier2) {
    s += medsHTML(e, state.meds) + noteHTML(e);
  }
  s += '<div style="height:.25rem;flex:0 0 auto"></div>';

  body.innerHTML = s;
  body.classList.add('has-savebar');

  const bar = $('#today-savebar');
  bar.hidden = false;
  const btn = $('#btn-save');
  btn.disabled = !M.isValid(e);
  btn.textContent = M.isValid(e) ? T.save : T.saveHint;
}

function renderTodaySummary(body) {
  const e = state.entry;
  const y = state.yesterday;

  let s = `<div class="card">
      <div class="summary-head">
        <span class="moodbadge" style="background:${M.moodColor(e.mood)}">${M.signed(e.mood, 0)}</span>
        <span class="t">
          <b>${MOOD_PHRASE[String(e.mood)]}</b>
          <span>${e.retrospective ? T.retroBadge + ' · ' : ''}${M.formatTime(e.updatedAt)}</span>
        </span>
        <button class="btn-ghost" data-act="edit">${T.edit}</button>
      </div>
      <div class="cells">
        <div class="cell"><div class="k">${T.energy}</div><div class="v">${M.has(e.energy) ? e.energy + ' / 5' : '—'}</div></div>
        <div class="cell"><div class="k">${T.anxiety}</div><div class="v">${M.has(e.anxiety) ? e.anxiety + ' / 5' : '—'}</div></div>
        <div class="cell"><div class="k">${T.sleep}</div><div class="v">${M.formatHours(e.sleep.hours)}</div></div>
      </div>
      ${e.tags.length ? `<div class="chips" style="margin-top:.75rem">${
        labelsFor(e.tags, state.tags).map((l) => `<span class="chip on static">${l}</span>`).join('')
      }</div>` : ''}
    </div>`;

  // Včerejšek se ukazuje až tady. Před hodnocením by fungoval jako kotva.
  if (y && M.isValid(y)) {
    s += `<div class="card">
        <span class="card-label">${T.yesterday}</span>
        <div class="summary-head" style="margin-bottom:0">
          <span class="moodbadge sm" style="background:${M.moodColor(y.mood)}">${M.signed(y.mood, 0)}</span>
          <span class="t"><b style="font-size:.875rem">${MOOD_PHRASE[String(y.mood)]}</b></span>
        </div>
        <p class="note">${T.yesterdayNote}</p>
      </div>`;
  } else if (state.targetDay === M.logicalToday()) {
    const yKey = M.addDays(state.targetDay, -1);
    s += `<div class="card accent"><div class="rowbetween">
        <div><b style="font-size:.9375rem">${T.backfillTitle}</b>
          <span style="display:block;font-family:var(--mono);font-size:.75rem;color:var(--muted)">
            ${M.formatLong(yKey)}</span></div>
        <button class="btn-chip" data-act="backfill" data-day="${yKey}">${T.backfillCta}</button>
      </div></div>`;
  }

  s += `<div class="card">
      <span class="card-label">${T.last7}</span>
      <div id="spark-slot"></div>
    </div>`;

  body.innerHTML = s;
  body.classList.remove('has-savebar');
  $('#today-savebar').hidden = true;
}

async function renderToday() {
  const body = $('#today-body');
  const today = M.logicalToday();

  $('#today-title').textContent = state.targetDay === today ? T.today : T.backfillHeading;
  $('#today-date').textContent = M.formatLong(state.targetDay);

  const showForm = !M.isValid(state.entry) || state.editing;
  if (showForm) renderTodayForm(body);
  else renderTodaySummary(body);

  // počítadlo za posledních 30 dní
  const from = M.addDays(today, -29);
  const rows = await db.daysBetween(from, today);
  const logged = rows.filter(M.isValid).length;
  $('#today-count').textContent = T.countOf(logged, 30);

  if (!showForm) {
    const week = seriesFor(rows, M.addDays(today, -6), 7, M.addDays);
    const slot = $('#spark-slot');
    if (slot) slot.innerHTML = sparkline(week.values);
  }
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
      cells += `<div class="cal future" data-day="${key}">${d}</div>`;
    } else if (!e || !M.isValid(e)) {
      cells += `<button class="cal none" data-day="${key}" `
        + `aria-label="${M.formatLong(key)} — ${T.notLogged}">${d}</button>`;
    } else {
      const cls = 'cal' + (e.retrospective ? ' retro' : '') + (key === today ? ' today' : '');
      cells += `<button class="${cls}" data-day="${key}" style="background:${M.moodColor(e.mood)}" `
        + `aria-label="${M.formatLong(key)} — ${MOOD_PHRASE[String(e.mood)]}">${d}</button>`;
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

function labelsFor(ids, list) {
  return ids.map((id) => {
    const found = list.find((x) => x.id === id);
    return found ? found.label : id;   // smazaný štítek zůstává v historii pod id
  });
}

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
    $('#day-body').innerHTML = `<div class="card"><div class="empty-state">
        <span class="ico">🌑</span><b>${T.notLogged}</b>
        <p>${future ? T.futureDay : tooOld ? T.tooOldToBackfill(M.BACKFILL_LIMIT) : ''}</p>
      </div>${(future || tooOld) ? '' : `
      <button class="btn-save" data-act="log-this-day">${T.logThisDay}</button>`}
    </div>`;
    return;
  }

  const rows = [];
  if (M.has(e.energy)) rows.push([T.energy, `${e.energy} / 5`]);
  if (M.has(e.anxiety)) rows.push([T.anxiety, `${e.anxiety} / 5`]);
  if (M.has(e.sleep.hours)) rows.push([T.sleepHours, M.formatHours(e.sleep.hours)]);
  if (M.has(e.sleep.quality)) rows.push([T.sleepQuality, `${e.sleep.quality} / 5`]);

  const q = M.quadrantLabel(e.mood, e.energy);
  const tagLabels = labelsFor(e.tags, state.tags);
  const helpedLabels = labelsFor(e.helped, state.tags);
  const takenMeds = (e.meds || []).filter((m) => m.taken);

  $('#day-body').innerHTML = `
    <div class="card">
      <div class="summary-head">
        <span class="moodbadge" style="background:${M.moodColor(e.mood)}">${M.signed(e.mood, 0)}</span>
        <span class="t">
          <b>${MOOD_PHRASE[String(e.mood)]}</b>
          <span>${q ? q[0] : ''}${e.retrospective ? ' · ' + T.retroBadge : ''}</span>
        </span>
        <button class="btn-ghost" data-act="edit-day">${T.edit}</button>
      </div>
      ${rows.length ? `<div class="kv">${rows.map(([k, v]) =>
        `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>` : ''}
    </div>

    ${tagLabels.length ? `<div class="card">
      <span class="card-label">${T.tags}</span>
      <div class="chips">${tagLabels.map((l) => `<span class="chip on static">${l}</span>`).join('')}</div>
      ${helpedLabels.length ? `<div style="margin-top:.75rem">
        <span class="card-label">${T.helped}</span>
        <div class="chips">${helpedLabels.map((l) =>
          `<span class="chip alt on static">${l}</span>`).join('')}</div></div>` : ''}
    </div>` : ''}

    ${takenMeds.length ? `<div class="card">
      <span class="card-label">${T.meds}</span>
      <div class="chips">${labelsFor(takenMeds.map((m) => m.id), state.meds)
        .map((l) => `<span class="chip on static">${l} · ${T.medsTaken}</span>`).join('')}</div>
    </div>` : ''}

    ${e.note ? `<div class="card">
      <span class="card-label">${T.note}</span>
      <p style="font-size:.9375rem;line-height:1.55">${e.note.replace(/</g, '&lt;')}</p>
    </div>` : ''}

    <div class="card">
      <p class="note" style="margin-top:0">
        Zapsáno ${M.formatTime(e.createdAt)}${e.updatedAt !== e.createdAt
          ? ` · upraveno ${M.formatTime(e.updatedAt)}` : ''}
      </p>
      <button class="btn-ghost danger" data-act="delete-day" style="width:100%;margin-top:.5rem">
        ${T.deleteDay}
      </button>
    </div>`;
}

async function openDay(key) {
  state.dayViewKey = key;
  state.dayView = (await db.getDay(key)) || null;
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
       <b>${chosen.label}</b>
       <span>${series.mode === 'daily'
          ? `${M.signed(chosen.value, 0)} · ${MOOD_ANCHORS[String(Math.round(chosen.value))]}`
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
      <div style="margin-top:.75rem">${trendChart(series, 344, 112, sel)}</div>
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

    <div class="card"><p class="note" style="margin-top:0">${T.insightsLater}</p></div>`;

  body.innerHTML = s;
}

/* ── VÍCE ────────────────────────────────────────────────────── */

async function renderMore() {
  const total = await db.countDays();
  state.totalDays = total;
  state.persisted = await db.isPersisted();

  const crisis = T.crisis.map(([name, num, sub]) =>
    `<a class="line" href="tel:${num.replace(/\s/g, '')}">
       <span>${name}<span class="sub">${sub}</span></span><span>${num}</span></a>`).join('');

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
        <div style="min-width:0">
          <b style="font-size:.9375rem">${T.backupTitle}</b>
          <span style="display:block;font-size:.75rem;color:var(--muted);line-height:1.4;margin-top:.125rem">
            ${daysSince === null ? T.backupNever : T.backupStale(daysSince)}</span>
        </div>
        <button class="btn-chip" data-act="export">↓</button>
      </div>
    </div>` : '';

  $('#more-body').innerHTML = backupCard + `
    <div class="card crisis">
      <span class="card-label" style="color:var(--orange)">${T.moreHelp}</span>
      <p class="note" style="margin-top:0;margin-bottom:.25rem">${T.moreHelpBody}</p>
      ${crisis}
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
        <div style="display:flex;align-items:center;justify-content:space-between;
                    gap:.75rem;min-height:3.25rem;padding:.625rem 0;border-bottom:1px solid #2E3040">
          <span>${T.moreStorage}</span>
          <span class="val ${state.persisted ? 'ok' : 'warn'}">
            ${state.persisted ? T.moreStorageOn : T.moreStorageOff}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;
                    gap:.75rem;min-height:3.25rem;padding:.625rem 0">
          <span>${T.moreEntries}</span>
          <span class="val">${total}</span>
        </div>
      </div>
      ${state.persisted ? '' : `<p class="note">${T.moreStorageHint}</p>`}
    </div>

    <div class="card">
      <span class="card-label">${T.moreTags}</span>
      <div class="chips">${active(state.tags).map((t) =>
        `<span class="chip static">${t.label}<button class="x" data-rmtag="${t.id}"
           aria-label="${T.remove} ${t.label}">×</button></span>`).join('')}</div>
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
            `<span class="chip static">${m.label}<button class="x" data-rmmed="${m.id}"
               aria-label="${T.remove} ${m.label}">×</button></span>`).join('')}</div>`
        : `<p class="note" style="margin-top:0">${T.medsNone}</p>`}
      <div class="addrow">
        <input type="text" id="new-med" placeholder="${T.namePlaceholder}" maxlength="32">
        <button class="btn-chip" data-act="add-med">${T.addMed}</button>
      </div>
    </div>

    <div class="card">
      <span class="card-label">${T.moreAbout}</span>
      <p class="note" style="margin-top:0">Soumrak · ${T.moreVersion}<br>
        Data zůstávají v telefonu. Aplikace nikam nic neposílá.</p>
      <p class="note"><strong>${T.moreDisclaimer}</strong></p>
    </div>`;
}

/* ── export ──────────────────────────────────────────────────── */

async function exportJSON() {
  try {
    const days = await db.allDays();
    const payload = {
      app: 'soumrak',
      schemaVersion: M.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      days
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
  } catch {
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
    const days = M.parseBackup(JSON.parse(await file.text()));
    if (!days) {
      toast(T.importBadFile);
      return;
    }

    const existing = new Set((await db.allDays()).map((e) => e.day));
    const toAdd = [];
    let kept = 0;
    for (const e of days) {
      if (existing.has(e.day)) { kept++; continue; }
      toAdd.push(e);
    }

    if (toAdd.length) await db.putDays(toAdd);
    toast(T.importOk(toAdd.length, kept));
    await renderMore();
  } catch (err) {
    console.error('import:', err);
    toast(T.importFail);
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

/** Položky nabízené k výběru — archivované zůstávají jen pro čtení historie. */
const active = (list) => list.filter((x) => !x.archived);

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

async function loadDay(key) {
  state.targetDay = key;
  state.entry = (await db.getDay(key)) || M.makeEntry(key);
  state.yesterday = (await db.getDay(M.addDays(key, -1))) || null;
}

/* ── směrování ───────────────────────────────────────────────── */

const RENDER = {
  today: renderToday,
  calendar: renderCalendar,
  day: renderDay,
  insights: renderInsights,
  more: renderMore
};

/* Detail dne není záložka — v liště zůstane zvýrazněný kalendář, ze kterého se otevřel. */
const TAB_FOR = { today: 'today', calendar: 'calendar', day: 'calendar', insights: 'insights', more: 'more' };

async function go(screen) {
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
  await RENDER[screen]();
  document.querySelector(`[data-screen="${screen}"] .body`)?.scrollTo(0, 0);
}

/* ── události ────────────────────────────────────────────────── */

function wire() {
  $('#tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-go]');
    if (!b) return;
    haptic(6);
    go(b.dataset.go);
  });

  // Formulář i souhrn se překreslují, proto delegace na celé obrazovce.
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

    const helpedBtn = e.target.closest('[data-helped]');
    if (helpedBtn) {
      const id = helpedBtn.dataset.helped;
      const i = state.entry.helped.indexOf(id);
      if (i >= 0) state.entry.helped.splice(i, 1);
      else state.entry.helped.push(id);
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

  $('#calendar-body').addEventListener('click', (e) => {
    const cell = e.target.closest('.cal[data-day]');
    if (!cell || cell.classList.contains('future')) return;
    haptic(6);
    openDay(cell.dataset.day);
  });

  $('#day-back').addEventListener('click', () => { haptic(6); go('calendar'); });

  $('#screen-day').addEventListener('click', async (e) => {
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

    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'export': exportJSON(); break;
      case 'import': pickBackupFile(); break;
      case 'add-tag': await addNamed('#new-tag', 'tags'); break;
      case 'add-med': await addNamed('#new-med', 'meds'); break;
    }
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

/* ── start ───────────────────────────────────────────────────── */

async function main() {
  try {
    await loadDay(M.logicalToday());
  } catch (err) {
    document.getElementById('boot').innerHTML =
      `<p style="padding:2rem;text-align:center;color:#FF5555;font-size:.875rem">
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

  wire();
  document.getElementById('app').hidden = false;
  document.getElementById('boot').remove();

  const params = new URLSearchParams(location.search);
  await go(params.get('action') === 'quick' ? 'today' : 'today');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW:', e));
  }
}

main();
