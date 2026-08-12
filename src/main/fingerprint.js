'use strict';
/**
 * Fingerprint factory.
 *
 * Every tab receives a complete, internally-consistent device identity:
 *   user-agent, client hints, platform, languages, timezone, screen, hardware,
 *   WebGL vendor/renderer, canvas + audio noise seeds, fonts, plugins.
 *
 * Profiles are drawn from realistic pools per OS so that the identity is
 * coherent (a Windows UA gets a Windows GPU string, a Mac UA gets an Apple GPU).
 */

const crypto = require('node:crypto');
const devices = require('./devices');

const REAL_CHROME = (() => {
  const v = String(process.versions.chrome || '140.0.0.0').split('.');
  return parseInt(v[0], 10) || 140;
})();

/* ------------------------------------------------------------------ pools */

const LANG_POOL = [
  { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York' },
  { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Chicago' },
  { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Los_Angeles' },
  { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Denver' },
  { language: 'en-GB', languages: ['en-GB', 'en'], timezone: 'Europe/London' },
  { language: 'en-CA', languages: ['en-CA', 'en', 'fr-CA'], timezone: 'America/Toronto' },
  { language: 'en-AU', languages: ['en-AU', 'en'], timezone: 'Australia/Sydney' },
  { language: 'de-DE', languages: ['de-DE', 'de', 'en'], timezone: 'Europe/Berlin' },
  { language: 'fr-FR', languages: ['fr-FR', 'fr', 'en'], timezone: 'Europe/Paris' },
  { language: 'es-ES', languages: ['es-ES', 'es', 'en'], timezone: 'Europe/Madrid' },
  { language: 'it-IT', languages: ['it-IT', 'it', 'en'], timezone: 'Europe/Rome' },
  { language: 'nl-NL', languages: ['nl-NL', 'nl', 'en'], timezone: 'Europe/Amsterdam' },
  { language: 'pl-PL', languages: ['pl-PL', 'pl', 'en'], timezone: 'Europe/Warsaw' },
  { language: 'pt-BR', languages: ['pt-BR', 'pt', 'en'], timezone: 'America/Sao_Paulo' },
  { language: 'tr-TR', languages: ['tr-TR', 'tr', 'en'], timezone: 'Europe/Istanbul' },
  { language: 'ru-RU', languages: ['ru-RU', 'ru', 'en'], timezone: 'Europe/Moscow' },
  { language: 'ar-SA', languages: ['ar-SA', 'ar', 'en'], timezone: 'Asia/Riyadh' },
  { language: 'ar-AE', languages: ['ar-AE', 'ar', 'en'], timezone: 'Asia/Dubai' },
  { language: 'hi-IN', languages: ['hi-IN', 'hi', 'en'], timezone: 'Asia/Kolkata' },
  { language: 'id-ID', languages: ['id-ID', 'id', 'en'], timezone: 'Asia/Jakarta' },
  { language: 'ja-JP', languages: ['ja-JP', 'ja', 'en'], timezone: 'Asia/Tokyo' },
  { language: 'ko-KR', languages: ['ko-KR', 'ko', 'en'], timezone: 'Asia/Seoul' },
  { language: 'zh-CN', languages: ['zh-CN', 'zh', 'en'], timezone: 'Asia/Shanghai' },
  { language: 'vi-VN', languages: ['vi-VN', 'vi', 'en'], timezone: 'Asia/Ho_Chi_Minh' },
  { language: 'th-TH', languages: ['th-TH', 'th', 'en'], timezone: 'Asia/Bangkok' },
  { language: 'fil-PH', languages: ['fil-PH', 'fil', 'en'], timezone: 'Asia/Manila' },
  { language: 'sv-SE', languages: ['sv-SE', 'sv', 'en'], timezone: 'Europe/Stockholm' },
  { language: 'cs-CZ', languages: ['cs-CZ', 'cs', 'en'], timezone: 'Europe/Prague' }
];
