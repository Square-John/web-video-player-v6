/*
  sourceFilterService.js 模块说明

  - 文件职责:
      提供页面请求筛选元数据的统一服务入口。
      负责根据 SourceFilterMetaRequest 选择筛选 provider，等待 provider 返回 SourceFilterMetaResponse，并把响应写入 siteFilterStore。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      MOCK_SOURCE_ID: 自定义数据，默认 mock 数据源 id。
      mockFilterMetaProxy: 自定义服务，mock 阶段的筛选元数据 provider。
      commitSourceFilterMetaResponse/siteFilterStore: 自定义 store，写入和读取全站筛选元数据运行态。

  - 模块级常量:
      sourceFilterProviderRegistry: object，筛选元数据 provider 注册表。
      sourceFilterService: object，筛选元数据请求服务对象。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeSourceFilterMetaRequest(request)
          - params:
              -- request: object，页面传入的筛选元数据请求对象。
          - return:
              object，补齐 sourceId、pageKey 和 params 的 SourceFilterMetaRequest。
          - description:
              把页面请求整理成筛选 provider 可识别的稳定结构。

  - 模块级类:
      无

  - 对外导出:
      sourceFilterProviderRegistry: object，筛选元数据 provider 注册表。
      normalizeSourceFilterMetaRequest: Function，标准化筛选元数据请求。
      registerSourceFilterProvider: Function，注册筛选元数据 provider。
      getSourceFilterProvider: Function，读取指定筛选元数据 provider。
      requestSourceFilterMeta: Function，请求筛选元数据并写入 store。
      sourceFilterService: object，筛选元数据请求服务对象。
*/

// 导入来源: ../data/mock-source.mock。
// 导入内容: MOCK_SOURCE_ID 默认 mock 数据源 id。
// 文件作用: 页面请求没有显式指定 sourceId 时使用 mock 数据源兜底。
import { MOCK_SOURCE_ID } from '../data/mock-source.mock.js';

// 导入来源: ../data/providers/mockFilterMetaProxy。
// 导入内容: mockFilterMetaProxy mock 阶段筛选元数据 provider。
// 文件作用: 当前 mock 阶段由它模拟外部数据源脚本返回标准 SourceFilterMetaResponse。
import mockFilterMetaProxy from '../data/providers/mockFilterMetaProxy.js';

import {
  // 导入来源: ../store/siteFilterStore。
  // 导入内容: commitSourceFilterMetaResponse 响应写入函数。
  // 文件作用: 请求成功后把筛选元数据响应统一落到全站筛选元数据 store 中。
  commitSourceFilterMetaResponse,

  // 导入来源: ../store/siteFilterStore。
  // 导入内容: siteFilterStore 全站筛选元数据运行态对象。
  // 文件作用: 读取当前 activeSourceId，作为页面未传 sourceId 时的默认请求来源。
  siteFilterStore
} from '../store/siteFilterStore.js';

// 类型: object。
// 作用: 筛选元数据 provider 注册表，键为 sourceId，值为具备 fetchFilterMeta(request) 方法的 provider。
// 字段: mock1，object，当前项目唯一 mock 筛选元数据 provider，后续外部数据源会按 sourceId 追加到这里。
export const sourceFilterProviderRegistry = {
  [mockFilterMetaProxy.id]: mockFilterMetaProxy
};

/**
 * 标准化筛选元数据请求对象。
 * 纯函数: 只根据 request 和当前 siteFilterStore.activeSourceId 创建新对象，不修改传入对象。
 *
 * @param {object} request 页面或服务调用方传入的原始筛选元数据请求。
 * @param {string} request.sourceId 请求目标数据源 id。
 * @param {string} request.pageKey 请求目标页面。
 * @param {object} request.params 请求参数集合。
 * @returns {object} 标准 SourceFilterMetaRequest。
 * @throws {Error} 当 pageKey 缺失时抛出。
 */
export function normalizeSourceFilterMetaRequest(request) {
  // 类型: object。
  // 作用: request 不是对象时使用空对象兜底，让后续错误提示集中落在 pageKey 校验。
  const safeRequest = request && typeof request === 'object' ? request : {};

  // 类型: object。
  // 作用: params 不是对象时使用空对象兜底，保证筛选 provider 始终可以读取 params。
  const safeParams = safeRequest.params && typeof safeRequest.params === 'object' ? safeRequest.params : {};

  // 类型: string。
  // 作用: 当前请求目标页面，是筛选 provider 判断返回哪个筛选组的核心字段。
  const pageKey = safeRequest.pageKey || '';

  // 条件分支: pageKey 缺失时进入。
  // 执行内容: 抛出明确错误，避免 provider 收到 unknown 请求后难以定位问题。
  if (!pageKey) {
    throw new Error('SourceFilterMetaRequest.pageKey 不能为空');
  }

  // 返回值类型: object。
  // 作用: 返回筛选 provider 可直接消费的标准请求对象。
  return {
    sourceId: safeRequest.sourceId || siteFilterStore.activeSourceId || MOCK_SOURCE_ID,
    pageKey,
    params: {
      ...safeParams
    }
  };
}

