/*
  电影页页面级数据样板。
  作用：说明电影页筛选区、电影列表和分页区需要的输入字段。
*/
export const pageMovieExample = {
  filters: [
    {
      name: 'genre',
      label: '剧情',
      options: [
        { label: '全部', value: 'all', active: true },
        { label: '动作', value: 'action', active: false }
      ]
    }
  ],
  movies: [
    {
      id: 'catalog-movie-001',
      title: '远山回响',
      cover: '',
      summary: '剧情片，讲述一次远行后的选择。',
      year: '2026',
      rating: '9.1',
      remark: 'HD',
      sourceId: 'system-source-1',
      filter: {
        category: 'movie',
        genre: 'drama',
        region: 'cn',
        year: '2026',
        sort: 'latest'
      }
    }
  ],
  pagination: {
    currentPage: 1,
    totalPages: 6,
    hasPrev: false,
    hasNext: true
  }
};
