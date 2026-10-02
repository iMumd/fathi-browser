'use strict';
/**
 * Renders assets/icon.svg into every format the build needs.
 *   node tools/make-icons.js
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SVG = path.join(ROOT, 'assets', 'icon.svg');
const OUT_BUILD = path.join(ROOT, 'build');
const OUT_ICONS = path.join(OUT_BUILD, 'icons');
const OUT_ASSETS = path.join(ROOT, 'assets');

for (const d of [OUT_BUILD, OUT_ICONS, OUT_ASSETS]) fs.mkdirSync(d, { recursive: true });

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

/** Build a multi-resolution .ico that embeds PNG frames. */
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);       // reserved
  header.writeUInt16LE(1, 2);       // type: icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;

  for (const { size, data } of pngBuffers) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);        // width
    e.writeUInt8(size >= 256 ? 0 : size, 1);        // height
    e.writeUInt8(0, 2);                             // palette
    e.writeUInt8(0, 3);                             // reserved
    e.writeUInt16LE(1, 4);                          // colour planes
    e.writeUInt16LE(32, 6);                         // bpp
    e.writeUInt32LE(data.length, 8);                // size
    e.writeUInt32LE(offset, 12);                    // offset
    entries.push(e);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.data)]);
}
