/*
 * align.js — Comparaison de la réponse de l'enfant avec le mot attendu.
 *
 * - levenshtein(a, b) : distance d'édition classique (insertion, suppression,
 *   substitution coûtent 1).
 * - align(reponse, attendu) : alignement lettre à lettre (programmation
 *   dynamique avec retour arrière). Une substitution qui ne diffère que par
 *   l'accent (e/é) coûte 0,5 pour que l'alignement reste « naturel ».
 * - grade(reponse, attendu) : verdict complet utilisé par l'interface.
 *
 * Fonctionne dans le navigateur (window.Align) et sous Node (require).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Align = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Retire les accents (é → e, ç → c, œ reste œ). */
  function stripAccents(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  }

  /**
   * Nettoie une saisie : espaces superflus, apostrophes typographiques,
   * forme Unicode composée. Si le mot attendu n'a pas de majuscule, on met
   * la réponse en minuscules (le clavier manuscrit en ajoute parfois).
   */
  function normalize(answer, target) {
    let s = String(answer || '')
      .normalize('NFC')
      .replace(/[’‘`´]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    const t = String(target || '').normalize('NFC');
    if (t && t === t.toLowerCase()) s = s.toLowerCase();
    return s;
  }

  /** Distance de Levenshtein (entiers). */
  function levenshtein(a, b) {
    a = Array.from(a); b = Array.from(b);
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function subCost(x, y) {
    if (x === y) return 0;
    if (stripAccents(x) === stripAccents(y)) return 0.5;
    return 1;
  }

  /**
   * Aligne `got` (réponse) sur `expected` (mot correct).
   * Renvoie une liste d'opérations, dans l'ordre du mot :
   *   { op: 'ok',      expected: 'a', got: 'a' }   lettre juste
   *   { op: 'accent',  expected: 'é', got: 'e' }   seul l'accent diffère
   *   { op: 'sub',     expected: 'x', got: 's' }   lettre fausse
   *   { op: 'missing', expected: 'u', got: ''  }   lettre oubliée
   *   { op: 'extra',   expected: '',  got: 'e' }   lettre en trop
   */
  function align(got, expected) {
    const a = Array.from(got), b = Array.from(expected);
    const n = a.length, m = b.length;
    const d = [];
    for (let i = 0; i <= n; i++) {
      d.push(new Array(m + 1).fill(0));
      d[i][0] = i;
    }
    for (let j = 0; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        d[i][j] = Math.min(
          d[i - 1][j - 1] + subCost(a[i - 1], b[j - 1]),
          d[i - 1][j] + 1, // lettre en trop dans la réponse
          d[i][j - 1] + 1  // lettre manquante
        );
      }
    }
    // Retour arrière : on préfère la diagonale, puis « manquante », puis « en trop ».
    const ops = [];
    let i = n, j = m;
    const eq = (x, y) => Math.abs(x - y) < 1e-9;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && eq(d[i][j], d[i - 1][j - 1] + subCost(a[i - 1], b[j - 1]))) {
        const c = subCost(a[i - 1], b[j - 1]);
        ops.push({ op: c === 0 ? 'ok' : c < 1 ? 'accent' : 'sub', expected: b[j - 1], got: a[i - 1] });
        i--; j--;
      } else if (j > 0 && eq(d[i][j], d[i][j - 1] + 1)) {
        ops.push({ op: 'missing', expected: b[j - 1], got: '' });
        j--;
      } else {
        ops.push({ op: 'extra', expected: '', got: a[i - 1] });
        i--;
      }
    }
    return ops.reverse();
  }

  // Déterminants qu'on peut ne pas écrire (« jungle » accepté pour « la jungle »).
  const DET = /^(le|la|les|l'|un|une|des|du|de la|de l'|au|aux|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs|ce|cet|cette|ces)(?:\s+|(?<='))(?=\S)/i;

  /** Sépare le déterminant du mot : « l'attention » → { det: "l'", core: 'attention' }. */
  function splitDeterminer(target) {
    const t = String(target).normalize('NFC').trim().replace(/[’‘]/g, "'");
    const m = t.match(DET);
    if (!m) return { det: '', core: t };
    return { det: m[1], core: t.slice(m[0].length) };
  }

  /**
   * Verdict complet.
   *  correct     : réponse identique au mot (le déterminant peut être omis)
   *  accentOnly  : seuls des accents diffèrent (→ « Presque ! Regarde l'accent »)
   *  distance    : distance de Levenshtein
   *  ops         : alignement (voir align)
   *  answer      : réponse normalisée
   *  target      : forme comparée (le mot sans déterminant si l'enfant ne l'a pas écrit)
   */
  function grade(answer, target) {
    let t = String(target).normalize('NFC').trim().replace(/[’‘]/g, "'");
    const a = normalize(answer, t);
    // pas de déterminant dans la réponse : on compare au mot seul
    const { det, core } = splitDeterminer(t);
    if (det && !splitDeterminer(a).det && core) t = core;
    const correct = a === t;
    const accentOnly = !correct && a.length > 0 && stripAccents(a) === stripAccents(t);
    return { correct, accentOnly, distance: levenshtein(a, t), ops: align(a, t), answer: a, target: t };
  }

  return { stripAccents, normalize, levenshtein, align, grade, splitDeterminer };
});
