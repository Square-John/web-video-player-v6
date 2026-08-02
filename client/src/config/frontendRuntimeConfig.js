/*
  frontendRuntimeConfig.js 模块说明

  - 文件职责:
      在 Vue、IndexedDB、SourceRuntime 和 Provider 模块加载前，读取并校验外部 frontend.config.js 发布的完整配置。
      把通过完整契约的 runtime 分区保存为当前页面唯一 FrontendRuntimeConfig，供 ProxyClient 在应用组合阶段读取。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      createFrontendRuntimeConfig: 自定义契约函数，校验完整公开配置并生成最小运行时投影。

  - 模块级常量:
      FRONTEND_CONFIG_GLOBAL_KEY: string，外部配置脚本发布完整配置使用的全局键。

  - 模块级变量:
      adoptedRuntimeConfig: Readonly<object>|null，当前页面已经采用的冻结运行时投影；只允许初始化一次。

  - 模块级辅助函数:
      initializeFrontendRuntimeConfig(): 读取外部配置并建立唯一冻结投影。
      getFrontendRuntimeConfig(): 返回已采用投影，阻止网络层在启动屏障前创建。

  - 模块级类:
      无

  - 对外导出:
      initializeFrontendRuntimeConfig: function，启动前采用外部配置。
      getFrontendRuntimeConfig: function，向 ProxyClient 提供当前页面唯一后端 origin。
*/

// 导入来源: ../../../scripts/startup/configContracts.mjs。
// 导入内容: createFrontendRuntimeConfig。
// 文件作用: 复用根配置唯一完整校验和 runtime 最小投影规则，不在浏览器层复制第二套字段契约。
import { createFrontendRuntimeConfig } from '../../../scripts/startup/configContracts.mjs';

// 类型: string；来源: 根 config/frontend.config.js 与页面启动协议；作用: 连接外部公开配置脚本和前端启动屏障。
const FRONTEND_CONFIG_GLOBAL_KEY = '__WVP_FRONTEND_CONFIG__';

// 类型: Readonly<object>|null；作用: 保存当前页面启动采用的后端 origin；null 表示配置屏障尚未成功完成。
let adoptedRuntimeConfig = null;

/**
 * 采用外部前端运行配置。
 * 副作用: 读取并删除 globalThis 上的完整公开配置引用，避免业务模块继续直接访问外部配置对象。
 * 成功路径: 返回并保存冻结 FrontendRuntimeConfig；同一页面重复调用会返回同一对象，不重复读取或重置状态。
 * 失败路径: 配置全局缺失或字段非法时抛出契约错误，调用方不得继续初始化应用。
 *
 * @param {*} [candidate=globalThis.__WVP_FRONTEND_CONFIG__] 浏览器外部配置候选；Node 测试前置可显式注入同一根配置。
 * @returns {Readonly<object>} 当前页面采用的 FrontendRuntimeConfig。
 * @throws {Error} 外部配置缺失或不符合完整配置契约时抛出稳定配置错误。
 */
export function initializeFrontendRuntimeConfig(candidate = globalThis[FRONTEND_CONFIG_GLOBAL_KEY]) {
  // 条件分支: 当前页面已经完成配置采用时进入。
  // 执行内容: 返回已冻结对象，避免热替换或第二份配置覆盖正在使用的网络事实。
  if (adoptedRuntimeConfig) {
    return adoptedRuntimeConfig;
  }

  try {
    // 副作用: 只在校验前读取全局引用；完整校验通过后继续删除该公开对象，收窄业务可见边界。
    adoptedRuntimeConfig = createFrontendRuntimeConfig(candidate);
  } finally {
    // 清理边界: 无论校验成功或失败，都不让后续应用模块把完整配置当成业务状态读取。
    Reflect.deleteProperty(globalThis, FRONTEND_CONFIG_GLOBAL_KEY);
  }

  return adoptedRuntimeConfig;
}

/**
 * 读取已经采用的前端运行时配置。
 * 纯函数: 只返回启动屏障建立的冻结引用，不读取全局、文件、环境变量或浏览器存储。
 * 成功路径: 返回当前页面唯一 backendOrigin 投影。
 * 失败路径: 启动屏障尚未完成时抛错，阻止 ProxyClient 或 SourceRuntime 提前创建。
 *
 * @returns {Readonly<object>} 当前页面 FrontendRuntimeConfig。
 * @throws {Error} 尚未完成配置采用时抛出启动顺序错误。
 */
export function getFrontendRuntimeConfig() {
  // 条件分支: 配置屏障尚未成功时进入。
  // 执行内容: 失败关闭，禁止网络层使用默认地址、环境变量或旧内存值。
  if (!adoptedRuntimeConfig) {
    throw new Error('前端运行配置尚未完成启动校验');
  }

  return adoptedRuntimeConfig;
}
