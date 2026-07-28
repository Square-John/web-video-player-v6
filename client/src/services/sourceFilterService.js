/*
  sourceFilterService.js 模块说明

  - 文件职责:
      提供电影页和电视剧页请求筛选元数据的统一服务入口。
      负责标准化 SourceFilterMetaRequest、委托 Runtime 解析页面可执行数据源、请求标准响应并在成功后提交 siteFilterStore。
      不维护筛选 Provider、注册表或独立生命周期，内容和筛选共用同一个 SourceExecutionHost 实例。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      sourceRuntimeInstance: 自定义服务，提供内容和筛选共用的 Runtime 受管调用入口。
      shouldAdoptSourceResponse: 自定义服务，响应返回后复查当前活动源是否仍允许提交。
      commitSourceFilterMetaResponse: 自定义服务，只在请求成功后提交筛选运行态。

  - 模块级常量:
      FILTER_PAGE_KEYS: Array<string>，正式消费筛选元数据的目录页集合。
      sourceFilterService: object，目录页可使用的筛选请求服务门面。

  - 模块级变量:
      无

  - 模块级辅助函数:
      resolveSourceFilterMetaRequest(request)
          - params:
              -- request: object，已经完成基础标准化的筛选请求。
          - return:
              Promise<object>，包含真实 sourceId 的完整 SourceFilterMetaRequest。
          - description:
              委托共享 Runtime 按显式源、活动源和默认源顺序解析并校验当前目录页候选。

  - 模块级类:
      无

  - 对外导出:
      normalizeSourceFilterMetaRequest: Function，创建 movie/tv 基础筛选请求。
      requestSourceFilterMeta: Function，通过共享 Runtime 请求并提交筛选响应。
      sourceFilterService: object，供目录页复用的最小服务门面。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceRuntimeInstance 应用级共享 SourceRuntime。
// 文件作用: 复用内容请求已经使用的同一 Host 和 Provider，不创建筛选专用注册表。
import { sourceRuntimeInstance } from '../runtime/sourceRuntimeInstance.js';

// 导入来源: ./sourceResponseAdoptionService.js。
// 导入内容: shouldAdoptSourceResponse 统一响应采用判断函数。
// 文件作用: 目录筛选响应返回后拒绝已经被新活动源取代的旧筛选组。
import { shouldAdoptSourceResponse } from './sourceResponseAdoptionService.js';

import {
  // 导入来源: ../store/siteFilterStore.js。
  // 导入内容: commitSourceFilterMetaResponse 标准筛选响应提交函数。
  // 文件作用: Runtime 成功返回后一次更新目标目录页筛选运行态。
  commitSourceFilterMetaResponse
} from '../store/siteFilterStore.js';

// 类型: Array<string>。
// 作用: 限定当前正式消费筛选元数据的电影页和电视剧页，搜索页不会因旧预留桶被误扩张为已实现能力。
const FILTER_PAGE_KEYS = Object.freeze(['movie', 'tv']);

/**
 * 标准化筛选元数据请求的基础字段。
 * 纯函数: 只读取 request，返回新的请求及 params 对象，不读取筛选 store 或 Runtime 状态。
 * sourceId 可以暂时为空，由 requestSourceFilterMeta 在异步调用前通过共享 Runtime 解析。
 * 失败路径: pageKey 不是 movie 或 tv 时立即抛出 Error，不启动 Provider、不提交 store。
 *
 * @param {*} request 目录页或业务服务传入的筛选请求候选。
 * @returns {object} 基础 SourceFilterMetaRequest。
 * @returns {string} return.sourceId 显式请求源；未指定时为空字符串。
 * @returns {string} return.pageKey 当前目录页，只允许 movie 或 tv。
 * @returns {object} return.params 隔离的筛选元数据生成参数，当前通常为空对象。
 * @throws {Error} 当 pageKey 不属于正式目录页范围时抛出。
 */
export function normalizeSourceFilterMetaRequest(request) {
  // 类型: object。
  // 作用: 非普通对象候选使用空对象进入统一页面范围失败路径。
  const safeRequest = request && typeof request === 'object' && !Array.isArray(request)
    ? request
    : {};

  // 类型: object。
  // 作用: 只复制普通 params 根对象，数组和基础值按空参数处理。
  const safeParams = safeRequest.params && typeof safeRequest.params === 'object'
    && !Array.isArray(safeRequest.params)
    ? safeRequest.params
    : {};

  // 类型: string。
  // 作用: 保存当前筛选元数据目标目录页，供正式范围校验和 Provider 分组统计。
  const pageKey = typeof safeRequest.pageKey === 'string'
    ? safeRequest.pageKey.trim()
    : '';

  // 条件分支: pageKey 不是 movie 或 tv 时进入。
  // 执行内容: 拒绝旧 search 预留桶或未知页面进入筛选 Provider。
  if (!FILTER_PAGE_KEYS.includes(pageKey)) {
    throw new Error(`SourceFilterMetaRequest.pageKey 不受支持: ${pageKey || 'unknown'}`);
  }

  return {
    // 类型: string。
    // 作用: 只保存调用方显式身份；未指定时留给 Runtime 按唯一活动源语义解析。
    sourceId: typeof safeRequest.sourceId === 'string' && safeRequest.sourceId.trim()
      ? safeRequest.sourceId.trim()
      : '',

    // 类型: string。
    // 作用: 回填已验证的 movie 或 tv 页面键。
    pageKey,

    // 类型: object。
    // 作用: 创建独立浅层参数对象，避免 service 修改页面持有的 params 根引用。
    params: {
      ...safeParams
    }
  };
}

