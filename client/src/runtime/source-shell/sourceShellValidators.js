/*
  sourceShellValidators.js 模块说明

  - 文件职责:
      集中校验和隔离 Source Shell 的 sourceId、参数数量、AbortSignal、网络请求、挑战和日志输入。
      所有能力模块复用同一组精确字段、容量和错误转换规则。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      SOURCE_CHALLENGE_FIELD_TYPE、SOURCE_NETWORK_METHOD、SOURCE_NETWORK_POLICY、SOURCE_NETWORK_RESPONSE_TYPE、SOURCE_LOGGER_POLICY: 自定义配置，提供允许值和容量边界。
      cloneSerializableValue、getSerializableByteLength: 自定义 Repository 工具，隔离 JSON Value 并计算 UTF-8 字节。
      assertNonEmptyString、assertPlainObject、assertSafeRecordKey、assertSerializableJsonValue: 自定义 Repository 校验，复用严格对象和危险键规则。
      SourceShellAbortedError、SourceShellLimitError、SourceShellValidationError: 自定义 Shell 错误，统一失败分类。

  - 模块级常量:
      SOURCE_NETWORK_REQUEST_FIELDS: Array<string>，标准网络请求精确字段。
      SOURCE_CHALLENGE_FIELDS: Array<string>，标准挑战精确字段。
      SOURCE_CHALLENGE_FIELD_FIELDS: Array<string>，单项输入声明精确字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      wrapValidation(action): Function，把 Repository 校验错误转换为 Shell validation。
      assertExactFields(value, fields, fieldName): Function，拒绝缺失或额外字段。
      assertIntegerInRange(value, min, max, fieldName): Function，校验整数策略范围。
      normalizeHeaders(headers): Function，规范化并隔离请求头。
      normalizeNetworkBody(body, method): Function，校验方法对应请求体和容量。
      normalizeSourceChallengeFields(fields): Function，校验页面无关挑战输入声明。

  - 模块级类:
      无

  - 对外导出:
      normalizeSourceShellId、assertExactArgumentCount、assertAbortSignal、assertNotAborted: Function，基础边界校验。
      normalizeSourceNetworkRequest、normalizeSourceChallenge、normalizeSourceChallengeValues、normalizeSourceLogInput: Function，标准输入和挑战结果规范化。
*/

import {
  // 导入来源: ./source-shell.config.js。
  // 导入内容: SOURCE_CHALLENGE_FIELD_TYPE 挑战输入类型枚举。
  // 文件作用: 拒绝 Provider 声明任意页面控件类型。
  SOURCE_CHALLENGE_FIELD_TYPE,

  // 导入来源: ./source-shell.config.js。
  // 导入内容: SOURCE_LOGGER_POLICY 日志容量策略。
  // 文件作用: 校验消息长度和 details 字节上限。
  SOURCE_LOGGER_POLICY,

  // 导入来源: ./source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_METHOD 网络方法枚举。
  // 文件作用: 拒绝 GET/POST 之外的方法和 GET 请求体。
  SOURCE_NETWORK_METHOD,

  // 导入来源: ./source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_POLICY 网络字段与容量策略。
  // 文件作用: 校验 URL、header、body、timeout 和响应上限。
  SOURCE_NETWORK_POLICY,

  // 导入来源: ./source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_RESPONSE_TYPE 响应类型枚举。
  // 文件作用: 限制 Provider 请求 json、text 或 arrayBuffer。
  SOURCE_NETWORK_RESPONSE_TYPE
} from './source-shell.config.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
  // 文件作用: 隔离网络 body、挑战 fields 和日志 details。
  cloneSerializableValue,

  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: getSerializableByteLength JSON Value 字节计算函数。
  // 文件作用: 统一校验 header、body 和日志详情容量。
  getSerializableByteLength
} from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertNonEmptyString 非空字符串校验。
  // 文件作用: 校验 sourceId、requestId、URL、header、挑战和日志消息。
  assertNonEmptyString,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 普通对象校验。
  // 文件作用: 拒绝数组、类实例和异常原型进入 Shell 对象边界。
  assertPlainObject,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertSafeRecordKey 动态键安全校验。
  // 文件作用: 请求头名称统一拒绝原型敏感键。
  assertSafeRecordKey,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertSerializableJsonValue 严格 JSON Value 校验。
  // 文件作用: 校验请求体、挑战 fields 和日志详情不会有损序列化。
  assertSerializableJsonValue
} from '../../repositories/source/sourceRepositoryValidators.js';

import {
  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellAbortedError 生命周期中止错误。
  // 文件作用: 所有能力共用同一 aborted code。
  SourceShellAbortedError,

  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellLimitError 容量超限错误。
  // 文件作用: 区分字段格式错误和策略容量超限。
  SourceShellLimitError,

  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellValidationError Shell 输入错误。
  // 文件作用: 包装 Repository 通用校验错误并保留 cause。
  SourceShellValidationError
} from './sourceShellErrors.js';

