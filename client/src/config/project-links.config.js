/*
  project-links.config.js 模块说明

  - 文件职责:
      集中声明页面可以公开展示的项目外部链接和外链安全属性。
      供设置页声明、关于模块和后续公开入口复用，避免 Vue 模板散落仓库、许可证和 rel 字符串。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PROJECT_LINKS: object，项目公开仓库、联系和许可证入口。
      EXTERNAL_LINK_ATTRIBUTES: object，页面外链统一安全属性。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      PROJECT_LINKS: object，供项目说明页面读取公开仓库、联系和许可证地址。
      EXTERNAL_LINK_ATTRIBUTES: object，供外链组件统一绑定 target 和 rel。
*/

// 类型: object。
// 作用: 保存项目公开仓库、联系和许可证入口；Provider 只声明自身署名，不承担平台链接信息。
export const PROJECT_LINKS = Object.freeze({
  // 类型: string。
  // 作用: 项目正式公开仓库入口，关于页用于说明源码、问题和后续公开文档的归属位置。
  repositoryUrl: 'https://github.com/Square-John/web-video-player-v6',
  // 类型: string。
  // 作用: 权利人或用户提交问题的公开入口，致谢和自定义源声明页共同引用。
  issueTrackerUrl: 'https://github.com/Square-John/web-video-player-v6/issues',
  // 类型: string。
  // 作用: MIT 许可证官方说明入口；根 LICENSE 保存项目完整授权正文，浏览器页面不构造本地文件死链接。
  licenseUrl: 'https://opensource.org/license/mit'
});

// 类型: object。
// 作用: 统一新窗口外链的隔离、来源隐藏和搜索关系声明，避免不同组件遗漏安全属性。
export const EXTERNAL_LINK_ATTRIBUTES = Object.freeze({
  // 类型: string；作用: 在新浏览器标签页打开外部站点，不替换当前设置页。
  target: '_blank',
  // 类型: string；作用: 隔离 opener、隐藏来源并声明外部非背书链接关系。
  rel: 'noopener noreferrer nofollow external'
});
