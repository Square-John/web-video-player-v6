/*
  source-runtime-content.integration.test.js 模块说明

  - 文件职责:
      验证 createSourceRuntimeBundle 使用唯一组合入口，并让内容与设置管理门面共享基础设施和初始化。
      验证 createSourceRuntime 兼容内容入口继续初始化 Repository、SourceManager、Shell、Host 和可信 Provider。
      验证页面候选唯一门禁、显式/活动/默认身份解析、同源启动去重、错误分类和停止后新代次重建。
      验证活动源正常切换、快速连续切换、失败回滚、状态发布和切回原运行源。
      验证 A/B 核心模拟源完整覆盖首页五区域、目录、搜索、详情、播放和两类筛选请求。
      验证内容与筛选 service 只依赖应用 Runtime、旧注册表退出和 store 失败不产生半提交状态。
      验证显式身份保留、活动源旧响应拒绝，以及四个页面从静态源切换到 Runtime 统一入口。
      验证测试专用用户内容引用可以通过 Mock Provider 内容和分集身份完成解析。
      验证后台引用补全只采用实体并允许不同数据源并发，不争用 detail 页面事务。
      验证共享实体按列表、详情和播放投影优先级采用，普通页面响应不能降级活动播放增强字段。
      验证首页、详情、历史记录和播放器分集线路共用可刷新路由上下文，并且页面没有恢复影子选中状态。
      验证全站视频卡片只在统一展示入口格式化播放进度和总时长，不保留页面级重复实现。
      验证首页热门电影与电视剧共用标题栏分页，并通过各自 PageBucket 事务请求远程目标页。
      运行行为只通过 Runtime、service 和 store 正式公开入口观察，不读取内部基础设施或模拟响应 fixture。

  - 导入库及文件汇总(16 条，内置 3 条，第三方 0 条，自定义 13 条):
      assert: 内置模块，执行结构、身份、响应、错误和生命周期断言。
      readFileSync: 内置模块，读取 service 与 runtime 源码以验证唯一导入和旧注册表删除边界。
      test: 内置模块，注册 Node 集成测试。
      PROVIDER_READINESS_STATUS、SOURCE_SWITCH_STATUS: 自定义配置，断言 Runtime Provider 就绪投影和切换状态机。
      SourceRuntime exports: 自定义运行入口，提供错误码、错误类、Bundle 工厂和兼容内容工厂。
      Runtime instances: 自定义运行实例，验证内容与设置管理来自同一应用 Bundle 公开门面。
      sourceDataServiceModule: 自定义服务模块，验证导出边界和旧注册表退出。
      sourceFilterServiceModule: 自定义服务模块，验证导出边界和旧注册表退出。
      isSourceResponseAdoptable: 自定义纯规则，验证显式身份和活动源响应采用边界。
      siteContentStore exports: 自定义运行态，验证内容提交成功与失败原子性。
      siteFilterStore exports: 自定义运行态，验证筛选提交成功与失败原子性。
      mockSourceRepositorySeeds: 自定义测试数据，构造已启用但缺少受审数据集的工厂 supports 负向场景。
      createMemorySourceRepositories: 自定义工厂，为自定义种子创建显式测试仓。
      playerNavigationService exports: 自定义纯服务，验证播放器上下文和历史记录到 Vue Router 目标的唯一映射。
      createMockSourceRuntimeOptions: 自定义测试工厂，为每个领域 Runtime 显式注入独立 MockNetworkAdapter。
      pageRequestStateSelectors exports: 自定义纯选择器，验证单桶和多桶事务的 loading、ready、empty 与 error 投影。

  - 模块级常量:
      RUNTIME_PUBLIC_METHODS: Array<string>，runtime 冻结十一方法顺序。
      MANAGEMENT_RUNTIME_PUBLIC_METHODS: Array<string>，设置管理门面十八个正式方法顺序。
      RUNTIME_BUNDLE_PUBLIC_FIELDS: Array<string>，Runtime Bundle 两个公开字段顺序。
      RUNTIME_TEST_SOURCE_IDS: object，A/B 协议和未注册自定义源真实身份。
      RUNTIME_PAGE_KEYS: Array<string>，六类内容页面请求键。
      RUNTIME_HOME_MODULE_KEYS: Array<string>，首页五个标准区域键。
      RUNTIME_AVAILABLE_SOURCE_IDS: Array<string>，默认种子中页面可执行候选身份顺序。
      USER_CONTENT_REFERENCE_FIXTURES: Array<object>，三源内容与电视剧分集引用测试夹具。
      LEGACY_SERVICE_EXPORT_NAMES: Array<string>，6E 必须退出的旧 Provider 注册表导出名称。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDataRequest(sourceId, pageKey, params): 创建标准 SourceDataRequest。
      createFilterRequest(sourceId, pageKey): 创建标准 SourceFilterMetaRequest。
      assertRuntimePageCoverage(runtime, sourceId): 验证单个模拟源的完整页面与筛选请求矩阵。
      assertRuntimeError(action, code, requiresCause): 断言 runtime 稳定错误分类。
      disposeRuntimeSources(runtime, sourceIds): 幂等释放测试使用的数据源实例。
      readProjectModuleSource(relativeUrl): 读取相对当前测试文件的项目模块源码。
      createSerializableSnapshot(value): 创建可比较的 JSON 运行态快照。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 比较 runtime 门面、Manager 投影、标准响应、错误码和生命周期代次。
import assert from 'node:assert/strict';

// 导入来源: node:fs。
// 导入内容: readFileSync 内置同步文件读取函数。
// 文件作用: 读取 service 与 runtime 源码，验证两个 service 导入同一实例且旧 registry 标识不再存在。
import { readFileSync } from 'node:fs';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册 6D Runtime 与 6E service、身份和提交原子性集成测试。
import test from 'node:test';

// 导入来源: ../src/config/source-manager.config.js。
// 导入内容: PROVIDER_READINESS_STATUS 与 SOURCE_SWITCH_STATUS 枚举。
// 文件作用: 断言未注册源的 Manager 投影和 Runtime 切换状态机。
import {
  PROVIDER_READINESS_STATUS,
  SOURCE_SWITCH_STATUS
} from '../src/config/source-manager.config.js';

import {
  // 导入来源: ../src/runtime/createSourceRuntime.js。
  // 导入内容: SOURCE_RUNTIME_ERROR_CODE runtime 稳定错误码。
  // 文件作用: 断言未知、不可用和 validation 不依赖中文消息。
  SOURCE_RUNTIME_ERROR_CODE,

  // 导入来源: ../src/runtime/createSourceRuntime.js。
  // 导入内容: SourceRuntimeError runtime 错误基类。
  // 文件作用: 证明组合层统一保留稳定错误类型和可选 cause。
  SourceRuntimeError,

  // 导入来源: ../src/runtime/createSourceRuntime.js。
  // 导入内容: createSourceRuntime 兼容内容运行工厂。
  // 文件作用: 创建每个测试独立的真实 Memory Repository、Manager、Shell、Host 和 Provider 组合。
  createSourceRuntime,

  // 导入来源: ../src/runtime/createSourceRuntime.js。
  // 导入内容: createSourceRuntimeBundle 统一 Bundle 工厂。
  // 文件作用: 验证内容和设置管理门面共享同一初始化 Promise、Manager 和基础设施图。
  createSourceRuntimeBundle
} from '../src/runtime/createSourceRuntime.js';

// 导入来源: ./source-runtime-test-fixtures.js。
// 导入内容: createMockSourceRuntimeOptions 显式 Mock Runtime 选项工厂。
// 文件作用: 领域测试不依赖应用默认 proxy 模式，每个 Runtime 使用独立模拟适配器。
import { createMockSourceRuntimeOptions } from './source-runtime-test-fixtures.js';

import {
  // 导入来源: ../src/runtime/sourceRuntimeInstance.js。
  // 导入内容: sourceRuntimeInstance 应用级共享内容 Runtime。
  // 文件作用: 验证应用 Bundle 暴露冻结内容门面且不泄漏内部基础设施。
  sourceRuntimeInstance,

  // 导入来源: ../src/runtime/sourceRuntimeInstance.js。
  // 导入内容: sourceManagementRuntimeInstance 应用级共享设置管理门面。
  // 文件作用: 验证实例模块从同一 Bundle 导出完整管理能力且不暴露内部基础设施。
  sourceManagementRuntimeInstance
} from '../src/runtime/sourceRuntimeInstance.js';

// 导入来源: ../src/services/sourceDataService.js。
// 导入内容: sourceDataServiceModule 内容服务完整导出集合。
// 文件作用: 验证 service 只依赖应用 Runtime、使用 Runtime 解析身份且旧 registry 导出退出。
import * as sourceDataServiceModule from '../src/services/sourceDataService.js';

// 导入来源: ../src/services/sourceFilterService.js。
// 导入内容: sourceFilterServiceModule 筛选服务完整导出集合。
// 文件作用: 验证 service 只依赖应用 Runtime、使用 Runtime 解析身份且旧 registry 导出退出。
import * as sourceFilterServiceModule from '../src/services/sourceFilterService.js';

// 导入来源: ../src/services/sourceResponseAdoptionService.js。
// 导入内容: isSourceResponseAdoptable 纯响应采用规则。
// 文件作用: 在不启动 Runtime 的情况下精确验证显式身份保留、活动源过期拒绝和身份损坏失败。
import { isSourceResponseAdoptable } from '../src/services/sourceResponseAdoptionService.js';

import {
  // 导入来源: ../src/store/siteContentStore.js；导入内容: beginSourceDataRequest；文件作用: 验证 loading 和跨源 stale 发布。
  beginSourceDataRequest,
  // 导入来源: ../src/store/siteContentStore.js；导入内容: commitSourceContentItem；文件作用: 验证后台补全只写实体池。
  commitSourceContentItem,
  // 导入来源: ../src/store/siteContentStore.js。
  // 导入内容: commitSourceDataResponse 内容提交函数。
  // 文件作用: 验证内容响应准备失败时不改变活动身份或页面桶。
  commitSourceDataResponse,

  // 导入来源: ../src/store/siteContentStore.js；导入内容: failSourceDataRequest；文件作用: 验证最新请求失败与过期失败隔离。
  failSourceDataRequest,

  // 导入来源: ../src/store/siteContentStore.js；导入内容: getBucketItems；文件作用: 验证 stale 旧引用不会被页面 selector 展示。
  getBucketItems,

  // 导入来源: ../src/store/siteContentStore.js；导入内容: getPageRequestTransaction；文件作用: 验证页面只能读取隔离事务快照。
  getPageRequestTransaction,

  // 导入来源: ../src/store/siteContentStore.js；导入内容: resolveSourceDataRequestTransaction；文件作用: 验证同一 requestId 采用 Runtime 真实源和 stale 重算。
  resolveSourceDataRequestTransaction,

  // 导入来源: ../src/store/siteContentStore.js。
  // 导入内容: resetSiteContentStore 内容状态重置函数。
  // 文件作用: 为 service 和提交原子性用例建立独立空状态。
  resetSiteContentStore,

  // 导入来源: ../src/store/siteContentStore.js。
  // 导入内容: siteContentStore 内容运行态对象。
  // 文件作用: 断言真实 sourceId、实体池和失败前后状态。
  siteContentStore
} from '../src/store/siteContentStore.js';

import {
  // 导入来源: ../src/selectors/pageRequestStateSelectors.js；导入内容: createPageRequestViewState；文件作用: 验证页面统一状态投影不需要本地 Boolean。
  createPageRequestViewState,
  // 导入来源: ../src/selectors/pageRequestStateSelectors.js；导入内容: PAGE_REQUEST_VIEW_STATUS；文件作用: 使用正式展示枚举断言 ready、empty 和 error。
  PAGE_REQUEST_VIEW_STATUS
} from '../src/selectors/pageRequestStateSelectors.js';

import {
  // 导入来源: ../src/store/siteFilterStore.js。
  // 导入内容: commitSourceFilterMetaResponse 筛选提交函数。
  // 文件作用: 验证筛选响应准备失败时不改变活动身份或目标桶。
  commitSourceFilterMetaResponse,

  // 导入来源: ../src/store/siteFilterStore.js。
  // 导入内容: resetSiteFilterStore 筛选状态重置函数。
  // 文件作用: 为 service 和提交原子性用例建立独立空状态。
  resetSiteFilterStore,

  // 导入来源: ../src/store/siteFilterStore.js。
  // 导入内容: siteFilterStore 筛选运行态对象。
  // 文件作用: 断言真实 sourceId、目标筛选桶和失败前后状态。
  siteFilterStore
} from '../src/store/siteFilterStore.js';

// 导入来源: ./source-repository-test-fixtures.js。
// 导入内容: mockSourceRepositorySeeds 测试专用分离 Repository 种子。
// 文件作用: 隔离构造 system-source-5 已启用且可见的门禁场景，产品四源种子不承载 Mock 行为。
import { mockSourceRepositorySeeds } from './source-repository-test-fixtures.js';

// 导入来源: ../src/repositories/source/createMemorySourceRepositories.js；导入内容: createMemorySourceRepositories；文件作用: 为自定义 supports 负向种子显式创建测试 Repository。
import { createMemorySourceRepositories } from '../src/repositories/source/createMemorySourceRepositories.js';

import {
  // 导入来源: ../src/services/playerNavigationService.js。
  // 导入内容: createPlayerRouteContext 常驻宿主活动播放路由上下文工厂。
  // 文件作用: 验证普通路由不能生成上下文，严格播放路由返回冻结且可持续使用的请求身份。
  createPlayerRouteContext,

  // 导入来源: ../src/services/playerNavigationService.js。
  // 导入内容: createPlayerNavigationTarget 通用播放路由目标构造函数。
  // 文件作用: 验证分集线路更新保留既有 query、清除失效字段且不修改调用方对象。
  createPlayerNavigationTarget,

  // 导入来源: ../src/services/playerNavigationService.js。
  // 导入内容: createContentPlaybackNavigationTarget 内容默认播放目标构造函数。
  // 文件作用: 验证首页和详情能从同一 ContentItem 推导默认分集、线路和自动播放 query。
  createContentPlaybackNavigationTarget,

  // 导入来源: ../src/services/playerNavigationService.js。
  // 导入内容: createHistoryPlaybackNavigationTarget 历史记录恢复目标构造函数。
  // 文件作用: 验证单条电视剧历史按自身分集、线路和自动播放意图进入播放器。
  createHistoryPlaybackNavigationTarget
} from '../src/services/playerNavigationService.js';

// 类型: Array<string>。
// 作用: 固定 runtime 对 service 公开的方法集合和顺序，额外基础设施字段必须使测试失败。
const RUNTIME_PUBLIC_METHODS = Object.freeze([
  'initialize',
  'getSourceManagerState',
  'listAvailableSources',
  'resolveSourceId',
  'switchActiveSource',
  'ensureSourceRunning',
  'fetchData',
  'fetchFilterMeta',
  'checkHealth',
  'stopSource',
  'disposeSource'
]);

// 类型: Array<string>。
// 作用: 固定设置管理门面十八个正式方法和顺序，防止遗漏领域操作或暴露内部基础设施对象。
const MANAGEMENT_RUNTIME_PUBLIC_METHODS = Object.freeze([
  'initialize',
  'subscribe',
  'getSourceManagerState',
  'setDefaultSource',
  'checkSource',
  'checkAllSources',
  'checkSourceUpdate',
  'setSourceEnabled',
  'authorizeSource',
  'revokeSourceAuthorization',
  'restoreSystemSources',
  'clearTemporarySourceCache',
  'clearAllSourceCache',
  'previewSourceImport',
  'importSource',
  'applySourceUpdate',
  'deleteSources',
  'createSourceExportBundle'
]);

// 类型: Array<string>。
// 作用: 固定 Runtime Bundle 只包含两个裁剪门面，额外字段会暴露基础设施或形成未设计入口。
const RUNTIME_BUNDLE_PUBLIC_FIELDS = Object.freeze([
  'sourceRuntime',
  'sourceManagementRuntime'
]);

// 类型: object。
// 作用: 保存测试使用的真实 Repository sourceId；协议源可运行，未注册自定义源用于可信工厂门禁。
const RUNTIME_TEST_SOURCE_IDS = Object.freeze({
  // 类型: string。
  // 作用: A 协议默认系统源，用于初始化、内容、筛选和重建测试。
  protocolA: 'system-source-1',

  // 类型: string。
  // 作用: B 协议系统源，用于证明不同 sourceId 可以并行启动和返回不同内容。
  protocolB: 'system-source-2',

  // 类型: string。
  // 作用: 第三条受审模拟源，用于快速连续切换的最终用户意图。
  protocolC: 'system-source-4',

  // 类型: string。
  // 作用: 当前启用但 providerKey 未注册的自定义源，用于 unavailable 与 Host cause 断言。
  unresolved: 'custom-online-latest',

  // 类型: string。
  // 作用: 已禁用但具有受审数据集的系统源，用于证明候选规则尊重 runtime.enabled。
  disabledTrusted: 'system-source-3',

  // 类型: string。
  // 作用: 已软隐藏且没有受审数据集的旧系统源，用于证明注册键命中不等于工厂支持。
  unsupportedTrusted: 'system-source-5'
});

// 类型: Array<string>。
// 作用: 固定 Runtime 候选规则接受的六类内容页面键；顺序用于逐页验证 player 到 play 能力映射。
const RUNTIME_PAGE_KEYS = Object.freeze([
  'home',
  'movie',
  'tv',
  'search',
  'detail',
  'player'
]);

// 类型: Array<string>。
// 作用: 固定首页必须独立返回的五个标准区域，防止只验证单一首页列表掩盖数据缺口。
const RUNTIME_HOME_MODULE_KEYS = Object.freeze([
  'banners',
  'hotMovies',
  'hotTv',
  'movieRanking',
  'tvRanking'
]);

// 类型: Array<string>。
// 作用: 默认种子中同时满足启用、授权、可信工厂、受审数据集和页面能力的记录顺序。
const RUNTIME_AVAILABLE_SOURCE_IDS = Object.freeze([
  'system-source-1',
  'system-source-2',
  'system-source-4'
]);

// 类型: ReadonlyArray<object>。
// 作用: 显式覆盖三条 Mock Provider 内容身份和一条电视剧分集；产品首次用户种子保持空集合。
const USER_CONTENT_REFERENCE_FIXTURES = Object.freeze([
  Object.freeze({ sourceId: 'system-source-1', contentId: 'system-source-1-movie-001', episodeId: '' }),
  Object.freeze({ sourceId: 'system-source-2', contentId: 'system-source-2-tv-101', episodeId: 'system-source-2-tv-101-ep-2' }),
  Object.freeze({ sourceId: 'system-source-4', contentId: 'system-source-4-movie-201', episodeId: '' })
]);

// 类型: Array<string>。
// 作用: 固定 6E 必须从内容和筛选 service 删除的旧注册表公开名称，防止后续恢复兼容导出。
const LEGACY_SERVICE_EXPORT_NAMES = Object.freeze([
  'registerSourceProvider',
  'getSourceProvider',
  'sourceProviderRegistry',
  'registerSourceFilterProvider',
  'getSourceFilterProvider',
  'sourceFilterProviderRegistry'
]);

/**
 * 创建标准内容请求。
 * 纯函数: 每次返回新的 request 和 params，不共享外部引用。
 * 成功路径: runtime/Provider 可以按 pageKey 和分页参数返回标准响应。
 * 失败路径: 调用方可以传入未知 sourceId，由 runtime 记录门禁拒绝。
 *
 * @param {string} sourceId 请求声明的真实数据源身份。
 * @param {string} pageKey 目标内容页面键。
 * @param {object} params 需要覆盖的分页、筛选或内容定位参数。
 * @returns {object} SourceDataRequest。
 */
