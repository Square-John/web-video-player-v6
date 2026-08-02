/*
  个人中心页面级数据样板。
  作用：说明用户信息、播放历史和收藏记录需要的输入字段。
*/
export const pageProfileExample = {
  user: {
    id: 'guest-user',
    name: '游客用户',
    role: 'guest',
    status: 'local',
    message: '当前数据保存在本地浏览器中。'
  },
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
      sourceId: 'system-source-1'
    }
  ],
  favorites: [
    {
      id: 'favorite-001',
      videoId: 'detail-video-001',
      title: '远山回响',
      cover: '',
      quality: 'HD国语',
      summary: '一部围绕街区线索展开的悬疑故事。',
      year: '2026',
      rating: '9.1',
      sourceId: 'system-source-1'
    }
  ],
  localActions: [
    {
      id: 'clear-history',
      label: '清理播放历史',
      description: '删除当前浏览器保存的播放历史记录。',
      danger: false
    }
  ]
};
