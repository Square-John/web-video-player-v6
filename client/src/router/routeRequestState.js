/*
  routeRequestState.js 模块说明

  - 文件职责:
      把目录筛选、搜索关键词和分页状态在 Vue Router query 与页面请求对象之间做统一适配。
      本模块只负责 URL 值校验和新 query 构造，不发起网络请求、不读取 Store、不保存页面响应。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      ROUTE_PAGE_QUERY_KEY: string，所有请求型列表页共用的页码 query 键。
      SEARCH_KEYWORD_QUERY_KEY: string，搜索关键词 query 键。

  - 模块级变量:
      无

  - 模块级辅助函数:
      readQueryText(query, key): 读取 query 中的单值文本。
      normalizeRoutePage(value): 校验正整数页码。
      normalizeFilterValue(value, fallback): 标准化筛选值并回退默认值。
      normalizeFilterSelection(selection, defaults): 隔离并补齐筛选对象。
      resolveRouteRequestName(route): 解析当前路由请求归属。

  - 模块级类:
      无

  - 对外导出:
      ROUTE_PAGE_QUERY_KEY: 供页面和测试复用页码键。
      SEARCH_KEYWORD_QUERY_KEY: 供搜索页和测试复用关键词键。
      createCatalogRouteState: 从目录 query 派生页码和筛选值。
      createCatalogRouteQuery: 从筛选值和页码构造目录请求 query。
      createSearchRouteState: 从搜索 query 派生关键词和页码。
      createSearchRouteQuery: 从关键词和页码构造搜索请求 query。
      createRouteRequestGuard: 记录组件已处理 fullPath，阻止非所属路由和相同地址重复请求。
*/

// 类型: string；作用: 统一目录和搜索分页恢复的 URL 字段，缺失时按第一页处理。
export const ROUTE_PAGE_QUERY_KEY = 'page';

// 类型: string；作用: 统一顶部搜索提交和搜索页请求使用的 URL 字段。
export const SEARCH_KEYWORD_QUERY_KEY = 'keyword';

/**
 * 从 Vue Router query 读取一个稳定文本值。
 * 纯函数: 不修改 query；数组 query 只采用第一项，避免一项请求被多个值污染。
 * 失败路径: 非字符串或空文本返回空字符串。
 *
 * @param {object} query Vue Router query 对象。
 * @param {string} key 需要读取的 query 字段名。
 * @returns {string} 清理后的文本或空字符串。
 */
function readQueryText(query, key) {
  // 类型: string|Array<string>|undefined；作用: 读取 Vue Router 对重复 query 的统一值形态。
  const rawValue = query && typeof query === 'object' ? query[key] : undefined;
  // 类型: string；作用: 数组 query 只取第一项，普通 query 直接读取自身。
  const textValue = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  // 条件分支: query 值不是字符串时进入；执行内容: 返回空值，不做隐式类型转换。
  if (typeof textValue !== 'string') {
    return '';
  }

  return textValue.trim();
}

/**
 * 把任意 query 页码转换为有效正整数。
 * 纯函数: 不修改输入，不依赖页面或分页组件。
 * 失败路径: 空值、非有限数、小数和非正数都回退到第一页。
 *
 * @param {*} value Vue Router query 中的页码候选。
 * @returns {number} 大于等于 1 的整数页码。
 */
export function normalizeRoutePage(value) {
  // 类型: number；作用: 读取 query 文本或分页事件中的数字候选。
  const numericValue = Number(value);

  // 条件分支: 候选不是有限正整数时进入；执行内容: 用统一第一页兜底。
  if (!Number.isFinite(numericValue) || numericValue < 1 || !Number.isInteger(numericValue)) {
    return 1;
  }

  return numericValue;
}

/**
 * 标准化单个筛选值。
 * 纯函数: 不修改默认配置和调用方对象。
 * 失败路径: query 缺失或空白时返回对应默认值。
 *
 * @param {*} value Vue Router query 中的筛选候选。
 * @param {string} fallback 当前页面默认筛选值。
 * @returns {string} 可交给 Provider 的稳定筛选值。
 */
function normalizeFilterValue(value, fallback) {
  // 类型: string；作用: 只接受字符串筛选值，数组值已由调用方统一取首项。
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue || fallback;
}

/**
 * 根据默认筛选配置隔离当前筛选选择。
 * 纯函数: 返回新对象，不让 URL 解析结果反向修改默认配置或页面对象。
 * 失败路径: 非对象选择按全部默认值处理，未知字段不会进入请求。
 *
 * @param {*} selection 当前筛选选择候选。
 * @param {object} defaults 当前目录页面默认筛选对象。
 * @returns {object} 只包含 defaults 字段的标准筛选对象。
 */
