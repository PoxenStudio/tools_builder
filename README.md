# Tools Builder (`mytool`)

MyBooks Toolbox 外部工具的脚手架 / 构建 / 校验 CLI。

设计背景：MyBooks（`mybooks/mybooks` 仓库）的 Toolbox 支持以"外部工具"的形式动态安装工具，
不需要改动核心仓库代码就能新增功能。

工具作者也可以完全不用这个脚手架——只要产物符合"一个 `manifest.json` + `backend/` + `frontend/`"的约定即可（见下方"包结构"）。

📖 **完整 Core API / `toolbox-bridge.js` 参考文档**：
[poxenstudio.github.io/tools_builder](https://poxenstudio.github.io/tools_builder/)
（本仓库 `docs/index.html`，随 GitHub Pages 发布，内容如何与 `mybooks/mybooks` 保持同步见
`.claude/skills/sync-tool-api-docs/SKILL.md`）。

## 安装

```bash
npm install -g mybooks-tools-builder
# 或不装到全局，直接 npx 用：
npx mybooks-tools-builder --help
```

## 快速开始

```bash
mytool init tool_name \
  --name "我的工具" \
  --author "你的名字" \
  --description "工具做什么" \
  --repo-url "https://github.com/you/tool_name"

cd tool_name
# 改 backend/tool.py 和 frontend/index.html，写你的业务逻辑

mytool validate .      # 打包前先校验一遍
mytool build            # 产出 dist/tool_name-0.1.0.zip，打印 sha256
```

打包出来的 zip：

- 在一个开启了"开发者模式"（管理员在系统设置里打开 `ENABLE_TOOLBOX_DEV_MODE`）的 MyBooks
  实例的 `/admin/toolbox` 页面里上传安装（`POST /api/toolbox/install/upload`）；
- 或者发送邮件提交给MyBooks审核发布（注明代码仓库地址，以及 `build` 打印的 sha256）。

安装后需要**重启MyBooks**才会真正生效。之后管理员可以随时对它做禁用/启用（立即生效，不需要重启）或卸载。

## 命令

| 命令 | 作用 |
|---|---|
| `mytool init <tool_id>` | 生成一个新的工具项目骨架 |
| `mytool validate <path>` | 只做校验，不打包；`path` 可以是项目目录，也可以是已有的 zip |
| `mytool build [dir]` | 校验并打包成 `dist/<tool_id>-<revision>.zip`，打印 sha256 |
| `mytool bump <major\|minor\|patch> [dir]` | 按 semver 规则升级 `manifest.json` 里的 `revision` |

`init` 支持的选项：`--name` / `--author` / `--description` / `--repo-url` / `--outdir`；
不带这些选项时会在终端里交互式询问（非 TTY 环境下静默用空值/默认值，不会挂起）。

## 包结构

```
tool_name/
├── manifest.json         # 工具元数据，见下方字段说明
├── .toolbuilder.json      # 构建配置：前端如果用自己的打包工具，在这里声明命令和产物目录
├── icon.png                # 可选，工具图标
├── backend/
│   ├── __init__.py
│   └── tool.py             # manifest.entry_backend 指向的模块，继承 BaseTool
└── frontend/
    ├── index.html           # manifest.entry_frontend 指向的入口页面
    └── ...                  # 自包含的静态资源，作者自选任意前端技术栈
```

### manifest.json 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `tool_id` | 是 | 唯一标识，只能是小写字母/数字/下划线 |
| `name` / `description` | 是 | 展示名称与描述 |
| `revision` | 是 | 语义化版本号 `x.y.z` |
| `author` | 是 | 作者 |
| `repo_url` | 是 | 源码仓库地址，供商店审核时核对产物与公开源码是否一致 |
| `core_api_version` | 是 | 依赖的最低 Core API 版本 |
| `entry_backend` | 是 | `<module>.<ClassName>`，指向 `backend/` 下继承 `BaseTool` 的类 |
| `entry_frontend` | 否 | 前端入口文件（相对 `frontend/`），缺省则工具没有 UI |
| `page` | 否 | 落地页路径，缺省用 `tool_id` |
| `api_routes` | 否 | 自定义后端接口，`[{"path": "...", "handler": "<module>.<ClassName>"}]` |

### `.toolbuilder.json`

```json
{
  "frontendBuildCommand": null,
  "frontendOutputDir": null
}
```

`frontend/` 已经是纯静态文件（`init` 生成的默认模板就是）时两项都留空，`build` 直接打包
`frontend/` 目录。如果你的前端用了自己的构建工具（Vite / Webpack 等），把构建命令和产物目录
填进去，`build` 会先跑这个命令，再从 `frontendOutputDir` 取产物打包，脚手架本身不强制
任何打包器。

### backend/tool.py 能用到什么

`backend/tool.py` 里的类继承 `BaseTool`，运行时由 MyBooks 后端动态加载，可以通过
`self.api` 访问 Core API（完整设计见 `mybooks/mybooks` 仓库
`document/Toolbox_Dynamic_Design.md` 第二节）：

- `self.api.calibre` —— 书库读写：`search_books` / `get_metadata` / `set_metadata` /
  `import_file` / `merge_formats` / `add_format` / `delete_book` ...
- `self.api.db` —— 应用数据库：`get_item_by_book_id` / `create_item` /
  `delete_item_by_book_id` / `get_reader`
- `self.api.tasks` —— 后台任务：`create_task` / `update_progress` / `complete_task` /
  `make_progress_callback`
- `self.api.messages` —— 站内消息：`send_message` / `cleanup_messages`
- `self.api.storage` —— 工具专属数据目录 + 持久配置：`get_work_dir` / `cleanup_work_dir` /
  `get_config` / `set_config`

这份代码依赖真实的 MyBooks 运行环境（Calibre、SQLAlchemy session 等），无法脱离 MyBooks
单独跑，`mytool` 目前也不模拟这部分——实际验证逻辑要走开发者模式装进一个真实的
MyBooks 实例。

### frontend/index.html 能用到什么

工具前端是一份自包含的静态站点，由宿主 MyBooks 用 `<iframe>` 加载，不要求用 Vue、不要求
和宿主的前端框架版本一致。运行时通过 `<script src="/static/toolbox-bridge.js">` 获得
`window.MyBooksToolBridge`：

- `bridge.theme` / `bridge.locale` —— 当前宿主的主题（`"light"`/`"dark"`）与语言
- `bridge.fetch(path, options)` —— 请求 `/api/toolbox/tool/{tool_id}/{path}`，Cookie
  自动带上，不需要额外处理鉴权
- `bridge.notify(message, level)` —— 请求宿主用它自己的提示组件展示一条消息

## 明确不做的事（当前版本）

- **没有 `mytool dev`**：本地开发服务器 + mock 宿主环境（模拟 `toolbox-bridge.js`
  和一个假的 MyBooks 后端）暂时没做。`backend/tool.py` 的实际运行验证目前只能靠开发者模式
  装进一个真实的 MyBooks 实例；`frontend/index.html` 可以用任意静态文件服务器单独打开看
  页面结构，但 `bridge.fetch(...)` 这部分同样需要真实后端。
- **没有 `mytool publish`**：一键发布到 mybooks.top 商店的命令——商店侧的提交/审核
  API 还没有定义，等这部分确定后再补。

## 与 MyBooks 核心仓库的版本对齐

`package.json` 的版本号与内置的 `CORE_API_VERSION`（`src/core-api-version.js`）对齐
`mybooks/mybooks` 仓库 `webserver/toolbox/core_api.py` 里的同名常量。核心仓库升级
`CoreAPI`/`toolbox-bridge.js` 接口时，这个仓库需要同步发新版本。
