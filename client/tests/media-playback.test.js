/*
  media-playback.test.js 模块说明

  - 文件职责:
      使用 Node 内置测试验证真实媒体线路、稳定会话、项目快捷键和 xgplayer 适配边界。
      由 npm run build 在 Vite 构建前执行，阻止媒体代理、第三方记忆播放、静态播放器依赖和监听泄漏进入生产包。

  - 导入库及文件汇总(10 条，内置 3 条，第三方 0 条，自定义 7 条):
      assert: 内置模块，提供严格断言能力。
      readFileSync: 内置模块，读取 Vue 源码以检查动态加载和架构禁用项。
      test: 内置模块，注册 Node 测试用例。
      mediaPlayback.config exports: 自定义配置，提供媒体阶段和快捷键命令枚举。
      mediaPlaybackValidators exports: 自定义校验器，提供线路、会话标准化和稳定错误类型。
      playbackShortcutService exports: 自定义服务，提供偏好校验、事件匹配、输入排除和命令执行。
      createShortcutSettingsService: 自定义设置服务工厂，验证初始化、Repository-first FIFO 和恢复默认。
      createProjectShortcutPlugin: 自定义插件工厂，提供可测试的 xgplayer 生命周期适配类。
      mediaPlaybackProgressService exports: 自定义服务，提供检查点、最终提交和旧会话隔离。
      mediaReachabilityService exports: 自定义服务，提供精确探测键、冻结顺序和单任务取消协调器。

  - 模块级常量:
      VALID_MP4_MEDIA: object，浏览器直连 MP4 测试媒体。
      VALID_MEDIA_SESSION: object，稳定媒体会话测试基线。
      VALID_PROGRESS_CONTEXT: object，用户内容写入身份测试基线。
      PLAYER_COMPONENT_SOURCE: string，播放器适配组件源码。
      PLAY_CATALOG_SELECTOR_SOURCE: string，共享线路与选集组件源码。
      PLAYER_VIEW_SOURCE: string，播放器页面源码。
      DETAIL_VIEW_SOURCE: string，详情页面源码。
      SOURCE_DATA_SERVICE_SOURCE: string，内容请求服务源码。
      MEDIA_REACHABILITY_SERVICE_SOURCE: string，媒体可达协调服务源码。
      APP_SOURCE: string，应用根组件源码，用于验证播放器常驻所有权。
      ROUTES_SOURCE: string，正式路由表源码。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createKeyboardEvent(overrides): 创建不依赖浏览器 DOM 的键盘事件夹具。
      createPlayerCommandFixture(overrides): 创建快捷键命令需要的最小播放器夹具。
      createProgressSession(overrides): 创建进度协调测试媒体会话。
      createProgressPort(): 创建可观察 currentPlaying 和历史写入的假 userContentService 端口。

  - 模块级类:
      FakePluginRoot: 记录插件 root 的属性、监听绑定和监听移除。
      FakeBasePlugin: 模拟 xgplayer BasePlugin 构造阶段采用 player 与 config。

  - 对外导出:
      无，文件由 Node test runner 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 比较媒体对象、错误和插件副作用。
import assert from 'node:assert/strict';

// 导入来源: node:fs；导入内容: readFileSync；文件作用: 读取 Vue 源码检查动态导入和禁用实现。
import { readFileSync } from 'node:fs';

// 导入来源: node:test；导入内容: test；文件作用: 注册构建前媒体领域测试用例。
import test from 'node:test';

import {
  // 导入来源: ../src/config/mediaPlayback.config.js；导入内容: MEDIA_PLAYBACK_PHASE；文件作用: 构造和断言稳定会话阶段。
  MEDIA_PLAYBACK_PHASE,
  // 导入来源: ../src/config/mediaPlayback.config.js；导入内容: MEDIA_REACHABILITY_STATUS；文件作用: 断言后台队列只发布蓝绿红三态。
  MEDIA_REACHABILITY_STATUS,
  // 导入来源: ../src/config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_ACTION；文件作用: 构造和断言项目播放器命令。
  PLAYBACK_SHORTCUT_ACTION
} from '../src/config/mediaPlayback.config.js';

import {
  // 导入来源: ../src/utils/mediaPlaybackValidators.js；导入内容: MediaPlaybackValidationError；文件作用: 断言非法线路和会话失败类型。
  MediaPlaybackValidationError,
  // 导入来源: ../src/utils/mediaPlaybackValidators.js；导入内容: normalizeMediaPlaybackSession；文件作用: 验证稳定媒体会话字段和错误组合。
  normalizeMediaPlaybackSession,
  // 导入来源: ../src/utils/mediaPlaybackValidators.js；导入内容: normalizeMediaPlaybackMedia；文件作用: 验证 ContentItem.playback.media 直连边界。
  normalizeMediaPlaybackMedia
} from '../src/utils/mediaPlaybackValidators.js';

import {
  // 导入来源: ../src/services/playbackShortcutService.js；导入内容: createDefaultPlaybackShortcutPreferences；文件作用: 验证集中默认键位。
  createDefaultPlaybackShortcutPreferences,
  // 导入来源: ../src/services/playbackShortcutService.js；导入内容: executePlaybackShortcutAction；文件作用: 验证播放器和页面命令分派。
  executePlaybackShortcutAction,
  // 导入来源: ../src/services/playbackShortcutService.js；导入内容: findPlaybackShortcutBinding；文件作用: 验证 KeyboardEvent.code 与修饰符匹配。
  findPlaybackShortcutBinding,
  // 导入来源: ../src/services/playbackShortcutService.js；导入内容: normalizePlaybackShortcutPreferences；文件作用: 验证偏好结构和冲突失败关闭。
  normalizePlaybackShortcutPreferences,
  // 导入来源: ../src/services/playbackShortcutService.js；导入内容: PlaybackShortcutValidationError；文件作用: 断言无效快捷键配置错误类型。
  PlaybackShortcutValidationError,
  // 导入来源: ../src/services/playbackShortcutService.js；导入内容: shouldIgnorePlaybackShortcut；文件作用: 验证输入区和输入法事件排除。
  shouldIgnorePlaybackShortcut
} from '../src/services/playbackShortcutService.js';

// 导入来源: ../src/services/shortcutSettingsService.js；导入内容: createShortcutSettingsService；文件作用: 创建隔离设置服务验证保存队列和投影采用。
import { createShortcutSettingsService } from '../src/services/shortcutSettingsService.js';

// 导入来源: ../src/plugins/projectShortcutPlugin.js；导入内容: createProjectShortcutPlugin；文件作用: 验证插件绑定、执行与销毁生命周期。
import { createProjectShortcutPlugin } from '../src/plugins/projectShortcutPlugin.js';

import {
  // 导入来源: ../src/services/mediaPlaybackProgressService.js；导入内容: createMediaPlaybackProgressService；文件作用: 创建隔离进度协调器验证检查点和最终提交。
  createMediaPlaybackProgressService,
  // 导入来源: ../src/services/mediaPlaybackProgressService.js；导入内容: MediaPlaybackProgressError；文件作用: 断言旧身份和非法上下文失败关闭。
  MediaPlaybackProgressError
} from '../src/services/mediaPlaybackProgressService.js';

import {
  // 导入来源: ../src/services/mediaReachabilityService.js；导入内容: MEDIA_REACHABILITY_QUEUE_RESULT；文件作用: 断言队列正常完成和被新命令取消的稳定结果。
  MEDIA_REACHABILITY_QUEUE_RESULT,
  // 导入来源: ../src/services/mediaReachabilityService.js；导入内容: MEDIA_REACHABILITY_PROBE_RESULT；文件作用: 明确模拟可达、不可达与不可判定内部结果。
  MEDIA_REACHABILITY_PROBE_RESULT,
  // 导入来源: ../src/services/mediaReachabilityService.js；导入内容: createMediaReachabilityKey；文件作用: 比较精确四段媒体目标而不依赖展示文本。
  createMediaReachabilityKey,
  // 导入来源: ../src/services/mediaReachabilityService.js；导入内容: createMediaReachabilityProbePlan；文件作用: 验证当前线路优先和其他线路代表目标顺序。
  createMediaReachabilityProbePlan,
  // 导入来源: ../src/services/mediaReachabilityService.js；导入内容: createMediaReachabilityCoordinator；文件作用: 验证单任务串行、取消和迟到结果隔离。
  createMediaReachabilityCoordinator
} from '../src/services/mediaReachabilityService.js';

// 类型: object。
// 作用: 提供满足 ContentItem.playback.media 契约的直连 MP4 基线，各用例通过展开创建隔离候选。
const VALID_MP4_MEDIA = Object.freeze({
  type: 'mp4',
  url: 'https://media.example.test/video.mp4',
  quality: 'HD',
  deliveryMode: 'direct'
});

// 类型: object。
// 作用: 提供满足 MediaPlaybackSessionState 契约的 playing 会话基线。
const VALID_MEDIA_SESSION = Object.freeze({
  phase: MEDIA_PLAYBACK_PHASE.playing,
  sourceId: 'source-a',
  contentId: 'movie-001',
  episodeId: 'episode-1',
  episodeIndex: 1,
  playbackSourceId: 'line-main',
  playedSeconds: 25,
  durationSeconds: 120,
  bufferedSeconds: 48,
  errorCode: '',
  errorMessage: ''
});

// 类型: object。
// 作用: 提供媒体会话写入 currentPlaying 和历史所需的精确页面身份基线。
const VALID_PROGRESS_CONTEXT = Object.freeze({
  sourceId: 'source-a',
  contentId: 'movie-001',
  type: 'movie',
  episodeId: 'episode-1',
  episodeIndex: 1,
  playbackSourceId: 'line-main',
  contentItem: Object.freeze({
    sourceId: 'source-a',
    id: 'movie-001',
    sourceName: '测试源',
    type: 'movie',
    title: '测试影片',
    poster: '',
    cover: '',
    year: '2026',
    area: '',
    genres: [],
    displayTags: [],
    score: null,
    quality: 'HD',
    badge: '',
    aliases: [],
    movie: Object.freeze({ duration: '120' }),
    tv: Object.freeze({ updateStatus: '', latestEpisode: '', totalEpisodes: '' })
  }),
  episode: Object.freeze({
    id: 'episode-1',
    episodeNumber: 1,
    title: '正片'
  })
});

// 类型: string。
// 作用: 保存播放器适配组件源码，检查 xgplayer/HLS/CSS 只通过动态 import 进入播放页 chunk。
const PLAYER_COMPONENT_SOURCE = readFileSync(
  new URL('../src/components/player/XgplayerMediaPlayer.vue', import.meta.url),
  'utf8'
);

// 类型: string。
// 作用: 保存共享播放目录组件源码，检查布局顶部收敛、自然宽度选集和无业务反馈边界。
const PLAY_CATALOG_SELECTOR_SOURCE = readFileSync(
  new URL('../src/components/playback/PlayCatalogSelector.vue', import.meta.url),
  'utf8'
);

// 类型: string。
// 作用: 保存播放器页面源码，检查页面只消费适配组件和稳定事件，不恢复假播放按钮或历史模拟写入链。
const PLAYER_VIEW_SOURCE = readFileSync(
  new URL('../src/views/PlayerView.vue', import.meta.url),
  'utf8'
);

// 类型: string。
// 作用: 保存详情页源码，检查公开无身份入口和严格请求失败都具备可执行恢复动作。
const DETAIL_VIEW_SOURCE = readFileSync(
  new URL('../src/views/DetailView.vue', import.meta.url),
  'utf8'
);

// 类型: string。
// 作用: 保存内容数据服务源码，验证后台媒体候选不会创建页面事务或采用 SiteContentStore。
const SOURCE_DATA_SERVICE_SOURCE = readFileSync(
  new URL('../src/services/sourceDataService.js', import.meta.url),
  'utf8'
);

// 类型: string。
// 作用: 保存媒体可达服务源码，验证通用队列不引入计时器、普通 fetch、HEAD 或持久化依赖。
const MEDIA_REACHABILITY_SERVICE_SOURCE = readFileSync(
  new URL('../src/services/mediaReachabilityService.js', import.meta.url),
  'utf8'
);

// 类型: string。
// 作用: 保存应用根组件源码，检查唯一 PlayerView 位于普通 router-view 外并通过 v-show 切换可见性。
const APP_SOURCE = readFileSync(
  new URL('../src/App.vue', import.meta.url),
  'utf8'
);

// 类型: string；作用: 读取正式路由表，验证 player 必填身份且不生成顶部入口。
const ROUTES_SOURCE = readFileSync(
  new URL('../src/router/routes.js', import.meta.url),
  'utf8'
);

/**
 * 创建键盘事件测试夹具。
 * 纯函数: 返回新对象，不注册 DOM 监听；调用方可以覆盖 code、修饰符和 target。
 *
 * @param {object} [overrides] 需要覆盖的 KeyboardEvent 字段。
 * @returns {object} 快捷键 service 可消费的事件对象。
 */
