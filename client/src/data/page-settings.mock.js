// 设置页本地数据。
// 这份数据先固定应用设置、数据源列表和本地状态操作的字段形状。
export const settingsPageData = {
  // appSettings 驱动基础设置区；为 null 时基础设置区显示暂无设置。
  appSettings: {
    defaultSourceId: 'mock1',
    directPlayOnly: true,
    showUnsupportedSources: false,
    sourceCheckMode: 'manual'
  },

  // cacheSummary 驱动数据源管理顶部统计胶囊。
  cacheSummary: {
    search: 2,
    page: 8
  },

  // shortcuts 驱动设置页快捷键操作面板；缺失字段会在页面内用默认值补齐。
  shortcuts: {
    enabled: true,
    homeCarouselNavigation: true,
    playerKeyboardControl: true,
    playerSeekSeconds: 5
  },

  // sources 驱动数据源列表区；数组为空时该分区显示自己的空状态。
  sources: [
    {
      id: 'mock1',
      name: '模拟源1',
      domain: 'com.mock1',
      version: 'v1.0.0',
      enabled: true,
      isDefault: true,
      status: 'ready',
      message: '演示数据源用于展示页面结构、标准字段和数据接入流程。',
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

  // localStateActions 驱动本地状态操作区；数组为空时该分区显示暂无操作。
  localStateActions: [
    {
      id: 'clear-source-state',
      label: '清理源状态',
      description: '清除当前浏览器保存的数据源启用状态和健康检查状态。',
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
