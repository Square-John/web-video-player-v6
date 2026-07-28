/*
  siteFilterStore.js 模块说明

  - 文件职责:
      提供统一筛选元数据主干的本地运行态存储对象。
      供 sourceFilterService.js 写入电影页和电视剧页的筛选元数据响应，后续供 CatalogFilterBar 渲染使用。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      FILTER_PAGE_KEYS: Array<string>，支持筛选元数据的页面名称。

  - 模块级变量:
      siteFilterStore: object，全站筛选元数据运行态存储对象。

  - 模块级辅助函数:
      createDefaultFilterRequest(pageKey)
          - params:
              -- pageKey: string，当前筛选元数据所属页面。
          - return:
              object，默认 SourceFilterMetaRequest。
          - description:
              为尚未发起真实请求的筛选桶补齐稳定 request 结构。
      createFilterBucket(pageKey)
          - params:
              -- pageKey: string，当前筛选元数据所属页面。
          - return:
              object，标准筛选元数据桶。
          - description:
              创建电影页或电视剧页的筛选元数据桶。
      createFilterState()
          - params:
              无
          - return:
              object，全站筛选元数据桶集合。
          - description:
              初始化 movie 和 tv 两个正式筛选元数据桶。
      getResponseFetchedAt(response)
          - params:
              -- response: object，SourceFilterMetaResponse。
          - return:
              string，响应时间。
          - description:
              从响应 meta 中读取 fetchedAt，缺失时使用当前时间兜底。
      createFilterCommitPlan(response)
          - params:
              -- response: object，SourceFilterMetaResponse。
          - return:
              object，完成全部读取和目标桶定位的筛选提交计划。
          - description:
              在第一次写入 store 前准备 sourceId、request、groups、updatedAt 和目标桶。
      applyFilterCommitPlan(commitPlan)
          - params:
              -- commitPlan: object，已经完成全部失败检查的筛选提交计划。
          - return:
              object，写入后的筛选元数据桶。
          - description:
              按目标桶、活动身份的固定顺序采用筛选提交计划。

  - 模块级类:
      无

  - 对外导出:
      FILTER_PAGE_KEYS: Array<string>，支持筛选元数据的页面名称。
      createFilterBucket: Function，创建标准筛选元数据桶。
      siteFilterStore: object，全站筛选元数据运行态存储对象。
      resetSiteFilterStore: Function，重置筛选元数据存储。
      getFilterBucket: Function，读取指定筛选元数据桶。
      commitSourceFilterMetaResponse: Function，写入标准筛选元数据响应。
*/

// 类型: Array<string>。
// 作用: 电影页和电视剧页是当前正式消费动态筛选元数据的全部页面，搜索页不建立预留桶。
export const FILTER_PAGE_KEYS = Object.freeze(['movie', 'tv']);

/**
 * 创建默认筛选元数据请求对象。
 * 纯函数: 只根据 pageKey 返回新对象，不读取或修改外部状态。
 *
 * @param {string} pageKey 当前筛选元数据所属页面。
 * @returns {object} 默认 SourceFilterMetaRequest。
 */
function createDefaultFilterRequest(pageKey) {
  // 返回值类型: object。
  // 作用: 为筛选元数据桶提供稳定 request 结构，后续真实请求写入时会整体替换。
  return {
    // 类型: string。
    // 作用: 空桶尚未接收 Runtime 响应，不预先伪造数据源身份。
    sourceId: '',

    // 类型: string。
    // 作用: 标记当前筛选桶所属 movie 或 tv 页面。
    pageKey: pageKey || '',

    // 类型: object。
    // 作用: 保存筛选元数据生成参数；当前正式契约使用空对象。
    params: {}
  };
}

/**
 * 创建筛选元数据桶。
 * 纯函数: 每次调用都返回新的桶对象，不共享 request 和 groups 引用。
 *
 * @param {string} pageKey 当前筛选元数据所属页面。
 * @returns {object} 标准筛选元数据桶。
 */
export function createFilterBucket(pageKey) {
  // 返回值类型: object。
  // 作用: 提供稳定的筛选元数据结构，页面后续只需要读取 groups 渲染筛选按钮。
  return {
    request: createDefaultFilterRequest(pageKey),
    groups: [],
    updatedAt: ''
  };
}

/**
 * 创建全站筛选元数据状态。
 * 纯函数: 每次调用都返回一套新的筛选元数据桶集合。
 *
 * @returns {object} 全站筛选元数据桶集合。
 */
