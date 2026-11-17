/*
 * sound.js — Petits sons de l'appli.
 * Uniquement des sons positifs ou neutres : coup de pioche, bloc posé,
 * jingle de réussite, petit clic de tuile. Aucun son d'erreur.
 *
 * Si audio/sons/sons.json existe (bruitages générés par tools/make-sounds.js
 * avec ElevenLabs), les fichiers listés sont joués ; sinon, ou pour un son
 * absent, on garde les sons générés en Web Audio ci-dessous.
 */
(function (root) {
  'use strict';

  let ctx = null;
  let enabled = true;
  const buffers = {};   // nom → AudioBuffer (bruitage enregistré)
  let loading = false;

  function ac() {
    if (!ctx) {
      const C = root.AudioContext || root.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** Charge une seule fois les bruitages enregistrés, s'il y en a. */
  function loadRecorded() {
    if (loading || typeof fetch === 'undefined') return;
    loading = true;
    const c = ac(); if (!c) return;
    fetch('audio/sons/sons.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((names) => Promise.all((names || []).map((n) => fetch('audio/sons/' + n + '.mp3')
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((data) => new Promise((ok, ko) => c.decodeAudioData(data, ok, ko)))
        .then((buf) => { buffers[n] = buf; })
        .catch(() => {}))))
      .catch(() => {});
  }

  /** Joue le bruitage enregistré s'il est là ; renvoie false sinon. */
  function recorded(name, when, vol) {
    const c = ac();
    if (!c || !buffers[name]) return false;
    if (!enabled) return true;
    const src = c.createBufferSource();
    src.buffer = buffers[name];
    const g = c.createGain();
    g.gain.value = vol == null ? 0.8 : vol;
    src.connect(g).connect(c.destination);
    src.start(c.currentTime + (when || 0));
    return true;
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
    /** Débloque l'audio (à appeler sur un premier toucher) et charge les bruitages. */
    unlock() { ac(); loadRecorded(); },
    setEnabled(v) { enabled = !!v; },
    isEnabled() { return enabled; },
    tap() { if (!recorded('tap', 0, 0.6)) tone(660, 0.05, 0, 'triangle', 0.06); },
    hit(when) { if (!recorded('hit', when)) { noise(0.09, 1200, 0.5, when); tone(110, 0.06, when, 'square', 0.05); } },
    crack(when) { if (!recorded('crack', when)) noise(0.25, 2500, 0.45, when); },
    place() { if (!recorded('place')) { noise(0.07, 600, 0.6); tone(90, 0.08, 0, 'triangle', 0.08); } },
    /** Jingle de réussite : arpège montant do-mi-sol-do. */
    success() {
      if (!recorded('success')) [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, i * 0.09, 'square', 0.06));
    },
    /** Grand jingle de fin de séance. */
    fanfare() {
      if (recorded('fanfare')) return;
      [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, i * 0.12, 'square', 0.06));
      [196, 262, 330].forEach((f, i) => tone(f, 0.3, i * 0.28, 'triangle', 0.07));
    },
    /** Son très doux et neutre pour « on réessaie » (pas un son négatif). */
    soft() { if (!recorded('soft', 0, 0.5)) tone(440, 0.12, 0, 'triangle', 0.04); }
  };
})(self);
