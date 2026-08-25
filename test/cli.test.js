'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const AdmZip = require('adm-zip');

const { runInit } = require('../src/init');
const { runBuild } = require('../src/build');
const { runValidate } = require('../src/validate');
const { runBump, bumpVersion } = require('../src/bump');
const { validateManifestObject, ManifestError } = require('../src/manifest');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// captures console.log/warn/error output during fn(), restores afterwards
function captureConsole(fn) {
  const logs = { log: [], warn: [], error: [] };
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...args) => logs.log.push(args.join(' '));
  console.warn = (...args) => logs.warn.push(args.join(' '));
  console.error = (...args) => logs.error.push(args.join(' '));
  return Promise.resolve(fn())
    .then((result) => ({ result, logs }))
    .finally(() => Object.assign(console, orig));
}

test('validateManifestObject: rejects missing required fields', () => {
  assert.throws(() => validateManifestObject({ tool_id: 'x' }), ManifestError);
});

test('validateManifestObject: rejects bad tool_id / semver / entry_backend', () => {
  const base = {
    tool_id: 'Bad-Id',
    name: 'n',
    description: 'd',
    revision: '1.0',
    author: 'a',
    core_api_version: '1.0.0',
    entry_backend: 'NoDot',
    repo_url: 'https://example.com',
  };
  assert.throws(() => validateManifestObject(base), (err) => {
    assert.match(err.message, /tool_id 格式不合法/);
    assert.match(err.message, /revision 不是合法的语义化版本号/);
    assert.match(err.message, /entry_backend 格式应为/);
    return true;
  });
});

test('validateManifestObject: accepts a well-formed manifest, warns on missing optional fields', () => {
  const manifest = {
    tool_id: 'demo_tool',
    name: 'Demo',
    description: 'd',
    revision: '1.0.0',
    author: 'a',
    core_api_version: '1.0.0',
    entry_backend: 'tool.DemoTool',
    repo_url: 'https://example.com/demo',
  };
  const warnings = validateManifestObject(manifest);
  assert.ok(warnings.some((w) => w.includes('entry_frontend')));
  assert.ok(warnings.some((w) => w.includes('page')));
});

test('bumpVersion: major/minor/patch', () => {
  assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
});

test('init -> validate -> build -> validate(zip) end to end', async () => {
  const workDir = tmpDir('mytool-test-');
  const outDir = path.join(workDir, 'demo_tool');

  await captureConsole(() =>
    runInit('demo_tool', {
      name: 'Demo Tool',
      author: 'Tester',
      description: 'a demo',
      repoUrl: 'https://example.com/demo_tool',
      outdir: outDir,
    })
  );

  assert.ok(fs.existsSync(path.join(outDir, 'manifest.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'backend', 'tool.py')));
  assert.ok(fs.existsSync(path.join(outDir, 'frontend', 'index.html')));

  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf-8'));
  assert.equal(manifest.tool_id, 'demo_tool');
  assert.equal(manifest.entry_backend, 'tool.DemoTool');
  assert.equal(manifest.repo_url, 'https://example.com/demo_tool');
  assert.deepEqual(manifest.locales, ['en', 'zh']);
  assert.equal(manifest.default_locale, 'en');

  const localesManifest = JSON.parse(
    fs.readFileSync(path.join(outDir, 'frontend', 'locales', 'manifest.json'), 'utf-8')
  );
  assert.deepEqual(localesManifest, { default: 'en', locales: ['en', 'zh'] });

  const toolSrc = fs.readFileSync(path.join(outDir, 'backend', 'tool.py'), 'utf-8');
  assert.match(toolSrc, /class DemoTool\(BaseTool\):/);
  assert.match(toolSrc, /class RunHandler\(BaseHandler\):/);
  assert.doesNotMatch(toolSrc, /{{/); // 没有残留的未替换占位符

  const { logs: validateLogs } = await captureConsole(() => runValidate(outDir));
  assert.ok(validateLogs.log.some((l) => l.includes('校验通过')));

  const { result: buildResult } = await captureConsole(() => runBuild(outDir));
  assert.ok(fs.existsSync(buildResult.zipPath));
  assert.match(buildResult.sha256, /^[0-9a-f]{64}$/);

  const zip = new AdmZip(buildResult.zipPath);
  const names = zip.getEntries().map((e) => e.entryName).sort();
  assert.deepEqual(names, [
    'backend/__init__.py',
    'backend/tool.py',
    'frontend/index.html',
    'frontend/lib/',
    'frontend/lib/i18n.js',
    'frontend/locales/',
    'frontend/locales/en.json',
    'frontend/locales/manifest.json',
    'frontend/locales/zh.json',
    'manifest.json',
  ]);

  const { logs: zipValidateLogs } = await captureConsole(() => runValidate(buildResult.zipPath));
  assert.ok(zipValidateLogs.log.some((l) => l.includes('校验通过')));

  fs.rmSync(workDir, { recursive: true, force: true });
});

test('build fails fast when manifest is invalid', async () => {
  const workDir = tmpDir('mytool-test-badmanifest-');
  fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify({ tool_id: 'x' }));
  fs.mkdirSync(path.join(workDir, 'backend'));

  const { result } = await captureConsole(() => runBuild(workDir));
  assert.equal(result, undefined);
  assert.equal(process.exitCode, 1);
  process.exitCode = 0; // 恢复，避免影响后续测试/进程退出码

  fs.rmSync(workDir, { recursive: true, force: true });
});

test('bump updates manifest.json revision in place', async () => {
  const workDir = tmpDir('mytool-test-bump-');
  const manifestPath = path.join(workDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ tool_id: 'x', revision: '0.1.0' }));

  await captureConsole(() => runBump('minor', workDir));

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.equal(manifest.revision, '0.2.0');

  fs.rmSync(workDir, { recursive: true, force: true });
});
