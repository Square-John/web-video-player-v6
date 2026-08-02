/*
  homeDisplay.config.js 模块说明

  - 文件职责:
      定义首页展示偏好的字段版本、轮播数量范围和默认值。
      供轮播组件、设置页、Service、Repository 校验和 IndexedDB 迁移共享同一领域边界。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION: string，展示偏好结构版本。
      HOME_CAROUSEL_ITEM_LIMIT: Readonly<object>，轮播数量最小值、最大值、步长和默认值。
      HOME_CAROUSEL_AUTOPLAY_INTERVAL_MILLISECONDS: number，轮播自动切换间隔。
      HOME_DISPLAY_PREFERENCES_FIELDS: Array<string>，展示偏好精确字段集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION: string，持久化与迁移共用结构版本。
      HOME_CAROUSEL_ITEM_LIMIT: Readonly<object>，设置控件和轮播组件共用数量边界。
      HOME_CAROUSEL_AUTOPLAY_INTERVAL_MILLISECONDS: number，轮播组件自动切换间隔。
      createDefaultHomeDisplayPreferences: Function，创建不共享引用的默认偏好。
      normalizeHomeDisplayPreferences: Function，严格校验并复制完整展示偏好。
      resolveHomeCarouselItemLimit: Function，把非持久化输入收敛为安全展示数量。
*/

// 类型: string；作用: 标识 HomeDisplayPreferences 当前精确字段结构，供迁移和 Repository 校验。
export const HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION = '1.0.0';

// 类型: Readonly<object>。
// 作用: 冻结首页轮播数量设置的全部领域数字；任何页面和测试都必须引用该对象而不是重复字面值。
export const HOME_CAROUSEL_ITEM_LIMIT = Object.freeze({
  // 类型: number；作用: 至少展示一条轮播内容，避免设置生成永久空轮播。
  minimum: 1,
  // 类型: number；作用: 最多展示一百条轮播内容，并让请求、保存和组件截断共享同一产品上限。
  maximum: 100,
  // 类型: number；作用: 设置页每次按整数一条调整，不接受小数展示数量。
  step: 1,
  // 类型: number；作用: 首次空库和恢复默认仍展示十条，不因可选上限扩展而改变既有用户默认体验。
  defaultValue: 10
});

// 类型: number；作用: 统一首页轮播自动切换节奏，组件不得另写时间字面值或固定等待。
export const HOME_CAROUSEL_AUTOPLAY_INTERVAL_MILLISECONDS = 5000;

// 类型: Array<string>；作用: 展示偏好必须精确包含结构版本和轮播数量，不允许页面影子字段进入保存对象。
const HOME_DISPLAY_PREFERENCES_FIELDS = Object.freeze(['schemaVersion', 'carouselItemLimit']);

/**
 * 创建项目默认首页展示偏好。
 * 纯函数: 每次返回新的普通对象，不与冻结配置或其他调用方共享可变引用。
 *
 * @returns {object} 默认 HomeDisplayPreferences。
 * @returns {string} return.schemaVersion 展示偏好结构版本。
 * @returns {number} return.carouselItemLimit 默认轮播数量。
 */
export function createDefaultHomeDisplayPreferences() {
  return {
    schemaVersion: HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION,
    carouselItemLimit: HOME_CAROUSEL_ITEM_LIMIT.defaultValue
  };
}

/**
 * 严格校验首页展示偏好并创建隔离副本。
 * 纯函数: 不修改输入；字段、版本、整数或范围无效时失败关闭。
 *
 * @param {*} preferences 设置页、Repository 或迁移器提供的候选。
 * @returns {object} 已验证且不共享引用的 HomeDisplayPreferences。
 * @throws {TypeError} 候选不是精确普通对象或轮播数量越界时抛出。
 */
export function normalizeHomeDisplayPreferences(preferences) {
  // 条件分支: 候选不是普通对象时进入；执行内容: 拒绝数组、null 和自定义实例进入保存链。
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)
    || Object.getPrototypeOf(preferences) !== Object.prototype) {
    throw new TypeError('首页展示偏好必须是普通对象');
  }

  // 类型: Array<string>；作用: 读取候选实际字段，后续同时识别缺失和额外状态。
  const actualFields = Object.keys(preferences);
  // 条件分支: 字段数量或成员与正式契约不一致时进入；执行内容: 阻止影子设置或部分对象保存。
  if (actualFields.length !== HOME_DISPLAY_PREFERENCES_FIELDS.length
    || HOME_DISPLAY_PREFERENCES_FIELDS.some(field => !actualFields.includes(field))) {
    throw new TypeError('首页展示偏好字段不符合契约');
  }

  // 条件分支: 结构版本不是当前版本时进入；执行内容: 禁止页面静默解释未知未来对象。
  if (preferences.schemaVersion !== HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION) {
    throw new TypeError('首页展示偏好版本无效');
  }

  // 类型: number；作用: 保存待校验轮播数量，必须保持调用方原始数值语义。
  const carouselItemLimit = preferences.carouselItemLimit;
  // 条件分支: 数量不是范围内整数时进入；执行内容: 拒绝小数、字符串、NaN 和越界值。
  if (!Number.isInteger(carouselItemLimit)
    || carouselItemLimit < HOME_CAROUSEL_ITEM_LIMIT.minimum
    || carouselItemLimit > HOME_CAROUSEL_ITEM_LIMIT.maximum) {
    throw new TypeError('首页轮播数量必须是允许范围内的整数');
  }

  return {
    schemaVersion: preferences.schemaVersion,
    carouselItemLimit
  };
}

/**
 * 把组件 prop 或尚未初始化的投影收敛为安全轮播数量。
 * 纯函数: 合法整数原样返回；非法输入回到项目默认值，不修改输入。
 * 使用边界: 只用于渲染防御；Repository 保存仍必须调用严格 normalizeHomeDisplayPreferences。
 *
 * @param {*} value 轮播组件收到的数量候选。
 * @returns {number} 合法数量或项目默认数量。
 */
export function resolveHomeCarouselItemLimit(value) {
  // 条件分支: 输入是正式范围内整数时进入；执行内容: 原样采用用户已提交设置。
  if (Number.isInteger(value)
    && value >= HOME_CAROUSEL_ITEM_LIMIT.minimum
    && value <= HOME_CAROUSEL_ITEM_LIMIT.maximum) {
    return value;
  }

  // 返回值类型: number；作用: 初始化空投影或异常 prop 回到默认十条，不能绕过正式数量边界。
  return HOME_CAROUSEL_ITEM_LIMIT.defaultValue;
}
