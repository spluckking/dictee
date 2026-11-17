/*
 * speech.js — Lecture des mots.
 *
 * Voix principale : Denise (Azure, fr-FR-DeniseNeural), enregistrée à l'avance
 * dans audio/voix/ par tools/make-voices.js (un fichier par mot, par phrase et
 * par découpage en syllabes, nommé par AudioKey). Les fichiers sont lus avec un
 * débit naturel : le mot un peu posé, la phrase à vitesse normale.
 *
 * Secours : si un fichier manque (mot ajouté à la main dans l'espace parent,
 * hors ligne sans cache…), la synthèse vocale du navigateur prend le relais.
 */
(function (root) {
  'use strict';

  const synth = root.speechSynthesis;
  const PAUSE_MS = 450; // silence entre le mot et sa phrase, comme en classe
  let voice = null;

  /* ---------- Secours : synthèse du navigateur ---------- */

  function pickVoice() {
    if (!synth) return null;
    const fr = synth.getVoices().filter((v) => /^fr/i.test(v.lang));
    fr.sort((a, b) => score(b) - score(a));
    voice = fr[0] || null;
    return voice;
  }

  function score(v) {
    let s = 0;
    if (/fr[-_]FR/i.test(v.lang)) s += 10;
    if (/denise/i.test(v.name)) s += 6;
    if (/natural|neural|online/i.test(v.name)) s += 3;
    if (/google/i.test(v.name)) s += 2;
    if (v.localService) s += 1;
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
    u.rate = rate || 0.95;
    u.pitch = 1;
    return u;
  }

  /** Lit des textes avec la synthèse du navigateur ; se résout à la fin. */
  function speakSynth(parts, rate, my) {
    return new Promise((resolve) => {
      parts = parts.filter(Boolean);
      if (!synth || !parts.length || my !== token) return resolve();
      let left = parts.length;
      const done = () => { if (--left <= 0) resolve(); };
      parts.forEach((t) => {
        const u = utter(t, rate);
        u.onend = done; u.onerror = done;
        synth.speak(u);
      });
      // garde-fou : certains navigateurs n'envoient jamais « end »
      setTimeout(resolve, 1500 + parts.join(' ').length * 120);
    });
  }

  /* ---------- Voix enregistrée ---------- */

  const files = {}; // chemin → Promise<URL d'un blob | null>
  let recorded = null; // true dès qu'un fichier a été lu (pour l'espace parent)

  function load(path) {
    if (!files[path]) {
      files[path] = fetch(path)
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => (b && b.size ? URL.createObjectURL(b) : null))
        .catch(() => null)
        .then((url) => { if (!url) delete files[path]; else recorded = true; return url; });
    }
    return files[path];
  }

  let token = 0;   // change à chaque nouvelle lecture : annule la précédente
  let audio = null;

  function playUrl(url, my) {
    return new Promise((resolve) => {
      if (my !== token) return resolve(true);
      const a = audio = new Audio(url);
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      const p = a.play();
      if (p && p.catch) p.catch(() => resolve(false));
    });
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Lit une suite de morceaux : { kind, key, say: [textes de secours], rate }.
   * Chaque morceau est le fichier enregistré s'il existe, sinon la synthèse.
   */
  async function play(parts) {
    stop();
    const my = token;
    parts = parts.filter((p) => p && p.key);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i > 0) await wait(PAUSE_MS);
      if (my !== token) return;
      const url = await load(AudioKey.file(p.kind, p.key));
      if (my !== token) return;
      const ok = url ? await playUrl(url, my) : false;
      if (my !== token) return;
      if (!ok) await speakSynth(p.say, p.rate, my);
    }
  }

  function stop() {
    token++;
    if (audio) { audio.pause(); audio = null; }
    if (synth) synth.cancel();
  }

  /** Syllabes à lire (sans les espaces ni les traits d'union isolés). */
  function syllableParts(syllables) {
    return (syllables || []).filter((s) => !/^[\s\-'’]*$/.test(s));
  }

  /* ---------- API ---------- */

  /** Dictée : le mot, puis la phrase-contexte si elle existe. */
  function dictate(word, sentence) {
    play([
      { kind: 'mot', key: word, say: [word], rate: 0.9 },
      sentence ? { kind: 'phrase', key: sentence, say: [sentence], rate: 1 } : null
    ]);
    return true;
  }

  /** La phrase seule (indice du mode « Le bon mot »). */
  function sentence(text) {
    play([{ kind: 'phrase', key: text, say: [text], rate: 1 }]);
  }

  /** Le mot lentement, syllabe par syllabe (indice). */
  function syllables(word, syl) {
    const parts = syllableParts(syl);
    if (parts.length < 2) return dictate(word, '');
    play([{ kind: 'syllabes', key: parts.join(' | '), say: parts, rate: 0.7 }]);
  }

  /** Télécharge à l'avance la voix des mots de la semaine (et la met en cache pour le hors-ligne). */
  function preload(words) {
    (words || []).forEach((x, i) => setTimeout(() => {
      load(AudioKey.file('mot', x.w));
      if (x.sentence) load(AudioKey.file('phrase', x.sentence));
    }, i * 80));
  }

  /** Lecture directe par la synthèse du navigateur (gardé pour compatibilité). */
  function say(parts, rate) {
    stop();
    speakSynth(parts, rate, token);
    return !!synth;
  }

  root.Speech = {
    available: !!synth || typeof Audio !== 'undefined',
    say, dictate, sentence, syllables, preload, stop, syllableParts,
    voiceName() {
      const v = voice || pickVoice();
      const backup = v ? v.name + ' (' + v.lang + ')' : 'aucune voix française trouvée';
      return (recorded === true ? 'Denise (Azure, enregistrée)' : 'Denise (Azure) si les fichiers sont présents') +
        ' · secours : ' + backup;
    }
  };
})(self);
