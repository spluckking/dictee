// Tests : pièges d'orthographe et lieux (js/traps.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/traps.js');
const S = require('../js/syllables.js');

const parts = (w) => T.detect(w).traps.map((t) => t.place + ':' + w.slice(t.start, t.end));

test('lieu principal de quelques mots', () => {
  const cases = { "l'attention": 'tion', 'un serpent': 'muette', 'le doigt': 'muette', 'une femme': 'double',
    ensemble: 'mbp', 'hôpital': 'h', 'le rêve': 'accent', 'un oiseau': 'sons', 'la lune': 'simple', chevaux: 'muette' };
  for (const [w, p] of Object.entries(cases)) assert.equal(T.detect(w).place, p, w);
});

test('pièges repérés au bon endroit (article ignoré)', () => {
  assert.deepEqual(parts('un éléphant'), ['accent:é', 'accent:é', 'sons:ph', 'sons:an', 'muette:t']);
  assert.deepEqual(parts('le doigt'), ['sons:oi', 'muette:gt']);
  assert.ok(parts('une feuille').includes('sons:ill'));
  assert.ok(!parts('une feuille').some((p) => p.startsWith('double')), 'le ll de ill n\'est pas une lettre double');
  assert.ok(parts('pointer').includes('sons:er'));
});

test('ain / oin nasal seulement devant consonne', () => {
  assert.ok(parts('lointain').includes('sons:ain'));
  assert.ok(!parts('lointaine').includes('sons:ain'));
});

test('morceaux (fractionnement) : on retrouve le mot, syllabes et pièges marqués', () => {
  for (const w of ['un éléphant', "l'attention", 'ensemble', 'une feuille', 'printemps']) {
    const c = T.chunks(w, S.split(w));
    assert.equal(c.map((x) => x.text).join(''), w);
  }
  const c = T.chunks('pomme', S.split('pomme'));
  assert.deepEqual(c.map((x) => (x.sep ? '·' : '') + x.text), ['po', 'm', '·m', 'e']);
  assert.equal(c[1].trap, 'double');
});
