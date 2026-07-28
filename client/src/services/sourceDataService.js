/*
  sourceDataService.js 模块说明

  - 文件职责:
      提供页面请求内容数据的统一服务入口。
      负责标准化 SourceDataRequest、解析缺省数据源、调用共享 SourceRuntime，并在成功后提交 SiteContentStore。
      不注册、创建、缓存或暴露 Provider，Provider 生命周期统一由 SourceExecutionHost 管理。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      sourceRuntimeInstance: 自定义服务，提供内容和筛选链共用的 Runtime 受管调用入口。
      commitSourceDataResponse/siteContentStore: 自定义服务，提交响应式内容运行态并读取当前活动源。

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
              在页面和内容 store 都没有提供 sourceId 时，从共享 Runtime 的 SourceManagerState 解析活动源或默认源。

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

import {
  // 导入来源: ../store/siteContentStore.js。
  // 导入内容: commitSourceDataResponse 标准响应提交函数。
  // 文件作用: Runtime 成功返回后把内容实体和页面引用一次写入本地运行态。
  commitSourceDataResponse,

  // 导入来源: ../store/siteContentStore.js。
  // 导入内容: siteContentStore 全站内容运行态对象。
  // 文件作用: 页面省略 sourceId 时优先复用当前内容上下文，不提前触发 Runtime 初始化。
  siteContentStore
} from '../store/siteContentStore.js';

/**
 * 标准化内容请求的基础字段。
 * 纯函数: 只读取 request 和当前 store 活动源，返回新的请求及 params 对象。
 * sourceId 可以暂时为空，由 requestSourceData 在异步调用前通过共享 Runtime 解析。
 * 失败路径: pageKey 为空时立即抛出 Error，不启动 Provider、不提交 store。
 *
 * @param {*} request 页面或业务服务传入的请求候选。
 * @returns {object} 基础 SourceDataRequest。
 * @returns {string} return.sourceId 显式请求源或当前内容 store 活动源；尚未确定时为空字符串。
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
    // 作用: 优先保存调用方显式身份，其次采用当前内容 store 身份；两者都缺失时留给异步解析。
    sourceId: typeof safeRequest.sourceId === 'string' && safeRequest.sourceId.trim()
      ? safeRequest.sourceId.trim()
      : siteContentStore.activeSourceId || '',

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
 * 副作用: 仅当请求和内容 store 都没有 sourceId 时读取共享 Runtime 的 SourceManagerState，可能触发唯一初始化 Promise。
 * 成功路径: 返回包含活动源或默认源的全新 SourceDataRequest。
 * 失败路径: SourceManager 初始化失败时保留 Runtime 错误；没有任何活动源或默认源时抛出 Error。
 *
 * @param {object} request 基础 SourceDataRequest。
 * @param {string} request.sourceId 当前已知数据源身份，允许暂时为空。
 * @returns {Promise<object>} 包含真实 sourceId 的完整 SourceDataRequest。
 * @throws {Error} 当 Runtime 状态没有可用身份时抛出。
 */
async function resolveSourceDataRequest(request) {
  // 条件分支: 基础请求已经具有显式或 store 活动源时进入。
  // 执行内容: 直接返回请求，不为每次页面调用重复读取 Manager 投影。
  if (request.sourceId) {
    return request;
  }

  // 类型: object。
  // 作用: 保存共享 Runtime 返回的隔离 SourceManagerState，用于解析活动源或用户默认源。
  // 异步调用: 读取共享 Runtime 的隔离 SourceManagerState。
  // resolve: 返回活动源、默认源和记录投影；reject: Repository 或 Manager 初始化失败时保留 Runtime 错误。
  const managerState = await sourceRuntimeInstance.getSourceManagerState();

  // 类型: string。
  // 作用: 优先采用 Runtime 当前活动源，没有活动源时回退用户保存的默认源。
  const sourceId = managerState.activeSourceId || managerState.defaultSourceId || '';

  // 条件分支: SourceManagerState 没有活动源和默认源时进入。
  // 执行内容: 拒绝构造匿名 Provider 请求，页面可据此进入无可用数据源状态。
  if (!sourceId) {
    throw new Error('当前没有可用于内容请求的数据源');
  }

  return {
    ...request,
    sourceId
  };
}

/**
 * 请求内容数据并提交全站内容运行态。
 * 调用方: 首页、电影页、电视剧页、搜索页、详情页、播放页和内容引用补全服务。
 * 副作用: 通过共享 Runtime 按需启动目标 Provider；只有成功响应才提交 siteContentStore。
 * 成功路径: 返回 Host 已完成生命周期复查的标准 SourceDataResponse。
 * 失败路径: 请求校验、Runtime 门禁、Provider、Host 或 store 提交失败时抛出原错误；Runtime 失败不会提交候选响应。
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

  // 副作用: 把成功响应归一化写入内容实体池和目标页面桶。
  // 影响范围: siteContentStore.activeSourceId、entities.contentItems 和对应 pages 数据桶。
  commitSourceDataResponse(response);

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
