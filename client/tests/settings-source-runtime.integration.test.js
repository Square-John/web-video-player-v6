/*
  settings-source-runtime.integration.test.js 模块说明

  - 文件职责:
      验证输入适配、模拟更新端口、完整设置管理门面、动态工厂注册和 Host/Manager 失败补偿。
      验证 settingsStore 完整投影采用、settingsService 单例委托和 main.js 初始化顺序。
      使用真实 Runtime Bundle 证明当前内置源全部就绪，使用可控依赖证明未注册 Provider、导入及生命周期顺序。
      本文件由 npm run build 内部 test:source-domain 自动执行，不访问真实网络或 DOM；应用单例使用隔离 fake-indexeddb。

  - 导入库及文件汇总(16 条，内置 3 条，第三方 1 条，自定义 12 条):
      assert: 内置模块，执行严格相等、深相等和异步拒绝断言。
      readFileSync: 内置模块，读取 main、store 和 service 源码以验证静态依赖与启动顺序。
      test: 内置模块，注册 Node 测试用例。
      fake-indexeddb/auto: 第三方测试环境，为应用正式 IndexedDB 单例提供 Node 实现。
      createSourceRuntimeBundle: 自定义 Runtime，验证真实 Bundle 管理链。
      createSourceManagementInputAdapter: 自定义适配器，验证确定性导入命令。
      createMockSourceUpdatePort: 自定义端口，验证检测与候选隔离。
      createSourceManagementRuntime: 自定义管理层，验证可控 FIFO 和补偿。
      SourceManagementOperationError: 自定义错误，断言补偿后主操作失败分类。
      sourceManagementRuntimeInstance: 自定义应用单例，验证 store 与 service 共用同一 Runtime。
      settingsStore: 自定义响应式 store，验证空投影、完整替换和初始化状态。
      settingsService 查询与默认源操作: 自定义页面适配层，验证同步投影读取和异步 Runtime 委托。
      PROVIDER_READINESS_REASON_CODE、PROVIDER_READINESS_STATUS: 自定义配置，构造可控记录并断言真实 Bundle 就绪投影。
      createMockSourceRuntimeOptions: 自定义测试工厂，为真实 Bundle 显式注入独立 MockNetworkAdapter。
      createSourceScriptHash: 自定义授权工具，为适配器制品生成真实 SHA-256。
      sourceRepositorySeeds: 自定义产品种子，提供当前内置目录数量事实。

  - 模块级常量:
      MANAGEMENT_PUBLIC_METHODS: Array<string>，管理门面公开方法顺序。
      REMOTE_SOURCE_ID: string，存在模拟更新候选的真实源 id。
      LATEST_SOURCE_ID: string，没有模拟更新候选的真实源 id。
      TRUSTED_PROVIDER_KEY: string，可控 Host 认为可执行的工厂键。
      UNREGISTERED_PROVIDER_KEY: string，当前可控 Registry 没有工厂的独立身份。
      SOURCE_MANAGER_STATE_FIELDS: Array<string>，store 允许采用的完整投影顶层字段。
      BUILTIN_SOURCE_COUNT: number，当前产品种子中的内置源数量。

  - 模块级变量:
      无

  - 模块级辅助函数:
      clone(value): 创建测试断言使用的 JSON 隔离副本。
      installNodeBlobModuleLoader(): 为应用默认 Blob 执行器安装可恢复的 Node 测试 URL 适配。
      createRecord(options): 创建管理 Runtime 可消费的最小 SourceRecord。
      createState(records, defaultSourceId): 创建最小 SourceManagerState。
      createDynamicImportRequest(enableAfterImport): 创建可控加载器正式导入请求。
      createManagementHarness(options): 创建可控 Manager、Host、端口和完整管理门面。

  - 模块级类:
      无

  - 对外导出:
      无
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言集合。
// 文件作用: 验证对象结构、调用顺序、引用隔离和稳定错误。
import assert from 'node:assert/strict';

// 导入来源: node:fs。
// 导入内容: readFileSync 同步文件读取函数。
// 文件作用: 读取应用入口、store 和 service 源码，验证旧 mock 依赖消失及初始化顺序固定。
import { readFileSync } from 'node:fs';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册真实 Bundle、动态导入和可控补偿测试。
import test from 'node:test';

// 导入来源: fake-indexeddb/auto；导入内容: Node IndexedDB 全局实现；文件作用: 应用单例测试使用正式持久化启动链而不回退 Memory。
import 'fake-indexeddb/auto';

// 导入来源: ../src/config/source-manager.config.js。
// 导入内容: PROVIDER_READINESS_REASON_CODE 与 PROVIDER_READINESS_STATUS 枚举。
// 文件作用: 可控记录和真实 Bundle 断言使用同一 Provider 就绪契约值。
import {
  PROVIDER_READINESS_REASON_CODE,
  PROVIDER_READINESS_STATUS
} from '../src/config/source-manager.config.js';

// 导入来源: ../src/runtime/createSourceRuntime.js。
// 导入内容: createSourceRuntimeBundle 唯一组合工厂。
// 文件作用: 验证真实 Repository、Manager、更新端口和管理 Runtime 共享同一基础设施图。
import { createSourceRuntimeBundle } from '../src/runtime/createSourceRuntime.js';

// 导入来源: ./source-runtime-test-fixtures.js。
// 导入内容: createMockSourceRuntimeOptions 显式 Mock Runtime 选项工厂。
// 文件作用: 设置管理领域测试保持离线确定性，不依赖应用默认 ProxyClient 或后端服务。
import { createMockSourceRuntimeOptions } from './source-runtime-test-fixtures.js';

// 导入来源: ../src/utils/sourceAuthorization.js。
// 导入内容: createSourceScriptHash 数据源脚本 SHA-256 函数。
// 文件作用: 输入适配器测试使用真实规范化脚本文本和摘要关系。
import { createSourceScriptHash } from '../src/utils/sourceAuthorization.js';

// 导入来源: ../src/data/settings/source-repository.seed.js。
// 导入内容: sourceRepositorySeeds 当前内置源完整保存图。
// 文件作用: 默认源集成测试从产品事实取得数量，不保留随目录变化失效的固定数字。
import { sourceRepositorySeeds } from '../src/data/settings/source-repository.seed.js';

// 导入来源: ../src/runtime/source-management/sourceManagementInputAdapter.js。
// 导入内容: createSourceManagementInputAdapter 纯适配器工厂。
// 文件作用: 独立验证稳定 sourceId、远程空脚本和更新身份门禁。
import { createSourceManagementInputAdapter } from '../src/runtime/source-management/sourceManagementInputAdapter.js';

// 导入来源: ../src/runtime/source-management/mockSourceUpdatePort.js。
// 导入内容: createMockSourceUpdatePort 只读模拟更新端口工厂。
// 文件作用: 验证检查结果、候选读取、未命中和跨次副本隔离。
import { createMockSourceUpdatePort } from '../src/runtime/source-management/mockSourceUpdatePort.js';

// 导入来源: ../src/runtime/source-management/sourceManagementRuntime.js。
// 导入内容: createSourceManagementRuntime 管理门面工厂。
// 文件作用: 使用可控依赖验证 FIFO、dispose、Manager 事务和恢复顺序。
import { createSourceManagementRuntime } from '../src/runtime/source-management/sourceManagementRuntime.js';

// 导入来源: ../src/runtime/source-management/sourceManagementErrors.js。
// 导入内容: SourceManagementOperationError 管理主操作错误。
// 文件作用: 断言 Host 或 Manager 失败经过补偿后仍保留稳定错误类型。
import { SourceManagementOperationError } from '../src/runtime/source-management/sourceManagementErrors.js';

// 导入来源: ../src/runtime/sourceRuntimeInstance.js。
// 导入内容: sourceManagementRuntimeInstance 应用唯一管理 Runtime。
// 文件作用: 验证 store 订阅和 settingsService 操作共享同一 Bundle 与状态发布源。
import { sourceManagementRuntimeInstance } from '../src/runtime/sourceRuntimeInstance.js';

// 导入来源: ../src/store/settingsStore.js。
// 导入内容: settingsStore 响应式投影与初始化状态门面。
// 文件作用: 验证 store 不再从旧 mock 建立保存权威，并只采用完整投影。
import { settingsStore } from '../src/store/settingsStore.js';

import {
  // 导入来源: ../src/services/settingsService.js。
  // 导入内容: getSourceManagerState 同步投影查询。
  // 文件作用: 证明 service 读取 settingsStore 当前完整投影。
  getSourceManagerState,
  // 导入来源: ../src/services/settingsService.js。
  // 导入内容: getSourceSummary 设置页摘要查询。
  // 文件作用: 验证用户启用数量和真实可运行数量保持正交。
  getSourceSummary,
  // 导入来源: ../src/services/settingsService.js。
  // 导入内容: isSourceRecordRunnable 全局可运行资格函数。
  // 文件作用: 应用单例默认源测试选择真实可运行记录，不再只检查 enabled。
  isSourceRecordRunnable,
  // 导入来源: ../src/services/settingsService.js。
  // 导入内容: setDefaultSource 异步默认源操作。
  // 文件作用: 证明 service 委托应用唯一管理 Runtime 并由订阅刷新 store。
  setDefaultSource
} from '../src/services/settingsService.js';

// 类型: Array<string>。
// 作用: 固定管理门面十八方法顺序，防止内部 Manager、Host、加载器、端口或 FIFO 泄漏。
const MANAGEMENT_PUBLIC_METHODS = Object.freeze([
  'initialize',
  'subscribe',
  'getSourceManagerState',
  'setDefaultSource',
  'checkSource',
  'checkAllSources',
  'checkSourceUpdate',
  'setSourceEnabled',
  'authorizeSource',
  'revokeSourceAuthorization',
  'restoreSystemSources',
  'clearTemporarySourceCache',
  'clearAllSourceCache',
  'previewSourceImport',
  'importSource',
  'applySourceUpdate',
  'deleteSources',
  'createSourceExportBundle'
]);

// 类型: string。
// 作用: 指向正式模拟更新夹具中存在 v1.3.0 候选的远程源。
const REMOTE_SOURCE_ID = 'custom-online-demo';

// 类型: string。
// 作用: 指向正式模拟更新夹具中已是最新版本且没有候选的远程源。
const LATEST_SOURCE_ID = 'custom-online-latest';

// 类型: string。
// 作用: 可控工厂判断把该键视为可信可执行 Provider。
const TRUSTED_PROVIDER_KEY = 'trusted-provider';

// 类型: string。
// 作用: 标识当前可控 Registry 没有工厂的独立 Provider 身份，不与其他数据源共享占位键。
const UNREGISTERED_PROVIDER_KEY = 'source.test.unregistered.provider';

// 类型: Array<string>。
// 作用: 固定 store 完整投影顶层字段，防止局部补丁或旧 mock 状态重新进入页面投影。
const SOURCE_MANAGER_STATE_FIELDS = Object.freeze([
  'activeSourceId',
  'defaultSourceId',
  'removedSystemSourceIds',
  'checkingAll',
  'switchState',
  'records'
]);

// 类型: number；作用: 当前产品内置 Definition 数量，设置页投影与摘要必须和唯一种子事实一致。
const BUILTIN_SOURCE_COUNT = sourceRepositorySeeds.definitions.length;

/**
 * 创建严格 JSON 测试副本。
 * 纯函数: 返回新对象，不修改输入。
 *
 * @param {*} value JSON 值。
 * @returns {*} JSON 隔离副本。
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 为应用默认 Blob 模块执行器安装可恢复的 Node 测试 URL 适配。
 * 副作用: 临时替换 globalThis.Blob 与 URL.createObjectURL/revokeObjectURL；调用方必须在 finally 中 restore。
 * 成功路径: 默认执行器创建的同一脚本文本被编码成 data URL，并由 Node 原生 import 执行。
 * 失败路径: 属性描述符不可替换时同步抛错；不回退 eval、Function、源码文件或静态工厂。
 *
 * @returns {object} 只公开 restore 的测试资源控制器。
 */
