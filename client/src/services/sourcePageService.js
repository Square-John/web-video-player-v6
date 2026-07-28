/*
  sourcePageService.js 模块说明

  - 文件职责:
      提供内容页面读取可用数据源、活动源投影和提交切换意图的统一适配边界。
      页面与 SourceSwitchTabs 只消费轻量展示对象和 Manager 完整投影，不复制候选门禁或持有 Runtime 内部对象。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      sourceRuntimeInstance: 自定义应用单例，提供页面候选派生和原子活动源切换。
      settingsStore: 自定义响应式 store，提供 SourceManager 发布的当前完整页面投影。
      formatSourceDisplayName: 自定义显示适配器，统一限制内容页数据源名称长度。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      createPageSourceOption(sourceRecord): 把隔离 SourceRecord 转换为顶部切换组件的轻量展示对象。

  - 模块级类:
      无

  - 对外导出:
      getPageSourceManagerState: Function，同步读取当前响应式 SourceManagerState。
      getActivePageSourceId: Function，读取活动源或尚未建立活动源时的默认候选。
      listPageSources: Function，按 Runtime 唯一候选规则返回页面展示对象。
      switchPageSource: Function，委托 Runtime 执行原子活动源切换。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceRuntimeInstance 应用唯一内容 Runtime 门面。
// 文件作用: 复用其候选派生和原子切换方法，不创建第二 Runtime 或 Provider 注册表。
import { sourceRuntimeInstance } from '../runtime/sourceRuntimeInstance.js';

// 导入来源: ../store/settingsStore.js。
// 导入内容: settingsStore SourceManager 响应式完整投影门面。
// 文件作用: 页面切换组件同步观察 activeSourceId 和 switchState，不轮询 Runtime。
import { settingsStore } from '../store/settingsStore.js';

// 导入来源: ../utils/sourceDisplayName.js。
// 导入内容: formatSourceDisplayName 数据源显示名称适配函数。
// 文件作用: 把完整 Definition.name 转换为内容页导航允许展示的前十个 Unicode 字符。
import { formatSourceDisplayName } from '../utils/sourceDisplayName.js';

/**
 * 把 SourceRecord 转换为页面顶部数据源展示对象。
 * 纯函数: 只读取 Runtime 返回的隔离记录并创建新对象，不修改 Manager 投影或候选顺序。
 * 成功路径: 返回 id、正式纯名称和 healthStatus 三个页面字段。
 * 失败路径: 记录字段缺失时使用空字符串；候选合法性仍只由 Runtime 决定，本函数不补做门禁。
 *
 * @param {object} sourceRecord Runtime 已完成候选门禁的隔离 SourceRecord。
 * @param {object} sourceRecord.definition 数据源身份、名称和版本定义。
 * @param {object} sourceRecord.runtime 当前会话健康状态投影。
 * @returns {object} 顶部数据源切换组件可消费的轻量对象。
 * @returns {string} return.id 数据源唯一身份。
 * @returns {string} return.name SourceDefinition 提供的正式纯名称，缺失时回退真实 sourceId。
 * @returns {string} return.healthStatus 当前健康状态。
 */
function createPageSourceOption(sourceRecord) {
  // 类型: object。
  // 作用: Definition 缺失时使用空对象进入字段兜底，不从其他位置猜测身份或名称。
  const definition = sourceRecord?.definition || {};

  // 类型: object。
  // 作用: runtime 缺失时使用空对象，展示层按未知健康状态处理，不改变候选资格。
  const runtime = sourceRecord?.runtime || {};

  return {
    // 类型: string；作用: 页面切换意图、选中态和列表 key 共用的真实 sourceId。
    id: typeof definition.id === 'string' ? definition.id : '',
    // 类型: string；作用: 顶部导航统一读取完整名称并通过共享适配器限制为十个 Unicode 字符，异常缺失时回退真实身份。
    name: formatSourceDisplayName(definition.name, definition.id),
    // 类型: string；作用: 控制状态点和辅助说明；健康状态不参与本层候选筛选。
    healthStatus: typeof runtime.healthStatus === 'string' ? runtime.healthStatus : ''
  };
}

/**
 * 读取当前页面可观察的 SourceManagerState。
 * 纯函数: 返回 settingsStore 当前响应式完整投影引用，不修改字段或写回 Runtime。
 * 调用方: SourceSwitchTabs、详情页和播放页的活动身份展示兜底。
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
 * 列出指定页面可以展示和执行的数据源。
 * 副作用: 委托应用唯一 Runtime 初始化并读取最新 Manager 投影；不启动 Provider、不切换活动源、不写页面 store。
 * 成功路径: 保持 Manager 记录顺序返回全新轻量展示对象数组。
 * 失败路径: 页面键、初始化或可信工厂门禁失败时保留 Runtime 错误给 SourceSwitchTabs 展示。
 *
 * @param {string} pageKey 当前内容页面键，例如 home、movie、tv 或 search。
 * @returns {Promise<Array<object>>} 当前页面可用数据源展示对象数组。
 */
export async function listPageSources(pageKey) {
  // 类型: Array<object>。
  // 作用: 候选集合完全由 Runtime 的可见、启用、授权、工厂和 capability 唯一门禁产生。
  const sourceRecords = await sourceRuntimeInstance.listAvailableSources(pageKey);

  // 返回值类型: Array<object>。
  // 作用: 只转换展示字段，不保存第二份 SourceRecord、Definition 或运行状态。
  return sourceRecords.map(createPageSourceOption);
}

/**
 * 提交页面活动源切换意图。
 * 副作用: 委托 Runtime 发布 switching、准备目标 Provider 并由最新请求采用 success 或 failed。
 * 成功路径: 返回当前最新隔离 SourceManagerState，调用方必须核对目标是否真实成为 success 活动源。
 * 失败路径: 当前最新切换失败时保留 Runtime 稳定错误；过期失败由 Runtime 返回更新状态而不传播旧错误。
 *
 * @param {string} sourceId 用户在顶部切换组件选择的目标数据源身份。
 * @returns {Promise<object>} Runtime 完成当前调用后可见的最新 SourceManagerState。
 */
export async function switchPageSource(sourceId) {
  return sourceRuntimeInstance.switchActiveSource(sourceId);
}
