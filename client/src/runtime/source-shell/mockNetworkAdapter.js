/*
  mockNetworkAdapter.js 模块说明

  - 文件职责:
      把标准 SourceNetworkRequest 精确匹配到模拟原始响应夹具，并返回隔离 SourceNetworkResponse。
      是生产源码中 response-fixtures.js 的唯一导入者，也是未来 ProxyClient 的替换接口。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      SOURCE_NETWORK_METHOD: 自定义配置，限定 fixture 方法。
      cloneSerializableValue: 自定义 Repository 工具，隔离 fixture JSON body。
      assertPlainObject、assertSerializableJsonValue: 自定义 Repository 校验，验证 fixture 普通对象和 JSON body。
      mockNetworkResponseFixtures: 自定义模拟数据，默认精确网络路由。
      Shell errors: 自定义错误，区分 fixture、limit、notFound 和 validation。
      Shell validators: 自定义验证器，校验 fixture/source request 身份、参数数量、AbortSignal 和中止状态。

  - 模块级常量:
      SOURCE_NETWORK_FIXTURE_FIELDS: Array<string>，模拟响应夹具精确字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createRouteKey(sourceId, method, url): Function，创建无碰撞精确路由键。
      assertExactFixtureFields(fixture, fieldName): Function，校验夹具精确字段。
      normalizeFixtureHeaders(headers, fieldName): Function，隔离响应头。
      normalizeFixture(fixture, index): Function，验证并隔离单条夹具。
      createFixtureIndex(fixtures): Function，创建唯一精确路由索引。
      convertFixtureBody(body): Function，把 fixture 原始值序列化为隔离 UTF-8 字节。

  - 模块级类:
      无

  - 对外导出:
      createMockNetworkAdapter(options): Function，创建只含 request 的冻结模拟网络适配器。
*/

// 导入来源: ./source-shell.config.js。
// 导入来源: ./source-shell.config.js；导入内容: SOURCE_NETWORK_METHOD；文件作用: 拒绝 fixture 使用请求契约之外的方法。
import { SOURCE_NETWORK_METHOD } from './source-shell.config.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
  // 文件作用: 隔离进入只读索引的 fixture body。
  cloneSerializableValue
} from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 普通对象校验。
  // 文件作用: 拒绝数组、类实例和异常原型 fixture/headers/options。
  assertPlainObject,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertSerializableJsonValue 严格 JSON Value 校验。
  // 文件作用: 验证 fixture body 和 headers 可隔离序列化。
  assertSerializableJsonValue
} from '../../repositories/source/sourceRepositoryValidators.js';

// 导入来源: ../../data/providers/mock-network/response-fixtures.js。
// 导入内容: mockNetworkResponseFixtures 默认模拟原始响应集合。
// 文件作用: 作为生产源码中唯一 fixture 导入点创建精确路由索引。
import { mockNetworkResponseFixtures } from '../../data/providers/mock-network/response-fixtures.js';

import {
  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellFixtureError 模拟夹具结构错误。
  // 文件作用: 构造阶段拒绝非法或重复路由。
  SourceShellFixtureError,

  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellLimitError 响应体超限错误。
  // 文件作用: 实际响应字节超过请求上限时失败。
  SourceShellLimitError,

  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellNotFoundError 精确路由未命中错误。
  // 文件作用: 未知 sourceId/method/URL 不回退真实网络。
  SourceShellNotFoundError,

  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellValidationError Adapter 依赖和调用错误。
  // 文件作用: 包装 options、fixture 容器和 JSON 文本转换输入错误。
  SourceShellValidationError
} from './sourceShellErrors.js';

import {
  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertAbortSignal AbortSignal 结构校验。
  // 文件作用: Adapter request 不接受伪造生命周期对象。
  assertAbortSignal,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertExactArgumentCount 精确参数数量校验。
  // 文件作用: request 只接受标准请求和 signal 两个参数。
  assertExactArgumentCount,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertNotAborted 生命周期中止门禁。
  // 文件作用: 请求前和返回前都拒绝采用中止结果。
  assertNotAborted,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: normalizeSourceNetworkRequest 标准请求规范化。
  // 文件作用: 复用 sourceId、URL、方法、header、body 和容量契约。
  normalizeSourceNetworkRequest,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: normalizeSourceShellId 安全数据源身份规范化函数。
  // 文件作用: fixture 与请求共用非空和危险键拒绝规则，避免路由索引接受非法身份。
  normalizeSourceShellId
} from './sourceShellValidators.js';

