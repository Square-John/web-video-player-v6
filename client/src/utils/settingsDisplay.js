/*
  settingsDisplay.js 模块说明

  - 文件职责:
      提供设置页状态、来源类型、导入方式、能力、时间和缓存占用的统一展示格式。
      避免数据源列表和详情页面分别维护状态文案与格式化规则。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SOURCE_KIND、HEALTH_STATUS、IMPORT_METHOD、AUTHORIZATION_STATUS: 自定义配置，提供展示映射使用的受控枚举。

  - 模块级常量:
      SOURCE_KIND_TEXT: object，数据源类型文案映射。
      HEALTH_STATUS_TEXT: object，健康状态文案映射。
      SOURCE_CLOSED_STATUS_TEXT: string，关闭状态统一文案。
      IMPORT_METHOD_TEXT: object，导入方式文案映射。
      AUTHORIZATION_STATUS_TEXT: object，脚本授权状态文案映射。
      SOURCE_KIND_FILTER_DEFINITIONS: Array<object>，数据源来源筛选项定义。
      CAPABILITY_DEFINITIONS: Array<object>，页面能力展示定义。
      BYTE_UNIT_BASE: number，缓存容量换算进制。
      BYTE_UNITS: Array<string>，缓存容量单位。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SOURCE_KIND_TEXT、HEALTH_STATUS_TEXT、IMPORT_METHOD_TEXT、AUTHORIZATION_STATUS_TEXT、CAPABILITY_DEFINITIONS: 展示映射常量。
      SOURCE_KIND_FILTER_DEFINITIONS: Array<object>，数据源列表来源筛选项。
      formatCacheBytes(bytes): Function，格式化缓存占用。
      formatSettingsDate(value): Function，格式化设置页时间。
      getSourceRuntimeStatusText(record): Function，获取启停优先的状态文案。
      getSourceRuntimeStatusKey(record): Function，获取启停优先的状态样式键。
*/

import {
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 运行授权状态枚举。
  // 文件作用: 让授权文案映射和业务状态值保持同源。
  AUTHORIZATION_STATUS,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 三态健康枚举。
  // 文件作用: 让健康文案和样式键与检测状态保持同源。
  HEALTH_STATUS,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 让导入方式文案与导入记录字段保持同源。
  IMPORT_METHOD,
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 让来源类型文案与删除和授权分支保持同源。
  SOURCE_KIND
} from '../config/source-manager.config.js';

// 类型: object。
// 作用: 把数据源类型值转换成普通用户可读文案。
export const SOURCE_KIND_TEXT = Object.freeze({
  // 类型: string；作用: 系统内置数据源在列表和详情中的用户文案。
  [SOURCE_KIND.system]: '系统源',
  // 类型: string；作用: 用户导入数据源在列表和详情中的用户文案。
  [SOURCE_KIND.custom]: '自定义源'
});

// 类型: object。
// 作用: 把三态健康值转换成列表和详情共用文案。
export const HEALTH_STATUS_TEXT = Object.freeze({
  // 类型: string；作用: 健康检测通过时展示的状态文案。
  [HEALTH_STATUS.normal]: '正常',
  // 类型: string；作用: 健康检测正在执行时展示的状态文案。
  [HEALTH_STATUS.checking]: '检测中',
  // 类型: string；作用: 健康检测失败或未知状态时展示的收敛文案。
  [HEALTH_STATUS.unavailable]: '不可用'
});

// 类型: string。
// 作用: 数据源关闭时覆盖健康状态显示，供列表和详情使用同一用户文案。
export const SOURCE_CLOSED_STATUS_TEXT = '已关闭';

// 类型: object。
// 作用: 把数据源加入方式转换成详情页可读文案。
export const IMPORT_METHOD_TEXT = Object.freeze({
  // 类型: string；作用: 系统随应用提供的数据源导入文案。
  [IMPORT_METHOD.builtin]: '系统内置',
  // 类型: string；作用: 用户从本地文件导入脚本的文案。
  [IMPORT_METHOD.file]: '文件导入',
  // 类型: string；作用: 用户从在线地址导入脚本的文案。
  [IMPORT_METHOD.remote]: '在线导入',
  // 类型: string；作用: 用户粘贴脚本文本导入的文案。
  [IMPORT_METHOD.text]: '粘贴文本'
});

