/*
  homeDisplaySettingsService.js 模块说明

  - 文件职责:
      协调首页展示偏好校验、IndexedDB 提交和响应式 Store 采用。
      所有保存进入单一 FIFO，只有 Repository 成功后才替换首页与设置页共同读取的投影。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      homeDisplaySettingsPersistenceInstance: 自定义运行端口，读取和保存应用唯一展示偏好。
      userContentStore: 自定义用户投影，提供已初始化本地用户 id。
      homeDisplaySettingsStore exports: 自定义 Store，读取稳定偏好并采用提交结果。
      homeDisplay.config exports: 自定义配置，创建默认偏好并执行严格校验。

  - 模块级常量:
      SERVICE_OPTION_FIELDS: Array<string>，隔离 Service 工厂允许的精确选项。
      HOME_DISPLAY_SETTINGS_SAVE_ERROR_MESSAGE: string，保存失败的安全用户说明。
      applicationHomeDisplaySettingsService: HomeDisplaySettingsService，应用唯一展示设置 Service。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeUserId(userId): 校验设置归属用户。
      createApplicationStatePort(): 创建绑定展示设置 Store 的窄端口。

  - 模块级类:
      HomeDisplaySettingsService: Class，拥有初始化屏障、保存 FIFO 和恢复默认命令。

  - 对外导出:
      createHomeDisplaySettingsService: Function，供领域测试创建隔离 Service。
      initializeHomeDisplaySettings: Function，启动时读取并采用持久化展示偏好。
      saveHomeDisplayPreferences: Function，校验并保存完整偏好。
      restoreDefaultHomeDisplayPreferences: Function，保存项目默认偏好。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js；导入内容: homeDisplaySettingsPersistenceInstance；文件作用: 使用应用唯一 IndexedDB 展示设置窄端口。
import { homeDisplaySettingsPersistenceInstance } from '../runtime/sourceRuntimeInstance.js';

// 导入来源: ../store/userContentStore.js；导入内容: userContentStore；文件作用: 每次设置操作读取已经初始化的本地用户身份。
import { userContentStore } from '../store/userContentStore.js';

import {
  // 导入来源: ../store/homeDisplaySettingsStore.js；导入内容: homeDisplaySettingsStore；文件作用: 读取当前已提交展示偏好。
  homeDisplaySettingsStore,
  // 导入来源: ../store/homeDisplaySettingsStore.js；导入内容: replaceHomeDisplayPreferences；文件作用: Repository 成功后整体采用偏好。
  replaceHomeDisplayPreferences,
  // 导入来源: ../store/homeDisplaySettingsStore.js；导入内容: setHomeDisplaySettingsSaving；文件作用: 发布保存交互状态。
  setHomeDisplaySettingsSaving,
  // 导入来源: ../store/homeDisplaySettingsStore.js；导入内容: setHomeDisplaySettingsError；文件作用: 发布安全错误说明。
  setHomeDisplaySettingsError
} from '../store/homeDisplaySettingsStore.js';

import {
  // 导入来源: ../config/homeDisplay.config.js；导入内容: createDefaultHomeDisplayPreferences；文件作用: 恢复默认时创建独立候选。
  createDefaultHomeDisplayPreferences,
  // 导入来源: ../config/homeDisplay.config.js；导入内容: normalizeHomeDisplayPreferences；文件作用: 初始化、保存和 Repository 响应统一严格校验。
  normalizeHomeDisplayPreferences
} from '../config/homeDisplay.config.js';

// 类型: Array<string>；作用: 工厂只接受持久化端口、状态端口和用户身份读取器，拒绝备用存储或隐藏状态。
const SERVICE_OPTION_FIELDS = Object.freeze(['repository', 'statePort', 'getUserId']);

// 类型: string；作用: 数据库或未知保存失败时向设置页展示统一安全说明，不泄漏内部异常。
const HOME_DISPLAY_SETTINGS_SAVE_ERROR_MESSAGE = '界面设置保存失败，请稍后重试。';

/**
 * 校验首页展示设置归属用户。
 * 纯函数: 不修剪或转换身份，避免同一用户出现多个设置主键。
 *
 * @param {*} userId 用户身份候选。
 * @returns {string} 原始非空用户 id。
 * @throws {TypeError} 用户内容初始化尚未完成时抛出。
 */
function normalizeUserId(userId) {
  // 条件分支: 用户身份不是非空字符串时进入；执行内容: 阻止展示设置写入未知 userSettings 单例。
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new TypeError('首页展示设置用户尚未初始化');
  }
  return userId;
}

/**
 * 创建绑定应用响应式 Store 的窄状态端口。
 * 纯函数: 只返回冻结函数引用；真正状态副作用发生在 Service 调用端口时。
 *
 * @returns {Readonly<object>} 展示偏好读取和采用端口。
 */
function createApplicationStatePort() {
  return Object.freeze({
    state: homeDisplaySettingsStore,
    replacePreferences: replaceHomeDisplayPreferences,
    setSaving: setHomeDisplaySettingsSaving,
    setError: setHomeDisplaySettingsError
  });
}

