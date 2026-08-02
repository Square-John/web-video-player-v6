/*
  register-source-text-loader.mjs 模块说明

  - 文件职责:
      在 Node 自动测试启动前注册项目专用 ?raw 源码文本加载器，并采用根 frontend.config.js 作为测试环境的前端运行配置。
      只建立 ESM 加载钩子和测试前置配置，不读取数据源、不执行测试，也不改变普通模块解析。

  - 导入库及文件汇总(3 条，内置 1 条，第三方 0 条，自定义 2 条):
      register: Node 内置模块加载器注册函数，用于安装隔离的 source-text-loader 钩子。
      FRONTEND_CONFIG: 根前端配置正例，作为 Node 测试环境唯一运行配置候选。
      initializeFrontendRuntimeConfig: 自定义测试屏障，让被测 Runtime 与浏览器使用同一运行投影。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      无；模块求值时先采用测试运行配置，再注册测试加载器。
*/

// 导入来源: node:module。
// 导入内容: register Node ESM 加载器注册函数。
// 文件作用: 在测试模块解析前安装项目的 ?raw 文本加载钩子。
import { register } from 'node:module';

// 导入来源: ../../../config/frontend.config.js。
// 导入内容: FRONTEND_CONFIG 根前端配置。
// 文件作用: 给 Node 测试提供与浏览器外部脚本相同的唯一前端配置正例，不创建第二套测试地址。
import FRONTEND_CONFIG from '../../config/frontend.config.js';

// 导入来源: ../src/config/frontendRuntimeConfig.js。
// 导入内容: initializeFrontendRuntimeConfig。
// 文件作用: 在带 source Runtime 的测试模块求值前建立配置启动屏障。
import { initializeFrontendRuntimeConfig } from '../src/config/frontendRuntimeConfig.js';

// 副作用: 测试进程只采用根前端配置的 runtime 投影，生产浏览器仍由 index.html 外部脚本提供候选。
initializeFrontendRuntimeConfig(FRONTEND_CONFIG);

// 副作用: 使用当前模块 URL 解析同目录加载器；注册范围只属于本次 Node 测试进程。
register('./source-text-loader.mjs', import.meta.url);