// 类型: object。
// 作用: 把脚本运行授权状态转换成用户可读文案，不把授权误写成安全认证。
export const AUTHORIZATION_STATUS_TEXT = Object.freeze({
  // 类型: string；作用: 用户已确认脚本运行风险时展示的文案。
  [AUTHORIZATION_STATUS.authorized]: '已授权运行',
  // 类型: string；作用: 自定义脚本尚未获得用户确认时展示的文案。
  [AUTHORIZATION_STATUS.pending]: '等待授权',
  // 类型: string；作用: 用户主动撤销运行授权后展示的文案。
  [AUTHORIZATION_STATUS.revoked]: '已撤销授权'
});

// 类型: Array<object>。
// 作用: 统一数据源列表的来源筛选顺序、状态值和用户文案，避免页面模板重复维护三项固定配置。
// 条目字段: key，string，传给 settingsService 的来源筛选值。
// 条目字段: label，string，列表页筛选按钮展示文案。
export const SOURCE_KIND_FILTER_DEFINITIONS = Object.freeze([
  // 类型: object；作用: 定义不限制来源类型的全部记录筛选入口。
  Object.freeze({ key: 'all', label: '全部' }),
  // 类型: object；作用: 定义只展示系统内置数据源的筛选入口。
  Object.freeze({ key: 'system', label: '系统源' }),
  // 类型: object；作用: 定义只展示用户导入数据源的筛选入口。
  Object.freeze({ key: 'custom', label: '自定义源' })
]);

// 类型: Array<object>。
// 作用: 固定页面能力读取顺序和展示文案，列表与详情不得各自硬编码能力名称。
// 条目字段: key，string，与 SourceDefinition.capabilities 中的布尔字段对应。
// 条目字段: label，string，数据源详情能力 chip 展示文案。
export const CAPABILITY_DEFINITIONS = Object.freeze([
  // 类型: object；作用: 定义首页数据能力展示项。
  Object.freeze({ key: 'home', label: '首页' }),
  // 类型: object；作用: 定义电影页数据能力展示项。
  Object.freeze({ key: 'movie', label: '电影' }),
  // 类型: object；作用: 定义电视剧页数据能力展示项。
  Object.freeze({ key: 'tv', label: '电视剧' }),
  // 类型: object；作用: 定义搜索数据能力展示项。
  Object.freeze({ key: 'search', label: '搜索' }),
  // 类型: object；作用: 定义详情数据能力展示项。
  Object.freeze({ key: 'detail', label: '详情' }),
  // 类型: object；作用: 定义播放数据能力展示项。
  Object.freeze({ key: 'play', label: '播放' })
]);

// 类型: number。
// 作用: 使用二进制进制换算缓存容量，避免格式化函数散落数字 1024。

const BYTE_UNIT_BASE = 1024;

// 类型: Array<string>。
// 作用: 按容量级别提供缓存单位，格式化函数根据指数选择对应单位。

const BYTE_UNITS = Object.freeze(['B', 'KB', 'MB', 'GB']);

/**
 * 格式化缓存字节数。
 * 纯函数: 相同字节数始终返回相同容量文本，不读取或修改外部状态。
 * 兜底策略: 非有限数值和负数按 0B 处理。
 *
 * @param {number} bytes 原始缓存字节数。
 * @returns {string} 带容量单位的用户可读文本。
 */

