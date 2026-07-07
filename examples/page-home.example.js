/*
  首页页面级数据样板。
  作用：说明首页轮播、热门内容和排行榜分区需要的输入字段。
*/
export const pageHomeExample = {
  banners: [
    {
      id: 'banner-001',
      title: '山海之间',
      label: '今日推荐',
      summary: '一段横跨城市与远方的旅程。',
      cover: '',
      year: '2026',
      rating: '9.1',
      sourceId: 'mock1'
    }
  ],
  movies: [
    {
      id: 'movie-001',
      title: '远山回响',
      cover: '',
      summary: '剧情片，讲述一次远行后的选择。',
      year: '2026',
      rating: '9.1',
      remark: 'HD',
      sourceId: 'mock1'
    }
  ],
  tvList: [
    {
      id: 'tv-001',
      title: '晨光办公室',
      cover: '',
      summary: '围绕办公室日常展开的职场剧。',
      year: '2026',
      rating: '9.0',
      remark: '更新至 12 集',
      sourceId: 'mock1'
    }
  ],
  movieRanking: [
    {
      id: 'movie-001',
      title: '远山回响',
      rank: 1,
      meta: '剧情 · 9.1',
      rating: '9.1',
      sourceId: 'mock1'
    }
  ],
  tvRanking: [
    {
      id: 'tv-001',
      title: '晨光办公室',
      rank: 1,
      meta: '职场 · 9.0',
      rating: '9.0',
      sourceId: 'mock1'
    }
  ]
};