/**
 * 首页展示设置 Service。
 * 状态所有权: 初始化 Promise、就绪标记、保存 FIFO 和待处理数只属于当前实例。
 * 并发规则: 保存严格串行；每项 Repository 提交成功后才采用偏好。
 * 失败边界: 候选校验或 Repository reject 时保留旧投影，失败不会阻塞后续保存。
 */
class HomeDisplaySettingsService {
  // 类型: object；作用: 展示偏好持久化窄端口，只暴露读取和保存当前用户设置的能力。
  #repository;
  // 类型: object；作用: 当前实例对应的响应式状态端口，负责采用提交结果和发布交互状态。
  #statePort;
  // 类型: Function；作用: 每次初始化或保存命令读取当前用户身份，避免缓存跨会话 userId。
  #getUserId;
  // 类型: boolean；作用: 记录初始化屏障；true 允许保存，false 使保存失败关闭。
  #initialized = false;
  // 类型: Promise<object>|null；作用: 合并并发初始化，失败后清空以允许显式重试。
  #initializationPromise = null;
  // 类型: Promise<void>；作用: 保存命令 FIFO 的前一项收敛屏障，失败不会阻断后续命令。
  #writeQueue = Promise.resolve();
  // 类型: number；作用: 尚未收敛的保存命令数量，用于保持 saving 状态直到队列清空。
  #pendingSaveCount = 0;

  /**
   * 创建首页展示设置 Service。
   * 副作用: 只保存依赖和空队列，不读取数据库或修改投影。
   *
   * @param {object} options 显式依赖。
   * @param {object} options.repository 展示偏好读取和保存端口。
   * @param {object} options.statePort 响应式投影读取和采用端口。
   * @param {Function} options.getUserId 当前用户身份读取函数。
   */
  constructor({ repository, statePort, getUserId }) {
    // 条件分支: Repository 缺少读取或保存能力时进入；执行内容: 拒绝只读、只写或备用存储端口。
    if (!repository
      || typeof repository.loadHomeDisplayPreferences !== 'function'
      || typeof repository.saveHomeDisplayPreferences !== 'function') {
      throw new TypeError('HomeDisplaySettingsService repository 无效');
    }
    // 条件分支: 状态端口不完整时进入；执行内容: 拒绝页面直接修改偏好或缺失失败状态的替身。
    if (!statePort || !statePort.state
      || typeof statePort.replacePreferences !== 'function'
      || typeof statePort.setSaving !== 'function'
      || typeof statePort.setError !== 'function') {
      throw new TypeError('HomeDisplaySettingsService statePort 无效');
    }
    // 条件分支: 用户身份端口不是函数时进入；执行内容: 拒绝构造时缓存第二份 userId。
    if (typeof getUserId !== 'function') {
      throw new TypeError('HomeDisplaySettingsService getUserId 必须是函数');
    }
    this.#repository = repository;
    this.#statePort = statePort;
    this.#getUserId = getUserId;
  }

