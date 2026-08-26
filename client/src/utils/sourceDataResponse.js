/*
  sourceDataResponse.js 模块说明
      createHomeModuleRequest(request, moduleRequest): 为完整首页事务创建不含批量参数的单模块请求。

  - 文件职责:
      提供创建 SourceDataResponse 的通用工具函数。
      供全部受管 Provider 复用，保证列表响应与单内容响应结构一致。
      创建结果经 SourceExecutionHost 和 SourceRuntime 返回 sourceDataService，再由内容 store 的提交计划统一采用。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      DEFAULT_PAGE: number，分页请求缺省页码。
      DEFAULT_PAGE_SIZE: number，分页请求缺省每页数量。
      DEFAULT_READY_STATUS: string，成功响应缺省状态。

  - 模块级变量:
      无

  - 模块级辅助函数:
      toPositiveInteger(value, fallback)
          - params:
              -- value: any，待转换的分页数字。
              -- fallback: number，转换失败时使用的兜底数字。
          - return:
              number，正整数分页值。
          - description:
              将请求参数中的 page 和 pageSize 统一转换成可用于数组分页的正整数。
      normalizeRequest(request)
          - params:
              -- request: object，页面或服务层传入的数据请求对象。
          - return:
              object，补齐基础字段后的 SourceDataRequest。
          - description:
              统一 request 字段形状，避免 provider 返回响应时出现缺少 params 的结构。
      createPagination(params, total)
          - params:
              -- params: object，请求参数对象。
              -- total: number，当前列表总条数。
          - return:
              object，标准分页信息。
          - description:
              根据请求页码、每页数量和总条数计算 SourceDataResponse.pagination。
      sliceItemsByPagination(items, pagination)
          - params:
              -- items: Array<object>，完整候选内容列表。
              -- pagination: object，标准分页对象。
          - return:
              Array<object>，当前页内容列表。
          - description:
              按 page 和 pageSize 截取列表，模拟真实数据源分页返回。
      createMeta(status, message)
          - params:
              -- status: string，响应状态。
              -- message: string，响应说明。
          - return:
              object，响应元信息。
          - description:
              为每个响应补齐 status、message 和 fetchedAt，方便调试数据流。

  - 模块级类:
      无

  - 对外导出:
      createListSourceDataResponse: Function，创建列表型 SourceDataResponse。
      createItemSourceDataResponse: Function，创建详情页或播放页 SourceDataResponse。
      createHomeSourceDataResponse: Function，创建一次首页加载返回的五模块结果响应。
*/

// 类型: number。
// 作用: 请求没有提供页码时使用第一页，避免列表响应出现 page 为 undefined。
const DEFAULT_PAGE = 1;

// 类型: number。
// 作用: 请求没有提供每页数量时使用 20 条，保证分页计算有稳定默认值。
const DEFAULT_PAGE_SIZE = 20;

// 类型: string。
// 作用: 响应没有显式传入状态时使用 ready，表示当前数据块已经准备好。
const DEFAULT_READY_STATUS = 'ready';

// 类型: object。
// 作用: 冻结首页模块结果和根响应状态，Store 与测试不依赖自由文本判断成功、局部失败或全部失败。
const HOME_RESPONSE_STATUS = Object.freeze({ success: 'success', error: 'error', partial: 'partial' });

/**
 * 将任意输入转换成正整数。
 * 纯函数: 相同 value 和 fallback 输入始终返回相同数字，不读取或修改外部状态。
 * 兜底策略: value 不是正整数时返回 fallback，保证分页计算不会出现 NaN。
 *
 * @param {*} value 待转换的分页数字。
 * @param {number} fallback 转换失败时使用的兜底数字。
 * @returns {number} 可用于分页计算的正整数。
 */
function toPositiveInteger(value, fallback) {
  // 类型: number。
  // 作用: 将字符串或数字输入统一转换成 Number，便于后续判断是否可用于分页。
  const numericValue = Number(value);

  // 条件分支: numericValue 是有限数字且大于 0 时进入。
  // 执行内容: 向下取整，避免小数页码导致数组切片边界不稳定。
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.floor(numericValue);
  }

  // 返回值类型: number。
  // 作用: 输入不可用时返回兜底值，保证分页函数始终输出正整数。
  return fallback;
}

