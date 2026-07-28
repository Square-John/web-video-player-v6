/*
  settingsStore.js 模块说明

  - 文件职责:
      使用 Vue.observable 创建设置页共享内存状态。
      让数据源列表、详情和对话框跨路由读取同一份数据源真相。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 1 条，自定义 2 条):
      Vue: 第三方库，提供 Vue 2 响应式 observable 能力。
      sourceManagerMock: 自定义数据，提供设置页数据源管理初始状态。
      reconcileSourceManagerAuthorizationState: 自定义工具函数，统一执行初始化授权失败关闭收敛。

  - 模块级常量:
      initialSettingsState: object，深拷贝后的初始设置状态。
      settingsStore: object，Vue 响应式设置页共享内存状态。

  - 模块级变量:
      无

  - 模块级辅助函数:
      cloneSerializableValue(value)
          - params:
              -- value: any，可序列化输入值。
          - return:
              any，与输入结构一致的深拷贝。
          - description:
              隔离 mock 导出对象和运行时响应式状态。

  - 模块级类:
      无

  - 对外导出:
      settingsStore: object，设置页共享响应式内存状态。
*/

// 导入来源: vue。
// 导入内容: Vue 2 构造函数。
// 文件作用: 使用 Vue.observable 建立跨设置路由共享的响应式内存状态。
import Vue from 'vue';

import {
  // 导入来源: ../data/settings/source-manager.mock。
  // 导入内容: sourceManagerMock 数据源管理初始数据。
  // 文件作用: 深拷贝初始化设置页状态，保证页面操作不写回 mock 文件导出对象。
  sourceManagerMock
} from '../data/settings/source-manager.mock';

import {
  // 导入来源: ../utils/sourceAuthorization.js。
  // 导入内容: reconcileSourceManagerAuthorizationState 授权状态收敛函数。
  // 文件作用: 状态进入 Vue.observable 前统一补齐授权结构并失败关闭无效自定义源。
  reconcileSourceManagerAuthorizationState
} from '../utils/sourceAuthorization.js';

/**
 * 深拷贝可序列化数据。
 * 纯函数: 相同输入内容会生成结构一致的新对象，不修改原始值。
 * 使用边界: 当前 mock 只包含普通对象、数组、字符串、数字和布尔值，不包含 Date、Blob 或函数。
 *
 * @param {*} value 需要复制的可序列化值。
 * @returns {*} 与输入结构一致、引用完全隔离的深拷贝。
 */
function cloneSerializableValue(value) {
  // 类型: string。
  // 作用: 把普通 mock 数据转换成 JSON 文本，断开所有嵌套对象引用。
  const serializedValue = JSON.stringify(value);

  // 返回值类型: any。
  // 作用: 把 JSON 文本恢复成新的普通数据对象，供 Vue.observable 建立运行时响应式状态。
  return JSON.parse(serializedValue);
}

// 类型: object。
// 作用: 保存与 mock 导出对象隔离的初始设置页状态。
// 字段: records，Array<object>，数据源管理初始记录数组。
// 字段: defaultSourceId，string，初始默认数据源唯一标识。
// 字段: checkingAll，boolean，初始批量检测运行状态。
const initialSettingsState = reconcileSourceManagerAuthorizationState(cloneSerializableValue(sourceManagerMock));

// 类型: object。
// 作用: 设置页数据源列表、详情和操作对话框共享的唯一响应式内存状态。
export const settingsStore = Vue.observable({
  // 类型: object。
  // 作用: 保存 SourceManagerState，刷新浏览器后由模块重新从 mock 初始化。
  // 字段: records，Array<object>，列表和详情共同读取的数据源记录。
  // 字段: defaultSourceId，string，当前默认数据源唯一标识。
  // 字段: checkingAll，boolean，全部检测按钮加载状态。
  sourceManager: initialSettingsState
});
