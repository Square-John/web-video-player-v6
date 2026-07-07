/*
  content-item.example.js 样板文件说明

  - 文件职责:
      展示通用内容对象字段结构。
      供数据源 provider、页面服务层和页面组件对齐单条内容数据。

  - 样板范围:
      电影内容字段。
      电视剧内容字段。
      详情字段。
      播放字段。
*/

// 类型: object。
// 作用: 通用内容对象样板，电影和电视剧都使用这一套最大字段集合。
// 字段: id，string，内容唯一标识，用于详情跳转、播放跳转和跨页面状态匹配。
// 字段: sourceId，string，内容所属数据源标识，用于区分不同来源的同名内容。
// 字段: type，string，内容类型；movie 表示电影，tv 表示电视剧。
// 字段: detail，object，详情页展示字段集合。
// 字段: movie，object，电影专属字段集合。
// 字段: tv，object，电视剧专属字段集合。
// 字段: episodes，Array<object>，分集列表；电影通常只有一个正片分集。
// 字段: playback，object，播放线路和播放地址字段集合。
export const contentItemExample = {
  id: 'movie-001',
  sourceId: 'mock1',
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
};