function createDataRequest(sourceId, pageKey = 'movie', params = {}) {
  // 返回值类型: object。
  // 作用: 返回字段完整的请求，避免测试依赖缺字段兜底。
  return {
    sourceId,
    pageKey,
    moduleKey: '',
    params: {
      page: 1,
      pageSize: 20,
      keyword: '',
      category: '',
      genre: '',
      area: '',
      year: '',
      sort: '',
      contentId: '',
      episodeId: '',
      ...params
    }
  };
}

/**
 * 创建标准筛选元数据请求。
 * 纯函数: 每次返回新的空 params 对象，不共享调用方引用。
 * 成功路径: movie 或 tv 返回标准筛选组。
 * 失败路径: 未知 sourceId 或页面能力由 runtime/Provider 稳定拒绝。
 *
 * @param {string} sourceId 请求声明的真实数据源身份。
 * @param {string} pageKey movie 或 tv 页面键。
 * @returns {object} SourceFilterMetaRequest。
 */
function createFilterRequest(sourceId, pageKey) {
  // 返回值类型: object。
  // 作用: 返回筛选契约精确三字段，不夹带 Context 或 Host 引用。
  return {
    sourceId,
    pageKey,
    params: {}
  };
}

/**
 * 验证单个模拟源的完整页面和筛选请求矩阵。
 * 副作用: 通过 Runtime 启动当前源并依次执行内容、筛选和 Shell 模拟网络请求；不修改其他源或页面 store。
 * 成功路径: 首页五区域、movie、tv、search、detail、player 及 movie/tv 筛选均返回同源闭合标准对象。
 * 失败路径: 任一请求、身份、内容引用、分集、线路或筛选断言不成立时由 Runtime 或 assert 使测试失败。
 *
 * @param {object} runtime 当前测试独立 SourceRuntime 门面。
 * @param {string} sourceId 当前 A 或 B 核心模拟源身份。
 * @returns {Promise<object>} 可用于跨源区分断言的标题摘要。
 * @returns {string} return.movieTitle 当前源首个电影标题。
 * @returns {string} return.tvTitle 当前源首个电视剧标题。
 */
async function assertRuntimePageCoverage(runtime, sourceId) {
  // 循环类型: for...of。
  // 初始值: 首页 banners 区域。
  // 终止条件: 五个标准首页区域均返回至少一条同源内容。
  // 循环作用: 证明首页不是只有一个通用列表碰巧可用，每个正式 moduleKey 都具备数据。
  for (const moduleKey of RUNTIME_HOME_MODULE_KEYS) {
    // 类型: object。
    // 作用: 保存当前首页区域标准响应，供身份、区域和非空数据断言。
    const homeResponse = await runtime.fetchData({
      ...createDataRequest(sourceId, 'home'),
      moduleKey
    });
    assert.equal(homeResponse.sourceId, sourceId);
    assert.equal(homeResponse.moduleKey, moduleKey);
    assert.equal(homeResponse.items.length > 0, true);
    assert.equal(homeResponse.items.every(item => item.sourceId === sourceId), true);
  }

  // 类型: object。
  // 作用: 保存当前源电影目录响应，后续搜索和详情必须引用其中同一内容身份。
  const movieResponse = await runtime.fetchData(createDataRequest(sourceId, 'movie'));

  // 类型: object。
  // 作用: 保存当前源电视剧目录响应，后续播放请求必须引用同一内容和稳定分集身份。
  const tvResponse = await runtime.fetchData(createDataRequest(sourceId, 'tv'));
  assert.equal(movieResponse.items.length > 0, true);
  assert.equal(tvResponse.items.length > 0, true);

  // 类型: object。
  // 作用: 保存目录中首个电影，作为搜索关键词和详情 contentId 的稳定来源。
  const movieItem = movieResponse.items[0];

  // 类型: object。
  // 作用: 保存目录中首个电视剧，作为播放 contentId 和 episodeId 的稳定来源。
  const tvItem = tvResponse.items[0];
  assert.equal(tvItem.episodes.length > 0, true);

  // 类型: object。
  // 作用: 使用真实标题验证当前源搜索字段和分页链，不依赖测试写死某协议标题。
  const searchResponse = await runtime.fetchData(createDataRequest(sourceId, 'search', {
    keyword: movieItem.title,
    pageSize: 1
  }));
  assert.equal(searchResponse.items.some(item => item.id === movieItem.id), true);

  // 类型: object。
  // 作用: 验证目录到详情继续使用同一 sourceId + contentId，且标题没有跨源漂移。
  const detailResponse = await runtime.fetchData(createDataRequest(sourceId, 'detail', {
    contentId: movieItem.id
  }));
  assert.equal(detailResponse.item?.id, movieItem.id);
  assert.equal(detailResponse.item?.sourceId, sourceId);
  assert.equal(detailResponse.item?.title, movieItem.title);

  // 类型: object。
  // 作用: 验证目录分集到播放响应保持同一 episodeId，并返回至少一条可用线路。
  const playerResponse = await runtime.fetchData(createDataRequest(sourceId, 'player', {
    contentId: tvItem.id,
    episodeId: tvItem.episodes[0].id
  }));
  assert.equal(playerResponse.item?.id, tvItem.id);
  assert.equal(playerResponse.item?.sourceId, sourceId);
  assert.equal(
    playerResponse.item?.episodes.some(episode => episode.id === tvItem.episodes[0].id),
    true
  );
  assert.equal(playerResponse.item?.playback.sources.length > 0, true);

  // 类型: Array<object>。
  // 作用: 在同一 Provider 生命周期中验证 movie 和 tv 都能返回可渲染筛选元数据。
  const filterResponses = await Promise.all([
    runtime.fetchFilterMeta(createFilterRequest(sourceId, 'movie')),
    runtime.fetchFilterMeta(createFilterRequest(sourceId, 'tv'))
  ]);
  assert.equal(filterResponses.every(response => response.sourceId === sourceId), true);
  assert.equal(filterResponses.every(response => response.groups.length > 0), true);

  return {
    movieTitle: movieItem.title,
    tvTitle: tvItem.title
  };
}

/**
 * 断言异步操作返回指定 runtime 错误。
 * 副作用: 执行 action 并由 Node assert 捕获拒绝；不修改 runtime 或错误对象。
 * 成功路径: 类型、code 和可选 cause 满足要求后完成。
 * 失败路径: action 成功或错误分类不匹配时由 assert 抛出测试失败。
 *
 * @param {Function} action 返回待断言 Promise 的函数。
 * @param {string} code 期望 SOURCE_RUNTIME_ERROR_CODE。
 * @param {boolean} requiresCause true 要求底层 cause 存在，false 不要求。
 * @returns {Promise<void>} 断言完成后结束。
 */
async function assertRuntimeError(action, code, requiresCause) {
  // 类型: Promise<*>。
  // 作用: 通过微任务统一捕获 action 的同步抛错和异步拒绝，不要求生产入口为迁就测试全部改成 async。
  const operation = Promise.resolve().then(action);

  await assert.rejects(operation, (error) => {
    // 断言作用: runtime 边界统一使用 SourceRuntimeError，不把 Host 或 Repository 错误直接暴露为顶层类型。
    assert.equal(error instanceof SourceRuntimeError, true);
    assert.equal(error.code, code);

    // 条件分支: 当前用例要求保留底层失败时进入。
    // 执行内容: 证明错误转换没有吞掉 Host 或校验器 cause。
    if (requiresCause) {
      assert.notEqual(error.cause, undefined);
    }

    // 返回值类型: boolean。
    // 作用: 通知 assert.rejects 当前错误已匹配。
    return true;
  });
}

/**
 * 幂等释放测试使用的数据源实例。
 * 副作用: 逐个调用 runtime.disposeSource；只清理当前测试 runtime 的 Host entry。
 * 成功路径: 全部实例释放或原本未启动后完成。
 * 失败路径: 任一真实释放失败时抛出，避免测试掩盖资源清理问题。
 *
 * @param {object} runtime 当前测试 SourceRuntime 门面。
 * @param {Array<string>} sourceIds 需要释放的数据源身份。
 * @returns {Promise<void>} 清理完成后结束。
 */
async function disposeRuntimeSources(runtime, sourceIds) {
  // 循环类型: for...of。
  // 初始值: sourceIds 第一项真实数据源身份。
  // 终止条件: 所有测试源都完成幂等释放。
  // 循环作用: 保证一个 runtime 的多个 Host entry 不残留到测试结束。
  for (const sourceId of sourceIds) {
    await runtime.disposeSource(sourceId);
  }
}

/**
 * 读取当前测试文件相对路径下的项目模块源码。
 * 副作用: 同步读取本地工作区文件；只用于验证模块导入边界，不修改文件。
 * 成功路径: 返回统一使用 LF 换行的 UTF-8 源码文本，让源码断言不依赖检出平台。
 * 失败路径: 文件不存在或不可读时由 readFileSync 抛出并使测试失败。
 *
 * @param {string} relativeUrl 相对当前测试文件的模块 URL。
 * @returns {string} UTF-8 模块源码。
 * @throws {Error} 当目标模块不可读取时抛出。
 */
function readProjectModuleSource(relativeUrl) {
  // 类型: string。
  // 作用: 使用 import.meta.url 形成跨工作目录稳定路径，避免测试依赖进程启动目录。
  const sourceText = readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');

  // 返回值类型: string。
  // 作用: 在共享读取边界把 Windows CRLF 和旧式 CR 统一为 LF，使等价源码在所有平台产生相同断言输入。
  return sourceText.replace(/\r\n?/gu, '\n');
}

/**
 * 创建运行态的可序列化隔离快照。
 * 纯函数: 不修改输入；当前 store 字段均为 JSON Value，序列化用于深比较失败前后状态。
 * 失败路径: 输入含不可序列化值时由 JSON 方法抛出并暴露 store 契约错误。
 *
 * @param {*} value 待复制的运行态对象。
 * @returns {*} 与输入 JSON 值等价的隔离快照。
 */
function createSerializableSnapshot(value) {
  // 返回值类型: JSON Value。
  // 作用: 返回不共享引用的快照，后续 store 写入不会反向修改预期值。
  return JSON.parse(JSON.stringify(value));
}

// 测试目的: runtime 公开边界必须冻结且并发首次初始化返回互不穿透的同一 Manager 事实。
test('SourceRuntime 冻结十一方法并收敛并发首次初始化', async () => {
  // 类型: object。
  // 作用: 创建使用默认显式 Repository 种子的独立 runtime。
  const runtime = createSourceRuntime(createMockSourceRuntimeOptions());

  // 断言作用: 公开对象只含契约十一方法，不能获得 Manager、Host、Repository 或 Promise 索引。
  assert.deepEqual(Object.keys(runtime), RUNTIME_PUBLIC_METHODS);
  assert.equal(Object.isFrozen(runtime), true);
  RUNTIME_PUBLIC_METHODS.forEach((methodName) => {
    assert.equal(typeof runtime[methodName], 'function');
  });

  // 类型: Array<object>。
  // 作用: 同一事件循环并发触发两次 initialize 和一次 getState，验证没有重复初始化冲突。
  const [firstState, secondState, thirdState] = await Promise.all([
    runtime.initialize(),
    runtime.initialize(),
    runtime.getSourceManagerState()
  ]);

  // 断言作用: 三个投影表达同一九源事实，但每个调用方获得独立对象引用。
  assert.equal(firstState.records.length, 9);
  assert.deepEqual(firstState, secondState);
  assert.deepEqual(secondState, thirdState);
  assert.notEqual(firstState, secondState);
  assert.notEqual(secondState, thirdState);

  // 副作用范围: 只修改第一个调用方持有的隔离投影副本。
  firstState.records[0].definition.name = '调用方污染名称';

  // 类型: object。
  // 作用: 重新读取 Manager 投影，证明 initializationPromise 没有把可变结果当作保存权威。
  const repeatedState = await runtime.getSourceManagerState();
  assert.notEqual(repeatedState.records[0].definition.name, '调用方污染名称');
});

