/*
  userContentService.js 模块说明

  - 文件职责:
      协调用户内容领域候选、IndexedDB 提交和 userContentStore 响应式采用。
      所有长期写入经过单一 FIFO，只有 Repository 成功后才替换投影；currentPlaying 保持会话内存态。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      USER_CONTENT_RECORD_LIMIT/USER_CONTENT_RECOVERY_KIND: 自定义配置，约束集合上限和跨源恢复类型。
      userContentPersistenceInstance: 自定义运行端口，连接应用唯一用户内容 Repository。
      userContentStore 及采用函数: 自定义 store，读取稳定投影并采用提交结果。
      buildFavoriteKey/buildHistoryKey: 自定义工具，生成用户内容唯一键。
      buildContentKey: 自定义工具，生成内容实体引用键。
      createContentCardSnapshot/createEpisodeLocator: 自定义快照服务，生成长期卡片与跨源分集定位事实。

  - 模块级常量:
      SERVICE_OPTION_FIELDS: Array<string>，可测试 service 工厂精确选项。
      applicationUserContentService: object，应用唯一用户内容 service。

  - 模块级变量:
      无

  - 模块级辅助函数:
      getSystemNowIso(): 生成应用当前 ISO 时间。
      normalizeContentRef(input): 标准化 ContentItem 或内容引用。
      trimRecordsByFifo(records, limit, timeField): 按首次时间裁剪记录上限。
      createReboundHistoryRecord(options): 把旧历史转换为替代内容和分集的完整候选。
      createApplicationStatePort(): 创建绑定 Vue store 的窄采用端口。

  - 模块级类:
      UserContentService: Class，拥有初始化状态、持久化写入队列和用户内容命令。

  - 对外导出:
      createUserContentService: Function，供集成测试创建隔离 service。
      initializeUserContent: Function，启动时加载 IndexedDB 投影。
      toggleFavorite/addFavorite/removeFavorite/clearFavorites: 异步收藏命令。
      upsertPlayHistory/removePlayHistory/clearPlayHistory/rebindUserContent: 异步历史和跨源重绑定命令。
      saveResumePolicy: Function，异步保存恢复策略。
      updateCurrentPlaying: Function，写入会话播放状态。
      getPlaybackResumeDecision: Function，计算播放恢复策略。
*/

import {
  // 导入来源: ../config/user-content.config.js；导入内容: USER_CONTENT_RECORD_LIMIT；文件作用: 维护正式记录上限。
  USER_CONTENT_RECORD_LIMIT,
  // 导入来源: ../config/user-content.config.js；导入内容: USER_CONTENT_RECOVERY_KIND；文件作用: 限制跨源重绑定命令类型。
  USER_CONTENT_RECOVERY_KIND
} from '../config/user-content.config.js';

// 导入来源: ../runtime/sourceRuntimeInstance.js；导入内容: userContentPersistenceInstance；文件作用: 使用应用唯一 IndexedDB 用户内容端口。
import { userContentPersistenceInstance } from '../runtime/sourceRuntimeInstance.js';

import {
  // 导入来源: ../store/userContentStore.js；导入内容: userContentStore；文件作用: 每项排队命令在执行时读取最新稳定投影。
  userContentStore,
  // 导入来源: ../store/userContentStore.js；导入内容: replaceUserContentState；文件作用: 初始化后完整采用 Repository 状态。
  replaceUserContentState,
  // 导入来源: ../store/userContentStore.js；导入内容: replaceFavoritesState；文件作用: 收藏事务提交后整体采用集合。
  replaceFavoritesState,
  // 导入来源: ../store/userContentStore.js；导入内容: replacePlayHistoryState；文件作用: 历史事务提交后整体采用集合。
  replacePlayHistoryState,
  // 导入来源: ../store/userContentStore.js；导入内容: replaceResumePolicy；文件作用: 策略提交后整体采用对象。
  replaceResumePolicy,
  // 导入来源: ../store/userContentStore.js；导入内容: setCurrentPlaying；文件作用: 单独维护不持久化的当前播放会话。
  setCurrentPlaying
} from '../store/userContentStore.js';

import {
  // 导入来源: ../utils/userContentKeys.js；导入内容: buildFavoriteKey；文件作用: 定位整部内容收藏。
  buildFavoriteKey,
  // 导入来源: ../utils/userContentKeys.js；导入内容: buildHistoryKey；文件作用: 定位电影或电视剧分集历史。
  buildHistoryKey
} from '../utils/userContentKeys.js';

// 导入来源: ../utils/contentKeys.js；导入内容: buildContentKey；文件作用: 关联同一内容的收藏、历史和卡片快照。
import { buildContentKey } from '../utils/contentKeys.js';

import {
  // 导入来源: ./userContentSnapshotService.js；导入内容: createContentCardSnapshot；文件作用: 收藏和历史写入完整卡片快照。
  createContentCardSnapshot,
  // 导入来源: ./userContentSnapshotService.js；导入内容: createEpisodeLocator；文件作用: 历史写入跨源可匹配分集事实。
  createEpisodeLocator
} from './userContentSnapshotService.js';

// 类型: Array<string>；作用: 工厂只接受 Repository、投影端口和时钟，拒绝备用存储或隐式模式。
const SERVICE_OPTION_FIELDS = Object.freeze(['repository', 'statePort', 'now']);

/**
 * 生成应用当前 ISO 时间。
 * 纯函数: 除读取系统时钟外不修改外部状态。
 *
 * @returns {string} 当前 ISO 时间。
 */
function getSystemNowIso() {
  return new Date().toISOString();
}

/**
 * 标准化内容引用。
 * 纯函数: 返回新对象，不修改 ContentItem；contentId 缺失时读取 id。
 *
 * @param {*} input ContentItem 或内容引用候选。
 * @returns {object} sourceId/contentId/type 标准引用。
 */
function normalizeContentRef(input) {
  // 类型: object；作用: 非对象输入使用空候选，使业务校验稳定返回无效 key。
  const safeInput = input && typeof input === 'object' ? input : {};
  return {
    sourceId: safeInput.sourceId || '',
    contentId: safeInput.contentId || safeInput.id || '',
    type: safeInput.type || 'movie'
  };
}

/**
 * 按首次进入时间裁剪记录上限。
 * 纯函数: 返回新数组，不修改当前 store 数组；同时间使用原数组顺序保持稳定。
 *
 * @param {Array<object>} records 待裁剪记录。
 * @param {number} limit 正式最大数量。
 * @param {string} timeField 首次进入时间字段。
 * @returns {Array<object>} 不超过上限的新数组。
 */
