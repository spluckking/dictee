#!/usr/bin/env node
/*
 * make-voices.js — Enregistre la voix Denise (Azure, fr-FR-DeniseNeural)
 * pour tous les mots, phrases et découpages en syllabes.
 *
 * Usage :  npm run voices            (ne crée que les fichiers manquants)
 *          npm run voices -- --force (refait tout, par ex. après un changement de débit)
 *          npm run voices -- --dry   (montre ce qui serait créé, sans appeler Azure)
 *
 * Lit AZURE_SPEECH_KEY et AZURE_SPEECH_REGION dans .env (jamais commité).
 * Mots pris dans : liste.txt, toutes ses anciennes versions dans l'historique git
 * (les mots de la mine des souvenirs), et la liste d'exemple de l'appli.
 * Les fichiers vont dans audio/voix/, nommés par js/audiokey.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const AudioKey = require('../js/audiokey.js');
const Syllables = require('../js/syllables.js');
globalThis.self = globalThis.self || {};
require('../js/store.js'); // pour parseList et la liste d'exemple
const Store = globalThis.self.Store;

const VOICE = 'fr-FR-DeniseNeural';
// Débit : le mot un peu posé, la phrase à vitesse naturelle, les syllabes lentement.
const PROSODY = {
  mot: { rate: '-10%' },
  phrase: { rate: '0%' },
  syllabes: { rate: '-15%' }
};
const SYLLABLE_BREAK = '350ms';

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY = args.includes('--dry');

function readEnv() {
  const env = {};
  const f = path.join(ROOT, '.env');
  if (fs.existsSync(f)) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  }
  return Object.assign(env, process.env);
}

function listTexts() {
  const texts = [fs.readFileSync(path.join(ROOT, 'liste.txt'), 'utf8'), Store.SAMPLE];
  try {
    const hashes = execSync('git log --format=%H -- liste.txt', { cwd: ROOT }).toString().split(/\s+/).filter(Boolean);
    hashes.forEach((h) => {
      try { texts.push(execSync('git show ' + h + ':liste.txt', { cwd: ROOT }).toString()); } catch (e) { /* fichier absent à ce commit */ }
    });
  } catch (e) {
    console.warn('Historique git indisponible : seule la liste actuelle est enregistrée.');
  }
  return texts;
}

/** Tous les morceaux à enregistrer, sans doublon : { kind, key, ssmlBody }. */
function collect() {
  const jobs = {};
  const add = (kind, key, body) => {
    const file = AudioKey.file(kind, key);
    if (!jobs[file]) jobs[file] = { kind, key, body, file };
  };
  listTexts().forEach((text) => {
    Store.parseList(text).forEach(({ w, sentence }) => {
      add('mot', w, esc(AudioKey.clean(w)));
      if (sentence) add('phrase', sentence, esc(AudioKey.clean(sentence)));
      const syl = Syllables.split(w).filter((s) => !/^[\s\-'’]*$/.test(s));
      if (syl.length > 1) {
        add('syllabes', syl.join(' | '), syl.map(esc).join('<break time="' + SYLLABLE_BREAK + '"/>'));
      }
    });
  });
  add('mot', 'chevaux', 'chevaux'); // bouton « tester la voix »
  return Object.values(jobs);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ssml(job) {
  return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">' +
    '<voice name="' + VOICE + '"><prosody rate="' + PROSODY[job.kind].rate + '">' + job.body +
    '</prosody></voice></speak>';
}

async function synth(job, env) {
  const url = 'https://' + env.AZURE_SPEECH_REGION + '.tts.speech.microsoft.com/cognitiveservices/v1';
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'dictee-blocs-tools'
      },
      body: ssml(job)
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
    throw new Error('Azure a répondu ' + res.status + ' ' + res.statusText + ' pour « ' + job.key + ' »');
  }
  throw new Error('Azure ne répond pas (trop de tentatives) pour « ' + job.key + ' »');
}

async function main() {
  const env = readEnv();
  const jobs = collect();
  const todo = jobs.filter((j) => FORCE || !fs.existsSync(path.join(ROOT, j.file)));
  const chars = todo.reduce((n, j) => n + j.key.length, 0);
  console.log(jobs.length + ' enregistrements au total, ' + todo.length + ' à créer (≈ ' + chars + ' caractères).');
  if (DRY || !todo.length) { todo.forEach((j) => console.log('  ' + j.kind + ' : ' + j.key)); return; }
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
    console.error('AZURE_SPEECH_KEY et AZURE_SPEECH_REGION manquent dans .env.');
    process.exit(1);
  }
  fs.mkdirSync(path.join(ROOT, AudioKey.DIR), { recursive: true });
  let done = 0, failed = 0;
  const queue = todo.slice();
  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      try {
        fs.writeFileSync(path.join(ROOT, job.file), await synth(job, env));
        done++;
      } catch (e) {
        failed++;
        console.error('  ✖ ' + e.message);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  console.log(done + ' fichiers créés dans ' + AudioKey.DIR + (failed ? ', ' + failed + ' échecs.' : '.'));
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