// 测试目的: Runtime Bundle 必须只裁剪两个冻结门面，并让内容初始化通过同一 Manager 发布给管理订阅者。
test('Runtime Bundle 共享初始化和 SourceManager 状态观察', async () => {
  // 类型: object。
  // 作用: 创建本测试独立 Bundle，两个门面尚未初始化且共享同一闭包基础设施。
  const runtimeBundle = createSourceRuntimeBundle(createMockSourceRuntimeOptions());

  // 类型: object。
  // 作用: 保存内容、筛选、健康和 Host 生命周期门面。
  const sourceRuntime = runtimeBundle.sourceRuntime;

  // 类型: object。
  // 作用: 保存设置管理初始化、状态观察和全部领域意图门面。
  const sourceManagementRuntime = runtimeBundle.sourceManagementRuntime;

  // 断言作用: Bundle 和两个门面均冻结且只包含正式公开字段，不泄漏 Manager、Host 或 Repository。
  assert.deepEqual(Object.keys(runtimeBundle), RUNTIME_BUNDLE_PUBLIC_FIELDS);
  assert.deepEqual(Object.keys(sourceRuntime), RUNTIME_PUBLIC_METHODS);
  assert.deepEqual(Object.keys(sourceManagementRuntime), MANAGEMENT_RUNTIME_PUBLIC_METHODS);
  assert.equal(Object.isFrozen(runtimeBundle), true);
  assert.equal(Object.isFrozen(sourceRuntime), true);
  assert.equal(Object.isFrozen(sourceManagementRuntime), true);

  // 类型: Array<object>。
  // 作用: 收集管理门面订阅收到的投影，证明内容门面初始化使用同一 SourceManager。
  const observedStates = [];

  // 类型: Function。
  // 作用: 保存管理门面返回的幂等取消句柄，测试结束前解除本地订阅。
  const unsubscribe = sourceManagementRuntime.subscribe(state => observedStates.push(state));

  // 类型: object。
  // 作用: 只调用内容门面初始化；共享 Manager 必须向管理订阅者发布首份稳定投影。
  const contentState = await sourceRuntime.initialize();
  assert.equal(observedStates.length, 1);
  assert.deepEqual(observedStates[0], contentState);

  // 类型: object。
  // 作用: 再调用管理门面初始化；共享 Promise 只读取隔离状态，不重复执行 Manager.initialize。
  const managementState = await sourceManagementRuntime.initialize();
  assert.equal(observedStates.length, 1);
  assert.deepEqual(managementState, contentState);
  assert.notEqual(managementState, contentState);

  // 副作用范围: 只修改订阅者持有的隔离投影，不能污染两个门面的后续状态读取。
  observedStates[0].records[0].definition.name = 'observer mutation';
  assert.notEqual(
    (await sourceManagementRuntime.getSourceManagerState()).records[0].definition.name,
    'observer mutation'
  );

  // 清理副作用: 移除当前测试管理订阅，避免后续本地初始化调用继续记录投影。
  unsubscribe();
});

// 测试目的: 应用实例模块必须导出同一 Bundle 裁剪的两个门面，且管理实例只暴露十八个正式方法。
test('应用实例模块导出内容和设置管理两个冻结门面', () => {
  // 断言作用: 应用内容实例保持十一方法契约，内容和筛选 service 复用候选与切换入口。
  assert.deepEqual(Object.keys(sourceRuntimeInstance), RUNTIME_PUBLIC_METHODS);

  // 断言作用: 应用设置管理实例精确包含十八个正式方法，不能获得 Bundle 或基础设施引用。
  assert.deepEqual(
    Object.keys(sourceManagementRuntimeInstance),
    MANAGEMENT_RUNTIME_PUBLIC_METHODS
  );
  assert.equal(Object.isFrozen(sourceRuntimeInstance), true);
  assert.equal(Object.isFrozen(sourceManagementRuntimeInstance), true);
});

// 测试目的: 页面候选必须由 Runtime 一处派生，并严格区分显式源、活动源和默认源。
test('SourceRuntime 统一派生页面候选并解析请求源身份', async () => {
  // 类型: object。
  // 作用: 创建默认活动源为 系统数据源1 的独立 Runtime；候选读取不会启动任何 Provider。
  const runtime = createSourceRuntime(createMockSourceRuntimeOptions());

  // 类型: object。
  // 作用: 读取 Runtime 共享 Manager 投影，验证未注册源保留启用意愿但明确标记 Provider 未就绪。
  const managerState = await runtime.getSourceManagerState();
  // 类型: object。
  // 作用: 按稳定测试身份定位未注册管理记录，不依赖候选数组中缺席的间接结果。
  const unresolvedRecord = managerState.records.find(
    record => record.definition.id === RUNTIME_TEST_SOURCE_IDS.unresolved
  );
  assert.ok(unresolvedRecord);
  assert.equal(unresolvedRecord.runtime.enabled, true);
  assert.equal(
    unresolvedRecord.runtime.providerReadiness.status,
    PROVIDER_READINESS_STATUS.unavailable
  );

  // 循环类型: for...of。
  // 初始值: home 页面键。
  // 终止条件: 六类页面都验证相同三条可执行候选。
  // 循环作用: 同时覆盖 player 到 play 能力映射，并排除禁用、未注册和无受审数据集记录。
  for (const pageKey of RUNTIME_PAGE_KEYS) {
    // 类型: Array<object>。
    // 作用: 保存当前页面最新隔离候选，顺序必须沿用 Manager records 而不是另建排序状态。
    const candidates = await runtime.listAvailableSources(pageKey);
    assert.deepEqual(
      candidates.map(record => record.definition.id),
      RUNTIME_AVAILABLE_SOURCE_IDS
    );
  }

  // 断言作用: 省略 sourceId 时采用当前 activeSourceId；默认构造中活动源与默认源均为 系统数据源1。
  assert.equal(
    await runtime.resolveSourceId('', 'movie'),
    RUNTIME_TEST_SOURCE_IDS.protocolA
  );

  // 断言作用: 显式 系统数据源2 必须覆盖当前 系统数据源1 活动源，但本步骤不修改 activeSourceId。
  assert.equal(
    await runtime.resolveSourceId(RUNTIME_TEST_SOURCE_IDS.protocolB, 'movie'),
    RUNTIME_TEST_SOURCE_IDS.protocolB
  );

  // 异步断言: 禁用可信源不进入页面候选，不能因为存在工厂和数据集而自动启用。
  await assertRuntimeError(
    () => runtime.resolveSourceId(RUNTIME_TEST_SOURCE_IDS.disabledTrusted, 'movie'),
    SOURCE_RUNTIME_ERROR_CODE.unavailable,
    false
  );

  // 异步断言: 已启用但没有注册工厂的自定义源保留管理能力，不获得页面执行能力。
  await assertRuntimeError(
    () => runtime.resolveSourceId(RUNTIME_TEST_SOURCE_IDS.unresolved, 'movie'),
    SOURCE_RUNTIME_ERROR_CODE.unavailable,
    false
  );

  // 异步断言: 软隐藏且缺少受审数据集的旧系统源不能因 providerKey 已注册进入候选。
  await assertRuntimeError(
    () => runtime.resolveSourceId(RUNTIME_TEST_SOURCE_IDS.unsupportedTrusted, 'movie'),
    SOURCE_RUNTIME_ERROR_CODE.unavailable,
    false
  );

  // 类型: object。
  // 作用: 创建隔离 Repository 种子，把旧系统源调整为启用且可见，只保留“工厂没有受审数据集”这一负向条件。
  const unsupportedDataSetSeeds = createSerializableSnapshot(mockSourceRepositorySeeds);
  unsupportedDataSetSeeds.preferences.removedSystemSourceIds = [];
  unsupportedDataSetSeeds.preferences.sourceStates[
    RUNTIME_TEST_SOURCE_IDS.unsupportedTrusted
  ].enabled = true;

  // 类型: object。
  // 作用: 使用隔离种子创建 Runtime，验证 providerKey 注册成功仍必须继续通过工厂 supports(definition)。
  const unsupportedDataSetRuntime = createSourceRuntime(createMockSourceRuntimeOptions({
    repositories: createMemorySourceRepositories(unsupportedDataSetSeeds)
  }));
  assert.equal(
    (await unsupportedDataSetRuntime.listAvailableSources('movie')).some(
      record => record.definition.id === RUNTIME_TEST_SOURCE_IDS.unsupportedTrusted
    ),
    false
  );

  // 类型: object。
  // 作用: 构造初始活动源为未注册脚本的 Runtime，验证 Manager 先清空无全局运行资格的活动身份。
  const unsupportedActiveRuntime = createSourceRuntime(createMockSourceRuntimeOptions({
    activeSourceId: RUNTIME_TEST_SOURCE_IDS.unresolved
  }));
  // 类型: object。
  // 作用: 读取初始化后的权威状态，区分“活动源已清空”与“仍存在但页面能力不足”的解析语义。
  const unsupportedActiveState = await unsupportedActiveRuntime.getSourceManagerState();
  assert.equal(unsupportedActiveState.activeSourceId, '');
  assert.equal(
    await unsupportedActiveRuntime.resolveSourceId('', 'movie'),
    RUNTIME_TEST_SOURCE_IDS.protocolA
  );
});

// 测试目的: Runtime 必须由同一 Manager 状态机完成正常、并发、失败和切回原源，不产生第二活动身份。
test('SourceRuntime 原子切换活动源并拒绝过期结果与失败目标', async () => {
  // 类型: object。
  // 作用: 创建共享内容和管理门面的隔离 Bundle，管理订阅用于观察完整切换状态发布顺序。
  const runtimeBundle = createSourceRuntimeBundle(createMockSourceRuntimeOptions());

  // 类型: object。
  // 作用: 保存被测十一方法内容门面，所有切换和 Host 生命周期只通过该入口执行。
  const runtime = runtimeBundle.sourceRuntime;

  // 类型: Array<object>。
  // 作用: 收集 Manager 发布的隔离投影，验证切换不依赖轮询或页面临时状态。
  const observedStates = [];

  // 类型: Function。
  // 作用: 保存幂等取消函数，finally 中停止本测试继续接收状态。
  const unsubscribe = runtimeBundle.sourceManagementRuntime.subscribe(
    state => observedStates.push(state)
  );

  try {
    // 类型: object。
    // 作用: 先启动原活动源，后续切回必须复用同一 running lifecycleGeneration。
    const originalRuntimeState = await runtime.ensureSourceRunning(
      RUNTIME_TEST_SOURCE_IDS.protocolA
    );

    // 类型: object。
    // 作用: 正常切换到 B 协议源，Manager 必须一次采用 activeSourceId 和 success。
    const protocolBState = await runtime.switchActiveSource(
      RUNTIME_TEST_SOURCE_IDS.protocolB
    );
    assert.equal(protocolBState.activeSourceId, RUNTIME_TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolBState.switchState.status, SOURCE_SWITCH_STATUS.success);
    assert.equal(protocolBState.switchState.pendingSourceId, RUNTIME_TEST_SOURCE_IDS.protocolB);
    assert.equal(
      await runtime.resolveSourceId('', 'movie'),
      RUNTIME_TEST_SOURCE_IDS.protocolB
    );

    // 类型: number。
    // 作用: 定位 B 请求 switching 投影，证明旧 activeSourceId 在准备期间仍为 A。
    const protocolBSwitchingIndex = observedStates.findIndex(state => (
      state.switchState.status === SOURCE_SWITCH_STATUS.switching
      && state.switchState.pendingSourceId === RUNTIME_TEST_SOURCE_IDS.protocolB
    ));

    // 类型: number。
    // 作用: 定位同一 B 请求 success 投影，验证它严格晚于 switching 发布。
    const protocolBSuccessIndex = observedStates.findIndex(state => (
      state.switchState.status === SOURCE_SWITCH_STATUS.success
      && state.switchState.pendingSourceId === RUNTIME_TEST_SOURCE_IDS.protocolB
    ));
    assert.equal(protocolBSwitchingIndex >= 0, true);
    assert.equal(protocolBSuccessIndex > protocolBSwitchingIndex, true);
    assert.equal(
      observedStates[protocolBSwitchingIndex].activeSourceId,
      RUNTIME_TEST_SOURCE_IDS.protocolA
    );

    // 类型: object。
    // 作用: 保存切回原源后的 Manager 成功投影。
    const restoredState = await runtime.switchActiveSource(RUNTIME_TEST_SOURCE_IDS.protocolA);

    // 类型: object。
    // 作用: 读取切回后的 Host 摘要，证明有效 running entry 没有被销毁后重建。
    const restoredRuntimeState = await runtime.ensureSourceRunning(
      RUNTIME_TEST_SOURCE_IDS.protocolA
    );
    assert.equal(restoredState.activeSourceId, RUNTIME_TEST_SOURCE_IDS.protocolA);
    assert.equal(
      restoredRuntimeState.lifecycleGeneration,
      originalRuntimeState.lifecycleGeneration
    );

    // 类型: object。
    // 作用: 保存拒绝前稳定状态，证明不可执行目标不会发布虚假的 switching 或 failed 事务。
    const stateBeforeUnavailableSwitch = await runtime.getSourceManagerState();

    // 异步断言: 未注册自定义源在 Manager begin 前由统一执行门禁失败，公开错误保持 unavailable。
    await assertRuntimeError(
      () => runtime.switchActiveSource(RUNTIME_TEST_SOURCE_IDS.unresolved),
      SOURCE_RUNTIME_ERROR_CODE.unavailable,
      false
    );

    // 类型: object。
    // 作用: 读取拒绝后状态，证明原活动源和上一份稳定 success 投影没有被无效切换意图覆盖。
    const stateAfterUnavailableSwitch = await runtime.getSourceManagerState();
    assert.deepEqual(stateAfterUnavailableSwitch, stateBeforeUnavailableSwitch);

    // 类型: Array<object>。
    // 作用: 同一事件循环提交 B 和 C 两次切换，最终状态必须只服从后创建的 C 请求。
    const rapidSwitchStates = await Promise.all([
      runtime.switchActiveSource(RUNTIME_TEST_SOURCE_IDS.protocolB),
      runtime.switchActiveSource(RUNTIME_TEST_SOURCE_IDS.protocolC)
    ]);
    assert.equal(rapidSwitchStates.length, 2);

    // 类型: object。
    // 作用: 读取并发收敛后的 Manager 事实，旧 B 完成无论先后都不能覆盖最新 C。
    const latestState = await runtime.getSourceManagerState();
    assert.equal(latestState.activeSourceId, RUNTIME_TEST_SOURCE_IDS.protocolC);
    assert.equal(latestState.switchState.status, SOURCE_SWITCH_STATUS.success);
    assert.equal(latestState.switchState.pendingSourceId, RUNTIME_TEST_SOURCE_IDS.protocolC);
  } finally {
    // 清理副作用: 停止状态订阅并释放本用例可能启动的三条受审 Provider entry。
    unsubscribe();
    await disposeRuntimeSources(runtime, [
      RUNTIME_TEST_SOURCE_IDS.protocolA,
      RUNTIME_TEST_SOURCE_IDS.protocolB,
      RUNTIME_TEST_SOURCE_IDS.protocolC
    ]);
  }
});

