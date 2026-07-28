/*
  sourceChallengeService.js 模块说明

  - 文件职责:
      向根级 Vue 组件提供全局挑战的订阅、提交和取消入口。
      只转发应用唯一交互端口，不缓存挑战、不接触 Provider 或 SourceContext。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      sourceChallengeInteractionInstance: 自定义 Runtime 单例，提供冻结挑战交互窄端口。

  - 模块级常量:
      sourceChallengeService: object，页面可使用的冻结挑战服务。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      sourceChallengeService: object，根级弹窗使用的订阅、提交和取消门面。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceChallengeInteractionInstance 应用唯一挑战交互端口。
// 文件作用: 页面只经 service 使用订阅、提交和取消，不直接导入 Runtime 组合模块。
import { sourceChallengeInteractionInstance } from '../runtime/sourceRuntimeInstance.js';

// 类型: object。
// 作用: 给根级挑战组件提供稳定服务边界；不保存第二份活动挑战或用户输入。
export const sourceChallengeService = Object.freeze({
  /**
   * 订阅应用当前活动挑战。
   * 副作用: 注册一个同步 Runtime 监听器，并立即收到当前挑战或 null。
   * 资源清理: 调用方必须在组件销毁时执行返回的取消函数。
   *
   * @param {Function} listener 根级组件的挑战采用函数。
   * @returns {Function} 幂等取消订阅函数。
   */
  subscribe(listener) {
    return sourceChallengeInteractionInstance.subscribe(listener);
  },

  /**
   * 提交当前挑战输入。
   * 副作用: 兑现原 Provider 正在等待的 challenge.request Promise，并推进 FIFO。
   * 成功路径: 返回冻结 resolved 结果。
   * 失败路径: 身份或字段不合法时抛稳定 Shell validation，原活动项保持可重试。
   *
   * @param {string} challengeId 当前弹窗展示的挑战标识。
   * @param {object} values 当前表单字符串值。
   * @returns {object} 冻结 SourceChallengeResult。
   */
  resolve(challengeId, values) {
    return sourceChallengeInteractionInstance.resolve(challengeId, values);
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
    return sourceChallengeInteractionInstance.cancel(challengeId);
  }
});
