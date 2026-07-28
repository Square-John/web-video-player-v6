/*
  settingsService.js 模块说明

  - 文件职责:
      保留设置页现有查询和操作函数名，作为 Vue 页面与 SourceManagementRuntime 之间的唯一适配层。
      同步查询只读取 settingsStore 的完整响应式投影；异步写操作只委托应用唯一管理 Runtime。
      浏览器脚本下载副作用集中在本模块，Runtime、SourceManager、Host 和 Repository 不接触 DOM 或 Blob。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      settingsStore: 自定义响应式 store，保存 SourceManager 发布的完整页面投影。
      sourceManagementRuntimeInstance: 自定义应用单例，串行执行设置意图、领域事务和 Host 补偿。
      SOURCE_KIND、HEALTH_STATUS、AUTHORIZATION_STATUS、IMPORT_METHOD、DEFAULT_SOURCE_HANDOFF_MODE、PROVIDER_READINESS_STATUS: 自定义配置，提供受控领域枚举和默认源交接模式。
      evaluateSourceAuthorizationFingerprint: 自定义授权工具，按 Runtime 投影中的当前脚本指纹评估授权。
      CAPABILITY_DEFINITIONS: 自定义展示配置，提供页面能力的稳定读取顺序。

  - 模块级常量:
      SOURCE_KIND_FILTER: object，数据源来源筛选枚举。
      DEFAULT_IMPORTED_VERSION: string，页面未填写版本时使用的导入默认值。
      SOURCE_EXPORT_FILE_PREFIX: string，批量脚本包下载文件名前缀。
      SOURCE_SCRIPT_MIME_TYPE: string，单脚本下载 MIME 类型。
      SOURCE_PACKAGE_MIME_TYPE: string，批量脚本包下载 MIME 类型。
      JSON_INDENT_SPACES: number，脚本包 JSON 可读缩进。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeSourceIds(sourceIds): 规范化单个或批量 sourceId 输入。
      createDefaultSourceHandoffCommand(baseCommand, fallbackSourceId): 把页面候选 id 转换为 Runtime 原子交接命令。
      findSourceRecordInState(state, sourceId): 从指定完整投影定位记录。
      getVisibleSourceRecords(state, sourceKindFilter): 从指定投影派生未软隐藏记录。
      isSourceRecordRunnable(record): 判断记录是否同时满足启用、授权和 Provider 就绪门禁。
      createImportInput(input): 把页面导入表单收敛为 Runtime 冻结输入。
      triggerTextDownload(content, fileName, mimeType): 管理一次性浏览器下载资源。

  - 模块级类:
      无

  - 对外导出:
      SOURCE_KIND_FILTER 与领域枚举: 设置组件使用的稳定状态入口。
      同步查询函数: 从 settingsStore 投影派生列表、详情、摘要、能力和授权状态。
      异步操作函数: 委托 SourceManagementRuntime，并保持现有参数与业务返回语义。
*/

// 导入来源: ../store/settingsStore.js。
// 导入内容: settingsStore 设置页响应式投影门面。
// 文件作用: 同步查询只从 store 读取 SourceManager 最近发布的完整投影。
import { settingsStore } from '../store/settingsStore.js';

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceManagementRuntimeInstance 应用唯一设置管理门面。
// 文件作用: 所有设置写操作统一进入同一 FIFO、SourceManager 事务和 Host 生命周期补偿链。
import { sourceManagementRuntimeInstance } from '../runtime/sourceRuntimeInstance.js';

import {
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 运行授权状态枚举。
  // 文件作用: 保持设置组件现有枚举入口。
  AUTHORIZATION_STATUS,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: DEFAULT_SOURCE_HANDOFF_MODE 默认源交接模式枚举。
  // 文件作用: 把页面候选 id 转换为 Runtime 接受的 replace 或 clear 原子命令。
  DEFAULT_SOURCE_HANDOFF_MODE,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 三态健康枚举。
  // 文件作用: 保持设置组件检测状态判断入口。
  HEALTH_STATUS,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 校验远程更新入口并规范化页面导入输入。
  IMPORT_METHOD,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_STATUS Provider 就绪状态枚举。
  // 文件作用: 统一摘要、默认源、检测和交接候选的可运行资格判断。
  PROVIDER_READINESS_STATUS,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源来源类型枚举。
  // 文件作用: 派生分类数量、授权入口和删除结果。
  SOURCE_KIND
} from '../config/source-manager.config.js';

// 导入来源: ../utils/sourceAuthorization.js。
// 导入内容: evaluateSourceAuthorizationFingerprint 指纹授权评估函数。
// 文件作用: 使用 Runtime 投影的 currentScriptHash 判断当前授权，不读取已移除的 definition.scriptContent。
import { evaluateSourceAuthorizationFingerprint } from '../utils/sourceAuthorization.js';

// 导入来源: ../utils/settingsDisplay.js。
// 导入内容: CAPABILITY_DEFINITIONS 页面能力定义。
// 文件作用: 按统一键顺序返回详情页可展示能力。
import { CAPABILITY_DEFINITIONS } from '../utils/settingsDisplay.js';

