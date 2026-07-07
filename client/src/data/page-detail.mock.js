/*
  详情页静态数据。
  作用：为详情页布局提供本地数据，并记录详情页主体信息、分集列表和来源状态的数据形状。
*/
export const detailPageData = {
  // video 驱动详情页头部、简介区和信息标签区，为 null 时详情页显示空状态。
  video: {
    id: 'detail-video-001',
    title: '无声街区',
    cover: '',
    summary: '发生在街区中的悬疑故事。几位住户在日常线索中逐步接近旧案真相。',
    year: '2026',
    rating: '8.5',
    remark: '更新至 8 集',
    type: 'tv',
    sourceId: 'mock1',
    alias: 'Silent Block',
    region: '大陆',
    language: '国语',
    releaseDate: '2026-05-18',
    genreList: ['悬疑', '剧情', '都市'],
    actorList: ['演员 A', '演员 B', '演员 C'],
    directorList: ['导演 A']
  },

  // episodes 驱动详情页分集区，数组为空时分集区显示暂无分集。
  episodes: [
    {
      id: 'episode-001',
      label: '第 1 集',
      value: 'ep-001',
      title: '街区来信',
      remark: '可播放',
      active: true
    },
    {
      id: 'episode-002',
      label: '第 2 集',
      value: 'ep-002',
      title: '门牌背后',
      remark: '可播放',
      active: false
    },
    {
      id: 'episode-003',
      label: '第 3 集',
      value: 'ep-003',
      title: '夜色证词',
      remark: '可播放',
      active: false
    },
    {
      id: 'episode-004',
      label: '第 4 集',
      value: 'ep-004',
      title: '旧楼回声',
      remark: '可播放',
      active: false
    }
  ],

  // source 驱动详情页来源状态提示，为 null 时来源区显示暂无来源。
  source: {
    sourceId: 'mock1',
    sourceName: '本地演示数据',
    status: 'ready',
    message: '详情数据已加载。'
  }
};