/**
 * 从首页完整加载请求创建一个单模块标准请求。
 * 纯函数: 只复制 sourceId/pageKey 和模块 page/pageSize，不把 moduleRequests 批量计划嵌套回单模块响应。
 * 失败路径: moduleRequest 字段校验由 createHomeSourceDataResponse 统一完成。
 *
 * @param {object} request 已标准化首页完整加载请求。
 * @param {object} moduleRequest 当前模块请求声明。
 * @returns {object} 可用于单模块 SourceDataResponse 的标准请求。
 */
function createHomeModuleRequest(request, moduleRequest) {
  return {
    sourceId: request.sourceId,
    pageKey: 'home',
    moduleKey: moduleRequest.moduleKey,
    params: {
      page: moduleRequest.page,
      pageSize: moduleRequest.pageSize
    }
  };
}

/**
 * 创建首页完整加载标准响应。
 * 纯函数: 除各响应 meta.fetchedAt 读取当前时间外，只隔离输入并组合五个模块结果。
 * 成功路径: 每个请求模块按相同顺序形成 success + response 或 error + 安全错误，根状态表达 ready/partial/error。
 * 失败路径: 根请求、模块数量、顺序或结果组合无效时抛 TypeError，不返回半合法批量响应。
 *
 * @param {object} options 首页响应创建参数。
 * @param {object} options.request moduleKey 为空且含 moduleRequests 的首页请求。
 * @param {Array<object>} options.moduleResults 与 moduleRequests 同序的模块候选结果。
 * @returns {object} 首页完整加载 SourceDataResponse。
 * @throws {TypeError} 请求和模块结果不能形成一一对应关系时抛出。
 */
export function createHomeSourceDataResponse(options) {
  // 类型: object；作用: 先复用基础请求隔离，再检查首页完整加载专属字段。
  const request = normalizeRequest(options?.request);
  // 类型: Array<object>；作用: 读取调用方已经按首页正式顺序建立的模块请求和结果。
  const moduleRequests = options?.request?.params?.moduleRequests;
  // 类型: Array<object>；作用: 读取与 moduleRequests 一一对应的 Provider 模块候选结果。
  const moduleCandidates = options?.moduleResults;
  // 条件分支: 根身份、模块请求数组或候选结果数量不能形成有效首页批次时进入；执行内容: 在构造任何响应前拒绝批次。
  if (request.pageKey !== 'home'
    || request.moduleKey !== ''
    || !Array.isArray(moduleRequests)
    || moduleRequests.length === 0
    || !Array.isArray(moduleCandidates)
    || moduleCandidates.length !== moduleRequests.length) {
    throw new TypeError('首页完整加载请求与模块结果数量无效');
  }

  // 类型: Set<string>；作用: 拒绝重复模块身份，避免同一 PageBucket 被批量响应覆盖两次。
  const seenModuleKeys = new Set();
  // 循环类型: Array.prototype.map；作用: 按请求顺序创建精确模块结果，不根据候选数组位置猜测 moduleKey。
  const moduleResults = moduleRequests.map((moduleRequest, index) => {
    // 类型: object；作用: 读取当前位置必须与模块请求身份一致的唯一候选结果。
    const candidate = moduleCandidates[index];
    // 条件分支: 模块请求分页、身份、唯一性或候选身份无效时进入；执行内容: 拒绝位置猜测和重复模块结果。
    if (!moduleRequest
      || typeof moduleRequest !== 'object'
      || typeof moduleRequest.moduleKey !== 'string'
      || !moduleRequest.moduleKey
      || seenModuleKeys.has(moduleRequest.moduleKey)
      || !Number.isSafeInteger(moduleRequest.page)
      || moduleRequest.page < 1
      || !Number.isSafeInteger(moduleRequest.pageSize)
      || moduleRequest.pageSize < 1
      || !candidate
      || typeof candidate !== 'object'
      || candidate.moduleKey !== moduleRequest.moduleKey) {
      throw new TypeError('首页模块请求或结果身份无效');
    }
    seenModuleKeys.add(moduleRequest.moduleKey);

    // 条件分支: Provider 为当前模块返回标准失败候选时进入；执行内容: 校验安全错误并创建无响应体的失败结果。
    if (candidate.error) {
      // 条件分支: 失败候选缺少稳定 code 或安全 message 时进入；执行内容: 拒绝向页面传播不完整或原始异常。
      if (typeof candidate.error.code !== 'string'
        || !candidate.error.code.trim()
        || typeof candidate.error.message !== 'string'
        || !candidate.error.message.trim()) {
        throw new TypeError('首页模块失败必须提供稳定 code 和安全 message');
      }
      return {
        moduleKey: moduleRequest.moduleKey,
        status: HOME_RESPONSE_STATUS.error,
        response: null,
        error: {
          code: candidate.error.code.trim(),
          message: candidate.error.message.trim()
        }
      };
    }

    return {
      moduleKey: moduleRequest.moduleKey,
      status: HOME_RESPONSE_STATUS.success,
      response: createListSourceDataResponse({
        request: createHomeModuleRequest(request, moduleRequest),
        items: candidate.items,
        status: candidate.status,
        message: candidate.message
      }),
      error: null
    };
  });

  // 类型: number；作用: 根状态只统计明确失败项，空成功列表仍是合法成功模块。
  const failedCount = moduleResults.filter(result => result.status === HOME_RESPONSE_STATUS.error).length;
  // 类型: string；作用: 根据失败数量表达整批 ready、partial 或 error，不覆盖各模块自己的终态。
  const rootStatus = failedCount === 0
    ? DEFAULT_READY_STATUS
    : failedCount === moduleResults.length ? HOME_RESPONSE_STATUS.error : HOME_RESPONSE_STATUS.partial;
  return {
    sourceId: request.sourceId,
    pageKey: 'home',
    moduleKey: '',
    request: {
      ...request,
      params: {
        ...request.params,
        moduleRequests: moduleRequests.map(moduleRequest => ({ ...moduleRequest }))
      }
    },
    pagination: null,
    items: [],
    item: null,
    moduleResults,
    meta: createMeta(rootStatus, '')
  };
}

