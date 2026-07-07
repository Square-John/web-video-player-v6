/*
  contentKeys.js 模块说明

  - 文件职责:
      提供全站内容实体共享池使用的 contentKey 生成、解析和校验工具函数。
      供 siteContentStore.js、页面读取工具和后续用户内容状态引用逻辑复用。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      CONTENT_KEY_SEPARATOR: string，contentKey 中 sourceId 和 contentId 的分隔符。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeContentKeyPart(value)
          - params:
              -- value: any，待写入 contentKey 的原始字段值。
          - return:
              string，去除首尾空白后的字段文本。
          - description:
              将 sourceId、contentId 和外部传入值统一整理成稳定字符串。

  - 模块级类:
      无

  - 对外导出:
      CONTENT_KEY_SEPARATOR: string，contentKey 标准分隔符。
      buildContentKey: Function，根据 sourceId 和 contentId 生成 contentKey。
      getContentKeyFromItem: Function，根据 ContentItem 生成 contentKey。
      parseContentKey: Function，将 contentKey 解析成 sourceId 和 contentId。
      isValidContentKey: Function，判断 contentKey 是否包含有效 sourceId 和 contentId。
*/

// 类型: string。
// 作用: 统一连接 sourceId 和 contentId，避免 store、页面和服务层各自手写不同拼接规则。
export const CONTENT_KEY_SEPARATOR = '::';

/**
 * 标准化 contentKey 字段片段。
 * 纯函数: 相同 value 输入始终返回相同字符串，不读取或修改外部状态。
 * 兜底策略: null 和 undefined 返回空字符串，其他值转成字符串后去除首尾空白。
 *
 * @param {*} value 待写入 contentKey 的原始字段值。
 * @returns {string} 可用于 contentKey 拼接或解析的字段文本。
 */
function normalizeContentKeyPart(value) {
  // 条件分支: value 是 null 或 undefined 时进入。
  // 执行内容: 返回空字符串，让上层函数统一判断 contentKey 是否可用。
  if (value === null || value === undefined) {
    return '';
  }

  // 返回值类型: string。
  // 作用: 把数字等可标识值统一转成字符串，并去掉首尾空白，避免同一内容生成多个 key。
  return String(value).trim();
}

/**
 * 根据 sourceId 和 contentId 生成 contentKey。
 * 纯函数: 相同 sourceId 和 contentId 输入始终返回相同字符串。
 * 兜底策略: sourceId 或 contentId 任一为空时返回空字符串，避免生成不可定位的半截 key。
 *
 * @param {string} sourceId 内容所属数据源 id。
 * @param {string} contentId 内容 id，对应 ContentItem.id。
 * @returns {string} 内容实体池使用的唯一引用 key。
 */
export function buildContentKey(sourceId, contentId) {
  // 类型: string。
  // 作用: 标准化数据源 id，保证后续拼接使用的是可比较文本。
  const safeSourceId = normalizeContentKeyPart(sourceId);

  // 类型: string。
  // 作用: 标准化内容 id，保证后续拼接使用的是可比较文本。
  const safeContentId = normalizeContentKeyPart(contentId);

  // 条件分支: sourceId 或 contentId 缺失时进入。
  // 执行内容: 返回空字符串，调用方可据此跳过写入实体池或进入兜底逻辑。
  if (!safeSourceId || !safeContentId) {
    return '';
  }

  // 返回值类型: string。
  // 作用: 返回全站内容实体共享池的标准 key，例如 mock1::movie-001。
  return `${safeSourceId}${CONTENT_KEY_SEPARATOR}${safeContentId}`;
}

/**
 * 根据 ContentItem 生成 contentKey。
 * 纯函数: 只读取 contentItem.sourceId 和 contentItem.id，不修改传入对象。
 * 兜底策略: contentItem 不是对象或关键字段缺失时返回空字符串。
 *
 * @param {object} contentItem 内容对象。
 * @param {string} contentItem.sourceId 内容所属数据源 id。
 * @param {string} contentItem.id 内容 id。
 * @returns {string} 内容实体池使用的唯一引用 key。
 */
export function getContentKeyFromItem(contentItem) {
  // 类型: object。
  // 作用: contentItem 不是对象时使用空对象兜底，避免读取字段时报错。
  const safeContentItem = contentItem && typeof contentItem === 'object' ? contentItem : {};

  // 返回值类型: string。
  // 作用: 复用 buildContentKey，保证 ContentItem 生成 key 的规则和手动传参完全一致。
  return buildContentKey(safeContentItem.sourceId, safeContentItem.id);
}

/**
 * 解析 contentKey。
 * 纯函数: 只读取 contentKey 字符串，不修改外部状态。
 * 兜底策略: contentKey 不完整时返回空字段和 isValid=false，便于调用方安全判断。
 *
 * @param {string} contentKey 内容实体池引用 key。
 * @returns {object} 解析结果。
 * @returns {string} return.sourceId 解析出的数据源 id。
 * @returns {string} return.contentId 解析出的内容 id。
 * @returns {boolean} return.isValid 当前 contentKey 是否同时具备 sourceId 和 contentId。
 */
export function parseContentKey(contentKey) {
  // 类型: string。
  // 作用: 将外部传入 key 统一整理成字符串，避免对非字符串直接 split 报错。
  const safeContentKey = normalizeContentKeyPart(contentKey);

  // 类型: Array<string>。
  // 作用: 按标准分隔符拆解 key；后续允许 contentId 中少量出现分隔符时保留剩余片段。
  const keyParts = safeContentKey.split(CONTENT_KEY_SEPARATOR);

  // 类型: string。
  // 作用: 第一段固定表示 sourceId，缺失时为空字符串。
  const sourceId = normalizeContentKeyPart(keyParts[0]);

  // 类型: string。
  // 作用: 第二段及之后重新拼回 contentId，避免内容 id 自身包含分隔符时被截断。
  const contentId = normalizeContentKeyPart(keyParts.slice(1).join(CONTENT_KEY_SEPARATOR));

  // 类型: boolean。
  // 作用: 判断解析结果是否能定位到唯一内容实体。
  const isValid = Boolean(sourceId && contentId);

  // 返回值类型: object。
  // 作用: 返回结构化解析结果，供 store、补全服务和调试逻辑复用。
  return {
    // 类型: string。
    // 作用: 内容所属数据源 id。
    sourceId,

    // 类型: string。
    // 作用: 内容 id，对应 ContentItem.id。
    contentId,

    // 类型: boolean。
    // 作用: true 表示解析结果可用于查找实体池，false 表示应跳过查找或进入兜底逻辑。
    isValid
  };
}

/**
 * 判断 contentKey 是否有效。
 * 纯函数: 只读取 contentKey，不修改外部状态。
 * 使用场景: 写入 itemKeys/currentKey 前做轻量防御，避免无效 key 污染页面桶。
 *
 * @param {string} contentKey 内容实体池引用 key。
 * @returns {boolean} 当前 key 是否同时具备 sourceId 和 contentId。
 */
export function isValidContentKey(contentKey) {
  // 类型: object。
  // 作用: 复用统一解析逻辑，避免校验规则和 parseContentKey 出现偏差。
  const parsedContentKey = parseContentKey(contentKey);

  // 返回值类型: boolean。
  // 作用: 返回 contentKey 是否可用于实体池定位。
  return parsedContentKey.isValid;
}
