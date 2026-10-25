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
 * - réussite avec indice, ou quand l'enfant dit « j'hésite » → le mot reste
 *   dans sa boîte ;
 * - une seule montée de boîte par jour et par mot ;
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
   * result = { correct, usedHint, unsure, answer, mode, today, daysLeft }
   * Le champ `change` indique ce qui s'est passé : 'up', 'same' ou 'down'.
   */
  function applyResult(state, result) {
    const s = Object.assign(newWordState(), state || {});
    s.errors = Object.assign({}, s.errors);
    const before = s.box;
    const maxBox = RECOGNITION_MODES.indexOf(result.mode) >= 0 ? 2 : 3;

    // Une seule montée de boîte par jour : c'est l'espacement qui fait retenir.
    const sameDay = state && state.lastSeen === result.today;
    if (result.correct) {
      s.success++;
      if (result.usedHint) s.hinted++;
      if (result.unsure) s.unsure = (s.unsure || 0) + 1;
      if (!result.usedHint && !result.unsure && !sameDay && s.box < maxBox) s.box++;
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

  /* ---------- Phase 2 : la mine des souvenirs ---------- */

  /**
   * Quand une nouvelle semaine commence, les mots de la semaine passée
   * rejoignent la phase 2, où TOUTES les anciennes listes sont mélangées.
   * Chaque mot y a sa propre mémoire (principe d'Anki, simplifié) :
   *   - interval : nombre de jours avant de le revoir ;
   *   - ease     : « facilité » du mot pour l'enfant (1,3 à 3).
   * Réussite sûre      → l'intervalle est multiplié par la facilité, qui augmente un peu.
   * Réussite hésitante → l'intervalle grandit à peine (× 1,2), la facilité baisse un peu.
   * Erreur             → le mot revient le lendemain, et sa facilité baisse :
   *                      il reviendra plus souvent ensuite.
   * Retrait : quand une réussite sûre porterait l'intervalle au-delà de
   * RETIRE_DAYS (≈ 45 jours) après au moins 4 réussites d'affilée,
   * le mot est su pour de bon (au plus tôt après ≈ 5 semaines sans erreur ;
   * un mot souvent raté reste bien plus longtemps).
   */
  const EASE_START = 2.2, EASE_MIN = 1.3, EASE_MAX = 3;
  const RETIRE_DAYS = 45, RETIRE_STREAK = 4;

  /** Entrée de phase 2 pour un mot de la semaine qui se termine. */
  function archiveEntry(state, today, extra) {
    const known = state && state.box === 3;
    const interval = known ? 3 : 1;
    return Object.assign({ interval, ease: known ? EASE_START : EASE_START - 0.2, streak: 0, ok: 0, fail: 0,
      added: today, nextDue: addDays(today, interval) }, extra || {});
  }

  /** Convertit une entrée de l'ancienne version (niveaux 0 à 3). */
  function migrateEntry(e) {
    if (e.interval != null) return e;
    const interval = [2, 7, 14, 30][e.level || 0] || 2;
    return Object.assign({}, e, { interval, ease: EASE_START, streak: e.level || 0 });
  }

  /**
   * Résultat d'une révision de phase 2.
   * result = { correct, unsure } → { entry, retired }
   */
  function applyArchiveResult(entry, result, today) {
    const e = migrateEntry(Object.assign({}, entry));
    // déjà vu aujourd'hui (mot raté puis réécrit dans la même expédition) :
    // une réussite ne compte pas, le mot reviendra demain comme prévu
    if (result.correct && e.lastSeen === today) return { entry: e, retired: false };
    e.lastSeen = today;
    if (result.correct && !result.unsure) {
      e.ok++;
      e.streak++;
      const next = Math.max(e.interval + 1, Math.round(e.interval * e.ease));
      e.ease = Math.min(EASE_MAX, Math.round((e.ease + 0.1) * 100) / 100);
      if (e.streak >= RETIRE_STREAK && next >= RETIRE_DAYS) return { entry: e, retired: true };
      e.interval = next;
    } else if (result.correct) {
      e.ok++;
      e.interval = Math.max(1, Math.round(e.interval * 1.2));
      e.ease = Math.max(EASE_MIN, Math.round((e.ease - 0.05) * 100) / 100);
    } else {
      e.fail++;
      e.streak = 0;
      e.interval = 1;
      e.ease = Math.max(EASE_MIN, Math.round((e.ease - 0.3) * 100) / 100);
    }
    e.nextDue = addDays(today, e.interval);
    return { entry: e, retired: false };
  }

  /**
   * Mots de phase 2 à revoir aujourd'hui, mélangés toutes semaines confondues.
   * Priorité : les plus en retard (par rapport à leur intervalle), puis les
   * plus difficiles (facilité basse).
   */
  function dueArchive(archive, today, max) {
    const late = (w) => {
      const e = migrateEntry(archive[w]);
      return diffDays(e.nextDue, today) / Math.max(1, e.interval);
    };
    return Object.keys(archive || {})
      .filter((w) => archive[w].nextDue <= today)
      .sort((a, b) => late(b) - late(a) || migrateEntry(archive[a]).ease - migrateEntry(archive[b]).ease)
      .slice(0, max == null ? 8 : max);
  }

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
    pickSessionWords, planSession, Session, dailyMode,
    RETIRE_DAYS, RETIRE_STREAK, archiveEntry, migrateEntry, applyArchiveResult, dueArchive
  };
});