// 再导出来源: ../config/source-manager.config.js。
// 导出内容: 数据源类型、健康状态、授权状态和导入方式枚举。
// 使用场景: 保持现有设置组件从 settingsService 读取领域枚举的公开入口。
export { AUTHORIZATION_STATUS, HEALTH_STATUS, IMPORT_METHOD, SOURCE_KIND } from '../config/source-manager.config.js';

// 类型: object。
// 作用: 统一列表来源筛选值，避免组件散落 all、system 和 custom 自由字符串。
export const SOURCE_KIND_FILTER = Object.freeze({
  // 类型: string；作用: 返回全部未软隐藏记录。
  all: 'all',
  // 类型: string；作用: 只返回未软隐藏系统源。
  system: 'system',
  // 类型: string；作用: 只返回自定义源。
  custom: 'custom'
});

// 类型: string。
// 作用: 页面未填写导入版本时提供稳定业务版本；输入适配器仍负责最终严格校验。
const DEFAULT_IMPORTED_VERSION = 'v1.0.0';

// 类型: string。
// 作用: 统一批量数据源脚本包文件名前缀，页面组件不拼接下载名称。
const SOURCE_EXPORT_FILE_PREFIX = 'source-scripts';

// 类型: string。
// 作用: 定义单个 JavaScript 数据源脚本下载 MIME 类型。
const SOURCE_SCRIPT_MIME_TYPE = 'text/javascript;charset=utf-8';

// 类型: string。
// 作用: 定义批量数据源脚本包 JSON 下载 MIME 类型。
const SOURCE_PACKAGE_MIME_TYPE = 'application/json;charset=utf-8';

// 类型: number。
// 作用: 控制批量导出 JSON 的可读缩进，避免序列化调用散落数字字面值。
const JSON_INDENT_SPACES = 2;

/**
 * 规范化单个或批量数据源 id 输入。
 * 纯函数: 不修改输入数组，只保留非空字符串并按首次出现顺序去重。
 *
 * @param {string|Array<string>} sourceIds 单个或多个数据源 id。
 * @returns {Array<string>} 去空、去重后的稳定 sourceId 数组。
 */
function normalizeSourceIds(sourceIds) {
  // 类型: Array<*>。
  // 作用: 把单个 id 和数组统一为可遍历输入。
  const sourceIdList = Array.isArray(sourceIds) ? sourceIds : [sourceIds];

  // 循环类型: Array.prototype.filter + Set。
  // 循环作用: 删除非法值和重复项，保留用户首次选择顺序。
  return Array.from(new Set(
    sourceIdList.filter(sourceId => typeof sourceId === 'string' && sourceId !== '')
  ));
}

/**
 * 把页面默认源候选转换为 Runtime 原子交接命令。
 * 纯函数: 返回新命令，不修改 baseCommand；省略 fallbackSourceId 时保留 Runtime 的既有自动交接规则。
 * 成功路径: 非空字符串生成 replace，空字符串生成用户明确接受的 clear。
 * 失败路径: fallbackSourceId 不是字符串或 undefined 时抛出 TypeError，不提交领域事务。
 *
 * @param {object} baseCommand 不含 handoff 的 Runtime 基础命令。
 * @param {string|undefined} fallbackSourceId 页面选择的接替源 id；空字符串表示明确清空默认源。
 * @returns {object} 不含 handoff 的原命令副本，或携带 replace/clear 的新命令。
 * @throws {TypeError} fallbackSourceId 类型不符合页面适配契约时抛出。
 */
function createDefaultSourceHandoffCommand(baseCommand, fallbackSourceId) {
  // 条件分支: 调用方没有进入用户交接流程时不附加 handoff。
  // 执行内容: 让 Runtime 按当前稳定投影使用既有自动交接规则。
  if (fallbackSourceId === undefined) return { ...baseCommand };

  // 条件分支: 页面传入非字符串候选时失败关闭。
  // 执行内容: 阻止不明确的 null、对象或布尔值被误解释为清空默认源。
  if (typeof fallbackSourceId !== 'string') {
    throw new TypeError('fallbackSourceId 必须是字符串或 undefined');
  }

  // 条件分支: 用户选择了非空接替源时生成 replace 命令。
  // 执行内容: Runtime 和 SourceManager 继续验证候选存在、启用且不在失效范围内。
  if (fallbackSourceId.length > 0) {
    return {
      ...baseCommand,
      handoff: {
        mode: DEFAULT_SOURCE_HANDOFF_MODE.replace,
        sourceId: fallbackSourceId
      }
    };
  }

  // 返回值类型: object。
  // 作用: 空字符串只来自无候选时的用户明确确认，转换为字段精确的 clear 命令。
  return {
    ...baseCommand,
    handoff: { mode: DEFAULT_SOURCE_HANDOFF_MODE.clear }
  };
}

/**
 * 从指定 SourceManagerState 定位记录。
 * 纯函数: 只读取投影 records，不修改记录或数组。
 *
 * @param {object} state SourceManager 返回或 store 保存的完整投影。
 * @param {string} sourceId 数据源唯一标识。
 * @returns {object|null} 匹配记录；不存在时返回 null。
 */
function findSourceRecordInState(state, sourceId) {
  // 返回值类型: object|null。
  // 作用: 只使用 definition.id 统一身份，不回退别名或数组位置。
  return state.records.find(record => record.definition.id === sourceId) || null;
}

