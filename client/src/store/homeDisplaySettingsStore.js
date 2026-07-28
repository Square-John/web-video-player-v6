/*
  homeDisplaySettingsStore.js 模块说明

  - 文件职责:
      保存首页展示偏好 Repository 已提交结果的 Vue 2 响应式投影。
      首页和设置页读取同一 preferences；只有 HomeDisplaySettingsService 可以在持久化成功后替换投影。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 1 条，自定义 0 条):
      Vue: 第三方库，创建 observable 投影并原位替换顶层字段。

  - 模块级常量:
      EMPTY_HOME_DISPLAY_SETTINGS_STATE: Readonly<object>，应用初始化前的稳定空投影。

  - 模块级变量:
      homeDisplaySettingsStore: object，应用唯一首页展示设置响应式投影。

  - 模块级辅助函数:
      cloneProjection(value): 创建不共享引用的 JSON 副本。

  - 模块级类:
      无

  - 对外导出:
      homeDisplaySettingsStore: object，首页和设置页读取的唯一展示偏好投影。
      replaceHomeDisplayPreferences: Function，采用 Repository 已提交偏好。
      setHomeDisplaySettingsSaving: Function，更新保存交互状态。
      setHomeDisplaySettingsError: Function，更新安全错误说明。
*/

// 导入来源: vue；导入内容: Vue 构造函数；文件作用: 创建 observable 并使用 Vue.set 保持顶层字段响应式。
import Vue from 'vue';

// 类型: Readonly<object>。
// 作用: 应用启动完成前提供稳定字段；preferences=null 表示持久化偏好尚未采用，不代表默认设置已成功加载。
const EMPTY_HOME_DISPLAY_SETTINGS_STATE = Object.freeze({
  preferences: null,
  saving: false,
  errorMessage: ''
});

/**
 * 创建展示设置投影隔离副本。
 * 纯函数: 返回新的 JSON 对象，不保留 Repository、Service 或组件草稿引用。
 * 失败路径: 非 JSON 值抛出原生错误，调用方不得采用部分投影。
 *
 * @param {*} value 待复制值。
 * @returns {*} JSON 隔离副本。
 */
function cloneProjection(value) {
  return JSON.parse(JSON.stringify(value));
}

// 类型: object。
// 作用: 应用唯一首页展示设置投影；preferences 只在 Repository 读取或保存成功后更新。
// 字段: saving=true 表示保存事务进行中，false 表示当前没有未收敛命令；errorMessage 只保存安全用户说明。
export const homeDisplaySettingsStore = Vue.observable(cloneProjection(EMPTY_HOME_DISPLAY_SETTINGS_STATE));

/**
 * 采用已提交首页展示偏好。
 * 副作用: 一次替换 preferences 并清空旧错误，不修改保存进行中状态。
 *
 * @param {object} preferences Repository 已读取或提交的 HomeDisplayPreferences。
 * @returns {object} 当前展示偏好隔离投影。
 */
export function replaceHomeDisplayPreferences(preferences) {
  // 类型: object；作用: 在响应式写入前切断 Repository、Service 和页面之间的可变引用。
  const nextPreferences = cloneProjection(preferences);
  Vue.set(homeDisplaySettingsStore, 'preferences', nextPreferences);
  Vue.set(homeDisplaySettingsStore, 'errorMessage', '');
  return homeDisplaySettingsStore.preferences;
}

/**
 * 更新首页展示设置保存状态。
 * 副作用: 替换 saving Boolean，不修改最近已提交偏好。
 *
 * @param {boolean} saving true 表示至少一项保存尚未收敛，false 表示队列已空。
 * @returns {boolean} 当前保存状态。
 */
export function setHomeDisplaySettingsSaving(saving) {
  // 状态变化: 只接受精确 true；false 和其他值都关闭进行中状态，避免 truthy 对象锁死页面。
  Vue.set(homeDisplaySettingsStore, 'saving', saving === true);
  return homeDisplaySettingsStore.saving;
}

/**
 * 更新首页展示设置安全错误说明。
 * 副作用: 替换 errorMessage，不记录 Error、数据库对象或候选偏好。
 *
 * @param {string} message 面向用户的安全错误说明；空值清除错误。
 * @returns {string} 当前错误说明。
 */
export function setHomeDisplaySettingsError(message) {
  // 类型: string；作用: 只保存去除首尾空白后的用户说明，禁止响应式投影泄漏异常对象。
  const safeMessage = typeof message === 'string' ? message.trim() : '';
  Vue.set(homeDisplaySettingsStore, 'errorMessage', safeMessage);
  return homeDisplaySettingsStore.errorMessage;
}

// 导出类型: default object；调用方: HomeView 与 HomeDisplaySettingsPanel；使用场景: 只读观察已提交展示偏好。
export default homeDisplaySettingsStore;
