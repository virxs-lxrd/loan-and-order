/* =====================================================================
   LOAN & ORDER  -  Code.gs   (Google Apps Script, bound to your Google Sheet)

   What this does
   - setup()      Run ONCE by hand. Makes the "Players" and "Swipe log" tabs.
                  If an old "Players" tab with different headers exists, it is
                  RENAMED to "Players (old layout)". Nothing is ever deleted.
   - doPost()     The game sends every answer here. Each call is checked,
                  then written inside a lock, one at a time.
   - doGet()      Lets you open the web app link in a browser to test it.
   - topGuesses() Run by hand on the day. Shows the closest guesses in the log.
                  It only reads. It changes nothing.

   Every reply is JSON:  { ok, code, message }
   ===================================================================== */

var PLAYERS_TAB = 'Players';
var LOG_TAB = 'Swipe log';
var OLD_SUFFIX = ' (old layout)';
var CACHE_SECONDS = 21600; /* remember a request id for 6 hours, so a repeat is never written twice */

/* The Players tab. One row per token. Columns are in PLAY ORDER.
   key  = the name the game uses for this value (do not rename)
   label = the header written in row 1 of the sheet
   kind = how the cell is formatted: text, int, rate, secs, lakh, rupee, time
   server = filled in by this script, not by the game */
var COLUMNS = [
  { key: 'token',         label: 'Token',                              kind: 'text' },
  { key: 'attempt',       label: 'Attempt',                            kind: 'int' },
  { key: 'status',        label: 'Status',                             kind: 'text' },
  { key: 'screen',        label: 'Last screen',                        kind: 'text' },
  { key: 'started',       label: 'Started at',                         kind: 'time', server: true },
  { key: 'updated',       label: 'Last update',                        kind: 'time', server: true },
  { key: 'finished',      label: 'Finished at',                        kind: 'time', server: true },
  { key: 'shortlist',     label: 'Lenders shortlisted',                kind: 'text' },
  { key: 'factor',        label: 'Factor that mattered most',          kind: 'text' },
  { key: 'lender',        label: 'Lender locked in',                   kind: 'text' },
  { key: 'qRate',         label: 'Quoted rate (%)',                    kind: 'rate' },
  { key: 'qType',         label: 'Quoted rate type',                   kind: 'text' },
  { key: 'qLender',       label: 'Lender type',                        kind: 'text' },
  { key: 'qSecurity',     label: 'Quoted security',                    kind: 'text' },
  { key: 'qSanction',     label: 'Quoted sanction time',               kind: 'text' },
  { key: 'qApp',          label: 'Quoted application process',         kind: 'text' },
  { key: 'qYears',        label: 'Quoted repayment (years)',           kind: 'int' },
  { key: 'taken',         label: 'Add-ons taken',                      kind: 'text' },
  { key: 'skipped',       label: 'Add-ons skipped',                    kind: 'text' },
  { key: 'fRate',         label: 'Final rate (%)',                     kind: 'rate' },
  { key: 'fType',         label: 'Final rate type',                    kind: 'text' },
  { key: 'fSecurity',     label: 'Final security',                     kind: 'text' },
  { key: 'fSanction',     label: 'Final sanction time',                kind: 'text' },
  { key: 'fApp',          label: 'Final application process',          kind: 'text' },
  { key: 'fYears',        label: 'Final repayment (years)',            kind: 'int' },
  { key: 'perks',         label: 'Other perks added',                  kind: 'text' },
  { key: 'changes',       label: 'What changed in the upsell',         kind: 'text' },
  { key: 'coins',         label: 'Coins in each piggy bank',           kind: 'text' },
  { key: 'rateGuess',     label: 'Rate guess (%)',                     kind: 'rate' },
  { key: 'rateGuessSecs', label: 'Rate guess time (sec)',              kind: 'secs' },
  { key: 'guess',         label: 'Interest guess (Rs lakh)',           kind: 'lakh' },
  { key: 'guessSecs',     label: 'Interest guess time (sec)',          kind: 'secs' },
  { key: 'actual',        label: 'Actual interest, 5 years (Rs)',      kind: 'rupee' },
  { key: 'offBy',         label: 'Off by (Rs)',                        kind: 'rupee' },
  { key: 'fund',          label: 'How the MBA is paid for',            kind: 'text' },
  { key: 'work',          label: 'Work experience',                    kind: 'text' },
  { key: 'channel',       label: 'Preferred way to set up a loan',     kind: 'text' },
  { key: 'device',        label: 'Device',                             kind: 'text', server: true }
];

