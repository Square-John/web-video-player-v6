/*
  indexedDbUserContentRepository.js 模块说明

  - 文件职责:
      使用 BrowserPersistenceDatabase 的受控事务保存和读取游客资料、收藏、播放历史与恢复策略。
      四类对象共享 userId 归属，currentPlaying 永远不写入 IndexedDB。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      USER_CONTENT_RECORD_LIMIT: 自定义配置，从行记录恢复集合上限。
      BROWSER_PERSISTENCE_STORE/BROWSER_PERSISTENCE_INDEX: 自定义配置，定位四个用户内容仓和用户索引。
      BROWSER_PERSISTENCE_ERROR_CODE/BrowserPersistenceError: 自定义错误，把保存对象损坏转换为稳定持久化失败。
      用户内容隔离校验函数: 自定义校验，验证 Repository 输入输出。

  - 模块级常量:
      USER_CONTENT_STORE_NAMES: Array<string>，完整只读快照覆盖的四个仓。
      USER_SETTINGS_FIELDS: Array<string>，用户设置包装记录精确字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeUserId(userId): 校验用户归属主键。
      createCorruptedError(message, cause): 创建稳定损坏对象错误。
      unwrapOwnedRecords(rows, userId, keyField): 剥离并复核 IndexedDB userId 包装。
      assertSettingsRecord(record, userId): 复核用户设置包装记录。

  - 模块级类:
      IndexedDbUserContentRepository: Class，四仓用户内容持久化适配器。

  - 对外导出:
      IndexedDbUserContentRepository: Class，供应用组合层工厂创建正式 Repository。
*/

// 导入来源: ../../config/user-content.config.js；导入内容: USER_CONTENT_RECORD_LIMIT；文件作用: 从行式 object store 恢复集合投影上限。
import { USER_CONTENT_RECORD_LIMIT } from '../../config/user-content.config.js';

import {
  // 导入来源: ../persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_STORE；文件作用: 定位四个用户内容 object store。
  BROWSER_PERSISTENCE_STORE,
  // 导入来源: ../persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_INDEX；文件作用: 按 userId 读取和替换收藏、历史。
  BROWSER_PERSISTENCE_INDEX
} from '../persistence/browserPersistence.config.js';

import {
  // 导入来源: ../persistence/browserPersistenceErrors.js；导入内容: BROWSER_PERSISTENCE_ERROR_CODE；文件作用: 标记现有保存对象损坏。
  BROWSER_PERSISTENCE_ERROR_CODE,
  // 导入来源: ../persistence/browserPersistenceErrors.js；导入内容: BrowserPersistenceError；文件作用: 保留稳定 code 和原始校验 cause。
  BrowserPersistenceError
} from '../persistence/browserPersistenceErrors.js';

import {
  // 导入来源: ./userContentRepositoryValidators.js；导入内容: cloneValidatedUserContentState；文件作用: 校验完整读取快照。
  cloneValidatedUserContentState,
  // 导入来源: ./userContentRepositoryValidators.js；导入内容: cloneValidatedUserProfile；文件作用: 校验资料输入输出。
  cloneValidatedUserProfile,
  // 导入来源: ./userContentRepositoryValidators.js；导入内容: cloneValidatedFavoritesState；文件作用: 校验收藏输入输出。
  cloneValidatedFavoritesState,
  // 导入来源: ./userContentRepositoryValidators.js；导入内容: cloneValidatedPlayHistoryState；文件作用: 校验历史输入输出。
  cloneValidatedPlayHistoryState,
  // 导入来源: ./userContentRepositoryValidators.js；导入内容: cloneValidatedResumePolicy；文件作用: 校验恢复策略输入输出。
  cloneValidatedResumePolicy
} from './userContentRepositoryValidators.js';

// 类型: Array<string>；作用: loadState 在同一 readonly transaction 中读取完整用户投影。
const USER_CONTENT_STORE_NAMES = Object.freeze([
  BROWSER_PERSISTENCE_STORE.userProfiles,
  BROWSER_PERSISTENCE_STORE.userFavorites,
  BROWSER_PERSISTENCE_STORE.userPlayHistory,
  BROWSER_PERSISTENCE_STORE.userSettings
]);

