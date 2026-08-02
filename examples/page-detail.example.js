/*
  详情页页面级数据样板。
  作用：说明内容详情、分集列表和来源状态需要的输入字段。
*/
export const pageDetailExample = {
  video: {
    id: 'detail-video-001',
    title: '无声街区',
    cover: '',
    summary: '发生在街区中的悬疑故事。',
    year: '2026',
    rating: '8.5',
    remark: '更新至 8 集',
    type: 'tv',
    sourceId: 'system-source-1',
    alias: 'Silent Block',
    region: '大陆',
    language: '国语',
    releaseDate: '2026-05-18',
    genreList: ['悬疑', '剧情', '都市'],
    actorList: ['演员 A', '演员 B'],
    directorList: ['导演 A']
  },
  episodes: [
    {
      id: 'episode-001',
      label: '第 1 集',
      value: 'ep-001',
      title: '街区来信',
      remark: '可播放',
      active: true
    }
  ],
  source: {
    sourceId: 'system-source-1',
    sourceName: '系统数据源1',
    status: 'ready',
    message: '详情数据已加载。'
  }
};
