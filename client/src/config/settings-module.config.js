/*
  settings-module.config.js 模块说明

  - 文件职责:
      集中声明设置页可见模块、导航顺序和命名路由。
      供 SettingsView、SettingsNavigation 和设置子页面路由共享同一份模块入口配置。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SETTINGS_ROUTE_NAME: object，设置模块命名路由枚举。
      SETTINGS_ROUTE_PATH: object，设置外壳和专用详情路径枚举。
      SETTINGS_MODULE_ID: object，设置模块唯一标识枚举。
      SETTINGS_DIALOG_WIDTH: object，设置模块响应式弹窗宽度枚举。
      SETTINGS_NAVIGATION_GROUP: object，设置侧栏主区和底部区分组枚举。
      SETTINGS_RENDERER: object，设置模块渲染类型枚举。
      SETTINGS_MODULES: Array<object>，设置模块定义列表。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SETTINGS_ROUTE_NAME: object，设置模块命名路由枚举。
      SETTINGS_ROUTE_PATH: object，设置外壳和专用详情路径枚举。
      SETTINGS_MODULE_ID: object，设置模块唯一标识枚举。
      SETTINGS_DIALOG_WIDTH: object，设置模块响应式弹窗宽度枚举。
      SETTINGS_NAVIGATION_GROUP: object，设置模块导航分组枚举。
      SETTINGS_RENDERER: object，设置模块渲染类型枚举。
      SETTINGS_MODULES: Array<object>，按顺序排列的设置模块定义列表。
*/

// 类型: object。
// 作用: 集中声明设置外壳、数据源详情和普通设置模块使用的命名路由，避免组件与路由表散落魔法字符串。
export const SETTINGS_ROUTE_NAME = Object.freeze({
  // 类型: string。
  // 作用: 标识设置外壳父路由，供顶部导航定位设置模块。
  root: 'settings',

  // 类型: string。
  // 作用: 标识数据源列表路由，供设置默认重定向、模块导航和详情返回复用。
  sources: 'settings-sources',

  // 类型: string。
  // 作用: 标识数据源详情路由，供列表按 sourceId 打开独立详情页面。
  sourceDetail: 'settings-source-detail',

  // 类型: string。
  // 作用: 标识播放设置真实配置路由。
  playback: 'settings-playback',

  // 类型: string。
  // 作用: 标识界面设置真实配置路由。
  display: 'settings-display',

  // 类型: string。
  // 作用: 标识快捷键设置真实配置路由。
  shortcuts: 'settings-shortcuts',

  // 类型: string。
  // 作用: 标识系统源致谢声明只读路由。
  credits: 'settings-credits',

  // 类型: string。
  // 作用: 标识自定义源免责声明和列表只读路由。
  customSources: 'settings-custom-sources',

  // 类型: string。
  // 作用: 标识项目定位、许可证和开源项目致谢只读路由。
  about: 'settings-about'
});

// 类型: object。
// 作用: 集中声明设置父路由和数据源专用详情路径；普通模块路径继续由 SETTINGS_MODULES.routePath 提供。
export const SETTINGS_ROUTE_PATH = Object.freeze({
  // 类型: string。
  // 作用: 设置模块共同父路径和顶部导航目标路径。
  root: '/settings',
  // 类型: string。
  // 作用: 数据源独立详情动态路径，sourceId 由列表或直接 URL 提供。
  sourceDetail: '/settings/sources/:sourceId'
});

// 类型: object。
// 作用: 集中声明设置模块唯一标识，供模块定义、路由 meta 和导航激活态共享，避免重复字符串产生漂移。
export const SETTINGS_MODULE_ID = Object.freeze({
  // 类型: string。
  // 作用: 标识数据源管理模块。
  sources: 'sources',
  // 类型: string。
  // 作用: 标识播放设置模块。
  playback: 'playback',
  // 类型: string。
  // 作用: 标识界面设置模块。
  display: 'display',
  // 类型: string。
  // 作用: 标识快捷键设置模块。
  shortcuts: 'shortcuts',
  // 类型: string。
  // 作用: 标识系统源致谢声明模块。
  credits: 'credits',
  // 类型: string。
  // 作用: 标识自定义源声明列表模块。
  customSources: 'custom-sources',
  // 类型: string。
  // 作用: 标识项目关于与开源声明模块。
  about: 'about'
});

// 类型: object。
// 作用: 统一设置模块弹窗的桌面最大宽度和手机安全边距，避免固定像素宽度导致窄屏溢出。
export const SETTINGS_DIALOG_WIDTH = Object.freeze({
  // 类型: string。
  // 作用: 供删除、关闭默认源和恢复系统源等标准确认弹窗使用；手机两侧各保留 16px。
  standard: 'min(520px, calc(100vw - 32px))',

  // 类型: string。
  // 作用: 供风险免责声明使用，桌面容纳完整说明，手机保持安全边距。
  authorization: 'min(560px, calc(100vw - 32px))',

  // 类型: string。
  // 作用: 供三种导入方式表单使用，桌面提供更宽输入区，手机保持安全边距。
  importSource: 'min(620px, calc(100vw - 32px))'
});

