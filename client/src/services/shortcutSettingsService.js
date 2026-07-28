/*
  shortcutSettingsService.js 模块说明

  - 文件职责:
      协调快捷键偏好校验、IndexedDB 提交和 shortcutSettingsStore 响应式采用。
      设置写入经过单一 FIFO，只有 Repository 成功后才替换播放器与设置页共同读取的偏好投影。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      shortcutSettingsPersistenceInstance: 自定义运行端口，读取和保存应用唯一快捷键偏好。
      userContentStore: 自定义用户投影，提供已初始化本地用户 id。
      shortcutSettingsStore exports: 自定义设置 store，读取稳定偏好并采用提交结果。
      playbackShortcutService exports: 自定义播放 service，创建默认偏好并执行严格结构与冲突校验。

  - 模块级常量:
      SERVICE_OPTION_FIELDS: Array<string>，隔离 service 工厂允许的精确选项。
      applicationShortcutSettingsService: ShortcutSettingsService，应用唯一快捷键设置 service。
      SHORTCUT_SETTINGS_SAVE_ERROR_MESSAGE: string，保存失败的安全用户说明。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeUserId(userId): 校验设置归属用户。
      createApplicationStatePort(): 创建绑定快捷键设置 store 的窄端口。

  - 模块级类:
      ShortcutSettingsService: Class，拥有初始化屏障、保存 FIFO 和设置命令。

  - 对外导出:
      createShortcutSettingsService: Function，供集成测试创建隔离 service。
      initializeShortcutSettings: Function，启动时读取并采用持久化快捷键偏好。
      saveShortcutPreferences: Function，校验并保存完整偏好。
      restoreDefaultShortcutPreferences: Function，保存项目默认偏好。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js；导入内容: shortcutSettingsPersistenceInstance；文件作用: 使用应用唯一 IndexedDB 快捷键设置端口。
import { shortcutSettingsPersistenceInstance } from '../runtime/sourceRuntimeInstance.js';

// 导入来源: ../store/userContentStore.js；导入内容: userContentStore；文件作用: 读取启动链已经采用的本地用户身份。
import { userContentStore } from '../store/userContentStore.js';

import {
  // 导入来源: ../store/shortcutSettingsStore.js；导入内容: shortcutSettingsStore；文件作用: 读取当前已提交偏好投影。
  shortcutSettingsStore,
  // 导入来源: ../store/shortcutSettingsStore.js；导入内容: replaceShortcutPreferences；文件作用: Repository 成功后整体采用偏好。
  replaceShortcutPreferences,
  // 导入来源: ../store/shortcutSettingsStore.js；导入内容: setShortcutSettingsSaving；文件作用: 发布保存交互状态。
  setShortcutSettingsSaving,
  // 导入来源: ../store/shortcutSettingsStore.js；导入内容: setShortcutSettingsError；文件作用: 发布安全错误说明。
  setShortcutSettingsError
} from '../store/shortcutSettingsStore.js';

import {
  // 导入来源: ./playbackShortcutService.js；导入内容: createDefaultPlaybackShortcutPreferences；文件作用: 生成恢复默认值候选。
  createDefaultPlaybackShortcutPreferences,
  // 导入来源: ./playbackShortcutService.js；导入内容: normalizePlaybackShortcutPreferences；文件作用: 保存前执行完整结构和冲突校验。
  normalizePlaybackShortcutPreferences
} from './playbackShortcutService.js';

// 类型: Array<string>；作用: 工厂只接受持久化端口、状态端口和用户身份读取器，拒绝备用存储或隐式模式。
const SERVICE_OPTION_FIELDS = Object.freeze(['repository', 'statePort', 'getUserId']);

// 类型: string；作用: 数据库或未知保存失败时向设置页展示统一安全说明，不泄漏内部异常。
const SHORTCUT_SETTINGS_SAVE_ERROR_MESSAGE = '快捷键设置保存失败，请稍后重试。';

/**
 * 校验快捷键设置归属用户。
 * 纯函数: 不修剪或转换身份，避免同一用户出现多个设置主键。
 *
 * @param {*} userId 用户身份候选。
 * @returns {string} 原始非空用户 id。
 * @throws {TypeError} 用户内容初始化尚未完成时抛出。
 */
function normalizeUserId(userId) {
  // 条件分支: 用户身份不是非空字符串时进入。
  // 执行内容: 阻止设置在用户内容启动前写入未知 userSettings 单例。
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new TypeError('快捷键设置用户尚未初始化');
  }
  return userId;
}

/**
 * 创建绑定应用响应式 store 的窄状态端口。
 * 纯函数: 只返回冻结函数引用；真正状态副作用发生在 service 调用端口时。
 *
 * @returns {Readonly<object>} 快捷键投影读取和采用端口。
 */
function createApplicationStatePort() {
  return Object.freeze({
    state: shortcutSettingsStore,
    replacePreferences: replaceShortcutPreferences,
    setSaving: setShortcutSettingsSaving,
    setError: setShortcutSettingsError
  });
}