function installNodeBlobModuleLoader() {
  // 类型: PropertyDescriptor|undefined；作用: 保存 Node 原 Blob 构造器，测试结束后精确恢复。
  const originalBlobDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Blob');
  // 类型: PropertyDescriptor|undefined；作用: 保存 Node 原对象 URL 创建方法描述符。
  const originalCreateObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  // 类型: PropertyDescriptor|undefined；作用: 保存 Node 原对象 URL 释放方法描述符。
  const originalRevokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  /**
   * 保存默认执行器传入的同一脚本文本。
   * 副作用: 只写当前测试 Blob 实例，不创建 URL 或执行脚本。
   *
   * @param {Array<*>} parts 默认执行器交给 Blob 的文本片段。
   * @returns {NodeSourceModuleBlob} 保存同一脚本文本的测试 Blob 实例。
   */
  function NodeSourceModuleBlob(parts) {
    // 类型: string；作用: 合并当前 Blob 的模块文本，供 createObjectURL 确定性编码。
    this.scriptContent = parts.join('');
  }

  /**
   * 把测试 Blob 中的同一脚本文本编码为 Node 可执行模块 URL。
   * 纯函数: 不缓存脚本或读取文件。
   *
   * @param {NodeSourceModuleBlob} moduleBlob 默认执行器创建的测试 Blob。
   * @returns {string} Node 原生 dynamic import 可执行的 data URL。
   */
  function createNodeModuleUrl(moduleBlob) {
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleBlob.scriptContent)}`;
  }

  /**
   * 模拟浏览器释放一次性对象 URL。
   * 副作用: 无；data URL 不占用浏览器对象 URL 注册表。
   *
   * @param {string} moduleUrl 默认执行器已经完成导入的 data URL。
   * @returns {void}
   */
  function revokeNodeModuleUrl(moduleUrl) {
    void moduleUrl;
  }

  // 副作用: 只在当前测试窗口替换三项能力，让产品默认执行器仍走 Blob -> URL -> import -> revoke 调用链。
  Object.defineProperty(globalThis, 'Blob', {
    configurable: true,
    writable: true,
    value: NodeSourceModuleBlob
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: createNodeModuleUrl
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revokeNodeModuleUrl
  });

  return Object.freeze({
    /**
     * 恢复 Node 原生 Blob 与对象 URL 属性。
     * 副作用: 结束当前测试的全局能力替换，防止影响后续用例。
     *
     * @returns {void}
     */
    restore() {
      // 恢复顺序: 先恢复 URL 方法，再恢复 Blob 构造器；所有 Provider 模块已完成动态导入。
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrlDescriptor);
      Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrlDescriptor);
      Object.defineProperty(globalThis, 'Blob', originalBlobDescriptor);
    }
  });
}

/**
 * 创建可控 SourceRecord。
 * 纯函数: 每次返回新记录，不共享 Definition、runtime 或 authorization 引用。
 *
 * @param {object} options 记录配置。
 * @param {string} options.id 统一 sourceId。
 * @param {string} options.providerKey Provider 工厂键。
 * @param {boolean} options.enabled true 表示保存态启用，false 表示关闭。
 * @param {string} options.sourceKind system 或 custom。
 * @param {string} options.importMethod builtin、remote、file 或 text。
 * @returns {object} 最小 SourceRecord。
 */
function createRecord({
  id,
  providerKey = TRUSTED_PROVIDER_KEY,
  enabled = true,
  sourceKind = 'system',
  importMethod = 'builtin'
}) {
  return {
    definition: {
      id,
      name: id,
      sourceKind,
      version: 'v1.0.0',
      providerKey,
      packageRef: `source-package::${id}`,
      importMethod,
      remoteUrl: importMethod === 'remote' ? `https://example.com/${id}.js` : '',
      importedAt: '2026-07-17T00:00:00.000Z'
    },
    packageRef: `source-package::${id}`,
    runtime: {
      enabled,
      currentScriptHash: '1'.repeat(64),
      providerReadiness: providerKey === TRUSTED_PROVIDER_KEY
        ? {
            status: PROVIDER_READINESS_STATUS.ready,
            reasonCode: PROVIDER_READINESS_REASON_CODE.none,
            reason: ''
          }
        : {
            status: PROVIDER_READINESS_STATUS.unavailable,
            reasonCode: PROVIDER_READINESS_REASON_CODE.providerNotRegistered,
            reason: '当前 ProviderFactory 尚未注册。'
          }
    },
    authorization: {
      status: sourceKind === 'custom' ? 'authorized' : 'authorized'
    }
  };
}

