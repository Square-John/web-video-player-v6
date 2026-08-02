/*
  播放页页面级数据样板。
  作用：说明播放页内容信息、分集信息和播放状态需要的输入字段。
*/
export const pagePlayerExample = {
  video: {
    id: 'detail-video-001',
    title: '无声街区',
    cover: '',
    year: '2026',
    rating: '8.5',
    type: 'tv',
    sourceId: 'system-source-1'
  },
  currentEpisode: {
    id: 'episode-001',
    label: '第 1 集',
    value: 'ep-001',
    title: '街区来信'
  },
  play: {
    url: '',
    type: 'mp4',
    status: 'ready',
    message: '当前展示播放页结构。',
    isDirect: true
  },
  episodes: [
    {
      id: 'episode-001',
      label: '第 1 集',
      value: 'ep-001',
      title: '街区来信',
      remark: '当前播放',
      active: true
    }
  ],
  source: {
    sourceId: 'system-source-1',
    sourceName: '系统数据源1',
    status: 'ready',
    message: '当前播放信息由演示数据源提供。'
  }
};
