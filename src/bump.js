'use strict';

const fs = require('fs');
const path = require('path');

const { SEMVER_RE } = require('./manifest');

const PARTS = ['major', 'minor', 'patch'];

function bumpVersion(revision, part) {
  const [major, minor, patch] = revision.split('.').map(Number);
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * `mybooks-tool bump <major|minor|patch> [dir]`：按 semver 规则更新 manifest.json 里的
 * revision（4.2.1 节）。
 */
async function runBump(part, dir) {
  if (!PARTS.includes(part)) {
    console.error(`✗ 未知的 part："${part}"，只能是 major / minor / patch`);
    process.exitCode = 1;
    return;
  }

  const manifestPath = path.join(path.resolve(dir || '.'), 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`✗ 找不到 manifest.json：${manifestPath}`);
    process.exitCode = 1;
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (!SEMVER_RE.test(manifest.revision || '')) {
    console.error(`✗ manifest.json 里的 revision 不是合法的语义化版本号：${manifest.revision}`);
    process.exitCode = 1;
    return;
  }

  const oldRevision = manifest.revision;
  manifest.revision = bumpVersion(oldRevision, part);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  console.log(`✔ revision: ${oldRevision} → ${manifest.revision}`);
}

module.exports = { runBump, bumpVersion };
