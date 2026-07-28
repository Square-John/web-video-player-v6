/*
  createSourceContext.js 模块说明

  - 文件职责:
      把网络、私有存储、挑战、日志和 AbortSignal 组合成绑定单一 sourceId 的冻结 SourceContext。
      只负责能力校验和权限裁剪，不读取 Provider 数据、不管理生命周期、不保存第二份 Repository 或日志状态。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      SourceShellValidationError: 自定义 Shell 错误，拒绝非法或跨源能力依赖。
      Shell validators: 自定义验证器，校验 sourceId、signal、精确参数、网络请求和中止采用边界。
      createSourceStorageFacade: 自定义 Storage 门面工厂，创建闭包绑定 sourceId 的五分区能力。

  - 模块级常量:
      SOURCE_CONTEXT_OPTION_FIELDS: Array<string>，SourceContext 精确依赖字段。
      SOURCE_NETWORK_ADAPTER_FIELDS: Array<string>，网络适配器公开字段。
      SOURCE_CHALLENGE_PORT_FIELDS: Array<string>，挑战端口组合字段。
      SOURCE_LOGGER_CONTROLLER_FIELDS: Array<string>，日志控制器组合字段。
      SOURCE_LOGGER_METHODS: Array<string>，Provider 可见日志写方法。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertExactObjectFields(value, fields, fieldName): Function，校验依赖对象精确字段。
      assertFunctionFields(value, fields, fieldName): Function，校验依赖方法完整。
      createNetworkFacade(sourceId, networkAdapter, signal): Function，创建生命周期受控网络门面。
      createChallengeFacade(challengePort): Function，裁剪挑战端口组合字段。

  - 模块级类:
      无

  - 对外导出:
      createSourceContext(options): Function，创建绑定同一身份和生命周期的冻结 Provider 工具箱。
*/

// 导入来源: ./sourceShellErrors.js。
// 导入内容: SourceShellValidationError Shell 输入错误。
// 文件作用: options、依赖结构、跨源或 signal 不一致时返回稳定 validation。
import { SourceShellValidationError } from './sourceShellErrors.js';

import {
  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertAbortSignal AbortSignal 结构校验。
  // 文件作用: SourceContext 绑定真实 Host 生命周期信号。
  assertAbortSignal,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertExactArgumentCount 精确参数数量校验。
  // 文件作用: network.request 和 challenge.request 不接受额外 sourceId 或能力参数。
  assertExactArgumentCount,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertNotAborted 生命周期采用门禁。
  // 文件作用: 网络调用前后均拒绝采用已中止结果。
  assertNotAborted,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: normalizeSourceNetworkRequest 标准请求规范化函数。
  // 文件作用: Context 在 Adapter 之前绑定根 sourceId，阻止 Provider 借当前 Context 请求其他源路由。
  normalizeSourceNetworkRequest,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: normalizeSourceShellId 安全数据源身份规范化函数。
  // 文件作用: 构造时永久绑定安全 sourceId 并校验能力同源。
  normalizeSourceShellId
} from './sourceShellValidators.js';

// 导入来源: ./sourceStorageFacade.js。
// 导入内容: createSourceStorageFacade 五分区 Storage 门面工厂。
// 文件作用: 组合时使用当前 sourceId 和唯一 Repository 创建受控私有空间能力。
import { createSourceStorageFacade } from './sourceStorageFacade.js';

// 类型: Array<string>。
// 作用: 固定 SourceContext 构造依赖，禁止 Provider、页面、store 或 Host 控制器整体进入公开工具箱。
const SOURCE_CONTEXT_OPTION_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: 要求 Context 显式绑定唯一数据源身份。
  'sourceId',

  // 类型: string。
  // 作用: 要求 Context 显式接收标准网络适配器。
  'networkAdapter',

  // 类型: string。
  // 作用: 要求 Context 显式接收唯一 Storage Repository 保存权威。
  'storageRepository',

  // 类型: string。
  // 作用: 要求 Context 显式接收已经绑定身份和 signal 的挑战端口。
  'challengePort',

  // 类型: string。
  // 作用: 要求 Context 显式接收 Logger Controller，并只采用其只写 logger。
  'loggerController',

  // 类型: string。
  // 作用: 要求 Context 显式接收 Host 生命周期 AbortSignal。
  'signal'
]);

