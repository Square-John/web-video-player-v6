/*
  sourceDataService.js 模块说明

  - 文件职责:
      提供页面请求内容数据的统一服务入口。
      负责标准化 SourceDataRequest、委托 Runtime 解析页面可执行数据源、请求标准响应并在成功后提交 SiteContentStore。
      为收藏和历史引用提供只采用内容实体的后台入口，不借用任何页面请求事务。
      不注册、创建、缓存或暴露 Provider，Provider 生命周期统一由 SourceExecutionHost 管理。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      sourceRuntimeInstance: 自定义服务，提供内容和筛选链共用的 Runtime 受管调用入口。
      SOURCE_RUNTIME_ERROR_CODE: 自定义错误枚举，提供 Runtime 失败到页面安全说明的稳定分类。
      shouldAdoptSourceResponse: 自定义服务，响应返回后复查显式身份或当前活动源是否仍允许提交。
      beginSourceDataRequest、resolveSourceDataRequestTransaction、commitSourceDataResponse、failSourceDataRequest: 自定义 Store 页面事务端口，发布身份解析前 loading、真实源、success 和 error/stale。
      commitSourceContentItem: 自定义 Store 实体端口，后台补全时只采用单个 ContentItem。

  - 模块级常量:
      SOURCE_DATA_REQUEST_ERROR_CODE: string，未知页面内容请求失败使用的稳定错误码。
      SOURCE_DATA_REQUEST_ERROR_MESSAGE_BY_CODE: object，Runtime 错误码到页面安全说明的映射。
      sourceDataService: object，页面与引用补全可使用的内容请求服务门面。

  - 模块级变量:
      sourceDataRequestSequence: number，当前页面请求服务生命周期内单调递增的事务序号。

  - 模块级辅助函数:
      resolveSourceDataRequest(request)
          - params:
              -- request: object，已经完成基础标准化的内容请求。
          - return:
              Promise<object>，包含真实 sourceId 的完整 SourceDataRequest。
          - description:
              委托共享 Runtime 按显式源、活动源和默认源顺序解析并校验当前页面候选。
      fetchSourceDataResponse(baseRequest, normalizedRequest)
          - params:
              -- baseRequest: object，保留调用方显式身份的基础请求。
              -- normalizedRequest: object，Runtime 已解析真实 sourceId 的完整请求。
          - return:
              Promise<object>，包含标准响应和是否允许采用的身份复查结果。
          - description:
              让页面请求和后台实体补全共用 Provider 调用与响应身份校验。
      createSourceDataRequestPageError(error)
          - params:
              -- error: unknown，Runtime、Provider、Host 或采用阶段原始失败。
          - return:
              object，只含稳定 code 和安全 message 的页面事务错误。
          - description:
              保留机器错误分类但隔离诊断 message、sourceId、cause 和堆栈，防止页面直接展示内部信息。

  - 模块级类:
      无

  - 对外导出:
      normalizeSourceDataRequest: Function，创建不修改调用方输入的基础标准请求。
      requestSourceData: Function，通过共享 Runtime 请求并提交内容响应。
      requestSourceContentItem: Function，请求并独立采用后台补全实体。
      sourceDataService: object，供页面复用的最小服务门面。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceRuntimeInstance 应用级共享 SourceRuntime。
// 文件作用: 通过同一 Runtime、Host 和 Provider 生命周期请求内容，不建立 service 私有注册表。
import { sourceRuntimeInstance } from '../runtime/sourceRuntimeInstance.js';

// 导入来源: ../runtime/createSourceRuntime.js。
// 导入内容: SOURCE_RUNTIME_ERROR_CODE Runtime 稳定错误码枚举。
// 文件作用: 把内容请求失败按公共 Runtime 分类转换为页面安全说明，不读取原始 message 猜测错误。
import { SOURCE_RUNTIME_ERROR_CODE } from '../runtime/createSourceRuntime.js';

// 导入来源: ./sourceResponseAdoptionService.js。
// 导入内容: shouldAdoptSourceResponse 统一响应采用判断函数。
// 文件作用: Provider 响应返回后拒绝已经被新活动源取代的旧页面结果，同时保留显式内容身份请求。
import { shouldAdoptSourceResponse } from './sourceResponseAdoptionService.js';

import {
  // 导入来源: ../store/siteContentStore.js；导入内容: beginSourceDataRequest；文件作用: 在调用 Provider 前发布 loading 和跨源 stale。
  beginSourceDataRequest,
  // 导入来源: ../store/siteContentStore.js；导入内容: commitSourceContentItem；文件作用: 后台引用补全只采用内容实体。
  commitSourceContentItem,
  // 导入来源: ../store/siteContentStore.js。
  // 导入内容: commitSourceDataResponse 标准响应提交函数。
  // 文件作用: Runtime 成功返回后把内容实体和页面引用一次写入本地运行态。
  commitSourceDataResponse,
  // 导入来源: ../store/siteContentStore.js；导入内容: resolveSourceDataRequestTransaction；文件作用: 在同一 requestId 上采用 Runtime 解析的真实 Provider 身份。
  resolveSourceDataRequestTransaction,
  // 导入来源: ../store/siteContentStore.js；导入内容: failSourceDataRequest；文件作用: 请求失败时只关闭仍是最新的页面事务。
  failSourceDataRequest
} from '../store/siteContentStore.js';

// 类型: number；生命周期: 当前模块实例；作用: 为每次页面内容调用生成不依赖时间和随机数的唯一递增 requestId。
let sourceDataRequestSequence = 0;

// 类型: string；作用: Runtime 之外的未知内容请求失败使用统一机器分类，页面不得从 message 反推内部异常。
const SOURCE_DATA_REQUEST_ERROR_CODE = 'SOURCE_DATA_REQUEST_ERROR';

// 类型: object；作用: 把 Runtime 稳定分类映射为页面可直接展示的通用说明，不泄漏 sourceId、Provider message、cause 或堆栈。
const SOURCE_DATA_REQUEST_ERROR_MESSAGE_BY_CODE = Object.freeze({
  // 类型: string；作用: 请求结构或页面参数错误时提示重新发起，不暴露字段校验位置。
  [SOURCE_RUNTIME_ERROR_CODE.validation]: '内容请求参数无效，请返回后重新操作。',
  // 类型: string；作用: 应用基础设施初始化失败时提示刷新重试，不暴露 Repository 或数据库实现。
  [SOURCE_RUNTIME_ERROR_CODE.initialization]: '数据源服务初始化失败，请刷新页面后重试。',
  // 类型: string；作用: 目标记录不存在时提示重新选择，不暴露内部 sourceId。
  [SOURCE_RUNTIME_ERROR_CODE.notFound]: '目标数据源不存在，请选择其他数据源。',
  // 类型: string；作用: 目标源不能运行时提示切源，不解释授权、软隐藏或 Provider 注册细节。
  [SOURCE_RUNTIME_ERROR_CODE.unavailable]: '当前数据源不可用，请选择其他数据源。',
  // 类型: string；作用: Host、Shell、网络或 Provider 调用失败共用内容请求说明，站点细节由诊断链保留。
  [SOURCE_RUNTIME_ERROR_CODE.operation]: '当前数据源未完成本次内容请求，请稍后重试或切换数据源。',
  // 类型: string；作用: 非 Runtime 错误使用同一通用说明，避免把原生异常直接写入页面事务。
  [SOURCE_DATA_REQUEST_ERROR_CODE]: '当前数据源未完成本次内容请求，请稍后重试或切换数据源。'
});

/**
 * 把内容请求原始失败转换为页面事务安全错误。
 * 纯函数: 只读取 error.code，不修改原错误、cause 或堆栈。
 * 成功路径: 已知 Runtime 分类保留 code 并使用对应说明；未知分类保留非空 code 但采用通用说明。
 * 失败路径: 非对象或缺少 code 时使用 SOURCE_DATA_REQUEST_ERROR，不读取原始 message 作为页面文本。
 *
 * @param {*} error Runtime、Provider、Host、响应采用或 Store 提交阶段原始失败。
 * @returns {object} 页面事务可保存的稳定错误对象。
 * @returns {string} return.code 原错误稳定 code 或 SOURCE_DATA_REQUEST_ERROR。
 * @returns {string} return.message 不含 sourceId、cause、堆栈和站点细节的用户说明。
 */
