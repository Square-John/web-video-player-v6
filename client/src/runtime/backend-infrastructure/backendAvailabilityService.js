/*
  backendAvailabilityService.js 模块说明

  - 文件职责:
      维护当前页面会话唯一后端基础设施四态，协调单一在途健康检查、ProxyClient 门禁和用户显式重试。
      状态只存在于内存，不写 Provider、Store、Repository、IndexedDB、localStorage 或 sessionStorage。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      frontendRuntimeConfig.js#getFrontendRuntimeConfig: 读取启动屏障采用的唯一后端 origin。
      backendInfrastructure.config.js#BACKEND_INFRASTRUCTURE_CONFIG、BACKEND_INFRASTRUCTURE_STATUS: 提供健康协议和四态枚举。

  - 模块级常量:
      BACKEND_AVAILABILITY_ERROR_NAME: string，健康门禁失败的稳定错误名称。
      BACKEND_AVAILABILITY_OPTION_KEYS: ReadonlyArray<string>，服务工厂允许的注入字段。

  - 模块级变量:
      backendAvailabilityService: Readonly<object>，产品 App Shell 与 ProxyClient 共用的唯一协调器。

  - 模块级辅助函数:
      assertFactoryOptions(options): 校验服务工厂注入边界。
      createStatusSnapshot(status): 创建冻结四态快照。
      normalizeBackendOrigin(origin): 校验并规范化后端 origin。
      createHealthEndpoint(getBackendOrigin): 组合健康端点 URL。
      assertHealthResponse(response): 校验健康 HTTP 响应形状和媒体类型。
      assertHealthPayload(payload): 校验健康 JSON 精确字段。
      normalizeWaitOptions(options): 校验单个调用的可选 AbortSignal。
      waitForSharedCheck(checkPromise, signal): 让单个调用可中止等待但不取消共享健康请求。

  - 模块级类:
      BackendAvailabilityError: Error，表示当前后端健康门禁没有得到 available 结果。

  - 对外导出:
      BackendAvailabilityError: class，ProxyClient 和测试识别健康门禁失败使用。
      createBackendAvailabilityService: function，测试或替代组合创建隔离协调器使用。
      backendAvailabilityService: object，产品 App Shell 与 ProxyClient 共用的唯一实例。
*/

// 导入来源: ../../config/frontendRuntimeConfig.js；导入内容: getFrontendRuntimeConfig；文件作用: 延迟读取当前页面唯一后端 origin。
import { getFrontendRuntimeConfig } from '../../config/frontendRuntimeConfig.js';

import {
  // 导入来源: ./backendInfrastructure.config.js；导入内容: BACKEND_INFRASTRUCTURE_CONFIG；文件作用: 构造并校验独立健康请求。
  BACKEND_INFRASTRUCTURE_CONFIG,

  // 导入来源: ./backendInfrastructure.config.js；导入内容: BACKEND_INFRASTRUCTURE_STATUS；文件作用: 创建和发布四态快照。
  BACKEND_INFRASTRUCTURE_STATUS
} from './backendInfrastructure.config.js';

// 类型: string；作用: 让 ProxyClient 识别健康门禁失败而不解析用户文案。
const BACKEND_AVAILABILITY_ERROR_NAME = 'BackendAvailabilityError';

// 类型: ReadonlyArray<string>；作用: 限制隔离服务只能替换 fetch 和后端 origin 读取端口。
const BACKEND_AVAILABILITY_OPTION_KEYS = Object.freeze([
  'fetchImpl',
  'getBackendOrigin'
]);

/**
 * 后端基础设施门禁错误。
 * 状态所有权: 错误只表示当前门禁未得到 available，不保存 URL、响应正文、Provider 或底层异常。
 * 副作用: 创建 Error 实例，不修改协调器状态。
 * 失败路径: ensureAvailable 在共享检查收敛为 unavailable 时创建。
 */
export class BackendAvailabilityError extends Error {
  /**
   * 创建固定后端不可用错误。
   * 副作用: 只设置稳定名称和安全说明，不保留原始 cause。
   *
   * @returns {BackendAvailabilityError} 当前错误实例。
   */
  constructor() {
    super(BACKEND_INFRASTRUCTURE_CONFIG.unavailableMessage);
    this.name = BACKEND_AVAILABILITY_ERROR_NAME;
  }
}

