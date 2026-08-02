/*
  搜索页页面级数据样板。
  作用：说明搜索条件、结果列表和分页区需要的输入字段。
*/
export const pageSearchExample = {
  keyword: '街区',
  results: [
    {
      id: 'search-001',
      title: '无声街区',
      cover: '',
      summary: '发生在街区中的悬疑故事。',
      year: '2026',
      rating: '8.5',
      remark: '更新至 8 集',
      sourceId: 'system-source-1',
      type: 'tv'
    }
  ],
  pagination: {
    currentPage: 1,
    totalPages: 3,
    hasPrev: false,
    hasNext: true
  }
};