/**
 * 从指定投影派生当前可见记录。
 * 纯函数: 不修改 records、removedSystemSourceIds 或筛选值。
 *
 * @param {object} state 完整 SourceManagerState 投影。
 * @param {string} sourceKindFilter all、system 或 custom 来源筛选值。
 * @returns {Array<object>} 保持 SourceManager 权威顺序的可见记录。
 */
function getVisibleSourceRecords(state, sourceKindFilter = SOURCE_KIND_FILTER.all) {
  // 循环类型: Array.prototype.filter。
  // 循环作用: 排除软隐藏系统源，并按调用方选择保留来源类型。
  return state.records.filter((record) => {
    // 类型: string。
    // 作用: 使用统一记录身份判断软隐藏集合。
    const sourceId = record.definition.id;

    // 类型: boolean。
    // 作用: true 表示系统源已被用户软删除，false 表示记录仍可展示。
    const isRemovedSystemSource = record.definition.sourceKind === SOURCE_KIND.system
      && state.removedSystemSourceIds.includes(sourceId);

    // 条件分支: 当前系统源已软隐藏时进入。
    // 执行内容: 所有来源筛选都排除该记录。
    if (isRemovedSystemSource) return false;

    // 条件分支: 调用方查询全部来源时进入。
    // 执行内容: 保留所有未软隐藏记录。
    if (sourceKindFilter === SOURCE_KIND_FILTER.all) return true;

    return record.definition.sourceKind === sourceKindFilter;
  });
}

/**
 * 判断单条 SourceRecord 是否具备全局可运行资格。
 * 纯函数: 只读取 SourceManager 会话投影和统一授权评估，不查询 Registry、Host 或 Repository。
 * 成功规则: 用户已启用、当前脚本授权有效且 Provider 已注册并支持该 Definition 时返回 true。
 * 失败规则: 记录缺失、授权失效或 Provider 未就绪时返回 false；软隐藏由调用方先通过可见记录查询排除。
 *
 * @param {object|null} record SourceManagerState 中的轻量数据源记录。
 * @returns {boolean} true 允许参与默认源和健康检测，false 仅保留管理记录及用户启用意愿。
 */
export function isSourceRecordRunnable(record) {
  // 条件分支: 记录或运行投影缺失、用户未启用时失败关闭。
  // 执行内容: 不把不完整管理记录解释为可运行数据源。
  if (!record || !record.runtime || record.runtime.enabled !== true) return false;

  // 类型: boolean。
  // 作用: 使用统一授权指纹评估确认当前脚本仍获得有效用户授权。
  const isAuthorized = getSourceAuthorizationState(record).isAuthorized;

  // 返回值类型: boolean。
  // 作用: 只有授权有效且 Manager 投影明确标记 Provider ready 时通过全局门禁。
  return isAuthorized
    && record.runtime.providerReadiness?.status === PROVIDER_READINESS_STATUS.ready;
}

/**
 * 把页面导入表单收敛为 SourceManagementRuntime 冻结输入。
 * 纯函数: 返回新对象，不修改表单；不构造 Package、Definition、授权或 Repository 对象。
 * 失败路径: 输入不是对象时使用空字段，让 Runtime 输入适配器返回标准 validation。
 *
 * @param {*} input 设置页导入表单候选。
 * @returns {object} 只包含 name、version、importMethod、remoteUrl 和 scriptContent 的输入。
 */
function createImportInput(input) {
  // 类型: object。
  // 作用: 非对象表单使用空对象，避免 service 自行伪造领域保存数据。
  const safeInput = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  return {
    name: typeof safeInput.name === 'string' && safeInput.name !== '' ? safeInput.name : '未命名数据源',
    version: typeof safeInput.version === 'string' && safeInput.version !== ''
      ? safeInput.version
      : DEFAULT_IMPORTED_VERSION,
    importMethod: safeInput.importMethod,
    remoteUrl: typeof safeInput.remoteUrl === 'string' ? safeInput.remoteUrl : '',
    scriptContent: typeof safeInput.scriptContent === 'string' ? safeInput.scriptContent : ''
  };
}

/**
 * 触发一次文本文件下载。
 * 副作用: 创建 Blob、对象 URL 和隐藏链接；点击后立即移除链接并释放 URL。
 * 成功路径: 浏览器接收用户发起的下载。
 * 失败路径: Blob、DOM 或下载调用抛错时 finally 仍清理已经创建的资源，错误继续向页面传播。
 *
 * @param {string} content 待下载文本内容。
 * @param {string} fileName 浏览器下载文件名。
 * @param {string} mimeType Blob MIME 类型。
 * @returns {void} 下载通过浏览器副作用完成。
 */
function triggerTextDownload(content, fileName, mimeType) {
  // 类型: Blob。
  // 作用: 把 Runtime 返回的脚本文本或最小脚本包包装为浏览器下载对象。
  const contentBlob = new Blob([content], { type: mimeType });

  // 类型: string。
  // 作用: 保存只在本次下载期间有效的对象 URL。
  const downloadUrl = URL.createObjectURL(contentBlob);

  // 类型: HTMLAnchorElement。
  // 作用: 创建一次性下载入口，页面组件不操作 DOM。
  const downloadLink = document.createElement('a');

  try {
    // 副作用: 配置下载地址和文件名，并把临时链接加入当前文档后触发点击。
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
  } finally {
    // 条件分支: 下载链接已经插入文档时进入。
    // 执行内容: 无论点击成功或失败都移除临时 DOM 节点。
    if (downloadLink.parentNode) {
      downloadLink.parentNode.removeChild(downloadLink);
    }
    // 副作用: 释放本次 Blob 对象 URL，避免连续导出积累浏览器内存。
    URL.revokeObjectURL(downloadUrl);
  }
}