// 类型: Array<string>。
// 作用: 网络适配器只允许公开 request，Context 不接受含真实网络或控制方法的任意对象。
const SOURCE_NETWORK_ADAPTER_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: SourceContext network 门面唯一委托方法。
  'request'
]);

// 类型: Array<string>。
// 作用: 挑战端口组合层字段；Context 只校验 identity/signal，并向 Provider 裁剪为 request。
const SOURCE_CHALLENGE_PORT_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: 供 Context 校验挑战端口与根 Context 同一数据源。
  'sourceId',

  // 类型: string。
  // 作用: 供 Context 校验挑战端口与网络门面使用同一 AbortSignal 引用。
  'signal',

  // 类型: string。
  // 作用: Provider 通过 Context 提交 SourceChallenge 的唯一方法。
  'request'
]);

// 类型: Array<string>。
// 作用: Logger Controller 组合层字段；Context 只采用 logger，不向 Provider暴露读取和清理。
const SOURCE_LOGGER_CONTROLLER_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: 供 Context 校验 Logger 与其他能力同一数据源。
  'sourceId',

  // 类型: string。
  // 作用: Provider 可见的四级只写日志接口。
  'logger',

  // 类型: string。
  // 作用: Host 使用的隔离读取方法，Context 只验证但不公开。
  'getEntries',

  // 类型: string。
  // 作用: Host 使用的日志清理方法，Context 只验证但不公开。
  'clear'
]);

// 类型: Array<string>。
// 作用: 固定 Provider 可见的 Logger 四个写方法，不允许读取、清理或自定义级别入口。
const SOURCE_LOGGER_METHODS = Object.freeze([
  // 类型: string。
  // 作用: 写入开发诊断摘要的方法。
  'debug',

  // 类型: string。
  // 作用: 写入正常关键运行节点的方法。
  'info',

  // 类型: string。
  // 作用: 写入可恢复异常或降级结果的方法。
  'warn',

  // 类型: string。
  // 作用: 写入失败摘要的方法。
  'error'
]);

/**
 * 校验依赖对象具有精确字段集合。
 * 纯函数: 只读取对象和自有字段，不修改依赖。
 * 成功路径: 字段类型、数量和名称精确时不返回业务值。
 * 失败路径: null、数组、异常类型、缺失或额外字段时抛稳定 validation。
 *
 * @param {*} value 依赖对象候选。
 * @param {Array<string>} fields 必需且唯一允许的字段集合。
 * @param {string} fieldName 错误定位名称。
 * @returns {void} 校验通过不返回业务值。
 * @throws {SourceShellValidationError} 当依赖对象不符合精确结构时抛出。
 */
function assertExactObjectFields(value, fields, fieldName) {
  // 条件分支: value 不是非数组对象时进入。
  // 执行内容: 拒绝读取方法和身份字段，避免后续 TypeError 掩盖依赖错误。
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SourceShellValidationError(`${fieldName} 必须是对象`);
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取包括 symbol 和不可枚举属性在内的全部字段，防止隐藏能力通过组合边界。
  const actualFields = Reflect.ownKeys(value);

  // 条件分支: 字段数量不同或任一字段不属于允许集合时进入。
  // 执行内容: 拒绝缺失与额外能力，不静默裁剪来源不明的依赖对象。
  if (actualFields.length !== fields.length
    || actualFields.some(field => typeof field !== 'string' || !fields.includes(field))) {
    throw new SourceShellValidationError(`${fieldName} 字段不符合契约`);
  }
}

/**
 * 校验依赖对象指定字段全部是函数。
 * 纯函数: 只读取目标字段类型，不调用或绑定方法。
 * 成功路径: 全部方法存在且可调用时不返回业务值。
 * 失败路径: 任一方法缺失或不是函数时抛稳定 validation。
 *
 * @param {object} value 已通过对象结构校验的依赖。
 * @param {Array<string>} fields 必须为函数的字段集合。
 * @param {string} fieldName 错误定位名称。
 * @returns {void} 方法完整时不返回业务值。
 * @throws {SourceShellValidationError} 当任一方法字段不可调用时抛出。
 */
