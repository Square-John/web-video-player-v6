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
    },
    {
      id: 'movie-005',
      title: '北城档案',
      cover: '',
      summary: '刑侦片，围绕一组旧档案重新展开调查。',
      year: '2025',
      rating: '8.3',
      remark: '精选',
      sourceId: 'mock1'
    },
    {
      id: 'movie-006',
      title: '夜航电台',
      cover: '',
      summary: '悬疑片，通过深夜电台串联多条人物线索。',
      year: '2024',
      rating: '8.1',
      remark: '独播',
      sourceId: 'mock1'
    },
    {
      id: 'movie-007',
      title: '风雪归途',
      cover: '',
      summary: '剧情片，讲述一次归乡旅程中的人物选择。',
      year: '2026',
      rating: '8.0',
      remark: '高清',
      sourceId: 'mock1'
    },
    {
      id: 'movie-008',
      title: '无人码头',
      cover: '',
      summary: '犯罪片，围绕码头失踪案件展开追查。',
      year: '2025',
      rating: '7.9',
      remark: '新片',
      sourceId: 'mock1'
    },
    {
      id: 'movie-009',
      title: '长街灯火',
      cover: '',
      summary: '都市片，以街区人物关系和家庭变化为主线。',
      year: '2024',
      rating: '7.8',
      remark: '推荐',
      sourceId: 'mock1'
    },
    {
      id: 'movie-010',
      title: '群山来信',
      cover: '',
      summary: '文艺片，用一封封信串联起远方与现实。',
      year: '2026',
      rating: '7.7',
      remark: 'HD',
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
    },
    {
      id: 'tv-005',
      title: '海港清晨',
      cover: '',
      summary: '围绕港口日常和人物成长展开的生活剧。',
      year: '2026',
      rating: '8.1',
      remark: '更新至 10 集',
      sourceId: 'mock1'
    },
    {
      id: 'tv-006',
      title: '北街来客',
      cover: '',
      summary: '讲述陌生来客打破街区平静的悬疑剧。',
      year: '2025',
      rating: '8.0',
      remark: '更新至 16 集',
      sourceId: 'mock1'
    },
    {
      id: 'tv-007',
      title: '第九会议室',
      cover: '',
      summary: '职场群像剧，聚焦项目协作与人物成长。',
      year: '2026',
      rating: '7.9',
      remark: '全 20 集',
      sourceId: 'mock1'
    },
    {
      id: 'tv-008',
      title: '雨巷档案',
      cover: '',
      summary: '以老城区档案为线索的单元悬疑剧。',
      year: '2024',
      rating: '7.8',
      remark: '更新至 6 集',
      sourceId: 'mock1'
    },
    {
      id: 'tv-009',
      title: '夏夜来信',
      cover: '',
      summary: '一封来信牵出多年往事和家庭秘密。',
      year: '2025',
      rating: '7.7',
      remark: '全 12 集',
      sourceId: 'mock1'
    },
    {
      id: 'tv-010',
      title: '云端值班室',
      cover: '',
      summary: '科技公司背景下的轻喜剧和团队故事。',
      year: '2026',
      rating: '7.6',
      remark: '更新至 9 集',
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
