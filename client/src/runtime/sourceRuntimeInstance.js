/*
  sourceRuntimeInstance.js 模块说明

  - 文件职责:
      创建应用内容链和筛选链共同使用的唯一 SourceRuntime 实例。
      防止多个 service 分别创建 Repository、SourceManager、SourceExecutionHost 和 Provider 生命周期。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      createSourceRuntime: 自定义服务，组合当前应用的数据源保存、事务、Shell 和执行宿主基础设施。

  - 模块级常量:
      sourceRuntimeInstance: object，应用进程内共享的冻结 SourceRuntime 门面。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      sourceRuntimeInstance: object，供内容、筛选和后续设置适配层复用的唯一 Runtime 实例。
*/

// 导入来源: ./createSourceRuntime.js。
// 导入内容: createSourceRuntime 应用基础设施组合工厂。
// 文件作用: 在当前模块首次加载时创建唯一 Runtime，调用方不能各自重复组合底层对象。
import { createSourceRuntime } from './createSourceRuntime.js';

// 类型: object。
// 作用: 保存应用模块图内唯一的冻结 SourceRuntime 门面，内容和筛选请求共享同一初始化 Promise、Host 和 Provider 实例。
// 副作用: 模块首次加载时创建 Memory Repository、SourceManager、MockNetworkAdapter、可信工厂注册表和 SourceExecutionHost；尚不启动 Provider 或写入页面 store。
export const sourceRuntimeInstance = createSourceRuntime();