/**
 * 读取设置页响应式 SourceManagerState。
 * 纯函数: 返回 store 当前完整投影引用；调用方不得直接修改，业务写入必须调用本 service 异步操作。
 *
 * @returns {object} 当前完整 SourceManagerState 页面投影。
 */
export function getSourceManagerState() {
  return settingsStore.sourceManager;
}

/**
 * 按来源读取未软隐藏数据源记录。
 * 纯函数: 从 store 当前投影派生新数组，不改变 SourceManager 权威顺序。
 *
 * @param {string} sourceKindFilter all、system 或 custom。
 * @returns {Array<object>} 当前可见记录。
 */
export function getSourceRecords(sourceKindFilter = SOURCE_KIND_FILTER.all) {
  return getVisibleSourceRecords(getSourceManagerState(), sourceKindFilter);
}

/**
 * 按 id 读取单条数据源记录。
 * 纯函数: 可以返回软隐藏系统源，供恢复流程定位；不存在时返回 null。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {object|null} 匹配记录或 null。
 */
export function getSourceRecord(sourceId) {
  return findSourceRecordInState(getSourceManagerState(), sourceId);
}

/**
 * 读取设置页数据源摘要。
 * 纯函数: 只计算可见记录的启用数量、可运行数量、默认源和缓存总量，不保存派生字段。
 *
 * @returns {object} enabledCount、runnableCount、totalCount、defaultSource 和 totalCacheBytes 摘要。
 */
export function getSourceSummary() {
  // 类型: Array<object>。
  // 作用: 摘要只统计当前未软隐藏记录。
  const visibleRecords = getSourceRecords(SOURCE_KIND_FILTER.all);

  // 类型: string。
  // 作用: 从完整投影读取唯一默认源身份。
  const defaultSourceId = getSourceManagerState().defaultSourceId;

  return {
    enabledCount: visibleRecords.filter(record => record.runtime.enabled).length,
    runnableCount: visibleRecords.filter(record => isSourceRecordRunnable(record)).length,
    totalCount: visibleRecords.length,
    defaultSource: visibleRecords.find(record => record.definition.id === defaultSourceId) || null,
    totalCacheBytes: visibleRecords.reduce(
      (totalBytes, record) => totalBytes + Number(record.cache.totalCacheBytes || 0),
      0
    )
  };
}

/**
 * 读取来源分类数量。
 * 纯函数: 从当前可见记录实时派生，不保存重复计数状态。
 *
 * @returns {object} all、system 和 custom 三类数量。
 */
export function getSourceKindCounts() {
  // 类型: Array<object>。
  // 作用: 三类计数共享同一可见记录快照。
  const allRecords = getSourceRecords(SOURCE_KIND_FILTER.all);

  return {
    all: allRecords.length,
    system: allRecords.filter(record => record.definition.sourceKind === SOURCE_KIND.system).length,
    custom: allRecords.filter(record => record.definition.sourceKind === SOURCE_KIND.custom).length
  };
}

/**
 * 读取数据源已启用能力标签。
 * 纯函数: 只返回 capabilities 中值为 true 的统一能力定义。
 *
 * @param {object} capabilities 数据源页面能力布尔映射。
 * @returns {Array<object>} 按统一展示顺序排列的能力定义。
 */
export function getEnabledCapabilities(capabilities) {
  // 类型: object。
  // 作用: 非对象能力输入使用空对象，避免详情渲染读取异常。
  const safeCapabilities = capabilities && typeof capabilities === 'object' ? capabilities : {};

  return CAPABILITY_DEFINITIONS.filter(definition => Boolean(safeCapabilities[definition.key]));
}

/**
 * 读取数据源当前有效授权状态。
 * 纯函数: 使用 SourceManager 已验证的 runtime.currentScriptHash，不读取 Repository 脚本文本或旧 mock 字段。
 *
 * @param {object|null} record SourceManagerState 轻量记录。
 * @returns {object} effectiveStatus、isAuthorized、requiresAuthorization、reason 和 currentScriptHash。
 */
export function getSourceAuthorizationState(record) {
  return evaluateSourceAuthorizationFingerprint({
    sourceKind: record?.definition?.sourceKind || '',
    version: record?.definition?.version || '',
    currentScriptHash: record?.runtime?.currentScriptHash || '',
    authorization: record?.authorization || null
  });
}

/**
 * 判断启用前是否需要用户确认自定义脚本风险。
 * 纯函数: 只读取统一授权评估，不复制版本或指纹规则。
 *
 * @param {object|null} record SourceManagerState 轻量记录。
 * @returns {boolean} true 必须先授权，false 可直接启用或记录不存在。
 */
export function requiresSourceAuthorization(record) {
  // 条件分支: 记录不存在时进入。
  // 执行内容: 返回 false，由调用方按未命中流程处理，不打开空授权弹窗。
  if (!record) return false;

  return getSourceAuthorizationState(record).requiresAuthorization;
}