function createKeyboardEvent(overrides = {}) {
  return {
    code: 'Space',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    target: null,
    ...overrides
  };
}

/**
 * 创建播放器命令测试夹具。
 * 纯函数: 返回新对象；方法只修改该夹具局部字段，不访问真实媒体元素。
 *
 * @param {object} [overrides] 需要覆盖的播放器字段或方法。
 * @returns {object} executePlaybackShortcutAction 可消费的最小播放器接口。
 */
function createPlayerCommandFixture(overrides = {}) {
  return {
    paused: true,
    currentTime: 20,
    duration: 100,
    muted: false,
    fullscreen: false,
    playCalls: 0,
    pauseCalls: 0,
    fullscreenCalls: 0,
    exitFullscreenCalls: 0,
    /**
     * 模拟播放器开始播放。
     * 副作用: 增加当前夹具 playCalls 并返回已完成 Promise。
     *
     * @returns {Promise<void>} 模拟播放请求完成。
     */
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    },
    /**
     * 模拟播放器暂停。
     * 副作用: 增加当前夹具 pauseCalls。
     *
     * @returns {void} 无返回业务数据。
     */
    pause() {
      this.pauseCalls += 1;
    },
    /**
     * 模拟进入全屏。
     * 副作用: 增加当前夹具 fullscreenCalls 并返回已完成 Promise。
     *
     * @returns {Promise<void>} 模拟全屏请求完成。
     */
    getFullscreen() {
      this.fullscreenCalls += 1;
      return Promise.resolve();
    },
    /**
     * 模拟退出全屏。
     * 副作用: 增加当前夹具 exitFullscreenCalls 并返回已完成 Promise。
     *
     * @returns {Promise<void>} 模拟退出全屏请求完成。
     */
    exitFullscreen() {
      this.exitFullscreenCalls += 1;
      return Promise.resolve();
    },
    ...overrides
  };
}

/**
 * 创建媒体进度测试会话。
 * 纯函数: 返回新对象并允许覆盖阶段、身份和媒体指标，不修改冻结基线。
 *
 * @param {object} [overrides] MediaPlaybackSessionState 字段覆盖。
 * @returns {object} 进度协调器可消费的完整稳定会话。
 */
function createProgressSession(overrides = {}) {
  return {
    ...VALID_MEDIA_SESSION,
    phase: MEDIA_PLAYBACK_PHASE.playing,
    playedSeconds: 0,
    durationSeconds: 120,
    bufferedSeconds: 12,
    ...overrides
  };
}

/**
 * 创建可观察用户内容写端口。
 * 纯函数: 每次返回隔离记录数组和两个假写函数，不访问真实 store 或 IndexedDB。
 *
 * @returns {object} currentPlayingWrites、historyWrites、updateCurrentPlaying 和 upsertPlayHistory。
 */
function createProgressPort() {
  // 类型: Array<object|null>；作用: 记录协调器同步 currentPlaying 写入和清空顺序。
  const currentPlayingWrites = [];
  // 类型: Array<object>；作用: 记录协调器实际触发的长期历史载荷和顺序。
  const historyWrites = [];
  return {
    currentPlayingWrites,
    historyWrites,
    /**
     * 记录 currentPlaying 写入。
     * 副作用: 把隔离对象或 null 追加到当前夹具数组。
     *
     * @param {object|null} value 当前播放摘要或清空值。
     * @returns {object|null} 隔离后的采用值。
     */
    updateCurrentPlaying(value) {
      // 类型: object|null；作用: 隔离协调器输入，避免后续修改影响已经记录的断言事实。
      const savedValue = value ? structuredClone(value) : null;
      currentPlayingWrites.push(savedValue);
      return savedValue;
    },
    /**
     * 记录播放历史事务。
     * 副作用: 把隔离载荷追加到当前夹具数组并返回已完成 Promise。
     * 成功路径: resolve 当前隔离载荷；失败路径: 无，失败注入由独立用例覆盖端口。
     *
     * @param {object} payload 播放历史写入载荷。
     * @returns {Promise<object>} 模拟 Repository 提交结果。
     */
    upsertPlayHistory(payload) {
      // 类型: object；作用: 隔离协调器输入并作为本次模拟提交结果。
      const savedPayload = structuredClone(payload);
      historyWrites.push(savedPayload);
      return Promise.resolve(savedPayload);
    }
  };
}

/**
 * 模拟 xgplayer 插件挂载根节点。
 * 状态所有权: attributes、listeners 和 removedListeners 只属于当前测试实例。
 * 资源边界: 不访问真实 DOM；add/remove 方法记录插件生命周期副作用。
 */
class FakePluginRoot {
  /**
   * 创建空插件根节点夹具。
   * 副作用: 初始化属性和监听记录集合。
   */
  constructor() {
    this.attributes = new Map();
    this.listeners = new Map();
    this.removedListeners = new Map();
  }

  /**
   * 记录根节点属性。
   * 副作用: 写入当前夹具 attributes。
   *
   * @param {string} name 属性名称。
   * @param {string} value 属性值。
   * @returns {void} 无返回业务数据。
   */
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  /**
   * 记录事件监听绑定。
   * 副作用: 写入当前夹具 listeners。
   *
   * @param {string} type 事件类型。
   * @param {Function} listener 事件处理器。
   * @returns {void} 无返回业务数据。
   */
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  /**
   * 记录事件监听移除。
   * 副作用: 写入 removedListeners 并从 listeners 删除同类型监听。
   *
   * @param {string} type 事件类型。
   * @param {Function} listener 待移除处理器。
   * @returns {void} 无返回业务数据。
   */
  removeEventListener(type, listener) {
    this.removedListeners.set(type, listener);
    this.listeners.delete(type);
  }
}

/**
 * 模拟动态加载的 xgplayer BasePlugin。
 * 状态所有权: player 与 config 来自单个插件实例构造参数。
 */
class FakeBasePlugin {
  /**
   * 采用 xgplayer 插件构造上下文。
   * 副作用: 把 player 和 config 保存到当前实例，供派生插件生命周期读取。
   *
   * @param {object} context 插件构造上下文。
   * @param {object} context.player 最小播放器夹具。
   * @param {object} context.config projectShortcut 配置。
   */
  constructor({ player, config }) {
    this.player = player;
    this.config = config;
  }
}

// 测试目的: MP4 与 HLS 单媒体只有满足浏览器直连契约时才能进入播放器。
test('已解析媒体只采用浏览器直连 MP4 与 HLS', () => {
  // 类型: object；作用: 标准化直连 MP4 基线并检查返回引用隔离与冻结状态。
  const mp4Media = normalizeMediaPlaybackMedia({ ...VALID_MP4_MEDIA });
  // 断言: 有效 MP4 必须保留 direct 交付和 URL。
  assert.equal(mp4Media.deliveryMode, 'direct');
  assert.equal(mp4Media.url, VALID_MP4_MEDIA.url);
  assert.equal(Object.isFrozen(mp4Media), true);

  // 类型: object；作用: 把相同媒体切换成 HLS，验证官方 HLS 路径需要的类型可以通过契约。
  const hlsMedia = normalizeMediaPlaybackMedia({
    ...VALID_MP4_MEDIA,
    type: 'hls',
    url: 'https://media.example.test/master.m3u8'
  });
  // 断言: HLS 类型和 m3u8 URL 必须原样保留给适配层，不转换成媒体代理地址。
  assert.equal(hlsMedia.type, 'hls');
  assert.equal(hlsMedia.url, 'https://media.example.test/master.m3u8');
});

// 测试目的: 代理、未知类型、嵌入凭据和契约外请求头必须明确失败关闭。
test('媒体线路拒绝代理、请求头、未知类型和嵌入凭据', () => {
  // 断言: 非 direct 交付不能静默回退项目后端代理。
  assert.throws(
    () => normalizeMediaPlaybackMedia({ ...VALID_MP4_MEDIA, deliveryMode: 'proxy' }),
    MediaPlaybackValidationError
  );
  // 断言: unknown 类型不能根据扩展名猜测成 MP4。
  assert.throws(
    () => normalizeMediaPlaybackMedia({ ...VALID_MP4_MEDIA, type: 'unknown' }),
    MediaPlaybackValidationError
  );
  // 断言: URL 内嵌用户名和密码违反直连安全边界。
  assert.throws(
    () => normalizeMediaPlaybackMedia({ ...VALID_MP4_MEDIA, url: 'https://user:secret@media.example.test/video.mp4' }),
    MediaPlaybackValidationError
  );
  // 断言: headers 是契约外字段，不能重新进入 ContentItem 播放结构。
  assert.throws(
    () => normalizeMediaPlaybackMedia({ ...VALID_MP4_MEDIA, headers: { Referer: 'https://source.example.test/' } }),
    MediaPlaybackValidationError
  );
});

// 测试目的: 单媒体对象不能重新夹带播放目录的线路状态和身份字段。
test('已解析媒体拒绝空地址和播放目录线路字段', () => {
  // 断言: 空 URL 不是已经解析成功的媒体，必须失败关闭。
  assert.throws(
    () => normalizeMediaPlaybackMedia({ ...VALID_MP4_MEDIA, url: '' }),
    MediaPlaybackValidationError
  );
  // 断言: available/unavailableReason 属于 PlayCatalogLine，不能进入 playback.media。
  assert.throws(
    () => normalizeMediaPlaybackMedia({
      ...VALID_MP4_MEDIA,
      available: false,
      unavailableReason: '不可用'
    }),
    MediaPlaybackValidationError
  );
  // 断言: lineId 和 episodeId 由 playback 外壳表达，不能复制进 media 形成第二身份权威。
  assert.throws(
    () => normalizeMediaPlaybackMedia({ ...VALID_MP4_MEDIA, lineId: 'line-main', episodeId: 'episode-1' }),
    MediaPlaybackValidationError
  );
});

