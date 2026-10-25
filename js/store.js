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
 *   archive: { mot: { interval, ease, streak, nextDue, sentence, week, ok, fail } }, // phase 2 : la mine
 *   daily: { day, words, ok, done },  // révision du jour (phase 1) : tous les mots, une récompense
 *   mine: { depth, found: [{ id, depth, date }], week, exp: { day, words, ok, done } }, // phase 2
 *   retired: [{ w, week, date }],    // mots sus pour toujours (sortis de la mine)
 *   settings: { sound, cursive, input: 'clavier' | 'tuiles', stylusDirect: false (true = pas de clavier virtuel automatique) },
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
    return String(text || '').split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).map((line) => {
      const [w, ...rest] = line.split('|');
      return { w: (w || '').normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim(), sentence: rest.join('|').trim() };
    }).filter((x) => x.w && !seen[x.w] && (seen[x.w] = true));
  }

  /** Titre d'une liste publiée : première ligne « # Titre ». */
  function listTitle(text) {
    const m = String(text || '').match(/^\s*#\s*(.+)$/m);
    return m ? m[1].trim() : '';
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
      archive: {},
      retired: [],
      daily: { day: null, words: [], ok: [], done: false },
      mine: { depth: 0, found: [], week: null, exp: { day: null, words: [], ok: [], done: false } },
      settings: { sound: true, cursive: false, input: 'clavier', stylusDirect: false },
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
        stats: Object.assign(d.stats, saved.stats),
        mine: Object.assign(d.mine, saved.mine),
        daily: Object.assign(d.daily, saved.daily)
      }) : d;
      if (!state.mine.exp) state.mine.exp = d.mine.exp;
      // anciennes entrées de la grande révision (paliers fixes) → mémoire par mot
      Object.keys(state.archive).forEach((w) => { state.archive[w] = Leitner.migrateEntry(state.archive[w]); });
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

  function findWord(w) {
    const s = get();
    const x = s.words.find((y) => y.w === w);
    if (x) return x;
    const a = s.archive[w];
    return a ? { w, sentence: a.sentence || '', archived: true } : undefined;
  }

  /** Remplace la liste (mode parent) en gardant la progression des mots inchangés. */
  function setList(text) {
    const s = get();
    const reviews = s.words.filter((x) => x.review);
    const fresh = parseList(text);
    const names = fresh.map((x) => x.w);
    s.words = fresh.concat(reviews.filter((x) => names.indexOf(x.w) < 0));
    save();
  }

  /** Mots de la semaine pas encore en boîte 3. */
  function missedWords() {
    const s = get();
    return s.words.filter((x) => {
      const p = s.progress[x.w];
      return !p || p.box < 3;
    }).map((x) => x.w);
  }

  /**
   * Nouvelle semaine : nouvelle liste, progression remise à zéro. Le monde est
   * conservé. Si `archiveOld`, les mots de la semaine qui se termine passent
   * dans la mine des souvenirs (phase 2), sauf ceux qui reviennent dans la nouvelle liste.
   */
  function newWeek(text, archiveOld) {
    const s = get();
    const today = Leitner.todayStr();
    const fresh = parseList(text);
    const names = fresh.map((x) => x.w);
    if (archiveOld) {
      s.words.forEach((x) => {
        if (names.indexOf(x.w) >= 0 || s.archive[x.w]) return;
        s.archive[x.w] = Leitner.archiveEntry(s.progress[x.w], today,
          { sentence: x.sentence || '', week: s.listTitle || '' });
      });
    }
    names.forEach((w) => { delete s.archive[w]; });
    s.words = fresh;
    s.progress = {};
    s.blanche = [];
    s.daily = { day: null, words: [], ok: [], done: false };
    s.weekStart = today;
    save();
  }

  function addBlocks(list) {
    const s = get();
    s.world.blocks = s.world.blocks.concat(list);
    save();
  }

  root.Store = { KEY, SAMPLE, parseList, listToText, load, save, get, allWords, findWord,
    setList, missedWords, newWeek, addBlocks, listTitle };
})(self);
