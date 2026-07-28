/*
  sourcePackageRestoreCoordinator.js 模块说明

  - 文件职责:
      在 SourceManager 初始化前读取保存图，筛选当前授权有效的系统与自定义包并恢复动态 ProviderFactory。
      单源失败只留下不可运行候选；整体启动失败时可撤销本轮全部注册，不修改 Repository 保存对象。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      evaluateSourceAuthorizationFingerprint: 自定义授权工具，按版本和脚本指纹复核用户授权。
      cloneSerializableValue: 自定义工具，隔离恢复摘要和失败结果。

  - 模块级常量:
      RESTORE_DEPENDENCY_FIELDS: Array<string>，协调器精确依赖字段。
      RESTORE_PUBLIC_METHODS: Array<string>，协调器公开方法顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeDependencies(dependencies): 校验 Repository、Loader 和注册端口最小能力。
      createFailure(sourceDefinition, error): 创建不含脚本和堆栈的失败摘要。

  - 模块级类:
      无

  - 对外导出:
      createSourcePackageRestoreCoordinator: Function，创建 restore/releaseAll 冻结协调器。
*/

// 导入来源: ../../utils/sourceAuthorization.js；导入内容: evaluateSourceAuthorizationFingerprint；文件作用: 脚本执行前复核当前授权快照。
import { evaluateSourceAuthorizationFingerprint } from '../../utils/sourceAuthorization.js';

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js；导入内容: cloneSerializableValue；文件作用: 隔离对外恢复摘要。
import { cloneSerializableValue } from '../../repositories/source/sourceRepositoryUtils.js';

// 类型: Array<string>；作用: 协调器只接受三仓读取、Loader 和注册窄端口，不获得 Manager 或 Host。
const RESTORE_DEPENDENCY_FIELDS = Object.freeze([
  'packageRepository',
  'definitionRepository',
  'sourcePackageLoader',
  'providerFactoryRegistrationPort'
]);

// 类型: Array<string>；作用: 只公开恢复和本轮注册释放，不泄漏 Set 或依赖对象。
const RESTORE_PUBLIC_METHODS = Object.freeze(['restore', 'releaseAll']);

/**
 * 校验恢复协调器依赖。
 * 纯函数: 只检查精确字段与最小方法，不调用或修改依赖。
 *
 * @param {*} dependencies 协调器依赖候选。
 * @returns {Readonly<object>} 已验证冻结浅层依赖。
 * @throws {TypeError} 字段或公开方法不完整时抛出。
 */
function normalizeDependencies(dependencies) {
  // 条件分支: 依赖不是精确普通对象时进入。
  // 执行内容: 阻止 Registry、数据库连接或备用实现进入协调器。
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)
    || Object.getPrototypeOf(dependencies) !== Object.prototype
    || Object.keys(dependencies).length !== RESTORE_DEPENDENCY_FIELDS.length
    || Object.keys(dependencies).some(field => !RESTORE_DEPENDENCY_FIELDS.includes(field))) {
    throw new TypeError('SourcePackageRestoreCoordinator dependencies 无效');
  }

  // 类型: object；作用: 固定四项依赖各自允许的最小公开方法集合。
  const methodRequirements = {
    packageRepository: ['loadAll'],
    definitionRepository: ['loadDefinitions', 'loadPreferences'],
    sourcePackageLoader: ['restore'],
    providerFactoryRegistrationPort: ['register', 'remove']
  };
  // 循环作用: 逐项确认恢复链只依赖正式公开方法。
  Object.entries(methodRequirements).forEach(([fieldName, methodNames]) => {
    // 类型: object；作用: 保存当前待检查 Repository、Loader 或注册端口。
    const dependency = dependencies[fieldName];
    // 条件分支: 当前依赖缺失或任一正式方法不是函数时进入。
    // 执行内容: 构造阶段失败，不返回部分协调器。
    if (!dependency || typeof dependency !== 'object'
      || methodNames.some(methodName => typeof dependency[methodName] !== 'function')) {
      throw new TypeError(`SourcePackageRestoreCoordinator.${fieldName} 无效`);
    }
  });
  return Object.freeze({ ...dependencies });
}

/**
 * 创建安全单源恢复失败摘要。
 * 纯函数: 不保留脚本文本、工厂、堆栈或错误引用。
 *
 * @param {object} sourceDefinition 当前失败 Definition。
 * @param {*} error Loader 或注册端口失败。
 * @returns {Readonly<object>} sourceId、providerKey、code、stage 和 message 摘要。
 */
function createFailure(sourceDefinition, error) {
  return Object.freeze({
    sourceId: sourceDefinition.id,
    providerKey: sourceDefinition.providerKey,
    code: typeof error?.code === 'string' ? error.code : 'SOURCE_PACKAGE_RESTORE_FAILED',
    stage: typeof error?.stage === 'string' ? error.stage : 'restore',
    message: typeof error?.message === 'string' ? error.message : '已保存数据源恢复失败。'
  });
}

/**
 * 创建启动期动态 Provider 恢复协调器。
 * 副作用: 只创建当前 Bundle 私有注册键集合，不读取或执行保存图。
 * 状态所有权: 只保存本轮成功注册的 providerKey 集合，releaseAll 后清空。
 * 并发边界: 调用方使用 Runtime 单一初始化 Promise 串行 restore/releaseAll。
 *
 * @param {object} dependencies Repository、Loader 和注册窄端口。
 * @returns {Readonly<object>} restore 与 releaseAll 门面。
 */
