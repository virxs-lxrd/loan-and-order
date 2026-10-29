/* =====================================================================
   LOAN & ORDER  -  app.js  (the game)
   You should not need to edit this file. All text and settings are in data.js.
   Layout of this file:
     1. helpers and the money maths
     2. the rows we send to the sheet (playersFields)
     3. saving: a queue in the phone that retries until the sheet confirms
     4. the screens (V = what is shown, H = what buttons do)
   ===================================================================== */
(function () {
'use strict';

var root = typeof window !== 'undefined' ? window : globalThis;
var D = root.GAME_DATA;
var ST = D.SETTINGS, T = D.TEXT, CARDS = D.CARDS, UP = D.UPSELLS, BANKS = D.BANKS,
    FACTORS = D.FACTORS, EXIT = D.EXIT, CRAZY = D.CRAZY, MEDIA = D.MEDIA;

/* names of the things we keep in the phone. Bump the _v1 if the saved shape ever changes */
var KEY_STATE = 'sg_state_v1', KEY_QUEUE = 'sg_queue_v1', KEY_DEVICE = 'sg_device_v1', KEY_BLOCKED = 'sg_blocked_v1';

/* ---------- 1. helpers and money maths ---------- */
var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
/* fill {words} in a text. Values are escaped because the result goes into the page */
var fmt = function (s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return (v && Object.prototype.hasOwnProperty.call(v, k)) ? esc(v[k]) : m; }); };
/* same, but plain (for the sheet) */
var plain = function (s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return (v && Object.prototype.hasOwnProperty.call(v, k)) ? String(v[k]) : m; }); };
var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
var rnd = function () { try { var a = new Uint32Array(2); crypto.getRandomValues(a); return a[0].toString(36) + a[1].toString(36); } catch (e) { return Math.random().toString(36).slice(2, 12); } };
var newRid = function () { return 'r' + rnd() + Date.now().toString(36); };
var fx = function (n) { return Number(n).toFixed(2); };
var inr = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
var lakhS = function (n) { return '₹' + (n / 100000).toFixed(2) + ' lakh'; };
var round2 = function (x) { return Math.round(x * 100) / 100; };
var secs = function (ms) { return ms == null ? '' : Math.round(ms / 100) / 10; };
var accrued = function (rate) { return ST.PRINCIPAL * rate / 100 * (ST.TERM_MONTHS / 12); };
var RT = T.sheet.rateTypes;
var cardLabel = function (c) { return c.n + ' ' + fx(c.rate) + '% ' + RT[c.rt]; };
var findBy = function (arr, key, val) { for (var i = 0; i < arr.length; i++) if (arr[i][key] === val) return arr[i]; return null; };

function validToken(s) {
  s = String(s == null ? '' : s).trim();
  return new RegExp('^\\d{' + ST.TOKEN_MIN + ',' + ST.TOKEN_MAX + '}$').test(s) ? s : null;
}
function parseRate(x) { var v = parseFloat(String(x).replace(/,/g, '.').replace(/[^\d.]/g, '')); return isFinite(v) && v >= 0 && v <= 40 ? v : NaN; }
function parseGuess(s) { var v = parseFloat(String(s).replace(/,/g, '').replace(/[^\d.]/g, '')); if (!isFinite(v)) return NaN; if (v >= 1000) v = v / 100000; return v <= 200 ? v : NaN; }

/* ---------- state ---------- */
function freshRun() {
  return { g1: { order: [], short: [], pick: null, factor: null }, g2: { order: [], sc: [] }, g3: { coins: null, bank: {}, done: false },
           r: { guess: null, noidea: 0, ms: null }, g4: { guess: null, noidea: 0, ms: null }, p: {}, sub: 0 };
}
function freshState() {
  return { v: 1, token: null, screen: 'splash', round: 0, i: 0, sel: null, si: 0, left: 0, last: null, billRev: false, run: freshRun() };
}

/* the deal the player ended up with, after the add-ons they took */
function terms(run) {
  var c = CARDS[run.g1.pick]; if (!c) return null;
  var takenKeys = run.g2.sc.filter(function (x) { return x.a; }).map(function (x) { return x.u; });
  var acc = Object.keys(UP).filter(function (u) { return takenKeys.indexOf(u) >= 0; }); /* applied in the order of data.js */
  var sec = c.sec, time = c.time, app = c.app, rt = c.rt, yrs = c.yrs, perks = [];
  acc.forEach(function (u) {
    var e = UP[u].effect || {};
    if (e.sec) sec = e.sec; if (e.time) time = e.time; if (e.app) app = e.app; if (e.rt) rt = e.rt; if (e.addYears) yrs += e.addYears;
    if (UP[u].perk) perks.push(UP[u].t);
  });
  return { card: c, acc: acc, taken: takenKeys, rate: round2(c.rate + acc.length * ST.ADDON_POINTS), rt: rt, sec: sec, time: time, app: app, yrs: yrs, perks: perks };
}
function changesText(t) {
  var c = t.card, L = T.sheet, out = [];
  if (t.rate !== c.rate) out.push(L.lblRate + ': ' + fx(c.rate) + '% → ' + fx(t.rate) + '%');
  if (t.rt !== c.rt) out.push(L.lblRateType + ': ' + RT[c.rt] + ' → ' + RT[t.rt]);
  if (t.sec !== c.sec) out.push(L.lblSecurity + ': ' + c.sec + ' → ' + t.sec);
  if (t.time !== c.time) out.push(L.lblSanction + ': ' + c.time + ' → ' + t.time);
  if (t.app !== c.app) out.push(L.lblApplication + ': ' + c.app + ' → ' + t.app);
  if (t.yrs !== c.yrs) out.push(L.lblRepayment + ': ' + plain(L.years, { n: c.yrs }) + ' → ' + plain(L.years, { n: t.yrs }));
  return out.length ? out.join('; ') : L.noChange;
}

/* ---------- 2. what we send to the Players tab ---------- */
/* One full snapshot of the player's answers so far. Sending the whole thing every time
   means a repeat or an "undo" can never leave the sheet half right. */
function playersFields(S) {
  var r = S.run, f = {};
  f.token = S.token; f.attempt = 1; f.status = r.sub ? 'Finished' : 'Playing'; f.screen = S.screen;
  var g1 = r.g1;
  if (g1.short.length) f.shortlist = g1.short.map(function (i) { return cardLabel(CARDS[i]); }).join('; ');
  else f.shortlist = g1.pick != null ? T.sheet.shortlistNone : '';
  var fac = findBy(FACTORS, 'k', g1.factor); f.factor = fac ? fac.t : '';
  var t = terms(r);
  if (t) {
    var c = t.card;
    f.lender = c.n; f.qRate = c.rate; f.qType = RT[c.rt]; f.qLender = c.lender; f.qSecurity = c.sec; f.qSanction = c.time; f.qApp = c.app; f.qYears = c.yrs;
    f.taken = r.g2.sc.filter(function (x) { return x.a; }).map(function (x) { return UP[x.u].t; }).join('; ');
    f.skipped = r.g2.sc.filter(function (x) { return !x.a; }).map(function (x) { return UP[x.u].t; }).join('; ');
    f.fRate = t.rate; f.fType = RT[t.rt]; f.fSecurity = t.sec; f.fSanction = t.time; f.fApp = t.app; f.fYears = t.yrs;
    f.perks = t.perks.join('; '); f.changes = changesText(t);
  }
  if (r.g3.done) f.coins = BANKS.filter(function (b) { return (r.g3.bank[b.k] || 0) > 0; }).map(function (b) { return b.t + ' x' + r.g3.bank[b.k]; }).join('; ');
  if (r.r.guess != null) { f.rateGuess = r.r.guess; f.rateGuessSecs = secs(r.r.ms); }
  else if (r.r.noidea) { f.rateGuess = T.sheet.noIdea; f.rateGuessSecs = secs(r.r.ms); }
  if (r.g4.guess != null || r.g4.noidea) {
    f.guess = r.g4.guess != null ? r.g4.guess : T.sheet.noIdea; f.guessSecs = secs(r.g4.ms);
    if (t) {
      f.actual = Math.round(accrued(t.rate));
      if (r.g4.guess != null) f.offBy = Math.round(Math.abs(r.g4.guess * 100000 - f.actual));
    }
  }
  EXIT.forEach(function (q) { var o = r.p[q.k]; if (o) { var hit = findBy(q.opts.map(function (x) { return { id: x[0], t: x[1] }; }), 'id', o); f[q.k] = hit ? hit.t : o; } });
  return f;
}

