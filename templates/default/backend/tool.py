"""
{{NAME}} —— MyBooks Toolbox 外部插件

由 `mybooks-tool init` 生成的模板。CoreAPI 各命名空间的完整设计见
document/Toolbox_Dynamic_Design.md 第二节（在 mybooks/mybooks 仓库里）；这里只演示最常用
的几个：`self.api.calibre` / `self.api.tasks`。

这份模板运行时依赖真实的 MyBooks 后端环境（Calibre、SQLAlchemy session 等，由
BaseTool/AsyncService 在被调用时自动注入），无法脱离 MyBooks 独立运行 —— 用
`mybooks-tool build` 打包后，走开发者模式（`ENABLE_TOOLBOX_DEV_MODE`）装进一个真实的
MyBooks 实例才能实际调用，`mybooks-tool dev`（未来的能力）也不会模拟这部分。
"""
from webserver.toolbox.base_tool import BaseTool
from webserver.services import AsyncService
from webserver.handlers.base import BaseHandler, js


class {{CLASS_NAME}}(BaseTool):
    # 后台任务面板里显示的任务名称（会经过 i18n 处理）
    service_item_name = "{{NAME}}"

    @staticmethod
    def info():
        return {
            "tool_id": "{{TOOL_ID}}",
            "name": "{{NAME}}",
            "description": "{{DESCRIPTION}}",
            "revision": "0.1.0",
            "author": "{{AUTHOR}}",
            "publish_date": "{{PUBLISH_DATE}}",
            "repo_url": "{{REPO_URL}}",
        }

    # 工具的入口方法，用 @AsyncService.register_service（异步执行、带后台任务进度，适合
    # 耗时操作）或 @AsyncService.register_function（同步执行，适合很快返回的操作）装饰。
    #
    # CoreAPI 命名空间速查：
    #   self.api.calibre   书库读写：search_books / get_metadata / set_metadata /
    #                       import_file / merge_formats / add_format / delete_book ...
    #   self.api.db        应用数据库：get_item_by_book_id / create_item /
    #                       delete_item_by_book_id / get_reader
    #   self.api.tasks     后台任务：create_task / update_progress / complete_task /
    #                       make_progress_callback
    #   self.api.messages  站内消息：send_message / cleanup_messages
    #   self.api.storage   工具专属数据目录 + 持久配置：get_work_dir / cleanup_work_dir /
    #                       get_config / set_config
    @AsyncService.register_function
    def run(self):
        # TODO: 替换成你自己的业务逻辑，下面只是一个可以直接跑起来的最小示例
        book_ids = self.api.calibre.all_book_ids()
        return {"book_count": len(book_ids)}


class RunHandler(BaseHandler):
    """对应 manifest.json 里 api_routes 声明的 /api/toolbox/plugin/{{TOOL_ID}}/run。

    这与内置工具在 handlers/toolbox.py 里手写 Handler 类是同一套机制，只是从插件目录
    动态发现，见 document/Toolbox_Dynamic_Design.md 3.6 节。
    """

    @js
    def get(self):
        result = {{CLASS_NAME}}().run()
        return {"err": "ok", "data": result}
