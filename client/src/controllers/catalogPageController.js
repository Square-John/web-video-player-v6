/*
  catalogPageController.js 模块说明

  - 文件职责:
      为电影页和电视剧页创建同一套 Vue 2 目录请求控制器。
      统一 URL 筛选、分页、切源、请求事务、筛选元数据和 KeepAlive 路由守卫，页面只保留文案、模板与默认筛选配置。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      requestSourceData: 自定义服务，提交统一目录内容请求。
      requestSourceFilterMeta: 自定义服务，提交统一目录筛选元数据请求。
      siteContentStore selectors: 自定义 Store 接口，读取卡片、分页和请求事务。
      siteFilterStore: 自定义 Store，读取当前目录筛选元数据桶。
      routeRequestState helpers: 自定义路由工具，解析和构造目录 URL 并隔离 KeepAlive 请求。
      pageRequestStateSelectors: 自定义 selector，把 PageBucket 事务投影为页面状态。

  - 模块级常量:
      CATALOG_PAGE_SIZE: number，电影页和电视剧页正式逻辑页容量。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeCatalogPageControllerConfig(config): Readonly<object>，校验并冻结目录页面配置。
      normalizeCatalogPageNumber(page): number，把页码收敛为正整数。
      createCatalogPageController(config): object，创建可由电影页或电视剧页 mixin 使用的控制器选项。

  - 模块级类:
      无

  - 对外导出:
      createCatalogPageController: Function，创建电影和电视剧共用的目录控制器。
*/

// 导入来源: ../services/sourceDataService.js；导入内容: requestSourceData 自定义服务；文件作用: 提交标准目录内容请求并由统一事务采用响应。
import { requestSourceData } from '../services/sourceDataService.js';
// 导入来源: ../services/sourceFilterService.js；导入内容: requestSourceFilterMeta 自定义服务；文件作用: 请求 Provider 声明的动态筛选组。
import { requestSourceFilterMeta } from '../services/sourceFilterService.js';

import {
  // 导入来源: ../store/siteContentStore.js；导入内容: getBucketItems；文件作用: 从实体池解析当前目录卡片。
  getBucketItems,
  // 导入来源: ../store/siteContentStore.js；导入内容: getPagePagination；文件作用: 读取当前目录标准分页。
  getPagePagination,
  // 导入来源: ../store/siteContentStore.js；导入内容: getPageRequestTransaction；文件作用: 读取当前目录唯一请求事务快照。
  getPageRequestTransaction
} from '../store/siteContentStore.js';

// 导入来源: ../store/siteFilterStore.js；导入内容: siteFilterStore 自定义 Store；文件作用: 给控制器提供 movie/tv 动态筛选元数据桶。
import { siteFilterStore } from '../store/siteFilterStore.js';

import {
  // 导入来源: ../router/routeRequestState.js；导入内容: createCatalogRouteQuery；文件作用: 把筛选和页码写入唯一 URL 请求事实。
  createCatalogRouteQuery,
  // 导入来源: ../router/routeRequestState.js；导入内容: createCatalogRouteState；文件作用: 从 URL 恢复筛选和页码。
  createCatalogRouteState,
  // 导入来源: ../router/routeRequestState.js；导入内容: createRouteRequestGuard；文件作用: 阻止失活 KeepAlive 页面响应其他路由变化。
  createRouteRequestGuard
} from '../router/routeRequestState.js';

import {
  // 导入来源: ../selectors/pageRequestStateSelectors.js；导入内容: createPageRequestViewState；文件作用: 把目录事务与可见条目转换为统一页面状态。
  createPageRequestViewState,
  // 导入来源: ../selectors/pageRequestStateSelectors.js；导入内容: PAGE_REQUEST_VIEW_STATUS；文件作用: 区分成功空结果与阻塞失败。
  PAGE_REQUEST_VIEW_STATUS
} from '../selectors/pageRequestStateSelectors.js';

// 类型: number。
// 作用: 统一电影页和电视剧页每个逻辑页 12 条的正式页面契约，页面配置不得各自复制容量。
const CATALOG_PAGE_SIZE = 12;