var LOGIC = { fmt: fmt, plain: plain, fx: fx, inr: inr, lakhS: lakhS, round2: round2, accrued: accrued, cardLabel: cardLabel, validToken: validToken,
              parseRate: parseRate, parseGuess: parseGuess, freshRun: freshRun, freshState: freshState, terms: terms, changesText: changesText, playersFields: playersFields };
root.LOGIC = LOGIC;
if (typeof document === 'undefined') return; /* stop here when tests load this file in Node */

/* ---------- 3. saving ---------- */
var mem = {};
var store = {
  get: function (k) { try { var v = localStorage.getItem(k); return v == null ? (mem[k] == null ? null : mem[k]) : v; } catch (e) { return mem[k] == null ? null : mem[k]; } },
  set: function (k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} },
  del: function (k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) {} }
};
var readJSON = function (k, dflt) { try { var v = store.get(k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } };
var DEVICE = (function () { var d = store.get(KEY_DEVICE); if (!d) { d = 'd' + rnd(); store.set(KEY_DEVICE, d); } return d; })();

var S = readJSON(KEY_STATE, null);
if (!S || S.v !== 1 || !S.run) S = freshState();
var persist = function () { store.set(KEY_STATE, JSON.stringify(S)); };

var Q = { items: readJSON(KEY_QUEUE, []), blocked: [], conflict: {}, busy: false, fail: 0, timer: null, everOk: false, waiters: {} };
(function () { var b = readJSON(KEY_BLOCKED, null); if (b) { Q.blocked = b.items || []; Q.conflict = b.conflict || {}; } })();
var persistQ = function () { store.set(KEY_QUEUE, JSON.stringify(Q.items)); };
var persistBlocked = function () { store.set(KEY_BLOCKED, JSON.stringify({ items: Q.blocked, conflict: Q.conflict })); };

/* Any other reply (no signal, a busy server, a sheet that is not set up yet) is treated as "try again later", so no answer is ever thrown away by mistake. */
var CONFLICT_CODES = { TOKEN_EXISTS: 1, DEVICE_MISMATCH: 1 };
var PERMANENT_CODES = { BAD_JSON: 1, BAD_REQUEST: 1, BAD_TOKEN: 1, BAD_FIELD: 1, BAD_RID: 1, UNKNOWN_ACTION: 1 };

function paintPill() {
  var el = document.getElementById('sync'); if (!el) return;
  var P = T.sync, parts = [], bad = false;
  if (S.token) parts.push(fmt(P.token, { token: S.token }));
  if (!ST.EXEC_URL) parts.push(P.practice);
  else if (Q.blocked.length) { parts.push(P.blocked); bad = true; }
  else if (Q.items.length) { parts.push(Q.fail > 0 ? P.offline : P.saving); bad = Q.fail >= 3; }
  else if (Q.everOk) parts.push(P.saved);
  el.innerHTML = parts.join(' · '); el.classList.toggle('bad', bad);
}
function kick(ms) { clearTimeout(Q.timer); Q.timer = setTimeout(flush, ms); }
function backoff() { var d = Math.min(ST.RETRY_MAX_MS, ST.RETRY_FIRST_MS * Math.pow(2, Math.max(0, Q.fail - 1))); return d * (0.8 + Math.random() * 0.4); }
function settle(rid, what, res) { var w = Q.waiters[rid]; if (w) { delete Q.waiters[rid]; w(what, res); } }

/* put one thing in the phone's queue first, then try to send it */
function enqueue(item, urgent) {
  if (!ST.EXEC_URL) return;
  item.rid = item.rid || newRid(); item.tries = 0; item.logs = item.logs || []; item.fields = item.fields || {};
  Q.items.push(item); persistQ(); paintPill();
  if (!Q.busy && (Q.fail === 0 || urgent)) kick(urgent ? 0 : ST.SEND_DELAY_MS);
}
/* several quick taps that were never sent become one request */
function mergeHead() {
  var a = Q.items[0]; if (!a || a.action !== 'save' || a.tries > 0) return;
  var n = 1;
  while (Q.items[n] && Q.items[n].action === 'save' && Q.items[n].tries === 0 && Q.items[n].token === a.token) { a.fields = Q.items[n].fields; a.logs = a.logs.concat(Q.items[n].logs); n++; }
  if (n > 1) { Q.items.splice(1, n - 1); a.rid = newRid(); }
}
async function post(it) {
  var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var to = setTimeout(function () { try { if (ctl) ctl.abort(); } catch (e) {} }, ST.SEND_TIMEOUT_MS);
  try {
    var r = await fetch(ST.EXEC_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', credentials: 'omit', signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ rid: it.rid, action: it.action, token: it.token, device: DEVICE, fields: it.fields, logs: it.logs, v: 1 })
    });
    var txt = await r.text(), j = null;
    try { j = JSON.parse(txt); } catch (e) {}
    return (j && typeof j === 'object') ? j : { ok: false, code: 'BAD_RESPONSE' };
  } catch (e) { return { ok: false, code: 'NO_NET' }; }
  finally { clearTimeout(to); }
}
function dropToken(token, code) {
  var keep = [];
  Q.items.forEach(function (x) { if (x.token === token) Q.blocked.push({ item: x, code: code, at: new Date().toISOString() }); else keep.push(x); });
  Q.items = keep; Q.conflict[token] = code; persistQ(); persistBlocked();
}
async function flush() {
  if (Q.busy || !ST.EXEC_URL) return;
  Q.busy = true;
  try {
    while (Q.items.length) {
      mergeHead();
      var it = Q.items[0]; it.tries++; persistQ(); paintPill();
      var res = await post(it);
      if (res && res.ok) { Q.items.shift(); Q.fail = 0; Q.everOk = true; persistQ(); paintPill(); settle(it.rid, 'ok', res); continue; }
      var code = (res && res.code) || 'NO_NET';
      if (CONFLICT_CODES[code]) { dropToken(it.token, code); settle(it.rid, 'conflict', res); paintPill(); continue; }
      if (code === 'NO_PLAYER_ROW' && it.action === 'save' && !it.healed) { /* the row went missing: put the token back first, then retry this save */
        it.healed = true; it.tries = 0;
        Q.items.unshift({ rid: newRid(), action: 'start', token: it.token, fields: it.fields, logs: [{ t: new Date().toISOString(), item: 'Row restored', answer: '', note: 'Players row was missing, recreated' }], tries: 0 });
        persistQ(); continue;
      }
      if (PERMANENT_CODES[code]) { Q.items.shift(); Q.blocked.push({ item: it, code: code, message: res.message, at: new Date().toISOString() }); persistQ(); persistBlocked(); settle(it.rid, 'error', res); paintPill(); continue; }
      /* anything else: keep it, wait, try again */
      Q.fail++; Q.lastCode = code; it.healed = false; persistQ(); paintPill(); kick(backoff()); break;
    }
  } finally { Q.busy = false; }
  paintPill(); checkConflict();
}
function checkConflict() { if (S.token && Q.conflict[S.token] && S.screen !== 'conflict' && S.screen !== 'splash') go('conflict'); }
window.addEventListener('online', function () { Q.fail = 0; if (Q.items.length) kick(0); });
document.addEventListener('visibilitychange', function () { if (!document.hidden && Q.items.length) { Q.fail = 0; kick(0); } });

