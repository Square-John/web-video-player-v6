/*
  电影页静态数据。
  作用：为电影页布局提供本地数据，并记录电影页三个分区的数据形状。
*/
export const moviePageData = {
  // filters 驱动电影页筛选区，最多只使用类型、剧情、地区、年份、排序这五组筛选。
  filters: [
    {
      name: 'category',
      label: '类型',
      options: [
        { label: '全部', value: 'all', active: true },
        { label: '电影', value: 'movie', active: false },
        { label: '动画', value: 'animation', active: false },
        { label: '纪录片', value: 'documentary', active: false }
      ]
    },
    {
      name: 'genre',
      label: '剧情',
      options: [
        { label: '全部', value: 'all', active: true },
        { label: '剧情', value: 'drama', active: false },
        { label: '动作', value: 'action', active: false },
        { label: '喜剧', value: 'comedy', active: false },
        { label: '悬疑', value: 'mystery', active: false }
      ]
    },
    {
      name: 'region',
      label: '地区',
      options: [
        { label: '全部', value: 'all', active: true },
        { label: '大陆', value: 'cn', active: false },
        { label: '欧美', value: 'west', active: false },
        { label: '日韩', value: 'asia', active: false }
      ]
    },
    {
      name: 'year',
      label: '年份',
      options: [
        { label: '全部', value: 'all', active: true },
        { label: '2026', value: '2026', active: false },
        { label: '2025', value: '2025', active: false },
        { label: '2024', value: '2024', active: false }
      ]
    },
    {
      name: 'sort',
      label: '排序',
      options: [
        { label: '最新', value: 'latest', active: true },
        { label: '最热', value: 'hot', active: false },
        { label: '评分', value: 'rating', active: false }
      ]
    }
  ],

  // movies 驱动电影主体卡片区，数组为空时主体区显示空状态。
  movies: [
    {
      id: 'catalog-movie-001',
      title: '远山回响',
      cover: '',
      summary: '剧情片，讲述一次远行后的选择。',
      year: '2026',
      rating: '9.1',
      remark: 'HD',
      sourceId: 'mock1',
      filter: {
        category: 'movie',
        genre: 'drama',
        region: 'cn',
        year: '2026',
        sort: 'latest'
      }
    },
    {
      id: 'catalog-movie-002',
      title: '城市边缘',
      cover: '',
      summary: '动作片，围绕城市边界的一次任务展开。',
      year: '2025',
      rating: '8.8',
      remark: '热播',
      sourceId: 'mock1',
      filter: {
        category: 'movie',
        genre: 'action',
        region: 'cn',
        year: '2025',
        sort: 'hot'
      }
    },
    {
      id: 'catalog-movie-003',
      title: '第七封信',
      cover: '',
      summary: '悬疑片，通过一封迟到的信揭开人物关系。',
      year: '2024',
      rating: '8.6',
      remark: '新片',
      sourceId: 'mock1',
      filter: {
        category: 'movie',
        genre: 'mystery',
        region: 'cn',
        year: '2024',
        sort: 'latest'
      }
    },
    {
      id: 'catalog-movie-004',
      title: '海面之下',
      cover: '',
      summary: '冒险片，展示海面之下的未知旅程。',
      year: '2026',
      rating: '8.4',
      remark: '推荐',
      sourceId: 'mock1',
      filter: {
        category: 'documentary',
        genre: 'drama',
        region: 'west',
        year: '2026',
        sort: 'rating'
      }
    },
    {
      id: 'catalog-movie-005',
      title: '夜航地图',
      cover: '',
      summary: '围绕夜间航线展开的故事。',
      year: '2025',
      rating: '8.3',
      remark: '更新',
      sourceId: 'mock1',
      filter: {
        category: 'movie',
        genre: 'mystery',
        region: 'asia',
        year: '2025',
        sort: 'latest'
      }
    },
    {
      id: 'catalog-movie-006',
      title: '风暴之前',
      cover: '',
      summary: '灾难背景下的人物群像。',
      year: '2024',
      rating: '8.0',
      remark: '精选',
      sourceId: 'mock1',
      filter: {
        category: 'movie',
        genre: 'action',
        region: 'west',
        year: '2024',
        sort: 'hot'
      }
    }
  ],

  // pagination 驱动电影页底部分页区，为 null 时分页区不渲染。
  pagination: {
    currentPage: 1,
    totalPages: 6,
    hasPrev: false,
    hasNext: true
  }
};
