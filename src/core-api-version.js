'use strict';

// 这个脚手架内置的 mock（未来 `mytool dev` 才会真正用到）与 `init`/`build` 生成的
// manifest.json 默认值，对齐的是 mybooks/mybooks 仓库里 webserver/toolbox/core_api.py 的
// CORE_API_VERSION 常量。核心仓库升级 CoreAPI 接口时，这里也要跟着发新版本。
const CORE_API_VERSION = '1.1.0';

module.exports = { CORE_API_VERSION };