/**
 * 为基础筛选请求解析真实数据源身份。
 * 副作用: 委托共享 Runtime 读取唯一 SourceManagerState 和可信工厂门禁；不启动 Provider、不提交 store。
 * 成功路径: 返回包含显式源、活动源或默认源的新 SourceFilterMetaRequest，且该源支持当前目录页。
 * 失败路径: Runtime 初始化、身份、候选或工厂门禁失败时保留稳定 Runtime 错误。
 *
 * @param {object} request 基础 SourceFilterMetaRequest。
 * @param {string} request.sourceId 当前已知数据源身份，允许暂时为空。
 * @returns {Promise<object>} 包含真实 sourceId 的完整筛选请求。
 * @throws {SourceRuntimeError} 当前请求无法解析为目录页可执行数据源时抛出。
 */
async function resolveSourceFilterMetaRequest(request) {
  // 类型: string。
  // 作用: 由 Runtime 统一解析显式/活动/默认身份，并复用目录能力、授权和可信工厂候选规则。
  // 异步调用: 不启动 Provider；resolve 返回页面可执行真实 sourceId，reject 保留稳定 Runtime 错误。
  const sourceId = await sourceRuntimeInstance.resolveSourceId(
    request.sourceId,
    request.pageKey
  );

  return {
    ...request,
    sourceId
  };
}

/**
 * 请求目录页筛选元数据并提交本地筛选运行态。
 * 调用方: MovieView 和 TVView。
 * 副作用: 通过共享 Runtime 按需启动目标 Provider；只有身份仍可采用的成功响应才提交 siteFilterStore。
 * 成功路径: 返回 Host 已完成生命周期复查的 SourceFilterMetaResponse；活动源过期响应不修改 store。
 * 失败路径: 请求校验、Runtime 门禁、Provider、Host、响应身份或 store 提交失败时抛出原错误；失败候选不提交。
 *
 * @param {*} request 目录页发起的 SourceFilterMetaRequest 候选。
 * @returns {Promise<object>} 标准 SourceFilterMetaResponse。
 * @throws {Error} 当请求、数据源生命周期、响应或 store 写入失败时抛出。
 */
export async function requestSourceFilterMeta(request) {
  // 类型: object。
  // 作用: 先完成同步页面范围和参数校验，非法请求不触发 Runtime 初始化。
  const baseRequest = normalizeSourceFilterMetaRequest(request);

  // 类型: object。
  // 作用: 保存具有真实 sourceId 的完整筛选请求，供 Runtime、Host、Provider 和响应保持同一身份。
  const normalizedRequest = await resolveSourceFilterMetaRequest(baseRequest);

  // 类型: object。
  // 作用: 保存 Host 已完成生命周期复查的标准筛选响应，提交前不修改筛选 store。
  // 异步调用: 通过应用唯一 Runtime 执行受管筛选请求。
  // resolve: 返回标准响应；reject: 不提交 store 并把错误交给目录页。
  const response = await sourceRuntimeInstance.fetchFilterMeta(normalizedRequest);

  // 类型: boolean。
  // 作用: 目录页通常省略显式身份，只有响应仍匹配 Manager 当前活动源时才允许提交筛选组。
  const shouldCommitResponse = await shouldAdoptSourceResponse(
    baseRequest.sourceId,
    normalizedRequest.sourceId,
    response.sourceId
  );

  // 条件分支: 当前筛选响应仍属于显式身份或最新活动源时进入。
  // 执行内容: 一次写入 movie 或 tv 筛选桶；过期活动源响应保持现有筛选状态不变。
  if (shouldCommitResponse) {
    // 副作用: 采用当前有效筛选响应。
    // 影响范围: siteFilterStore.activeSourceId 和对应 pages[pageKey] 运行态。
    commitSourceFilterMetaResponse(response);
  }

  return response;
}

// 类型: object。
// 作用: 暴露目录页需要的最小筛选服务能力，不包含 Provider、注册表、Host 或 Runtime 内部引用。
// 字段: normalizeRequest，Function，同步创建基础筛选请求。
// 字段: requestFilterMeta，Function，通过共享 Runtime 请求并提交标准响应。
export const sourceFilterService = Object.freeze({
  // 类型: Function。
  // 作用: 供目录页和其他业务调用方复用 movie/tv 请求字段。
  normalizeRequest: normalizeSourceFilterMetaRequest,

  // 类型: Function。
  // 作用: 供目录页请求筛选按钮组，并在成功后更新筛选运行态。
  requestFilterMeta: requestSourceFilterMeta
});

// 导出类型: default object。
// 导出内容: 冻结的最小筛选元数据请求服务门面。
// 外部调用方: MovieView 和 TVView。
// 使用场景: 目录页请求筛选组后继续从 siteFilterStore 读取并渲染 CatalogFilterBar。
export default sourceFilterService;