// 测试目的: 稳定媒体会话必须隔离第三方对象并保持阶段与错误字段一致。
test('媒体会话校验阶段、秒数和错误组合', () => {
  // 类型: object；作用: 标准化正常播放会话并验证冻结输出。
  const playingSession = normalizeMediaPlaybackSession({ ...VALID_MEDIA_SESSION });
  // 断言: 正常阶段保留真实播放秒数且不携带错误。
  assert.equal(playingSession.playedSeconds, 25);
  assert.equal(playingSession.errorCode, '');
  assert.equal(Object.isFrozen(playingSession), true);

  // 类型: object；作用: 构造具备稳定错误码和安全说明的媒体失败会话。
  const failedSession = normalizeMediaPlaybackSession({
    ...VALID_MEDIA_SESSION,
    phase: MEDIA_PLAYBACK_PHASE.error,
    errorCode: 'MEDIA_PLAYBACK_FAILED',
    errorMessage: '媒体加载失败'
  });
  // 断言: 失败阶段必须完整保留项目稳定错误字段。
  assert.equal(failedSession.phase, MEDIA_PLAYBACK_PHASE.error);
  assert.equal(failedSession.errorCode, 'MEDIA_PLAYBACK_FAILED');
  // 断言: 普通阶段夹带错误、失败阶段缺失错误和负秒数都必须失败关闭。
  assert.throws(
    () => normalizeMediaPlaybackSession({ ...VALID_MEDIA_SESSION, errorCode: 'ERROR', errorMessage: '错误' }),
    MediaPlaybackValidationError
  );
  assert.throws(
    () => normalizeMediaPlaybackSession({ ...VALID_MEDIA_SESSION, phase: MEDIA_PLAYBACK_PHASE.error }),
    MediaPlaybackValidationError
  );
  assert.throws(
    () => normalizeMediaPlaybackSession({ ...VALID_MEDIA_SESSION, playedSeconds: -1 }),
    MediaPlaybackValidationError
  );
  // 断言: 非 idle 事件缺少播放线路身份时不能进入后续历史提交链。
  assert.throws(
    () => normalizeMediaPlaybackSession({ ...VALID_MEDIA_SESSION, playbackSourceId: '' }),
    MediaPlaybackValidationError
  );
});

// 测试目的: 默认快捷键、组合键和冲突检测必须由项目配置统一决定。
test('快捷键偏好支持默认值、组合键和冲突失败关闭', () => {
  // 类型: object；作用: 创建项目默认偏好并验证核心播放键位。
  const defaults = createDefaultPlaybackShortcutPreferences();
  // 类型: object|null；作用: 查找空格键对应的默认播放切换命令。
  const togglePlayBinding = findPlaybackShortcutBinding(defaults, createKeyboardEvent());
  // 断言: 默认空格键必须由项目映射为 togglePlay。
  assert.equal(togglePlayBinding?.action, PLAYBACK_SHORTCUT_ACTION.togglePlay);

  // 类型: object；作用: 构造一个 Ctrl+Shift+KeyK 组合键偏好并验证修饰符排序不影响匹配。
  const customPreferences = normalizePlaybackShortcutPreferences({
    schemaVersion: '1.0.0',
    bindings: [{
      action: PLAYBACK_SHORTCUT_ACTION.toggleMute,
      key: 'KeyK',
      modifiers: ['shift', 'control'],
      enabled: true
    }]
  });
  // 断言: 同时按下 Ctrl 和 Shift 时必须命中项目静音命令。
  assert.equal(
    findPlaybackShortcutBinding(customPreferences, createKeyboardEvent({ code: 'KeyK', ctrlKey: true, shiftKey: true }))?.action,
    PLAYBACK_SHORTCUT_ACTION.toggleMute
  );
  // 断言: 同一启用组合不能同时绑定多个命令。
  assert.throws(() => normalizePlaybackShortcutPreferences({
    schemaVersion: '1.0.0',
    bindings: [
      { action: PLAYBACK_SHORTCUT_ACTION.togglePlay, key: 'Space', modifiers: [], enabled: true },
      { action: PLAYBACK_SHORTCUT_ACTION.toggleMute, key: 'Space', modifiers: [], enabled: true }
    ]
  }), PlaybackShortcutValidationError);
});

// 测试目的: 快捷键设置必须先初始化，保存严格串行，并且只采用 Repository 已提交结果。
test('快捷键设置服务按 Repository-first FIFO 保存并恢复默认', async () => {
  // 类型: object；作用: 保存测试用户身份和当前已提交快捷键投影。
  const state = {
    preferences: null,
    saving: false,
    errorMessage: ''
  };
  // 类型: Array<object>；作用: 按 Repository 实际开始事务的顺序记录候选，验证 FIFO 不并发越过前项。
  const saveCalls = [];
  // 类型: Function|null；生命周期: 首项保存进入 Repository 后赋值；作用: 由测试显式释放首项事务。
  let releaseFirstSave = null;
  // 类型: Promise<void>；作用: 阻塞首项 Repository 保存，让第二项只能停留在 service 队列。
  const firstSaveBarrier = new Promise((resolve) => {
    releaseFirstSave = resolve;
  });
  // 类型: object；作用: 模拟只提供快捷键读写的持久化窄端口，不建立备用业务规则。
  const repository = {
    /**
     * 读取首次默认快捷键偏好。
     * 纯函数: 每次返回新的默认对象，不修改测试状态。
     * 成功路径: 立即 resolve 合法偏好；失败路径: 无。
     *
     * @returns {Promise<object>} 默认 ShortcutPreferences。
     */
    async loadShortcutPreferences() {
      return structuredClone(createDefaultPlaybackShortcutPreferences());
    },
    /**
     * 保存快捷键偏好测试候选。
     * 副作用: 记录事务开始顺序；第一项等待显式屏障，后续项立即返回隔离副本。
     * 成功路径: 返回与候选相同的已提交对象；失败路径: KeyE 候选注入固定失败。
     *
     * @param {string} userId 当前设置归属用户。
     * @param {object} preferences 已校验快捷键候选。
     * @returns {Promise<object>} 已提交偏好。
     */
    async saveShortcutPreferences(userId, preferences) {
      saveCalls.push({ userId, preferences: structuredClone(preferences) });
      // 条件分支: 当前是首项保存时进入；执行内容: 等待测试释放，证明第二项不能提前调用 Repository。
      if (saveCalls.length === 1) await firstSaveBarrier;
      // 条件分支: 候选首条键位为 KeyE 时进入。
      // 执行内容: 注入固定 Repository reject，验证 service 保留旧投影并继续后续 FIFO。
      if (preferences.bindings[0].key === 'KeyE') throw new Error('injected shortcut save failure');
      return structuredClone(preferences);
    }
  };
  // 类型: object；作用: 模拟 Vue Store 的窄状态端口，只允许 service 采用已提交对象和交互状态。
  const statePort = {
    state,
    /**
     * 采用已提交偏好。
     * 副作用: 替换测试投影 preferences。
     *
     * @param {object} preferences Repository 已提交偏好。
     * @returns {object} 当前隔离投影。
     */
    replacePreferences(preferences) {
      state.preferences = structuredClone(preferences);
      return state.preferences;
    },
    /**
     * 更新保存状态。
     * 副作用: 替换测试投影 saving Boolean。
     *
     * @param {boolean} saving true 表示队列未空，false 表示全部收敛。
     * @returns {boolean} 当前状态。
     */
    setSaving(saving) {
      state.saving = saving;
      return state.saving;
    },
    /**
     * 更新安全错误。
     * 副作用: 替换测试投影 errorMessage。
     *
     * @param {string} message 用户错误说明。
     * @returns {string} 当前说明。
     */
    setError(message) {
      state.errorMessage = message;
      return state.errorMessage;
    }
  };
  // 类型: object；作用: 创建与应用相同队列语义的隔离快捷键设置服务。
  const service = createShortcutSettingsService({
    repository,
    statePort,
    /**
     * 返回测试用户身份。
     * 纯函数: 不修改用户或设置状态。
     *
     * @returns {string} 固定本地用户 id。
     */
    getUserId() {
      return 'shortcut-test-user';
    }
  });
  await service.initialize();

  // 类型: object；作用: 创建首项自定义组合键候选。
  const firstPreferences = structuredClone(state.preferences);
  firstPreferences.bindings[0].key = 'KeyQ';
  firstPreferences.bindings[0].modifiers = ['control'];
  // 类型: object；作用: 创建第二项候选，最终投影必须采用这一最新提交值。
  const secondPreferences = structuredClone(state.preferences);
  secondPreferences.bindings[0].key = 'KeyW';
  secondPreferences.bindings[0].modifiers = ['control'];
  // 类型: Promise<object>；作用: 保存首项事务结果；屏障释放前保持 pending。
  const firstSave = service.save(firstPreferences);
  // 类型: Promise<object>；作用: 保存第二项事务结果；必须等待首项收敛后才进入 Repository。
  const secondSave = service.save(secondPreferences);
  await Promise.resolve();
  assert.equal(saveCalls.length, 1);
  assert.equal(state.saving, true);
  releaseFirstSave();
  await Promise.all([firstSave, secondSave]);
  assert.deepEqual(saveCalls.map(call => call.preferences.bindings[0].key), ['KeyQ', 'KeyW']);
  assert.equal(state.preferences.bindings[0].key, 'KeyW');
  assert.equal(state.saving, false);

  // 类型: object；作用: 构造失败事务，验证旧投影和后续队列能力。
  const failingPreferences = structuredClone(state.preferences);
  failingPreferences.bindings[0].key = 'KeyE';
  await assert.rejects(service.save(failingPreferences), /injected shortcut save failure/);
  assert.equal(state.preferences.bindings[0].key, 'KeyW');
  // 类型: object；作用: 保存失败后通过同一 FIFO 提交的项目默认偏好。
  const restoredPreferences = await service.restoreDefaults();
  assert.deepEqual(restoredPreferences, structuredClone(createDefaultPlaybackShortcutPreferences()));
  assert.equal(state.errorMessage, '');
});

// 测试目的: 表单、可编辑区域和输入法组合期间必须保留原始键盘行为。
test('快捷键排除输入区域和输入法组合事件', () => {
  // 类型: object；作用: 模拟 closest 命中输入控件的事件 target。
  const editableTarget = {
    /**
     * 模拟 DOM closest 匹配。
     * 纯函数: 始终返回当前夹具，表示按键来自可编辑区域。
     *
     * @returns {object} 当前可编辑目标。
     */
    closest() {
      return editableTarget;
    }
  };
  // 断言: 输入框来源事件必须由控件处理。
  assert.equal(shouldIgnorePlaybackShortcut(createKeyboardEvent({ target: editableTarget })), true);
  // 断言: 输入法组合期间即使 target 为空也必须忽略播放器快捷键。
  assert.equal(shouldIgnorePlaybackShortcut(createKeyboardEvent({ isComposing: true })), true);
  // 断言: 普通播放器 root 事件允许进入项目匹配。
  assert.equal(shouldIgnorePlaybackShortcut(createKeyboardEvent()), false);
});

