/*
  mediaDuration.js 模块说明

  - 文件职责:
      解析 ContentItem、播放历史和当前媒体会话可能提供的时长值，并输出全站视频卡片使用的短时长文本。
      本模块只负责显示适配，不修改 Provider 原始字段、播放历史或播放器会话。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SECONDS_PER_MINUTE: number，分钟换算常量。
      SECONDS_PER_HOUR: number，小时换算常量。
      DISPLAY_SEGMENT_WIDTH: number，时分秒显示段统一宽度。
      MAX_CLOCK_SUBUNIT: number，冒号时长的分钟和秒段允许的最大值。
      MINUTE_TEXT_PATTERN: RegExp，Provider 分钟文案解析规则。
      CLOCK_TEXT_PATTERN: RegExp，Provider 冒号时长解析规则。

  - 模块级变量:
      无

  - 模块级类:
      无

  - 模块级辅助函数:
      parseClockTextToSeconds: 解析 mm:ss 或 hh:mm:ss 文本，不产生外部副作用。
      padTimeSegment: 把合法时间段补齐为两位显示文本。

  - 对外导出:
      parseMediaDurationSeconds: 将支持的时长值转换为非负整数秒数或 null。
      formatCompactMediaDuration: 将支持的时长值转换为 mm:ss 或 hh:mm:ss，非法值返回空字符串。
*/

// 类型: number；作用: 把分钟文案和冒号时长换算为秒数，避免在解析分支中散落换算数字。
const SECONDS_PER_MINUTE = 60;

// 类型: number；作用: 判断是否需要输出小时段，并完成小时到秒的换算。
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;

// 类型: number；作用: 统一小时、分钟和秒段的显示宽度。
const DISPLAY_SEGMENT_WIDTH = 2;

// 类型: number；作用: 约束 hh:mm:ss 中分钟和秒段的有效范围。
const MAX_CLOCK_SUBUNIT = 59;

// 类型: RegExp；作用: 识别 Provider 常见的分钟时长文案，允许整数或小数分钟。
const MINUTE_TEXT_PATTERN = /^(\d+(?:\.\d+)?)\s*(?:分钟|min|mins|minutes)$/iu;

// 类型: RegExp；作用: 识别由两段或三段数字组成的冒号时长文本。
const CLOCK_TEXT_PATTERN = /^\d+(?::\d{1,2}){1,2}$/u;

/**
 * 把冒号时长文本解析为秒数。
 * 纯函数: 只读取输入文本，不修改任何状态。
 * 失败路径: 段数、分钟/秒范围或数字合法性不满足时返回 null。
 *
 * @param {string} value 已通过 CLOCK_TEXT_PATTERN 的冒号时长文本。
 * @returns {number|null} 非负整数秒数，无法解析时返回 null。
 */
function parseClockTextToSeconds(value) {
  // 类型: Array<number>；作用: 将每个冒号段转换为数值，后续统一校验范围。
  const segments = value.split(':').map(segment => Number(segment));

  // 条件分支: 任意段不是非负有限整数时进入。
  // 执行内容: 拒绝不稳定的播放时长，避免页面显示 NaN 或小数秒。
  if (segments.some(segment => !Number.isSafeInteger(segment) || segment < 0)) {
    return null;
  }

  // 类型: number；作用: 读取最后一段秒数，mm:ss 与 hh:mm:ss 都必须满足同一秒段边界。
  const seconds = segments.at(-1);

  // 条件分支: 秒段超过一个分钟时进入。
  // 执行内容: 拒绝不符合时钟语义的文本，不把错误文本强行折算。
  if (seconds > MAX_CLOCK_SUBUNIT) {
    return null;
  }

  // 条件分支: 两段时长进入，第一段可以表示超过 59 分钟的累计分钟数。
  // 执行内容: 按累计分钟换算，达到一小时后由格式化函数决定是否显示小时段。
  if (segments.length === 2) {
    return segments[0] * SECONDS_PER_MINUTE + seconds;
  }

  // 类型: number；作用: 三段时长的分钟段必须处于标准时钟范围。
  const minutes = segments[1];

  // 条件分支: 分钟段超过一个小时或段数不符合预期时进入。
  // 执行内容: 返回 null，防止把非法源数据误当作规范时长。
  if (minutes > MAX_CLOCK_SUBUNIT || segments.length !== 3) {
    return null;
  }

  return segments[0] * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
}

/**
 * 把合法时间段补齐为固定宽度。
 * 纯函数: 只返回格式化字符串，不修改输入。
 *
 * @param {number} value 非负整数时间段。
 * @returns {string} 两位时间段文本。
 */