function trimRecordsByFifo(records, limit, timeField) {
  // 类型: Array<object>；作用: 复制候选数组，防止排序改写调用方状态。
  const safeRecords = Array.isArray(records) ? [...records] : [];
  // 类型: number；作用: 只接受正式正整数上限，异常值回到集中配置而不是散落字面值。
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : USER_CONTENT_RECORD_LIMIT;
  // 条件分支: 记录数量尚未超过上限时进入。
  // 执行内容: 直接返回隔离浅副本，不改变当前业务顺序。
  if (safeRecords.length <= safeLimit) return safeRecords;
  return safeRecords
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      // 类型: number；作用: 解析左记录首次时间，非法时间排在最旧位置并由后续 Repository 校验拒绝。
      const leftTime = Date.parse(left.record[timeField] || '');
      // 类型: number；作用: 解析右记录首次时间，供先进先出排序比较。
      const rightTime = Date.parse(right.record[timeField] || '');
      // 条件分支: 两条记录时间相同时进入。
      // 执行内容: 保留后加入记录优先，确保裁剪结果确定。
      if (leftTime === rightTime) return right.index - left.index;
      return rightTime - leftTime;
    })
    .slice(0, safeLimit)
    .sort((left, right) => left.index - right.index)
    .map(entry => entry.record);
}

/**
 * 把一条失效源历史转换为替代内容与用户确认分集的完整候选。
 * 纯函数: 返回新记录，不修改旧历史、ContentItem、Episode 或当前 Store。
 * 成功路径: 保留首次/最近播放时间、进度、总时长和状态，只替换内容、分集、快照与唯一键。
 * 失败路径: 电视剧没有稳定目标分集身份时返回 null，调用方不得删除旧记录。
 *
 * @param {object} options 重绑定输入。
 * @param {object} options.historyRecord 原播放历史记录。
 * @param {object} options.nextContentRef 替代内容标准身份。
 * @param {object} options.contentSnapshot 替代内容完整卡片快照。
 * @param {object|null} options.episode 用户在替代详情页确认的标准 Episode。
 * @param {string} options.now 本次事务统一更新时间。
 * @returns {object|null} 新历史记录；无法形成唯一键时为 null。
 */
function createReboundHistoryRecord({ historyRecord, nextContentRef, contentSnapshot, episode, now }) {
  // 类型: object；作用: 从用户确认分集生成新 Provider 身份和跨源定位字段；电影允许空定位器。
  const episodeLocator = createEpisodeLocator(episode, {});
  // 类型: object；作用: 生成替代历史唯一键所需内容和分集身份。
  const nextHistoryRef = {
    ...nextContentRef,
    episodeId: episodeLocator.episodeId,
    episodeIndex: episodeLocator.episodeIndex || episodeLocator.episodeNumber
  };
  // 类型: string；作用: 电影使用内容级键，电视剧必须包含新 Provider 分集身份。
  const historyKey = buildHistoryKey(nextHistoryRef);
  // 条件分支: 替代内容无法形成稳定历史键时进入；执行内容: 返回 null 并保留原记录。
  if (!historyKey) return null;
  return {
    ...historyRecord,
    sourceId: nextContentRef.sourceId,
    contentId: nextContentRef.contentId,
    type: nextContentRef.type,
    episodeId: nextHistoryRef.episodeId,
    episodeIndex: nextHistoryRef.episodeIndex,
    episodeLocator: {
      ...episodeLocator,
      episodeIndex: nextHistoryRef.episodeIndex
    },
    contentSnapshot,
    historyKey,
    contentKey: buildContentKey(nextContentRef.sourceId, nextContentRef.contentId),
    playbackSourceId: '',
    updatedAt: now
  };
}

/**
 * 创建绑定应用 Vue store 的窄状态端口。
 * 纯函数: 只返回冻结函数引用；真正状态副作用发生在方法被 service 调用时。
 *
 * @returns {Readonly<object>} 用户内容投影读取和采用端口。
 */
function createApplicationStatePort() {
  return Object.freeze({
    state: userContentStore,
    replaceState: replaceUserContentState,
    replaceFavorites: replaceFavoritesState,
    replacePlayHistory: replacePlayHistoryState,
    replaceResumePolicy,
    setCurrentPlaying
  });
}

/**
 * 用户内容 service。
 * 状态所有权: 初始化 Promise、是否就绪和写入 FIFO 只属于当前实例。
 * 并发规则: 长期写入严格串行，每项执行时读取最新已提交投影；失败不会阻塞后续命令。
 * 失败边界: Repository reject 前后都不采用候选；store 只接收 Repository 返回对象。
 */
class UserContentService {
  // 类型: object；作用: 持久化窄端口，不暴露数据库或 object store。
  #repository;
  // 类型: object；作用: 读取和采用当前实例对应的响应式或测试投影。
  #statePort;
  // 类型: Function；作用: 生成记录时间，测试可注入确定性时钟。
  #now;
  // 类型: boolean；作用: true 允许长期写命令，false 在初始化完成前失败关闭。
  #initialized = false;
  // 类型: Promise<object>|null；作用: 合并同实例并发初始化，失败后清空以允许显式重试。
  #initializationPromise = null;
  // 类型: Promise<void>；作用: 保存上一长期写命令的收敛屏障，reject 已被内部吸收以继续队列。
  #writeQueue = Promise.resolve();

  /**
   * 创建用户内容 service。
   * 副作用: 只保存依赖和空队列，不初始化数据库或修改投影。
   *
   * @param {object} options 显式依赖。
   * @param {object} options.repository 用户内容持久化端口。
   * @param {object} options.statePort 状态读取和采用端口。
   * @param {Function} options.now ISO 时间函数。
   */
  constructor({ repository, statePort, now }) {
    // 条件分支: Repository 缺少初始化或三类当前写能力时进入。
    // 执行内容: 拒绝不完整端口，避免运行中才发现保存路径缺失。
    if (!repository || typeof repository.initialize !== 'function'
      || typeof repository.saveFavorites !== 'function'
      || typeof repository.savePlayHistory !== 'function'
      || typeof repository.saveCollections !== 'function'
      || typeof repository.saveResumePolicy !== 'function') {
      throw new TypeError('UserContentService repository 无效');
    }
    // 条件分支: 状态端口缺少投影或采用函数时进入。
    // 执行内容: 拒绝页面直接写数组和测试影子状态。
    if (!statePort || !statePort.state
      || typeof statePort.replaceState !== 'function'
      || typeof statePort.replaceFavorites !== 'function'
      || typeof statePort.replacePlayHistory !== 'function'
      || typeof statePort.replaceResumePolicy !== 'function'
      || typeof statePort.setCurrentPlaying !== 'function') {
      throw new TypeError('UserContentService statePort 无效');
    }
    // 条件分支: now 不是函数时进入。
    // 执行内容: 拒绝在领域命令中散落第二套时间来源。
    if (typeof now !== 'function') throw new TypeError('UserContentService now 必须是函数');
    this.#repository = repository;
    this.#statePort = statePort;
    this.#now = now;
  }

