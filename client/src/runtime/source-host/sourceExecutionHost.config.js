/*
  sourceExecutionHost.config.js 模块说明

  - 文件职责:
      集中冻结 SourceExecutionHost 内部生命周期阶段、受管业务能力和计数器初始值。
      把细粒度 Host phase 映射到 SourceManager 已冻结的五态 Provider 状态，避免页面契约随内部实现扩张。
      供 SourceExecutionHost、稳定错误和 Host 测试共享，禁止在实现文件散落状态魔法字符串或数字。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      PROVIDER_RUNTIME_STATUS: 自定义配置，SourceManager 和页面消费的 Provider 五态枚举。

  - 模块级常量:
      SOURCE_EXECUTION_HOST_PHASE: object，Host 私有 entry 使用的细粒度生命周期阶段。
      SOURCE_EXECUTION_HOST_OPERATION: object，允许通过 Host 受管调用器执行的 Provider 业务能力。
      SOURCE_EXECUTION_HOST_COUNTER_INITIAL: object，生命周期代次和在途调用计数器初始值。
      SOURCE_EXECUTION_HOST_PHASE_TO_PROVIDER_STATUS: object，Host phase 到页面五态的冻结映射。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SOURCE_EXECUTION_HOST_PHASE、SOURCE_EXECUTION_HOST_OPERATION、SOURCE_EXECUTION_HOST_COUNTER_INITIAL、SOURCE_EXECUTION_HOST_PHASE_TO_PROVIDER_STATUS: object，Host 稳定配置。
*/

// 导入来源: ../../config/source-manager.config.js。
// 导入内容: PROVIDER_RUNTIME_STATUS Provider 生命周期五态枚举。
// 文件作用: 把 Host 细粒度阶段映射为 SourceManager 和设置页已经冻结的公开状态。
import { PROVIDER_RUNTIME_STATUS } from '../../config/source-manager.config.js';

// 类型: object。
// 作用: 统一 Host 私有 entry 的细粒度阶段；释放成功后 entry 被删除，不保留 disposed 活状态。
export const SOURCE_EXECUTION_HOST_PHASE = Object.freeze({
  // 类型: string。
  // 作用: Host 正在创建控制器、Context、Provider 并等待 initialize 完成。
  initializing: 'initializing',

  // 类型: string。
  // 作用: Provider 已完成 initialize，等待显式 start。
  initialized: 'initialized',

  // 类型: string。
  // 作用: Provider.start 正在执行，业务调用仍被拒绝。
  starting: 'starting',

  // 类型: string。
  // 作用: Provider 已经可以接受 Host 受管业务调用。
  running: 'running',

  // 类型: string。
  // 作用: Host 已拒绝新调用，正在 abort、drain 和执行 Provider.stop。
  stopping: 'stopping',

  // 类型: string。
  // 作用: Provider 已停止业务能力，但 entry 仍等待显式 dispose。
  stopped: 'stopped',

  // 类型: string。
  // 作用: Host 正在永久释放 Provider、Context 和控制器引用。
  disposing: 'disposing',

  // 类型: string。
  // 作用: 最近生命周期操作失败，entry 保持不可调用并等待释放重试。
  failed: 'failed'
});

// 类型: object。
// 作用: 限定 Host 私有受管调用器可以分派的 Provider 方法，禁止任意字符串属性调用。
export const SOURCE_EXECUTION_HOST_OPERATION = Object.freeze({
  // 类型: string。
  // 作用: 执行标准内容请求并返回 SourceDataResponse 候选。
  fetchData: 'fetchData',

  // 类型: string。
  // 作用: 执行标准筛选请求并返回 SourceFilterMetaResponse 候选。
  fetchFilterMeta: 'fetchFilterMeta',

  // 类型: string。
  // 作用: 执行受控健康检测并返回 SourceHealthCheckResult 候选。
  checkHealth: 'checkHealth'
});

// 类型: object。
// 作用: 集中定义每个 sourceId 首个生命周期代次和无在途调用状态，避免 Host 实现散落裸数字。
export const SOURCE_EXECUTION_HOST_COUNTER_INITIAL = Object.freeze({
  // 类型: number。
  // 作用: 首个成功创建的 entry 使用第一代身份，后续释放并重建时单调递增。
  lifecycleGeneration: 1,

  // 类型: number。
  // 作用: 新 entry 尚未执行受管业务调用，在途计数从零开始。
  activeCallCount: 0
});

// 类型: object。
// 作用: 把 Host 内部 phase 映射成 SourceManagerState.runtime.providerStatus 已冻结的五态值。
export const SOURCE_EXECUTION_HOST_PHASE_TO_PROVIDER_STATUS = Object.freeze({
  // 类型: string。
  // 作用: initialize 过程对外表现为 starting，页面不需要新增 initializing 状态。
  [SOURCE_EXECUTION_HOST_PHASE.initializing]: PROVIDER_RUNTIME_STATUS.starting,

  // 类型: string。
  // 作用: 已初始化未启动时对外表现为 stopped，避免误导页面认为 Provider 可调用。
  [SOURCE_EXECUTION_HOST_PHASE.initialized]: PROVIDER_RUNTIME_STATUS.stopped,

  // 类型: string。
  // 作用: start 过程直接映射现有 starting 状态。
  [SOURCE_EXECUTION_HOST_PHASE.starting]: PROVIDER_RUNTIME_STATUS.starting,

  // 类型: string。
  // 作用: running 阶段映射现有 running 状态，表示可接受受管调用。
  [SOURCE_EXECUTION_HOST_PHASE.running]: PROVIDER_RUNTIME_STATUS.running,

  // 类型: string。
  // 作用: stop 和 drain 过程映射现有 stopping 状态。
  [SOURCE_EXECUTION_HOST_PHASE.stopping]: PROVIDER_RUNTIME_STATUS.stopping,

  // 类型: string。
  // 作用: 已停止未释放阶段映射现有 stopped 状态。
  [SOURCE_EXECUTION_HOST_PHASE.stopped]: PROVIDER_RUNTIME_STATUS.stopped,

  // 类型: string。
  // 作用: dispose 过程继续映射 stopping，页面只需要知道实例正在退出。
  [SOURCE_EXECUTION_HOST_PHASE.disposing]: PROVIDER_RUNTIME_STATUS.stopping,

  // 类型: string。
  // 作用: 任一生命周期失败映射现有 failed 状态。
  [SOURCE_EXECUTION_HOST_PHASE.failed]: PROVIDER_RUNTIME_STATUS.failed
});
