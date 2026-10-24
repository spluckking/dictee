// Tests : découpage en syllabes de l'indice (js/syllables.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/syllables.js');

test('découpage façon école', () => {
  const cases = {
    chevaux: 'che-vaux', maison: 'mai-son', beaucoup: 'beau-coup', toujours: 'tou-jours',
    'hôpital': 'hô-pi-tal', pomme: 'pom-me', ensemble: 'en-sem-ble', bateau: 'ba-teau',
    'forêt': 'fo-rêt', printemps: 'prin-temps', 'école': 'é-co-le', guitare: 'gui-ta-re',
    champignon: 'cham-pi-gnon', tableau: 'ta-bleau'
  };
  for (const [w, s] of Object.entries(cases)) assert.equal(S.split(w).join('-'), s, w);
});

test('mot d\'une seule syllabe', () => {
  assert.deepEqual(S.split('lit'), ['lit']);
});
