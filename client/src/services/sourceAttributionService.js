/*
  sourceAttributionService.js 模块说明

  - 文件职责:
      把 SourceManagerState 中的标准 SourceDefinition 投影为设置页只读署名条目。
      供系统源致谢和自定义源声明页面按来源类型读取同一结构，不承担数据源管理或健康判断。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      SOURCE_KIND 与 SOURCE_ATTRIBUTION_POLICY: 自定义配置，约束来源类型和匿名作者展示值。
      settingsStore: 自定义 Store，提供 SourceManager 发布的响应式完整记录。
      formatSourceDisplayName: 自定义工具函数，统一数据源名称十字符显示边界。
      createSourceSiteDisplay: 自定义工具函数，从安全原站地址即时派生页面域名。
      IMPORT_METHOD_TEXT: 自定义展示映射，把保存的导入方式转换为用户文案。

  - 模块级常量:
      SOURCE_ATTRIBUTION_KINDS: Set<string>，允许进入署名列表的来源类型集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertAttributionSourceKind(sourceKind): 校验列表查询来源类型。
      createAttributionEntry(record): 从标准记录创建冻结只读条目。

  - 模块级类:
      无

  - 对外导出:
      projectSourceAttributionEntries: Function，对任意标准记录数组执行纯投影，供测试与页面服务复用。
      getSourceAttributionEntries: Function，从响应式设置 Store 读取当前署名列表。
*/

import {
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源来源类型枚举。
  // 文件作用: 限制服务只能按正式 system/custom 值分流，拒绝页面自由字符串。
  SOURCE_KIND,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: SOURCE_ATTRIBUTION_POLICY 署名规范。
  // 文件作用: Definition 意外缺少作者时继续采用平台唯一“佚名”展示值。
  SOURCE_ATTRIBUTION_POLICY
} from '../config/source-manager.config.js';

// 导入来源: ../store/settingsStore.js。
// 导入内容: settingsStore 响应式设置状态门面。
// 文件作用: 读取 SourceManager 发布的当前完整 records，不直接访问 Repository。
import { settingsStore } from '../store/settingsStore.js';

// 导入来源: ../utils/sourceDisplayName.js。
// 导入内容: formatSourceDisplayName 全站数据源名称显示适配器。
// 文件作用: 署名列表继续遵守数据源名称最多十个 Unicode 字符的页面规则。
import { formatSourceDisplayName } from '../utils/sourceDisplayName.js';

// 导入来源: ../utils/sourceAttribution.js。
// 导入内容: createSourceSiteDisplay 安全站点展示投影。
// 文件作用: 从 Definition.siteUrl 派生非持久化域名，并关闭意外非法外链。
import { createSourceSiteDisplay } from '../utils/sourceAttribution.js';

import {
  // 导入来源: ../utils/settingsDisplay.js。
  // 导入内容: IMPORT_METHOD_TEXT 导入方式展示映射。
  // 文件作用: 自定义源条目复用数据源管理页已有文案，不维护第二套状态翻译。
  IMPORT_METHOD_TEXT
} from '../utils/settingsDisplay.js';

// 类型: Set<string>。
// 作用: 限制署名查询只能选择系统源或自定义源，防止“全部”等管理页筛选值绕过页面边界。
const SOURCE_ATTRIBUTION_KINDS = new Set([SOURCE_KIND.system, SOURCE_KIND.custom]);

/**
 * 校验署名列表来源类型。
 * 纯函数: 只读取冻结枚举集合，不修改参数或页面状态。
 * 成功路径: 返回原来源类型，供后续严格比较。
 * 失败路径: 未知类型抛出 TypeError，避免系统源与自定义源声明混在同一页面。
 *
 * @param {*} sourceKind 署名页面请求的数据源来源类型。
 * @returns {string} 已确认的 system 或 custom。
 * @throws {TypeError} 当来源类型不属于正式枚举时抛出。
 */
function assertAttributionSourceKind(sourceKind) {
  // 条件分支: 页面请求值不是 system 或 custom 时进入。
  // 执行内容: 抛出类型错误，阻止两个声明页面越过各自来源边界。
  if (!SOURCE_ATTRIBUTION_KINDS.has(sourceKind)) {
    throw new TypeError('署名列表只允许查询系统源或自定义源');
  }

  return sourceKind;
}

