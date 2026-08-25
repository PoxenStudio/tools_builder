'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const AdmZip = require('adm-zip');

const { validateProjectDir, ManifestError } = require('./manifest');

/**
 * `mytool validate <path>` 的实现。path 可以是一个插件项目目录，也可以是已经打包好
 * 的 zip（`mytool build` 的产物，或手工打的包），两种情况走同一套校验逻辑（4.2.1 节：
 * "单独跑第 1 步的校验逻辑，可以对着一个目录或已有 zip 跑，用于 CI 或提交前自查，不做实际
 * 打包"）。
 */
async function runValidate(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    console.error(`✗ 路径不存在：${resolved}`);
    process.exitCode = 1;
    return;
  }

  const isZip = fs.statSync(resolved).isFile() && resolved.toLowerCase().endsWith('.zip');
  let dirToCheck = resolved;
  let tmpDir = null;

  if (isZip) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mytool-validate-'));
    try {
      new AdmZip(resolved).extractAllTo(tmpDir, true);
    } catch (err) {
      console.error(`✗ 不是合法的 zip 文件：${err.message}`);
      process.exitCode = 1;
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return;
    }
    dirToCheck = tmpDir;
  }

  try {
    const { manifest, warnings } = validateProjectDir(dirToCheck);
    console.log(`✔ ${manifest.tool_id}@${manifest.revision} 校验通过`);
    for (const w of warnings) {
      console.warn(`⚠ ${w}`);
    }
  } catch (err) {
    if (err instanceof ManifestError) {
      console.error('✗ 校验失败：');
      for (const line of err.message.split('\n')) {
        console.error(`  - ${line}`);
      }
      process.exitCode = 1;
    } else {
      throw err;
    }
  } finally {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

module.exports = { runValidate };
