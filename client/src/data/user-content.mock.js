/*
  user-content.mock.js 模块说明

  - 文件职责:
      提供真正空库首次启动所需的本地游客资料、空收藏、空历史和默认恢复策略。
      只供 BrowserPersistenceDatabase 九仓首次种子事务使用，不生成产品示例内容或第二套运行态。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      USER_CONTENT_RECORD_LIMIT/USER_CONTENT_DEFAULT_RESUME_POLICY: 自定义配置，提供集合容量上限和默认恢复阈值。

  - 模块级常量:
      USER_CONTENT_GUEST_PROFILE: object，当前浏览器同源数据库使用的本地游客资料。
      userContentMockData: object，真正空库一次性用户内容种子。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      userContentMockData: object，供浏览器首次种子和持久化测试使用的空用户内容状态。
*/

import {
  // 导入来源: ../config/user-content.config.js。
  // 导入内容: USER_CONTENT_RECORD_LIMIT 收藏和历史集合容量上限。
  // 文件作用: 空集合仍保存正式容量边界，后续首次写入不需要补配置。
  USER_CONTENT_RECORD_LIMIT,
  // 导入来源: ../config/user-content.config.js。
  // 导入内容: USER_CONTENT_DEFAULT_RESUME_POLICY 默认播放恢复阈值。
  // 文件作用: 真正空库首次启动即具备与后续播放页一致的恢复决策。
  USER_CONTENT_DEFAULT_RESUME_POLICY
} from '../config/user-content.config.js';

// 类型: object。
// 作用: 保存当前浏览器本地游客身份；不表示账号登录、云同步或远程用户资料。
const USER_CONTENT_GUEST_PROFILE = Object.freeze({
  // 类型: string；作用: 作为 userProfiles 主键和收藏、历史、设置记录的共同 userId。
  id: 'guest-user',
  // 类型: string；作用: 在个人中心展示当前本地用户名称。
  name: '游客用户',
  // 类型: string；作用: 标识当前身份没有登录账号能力。
  role: 'guest',
  // 类型: string；作用: 说明收藏、历史和恢复策略保存到当前 origin 的 IndexedDB。
  status: 'indexeddb',
  // 类型: string；作用: 提醒用户本地数据不会自动跨浏览器或跨设备同步。
  message: '当前游客的收藏、历史和恢复策略保存在此浏览器中。'
});

// 类型: object。
// 作用: 真正空库的一次性用户内容种子；产品不预置收藏、历史或正在播放内容。
// 字段: user，object，本地游客资料。
// 字段: favorites，object，固定容量和空 records；空数组表示用户尚未收藏内容。
// 字段: playHistory，object，固定容量和空 records；空数组表示用户尚未播放内容。
// 字段: currentPlaying，null，播放会话只属于内存状态，不进入长期种子。
// 字段: resumePolicy，object，播放页恢复决策使用的默认阈值。
export const userContentMockData = Object.freeze({
  user: USER_CONTENT_GUEST_PROFILE,
  favorites: Object.freeze({
    maxRecords: USER_CONTENT_RECORD_LIMIT,
    records: Object.freeze([])
  }),
  playHistory: Object.freeze({
    maxRecords: USER_CONTENT_RECORD_LIMIT,
    records: Object.freeze([])
  }),
  currentPlaying: null,
  resumePolicy: Object.freeze({ ...USER_CONTENT_DEFAULT_RESUME_POLICY })
});