/**
 * 创建可控 SourceManagerState。
 * 纯函数: 返回新记录副本和完整管理顶层字段。
 *
 * @param {Array<object>} records SourceRecord 数组。
 * @param {string} defaultSourceId 当前默认源。
 * @returns {object} 最小 SourceManagerState。
 */
function createState(records, defaultSourceId = '') {
  return {
    activeSourceId: defaultSourceId,
    defaultSourceId,
    removedSystemSourceIds: [],
    checkingAll: false,
    records: clone(records),
    switchState: {
      status: 'idle',
      requestId: '',
      targetSourceId: '',
      errorCode: ''
    }
  };
}

/**
 * 创建可控加载器接受的动态 Provider 正式导入请求。
 * 纯函数: 每次返回新对象，不共享 input 或 trustDecision 引用。
 *
 * @param {boolean} enableAfterImport true 要求导入后启动，false 保持关闭。
 * @returns {object} 精确 input/trustDecision 请求。
 */
function createDynamicImportRequest(enableAfterImport) {
  return {
    input: {
      importMethod: 'text',
      remoteUrl: '',
      originalFileName: '',
      scriptContent: 'export const sourceManifest = Object.freeze({});'
    },
    trustDecision: {
      trustedScriptHash: '2'.repeat(64),
      enableAfterImport
    }
  };
}

/**
 * 创建可控设置管理 Runtime 测试环境。
 * 副作用: 只维护当前测试局部 state、hostStates 和 calls；不访问真实 Repository、Host 或网络。
 * 成功路径: 返回完整管理门面和可观察调用集合。
 * 失败注入: managerFailureMethods、disposeFailureSourceIds 和 ensureFailureSourceIds 精确控制失败位置。
 *
 * @param {object} options 测试环境配置。
 * @param {object} options.initialState 初始 SourceManagerState。
 * @param {Array<string>} options.runningSourceIds 初始真实 running Host 集合。
 * @param {Array<string>} options.managerFailureMethods 需要失败的 Manager 方法名。
 * @param {Array<string>} options.disposeFailureSourceIds dispose 失败目标。
 * @param {Array<string>} options.ensureFailureSourceIds ensure 失败目标。
 * @returns {object} runtime、calls、getState、hostStates 和 managerCallCount。
 */