// 类型: Array<string>。
// 作用: 固定 SourceNetworkRequest 精确字段，缺失和额外字段都必须失败。
const SOURCE_NETWORK_REQUEST_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: 要求请求显式声明与 SourceContext 一致的数据源身份。
  'sourceId',

  // 类型: string。
  // 作用: 要求请求提供可回填到响应的调用关联标识。
  'requestId',

  // 类型: string。
  // 作用: 要求请求提供可规范化的 HTTPS 绝对地址。
  'url',

  // 类型: string。
  // 作用: 要求请求显式选择冻结的 GET 或 POST 方法。
  'method',

  // 类型: string。
  // 作用: 要求请求提供可规范化和容量校验的请求头对象。
  'headers',

  // 类型: string。
  // 作用: 要求请求显式提供 null、字符串或普通 JSON 对象 body。
  'body',

  // 类型: string。
  // 作用: 要求请求声明 json、text 或 arrayBuffer 响应形态。
  'responseType',

  // 类型: string。
  // 作用: 要求请求声明集中策略范围内的超时毫秒数。
  'timeout',

  // 类型: string。
  // 作用: 要求请求声明可采用响应体的最大字节数。
  'maxResponseBytes'
]);

// 类型: Array<string>。
// 作用: 固定 SourceChallenge 精确字段，禁止 Provider 附带页面对象或任意续接内容。
const SOURCE_CHALLENGE_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: 要求挑战提供请求和结果关联使用的唯一标识。
  'challengeId',

  // 类型: string。
  // 作用: 要求挑战声明与 SourceContext 一致的数据源身份。
  'sourceId',

  // 类型: string。
  // 作用: 要求挑战提供由未来 UI 适配器解释的非空类型。
  'type',

  // 类型: string。
  // 作用: 要求挑战显式提供可为空的标题文本。
  'title',

  // 类型: string。
  // 作用: 要求挑战显式提供可为空的图片地址占位文本。
  'image',

  // 类型: string。
  // 作用: 要求挑战提供可隔离的字段声明数组。
  'fields',

  // 类型: string。
  // 作用: 要求挑战显式提供空字符串或标准 UTC ISO 到期时间。
  'expiresAt',

  // 类型: string。
  // 作用: 要求挑战只携带 Provider 私有空间中的最小续接键。
  'contextKey'
]);

// 类型: Array<string>。
// 作用: 固定每个挑战输入声明的页面无关字段，拒绝组件、事件或任意校验函数进入 Shell。
const SOURCE_CHALLENGE_FIELD_FIELDS = Object.freeze([
  'name',
  'type',
  'label',
  'required',
  'placeholder'
]);

/**
 * 把 Repository 通用校验错误转换为 Shell validation 错误。
 * 副作用: 执行 action；action 只应校验输入，不写业务状态。
 * 成功路径: 原样返回 action 结果。
 * 失败路径: 保留原始 cause 并抛 SourceShellValidationError。
 *
 * @param {Function} action 同步校验回调。
 * @returns {*} action 的成功返回值。
 * @throws {SourceShellValidationError} 当 action 抛错时抛出。
 */
function wrapValidation(action) {
  try {
    return action();
  } catch (error) {
    // 异常来源: Repository 通用校验器或隔离工具拒绝当前 Shell 输入。
    // 处理策略: 统一包装为 Shell validation 并保留 cause，让能力调用方不依赖 Repository 错误类型。
    throw new SourceShellValidationError(error.message, { cause: error });
  }
}

/**
 * 校验普通对象具有精确字段集合。
 * 纯函数: 只读取对象键，不修改输入。
 *
 * @param {object} value 待校验普通对象。
 * @param {Array<string>} fields 允许且必需的字段集合。
 * @param {string} fieldName 错误定位名称。
 * @returns {void} 校验成功不返回业务值。
 * @throws {SourceShellValidationError} 当对象类型或字段集合不一致时抛出。
 */
function assertExactFields(value, fields, fieldName) {
  wrapValidation(() => assertPlainObject(value, fieldName));

  // 类型: Array<string|symbol>。
  // 作用: 使用 Reflect.ownKeys 发现 symbol 和不可枚举额外字段。
  const keys = Reflect.ownKeys(value);

  // 类型: Array<string>。
  // 作用: 找出标准字段中当前输入缺失的成员。
  const missingFields = fields.filter(field => !Object.hasOwn(value, field));

  // 类型: Array<string|symbol>。
  // 作用: 找出标准集合之外的字符串或 symbol 字段。
  const extraFields = keys.filter(field => typeof field !== 'string' || !fields.includes(field));

  // 条件分支: 输入存在缺失字段或额外字段时进入。
  // 执行内容: 抛精确字段错误，避免能力模块静默忽略未知输入。
  if (missingFields.length > 0 || extraFields.length > 0) {
    throw new SourceShellValidationError(`${fieldName} 字段集合不符合契约`);
  }
}

/**
 * 校验安全整数处于闭区间。
 * 纯函数: 只读取数值和策略边界。
 *
 * @param {*} value 待校验值。
 * @param {number} min 最小允许值。
 * @param {number} max 最大允许值。
 * @param {string} fieldName 错误定位名称。
 * @returns {number} 校验通过的原始整数。
 * @throws {SourceShellValidationError} 当值不是安全整数时抛出。
 * @throws {SourceShellLimitError} 当值超出策略范围时抛出。
 */
function assertIntegerInRange(value, min, max, fieldName) {
  // 条件分支: value 不是安全整数时进入。
  // 执行内容: 抛 validation，避免浮点数、字符串或无穷值进入策略比较。
  if (!Number.isSafeInteger(value)) {
    throw new SourceShellValidationError(`${fieldName} 必须是安全整数`);
  }

  // 条件分支: value 小于最小值或大于最大值时进入。
  // 执行内容: 抛 limit，调用方可以区分合法类型但容量越界。
  if (value < min || value > max) {
    throw new SourceShellLimitError(`${fieldName} 超出允许范围`);
  }

  return value;
}

