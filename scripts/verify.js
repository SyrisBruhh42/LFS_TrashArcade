#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function fail(msg) {
  console.error(`[VERIFY FAILED] ${msg}`);
  process.exit(1);
}

// 1. Confirm ./index.html and ./games/registry.js exist
const rootIndexPath = path.join(ROOT, 'index.html');
const registryPath = path.join(ROOT, 'games', 'registry.js');

if (!fs.existsSync(rootIndexPath) || fs.statSync(rootIndexPath).size === 0) {
  fail('./index.html is missing or empty.');
}
if (!fs.existsSync(registryPath) || fs.statSync(registryPath).size === 0) {
  fail('./games/registry.js is missing or empty.');
}

// Parse window.ARCADE_REGISTRY in a vm context
const registrySource = fs.readFileSync(registryPath, 'utf8');
const sandbox = { window: {} };
try {
  vm.createContext(sandbox);
  new vm.Script(registrySource, { filename: 'games/registry.js' }).runInContext(sandbox);
} catch (err) {
  fail(`./games/registry.js failed to parse in vm context: ${err.message}`);
}

const registry = sandbox.window && sandbox.window.ARCADE_REGISTRY;
if (!Array.isArray(registry) || registry.length < 1) {
  fail('window.ARCADE_REGISTRY must be a non-empty Array with at least 1 valid entry.');
}

const seenIds = new Set();
const seenSlugs = new Set();

for (const entry of registry) {
  if (!entry || typeof entry !== 'object') {
    fail('Invalid non-object entry in window.ARCADE_REGISTRY.');
  }
  const { id, slug, title, path: gamePath } = entry;
  if (!id || typeof id !== 'string') {
    fail(`Entry missing valid string 'id': ${JSON.stringify(entry)}`);
  }
  if (!slug || typeof slug !== 'string') {
    fail(`Entry ${id} missing valid string 'slug'.`);
  }
  if (!title || typeof title !== 'string') {
    fail(`Entry ${id} missing valid string 'title'.`);
  }
  if (seenIds.has(id)) {
    fail(`Duplicate id "${id}" found in window.ARCADE_REGISTRY.`);
  }
  if (seenSlugs.has(slug)) {
    fail(`Duplicate slug "${slug}" found in window.ARCADE_REGISTRY.`);
  }
  seenIds.add(id);
  seenSlugs.add(slug);

  // 2. For every entry in window.ARCADE_REGISTRY:
  const gameDir = path.join(ROOT, 'games', slug);
  const gameIndexPath = path.join(gameDir, 'index.html');
  if (!fs.existsSync(gameIndexPath) || fs.statSync(gameIndexPath).size === 0) {
    fail(`./games/${slug}/index.html is missing or empty.`);
  }

  const html = fs.readFileSync(gameIndexPath, 'utf8');

  // Collect all source files (index.html + any local .js/.css files in the game directory)
  let combinedSource = html;
  const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  const scriptsToCompile = [];

  while ((match = scriptTagRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    const inlineCode = match[2] || '';

    if (/\btype\s*=\s*['"]?module['"]?/i.test(attrs)) {
      fail(`${slug}: <script type="module"> is forbidden.`);
    }

    const srcMatch = attrs.match(/\bsrc\s*=\s*['"]([^'"]+)['"]/i);
    if (srcMatch) {
      const srcVal = srcMatch[1];
      if (/^(https?:)?\/\//i.test(srcVal)) {
        fail(`${slug}: External script src "${srcVal}" is forbidden.`);
      }
      const localScriptPath = path.resolve(gameDir, srcVal);
      if (!fs.existsSync(localScriptPath)) {
        fail(`${slug}: Referenced local script "${srcVal}" does not exist.`);
      }
      const localJs = fs.readFileSync(localScriptPath, 'utf8');
      combinedSource += '\n' + localJs;
      scriptsToCompile.push({ name: `${slug}/${srcVal}`, code: localJs });
    } else if (inlineCode.trim().length > 0) {
      scriptsToCompile.push({ name: `${slug}/index.html (inline script)`, code: inlineCode });
    }
  }

  // Verify ZERO external URLs (http://, https://, or protocol-relative // in HTML/CSS attributes) and ZERO <script type="module"
  if (/<script[^>]*\btype\s*=\s*['"]?module['"]?/i.test(combinedSource)) {
    fail(`${slug}: Contains forbidden <script type="module" tag.`);
  }
  const sourceWithoutSvgXmlns = combinedSource.replace(/https?:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink)/gi, '');
  if (/https?:\/\//i.test(sourceWithoutSvgXmlns)) {
    fail(`${slug}: Contains forbidden external URL (http:// or https://).`);
  }
  if (/(?:src|href|action)\s*=\s*['"]\/\/|url\(\s*['"]?\/\//i.test(sourceWithoutSvgXmlns)) {
    fail(`${slug}: Contains forbidden protocol-relative external URL (//).`);
  }

  // Compile all scripts with new vm.Script(code) to guarantee zero JS syntax errors
  if (scriptsToCompile.length === 0) {
    fail(`${slug}: Contains no executable <script> blocks.`);
  }
  for (const s of scriptsToCompile) {
    try {
      new vm.Script(s.code, { filename: s.name });
    } catch (err) {
      fail(`${slug}: JavaScript syntax error in ${s.name}: ${err.message}`);
    }
  }

  // Assert required subsystem markers
  const hasAudio = combinedSource.includes('AudioContext') || combinedSource.includes('webkitAudioContext');
  if (!hasAudio) {
    fail(`${slug}: Missing required subsystem marker: AudioContext (or webkitAudioContext).`);
  }
  if (!combinedSource.includes('ResizeObserver')) {
    fail(`${slug}: Missing required subsystem marker: ResizeObserver.`);
  }
  if (!combinedSource.includes('requestAnimationFrame')) {
    fail(`${slug}: Missing required subsystem marker: requestAnimationFrame.`);
  }
  if (!combinedSource.includes('localStorage')) {
    fail(`${slug}: Missing required subsystem marker: localStorage.`);
  }
  const hasTouch = combinedSource.includes('touchstart') || combinedSource.includes('pointerdown');
  if (!hasTouch) {
    fail(`${slug}: Missing required subsystem marker: touchstart or pointerdown.`);
  }
  if (!combinedSource.includes('PAUSED')) {
    fail(`${slug}: Missing required subsystem marker: PAUSED.`);
  }
}

console.log('ALL ARCADE VERIFICATION CHECKS PASSED');
process.exit(0);
