// Tests : génération des fausses orthographes (js/distractors.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/distractors.js');

// Générateur pseudo-aléatoire fixe pour des tests reproductibles
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

test('finale muette : s / x / t', () => {
  const c = D.candidates('chevaux');
  assert.ok(c.finale.includes('chevaus'));
  assert.ok(c.finale.includes('chevau'));
  assert.ok(D.candidates('chat').finale.includes('cha'));
  assert.ok(D.candidates('souris').finale.includes('souri'));
});

test('doublement de consonne (et simplification)', () => {
  assert.ok(D.candidates('pomme').double.includes('pome'));
  assert.ok(D.candidates('bateau').double.includes('batteau'));
});

test('accents', () => {
  assert.ok(D.candidates('forêt').accent.includes('forèt'));
  assert.ok(D.candidates('école').accent.includes('ecole'));
  assert.ok(D.candidates('hôpital').accent.includes('hopital'));
});

test('ê / è / ai', () => {
  assert.ok(D.candidates('maison').ai.includes('mèson'));
  assert.ok(D.candidates('forêt').ai.includes('forait'));
});

test('o / au / eau', () => {
  const c = D.candidates('bateau').o;
  assert.ok(c.includes('bato'));
  assert.ok(c.includes('batau'));
  assert.ok(D.candidates('vélo').o.includes('véleau'));
  assert.ok(D.candidates('jaune').o.includes('jone'));
});

test('m devant m, b, p', () => {
  assert.ok(D.candidates('ensemble').mbp.includes('ensenble'));
  assert.ok(D.candidates('jambe').mbp.includes('janbe'));
});

test('generate : n distracteurs distincts, jamais le mot juste', () => {
  const words = ['chevaux', 'maison', 'beaucoup', 'toujours', 'hôpital', 'pomme', 'ensemble', 'bateau', 'forêt', 'printemps', 'lit', 'ami', 'page'];
  for (let seed = 1; seed < 40; seed++) {
    for (const w of words) {
      const d = D.generate(w, 2, rng(seed));
      assert.equal(d.length, 2, w);
      assert.notEqual(d[0], d[1], w);
      assert.ok(!d.includes(w), w);
    }
  }
});

test('generate : varie les règles quand c\'est possible', () => {
  const byRule = D.candidates('bateau');
  const ruleOf = (v) => Object.keys(byRule).find((k) => byRule[k].includes(v));
  for (let seed = 1; seed < 20; seed++) {
    const [a, b] = D.generate('bateau', 2, rng(seed));
    assert.notEqual(ruleOf(a), ruleOf(b));
  }
});

test('generate : reproductible avec le même générateur', () => {
  assert.deepEqual(D.generate('printemps', 2, rng(7)), D.generate('printemps', 2, rng(7)));
});
