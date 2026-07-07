/*
  page-settings.mock.js 模块说明

  - 文件职责:
      提供设置页静态演示数据。
      供 SettingsView.vue 渲染应用设置、数据源管理、快捷键设置和本地状态操作区域。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      settingsPageData: object，设置页页面级演示数据对象。
*/

// 类型: object。
// 作用: 设置页本地演示数据，驱动基础设置、数据源列表和本地状态操作的静态展示。
// 字段: appSettings，object，基础设置区数据。
// 字段: cacheSummary，object，数据源管理顶部统计胶囊数据。
// 字段: shortcuts，object，快捷键操作面板数据。
// 字段: sources，Array<object>，数据源列表区数据。
// 字段: localStateActions，Array<object>，本地状态操作区数据。
export const settingsPageData = {
  // 类型: object。
  // 作用: 驱动基础设置区；为 null 时基础设置区显示暂无设置。
  appSettings: {
    // 类型: string。
    // 作用: 默认数据源标识，和公开演示数据源保持一致。
    defaultSourceId: 'mock1',

    // 类型: boolean。
    // 作用: 控制播放入口是否优先使用可直接播放地址。
    // true: 播放入口展示为直接播放模式。
    // false: 播放入口可展示更多中间解析状态。
    directPlayOnly: true,

    // 类型: boolean。
    // 作用: 控制设置页是否展示不支持当前能力的数据源。
    // true: 展示不支持项，便于用户检查能力边界。
    // false: 隐藏不支持项，保持列表简洁。
    showUnsupportedSources: false,

    // 类型: string。
    // 作用: 数据源检测模式，当前 manual 表示由用户手动触发检测。
    sourceCheckMode: 'manual'
  },

  // 类型: object。
  // 作用: 驱动数据源管理顶部统计胶囊。
  cacheSummary: {
    // 类型: number。
    // 作用: 搜索缓存条数，用于设置页统计展示。
    search: 2,

    // 类型: number。
    // 作用: 页面缓存条数，用于设置页统计展示。
    page: 8
  },

  // 类型: object。
  // 作用: 驱动设置页快捷键操作面板；缺失字段会在页面内用默认值补齐。
  shortcuts: {
    // 类型: boolean。
    // 作用: 控制快捷键总开关。
    // true: 页面展示快捷键启用状态。
    // false: 页面展示快捷键关闭状态。
    enabled: true,

    // 类型: boolean。
    // 作用: 控制首页轮播快捷操作是否启用。
    homeCarouselNavigation: true,

    // 类型: boolean。
    // 作用: 控制播放器键盘操作是否启用。
    playerKeyboardControl: true,

    // 类型: number。
    // 作用: 播放器快进快退秒数，用于设置页展示当前步进值。
    playerSeekSeconds: 5
  },

  // 类型: Array<object>。
  // 作用: 驱动数据源列表区；数组为空时该分区显示自己的空状态。
  sources: [
    {
      // 类型: string。
      // 作用: 演示数据源唯一标识，用于设置页默认源匹配和启用状态展示。
      id: 'mock1',

      // 类型: string。
      // 作用: 演示数据源名称，用于设置页数据源标题展示。
      name: '模拟源1',

      // 类型: string。
      // 作用: 演示数据源域名标识，用于辅助用户识别当前源。
      domain: 'com.mock1',

      // 类型: string。
      // 作用: 数据源配置版本，用于设置页显示当前演示源配置版本。
      version: 'v1.0.0',

      // 类型: boolean。
      // 作用: 控制当前数据源是否处于启用状态。
      enabled: true,

      // 类型: boolean。
      // 作用: 控制当前数据源是否是默认源。
      isDefault: true,

      // 类型: string。
      // 作用: 数据源状态机器字段，用于设置页展示检测结果。
      status: 'ready',

      // 类型: string。
      // 作用: 数据源说明文案，用于解释演示源支持的页面能力。
      message: '本地演示数据源用于展示页面结构、标准字段和数据接入流程。',

      // 类型: object。
      // 作用: 描述演示源支持的页面能力，用于设置页能力标签展示。
      capabilities: {
        // 类型: boolean。
        // 作用: true 表示该源支持首页数据。
        home: true,

        // 类型: boolean。
        // 作用: true 表示该源支持电影页数据。
        movie: true,

        // 类型: boolean。
        // 作用: true 表示该源支持电视剧页数据。
        tv: true,

        // 类型: boolean。
        // 作用: true 表示该源支持搜索页数据。
        search: true,

        // 类型: boolean。
        // 作用: true 表示该源支持详情页数据。
        detail: true,

        // 类型: boolean。
        // 作用: true 表示该源支持播放页数据。
        play: true
      }
    }
  ],

  // 类型: Array<object>。
  // 作用: 驱动本地状态操作区；数组为空时该分区显示暂无操作。
  localStateActions: [
    {
      // 类型: string。
      // 作用: 操作按钮唯一标识，用于设置页列表 key 和后续事件匹配。
      id: 'clear-source-state',

      // 类型: string。
      // 作用: 操作按钮文案，用于展示清理源状态入口。
      label: '清理源状态',

      // 类型: string。
      // 作用: 操作说明文案，用于解释该按钮影响的数据范围。
      description: '清除当前浏览器保存的数据源启用状态和健康检查状态。',

      // 类型: boolean。
      // 作用: 控制按钮是否展示为危险操作。
      danger: false
    },
    {
      // 类型: string。
      // 作用: 操作按钮唯一标识，用于设置页列表 key 和后续事件匹配。
      id: 'clear-playback-state',

      // 类型: string。
      // 作用: 操作按钮文案，用于展示清理播放状态入口。
      label: '清理播放状态',

      // 类型: string。
      // 作用: 操作说明文案，用于解释该按钮影响的数据范围。
      description: '清除当前浏览器保存的播放相关状态。',

      // 类型: boolean。
      // 作用: 控制按钮是否展示为危险操作。
      danger: false
    },
    {
      // 类型: string。
      // 作用: 操作按钮唯一标识，用于设置页列表 key 和后续事件匹配。
      id: 'reset-settings',

      // 类型: string。
      // 作用: 操作按钮文案，用于展示重置设置入口。
      label: '重置设置',

      // 类型: string。
      // 作用: 操作说明文案，用于解释该按钮影响的数据范围。
      description: '恢复当前浏览器内保存的设置数据。',

      // 类型: boolean。
      // 作用: 控制按钮是否展示为危险操作。
      danger: true
    }
  ]
};
