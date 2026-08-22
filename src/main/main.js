}
// Chromium's cache / cookies / GPUCache all go here and are wiped on quit.
app.setPath('sessionData', TMP_SESSION);

/* --------------------------------------------------------------- modules */

const settings = require('./settings');
const fpgen = require('./fingerprint');
const proxyMgr = require('./proxy');
const extMgr = require('./extensions');
const devices = require('./devices');
const protocolPages = require('./protocol');
const { configureSession, applyCertTrust } = require('./session');
const intercept = require('./intercept');
const network = require('./network');

/* ----------------------------------------------------------------- state */

let mainWindow = null;

const fps = new Map();                 // fpId -> fingerprint
const partitions = new Map();          // partition -> { ses, fp }
const partitionFp = new Map();         // partition -> fpId

/* -------------------------------------------------------- protocol setup */

protocolPages.registerPrivileged();

/* -------------------------------------------------------------- sessions */

function ensureSession(partition, fp) {
  if (partitions.has(partition)) {
    const rec = partitions.get(partition);
    rec.fp = fp;
    return rec.ses;
  }

  // No "persist:" prefix => Chromium keeps this session in memory only.
  const ses = session.fromPartition(partition);
