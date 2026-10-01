'use strict';
/**
 * Downloads the curated Unsplash wallpaper set into assets/wallpapers/.
 * Run once at build time; the shipped app then always has high-quality
 * wallpapers available offline.
 *
 *   node tools/fetch-wallpapers.js
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'wallpapers');

const PHOTOS = [
  { id: 'photo-1506905925346-21bda4d32df4', name: 'alpine-dusk' },
  { id: 'photo-1470071459604-3b5ec3a7fe05', name: 'foggy-ridge' },
  { id: 'photo-1441974231531-c6227db76b6e', name: 'forest-light' },
  { id: 'photo-1501785888041-af3ef285b470', name: 'lake-valley' },
  { id: 'photo-1464822759023-fed622ff2c3b', name: 'peaks' },
  { id: 'photo-1447752875215-b2761acb3c5d', name: 'deep-woods' },
  { id: 'photo-1433086966358-54859d0ed716', name: 'waterfall' },
  { id: 'photo-1426604966848-d7adac402bff', name: 'green-basin' },
  { id: 'photo-1472214103451-9374bd1c798e', name: 'open-fields' },
  { id: 'photo-1418065460487-3e41a6c84dc5', name: 'quiet-forest' }
];

const WIDTH = 2560;
const HEIGHT = 1440;

async function download(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