// 类型: Array<string>；作用: userSettings 行只允许用户归属和恢复策略，不保存 currentPlaying。
const USER_SETTINGS_FIELDS = Object.freeze(['userId', 'resumePolicy']);

/**
 * 校验用户归属主键。
 * 纯函数: 不修剪或转换 id，避免同一用户出现多个数据库键。
 *
 * @param {*} userId 用户 id 候选。
 * @returns {string} 原始非空 id。
 * @throws {TypeError} userId 不是非空字符串时抛出。
 */
function normalizeUserId(userId) {
  // 条件分支: userId 不是字符串或只包含空白字符时进入。
  // 执行内容: 拒绝无法作为 IndexedDB 主键和索引归属的身份。
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new TypeError('userId 必须是非空字符串');
  }
  return userId;
}

/**
 * 创建保存对象损坏错误。
 * 纯函数: 只包装原因，不修改数据库、Repository 或页面状态。
 *
 * @param {string} message 当前损坏边界诊断。
 * @param {*} cause 字段校验原始失败。
 * @returns {BrowserPersistenceError} 稳定 PERSISTENCE_DATA_CORRUPTED 错误。
 */
function createCorruptedError(message, cause) {
  return new BrowserPersistenceError(
    BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted,
    message,
    { cause }
  );
}

/**
 * 剥离并复核收藏或历史行的 userId 包装。
 * 纯函数: 返回新记录数组，不修改 IndexedDB 读取结果。
 * 失败路径: 归属不匹配、重复键或记录字段损坏时由完整状态校验转为损坏错误。
 *
 * @param {Array<object>} rows IndexedDB 索引读取行。
 * @param {string} userId 当前目标用户。
 * @param {string} keyField favoriteKey 或 historyKey。
 * @returns {Array<object>} 去除 userId 的记录副本。
 */
function unwrapOwnedRecords(rows, userId, keyField) {
  // 条件分支: 索引读取结果不是数组时进入。
  // 执行内容: 拒绝无法逐行验证的异常适配器响应。
  if (!Array.isArray(rows)) {
    throw new TypeError('用户内容索引响应必须是数组');
  }
  // 类型: Set<string>；作用: 检测当前用户索引结果中的重复业务键。
  const keys = new Set();
  return rows.map((row, index) => {
    // 条件分支: 当前行不是对象或 userId 不属于目标用户时进入。
    // 执行内容: 拒绝跨用户泄漏和无效复合键包装。
    if (!row || typeof row !== 'object' || Array.isArray(row) || row.userId !== userId) {
      throw new TypeError(`用户内容行 ${index} 的 userId 归属无效`);
    }
    // 类型: object；作用: 移除仅属于 IndexedDB 复合键包装的 userId，保留正式领域记录。
    const { userId: ignoredUserId, ...record } = row;
    // 条件分支: 当前业务键已经在前序行出现时进入。
    // 执行内容: 拒绝索引结果中的重复收藏或历史身份。
    if (keys.has(record[keyField])) {
      throw new TypeError(`用户内容行包含重复 ${keyField}`);
    }
    keys.add(record[keyField]);
    return record;
  });
}

/**
 * 复核用户设置包装记录。
 * 纯函数: 返回恢复策略隔离副本，不修改原始行。
 *
 * @param {*} record userSettings 读取结果。
 * @param {string} userId 当前目标用户。
 * @returns {object} 已验证恢复策略副本。
 */
function assertSettingsRecord(record, userId) {
  // 条件分支: 设置行为空、数组、非对象或具有自定义原型时进入。
  // 执行内容: 拒绝不符合 IndexedDB 普通保存对象语义的记录。
  if (!record || typeof record !== 'object' || Array.isArray(record)
    || Object.getPrototypeOf(record) !== Object.prototype) {
    throw new TypeError('userSettings 保存对象必须是普通对象');
  }
  // 类型: Array<string>；作用: 读取设置行实际字段，检查 currentPlaying 等影子字段。
  const fields = Object.keys(record);
  // 条件分支: 设置行字段集合或 userId 归属与契约不一致时进入。
  // 执行内容: 拒绝错误用户设置和未经契约声明的长期字段。
  if (fields.length !== USER_SETTINGS_FIELDS.length
    || fields.some(field => !USER_SETTINGS_FIELDS.includes(field))
    || record.userId !== userId) {
    throw new TypeError('userSettings 保存对象字段或归属无效');
  }
  return cloneValidatedResumePolicy(record.resumePolicy);
}

