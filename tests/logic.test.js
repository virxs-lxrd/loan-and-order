/* Tests for the game's pure logic (app.js) and the content (data.js). Run:  node tests/logic.test.js */
'use strict';
const fs = require('fs');
const path = require('path');
const { test, assert, done } = require('./harness');
const { createEnv } = require('./mock-gas');

globalThis.window = globalThis;
require('../data.js');
require('../app.js');
const L = globalThis.LOGIC, D = globalThis.GAME_DATA;
const { CARDS, UPSELLS: UP, BANKS, FACTORS, EXIT, SETTINGS: ST } = D;
const serverKeys = createEnv().COLUMNS;
const writable = new Set(serverKeys.filter(c => !c.server).map(c => c.key));

function play(card, takenKeys, opts) {
  opts = opts || {}; const S = L.freshState(); S.token = '482'; S.screen = opts.screen || 'banks';
  const c = CARDS[card], g1 = S.run.g1; g1.order = CARDS.map((_, i) => i); g1.short = opts.short || [card]; g1.pick = card; g1.factor = 'rate';
  S.run.g2.order = c.sc.slice(); S.run.g2.sc = c.sc.map(u => ({ u, a: takenKeys.includes(u) ? 1 : 0 }));
  return S;
}

console.log('app.js + data.js');

test('player numbers: 3 to 8 digits, numbers only', () => {
  assert.equal(L.validToken('482'), '482'); assert.equal(L.validToken(' 482 '), '482'); assert.equal(L.validToken('007'), '007');
  assert.equal(L.validToken('48'), null); assert.equal(L.validToken('123456789'), null); assert.equal(L.validToken('48a'), null); assert.equal(L.validToken(''), null); assert.equal(L.validToken(null), null);
  assert.equal(L.validToken('4 82'), null);
});
test('interest maths: simple interest over 5 years on 25 lakh', () => {
  assert.equal(L.accrued(8.5), 1062500); assert.equal(L.accrued(7), 875000); assert.equal(L.accrued(11.75), 1468750);
});
test('guess parsing: lakh, full rupees, junk', () => {
  assert.equal(L.parseGuess('12.5'), 12.5); assert.equal(L.parseGuess('1250000'), 12.5); assert.equal(L.parseGuess('12,50,000'), 12.5); assert.ok(Number.isNaN(L.parseGuess('abc'))); assert.ok(Number.isNaN(L.parseGuess('250')));
  assert.equal(L.parseRate('9,5'), 9.5); assert.ok(Number.isNaN(L.parseRate('41'))); assert.equal(L.parseRate('0'), 0);
});
test('text is escaped before it reaches the page', () => {
  assert.equal(L.fmt('Hi {n}!', { n: '<b>x</b>' }), 'Hi &lt;b&gt;x&lt;/b&gt;!'); assert.equal(L.fmt('{a} {missing}', { a: 1 }), '1 {missing}');
});
test('Harbor + no co-borrower + extra years: rate, security and years all move', () => {
  const t = L.terms(play(2, ['nocosign', 'tenure']).run);
  assert.equal(t.card.n, 'Harbor'); assert.equal(t.rate, 10.5); assert.equal(t.sec, 'No collateral, no co-borrower'); assert.equal(t.yrs, 17); assert.equal(t.rt, 'fix');
  assert.match(L.changesText(t), /Rate: 8.50% → 10.50%/); assert.match(L.changesText(t), /Repayment: 12 years → 17 years/); assert.match(L.changesText(t), /Security: Parent co-borrower, no collateral → No collateral, no co-borrower/);
});
test('Granite floating -> fixed is recorded as a change of rate type', () => {
  const t = L.terms(play(1, ['fixed']).run); assert.equal(t.rt, 'fix'); assert.equal(t.rate, 8.5);
  assert.match(L.changesText(t), /Rate type: Floating rate → Fixed rate/);
});
test('Orchid: dropping the pledge, then also the co-borrower, in either order', () => {
  assert.equal(L.terms(play(0, ['nocol']).run).sec, 'Parent co-borrower, no collateral');
  assert.equal(L.terms(play(0, ['nocol', 'nocosign']).run).sec, 'No collateral, no co-borrower');
  const s = play(0, ['nocosign', 'nocol']); s.run.g2.sc.reverse(); assert.equal(L.terms(s.run).sec, 'No collateral, no co-borrower');
});
test('perks (moratorium, top-up, salary account, manager) are listed, not applied to terms', () => {
  const t = L.terms(play(4, ['moratorium', 'rm', 'topup']).run); assert.deepEqual([...t.perks].sort(), ['+1 year moratorium', 'A relationship manager on WhatsApp', '₹3 lakh top-up, pre-approved'].sort()); assert.equal(t.rate, 12.75);
});
test('no add-ons: nothing changed', () => { assert.equal(L.changesText(L.terms(play(3, []).run)), 'No changes'); });