/**
 * 校验服务工厂注入选项。
 * 纯函数: 只读取对象自有键，不修改候选。
 * 失败路径: 非普通对象、symbol 或未知字段抛 TypeError，不能静默忽略无效依赖。
 *
 * @param {*} options 服务工厂选项候选。
 * @returns {object} 通过校验的原普通对象。
 * @throws {TypeError} 选项不符合精确字段边界时抛出。
 */
function assertFactoryOptions(options) {
  // 条件分支: options 不是普通非数组对象时进入；执行内容: 抛 TypeError，阻止无效依赖进入健康服务。
  if (!options
    || typeof options !== 'object'
    || Array.isArray(options)
    || Object.getPrototypeOf(options) !== Object.prototype) {
    throw new TypeError('BackendAvailabilityService options 必须是普通对象');
  }

  // 类型: Array<string|symbol>；作用: 读取全部自有键，拒绝 symbol 和未登记注入字段。
  const optionKeys = Reflect.ownKeys(options);
  // 条件分支: 存在 symbol 或未登记字段时进入；执行内容: 抛 TypeError，避免隐式采用未知端口。
  if (optionKeys.some(key => typeof key !== 'string' || !BACKEND_AVAILABILITY_OPTION_KEYS.includes(key))) {
    throw new TypeError('BackendAvailabilityService options 包含未知字段');
  }

  return options;
}

/**
 * 创建后端基础设施状态快照。
 * 纯函数: 只根据状态创建新冻结对象，不读取网络或共享变量。
 * 失败路径: 未登记状态抛 TypeError，避免组件收到未知展示分支。
 *
 * @param {string} status BACKEND_INFRASTRUCTURE_STATUS 中的状态。
 * @returns {Readonly<{status: string, message: string}>} 冻结状态快照。
 * @throws {TypeError} 状态不属于四态枚举时抛出。
 */
function createStatusSnapshot(status) {
  // 条件分支: status 不在基础设施四态枚举时进入；执行内容: 抛 TypeError，阻止组件收到未知状态。
  if (!Object.values(BACKEND_INFRASTRUCTURE_STATUS).includes(status)) {
    throw new TypeError('后端基础设施状态不在允许枚举中');
  }

  return Object.freeze({
    status,
    message: status === BACKEND_INFRASTRUCTURE_STATUS.unavailable
      ? BACKEND_INFRASTRUCTURE_CONFIG.unavailableMessage
      : ''
  });
}

/**
 * 校验并规范化后端 origin。
 * 纯函数: 只解析字符串，不访问网络或运行配置全局。
 * 成功路径: 返回无路径、无凭据的 HTTP(S) origin。
 * 失败路径: 空值、非法协议、路径、凭据、query 或 hash 抛 TypeError。
 *
 * @param {*} origin FrontendRuntimeConfig 或测试端口返回的后端 origin。
 * @returns {string} 规范化后端 origin。
 * @throws {TypeError} origin 不符合运行配置契约时抛出。
 */
function normalizeBackendOrigin(origin) {
  // 条件分支: origin 不是非空字符串时进入；执行内容: 抛 TypeError，禁止使用默认地址。
  if (typeof origin !== 'string' || !origin.trim()) {
    throw new TypeError('后端健康检查需要有效 origin');
  }

  // 类型: URL|undefined；作用: 保存标准 URL 解析结果，供纯 origin 边界校验。
  let parsedUrl;
  try {
    parsedUrl = new URL(origin);
  } catch {
    throw new TypeError('后端健康检查 origin 无法解析');
  }

  // 条件分支: origin 不是纯 HTTP(S) origin 时进入；执行内容: 抛 TypeError，禁止拼接非法健康地址。
  if (!['http:', 'https:'].includes(parsedUrl.protocol)
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.pathname !== '/'
    || parsedUrl.search
    || parsedUrl.hash) {
    throw new TypeError('后端健康检查 origin 必须是无路径、无凭据的 HTTP(S) origin');
  }

  return parsedUrl.origin;
}

