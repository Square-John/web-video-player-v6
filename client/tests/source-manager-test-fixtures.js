/*
  source-manager-test-fixtures.js 模块说明

  - 文件职责:
      为 SourceManager 初始化和后续事务测试创建隔离 Repository 种子、基础设施和 Manager 实例。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      HEALTH_STATUS、PROVIDER_READINESS_STATUS: 自定义配置，默认端口返回标准健康和 Provider 就绪状态。
      mockSourceRepositorySeeds: 自定义测试数据，九条默认分离种子。
      createMemorySourceRepositories: 自定义工厂，Memory Repository 基础设施。
      cloneSerializableValue: 自定义工具，按严格 JSON Value 规则隔离复制测试种子。
      assertPlainObject: 自定义校验，测试端口覆盖只接受普通对象。
      SourceManager: 自定义服务，被测领域入口。

  - 模块级常量:
      SOURCE_MANAGER_TEST_CHECKED_AT: string，默认端口固定检测完成时间。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDefaultHealthCheckPort: Function，创建标准健康成功端口。
      createDefaultProviderReadinessPort: Function，为普通 Manager 测试创建始终 ready 的隔离端口。
      createDefaultUpdateCheckPort: Function，创建标准无更新端口。

  - 模块级类:
      无

  - 对外导出:
      createSourceManagerTestEnvironment: Function，隔离测试环境工厂。
*/

// 导入来源: ../src/config/source-manager.config.js。
// 导入内容: HEALTH_STATUS 与 PROVIDER_READINESS_STATUS 状态枚举。
// 文件作用: 默认测试端口使用受控状态值，不在夹具散落领域字符串。
import {
  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 健康状态枚举。
  // 文件作用: 默认健康端口使用稳定 normal 值。
  HEALTH_STATUS,
  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_STATUS Provider 就绪状态枚举。
  // 文件作用: 默认就绪端口让非就绪专项之外的领域测试保持明确 ready 前置条件。
  PROVIDER_READINESS_STATUS
} from '../src/config/source-manager.config.js';

// 导入来源: ./source-repository-test-fixtures.js。
// 导入内容: mockSourceRepositorySeeds 默认测试 Repository 分离种子。
// 文件作用: 为 SourceManager 测试保留九条 Mock 场景，不依赖四条真实产品种子。
import { mockSourceRepositorySeeds } from './source-repository-test-fixtures.js';

// 导入来源: ../src/repositories/source/createMemorySourceRepositories.js。
// 导入内容: createMemorySourceRepositories Memory Repository 组合工厂。
// 文件作用: 根据隔离种子创建三个 Repository 和共享 Unit of Work。
import { createMemorySourceRepositories } from '../src/repositories/source/createMemorySourceRepositories.js';

// 导入来源: ../src/repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
// 文件作用: 克隆默认种子时拒绝有损或危险值，避免 JSON stringify 静默改变测试输入。
import { cloneSerializableValue } from '../src/repositories/source/sourceRepositoryUtils.js';

// 导入来源: ../src/repositories/source/sourceRepositoryValidators.js。
// 导入内容: assertPlainObject 严格普通对象校验函数。
// 文件作用: 端口覆盖容器拒绝数组、复杂实例和异常原型。
import { assertPlainObject } from '../src/repositories/source/sourceRepositoryValidators.js';

// 导入来源: ../src/services/sourceManagerService.js。
// 导入内容: SourceManager 数据源领域服务类。
// 文件作用: 使用隔离 Repository 基础设施创建当前初始化或事务测试的被测实例。
import { SourceManager } from '../src/services/sourceManagerService.js';

// 类型: string。
// 作用: 默认测试端口使用固定 UTC ISO 时间，避免领域测试依赖系统时钟。
const SOURCE_MANAGER_TEST_CHECKED_AT = '2026-07-15T00:00:00.000Z';

/**
 * 创建默认 Provider 就绪评估端口。
 * 纯函数: 每次返回新的普通端口对象，不共享注册表、工厂或可变调用状态。
 * 适用边界: 普通 SourceManager 领域测试显式假设所有种子均有可执行 Provider；未就绪专项通过依赖覆盖提供场景。
 *
 * @returns {object} 只包含异步 evaluate 的 Provider 就绪端口。
 */
