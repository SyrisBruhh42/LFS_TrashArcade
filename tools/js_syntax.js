#!/usr/bin/env node
'use strict';
// Compiles each given file as a classic browser <script> with vm.Script (parse only, never executed).
// Usage: node tools/js_syntax.js <file> [<file> ...]   Exit 1 if any file has a syntax error.
const fs = require('fs');
const vm = require('vm');

let bad = 0;
for (const file of process.argv.slice(2)) {
  try {
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
  } catch (err) {
    bad += 1;
    const loc = ((err.stack || '').split('\n')[0].match(/:(\d+)$/) || [])[1];
    console.log(`SYNTAX\t${file}\t${err.name}: ${err.message}${loc ? ` (line ${loc})` : ''}`);
  }
}
process.exit(bad ? 1 : 0);
