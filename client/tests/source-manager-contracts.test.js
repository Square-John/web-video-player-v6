/*
  source-manager-contracts.test.js 模块说明

  - 文件职责:
      使用 Node 内置测试验证 SourceManager 4A 枚举、指纹授权核心、错误、检测端口和默认源交接契约。

  - 导入库及文件汇总(7 条，内置 2 条，第三方 0 条，自定义 5 条):
      assert、test: 内置测试能力。
      config、authorization、commands、errors、ports: 自定义 4A 被测能力。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言对象。
// 文件作用: 比较枚举、授权结果、命令结果和端口错误。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 声明构建前执行的 4A 契约测试。
import test from 'node:test';

// 导入来源: ../src/config/source-manager.config.js。
// 导入内容: 授权、来源、Provider 运行与就绪、切换和默认源交接枚举。
// 文件作用: 构造授权输入并断言 4A 新增枚举值和冻结状态。
import {
  AUTHORIZATION_STATUS,
  DEFAULT_SOURCE_HANDOFF_MODE,
  PROVIDER_READINESS_REASON_CODE,
  PROVIDER_READINESS_STATUS,
  PROVIDER_RUNTIME_STATUS,
  SOURCE_KIND,
  SOURCE_SWITCH_STATUS
} from '../src/config/source-manager.config.js';

// 导入来源: ../src/utils/sourceAuthorization.js。
// 导入内容: 旧文本授权入口、新指纹核心、指纹函数和两种评估入口。
// 文件作用: 证明旧页面和未来 SourceManager 共用同一授权算法。
import {
  createSourceAuthorizationState,
  createSourceAuthorizationStateFromFingerprint,
  createSourceScriptHash,
  evaluateSourceAuthorization,
  evaluateSourceAuthorizationFingerprint
} from '../src/utils/sourceAuthorization.js';

// 导入来源: ../src/services/source-manager/sourceManagerCommands.js。
// 导入内容: 严格 Boolean、默认源交接和 sourceId 集合校验函数。
// 文件作用: 验证公共命令进入事务前已经收敛为明确安全输入。
import {
  assertSourceManagerBoolean,
  normalizeDefaultSourceHandoff,
  normalizeSourceIds
} from '../src/services/source-manager/sourceManagerCommands.js';

// 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
// 导入内容: 稳定错误码、操作错误和校验错误。
// 文件作用: 验证命令与端口失败不依赖中文文案判断。
import {
  SOURCE_MANAGER_ERROR_CODE,
  SourceManagerOperationError,
  SourceManagerValidationError
} from '../src/services/source-manager/sourceManagerErrors.js';

// 导入来源: ../src/services/source-manager/sourceManagerPorts.js。
// 导入内容: Provider 就绪、健康检测和更新检测端口门面工厂。
// 文件作用: 验证端口标准结果采用、结构拒绝和 cause 保留。
import {
  createSourceHealthCheckPort,
  createSourceProviderReadinessPort,
  createSourceUpdateCheckPort
} from '../src/services/source-manager/sourceManagerPorts.js';

// 测试目的: 新指纹入口与旧脚本文本入口必须生成和评估同一授权结果。
test('授权文本入口与指纹核心保持一致', () => {
  // 类型: object。
  // 作用: 提供旧页面文本入口和新指纹入口共同使用的自定义源定义。
  const definition = { sourceKind: SOURCE_KIND.custom, version: 'v1.0.0', scriptContent: 'export default {};' };

  // 类型: string。
  // 作用: 模拟 Repository 已经验证并提供给 SourceManager 的当前脚本指纹。
  const currentScriptHash = createSourceScriptHash(definition.scriptContent);

  // 类型: object。
  // 作用: 提供固定授权意图和时间，避免测试依赖系统时间。
  const input = { status: AUTHORIZATION_STATUS.authorized, authorizedAt: '2026-07-15T00:00:00.000Z' };

  // 类型: object。
  // 作用: 通过现有 scriptContent 兼容入口创建授权快照。
  const legacyAuthorization = createSourceAuthorizationState(definition, input);

  // 类型: object。
  // 作用: 通过 SourceManager 指纹核心创建授权快照。
  const fingerprintAuthorization = createSourceAuthorizationStateFromFingerprint({ version: definition.version, currentScriptHash }, input);
  assert.deepEqual(fingerprintAuthorization, legacyAuthorization);
  assert.deepEqual(evaluateSourceAuthorizationFingerprint({ sourceKind: definition.sourceKind, version: definition.version, currentScriptHash, authorization: fingerprintAuthorization }), evaluateSourceAuthorization({ definition, authorization: legacyAuthorization }));
});

// 测试目的: 运行、切换和交接枚举必须提供契约冻结的全部稳定值。
test('SourceManager 枚举完整且被冻结', () => {
  assert.deepEqual(Object.values(PROVIDER_RUNTIME_STATUS), ['stopped', 'starting', 'running', 'stopping', 'failed']);
  assert.deepEqual(Object.values(PROVIDER_READINESS_STATUS), ['ready', 'unavailable']);
  assert.deepEqual(Object.values(PROVIDER_READINESS_REASON_CODE), ['', 'provider-not-registered', 'definition-not-supported']);
  assert.deepEqual(Object.values(SOURCE_SWITCH_STATUS), ['idle', 'switching', 'success', 'failed']);
  assert.deepEqual(Object.values(DEFAULT_SOURCE_HANDOFF_MODE), ['replace', 'clear']);
  assert.equal(Object.isFrozen(PROVIDER_RUNTIME_STATUS), true);
  assert.equal(Object.isFrozen(PROVIDER_READINESS_STATUS), true);
});

// 测试目的: Provider 就绪端口只采用严格二态结果，并拒绝 ready 携带原因或 unavailable 缺失原因。
test('Provider 就绪端口严格校验状态与原因组合', async () => {
  // 类型: object。
  // 作用: 返回标准未注册结果，证明门面采用并隔离稳定原因字段。
  const unavailablePort = createSourceProviderReadinessPort({
    /**
     * 返回固定未注册结果。
     * 纯函数: 不读取输入 Definition 或外部状态，每次返回同一字段结构的新对象。
     * 成功路径: resolve unavailable、稳定原因码和用户说明。
     * 失败路径: 当前测试实现不主动 reject。
     *
     * @returns {Promise<object>} 标准 Provider 未就绪结果。
     */
    async evaluate() {
      return {
        // 类型: string；作用: 表示当前 Runtime 没有注册目标 Provider。
        status: PROVIDER_READINESS_STATUS.unavailable,
        // 类型: string；作用: 使用稳定原因码供程序断言，不解析用户文案。
        reasonCode: PROVIDER_READINESS_REASON_CODE.providerNotRegistered,
        // 类型: string；作用: 提供设置页可直接展示的稳定原因。
        reason: '当前数据源脚本尚未接入可执行 Provider。'
      };
    }
  });
  assert.deepEqual(await unavailablePort.evaluate({ id: 'source-a' }), {
    status: PROVIDER_READINESS_STATUS.unavailable,
    reasonCode: PROVIDER_READINESS_REASON_CODE.providerNotRegistered,
    reason: '当前数据源脚本尚未接入可执行 Provider。'
  });

  // 类型: object。
  // 作用: 制造违反 ready 空原因组合的端口，验证门面在结果进入 Manager 前失败关闭。
  const invalidReadyPort = createSourceProviderReadinessPort({
    /**
     * 返回字段类型合法但组合非法的 ready 结果。
     * 纯函数: 不读取或修改外部状态。
     * 成功路径: 当前测试实现不会产生可采用结果。
     * 失败路径: 门面校验拒绝 ready 携带未注册原因。
     *
     * @returns {Promise<object>} 供严格组合校验拒绝的候选结果。
     */
    async evaluate() {
      return {
        status: PROVIDER_READINESS_STATUS.ready,
        reasonCode: PROVIDER_READINESS_REASON_CODE.providerNotRegistered,
        reason: '不应存在的原因'
      };
    }
  });
  await assert.rejects(
    invalidReadyPort.evaluate({ id: 'source-a' }),
    SourceManagerValidationError
  );
});

