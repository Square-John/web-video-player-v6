/*
  settingsService.js 模块说明

  - 文件职责:
      封装设置页数据源筛选、启停、检测、默认源、授权、更新、导入、删除、恢复、缓存和导出操作。
      统一修改 settingsStore，避免列表、详情和对话框直接操作共享状态。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      settingsStore: 自定义 Vuex 模块外的响应式内存 store，保存设置页唯一数据源状态。
      sourceOperationScenarios: 自定义数据，提供可重复的健康检查和在线更新 mock 结果。
      SOURCE_KIND、HEALTH_STATUS、AUTHORIZATION_STATUS、IMPORT_METHOD: 自定义配置，提供数据源领域受控枚举。
      createSourceAuthorizationState、evaluateSourceAuthorization、normalizeSourceScriptContent: 自定义工具函数，提供授权状态和脚本文本统一规则。
      CAPABILITY_DEFINITIONS: 自定义配置，提供页面能力读取顺序和文案。

  - 模块级常量:
      SOURCE_KIND_FILTER: object，数据源来源筛选枚举。
      MOCK_OPERATION_DELAY_MS: number，模拟操作反馈延时。
      CUSTOM_SOURCE_ID_PREFIX: string，自定义数据源 id 前缀。
      DEFAULT_IMPORTED_VERSION: string，导入脚本没有版本时的默认版本。
      SOURCE_EXPORT_SCHEMA_VERSION: string，批量脚本包结构版本。
      SOURCE_EXPORT_FILE_PREFIX: string，批量脚本包文件名前缀。
      SOURCE_SCRIPT_MIME_TYPE: string，单脚本下载 MIME 类型。
      SOURCE_PACKAGE_MIME_TYPE: string，批量脚本包下载 MIME 类型。
      JSON_INDENT_SPACES: number，批量脚本包 JSON 缩进空格数。

  - 模块级变量:
      importedSourceSequence: number，当前页面生命周期内的自定义源递增序号。

  - 模块级辅助函数:
      waitForMockOperation()
          - params:
              无
          - return:
              Promise<void>，模拟延时结束后完成。
          - description:
              给检测和更新提供可见过渡，不发起真实请求。
      createNextCustomSourceId()
          - params:
              无
          - return:
              string，不与当前记录冲突的自定义数据源 id。
          - description:
              集中生成导入数据源标识，避免组件拼接 id。
      selectFallbackSource(excludedSourceIds)
          - params:
              -- excludedSourceIds: string|Array<string>，不能继续作为默认源的单个或多个数据源 id。
          - return:
              object|null，可作为回退默认源的记录。
          - description:
              从未删除且已启用的数据源中选择稳定回退项。
      normalizeSourceIds(sourceIds)
          - params:
              -- sourceIds: string|Array<string>，待操作数据源 id。
          - return:
              Array<string>，去空、去重后的稳定 id 数组。
          - description:
              给批量删除和导出提供统一输入边界。
      triggerTextDownload(content, fileName, mimeType)
          - params:
              -- content: string，待下载文本内容。
              -- fileName: string，浏览器下载文件名。
              -- mimeType: string，Blob MIME 类型。
          - return:
              void，无业务返回值。
          - description:
              集中管理 Blob、对象 URL 和隐藏链接生命周期。

  - 模块级类:
      无

  - 对外导出:
      枚举常量和数据源管理操作函数，供设置页组件使用。
*/

import {
  // 导入来源: ../store/settingsStore。
  // 导入内容: settingsStore 设置页共享响应式内存状态。
  // 文件作用: 所有数据源操作都通过 service 修改同一份 sourceManager 状态。
  settingsStore
} from '../store/settingsStore';

import {
  // 导入来源: ../data/settings/source-manager.mock。
  // 导入内容: sourceOperationScenarios 数据源操作模拟场景。
  // 文件作用: 健康检查和更新检查读取稳定结果，不硬编码具体数据源分支。
  sourceOperationScenarios
} from '../data/settings/source-manager.mock';

import {
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 运行授权状态枚举。
  // 文件作用: 统一授权、待授权和撤销授权状态切换。
  AUTHORIZATION_STATUS,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 三态健康枚举。
  // 文件作用: 统一单项和批量健康检测状态。
  HEALTH_STATUS,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 区分系统、文件、在线和文本导入流程。
  IMPORT_METHOD,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 区分系统源和自定义源的授权、删除与恢复规则。
  SOURCE_KIND
} from '../config/source-manager.config.js';

import {
  // 导入来源: ../utils/sourceAuthorization.js。
  // 导入内容: createSourceAuthorizationState 授权状态构造函数。
  // 文件作用: 授权时捕获当前版本和脚本指纹，导入时创建完整待授权状态。
  createSourceAuthorizationState,
  // 导入来源: ../utils/sourceAuthorization.js。
  // 导入内容: evaluateSourceAuthorization 授权有效性评估函数。
  // 文件作用: 页面展示和启用校验共享同一版本与内容指纹规则。
  evaluateSourceAuthorization,
  // 导入来源: ../utils/sourceAuthorization.js。
  // 导入内容: normalizeSourceScriptContent 脚本文本规范化函数。
  // 文件作用: 导入和在线更新写入脚本前统一跨平台换行符。
  normalizeSourceScriptContent
} from '../utils/sourceAuthorization.js';

import {
  // 导入来源: ../utils/settingsDisplay。
  // 导入内容: CAPABILITY_DEFINITIONS 页面能力定义。
  // 文件作用: 创建导入记录时按统一能力键建立能力对象。
  CAPABILITY_DEFINITIONS
} from '../utils/settingsDisplay';

// 再导出来源: ../config/source-manager.config.js。
// 导出内容: 数据源类型、健康状态、授权状态和导入方式枚举。
// 使用场景: 保持现有设置组件从 settingsService 读取领域枚举的稳定入口。
export { AUTHORIZATION_STATUS, HEALTH_STATUS, IMPORT_METHOD, SOURCE_KIND } from '../config/source-manager.config.js';

// 类型: object。
// 作用: 统一数据源来源筛选值，避免组件散落 all、system 和 custom 魔法字符串。
export const SOURCE_KIND_FILTER = Object.freeze({
  // 类型: string；作用: 查询全部未删除数据源记录。
  all: 'all',
  // 类型: string；作用: 只查询系统内置数据源记录。
  system: 'system',
  // 类型: string；作用: 只查询用户导入数据源记录。
  custom: 'custom'
});

// 类型: number。
// 作用: 控制 mock 检测和更新过渡时长，让用户能观察到检测中状态；不影响真实网络超时。

const MOCK_OPERATION_DELAY_MS = 420;

// 类型: string。
// 作用: 给当前页面新导入的自定义源生成可识别且不与系统源混淆的 id。

const CUSTOM_SOURCE_ID_PREFIX = 'custom-imported';