/* write one action to the Swipe log and refresh the player's row */
function rec(item, answer, note) {
  persist(); if (!S.token) return;
  enqueue({ action: 'save', token: S.token, fields: playersFields(S), logs: [{ t: new Date().toISOString(), item: item, answer: answer == null ? '' : String(answer), note: note == null ? '' : String(note) }] });
}

/* ---------- 4. the screens ---------- */
var app = document.getElementById('app');
var V = {}, H = {}, X = { timer: null, busy: false, snd: null };
document.title = T.pageTitle;

var hud = function () {
  var s = ''; for (var i = 1; i <= 3; i++) s += '<i class="seg ' + (i < S.round ? 'done' : i === S.round ? 'now' : '') + '"></i>';
  return '<div class="top"><header class="hud"><b class="logo">' + T.logo + '</b><span class="segs" role="img" aria-label="' + fmt(T.roundAria, { n: Math.min(S.round, 3) }) + '">' + s + '</span></header><p class="sync" id="sync" aria-live="off"></p></div>';
};
var CANBACK = { i1: 1, swipe: 1, factor: 1, short: 1, i2: 1, deal: 1, dealsum: 1, i3: 1, seven: 1, banks: 1, rguess: 1, guess: 1, exit: 1 };
function show(html, bind, keep) {
  if (X.timer) { clearInterval(X.timer); clearTimeout(X.timer); X.timer = null; }
  app.className = '';
  app.innerHTML = hud() + '<main class="screen">' + (CANBACK[S.screen] ? '<button class="backbtn" data-act="back">' + T.back + '</button>' : '') + html + '</main>';
  paintPill();
  if (bind) bind();
  if (!keep) window.scrollTo(0, 0);
}
function go(n) {
  if (X.snd && n !== 'seven') { try { X.snd.pause(); X.snd.currentTime = 0; } catch (e) {} }
  S.screen = n; persist();
  /* keep the "Last screen" column up to date. Quick taps are merged into one request, so this costs almost nothing */
  if (S.token && ST.EXEC_URL && n !== 'conflict') enqueue({ action: 'save', token: S.token, fields: playersFields(S), logs: [] });
  V[n]();
}
var host = function (who, txt, c) { return '<div class="host" style="--c:var(--' + (c || 'lemon') + ')"><span class="who">' + who + '</span><p>' + txt + '</p></div>'; };
var intro = function (n, title, line, act, who, c) {
  S.round = n; persist();
  show('<section><p class="kick">' + fmt(T.kickGame, { n: n }) + '</p><h2 class="big">' + title + '</h2></section>' + host(who || T.registrar, line, c) + '<button class="btn go" data-act="' + act + '">' + T.letsGo + '</button>');
};
app.addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (!b || b.disabled) return; var f = H[b.dataset.act]; if (f) f(b.dataset, b); });

var me = function () { return terms(S.run); };
var msgFor = function (code) { return T.messages[code] ? fmt(T.messages[code], { min: ST.TOKEN_MIN, max: ST.TOKEN_MAX }) : fmt(T.messages.GENERIC); };

/* ----- back button: goes one step back and writes that step to the log ----- */
H.back = function () {
  if (swipeBusy) return;
  var sc = S.screen, run = S.run, g1 = run.g1;
  var drop = function () { var id = g1.order[S.i]; g1.short = g1.short.filter(function (x) { return x !== id; }); };
  if (sc === 'i1') go('splash');
  else if (sc === 'swipe') { if (S.i > 0) { S.i--; drop(); persist(); V.swipe(); } else go('i1'); }
  else if (sc === 'factor') { S.i = g1.order.length - 1; drop(); go('swipe'); }
  else if (sc === 'short') go('factor');
  else if (sc === 'i2') { g1.pick = null; go('short'); }
  else if (sc === 'deal') { if (S.si > 0) { S.si--; run.g2.sc.pop(); S.last = null; persist(); V.deal(); } else go('i2'); }
  else if (sc === 'dealsum') { S.si = run.g2.order.length - 1; run.g2.sc.pop(); S.last = null; go('deal'); }
  else if (sc === 'i3') go('dealsum');
  else if (sc === 'seven') go('i3');
  else if (sc === 'banks') go('seven');
  else if (sc === 'rguess') { run.g3.done = false; go('banks'); }
  else if (sc === 'guess') go('myrate');
  else if (sc === 'exit') go('bill');
  rec('Back', 'from ' + sc, 'to ' + S.screen);
};

