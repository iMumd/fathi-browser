'use strict';
const research = require('../shared/research');
let current = { include: [], exclude: [], onlyIntercept: false };
function get() { return { ...current, include: [...current.include], exclude: [...current.exclude] }; }
function set({ include = '', exclude = '', onlyIntercept = false } = {}) {
  const next = { include: research.scopeRules(include), exclude: research.scopeRules(exclude), onlyIntercept: !!onlyIntercept };
  if (next.onlyIntercept && !next.include.length) throw new Error('research.emptyScope');
  current = next;
  return get();
}
function allows(url) { return !current.onlyIntercept || research.inScope(url, current); }
module.exports = { get, set, allows };