export function createSourcePackageRestoreCoordinator(dependencies) {
  // 类型: Readonly<object>；作用: 保存字段和方法完整的四项恢复依赖。
  const safeDependencies = normalizeDependencies(dependencies);
  // 类型: Set<string>；生命周期: 当前 Runtime Bundle；作用: 精确记录本协调器成功注册且有权释放的动态工厂。
  const registeredProviderKeys = new Set();

  /**
   * 恢复当前保存图中授权有效的全部系统与自定义 ProviderFactory。
   * 副作用: 读取三类保存对象、执行有效脚本并注册工厂；不修改 Repository 或启动 Provider。
   * 成功路径: 返回成功键和逐源失败摘要；单源失败不阻断其他候选。
   * 失败路径: Repository 整体读取失败直接 reject，由 Runtime 执行 releaseAll 并停止 Manager 初始化。
   *
   * @returns {Promise<object>} restoredProviderKeys 与 failures 隔离摘要。
   */
  async function restore() {
    // 类型: Array<object>；作用: 读取完整隔离 Package 集合，损坏记录由 Repository 失败关闭。
    const packages = await safeDependencies.packageRepository.loadAll();
    // 类型: Array<object>；作用: 读取完整隔离 Definition 集合并保持 Repository 顺序。
    const definitions = await safeDependencies.definitionRepository.loadDefinitions();
    // 类型: object；作用: 读取唯一用户启用与授权快照，不从页面或 store 推断决定。
    const preferences = await safeDependencies.definitionRepository.loadPreferences();
    // 类型: Map<string, object>；作用: 按 packageRef 精确定位 Definition 关联包。
    const packagesByRef = new Map(packages.map(sourcePackage => [sourcePackage.packageRef, sourcePackage]));
    // 类型: Array<object>；作用: 收集逐源安全失败摘要，继续恢复其他独立候选。
    const failures = [];

    for (const sourceDefinition of definitions) {
      // 类型: object|undefined；作用: 按 Definition.packageRef 定位当前候选脚本包。
      const sourcePackage = packagesByRef.get(sourceDefinition.packageRef);
      // 类型: object|undefined；作用: 读取当前 sourceId 保存的用户授权快照。
      const authorization = preferences.sourceStates[sourceDefinition.id]?.authorization;
      // 类型: object；作用: 使用当前 Definition 版本、Package 指纹和保存授权快照评估执行资格。
      const authorizationState = evaluateSourceAuthorizationFingerprint({
        sourceKind: sourceDefinition.sourceKind,
        version: sourceDefinition.version,
        currentScriptHash: sourcePackage?.integrity?.scriptHash || '',
        authorization
      });
      // 条件分支: 包缺失或授权并非当前版本与哈希的有效授权时进入。
      // 执行内容: 不执行脚本；系统源缺包与自定义源授权失效都由 Manager 投影为 unavailable。
      if (!sourcePackage || authorizationState.isAuthorized !== true) continue;

      try {
        // 类型: object；作用: 保存 Loader 完整复核后返回的冻结 ProviderFactory。
        const providerFactory = await safeDependencies.sourcePackageLoader.restore(
          sourcePackage,
          sourceDefinition
        );
        safeDependencies.providerFactoryRegistrationPort.register(
          sourceDefinition.providerKey,
          providerFactory
        );
        // 副作用: 只在注册成功后取得当前键所有权；注册冲突不会误删既有工厂。
        registeredProviderKeys.add(sourceDefinition.providerKey);
      } catch (error) {
        failures.push(createFailure(sourceDefinition, error));
      }
    }

    return Object.freeze({
      restoredProviderKeys: Object.freeze([...registeredProviderKeys]),
      failures: Object.freeze(cloneSerializableValue(failures, 'sourcePackageRestoreFailures'))
    });
  }

  /**
   * 释放本协调器在当前启动轮成功注册的全部动态工厂。
   * 副作用: 按注册逆序调用 remove 并清空所有权集合；不释放系统工厂或其他 Runtime 注册。
   * 成功路径: 全部移除完成；重复调用幂等。
   * 失败路径: remove 同步失败时继续清理其余键并在结束后抛出首个错误。
   *
   * @returns {Promise<void>} 本轮注册集合清空后完成。
   */
  async function releaseAll() {
    // 类型: Array<string>；作用: 以注册逆序释放本协调器拥有的动态工厂键。
    const providerKeys = [...registeredProviderKeys].reverse();
    // 类型: *|null；作用: 保留首个移除失败，同时继续清理其余本轮键。
    let firstError = null;
    for (const providerKey of providerKeys) {
      try {
        safeDependencies.providerFactoryRegistrationPort.remove(providerKey);
      } catch (error) {
        // 条件分支: 当前是本轮第一个移除失败时进入。
        // 执行内容: 保存原始错误，后续失败不覆盖首个 cause。
        if (firstError === null) firstError = error;
      } finally {
        registeredProviderKeys.delete(providerKey);
      }
    }
    // 条件分支: 至少一个注册移除失败时进入。
    // 执行内容: 全部键清理尝试结束后把首个失败交给 Runtime 启动链。
    if (firstError) throw firstError;
  }

  // 类型: Readonly<object>；作用: 创建只含 restore/releaseAll 的冻结公开门面。
  const coordinator = Object.freeze({ restore, releaseAll });
  // 条件分支: 公开方法数量、顺序或名称偏离冻结集合时进入。
  // 执行内容: 构造阶段失败，阻止内部状态或遗漏方法进入 Runtime。
  if (Object.keys(coordinator).length !== RESTORE_PUBLIC_METHODS.length
    || Object.keys(coordinator).some((methodName, index) => methodName !== RESTORE_PUBLIC_METHODS[index])) {
    throw new TypeError('SourcePackageRestoreCoordinator 公开方法无效');
  }
  return coordinator;
}
