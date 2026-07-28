/*
  vite.config.js 模块说明

  - 文件职责:
      定义 Vite 本地开发和生产构建配置。
      为 Vue 2 单文件组件提供编译插件，并使用 Vite 默认开发端口。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 2 条，自定义 0 条):
      defineConfig: 第三方库，提供 Vite 配置对象包装能力。
      vue2: 第三方库，让 Vite 支持 Vue 2 单文件组件编译。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      viteConfig: object，Vite 开发和构建配置。
*/

// 导入来源: vite。
// 导入内容: defineConfig 配置包装函数。
// 文件作用: 为 Vite 配置对象提供结构化入口和编辑器提示。
import { defineConfig } from 'vite';

// 导入来源: @vitejs/plugin-vue2。
// 导入内容: vue2 Vue 2 单文件组件编译插件。
// 文件作用: 让 Vite 能够解析和构建 .vue 文件。
import vue2 from '@vitejs/plugin-vue2';

export default defineConfig({
  // 注册 Vue 2 插件，否则 Vite 无法正确编译 App.vue 这类 Vue 单文件组件。
  plugins: [vue2()]
});
