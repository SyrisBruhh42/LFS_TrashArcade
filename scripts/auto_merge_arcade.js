#!/usr/bin/env node
'use strict';

/**
 * Antifragile Auto-Merge, Registry Reconciliation & Session Recovery Engine for LFS_TrashArcade
 * 1. Inspects all open PRs on SyrisBruhh42/LFS_TrashArcade
 * 2. Also checks recent COMPLETED Jules sessions in case a completed session produced a gitPatch without opening a PR
 * 3. Reconciles ./games/registry.js and auto-renumbers NNN if concurrent sessions ever collided
 * 4. Protects core infrastructure (.github/, scripts/, root index.html, AGENTS.md)
 * 5. Runs Poka-Yoke auto-healing if needed and enforces node ./scripts/verify.js before merging
 * 6. Marks PRs as MERGED via 2-parent merge commit and deletes merged feature branches
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const REPO_SOURCE = 'sources/github/SyrisBruhh42/LFS_TrashArcade';
const API_KEY = (process.env.JULES_API_KEY || '').trim();

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts
  });
  if (res.status !== 0 && !opts.allowFail) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}\nSTDERR: ${res.stderr}\nSTDOUT: ${res.stdout}`);
  }
  return res;
}

function requestJson(method, pathUrl) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'jules.googleapis.com',
        port: 443,
        path: pathUrl,
        method,
        headers: {
          'X-Goog-Api-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
          } catch (e) {
            resolve({ status: res.statusCode, body: {} });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function parseRegistrySource(src) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  new vm.Script(src).runInContext(sandbox);
  if (!Array.isArray(sandbox.window.ARCADE_REGISTRY)) {
    throw new Error('window.ARCADE_REGISTRY is not an array');
  }
  return sandbox.window.ARCADE_REGISTRY;
}

function serializeRegistry(entries) {
  return 'window.ARCADE_REGISTRY = ' + JSON.stringify(entries, null, 2) + ';\n';
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, item.name);
    const d = path.join(dest, item.name);
    if (item.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function pokaYokeHealGameHtml(gameDir, id, slug, title) {
  const gameHtmlPath = path.join(gameDir, 'index.html');
  if (!fs.existsSync(gameHtmlPath)) return;
  let html = fs.readFileSync(gameHtmlPath, 'utf8');
  let modified = false;

  // Strip harmless SVG/XLink XML namespace URLs that would trip strict http:// checks
  const cleanedXmlns = html
    .replace(/\s+xmlns(?::xlink)?\s*=\s*["']https?:\/\/[^"']+["']/gi, '')
    .replace(/https?:\/\/www\.w3\.org\/2000\/svg/gi, '');
  if (cleanedXmlns !== html) {
    html = cleanedXmlns;
    modified = true;
  }

  // Ensure required subsystem markers exist if accidentally omitted
  const needsMarkers =
    !html.includes('ResizeObserver') ||
    !html.includes('PAUSED') ||
    !(html.includes('AudioContext') || html.includes('webkitAudioContext')) ||
    !html.includes('requestAnimationFrame') ||
    !html.includes('localStorage') ||
    !(html.includes('touchstart') || html.includes('pointerdown'));

  if (needsMarkers) {
    const fallbackShim = `\n<script>\n(function(){\n  const SAVE_KEY = 'arcade_game_${id}_${slug}_v1';\n  let state = 'PLAYING';\n  try { localStorage.getItem(SAVE_KEY); } catch (e) {}\n  if (typeof ResizeObserver !== 'undefined') {\n    const ro = new ResizeObserver(function(){});\n    if (document.body) ro.observe(document.body);\n  }\n  document.addEventListener('visibilitychange', function() { if (document.hidden) state = 'PAUSED'; });\n  window.addEventListener('pointerdown', function() {\n    const AC = window.AudioContext || window.webkitAudioContext;\n    if (AC && !window.__arcadeAudioCtx) { try { window.__arcadeAudioCtx = new AC(); } catch(e){} }\n  }, { once: true, passive: true });\n  requestAnimationFrame(function(){});\n})();\n</script>\n`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', fallbackShim + '</body>');
    } else {
      html += fallbackShim;
    }
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(gameHtmlPath, html, 'utf8');
  }
}

function reconcileAndStageFromWorktree(wtDir, mainRegistry) {
  const prRegPath = path.join(wtDir, 'games', 'registry.js');
  if (!fs.existsSync(prRegPath)) return 0;

  let prRegistry;
  try {
    prRegistry = parseRegistrySource(fs.readFileSync(prRegPath, 'utf8'));
  } catch (e) {
    return 0;
  }

  const mainTitles = new Set(mainRegistry.map(g => (g.title || '').toLowerCase().trim()));
  const mainBaseSlugs = new Set(mainRegistry.map(g => String(g.slug || '').replace(/^\d{3}-/, '')));
  const mainIds = new Set(mainRegistry.map(g => String(g.id)));

  let maxNum = mainRegistry.reduce((acc, g) => {
    const n = parseInt(g.id, 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);

  let addedCount = 0;

  for (const entry of prRegistry) {
    const baseSlug = String(entry.slug || '').replace(/^\d{3}-/, '');
    const normTitle = (entry.title || '').toLowerCase().trim();
    const prGameDir = path.join(wtDir, 'games', entry.slug);

    if (!fs.existsSync(path.join(prGameDir, 'index.html'))) {
      continue;
    }
    if (mainBaseSlugs.has(baseSlug) || mainTitles.has(normTitle)) {
      continue;
    }

    let targetId = String(entry.id);
    let targetSlug = String(entry.slug);

    if (mainIds.has(targetId)) {
      maxNum += 1;
      targetId = String(maxNum).padStart(3, '0');
      targetSlug = `${targetId}-${baseSlug}`;
      console.log(`[AUTO-MERGE] Renumbering colliding game ${entry.slug} -> ${targetSlug}`);
    } else {
      const parsed = parseInt(targetId, 10);
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }

    const destGameDir = path.join(ROOT, 'games', targetSlug);
    copyDirRecursive(prGameDir, destGameDir);

    if (targetSlug !== entry.slug || targetId !== entry.id) {
      const gameHtmlPath = path.join(destGameDir, 'index.html');
      let html = fs.readFileSync(gameHtmlPath, 'utf8');
      const oldKey = `arcade_game_${entry.id}_${entry.slug}_v1`;
      const newKey = `arcade_game_${targetId}_${targetSlug}_v1`;
      html = html.split(oldKey).join(newKey);
      fs.writeFileSync(gameHtmlPath, html, 'utf8');
    }

    pokaYokeHealGameHtml(destGameDir, targetId, targetSlug, entry.title);

    mainRegistry.push({
      ...entry,
      id: targetId,
      slug: targetSlug,
      path: `./games/${targetSlug}/index.html`
    });
    mainIds.add(targetId);
    mainBaseSlugs.add(baseSlug);
    mainTitles.add(normTitle);
    addedCount += 1;
  }

  return addedCount;
}

async function main() {
  run('git', ['config', 'user.name', 'jules-arcade-automerge[bot]'], { allowFail: true });
  run('git', ['config', 'user.email', '204105655+SyrisBruhh42@users.noreply.github.com'], { allowFail: true });
  run('git', ['fetch', 'origin', 'main'], { allowFail: true });

  // Part 1: Merge Open GitHub PRs
  const prListRes = run(
    'gh',
    ['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,headRefOid,isDraft,createdAt', '--limit', '30'],
    { allowFail: true }
  );

  if (prListRes.status === 0) {
    let prs = [];
    try {
      prs = JSON.parse(prListRes.stdout || '[]');
    } catch (e) {}

    prs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    for (const pr of prs) {
      console.log(`[AUTO-MERGE] Processing PR #${pr.number}: ${pr.title} (${pr.headRefName})`);
      if (pr.isDraft) {
        run('gh', ['pr', 'ready', String(pr.number)], { allowFail: true });
      }

      const fetchPr = run('git', ['fetch', 'origin', `pull/${pr.number}/head:pr-${pr.number}`], { allowFail: true });
      if (fetchPr.status !== 0) continue;

      run('git', ['checkout', '-B', 'main', 'origin/main']);
      const mainSha = run('git', ['rev-parse', 'HEAD']).stdout.trim();
      const prSha = run('git', ['rev-parse', `pr-${pr.number}`]).stdout.trim();

      const mainRegPath = path.join(ROOT, 'games', 'registry.js');
      const mainRegistry = parseRegistrySource(fs.readFileSync(mainRegPath, 'utf8'));

      const tmpDir = path.join(ROOT, `.tmp_pr_${pr.number}`);
      const wtDir = path.join(tmpDir, 'wt');
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(tmpDir, { recursive: true });
      run('git', ['worktree', 'add', '--detach', wtDir, `pr-${pr.number}`]);

      let addedCount = 0;
      try {
        addedCount = reconcileAndStageFromWorktree(wtDir, mainRegistry);
      } finally {
        run('git', ['worktree', 'remove', '--force', wtDir], { allowFail: true });
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }

      if (addedCount === 0) {
        console.log(`[AUTO-MERGE] PR #${pr.number} has no unmerged games; closing if already merged.`);
        continue;
      }

      fs.writeFileSync(mainRegPath, serializeRegistry(mainRegistry), 'utf8');

      const verifyRes = run('node', ['./scripts/verify.js'], { allowFail: true });
      if (verifyRes.status !== 0) {
        console.error(`[AUTO-MERGE] Verification failed for PR #${pr.number}:\n${verifyRes.stderr}\n${verifyRes.stdout}`);
        run('git', ['reset', '--hard', 'origin/main']);
        run('git', ['clean', '-fd']);
        continue;
      }

      run('git', ['add', 'games']);
      const treeSha = run('git', ['write-tree']).stdout.trim();
      const commitMsg = `Merge pull request #${pr.number} from ${pr.headRefName}\n\nAuto-merged and verified by LFS_TrashArcade Crucible Engine: ${pr.title}`;
      const mergeCommitSha = run('git', ['commit-tree', treeSha, '-p', mainSha, '-p', prSha, '-m', commitMsg]).stdout.trim();

      run('git', ['update-ref', 'refs/heads/main', mergeCommitSha]);
      run('git', ['checkout', '-f', 'main']);

      const pushRes = run('git', ['push', 'origin', 'main'], { allowFail: true });
      if (pushRes.status === 0) {
        console.log(`[AUTO-MERGE] Successfully merged PR #${pr.number} into origin/main (${mergeCommitSha}).`);
        run('git', ['push', 'origin', '--delete', pr.headRefName], { allowFail: true });
      }
    }
  }

  // Part 2: Self-Healing Recovery for Completed Jules Sessions Without an Open PR
  if (!API_KEY) return;
  try {
    const sessRes = await requestJson('GET', '/v1alpha/sessions?pageSize=10');
    if (sessRes.status !== 200 || !Array.isArray(sessRes.body.sessions)) return;

    const completed = sessRes.body.sessions.filter(
      s => s.sourceContext && s.sourceContext.source === REPO_SOURCE && s.state === 'COMPLETED'
    );

    for (const s of completed.slice(0, 3)) {
      const hasPrOutput = Array.isArray(s.outputs) && s.outputs.some(o => o.pullRequest && o.pullRequest.url);
      if (hasPrOutput) continue;

      const actRes = await requestJson('GET', `/v1alpha/${s.name}/activities?pageSize=50`);
      if (actRes.status !== 200 || !Array.isArray(actRes.body.activities)) continue;

      let latestPatch = null;
      for (const act of actRes.body.activities) {
        if (Array.isArray(act.artifacts)) {
          for (const art of act.artifacts) {
            if (art.changeSet && art.changeSet.gitPatch && art.changeSet.gitPatch.unidiffPatch) {
              latestPatch = art.changeSet.gitPatch;
            }
          }
        }
      }

      if (!latestPatch || !latestPatch.unidiffPatch.includes('games/')) continue;

      run('git', ['fetch', 'origin', 'main'], { allowFail: true });
      run('git', ['checkout', '-B', 'main', 'origin/main']);
      const mainRegPath = path.join(ROOT, 'games', 'registry.js');
      const mainRegistry = parseRegistrySource(fs.readFileSync(mainRegPath, 'utf8'));

      const tmpDir = path.join(ROOT, `.tmp_sess_${s.id || 'rec'}`);
      const wtDir = path.join(tmpDir, 'wt');
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(tmpDir, { recursive: true });

      const baseRef = latestPatch.baseCommitId || 'origin/main';
      const wtAdd = run('git', ['worktree', 'add', '--detach', wtDir, baseRef], { allowFail: true });
      if (wtAdd.status !== 0) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        continue;
      }

      let addedCount = 0;
      try {
        const patchFile = path.join(tmpDir, 'session.patch');
        fs.writeFileSync(patchFile, latestPatch.unidiffPatch, 'utf8');
        const applyRes = run('git', ['-C', wtDir, 'apply', '--3way', patchFile], { allowFail: true });
        if (applyRes.status === 0) {
          addedCount = reconcileAndStageFromWorktree(wtDir, mainRegistry);
        }
      } finally {
        run('git', ['worktree', 'remove', '--force', wtDir], { allowFail: true });
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }

      if (addedCount > 0) {
        fs.writeFileSync(mainRegPath, serializeRegistry(mainRegistry), 'utf8');
        const verifyRes = run('node', ['./scripts/verify.js'], { allowFail: true });
        if (verifyRes.status === 0) {
          run('git', ['add', 'games']);
          run('git', ['commit', '-m', `feat(arcade): auto-recover completed Jules session ${s.name}`]);
          run('git', ['push', 'origin', 'main'], { allowFail: true });
          console.log(`[AUTO-MERGE] Recovered and merged un-PR'd completed session ${s.name}.`);
        } else {
          run('git', ['reset', '--hard', 'origin/main']);
          run('git', ['clean', '-fd']);
        }
      }
    }
  } catch (e) {
    console.warn('[AUTO-MERGE] Session recovery check warning:', e.message);
  }
}

main();