function createManagementHarness({
  initialState,
  runningSourceIds = [],
  managerFailureMethods = [],
  disposeFailureSourceIds = [],
  ensureFailureSourceIds = []
}) {
  // 类型: object。
  // 作用: 保存当前测试局部稳定投影，Manager 方法通过替换该对象模拟提交。
  let state = clone(initialState);

  // 类型: Array<string>。
  // 作用: 按真实执行顺序记录 Manager、Host、适配器和端口调用。
  const calls = [];

  // 类型: Map<string, object>。
  // 作用: 保存可控 Host 隔离摘要；只有 runningSourceIds 初始进入 running。
  const hostStates = new Map(runningSourceIds.map(sourceId => [sourceId, {
    sourceId,
    phase: 'running',
    providerStatus: 'running',
    acceptingCalls: true,
    activeCallCount: 0,
    lifecycleGeneration: 1,
    lastErrorCode: ''
  }]));

  // 类型: Set<string>。
  // 作用: 保存可控动态工厂注册键，验证保存失败、启动失败和删除后的注册补偿。
  const registeredProviderKeys = new Set();

  /**
   * 执行可控 Manager 方法前置失败判断。
   * 副作用: 追加 manager 调用记录；命中失败名单时抛出测试错误。
   *
   * @param {string} methodName Manager 方法名。
   * @returns {void} 未命中失败名单时结束。
   */
  function enterManagerMethod(methodName) {
    calls.push(`manager:${methodName}`);

    // 条件分支: 当前 Manager 方法位于失败注入集合时进入。
    // 执行内容: 抛出确定性错误，验证管理 Runtime 的恢复与错误包装。
    if (managerFailureMethods.includes(methodName)) {
      throw new Error(`manager failure: ${methodName}`);
    }
  }

  /**
   * 返回当前状态隔离副本。
   * 纯函数: 不修改 state。
   *
   * @returns {object} SourceManagerState 副本。
   */
  function readState() {
    return clone(state);
  }

  // 类型: object。
  // 作用: 提供管理 Runtime 所需十四个精确 Manager 方法，并在测试局部模拟必要状态变化。
  const sourceManager = {
    /**
     * 模拟默认源提交。
     * 副作用: 记录 Manager 调用并修改测试局部 state.defaultSourceId。
     * 成功路径: 返回新状态；失败路径: 由 enterManagerMethod 注入。
     * @param {string} sourceId 下一默认源 id。
     * @returns {Promise<object>} 状态副本。
     */
    async setDefaultSource(sourceId) {
      enterManagerMethod('setDefaultSource');
      state.defaultSourceId = sourceId;
      return readState();
    },
    /**
     * 模拟单源检测。
     * 副作用: 只记录 Manager 调用；当前夹具不修改健康字段。
     * 成功路径: 返回原状态；失败路径: 由 enterManagerMethod 注入。
     * @returns {Promise<object>} 状态副本。
     */
    async checkSource() {
      enterManagerMethod('checkSource');
      return readState();
    },
    /**
     * 模拟全部检测。
     * 副作用: 只记录 Manager 调用；当前夹具不修改 checkingAll。
     * 成功路径: 返回原状态；失败路径: 由 enterManagerMethod 注入。
     * @returns {Promise<object>} 状态副本。
     */
    async checkAllSources() {
      enterManagerMethod('checkAllSources');
      return readState();
    },
    /**
     * 模拟更新检测。
     * 副作用: 只记录 Manager 调用；当前夹具不修改更新字段。
     * 成功路径: 返回原状态；失败路径: 由 enterManagerMethod 注入。
     * @returns {Promise<object>} 状态副本。
     */
    async checkSourceUpdate() {
      enterManagerMethod('checkSourceUpdate');
      return readState();
    },
    /**
     * 模拟启停事务。
     * 副作用: 记录 Manager 调用，并修改目标 enabled 和必要的默认源交接结果。
     * 成功路径: 更新 enabled/default；失败路径: 由 enterManagerMethod 注入。
     * @param {object} command 启停命令。
     * @returns {Promise<object>} 状态副本。
     */
    async setSourceEnabled(command) {
      enterManagerMethod('setSourceEnabled');

      // 类型: object。
      // 作用: 定位启停目标，模拟 Manager 提交 Preferences 后的投影变化。
      const record = state.records.find(candidate => candidate.definition.id === command.sourceId);
      record.runtime.enabled = command.enabled;

      // 条件分支: 启用目标且当前没有默认源时进入。
      // 执行内容: 模拟 Manager 把首次明确启用源设为默认源。
      if (command.enabled && !state.defaultSourceId) state.defaultSourceId = command.sourceId;

      // 条件分支: 关闭目标正是当前默认源时进入。
      // 执行内容: 按明确 replace/clear 命令更新测试默认源。
      if (!command.enabled && state.defaultSourceId === command.sourceId) {
        state.defaultSourceId = command.handoff?.mode === 'replace' ? command.handoff.sourceId : '';
      }
      return readState();
    },
    /**
     * 模拟授权事务。
     * 副作用: 记录 Manager 调用，并按 enableAfterAuthorization 修改目标启用和首次默认源状态。
     * 成功路径: 保存 enabled 决定；失败路径: 由 enterManagerMethod 注入。
     * @param {object} command 授权命令。
     * @returns {Promise<object>} 状态副本。
     */
    async authorizeSource(command) {
      enterManagerMethod('authorizeSource');

      // 类型: object。
      // 作用: 定位授权目标，模拟授权和可选启用同时提交。
      const record = state.records.find(candidate => candidate.definition.id === command.sourceId);
      record.runtime.enabled = command.enableAfterAuthorization;

      // 条件分支: 授权后启用且当前没有默认源时进入。
      // 执行内容: 模拟 Manager 设置首次明确启用源为默认源。
      if (command.enableAfterAuthorization && !state.defaultSourceId) state.defaultSourceId = command.sourceId;
      return readState();
    },
    /**
     * 模拟撤销授权事务。
     * 副作用: 记录 Manager 调用并关闭目标记录，供 Runtime 验证 Host 释放顺序。
     * 成功路径: 关闭目标；失败路径: 由 enterManagerMethod 注入。
     * @param {object} command 撤销命令。
     * @returns {Promise<object>} 状态副本。
     */
    async revokeSourceAuthorization(command) {
      enterManagerMethod('revokeSourceAuthorization');

      // 类型: object。
      // 作用: 定位撤销目标，模拟 revoked 操作同步关闭数据源。
      const record = state.records.find(candidate => candidate.definition.id === command.sourceId);
      record.runtime.enabled = false;
      return readState();
    },
    /**
     * 模拟恢复系统源事务。
     * 副作用: 记录 Manager 调用，并从测试局部软隐藏集合移除指定 id。
     * 成功路径: 移除软隐藏 id；失败路径: 由 enterManagerMethod 注入。
     * @param {Array<string>} sourceIds 恢复目标。
     * @returns {Promise<object>} 状态副本。
     */
    async restoreSystemSources(sourceIds) {
      enterManagerMethod('restoreSystemSources');
      state.removedSystemSourceIds = state.removedSystemSourceIds.filter(
        sourceId => !sourceIds.includes(sourceId)
      );
      return readState();
    },
    /**
     * 模拟临时缓存清理。
     * 副作用: 只记录 Manager 调用；缓存值不属于当前生命周期夹具的断言目标。
     * 成功路径: 返回状态；失败路径: 由 enterManagerMethod 注入。
     * @returns {Promise<object>} 状态副本。
     */
    async clearTemporarySourceCache() {
      enterManagerMethod('clearTemporarySourceCache');
      return readState();
    },
    /**
     * 模拟全部缓存清理。
     * 副作用: 只记录 Manager 调用；缓存值不属于当前生命周期夹具的断言目标。
     * 成功路径: 返回状态；失败路径: 由 enterManagerMethod 注入。
     * @returns {Promise<object>} 状态副本。
     */
    async clearAllSourceCache() {
      enterManagerMethod('clearAllSourceCache');
      return readState();
    },
    /**
     * 模拟导入事务。
     * 副作用: 只记录 Manager 调用；真实 Bundle 用例单独验证 Repository 导入结果。
     * 成功路径: 返回状态；失败路径: 由 enterManagerMethod 注入。
     * @param {object} command 适配器生成的导入命令。
     * @returns {Promise<object>} 状态副本。
     */
    async importSource(command) {
      enterManagerMethod('importSource');

      // 类型: object。
      // 作用: 使用适配器命令创建提交后 SourceRecord，模拟 Provider 已在注册表中因而就绪。
      const importedRecord = createRecord({
        id: command.sourceDefinition.id,
        providerKey: TRUSTED_PROVIDER_KEY,
        enabled: command.enableAfterImport,
        sourceKind: 'custom',
        importMethod: command.sourceDefinition.importMethod
      });
      importedRecord.definition = clone(command.sourceDefinition);
      importedRecord.runtime.providerReadiness = {
        status: PROVIDER_READINESS_STATUS.ready,
        reasonCode: PROVIDER_READINESS_REASON_CODE.none,
        reason: ''
      };
      state.records.push(importedRecord);
      return readState();
    },
    /**
     * 模拟更新事务。
     * 副作用: 记录 Manager 调用，采用候选 Definition 并关闭更新目标。
     * 成功路径: 采用下一 Definition 并关闭目标；失败路径: 由 enterManagerMethod 注入。
     * @param {object} command 更新命令。
     * @returns {Promise<object>} 状态副本。
     */
    async applySourceUpdate(command) {
      enterManagerMethod('applySourceUpdate');

      // 类型: number。
      // 作用: 定位更新目标数组位置，模拟 SourceManager 采用下一 Definition。
      const recordIndex = state.records.findIndex(
        candidate => candidate.definition.id === command.sourceId
      );
      state.records[recordIndex].definition = clone(command.sourceDefinition);
      state.records[recordIndex].runtime.enabled = false;
      return readState();
    },
    /**
     * 模拟批量删除事务。
     * 副作用: 记录 Manager 调用，并从测试局部 records 删除整批目标。
     * 成功路径: 移除目标；失败路径: 由 enterManagerMethod 注入。
     * @param {object} command 删除命令。
     * @returns {Promise<object>} 状态副本。
     */
    async deleteSources(command) {
      enterManagerMethod('deleteSources');
      state.records = state.records.filter(
        record => !command.sourceIds.includes(record.definition.id)
      );
      return readState();
    },
    /**
     * 模拟最小导出查询。
     * 副作用: 只记录 Manager 调用，不创建 Blob、DOM 或下载资源。
     * 成功路径: 返回空包；失败路径: 由 enterManagerMethod 注入。
     * @returns {Promise<object>} 导出包。
     */
    async createSourceExportBundle() {
      enterManagerMethod('createSourceExportBundle');
      return { schemaVersion: '1.0.0', exportedAt: '2026-07-17T00:00:00.000Z', sources: [] };
    }
  };

  // 类型: object。
  // 作用: 提供隔离 Host 摘要读取和 dispose；失败名单用于证明 Manager 事务不会提前执行。
  const sourceExecutionHost = {
    /**
     * 读取可控 Host 摘要。
     * 副作用: 记录 Host 查询调用；不修改 hostStates。
     * 成功路径: 返回副本或 null；失败路径: 当前不注入。
     * @param {string} sourceId 目标源。
     * @returns {Promise<object|null>} Host 摘要。
     */
    async getRuntimeState(sourceId) {
      calls.push(`host:get:${sourceId}`);
      return hostStates.has(sourceId) ? clone(hostStates.get(sourceId)) : null;
    },
    /**
     * 释放可控 Host。
     * 副作用: 记录 dispose 调用；成功时删除当前测试局部 Host entry。
     * 成功路径: 删除摘要；失败路径: 由 disposeFailureSourceIds 注入。
     * @param {string} sourceId 目标源。
     * @returns {Promise<void>} 释放结果。
     */
    async dispose(sourceId) {
      calls.push(`host:dispose:${sourceId}`);

      // 条件分支: 当前 sourceId 位于 dispose 失败集合时进入。
      // 执行内容: 抛出确定性错误，证明 Manager 事务不会继续。
      if (disposeFailureSourceIds.includes(sourceId)) {
        throw new Error(`dispose failure: ${sourceId}`);
      }
      hostStates.delete(sourceId);
    }
  };

  // 类型: object。
  // 作用: 提供精确两方法输入适配器；更新方法返回可被假 Manager 采用的稳定身份候选。
  const sourceManagementInputAdapter = {
    /**
     * 模拟导入适配并记录调用。
     * 副作用: 追加适配器调用记录；不修改导入输入。
     * @param {object} input 导入输入。
     * @returns {object} 导入命令。
     */
    createImportCommand(input) {
      calls.push('adapter:import');
      return {
        sourcePackage: clone(input.payload),
        sourceDefinition: {
          id: input.manifest.id,
          name: input.manifest.name,
          sourceKind: 'custom',
          version: input.manifest.version,
          providerKey: input.manifest.providerKey,
          packageRef: `source-package::${input.manifest.id}`,
          importMethod: input.payload.importMethod,
          remoteUrl: input.payload.remoteUrl,
          importedAt: input.payload.importedAt
        },
        settings: {},
        authorizedAt: input.authorizedAt,
        enableAfterImport: input.enableAfterImport
      };
    },
    /**
     * 模拟更新适配并返回稳定身份命令。
     * 副作用: 追加适配器调用记录；不修改当前记录或候选。
     * @param {object} record 当前记录。
     * @param {object} candidate 更新候选。
     * @returns {object} 更新命令。
     */
    createUpdateCommand(record, candidate) {
      calls.push('adapter:update');
      return {
        sourceId: record.definition.id,
        sourcePackage: candidate.sourcePackage,
        sourceDefinition: candidate.sourceDefinition
      };
    }
  };

  // 类型: object。
  // 作用: 提供精确两方法更新端口，候选保持当前 sourceId 稳定并改变版本/指纹。
  const sourceUpdatePort = {
    /**
     * 模拟无更新检测。
     * 副作用: 追加更新端口检测调用记录；不修改记录或夹具。
     * 成功路径: 返回标准结果；失败路径: 当前不注入。
     * @returns {Promise<object>} 检测结果。
     */
    async check() {
      calls.push('port:check');
      return {
        updateAvailable: false,
        availableVersion: '',
        availableVersionUpdatedAt: '',
        checkedAt: '2026-07-17T00:00:00.000Z'
      };
    },
    /**
     * 模拟候选读取。
     * 副作用: 追加候选读取调用记录；返回新候选而不修改记录。
     * 成功路径: 返回同源下一版本；失败路径: 当前不注入。
     * @param {object} record 当前记录。
     * @returns {Promise<object>} 更新候选。
     */
    async getUpdateCandidate(record) {
      calls.push('port:candidate');
      return {
        sourcePackage: {
          sourceId: record.definition.id,
          integrity: { scriptHash: '22222222' }
        },
        sourceDefinition: {
          ...record.definition,
          version: 'v2.0.0'
        }
      };
    }
  };

  // 类型: object。
  // 作用: 为可控导入固定一个合法动态 Provider manifest，不读取页面或 Repository。
  const importedManifest = Object.freeze({
    id: 'source.test.imported',
    name: '测试动态数据源',
    version: '1.0.0',
    providerKey: TRUSTED_PROVIDER_KEY
  });

  // 类型: object。
  // 作用: 提供精确三方法加载器，预检不执行，load 返回同一 manifest、载荷、工厂和用户启用决定。
  const sourcePackageLoader = Object.freeze({
    /**
     * 模拟信任前预检。
     * 副作用: 只记录调用，不执行或注册工厂。
     * 成功路径: resolve 无脚本文本预览；失败路径: 当前夹具不注入。
     * @param {object} input 三入口输入。
     * @returns {Promise<object>} 安全预览。
     */
    async preview(input) {
      calls.push('loader:preview');
      return {
        manifest: clone(importedManifest),
        importMethod: input.importMethod,
        remoteUrl: input.remoteUrl,
        originalFileName: input.originalFileName,
        scriptBytes: input.scriptContent.length,
        integrity: { algorithm: 'sha-256', scriptHash: '2'.repeat(64) },
        readyForTrust: true,
        executionRisk: '测试风险说明'
      };
    },
    /**
     * 模拟信任后加载结果。
     * 副作用: 记录调用，不直接注册或写 Manager。
     * 成功路径: resolve 载荷、manifest、工厂和用户启用决定；失败路径: 当前夹具不注入。
     * @param {object} input 三入口输入。
     * @param {object} trustDecision 用户信任决定。
     * @param {string} importedAt Runtime 生成的 UTC 时间。
     * @returns {Promise<object>} 可供 Runtime 注册与保存的加载结果。
     */
    async load(input, trustDecision, importedAt) {
      calls.push('loader:load');
      return {
        payload: {
          ...clone(input),
          importedAt,
          integrity: {
            algorithm: 'sha-256',
            scriptHash: trustDecision.trustedScriptHash
          }
        },
        manifest: clone(importedManifest),
        providerFactory: {
          providerKey: TRUSTED_PROVIDER_KEY,
          /**
           * 模拟工厂支持当前 Definition。
           * 纯函数: 不读取输入或修改状态。
           * @returns {boolean} 固定 true。
           */
          supports() { return true; },
          /**
           * 创建空 Provider 候选。
           * 纯函数: 返回新空对象，当前 Runtime 测试不会调用。
           * @returns {object} 空对象。
           */
          create() { return {}; }
        },
        enableAfterImport: trustDecision.enableAfterImport
      };
    },
    /**
     * 模拟动态工厂支持复核。
     * 副作用: 记录调用；Definition id 不一致时抛出测试错误。
     * 成功路径: id 与固定 manifest 一致时结束；失败路径: 抛 Error。
     * @param {object} providerFactory 动态工厂。
     * @param {object} sourceDefinition 适配器 Definition。
     * @returns {void} 支持检查完成后结束。
     */
    assertFactorySupports(providerFactory, sourceDefinition) {
      calls.push('loader:supports');
      assert.equal(providerFactory.providerKey, TRUSTED_PROVIDER_KEY);
      assert.equal(sourceDefinition.id, importedManifest.id);
    }
  });

  // 类型: object。
  // 作用: 提供动态工厂注册和移除观测端口，不泄漏查询能力给 Runtime。
  const providerFactoryRegistrationPort = Object.freeze({
    /**
     * 注册可控动态工厂。
     * 副作用: 记录调用并写入局部 Set；重复键抛冲突错误。
     * 成功路径: 保存新键；失败路径: 重复键时抛 Error。
     * @param {string} providerKey 工厂键。
     * @param {object} providerFactory 待注册工厂门面。
     * @returns {object} 原工厂。
     */
    register(providerKey, providerFactory) {
      calls.push(`registry:register:${providerKey}`);
      // 条件分支: 同一 providerKey 已经注册时进入。
      // 执行内容: 抛出确定性冲突，禁止覆盖旧工厂。
      if (registeredProviderKeys.has(providerKey)) throw new Error('duplicate provider');
      registeredProviderKeys.add(providerKey);
      return providerFactory;
    },
    /**
     * 移除可控动态工厂。
     * 副作用: 记录调用并从局部 Set 删除键。
     * 成功路径: 返回真实删除结果；失败路径: 当前夹具不注入。
     * @param {string} providerKey 工厂键。
     * @returns {boolean} 是否删除现有键。
     */
    remove(providerKey) {
      calls.push(`registry:remove:${providerKey}`);
      return registeredProviderKeys.delete(providerKey);
    }
  });

  // 类型: object。
  // 作用: 使用全部可控依赖创建真实 SourceManagementRuntime FIFO 和补偿实现。
  const runtime = createSourceManagementRuntime({
    /**
     * 模拟共享初始化。
     * 副作用: 追加初始化调用记录；不创建第二套基础设施。
     * 成功路径: 返回状态；失败路径: 当前不注入。
     * @returns {Promise<object>} 状态副本。
     */
    async initialize() {
      calls.push('runtime:initialize');
      return readState();
    },
    /**
     * 模拟共享状态读取。
     * 纯函数: 返回测试局部 state 的隔离副本，不修改调用记录或状态。
     * 成功路径: 返回副本；失败路径: 当前不注入。
     * @returns {Promise<object>} 状态副本。
     */
    async getSourceManagerState() {
      return readState();
    },
    /**
     * 模拟状态订阅。
     * 纯函数: 返回空的幂等取消函数，不登记真实监听器或修改状态。
     * 成功路径: 返回幂等空取消函数。
     * @returns {Function} 取消函数。
     */
    subscribe() {
      return () => undefined;
    },
    sourceManager,
    sourceExecutionHost,
    sourceManagementInputAdapter,
    sourcePackageLoader,
    providerFactoryRegistrationPort,
    sourceUpdatePort,
    /**
     * 模拟可信源按需启动。
     * 副作用: 追加 ensure 调用记录，并写入 running 或失败 Host 摘要。
     * 成功路径: 写入 running；失败路径: 由 ensureFailureSourceIds 注入。
     * @param {string} sourceId 目标源。
     * @returns {Promise<object>} Host 摘要。
     */
    async ensureSourceRunning(sourceId) {
      calls.push(`runtime:ensure:${sourceId}`);

      // 条件分支: 当前 sourceId 位于 ensure 失败集合时进入。
      // 执行内容: 留下 failed entry 并抛错，验证关闭和 dispose 补偿。
      if (ensureFailureSourceIds.includes(sourceId)) {
        hostStates.set(sourceId, {
          sourceId,
          phase: 'failed',
          providerStatus: 'failed'
        });
        throw new Error(`ensure failure: ${sourceId}`);
      }
      hostStates.set(sourceId, {
        sourceId,
        phase: 'running',
        providerStatus: 'running',
        acceptingCalls: true,
        activeCallCount: 0,
        lifecycleGeneration: 2,
        lastErrorCode: ''
      });
      return clone(hostStates.get(sourceId));
    }
  });

  return {
    runtime,
    calls,
    hostStates,
    registeredProviderKeys,
    getState: readState
  };
}

