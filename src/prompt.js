'use strict';

const readline = require('readline');

/**
 * 极简的交互式命令行提问，只用 Node 内置的 readline，不引入额外依赖。
 * 非 TTY 环境（CI、脚本调用）下直接返回默认值，不会挂起等待输入。
 *
 * @param {string} question
 * @param {string} [defaultValue]
 * @returns {Promise<string>}
 */
function ask(question, defaultValue = '') {
  if (!process.stdin.isTTY) {
    return Promise.resolve(defaultValue);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      resolve((answer || '').trim() || defaultValue);
    });
  });
}

module.exports = { ask };
