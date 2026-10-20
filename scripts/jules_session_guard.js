#!/usr/bin/env node
'use strict';

/**
 * Antifragile Single-Instance Session Guard & Auto-Unblocker for LFS_TrashArcade
 * - Queries https://jules.googleapis.com/v1alpha/sessions for SyrisBruhh42/LFS_TrashArcade
 * - Auto-approves any session stuck in AWAITING_PLAN_APPROVAL
 * - Auto-replies to any session stuck in AWAITING_USER_FEEDBACK
 * - Enforces single-instance execution: if a session on LFS_TrashArcade is currently active
 *   (QUEUED, PLANNING, IN_PROGRESS) and updated within the last 25 minutes, or created within
 *   the last 12 minutes, sets should_dispatch=false (unless FORCE_DISPATCH=true).
 */

const fs = require('fs');
const https = require('https');

const REPO_SOURCE = 'sources/github/SyrisBruhh42/LFS_TrashArcade';
const API_KEY = (process.env.JULES_API_KEY || '').trim();
const FORCE_DISPATCH = (process.env.FORCE_DISPATCH || 'false').toLowerCase() === 'true';

function setOutput(key, val) {
  console.log(`[SESSION-GUARD] ${key}=${val}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${val}\n`, 'utf8');
  }
}

function requestJson(method, pathUrl, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = https.request(
      {
        hostname: 'jules.googleapis.com',
        port: 443,
        path: pathUrl,
        method,
        headers: {
          'X-Goog-Api-Key': API_KEY,
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
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
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  if (!API_KEY) {
    console.error('[SESSION-GUARD] Missing JULES_API_KEY.');
    setOutput('should_dispatch', 'false');
    process.exit(1);
  }

  const res = await requestJson('GET', '/v1alpha/sessions?pageSize=30');
  if (res.status !== 200 || !Array.isArray(res.body.sessions)) {
    console.warn(`[SESSION-GUARD] Could not list sessions (HTTP ${res.status}); proceeding with dispatch.`);
    setOutput('should_dispatch', 'true');
    return;
  }

  const nowMs = Date.now();
  const repoSessions = res.body.sessions.filter(
    s => s.sourceContext && s.sourceContext.source === REPO_SOURCE
  );

  console.log(`[SESSION-GUARD] Found ${repoSessions.length} recent session(s) for ${REPO_SOURCE}.`);

  let activeInFlight = null;

  for (const s of repoSessions) {
    const state = s.state || 'STATE_UNSPECIFIED';
    const updatedMs = s.updateTime ? Date.parse(s.updateTime) : nowMs;
    const createdMs = s.createTime ? Date.parse(s.createTime) : nowMs;
    const ageSinceUpdateMin = (nowMs - updatedMs) / 60000;
    const ageSinceCreateMin = (nowMs - createdMs) / 60000;

    if (state === 'AWAITING_PLAN_APPROVAL') {
      console.log(`[SESSION-GUARD] Auto-approving plan for ${s.name}...`);
      await requestJson('POST', `/v1alpha/${s.name}:approvePlan`, {});
      if (ageSinceUpdateMin < 25) activeInFlight = s;
    } else if (state === 'AWAITING_USER_FEEDBACK') {
      console.log(`[SESSION-GUARD] Auto-replying to unblock ${s.name}...`);
      await requestJson('POST', `/v1alpha/${s.name}:sendMessage`, {
        prompt:
          'Proceed autonomously following all Phase 1-5 laws in .github/JULES_PROMPT.md, run node ./scripts/verify.js until ALL ARCADE VERIFICATION CHECKS PASSED, and submit the PR.'
      });
      if (ageSinceUpdateMin < 25) activeInFlight = s;
    } else if (['QUEUED', 'PLANNING', 'IN_PROGRESS'].includes(state)) {
      if (ageSinceUpdateMin < 25) {
        activeInFlight = s;
      }
    } else if (ageSinceCreateMin < 12 && state !== 'FAILED') {
      // Prevent duplicate bursts within a single 15-minute window
      activeInFlight = s;
    }
  }

  if (activeInFlight && !FORCE_DISPATCH) {
    console.log(
      `[SESSION-GUARD] Active single instance already running/recent: ${activeInFlight.name} (state=${activeInFlight.state}, createTime=${activeInFlight.createTime}). Skipping duplicate launch.`
    );
    setOutput('should_dispatch', 'false');
    return;
  }

  console.log('[SESSION-GUARD] No active in-flight session blocking; authorizing single-instance launch.');
  setOutput('should_dispatch', 'true');
}

main().catch(err => {
  console.error('[SESSION-GUARD] Error:', err);
  setOutput('should_dispatch', 'true');
});