// 测试目的: 命令边界拒绝模糊 Boolean、危险键和不明确默认源交接。
test('命令校验返回隔离标准输入并拒绝模糊值', () => {
  assert.equal(assertSourceManagerBoolean(false, 'enabled'), false);
  assert.throws(() => assertSourceManagerBoolean(0, 'enabled'), SourceManagerValidationError);
  assert.deepEqual(normalizeSourceIds(['source-a', 'source-a', 'source-b']), ['source-a', 'source-b']);
  assert.throws(() => normalizeSourceIds(['__proto__']), SourceManagerValidationError);
  assert.deepEqual(normalizeDefaultSourceHandoff({ mode: 'clear' }), { mode: 'clear' });
  assert.deepEqual(normalizeDefaultSourceHandoff({ mode: 'replace', sourceId: 'source-b' }), { mode: 'replace', sourceId: 'source-b' });
  assert.throws(() => normalizeDefaultSourceHandoff({ mode: 'clear', sourceId: 'source-b' }), SourceManagerValidationError);
});

// 测试目的: 健康和更新端口只采用标准结果，并把实现异常包装为 operation 错误。
test('检测端口校验结果并保留原始失败 cause', async () => {
  // 类型: object。
  // 作用: 返回标准 normal 结果，验证健康端口门面采用并隔离合法输出。
  const healthPort = createSourceHealthCheckPort({
    /**
     * 返回固定健康检测成功结果。
     * 纯函数: 不读取或修改外部状态，每次返回同一字段结构的新对象。
     * 成功路径: resolve 标准 normal 健康结果。
     * 失败路径: 当前测试实现不主动 reject。
     *
     * @returns {Promise<object>} 固定健康检测结果。
     * @returns {string} return.healthStatus normal 表示当前模拟源可用。
     * @returns {string} return.checkedAt 固定检测完成时间。
     * @returns {string} return.unavailableReason 正常结果使用空字符串。
     */
    async check() {
      return {
        // 类型: string。
        // 作用: 表示当前模拟健康检查成功，供端口结果枚举校验。
        healthStatus: 'normal',
        // 类型: string。
        // 作用: 提供固定标准 UTC ISO 时间，避免测试依赖系统时钟。
        checkedAt: '2026-07-15T00:00:00.000Z',
        // 类型: string。
        // 作用: 正常健康结果不携带不可用原因。
        unavailableReason: ''
      };
    }
  });

  // 类型: object。
  // 作用: 返回无更新标准结果，验证 false 状态要求版本字段保持为空。
  const updatePort = createSourceUpdateCheckPort({
    /**
     * 返回固定无更新检测结果。
     * 纯函数: 不读取或修改外部状态，每次返回同一字段结构的新对象。
     * 成功路径: resolve updateAvailable 为 false 的标准结果。
     * 失败路径: 当前测试实现不主动 reject。
     *
     * @returns {Promise<object>} 固定在线更新检测结果。
     * @returns {boolean} return.updateAvailable false 表示当前没有可用更新。
     * @returns {string} return.availableVersion 没有更新时为空字符串。
     * @returns {string} return.availableVersionUpdatedAt 没有更新时为空字符串。
     * @returns {string} return.checkedAt 固定检测完成时间。
     */
    async check() {
      return {
        // 类型: boolean。
        // 作用: false 表示没有可用更新，要求两个版本字段同时为空。
        updateAvailable: false,
        // 类型: string。
        // 作用: 没有可用更新时不提供在线版本号。
        availableVersion: '',
        // 类型: string。
        // 作用: 没有可用更新时不提供在线版本更新时间。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 提供固定标准 UTC ISO 时间，避免测试依赖系统时钟。
        checkedAt: '2026-07-15T00:00:00.000Z'
      };
    }
  });
  assert.equal((await healthPort.check({})).healthStatus, 'normal');
  assert.equal((await updatePort.check({})).updateAvailable, false);
  // 类型: Error。
  // 作用: 作为端口实现失败的原始异常，验证 operation 错误保留同一 cause。
  const cause = new Error('port failed');

  // 类型: object。
  // 作用: 模拟健康检测实现失败，门面应转换为 SourceManagerOperationError。
  const failedPort = createSourceHealthCheckPort({
    /**
     * 抛出固定端口实现异常。
     * 副作用: 抛出测试作用域中的 cause；不修改外部状态。
     * 成功路径: 当前测试实现不会 resolve。
     * 失败路径: 始终 reject 固定 cause，验证门面包装后仍保留同一引用。
     *
     * @returns {Promise<never>} 当前实现始终失败，不返回健康结果。
     * @throws {Error} 始终抛出测试预先创建的 cause。
     */
    async check() {
      throw cause;
    }
  });
  await assert.rejects(failedPort.check({}), error => error instanceof SourceManagerOperationError && error.code === SOURCE_MANAGER_ERROR_CODE.operation && error.cause === cause);
});