// 类型: object。
// 作用: 区分设置侧栏日常配置入口与底部声明入口，SettingsNavigation 只按配置分区渲染。
export const SETTINGS_NAVIGATION_GROUP = Object.freeze({
  // 类型: string；作用: 数据源、界面、播放和快捷键等日常设置入口所在主区。
  primary: 'primary',
  // 类型: string；作用: 致谢和自定义源声明等只读入口所在底部区。
  secondary: 'secondary'
});

// 类型: object。
// 作用: 统一设置模块渲染类型，避免路由、导航和页面组件散落魔法字符串。
export const SETTINGS_RENDERER = Object.freeze({
  // 类型: string。
  // 作用: 表示模块使用专用数据源管理页面。
  sourceManagement: 'source-management',

  // 类型: string。
  // 作用: 表示模块使用真实播放设置页面。
  playback: 'playback',

  // 类型: string。
  // 作用: 表示模块使用真实界面设置页面。
  homeDisplay: 'home-display',

  // 类型: string。
  // 作用: 表示模块使用真实快捷键设置页面。
  shortcuts: 'shortcuts',

  // 类型: string。
  // 作用: 表示模块使用系统源致谢声明页面。
  sourceCredits: 'source-credits',

  // 类型: string。
  // 作用: 表示模块使用自定义源免责声明和列表页面。
  customSourceList: 'custom-source-list',

  // 类型: string。
  // 作用: 表示模块使用项目关于、许可证和开源项目页面。
  about: 'about'
});