function assertFunctionFields(value, fields, fieldName) {
  // 类型: Array<string>。
  // 作用: 找出缺失或不可调用的方法，集中形成一个可定位 validation。
  const invalidMethods = fields.filter(methodName => typeof value[methodName] !== 'function');

  // 条件分支: 至少存在一个不可调用方法时进入。
  // 执行内容: 拒绝创建部分可用 Context，避免运行中才出现模糊 TypeError。
  if (invalidMethods.length > 0) {
    throw new SourceShellValidationError(`${fieldName} 方法无效: ${invalidMethods.join(', ')}`);
  }
}

/**
 * 创建绑定 sourceId、Adapter 和 signal 的冻结网络门面。
 * 纯函数: 只创建异步方法闭包；实际请求副作用由 Adapter.request 执行。
 *
 * @param {string} sourceId 当前 Context 唯一数据源 id。
 * @param {Function} networkRequest 构造时捕获并绑定的标准网络请求函数。
 * @param {AbortSignal} signal 当前 Context 生命周期信号。
 * @returns {object} 只含 request 的冻结网络门面。
 */
function createNetworkFacade(sourceId, networkRequest, signal) {
  // 返回值类型: object。
  // 作用: Provider 只能提交标准请求，不能获得 Adapter 根对象或替换 signal。
  return Object.freeze({
    /**
     * 通过当前 Context 的 Adapter 和 signal 提交网络请求。
     * 副作用: 委托 networkAdapter.request；当前 MockNetworkAdapter 只读 fixture，未来 ProxyClient 可能发起网络请求。
     * 成功路径: 调用前后 signal 均未中止时返回 Adapter 的标准隔离响应。
     * 失败路径: 参数、请求、Adapter 或中止失败使用稳定 Shell 错误。
     *
     * @param {...*} args 精确包含一个 SourceNetworkRequest。
     * @returns {Promise<object>} 标准 SourceNetworkResponse。
     * @throws {SourceShellValidationError} 当参数数量不符合契约时抛出。
     */
    async request(...args) {
      // 执行内容: 只允许一个网络请求对象，不能夹带 sourceId、Adapter 或 signal 覆盖参数。
      assertExactArgumentCount(args, 1, 'network.request');

      // 执行内容: 委托前拒绝已中止生命周期，避免 Adapter 获得不可采用请求。
      assertNotAborted(signal, 'network.request');

      // 类型: object。
      // 作用: 保存 Provider 唯一请求候选，不能直接交给只认识路由的 Adapter。
      const [requestCandidate] = args;

      // 类型: object。
      // 作用: 先按 Context 根 sourceId 校验并隔离请求，阻止 Provider 声明其他身份命中跨源路由。
      const request = normalizeSourceNetworkRequest(requestCandidate, sourceId);

      // 类型: object。
      // 作用: 保存 Adapter 标准响应；返回前再次执行中止采用门禁。
      const response = await networkRequest(request, signal);

      // 执行内容: Adapter 完成后再次拒绝已中止结果，替换为异步 ProxyClient 后仍保持采用边界。
      assertNotAborted(signal, 'network.request.response');

      // 返回值类型: object。
      // 作用: 返回 Adapter 已校验和隔离的 SourceNetworkResponse，不在 Context 重写业务响应。
      return response;
    }
  });
}

/**
 * 创建只暴露 request 的冻结挑战门面。
 * 纯函数: 创建方法闭包，不修改挑战端口或生命周期信号。
 *
 * @param {Function} challengeRequest 构造时捕获并绑定的挑战请求函数。
 * @returns {object} 只含 request 的冻结 Provider 挑战能力。
 */
function createChallengeFacade(challengeRequest) {
  // 返回值类型: object。
  // 作用: 裁剪 sourceId 和 signal 组合字段，Provider 只能提交挑战。
  return Object.freeze({
    /**
     * 通过当前绑定端口提交挑战。
     * 副作用: 委托 challengePort.request；当前端口不操作页面或存储。
     * 成功路径: 返回 unsupported 或 cancelled 冻结结果。
     * 失败路径: 参数或挑战不合法时返回稳定 validation。
     *
     * @param {...*} args 精确包含一个 SourceChallenge。
     * @returns {Promise<object>} 标准 SourceChallengeResult。
     */
    request(...args) {
      // 执行内容: Context 层再次要求一个挑战对象，不能夹带 sourceId 或端口控制参数。
      assertExactArgumentCount(args, 1, 'challenge.request');

      // 返回值类型: Promise<object>。
      // 作用: 委托已经绑定同一 sourceId 和 signal 的挑战端口，不暴露端口根对象。
      return challengeRequest(args[0]);
    }
  });
}

