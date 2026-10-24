/*
 * syllables.js — Découpage approximatif en syllabes écrites, façon école
 * (pom-me, che-vaux, en-sem-ble), utilisé par le bouton « Indice ».
 *
 * Méthode : on découpe le mot en « unités » (groupes de voyelles, consonnes
 * et digrammes ch, ph, gn, th, qu, gu), puis on coupe entre deux groupes de
 * voyelles :
 *   V-CV      (1 consonne)            ba-teau
 *   VC-CV     (2 consonnes séparables) en-sem
 *   V-CCV     (consonne + l/r)        sem-ble → em-ble
 *   VC-CCV / VCC-CV (3 consonnes)     ins-truit
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Syllables = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VOWELS = 'aeiouyéèêëàâîïôûùœæ';
  const isV = (c) => VOWELS.indexOf(c.toLowerCase()) >= 0;
  const DIGRAPHS = ['ch', 'ph', 'gn', 'th', 'rh'];
  const LIQUID_OK = 'bcdfgkptv'; // consonnes qui s'attachent à l ou r : bl, cr, tr…

  function units(word) {
    const out = [];
    let i = 0;
    while (i < word.length) {
      const c = word[i], low = word.slice(i, i + 2).toLowerCase();
      if (isV(c)) {
        let j = i;
        while (j < word.length && isV(word[j])) j++;
        out.push({ t: 'V', s: word.slice(i, j) });
        i = j;
      } else if ((low === 'qu' || (low === 'gu' && /[eéèêiy]/i.test(word[i + 2] || ''))) && i + 2 < word.length) {
        out.push({ t: 'C', s: word.slice(i, i + 2) });
        i += 2;
      } else if (DIGRAPHS.indexOf(low) >= 0) {
        out.push({ t: 'C', s: word.slice(i, i + 2) });
        i += 2;
      } else {
        out.push({ t: 'C', s: c });
        i++;
      }
    }
    return out;
  }

  function inseparable(a, b) {
    return a.length === 1 && b.length === 1 &&
      LIQUID_OK.indexOf(a.toLowerCase()) >= 0 && 'lr'.indexOf(b.toLowerCase()) >= 0;
  }

  /** Syllabes d'un mot simple (sans espace ni tiret). */
  function splitWord(word) {
    const u = units(word);
    const vIdx = [];
    u.forEach((x, k) => { if (x.t === 'V') vIdx.push(k); });
    if (vIdx.length < 2) return [word];
    const cuts = []; // indices d'unités où commence une nouvelle syllabe
    for (let p = 0; p < vIdx.length - 1; p++) {
      const a = vIdx[p], b = vIdx[p + 1];
      const k = b - a - 1; // nombre de consonnes entre les deux voyelles
      if (k <= 1) cuts.push(a + 1);
      else if (k === 2) cuts.push(inseparable(u[a + 1].s, u[a + 2].s) ? a + 1 : a + 2);
      else cuts.push(inseparable(u[b - 2].s, u[b - 1].s) ? b - 2 : b - 1);
    }
    const syl = [];
    let start = 0;
    cuts.concat([u.length]).forEach((c) => {
      syl.push(u.slice(start, c).map((x) => x.s).join(''));
      start = c;
    });
    return syl.filter(Boolean);
  }

  /** Découpe une expression (espaces, tirets, apostrophes conservés à part). */
  function split(text) {
    const parts = String(text).split(/([\s\-'’]+)/);
    const out = [];
    parts.forEach((p) => {
      if (!p) return;
      if (/^[\s\-'’]+$/.test(p)) out.push(p);
      else splitWord(p).forEach((s) => out.push(s));
    });
    return out.filter((s) => s.trim());
  }

  return { units, splitWord, split };
});