  /**
   * 初始化用户内容投影。
   * 副作用: 调用 Repository 初始化，并在成功后完整替换 store；并发调用复用同一 Promise。
   * 成功路径: currentPlaying=null 的完整保存投影被采用并允许写命令。
   * 失败路径: 保持空或旧投影、initialized=false，并清空 Promise 允许显式重试。
   *
   * @returns {Promise<object>} 已采用完整状态。
   */
  initialize() {
    // 条件分支: 当前实例已经初始化完成时进入。
    // 执行内容: 返回当前投影，不重复读取数据库或覆盖会话状态。
    if (this.#initialized) return Promise.resolve(this.#statePort.state);
    // 条件分支: 初始化正在执行时进入。
    // 执行内容: 复用同一 Promise，避免两个响应竞争采用 store。
    if (this.#initializationPromise) return this.#initializationPromise;
    this.#initializationPromise = this.#repository.initialize()
      .then((state) => {
        // 副作用: Repository 成功后一次性采用完整投影，随后才开放长期写命令。
        // 类型: object；作用: 保存 store 完整采用后的当前响应式投影。
        const adoptedState = this.#statePort.replaceState(state);
        this.#initialized = true;
        return adoptedState;
      })
      .catch((error) => {
        // 失败补偿: 不采用空数组或 mock，只恢复可显式重试的初始化状态。
        this.#initializationPromise = null;
        this.#initialized = false;
        throw error;
      });
    return this.#initializationPromise;
  }

  /**
   * 添加收藏。
   * 副作用: 排队提交完整 FavoritesState，提交成功后采用投影。
   * 成功路径: 已存在时返回原记录且不写数据库；新增时返回已提交记录。
   * 失败路径: 内容身份无效返回 null；Repository reject 时 store 保持旧集合。
   *
   * @param {object} contentRef ContentItem 或内容引用。
   * @returns {Promise<object|null>} 收藏记录或 null。
   */
  addFavorite(contentRef) {
    return this.#enqueueWrite(async () => {
      // 类型: object；作用: 把 ContentItem 或引用统一为收藏所需身份字段。
      const normalizedRef = normalizeContentRef(contentRef);
      // 类型: string；作用: 定位整部内容收藏，空值表示身份不完整。
      const favoriteKey = buildFavoriteKey(normalizedRef.sourceId, normalizedRef.contentId);
      // 条件分支: sourceId 或 contentId 无法生成收藏键时进入。
      // 执行内容: 返回 null，不创建数据库事务。
      if (!favoriteKey) return null;
      // 类型: object|undefined；作用: 从当前最新投影识别已存在收藏。
      const existingRecord = this.#favoriteRecords().find(record => record.favoriteKey === favoriteKey);
      // 条件分支: 当前内容已经收藏时进入。
      // 执行内容: 返回已有记录，不改变首次收藏时间或重复写库。
      if (existingRecord) return existingRecord;
      // 类型: string；作用: 同时作为新收藏的创建时间和更新时间。
      const now = this.#now();
      // 类型: object|null；作用: 新收藏必须保存完整卡片快照，避免刷新后依赖 Provider 才能展示。
      const contentSnapshot = createContentCardSnapshot(contentRef, now);
      // 条件分支: 调用方只提供身份引用而没有完整 ContentItem 时进入；执行内容: 拒绝新增不完整收藏。
      if (!contentSnapshot) return null;
      // 类型: object；作用: 构造身份、完整卡片快照和时间组成的收藏候选。
      const record = {
        sourceId: normalizedRef.sourceId,
        contentId: normalizedRef.contentId,
        favoriteKey,
        contentKey: buildContentKey(normalizedRef.sourceId, normalizedRef.contentId),
        contentSnapshot,
        favoritedAt: now,
        updatedAt: now
      };
      // 类型: Array<object>；作用: 合并新记录并按正式先进先出上限裁剪。
      const records = trimRecordsByFifo(
        [...this.#favoriteRecords(), record],
        this.#statePort.state.favorites.maxRecords,
        'favoritedAt'
      );
      await this.#commitFavorites(records);
      return record;
    });
  }

  /**
   * 移除收藏。
   * 副作用: 命中记录时排队提交完整 FavoritesState，成功后采用投影。
   * 成功路径: 返回是否删除；未命中不创建事务。
   * 失败路径: Repository reject 时 store 保持旧集合。
   *
   * @param {object} contentRef ContentItem 或内容引用。
   * @returns {Promise<boolean>} 是否删除记录。
   */
  removeFavorite(contentRef) {
    return this.#enqueueWrite(async () => {
      // 类型: object；作用: 把外部内容统一为收藏身份字段。
      const normalizedRef = normalizeContentRef(contentRef);
      // 类型: string；作用: 定位待删除收藏记录。
      const favoriteKey = buildFavoriteKey(normalizedRef.sourceId, normalizedRef.contentId);
      // 条件分支: 收藏身份不完整时进入。
      // 执行内容: 返回 false，不创建事务。
      if (!favoriteKey) return false;
      // 类型: Array<object>；作用: 保存命令执行时最新收藏投影副本。
      const currentRecords = this.#favoriteRecords();
      // 类型: Array<object>；作用: 生成排除目标键的完整候选集合。
      const records = currentRecords.filter(record => record.favoriteKey !== favoriteKey);
      // 条件分支: 过滤前后数量相同时进入，表示目标不存在。
      // 执行内容: 返回 false，不执行无意义数据库替换。
      if (records.length === currentRecords.length) return false;
      await this.#commitFavorites(records);
      return true;
    });
  }

  /**
   * 互斥切换收藏状态。
   * 副作用: 单个排队命令内判断最新状态并提交，避免先查询后另行排队的竞态。
   * 成功路径: 返回提交后的 favorite Boolean 和记录。
   * 失败路径: 身份无效返回未收藏；Repository reject 时不采用候选。
   *
   * @param {object} contentRef ContentItem 或内容引用。
   * @returns {Promise<object>} 收藏切换结果。
   */
  toggleFavorite(contentRef) {
    return this.#enqueueWrite(async () => {
      // 类型: object；作用: 把外部内容统一为收藏身份字段。
      const normalizedRef = normalizeContentRef(contentRef);
      // 类型: string；作用: 在单个队列命令内定位最新收藏状态。
      const favoriteKey = buildFavoriteKey(normalizedRef.sourceId, normalizedRef.contentId);
      // 条件分支: 收藏身份不完整时进入。
      // 执行内容: 返回稳定未收藏结果，不创建事务。
      if (!favoriteKey) return { favorite: false, record: null };
      // 类型: Array<object>；作用: 保存当前命令开始时最新已提交收藏集合。
      const currentRecords = this.#favoriteRecords();
      // 类型: object|undefined；作用: 判断本次互斥切换应删除还是新增。
      const existingRecord = currentRecords.find(record => record.favoriteKey === favoriteKey);
      // 条件分支: 当前内容已经收藏时进入。
      // 执行内容: 提交删除后的完整集合并返回未收藏状态。
      if (existingRecord) {
        await this.#commitFavorites(currentRecords.filter(record => record.favoriteKey !== favoriteKey));
        return { favorite: false, record: null };
      }
      // 类型: string；作用: 同时作为新收藏创建时间和更新时间。
      const now = this.#now();
      // 类型: object|null；作用: 新收藏必须从本次标准 ContentItem 保存完整卡片快照。
      const contentSnapshot = createContentCardSnapshot(contentRef, now);
      // 条件分支: 调用方没有交付完整 ContentItem 时进入；执行内容: 返回稳定未收藏结果且不写库。
      if (!contentSnapshot) return { favorite: false, record: null };
      // 类型: object；作用: 构造身份、完整卡片快照和时间组成的收藏候选。
      const record = {
        sourceId: normalizedRef.sourceId,
        contentId: normalizedRef.contentId,
        favoriteKey,
        contentKey: buildContentKey(normalizedRef.sourceId, normalizedRef.contentId),
        contentSnapshot,
        favoritedAt: now,
        updatedAt: now
      };
      // 类型: Array<object>；作用: 合并新增收藏并执行正式 FIFO 上限裁剪。
      const records = trimRecordsByFifo(
        [...currentRecords, record],
        this.#statePort.state.favorites.maxRecords,
        'favoritedAt'
      );
      await this.#commitFavorites(records);
      return { favorite: true, record };
    });
  }

  /**
   * 清空收藏。
   * 副作用: 非空时提交空 FavoritesState，成功后采用投影。
   * 成功路径: 返回已提交空 records；原本为空时不创建事务。
   * 失败路径: Repository reject 时保留旧收藏。
   *
   * @returns {Promise<Array<object>>} 空收藏数组。
   */
  clearFavorites() {
    return this.#enqueueWrite(async () => {
      // 条件分支: 当前收藏已经为空时进入。
      // 执行内容: 直接返回空数组，不创建无意义事务。
      if (this.#favoriteRecords().length === 0) return [];
      // 类型: object；作用: 保存 Repository 提交并由 store 采用后的空收藏集合。
      const saved = await this.#commitFavorites([]);
      return saved.records;
    });
  }

  /**
   * 新增或更新播放历史。
   * 副作用: 排队提交完整 PlayHistoryState，成功后采用投影。
   * 成功路径: 同 historyKey 保留 firstPlayedAt 并更新进度；新记录受 FIFO 上限约束。
   * 失败路径: 身份或电视剧分集缺失返回 null；Repository reject 时保留旧历史。
   *
   * @param {object} payload 播放历史写入参数。
   * @returns {Promise<object|null>} 已提交历史记录或 null。
   */
  upsertPlayHistory(payload) {
    return this.#enqueueWrite(async () => {
      // 类型: object；作用: 非对象载荷使用空候选，使失败路径稳定。
      const safePayload = payload && typeof payload === 'object' ? payload : {};
      // 类型: object；作用: 读取可选 ContentItem，显式载荷字段后续拥有更高优先级。
      const contentItem = safePayload.contentItem && typeof safePayload.contentItem === 'object'
        ? safePayload.contentItem
        : {};
      // 类型: object；作用: 统一历史记录的 sourceId/contentId/type 内容身份。
      const contentRef = normalizeContentRef({
        ...contentItem,
        sourceId: safePayload.sourceId || contentItem.sourceId,
        contentId: safePayload.contentId || contentItem.id,
        type: safePayload.type || contentItem.type
      });
      // 类型: object；作用: 读取可选分集对象，补全 episodeId 和 episodeIndex。
      const episode = safePayload.episode && typeof safePayload.episode === 'object'
        ? safePayload.episode
        : {};
      // 类型: object；作用: 组合电影或电视剧分集历史唯一键所需字段。
      const historyRef = {
        ...contentRef,
        episodeId: safePayload.episodeId || episode.id || '',
        episodeIndex: safePayload.episodeIndex || episode.episodeNumber || null
      };
      // 类型: string；作用: 定位电影整部历史或电视剧单集历史。
      const historyKey = buildHistoryKey(historyRef);
      // 条件分支: 内容身份或电视剧分集身份不足时进入。
      // 执行内容: 返回 null，不创建数据库事务。
      if (!historyKey) return null;
      // 类型: Array<object>；作用: 保存当前命令执行时最新已提交历史集合。
      const currentRecords = this.#historyRecords();
      // 类型: object|undefined；作用: 命中同一历史键时保留首次播放时间。
      const existingRecord = currentRecords.find(record => record.historyKey === historyKey);
      // 类型: string；作用: 使用显式播放时间或当前时钟作为最近播放时间。
      const now = safePayload.lastPlayedAt || this.#now();
      // 类型: object|null；作用: 当前 ContentItem 可用时捕获最新完整卡片；旧记录无新内容时保留原快照。
      const contentSnapshot = createContentCardSnapshot(contentItem, now)
        || existingRecord?.contentSnapshot
        || null;
      // 条件分支: 新历史没有完整 ContentItem 快照时进入；执行内容: 拒绝继续制造无法离线展示的新记录。
      if (!existingRecord && !contentSnapshot) return null;
      // 类型: object；作用: 从当前标准分集和历史身份创建跨源定位器，缺失分集对象时保留已有定位器。
      const episodeLocator = safePayload.episode
        ? createEpisodeLocator(episode, historyRef)
        : existingRecord?.episodeLocator || createEpisodeLocator(null, historyRef);
      // 类型: object；作用: 构造完整历史候选，不保存 Router、播放 URL 或 Provider 私有值。
      const record = {
        sourceId: contentRef.sourceId,
        contentId: contentRef.contentId,
        type: contentRef.type,
        episodeId: historyRef.episodeId,
        episodeIndex: historyRef.episodeIndex,
        episodeLocator,
        contentSnapshot,
        historyKey,
        contentKey: buildContentKey(contentRef.sourceId, contentRef.contentId),
        firstPlayedAt: existingRecord ? existingRecord.firstPlayedAt : now,
        lastPlayedAt: now,
        playedSeconds: Number(safePayload.playedSeconds) > 0 ? Number(safePayload.playedSeconds) : 0,
        durationSeconds: Number(safePayload.durationSeconds) > 0 ? Number(safePayload.durationSeconds) : null,
        playStatus: safePayload.playStatus || 'played',
        playbackSourceId: safePayload.playbackSourceId || '',
        updatedAt: now
      };
      // 类型: Array<object>；作用: 移除同键旧记录后追加最新候选，保证唯一键互斥。
      const mergedRecords = [
        ...currentRecords.filter(item => item.historyKey !== historyKey),
        record
      ];
      // 类型: Array<object>；作用: 按 firstPlayedAt 执行正式 FIFO 上限裁剪。
      const records = trimRecordsByFifo(
        mergedRecords,
        this.#statePort.state.playHistory.maxRecords,
        'firstPlayedAt'
      );
      await this.#commitPlayHistory(records);
      return record;
    });
  }

  /**
   * 把失效源用户记录原子重绑定到用户确认的替代内容。
   * 副作用: 在单一 FIFO 命令中构造收藏和历史完整候选，调用 Repository 双仓事务，成功后同时采用两个投影。
   * 成功路径: 收藏保留 favoritedAt；历史保留 firstPlayedAt、lastPlayedAt、播放秒数、总时长和状态，并采用新分集身份。
   * 失败路径: 恢复键、替代内容、分集或快照无效时返回 null；Repository reject 时两个投影都保持旧值。
   *
   * @param {object} command 跨源重绑定命令。
   * @returns {Promise<object|null>} 已提交恢复结果或 null。
   */
  rebindUserContent(command) {
    return this.#enqueueWrite(async () => {
      // 类型: object；作用: 非对象命令使用空候选，使恢复失败稳定返回 null。
      const safeCommand = command && typeof command === 'object' && !Array.isArray(command) ? command : {};
      // 类型: string；作用: 恢复类型只允许 favorite 或 history。
      const recoveryKind = safeCommand.recoveryKind;
      // 类型: string；作用: 精确定位用户选择恢复的原收藏键或历史键。
      const recoveryKey = typeof safeCommand.recoveryKey === 'string' ? safeCommand.recoveryKey : '';
      // 类型: string；作用: 收藏恢复时精确定位同内容最近历史；空值表示收藏从未播放。
      const relatedHistoryKey = typeof safeCommand.relatedHistoryKey === 'string'
        ? safeCommand.relatedHistoryKey
        : '';
      // 类型: object；作用: 用户在搜索结果中确认并由详情页完整加载的新标准 ContentItem。
      const contentItem = safeCommand.contentItem && typeof safeCommand.contentItem === 'object'
        && !Array.isArray(safeCommand.contentItem)
        ? safeCommand.contentItem
        : {};
      // 类型: object|null；作用: 电视剧恢复后的目标标准 Episode，电影允许 null。
      const episode = safeCommand.episode && typeof safeCommand.episode === 'object'
        && !Array.isArray(safeCommand.episode)
        ? safeCommand.episode
        : null;
      // 条件分支: 恢复类型或记录键不受支持时进入；执行内容: 不创建数据库事务。
      if (!Object.values(USER_CONTENT_RECOVERY_KIND).includes(recoveryKind) || !recoveryKey) return null;

      // 类型: string；作用: 统一重绑定收藏和历史更新时间，并作为新快照捕获时间。
      const now = this.#now();
      // 类型: object|null；作用: 新内容必须具备完整卡片快照，避免重绑定后再次依赖 Provider 补全。
      const contentSnapshot = createContentCardSnapshot(contentItem, now);
      // 条件分支: 替代内容无法生成完整快照时进入；执行内容: 保留原用户记录并返回 null。
      if (!contentSnapshot) return null;

      // 类型: Array<object>；作用: 复制当前最新收藏集合，后续只在候选数组中改写。
      let favoriteRecords = this.#favoriteRecords();
      // 类型: Array<object>；作用: 复制当前最新历史集合，后续只在候选数组中改写。
      let historyRecords = this.#historyRecords();
      // 类型: object|null；作用: 根据恢复类型精确读取原用户记录。
      const recoveryRecord = recoveryKind === USER_CONTENT_RECOVERY_KIND.favorite
        ? favoriteRecords.find(record => record.favoriteKey === recoveryKey) || null
        : historyRecords.find(record => record.historyKey === recoveryKey) || null;
      // 条件分支: 原记录已被用户删除或 key 不存在时进入；执行内容: 不创建空恢复记录。
      if (!recoveryRecord) return null;

      // 类型: object；作用: 新内容身份统一使用 ContentItem 标准字段，不继承旧 Provider id。
      const nextContentRef = normalizeContentRef(contentItem);
      // 条件分支: 替代内容身份不完整时进入；执行内容: 保留原集合。
      if (!nextContentRef.sourceId || !nextContentRef.contentId || !nextContentRef.type) return null;
      // 类型: object|null；作用: 保存本次实际迁移的历史候选，返回播放器新身份时复用同一事实。
      let reboundHistoryRecord = null;

      // 条件分支: 恢复收藏时进入；执行内容: 迁移收藏，并在存在关联最近历史时同步迁移该分集与进度。
      if (recoveryKind === USER_CONTENT_RECOVERY_KIND.favorite) {
        // 类型: string；作用: 生成替代内容在收藏集合中的唯一键。
        const nextFavoriteKey = buildFavoriteKey(nextContentRef.sourceId, nextContentRef.contentId);
        favoriteRecords = favoriteRecords.filter((record) => {
          return record.favoriteKey !== recoveryKey && record.favoriteKey !== nextFavoriteKey;
        });
        favoriteRecords.push({
          sourceId: nextContentRef.sourceId,
          contentId: nextContentRef.contentId,
          favoriteKey: nextFavoriteKey,
          contentKey: buildContentKey(nextContentRef.sourceId, nextContentRef.contentId),
          contentSnapshot,
          favoritedAt: recoveryRecord.favoritedAt,
          updatedAt: now
        });

        // 类型: object|null；作用: 只接受上下文冻结的同内容历史键，防止收藏恢复迁移其他影片记录。
        const relatedHistoryRecord = relatedHistoryKey
          ? historyRecords.find((record) => {
            return record.historyKey === relatedHistoryKey
              && record.sourceId === recoveryRecord.sourceId
              && record.contentId === recoveryRecord.contentId;
          }) || null
          : null;
        // 条件分支: 失效收藏具有最近播放历史时进入；执行内容: 用用户当前选择分集重绑定该历史并保留进度。
        if (relatedHistoryRecord) {
          reboundHistoryRecord = createReboundHistoryRecord({
            historyRecord: relatedHistoryRecord,
            nextContentRef,
            contentSnapshot,
            episode,
            now
          });
          // 条件分支: 替代电视剧分集无法形成历史键时进入；执行内容: 收藏和历史都不提交，保留恢复前事实。
          if (!reboundHistoryRecord) return null;
          historyRecords = historyRecords.filter((record) => {
            return record.historyKey !== relatedHistoryRecord.historyKey
              && record.historyKey !== reboundHistoryRecord.historyKey;
          });
          historyRecords.push(reboundHistoryRecord);
        }
      }

      // 条件分支: 恢复播放历史时进入；执行内容: 重建当前单集 historyKey，并同步迁移同一旧内容收藏。
      if (recoveryKind === USER_CONTENT_RECOVERY_KIND.history) {
        // 类型: object|null；作用: 复用唯一历史重绑定构造器，保留进度并采用新 Provider 分集身份。
        reboundHistoryRecord = createReboundHistoryRecord({
          historyRecord: recoveryRecord,
          nextContentRef,
          contentSnapshot,
          episode,
          now
        });
        // 条件分支: 替代电视剧分集无法形成历史键时进入；执行内容: 保留原记录等待用户选择有效分集。
        if (!reboundHistoryRecord) return null;
        historyRecords = historyRecords.filter((record) => {
          return record.historyKey !== recoveryKey && record.historyKey !== reboundHistoryRecord.historyKey;
        });
        historyRecords.push(reboundHistoryRecord);

        // 类型: object|undefined；作用: 同步定位旧内容收藏，使历史恢复后收藏不会继续指向失效源。
        const linkedFavorite = favoriteRecords.find((record) => {
          return record.sourceId === recoveryRecord.sourceId && record.contentId === recoveryRecord.contentId;
        });
        // 条件分支: 原历史内容同时被收藏时进入；执行内容: 在同一事务中重绑定收藏并保留 favoritedAt。
        if (linkedFavorite) {
          // 类型: string；作用: 生成替代内容收藏唯一键，并用于排除已经存在的目标收藏重复项。
          const nextFavoriteKey = buildFavoriteKey(nextContentRef.sourceId, nextContentRef.contentId);
          favoriteRecords = favoriteRecords.filter((record) => {
            return record.favoriteKey !== linkedFavorite.favoriteKey && record.favoriteKey !== nextFavoriteKey;
          });
          favoriteRecords.push({
            sourceId: nextContentRef.sourceId,
            contentId: nextContentRef.contentId,
            favoriteKey: nextFavoriteKey,
            contentKey: buildContentKey(nextContentRef.sourceId, nextContentRef.contentId),
            contentSnapshot,
            favoritedAt: linkedFavorite.favoritedAt,
            updatedAt: now
          });
        }
      }

      // 类型: object；作用: 使用当前正式上限组装双仓事务收藏状态。
      const favorites = {
        maxRecords: this.#statePort.state.favorites.maxRecords,
        records: favoriteRecords
      };
      // 类型: object；作用: 使用当前正式上限组装双仓事务历史状态。
      const playHistory = {
        maxRecords: this.#statePort.state.playHistory.maxRecords,
        records: historyRecords
      };
      // 类型: object；作用: Repository 只在两个集合全部提交后返回隔离结果。
      const saved = await this.#repository.saveCollections(this.#currentUserId(), favorites, playHistory);
      this.#statePort.replaceFavorites(saved.favorites);
      this.#statePort.replacePlayHistory(saved.playHistory);
      return {
        recoveryKind,
        sourceId: nextContentRef.sourceId,
        contentId: nextContentRef.contentId,
        episodeId: reboundHistoryRecord?.episodeId || (episode ? episode.id || episode.value || '' : ''),
        episodeIndex: reboundHistoryRecord?.episodeIndex
          || (episode ? episode.episodeNumber || episode.index || episode.episodeIndex || null : null)
      };
    });
  }

  /**
   * 删除一条播放历史。
   * 副作用: 命中记录时提交完整 PlayHistoryState，成功后采用投影。
   * 成功路径: 返回是否删除；未命中不创建事务。
   * 失败路径: Repository reject 时保留旧历史。
   *
   * @param {string|object} target historyKey 或历史引用。
   * @returns {Promise<boolean>} 是否删除记录。
   */
  removePlayHistory(target) {
    return this.#enqueueWrite(async () => {
      // 类型: string；作用: 直接使用 historyKey 或从历史引用复算目标键。
      const historyKey = typeof target === 'string' ? target : buildHistoryKey(target);
      // 条件分支: 目标无法形成历史键时进入。
      // 执行内容: 返回 false，不创建事务。
      if (!historyKey) return false;
      // 类型: Array<object>；作用: 保存当前命令开始时最新已提交历史集合。
      const currentRecords = this.#historyRecords();
      // 类型: Array<object>；作用: 生成排除目标历史键的完整候选集合。
      const records = currentRecords.filter(record => record.historyKey !== historyKey);
      // 条件分支: 过滤前后数量相同时进入，表示目标不存在。
      // 执行内容: 返回 false，不执行无意义事务。
      if (records.length === currentRecords.length) return false;
      await this.#commitPlayHistory(records);
      return true;
    });
  }

  /**
   * 清空播放历史。
   * 副作用: 非空时提交空 PlayHistoryState，成功后采用投影。
   * 成功路径: 返回已提交空 records；原本为空时不创建事务。
   * 失败路径: Repository reject 时保留旧历史。
   *
   * @returns {Promise<Array<object>>} 空历史数组。
   */
  clearPlayHistory() {
    return this.#enqueueWrite(async () => {
      // 条件分支: 当前历史已经为空时进入。
      // 执行内容: 直接返回空数组，不创建无意义事务。
      if (this.#historyRecords().length === 0) return [];
      // 类型: object；作用: 保存 Repository 提交并由 store 采用后的空历史集合。
      const saved = await this.#commitPlayHistory([]);
      return saved.records;
    });
  }

  /**
   * 保存播放恢复策略。
   * 副作用: 排队提交 userSettings，成功后整体采用策略。
   * 成功路径: 返回已提交策略。
   * 失败路径: Repository reject 时保留旧策略。
   *
   * @param {object} resumePolicy 完整恢复策略。
   * @returns {Promise<object>} 已提交策略。
   */
  saveResumePolicy(resumePolicy) {
    return this.#enqueueWrite(async () => {
      // 类型: string；作用: 绑定 userSettings 单例归属到当前已初始化用户。
      const userId = this.#currentUserId();
      // 类型: object；作用: 保存 Repository 已提交并隔离返回的恢复策略。
      const saved = await this.#repository.saveResumePolicy(userId, resumePolicy);
      return this.#statePort.replaceResumePolicy(saved);
    });
  }

  /**
   * 更新当前播放会话。
   * 副作用: 只写 statePort.currentPlaying，不进入长期写 FIFO 或 Repository。
   *
   * @param {object|null} currentPlaying 当前播放状态。
   * @returns {object|null} 会话投影。
   */
  updateCurrentPlaying(currentPlaying) {
    return this.#statePort.setCurrentPlaying(currentPlaying);
  }

  /**
   * 计算播放恢复策略。
   * 纯函数: 只读取历史记录和当前已提交 resumePolicy，不修改状态。
   *
   * @param {object|null} historyRecord 播放历史记录。
   * @returns {object} mode/startSeconds/shouldPromptReplay 决策。
   */
  getPlaybackResumeDecision(historyRecord) {
    // 类型: object；作用: 缺失历史使用空对象，表示从头播放。
    const record = historyRecord && typeof historyRecord === 'object' ? historyRecord : {};
    // 类型: object；作用: 读取当前已提交恢复策略，初始化前使用空对象。
    const policy = this.#statePort.state.resumePolicy || {};
    // 类型: number；作用: 小于该阈值时判定接近开头。
    const nearStart = Number(policy.nearStartThresholdSeconds) || 0;
    // 类型: number；作用: 距离结尾不超过该阈值时提示重播。
    const nearEnd = Number(policy.nearEndThresholdSeconds) || 0;
    // 类型: number；作用: 把异常进度收敛为零秒。
    const playedSeconds = Number(record.playedSeconds) > 0 ? Number(record.playedSeconds) : 0;
    // 类型: number|null；作用: 未知总时长不执行接近结尾判断。
    const durationSeconds = Number(record.durationSeconds) > 0 ? Number(record.durationSeconds) : null;
    // 条件分支: 播放进度小于开头阈值时进入。
    // 执行内容: 返回从零开始且不提示的恢复决策。
    if (playedSeconds < nearStart) {
      return { mode: 'restart', startSeconds: 0, shouldPromptReplay: false };
    }
    // 条件分支: 总时长已知且剩余时间不超过结尾阈值时进入。
    // 执行内容: 返回提示重播并保留最后位置的决策。
    if (durationSeconds && durationSeconds - playedSeconds <= nearEnd) {
      return { mode: 'prompt-replay', startSeconds: playedSeconds, shouldPromptReplay: true };
    }
    return { mode: 'resume', startSeconds: playedSeconds, shouldPromptReplay: false };
  }

  /**
   * 把长期写命令追加到当前实例 FIFO。
   * 副作用: 更新内部队列屏障；每项命令仍负责自己的 Repository 和 store 副作用。
   * 成功路径: 上一项收敛后执行 operation 并把结果返回原调用方。
   * 失败路径: 原调用方收到错误，内部屏障吸收 reject 后继续后续命令。
   *
   * @param {Function} operation 当前长期写函数。
   * @returns {Promise<*>} 当前命令结果。
   */
  #enqueueWrite(operation) {
    // 类型: Promise<*>；作用: 在上一屏障收敛后检查初始化状态并执行当前命令。
    const result = this.#writeQueue.then(() => {
      // 条件分支: UserContentRepository 尚未初始化成功时进入。
      // 执行内容: 失败关闭长期写入，禁止用空投影构造保存候选。
      if (!this.#initialized) throw new Error('用户内容持久化尚未初始化');
      return operation();
    });
    this.#writeQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  /**
   * 读取当前用户 id。
   * 纯函数: 只读取稳定投影；初始化前或资料损坏时抛错。
   *
   * @returns {string} 当前用户 id。
   */
  #currentUserId() {
    // 类型: object|null；作用: 读取当前已提交用户资料。
    const user = this.#statePort.state.user;
    // 条件分支: 用户资料或 id 缺失时进入。
    // 执行内容: 阻止创建无归属收藏、历史或设置事务。
    if (!user || typeof user.id !== 'string' || !user.id) {
      throw new Error('用户内容投影缺少当前用户身份');
    }
    return user.id;
  }

  /**
   * 读取当前收藏记录浅副本。
   * 纯函数: 不允许调用方直接修改 store 数组。
   *
   * @returns {Array<object>} 收藏记录副本。
   */
  #favoriteRecords() {
    // 类型: object；作用: 读取当前收藏集合，异常投影使用空对象供失败定位。
    const favorites = this.#statePort.state.favorites || {};
    return Array.isArray(favorites.records) ? [...favorites.records] : [];
  }

  /**
   * 读取当前历史记录浅副本。
   * 纯函数: 不允许调用方直接修改 store 数组。
   *
   * @returns {Array<object>} 历史记录副本。
   */
  #historyRecords() {
    // 类型: object；作用: 读取当前历史集合，异常投影使用空对象供失败定位。
    const playHistory = this.#statePort.state.playHistory || {};
    return Array.isArray(playHistory.records) ? [...playHistory.records] : [];
  }

  /**
   * 提交并采用完整收藏集合。
   * 副作用: Repository transaction.done 后调用 statePort.replaceFavorites。
   * 成功路径: 返回 store 已采用集合；失败路径: 不调用采用函数。
   *
   * @param {Array<object>} records 完整收藏记录。
   * @returns {Promise<object>} 已采用 FavoritesState。
   */
  async #commitFavorites(records) {
    // 类型: object；作用: 用当前正式上限和候选 records 组装完整 FavoritesState。
    const favorites = {
      maxRecords: this.#statePort.state.favorites.maxRecords,
      records
    };
    // 类型: object；作用: 保存 transaction.done 后 Repository 返回的隔离集合。
    const saved = await this.#repository.saveFavorites(this.#currentUserId(), favorites);
    return this.#statePort.replaceFavorites(saved);
  }

  /**
   * 提交并采用完整播放历史集合。
   * 副作用: Repository transaction.done 后调用 statePort.replacePlayHistory。
   * 成功路径: 返回 store 已采用集合；失败路径: 不调用采用函数。
   *
   * @param {Array<object>} records 完整历史记录。
   * @returns {Promise<object>} 已采用 PlayHistoryState。
   */
  async #commitPlayHistory(records) {
    // 类型: object；作用: 用当前正式上限和候选 records 组装完整 PlayHistoryState。
    const playHistory = {
      maxRecords: this.#statePort.state.playHistory.maxRecords,
      records
    };
    // 类型: object；作用: 保存 transaction.done 后 Repository 返回的隔离集合。
    const saved = await this.#repository.savePlayHistory(this.#currentUserId(), playHistory);
    return this.#statePort.replacePlayHistory(saved);
  }
}

