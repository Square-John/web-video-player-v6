/*
  project.config.js 模块说明

  - 文件职责:
      保存本地开发启动器唯一的项目级选择和进程联动配置。
      该文件不保存前后端连接参数，不参与生产前端运行或后端代理安全策略。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PROJECT_CONFIG: Readonly<object>，开发启动选择、默认目标和联合进程关闭规则。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      PROJECT_CONFIG: default Readonly<object>，根级开发启动器读取的项目配置。
*/

// 类型: Readonly<object>；来源: 项目维护者编辑；作用: 决定本地开发启动器是否询问目标以及如何管理联合进程。
const PROJECT_CONFIG = Object.freeze({
  // 类型: string；默认值: 2.0.0；作用: 与新增后端日志和可信代理字段使用同一配置契约版本。
  schemaVersion: '2.0.0',

  // 类型: Readonly<object>；作用: 只控制本地开发命令，不进入前端构建产物或后端运行策略。
  startup: Object.freeze({
    // 类型: string；可选值: manual、configured；默认值: configured；作用: configured 直接采用 target，manual 在交互终端显示选择菜单。
    selectionMode: 'configured',
    // 类型: string；可选值: frontend、backend、all；默认值: all；作用: configured 模式下决定启动前端、后端或两者。
    target: 'all',
    // 类型: boolean；true 表示前端就绪后由 Vite 打开浏览器，false 只输出访问地址；仅影响开发服务。
    openBrowser: true,
    // 类型: boolean；true 表示联合运行任一子进程失败时关闭另一端，false 允许剩余端继续；默认保持联合会话完整退出。
    stopAllOnFailure: true
  })
});

// 导出类型: default Readonly<object>；导出内容: 项目开发启动配置；外部调用方: scripts/startup/configLoader.mjs。
export default PROJECT_CONFIG;
