/*
  首页静态数据。
  作用：为首页布局提供本地数据，并记录首页五个可选模块的数据形状。
*/
export const homePageData = {
  // banners 驱动首页轮播模块，数组为空时首页不渲染轮播区。
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
    },
    {
      id: 'banner-002',
      title: '深夜信号',
      label: '新片上线',
      summary: '悬疑、科技和人物关系交织，适合作为首页重点内容入口。',
      cover: '',
      year: '2025',
      rating: '8.8',
      sourceId: 'mock1'
    },
    {
      id: 'banner-003',
      title: '时间档案',
      label: '热门剧集',
      summary: '连续剧集内容，用来承载首页剧集推荐和轮播之间的层级关系。',
      cover: '',
      year: '2026',
      rating: '8.6',
      sourceId: 'mock1'
    }
  ],

  // movies 驱动首页热门电影卡片模块，数组为空时首页不渲染电影卡片区。
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
    },
    {
      id: 'movie-002',
      title: '城市边缘',
      cover: '',
      summary: '动作片，围绕城市边界的一次任务展开。',
      year: '2025',
      rating: '8.8',
      remark: '热播',
      sourceId: 'mock1'
    },
    {
      id: 'movie-003',
      title: '第七封信',
      cover: '',
      summary: '悬疑片，通过一封迟到的信揭开人物关系。',
      year: '2024',
      rating: '8.6',
      remark: '新片',
      sourceId: 'mock1'
    },
    {
      id: 'movie-004',
      title: '海面之下',
      cover: '',
      summary: '冒险片，展示海面之下的未知旅程。',
      year: '2026',
      rating: '8.4',
      remark: '推荐',
      sourceId: 'mock1'
    }
  ],

  // tvList 驱动首页热门电视剧卡片模块，数组为空时首页不渲染电视剧卡片区。
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
    },
    {
      id: 'tv-002',
      title: '南方来信',
      cover: '',
      summary: '以书信和家庭关系为线索的剧情剧。',
      year: '2025',
      rating: '8.7',
      remark: '全 24 集',
      sourceId: 'mock1'
    },
    {
      id: 'tv-003',
      title: '无声街区',
      cover: '',
      summary: '发生在街区中的悬疑故事。',
      year: '2026',
      rating: '8.5',
      remark: '更新至 8 集',
      sourceId: 'mock1'
    },
    {
      id: 'tv-004',
      title: '旧日航线',
      cover: '',
      summary: '年代背景下关于航线和人物命运的故事。',
      year: '2024',
      rating: '8.2',
      remark: '全 18 集',
      sourceId: 'mock1'
    }
  ],

  // movieRanking 驱动首页电影榜单模块，数组为空时首页不渲染电影榜单。
  movieRanking: [
    {
      id: 'movie-001',
      title: '远山回响',
      rank: 1,
      meta: '剧情 · 9.1',
      rating: '9.1',
      sourceId: 'mock1'
    },
    {
      id: 'movie-002',
      title: '城市边缘',
      rank: 2,
      meta: '动作 · 8.8',
      rating: '8.8',
      sourceId: 'mock1'
    },
    {
      id: 'movie-003',
      title: '第七封信',
      rank: 3,
      meta: '悬疑 · 8.6',
      rating: '8.6',
      sourceId: 'mock1'
    },
    {
      id: 'movie-004',
      title: '海面之下',
      rank: 4,
      meta: '冒险 · 8.4',
      rating: '8.4',
      sourceId: 'mock1'
    }
  ],

  // tvRanking 驱动首页电视剧榜单模块，数组为空时首页不渲染电视剧榜单。
  tvRanking: [
    {
      id: 'tv-001',
      title: '晨光办公室',
      rank: 1,
      meta: '职场 · 9.0',
      rating: '9.0',
      sourceId: 'mock1'
    },
    {
      id: 'tv-002',
      title: '南方来信',
      rank: 2,
      meta: '剧情 · 8.7',
      rating: '8.7',
      sourceId: 'mock1'
    },
    {
      id: 'tv-003',
      title: '无声街区',
      rank: 3,
      meta: '悬疑 · 8.5',
      rating: '8.5',
      sourceId: 'mock1'
    },
    {
      id: 'tv-004',
      title: '旧日航线',
      rank: 4,
      meta: '年代 · 8.2',
      rating: '8.2',
      sourceId: 'mock1'
    }
  ]
};