function createDefaultProviderReadinessPort() {
  // 返回值类型: object。
  // 作用: 提供不泄漏 Runtime 基础设施的标准就绪结果端口。
  return {
    /**
     * 返回标准 Provider 就绪结果。
     * 纯函数: 不读取 Definition 内容或外部注册表，每次返回同一字段结构的新对象。
     * 成功路径: resolve ready 和空原因字段。
     * 失败路径: 默认端口不主动 reject；未注册、不支持或端口失败由专项覆盖提供。
     *
     * @returns {Promise<object>} 标准 Provider 就绪结果。
     */
    async evaluate() {
      return {
        // 类型: string；作用: 表示普通领域测试中的 Definition 具备可执行 Provider。
        status: PROVIDER_READINESS_STATUS.ready,
        // 类型: string；作用: ready 结果按契约不携带原因码。
        reasonCode: '',
        // 类型: string；作用: ready 结果按契约不携带用户原因。
        reason: ''
      };
    }
  };
}

/**
 * 创建默认健康检测端口。
 * 纯函数: 每次返回新的普通端口对象，不共享调用计数或可变状态。
 *
 * @returns {object} 只包含异步 check 的健康端口。
 */
function createDefaultHealthCheckPort() {
  // 返回值类型: object。
  // 作用: 返回固定 normal 结果端口，初始化测试不会依赖网络或 mock 场景。
  return {
    /**
     * 返回标准健康成功结果。
     * 纯函数: 不读取输入记录或外部状态，每次返回同一字段结构的新对象。
     * 成功路径: resolve normal、固定检查时间和空不可用原因。
     * 失败路径: 默认测试端口不主动 reject；失败场景由测试覆盖端口提供。
     *
     * @returns {Promise<object>} 标准健康检测结果。
     * @returns {string} return.healthStatus normal 表示默认模拟检测成功。
     * @returns {string} return.checkedAt 固定标准 UTC ISO 检查时间。
     * @returns {string} return.unavailableReason 正常结果使用空字符串。
     */
    async check() {
      // 返回值类型: object。
      // 作用: 返回符合 SourceHealthCheckPort 契约的固定正常结果。
      return {
        // 类型: string。
        // 作用: 表示默认健康检测成功，不触发不可用收敛。
        healthStatus: HEALTH_STATUS.normal,
        // 类型: string。
        // 作用: 提供固定检测完成时间，避免测试结果受系统时间影响。
        checkedAt: SOURCE_MANAGER_TEST_CHECKED_AT,
        // 类型: string。
        // 作用: 正常健康结果不携带不可用原因。
        unavailableReason: ''
      };
    }
  };
}

/**
 * 创建默认在线更新检测端口。
 * 纯函数: 每次返回新的普通端口对象，不共享调用计数或可变状态。
 *
 * @returns {object} 只包含异步 check 的无更新端口。
 */
function createDefaultUpdateCheckPort() {
  // 返回值类型: object。
  // 作用: 返回固定无更新结果端口，初始化测试不会依赖远程地址或 mock 场景。
  return {
    /**
     * 返回标准无更新结果。
     * 纯函数: 不读取输入记录或外部状态，每次返回同一字段结构的新对象。
     * 成功路径: resolve updateAvailable false、空版本字段和固定检查时间。
     * 失败路径: 默认测试端口不主动 reject；失败场景由测试覆盖端口提供。
     *
     * @returns {Promise<object>} 标准在线更新检测结果。
     * @returns {boolean} return.updateAvailable false 表示默认没有可用更新。
     * @returns {string} return.availableVersion 没有更新时为空字符串。
     * @returns {string} return.availableVersionUpdatedAt 没有更新时为空字符串。
     * @returns {string} return.checkedAt 固定标准 UTC ISO 检查时间。
     */
    async check() {
      // 返回值类型: object。
      // 作用: 返回符合 SourceUpdateCheckPort 契约的固定无更新结果。
      return {
        // 类型: boolean。
        // 作用: false 表示默认没有可用更新；true 场景由测试覆盖端口提供。
        updateAvailable: false,
        // 类型: string。
        // 作用: 没有更新时不提供可用版本号。
        availableVersion: '',
        // 类型: string。
        // 作用: 没有更新时不提供在线版本更新时间。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 提供固定检测完成时间，避免测试结果受系统时间影响。
        checkedAt: SOURCE_MANAGER_TEST_CHECKED_AT
      };
    }
  };
}