// 测试目的: 基础媒体命令只修改播放器，分集命令只委托页面回调。
test('快捷键命令分派播放器能力和页面分集能力', () => {
  // 类型: object；作用: 创建暂停状态播放器，验证 togglePlay 调用公开 play 方法。
  const player = createPlayerCommandFixture();
  // 断言: 播放切换命令被接受且只调用一次 play。
  assert.equal(executePlaybackShortcutAction(player, PLAYBACK_SHORTCUT_ACTION.togglePlay), true);
  assert.equal(player.playCalls, 1);

  // 副作用: 执行前进命令，目标秒数必须使用集中步长且不超过时长。
  executePlaybackShortcutAction(player, PLAYBACK_SHORTCUT_ACTION.seekForward);
  // 断言: 默认 20 秒应前进到 30 秒。
  assert.equal(player.currentTime, 30);
  // 副作用: 执行静音切换命令。
  executePlaybackShortcutAction(player, PLAYBACK_SHORTCUT_ACTION.toggleMute);
  // 断言: 静音状态必须被反转。
  assert.equal(player.muted, true);

  // 类型: Array<string>；作用: 记录页面回调收到的分集命令，验证插件不直接读取路由或分集数组。
  const pageCommands = [];
  // 副作用: 把下一集命令委托页面回调。
  executePlaybackShortcutAction(player, PLAYBACK_SHORTCUT_ACTION.nextEpisode, action => pageCommands.push(action));
  // 断言: 页面只收到标准 nextEpisode 命令。
  assert.deepEqual(pageCommands, [PLAYBACK_SHORTCUT_ACTION.nextEpisode]);
});

// 测试目的: 项目插件只绑定播放器 root，命中后拦截事件，并在销毁时移除同一处理器。
test('项目快捷键插件完整绑定、执行和销毁 root 监听', () => {
  // 类型: Function；作用: 使用假 BasePlugin 创建不静态依赖 xgplayer 的项目插件类。
  const ProjectShortcutPlugin = createProjectShortcutPlugin(FakeBasePlugin);
  // 类型: FakePluginRoot；作用: 记录插件生命周期对播放器 root 的全部副作用。
  const root = new FakePluginRoot();
  // 类型: object；作用: 提供插件执行 togglePlay 所需的最小播放器接口和 root。
  const player = createPlayerCommandFixture({ root });
  // 类型: object；作用: 创建当前播放器实例的项目插件并注入默认快捷键偏好。
  const plugin = new ProjectShortcutPlugin({
    player,
    config: { preferences: createDefaultPlaybackShortcutPreferences(), onPageCommand: null }
  });

  // 副作用: 模拟 xgplayer 在实例创建后调用插件生命周期。
  plugin.afterCreate();
  // 断言: 插件 root 必须可聚焦并只绑定一个 keydown 处理器。
  assert.equal(root.attributes.get('tabindex'), '0');
  assert.equal(typeof root.listeners.get('keydown'), 'function');

  // 类型: object；作用: 记录命中快捷键后是否阻止默认行为和事件冒泡。
  const eventEffects = { prevented: 0, stopped: 0 };
  // 类型: object；作用: 创建空格键事件并附加可观察的浏览器事件副作用方法。
  const keyboardEvent = createKeyboardEvent({
    /**
     * 记录默认行为阻止。
     * 副作用: 增加当前测试事件的 prevented 次数。
     *
     * @returns {void} 无返回业务数据。
     */
    preventDefault() {
      eventEffects.prevented += 1;
    },
    /**
     * 记录事件冒泡阻止。
     * 副作用: 增加当前测试事件的 stopped 次数。
     *
     * @returns {void} 无返回业务数据。
     */
    stopPropagation() {
      eventEffects.stopped += 1;
    }
  });
  // 副作用: 调用 root 保存的真实插件处理器模拟用户按键。
  root.listeners.get('keydown')(keyboardEvent);
  // 断言: 命中 togglePlay 后执行播放器命令并阻止事件继续传播。
  assert.equal(player.playCalls, 1);
  assert.deepEqual(eventEffects, { prevented: 1, stopped: 1 });

  // 类型: Function；作用: 保存插件实际绑定的处理器引用，验证销毁移除的是同一函数。
  const boundHandler = root.listeners.get('keydown');
  // 副作用: 模拟 xgplayer 销毁项目插件。
  plugin.destroy();
  // 断言: destroy 必须移除同一 keydown 处理器并释放内部引用。
  assert.equal(root.removedListeners.get('keydown'), boundHandler);
  assert.equal(root.listeners.has('keydown'), false);
  assert.equal(plugin.handleKeydown, null);
});

// 测试目的: 首次播放立即建历史，后续只在集中检查点或前后拖动跨检查点时提交。
test('媒体进度协调器按检查点提交自然播放和拖动进度', async () => {
  // 类型: object；作用: 记录 currentPlaying 和历史写入，反证 timeupdate 没有逐次写库。
  const port = createProgressPort();
  // 类型: number；生命周期: 当前用例；作用: 为每次真实提交生成可区分时间。
  let clockIndex = 0;
  /**
   * 生成确定性媒体保存时间。
   * 副作用: 递增当前用例时钟序号。
   *
   * @returns {string} 当前测试 ISO 时间。
  */
  function now() {
    // 类型: string；作用: 在递增序号前生成当前事务可断言的确定 ISO 时间。
    const timestamp = `2026-07-21T10:00:${String(clockIndex).padStart(2, '0')}.000Z`;
    clockIndex += 1;
    return timestamp;
  }
  // 类型: object；作用: 创建只绑定假 userContentService 端口的页面级进度协调器。
  const service = createMediaPlaybackProgressService({
    now,
    updateCurrentPlaying: port.updateCurrentPlaying,
    upsertPlayHistory: port.upsertPlayHistory
  });

  // 副作用: 首次 playing 即使是 0 秒也必须建立可恢复历史。
  await service.handleSession(createProgressSession({ playedSeconds: 0 }), VALID_PROGRESS_CONTEXT);
  // 副作用: 5 秒未达到集中 10 秒检查点，不应创建事务。
  await service.handleSession(createProgressSession({ playedSeconds: 5 }), VALID_PROGRESS_CONTEXT);
  // 副作用: 10 秒达到检查点，提交第二条历史候选。
  await service.handleSession(createProgressSession({ playedSeconds: 10 }), VALID_PROGRESS_CONTEXT);
  // 副作用: 向前拖动到 25 秒，相对上次点变化 15 秒，提交真实 seek 后位置。
  await service.handleSession(createProgressSession({ playedSeconds: 25 }), VALID_PROGRESS_CONTEXT);
  // 副作用: 向后拖动到 3 秒，绝对变化超过检查点，同样提交以保证刷新恢复准确。
  await service.handleSession(createProgressSession({ playedSeconds: 3 }), VALID_PROGRESS_CONTEXT);

  // 断言: 只有 0、10、25、3 四个检查点写历史，5 秒 timeupdate 被过滤。
  assert.deepEqual(port.historyWrites.map(record => record.playedSeconds), [0, 10, 25, 3]);
  // 断言: 全部检查点使用 playing，且 currentPlaying 与历史共用最后真实秒数。
  assert.equal(port.historyWrites.every(record => record.playStatus === 'playing'), true);
  assert.equal(port.currentPlayingWrites.at(-1).playedSeconds, 3);
  assert.equal(port.currentPlayingWrites.at(-1).updatedAt, port.historyWrites.at(-1).lastPlayedAt);
});

// 测试目的: pause、ended 和组件释放强制提交，但相同最终快照不得重复写历史。
test('媒体进度协调器提交暂停结束并幂等终结会话', async () => {
  // 类型: object；作用: 观察两个独立协调会话的最终状态和清理顺序。
  const port = createProgressPort();
  // 类型: object；作用: 创建使用固定时钟的首个暂停场景协调器。
  const pausedService = createMediaPlaybackProgressService({
    /**
     * 返回暂停场景固定时间。
     * 纯函数: 不修改外部状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T11:00:00.000Z';
    },
    updateCurrentPlaying: port.updateCurrentPlaying,
    upsertPlayHistory: port.upsertPlayHistory
  });
  // 副作用: 建立 playing 历史后在 4 秒暂停，未达到检查点也必须强制保存 paused。
  await pausedService.handleSession(createProgressSession({ playedSeconds: 0 }), VALID_PROGRESS_CONTEXT);
  // 类型: object；作用: 保存暂停最终快照，供普通事件和释放事件复用。
  const pausedSession = createProgressSession({ phase: MEDIA_PLAYBACK_PHASE.paused, playedSeconds: 4 });
  await pausedService.handleSession(pausedSession, VALID_PROGRESS_CONTEXT);
  await pausedService.finalize(pausedSession);
  // 断言: 暂停和随后释放的同秒快照只产生一次 paused 历史，释放清空 currentPlaying。
  assert.deepEqual(port.historyWrites.map(record => record.playStatus), ['playing', 'paused']);
  assert.equal(port.currentPlayingWrites.at(-1), null);

  // 类型: object；作用: 创建独立结束场景协调器，验证 finished 状态和终态清理。
  const endedService = createMediaPlaybackProgressService({
    /**
     * 返回结束场景固定时间。
     * 纯函数: 不修改外部状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T11:10:00.000Z';
    },
    updateCurrentPlaying: port.updateCurrentPlaying,
    upsertPlayHistory: port.upsertPlayHistory
  });
  await endedService.handleSession(createProgressSession({ playedSeconds: 100 }), VALID_PROGRESS_CONTEXT);
  // 类型: object；作用: 模拟媒体自然结束时浏览器提供的最终时长和进度。
  const endedSession = createProgressSession({
    phase: MEDIA_PLAYBACK_PHASE.ended,
    playedSeconds: 120,
    durationSeconds: 120
  });
  await endedService.handleSession(endedSession, VALID_PROGRESS_CONTEXT);
  await endedService.finalize(endedSession);
  // 断言: 自然结束只写一条 finished 并保持 currentPlaying 已清空。
  assert.equal(port.historyWrites.filter(record => record.playStatus === 'finished').length, 1);
  assert.equal(port.currentPlayingWrites.at(-1), null);
});

// 测试目的: 新身份必须在旧会话显式终结后才能建立，迟到事件不能反向接管。
test('媒体进度协调器拒绝未终结的其它播放身份', async () => {
  // 类型: object；作用: 记录旧会话最终 paused 和新会话 playing 的事务顺序。
  const port = createProgressPort();
  // 类型: object；作用: 创建使用固定时钟的身份隔离协调器。
  const service = createMediaPlaybackProgressService({
    /**
     * 返回身份隔离固定时间。
     * 纯函数: 不修改外部状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T12:00:00.000Z';
    },
    updateCurrentPlaying: port.updateCurrentPlaying,
    upsertPlayHistory: port.upsertPlayHistory
  });
  await service.handleSession(createProgressSession({ playedSeconds: 15 }), VALID_PROGRESS_CONTEXT);
  // 类型: object；作用: 构造另一内容和线路的完整页面身份。
  const nextContext = {
    ...VALID_PROGRESS_CONTEXT,
    contentId: 'movie-002',
    episodeId: 'episode-2',
    episodeIndex: 2,
    playbackSourceId: 'line-backup'
  };
  // 类型: object；作用: 构造与 nextContext 一致的新媒体事件。
  const nextSession = createProgressSession({
    contentId: 'movie-002',
    episodeId: 'episode-2',
    episodeIndex: 2,
    playbackSourceId: 'line-backup',
    playedSeconds: 0
  });
  // 断言: 旧会话仍活动时，新身份或迟到事件不能隐式替换协调器所有权。
  assert.throws(
    () => service.handleSession(nextSession, nextContext),
    MediaPlaybackProgressError
  );
  // 副作用: 路由 watcher 显式终结旧会话后，再采用新身份。
  await service.finalize();
  await service.handleSession(nextSession, nextContext);
  // 断言: 历史顺序固定为旧 playing、旧 paused 最终提交、新 playing。
  assert.deepEqual(
    port.historyWrites.map(record => `${record.contentId}:${record.playStatus}`),
    ['movie-001:playing', 'movie-001:paused', 'movie-002:playing']
  );
  assert.equal(port.currentPlayingWrites.at(-1).contentId, 'movie-002');
});

// 测试目的: 历史失败不回滚检查点，也不在相同 timeupdate 上建立内存补写循环。
test('媒体进度协调器失败后不补写同一检查点', async () => {
  // 类型: object；作用: 复用 currentPlaying 记录能力并覆盖历史端口注入失败。
  const port = createProgressPort();
  // 类型: number；生命周期: 当前用例；作用: 统计协调器实际调用历史端口次数。
  let historyCallCount = 0;
  // 类型: object；作用: 创建历史始终 reject 的协调器，验证失败点去重和后续新检查点能力。
  const service = createMediaPlaybackProgressService({
    /**
     * 返回失败场景固定时间。
     * 纯函数: 不修改外部状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T13:00:00.000Z';
    },
    updateCurrentPlaying: port.updateCurrentPlaying,
    /**
     * 注入历史保存失败。
     * 副作用: 增加调用次数并返回固定 reject，不修改历史记录数组。
     * 成功路径: 无；失败路径: 始终拒绝。
     *
     * @returns {Promise<never>} 固定失败 Promise。
     */
    upsertPlayHistory() {
      historyCallCount += 1;
      return Promise.reject(new Error('injected media history failure'));
    }
  });
  // 断言: 首个 playing 事务失败原样返回页面。
  await assert.rejects(
    service.handleSession(createProgressSession({ playedSeconds: 0 }), VALID_PROGRESS_CONTEXT),
    /injected media history failure/
  );
  // 副作用: 相同 0 秒 timeupdate 再次到达，不应自动补写失败点。
  await service.handleSession(createProgressSession({ playedSeconds: 0 }), VALID_PROGRESS_CONTEXT);
  assert.equal(historyCallCount, 1);
  // 断言: 新的 10 秒检查点仍可以发起独立事务，失败不永久关闭后续保存。
  await assert.rejects(
    service.handleSession(createProgressSession({ playedSeconds: 10 }), VALID_PROGRESS_CONTEXT),
    /injected media history failure/
  );
  assert.equal(historyCallCount, 2);
});

