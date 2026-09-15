'use strict';
/* ============================================================================
 * Fathi browser chrome logic
 * ========================================================================== */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const t = (key, vars) => window.i18n.t(key, vars);

const view = $('#view');
const tabstrip = $('#tabstrip');
const omnibox = $('#omnibox');

const SEARCH_ENGINES = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
  startpage: 'https://www.startpage.com/sp/search?query='
};

const state = {
  tabs: [],
  activeId: null,
  settings: null,
  info: null,
  extensions: [],
  section: 'general',
  devices: [],
  deviceGroups: {},
  desktop: { id: 'desktop', name: 'Desktop', mobile: false }
};

