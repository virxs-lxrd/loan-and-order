/* A small pretend Google Sheet + Apps Script, so Code.gs can be tested on a laptop.
   It is strict on purpose: it refuses writes outside the grid, treats "+1" as a number
   unless the cell is text-formatted (like real Sheets), and refuses writes made without the lock. */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

class MockRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); sheet._check(r, c, nr, nc); }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = this.sheet._get(this.r + i, this.c + j); row.push(v === undefined ? '' : v); } o.push(row); } return o; }
  setValues(vals) {
    this.sheet._write();
    if (vals.length !== this.nr || vals.some(v => v.length !== this.nc)) throw new Error('Mock: setValues size mismatch ' + vals.length + 'x' + (vals[0] || []).length + ' vs ' + this.nr + 'x' + this.nc);
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet._set(this.r + i, this.c + j, vals[i][j]);
    return this;
  }
  setValue(v) { return this.setValues(Array.from({ length: this.nr }, () => Array(this.nc).fill(v))); }
  setNumberFormat(f) { this.sheet._write(); for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet._fmt[(this.r + i) + ',' + (this.c + j)] = f; return this; }
  setNumberFormats(fs_) { this.sheet._write(); for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet._fmt[(this.r + i) + ',' + (this.c + j)] = fs_[i][j]; return this; }
  getNumberFormats() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sheet._fmt[(this.r + i) + ',' + (this.c + j)] || ''); o.push(row); } return o; }
  setFontWeight() { this.sheet._write(); return this; }
  setBackground() { this.sheet._write(); return this; }
}
class MockSheet {
  constructor(env, name) { this.env = env; this.name = name; this.maxR = 1000; this.maxC = 26; this.cells = {}; this._fmt = {}; this.frozen = 0; }
  getName() { return this.name; }
  setName(n) { this._write(); this.name = n; }
  _write() { if (this.env.inRequest && this.env.lockDepth < 1) throw new Error('Mock: a sheet write happened outside the script lock'); this.env.writes++; }
  _check(r, c, nr, nc) { if (r < 1 || c < 1 || nr < 1 || nc < 1 || r + nr - 1 > this.maxR || c + nc - 1 > this.maxC) throw new Error('Mock: range outside the sheet: row ' + r + ' col ' + c + ' size ' + nr + 'x' + nc + ' (sheet is ' + this.maxR + 'x' + this.maxC + ')'); }
  _get(r, c) { return this.cells[r + ',' + c]; }
  _set(r, c, v) {
    const f = this._fmt[r + ',' + c];
    if (f !== '@' && typeof v === 'string') { if (/^[+-]?\d+(\.\d+)?$/.test(v)) v = Number(v); else if (v[0] === '=') v = { formula: v }; }
    if (f === '@' && typeof v === 'number') v = String(v);
    if (v === '' || v === undefined || v === null) delete this.cells[r + ',' + c]; else this.cells[r + ',' + c] = v;
  }
  getLastRow() { let m = 0; for (const k in this.cells) m = Math.max(m, +k.split(',')[0]); return m; }
  getLastColumn() { let m = 0; for (const k in this.cells) m = Math.max(m, +k.split(',')[1]); return m; }
  getMaxRows() { return this.maxR; }
  getMaxColumns() { return this.maxC; }
  insertRowsAfter(after, n) { this._write(); this.maxR += n; }
  insertColumnsAfter(after, n) { this._write(); this.maxC += n; }
  setFrozenRows(n) { this._write(); this.frozen = n; }
  getRange(r, c, nr, nc) { return new MockRange(this, r, c, nr || 1, nc || 1); }
  /* handy for tests */
  table() { const out = []; for (let r = 1; r <= this.getLastRow(); r++) { const row = []; for (let c = 1; c <= this.getLastColumn(); c++) { const v = this._get(r, c); row.push(v === undefined ? '' : v); } out.push(row); } return out; }
}
class MockSpreadsheet {
  constructor(env) { this.env = env; this.sheets = []; }
  getId() { return 'mock-sheet-id'; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { if (this.getSheetByName(n)) throw new Error('Mock: a sheet named ' + n + ' already exists'); this.env.writes++; const s = new MockSheet(this.env, n); this.sheets.push(s); return s; }
}

function createEnv(opts) {
  opts = opts || {};
  const env = { inRequest: false, lockDepth: 0, lockWaits: 0, writes: 0, logs: [], props: {}, cache: {}, ss: new MockSpreadsheet(null), failLock: false };
  env.ss.env = env;
  /* the default tab every new Google Sheet starts with */
  if (opts.defaultTab !== false) env.ss.sheets.push(new MockSheet(env, 'Sheet1'));
  const sandbox = {
    SpreadsheetApp: { getActiveSpreadsheet: () => (opts.noActive ? null : env.ss), openById: () => env.ss },
    LockService: { getScriptLock: () => ({
      waitLock() { if (env.failLock) throw new Error('Could not obtain lock'); env.lockDepth++; env.lockWaits++; },
      releaseLock() { env.lockDepth--; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in env.cache ? env.cache[k] : null), put: (k, v) => { env.cache[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => env.props[k] || null, setProperty: (k, v) => { env.props[k] = v; } }) },
    ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: s => ({ content: s, setMimeType() { return this; }, getContent() { return s; } }) },
    Logger: { log: s => env.logs.push(String(s)) },
    Date, JSON, Math, String, Number, Array, Object, Error, isNaN, isFinite, RegExp
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });
  env.sandbox = sandbox;
  env.COLUMNS = JSON.parse(vm.runInContext('JSON.stringify(COLUMNS)', sandbox));
  env.LOG_COLUMNS = JSON.parse(vm.runInContext('JSON.stringify(LOG_COLUMNS)', sandbox));
  env.setup = () => sandbox.setup();
  env.topGuesses = () => sandbox.topGuesses();
  env.get = () => JSON.parse(sandbox.doGet().content);
  env.postRaw = (str) => { env.inRequest = true; try { return JSON.parse(sandbox.doPost({ postData: { contents: str } }).content); } finally { env.inRequest = false; } };
  env.post = (obj) => env.postRaw(JSON.stringify(obj));
  env.sheet = (n) => env.ss.getSheetByName(n);
  env.rowObj = (token) => { const t = env.sheet('Players').table(); for (let i = 1; i < t.length; i++) if (String(t[i][0]) === String(token)) { const o = {}; env.COLUMNS.forEach((c, j) => { o[c.key] = t[i][j]; }); return o; } return null; };
  return env;
}
module.exports = { createEnv };
