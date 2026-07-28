/*
  sourceFilterService.js 模块说明

  - 文件职责:
      提供电影页和电视剧页请求筛选元数据的统一服务入口。
      负责标准化 SourceFilterMetaRequest、解析缺省数据源、调用共享 SourceRuntime，并在成功后提交 siteFilterStore。
      不维护筛选 Provider、注册表或独立生命周期，内容和筛选共用同一个 SourceExecutionHost 实例。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      sourceRuntimeInstance: 自定义服务，提供内容和筛选共用的 Runtime 受管调用入口。
      commitSourceFilterMetaResponse/siteFilterStore: 自定义服务，提交筛选运行态并读取当前活动源。

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
              在页面和筛选 store 都没有提供 sourceId 时，从共享 Runtime 状态解析活动源或默认源。

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

import {
  // 导入来源: ../store/siteFilterStore.js。
  // 导入内容: commitSourceFilterMetaResponse 标准筛选响应提交函数。
  // 文件作用: Runtime 成功返回后一次更新目标目录页筛选运行态。
  commitSourceFilterMetaResponse,

  // 导入来源: ../store/siteFilterStore.js。
  // 导入内容: siteFilterStore 全站筛选元数据运行态。
  // 文件作用: 页面省略 sourceId 时优先沿用当前筛选上下文。
  siteFilterStore
} from '../store/siteFilterStore.js';

// 类型: Array<string>。
// 作用: 限定当前正式消费筛选元数据的电影页和电视剧页，搜索页不会因旧预留桶被误扩张为已实现能力。
const FILTER_PAGE_KEYS = Object.freeze(['movie', 'tv']);

/**
 * 标准化筛选元数据请求的基础字段。
 * 纯函数: 只读取 request 和当前筛选 store 活动源，返回新的请求及 params 对象。
 * sourceId 可以暂时为空，由 requestSourceFilterMeta 在异步调用前通过共享 Runtime 解析。
 * 失败路径: pageKey 不是 movie 或 tv 时立即抛出 Error，不启动 Provider、不提交 store。
 *
 * @param {*} request 目录页或业务服务传入的筛选请求候选。
 * @returns {object} 基础 SourceFilterMetaRequest。
 * @returns {string} return.sourceId 显式请求源或当前筛选 store 活动源；尚未确定时为空字符串。
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
    // 作用: 优先采用调用方显式身份，其次使用筛选 store 当前身份；都缺失时留给异步解析。
    sourceId: typeof safeRequest.sourceId === 'string' && safeRequest.sourceId.trim()
      ? safeRequest.sourceId.trim()
      : siteFilterStore.activeSourceId || '',

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
 * 副作用: 仅当请求和筛选 store 都没有 sourceId 时读取共享 Runtime 的 SourceManagerState，可能触发唯一初始化 Promise。
 * 成功路径: 返回包含活动源或默认源的新 SourceFilterMetaRequest。
 * 失败路径: Runtime 初始化失败时保留原错误；没有活动源或默认源时抛出 Error。
 *
 * @param {object} request 基础 SourceFilterMetaRequest。
 * @param {string} request.sourceId 当前已知数据源身份，允许暂时为空。
 * @returns {Promise<object>} 包含真实 sourceId 的完整筛选请求。
 * @throws {Error} 当 Runtime 状态没有可用身份时抛出。
 */
async function resolveSourceFilterMetaRequest(request) {
  // 条件分支: 请求已具有显式或 store 活动源时进入。
  // 执行内容: 直接复用请求，避免每次目录页请求重复读取 Manager 投影。
  if (request.sourceId) {
    return request;
  }

  // 类型: object。
  // 作用: 保存共享 Runtime 返回的隔离 Manager 投影，用于解析活动源或用户默认源。
  // 异步调用: 读取应用唯一 SourceManagerState。
  // resolve: 返回隔离投影；reject: Repository 或 Manager 初始化失败时保留 Runtime 错误。
  const managerState = await sourceRuntimeInstance.getSourceManagerState();

  // 类型: string。
  // 作用: 优先采用 Runtime 当前活动源，没有活动源时使用用户默认源。
  const sourceId = managerState.activeSourceId || managerState.defaultSourceId || '';

  // 条件分支: Manager 投影没有活动源和默认源时进入。
  // 执行内容: 阻止匿名筛选请求进入 Host。
  if (!sourceId) {
    throw new Error('当前没有可用于筛选元数据请求的数据源');
  }

  return {
    ...request,
    sourceId
  };
}

/**
 * 请求目录页筛选元数据并提交本地筛选运行态。
 * 调用方: MovieView 和 TVView。
 * 副作用: 通过共享 Runtime 按需启动目标 Provider；只有成功响应才提交 siteFilterStore。
 * 成功路径: 返回 Host 已完成生命周期复查的 SourceFilterMetaResponse。
 * 失败路径: 请求校验、Runtime 门禁、Provider、Host 或 store 提交失败时抛出原错误；Runtime 失败不会写入筛选状态。
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

  // 副作用: 把成功响应一次写入 movie 或 tv 筛选桶。
  // 影响范围: siteFilterStore.activeSourceId 和对应 pages[pageKey] 运行态。
  commitSourceFilterMetaResponse(response);

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