/**
 * 标准化请求对象。
 * 纯函数: 只基于 request 创建新对象，不修改传入引用。
 * 兜底策略: 缺失字段补为空字符串或空对象，让响应结构稳定。
 *
 * @param {object} request 原始 SourceDataRequest。
 * @param {string} request.sourceId 请求目标数据源 id。
 * @param {string} request.pageKey 请求目标页面。
 * @param {string} request.moduleKey 请求目标页面区域。
 * @param {object} request.params 请求参数集合。
 * @returns {object} 补齐基础字段后的 SourceDataRequest。
 */
function normalizeRequest(request) {
  // 类型: object。
  // 作用: request 不是对象时使用空对象兜底，避免读取字段时报错。
  const safeRequest = request && typeof request === 'object' ? request : {};

  // 类型: object。
  // 作用: params 不是对象时使用空对象兜底，保证响应 request.params 始终可读取。
  const safeParams = safeRequest.params && typeof safeRequest.params === 'object' ? safeRequest.params : {};

  // 返回值类型: object。
  // 作用: 返回稳定 SourceDataRequest 结构，供响应对象回填和后续重试使用。
  return {
    // 类型: string。
    // 作用: 标记当前响应所属数据源。
    sourceId: safeRequest.sourceId || '',

    // 类型: string。
    // 作用: 标记当前响应所属页面。
    pageKey: safeRequest.pageKey || '',

    // 类型: string。
    // 作用: 标记当前响应所属页面区域，单列表页面和单内容页面允许为空字符串。
    moduleKey: safeRequest.moduleKey || '',

    // 类型: object。
    // 作用: 复制请求参数，避免响应对象和调用方继续共享同一个 params 引用。
    params: {
      ...safeParams
    }
  };
}

/**
 * 创建标准分页对象。
 * 纯函数: 只基于 params 和 total 计算分页结果，不读取或修改外部状态。
 *
 * @param {object} params 请求参数对象。
 * @param {number} total 当前列表总条数。
 * @returns {object} 标准 pagination 对象。
 * @returns {number} return.page 当前页码。
 * @returns {number} return.pageSize 每页数量。
 * @returns {number} return.total 总条数。
 * @returns {number} return.totalPages 总页数。
 * @returns {boolean} return.hasMore 是否还有下一页。
 */