/**
 * 创建绑定同一身份和生命周期的 SourceContext。
 * 纯函数: 校验并组合冻结能力；不调用 Provider、不管理生命周期、不读写 Repository 或日志。
 *
 * @param {object} options SourceContext 依赖。
 * @param {string} options.sourceId 当前 Provider 唯一数据源 id。
 * @param {object} options.networkAdapter 标准网络适配器。
 * @param {object} options.storageRepository SourceStorageRepository 实例。
 * @param {object} options.challengePort 绑定 sourceId 和 signal 的挑战端口。
 * @param {object} options.loggerController 绑定 sourceId 的 Logger Controller。
 * @param {AbortSignal} options.signal Host 生命周期信号。
 * @returns {object} 冻结 SourceContext。
 * @returns {string} return.sourceId 当前 Provider 唯一数据源 id。
 * @returns {object} return.network 只含 request 的受控网络能力。
 * @returns {object} return.storage 绑定 sourceId 的五分区 Storage 门面。
 * @returns {object} return.challenge 只含 request 的挑战能力。
 * @returns {object} return.logger 只含四级写方法的日志能力。
 * @returns {AbortSignal} return.signal 同一 Host 生命周期信号。
 * @throws {SourceShellValidationError} 当依赖结构、方法、身份或 signal 不一致时抛出。
 */
