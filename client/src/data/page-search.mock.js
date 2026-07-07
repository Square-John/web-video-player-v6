/*
  搜索页静态数据。
  作用：为搜索页布局提供本地数据，并记录搜索页四个核心数据区的数据形状。
*/
export const searchPageData = {
  // keyword 驱动搜索输入框和搜索状态区，空字符串表示当前没有有效搜索词。
  keyword: '城市',

  // sourceStatus 驱动搜索源状态卡片，后续可以承接真实搜索源的可用性反馈。
  sourceStatus: {
    sourceId: 'mock1',
    sourceName: '模拟源1',
    status: 'ready',
    message: '当前展示本地静态搜索结果。'
  },

  // results 驱动搜索结果主体区，数组为空时主体区显示空状态。
  results: [
    {
      id: 'search-result-001',
      title: '城市边缘',
      cover: '',
      summary: '动作片，围绕城市边界的一次任务展开。',
      year: '2025',
      rating: '8.8',
      remark: '电影',
      sourceId: 'mock1',
      type: 'movie'
    },
    {
      id: 'search-result-002',
      title: '无声街区',
      cover: '',
      summary: '发生在街区中的悬疑故事。',
      year: '2026',
      rating: '8.5',
      remark: '电视剧',
      sourceId: 'mock1',
      type: 'tv'
    },
    {
      id: 'search-result-003',
      title: '北城档案',
      cover: '',
      summary: '围绕城市旧案展开的连续剧。',
      year: '2025',
      rating: '8.4',
      remark: '电视剧',
      sourceId: 'mock1',
      type: 'tv'
    },
    {
      id: 'search-result-004',
      title: '夜航地图',
      cover: '',
      summary: '围绕夜间航线展开的故事。',
      year: '2025',
      rating: '8.3',
      remark: '电影',
      sourceId: 'mock1',
      type: 'movie'
    }
  ],

  // pagination 驱动搜索页底部分页区，为 null 时分页区不渲染。
  pagination: {
    currentPage: 1,
    totalPages: 3,
    hasPrev: false,
    hasNext: true
  }
};