function createSourceDataRequestPageError(error) {
  // 类型: string；作用: 只采用非空稳定错误码；message 不参与分类，避免内部文本变化改变页面行为。
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : SOURCE_DATA_REQUEST_ERROR_CODE;
  // 类型: string；作用: 已知 Runtime 分类使用精确说明，未知错误统一回退内容请求失败说明。
  const message = SOURCE_DATA_REQUEST_ERROR_MESSAGE_BY_CODE[code]
    || SOURCE_DATA_REQUEST_ERROR_MESSAGE_BY_CODE[SOURCE_DATA_REQUEST_ERROR_CODE];
  return { code, message };
}

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
 * 通过共享 Runtime 请求标准内容响应并复查响应身份。
 * 副作用: 可以按需启动目标 Provider 并执行其网络、挑战和私有存储流程；不修改页面或内容 store。
 * 成功路径: 返回 Host 已验证响应和统一采用判断，调用方再按页面或后台语义选择提交范围。
 * 失败路径: Runtime、Provider 或响应身份损坏错误原样抛出，不建立备用数据通道。
 *
 * @param {object} baseRequest 保留调用方显式 sourceId 的基础请求。
 * @param {object} normalizedRequest Runtime 已解析真实 sourceId 的完整请求。
 * @returns {Promise<object>} 标准响应和采用判断。
 * @returns {object} return.response Host 已完成生命周期复查的 SourceDataResponse。
 * @returns {boolean} return.shouldAdoptResponse 当前响应身份是否仍允许采用。
 */