/**
 * 创建隔离用户内容 service。
 * 副作用: 只创建实例，不初始化 Repository 或修改投影。
 * 失败路径: options 字段或端口无效时同步抛 TypeError。
 *
 * @param {object} options 显式依赖。
 * @returns {UserContentService} 新 service 实例。
 */
export function createUserContentService(options) {
  // 条件分支: options 为空、数组、非对象或具有自定义原型时进入。
  // 执行内容: 在实例创建前拒绝不稳定依赖载体。
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.getPrototypeOf(options) !== Object.prototype) {
    throw new TypeError('createUserContentService options 必须是普通对象');
  }
  // 类型: Array<string>；作用: 读取实际依赖字段并检查是否只有三项冻结端口。
  const fields = Object.keys(options);
  // 条件分支: 字段数量或名称不符合精确选项时进入。
  // 执行内容: 拒绝备用存储、模式开关或隐式全局依赖。
  if (fields.length !== SERVICE_OPTION_FIELDS.length
    || fields.some(field => !SERVICE_OPTION_FIELDS.includes(field))) {
    throw new TypeError('createUserContentService 必须只提供 repository/statePort/now');
  }
  return new UserContentService(options);
}

// 类型: UserContentService；作用: 页面和 main.js 共用的唯一应用实例，绑定唯一 IndexedDB 端口与 Vue 投影。
const applicationUserContentService = createUserContentService({
  repository: userContentPersistenceInstance,
  statePort: createApplicationStatePort(),
  now: getSystemNowIso
});