/**
 * 校验并冻结目录控制器配置。
 * 纯函数: 不修改输入对象；返回独立默认筛选副本。
 * 成功路径: pageKey、routeName、默认筛选和错误文案完整时返回冻结配置。
 * 失败路径: 任一必填字段无效时抛出 TypeError，阻止页面创建半配置控制器。
 *
 * @param {object} config 目录页面配置。
 * @param {string} config.pageKey SiteContentStore 和筛选 Store 的目录键。
 * @param {string} config.routeName Vue Router 命名路由。
 * @param {object} config.defaultFilters 当前页面全部筛选键及默认值。
 * @param {string} config.fallbackErrorMessage 页面通用失败说明。
 * @returns {Readonly<object>} 已校验并冻结的目录控制器配置。
 * @throws {TypeError} 配置缺失或字段类型不合法时抛出。
 */
function normalizeCatalogPageControllerConfig(config) {
  // 条件分支: 配置不是普通对象时进入；执行内容: 阻止后续读取缺失字段。
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('目录页面控制器配置必须是对象');
  }

  // 类型: string；作用: 清理目录数据桶键，避免空白键写入 Store 或请求。
  const pageKey = typeof config.pageKey === 'string' ? config.pageKey.trim() : '';
  // 类型: string；作用: 清理命名路由，保证路由守卫和导航使用同一身份。
  const routeName = typeof config.routeName === 'string' ? config.routeName.trim() : '';
  // 类型: string；作用: 保存页面无法从事务取得安全文案时的通用说明。
  const fallbackErrorMessage = typeof config.fallbackErrorMessage === 'string'
    ? config.fallbackErrorMessage.trim()
    : '';
  // 类型: object|null；作用: 只接受非数组筛选对象，避免 Object.keys 误读列表索引。
  const defaultFilters = config.defaultFilters && typeof config.defaultFilters === 'object' && !Array.isArray(config.defaultFilters)
    ? config.defaultFilters
    : null;

  // 条件分支: 目录键或路由名缺失时进入；执行内容: 失败关闭，避免控制器读写未知页面桶。
  if (!pageKey || !routeName) {
    throw new TypeError('目录页面控制器缺少 pageKey 或 routeName');
  }
  // 条件分支: 默认筛选缺失或为空时进入；执行内容: 阻止 URL 解析和重置操作产生不完整状态。
  if (!defaultFilters || Object.keys(defaultFilters).length === 0) {
    throw new TypeError('目录页面控制器 defaultFilters 不能为空');
  }
  // 条件分支: 通用错误文案缺失时进入；执行内容: 阻止页面错误状态退化为空字符串。
  if (!fallbackErrorMessage) {
    throw new TypeError('目录页面控制器 fallbackErrorMessage 不能为空');
  }

  return Object.freeze({
    pageKey,
    routeName,
    fallbackErrorMessage,
    defaultFilters: Object.freeze({ ...defaultFilters })
  });
}

/**
 * 把任意页码收敛为正整数。
 * 纯函数: 相同输入始终返回相同数字，不读取或修改页面状态。
 * 成功路径: 正整数输入原样返回。
 * 失败路径: 空值、非数字、非整数或小于一时返回第一页。
 *
 * @param {*} page 路由、分页事件或调用方提供的页码。
 * @returns {number} 可用于 SourceDataRequest 的正整数页码。
 */
function normalizeCatalogPageNumber(page) {
  // 类型: number；作用: 统一字符串 query 和数字事件载荷的比较方式。
  const candidatePage = Number(page);
  return Number.isInteger(candidatePage) && candidatePage > 0 ? candidatePage : 1;
}

/**
 * 创建电影页和电视剧页共用的 Vue 2 目录控制器。
 * 纯函数: 创建阶段只校验配置并返回新 options；运行副作用仅发生在 Vue 生命周期和 methods 被页面调用时。
 * 成功路径: 页面通过 mixin 获得 URL 派生状态、筛选/内容请求、分页、切源和 KeepAlive 守卫。
 * 失败路径: 配置无效时同步抛错；运行请求失败由统一 Service 写入 PageBucket，控制器不建立错误副本。
 * 维护边界: 不包含电影/电视剧文案、Provider 筛选定义、站点字段或页面模板。
 *
 * @param {object} config 目录页面配置，字段由 normalizeCatalogPageControllerConfig 校验。
 * @returns {object} 可放入 Vue 组件 mixins 的目录控制器 options。
 */
