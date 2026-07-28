/*
  shortcutSettingsStore.js 模块说明

  - 文件职责:
      保存快捷键设置 Repository 已提交结果的 Vue 2 响应式投影。
      设置页与播放器读取同一 preferences；只有 shortcutSettingsService 可以在持久化成功后替换该对象。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 1 条，自定义 0 条):
      Vue: 第三方库，创建 observable 投影并原位替换顶层字段。

  - 模块级常量:
      EMPTY_SHORTCUT_SETTINGS_STATE: Readonly<object>，应用初始化前的稳定空投影。

  - 模块级变量:
      shortcutSettingsStore: object，应用唯一快捷键设置响应式投影。

  - 模块级辅助函数:
      cloneProjection(value): 创建不共享引用的 JSON 副本。

  - 模块级类:
      无

  - 对外导出:
      shortcutSettingsStore: object，设置页和播放器读取的唯一快捷键投影。
      replaceShortcutPreferences: Function，采用 Repository 已提交偏好。
      setShortcutSettingsSaving: Function，更新保存交互状态。
      setShortcutSettingsError: Function，更新安全错误说明。
*/

// 导入来源: vue；导入内容: Vue 构造函数；文件作用: 创建 observable 并使用 Vue.set 保持顶层字段响应式。
import Vue from 'vue';

// 类型: Readonly<object>。
// 作用: 应用启动完成前提供稳定字段；preferences=null 表示持久化偏好尚未采用，不代表使用默认配置成功。
const EMPTY_SHORTCUT_SETTINGS_STATE = Object.freeze({
  preferences: null,
  saving: false,
  errorMessage: ''
});

/**
 * 创建设置投影隔离副本。
 * 纯函数: 返回新的 JSON 对象，不保留 Repository 或组件草稿引用。
 * 失败路径: 非 JSON 值抛出原生错误，调用方不得采用部分投影。
 *
 * @param {*} value 待复制值。
 * @returns {*} JSON 隔离副本。
 */
function cloneProjection(value) {
  return JSON.parse(JSON.stringify(value));
}

// 类型: object。
// 作用: 应用唯一快捷键设置投影；preferences 仅在 Repository 读取或保存成功后更新。
// 字段: saving=true 表示保存事务进行中，false 表示当前允许发起新保存；errorMessage 只保存安全用户说明。
export const shortcutSettingsStore = Vue.observable(cloneProjection(EMPTY_SHORTCUT_SETTINGS_STATE));

/**
 * 采用已提交快捷键偏好。
 * 副作用: 一次 Vue.set 替换 preferences，并清空上次保存错误。
 * 成功路径: 返回当前响应式隔离投影。
 * 失败路径: 候选无法复制时保持原偏好和错误状态。
 *
 * @param {object} preferences Repository 已读取或已提交 ShortcutPreferences。
 * @returns {object} 当前快捷键偏好投影。
 */
export function replaceShortcutPreferences(preferences) {
  // 类型: object；作用: 在响应式写入前切断 Repository、service 和组件之间的可变引用。
  const nextPreferences = cloneProjection(preferences);
  Vue.set(shortcutSettingsStore, 'preferences', nextPreferences);
  Vue.set(shortcutSettingsStore, 'errorMessage', '');
  return shortcutSettingsStore.preferences;
}

/**
 * 更新快捷键保存交互状态。
 * 副作用: 替换 saving Boolean，不修改已提交偏好。
 *
 * @param {boolean} saving true 表示事务正在执行，false 表示事务已经收敛。
 * @returns {boolean} 当前保存状态。
 */
export function setShortcutSettingsSaving(saving) {
  // 状态变化: 只接受精确 true；false 和其他值都关闭进行中状态，避免 truthy 对象锁死页面。
  Vue.set(shortcutSettingsStore, 'saving', saving === true);
  return shortcutSettingsStore.saving;
}

/**
 * 更新快捷键设置安全错误说明。
 * 副作用: 替换 errorMessage，不记录 Error、堆栈、数据库对象或候选偏好。
 *
 * @param {string} message 面向用户的安全错误说明；空值清除错误。
 * @returns {string} 当前错误说明。
 */
export function setShortcutSettingsError(message) {
  // 类型: string；作用: 只保留去除首尾空白后的用户说明，禁止响应式投影保存异常对象。
  const safeMessage = typeof message === 'string' ? message.trim() : '';
  Vue.set(shortcutSettingsStore, 'errorMessage', safeMessage);
  return shortcutSettingsStore.errorMessage;
}

// 导出类型: default object；调用方: 快捷键设置页和 PlayerView；使用场景: 只读观察统一偏好投影。
export default shortcutSettingsStore;
