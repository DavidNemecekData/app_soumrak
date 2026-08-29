/* Statistika — fáze 1 potřebuje jen průměr a klouzavý průměr.
   Pravidlo, které platí ve všech fázích: nic se nespočítá z prázdna a nic
   se nedopočítává přes mezeru. Chybějící den je null, ne nula. */

/** Průměr z hodnot, které nejsou null. Vrací null, když není z čeho. */
export function mean(values) {
  const v = values.filter((x) => x !== null && x !== undefined);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/**
 * Klouzavý průměr se středem v každém bodě.
 * `minN` je zásadní: když v okně chybí příliš mnoho dní, vrátí se null
 * a čára se přeruší. Bez toho by se přes týdenní výpadek natáhla úsečka,
 * která tvrdí něco, co nikdo nezapsal.
 */
export function rollingMean(values, window = 7, minN = 4) {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length - 1, i + half);
    let sum = 0, n = 0;
    for (let j = lo; j <= hi; j++) {
      const v = values[j];
      if (v !== null && v !== undefined) { sum += v; n++; }
    }
    return n >= minN ? sum / n : null;
  });
}

/** Rozdělí řadu na souvislé úseky bez null — pro kreslení přerušované čáry. */
export function segments(points) {
  const out = [];
  let cur = [];
  for (const p of points) {
    if (p === null || p === undefined) {
      if (cur.length) out.push(cur);
      cur = [];
    } else {
      cur.push(p);
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Počty jednotlivých stupňů škály, index 0 = −3 … index 6 = +3.
 * Ukáže, kam se hodnocení posouvá — soustavný příklon k jednomu konci
 * škály je sám o sobě informace.
 */
export function distribution(values) {
  const counts = new Array(7).fill(0);
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const i = Math.round(v) + 3;
    if (i >= 0 && i <= 6) counts[i]++;
  }
  return counts;
}

/**
 * Sloučí řadu do bloků po `size` dnech a vrátí průměr každého bloku.
 * Rok po dnech je na displeji telefonu kaše — 365 bodů na 344 px. Týdenní
 * průměry se dají přečíst a nic podstatného neztratí.
 *
 * `minN` chrání před tím, aby blok s jediným zápisem vypadal stejně
 * spolehlivě jako plný týden.
 */
export function buckets(values, size, minN = 1) {
  const out = [];
  for (let i = 0; i < values.length; i += size) {
    const slice = values.slice(i, i + size);
    const n = slice.filter((v) => v !== null && v !== undefined).length;
    out.push({
      from: i,
      to: Math.min(i + size, values.length) - 1,
      value: n >= minN ? mean(slice) : null,
      n
    });
  }
  return out;
}

/** Pole hodnot nálady pro souvislý rozsah dnů; chybějící den je null. */
export function seriesFor(entries, fromKey, count, addDays) {
  const byDay = new Map(entries.map((e) => [e.day, e]));
  const keys = [];
  for (let i = 0; i < count; i++) keys.push(addDays(fromKey, i));
  return {
    keys,
    values: keys.map((k) => {
      const e = byDay.get(k);
      return e && e.mood !== null && e.mood !== undefined ? e.mood : null;
    })
  };
}
