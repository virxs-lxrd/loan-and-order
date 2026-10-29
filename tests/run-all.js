/* Runs the tests that need nothing installed. Add --e2e to also run the browser tests (needs: npm i playwright). */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const files = ['code.test.js', 'logic.test.js'].concat(process.argv.includes('--e2e') ? ['e2e.test.js'] : []);
let bad = 0;
files.forEach(f => { console.log('\n=== ' + f + ' ==='); const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' }); if (r.status !== 0) bad++; });
console.log(bad ? '\nSOME TESTS FAILED' : '\nALL TESTS PASSED'); process.exit(bad ? 1 : 0);