// 类型: Array<object>。
// 作用: 设置页唯一模块入口清单，SettingsNavigation 按 order 排序后渲染。
// 条目字段: id，string，设置模块唯一标识。
// 条目字段: title，string，设置导航和模块标题文案。
// 条目字段: description，string，模块功能说明或空内容说明。
// 条目字段: routeName，string，模块命名路由。
// 条目字段: routePath，string，模块浏览器路径。
// 条目字段: visible，boolean，是否显示在设置导航中。
// 条目字段: order，number，设置导航顺序。
// 条目字段: icon，string，Element UI 图标类名。
// 条目字段: navigationGroup，string，主区或底部区分组。
// 条目字段: renderer，string，专用页面渲染类型。
// 条目字段: schema，Array<object>，未来配置驱动字段定义；当前所有模块为空数组。
// 条目字段: initialValues，object，配置驱动初始值；真实专用页面不消费该字段。
export const SETTINGS_MODULES = Object.freeze([
  // 类型: object。
  // 作用: 定义数据源管理模块的导航、路由和专用页面渲染信息。
  Object.freeze({
    // 类型: string；作用: 关联数据源管理模块 id。
    id: SETTINGS_MODULE_ID.sources,
    // 类型: string；作用: 展示在设置导航和数据源管理页标题。
    title: '数据源管理',
    // 类型: string；作用: 说明当前数据源管理能力边界。
    description: '管理数据源的导入、启停、检测、更新、缓存和删除。',
    // 类型: string；作用: 导航和默认重定向使用的数据源列表命名路由。
    routeName: SETTINGS_ROUTE_NAME.sources,
    // 类型: string；作用: 浏览器访问数据源列表使用的完整路径。
    routePath: `${SETTINGS_ROUTE_PATH.root}/sources`,
    // 类型: boolean；true 在设置导航显示，false 隐藏入口。
    visible: true,
    // 类型: number；作用: 让数据源管理排在设置导航第一位。
    order: 10,
    // 类型: string；作用: 侧栏使用操作图标表达数据源管理入口。
    icon: 'el-icon-s-operation',
    // 类型: string；作用: 数据源管理属于日常配置主区。
    navigationGroup: SETTINGS_NAVIGATION_GROUP.primary,
    // 类型: string；作用: 指示路由渲染专用数据源管理组件。
    renderer: SETTINGS_RENDERER.sourceManagement,
    // 类型: Array<object>；作用: 当前专用页面不读取通用字段 Schema，因此保持空数组。
    schema: Object.freeze([]),
    // 类型: object；作用: 当前专用页面不读取通用初始值，因此保持空对象。
    initialValues: Object.freeze({})
  }),
  // 类型: object。
  // 作用: 定义界面设置模块入口和真实首页展示偏好渲染信息。
  Object.freeze({
    // 类型: string；作用: 关联界面设置模块 id。
    id: SETTINGS_MODULE_ID.display,
    // 类型: string；作用: 展示在设置导航和界面设置页标题。
    title: '界面设置',
    // 类型: string；作用: 说明页面编辑首页内容展示偏好。
    description: '调整首页轮播展示数量。',
    // 类型: string；作用: 界面设置入口命名路由。
    routeName: SETTINGS_ROUTE_NAME.display,
    // 类型: string；作用: 界面设置浏览器路径。
    routePath: `${SETTINGS_ROUTE_PATH.root}/display`,
    // 类型: boolean；true 在设置导航显示，false 隐藏入口。
    visible: true,
    // 类型: number；作用: 让界面设置排在数据源管理之后。
    order: 20,
    // 类型: string；作用: 侧栏使用显示器图标表达界面设置入口。
    icon: 'el-icon-monitor',
    // 类型: string；作用: 界面设置属于日常配置主区。
    navigationGroup: SETTINGS_NAVIGATION_GROUP.primary,
    // 类型: string；作用: 指示路由渲染真实界面设置组件。
    renderer: SETTINGS_RENDERER.homeDisplay,
    // 类型: Array<object>；作用: 界面设置由专用组件消费，不在通用 schema 中重复定义。
    schema: Object.freeze([]),
    // 类型: object；作用: 专用页面从展示偏好 Store 读取已提交值，因此不消费通用初始值。
    initialValues: Object.freeze({})
  }),
  // 类型: object。
  // 作用: 定义播放设置模块入口和真实恢复策略渲染信息。
  Object.freeze({
    // 类型: string；作用: 关联播放设置模块 id。
    id: SETTINGS_MODULE_ID.playback,
    // 类型: string；作用: 展示在设置导航和播放设置页标题。
    title: '播放设置',
    // 类型: string；作用: 说明页面只编辑当前正式恢复策略字段。
    description: '调整接近开头和接近结尾时的播放恢复行为。',
    // 类型: string；作用: 播放设置入口命名路由。
    routeName: SETTINGS_ROUTE_NAME.playback,
    // 类型: string；作用: 播放设置浏览器路径。
    routePath: `${SETTINGS_ROUTE_PATH.root}/playback`,
    // 类型: boolean；true 在设置导航显示，false 隐藏入口。
    visible: true,
    // 类型: number；作用: 让播放设置排在数据源管理之后。
    order: 30,
    // 类型: string；作用: 侧栏使用播放图标表达播放设置入口。
    icon: 'el-icon-video-play',
    // 类型: string；作用: 播放设置属于日常配置主区。
    navigationGroup: SETTINGS_NAVIGATION_GROUP.primary,
    // 类型: string；作用: 指示路由渲染真实播放设置组件。
    renderer: SETTINGS_RENDERER.playback,
    // 类型: Array<object>；作用: 播放设置由专用组件消费，不在通用 schema 中重复定义。
    schema: Object.freeze([]),
    // 类型: object；作用: 专用页面从用户内容 Store 读取已提交值，因此不消费通用初始值。
    initialValues: Object.freeze({})
  }),
  // 类型: object。
  // 作用: 定义快捷键设置模块入口和真实快捷键编辑器渲染信息。
  Object.freeze({
    // 类型: string；作用: 关联快捷键设置模块 id。
    id: SETTINGS_MODULE_ID.shortcuts,
    // 类型: string；作用: 展示在设置导航和快捷键设置页标题。
    title: '快捷键设置',
    // 类型: string；作用: 说明页面编辑项目播放器命令的组合键和启用状态。
    description: '编辑播放器命令的组合键并控制启用状态。',
    // 类型: string；作用: 快捷键设置入口命名路由。
    routeName: SETTINGS_ROUTE_NAME.shortcuts,
    // 类型: string；作用: 快捷键设置浏览器路径。
    routePath: `${SETTINGS_ROUTE_PATH.root}/shortcuts`,
    // 类型: boolean；true 在设置导航显示，false 隐藏入口。
    visible: true,
    // 类型: number；作用: 让快捷键设置排在播放设置之后。
    order: 40,
    // 类型: string；作用: 侧栏使用钥匙图标表达快捷键设置入口。
    icon: 'el-icon-key',
    // 类型: string；作用: 快捷键设置属于日常配置主区。
    navigationGroup: SETTINGS_NAVIGATION_GROUP.primary,
    // 类型: string；作用: 指示路由渲染真实快捷键设置组件。
    renderer: SETTINGS_RENDERER.shortcuts,
    // 类型: Array<object>；作用: 快捷键设置由专用组件消费，不在通用 schema 中重复定义。
    schema: Object.freeze([]),
    // 类型: object；作用: 专用页面从快捷键 Store 读取已提交值，因此不消费通用初始值。
    initialValues: Object.freeze({})
  }),
  // 类型: object。
  // 作用: 定义系统源致谢声明的底部导航和只读页面渲染信息。
  Object.freeze({
    // 类型: string；作用: 关联系统源致谢模块 id。
    id: SETTINGS_MODULE_ID.credits,
    // 类型: string；作用: 设置侧栏底部入口和路由标题文案。
    title: '系统源致谢声明',
    // 类型: string；作用: 说明页面展示系统内置 Provider 的公开署名信息。
    description: '查看系统内置 Provider 的源站、脚本作者与使用边界声明。',
    // 类型: string；作用: 系统源致谢声明命名路由。
    routeName: SETTINGS_ROUTE_NAME.credits,
    // 类型: string；作用: 系统源致谢声明浏览器路径。
    routePath: `${SETTINGS_ROUTE_PATH.root}/credits`,
    // 类型: boolean；true 在设置侧栏显示，false 隐藏入口。
    visible: true,
    // 类型: number；作用: 让系统源致谢声明位于主配置入口之后的底部区首项。
    order: 50,
    // 类型: string；作用: 侧栏使用星标图标表达感谢与署名入口。
    icon: 'el-icon-star-on',
    // 类型: string；作用: 系统源致谢声明固定进入侧栏底部声明区。
    navigationGroup: SETTINGS_NAVIGATION_GROUP.secondary,
    // 类型: string；作用: 指示路由渲染系统源致谢只读组件。
    renderer: SETTINGS_RENDERER.sourceCredits,
    // 类型: Array<object>；作用: 只读页面没有可编辑配置字段。
    schema: Object.freeze([]),
    // 类型: object；作用: 只读页面不保存模块初始值。
    initialValues: Object.freeze({})
  }),
  // 类型: object。
  // 作用: 定义自定义源免责声明和列表的底部导航及只读页面渲染信息。
  Object.freeze({
    // 类型: string；作用: 关联自定义源列表模块 id。
    id: SETTINGS_MODULE_ID.customSources,
    // 类型: string；作用: 设置侧栏底部入口和路由标题文案。
    title: '自定义源列表责任声明',
    // 类型: string；作用: 说明页面展示用户导入脚本及责任边界。
    description: '查看用户自行导入的 Provider 信息与使用责任声明。',
    // 类型: string；作用: 自定义源列表命名路由。
    routeName: SETTINGS_ROUTE_NAME.customSources,
    // 类型: string；作用: 自定义源列表浏览器路径。
    routePath: `${SETTINGS_ROUTE_PATH.root}/custom-sources`,
    // 类型: boolean；true 在设置侧栏显示，false 隐藏入口。
    visible: true,
    // 类型: number；作用: 让自定义源责任声明排列在系统源致谢声明之后。
    order: 60,
    // 类型: string；作用: 侧栏使用文档图标表达用户脚本声明入口。
    icon: 'el-icon-document',
    // 类型: string；作用: 自定义源列表固定进入侧栏底部声明区。
    navigationGroup: SETTINGS_NAVIGATION_GROUP.secondary,
    // 类型: string；作用: 指示路由渲染自定义源只读组件。
    renderer: SETTINGS_RENDERER.customSourceList,
    // 类型: Array<object>；作用: 只读页面没有可编辑配置字段。
    schema: Object.freeze([]),
    // 类型: object；作用: 只读页面不保存模块初始值。
    initialValues: Object.freeze({})
  }),
  // 类型: object。
  // 作用: 定义项目关于、MIT 许可证和开源项目致谢的底部导航及只读页面。
  Object.freeze({
    // 类型: string；作用: 关联项目关于模块 id。
    id: SETTINGS_MODULE_ID.about,
    // 类型: string；作用: 设置侧栏底部入口和路由标题文案。
    title: '关于',
    // 类型: string；作用: 说明页面展示项目定位、许可证和主要开源项目。
    description: '查看项目定位、MIT 许可证和主要开源项目致谢。',
    // 类型: string；作用: 项目关于入口命名路由。
    routeName: SETTINGS_ROUTE_NAME.about,
    // 类型: string；作用: 项目关于页面浏览器路径。
    routePath: `${SETTINGS_ROUTE_PATH.root}/about`,
    // 类型: boolean；true 在设置侧栏显示，false 隐藏入口。
    visible: true,
    // 类型: number；作用: 让关于入口排列在两个数据源声明入口之后。
    order: 70,
    // 类型: string；作用: 侧栏使用信息图标表达项目说明入口。
    icon: 'el-icon-info',
    // 类型: string；作用: 关于页面固定进入侧栏底部声明区。
    navigationGroup: SETTINGS_NAVIGATION_GROUP.secondary,
    // 类型: string；作用: 指示路由渲染真实关于页面组件。
    renderer: SETTINGS_RENDERER.about,
    // 类型: Array<object>；作用: 只读页面没有可编辑配置字段。
    schema: Object.freeze([]),
    // 类型: object；作用: 只读页面不保存模块初始值。
    initialValues: Object.freeze({})
  })
]);
