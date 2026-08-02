/*
  sourcePageService.js 模块说明

  - 文件职责:
      提供全局导航读取可切换数据源、活动源投影和提交切换意图的统一适配边界。
      导航组件与内容页切源响应器只消费轻量对象和 Manager 完整投影，不复制候选门禁或持有 Runtime 内部对象。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      sourceRuntimeInstance: 自定义应用单例，提供全局导航候选派生和原子活动源切换。
      settingsStore: 自定义响应式 store，提供 SourceManager 发布的当前完整页面投影。
      formatSourceDisplayName: 自定义显示适配器，统一限制内容页数据源名称长度。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      createNavigationSourceCandidate(sourceRecord): 把 Runtime 隔离 SourceRecord 缩减为不携带运行状态的导航候选身份。
      createNavigationSourceOption(sourceCandidate, sourceRecord): 把候选身份和 Manager 最新记录合成为顶部导航展示对象。

  - 模块级类:
      无

  - 对外导出:
      getPageSourceManagerState: Function，同步读取当前响应式 SourceManagerState。
      getActivePageSourceId: Function，读取活动源或尚未建立活动源时的默认候选。
      listNavigationSources: Function，按 Runtime 全局切换门禁返回导航候选身份。
      projectNavigationSources: Function，按候选顺序投影 Manager 当前名称和健康状态。
      switchNavigationSource: Function，委托 Runtime 执行原子活动源切换。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceRuntimeInstance 应用唯一内容 Runtime 门面。
// 文件作用: 复用其全局候选派生和原子切换方法，不创建第二 Runtime 或 Provider 注册表。
import { sourceRuntimeInstance } from '../runtime/sourceRuntimeInstance.js';

// 导入来源: ../store/settingsStore.js。
// 导入内容: settingsStore SourceManager 响应式完整投影门面。
// 文件作用: 导航组件和内容页切源响应器同步观察 records、activeSourceId 和 switchState，不轮询 Runtime。
import { settingsStore } from '../store/settingsStore.js';

// 导入来源: ../utils/sourceDisplayName.js。
// 导入内容: formatSourceDisplayName 数据源显示名称适配函数。
// 文件作用: 把完整 Definition.name 转换为内容页导航允许展示的前十个 Unicode 字符。
import { formatSourceDisplayName } from '../utils/sourceDisplayName.js';

/**
 * 把 Runtime SourceRecord 转换为导航候选身份。
 * 纯函数: 只读取 Runtime 已通过门禁的隔离记录，不保留当时的名称、健康状态或其他运行字段。
 * 成功路径: 返回只含真实 sourceId 的新对象，候选顺序由调用方保持。
 * 失败路径: Definition 缺失或 id 非字符串时返回空身份，后续页面投影统一排除。
 *
 * @param {object} sourceRecord Runtime 已完成候选门禁的隔离 SourceRecord。
 * @param {object} sourceRecord.definition 数据源身份定义。
 * @returns {object} 不携带可变运行状态的导航候选身份。
 * @returns {string} return.id 数据源唯一身份；字段异常时为空字符串。
 */
function createNavigationSourceCandidate(sourceRecord) {
  // 类型: object。
  // 作用: Definition 缺失时使用空对象进入身份失败关闭，不从其他位置猜测候选。
  const definition = sourceRecord?.definition || {};

  return {
    // 类型: string；作用: 连接 Runtime 候选资格与 Manager 最新记录，不保存首次加载时的运行状态副本。
    id: typeof definition.id === 'string' ? definition.id : ''
  };
}

/**
 * 把候选身份与 Manager 最新 SourceRecord 合成为导航展示对象。
 * 纯函数: 只读取两个隔离输入并创建新对象，不修改候选、Manager 投影或候选顺序。
 * 成功路径: 名称和健康状态始终来自本轮 Manager 记录，避免组件继续展示首次加载快照。
 * 失败路径: Definition 或 runtime 字段缺失时分别回退真实候选身份和未知健康状态。
 *
 * @param {object} sourceCandidate Runtime 已确认的导航候选身份。
 * @param {string} sourceCandidate.id 数据源唯一身份。
 * @param {object} sourceRecord Manager 最新 SourceRecord。
 * @param {object} sourceRecord.definition 数据源当前名称和身份定义。
 * @param {object} sourceRecord.runtime 数据源当前会话健康状态。
 * @returns {object} 顶部数据源切换组件可消费的轻量展示对象。
 * @returns {string} return.id 数据源唯一身份。
 * @returns {string} return.name SourceDefinition 当前正式纯名称，缺失时回退真实 sourceId。
 * @returns {string} return.healthStatus Manager 当前健康状态，缺失时为空字符串。
 */