/**
 * 初始化应用唯一用户内容 service。
 * 副作用: 加载 IndexedDB 保存图并完整采用 Vue 投影。
 * 成功路径: 返回已采用状态；失败路径: reject 且保持未初始化。
 *
 * @returns {Promise<object>} 已采用状态。
 */
export function initializeUserContent() {
  return applicationUserContentService.initialize();
}

/**
 * 添加收藏。
 * 副作用: 委托应用唯一 FIFO 执行 Repository-first 提交。
 *
 * @param {object} contentRef 内容引用。
 * @returns {Promise<object|null>} 收藏记录或 null。
 */
export function addFavorite(contentRef) {
  return applicationUserContentService.addFavorite(contentRef);
}

/**
 * 移除收藏。
 * 副作用: 委托应用唯一 FIFO 执行 Repository-first 提交。
 *
 * @param {object} contentRef 内容引用。
 * @returns {Promise<boolean>} 是否删除。
 */
export function removeFavorite(contentRef) {
  return applicationUserContentService.removeFavorite(contentRef);
}

/**
 * 切换收藏。
 * 副作用: 委托应用唯一 FIFO 原子决定新增或删除。
 *
 * @param {object} contentRef 内容引用。
 * @returns {Promise<object>} 切换结果。
 */
export function toggleFavorite(contentRef) {
  return applicationUserContentService.toggleFavorite(contentRef);
}