/**
 * 组合当前后端健康端点 URL。
 * 纯函数: 调用后端 origin 读取端口并组合固定路径，不访问网络。
 * 失败路径: 读取端口失败或 origin 非法时向上抛出，由健康检查收敛 unavailable。
 *
 * @param {Function} getBackendOrigin 当前组合使用的后端 origin 读取端口。
 * @returns {string} 独立健康端点绝对 URL。
 */
function createHealthEndpoint(getBackendOrigin) {
  // 类型: string；作用: 保存已通过纯 origin 校验的后端地址，供固定健康路径拼接。
  const backendOrigin = normalizeBackendOrigin(getBackendOrigin());
  return new URL(BACKEND_INFRASTRUCTURE_CONFIG.healthPath, `${backendOrigin}/`).href;
}

/**
 * 校验健康 HTTP 响应形状和成功语义。
 * 纯函数: 只读取状态、headers 和 json 方法，不消费正文。
 * 失败路径: 非 200、媒体类型偏离或响应能力缺失抛 TypeError。
 *
 * @param {*} response fetch 返回的健康响应候选。
 * @returns {object} 通过校验的 Response 原引用。
 * @throws {TypeError} 响应不符合健康 HTTP 契约时抛出。
 */
function assertHealthResponse(response) {
  // 条件分支: Response 缺少成功状态、JSON 读取或 headers 能力时进入；执行内容: 抛 TypeError，拒绝伪造健康结果。
  if (!response
    || typeof response !== 'object'
    || response.ok !== true
    || response.status !== 200
    || typeof response.json !== 'function'
    || !response.headers
    || typeof response.headers.get !== 'function') {
    throw new TypeError('后端健康 HTTP 响应无效');
  }

  // 类型: unknown；作用: 读取响应媒体类型，允许标准 charset 参数但拒绝 HTML 等错误页。
  const contentType = response.headers.get('content-type');
  // 条件分支: content-type 不是 application/json 主媒体类型时进入；执行内容: 抛 TypeError，拒绝 HTML 错误页。
  if (typeof contentType !== 'string'
    || contentType.split(';', 1)[0].trim().toLowerCase() !== BACKEND_INFRASTRUCTURE_CONFIG.contentType) {
    throw new TypeError('后端健康响应媒体类型无效');
  }

  return response;
}

/**
 * 校验健康 JSON 精确字段。
 * 纯函数: 只读取普通对象自有键，不修改候选。
 * 失败路径: 字段缺失、未知字段或状态不是 available 时抛 TypeError。
 *
 * @param {*} payload 健康响应 JSON 候选。
 * @returns {Readonly<object>} 冻结标准健康响应。
 * @throws {TypeError} JSON 不符合最小健康契约时抛出。
 */
function assertHealthPayload(payload) {
  // 条件分支: payload 不是只有 status=available 的普通对象时进入；执行内容: 抛 TypeError，拒绝未知诊断字段。
  if (!payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || Object.getPrototypeOf(payload) !== Object.prototype
    || Reflect.ownKeys(payload).length !== 1
    || payload.status !== BACKEND_INFRASTRUCTURE_CONFIG.successResponse.status) {
    throw new TypeError('后端健康响应正文无效');
  }

  return BACKEND_INFRASTRUCTURE_CONFIG.successResponse;
}

/**
 * 校验单次等待选项。
 * 纯函数: 只读取 options.signal，不修改信号或共享检查。
 * 失败路径: 非普通对象、未知字段或伪造 signal 抛 TypeError。
 *
 * @param {*} options ensureAvailable 或 retry 的调用选项。
 * @returns {AbortSignal|undefined} 通过校验的可选生命周期信号。
 * @throws {TypeError} 选项或 signal 不符合边界时抛出。
 */
function normalizeWaitOptions(options) {
  // 条件分支: options 不是只含 signal 的普通对象时进入；执行内容: 抛 TypeError，阻止调用方扩大等待协议。
  if (!options
    || typeof options !== 'object'
    || Array.isArray(options)
    || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).some(key => key !== 'signal')) {
    throw new TypeError('后端健康等待选项无效');
  }

  // 类型: unknown；作用: 保存当前调用可选生命周期信号，不把它传给共享健康 fetch。
  const signal = options.signal;
  // 条件分支: signal 存在但缺少 AbortSignal 能力时进入；执行内容: 抛 TypeError，拒绝伪造生命周期。
  if (signal !== undefined
    && (!signal
      || typeof signal !== 'object'
      || typeof signal.aborted !== 'boolean'
      || typeof signal.addEventListener !== 'function'
      || typeof signal.removeEventListener !== 'function')) {
    throw new TypeError('后端健康等待 signal 无效');
  }

  return signal;
}