function createFilterState() {
  // 返回值类型: object。
  // 作用: 按页面切分筛选元数据，避免不同页面的筛选字段混在一起。
  return {
    movie: createFilterBucket('movie'),
    tv: createFilterBucket('tv')
  };
}

// 类型: object。
// 作用: 全站筛选元数据运行态存储对象。
// 字段: activeSourceId，string，最近成功提交筛选响应的真实数据源 id。
// 字段: pages，object，按页面切分的筛选元数据桶集合。
export const siteFilterStore = {
  // 类型: string。
  // 作用: 最近成功提交筛选响应的真实 sourceId；初始为空，由第一次标准响应确定。
  activeSourceId: '',

  // 类型: object。
  // 作用: 保存 movie 和 tv 两个正式筛选元数据桶。
  pages: createFilterState()
};

/**
 * 重置全站筛选元数据存储。
 * 副作用: 原地覆盖 siteFilterStore 的 activeSourceId 和 pages。
 *
 * @returns {object} 重置后的 siteFilterStore。
 */
export function resetSiteFilterStore() {
  // 副作用: 清空最近筛选响应身份。
  // 影响范围: 后续未显式传 sourceId 的请求会从共享 Runtime 的 SourceManagerState 重新解析活动源或默认源。
  siteFilterStore.activeSourceId = '';

  // 副作用: 重建所有筛选元数据桶。
  // 影响范围: 清空已写入的 groups 和更新时间。
  siteFilterStore.pages = createFilterState();

  // 返回值类型: object。
  // 作用: 方便测试或调用方读取重置后的筛选元数据 store。
  return siteFilterStore;
}

/**
 * 读取指定筛选元数据桶。
 * 纯函数: 只根据 pageKey 返回已有数据桶引用，不修改 store。
 *
 * @param {string} pageKey 页面名称，只支持 movie 或 tv。
 * @returns {object} 匹配到的筛选元数据桶。
 * @throws {Error} 当 pageKey 不受支持时抛出。
 */
export function getFilterBucket(pageKey) {
  // 条件分支: pageKey 属于支持的筛选页面时进入。
  // 执行内容: 返回目标页面筛选元数据桶。
  if (FILTER_PAGE_KEYS.includes(pageKey)) {
    return siteFilterStore.pages[pageKey];
  }

  // 错误类型: Error。
  // 作用: 阻止未知页面写入或读取筛选元数据。
  throw new Error(`未知筛选元数据桶: ${pageKey || 'empty'}`);
}

/**
 * 从响应对象读取更新时间。
 * 纯函数: 除在缺失 fetchedAt 时读取当前时间外，不修改外部状态。
 *
 * @param {object} response 标准 SourceFilterMetaResponse。
 * @returns {string} 响应时间。
 */
function getResponseFetchedAt(response) {
  // 类型: object。
  // 作用: meta 缺失时使用空对象兜底，避免读取 fetchedAt 报错。
  const meta = response && response.meta && typeof response.meta === 'object' ? response.meta : {};

  // 返回值类型: string。
  // 作用: 优先使用 provider 响应时间；缺失时记录当前写入时间。
  return meta.fetchedAt || new Date().toISOString();
}

/**
 * 创建筛选元数据响应的完整提交计划。
 * 纯函数: 只读取 response 字段和目标桶引用，不修改传入对象或 store。
 * 失败路径: 响应字段 getter、身份校验或目标桶定位失败时抛出 Error，store 保持调用前状态。
 *
 * @param {object} response 待写入的 SourceFilterMetaResponse。
 * @returns {object} 已完成所有可失败准备工作的筛选提交计划。
 * @returns {string} return.sourceId 成功采用后写入 activeSourceId 的真实身份。
 * @returns {object} return.bucket 当前响应目标筛选桶引用。
 * @returns {object} return.bucketValues 待一次采用的 request、groups 和 updatedAt。
 * @throws {Error} 当响应结构不完整或 pageKey 未纳入 store 时抛出。
 */