  /**
   * 初始化首页展示设置投影。
   * 副作用: 读取当前用户 userSettings，并在严格校验后整体替换 Store。
   * 成功路径: 并发调用复用同一 Promise，偏好采用后开放保存命令。
   * 失败路径: 保持旧或空投影并清空初始化 Promise，允许显式重试。
   *
   * @returns {Promise<object>} 已采用 HomeDisplayPreferences。
   */
  initialize() {
    // 条件分支: 已初始化时进入；执行内容: 返回当前已提交投影，不重复读取数据库。
    if (this.#initialized) return Promise.resolve(this.#statePort.state.preferences);
    // 条件分支: 初始化正在执行时进入；执行内容: 复用同一 Promise，避免读取结果竞争采用。
    if (this.#initializationPromise) return this.#initializationPromise;

    // 类型: string；作用: 绑定本次初始化到已经完成用户内容启动的用户身份。
    const userId = normalizeUserId(this.#getUserId());
    this.#initializationPromise = this.#repository.loadHomeDisplayPreferences(userId)
      .then((preferences) => {
        // 类型: object；作用: Repository 结果再次经过领域校验，确保首页和设置页消费同一结构。
        const normalizedPreferences = normalizeHomeDisplayPreferences(preferences);
        // 类型: object；作用: 只有读取和校验成功后才采用响应式投影。
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
   * 保存完整首页展示偏好。
   * 副作用: 命令进入实例 FIFO，提交 IndexedDB 成功后采用偏好，并更新保存与错误交互状态。
   * 成功路径: 返回 Repository 已提交并经运行时复核的 HomeDisplayPreferences。
   * 失败路径: 保留旧偏好、发布安全错误并把原始错误继续 reject 给页面。
   *
   * @param {object} preferences 完整首页展示偏好候选。
   * @returns {Promise<object>} 已提交展示偏好。
   */
  save(preferences) {
    // 条件分支: 初始化尚未完成时进入；执行内容: 拒绝以页面草稿代替启动恢复结果。
    if (!this.#initialized) {
      return Promise.reject(new TypeError('首页展示设置尚未初始化'));
    }
    // 类型: object；作用: 保存排队前的严格校验结果，候选无效时不进入 FIFO。
    let normalizedPreferences;
    try {
      normalizedPreferences = normalizeHomeDisplayPreferences(preferences);
    } catch (error) {
      // 失败传播: 输入校验失败也以 Promise reject 对外提供，保持页面命令的统一异步契约。
      this.#statePort.setError(HOME_DISPLAY_SETTINGS_SAVE_ERROR_MESSAGE);
      return Promise.reject(error);
    }
    this.#statePort.setError('');
    this.#pendingSaveCount += 1;
    this.#statePort.setSaving(true);

    // 类型: Promise<object>；作用: 当前命令等待上一屏障收敛后再读取用户身份并提交事务。
    const operation = this.#writeQueue.then(async () => {
      // 类型: string；作用: 每次命令重新读取用户身份，避免缓存身份跨会话使用。
      const userId = normalizeUserId(this.#getUserId());
      // 类型: object；作用: 保存 Repository 提交结果，禁止采用未提交页面候选。
      const savedPreferences = await this.#repository.saveHomeDisplayPreferences(userId, normalizedPreferences);
      // 类型: object；作用: 复核适配器响应，损坏结果不得进入首页渲染。
      const verifiedPreferences = normalizeHomeDisplayPreferences(savedPreferences);
      return this.#statePort.replacePreferences(verifiedPreferences);
    });

    // 并发边界: 内部屏障吸收当前 reject，保证后续用户修正设置后仍能进入 FIFO。
    this.#writeQueue = operation.then(() => undefined, () => undefined);
    return operation
      .catch((error) => {
        this.#statePort.setError(HOME_DISPLAY_SETTINGS_SAVE_ERROR_MESSAGE);
        throw error;
      })
      .finally(() => {
        // 状态变化: 当前命令收敛后减少待处理数；只有整个 FIFO 已空才关闭保存状态。
        this.#pendingSaveCount -= 1;
        this.#statePort.setSaving(this.#pendingSaveCount > 0);
      });
  }

  /**
   * 恢复项目默认首页展示偏好。
   * 副作用: 复用 save FIFO，把新建默认对象提交到同一 userSettings 单例。
   *
   * @returns {Promise<object>} 已提交默认 HomeDisplayPreferences。
   */
  restoreDefaults() {
    return this.save(createDefaultHomeDisplayPreferences());
  }
}

/**
 * 创建隔离首页展示设置 Service。
 * 纯函数: 校验精确选项后返回新实例，不读取数据库或修改 Store。
 *
 * @param {object} options 显式依赖。
 * @returns {HomeDisplaySettingsService} 隔离 Service。
 */
export function createHomeDisplaySettingsService(options) {
  // 条件分支: 选项不是普通对象或字段集合偏离契约时进入；执行内容: 阻止备用存储和隐藏端口注入。
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).sort().join(',') !== [...SERVICE_OPTION_FIELDS].sort().join(',')) {
    throw new TypeError('createHomeDisplaySettingsService options 字段无效');
  }
  return new HomeDisplaySettingsService(options);
}

// 类型: HomeDisplaySettingsService。
// 作用: 应用唯一展示设置 Service；用户身份实时读取 userContentStore，不复制用户状态。
const applicationHomeDisplaySettingsService = createHomeDisplaySettingsService({
  repository: homeDisplaySettingsPersistenceInstance,
  statePort: createApplicationStatePort(),
  /**
   * 读取已初始化本地用户身份。
   * 纯函数: 只读取 userContentStore.user.id，不修改用户内容或展示偏好。
   *
   * @returns {string} 当前本地用户 id；未初始化时为空字符串。
   */
  getUserId() {
    return userContentStore.user?.id || '';
  }
});

/**
 * 初始化应用首页展示设置。
 * 副作用: 委托应用唯一 Service 读取并采用 IndexedDB 偏好。
 *
 * @returns {Promise<object>} 已采用展示偏好。
 */
export function initializeHomeDisplaySettings() {
  return applicationHomeDisplaySettingsService.initialize();
}

/**
 * 保存应用首页展示偏好。
 * 副作用: 委托应用唯一 FIFO，在 Repository 提交成功后更新设置页与首页。
 *
 * @param {object} preferences 完整 HomeDisplayPreferences 候选。
 * @returns {Promise<object>} 已提交展示偏好。
 */
export function saveHomeDisplayPreferences(preferences) {
  return applicationHomeDisplaySettingsService.save(preferences);
}

/**
 * 恢复并保存项目默认首页展示偏好。
 * 副作用: 委托应用唯一 FIFO，不在页面直接覆盖响应式投影。
 *
 * @returns {Promise<object>} 已提交默认展示偏好。
 */
export function restoreDefaultHomeDisplayPreferences() {
  return applicationHomeDisplaySettingsService.restoreDefaults();
}