/**
 * 规范化请求头普通对象。
 * 纯函数: 返回新冻结对象，不修改原始 headers。
 *
 * @param {object} headers Provider 提供的请求头候选。
 * @returns {object} 键统一为小写且值保持字符串的隔离请求头。
 * @throws {SourceShellValidationError} 当字段数量、键、值或大小不符合契约时抛出。
 * @throws {SourceShellLimitError} 当请求头数量或字节超限时抛出。
 */
function normalizeHeaders(headers) {
  wrapValidation(() => assertPlainObject(headers, 'sourceNetworkRequest.headers'));

  // 类型: Array<Array<*>>。
  // 作用: 读取全部可枚举请求头条目，后续逐项校验并规范化。
  const entries = Object.entries(headers);

  // 条件分支: 请求头条数超过集中策略时进入。
  // 执行内容: 抛 limit，避免异常大 header 对象进入路由和未来代理。
  if (entries.length > SOURCE_NETWORK_POLICY.maxHeaderCount) {
    throw new SourceShellLimitError('sourceNetworkRequest.headers 条数超限');
  }

  // 类型: object。
  // 作用: 使用无原型对象收集小写 header，避免动态键污染对象原型。
  const normalizedHeaders = Object.create(null);

  // 循环类型: Array.prototype.forEach。
  // 初始值: 第一条请求头键值。
  // 终止条件: 全部请求头完成安全键、字符串值和大小写归一。
  // 循环作用: 形成不共享输入引用的标准请求头对象。
  entries.forEach(([headerName, headerValue]) => {
    // 类型: string。
    // 作用: 规范化 header 名称大小写和首尾空白，供重复键检测和适配器读取。
    const normalizedName = wrapValidation(() => {
      return assertSafeRecordKey(headerName.trim().toLowerCase(), 'sourceNetworkRequest.headers key');
    });

    // 条件分支: header 值不是字符串时进入。
    // 执行内容: 拒绝隐式 String 转换，避免对象泄漏或有损请求。
    if (typeof headerValue !== 'string') {
      throw new SourceShellValidationError(`请求头 ${normalizedName} 必须是字符串`);
    }

    // 条件分支: 大小写归一后出现重复 header 时进入。
    // 执行内容: 拒绝后写覆盖，避免调用方通过大小写制造歧义。
    if (Object.hasOwn(normalizedHeaders, normalizedName)) {
      throw new SourceShellValidationError(`请求头重复: ${normalizedName}`);
    }

    // 副作用范围: 只写入当前函数局部无原型对象，不修改 Provider 原始 headers。
    normalizedHeaders[normalizedName] = headerValue;
  });

  // 类型: object。
  // 作用: 转换为普通对象供严格 JSON 字节计算和返回隔离。
  const plainHeaders = { ...normalizedHeaders };

  // 类型: number。
  // 作用: 保存请求头规范化后的 UTF-8 JSON 字节数。
  const headerBytes = getSerializableByteLength(plainHeaders);

  // 条件分支: 请求头字节数超过集中策略时进入。
  // 执行内容: 抛 limit，避免大量字符串绕过条数限制。
  if (headerBytes > SOURCE_NETWORK_POLICY.maxHeaderBytes) {
    throw new SourceShellLimitError('sourceNetworkRequest.headers 字节超限');
  }

  // 返回值类型: object。
  // 作用: 返回冻结小写请求头，后续 Adapter 和 Provider 不能修改规范化结果。
  return Object.freeze(plainHeaders);
}

/**
 * 规范化网络请求体并校验方法边界。
 * 纯函数: JSON 对象返回隔离副本，字符串和 null 按值返回。
 *
 * @param {string|object|null} body 请求体候选。
 * @param {string} method 已验证标准网络方法。
 * @returns {string|object|null} 隔离标准请求体。
 * @throws {SourceShellValidationError} 当 GET 携带 body 或 body 类型非法时抛出。
 * @throws {SourceShellLimitError} 当请求体字节超限时抛出。
 */
function normalizeNetworkBody(body, method) {
  // 条件分支: GET 请求携带非 null 请求体时进入。
  // 执行内容: 拒绝模糊 GET body，保证模拟层与未来代理语义一致。
  if (method === SOURCE_NETWORK_METHOD.get && body !== null) {
    throw new SourceShellValidationError('GET 请求 body 必须为 null');
  }

  // 条件分支: body 是 null 时进入。
  // 执行内容: 直接返回标准无请求体值。
  if (body === null) {
    return null;
  }

  // 条件分支: body 既不是字符串也不是普通对象时进入。
  // 执行内容: 拒绝数组、函数、类实例和二进制对象。
  if (typeof body !== 'string') {
    wrapValidation(() => assertPlainObject(body, 'sourceNetworkRequest.body'));
  }

  // 类型: string|object。
  // 作用: 字符串按值保留，普通对象按严格 JSON Value 隔离复制。
  const normalizedBody = typeof body === 'string'
    ? body
    : wrapValidation(() => {
        // 执行内容: 验证普通对象完整满足严格 JSON Value，拒绝有损或循环结构。
        assertSerializableJsonValue(body, 'sourceNetworkRequest.body');

        // 返回值类型: object。
        // 作用: 返回与 Provider 输入引用隔离的请求体，未来网络层不能观察后续外部修改。
        return cloneSerializableValue(body, 'sourceNetworkRequest.body');
      });

  // 类型: number。
  // 作用: 保存请求体 UTF-8 字节数；字符串和 JSON 对象使用同一策略上限。
  const bodyBytes = typeof normalizedBody === 'string'
    ? new TextEncoder().encode(normalizedBody).byteLength
    : getSerializableByteLength(normalizedBody);

  // 条件分支: 请求体字节数超过集中策略时进入。
  // 执行内容: 抛 limit，避免大对象进入模拟路由和未来代理。
  if (bodyBytes > SOURCE_NETWORK_POLICY.maxRequestBodyBytes) {
    throw new SourceShellLimitError('sourceNetworkRequest.body 字节超限');
  }

  return normalizedBody;
}

