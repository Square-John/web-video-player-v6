/*
  sourceRuntimeInstance.js 模块说明

  - 文件职责:
      创建应用内容链、筛选链和设置管理链共同使用的唯一 Runtime Bundle。
      从同一 Bundle 导出内容门面与设置管理门面，防止多个 service 分别创建底层基础设施。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      createSourceRuntimeBundle: 自定义服务，组合当前应用的数据源保存、事务、Shell、执行宿主和两个裁剪门面。

  - 模块级常量:
      sourceRuntimeBundle: object，应用进程内唯一 Runtime Bundle，仅在当前模块持有。
      sourceRuntimeInstance: object，应用进程内共享的冻结 SourceRuntime 门面。
      sourceManagementRuntimeInstance: object，应用进程内共享的冻结完整设置管理门面。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      sourceRuntimeInstance: object，供内容和筛选 service 复用的唯一内容 Runtime 门面。
      sourceManagementRuntimeInstance: object，供设置适配层复用的同 Bundle 完整管理门面。
*/

// 导入来源: ./createSourceRuntime.js。
// 导入内容: createSourceRuntimeBundle 应用基础设施组合工厂。
// 文件作用: 在当前模块首次加载时一次创建内容与设置管理共用的底层对象。
import { createSourceRuntimeBundle } from './createSourceRuntime.js';

// 类型: object。
// 作用: 保存应用模块图内唯一 Runtime Bundle；只在当前组合实例模块拆出两个公开门面，不向 service 导出 Bundle 本身。
// 副作用: 模块首次加载时创建 Memory Repository、SourceManager、MockNetworkAdapter、可信工厂注册表和 SourceExecutionHost；尚不启动 Provider 或写入页面 store。
const sourceRuntimeBundle = createSourceRuntimeBundle();

// 类型: object。
// 作用: 保存应用模块图内唯一的冻结 SourceRuntime 门面，内容和筛选请求共享同一初始化 Promise、Host 和 Provider 实例。
// 来源: sourceRuntimeBundle.sourceRuntime，由当前模块唯一 Bundle 裁剪。
export const sourceRuntimeInstance = sourceRuntimeBundle.sourceRuntime;

// 类型: object。
// 作用: 保存应用模块图内唯一完整设置管理门面，与内容门面共享初始化 Promise、SourceManager、Host、Repository、输入适配器和更新端口。
// 来源: sourceRuntimeBundle.sourceManagementRuntime；7C 提供设置意图 FIFO、Manager 委托、Host 补偿、导入更新和最小导出能力。
export const sourceManagementRuntimeInstance = sourceRuntimeBundle.sourceManagementRuntime;