/* The Swipe log tab. One row per action. Only ever added to. */
var LOG_COLUMNS = [
  { key: 'time',    label: 'Time',       kind: 'time' },
  { key: 'token',   label: 'Token',      kind: 'text' },
  { key: 'attempt', label: 'Attempt',    kind: 'int' },
  { key: 'item',    label: 'Item',       kind: 'text' },
  { key: 'answer',  label: 'Answer',     kind: 'text' },
  { key: 'note',    label: 'Note',       kind: 'text' },
  { key: 'device',  label: 'Device',     kind: 'text' },
  { key: 'rid',     label: 'Request ID', kind: 'text' }
];

var FORMATS = { text: '@', int: '0', rate: '0.00', secs: '0.0', lakh: '0.00', rupee: '#,##0', time: 'yyyy-mm-dd hh:mm:ss' };

/* ---------------------------------------------------------------
   Small helpers
   --------------------------------------------------------------- */
function ok_(code, message, extra) {
  var o = { ok: true, code: code, message: message };
  if (extra) for (var k in extra) o[k] = extra[k];
  return o;
}
function fail_(code, message) { return { ok: false, code: code, message: message }; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function getSS_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : null;
}
function keyIndex_(cols) { var m = {}; for (var i = 0; i < cols.length; i++) m[cols[i].key] = i; return m; }
function ensureSize_(sheet, rows, cols) {
  if (sheet.getMaxColumns() < cols) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols - sheet.getMaxColumns());
  if (sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(rows - sheet.getMaxRows(), 200));
}
function headersMatch_(sheet, cols) {
  if (sheet.getLastColumn() < cols.length || sheet.getLastRow() < 1) return false;
  var have = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
  for (var i = 0; i < cols.length; i++) if (String(have[i]) !== cols[i].label) return false;
  return true;
}
function formatsFor_(cols) { return [cols.map(function (c) { return FORMATS[c.kind]; })]; }

/* ---------------------------------------------------------------
   setup()  -  run once by hand
   --------------------------------------------------------------- */
function setup() {
  var ss = getSS_();
  if (!ss) throw new Error('Open this script from inside your Google Sheet (Extensions > Apps Script).');
  var report = [];
  ensureTab_(ss, PLAYERS_TAB, COLUMNS, report);
  ensureTab_(ss, LOG_TAB, LOG_COLUMNS, report);
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  report.forEach(function (line) { Logger.log(line); });
  return report.join('\n');
}
function ensureTab_(ss, name, cols, report) {
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    if (headersMatch_(sheet, cols)) { report.push(name + ': already set up. Nothing changed.'); return; }
    if (sheet.getLastRow() === 0) { /* a completely empty tab: safe to fill */
      writeHeaders_(sheet, cols); report.push(name + ': was empty, headers added.'); return;
    }
    var base = name + OLD_SUFFIX, newName = base, n = 2;
    while (ss.getSheetByName(newName)) { newName = base + ' ' + n; n++; }
    sheet.setName(newName);
    report.push(name + ': the old tab did not match, so it was renamed to "' + newName + '". Nothing was deleted.');
  }
  var fresh = ss.insertSheet(name);
  writeHeaders_(fresh, cols);
  report.push(name + ': created.');
}
function writeHeaders_(sheet, cols) {
  ensureSize_(sheet, 200, cols.length);
  sheet.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c.label; })]).setFontWeight('bold').setBackground('#FFF2CC');
  sheet.setFrozenRows(1);
  for (var i = 0; i < cols.length; i++) {
    var rows = sheet.getMaxRows() - 1;
    if (rows > 0) sheet.getRange(2, i + 1, rows, 1).setNumberFormat(FORMATS[cols[i].kind]);
  }
}

/* ---------------------------------------------------------------
   The two tabs, checked before every write
   --------------------------------------------------------------- */
function playersTab(ss) {
  var sheet = ss.getSheetByName(PLAYERS_TAB);
  if (!sheet) return { error: fail_('NO_PLAYERS_TAB', 'The Players tab is missing. Run setup() once in Apps Script.') };
  if (!headersMatch_(sheet, COLUMNS)) return { error: fail_('PLAYERS_LAYOUT', 'The Players tab headers do not match this version of the script. Run setup(): it renames the old tab and never deletes it.') };
  return { sheet: sheet };
}
function logTab_(ss) {
  var sheet = ss.getSheetByName(LOG_TAB);
  if (!sheet) return { error: fail_('NO_PLAYERS_TAB', 'The Swipe log tab is missing. Run setup() once in Apps Script.') };
  if (!headersMatch_(sheet, LOG_COLUMNS)) return { error: fail_('LOG_LAYOUT', 'The Swipe log headers do not match this version of the script. Run setup(): it renames the old tab and never deletes it.') };
  return { sheet: sheet };
}