/**
 * 授权当前自定义源脚本版本与指纹。
 * 副作用: 委托唯一管理 Runtime 进入 FIFO，由 SourceManager 原子保存授权快照；本函数不写 store。
 * 成功路径: 返回提交后投影中的目标记录。
 * 失败路径: 记录不存在时返回 null；Runtime validation、领域事务或补偿失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @param {boolean} [enableAfterAuthorization=false] true 在同一 Runtime 意图中授权并启用，false 只保存授权。
 * @returns {Promise<object|null>} 授权后的记录或 null。
 */
export async function authorizeSource(sourceId, enableAfterAuthorization = false) {
  // 条件分支: 当前页面投影没有目标记录时进入。
  // 执行内容: 保持旧页面未命中语义，不向 Runtime 提交空目标。
  if (!getSourceRecord(sourceId)) return null;

  // 类型: object。
  // 作用: Runtime 返回 SourceManager 提交后的完整隔离投影；订阅链负责更新 store。
  const committedState = await sourceManagementRuntimeInstance.authorizeSource({
    sourceId,
    authorizedAt: new Date().toISOString(),
    enableAfterAuthorization
  });

  return findSourceRecordInState(committedState, sourceId);
}

/**
 * 撤销自定义源运行授权并关闭该源。
 * 副作用: 委托 Runtime 先释放 Host，再提交授权、启用和默认源交接事务；本函数不改投影字段。
 * 成功路径: 返回 true。
 * 失败路径: 记录不存在或不是自定义源时返回 false；Runtime 失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @param {string|undefined} fallbackSourceId 用户选择的接替源 id；空字符串表示明确清空，省略时由 Runtime 自动交接。
 * @returns {Promise<boolean>} 是否完成撤销。
 */
export async function revokeSourceAuthorization(sourceId, fallbackSourceId) {
  // 类型: object|null。
  // 作用: 使用当前投影执行页面兼容的未命中和系统源快速判断。
  const record = getSourceRecord(sourceId);

  // 条件分支: 记录不存在或不是自定义源时进入。
  // 执行内容: 不提交无意义 Runtime 意图并返回 false。
  if (!record || record.definition.sourceKind !== SOURCE_KIND.custom) return false;

  await sourceManagementRuntimeInstance.revokeSourceAuthorization(
    createDefaultSourceHandoffCommand({ sourceId }, fallbackSourceId)
  );
  return true;
}

/**
 * 设置数据源启用状态。
 * 副作用: 委托 Runtime 协调 SourceManager 事务、可信 Host 启停和失败补偿；本函数不直接写 runtime.enabled。
 * 成功路径: 返回提交后投影中的目标记录。
 * 失败路径: 记录不存在时返回 null；未授权启用同步形成明确错误；Runtime 失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @param {boolean} enabled true 启用并按需启动可信 Provider，false 关闭并释放运行实例。
 * @param {string|undefined} fallbackSourceId 关闭默认源时的接替源 id；空字符串表示明确清空，省略时由 Runtime 自动交接。
 * @returns {Promise<object|null>} 启停后的记录或 null。
 */
export async function setSourceEnabled(sourceId, enabled, fallbackSourceId) {
  // 类型: object|null。
  // 作用: 从当前完整投影定位目标，保持页面现有 null 未命中返回。
  const record = getSourceRecord(sourceId);

  // 条件分支: 当前投影没有目标记录时进入。
  // 执行内容: 返回 null，不创建伪造记录或兼容身份。
  if (!record) return null;

  // 条件分支: 页面尝试启用当前授权无效的自定义源时进入。
  // 执行内容: 在提交 Runtime 意图前保留现有明确提示；Runtime/Manager 仍执行最终领域校验。
  if (enabled === true && requiresSourceAuthorization(record)) {
    throw new Error('当前自定义数据源尚未获得用户运行授权');
  }

  // 类型: object。
  // 作用: 保存 Runtime 完成 Host 补偿后的最终稳定投影。
  const committedState = await sourceManagementRuntimeInstance.setSourceEnabled(
    createDefaultSourceHandoffCommand({ sourceId, enabled }, fallbackSourceId)
  );
  return findSourceRecordInState(committedState, sourceId);
}

/**
 * 设置唯一默认数据源。
 * 副作用: 委托 SourceManagementRuntime 和 SourceManager 更新 Preferences；本函数不写 defaultSourceId。
 * 成功路径: 目标可见且通过全局可运行门禁时返回 true。
 * 失败路径: 目标不存在、软隐藏或不可运行时返回 false；Runtime 事务失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<boolean>} 是否完成默认源切换。
 */
export async function setDefaultSource(sourceId) {
  // 类型: object|null。
  // 作用: 从可见记录定位目标，阻止软隐藏系统源通过直接调用成为默认源。
  const record = getSourceRecords(SOURCE_KIND_FILTER.all)
    .find(candidateRecord => candidateRecord.definition.id === sourceId) || null;

  // 条件分支: 目标不存在或未通过授权与 Provider 就绪门禁时进入。
  // 执行内容: 返回 false，避免默认源指向只有启用意愿但不能执行的记录。
  if (!isSourceRecordRunnable(record)) return false;

  await sourceManagementRuntimeInstance.setDefaultSource(sourceId);
  return true;
}