async function fetchSourceDataResponse(baseRequest, normalizedRequest) {
  // 类型: object；作用: 保存 Host 已完成生命周期复查的标准响应；所有消费者共用唯一 Runtime 和 Provider 通道。
  const response = await sourceRuntimeInstance.fetchData(normalizedRequest);
  // 类型: boolean；作用: 显式引用保留自身身份，活动源页面拒绝切换后返回的旧源响应。
  const shouldAdoptResponse = await shouldAdoptSourceResponse(
    baseRequest.sourceId,
    normalizedRequest.sourceId,
    response.sourceId
  );
  return { response, shouldAdoptResponse };
}

/**
 * 请求内容数据并提交全站内容运行态。
 * 调用方: 首页、电影页、电视剧页、搜索页、详情页和播放页。
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

  // 状态变化: 每次结构合法的页面请求立即递增服务序号，让 Runtime 身份解析失败也拥有可见且可重试的唯一事务。
  sourceDataRequestSequence += 1;
  // 类型: object；作用: 先绑定页面意图和目标桶；resolvedSourceId 在 Runtime 门禁完成前保持空字符串。
  let transaction = {
    requestId: `source-data-request-${sourceDataRequestSequence}`,
    requestedSourceId: baseRequest.sourceId,
    resolvedSourceId: '',
    pageKey: baseRequest.pageKey,
    moduleKey: baseRequest.moduleKey
  };
  // 副作用: 在任何异步身份解析前发布 loading；解析失败将由同一 requestId 收敛为页面 error。
  beginSourceDataRequest(transaction);

  try {
    // 类型: object；作用: 保存 Runtime 已解析真实 sourceId 的完整请求，供 Host、Provider 和响应使用同一身份。
    const normalizedRequest = await resolveSourceDataRequest(baseRequest);
    // 状态变化: 创建包含真实 Provider 身份的新事务对象，避免修改已经交给 Store 的调用方引用。
    transaction = {
      ...transaction,
      resolvedSourceId: normalizedRequest.sourceId
    };
    // 副作用: 只在 requestId 仍是最新时补齐真实源，并重新裁决同源旧内容在 loading 期间是否可见。
    resolveSourceDataRequestTransaction(transaction, normalizedRequest.sourceId);

    // 类型: object；作用: 保存 Host 已完成生命周期复查的标准内容响应，提交前只有 loading 事务可见。
    const { response, shouldAdoptResponse } = await fetchSourceDataResponse(
      baseRequest,
      normalizedRequest
    );

  // 条件分支: 当前响应仍属于显式内容身份或最新活动源时进入。
  // 执行内容: 把成功响应归一化写入内容实体池和目标页面桶；过期活动源响应保持现有 store 不变。
    if (shouldAdoptResponse) {
    // 副作用: 采用当前有效响应。
    // 影响范围: siteContentStore.activeSourceId、entities.contentItems 和对应 pages 数据桶。
      commitSourceDataResponse(response, transaction);
    }

    return response;
  } catch (error) {
    // 异常来源: Runtime、Provider、身份复查或 Store 提交失败。
    // 处理策略: 页面事务只保存稳定 code 和安全说明；原错误继续抛给调用链保留诊断信息。
    failSourceDataRequest(transaction, createSourceDataRequestPageError(error));
    throw error;
  }
}

/**
 * 请求并独立采用一个后台内容实体。
 * 调用方: contentItemResolver 为收藏和历史引用补全详情。
 * 副作用: 通过共享 Runtime 调用 Provider；成功时只写 entities.contentItems，不发布页面 loading/error 或 currentKey。
 * 成功路径: 显式 detail 请求返回 item 时采用并返回该实体；空响应返回 null。
 * 失败路径: 缺少显式身份、页面键不属于 detail、Runtime 或 Provider 失败时抛出，resolver 决定单条兜底。
 *
 * @param {*} request 后台详情 SourceDataRequest 候选。
 * @returns {Promise<object|null>} 已采用 ContentItem 或 null。
 * @throws {Error} 当请求没有显式 sourceId、不是 detail 或执行失败时抛出。
 */