function normalizeFilterSelection(selection, defaults) {
  // 类型: object；作用: 过滤异常输入，保证 Object.keys 后续只读取普通对象。
  const safeSelection = selection && typeof selection === 'object' && !Array.isArray(selection)
    ? selection
    : {};
  // 类型: object；作用: 创建与默认筛选键一致的新对象，屏蔽外部额外字段。
  const normalizedSelection = {};

  // 循环类型: Object.keys + for...of；作用: 按页面默认配置逐字段恢复筛选值。
  for (const key of Object.keys(defaults)) {
    normalizedSelection[key] = normalizeFilterValue(safeSelection[key], defaults[key]);
  }

  return normalizedSelection;
}

/**
 * 从目录页面 query 派生当前请求状态。
 * 纯函数: 只读取 query 和默认筛选，不发起请求或修改路由。
 * 成功路径: 缺失 query 使用默认筛选和第一页，合法 query 作为当前请求事实。
 * 失败路径: 非法页码或空筛选值失败关闭到默认请求状态。
 *
 * @param {object} query Vue Router 目录 query。
 * @param {object} defaults 目录页面默认筛选对象。
 * @returns {{page: number, filters: object}} 目录请求状态。
 */
export function createCatalogRouteState(query, defaults) {
  // 类型: object；作用: 从默认配置复制一份查询基线，避免调用方传入非法默认值后产生动态键错误。
  const safeDefaults = defaults && typeof defaults === 'object' && !Array.isArray(defaults)
    ? defaults
    : {};
  // 类型: object；作用: 从 query 逐个读取默认配置声明的筛选字段。
  const queryFilters = {};
  for (const key of Object.keys(safeDefaults)) {
    queryFilters[key] = readQueryText(query, key);
  }

  return {
    // 类型: number；作用: 当前目录请求页码，缺失或非法时稳定回到第一页。
    page: normalizeRoutePage(readQueryText(query, ROUTE_PAGE_QUERY_KEY)),
    // 类型: object；作用: 当前目录请求筛选，字段集合严格跟随页面默认配置。
    filters: normalizeFilterSelection(queryFilters, safeDefaults)
  };
}

/**
 * 构造目录页面请求 query。
 * 纯函数: 返回 baseQuery 的新副本，不修改当前路由对象。
 * 成功路径: 只写入偏离默认值的筛选和大于第一页的页码，保持 URL 简洁且可完整恢复请求。
 * 失败路径: 非法筛选回退默认值，非法页码回到第一页。
 *
 * @param {object} options 构造选项。
 * @param {object} options.baseQuery 当前路由 query，用于保留无关字段。
 * @param {object} options.defaults 当前目录默认筛选。
 * @param {object} options.filters 下一次请求筛选。
 * @param {number} options.page 下一次请求页码。
 * @returns {object} 可交给 Vue Router push/replace 的新 query。
 */
export function createCatalogRouteQuery(options = {}) {
  // 类型: object；作用: 复制当前 query，保留未来不属于本页面请求的合法字段。
  const baseQuery = options.baseQuery && typeof options.baseQuery === 'object' && !Array.isArray(options.baseQuery)
    ? { ...options.baseQuery }
    : {};
  // 类型: object；作用: 读取默认配置，决定管理哪些筛选键和哪些值可以省略。
  const defaults = options.defaults && typeof options.defaults === 'object' && !Array.isArray(options.defaults)
    ? options.defaults
    : {};
  // 类型: object；作用: 只保留默认配置声明的筛选字段，屏蔽页面事件额外数据。
  const filters = normalizeFilterSelection(options.filters, defaults);

  // 循环类型: Object.keys + for...of；作用: 清理当前页面管理的旧筛选字段，避免 query 残留。
  for (const key of Object.keys(defaults)) {
    delete baseQuery[key];
  }
  delete baseQuery[ROUTE_PAGE_QUERY_KEY];

  // 循环类型: Object.keys + for...of；作用: 只把偏离默认值的真实筛选写入 URL。
  for (const key of Object.keys(defaults)) {
    // 条件分支: 当前筛选值偏离默认值时进入；执行内容: 写入该筛选 query，保证刷新能恢复同一请求。
    if (filters[key] !== defaults[key]) {
      baseQuery[key] = filters[key];
    }
  }

  // 类型: number；作用: 把非法页码收敛为第一页，保证 URL 只承载有效请求页码。
  const page = normalizeRoutePage(options.page);
  // 条件分支: 请求页码大于第一页时进入；执行内容: 写入页码，第一页由缺失表达默认值。
  if (page > 1) {
    baseQuery[ROUTE_PAGE_QUERY_KEY] = String(page);
  }

  return baseQuery;
}

