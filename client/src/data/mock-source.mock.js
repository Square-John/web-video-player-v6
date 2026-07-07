/*
  mock-source.mock.js 模块说明

  - 文件职责:
      提供 当前版本 统一数据主干使用的完整 mock 数据源数据。
      供 mockSourceProvider.js 根据 SourceDataRequest 返回 SourceDataResponse。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      MOCK_SOURCE_ID: string，mock 数据源唯一标识。
      mockSourceData: object，集中式 mock 数据源数据对象。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      MOCK_SOURCE_ID: string，mock 数据源唯一标识。
      mockSourceData: object，集中式 mock 数据源数据对象。
*/

// 类型: string。
// 作用: 统一 mock 数据源 id，所有 ContentItem.sourceId 和 SourceDataRequest.sourceId 默认使用它。
export const MOCK_SOURCE_ID = 'mock1';

// 类型: object。
// 作用: 集中保存 mock 数据源信息、统一内容对象池和页面数据块引用关系。
// 字段: source，object，mock 数据源基础信息，后续可写入 SiteContentStore.sources。
// 字段: contentItems，object，以 contentId 为键的 ContentItem 数据池，避免同一内容在多个页面重复定义。
// 字段: pages，object，页面数据块引用关系，provider 根据 pageKey/moduleKey 从这里读取内容 id 列表。
export const mockSourceData = {
  // 类型: object。
  // 作用: mock 数据源基础信息，模拟后续真实数据源的元信息。
  source: {
    // 类型: string。
    // 作用: mock 数据源唯一标识。
    id: MOCK_SOURCE_ID,

    // 类型: string。
    // 作用: mock 数据源展示名称，用于顶部数据源切换和调试信息。
    name: '模拟源1',

    // 类型: string。
    // 作用: mock 数据源域名说明，表明该数据来自本地模拟而非真实站点。
    domain: 'com.mock1',

    // 类型: boolean。
    // 作用: true 表示该 mock 源当前可被 provider 请求，false 表示可在后续源管理中禁用。
    enabled: true
  },

  // 类型: object。
  // 作用: 统一内容对象池，所有页面数据块只引用这里的内容 id。
  contentItems: {
    // 类型: object。
    // 作用: 电影内容样例，覆盖列表、详情和播放所需字段。
    'movie-001': {
      id: 'movie-001',
      sourceId: MOCK_SOURCE_ID,
      type: 'movie',
      title: '远山回响',
      originalTitle: 'Echoes Beyond the Hills',
      aliases: ['山谷回声'],
      poster: '',
      cover: '',
      description: '剧情片，讲述一次远行后的选择。',
      year: '2026',
      area: '中国大陆',
      language: '国语',
      genres: ['剧情', '家庭'],
      tags: ['新片', '推荐'],
      score: 9.1,
      quality: 'HD',
      rank: 1,
      badge: 'HD',
      detail: {
        fullDescription: '主人公在多年后回到山城，重新面对家庭、旧友和一次没有完成的告别。',
        directors: ['林远'],
        writers: ['周澄'],
        actors: ['演员 A', '演员 B', '演员 C'],
        releaseDate: '2026-04-12',
        updateTime: '2026-06-01',
        status: '已上映',
        screenshots: [],
        trailerUrl: ''
      },
      movie: {
        duration: '128分钟'
      },
      tv: {
        totalEpisodes: null,
        latestEpisode: null,
        updateStatus: '',
        season: ''
      },
      episodes: [
        {
          id: 'movie-001-main',
          episodeNumber: 1,
          title: '正片',
          label: '正片',
          duration: '128分钟',
          description: '',
          cover: '',
          playable: true
        }
      ],
      playback: {
        defaultSourceId: 'movie-001-line-01',
        sources: [
          {
            id: 'movie-001-line-01',
            name: '模拟线路一',
            type: 'mp4',
            url: '/media/demo/movie-001.mp4',
            quality: '1080P',
            available: true,
            episodeId: 'movie-001-main'
          }
        ],
        headers: {
          referer: '',
          userAgent: ''
        },
        sourcePlayUrl: ''
      },
      source: {
        name: '模拟源1',
        domain: 'com.mock1',
        rawId: 'movie-001',
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    },

    'movie-002': {
      id: 'movie-002',
      sourceId: MOCK_SOURCE_ID,
      type: 'movie',
      title: '城市边缘',
      originalTitle: '',
      aliases: [],
      poster: '',
      cover: '',
      description: '动作片，围绕城市边界的一次任务展开。',
      year: '2025',
      area: '中国大陆',
      language: '国语',
      genres: ['动作', '犯罪'],
      tags: ['热播'],
      score: 8.8,
      quality: 'HD',
      rank: 2,
      badge: '热播',
      detail: {
        fullDescription: '一支临时小队在城市边界追踪失控事件，任务背后逐渐显露更深的旧案。',
        directors: ['陈北'],
        writers: ['许让'],
        actors: ['演员 D', '演员 E'],
        releaseDate: '2025-11-20',
        updateTime: '',
        status: '已上映',
        screenshots: [],
        trailerUrl: ''
      },
      movie: {
        duration: '116分钟'
      },
      tv: {
        totalEpisodes: null,
        latestEpisode: null,
        updateStatus: '',
        season: ''
      },
      episodes: [
        {
          id: 'movie-002-main',
          episodeNumber: 1,
          title: '正片',
          label: '正片',
          duration: '116分钟',
          description: '',
          cover: '',
          playable: true
        }
      ],
      playback: {
        defaultSourceId: 'movie-002-line-01',
        sources: [
          {
            id: 'movie-002-line-01',
            name: '模拟线路一',
            type: 'mp4',
            url: '/media/demo/movie-002.mp4',
            quality: '1080P',
            available: true,
            episodeId: 'movie-002-main'
          }
        ],
        headers: {
          referer: '',
          userAgent: ''
        },
        sourcePlayUrl: ''
      },
      source: {
        name: '模拟源1',
        domain: 'com.mock1',
        rawId: 'movie-002',
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    },

    'movie-003': {
      id: 'movie-003',
      sourceId: MOCK_SOURCE_ID,
      type: 'movie',
      title: '第七封信',
      originalTitle: '',
      aliases: [],
      poster: '',
      cover: '',
      description: '悬疑片，通过一封迟到的信揭开人物关系。',
      year: '2024',
      area: '中国大陆',
      language: '国语',
      genres: ['悬疑', '剧情'],
      tags: ['新片'],
      score: 8.6,
      quality: 'HD',
      rank: 3,
      badge: '新片',
      detail: {
        fullDescription: '一封多年后才抵达的信，让几个看似无关的人重新走进同一段往事。',
        directors: ['梁秋'],
        writers: ['顾眠'],
        actors: ['演员 F', '演员 G'],
        releaseDate: '2024-08-16',
        updateTime: '',
        status: '已上映',
        screenshots: [],
        trailerUrl: ''
      },
      movie: {
        duration: '109分钟'
      },
      tv: {
        totalEpisodes: null,
        latestEpisode: null,
        updateStatus: '',
        season: ''
      },
      episodes: [
        {
          id: 'movie-003-main',
          episodeNumber: 1,
          title: '正片',
          label: '正片',
          duration: '109分钟',
          description: '',
          cover: '',
          playable: true
        }
      ],
      playback: {
        defaultSourceId: 'movie-003-line-01',
        sources: [
          {
            id: 'movie-003-line-01',
            name: '模拟线路一',
            type: 'mp4',
            url: '/media/demo/movie-003.mp4',
            quality: '1080P',
            available: true,
            episodeId: 'movie-003-main'
          }
        ],
        headers: {
          referer: '',
          userAgent: ''
        },
        sourcePlayUrl: ''
      },
      source: {
        name: '模拟源1',
        domain: 'com.mock1',
        rawId: 'movie-003',
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    },

    'movie-004': {
      id: 'movie-004',
      sourceId: MOCK_SOURCE_ID,
      type: 'movie',
      title: '海面之下',
      originalTitle: '',
      aliases: [],
      poster: '',
      cover: '',
      description: '冒险片，展示海面之下的未知旅程。',
      year: '2026',
      area: '美国',
      language: '英语',
      genres: ['冒险', '剧情'],
      tags: ['推荐'],
      score: 8.4,
      quality: 'HD',
      rank: 4,
      badge: '推荐',
      detail: {
        fullDescription: '一支调查队深入未知海域，在失联航线与海底遗迹之间寻找真相。',
        directors: ['Mark Owen'],
        writers: ['Helen Reed'],
        actors: ['Actor A', 'Actor B'],
        releaseDate: '2026-02-09',
        updateTime: '',
        status: '已上映',
        screenshots: [],
        trailerUrl: ''
      },
      movie: {
        duration: '132分钟'
      },
      tv: {
        totalEpisodes: null,
        latestEpisode: null,
        updateStatus: '',
        season: ''
      },
      episodes: [
        {
          id: 'movie-004-main',
          episodeNumber: 1,
          title: '正片',
          label: '正片',
          duration: '132分钟',
          description: '',
          cover: '',
          playable: true
        }
      ],
      playback: {
        defaultSourceId: 'movie-004-line-01',
        sources: [
          {
            id: 'movie-004-line-01',
            name: '模拟线路一',
            type: 'mp4',
            url: '/media/demo/movie-004.mp4',
            quality: '1080P',
            available: true,
            episodeId: 'movie-004-main'
          }
        ],
        headers: {
          referer: '',
          userAgent: ''
        },
        sourcePlayUrl: ''
      },
      source: {
        name: '模拟源1',
        domain: 'com.mock1',
        rawId: 'movie-004',
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    },

    'movie-005': {
      id: 'movie-005',
      sourceId: MOCK_SOURCE_ID,
      type: 'movie',
      title: '夜航电台',
      originalTitle: '',
      aliases: [],
      poster: '',
      cover: '',
      description: '悬疑片，通过深夜电台串联多条人物线索。',
      year: '2024',
      area: '中国大陆',
      language: '国语',
      genres: ['悬疑', '犯罪'],
      tags: ['独播'],
      score: 8.1,
      quality: 'HD',
      rank: 5,
      badge: '独播',
      detail: {
        fullDescription: '深夜电台持续播出一段无法追踪的讯号，城市里的几个人因此被卷入同一场追查。',
        directors: ['赵闻'],
        writers: ['秦声'],
        actors: ['演员 H', '演员 I'],
        releaseDate: '2024-10-02',
        updateTime: '',
        status: '已上映',
        screenshots: [],
        trailerUrl: ''
      },
      movie: {
        duration: '104分钟'
      },
      tv: {
        totalEpisodes: null,
        latestEpisode: null,
        updateStatus: '',
        season: ''
      },
      episodes: [
        {
          id: 'movie-005-main',
          episodeNumber: 1,
          title: '正片',
          label: '正片',
          duration: '104分钟',
          description: '',
          cover: '',
          playable: true
        }
      ],
      playback: {
        defaultSourceId: 'movie-005-line-01',
        sources: [
          {
            id: 'movie-005-line-01',
            name: '模拟线路一',
            type: 'mp4',
            url: '/media/demo/movie-005.mp4',
            quality: '1080P',
            available: true,
            episodeId: 'movie-005-main'
          }
        ],
        headers: {
          referer: '',
          userAgent: ''
        },
        sourcePlayUrl: ''
      },
      source: {
        name: '模拟源1',
        domain: 'com.mock1',
        rawId: 'movie-005',
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    },

    'tv-001': {
      id: 'tv-001',
      sourceId: MOCK_SOURCE_ID,
      type: 'tv',
      title: '晨光办公室',
      originalTitle: '',
      aliases: ['Morning Office'],
      poster: '',
      cover: '',
      description: '围绕办公室日常展开的职场剧。',
      year: '2026',
      area: '中国大陆',
      language: '国语',
      genres: ['职场', '剧情'],
      tags: ['热播'],
      score: 9.0,
      quality: 'HD',
      rank: 1,
      badge: '更新至12集',
      detail: {
        fullDescription: '一个普通办公室团队在项目、关系和生活选择中慢慢形成自己的协作方式。',
        directors: ['唐青'],
        writers: ['季白'],
        actors: ['演员 J', '演员 K', '演员 L'],
        releaseDate: '2026-03-18',
        updateTime: '2026-07-01',
        status: '连载中',
        screenshots: [],
        trailerUrl: ''
      },
      movie: {
        duration: ''
      },
      tv: {
        totalEpisodes: 24,
        latestEpisode: 12,
        updateStatus: '更新至12集',
        season: '第一季'
      },
      episodes: [
        {
          id: 'tv-001-episode-01',
          episodeNumber: 1,
          title: '第一天',
          label: '第1集',
          duration: '45分钟',
          description: '新项目启动，团队第一次面对彼此的工作方式。',
          cover: '',
          playable: true
        },
        {
          id: 'tv-001-episode-02',
          episodeNumber: 2,
          title: '会议室灯光',
          label: '第2集',
          duration: '46分钟',
          description: '一次临时会议暴露出项目真正的问题。',
          cover: '',
          playable: true
        }
      ],
      playback: {
        defaultSourceId: 'tv-001-line-01',
        sources: [
          {
            id: 'tv-001-line-01',
            name: '模拟线路一',
            type: 'mp4',
            url: '/media/demo/tv-001-ep01.mp4',
            quality: '1080P',
            available: true,
            episodeId: 'tv-001-episode-01'
          },
          {
            id: 'tv-001-line-02',
            name: '模拟备用线路',
            type: 'mp4',
            url: '/media/demo/tv-001-ep01-backup.mp4',
            quality: '720P',
            available: true,
            episodeId: 'tv-001-episode-01'
          }
        ],
        headers: {
          referer: '',
          userAgent: ''
        },
        sourcePlayUrl: ''
      },
      source: {
        name: '模拟源1',
        domain: 'com.mock1',
        rawId: 'tv-001',
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    },

    'tv-002': {
      id: 'tv-002',
      sourceId: MOCK_SOURCE_ID,
      type: 'tv',
      title: '南方来信',
      originalTitle: '',
      aliases: [],
      poster: '',
      cover: '',
      description: '以书信和家庭关系为线索的剧情剧。',
      year: '2025',
      area: '中国大陆',
      language: '国语',
      genres: ['剧情', '家庭'],
      tags: ['完结'],
      score: 8.7,
      quality: 'HD',
      rank: 2,
      badge: '全24集',
      detail: {
        fullDescription: '几封来自南方的旧信让一个家庭重新整理多年未说出口的往事。',
        directors: ['沈南'],
        writers: ['叶回'],
        actors: ['演员 M', '演员 N'],
        releaseDate: '2025-09-21',
        updateTime: '2025-12-30',
        status: '已完结',
        screenshots: [],
        trailerUrl: ''
      },
      movie: {
        duration: ''
      },
      tv: {
        totalEpisodes: 24,
        latestEpisode: 24,
        updateStatus: '全24集',
        season: '第一季'
      },
      episodes: [
        {
          id: 'tv-002-episode-01',
          episodeNumber: 1,
          title: '旧信',
          label: '第1集',
          duration: '44分钟',
          description: '',
          cover: '',
          playable: true
        }
      ],
      playback: {
        defaultSourceId: 'tv-002-line-01',
        sources: [
          {
            id: 'tv-002-line-01',
            name: '模拟线路一',
            type: 'mp4',
            url: '/media/demo/tv-002-ep01.mp4',
            quality: '1080P',
            available: true,
            episodeId: 'tv-002-episode-01'
          }
        ],
        headers: {
          referer: '',
          userAgent: ''
        },
        sourcePlayUrl: ''
      },
      source: {
        name: '模拟源1',
        domain: 'com.mock1',
        rawId: 'tv-002',
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    },

    'tv-003': {
      id: 'tv-003',
      sourceId: MOCK_SOURCE_ID,
      type: 'tv',
      title: '无声街区',
      originalTitle: 'Silent Block',
      aliases: ['Silent Block'],
      poster: '',
      cover: '',
      description: '发生在街区中的悬疑故事。',
      year: '2026',
      area: '中国大陆',
      language: '国语',
      genres: ['悬疑', '都市'],
      tags: ['新剧'],
      score: 8.5,
      quality: 'HD',
      rank: 3,
      badge: '更新至8集',
      detail: {
        fullDescription: '几位住户在日常线索中逐步接近旧案真相，街区沉默多年后的秘密开始松动。',
        directors: ['导演 A'],
        writers: ['编剧 A'],
        actors: ['演员 A', '演员 B', '演员 C'],
        releaseDate: '2026-05-18',
        updateTime: '2026-06-28',
        status: '连载中',
        screenshots: [],
        trailerUrl: ''
      },
      movie: {
        duration: ''
      },
      tv: {
        totalEpisodes: 16,
        latestEpisode: 8,
        updateStatus: '更新至8集',
        season: '第一季'
      },
      episodes: [
        {
          id: 'tv-003-episode-01',
          episodeNumber: 1,
          title: '街区来信',
          label: '第1集',
          duration: '45分钟',
          description: '',
          cover: '',
          playable: true
        },
        {
          id: 'tv-003-episode-02',
          episodeNumber: 2,
          title: '门牌背后',
          label: '第2集',
          duration: '45分钟',
          description: '',
          cover: '',
          playable: true
        },
        {
          id: 'tv-003-episode-03',
          episodeNumber: 3,
          title: '夜色证词',
          label: '第3集',
          duration: '45分钟',
          description: '',
          cover: '',
          playable: true
        },
        {
          id: 'tv-003-episode-04',
          episodeNumber: 4,
          title: '旧楼回声',
          label: '第4集',
          duration: '45分钟',
          description: '',
          cover: '',
          playable: true
        }
      ],
      playback: {
        defaultSourceId: 'tv-003-line-01',
        sources: [
          {
            id: 'tv-003-line-01',
            name: '模拟线路一',
            type: 'mp4',
            url: '/media/demo/tv-003-ep01.mp4',
            quality: '1080P',
            available: true,
            episodeId: 'tv-003-episode-01'
          }
        ],
        headers: {
          referer: '',
          userAgent: ''
        },
        sourcePlayUrl: ''
      },
      source: {
        name: '模拟源1',
        domain: 'com.mock1',
        rawId: 'tv-003',
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    },

    'tv-004': {
      id: 'tv-004',
      sourceId: MOCK_SOURCE_ID,
      type: 'tv',
      title: '旧日航线',
      originalTitle: '',
      aliases: [],
      poster: '',
      cover: '',
      description: '年代背景下关于航线和人物命运的故事。',
      year: '2024',
      area: '中国大陆',
      language: '国语',
      genres: ['年代', '剧情'],
      tags: ['完结'],
      score: 8.2,
      quality: 'HD',
      rank: 4,
      badge: '全18集',
      detail: {
        fullDescription: '一条旧航线见证几代人的选择，也牵出城市变迁中的隐秘关系。',
        directors: ['陆行'],
        writers: ['苏桥'],
        actors: ['演员 O', '演员 P'],
        releaseDate: '2024-04-10',
        updateTime: '2024-06-20',
        status: '已完结',
        screenshots: [],
        trailerUrl: ''
      },
      movie: {
        duration: ''
      },
      tv: {
        totalEpisodes: 18,
        latestEpisode: 18,
        updateStatus: '全18集',
        season: '第一季'
      },
      episodes: [
        {
          id: 'tv-004-episode-01',
          episodeNumber: 1,
          title: '启航',
          label: '第1集',
          duration: '46分钟',
          description: '',
          cover: '',
          playable: true
        }
      ],
      playback: {
        defaultSourceId: 'tv-004-line-01',
        sources: [
          {
            id: 'tv-004-line-01',
            name: '模拟线路一',
            type: 'mp4',
            url: '/media/demo/tv-004-ep01.mp4',
            quality: '1080P',
            available: true,
            episodeId: 'tv-004-episode-01'
          }
        ],
        headers: {
          referer: '',
          userAgent: ''
        },
        sourcePlayUrl: ''
      },
      source: {
        name: '模拟源1',
        domain: 'com.mock1',
        rawId: 'tv-004',
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    }
  },

  // 类型: object。
  // 作用: 页面数据块引用关系，页面请求时 provider 根据这些 id 从 contentItems 读取内容对象。
  pages: {
    // 类型: object。
    // 作用: 首页五个独立数据块，每个数组保存当前模块展示的内容 id。
    home: {
      // 类型: Array<string>。
      // 作用: 首页轮播数据块内容引用。
      banners: ['movie-001', 'movie-002', 'tv-003'],

      // 类型: Array<string>。
      // 作用: 首页热门电影数据块内容引用。
      hotMovies: ['movie-001', 'movie-002', 'movie-003', 'movie-004', 'movie-005'],

      // 类型: Array<string>。
      // 作用: 首页热门电视剧数据块内容引用。
      hotTv: ['tv-001', 'tv-002', 'tv-003', 'tv-004'],

      // 类型: Array<string>。
      // 作用: 首页电影排行榜数据块内容引用。
      movieRanking: ['movie-001', 'movie-002', 'movie-003', 'movie-004', 'movie-005'],

      // 类型: Array<string>。
      // 作用: 首页电视剧排行榜数据块内容引用。
      tvRanking: ['tv-001', 'tv-002', 'tv-003', 'tv-004']
    },

    // 类型: Array<string>。
    // 作用: 电影页列表内容引用，provider 会根据请求分页截取。
    movie: ['movie-001', 'movie-002', 'movie-003', 'movie-004', 'movie-005'],

    // 类型: Array<string>。
    // 作用: 电视剧页列表内容引用，provider 会根据请求分页截取。
    tv: ['tv-001', 'tv-002', 'tv-003', 'tv-004'],

    // 类型: Array<string>。
    // 作用: 搜索页默认候选内容引用，provider 会根据 keyword 过滤标题、简介、类型和标签。
    search: ['movie-001', 'movie-002', 'movie-003', 'movie-004', 'movie-005', 'tv-001', 'tv-002', 'tv-003', 'tv-004']
  }
};