// 类型: string。
// 作用: 导入表单没有显式版本时提供稳定版本，避免列表和详情出现空版本。

const DEFAULT_IMPORTED_VERSION = 'v1.0.0';

// 类型: string。
// 作用: 标识批量数据源脚本包结构版本，供未来导入器判断兼容性。

const SOURCE_EXPORT_SCHEMA_VERSION = '1.0.0';

// 类型: string。
// 作用: 统一批量数据源脚本包文件名前缀，避免页面组件拼接下载名称。

const SOURCE_EXPORT_FILE_PREFIX = 'source-scripts';

// 类型: string。
// 作用: 定义单个 JavaScript 数据源脚本下载 MIME 类型。

const SOURCE_SCRIPT_MIME_TYPE = 'text/javascript;charset=utf-8';

// 类型: string。
// 作用: 定义批量数据源脚本包 JSON 下载 MIME 类型。

const SOURCE_PACKAGE_MIME_TYPE = 'application/json;charset=utf-8';

// 类型: number。
// 作用: 控制导出 JSON 的可读缩进，不在序列化调用处散落数字字面值。

const JSON_INDENT_SPACES = 2;

// 类型: number。
// 作用: 记录当前页面生命周期内的自定义源递增序号，生成唯一 mock id。

let importedSourceSequence = 1;

/**
 * 等待一次 mock 操作过渡。
 *
 * @returns {Promise<void>} 模拟延时结束后的 Promise。
 * 副作用: 创建一次定时器并延迟 Promise 兑现，不修改 Store、路由或数据源记录。
 */
function waitForMockOperation() {
  // 返回值类型: Promise<void>。
  // 作用: 把统一模拟延时包装成可 await 的异步操作。
  return new Promise((resolve) => {
    // 副作用: 注册一次性计时器。
    // 影响范围: 只延后当前 mock 操作完成状态，不保存计时器引用或持续监听。
    window.setTimeout(resolve, MOCK_OPERATION_DELAY_MS);
  });
}

/**
 * 创建不与当前数据源冲突的自定义源 id。
 *
 * @returns {string} 当前设置页状态中不存在的自定义源 id。
 * 副作用: 递增模块级 importedSourceSequence，确保同一运行周期内生成的自定义源 id 不冲突。
 */
function createNextCustomSourceId() {
  // 类型: string。
  // 作用: 保存当前递增序号对应的候选 id，后续循环检查是否冲突。

  let candidateId = `${CUSTOM_SOURCE_ID_PREFIX}-${importedSourceSequence}`;

  // 循环类型: while。
  // 初始值: 当前 importedSourceSequence 生成的 candidateId。
  // 终止条件: 当前记录中没有相同数据源 id。
  // 循环作用: 避免用户重复导入后产生列表 key 和详情路由冲突。
  while (getSourceRecord(candidateId)) {
    // 类型: number。
    // 作用: 递增自定义源序号，给下一次候选 id 提供新编号。
    importedSourceSequence += 1;

    // 类型: string。
    // 作用: 使用新序号覆盖候选 id，继续检查唯一性。
    candidateId = `${CUSTOM_SOURCE_ID_PREFIX}-${importedSourceSequence}`;
  }

  // 类型: number。
  // 作用: 为下一次导入预留后续序号，避免重复使用当前候选值。
  importedSourceSequence += 1;

  // 返回值类型: string。
  // 作用: 返回可以安全写入 records 和详情路由的数据源 id。
  return candidateId;
}

/**
 * 选择默认源回退记录。
 * 纯读取函数: 不修改 store，只从当前未删除且已启用记录中选择第一项。
 *
 * @param {string|Array<string>} excludedSourceIds 需要排除的单个或多个数据源 id。
 * @returns {object|null} 可用回退记录；没有候选时返回 null。
 * 纯函数: selectFallbackSource 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
function selectFallbackSource(excludedSourceIds) {
  // 类型: Set<string>。
  // 作用: 把单个或多个排除 id 转换为集合，支持默认源批量删除交接。

  const excludedSourceIdSet = new Set(normalizeSourceIds(excludedSourceIds));

  // 类型: Array<object>。
  // 作用: 读取当前用户仍可见的数据源，排除被软删除的系统源。

  const visibleRecords = getSourceRecords(SOURCE_KIND_FILTER.all);

  // 返回值类型: object|null。
  // 作用: 返回第一个已启用且不是当前源的记录，保证默认源切换结果稳定。
  return visibleRecords.find((record) => {
    // 返回 true 表示当前记录可以接替默认源。
    return !excludedSourceIdSet.has(record.definition.id) && record.runtime.enabled;
  }) || null;
}

/**
 * 规范化数据源 id 输入。
 *
 * @param {string|Array<string>} sourceIds 单个或多个数据源 id。
 * @returns {Array<string>} 去空、去重后的稳定数据源 id 数组。
 * 纯函数: normalizeSourceIds 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
function normalizeSourceIds(sourceIds) {
  // 类型: Array<string>。
  // 作用: 把单个 id 和数组输入统一成后续循环可以消费的数组。

  const sourceIdList = Array.isArray(sourceIds) ? sourceIds : [sourceIds];

  // 循环类型: Array.prototype.filter + Set 去重。
  // 初始值: sourceIdList 第一项。
  // 终止条件: 所有输入 id 完成类型和空值检查。
  // 循环作用: 移除非字符串和空字符串，避免批量操作接收无效记录标识。
  return Array.from(new Set(sourceIdList.filter(sourceId => typeof sourceId === 'string' && sourceId)));
}

/**
 * 触发一次文本文件下载。
 *
 * @param {string} content 待下载文本内容。
 * @param {string} fileName 浏览器下载文件名。
 * @param {string} mimeType Blob MIME 类型。
 * @returns {void} 下载通过浏览器副作用完成。
 * 副作用: triggerTextDownload 会请求并同步目标数据，并同步相关组件状态、路由或对外事件。
 */
