/*
  sourceDataService.js 模块说明

  - 文件职责:
      提供页面请求内容数据的统一服务入口。
      负责标准化 SourceDataRequest、委托 Runtime 解析页面可执行数据源、请求标准响应并在成功后提交 SiteContentStore。
      不注册、创建、缓存或暴露 Provider，Provider 生命周期统一由 SourceExecutionHost 管理。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      sourceRuntimeInstance: 自定义服务，提供内容和筛选链共用的 Runtime 受管调用入口。
      shouldAdoptSourceResponse: 自定义服务，响应返回后复查显式身份或当前活动源是否仍允许提交。
      commitSourceDataResponse: 自定义服务，只在请求成功后提交响应式内容运行态。

  - 模块级常量:
      sourceDataService: object，页面可使用的内容请求服务门面。

  - 模块级变量:
      无

  - 模块级辅助函数:
      resolveSourceDataRequest(request)
          - params:
              -- request: object，已经完成基础标准化的内容请求。
          - return:
              Promise<object>，包含真实 sourceId 的完整 SourceDataRequest。
          - description:
              委托共享 Runtime 按显式源、活动源和默认源顺序解析并校验当前页面候选。

  - 模块级类:
      无

  - 对外导出:
      normalizeSourceDataRequest: Function，创建不修改调用方输入的基础标准请求。
      requestSourceData: Function，通过共享 Runtime 请求并提交内容响应。
      sourceDataService: object，供页面复用的最小服务门面。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceRuntimeInstance 应用级共享 SourceRuntime。
// 文件作用: 通过同一 Runtime、Host 和 Provider 生命周期请求内容，不建立 service 私有注册表。
import { sourceRuntimeInstance } from '../runtime/sourceRuntimeInstance.js';

// 导入来源: ./sourceResponseAdoptionService.js。
// 导入内容: shouldAdoptSourceResponse 统一响应采用判断函数。
// 文件作用: Provider 响应返回后拒绝已经被新活动源取代的旧页面结果，同时保留显式内容身份请求。
import { shouldAdoptSourceResponse } from './sourceResponseAdoptionService.js';

import {
  // 导入来源: ../store/siteContentStore.js。
  // 导入内容: commitSourceDataResponse 标准响应提交函数。
  // 文件作用: Runtime 成功返回后把内容实体和页面引用一次写入本地运行态。
  commitSourceDataResponse
} from '../store/siteContentStore.js';

/**
 * 标准化内容请求的基础字段。
 * 纯函数: 只读取 request，返回新的请求及 params 对象，不读取内容 store 或 Runtime 状态。
 * sourceId 可以暂时为空，由 requestSourceData 在异步调用前通过共享 Runtime 解析。
 * 失败路径: pageKey 为空时立即抛出 Error，不启动 Provider、不提交 store。
 *
 * @param {*} request 页面或业务服务传入的请求候选。
 * @returns {object} 基础 SourceDataRequest。
 * @returns {string} return.sourceId 显式请求源；未指定时为空字符串。
 * @returns {string} return.pageKey 内容目标页面。
 * @returns {string} return.moduleKey 页面区域；单列表和单内容页面为空字符串。
 * @returns {object} return.params 隔离的分页、筛选、关键词或内容定位参数。
 * @throws {Error} 当 pageKey 缺失时抛出。
 */
export function normalizeSourceDataRequest(request) {
  // 类型: object。
  // 作用: 非普通对象候选使用空对象进入统一 pageKey 失败路径，避免读取属性时泄漏原生异常。
  const safeRequest = request && typeof request === 'object' && !Array.isArray(request)
    ? request
    : {};

  // 类型: object。
  // 作用: 只复制普通 params 字段，防止数组或基础值进入 Provider 页面参数解析。
  const safeParams = safeRequest.params && typeof safeRequest.params === 'object'
    && !Array.isArray(safeRequest.params)
    ? safeRequest.params
    : {};

  // 类型: string。
  // 作用: 保存 Provider 识别页面数据块所需的页面键。
  const pageKey = typeof safeRequest.pageKey === 'string'
    ? safeRequest.pageKey.trim()
    : '';

  // 条件分支: pageKey 为空时进入。
  // 执行内容: 在任何 Runtime 初始化或 store 写入前拒绝无目标请求。
  if (!pageKey) {
    throw new Error('SourceDataRequest.pageKey 不能为空');
  }

  return {
    // 类型: string。
    // 作用: 只保存调用方显式身份；未指定时留给 Runtime 按唯一活动源语义解析。
    sourceId: typeof safeRequest.sourceId === 'string' && safeRequest.sourceId.trim()
      ? safeRequest.sourceId.trim()
      : '',

    // 类型: string。
    // 作用: 回填经过空白清理的页面键，供 Runtime 和 Provider 使用同一值。
    pageKey,

    // 类型: string。
    // 作用: 首页通过该值定位独立区域，其他页面使用空字符串。
    moduleKey: typeof safeRequest.moduleKey === 'string'
      ? safeRequest.moduleKey.trim()
      : '',

    // 类型: object。
    // 作用: 创建独立浅层参数对象，避免 service 修改页面持有的 params 根引用。
    params: {
      ...safeParams
    }
  };
}

