/*
  sourcePackageModuleExecutor.js 模块说明

  - 文件职责:
      在用户信任和静态预检通过后，执行同一份规范化单文件模块文本。
      当前浏览器实现使用 Blob URL 和原生 dynamic import，并在成功或失败后立即撤销 URL。
      本模块不读取远程地址、不校验 manifest、不注册工厂、不写 Repository；未来沙盒只替换本端口。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      SOURCE_PACKAGE_ERROR_CODE、SOURCE_PACKAGE_LOAD_STAGE、SOURCE_PACKAGE_POLICY: 自定义配置，提供执行错误、阶段和脚本文本媒体类型编码。
      createSourcePackageLoadError: 自定义错误工厂，把浏览器执行失败转换为安全错误。

  - 模块级常量:
      SOURCE_PACKAGE_MODULE_EXECUTOR_PUBLIC_METHODS: Array<string>，执行端口公开方法集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createBrowserSourcePackageModuleExecutor(): 创建只公开 execute 的浏览器模块执行端口。

  - 模块级类:
      无

  - 对外导出:
      createBrowserSourcePackageModuleExecutor(): Function，创建 Blob URL 模块执行器。
*/

import {
  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_ERROR_CODE 稳定错误码。
  // 文件作用: 浏览器动态 import 失败统一分类为 load。
  SOURCE_PACKAGE_ERROR_CODE,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_LOAD_STAGE 执行阶段枚举。
  // 文件作用: 错误明确发生在 execute，而不是静态 validate。
  SOURCE_PACKAGE_LOAD_STAGE,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_POLICY 统一文本编码策略。
  // 文件作用: Blob 声明与三入口读取相同的 UTF-8 文本语义。
  SOURCE_PACKAGE_POLICY
} from './sourcePackage.config.js';

// 导入来源: ./sourcePackageErrors.js。
// 导入内容: createSourcePackageLoadError 安全错误工厂。
// 文件作用: 不把 dynamic import 原始异常、URL 或脚本文本带到页面。
import { createSourcePackageLoadError } from './sourcePackageErrors.js';

// 类型: Array<string>。
// 作用: 模块执行端口只公开 execute，不能泄漏 Blob、URL 或资源清理方法。
const SOURCE_PACKAGE_MODULE_EXECUTOR_PUBLIC_METHODS = Object.freeze(['execute']);

/**
 * 创建浏览器单文件模块执行端口。
 * 副作用: 每次 execute 创建一个 Blob 和对象 URL，动态导入后在 finally 中撤销 URL。
 * 成功路径: 返回浏览器 Module Namespace；加载器继续执行精确导出与工厂校验。
 * 失败路径: 浏览器能力缺失或模块执行失败抛安全 SOURCE_PACKAGE_LOAD_ERROR。
 *
 * @returns {object} 只公开 execute(scriptContent) 的冻结端口。
 */
export function createBrowserSourcePackageModuleExecutor() {
  /**
   * 执行已经预检并获用户信任的规范化模块文本。
   * 副作用: 在当前前端上下文执行脚本；创建的对象 URL 无论成功失败都立即撤销。
   * 成功路径: resolve Module Namespace，不缓存脚本文本或 URL。
   * 失败路径: 输入或浏览器模块加载失败使用稳定 load/execute 错误。
   *
   * @param {*} scriptContent 已规范化且与用户确认哈希一致的完整脚本文本。
   * @returns {Promise<object>} 浏览器 Module Namespace。
   */
  async function execute(scriptContent) {
    // 条件分支: 输入不是非空字符串时进入。
    // 执行内容: 在创建 Blob 前失败，不执行隐式字符串转换。
    if (typeof scriptContent !== 'string' || scriptContent.trim() === '') {
      throw createSourcePackageLoadError({
        code: SOURCE_PACKAGE_ERROR_CODE.load,
        stage: SOURCE_PACKAGE_LOAD_STAGE.execute,
        message: '待执行的数据源脚本文本无效。',
        field: 'scriptContent'
      });
    }

    // 条件分支: 当前环境缺少 Blob 或对象 URL 能力时进入。
    // 执行内容: 明确失败；非浏览器调用方应注入替代端口，正式运行不能回退 eval 或 data URL。
    if (typeof Blob !== 'function'
      || typeof URL !== 'function'
      || typeof URL.createObjectURL !== 'function'
      || typeof URL.revokeObjectURL !== 'function') {
      throw createSourcePackageLoadError({
        code: SOURCE_PACKAGE_ERROR_CODE.load,
        stage: SOURCE_PACKAGE_LOAD_STAGE.execute,
        message: '当前环境不支持受控数据源模块加载。',
        field: 'module'
      });
    }

    // 类型: Blob。
    // 作用: 使用同一规范化脚本文本创建一次 JavaScript 模块资源，不读取远程 URL 或另一份内容。
    const moduleBlob = new Blob([scriptContent], {
      type: `text/javascript;charset=${SOURCE_PACKAGE_POLICY.textEncoding}`
    });

    // 类型: string。
    // 作用: 创建仅供本次原生 dynamic import 使用的临时浏览器对象 URL。
    const moduleUrl = URL.createObjectURL(moduleBlob);

    try {
      // 异步调用: 原生模块加载器执行用户已经确认的同一文本。
      // resolve: 返回 Module Namespace 供加载器精确校验。
      // reject: 转换为安全 load 错误，不回退 eval、Function、远程地址或另一执行方式。
      return await import(/* @vite-ignore */ moduleUrl);
    } catch (error) {
      throw createSourcePackageLoadError({
        error,
        code: SOURCE_PACKAGE_ERROR_CODE.load,
        stage: SOURCE_PACKAGE_LOAD_STAGE.execute,
        message: '数据源模块执行失败。',
        field: 'module'
      });
    } finally {
      // 资源清理: 无论模块成功还是失败都撤销对象 URL；已返回命名空间不依赖 URL 继续存在。
      URL.revokeObjectURL(moduleUrl);
    }
  }

  // 类型: object。
  // 作用: 冻结执行端口，调用方不能替换 execute 或取得浏览器资源引用。
  const executor = Object.freeze({ execute });

  // 条件分支: 公开字段数量或顺序不符合冻结端口时进入。
  // 执行内容: 构造阶段失败，防止资源管理辅助能力泄漏。
  if (Object.keys(executor).length !== SOURCE_PACKAGE_MODULE_EXECUTOR_PUBLIC_METHODS.length
    || Object.keys(executor).some(
      (methodName, index) => methodName !== SOURCE_PACKAGE_MODULE_EXECUTOR_PUBLIC_METHODS[index]
    )) {
    throw new TypeError('SourcePackageModuleExecutor 公开方法无效');
  }

  return executor;
}
