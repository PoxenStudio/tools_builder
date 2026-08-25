'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const AdmZip = require('adm-zip');

const { validateProjectDir, ManifestError } = require('./manifest');

function loadToolbuilderConfig(dir) {
  const configPath = path.join(dir, '.toolbuilder.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.warn(`⚠ .toolbuilder.json 不是合法 JSON，忽略：${err.message}`);
    return {};
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

const EXCLUDE_RE = /(^|\/)(__pycache__\/|\.pyc$|\.DS_Store$)/;

/**
 * `mytool build [dir]` 的实现：
 *   1) 校验 manifest.json（复用 validate 的同一套逻辑，见 4.2.1 节）
 *   2) 前端构建 —— frontend/ 已经是静态文件就直接用；.toolbuilder.json 声明了
 *      frontendBuildCommand 就先跑这个命令，再从 frontendOutputDir 取产物，脚手架本身不
 *      强制任何打包器
 *   3) 按 3.1 节结构组装 dist/<tool_id>-<revision>.zip，打印 sha256
 */
async function runBuild(dir) {
  const projectDir = path.resolve(dir);

  let manifest;
  try {
    ({ manifest } = validateProjectDir(projectDir));
  } catch (err) {
    if (err instanceof ManifestError) {
      console.error('✗ 打包前校验失败：');
      for (const line of err.message.split('\n')) console.error(`  - ${line}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const config = loadToolbuilderConfig(projectDir);
  let frontendSrcDir = path.join(projectDir, 'frontend');

  if (config.frontendBuildCommand) {
    console.log(`→ 执行前端构建命令：${config.frontendBuildCommand}`);
    execSync(config.frontendBuildCommand, { cwd: projectDir, stdio: 'inherit' });

    if (!config.frontendOutputDir) {
      console.error('✗ .toolbuilder.json 声明了 frontendBuildCommand 但没有声明 frontendOutputDir');
      process.exitCode = 1;
      return;
    }
    frontendSrcDir = path.resolve(projectDir, config.frontendOutputDir);
    if (!fs.existsSync(frontendSrcDir)) {
      console.error(`✗ frontendOutputDir 不存在：${frontendSrcDir}`);
      process.exitCode = 1;
      return;
    }
  }

  const zip = new AdmZip();
  zip.addLocalFile(path.join(projectDir, 'manifest.json'));

  const iconPath = path.join(projectDir, 'icon.png');
  if (fs.existsSync(iconPath)) {
    zip.addLocalFile(iconPath);
  }

  const backendDir = path.join(projectDir, 'backend');
  if (fs.existsSync(backendDir)) {
    zip.addLocalFolder(backendDir, 'backend', (zipEntryPath) => !EXCLUDE_RE.test(zipEntryPath));
  } else {
    console.error(`✗ 找不到 backend/ 目录：${backendDir}`);
    process.exitCode = 1;
    return;
  }

  if (fs.existsSync(frontendSrcDir)) {
    zip.addLocalFolder(frontendSrcDir, 'frontend', (zipEntryPath) => !EXCLUDE_RE.test(zipEntryPath));
  }

  const distDir = path.join(projectDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const zipName = `${manifest.tool_id}-${manifest.revision}.zip`;
  const zipPath = path.join(distDir, zipName);
  zip.writeZip(zipPath);

  const sha256 = sha256File(zipPath);
  console.log(`✔ 已打包：${path.relative(process.cwd(), zipPath) || zipPath}`);
  console.log(`  sha256: ${sha256}`);
  console.log('  （提交给 mybooks.top 商店登记，或走开发者模式本地上传时会用到这个包，见 3.4/3.5 节）');

  return { zipPath, sha256, manifest };
}

module.exports = { runBuild };