/**
 * 为基础请求解析真实数据源身份。
 * 副作用: 委托共享 Runtime 读取唯一 SourceManagerState 和可信工厂门禁；不启动 Provider、不提交 store。
 * 成功路径: 返回包含显式源、活动源或默认源的全新 SourceDataRequest，且该源支持当前页面。
 * 失败路径: Runtime 初始化、身份、候选或工厂门禁失败时保留稳定 Runtime 错误。
 *
 * @param {object} request 基础 SourceDataRequest。
 * @param {string} request.sourceId 当前已知数据源身份，允许暂时为空。
 * @returns {Promise<object>} 包含真实 sourceId 的完整 SourceDataRequest。
 * @throws {SourceRuntimeError} 当前请求无法解析为页面可执行数据源时抛出。
 */
async function resolveSourceDataRequest(request) {
  // 类型: string。
  // 作用: 由 Runtime 统一解析显式/活动/默认身份，并复用页面能力、授权和可信工厂候选规则。
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
 * 请求内容数据并提交全站内容运行态。
 * 调用方: 首页、电影页、电视剧页、搜索页、详情页、播放页和内容引用补全服务。
 * 副作用: 通过共享 Runtime 按需启动目标 Provider；只有身份仍可采用的成功响应才提交 siteContentStore。
 * 成功路径: 返回 Host 已完成生命周期复查的标准 SourceDataResponse；活动源过期响应仍返回但不修改 store。
 * 失败路径: 请求校验、Runtime 门禁、Provider、Host、响应身份或 store 提交失败时抛出原错误；失败候选不提交。
 *
 * @param {*} request 页面或业务服务发起的 SourceDataRequest 候选。
 * @returns {Promise<object>} 标准 SourceDataResponse。
 * @throws {Error} 当请求、数据源生命周期、响应或 store 写入失败时抛出。
 */
export async function requestSourceData(request) {
  // 类型: object。
  // 作用: 先完成同步结构校验，避免非法页面请求触发 Runtime 初始化。
  const baseRequest = normalizeSourceDataRequest(request);

  // 类型: object。
  // 作用: 保存具有真实 sourceId 的完整请求，供 Runtime、Host、Provider 和响应使用同一身份。
  const normalizedRequest = await resolveSourceDataRequest(baseRequest);

  // 类型: object。
  // 作用: 保存 Host 已完成生命周期复查的标准内容响应，提交前不修改内容 store。
  // 异步调用: 通过应用唯一 Runtime 执行受管内容请求。
  // resolve: 返回通过 Host 生命周期代次复查的标准响应；reject: 不提交 store 并把错误交给页面。
  const response = await sourceRuntimeInstance.fetchData(normalizedRequest);

  // 类型: boolean。
  // 作用: 显式身份请求保留自身 sourceId；普通页面请求只有仍匹配 Manager 当前活动源时才允许提交。
  const shouldCommitResponse = await shouldAdoptSourceResponse(
    baseRequest.sourceId,
    normalizedRequest.sourceId,
    response.sourceId
  );

  // 条件分支: 当前响应仍属于显式内容身份或最新活动源时进入。
  // 执行内容: 把成功响应归一化写入内容实体池和目标页面桶；过期活动源响应保持现有 store 不变。
  if (shouldCommitResponse) {
    // 副作用: 采用当前有效响应。
    // 影响范围: siteContentStore.activeSourceId、entities.contentItems 和对应 pages 数据桶。
    commitSourceDataResponse(response);
  }

  return response;
}

// 类型: object。
// 作用: 暴露页面需要的最小内容服务能力，不包含 Provider、注册表、Host 或 Runtime 内部引用。
// 字段: normalizeRequest，Function，同步创建基础 SourceDataRequest。
// 字段: requestData，Function，通过共享 Runtime 请求并提交标准响应。
export const sourceDataService = Object.freeze({
  // 类型: Function。
  // 作用: 供页面和其他业务调用方复用统一请求基础字段。
  normalizeRequest: normalizeSourceDataRequest,

  // 类型: Function。
  // 作用: 供页面按数据块请求内容，并在成功后更新全站内容运行态。
  requestData: requestSourceData
});

// 导出类型: default object。
// 导出内容: 冻结的最小内容数据请求服务门面。
// 外部调用方: 内容页面和内容引用补全服务。
// 使用场景: 页面发起内容请求后继续通过 siteContentStore selector 读取渲染数据。
export default sourceDataService;