export function createSourceContext(options) {
  // 执行内容: 要求 options 精确包含六项依赖，不静默接受 Provider、页面或 Host 控制对象。
  assertExactObjectFields(options, SOURCE_CONTEXT_OPTION_FIELDS, 'sourceContext options');

  // 类型: string。
  // 作用: 保存安全根身份，所有子能力必须与该值完全一致。
  const sourceId = normalizeSourceShellId(options.sourceId, 'sourceContext.sourceId');

  // 类型: AbortSignal。
  // 作用: 保存已验证 Host 生命周期信号，network、challenge 和 Context 根共同使用同一引用。
  const signal = assertAbortSignal(options.signal, 'sourceContext.signal');

  // 执行内容: 网络适配器只能公开 request，避免其他真实网络或控制能力进入 Context。
  assertExactObjectFields(
    options.networkAdapter,
    SOURCE_NETWORK_ADAPTER_FIELDS,
    'sourceContext.networkAdapter'
  );
  // 执行内容: 网络适配器 request 必须可调用，创建部分可用 Context 会立即失败。
  assertFunctionFields(options.networkAdapter, SOURCE_NETWORK_ADAPTER_FIELDS, 'sourceContext.networkAdapter');

  // 执行内容: 挑战端口必须精确公开 sourceId、signal 和 request 三项组合字段。
  assertExactObjectFields(
    options.challengePort,
    SOURCE_CHALLENGE_PORT_FIELDS,
    'sourceContext.challengePort'
  );
  // 执行内容: 挑战端口 request 必须可调用，不能使用静态占位字符串。
  assertFunctionFields(options.challengePort, ['request'], 'sourceContext.challengePort');

  // 类型: string。
  // 作用: 规范化挑战端口身份，供根 Context 同源比较。
  const challengeSourceId = normalizeSourceShellId(
    options.challengePort.sourceId,
    'sourceContext.challengePort.sourceId'
  );

  // 条件分支: 挑战端口 sourceId 与 Context 根身份不一致时进入。
  // 执行内容: 拒绝跨源挑战能力进入 Provider 工具箱。
  if (challengeSourceId !== sourceId) {
    throw new SourceShellValidationError('sourceContext.challengePort sourceId 不一致');
  }

  // 条件分支: 挑战端口 signal 不是 Context 根 signal 同一引用时进入。
  // 执行内容: 拒绝生命周期分裂，保证 Host 中止能够同时影响 network 和 challenge。
  if (options.challengePort.signal !== signal) {
    throw new SourceShellValidationError('sourceContext.challengePort signal 不一致');
  }

  // 执行内容: Logger Controller 必须精确公开身份、只写 logger 和 Host 读取/清理能力。
  assertExactObjectFields(
    options.loggerController,
    SOURCE_LOGGER_CONTROLLER_FIELDS,
    'sourceContext.loggerController'
  );
  // 执行内容: Host 诊断读取和清理方法必须可调用，但后续不会进入 SourceContext 根对象。
  assertFunctionFields(
    options.loggerController,
    ['getEntries', 'clear'],
    'sourceContext.loggerController'
  );
  // 执行内容: Provider logger 只能包含四个稳定写方法，不接受读取或自定义级别能力。
  assertExactObjectFields(
    options.loggerController.logger,
    SOURCE_LOGGER_METHODS,
    'sourceContext.loggerController.logger'
  );
  // 执行内容: 四个日志写方法必须全部可调用，避免 Context 暴露半完成 logger。
  assertFunctionFields(
    options.loggerController.logger,
    SOURCE_LOGGER_METHODS,
    'sourceContext.loggerController.logger'
  );

  // 类型: string。
  // 作用: 规范化 Logger Controller 身份，供根 Context 同源比较。
  const loggerSourceId = normalizeSourceShellId(
    options.loggerController.sourceId,
    'sourceContext.loggerController.sourceId'
  );

  // 条件分支: Logger Controller sourceId 与 Context 根身份不一致时进入。
  // 执行内容: 拒绝日志条目自动附带其他数据源身份。
  if (loggerSourceId !== sourceId) {
    throw new SourceShellValidationError('sourceContext.loggerController sourceId 不一致');
  }

  // 类型: Function。
  // 作用: 构造时捕获并绑定网络 request；Context 创建后不再读取可变 Adapter 对象的方法字段。
  const networkRequest = options.networkAdapter.request.bind(options.networkAdapter);

  // 类型: Function。
  // 作用: 构造时捕获并绑定挑战 request；Context 创建后不再读取可变端口对象的方法字段。
  const challengeRequest = options.challengePort.request.bind(options.challengePort);

  // 类型: object。
  // 作用: 复制并冻结四个写方法引用，Context 创建后不受外部替换 Logger Controller.logger 字段影响。
  const logger = Object.freeze({ ...options.loggerController.logger });

  // 类型: object。
  // 作用: 创建绑定根 sourceId 的五分区 Storage 门面，Repository 继续是唯一保存态权威。
  const storage = createSourceStorageFacade({
    // 类型: string。
    // 作用: 把 Context 根身份闭包绑定到全部 Storage 分区。
    sourceId,

    // 类型: object。
    // 作用: 提供唯一 SourceStorageRepository，不在 Context 建立影子缓存。
    storageRepository: options.storageRepository
  });

  // 类型: object。
  // 作用: 创建绑定根 signal 的网络包装，Provider 不获得 Adapter 或 signal 参数入口。
  const network = createNetworkFacade(sourceId, networkRequest, signal);

  // 类型: object。
  // 作用: 裁剪挑战端口的组合字段，只向 Provider 暴露 request。
  const challenge = createChallengeFacade(challengeRequest);

  // 返回值类型: object。
  // 作用: 返回六字段冻结 Provider 工具箱，不包含 Logger Controller、Adapter、Repository 或挑战端口根对象。
  return Object.freeze({
    // 类型: string。
    // 作用: 当前 Provider 唯一身份，所有能力在构造时已经与它对齐。
    sourceId,

    // 类型: object。
    // 作用: 只含 request 的生命周期受控网络能力。
    network,

    // 类型: object。
    // 作用: 绑定当前 sourceId 的五分区私有空间能力。
    storage,

    // 类型: object。
    // 作用: 只含 request 的挑战占位能力，不暴露 sourceId 和 signal 组合字段。
    challenge,

    // 类型: object。
    // 作用: 只含 debug/info/warn/error 的写日志能力，不暴露读取和清理。
    logger,

    // 类型: AbortSignal。
    // 作用: 向 Provider 暴露当前生命周期只读信号，由 Host 负责创建和中止。
    signal
  });
}
