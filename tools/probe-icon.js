'use strict';
/** Quick visual sanity probe of the rendered icon (no image viewer needed). */
const path = require('node:path');
const fs = require('node:fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const png = path.join(ROOT, 'assets', 'icon-256.png');

(async () => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const at = (x, y) => {
    const i = (Math.round(y) * W + Math.round(x)) * C;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const probe = (name, x, y) => {
    const c = at((x / 1024) * W, (y / 1024) * H);
    console.log(`${name.padEnd(22)} (${x},${y}) -> rgba(${c.join(',')})`);
  };
  probe('bg corner', 60, 60);
  probe('crest left tip', 350, 230);
  probe('crest mid', 520, 200);
  probe('crest right', 690, 280);
  probe('head left', 380, 600);
  probe('head top', 512, 420);
  probe('face', 660, 640);
  probe('cheek', 632, 706);
  probe('eye', 566, 566);
  probe('beak', 745, 650);

  // dominance checks
  const orange = (() => { let n = 0; for (let i = 0; i < data.length; i += C) { const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]; if (a > 200 && r > 180 && g > 80 && b < 120) n++; } return n; })();
  console.log('\norange pixels:', orange, `(${(orange / (W * H) * 100).toFixed(1)}% of icon)`);

  // write a small preview strip: 16px + 32px upscaled so sizes are inspectable
  await sharp(path.join(ROOT, 'assets', 'icon-16.png')).resize(128, 128, { kernel: 'nearest' }).toFile(path.join(ROOT, 'assets', 'preview-16x.png'));
  await sharp(path.join(ROOT, 'assets', 'icon-32.png')).resize(128, 128, { kernel: 'nearest' }).toFile(path.join(ROOT, 'assets', 'preview-32x.png'));
  console.log('previews written: assets/preview-16x.png, assets/preview-32x.png');
})();
