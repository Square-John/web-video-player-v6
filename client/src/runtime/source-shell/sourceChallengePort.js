/*
  sourceChallengePort.js 模块说明

  - 文件职责:
      创建绑定单一 sourceId、AbortSignal 和可选全局协调请求端口的挑战端口。
      负责 Shell 输入校验和权限裁剪，不渲染页面、不读取会话存储，也不持有交互订阅。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      SOURCE_CHALLENGE_STATUS: 自定义配置，提供当前允许的挑战结果状态。
      SourceShellValidationError: 自定义 Shell 错误，拒绝非法依赖选项。
      Shell validators: 自定义验证器，校验 sourceId、AbortSignal、精确参数和挑战字段。

  - 模块级常量:
      SOURCE_CHALLENGE_PORT_OPTION_FIELDS: Array<string>，挑战端口精确依赖字段。
      SOURCE_CHALLENGE_RESULT_MESSAGE: object，无协调器时 unsupported 和中止时 cancelled 的稳定说明。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertChallengePortOptions(options): Function，校验精确 sourceId 和 signal 依赖。
      createChallengeResult(challengeId, status): Function，创建冻结占位结果。

  - 模块级类:
      无

  - 对外导出:
      createSourceChallengePort(options): Function，创建绑定身份和生命周期的冻结挑战端口。
*/

// 导入来源: ./source-shell.config.js。
// 导入内容: SOURCE_CHALLENGE_STATUS 当前挑战状态枚举。
// 文件作用: 无协调器和中止结果由端口构造，resolved 只能来自受控协调器。
import { SOURCE_CHALLENGE_STATUS } from './source-shell.config.js';

// 导入来源: ./sourceShellErrors.js。
// 导入内容: SourceShellValidationError Shell 输入错误。
// 文件作用: options 字段或依赖不符合契约时返回稳定 validation。
import { SourceShellValidationError } from './sourceShellErrors.js';

import {
  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertAbortSignal AbortSignal 结构校验。
  // 文件作用: 构造时绑定真实生命周期信号，不接受普通状态对象伪装。
  assertAbortSignal,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertExactArgumentCount 精确参数数量校验。
  // 文件作用: request 只接受一个 SourceChallenge，不能夹带 sourceId 或页面对象。
  assertExactArgumentCount,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: normalizeSourceChallenge 挑战规范化函数。
  // 文件作用: 校验精确字段、绑定身份、ISO 时间并隔离 fields。
  normalizeSourceChallenge,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: normalizeSourceShellId 安全数据源身份规范化函数。
  // 文件作用: 构造时永久绑定安全 sourceId 并拒绝危险动态键。
  normalizeSourceShellId
} from './sourceShellValidators.js';

// 类型: Array<string>。
// 作用: 固定挑战端口构造依赖，禁止页面、store、会话对象或回调被静默塞入闭包。
const SOURCE_CHALLENGE_PORT_OPTION_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: 要求端口显式绑定唯一数据源身份。
  'sourceId',

  // 类型: string。
  // 作用: 要求端口显式绑定 Host 将来负责中止的生命周期信号。
  'signal',

  // 类型: string。
  // 作用: 可选注入全局挑战请求窄端口；缺失时保持 1.0.0 unsupported 行为。
  'requestPort'
]);

// 类型: object。
// 作用: 集中维护端口自身产生的失败结果说明，resolved 文案由协调器统一生成。
const SOURCE_CHALLENGE_RESULT_MESSAGE = Object.freeze({
  // 类型: string。
  // 作用: 未中止时说明当前前端尚未实现真实挑战交互。
  unsupported: '当前阶段尚未提供验证交互',

  // 类型: string。
  // 作用: signal 已中止时说明本次挑战不能继续采用。
  cancelled: '当前挑战已因生命周期中止而取消'
});

/**
 * 校验挑战端口构造选项。
 * 纯函数: 只读取 options 字段并返回规范化依赖，不注册监听器或修改 signal。
 * 成功路径: 返回安全 sourceId 和原始 AbortSignal。
 * 失败路径: options 类型、字段、sourceId 或 signal 不合法时抛稳定 validation。
 *
 * @param {*} options 挑战端口依赖候选。
 * @returns {object} 规范化挑战端口依赖。
 * @returns {string} return.sourceId 安全且永久绑定的数据源 id。
 * @returns {object} return.signal 已验证 AbortSignal 原引用。
 * @throws {SourceShellValidationError} 当依赖对象不符合精确契约时抛出。
 */
