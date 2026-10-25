// Tests : boîtes de Leitner, planification et séance (js/leitner.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/leitner.js');

// 2026-10-19 est un lundi, la dictée est le vendredi (5)
const MON = '2026-10-19', TUE = '2026-10-20', WED = '2026-10-21', THU = '2026-10-22', FRI = '2026-10-23';

test('jours avant la dictée du vendredi', () => {
  assert.equal(L.daysUntilDictation(5, MON), 4);
  assert.equal(L.daysUntilDictation(5, THU), 1);
  assert.equal(L.daysUntilDictation(5, FRI), 0);
  assert.equal(L.daysUntilDictation(5, '2026-10-24'), 6); // samedi
});

test('dates : ajout de jours et passage de mois', () => {
  assert.equal(L.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(L.diffDays(MON, FRI), 4);
});

test('réussite sans indice : le mot monte de boîte', () => {
  let s = L.applyResult(null, { correct: true, mode: 'flash', today: MON, daysLeft: 4 });
  assert.equal(s.box, 2);
  assert.equal(s.change, 'up');
  s = L.applyResult(s, { correct: true, mode: 'flash', today: TUE, daysLeft: 3 });
  assert.equal(s.box, 3);
  s = L.applyResult(s, { correct: true, mode: 'flash', today: WED, daysLeft: 2 });
  assert.equal(s.box, 3, 'on ne dépasse pas la boîte 3');
  assert.equal(s.success, 3);
});

test('réussite avec indice : le mot reste dans sa boîte', () => {
  const s = L.applyResult({ box: 2 }, { correct: true, usedHint: true, mode: 'flash', today: MON, daysLeft: 4 });
  assert.equal(s.box, 2);
  assert.equal(s.change, 'same');
  assert.equal(s.hinted, 1);
});

test('erreur : retour en boîte 1 et erreur mémorisée', () => {
  let s = L.applyResult({ box: 3 }, { correct: false, answer: 'chevaus', mode: 'flash', today: MON, daysLeft: 4 });
  assert.equal(s.box, 1);
  assert.equal(s.change, 'down');
  s = L.applyResult(s, { correct: false, answer: 'chevaus', mode: 'flash', today: MON, daysLeft: 4 });
  s = L.applyResult(s, { correct: false, answer: 'chevos', mode: 'flash', today: MON, daysLeft: 4 });
  assert.deepEqual(L.topErrors(s, 2), [{ answer: 'chevaus', count: 2 }, { answer: 'chevos', count: 1 }]);
});

test('reconnaissance (le bon mot, lettres) : plafonnée à la boîte 2', () => {
  let s = L.applyResult({ box: 2 }, { correct: true, mode: 'choix', today: MON, daysLeft: 4 });
  assert.equal(s.box, 2);
  s = L.applyResult({ box: 1 }, { correct: true, mode: 'lettres', today: MON, daysLeft: 4 });
  assert.equal(s.box, 2);
  // un mot déjà en boîte 3 n'est pas rétrogradé par une réussite en reconnaissance
  s = L.applyResult({ box: 3 }, { correct: true, mode: 'choix', today: MON, daysLeft: 4 });
  assert.equal(s.box, 3);
});

test('planification : intervalles plus longs quand la dictée est loin', () => {
  assert.equal(L.intervalFor(1, 6), 1);
  assert.equal(L.intervalFor(2, 6), 2);
  assert.equal(L.intervalFor(3, 6), 3);
  assert.equal(L.intervalFor(2, 2), 1);
  assert.equal(L.intervalFor(3, 2), 1);
});

test('planification : jamais après la veille de la dictée', () => {
  // samedi, dictée dans 6 jours (vendredi suivant) : boîte 3 → +3 jours (mardi)
  assert.equal(L.nextDueDate(3, '2026-10-24', 6), '2026-10-27');
  // mardi, dictée dans 3 jours : boîte 3 → +2 = jeudi (= la veille)
  assert.equal(L.nextDueDate(3, TUE, 3), THU);
  // mercredi, dictée dans 2 jours : tout revient jeudi
  assert.equal(L.nextDueDate(3, WED, 2), THU);
  assert.equal(L.nextDueDate(1, WED, 2), THU);
  // la veille et le jour même : lendemain
  assert.equal(L.nextDueDate(3, THU, 1), FRI);
});

test('mots à revoir : dus aujourd\'hui ou jamais vus', () => {
  assert.equal(L.isDue(undefined, MON), true);
  assert.equal(L.isDue({ nextDue: MON }, MON), true);
  assert.equal(L.isDue({ nextDue: TUE }, MON), false);
});

test('choix des mots : boîtes basses et mots souvent ratés d\'abord', () => {
  const words = ['a', 'b', 'c', 'd', 'e', 'f'];
  const progress = {
    a: { box: 3, fail: 0, nextDue: MON },
    b: { box: 1, fail: 1, nextDue: MON },
    c: { box: 1, fail: 4, nextDue: MON },
    d: { box: 2, fail: 0, nextDue: WED }, // pas dû
    e: { box: 2, fail: 0, nextDue: MON }
    // f jamais vu → dû, boîte 1
  };
  const list = L.pickSessionWords(words, progress, MON, 15);
  // 5 mots dus : pas besoin de compléter avec « d »
  assert.deepEqual(list, ['c', 'b', 'f', 'e', 'a']);
});

test('choix des mots : complète s\'il y a trop peu de mots dus', () => {
  const words = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const progress = {};
  words.forEach((w) => { progress[w] = { box: 3, fail: 0, nextDue: FRI }; });
  progress.a = { box: 1, fail: 0, nextDue: MON };
  const list = L.pickSessionWords(words, progress, MON, 15);
  assert.equal(list.length, 5);
  assert.equal(list[0], 'a');
});

test('séance : un mot raté revient 3 mots plus loin', () => {
  const s = new L.Session(['a', 'b', 'c', 'd', 'e'], { now: 0 });
  assert.equal(s.next(0), 'a');
  s.report('a', false);
  const order = [];
  let w;
  while ((w = s.next(0))) { order.push(w); s.report(w, true); }
  assert.deepEqual(order, ['b', 'c', 'd', 'a', 'e']);
});

test('séance : au plus 2 retours par mot', () => {
  const s = new L.Session(['a'], { now: 0 });
  let n = 0;
  while (s.next(0)) { n++; s.report('a', false); }
  assert.equal(n, 3);
});

test('séance courte : 15 mots ou 10 minutes', () => {
  const words = Array.from({ length: 30 }, (_, i) => 'm' + i);
  const s = new L.Session(words, { now: 0 });
  let n = 0;
  while (s.next(0)) { n++; s.report('x', true); }
  assert.equal(n, 15);
  const t = new L.Session(words, { now: 0 });
  assert.ok(t.next(60 * 1000));
  assert.equal(t.next(10 * 60 * 1000), null);
});

test('mode du jour : reconnaissance en début de semaine, production à la fin', () => {
  assert.equal(L.dailyMode(6), 'choix');
  assert.equal(L.dailyMode(4), 'choix');
  assert.equal(L.dailyMode(3), 'lettres');
  assert.equal(L.dailyMode(2), 'regarder');
  assert.equal(L.dailyMode(1), 'blanche');
  assert.equal(L.dailyMode(0), 'flash');
});

test('première séance : tous les mots, sans limite de nombre ni de durée', () => {
  const words = Array.from({ length: 22 }, (_, i) => 'm' + i);
  const plan = L.planSession(words, {}, MON, 15);
  assert.equal(plan.discovery, true);
  assert.equal(plan.words.length, 22);
  const s = new L.Session(plan.words, Object.assign({ now: 0 }, plan.options));
  let n = 0;
  while (s.next(60 * 60 * 1000)) { n++; s.report('x', true); }
  assert.equal(n, 22, 'les 22 mots passent, même après une heure');
});

test('ensuite : révisions espacées limitées à 15', () => {
  const words = Array.from({ length: 22 }, (_, i) => 'm' + i);
  const progress = {};
  words.forEach((w) => { progress[w] = { box: 1, fail: 0, lastSeen: MON, nextDue: TUE }; });
  const plan = L.planSession(words, progress, TUE, 15);
  assert.equal(plan.discovery, false);
  assert.equal(plan.words.length, 15);
  assert.equal(plan.options.maxAttempts, 15);
});

test('un mot ajouté en cours de semaine relance une séance complète, nouveau mot en tête', () => {
  const progress = { a: { box: 2, fail: 0, lastSeen: MON, nextDue: WED }, b: { box: 1, fail: 0, lastSeen: MON, nextDue: TUE } };
  const plan = L.planSession(['a', 'b', 'c'], progress, TUE, 15);
  assert.equal(plan.discovery, true);
  assert.deepEqual(plan.words, ['c', 'b', 'a']);
});

test('une seule montée de boîte par jour', () => {
  let s = L.applyResult(null, { correct: true, mode: 'flash', today: MON, daysLeft: 4 });
  assert.equal(s.box, 2);
  s = L.applyResult(s, { correct: true, mode: 'flash', today: MON, daysLeft: 4 });
  assert.equal(s.box, 2, 'pas de 2e montée le même jour');
  s = L.applyResult(s, { correct: true, mode: 'flash', today: TUE, daysLeft: 3 });
  assert.equal(s.box, 3);
});

test('auto-évaluation « j\'hésite » : réussite comptée, mais pas de montée', () => {
  const s = L.applyResult({ box: 1 }, { correct: true, unsure: true, mode: 'flash', today: MON, daysLeft: 4 });
  assert.equal(s.box, 1);
  assert.equal(s.success, 1);
  assert.equal(s.unsure, 1);
});

test('grande révision : 2, 7, 14, 30 jours puis retrait', () => {
  let e = L.archiveEntry({ box: 2 }, MON);
  assert.equal(e.level, 0);
  assert.equal(e.nextDue, L.addDays(MON, 2));
  assert.equal(L.archiveEntry({ box: 3 }, MON).nextDue, L.addDays(MON, 7), 'un mot su commence plus loin');
  let day = MON, r;
  const seen = [];
  for (let i = 0; i < 4; i++) {
    day = e.nextDue;
    r = L.applyArchiveResult(e, true, day);
    e = r.entry;
    seen.push(L.diffDays(day, e.nextDue || day));
  }
  assert.equal(r.retired, true);
  assert.deepEqual(seen.slice(0, 3), [7, 14, 30]);
});

test('grande révision : une erreur fait recommencer, revu le lendemain', () => {
  const r = L.applyArchiveResult({ level: 2, ok: 2, fail: 0, nextDue: MON }, false, MON);
  assert.equal(r.retired, false);
  assert.equal(r.entry.level, 0);
  assert.equal(r.entry.nextDue, TUE);
});

test('grande révision : au plus 5 mots dus, les plus en retard d\'abord', () => {
  const a = {};
  'abcdefg'.split('').forEach((w, i) => { a[w] = { level: 0, nextDue: L.addDays(MON, i - 6) }; });
  a.z = { level: 0, nextDue: FRI };
  assert.deepEqual(L.dueArchive(a, MON), ['a', 'b', 'c', 'd', 'e']);
  assert.ok(!L.dueArchive(a, MON, 10).includes('z'));
});