test('真实 Bundle 提供完整管理门面并完成模拟在线更新', async () => {
  // 类型: object。
  // 作用: 保存真实单一基础设施 Bundle，验证内容门面和完整管理门面共享同一运行图。
  const bundle = createSourceRuntimeBundle(createMockSourceRuntimeOptions());
  assert.deepEqual(Object.keys(bundle.sourceManagementRuntime), MANAGEMENT_PUBLIC_METHODS);

  // 类型: object。
  // 作用: 保存每次管理操作后的最新隔离 SourceManagerState，串联检测和更新断言。
  let state = await bundle.sourceManagementRuntime.initialize();
  state = await bundle.sourceManagementRuntime.checkSourceUpdate(REMOTE_SOURCE_ID);

  // 类型: object。
  // 作用: 保存模拟数据源 05 当前记录，验证检测结果和更新提交后的字段变化。
  let remoteRecord = state.records.find(record => record.definition.id === REMOTE_SOURCE_ID);
  assert.equal(remoteRecord.runtime.updateAvailable, true);
  assert.equal(remoteRecord.runtime.availableVersion, 'v1.3.0');

  state = await bundle.sourceManagementRuntime.applySourceUpdate(REMOTE_SOURCE_ID);
  remoteRecord = state.records.find(record => record.definition.id === REMOTE_SOURCE_ID);
  assert.equal(remoteRecord.definition.version, 'v1.3.0');
  assert.equal(remoteRecord.runtime.enabled, false);
  assert.equal(remoteRecord.authorization.status, 'pending');
});