/**
 * 检测单个数据源健康状态。
 * 副作用: Runtime 委托 SourceManager 发布 checking 和最终投影，并通过可信 Host 执行健康端口。
 * 成功路径: 返回最终投影中的目标记录。
 * 失败路径: 记录不存在或不可运行时返回 null；检测失败按 SourceManager 规则收敛或 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<object|null>} 检测后的记录或 null。
 */
export async function checkSource(sourceId) {
  // 类型: object|null。
  // 作用: 使用可见记录与统一门禁确定当前健康检测目标。
  const record = getSourceRecords(SOURCE_KIND_FILTER.all)
    .find(candidateRecord => candidateRecord.definition.id === sourceId) || null;

  // 条件分支: 目标不存在或不可运行时进入。
  // 执行内容: 返回 null，不向 Runtime 和 Host 提交未就绪 Provider 的虚假检测。
  if (!isSourceRecordRunnable(record)) return null;

  // 类型: object。
  // 作用: 保存健康端口完成并收敛 checking 状态后的最终完整投影。
  const committedState = await sourceManagementRuntimeInstance.checkSource(sourceId);
  return findSourceRecordInState(committedState, sourceId);
}

/**
 * 检测全部有效启用数据源。
 * 副作用: 委托 Runtime 串行管理意图，SourceManager 负责 checkingAll 和逐源过渡投影发布。
 * 成功路径: 返回最终投影中当前可见且仍具备全局可运行资格的记录数组。
 * 失败路径: Runtime 或端口失败继续 reject，store 由状态发布链保留已收敛投影。
 *
 * @returns {Promise<Array<object>>} 检测后的可见可运行记录。
 */
export async function checkAllSources() {
  // 类型: object。
  // 作用: 保存全部启用源检测完成后的最终完整投影。
  const committedState = await sourceManagementRuntimeInstance.checkAllSources();
  return getVisibleSourceRecords(committedState, SOURCE_KIND_FILTER.all)
    .filter(record => isSourceRecordRunnable(record));
}

/**
 * 检查在线导入源是否有可用更新。
 * 副作用: 委托 Runtime 和 SourceManager 使用标准更新检测端口发布过渡及稳定投影。
 * 成功路径: 返回最终投影中的目标记录。
 * 失败路径: 记录不存在或不是 remote 时返回 null；端口或事务失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<object|null>} 更新检测后的记录或 null。
 */
export async function checkSourceUpdate(sourceId) {
  // 类型: object|null。
  // 作用: 只允许当前远程导入记录进入更新检测端口。
  const record = getSourceRecord(sourceId);

  // 条件分支: 目标不存在或不是远程导入时进入。
  // 执行内容: 返回 null，文件和文本导入不伪造在线更新能力。
  if (!record || record.definition.importMethod !== IMPORT_METHOD.remote) return null;

  // 类型: object。
  // 作用: 保存更新检测端口完成并收敛 checkingUpdate 后的最终投影。
  const committedState = await sourceManagementRuntimeInstance.checkSourceUpdate(sourceId);
  return findSourceRecordInState(committedState, sourceId);
}

/**
 * 应用用户已确认的受审在线更新候选。
 * 副作用: Runtime 读取候选、释放 Host、提交 Package/Definition 事务并按新投影恢复运行源。
 * 成功路径: 返回更新后的目标记录。
 * 失败路径: 目标不存在或页面投影没有可用更新时返回 null；候选或补偿失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<object|null>} 更新后的记录或 null。
 */
export async function applySourceUpdate(sourceId) {
  // 类型: object|null。
  // 作用: 使用页面最近投影保留“没有更新不执行”的现有交互语义。
  const record = getSourceRecord(sourceId);

  // 条件分支: 记录不存在或没有可用更新时进入。
  // 执行内容: 返回 null，不提前读取更新候选。
  if (!record || record.runtime.updateAvailable !== true) return null;

  // 类型: object。
  // 作用: 保存更新候选应用、授权收敛和 Host 恢复完成后的最终投影。
  const committedState = await sourceManagementRuntimeInstance.applySourceUpdate(sourceId);
  return findSourceRecordInState(committedState, sourceId);
}

/**
 * 导入一个自定义数据源。
 * 副作用: 委托 Runtime 输入适配器构造领域命令，再由 SourceManager 原子保存 Package、Definition、Preferences 和 settings。
 * 成功路径: 返回提交后新增的 SourceRecord。
 * 失败路径: 输入、重复身份或 Repository 事务失败继续 reject；本函数不执行 scriptContent。
 *
 * @param {object} input 文件、远程连接或粘贴文本表单输入。
 * @returns {Promise<object>} 新增 SourceRecord。
 */
export async function importCustomSource(input) {
  // 类型: Set<string>。
  // 作用: 保存提交前真实记录身份，用于从最终投影定位本次新增记录，不依赖计数器或时间型 id。
  const existingSourceIds = new Set(getSourceManagerState().records.map(record => record.definition.id));

  // 类型: object。
  // 作用: 保存导入事务提交后的完整隔离投影；订阅链同步更新 store。
  const committedState = await sourceManagementRuntimeInstance.importSource(createImportInput(input));

  // 类型: object|null。
  // 作用: 使用提交前后身份差集定位适配器生成的内容寻址 sourceId。
  const importedRecord = committedState.records.find(
    record => !existingSourceIds.has(record.definition.id)
  ) || null;

  // 条件分支: 事务成功但最终投影没有新增身份时进入。
  // 执行内容: 抛出一致性错误，禁止页面把未知旧记录显示成导入成功。
  if (!importedRecord) {
    throw new Error('数据源导入完成但最终投影没有新增记录');
  }

  return importedRecord;
}

