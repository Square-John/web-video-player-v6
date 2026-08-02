/*
  documentTitleService.js 模块说明

  - 文件职责:
      集中生成并采用全站浏览器标签页标题。
      Router 提供静态页面标题，详情和播放页可以追加当前严格 ContentItem 标题，但页面不自行拼接应用名称。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      APPLICATION_DOCUMENT_TITLE: string，浏览器标题固定应用名称。
      DOCUMENT_TITLE_SEPARATOR: string，标题层级分隔文本。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeDocumentTitlePart(value): 把任意标题输入标准化为单行文本。

  - 模块级类:
      无

  - 对外导出:
      createDocumentTitle(route, contentTitle): 生成静态或内容级浏览器标题。
      applyDocumentTitle(route, contentTitle): 在浏览器环境采用统一标题并返回最终文本。
*/

// 类型: string；作用: 所有页面浏览器标题的固定应用后缀，页面和 Router 不重复声明。
const APPLICATION_DOCUMENT_TITLE = 'Web Video Player';

// 类型: string；作用: 分隔内容标题、路由标题和应用名称，保持所有页面标签页格式一致。
const DOCUMENT_TITLE_SEPARATOR = ' - ';

/**
 * 标准化单个浏览器标题片段。
 * 纯函数: 不访问 document 或 Router，只把空白字符收敛为单个空格。
 *
 * @param {*} value 路由 meta.title 或 ContentItem.title。
 * @returns {string} 可安全进入 document.title 的单行文本。
 */
function normalizeDocumentTitlePart(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

/**
 * 生成统一浏览器标题。
 * 纯函数: 只读取 route.meta.title 与可选内容标题，不修改路由或浏览器状态。
 * 成功路径: 内容标题、页面标题和应用名按层级拼接；重复相邻片段只保留一次。
 * 失败路径: 路由与内容均无标题时只返回应用名称。
 *
 * @param {object|null|undefined} route 当前 Vue Router 路由对象。
 * @param {string} [contentTitle] 详情或播放页当前严格 ContentItem 标题。
 * @returns {string} 最终浏览器标题。
 */
export function createDocumentTitle(route, contentTitle = '') {
  // 类型: Array<string>；作用: 按内容、页面、应用层级收集已标准化的标题片段。
  const candidates = [
    normalizeDocumentTitlePart(contentTitle),
    normalizeDocumentTitlePart(route?.meta?.title),
    APPLICATION_DOCUMENT_TITLE
  ].filter(Boolean);

  // 类型: Array<string>；作用: 移除相邻重复片段，避免“详情 - 详情”类标题。
  const uniqueParts = candidates.filter((part, index) => index === 0 || part !== candidates[index - 1]);
  return uniqueParts.join(DOCUMENT_TITLE_SEPARATOR);
}

/**
 * 在当前浏览器采用统一标题。
 * 副作用: 浏览器环境写入 document.title；Node 静态测试环境只返回标题文本。
 * 成功路径: 返回值与浏览器标签页采用值完全一致。
 * 失败路径: document 不存在时不创建浏览器替身，也不抛出环境错误。
 *
 * @param {object|null|undefined} route 当前 Vue Router 路由对象。
 * @param {string} [contentTitle] 详情或播放页当前严格 ContentItem 标题。
 * @returns {string} 已生成的最终浏览器标题。
 */
export function applyDocumentTitle(route, contentTitle = '') {
  // 类型: string；作用: 使用唯一纯函数生成标题，Router 和页面不自行维护格式。
  const title = createDocumentTitle(route, contentTitle);
  // 条件分支: 当前运行环境提供浏览器 document 时进入。执行内容: 原子替换当前标签页标题。
  if (typeof document !== 'undefined') {
    document.title = title;
  }
  return title;
}
