'use strict';
/**
 * Persistent app settings (ONLY configuration, never browsing data).
 * Browsing state lives exclusively in in-memory sessions and dies with the app.
 */
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULT_PROXY = process.env.FATHI_PROXY || '';

const DEFAULTS = {
  version: 2,
  language: 'en',              // 'en' | 'ar'
  theme: 'dark',               // 'light' | 'dark'
  searchEngine: 'duckduckgo',
  newTabFocus: 'omnibox',
  defaultDevice: 'desktop',

  fingerprint: {
    enabled: true,
    spoofCanvas: true,
    spoofWebgl: true,
    spoofAudio: true,
    uniquePerTab: true
  },

  proxy: {
    enabled: false,
    pool: DEFAULT_PROXY ? [DEFAULT_PROXY] : [],
    mode: 'single',          // 'single' | 'rotate'
    bypass: '<local>',
    testUrl: 'https://api.ipify.org?format=json',
    dnsOverProxy: true,
    trustBurpCert: false     // accept MITM certs issued by the PortSwigger CA
  },
