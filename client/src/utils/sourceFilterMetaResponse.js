/*
  sourceFilterMetaResponse.js 模块说明

  - 文件职责:
      提供创建 SourceFilterMetaResponse 的通用工具函数。
      供 mockFilterMetaProxy.js 和后续外部数据源筛选 provider 复用，保证筛选元数据响应结构一致。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      DEFAULT_READY_STATUS: string，筛选元数据成功响应的默认状态。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeFilterMetaRequest(request)
          - params:
              -- request: object，页面或服务层传入的筛选元数据请求对象。
          - return:
              object，补齐 sourceId、pageKey 和 params 后的稳定请求对象。
          - description:
              统一请求字段形状，避免 provider 返回响应时出现缺失 request 结构。
      normalizeFilterGroup(group)
          - params:
              -- group: object，单个筛选组对象。
          - return:
              object，标准化后的筛选组对象。
          - description:
              为每个筛选组补齐 name、label 和 options 数组。
      normalizeFilterOption(option)
          - params:
              -- option: object，单个筛选项对象。
          - return:
              object，标准化后的筛选项对象。
          - description:
              为每个筛选项补齐 label、value、count 和 active 字段。
      createMeta(status, message)
          - params:
              -- status: string，响应状态。
              -- message: string，响应说明。
          - return:
              object，响应元信息。
          - description:
              为每个筛选元数据响应补齐 status、message 和 fetchedAt。

  - 模块级类:
      无

  - 对外导出:
      createSourceFilterMetaResponse: Function，创建标准筛选元数据响应对象。
*/

// 类型: string。
// 作用: 筛选元数据响应没有显式传入状态时使用 ready，表示当前筛选字段已经准备好。
const DEFAULT_READY_STATUS = 'ready';

/**
 * 标准化筛选元数据请求对象。
 * 纯函数: 只基于 request 创建新对象，不修改传入引用。
 * 兜底策略: 缺失字段补为空字符串或空对象，让响应结构稳定。
 *
 * @param {object} request 原始 SourceFilterMetaRequest。
 * @param {string} request.sourceId 请求目标数据源 id。
 * @param {string} request.pageKey 请求目标页面。
 * @param {object} request.params 请求参数集合。
 * @returns {object} 补齐基础字段后的 SourceFilterMetaRequest。
 */
function normalizeFilterMetaRequest(request) {
  // 类型: object。
  // 作用: request 不是对象时使用空对象兜底，避免读取字段时报错。
  const safeRequest = request && typeof request === 'object' ? request : {};

  // 类型: object。
  // 作用: params 不是对象时使用空对象兜底，保证响应 request.params 始终可读取。
  const safeParams = safeRequest.params && typeof safeRequest.params === 'object' ? safeRequest.params : {};

  // 返回值类型: object。
  // 作用: 返回稳定的筛选元数据请求对象，供响应对象回填和后续刷新复用。
  return {
    sourceId: safeRequest.sourceId || '',
    pageKey: safeRequest.pageKey || '',
    params: {
      ...safeParams
    }
  };
}

/**
 * 标准化单个筛选项。
 * 纯函数: 只根据 option 创建新对象，不修改传入对象。
 *
 * @param {object} option 单个筛选项对象。
 * @returns {object} 标准化后的筛选项对象。
 */
function normalizeFilterOption(option) {
  // 类型: object。
  // 作用: option 不是对象时使用空对象兜底，避免读取字段时报错。
  const safeOption = option && typeof option === 'object' ? option : {};

  // 返回值类型: object。
  // 作用: 统一筛选项字段形状，让前端组件只读取固定键名。
  return {
    label: safeOption.label || '',
    value: safeOption.value === undefined ? '' : safeOption.value,
    count: Number.isFinite(Number(safeOption.count)) ? Number(safeOption.count) : 0,
    active: Boolean(safeOption.active)
  };
}

/**
 * 标准化单个筛选组。
 * 纯函数: 只根据 group 创建新对象，不修改传入对象。
 *
 * @param {object} group 单个筛选组对象。
 * @returns {object} 标准化后的筛选组对象。
 */
function normalizeFilterGroup(group) {
  // 类型: object。
  // 作用: group 不是对象时使用空对象兜底，避免读取字段时报错。
  const safeGroup = group && typeof group === 'object' ? group : {};

  // 类型: Array<object>。
  // 作用: 统一把筛选项整理成数组，并逐项补齐字段。
  const options = Array.isArray(safeGroup.options) ? safeGroup.options.map(normalizeFilterOption) : [];

  // 返回值类型: object。
  // 作用: 统一筛选组字段形状，让页面层和筛选组件都能稳定读取。
  return {
    name: safeGroup.name || '',
    label: safeGroup.label || '',
    options
  };
}

/**
 * 创建筛选元数据响应元信息。
 * 纯函数: 除读取当前时间外不修改外部状态。
 *
 * @param {string} status 响应状态。
 * @param {string} message 响应说明。
 * @returns {object} 响应元信息。
 */
function createMeta(status, message) {
  // 返回值类型: object。
  // 作用: 统一筛选元数据的调试信息，便于后续定位字段来源和更新时间。
  return {
    status: status || DEFAULT_READY_STATUS,
    message: message || '',
    fetchedAt: new Date().toISOString()
  };
}

/**
 * 创建标准筛选元数据响应对象。
 * 纯函数: 除 meta.fetchedAt 使用当前时间外，不读取或修改外部状态。
 *
 * @param {object} options 创建筛选元数据响应的参数对象。
 * @param {object} options.request 标准 SourceFilterMetaRequest。
 * @param {Array<object>} options.groups 筛选组数组。
 * @param {string} options.status 响应状态。
 * @param {string} options.message 响应说明。
 * @returns {object} 标准 SourceFilterMetaResponse。
 */
export function createSourceFilterMetaResponse(options) {
  // 类型: object。
  // 作用: options 不是对象时使用空对象兜底，避免读取字段时报错。
  const safeOptions = options && typeof options === 'object' ? options : {};

  // 类型: object。
  // 作用: 标准化请求对象，后续写入筛选元数据 store 时可直接复用。
  const request = normalizeFilterMetaRequest(safeOptions.request);

  // 类型: Array<object>。
  // 作用: 统一筛选组数组结构，避免 provider 返回缺项结构。
  const groups = Array.isArray(safeOptions.groups) ? safeOptions.groups.map(normalizeFilterGroup) : [];

  // 返回值类型: object。
  // 作用: 返回标准筛选元数据响应，sourceFilterService 后续可以直接写入 siteFilterStore。
  return {
    sourceId: request.sourceId,
    pageKey: request.pageKey,
    request,
    groups,
    meta: createMeta(safeOptions.status, safeOptions.message)
  };
}
