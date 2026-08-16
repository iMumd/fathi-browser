'use strict';
/**
 * Chrome Web Store extension support.
 *
 * Electron can load unpacked extensions. To install directly from the store we
 * download the official CRX from Google's update endpoint, strip the CRX header
 * and load the payload as an unpacked extension. Extensions are loaded into
 * every live tab session (so they work in any tab) and into every new session.
 */
const fs = require('node:fs');
const path = require('node:path');
const { app, net, session, dialog, BrowserWindow } = require('electron');
const AdmZip = require('adm-zip');

const STORE_ID_RE = /^[a-p]{32}$/;

function extRoot() {
  return path.join(app.getPath('userData'), 'fathi-ext');
}

function extractId(input) {
  const raw = String(input || '').trim();
  if (STORE_ID_RE.test(raw)) return raw;
  const m = raw.match(/[a-p]{32}/);
  return m ? m[0] : null;
}

/** CRX3 = "Cr24" + version + header length + header (protobuf) + ZIP */
function stripCrx(buf) {
  const magic = buf.subarray(0, 4).toString('ascii');
  if (magic !== 'Cr24') return buf;                    // maybe already a zip
  const version = buf.readUInt32LE(4);
  if (version === 3) {
    const headerLen = buf.readUInt32LE(8);
    return buf.subarray(12 + headerLen);
  }
  if (version === 2) {
    const pubLen = buf.readUInt32LE(8);
    const sigLen = buf.readUInt32LE(12);
    return buf.subarray(16 + pubLen + sigLen);
  }
  return buf;
}

