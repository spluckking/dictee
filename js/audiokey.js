/*
 * audiokey.js — Nom du fichier audio pré-enregistré d'un texte.
 *
 * Partagé entre l'appli (speech.js) et le script tools/make-voices.js :
 * les deux calculent le même nom à partir du même texte, sans index.
 *   kind : 'mot', 'phrase' ou 'syllabes'
 *   → 'audio/voix/mot-1k3x9ab2.mp3'
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AudioKey = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIR = 'audio/voix/';

  /** Texte ramené à une forme unique (accents composés, apostrophe droite, espaces). */
  function clean(text) {
    return String(text || '').normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  }

  /** Empreinte 53 bits (cyrb53), en base 36. */
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function file(kind, text) {
    return DIR + kind + '-' + hash(kind + ':' + clean(text)) + '.mp3';
  }

  return { DIR, clean, hash, file };
});