/**
 * 从搜索页面 query 派生关键词和页码。
 * 纯函数: 不修改 query、不访问内容 Store 或发起请求。
 * 成功路径: 返回当前 URL 的关键词和页码。
 * 失败路径: 缺失关键词返回空字符串，非法页码回到第一页。
 *
 * @param {object} query Vue Router 搜索 query。
 * @returns {{keyword: string, page: number}} 搜索请求状态。
 */
export function createSearchRouteState(query) {
  return {
    // 类型: string；作用: 顶部搜索提交的当前关键词，空值表示搜索页无关键词。
    keyword: readQueryText(query, SEARCH_KEYWORD_QUERY_KEY),
    // 类型: number；作用: 当前搜索请求页码，缺失时使用第一页。
    page: normalizeRoutePage(readQueryText(query, ROUTE_PAGE_QUERY_KEY))
  };
}

/**
 * 构造搜索页面请求 query。
 * 纯函数: 返回 baseQuery 新副本，保留无关字段并清理旧关键词/页码。
 * 成功路径: 非空关键词写入 keyword，大于第一页写入 page。
 * 失败路径: 空关键词和第一页通过删除字段表达默认状态。
 *
 * @param {object} options 构造选项。
 * @param {object} options.baseQuery 当前路由 query。
 * @param {string} options.keyword 下一次搜索关键词。
 * @param {number} options.page 下一次搜索页码。
 * @returns {object} 可交给 Vue Router push/replace 的新 query。
 */
export function createSearchRouteQuery(options = {}) {
  // 类型: object；作用: 复制当前 query，保护不属于搜索请求的未来字段。
  const query = options.baseQuery && typeof options.baseQuery === 'object' && !Array.isArray(options.baseQuery)
    ? { ...options.baseQuery }
    : {};
  // 类型: string；作用: 标准化关键词并清除旧搜索值后再决定是否写回。
  const keyword = typeof options.keyword === 'string' ? options.keyword.trim() : '';

  delete query[SEARCH_KEYWORD_QUERY_KEY];
  delete query[ROUTE_PAGE_QUERY_KEY];

  // 条件分支: 关键词非空时进入；执行内容: 将用户提交的关键词作为 URL 请求事实保存。
  if (keyword) {
    query[SEARCH_KEYWORD_QUERY_KEY] = keyword;
  }

  // 类型: number；作用: 把非法搜索页码收敛为第一页，保证 URL 只承载有效请求页码。
  const page = normalizeRoutePage(options.page);
  // 条件分支: 搜索页码大于第一页时进入；执行内容: 写入页码，第一页由缺失表达默认值。
  if (page > 1) {
    query[ROUTE_PAGE_QUERY_KEY] = String(page);
  }

  return query;
}

/**
 * 解析路由对象所属的请求页面名称。
 * 纯函数: 只读取 meta.topNavName 和 name，不修改 Router 或页面状态。
 * 成功路径: 上下文路由优先使用 topNavName，普通页面使用自身 name。
 * 失败路径: 路由结构不完整时返回空字符串。
 *
 * @param {*} route Vue Router 当前路由对象。
 * @returns {string} 请求页面名称或空字符串。
 */
function resolveRouteRequestName(route) {
  // 类型: string；作用: 严格详情和播放路由通过 topNavName 归并到对应页面请求守卫。
  const topNavName = route && route.meta && typeof route.meta.topNavName === 'string'
    ? route.meta.topNavName
    : '';
  return topNavName || (route && typeof route.name === 'string' ? route.name : '');
}

/**
 * 创建单个请求页面实例的路由请求身份守卫。
 * 调用方: 电影、电视剧、搜索、详情的 KeepAlive 页面，以及 App 常驻播放宿主的 created/watch 生命周期。
 * 副作用: 只在闭包中记录当前组件已处理的 fullPath，不写 Store、Router、sessionStorage 或页面响应。
 * 成功路径: 所属页面出现新的 fullPath 时返回 true 并采用该身份；离开页面或返回已处理地址返回 false。
 * 失败路径: 路由不属于声明页面、fullPath 缺失或 routeNames 配置无效时拒绝处理或抛出 TypeError。
 *
 * @param {object} options 工厂选项。
 * @param {Array<string>} options.routeNames 当前组件负责的一级或普通命名路由。
 * @returns {Readonly<object>} 当前页面实例独享的请求身份守卫。
 * @throws {TypeError} routeNames 不是非空唯一字符串数组时抛出。
 */
