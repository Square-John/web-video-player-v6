/*
  电视剧页静态数据。
  作用：为电视剧页布局提供本地数据，并记录电视剧页三个分区的数据形状。
*/
export const tvPageData = {
  // filters 驱动电视剧页筛选区，最多只使用类型、剧情、地区、年份、排序这五组筛选。
  filters: [
    {
      name: 'category',
      label: '类型',
      options: [
        { label: '全部', value: 'all', active: true },
        { label: '电视剧', value: 'tv', active: false },
        { label: '短剧', value: 'short', active: false },
        { label: '综艺', value: 'variety', active: false }
      ]
    },
    {
      name: 'genre',
      label: '剧情',
      options: [
        { label: '全部', value: 'all', active: true },
        { label: '剧情', value: 'drama', active: false },
        { label: '悬疑', value: 'mystery', active: false },
        { label: '职场', value: 'workplace', active: false }
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

  // tvList 驱动电视剧主体卡片区，数组为空时主体区显示空状态。
  tvList: [
    {
      id: 'catalog-tv-001',
      title: '晨光办公室',
      cover: '',
      summary: '围绕办公室日常展开的职场剧。',
      year: '2026',
      rating: '9.0',
      remark: '更新至 12 集',
      sourceId: 'mock1',
      filter: {
        category: 'tv',
        genre: 'workplace',
        region: 'cn',
        year: '2026',
        sort: 'latest'
      }
    },
    {
      id: 'catalog-tv-002',
      title: '南方来信',
      cover: '',
      summary: '以书信和家庭关系为线索的剧情剧。',
      year: '2025',
      rating: '8.7',
      remark: '全 24 集',
      sourceId: 'mock1',
      filter: {
        category: 'tv',
        genre: 'drama',
        region: 'cn',
        year: '2025',
        sort: 'hot'
      }
    },
    {
      id: 'catalog-tv-003',
      title: '无声街区',
      cover: '',
      summary: '发生在街区中的悬疑故事。',
      year: '2026',
      rating: '8.5',
      remark: '更新至 8 集',
      sourceId: 'mock1',
      filter: {
        category: 'tv',
        genre: 'mystery',
        region: 'cn',
        year: '2026',
        sort: 'latest'
      }
    },
    {
      id: 'catalog-tv-004',
      title: '旧日航线',
      cover: '',
      summary: '年代背景下关于航线和人物命运的故事。',
      year: '2024',
      rating: '8.2',
      remark: '全 18 集',
      sourceId: 'mock1',
      filter: {
        category: 'tv',
        genre: 'drama',
        region: 'west',
        year: '2024',
        sort: 'rating'
      }
    },
    {
      id: 'catalog-tv-005',
      title: '北城档案',
      cover: '',
      summary: '围绕城市旧案展开的连续剧。',
      year: '2025',
      rating: '8.4',
      remark: '更新至 10 集',
      sourceId: 'mock1',
      filter: {
        category: 'tv',
        genre: 'mystery',
        region: 'cn',
        year: '2025',
        sort: 'latest'
      }
    },
    {
      id: 'catalog-tv-006',
      title: '星期三会议',
      cover: '',
      summary: '轻喜剧风格的职场群像故事。',
      year: '2024',
      rating: '8.1',
      remark: '全 16 集',
      sourceId: 'mock1',
      filter: {
        category: 'tv',
        genre: 'workplace',
        region: 'asia',
        year: '2024',
        sort: 'hot'
      }
    }
  ],

  // pagination 驱动电视剧页底部分页区，为 null 时分页区不渲染。
  pagination: {
    currentPage: 1,
    totalPages: 4,
    hasPrev: false,
    hasNext: true
  }
};