/**
 * 规范化 Source Shell 使用的安全 sourceId。
 * 纯函数: 只校验并返回原字符串。
 *
 * @param {*} sourceId 数据源 id 候选。
 * @param {string} fieldName 错误定位名称。
 * @returns {string} 安全非空 sourceId。
 * @throws {SourceShellValidationError} 当 sourceId 非法或命中危险键时抛出。
 */
export function normalizeSourceShellId(sourceId, fieldName = 'sourceId') {
  return wrapValidation(() => assertSafeRecordKey(sourceId, fieldName));
}

/**
 * 要求门面方法接收精确参数数量。
 * 纯函数: 只读取 arguments 数组长度。
 *
 * @param {Array<*>} args 方法实参数组。
 * @param {number} expectedCount 契约要求的精确参数数量。
 * @param {string} methodName 错误定位方法名。
 * @returns {void} 参数数量正确时不返回业务值。
 * @throws {SourceShellValidationError} 当缺少或提供额外参数时抛出。
 */
export function assertExactArgumentCount(args, expectedCount, methodName) {
  // 条件分支: 实参数量与契约数量不一致时进入。
  // 执行内容: 抛 validation，禁止通过额外 sourceId 等参数制造越权错觉。
  if (args.length !== expectedCount) {
    throw new SourceShellValidationError(`${methodName} 需要 ${expectedCount} 个参数`);
  }
}

/**
 * 校验外部注入对象具备 AbortSignal 最小稳定接口。
 * 纯函数: 只读取 aborted 和 addEventListener，不注册监听器。
 *
 * @param {*} signal AbortSignal 候选。
 * @param {string} fieldName 错误定位名称。
 * @returns {object} 已验证 signal 原引用。
 * @throws {SourceShellValidationError} 当 signal 不符合结构时抛出。
 */
export function assertAbortSignal(signal, fieldName = 'signal') {
  // 条件分支: signal 不是对象、aborted 不是 Boolean 或缺少 addEventListener 时进入。
  // 执行内容: 抛 validation，避免普通状态对象伪装生命周期信号。
  if (!signal
    || typeof signal !== 'object'
    || typeof signal.aborted !== 'boolean'
    || typeof signal.addEventListener !== 'function') {
    throw new SourceShellValidationError(`${fieldName} 必须是 AbortSignal`);
  }

  return signal;
}

/**
 * 要求当前生命周期尚未中止。
 * 纯函数: 只读取 signal.aborted。
 *
 * @param {object} signal 已验证 AbortSignal。
 * @param {string} operationName 当前能力名称。
 * @returns {void} 未中止时不返回业务值。
 * @throws {SourceShellAbortedError} 当 signal 已中止时抛出。
 */
export function assertNotAborted(signal, operationName) {
  // 条件分支: 当前 signal 已经 aborted 时进入。
  // 执行内容: 抛稳定 aborted 错误，能力实现不得继续采用成功结果。
  if (signal.aborted) {
    throw new SourceShellAbortedError(`${operationName} 已中止`);
  }
}

/**
 * 规范化并隔离 SourceNetworkRequest。
 * 纯函数: 返回新冻结根对象、请求头和 body 副本，不修改 Provider 输入。
 *
 * @param {object} request Provider 提交的标准网络请求候选。
 * @param {string} expectedSourceId 当前 SourceContext 绑定 sourceId。
 * @returns {object} 精确字段、容量受控且引用隔离的网络请求。
 * @returns {string} return.sourceId 已验证并与 Context 一致的数据源身份。
 * @returns {string} return.requestId 请求和响应关联标识。
 * @returns {string} return.url 规范化后的 HTTPS 无凭据绝对地址。
 * @returns {string} return.method 冻结 GET/POST 枚举值。
 * @returns {object} return.headers 小写、去重、冻结且容量受控的请求头。
 * @returns {string|object|null} return.body 与 method 一致并隔离的请求体。
 * @returns {string} return.responseType json、text 或 arrayBuffer 响应形态。
 * @returns {number} return.timeout 集中策略范围内的超时毫秒数。
 * @returns {number} return.maxResponseBytes 调用方允许采用的最大响应字节数。
 * @throws {SourceShellValidationError} 当字段、sourceId、URL、方法或响应类型非法时抛出。
 * @throws {SourceShellLimitError} 当 URL、header、body、timeout 或响应上限超限时抛出。
 */
