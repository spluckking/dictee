// Génère les icônes PNG du manifest à partir du pixel art de js/pixel.js.
// Usage : node tools/make-icons.js   (nécessite Playwright + Chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  await page.addScriptTag({ path: path.join(root, 'js/pixel.js') });
  const sizes = [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['icon-180.png', 180, false]];
  for (const [name, size, maskable] of sizes) {
    const data = await page.evaluate(([s, m]) => {
      const c = document.getElementById('c');
      Pixel.drawAppIcon(c, s, m);
      return c.toDataURL('image/png');
    }, [size, maskable]);
    fs.writeFileSync(path.join(root, 'icons', name), Buffer.from(data.split(',')[1], 'base64'));
    console.log('icons/' + name);
  }
  await browser.close();
})();
