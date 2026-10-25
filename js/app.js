/*
 * app.js — Écrans et modes de jeu.
 *
 * Écrans : accueil, jeu, fin de séance, mon monde, question parent, parent.
 * Modes  : flash (dictée-flash), regarder (regarder-cacher-écrire),
 *          lettres (lettres mélangées), choix (le bon mot), blanche (dictée blanche).
 *
 * Déroulé d'un mot (sauf dictée blanche) :
 *   (fiche d'étude si le mot est nouveau) → présentation → saisie
 *   → confirmation + auto-évaluation (« Sûr de moi » / « J'hésite ») → correction
 *   → si erreur : l'enfant regarde le mot, il est caché, il le réécrit de mémoire.
 *
 * Méthodes mélangées : répétition espacée (leitner.js), rappel actif et
 * auto-évaluation, palais mental + fractionnement + carte mentale (traps.js),
 * et phase 2 « grande révision » des semaines passées.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const MODES = {
    flash: 'Dictée-flash',
    regarder: 'Regarder, cacher, écrire',
    lettres: 'Lettres mélangées',
    choix: 'Le bon mot',
    blanche: 'Dictée blanche'
  };
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const BRAVO = ['Bravo !', 'Super !', 'Génial !', 'Bien joué !', 'Excellent !', 'Parfait !'];

  let S = Store.load();
  let sceneHome = null, sceneGame = null, sceneEnd = null;

  /* ---------------- Outils ---------------- */

  function today() { return Leitner.todayStr(); }
  function daysLeft() { return Leitner.daysUntilDictation(S.dictationDay, today()); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function show(node, yes) { node.hidden = !yes; }

  function showScreen(name) {
    $$('.ecran').forEach((s) => show(s, s.id === 'ecran-' + name));
    window.scrollTo(0, 0);
    if (sceneHome) sceneHome.stop();
    if (sceneEnd) sceneEnd.stop();
    if (name !== 'jeu' && sceneGame) sceneGame.stop();
    Speech.stop();
  }

  function applySettings() {
    document.body.classList.toggle('cursive', !!S.settings.cursive);
    Sound.setEnabled(S.settings.sound);
    $$('[data-action="son"]').forEach((b) => { b.textContent = S.settings.sound ? '🔊' : '🔇'; });
  }

  /* ---------------- Accueil ---------------- */

  function renderHome() {
    showScreen('accueil');
    const d = daysLeft();
    const jour = JOURS[S.dictationDay];
    $('#compte-a-rebours').textContent =
      d === 0 ? "C'est aujourd'hui, la dictée ! Un dernier petit entraînement ?" :
      d === 1 ? 'Demain, c\'est la dictée !' :
      'Dictée ' + jour + ' : dans ' + d + ' jours';
    const words = Store.allWords();
    const due = words.filter((w) => Leitner.isDue(S.progress[w], today())).length;
    const su = words.filter((w) => S.progress[w] && S.progress[w].box === 3).length;
    $('#resume-mots').textContent = (S.listTitle ? S.listTitle + ' · ' : '') + words.length + ' mots cette semaine · ' + su + ' déjà sus · ' +
      (due ? due + ' à revoir aujourd\'hui' : 'tout est revu pour aujourd\'hui !');
    const nArch = Object.keys(S.archive || {}).length;
    const dueArch = Leitner.dueArchive(S.archive, today(), 99).length;
    $('#resume-revision').textContent = nArch
      ? 'Grande révision : ' + nArch + ' mots des semaines passées' + (dueArch ? ' (' + dueArch + ' à revoir aujourd\'hui)' : '') +
        (S.retired && S.retired.length ? ' · ' + S.retired.length + ' sus pour toujours' : '')
      : '';
    const mode = Leitner.dailyMode(d);
    $('#nom-mode-du-jour').textContent = MODES[mode];
    $('#btn-mode-du-jour').dataset.mode = mode;
    $('#btn-blanche').classList.toggle('brille', d === 1);
    if (!sceneHome) sceneHome = new Pixel.MinerScene($('#mineur-accueil'));
    sceneHome.idle();
  }

  /* ---------------- Séance ---------------- */

  let G = null; // état de la séance en cours

  function startSession(mode) {
    Sound.unlock();
    const words = Store.allWords();
    const archDue = mode === 'blanche' ? [] : Leitner.dueArchive(S.archive, today(), 5).filter((w) => words.indexOf(w) < 0);
    if (!words.length && !archDue.length) { alert('La liste est vide : demande à un adulte de l\'ajouter dans l\'espace parent.'); return; }
    let list, options, discovery = false, packets = {}, packetCount = 0;
    if (mode === 'blanche') {
      list = shuffle(words);
      options = { maxAttempts: words.length, maxMs: Infinity, maxRetries: 0 };
    } else {
      // première séance de la semaine : tous les mots ; ensuite : révisions espacées
      const plan = Leitner.planSession(words, S.progress, today(), 15);
      list = plan.words; options = plan.options; discovery = plan.discovery;
      if (discovery) {
        // fractionnement : les mots nouveaux par paquets de 5, regroupés par lieu (même piège)
        const fresh = list.filter((w) => !S.progress[w] || !S.progress[w].lastSeen);
        const rank = (w) => Traps.ORDER.concat(['simple']).indexOf(Traps.detect(w).place);
        const sorted = fresh.slice().sort((a, b) => rank(a) - rank(b) || fresh.indexOf(a) - fresh.indexOf(b));
        sorted.forEach((w, i) => { packets[w] = Math.floor(i / 5); });
        packetCount = Math.ceil(sorted.length / 5);
        list = sorted.concat(list.filter((w) => sorted.indexOf(w) < 0));
      } else {
        // phase 2 : quelques mots des semaines passées à la fin de la séance
        list = list.concat(archDue);
        options = Object.assign({}, options, { maxAttempts: options.maxAttempts + archDue.length });
      }
    }
    G = {
      mode,
      discovery,
      packets,
      packetCount,
      currentPacket: -1,
      archived: new Set(archDue),
      retired: [],
      session: new Leitner.Session(list, options),
      loot: [],
      blanche: [],
      total: list.length
    };
    showScreen('jeu');
    $('#nom-mode').textContent = MODES[mode];
    show($('#btn-indice'), mode !== 'blanche');
    $('#butin-nombre').textContent = '0';
    $('#butin-icone').src = Pixel.blockIcon('terre', 32);
    if (!sceneGame) sceneGame = new Pixel.MinerScene($('#mineur-jeu'));
    sceneGame.idle();
    nextWord();
  }

  function nextWord() {
    closeKeyboard();
    const w = G.session.next();
    if (!w) return endSession();
    // nouveau paquet (découverte) : petite carte d'annonce, avec possibilité de faire une pause
    if (G.discovery && G.packets[w] != null && G.packets[w] > G.currentPacket && isNew(w)) {
      G.currentPacket = G.packets[w];
      return showPacket(w);
    }
    startWord(w);
  }

  function isNew(w) { return !G.archived.has(w) && (!S.progress[w] || !S.progress[w].lastSeen); }

  function startWord(w) {
    const info = Store.findWord(w) || { w, sentence: '' };
    G.word = w;
    G.sentence = info.sentence;
    G.usedHint = false;
    G.rewrite = 0;
    G.phase = 'saisie';
    G.answered = false;
    G.unsure = false;
    const n = G.session.attempts;
    $('#compteur-mot').textContent = (G.archived.has(w) ? 'Grande révision · ' : G.discovery ? 'Découverte · ' : '') + 'Mot ' + n +
      (G.mode === 'blanche' || G.discovery ? ' / ' + G.total : '');
    resetZones();
    // mot jamais vu : fiche d'étude (découpage, piège, lieu), puis on cache
    if (G.mode !== 'blanche' && isNew(w) && !G.studied) return showStudyCard();
    const studied = G.studied;
    G.studied = false;
    const mode = G.mode;
    if (mode === 'regarder' && !studied) return lookCoverWrite();
    if (mode === 'choix') renderChoices();
    else if (mode === 'lettres') renderTiles(w, false);
    else openInput();
    $('#consigne').textContent = mode === 'choix' ? 'Écoute et choisis la bonne orthographe.' :
      mode === 'lettres' ? 'Écoute et remets les lettres dans l\'ordre.' : 'Écoute le mot et écris-le.';
    speakWord();
  }

  /* ----- Paquets et fiche d'étude ----- */

  function showPacket(w) {
    resetZones();
    show($('.outils'), false);
    const place = Traps.PLACES[Traps.detect(w).place];
    const box = $('#paquet');
    box.innerHTML = '';
    box.appendChild(el('p', 'titre-pixel petit paquet-titre', 'Paquet ' + (G.currentPacket + 1) + ' / ' + G.packetCount));
    box.appendChild(placeBadge(Traps.detect(w).place));
    box.appendChild(el('p', 'aide', place.regle));
    const row = el('div', 'ligne-boutons');
    const go = el('button', 'btn btn-herbe', G.currentPacket ? 'On continue !' : 'C\'est parti !');
    go.addEventListener('click', () => { show(box, false); startWord(w); });
    row.appendChild(go);
    if (G.currentPacket > 0) {
      const pause = el('button', 'btn btn-pierre', 'Pause, je reviens plus tard');
      pause.addEventListener('click', () => { show(box, false); endSession(); });
      row.appendChild(pause);
    }
    box.appendChild(row);
    show(box, true);
    $('#compteur-mot').textContent = 'Découverte';
  }

  /** Pastille d'un lieu (palais mental) : bloc coloré + nom du lieu. */
  function placeBadge(placeId) {
    const p = Traps.PLACES[placeId];
    const b = el('div', 'lieu');
    b.style.setProperty('--lieu', p.couleur);
    const img = el('img');
    img.src = Pixel.blockIcon(PLACE_BLOCK[placeId] || 'terre', 32);
    img.alt = '';
    b.appendChild(img);
    b.appendChild(el('span', '', p.nom));
    return b;
  }

  const PLACE_BLOCK = { tion: 'saphir', muette: 'amethyste', double: 'brique', mbp: 'cuivre', h: 'pierre',
    accent: 'or', sons: 'herbe', simple: 'terre' };

  /** Mot découpé en syllabes, pièges colorés selon leur lieu (fractionnement). */
  function chunkedWord(word, cls) {
    const p = el('div', 'mot morceaux ' + (cls || ''));
    Traps.chunks(word, Syllables.split(word)).forEach((c) => {
      if (c.sep) p.appendChild(el('span', 'point', '·'));
      const sp = el('span', c.trap ? 'piege' : '', c.text);
      if (c.trap) sp.style.setProperty('--lieu', Traps.PLACES[c.trap].couleur);
      p.appendChild(sp);
    });
    return p;
  }

  function showStudyCard() {
    const w = G.word;
    const d = Traps.detect(w);
    const box = $('#fiche');
    box.innerHTML = '';
    box.appendChild(el('p', 'consigne', 'Nouveau mot ! Regarde-le bien.'));
    box.appendChild(chunkedWord(w, 'grand-mot'));
    box.appendChild(placeBadge(d.place));
    box.appendChild(el('p', 'aide', 'Ce mot habite ici. ' + Traps.PLACES[d.place].regle));
    if (G.sentence) box.appendChild(el('p', 'phrase', G.sentence));
    const go = el('button', 'btn btn-saphir', 'Je l\'ai bien regardé, je le cache !');
    go.addEventListener('click', () => {
      show(box, false);
      G.studied = true;
      startWord(w);
    });
    box.appendChild(go);
    show(box, true);
    show($('.outils'), false);
    Speech.dictate(w, G.sentence);
  }

  function resetZones() {
    ['#paquet', '#fiche'].forEach((s) => show($(s), false));
    ['#indice', '#mot-montre', '#saisie-clavier', '#saisie-tuiles', '#confirmation', '#choix', '#correction']
      .forEach((s) => show($(s), false));
    $('#indice').innerHTML = '';
    $('#champ').value = '';
    $('#consigne').textContent = '';
    show($('.outils'), true);
  }

  function speakWord() { Speech.dictate(G.word, G.sentence); }

  /** Saisie selon le réglage : clavier manuscrit ou tuiles. */
  function openInput() {
    if (S.settings.input === 'tuiles') renderTiles(G.word, true);
    else openKeyboard();
  }

  /**
   * Champ de saisie : par défaut on lui donne le focus, ce qui ouvre le
   * clavier (manuscrit) à chaque mot. Option « stylet direct » (désactivée
   * par défaut) : pas de focus automatique et inputmode="none", l'enfant écrit
   * directement dans la case ; le bouton ⌨️ rouvre le clavier au besoin.
   */
  function openKeyboard() {
    show($('#saisie-tuiles'), false);
    show($('#saisie-clavier'), true);
    const f = $('#champ');
    f.value = '';
    const direct = !!S.settings.stylusDirect && !G.showKeyboard;
    f.setAttribute('inputmode', direct ? 'none' : 'text');
    show($('#btn-clavier-virtuel'), direct);
    if (!direct) setTimeout(() => f.focus(), 50);
  }

  function closeKeyboard() {
    const f = $('#champ');
    if (document.activeElement === f) f.blur();
  }

  /* ----- Regarder, cacher, écrire ----- */

  function lookCoverWrite() {
    $('#consigne').textContent = 'Regarde bien le mot…';
    const m = $('#mot-montre');
    m.textContent = G.word;
    show(m, true);
    m.classList.remove('disparait');
    void m.offsetWidth;
    m.classList.add('disparait');
    show($('.outils'), false);
    Speech.dictate(G.word, '');
    clearTimeout(G.timer);
    G.timer = setTimeout(() => {
      show(m, false);
      show($('.outils'), true);
      $('#consigne').textContent = 'Il est caché ! Écris-le de mémoire.';
      openInput();
    }, 3000);
  }

  /* ----- Indice ----- */

  function showHint() {
    if (G.mode === 'blanche' || G.phase !== 'saisie') return;
    G.usedHint = true;
    const box = $('#indice');
    box.innerHTML = '';
    if (G.sentence) {
      // phrase avec le mot caché : le contexte aide sans donner l'orthographe
      const masked = maskWord(G.sentence, G.word);
      box.appendChild(el('p', 'phrase', masked));
    }
    // palais mental : le lieu où habite le mot rappelle son piège
    const place = Traps.detect(G.word).place;
    box.appendChild(placeBadge(place));
    box.appendChild(el('p', 'aide', Traps.PLACES[place].regle));
    if (G.mode !== 'choix') {
      // syllabes et pièges montrés 3 secondes puis cachés (on ne recopie pas en regardant)
      const syl = Syllables.split(G.word);
      const p = chunkedWord(G.word, 'syllabes');
      box.appendChild(p);
      box.appendChild(el('p', 'aide', syl.length + (syl.length > 1 ? ' syllabes' : ' syllabe')));
      setTimeout(() => { p.classList.add('cache'); }, 3000);
      Speech.say(syl.length > 1 ? syl : [G.word], 0.7);
    } else if (G.sentence) {
      Speech.say([G.sentence]);
    }
    show(box, true);
  }

  /** Cache le mot dans la phrase (avec ou sans son article / pronom). */
  function maskWord(sentence, word) {
    const box = (w) => '▢'.repeat(Math.min(8, w.length));
    const re = (w) => new RegExp('(?<!\\p{L})' + escapeRe(w).replace(/'/g, "['’]") + '(?!\\p{L})', 'giu');
    let out = sentence.replace(re(word), box(word));
    const core = word.split(/[\s'’]+/).pop();
    if (core && core.length > 2 && core !== word) out = out.replace(re(core), box(core));
    return out;
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* ----- Tuiles de lettres ----- */

  /**
   * withExtras = true : lettres du mot + quelques lettres pièges (saisie sans
   * clavier en dictée). false : exactement les lettres du mot (lettres mélangées).
   */
  function renderTiles(word, withExtras) {
    show($('#saisie-clavier'), false);
    show($('#saisie-tuiles'), true);
    show($('#btn-vers-clavier'), G.mode !== 'lettres' || G.phase === 'reecriture');
    let letters = Array.from(word);
    if (withExtras) letters = letters.concat(extraLetters(word));
    let pool = shuffle(letters);
    // évite de donner le mot déjà dans l'ordre
    if (pool.join('') === word && word.length > 1) pool = pool.slice(1).concat(pool[0]);
    G.tiles = { pool: pool.map((c, i) => ({ c, id: i })), answer: [] };
    drawTiles();
  }

  function extraLetters(word) {
    const have = {};
    Array.from(word).forEach((c) => { have[c] = (have[c] || 0) + 1; });
    const extras = [];
    Distractors.generate(word, 3).forEach((d) => {
      const cnt = Object.assign({}, have);
      Array.from(d).forEach((c) => {
        if (cnt[c]) cnt[c]--; else if (extras.indexOf(c) < 0 && c !== ' ') extras.push(c);
      });
    });
    const filler = 'esxtéèa';
    for (const c of filler) { if (extras.length >= 3) break; if (extras.indexOf(c) < 0) extras.push(c); }
    return extras.slice(0, 4);
  }

  function drawTiles() {
    const res = $('#reponse-tuiles'), pool = $('#reserve-tuiles');
    res.innerHTML = ''; pool.innerHTML = '';
    G.tiles.answer.forEach((t, k) => {
      const b = el('button', 'tuile mot', t.c === ' ' ? '␣' : t.c);
      b.type = 'button';
      b.setAttribute('aria-label', 'Retirer la lettre ' + t.c);
      b.addEventListener('click', () => { Sound.tap(); G.tiles.answer.splice(k, 1); G.tiles.pool.push(t); drawTiles(); });
      res.appendChild(b);
    });
    if (!G.tiles.answer.length) res.appendChild(el('span', 'vide', 'Touche ou glisse les lettres ici'));
    G.tiles.pool.forEach((t) => {
      const b = el('button', 'tuile mot', t.c === ' ' ? '␣' : t.c);
      b.type = 'button';
      b.setAttribute('aria-label', t.c === ' ' ? 'Espace' : 'Lettre ' + t.c);
      enableDrag(b, t);
      pool.appendChild(b);
    });
    // lettres mélangées : on valide automatiquement quand tout est placé
    if (G.mode === 'lettres' && G.phase === 'saisie' && !G.tiles.pool.length) setTimeout(submitTiles, 250);
  }

  function takeTile(t) {
    const i = G.tiles.pool.indexOf(t);
    if (i < 0) return;
    Sound.tap();
    G.tiles.pool.splice(i, 1);
    G.tiles.answer.push(t);
    drawTiles();
  }

  /** Toucher = ajouter ; glisser vers la zone de réponse = ajouter aussi. */
  function enableDrag(btn, t) {
    let start = null, ghost = null;
    btn.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY };
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!ghost && Math.hypot(dx, dy) > 12) {
        ghost = btn.cloneNode(true);
        ghost.classList.add('fantome');
        document.body.appendChild(ghost);
        btn.classList.add('soulevee');
      }
      if (ghost) {
        ghost.style.left = (e.clientX - 30) + 'px';
        ghost.style.top = (e.clientY - 36) + 'px';
      }
    });
    const end = (e) => {
      if (!start) return;
      const wasDrag = !!ghost;
      start = null;
      if (ghost) { ghost.remove(); ghost = null; btn.classList.remove('soulevee'); }
      if (!wasDrag) return takeTile(t);
      const r = $('#reponse-tuiles').getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 20 && e.clientY <= r.bottom + 20) takeTile(t);
    };
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', () => { start = null; if (ghost) { ghost.remove(); ghost = null; btn.classList.remove('soulevee'); } });
  }

  function submitTiles() {
    if (!G || !G.tiles) return;
    const answer = G.tiles.answer.map((t) => t.c).join('');
    if (!answer) return;
    G.inputKind = 'tuiles';
    askConfirmation(answer);
  }

  /* ----- Clavier + confirmation ----- */

  function submitKeyboard() {
    const v = Align.normalize($('#champ').value, G.word);
    if (!v) return;
    closeKeyboard();
    G.inputKind = 'clavier';
    askConfirmation(v);
  }

  /**
   * Confirmation de la réponse + auto-évaluation : « Sûr de moi » ou
   * « J'hésite ». Un mot juste mais hésitant ne monte pas de boîte.
   */
  function askConfirmation(v) {
    show($('#saisie-clavier'), false);
    show($('#saisie-tuiles'), false);
    $('#reconnu').textContent = v;
    G.pending = v;
    const rewrite = G.phase === 'reecriture';
    show($('#btn-hesite'), !rewrite);
    $('#btn-sur').textContent = rewrite ? 'C\'est ce que j\'ai écrit' : '😎 Sûr de moi';
    show($('#confirmation'), true);
  }

  /* ----- Le bon mot ----- */

  function renderChoices() {
    const box = $('#choix');
    box.innerHTML = '';
    const options = shuffle([G.word].concat(Distractors.generate(G.word, 2)));
    options.forEach((o) => {
      const b = el('button', 'btn btn-pierre choix-mot mot', o);
      b.addEventListener('click', () => {
        if (G.answered) return;
        $$('.choix-mot').forEach((x) => {
          if (x.textContent === G.word) x.classList.add('juste');
          else if (x === b) x.classList.add('faux');
        });
        evaluate(o);
      });
      box.appendChild(b);
    });
    show(box, true);
  }

  /* ----- Correction ----- */

  function evaluate(answer) {
    if (G.phase === 'reecriture') return evaluateRewrite(answer);
    if (G.answered) return;
    G.answered = true;
    const res = Align.grade(answer, G.word);
    let st;
    if (G.archived.has(G.word)) {
      // phase 2 : grande révision d'un mot d'une semaine passée. En mode
      // reconnaissance (Le bon mot, Lettres), une réussite ne fait pas avancer
      // le mot : il faut l'écrire de mémoire.
      const recognition = Leitner.RECOGNITION_MODES.indexOf(G.mode) >= 0;
      const neutral = res.correct && (recognition || G.usedHint || G.unsure);
      const r = neutral ? { entry: S.archive[G.word], retired: false }
        : Leitner.applyArchiveResult(S.archive[G.word], res.correct, today());
      if (r.retired) {
        delete S.archive[G.word];
        S.retired.push({ w: G.word, week: r.entry.week || '', date: today() });
        G.retired.push(G.word);
        G.archived.delete(G.word);
      } else S.archive[G.word] = r.entry;
      st = { change: r.retired ? 'up' : 'same', box: r.retired ? 3 : 2, archive: true, retired: r.retired };
    } else {
      st = Leitner.applyResult(S.progress[G.word], {
        correct: res.correct, usedHint: G.usedHint, unsure: G.unsure, answer: res.answer, mode: G.mode,
        today: today(), daysLeft: daysLeft()
      });
      S.progress[G.word] = st;
    }
    G.session.report(G.word, res.correct, G.usedHint);
    Store.save();

    show($('#confirmation'), false);
    show($('#saisie-tuiles'), false);
    show($('#saisie-clavier'), false);
    show($('#indice'), false);

    if (G.mode === 'blanche') {
      G.blanche.push(res);
      if (res.correct) G.loot.push(rewardFor(st));
      $('#consigne').textContent = 'C\'est noté !';
      setTimeout(nextWord, 700);
      return;
    }

    show($('#correction'), true);
    drawAlignment(res, false);
    if (res.correct) {
      const mat = rewardFor(st);
      G.loot.push(mat);
      Store.addBlocks([mat]);
      updateLoot(mat);
      const m = Pixel.MATERIALS[mat];
      $('#message').textContent = (st.retired ? 'Ce mot est su pour toujours ! ' : pick(BRAVO)) + ' Tu gagnes : ' + m.nom +
        (st.change === 'up' && st.box === 3 ? ' (rare !)' : '') +
        (G.usedHint ? ' · avec un indice, le mot reste dans sa boîte' :
          G.unsure ? ' · Tu hésitais, mais c\'est juste ! On le reverra pour être sûr.' : '');
      $('#message').className = 'message bravo';
      show($('#btn-continuer'), true);
      show($('#btn-reecrire'), false);
      $('#consigne').textContent = '';
      sceneGame.celebrate(mat, (n) => (n < 3 ? Sound.hit() : Sound.crack())).then(() => Sound.success());
    } else {
      $('#message').textContent = (res.accentOnly ? 'Presque ! Regarde l\'accent.' : 'On réessaie !') +
        (G.unsure || G.mode === 'choix' ? '' : ' Tu étais sûr de toi : regarde bien la différence.');
      $('#message').className = 'message doux';
      $('#consigne').textContent = 'Regarde bien le mot juste.';
      // le piège du mot, découpé et coloré, et son lieu
      const d = Traps.detect(G.word);
      const piege = el('div', 'piege-correction');
      piege.appendChild(chunkedWord(G.word));
      piege.appendChild(placeBadge(d.place));
      piege.appendChild(el('p', 'aide', Traps.PLACES[d.place].regle));
      $('#alignement').appendChild(piege);
      show($('#btn-continuer'), false);
      show($('#btn-reecrire'), true);
      Sound.soft();
    }
  }

  /** Bloc gagné : rare si le mot passe en boîte 3, peu commun s'il passe en boîte 2. */
  function rewardFor(st) {
    if (st.archive) return Pixel.randomMaterial(st.retired ? 3 : 2);
    if (st.change === 'up' && st.box === 3) return Pixel.randomMaterial(3);
    if (st.change === 'up' && st.box === 2) return Pixel.randomMaterial(2);
    return Pixel.randomMaterial(1);
  }

  function updateLoot(mat) {
    $('#butin-nombre').textContent = String(G.loot.length);
    $('#butin-icone').src = Pixel.blockIcon(mat, 32);
  }

  /**
   * Affiche l'alignement : en haut la réponse de l'enfant, en bas le mot juste.
   * Vert = lettre juste, orange = lettre fausse, manquante ou en trop.
   */
  function drawAlignment(res, compact) {
    const box = $('#alignement');
    box.innerHTML = '';
    const grid = el('div', 'grille-alignement' + (compact ? ' compact' : ''));
    res.ops.forEach((o) => {
      const col = el('div', 'colonne ' + o.op);
      col.appendChild(el('span', 'lettre-enfant mot', o.got || (o.op === 'missing' ? '·' : '')));
      col.appendChild(el('span', 'lettre-juste mot', o.expected || ' '));
      col.title = { ok: 'juste', accent: 'accent', sub: 'lettre à changer', missing: 'lettre oubliée', extra: 'lettre en trop' }[o.op];
      grid.appendChild(col);
    });
    const legend = el('div', 'legende');
    legend.appendChild(el('span', 'puce ok', 'juste'));
    if (!res.correct) legend.appendChild(el('span', 'puce sub', 'à revoir'));
    const labels = el('div', 'etiquettes');
    labels.appendChild(el('span', '', 'Tu as écrit'));
    labels.appendChild(el('span', '', 'Le mot'));
    const wrap = el('div', 'alignement-cadre');
    wrap.appendChild(labels);
    wrap.appendChild(grid);
    box.appendChild(wrap);
    box.appendChild(legend);
  }

  /* ----- Réécriture après une erreur (de mémoire) ----- */

  function startRewrite() {
    G.phase = 'reecriture';
    show($('#correction'), false);
    show($('#choix'), false);
    $('#consigne').textContent = 'Le mot est caché. Réécris-le correctement.';
    if (G.mode === 'lettres') renderTiles(G.word, false);
    else openInput();
  }

  function evaluateRewrite(answer) {
    const res = Align.grade(answer, G.word);
    show($('#confirmation'), false);
    show($('#saisie-tuiles'), false);
    show($('#saisie-clavier'), false);
    show($('#correction'), true);
    drawAlignment(res, true);
    G.rewrite++;
    if (res.correct) {
      $('#message').textContent = 'Super, c\'est bien ça ! Le mot reviendra un peu plus tard.';
      $('#message').className = 'message bravo';
      $('#consigne').textContent = '';
      show($('#btn-continuer'), true);
      show($('#btn-reecrire'), false);
      Sound.place();
    } else if (G.rewrite < 2) {
      $('#message').textContent = res.accentOnly ? 'Presque ! Regarde l\'accent.' : 'On réessaie ! Regarde encore une fois.';
      $('#message').className = 'message doux';
      show($('#btn-continuer'), false);
      show($('#btn-reecrire'), true);
      Sound.soft();
    } else {
      $('#message').textContent = 'Pas grave, on le reverra tout à l\'heure !';
      $('#message').className = 'message doux';
      show($('#btn-continuer'), true);
      show($('#btn-reecrire'), false);
    }
  }

  /* ---------------- Fin de séance ---------------- */

  function endSession() {
    showScreen('fin');
    const g = G;
    const details = $('#fin-details');
    details.innerHTML = '';
    if (g.mode === 'blanche') {
      const score = g.blanche.filter((r) => r.correct).length;
      S.blanche.push({ date: today(), score, total: g.blanche.length });
      Store.addBlocks(g.loot);
      $('#fin-texte').textContent = 'Dictée blanche : ' + score + ' / ' + g.blanche.length;
      g.blanche.forEach((r) => {
        const line = el('div', 'ligne-blanche');
        line.appendChild(el('span', r.correct ? 'puce ok' : 'puce sub', r.correct ? '✔' : '↻'));
        const span = el('span', 'mot', r.correct ? r.target : r.answer + ' → ' + r.target);
        line.appendChild(span);
        details.appendChild(line);
      });
    } else {
      const ok = new Set(g.session.results.filter((r) => r.correct).map((r) => r.word));
      $('#fin-texte').textContent = ok.size
        ? 'Tu as réussi ' + ok.size + (ok.size > 1 ? ' mots' : ' mot') + ' et gagné ' + g.loot.length + (g.loot.length > 1 ? ' blocs !' : ' bloc !')
        : 'Tu t\'es bien entraîné, c\'est comme ça qu\'on apprend !';
    }
    if (g.retired.length) {
      details.appendChild(el('p', 'grand', '🏆 Sus pour toujours : ' + g.retired.join(', ')));
    }
    S.stats.sessionsToday = S.stats.lastDay === today() ? S.stats.sessionsToday + 1 : 1;
    S.stats.lastDay = today();
    Store.save();
    const loot = $('#fin-butin');
    loot.innerHTML = '';
    g.loot.forEach((m) => {
      const img = el('img', 'bloc-butin');
      img.src = Pixel.blockIcon(m, 48);
      img.alt = Pixel.MATERIALS[m].nom;
      loot.appendChild(img);
    });
    if (!sceneEnd) sceneEnd = new Pixel.MinerScene($('#mineur-fin'));
    sceneEnd.idle();
    Sound.fanfare();
    G = null;
  }

  /* ---------------- Mon monde ---------------- */

  function renderWorld() {
    showScreen('monde');
    const scroll = $('#monde-scroll');
    const h = Math.max(220, Math.min(520, innerHeight * 0.55));
    const r = Pixel.drawWorld($('#monde'), S.world.blocks, h);
    scroll.scrollLeft = r.scrollTo;
    const cur = r.buildings[r.buildings.length - 1];
    const finished = r.buildings.length - 1;
    $('#monde-texte').textContent = (finished ? 'Constructions terminées : ' + finished + '. ' : '') +
      'En chantier : ' + cur.plan.nom + ' (' + cur.done + ' / ' + cur.total + ' blocs).';
    const inv = $('#inventaire');
    inv.innerHTML = '';
    const count = {};
    S.world.blocks.forEach((m) => { count[m] = (count[m] || 0) + 1; });
    Object.keys(Pixel.MATERIALS).filter((m) => count[m]).forEach((m) => {
      const it = el('div', 'objet');
      const img = el('img');
      img.src = Pixel.blockIcon(m, 40);
      img.alt = '';
      it.appendChild(img);
      it.appendChild(el('span', '', Pixel.MATERIALS[m].nom + ' × ' + count[m]));
      inv.appendChild(it);
    });
    if (!S.world.blocks.length) inv.appendChild(el('p', '', 'Réussis des mots pour gagner tes premiers blocs !'));
  }

  /* ---------------- Espace parent ---------------- */

  function renderGate() {
    showScreen('porte');
    const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    $('#calcul').textContent = a + ' × ' + b;
    $('#form-porte').dataset.answer = String(a * b);
    $('#reponse-calcul').value = '';
    show($('#porte-erreur'), false);
    setTimeout(() => $('#reponse-calcul').focus(), 50);
  }

  function renderParent() {
    showScreen('parent');
    $('#liste').value = Store.listToText(S.words);
    $('#jour-dictee').value = String(S.dictationDay);
    $('#opt-cursive').checked = !!S.settings.cursive;
    $('#opt-son').checked = !!S.settings.sound;
    $('#opt-saisie').value = S.settings.input;
    $('#opt-stylet').checked = !!S.settings.stylusDirect;
    $('#voix').textContent = Speech.available ? (Speech.voiceName() || 'aucune voix française trouvée') : 'synthèse vocale indisponible';
    show($('#liste-ok'), false);
    show($('#semaine-ok'), false);
    renderProgress();
  }

  function renderProgress() {
    const t = $('#progression');
    t.innerHTML = '';
    const head = el('tr');
    ['Mot', 'Boîte', 'Réussites', 'Erreurs', 'Erreurs fréquentes', 'Prochaine révision'].forEach((h) => head.appendChild(el('th', '', h)));
    t.appendChild(head);
    S.words.forEach((x) => {
      const p = S.progress[x.w] || Leitner.newWordState();
      const tr = el('tr');
      const td = el('td', 'mot', x.w);
      if (x.review) td.appendChild(el('span', 'etiquette', 'révision'));
      tr.appendChild(td);
      const boxCell = el('td');
      boxCell.appendChild(el('span', 'boite boite-' + p.box, String(p.box)));
      tr.appendChild(boxCell);
      tr.appendChild(el('td', '', String(p.success) + (p.hinted ? ' (' + p.hinted + ' avec indice)' : '')));
      tr.appendChild(el('td', '', String(p.fail)));
      tr.appendChild(el('td', 'mot', Leitner.topErrors(p, 3).map((e) => e.answer + (e.count > 1 ? ' ×' + e.count : '')).join(', ') || '—'));
      tr.appendChild(el('td', '', !p.lastSeen ? 'pas encore vu' : p.nextDue <= today() ? 'aujourd\'hui' : formatDate(p.nextDue)));
      t.appendChild(tr);
    });
    const sb = $('#scores-blanche');
    sb.textContent = S.blanche.length ? 'Dictées blanches : ' + S.blanche.map((b) => formatDate(b.date) + ' → ' + b.score + '/' + b.total).join(' · ') : '';
    $('#liste-rates').textContent = S.words.length + ' mots';
    renderArchive();
  }

  /** Tableau de la phase 2 (grande révision). */
  function renderArchive() {
    const t = $('#grande-revision');
    t.innerHTML = '';
    const words = Object.keys(S.archive).sort((a, b) => S.archive[a].nextDue.localeCompare(S.archive[b].nextDue));
    $('#grande-revision-info').textContent = (words.length ? words.length + ' mots en grande révision.' : 'Aucun mot en grande révision pour l\'instant.') +
      (S.retired.length ? ' Sus pour toujours : ' + S.retired.length + ' (' + S.retired.slice(-10).map((r) => r.w).join(', ') + (S.retired.length > 10 ? '…' : '') + ').' : '');
    if (!words.length) return;
    const head = el('tr');
    ['Mot', 'Semaine', 'Étape', 'Prochaine révision', 'Erreurs'].forEach((h) => head.appendChild(el('th', '', h)));
    t.appendChild(head);
    words.forEach((w) => {
      const a = S.archive[w];
      const tr = el('tr');
      tr.appendChild(el('td', 'mot', w));
      tr.appendChild(el('td', '', a.week || '—'));
      tr.appendChild(el('td', '', (a.level + 1) + ' / ' + Leitner.ARCHIVE_INTERVALS.length));
      tr.appendChild(el('td', '', a.nextDue <= today() ? 'aujourd\'hui' : formatDate(a.nextDue)));
      tr.appendChild(el('td', '', String(a.fail)));
      t.appendChild(tr);
    });
  }

  /* ---------------- Ma carte des pièges (carte mentale) ---------------- */

  /**
   * Carte mentale : « Mes mots » au centre, une branche par lieu (piège),
   * les mots de la semaine sur chaque branche (couleur = boîte), et les mots
   * des semaines passées en plus petit. Toucher un mot le fait entendre.
   */
  function renderMap() {
    showScreen('carte');
    const box = $('#carte');
    box.innerHTML = '';
    const centre = el('div', 'carte-centre');
    centre.appendChild(el('span', 'titre-pixel petit', 'Mes mots'));
    if (S.listTitle) centre.appendChild(el('span', '', S.listTitle));
    box.appendChild(centre);
    const groups = {};
    S.words.forEach((x) => { (groups[Traps.detect(x.w).place] = groups[Traps.detect(x.w).place] || { cur: [], old: [] }).cur.push(x.w); });
    Object.keys(S.archive).forEach((w) => { (groups[Traps.detect(w).place] = groups[Traps.detect(w).place] || { cur: [], old: [] }).old.push(w); });
    const branches = el('div', 'carte-branches');
    Traps.ORDER.concat(['simple']).filter((p) => groups[p]).forEach((p) => {
      const b = el('div', 'branche');
      b.style.setProperty('--lieu', Traps.PLACES[p].couleur);
      b.appendChild(placeBadge(p));
      b.appendChild(el('p', 'aide', Traps.PLACES[p].regle));
      const chips = el('div', 'feuilles');
      groups[p].cur.forEach((w) => chips.appendChild(mapChip(w, 'boite-' + ((S.progress[w] || {}).box || 1))));
      groups[p].old.forEach((w) => chips.appendChild(mapChip(w, 'ancien')));
      b.appendChild(chips);
      branches.appendChild(b);
    });
    box.appendChild(branches);
  }

  function mapChip(w, cls) {
    const c = el('button', 'feuille ' + cls);
    c.appendChild(chunkedWord(w));
    c.addEventListener('click', () => { const x = Store.findWord(w); Speech.dictate(w, x ? x.sentence : ''); });
    return c;
  }

  function formatDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return JOURS[dt.getDay()] + ' ' + d + '/' + m;
  }

  /* ---------------- Actions (boutons) ---------------- */

  const actions = {
    son() { S.settings.sound = !S.settings.sound; Store.save(); applySettings(); if (S.settings.sound) Sound.tap(); },
    parent: renderGate,
    accueil: renderHome,
    monde: renderWorld,
    jouer(btn) { startSession(btn.dataset.mode); },
    'jouer-du-jour'(btn) { startSession(btn.dataset.mode); },
    quitter() { clearTimeout(G && G.timer); G = null; renderHome(); },
    reecouter() {
      if (!G) return;
      if (G.mode === 'regarder') Speech.dictate(G.word, '');
      else speakWord();
    },
    indice: showHint,
    'vers-tuiles'() {
      S.settings.input = 'tuiles'; Store.save();
      renderTiles(G.word, G.mode !== 'lettres');
    },
    'vers-clavier'() { S.settings.input = 'clavier'; Store.save(); openKeyboard(); },
    'clavier-virtuel'() { G.showKeyboard = true; openKeyboard(); },
    'valider-tuiles': submitTiles,
    'effacer-tuiles'() { G.tiles.pool = G.tiles.pool.concat(G.tiles.answer); G.tiles.answer = []; drawTiles(); },
    confirmer() { G.unsure = false; show($('#confirmation'), false); evaluate(G.pending); },
    hesiter() { G.unsure = true; show($('#confirmation'), false); evaluate(G.pending); },
    recommencer() {
      show($('#confirmation'), false);
      if (G.inputKind === 'tuiles') renderTiles(G.word, G.mode !== 'lettres');
      else openKeyboard();
    },
    carte: renderMap,
    continuer() { clearTimeout(G.timer); nextWord(); },
    reecrire: startRewrite,
    'enregistrer-liste'() {
      Store.setList($('#liste').value);
      S = Store.get();
      const ok = $('#liste-ok');
      ok.textContent = 'Liste enregistrée : ' + S.words.filter((x) => !x.review).length + ' mots.';
      show(ok, true);
      renderProgress();
    },
    exemple() { $('#liste').value = Store.SAMPLE; },
    'test-voix'() { Speech.dictate('chevaux', 'Les chevaux galopent dans le pré.'); },
    'nouvelle-semaine'() {
      const text = $('#liste').value;
      if (!Store.parseList(text).length) { alert('La liste est vide.'); return; }
      if (!confirm('Commencer une nouvelle semaine avec cette liste ? La progression des mots sera remise à zéro (le monde est conservé).')) return;
      Store.newWeek(text, $('#garder-rates').checked);
      S = Store.get();
      renderParent();
      const ok = $('#semaine-ok');
      ok.textContent = 'Nouvelle semaine prête : ' + S.words.length + ' mots.';
      show(ok, true);
    }
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !actions[btn.dataset.action]) return;
    e.preventDefault();
    Sound.unlock();
    actions[btn.dataset.action](btn);
  });

  $('#saisie-clavier').addEventListener('submit', (e) => { e.preventDefault(); submitKeyboard(); });

  $('#form-porte').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('#reponse-calcul').value.trim() === e.target.dataset.answer) renderParent();
    else { show($('#porte-erreur'), true); $('#reponse-calcul').value = ''; }
  });

  $('#jour-dictee').addEventListener('change', (e) => { S.dictationDay = Number(e.target.value); Store.save(); });
  $('#opt-cursive').addEventListener('change', (e) => { S.settings.cursive = e.target.checked; Store.save(); applySettings(); });
  $('#opt-son').addEventListener('change', (e) => { S.settings.sound = e.target.checked; Store.save(); applySettings(); });
  $('#opt-stylet').addEventListener('change', (e) => { S.settings.stylusDirect = e.target.checked; Store.save(); });
  $('#opt-saisie').addEventListener('change', (e) => { S.settings.input = e.target.value; Store.save(); });

  /* ---------------- Décor, clavier virtuel, hors ligne ---------------- */

  function drawDecor() { Pixel.drawLandscape($('#decor')); }
  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      drawDecor();
      if (!$('#ecran-monde').hidden) renderWorld();
    }, 200);
  });

  // Quand le clavier manuscrit occupe l'écran, on cache le mineur pour garder le champ visible.
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', () => {
      document.body.classList.toggle('clavier-ouvert', visualViewport.height < innerHeight * 0.8 || visualViewport.height < screen.height * 0.6);
    });
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Chemin relatif : fonctionne aussi sous https://pseudo.github.io/nom-du-depot/
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Test automatique / débogage : accès à l'état depuis la console.
  window.DicteeApp = { get state() { return S; }, get game() { return G; }, startSession, renderHome };

  /**
   * Liste publiée : si le fichier liste.txt du site a changé depuis la
   * dernière fois, il devient la liste de la semaine (nouvelle semaine).
   * Les mots pas encore sus d'une liste publiée précédente restent en révision.
   */
  async function checkPublishedList() {
    let text;
    try {
      const res = await fetch('liste.txt', { cache: 'no-cache' });
      if (!res.ok) return;
      text = await res.text();
    } catch (e) { return; }
    const words = Store.parseList(text);
    if (!words.length) return;
    const id = hashText(text);
    if (S.publishedListId === id) return;
    const title = Store.listTitle(text);
    if (S.publishedListId && title && title === S.listTitle) {
      // même liste corrigée (même titre) : on garde la progression des mots inchangés
      Store.setList(text);
    } else {
      Store.newWeek(text, !!S.publishedListId);
    }
    S = Store.get();
    S.publishedListId = id;
    S.listTitle = Store.listTitle(text);
    Store.save();
    if (!$('#ecran-accueil').hidden) renderHome();
  }

  function hashText(t) {
    let h = 5381;
    for (const c of t.replace(/\r/g, '').trim()) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
    return h.toString(36);
  }

  applySettings();
  drawDecor();
  renderHome();
  checkPublishedList();
})();
