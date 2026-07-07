/*
  电视剧页页面级数据样板。
  作用：说明电视剧页筛选区、剧集列表和分页区需要的输入字段。
*/
export const pageTvExample = {
  filters: [
    {
      name: 'genre',
      label: '剧情',
      options: [
        { label: '全部', value: 'all', active: true },
        { label: '悬疑', value: 'mystery', active: false }
      ]
    }
  ],
  tvList: [
    {
      id: 'catalog-tv-001',
      title: '无声街区',
      cover: '',
      summary: '发生在街区中的悬疑故事。',
      year: '2026',
      rating: '8.5',
      remark: '更新至 8 集',
      sourceId: 'mock1',
      filter: {
        category: 'tv',
        genre: 'mystery',
        region: 'cn',
        year: '2026',
        sort: 'latest'
      }
    }
  ],
  pagination: {
    currentPage: 1,
    totalPages: 5,
    hasPrev: false,
    hasNext: true
  }
};
