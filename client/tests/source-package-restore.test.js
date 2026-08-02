/*
  source-package-restore.test.js 模块说明

  - 文件职责:
      验证启动恢复协调器对系统源和自定义源执行同一保存脚本通道、隔离单源失败并释放本轮注册。
      使用可控 Repository、Loader 和注册端口观察顺序，不执行真实脚本或访问浏览器存储。

  - 导入库及文件汇总(3 条，内置 2 条，第三方 0 条，自定义 1 条):
      node:assert/strict: 内置断言，验证调用集合、失败摘要和释放结果。
      node:test: 内置测试运行器，声明异步恢复用例。
      createSourcePackageRestoreCoordinator: 自定义协调器，被测保存图恢复对象。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDefinition(sourceId, importMethod, sourceKind): 创建最小恢复 Definition。
      createPackage(definition): 创建与 Definition 关联的 Package。
      createAuthorization(definition, status): 创建当前或无效授权快照。
      createHarness(options): 创建可控保存图、Loader、注册端口和协调器。

  - 模块级类:
      无

  - 对外导出:
      无
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证恢复候选、摘要和清理集合。
import assert from 'node:assert/strict';

// 导入来源: node:test；导入内容: test；文件作用: 声明异步恢复协调器用例。
import test from 'node:test';

// 导入来源: ../src/runtime/source-package/sourcePackageRestoreCoordinator.js；导入内容: createSourcePackageRestoreCoordinator；文件作用: 创建被测恢复协调器。
import { createSourcePackageRestoreCoordinator } from '../src/runtime/source-package/sourcePackageRestoreCoordinator.js';

/**
 * 创建恢复协调器消费的最小 Definition。
 * 纯函数: 返回新对象，不共享可变嵌套字段。
 *
 * @param {string} sourceId 数据源身份。
 * @param {string} importMethod file、remote、text 或 builtin。
 * @param {string} sourceKind custom 或 system。
 * @returns {object} Definition 候选。
 */
function createDefinition(sourceId, importMethod, sourceKind = 'custom') {
  return {
    id: sourceId,
    sourceKind,
    version: '1.0.0',
    providerKey: `${sourceId}.provider`,
    packageRef: `source-package::${sourceId}`,
    importMethod
  };
}

/**
 * 创建和 Definition 身份一致的 Package。
 * 纯函数: 返回新 Package；脚本文本不由协调器读取或解释。
 *
 * @param {object} definition 关联 Definition。
 * @returns {object} Package 候选。
 */
function createPackage(definition) {
  return {
    packageRef: definition.packageRef,
    sourceId: definition.id,
    providerKey: definition.providerKey,
    integrity: { scriptHash: `${definition.id}-hash` },
    scriptContent: `script:${definition.id}`
  };
}

/**
 * 创建保存授权快照。
 * 纯函数: authorized 使用当前 Definition 与 Package 指纹；其他状态保留空快照。
 *
 * @param {object} definition 当前 Definition。
 * @param {object} sourcePackage 当前 Package。
 * @param {string} status authorized、pending 或 revoked。
 * @returns {object} 授权对象。
 */
function createAuthorization(definition, sourcePackage, status) {
  return {
    status,
    authorizedAt: status === 'authorized' ? '2026-07-21T00:00:00.000Z' : '',
    authorizedVersion: status === 'authorized' ? definition.version : '',
    authorizedScriptHash: status === 'authorized' ? sourcePackage.integrity.scriptHash : ''
  };
}

/**
 * 创建可控恢复环境。
 * 副作用: 闭包保存 Loader 调用、注册 Map 和移除顺序，不访问外部系统。
 *
 * @returns {object} coordinator、restoreCalls、registeredFactories 和 removedProviderKeys。
 */
