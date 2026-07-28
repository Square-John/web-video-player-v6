/*
  userContentStore.js 模块说明

  - 文件职责:
      保存 UserContentRepository 已提交结果的 Vue 2 响应式投影。
      长期字段只能由 userContentService 在 Repository 成功后整体采用；currentPlaying 由播放会话单独维护。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 1 条，自定义 0 条):
      Vue: 第三方库，创建 observable 投影并原位替换顶层字段。

  - 模块级常量:
      EMPTY_USER_CONTENT_STATE: Readonly<object>，数据库初始化前或失败后的非持久化空投影。

  - 模块级变量:
      userContentStore: object，应用唯一用户内容响应式投影。

  - 模块级辅助函数:
      cloneProjection(value): 隔离 Repository 响应与 Vue 可变引用。

  - 模块级类:
      无

  - 对外导出:
      userContentStore: object，selector 读取的唯一响应式投影。
      replaceUserContentState: Function，初始化时完整采用持久化状态。
      replaceFavoritesState: Function，采用已提交收藏集合。
      replacePlayHistoryState: Function，采用已提交历史集合。
      replaceResumePolicy: Function，采用已提交恢复策略。
      setCurrentPlaying: Function，维护当前会话播放状态。
*/

// 导入来源: vue；导入内容: Vue 构造函数；文件作用: 创建 observable 并使用 Vue.set 保持顶层字段响应式。
import Vue from 'vue';

// 类型: Readonly<object>。
// 作用: 数据库初始化完成前提供结构稳定但不可保存的空投影；maxRecords=0 表示写服务尚不可用。
// 边界: 该对象不是 mock 种子，初始化失败时也不会被当作持久化成功状态。
const EMPTY_USER_CONTENT_STATE = Object.freeze({
  user: null,
  favorites: Object.freeze({ maxRecords: 0, records: Object.freeze([]) }),
  playHistory: Object.freeze({ maxRecords: 0, records: Object.freeze([]) }),
  currentPlaying: null,
  resumePolicy: null
});

/**
 * 隔离复制 Repository 响应或会话对象。
 * 纯函数: 返回新的 JSON 对象；用户内容契约只允许可序列化字段。
 * 失败路径: 非 JSON 值会抛出原生错误，调用方不得采用部分投影。
 *
 * @param {*} value 待采用值。
 * @returns {*} JSON 隔离副本。
 */
function cloneProjection(value) {
  return JSON.parse(JSON.stringify(value));
}

// 类型: object。
// 作用: 应用唯一 UserContentState 响应式投影；初始为空，main.js 在 Vue 挂载前采用 IndexedDB 状态。
// 字段: user/favorites/playHistory/resumePolicy 为长期提交结果；currentPlaying 为当前会话状态。
export const userContentStore = Vue.observable(cloneProjection(EMPTY_USER_CONTENT_STATE));

/**
 * 完整采用 Repository 初始化响应。
 * 副作用: 原位替换五个顶层字段，使既有 selector 和组件引用继续响应。
 * 成功路径: 资料、收藏、历史和策略使用隔离副本，currentPlaying 强制为 null。
 * 失败路径: 响应无法复制时不执行任何 Vue.set。
 *
 * @param {object} state Repository 返回的完整 UserContentState。
 * @returns {object} 当前响应式投影。
 */
export function replaceUserContentState(state) {
  // 类型: object；作用: 在任何响应式写入前完成整体复制，避免中途失败形成半投影。
  const nextState = cloneProjection(state);
  Vue.set(userContentStore, 'user', nextState.user);
  Vue.set(userContentStore, 'favorites', nextState.favorites);
  Vue.set(userContentStore, 'playHistory', nextState.playHistory);
  // 副作用: 初始化始终清空会话状态，即使调用方错误携带旧 currentPlaying 也不长期恢复。
  Vue.set(userContentStore, 'currentPlaying', null);
  Vue.set(userContentStore, 'resumePolicy', nextState.resumePolicy);
  return userContentStore;
}

/**
 * 采用已提交的完整收藏集合。
 * 副作用: 一次 Vue.set 替换 favorites，不保留旧 records 或集合级影子时间戳。
 * 成功路径: 返回当前投影中的隔离 FavoritesState。
 * 失败路径: 集合无法复制时保持旧投影。
 *
 * @param {object} favorites Repository 已提交集合。
 * @returns {object} 当前收藏投影。
 */
export function replaceFavoritesState(favorites) {
  // 类型: object；作用: 切断 Repository 返回对象与 Vue 后续可变引用。
  const nextFavorites = cloneProjection(favorites);
  Vue.set(userContentStore, 'favorites', nextFavorites);
  return userContentStore.favorites;
}

/**
 * 采用已提交的完整播放历史集合。
 * 副作用: 一次 Vue.set 替换 playHistory，不修改收藏或 currentPlaying。
 * 成功路径: 返回当前投影中的隔离 PlayHistoryState。
 * 失败路径: 集合无法复制时保持旧投影。
 *
 * @param {object} playHistory Repository 已提交集合。
 * @returns {object} 当前历史投影。
 */
export function replacePlayHistoryState(playHistory) {
  // 类型: object；作用: 切断 Repository 返回对象与 Vue 后续可变引用。
  const nextPlayHistory = cloneProjection(playHistory);
  Vue.set(userContentStore, 'playHistory', nextPlayHistory);
  return userContentStore.playHistory;
}

/**
 * 采用已提交的播放恢复策略。
 * 副作用: 一次 Vue.set 替换 resumePolicy，不修改历史记录。
 * 成功路径: 返回当前策略隔离投影。
 * 失败路径: 策略无法复制时保持旧投影。
 *
 * @param {object} resumePolicy Repository 已提交策略。
 * @returns {object} 当前恢复策略。
 */
export function replaceResumePolicy(resumePolicy) {
  // 类型: object；作用: 切断 Repository 返回对象与 Vue 后续可变引用。
  const nextResumePolicy = cloneProjection(resumePolicy);
  Vue.set(userContentStore, 'resumePolicy', nextResumePolicy);
  return userContentStore.resumePolicy;
}

/**
 * 写入当前播放会话状态。
 * 副作用: 只替换 currentPlaying，不调用 Repository，也不进入长期数据库。
 * 成功路径: 对象输入采用隔离副本，null 清空当前播放状态。
 *
 * @param {object|null} currentPlaying 当前播放状态或 null。
 * @returns {object|null} 当前会话投影。
 */
export function setCurrentPlaying(currentPlaying) {
  // 类型: object|null；作用: 只接受普通对象语义，其他输入按清空会话处理。
  const nextCurrentPlaying = currentPlaying && typeof currentPlaying === 'object'
    ? cloneProjection(currentPlaying)
    : null;
  Vue.set(userContentStore, 'currentPlaying', nextCurrentPlaying);
  return userContentStore.currentPlaying;
}

// 导出类型: default object；调用方: selector；使用场景: 只读观察统一用户内容投影。
export default userContentStore;