export function createCatalogPageController(config) {
  // 类型: Readonly<object>；作用: 保存当前控制器唯一页面键、路由、默认筛选和错误文案；页容量由模块契约常量统一持有。
  const controllerConfig = normalizeCatalogPageControllerConfig(config);

  return {
    /**
     * 创建目录页面响应式状态。
     * 纯函数: 只返回全站筛选 Store 引用，不复制内容、事务或筛选桶。
     * @returns {object} 包含 filterStore 的页面状态。
     */
    data() {
      return {
        // 类型: object；来源: siteFilterStore；作用: 让 computed 响应当前 pageKey 的筛选元数据变化。
        filterStore: siteFilterStore
      };
    },

    computed: {
      /**
       * 从当前 URL 派生目录筛选状态。
       * 纯函数: 不修改 Router 或 Store；非法 query 由路由工具回退当前页面默认值。
       * @returns {object} 当前请求使用的筛选对象。
       */
      selectedFilters() {
        return createCatalogRouteState(this.$route.query, controllerConfig.defaultFilters).filters;
      },

      /**
       * 从当前 URL 派生目录页码。
       * 纯函数: 不修改 Router、页面或 Store。
       * @returns {number} 当前请求页码。
       */
      requestedPage() {
        return createCatalogRouteState(this.$route.query, controllerConfig.defaultFilters).page;
      },

      /**
       * 读取当前目录筛选元数据桶。
       * 纯函数: 只按冻结 pageKey 读取 siteFilterStore，不修改桶。
       * @returns {object|null} 当前目录筛选桶；页面键尚未建立时为 null。
       */
      catalogFilterBucket() {
        return this.filterStore.pages[controllerConfig.pageKey] || null;
      },

      /**
       * 把当前源筛选元数据映射为带选中态的展示组。
       * 纯函数: 创建新组和选项对象，不修改 Provider 响应或 URL 状态。
       * 失败路径: 筛选来源与内容请求来源不一致时返回空数组，避免跨源旧筛选可见。
       * @returns {Array<object>} 可供 CatalogFilterBar 渲染的筛选组。
       */
      filters() {
        // 类型: Array<object>；作用: 读取 Provider 已采用筛选组，桶缺失时返回空列表。
        const groups = Array.isArray(this.catalogFilterBucket?.groups) ? this.catalogFilterBucket.groups : [];
        // 类型: string；作用: 标识筛选元数据最近成功来源。
        const filterSourceId = this.catalogFilterBucket?.request?.sourceId || '';
        // 类型: string；作用: 标识当前内容事务实际请求来源，作为跨源可见性门禁。
        const contentRequestSourceId = this.pageRequestState.sourceId;
        // 条件分支: 筛选来源缺失、内容请求来源缺失或二者不一致时进入；执行内容: 隐藏跨源旧筛选组。
        if (!filterSourceId || !contentRequestSourceId || filterSourceId !== contentRequestSourceId) {
          return [];
        }

        // 循环类型: Array.prototype.map；作用: 为每个组和选项创建当前 URL 对应的 active 投影。
        return groups.map((group) => {
          // 类型: *；作用: 读取当前组 URL 值，缺失时采用中性 all。
          const selectedValue = this.selectedFilters[group.name];
          return {
            ...group,
            options: Array.isArray(group.options)
              ? group.options.map(option => ({
                ...option,
                active: option.value === (selectedValue === undefined ? 'all' : selectedValue)
              }))
              : []
          };
        });
      },

      /**
       * 读取当前目录卡片列表。
       * 纯函数: 通过 Store selector 解析实体引用，不修改页面桶。
       * @returns {Array<object>} 当前可见 ContentItem 列表。
       */
      catalogItems() {
        return getBucketItems(controllerConfig.pageKey);
      },

      /**
       * 读取当前目录标准分页。
       * 纯函数: 通过 Store selector 返回隔离分页对象。
       * @returns {object|null} 当前 PageBucket.pagination。
       */
      pagination() {
        return getPagePagination(controllerConfig.pageKey);
      },

      /**
       * 读取当前目录唯一请求事务。
       * 纯函数: 通过 Store selector 返回隔离事务快照。
       * @returns {object|null} 当前 PageBucket.transaction。
       */
      requestTransaction() {
        return getPageRequestTransaction(controllerConfig.pageKey);
      },

      /**
       * 投影当前目录统一请求状态。
       * 纯函数: 只组合事务、可见条目数和冻结错误文案。
       * @returns {Readonly<object>} idle、loading、ready、empty 或 error 页面状态。
       */
      pageRequestState() {
        return createPageRequestViewState({
          requestEntries: [{ key: controllerConfig.pageKey, transaction: this.requestTransaction }],
          visibleItemCount: this.catalogItems.length,
          fallbackErrorMessage: controllerConfig.fallbackErrorMessage
        });
      },

      /**
       * 判断目录网格是否可以渲染。
       * 纯函数: 只读取统一页面状态；阻塞失败不交给网格误报业务空态。
       * @returns {boolean} true 渲染网格，false 由请求反馈面板承接。
       */
      shouldShowCatalogGrid() {
        return this.pageRequestState.hasVisibleContent
          || this.pageRequestState.status === PAGE_REQUEST_VIEW_STATUS.empty;
      },

      /**
       * 判断当前源是否提供筛选组。
       * 纯函数: 只读取 filters 长度。
       * @returns {boolean} true 表示渲染筛选栏。
       */
      hasFilters() {
        return this.filters.length > 0;
      },

      /**
       * 判断 URL 筛选是否偏离页面默认值。
       * 纯函数: 逐键比较冻结默认筛选和当前 URL 投影。
       * @returns {boolean} true 表示至少一个筛选已改变。
       */
      hasActiveFilters() {
        return Object.keys(controllerConfig.defaultFilters).some(filterName => {
          return this.selectedFilters[filterName] !== controllerConfig.defaultFilters[filterName];
        });
      },

      /**
       * 判断重置命令是否应禁用。
       * 纯函数: 只反转 hasActiveFilters。
       * @returns {boolean} true 表示当前已经是默认筛选。
       */
      isResetDisabled() {
        return !this.hasActiveFilters;
      },

      /**
       * 判断当前目录是否具有分页对象。
       * 纯函数: 只把 pagination 转换为 Boolean。
       * @returns {boolean} true 表示分页对象存在。
       */
      hasPagination() {
        return Boolean(this.pagination);
      },

      /**
       * 判断底部分页是否具有可执行方向。
       * 纯函数: 只读取标准分页和可见内容状态。
       * @returns {boolean} true 表示应渲染 CatalogPagination。
       */
      shouldShowPagination() {
        // 条件分支: 分页不存在或当前没有可见内容时进入；执行内容: 隐藏没有可执行对象的分页栏。
        if (!this.hasPagination || !this.pageRequestState.hasVisibleContent) {
          return false;
        }
        // 类型: number；作用: 标准总页数未知时归零，只由当前页和 hasMore 决定可见性。
        const totalPages = Number(this.pagination.totalPages || 0);
        // 类型: number；作用: 标准当前页缺失时回到第一页判断。
        const standardPage = normalizeCatalogPageNumber(this.pagination.page);
        return totalPages > 1 || standardPage > 1 || Boolean(this.pagination.hasMore);
      }
    },

    /**
     * 初始化目录页面路由守卫并请求当前 URL。
     * 副作用: 创建当前实例守卫、标记首个 fullPath，并并发请求筛选元数据和内容。
     * 失败路径: 请求错误由统一 Service 与 Store 收敛，不创建组件错误状态。
     * @returns {void} 生命周期钩子不返回业务数据。
     */
    created() {
      // 类型: Readonly<object>；作用: 当前 KeepAlive 实例独享，只接受本目录命名路由。
      this._routeRequestGuard = createRouteRequestGuard({ routeNames: [controllerConfig.routeName] });
      // 副作用: 标记首次 URL 已由 created 处理，watcher 不重复发起相同请求。
      this._routeRequestGuard.markHandled(this.$route);
      // 异步调用: 请求当前 URL 页码；Promise 由统一事务收敛，生命周期不保存副本。
      this.loadInitialCatalogPage(this.requestedPage);
    },

    watch: {
      /**
       * 监听当前目录完整 URL 变化。
       * 副作用: 仅对本 KeepAlive 页面尚未处理的 fullPath 请求新内容。
       * 失败路径: 非本页路由或已处理地址直接返回。
       * @returns {void} 守卫判断后结束。
       */
      '$route.fullPath'() {
        // 条件分支: 守卫未建立、当前路由不属于本页或 fullPath 已处理时进入；执行内容: 不发起重复目录请求。
        if (!this._routeRequestGuard || !this._routeRequestGuard.shouldHandle(this.$route)) {
          return;
        }
        this.loadCatalogContent(this.requestedPage);
      }
    },

    methods: {
      /**
       * 创建当前目录标准内容请求。
       * 纯函数: 只读取 URL 筛选和冻结配置，不修改页面或 Store。
       * @param {*} page 目标页码。
       * @returns {object} SourceDataRequest 页面输入对象。
       */
      createCatalogPageRequest(page) {
        return {
          pageKey: controllerConfig.pageKey,
          params: {
            page: normalizeCatalogPageNumber(page),
            pageSize: CATALOG_PAGE_SIZE,
            ...this.selectedFilters
          }
        };
      },

      /**
       * 请求当前目录动态筛选元数据。
       * 副作用: 调用筛选 Service 并由其采用 Provider 标准响应。
       * 成功路径: 当前 pageKey 筛选桶更新后 resolve。
       * 失败路径: Service 错误原样 reject，供 allSettled 独立收敛。
       * @returns {Promise<void>} 筛选元数据调用完成时兑现。
       */
      async loadCatalogFilterMeta() {
        await requestSourceFilterMeta({ pageKey: controllerConfig.pageKey });
      },

      /**
       * 并发加载当前目录筛选元数据和内容。
       * 副作用: 调用两个统一 Service；两者独立采用自己的 Store。
       * 成功路径: 两个调用全部收敛后 resolve。
       * 失败路径: allSettled 保留单路失败事实，内容错误由 PageBucket 展示。
       * @param {*} page 当前 URL 或显式目标页码。
       * @returns {Promise<void>} 两个请求均收敛后结束。
       */
      async loadInitialCatalogPage(page = 1) {
        await Promise.allSettled([
          this.loadCatalogFilterMeta(),
          requestSourceData(this.createCatalogPageRequest(page))
        ]);
      },

      /**
       * 按当前完整 URL 原位重试目录。
       * 副作用: 复用当前页码、筛选和统一 Service，不修改路由。
       * 成功路径: 筛选与内容请求全部收敛后 resolve。
       * 失败路径: 单路失败保留在对应 Store，allSettled 不丢失另一调用结果。
       * @returns {Promise<void>} 筛选和内容重试全部收敛后结束。
       */
      async retryCatalogPage() {
        await this.loadInitialCatalogPage(this.requestedPage);
      },

      /**
       * 在活动源切换成功后恢复默认筛选并加载新源第一页。
       * 副作用: 独立请求筛选元数据，并按目标 URL 是否变化选择 Router replace 或直接请求内容。
       * 成功路径: 新源筛选和内容调用全部收敛。
       * 失败路径: 各 Service 保留自身失败事实，不回滚 Manager 已成功的源切换。
       * @returns {Promise<void>} 新源目录初始化调用收敛后结束。
       */
      async handleSourceSwitched() {
        // 类型: object；作用: 用默认筛选和第一页建立新源目录唯一目标 URL。
        const targetLocation = {
          name: controllerConfig.routeName,
          query: createCatalogRouteQuery({
            baseQuery: this.$route.query,
            defaults: controllerConfig.defaultFilters,
            filters: controllerConfig.defaultFilters,
            page: 1
          })
        };
        // 类型: string；作用: 计算目标完整地址，决定是否交给 watcher 发起内容请求。
        const targetFullPath = this.$router.resolve(targetLocation).route.fullPath;
        // 类型: boolean；作用: true 表示 Router 变化后由 watcher 请求，false 表示当前地址必须直接重载。
        const routeChanged = targetFullPath !== this.$route.fullPath;
        // 类型: Promise<void>；作用: 筛选请求与 URL/内容请求独立收敛。
        const filterRequest = this.loadCatalogFilterMeta();

        // 条件分支: 默认筛选目标 URL 与当前地址不同时进入；执行内容: 并发更新筛选元数据和 Router，由 watcher 请求内容。
        if (routeChanged) {
          await Promise.allSettled([filterRequest, this.$router.replace(targetLocation)]);
          return;
        }
        await Promise.allSettled([filterRequest, this.loadCatalogContent(1)]);
      },

      /**
       * 请求当前目录内容数据桶。
       * 副作用: 调用 sourceDataService，由其写入唯一 PageBucket 事务和内容实体。
       * 成功路径: 标准响应采用后 resolve。
       * 失败路径: Service 已提交 error/stale，控制器吞掉 reject 以避免未处理 Promise，不复制错误。
       * @param {*} page 目标页码。
       * @returns {Promise<void>} 请求完成或统一失败事务写入后结束。
       */
      async loadCatalogContent(page = 1) {
        try {
          await requestSourceData(this.createCatalogPageRequest(page));
        } catch (error) {
          return;
        }
      },

      /**
       * 把筛选变化写入当前目录 URL 并回到第一页。
       * 副作用: 调用 Router push；watcher 按新 fullPath 请求内容。
       * 成功路径: 合法筛选导航完成后 resolve。
       * 失败路径: 载荷或筛选键非法时直接返回，不写未知 query。
       * @param {object} payload CatalogFilterBar 事件载荷。
       * @param {string} payload.groupName 当前筛选组机器名。
       * @param {*} payload.optionValue 当前筛选项值。
       * @returns {Promise<void>} 导航完成或非法输入被忽略后结束。
       */
      async handleFilterChange(payload) {
        // 类型: object；作用: 非对象事件回退空对象，避免读取字段抛错。
        const safePayload = payload && typeof payload === 'object' ? payload : {};
        // 类型: string；作用: 定位当前 URL 中允许修改的筛选键。
        const groupName = safePayload.groupName || '';
        // 条件分支: 组名缺失或不属于当前默认筛选键时进入；执行内容: 忽略非法组件载荷。
        if (!groupName || !Object.prototype.hasOwnProperty.call(this.selectedFilters, groupName)) {
          return;
        }
        // 类型: object；作用: 创建新筛选投影，不修改 computed 返回对象。
        const nextFilters = { ...this.selectedFilters, [groupName]: safePayload.optionValue };
        await this.$router.push({
          name: controllerConfig.routeName,
          query: createCatalogRouteQuery({
            baseQuery: this.$route.query,
            defaults: controllerConfig.defaultFilters,
            filters: nextFilters,
            page: 1
          })
        });
      },

      /**
       * 把当前目录恢复为默认筛选和第一页 URL。
       * 副作用: 非默认状态时调用 Router push，由 watcher 请求内容。
       * 成功路径: 目标 URL 导航完成后 resolve。
       * 失败路径: 已是默认筛选时直接返回，避免重复导航和请求。
       * @returns {Promise<void>} 导航完成或无需重置时结束。
       */
      async handleResetFilters() {
        // 条件分支: 当前筛选已经全部等于默认值时进入；执行内容: 不创建重复导航和请求。
        if (this.isResetDisabled) {
          return;
        }
        await this.$router.push({
          name: controllerConfig.routeName,
          query: createCatalogRouteQuery({
            baseQuery: this.$route.query,
            defaults: controllerConfig.defaultFilters,
            filters: controllerConfig.defaultFilters,
            page: 1
          })
        });
      },

      /**
       * 把分页组件目标页写入当前目录 URL。
       * 副作用: 调用 Router push 并保留当前筛选，watcher 请求目标页。
       * 成功路径: 合法或归一化页码写入 URL 后 resolve。
       * 失败路径: 非法页码统一回到第一页。
       * @param {object} payload CatalogPagination 事件载荷。
       * @param {*} payload.page 目标页码候选值。
       * @returns {Promise<void>} 目标 URL 导航完成后结束。
       */
      async handlePageChange(payload) {
        // 类型: number；作用: 把事件页码收敛为可请求正整数。
        const targetPage = normalizeCatalogPageNumber(payload?.page);
        await this.$router.push({
          name: controllerConfig.routeName,
          query: createCatalogRouteQuery({
            baseQuery: this.$route.query,
            defaults: controllerConfig.defaultFilters,
            filters: this.selectedFilters,
            page: targetPage
          })
        });
      }
    }
  };
}