// 测试目的: 后台计划必须严格先处理当前线路其他分集，再为其他线路选择同一逻辑集或首个明确可播放代表项。
test('媒体可达计划保持冻结顺序且不猜测相邻集', () => {
  // 类型: object；作用: 构造当前线路、同集线路、缺集回退线路和结构不可用线路的标准目录。
  const playCatalog = {
    lines: [
      {
        id: 'line-main',
        available: true,
        episodes: [
          { id: 'episode-1', episodeNumber: 1, playable: true },
          { id: 'episode-2', episodeNumber: 2, playable: true },
          { id: 'episode-3', episodeNumber: 3, playable: true }
        ]
      },
      {
        id: 'line-same',
        available: true,
        episodes: [
          { id: 'episode-2', episodeNumber: 2, playable: true },
          { id: 'episode-4', episodeNumber: 4, playable: true }
        ]
      },
      {
        id: 'line-fallback',
        available: true,
        episodes: [
          { id: 'episode-1', episodeNumber: 1, playable: false },
          { id: 'episode-7', episodeNumber: 7, playable: true }
        ]
      },
      {
        id: 'line-disabled',
        available: false,
        episodes: [{ id: 'episode-2', episodeNumber: 2, playable: true }]
      }
    ]
  };
  // 类型: Array<Readonly<object>>；作用: 以第二集作为当前正式媒体生成完整后台计划。
  const plan = createMediaReachabilityProbePlan(playCatalog, {
    sourceId: 'source-a',
    contentId: 'series-001',
    lineId: 'line-main',
    episodeId: 'episode-2'
  });

  // 断言: 当前线路除当前集外保持 Provider 顺序；其他线路优先同集，缺集时只取首个明确 playable，禁用线路不进入计划。
  assert.deepEqual(
    plan.map(target => `${target.lineId}:${target.episodeId}:${target.representsLine}`),
    [
      'line-main:episode-1:false',
      'line-main:episode-3:false',
      'line-same:episode-2:true',
      'line-fallback:episode-7:true'
    ]
  );
  // 断言: 精确键由四段身份共同决定，同一分集在不同线路不能碰撞。
  assert.notEqual(createMediaReachabilityKey(plan[0]), createMediaReachabilityKey(plan[2]));
});

// 测试目的: 协调器必须把全部待处理目标先投影为 checking，并在同一时刻最多执行一个真实媒体探测。
test('媒体可达协调器严格单任务串行并区分真实终态与不可判定', async () => {
  // 类型: Array<object>；作用: 构造四条顺序目标，覆盖可达、不可达、异常不可判定和后续继续执行。
  const targets = ['episode-1', 'episode-2', 'episode-3', 'episode-4'].map((episodeId, index) => ({
    sourceId: 'source-a',
    contentId: 'series-001',
    lineId: 'line-main',
    episodeId,
    episodeIndex: index + 1,
    representsLine: false
  }));
  // 类型: number；生命周期: 当前用例；作用: 统计当前同时在途探测数量。
  let activeProbeCount = 0;
  // 类型: number；生命周期: 当前用例；作用: 保存观察到的最大并发，必须保持一。
  let maximumProbeCount = 0;
  // 类型: Array<string>；作用: 记录真实探测开始顺序。
  const probeOrder = [];
  // 类型: Array<string>；作用: 记录 checking 和最终红绿状态采用顺序。
  const statusEvents = [];
  // 类型: Array<string>；作用: 记录不能形成媒体结论且只能撤销 checking 的精确目标。
  const inconclusiveTargets = [];
  // 类型: object；作用: 注入可观察异步端口创建隔离协调器。
  const coordinator = createMediaReachabilityCoordinator({
    /**
     * 模拟一次异步真实媒体探测。
     * 副作用: 记录并发和开始顺序；第二集返回不可达，第三集抛出基础设施异常。
     * 成功路径: 第一、四集返回可达，第二集返回可归属不可达。
     * 失败路径: 第三集 reject 由协调器收敛为不可判定，不能写红且队列继续。
     *
     * @param {object} target 当前精确媒体目标。
     * @returns {Promise<string>} MEDIA_REACHABILITY_PROBE_RESULT。
     */
    async probeTarget(target) {
      activeProbeCount += 1;
      maximumProbeCount = Math.max(maximumProbeCount, activeProbeCount);
      probeOrder.push(target.episodeId);
      await Promise.resolve();
      activeProbeCount -= 1;
      // 条件分支: 第三集模拟 Provider/基础设施 reject 时进入；执行内容: 验证协调器不会误写红色。
      if (target.episodeId === 'episode-3') throw new Error('模拟不可判定失败');
      return target.episodeId === 'episode-2'
        ? MEDIA_REACHABILITY_PROBE_RESULT.unavailable
        : MEDIA_REACHABILITY_PROBE_RESULT.available;
    },
    /**
     * 记录协调器状态采用。
     * 副作用: 追加精确分集和三态文本。
     *
     * @param {object} target 当前媒体目标。
     * @param {string} status 三态结果。
     * @returns {void} 记录完成后结束。
     */
    onStatusChange(target, status) {
      statusEvents.push(`${target.episodeId}:${status}`);
    },
    /**
     * 记录不可判定目标。
     * 副作用: 只追加 episodeId，模拟页面撤销对应 checking。
     *
     * @param {object} target 当前精确媒体目标。
     * @returns {void} 记录完成后结束。
     */
    onInconclusive(target) {
      inconclusiveTargets.push(target.episodeId);
    },
    /**
     * 接收当前用例没有待取消目标的初始化回调。
     * 纯函数: 不修改测试状态。
     *
     * @returns {void} 回调结束。
     */
    onCancel() {}
  });

  // 类型: string；作用: 等待全部顺序目标完成并取得稳定队列结果。
  const result = await coordinator.start(targets);
  assert.equal(result, MEDIA_REACHABILITY_QUEUE_RESULT.completed);
  assert.equal(maximumProbeCount, 1);
  assert.deepEqual(probeOrder, ['episode-1', 'episode-2', 'episode-3', 'episode-4']);
  assert.deepEqual(statusEvents, [
    `episode-1:${MEDIA_REACHABILITY_STATUS.checking}`,
    `episode-2:${MEDIA_REACHABILITY_STATUS.checking}`,
    `episode-3:${MEDIA_REACHABILITY_STATUS.checking}`,
    `episode-4:${MEDIA_REACHABILITY_STATUS.checking}`,
    `episode-1:${MEDIA_REACHABILITY_STATUS.available}`,
    `episode-2:${MEDIA_REACHABILITY_STATUS.unavailable}`,
    `episode-4:${MEDIA_REACHABILITY_STATUS.available}`
  ]);
  assert.deepEqual(inconclusiveTargets, ['episode-3']);
});

