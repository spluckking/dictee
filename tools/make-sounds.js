#!/usr/bin/env node
/*
 * make-sounds.js — Génère les bruitages de l'appli avec ElevenLabs (Sound Effects).
 *
 * Usage :  npm run sounds              (ne crée que les sons manquants)
 *          npm run sounds -- --force   (refait tous les sons)
 *          npm run sounds -- tap hit   (refait seulement ces sons)
 *
 * Lit ELEVENLABS_API_KEY dans .env (jamais commité).
 * Écrit audio/sons/<nom>.mp3 et audio/sons/sons.json (liste des sons présents,
 * lue par js/sound.js ; sans ce fichier, l'appli garde ses sons Web Audio).
 * Règle de l'appli : uniquement des sons positifs ou neutres, aucun son d'erreur.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'audio', 'sons');

// Descriptions en anglais (ElevenLabs les comprend mieux). Durée en secondes.
const SOUNDS = {
  tap: { text: 'Soft short wooden click, a small letter tile tapped on a table, cheerful game UI sound', duration: 0.5 },
  hit: { text: 'Loud single pickaxe strike hitting a stone block, sharp clear knock, cartoon video game sound effect', duration: 0.8 },
  crack: { text: 'Stone block breaking and crumbling into small pebbles, short, satisfying, cartoon video game', duration: 0.8 },
  place: { text: 'Wooden block placed down with a soft thud, short, satisfying building game sound', duration: 0.5 },
  success: { text: 'Short happy rising chime jingle, four bright notes, children video game success', duration: 1.2 },
  fanfare: { text: 'Joyful short victory fanfare with sparkles, treasure chest opening, children video game', duration: 2.5 },
  soft: { text: 'Very soft gentle neutral bubble pop, calm and kind, not negative', duration: 0.5 }
};

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

async function generate(name, spec, key) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({ text: spec.text, duration_seconds: spec.duration, prompt_influence: 0.6 })
  });
  if (!res.ok) throw new Error('ElevenLabs a répondu ' + res.status + ' pour « ' + name + ' » : ' + (await res.text()).slice(0, 200));
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter((a) => !a.startsWith('--'));
  const unknown = only.filter((n) => !SOUNDS[n]);
  if (unknown.length) { console.error('Sons inconnus : ' + unknown.join(', ') + '. Sons possibles : ' + Object.keys(SOUNDS).join(', ')); process.exit(1); }
  const env = readEnv();
  if (!env.ELEVENLABS_API_KEY) { console.error('ELEVENLABS_API_KEY manque dans .env.'); process.exit(1); }
  fs.mkdirSync(DIR, { recursive: true });
  const names = (only.length ? only : Object.keys(SOUNDS))
    .filter((n) => force || only.length || !fs.existsSync(path.join(DIR, n + '.mp3')));
  let failed = 0;
  for (const n of names) {
    try {
      fs.writeFileSync(path.join(DIR, n + '.mp3'), await generate(n, SOUNDS[n], env.ELEVENLABS_API_KEY));
      console.log('  ✔ ' + n);
    } catch (e) { failed++; console.error('  ✖ ' + e.message); }
  }
  const present = Object.keys(SOUNDS).filter((n) => fs.existsSync(path.join(DIR, n + '.mp3')));
  fs.writeFileSync(path.join(DIR, 'sons.json'), JSON.stringify(present) + '\n');
  console.log(present.length + ' sons dans audio/sons/' + (failed ? ', ' + failed + ' échecs.' : '.'));
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