function assertChallengePortOptions(options) {
  // 条件分支: options 不是非数组对象时进入。
  // 执行内容: 拒绝读取缺失 sourceId 或 signal 的依赖容器。
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new SourceShellValidationError('sourceChallengePort options 必须是对象');
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取全部自有字段，包含 symbol 和不可枚举属性，防止隐藏能力进入端口闭包。
  const optionFields = Reflect.ownKeys(options);

  // 条件分支: 缺少 sourceId/signal 或存在非标准字段时进入。
  // 执行内容: requestPort 可以省略以支持 1.0.0 Provider，但页面回调和其他依赖仍被拒绝。
  if (!Object.hasOwn(options, 'sourceId') || !Object.hasOwn(options, 'signal')
    || optionFields.some(field => (
      typeof field !== 'string' || !SOURCE_CHALLENGE_PORT_OPTION_FIELDS.includes(field)
    ))) {
    throw new SourceShellValidationError('sourceChallengePort options 字段不符合契约');
  }

  // 类型: string。
  // 作用: 规范化并永久绑定端口身份，后续 request 不能由调用方覆盖。
  const sourceId = normalizeSourceShellId(options.sourceId, 'sourceChallengePort.sourceId');

  // 类型: object。
  // 作用: 保存已验证 Host 生命周期信号原引用，不创建本地中止注册表。
  const signal = assertAbortSignal(options.signal, 'sourceChallengePort.signal');

  // 类型: object|null。
  // 作用: 保存只含 request 的冻结协调请求端口；null 表示当前 Runtime 不提供人工交互。
  const requestPort = options.requestPort === undefined ? null : options.requestPort;

  // 条件分支: 显式 requestPort 不是冻结精确单方法对象时进入。
  // 执行内容: 阻止交互订阅、提交或页面对象泄漏到 Source Shell。
  if (requestPort !== null) {
    // 类型: Array<string|symbol>。
    // 作用: 检查请求端口没有隐藏交互控制方法或不可枚举能力。
    const requestPortFields = Reflect.ownKeys(requestPort);

    // 条件分支: 请求端口可变、字段不精确或 request 不是函数时进入。
    // 执行内容: 拒绝把未裁剪协调器注入 Shell。
    if (!Object.isFrozen(requestPort)
      || requestPortFields.length !== 1
      || requestPortFields[0] !== 'request'
      || typeof requestPort.request !== 'function') {
      throw new SourceShellValidationError('sourceChallengePort.requestPort 必须只提供冻结 request 方法');
    }
  }

  // 返回值类型: object。
  // 作用: 返回冻结依赖，端口创建过程不再读取可变 options 容器。
  return Object.freeze({
    // 类型: string。
    // 作用: 提供挑战规范化使用的唯一绑定身份。
    sourceId,

    // 类型: object。
    // 作用: 提供 request 决定 unsupported 或 cancelled 的同一生命周期信号。
    signal,

    // 类型: Function|null。
    // 作用: 捕获协调请求函数，后续调用不再读取可变 options 或端口容器。
    requestChallenge: requestPort ? requestPort.request.bind(requestPort) : null
  });
}

/**
 * 创建冻结挑战占位结果。
 * 纯函数: 只根据 challengeId 和状态返回新对象，不修改挑战或生命周期信号。
 * 成功路径: 返回 unsupported 或 cancelled 的精确四字段结果。
 * 失败路径: status 由内部冻结分支产生，不接受外部任意值。
 *
 * @param {string} challengeId 已验证挑战关联标识。
 * @param {string} status SOURCE_CHALLENGE_STATUS 中的占位状态。
 * @returns {object} 冻结 SourceChallengeResult。
 * @returns {string} return.status unsupported 或 cancelled。
 * @returns {string} return.challengeId 回填的挑战关联标识。
 * @returns {object} return.values 冻结空对象，当前阶段没有用户输入结果。
 * @returns {string} return.message 当前状态对应的稳定说明。
 */