// 测试目的: 用户取消后在途媒体迟到成功不得采用，且队列不能继续启动后续目标。
test('媒体可达协调器取消后忽略迟到结果和后续目标', async () => {
  // 类型: Array<object>；作用: 构造当前在途和下一条尚未开始的两个目标。
  const targets = ['episode-1', 'episode-2'].map((episodeId, index) => ({
    sourceId: 'source-a',
    contentId: 'series-001',
    lineId: 'line-main',
    episodeId,
    episodeIndex: index + 1,
    representsLine: false
  }));
  // 类型: Array<string>；作用: 记录实际开始的目标，取消后只能包含第一项。
  const startedTargets = [];
  // 类型: Array<string>；作用: 记录协调器发布状态，取消后的迟到绿色不得出现。
  const statusEvents = [];
  // 类型: Array<Array<object>>；作用: 记录每次取消回调，最后一项必须包含全部仍为 checking 的目标。
  const cancellationEvents = [];
  // 类型: Function|null；作用: 由测试在取消完成后兑现第一条迟到成功。
  let resolveLateProbe = null;
  // 类型: Function|null；作用: 第一条 probeTarget 开始时兑现 probeStarted，避免在端口调用前取消造成无效断言。
  let markProbeStarted = null;
  // 类型: Promise<void>；作用: 确认第一条 probeTarget 已经开始，再执行取消和迟到结果断言。
  const probeStarted = new Promise((resolve) => {
    markProbeStarted = resolve;
  });
  // 类型: object；作用: 创建首项保持 pending 的协调器以验证代次隔离。
  const coordinator = createMediaReachabilityCoordinator({
    /**
     * 保持第一条媒体探测在途。
     * 副作用: 记录目标、通知测试并保存外部 resolve。
     *
     * @param {object} target 当前媒体目标。
     * @returns {Promise<string>} 由测试稍后兑现的可达结果。
     */
    probeTarget(target) {
      startedTargets.push(target.episodeId);
      markProbeStarted();
      return new Promise((resolve) => {
        resolveLateProbe = resolve;
      });
    },
    /**
     * 记录本轮状态采用。
     * 副作用: 保存分集和三态用于确认迟到成功未发布。
     *
     * @param {object} target 当前媒体目标。
     * @param {string} status 当前状态。
     * @returns {void} 记录完成后结束。
     */
    onStatusChange(target, status) {
      statusEvents.push(`${target.episodeId}:${status}`);
    },
    /**
     * 接收本用例不会采用的不可判定目标。
     * 纯函数: 迟到结果由代次丢弃，不修改测试状态。
     *
     * @returns {void} 回调结束。
     */
    onInconclusive() {},
    /**
     * 记录仍未完成目标。
     * 副作用: 复制数组外壳，避免协调器后续清理影响断言。
     *
     * @param {Array<object>} cancelledTargets 仍为 checking 的目标。
     * @returns {void} 记录完成后结束。
     */
    onCancel(cancelledTargets) {
      cancellationEvents.push(cancelledTargets.slice());
    }
  });

  // 类型: Promise<string>；作用: 启动队列但不等待首项完成。
  const operation = coordinator.start(targets);
  await probeStarted;
  coordinator.cancel();
  resolveLateProbe(MEDIA_REACHABILITY_PROBE_RESULT.available);
  assert.equal(await operation, MEDIA_REACHABILITY_QUEUE_RESULT.cancelled);
  assert.deepEqual(startedTargets, ['episode-1']);
  assert.equal(statusEvents.some(event => event.endsWith(MEDIA_REACHABILITY_STATUS.available)), false);
  assert.deepEqual(
    cancellationEvents.at(-1).map(target => target.episodeId),
    ['episode-1', 'episode-2']
  );
});

// 测试目的: 新后台计划必须等待旧候选真实释放，不能只从 Vue 数组移除后立即创建下一播放器。
test('媒体可达协调器等待取消释放屏障后再启动新目标', async () => {
  // 类型: Array<object>；作用: 提供旧在途目标和替代计划目标，两者使用不同精确分集身份。
  const targets = ['episode-old', 'episode-new'].map((episodeId, index) => ({
    sourceId: 'source-a',
    contentId: 'series-001',
    lineId: 'line-main',
    episodeId,
    episodeIndex: index + 1,
    representsLine: false
  }));
  // 类型: Array<string>；作用: 记录 probeTarget 真正开始顺序，释放前只能出现旧目标。
  const startedTargets = [];
  // 类型: Function|null；作用: 由测试兑现旧探测迟到结果，让旧队列完成代次检查。
  let resolveOldProbe = null;
  // 类型: Function|null；作用: 由测试兑现模拟 Xgplayer/HLS destroy 完成事实。
  let resolveReleaseBarrier = null;
  // 类型: Function|null；作用: 旧探测开始后通知测试可以发出取消和替代计划。
  let markOldProbeStarted = null;
  // 类型: Promise<void>；作用: 阻止用例在协调器进入 probeTarget 前提前取消。
  const oldProbeStarted = new Promise((resolve) => {
    markOldProbeStarted = resolve;
  });
  // 类型: Promise<void>；作用: 模拟父页等待子播放器 disposePlayer 的真实资源释放屏障。
  const releaseBarrier = new Promise((resolve) => {
    resolveReleaseBarrier = resolve;
  });
  // 类型: object；作用: 创建带可控探测与异步取消端口的隔离协调器。
  const coordinator = createMediaReachabilityCoordinator({
    /**
     * 模拟旧目标在途和新目标立即成功。
     * 副作用: 记录启动顺序并保存旧目标 resolve。
     * 成功路径: 新目标返回 available；旧目标由测试显式兑现 available。
     * 失败路径: 当前夹具不 reject，取消只通过协调器代次表达。
     *
     * @param {object} target 当前精确媒体目标。
     * @returns {Promise<string>} 当前目标三类探测结果之一。
     */
    probeTarget(target) {
      startedTargets.push(target.episodeId);
      // 条件分支: 当前是新替代目标时进入；执行内容: 立即返回真实可达模拟结果。
      if (target.episodeId === 'episode-new') {
        return Promise.resolve(MEDIA_REACHABILITY_PROBE_RESULT.available);
      }
      markOldProbeStarted();
      return new Promise((resolve) => {
        resolveOldProbe = resolve;
      });
    },
    /**
     * 接收本用例状态事件。
     * 纯函数: 本用例只验证启动时序，不保存状态。
     *
     * @returns {void} 回调结束。
     */
    onStatusChange() {},
    /**
     * 接收本用例不会形成的不可判定结果。
     * 纯函数: 不修改测试状态。
     *
     * @returns {void} 回调结束。
     */
    onInconclusive() {},
    /**
     * 模拟取消目标对应播放器的异步释放。
     * 副作用: 有未完成目标时返回受测试控制的 releaseBarrier。
     * 成功路径: 空取消立即完成，真实取消等待 resolveReleaseBarrier。
     * 失败路径: 当前夹具不 reject，释放错误由其他领域断言覆盖。
     *
     * @param {Array<object>} cancelledTargets 仍未完成目标。
     * @returns {Promise<void>|void} 候选释放屏障或空取消结果。
     */
    onCancel(cancelledTargets) {
      return cancelledTargets.length > 0 ? releaseBarrier : undefined;
    }
  });

  // 类型: Promise<string>；作用: 启动旧目标并保持其探测在途。
  const oldOperation = coordinator.start([targets[0]]);
  await oldProbeStarted;
  // 类型: Promise<void>；作用: 发出显式取消并捕获旧候选释放屏障。
  const cancellation = coordinator.cancel();
  // 类型: Promise<string>；作用: 立即提交替代计划，协调器必须在 releaseBarrier 前保持不启动。
  const replacementOperation = coordinator.start([targets[1]]);
  resolveOldProbe(MEDIA_REACHABILITY_PROBE_RESULT.available);
  await oldOperation;
  await Promise.resolve();
  assert.deepEqual(startedTargets, ['episode-old']);
  resolveReleaseBarrier();
  await cancellation;
  assert.equal(await replacementOperation, MEDIA_REACHABILITY_QUEUE_RESULT.completed);
  assert.deepEqual(startedTargets, ['episode-old', 'episode-new']);
});

