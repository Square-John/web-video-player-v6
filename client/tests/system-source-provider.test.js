/*
  system-source-provider.test.js 模块说明

  - 文件职责:
      验证系统数据源4单文件演示 Provider 的全页面映射、分类元信息、逻辑分页和生命周期。
      测试只调用离线 Provider，不启动 Vue、浏览器、后端代理或网络请求。

  - 导入库及文件汇总(3 条，内置 2 条，第三方 0 条，自定义 1 条):
      assert: Node 内置严格断言模块，用于验证标准响应和引用边界。
      test: Node 内置测试注册函数，用于声明独立 Provider 用例。
      systemSourceModule: 自定义单文件 Provider 模块，提供 manifest 和工厂。

  - 模块级常量:
      SOURCE_ID: string，当前公开演示 Provider 的稳定身份。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createRequest(pageKey, params, moduleKey): 创建标准内容请求。
      createRunningProvider(): 创建并启动独立 Provider 实例。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node 测试运行器执行。
*/

// 导入来源: node:assert/strict；导入内容: assert 严格断言门面；文件作用: 验证 Provider 响应结构和页面映射结果。
import assert from 'node:assert/strict';

// 导入来源: node:test；导入内容: test 测试注册函数；文件作用: 注册隔离异步测试。
import test from 'node:test';

// 导入来源: ../../datasource/system-source-4.js；导入内容: 单文件演示 Provider 模块；文件作用: 验证公开脚本真实导出和运行行为。
import * as systemSourceModule from '../../datasource/system-source-4.js';

// 类型: string；作用: 当前测试所有请求和 Definition 共用 manifest 稳定身份，不在测试复制第二个 sourceId。
const SOURCE_ID = systemSourceModule.sourceManifest.id;

/**
 * 创建标准内容请求。
 * 纯函数: 每次返回新的 params 对象，不修改调用方输入。
 * 成功路径: 返回包含来源、页面、模块和参数的完整请求。
 * 失败路径: 无；非法业务值由 Provider 受测边界处理。
 *
 * @param {string} pageKey 标准页面键。
 * @param {object} [params={}] 页面请求参数。
 * @param {string} [moduleKey=''] 首页模块键。
 * @returns {object} 独立 SourceDataRequest。
 */
function createRequest(pageKey, params = {}, moduleKey = '') {
  return { sourceId: SOURCE_ID, pageKey, moduleKey, params: { ...params } };
}

/**
 * 创建并启动独立系统演示 Provider。
 * 副作用: 创建 Provider 闭包状态并按 initialize、start 顺序采用最小同源 Context。
 * 成功路径: 返回处于 running 阶段的 Provider。
 * 失败路径: manifest、工厂或生命周期不合法时 reject 并使当前用例失败。
 *
 * @returns {Promise<object>} 已启动 Provider 实例。
 */
async function createRunningProvider() {
  // 类型: object；作用: 使用 manifest 唯一身份创建 Host Definition 最小测试投影。
  const definition = {
    id: SOURCE_ID,
    providerKey: systemSourceModule.sourceManifest.providerKey
  };
  // 类型: object；作用: 工厂每次创建独立生命周期实例，测试之间不共享阶段。
  const provider = systemSourceModule.createProviderFactory().create({ definition });
  await provider.initialize(Object.freeze({ sourceId: SOURCE_ID }));
  await provider.start();
  return provider;
}