function createHarness() {
  // 类型: Array<object>；作用: 覆盖系统源、三入口自定义源和无效授权候选。
  const definitions = [
    createDefinition('system-source', 'builtin', 'system'),
    createDefinition('file-source', 'file'),
    createDefinition('remote-source', 'remote'),
    createDefinition('text-source', 'text')
  ];
  // 类型: Array<object>；作用: 为每条 Definition 提供同引用 Package。
  const packages = definitions.map(createPackage);
  // 类型: object；作用: 保存 file/remote 有效授权和 text pending 决定。
  const preferences = {
    sourceStates: Object.fromEntries(definitions.map((definition, index) => [
      definition.id,
      {
        authorization: createAuthorization(
          definition,
          packages[index],
          definition.id === 'text-source' ? 'pending' : 'authorized'
        )
      }
    ]))
  };
  // 类型: Array<string>；作用: 记录实际进入 Loader 的 sourceId，证明系统源共用通道且无效自定义授权不执行。
  const restoreCalls = [];
  // 类型: Map<string, object>；作用: 模拟 Registry 当前动态工厂集合。
  const registeredFactories = new Map();
  // 类型: Array<string>；作用: 记录 releaseAll 的逆序移除结果。
  const removedProviderKeys = [];

  // 类型: Readonly<object>；作用: 使用冻结四依赖创建被测协调器。
  const coordinator = createSourcePackageRestoreCoordinator({
    packageRepository: {
      /**
       * 向恢复协调器返回当前测试保存的全部 Package。
       * 副作用: 无；返回结构化克隆，避免协调器修改夹具原值。
       * 成功路径: resolve Package 隔离数组。
       * 失败路径: 本夹具不注入读取失败。
       *
       * @returns {Promise<Array<object>>} 当前保存的 Package 列表。
       */
      async loadAll() { return structuredClone(packages); }
    },
    definitionRepository: {
      /**
       * 向恢复协调器返回当前测试保存的全部 Definition。
       * 副作用: 无；返回结构化克隆，避免协调器修改夹具原值。
       * 成功路径: resolve Definition 隔离数组。
       * 失败路径: 本夹具不注入读取失败。
       *
       * @returns {Promise<Array<object>>} 当前保存的 Definition 列表。
       */
      async loadDefinitions() { return structuredClone(definitions); },
      /**
       * 向恢复协调器返回当前测试保存的 Preferences。
       * 副作用: 无；返回结构化克隆，确保授权判断不污染夹具。
       * 成功路径: resolve 含 sourceStates 的隔离对象。
       * 失败路径: 本夹具不注入读取失败。
       *
       * @returns {Promise<object>} 当前保存的 Preferences。
       */
      async loadPreferences() { return structuredClone(preferences); }
    },
    sourcePackageLoader: {
      /**
       * 模拟 Loader 从已保存 Package 恢复 ProviderFactory。
       * 副作用: 记录执行 sourceId；remote-source 注入模块执行失败。
       * 成功路径: 返回 providerKey 与保存包一致的冻结工厂。
       * 失败路径: remote-source 抛出带 code 和 stage 的稳定错误。
       *
       * @param {object} sourcePackage 当前 Definition 关联的保存包。
       * @param {object} sourceDefinition 当前待恢复的自定义源定义。
       * @returns {Promise<Readonly<object>>} 可注册的模拟 ProviderFactory。
       * @throws {Error} remote-source 用于验证单源失败隔离。
       */
      async restore(sourcePackage, sourceDefinition) {
        restoreCalls.push(sourceDefinition.id);
        // 条件分支: remote 候选注入独立恢复失败时进入。
        // 执行内容: 验证失败不会阻断 file 候选或注册半成品。
        if (sourceDefinition.id === 'remote-source') {
          throw Object.assign(new Error('remote restore failed'), {
            code: 'SOURCE_PACKAGE_MODULE_INVALID',
            stage: 'execute'
          });
        }
        return Object.freeze({ providerKey: sourcePackage.providerKey });
      }
    },
    providerFactoryRegistrationPort: {
      /**
       * 模拟 Registry 注册动态 ProviderFactory。
       * 副作用: 把 providerKey 与工厂写入本用例 Map。
       * 成功路径: 注册后可由断言观察对应键。
       * 失败路径: 本夹具不注入注册冲突。
       *
       * @param {string} providerKey 当前 Definition 声明的工厂键。
       * @param {Readonly<object>} providerFactory Loader 恢复的冻结工厂。
       * @returns {void}
       */
      register(providerKey, providerFactory) {
        registeredFactories.set(providerKey, providerFactory);
      },
      /**
       * 模拟 Registry 释放本协调器拥有的动态工厂。
       * 副作用: 记录释放顺序，并从本用例 Map 删除对应键。
       * 成功路径: 已注册键被移除；不存在的键保持幂等。
       * 失败路径: 本夹具不注入移除失败。
       *
       * @param {string} providerKey 待释放的动态工厂键。
       * @returns {void}
       */
      remove(providerKey) {
        removedProviderKeys.push(providerKey);
        registeredFactories.delete(providerKey);
      }
    }
  });
  return { coordinator, restoreCalls, registeredFactories, removedProviderKeys };
}

test('恢复协调器统一恢复系统与自定义保存脚本并释放本轮动态注册', async () => {
  // 类型: object；作用: 保存当前用例独占协调器和可观测集合。
  const harness = createHarness();
  // 类型: object；作用: 保存恢复成功键与安全失败摘要。
  const result = await harness.coordinator.restore();

  // 断言作用: builtin 系统源不再走静态工厂旁路，必须先于三入口自定义源进入同一个 Loader。
  assert.deepEqual(harness.restoreCalls, ['system-source', 'file-source', 'remote-source']);
  assert.deepEqual(result.restoredProviderKeys, ['system-source.provider', 'file-source.provider']);
  assert.equal(result.failures.length, 1);
  assert.deepEqual(result.failures[0], {
    sourceId: 'remote-source',
    providerKey: 'remote-source.provider',
    code: 'SOURCE_PACKAGE_MODULE_INVALID',
    stage: 'execute',
    message: 'remote restore failed'
  });
  assert.deepEqual(
    [...harness.registeredFactories.keys()],
    ['system-source.provider', 'file-source.provider']
  );

  await harness.coordinator.releaseAll();
  // 断言作用: 系统和自定义动态工厂都归恢复协调器所有，并按注册逆序完整释放。
  assert.deepEqual(harness.removedProviderKeys, ['file-source.provider', 'system-source.provider']);
  assert.equal(harness.registeredFactories.size, 0);
  await harness.coordinator.releaseAll();
  assert.deepEqual(harness.removedProviderKeys, ['file-source.provider', 'system-source.provider']);
});
