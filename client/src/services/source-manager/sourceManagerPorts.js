/*
  sourceManagerPorts.js 模块说明

  - 文件职责:
      校验 SourceManager Provider 就绪、健康检测和更新检测端口及其标准结果。
      让 SourceManager 只依赖可替换接口，不认识 mock 场景、网络、Host、Vue 或页面。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      HEALTH_STATUS、PROVIDER_READINESS_STATUS、PROVIDER_READINESS_REASON_CODE: 自定义配置，健康结果和 Provider 就绪结果枚举。
      assertPlainObject: 自定义校验，严格普通对象边界。
      SourceManagerOperationError、SourceManagerValidationError: 自定义错误，端口调用和结果失败。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertExactFields、assertNonEmptyString、assertIsoTimestamp、validateSingleMethodPort: Function，端口和结果基础校验。

  - 模块级类:
      无

  - 对外导出:
      validateSourceProviderReadinessResult、validateSourceHealthCheckResult、validateSourceUpdateCheckResult: Function，标准结果校验。
      createSourceProviderReadinessPort、createSourceHealthCheckPort、createSourceUpdateCheckPort: Function，冻结端口门面工厂。
*/

// 导入来源: ../../config/source-manager.config。
import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 数据源健康状态枚举。
  // 文件作用: 健康端口完成结果只接受 normal 或 unavailable。
  HEALTH_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_REASON_CODE Provider 未就绪稳定原因码。
  // 文件作用: 就绪结果只接受无原因、工厂未注册或 Definition 不受支持三种组合。
  PROVIDER_READINESS_REASON_CODE,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_STATUS Provider 就绪状态枚举。
  // 文件作用: 就绪端口结果只允许 ready 或 unavailable。
  PROVIDER_READINESS_STATUS
} from '../../config/source-manager.config.js';

// 导入来源: ../../repositories/source/sourceRepositoryValidators。
// 导入内容: assertPlainObject 严格普通对象校验函数。
// 文件作用: 拒绝复杂端口和结果对象，保持可替换接口边界稳定。
import { assertPlainObject } from '../../repositories/source/sourceRepositoryValidators.js';

import {
  // 导入来源: ./sourceManagerErrors。
  // 导入内容: SourceManagerOperationError 领域操作错误。
  // 文件作用: 包装端口实现抛出的原始异常并保留 cause。
  SourceManagerOperationError,
  // 导入来源: ./sourceManagerErrors。
  // 导入内容: SourceManagerValidationError 领域校验错误。
  // 文件作用: 表达端口对象或标准结果不符合契约。
  SourceManagerValidationError
} from './sourceManagerErrors.js';

/**
 * 校验对象字段集合完全一致。
 * 纯函数: 只读取对象字段，不修改输入。
 *
 * @param {object} value 待校验对象。
 * @param {Array<string>} fields 完整允许字段集合。
 * @param {string} name 错误信息使用的对象名。
 * @returns {void} 校验通过时结束，不创建新的业务对象。
 * @throws {SourceManagerValidationError} 当对象类型、缺失字段或额外字段不符合契约时抛出。
 */
function assertExactFields(value, fields, name) {
  try {
    // 执行内容: 先拒绝数组、复杂实例和异常原型，保证字段遍历边界稳定。
    assertPlainObject(value, name);
  } catch (error) {
    // 异常来源: Repository 普通对象校验拒绝数组、复杂实例或异常原型。
    // 处理策略: 转换为 SourceManager 校验错误并保留底层 cause，统一端口调用方错误边界。
    throw new SourceManagerValidationError(error.message, { cause: error });
  }

  // 类型: Array<string>。
  // 作用: 读取全部可枚举字段，用于同时识别缺失和额外字段。
  const keys = Reflect.ownKeys(value);

  // 条件分支: 字段数量或名称与契约不一致时进入。
  // 执行内容: 拒绝不完整结果和未经设计的扩展字段。
  if (keys.length !== fields.length || fields.some(field => !keys.includes(field))) {
    throw new SourceManagerValidationError(`${name} 字段必须完整且不能包含额外字段`);
  }
}