function createPagination(params, total) {
  // 类型: number。
  // 作用: 当前页码，缺失或非法时回到第一页。
  const page = toPositiveInteger(params.page, DEFAULT_PAGE);

  // 类型: number。
  // 作用: 每页数量，缺失或非法时使用默认数量。
  const pageSize = toPositiveInteger(params.pageSize, DEFAULT_PAGE_SIZE);

  // 类型: number。
  // 作用: 当前列表总条数，非法输入按 0 处理，避免 totalPages 计算异常。
  const safeTotal = Number.isFinite(Number(total)) && Number(total) > 0 ? Math.floor(Number(total)) : 0;

  // 类型: number。
  // 作用: 根据总条数和每页数量计算总页数，空列表时固定为 0。
  const totalPages = safeTotal > 0 ? Math.ceil(safeTotal / pageSize) : 0;

  // 返回值类型: object。
  // 作用: 返回标准分页信息，页面可据此展示分页或加载更多入口。
  return {
    // 类型: number。
    // 作用: 当前页码。
    page,

    // 类型: number。
    // 作用: 每页数量。
    pageSize,

    // 类型: number。
    // 作用: 当前请求条件下的总条数。
    total: safeTotal,

    // 类型: number。
    // 作用: 当前请求条件下的总页数。
    totalPages,

    // 类型: boolean。
    // 作用: true 表示还有下一页，false 表示当前页已经是最后一页或没有数据。
    hasMore: totalPages > 0 && page < totalPages
  };
}

/**
 * 按分页对象截取当前页列表。
 * 纯函数: 只读取 items 和 pagination，不修改传入数组。
 *
 * @param {Array<object>} items 完整候选内容列表。
 * @param {object} pagination 标准分页对象。
 * @param {number} pagination.page 当前页码。
 * @param {number} pagination.pageSize 每页数量。
 * @returns {Array<object>} 当前页内容列表。
 */
function sliceItemsByPagination(items, pagination) {
  // 类型: Array<object>。
  // 作用: 确保候选列表一定是数组，避免 provider 返回异常结构。
  const safeItems = Array.isArray(items) ? items : [];

  // 类型: number。
  // 作用: 数组切片起始下标，第一页从 0 开始。
  const startIndex = (pagination.page - 1) * pagination.pageSize;

  // 类型: number。
  // 作用: 数组切片结束下标，模拟服务端分页返回当前页数量。
  const endIndex = startIndex + pagination.pageSize;

  // 返回值类型: Array<object>。
  // 作用: 返回当前页数据，调用方会把这些内容归一化写入实体池，并在 PageBucket.itemKeys 保存引用。
  return safeItems.slice(startIndex, endIndex);
}

/**
 * 创建响应元信息。
 * 纯函数: 除读取当前时间外不修改外部状态。
 * 时间副作用: 使用 new Date() 生成 fetchedAt，方便调试响应创建时间。
 *
 * @param {string} status 响应状态。
 * @param {string} message 响应说明。
 * @returns {object} 响应元信息。
 */
function createMeta(status, message) {
  // 返回值类型: object。
  // 作用: 统一响应调试信息，后续页面或调试面板可根据 status 和 message 展示状态。
  return {
    // 类型: string。
    // 作用: 响应状态，ready 表示成功，empty 表示无数据，unsupported 表示数据块暂不支持。
    status: status || DEFAULT_READY_STATUS,

    // 类型: string。
    // 作用: 响应说明，主要用于开发调试和后续错误提示转换。
    message: message || '',

    // 类型: string。
    // 作用: 响应生成时间，记录当前数据块最后一次被 provider 返回的时间。
    fetchedAt: new Date().toISOString()
  };
}

/**
 * 创建列表型 SourceDataResponse。
 * 纯函数: 除 meta.fetchedAt 使用当前时间外，不读取或修改外部状态。
 * 使用场景: 首页区域、电影页、电视剧页和搜索页。
 *
 * @param {object} options 创建列表响应的参数对象。
 * @param {object} options.request 标准 SourceDataRequest。
 * @param {Array<object>} options.items 完整候选 ContentItem 列表。
 * @param {string} options.status 响应状态。
 * @param {string} options.message 响应说明。
 * @returns {object} 标准 SourceDataResponse。
 */
