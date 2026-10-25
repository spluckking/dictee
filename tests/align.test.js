// Tests : alignement des lettres et coloration des erreurs (js/align.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/align.js');

const ops = (got, exp) => A.align(got, exp).map((o) => o.op);

test('levenshtein : distances de base', () => {
  assert.equal(A.levenshtein('chevaux', 'chevaux'), 0);
  assert.equal(A.levenshtein('chevaus', 'chevaux'), 1);
  assert.equal(A.levenshtein('chevos', 'chevaux'), 3);
  assert.equal(A.levenshtein('', 'pomme'), 5);
  assert.equal(A.levenshtein('pome', 'pomme'), 1);
});

test('mot juste : toutes les lettres en vert', () => {
  const r = A.grade('bateau', 'bateau');
  assert.equal(r.correct, true);
  assert.ok(r.ops.every((o) => o.op === 'ok'));
});

test('lettre oubliée : marquée « missing » à la bonne place', () => {
  assert.deepEqual(ops('pome', 'pomme').filter((o) => o !== 'ok'), ['missing']);
  const r = A.align('beaucou', 'beaucoup');
  assert.equal(r[r.length - 1].op, 'missing');
  assert.equal(r[r.length - 1].expected, 'p');
});

test('lettre fausse : substitution alignée', () => {
  const r = A.align('chevaus', 'chevaux');
  assert.deepEqual(r.map((o) => o.op), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'sub']);
  assert.equal(r[6].got, 's');
  assert.equal(r[6].expected, 'x');
});

test('lettre en trop : marquée « extra »', () => {
  const r = A.align('maisson', 'maison');
  assert.equal(r.filter((o) => o.op === 'extra').length, 1);
  assert.equal(r.filter((o) => o.op === 'ok').length, 6);
});

test('chevos / chevaux : début juste, fin à revoir', () => {
  const r = A.align('chevos', 'chevaux');
  assert.deepEqual(r.slice(0, 4).map((o) => o.op), ['ok', 'ok', 'ok', 'ok']);
  // les lettres du mot correct sont toutes présentes, dans l'ordre
  assert.equal(r.map((o) => o.expected).join(''), 'chevaux');
  assert.equal(r.map((o) => o.got).join(''), 'chevos');
});

test('erreur d\'accent seulement : « Presque ! Regarde l\'accent »', () => {
  const r = A.grade('foret', 'forêt');
  assert.equal(r.correct, false);
  assert.equal(r.accentOnly, true);
  assert.deepEqual(r.ops.map((o) => o.op), ['ok', 'ok', 'ok', 'accent', 'ok']);
  assert.equal(A.grade('hopital', 'hôpital').accentOnly, true);
  assert.equal(A.grade('ècole', 'école').accentOnly, true);
});

test('une vraie faute n\'est pas une erreur d\'accent', () => {
  assert.equal(A.grade('forê', 'forêt').accentOnly, false);
  assert.equal(A.grade('', 'forêt').accentOnly, false);
});

test('normalisation : espaces, majuscule du clavier, forme Unicode', () => {
  assert.equal(A.grade('  Pomme ', 'pomme').correct, true);
  assert.equal(A.grade('forêt', 'forêt').correct, true); // ê décomposé
  assert.equal(A.grade('aujourd’hui', "aujourd'hui").correct, true);
  // un nom propre garde sa majuscule
  assert.equal(A.grade('paris', 'Paris').correct, false);
});

test('reconstruction : la ligne « mot juste » redonne toujours le mot', () => {
  for (const [g, e] of [['', 'ensemble'], ['ansanble', 'ensemble'], ['prinptemps', 'printemps'], ['xyz', 'bateau']]) {
    const r = A.align(g, e);
    assert.equal(r.map((o) => o.expected).join(''), e);
    assert.equal(r.map((o) => o.got).join(''), g);
  }
});

test('déterminant facultatif : « jungle » accepté pour « la jungle »', () => {
  assert.equal(A.grade('jungle', 'la jungle').correct, true);
  assert.equal(A.grade('la jungle', 'la jungle').correct, true);
  assert.equal(A.grade('attention', "l'attention").correct, true);
  assert.equal(A.grade("l’attention", "l'attention").correct, true);
  assert.equal(A.grade('éléphant', 'un éléphant').correct, true);
  // l'alignement se fait alors sur le mot seul
  const r = A.grade('elephant', 'un éléphant');
  assert.equal(r.accentOnly, true);
  assert.equal(r.target, 'éléphant');
  // un mauvais déterminant reste une erreur
  assert.equal(A.grade('le jungle', 'la jungle').correct, false);
  // mot sans déterminant : inchangé
  assert.equal(A.grade('entre', 'entre').correct, true);
  assert.deepEqual(A.splitDeterminer('une femme'), { det: 'une', core: 'femme' });
  assert.deepEqual(A.splitDeterminer("l'attention"), { det: "l'", core: 'attention' });
  assert.deepEqual(A.splitDeterminer('lointain'), { det: '', core: 'lointain' });
});
