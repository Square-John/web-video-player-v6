/*
  route-request-state.test.js 模块说明

  - 文件职责:
      验证目录筛选、搜索关键词和页码在 URL query 与请求状态之间的统一转换。
      同时验证目录控制器按页面契约生成电影十二条、电视剧十八条的标准请求，不启动 Vue、Router、Provider、Store、浏览器或网络请求。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:assert/strict: Node 内置严格断言库，验证 query 构造结果和输入隔离。
      node:test: Node 内置测试注册器，提供同步测试用例。
      routeRequestState: 自定义 URL 请求状态适配器，提供目录和搜索 query 解析/构造函数。
      catalogPageController: 自定义目录控制器工厂，生成按页面容量约束的标准请求。

  - 模块级常量:
      DEFAULT_FILTERS: object，目录请求默认筛选。
      TV_DEFAULT_FILTERS: object，包含 category 的电视剧目录默认筛选。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      无，测试通过 node:test 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言门面。
// 文件作用: 验证 query 解析、默认值、页码边界和输入引用隔离。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test 测试注册函数。
// 文件作用: 注册路由请求状态边界用例。
import test from 'node:test';

import {
  // 导入来源: ../src/router/routeRequestState.js。
  // 导入内容: createCatalogRouteQuery 目录 query 构造函数。
  // 文件作用: 验证目录筛选与页码能够成为刷新请求事实。
  createCatalogRouteQuery,
  // 导入来源: ../src/router/routeRequestState.js。
  // 导入内容: createCatalogRouteState 目录 query 解析函数。
  // 文件作用: 验证 URL 缺失字段能够恢复页面默认请求状态。
  createCatalogRouteState,
  // 导入来源: ../src/router/routeRequestState.js。
  // 导入内容: createSearchRouteQuery 搜索 query 构造函数。
  // 文件作用: 验证搜索关键词和页码可以通过 URL 重放。
  createSearchRouteQuery,
  // 导入来源: ../src/router/routeRequestState.js。
  // 导入内容: createSearchRouteState 搜索 query 解析函数。
  // 文件作用: 验证刷新后搜索页能够读取原关键词和页码。
  createSearchRouteState,
  // 导入来源: ../src/router/routeRequestState.js。
  // 导入内容: createRouteRequestGuard KeepAlive 请求身份守卫。
  // 文件作用: 验证失活缓存页不会响应全局路由变化。
  createRouteRequestGuard
} from '../src/router/routeRequestState.js';

// 导入来源: ../src/controllers/catalogPageController.js；导入内容: createCatalogPageController；文件作用: 验证页面键与标准请求容量绑定。
import { createCatalogPageController } from '../src/controllers/catalogPageController.js';

// 类型: Readonly<object>；作用: 作为目录 query 解析和构造的默认筛选边界。
const DEFAULT_FILTERS = Object.freeze({
  genre: 'all',
  area: 'all',
  year: 'all',
  sort: 'latest'
});

// 类型: Readonly<object>；作用: 冻结电视剧目录的 category 中性值和其余筛选默认值，验证刷新后分类不会丢失。
const TV_DEFAULT_FILTERS = Object.freeze({
  category: 'all',
  genre: 'all',
  area: 'all',
  year: 'all',
  status: 'all',
  sort: 'latest'
});

// 测试目的: 目录 query 必须完整恢复非默认筛选和页码，同时保留不属于目录请求的未知字段。
test('目录请求状态在 URL query 与筛选对象之间双向转换', () => {
  // 类型: object；作用: 模拟用户筛选电影类型、地区并翻到第三页的 URL。
  const query = {
    genre: 'action',
    area: '大陆',
    page: '3',
    unrelated: 'preserve-me'
  };
  // 类型: object；作用: 读取 URL 后得到 Provider 可消费的目录请求状态。
  const parsed = createCatalogRouteState(query, DEFAULT_FILTERS);

  // 断言作用: 缺失的 year/sort 必须恢复正式默认值，非默认字段和页码必须保持。
  assert.deepEqual(parsed, {
    page: 3,
    filters: {
      genre: 'action',
      area: '大陆',
      year: 'all',
      sort: 'latest'
    }
  });

  // 类型: object；作用: 根据用户下一次目录请求重新生成 URL query。
  const nextQuery = createCatalogRouteQuery({
    baseQuery: query,
    defaults: DEFAULT_FILTERS,
    filters: parsed.filters,
    page: parsed.page
  });

  // 断言作用: 构造结果可以重新交给 Router，且不修改原 query 引用。
  assert.deepEqual(nextQuery, query);
  assert.notEqual(nextQuery, query);
  assert.deepEqual(query, {
    genre: 'action',
    area: '大陆',
    page: '3',
    unrelated: 'preserve-me'
  });
});

// 测试目的: 目录默认值和非法页码必须通过缺失字段/第一页失败关闭，不能把异常 query 传给 Provider。
test('目录请求状态对默认值和非法页码失败关闭', () => {
  // 类型: object；作用: 模拟带非法页码、小数和空筛选值的 URL。
  const parsed = createCatalogRouteState({ page: '2.5', genre: '   ' }, DEFAULT_FILTERS);

  // 断言作用: 非法页码和空筛选必须回到稳定默认请求。
  assert.deepEqual(parsed, {
    page: 1,
    filters: { ...DEFAULT_FILTERS }
  });

  // 类型: object；作用: 构造默认目录状态的简洁 URL。
  const query = createCatalogRouteQuery({
    baseQuery: { genre: 'action', page: '4' },
    defaults: DEFAULT_FILTERS,
    filters: DEFAULT_FILTERS,
    page: 1
  });

  // 断言作用: 默认筛选和第一页通过删除受管字段表达，避免旧请求参数残留。
  assert.deepEqual(query, {});
});

// 测试目的: 电视剧 category 必须和其他筛选一样进入 URL 请求事实，并在默认值时从 query 删除。
test('电视剧分类状态通过 URL 持久化并使用 all 中性值', () => {
  // 类型: object；作用: 模拟用户选择热门综艺并停留在第二页的电视剧 URL。
  const parsed = createCatalogRouteState({ category: 'show', page: '2' }, TV_DEFAULT_FILTERS);
  assert.equal(parsed.page, 2);
  assert.equal(parsed.filters.category, 'show');

  // 类型: object；作用: 把已解析分类重新生成可刷新的 query，证明分类不依赖页面内存。
  const selectedQuery = createCatalogRouteQuery({
    baseQuery: {},
    defaults: TV_DEFAULT_FILTERS,
    filters: parsed.filters,
    page: parsed.page
  });
  assert.deepEqual(selectedQuery, { category: 'show', page: '2' });

  // 断言作用: all 是无筛选事实，重置后不在 URL 中保留冗余分类参数。
  assert.deepEqual(createCatalogRouteQuery({
    baseQuery: selectedQuery,
    defaults: TV_DEFAULT_FILTERS,
    filters: TV_DEFAULT_FILTERS,
    page: 1
  }), {});
});

// 测试目的: 通用控制器必须按页面键使用正式容量，避免电视剧继续被电影十二条容量截断。
test('目录控制器按页面键生成电影十二条和电视剧十八条请求', () => {
  // 类型: object；作用: 创建不依赖 Vue 实例的电影控制器配置。
  const movieController = createCatalogPageController({
    pageKey: 'movie',
    routeName: 'movie',
    defaultFilters: DEFAULT_FILTERS,
    fallbackErrorMessage: '电影请求失败'
  });
  // 类型: object；作用: 创建包含 category 中性状态的电视剧控制器配置。
  const tvController = createCatalogPageController({
    pageKey: 'tv',
    routeName: 'tv',
    defaultFilters: TV_DEFAULT_FILTERS,
    fallbackErrorMessage: '电视剧请求失败'
  });
  // 类型: object；作用: 提供 createCatalogPageRequest 所需的只读筛选上下文。
  const movieContext = { selectedFilters: { ...DEFAULT_FILTERS } };
  // 类型: object；作用: 提供电视剧请求所需的完整中性筛选上下文。
  const tvContext = { selectedFilters: { ...TV_DEFAULT_FILTERS } };

  assert.equal(movieController.methods.createCatalogPageRequest.call(movieContext, 1).params.pageSize, 12);
  assert.equal(tvController.methods.createCatalogPageRequest.call(tvContext, 1).params.pageSize, 18);
  assert.equal(tvController.methods.createCatalogPageRequest.call(tvContext, 1).params.category, 'all');
});

// 测试目的: 搜索关键词和页码必须进入 URL，刷新后能够构造同一请求而不依赖组件内存。
test('搜索请求状态在关键词页码与 URL query 之间双向转换', () => {
  // 类型: object；作用: 模拟用户搜索关键词并处于第二页的当前 URL。
  const query = { keyword: '  星际  ', page: '2', unrelated: 'preserve-me' };
  // 类型: object；作用: 解析刷新后当前搜索 URL 的请求事实。
  const parsed = createSearchRouteState(query);

  // 断言作用: 关键词必须清理首尾空白，页码必须保持第二页。
  assert.deepEqual(parsed, { keyword: '星际', page: 2 });

  // 类型: object；作用: 根据解析结果构造下一次搜索导航 query。
  const nextQuery = createSearchRouteQuery({
    baseQuery: query,
    keyword: parsed.keyword,
    page: parsed.page
  });

  // 断言作用: 关键词和页码可原样恢复，同时保留未来无关 query 字段。
  assert.deepEqual(nextQuery, {
    keyword: '星际',
    page: '2',
    unrelated: 'preserve-me'
  });
});

// 测试目的: 清空搜索和非法页码必须回到无关键词第一页，不保留旧 query。
test('搜索请求状态清理空关键词和非法页码', () => {
  // 类型: object；作用: 构造空搜索状态的下一次 URL。
  const query = createSearchRouteQuery({
    baseQuery: { keyword: '旧词', page: '8' },
    keyword: '',
    page: 0
  });

  // 断言作用: 空关键词和第一页都由 query 缺失表达，旧值不能残留。
  assert.deepEqual(query, {});
  assert.deepEqual(createSearchRouteState(query), { keyword: '', page: 1 });
});

// 测试目的: KeepAlive 页面只能处理自己的新 fullPath，离开和返回同一地址不得重新请求。
test('路由请求守卫隔离失活页面并区分真实 URL 变化', () => {
  // 类型: Readonly<object>；作用: 模拟只负责电影路由的缓存页面守卫。
  const movieGuard = createRouteRequestGuard({ routeNames: ['movie'] });
  // 类型: object；作用: 模拟电影页面首次创建时的 URL 请求身份。
  const firstMovieRoute = { name: 'movie', fullPath: '/movie?genre=action' };
  // 类型: object；作用: 模拟切换到首页后的全局路由，电影组件仍保留在 KeepAlive 缓存。
  const homeRoute = { name: 'home', fullPath: '/' };
  // 类型: object；作用: 模拟电影筛选发生真实变化后的新 URL。
  const secondMovieRoute = { name: 'movie', fullPath: '/movie?genre=drama' };

  // 断言作用: 首次 URL 必须被标记，避免创建流程之后的同地址回调重复请求。
  assert.equal(movieGuard.markHandled(firstMovieRoute), true);
  // 断言作用: 失活页面看到首页路由时不能发起电影请求。
  assert.equal(movieGuard.shouldHandle(homeRoute), false);
  // 断言作用: 返回原电影地址时必须继续使用缓存实例，不重复请求。
  assert.equal(movieGuard.shouldHandle(firstMovieRoute), false);
  // 断言作用: 只有电影 URL 真正变化时才允许发起新请求。
  assert.equal(movieGuard.shouldHandle(secondMovieRoute), true);

  // 类型: Readonly<object>；作用: 模拟详情/详情严格路由共享一个一级入口守卫。
  const detailGuard = createRouteRequestGuard({ routeNames: ['detail-entry'] });
  // 断言作用: 严格详情通过 topNavName 归属 detail-entry，必须被同一守卫接收。
  assert.equal(
    detailGuard.markHandled({
      name: 'detail',
      fullPath: '/detail/source/video',
      meta: { topNavName: 'detail-entry' }
    }),
    true
  );
});
