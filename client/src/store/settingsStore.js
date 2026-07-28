/*
  settingsStore.js 模块说明

  - 文件职责:
      使用 Vue.observable 保存 SourceManager 发布的完整页面投影和应用启动初始化状态。
      通过冻结门面提供完整投影替换与初始化状态迁移，供 main.js 和 settingsService 共享读取。
      本模块不是保存数据库，不导入数据源 mock，不执行数据源领域事务，也不逐字段合并业务结果。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 1 条，自定义 0 条):
      Vue: 第三方库，提供 Vue 2 observable 响应式状态能力。

  - 模块级常量:
      SOURCE_MANAGER_STATE_FIELDS: Array<string>，完整 SourceManagerState 顶层字段集合。
      SETTINGS_INITIALIZATION_STATUS: object，应用启动初始化状态枚举。
      settingsState: object，Vue 响应式投影和初始化状态容器。
      settingsStore: object，冻结的设置状态读取与替换门面。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createEmptySourceManagerState(): 创建字段完整且不含业务记录的空投影。
      assertCompleteSourceManagerState(sourceManagerState): 校验 Runtime 发布投影的顶层完整性。
      createInitializationError(error): 把启动异常收敛为页面状态可安全保存的诊断对象。
      replaceSourceManagerState(sourceManagerState): 一次性采用完整 SourceManagerState 投影。
      beginSourceManagerInitialization(): 标记启动初始化进行中并清空旧失败。
      failSourceManagerInitialization(error): 恢复完整空投影并记录启动失败。

  - 模块级类:
      无

  - 对外导出:
      settingsStore: object，供应用启动链写入、供 settingsService 同步读取的冻结门面。
*/

// 导入来源: vue。
// 导入内容: Vue 2 构造函数。
// 文件作用: 使用 Vue.observable 建立跨设置路由共享的响应式页面投影。
import Vue from 'vue';

// 类型: Array<string>。
// 作用: 固定 SourceManagerState 完整顶层字段；替换入口拒绝缺字段、额外字段和局部补丁对象。
const SOURCE_MANAGER_STATE_FIELDS = Object.freeze([
  'activeSourceId',
  'defaultSourceId',
  'removedSystemSourceIds',
  'checkingAll',
  'switchState',
  'records'
]);

// 类型: object。
// 作用: 统一应用启动初始化状态，避免调用方使用自由字符串判断是否可以读取 Runtime 投影。
const SETTINGS_INITIALIZATION_STATUS = Object.freeze({
  // 类型: string；作用: 应用尚未开始初始化，store 只保存完整空投影。
  idle: 'idle',
  // 类型: string；作用: Runtime 初始化 Promise 正在执行，页面尚未挂载。
  initializing: 'initializing',
  // 类型: string；作用: store 已采用至少一份 SourceManager 完整投影。
  ready: 'ready',
  // 类型: string；作用: Runtime 初始化失败，应用将使用完整空投影继续挂载。
  failed: 'failed'
});

/**
 * 创建完整空 SourceManagerState 投影。
 * 纯函数: 每次调用返回全新对象和数组，不共享可变引用。
 * 使用场景: 模块初始状态、初始化重试开始和初始化失败关闭。
 * 维护边界: 字段集合必须与 SourceManagerState 正式契约同步；不能放入脚本文本或 Repository 保存对象。
 *
 * @returns {object} 字段完整且记录为空的 SourceManagerState。
 */
function createEmptySourceManagerState() {
  return {
    // 类型: string；作用: 尚未建立内容活动源时保持空字符串。
    activeSourceId: '',
    // 类型: string；作用: 尚未建立默认源时保持空字符串。
    defaultSourceId: '',
    // 类型: Array<string>；空数组表示当前空投影没有软隐藏系统源。
    removedSystemSourceIds: [],
    // 类型: boolean；true 表示批量健康检测进行中，false 表示当前空闲；空投影固定为 false。
    checkingAll: false,
    // 类型: object；作用: 保存内容活动源切换事务的完整空状态。
    switchState: {
      // 类型: string；作用: 没有待切换数据源时保持空字符串。
      pendingSourceId: '',
      // 类型: string；作用: 没有切换请求时保持空字符串。
      requestId: '',
      // 类型: string；作用: idle 表示当前没有活动源切换事务。
      status: 'idle',
      // 类型: string；作用: 没有切换失败时保持空字符串。
      errorMessage: ''
    },
    // 类型: Array<object>；空数组表示尚未从 SourceManager 采用任何数据源记录。
    records: []
  };
}

