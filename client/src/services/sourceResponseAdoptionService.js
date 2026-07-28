/*
  sourceResponseAdoptionService.js 模块说明

  - 文件职责:
      为内容和筛选 service 提供统一响应身份复查规则。
      区分显式内容身份请求与跟随活动源的普通页面请求，阻止旧活动源响应在切换完成后覆盖新页面状态。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      sourceRuntimeInstance: 自定义应用单例，读取唯一 SourceManager 最新隔离投影。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeSourceIdentity(value): 把身份候选收敛为去空白字符串。

  - 模块级类:
      无

  - 对外导出:
      isSourceResponseAdoptable: Function，使用给定 Manager 投影执行纯响应采用判断。
      shouldAdoptSourceResponse: Function，必要时读取最新 Manager 投影并返回采用判断。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceRuntimeInstance 应用唯一内容 Runtime 门面。
// 文件作用: 活动源请求响应返回后读取同一 Manager 最新投影，不建立第二状态或事件源。
import { sourceRuntimeInstance } from '../runtime/sourceRuntimeInstance.js';

/**
 * 标准化数据源身份候选。
 * 纯函数: 只读取输入，不修改请求、响应或 Manager 投影。
 *
 * @param {*} value 请求、响应或投影中的 sourceId 候选。
 * @returns {string} 去除首尾空白的身份；非字符串返回空字符串。
 */
function normalizeSourceIdentity(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 判断一份标准响应是否仍允许写入页面运行态。
 * 纯函数: 只比较请求身份、响应身份和指定 Manager 投影，不读取 Runtime 或修改 store。
 * 显式请求: 详情、播放和用户记录补全保留自身 sourceId，只要响应身份与已解析请求一致就允许采用。
 * 活动源请求: 省略显式 sourceId 时，响应还必须匹配当前 activeSourceId；活动源为空时才匹配 defaultSourceId。
 * 失败路径: 响应身份与 Runtime 已解析请求不一致时抛出 Error，禁止错误 Provider 响应被静默当作过期结果。
 *
 * @param {string} explicitSourceId 调用方最初显式提供的 sourceId；普通页面请求为空字符串。
 * @param {string} resolvedSourceId Runtime 在请求前解析并校验的真实 sourceId。
 * @param {string} responseSourceId Provider 标准响应携带的真实 sourceId。
 * @param {object|null} sourceManagerState 响应返回后读取的最新 SourceManagerState；显式请求允许为 null。
 * @returns {boolean} true 允许 service 提交响应，false 表示活动源已经变化并应丢弃旧响应。
 * @throws {Error} 响应 sourceId 与已解析请求 sourceId 不一致时抛出。
 */
export function isSourceResponseAdoptable(
  explicitSourceId,
  resolvedSourceId,
  responseSourceId,
  sourceManagerState
) {
  // 类型: string。
  // 作用: 保存 Runtime 已验证请求身份，作为 Provider 响应必须匹配的基线。
  const safeResolvedSourceId = normalizeSourceIdentity(resolvedSourceId);

  // 类型: string。
  // 作用: 保存响应声明身份，防止错误源结果写入其他源的页面桶。
  const safeResponseSourceId = normalizeSourceIdentity(responseSourceId);

  // 条件分支: 请求或响应缺少身份、或者二者不一致时进入。
  // 执行内容: 明确抛出契约错误，不能把 Provider 身份损坏伪装为普通切源竞态。
  if (!safeResolvedSourceId || safeResponseSourceId !== safeResolvedSourceId) {
    throw new Error('数据源响应身份与已解析请求身份不一致');
  }

  // 条件分支: 调用方最初显式指定 sourceId 时进入。
  // 执行内容: 保留详情、播放和用户记录自己的内容身份，不要求它等于全局活动源。
  if (normalizeSourceIdentity(explicitSourceId)) {
    return true;
  }

  // 类型: object。
  // 作用: 活动源请求必须读取响应返回后的最新投影；无效输入按空投影失败关闭。
  const safeState = sourceManagerState && typeof sourceManagerState === 'object'
    ? sourceManagerState
    : {};

  // 类型: string。
  // 作用: activeSourceId 是唯一活动事实；只有它为空时才允许 defaultSourceId 提供启动候选。
  const currentActivitySourceId = normalizeSourceIdentity(safeState.activeSourceId)
    || normalizeSourceIdentity(safeState.defaultSourceId);

  // 返回值类型: boolean。
  // 作用: 活动身份仍与请求一致才允许提交；切换成功后的旧源响应返回 false 并保持新页面状态。
  return currentActivitySourceId !== '' && currentActivitySourceId === safeResolvedSourceId;
}

/**
 * 使用应用唯一 Manager 最新投影判断响应是否允许提交。
 * 副作用: 活动源请求会通过 Runtime 读取一次隔离 SourceManagerState；显式请求无需读取并直接执行身份一致性校验。
 * 成功路径: 返回 true 时调用方可以提交，返回 false 时调用方只返回响应而不修改 store。
 * 失败路径: Runtime 状态读取失败或响应身份不一致时原样拒绝，调用方不得提交候选响应。
 *
 * @param {string} explicitSourceId 调用方最初显式提供的 sourceId。
 * @param {string} resolvedSourceId Runtime 请求前解析的真实 sourceId。
 * @param {string} responseSourceId Provider 标准响应携带的 sourceId。
 * @returns {Promise<boolean>} 当前响应是否仍属于可采用请求上下文。
 */
export async function shouldAdoptSourceResponse(
  explicitSourceId,
  resolvedSourceId,
  responseSourceId
) {
  // 条件分支: 请求具有显式内容身份时进入。
  // 执行内容: 不读取全局活动源，只验证响应与已解析显式身份一致。
  if (normalizeSourceIdentity(explicitSourceId)) {
    return isSourceResponseAdoptable(
      explicitSourceId,
      resolvedSourceId,
      responseSourceId,
      null
    );
  }

  // 类型: object。
  // 作用: 在 Provider 响应返回后读取最新 Manager 状态，确保判断覆盖请求期间发生的成功切源。
  const sourceManagerState = await sourceRuntimeInstance.getSourceManagerState();

  return isSourceResponseAdoptable(
    explicitSourceId,
    resolvedSourceId,
    responseSourceId,
    sourceManagerState
  );
}
