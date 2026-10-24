/*
 * distractors.js — Fausses orthographes plausibles pour le mode « Le bon mot ».
 *
 * Chaque règle reproduit une erreur fréquente au CE2 :
 *   finale      : s / x / t / d / p muets en fin de mot
 *   double      : consonne doublée ou simplifiée (pomme → pome, galop → gallop)
 *   accent      : é / è / ê / e, à / a, ô / o…
 *   ai          : ai / è / ê / ei
 *   o           : o / au / eau
 *   mbp         : m devant m, b, p (ensemble → ansemble, enssemble…)
 *   nasale      : an / en
 *   son         : c / s / ss, g / j, ph / f, qu / k, h muet
 *
 * generate(mot, n, rng) renvoie n distracteurs, si possible issus de règles
 * différentes. rng (facultatif) permet des tests reproductibles.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Distractors = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VOWELS = 'aeiouyéèêëàâîïôûùœ';
  const isVowel = (c) => !!c && VOWELS.indexOf(c) >= 0;

  /** Remplace `len` caractères à la position `i` par `rep`. */
  function splice(w, i, len, rep) {
    return w.slice(0, i) + rep + w.slice(i + len);
  }

  /** Toutes les positions où `sub` apparaît dans `w`. */
  function positions(w, sub) {
    const out = [];
    let i = w.indexOf(sub);
    while (i >= 0) { out.push(i); i = w.indexOf(sub, i + 1); }
    return out;
  }

  const RULES = {
    finale(w) {
      const out = [];
      const last = w.slice(-1), prev = w.slice(-2, -1);
      if (last === 'x') out.push(w.slice(0, -1) + 's', w.slice(0, -1));
      else if (last === 's') {
        out.push(w.slice(0, -1));
        if (prev && 'ua'.indexOf(prev) >= 0) out.push(w.slice(0, -1) + 'x');
        if (prev === 'p' || prev === 't') out.push(w.slice(0, -2) + 's');
      } else if (last === 't') out.push(w.slice(0, -1), w.slice(0, -1) + 'd');
      else if (last === 'd') out.push(w.slice(0, -1) + 't', w.slice(0, -1));
      else if (last === 'p') out.push(w.slice(0, -1), w.slice(0, -1) + 's');
      else if (isVowel(last) && last !== 'e') out.push(w + 's', w + 't');
      return out;
    },

    double(w) {
      const out = [];
      for (let i = 1; i < w.length - 1; i++) {
        const c = w[i];
        if (!c || 'lmnprtsfc'.indexOf(c) < 0) continue;
        if (w[i + 1] === c) out.push(splice(w, i, 2, c)); // ll → l
        else if (w[i - 1] !== c && isVowel(w[i - 1]) && isVowel(w[i + 1])) out.push(splice(w, i, 1, c + c)); // l → ll
      }
      return out;
    },

    accent(w) {
      const map = { 'é': ['e', 'è'], 'è': ['é', 'ê'], 'ê': ['è', 'e'], 'à': ['a'], 'â': ['a'],
        'ô': ['o'], 'î': ['i'], 'û': ['u'], 'ù': ['u'], 'ç': ['c'], 'ë': ['e'], 'ï': ['i'] };
      const out = [];
      for (let i = 0; i < w.length; i++) {
        (map[w[i]] || []).forEach((r) => out.push(splice(w, i, 1, r)));
        // e sans accent devant consonne + voyelle (ex. « ecole ») → é
        if (w[i] === 'e' && i < w.length - 2 && !isVowel(w[i + 1]) && isVowel(w[i + 2]) &&
            (i === 0 || !isVowel(w[i - 1]))) out.push(splice(w, i, 1, 'é'));
      }
      return out;
    },

    ai(w) {
      const out = [];
      positions(w, 'ai').forEach((i) => out.push(splice(w, i, 2, 'è'), splice(w, i, 2, 'ê'), splice(w, i, 2, 'ei')));
      positions(w, 'ei').forEach((i) => out.push(splice(w, i, 2, 'ai'), splice(w, i, 2, 'è')));
      ['è', 'ê'].forEach((c) => positions(w, c).forEach((i) => out.push(splice(w, i, 1, 'ai'))));
      if (/et$/.test(w)) out.push(w.slice(0, -2) + 'ai', w.slice(0, -2) + 'è');
      return out;
    },

    o(w) {
      const out = [];
      const eau = positions(w, 'eau');
      eau.forEach((i) => out.push(splice(w, i, 3, 'o'), splice(w, i, 3, 'au')));
      positions(w, 'au').forEach((i) => {
        if (eau.indexOf(i - 1) >= 0) return;
        out.push(splice(w, i, 2, 'o'), splice(w, i, 2, 'eau'));
      });
      positions(w, 'ô').forEach((i) => out.push(splice(w, i, 1, 'au'), splice(w, i, 1, 'eau')));
      for (let i = 0; i < w.length; i++) {
        // o « simple » (pas ou, oi, on, om, ô)
        if (w[i] === 'o' && !(w[i + 1] && 'uinm'.indexOf(w[i + 1]) >= 0) && w[i - 1] !== 'e')
          out.push(splice(w, i, 1, 'au'), splice(w, i, 1, 'eau'));
      }
      return out;
    },

    mbp(w) {
      const out = [];
      for (let i = 1; i < w.length - 1; i++) {
        if (!w[i + 1] || 'mbp'.indexOf(w[i + 1]) < 0 || !isVowel(w[i - 1])) continue;
        if (w[i] === 'm') out.push(splice(w, i, 1, 'n'));
        else if (w[i] === 'n') out.push(splice(w, i, 1, 'm'));
      }
      return out;
    },

    nasale(w) {
      const out = [];
      for (let i = 0; i < w.length - 1; i++) {
        const pair = w.slice(i, i + 2), nx = w[i + 2];
        if ((pair === 'en' || pair === 'an' || pair === 'em' || pair === 'am') && nx && !isVowel(nx) && nx !== 'n' && nx !== 'm') {
          out.push(splice(w, i, 1, pair[0] === 'e' ? 'a' : 'e'));
        }
      }
      return out;
    },

    son(w) {
      const out = [];
      for (let i = 0; i < w.length; i++) {
        const nx = w[i + 1] || '';
        const soft = /[eéèêiy]/.test(nx);
        if (w[i] === 'c' && soft) out.push(splice(w, i, 1, 's'));
        if (w[i] === 'g' && soft && w[i - 1] !== 'n') out.push(splice(w, i, 1, 'j'));
        if (w[i] === 'j' && soft) out.push(splice(w, i, 1, 'g'));
        if (w[i] === 's' && w[i + 1] === 's' && soft) out.push(splice(w, i, 2, 'c'));
      }
      positions(w, 'ph').forEach((i) => out.push(splice(w, i, 2, 'f')));
      positions(w, 'qu').forEach((i) => out.push(splice(w, i, 2, 'k')));
      if (w[0] === 'h') out.push(w.slice(1));
      return out;
    }
  };

  /** Toutes les variantes, par règle : { règle: [variantes] }. */
  function candidates(word) {
    const w = word.normalize('NFC');
    const res = {};
    Object.keys(RULES).forEach((k) => {
      const seen = {};
      res[k] = RULES[k](w).filter((v) => v && v !== w && !seen[v] && (seen[v] = true));
    });
    return res;
  }

  /**
   * Repli si les règles ne donnent pas assez : on simplifie un groupe de
   * voyelles (toujours → tojours), on double une consonne quelconque entre
   * deux voyelles (page → pagge) ou on inverse deux voyelles (ou → uo).
   */
  function fallback(w) {
    const out = [];
    for (let i = 0; i < w.length - 1; i++) {
      if (isVowel(w[i]) && isVowel(w[i + 1])) {
        out.push(splice(w, i + 1, 1, ''), splice(w, i, 2, w[i + 1] + w[i]));
      }
      if (i > 0 && !isVowel(w[i]) && w[i] !== w[i - 1] && w[i] !== w[i + 1] && isVowel(w[i - 1]) && isVowel(w[i + 1])) {
        out.push(splice(w, i, 1, w[i] + w[i]));
      }
    }
    return out.filter((v) => v !== w && v.length > 1);
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** n distracteurs distincts, en variant les règles quand c'est possible. */
  function generate(word, n, rng) {
    n = n || 2;
    rng = rng || Math.random;
    const w = word.normalize('NFC');
    const byRule = candidates(w);
    const rules = shuffle(Object.keys(byRule).filter((k) => byRule[k].length), rng);
    const chosen = [];
    // 1er passage : une variante par règle différente
    for (const k of rules) {
      if (chosen.length >= n) break;
      const pick = shuffle(byRule[k], rng).find((v) => chosen.indexOf(v) < 0);
      if (pick) chosen.push(pick);
    }
    // 2e passage : n'importe quelle variante restante, puis le repli
    const rest = shuffle([].concat.apply([], rules.map((k) => byRule[k])), rng).concat(shuffle(fallback(w), rng));
    for (const v of rest) {
      if (chosen.length >= n) break;
      if (v !== w && chosen.indexOf(v) < 0) chosen.push(v);
    }
    return chosen;
  }

  return { RULES, candidates, generate, fallback };
});