test('Players snapshot: a finished run fills every column the script expects', () => {
  const S = play(2, ['nocosign', 'tenure'], { short: [2, 3], screen: 'thanks' }); const r = S.run;
  r.g1.factor = 'rate'; r.g3.coins = 7; r.g3.bank = { prepay: 2, sip: 5 }; r.g3.done = true; r.r = { guess: 10.5, noidea: 0, ms: 6400 }; r.g4 = { guess: 14.2, noidea: 0, ms: 12345 };
  r.p = { fund: 'loan', work: 'lt2', channel: 'call' }; r.sub = 1;
  const f = L.playersFields(S);
  assert.equal(f.token, '482'); assert.equal(f.attempt, 1); assert.equal(f.status, 'Finished'); assert.equal(f.screen, 'thanks');
  assert.equal(f.shortlist, 'Harbor 8.50% Fixed rate; Cedar 8.75% Floating rate'); assert.equal(f.factor, 'Interest Rate + Fixed or Floating');
  assert.equal(f.lender, 'Harbor'); assert.equal(f.qRate, 8.5); assert.equal(f.qType, 'Fixed rate'); assert.equal(f.qLender, 'Government-owned bank'); assert.equal(f.qYears, 12);
  assert.equal(f.taken, 'No co-borrower; Five extra years to repay'); assert.match(f.skipped, /Zero branch visits/); assert.equal(f.fRate, 10.5); assert.equal(f.fYears, 17);
  assert.equal(f.coins, 'Prepay the loan x2; SIPs and investing x5'); assert.equal(f.rateGuess, 10.5); assert.equal(f.rateGuessSecs, 6.4);
  assert.equal(f.guess, 14.2); assert.equal(f.guessSecs, 12.3); assert.equal(f.actual, 1312500); assert.equal(f.offBy, 107500);
  assert.equal(f.fund, 'An education loan'); assert.equal(f.work, 'Under 2 years'); assert.equal(f.channel, 'A video KYC, then e-sign');
});
test('Players snapshot: "no idea" is written as words, with no Off by', () => {
  const S = play(0, []); S.run.g4 = { guess: null, noidea: 1, ms: 3000 }; S.run.r = { guess: null, noidea: 1, ms: 2000 };
  const f = L.playersFields(S); assert.equal(f.guess, 'No idea'); assert.equal(f.rateGuess, 'No idea'); assert.equal(f.offBy, undefined); assert.equal(f.actual, 875000);
});
test('Players snapshot: an early state does not invent answers', () => {
  const S = L.freshState(); S.token = '482'; const f = L.playersFields(S);
  assert.deepEqual(Object.keys(f).sort(), ['attempt', 'factor', 'screen', 'shortlist', 'status', 'token']); assert.equal(f.status, 'Playing'); assert.equal(f.shortlist, '');
});
test('Players snapshot: passing on every card is recorded once a lender is picked', () => {
  const S = play(5, [], { short: [] }); assert.equal(L.playersFields(S).shortlist, 'None (passed on all)');
});
test('coins are only written once the player confirms them', () => {
  const S = play(5, []); S.run.g3.coins = 7; S.run.g3.bank = { trip: 3 }; assert.equal(L.playersFields(S).coins, undefined);
  S.run.g3.done = true; assert.equal(L.playersFields(S).coins, 'Trips and holidays x3');
});
test('every card x every combination of add-ons gives a clean snapshot the script will accept', () => {
  let n = 0;
  CARDS.forEach((c, ci) => {
    for (let mask = 0; mask < (1 << c.sc.length); mask++) {
      const taken = c.sc.filter((_, i) => mask & (1 << i)); const S = play(ci, taken); S.run.g4 = { guess: 12.34, noidea: 0, ms: 5000 }; S.run.r = { guess: 9, noidea: 0, ms: 1000 };
      const f = L.playersFields(S), t = L.terms(S.run);
      Object.keys(f).forEach(k => { assert.ok(writable.has(k), 'column the script would refuse: ' + k); const v = f[k]; assert.ok(typeof v === 'string' || typeof v === 'number', k + ' has type ' + typeof v); if (typeof v === 'number') assert.ok(Number.isFinite(v)); });
      assert.equal(f.fRate, Math.round((c.rate + taken.length * ST.ADDON_POINTS) * 100) / 100); assert.equal(f.actual, Math.round(L.accrued(t.rate)));
      assert.equal(f.taken.split('; ').filter(Boolean).length, taken.length); n++;
    }
  });
  assert.ok(n > 300, 'ran ' + n);
});
test('every column the game can fill exists in the script, and the exit questions map to real columns', () => {
  ['fund', 'work', 'channel'].forEach(k => assert.ok(writable.has(k))); EXIT.forEach(q => assert.ok(writable.has(q.k), q.k));
});

