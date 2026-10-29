/* Tests for apps-script/Code.gs, run against a pretend Google Sheet. Run:  node tests/code.test.js */
'use strict';
const { test, assert, done } = require('./harness');
const { createEnv } = require('./mock-gas');

let n = 0;
const rid = () => 'rid' + (++n) + 'xxxxxx';
const start = (token, device, fields) => ({ rid: rid(), action: 'start', token, device: device || 'devA1', fields: fields || { token, status: 'Playing' }, logs: [{ t: '2026-10-30T10:00:00.000Z', item: 'Game start', answer: token, note: '' }] });
const save = (token, fields, logs, device) => ({ rid: rid(), action: 'save', token, device: device || 'devA1', fields: fields || {}, logs: logs || [] });
const fresh = () => { const e = createEnv(); e.setup(); return e; };

(async () => {
console.log('Code.gs');

await test('setup() makes Players and Swipe log with the right headers, and leaves Sheet1 alone', () => {
  const e = createEnv(); e.setup();
  const p = e.sheet('Players'), l = e.sheet('Swipe log');
  assert.deepEqual(p.table()[0], e.COLUMNS.map(c => c.label));
  assert.deepEqual(l.table()[0], e.LOG_COLUMNS.map(c => c.label));
  assert.ok(e.sheet('Sheet1'), 'Sheet1 must not be deleted');
  assert.equal(p.frozen, 1);
});
await test('Players columns follow the game order and include the requested extras', () => {
  const e = createEnv(); const keys = e.COLUMNS.map(c => c.key);
  const order = ['token', 'shortlist', 'factor', 'lender', 'taken', 'coins', 'guess', 'fund', 'work', 'channel'];
  let last = -1; order.forEach(k => { const i = keys.indexOf(k); assert.ok(i > last, k + ' is out of play order'); last = i; });
  ['qRate', 'qType', 'fType', 'fSecurity', 'changes', 'offBy', 'guessSecs', 'device', 'status'].forEach(k => assert.ok(keys.includes(k), 'missing ' + k));
  assert.equal(new Set(keys).size, keys.length, 'duplicate keys');
});
await test('running setup() twice changes nothing the second time', () => {
  const e = createEnv(); e.setup(); const w = e.writes; const out = e.setup();
  assert.equal(e.writes, w); assert.match(out, /already set up/);
  assert.equal(e.ss.sheets.length, 3);
});
await test('an old-layout Players tab is RENAMED (data kept), never deleted', () => {
  const e = createEnv(); const old = e.ss.insertSheet('Players');
  old.getRange(1, 1, 1, 3).setValues([['Name', 'Choice', 'Guess']]); old.getRange(2, 1, 1, 3).setValues([['Asha', 'Harbor', 12]]);
  e.setup();
  const renamed = e.sheet('Players (old layout)');
  assert.ok(renamed, 'old tab should be renamed'); assert.deepEqual(renamed.table()[1], ['Asha', 'Harbor', 12]);
  assert.deepEqual(e.sheet('Players').table()[0], e.COLUMNS.map(c => c.label));
  assert.equal(e.sheet('Players').getLastRow(), 1);
});
await test('a second old tab gets "(old layout) 2" and the first is untouched', () => {
  const e = createEnv(); let o = e.ss.insertSheet('Players'); o.getRange(1, 1).setValue('A1'); e.setup();
  o = e.sheet('Players'); e.sheet('Players').getRange(1, 1).setValue('Changed'); e.setup();
  assert.ok(e.sheet('Players (old layout)')); assert.ok(e.sheet('Players (old layout) 2'));
  assert.equal(e.sheet('Players (old layout)').table()[0][0], 'A1');
});
await test('an empty tab called Players is simply filled, not renamed', () => {
  const e = createEnv(); e.ss.insertSheet('Players'); e.setup();
  assert.equal(e.sheet('Players (old layout)'), null); assert.equal(e.sheet('Players').table()[0][0], 'Token');
});
await test('doGet answers so the link can be tested in a browser', () => {
  const r = fresh().get(); assert.equal(r.ok, true); assert.equal(r.code, 'ALIVE');
});

await test('start registers a token with attempt 1, status, device and times', () => {
  const e = fresh(); const r = e.post(start('482'));
  assert.equal(r.ok, true); assert.equal(r.code, 'STARTED');
  const row = e.rowObj('482');
  assert.equal(row.token, '482'); assert.equal(row.attempt, 1); assert.equal(row.status, 'Playing'); assert.equal(row.device, 'devA1');
  assert.ok(row.started instanceof Date && row.updated instanceof Date); assert.equal(row.finished, '');
});
await test('a token that already exists is refused with TOKEN_EXISTS and nothing changes', () => {
  const e = fresh(); e.post(start('482')); const logsBefore = e.sheet('Swipe log').getLastRow(), snap = JSON.stringify(e.sheet('Players').table());
  const r = e.post(start('482', 'otherPhone'));
  assert.equal(r.ok, false); assert.equal(r.code, 'TOKEN_EXISTS'); assert.match(r.message, /already exists/);
  assert.equal(JSON.stringify(e.sheet('Players').table()), snap); assert.equal(e.sheet('Swipe log').getLastRow(), logsBefore);
});
await test('the same phone asking again resumes; a finished token cannot be reused', () => {
  const e = fresh(); e.post(start('482')); e.post(save('482', { lender: 'Harbor' }));
  const again = e.post(start('482', 'devA1', { token: '482', lender: '' }));
  assert.equal(again.ok, true); assert.equal(again.code, 'RESUMED'); assert.equal(e.rowObj('482').lender, 'Harbor', 'a resume must not wipe progress');
  e.post(save('482', { status: 'Finished' }));
  const r = e.post(start('482')); assert.equal(r.code, 'TOKEN_EXISTS');
});
await test('leading zeros are kept and 007 is different from 7', () => {
  const e = fresh(); assert.equal(e.post(start('007')).ok, true); assert.equal(e.post(start('7', 'x2')).ok, true);
  assert.equal(e.rowObj('007').token, '007'); assert.equal(typeof e.rowObj('007').token, 'string');
  assert.equal(e.post(start('007', 'x3')).code, 'TOKEN_EXISTS');
});
await test('save overwrites with the latest snapshot (undo works) and sets Last update', () => {
  const e = fresh(); e.post(start('482'));
  e.post(save('482', { lender: 'Harbor', qRate: 8.5, taken: 'No co-borrower; Lock the rate' }));
  assert.equal(e.rowObj('482').lender, 'Harbor'); assert.equal(e.rowObj('482').qRate, 8.5);
  e.post(save('482', { lender: 'Cedar', qRate: 8.75, taken: '' }));
  const row = e.rowObj('482'); assert.equal(row.lender, 'Cedar'); assert.equal(row.qRate, 8.75); assert.equal(row.taken, '');
});
await test('text that looks like a number or formula stays text', () => {
  const e = fresh(); e.post(start('482'));
  e.post(save('482', { perks: '+1 year moratorium', changes: '=SUM(1,2)', coins: '-1' }, [{ t: '2026-10-30T10:01:00Z', item: 'Coin: Trips', answer: '+1', note: '-1' }, { t: '2026-10-30T10:01:01Z', item: 'Coin: Trips', answer: '-1', note: '=1+1' }]));
  const row = e.rowObj('482'); assert.equal(row.perks, '+1 year moratorium'); assert.equal(row.changes, '=SUM(1,2)'); assert.equal(row.coins, '-1');
  const log = e.sheet('Swipe log').table(); assert.equal(log[2][4], '+1'); assert.equal(typeof log[2][4], 'string'); assert.equal(log[3][4], '-1'); assert.equal(log[3][5], '=1+1');
});
await test('the Swipe log gets one row per action with time, token, attempt, item, answer, note, device, rid', () => {
  const e = fresh(); const s = start('482'); e.post(s);
  const sv = save('482', {}, [{ t: '2026-10-30T10:02:00Z', item: 'Swipe: Orchid', answer: 'Pass', note: 'card 1 of 8' }, { t: '2026-10-30T10:02:03Z', item: 'Swipe: Harbor', answer: 'Shortlist', note: 'card 2 of 8' }]); e.post(sv);
  const t = e.sheet('Swipe log').table(); assert.equal(t.length, 1 + 1 + 2);
  assert.deepEqual(t[2].slice(1), ['482', 1, 'Swipe: Orchid', 'Pass', 'card 1 of 8', 'devA1', sv.rid]); assert.ok(t[2][0] instanceof Date);
  assert.equal(t[1][3], 'Game start');
});
await test('the same request id twice is written once (idempotent)', () => {
  const e = fresh(); e.post(start('482')); const s = save('482', { lender: 'Harbor' }, [{ t: '2026-10-30T10:02:00Z', item: 'x', answer: 'y', note: '' }]);
  const a = e.post(s), rows = e.sheet('Swipe log').getLastRow(); const b = e.post(s);
  assert.equal(a.ok, true); assert.equal(b.ok, true); assert.equal(b.repeat, true); assert.equal(e.sheet('Swipe log').getLastRow(), rows);
});
await test('a start repeated with the same request id after success still says ok (lost reply)', () => {
  const e = fresh(); const s = start('482'); assert.equal(e.post(s).ok, true); const r = e.post(s); assert.equal(r.ok, true); assert.equal(r.repeat, true);
});
await test('a refused request is NOT remembered, so fixing the cause lets a retry through', () => {
  const e = createEnv(); const s = save('482', { lender: 'Harbor' });
  assert.equal(e.post(s).code, 'NO_PLAYERS_TAB'); e.setup(); e.post(start('482'));
  assert.equal(e.post(s).ok, true); assert.equal(e.rowObj('482').lender, 'Harbor');
});
await test('save for a token with no row says NO_PLAYER_ROW', () => {
  const e = fresh(); const r = e.post(save('999', { lender: 'x' })); assert.equal(r.ok, false); assert.equal(r.code, 'NO_PLAYER_ROW');
});
await test('save from a different phone is refused with DEVICE_MISMATCH', () => {
  const e = fresh(); e.post(start('482')); const r = e.post(save('482', { lender: 'x' }, [], 'intruder')); assert.equal(r.code, 'DEVICE_MISMATCH'); assert.equal(e.rowObj('482').lender, '');
});
await test('Finished sets "Finished at" once and keeps it', () => {
  const e = fresh(); e.post(start('482')); e.post(save('482', { status: 'Finished' })); const f1 = e.rowObj('482').finished; assert.ok(f1 instanceof Date);
  e.post(save('482', { status: 'Finished', fund: 'Family pays' })); assert.equal(e.rowObj('482').finished.getTime(), f1.getTime());
});
await test('changed headers: a clear PLAYERS_LAYOUT error, data untouched', () => {
  const e = fresh(); e.post(start('482')); e.sheet('Players').getRange(1, 3).setValue('Renamed by someone');
  const r = e.post(save('482', { lender: 'x' })); assert.equal(r.ok, false); assert.equal(r.code, 'PLAYERS_LAYOUT'); assert.match(r.message, /setup\(\)/);
  assert.equal(e.rowObj('482')?.token ?? e.sheet('Players').table()[1][0], '482');
});
await test('missing Players tab (renamed by hand): NO_PLAYERS_TAB', () => {
  const e = fresh(); e.sheet('Players').setName('Players copy'); assert.equal(e.post(start('1234')).code, 'NO_PLAYERS_TAB');
});
await test('changed Swipe log headers: LOG_LAYOUT and nothing is written to Players either', () => {
  const e = fresh(); e.sheet('Swipe log').getRange(1, 2).setValue('Who'); const before = JSON.stringify(e.sheet('Players').table());
  const r = e.post(start('482')); assert.equal(r.code, 'LOG_LAYOUT'); assert.equal(JSON.stringify(e.sheet('Players').table()), before);
});
await test('bad requests get a clear code', () => {
  const e = fresh();
  assert.equal(e.postRaw('not json').code, 'BAD_JSON'); assert.equal(e.postRaw('').code, 'BAD_JSON'); assert.equal(e.postRaw('[]').code, 'BAD_REQUEST');
  assert.equal(e.post({ ...start('482'), action: 'drop' }).code, 'UNKNOWN_ACTION');
  assert.equal(e.post({ ...start('48a') }).code, 'BAD_TOKEN'); assert.equal(e.post({ ...start('482'), rid: '!' }).code, 'BAD_RID');
  assert.equal(e.post({ ...start('482'), device: '' }).code, 'BAD_REQUEST');
  assert.equal(e.post({ ...start('482'), fields: { started: 'now' } }).code, 'BAD_FIELD', 'server-owned columns are protected');
  assert.equal(e.post({ ...start('482'), fields: { nonsense: 1 } }).code, 'BAD_FIELD');
  assert.equal(e.post({ ...start('482'), fields: { lender: { a: 1 } } }).code, 'BAD_FIELD');
  assert.equal(e.sheet('Players').getLastRow(), 1, 'nothing written for bad requests');
});
await test('every write happens inside the lock, and a lock timeout gives BUSY with nothing written', () => {
  const e = fresh(); const w0 = e.writes;
  assert.equal(e.post(start('482')).ok, true); assert.equal(e.lockWaits >= 1, true); assert.equal(e.lockDepth, 0, 'lock must be released');
  e.failLock = true; const r = e.post(save('482', { lender: 'x' })); assert.equal(r.code, 'BUSY'); assert.equal(e.rowObj('482').lender, '');
  e.failLock = false; assert.ok(e.writes > w0);
});
await test('the lock is released even when something throws', () => {
  const e = fresh(); e.post(start('482')); const orig = e.sheet('Players').getRange.bind(e.sheet('Players'));
  e.sheet('Players').getRange = () => { throw new Error('boom'); };
  const r = e.post(save('482', { lender: 'x' })); assert.equal(r.code, 'SERVER_ERROR'); assert.equal(e.lockDepth, 0);
  e.sheet('Players').getRange = orig; assert.equal(e.post(save('482', { lender: 'x' })).ok, true);
});
await test('the sheet grows past its first 1000 rows and 26 columns without errors', () => {
  const e = fresh(); assert.ok(e.sheet('Players').getMaxColumns() >= e.COLUMNS.length);
  for (let i = 0; i < 1010; i++) { const r = e.post(start(String(100000 + i), 'd' + i)); if (!r.ok) throw new Error('row ' + i + ' failed: ' + r.message); }
  assert.equal(e.sheet('Players').getLastRow(), 1011); assert.equal(e.rowObj('101009').token, '101009');
});
await test('topGuesses ranks by Off by, then by faster time, and only reads', () => {
  const e = fresh();
  [['111', 5000, 9.1], ['222', 1200, 20.0], ['333', 1200, 8.4], ['444', 'x', 3.0]].forEach(([t, off, secs]) => {
    e.post(start(t, 'd' + t)); e.post(save(t, { offBy: off === 'x' ? '' : off, guessSecs: secs, status: 'Finished' }, [], 'd' + t));
  });
  const w = e.writes, lines = e.topGuesses();
  assert.equal(e.writes, w, 'topGuesses must not write'); assert.equal(lines.length, 3);
  assert.match(lines[0], /Token 333/); assert.match(lines[1], /Token 222/); assert.match(lines[2], /Token 111/);
});
await test('nothing in the script can delete data (no clear/delete calls)', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ''), /\.(clear|clearContent|deleteRow|deleteRows|deleteSheet|deleteColumn|removeSheet|remove)\s*\(/);
});

done('Code.gs tests');
})();