test('应用单例通过 store 完整投影驱动 settingsService 默认源操作', async () => {
  // 副作用: 模拟 main.js 启动前状态，把 store 恢复为完整空投影并标记初始化进行中。
  settingsStore.beginSourceManagerInitialization();

  // 类型: Function。
  // 作用: 在应用单例首次初始化前登记完整投影监听器，测试结束时取消以隔离后续用例。
  const unsubscribe = sourceManagementRuntimeInstance.subscribe((sourceManagerState) => {
    // 副作用: 只调用 store 完整替换入口，复现 main.js 的唯一页面投影采用路径。
    settingsStore.replaceSourceManagerState(sourceManagerState);
  });
  // 类型: object；作用: 让 Node 测试执行产品默认 Blob 模块通道，并在用例结束恢复全部全局能力。
  const moduleLoader = installNodeBlobModuleLoader();

  try {
    // 类型: object。
    // 作用: 保存应用单例首次初始化结果，验证订阅已经把同构完整投影采用到 store。
    const initializedState = await sourceManagementRuntimeInstance.initialize();

    assert.deepEqual(Object.keys(settingsStore.sourceManager), SOURCE_MANAGER_STATE_FIELDS);
    assert.equal(settingsStore.initialization.status, 'ready');
    assert.equal(getSourceManagerState(), settingsStore.sourceManager);
    assert.deepEqual(
      settingsStore.sourceManager.records.map(record => record.definition.id),
      initializedState.records.map(record => record.definition.id)
    );
    assert.equal(
      settingsStore.sourceManager.records.some(
        record => Object.hasOwn(record.definition, 'scriptContent')
      ),
      false
    );

    // 断言内容: 产品应用单例只保留当前种子系统记录；全部 ABI 2.0 保存脚本必须经同一动态加载链恢复为 ready。
    assert.equal(settingsStore.sourceManager.records.length, BUILTIN_SOURCE_COUNT);
    assert.equal(
      settingsStore.sourceManager.records.every((record) => {
        return record.runtime.providerReadiness.status === PROVIDER_READINESS_STATUS.ready
          && isSourceRecordRunnable(record);
      }),
      true
    );
    assert.deepEqual(
      {
        enabledCount: getSourceSummary().enabledCount,
        runnableCount: getSourceSummary().runnableCount
      },
      { enabledCount: BUILTIN_SOURCE_COUNT, runnableCount: BUILTIN_SOURCE_COUNT }
    );

    // 类型: object。
    // 作用: 选择一个已启用且可执行的非默认系统记录，验证默认源命令采用真实 Provider readiness。
    const nextDefaultRecord = settingsStore.sourceManager.records.find((record) => {
      return record.definition.id !== settingsStore.sourceManager.defaultSourceId
        && isSourceRecordRunnable(record);
    });
    assert.ok(nextDefaultRecord);

    // 类型: boolean；作用: 保存设置命令成功结果；ready 系统源应通过唯一 Runtime 和 Repository 提交默认源。
    const changed = await setDefaultSource(nextDefaultRecord.definition.id);
    assert.equal(changed, true);
    assert.equal(settingsStore.sourceManager.defaultSourceId, nextDefaultRecord.definition.id);
  } finally {
    // 资源清理: 取消本测试添加的应用投影监听器，避免后续真实 Bundle 用例接收额外发布。
    unsubscribe();
    // 资源清理: 恢复 Node 原生 Blob 与对象 URL，避免测试适配泄漏到其他模块。
    moduleLoader.restore();
  }
});

test('源码固定旧 mock 禁用边界和 Source/UserContent 初始化顺序', () => {
  // 类型: string。
  // 作用: 读取 store 源码，验证页面投影不再从 source-manager.mock 建立第二保存权威。
  const storeSource = readFileSync(
    new URL('../src/store/settingsStore.js', import.meta.url),
    'utf8'
  );

  // 类型: string。
  // 作用: 读取 service 源码，验证领域写操作不再使用旧操作场景、固定等待或逐字段 store 写入。
  const serviceSource = readFileSync(
    new URL('../src/services/settingsService.js', import.meta.url),
    'utf8'
  );

  // 类型: string。
  // 作用: 读取应用入口源码，验证订阅、初始化和挂载保持冻结顺序。
  const mainSource = readFileSync(
    new URL('../src/main.js', import.meta.url),
    'utf8'
  );

  assert.equal(storeSource.includes('source-manager.mock'), false);
  assert.equal(serviceSource.includes('sourceOperationScenarios'), false);
  assert.equal(serviceSource.includes('waitForMockOperation'), false);
  assert.equal(serviceSource.includes('settingsStore.sourceManager ='), false);

  // 类型: number。
  // 作用: 保存 main.js 唯一 Runtime 订阅调用位置，必须先于初始化和根应用挂载。
  const subscribeIndex = mainSource.indexOf('sourceManagementRuntimeInstance.subscribe(');

  // 类型: number。
  // 作用: 保存共享 Runtime 初始化调用位置，必须位于订阅之后和用户内容初始化之前。
  const initializeIndex = mainSource.indexOf('await sourceManagementRuntimeInstance.initialize()');

  // 类型: number。
  // 作用: 保存用户内容初始化调用位置，必须在 SourceManager 收敛后且根实例挂载前执行。
  const userContentInitializeIndex = mainSource.indexOf('await initializeUserContent()');

  // 类型: number。
  // 作用: 保存应用状态启动调用位置，验证两个持久化领域是正常和失败根视图的共同前置条件。
  const applicationInitializationIndex = mainSource.lastIndexOf('initializeApplicationState()');

  // 类型: number。
  // 作用: 保存正常 App 挂载分支位置，必须位于应用状态初始化调用之后。
  const mountIndex = mainSource.indexOf('.then(mountApplication)');

  // 类型: number。
  // 作用: 保存启动故障回调入口，必须紧随正常挂载分支并接收原始 reject 原因。
  const failureHandlerIndex = mainSource.indexOf('.catch((error) => {', mountIndex);

  // 类型: number。
  // 作用: 保存开发安全诊断调用位置；失败回调必须先报告摘要，再挂载用户故障视图。
  const failureDiagnosticIndex = mainSource.indexOf(
    'reportStartupFailureDiagnostic(error);',
    failureHandlerIndex
  );

  // 类型: number。
  // 作用: 保存启动故障视图挂载调用位置，必须位于安全诊断之后并防止 reject 留下空白页面。
  const failureMountIndex = mainSource.indexOf(
    'return mountStartupFailure(error);',
    failureDiagnosticIndex
  );

  assert.ok(subscribeIndex >= 0);
  assert.ok(initializeIndex > subscribeIndex);
  assert.ok(userContentInitializeIndex > initializeIndex);
  assert.ok(applicationInitializationIndex > userContentInitializeIndex);
  assert.ok(mountIndex > applicationInitializationIndex);
  assert.ok(failureHandlerIndex > mountIndex);
  assert.ok(failureDiagnosticIndex > failureHandlerIndex);
  assert.ok(failureMountIndex > failureDiagnosticIndex);
});

