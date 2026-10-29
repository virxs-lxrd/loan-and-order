/* End-to-end tests: a real browser plays the game against the real Code.gs (on a pretend sheet).
   Needs Playwright (npm i playwright). Run:  node tests/e2e.test.js */
'use strict';
const { test, assert, done } = require('./harness');
const { createRig } = require('./mock-server');
const { chromium } = require('playwright');
globalThis.window = globalThis; require('../data.js'); require('../app.js');
const L = globalThis.LOGIC, D = globalThis.GAME_DATA;

const FAST = { 'START_TIMEOUT_MS: 7000': 'START_TIMEOUT_MS: 1200', 'RETRY_FIRST_MS: 2000': 'RETRY_FIRST_MS: 250', 'RETRY_MAX_MS: 30000': 'RETRY_MAX_MS: 800', 'SEND_TIMEOUT_MS: 25000': 'SEND_TIMEOUT_MS: 3000' };
const seedScript = (seed) => `(()=>{let a=${seed}>>>0;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`;

let browser;
async function newDevice(rig, seed) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); await page.addInitScript(seedScript(seed || 7));
  page.hosts = new Set(); page.errors = [];
  page.on('request', r => { try { page.hosts.add(new URL(r.url()).host); } catch (e) {} });
  page.on('pageerror', e => page.errors.push(String(e)));
  await page.goto(rig.url); await page.waitForSelector('#tok');
  return { ctx, page };
}
const txt = (page, sel) => page.locator(sel).first().innerText();
const click = (page, act, extra) => page.click('[data-act="' + act + '"]' + (extra || ''));
const queueLen = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('sg_queue_v1') || '[]').length);
const drain = (page, ms) => page.waitForFunction(() => JSON.parse(localStorage.getItem('sg_queue_v1') || '[]').length === 0, null, { timeout: ms || 15000 });
const overflow = async (page, label, bad) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) bad.push(label + ' (+' + o + 'px)'); };

async function enterToken(page, tok) { await page.fill('#tok', tok); }
async function startGame(page, tok) { await enterToken(page, tok); await page.click('#playbtn'); await page.waitForSelector('[data-act="g1go"]', { timeout: 15000 }); }
async function swipeCards(page, plan) { /* plan: array of booleans, true = shortlist; returns [{name, yes}] */
  await click(page, 'g1go'); const seen = [];
  for (let i = 0; i < plan.length; i++) {
    await page.waitForSelector('.card.cur .gn'); const name = await txt(page, '.card.cur .gn');
    await click(page, 'swipe', '[data-v="' + (plan[i] ? 1 : 0) + '"]'); seen.push({ name, yes: plan[i] });
    await page.waitForFunction(p => { const e = document.querySelector('.card.cur .gn'); return !e || e.textContent !== p; }, name);
  }
  return seen;
}
async function factorAndLock(page) {
  await page.waitForSelector('[data-act="factor"]'); await click(page, 'factor', '[data-v="rate"]'); await click(page, 'factorGo');
  await page.waitForSelector('.gc'); await page.click('.gc >> nth=0'); const lockText = await txt(page, '#lock'); await click(page, 'lock'); return lockText;
}
async function upsell(page, takePattern) {
  await page.waitForSelector('[data-act="g2go"]'); await click(page, 'g2go'); const answered = []; let i = 0;
  while (await page.locator('[data-act="deal"]').count()) {
    const title = await txt(page, '.offer h3'); const take = takePattern[i++ % takePattern.length];
    await click(page, 'deal', '[data-v="' + (take ? 1 : 0) + '"]'); answered.push({ title, take });
    await page.waitForFunction(t => { const e = document.querySelector('.offer h3'); return !e || e.textContent !== t; }, title);
  }
  await page.waitForSelector('[data-act="sumGo"]'); return answered;
}
async function banks(page, order) {
  await click(page, 'g3go'); await page.waitForSelector('[data-act="toBanks"]'); await click(page, 'toBanks'); await page.waitForSelector('.pigtap');
  for (const k of order) await page.click('[data-act="drop"][data-k="' + k + '"]');
  await page.waitForFunction(() => !document.getElementById('done').disabled); await click(page, 'banksDone');
}
async function toExit(page, rateGuess, interestGuess, bad) {
  await page.fill('#rg', String(rateGuess)); await click(page, 'rguessGo'); await page.waitForSelector('[data-act="rateGo"]'); await overflow(page, 'rate reveal', bad); await click(page, 'rateGo');
  await page.fill('#guess', String(interestGuess)); await click(page, 'guessGo'); await page.waitForSelector('.cover'); await page.click('.cover');
  await page.waitForSelector('#rv-after:not([hidden])'); await overflow(page, 'bill', bad); await click(page, 'billGo'); await page.waitForSelector('[data-act="submit"]');
}
const REPORT = {};