/**
 * 删除单个数据源。
 * 副作用: 复用批量删除 Runtime 事务，系统源软隐藏，自定义源物理删除并清理私有空间。
 * 成功路径: 实际删除目标后返回 true，目标不存在时返回 false。
 * 失败路径: Runtime 事务、Host 释放或补偿失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @param {string|undefined} fallbackSourceId 删除默认源时的接替源 id；空字符串表示明确清空，省略时由 Runtime 自动交接。
 * @returns {Promise<boolean>} 是否实际删除一条记录。
 */
export async function deleteSource(sourceId, fallbackSourceId) {
  // 类型: object。
  // 作用: 保存统一批量事务返回的实际删除分类数量。
  const result = await deleteSources([sourceId], fallbackSourceId);
  return result.deletedCount === 1;
}

/**
 * 批量删除数据源。
 * 副作用: 委托 Runtime 捕获并释放运行 Host，再由 SourceManager 一笔事务完成软隐藏、物理删除和默认源交接。
 * 成功路径: 返回按操作前有效目标计算的删除数量。
 * 失败路径: 没有有效可见目标时返回零计数；Runtime 事务或补偿失败继续 reject。
 *
 * @param {Array<string>} sourceIds 待删除数据源 id。
 * @param {string|undefined} fallbackSourceId 整批包含默认源时的接替源 id；空字符串表示明确清空，省略时由 Runtime 自动交接。
 * @returns {Promise<object>} deletedCount、systemCount 和 customCount。
 */
export async function deleteSources(sourceIds, fallbackSourceId) {
  // 类型: Set<string>。
  // 作用: 保存规范化用户选择，给操作前记录匹配提供稳定集合。
  const sourceIdSet = new Set(normalizeSourceIds(sourceIds));

  // 类型: Array<object>。
  // 作用: 只统计当前可见且真实存在的目标，已软隐藏系统源不重复计数。
  const recordsToDelete = getSourceRecords(SOURCE_KIND_FILTER.all)
    .filter(record => sourceIdSet.has(record.definition.id));

  // 类型: object。
  // 作用: 在提交前冻结页面反馈需要的数量；Runtime 返回投影不携带操作计数。
  const result = {
    deletedCount: recordsToDelete.length,
    systemCount: recordsToDelete.filter(
      record => record.definition.sourceKind === SOURCE_KIND.system
    ).length,
    customCount: recordsToDelete.filter(
      record => record.definition.sourceKind === SOURCE_KIND.custom
    ).length
  };

  // 条件分支: 没有真实删除目标时进入。
  // 执行内容: 返回零计数，不向 Runtime 提交空批量命令。
  if (result.deletedCount === 0) return result;

  await sourceManagementRuntimeInstance.deleteSources(
    createDefaultSourceHandoffCommand(
      { sourceIds: recordsToDelete.map(record => record.definition.id) },
      fallbackSourceId
    )
  );
  return result;
}

/**
 * 读取被软隐藏系统源记录。
 * 纯函数: 按 removedSystemSourceIds 顺序映射记录，不修改软隐藏集合。
 *
 * @returns {Array<object>} 当前可以恢复的系统源记录。
 */
export function getRemovedSystemSources() {
  // 类型: object。
  // 作用: 共享同一完整投影读取软隐藏顺序和记录集合。
  const managerState = getSourceManagerState();

  return managerState.removedSystemSourceIds
    .map(sourceId => findSourceRecordInState(managerState, sourceId))
    .filter(record => Boolean(record));
}

/**
 * 恢复所选软隐藏系统源。
 * 副作用: 委托 Runtime 移除软隐藏 id，并按新投影启动仍启用的可信系统源。
 * 成功路径: 返回实际从 removedSystemSourceIds 移除的数量。
 * 失败路径: 没有有效选择时返回 0；Runtime 或 Host 补偿失败继续 reject。
 *
 * @param {Array<string>} sourceIds 要恢复的系统源 id。
 * @returns {Promise<number>} 实际恢复数量。
 */
export async function restoreSystemSources(sourceIds) {
  // 类型: Array<string>。
  // 作用: 只保留当前真实软隐藏 id，避免把普通记录误报为已恢复。
  const removedSourceIds = getSourceManagerState().removedSystemSourceIds;

  // 类型: Array<string>。
  // 作用: 保存去重后仍属于当前软隐藏集合的有效恢复目标。
  const effectiveSourceIds = normalizeSourceIds(sourceIds)
    .filter(sourceId => removedSourceIds.includes(sourceId));

  // 条件分支: 没有有效恢复目标时进入。
  // 执行内容: 返回 0，不向 Runtime 提交空数组。
  if (effectiveSourceIds.length === 0) return 0;

  // 类型: object。
  // 作用: 保存软隐藏集合提交和可信 Host 恢复完成后的最终投影。
  const committedState = await sourceManagementRuntimeInstance.restoreSystemSources(effectiveSourceIds);
  return effectiveSourceIds.filter(
    sourceId => !committedState.removedSystemSourceIds.includes(sourceId)
  ).length;
}

