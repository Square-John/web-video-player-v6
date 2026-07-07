/*
  播放页静态数据。
  作用：为播放页布局提供本地数据，并记录视频信息、当前分集、播放状态、分集列表和来源状态的数据形状。
*/
export const playerPageData = {
  // video 驱动播放页视频标题和基础信息区，为 null 时播放页显示空状态。
  video: {
    id: 'detail-video-001',
    title: '无声街区',
    cover: '',
    year: '2026',
    rating: '8.5',
    type: 'tv',
    sourceId: 'mock1'
  },

  // currentEpisode 表示当前正在播放的分集，label 用于显示，value 用于后续播放参数传递。
  currentEpisode: {
    id: 'episode-001',
    label: '第 1 集',
    value: 'ep-001',
    title: '街区来信'
  },

  // play 驱动播放器区域，记录播放地址、播放类型、播放状态和直连标识。
  play: {
    url: '',
    type: 'mp4',
    status: 'ready',
    message: '当前展示静态播放页结构。',
    isDirect: true
  },

  // episodes 驱动播放页分集切换区，数组为空时分集区显示暂无分集。
  episodes: [
    {
      id: 'episode-001',
      label: '第 1 集',
      value: 'ep-001',
      title: '街区来信',
      remark: '当前播放',
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

  // source 驱动播放页来源状态提示，为 null 时来源区显示暂无来源。
  source: {
    sourceId: 'mock1',
    sourceName: '模拟源1',
    status: 'ready',
    message: '当前播放地址为浏览器直连地址。'
  }
};
