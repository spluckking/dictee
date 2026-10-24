/*
 * speech.js — Lecture des mots avec la synthèse vocale du navigateur.
 * Choisit automatiquement une voix française (fr-FR de préférence),
 * débit ralenti (0,85). Le mot est lu, puis la phrase-contexte, comme en dictée.
 */
(function (root) {
  'use strict';

  const synth = root.speechSynthesis;
  let voice = null;

  function pickVoice() {
    if (!synth) return null;
    const voices = synth.getVoices();
    const fr = voices.filter((v) => /^fr/i.test(v.lang));
    // fr-FR d'abord, puis voix locales (hors ligne), puis Google
    fr.sort((a, b) => score(b) - score(a));
    voice = fr[0] || null;
    return voice;
  }

  function score(v) {
    let s = 0;
    if (/fr[-_]FR/i.test(v.lang)) s += 10;
    if (v.localService) s += 4;
    if (/google/i.test(v.name)) s += 2;
    if (v.default) s += 1;
    return s;
  }

  if (synth) {
    pickVoice();
    if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', pickVoice);
  }

  function utter(text, rate) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    if (voice || pickVoice()) u.voice = voice;
    u.rate = rate || 0.85;
    u.pitch = 1;
    return u;
  }

  /** Lit une liste de textes à la suite (annule ce qui était en cours). */
  function say(parts, rate) {
    if (!synth) return false;
    synth.cancel();
    parts.filter(Boolean).forEach((t) => synth.speak(utter(t, rate)));
    return true;
  }

  /** Dictée : le mot, puis la phrase-contexte si elle existe. */
  function dictate(word, sentence) {
    return say([word, sentence]);
  }

  root.Speech = {
    available: !!synth,
    say,
    dictate,
    stop() { if (synth) synth.cancel(); },
    voiceName() { const v = voice || pickVoice(); return v ? v.name + ' (' + v.lang + ')' : null; }
  };
})(self);