/**
 * 从标准 SourceRecord 创建只读署名条目。
 * 纯函数: 只复制 Definition 的展示字段，不保留响应式记录引用。
 * 成功路径: 返回脚本名称、源站名称/域名、作者、版本、地址、说明和导入方式组成的冻结对象。
 * 失败路径: SourceManagerState 已负责结构校验；字段意外缺失时使用平台缺省文案或关闭外链，不猜测站点身份。
 *
 * @param {object} record SourceManager 发布的标准数据源记录。
 * @returns {Readonly<object>} 设置页可直接消费的署名条目。
 * @returns {string} return.id 数据源稳定 id，仅用于 Vue 列表 key。
 * @returns {string} return.name 不超过十个 Unicode 字符的显示名称。
 * @returns {string} return.siteName 与 name 共用 Definition.name 的源站名称。
 * @returns {string} return.siteDomain 从安全 siteUrl 即时派生的 hostname 或空字符串。
 * @returns {string} return.authorName Provider 脚本作者。
 * @returns {string} return.version 当前脚本业务版本。
 * @returns {string} return.siteUrl 安全 HTTPS 原站地址或空字符串。
 * @returns {string} return.description Provider 非空说明或空字符串。
 * @returns {string} return.importMethod 保存的导入方式枚举。
 * @returns {string} return.importMethodLabel 导入方式用户文案。
 */
function createAttributionEntry(record) {
  // 类型: object。
  // 来源: SourceManagerState.records[].definition；作用: 署名列表唯一业务字段来源。
  const definition = record?.definition || {};
  // 类型: string；作用: 全站统一截断 Definition.name，一次计算后同时提供脚本名称和当前阶段共用的源站名称。
  const displayName = formatSourceDisplayName(definition.name, definition.id);
  // 类型: Readonly<object>；作用: 保存经过统一 HTTPS 规则过滤的页面地址与即时域名，不保留 Definition 引用。
  const siteDisplay = createSourceSiteDisplay(definition.siteUrl);
  // 类型: string。
  // 作用: 只采用统一展示映射；未知值明确显示“未知方式”，不猜测导入来源。
  const importMethodLabel = IMPORT_METHOD_TEXT[definition.importMethod] || '未知方式';

  return Object.freeze({
    id: typeof definition.id === 'string' ? definition.id : '',
    name: displayName,
    siteName: displayName,
    siteDomain: siteDisplay.siteDomain,
    authorName: typeof definition.authorName === 'string' && definition.authorName.trim()
      ? definition.authorName.trim()
      : SOURCE_ATTRIBUTION_POLICY.anonymousAuthorName,
    version: typeof definition.version === 'string' ? definition.version : '',
    siteUrl: siteDisplay.siteUrl,
    description: typeof definition.description === 'string' ? definition.description : '',
    importMethod: typeof definition.importMethod === 'string' ? definition.importMethod : '',
    importMethodLabel
  });
}

/**
 * 按来源类型投影数据源署名条目。
 * 纯函数: 不修改记录数组、Definition 或条目顺序，每次返回新的冻结数组。
 * 成功路径: 只保留 sourceKind 完全匹配的记录，并保持 SourceManager 的权威顺序。
 * 失败路径: records 不是数组时返回空列表；来源类型非法时抛出 TypeError。
 *
 * @param {*} records SourceManagerState.records 候选值。
 * @param {string} sourceKind system 或 custom 来源类型。
 * @returns {ReadonlyArray<Readonly<object>>} 指定来源的只读署名条目。
 */
export function projectSourceAttributionEntries(records, sourceKind) {
  // 类型: string；作用: 在遍历前固定合法来源类型，避免每条记录重复执行自由值判断。
  const normalizedSourceKind = assertAttributionSourceKind(sourceKind);
  // 类型: Array<object>；作用: 非数组投影失败关闭为空列表，不让页面读取对象原型字段。
  const sourceRecords = Array.isArray(records) ? records : [];

  return Object.freeze(sourceRecords
    .filter(record => record?.definition?.sourceKind === normalizedSourceKind)
    .map(createAttributionEntry));
}

/**
 * 读取当前响应式署名列表。
 * 数据来源: settingsStore.sourceManager.records，由 SourceManagementRuntime 完整发布。
 * 副作用: 无；函数只读取当前 Vue observable 引用，不修改 Store、Repository 或 Provider。
 * 成功路径: 返回当前来源类型对应的冻结展示条目。
 * 失败路径: 来源类型非法时抛出 TypeError，Store 尚未初始化时返回空列表。
 *
 * @param {string} sourceKind system 或 custom 来源类型。
 * @returns {ReadonlyArray<Readonly<object>>} 当前设置页署名条目。
 */
export function getSourceAttributionEntries(sourceKind) {
  return projectSourceAttributionEntries(settingsStore.sourceManager.records, sourceKind);
}