export function formatCacheBytes(bytes) {
  // 类型: number。
  // 作用: 把非法或负数字节数归一为 0，保证对数计算和页面展示稳定。

  const safeBytes = Number.isFinite(Number(bytes)) && Number(bytes) > 0 ? Number(bytes) : 0;

  // 条件分支: 缓存占用为 0 时进入。
  // 执行内容: 返回明确 0B，避免对 0 执行对数计算。

  if (safeBytes === 0) return '0 B';

  // 类型: number。
  // 作用: 根据缓存数量计算容量单位指数，并限制在现有单位数组范围内。

  const unitIndex = Math.min(
    Math.floor(Math.log(safeBytes) / Math.log(BYTE_UNIT_BASE)),
    BYTE_UNITS.length - 1
  );

  // 类型: number。
  // 作用: 把原始字节数转换为目标单位数值。

  const unitValue = safeBytes / (BYTE_UNIT_BASE ** unitIndex);

  // 类型: number。
  // 作用: 小于 10 的容量保留一位小数，较大容量使用整数降低视觉噪声。

  const fractionDigits = unitValue < 10 && unitIndex > 0 ? 1 : 0;

  // 返回值类型: string。
  // 作用: 返回列表摘要和详情缓存区域共用容量文本。
  return `${unitValue.toFixed(fractionDigits)} ${BYTE_UNITS[unitIndex]}`;
}

/**
 * 格式化设置页 ISO 时间。
 * 纯函数: 相同时间输入在相同时区下返回一致文本，不修改外部状态。
 * 兜底策略: 空值或无效时间返回“暂无记录”。
 *
 * @param {string} value ISO 时间字符串。
 * @returns {string} 本地化日期时间文本或“暂无记录”。
 */

export function formatSettingsDate(value) {
  // 条件分支: 时间值为空时进入。
  // 执行内容: 返回稳定空记录文案，避免页面显示空白或 undefined。

  if (!value) return '暂无记录';

  // 类型: Date。
  // 作用: 把 ISO 字符串转换成本地日期对象，供中文界面展示。

  const dateValue = new Date(value);

  // 条件分支: Date 无法解析输入时进入。
  // 执行内容: 返回稳定空记录文案，避免页面显示 Invalid Date。

  if (Number.isNaN(dateValue.getTime())) return '暂无记录';

  // 返回值类型: string。
  // 作用: 使用中文数字日期和 24 小时时间展示导入、更新和检测时间。
  return dateValue.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 获取数据源当前展示状态文案。
 * 规则: 已关闭属于启用状态并优先于健康状态；已启用时才展示三态健康结果。
 *
 * @param {object} record SourceRecord 数据源记录。
 * @param {object} record.runtime 当前数据源运行状态。
 * @param {boolean} record.runtime.enabled 当前数据源是否启用。
 * @param {string} record.runtime.healthStatus 当前三态健康值。
 * @returns {string} “已关闭”或三态健康状态文案。
 * 纯函数: 只读取记录并返回展示文案，不修改记录或页面状态。
 */

export function getSourceRuntimeStatusText(record) {
  // 条件分支: 记录缺失或 runtime.enabled 不为 true 时进入。
  // 执行内容: 返回关闭状态，避免缺失数据被误报为健康正常。

  if (!record || !record.runtime || !record.runtime.enabled) return SOURCE_CLOSED_STATUS_TEXT;

  // 返回值类型: string。
  // 作用: 读取统一三态文案；未知状态按不可用处理，不新增第四种用户状态。
  return HEALTH_STATUS_TEXT[record.runtime.healthStatus] || HEALTH_STATUS_TEXT.unavailable;
}

/**
 * 获取数据源当前展示状态样式键。
 * 规则与 getSourceRuntimeStatusText 保持一致，供列表和详情使用同一状态类名来源。
 *
 * @param {object} record SourceRecord 数据源记录。
 * @param {object} record.runtime 当前数据源运行状态。
 * @param {boolean} record.runtime.enabled 当前数据源是否启用。
 * @param {string} record.runtime.healthStatus 当前三态健康值。
 * @returns {string} closed、normal、checking 或 unavailable。
 * 纯函数: 只读取记录并返回样式键，不修改记录或页面状态。
 */

export function getSourceRuntimeStatusKey(record) {
  // 条件分支: 记录缺失或已关闭时返回 closed，确保关闭态不沿用历史健康颜色。
  // 执行内容: 返回统一关闭样式键，不继续读取可能不存在的健康状态。
  if (!record || !record.runtime || !record.runtime.enabled) return 'closed';

  // 条件分支: 当前健康值存在统一文案映射时原样返回，否则收敛到 unavailable。
  return HEALTH_STATUS_TEXT[record.runtime.healthStatus] ? record.runtime.healthStatus : 'unavailable';
}
