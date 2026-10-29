/* Two tiny web servers for testing in a browser:
   - the SITE server (like GitHub Pages): serves the repo folder
   - the EXEC server (like the Apps Script /exec address): runs the real Code.gs on a pretend sheet
   They are on different ports on purpose, so the browser does real cross-site (CORS) checks. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createEnv } = require('./mock-gas');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.md': 'text/plain' };

function listen(server) { return new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port))); }

async function createRig(opts) {
  opts = opts || {};
  const root = path.join(__dirname, '..');
  const env = opts.env || createEnv(); if (opts.setup !== false) env.setup();
  const ctl = { down: false, delayMs: 0, dropReplies: 0, requests: [], preflights: 0, execPort: 0, sitePort: 0, hosts: new Set() };

  const exec = http.createServer((req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (req.method === 'OPTIONS') { ctl.preflights++; res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type' }); return res.end(); }
    if (req.method === 'GET') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify(env.get())); }
    let body = ''; req.on('data', d => body += d);
    req.on('end', () => {
      ctl.requests.push({ contentType: req.headers['content-type'], body });
      if (ctl.down) { return req.socket.destroy(); }
      setTimeout(() => {
        const out = env.postRaw(body);
        if (ctl.dropReplies > 0) { ctl.dropReplies--; return req.socket.destroy(); } /* the sheet saved it, but the phone never hears back */
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      }, ctl.delayMs);
    });
  });
  const site = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    let data = fs.readFileSync(f);
    if (p === '/data.js') {
      let s = data.toString('utf8');
      s = s.replace('EXEC_URL: ""', 'EXEC_URL: ' + (opts.noExecUrl ? '""' : JSON.stringify('http://127.0.0.1:' + ctl.execPort + '/exec')));
      Object.entries(opts.dataTweaks || {}).forEach(([a, b]) => { if (!s.includes(a)) throw new Error('tweak not found: ' + a); s = s.replace(a, b); });
      data = Buffer.from(s);
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  });
  ctl.execPort = await listen(exec); ctl.sitePort = await listen(site);
  return { env, ctl, url: 'http://127.0.0.1:' + ctl.sitePort + '/', execUrl: 'http://127.0.0.1:' + ctl.execPort + '/exec', close: () => { exec.closeAllConnections && exec.closeAllConnections(); site.closeAllConnections && site.closeAllConnections(); exec.close(); site.close(); } };
}
module.exports = { createRig };
