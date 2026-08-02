/*
  user-content-recovery.test.js 模块说明

  - 文件职责:
      验证用户内容卡片快照、分集定位器和跨 Provider 匹配的纯函数契约。
      不启动 Runtime、Provider、数据库、服务或浏览器，只锁定恢复数据形状和可靠匹配边界。

  - 导入库及文件汇总(5 条，内置 2 条，第三方 0 条，自定义 3 条):
      node:assert/strict: Node 内置断言，比较快照字段和匹配对象。
      node:test: Node 内置测试运行器，注册纯函数测试用例。
      userContentSnapshotService exports: 自定义服务，创建与恢复快照、创建定位器并匹配分集。
      userContentRecoveryService exports: 自定义恢复服务函数，验证来源名称、稳定播放入口和当前目录精确解析。
      USER_CONTENT_RECOVERY_KIND: 自定义配置，提供历史与收藏恢复类型。

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

import {
  // 导入来源: ../src/services/userContentRecoveryService.js；导入内容: resolveUserContentSourceName；文件作用: 验证来源名称不与可用性和显示裁剪混用。
  resolveUserContentSourceName,
  // 导入来源: ../src/services/userContentRecoveryService.js；导入内容: createUserContentRecoveryPlaybackTarget；文件作用: 验证个人中心不把旧目录身份写入播放器入口。
  createUserContentRecoveryPlaybackTarget,
  // 导入来源: ../src/services/userContentRecoveryService.js；导入内容: resolveUserContentRecoveryPlaybackTarget；文件作用: 验证稳定记录键只映射当前目录的确定线路和剧集。
  resolveUserContentRecoveryPlaybackTarget
} from '../src/services/userContentRecoveryService.js';

// 导入来源: ../src/config/user-content.config.js；导入内容: USER_CONTENT_RECOVERY_KIND；文件作用: 构造历史和收藏恢复入口测试类型。
import { USER_CONTENT_RECOVERY_KIND } from '../src/config/user-content.config.js';

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
    playCatalog: {
      defaultLineId: 'line-1',
      lines: [{
        id: 'line-1',
        name: '主线路',
        available: true,
        unavailableReason: '',
        episodes: [{
          id: 'episode-1',
          kind: 'episode',
          seasonNumber: 1,
          episodeNumber: 1,
          title: '',
          label: '第 1 集',
          duration: '',
          description: '',
          cover: '',
          playable: true
        }]
      }]
    },
    playback: {
      lineId: 'line-1',
      episodeId: 'episode-1',
      media: {
        type: 'hls',
        url: 'https://media.example.test/video.m3u8',
        quality: 'HD',
        deliveryMode: 'direct'
      }
    }
  };
}

test('ContentCardSnapshot 只保存个人中心卡片与重新搜索所需稳定字段', () => {
  // 类型: object；作用: 保存从完整 ContentItem 生成的长期用户快照。
  const snapshot = createContentCardSnapshot(createTestContentItem(), TEST_CAPTURED_AT);
  assert.equal(snapshot.title, '跨源恢复示例剧');
  assert.deepEqual(snapshot.searchHints.aliases, ['Recovery Series']);
  assert.equal(Object.hasOwn(snapshot, 'detail'), false);
  assert.equal(Object.hasOwn(snapshot, 'playCatalog'), false);
  assert.equal(Object.hasOwn(snapshot, 'playback'), false);

  // 类型: object；作用: 模拟个人中心刷新后只依赖本地快照恢复 VideoCard 输入。
  const restored = createContentItemFromSnapshot(snapshot);
  assert.equal(restored.id, snapshot.contentId);
  assert.equal(restored.sourceId, snapshot.sourceId);
  assert.deepEqual(restored.genres, snapshot.genres);
  restored.genres.push('隔离修改');
  assert.deepEqual(snapshot.genres, ['剧情', '悬疑']);
});

test('EpisodeLocator 依次采用唯一季集号、无季号唯一集号或唯一特辑标题', () => {
  // 类型: Array<object>；作用: 模拟当前内容返回的普通剧集、无季号剧集、特辑和同序号干扰候选。
  const episodes = [
    { id: 'index-only', kind: 'episode', seasonNumber: 2, episodeNumber: 9, index: 5, title: '其他标题' },
    { id: 'ordinary-title', kind: 'episode', seasonNumber: 3, episodeNumber: 8, index: 7, title: '目标标题' },
    { id: 'special-title', kind: 'special', seasonNumber: null, episodeNumber: null, index: 8, title: '目标特辑' },
    { id: 'structured-match', kind: 'episode', seasonNumber: 1, episodeNumber: 3, index: 9, title: '不同标题' },
    { id: 'number-only-match', kind: 'episode', seasonNumber: null, episodeNumber: 6, index: 10, title: '' }
  ];
  // 类型: object；作用: 同时提供季集号、标题和序号，必须只由唯一季集号确认普通剧集。
  const locator = createEpisodeLocator(
    { id: 'old-episode', seasonNumber: 1, episodeNumber: 3, index: 5, title: '目标标题' },
    { episodeIndex: 5 }
  );
  assert.equal(findEpisodeByLocator(episodes, locator)?.id, 'structured-match');

  // 类型: object；作用: 完整特辑标题只允许命中 kind=special 的唯一候选。
  const specialLocator = { ...locator, seasonNumber: null, episodeNumber: null, episodeTitle: '目标特辑' };
  assert.equal(findEpisodeByLocator(episodes, specialLocator)?.id, 'special-title');

  // 类型: object；作用: 普通剧集完整标题不得绕过缺失季集号自动选集。
  const ordinaryTitleLocator = { ...specialLocator, episodeTitle: '目标标题' };
  assert.equal(findEpisodeByLocator(episodes, ordinaryTitleLocator), null);

  // 类型: object；作用: 旧记录没有季号但保存明确集号，当前内容中唯一同集号普通剧集可以确定恢复。
  const numberOnlyLocator = {
    ...ordinaryTitleLocator,
    episodeNumber: 6,
    episodeIndex: 1,
    episodeTitle: '第 6 集'
  };
  assert.equal(findEpisodeByLocator(episodes, numberOnlyLocator)?.id, 'number-only-match');

  // 类型: Array<object>；作用: 同一内容跨季出现第二个第六集，证明无季号定位器不能忽略歧义采用首项。
  const duplicateNumberEpisodes = [
    ...episodes,
    { id: 'number-only-duplicate', kind: 'episode', seasonNumber: 2, episodeNumber: 6, index: 11, title: '' }
  ];
  assert.equal(findEpisodeByLocator(duplicateNumberEpisodes, numberOnlyLocator), null);

  // 类型: object；作用: 页面序号单项不能驱动跨源恢复。
  const indexLocator = { ...ordinaryTitleLocator, episodeNumber: null, episodeTitle: '', episodeIndex: 5 };
  assert.equal(findEpisodeByLocator(episodes, indexLocator), null);

  // 类型: Array<object>；作用: 重复季集号代表 Provider 结果无法唯一确认，必须失败关闭而不是采用首项。
  const duplicateStructuredEpisodes = [
    ...episodes,
    { id: 'structured-duplicate', kind: 'episode', seasonNumber: 1, episodeNumber: 3, index: 10, title: '' }
  ];
  assert.equal(findEpisodeByLocator(duplicateStructuredEpisodes, locator), null);
});

test('旧 URL 分集身份在季号未知且明确集号唯一时映射当前目录', () => {
  // 类型: object；作用: 复现 Edge 旧库内容已规范化为新 id、当前目录只交付明确集号而没有季号的详情结果。
  const contentItem = createTestContentItem();
  contentItem.id = 'db-0';
  contentItem.title = '行尸走肉 第九季';
  contentItem.playCatalog = {
    defaultLineId: 'line-current',
    lines: [{
      id: 'line-current',
      name: '当前线路',
      available: true,
      episodes: [
        { id: 'episode-1', kind: 'episode', seasonNumber: null, episodeNumber: 1, label: '第01集', playable: true },
        { id: 'episode-2', kind: 'episode', seasonNumber: null, episodeNumber: 2, label: '第02集', playable: true }
      ]
    }]
  };
  // 类型: string；作用: 模拟旧 Provider 保存的源站播放 URL 分集身份，当前目录不再暴露该私有地址。
  const legacyEpisodeId = 'https://provider.example.test/play/resource/18697?source=legacy&ep=1';
  // 类型: object；作用: 复现旧内容 id、旧线路和 URL 型 episodeId 已失效，但 EpisodeLocator 保留明确第一集的记录。
  const historyRecord = {
    sourceId: 'source-test-a',
    contentId: 'resource:%2Fplay%2Fresource%2F18697',
    historyKey: `source-test-a::resource:%2Fplay%2Fresource%2F18697::${legacyEpisodeId}`,
    episodeId: legacyEpisodeId,
    playbackSourceId: 'line-legacy',
    episodeLocator: {
      episodeId: legacyEpisodeId,
      seasonNumber: null,
      episodeNumber: 1,
      episodeIndex: 1,
      episodeTitle: '第01集'
    }
  };
  // 类型: object|null；作用: 解析结果必须只使用当前规范内容、线路和逻辑剧集身份。
  const resolved = resolveUserContentRecoveryPlaybackTarget(contentItem, {
    recoveryKind: USER_CONTENT_RECOVERY_KIND.history,
    recoveryKey: historyRecord.historyKey,
    record: historyRecord,
    historyRecord
  }, { recoveryKind: 'history', recoveryKey: historyRecord.historyKey, autoplay: '1' });
  assert.equal(resolved?.line.id, 'line-current');
  assert.equal(resolved?.episode.id, 'episode-1');
  assert.deepEqual(resolved?.target, {
    name: 'player',
    params: { sourceId: 'source-test-a', videoId: 'db-0' },
    query: {
      episodeId: 'episode-1',
      episodeIndex: '1',
      playbackSourceId: 'line-current',
      autoplay: '1'
    }
  });

  // 类型: object；作用: 当前内容出现第二个明确第一集时保持歧义，禁止把无季号旧记录迁移到任意一季。
  const ambiguousContentItem = {
    ...contentItem,
    playCatalog: {
      ...contentItem.playCatalog,
      lines: [{
        ...contentItem.playCatalog.lines[0],
        episodes: [
          ...contentItem.playCatalog.lines[0].episodes,
          { id: 'season-2:episode-1', kind: 'episode', seasonNumber: 2, episodeNumber: 1, label: '第二季第01集', playable: true }
        ]
      }]
    }
  };
  assert.equal(resolveUserContentRecoveryPlaybackTarget(ambiguousContentItem, {
    recoveryKind: USER_CONTENT_RECOVERY_KIND.history,
    recoveryKey: historyRecord.historyKey,
    record: historyRecord,
    historyRecord
  }), null);
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

test('个人中心播放入口只携带稳定记录键而不携带旧目录身份', () => {
  // 类型: object；作用: 模拟 Provider 更新前保存的第二集历史，旧线路和旧剧集只能留在用户记录正文。
  const historyRecord = {
    historyKey: 'source-test-a::series-1::old-episode-2',
    sourceId: 'source-test-a',
    contentId: 'series-1',
    episodeId: 'old-episode-2',
    episodeIndex: 2,
    playbackSourceId: 'old-line'
  };
  // 类型: object|null；作用: 生成个人中心点击历史时的一次性播放器恢复入口。
  const target = createUserContentRecoveryPlaybackTarget(USER_CONTENT_RECOVERY_KIND.history, historyRecord);
  assert.deepEqual(target, {
    name: 'player',
    params: { sourceId: 'source-test-a', videoId: 'series-1' },
    query: {
      recoveryKind: USER_CONTENT_RECOVERY_KIND.history,
      recoveryKey: historyRecord.historyKey,
      autoplay: '1'
    }
  });
  // 断言作用: 缺少稳定历史键时不得降级使用旧 episodeId 或 playbackSourceId 构造目标。
  assert.equal(createUserContentRecoveryPlaybackTarget(USER_CONTENT_RECOVERY_KIND.history, {
    sourceId: 'source-test-a',
    contentId: 'series-1',
    episodeId: 'old-episode-2',
    playbackSourceId: 'old-line'
  }), null);
});

test('历史恢复优先采用当前目录仍有效的旧剧集和旧成功线路', () => {
  // 类型: object；作用: 构造两条当前线路都包含同一逻辑剧集的标准目录。
  const contentItem = createTestContentItem();
  contentItem.playCatalog = {
    defaultLineId: 'line-default',
    lines: [
      {
        id: 'line-default',
        name: '默认线路',
        available: true,
        episodes: [{ id: 'episode-1', kind: 'episode', seasonNumber: 1, episodeNumber: 1, playable: true }]
      },
      {
        id: 'line-history',
        name: '上次线路',
        available: true,
        episodes: [{ id: 'episode-1', kind: 'episode', seasonNumber: 1, episodeNumber: 1, playable: true }]
      }
    ]
  };
  // 类型: object；作用: 模拟稳定历史键已经回读到的旧成功线路和逻辑剧集。
  const historyRecord = {
    sourceId: 'source-test-a',
    contentId: 'series-1',
    historyKey: 'history-exact',
    episodeId: 'episode-1',
    playbackSourceId: 'line-history',
    episodeLocator: { episodeId: 'episode-1', seasonNumber: 1, episodeNumber: 1, episodeIndex: 1, episodeTitle: '' }
  };
  // 类型: object|null；作用: 使用当前目录解析稳定历史，不直接采用历史正文作为播放请求。
  const resolved = resolveUserContentRecoveryPlaybackTarget(contentItem, {
    recoveryKind: USER_CONTENT_RECOVERY_KIND.history,
    recoveryKey: historyRecord.historyKey,
    record: historyRecord,
    historyRecord
  }, { recoveryKind: 'history', recoveryKey: historyRecord.historyKey, autoplay: '1' });
  assert.equal(resolved?.line.id, 'line-history');
  assert.equal(resolved?.episode.id, 'episode-1');
  assert.deepEqual(resolved?.target.query, {
    episodeId: 'episode-1',
    episodeIndex: '1',
    playbackSourceId: 'line-history',
    autoplay: '1'
  });
});

test('旧剧集身份失效时只按 EpisodeLocator 唯一映射当前目录', () => {
  // 类型: object；作用: 当前 Provider 已更换线路和逻辑剧集 id，但仍交付唯一季集号证据。
  const contentItem = createTestContentItem();
  contentItem.playCatalog = {
    defaultLineId: 'line-current',
    lines: [{
      id: 'line-current',
      name: '当前线路',
      available: true,
      episodes: [{
        id: 'episode-current-3',
        kind: 'episode',
        seasonNumber: 1,
        episodeNumber: 3,
        title: '第三集',
        playable: true
      }]
    }]
  };
  // 类型: object；作用: 模拟旧线路和旧逻辑 id 已不存在、但定位器仍能确认第一季第三集的历史。
  const historyRecord = {
    sourceId: 'source-test-a',
    contentId: 'series-1',
    historyKey: 'history-locator',
    episodeId: 'episode-old-3',
    playbackSourceId: 'line-old',
    episodeLocator: {
      episodeId: 'episode-old-3',
      seasonNumber: 1,
      episodeNumber: 3,
      episodeIndex: 3,
      episodeTitle: '旧第三集'
    }
  };
  // 类型: object|null；作用: 解析结果必须完全使用当前目录身份并清除一次性恢复 query。
  const resolved = resolveUserContentRecoveryPlaybackTarget(contentItem, {
    recoveryKind: USER_CONTENT_RECOVERY_KIND.history,
    recoveryKey: historyRecord.historyKey,
    record: historyRecord,
    historyRecord
  }, { recoveryKind: 'history', recoveryKey: historyRecord.historyKey, autoplay: '1' });
  assert.equal(resolved?.line.id, 'line-current');
  assert.equal(resolved?.episode.id, 'episode-current-3');
  assert.deepEqual(resolved?.target.query, {
    episodeId: 'episode-current-3',
    episodeIndex: '3',
    playbackSourceId: 'line-current',
    autoplay: '1'
  });

  // 类型: object；作用: 加入同一季集号的第二个逻辑身份，证明歧义目录不能采用首项或数组位置。
  const ambiguousContentItem = {
    ...contentItem,
    playCatalog: {
      ...contentItem.playCatalog,
      lines: [{
        ...contentItem.playCatalog.lines[0],
        episodes: [
          ...contentItem.playCatalog.lines[0].episodes,
          { id: 'episode-current-3-duplicate', kind: 'episode', seasonNumber: 1, episodeNumber: 3, playable: true }
        ]
      }]
    }
  };
  assert.equal(resolveUserContentRecoveryPlaybackTarget(ambiguousContentItem, {
    recoveryKind: USER_CONTENT_RECOVERY_KIND.history,
    recoveryKey: historyRecord.historyKey,
    record: historyRecord,
    historyRecord
  }), null);
});

test('旧电影历史缺少剧集身份时只采用当前线路唯一可播放正片', () => {
  // 类型: object；作用: 模拟旧版本电影历史没有 episodeId，而当前详情目录具有唯一标准正片。
  const contentItem = {
    ...createTestContentItem(),
    type: 'movie',
    playCatalog: {
      defaultLineId: 'line-movie',
      lines: [
        {
          id: 'line-old',
          name: '旧线路',
          available: true,
          episodes: [{ id: 'movie-trailer-old', kind: 'special', title: '旧预告', playable: true }]
        },
        {
          id: 'line-movie',
          name: '电影线路',
          available: true,
          episodes: [
            { id: 'movie-trailer', kind: 'special', title: '预告', playable: true },
            { id: 'movie-feature', kind: 'feature', title: '正片', playable: true }
          ]
        }
      ]
    }
  };
  // 类型: object；作用: 电影历史键只到内容级，旧保存形状允许没有逻辑剧集和定位字段。
  const historyRecord = {
    sourceId: 'source-test-a',
    contentId: 'series-1',
    historyKey: 'history-movie',
    episodeId: '',
    playbackSourceId: 'line-old',
    episodeLocator: { episodeId: '', seasonNumber: null, episodeNumber: null, episodeIndex: null, episodeTitle: '' }
  };
  // 类型: object|null；作用: 旧线路没有正片时继续检查 Provider 默认线路，唯一 feature 是整部电影的确定目标。
  const resolved = resolveUserContentRecoveryPlaybackTarget(contentItem, {
    recoveryKind: USER_CONTENT_RECOVERY_KIND.history,
    recoveryKey: historyRecord.historyKey,
    record: historyRecord,
    historyRecord
  });
  assert.equal(resolved?.episode.id, 'movie-feature');
  assert.equal(resolved?.line.id, 'line-movie');

  // 类型: object；作用: 两个可播放正片没有唯一证据，必须拒绝恢复而不是采用数组首项。
  const ambiguousContentItem = {
    ...contentItem,
    playCatalog: {
      ...contentItem.playCatalog,
      lines: [{
        ...contentItem.playCatalog.lines[1],
        episodes: [
          ...contentItem.playCatalog.lines[1].episodes,
          { id: 'movie-feature-alternate', kind: 'feature', title: '另一正片', playable: true }
        ]
      }]
    }
  };
  assert.equal(resolveUserContentRecoveryPlaybackTarget(ambiguousContentItem, {
    recoveryKind: USER_CONTENT_RECOVERY_KIND.history,
    recoveryKey: historyRecord.historyKey,
    record: historyRecord,
    historyRecord
  }), null);
});