// 测试目的: A/B 核心模拟源必须完整覆盖全页面请求，且同源内容、分集和线路引用闭合。
test('双协议模拟源完整覆盖六类页面与两类筛选请求', async () => {
  // 类型: object。
  // 作用: 创建独立 Runtime，让两个核心源共享同一 Host 但分别维护生命周期 entry。
  const runtime = createSourceRuntime(createMockSourceRuntimeOptions());

  try {
    // 类型: Array<object>。
    // 作用: 分别执行 A/B 完整矩阵，返回标题摘要用于证明两套数据不是同一响应复制。
    const [protocolACoverage, protocolBCoverage] = await Promise.all([
      assertRuntimePageCoverage(runtime, RUNTIME_TEST_SOURCE_IDS.protocolA),
      assertRuntimePageCoverage(runtime, RUNTIME_TEST_SOURCE_IDS.protocolB)
    ]);

    // 断言作用: A/B 的电影和电视剧标题均不同，页面切换后能够观察到真实数据差异。
    assert.notEqual(protocolACoverage.movieTitle, protocolBCoverage.movieTitle);
    assert.notEqual(protocolACoverage.tvTitle, protocolBCoverage.tvTitle);
  } finally {
    // 清理副作用: 释放本用例启动的两个 Provider entry，不影响后续生命周期测试。
    await disposeRuntimeSources(runtime, [
      RUNTIME_TEST_SOURCE_IDS.protocolA,
      RUNTIME_TEST_SOURCE_IDS.protocolB
    ]);
  }
});

// 测试目的: 同一 sourceId 并发 ensure 必须共享一个生命周期，不同 sourceId 可以独立运行。
test('SourceRuntime 去重同源启动并允许双源独立运行', async () => {
  // 类型: object。
  // 作用: 创建本测试独立 runtime，Host 初始没有任何 entry。
  const runtime = createSourceRuntime(createMockSourceRuntimeOptions());

  try {
    // 类型: Array<object>。
    // 作用: 同一事件循环三次请求 系统数据源1 启动，结果应来自同一 ensure Promise 和 Host generation。
    const sameSourceStates = await Promise.all([
      runtime.ensureSourceRunning(RUNTIME_TEST_SOURCE_IDS.protocolA),
      runtime.ensureSourceRunning(RUNTIME_TEST_SOURCE_IDS.protocolA),
      runtime.ensureSourceRunning(RUNTIME_TEST_SOURCE_IDS.protocolA)
    ]);

    // 断言作用: 三个调用复用同一冻结摘要引用，没有触发 Host conflict 或创建多个代次。
    assert.equal(sameSourceStates[0], sameSourceStates[1]);
    assert.equal(sameSourceStates[1], sameSourceStates[2]);
    assert.equal(sameSourceStates[0].phase, 'running');
    assert.equal(sameSourceStates[0].lifecycleGeneration, 1);

    // 类型: object。
    // 作用: 启动 B 协议源，证明每源 Promise Map 不把不同 sourceId 串成一条全局队列。
    const protocolBState = await runtime.ensureSourceRunning(RUNTIME_TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolBState.sourceId, RUNTIME_TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolBState.phase, 'running');
    assert.equal(protocolBState.lifecycleGeneration, 1);
  } finally {
    await disposeRuntimeSources(runtime, [
      RUNTIME_TEST_SOURCE_IDS.protocolA,
      RUNTIME_TEST_SOURCE_IDS.protocolB
    ]);
  }
});

// 测试目的: 内容、筛选和健康必须经同一 runtime/Host 返回可区分 A/B 标准结果。
test('SourceRuntime 通过同一 Host 返回双协议内容筛选和健康结果', async () => {
  // 类型: object。
  // 作用: 创建完整默认 runtime，两个 Provider 尚未启动。
  const runtime = createSourceRuntime(createMockSourceRuntimeOptions());

  try {
    // 类型: Array<object>。
    // 作用: 并发请求 A/B 内容，runtime 分别按真实 sourceId 延迟启动 Provider。
    const [protocolAContent, protocolBContent] = await Promise.all([
      runtime.fetchData(createDataRequest(RUNTIME_TEST_SOURCE_IDS.protocolA)),
      runtime.fetchData(createDataRequest(RUNTIME_TEST_SOURCE_IDS.protocolB))
    ]);

    // 断言作用: 响应、请求和 ContentItem 全部保持真实 sourceId，A/B 标题可区分。
    assert.equal(protocolAContent.sourceId, RUNTIME_TEST_SOURCE_IDS.protocolA);
    assert.equal(protocolBContent.sourceId, RUNTIME_TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolAContent.request.sourceId, RUNTIME_TEST_SOURCE_IDS.protocolA);
    assert.equal(protocolBContent.request.sourceId, RUNTIME_TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolAContent.items.every(item => item.sourceId === RUNTIME_TEST_SOURCE_IDS.protocolA), true);
    assert.equal(protocolBContent.items.every(item => item.sourceId === RUNTIME_TEST_SOURCE_IDS.protocolB), true);
    assert.notEqual(protocolAContent.items[0].title, protocolBContent.items[0].title);

    // 类型: Array<object>。
    // 作用: 在已运行的同一 Provider entry 上并发执行筛选和健康受管调用。
    const [protocolAFilter, protocolBFilter, protocolAHealth, protocolBHealth] = await Promise.all([
      runtime.fetchFilterMeta(createFilterRequest(RUNTIME_TEST_SOURCE_IDS.protocolA, 'movie')),
      runtime.fetchFilterMeta(createFilterRequest(RUNTIME_TEST_SOURCE_IDS.protocolB, 'tv')),
      runtime.checkHealth(RUNTIME_TEST_SOURCE_IDS.protocolA),
      runtime.checkHealth(RUNTIME_TEST_SOURCE_IDS.protocolB)
    ]);

    // 断言作用: 筛选和健康共用 runtime/Host，但结果仍保持各自身份与页面语义。
    assert.equal(protocolAFilter.sourceId, RUNTIME_TEST_SOURCE_IDS.protocolA);
    assert.equal(protocolAFilter.pageKey, 'movie');
    assert.equal(protocolBFilter.sourceId, RUNTIME_TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolBFilter.pageKey, 'tv');
    assert.notDeepEqual(protocolAFilter.groups, protocolBFilter.groups);
    assert.equal(protocolAHealth.healthStatus, 'normal');
    assert.equal(protocolBHealth.healthStatus, 'normal');
  } finally {
    await disposeRuntimeSources(runtime, [
      RUNTIME_TEST_SOURCE_IDS.protocolA,
      RUNTIME_TEST_SOURCE_IDS.protocolB
    ]);
  }
});

// 测试目的: runtime 必须区分非法输入、未知记录和未注册工厂门禁，并在适用时保留 cause。
test('SourceRuntime 使用稳定错误码收敛输入记录和可信工厂失败', async () => {
  // 断言作用: 构造选项额外携带页面对象时同步返回 validation，组合层不静默接收页面依赖。
  assert.throws(
    () => createSourceRuntime(createMockSourceRuntimeOptions({ page: {} })),
    (error) => error instanceof SourceRuntimeError
      && error.code === SOURCE_RUNTIME_ERROR_CODE.validation
  );

  // 类型: object。
  // 作用: 创建正常 runtime，后续负向调用共享同一 Manager 投影。
  const runtime = createSourceRuntime(createMockSourceRuntimeOptions());

  // 异步断言: 完全未知 id 返回 notFound，不回退默认源或建立别名。
  await assertRuntimeError(
    () => runtime.ensureSourceRunning('missing-source-id'),
    SOURCE_RUNTIME_ERROR_CODE.notFound,
    false
  );

  // 异步断言: 启用但 providerKey 未注册的自定义源由 Host gate 拒绝，并保留 Host cause。
  await assertRuntimeError(
    () => runtime.ensureSourceRunning(RUNTIME_TEST_SOURCE_IDS.unresolved),
    SOURCE_RUNTIME_ERROR_CODE.unavailable,
    true
  );

  // 异步断言: 非法危险 sourceId 在读取 Manager 前返回 validation，并保留 Shell 校验 cause。
  await assertRuntimeError(
    () => runtime.ensureSourceRunning('__proto__'),
    SOURCE_RUNTIME_ERROR_CODE.validation,
    true
  );
});

// 测试目的: stop 后再次请求必须释放已中止 Context，并使用更高 Host generation 重建 Provider。
test('SourceRuntime 停止后按需请求创建新生命周期代次', async () => {
  // 类型: object。
  // 作用: 创建本测试独立 runtime，只运行 A 协议源。
  const runtime = createSourceRuntime(createMockSourceRuntimeOptions());

  try {
    // 类型: object。
    // 作用: 保存首次按需启动的 generation 1 运行摘要。
    const firstRunningState = await runtime.ensureSourceRunning(RUNTIME_TEST_SOURCE_IDS.protocolA);

    // 类型: object。
    // 作用: 停止首次生命周期，Host 必须先 abort 并拒绝新调用。
    const stoppedState = await runtime.stopSource(RUNTIME_TEST_SOURCE_IDS.protocolA);
    assert.equal(stoppedState.phase, 'stopped');
    assert.equal(stoppedState.lifecycleGeneration, firstRunningState.lifecycleGeneration);

    // 类型: object。
    // 作用: 停止后通过公开内容入口触发 dispose 旧 entry 和新代次启动。
    const responseAfterRestart = await runtime.fetchData(
      createDataRequest(RUNTIME_TEST_SOURCE_IDS.protocolA)
    );

    // 类型: object。
    // 作用: 读取重建后 running 摘要，证明没有复用已 abort 的 generation 1 Context。
    const secondRunningState = await runtime.ensureSourceRunning(RUNTIME_TEST_SOURCE_IDS.protocolA);

    // 断言作用: 内容请求成功且新 lifecycleGeneration 严格大于首次代次。
    assert.equal(responseAfterRestart.sourceId, RUNTIME_TEST_SOURCE_IDS.protocolA);
    assert.equal(secondRunningState.phase, 'running');
    assert.equal(
      secondRunningState.lifecycleGeneration > firstRunningState.lifecycleGeneration,
      true
    );
  } finally {
    await disposeRuntimeSources(runtime, [RUNTIME_TEST_SOURCE_IDS.protocolA]);
  }
});

