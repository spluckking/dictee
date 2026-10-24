/*
 * leitner.js — Répétition espacée en 3 boîtes de Leitner, planifiée selon le
 * nombre de jours restant avant la dictée, et file d'attente d'une séance.
 *
 * Boîte 1 : mot fragile, revu tous les jours.
 * Boîte 2 : mot en cours d'acquisition, revu tous les 1 ou 2 jours.
 * Boîte 3 : mot su, revu moins souvent, mais toujours la veille de la dictée.
 *
 * Règles :
 * - réussite sans indice → boîte suivante (les modes de reconnaissance
 *   « Le bon mot » et « Lettres mélangées » ne font pas dépasser la boîte 2 :
 *   reconnaître n'est pas encore savoir écrire) ;
 * - réussite avec indice → le mot reste dans sa boîte ;
 * - erreur → retour en boîte 1, et le mot revient plus tard dans la séance.
 *
 * Les dates sont des chaînes locales « AAAA-MM-JJ ».
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Leitner = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RECOGNITION_MODES = ['choix', 'lettres'];

  /* ---------- Dates ---------- */

  function todayStr(date) {
    const d = date || new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function parse(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 12); // midi : évite les soucis d'heure d'été
  }

  function addDays(str, n) {
    const d = parse(str);
    d.setDate(d.getDate() + n);
    return todayStr(d);
  }

  function diffDays(a, b) {
    return Math.round((parse(b) - parse(a)) / 86400000);
  }

  /**
   * Nombre de jours avant la dictée.
   * dictationDay : 0 = dimanche … 5 = vendredi (comme Date.getDay()).
   * Renvoie 0 le jour même, 1 la veille, etc.
   */
  function daysUntilDictation(dictationDay, today) {
    const dow = parse(today).getDay();
    return (dictationDay - dow + 7) % 7;
  }

  /* ---------- Planification ---------- */

  /** Intervalle (en jours) avant de revoir un mot de cette boîte. */
  function intervalFor(box, daysLeft) {
    if (box <= 1) return 1;
    if (box === 2) return daysLeft >= 4 ? 2 : 1;
    return daysLeft >= 5 ? 3 : daysLeft >= 3 ? 2 : 1;
  }

  /**
   * Prochaine date de révision : jamais après la veille de la dictée,
   * pour que tous les mots soient revus pendant la « dictée blanche ».
   */
  function nextDueDate(box, today, daysLeft) {
    let next = addDays(today, intervalFor(box, daysLeft));
    if (daysLeft >= 2) {
      const eve = addDays(today, daysLeft - 1);
      if (next > eve) next = eve;
    }
    return next;
  }

  function newWordState() {
    return { box: 1, success: 0, fail: 0, hinted: 0, errors: {}, nextDue: null, lastSeen: null };
  }

  function isDue(state, today) {
    return !state || !state.nextDue || state.nextDue <= today;
  }

  /**
   * Applique le résultat d'une tentative et renvoie un NOUVEL état.
   * result = { correct, usedHint, answer, mode, today, daysLeft }
   * Le champ `change` indique ce qui s'est passé : 'up', 'same' ou 'down'.
   */
  function applyResult(state, result) {
    const s = Object.assign(newWordState(), state || {});
    s.errors = Object.assign({}, s.errors);
    const before = s.box;
    const maxBox = RECOGNITION_MODES.indexOf(result.mode) >= 0 ? 2 : 3;

    if (result.correct) {
      s.success++;
      if (result.usedHint) s.hinted++;
      else if (s.box < maxBox) s.box++;
    } else {
      s.fail++;
      s.box = 1;
      const a = (result.answer || '').trim();
      if (a) s.errors[a] = (s.errors[a] || 0) + 1;
    }
    s.lastSeen = result.today;
    s.nextDue = nextDueDate(s.box, result.today, result.daysLeft);
    s.change = s.box > before ? 'up' : s.box < before ? 'down' : 'same';
    return s;
  }

  /** Les erreurs les plus fréquentes d'un mot (pour le tableau parent). */
  function topErrors(state, n) {
    const e = (state && state.errors) || {};
    return Object.keys(e).sort((a, b) => e[b] - e[a]).slice(0, n || 3)
      .map((w) => ({ answer: w, count: e[w] }));
  }

  /* ---------- Choix des mots d'une séance ---------- */

  /**
   * words    : liste de chaînes (mots de la semaine + révisions)
   * progress : { mot: état }
   * Prend d'abord les mots à revoir aujourd'hui (boîte basse et souvent ratés
   * en premier). S'il y en a peu, complète avec les autres pour que l'enfant
   * puisse toujours s'entraîner.
   */
  function pickSessionWords(words, progress, today, max) {
    max = max || 15;
    const order = (w) => words.indexOf(w);
    const st = (w) => progress[w] || newWordState();
    const due = words.filter((w) => isDue(progress[w], today))
      .sort((a, b) => st(a).box - st(b).box || st(b).fail - st(a).fail || order(a) - order(b));
    const minimum = Math.min(5, words.length);
    let list = due.slice(0, max);
    if (list.length < minimum) {
      const others = words.filter((w) => list.indexOf(w) < 0)
        .sort((a, b) => st(a).box - st(b).box ||
          String(st(a).nextDue).localeCompare(String(st(b).nextDue)) || order(a) - order(b));
      list = list.concat(others.slice(0, minimum - list.length));
    }
    return list;
  }

  /**
   * Plan de la séance.
   * - Découverte : tant qu'un mot de la liste n'a jamais été vu (début de
   *   semaine, mot ajouté), la séance présente TOUS les mots en une fois,
   *   sans limite de nombre ni de durée.
   * - Ensuite : révisions espacées (mots dus), 15 mots ou 10 minutes.
   * Renvoie { discovery, words, options } (options pour new Session).
   */
  function planSession(words, progress, today, max) {
    const unseen = words.filter((w) => !progress[w] || !progress[w].lastSeen);
    if (unseen.length) {
      // les mots jamais vus d'abord, puis les autres (les plus fragiles en premier)
      const seen = words.filter((w) => unseen.indexOf(w) < 0)
        .sort((a, b) => progress[a].box - progress[b].box);
      const list = unseen.concat(seen);
      return { discovery: true, words: list,
        options: { maxAttempts: list.length * 3, maxMs: Infinity } };
    }
    return { discovery: false, words: pickSessionWords(words, progress, today, max || 15),
      options: { maxAttempts: max || 15 } };
  }

  /* ---------- File d'attente d'une séance ---------- */

  /**
   * Séance courte : s'arrête après `maxAttempts` mots présentés (15) ou
   * `maxMs` millisecondes (10 min), vérifié entre deux mots seulement.
   * Un mot raté est réinséré `gap` positions plus loin (au plus `maxRetries` fois).
   */
  function Session(words, opts) {
    opts = opts || {};
    this.queue = words.slice();
    this.maxAttempts = opts.maxAttempts || 15;
    this.maxMs = opts.maxMs || 10 * 60 * 1000;
    this.gap = opts.gap || 3;
    this.maxRetries = opts.maxRetries == null ? 2 : opts.maxRetries;
    this.startedAt = opts.now != null ? opts.now : Date.now();
    this.attempts = 0;
    this.retries = {};
    this.results = []; // { word, correct, usedHint }
    this.current = null;
  }

  Session.prototype.next = function (now) {
    now = now != null ? now : Date.now();
    if (this.queue.length === 0) return (this.current = null);
    if (this.attempts >= this.maxAttempts) return (this.current = null);
    if (now - this.startedAt >= this.maxMs) return (this.current = null);
    this.attempts++;
    this.current = this.queue.shift();
    return this.current;
  };

  Session.prototype.report = function (word, correct, usedHint) {
    this.results.push({ word, correct: !!correct, usedHint: !!usedHint });
    if (!correct) {
      const r = this.retries[word] || 0;
      if (r < this.maxRetries) {
        this.retries[word] = r + 1;
        const pos = Math.min(this.gap, this.queue.length);
        this.queue.splice(pos, 0, word);
      }
    }
  };

  Session.prototype.remaining = function () {
    return Math.min(this.queue.length, this.maxAttempts - this.attempts);
  };

  /* ---------- Mode du jour ---------- */

  /**
   * Reconnaissance en début de semaine, production en fin de semaine,
   * dictée blanche la veille.
   *   ≥ 4 jours : « Le bon mot »        (reconnaître)
   *     3 jours : « Lettres mélangées » (reconstruire)
   *     2 jours : « Regarder-cacher-écrire »
   *     1 jour  : « Dictée blanche »
   *     0 jour  : « Dictée-flash » (dernier entraînement du matin)
   */
  function dailyMode(daysLeft) {
    if (daysLeft >= 4) return 'choix';
    if (daysLeft === 3) return 'lettres';
    if (daysLeft === 2) return 'regarder';
    if (daysLeft === 1) return 'blanche';
    return 'flash';
  }

  return {
    RECOGNITION_MODES, todayStr, addDays, diffDays, daysUntilDictation,
    intervalFor, nextDueDate, newWordState, isDue, applyResult, topErrors,
    pickSessionWords, planSession, Session, dailyMode
  };
});
