/*
  个人中心页面级数据样板。
  作用：说明用户信息、播放历史和收藏记录需要的输入字段。
*/
export const pageProfileExample = {
  user: {
    nickname: '游客',
    role: 'guest',
    avatar: '',
    description: '当前以游客身份浏览。'
  },
  watchHistory: [
    {
      id: 'history-001',
      title: '无声街区',
      cover: '',
      year: '2026',
      rating: '8.5',
      remark: '看到第 1 集',
      sourceId: 'mock1'
    }
  ],
  favorites: [
    {
      id: 'favorite-001',
      title: '远山回响',
      cover: '',
      year: '2026',
      rating: '9.1',
      remark: 'HD',
      sourceId: 'mock1'
    }
  ]
};
