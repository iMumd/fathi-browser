'use strict';
/**
 * Session factory / hardening.
 *
 * Every tab uses an in-memory session (partition without a "persist:" prefix).
 * This module attaches everything that makes the tab look like its own real
 * browser: request headers, UA, client hints, language, permissions, download
 * sandboxing and proxy.
 */
const path = require('node:path');
const proxyMgr = require('./proxy');
const extMgr = require('./extensions');
const settings = require('./settings');

/* ------------------------------------------------------------ header spoof */

function buildClientHints(fp) {
  const brands = (fp.uaBrands || []).map((b) => `"${b.brand}";v="${b.version}"`).join(', ');
  return {
    'sec-ch-ua': brands,
    'sec-ch-ua-mobile': fp.uaMobile ? '?1' : '?0',
    'sec-ch-ua-platform': `"${fp.uaDataPlatform}"`,
    'sec-ch-ua-platform-version': `"${fp.platformVersion}"`,
    'sec-ch-ua-arch': `"${fp.architecture}"`,
    'sec-ch-ua-bitness': `"${fp.bitness}"`,
    'sec-ch-ua-model': '""',
    'sec-ch-ua-full-version': `"${fp.uaFullVersion}"`,
    'sec-ch-ua-full-version-list': (fp.uaFullVersionList || [])
      .map((b) => `"${b.brand}";v="${b.version}"`).join(', ')
  };
}

function acceptLanguage(fp) {
  const langs = fp.languages || [fp.language];
  return langs.map((l, i) => (i === 0 ? l : `${l};q=${Math.max(0.1, 1 - i * 0.1).toFixed(1)}`)).join(',');