/**
 * 注册筛选元数据 provider。
 * 副作用: 原地写入 sourceFilterProviderRegistry。
 *
 * @param {object} provider 筛选元数据 provider。
 * @param {string} provider.id provider 唯一标识，必须和 SourceFilterMetaRequest.sourceId 对应。
 * @param {Function} provider.fetchFilterMeta provider 筛选元数据请求函数。
 * @returns {object} 注册后的 provider。
 * @throws {Error} 当 provider 缺少 id 或 fetchFilterMeta 时抛出。
 */
export function registerSourceFilterProvider(provider) {
  if (!provider || typeof provider !== 'object' || !provider.id) {
    throw new Error('筛选元数据 provider 必须包含 id');
  }

  if (typeof provider.fetchFilterMeta !== 'function') {
    throw new Error(`筛选元数据 provider 缺少 fetchFilterMeta: ${provider.id}`);
  }

  sourceFilterProviderRegistry[provider.id] = provider;
  return provider;
}

/**
 * 读取指定筛选元数据 provider。
 * 纯函数: 只读取 sourceFilterProviderRegistry，不修改注册表。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {object|null} 匹配到的 provider；不存在时返回 null。
 */
export function getSourceFilterProvider(sourceId) {
  // 类型: string。
  // 作用: 将空 sourceId 兜底为 mock 数据源，保持 mock 阶段调用简单。
  const safeSourceId = sourceId || MOCK_SOURCE_ID;

  return sourceFilterProviderRegistry[safeSourceId] || null;
}

/**
 * 请求筛选元数据并写入全站筛选元数据 store。
 * 副作用: 调用 provider.fetchFilterMeta，并把返回的 SourceFilterMetaResponse 写入 siteFilterStore。
 *
 * @param {object} request 页面或业务服务发起的原始筛选元数据请求。
 * @returns {Promise<object>} 标准 SourceFilterMetaResponse。
 * @throws {Error} 当请求结构、provider 或响应写入出现问题时抛出。
 */
export async function requestSourceFilterMeta(request) {
  // 类型: object。
  // 作用: 标准化请求对象，确保筛选 provider 收到稳定 SourceFilterMetaRequest。
  const normalizedRequest = normalizeSourceFilterMetaRequest(request);

  // 类型: object|null。
  // 作用: 根据 sourceId 找到负责处理当前请求的筛选元数据 provider。
  const provider = getSourceFilterProvider(normalizedRequest.sourceId);

  // 条件分支: provider 未注册时进入。
  // 执行内容: 抛出错误，提示当前数据源暂不可用。
  if (!provider) {
    throw new Error(`筛选元数据 provider 未注册: ${normalizedRequest.sourceId}`);
  }

  // 异步调用: 请求 provider 返回标准 SourceFilterMetaResponse。
  // resolve: 返回对应页面筛选元数据的标准响应。
  // reject: provider 内部校验、统计或读取数据失败时抛出错误。
  const response = await provider.fetchFilterMeta(normalizedRequest);

  // 副作用: 把响应写入全站筛选元数据 store。
  // 影响范围: 对应页面后续会从 siteFilterStore.pages 读取最新筛选字段。
  commitSourceFilterMetaResponse(response);

  // 返回值类型: object。
  // 作用: 返回原始响应给调用方，方便页面处理加载状态或调试响应信息。
  return response;
}

// 类型: object。
// 作用: 筛选元数据请求服务对象，为页面提供统一调用入口。
// 字段: registry，object，provider 注册表。
// 字段: normalizeRequest，Function，请求标准化函数。
// 字段: registerProvider，Function，provider 注册函数。
// 字段: getProvider，Function，provider 读取函数。
// 字段: requestFilterMeta，Function，请求筛选元数据并写入 store 的主函数。
export const sourceFilterService = {
  registry: sourceFilterProviderRegistry,
  normalizeRequest: normalizeSourceFilterMetaRequest,
  registerProvider: registerSourceFilterProvider,
  getProvider: getSourceFilterProvider,
  requestFilterMeta: requestSourceFilterMeta
};

// 导出类型: default object。
// 导出内容: 筛选元数据请求服务对象。
// 外部调用方: MovieView 和后续 TVView、SearchResultView。
// 使用场景: 页面按 pageKey 请求数据源返回的动态筛选字段，并从 siteFilterStore 读取渲染数据。
export default sourceFilterService;