function createFilterCommitPlan(response) {
  // 条件分支: response 不是对象时进入。
  // 执行内容: 抛出错误，阻止无效响应写入筛选元数据 store。
  if (!response || typeof response !== 'object') {
    throw new Error('SourceFilterMetaResponse 必须是对象');
  }

  // 类型: string。
  // 作用: 当前响应目标页面，决定写入哪个筛选元数据桶。
  const pageKey = response.pageKey || '';

  // 类型: string。
  // 作用: 当前响应真实数据源身份，成功提交后成为筛选运行态活动源。
  const sourceId = typeof response.sourceId === 'string' ? response.sourceId.trim() : '';

  // 条件分支: 标准响应缺少真实 sourceId 时进入。
  // 执行内容: 在筛选桶写入前拒绝匿名响应，避免请求与筛选组来源失去关联。
  if (!sourceId) {
    throw new Error('SourceFilterMetaResponse.sourceId 不能为空');
  }

  // 条件分支: pageKey 不属于支持的筛选页面时进入。
  // 执行内容: 在读取其他响应字段和修改 store 前拒绝未知页面。
  if (!FILTER_PAGE_KEYS.includes(pageKey)) {
    // 错误类型: Error。
    // 作用: 阻止未知页面响应写入筛选元数据 store，避免数据结构失控。
    throw new Error(`SourceFilterMetaResponse.pageKey 未纳入 store: ${pageKey || 'empty'}`);
  }

  // 类型: object。
  // 作用: 提前定位目标筛选桶；定位失败时 activeSourceId 和现有筛选字段都不会变化。
  const bucket = getFilterBucket(pageKey);

  // 类型: object。
  // 作用: 在第一次 store 写入前读取并准备全部筛选响应字段，后续采用阶段不再访问 response getter。
  const bucketValues = {
    // 类型: object。
    // 作用: 保存当前桶最后一次请求；缺失时生成同页面稳定空请求。
    request: response.request || createDefaultFilterRequest(pageKey),

    // 类型: Array<object>。
    // 作用: 保存页面筛选组；非数组响应按空列表准备。
    groups: Array.isArray(response.groups) ? response.groups : [],

    // 类型: string。
    // 作用: 保存响应时间；读取 meta 失败时在任何 store 写入前终止提交。
    updatedAt: getResponseFetchedAt(response)
  };

  // 返回值类型: object。
  // 作用: 返回不再依赖外部 response 的完整筛选提交计划。
  return {
    sourceId,
    bucket,
    bucketValues
  };
}

/**
 * 采用已经准备完成的筛选提交计划。
 * 副作用: 先覆盖目标筛选桶，再最后更新 siteFilterStore.activeSourceId。
 * 前置条件: createFilterCommitPlan 已经完成全部响应 getter 读取、字段转换和目标桶定位。
 *
 * @param {object} commitPlan 筛选提交计划。
 * @param {string} commitPlan.sourceId 成功提交后采用的真实数据源身份。
 * @param {object} commitPlan.bucket 待更新的目标筛选桶。
 * @param {object} commitPlan.bucketValues 已准备完成的 request、groups 和 updatedAt。
 * @returns {object} 写入后的目标筛选桶。
 */
function applyFilterCommitPlan(commitPlan) {
  // 副作用: 保存当前桶最后一次请求。
  // 影响范围: 页面刷新当前筛选字段时可复用同源请求。
  commitPlan.bucket.request = commitPlan.bucketValues.request;

  // 副作用: 保存当前页面筛选组数组。
  // 影响范围: CatalogFilterBar 读取该字段渲染筛选按钮。
  commitPlan.bucket.groups = commitPlan.bucketValues.groups;

  // 副作用: 保存当前桶最后更新时间。
  // 影响范围: 页面状态与链路诊断只会观察到和本次 groups 一致的时间。
  commitPlan.bucket.updatedAt = commitPlan.bucketValues.updatedAt;

  // 副作用: 在目标筛选桶全部采用后最后更新活动源身份。
  // 影响范围: 后续省略 sourceId 的目录请求不会观察到身份先于筛选数据切换的半状态。
  siteFilterStore.activeSourceId = commitPlan.sourceId;

  // 返回值类型: object。
  // 作用: 返回已经完成本次计划采用的目标桶，保持 service 现有返回契约。
  return commitPlan.bucket;
}

/**
 * 写入标准筛选元数据响应。
 * 副作用: 原地覆盖目标筛选元数据桶的 request、groups 和 updatedAt。
 *
 * @param {object} response 标准 SourceFilterMetaResponse。
 * @returns {object} 写入后的筛选元数据桶。
 */
export function commitSourceFilterMetaResponse(response) {
  // 类型: object。
  // 作用: 在第一次 store 写入前完成身份校验、目标桶定位和全部响应字段读取。
  const commitPlan = createFilterCommitPlan(response);

  // 返回值类型: object。
  // 作用: 采用完整筛选计划并返回目标桶；activeSourceId 在桶字段之后最后更新。
  return applyFilterCommitPlan(commitPlan);
}

// 导出类型: default object。
// 导出内容: 全站筛选元数据运行态存储对象。
// 外部调用方: 页面组件、sourceFilterService 和后续调试面板。
// 使用场景: 读取或观察全站筛选元数据桶。
export default siteFilterStore;
