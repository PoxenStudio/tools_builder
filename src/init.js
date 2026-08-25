'use strict';

const fs = require('fs');
const path = require('path');

const { ask } = require('./prompt');
const { TOOL_ID_RE } = require('./manifest');
const { CORE_API_VERSION } = require('./core-api-version');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'default');

// 需要做占位符替换的文本文件；二进制资源（未来如果模板里加图标之类）不进这个列表
const TEMPLATE_TEXT_FILES = [
  'manifest.json',
  'README.md',
  'backend/tool.py',
  'frontend/index.html',
];

function toClassName(toolId) {
  return toolId
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function copyTemplateDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTemplateDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function applyReplacements(dir, replacements) {
  for (const relPath of TEMPLATE_TEXT_FILES) {
    const filePath = path.join(dir, relPath);
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, 'utf-8');
    for (const [token, value] of Object.entries(replacements)) {
      content = content.split(`{{${token}}}`).join(value);
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

/**
 * `mytool init <tool_id>` 的实现。交互式补全缺失字段（非 TTY 环境下用默认值，不会
 * 挂起），从 templates/default 拷贝一份骨架并替换占位符。
 */
async function runInit(toolId, options) {
  if (!TOOL_ID_RE.test(toolId)) {
    console.error(`✗ tool_id "${toolId}" 不合法：只能包含小写字母、数字、下划线`);
    process.exitCode = 1;
    return;
  }

  const outDir = path.resolve(options.outdir || toolId);
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) {
    console.error(`✗ 目标目录已存在且非空：${outDir}`);
    process.exitCode = 1;
    return;
  }

  const name = options.name || (await ask('工具展示名称', toolId));
  const author = options.author || (await ask('作者', ''));
  const description = options.description || (await ask('工具描述', ''));
  const repoUrl = options.repoUrl || (await ask('源码仓库地址（repo_url，必填，商店审核用）', ''));

  copyTemplateDir(TEMPLATE_DIR, outDir);
  applyReplacements(outDir, {
    TOOL_ID: toolId,
    NAME: name,
    AUTHOR: author,
    DESCRIPTION: description,
    REPO_URL: repoUrl,
    CLASS_NAME: toClassName(toolId) || 'MyTool',
    CORE_API_VERSION,
    PUBLISH_DATE: new Date().toISOString().slice(0, 10),
  });

  if (!repoUrl) {
    console.warn('⚠ 没有填 repo_url —— manifest.json 里这项是必填字段，build/validate 会报错，记得补上');
  }

  console.log(`✔ 已生成工具骨架：${outDir}`);
  console.log('  下一步：');
  console.log(`    cd ${path.relative(process.cwd(), outDir) || '.'}`);
  console.log('    mytool validate .');
  console.log('    mytool build');
}

module.exports = { runInit, toClassName };
