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
  'frontend/locales/manifest.json',
];

const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
// 脚手架内置的示例文案，覆盖到的语言 init 时直接用；未覆盖到的语言以英文文案为起点生成一份
// 同结构的 stub，交给作者自己翻译（见 document/Toolbox_Dynamic_Design.md 4.6 节）。
const BUILTIN_LOCALES = ['en', 'zh'];

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

/**
 * 解析 `--locales en,zh,ja` / 交互输入，去重、校验格式、保证非空（兜底 ['en']）。
 * 第一个语言会作为 frontend/locales/manifest.json 里的 default（见 4.6 节）。
 */
function parseLocales(input) {
  const raw = String(input || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const locales = [];
  for (const code of raw) {
    if (!LOCALE_RE.test(code)) {
      console.warn(`⚠ 忽略不合法的语言代码 "${code}"（应形如 en / zh-CN）`);
      continue;
    }
    if (!locales.includes(code)) locales.push(code);
  }
  return locales.length > 0 ? locales : ['en'];
}

/**
 * 让 frontend/locales/ 下实际存在的 <code>.json 文件与 `locales` 列表一致：
 * - 脚手架内置了 en/zh 两份示例文案，请求到就直接保留（已经被 copyTemplateDir 拷贝过来）
 * - 请求了但没有内置文案的语言，以英文文案（或任意已有文案）为起点生成一份同结构的 stub，
 *   交给作者自己翻译
 * - 没有被请求到的内置语言文件（例如只要 en，不要 zh）从产物里删掉，避免留下不会被
 *   locales/manifest.json 引用的孤儿文件
 */
function syncLocaleCatalogs(outDir, locales) {
  const localesDir = path.join(outDir, 'frontend', 'locales');
  const baseCatalogPath = path.join(localesDir, 'en.json');
  const baseCatalog = fs.existsSync(baseCatalogPath) ? fs.readFileSync(baseCatalogPath, 'utf-8') : '{}';

  for (const code of BUILTIN_LOCALES) {
    if (locales.includes(code)) continue;
    const filePath = path.join(localesDir, `${code}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  for (const code of locales) {
    const filePath = path.join(localesDir, `${code}.json`);
    if (fs.existsSync(filePath)) continue; // 内置文案，已由 copyTemplateDir 拷贝
    fs.writeFileSync(filePath, baseCatalog, 'utf-8');
    console.log(`  （"${code}" 没有内置示例文案，已用英文文案生成 frontend/locales/${code}.json，请自行翻译）`);
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
  const localesInput = options.locales || (await ask('支持哪些语言（逗号分隔，如 en,zh）', 'en,zh'));
  const locales = parseLocales(localesInput);

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
    I18N_DEFAULT_LOCALE: locales[0],
    I18N_LOCALES_JSON: JSON.stringify(locales),
  });
  syncLocaleCatalogs(outDir, locales);

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
