/*
  register-source-text-loader.mjs 模块说明

  - 文件职责:
      在 Node 自动测试启动前注册项目专用 ?raw 源码文本加载器。
      只建立 ESM 加载钩子，不读取数据源、不执行测试，也不改变普通模块解析。

  - 导入库及文件汇总(1 条，内置 1 条，第三方 0 条，自定义 0 条):
      register: Node 内置模块加载器注册函数，用于安装隔离的 source-text-loader 钩子。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      无；模块求值时仅注册测试加载器。
*/

// 导入来源: node:module。
// 导入内容: register Node ESM 加载器注册函数。
// 文件作用: 在测试模块解析前安装项目的 ?raw 文本加载钩子。
import { register } from 'node:module';

// 副作用: 使用当前模块 URL 解析同目录加载器；注册范围只属于本次 Node 测试进程。
register('./source-text-loader.mjs', import.meta.url);
