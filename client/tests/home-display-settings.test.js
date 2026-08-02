/*
  home-display-settings.test.js 模块说明

  - 文件职责:
      验证首页展示偏好 Service 的严格校验、初始化屏障、保存 FIFO 和 Repository-first 投影采用。
      测试使用显式内存替身观察端口调用顺序，不把替身当作生产持久化实现。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:assert/strict: 内置断言，验证保存顺序和状态不变量。
      node:test: 内置测试运行器，注册展示偏好领域用例。
      homeDisplaySettingsService: 自定义 Service，执行被测初始化和保存命令。
      homeDisplay.config: 自定义配置，提供正式轮播数量边界并避免测试复制产品常量。

  - 模块级常量:
      HOME_DISPLAY_PREFERENCES: object，合法展示偏好测试夹具。
      HOME_CAROUSEL_ITEM_LIMIT: Readonly<object>，生产配置导出的轮播数量边界。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createStatePort(): 创建隔离响应式投影替身。
      createRepository(): 创建可记录调用顺序的持久化端口替身。
      getVisitorUserId(): 返回测试使用的稳定游客身份。

  - 模块级类:
      无

  - 对外导出:
      无，测试文件由 node:test 执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证展示偏好状态和失败不变量。
import assert from 'node:assert/strict';

// 导入来源: node:test；导入内容: test；文件作用: 注册隔离的展示偏好 Service 用例。
import test from 'node:test';

import {
  // 导入来源: ../src/services/homeDisplaySettingsService.js；导入内容: createHomeDisplaySettingsService；文件作用: 创建隔离被测 Service。
  createHomeDisplaySettingsService
} from '../src/services/homeDisplaySettingsService.js';

// 导入来源: ../src/config/homeDisplay.config.js；导入内容: HOME_CAROUSEL_ITEM_LIMIT；文件作用: 用生产边界验证最大合法值和首个越界值。
import { HOME_CAROUSEL_ITEM_LIMIT } from '../src/config/homeDisplay.config.js';

// 类型: object；作用: 合法 HomeDisplayPreferences 夹具，测试不修改该对象。
const HOME_DISPLAY_PREFERENCES = Object.freeze({
  schemaVersion: '1.0.0',
  carouselItemLimit: 4
});

/**
 * 创建隔离状态端口。
 * 纯函数: 每次返回新投影和明确状态修改入口，不访问应用 Store。
 *
 * @returns {object} Service 可用状态端口及其测试投影。
 */
function createStatePort() {
  // 类型: object；作用: 保存当前测试 Service 可观察的偏好、保存状态和安全错误投影。
  const state = {
    preferences: null,
    saving: false,
    errorMessage: ''
  };
  return {
    state,
    /**
     * 采用 Repository 已提交首页展示偏好。
     * 副作用: 整体替换测试投影并清空旧错误；返回隔离副本防止 Service 取得内部引用。
     *
     * @param {object} preferences Repository 返回的已提交偏好。
     * @returns {object} 当前已采用偏好的隔离副本。
     */
    replacePreferences(preferences) {
      state.preferences = structuredClone(preferences);
      state.errorMessage = '';
      return structuredClone(state.preferences);
    },
    /**
     * 发布保存交互状态。
     * 副作用: 只修改测试投影 saving；true 表示仍有队列命令，false 表示队列已收敛。
     *
     * @param {boolean} saving Service 当前保存状态。
     * @returns {void}
     */
    setSaving(saving) {
      state.saving = saving === true;
    },
    /**
     * 发布面向设置页的安全错误。
     * 副作用: 只修改测试投影 errorMessage，不改动已提交偏好。
     *
     * @param {string} message Service 提供的安全错误文案。
     * @returns {void}
     */
    setError(message) {
      state.errorMessage = typeof message === 'string' ? message : '';
    }
  };
}

/**
 * 创建可记录的 Repository 端口。
 * 纯函数: 每个用例获得独立保存对象和调用日志；没有隐式重试或第二存储。
 *
 * @param {Array<string>} calls 记录读取和保存顺序的数组。
 * @returns {object} Service Repository 端口。
 */