function padTimeSegment(value) {
  return String(value).padStart(DISPLAY_SEGMENT_WIDTH, '0');
}

/**
 * 解析页面可接收的媒体时长值。
 * 支持播放器秒数、数字字符串、分钟文案、mm:ss 和 hh:mm:ss；不理解业务字段含义。
 * 纯函数: 不访问 Provider、Store、Repository 或浏览器媒体元素。
 * 失败路径: 空值、负数、非有限数字和不支持的文本返回 null。
 *
 * @param {number|string|null|undefined} value 原始媒体时长。
 * @returns {number|null} 非负整数秒数，无法解析时返回 null。
 */
export function parseMediaDurationSeconds(value) {
  // 条件分支: number 输入进入。
  // 执行内容: 直接按秒数处理，向下取整以保持显示和播放历史的整数秒边界。
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }

  // 条件分支: 非字符串输入进入。
  // 执行内容: 统一返回未知，避免把对象、布尔值或数组隐式转换成时长。
  if (typeof value !== 'string') {
    return null;
  }

  // 类型: string；作用: 去掉 Provider 文案两端空白，空文案表示没有可用时长。
  const normalizedValue = value.trim();

  // 条件分支: 空字符串进入。
  // 执行内容: 返回未知时长，不伪造总时长或播放进度。
  if (!normalizedValue) {
    return null;
  }

  // 类型: number；作用: 读取纯数字字符串，约定其单位与播放器字段一致为秒。
  const numericValue = Number(normalizedValue);

  // 条件分支: 纯数字字符串且为非负有限数时进入。
  // 执行内容: 将其按秒解析，兼容持久化层序列化后的数字字段。
  if (/^\d+(?:\.\d+)?$/u.test(normalizedValue) && Number.isFinite(numericValue)) {
    return Math.floor(numericValue);
  }

  // 类型: RegExpMatchArray|null；作用: 提取“128分钟”或“128 min”等源站分钟文案。
  const minuteMatch = normalizedValue.match(MINUTE_TEXT_PATTERN);

  // 条件分支: 命中分钟文案时进入。
  // 执行内容: 按分钟换算并向下取整到整数秒。
  if (minuteMatch) {
    return Math.floor(Number(minuteMatch[1]) * SECONDS_PER_MINUTE);
  }

  // 条件分支: 命中冒号时长时进入。
  // 执行内容: 委托统一时钟解析函数校验段范围并换算秒数。
  if (CLOCK_TEXT_PATTERN.test(normalizedValue)) {
    return parseClockTextToSeconds(normalizedValue);
  }

  return null;
}

/**
 * 输出全站视频卡片使用的短时长文本。
 * 小于一小时使用 mm:ss，达到一小时使用 hh:mm:ss，所有段均固定两位。
 * 纯函数: 只解析输入并返回文本，不修改原始 ContentItem 或播放状态。
 * 失败路径: 无法解析时返回空字符串；合法零秒返回 00:00。
 *
 * @param {number|string|null|undefined} value 原始媒体时长。
 * @returns {string} mm:ss、hh:mm:ss 或空字符串。
 */
export function formatCompactMediaDuration(value) {
  // 类型: number|null；作用: 获取统一的整数秒数，屏蔽不同来源的原始格式差异。
  const totalSeconds = parseMediaDurationSeconds(value);

  // 条件分支: 输入无法解析时进入。
  // 执行内容: 返回空文本，由卡片决定是否隐藏总时长或保留播放零值占位。
  if (totalSeconds === null) {
    return '';
  }

  // 类型: number；作用: 计算完整小时数，决定输出两段还是三段时间。
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);

  // 类型: number；作用: 计算去除小时后的分钟数，确保 hh:mm:ss 分钟段不溢出。
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  // 类型: number；作用: 计算剩余秒数，始终保持 0 至 59。
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  // 类型: string；作用: 统一补齐分钟和秒段，保证卡片不同数据源的视觉宽度一致。
  const minuteText = padTimeSegment(minutes);

  // 类型: string；作用: 统一补齐秒段，保证每个卡片的进度文本宽度稳定。
  const secondText = padTimeSegment(seconds);

  // 条件分支: 时长达到一小时进入。
  // 执行内容: 输出固定三段 hh:mm:ss，小时也补齐两位。
  if (hours > 0) {
    return `${padTimeSegment(hours)}:${minuteText}:${secondText}`;
  }

  return `${minuteText}:${secondText}`;
}
