/*
 * pixel.js — Tout le pixel art de l'appli, dessiné en canvas par le code
 * (aucune image externe) : textures de blocs, petit mineur, paysage de fond,
 * et le monde que l'enfant construit avec ses blocs.
 *
 * Créations originales : couleurs, mineur et plans de construction sont
 * propres à cette appli.
 */
(function (root) {
  'use strict';

  /* ---------- Matériaux ---------- */

  // rareté : 1 = commun (mot réussi), 2 = peu commun (mot qui passe en boîte 2),
  //          3 = rare (mot qui passe en boîte 3)
  const MATERIALS = {
    terre:    { nom: 'Terre',     rarete: 1, base: ['#8a5a36', '#74482a', '#9c6a42'] },
    planche:  { nom: 'Planche',   rarete: 1, base: ['#b9853f', '#9a6a2e', '#cf9a52'] },
    pierre:   { nom: 'Pierre',    rarete: 1, base: ['#8d9196', '#767a80', '#a2a6ab'] },
    brique:   { nom: 'Brique',    rarete: 1, base: ['#b24a35', '#933a29', '#d8d2c4'] },
    verre:    { nom: 'Verre',     rarete: 2, base: ['#bfe9f5', '#8fd3e8', '#ffffff'] },
    charbon:  { nom: 'Charbon',   rarete: 2, base: ['#8d9196', '#767a80', '#2a2a2e'], ore: ['#2a2a2e', '#45454b'] },
    fer:      { nom: 'Fer',       rarete: 2, base: ['#8d9196', '#767a80', '#d9b99a'], ore: ['#d9b99a', '#f0d8c0'] },
    cuivre:   { nom: 'Cuivre',    rarete: 2, base: ['#8d9196', '#767a80', '#d9773a'], ore: ['#d9773a', '#5fbf9a'] },
    or:       { nom: 'Or',        rarete: 3, base: ['#8d9196', '#767a80', '#f5c518'], ore: ['#f5c518', '#fff08a'] },
    rubis:    { nom: 'Rubis',     rarete: 3, base: ['#8d9196', '#767a80', '#e0245e'], ore: ['#e0245e', '#ff8fb1'] },
    saphir:   { nom: 'Saphir',    rarete: 3, base: ['#8d9196', '#767a80', '#2f6fe0'], ore: ['#2f6fe0', '#9cc4ff'] },
    amethyste:{ nom: 'Améthyste', rarete: 3, base: ['#8d9196', '#767a80', '#9b4fd8'], ore: ['#9b4fd8', '#d6a8ff'] },
    herbe:    { nom: 'Herbe',     rarete: 0, base: ['#8a5a36', '#74482a', '#9c6a42'] },
    // couches de la mine (phase 2), pas des récompenses
    ardoise:  { nom: 'Ardoise',   rarete: 0, base: ['#4a4f5a', '#3d424c', '#5a606b'] },
    cristal:  { nom: 'Cristal',   rarete: 0, base: ['#3a2f52', '#2e2542', '#b98cff'], ore: ['#b98cff', '#f0dcff'] },
    magma:    { nom: 'Magma',     rarete: 0, base: ['#3b1d1a', '#2c1513', '#ff7a1a'], ore: ['#ff7a1a', '#ffd23a'] }
  };

  const BY_RARITY = { 1: ['terre', 'planche', 'pierre', 'brique'], 2: ['verre', 'charbon', 'fer', 'cuivre'],
    3: ['or', 'rubis', 'saphir', 'amethyste'] };

  /** Tire un matériau de la rareté donnée. */
  function randomMaterial(rarete, rng) {
    const list = BY_RARITY[rarete] || BY_RARITY[1];
    return list[Math.floor((rng || Math.random)() * list.length)];
  }

  /* ---------- Textures 8×8 ---------- */

  // Petit générateur pseudo-aléatoire déterministe (mêmes textures à chaque fois).
  function prng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function seedOf(str) { let h = 7; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

  const textures = {};

  function texture(mat) {
    if (textures[mat]) return textures[mat];
    const m = MATERIALS[mat] || MATERIALS.pierre;
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d');
    const r = prng(seedOf(mat));
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) px(x, y, m.base[r() < 0.55 ? 0 : r() < 0.6 ? 1 : 0]);

    if (mat === 'planche') {
      for (let x = 0; x < 8; x++) { px(x, 3, m.base[1]); px(x, 7, m.base[1]); px(x, 0, m.base[2]); px(x, 4, m.base[2]); }
      px(2, 1, m.base[1]); px(2, 2, m.base[1]); px(6, 5, m.base[1]); px(6, 6, m.base[1]);
    } else if (mat === 'brique') {
      for (let x = 0; x < 8; x++) { px(x, 3, m.base[2]); px(x, 7, m.base[2]); }
      for (let y = 0; y < 3; y++) px(3, y, m.base[2]);
      for (let y = 4; y < 7; y++) px(7, y, m.base[2]);
    } else if (mat === 'verre') {
      g.fillStyle = m.base[0]; g.fillRect(0, 0, 8, 8);
      g.fillStyle = m.base[1]; g.fillRect(0, 0, 8, 1); g.fillRect(0, 7, 8, 1); g.fillRect(0, 0, 1, 8); g.fillRect(7, 0, 1, 8);
      px(2, 2, m.base[2]); px(3, 3, m.base[2]); px(4, 4, m.base[2]); px(2, 5, m.base[2]);
    } else if (mat === 'herbe') {
      const greens = ['#5dbb3f', '#4aa32f', '#79d158'];
      for (let x = 0; x < 8; x++) {
        px(x, 0, greens[Math.floor(r() * 3)]);
        px(x, 1, greens[Math.floor(r() * 2)]);
        if (r() < 0.5) px(x, 2, greens[1]);
      }
    } else if (m.ore) {
      // amas de minerai
      [[1, 1], [2, 1], [1, 2], [5, 2], [6, 3], [5, 3], [2, 5], [3, 5], [3, 6], [6, 6]].forEach(([x, y], i) =>
        px(x, y, m.ore[i % 3 === 0 ? 1 : 0]));
    }
    textures[mat] = c;
    return c;
  }

  /** Dessine un bloc à l'écran avec un léger relief. */
  function drawBlock(g, mat, x, y, size, alpha) {
    g.save();
    g.imageSmoothingEnabled = false;
    if (alpha != null) g.globalAlpha = alpha;
    g.drawImage(texture(mat), x, y, size, size);
    const e = Math.max(1, Math.round(size / 8));
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, size, e); g.fillRect(x, y, e, size);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y + size - e, size, e); g.fillRect(x + size - e, y, e, size);
    g.restore();
  }

  /** Image (data URL) d'un bloc, pour les <img> de l'inventaire. */
  const iconCache = {};
  function blockIcon(mat, size) {
    size = size || 48;
    const k = mat + size;
    if (iconCache[k]) return iconCache[k];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    drawBlock(c.getContext('2d'), mat, 0, 0, size);
    return (iconCache[k] = c.toDataURL());
  }

  /* ---------- Le mineur (personnage original) ---------- */

  const MINER_PAL = {
    Y: '#f2c230', y: '#c99a17', L: '#fff7a8', S: '#f1b98b', s: '#d08f62', E: '#2b2b2b',
    R: '#d2483c', O: '#2f6fd0', o: '#1f4f9a', K: '#5a3a22', M: '#e58a72'
  };
  const MINER = [
    '...yYYYYy...',
    '..yYYYYYYYL.',
    '..YYYYYYYYLL',
    '..sSSSSSSS..',
    '..sSESSESS..',
    '..sSSSSSSS..',
    '...SSMMSS...',
    '..RROOOORR..',
    '.SRROOOORRS.',
    '.SRROOOORRS.',
    '...OOOOOO...',
    '...OOooOO...',
    '...OO..OO...',
    '...OO..OO...',
    '..KKK..KKK..',
    '..KKK..KKK..'
  ];
  const PICK_PAL = { P: '#c3ccd3', p: '#7d8a93', W: '#8b5a2b' };
  const PICK = [
    '.ppPPPPpp.',
    'pPP.WW.PPp',
    'P...WW...P',
    '....WW....',
    '....WW....',
    '....WW....',
    '....WW....',
    '....WW....'
  ];

  const REST = 0.35; // pioche posée, inclinée vers l'avant

  function drawSprite(g, rows, pal, x, y, s) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const col = pal[row[i]];
        if (col) { g.fillStyle = col; g.fillRect(x + i * s, y + j * s, s, s); }
      }
    });
  }

  /** Mineur + pioche. angle en radians (rotation de la pioche autour de la main). */
  function drawMiner(g, x, y, s, angle) {
    drawSprite(g, MINER, MINER_PAL, x, y, s);
    g.save();
    g.translate(x + 10.5 * s, y + 9 * s); // la main droite
    g.rotate(angle || 0);
    drawSprite(g, PICK, PICK_PAL, -5 * s, -7 * s, s);
    g.restore();
  }

  /**
   * Petite scène animée : le mineur casse un bloc à chaque bonne réponse.
   * scene.celebrate('or') : 3 coups de pioche, le bloc se fissure puis éclate.
   */
  function MinerScene(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.block = 'pierre';
    this.anim = null;
    this.draw(0);
  }

  MinerScene.prototype.size = function () {
    const r = this.c.getBoundingClientRect();
    const dpr = root.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
    return { w, h };
  };

  MinerScene.prototype.draw = function (t, state) {
    const { w, h } = this.size();
    const g = this.g;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    const s = Math.max(2, Math.min(Math.floor(h / 20), Math.floor(w / 30)));
    const mx = Math.floor(w / 2 - 14 * s), my = h - 16 * s - s;
    const bs = 8 * s;
    const bx = mx + 15 * s, by = h - bs - s;
    state = state || {};
    // ombre au sol
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(mx, h - s, 28 * s, s);
    // bloc à casser
    if (!state.broken) {
      const shake = state.shake ? Math.round(Math.sin(t / 20) * s * 0.5) : 0;
      drawBlock(g, this.block, bx + shake, by, bs);
      if (state.cracks) {
        g.fillStyle = 'rgba(0,0,0,0.55)';
        const cr = [[3, 1], [3, 2], [4, 3], [4, 4], [3, 5], [5, 4], [6, 5], [2, 6], [1, 3], [2, 3], [5, 1], [6, 2]];
        cr.slice(0, state.cracks * 4).forEach(([x, y]) => g.fillRect(bx + x * s, by + y * s, s, s));
      }
    }
    // éclats
    (state.particles || []).forEach((p) => {
      g.fillStyle = p.col;
      g.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    });
    const bob = state.swing == null ? Math.round(Math.sin(t / 400) * s * 0.4) : 0;
    drawMiner(g, mx, my + bob, s, state.swing != null ? state.swing : REST);
    // bloc gagné qui monte
    if (state.reward) {
      const p = state.rewardP;
      const sz = Math.round(bs * (0.6 + 0.4 * Math.min(1, p * 2)));
      drawBlock(g, state.reward, bx + (bs - sz) / 2, by - p * bs * 1.2, sz);
    }
  };

  MinerScene.prototype.idle = function () {
    cancelAnimationFrame(this.raf);
    const loop = (t) => { this.draw(t); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  };

  MinerScene.prototype.stop = function () { cancelAnimationFrame(this.raf); };

  MinerScene.prototype.celebrate = function (reward, onHit) {
    cancelAnimationFrame(this.raf);
    const start = performance.now();
    const hits = [0, 320, 640];
    let done = 0;
    let particles = null;
    const { w, h } = this.size();
    const s = Math.max(2, Math.min(Math.floor(h / 20), Math.floor(w / 30)));
    const blockCol = MATERIALS[this.block].base;
    return new Promise((resolve) => {
      const loop = (now) => {
        const t = now - start;
        const state = {};
        // balancement de la pioche : levée puis frappe
        const k = (t % 320) / 320;
        state.swing = t < 960 ? (k < 0.6 ? -1.6 * (k / 0.6) : -1.6 + 2.6 * ((k - 0.6) / 0.4)) : REST;
        while (done < hits.length && t >= hits[done] + 300) { done++; if (onHit) onHit(done); }
        state.cracks = Math.min(3, done);
        state.shake = t < 960;
        if (t >= 960) {
          state.broken = true;
          if (!particles) {
            const bx = w / 2 + s * 5, by = h - 8 * s;
            particles = Array.from({ length: 14 }, (_, i) => ({
              x: bx, y: by, vx: (Math.random() - 0.5) * s * 1.5, vy: -Math.random() * s * 1.8,
              col: blockCol[i % 2]
            }));
          }
          particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += s * 0.12; });
          state.particles = particles;
          state.reward = reward;
          state.rewardP = Math.min(1, (t - 960) / 700);
        }
        this.draw(now, state);
        if (t < 1900) this.raf = requestAnimationFrame(loop);
        else {
          this.block = randomMaterial(1);
          this.idle();
          resolve();
        }
      };
      this.raf = requestAnimationFrame(loop);
    });
  };

  /* ---------- Paysage de fond ---------- */

  function drawLandscape(canvas) {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const bs = Math.round(Math.max(28, Math.min(56, w / 18)));
    // ciel en bandes
    const sky = ['#6fc3ff', '#7ccaff', '#8ad1ff', '#9ad8ff', '#acdfff', '#bfe7ff'];
    const band = Math.ceil(h * 0.75 / sky.length);
    sky.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * band, w, band + 1); });
    g.fillStyle = sky[sky.length - 1]; g.fillRect(0, band * sky.length, w, h);
    // soleil carré
    g.fillStyle = '#fff3a3'; g.fillRect(w - bs * 3, bs, bs * 1.6, bs * 1.6);
    g.fillStyle = '#ffe066'; g.fillRect(w - bs * 3 + bs * 0.2, bs * 1.2, bs * 1.2, bs * 1.2);
    // nuages
    const r = prng(42);
    for (let i = 0; i < 5; i++) {
      const cx = r() * w, cy = bs * (0.6 + r() * 3), cw = bs * (2 + r() * 2);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(cx, cy, cw, bs * 0.5);
      g.fillRect(cx + cw * 0.2, cy - bs * 0.35, cw * 0.5, bs * 0.4);
    }
    // collines de blocs
    const cols = Math.ceil(w / bs) + 1;
    const ground = h - bs * 3;
    let height = 1;
    const r2 = prng(7);
    for (let i = 0; i < cols; i++) {
      if (r2() < 0.35) height = Math.max(0, Math.min(3, height + (r2() < 0.5 ? -1 : 1)));
      const top = ground - height * bs;
      for (let y = top, row = 0; y < h; y += bs, row++) {
        const mat = row === 0 ? 'herbe' : row < 3 ? 'terre' : (r2() < 0.08 ? 'charbon' : 'pierre');
        drawBlock(g, mat, i * bs, y, bs);
      }
      // quelques arbres
      if (r2() < 0.12 && i > 0 && i < cols - 2) drawTree(g, i * bs, top, bs);
    }
  }

  function drawTree(g, x, groundY, bs) {
    const trunk = '#7a4f28', leaves = ['#3f9d3a', '#2f8a2f', '#57b84a'];
    g.fillStyle = trunk;
    g.fillRect(x + bs * 0.35, groundY - bs * 2, bs * 0.3, bs * 2);
    for (let j = 0; j < 3; j++) for (let i = -1; i <= 1; i++) {
      if (j === 0 && i !== 0) continue;
      g.fillStyle = leaves[(i + j + 3) % 3];
      g.fillRect(x + i * bs * 0.5, groundY - bs * 2 - (2 - j) * bs * 0.5 - bs * 0.2, bs * 0.5 + 1, bs * 0.5 + 1);
    }
  }

  /* ---------- Mon monde : plans de construction ---------- */

  // '#' = bloc commun, 'w' = peu commun (fenêtres), '*' = rare (décorations).
  const PLANS = [
    { nom: 'la cabane', art: [
      '...**...',
      '..####..',
      '.######.',
      '########',
      '.#w##w#.',
      '.##..##.',
      '.######.'
    ] },
    { nom: 'la maison', art: [
      '......**......',
      '.....####.....',
      '....######....',
      '...########...',
      '..##########..',
      '.############.',
      '##############',
      '.#ww######ww#.',
      '.#ww##..##ww#.',
      '.#####..#####.',
      '.############.'
    ] },
    { nom: 'le château', art: [
      '*.*.*..............*.*.*',
      '#####..............#####',
      '#w#w#..............#w#w#',
      '#####..............#####',
      '######.#.#.##.#.#.######',
      '########################',
      '#w#w###ww######ww###w#w#',
      '##########....##########',
      '##########....##########',
      '##########....##########',
      '########################'
    ] }
  ];

  /** Liste des emplacements d'un plan, rangés du bas vers le haut. */
  function slotsOf(plan) {
    const art = plan.art, H = art.length;
    const slots = { 1: [], 2: [], 3: [] };
    for (let j = H - 1; j >= 0; j--) {
      for (let i = 0; i < art[j].length; i++) {
        const ch = art[j][i];
        const y = H - 1 - j;
        if (ch === '#') slots[1].push({ x: i, y });
        else if (ch === 'w') slots[2].push({ x: i, y });
        else if (ch === '*') slots[3].push({ x: i, y });
      }
    }
    return slots;
  }

  /** Plan n (après le château, on recommence des châteaux). */
  function planAt(n) { return PLANS[Math.min(n, PLANS.length - 1)]; }

  /**
   * Rejoue la liste des blocs gagnés pour savoir où chacun est posé.
   * Un bloc va dans le prochain emplacement de sa rareté du bâtiment en
   * cours ; s'il n'y en a plus, il sert de bloc commun. Quand les blocs
   * communs d'un bâtiment sont tous posés, on passe au suivant.
   */
  function layout(blocks) {
    const buildings = [];
    let cur = null;
    const open = (n) => {
      const plan = planAt(n);
      cur = { plan, n, slots: slotsOf(plan), placed: [], used: { 1: 0, 2: 0, 3: 0 } };
      buildings.push(cur);
    };
    open(0);
    blocks.forEach((mat) => {
      let r = (MATERIALS[mat] || {}).rarete || 1;
      if (cur.used[r] >= cur.slots[r].length) r = 1;
      const slot = cur.slots[r][cur.used[r]++];
      cur.placed.push({ x: slot.x, y: slot.y, mat });
      if (cur.used[1] >= cur.slots[1].length) open(buildings.length);
    });
    buildings.forEach((b) => {
      b.total = b.slots[1].length;
      b.done = b.used[1];
      b.w = b.plan.art[0].length; b.h = b.plan.art.length;
    });
    return buildings;
  }

  /** Dessine le monde dans un canvas (largeur selon le nombre de bâtiments). */
  function drawWorld(canvas, blocks, viewH) {
    const buildings = layout(blocks);
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const H = Math.round(viewH * dpr);
    const rows = 17; // hauteur du plus grand plan + ciel + sol
    const bs = Math.floor(H / rows);
    const gap = 3;
    let totalCols = gap;
    buildings.forEach((b) => { b.ox = totalCols; totalCols += b.w + gap; });
    totalCols += 4;
    const W = Math.max(Math.round(innerWidth * dpr), totalCols * bs);
    canvas.width = W; canvas.height = H;
    canvas.style.width = (W / dpr) + 'px';
    canvas.style.height = viewH + 'px';
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#8ad1ff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#bfe7ff'; g.fillRect(0, H * 0.5, W, H * 0.5);
    const groundY = H - bs * 3;
    for (let x = 0; x < W; x += bs) {
      drawBlock(g, 'herbe', x, groundY, bs);
      drawBlock(g, 'terre', x, groundY + bs, bs);
      drawBlock(g, 'pierre', x, groundY + bs * 2, bs);
    }
    buildings.forEach((b, k) => {
      const last = k === buildings.length - 1;
      // emplacements restants en fantôme pour le bâtiment en cours
      if (last) {
        [1, 2, 3].forEach((r) => b.slots[r].slice(b.used[r]).forEach((s) => {
          g.strokeStyle = 'rgba(255,255,255,0.55)';
          g.lineWidth = Math.max(1, bs / 16);
          g.setLineDash([bs / 6, bs / 6]);
          g.strokeRect((b.ox + s.x) * bs + 2, groundY - (s.y + 1) * bs + 2, bs - 4, bs - 4);
        }));
        g.setLineDash([]);
      }
      b.placed.forEach((p) => drawBlock(g, p.mat, (b.ox + p.x) * bs, groundY - (p.y + 1) * bs, bs));
    });
    // le mineur à côté du chantier
    const cur = buildings[buildings.length - 1];
    const ms = Math.max(2, Math.floor(bs / 8));
    drawMiner(g, (cur.ox + cur.w + 0.5) * bs, groundY - 16 * ms, ms, REST);
    return { buildings, scrollTo: Math.max(0, (cur.ox - 2) * bs / dpr) };
  }

  /* ---------- La mine des souvenirs (phase 2) ---------- */

  // Trésors spéciaux : un par semaine, dans cet ordre. Créations originales.
  const TREASURES = [
    { id: 'lanterne', nom: 'une lanterne' },
    { id: 'champignon', nom: 'un champignon lumineux' },
    { id: 'fossile', nom: 'un fossile' },
    { id: 'coffre', nom: 'un coffre' },
    { id: 'geode', nom: 'une géode' },
    { id: 'wagonnet', nom: 'un wagonnet' },
    { id: 'statue', nom: 'une statue d\'or' },
    { id: 'oeuf', nom: 'un œuf de pierre mystérieux' },
    { id: 'couronne', nom: 'la couronne de la mine' }
  ];
  /** n-ième trésor de la semaine (après la couronne : des géodes géantes). */
  function treasureNumber(n) {
    return TREASURES[n] || { id: 'geode', nom: 'une géode géante' };
  }
  function treasureName(id) {
    const t = TREASURES.find((x) => x.id === id);
    return t ? t.nom : 'une géode géante';
  }

  const TREASURE_PAL = {
    k: '#2b2b2b', y: '#ffd23a', o: '#e0a800', w: '#fff7c2', b: '#8b5a2b', d: '#5a3a22', g: '#c3ccd3', G: '#7d8a93',
    p: '#b98cff', P: '#7b4fc8', r: '#e0245e', R: '#ff8fb1', c: '#e9e2cf', C: '#bfb59a', m: '#e04848', M: '#ffffff',
    t: '#4fd2c8', T: '#2f9f98'
  };
  const TREASURE_ART = {
    lanterne: ['..kkkk..', '..k..k..', '.kkkkkk.', '.kyywyk.', '.kywyyk.', '.kyyyyk.', '.kkkkkk.', '..kkkk..'],
    champignon: ['..tttt..', '.tTttTt.', 'tttTtttt', 'TTTTTTTT', '...cc...', '...cc...', '..cccc..', '........'],
    fossile: ['..cccc..', '.cCCCCc.', 'cC.cc.Cc', 'cC.cC.Cc', 'cC..cCCc', '.cCcccc.', '..cc....', '........'],
    coffre: ['.dddddd.', 'dbbbbbbd', 'dbbbbbbd', 'ddddyddd', 'dbbbybbd', 'dbbbbbbd', 'dbbbbbbd', 'dddddddd'],
    geode: ['..GGGG..', '.GpPpPG.', 'GpPMpPpG', 'GPpPpMPG', 'GpMPpPpG', 'GPpPpPPG', '.GPpPpG.', '..GGGG..'],
    wagonnet: ['........', 'GggggggG', 'GoyoyooG', 'GooyoooG', 'GGGGGGGG', '.G....G.', 'kk....kk', 'kk....kk'],
    statue: ['...oo...', '..oyyo..', '..oyyo..', '...oo...', '.oyyyyo.', '..oyyo..', '..oyyo..', '.oooooo.'],
    oeuf: ['...cc...', '..cCcc..', '.ccctcc.', '.cCcccc.', 'cctcccCc', 'ccccCcc.', '.cccccc.', '..cccc..'],
    couronne: ['........', 'y..y..y.', 'yy.yy.yy', 'yryyyryy', 'yyyyyyyy', 'oooooooo', 'yyyyyyyy', '........']
  };

  /** Image (data URL) d'un trésor. */
  function treasureIcon(id, size) {
    size = size || 48;
    const k = 't' + id + size;
    if (iconCache[k]) return iconCache[k];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    drawSprite(g, TREASURE_ART[id] || TREASURE_ART.geode, TREASURE_PAL, 0, 0, size / 8);
    return (iconCache[k] = c.toDataURL());
  }

  /** Couche de roche selon la profondeur. */
  function layerAt(d) {
    if (d < 0) return 'herbe';
    if (d < 10) return 'terre';
    if (d < 30) return 'pierre';
    if (d < 60) return 'ardoise';
    if (d < 100) return 'cristal';
    return 'magma';
  }
  function layerName(d) {
    return d < 10 ? 'la terre' : d < 30 ? 'la pierre' : d < 60 ? 'la roche sombre' : d < 100 ? 'la grotte de cristal' : 'le cœur de magma';
  }

  /**
   * Coupe de la mine autour de la profondeur actuelle : le puits creusé au
   * centre, le mineur au fond et les trésors trouvés dans les parois, à la
   * profondeur où ils ont été trouvés (found : [{ id, depth }]).
   */
  function drawMine(canvas, depth, viewW, viewH, found) {
    const byDepth = {};
    (found || []).forEach((f) => { (byDepth[f.depth] = byDepth[f.depth] || []).push(f.id); });
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = Math.round(viewW * dpr), H = Math.round(viewH * dpr);
    canvas.width = W; canvas.height = H;
    canvas.style.width = viewW + 'px'; canvas.style.height = viewH + 'px';
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rows = 9;
    const bs = Math.floor(H / rows);
    const cols = Math.ceil(W / bs);
    const mid = Math.floor(cols / 2);
    const top = depth - 6; // profondeur de la première rangée affichée
    for (let r = 0; r < rows + 1; r++) {
      const d = top + r;
      for (let c = 0; c < cols; c++) {
        const x = c * bs, y = r * bs;
        if (d < 0) { g.fillStyle = '#8ad1ff'; g.fillRect(x, y, bs, bs); continue; }
        const dug = c === mid && d <= depth;
        if (dug) {
          g.fillStyle = d === depth ? '#1d1a17' : '#2a2520';
          g.fillRect(x, y, bs, bs);
          // échelle
          g.fillStyle = '#8b5a2b';
          g.fillRect(x + bs * 0.2, y, bs * 0.1, bs); g.fillRect(x + bs * 0.7, y, bs * 0.1, bs);
          g.fillRect(x + bs * 0.2, y + bs * 0.45, bs * 0.6, bs * 0.1);
        } else {
          drawBlock(g, layerAt(d), x, y, bs);
        }
        // trésors trouvés : dans les parois à côté du puits
        const ids = byDepth[d];
        const k = c === mid + 1 ? 0 : c === mid - 1 ? 1 : -1;
        if (ids && k >= 0 && ids[k]) {
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 2, y + 2, bs - 4, bs - 4);
          g.drawImage(treasureCanvas(ids[k]), x + bs * 0.12, y + bs * 0.12, bs * 0.76, bs * 0.76);
        }
      }
    }
    // mineur au fond du puits
    const ms = Math.max(2, Math.floor(bs / 18));
    drawMiner(g, mid * bs + bs / 2 - 6 * ms, (depth - top + 1) * bs - 16 * ms, ms, REST);
    // repères de profondeur
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 0, bs * 1.6, H);
    g.fillStyle = '#fff';
    g.font = Math.round(bs * 0.32) + 'px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let r = 0; r < rows; r++) {
      const d = top + r;
      if (d >= 0 && d % 5 === 0) g.fillText(String(d), bs * 0.8, r * bs + bs / 2);
    }
  }

  const treasureCanvases = {};
  function treasureCanvas(id) {
    if (treasureCanvases[id]) return treasureCanvases[id];
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    drawSprite(c.getContext('2d'), TREASURE_ART[id] || TREASURE_ART.geode, TREASURE_PAL, 0, 0, 1);
    return (treasureCanvases[id] = c);
  }

  /** Icône de l'appli (utilisée pour générer les PNG du manifest). */
  function drawAppIcon(canvas, size, maskable) {
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#7ccaff'; g.fillRect(0, 0, size, size);
    const pad = maskable ? size * 0.12 : 0;
    const bs = (size - pad * 2) / 4;
    for (let i = 0; i < 4; i++) {
      drawBlock(g, 'herbe', pad + i * bs, size - pad - bs * 1.2, bs);
    }
    const s = Math.floor((size - pad * 2) / 28);
    drawMiner(g, pad + bs * 0.4, size - pad - bs * 1.2 - 16 * s, s, REST);
    drawBlock(g, 'or', pad + bs * 2.6, size - pad - bs * 2.2, bs);
  }

  root.Pixel = { MATERIALS, BY_RARITY, randomMaterial, texture, drawBlock, blockIcon, drawMiner,
    TREASURES, treasureNumber, treasureName, treasureIcon, layerName, drawMine,
    MinerScene, drawLandscape, PLANS, slotsOf, layout, drawWorld, drawAppIcon };
})(self);
