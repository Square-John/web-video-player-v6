/*
  userContentStore.js 模块说明

  - 文件职责:
      提供项目内部用户内容状态的运行时内存 store。
      保存收藏记录、播放历史、当前播放状态和播放恢复策略。
      当前项目只从 user-content.mock.js 初始化，不写 localStorage、IndexedDB 或磁盘文件。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 1 条，自定义 1 条):
      Vue: 第三方库，提供 Vue.observable 和 Vue.set 响应式能力。
      userContentMockData: 自定义数据，用户内容状态初始化 mock 数据。

  - 模块级常量:
      无

  - 模块级变量:
      userContentStore: object，用户内容运行时响应式状态对象。

  - 模块级辅助函数:
      cloneUserContentState(state)
          - params:
              -- state: object，待克隆的用户内容状态。
          - return:
              object，深拷贝后的用户内容状态。
          - description:
              用 JSON 深拷贝隔离 mock 初始化数据和运行时可变状态。
      createInitialUserContentState()
          - params:
              无
          - return:
              object，初始用户内容状态。
          - description:
              从 user-content.mock.js 创建可写入 Vue.observable 的初始状态。

  - 模块级类:
      无

  - 对外导出:
      userContentStore: object，用户内容运行时响应式状态对象。
      resetUserContentStore: Function，重置用户内容状态。
      replaceFavoriteRecords: Function，替换收藏记录列表。
      replacePlayHistoryRecords: Function，替换播放历史记录列表。
      setCurrentPlaying: Function，写入当前播放状态。
*/

// 导入来源: vue。
// 导入内容: Vue 构造函数。
// 文件作用: 用于创建用户内容响应式 store，并安全写入动态字段。
import Vue from 'vue';

// 导入来源: ../data/user-content.mock。
// 导入内容: userContentMockData 用户内容初始化 mock 数据。
// 文件作用: 当前项目每次重置都从该对象深拷贝出干净运行时状态。
import { userContentMockData } from '../data/user-content.mock.js';

/**
 * 深拷贝用户内容状态。
 * 纯函数: 不修改传入 state，返回一份新的普通对象。
 * 适用边界: 当前 mock 数据只包含 JSON 可序列化字段，因此可以使用 JSON 深拷贝。
 *
 * @param {object} state 待克隆的用户内容状态。
 * @returns {object} 深拷贝后的用户内容状态。
 */
function cloneUserContentState(state) {
  // 类型: object。
  // 作用: state 不是对象时使用空对象兜底，避免 JSON.stringify 异常。
  const safeState = state && typeof state === 'object' ? state : {};

  // 返回值类型: object。
  // 作用: 返回和 mock 文件彻底断开引用的运行时状态，保证页面操作不会污染初始化数据。
  return JSON.parse(JSON.stringify(safeState));
}

/**
 * 创建初始用户内容状态。
 * 纯函数: 只读取 userContentMockData 并返回深拷贝结果，不修改 mock 文件。
 *
 * @returns {object} 用户内容运行时初始状态。
 */
function createInitialUserContentState() {
  // 返回值类型: object。
  // 作用: 给 Vue.observable 提供一份可安全修改的初始状态。
  return cloneUserContentState(userContentMockData);
}

// 类型: object。
// 作用: 用户内容运行时响应式状态，保存收藏、历史、当前播放和恢复策略。
// 字段: user，object，当前游客用户资料。
// 字段: favorites，object，收藏记录集合。
// 字段: playHistory，object，播放历史记录集合。
// 字段: currentPlaying，object|null，当前正在播放记录。
// 字段: resumePolicy，object，恢复播放策略。
export const userContentStore = Vue.observable(createInitialUserContentState());

/**
 * 重置用户内容运行时状态。
 * 副作用: 原地覆盖 userContentStore 的 user、favorites、playHistory、currentPlaying 和 resumePolicy。
 * 使用场景: 后续设置页重置本地状态、测试或退出用户时恢复 mock 初始化状态。
 *
 * @returns {object} 重置后的 userContentStore。
 */