export function createListSourceDataResponse(options) {
  // 类型: object。
  // 作用: options 不是对象时使用空对象兜底，避免读取字段时报错。
  const safeOptions = options && typeof options === 'object' ? options : {};

  // 类型: object。
  // 作用: 标准化请求对象，后续写入 PageBucket.request。
  const request = normalizeRequest(safeOptions.request);

  // 类型: Array<object>。
  // 作用: 完整候选内容列表，分页截取前保留全部数据量用于计算 total。
  const allItems = Array.isArray(safeOptions.items) ? safeOptions.items : [];

  // 类型: object。
  // 作用: 根据请求分页参数和候选列表长度创建标准分页信息。
  const pagination = createPagination(request.params, allItems.length);

  // 类型: Array<object>。
  // 作用: 当前页要返回给 store 的内容列表，后续会转换成 PageBucket.itemKeys。
  const items = sliceItemsByPagination(allItems, pagination);

  // 返回值类型: object。
  // 作用: 返回列表型标准响应，sourceDataService 后续可直接写入目标 PageBucket。
  return {
    // 类型: string。
    // 作用: 响应所属数据源。
    sourceId: request.sourceId,

    // 类型: string。
    // 作用: 响应所属页面。
    pageKey: request.pageKey,

    // 类型: string。
    // 作用: 响应所属页面区域。
    moduleKey: request.moduleKey,

    // 类型: object。
    // 作用: 原始请求回填，页面后续刷新当前数据块时可复用。
    request,

    // 类型: object。
    // 作用: 当前列表分页信息。
    pagination,

    // 类型: Array<object>。
    // 作用: 当前页内容列表，每一项都应是 ContentItem。
    items,

    // 类型: object|null。
    // 作用: 列表型响应没有单内容 item，固定为 null。
    item: null,

    // 类型: object。
    // 作用: 响应调试信息。
    meta: createMeta(safeOptions.status, safeOptions.message)
  };
}

/**
 * 创建单内容 SourceDataResponse。
 * 纯函数: 除 meta.fetchedAt 使用当前时间外，不读取或修改外部状态。
 * 使用场景: 详情页和播放页。
 *
 * @param {object} options 创建单内容响应的参数对象。
 * @param {object} options.request 标准 SourceDataRequest。
 * @param {object|null} options.item 当前详情或播放内容。
 * @param {string} options.status 响应状态。
 * @param {string} options.message 响应说明。
 * @returns {object} 标准 SourceDataResponse。
 */
export function createItemSourceDataResponse(options) {
  // 类型: object。
  // 作用: options 不是对象时使用空对象兜底，避免读取字段时报错。
  const safeOptions = options && typeof options === 'object' ? options : {};

  // 类型: object。
  // 作用: 标准化请求对象，后续写入 detail/player 请求记录时可复用。
  const request = normalizeRequest(safeOptions.request);

  // 类型: object|null。
  // 作用: 当前单内容页内容对象；没有匹配内容时固定为 null。
  const item = safeOptions.item || null;

  // 返回值类型: object。
  // 作用: 返回单内容标准响应，sourceDataService 后续可写入 detail/player 的 currentKey。
  return {
    // 类型: string。
    // 作用: 响应所属数据源。
    sourceId: request.sourceId,

    // 类型: string。
    // 作用: 响应所属页面。
    pageKey: request.pageKey,

    // 类型: string。
    // 作用: 详情页和播放页没有区域，通常为空字符串。
    moduleKey: request.moduleKey,

    // 类型: object。
    // 作用: 原始请求回填，后续刷新当前详情或播放内容时可复用。
    request,

    // 类型: object|null。
    // 作用: 单内容响应没有列表分页，固定为 null。
    pagination: null,

    // 类型: Array<object>。
    // 作用: 单内容响应不使用 items，固定为空数组。
    items: [],

    // 类型: object|null。
    // 作用: 当前详情或播放内容，是增强版 ContentItem。
    item,

    // 类型: object。
    // 作用: 响应调试信息；没有 item 时自动给出 empty 状态。
    meta: createMeta(item ? safeOptions.status : 'empty', item ? safeOptions.message : '没有匹配的数据源内容')
  };
}