/* ---------------------------------------------------------------
   Web app entry points
   --------------------------------------------------------------- */
function doGet() {
  return json_(ok_('ALIVE', 'Loan and Order web app is running. The game talks to this address with POST. Nothing to see here.'));
}
function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || ''); }
  catch (err) { return json_(fail_('BAD_JSON', 'The request was not valid JSON.')); }
  return json_(handle_(body));
}

function validate_(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return fail_('BAD_REQUEST', 'The request must be a JSON object.');
  if (b.action !== 'start' && b.action !== 'save') return fail_('UNKNOWN_ACTION', 'Unknown action. Use "start" or "save".');
  if (typeof b.rid !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(b.rid)) return fail_('BAD_RID', 'The request id is missing or has odd characters.');
  if (typeof b.token !== 'string' || !/^[0-9]{1,20}$/.test(b.token)) return fail_('BAD_TOKEN', 'The token must be digits only.');
  if (typeof b.device !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(b.device)) return fail_('BAD_REQUEST', 'The device id is missing or has odd characters.');
  if (b.fields != null && (typeof b.fields !== 'object' || Array.isArray(b.fields))) return fail_('BAD_REQUEST', '"fields" must be an object.');
  if (b.logs != null && (!Array.isArray(b.logs) || b.logs.length > 300)) return fail_('BAD_REQUEST', '"logs" must be a list of at most 300 entries.');
  var idx = keyIndex_(COLUMNS), f = b.fields || {};
  for (var k in f) {
    if (!Object.prototype.hasOwnProperty.call(idx, k) || COLUMNS[idx[k]].server) return fail_('BAD_FIELD', 'Unknown or protected field: ' + k);
    var v = f[k], t = typeof v;
    if (!(v === null || t === 'string' || t === 'number' || t === 'boolean')) return fail_('BAD_FIELD', 'Field ' + k + ' must be text or a number.');
    if (t === 'number' && !isFinite(v)) return fail_('BAD_FIELD', 'Field ' + k + ' is not a usable number.');
  }
  return null;
}
function handle_(b) {
  try {
    var bad = validate_(b);
    if (bad) return bad;
    var lock = LockService.getScriptLock();
    try { lock.waitLock(20000); }
    catch (err) { return fail_('BUSY', 'The sheet is busy. The game will try again.'); }
    try { return run_(b); }
    finally { lock.releaseLock(); }
  } catch (err) {
    return fail_('SERVER_ERROR', 'Server error: ' + (err && err.message ? err.message : err));
  }
}
function run_(b) {
  var cache = CacheService.getScriptCache(), ck = 'rid:' + b.rid;
  var seen = cache.get(ck);
  if (seen) { var again = JSON.parse(seen); again.repeat = true; return again; } /* same request id: already done */
  var ss = getSS_();
  if (!ss) return fail_('NO_PLAYERS_TAB', 'The script cannot find the Google Sheet. Run setup() once.');
  var pt = playersTab(ss); if (pt.error) return pt.error;
  var lt = logTab_(ss); if (lt.error) return lt.error;
  var res = b.action === 'start' ? doStart_(b, pt.sheet) : doSave_(b, pt.sheet);
  if (!res.ok) return res;
  appendLogs_(lt.sheet, b);
  cache.put(ck, JSON.stringify(res), CACHE_SECONDS);
  return res;
}

/* ---------------------------------------------------------------
   Players tab
   --------------------------------------------------------------- */
