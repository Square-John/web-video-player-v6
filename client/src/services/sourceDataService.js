/*
  sourceDataService.js 模块说明

  - 文件职责:
      提供页面请求内容数据的统一服务入口。
      负责根据 SourceDataRequest 选择数据源 provider，等待 provider 返回 SourceDataResponse，并把响应写入 siteContentStore。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      MOCK_SOURCE_ID: 自定义数据，默认 mock 数据源 id。
      mockSourceProvider: 自定义服务，mock 阶段的数据源 provider。
      commitSourceDataResponse/siteContentStore: 自定义 store，写入和读取全站内容运行态。

  - 模块级常量:
      sourceProviderRegistry: object，数据源 provider 注册表。
      sourceDataService: object，内容数据请求服务对象。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeSourceDataRequest(request)
          - params:
              -- request: object，页面传入的数据源请求对象。
          - return:
              object，补齐 sourceId、pageKey、moduleKey 和 params 的 SourceDataRequest。
          - description:
              把页面请求整理成 provider 可识别的稳定结构。

  - 模块级类:
      无

  - 对外导出:
      sourceProviderRegistry: object，provider 注册表。
      normalizeSourceDataRequest: Function，标准化数据请求。
      registerSourceProvider: Function，注册数据源 provider。
      getSourceProvider: Function，读取指定 provider。
      requestSourceData: Function，请求数据并写入 store。
      sourceDataService: object，内容数据请求服务对象。
*/

// 导入来源: ../data/mock-source.mock。
// 导入内容: MOCK_SOURCE_ID 默认 mock 数据源 id。
// 文件作用: 页面请求没有显式指定 sourceId 时使用 mock 数据源兜底。
import { MOCK_SOURCE_ID } from '../data/mock-source.mock.js';

// 导入来源: ../data/providers/mockSourceProvider。
// 导入内容: mockSourceProvider mock 数据源 provider。
// 文件作用: 当前 mock 阶段由它模拟外部数据源脚本返回标准 SourceDataResponse。
import mockSourceProvider from '../data/providers/mockSourceProvider.js';

import {
  // 导入来源: ../store/siteContentStore。
  // 导入内容: commitSourceDataResponse 响应写入函数。
  // 文件作用: 请求成功后把 provider 响应统一落到全站内容 store 中。
  commitSourceDataResponse,

  // 导入来源: ../store/siteContentStore。
  // 导入内容: siteContentStore 全站内容运行态对象。
  // 文件作用: 读取当前 activeSourceId，作为页面未传 sourceId 时的默认请求来源。
  siteContentStore
} from '../store/siteContentStore.js';

// 类型: object。
// 作用: 数据源 provider 注册表，键为 sourceId，值为具备 fetchData(request) 方法的 provider。
// 字段: mock-source，object，当前项目唯一 mock provider，后续外部数据源会按 sourceId 追加到这里。
export const sourceProviderRegistry = {
  // 类型: object。
  // 作用: mock 数据源 provider，模拟外部数据源脚本的数据请求、清洗和响应返回流程。
  [mockSourceProvider.id]: mockSourceProvider
};

/**
 * 标准化数据源请求对象。
 * 纯函数: 只根据 request 和当前 siteContentStore.activeSourceId 创建新对象，不修改传入对象。
 * 兜底策略: sourceId 缺失时优先使用 store 当前数据源，再回退 mock 数据源。
 *
 * @param {object} request 页面或服务调用方传入的原始请求。
 * @param {string} request.sourceId 请求目标数据源 id。
 * @param {string} request.pageKey 请求目标页面。
 * @param {string} request.moduleKey 请求目标页面区域。
 * @param {object} request.params 请求参数集合。
 * @returns {object} 标准 SourceDataRequest。
 * @throws {Error} 当 pageKey 缺失时抛出。
 */
export function normalizeSourceDataRequest(request) {
  // 类型: object。
  // 作用: request 不是对象时使用空对象兜底，让后续错误提示集中落在 pageKey 校验。
  const safeRequest = request && typeof request === 'object' ? request : {};

  // 类型: object。
  // 作用: params 不是对象时使用空对象兜底，保证 provider 始终可以读取 params。
  const safeParams = safeRequest.params && typeof safeRequest.params === 'object' ? safeRequest.params : {};

  // 类型: string。
  // 作用: 当前请求目标页面，是 provider 判断返回哪个数据桶的核心字段。
  const pageKey = safeRequest.pageKey || '';

  // 条件分支: pageKey 缺失时进入。
  // 执行内容: 抛出明确错误，避免 provider 收到 unknown 请求后难以定位问题。
  if (!pageKey) {
    throw new Error('SourceDataRequest.pageKey 不能为空');
  }

  // 返回值类型: object。
  // 作用: 返回 provider 可直接消费的标准请求对象。
  return {
    // 类型: string。
    // 作用: 请求目标数据源 id，决定 sourceDataService 从哪个 provider 取数据。
    sourceId: safeRequest.sourceId || siteContentStore.activeSourceId || MOCK_SOURCE_ID,

    // 类型: string。
    // 作用: 请求目标页面，例如 home、movie、tv、search、detail 或 player。
    pageKey,

    // 类型: string。
    // 作用: 请求目标页面区域，首页必须传入具体数据桶，单列表和单内容页面允许为空。
    moduleKey: safeRequest.moduleKey || '',

    // 类型: object。
    // 作用: 请求参数集合，常见字段包括 page、pageSize、keyword、contentId 和 episodeId。
    params: {
      ...safeParams
    }
  };
}