/**
 * 清理数据源临时缓存。
 * 副作用: Runtime 释放运行 Host，SourceManager 清理 cache 与 diagnostics 并发布新摘要，再按规则恢复可信源。
 * 成功路径: 目标存在且清理与运行恢复完成后返回 true。
 * 失败路径: 目标不存在时返回 false；Runtime 事务、Host 释放或补偿失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<boolean>} 目标存在并完成清理时为 true，不存在时为 false。
 */
export async function clearTemporarySourceCache(sourceId) {
  // 条件分支: 当前投影没有目标记录时进入。
  // 执行内容: 返回 false，不创建未知私有空间命名空间。
  if (!getSourceRecord(sourceId)) return false;

  await sourceManagementRuntimeInstance.clearTemporarySourceCache(sourceId);
  return true;
}

/**
 * 清理数据源全部运行缓存并保留普通 settings。
 * 副作用: Runtime 释放 Host，SourceManager 清理 credentials、session、cache 和 diagnostics，再恢复可信源。
 * 成功路径: 目标存在且清理与运行恢复完成后返回 true。
 * 失败路径: 目标不存在时返回 false；Runtime 事务、Host 释放或补偿失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<boolean>} 目标存在并完成清理时为 true，不存在时为 false。
 */
export async function clearAllSourceCache(sourceId) {
  // 条件分支: 当前投影没有目标记录时进入。
  // 执行内容: 返回 false，不创建未知私有空间命名空间。
  if (!getSourceRecord(sourceId)) return false;

  await sourceManagementRuntimeInstance.clearAllSourceCache(sourceId);
  return true;
}

/**
 * 下载单个数据源脚本。
 * 副作用: 先通过 Runtime 只读 Repository 一致快照，再在本模块创建和释放浏览器下载资源。
 * 成功路径: 触发 JavaScript 文件下载并返回 true。
 * 失败路径: 目标不存在时返回 false；Runtime 查询或浏览器下载失败继续 reject。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<boolean>} 是否成功触发下载。
 */
export async function downloadSourceScript(sourceId) {
  // 条件分支: 当前投影没有目标记录时进入。
  // 执行内容: 返回 false，不创建空脚本下载。
  if (!getSourceRecord(sourceId)) return false;

  // 类型: object。
  // 作用: 保存 SourceManager 从 Repository 一致读取的最小脚本包。
  const exportBundle = await sourceManagementRuntimeInstance.createSourceExportBundle({
    sourceIds: [sourceId],
    exportedAt: new Date().toISOString()
  });

  // 类型: object|null。
  // 作用: 单项导出只采用与目标 id 完全匹配的脚本条目。
  const sourceScript = exportBundle.sources.find(source => source.id === sourceId) || null;

  // 条件分支: Runtime 返回包没有目标脚本时进入。
  // 执行内容: 返回 false，不下载空内容或其他数据源脚本。
  if (!sourceScript) return false;

  triggerTextDownload(
    sourceScript.scriptContent,
    `${sourceScript.id}-${sourceScript.version}.js`,
    SOURCE_SCRIPT_MIME_TYPE
  );
  return true;
}

/**
 * 批量下载数据源最小脚本包。
 * 副作用: Runtime 只读 Repository 一致快照，本模块把返回包序列化并管理一次性浏览器下载资源。
 * 成功路径: 至少一条有效脚本时下载 JSON 包并返回实际数量。
 * 失败路径: 输入为空或没有有效脚本时返回 0；Runtime 查询或浏览器下载失败继续 reject。
 *
 * @param {Array<string>} sourceIds 待导出数据源 id。
 * @returns {Promise<number>} 实际导出脚本数量。
 */
export async function downloadSourceScripts(sourceIds) {
  // 类型: Array<string>。
  // 作用: 去除非法值与重复 id，保持用户首次选择顺序。
  const normalizedSourceIds = normalizeSourceIds(sourceIds);

  // 条件分支: 输入没有有效 id 时进入。
  // 执行内容: 返回 0，不向 Runtime 提交空导出命令。
  if (normalizedSourceIds.length === 0) return 0;

  // 类型: object。
  // 作用: 保存 Repository 一致快照生成的正式最小导出包。
  const exportBundle = await sourceManagementRuntimeInstance.createSourceExportBundle({
    sourceIds: normalizedSourceIds,
    exportedAt: new Date().toISOString()
  });

  // 条件分支: 最终导出包没有任何有效脚本时进入。
  // 执行内容: 返回 0，不创建空下载文件。
  if (exportBundle.sources.length === 0) return 0;

  // 类型: string。
  // 作用: 使用用户操作时刻生成独立文件名；业务导出时间仍以 exportBundle.exportedAt 为准。
  const exportFileName = `${SOURCE_EXPORT_FILE_PREFIX}-${Date.now()}.json`;

  triggerTextDownload(
    JSON.stringify(exportBundle, null, JSON_INDENT_SPACES),
    exportFileName,
    SOURCE_PACKAGE_MIME_TYPE
  );
  return exportBundle.sources.length;
}