/**
 * 校验非空字符串。
 * 纯函数: 只读取输入并返回原字符串，不执行 trim 后覆盖或修改调用方值。
 *
 * @param {*} value 待校验值。
 * @param {string} name 错误信息使用的字段名。
 * @returns {string} 原始非空字符串。
 * @throws {SourceManagerValidationError} 当输入不是字符串或去除空白后为空时抛出。
 */
function assertNonEmptyString(value, name) {
  // 条件分支: 输入不是字符串或只包含空白字符时进入。
  // 执行内容: 拒绝无法作为端口时间、版本或标识使用的空值。
  if (typeof value !== 'string' || !value.trim()) {
    throw new SourceManagerValidationError(`${name} 必须是非空字符串`);
  }
  return value;
}

/**
 * 校验标准 ISO 时间字符串。
 * 纯函数: 只读取输入并通过 Date 解析验证格式，不修改原时间文本。
 *
 * @param {*} value 待校验时间。
 * @param {string} name 错误信息使用的字段名。
 * @returns {string} 原始 ISO 时间。
 * @throws {SourceManagerValidationError} 当输入为空、无法解析或不是标准 UTC ISO 文本时抛出。
 */
function assertIsoTimestamp(value, name) {
  // 类型: string。
  // 作用: 保存已经通过非空校验的原时间文本，后续验证其解析和标准化结果。
  const timestamp = assertNonEmptyString(value, name);

  // 条件分支: 时间无法解析，或重新序列化后与原文本不一致时进入。
  // 执行内容: 拒绝本地时区、宽松日期和无效时间，保持端口时间格式唯一。
  if (Number.isNaN(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp) {
    throw new SourceManagerValidationError(`${name} 必须是标准 ISO 时间`);
  }
  return timestamp;
}

/**
 * 校验端口具备唯一指定方法。
 * 纯函数: 只读取端口对象的原型、字段和方法类型，不修改端口实例。
 *
 * @param {*} port 注入端口对象。
 * @param {string} methodName 端口唯一公开方法名。
 * @param {string} name 错误信息使用的端口名。
 * @returns {object} 校验后的原端口。
 * @throws {SourceManagerValidationError} 当端口不是普通对象或不只包含指定函数时抛出。
 */
function validateSingleMethodPort(port, methodName, name) {
  try {
    // 执行内容: 拒绝数组、类实例和异常原型，防止端口通过继承暴露未声明能力。
    assertPlainObject(port, name);
  } catch (error) {
    // 异常来源: Repository 普通对象校验拒绝端口容器。
    // 处理策略: 转换为 SourceManager 校验错误并保留原始 cause。
    throw new SourceManagerValidationError(error.message, { cause: error });
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取端口全部自有键，确保除指定方法外没有隐藏的第二项能力。
  const keys = Reflect.ownKeys(port);

  // 条件分支: 端口字段数量、字段名或方法类型不符合唯一方法契约时进入。
  // 执行内容: 拒绝缺失方法、附加状态和非函数成员，维持可替换端口最小边界。
  if (keys.length !== 1 || keys[0] !== methodName || typeof port[methodName] !== 'function') {
    throw new SourceManagerValidationError(`${name} 必须只包含 ${methodName} 函数`);
  }
  return port;
}

/**
 * 校验 Provider 就绪端口标准结果并返回隔离对象。
 * 纯函数: 只读取结果字段并返回新对象，不修改端口结果。
 * 组合规则: ready 必须没有失败原因；unavailable 必须具有受支持原因码和用户可读原因。
 *
 * @param {*} result 端口原始结果。
 * @returns {object} 字段完整且引用隔离的 Provider 就绪结果。
 * @returns {string} return.status ready 表示工厂支持当前 Definition，unavailable 表示当前不能创建 Provider。
 * @returns {string} return.reasonCode 稳定失败原因码；ready 时为空字符串。
 * @returns {string} return.reason 面向用户的失败原因；ready 时为空字符串。
 * @throws {SourceManagerValidationError} 当字段、状态或原因组合不符合契约时抛出。
 */
export function validateSourceProviderReadinessResult(result) {
  // 执行内容: 先执行精确字段校验，阻止端口遗漏字段或携带注册表、工厂等内部引用。
  assertExactFields(result, ['status', 'reasonCode', 'reason'], 'providerReadinessResult');

  // 条件分支: 状态不属于冻结二态时进入。
  // 执行内容: 拒绝 pending、running 等与就绪含义重叠的扩展状态。
  if (!Object.values(PROVIDER_READINESS_STATUS).includes(result.status)) {
    throw new SourceManagerValidationError('providerReadinessResult.status 只允许 ready 或 unavailable');
  }

  // 条件分支: 原因码或用户原因不是字符串时进入。
  // 执行内容: 拒绝 Error、对象和空值穿透到 SourceManagerState。
  if (typeof result.reasonCode !== 'string' || typeof result.reason !== 'string') {
    throw new SourceManagerValidationError('providerReadinessResult 原因字段必须是字符串');
  }

  // 条件分支: Provider 已就绪但仍携带失败原因时进入。
  // 执行内容: 拒绝陈旧原因与 ready 并存，避免设置页展示矛盾状态。
  if (result.status === PROVIDER_READINESS_STATUS.ready) {
    // 条件分支: ready 结果仍包含非空原因码或说明时进入。
    // 执行内容: 拒绝互相矛盾的成功结果，不允许页面继续显示历史错误。
    if (result.reasonCode !== PROVIDER_READINESS_REASON_CODE.none || result.reason !== '') {
      throw new SourceManagerValidationError('ready Provider 就绪结果不能携带失败原因');
    }
  } else {
    // 类型: Array<string>。
    // 作用: 固定 unavailable 可以使用的两个根因，空原因和未知扩展码不能进入投影。
    const unavailableReasonCodes = [
      PROVIDER_READINESS_REASON_CODE.providerNotRegistered,
      PROVIDER_READINESS_REASON_CODE.definitionNotSupported
    ];

    // 条件分支: unavailable 缺少受支持原因码或用户可读说明时进入。
    // 执行内容: 拒绝无法解释的不可执行状态，页面不需要猜测 providerKey。
    if (!unavailableReasonCodes.includes(result.reasonCode) || !result.reason.trim()) {
      throw new SourceManagerValidationError('unavailable Provider 就绪结果必须提供稳定原因码和用户原因');
    }
  }

  // 返回值类型: object。
  // 作用: 返回新的三字段对象，调用方不能通过修改结果污染端口原对象。
  return { ...result };
}

/**
 * 校验健康端口标准结果并返回隔离对象。
 * 纯函数: 只读取结果字段并返回新对象，不修改端口结果。
 *
 * @param {*} result 端口原始结果。
 * @returns {object} 字段完整且引用隔离的健康结果。
 * @returns {string} return.healthStatus 检测完成状态，只允许 normal 或 unavailable。
 * @returns {string} return.checkedAt 标准 UTC ISO 检测完成时间。
 * @returns {string} return.unavailableReason 不可用原因；健康正常时为空字符串。
 * @throws {SourceManagerValidationError} 当字段集合、状态、时间或原因组合不符合契约时抛出。
 */
export function validateSourceHealthCheckResult(result) {
  // 执行内容: 先执行精确字段校验，阻止端口遗漏字段或携带未经设计的扩展结果。
  assertExactFields(result, ['healthStatus', 'checkedAt', 'unavailableReason'], 'healthCheckResult');

  // 条件分支: 健康状态不是检测完成后的 normal 或 unavailable 时进入。
  // 执行内容: 拒绝 checking 等由 SourceManager 自己维护的过程状态。
  if (![HEALTH_STATUS.normal, HEALTH_STATUS.unavailable].includes(result.healthStatus)) {
    throw new SourceManagerValidationError('healthCheckResult.healthStatus 只允许 normal 或 unavailable');
  }
  // 执行内容: 校验检测完成时间，保证 SourceManager 采用统一 UTC ISO 时间。
  assertIsoTimestamp(result.checkedAt, 'healthCheckResult.checkedAt');

  // 条件分支: 不可用原因不是字符串时进入。
  // 执行内容: 拒绝对象和空值穿透到页面错误展示层。
  if (typeof result.unavailableReason !== 'string') {
    throw new SourceManagerValidationError('unavailableReason 必须是字符串');
  }
  // 条件分支: 健康结果为 normal 但仍携带不可用原因时进入。
  // 执行内容: 拒绝互相矛盾的状态组合，避免页面显示陈旧错误。
  if (result.healthStatus === HEALTH_STATUS.normal && result.unavailableReason) {
    throw new SourceManagerValidationError('normal 健康结果不能携带不可用原因');
  }
  // 条件分支: 健康结果为 unavailable 但没有非空原因时进入。
  // 执行内容: 要求失败结果可诊断，避免只返回模糊不可用状态。
  if (result.healthStatus === HEALTH_STATUS.unavailable && !result.unavailableReason.trim()) {
    throw new SourceManagerValidationError('unavailable 健康结果必须提供原因');
  }
  return { ...result };
}

/**
 * 校验更新端口标准结果并返回隔离对象。
 * 纯函数: 只读取结果字段并返回新对象，不修改端口结果。
 *
 * @param {*} result 端口原始结果。
 * @returns {object} 字段完整且引用隔离的更新结果。
 * @returns {boolean} return.updateAvailable true 表示存在更新，false 表示没有更新。
 * @returns {string} return.availableVersion 可用业务版本；没有更新时为空字符串。
 * @returns {string} return.availableVersionUpdatedAt 在线版本更新时间；没有更新时为空字符串。
 * @returns {string} return.checkedAt 标准 UTC ISO 检测完成时间。
 * @throws {SourceManagerValidationError} 当字段、Boolean、版本和时间组合不符合契约时抛出。
 */
export function validateSourceUpdateCheckResult(result) {
  // 执行内容: 先执行精确字段校验，阻止端口遗漏字段或携带未经设计的扩展结果。
  assertExactFields(result, ['updateAvailable', 'availableVersion', 'availableVersionUpdatedAt', 'checkedAt'], 'updateCheckResult');

  // 条件分支: updateAvailable 不是严格 Boolean 时进入。
  // 执行内容: 拒绝 0、1 和字符串等模糊更新状态。
  if (typeof result.updateAvailable !== 'boolean') {
    throw new SourceManagerValidationError('updateAvailable 必须是 boolean');
  }
  // 执行内容: 校验当前检查完成时间，保证 SourceManager 采用统一 UTC ISO 时间。
  assertIsoTimestamp(result.checkedAt, 'updateCheckResult.checkedAt');

  // 条件分支: 可用版本或版本更新时间不是字符串时进入。
  // 执行内容: 拒绝对象和空值进入更新状态投影。
  if (typeof result.availableVersion !== 'string' || typeof result.availableVersionUpdatedAt !== 'string') {
    throw new SourceManagerValidationError('更新版本和版本时间必须是字符串');
  }
  // 条件分支: updateAvailable 为 true 但缺少版本或版本时间时进入。
  // 执行内容: 拒绝无法执行后续版本比较和更新确认的半完成结果。
  if (result.updateAvailable && (!result.availableVersion || !result.availableVersionUpdatedAt)) {
    throw new SourceManagerValidationError('存在更新时必须提供版本和版本时间');
  }
  // 条件分支: 端口明确报告存在更新时进入。
  // 执行内容: 继续校验在线版本更新时间必须是标准 UTC ISO 文本。
  if (result.updateAvailable) {
    assertIsoTimestamp(result.availableVersionUpdatedAt, 'updateCheckResult.availableVersionUpdatedAt');
  } else {
    // 条件分支: updateAvailable 为 false 但仍携带版本或版本时间时进入。
    // 执行内容: 拒绝矛盾结果，避免页面错误显示可用更新。
    if (result.availableVersion || result.availableVersionUpdatedAt) {
      throw new SourceManagerValidationError('没有更新时版本和版本时间必须为空字符串');
    }
  }

  // 返回值类型: object。
  // 作用: 返回字段已验证的隔离更新结果，避免调用方修改端口原始对象。
  return { ...result };
}

/**
 * 创建冻结 Provider 就绪评估端口门面。
 * 副作用: 调用注入端口的 evaluate；不读取注册表之外的运行状态，不修改 SourceManagerState。
 *
 * @param {object} port 注入 Provider 就绪评估端口。
 * @returns {object} 只暴露异步 evaluate 的冻结门面。
 */
export function createSourceProviderReadinessPort(port) {
  // 类型: object。
  // 作用: 保存只具备 evaluate 的已校验端口，Manager 不会获得 Provider 工厂或注册表引用。
  const validatedPort = validateSingleMethodPort(
    port,
    'evaluate',
    'sourceProviderReadinessPort'
  );

  return Object.freeze({
    /**
     * 评估当前 Definition 是否具有受审可执行 Provider。
     * 副作用: 调用外部 evaluate；端口实现只允许读取当前 Bundle 注册表和工厂 supports 结果。
     * 成功路径: 返回字段完整、组合一致且引用隔离的就绪结果。
     * 失败路径: 契约校验错误原样抛出；端口实现异常包装为保留 cause 的操作错误。
     *
     * @param {object} sourceDefinition Repository 载入并隔离的 SourceDefinition。
     * @returns {Promise<object>} 标准 Provider 就绪结果。
     * @throws {SourceManagerValidationError} 当端口返回结构不符合就绪结果契约时抛出。
     * @throws {SourceManagerOperationError} 当端口实现执行失败时抛出并保留 cause。
     */
    async evaluate(sourceDefinition) {
      try {
        // 类型: object。
        // 作用: 保存端口原始结果，只有通过严格组合校验后才能进入 SourceManagerState。
        const result = await validatedPort.evaluate(sourceDefinition);

        // 返回值类型: object。
        // 作用: 返回隔离就绪结果，不暴露端口内部工厂、注册表或可变对象。
        return validateSourceProviderReadinessResult(result);
      } catch (error) {
        // 条件分支: 当前异常已经是标准结果校验错误时进入。
        // 执行内容: 保留 validation code，让构造或测试调用方定位端口契约问题。
        if (error instanceof SourceManagerValidationError) {
          throw error;
        }

        // 错误类型: SourceManagerOperationError。
        // 作用: 包装注册表查询或工厂 supports 异常并保留真实 cause。
        throw new SourceManagerOperationError('Provider 就绪评估失败', error);
      }
    }
  });
}

/**
 * 创建冻结健康检测端口门面。
 * 副作用: 调用注入端口的 check；不修改 SourceManagerState。
 *
 * @param {object} port 注入健康检测端口。
 * @returns {object} 只暴露异步 check 的冻结门面。
 */
export function createSourceHealthCheckPort(port) {
  // 类型: object。
  // 作用: 保存已经通过唯一 check 方法校验的原端口，门面调用不会接触附加能力。
  const validatedPort = validateSingleMethodPort(port, 'check', 'sourceHealthCheckPort');

  return Object.freeze({
    /**
     * 调用健康检测端口并校验标准结果。
     * 副作用: 调用外部注入端口的异步 check；不修改 SourceManagerState 或 Repository。
     * 成功路径: 返回字段完整、组合一致且引用隔离的健康结果。
     * 失败路径: 契约校验错误原样抛出；端口实现异常包装为保留 cause 的操作错误。
     *
     * @param {object} sourceRecord SourceManager 提供的隔离轻量数据源记录。
     * @returns {Promise<object>} 标准健康检测结果。
     * @throws {SourceManagerValidationError} 当端口返回结构不符合健康结果契约时抛出。
     * @throws {SourceManagerOperationError} 当端口实现执行失败时抛出并保留 cause。
     */
    async check(sourceRecord) {
      try {
        // 类型: object。
        // 作用: 保存外部端口返回的原始健康结果，后续必须通过标准结果校验才能向上返回。
        const result = await validatedPort.check(sourceRecord);

        // 返回值类型: object。
        // 作用: 返回引用隔离的健康结果，SourceManager 可以据此收敛当前会话运行态。
        return validateSourceHealthCheckResult(result);
      } catch (error) {
        // 条件分支: 当前异常已经是标准结果校验错误时进入。
        // 执行内容: 保留稳定 validation code，不重复包装成 operation 错误。
        if (error instanceof SourceManagerValidationError) {
          throw error;
        }

        // 错误类型: SourceManagerOperationError。
        // 作用: 包装端口实现异常并保留 cause，供 SourceManager 和测试追踪真实失败来源。
        throw new SourceManagerOperationError('数据源健康检测端口执行失败', error);
      }
    }
  });
}

/**
 * 创建冻结更新检测端口门面。
 * 副作用: 调用注入端口的 check；不修改 SourceManagerState。
 *
 * @param {object} port 注入更新检测端口。
 * @returns {object} 只暴露异步 check 的冻结门面。
 */
export function createSourceUpdateCheckPort(port) {
  // 类型: object。
  // 作用: 保存已经通过唯一 check 方法校验的原端口，门面调用不会接触附加能力。
  const validatedPort = validateSingleMethodPort(port, 'check', 'sourceUpdateCheckPort');

  return Object.freeze({
    /**
     * 调用在线更新检测端口并校验标准结果。
     * 副作用: 调用外部注入端口的异步 check；不修改 SourceManagerState 或 Repository。
     * 成功路径: 返回字段完整、组合一致且引用隔离的更新结果。
     * 失败路径: 契约校验错误原样抛出；端口实现异常包装为保留 cause 的操作错误。
     *
     * @param {object} sourceRecord SourceManager 提供的隔离轻量数据源记录。
     * @returns {Promise<object>} 标准在线更新检测结果。
     * @throws {SourceManagerValidationError} 当端口返回结构不符合更新结果契约时抛出。
     * @throws {SourceManagerOperationError} 当端口实现执行失败时抛出并保留 cause。
     */
    async check(sourceRecord) {
      try {
        // 类型: object。
        // 作用: 保存外部端口返回的原始更新结果，后续必须通过标准结果校验才能向上返回。
        const result = await validatedPort.check(sourceRecord);

        // 返回值类型: object。
        // 作用: 返回引用隔离的更新结果，SourceManager 可以据此收敛当前会话更新状态。
        return validateSourceUpdateCheckResult(result);
      } catch (error) {
        // 条件分支: 当前异常已经是标准结果校验错误时进入。
        // 执行内容: 保留稳定 validation code，不重复包装成 operation 错误。
        if (error instanceof SourceManagerValidationError) {
          throw error;
        }

        // 错误类型: SourceManagerOperationError。
        // 作用: 包装端口实现异常并保留 cause，供 SourceManager 和测试追踪真实失败来源。
        throw new SourceManagerOperationError('数据源更新检测端口执行失败', error);
      }
    }
  });
}
