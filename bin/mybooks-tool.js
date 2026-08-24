#!/usr/bin/env node
'use strict';

const { Command } = require('commander');

const pkg = require('../package.json');
const { runInit } = require('../src/init');
const { runBuild } = require('../src/build');
const { runValidate } = require('../src/validate');
const { runBump } = require('../src/bump');

const program = new Command();

program
  .name('mybooks-tool')
  .description('MyBooks Toolbox 外部插件脚手架 / 构建 / 校验 CLI\n\n设计文档: mybooks/mybooks 仓库 document/Toolbox_Dynamic_Design.md 第 4.2.1 节')
  .version(pkg.version);

program
  .command('init <tool_id>')
  .description('生成一个新的插件项目骨架')
  .option('-n, --name <name>', '工具展示名称')
  .option('-a, --author <author>', '作者')
  .option('-d, --description <description>', '工具描述')
  .option('-r, --repo-url <url>', '源码仓库地址（repo_url，必填，商店审核用）')
  .option('-o, --outdir <dir>', '生成到哪个目录，默认为当前目录下的 <tool_id>')
  .action(async (toolId, options) => {
    await runInit(toolId, options);
  });

program
  .command('build [dir]')
  .description('校验并打包成 dist/<tool_id>-<revision>.zip')
  .action(async (dir) => {
    await runBuild(dir || '.');
  });

program
  .command('validate <path>')
  .description('只做校验，不打包；path 可以是项目目录，也可以是已有的 zip 包')
  .action(async (targetPath) => {
    await runValidate(targetPath);
  });

program
  .command('bump <part> [dir]')
  .description('按 semver 规则升级 manifest.json 里的 revision（major|minor|patch）')
  .action(async (part, dir) => {
    await runBump(part, dir || '.');
  });

program.parseAsync(process.argv);