/**
 * 等待共享健康检查，同时允许单个调用独立中止等待。
 * 副作用: 为当前 signal 临时注册一次 abort 监听，完成后立即移除；不取消共享健康 fetch。
 * 成功路径: 当前调用未中止时返回共享检查快照。
 * 失败路径: signal 已中止或等待期间中止时拒绝 BackendAvailabilityError。
 *
 * @param {Promise<Readonly<object>>} checkPromise 当前唯一共享健康检查。
 * @param {AbortSignal|undefined} signal 当前调用可选生命周期信号。
 * @returns {Promise<Readonly<object>>} 当前调用可采用的健康快照。
 */
function waitForSharedCheck(checkPromise, signal) {
  // 条件分支: 当前调用没有 signal 时进入；执行内容: 直接返回共享 Promise，不增加监听器。
  if (!signal) {
    return checkPromise;
  }

  // 条件分支: signal 已经中止时进入；执行内容: 立即拒绝当前等待，不启动新的健康请求。
  if (signal.aborted) {
    return Promise.reject(new BackendAvailabilityError());
  }

  return new Promise((resolve, reject) => {
    // 类型: boolean；作用: 防止健康完成与 abort 同时到达时重复收敛当前等待。
    let settled = false;

    /**
     * 完成当前调用等待并清理 abort 监听。
     * 副作用: 首次调用移除监听并执行 resolve/reject，后续调用直接返回。
     *
     * @param {Function} settlePromise resolve 或 reject 回调。
     * @param {*} value 当前完成值或错误。
     * @returns {void}
     */
    function settle(settlePromise, value) {
      // 条件分支: 当前等待已经由健康完成或 abort 收敛时进入；执行内容: 直接返回，避免重复 resolve/reject。
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener('abort', handleAbort);
      settlePromise(value);
    }

    /**
     * 处理当前调用中止。
     * 副作用: 只拒绝当前等待，不取消其它调用共用的健康请求。
     *
     * @returns {void}
     */
    function handleAbort() {
      settle(reject, new BackendAvailabilityError());
    }

    signal.addEventListener('abort', handleAbort, { once: true });
    checkPromise.then(
      snapshot => settle(resolve, snapshot),
      error => settle(reject, error)
    );
  });
}

/**
 * 创建隔离后端基础设施状态协调器。
 * 状态所有权: 实例只保存冻结四态快照、监听器集合和一个在途 Promise，不保存请求或响应正文。
 * 副作用: ensureAvailable/retry 首次需要检查时发送一个 GET /health；subscribe 注册内存监听器。
 * 成功路径: 返回 getSnapshot/subscribe/ensureAvailable/retry/markUnavailable 冻结门面。
 * 失败路径: 依赖非法时同步抛 TypeError；健康失败只发布 unavailable，不能修改 Provider 状态。
 *
 * @param {object} [options={}] 可替换依赖。
 * @param {Function} [options.fetchImpl=globalThis.fetch] 健康请求传输端口。
 * @param {Function} [options.getBackendOrigin] 后端 origin 读取端口。
 * @returns {Readonly<object>} 后端基础设施状态协调器。
 */
