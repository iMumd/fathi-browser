'use strict';
/**
 * Generates the NSIS installer header + sidebar bitmaps (24-bit BMP).
 *   node tools/make-installer-art.js
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const ICON = path.join(ROOT, 'assets', 'icon-256.png');

/** Minimal bottom-up 24-bit BMP encoder. */
function encodeBmp(rgb, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const fileSize = 54 + pixelSize;
  const buf = Buffer.alloc(fileSize);

  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(54, 10);

  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  for (let y = 0; y < height; y += 1) {
    const src = (height - 1 - y) * width * 3;
    const dst = 54 + y * rowSize;
    for (let x = 0; x < width; x += 1) {
      buf[dst + x * 3] = rgb[src + x * 3 + 2];      // B
      buf[dst + x * 3 + 1] = rgb[src + x * 3 + 1];  // G
      buf[dst + x * 3 + 2] = rgb[src + x * 3];      // R
    }
  }
  return buf;
}

async function renderBmp(svg, width, height, out) {
  const rgb = await sharp(Buffer.from(svg), { density: 300 })
    .resize(width, height, { fit: 'fill' })
    .flatten({ background: '#0E0F11' })
    .removeAlpha()
    .raw()
    .toBuffer();
  fs.writeFileSync(out, encodeBmp(rgb, width, height));
}

function headerSvg(iconB64) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57">
    <rect width="150" height="57" fill="#0E0F11"/>
    <image x="10" y="8" width="41" height="41" href="data:image/png;base64,${iconB64}"/>
    <text x="60" y="27" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="600" fill="#E7E9EC">Fathi</text>
    <text x="60" y="42" font-family="Segoe UI, Arial, sans-serif" font-size="8" fill="#8FB4D6">Private browser</text>
  </svg>`;
}

function sidebarSvg(iconB64, version) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314">
    <rect width="164" height="314" fill="#0E0F11"/>
    <image x="32" y="52" width="100" height="100" href="data:image/png;base64,${iconB64}"/>
    <text x="82" y="190" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="600" letter-spacing="3" fill="#E7E9EC">FATHI</text>
    <text x="82" y="211" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#8FB4D6">فتحي</text>
    <line x1="46" y1="230" x2="118" y2="230" stroke="#24262A" stroke-width="1"/>
    <text x="82" y="250" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="8" fill="#8B9098">A private identity in every tab</text>
    <text x="82" y="292" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="8" fill="#63686F">Version ${version}</text>
  </svg>`;
}

async function main() {
  fs.mkdirSync(BUILD, { recursive: true });
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const iconB64 = fs.readFileSync(ICON).toString('base64');

  await renderBmp(headerSvg(iconB64), 150, 57, path.join(BUILD, 'installerHeader.bmp'));
  await renderBmp(sidebarSvg(iconB64, pkg.version), 164, 314, path.join(BUILD, 'installerSidebar.bmp'));
  await renderBmp(sidebarSvg(iconB64, pkg.version), 164, 314, path.join(BUILD, 'uninstallerSidebar.bmp'));

  console.log('installer art written: build/installerHeader.bmp, build/installerSidebar.bmp, build/uninstallerSidebar.bmp');
}

main().catch((e) => { console.error(e); process.exit(1); });
