/*
  设置页页面级数据样板。
  作用：说明应用设置、数据源列表和本地状态操作需要的输入字段。
*/
export const pageSettingsExample = {
  appSettings: {
    defaultSourceId: 'mock1',
    directPlayOnly: true,
    showUnsupportedSources: false,
    sourceCheckMode: 'manual'
  },
  cacheSummary: {
    search: 2,
    page: 8
  },
  shortcuts: {
    enabled: true,
    homeCarouselNavigation: true,
    playerKeyboardControl: true,
    playerSeekSeconds: 5
  },
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
  localStateActions: [
    {
      id: 'clear-source-state',
      label: '清理源状态',
      description: '清除当前浏览器保存的数据源启用状态和健康检查状态。',
      danger: false
    }
  ]
};