export async function requestSourceContentItem(request) {
  // 类型: object；作用: 复用页面请求标准化规则，不允许后台入口形成第二套 SourceDataRequest 语义。
  const baseRequest = normalizeSourceDataRequest(request);
  // 条件分支: 后台补全没有显式内容身份或试图写其他页面时进入；执行内容: 在 Runtime 调用前失败关闭。
  if (!baseRequest.sourceId || baseRequest.pageKey !== 'detail' || baseRequest.moduleKey) {
    throw new Error('后台内容补全必须使用显式 sourceId 的 detail 请求');
  }
  // 类型: object；作用: 由 Runtime 复核该显式源当前可执行 detail 能力。
  const normalizedRequest = await resolveSourceDataRequest(baseRequest);
  // 类型: object；作用: 与页面请求共用 Provider 调用和响应身份复查，但不创建页面事务。
  const { response, shouldAdoptResponse } = await fetchSourceDataResponse(
    baseRequest,
    normalizedRequest
  );
  // 条件分支: 统一采用规则拒绝当前响应时进入；执行内容: 返回 null 且不写实体。
  if (!shouldAdoptResponse) return null;
  return commitSourceContentItem(response.item, response.sourceId);
}

// 类型: object。
// 作用: 暴露页面需要的最小内容服务能力，不包含 Provider、注册表、Host 或 Runtime 内部引用。
// 字段: normalizeRequest，Function，同步创建基础 SourceDataRequest。
// 字段: requestData，Function，通过共享 Runtime 请求并提交标准响应。
export const sourceDataService = Object.freeze({
  // 类型: Function。
  // 作用: 供调用方和契约测试单独验证页面请求基础字段。
  normalizeRequest: normalizeSourceDataRequest,

  // 类型: Function。
  // 作用: 供页面按数据块请求内容，并在成功后更新全站内容运行态。
  requestData: requestSourceData,

  // 类型: Function。
  // 作用: 供引用补全按显式身份请求单个实体，不占用 detail 页面事务。
  requestContentItem: requestSourceContentItem
});

// 导出类型: default object。
// 导出内容: 冻结的最小内容数据请求服务门面。
// 外部调用方: 内容页面和内容引用补全服务。
// 使用场景: 页面发起内容请求后继续通过 siteContentStore selector 读取渲染数据。
export default sourceDataService;
