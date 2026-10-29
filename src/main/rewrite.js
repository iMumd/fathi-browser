'use strict';
/**
 * Match and Replace rules.
 *
 * Rules are applied to every request header, request body, response header and
 * response body that flows through a tab session, so a payload can be rewritten
 * without an external tool. Rules live in settings and support both plain
 * substring replacement and regular expressions with capture groups ($1).
 *
 * Rule shape:
 *   { id, enabled, target, match, replace, regex, caseSensitive }
 *   target: 'requestHeader' | 'requestBody' | 'responseHeader' | 'responseBody'
 */

const HEADER_TARGETS = new Set(['requestHeader', 'responseHeader']);
const TARGETS = new Set(['requestHeader', 'requestBody', 'responseHeader', 'responseBody']);

function newId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function compile(rule) {
  const source = String(rule.match == null ? '' : rule.match);
  if (!source) return null;
  try {
    if (rule.regex) {
      return new RegExp(source, rule.caseSensitive ? 'g' : 'gi');
    }
    return new RegExp(
      source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      rule.caseSensitive ? 'g' : 'gi'
    );
  } catch {
    return null;
  }
}

/** Rules for one target, compiled once per call. */
function forTarget(rules, target) {
  if (!Array.isArray(rules)) return [];
  const out = [];
  for (const rule of rules) {
    if (!rule || rule.enabled === false) continue;
    if (!TARGETS.has(rule.target) || rule.target !== target) continue;
    const re = compile(rule);
    if (re) out.push({ re, replace: String(rule.replace == null ? '' : rule.replace), rule });
  }
  return out;
}

function applyString(value, compiled) {
  let text = String(value == null ? '' : value);
  let changed = false;
  for (const { re, replace } of compiled) {
    // A fresh lastIndex per call keeps global regexes deterministic.
    re.lastIndex = 0;
    const next = text.replace(re, replace);
    if (next !== text) {
      text = next;
      changed = true;
    }
  }
  return { text, changed };
}

/** Rewrite a header map (name -> value) in place-safe fashion. */
function applyHeaders(headers, rules, target) {
  const compiled = forTarget(rules, target);
  if (!compiled.length || !headers) return { headers, changed: false };
  const out = {};
  let changed = false;
  for (const [name, value] of Object.entries(headers)) {
    const res = applyString(String(value), compiled);
    if (res.changed) changed = true;
    out[name] = res.text;
  }
  return { headers: changed ? out : headers, changed };
}

function applyBody(body, rules, target) {
  const compiled = forTarget(rules, target);
  if (!compiled.length || body == null) return { body, changed: false };
  const res = applyString(body, compiled);
  if (!res.changed) return { body, changed: false };
  return { body: res.text, changed: true };
}

function describe(rule) {
  if (!rule) return '';
  const kind = rule.regex ? 'regex' : 'text';
  return `${kind}: ${rule.match} -> ${rule.replace}`;
}

/** Preview the same ordered rules used for live traffic, without network I/O. */
function test({ rules, target, payload } = {}) {
  if (!TARGETS.has(target)) throw new Error('Invalid rule target');
  if (typeof payload !== 'string' || payload.length > 65536) throw new Error('Payload must be text up to 64 KiB');
  if (!Array.isArray(rules) || rules.length > 100) throw new Error('At most 100 rules can be tested');
  for (const rule of rules) {
    if (rule.enabled !== false && rule.target === target && rule.match && !compile(rule)) {
      throw new Error('Invalid regular expression');
    }
  }
  const result = applyString(payload, forTarget(rules, target));
  return { output: result.text, changed: result.changed };
}

module.exports = {
  TARGETS, HEADER_TARGETS, forTarget, applyString, applyHeaders, applyBody, describe, newId, test
};