export function normalizeSourceNetworkRequest(request, expectedSourceId) {
  // 类型: string。
  // 作用: 先校验 Context 绑定 id，所有请求必须与该身份完全一致。
  const safeExpectedSourceId = normalizeSourceShellId(expectedSourceId, 'expectedSourceId');
  assertExactFields(request, SOURCE_NETWORK_REQUEST_FIELDS, 'sourceNetworkRequest');

  // 类型: string。
  // 作用: 校验请求 sourceId 安全性并用于绑定身份比较。
  const sourceId = normalizeSourceShellId(request.sourceId, 'sourceNetworkRequest.sourceId');

  // 条件分支: 请求 sourceId 与 Context 绑定值不一致时进入。
  // 执行内容: 拒绝跨源网络请求，不允许适配器自行替换身份。
  if (sourceId !== safeExpectedSourceId) {
    throw new SourceShellValidationError('sourceNetworkRequest.sourceId 与 SourceContext 不一致');
  }

  // 类型: string。
  // 作用: 请求和响应匹配使用的非空唯一标识。
  const requestId = wrapValidation(() => {
    return assertNonEmptyString(request.requestId, 'sourceNetworkRequest.requestId');
  });

  // 类型: string。
  // 作用: 保存待解析 URL 原字符串，长度先受策略限制。
  const urlText = wrapValidation(() => assertNonEmptyString(request.url, 'sourceNetworkRequest.url'));

  // 条件分支: URL 字符数量超过集中策略时进入。
  // 执行内容: 抛 limit，避免异常大路由键进入适配器。
  if (urlText.length > SOURCE_NETWORK_POLICY.maxUrlLength) {
    throw new SourceShellLimitError('sourceNetworkRequest.url 长度超限');
  }

  // 类型: URL。
  // 作用: 解析并规范化 URL，拒绝相对地址和非法格式。
  let parsedUrl;
  try {
    parsedUrl = new URL(urlText);
  } catch (error) {
    // 异常来源: 请求 URL 不是标准 URL 解析器可接受的绝对地址。
    // 处理策略: 包装为 Shell validation 并保留 URL 解析 cause，不尝试字符串拼接或相对地址兜底。
    throw new SourceShellValidationError('sourceNetworkRequest.url 不是有效绝对地址', { cause: error });
  }

  // 条件分支: URL 协议不是 HTTPS 时进入。
  // 执行内容: 拒绝 file、data、javascript 和明文 HTTP 等非受控协议。
  if (parsedUrl.protocol !== 'https:') {
    throw new SourceShellValidationError('sourceNetworkRequest.url 只允许 HTTPS');
  }

  // 条件分支: URL 携带用户名或密码时进入。
  // 执行内容: 拒绝把凭据嵌入地址，凭据应由受控请求头候选表达。
  if (parsedUrl.username || parsedUrl.password) {
    throw new SourceShellValidationError('sourceNetworkRequest.url 不能携带用户名或密码');
  }

  // 条件分支: method 不属于冻结枚举时进入。
  // 执行内容: 拒绝隐式大小写转换，Provider 必须提交标准大写方法。
  if (!Object.values(SOURCE_NETWORK_METHOD).includes(request.method)) {
    throw new SourceShellValidationError('sourceNetworkRequest.method 不受支持');
  }

  // 条件分支: responseType 不属于冻结枚举时进入。
  // 执行内容: 拒绝适配器无法稳定隔离的响应体类型。
  if (!Object.values(SOURCE_NETWORK_RESPONSE_TYPE).includes(request.responseType)) {
    throw new SourceShellValidationError('sourceNetworkRequest.responseType 不受支持');
  }

  // 类型: object。
  // 作用: 保存小写、去重、容量受控的隔离请求头。
  const headers = normalizeHeaders(request.headers);

  // 类型: string|object|null。
  // 作用: 保存与方法匹配且容量受控的隔离请求体。
  const body = normalizeNetworkBody(request.body, request.method);

  // 类型: number。
  // 作用: 保存集中策略范围内的请求超时毫秒数。
  const timeout = assertIntegerInRange(
    request.timeout,
    SOURCE_NETWORK_POLICY.minTimeoutMs,
    SOURCE_NETWORK_POLICY.maxTimeoutMs,
    'sourceNetworkRequest.timeout'
  );

  // 类型: number。
  // 作用: 保存 Provider 允许采用的响应体最大字节数。
  const maxResponseBytes = assertIntegerInRange(
    request.maxResponseBytes,
    SOURCE_NETWORK_POLICY.minResponseBytes,
    SOURCE_NETWORK_POLICY.maxResponseBytes,
    'sourceNetworkRequest.maxResponseBytes'
  );

  // 返回值类型: object。
  // 作用: 返回精确字段和隔离值，MockNetworkAdapter 不再读取 Provider 原对象。
  return Object.freeze({
    // 类型: string。
    // 作用: 把已验证 Context 身份交给精确路由和响应关联链路。
    sourceId,

    // 类型: string。
    // 作用: 供 Adapter 原样回填响应，调用方可以关联当前请求。
    requestId,

    // 类型: string。
    // 作用: 使用标准 URL.href 消除相对地址和非规范文本差异。
    url: parsedUrl.href,

    // 类型: string。
    // 作用: 保存已通过冻结枚举校验的 GET/POST 方法。
    method: request.method,

    // 类型: object。
    // 作用: 提供小写、去重、冻结且容量受控的隔离请求头。
    headers,

    // 类型: string|object|null。
    // 作用: 提供已按方法和容量规则校验的隔离请求体。
    body,

    // 类型: string。
    // 作用: 告知 Adapter 按 json、text 或 arrayBuffer 转换响应体。
    responseType: request.responseType,

    // 类型: number。
    // 作用: 为未来 ProxyClient 提供集中策略范围内的超时输入。
    timeout,

    // 类型: number。
    // 作用: 让 Adapter 在返回前按实际响应字节执行采用门禁。
    maxResponseBytes
  });
}

