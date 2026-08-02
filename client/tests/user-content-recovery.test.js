/*
  user-content-recovery.test.js 模块说明

  - 文件职责:
      验证用户内容卡片快照、分集定位器和跨 Provider 匹配的纯函数契约。
      不启动 Runtime、Provider、数据库、服务或浏览器，只锁定恢复数据形状和匹配优先级。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:assert/strict: Node 内置断言，比较快照字段和匹配对象。
      node:test: Node 内置测试运行器，注册纯函数测试用例。
      userContentSnapshotService exports: 自定义服务，创建与恢复快照、创建定位器并匹配分集。
      resolveUserContentSourceName: 自定义恢复服务函数，验证旧记录来源名称优先级。

  - 模块级常量:
      TEST_CAPTURED_AT: string，测试快照固定捕获时间。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createTestContentItem(): 创建字段完整且包含禁止保存增强字段的标准内容夹具。

  - 模块级类:
      无

  - 对外导出:
      无
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 复核快照隔离和分集匹配结果。
import assert from 'node:assert/strict';

// 导入来源: node:test；导入内容: test；文件作用: 注册用户内容恢复纯函数用例。
import test from 'node:test';

import {
  // 导入来源: ../src/services/userContentSnapshotService.js；导入内容: createContentCardSnapshot；文件作用: 验证长期卡片快照字段边界。
  createContentCardSnapshot,
  // 导入来源: ../src/services/userContentSnapshotService.js；导入内容: createContentItemFromSnapshot；文件作用: 验证个人中心本地卡片恢复。
  createContentItemFromSnapshot,
  // 导入来源: ../src/services/userContentSnapshotService.js；导入内容: createEpisodeLocator；文件作用: 验证历史分集定位字段。
  createEpisodeLocator,
  // 导入来源: ../src/services/userContentSnapshotService.js；导入内容: findEpisodeByLocator；文件作用: 验证跨 Provider 固定匹配优先级。
  findEpisodeByLocator
} from '../src/services/userContentSnapshotService.js';

// 导入来源: ../src/services/userContentRecoveryService.js；导入内容: resolveUserContentSourceName；文件作用: 验证来源名称不与可用性和显示裁剪混用。
import { resolveUserContentSourceName } from '../src/services/userContentRecoveryService.js';

// 类型: string；作用: 所有快照断言共用合法固定时间，避免系统时钟影响结果。
const TEST_CAPTURED_AT = '2026-07-28T08:00:00.000Z';

/**
 * 创建包含卡片字段和禁止持久化增强字段的标准内容夹具。
 * 纯函数: 每次返回新对象，不读取 Store、Provider 或浏览器状态。
 *
 * @returns {object} 可生成完整 ContentCardSnapshot 的电视剧 ContentItem。
 */
function createTestContentItem() {
  return {
    id: 'series-1',
    sourceId: 'source-test-a',
    sourceName: '测试源 A',
    type: 'tv',
    title: '跨源恢复示例剧',
    aliases: ['Recovery Series'],
    poster: 'https://example.test/poster.jpg',
    cover: 'https://example.test/cover.jpg',
    year: '2026',
    area: '测试地区',
    genres: ['剧情', '悬疑'],
    displayTags: ['热播'],
    score: 8.5,
    quality: '',
    badge: '',
    movie: { duration: '' },
    tv: { updateStatus: '更新至 5 集', latestEpisode: '5', totalEpisodes: '12' },
    detail: { fullDescription: '不能进入用户卡片快照的详情正文。' },
    episodes: [{ id: 'episode-1', episodeNumber: 1 }],
    playback: { sources: [{ id: 'line-1', url: 'https://media.example.test/video.m3u8' }] }
  };
}

test('ContentCardSnapshot 只保存个人中心卡片与重新搜索所需稳定字段', () => {
  // 类型: object；作用: 保存从完整 ContentItem 生成的长期用户快照。
  const snapshot = createContentCardSnapshot(createTestContentItem(), TEST_CAPTURED_AT);
  assert.equal(snapshot.title, '跨源恢复示例剧');
  assert.deepEqual(snapshot.searchHints.aliases, ['Recovery Series']);
  assert.equal(Object.hasOwn(snapshot, 'detail'), false);
  assert.equal(Object.hasOwn(snapshot, 'episodes'), false);
  assert.equal(Object.hasOwn(snapshot, 'playback'), false);

  // 类型: object；作用: 模拟个人中心刷新后只依赖本地快照恢复 VideoCard 输入。
  const restored = createContentItemFromSnapshot(snapshot);
  assert.equal(restored.id, snapshot.contentId);
  assert.equal(restored.sourceId, snapshot.sourceId);
  assert.deepEqual(restored.genres, snapshot.genres);
  restored.genres.push('隔离修改');
  assert.deepEqual(snapshot.genres, ['剧情', '悬疑']);
});

test('EpisodeLocator 优先季集号，其次完整标题，最后稳定序号', () => {
  // 类型: Array<object>；作用: 模拟替代 Provider 返回的候选分集，同一定位器可命中不同强度事实。
  const episodes = [
    { id: 'index-match', seasonNumber: 2, episodeNumber: 9, index: 5, title: '其他标题' },
    { id: 'title-match', seasonNumber: 3, episodeNumber: 8, index: 7, title: '目标标题' },
    { id: 'structured-match', seasonNumber: 1, episodeNumber: 3, index: 9, title: '不同标题' }
  ];
  // 类型: object；作用: 同时提供三种匹配事实，必须由季集号获得最高优先级。
  const locator = createEpisodeLocator(
    { id: 'old-episode', seasonNumber: 1, episodeNumber: 3, index: 5, title: '目标标题' },
    { episodeIndex: 5 }
  );
  assert.equal(findEpisodeByLocator(episodes, locator)?.id, 'structured-match');

  // 类型: object；作用: 去除季集号后验证完整标题优先于序号。
  const titleLocator = { ...locator, seasonNumber: null, episodeNumber: null };
  assert.equal(findEpisodeByLocator(episodes, titleLocator)?.id, 'title-match');

  // 类型: object；作用: 去除标题后验证页面稳定序号作为最终后备。
  const indexLocator = { ...titleLocator, episodeTitle: '' };
  assert.equal(findEpisodeByLocator(episodes, indexLocator)?.id, 'index-match');
});

test('旧用户记录按快照、当前定义和身份顺序恢复完整来源名称', () => {
  // 类型: object；作用: 模拟 v24 前没有快照名称但当前 SourceDefinition 仍存在的可用记录。
  const currentSourceRecord = { definition: { id: 'system-source-1', name: '系统数据源1' } };
  assert.equal(resolveUserContentSourceName({ sourceId: 'system-source-1' }, currentSourceRecord), '系统数据源1');

  // 类型: object；作用: 模拟原数据源已删除但长期快照保留保存时正式名称的记录。
  const removedSourceRecord = {
    sourceId: 'source.removed.example',
    contentSnapshot: { sourceName: '已移除来源' }
  };
  assert.equal(resolveUserContentSourceName(removedSourceRecord, null), '已移除来源');

  // 断言作用: 没有快照、当前定义和旧名称字段时，稳定 sourceId 是最后后备而不是状态判断依据。
  assert.equal(resolveUserContentSourceName({ sourceId: 'source.last-resort' }, null), 'source.last-resort');
});