function createNavigationSourceOption(sourceCandidate, sourceRecord) {
  // 类型: object。
  // 作用: Definition 缺失时使用空对象，让名称通过候选真实身份稳定兜底。
  const definition = sourceRecord?.definition || {};

  // 类型: object。
  // 作用: runtime 缺失时使用空对象，展示层按未知健康状态处理，不改变候选资格。
  const runtime = sourceRecord?.runtime || {};

  return {
    // 类型: string；作用: 导航切换意图、选中态和列表 key 共用 Runtime 已确认的真实 sourceId。
    id: sourceCandidate.id,
    // 类型: string；作用: 从 Manager 当前 Definition 生成统一十字符名称，避免名称更新后继续显示旧副本。
    name: formatSourceDisplayName(definition.name, sourceCandidate.id),
    // 类型: string；作用: 直接投影 Manager 当前健康状态，控制桌面和移动端共用状态点。
    healthStatus: typeof runtime.healthStatus === 'string' ? runtime.healthStatus : ''
  };
}

/**
 * 读取当前页面可观察的 SourceManagerState。
 * 纯函数: 返回 settingsStore 当前响应式完整投影引用，不修改字段或写回 Runtime。
 * 调用方: SourceNavbarSelector、页面切源响应 mixin、详情页和播放页的活动身份展示兜底。
 *
 * @returns {object} SourceManager 最近发布并由 settingsStore 完整采用的响应式投影。
 */
export function getPageSourceManagerState() {
  return settingsStore.sourceManager;
}

/**
 * 读取普通页面当前应使用的数据源身份。
 * 纯函数: 只读取 Manager 投影；活动源非空时返回活动源，仅活动源尚未建立时返回默认偏好。
 * 维护边界: 该函数不读取 siteContentStore 或 siteFilterStore 的最近响应身份。
 *
 * @returns {string} 当前 activeSourceId，或活动源为空时的 defaultSourceId；两者都空时返回空字符串。
 */
export function getActivePageSourceId() {
  // 类型: object。
  // 作用: 使用同一响应式投影读取两个身份，避免跨两次 getter 观察到不同版本状态。
  const sourceManagerState = getPageSourceManagerState();

  // 返回值类型: string。
  // 作用: 严格保持活动源优先语义，默认源只在活动源尚未建立时提供候选。
  return sourceManagerState.activeSourceId || sourceManagerState.defaultSourceId || '';
}

/**
 * 列出全局导航可以提交切换的数据源。
 * 副作用: 委托应用唯一 Runtime 初始化并读取最新 Manager 投影；不启动 Provider、不切换活动源、不写页面 store。
 * 成功路径: 保持 Manager 记录顺序返回只含 sourceId 的全新候选身份数组。
 * 失败路径: 初始化或可信工厂门禁失败时保留 Runtime 错误给导航下拉展示。
 *
 * @returns {Promise<Array<object>>} 当前全局可切换数据源候选身份数组。
 * @returns {string} return[].id Runtime 已确认的真实 sourceId。
 */
export async function listNavigationSources() {
  // 类型: Array<object>。
  // 作用: 候选集合完全由 Runtime 的可见、启用、授权和 Provider 就绪全局门禁产生。
  const sourceRecords = await sourceRuntimeInstance.listSwitchableSources();

  // 返回值类型: Array<object>。
  // 作用: 只保存 Runtime 已确认的候选身份，名称和健康状态由最新 Manager 投影提供。
  return sourceRecords.map(createNavigationSourceCandidate);
}