test('输入适配器只从加载器制品映射稳定 manifest 身份和 SHA-256', () => {
  // 类型: object。
  // 作用: 保存纯输入适配器，独立验证 manifest id 是唯一身份来源。
  const adapter = createSourceManagementInputAdapter();

  // 类型: string。
  // 作用: 保存已经由远程读取器取得并规范化的单文件脚本文本。
  const scriptContent = 'export const sourceManifest = Object.freeze({});';

  // 类型: object。
  // 作用: 保存静态预检器已验证的精确 manifest，名称、版本和 Provider 不来自页面字段。
  const manifest = {
    schemaVersion: '1.0.0',
    providerApiVersion: '2.0.0',
    id: 'source.com.stable',
    name: '稳定远程源',
    description: '验证加载器制品到 Manager 命令的稳定映射。',
    version: '1.0.0',
    providerKey: 'source.com.stable.provider',
    capabilities: {
      home: true,
      movie: true,
      tv: true,
      search: true,
      detail: true,
      play: true
    },
    settingsSchema: [],
    networkHosts: ['example.com']
  };

  // 类型: object。
  // 作用: 保存加载器交给适配器的远程载荷、manifest 和用户决定。
  const input = {
    payload: {
      importMethod: 'remote',
      scriptContent,
      remoteUrl: 'https://example.com/stable.js',
      originalFileName: '',
      importedAt: '2026-07-17T03:00:00.000Z',
      integrity: {
        algorithm: 'sha-256',
        scriptHash: createSourceScriptHash(scriptContent)
      }
    },
    manifest,
    authorizedAt: '2026-07-17T03:00:00.000Z',
    enableAfterImport: false
  };

  // 类型: object。
  // 作用: 保存第一次导入命令，作为 manifest 身份和 SHA-256 基准。
  const firstCommand = adapter.createImportCommand(input);

  // 类型: object。
  // 作用: 保存仅改变导入和授权时间的第二次命令，验证时间不改变 manifest 身份。
  const secondCommand = adapter.createImportCommand({
    ...input,
    payload: {
      ...input.payload,
      importedAt: '2026-07-17T04:00:00.000Z'
    },
    authorizedAt: '2026-07-17T04:00:00.000Z'
  });
  assert.equal(firstCommand.sourceDefinition.id, secondCommand.sourceDefinition.id);
  assert.equal(firstCommand.sourcePackage.scriptContent, scriptContent);
  assert.equal(firstCommand.sourceDefinition.providerKey, manifest.providerKey);
  assert.equal(firstCommand.sourcePackage.integrity.scriptHash, createSourceScriptHash(scriptContent));
});

test('模拟更新端口分离检测和候选读取，并隔离跨次返回值', async () => {
  // 类型: object。
  // 作用: 保存只读模拟更新端口，验证检测结果和候选读取使用独立方法与副本。
  const updatePort = createMockSourceUpdatePort();

  // 类型: object。
  // 作用: 保存具有受审更新候选的远程记录，作为两类端口调用的统一输入。
  const remoteRecord = createRecord({
    id: REMOTE_SOURCE_ID,
    providerKey: `${REMOTE_SOURCE_ID}.provider`,
    enabled: false,
    sourceKind: 'custom',
    importMethod: 'remote'
  });

  // 类型: object。
  // 作用: 保存第一次检测结果并执行外部篡改，验证该引用不会污染端口夹具。
  const firstResult = await updatePort.check(remoteRecord);
  firstResult.availableVersion = 'mutated';

  // 类型: object。
  // 作用: 保存第二次检测结果，验证跨次返回值引用隔离。
  const secondResult = await updatePort.check(remoteRecord);
  assert.equal(secondResult.availableVersion, 'v1.3.0');

  // 类型: object。
  // 作用: 保存第一次受审候选并执行外部篡改，验证深层 Definition 不穿透夹具。
  const firstCandidate = await updatePort.getUpdateCandidate(remoteRecord);
  firstCandidate.sourceDefinition.version = 'mutated';

  // 类型: object。
  // 作用: 保存第二次候选，验证跨次候选深层字段保持正式版本。
  const secondCandidate = await updatePort.getUpdateCandidate(remoteRecord);
  assert.equal(secondCandidate.sourceDefinition.version, 'v1.3.0');

  await assert.rejects(
    updatePort.getUpdateCandidate(createRecord({
      id: LATEST_SOURCE_ID,
      providerKey: `${LATEST_SOURCE_ID}.provider`,
      enabled: true,
      sourceKind: 'custom',
      importMethod: 'remote'
    })),
    error => error.code === 'SOURCE_MANAGEMENT_NOT_FOUND'
  );
});

test('管理 Runtime 预检不注册，正式导入、删除和重新导入清理同一动态工厂', async () => {
  // 类型: object。
  // 作用: 创建没有初始记录的可控环境，观察 Loader、Registry 和 Manager 顺序。
  const harness = createManagementHarness({ initialState: createState([]) });

  // 类型: object。
  // 作用: 保存信任前安全预览，确认预检不会提前产生工厂注册或记录。
  const preview = await harness.runtime.previewSourceImport(
    createDynamicImportRequest(false).input
  );
  assert.equal(preview.readyForTrust, true);
  assert.equal(harness.registeredProviderKeys.size, 0);
  assert.equal(harness.getState().records.length, 0);

  // 类型: object。
  // 作用: 保存首次关闭导入结果，工厂应注册但 Host 不启动。
  let state = await harness.runtime.importSource(createDynamicImportRequest(false));
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].runtime.enabled, false);
  assert.equal(harness.registeredProviderKeys.has(TRUSTED_PROVIDER_KEY), true);
  assert.equal(harness.hostStates.size, 0);

  state = await harness.runtime.deleteSources({ sourceIds: ['source.test.imported'] });
  assert.equal(state.records.length, 0);
  assert.equal(harness.registeredProviderKeys.has(TRUSTED_PROVIDER_KEY), false);

  state = await harness.runtime.importSource(createDynamicImportRequest(false));
  assert.equal(state.records.length, 1);
  assert.equal(harness.registeredProviderKeys.has(TRUSTED_PROVIDER_KEY), true);
  assert.deepEqual(
    harness.calls.filter(call => call.startsWith('loader:') || call.startsWith('registry:')),
    [
      'loader:preview',
      'loader:load',
      'loader:supports',
      `registry:register:${TRUSTED_PROVIDER_KEY}`,
      `registry:remove:${TRUSTED_PROVIDER_KEY}`,
      'loader:load',
      'loader:supports',
      `registry:register:${TRUSTED_PROVIDER_KEY}`
    ]
  );
});