/**
 * 快捷键设置 service。
 * 状态所有权: 初始化 Promise、是否就绪和保存 FIFO 只属于当前实例。
 * 并发规则: 保存命令严格串行；每项 Repository 提交成功后才采用偏好。
 * 失败边界: 候选校验或 Repository reject 时保留旧投影，失败不会阻塞后续保存。
 */
class ShortcutSettingsService {
  // 类型: object；作用: 快捷键设置持久化窄端口，不暴露数据库或用户内容其他写能力。
  #repository;
  // 类型: object；作用: 当前实例对应的响应式或测试状态读取与采用端口。
  #statePort;
  // 类型: Function；作用: 每次命令取得已初始化用户 id，不缓存第二份用户身份。
  #getUserId;
  // 类型: boolean；作用: true 允许保存命令，false 在初始化完成前失败关闭。
  #initialized = false;
  // 类型: Promise<object>|null；作用: 合并同实例并发初始化，失败后清空以允许显式重试。
  #initializationPromise = null;
  // 类型: Promise<void>；作用: 保存上一写命令收敛屏障，reject 已被内部吸收以继续 FIFO。
  #writeQueue = Promise.resolve();
  // 类型: number；作用: 记录已排队且尚未收敛的保存命令，保证并发保存期间 saving 不提前关闭。
  #pendingSaveCount = 0;

  /**
   * 创建快捷键设置 service。
   * 副作用: 只保存依赖和空队列，不读取数据库或修改投影。
   *
   * @param {object} options 显式依赖。
   * @param {object} options.repository 读取和保存快捷键偏好的持久化端口。
   * @param {object} options.statePort 设置投影读取和采用端口。
   * @param {Function} options.getUserId 当前用户身份读取函数。
   */
  constructor({ repository, statePort, getUserId }) {
    // 条件分支: Repository 缺少读取或保存能力时进入。
    // 执行内容: 拒绝只读、只写或备用存储端口。
    if (!repository
      || typeof repository.loadShortcutPreferences !== 'function'
      || typeof repository.saveShortcutPreferences !== 'function') {
      throw new TypeError('ShortcutSettingsService repository 无效');
    }
    // 条件分支: 状态端口缺少投影或采用函数时进入。
    // 执行内容: 拒绝页面直接修改偏好和没有失败状态的测试替身。
    if (!statePort || !statePort.state
      || typeof statePort.replacePreferences !== 'function'
      || typeof statePort.setSaving !== 'function'
      || typeof statePort.setError !== 'function') {
      throw new TypeError('ShortcutSettingsService statePort 无效');
    }
    // 条件分支: 用户身份端口不是函数时进入。
    // 执行内容: 拒绝构造时缓存 userId 或从 Repository 猜测归属。
    if (typeof getUserId !== 'function') {
      throw new TypeError('ShortcutSettingsService getUserId 必须是函数');
    }
    this.#repository = repository;
    this.#statePort = statePort;
    this.#getUserId = getUserId;
  }