/**
 * IndexedDB 用户内容 Repository。
 * 状态所有权: 只持有调用方显式提供的 BrowserPersistenceDatabase 门面。
 * 并发规则: 每次集合替换使用一个原生 readwrite transaction；跨操作顺序由上层 service 队列协调。
 * 失败边界: 数据库失败原样使用稳定持久化错误；候选无效在开启事务前拒绝；保存对象损坏使用 dataCorrupted。
 */
export class IndexedDbUserContentRepository {
  // 类型: object；作用: 唯一数据库事务门面，不向调用方泄漏底层连接。
  #database;

  /**
   * 创建用户内容 Repository。
   * 副作用: 只保存数据库门面引用，不打开连接或读取种子。
   *
   * @param {object} options 构造选项。
   * @param {object} options.database BrowserPersistenceDatabase 门面。
   */
  constructor({ database }) {
    // 条件分支: 数据库门面缺少只读或读写事务能力时进入。
    // 执行内容: 拒绝直接 IDBDatabase 和不完整测试替身。
    if (!database || typeof database.runReadonly !== 'function'
      || typeof database.runReadwrite !== 'function') {
      throw new TypeError('IndexedDbUserContentRepository database 无效');
    }
    this.#database = database;
  }

  /**
   * 初始化并读取首次种子对应的本地用户投影。
   * 副作用: 不重复播种；空库种子已经由 BrowserPersistenceDatabase 九仓原子事务负责。
   * 成功路径: 复核 seed 身份并返回数据库中的完整隔离状态。
   * 失败路径: 用户状态缺失或损坏时失败关闭，不重新写 mock 覆盖现有数据库。
   *
   * @param {object} seedState 首次空库 UserContentState，用于确定当前本地用户身份。
   * @returns {Promise<object>} 完整 UserContentState，currentPlaying 固定为 null。
   */
  async initialize(seedState) {
    // 类型: object；作用: 复核首次种子完整结构并切断调用方引用，仅使用其中用户身份。
    const safeSeed = cloneValidatedUserContentState(seedState);
    // 类型: object|null；作用: 保存数据库中该用户完整持久化投影。
    const state = await this.loadState(safeSeed.user.id);
    // 条件分支: 数据库初始化完成后仍没有种子用户保存图时进入。
    // 执行内容: 报告损坏而不是重新播种覆盖现有数据库。
    if (!state) {
      throw createCorruptedError('已初始化数据库缺少游客用户内容保存图');
    }
    return state;
  }

