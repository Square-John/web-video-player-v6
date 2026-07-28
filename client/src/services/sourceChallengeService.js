/*
  sourceChallengeService.js 模块说明

  - 文件职责:
      向根级 Vue 组件提供全局挑战的订阅、提交和取消入口。
      在页面响应式状态进入 Runtime 前生成普通输入快照，不缓存挑战、不接触 Provider 或 SourceContext。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      sourceChallengeInteractionInstance: 自定义 Runtime 单例，提供冻结挑战交互窄端口。

  - 模块级常量:
      sourceChallengeService: object，页面可使用的冻结挑战服务。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createEnumerableValuesSnapshot(values): Function，把 Vue 表单候选隔离为只含可枚举自有字段的普通对象。
      createSourceChallengeService(interactionPort): Function，创建可注入交互端口的冻结挑战服务。

  - 模块级类:
      无

  - 对外导出:
      createSourceChallengeService: Function，供应用组合和领域测试创建统一交互门面。
      sourceChallengeService: object，根级弹窗使用的订阅、提交和取消门面。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceChallengeInteractionInstance 应用唯一挑战交互端口。
// 文件作用: 页面只经 service 使用订阅、提交和取消，不直接导入 Runtime 组合模块。
import { sourceChallengeInteractionInstance } from '../runtime/sourceRuntimeInstance.js';

/**
 * 把页面挑战输入隔离为纯协议候选。
 * 纯函数: 对普通对象复制全部可枚举字符串和 Symbol 自有字段，不复用 Vue 响应式对象引用。
 * 成功路径: Vue 2 的不可枚举观察元数据不会进入 Runtime，真实可枚举额外字段仍保留给 Shell 拒绝。
 * 失败路径: 非普通对象保持原值交给 Shell 产生统一 validation；可枚举 getter 抛错时原样传播。
 *
 * @param {*} values 页面挑战表单候选。
 * @returns {*} 普通冻结输入快照，或需要由 Shell 拒绝的原候选。
 */
function createEnumerableValuesSnapshot(values) {
  // 条件分支: 非对象或数组不属于页面字段映射。
  // 执行内容: 保持原候选，让 Runtime 的唯一契约校验器生成稳定错误。
  if (!values || typeof values !== 'object' || Array.isArray(values)) return values;

  // 类型: object|null。
  // 作用: 区分普通字段映射与类实例，避免 service 把非法实例洗成可接受对象。
  const prototype = Object.getPrototypeOf(values);
  // 条件分支: 候选不是普通对象或 null 原型字段映射时进入。
  // 执行内容: 保持原型信息并交给 Runtime 拒绝，不在页面层放宽对象契约。
  if (prototype !== Object.prototype && prototype !== null) return values;

  // 类型: Array<string|symbol>。
  // 作用: 只选择页面真实可提交的自有字段；不可枚举框架元数据不属于协议输入。
  const enumerableKeys = Reflect.ownKeys(values).filter((key) => {
    // 类型: PropertyDescriptor|undefined。
    // 作用: 读取当前自有字段的可枚举语义，不按 Vue 私有字段名称写兼容分支。
    const descriptor = Object.getOwnPropertyDescriptor(values, key);
    return descriptor?.enumerable === true;
  });

  // 类型: object。
  // 作用: 使用 Object.fromEntries 创建 Object.prototype 普通对象，同时安全保留 __proto__ 和 Symbol 等可枚举越界键。
  const snapshot = Object.fromEntries(enumerableKeys.map(key => [key, values[key]]));
  return Object.freeze(snapshot);
}

/**
 * 创建页面可使用的统一挑战交互服务。
 * 纯函数: 只捕获注入端口并返回冻结门面，不订阅、不缓存活动挑战或用户输入。
 * 成功路径: subscribe/cancel 原样委托；resolve 先隔离页面值，再兑现原 Provider Promise。
 * 失败路径: 端口身份、挑战字段和值错误由协调器和 Shell 统一抛出，不在 service 转换错误类型。
 *
 * @param {object} interactionPort 应用挑战协调器的订阅、提交和取消窄端口。
 * @returns {object} 冻结挑战 service。
 */
export function createSourceChallengeService(interactionPort) {
  return Object.freeze({
    /**
     * 订阅应用当前活动挑战。
     * 副作用: 注册一个同步 Runtime 监听器，并立即收到当前挑战或 null。
     * 资源清理: 调用方必须在组件销毁时执行返回的取消函数。
     *
     * @param {Function} listener 根级组件的挑战采用函数。
     * @returns {Function} 幂等取消订阅函数。
     */
    subscribe(listener) {
      return interactionPort.subscribe(listener);
    },

    /**
     * 提交当前挑战输入。
     * 副作用: 生成不含框架私有元数据的普通快照，兑现原 Provider Promise 并推进 FIFO。
     * 成功路径: 返回冻结 resolved 结果；可枚举字段仍由 Shell 对照挑战声明严格校验。
     * 失败路径: 身份、对象或字段不合法时抛稳定 Shell validation，原活动项保持可重试。
     *
     * @param {string} challengeId 当前弹窗展示的挑战标识。
     * @param {object} values 当前 Vue 表单字符串值。
     * @returns {object} 冻结 SourceChallengeResult。
     */
    resolve(challengeId, values) {
      // 类型: object|*。
      // 作用: 切断 Vue 响应式引用；非法非普通输入保持原值，由 Runtime 统一拒绝。
      const valuesSnapshot = createEnumerableValuesSnapshot(values);
      return interactionPort.resolve(challengeId, valuesSnapshot);
    },

    /**
     * 取消当前活动挑战。
     * 副作用: 兑现原 Provider Promise 为 cancelled，并推进 FIFO。
     * 成功路径: 返回冻结 cancelled 结果。
     * 失败路径: 身份迟到或不一致时抛稳定 Shell validation，不取消其他挑战。
     *
     * @param {string} challengeId 当前弹窗展示的挑战标识。
     * @returns {object} 冻结 SourceChallengeResult。
     */
    cancel(challengeId) {
      return interactionPort.cancel(challengeId);
    }
  });
}

// 类型: object。
// 作用: 给根级挑战组件提供应用唯一稳定服务边界；不保存第二份活动挑战或用户输入。
export const sourceChallengeService = createSourceChallengeService(sourceChallengeInteractionInstance);