/**
 * 创建隔离 SourceManager 测试环境。
 * 副作用: 只在内存中创建 Repository 和 Manager，不修改默认种子。
 *
 * @param {Function|null} mutateSeeds 可选种子变更回调，在 Repository 构造前制造跨对象场景。
 * @param {object} mutateSeeds.seeds 当前测试专属的隔离种子；回调可以修改它制造失败场景。
 * @param {object} managerOptions 可选初始会话运行态。
 * @param {object} managerOptions.initialRuntimeStates 按 sourceId 提供的健康和更新会话状态。
 * @param {string} managerOptions.activeSourceId 可选活动源 id，用于初始化活动源有效性测试。
 * @param {object} managerDependencyOverrides 可选检测端口覆盖。
 * @param {object} managerDependencyOverrides.providerReadinessPort 可控 Provider 就绪端口；未提供时所有记录返回 ready。
 * @param {object} managerDependencyOverrides.healthCheckPort 可控健康端口；未提供时使用固定 normal 端口。
 * @param {object} managerDependencyOverrides.updateCheckPort 可控更新端口；未提供时使用固定无更新端口。
 * @returns {object} 隔离种子、Repository 基础设施和 SourceManager。
 * @returns {object} return.seeds 当前测试专属种子，供断言默认源和对象关联使用。
 * @returns {object} return.repositories 三个 Memory Repository 和 Unit of Work。
 * @returns {object} return.dependencies 传给 SourceManager 的完整基础设施和检测端口。
 * @returns {SourceManager} return.sourceManager 使用当前隔离基础设施创建的被测实例。
 * @throws {SourceRepositoryValidationError} 当默认种子或回调修改结果违反严格 Repository 契约时抛出。
 * @throws {SourceManagerValidationError} 当 Manager 依赖或会话选项不符合契约时抛出。
 */
export function createSourceManagerTestEnvironment(
  mutateSeeds = null,
  managerOptions = {},
  managerDependencyOverrides = {}
) {
  // 类型: object。
  // 作用: 按 Repository 严格 JSON 规则复制默认种子，确保当前测试修改不会污染其他测试。
  const seeds = cloneSerializableValue(mockSourceRepositorySeeds, 'sourceManagerTestSeeds');

  // 条件分支: 调用方提供了种子场景变更回调时进入。
  // 执行内容: 只修改当前隔离种子，在 Repository 校验前制造缺包、失配或授权失效场景。
  if (typeof mutateSeeds === 'function') {
    mutateSeeds(seeds);
  }

  // 类型: object。
  // 作用: 根据当前场景种子创建互相绑定的 Package、Definition、Storage Repository 和 Unit of Work。
  const repositories = createMemorySourceRepositories(seeds);

  // 执行内容: 端口覆盖容器只接受普通对象，非法测试输入不能被静默忽略。
  assertPlainObject(managerDependencyOverrides, 'managerDependencyOverrides');

  // 类型: Array<string|symbol>。
  // 作用: 读取测试依赖覆盖全部字段，阻止拼写错误或未知覆盖被静默忽略。
  const overrideFields = Reflect.ownKeys(managerDependencyOverrides);

  // 条件分支: 覆盖容器包含健康和更新端口之外的字段时进入。
  // 执行内容: 抛出测试环境配置错误，避免测试误以为未知覆盖已经生效。
  if (overrideFields.some(
    field => !['providerReadinessPort', 'healthCheckPort', 'updateCheckPort'].includes(field)
  )) {
    throw new TypeError('managerDependencyOverrides 只允许 providerReadinessPort、healthCheckPort 和 updateCheckPort');
  }

  // 类型: object。
  // 作用: 合并四个 Repository 基础设施、Provider 就绪端口和两个检测端口，SourceManager 不读取 mock 场景文件。
  const dependencies = {
    ...repositories,
    providerReadinessPort: Object.hasOwn(managerDependencyOverrides, 'providerReadinessPort')
      ? managerDependencyOverrides.providerReadinessPort
      : createDefaultProviderReadinessPort(),
    healthCheckPort: Object.hasOwn(managerDependencyOverrides, 'healthCheckPort')
      ? managerDependencyOverrides.healthCheckPort
      : createDefaultHealthCheckPort(),
    updateCheckPort: Object.hasOwn(managerDependencyOverrides, 'updateCheckPort')
      ? managerDependencyOverrides.updateCheckPort
      : createDefaultUpdateCheckPort()
  };

  // 类型: SourceManager。
  // 作用: 创建只依赖当前隔离 Repository 和显式会话选项的被测领域实例。
  const sourceManager = new SourceManager(dependencies, managerOptions);

  // 返回值类型: object。
  // 作用: 同时暴露输入、基础设施和被测对象，支持测试验证投影与 Repository 真实状态的一致性。
  return { seeds, repositories, dependencies, sourceManager };
}