function triggerTextDownload(content, fileName, mimeType) {
  // 类型: Blob。
  // 作用: 把文本和 MIME 类型包装成浏览器可下载对象。

  const contentBlob = new Blob([content], { type: mimeType });

  // 类型: string。
  // 作用: 创建只在本次下载期间使用的临时对象 URL。

  const downloadUrl = URL.createObjectURL(contentBlob);

  // 类型: HTMLAnchorElement。
  // 作用: 创建一次性隐藏下载链接，避免页面组件管理 DOM 下载细节。

  const downloadLink = document.createElement('a');

  // 副作用: 绑定 Blob URL 和下载文件名。
  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;

  // 副作用: 临时插入链接并触发用户明确发起的下载。
  document.body.appendChild(downloadLink);
  downloadLink.click();

  // 副作用: 下载触发后移除链接并释放对象 URL，避免残留 DOM 和内存占用。
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * 读取数据源管理共享状态。
 * 纯读取函数: 返回响应式对象引用，调用方不得绕过 service 修改内部字段。
 * 纯函数: 只返回 Store 中的权威状态引用，本函数自身不修改记录或外部存储。
 *
 * @returns {object} SourceManagerState 响应式对象。
 */

export function getSourceManagerState() {
  // 返回值类型: object。
  // 作用: 给页面 computed 读取统一 sourceManager 状态。
  return settingsStore.sourceManager;
}

/**
 * 按来源类型读取未删除的数据源记录。
 * 纯读取函数: 不修改 records、removedSystemSourceIds 或筛选参数。
 * 纯函数: 只筛选共享记录并返回新数组，不写入数据源状态。
 *
 * @param {string} sourceKindFilter 来源筛选值，只允许 all、system 或 custom。
 * @returns {Array<object>} 当前分类可展示的数据源记录。
 */

export function getSourceRecords(sourceKindFilter = SOURCE_KIND_FILTER.all) {
  // 类型: object。
  // 作用: 读取共享数据源状态，作为筛选和删除状态判断来源。

  const managerState = getSourceManagerState();

  // 循环类型: Array.prototype.filter。
  // 初始值: records 第一条数据源记录。
  // 终止条件: records 所有记录完成可见性和来源类型判断。
  // 循环作用: 排除被删除系统源，并按用户选择的来源类型返回列表。
  // 类型: Array<object>。
  // 作用: 保存排除软删除记录并符合当前来源筛选的数据源列表。

const filteredRecords = managerState.records.filter((record) => {
    // 类型: string。
    // 作用: 读取当前记录数据源 id，用于判断系统软删除状态。

    const sourceId = record.definition.id;

    // 类型: boolean。
    // 作用: 判断当前系统源是否已被用户删除并应从列表隐藏。

    const isRemovedSystemSource = record.definition.sourceKind === SOURCE_KIND.system
      && managerState.removedSystemSourceIds.includes(sourceId);

    // 条件分支: 当前记录是已删除系统源时进入。
    // 执行内容: 返回 false，阻止记录出现在全部和系统源列表中。

    if (isRemovedSystemSource) return false;

    // 条件分支: 用户选择全部来源时进入。
    // 执行内容: 返回 true，保留所有未删除记录。

    if (sourceKindFilter === SOURCE_KIND_FILTER.all) return true;

    // 返回值类型: boolean。
    // 作用: 只保留 sourceKind 和当前分类一致的记录。
    return record.definition.sourceKind === sourceKindFilter;
  });

  // 返回值类型: Array<object>。
  // 作用: 返回当前权威记录顺序；列表页面自行维护加载周期内的稳定展示顺序。
  return filteredRecords;
}

/**
 * 按 id 读取单个数据源记录。
 * 纯读取函数: 不修改记录；可以返回已软删除系统源，供恢复对话框使用。
 * 纯函数: 只按 sourceId 查找权威记录，不修改记录数组或删除状态。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {object|null} 匹配记录；不存在时返回 null。
 */

export function getSourceRecord(sourceId) {
  // 类型: Array<object>。
  // 作用: 读取完整记录数组，详情、恢复和操作都以它为查找来源。

  const records = getSourceManagerState().records;

  // 返回值类型: object|null。
  // 作用: 返回 id 完全匹配的数据源记录，没有匹配时返回 null。

  return records.find(record => record.definition.id === sourceId) || null;
}

/**
 * 读取设置页数据源摘要。
 * 纯读取函数: 只计算启用数量、默认源和总缓存，不写入派生字段。
 * 纯函数: 只从当前可见记录派生摘要对象，不修改 Store 或记录内容。
 *
 * @returns {object} 数据源摘要。
 * @returns {number} return.enabledCount 当前未删除且已启用数据源数量。
 * @returns {number} return.totalCount 当前未删除数据源总数。
 * @returns {object|null} return.defaultSource 当前默认数据源记录。
 * @returns {number} return.totalCacheBytes 当前未删除数据源全部缓存总字节数。
 */

export function getSourceSummary() {
  // 类型: Array<object>。
  // 作用: 摘要只统计当前未删除数据源，保持列表和摘要数量一致。

  const visibleRecords = getSourceRecords(SOURCE_KIND_FILTER.all);

  // 类型: string。
  // 作用: 读取权威默认源 id，供摘要定位默认记录。

  const defaultSourceId = getSourceManagerState().defaultSourceId;

  // 返回值类型: object。
  // 作用: 返回设置页顶部可以直接消费的派生摘要。
  return {

    enabledCount: visibleRecords.filter(record => record.runtime.enabled).length,
    totalCount: visibleRecords.length,

    defaultSource: visibleRecords.find(record => record.definition.id === defaultSourceId) || null,

    totalCacheBytes: visibleRecords.reduce((sum, record) => sum + Number(record.cache.totalCacheBytes || 0), 0)
  };
}

/**
 * 读取来源分类数量。
 * 纯读取函数: 不保存数量，保证分类标签始终与 records 和删除状态一致。
 * 纯函数: 只统计当前可见记录并返回数量对象，不写入共享状态。
 *
 * @returns {object} 全部、系统源和自定义源数量。
 */

export function getSourceKindCounts() {
  // 类型: Array<object>。
  // 作用: 读取全部未删除数据源，供三个分类共享计算。

  const allRecords = getSourceRecords(SOURCE_KIND_FILTER.all);

  // 返回值类型: object。
  // 作用: 给来源类型切换标签提供实时数量。
  return {
    all: allRecords.length,

    system: allRecords.filter(record => record.definition.sourceKind === SOURCE_KIND.system).length,

    custom: allRecords.filter(record => record.definition.sourceKind === SOURCE_KIND.custom).length
  };
}

/**
 * 读取数据源能力标签。
 * 纯读取函数: 只返回 capabilities 中值为 true 的统一能力定义。
 * 纯函数: 只读取能力开关并返回过滤结果，不修改输入对象或配置定义。
 *
 * @param {object} capabilities 数据源页面能力开关对象。
 * @returns {Array<object>} 当前数据源支持的能力定义列表。
 */

export function getEnabledCapabilities(capabilities) {
  // 类型: object。
  // 作用: 非对象能力值统一兜底为空对象，避免读取字段时报错。

  const safeCapabilities = capabilities && typeof capabilities === 'object' ? capabilities : {};

  // 返回值类型: Array<object>。
  // 作用: 按统一顺序返回已启用能力，供详情页循环渲染。

  return CAPABILITY_DEFINITIONS.filter(definition => Boolean(safeCapabilities[definition.key]));
}

/**
 * 读取数据源当前有效授权状态。
 * 纯读取函数: 复用统一授权领域评估，不修改 record、store 或页面状态。
 * 纯函数: 只委托授权评估函数返回当前结果，不写入授权或运行状态。
 * 页面授权文案、按钮分支和启用校验必须消费该结果，避免原始状态与有效状态分叉。
 *
 * @param {object|null} record 数据源管理记录。
 * @returns {object} 当前记录的有效授权评估结果。
 * @returns {string} return.effectiveStatus 页面应展示的授权状态。
 * @returns {boolean} return.isAuthorized 是否具备当前脚本有效授权。
 * @returns {boolean} return.requiresAuthorization 启用前是否必须重新确认风险。
 * @returns {string} return.reason 授权有效或失效的统一原因。
 * @returns {string} return.currentScriptHash 当前脚本文本内容指纹。
 */

export function getSourceAuthorizationState(record) {
  // 返回值类型: object。
  // 作用: 把授权领域模块作为唯一判定入口，供所有设置页调用方共享。
  return evaluateSourceAuthorization(record);
}

/**
 * 判断数据源启用前是否需要用户授权。
 * 纯读取函数: 从 getSourceAuthorizationState 派生布尔结果，不重复版本或哈希判断。
 * 纯函数: 只读取授权评估结果，不修改记录、脚本或用户决定。
 *
 * @param {object|null} record 数据源管理记录。
 * @returns {boolean} true 表示启用前必须显示免责声明；false 表示当前授权允许直接启用。
 */

export function requiresSourceAuthorization(record) {
  // 条件分支: 记录不存在时进入。
  // 执行内容: 返回 false，由调用方按记录不存在处理，不打开无内容授权弹窗。

  if (!record) return false;

  // 返回值类型: boolean。
  // 作用: 使用统一有效授权结果控制列表、详情和 service 启用边界。
  return getSourceAuthorizationState(record).requiresAuthorization;
}

/**
 * 写入用户对自定义脚本的运行授权。
 * 副作用: 修改目标记录 authorization 响应式字段。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {object|null} 更新后的记录；数据源不存在时返回 null。
 */

export function authorizeSource(sourceId) {
  // 类型: object|null。
  // 作用: 定位需要授权的数据源记录。

  const record = getSourceRecord(sourceId);

  // 条件分支: 数据源不存在时进入。
  // 执行内容: 返回 null，避免修改空引用。

  if (!record) return null;

  // 副作用: 使用统一构造函数一次性写入状态、确认时间、当前版本和脚本内容指纹。
  // 影响范围: 替换目标记录已有 authorization 对象，避免逐字段更新形成中间矛盾状态。
  record.authorization = createSourceAuthorizationState(record.definition, {
    // 类型: string。
    // 作用: 标记用户已经确认当前版本和脚本文本的运行风险。
    status: AUTHORIZATION_STATUS.authorized,
    // 类型: string。
    // 作用: 保存本次确认发生时间，供详情展示和后续审计使用。
    authorizedAt: new Date().toISOString()
  });

  // 返回值类型: object。
  // 作用: 返回更新后记录，调用方可以继续启用同一数据源。
  return record;
}

/**
 * 撤销自定义脚本运行授权。
 * 副作用: 修改授权状态并关闭目标数据源；默认源会自动选择可用回退源。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {boolean} 是否成功撤销授权。
 */

export function revokeSourceAuthorization(sourceId) {
  // 类型: object|null。
  // 作用: 定位需要撤销授权的数据源。

  const record = getSourceRecord(sourceId);

  // 条件分支: 记录不存在或不是自定义源时进入。
  // 执行内容: 返回 false，系统源不提供撤销授权。

  if (!record || record.definition.sourceKind !== SOURCE_KIND.custom) return false;

  // 副作用: 使用统一授权构造函数写入 revoked，同时保留最后一次有效授权快照供后续诊断。
  record.authorization = createSourceAuthorizationState(record.definition, {
    // 类型: string。
    // 作用: 标记用户主动撤销当前脚本运行授权。
    status: AUTHORIZATION_STATUS.revoked,
    // 类型: string。
    // 作用: 保留最后一次用户确认授权时间，不把撤销误写成从未授权。
    authorizedAt: record.authorization.authorizedAt,
    // 类型: string。
    // 作用: 保留最后一次授权版本，供后续状态诊断和重新授权覆盖。
    authorizedVersion: record.authorization.authorizedVersion,
    // 类型: string。
    // 作用: 保留最后一次授权内容指纹，供后续状态诊断和重新授权覆盖。
    authorizedScriptHash: record.authorization.authorizedScriptHash
  });

  // 副作用: 关闭已撤销授权的数据源，避免页面仍把它视为参与请求的源。
  setSourceEnabled(sourceId, false);

  // 返回值类型: boolean。
  // 作用: 告诉调用方撤销授权已经完成。
  return true;
}

/**
 * 设置数据源启用状态。
 * 副作用: 修改 runtime.enabled；关闭默认源时自动切换到第一个已启用回退源，没有回退时进入无默认源状态。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @param {boolean} enabled 目标启用状态；true 启用，false 关闭。
 * @returns {object|null} 更新后的数据源记录；不存在时返回 null。
 */

export function setSourceEnabled(sourceId, enabled) {
  // 类型: object|null。
  // 作用: 定位需要启用或关闭的数据源记录。

  const record = getSourceRecord(sourceId);

  // 条件分支: 数据源不存在时进入。
  // 执行内容: 返回 null，阻止修改空记录。

  if (!record) return null;

  // 条件分支: 尝试启用尚未授权的自定义脚本时进入。
  // 执行内容: 抛出明确错误，要求调用方先完成用户授权。

  if (enabled && requiresSourceAuthorization(record)) {
    throw new Error('当前自定义数据源尚未获得用户运行授权');
  }

  // 副作用: 写入目标启用状态，驱动列表开关和详情页状态同步更新。
  record.runtime.enabled = Boolean(enabled);

  // 类型: object。
  // 作用: 读取共享管理状态，后续判断和更新默认源。

  const managerState = getSourceManagerState();

  // 条件分支: 启用数据源且当前没有默认源时进入。
  // 执行内容: 把刚启用的数据源设为默认源，避免启用后仍处于无默认源状态。

  if (enabled && !managerState.defaultSourceId) {
    managerState.defaultSourceId = sourceId;
  }

  // 条件分支: 关闭的数据源正是当前默认源时进入。
  // 执行内容: 选择其他已启用记录作为回退；没有回退时清空默认源。

  if (!enabled && managerState.defaultSourceId === sourceId) {
    // 类型: object|null。
    // 作用: 查找关闭当前默认源后可以接替的已启用记录。

    const fallbackSource = selectFallbackSource(sourceId);

    // 副作用: 写入回退源 id；没有回退时使用空字符串表示无可用默认源。
    managerState.defaultSourceId = fallbackSource ? fallbackSource.definition.id : '';
  }

  // 返回值类型: object。
  // 作用: 返回启停后的记录，供调用方提示操作结果。
  return record;
}

/**
 * 设置默认数据源。
 * 副作用: 修改 sourceManager.defaultSourceId。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {boolean} 是否成功设置默认源。
 */

export function setDefaultSource(sourceId) {
  // 类型: object|null。
  // 作用: 定位目标记录并校验它是否已启用。

  const record = getSourceRecord(sourceId);

  // 条件分支: 记录不存在或未启用时进入。
  // 执行内容: 返回 false，避免默认源指向不可使用记录。

  if (!record || !record.runtime.enabled) return false;

  // 副作用: 更新权威默认数据源 id，摘要和所有列表行会同步派生新状态。
  getSourceManagerState().defaultSourceId = sourceId;

  // 返回值类型: boolean。
  // 作用: 告诉调用方默认源已经成功更新。
  return true;
}

/**
 * 模拟检测单个数据源。
 * 副作用: 临时写入 checking，随后按 mock 场景写入 normal 或 unavailable 和检测时间。
 * 成功路径: 返回检测后的记录。
 * 失败路径: 数据源不存在时返回 null，不抛出网络错误。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<object|null>} 检测后的数据源记录。
 */

export async function checkSource(sourceId) {
  // 类型: object|null。
  // 作用: 定位需要检测的数据源记录。

  const record = getSourceRecord(sourceId);

  // 条件分支: 数据源不存在时进入。
  // 执行内容: 返回 null，避免创建无来源检测状态。

  if (!record) return null;

  // 副作用: 进入检测中状态，驱动列表和详情显示统一加载状态。
  record.runtime.healthStatus = HEALTH_STATUS.checking;

  // 异步等待: 使用统一 mock 延时模拟检测过程。
  // resolve: 继续读取稳定场景结果。
  await waitForMockOperation();

  // 类型: object。
  // 作用: 读取当前数据源预设检测结果；新导入源没有场景时默认正常。

  const scenario = sourceOperationScenarios.health[sourceId] || { status: HEALTH_STATUS.normal, reason: '' };

  // 副作用: 写入三态健康结果，保证页面不产生异常、警告或未知等额外状态。
  record.runtime.healthStatus = scenario.status;

  // 副作用: 不可用时写入简短原因，正常时清空旧原因。
  record.runtime.lastUnavailableReason = scenario.status === HEALTH_STATUS.unavailable ? scenario.reason : '';

  // 副作用: 记录本次检测完成时间，供详情页展示。
  record.runtime.lastCheckedAt = new Date().toISOString();

  // 返回值类型: object。
  // 作用: 返回检测后的响应式记录，供调用方展示结果提示。
  return record;
}

/**
 * 模拟检测全部已启用数据源。
 * 副作用: 修改 checkingAll 和每条已启用记录健康状态。
 * 成功路径: 所有检测 Promise 完成后返回记录数组。
 * 失败路径: finally 始终恢复 checkingAll；当前 mock 单项检测不主动抛错。
 *
 * @returns {Promise<Array<object>>} 检测后的已启用数据源记录。
 */

export async function checkAllSources() {
  // 类型: object。
  // 作用: 读取共享状态并控制批量检测按钮 loading。

  const managerState = getSourceManagerState();

  // 类型: Array<object>。
  // 作用: 只检测当前未删除且已启用数据源，关闭源不参与批量检测。

const enabledRecords = getSourceRecords(SOURCE_KIND_FILTER.all).filter(record => record.runtime.enabled);

  // 副作用: 标记批量检测开始，阻止用户重复触发。
  managerState.checkingAll = true;

  try {
    // 循环类型: Array.prototype.map + Promise.all。
    // 初始值: enabledRecords 第一条记录。
    // 终止条件: 所有已启用记录完成 checkSource。
    // 循环作用: 并行模拟检测，避免按记录数量线性延长等待。

    return await Promise.all(enabledRecords.map(record => checkSource(record.definition.id)));
  } finally {
    // 副作用: 无论检测结果如何都恢复批量检测按钮状态。
    managerState.checkingAll = false;
  }
}

/**
 * 模拟检查在线数据源更新。
 * 副作用: 修改在线更新检查状态、可用版本和检查时间。
 * 成功路径: 在线导入记录完成模拟检查后返回更新后的记录；非在线记录返回 null。
 * 失败路径: 记录不存在时返回 null；检测过程异常由调用方接收，finally 仍结束检查状态。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<object|null>} 更新检查后的记录；非在线源或不存在时返回 null。
 */

export async function checkSourceUpdate(sourceId) {
  // 类型: object|null。
  // 作用: 定位需要检查更新的数据源。

  const record = getSourceRecord(sourceId);

  // 条件分支: 数据源不存在或不是在线导入时进入。
  // 执行内容: 返回 null，文件和粘贴导入不显示在线更新能力。

  if (!record || record.definition.importMethod !== IMPORT_METHOD.remote) return null;

  // 副作用: 标记更新检查开始，详情页禁用重复操作。
  record.runtime.checkingUpdate = true;

  // 异步等待: 使用统一 mock 延时模拟远程版本检查。
  await waitForMockOperation();

  // 类型: object|undefined。
  // 作用: 读取当前在线源的预设更新结果，没有场景时视为已是最新。

  const updateScenario = sourceOperationScenarios.updates[sourceId];

  // 副作用: 写入是否有可用更新。
  record.runtime.updateAvailable = Boolean(updateScenario && updateScenario.available);

  // 副作用: 写入可用版本号，没有更新时清空旧值。
  record.runtime.availableVersion = updateScenario && updateScenario.available ? updateScenario.version : '';

  // 副作用: 写入在线版本更新时间，没有更新时清空旧值。
  record.runtime.availableVersionUpdatedAt = updateScenario && updateScenario.available ? updateScenario.updatedAt : '';

  // 副作用: 记录本次检查完成时间。
  record.runtime.lastUpdateCheckedAt = new Date().toISOString();

  // 副作用: 恢复更新检查按钮状态。
  record.runtime.checkingUpdate = false;

  // 返回值类型: object。
  // 作用: 返回更新检查后的记录，供详情页刷新状态和提示。
  return record;
}

/**
 * 模拟应用在线数据源更新。
 * 副作用: 修改脚本版本、脚本内容、最后更新时间、更新状态和自定义脚本授权状态。
 * 成功路径: 存在可用更新时写入新脚本事实并返回更新后的记录。
 * 失败路径: 记录不存在或没有可用更新时返回 null；更新异常由调用方接收。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {Promise<object|null>} 更新后的记录；没有可用更新时返回 null。
 */

export async function applySourceUpdate(sourceId) {
  // 类型: object|null。
  // 作用: 定位需要更新的数据源。

  const record = getSourceRecord(sourceId);

  // 类型: object|undefined。
  // 作用: 读取稳定更新场景和新脚本内容。

  const updateScenario = sourceOperationScenarios.updates[sourceId];

  // 条件分支: 记录不存在、没有场景或没有可用更新时进入。
  // 执行内容: 返回 null，不修改当前本地脚本。

  if (!record || !updateScenario || !record.runtime.updateAvailable) return null;

  // 副作用: 标记更新操作开始，复用详情页更新按钮 loading。
  record.runtime.checkingUpdate = true;

  // 异步等待: 模拟在线脚本更新过程，不发起真实下载。
  await waitForMockOperation();

  // 副作用: 把本地脚本版本更新为在线可用版本。
  record.definition.version = updateScenario.version;

  // 副作用: 使用统一换行规则替换当前 mock 脚本文本，后续授权判断和导出消费同一内容。
  record.definition.scriptContent = normalizeSourceScriptContent(updateScenario.scriptContent);

  // 副作用: 记录本地脚本成功更新的时间。
  record.definition.lastUpdatedAt = new Date().toISOString();

  // 副作用: 清除已应用的可用更新标记和在线版本字段。
  record.runtime.updateAvailable = false;
  record.runtime.availableVersion = '';
  record.runtime.availableVersionUpdatedAt = '';
  record.runtime.lastUpdateCheckedAt = new Date().toISOString();
  record.runtime.checkingUpdate = false;

  // 条件分支: 更新目标是自定义脚本时进入。
  // 执行内容: 撤销先前脚本内容的授权并关闭数据源，下一次启用要求用户确认更新后的脚本。

  if (record.definition.sourceKind === SOURCE_KIND.custom) {
    // 副作用: 把授权状态收敛为 pending，同时保留旧授权快照用于说明它不再适用于新脚本。
    record.authorization = createSourceAuthorizationState(record.definition, {
      // 类型: string。
      // 作用: 标记更新后的脚本等待用户重新确认运行风险。
      status: AUTHORIZATION_STATUS.pending,
      // 类型: string。
      // 作用: 保留旧脚本最后一次用户确认时间。
      authorizedAt: record.authorization.authorizedAt,
      // 类型: string。
      // 作用: 保留旧脚本授权版本，和新 definition.version 形成明确失效依据。
      authorizedVersion: record.authorization.authorizedVersion,
      // 类型: string。
      // 作用: 保留旧脚本内容指纹，和新脚本当前指纹形成明确失效依据。
      authorizedScriptHash: record.authorization.authorizedScriptHash
    });
    // 通过统一启停入口关闭更新后的自定义脚本，保证默认源引用同步回退或清空。
    setSourceEnabled(sourceId, false);
  }

  // 返回值类型: object。
  // 作用: 返回更新后的记录，供详情页刷新版本和授权提示。
  return record;
}

/**
 * 创建并写入一条自定义数据源记录。
 * 副作用: 向 sourceManager.records 追加记录，并向 mock 健康场景增加默认正常结果。
 *
 * @param {object} input 导入表单数据。
 * @param {string} input.name 数据源名称。
 * @param {string} input.version 脚本版本。
 * @param {string} input.importMethod 导入方式，只允许 file、remote 或 text。
 * @param {string} input.remoteUrl 在线导入地址，其他方式为空字符串。
 * @param {string} input.scriptContent 脚本文本或 mock 内容。
 * @returns {object} 新增的数据源记录。
 */

export function importCustomSource(input) {
  // 类型: string。
  // 作用: 生成不与现有记录冲突的数据源唯一标识。

  const sourceId = createNextCustomSourceId();

  // 类型: string。
  // 作用: 保存本次导入时间，同时作为首次本地更新时间。

  const importedAt = new Date().toISOString();

  // 类型: object。
  // 作用: 先建立唯一脚本定义，让授权状态构造函数直接读取同一版本和规范化脚本文本。

  const definition = {
    schemaVersion: '1.0.0',
    id: sourceId,
    name: input.name || '未命名数据源',
    description: '当前页面导入的 mock 自定义数据源。',
    sourceKind: SOURCE_KIND.custom,
    version: input.version || DEFAULT_IMPORTED_VERSION,
    importMethod: input.importMethod,
    remoteUrl: input.importMethod === IMPORT_METHOD.remote ? input.remoteUrl : '',
    importedAt,
    lastUpdatedAt: importedAt,

    capabilities: CAPABILITY_DEFINITIONS.reduce((result, definitionItem) => {
      // 副作用: 给新记录建立完整能力键；当前 mock 默认支持全部页面能力。
      result[definitionItem.key] = true;
      return result;
    }, {}),
    settingsSchema: [],
    settingsValues: {},
    scriptContent: normalizeSourceScriptContent(input.scriptContent || `export default { id: '${sourceId}' };`)
  };

  // 类型: object。
  // 作用: 使用同一 definition 建立正式同构记录，避免脚本字段和授权字段分别构造。

  const record = {
    definition,
    runtime: {
      enabled: false,
      healthStatus: HEALTH_STATUS.normal,
      lastCheckedAt: '',
      lastUnavailableReason: '',
      checkingUpdate: false,
      updateAvailable: false,
      availableVersion: '',
      availableVersionUpdatedAt: '',
      lastUpdateCheckedAt: ''
    },
    authorization: createSourceAuthorizationState(definition, {
      // 类型: string。
      // 作用: 新导入自定义脚本必须等待用户阅读风险提示并主动授权。
      status: AUTHORIZATION_STATUS.pending
    }),
    cache: {
      temporaryCacheBytes: 0,
      totalCacheBytes: 0
    }
  };

  // 副作用: 把新记录追加到共享响应式数组，列表和分类数量立即更新。
  getSourceManagerState().records.push(record);

  // 返回值类型: object。
  // 作用: 返回新记录，调用方可以关闭弹窗并进入详情页。
  return record;
}

/**
 * 删除单个数据源。
 * 复用 deleteSources 的批量事务，保证单项与批量删除使用同一软删除、实际删除和默认源回退规则。
 * 副作用: 委托批量删除入口修改共享记录、软删除状态及必要的默认源选择。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {boolean} 是否成功删除。
 */

export function deleteSource(sourceId) {
  // 类型: object。
  // 作用: 使用统一批量删除结果判断当前单项是否实际完成删除。

  const deleteResult = deleteSources([sourceId]);

  // 返回值类型: boolean。
  // 作用: 实际删除一条记录时返回 true，目标不存在时返回 false。
  return deleteResult.deletedCount === 1;
}

/**
 * 批量删除数据源。
 * 副作用: 系统源统一写入 removedSystemSourceIds，自定义源一次性从 records 删除。
 * 默认源边界: 批次包含默认源时，只能从整批删除范围之外选择已启用回退源；没有候选时清空默认源。
 * 原子性: 先确定整批记录和回退目标，再一次性修改共享状态，避免逐条删除时默认源短暂指向同批待删除记录。
 *
 * @param {Array<string>} sourceIds 待删除数据源 id 数组。
 * @returns {object} 批量删除结果。
 * @returns {number} return.deletedCount 实际删除记录总数。
 * @returns {number} return.systemCount 实际软删除系统源数量。
 * @returns {number} return.customCount 实际删除自定义源数量。
 */

export function deleteSources(sourceIds) {
  // 类型: Array<string>。
  // 作用: 去除重复、空值和非法 id，建立稳定批量删除输入。

  const normalizedSourceIds = normalizeSourceIds(sourceIds);

  // 类型: Set<string>。
  // 作用: 给记录筛选、默认源判断和自定义源移除提供统一快速查找集合。

  const sourceIdSet = new Set(normalizedSourceIds);

  // 类型: object。
  // 作用: 读取本次批量事务需要修改的唯一共享数据源状态。

  const managerState = getSourceManagerState();

  // 循环类型: Array.prototype.filter。
  // 初始值: managerState.records 第一条记录。
  // 终止条件: 所有记录完成 id 和软删除状态判断。
  // 循环作用: 只保留当前真实存在且尚未软删除的批量删除目标。
  // 类型: Array<object>。
  // 作用: 保存输入 id 中当前仍存在且未被软删除的真实删除目标。

const recordsToDelete = managerState.records.filter((record) => {
    // 类型: string。
    // 作用: 读取当前记录 id，判断是否属于用户确认的删除集合。

    const sourceId = record.definition.id;

    // 类型: boolean。
    // 作用: 排除已经软删除的系统源，避免重复统计删除数量。

    const isAlreadyRemovedSystemSource = record.definition.sourceKind === SOURCE_KIND.system
      && managerState.removedSystemSourceIds.includes(sourceId);

    // 返回值类型: boolean。
    // 作用: 只有被选中且当前仍可见的记录进入本次删除事务。
    return sourceIdSet.has(sourceId) && !isAlreadyRemovedSystemSource;
  });

  // 类型: Array<string>。
  // 作用: 保存本次实际删除目标 id，防止无效输入影响默认源交接。

const effectiveSourceIds = recordsToDelete.map(record => record.definition.id);

  // 类型: Set<string>。
  // 作用: 给自定义源数组移除和默认源判断提供实际目标集合。

  const effectiveSourceIdSet = new Set(effectiveSourceIds);

  // 循环类型: Array.prototype.filter + map。
  // 初始值: recordsToDelete 第一条记录。
  // 终止条件: 所有实际目标完成来源类型判断。
  // 循环作用: 提取系统源 id，后续统一写入软删除数组。
  // 类型: Array<string>。
  // 作用: 保存本批系统源 id，供软删除集合统一追加。

  const systemSourceIds = recordsToDelete

    .filter(record => record.definition.sourceKind === SOURCE_KIND.system)

    .map(record => record.definition.id);

  // 循环类型: Array.prototype.filter + map。
  // 初始值: recordsToDelete 第一条记录。
  // 终止条件: 所有实际目标完成来源类型判断。
  // 循环作用: 提取自定义源 id，后续一次性从 records 删除。
  // 类型: Array<string>。
  // 作用: 保存本批自定义源 id，供记录数组一次性实际删除。

  const customSourceIds = recordsToDelete

    .filter(record => record.definition.sourceKind === SOURCE_KIND.custom)

    .map(record => record.definition.id);

  // 循环类型: Array.prototype.forEach。
  // 初始值: systemSourceIds 第一项。
  // 终止条件: 所有系统源目标写入软删除数组。
  // 循环作用: 保留系统脚本和记录，只隐藏用户选择删除的系统源。

  systemSourceIds.forEach((sourceId) => {
    // 条件分支: 当前系统源尚未记录在软删除集合中时进入。
    // 执行内容: 追加唯一 sourceId，保留脚本和完整记录供后续恢复。
    if (!managerState.removedSystemSourceIds.includes(sourceId)) {
      managerState.removedSystemSourceIds.push(sourceId);
    }
  });

  // 类型: Set<string>。
  // 作用: 给 records 过滤提供自定义源删除集合。

  const customSourceIdSet = new Set(customSourceIds);

  // 条件分支: 本批次至少包含一个自定义源时进入。
  // 执行内容: 一次性覆盖 records，实际删除对应脚本、定义、运行态、授权和缓存。

  if (customSourceIdSet.size) {
    managerState.records = managerState.records

      .filter(record => !customSourceIdSet.has(record.definition.id));
  }

  // 条件分支: 当前默认源属于本次实际删除集合时进入。
  // 执行内容: 从整批删除范围之外选择已启用回退源，没有候选时清空默认源。

  if (effectiveSourceIdSet.has(managerState.defaultSourceId)) {
    // 类型: object|null。
    // 作用: 查找不在本批次中的第一条已启用可见记录。

    const fallbackSource = selectFallbackSource(effectiveSourceIds);

    // 副作用: 写入安全回退源 id；没有候选时使用空字符串表示无默认源。
    managerState.defaultSourceId = fallbackSource ? fallbackSource.definition.id : '';
  }

  // 返回值类型: object。
  // 作用: 给页面生成准确批量删除反馈，并清理对应选择状态。
  return {
    // 类型: number。
    // 作用: 本次系统源和自定义源实际删除总数。
    deletedCount: recordsToDelete.length,
    // 类型: number。
    // 作用: 本次写入软删除数组的系统源数量。
    systemCount: systemSourceIds.length,
    // 类型: number。
    // 作用: 本次从 records 实际移除的自定义源数量。
    customCount: customSourceIds.length
  };
}

/**
 * 读取被删除系统源记录。
 * 纯读取函数: 按 removedSystemSourceIds 顺序返回可恢复记录。
 * 纯函数: 只把软删除 id 映射为现有系统源记录，不修改记录或软删除数组。
 *
 * @returns {Array<object>} 当前可恢复系统源记录。
 */

export function getRemovedSystemSources() {
  // 类型: object。
  // 作用: 读取软删除 id 和完整记录数组。

  const managerState = getSourceManagerState();

  // 循环类型: Array.prototype.map + filter。
  // 初始值: removedSystemSourceIds 第一项。
  // 终止条件: 所有软删除 id 完成记录查找。
  // 循环作用: 把恢复对话框需要的 id 转换成完整数据源记录。
  return managerState.removedSystemSourceIds

    .map(sourceId => getSourceRecord(sourceId))

    .filter(record => Boolean(record));
}

/**
 * 恢复所选系统源。
 * 副作用: 从 removedSystemSourceIds 移除传入 id，不复制或重建内置脚本。
 *
 * @param {Array<string>} sourceIds 要恢复的系统源 id。
 * @returns {number} 实际恢复数量。
 */

export function restoreSystemSources(sourceIds) {
  // 类型: Set<string>。
  // 作用: 把恢复选择转换成集合，提供稳定去重和快速查找。

  const restoreIdSet = new Set(Array.isArray(sourceIds) ? sourceIds : []);

  // 类型: object。
  // 作用: 读取需要更新软删除列表的共享状态。

  const managerState = getSourceManagerState();

  // 类型: number。
  // 作用: 保存操作前软删除数量，用于计算实际恢复数量。

  const previousCount = managerState.removedSystemSourceIds.length;

  // 副作用: 覆盖软删除 id 数组，只保留用户没有选择恢复的系统源。
  managerState.removedSystemSourceIds = managerState.removedSystemSourceIds

    .filter(sourceId => !restoreIdSet.has(sourceId));

  // 返回值类型: number。
  // 作用: 返回软删除数量差值，供页面提示恢复结果。
  return previousCount - managerState.removedSystemSourceIds.length;
}

/**
 * 清理数据源临时缓存。
 * 副作用: 把 temporaryCacheBytes 清零，并从 totalCacheBytes 扣除相同临时缓存量。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {boolean} 是否成功清理。
 */

export function clearTemporarySourceCache(sourceId) {
  // 类型: object|null。
  // 作用: 定位需要清理缓存的数据源。

  const record = getSourceRecord(sourceId);

  // 条件分支: 数据源不存在时进入。
  // 执行内容: 返回 false，避免修改空缓存对象。

  if (!record) return false;

  // 类型: number。
  // 作用: 保存清理前临时缓存量，用于从全部缓存中只扣除临时部分。

  const temporaryCacheBytes = Number(record.cache.temporaryCacheBytes || 0);

  // 副作用: 清空内容、解析、页面、日志和诊断等临时缓存摘要。
  record.cache.temporaryCacheBytes = 0;

  // 副作用: 保留请求头运行数据、Cookie、会话等非临时缓存占用。
  record.cache.totalCacheBytes = Math.max(0, Number(record.cache.totalCacheBytes || 0) - temporaryCacheBytes);

  // 返回值类型: boolean。
  // 作用: 告诉调用方临时缓存清理已经完成。
  return true;
}

/**
 * 清理数据源全部缓存。
 * 副作用: 把临时缓存和全部缓存摘要同时清零；保留脚本、基本信息、启用、默认源、授权和普通设置。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {boolean} 是否成功清理。
 */

export function clearAllSourceCache(sourceId) {
  // 类型: object|null。
  // 作用: 定位需要清理全部缓存的数据源。

  const record = getSourceRecord(sourceId);

  // 条件分支: 数据源不存在时进入。
  // 执行内容: 返回 false，避免修改空缓存对象。

  if (!record) return false;

  // 副作用: 清空所有可重新生成的临时缓存摘要。
  record.cache.temporaryCacheBytes = 0;

  // 副作用: 清空包含请求头运行数据、Cookie、身份令牌、会话和验证上下文的全部缓存摘要。
  record.cache.totalCacheBytes = 0;

  // 返回值类型: boolean。
  // 作用: 告诉调用方全部缓存清理已经完成。
  return true;
}

/**
 * 下载数据源脚本。
 * 副作用: 创建 Blob、临时对象 URL 和隐藏下载链接，并触发浏览器下载；完成后立即释放资源。
 * 成功路径: 浏览器开始下载当前 mock 脚本文本。
 * 失败路径: 数据源不存在时返回 false，不创建浏览器资源。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {boolean} 是否成功触发脚本下载。
 */

export function downloadSourceScript(sourceId) {
  // 类型: object|null。
  // 作用: 定位需要导出的数据源脚本记录。

  const record = getSourceRecord(sourceId);

  // 条件分支: 数据源不存在时进入。
  // 执行内容: 返回 false，避免下载空脚本。

  if (!record) return false;

  // 副作用: 使用统一下载辅助函数导出当前脚本文本，不包含缓存和用户数据。
  triggerTextDownload(
    record.definition.scriptContent,
    `${record.definition.id}-${record.definition.version}.js`,
    SOURCE_SCRIPT_MIME_TYPE
  );

  // 返回值类型: boolean。
  // 作用: 告诉调用方脚本下载已经成功触发。
  return true;
}

/**
 * 批量下载数据源脚本包。
 * 副作用: 把所选记录最小身份、版本和脚本文本序列化为一个 JSON 文件并触发浏览器下载。
 * 成功路径: 至少存在一条有效记录时下载单个脚本包并返回实际导出数量。
 * 失败路径: 输入没有匹配记录时返回 0，不创建 Blob 或下载链接。
 *
 * @param {Array<string>} sourceIds 待导出数据源 id 数组。
 * @returns {number} 实际写入脚本包的数据源数量。
 */

export function downloadSourceScripts(sourceIds) {
  // 类型: Array<string>。
  // 作用: 规范化批量导出输入，移除空值和重复 id。

  const normalizedSourceIds = normalizeSourceIds(sourceIds);

  // 循环类型: Array.prototype.map + filter。
  // 初始值: normalizedSourceIds 第一项。
  // 终止条件: 所有输入 id 完成共享记录查找。
  // 循环作用: 只保留当前真实存在的数据源记录。
  // 类型: Array<object>。
  // 作用: 保存输入 id 对应的现存数据源记录，作为导出包唯一内容来源。

  const exportRecords = normalizedSourceIds

    .map(sourceId => getSourceRecord(sourceId))

    .filter(record => Boolean(record));

  // 条件分支: 没有有效导出记录时进入。
  // 执行内容: 返回 0，不创建空脚本包。

  if (!exportRecords.length) return 0;

  // 类型: object。
  // 作用: 创建只包含结构版本、导出时间和最小脚本信息的批量导出对象。

  const exportPackage = {
    // 类型: string。
    // 作用: 供未来导入器判断脚本包结构兼容性。
    schemaVersion: SOURCE_EXPORT_SCHEMA_VERSION,
    // 类型: string。
    // 作用: 记录用户触发批量导出的 ISO 时间。
    exportedAt: new Date().toISOString(),
    // 类型: Array<object>。
    // 作用: 保存每条数据源最小身份、版本和脚本文本，不包含缓存或用户数据。

    sources: exportRecords.map(record => ({
      // 类型: string。
      // 作用: 数据源唯一标识，供未来导入或诊断区分脚本。
      id: record.definition.id,
      // 类型: string。
      // 作用: 数据源展示名称，供用户识别导出内容。
      name: record.definition.name,
      // 类型: string。
      // 作用: 当前本地脚本版本。
      version: record.definition.version,
      // 类型: string。
      // 作用: 数据源可执行脚本文本，是批量导出的核心内容。
      scriptContent: record.definition.scriptContent
    }))
  };

  // 类型: string。
  // 作用: 使用当前毫秒时间戳保证连续批量导出不会覆盖同名文件。

  const exportFileName = `${SOURCE_EXPORT_FILE_PREFIX}-${Date.now()}.json`;

  // 副作用: 序列化并下载单个 JSON 脚本包。
  triggerTextDownload(
    JSON.stringify(exportPackage, null, JSON_INDENT_SPACES),
    exportFileName,
    SOURCE_PACKAGE_MIME_TYPE
  );

  // 返回值类型: number。
  // 作用: 给页面展示实际导出的数据源数量。
  return exportRecords.length;
}
