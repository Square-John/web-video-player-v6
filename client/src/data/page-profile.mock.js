// 个人中心页本地数据。
// 这份数据先固定个人信息、播放历史、收藏列表和本地操作入口的字段形状。
export const profilePageData = {
  // user 驱动页面顶部用户信息卡；为 null 时用户卡显示游客空状态。
  user: {
    id: 'guest-user',
    name: '游客用户',
    role: 'guest',
    status: 'local',
    message: '当前数据保存在本地浏览器中。'
  },

  // playHistory 驱动播放历史区；数组为空时该分区显示自己的空状态。
  playHistory: [
    {
      id: 'history-001',
      videoId: 'detail-video-001',
      title: '无声街区',
      cover: '',
      quality: 'HD国语',
      episodeLabel: '第 1 集',
      episodeValue: 'ep-001',
      progressText: '看到 12:30',
      updatedAt: '2026-06-20 21:35',
      sourceId: 'mock1'
    },
    {
      id: 'history-002',
      videoId: 'detail-video-002',
      title: '晴空档案',
      cover: '',
      quality: 'HD国语',
      episodeLabel: '第 3 集',
      episodeValue: 'ep-003',
      progressText: '看到 08:12',
      updatedAt: '2026-06-19 20:18',
      sourceId: 'mock1'
    }
  ],

  // favorites 驱动收藏列表区；数组为空时该分区显示自己的空状态。
  favorites: [
    {
      id: 'favorite-001',
      videoId: 'detail-video-001',
      title: '无声街区',
      cover: '',
      quality: 'HD国语',
      summary: '一部围绕街区线索展开的悬疑故事。',
      year: '2026',
      rating: '8.5',
      sourceId: 'mock1'
    },
    {
      id: 'favorite-002',
      videoId: 'detail-video-003',
      title: '南方列车',
      cover: '',
      quality: 'HD国语',
      summary: '主角在长途旅程中追查多年旧案。',
      year: '2025',
      rating: '8.2',
      sourceId: 'mock1'
    }
  ],

  // localActions 驱动本地数据操作区；数组为空时该分区显示暂无操作。
  localActions: [
    {
      id: 'clear-history',
      label: '清理播放历史',
      description: '删除当前浏览器保存的播放历史记录。',
      danger: false
    },
    {
      id: 'clear-favorites',
      label: '清理收藏列表',
      description: '删除当前浏览器保存的收藏记录。',
      danger: false
    },
    {
      id: 'reset-local-data',
      label: '重置本地数据',
      description: '清空播放历史、收藏和本地页面状态。',
      danger: true
    }
  ]
};