// 测试目的: 播放器依赖必须动态分包，第三方状态所有权关闭，并由最后严格会话覆盖全部释放路径。
test('xgplayer 适配层保持动态加载和项目状态所有权', () => {
  // 断言: xgplayer、HLS 和 CSS 必须全部使用动态 import，非播放页不加载相关 chunk。
  assert.match(PLAYER_COMPONENT_SOURCE, /import\('xgplayer'\)/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /import\('xgplayer-hls'\)/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /import\('xgplayer\/dist\/index\.min\.css'\)/u);
  // 断言: 项目关闭 xgplayer 内置快捷键，避免和可配置项目命令形成双绑定。
  assert.match(PLAYER_COMPONENT_SOURCE, /keyShortcut:\s*false/u);
  // 断言: 第三方 memoryPlay 不能出现，进度保存权威属于 userContentService。
  assert.doesNotMatch(PLAYER_COMPONENT_SOURCE, /memoryPlay/u);
  // 断言: 媒体 URL 配置必须直接使用校验后的线路，不允许拼接代理地址。
  assert.match(PLAYER_COMPONENT_SOURCE, /url:\s*normalizedSource\.url/u);
  // 断言: 候选槽位 active=false 时必须关闭 autoplay；提升 active=true 后只复用当前实例发布会话并调用 play，不重新初始化媒体。
  assert.match(PLAYER_COMPONENT_SOURCE, /autoplay:\s*this\.active\s*&&\s*this\.autoplay/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /active\(isActive\)[\s\S]*?this\.publishSession\(this\.currentPhase,\s*this\._mediaPlayerInstance\)[\s\S]*?this\._mediaPlayerInstance\.play\(\)/u);
  // 断言: xgplayer READY 只表示实例初始化，稳定 ready 只能由真实 CANPLAY 发布，避免 readyState=0 时提前采用线路。
  assert.doesNotMatch(PLAYER_COMPONENT_SOURCE, /player\.on\(events\.READY,\s*createPhasePublisher\(MEDIA_PLAYBACK_PHASE\.ready\)\)/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /player\.on\(events\.CANPLAY,\s*createPhasePublisher\(MEDIA_PLAYBACK_PHASE\.ready\)\)/u);
  // 断言: 已有稳定阶段必须通过单一映射展示连接、就绪和缓冲状态，不能用计时器猜测媒体进度。
  assert.match(PLAYER_COMPONENT_SOURCE, /MEDIA_PHASE_STATUS_MESSAGES[\s\S]*?正在连接媒体[\s\S]*?媒体已就绪[\s\S]*?正在缓冲媒体/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /this\.statusMessage\s*=\s*resolveMediaStatusMessage\(session\.phase,\s*session\.errorMessage\)/u);
  // 断言: 终态错误必须提供显式当前线路重试动作，并复用唯一初始化生命周期。
  assert.match(PLAYER_COMPONENT_SOURCE, /v-if="hasTerminalError"[\s\S]*?@click="retryCurrentSource"/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /retryCurrentSource\(\)\s*\{\s*this\.initializePlayer\(\)/u);
  assert.doesNotMatch(PLAYER_COMPONENT_SOURCE, /setTimeout\s*\(|setInterval\s*\(/u);
  // 断言: 每条已发布严格会话都成为释放兜底，依赖尚未加载完成也不能丢失生命周期交接。
  assert.match(PLAYER_COMPONENT_SOURCE, /this\._lastPublishedMediaSession\s*=\s*session/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /let finalSession\s*=\s*this\._lastPublishedMediaSession\s*\|\|\s*null/u);
  // 断言: 最终事件不依赖 player 实例存在；只要有严格会话就必须在销毁前交给页面。
  assert.match(PLAYER_COMPONENT_SOURCE, /if\s*\(finalSession\)\s*\{\s*this\.\$emit\('session-finalize',\s*finalSession\)/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /this\._lastPublishedMediaSession\s*=\s*null/u);
});

// 测试目的: 公开详情和播放入口必须提供恢复动作，严格请求失败必须复用原 URL 原位重试。
test('详情和播放空入口提供搜索首页与原位重试动作', () => {
  // 断言: 详情入口使用统一空状态说明，并只在严格身份请求失败时显示重试动作。
  assert.match(DETAIL_VIEW_SOURCE, /showDetailEntryActions\s*\|\|\s*showDetailRetryAction/u);
  assert.match(DETAIL_VIEW_SOURCE, /retryDetailContent\(\)[\s\S]*?this\.hasCompleteRouteIdentity[\s\S]*?this\.loadDetailContent\(\)/u);
  assert.match(DETAIL_VIEW_SOURCE, /navigateFromEmptyState\(\{\s*name:\s*'search'\s*\}\)/u);
  assert.match(DETAIL_VIEW_SOURCE, /navigateFromEmptyState\(\{\s*name:\s*'home'\s*\}\)/u);
  // 断言: 播放入口提供同样恢复动作，严格请求阶段显示解析文案并复用唯一 loadPlayerContent 入口重试。
  assert.match(PLAYER_VIEW_SOURCE, /showPlayerRecoveryActions/u);
  assert.match(PLAYER_VIEW_SOURCE, /正在解析播放地址/u);
  assert.match(PLAYER_VIEW_SOURCE, /retryPlayerContent\(\)[\s\S]*?this\.isPlayerEntry[\s\S]*?this\.loadPlayerContent\(\)/u);
  // 断言: 播放主体只由正式或候选媒体槽位驱动；单纯 Store currentKey 变化不能让新内容提前替换旧播放事实。
  assert.match(PLAYER_VIEW_SOURCE, /hasVideo\(\)\s*\{[\s\S]*?return Boolean\(this\.video && this\.mediaSlots\.length > 0\)/u);
  assert.match(PLAYER_VIEW_SOURCE, /return this\.adoptedContentItem \|\| this\.preparingContentItem \|\| getCurrentContentItem\('player'\)/u);
});

// 测试目的: PlayerView 只协调稳定适配组件，不恢复假按钮和模拟历史写入链。
test('播放页使用唯一适配组件和稳定会话入口', () => {
  // 类型: Array<string>；作用: 统计真实模板中的常驻播放元素，避免渲染树注释造成重复匹配。
  const persistentPlayerElements = APP_SOURCE.match(/<PlayerView\s+v-show="isPlayerPage"\s*\/>/gu) || [];
  // 断言: 播放器必须由 App 常驻挂载一次，并在播放路由期间暂停普通 router-view 输出。
  assert.equal(persistentPlayerElements.length, 1);
  assert.match(APP_SOURCE, /<router-view v-if="!isPlayerPage" :key="routeCacheKey" \/>/u);
  // 断言: 播放路由只表达 URL 与布局，不能再次绑定 PlayerView 创建第二个 xgplayer 实例。
  assert.doesNotMatch(ROUTES_SOURCE, /import\s+PlayerView|component:\s*PlayerView/u);
  // 断言: 常驻宿主冷启动在普通路由时不请求，只有首次或真实播放 fullPath 变化才加载内容。
  assert.match(
    PLAYER_VIEW_SOURCE,
    /if\s*\(this\._routeRequestGuard\.shouldHandle\(this\.\$route\)\)\s*\{[\s\S]*?this\.playerRouteContext\s*=\s*createPlayerRouteContext\(this\.\$route\);[\s\S]*?this\.loadPlayerContent\(\);\s*\}/u
  );
  // 断言: 活动媒体路由上下文只在守卫接受播放 URL 时采用；普通路由 params/query 不能驱动媒体 key。
  assert.match(PLAYER_VIEW_SOURCE, /this\.playerRouteContext\s*=\s*createPlayerRouteContext\(this\.\$route\)/u);
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /this\.\$route\.(?:params|query)/u);
  // 断言: 普通路由切换不能通过激活钩子补 play/seek；持续播放来自实例和媒体 DOM 从未卸载。
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /\bactivated\s*\(|\bdeactivated\s*\(/u);
  // 断言: 页面按稳定 slot.id 挂载 XgplayerMediaPlayer，并把普通和最终会话交给槽位分发器区分候选与正式实例。
  assert.match(PLAYER_VIEW_SOURCE, /v-for="slot in mediaSlots"[\s\S]*?:key="slot\.id"/u);
  assert.match(PLAYER_VIEW_SOURCE, /@session-event="handleMediaSlotSessionEvent\(slot\.id, \$event\)"/u);
  assert.match(PLAYER_VIEW_SOURCE, /@session-finalize="handleMediaSlotFinalization\(slot\.id, \$event\)"/u);
  // 断言: 页面使用独立进度协调器决定检查点，不能在事件方法中直接散落历史提交算法。
  assert.match(PLAYER_VIEW_SOURCE, /createMediaPlaybackProgressService/u);
  assert.match(PLAYER_VIEW_SOURCE, /this\._mediaPlaybackProgressService\.handleSession/u);
  // 断言: 个人中心恢复入口必须先请求当前详情目录并解析规范目标，不能把持久化旧线路直接发送给 player。
  assert.match(
    PLAYER_VIEW_SOURCE,
    /const recoveryContext = getUserContentRecoveryContext\(routeContext\.query\)[\s\S]*?pageKey:\s*'detail'[\s\S]*?resolveUserContentRecoveryPlaybackTarget\([\s\S]*?createPlayerRequestParams\(/u
  );
  // 断言: 用户记录重绑定必须晚于目录校验和真实媒体 CANPLAY，失败时不能采用新路由或播放器。
  assert.match(
    PLAYER_VIEW_SOURCE,
    /const candidate = normalizePlaybackCandidate\(response, target\)[\s\S]*?await this\.prepareMediaCandidate\(candidate, resumeState\)[\s\S]*?commitUserContentRecovery\([\s\S]*?await this\.commitAdoptedRoute\(adoptedRouteContext\)[\s\S]*?this\.promotePreparedMediaSlot\(preparedSlotId, candidate, resumeState\)/u
  );
  // 断言: 两阶段交接必须先关闭旧媒体普通事件并用最后稳定会话封存历史。
  assert.match(PLAYER_VIEW_SOURCE, /async finalizeForMediaHandoff\(\)[\s\S]*?this\._isMediaHandoffCommitting\s*=\s*true[\s\S]*?this\._mediaPlaybackProgressService\.finalize\(this\.mediaSessionState\)/u);
  // 断言: 候选恢复完成后必须先等待真实媒体准备，再封存旧历史，并按 Router、同实例提升的固定顺序采用。
  assert.match(PLAYER_VIEW_SOURCE, /const resumeState = await this\.resolveResumeStateForTarget\([\s\S]*?await this\.prepareMediaCandidate\(candidate, resumeState\)[\s\S]*?const finalized = await this\.finalizeForMediaHandoff\(\);[\s\S]*?await this\.commitAdoptedRoute\(adoptedRouteContext\);[\s\S]*?this\.promotePreparedMediaSlot\(preparedSlotId, candidate, resumeState\)/u);
  // 断言: 候选 ready 只兑现准备 Promise；只有 activeMediaSlotId 对应事件可以进入现有历史协调器。
  assert.match(PLAYER_VIEW_SOURCE, /handleMediaSlotSessionEvent\(slotId, session\)[\s\S]*?if \(slotId === this\.activeMediaSlotId\)[\s\S]*?this\.handleMediaSessionEvent\(session\)/u);
  assert.match(PLAYER_VIEW_SOURCE, /session\.phase === MEDIA_PLAYBACK_PHASE\.ready[\s\S]*?task\.resolve\(\{ slotId, session \}\)/u);
  // 断言: CANPLAY 后失效和旧进度提交失败必须进入统一异常清理，不能静默返回并遗留候选槽位或 pending。
  assert.match(PLAYER_VIEW_SOURCE, /if \(!this\.isPreparedMediaSlot\(preparedSlotId\)\) \{[\s\S]*?throw createMediaPreparationError/u);
  assert.match(PLAYER_VIEW_SOURCE, /if \(!finalized\) throw new Error\('旧播放进度保存失败，已保持当前播放'\)[\s\S]*?catch \(error\)[\s\S]*?this\.cancelPendingMediaPreparation/u);
  // 断言: 外部 URL 在候选验证前已经变化时，失败分支必须恢复唯一已采用媒体地址，不能留下新 URL 与旧播放器分裂状态。
  assert.match(
    PLAYER_VIEW_SOURCE,
    /catch \(error\)[\s\S]*?this\.restoreAdoptedRouteAfterCandidateFailure\(\)[\s\S]*?this\.restartCurrentMediaReachabilityPlan\(\)/u
  );
  assert.match(
    PLAYER_VIEW_SOURCE,
    /async restoreAdoptedRouteAfterCandidateFailure\(\)[\s\S]*?visibleRouteContext\.fullPath === adoptedRouteContext\.fullPath[\s\S]*?await this\.commitAdoptedRoute\(adoptedRouteContext\)/u
  );
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /mediaSessionKey\(\)/u);
  // 断言: 封存窗口和旧组件迟到事件都不能重新打开已关闭会话，四段身份必须与当前采用事实完全一致。
  assert.match(PLAYER_VIEW_SOURCE, /if \(this\._isMediaHandoffCommitting\) return;[\s\S]*?session\.sourceId !== this\.video\?\.sourceId[\s\S]*?session\.contentId !== this\.video\?\.id[\s\S]*?session\.episodeId !== this\.playingEpisodeId[\s\S]*?session\.playbackSourceId !== this\.playingLineId/u);
  // 断言: 近尾历史必须在播放器创建前让用户选择重播或继续。
  assert.match(PLAYER_VIEW_SOURCE, /this\.\$confirm\(/u);
  assert.match(PLAYER_VIEW_SOURCE, /confirmButtonText:\s*'重新播放'/u);
  assert.match(PLAYER_VIEW_SOURCE, /cancelButtonText:\s*'继续播放'/u);
  // 断言: 页面不能恢复旧的假播放按钮和手动开始播放方法。
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /player-play-button/u);
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /startPlaybackFromCurrentContext/u);
  // 断言: 页面仍先采用稳定媒体会话，再由同一事件入口驱动进度协调器。
  assert.match(PLAYER_VIEW_SOURCE, /this\.mediaSessionState\s*=\s*session/u);
  // 断言: 真实播放路由仍要求 sourceId 和 videoId 两段身份，不允许把一级入口改成可选参数兼容路径。
  assert.match(ROUTES_SOURCE, /path:\s*'\/player\/:sourceId\/:videoId'/u);
  assert.doesNotMatch(ROUTES_SOURCE, /\/player\/:sourceId\?\/:videoId\?/u);
  // 断言: 独立 `/player` 入口必须拥有自己的命名路由和一级导航定义，不构造内容 params。
  assert.match(ROUTES_SOURCE, /path:\s*'\/player'[\s\S]*?name:\s*'player-entry'[\s\S]*?key:\s*'player'[\s\S]*?label:\s*'播放'/u);
  // 类型: string；作用: 截取严格 player 单条路由源码，验证其只归属一级播放入口而不生成第二个按钮。
  const playerRouteSource = ROUTES_SOURCE.slice(
    ROUTES_SOURCE.indexOf("path: '/player/:sourceId/:videoId'"),
    ROUTES_SOURCE.indexOf("path: '/profile'")
  );
  // 断言: 严格内容路由不声明 meta.nav，避免顶部出现两个播放按钮；topNavName 负责高亮独立入口。
  assert.doesNotMatch(playerRouteSource, /nav:\s*\{/u);
  assert.match(playerRouteSource, /topNavName:\s*'player-entry'/u);
  assert.match(playerRouteSource, /playerLayout:\s*true/u);
  // 断言: 播放一级入口必须被页面识别为有意空状态，并在任何 sourceDataService 调用之前结束加载。
  assert.match(
    PLAYER_VIEW_SOURCE,
    /isPlayerEntry\(\)[\s\S]*?this\.playerRouteContext\?\.routeName\s*===\s*'player-entry'/u
  );
  assert.match(PLAYER_VIEW_SOURCE, /if \(routeContext\?\.routeName === 'player-entry'\)[\s\S]*?return false;[\s\S]*?const response = await requestSourceData/u);
  // 断言: 页面删除 Mock 默认内容和 undefined 占位，并从路由身份构造严格请求参数。
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /DEFAULT_PLAYER_CONTENT_ID|movie-001/u);
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /\|\|\s*undefined/u);
  assert.match(PLAYER_VIEW_SOURCE, /createPlayerRequestParams/u);
  assert.match(PLAYER_VIEW_SOURCE, /sourceId:\s*routeContext\.sourceId/u);
  assert.match(PLAYER_VIEW_SOURCE, /params:\s*requestParams/u);
});

// 测试目的: 媒体探测必须保持播放页会话边界，详情页、内容 Store、历史和普通网络接口都不能获得探测状态所有权。
test('媒体可达实现保持详情隐藏和无持久化候选边界', () => {
  // 类型: number；作用: 定位无 Store 播放候选入口，随后只检查该函数自己的实现区间。
  const candidateRequestStart = SOURCE_DATA_SERVICE_SOURCE.indexOf(
    'export async function requestSourceDataCandidate'
  );
  // 类型: number；作用: 使用下一个后台内容入口作为候选函数结束边界。
  const candidateRequestEnd = SOURCE_DATA_SERVICE_SOURCE.indexOf(
    'export async function requestSourceContentItem',
    candidateRequestStart
  );
  // 类型: string；作用: 隔离候选请求实现，避免文件其他正式页面入口的 Store 调用干扰断言。
  const candidateRequestSource = SOURCE_DATA_SERVICE_SOURCE.slice(
    candidateRequestStart,
    candidateRequestEnd
  );
  // 断言: 后台 player 候选必须存在且不能创建页面事务、提交页面桶或采用内容实体。
  assert.ok(candidateRequestStart >= 0 && candidateRequestEnd > candidateRequestStart);
  assert.doesNotMatch(
    candidateRequestSource,
    /beginSourceDataRequest|resolveSourceDataRequestTransaction|commitSourceDataResponse|commitSourceContentItem/u
  );
  // 断言: 后台单目标 Provider 或媒体候选失败没有整源健康副作用；前台页面请求继续由自己的事务窗口触发复检。
  assert.doesNotMatch(
    candidateRequestSource,
    /refreshFailedSourceHealth|sourceManagementRuntimeInstance\.checkSource|shouldRefreshHealthOnFailure/u
  );

  // 断言: 详情页不启用状态显示；播放页显式传入开关和两张会话状态表。
  assert.doesNotMatch(DETAIL_VIEW_SOURCE, /show-reachability-status|line-reachability-statuses|episode-reachability-statuses/u);
  assert.match(PLAYER_VIEW_SOURCE, /:show-reachability-status="true"/u);
  assert.match(PLAYER_VIEW_SOURCE, /:line-reachability-statuses="lineReachabilityStatuses"/u);
  assert.match(PLAYER_VIEW_SOURCE, /:episode-reachability-statuses="episodeReachabilityStatuses"/u);
  // 断言: 共享目录默认关闭状态点，结构 available/playable 不得再直接生成假绿色 class。
  assert.match(PLAY_CATALOG_SELECTOR_SOURCE, /showReachabilityStatus:\s*\{[\s\S]*?default:\s*false/u);
  assert.doesNotMatch(PLAY_CATALOG_SELECTOR_SOURCE, /line\.available\s*===\s*false\s*\?\s*'is-unavailable'\s*:\s*'is-available'/u);

  // 断言: 通用队列不直接请求网络、探测 HEAD、使用定时器或依赖 Store/Repository/Router。
  assert.doesNotMatch(MEDIA_REACHABILITY_SERVICE_SOURCE, /\bfetch\s*\(|\bsetTimeout\s*\(|\bsetInterval\s*\(|method:\s*['"]HEAD['"]/u);
  assert.doesNotMatch(MEDIA_REACHABILITY_SERVICE_SOURCE, /from\s+['"][^'"]*(?:Store|Repository|router)[^'"]*['"]/iu);
  // 断言: 协调器保留不可判定分类，任意 reject 不能直接落入 unavailable；新计划必须等待取消资源屏障。
  assert.match(MEDIA_REACHABILITY_SERVICE_SOURCE, /MEDIA_REACHABILITY_PROBE_RESULT[\s\S]*?inconclusive/u);
  assert.match(MEDIA_REACHABILITY_SERVICE_SOURCE, /const previousCancellation = cancel\(\);[\s\S]*?await previousCancellation/u);
  assert.doesNotMatch(MEDIA_REACHABILITY_SERVICE_SOURCE, /catch\s*\{\s*(?:isAvailable\s*=\s*false|probeResult\s*=\s*MEDIA_REACHABILITY_PROBE_RESULT\.unavailable)/u);
  // 断言: probe 槽位只通过专用准备与释放路径结束，只有 adoption 候选可以进入正式提升方法。
  assert.match(PLAYER_VIEW_SOURCE, /prepareMediaProbeCandidate\(candidate\)[\s\S]*?MEDIA_SLOT_PURPOSE\.probe/u);
  assert.match(PLAYER_VIEW_SOURCE, /await this\.releasePreparedProbeSlot\(preparedSlotId\)/u);
  assert.match(PLAYER_VIEW_SOURCE, /promotePreparedMediaSlot\(preparedSlotId, candidate, resumeState\)/u);
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /promotePreparedMediaSlot\([^\n]*MEDIA_SLOT_PURPOSE\.probe/u);
  // 断言: 后台只有可归属 MEDIA_PLAYBACK_FAILED 可以写红；Provider/契约/取消统一返回 inconclusive。
  assert.match(PLAYER_VIEW_SOURCE, /session\.errorCode === MEDIA_PLAYBACK_ERROR_CODE\.mediaPlaybackFailed[\s\S]*?MEDIA_PREPARATION_ERROR_CODE\.unavailable/u);
  assert.match(PLAYER_VIEW_SOURCE, /catch\s*\{[\s\S]*?return MEDIA_REACHABILITY_PROBE_RESULT\.inconclusive/u);
  assert.match(PLAYER_VIEW_SOURCE, /error\?\.reachabilityResult === MEDIA_REACHABILITY_PROBE_RESULT\.unavailable[\s\S]*?MEDIA_REACHABILITY_STATUS\.unavailable/u);
  assert.match(PLAYER_VIEW_SOURCE, /const hasReachabilityFailure = session\.errorCode === MEDIA_PLAYBACK_ERROR_CODE\.mediaPlaybackFailed/u);
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /error\?\.code !== MEDIA_PREPARATION_ERROR_CODE\.cancelled[\s\S]{0,220}?MEDIA_REACHABILITY_STATUS\.unavailable/u);
  // 断言: 父页用显式 slotId 查找资源所有者并等待公开 disposePlayer，不能依赖 Vue 移除后的异步 beforeDestroy。
  assert.match(PLAYER_VIEW_SOURCE, /ref="mediaPlayerSlots"[\s\S]*?:slot-id="slot\.id"/u);
  assert.match(PLAYER_VIEW_SOURCE, /component\?\.slotId === slotId[\s\S]*?await playerComponent\.disposePlayer\(\)[\s\S]*?this\.mediaSlots = this\.mediaSlots\.filter/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /slotId:\s*\{[\s\S]*?type:\s*String,[\s\S]*?required:\s*true/u);
  assert.match(PLAYER_COMPONENT_SOURCE, /async disposePlayer\(\)[\s\S]*?this\._mediaSessionGeneration[\s\S]*?await this\.releasePlayer\(\)/u);
});

// 测试目的: 共享目录只负责线路和选集，并在满高侧栏中保持紧凑顶部流。
test('共享播放目录不承载交接提示并从顶部紧凑排列选集', () => {
  // 断言: 共享组件接口不能重新接收 message，也不能恢复目录内部提示框。
  assert.doesNotMatch(PLAY_CATALOG_SELECTOR_SOURCE, /\bmessage:\s*\{|play-catalog-selector__message|v-if="message"/u);
  // 断言: 满高宿主中的 Grid 行按真实内容高度生成，不能把标题、控件和选集摊到侧栏中部。
  assert.match(PLAY_CATALOG_SELECTOR_SOURCE, /grid-template-rows:\s*max-content max-content;[\s\S]*?align-content:\s*start;/u);
  // 断言: 选集使用自然宽度 Flex 并从左上角连续换行，不建立固定列数或拉伸多行。
  assert.match(PLAY_CATALOG_SELECTOR_SOURCE, /\.play-catalog-selector__episodes\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-content:\s*flex-start;[\s\S]*?flex-wrap:\s*wrap;/u);
  assert.doesNotMatch(PLAY_CATALOG_SELECTOR_SOURCE, /\.play-catalog-selector__episodes\s*\{[\s\S]*?grid-template-columns:/u);
  // 断言: 组件视觉使用可选宿主变量和本地 fallback，播放深色变量不能被组件根节点同级覆盖。
  assert.match(PLAY_CATALOG_SELECTOR_SOURCE, /var\(--play-catalog-control-background,\s*var\(--surface\)\)/u);
  assert.doesNotMatch(PLAY_CATALOG_SELECTOR_SOURCE, /--play-catalog-control-background:\s*var\(--surface\)/u);
});

// 测试目的: 播放切换过程保持静默，只有真实成功或失败终态进入当前线路同行右端。
test('播放目录切换只在完成后发布同行终态', () => {
  // 断言: 共享组件调用只传 pending，不再把播放器交接文案下放到目录组件。
  assert.match(PLAYER_VIEW_SOURCE, /<PlayCatalogSelector[\s\S]*?:pending="handoffPending \|\| mediaPreparationPending"[\s\S]*?@line-change=/u);
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /<PlayCatalogSelector[\s\S]*?:message=/u);
  // 断言: 最终结果紧跟实际线路 Chip 并使用无障碍状态区域；CSS 用自动左边距在同行右端定位。
  assert.match(PLAYER_VIEW_SOURCE, /当前线路：\{\{ playingLineName \}\}[\s\S]*?v-if="catalogOutcome\.message"[\s\S]*?role="status"/u);
  assert.match(PLAYER_VIEW_SOURCE, /\.player-catalog-outcome\s*\{[\s\S]*?margin:\s*0 0 0 auto;/u);
  // 断言: 新切换开始只清空旧终态并设置 pending，不得生成 resolving 过程文案或目录提示框。
  assert.match(PLAYER_VIEW_SOURCE, /this\.handoffPending\s*=\s*true;[\s\S]*?this\.catalogOutcome\s*=\s*createPlayCatalogOutcome\(\);/u);
  assert.doesNotMatch(PLAYER_VIEW_SOURCE, /正在验证目标媒体|PLAY_CATALOG_MESSAGE|catalogMessage/u);
  // 断言: 成功终态只能在 loadPlayerContent 返回已采用结果后创建，失败使用同一受限终态对象。
  assert.match(PLAYER_VIEW_SOURCE, /const adopted = await this\.loadPlayerContent\(routeContext\);[\s\S]*?createPlayCatalogSuccessOutcome\(line, episode\)/u);
  assert.match(PLAYER_VIEW_SOURCE, /PLAY_CATALOG_OUTCOME_KIND\.error[\s\S]*?PLAY_CATALOG_OUTCOME_MESSAGE\.handoffFailed/u);
});