/**
 * 规范化并隔离 SourceChallenge。
 * 纯函数: 返回新冻结根对象和 fields 副本，不修改 Provider 输入。
 *
 * @param {object} challenge 挑战候选。
 * @param {string} expectedSourceId 当前 SourceContext 绑定 sourceId。
 * @returns {object} 精确字段且身份一致的挑战对象。
 * @returns {string} return.challengeId 挑战请求和结果关联标识。
 * @returns {string} return.sourceId 已验证并与 Context 一致的数据源身份。
 * @returns {string} return.type 非空挑战类型。
 * @returns {string} return.title 可为空的未来弹窗标题。
 * @returns {string} return.image 可为空的挑战图片地址占位。
 * @returns {Array<object>} return.fields 隔离的挑战字段声明。
 * @returns {string} return.expiresAt 空字符串或标准 UTC ISO 到期时间。
 * @returns {string} return.contextKey Provider 私有空间最小续接键。
 * @throws {SourceShellValidationError} 当字段、字符串、时间或 sourceId 不符合契约时抛出。
 */
export function normalizeSourceChallenge(challenge, expectedSourceId) {
  assertExactFields(challenge, SOURCE_CHALLENGE_FIELDS, 'sourceChallenge');

  // 类型: string。
  // 作用: 保存并校验挑战所属 sourceId。
  const sourceId = normalizeSourceShellId(challenge.sourceId, 'sourceChallenge.sourceId');

  // 条件分支: challenge sourceId 与 Context 绑定值不一致时进入。
  // 执行内容: 拒绝挑战串到其他 Provider 会话。
  if (sourceId !== normalizeSourceShellId(expectedSourceId, 'expectedSourceId')) {
    throw new SourceShellValidationError('sourceChallenge.sourceId 与 SourceContext 不一致');
  }

  // 类型: string。
  // 作用: 挑战请求和占位结果匹配使用的唯一标识。
  const challengeId = wrapValidation(() => {
    return assertNonEmptyString(challenge.challengeId, 'sourceChallenge.challengeId');
  });

  // 类型: string。
  // 作用: 保存非空挑战类型，通用校验层不解释具体交互语义。
  const type = wrapValidation(() => assertNonEmptyString(challenge.type, 'sourceChallenge.type'));

  // 类型: Array<object>。
  // 作用: 保存精确、隔离且冻结的页面无关输入声明，交互层不能解释任意 Provider 控件。
  const fields = normalizeSourceChallengeFields(challenge.fields);

  // 类型: string。
  // 作用: 保存可选 ISO 到期时间；空字符串表示没有明确时限。
  const expiresAt = challenge.expiresAt;

  // 条件分支: expiresAt 不是字符串时进入。
  // 执行内容: 拒绝数字、Date 实例或其他隐式时间输入。
  if (typeof expiresAt !== 'string') {
    throw new SourceShellValidationError('sourceChallenge.expiresAt 必须为空或标准 ISO 时间');
  }

  // 条件分支: expiresAt 是非空字符串时进入。
  // 执行内容: 解析并要求往返 ISO 文本一致，拒绝本地格式和无效日期。
  if (expiresAt !== '') {
    try {
      // 类型: string。
      // 作用: 把时间解析结果重新转换为标准 ISO 文本，供精确格式比较。
      const normalizedExpiresAt = new Date(expiresAt).toISOString();

      // 条件分支: 解析后的标准 ISO 文本与原值不一致时进入。
      // 执行内容: 拒绝虽可解析但不是标准 UTC ISO 的输入。
      if (normalizedExpiresAt !== expiresAt) {
        throw new SourceShellValidationError('sourceChallenge.expiresAt 必须为空或标准 ISO 时间');
      }
    } catch (error) {
      // 异常来源: 到期时间不是有效日期，或虽可解析但不符合标准 UTC ISO 往返格式。
      // 处理策略: 保留已有 validation；原生日期解析错误包装为 validation 并保留 cause。
      // 条件分支: 当前错误已经是稳定 Shell validation 时进入。
      // 执行内容: 原样抛出，避免重复包装丢失错误类型。
      if (error instanceof SourceShellValidationError) {
        throw error;
      }

      throw new SourceShellValidationError(
        'sourceChallenge.expiresAt 必须为空或标准 ISO 时间',
        { cause: error }
      );
    }
  }

  // 类型: string。
  // 作用: 保存未来弹窗标题，允许空字符串但拒绝非字符串。
  const title = challenge.title;

  // 类型: string。
  // 作用: 保存挑战图片地址候选，校验层不读取或加载远程内容。
  const image = challenge.image;

  // 类型: string。
  // 作用: 保存 Provider 私有空间中的最小续接键。
  const contextKey = challenge.contextKey;

  // 条件分支: title、image 或 contextKey 任一不是字符串时进入。
  // 执行内容: 拒绝页面对象、二进制对象或任意引用进入占位端口。
  if ([title, image, contextKey].some(value => typeof value !== 'string')) {
    throw new SourceShellValidationError('sourceChallenge 文本字段必须是字符串');
  }

  // 条件分支: image 非空且不是 HTTPS 或图片 data URL 时进入。
  // 执行内容: 阻止挑战弹窗加载 HTTP、脚本协议、文件或任意非图片数据。
  if (image !== '') {
    // 类型: boolean。
    // 作用: 标记当前图片是否满足受限图片 data URL 或后续 HTTPS URL 规则。
    let isAllowedImage = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(image);

    // 条件分支: 不是受限 data URL 时，继续按绝对 HTTPS URL 校验。
    // 执行内容: 解析 URL 并只接受 https 协议。
    if (!isAllowedImage) {
      try {
        isAllowedImage = new URL(image).protocol === 'https:';
      } catch (error) {
        // 异常来源: image 不是可解析绝对 URL。
        // 处理策略: 保持 false 并进入统一 validation，不泄漏原始 URL 解析错误。
        isAllowedImage = false;
      }
    }

    // 条件分支: data URL 和 HTTPS URL 两条允许路径都未命中时进入。
    // 执行内容: 拒绝把不安全图片地址发布给根级弹窗。
    if (!isAllowedImage) {
      throw new SourceShellValidationError('sourceChallenge.image 必须为空、HTTPS 或图片 data URL');
    }
  }

  // 返回值类型: object。
  // 作用: 返回精确字段和隔离 fields，挑战端口不再读取 Provider 原对象。
  return Object.freeze({
    // 类型: string。
    // 作用: 供未来挑战结果与当前请求稳定关联。
    challengeId,

    // 类型: string。
    // 作用: 保留与 SourceContext 一致的数据源身份，阻止跨源挑战串线。
    sourceId,

    // 类型: string。
    // 作用: 提供未来 UI 适配器解释的非空挑战类型。
    type,

    // 类型: string。
    // 作用: 提供可为空的挑战标题，不在验证器内生成页面文案。
    title,

    // 类型: string。
    // 作用: 提供可为空的图片地址占位，验证器不加载外部资源。
    image,

    // 类型: Array<object>。
    // 作用: 提供与 Provider 输入引用隔离的挑战字段声明。
    fields,

    // 类型: string。
    // 作用: 提供标准到期时间或无时限空值，供挑战端口决定采用边界。
    expiresAt,

    // 类型: string。
    // 作用: 只暴露 Provider 私有空间中的最小续接键，不携带任意会话对象。
    contextKey
  });
}

