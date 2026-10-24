/*
 * sound.js — Petits sons générés en Web Audio (aucun fichier audio).
 * Uniquement des sons positifs ou neutres : coup de pioche, bloc posé,
 * jingle de réussite, petit clic de tuile. Aucun son d'erreur.
 */
(function (root) {
  'use strict';

  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) {
      const C = root.AudioContext || root.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** Bruit filtré très court : « toc » de bloc. */
  function noise(dur, freq, vol, when) {
    const c = ac(); if (!c || !enabled) return;
    const t = c.currentTime + (when || 0);
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  /** Note carrée ou triangle avec enveloppe douce. */
  function tone(freq, dur, when, type, vol) {
    const c = ac(); if (!c || !enabled) return;
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  root.Sound = {
    /** Débloque l'audio (à appeler sur un premier toucher). */
    unlock() { ac(); },
    setEnabled(v) { enabled = !!v; },
    isEnabled() { return enabled; },
    tap() { tone(660, 0.05, 0, 'triangle', 0.06); },
    hit(when) { noise(0.09, 1200, 0.5, when); tone(110, 0.06, when, 'square', 0.05); },
    crack(when) { noise(0.25, 2500, 0.45, when); },
    place() { noise(0.07, 600, 0.6); tone(90, 0.08, 0, 'triangle', 0.08); },
    /** Jingle de réussite : arpège montant do-mi-sol-do. */
    success() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, i * 0.09, 'square', 0.06));
    },
    /** Grand jingle de fin de séance. */
    fanfare() {
      [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, i * 0.12, 'square', 0.06));
      [196, 262, 330].forEach((f, i) => tone(f, 0.3, i * 0.28, 'triangle', 0.07));
    },
    /** Son très doux et neutre pour « on réessaie » (pas un son négatif). */
    soft() { tone(440, 0.12, 0, 'triangle', 0.04); }
  };
})(self);