export function resetUserContentStore() {
  // 类型: object。
  // 作用: 重新从 mock 数据深拷贝，避免复用旧运行时引用。
  const initialState = createInitialUserContentState();

  // 副作用: 恢复用户信息。
  // 影响范围: 个人中心顶部用户卡片会重新读取初始化用户状态。
  Vue.set(userContentStore, 'user', initialState.user);

  // 副作用: 恢复收藏集合。
  // 影响范围: 后续收藏状态 selector 和个人中心收藏列表会回到 mock 初始值。
  Vue.set(userContentStore, 'favorites', initialState.favorites);

  // 副作用: 恢复播放历史集合。
  // 影响范围: 后续播放状态 selector 和个人中心历史列表会回到 mock 初始值。
  Vue.set(userContentStore, 'playHistory', initialState.playHistory);

  // 副作用: 恢复当前播放状态。
  // 影响范围: 后续播放页和 VideoCard 正在播放状态会被清空或恢复初始化值。
  Vue.set(userContentStore, 'currentPlaying', initialState.currentPlaying);

  // 副作用: 恢复播放恢复策略。
  // 影响范围: 播放页判断从头播放、恢复播放或提示重播时使用初始化阈值。
  Vue.set(userContentStore, 'resumePolicy', initialState.resumePolicy);

  // 返回值类型: object。
  // 作用: 方便调用方在重置后立即读取最新 store。
  return userContentStore;
}

/**
 * 替换收藏记录列表。
 * 副作用: 写入 userContentStore.favorites.records。
 * 使用场景: 收藏新增、取消收藏、清空收藏或上限裁剪后统一替换数组，保证 Vue 2 响应式稳定。
 *
 * @param {Array<object>} records 新收藏记录列表。
 * @returns {Array<object>} 写入后的收藏记录列表。
 */
export function replaceFavoriteRecords(records) {
  // 类型: Array<object>。
  // 作用: 非数组输入兜底为空数组，避免收藏记录集合出现异常类型。
  const safeRecords = Array.isArray(records) ? records : [];

  // 副作用: 使用 Vue.set 替换收藏记录数组。
  // 影响范围: 所有读取收藏状态和收藏列表的 selector 会重新计算。
  Vue.set(userContentStore.favorites, 'records', safeRecords);

  // 副作用: 更新时间戳，便于后续调试用户内容状态最近变动。
  // 影响范围: 只影响用户内容状态，不参与内容数据源请求。
  Vue.set(userContentStore.favorites, 'updatedAt', new Date().toISOString());

  // 返回值类型: Array<object>。
  // 作用: 返回写入后的收藏记录数组，方便 service 继续返回操作结果。
  return userContentStore.favorites.records;
}

/**
 * 替换播放历史记录列表。
 * 副作用: 写入 userContentStore.playHistory.records。
 * 使用场景: 播放历史新增、更新、删除、清空或上限裁剪后统一替换数组。
 *
 * @param {Array<object>} records 新播放历史记录列表。
 * @returns {Array<object>} 写入后的播放历史记录列表。
 */
export function replacePlayHistoryRecords(records) {
  // 类型: Array<object>。
  // 作用: 非数组输入兜底为空数组，避免历史记录集合出现异常类型。
  const safeRecords = Array.isArray(records) ? records : [];

  // 副作用: 使用 Vue.set 替换历史记录数组。
  // 影响范围: 所有读取播放状态、最近播放时间和历史列表的 selector 会重新计算。
  Vue.set(userContentStore.playHistory, 'records', safeRecords);

  // 副作用: 更新时间戳，便于后续调试播放历史最近变动。
  // 影响范围: 只影响用户内容状态，不参与内容数据源请求。
  Vue.set(userContentStore.playHistory, 'updatedAt', new Date().toISOString());

  // 返回值类型: Array<object>。
  // 作用: 返回写入后的历史记录数组，方便 service 继续返回操作结果。
  return userContentStore.playHistory.records;
}

/**
 * 写入当前播放状态。
 * 副作用: 覆盖 userContentStore.currentPlaying。
 * 使用场景: 播放页开始播放、切换分集或停止播放时更新当前播放上下文。
 *
 * @param {object|null} currentPlaying 当前播放状态；没有正在播放内容时传入 null。
 * @returns {object|null} 写入后的当前播放状态。
 */
export function setCurrentPlaying(currentPlaying) {
  // 类型: object|null。
  // 作用: 只接受对象或 null，避免 currentPlaying 被写成字符串等异常类型。
  const safeCurrentPlaying = currentPlaying && typeof currentPlaying === 'object' ? currentPlaying : null;

  // 副作用: 写入当前播放状态。
  // 影响范围: 后续 VideoCard 可以据此判断同一内容是否处于正在播放状态。
  Vue.set(userContentStore, 'currentPlaying', safeCurrentPlaying);

  // 返回值类型: object|null。
  // 作用: 返回当前写入结果，便于 service 或播放页继续判断。
  return userContentStore.currentPlaying;
}

// 导出类型: default object。
// 导出内容: 用户内容运行时响应式状态。
// 外部调用方: userContentService、userContentSelectors 和后续个人中心页面。
// 使用场景: 读取或观察用户收藏、播放历史、当前播放和恢复策略。
export default userContentStore;