test('content: add-ons, cards, banks and factors are consistent', () => {
  const names = new Set(); CARDS.forEach(c => { assert.ok(!names.has(c.n), 'duplicate lender ' + c.n); names.add(c.n); assert.ok(['flt', 'fix'].includes(c.rt)); assert.ok(c.rate > 0 && c.yrs > 0); c.sc.forEach(u => assert.ok(UP[u], c.n + ' offers unknown add-on ' + u)); assert.equal(new Set(c.sc).size, c.sc.length); });
  Object.keys(UP).forEach(u => { assert.ok(UP[u].t && UP[u].d); assert.ok(UP[u].effect || UP[u].perk, u + ' does nothing'); });
  assert.equal(new Set(BANKS.map(b => b.k)).size, BANKS.length); assert.equal(new Set(FACTORS.map(b => b.k)).size, FACTORS.length);
  EXIT.forEach(q => assert.equal(new Set(q.opts.map(o => o[0])).size, q.opts.length));
  assert.equal(ST.COINS, 7); assert.equal(CARDS.length, 8);
});
test('content: the add-on story lines only use words the game fills in', () => {
  Object.keys(UP).forEach(u => (UP[u].d.match(/\{(\w+)\}/g) || []).forEach(m => assert.ok(['{time}', '{yrs}', '{yrs5}'].includes(m), u + ' uses ' + m)));
});
test('content: every file name in data.js points at a real file', () => {
  Object.values(D.MEDIA).forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', f)), 'missing file ' + f));
});
test('nothing loads from the internet (fest Wi-Fi): no external links in the site files', () => {
  ['index.html', 'style.css', 'app.js'].forEach(f => {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.doesNotMatch(src, /(src|href)=["']https?:/); assert.doesNotMatch(src, /url\(\s*["']?https?:/); assert.doesNotMatch(src, /@import/);
  });
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  (css.match(/url\('([^']+)'\)/g) || []).forEach(u => { const f = u.slice(5, -2); assert.ok(fs.existsSync(path.join(__dirname, '..', f)), 'font file missing: ' + f); });
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), /\bXMLHttpRequest\b|cdn\.|googleapis|jsdelivr|unpkg/);
});
test('the request is sent as text/plain (no CORS preflight)', () => {
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), /'Content-Type': 'text\/plain;charset=utf-8'/);
});
test('the EXEC_URL ships empty (practice mode) until the organiser pastes it', () => { assert.equal(typeof ST.EXEC_URL, 'string'); });

done('app.js + data.js tests');