/**
 * 规范化挑战输入字段声明。
 * 纯函数: 返回新的冻结数组和字段对象，不修改 Provider 输入。
 * 成功路径: 每个字段拥有精确五字段、安全唯一名称、受支持类型和字符串展示内容。
 * 失败路径: 空数组、重复名称、额外字段、非法类型或非布尔 required 抛 validation。
 *
 * @param {*} fields 挑战输入字段声明候选。
 * @returns {Array<object>} 深冻结且顺序保持的标准字段声明。
 * @throws {SourceShellValidationError} 字段声明不符合契约时抛出。
 */
function normalizeSourceChallengeFields(fields) {
  // 条件分支: fields 不是非空数组时进入。
  // 执行内容: 人工挑战必须明确至少一个输入，不能弹出无法完成的空表单。
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new SourceShellValidationError('sourceChallenge.fields 必须是非空数组');
  }

  // 类型: Set<string>。
  // 作用: 按声明顺序检测重复字段名，避免一个 values 键对应多个页面输入。
  const fieldNames = new Set();

  // 返回值类型: Array<object>。
  // 作用: 保持 Provider 声明顺序生成弹窗控件，同时隔离并冻结每项字段。
  return Object.freeze(fields.map((field, index) => {
    assertExactFields(field, SOURCE_CHALLENGE_FIELD_FIELDS, `sourceChallenge.fields[${index}]`);

    // 类型: string。
    // 作用: 规范化用户结果对象使用的安全键，不允许原型敏感字段。
    const name = wrapValidation(() => assertSafeRecordKey(
      assertNonEmptyString(field.name, `sourceChallenge.fields[${index}].name`),
      `sourceChallenge.fields[${index}].name`
    ));

    // 条件分支: 字段名已经出现时进入。
    // 执行内容: 拒绝 UI 后写覆盖前一个输入值。
    if (fieldNames.has(name)) {
      throw new SourceShellValidationError(`sourceChallenge.fields 字段名重复: ${name}`);
    }
    fieldNames.add(name);

    // 条件分支: type 不属于 text/password 时进入。
    // 执行内容: Provider 不能注入文件、HTML 或自定义组件。
    if (!Object.values(SOURCE_CHALLENGE_FIELD_TYPE).includes(field.type)) {
      throw new SourceShellValidationError(`sourceChallenge.fields[${index}].type 不受支持`);
    }

    // 条件分支: label/placeholder 不是字符串或 required 不是布尔值时进入。
    // 执行内容: 拒绝隐式类型转换改变页面交互语义。
    if (typeof field.label !== 'string' || typeof field.placeholder !== 'string'
      || typeof field.required !== 'boolean') {
      throw new SourceShellValidationError(`sourceChallenge.fields[${index}] 展示字段无效`);
    }

    return Object.freeze({
      name,
      type: field.type,
      label: field.label,
      required: field.required,
      placeholder: field.placeholder
    });
  }));
}

