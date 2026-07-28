/*
  user-content.config.js 模块说明

  - 文件职责:
      集中定义用户内容领域的记录上限和默认播放恢复策略。
      供首次种子、Repository 校验和用户内容 service 共享，避免散落业务数字。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      USER_CONTENT_RECORD_LIMIT: number，收藏与播放历史共同记录上限。
      USER_CONTENT_DEFAULT_RESUME_POLICY: Readonly<object>，首次种子使用的恢复阈值。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      USER_CONTENT_RECORD_LIMIT: number，用户内容集合校验与裁剪的唯一上限。
      USER_CONTENT_DEFAULT_RESUME_POLICY: Readonly<object>，首次空库恢复策略种子。
*/

// 类型: number；来源: UserContentState 正式契约；作用: 收藏与历史分别最多保存 100 条。
export const USER_CONTENT_RECORD_LIMIT = 100;

// 类型: Readonly<object>；来源: UserContentState 播放恢复规则；作用: 只为首次空库种子提供统一阈值。
export const USER_CONTENT_DEFAULT_RESUME_POLICY = Object.freeze({
  // 类型: number；作用: 播放位置小于 5 秒时从头开始，不提示恢复。
  nearStartThresholdSeconds: 5,
  // 类型: number；作用: 距离结尾不超过 30 秒时提示用户选择重播或继续。
  nearEndThresholdSeconds: 30
});
