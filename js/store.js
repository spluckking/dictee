/*
 * store.js — Toutes les données de l'appli, dans localStorage (aucun serveur).
 *
 * Structure :
 * {
 *   version: 1,
 *   words: [{ w: 'chevaux', sentence: 'Les chevaux…', review: false }],
 *   dictationDay: 5,                 // 0 = dimanche … 5 = vendredi
 *   weekStart: 'AAAA-MM-JJ',
 *   progress: { mot: étatLeitner },  // voir leitner.js
 *   blanche: [{ date, score, total }],
 *   world: { blocks: ['terre', 'pierre', …] },   // blocs posés, dans l'ordre
 *   settings: { sound: true, cursive: false, input: 'clavier' | 'tuiles' },
 *   stats: { lastDay, sessionsToday }
 * }
 */
(function (root) {
  'use strict';

  const KEY = 'dicteeMot.v1';

  /** Liste d'exemple : 10 mots de CE2 avec leur phrase de dictée. */
  const SAMPLE = [
    'chevaux | Les chevaux galopent dans le pré.',
    'maison | Ma maison a un grand jardin.',
    'beaucoup | Il y a beaucoup de feuilles par terre.',
    'toujours | Mon chat dort toujours près de la fenêtre.',
    'hôpital | Le docteur travaille à l\'hôpital.',
    'pomme | Je croque une pomme bien rouge.',
    'ensemble | Nous chantons ensemble à la chorale.',
    'bateau | Le bateau glisse sur la mer.',
    'forêt | Les écureuils vivent dans la forêt.',
    'printemps | Au printemps, les fleurs poussent.'
  ].join('\n');

  /** Lit le texte collé par le parent : « mot | phrase », un par ligne. */
  function parseList(text) {
    const seen = {};
    return String(text || '').split(/\r?\n/).map((line) => {
      const [w, ...rest] = line.split('|');
      return { w: (w || '').normalize('NFC').replace(/\s+/g, ' ').trim(), sentence: rest.join('|').trim() };
    }).filter((x) => x.w && !seen[x.w] && (seen[x.w] = true));
  }

  function listToText(words) {
    return words.filter((x) => !x.review)
      .map((x) => x.sentence ? x.w + ' | ' + x.sentence : x.w).join('\n');
  }

  function defaults() {
    return {
      version: 1,
      words: parseList(SAMPLE),
      dictationDay: 5,
      weekStart: Leitner.todayStr(),
      progress: {},
      blanche: [],
      world: { blocks: [] },
      settings: { sound: true, cursive: false, input: 'clavier' },
      stats: { lastDay: null, sessionsToday: 0 }
    };
  }

  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const saved = raw ? JSON.parse(raw) : null;
      const d = defaults();
      state = saved && saved.version === 1 ? Object.assign(d, saved, {
        settings: Object.assign(d.settings, saved.settings),
        world: Object.assign(d.world, saved.world),
        stats: Object.assign(d.stats, saved.stats)
      }) : d;
    } catch (e) {
      state = defaults();
    }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* stockage plein ou privé */ }
  }

  function get() { return state || load(); }

  /** Mots de la séance : liste de la semaine + mots gardés en révision. */
  function allWords() { return get().words.map((x) => x.w); }

  function findWord(w) { return get().words.find((x) => x.w === w); }

  /** Remplace la liste (mode parent) en gardant la progression des mots inchangés. */
  function setList(text) {
    const s = get();
    const reviews = s.words.filter((x) => x.review);
    const fresh = parseList(text);
    const names = fresh.map((x) => x.w);
    s.words = fresh.concat(reviews.filter((x) => names.indexOf(x.w) < 0));
    save();
  }

  /** Mots « ratés » : pas encore en boîte 3 (proposés en révision la semaine suivante). */
  function missedWords() {
    const s = get();
    return s.words.filter((x) => {
      const p = s.progress[x.w];
      return !p || p.box < 3;
    }).map((x) => x.w);
  }

  /** Nouvelle semaine : nouvelle liste, progression remise à zéro. Le monde est conservé. */
  function newWeek(text, keepMissed) {
    const s = get();
    const kept = keepMissed ? missedWords().map((w) => {
      const o = findWord(w);
      return { w, sentence: o ? o.sentence : '', review: true };
    }) : [];
    const fresh = parseList(text);
    const names = fresh.map((x) => x.w);
    s.words = fresh.concat(kept.filter((x) => names.indexOf(x.w) < 0));
    s.progress = {};
    s.blanche = [];
    s.weekStart = Leitner.todayStr();
    save();
  }

  function addBlocks(list) {
    const s = get();
    s.world.blocks = s.world.blocks.concat(list);
    save();
  }

  root.Store = { KEY, SAMPLE, parseList, listToText, load, save, get, allWords, findWord,
    setList, missedWords, newWeek, addBlocks };
})(self);