function findRow_(sheet, token) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var vals = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === token) return i + 2;
  return 0;
}
function readRow_(sheet, row) {
  var vals = sheet.getRange(row, 1, 1, COLUMNS.length).getValues()[0], o = {};
  for (var i = 0; i < COLUMNS.length; i++) o[COLUMNS[i].key] = vals[i];
  return o;
}
function cell_(col, v) {
  if (v === null || v === undefined) return '';
  if (col.kind === 'text') return String(v).slice(0, 2000);
  return typeof v === 'string' ? v.slice(0, 200) : v;
}
function overlay_(vals, fields) {
  var idx = keyIndex_(COLUMNS);
  for (var k in fields) vals[idx[k]] = cell_(COLUMNS[idx[k]], fields[k]);
}
function doStart_(b, sheet) {
  var row = findRow_(sheet, b.token), now = new Date(), idx = keyIndex_(COLUMNS);
  if (row) {
    var cur = readRow_(sheet, row);
    var sameDevice = !cur.device || String(cur.device) === b.device;
    if (sameDevice && String(cur.status) !== 'Finished') { /* the same phone asking again: carry on with the existing row */
      sheet.getRange(row, idx.updated + 1).setValue(now);
      return ok_('RESUMED', 'This number is already running on this phone. Carrying on.', { row: row });
    }
    return fail_('TOKEN_EXISTS', 'This token number already exists. Use a new number.');
  }
  var vals = COLUMNS.map(function () { return ''; });
  overlay_(vals, b.fields || {});
  vals[idx.token] = b.token;
  vals[idx.attempt] = 1;
  if (vals[idx.status] === '') vals[idx.status] = 'Playing';
  vals[idx.started] = now; vals[idx.updated] = now; vals[idx.device] = b.device;
  if (vals[idx.status] === 'Finished') vals[idx.finished] = now;
  row = Math.max(sheet.getLastRow(), 1) + 1;
  ensureSize_(sheet, row, COLUMNS.length);
  var range = sheet.getRange(row, 1, 1, COLUMNS.length);
  range.setNumberFormats(formatsFor_(COLUMNS));
  range.setValues([vals]);
  return ok_('STARTED', 'Token registered.', { row: row });
}
function doSave_(b, sheet) {
  var row = findRow_(sheet, b.token);
  if (!row) return fail_('NO_PLAYER_ROW', 'No row for this token yet. It will be created again.');
  var idx = keyIndex_(COLUMNS), now = new Date();
  var range = sheet.getRange(row, 1, 1, COLUMNS.length), vals = range.getValues()[0];
  if (vals[idx.device] !== '' && String(vals[idx.device]) !== b.device) return fail_('DEVICE_MISMATCH', 'This token belongs to another phone.');
  var f = b.fields || {};
  overlay_(vals, f);
  vals[idx.token] = b.token;
  vals[idx.updated] = now;
  if (f.status === 'Finished' && !vals[idx.finished]) vals[idx.finished] = now;
  range.setValues([vals]);
  return ok_('SAVED', 'Saved.', { row: row });
}

/* ---------------------------------------------------------------
   Swipe log tab  (only ever appended to)
   --------------------------------------------------------------- */
function text_(v, max) { return (v === null || v === undefined ? '' : String(v)).slice(0, max); }
function appendLogs_(sheet, b) {
  var logs = b.logs || [];
  if (!logs.length) return;
  var rows = logs.map(function (l) {
    l = l || {};
    var t = new Date(l.t); if (isNaN(t.getTime())) t = new Date();
    return [t, b.token, 1, text_(l.item, 200), text_(l.answer, 500), text_(l.note, 500), b.device, b.rid];
  });
  var start = Math.max(sheet.getLastRow(), 1) + 1;
  ensureSize_(sheet, start + rows.length - 1, LOG_COLUMNS.length);
  var range = sheet.getRange(start, 1, rows.length, LOG_COLUMNS.length);
  range.setNumberFormats(rows.map(function () { return formatsFor_(LOG_COLUMNS)[0]; }));
  range.setValues(rows);
}

/* ---------------------------------------------------------------
   topGuesses()  -  run by hand to see the closest guesses. Read only.
   Closest = smallest "Off by". A tie goes to the faster "Interest guess time".
   --------------------------------------------------------------- */
function topGuesses() {
  var ss = getSS_();
  var pt = playersTab(ss);
  if (pt.error) throw new Error(pt.error.message);
  var sheet = pt.sheet, last = sheet.getLastRow(), idx = keyIndex_(COLUMNS);
  if (last < 2) { Logger.log('No players yet.'); return []; }
  var vals = sheet.getRange(2, 1, last - 1, COLUMNS.length).getValues();
  var rows = vals.filter(function (r) { return typeof r[idx.offBy] === 'number'; });
  rows.sort(function (a, c) {
    return (a[idx.offBy] - c[idx.offBy]) || ((typeof a[idx.guessSecs] === 'number' ? a[idx.guessSecs] : 1e9) - (typeof c[idx.guessSecs] === 'number' ? c[idx.guessSecs] : 1e9));
  });
  var lines = rows.slice(0, 10).map(function (r, i) {
    return (i + 1) + '. Token ' + r[idx.token] + ' | off by Rs ' + r[idx.offBy] + ' | ' + r[idx.guessSecs] + ' sec | ' + r[idx.status];
  });
  if (!lines.length) lines.push('No locked guesses yet.');
  lines.forEach(function (l) { Logger.log(l); });
  return lines;
}
