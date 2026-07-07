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
      type: 'tv',
      title: '无声街区',
      cover: '',
      year: '2026',
      area: '中国大陆',
      genres: ['悬疑', '剧情'],
      score: 8.5,
      quality: 'HD国语',
      episodeLabel: '第 1 集',
      episodeValue: 'ep-001',
      currentEpisode: 1,
      progressText: '看到 12:30',
      playedTimeText: '12:30',
      totalTimeText: '45:00',
      episodeDuration: '45:00',
      updatedAt: '2026-06-20 21:35',
      sourceId: 'mock1',
      sourceName: '本地演示源',
      tv: {
        updateStatus: '更新至12集',
        totalEpisodes: 12
      }
    },
    {
      id: 'history-002',
      videoId: 'detail-video-002',
      type: 'tv',
      title: '晴空档案',
      cover: '',
      year: '2025',
      area: '中国大陆',
      genres: ['犯罪', '悬疑'],
      score: 8.2,
      quality: 'HD国语',
      episodeLabel: '第 3 集',
      episodeValue: 'ep-003',
      currentEpisode: 3,
      progressText: '看到 08:12',
      playedTimeText: '08:12',
      totalTimeText: '46:00',
      episodeDuration: '46:00',
      updatedAt: '2026-06-19 20:18',
      sourceId: 'mock1',
      sourceName: '本地演示源',
      tv: {
        updateStatus: '更新至16集',
        totalEpisodes: 16
      }
    }
  ],

  // favorites 驱动收藏列表区；数组为空时该分区显示自己的空状态。
  favorites: [
    {
      id: 'favorite-001',
      videoId: 'detail-video-001',
      type: 'tv',
      title: '无声街区',
      cover: '',
      year: '2026',
      area: '中国大陆',
      genres: ['悬疑', '剧情'],
      score: 8.5,
      quality: 'HD国语',
      summary: '一部围绕街区线索展开的悬疑故事。',
      rating: '8.5',
      sourceId: 'mock1',
      sourceName: '本地演示源',
      tv: {
        updateStatus: '更新至12集',
        totalEpisodes: 12
      }
    },
    {
      id: 'favorite-002',
      videoId: 'detail-video-003',
      type: 'movie',
      title: '南方列车',
      cover: '',
      year: '2025',
      area: '中国大陆',
      genres: ['剧情', '犯罪'],
      score: 8.2,
      quality: 'HD国语',
      summary: '主角在长途旅程中追查多年旧案。',
      rating: '8.2',
      duration: '118分钟',
      sourceId: 'mock1',
      sourceName: '本地演示源',
      movie: {
        duration: '118分钟'
      }
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
