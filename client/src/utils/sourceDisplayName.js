/*
  sourceDisplayName.js 模块说明

  - 文件职责:
      提供全站用户界面显示数据源名称的唯一适配入口。
      只处理展示文本，不修改 Provider manifest、SourceDefinition、ContentItem 或任何保存状态。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_DISPLAY_NAME_MAX_LENGTH: number，用户界面允许展示的数据源名称最大 Unicode 字符数。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeDisplayNameValue(value): 清理字符串输入并返回可展示文本。
      formatSourceDisplayName(value, fallback): 按统一长度边界返回数据源显示名称。

  - 模块级类:
      无

  - 对外导出:
      SOURCE_DISPLAY_NAME_MAX_LENGTH: 显示边界配置，供测试和契约对照读取。
      formatSourceDisplayName: 页面、卡片、设置和状态文案共用的显示适配函数。
*/

// 类型: number；作用: 约束所有用户界面数据源名称最多展示 10 个 Unicode 字符，不影响完整保存名称。
export const SOURCE_DISPLAY_NAME_MAX_LENGTH = 10;

/**
 * 清理名称输入并返回可截取的文本。
 * 纯函数: 只读取输入，不产生网络、存储、DOM 或响应式状态副作用。
 * 成功路径: 字符串去除首尾空白后返回；非字符串或空字符串返回空值。
 * 失败路径: 非法输入不会抛错，由调用方继续使用兜底文本。
 *
 * @param {unknown} value Provider、保存对象或 ContentItem 提供的候选名称。
 * @returns {string} 清理后的名称，无法展示时为空字符串。
 */
function normalizeDisplayNameValue(value) {
  // 条件分支: 输入不是字符串时进入。
  // 执行内容: 返回空值，避免把对象或数字隐式转换成误导名称。
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

/**
 * 生成全站统一的数据源短名称。
 * 调用方: SourceSwitchTabs、VideoCard、内容详情/播放页面和设置操作文案。
 * 纯函数: 保留完整名称在调用方对象中，只返回当前显示位置需要的短文本。
 * 成功路径: 优先使用 value；value 缺失时使用 fallback；两者均无效时返回“当前数据源”。
 * 失败路径: 非字符串输入按空值处理，不抛出展示层异常。
 *
 * @param {unknown} value 数据源完整正式名称或 ContentItem 来源名称。
 * @param {unknown} fallback value 缺失时的 sourceId 或稳定占位文本。
 * @returns {string} 不超过 SOURCE_DISPLAY_NAME_MAX_LENGTH 个 Unicode 字符的显示名称。
 */
export function formatSourceDisplayName(value, fallback = '当前数据源') {
  // 类型: string；作用: 保存清理后的正式名称，空值表示需要进入兜底路径。
  const sourceName = normalizeDisplayNameValue(value);
  // 类型: string；作用: 保存清理后的 sourceId 或调用方占位文本，正式名称缺失时使用。
  const fallbackName = normalizeDisplayNameValue(fallback);
  // 类型: string；作用: 选择唯一待截取文本，保证所有非法输入仍得到稳定用户文案。
  const displayName = sourceName || fallbackName || '当前数据源';

  // 作用: Array.from 按 Unicode 码点切分，避免中文、英文和 emoji 被 UTF-16 半代理对截断。
  return Array.from(displayName)
    .slice(0, SOURCE_DISPLAY_NAME_MAX_LENGTH)
    .join('');
}
