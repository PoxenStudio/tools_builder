'use strict';

const fs = require('fs');
const path = require('path');

const MANIFEST_FILENAME = 'manifest.json';

// 必须和 mybooks/mybooks 仓库 webserver/toolbox/toolbox_manager.py 里的
// REQUIRED_MANIFEST_FIELDS 保持一致（见 document/Toolbox_Dynamic_Design.md 3.2 节）。
const REQUIRED_FIELDS = [
  'tool_id',
  'name',
  'description',
  'revision',
  'author',
  'core_api_version',
  'entry_backend',
  'repo_url',
];

const TOOL_ID_RE = /^[a-z0-9_]+$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

class ManifestError extends Error {}

/**
 * 校验一个已经解析成对象的 manifest.json，规则与后端 toolbox_manager.validate_manifest()
 * 保持同步。校验失败抛 ManifestError，message 里汇总所有问题（而不是抛第一个就停）。
 *
 * @param {object} manifest
 * @returns {string[]} 警告列表（非致命，例如缺少可选但推荐的字段）
 */
function validateManifestObject(manifest) {
  const errors = [];
  const warnings = [];

  const missing = REQUIRED_FIELDS.filter((f) => !manifest[f]);
  if (missing.length > 0) {
    errors.push(`缺少必填字段：${missing.join('、')}`);
  }

  if (manifest.tool_id && !TOOL_ID_RE.test(manifest.tool_id)) {
    errors.push('tool_id 格式不合法：只允许小写字母、数字、下划线');
  }

  for (const field of ['revision', 'core_api_version']) {
    if (manifest[field] && !SEMVER_RE.test(manifest[field])) {
      errors.push(`${field} 不是合法的语义化版本号（x.y.z），当前值：${manifest[field]}`);
    }
  }

  if (manifest.entry_backend && !manifest.entry_backend.includes('.')) {
    errors.push('entry_backend 格式应为 <module>.<ClassName>，例如 tool.MyTool');
  }

  if (manifest.repo_url) {
    try {
      // eslint-disable-next-line no-new
      new URL(manifest.repo_url);
    } catch {
      errors.push(`repo_url 不是合法的 URL：${manifest.repo_url}`);
    }
  }

  if (manifest.api_routes) {
    if (!Array.isArray(manifest.api_routes)) {
      errors.push('api_routes 必须是数组');
    } else {
      manifest.api_routes.forEach((entry, i) => {
        if (!entry || !entry.path || !entry.handler) {
          errors.push(`api_routes[${i}] 必须同时包含 path 和 handler`);
        }
      });
    }
  }

  if (!manifest.entry_frontend) {
    warnings.push('未声明 entry_frontend，工具将没有前端页面（iframe 会加载失败）');
  }
  if (!manifest.page) {
    warnings.push('未声明 page，默认会用 tool_id 作为落地页路径');
  }

  if (errors.length > 0) {
    throw new ManifestError(errors.join('\n'));
  }
  return warnings;
}

/**
 * 校验一个工具项目目录：manifest.json 存在且合法、entry_backend 指向的模块文件存在、
 * entry_frontend（如果声明了）指向的文件存在。对应后端 install_from_zip() 里的同一套检查
 * （3.1/3.2 节），提前在打包前就发现问题。
 *
 * @param {string} dir 项目根目录（内含 manifest.json / backend/ / frontend/）
 * @returns {{manifest: object, warnings: string[]}}
 */
function validateProjectDir(dir) {
  const manifestPath = path.join(dir, MANIFEST_FILENAME);
  if (!fs.existsSync(manifestPath)) {
    throw new ManifestError(`${dir} 下找不到 manifest.json`);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    throw new ManifestError(`manifest.json 不是合法的 JSON：${err.message}`);
  }

  const warnings = validateManifestObject(manifest);

  if (manifest.entry_backend && manifest.entry_backend.includes('.')) {
    // entry_backend 形如 "tool.MyTool"，去掉最后一段 ClassName，剩下的按 "." 拆成
    // backend/ 下的相对路径（与后端 toolbox_manager._module_file_for() 同一套规则）
    const moduleParts = manifest.entry_backend.split('.').slice(0, -1);
    const moduleFile = path.join(dir, 'backend', ...moduleParts) + '.py';
    if (!fs.existsSync(moduleFile)) {
      throw new ManifestError(`找不到 entry_backend 指向的模块文件：backend/${moduleParts.join('/')}.py`);
    }
  }

  if (manifest.entry_frontend) {
    const frontendPath = path.join(dir, 'frontend', manifest.entry_frontend);
    if (!fs.existsSync(frontendPath)) {
      throw new ManifestError(`找不到 entry_frontend 指向的文件：frontend/${manifest.entry_frontend}`);
    }
  }

  return { manifest, warnings };
}

module.exports = {
  MANIFEST_FILENAME,
  REQUIRED_FIELDS,
  TOOL_ID_RE,
  SEMVER_RE,
  ManifestError,
  validateManifestObject,
  validateProjectDir,
};