  /**
   * 在一个只读事务中加载指定用户完整状态。
   * 副作用: 只读取四个用户内容仓，不写入或修复损坏对象。
   * 成功路径: 用户不存在返回 null；存在时返回资料、两个集合、null currentPlaying 和恢复策略。
   * 失败路径: 部分保存图、归属错误或字段损坏转换为 PERSISTENCE_DATA_CORRUPTED。
   *
   * @param {string} userId 目标用户 id。
   * @returns {Promise<object|null>} 隔离 UserContentState 或 null。
   */
  async loadState(userId) {
    // 类型: string；作用: 作为四仓主键或 userId 索引的统一查询身份。
    const safeUserId = normalizeUserId(userId);
    return this.#database.runReadonly(USER_CONTENT_STORE_NAMES, async (transaction) => {
      try {
        // 类型: Promise<object|undefined>；作用: 读取当前用户资料单例。
        const profilePromise = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userProfiles).get(safeUserId);
        // 类型: Promise<object|undefined>；作用: 读取当前用户恢复策略包装记录。
        const settingsPromise = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).get(safeUserId);
        // 类型: Promise<Array<object>>；作用: 通过 userId 索引读取全部收藏行。
        const favoritesPromise = transaction
          .objectStore(BROWSER_PERSISTENCE_STORE.userFavorites)
          .index(BROWSER_PERSISTENCE_INDEX.userFavoritesByUserId)
          .getAll(safeUserId);
        // 类型: Promise<Array<object>>；作用: 通过 userId 索引读取全部历史行。
        const historyPromise = transaction
          .objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory)
          .index(BROWSER_PERSISTENCE_INDEX.userPlayHistoryByUserId)
          .getAll(safeUserId);
        // 类型: Array<*>；作用: 等待同一只读事务中的四类响应，形成一致快照。
        const [profile, settings, favoriteRows, historyRows] = await Promise.all([
          profilePromise,
          settingsPromise,
          favoritesPromise,
          historyPromise
        ]);

        // 条件分支: 四个仓都没有目标用户事实时进入；这是真正“用户不存在”，不是部分损坏。
        // 执行内容: 返回 null，让调用方区分不存在与保存图损坏。
        if (profile === undefined && settings === undefined
          && favoriteRows.length === 0 && historyRows.length === 0) {
          return null;
        }
        // 条件分支: 资料或设置单例缺失时进入；收藏和历史允许合法空数组。
        // 执行内容: 抛出损坏原因，禁止拼装不完整页面投影。
        if (profile === undefined || settings === undefined) {
          throw new TypeError('用户内容保存图缺少 profile 或 settings');
        }

        // 类型: object；作用: 从行式收藏仓恢复带正式上限的 FavoritesState。
        const favorites = {
          maxRecords: USER_CONTENT_RECORD_LIMIT,
          records: unwrapOwnedRecords(favoriteRows, safeUserId, 'favoriteKey')
        };
        // 类型: object；作用: 从行式历史仓恢复带正式上限的 PlayHistoryState。
        const playHistory = {
          maxRecords: USER_CONTENT_RECORD_LIMIT,
          records: unwrapOwnedRecords(historyRows, safeUserId, 'historyKey')
        };
        return cloneValidatedUserContentState({
          user: profile,
          favorites,
          playHistory,
          currentPlaying: null,
          resumePolicy: assertSettingsRecord(settings, safeUserId)
        });
      } catch (error) {
        // 条件分支: 下层已经生成稳定持久化错误时进入。
        // 执行内容: 保留 blocked、terminated、配额或既有损坏分类。
        if (error instanceof BrowserPersistenceError) throw error;
        throw createCorruptedError(`用户 ${safeUserId} 的保存对象不符合契约`, error);
      }
    });
  }

  /**
   * 保存用户资料。
   * 副作用: 一个 userProfiles readwrite transaction 完成后返回隔离副本。
   * 成功路径: transaction.done 后返回与数据库一致的资料副本。
   * 失败路径: 候选校验在事务前失败；数据库 reject 时页面不得采用候选。
   *
   * @param {object} user 用户资料候选。
   * @returns {Promise<object>} 已提交资料副本。
   */
  async saveProfile(user) {
    // 类型: object；作用: 在创建事务前严格校验并隔离待保存资料。
    const storedUser = cloneValidatedUserProfile(user);
    return this.#database.runReadwrite(
      [BROWSER_PERSISTENCE_STORE.userProfiles],
      async transaction => {
        await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userProfiles).put(storedUser);
        return cloneValidatedUserProfile(storedUser);
      }
    );
  }

  /**
   * 原子替换当前用户完整收藏集合。
   * 副作用: 同一事务删除该 userId 旧行并写入全部新行；其他用户收藏不受影响。
   * 成功路径: transaction.done 后返回完整集合副本。
   * 失败路径: 任一 delete/put 失败时整个事务 abort，旧集合保持。
   *
   * @param {string} userId 目标用户 id。
   * @param {object} favorites 完整收藏集合。
   * @returns {Promise<object>} 已提交 FavoritesState。
   */
  async saveFavorites(userId, favorites) {
    // 类型: string；作用: 绑定旧行删除和新行写入的唯一用户归属。
    const safeUserId = normalizeUserId(userId);
    // 类型: object；作用: 在创建事务前校验完整集合和唯一键，并隔离输入。
    const storedFavorites = cloneValidatedFavoritesState(favorites);
    return this.#replaceOwnedCollection({
      storeName: BROWSER_PERSISTENCE_STORE.userFavorites,
      indexName: BROWSER_PERSISTENCE_INDEX.userFavoritesByUserId,
      userId: safeUserId,
      records: storedFavorites.records,
      state: storedFavorites,
      cloneState: cloneValidatedFavoritesState
    });
  }

  /**
   * 原子替换当前用户完整播放历史集合。
   * 副作用: 同一事务删除该 userId 旧行并写入全部新行；其他用户历史不受影响。
   * 成功路径: transaction.done 后返回完整集合副本。
   * 失败路径: 任一 delete/put 失败时整个事务 abort，旧集合保持。
   *
   * @param {string} userId 目标用户 id。
   * @param {object} playHistory 完整历史集合。
   * @returns {Promise<object>} 已提交 PlayHistoryState。
   */
  async savePlayHistory(userId, playHistory) {
    // 类型: string；作用: 绑定旧行删除和新行写入的唯一用户归属。
    const safeUserId = normalizeUserId(userId);
    // 类型: object；作用: 在创建事务前校验完整历史集合和唯一键，并隔离输入。
    const storedHistory = cloneValidatedPlayHistoryState(playHistory);
    return this.#replaceOwnedCollection({
      storeName: BROWSER_PERSISTENCE_STORE.userPlayHistory,
      indexName: BROWSER_PERSISTENCE_INDEX.userPlayHistoryByUserId,
      userId: safeUserId,
      records: storedHistory.records,
      state: storedHistory,
      cloneState: cloneValidatedPlayHistoryState
    });
  }

  /**
   * 保存当前用户播放恢复策略。
   * 副作用: 覆盖 userSettings 中该 userId 单例，不触碰收藏、历史或 currentPlaying。
   * 成功路径: transaction.done 后返回策略隔离副本。
   * 失败路径: 候选校验或数据库事务失败时不修改页面投影。
   *
   * @param {string} userId 目标用户 id。
   * @param {object} resumePolicy 恢复策略候选。
   * @returns {Promise<object>} 已提交策略副本。
   */
  async saveResumePolicy(userId, resumePolicy) {
    // 类型: string；作用: 作为 userSettings 主键和用户归属。
    const safeUserId = normalizeUserId(userId);
    // 类型: object；作用: 在创建事务前校验阈值并隔离策略输入。
    const storedPolicy = cloneValidatedResumePolicy(resumePolicy);
    return this.#database.runReadwrite(
      [BROWSER_PERSISTENCE_STORE.userSettings],
      async transaction => {
        await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).put({
          userId: safeUserId,
          resumePolicy: storedPolicy
        });
        return cloneValidatedResumePolicy(storedPolicy);
      }
    );
  }

  /**
   * 在单一事务中替换一个用户的行式集合。
   * 副作用: 删除索引命中的旧复合主键，再写入带 userId 包装的新记录。
   * 并发边界: transaction.done 由 BrowserPersistenceDatabase 等待；本方法不维护内存快照补偿。
   *
   * @param {object} options 替换参数。
   * @param {string} options.storeName 目标 object store。
   * @param {string} options.indexName userId 索引名称。
   * @param {string} options.userId 当前用户 id。
   * @param {Array<object>} options.records 已验证记录。
   * @param {object} options.state 已验证完整集合。
   * @param {Function} options.cloneState 提交后生成隔离返回值的函数。
   * @returns {Promise<object>} 提交后的完整集合副本。
   * 成功路径: 删除和写入全部进入同一事务，transaction.done 后返回隔离集合。
   * 失败路径: 任一 IndexedDB 请求失败时事务 abort，不返回候选集合。
   */
  async #replaceOwnedCollection({ storeName, indexName, userId, records, state, cloneState }) {
    return this.#database.runReadwrite([storeName], async transaction => {
      // 类型: IDBObjectStore；作用: 在当前原生事务中复用目标行式集合仓。
      const store = transaction.objectStore(storeName);
      // 类型: Array<IDBValidKey>；作用: 只定位当前 userId 的旧复合主键，保留其他用户数据。
      const existingKeys = await store.index(indexName).getAllKeys(userId);
      await Promise.all(existingKeys.map(key => store.delete(key)));
      await Promise.all(records.map(record => store.put({ userId, ...record })));
      return cloneState(state);
    });
  }
}
