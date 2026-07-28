/*
  user-content.config.js 模块说明

  - 文件职责:
      集中定义用户内容领域的记录上限和默认播放恢复策略。
      供首次种子、Repository 校验和用户内容 service 共享，避免散落业务数字。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      USER_CONTENT_RECORD_LIMIT: number，收藏与播放历史共同记录上限。
      USER_CONTENT_SNAPSHOT_SCHEMA_VERSION: number，卡片快照与分集定位器当前保存结构版本。
      USER_CONTENT_RECOVERY_KIND: Readonly<object>，跨源恢复允许的用户记录类型。
      USER_CONTENT_DEFAULT_RESUME_POLICY: Readonly<object>，首次种子使用的恢复阈值。
      USER_CONTENT_RESUME_POLICY_LIMITS: Readonly<object>，恢复阈值设置允许范围与步长。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      USER_CONTENT_RECORD_LIMIT: number，用户内容集合校验与裁剪的唯一上限。
      USER_CONTENT_SNAPSHOT_SCHEMA_VERSION: number，Repository 与 v24 迁移共用的快照版本。
      USER_CONTENT_RECOVERY_KIND: Readonly<object>，Profile、Search、Detail 和 Service 共用的恢复类型。
      USER_CONTENT_DEFAULT_RESUME_POLICY: Readonly<object>，首次空库恢复策略种子。
      USER_CONTENT_RESUME_POLICY_LIMITS: Readonly<object>，设置页与 Repository 共用的阈值约束。
*/

// 类型: number；来源: UserContentState 正式契约；作用: 收藏与历史分别最多保存 100 条。
export const USER_CONTENT_RECORD_LIMIT = 100;

// 类型: number；来源: UserContentState 正式契约；作用: 标识 ContentCardSnapshot 与 EpisodeLocator 当前首版保存形状。
export const USER_CONTENT_SNAPSHOT_SCHEMA_VERSION = 1;

// 类型: Readonly<object>；作用: 冻结跨源恢复只允许收藏或单条播放历史，不接受页面自定义类型。
export const USER_CONTENT_RECOVERY_KIND = Object.freeze({
  // 类型: string；作用: 恢复整部内容收藏记录。
  favorite: 'favorite',
  // 类型: string；作用: 恢复电影或电视剧单集播放历史记录。
  history: 'history'
});

// 类型: Readonly<object>；来源: UserContentState 播放恢复规则；作用: 只为首次空库种子提供统一阈值。
export const USER_CONTENT_DEFAULT_RESUME_POLICY = Object.freeze({
  // 类型: number；作用: 播放位置小于 5 秒时从头开始，不提示恢复。
  nearStartThresholdSeconds: 5,
  // 类型: number；作用: 距离结尾不超过 30 秒时提示用户选择重播或继续。
  nearEndThresholdSeconds: 30
});

// 类型: Readonly<object>。
// 作用: 统一播放恢复设置的输入范围和步长；设置页负责引导输入，Repository 负责最终失败关闭。
export const USER_CONTENT_RESUME_POLICY_LIMITS = Object.freeze({
  // 类型: Readonly<object>；作用: 近开头阈值允许 0 至 60 秒并按 1 秒调整。
  nearStartThresholdSeconds: Object.freeze({ minimum: 0, maximum: 60, step: 1 }),
  // 类型: Readonly<object>；作用: 近结尾阈值允许 0 至 600 秒并按 5 秒调整。
  nearEndThresholdSeconds: Object.freeze({ minimum: 0, maximum: 600, step: 5 })
});
