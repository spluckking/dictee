// Tests : noms des fichiers de voix (js/audiokey.js) et présence des voix de la liste
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const AudioKey = require('../js/audiokey.js');
const Syllables = require('../js/syllables.js');

const ROOT = path.join(__dirname, '..');

function listWords() {
  return fs.readFileSync(path.join(ROOT, 'liste.txt'), 'utf8').split(/\r?\n/)
    .filter((l) => l.trim() && !/^\s*#/.test(l))
    .map((l) => { const [w, ...rest] = l.split('|'); return { w: w.trim(), sentence: rest.join('|').trim() }; });
}

test('nom de fichier stable et propre à chaque sorte', () => {
  assert.equal(AudioKey.file('mot', 'la grotte'), AudioKey.file('mot', 'la grotte'));
  assert.notEqual(AudioKey.file('mot', 'la grotte'), AudioKey.file('phrase', 'la grotte'));
  assert.match(AudioKey.file('mot', 'la grotte'), /^audio\/voix\/mot-[0-9a-z]+\.mp3$/);
});

test('apostrophe courbe, espaces et accents composés donnent le même fichier', () => {
  assert.equal(AudioKey.file('phrase', "À cette époque, il n’y avait"), AudioKey.file('phrase', "À  cette époque, il n'y avait "));
  assert.equal(AudioKey.file('mot', 'écrire'), AudioKey.file('mot', 'écrire'));
});

test('chaque mot de liste.txt a sa voix enregistrée (sinon : npm run voices)', () => {
  const missing = [];
  listWords().forEach(({ w, sentence }) => {
    const need = [AudioKey.file('mot', w)];
    if (sentence) need.push(AudioKey.file('phrase', sentence));
    const syl = Syllables.split(w).filter((s) => !/^[\s\-'’]*$/.test(s));
    if (syl.length > 1) need.push(AudioKey.file('syllabes', syl.join(' | ')));
    need.forEach((f) => { if (!fs.existsSync(path.join(ROOT, f))) missing.push(w + ' → ' + f); });
  });
  assert.deepEqual(missing, []);
});