/**
 * 校验 SourceManager 发布投影的顶层完整性。
 * 纯函数: 只读取候选对象，不修改字段、数组或嵌套记录。
 * 成功路径: 返回原投影，交给 Vue observable 采用。
 * 失败路径: 非普通对象、字段缺失、额外字段或关键容器错误时抛出 TypeError，禁止局部状态进入 store。
 *
 * @param {*} sourceManagerState SourceManagementRuntime 订阅发布的投影候选。
 * @returns {object} 顶层字段完整的 SourceManagerState。
 * @throws {TypeError} 投影不符合完整顶层结构时抛出。
 */
function assertCompleteSourceManagerState(sourceManagerState) {
  // 条件分支: 候选不是原型安全普通对象时进入。
  // 执行内容: 在读取字段前拒绝 null、数组和类实例。
  if (!sourceManagerState || typeof sourceManagerState !== 'object'
    || Array.isArray(sourceManagerState)
    || Object.getPrototypeOf(sourceManagerState) !== Object.prototype) {
    throw new TypeError('settingsStore 只能采用普通对象 SourceManagerState');
  }

  // 类型: Array<string>。
  // 作用: 保存候选真实字段，执行精确字段集合和顺序无关校验。
  const actualFields = Object.keys(sourceManagerState);

  // 条件分支: 字段数量或成员与冻结契约不一致时进入。
  // 执行内容: 拒绝局部补丁、旧 mock 结构和携带未声明保存字段的对象。
  if (actualFields.length !== SOURCE_MANAGER_STATE_FIELDS.length
    || SOURCE_MANAGER_STATE_FIELDS.some(field => !actualFields.includes(field))) {
    throw new TypeError('settingsStore 收到的 SourceManagerState 字段集合无效');
  }

  // 条件分支: 两个集合字段不是数组时进入。
  // 执行内容: 阻止页面筛选、软隐藏和记录遍历读取损坏容器。
  if (!Array.isArray(sourceManagerState.removedSystemSourceIds)
    || !Array.isArray(sourceManagerState.records)) {
    throw new TypeError('settingsStore 收到的 SourceManagerState 集合字段无效');
  }

  // 条件分支: switchState 不是普通对象时进入。
  // 执行内容: 阻止内容源切换消费者读取不完整标量或数组。
  if (!sourceManagerState.switchState || typeof sourceManagerState.switchState !== 'object'
    || Array.isArray(sourceManagerState.switchState)
    || Object.getPrototypeOf(sourceManagerState.switchState) !== Object.prototype) {
    throw new TypeError('settingsStore 收到的 SourceManagerState.switchState 无效');
  }

  return sourceManagerState;
}

/**
 * 创建可保存在响应式状态中的初始化错误摘要。
 * 纯函数: 不修改原 Error，也不保存可能循环引用的 cause、堆栈或基础设施对象。
 * 成功路径: 返回 name、code 和 message 三字段诊断对象。
 * 失败路径: 非对象异常使用稳定 Error 名称、空 code 和字符串消息。
 *
 * @param {*} error SourceManagementRuntime 初始化拒绝原因。
 * @returns {object} 不泄漏 Runtime 内部引用的初始化错误摘要。
 */
function createInitializationError(error) {
  // 类型: object。
  // 作用: 只采用稳定可展示诊断字段；cause 和 stack 留在原异常链，不进入页面投影。
  return {
    name: typeof error?.name === 'string' ? error.name : 'Error',
    code: typeof error?.code === 'string' ? error.code : '',
    message: typeof error?.message === 'string' ? error.message : String(error || '数据源管理初始化失败')
  };
}

