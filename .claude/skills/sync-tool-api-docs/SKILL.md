---
name: sync-tool-api-docs
description: Regenerate docs/index.html (the Toolbox Core API / toolbox-bridge.js reference published to GitHub Pages) from the current source of truth in the mybooks/mybooks repo. Use when the user asks to sync/update/regenerate the tool API docs, or after webserver/toolbox/core_api.py, base_tool.py, toolbox-bridge.js, or the manifest.json field list changes in mybooks/mybooks.
---

# 同步 Toolbox Core API 文档

`docs/index.html` 是这个仓库对外发布在 GitHub Pages 上的一份**静态**参考文档，内容抄自
`mybooks/mybooks` 仓库里真正的实现，不是独立维护的第二份文档。它没有构建步骤——改完直接
`git commit` + push 到 `main`，`.github/workflows/deploy-docs.yml` 会自动把 `docs/` 发布出去
（前提是这个仓库的 GitHub 设置里 Pages 的 Source 选了 "GitHub Actions"，一次性设置，见本文件
末尾）。

## 什么时候要跑这个同步

- 用户明确要求"同步/更新/重新生成"工具 API 文档。
- 你在 `mybooks/mybooks` 仓库里改动了以下任意一个文件之后，顺手检查一下是否需要同步：
  - `webserver/toolbox/core_api.py` —— `CoreAPI` 各命名空间的方法（对应 `docs/index.html`
    的 `#core-api` 部分），以及顶部的 `CORE_API_VERSION` 常量。
  - `webserver/toolbox/base_tool.py` —— `TOOL_SERVICE_TYPE`、`service_item_name`、
    `info()` 这些工具作者要理解的约定。
  - `app/public/static/toolbox-bridge.js` —— `window.MyBooksToolBridge` 的字段/方法
    （对应 `#bridge` 部分）。
  - `document/Toolbox_Dynamic_Design.md` 第 4.3/4.5 节 —— iframe 主题/语言联动机制
    （对应 `#theme-locale` 部分，这是最容易被忽略但对工具作者最重要的一段）。
  - `webserver/toolbox/toolbox_manager.py` 里的 `REQUIRED_MANIFEST_FIELDS` —— manifest.json
    必填字段列表（对应 `#manifest` 部分，同时要检查这个仓库自己的
    `src/manifest.js` 的 `REQUIRED_FIELDS` 是否也要跟着改）。

## 找到 mybooks/mybooks 仓库

这个仓库（`tools_builder`）和 `mybooks/mybooks` 是两个独立仓库，不是 monorepo 的一部分。先确认
本机上 `mybooks/mybooks` 的检出路径——常见位置类似
`/Volumes/data/projects/reader/mybooks`，但**不要硬编码假设**：先用 `find` 或直接问用户确认
路径存在（关键锚点文件：`webserver/toolbox/core_api.py`）。如果确实找不到，向用户要路径，不要
凭记忆瞎猜内容。

## 同步步骤

1. **读取权威来源**（在 `mybooks/mybooks` 仓库里）：
   - `webserver/toolbox/core_api.py` 整个文件——这是 `#core-api` 部分方法列表、签名、
     docstring 的唯一来源。逐个 class（`CalibreAPI`/`AppDBAPI`/`TasksAPI`/`MessagesAPI`/
     `StorageAPI`）核对 `docs/index.html` 里对应命名空间下的 `<details class="method">` 块：
     新增的方法要补一个新块，删掉的方法要移除对应块，签名/参数变了要同步改
     `<span class="sig">` 和 `<table class="params">`。
   - `webserver/toolbox/core_api.py` 顶部的 `CORE_API_VERSION` 常量——同步到页面顶部
     `.badge` 里的版本号，以及页尾"最近一次同步"那句话里的版本号。
   - `app/public/static/toolbox-bridge.js`——核对 `#bridge` 部分的 `bridge.*` 字段/方法
     是否有增删；这个文件里如果出现了新的 API 路径前缀（当前是
     `/api/toolbox/tool/{tool_id}/{path}`），`#bridge` 和 `#theme-locale` 两处引用都要改。
   - `document/Toolbox_Dynamic_Design.md` 4.3/4.5 节——核对"宿主切主题/语言时是重设
     `iframe.src`（整页刷新）还是已经改成了 `postMessage` 实时推送"这条结论有没有变；这是
     `#theme-locale` 整节内容的前提，一旦变了要重写这一节而不只是改措辞。
   - `webserver/toolbox/toolbox_manager.py` 的 `REQUIRED_MANIFEST_FIELDS` 元组——核对
     `#manifest` 部分的字段表格；同时打开这个仓库自己的 `src/manifest.js`，如果
     `REQUIRED_FIELDS` 数组和后端不一致，也要一起改（这两处本来就要求保持同步，见
     `src/manifest.js` 顶部注释）。

2. **只改机械对应的部分，保留手写的说明性文字**：`docs/index.html` 里 `#theme-locale` 整节、
   顶部的 intro 段落、每个 `.note`/`.warn` 提示框，都是针对工具作者写的解释性文字，不是从代码
   自动抄出来的——只有在它们描述的机制本身变了的时候才需要重写，普通的方法增删不需要动这些
   文字。

3. **本仓库自身要不要跟着改**：
   - `src/core-api-version.js` 的 `CORE_API_VERSION` 是否要跟着 bump（对齐后端同名常量）。
   - `templates/default/manifest.json` 里的 `core_api_version` 占位值。
   - `templates/default/backend/tool.py` 里演示用的 `self.api.calibre.all_book_ids()` 这类
     调用，如果对应方法签名变了，模板也要跟着改，否则新工具作者一上来跑的示例代码就是错的。
   - 改完这些跑一遍 `npm test`（`test/cli.test.js` 会验证 init→build→validate 全流程）。

4. **提交**：commit message 建议带上 `mybooks/mybooks` 当时的 commit（例如
   `git -C <mybooks_path> rev-parse --short HEAD` 取到的短哈希），方便以后追溯"这份文档对应
   核心仓库的哪个版本"，例如：
   ```
   docs: sync Core API reference (mybooks@<short-hash>)
   ```
   push 到 `main` 后 GitHub Actions 会自动重新发布 `docs/`，不需要额外手动步骤。

## 一次性仓库设置（如果还没做过）

GitHub 仓库设置 → Settings → Pages → Build and deployment → Source，选择 **GitHub Actions**
（而不是默认的 "Deploy from a branch"）。只需要设置一次，之后每次 push 到 `main` 且
`docs/**` 有变化都会自动触发 `.github/workflows/deploy-docs.yml` 重新发布。