/* ----- splash + the player's number ----- */
V.splash = function () {
  S.round = 0; var C = T.splash;
  show('<section><p class="kick c">' + C.kicker + '</p><h1 class="title"><span class="t1">' + C.t1 + '</span> <span class="t2">' + C.t2 + '</span><br><span class="t3">' + C.t3 + '</span></h1></section>'
    + host(T.registrar, C.line)
    + '<div><label class="toklabel" for="tok">' + C.tokenLabel + '</label><div class="tokrow"><input id="tok" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="' + ST.TOKEN_MAX + '" placeholder="' + esc(C.tokenPlaceholder) + '" value="' + esc(S.token || X.typed || '') + '"></div><p class="fine" style="margin-top:6px">' + C.tokenHelp + '</p></div>'
    + '<p class="err" id="tokerr" role="alert" hidden></p>'
    + '<button class="btn go" id="playbtn" data-act="start" disabled>' + C.play + '</button>'
    + '<p class="fine">' + C.fine + '</p>' + (ST.EXEC_URL ? '' : '<p class="warn">' + C.noUrl + '</p>'),
    function () {
      var inp = document.getElementById('tok'), b = document.getElementById('playbtn');
      var upd = function () { var d = inp.value.replace(/\D/g, ''); if (d !== inp.value) inp.value = d; b.disabled = !validToken(inp.value); };
      inp.addEventListener('input', function () { upd(); document.getElementById('tokerr').hidden = true; });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !b.disabled) H.start(); });
      upd();
    });
};
function tokenError(msg) { var el = document.getElementById('tokerr'); if (el) { el.innerHTML = msg; el.hidden = false; } var b = document.getElementById('playbtn'); if (b) { b.disabled = !validToken((document.getElementById('tok') || {}).value); b.innerHTML = T.splash.play; } }
function awaitStart(rid, ms) {
  return new Promise(function (resolve) {
    var done = false, fin = function (w, r) { if (done) return; done = true; clearTimeout(tm); resolve({ what: w, res: r }); };
    var tm = setTimeout(function () { delete Q.waiters[rid]; fin('timeout'); }, ms);
    Q.waiters[rid] = fin;
  });
}
H.start = async function () {
  var inp = document.getElementById('tok'), tok = validToken(inp && inp.value);
  if (!tok) { tokenError(msgFor('TOKEN_BAD')); return; }
  if (S.token === tok) { go('i1'); return; } /* came back to the first screen: carry on with the same game */
  S = freshState(); S.token = tok; persist();
  if (Q.conflict[tok]) { delete Q.conflict[tok]; persistBlocked(); } /* a fresh try with this number */
  if (!ST.EXEC_URL) { go('i1'); return; }
  var b = document.getElementById('playbtn'); b.disabled = true; b.innerHTML = msgFor('CHECKING');
  var it = { action: 'start', token: tok, fields: playersFields(S), logs: [{ t: new Date().toISOString(), item: 'Game start', answer: tok, note: '' }] };
  it.rid = newRid(); var wait = awaitStart(it.rid, ST.START_TIMEOUT_MS);
  enqueue(it, true);
  var out = await wait;
  if (out.what === 'ok') { go('i1'); return; }
  if (out.what === 'timeout' && ST.ALLOW_PLAY_OFFLINE) { go('i1'); return; }
  /* the number was refused, or we could not check it and are not allowed to play offline */
  var code = out.what === 'conflict' ? (out.res && out.res.code) || 'TOKEN_EXISTS' : out.what === 'timeout' ? 'CANNOT_REACH' : (out.res && out.res.code) || 'GENERIC';
  if (out.what === 'timeout') { Q.items = Q.items.filter(function (x) { return x.rid !== it.rid; }); persistQ(); }
  S = freshState(); persist(); X.typed = tok; V.splash(); X.typed = '';
  tokenError(T.messages[code] ? msgFor(code) : (out.res && out.res.message ? esc(out.res.message) : msgFor('GENERIC')));
};
V.conflict = function () {
  var C = T.conflict;
  show('<section><h2 class="big">' + C.title + '</h2></section>' + host(T.registrar, C.line, 'pink') + '<button class="btn go" data-act="newGame">' + C.button + '</button>');
};
H.newGame = function () { if (X.timer) { clearInterval(X.timer); clearTimeout(X.timer); X.timer = null; } S = freshState(); persist(); V.splash(); };