/**
 * 按 Runtime 候选顺序投影 Manager 当前导航展示字段。
 * 纯函数: 不重新判断启用、授权、Provider 就绪或软隐藏，候选资格继续只由 Runtime 决定。
 * 成功路径: 每次响应式 Manager 投影变化都重新读取对应记录的名称和健康状态。
 * 失败路径: 候选或记录集合异常时返回空数组；已不存在的记录从展示结果排除，等待生命周期重载确认新候选集合。
 *
 * @param {*} sourceCandidates Runtime 返回并由组件保存的候选身份数组。
 * @param {*} sourceManagerState settingsStore 当前完整响应式 SourceManagerState。
 * @returns {Array<object>} 保持 Runtime 候选顺序的当前导航展示对象。
 * @returns {string} return[].id 数据源唯一身份。
 * @returns {string} return[].name Manager 当前正式纯名称。
 * @returns {string} return[].healthStatus Manager 当前健康状态。
 */
export function projectNavigationSources(sourceCandidates, sourceManagerState) {
  // 类型: Array<object>。
  // 作用: 非数组候选失败关闭为空集合，避免普通对象进入导航循环。
  const candidates = Array.isArray(sourceCandidates) ? sourceCandidates : [];

  // 类型: Array<object>。
  // 作用: 非完整 Manager 投影使用空记录集合，不从候选快照恢复运行状态。
  const sourceRecords = Array.isArray(sourceManagerState?.records)
    ? sourceManagerState.records
    : [];

  // 类型: Map<string, object>。
  // 作用: 按 Manager 当前 definition.id 建立本轮只读查找表，候选顺序仍由 candidates 决定。
  const sourceRecordById = new Map();

  // 循环类型: Array.prototype.forEach。
  // 初始值: Manager 当前记录集合第一项。
  // 终止条件: 全部当前记录建立身份索引。
  // 循环作用: 只索引具有非空字符串身份的记录，不解释候选门禁字段。
  sourceRecords.forEach((sourceRecord) => {
    // 类型: string。
    // 作用: 读取当前记录真实身份；异常记录不进入页面查找表。
    const sourceId = typeof sourceRecord?.definition?.id === 'string'
      ? sourceRecord.definition.id
      : '';

    // 条件分支: 当前记录具有真实非空身份时进入。
    // 执行内容: 保存 Manager 最新记录供候选投影，不修改记录对象。
    if (sourceId) {
      sourceRecordById.set(sourceId, sourceRecord);
    }
  });

  // 类型: Array<object>。
  // 作用: 保持 Runtime 候选顺序累积当前仍有 Manager 记录的导航展示对象。
  const navigationSources = [];

  // 循环类型: Array.prototype.forEach。
  // 初始值: Runtime 候选身份数组第一项。
  // 终止条件: 全部候选完成最新 Manager 记录投影。
  // 循环作用: 只执行身份连接，不复制任何候选资格判断。
  candidates.forEach((sourceCandidate) => {
    // 类型: string。
    // 作用: 读取 Runtime 已确认的候选身份；异常候选不进入展示数组。
    const sourceId = typeof sourceCandidate?.id === 'string' ? sourceCandidate.id : '';

    // 类型: object|undefined。
    // 作用: 定位同一 sourceId 的 Manager 最新记录，缺失表示当前投影已不再包含该记录。
    const sourceRecord = sourceId ? sourceRecordById.get(sourceId) : undefined;

    // 条件分支: 候选身份有效且 Manager 当前仍存在对应记录时进入。
    // 执行内容: 从本轮记录创建名称和健康状态展示对象。
    if (sourceRecord) {
      navigationSources.push(createNavigationSourceOption(sourceCandidate, sourceRecord));
    }
  });

  return navigationSources;
}

/**
 * 提交全局导航活动源切换意图。
 * 副作用: 委托 Runtime 发布 switching、准备目标 Provider 并由最新请求采用 success 或 failed。
 * 成功路径: 返回当前最新隔离 SourceManagerState，调用方必须核对目标是否真实成为 success 活动源。
 * 失败路径: 当前最新切换失败时保留 Runtime 稳定错误；过期失败由 Runtime 返回更新状态而不传播旧错误。
 *
 * @param {string} sourceId 用户在顶部切换组件选择的目标数据源身份。
 * @returns {Promise<object>} Runtime 完成当前调用后可见的最新 SourceManagerState。
 */
export async function switchNavigationSource(sourceId) {
  return sourceRuntimeInstance.switchActiveSource(sourceId);
}
