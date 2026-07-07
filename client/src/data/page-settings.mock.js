/*
  page-settings.mock.js 模块说明

  - 文件职责:
      提供设置页公开演示数据。
      供 SettingsView.vue 渲染基础设置、数据源列表、缓存概览和本地状态操作区。

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
      settingsPageData: object，设置页演示数据对象。
*/

// 类型: object。
// 作用: 设置页页面级数据对象，驱动设置项、数据源管理、缓存概览和本地状态操作。
// 字段: appSettings，object，基础设置区数据。
// 字段: cacheSummary，object，缓存概览统计数据。
// 字段: shortcuts，object，快捷操作和播放控制配置。
// 字段: sources，Array<object>，数据源管理列表。
// 字段: localStateActions，Array<object>，本地状态操作按钮列表。
export const settingsPageData = {
  // 类型: object。
  // 作用: 驱动基础设置区，缺失时设置页展示空状态或默认值。
  appSettings: {
    // 类型: string。
    // 作用: 设置默认数据源 id，影响页面首次请求使用的演示数据源。
    defaultSourceId: 'mock1',

    // 类型: boolean。
    // 作用: 控制播放页是否只展示直连播放入口。
    // true: 优先展示直连播放能力。
    // false: 可展示更多播放策略入口。
    directPlayOnly: true,

    // 类型: boolean。
    // 作用: 控制设置页是否显示不可用数据源。
    // true: 展示不可用源，方便排查状态。
    // false: 只展示可用源，保持公开演示界面简洁。
    showUnsupportedSources: false,

    // 类型: string。
    // 作用: 数据源检测模式，manual 表示用户手动触发检测。
    sourceCheckMode: 'manual'
  },

  // 类型: object。
  // 作用: 驱动数据源管理顶部统计胶囊。
  cacheSummary: {
    // 类型: number。
    // 作用: 搜索缓存统计展示值，用于设置页顶部概览。
    search: 2,

    // 类型: number。
    // 作用: 页面缓存统计展示值，用于设置页顶部概览。
    page: 8
  },

  // 类型: object。
  // 作用: 驱动设置页快捷键操作面板；缺失字段会在页面内用默认值补齐。
  shortcuts: {
    // 类型: boolean。
    // 作用: 控制快捷键能力是否启用。
    // true: 页面展示快捷键已开启状态。
    // false: 页面展示快捷键关闭状态。
    enabled: true,

    // 类型: boolean。
    // 作用: 控制首页轮播是否响应键盘导航。
    homeCarouselNavigation: true,

    // 类型: boolean。
    // 作用: 控制播放器是否响应键盘播放控制。
    playerKeyboardControl: true,

    // 类型: number。
    // 作用: 设置播放器快进快退秒数。
    playerSeekSeconds: 5
  },

  // 类型: Array<object>。
  // 作用: 驱动数据源列表区；数组为空时该分区显示自己的空状态。
  sources: [
    {
      // 类型: string。
      // 作用: 数据源唯一标识，和页面请求 sourceId 保持一致。
      id: 'mock1',

      // 类型: string。
      // 作用: 数据源展示名称，用于设置页源列表标题。
      name: '模拟源1',

      // 类型: string。
      // 作用: 数据源域名占位，用于公开演示环境识别来源。
      domain: 'com.mock1',

      // 类型: string。
      // 作用: 数据源配置版本展示值。
      version: 'v1.0.0',

      // 类型: boolean。
      // 作用: 控制该数据源是否启用。
      // true: 当前源可用于页面演示请求。
      // false: 当前源不参与页面演示请求。
      enabled: true,

      // 类型: boolean。
      // 作用: 控制该源是否为默认源。
      // true: 作为页面首次请求的默认来源。
      // false: 作为非默认来源展示。
      isDefault: true,

      // 类型: string。
      // 作用: 标记当前源状态，ready 用于展示可用状态。
      status: 'ready',

      // 类型: string。
      // 作用: 数据源说明文案，用于设置页列表描述。
      message: '演示数据源用于展示页面结构、标准字段和数据接入流程。',

      // 类型: object。
      // 作用: 描述该源支持的页面能力，供设置页渲染能力标签。
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
      // 作用: 本地状态操作唯一标识，用于按钮点击时区分操作类型。
      id: 'clear-source-state',

      // 类型: string。
      // 作用: 操作按钮展示文案。
      label: '清理源状态',

      // 类型: string。
      // 作用: 操作说明文案，解释该按钮影响的数据范围。
      description: '清除当前浏览器保存的数据源启用状态和健康检查状态。',

      // 类型: boolean。
      // 作用: 控制按钮是否展示危险操作样式。
      // true: 使用危险操作样式提醒用户谨慎点击。
      // false: 使用普通操作样式。
      danger: false
    },
    {
      // 类型: string。
      // 作用: 本地状态操作唯一标识，用于按钮点击时区分操作类型。
      id: 'clear-playback-state',

      // 类型: string。
      // 作用: 操作按钮展示文案。
      label: '清理播放状态',

      // 类型: string。
      // 作用: 操作说明文案，解释该按钮影响的数据范围。
      description: '清除当前浏览器保存的播放相关状态。',

      // 类型: boolean。
      // 作用: 控制按钮是否展示危险操作样式。
      // true: 使用危险操作样式提醒用户谨慎点击。
      // false: 使用普通操作样式。
      danger: false
    },
    {
      // 类型: string。
      // 作用: 本地状态操作唯一标识，用于按钮点击时区分操作类型。
      id: 'reset-settings',

      // 类型: string。
      // 作用: 操作按钮展示文案。
      label: '重置设置',

      // 类型: string。
      // 作用: 操作说明文案，解释该按钮影响的数据范围。
      description: '恢复当前浏览器内保存的设置数据。',

      // 类型: boolean。
      // 作用: 控制按钮是否展示危险操作样式。
      // true: 使用危险操作样式提醒用户谨慎点击。
      // false: 使用普通操作样式。
      danger: true
    }
  ]
};