test('管理 Runtime 在保存失败和首次启动失败后逆序清理动态工厂与记录', async () => {
  // 类型: object。
  // 作用: 注入 Manager 导入失败，验证已经发生的注册副作用被移除。
  const persistFailureHarness = createManagementHarness({
    initialState: createState([]),
    managerFailureMethods: ['importSource']
  });
  await assert.rejects(
    persistFailureHarness.runtime.importSource(createDynamicImportRequest(false)),
    error => error instanceof SourceManagementOperationError
  );
  assert.equal(persistFailureHarness.registeredProviderKeys.size, 0);
  assert.equal(persistFailureHarness.getState().records.length, 0);

  // 类型: object。
  // 作用: 注入首次导入源 Host 启动失败，验证关闭后继续物理删除记录并移除工厂。
  const startFailureHarness = createManagementHarness({
    initialState: createState([]),
    ensureFailureSourceIds: ['source.test.imported']
  });
  await assert.rejects(
    startFailureHarness.runtime.importSource(createDynamicImportRequest(true)),
    error => error instanceof SourceManagementOperationError
  );
  assert.equal(startFailureHarness.registeredProviderKeys.size, 0);
  assert.equal(startFailureHarness.getState().records.length, 0);
  assert.equal(startFailureHarness.hostStates.size, 0);
  assert.deepEqual(
    startFailureHarness.calls.filter(
      call => call.startsWith('manager:')
        || call.startsWith('runtime:ensure:')
        || call.startsWith('registry:')
    ),
    [
      `registry:register:${TRUSTED_PROVIDER_KEY}`,
      'manager:importSource',
      'runtime:ensure:source.test.imported',
      'manager:setSourceEnabled',
      'manager:deleteSources',
      `registry:remove:${TRUSTED_PROVIDER_KEY}`
    ]
  );
});

test('可信源启动失败后关闭保存态并清理失败 Host entry', async () => {
  // 类型: object。
  // 作用: 保存注入 trusted-a 启动失败的可控环境，验证 Manager 关闭和 Host 清理补偿顺序。
  const harness = createManagementHarness({
    initialState: createState([
      createRecord({ id: 'trusted-a', enabled: false }),
      createRecord({ id: 'trusted-b', enabled: true })
    ], 'trusted-b'),
    ensureFailureSourceIds: ['trusted-a']
  });

  await assert.rejects(
    harness.runtime.setSourceEnabled({ sourceId: 'trusted-a', enabled: true }),
    error => error instanceof SourceManagementOperationError
  );
  assert.equal(
    harness.getState().records.find(record => record.definition.id === 'trusted-a').runtime.enabled,
    false
  );
  assert.equal(harness.hostStates.has('trusted-a'), false);
  assert.deepEqual(
    harness.calls.filter(call => call.includes('setSourceEnabled') || call.includes('ensure:trusted-a')),
    ['manager:setSourceEnabled', 'runtime:ensure:trusted-a', 'manager:setSourceEnabled']
  );
});

test('未注册自定义源保存授权和 enabled 决定但不调用 Host', async () => {
  // 类型: object。
  // 作用: 保存只有 unresolved 自定义源的可控环境，验证用户决定与可执行能力分离。
  const harness = createManagementHarness({
    initialState: createState([
      createRecord({
        id: 'custom-unresolved',
        providerKey: UNREGISTERED_PROVIDER_KEY,
        enabled: false,
        sourceKind: 'custom',
        importMethod: 'text'
      })
    ])
  });

  // 类型: object。
  // 作用: 保存授权并启用提交后的投影，验证 enabled 可保存且没有 Host ensure 副作用。
  const state = await harness.runtime.authorizeSource({
    sourceId: 'custom-unresolved',
    authorizedAt: '2026-07-17T03:00:00.000Z',
    enableAfterAuthorization: true
  });
  assert.equal(state.records[0].runtime.enabled, true);
  assert.equal(harness.calls.some(call => call.startsWith('runtime:ensure:')), false);
  assert.equal(harness.hostStates.size, 0);
});

test('Manager 破坏事务失败时只恢复操作前真实 running 源', async () => {
  // 类型: object。
  // 作用: 保存仅 trusted-a 真正在运行且缓存事务失败的环境，验证精确运行集合恢复。
  const harness = createManagementHarness({
    initialState: createState([
      createRecord({ id: 'trusted-a', enabled: true }),
      createRecord({ id: 'trusted-b', enabled: true })
    ], 'trusted-a'),
    runningSourceIds: ['trusted-a'],
    managerFailureMethods: ['clearTemporarySourceCache']
  });

  await assert.rejects(
    harness.runtime.clearTemporarySourceCache('trusted-a'),
    error => error instanceof SourceManagementOperationError
  );
  assert.equal(harness.hostStates.get('trusted-a').phase, 'running');
  assert.equal(harness.hostStates.has('trusted-b'), false);
  assert.deepEqual(
    harness.calls.filter(call => call.includes('dispose')
      || call.includes('clearTemporarySourceCache')
      || call.startsWith('runtime:ensure:')),
    [
      'host:dispose:trusted-a',
      'manager:clearTemporarySourceCache',
      'runtime:ensure:trusted-a'
    ]
  );
});

test('Host dispose 失败时不进入后续 Manager 事务', async () => {
  // 类型: object。
  // 作用: 保存 trusted-a 释放失败环境，验证保存事务不会在运行实例未释放时开始。
  const harness = createManagementHarness({
    initialState: createState([createRecord({ id: 'trusted-a', enabled: true })], 'trusted-a'),
    runningSourceIds: ['trusted-a'],
    disposeFailureSourceIds: ['trusted-a']
  });

  await assert.rejects(
    harness.runtime.clearAllSourceCache('trusted-a'),
    error => error instanceof SourceManagementOperationError
  );
  assert.equal(harness.calls.includes('manager:clearAllSourceCache'), false);
});

test('批量释放中途失败时恢复操作前完整 running 集合', async () => {
  // 类型: object。
  // 作用: 保存两个源均在运行、第二项释放失败的环境，验证第一项成功释放后不会留下保存态与 Host 分裂。
  const harness = createManagementHarness({
    initialState: createState([
      createRecord({ id: 'trusted-a', enabled: true }),
      createRecord({ id: 'trusted-b', enabled: true })
    ], 'trusted-a'),
    runningSourceIds: ['trusted-a', 'trusted-b'],
    disposeFailureSourceIds: ['trusted-b']
  });

  await assert.rejects(
    harness.runtime.deleteSources({ sourceIds: ['trusted-a', 'trusted-b'] }),
    error => error instanceof SourceManagementOperationError
  );

  // 断言内容: 释放链未完整完成时 Manager 事务不得开始，两个操作前 running 源均恢复为 running。
  assert.equal(harness.calls.includes('manager:deleteSources'), false);
  assert.equal(harness.hostStates.get('trusted-a').phase, 'running');
  assert.equal(harness.hostStates.get('trusted-b').phase, 'running');
  assert.deepEqual(
    harness.calls.filter(call => call.includes('dispose') || call.startsWith('runtime:ensure:')),
    [
      'host:dispose:trusted-a',
      'host:dispose:trusted-b',
      'runtime:ensure:trusted-a',
      'runtime:ensure:trusted-b'
    ]
  );
});

test('撤销、删除、恢复、缓存和更新统一经过正式生命周期入口', async () => {
  // 类型: object。
  // 作用: 保存覆盖多类设置意图的可控环境，验证全部操作委托正式端口、Manager 和 Host 入口。
  const harness = createManagementHarness({
    initialState: createState([
      createRecord({ id: 'trusted-a', enabled: true, sourceKind: 'custom', importMethod: 'remote' }),
      createRecord({ id: 'trusted-b', enabled: true })
    ], 'trusted-b'),
    runningSourceIds: ['trusted-a']
  });

  await harness.runtime.clearTemporarySourceCache('trusted-a');
  await harness.runtime.clearAllSourceCache('trusted-a');
  await harness.runtime.applySourceUpdate('trusted-a');
  await harness.runtime.revokeSourceAuthorization({ sourceId: 'trusted-a' });
  await harness.runtime.restoreSystemSources(['trusted-b']);
  await harness.runtime.deleteSources({ sourceIds: ['trusted-a'] });

  assert.equal(harness.calls.includes('manager:clearTemporarySourceCache'), true);
  assert.equal(harness.calls.includes('manager:clearAllSourceCache'), true);
  assert.equal(harness.calls.includes('port:candidate'), true);
  assert.equal(harness.calls.includes('adapter:update'), true);
  assert.equal(harness.calls.includes('manager:applySourceUpdate'), true);
  assert.equal(harness.calls.includes('manager:revokeSourceAuthorization'), true);
  assert.equal(harness.calls.includes('manager:restoreSystemSources'), true);
  assert.equal(harness.calls.includes('manager:deleteSources'), true);
});
