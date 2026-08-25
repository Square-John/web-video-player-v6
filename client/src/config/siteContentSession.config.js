/*
  siteContentSession.config.js 模块说明

  - 文件职责:
      集中定义标签页内容刷新快照的 schema、唯一存储键和允许保存的页面范围。
      Store、Repository 和测试共用这些常量，避免版本、键名和页面白名单分叉。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SITE_CONTENT_SESSION_SCHEMA_VERSION: string，当前快照结构版本。
      SITE_CONTENT_SESSION_PREVIOUS_SCHEMA_VERSION: string，紧邻上一正式快照版本。
      SITE_CONTENT_SESSION_SUPPORTED_SCHEMA_VERSIONS: ReadonlyArray<string>，当前启动链可迁移的连续快照版本。
      SITE_CONTENT_SESSION_STORAGE_KEY: string，当前标签页唯一内容快照键。
      SITE_CONTENT_SESSION_PAGE_KEYS: ReadonlyArray<string>，允许进入快照的页面桶。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SITE_CONTENT_SESSION_SCHEMA_VERSION: string，当前快照结构版本。
      SITE_CONTENT_SESSION_PREVIOUS_SCHEMA_VERSION: string，紧邻上一正式快照版本。
      SITE_CONTENT_SESSION_SUPPORTED_SCHEMA_VERSIONS: ReadonlyArray<string>，当前启动链可迁移的连续快照版本。
      SITE_CONTENT_SESSION_STORAGE_KEY: string，当前标签页唯一内容快照键。
      SITE_CONTENT_SESSION_PAGE_KEYS: ReadonlyArray<string>，允许进入快照的页面桶。
*/

// 类型: string；作用: 未知版本必须失败关闭，不能猜测或部分采用旧快照。
export const SITE_CONTENT_SESSION_SCHEMA_VERSION = '2.0.0';

// 类型: string；作用: 标识只保存 search/detail/player 的紧邻旧结构，Store 使用它执行一次确定补桶迁移。
export const SITE_CONTENT_SESSION_PREVIOUS_SCHEMA_VERSION = '1.0.0';

// 类型: ReadonlyArray<string>；作用: 只接受当前版本及其紧邻可迁移版本，禁止跳过中间结构或静默采用未知快照。
export const SITE_CONTENT_SESSION_SUPPORTED_SCHEMA_VERSIONS = Object.freeze([
  SITE_CONTENT_SESSION_PREVIOUS_SCHEMA_VERSION,
  SITE_CONTENT_SESSION_SCHEMA_VERSION
]);

// 类型: string；作用: 内容刷新快照只使用一个标签页键，不和路由、活动源或长期数据混用。
export const SITE_CONTENT_SESSION_STORAGE_KEY = 'web-video-player-v6:site-content-session';

// 类型: ReadonlyArray<string>；作用: 保存所有已访问页面的标准内容桶，使硬刷新只重放当前路由而不清空其它页面。
export const SITE_CONTENT_SESSION_PAGE_KEYS = Object.freeze(['home', 'movie', 'tv', 'search', 'detail', 'player']);