// 类型: object。
// 作用: 保存 Vue 响应式页面投影和启动状态；只有下方冻结门面中的方法可以替换字段。
// 生命周期: 模块加载时创建，应用运行期间持续存在，浏览器刷新后重新创建。
const settingsState = Vue.observable({
  // 类型: object；来源: createEmptySourceManagerState；作用: 设置页同步读取的完整响应式投影。
  sourceManager: createEmptySourceManagerState(),
  // 类型: object；作用: 记录 Runtime 初始化是否开始、成功或失败。
  initialization: {
    // 类型: string；来源: SETTINGS_INITIALIZATION_STATUS；作用: 当前启动状态。
    status: SETTINGS_INITIALIZATION_STATUS.idle,
    // 类型: object|null；null 表示当前没有初始化失败，object 保存安全诊断摘要。
    error: null
  }
});

/**
 * 一次性采用完整 SourceManagerState 投影。
 * 副作用: 替换 settingsState.sourceManager 整体引用，并把初始化状态收敛为 ready。
 * 成功路径: Vue 观察新投影并通知列表、详情和摘要重新计算。
 * 失败路径: 完整性校验抛错时保留最近一次已采用投影，不执行局部合并或回退 mock。
 *
 * @param {*} sourceManagerState SourceManagementRuntime 订阅发布的完整隔离投影。
 * @returns {object} 已被 store 采用的 SourceManagerState。
 */
function replaceSourceManagerState(sourceManagerState) {
  // 类型: object。
  // 作用: 在任何响应式写入前完成完整投影顶层校验。
  const completeState = assertCompleteSourceManagerState(sourceManagerState);

  // 副作用: 整体替换页面投影，不逐字段合并，也不把投影写回 Repository。
  settingsState.sourceManager = completeState;

  // 副作用: 收到稳定或过渡投影都证明初始化发布链已经建立，清除旧失败并标记 ready。
  settingsState.initialization = {
    status: SETTINGS_INITIALIZATION_STATUS.ready,
    error: null
  };

  return settingsState.sourceManager;
}

/**
 * 标记 SourceManagementRuntime 启动初始化开始。
 * 副作用: 恢复完整空投影并把初始化状态设为 initializing，清除旧失败摘要。
 * 使用边界: 只由 main.js 在调用共享 Runtime initialize 前执行。
 *
 * @returns {void} 状态通过 settingsState 响应式更新。
 */
function beginSourceManagerInitialization() {
  // 副作用: 每次显式初始化尝试都从完整空投影开始，不保留失败尝试产生的局部页面状态。
  settingsState.sourceManager = createEmptySourceManagerState();
  settingsState.initialization = {
    status: SETTINGS_INITIALIZATION_STATUS.initializing,
    error: null
  };
}

/**
 * 记录 SourceManagementRuntime 启动初始化失败。
 * 副作用: 恢复完整空投影，并保存不含 cause 或基础设施引用的错误摘要。
 * 使用边界: 只由 main.js 捕获共享初始化 Promise 拒绝后执行；不得回退旧 mock。
 *
 * @param {*} error Runtime 初始化拒绝原因。
 * @returns {void} 状态通过 settingsState 响应式更新。
 */
function failSourceManagerInitialization(error) {
  // 副作用: 初始化失败关闭为完整空投影，避免页面消费可能发布过的中间状态。
  settingsState.sourceManager = createEmptySourceManagerState();
  settingsState.initialization = {
    status: SETTINGS_INITIALIZATION_STATUS.failed,
    error: createInitializationError(error)
  };
}

// 类型: object。
// 作用: 提供只读 getter和三项受控状态迁移；Object.freeze 阻止调用方替换方法或状态访问器。
export const settingsStore = Object.freeze({
  /**
   * 读取当前响应式 SourceManagerState 投影。
   * 纯函数: 该访问器不复制或修改投影；调用方只能读取，业务写入必须委托 SourceManagementRuntime。
   *
   * @returns {object} 当前完整页面投影。
   */
  get sourceManager() {
    return settingsState.sourceManager;
  },

  /**
   * 读取当前初始化状态。
   * 纯函数: 该访问器返回 Vue 响应式状态引用，调用方不得直接改写。
   *
   * @returns {object} 包含 status 和 error 的初始化状态。
   */
  get initialization() {
    return settingsState.initialization;
  },

  replaceSourceManagerState,
  beginSourceManagerInitialization,
  failSourceManagerInitialization
});
