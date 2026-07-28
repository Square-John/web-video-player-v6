/*
  vite.config.js 模块说明

  - 文件职责:
      定义 Vite 本地开发和生产构建配置。
      为 Vue 2 单文件组件提供编译插件，并冻结本地 IPv4/IPv6 双栈开发入口。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 2 条，自定义 0 条):
      defineConfig: 第三方库，提供 Vite 配置对象包装能力。
      vue2: 第三方库，让 Vite 支持 Vue 2 单文件组件编译。

  - 模块级常量:
      DEVELOPMENT_SERVER: Readonly<object>，冻结本机双栈监听地址、固定端口和端口占用失败策略。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      viteConfig: object，Vite 开发和构建配置。
*/

// 导入来源: vite；导入内容: defineConfig；文件作用: 包装并校验当前 Vite 配置对象。
import { defineConfig } from 'vite';

// 导入来源: @vitejs/plugin-vue2；导入内容: vue2；文件作用: 让 Vite 编译项目的 Vue 2 单文件组件。
import vue2 from '@vitejs/plugin-vue2';

// 类型: Readonly<object>；来源: 本地联调需要同时接受 IPv6 与 IPv4 回环连接；作用: 让一个 Vite 进程稳定服务三种本地 origin。
const DEVELOPMENT_SERVER = Object.freeze({
  // 类型: string；作用: 监听 IPv6 未指定地址；Windows 双栈 socket 同时接受 ::1 和 127.0.0.1，不创建两套开发服务。
  host: '::',
  // 类型: number；来源: Vite 默认公开端口与后端本机 CORS；作用: 保持联调 origin 固定为 5173。
  port: 5173,
  // 类型: boolean；true 表示端口被占用时启动失败，false 会自动改端口并破坏固定 CORS/文档地址；作用: 阻止静默漂移。
  strictPort: true
});

export default defineConfig({
  // 注册 Vue 2 插件，否则 Vite 无法正确编译 App.vue 这类 Vue 单文件组件。
  plugins: [vue2()],

  // 本地开发服务器配置: 共享一份冻结双栈绑定，不能分别启动 IPv4/IPv6 实例形成状态分叉。
  server: {
    ...DEVELOPMENT_SERVER
  }
});