/**
 * 清空收藏。
 * 副作用: 委托应用唯一 FIFO 提交空收藏集合。
 *
 * @returns {Promise<Array<object>>} 空收藏数组。
 */
export function clearFavorites() {
  return applicationUserContentService.clearFavorites();
}

/**
 * 新增或更新播放历史。
 * 副作用: 委托应用唯一 FIFO 提交完整历史集合。
 *
 * @param {object} payload 播放历史参数。
 * @returns {Promise<object|null>} 历史记录或 null。
 */
export function upsertPlayHistory(payload) {
  return applicationUserContentService.upsertPlayHistory(payload);
}

/**
 * 原子重绑定失效源用户记录。
 * 副作用: 委托应用唯一 FIFO 和 Repository 双仓事务，成功后同时采用收藏与历史投影。
 *
 * @param {object} command 恢复类型、记录键、替代 ContentItem 与目标 Episode。
 * @returns {Promise<object|null>} 已提交恢复结果或 null。
 */
export function rebindUserContent(command) {
  return applicationUserContentService.rebindUserContent(command);
}

/**
 * 删除播放历史。
 * 副作用: 委托应用唯一 FIFO 提交删除后的完整集合。
 *
 * @param {string|object} target 历史键或引用。
 * @returns {Promise<boolean>} 是否删除。
 */