/**
 * 注册数据源 provider。
 * 副作用: 原地写入 sourceProviderRegistry。
 * 使用场景: 后续外部数据源脚本加载完成后，把 provider 暴露给统一请求服务。
 *
 * @param {object} provider 数据源 provider。
 * @param {string} provider.id provider 唯一标识，必须和 SourceDataRequest.sourceId 对应。
 * @param {Function} provider.fetchData provider 数据请求函数。
 * @returns {object} 注册后的 provider。
 * @throws {Error} 当 provider 缺少 id 或 fetchData 时抛出。
 */
export function registerSourceProvider(provider) {
  // 条件分支: provider 不是对象或缺少 id 时进入。
  // 执行内容: 抛出注册错误，避免 providerRegistry 出现空键。
  if (!provider || typeof provider !== 'object' || !provider.id) {
    throw new Error('数据源 provider 必须包含 id');
  }

  // 条件分支: provider.fetchData 不是函数时进入。
  // 执行内容: 抛出注册错误，保证后续请求可以统一调用 fetchData。
  if (typeof provider.fetchData !== 'function') {
    throw new Error(`数据源 provider 缺少 fetchData: ${provider.id}`);
  }

  // 副作用: 写入 provider 注册表。
  // 影响范围: 后续同 sourceId 的 request 会使用该 provider 处理。
  sourceProviderRegistry[provider.id] = provider;

  // 返回值类型: object。
  // 作用: 返回已注册 provider，方便调用方确认注册对象。
  return provider;
}

/**
 * 读取指定数据源 provider。
 * 纯函数: 只读取 sourceProviderRegistry，不修改注册表。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {object|null} 匹配到的 provider；不存在时返回 null。
 */
export function getSourceProvider(sourceId) {
  // 类型: string。
  // 作用: 将空 sourceId 兜底为 mock 数据源，保持 mock 阶段调用简单。
  const safeSourceId = sourceId || MOCK_SOURCE_ID;

  // 返回值类型: object|null。
  // 作用: 返回匹配 provider；没有注册时返回 null，由请求函数抛出更明确错误。
  return sourceProviderRegistry[safeSourceId] || null;
}

/**
 * 请求数据源数据并写入全站内容 store。
 * 副作用: 调用 provider.fetchData，并把返回的 SourceDataResponse 写入 siteContentStore。
 * 成功路径: 返回 provider 的标准响应对象。
 * 失败路径: 请求缺少 pageKey、provider 不存在、provider 抛错或 store 写入失败时抛出 Error。
 *
 * @param {object} request 页面或业务服务发起的原始数据请求。
 * @param {string} request.sourceId 请求目标数据源 id。
 * @param {string} request.pageKey 请求目标页面。
 * @param {string} request.moduleKey 请求目标页面区域。
 * @param {object} request.params 请求参数集合。
 * @returns {Promise<object>} 标准 SourceDataResponse。
 * @throws {Error} 当请求结构、provider 或响应写入出现问题时抛出。
 */
export async function requestSourceData(request) {
  // 类型: object。
  // 作用: 标准化请求对象，确保 provider 收到稳定 SourceDataRequest。
  const normalizedRequest = normalizeSourceDataRequest(request);

  // 类型: object|null。
  // 作用: 根据 sourceId 找到负责处理当前请求的数据源 provider。
  const provider = getSourceProvider(normalizedRequest.sourceId);

  // 条件分支: provider 未注册时进入。
  // 执行内容: 抛出错误，提示当前数据源暂不可用。
  if (!provider) {
    throw new Error(`数据源 provider 未注册: ${normalizedRequest.sourceId}`);
  }

  // 异步调用: 请求 provider 返回标准 SourceDataResponse。
  // resolve: 返回对应页面数据桶的标准响应。
  // reject: provider 内部校验、清洗或读取数据失败时抛出错误。
  const response = await provider.fetchData(normalizedRequest);

  // 副作用: 把响应写入全站内容 store。
  // 影响范围: 对应页面或组件后续会从 siteContentStore.pages 读取最新内容。
  commitSourceDataResponse(response);

  // 返回值类型: object。
  // 作用: 返回原始响应给调用方，方便页面处理加载状态或调试响应信息。
  return response;
}

// 类型: object。
// 作用: 内容数据请求服务对象，为页面提供统一调用入口。
// 字段: registry，object，provider 注册表。
// 字段: normalizeRequest，Function，请求标准化函数。
// 字段: registerProvider，Function，provider 注册函数。
// 字段: getProvider，Function，provider 读取函数。
// 字段: requestData，Function，请求数据并写入 store 的主函数。
export const sourceDataService = {
  // 类型: object。
  // 作用: 暴露 provider 注册表，便于调试和后续源管理模块读取当前已注册源。
  registry: sourceProviderRegistry,

  // 类型: Function。
  // 作用: 暴露请求标准化能力，便于测试单独校验请求结构。
  normalizeRequest: normalizeSourceDataRequest,

  // 类型: Function。
  // 作用: 暴露 provider 注册能力，后续外部数据源加载后通过该入口接入。
  registerProvider: registerSourceProvider,

  // 类型: Function。
  // 作用: 暴露 provider 读取能力，便于调试当前 sourceId 是否可请求。
  getProvider: getSourceProvider,

  // 类型: Function。
  // 作用: 页面请求内容数据的统一入口，请求成功后自动写入 siteContentStore。
  requestData: requestSourceData
};

// 导出类型: default object。
// 导出内容: 内容数据请求服务对象。
// 外部调用方: 后续首页、电影页、电视剧页、搜索页、详情页和播放页。
// 使用场景: 页面按数据桶发起请求，并从 siteContentStore 读取渲染数据。
export default sourceDataService;