function createRepository(calls) {
  // 类型: object；作用: 保存 Repository 替身当前提交事实，每次调用返回隔离副本。
  let storedPreferences = {
    schemaVersion: '1.0.0',
    carouselItemLimit: HOME_CAROUSEL_ITEM_LIMIT.defaultValue
  };
  return {
    /**
     * 读取指定用户的首页展示偏好。
     * 副作用: 记录调用顺序；不修改保存对象。
     * 成功路径: 返回当前保存对象的隔离副本。
     * 失败路径: 本测试替身不主动失败，生产失败由 Service 测试另行注入。
     *
     * @param {string} userId 当前测试用户身份。
     * @returns {Promise<object>} 当前保存偏好的隔离副本。
     */
    async loadHomeDisplayPreferences(userId) {
      calls.push(`load:${userId}`);
      return structuredClone(storedPreferences);
    },
    /**
     * 保存指定用户的完整首页展示偏好。
     * 副作用: 记录调用顺序并整体替换 Repository 替身保存对象。
     * 成功路径: 保存后返回新的隔离副本。
     * 失败路径: 本测试替身不主动失败，生产事务失败由其他领域测试覆盖。
     *
     * @param {string} userId 当前测试用户身份。
     * @param {object} preferences 已通过 Service 校验的完整偏好。
     * @returns {Promise<object>} 已提交偏好的隔离副本。
     */
    async saveHomeDisplayPreferences(userId, preferences) {
      calls.push(`save:${userId}:${preferences.carouselItemLimit}`);
      storedPreferences = structuredClone(preferences);
      return structuredClone(storedPreferences);
    }
  };
}

/**
 * 返回隔离测试使用的稳定游客身份。
 * 纯函数: 不读取应用 Store，不产生跨用例状态。
 *
 * @returns {string} 测试 userSettings 主键。
 */
function getVisitorUserId() {
  return 'visitor';
}

test('首页展示偏好初始化后严格保存并采用 Repository 结果', async () => {
  // 类型: Array<string>；作用: 证明初始化读取先于保存，且并发保存按 FIFO 收敛。
  const calls = [];
  // 类型: object；作用: 创建隔离状态投影端口。
  const statePort = createStatePort();
  // 类型: HomeDisplaySettingsService；作用: 使用显式用户身份和 Repository 替身执行领域命令。
  const service = createHomeDisplaySettingsService({
    repository: createRepository(calls),
    statePort,
    getUserId: getVisitorUserId
  });

  await service.initialize();
  // 类型: Promise<object>；作用: 保存第一条轮播数量命令，后续与第二条共同验证 FIFO。
  const firstSave = service.save(HOME_DISPLAY_PREFERENCES);
  // 类型: Promise<object>；作用: 保存紧随第一条提交的正式最大值，证明二十四条边界可以通过完整 Service 事务。
  const secondSave = service.save({
    schemaVersion: '1.0.0',
    carouselItemLimit: HOME_CAROUSEL_ITEM_LIMIT.maximum
  });
  await Promise.all([firstSave, secondSave]);

  assert.deepEqual(calls, [
    'load:visitor',
    'save:visitor:4',
    `save:visitor:${HOME_CAROUSEL_ITEM_LIMIT.maximum}`
  ]);
  assert.equal(statePort.state.preferences.carouselItemLimit, HOME_CAROUSEL_ITEM_LIMIT.maximum);
  assert.equal(statePort.state.saving, false);
});

test('首页展示偏好非法数量在 Repository 前失败并保留旧投影', async () => {
  // 类型: Array<string>；作用: 证明非法候选不会打开保存事务或调用 Repository。
  const calls = [];
  // 类型: object；作用: 创建隔离状态投影端口。
  const statePort = createStatePort();
  // 类型: HomeDisplaySettingsService；作用: 创建已经可初始化但尚未采用候选的 Service。
  const service = createHomeDisplaySettingsService({
    repository: createRepository(calls),
    statePort,
    getUserId: getVisitorUserId
  });
  await service.initialize();

  // 类型: number；作用: 使用正式上限之后的第一个步进值验证越界失败，不在测试中复制易漂移的产品数字。
  const firstOutOfRangeItemLimit = HOME_CAROUSEL_ITEM_LIMIT.maximum + HOME_CAROUSEL_ITEM_LIMIT.step;
  await assert.rejects(
    service.save({ schemaVersion: '1.0.0', carouselItemLimit: firstOutOfRangeItemLimit }),
    error => error instanceof TypeError
  );
  assert.deepEqual(calls, ['load:visitor']);
  assert.equal(
    statePort.state.preferences.carouselItemLimit,
    HOME_CAROUSEL_ITEM_LIMIT.defaultValue
  );
  assert.equal(statePort.state.saving, false);
});