/**
 * 依据挑战字段声明规范化用户提交值。
 * 纯函数: 返回新的冻结普通对象，不修改页面 values 或挑战声明。
 * 成功路径: 只保留声明字段的字符串值，必填字段至少包含一个非空白字符。
 * 失败路径: values 非普通对象、包含额外键、值非字符串或必填值为空时抛 validation。
 *
 * @param {*} values 页面提交的用户输入候选。
 * @param {Array<object>} fields 已由 normalizeSourceChallenge 规范化的字段声明。
 * @returns {object} 冻结且只含声明键的字符串结果。
 * @throws {SourceShellValidationError} 用户输入不符合字段声明时抛出。
 */
export function normalizeSourceChallengeValues(values, fields) {
  wrapValidation(() => assertPlainObject(values, 'sourceChallengeResult.values'));

  // 类型: Array<string>。
  // 作用: 保存页面实际提交键，后续拒绝未声明输入和 symbol 字段。
  const valueKeys = Reflect.ownKeys(values);
  // 类型: Array<string>。
  // 作用: 从已验证字段声明取得唯一允许键集合。
  const allowedKeys = fields.map(field => field.name);

  // 条件分支: 页面提交 symbol 或字段声明外键时进入。
  // 执行内容: 防止页面把会话、Provider 或任意对象夹带回请求端。
  if (valueKeys.some(key => typeof key !== 'string' || !allowedKeys.includes(key))) {
    throw new SourceShellValidationError('sourceChallengeResult.values 包含未声明字段');
  }

  // 类型: object。
  // 作用: 按挑战声明顺序建立普通结果对象，不复用页面输入引用。
  const normalizedValues = {};

  fields.forEach((field) => {
    // 类型: *。
    // 作用: 读取当前声明字段对应的页面值；可选且未提交时保持缺失。
    const value = values[field.name];

    // 条件分支: 可选字段没有提交时进入。
    // 执行内容: 不伪造空字符串键，结果只包含页面真实提交的声明字段。
    if (value === undefined && field.required === false) {
      return;
    }

    // 条件分支: 值不是字符串或必填值只有空白时进入。
    // 执行内容: 拒绝对象、数字和无法继续验证的空输入。
    if (typeof value !== 'string' || (field.required && value.trim() === '')) {
      throw new SourceShellValidationError(`sourceChallengeResult.values.${field.name} 无效`);
    }

    normalizedValues[field.name] = value;
  });

  return Object.freeze(normalizedValues);
}

/**
 * 规范化 SourceLogger 单次写入输入。
 * 纯函数: 返回消息和 details 隔离副本，不执行脱敏或写入日志数组。
 *
 * @param {*} message 日志消息候选。
 * @param {*} details 日志详情普通对象候选。
 * @returns {object} 容量受控的消息和隔离 details。
 * @returns {string} return.message 非空且长度受控的日志消息。
 * @returns {object} return.details 严格 JSON、容量受控且引用隔离的详情对象。
 * @throws {SourceShellValidationError} 当消息或 details 类型不符合契约时抛出。
 * @throws {SourceShellLimitError} 当消息字符或 details 字节超限时抛出。
 */
export function normalizeSourceLogInput(message, details) {
  // 类型: string。
  // 作用: 保存非空日志消息，禁止隐式转换对象或错误实例。
  const safeMessage = wrapValidation(() => assertNonEmptyString(message, 'sourceLog.message'));

  // 条件分支: 消息字符数量超过集中策略时进入。
  // 执行内容: 抛 limit，不截断可能改变诊断语义的文本。
  if (safeMessage.length > SOURCE_LOGGER_POLICY.maxMessageLength) {
    throw new SourceShellLimitError('sourceLog.message 长度超限');
  }

  // 执行内容: 要求日志 details 是普通对象，拒绝数组、类实例和异常原型。
  wrapValidation(() => assertPlainObject(details, 'sourceLog.details'));

  // 执行内容: 要求日志 details 完整满足严格 JSON Value，保证后续脱敏和容量计算无损。
  wrapValidation(() => assertSerializableJsonValue(details, 'sourceLog.details'));

  // 类型: object。
  // 作用: 隔离日志详情，调用方后续修改不能影响待写入内容。
  const safeDetails = cloneSerializableValue(details, 'sourceLog.details');

  // 类型: number。
  // 作用: 保存详情 UTF-8 JSON 字节数，用于统一容量判断。
  const detailsBytes = getSerializableByteLength(safeDetails);

  // 条件分支: 日志详情超过集中策略时进入。
  // 执行内容: 抛 limit，不把超大对象写入有界内存。
  if (detailsBytes > SOURCE_LOGGER_POLICY.maxDetailsBytes) {
    throw new SourceShellLimitError('sourceLog.details 字节超限');
  }

  // 返回值类型: object。
  // 作用: 返回冻结的日志输入，SourceLogger 后续脱敏时不再读取调用方原对象。
  return Object.freeze({
    // 类型: string。
    // 作用: 提供非空且长度受控的诊断消息。
    message: safeMessage,

    // 类型: object。
    // 作用: 提供严格 JSON、容量受控且与调用方隔离的日志详情。
    details: safeDetails
  });
}