(async () => {
  browser = await chromium.launch();
  console.log('Browser end-to-end');

  await test('full game on a phone-size screen: every answer lands in the Players row and the Swipe log', async () => {
    const rig = await createRig(); const { page } = await newDevice(rig); const bad = [];
    await overflow(page, 'splash', bad);
    assert.equal(await page.locator('#playbtn').isDisabled(), true);
    await page.fill('#tok', '12'); assert.equal(await page.locator('#playbtn').isDisabled(), true); await page.fill('#tok', 'ab1x2y3'); assert.equal(await page.inputValue('#tok'), '123');
    await startGame(page, '482'); assert.equal(rig.env.rowObj('482').status, 'Playing'); await overflow(page, 'intro', bad);
    const seen = await swipeCards(page, [false, true, false, true, true, false, false, false]); await overflow(page, 'after swipe', bad);
    const lockText = await factorAndLock(page); await overflow(page, 'shortlist', bad);
    const pickName = lockText.replace(/^LOCK IN /, '').split(' AT ')[0];
    const ans = await upsell(page, [true, false, true]); await overflow(page, 'upsell summary', bad); await click(page, 'sumGo');
    await banks(page, ['prepay', 'prepay', 'sip', 'sip', 'sip', 'trip', 'emerg']); await overflow(page, 'banks', bad);
    await toExit(page, 9.5, 12.5, bad);
    await click(page, 'pf', '[data-q="fund"][data-v="loan"]'); await click(page, 'pf', '[data-q="work"][data-v="lt2"]'); await click(page, 'pf', '[data-q="channel"][data-v="call"]');
    await overflow(page, 'exit', bad); await click(page, 'submit'); await page.waitForSelector('.thx'); await overflow(page, 'thanks', bad);
    await drain(page); assert.equal(await queueLen(page), 0);
    const row = rig.env.rowObj('482'), shortNames = seen.filter(s => s.yes).map(s => s.name);
    assert.equal(row.status, 'Finished'); assert.ok(row.finished instanceof Date); assert.equal(row.attempt, 1); assert.equal(row.screen, 'thanks');
    assert.equal(row.shortlist.split('; ').map(s => s.split(' ')[0]).join(','), shortNames.join(','), 'shortlist in the order swiped right');
    assert.equal(row.factor, 'Interest Rate + Fixed or Floating'); assert.equal(row.lender.toUpperCase(), pickName);
    const card = D.CARDS.find(c => c.n.toUpperCase() === pickName);
    assert.equal(row.qRate, card.rate); assert.equal(row.qType, D.TEXT.sheet.rateTypes[card.rt]); assert.equal(row.qSecurity, card.sec); assert.equal(row.qYears, card.yrs);
    assert.equal(row.taken, ans.filter(a => a.take).map(a => a.title).join('; ')); assert.equal(row.skipped, ans.filter(a => !a.take).map(a => a.title).join('; '));
    const nTaken = ans.filter(a => a.take).length; assert.equal(row.fRate, Math.round((card.rate + nTaken) * 100) / 100);
    assert.equal(row.coins, 'Prepay the loan x2; SIPs and investing x3; Trips and holidays x1; Emergency fund x1');
    assert.equal(row.rateGuess, 9.5); assert.ok(row.rateGuessSecs >= 0); assert.equal(row.guess, 12.5); assert.ok(row.guessSecs >= 0);
    assert.equal(row.actual, Math.round(L.accrued(row.fRate))); assert.equal(row.offBy, Math.round(Math.abs(12.5e5 - row.actual)));
    assert.equal(row.fund, 'An education loan'); assert.equal(row.work, 'Under 2 years'); assert.equal(row.channel, 'A video KYC, then e-sign'); assert.ok(row.device.startsWith('d'));
    assert.ok(row.changes.length > 0);
    const log = rig.env.sheet('Swipe log').table().slice(1), items = log.map(r => r[3]);
    assert.equal(items.filter(i => i.startsWith('Swipe: ')).length, 8); assert.equal(items.filter(i => i === 'Game start').length, 1);
    assert.equal(items.filter(i => i.startsWith('Add-on: ')).length, ans.length); assert.equal(items.filter(i => i.startsWith('Coin: ')).length, 7);
    ['Card order shown', 'Factor that mattered most', 'Locked lender', 'Rate guess', 'Interest guess', 'Interest reveal', 'Exit: How the MBA is paid for', 'Submit', 'Coins confirmed', 'Placement reveal'].forEach(i => assert.ok(items.includes(i), 'log is missing: ' + i));
    assert.equal(new Set(log.map(r => r[6])).size, 1, 'one device id'); assert.ok(log.every(r => r[1] === '482' && r[2] === 1));
    const swipeRows = log.filter(r => r[3].startsWith('Swipe: ')); assert.deepEqual(swipeRows.map(r => r[3].slice(7)), seen.map(s => s.name)); assert.deepEqual(swipeRows.map(r => r[4]), seen.map(s => s.yes ? 'Shortlist' : 'Pass'));
    assert.equal(rig.ctl.preflights, 0, 'no CORS preflight'); assert.ok(rig.ctl.requests.every(r => /^text\/plain/.test(r.contentType)), 'every post is text/plain');
    const hosts = [...page.hosts].filter(h => !h.startsWith('127.0.0.1:' + rig.ctl.sitePort) && !h.startsWith('127.0.0.1:' + rig.ctl.execPort)); assert.deepEqual(hosts, [], 'nothing loaded from other sites');
    assert.deepEqual(bad, [], 'sideways scrolling on: ' + bad.join(', ')); assert.deepEqual(page.errors, []);
    assert.ok(await page.evaluate(() => document.fonts.check('700 16px Poppins')), 'Poppins loads from the repo');
    REPORT.requests = rig.ctl.requests.length; rig.close();
  });

  await test('two phones: the same number is refused with a clear message and the first phone is untouched', async () => {
    const rig = await createRig(); const A = await newDevice(rig, 1), B = await newDevice(rig, 2);
    await startGame(A.page, '482'); const snap = JSON.stringify(rig.env.sheet('Players').table()), logN = rig.env.sheet('Swipe log').getLastRow();
    await enterToken(B.page, '482'); await B.page.click('#playbtn'); await B.page.waitForSelector('#tokerr:not([hidden])');
    assert.match(await txt(B.page, '#tokerr'), /already taken/); assert.equal(await B.page.locator('#tok').count(), 1); assert.equal(await B.page.locator('#playbtn').isDisabled(), false);
    assert.equal(JSON.stringify(rig.env.sheet('Players').table()), snap); assert.equal(rig.env.sheet('Swipe log').getLastRow(), logN);
    await enterToken(B.page, '483'); await B.page.click('#playbtn'); await B.page.waitForSelector('[data-act="g1go"]'); assert.equal(rig.env.sheet('Players').getLastRow(), 3);
    rig.close();
  });

  await test('reload in the middle of the game: it carries on from the same card, with the same order', async () => {
    const rig = await createRig(); const { page } = await newDevice(rig); await startGame(page, '482');
    await swipeCards(page, [true, false]); const before = await txt(page, '.card.cur .gn'); const prog = await txt(page, '.prog');
    await drain(page); await page.reload(); await page.waitForSelector('.card.cur .gn');
    assert.equal(await txt(page, '.card.cur .gn'), before); assert.equal(await txt(page, '.prog'), prog); assert.match(await txt(page, '#sync'), /No\. 482/);
    await click(page, 'swipe', '[data-v="1"]'); await drain(page); assert.equal(rig.env.rowObj('482').shortlist.split('; ').length, 2); rig.close();
  });

  await test('back buttons: each step is logged and the sheet shows the corrected answer', async () => {
    const rig = await createRig(); const { page } = await newDevice(rig); await startGame(page, '482');
    const seen = await swipeCards(page, [true, true, false]); /* shortlisted first two, passed the third */
    const third = await txt(page, '.card.cur .gn'); await page.click('[data-act="back"]'); await page.waitForFunction(t => document.querySelector('.card.cur .gn').textContent !== t, third);
    const prev = await txt(page, '.card.cur .gn'); assert.equal(prev, seen[2].name); /* now showing card 3 again */
    await click(page, 'swipe', '[data-v="1"]'); await drain(page);
    const row = rig.env.rowObj('482'); assert.equal(row.shortlist.split('; ').length, 3, 'card 3 was changed from Pass to Shortlist');
    const log = rig.env.sheet('Swipe log').table().slice(1); assert.ok(log.some(r => r[3] === 'Back'), 'Back is logged'); assert.equal(log.filter(r => r[3].startsWith('Swipe: ')).length, 4);
    rig.close();
  });

  await test('sheet down at the start: the game still begins, answers wait in the phone, then arrive once, in order', async () => {
    const rig = await createRig({ dataTweaks: FAST }); const { page } = await newDevice(rig); rig.ctl.down = true;
    await startGame(page, '555'); assert.equal(rig.env.rowObj('555'), null);
    await swipeCards(page, [true, true, false]); await page.waitForFunction(() => /offline/.test(document.getElementById('sync').textContent), null, { timeout: 8000 });
    assert.ok(await queueLen(page) > 0);
    rig.ctl.down = false; await drain(page, 20000);
    const row = rig.env.rowObj('555'); assert.equal(row.status, 'Playing'); assert.equal(row.shortlist.split('; ').length, 2);
    const items = rig.env.sheet('Swipe log').table().slice(1).map(r => r[3]); assert.equal(items.filter(i => i === 'Game start').length, 1); assert.equal(items.filter(i => i.startsWith('Swipe: ')).length, 3); assert.equal(items[0], 'Game start');
    assert.match(await txt(page, '#sync'), /saved/); rig.close();
  });

  await test('lost reply: the sheet saved it but the phone never heard back; the retry does not duplicate anything', async () => {
    const rig = await createRig({ dataTweaks: FAST }); const { page } = await newDevice(rig); await startGame(page, '321'); await drain(page);
    rig.ctl.dropReplies = 1; await click(page, 'g1go'); await page.waitForSelector('.card.cur');
    await drain(page, 15000);
    const items = rig.env.sheet('Swipe log').table().slice(1).map(r => r[3]); assert.equal(items.filter(i => i === 'Card order shown').length, 1, 'written exactly once'); assert.ok(rig.ctl.requests.length >= 3);
    rig.close();
  });

  await test('two phones offline with the same number: the second one gets the "number is taken" screen and writes nothing', async () => {
    const rig = await createRig({ dataTweaks: FAST }); const A = await newDevice(rig, 1), B = await newDevice(rig, 2);
    await startGame(A.page, '777'); await drain(A.page); const devA = rig.env.rowObj('777').device;
    rig.ctl.down = true; await startGame(B.page, '777'); await swipeCards(B.page, [true]); rig.ctl.down = false;
    await B.page.waitForSelector('text=THAT NUMBER IS TAKEN', { timeout: 20000 });
    const row = rig.env.rowObj('777'); assert.equal(row.device, devA); assert.equal(row.shortlist, '');
    assert.ok(rig.env.sheet('Swipe log').table().slice(1).every(r => r[6] === devA), 'nothing from the second phone reached the log');
    assert.equal(await queueLen(B.page), 0); const blocked = await B.page.evaluate(() => JSON.parse(localStorage.getItem('sg_blocked_v1')));
    assert.ok(blocked.items.length >= 2 && blocked.conflict['777'] === 'TOKEN_EXISTS', 'their answers are kept aside, not thrown away');
    await B.page.reload(); await B.page.waitForSelector('text=THAT NUMBER IS TAKEN');
    await click(B.page, 'newGame'); await B.page.waitForSelector('#tok'); assert.equal(await B.page.inputValue('#tok'), ''); rig.close();
  });

  await test('the Players row was deleted by hand mid-game: the game recreates it with everything so far', async () => {
    const rig = await createRig({ dataTweaks: FAST }); const { page } = await newDevice(rig); await startGame(page, '909');
    await swipeCards(page, [true, true]); await drain(page);
    const sh = rig.env.sheet('Players'); Object.keys(sh.cells).forEach(k => { if (k.startsWith('2,')) delete sh.cells[k]; }); assert.equal(rig.env.rowObj('909'), null);
    await click(page, 'swipe', '[data-v="1"]'); await drain(page, 15000);
    const row = rig.env.rowObj('909'); assert.ok(row, 'row is back'); assert.equal(row.shortlist.split('; ').length, 3); assert.equal(row.status, 'Playing');
    assert.ok(rig.env.sheet('Swipe log').table().slice(1).some(r => r[3] === 'Row restored')); rig.close();
  });

  await test('someone edits a Players header: answers stay in the phone and catch up once it is fixed', async () => {
    const rig = await createRig({ dataTweaks: FAST }); const { page } = await newDevice(rig); await startGame(page, '606'); await drain(page);
    const sh = rig.env.sheet('Players'); const orig = sh._get(1, 9); sh._set(1, 9, 'Oops');
    await swipeCards(page, [true, true]); await page.waitForFunction(() => /offline|not saving/.test(document.getElementById('sync').textContent), null, { timeout: 8000 });
    assert.ok(await queueLen(page) > 0); assert.equal(rig.env.rowObj('606').shortlist, '');
    sh._set(1, 9, orig); await drain(page, 20000); assert.equal(rig.env.rowObj('606').shortlist.split('; ').length, 2); rig.close();
  });

  await test('RESET clears the game for the next player but keeps unsent answers', async () => {
    const rig = await createRig(); const { page } = await newDevice(rig); await startGame(page, '111');
    await swipeCards(page, [true, true, true, true, true, true, true, true]); await factorAndLock(page); await upsell(page, [false]); await click(page, 'sumGo');
    await banks(page, ['fun', 'fun', 'fun', 'fun', 'fun', 'fun', 'fun']); await toExit(page, 0, 5, []); await click(page, 'pf', '[data-q="fund"][data-v="other"]'); await click(page, 'submit');
    await page.waitForSelector('[data-act="newGame"]'); await drain(page); await click(page, 'newGame'); await page.waitForSelector('#tok');
    assert.equal(await page.inputValue('#tok'), ''); assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sg_state_v1')).token), null);
    assert.equal(rig.env.rowObj('111').status, 'Finished'); assert.equal(rig.env.rowObj('111').fund, 'Other');
    await startGame(page, '112'); assert.equal(rig.env.sheet('Players').getLastRow(), 3); rig.close();
  });

  await test('"no idea" answers, and a perfectly right rate guess, are saved properly', async () => {
    const rig = await createRig(); const { page } = await newDevice(rig); await startGame(page, '222');
    await swipeCards(page, [true, false, false, false, false, false, false, false]); await factorAndLock(page); await upsell(page, [false]); await click(page, 'sumGo');
    await banks(page, ['car', 'car', 'car', 'car', 'car', 'car', 'car']);
    const pick = await page.evaluate(() => JSON.parse(localStorage.getItem('sg_state_v1')).run.g1.pick); const exact = D.CARDS[pick].rate;
    await page.fill('#rg', String(exact)); await click(page, 'rguessGo'); await page.waitForSelector('text=NAILED IT'); await click(page, 'rateGo');
    await click(page, 'noidea'); await page.waitForSelector('.cover'); await page.click('.cover'); await page.waitForSelector('#rv-after:not([hidden])'); await click(page, 'billGo');
    await drain(page); const row = rig.env.rowObj('222'); assert.equal(row.rateGuess, exact); assert.equal(row.guess, 'No idea'); assert.equal(row.offBy, ''); assert.ok(row.actual > 0); rig.close();
  });

  await test('practice mode: with no sheet address the game still plays and says so', async () => {
    const rig = await createRig({ noExecUrl: true }); const { page } = await newDevice(rig);
    assert.match(await txt(page, '.warn'), /Practice mode/); await startGame(page, '123'); assert.match(await txt(page, '#sync'), /practice mode/); assert.equal(rig.ctl.requests.length, 0); rig.close();
  });

  await test('editing a word in data.js changes the screen (all text lives in one file)', async () => {
    const rig = await createRig({ dataTweaks: { 'play: "PLAY"': 'play: "GO NOW"', 'tokenLabel: "YOUR NUMBER"': 'tokenLabel: "TABLE NUMBER"' } }); const { page } = await newDevice(rig);
    assert.equal(await txt(page, '#playbtn'), 'GO NOW'); assert.equal(await txt(page, '.toklabel'), 'TABLE NUMBER'); rig.close();
  });

  await browser.close();
  console.log('\n(requests in the full game: ' + REPORT.requests + ')');
  await done('Browser tests');
})().catch(e => { console.error(e); process.exit(1); });