// 测试目的: 首页五个数据桶必须按 Provider 分区策略交付数量、分页和连续排行榜。
test('系统数据源4按首页模块交付分区切片与逻辑分页', async () => {
  const provider = await createRunningProvider();
  try {
    const banners = await provider.fetchData(createRequest('home', { page: 1, pageSize: 100 }, 'banners'));
    assert.equal(banners.items.length, 20);
    assert.equal(banners.pagination.total, 20);

    const hotMovies = await provider.fetchData(createRequest('home', { page: 1, pageSize: 8 }, 'hotMovies'));
    assert.equal(hotMovies.items.length, 8);
    assert.equal(hotMovies.pagination.total, 24);
    assert.equal(hotMovies.pagination.hasMore, true);

    const hotTv = await provider.fetchData(createRequest('home', { page: 1, pageSize: 8 }, 'hotTv'));
    assert.equal(hotTv.items.length, 8);
    assert.equal(hotTv.pagination.total, 24);
    assert.ok(hotTv.items.every(item => item.type === 'tv' && item.genres.length === 1));

    const movieRanking = await provider.fetchData(createRequest('home', { page: 1, pageSize: 20 }, 'movieRanking'));
    assert.equal(movieRanking.items.length, 14);
    assert.deepEqual(movieRanking.items.map(item => item.rank), Array.from({ length: 14 }, (_, index) => index + 1));

    const tvRanking = await provider.fetchData(createRequest('home', { page: 1, pageSize: 20 }, 'tvRanking'));
    assert.equal(tvRanking.items.length, 14);
    assert.deepEqual(tvRanking.items.map(item => item.rank), Array.from({ length: 14 }, (_, index) => index + 1));
  } finally {
    await provider.stop();
    await provider.dispose();
  }
});

// 测试目的: 电影和电视剧目录必须遵守十二/十八条容量，并由 Provider 提供三项电视剧分类元信息。
test('系统数据源4交付目录容量、混合分区和分类筛选', async () => {
  const provider = await createRunningProvider();
  try {
    const movies = await provider.fetchData(createRequest('movie', { page: 1, pageSize: 12 }));
    assert.equal(movies.items.length, 12);
    assert.equal(movies.pagination.pageSize, 12);
    assert.equal(movies.pagination.total, 32);

    const mixedTv = await provider.fetchData(createRequest('tv', { page: 1, pageSize: 18, category: 'all' }));
    assert.equal(mixedTv.items.length, 18);
    assert.deepEqual(
      [...new Set(mixedTv.items.map(item => item.genres[0]))],
      ['热门剧集', '热门综艺', '日本动画']
    );
    assert.equal(mixedTv.pagination.totalPages, 4);

    const shows = await provider.fetchData(createRequest('tv', { page: 1, pageSize: 18, category: 'show' }));
    assert.equal(shows.items.length, 18);
    assert.ok(shows.items.every(item => item.genres[0] === '热门综艺'));

    const filters = await provider.fetchFilterMeta(createRequest('tv'));
    assert.equal(filters.groups.length, 1);
    assert.equal(filters.groups[0].name, 'category');
    assert.deepEqual(filters.groups[0].options.map(option => option.value), ['all', 'tv', 'show', 'cartoon']);
  } finally {
    await provider.stop();
    await provider.dispose();
  }
});

// 测试目的: 搜索结果身份必须可直接恢复详情和播放对象，不能依赖页面缓存或默认内容。
test('系统数据源4搜索身份贯通详情与播放标准对象', async () => {
  const provider = await createRunningProvider();
  try {
    const search = await provider.fetchData(createRequest('search', { keyword: '演示', page: 1, pageSize: 12 }));
    assert.equal(search.items.length, 12);
    assert.equal(search.pagination.pageSize, 12);
    assert.equal(search.pagination.hasMore, true);

    const selected = search.items[0];
    const detail = await provider.fetchData(createRequest('detail', { contentId: selected.id }));
    assert.equal(detail.item.id, selected.id);
    assert.ok(detail.item.episodes.length > 0);

    const episodeId = detail.item.episodes[0].id;
    const player = await provider.fetchData(createRequest('player', { contentId: selected.id, episodeId }));
    assert.equal(player.item.id, selected.id);
    assert.equal(player.item.playback.sources[0].episodeId, episodeId);
    assert.equal(player.item.playback.sources[0].available, false);

    await assert.rejects(
      provider.fetchData(createRequest('detail', { contentId: 'unknown-content' })),
      /contentId 无效/u
    );
  } finally {
    await provider.stop();
    await provider.dispose();
  }
});