  /**
   * 初始化快捷键设置投影。
   * 副作用: 读取当前用户 userSettings，并在校验成功后整体替换 store。
   * 成功路径: 并发调用复用同一 Promise，偏好采用后开放保存命令。
   * 失败路径: 保持旧或空投影、initialized=false，并清空 Promise 允许显式重试。
   *
   * @returns {Promise<object>} 已采用 ShortcutPreferences。
   */
  initialize() {
    // 条件分支: 当前实例已初始化时进入。
    // 执行内容: 返回当前已提交投影，不重复读取数据库。
    if (this.#initialized) return Promise.resolve(this.#statePort.state.preferences);
    // 条件分支: 初始化正在执行时进入。
    // 执行内容: 复用同一 Promise，避免两个读取结果竞争采用 store。
    if (this.#initializationPromise) return this.#initializationPromise;

    // 类型: string；作用: 绑定本次初始化只读事务到已完成用户内容启动的用户身份。
    const userId = normalizeUserId(this.#getUserId());
    this.#initializationPromise = this.#repository.loadShortcutPreferences(userId)
      .then((preferences) => {
        // 类型: object；作用: Repository 结果再次经过运行时校验，保证播放器和设置页消费同一冻结语义。
        const normalizedPreferences = normalizePlaybackShortcutPreferences(preferences);
        // 类型: object；作用: 只有读取和校验均成功后才采用并保存当前响应式偏好投影。
        const adoptedPreferences = this.#statePort.replacePreferences(normalizedPreferences);
        this.#initialized = true;
        return adoptedPreferences;
      })
      .catch((error) => {
        this.#initialized = false;
        this.#initializationPromise = null;
        throw error;
      });
    return this.#initializationPromise;
  }

  /**
   * 保存完整快捷键偏好。
   * 副作用: 把命令加入实例 FIFO，提交 IndexedDB 成功后采用偏好，并更新保存与错误交互状态。
   * 成功路径: 返回 Repository 已提交并经运行时复核的 ShortcutPreferences。
   * 失败路径: 保留旧偏好，发布安全错误，原始错误继续 reject 给页面收敛。
   *
   * @param {object} preferences 完整快捷键偏好候选。
   * @returns {Promise<object>} 已提交快捷键偏好。
   */
  save(preferences) {
    // 条件分支: 当前实例尚未初始化时进入。
    // 执行内容: 拒绝以页面草稿代替启动恢复结果。
    if (!this.#initialized) {
      return Promise.reject(new TypeError('快捷键设置尚未初始化'));
    }
    // 类型: object；作用: 在排队前校验结构与冲突，并创建不共享调用方引用的冻结候选。
    const normalizedPreferences = normalizePlaybackShortcutPreferences(preferences);
    // 副作用: 保存开始前清除旧错误并发布进行中状态；偏好本身保持最近提交结果。
    this.#statePort.setError('');
    this.#pendingSaveCount += 1;
    this.#statePort.setSaving(true);

    // 类型: Promise<object>；作用: 当前保存命令在前一屏障收敛后读取最新用户身份并执行事务。
    const operation = this.#writeQueue.then(async () => {
      // 类型: string；作用: 每次命令重新读取用户身份，避免缓存身份跨会话使用。
      const userId = normalizeUserId(this.#getUserId());
      // 类型: object；作用: 保存 Repository 提交后的隔离偏好，禁止采用未提交候选。
      const savedPreferences = await this.#repository.saveShortcutPreferences(userId, normalizedPreferences);
      // 类型: object；作用: 复核 Repository 响应，防止损坏适配器结果进入播放器。
      const verifiedPreferences = normalizePlaybackShortcutPreferences(savedPreferences);
      return this.#statePort.replacePreferences(verifiedPreferences);
    });

    // 并发边界: 内部屏障吸收当前 reject，保证后续用户修正配置后仍能进入 FIFO。
    this.#writeQueue = operation.then(() => undefined, () => undefined);
    return operation
      .catch((error) => {
        // 副作用: 只发布稳定用户说明；原始错误不写入 store，继续交给调用页面处理。
        this.#statePort.setError(SHORTCUT_SETTINGS_SAVE_ERROR_MESSAGE);
        throw error;
      })
      .finally(() => {
        // 状态变化: 当前命令收敛后减少待处理数；只有整个 FIFO 已空才关闭保存状态。
        this.#pendingSaveCount -= 1;
        this.#statePort.setSaving(this.#pendingSaveCount > 0);
      });
  }

  /**
   * 恢复项目默认快捷键。
   * 副作用: 复用 save FIFO 把默认偏好提交到同一 userSettings 单例。
   * 成功路径: 返回已提交默认偏好。
   * 失败路径: 与普通保存相同，保持旧投影并传播错误。
   *
   * @returns {Promise<object>} 已提交默认 ShortcutPreferences。
   */
  restoreDefaults() {
    return this.save(createDefaultPlaybackShortcutPreferences());
  }
}

/**
 * 创建隔离快捷键设置 service。
 * 纯函数: 校验精确选项后返回新实例，不读取数据库或修改 store。
 *
 * @param {object} options 显式依赖。
 * @returns {ShortcutSettingsService} 隔离 service。
 */
export function createShortcutSettingsService(options) {
  // 条件分支: 选项不是普通对象或字段集合偏离工厂契约时进入。
  // 执行内容: 阻止测试和调用方注入备用存储、默认回退或隐藏状态端口。
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).sort().join(',') !== [...SERVICE_OPTION_FIELDS].sort().join(',')) {
    throw new TypeError('createShortcutSettingsService options 字段无效');
  }
  return new ShortcutSettingsService(options);
}

// 类型: ShortcutSettingsService。
// 作用: 应用唯一快捷键设置 service；用户身份实时读取 userContentStore，不复制用户状态。
const applicationShortcutSettingsService = createShortcutSettingsService({
  repository: shortcutSettingsPersistenceInstance,
  statePort: createApplicationStatePort(),
  /**
   * 读取已初始化本地用户身份。
   * 纯函数: 只读取 userContentStore.user.id，不修改用户内容或设置投影。
   *
   * @returns {string} 当前本地用户 id；未初始化时为空字符串。
   */
  getUserId() {
    return userContentStore.user?.id || '';
  }
});

/**
 * 初始化应用快捷键设置。
 * 副作用: 委托应用唯一 service 读取并采用 IndexedDB 偏好。
 *
 * @returns {Promise<object>} 已采用快捷键偏好。
 */
export function initializeShortcutSettings() {
  return applicationShortcutSettingsService.initialize();
}

/**
 * 保存应用快捷键偏好。
 * 副作用: 委托应用唯一 FIFO，在 Repository 提交成功后更新设置页与播放器。
 *
 * @param {object} preferences 完整快捷键偏好候选。
 * @returns {Promise<object>} 已提交快捷键偏好。
 */
export function saveShortcutPreferences(preferences) {
  return applicationShortcutSettingsService.save(preferences);
}

/**
 * 恢复并保存项目默认快捷键偏好。
 * 副作用: 委托应用唯一 FIFO，不在页面直接覆盖响应式投影。
 *
 * @returns {Promise<object>} 已提交默认快捷键偏好。
 */
export function restoreDefaultShortcutPreferences() {
  return applicationShortcutSettingsService.restoreDefaults();
}