export function removePlayHistory(target) {
  return applicationUserContentService.removePlayHistory(target);
}

/**
 * 清空播放历史。
 * 副作用: 委托应用唯一 FIFO 提交空历史集合。
 *
 * @returns {Promise<Array<object>>} 空历史数组。
 */
export function clearPlayHistory() {
  return applicationUserContentService.clearPlayHistory();
}

/**
 * 保存恢复策略。
 * 副作用: 委托应用唯一 FIFO 提交 userSettings。
 *
 * @param {object} policy 完整恢复策略。
 * @returns {Promise<object>} 已提交策略。
 */
export function saveResumePolicy(policy) {
  return applicationUserContentService.saveResumePolicy(policy);
}

/**
 * 更新当前播放会话。
 * 副作用: 只写内存 currentPlaying，不进入 Repository。
 *
 * @param {object|null} currentPlaying 当前播放状态。
 * @returns {object|null} 当前会话投影。
 */
export function updateCurrentPlaying(currentPlaying) {
  return applicationUserContentService.updateCurrentPlaying(currentPlaying);
}

/**
 * 计算恢复播放决策。
 * 纯函数: 只读取已提交恢复策略和传入历史。
 *
 * @param {object|null} record 播放历史。
 * @returns {object} 恢复决策。
 */
export function getPlaybackResumeDecision(record) {
  return applicationUserContentService.getPlaybackResumeDecision(record);
}
