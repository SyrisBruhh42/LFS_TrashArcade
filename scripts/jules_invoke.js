#!/usr/bin/env node
'use strict';

/**
 * Antifragile Google Jules Session Dispatcher (./scripts/jules_invoke.js)
 * Eliminates the two fatal bugs in upstream google-labs-code/jules-action@v1.0.0:
 *   1. Upstream `if: ${{ inputs.include_last_commit }}` treats string "false" as truthy,
 *      unconditionally dumping `git show` into the prompt.
 *   2. Upstream `jq --arg jules_prompt "$(cat prompt.txt)"` crashes with exit code 126
 *      (`/usr/bin/jq: Argument list too long`) whenever `git show` + prompt exceeds
 *      Linux MAX_ARG_STRLEN (128 KB).
 *
 * This dispatcher reads `.github/JULES_PROMPT.md` directly in memory, sends a clean
 * JSON payload to `POST https://jules.googleapis.com/v1alpha/sessions` with:
 *   - requirePlanApproval: false ("Start" immediately)
 *   - automationMode: "AUTO_CREATE_PR" (automatically open PR on completion)
 * and verifies HTTP 200 creation with exponential backoff retry.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROMPT_PATH = path.join(ROOT, '.github', 'JULES_PROMPT.md');
const API_KEY = (process.env.JULES_API_KEY || '').trim();
const REPO_FULL_NAME = (process.env.GITHUB_REPOSITORY || 'SyrisBruhh42/LFS_TrashArcade').trim();
const STARTING_BRANCH = (process.env.STARTING_BRANCH || 'main').trim();

function postSession(payloadObj) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payloadObj);
    const req = https.request(
      {
        hostname: 'jules.googleapis.com',
        port: 443,
        path: '/v1alpha/sessions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {}, raw: data });
          } catch (e) {
            resolve({ status: res.statusCode, body: {}, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  if (!API_KEY) {
    console.error('[JULES-INVOKE] Missing JULES_API_KEY.');
    process.exit(1);
  }
  if (!fs.existsSync(PROMPT_PATH)) {
    console.error(`[JULES-INVOKE] Prompt file not found at ${PROMPT_PATH}`);
    process.exit(1);
  }

  const promptText = fs.readFileSync(PROMPT_PATH, 'utf8').trim();
  const payload = {
    prompt: promptText,
    sourceContext: {
      source: `sources/github/${REPO_FULL_NAME}`,
      githubRepoContext: {
        startingBranch: STARTING_BRANCH
      }
    },
    requirePlanApproval: false,
    automationMode: 'AUTO_CREATE_PR'
  };

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `[JULES-INVOKE] Dispatching single-instance session to sources/github/${REPO_FULL_NAME}@${STARTING_BRANCH} (attempt ${attempt}/${maxAttempts})...`
    );
    const res = await postSession(payload);
    if (res.status >= 200 && res.status < 300 && res.body && res.body.name) {
      console.log(`[JULES-INVOKE] Session created successfully!`);
      console.log(`  Name : ${res.body.name}`);
      console.log(`  ID   : ${res.body.id}`);
      console.log(`  URL  : ${res.body.url || 'https://jules.google.com/session/' + res.body.id}`);
      if (process.env.GITHUB_STEP_SUMMARY) {
        const summary = [
          `### 🎮 Launched Autonomous Jules Arcade Session`,
          `- **Session**: \`${res.body.name}\``,
          `- **Repository**: \`${REPO_FULL_NAME}\` (\`${STARTING_BRANCH}\`)`,
          `- **Settings**: \`requirePlanApproval: false\` (Auto-Start), \`automationMode: AUTO_CREATE_PR\` (Auto-PR + Crucible Auto-Merge)`,
          res.body.url ? `- **Live Session Link**: [Open in Jules](${res.body.url})` : ''
        ]
          .filter(Boolean)
          .join('\n');
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n', 'utf8');
      }
      return;
    }

    console.error(`[JULES-INVOKE] HTTP ${res.status}: ${res.raw}`);
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, attempt * 4000));
    } else {
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('[JULES-INVOKE] Fatal error:', err);
  process.exit(1);
});
