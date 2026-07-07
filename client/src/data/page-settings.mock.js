/*
  page-settings.mock.js 模块说明

  - 文件职责:
      提供设置页演示数据。
      驱动基础设置、数据源列表、缓存概览、快捷键设置和本地状态操作区域。

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
// 作用: 设置页本地演示数据对象，统一描述设置项、数据源状态和本地操作能力。
// 字段: appSettings，object，基础设置区数据。
// 字段: cacheSummary，object，缓存概览统计数据。
// 字段: shortcuts，object，快捷键设置数据。
// 字段: sources，Array<object>，数据源列表数据。
// 字段: localStateActions，Array<object>，本地状态操作数据。
export const settingsPageData = {
  // 类型: object。
  // 作用: 驱动基础设置区，为空时基础设置区显示暂无设置。
  appSettings: {
    // 类型: string。
    // 作用: 当前默认数据源 id，和公开演示数据源保持一致。
    defaultSourceId: 'mock1',

    // 类型: boolean。
    // 作用: 控制是否优先使用浏览器直连播放能力。
    // true: 页面倾向使用直连播放。
    // false: 页面可展示更多非直连方案入口。
    directPlayOnly: true,

    // 类型: boolean。
    // 作用: 控制是否展示暂不可用的数据源。
    // true: 设置页展示不可用源。
    // false: 设置页隐藏不可用源。
    showUnsupportedSources: false,

    // 类型: string。
    // 作用: 数据源检测模式，manual 表示由用户手动触发检测。
    sourceCheckMode: 'manual'
  },

  // 类型: object。
  // 作用: 驱动数据源管理顶部统计胶囊。
  cacheSummary: {
    // 类型: number。
    // 作用: 搜索缓存条目数量，用于设置页统计展示。
    search: 2,

    // 类型: number。
    // 作用: 页面缓存条目数量，用于设置页统计展示。
    page: 8
  },

  // 类型: object。
  // 作用: 驱动设置页快捷键操作面板，缺失字段会在页面内用默认值补齐。
  shortcuts: {
    // 类型: boolean。
    // 作用: 控制快捷键能力是否启用。
    enabled: true,

    // 类型: boolean。
    // 作用: 控制首页轮播是否响应键盘导航。
    homeCarouselNavigation: true,

    // 类型: boolean。
    // 作用: 控制播放页是否响应键盘播放控制。
    playerKeyboardControl: true,

    // 类型: number。
    // 作用: 播放页键盘快进或快退秒数。
    playerSeekSeconds: 5
  },

  // 类型: Array<object>。
  // 作用: 驱动数据源列表区；数组为空时该分区显示自己的空状态。
  sources: [
    {
      // 类型: string。
      // 作用: 模拟源1唯一标识，和顶部数据源切换、内容请求链路保持一致。
      id: 'mock1',

      // 类型: string。
      // 作用: 模拟源1展示名称，用于设置页数据源卡片标题。
      name: '模拟源1',

      // 类型: string。
      // 作用: 模拟源1域名标识，用于公开演示中的来源说明。
      domain: 'com.mock1',

      // 类型: string。
      // 作用: 数据源适配版本，用于设置页展示当前源配置版本。
      version: 'v1.0.0',

      // 类型: boolean。
      // 作用: 控制数据源是否启用。
      enabled: true,

      // 类型: boolean。
      // 作用: 控制当前源是否为默认源。
      isDefault: true,

      // 类型: string。
      // 作用: 数据源状态机器字段，ready 表示当前源可用。
      status: 'ready',

      // 类型: string。
      // 作用: 设置页数据源说明文案，解释当前模拟源覆盖的页面能力。
      message: '系统内置演示源。由 mock1 adapter 提供首页、电影、电视剧、搜索、详情和播放所需的标准数据结构。',

      // 类型: object。
      // 作用: 描述模拟源1支持的页面能力。
      capabilities: {
        home: true,
        movie: true,
        tv: true,
        search: true,
        detail: true,
        play: true
      }
    }
  ],

  // 类型: Array<object>。
  // 作用: 驱动本地状态操作区；数组为空时该分区显示暂无操作。
  localStateActions: [
    {
      // 类型: string。
      // 作用: 清理源状态操作唯一标识。
      id: 'clear-source-state',

      // 类型: string。
      // 作用: 清理源状态操作按钮文案。
      label: '清理源状态',

      // 类型: string。
      // 作用: 说明该操作清理的数据范围。
      description: '清除当前浏览器保存的数据源启用状态和健康检查状态。',

      // 类型: boolean。
      // 作用: false 表示该操作不是高风险操作。
      danger: false
    },
    {
      id: 'clear-playback-state',
      label: '清理播放状态',
      description: '清除当前浏览器保存的播放相关状态。',
      danger: false
    },
    {
      id: 'reset-settings',
      label: '重置设置',
      description: '恢复当前浏览器内保存的设置数据。',
      danger: true
    }
  ]
};