// 类型: Array<string>。
// 作用: 固定模拟原始响应夹具字段，缺失或额外页面数据字段都必须失败。
const SOURCE_NETWORK_FIXTURE_FIELDS = Object.freeze([
  'sourceId',
  'method',
  'url',
  'status',
  'statusText',
  'headers',
  'body',
  'responseUrl'
]);

/**
 * 创建 sourceId、method 和 URL 组成的精确路由键。
 * 纯函数: 使用 JSON 数组序列化避免字符串拼接分隔符碰撞。
 *
 * @param {string} sourceId 数据源 id。
 * @param {string} method 标准网络方法。
 * @param {string} url 规范化绝对 URL。
 * @returns {string} 精确路由索引键。
 */
function createRouteKey(sourceId, method, url) {
  return JSON.stringify([sourceId, method, url]);
}

/**
 * 校验 fixture 具有精确字段集合。
 * 纯函数: 只读取对象键，不修改夹具。
 *
 * @param {object} fixture 单条夹具候选。
 * @param {string} fieldName 错误定位名称。
 * @returns {void} 字段精确时不返回业务值。
 * @throws {SourceShellFixtureError} 当对象或字段集合不符合契约时抛出。
 */
function assertExactFixtureFields(fixture, fieldName) {
  try {
    assertPlainObject(fixture, fieldName);
  } catch (error) {
    // 异常来源: Repository 普通对象校验拒绝数组、类实例、异常原型或隐藏结构。
    // 处理策略: 转换为稳定 fixture 错误并保留 cause，让调用方识别损坏夹具而不是 Repository 实现错误。
    throw new SourceShellFixtureError(error.message, { cause: error });
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取包括 symbol 和不可枚举属性在内的全部夹具字段。
  const fields = Reflect.ownKeys(fixture);

  // 条件分支: 字段数量不同，或任一字段不属于精确集合时进入。
  // 执行内容: 抛 fixture 错误，防止页面对象或清洗结果混入网络夹具。
  if (fields.length !== SOURCE_NETWORK_FIXTURE_FIELDS.length
    || fields.some(field => typeof field !== 'string' || !SOURCE_NETWORK_FIXTURE_FIELDS.includes(field))) {
    throw new SourceShellFixtureError(`${fieldName} 字段集合不符合契约`);
  }
}

/**
 * 规范化 fixture 响应头。
 * 纯函数: 返回新冻结有序条目数组，不修改夹具 headers。
 *
 * @param {object} headers 响应头候选。
 * @param {string} fieldName 错误定位名称。
 * @returns {Array<object>} 字符串 name/value 的冻结隔离响应头。
 * @throws {SourceShellFixtureError} 当对象或值不符合契约时抛出。
 */
function normalizeFixtureHeaders(headers, fieldName) {
  try {
    assertPlainObject(headers, fieldName);
    assertSerializableJsonValue(headers, fieldName);
  } catch (error) {
    // 异常来源: 响应头不是普通对象或包含严格 JSON Value 之外的键值结构。
    // 处理策略: 统一包装为 fixture 错误并保留原始 cause，禁止损坏响应头进入私有路由索引。
    throw new SourceShellFixtureError(error.message, { cause: error });
  }

  // 类型: Array<object>；作用: 按 fixture 声明顺序创建协议 2.0 响应头条目。
  const normalizedHeaders = Object.entries(headers).map(([name, value]) => {
    // 类型: string。
    // 作用: 统一响应头名称大小写和首尾空白。
    const normalizedName = name.trim().toLowerCase();

    // 条件分支: 名称为空、值非字符串或规范化后重复时进入。
    // 执行内容: 抛 fixture 错误，不让损坏响应进入 Provider。
    if (!normalizedName
      || typeof value !== 'string') {
      throw new SourceShellFixtureError(`${fieldName} 包含非法响应头`);
    }
    return Object.freeze({ name: normalizedName, value });
  });

  return Object.freeze(normalizedHeaders);
}

/**
 * 校验并隔离单条模拟响应夹具。
 * 纯函数: 返回新冻结根对象、headers 和 JSON body 副本。
 *
 * @param {object} fixture 单条夹具候选。
 * @param {number} index 夹具数组位置。
 * @returns {object} 可进入精确路由索引的标准夹具。
 * @throws {SourceShellFixtureError} 当身份、方法、URL、状态、header 或 body 不符合契约时抛出。
 */
function normalizeFixture(fixture, index) {
  // 类型: string。
  // 作用: 当前夹具错误定位名称。
  const fieldName = `mockNetworkResponseFixtures[${index}]`;
  assertExactFixtureFields(fixture, fieldName);

  // 类型: string。
  // 作用: 保存与请求侧共用安全键规则规范化的数据源身份，危险原型键不能进入路由索引。
  let sourceId;
  try {
    sourceId = normalizeSourceShellId(fixture.sourceId, `${fieldName}.sourceId`);
  } catch (error) {
    // 异常来源: sourceId 为空、类型错误或命中 Repository 集中定义的危险动态键。
    // 处理策略: 转换为 fixture 错误并保留 Shell validation cause，使构造失败明确归因于夹具身份。
    throw new SourceShellFixtureError(`${fieldName}.sourceId 无效`, { cause: error });
  }

  // 条件分支: fixture method 不属于冻结 GET/POST 枚举时进入。
  // 执行内容: 抛 fixture 错误，避免索引存在请求验证永远无法生成或不受契约控制的路由。
  if (!Object.values(SOURCE_NETWORK_METHOD).includes(fixture.method)) {
    throw new SourceShellFixtureError(`${fieldName}.method 不受支持`);
  }

  // 条件分支: statusText 不是非空字符串时进入。
  // 执行内容: 拒绝缺少稳定响应说明的损坏夹具。
  if (typeof fixture.statusText !== 'string' || fixture.statusText.trim() === '') {
    throw new SourceShellFixtureError(`${fieldName}.statusText 无效`);
  }

  // 条件分支: status 不是 100—599 安全整数时进入。
  // 执行内容: 拒绝非标准网络状态码。
  if (!Number.isSafeInteger(fixture.status) || fixture.status < 100 || fixture.status > 599) {
    throw new SourceShellFixtureError(`${fieldName}.status 无效`);
  }

  // 类型: URL。
  // 作用: 保存规范化后的精确路由 URL，参与 sourceId、method 和 URL 路由键生成。
  let routeUrl;

  // 类型: URL。
  // 作用: 保存规范化后的最终响应 URL，作为 SourceNetworkResponse.responseUrl 返回给 Provider。
  let responseUrl;
  try {
    routeUrl = new URL(fixture.url);
    responseUrl = new URL(fixture.responseUrl);
  } catch (error) {
    // 异常来源: fixture.url 或 fixture.responseUrl 不能由标准 URL 解析器解析为绝对地址。
    // 处理策略: 转换为 fixture 错误并保留解析 cause，不创建含模糊地址的路由索引。
    throw new SourceShellFixtureError(`${fieldName} URL 无效`, { cause: error });
  }

  // 条件分支: 路由或响应 URL 不是 HTTPS 时进入。
  // 执行内容: 拒绝真实网络边界同样不允许的协议。
  if (routeUrl.protocol !== 'https:' || responseUrl.protocol !== 'https:') {
    throw new SourceShellFixtureError(`${fieldName} URL 只允许 HTTPS`);
  }

  // 条件分支: 路由或响应 URL 在地址中嵌入用户名或密码时进入。
  // 执行内容: 拒绝凭据进入精确路由键和 Provider 可见 responseUrl，保持与请求侧 URL 规则一致。
  if (routeUrl.username
    || routeUrl.password
    || responseUrl.username
    || responseUrl.password) {
    throw new SourceShellFixtureError(`${fieldName} URL 不能携带用户名或密码`);
  }

  // 类型: object。
  // 作用: 保存小写、字符串值和引用隔离的响应头。
  const headers = normalizeFixtureHeaders(fixture.headers, `${fieldName}.headers`);

  // 条件分支: body 不是 string、null 或严格 JSON Value 时进入。
  // 执行内容: 转换为 fixture 错误，禁止函数、二进制实例或循环引用进入默认路由。
  if (fixture.body !== null && typeof fixture.body !== 'string') {
    try {
      assertSerializableJsonValue(fixture.body, `${fieldName}.body`);
    } catch (error) {
      // 异常来源: 非字符串 body 包含函数、复杂实例、循环引用或其他非严格 JSON Value。
      // 处理策略: 包装为 fixture 错误并保留原始校验 cause，不让不可隔离引用进入 Adapter。
      throw new SourceShellFixtureError(error.message, { cause: error });
    }
  }

  // 类型: string|object|Array<*>|number|boolean|null。
  // 作用: 字符串和 null 按值保留，JSON Value 复制后存入 Adapter 私有索引。
  const body = fixture.body === null || typeof fixture.body === 'string'
    ? fixture.body
    : cloneSerializableValue(fixture.body, `${fieldName}.body`);

  return Object.freeze({
    sourceId,
    method: fixture.method,
    url: routeUrl.href,
    status: fixture.status,
    statusText: fixture.statusText,
    headers,
    body,
    responseUrl: responseUrl.href
  });
}

/**
 * 创建唯一模拟响应路由索引。
 * 纯函数: 返回新 Map，所有夹具先验证和隔离，不修改输入数组。
 *
 * @param {Array<object>} fixtures 模拟响应夹具集合。
 * @returns {Map<string, object>} 精确路由键到标准夹具的索引。
 * @throws {SourceShellValidationError} 当夹具根值不是数组时抛出。
 * @throws {SourceShellFixtureError} 当单条夹具无效或路由重复时抛出。
 */
function createFixtureIndex(fixtures) {
  // 条件分支: fixtures 不是数组时进入。
  // 执行内容: 抛 validation，区分依赖容器错误和单条 fixture 损坏。
  if (!Array.isArray(fixtures)) {
    throw new SourceShellValidationError('fixtureRoutes 必须是数组');
  }

  // 类型: Map<string, object>。
  // 作用: 保存精确路由到隔离夹具映射，不暴露给 Adapter 调用方。
  const fixtureIndex = new Map();

  // 循环类型: Array.prototype.forEach。
  // 初始值: 第一条模拟响应夹具。
  // 终止条件: 全部夹具验证、隔离并写入唯一索引。
  // 循环作用: 构造阶段提前拒绝损坏或重复路由。
  fixtures.forEach((fixture, index) => {
    // 类型: object。
    // 作用: 保存当前标准隔离夹具。
    const normalizedFixture = normalizeFixture(fixture, index);

    // 类型: string。
    // 作用: 使用精确 sourceId、method 和 URL 创建无碰撞路由键。
    const routeKey = createRouteKey(
      normalizedFixture.sourceId,
      normalizedFixture.method,
      normalizedFixture.url
    );

    // 条件分支: 索引中已经存在相同精确路由时进入。
    // 执行内容: 抛 fixture 错误，不允许后写覆盖制造不确定响应。
    if (fixtureIndex.has(routeKey)) {
      throw new SourceShellFixtureError(`模拟网络路由重复: ${routeKey}`);
    }

    fixtureIndex.set(routeKey, normalizedFixture);
  });

  return fixtureIndex;
}

/**
 * 把 fixture 原始 body 转换为隔离的原始 UTF-8 字节。
 * 纯函数: 字符串原样编码，其他 JSON Value 先稳定序列化；不解析业务正文。
 *
 * @param {*} body fixture 原始 body。
 * @returns {ArrayBuffer} 与真实 ProxyClient 相同的原始响应字节。
 */
function convertFixtureBody(body) {
  // 类型: string；作用: 字符串保持原文本，其他受审 JSON Value 只在模拟源站边界序列化一次。
  const textBody = typeof body === 'string' ? body : JSON.stringify(body);
  // 返回值类型: ArrayBuffer；作用: 与真实代理一样只交付原始字节，解析由 Mock Provider 完成。
  return new TextEncoder().encode(textBody).buffer;
}

/**
 * 创建 MockNetworkAdapter。
 * 纯函数: 构造时验证并隔离 fixture 索引；不访问真实网络或全局状态。
 *
 * @param {object} options 可选构造参数。
 * @param {Array<object>} options.fixtureRoutes 可选测试或组合层夹具；默认使用正式模拟响应夹具。
 * @returns {object} 只含异步 request 的冻结 Adapter。
 * @throws {SourceShellValidationError} 当 options 字段或 fixture 容器非法时抛出。
 * @throws {SourceShellFixtureError} 当 fixture 损坏或路由重复时抛出。
 */
export function createMockNetworkAdapter(options = {}) {
  try {
    assertPlainObject(options, 'mockNetworkAdapterOptions');
  } catch (error) {
    // 异常来源: Adapter options 是数组、类实例或其他非普通对象。
    // 处理策略: 转换为 Shell validation 并保留 cause，区分调用参数错误和单条 fixture 损坏。
    throw new SourceShellValidationError(error.message, { cause: error });
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取构造参数全部字段，当前只允许 fixtureRoutes。
  const optionFields = Reflect.ownKeys(options);

  // 条件分支: options 包含 fixtureRoutes 之外字段时进入。
  // 执行内容: 拒绝真实网络客户端、页面或其他能力被注入 Adapter。
  if (optionFields.some(field => field !== 'fixtureRoutes')) {
    throw new SourceShellValidationError('mockNetworkAdapterOptions 包含未知字段');
  }

  // 类型: Array<object>。
  // 作用: 显式覆盖使用调用方夹具，否则使用 Adapter 唯一导入的默认夹具。
  const fixtureRoutes = Object.hasOwn(options, 'fixtureRoutes')
    ? options.fixtureRoutes
    : mockNetworkResponseFixtures;

  // 类型: Map<string, object>。
  // 作用: 保存构造阶段已经验证和隔离的精确路由索引。
  const fixtureIndex = createFixtureIndex(fixtureRoutes);

  return Object.freeze({
    /**
     * 请求一条模拟原始响应。
     * 副作用: 只读取 Adapter 私有 fixture 索引；不访问真实网络、不修改 fixture。
     * 成功路径: 返回 sourceId/requestId 对齐、大小受控且引用隔离的 SourceNetworkResponse。
     * 失败路径: 输入、中止、未命中、fixture 或超限使用稳定 Shell 错误。
     *
     * @param {...*} args 精确包含 SourceNetworkRequest 和 AbortSignal。
     * @returns {Promise<object>} 隔离 SourceNetworkResponse。
     */
    async request(...args) {
      assertExactArgumentCount(args, 2, 'mockNetworkAdapter.request');

      // 类型: Array<*>。
      // 作用: 保存标准请求候选和生命周期 signal，Adapter 不接受第三个配置参数。
      const [request, signal] = args;
      assertAbortSignal(signal, 'mockNetworkAdapter.signal');
      assertNotAborted(signal, 'mockNetworkAdapter.request');

      // 类型: object。
      // 作用: 使用请求自身 sourceId 作为 Adapter 身份门禁，并规范化全部字段。
      const normalizedRequest = normalizeSourceNetworkRequest(request, request?.sourceId);

      // 类型: string。
      // 作用: 创建请求精确路由键，未知 sourceId/method/URL 不存在模糊回退。
      const routeKey = createRouteKey(
        normalizedRequest.sourceId,
        normalizedRequest.method,
        normalizedRequest.url
      );

      // 类型: object|undefined。
      // 作用: 从私有索引读取标准隔离 fixture。
      const fixture = fixtureIndex.get(routeKey);

      // 条件分支: 精确路由没有命中时进入。
      // 执行内容: 抛 notFound，禁止回退 fetch、代理或其他 sourceId 路由。
      if (!fixture) {
        throw new SourceShellNotFoundError(`模拟网络路由不存在: ${routeKey}`);
      }

      // 类型: ArrayBuffer；作用: 把模拟源站正文转换为与真实代理相同的隔离原始字节。
      const body = convertFixtureBody(fixture.body);

      // 类型: number。
      // 作用: 直接读取原始响应字节数，用于调用方 maxResponseBytes 门禁。
      const responseBytes = body.byteLength;

      // 条件分支: 实际响应字节超过请求声明上限时进入。
      // 执行内容: 抛 limit，不返回截断或部分响应。
      if (responseBytes > normalizedRequest.maxResponseBytes) {
        throw new SourceShellLimitError('模拟网络响应超过 maxResponseBytes');
      }

      // 执行内容: 返回前再次检查中止，未来替换异步 ProxyClient 时保持采用边界一致。
      assertNotAborted(signal, 'mockNetworkAdapter.response');

      // 类型: ArrayBuffer；作用: 再切片形成调用方独占缓冲区，不泄漏 Adapter 内部转换结果。
      const isolatedBody = body.slice(0);

      return Object.freeze({
        requestId: normalizedRequest.requestId,
        status: fixture.status,
        statusText: fixture.statusText,
        headers: Object.freeze(fixture.headers.map(header => Object.freeze({ ...header }))),
        body: isolatedBody,
        responseUrl: fixture.responseUrl
      });
    }
  });
}