export function createRouteRequestGuard(options = {}) {
  // 条件分支: routeNames 不是非空数组时进入。
  // 执行内容: 拒绝创建无法判断页面归属的请求守卫。
  if (!Array.isArray(options.routeNames) || options.routeNames.length === 0) {
    throw new TypeError('route request guard routeNames 必须是非空数组');
  }

  // 类型: Array<string>；作用: 清理允许的页面名称并拒绝隐式动态键。
  const routeNames = options.routeNames.map((routeName) => {
    // 条件分支: 页面名称不是非空字符串时进入；执行内容: 立即失败关闭配置。
    if (typeof routeName !== 'string' || routeName.trim() === '') {
      throw new TypeError('route request guard 路由名称必须是非空字符串');
    }
    return routeName.trim();
  });
  // 类型: Set<string>；作用: 快速判断全局当前路由是否属于当前请求页面或常驻宿主。
  const routeNameSet = new Set(routeNames);

  // 条件分支: 配置存在重复路由名称时进入。
  // 执行内容: 拒绝模糊页面归属，不默默去重。
  if (routeNameSet.size !== routeNames.length) {
    throw new TypeError('route request guard 路由名称不能重复');
  }

  // 类型: string；生命周期: 当前页面组件实例；作用: 记录最近已经发起请求或采用空状态的完整路由身份。
  let lastHandledFullPath = '';

  /**
   * 校验并读取当前页面负责的 fullPath。
   * 纯函数: 只读取路由对象和闭包白名单，不修改已处理身份。
   * 失败路径: 路由不属于当前页面或 fullPath 无效时返回空字符串。
   *
   * @param {*} route Vue Router 当前路由。
   * @returns {string} 当前页面负责的 fullPath 或空字符串。
   */
  function resolveOwnedFullPath(route) {
    // 类型: string；作用: 把严格详情/播放和普通页面统一映射到当前守卫声明的页面名称。
    const routeName = resolveRouteRequestName(route);
    // 条件分支: 全局当前路由属于其他请求页面时进入。
    // 执行内容: 返回空值，缓存页面和常驻宿主都不得响应其他页面路由变化。
    if (!routeNameSet.has(routeName)) {
      return '';
    }

    // 类型: string；作用: 使用 Vue Router 已编码的完整路径作为唯一请求身份。
    const fullPath = route && typeof route.fullPath === 'string' ? route.fullPath.trim() : '';
    return fullPath.startsWith('/') && !fullPath.startsWith('//') ? fullPath : '';
  }

  return Object.freeze({
    /**
     * 标记当前路由已经由组件初始生命周期处理。
     * 副作用: 更新闭包 lastHandledFullPath，不发起请求或修改 Router。
     * 成功路径: 当前路由属于本页面且 fullPath 合法时返回 true。
     * 失败路径: 其他页面或非法路由返回 false，并保留原处理身份。
     *
     * @param {object} route 当前 Vue Router 路由。
     * @returns {boolean} 是否采用当前处理身份。
     */
    markHandled(route) {
      // 类型: string；作用: 读取当前页面拥有的初始或显式请求地址。
      const fullPath = resolveOwnedFullPath(route);
      // 条件分支: 路由不属于当前页面或路径无效时进入；执行内容: 保留最近处理身份。
      if (!fullPath) {
        return false;
      }
      lastHandledFullPath = fullPath;
      return true;
    },

    /**
     * 判断路由变化是否需要当前缓存页面发起新请求。
     * 副作用: 只在返回 true 时采用新的 lastHandledFullPath，确保同一地址只处理一次。
     * 成功路径: 当前路由属于本页面且 fullPath 与最近处理身份不同时返回 true。
     * 失败路径: 离开页面、返回相同历史地址或非法路由返回 false。
     *
     * @param {object} route Vue Router 最新全局路由。
     * @returns {boolean} 当前页面是否应按新 URL 请求或采用空状态。
     */
    shouldHandle(route) {
      // 类型: string；作用: 读取当前页面拥有的最新请求地址，其他缓存页面返回空值。
      const fullPath = resolveOwnedFullPath(route);
      // 条件分支: 路由不属于当前页面、路径无效或已经处理过时进入。
      // 执行内容: 返回 false，普通离开/返回不触发后台页面请求。
      if (!fullPath || fullPath === lastHandledFullPath) {
        return false;
      }
      lastHandledFullPath = fullPath;
      return true;
    }
  });
}
