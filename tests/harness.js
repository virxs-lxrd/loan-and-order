/* tiny test runner, no installs needed */
'use strict';
const assert = require('node:assert/strict');
const results = { pass: 0, fail: 0 };
const pending = [];
function test(name, fn) {
  const p = (async () => {
    try { await fn(); results.pass++; console.log('  ok   ' + name); }
    catch (e) { results.fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').join('\n       ')); }
  })();
  pending.push(p); return p;
}
async function done(label) { await Promise.all(pending); console.log('\n' + label + ': ' + results.pass + ' passed, ' + results.fail + ' failed'); if (results.fail) process.exitCode = 1; }
module.exports = { test, assert, done, results };