// 测试目的: 内容和筛选 service 必须只导入同一生产 Runtime 实例，并删除旧注册表与 store 身份回退。
// 测试边界: 这里只验证静态依赖方向；离线业务行为由显式 Mock Runtime 用例负责，真实网络生命周期由跨进程 ProxyClient 用例负责。
test('内容和筛选 service 只依赖应用 Runtime 并退出旧注册表', () => {
  // 类型: string。
  // 作用: 读取内容 service 源码，验证它通过唯一实例模块调用 Runtime。
  const sourceDataServiceSource = readProjectModuleSource('../src/services/sourceDataService.js');

  // 类型: string。
  // 作用: 读取筛选 service 源码，验证它和内容 service 使用同一个实例模块。
  const sourceFilterServiceSource = readProjectModuleSource('../src/services/sourceFilterService.js');

  // 类型: string。
  // 作用: 读取 Runtime 组合源码，验证 SourceManager 健康端口使用 SourceRecord.definition.id。
  const sourceRuntimeSource = readProjectModuleSource('../src/runtime/createSourceRuntime.js');

  // 断言作用: 两个 service 都只从同一路径导入应用共享实例，没有各自调用 createSourceRuntime。
  assert.match(sourceDataServiceSource, /from '\.\.\/runtime\/sourceRuntimeInstance\.js';/);
  assert.match(sourceFilterServiceSource, /from '\.\.\/runtime\/sourceRuntimeInstance\.js';/);
  assert.doesNotMatch(sourceDataServiceSource, /createSourceRuntime\s*\(/);
  assert.doesNotMatch(sourceFilterServiceSource, /createSourceRuntime\s*\(/);

  // 断言作用: 两个 service 不能再从上次成功响应 store 读取活动身份，缺省请求必须委托 Runtime.resolveSourceId。
  assert.doesNotMatch(sourceDataServiceSource, /:\s*siteContentStore\.activeSourceId\s*\|\|/);
  assert.doesNotMatch(sourceFilterServiceSource, /:\s*siteFilterStore\.activeSourceId\s*\|\|/);
  assert.match(sourceDataServiceSource, /sourceRuntimeInstance\.resolveSourceId\s*\(/);
  assert.match(sourceFilterServiceSource, /sourceRuntimeInstance\.resolveSourceId\s*\(/);

  // 类型: number；作用: 定位页面请求事务开始调用，作为身份解析失败可见性顺序起点。
  const beginTransactionIndex = sourceDataServiceSource.indexOf('beginSourceDataRequest(transaction);');
  // 类型: number；作用: 定位 Runtime 身份解析调用，证明它发生在 loading 事务已经发布之后。
  const resolveSourceIndex = sourceDataServiceSource.indexOf('await resolveSourceDataRequest(baseRequest);');
  // 类型: number；作用: 从解析调用之后定位真实源采用端口，避免误命中模块注释或 import。
  const adoptResolvedSourceIndex = sourceDataServiceSource.indexOf(
    'resolveSourceDataRequestTransaction(',
    resolveSourceIndex
  );
  // 断言作用: 结构合法请求必须先发布身份待解析 loading，再解析并在同一事务补齐真实源。
  assert.ok(beginTransactionIndex >= 0 && beginTransactionIndex < resolveSourceIndex);
  assert.ok(resolveSourceIndex >= 0 && resolveSourceIndex < adoptResolvedSourceIndex);

  // 断言作用: 内容服务必须按 Runtime 稳定 code 映射页面安全说明，禁止把可能含 sourceId/cause 的原始 message 写入事务。
  assert.match(sourceDataServiceSource, /SOURCE_DATA_REQUEST_ERROR_MESSAGE_BY_CODE/u);
  assert.match(sourceDataServiceSource, /createSourceDataRequestPageError\(error\)/u);
  assert.match(sourceDataServiceSource, /failSourceDataRequest\(transaction, createSourceDataRequestPageError\(error\)\)/u);
  assert.doesNotMatch(sourceDataServiceSource, /failSourceDataRequest\(transaction, error\)/u);

  // 循环类型: Array.prototype.forEach。
  // 初始值: 第一个旧内容 Provider 注册导出名称。
  // 终止条件: 六个内容/筛选旧注册标识全部检查完成。
  // 循环作用: 同时验证模块导出集合和源码不再保留旧 registry 兼容入口。
  LEGACY_SERVICE_EXPORT_NAMES.forEach((exportName) => {
    assert.equal(Object.hasOwn(sourceDataServiceModule, exportName), false);
    assert.equal(Object.hasOwn(sourceFilterServiceModule, exportName), false);
    assert.equal(sourceDataServiceSource.includes(exportName), false);
    assert.equal(sourceFilterServiceSource.includes(exportName), false);
  });

  // 断言作用: 健康端口读取轻量 SourceRecord.definition.id，不恢复 record.id 别名。
  assert.match(sourceRuntimeSource, /const sourceId = sourceRecord\.definition\.id;/);
  assert.doesNotMatch(sourceRuntimeSource, /const sourceId = sourceRecord\.id;/);

});

// 测试目的: 响应采用规则必须保留显式内容身份，并拒绝已经被新活动源取代的普通页面结果。
test('响应采用规则区分显式身份和活动源过期结果', () => {
  // 类型: object。
  // 作用: 模拟请求期间活动源已经从 A 切换到 B 的最新 Manager 投影。
  const managerStateAfterSwitch = {
    activeSourceId: RUNTIME_TEST_SOURCE_IDS.protocolB,
    defaultSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA
  };

  // 断言作用: 省略显式 sourceId 的 A 响应在 Manager 已切到 B 后必须拒绝提交。
  assert.equal(isSourceResponseAdoptable(
    '',
    RUNTIME_TEST_SOURCE_IDS.protocolA,
    RUNTIME_TEST_SOURCE_IDS.protocolA,
    managerStateAfterSwitch
  ), false);

  // 断言作用: 显式 A 请求代表详情、播放或用户记录身份，即使全局活动源为 B 仍允许采用同源响应。
  assert.equal(isSourceResponseAdoptable(
    RUNTIME_TEST_SOURCE_IDS.protocolA,
    RUNTIME_TEST_SOURCE_IDS.protocolA,
    RUNTIME_TEST_SOURCE_IDS.protocolA,
    managerStateAfterSwitch
  ), true);

  // 断言作用: Provider 响应身份与 Runtime 已解析请求不一致属于契约损坏，必须抛错而不是按过期结果忽略。
  assert.throws(() => isSourceResponseAdoptable(
    '',
    RUNTIME_TEST_SOURCE_IDS.protocolA,
    RUNTIME_TEST_SOURCE_IDS.protocolB,
    managerStateAfterSwitch
  ), /响应身份与已解析请求身份不一致/);
});

// 测试目的: 四个顶部入口必须只使用 Runtime 页面服务，静态源 mock 和内容 store 候选占位必须退出。
test('内容页面统一使用 Runtime 数据源切换入口', () => {
  // 类型: Array<object>。
  // 作用: 固定四个具有顶部切换入口的页面及其正式 pageKey，逐页检查同一组件契约。
  const pageModules = [
    { relativeUrl: '../src/views/HomeView.vue', pageKey: 'home' },
    { relativeUrl: '../src/views/MovieView.vue', pageKey: 'movie' },
    { relativeUrl: '../src/views/TVView.vue', pageKey: 'tv' },
    { relativeUrl: '../src/views/SearchResultView.vue', pageKey: 'search' }
  ];

  // 循环类型: Array.prototype.forEach。
  // 初始值: 首页入口。
  // 终止条件: 四个页面全部完成静态依赖、pageKey 和成功事件检查。
  // 循环作用: 防止任一页面恢复独立 sourceTabs、静态 mock 或无事务切换入口。
  pageModules.forEach(({ relativeUrl, pageKey }) => {
    // 类型: string。
    // 作用: 读取当前页面源码，执行不依赖 Vue 挂载的架构边界断言。
    const pageSource = readProjectModuleSource(relativeUrl);

    assert.doesNotMatch(pageSource, /source-switch\.mock|sourceSwitchData/);
    assert.match(pageSource, new RegExp(`page-key="${pageKey}"`));
    assert.match(pageSource, /@source-switched="handleSourceSwitched"/);
  });

  // 类型: string。
  // 作用: 读取共享切换组件源码，验证候选、事务和成功通知来自统一页面 service。
  const sourceSwitchTabsSource = readProjectModuleSource(
    '../src/components/source/SourceSwitchTabs.vue'
  );
  assert.match(sourceSwitchTabsSource, /from '\.\.\/\.\.\/services\/sourcePageService\.js';/);
  assert.match(sourceSwitchTabsSource, /this\.\$emit\('source-switched', \{ sourceId: source\.id \}\);/);
  // 断言作用: 所有视口必须只遍历一次 Runtime 候选，防止重新建立桌面和手机两棵数据源按钮树。
  assert.equal((sourceSwitchTabsSource.match(/v-for="source in visibleSources"/g) || []).length, 1);
  // 断言作用: 手机端通过本地折叠状态显示同一菜单，不能恢复 Element UI 浮层覆盖后续轮播内容。
  assert.match(sourceSwitchTabsSource, /@click="toggleMenu"/);
  assert.match(sourceSwitchTabsSource, /source-switch-tabs__menu--open/);
  assert.doesNotMatch(sourceSwitchTabsSource, /<el-dropdown|<el-dropdown-menu/u);
  // 断言作用: 桌面标题必须使用真实候选长度，不能写死当前四源数量或把版本、域名拼入标题。
  assert.match(sourceSwitchTabsSource, /<h2 class="source-switch-tabs__title">可用数据源<\/h2>/u);
  assert.match(sourceSwitchTabsSource, /\(\{\{ visibleSources\.length \}\}\)/u);
  // 断言作用: 桌面标题必须占自然宽度，轨道吸收剩余空间；错误说明独占完整下一行而不挤压候选。
  assert.match(sourceSwitchTabsSource, /grid-template-columns: max-content minmax\(0, 1fr\);/u);
  assert.match(sourceSwitchTabsSource, /\.source-switch-tabs__error\s*\{[\s\S]*?grid-column: 1 \/ -1;/u);
  // 断言作用: 前后按钮只在候选自然宽度真实超过完整轨道时出现，少量源不得保留两端悬空控件或拉满菜单。
  assert.equal((sourceSwitchTabsSource.match(/v-if="hasScrollableOverflow"/g) || []).length, 2);
  assert.match(sourceSwitchTabsSource, /menu\.scrollWidth > rail\.clientWidth/u);
  assert.match(sourceSwitchTabsSource, /source-switch-tabs__rail--scrollable/u);
  assert.doesNotMatch(sourceSwitchTabsSource, /min-width:\s*100%;/u);
  // 断言作用: 前后按钮出现后必须只驱动组件内部 viewport，并按真实可视宽度翻页。
  assert.match(sourceSwitchTabsSource, /ref="sourceViewport"/u);
  assert.match(sourceSwitchTabsSource, /@scroll\.passive="updateScrollControls"/u);
  assert.match(sourceSwitchTabsSource, /scrollDesktopViewport\(-1\)/u);
  assert.match(sourceSwitchTabsSource, /scrollDesktopViewport\(1\)/u);
  assert.match(sourceSwitchTabsSource, /viewport\.scrollBy\(\{[\s\S]*direction \* viewport\.clientWidth/u);
  // 断言作用: 组件必须随 viewport 和菜单尺寸变化更新边界，并在销毁时释放观察器。
  assert.match(sourceSwitchTabsSource, /new ResizeObserver\(\(\) =>/u);
  assert.match(sourceSwitchTabsSource, /beforeDestroy\(\)[\s\S]*teardownSourceViewportObservation\(\)/u);
  // 断言作用: 桌面候选保持严格单行并由 viewport 承载溢出，禁止恢复多行或固定数量隐藏。
  assert.match(sourceSwitchTabsSource, /overflow-x: auto;/u);
  assert.match(sourceSwitchTabsSource, /flex-wrap: nowrap;/u);
  assert.match(sourceSwitchTabsSource, /width: max-content;/u);
  assert.doesNotMatch(sourceSwitchTabsSource, /flex-wrap: wrap;|visibleSources\.slice\(/u);
  // 断言作用: 健康点辅助说明必须明确它来自最近检测，不能冒充当前页面请求成功或失败。
  assert.match(sourceSwitchTabsSource, /最近健康检测正常，不代表本次页面请求结果/u);
  assert.match(sourceSwitchTabsSource, /:title="getStatusLabel\(source\.healthStatus\)"/u);
  // 断言作用: 桌面和手机必须复用页面 service 的有效源身份，使默认源和活动源遵循同一解析顺序。
  assert.match(sourceSwitchTabsSource, /getActivePageSourceId/);
  assert.match(sourceSwitchTabsSource, /source\.id === displaySourceId/);
  assert.match(sourceSwitchTabsSource, /source\.id === this\.displaySourceId/);
  assert.match(sourceSwitchTabsSource, /source-switch-tabs__item--active[\s\S]*background: var\(--accent-strong\);/);
  // 断言作用: 导航不显示版本字段，并在 Bootstrap md 以下使用覆盖小数 CSS 像素的互补折叠边界。
  assert.doesNotMatch(sourceSwitchTabsSource, /source\.version|__version/u);
  assert.match(sourceSwitchTabsSource, /@media \(max-width: 767\.98px\)/u);
  // 断言作用: 手机断点必须把桌面双列恢复为单列，折叠触发器和唯一候选菜单才能按文档流上下排列。
  assert.match(
    sourceSwitchTabsSource,
    /@media \(max-width: 767\.98px\)[\s\S]*?\.source-switch-tabs\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/u
  );
  // 断言作用: 手机数据源展开菜单的父 viewport 必须占满导航区域，不能被桌面自然宽度规则压缩。
  assert.match(sourceSwitchTabsSource, /@media \(max-width: 767\.98px\)[\s\S]*\.source-switch-tabs__viewport[\s\S]*width: 100%;[\s\S]*max-width: 100%;/u);

  // 类型: string；作用: 读取首页热门电影区块，验证标题入口和排行榜入口共用同一事件转发方法。
  const hotMovieSectionSource = readProjectModuleSource('../src/components/home/HotMovieSection.vue');
  // 断言作用: 电影标题“更多”必须把统一 movieRanking key 交给已有 HomeView 承接链。
  assert.match(hotMovieSectionSource, /@click="handleOpenMoreRanking\(rankingKey\)"/u);
  assert.match(hotMovieSectionSource, /:ranking-key="rankingKey"/u);
  assert.match(hotMovieSectionSource, /this\.\$emit\('open-more-ranking', rankingKey\)/u);
  assert.match(hotMovieSectionSource, /MOVIE_RANKING_KEY = 'movieRanking'/u);
  assert.doesNotMatch(hotMovieSectionSource, /\$router\.push/u);

  // 类型: string；作用: 读取首页热门电视剧区块，验证标题入口和排行榜入口共用同一事件转发方法。
  const hotTVSectionSource = readProjectModuleSource('../src/components/home/HotTVSection.vue');
  // 断言作用: 电视剧标题“更多”必须把统一 tvRanking key 交给已有 HomeView 承接链。
  assert.match(hotTVSectionSource, /@click="handleOpenMoreRanking\(rankingKey\)"/u);
  assert.match(hotTVSectionSource, /:ranking-key="rankingKey"/u);
  assert.match(hotTVSectionSource, /this\.\$emit\('open-more-ranking', rankingKey\)/u);
  assert.match(hotTVSectionSource, /TV_RANKING_KEY = 'tvRanking'/u);
  assert.doesNotMatch(hotTVSectionSource, /\$router\.push/u);

  // 类型: string；作用: 读取 HomeView 唯一路由承接逻辑，验证两个模块 key 仍映射到各自内容页。
  const homeViewSource = readProjectModuleSource('../src/views/HomeView.vue');
  // 断言作用: 电影和电视剧入口必须继续由页面层统一映射，排行榜行为不能被子组件分叉。
  assert.match(homeViewSource, /movieRanking:\s*'movie'/u);
  assert.match(homeViewSource, /tvRanking:\s*'tv'/u);
  assert.match(homeViewSource, /handleOpenMoreRanking\(moduleKey\)/u);

  // 类型: string；作用: 读取页面数据源适配服务，锁定导航通过共享显示适配器消费 SourceDefinition 完整名称。
  const sourcePageServiceSource = readProjectModuleSource('../src/services/sourcePageService.js');
  // 断言作用: 公共 service 必须通过统一适配器处理完整名称和 sourceId 兜底，不能在页面层建立第二套截取规则。
  assert.match(sourcePageServiceSource, /formatSourceDisplayName\(definition\.name, definition\.id\)/u);
  assert.doesNotMatch(sourcePageServiceSource, /\.replace\(|数据源\\s\*\$|createPageSourceLabel/u);
  assert.doesNotMatch(sourcePageServiceSource, /system-source-2|system-source-4|系统数据源3|system-source-1|source\.com\.|source\.net\./u);

  // 类型: string。
  // 作用: 读取内容 store 源码，验证静态页面候选不再作为第二保存对象存在。
  const siteContentStoreSource = readProjectModuleSource('../src/store/siteContentStore.js');
  assert.doesNotMatch(siteContentStoreSource, /^\s{2}sources\s*:/m);

  // 断言作用: 旧静态 mock 文件已经物理删除，任何恢复读取都会让本用例失败。
  assert.throws(
    () => readProjectModuleSource('../src/data/source-switch.mock.js'),
    error => error?.code === 'ENOENT'
  );
});

// 测试目的: 空搜索路由必须在页面请求边界停止，且不得暴露上一次搜索桶的可见状态。
test('搜索页空关键词不调用 Provider 并隐藏旧搜索桶投影', () => {
  // 类型: string。
  // 作用: 通过共享读取器取得搜索页源码，同时验证 CRLF、LF 或旧 CR 都已收敛成统一文本。
  const searchViewSource = readProjectModuleSource('../src/views/SearchResultView.vue');
  assert.equal(searchViewSource.includes('\r'), false);

  // 类型: number。
  // 作用: 定位空关键词门禁和请求调用，证明门禁在任何 Provider 请求之前执行。
  const emptyKeywordGuardIndex = searchViewSource.indexOf('if (!normalizedKeyword)');
  // 类型: number。
  // 作用: 定位统一内容请求入口，和门禁位置共同锁定调用顺序。
  const requestIndex = searchViewSource.indexOf('await requestSourceData', emptyKeywordGuardIndex);
  assert.ok(emptyKeywordGuardIndex >= 0);
  assert.ok(requestIndex > emptyKeywordGuardIndex);

  // 类型: string。
  // 作用: 隔离门禁到请求之间的实现片段，验证空关键词直接返回且不创建页面局部请求状态。
  const guardSource = searchViewSource.slice(emptyKeywordGuardIndex, requestIndex);
  assert.match(guardSource, /if \(!normalizedKeyword\)\s*\{[\s\S]*return;/u);
  // 断言作用: 页面不得恢复 loading/loadError 或搜索代次影子状态，最新性统一由 PageBucket.requestId 负责。
  assert.doesNotMatch(searchViewSource, /\bloadError\b|_searchRequestGeneration|this\.loading/u);
  // 断言作用: 空关键词通过统一状态选择器的请求意图参数屏蔽旧桶，不清空 Store 或伪造新事务。
  assert.match(searchViewSource, /createPageRequestViewState\(\{[\s\S]*hasRequestIntent:\s*Boolean\(this\.submittedKeyword\)/u);

  // 断言作用: 空搜索的结果与分页必须先按 submittedKeyword 短路，不得展示旧桶事实。
  assert.match(searchViewSource, /results\(\)\s*\{[\s\S]*if \(!this\.submittedKeyword\)\s*\{[\s\S]*return \[\];/u);
  assert.match(searchViewSource, /pagination\(\)\s*\{[\s\S]*if \(!this\.submittedKeyword\)\s*\{[\s\S]*return null;/u);
  // 断言作用: 标题摘要必须区分 loading、ready、empty、error，失败时不得继续拼接“当前返回 0 条结果”。
  assert.match(searchViewSource, /searchSummaryText\(\)[\s\S]*PAGE_REQUEST_VIEW_STATUS\.loading[\s\S]*PAGE_REQUEST_VIEW_STATUS\.error[\s\S]*PAGE_REQUEST_VIEW_STATUS\.empty/u);
  assert.doesNotMatch(searchViewSource, /当前返回\s*\{\{\s*resultCount|search-status-line|requestStatusText\(\)|sourceName\(\)/u);
  // 断言作用: 结果面板由 shouldShowSearchPanel 控制，error 和没有可见内容的 loading 不渲染空壳。
  assert.match(searchViewSource, /<section v-if="shouldShowSearchPanel" class="search-panel"/u);
  // 断言作用: 结果区必须保持页面层无面板布局，少量结果不能重新制造整页白色卡片和专属内边距。
  assert.doesNotMatch(searchViewSource, /class="search-panel theme-surface"|\.search-panel\s*\{[\s\S]*?padding:/u);
  assert.match(searchViewSource, /shouldShowSearchPanel\(\)[\s\S]*PAGE_REQUEST_VIEW_STATUS\.ready[\s\S]*PAGE_REQUEST_VIEW_STATUS\.empty[\s\S]*PAGE_REQUEST_VIEW_STATUS\.loading[\s\S]*hasVisibleContent/u);
});

// 测试目的: 四个列表型页面必须共用 PageBucket 状态选择器和统一反馈组件，不恢复页面 loading/error 副本。
test('首页目录和搜索页只消费统一页面请求状态', () => {
  // 类型: Array<string>；作用: 固定仍由页面直接组合多桶或搜索意图的页面源码路径。
  const directStatePageSourcePaths = [
    '../src/views/HomeView.vue',
    '../src/views/SearchResultView.vue'
  ];

  // 循环类型: Array.prototype.forEach；作用: 验证首页和搜索页直接读取 selector 与 Store 事务且不复制状态。
  directStatePageSourcePaths.forEach((pageSourcePath) => {
    // 类型: string；作用: 读取当前直接协调页面源码，验证统一 selector、反馈组件和 Store 事务入口。
    const pageSource = readProjectModuleSource(pageSourcePath);
    assert.match(pageSource, /PageRequestStatePanel/u);
    assert.match(pageSource, /createPageRequestViewState/u);
    assert.match(pageSource, /getPageRequestTransaction/u);
    assert.doesNotMatch(pageSource, /\bloadError\b|_searchRequestGeneration|this\.loading|loading:\s*(true|false)/u);
  });

  // 类型: Array<string>；作用: 固定只保留模板与配置并委托目录控制器的两个目录页面。
  const catalogPageSourcePaths = [
    '../src/views/MovieView.vue',
    '../src/views/TVView.vue'
  ];
  // 类型: string；作用: 读取电影和电视剧唯一共用控制器，验证单桶请求状态只实现一次。
  const catalogControllerSource = readProjectModuleSource('../src/controllers/catalogPageController.js');

  // 循环类型: Array.prototype.forEach；作用: 验证两个目录页面只接入反馈组件和共用控制器，不恢复页面请求副本。
  catalogPageSourcePaths.forEach((pageSourcePath) => {
    // 类型: string；作用: 读取当前目录页面源码，锁定页面配置壳职责和禁止依赖。
    const pageSource = readProjectModuleSource(pageSourcePath);
    assert.match(pageSource, /PageRequestStatePanel/u);
    assert.match(pageSource, /createCatalogPageController\(\{/u);
    assert.doesNotMatch(pageSource, /createPageRequestViewState|getPageRequestTransaction|\bloadError\b|this\.loading|loading:\s*(true|false)/u);
  });
  // 断言作用: 目录控制器必须集中读取 PageBucket 事务并生成统一状态，电影和电视剧共同缺陷只修复一处。
  assert.match(catalogControllerSource, /getPageRequestTransaction/u);
  assert.match(catalogControllerSource, /createPageRequestViewState\(\{[\s\S]*?visibleItemCount:\s*this\.catalogItems\.length/u);
  // 断言作用: 控制器不得通过 sourceId、域名或站点选择器解释 Provider 业务。
  assert.doesNotMatch(catalogControllerSource, /system-source-1|system-source-4|source\.com\.|source\.net\./u);

  // 类型: string；作用: 读取统一反馈组件，验证所有列表页面共用单层错误说明和同区重试布局。
  const requestStatePanelSource = readProjectModuleSource('../src/components/common/PageRequestStatePanel.vue');
  // 断言作用: 错误图标、文案和按钮必须位于同一反馈网格，不能恢复根面板内嵌 Alert 加独立操作行。
  assert.match(requestStatePanelSource, /class="page-request-state__feedback"[\s\S]*class="page-request-state__copy"[\s\S]*class="page-request-state__retry"/u);
  assert.match(requestStatePanelSource, /grid-template-columns: auto minmax\(0, 1fr\) auto;/u);
  assert.doesNotMatch(requestStatePanelSource, /<el-alert|page-request-state__actions|min-height:\s*120px/u);
  // 断言作用: 手机只把按钮下移到文案列并保持自然宽度，不把命令拉伸成整行卡片。
  assert.match(requestStatePanelSource, /@media \(max-width: 640px\)[\s\S]*\.page-request-state__retry[\s\S]*grid-column: 2;[\s\S]*justify-self: start;/u);

  // 类型: string；作用: 读取统一分页组件，锁定请求 loading 驱动的三入口禁用边界。
  const catalogPaginationSource = readProjectModuleSource('../src/components/catalog/CatalogPagination.vue');
  assert.match(catalogPaginationSource, /disabled:\s*\{[\s\S]*type:\s*Boolean/u);
  assert.match(catalogPaginationSource, /:disabled="disabled \|\| !canGoPrevPage"/u);
  assert.match(catalogPaginationSource, /:disabled="disabled \|\| !canGoNextPage"/u);
  assert.match(catalogPaginationSource, /:disabled="disabled"/u);
});

// 测试目的: 首页两个热门区域必须共享六列标题栏，把分页对齐卡片区右边界，同时保留“更多”的完整区块右边界。
test('首页热门电影与电视剧使用独立 PageBucket 远程分页', () => {
  // 类型: string；作用: 读取共享标题栏分页组件，锁定标准 pagination/loading 输入和纯事件输出边界。
  const paginationSource = readProjectModuleSource(
    '../src/components/home/HomeSectionPagination.vue'
  );
  assert.match(paginationSource, /name: 'HomeSectionPagination'/u);
  assert.match(paginationSource, /pagination:\s*\{[\s\S]*?type: Object/u);
  assert.match(paginationSource, /loading:\s*\{[\s\S]*?type: Boolean/u);
  assert.match(paginationSource, /this\.\$emit\('change-page', normalizedTargetPage\)/u);
  // 断言作用: 注释可以说明上游来源，但真实 import 和调用不得越过纯展示事件边界。
  assert.doesNotMatch(
    paginationSource,
    /from ['"][^'"]*(store|service|runtime)|requestSourceData\s*\(|\bfetch\s*\(/u
  );

  // 类型: string；作用: 读取电影区块，验证完整当前页展示和 hotMovies 稳定事件身份。
  const hotMovieSectionSource = readProjectModuleSource(
    '../src/components/home/HotMovieSection.vue'
  );
  assert.match(hotMovieSectionSource, /import HomeSectionPagination from '\.\/HomeSectionPagination\.vue';/u);
  assert.match(hotMovieSectionSource, /HOT_MOVIE_MODULE_KEY = 'hotMovies'/u);
  assert.match(hotMovieSectionSource, /moduleKey: HOT_MOVIE_MODULE_KEY/u);
  assert.doesNotMatch(hotMovieSectionSource, /\.slice\(0,\s*8\)/u);
  // 断言作用: 标题栏、卡片和排行榜必须是同一 Grid 的直接子节点，标题栏才能复用完整六列分别定位两个入口。
  assert.match(
    hotMovieSectionSource,
    /<div class="section-body">[\s\S]*?<div class="section-head">[\s\S]*?<div v-if="hasMovies" class="section-grid">[\s\S]*?<aside class="section-aside">/u
  );
  assert.match(hotMovieSectionSource, /<HomeSectionPagination[\s\S]*?class="section-pagination"/u);
  assert.doesNotMatch(hotMovieSectionSource, /section-head-actions/u);
  assert.match(hotMovieSectionSource, /\.section-head\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?grid-row:\s*1;[\s\S]*?grid-template-columns:\s*repeat\(var\(--page-layout-columns\),\s*minmax\(0,\s*1fr\)\);/u);
  // 断言作用: 分页必须结束于第 4 列，“更多”必须结束于第 6 列；两者不能恢复成共同操作组。
  assert.match(hotMovieSectionSource, /\.section-pagination\s*\{[\s\S]*?grid-column:\s*3 \/ span 2;[\s\S]*?justify-self:\s*end;/u);
  assert.match(hotMovieSectionSource, /\.section-more-link\s*\{[\s\S]*?grid-column:\s*5 \/ span 2;[\s\S]*?justify-self:\s*end;/u);
  assert.match(hotMovieSectionSource, /\.section-aside\s*\{[\s\S]*?grid-column:\s*5 \/ span 2;[\s\S]*?grid-row:\s*2;/u);

  // 类型: string；作用: 读取电视剧区块，验证完整当前页展示和 hotTv 稳定事件身份。
  const hotTVSectionSource = readProjectModuleSource(
    '../src/components/home/HotTVSection.vue'
  );
  assert.match(hotTVSectionSource, /import HomeSectionPagination from '\.\/HomeSectionPagination\.vue';/u);
  assert.match(hotTVSectionSource, /HOT_TV_MODULE_KEY = 'hotTv'/u);
  assert.match(hotTVSectionSource, /moduleKey: HOT_TV_MODULE_KEY/u);
  assert.doesNotMatch(hotTVSectionSource, /\.slice\(0,\s*8\)/u);
  // 断言作用: 电视剧区块必须复用电影区块的结构列线，不能形成第二套入口定位策略。
  assert.match(
    hotTVSectionSource,
    /<div class="section-body">[\s\S]*?<div class="section-head">[\s\S]*?<div v-if="hasTVList" class="section-grid">[\s\S]*?<aside class="section-aside">/u
  );
  assert.match(hotTVSectionSource, /<HomeSectionPagination[\s\S]*?class="section-pagination"/u);
  assert.doesNotMatch(hotTVSectionSource, /section-head-actions/u);
  assert.match(hotTVSectionSource, /\.section-head\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?grid-row:\s*1;[\s\S]*?grid-template-columns:\s*repeat\(var\(--page-layout-columns\),\s*minmax\(0,\s*1fr\)\);/u);
  // 断言作用: 电视剧分页和“更多”分别锁定第 4、6 列右边界，保持与电影区完全一致。
  assert.match(hotTVSectionSource, /\.section-pagination\s*\{[\s\S]*?grid-column:\s*3 \/ span 2;[\s\S]*?justify-self:\s*end;/u);
  assert.match(hotTVSectionSource, /\.section-more-link\s*\{[\s\S]*?grid-column:\s*5 \/ span 2;[\s\S]*?justify-self:\s*end;/u);
  assert.match(hotTVSectionSource, /\.section-aside\s*\{[\s\S]*?grid-column:\s*5 \/ span 2;[\s\S]*?grid-row:\s*2;/u);

  // 类型: string；作用: 读取页面编排，验证两个区块都从 selector 获取分页和事务并提交统一远程请求。
  const homeViewSource = readProjectModuleSource('../src/views/HomeView.vue');
  assert.match(homeViewSource, /getPagePagination/u);
  assert.match(homeViewSource, /getPageRequestTransaction/u);
  assert.match(homeViewSource, /HOME_HOT_MODULE_KEYS = Object\.freeze\(\['hotMovies', 'hotTv'\]\)/u);
  assert.match(homeViewSource, /async changeHomeHotPage\(command\)/u);
  assert.match(homeViewSource, /await requestSourceData\(\{[\s\S]*?moduleKey: command\.moduleKey,[\s\S]*?page: targetPage/u);
  assert.doesNotMatch(homeViewSource, /moviePaging:\s*(true|false)|tvPaging:\s*(true|false)/u);
});

// 测试目的: 全站统一 VideoCard 必须让长标题获得类型 Chip 之外的剩余宽度，并且只在两行后截断。
test('VideoCard 使用双行自适应标题和右侧自然宽度类型 Chip', () => {
  // 类型: string；作用: 读取统一卡片完整源码，同时验证模板结构和 scoped CSS 不变量。
  const videoCardSource = readProjectModuleSource('../src/components/common/VideoCard.vue');
  // 类型: RegExpMatchArray|null；作用: 截取唯一标题行模板，确认标题和类型之间没有继续占宽的 spacer 节点。
  const titleRowTemplate = videoCardSource.match(
    /<div class="video-card__info-row video-card__title-row">([\s\S]*?)<\/div>/u
  );

  // 断言作用: 标题行必须存在且只保留标题与类型两个真实子节点，避免旧弹性占位继续压缩标题。
  assert.ok(titleRowTemplate);
  assert.match(titleRowTemplate[1], /video-card__title/u);
  assert.match(titleRowTemplate[1], /video-card__field--content-type/u);
  assert.doesNotMatch(titleRowTemplate[1], /video-card__row-spacer/u);
  // 断言作用: 两列 Grid 必须由标题剩余列和 Chip 自然宽度组成，固定百分比字段不能回归。
  assert.match(
    videoCardSource,
    /\.video-card__info-row\.video-card__title-row\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+max-content;/u
  );
  assert.doesNotMatch(videoCardSource, /--video-card-title-basis|--video-card-content-type-basis/u);
  // 断言作用: 标题必须允许自然换行并在第二行关闭溢出，不能恢复 nowrap 单行省略。
  assert.match(
    videoCardSource,
    /\.video-card__title\s*\{[\s\S]*?font-size:\s*clamp\(0\.86rem,[\s\S]*?-webkit-line-clamp:\s*2;[\s\S]*?white-space:\s*normal;/u
  );
  // 断言作用: 类型字段必须具有 Chip 视觉并按内容停在右列，不能重新占据固定比例。
  assert.match(
    videoCardSource,
    /\.video-card__field--content-type\s*\{[\s\S]*?width:\s*max-content;[\s\S]*?background:\s*rgba\([\s\S]*?justify-self:\s*end;/u
  );
});

// 测试目的: 基础元信息只能显示 Provider 真实提供的年份、地区和 genre，不能重复使用标题行的内容类型。
test('VideoCard 基础元信息缺失时隐藏空行且不重复内容类型', () => {
  // 类型: string；作用: 读取统一卡片源码，验证字段派生、模板空态和等高样式属于同一公共组件。
  const videoCardSource = readProjectModuleSource('../src/components/common/VideoCard.vue');
  // 类型: RegExpMatchArray|null；作用: 隔离 displayMetaItems 函数，避免其它类型 Chip 逻辑影响元信息断言。
  const metaItemsFunction = videoCardSource.match(
    /displayMetaItems\(\)\s*\{([\s\S]*?)\n\s*\},\n\n\s*\/\*\*/u
  );

  // 断言作用: 元信息派生函数必须存在，并且只收集 year、area 和真实 genres[0]。
  assert.ok(metaItemsFunction);
  assert.match(metaItemsFunction[1], /const rawItems = \[video\.year, video\.area, genre\];/u);
  assert.doesNotMatch(metaItemsFunction[1], /fallbackTypeText|CONTENT_TYPE_TEXT_MAP|video\.type/u);
  // 断言作用: 空态必须由真实元信息 Boolean 同时控制视觉与可访问性，score 和类型 Chip 不能让空行重新出现。
  assert.match(videoCardSource, /:class="\{ 'is-empty': !hasMetaRow \}"/u);
  assert.match(videoCardSource, /:aria-hidden="hasMetaRow \? 'false' : 'true'"/u);
  assert.match(videoCardSource, /hasMetaRow\(\)[\s\S]*?return Boolean\(this\.displayMetaText\);/u);
  assert.match(videoCardSource, /\.video-card__meta-row\.is-empty\s*\{[\s\S]*?visibility:\s*hidden;/u);
});

// 测试目的: 所有视频卡片必须传递结构化播放时长，并只在 VideoCard 使用共享适配器生成最终短时长文本。
test('VideoCard 使用唯一媒体时长适配器显示播放进度和总时长', () => {
  // 类型: string；作用: 读取纯展示卡片源码，确认唯一格式化入口和独立总时长来源。
  const videoCardSource = readProjectModuleSource('../src/components/common/VideoCard.vue');
  // 类型: string；作用: 读取用户状态容器源码，确认它只选择记录并透传结构化秒数。
  const userVideoCardSource = readProjectModuleSource('../src/components/common/UserVideoCard.vue');
  // 类型: string；作用: 读取个人中心源码，确认历史和收藏不再提前构造时长文本。
  const profileViewSource = readProjectModuleSource('../src/views/ProfileView.vue');

  // 断言作用: VideoCard 必须导入共享适配器，并分别格式化已播放值和独立总时长值。
  assert.match(videoCardSource, /import \{ formatCompactMediaDuration \} from '\.\.\/\.\.\/utils\/mediaDuration\.js';/u);
  assert.match(videoCardSource, /formatCompactMediaDuration\(this\.normalizedPlayback\.playedSeconds\)/u);
  assert.match(videoCardSource, /formatCompactMediaDuration\(this\.normalizedPlayback\.durationValue\)/u);
  // 断言作用: 播放状态必须保持 playedSeconds/durationSeconds 分离，总时长不能从进度字段推导。
  assert.match(videoCardSource, /playedSeconds:\s*playback\.playedSeconds\s*\?\?\s*0/u);
  assert.match(videoCardSource, /durationValue:\s*playback\.durationSeconds\s*\?\?\s*this\.totalDurationValue/u);
  // 断言作用: 容器和页面只能传结构化秒数字段，旧文本字段与三份本地时钟函数不得回归。
  [videoCardSource, userVideoCardSource, profileViewSource].forEach((moduleSource) => {
    assert.doesNotMatch(moduleSource, /playedTimeText|totalTimeText|formatSecondsToClock|formatPlaybackTime/u);
  });
  assert.match(userVideoCardSource, /playedSeconds:\s*Number\(safeRecord\.playedSeconds\)/u);
  assert.match(userVideoCardSource, /durationSeconds:\s*Number\(safeRecord\.durationSeconds\)/u);
  // 断言作用: 历史与收藏均从真实播放记录读取两个独立字段，内容片长只作为总时长兜底。
  assert.match(profileViewSource, /playedSeconds:\s*historyItem\.playedSeconds/u);
  assert.match(profileViewSource, /durationSeconds:\s*historyItem\.durationSeconds/u);
  assert.match(profileViewSource, /playedSeconds:\s*latestHistoryRecord\?\.playedSeconds\s*\?\?\s*0/u);
  assert.match(profileViewSource, /durationSeconds:\s*latestHistoryRecord\?\.durationSeconds\s*\?\?\s*null/u);
});

// 测试目的: 历史记录和播放器交互必须共用唯一可刷新路由字段映射，页面不能恢复本地影子选中状态。
test('播放器导航按当前历史和路由上下文精确恢复分集线路', () => {
  // 类型: Readonly<object>|null。
  // 作用: 模拟常驻 PlayerView 采用严格播放 URL，冻结普通路由切换期间必须保持的媒体请求身份。
  const activeRouteContext = createPlayerRouteContext({
    name: 'player',
    fullPath: '/player/system-source-2/system-source-2-tv-101?episodeId=system-source-2-tv-101-ep-2&episodeIndex=2&playbackSourceId=system-source-2-tv-101-line-main&autoplay=1',
    params: {
      sourceId: 'system-source-2',
      videoId: 'system-source-2-tv-101'
    },
    query: {
      episodeId: 'system-source-2-tv-101-ep-2',
      episodeIndex: '2',
      playbackSourceId: 'system-source-2-tv-101-line-main',
      autoplay: '1'
    }
  });

  // 断言作用: 活动上下文完整保存媒体身份且不可修改，普通 movie 路由不能产生替代上下文。
  assert.deepEqual(activeRouteContext, {
    routeName: 'player',
    fullPath: '/player/system-source-2/system-source-2-tv-101?episodeId=system-source-2-tv-101-ep-2&episodeIndex=2&playbackSourceId=system-source-2-tv-101-line-main&autoplay=1',
    sourceId: 'system-source-2',
    contentId: 'system-source-2-tv-101',
    episodeId: 'system-source-2-tv-101-ep-2',
    episodeIndex: 2,
    playbackSourceId: 'system-source-2-tv-101-line-main',
    autoplay: true,
    query: {
      episodeId: 'system-source-2-tv-101-ep-2',
      episodeIndex: '2',
      playbackSourceId: 'system-source-2-tv-101-line-main',
      autoplay: '1'
    }
  });
  assert.equal(Object.isFrozen(activeRouteContext), true);
  assert.equal(Object.isFrozen(activeRouteContext.query), true);
  assert.equal(createPlayerRouteContext({
    name: 'movie',
    fullPath: '/movie?page=2',
    params: {},
    query: { page: '2' }
  }), null);

  // 类型: object。
  // 作用: 模拟当前播放器已有自动播放和页面来源标记，验证局部上下文更新会保留无关 query。
  const baseQuery = {
    autoplay: '1',
    from: 'detail',
    episodeId: 'system-source-2-tv-101-ep-2',
    episodeIndex: '2',
    playbackSourceId: 'system-source-2-tv-101-line-main'
  };

  // 类型: object|null。
  // 作用: 使用同一内容的新分集和线路创建替换目标，模拟 PlayerView 点击第三集。
  const playerTarget = createPlayerNavigationTarget({
    sourceId: 'system-source-2',
    contentId: 'system-source-2-tv-101',
    episodeId: 'system-source-2-tv-101-ep-3',
    episodeIndex: 3,
    playbackSourceId: 'system-source-2-tv-101-line-backup'
  }, baseQuery);

  // 断言作用: 内容身份进入命名路由 params，分集线路采用新值，自动播放和无关来源 query 原样保留。
  assert.deepEqual(playerTarget, {
    name: 'player',
    params: {
      sourceId: 'system-source-2',
      videoId: 'system-source-2-tv-101'
    },
    query: {
      autoplay: '1',
      from: 'detail',
      episodeId: 'system-source-2-tv-101-ep-3',
      episodeIndex: '3',
      playbackSourceId: 'system-source-2-tv-101-line-backup'
    }
  });

  // 断言作用: 纯服务不能改写调用方 baseQuery，避免 Router 当前状态被构造阶段提前污染。
  assert.deepEqual(baseQuery, {
    autoplay: '1',
    from: 'detail',
    episodeId: 'system-source-2-tv-101-ep-2',
    episodeIndex: '2',
    playbackSourceId: 'system-source-2-tv-101-line-main'
  });

  // 类型: object|null。
  // 作用: 模拟首页轮播 ContentItem，验证“立即播放”不依赖页面手工选择分集和线路。
  const contentTarget = createContentPlaybackNavigationTarget({
    id: 'system-source-2-tv-101',
    sourceId: 'system-source-2',
    episodes: [
      { id: 'system-source-2-tv-101-preview', episodeNumber: 0, playable: false },
      { id: 'system-source-2-tv-101-ep-1', episodeNumber: 1, playable: true }
    ],
    playback: {
      defaultSourceId: 'system-source-2-tv-101-line-main',
      sources: [
        {
          id: 'system-source-2-tv-101-line-main',
          episodeId: 'system-source-2-tv-101-ep-1',
          available: true
        }
      ]
    }
  }, { autoplay: true });

  // 断言作用: 内容入口必须选择首个可播放分集、Provider 默认线路和标准 autoplay=1。
  assert.deepEqual(contentTarget, {
    name: 'player',
    params: {
      sourceId: 'system-source-2',
      videoId: 'system-source-2-tv-101'
    },
    query: {
      episodeId: 'system-source-2-tv-101-ep-1',
      episodeIndex: '1',
      playbackSourceId: 'system-source-2-tv-101-line-main',
      autoplay: '1'
    }
  });

  // 断言作用: 关键内容身份缺失时必须失败关闭，不能让首页或详情回退到页面默认内容。
  assert.equal(createContentPlaybackNavigationTarget({ sourceId: 'system-source-2' }, { autoplay: true }), null);

  // 类型: object|null。
  // 作用: 模拟同一电视剧第二集历史，证明导航只采用当前记录而不是内容级最近第三集。
  const historyTarget = createHistoryPlaybackNavigationTarget({
    historyKey: 'system-source-2::system-source-2-tv-101::system-source-2-tv-101-ep-2',
    sourceId: 'system-source-2',
    contentId: 'system-source-2-tv-101',
    episodeId: 'system-source-2-tv-101-ep-2',
    episodeIndex: 2,
    playbackSourceId: 'system-source-2-tv-101-line-main'
  });

  // 断言作用: 历史目标必须携带当前记录分集、线路和标准 autoplay=1，刷新后可恢复同一播放上下文。
  assert.deepEqual(historyTarget, {
    name: 'player',
    params: {
      sourceId: 'system-source-2',
      videoId: 'system-source-2-tv-101'
    },
    query: {
      episodeId: 'system-source-2-tv-101-ep-2',
      episodeIndex: '2',
      playbackSourceId: 'system-source-2-tv-101-line-main',
      autoplay: '1'
    }
  });

  // 断言作用: 缺少关键 sourceId 的历史不能回退默认源或默认内容，必须拒绝构造导航。
  assert.equal(createHistoryPlaybackNavigationTarget({
    contentId: 'system-source-2-tv-101',
    episodeId: 'system-source-2-tv-101-ep-2'
  }), null);

  // 类型: string。
  // 作用: 读取播放器源码，验证选中分集和线路只由计算属性与 Router replace 驱动。
  const playerViewSource = readProjectModuleSource('../src/views/PlayerView.vue');

  // 断言作用: 页面不得恢复两个本地影子状态或对计算属性赋值，切换必须经过统一导航服务。
  assert.doesNotMatch(playerViewSource, /selectedEpisodeId:\s*['"]/);
  assert.doesNotMatch(playerViewSource, /activePlaybackSourceId:\s*['"]/);
  assert.doesNotMatch(playerViewSource, /this\.selectedEpisodeId\s*=/);
  assert.doesNotMatch(playerViewSource, /this\.activePlaybackSourceId\s*=/);
  assert.match(playerViewSource, /createPlayerNavigationTarget\s*\(/);
  assert.match(playerViewSource, /this\.\$router\.replace\(target\)/);

  // 类型: string。
  // 作用: 读取首页轮播源码，验证“立即播放”使用内容导航 service 而不再手工拼 player 路由。
  const homeCarouselSource = readProjectModuleSource('../src/components/home/HomeCarousel.vue');
  assert.match(homeCarouselSource, /createContentPlaybackNavigationTarget\(banner, \{ autoplay: true \}\)/);
  assert.doesNotMatch(homeCarouselSource, /name:\s*['"]player['"]/);

  // 类型: string。
  // 作用: 读取详情页源码，验证选中分集通过内容导航 service 进入播放器。
  const detailViewSource = readProjectModuleSource('../src/views/DetailView.vue');
  assert.match(detailViewSource, /createContentPlaybackNavigationTarget\(\{/);
  assert.doesNotMatch(detailViewSource, /name:\s*['"]player['"]/);

  // 类型: string。
  // 作用: 读取个人中心源码，验证当前历史记录生成独立导航与播放状态 props。
  const profileViewSource = readProjectModuleSource('../src/views/ProfileView.vue');

  // 断言作用: 历史卡片必须显式开启记录级播放优先并传入独立 navigationTarget。
  assert.match(profileViewSource, /prefer-provided-playback/);
  assert.match(profileViewSource, /:navigation-target="item\.navigationTarget"/);
  assert.match(profileViewSource, /createHistoryPlaybackNavigationTarget\(historyItem\)/);

  // 类型: string。
  // 作用: 读取通用卡片源码，验证路由目标是独立 prop 而不是 ContentItem 字段探测。
  const videoCardSource = readProjectModuleSource('../src/components/common/VideoCard.vue');

  // 断言作用: VideoCard 只读取 navigationTarget prop，并继续保留普通详情卡片默认路由。
  assert.match(videoCardSource, /navigationTarget:\s*\{/);
  assert.match(videoCardSource, /name:\s*'detail'/);
  assert.doesNotMatch(videoCardSource, /video\.navigationTarget|normalizedVideo\.navigationTarget/);
});

// 测试目的: 测试专用收藏、历史和电视剧分集引用必须全部能通过 Mock Provider 定位。
test('用户内容引用夹具可以通过 Mock Provider 补全内容和电视剧分集', async () => {
  // 类型: object。
  // 作用: 创建独立 Runtime，避免用户引用解析测试修改应用共享 Provider 生命周期。
  const runtime = createSourceRuntime(createMockSourceRuntimeOptions());

  // 类型: Array<object>。
  // 作用: 复制显式三源引用，证明产品空用户种子不会使 Provider 补全覆盖退化为空循环。
  const userContentReferences = [...USER_CONTENT_REFERENCE_FIXTURES];

  // 类型: Array<string>。
  // 作用: 收集当前用例启动过的真实 sourceId，finally 中逐一释放 Host entry。
  const sourceIds = [...new Set(userContentReferences.map(record => record.sourceId))];

  try {
    // 循环类型: for...of。
    // 初始值: 第一条收藏引用。
    // 终止条件: 全部收藏和历史引用都完成详情与可选分集断言。
    // 循环作用: 证明测试夹具没有引用 Provider 数据集中不存在的 contentId 或 episodeId。
    for (const reference of userContentReferences) {
      // 类型: object。
      // 作用: 按当前引用真实 sourceId/contentId 请求详情，Provider 返回标准单内容响应。
      const response = await runtime.fetchData(createDataRequest(
        reference.sourceId,
        'detail',
        { contentId: reference.contentId }
      ));

      // 断言作用: 每条用户引用都能定位同源同 id 的真实 ContentItem。
      assert.equal(response.sourceId, reference.sourceId);
      assert.equal(response.item?.sourceId, reference.sourceId);
      assert.equal(response.item?.id, reference.contentId);

      // 条件分支: 当前历史记录包含电视剧 episodeId 时进入。
      // 执行内容: 证明分集身份同样存在于真实 Provider 的 ContentItem.episodes 中。
      if (reference.episodeId) {
        assert.equal(
          response.item.episodes.some(episode => episode.id === reference.episodeId),
          true
        );
      }
    }
  } finally {
    await disposeRuntimeSources(runtime, sourceIds);
  }
});

// 测试目的: 同一内容的普通页面投影不能把播放增强实体降级为空分集或空线路。
test('内容实体按页面投影优先级保留播放增强字段', () => {
  resetSiteContentStore();

  // 类型: object；作用: 建立严格播放响应的唯一请求身份，先向实体池提交最高权威播放投影。
  const playerTransaction = {
    requestId: 'entity-projection-player',
    requestedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    resolvedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    pageKey: 'player',
    moduleKey: ''
  };
  // 类型: Array<object>；作用: 播放投影提供与当前媒体身份绑定的分集，后续普通页面不得清空。
  const playerEpisodes = [{
    id: 'projection-episode-1',
    episodeNumber: 1,
    title: '正片',
    label: '第1集',
    playable: true
  }];
  // 类型: object；作用: 播放投影提供真实直连线路，常驻 PlayerView 依赖该字段保持子播放器。
  const playerPlayback = {
    defaultSourceId: 'projection-line-1',
    sources: [{
      id: 'projection-line-1',
      name: '线路 1',
      type: 'hls',
      url: 'https://media.example/projection.m3u8',
      quality: 'HD',
      deliveryMode: 'direct',
      available: true,
      unavailableReason: '',
      episodeId: 'projection-episode-1'
    }]
  };
  beginSourceDataRequest(playerTransaction);
  commitSourceDataResponse({
    sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    pageKey: 'player',
    moduleKey: '',
    request: { sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA, pageKey: 'player' },
    pagination: null,
    items: [],
    item: {
      id: 'entity-projection-item',
      sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
      type: 'movie',
      title: '播放增强标题',
      detail: { fullDescription: '播放响应详情' },
      episodes: playerEpisodes,
      playback: playerPlayback
    },
    meta: { fetchedAt: '2026-07-23T00:00:00.000Z' }
  }, playerTransaction);

  // 类型: object；作用: 模拟离开播放页后电影列表刷新同一内容的轻量投影。
  const movieTransaction = {
    requestId: 'entity-projection-movie',
    requestedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    resolvedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    pageKey: 'movie',
    moduleKey: ''
  };
  beginSourceDataRequest(movieTransaction);
  commitSourceDataResponse({
    sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    pageKey: 'movie',
    moduleKey: '',
    request: { sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA, pageKey: 'movie' },
    pagination: {},
    items: [{
      id: 'entity-projection-item',
      sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
      type: 'movie',
      title: '列表最新标题',
      detail: null,
      episodes: [],
      playback: null
    }],
    item: null,
    meta: { fetchedAt: '2026-07-23T00:01:00.000Z' }
  }, movieTransaction);

  // 类型: object；作用: 读取列表采用后的唯一实体，验证通用标题更新而播放增强字段不降级。
  const entityAfterList = siteContentStore.entities.contentItems['system-source-1::entity-projection-item'];
  assert.equal(entityAfterList.title, '列表最新标题');
  assert.deepEqual(entityAfterList.episodes, playerEpisodes);
  assert.deepEqual(entityAfterList.playback, playerPlayback);

  // 类型: object；作用: 模拟详情页随后刷新同一内容，详情字段应更新但不能覆盖更权威播放分集和线路。
  const detailTransaction = {
    requestId: 'entity-projection-detail',
    requestedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    resolvedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    pageKey: 'detail',
    moduleKey: ''
  };
  beginSourceDataRequest(detailTransaction);
  commitSourceDataResponse({
    sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    pageKey: 'detail',
    moduleKey: '',
    request: { sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA, pageKey: 'detail' },
    pagination: null,
    items: [],
    item: {
      id: 'entity-projection-item',
      sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
      type: 'movie',
      title: '详情最新标题',
      detail: { fullDescription: '详情响应权威说明' },
      episodes: [],
      playback: null
    },
    meta: { fetchedAt: '2026-07-23T00:02:00.000Z' }
  }, detailTransaction);

  // 类型: object；作用: 读取详情采用后的同一实体，核对字段级权威顺序而非整对象覆盖。
  const entityAfterDetail = siteContentStore.entities.contentItems['system-source-1::entity-projection-item'];
  assert.equal(entityAfterDetail.title, '详情最新标题');
  assert.deepEqual(entityAfterDetail.detail, { fullDescription: '详情响应权威说明' });
  assert.deepEqual(entityAfterDetail.episodes, playerEpisodes);
  assert.deepEqual(entityAfterDetail.playback, playerPlayback);
  assert.deepEqual(
    siteContentStore.entities.contentItemProjections['system-source-1::entity-projection-item'],
    { detail: 'detail', episodes: 'player', playback: 'player' }
  );
});

// 测试目的: 内容和筛选 store 必须在所有可失败准备完成后才采用 activeSourceId。
test('store 提交准备失败时保持内容筛选和活动身份原状态', () => {
  // 副作用: 为两个 store 建立空状态，后续快照能够精确识别任何半提交字段。
  resetSiteContentStore();
  resetSiteFilterStore();

  // 类型: object。
  // 作用: 保存内容 store 失败调用前完整状态。
  const contentStateBeforeFailure = createSerializableSnapshot(siteContentStore);

  // 断言作用: 未知首页 moduleKey 在提交准备阶段失败，不能先把 activeSourceId 改为 系统数据源2。
  assert.throws(() => commitSourceDataResponse({
    sourceId: RUNTIME_TEST_SOURCE_IDS.protocolB,
    pageKey: 'home',
    moduleKey: 'missing-home-module',
    request: {},
    pagination: {},
    items: [],
    item: null,
    meta: {}
  }), /未知首页数据桶/);
  assert.deepEqual(createSerializableSnapshot(siteContentStore), contentStateBeforeFailure);

  // 类型: object。
  // 作用: 保存筛选 store 失败调用前完整状态。
  const filterStateBeforeFailure = createSerializableSnapshot(siteFilterStore);

  // 类型: object。
  // 作用: 构造 request getter 失败的合法页面响应，验证字段准备发生在任何 store 写入之前。
  const failingFilterResponse = {
    sourceId: RUNTIME_TEST_SOURCE_IDS.protocolB,
    pageKey: 'movie',

    /**
     * 模拟读取筛选请求字段失败。
     * 纯函数: 不修改外部状态；每次访问都抛出固定错误，用于验证提交准备顺序。
     * 失败路径: 访问 request 时始终抛出 Error，store 必须保持调用前状态。
     *
     * @returns {never} 当前测试 getter 不返回请求对象。
     * @throws {Error} 每次读取都抛出筛选请求读取失败。
     */
    get request() {
      throw new Error('筛选请求读取失败');
    },
    groups: [],
    meta: {}
  };

  // 断言作用: request 读取失败后筛选活动身份和页面桶都保持原状态。
  assert.throws(
    () => commitSourceFilterMetaResponse(failingFilterResponse),
    /筛选请求读取失败/
  );
  assert.deepEqual(createSerializableSnapshot(siteFilterStore), filterStateBeforeFailure);
});

// 测试目的: 页面桶请求事务必须隐藏跨源旧内容，并只允许最新 requestId 收敛成功或失败。
test('内容 store 用请求事务隔离跨源旧内容和过期失败', () => {
  resetSiteContentStore();
  // 类型: object；作用: 建立 A 源首次成功请求身份。
  const firstTransaction = {
    requestId: 'content-transaction-1',
    requestedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    resolvedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    pageKey: 'movie',
    moduleKey: ''
  };
  beginSourceDataRequest(firstTransaction);
  commitSourceDataResponse({
    sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    pageKey: 'movie',
    moduleKey: '',
    request: { sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA },
    pagination: {},
    items: [{ id: 'transaction-item', sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA, title: '旧源内容' }],
    item: null,
    meta: { fetchedAt: '2026-07-22T00:00:00.000Z' }
  }, firstTransaction);
  assert.equal(getBucketItems('movie').length, 1);

  // 类型: object；作用: 建立 B 源切换请求，loading 阶段必须隐藏 A 源旧引用。
  const secondTransaction = {
    requestId: 'content-transaction-2',
    requestedSourceId: '',
    resolvedSourceId: '',
    pageKey: 'movie',
    moduleKey: ''
  };
  // 类型: object；作用: 身份解析前先发布 loading 事务，来源未知时旧内容必须先标记 stale。
  const loading = beginSourceDataRequest(secondTransaction);
  assert.equal(loading.stale, true);
  assert.equal(loading.resolvedSourceId, '');
  assert.deepEqual(getBucketItems('movie'), []);

  // 类型: object；作用: 在同一 requestId 上补齐 Runtime 解析的 B 源身份，跨源旧内容继续保持 stale。
  const resolvedLoading = resolveSourceDataRequestTransaction(
    secondTransaction,
    RUNTIME_TEST_SOURCE_IDS.protocolB
  );
  assert.equal(resolvedLoading.requestId, secondTransaction.requestId);
  assert.equal(resolvedLoading.resolvedSourceId, RUNTIME_TEST_SOURCE_IDS.protocolB);
  assert.equal(resolvedLoading.stale, true);

  // 类型: object；作用: 读取 selector 隔离快照，证明页面可以观察 loading 但不能改写 Store 唯一事务。
  const loadingSnapshot = getPageRequestTransaction('movie');
  assert.deepEqual(loadingSnapshot, resolvedLoading);
  loadingSnapshot.status = 'error';
  assert.equal(siteContentStore.pages.movie.transaction.status, 'loading');

  // 类型: object；作用: 建立更晚的 A 源请求，旧 B 失败不得覆盖当前 loading 身份。
  const latestTransaction = { ...firstTransaction, requestId: 'content-transaction-3' };
  beginSourceDataRequest(latestTransaction);
  failSourceDataRequest(secondTransaction, new Error('过期失败'));
  assert.equal(siteContentStore.pages.movie.transaction.requestId, latestTransaction.requestId);
  assert.equal(siteContentStore.pages.movie.transaction.status, 'loading');

  // 类型: object；作用: 保存最新请求失败事务，核对稳定 code、error 阶段和 stale selector 边界。
  const failed = failSourceDataRequest(latestTransaction, Object.assign(new Error('当前失败'), { code: 'CURRENT_FAILURE' }));
  assert.equal(failed.status, 'error');
  assert.equal(failed.error.code, 'CURRENT_FAILURE');
  assert.equal(failed.stale, true);
  assert.deepEqual(getBucketItems('movie'), []);

  // 类型: object；作用: 读取失败快照并修改 error，证明嵌套错误对象同样不会泄漏可写引用。
  const failedSnapshot = getPageRequestTransaction('movie');
  failedSnapshot.error.code = 'MUTATED_OUTSIDE_STORE';
  assert.equal(siteContentStore.pages.movie.transaction.error.code, 'CURRENT_FAILURE');
});

// 测试目的: 页面状态选择器必须只从 PageBucket 事务和可见内容派生，不把失败解释为空结果。
test('页面请求状态选择器统一投影单桶与首页多桶状态', () => {
  // 类型: object；作用: 模拟单桶成功空结果，必须投影为业务 empty 而不是 error。
  const emptyState = createPageRequestViewState({
    requestEntries: [{
      key: 'movie',
      transaction: {
        status: 'success',
        requestedSourceId: '',
        resolvedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
        error: null,
        stale: false
      }
    }],
    visibleItemCount: 0
  });
  assert.equal(emptyState.status, PAGE_REQUEST_VIEW_STATUS.empty);
  assert.equal(emptyState.hasError, false);

  // 类型: object；作用: 模拟同页失败，必须保留当前请求源和安全错误且允许原位重试。
  const errorState = createPageRequestViewState({
    requestEntries: [{
      key: 'search',
      transaction: {
        status: 'error',
        requestedSourceId: '',
        resolvedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolB,
        error: { code: 'SEARCH_FAILED', message: '搜索请求失败' },
        stale: true
      }
    }],
    visibleItemCount: 0
  });
  assert.equal(errorState.status, PAGE_REQUEST_VIEW_STATUS.error);
  assert.equal(errorState.sourceId, RUNTIME_TEST_SOURCE_IDS.protocolB);
  assert.equal(errorState.errorMessage, '搜索请求失败');
  assert.equal(errorState.canRetry, true);

  // 类型: object；作用: 模拟首页一个模块失败、另一个仍 loading，主状态保持 loading 且暂不允许重复重试。
  const aggregateState = createPageRequestViewState({
    requestEntries: [
      {
        key: 'banners',
        transaction: {
          status: 'error',
          resolvedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
          error: { message: '轮播失败' }
        }
      },
      {
        key: 'hotMovies',
        transaction: {
          status: 'loading',
          resolvedSourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
          error: null
        }
      }
    ],
    visibleItemCount: 8
  });
  assert.equal(aggregateState.status, PAGE_REQUEST_VIEW_STATUS.loading);
  assert.equal(aggregateState.hasError, true);
  assert.equal(aggregateState.hasVisibleContent, true);
  assert.equal(aggregateState.canRetry, false);
});

// 测试目的: 收藏和历史的后台详情补全必须独立采用实体，不得让并发响应争抢 detail 页面唯一事务。
test('后台内容补全并发采用不同源实体且不修改页面桶', () => {
  resetSiteContentStore();
  // 类型: object；作用: 冻结补全前 detail 页面桶，后续证明实体写入没有页面展示副作用。
  const detailBucketBeforeAdoption = createSerializableSnapshot(siteContentStore.pages.detail);

  // 类型: object；作用: 模拟冷启动历史补全返回的 A 源详情内容。
  const historyItem = {
    id: 'background-history-item',
    sourceId: RUNTIME_TEST_SOURCE_IDS.protocolA,
    title: '后台历史内容'
  };
  // 类型: object；作用: 模拟同一批次收藏补全返回的 B 源详情内容。
  const favoriteItem = {
    id: 'background-favorite-item',
    sourceId: RUNTIME_TEST_SOURCE_IDS.protocolB,
    title: '后台收藏内容'
  };

  // 类型: object；作用: 保存历史补全独立采用结果，证明先返回实体不会依赖页面事务保持最新。
  const adoptedHistoryItem = commitSourceContentItem(historyItem, historyItem.sourceId);
  // 类型: object；作用: 保存收藏补全独立采用结果，证明后返回实体只写自己的 contentKey。
  const adoptedFavoriteItem = commitSourceContentItem(favoriteItem, favoriteItem.sourceId);

  // 断言作用: 两个实体都进入共享池，后发收藏不会把先发历史判定为过期页面响应。
  assert.equal(adoptedHistoryItem, historyItem);
  assert.equal(adoptedFavoriteItem, favoriteItem);
  assert.equal(
    siteContentStore.entities.contentItems['system-source-1::background-history-item']?.title,
    historyItem.title
  );
  assert.equal(
    siteContentStore.entities.contentItems['system-source-2::background-favorite-item']?.title,
    favoriteItem.title
  );
  // 断言作用: 后台采用没有页面意图，不改变 detail.currentKey、页面事务或最近页面响应来源。
  assert.deepEqual(createSerializableSnapshot(siteContentStore.pages.detail), detailBucketBeforeAdoption);
  assert.equal(siteContentStore.activeSourceId, '');

  // 类型: string；作用: 读取 resolver 源码，约束它使用后台入口并按 contentKey 去重。
  const resolverSource = readProjectModuleSource('../src/services/contentItemResolver.js');
  assert.match(resolverSource, /requestSourceContentItem\s*\(/);
  assert.doesNotMatch(resolverSource, /requestSourceData\s*\(/);
  assert.match(resolverSource, /new Map\s*\(/);
});
