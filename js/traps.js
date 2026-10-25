/*
 * traps.js — Les « pièges » d'orthographe d'un mot, détectés automatiquement,
 * et les lieux du monde qui les représentent.
 *
 * C'est le cœur du mélange de méthodes, à la façon d'une méthode « multi
 * malin » pour l'orthographe :
 * - fractionnement : le mot est découpé en syllabes et ses pièges sont colorés ;
 * - palais mental : chaque type de piège est un lieu du monde de blocs
 *   (le château des lettres muettes, la tour des lettres doubles…). Chaque mot
 *   « habite » dans le lieu de son piège principal ;
 * - carte mentale : la carte regroupe les mots par lieu (écran « Ma carte »).
 *
 * Tout est calculé à partir du mot lui-même, donc fonctionne avec n'importe
 * quelle nouvelle liste.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Traps = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Les lieux, dans l'ordre de priorité pour choisir le lieu principal d'un mot. */
  const PLACES = {
    tion:    { nom: 'L\'île des -tion', regle: 'Le son « sion » à la fin d\'un mot s\'écrit souvent t-i-o-n.', couleur: '#2f9fd0' },
    muette:  { nom: 'Le château des lettres muettes', regle: 'Une lettre qu\'on n\'entend pas : il faut la voir dans sa tête !', couleur: '#8a46c8' },
    double:  { nom: 'La tour des lettres doubles', regle: 'Deux lettres pareilles côte à côte : ll, mm, tt, ff…', couleur: '#d2483c' },
    mbp:     { nom: 'Le pont du m', regle: 'Devant m, b et p, on écrit m et pas n.', couleur: '#c8662e' },
    h:       { nom: 'Le puits du h muet', regle: 'Le h ne se prononce pas, mais il est bien là.', couleur: '#5a6470' },
    accent:  { nom: 'La grotte des accents', regle: 'é, è, ê : écoute le son et pense au chapeau.', couleur: '#e0a800' },
    sons:    { nom: 'La forêt des sons cachés', regle: 'Plusieurs lettres pour un seul son : ph, ai, ei, au, eau, oi, ill, an, en…', couleur: '#3f9d3a' },
    simple:  { nom: 'La prairie des mots tranquilles', regle: 'Ce mot s\'écrit comme il se prononce : écoute bien chaque son.', couleur: '#8a5a36' }
  };
  const ORDER = ['tion', 'muette', 'double', 'mbp', 'h', 'accent', 'sons'];

  const V = 'aeiouyéèêëàâîïôûùœ';
  const isV = (c) => !!c && V.indexOf(c) >= 0;

  // sons à plusieurs lettres, du plus long au plus court
  const SONS = ['eau', 'ill', 'ain', 'ein', 'oin', 'ph', 'ai', 'ei', 'au', 'oi', 'gn', 'qu'];

  /**
   * Pièges d'un mot. Seul le dernier mot est analysé (« la jungle » → jungle),
   * les positions sont données dans le mot complet.
   * Renvoie { place, traps: [{ place, start, end }] } (end exclu).
   */
  function detect(word) {
    const full = String(word).normalize('NFC');
    const m = full.match(/^(.*[\s'’])?([^\s'’]+)$/);
    const off = m && m[1] ? m[1].length : 0;
    const w = (m ? m[2] : full).toLowerCase();
    const traps = [];
    const add = (place, s, e) => traps.push({ place, start: off + s, end: off + e });
    let k;

    // -tion(s)
    k = w.search(/tions?$/);
    if (k >= 0) add('tion', k, k + 4);

    // lettres muettes finales : t, d, s, x, p, g (serpent, doigt, chevaux)
    const fin = w.match(/[tdsxpg]+$/);
    if (fin && w.length > 2 && !(k >= 0 && fin.index >= k)) add('muette', fin.index, w.length);

    // lettres doubles (sauf le ll de « ill »)
    for (const d of w.matchAll(/([bcdfglmnprst])\1/g)) {
      if (!(d[1] === 'l' && w[d.index - 1] === 'i')) add('double', d.index, d.index + 2);
    }

    // m devant b ou p
    for (const d of w.matchAll(/m(?=[bp])/g)) add('mbp', d.index, d.index + 1);

    // h muet (pas ch, ph, th, sh)
    for (const d of w.matchAll(/h/g)) {
      const before = w[d.index - 1];
      if (!before || 'cpst'.indexOf(before) < 0) add('h', d.index, d.index + 1);
    }

    // accents
    for (const d of w.matchAll(/[éèêëàâîïôûùç]/g)) add('accent', d.index, d.index + 1);

    // sons à plusieurs lettres (sans chevauchement)
    const used = new Array(w.length).fill(false);
    traps.filter((t) => t.place === 'tion').forEach((t) => { for (let i = t.start - off; i < t.end - off; i++) used[i] = true; });
    const take = (s, e) => {
      for (let i = s; i < e; i++) if (used[i]) return false;
      for (let i = s; i < e; i++) used[i] = true;
      add('sons', s, e);
      return true;
    };
    for (let i = 0; i < w.length; i++) {
      for (const p of SONS) {
        // ain, ein, oin ne sont nasals que devant une consonne ou en fin de mot
        if (/n$/.test(p) && p.length === 3 && isV(w[i + 3])) continue;
        if (w.startsWith(p, i) && take(i, i + p.length)) { i += p.length - 1; break; }
      }
    }
    // an, en, am, em, in, im devant consonne ou en fin de mot (son nasal)
    for (const d of w.matchAll(/[aei][nm](?![aeiouyéèênm])/g)) {
      if (!isV(w[d.index - 1]) || w[d.index - 1] === 'i') take(d.index, d.index + 2);
    }
    // -er des verbes (on entend « é »)
    if (/er$/.test(w) && w.length > 3) take(w.length - 2, w.length);
    // s entre deux voyelles = son « z »
    for (let i = 1; i < w.length - 1; i++) {
      if (w[i] === 's' && isV(w[i - 1]) && isV(w[i + 1])) take(i, i + 1);
    }

    traps.sort((a, b) => a.start - b.start);
    const place = ORDER.find((p) => traps.some((t) => t.place === p)) || 'simple';
    return { place, traps };
  }

  /**
   * Morceaux à afficher (fractionnement) : syllabes du mot, chaque lettre
   * marquée avec le lieu de son piège éventuel.
   * Renvoie [{ text, trap: placeId|null, sep: bool }] où sep marque le début
   * d'une nouvelle syllabe.
   */
  function chunks(word, syllables) {
    const full = String(word).normalize('NFC');
    const { traps } = detect(full);
    // si deux pièges se chevauchent, on montre le plus important (ordre ORDER)
    const rank = (t) => { const r = ORDER.indexOf(t.place); return r < 0 ? 99 : r; };
    const trapAt = (i) => {
      let best = -1;
      traps.forEach((x, k) => { if (i >= x.start && i < x.end && (best < 0 || rank(x) < rank(traps[best]))) best = k; });
      return best;
    };
    // pas de coupure de syllabes dans l'article ou le pronom (« une », « nous »)
    const core = full.match(/^(.*[\s'’])?[^\s'’]+$/);
    const coreStart = core && core[1] ? core[1].length : 0;
    const starts = new Set();
    let pos = coreStart;
    (syllables || [full]).filter((s) => !/^[\s\-'’]+$/.test(s)).forEach((s) => {
      const i = full.indexOf(s, pos);
      if (i >= 0) { starts.add(i); pos = i + s.length; }
    });
    const out = [];
    let prevIdx = -2;
    Array.from(full).forEach((c, i) => {
      const k = trapAt(i);
      const sep = starts.has(i) && i > 0 && !/[\s'’]/.test(full[i - 1]);
      const last = out[out.length - 1];
      if (last && k === prevIdx && !sep) last.text += c;
      else out.push({ text: c, trap: k >= 0 ? traps[k].place : null, sep });
      prevIdx = k;
    });
    return out;
  }

  return { PLACES, ORDER, detect, chunks };
});