function createChallengeResult(challengeId, status) {
  // 类型: object。
  // 作用: 当前阶段不产生用户输入，使用冻结空对象阻止调用方伪造 resolved values。
  const values = Object.freeze({});

  // 返回值类型: object。
  // 作用: 返回精确结果字段，Provider 不能从端口获得页面或完整会话对象。
  return Object.freeze({
    // 类型: string。
    // 作用: 表达当前挑战不受支持或因生命周期中止而取消。
    status,

    // 类型: string。
    // 作用: 回填已验证挑战 id，Provider 可以关联原请求。
    challengeId,

    // 类型: object。
    // 作用: 保持当前阶段没有真实输入结果的明确边界。
    values,

    // 类型: string。
    // 作用: 提供当前状态说明，调用方不能解析文案决定业务分支。
    message: SOURCE_CHALLENGE_RESULT_MESSAGE[status]
  });
}

/**
 * 创建绑定单一数据源、生命周期和可选协调器的挑战端口。
 * 纯函数: 创建冻结方法闭包；监听器和队列资源由协调器拥有，不读取存储或操作页面。
 *
 * @param {object} options 挑战端口依赖。
 * @param {string} options.sourceId 当前 Provider 唯一数据源 id。
 * @param {AbortSignal} options.signal Host 生命周期中止信号。
 * @param {object} [options.requestPort] 可选全局挑战请求窄端口，缺失时返回 unsupported。
 * @returns {object} 冻结挑战端口。
 * @returns {string} return.sourceId 端口绑定的数据源 id，供 SourceContext 组合时校验。
 * @returns {AbortSignal} return.signal 端口绑定生命周期信号，供 SourceContext 执行同一引用校验。
 * @returns {Function} return.request 提交标准挑战并返回占位结果的异步方法。
 * @throws {SourceShellValidationError} 当 options 不符合精确依赖契约时抛出。
 */
export function createSourceChallengePort(options) {
  // 类型: object。
  // 作用: 保存脱离原 options 容器的冻结依赖，确保后续请求身份和 signal 不漂移。
  const dependencies = assertChallengePortOptions(options);

  // 返回值类型: object。
  // 作用: 端口只公开绑定身份和 request；不暴露页面、存储或 resolved 构造能力。
  return Object.freeze({
    // 类型: string。
    // 作用: 供 SourceContext 验证 challenge、network、logger 使用同一 sourceId。
    sourceId: dependencies.sourceId,

    // 类型: AbortSignal。
    // 作用: 供 SourceContext 验证 challenge 与 network 使用同一生命周期；Provider 不直接获得端口根对象。
    signal: dependencies.signal,

    /**
     * 提交标准挑战并等待受控协调结果。
     * 副作用: 有 requestPort 时把隔离挑战交给全局 FIFO；资源和页面发布由协调器管理。
     * 成功路径: 已中止返回 cancelled；无协调器返回 unsupported；有协调器返回其稳定结果。
     * 失败路径: 参数数量、字段、身份、时间或协调器输入不合法时抛稳定 validation。
     *
     * @param {...*} args 精确包含一个 SourceChallenge。
     * @returns {Promise<object>} 冻结 SourceChallengeResult。
     * @throws {SourceShellValidationError} 当调用参数或挑战不符合契约时抛出。
     */
    async request(...args) {
      // 执行内容: 只允许一个挑战对象，不能夹带 sourceId、页面回调或续接对象。
      assertExactArgumentCount(args, 1, 'challenge.request');

      // 类型: object。
      // 作用: 保存调用方唯一挑战候选，身份和字段由集中验证器重新校验。
      const [challengeCandidate] = args;

      // 类型: object。
      // 作用: 保存与端口身份一致且 fields 引用隔离的标准挑战。
      const challenge = normalizeSourceChallenge(challengeCandidate, dependencies.sourceId);

      // 条件分支: Host 生命周期已经中止时进入。
      // 执行内容: 不向协调器入队，直接返回 cancelled。
      if (dependencies.signal.aborted) {
        return createChallengeResult(
          challenge.challengeId,
          SOURCE_CHALLENGE_STATUS.cancelled
        );
      }

      // 条件分支: 当前 Runtime 没有注入全局协调请求端口时进入。
      // 执行内容: 保持 Provider ABI 1.0.0 的明确 unsupported 行为，不挂起请求。
      if (!dependencies.requestChallenge) {
        return createChallengeResult(
          challenge.challengeId,
          SOURCE_CHALLENGE_STATUS.unsupported
        );
      }

      // 异步调用: 只交付标准挑战和同一 Host signal；resolve 返回三状态精确结果，reject 原样传播稳定 Shell 错误。
      return dependencies.requestChallenge(challenge, dependencies.signal);
    }
  });
}