export function createBackendAvailabilityService(options = {}) {
  // 类型: object；作用: 保存经过精确字段校验的服务注入选项。
  const normalizedOptions = assertFactoryOptions(options);
  // 类型: Function|undefined；作用: 使用显式注入或绑定全局 fetch，不建立 Mock 回退。
  const fetchImpl = normalizedOptions.fetchImpl === undefined
    ? globalThis.fetch?.bind(globalThis)
    : normalizedOptions.fetchImpl;
  // 类型: Function；作用: 缺省时延迟读取启动屏障投影，创建服务本身不访问配置。
  const getBackendOrigin = normalizedOptions.getBackendOrigin === undefined
    ? () => getFrontendRuntimeConfig().backendOrigin
    : normalizedOptions.getBackendOrigin;

  // 条件分支: fetch 或 origin 端口不是函数时进入；执行内容: 抛 TypeError，禁止建立半成品协调器。
  if (typeof fetchImpl !== 'function' || typeof getBackendOrigin !== 'function') {
    throw new TypeError('BackendAvailabilityService 需要有效 fetch 和 origin 读取端口');
  }

  // 类型: Readonly<object>；生命周期: 当前服务实例；作用: 保存当前可发布四态快照。
  let currentSnapshot = createStatusSnapshot(BACKEND_INFRASTRUCTURE_STATUS.idle);
  // 类型: Set<Function>；生命周期: 当前服务实例；作用: 保存 App Shell 等内存监听器。
  const listeners = new Set();
  // 类型: Promise<Readonly<object>>|null；生命周期: 当前健康请求；作用: 所有并发调用复用唯一检查。
  let inFlightCheck = null;

  /**
   * 发布新的基础设施状态。
   * 副作用: 替换当前冻结快照并同步通知每个监听器；监听器异常被隔离。
   * 成功路径: 状态或文案变化时发布一次；完全相同快照不重复通知。
   *
   * @param {string} status 下一状态。
   * @returns {Readonly<object>} 当前最终快照。
   */
  function publish(status) {
    // 类型: Readonly<object>；作用: 保存当前状态转换生成的冻结候选快照。
    const nextSnapshot = createStatusSnapshot(status);
    // 条件分支: 新旧状态和文案完全一致时进入；执行内容: 返回既有快照，避免重复通知。
    if (nextSnapshot.status === currentSnapshot.status
      && nextSnapshot.message === currentSnapshot.message) {
      return currentSnapshot;
    }

    currentSnapshot = nextSnapshot;
    for (const listener of listeners) {
      try {
        listener(currentSnapshot);
      } catch {
        // 监听器失败只隔离当前消费者，不能阻止健康状态收敛或其他监听器更新。
      }
    }
    return currentSnapshot;
  }

  /**
   * 执行一次真实健康检查并收敛为 available 或 unavailable。
   * 副作用: 发布 checking，发送一个无凭据、no-store GET，并发布最终状态。
   * 成功路径: HTTP、媒体类型和 JSON 全部精确匹配时发布 available。
   * 失败路径: 配置、fetch、响应读取或契约任一失败时发布 unavailable，不保存原始错误。
   *
   * @returns {Promise<Readonly<object>>} 最终状态快照。
   */
  async function executeHealthCheck() {
    publish(BACKEND_INFRASTRUCTURE_STATUS.checking);
    try {
      // 类型: string；作用: 保存本轮唯一健康 GET 的绝对地址。
      const endpoint = createHealthEndpoint(getBackendOrigin);
      // 类型: Response；作用: 保存健康端点返回值，供后续严格响应校验。
      const response = await fetchImpl(endpoint, {
        method: 'GET',
        headers: { accept: BACKEND_INFRASTRUCTURE_CONFIG.accept },
        cache: BACKEND_INFRASTRUCTURE_CONFIG.cacheMode,
        credentials: 'omit'
      });
      // 类型: object；作用: 保存已通过 HTTP 状态和媒体类型校验的健康响应。
      const validResponse = assertHealthResponse(response);
      // 类型: unknown；作用: 保存健康端点 JSON 正文，交给精确字段校验。
      const payload = await validResponse.json();
      assertHealthPayload(payload);
      return publish(BACKEND_INFRASTRUCTURE_STATUS.available);
    } catch {
      return publish(BACKEND_INFRASTRUCTURE_STATUS.unavailable);
    }
  }

  /**
   * 取得当前唯一健康检查 Promise。
   * 副作用: 没有在途检查时创建一次；完成后只清除同一 Promise 引用。
   * 成功路径: 并发调用返回同一 Promise。
   *
   * @returns {Promise<Readonly<object>>} 当前共享检查。
   */
  function getOrStartHealthCheck() {
    // 条件分支: 已存在健康检查 Promise 时进入；执行内容: 返回该 Promise，复用当前在途请求。
    if (inFlightCheck) {
      return inFlightCheck;
    }

    // 类型: Promise<Readonly<object>>；作用: 保存本轮检查身份，finally 只清除自身。
    const checkPromise = executeHealthCheck().finally(() => {
      // 条件分支: 当前在途引用仍属于本轮检查时进入；执行内容: 清除引用，允许后续显式请求开启新一轮。
      if (inFlightCheck === checkPromise) {
        inFlightCheck = null;
      }
    });
    inFlightCheck = checkPromise;
    return checkPromise;
  }

  return Object.freeze({
    /**
     * 读取当前基础设施状态。
     * 纯函数: 返回不可变快照，不暴露监听器或在途 Promise。
     *
     * @returns {Readonly<object>} 当前状态快照。
     */
    getSnapshot() {
      return currentSnapshot;
    },

    /**
     * 订阅基础设施状态。
     * 副作用: 登记监听器并立即交付当前快照；返回幂等取消函数。
     * 失败路径: listener 不是函数时抛 TypeError。
     *
     * @param {Function} listener 状态消费者。
     * @returns {Function} 幂等取消订阅函数。
     */
    subscribe(listener) {
      // 条件分支: listener 不是函数时进入；执行内容: 抛 TypeError，阻止无效订阅进入集合。
      if (typeof listener !== 'function') {
        throw new TypeError('BackendAvailabilityService listener 必须是函数');
      }
      listeners.add(listener);
      try {
        listener(currentSnapshot);
      } catch {
        // 首次监听失败同样只隔离当前消费者，订阅仍可在后续状态变化时继续接收。
      }
      return () => {
        listeners.delete(listener);
      };
    },

    /**
     * 在代理业务请求前确认后端可用。
     * 副作用: 非 available 时启动或复用一次健康检查；当前 signal 只中止自身等待。
     * 成功路径: 返回 available 快照。
     * 失败路径: 检查收敛 unavailable 或当前等待中止时抛 BackendAvailabilityError。
     *
     * @param {object} [waitOptions={}] 当前调用等待选项。
     * @returns {Promise<Readonly<object>>} available 快照。
     * @throws {BackendAvailabilityError} 后端不可用或当前等待中止时抛出。
     */
    async ensureAvailable(waitOptions = {}) {
      // 类型: AbortSignal|undefined；作用: 保存当前调用可选中止信号，不传入共享健康 fetch。
      const signal = normalizeWaitOptions(waitOptions);
      // 条件分支: 当前调用已经中止时进入；执行内容: 立即抛健康门禁错误，不发起检查。
      if (signal?.aborted) {
        throw new BackendAvailabilityError();
      }
      // 条件分支: 当前快照已经 available 时进入；执行内容: 直接返回，不重复健康请求。
      if (currentSnapshot.status === BACKEND_INFRASTRUCTURE_STATUS.available) {
        return currentSnapshot;
      }

      // 类型: Readonly<object>；作用: 保存本调用等待共享健康检查后的最终状态。
      const snapshot = await waitForSharedCheck(getOrStartHealthCheck(), signal);
      // 条件分支: 健康检查没有得到 available 时进入；执行内容: 抛稳定健康门禁错误。
      if (snapshot.status !== BACKEND_INFRASTRUCTURE_STATUS.available) {
        throw new BackendAvailabilityError();
      }
      return snapshot;
    },

    /**
     * 执行用户显式健康重试。
     * 副作用: 启动或复用当前健康检查，不弹消息、不触发 Provider 检查。
     * 成功路径: 返回本轮 available 或 unavailable 最终快照。
     *
     * @param {object} [waitOptions={}] 当前调用等待选项。
     * @returns {Promise<Readonly<object>>} 本轮最终状态快照。
     */
    retry(waitOptions = {}) {
      // 类型: AbortSignal|undefined；作用: 保存当前重试调用可选中止信号。
      const signal = normalizeWaitOptions(waitOptions);
      return waitForSharedCheck(getOrStartHealthCheck(), signal);
    },

    /**
     * 标记后端连接或协议边界不可用。
     * 副作用: 只发布 unavailable；不保存错误、不取消其它调用、不修改 Provider。
     *
     * @returns {Readonly<object>} unavailable 快照。
     */
    markUnavailable() {
      return publish(BACKEND_INFRASTRUCTURE_STATUS.unavailable);
    }
  });
}

// 类型: Readonly<object>；作用: 产品 App Shell 和默认 ProxyClient 共用唯一页面会话状态。
export const backendAvailabilityService = createBackendAvailabilityService();