/* ----- game 1: swipe, shortlist, pick ----- */
V.i1 = function () { intro(1, T.g1.introTitle, T.g1.introLine, 'g1go'); };
H.g1go = function () {
  var g1 = S.run.g1; g1.order = shuffle(CARDS.map(function (_, i) { return i; })); g1.short = []; g1.pick = null; S.i = 0; S.sel = null; persist();
  rec('Card order shown', g1.order.map(function (i) { return CARDS[i].n; }).join(' > '));
  go('swipe');
};
var cardBody = function (c) {
  var G = T.g1;
  return '<span class="gh"><b class="gn">' + esc(c.n) + '</b><span class="tag">' + esc(c.lender) + '</span></span><span class="grate"><b>' + fx(c.rate) + '%</b><span class="rtp ' + c.rt + '">' + (c.rt === 'fix' ? G.fixed : G.floating) + '</span></span>'
    + '<span class="g4"><span><i>' + G.lblSecurity + '</i><b>' + esc(c.sec) + '</b></span><span><i>' + G.lblSanction + '</i><b>' + esc(c.time) + '</b></span><span><i>' + G.lblApplication + '</i><b>' + esc(c.app) + '</b></span>'
    + '<span class="wide"><i>' + G.lblRepay + '</i><b>' + fmt(G.repayValue, { yrs: c.yrs }) + '</b></span>'
    + (c.pay === 'std' ? '' : '<span class="wide"><i>' + G.lblEmi + '</i><b>' + esc(c.payL) + '</b></span>') + '</span>';
};
var swipeCard = function (c, cls) { return '<article class="card paper ' + cls + '"><span class="stamp take">' + T.g1.stampTake + '</span><span class="stamp pass">' + T.g1.stampPass + '</span>' + cardBody(c) + '</article>'; };
V.swipe = function () {
  var g1 = S.run.g1, o = g1.order, i = S.i, G = T.g1;
  if (i >= o.length) return go('factor');
  show('<div class="prog"><span>' + fmt(G.deal, { i: i + 1, n: o.length }) + '</span><span>' + fmt(G.shortlisted, { n: g1.short.length }) + '</span></div>'
    + '<div class="stage">' + (i + 1 < o.length ? swipeCard(CARDS[o[i + 1]], 'next') : '') + swipeCard(CARDS[o[i]], 'cur') + '</div>'
    + '<div class="pair"><button class="btn pink" data-act="swipe" data-v="0">' + G.pass + '</button><button class="btn mint" data-act="swipe" data-v="1">' + G.shortlist + '</button></div><p class="fine c">' + G.swipeHint + '</p>',
    function () { bindSwipe(app.querySelector('.card.cur')); });
};
var swipeBusy = false;
var stamp = function (el, dx) { el.querySelector('.stamp.take').style.opacity = Math.max(0, Math.min(1, dx / 90)); el.querySelector('.stamp.pass').style.opacity = Math.max(0, Math.min(1, -dx / 90)); };
function bindSwipe(el) {
  if (!el) return; var sx = 0, dx = 0, drag = false;
  el.addEventListener('pointerdown', function (e) { drag = true; sx = e.clientX; dx = 0; try { el.setPointerCapture(e.pointerId); } catch (x) {} el.style.transition = 'none'; });
  el.addEventListener('pointermove', function (e) { if (!drag) return; dx = e.clientX - sx; el.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 18) + 'deg)'; stamp(el, dx); });
  var end = function () { if (!drag) return; drag = false; el.style.transition = ''; if (Math.abs(dx) > ST.SWIPE_DISTANCE) decide(dx > 0 ? 1 : 0); else { el.style.transform = ''; stamp(el, 0); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}
function decide(v) {
  if (swipeBusy || S.screen !== 'swipe') return;
  var el = app.querySelector('.card.cur'); if (!el) return;
  var g1 = S.run.g1, id = g1.order[S.i], n = g1.order.length, at = S.i + 1;
  swipeBusy = true; el.style.transition = ''; el.style.transform = 'translateX(' + (v ? 520 : -520) + 'px) rotate(' + (v ? 24 : -24) + 'deg)'; stamp(el, v ? 100 : -100);
  if (v) g1.short.push(id);
  S.i++; rec('Swipe: ' + CARDS[id].n, v ? 'Shortlist' : 'Pass', 'card ' + at + ' of ' + n);
  setTimeout(function () { swipeBusy = false; if (S.screen === 'swipe') V.swipe(); }, 230);
}
H.swipe = function (d) { decide(+d.v); };
document.addEventListener('keydown', function (e) { if (S.screen !== 'swipe') return; if (e.key === 'ArrowRight') decide(1); if (e.key === 'ArrowLeft') decide(0); });

V.factor = function () {
  var f = S.run.g1.factor, G = T.g1;
  show('<p class="kick">' + G.factorKick + '</p><h2 class="mid">' + G.factorTitle + '</h2><p class="q">' + G.factorQ + '</p>'
    + '<div class="fopts">' + FACTORS.map(function (o) { return '<button class="fopt ' + (f === o.k ? 'on' : '') + '" data-act="factor" data-v="' + o.k + '" aria-pressed="' + (f === o.k) + '">' + esc(o.t) + '</button>'; }).join('') + '</div>'
    + '<div class="sticky"><button class="btn go" id="fgo" data-act="factorGo" ' + (f ? '' : 'disabled') + '>' + G.factorBtn + '</button></div>');
};
H.factor = function (d) {
  S.run.g1.factor = d.v;
  app.querySelectorAll('.fopt').forEach(function (b) { var on = b.dataset.v === d.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.getElementById('fgo').disabled = false;
  rec('Factor that mattered most', findBy(FACTORS, 'k', d.v).t);
};
H.factorGo = function () { if (!S.run.g1.factor) return; go('short'); };
V.short = function () {
  var g1 = S.run.g1, sh = g1.short, none = !sh.length, idx = none ? g1.order : sh, G = T.g1;
  if (sh.length === 1) S.sel = sh[0];
  var cards = idx.map(function (i) { return '<button class="gc paper ' + (S.sel === i ? 'on' : '') + '" data-act="pickCard" data-i="' + i + '" aria-pressed="' + (S.sel === i) + '">' + cardBody(CARDS[i]) + '</button>'; }).join('');
  var msg = none ? G.shortMsgNone : sh.length === 1 ? G.shortMsgOne : fmt(G.shortMsgMany, { n: sh.length });
  show('<h2 class="mid">' + (none ? G.shortTitleNone : G.shortTitle) + '</h2><p class="muted">' + msg + '</p><div class="gcs">' + cards + '</div>'
    + '<div class="sticky"><button class="btn go" id="lock" data-act="lock" ' + (S.sel == null ? 'disabled' : '') + '>' + (S.sel == null ? G.pickDeal : fmt(G.lockIn, { name: CARDS[S.sel].n.toUpperCase(), rate: fx(CARDS[S.sel].rate) })) + '</button></div>');
};
H.pickCard = function (d) {
  S.sel = +d.i; persist();
  app.querySelectorAll('.gc').forEach(function (b) { var on = +b.dataset.i === S.sel; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  var c = CARDS[S.sel], lk = document.getElementById('lock'); lk.disabled = false; lk.innerHTML = fmt(T.g1.lockIn, { name: c.n.toUpperCase(), rate: fx(c.rate) });
};
H.lock = function () {
  if (S.sel == null) return; var c = CARDS[S.sel];
  S.run.g1.pick = S.sel;
  rec('Locked lender', cardLabel(c), 'shortlist: ' + (S.run.g1.short.map(function (i) { return CARDS[i].n; }).join(', ') || 'none'));
  go('i2');
};

/* ----- game 2: the upsell ----- */
V.i2 = function () {
  var c = CARDS[S.run.g1.pick];
  intro(2, T.g2.introTitle, fmt(T.g2.introLine, { name: c.n, rate: fx(c.rate), pts: fx(ST.ADDON_POINTS), count: T.g2.numberWords[c.sc.length] || c.sc.length }), 'g2go', T.fixer, 'orange');
};
H.g2go = function () {
  var c = CARDS[S.run.g1.pick], g2 = S.run.g2; g2.order = shuffle(c.sc); g2.sc = []; S.si = 0; S.last = null; X.busy = false; persist();
  rec('Add-on order shown', g2.order.map(function (u) { return UP[u].t; }).join(' > '));
  go('deal');
};
V.deal = function () {
  var g2 = S.run.g2, G = T.g2;
  if (S.si >= g2.order.length) return go('dealsum');
  var c = CARDS[S.run.g1.pick], u = g2.order[S.si], U = UP[u];
  var dots = g2.order.map(function (_, i) { return '<i class="' + (i < S.si ? 'd' : i === S.si ? 'n' : '') + '"></i>'; }).join('');
  var say = S.last == null ? pick(G.fixerFirst) : S.last ? pick(G.fixerAfterYes) : pick(G.fixerAfterNo);
  show('<div class="prog"><span>' + fmt(G.offerOf, { i: S.si + 1, n: g2.order.length }) + '</span><span>' + fmt(G.from, { name: c.n.toUpperCase() }) + '</span></div><div class="path">' + dots + '</div>'
    + host(T.fixer, say, 'orange')
    + '<article class="paper offer"><h3>' + esc(U.t) + '</h3><p>' + fmt(U.d, { time: c.time, yrs: c.yrs, yrs5: c.yrs + 5 }) + '</p><div class="price"><b>' + fmt(G.priceMain, { pts: fx(ST.ADDON_POINTS) }) + '</b><span>' + G.priceSub + '</span></div></article>'
    + '<div class="pair"><button class="btn pink" data-act="deal" data-v="0">' + G.no + '</button><button class="btn mint" data-act="deal" data-v="1">' + G.yes + '</button></div>');
};
H.deal = function (d) {
  if (X.busy) return; X.busy = true;
  var g2 = S.run.g2, a = +d.v, u = g2.order[S.si], card = app.querySelector('.offer');
  g2.sc.push({ u: u, a: a }); S.last = a; S.si++;
  rec('Add-on: ' + UP[u].t, a ? 'Take it' : 'No thanks', 'offer ' + S.si + ' of ' + g2.order.length);
  if (card) { card.classList.add(a ? 'added' : 'skipped'); card.insertAdjacentHTML('beforeend', '<span class="verdict ' + (a ? 'yes' : 'no') + '">' + (a ? T.g2.added : T.g2.skipped) + '</span>'); }
  setTimeout(function () { X.busy = false; if (S.screen === 'deal') V.deal(); }, 380);
};
V.dealsum = function () {
  var m = me(), G = T.g2;
  var perks = m.acc.length ? '<ul class="perks">' + m.acc.map(function (u) { return '<li><b>' + esc(UP[u].t) + '</b><span>' + fmt(UP[u].d, { time: m.card.time, yrs: m.card.yrs, yrs5: m.card.yrs + 5 }) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">' + fmt(G.sumNone, { name: m.card.n }) + '</p>';
  show('<article class="paper typecard left"><p class="kick">' + fmt(G.sumKick, { name: m.card.n.toUpperCase() }) + '</p><h2>' + (m.acc.length ? G.sumTitle : G.sumTitleNone) + '</h2>' + perks + '</article><button class="btn go" data-act="sumGo">' + G.sumBtn + '</button>');
};
H.sumGo = function () { rec('Upsell finished', 'Final rate ' + fx(me().rate) + '%', changesTextSafe()); go('i3'); };
var changesTextSafe = function () { var t = me(); return t ? changesText(t) : ''; };

/* ----- game 3: the placement reveal and the piggy banks ----- */
V.i3 = function () {
  try { if (!X.snd) { X.snd = new Audio(MEDIA.jackpotSound); X.snd.preload = 'auto'; } } catch (e) {}
  S.round = 3; persist();
  show('<section><p class="kick">' + fmt(T.kickGame, { n: 3 }) + '</p><h2 class="big">' + T.g3.introTitle + '</h2></section>' + host(T.registrar, T.g3.introLine) + '<button class="btn go" data-act="g3go">' + T.g3.introBtn + '</button>');
};
H.g3go = function () {
  var g3 = S.run.g3; g3.coins = ST.COINS; g3.bank = {}; g3.done = false; persist();
  /* a tap is the one moment a phone lets us "unlock" the sound for later */
  try { if (X.snd) { X.snd.muted = true; var p = X.snd.play(); var undo = function () { try { X.snd.pause(); X.snd.currentTime = 0; X.snd.muted = false; } catch (e) {} }; if (p && p.then) p.then(undo, function () { X.snd.muted = false; }); else undo(); } } catch (e) {}
  rec('Placement reveal', 'tapped');
  go('seven');
};
var confetti = function () { var c = ['#F5A315', '#F94861', '#22B8A6', '#FFF4DC', '#4CC3F0', '#FFC629'], s = ''; for (var i = 0; i < 30; i++) s += '<i style="left:' + Math.round(Math.random() * 100) + '%;background:' + c[i % 6] + ';animation-delay:' + (Math.random() * 1.4).toFixed(2) + 's"></i>'; return '<div class="conf" aria-hidden="true">' + s + '</div>'; };
var still = function () { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
var playSeven = function () {
  try {
    if (!X.snd) X.snd = new Audio(MEDIA.jackpotSound);
    X.snd.muted = false; X.snd.currentTime = 0; var p = X.snd.play();
    if (p && p.catch) p.catch(function () { var b = document.getElementById('sndb'); if (b) b.innerHTML = T.g3.soundTap; });
  } catch (e) {}
};
H.snd = function () { playSeven(); };
var sevenReveal = function () {
  var n = S.run.g3.coins, win = document.getElementById('win'), slot = document.getElementById('slot'); if (!win || S.screen !== 'seven') return;
  win.classList.remove('spin'); win.innerHTML = '<img src="' + esc(MEDIA.sevenImage) + '" alt="' + esc(T.g3.imageAlt) + '">' + confetti();
  slot.classList.remove('pop'); void slot.offsetWidth; slot.classList.add('pop');
  document.getElementById('cap').innerHTML = T.g3.jackpot; playSeven();
  document.getElementById('after').innerHTML = '<div class="host" style="--c:var(--lemon)"><p>' + fmt(T.g3.afterLine, { n: n }) + '</p></div>'
    + '<button class="chip" style="margin-top:12px" id="sndb" data-act="snd">' + T.g3.soundAgain + '</button><button class="btn go" style="margin-top:14px" data-act="toBanks">' + fmt(T.g3.placeBtn, { n: n }) + '</button>';
};
V.seven = function () {
  var items = shuffle(CRAZY).concat(shuffle(CRAZY)).concat(['777']), n = items.length, bulbs = '';
  for (var i = 0; i < 9; i++) bulbs += '<i></i>';
  show('<p class="kick">' + T.g3.revealKick + '</p><div class="slot" id="slot"><div class="bulbs" aria-hidden="true">' + bulbs + '</div><div class="slotwin spin" id="win"><div class="strip" id="strip" style="height:' + n * 100 + '%">'
    + items.map(function (t) { return '<div class="si" style="height:' + (100 / n).toFixed(4) + '%">' + esc(t) + '</div>'; }).join('') + '</div></div><p class="slotcap" id="cap">' + T.g3.opening + '</p></div><div id="after"></div>',
    function () {
      if (still()) { sevenReveal(); return; }
      var strip = document.getElementById('strip'), to = -(n - 1) / n * 100;
      var an = strip.animate([{ transform: 'translateY(0)', filter: 'blur(3px)' }, { transform: 'translateY(' + to + '%)', filter: 'blur(0px)' }], { duration: 3600, easing: 'cubic-bezier(.25,.55,.2,1)', fill: 'forwards', delay: 350 });
      an.onfinish = function () { X.timer = setTimeout(sevenReveal, 500); };
    });
};
H.toBanks = function () { S.left = S.run.g3.coins - Object.values(S.run.g3.bank || {}).reduce(function (x, y) { return x + y; }, 0); go('banks'); };
var PIGCOL = ['#F5A315', '#F94861', '#22B8A6', '#9B6BE8', '#FF8A3D', '#4CA2F0', '#FF6FA5', '#6CC24A', '#E8C547', '#38C6D9'];
var pigSVG = function (c) { return '<svg class="pigsvg" viewBox="0 0 100 80" aria-hidden="true"><path d="M13 44c-9-2-8-14-1-15 4 0 5 4 2 6" fill="none" stroke="#010826" stroke-width="3" stroke-linecap="round"/><rect x="29" y="60" width="11" height="16" rx="4" fill="' + c + '" stroke="#010826" stroke-width="3"/><rect x="57" y="60" width="11" height="16" rx="4" fill="' + c + '" stroke="#010826" stroke-width="3"/><ellipse cx="48" cy="44" rx="33" ry="25" fill="' + c + '" stroke="#010826" stroke-width="3"/><path d="M58 22l8-13 8 17z" fill="' + c + '" stroke="#010826" stroke-width="3" stroke-linejoin="round"/><ellipse cx="83" cy="46" rx="9" ry="11" fill="#FFD3D9" stroke="#010826" stroke-width="3"/><circle cx="81" cy="43" r="1.8" fill="#010826"/><circle cx="81" cy="50" r="1.8" fill="#010826"/><circle cx="68" cy="36" r="3" fill="#010826"/><rect x="30" y="18" width="24" height="5" rx="2.5" fill="#010826"/><ellipse cx="38" cy="44" rx="9" ry="6" fill="#fff" opacity=".18"/></svg>'; };
var minis = function (k) { var n = S.run.g3.bank[k] || 0, s = ''; for (var i = 0; i < n; i++) s += '<span class="coin sm"></span>'; return s; };
var trayCoins = function () { var s = ''; for (var i = 0; i < S.run.g3.coins; i++) s += '<span class="coin' + (i < S.left ? '' : ' gone') + '">₹</span>'; return s; };
var toGo = function () { return S.left === 1 ? T.g3.toGoOne : fmt(T.g3.toGoMany, { n: S.left }); };
V.banks = function () {
  var g3 = S.run.g3, n = g3.coins, G = T.g3;
  var pigs = BANKS.map(function (b, i) {
    return '<div class="pig paper' + (g3.bank[b.k] ? ' has' : '') + '" id="pig-' + b.k + '"><button class="pigtap" data-act="drop" data-k="' + b.k + '" aria-label="' + fmt(G.dropAria, { name: b.t }) + '">' + pigSVG(PIGCOL[i % PIGCOL.length]) + '<span class="pn">' + esc(b.t) + '</span><span class="minis">' + minis(b.k) + '</span></button><span class="cnt">' + (g3.bank[b.k] || 0) + '</span><button class="lift" data-act="lift" data-k="' + b.k + '" aria-label="' + fmt(G.liftAria, { name: b.t }) + '" ' + (g3.bank[b.k] ? '' : 'disabled') + '>−</button></div>';
  }).join('');
  show('<div class="tray" id="tray"><div><span class="trl">' + G.coinsLeft + '</span><div class="tcw" id="tcw">' + trayCoins() + '</div></div><b class="tl" id="tl" aria-live="polite">' + S.left + '</b></div>'
    + '<p class="muted">' + fmt(G.howTo, { n: n }) + '</p><div class="pigs">' + pigs + '</div>'
    + '<div class="sticky"><button class="btn go" id="done" data-act="banksDone" ' + (S.left ? 'disabled' : '') + '>' + (S.left ? toGo() : G.done) + '</button></div>');
};
var refreshBanks = function (k) {
  var g = S.run.g3.bank, n = g[k] || 0, pig = document.getElementById('pig-' + k);
  document.getElementById('tl').textContent = S.left; document.getElementById('tcw').innerHTML = trayCoins();
  if (pig) { pig.classList.toggle('has', n > 0); pig.querySelector('.cnt').textContent = n; pig.querySelector('.minis').innerHTML = minis(k); pig.querySelector('.lift').disabled = !n; }
  var d = document.getElementById('done'); if (d) { d.disabled = S.left > 0; d.innerHTML = S.left ? toGo() : T.g3.done; }
};
var fly = function (from, to) {
  if (still() || !from || !to || !document.body.animate) return;
  var el = document.createElement('span'); el.className = 'coin fly'; el.textContent = '₹'; document.body.appendChild(el);
  var a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), x0 = a.left + a.width - 26, y0 = a.top + a.height / 2 - 12, x1 = b.left + b.width * 0.4, y1 = b.top + b.height * 0.18;
  var an = el.animate([{ transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1)' }, { transform: 'translate(' + (x0 + x1) / 2 + 'px,' + (Math.min(y0, y1) - 40) + 'px) scale(1.15)', offset: .45 }, { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.55)', opacity: .9 }], { duration: 420, easing: 'ease-in' });
  an.onfinish = function () { el.remove(); }; an.oncancel = function () { el.remove(); };
};
H.drop = function (d, b) {
  if (S.screen !== 'banks') return;
  var k = d.k, bank = S.run.g3.bank;
  if (S.left <= 0) { var t = document.getElementById('tray'); if (t) { t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); } return; }
  var from = document.getElementById('tcw'), svg = b.querySelector('.pigsvg');
  bank[k] = (bank[k] || 0) + 1; S.left--;
  rec('Coin: ' + findBy(BANKS, 'k', k).t, '+1', 'now ' + bank[k] + ' here, ' + S.left + ' left');
  fly(from, svg); refreshBanks(k);
  if (svg) { svg.classList.remove('wig'); void svg.getBoundingClientRect(); svg.classList.add('wig'); }
};
H.lift = function (d) {
  var k = d.k, bank = S.run.g3.bank; if (S.screen !== 'banks' || !bank[k]) return;
  bank[k]--; S.left++;
  rec('Coin: ' + findBy(BANKS, 'k', k).t, '-1', 'now ' + bank[k] + ' here, ' + S.left + ' left');
  refreshBanks(k);
};
H.banksDone = function () {
  if (S.left > 0) return; var g3 = S.run.g3; g3.done = true;
  rec('Coins confirmed', BANKS.filter(function (b) { return (g3.bank[b.k] || 0) > 0; }).map(function (b) { return b.t + ' x' + g3.bank[b.k]; }).join('; '));
  go('rguess');
};

/* ----- the rate guess and its reveal ----- */
V.rguess = function () {
  X.rt0 = Date.now(); var R = T.rate;
  show('<p class="kick">' + R.guessKick + '</p><h2 class="mid">' + R.guessTitle + '</h2><p class="q">' + R.guessQ + '</p>'
    + '<label class="guessrow" for="rg"><input id="rg" type="text" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="' + esc(R.guessAria) + '"><span>%</span></label>'
    + '<button class="btn go" id="rb" data-act="rguessGo" disabled>' + R.lock + '</button><button class="chip" data-act="rnoidea">' + R.noIdea + '</button>',
    function () {
      var inp = document.getElementById('rg'), b = document.getElementById('rb');
      inp.addEventListener('input', function () { b.disabled = !(parseRate(inp.value) >= 0); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !b.disabled) H.rguessGo(); });
    });
};
H.rguessGo = function () {
  var v = parseRate(document.getElementById('rg').value); if (!(v >= 0)) return;
  var r = S.run.r; r.guess = round2(v); r.noidea = 0; r.ms = Date.now() - (X.rt0 || Date.now());
  rec('Rate guess', fx(r.guess) + '%', 'took ' + secs(r.ms) + ' s'); go('myrate');
};
H.rnoidea = function () {
  var r = S.run.r; r.guess = null; r.noidea = 1; r.ms = Date.now() - (X.rt0 || Date.now());
  rec('Rate guess', T.sheet.noIdea, 'took ' + secs(r.ms) + ' s'); go('myrate');
};
V.myrate = function () {
  var m = me(), g = S.run.r.guess, R = T.rate, pts = m.acc.length * ST.ADDON_POINTS;
  var line = R.noGuessLine;
  if (g != null) { var d = round2(g - m.rate); line = Math.abs(d) < 0.005 ? R.spotOn : Math.abs(d) <= 0.5 ? R.close : d < 0 ? fmt(R.tooLow, { n: fx(Math.abs(d)) }) : fmt(R.tooHigh, { n: fx(d) }); }
  var hit = g != null && Math.abs(g - m.rate) < 0.005;
  var ptsTxt = fmt(R.plusPoints, { n: pts, s: pts === 1 ? '' : 's' });
  var tail = fmt(m.rt === 'fix' ? R.tailFixed : R.tailFloating, { amount: lakhS(ST.PRINCIPAL) });
  if (hit) {
    show('<p class="kick">' + R.revealKick + '</p>'
      + '<div class="sevenbox hit">' + confetti() + confetti() + '<div class="thxin"><p class="kick c">' + R.nailedKick + '</p><h2 class="big c">' + R.nailedTitle + '</h2><b class="hitrate" id="mr">' + fx(m.rate) + '%</b><p class="hitsub c">' + fmt(R.startedAt, { name: m.card.n, rate: fx(m.card.rate) }) + ' · ' + ptsTxt + '</p></div></div>'
      + host(T.registrar, fmt(R.nailedLine, { tail: tail }), 'mint')
      + '<button class="btn go" data-act="rateGo">' + R.next + '</button>');
    return;
  }
  show('<p class="kick">' + R.revealKick + '</p>'
    + '<div class="rateboard"><div><p class="kick">' + R.isLabel + '</p><b id="mr">' + fx(m.card.rate) + '%</b></div><div class="rbr"><span>' + fmt(R.startedAt, { name: m.card.n, rate: fx(m.card.rate) }) + '</span><span>' + ptsTxt + '</span></div></div>'
    + '<div class="facts"><div class="fact"><span>' + R.yourGuess + '</span><b>' + (g == null ? R.noIdeaShort : fx(g) + '%') + '</b></div><div class="fact hot"><span>' + R.actualRate + '</span><b>' + fx(m.rate) + '%</b></div></div>'
    + host(T.registrar, esc(line) + ' ' + esc(tail)) + '<button class="btn go" data-act="rateGo">' + R.next + '</button>',
    function () {
      var el = document.getElementById('mr'), t0 = performance.now(), x = m.card.rate, y = m.rate; if (x === y) return;
      X.timer = setInterval(function () { var k = Math.min(1, (performance.now() - t0) / 1000); el.textContent = fx(x + (y - x) * (1 - Math.pow(1 - k, 3))) + '%'; if (k >= 1) { clearInterval(X.timer); X.timer = null; } }, 30);
    });
};
H.rateGo = function () { go('guess'); };

/* ----- the last question and the bill ----- */
V.guess = function () {
  S.round = 4; X.gt0 = Date.now(); var m = me(), G = T.guess;
  show('<h2 class="mid">' + G.title + '</h2><p>' + fmt(G.intro, { amount: lakhS(ST.PRINCIPAL), rate: fx(m.rate), type: m.rt === 'fix' ? G.typeFixed : G.typeFloating }) + '</p><p class="q">' + G.q + '</p>'
    + '<label class="guessrow" for="guess"><span>₹</span><input id="guess" type="text" inputmode="decimal" autocomplete="off" placeholder="0"><span>' + G.unit + '</span></label>'
    + '<button class="btn go" id="gg" data-act="guessGo" disabled>' + G.lock + '</button><button class="chip" data-act="noidea">' + G.noIdea + '</button>',
    function () {
      var inp = document.getElementById('guess'), b = document.getElementById('gg');
      inp.addEventListener('input', function () { b.disabled = !(parseGuess(inp.value) >= 0); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !b.disabled) H.guessGo(); });
    });
};
var lockGuess = function (v) {
  var g4 = S.run.g4; g4.guess = v == null ? null : round2(v); g4.noidea = v == null ? 1 : 0; g4.ms = Date.now() - (X.gt0 || Date.now());
  var f = playersFields(S);
  rec('Interest guess', v == null ? T.sheet.noIdea : fx(g4.guess) + ' lakh', 'took ' + secs(g4.ms) + ' s' + (f.offBy != null ? ', off by Rs ' + f.offBy : ''));
  go('bill');
};
H.guessGo = function () { var v = parseGuess(document.getElementById('guess').value); if (!(v >= 0)) return; lockGuess(v); };
H.noidea = function () { lockGuess(null); };
var cover = function (k) { return '<button class="cover" data-act="rev" data-k="' + k + '">' + T.bill.tapToReveal + '</button>'; };
V.bill = function () {
  var m = me(), a = accrued(m.rate), g = S.run.g4.guess, B = T.bill;
  var baseInt = Math.round(accrued(m.card.rate)), totInt = Math.round(a), addInt = totInt - baseInt, n = m.acc.length;
  show('<p class="kick">' + B.kick + '</p><h2 class="big">' + B.title + '</h2>'
    + '<section class="revcard"><p class="kick">' + fmt(B.cardKick, { amount: lakhS(ST.PRINCIPAL).toUpperCase() }) + '</p><div class="revrow"><div class="fact"><span>' + B.yourGuess + '</span><b>' + (g == null ? B.noIdea : lakhS(g * 100000)) + '</b></div><div class="revslot" id="rv-int">' + cover('int') + '</div></div><div id="rv-int-n"></div></section>'
    + '<div id="rv-after" hidden><section class="revcard"><p class="kick">' + B.breakKick + '</p><div class="facts">'
    + '<div class="fact"><span>' + fmt(B.atQuoted, { name: m.card.n.toUpperCase() }) + '</span><b>' + inr(baseInt) + '</b><small>' + fmt(B.quotedSub, { rate: fx(m.card.rate) }) + '</small></div>'
    + (n ? '<div class="fact"><span>' + fmt(B.addedBy, { n: n, s: n === 1 ? '' : 'S' }) + '</span><b>' + inr(addInt) + '</b><small>' + fmt(B.addedSub, { pts: fx(n * ST.ADDON_POINTS) }) + '</small></div>'
         : '<div class="fact"><span>' + B.addedNone + '</span><b>' + B.addedNoneVal + '</b><small>' + B.addedNoneSub + '</small></div>')
    + '<div class="fact hot wide"><span>' + B.total + '</span><b>' + inr(totInt) + '</b><small>' + fmt(B.totalSub, { amount: lakhS(ST.PRINCIPAL), rate: fx(m.rate) }) + '</small></div></div></section>'
    + '<button class="btn go" data-act="billGo">' + B.next + '</button></div>',
    function () { if (S.billRev) H.rev({}, null, true); });
};
H.rev = function (d, b, instant) {
  var first = !S.billRev; S.billRev = true; persist();
  var m = me(), a = accrued(m.rate), g = S.run.g4.guess, B = T.bill;
  var el = document.getElementById('rv-int'); if (!el || el.classList.contains('pop')) return;
  if (first) rec('Interest reveal', 'tapped');
  el.className = 'revslot fact hot pop'; el.innerHTML = '<span>' + B.actual + '</span><b id="bn">₹0</b>';
  var verdict;
  if (g == null) verdict = B.vNoIdea;
  else { var r = g * 100000 / a; verdict = r < 0.25 ? B.vWayOff : r < 0.75 ? B.vLow : r <= 1.25 ? B.vClose : B.vHigh; }
  document.getElementById('rv-int-n').innerHTML = (g == null ? '' : '<div class="fact wide"><span>' + B.offBy + '</span><b>' + lakhS(Math.abs(g * 100000 - a)) + '</b></div>') + host(T.registrar, verdict);
  var t0 = performance.now(), bn = document.getElementById('bn'), after = document.getElementById('rv-after');
  if (X.timer) clearInterval(X.timer);
  if (instant) { bn.textContent = inr(a); if (after) after.hidden = false; return; }
  X.timer = setInterval(function () {
    var k = Math.min(1, (performance.now() - t0) / 1100); bn.textContent = inr(a * (1 - Math.pow(1 - k, 3)));
    if (k >= 1) { clearInterval(X.timer); X.timer = null; if (after) { after.hidden = false; after.classList.add('rise'); try { after.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {} } }
  }, 30);
};
H.billGo = function () { go('exit'); };

/* ----- exit interview, thanks ----- */
V.exit = function (keep) {
  var p = S.run.p, E = T.exit;
  var q = function (Q_) { return '<p class="q">' + esc(Q_.q) + '</p><div class="chips">' + Q_.opts.map(function (o) { return '<button class="chip ' + (p[Q_.k] === o[0] ? 'on' : '') + '" data-act="pf" data-q="' + Q_.k + '" data-v="' + o[0] + '" aria-pressed="' + (p[Q_.k] === o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; };
  show('<p class="kick">' + E.kick + '</p><h2 class="big">' + E.title + '</h2>' + host(T.registrar, E.line) + '<section class="tips">' + EXIT.map(q).join('') + '</section><button class="btn go" data-act="submit">' + E.submit + '</button>', null, keep);
};
H.pf = function (d) {
  var p = S.run.p, Q_ = findBy(EXIT, 'k', d.q), o = findBy(Q_.opts.map(function (x) { return { id: x[0], t: x[1] }; }), 'id', d.v);
  var clear = p[d.q] === d.v; if (clear) delete p[d.q]; else p[d.q] = d.v;
  rec('Exit: ' + Q_.label, clear ? T.sheet.cleared : o.t); V.exit(true);
};
H.submit = function () { S.run.sub = 1; rec('Submit', 'Exit interview submitted'); go('thanks'); };
V.thanks = function () {
  S.round = 4; var K = T.thanks;
  show('<div class="sevenbox thx">' + confetti() + '<div class="thxin"><div class="cheers" aria-hidden="true"><span>🍹</span><span class="mid">🥂</span><span>🍻</span></div><p class="kick c">' + K.kick + '</p><h2 class="big c">' + K.title + '</h2></div></div><button class="btn go" data-act="newGame">' + K.reset + '</button>');
};

/* ---------- start-up ---------- */
try { var im = new Image(); im.src = MEDIA.sevenImage; X.snd = new Audio(MEDIA.jackpotSound); X.snd.preload = 'auto'; } catch (e) {}
if (S.token && Q.conflict[S.token]) S.screen = 'conflict';
if (S.token && S.screen !== 'splash' && typeof V[S.screen] === 'function') V[S.screen](); else { S.screen = 'splash'; V.splash(); }
if (Q.items.length) kick(500);
paintPill();
})();
