/*
  mock-source.mock.js 模块说明

  - 文件职责:
      提供 当前项目 统一内容数据主干使用的完整 mock 数据源数据。
      供 mockSourceProvider.js 根据 SourceDataRequest 返回 SourceDataResponse。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      MOCK_SOURCE_ID: string，mock 数据源唯一标识。
      MOCK_SOURCE_NAME: string，mock 数据源展示名称。
      MOVIE_TOTAL_COUNT: number，电影目录 mock 内容总数。
      TV_TOTAL_COUNT: number，电视剧目录 mock 内容总数。
      HOME_BANNER_COUNT: number，首页轮播内容数量。
      HOME_CARD_COUNT: number，首页电影和电视剧卡片数量。
      HOME_RANKING_COUNT: number，首页单个排行榜内容数量。
      MOVIE_TITLE_SEEDS: Array<string>，电影标题种子。
      TV_TITLE_SEEDS: Array<string>，电视剧标题种子。
      GENRE_GROUPS: Array<Array<string>>，类型组合种子。
      AREA_SEEDS: Array<string>，地区种子。
      QUALITY_SEEDS: Array<string>，清晰度种子。
      DISPLAY_TAG_GROUPS: Array<Array<string>>，排行榜展示标签种子。

  - 模块级变量:
      无

  - 模块级辅助函数:
      padSequence(value)
          - params:
              -- value: number，待格式化的序号。
          - return:
              string，两位序号文本。
          - description:
              把内容序号整理成稳定 id 片段，避免 mock id 长短不一致。
      pickByIndex(list, index)
          - params:
              -- list: Array，候选数组。
              -- index: number，当前内容序号。
          - return:
              any，根据序号循环命中的候选值。
          - description:
              让 mock 内容在年份、地区、类型和标签上形成可预测分布。
      createSourceInfo(rawId)
          - params:
              -- rawId: string，源站原始内容 id。
          - return:
              object，ContentItem.source 来源字段。
          - description:
              为每条 mock 内容生成一致的数据源来源信息。
      createMovieEpisode(contentId, duration)
          - params:
              -- contentId: string，电影内容 id。
              -- duration: string，电影片长。
          - return:
              Array<object>，电影正片分集列表。
          - description:
              让电影也通过 episodes 暴露统一播放入口。
      createTvEpisodes(contentId, totalEpisodes)
          - params:
              -- contentId: string，电视剧内容 id。
              -- totalEpisodes: number，电视剧总集数。
          - return:
              Array<object>，电视剧分集列表。
          - description:
              为详情页和播放页提供可切换的 mock 分集数据。
      createPlaybackInfo(contentId, contentType, episodeId, quality)
          - params:
              -- contentId: string，内容 id。
              -- contentType: string，内容类型。
              -- episodeId: string，默认播放分集 id。
              -- quality: string，播放清晰度。
          - return:
              object，ContentItem.playback 播放字段。
          - description:
              为详情页和播放页生成统一播放线路数据。
      createMovieItem(index)
          - params:
              -- index: number，从 1 开始的电影序号。
          - return:
              object，电影 ContentItem。
          - description:
              按统一字段契约生成电影内容对象。
      createTvItem(index)
          - params:
              -- index: number，从 1 开始的电视剧序号。
          - return:
              object，电视剧 ContentItem。
          - description:
              按统一字段契约生成电视剧内容对象。
      createContentItems()
          - params:
              无
          - return:
              object，以 contentId 为键的 ContentItem 对象池。
          - description:
              一次性生成电影 48 条和电视剧 48 条，供页面数据块引用。
      createIdList(prefix, total)
          - params:
              -- prefix: string，内容 id 前缀。
              -- total: number，需要生成的 id 数量。
          - return:
              Array<string>，内容 id 列表。
          - description:
              生成页面数据块引用关系，避免手写长数组导致数量不稳定。
      createMockSourceData()
          - params:
              无
          - return:
              object，完整 mock 数据源对象。
          - description:
              组装 mock 数据源信息、内容池和页面数据块引用关系。

  - 模块级类:
      无

  - 对外导出:
      MOCK_SOURCE_ID: string，mock 数据源唯一标识。
      mockSourceData: object，集中式 mock 数据源数据对象。
*/

// 类型: string。
// 作用: 统一公开演示数据源 id，所有 ContentItem.sourceId 和 SourceDataRequest.sourceId 默认使用它。
export const MOCK_SOURCE_ID = 'mock1';

// 类型: string。
// 作用: 统一公开演示数据源名称，供 ContentItem.sourceName、source.name 和页面展示读取。
const MOCK_SOURCE_NAME = '模拟源1';

// 类型: number。
// 作用: 电影页每页 24 条，准备双倍数量保证至少存在第二页数据。
const MOVIE_TOTAL_COUNT = 48;

// 类型: number。
// 作用: 电视剧页每页 24 条，准备双倍数量保证至少存在第二页数据。
const TV_TOTAL_COUNT = 48;

// 类型: number。
// 作用: 首页轮播固定展示 6 条重点内容。
const HOME_BANNER_COUNT = 6;

// 类型: number。
// 作用: 首页电影卡片和电视剧卡片各展示 8 条，匹配两行四列首页区块。
const HOME_CARD_COUNT = 8;

// 类型: number。
// 作用: 首页单个排行榜保留 20 条内容，匹配用户指定榜单容量。
const HOME_RANKING_COUNT = 20;

// 类型: Array<string>。
// 作用: 电影标题种子，数量和 MOVIE_TOTAL_COUNT 保持一致，保证每条电影都有可读标题。
const MOVIE_TITLE_SEEDS = [
  '远山回响', '城市边缘', '第七封信', '海面之下', '夜航电台', '风雪归途',
  '无人码头', '长街灯火', '群山来信', '北城档案', '南方列车', '灰蓝假日',
  '暮色行者', '旧梦邮差', '白塔疑云', '深巷计划', '河湾旅馆', '黎明之前',
  '折返航班', '雾中剧场', '冬日来客', '暗线追踪', '边境日记', '一封未寄出的信',
  '落日证词', '春潮旧事', '逆光车站', '雨夜名单', '月台风声', '沉默证人',
  '山城旧案', '蓝色走廊', '最后一班车', '窗外有海', '冷雨行动', '无名合伙人',
  '高架桥下', '时间裂缝', '白夜追问', '离岸风暴', '晨雾办公室', '沙洲迷局',
  '回声实验', '银灰公路', '双城备忘录', '午夜档案', '暗河来信', '第九封口供'
];

// 类型: Array<string>。
// 作用: 电视剧标题种子，数量和 TV_TOTAL_COUNT 保持一致，保证每条电视剧都有可读标题。
const TV_TITLE_SEEDS = [
  '晨光办公室', '南方来信', '无声街区', '旧日航线', '晴空档案', '边城故事',
  '海风归处', '北巷人家', '风起山河', '半夏时光', '长夜灯塔', '雾都笔记',
  '白楼春秋', '城市纹理', '临江旧事', '逐光者', '山海之间', '昨日星辰',
  '暗巷追声', '热浪季节', '落雪名单', '河岸剧场', '归途有风', '灯火人间',
  '时间的门', '云上法庭', '深蓝诊室', '寻路者', '向阳而生', '旧城新案',
  '北纬三十度', '盛夏合伙人', '烟火长街', '冬雾追踪', '星河检察官', '隐秘工位',
  '白昼边境', '逆风档案', '海岸来电', '故里重逢', '山谷办公室', '暗夜寻踪',
  '风暴会议室', '春日未央', '长街少年', '南城旧梦', '灯塔诊疗室', '群星之间'
];

// 类型: Array<Array<string>>。
// 作用: 内容类型组合种子，用于让目录筛选、搜索和卡片展示具备不同类型分布。
const GENRE_GROUPS = [
  ['剧情', '家庭'],
  ['动作', '犯罪'],
  ['悬疑', '剧情'],
  ['冒险', '奇幻'],
  ['喜剧', '生活'],
  ['科幻', '悬疑'],
  ['年代', '剧情'],
  ['职场', '都市']
];

// 类型: Array<string>。
// 作用: 地区种子，用于模拟外部数据源站返回不同地区内容。
const AREA_SEEDS = ['中国大陆', '中国香港', '美国', '日本', '韩国', '英国', '法国', '泰国'];

// 类型: Array<string>。
// 作用: 清晰度种子，用于电影左上角状态字段和播放线路质量字段。
const QUALITY_SEEDS = ['HD', '1080P', '4K', '高清'];

// 类型: Array<Array<string>>。
// 作用: 排行榜展示标签种子，HotRanking 会直接读取 displayTags，不在组件内推导标签。
const DISPLAY_TAG_GROUPS = [
  ['新', '热', '高分'],
  ['热', '高分'],
  ['新'],
  ['热'],
  ['高分'],
  []
];

/**
 * 把序号格式化成两位文本。
 * 纯函数: 只根据输入序号返回文本，不读取或修改外部状态。
 *
 * @param {number} value 待格式化的序号。
 * @returns {string} 两位序号文本。
 */
function padSequence(value) {
  // 返回值类型: string。
  // 作用: 统一 id 中的序号长度，让 movie-001、tv-001 等 id 排序稳定。
  return String(value).padStart(3, '0');
}

/**
 * 根据序号从候选数组中循环取值。
 * 纯函数: 只读取传入数组和序号，不修改数组。
 *
 * @param {Array} list 候选数组。
 * @param {number} index 当前内容序号。
 * @returns {*} 命中的候选值；候选数组为空时返回空字符串。
 */
function pickByIndex(list, index) {
  // 条件分支: 候选值不是有效数组时进入。
  // 执行内容: 返回空字符串，避免调用方读取 undefined。
  if (!Array.isArray(list) || !list.length) {
    return '';
  }

  // 返回值类型: any。
  // 作用: 使用取模让 mock 字段在固定种子中循环分布。
  return list[(index - 1) % list.length];
}

/**
 * 创建内容来源字段。
 * 纯函数: 只根据 rawId 生成新对象，不修改外部状态。
 *
 * @param {string} rawId 源站原始内容 id。
 * @returns {object} ContentItem.source 来源字段。
 */
function createSourceInfo(rawId) {
  // 返回值类型: object。
  // 作用: 提供统一来源信息，详情页和调试数据流时可以识别内容来自 mock 源。
  return {
    // 类型: string。
    // 作用: 来源名称，当前项目固定为 mock 源。
    name: MOCK_SOURCE_NAME,

    // 类型: string。
    // 作用: 来源域名说明，和公开演示数据源 com.mock1 保持一致。
    domain: 'com.mock1',

    // 类型: string。
    // 作用: 源站原始 id，方便后续外部数据源接入时对照字段位置。
    rawId,

    // 类型: string。
    // 作用: 源站详情页地址，mock 阶段为空。
    sourceDetailUrl: '',

    // 类型: null。
    // 作用: 源站原始数据，mock 阶段不保存原始 HTML 或 JSON。
    rawData: null,

    // 类型: string。
    // 作用: 内容抓取时间，mock 阶段由响应 meta 记录，不在条目中固定写死。
    fetchedAt: ''
  };
}

/**
 * 创建电影正片分集。
 * 纯函数: 根据内容 id 和片长返回新数组。
 *
 * @param {string} contentId 电影内容 id。
 * @param {string} duration 电影片长。
 * @returns {Array<object>} 电影正片分集列表。
 */
function createMovieEpisode(contentId, duration) {
  // 返回值类型: Array<object>。
  // 作用: 电影也通过 episodes 暴露播放入口，让详情页和播放页不需要区分电影/电视剧入口结构。
  return [
    {
      // 类型: string。
      // 作用: 电影正片分集 id。
      id: `${contentId}-main`,

      // 类型: number。
      // 作用: 正片统一作为第 1 个播放项。
      episodeNumber: 1,

      // 类型: string。
      // 作用: 分集标题。
      title: '正片',

      // 类型: string。
      // 作用: 详情页和播放页按钮展示文案。
      label: '正片',

      // 类型: string。
      // 作用: 正片时长，播放卡片和详情页可以按需读取。
      duration,

      // 类型: string。
      // 作用: 分集简介，mock 阶段留空。
      description: '',

      // 类型: string。
      // 作用: 分集封面，mock 阶段留空。
      cover: '',

      // 类型: boolean。
      // 作用: true 表示该播放项可播放；false 表示后续可做不可播占位。
      playable: true
    }
  ];
}

/**
 * 创建电视剧分集列表。
 * 纯函数: 根据内容 id 和总集数生成前 6 个可播放分集。
 *
 * @param {string} contentId 电视剧内容 id。
 * @param {number} totalEpisodes 电视剧总集数。
 * @returns {Array<object>} 电视剧分集列表。
 */
function createTvEpisodes(contentId, totalEpisodes) {
  // 类型: number。
  // 作用: mock 阶段详情页最多展示 6 个分集入口，避免每条电视剧生成过长数据。
  const visibleEpisodeCount = Math.min(Number(totalEpisodes) || 1, 6);

  // 返回值类型: Array<object>。
  // 作用: 生成可供详情页选择和播放页切换的分集数组。
  return Array.from({ length: visibleEpisodeCount }, (unusedValue, itemIndex) => {
    // 类型: number。
    // 作用: 分集序号从 1 开始，便于生成 label 和 episodeNumber。
    const episodeNumber = itemIndex + 1;

    // 返回值类型: object。
    // 作用: 单个电视剧分集对象。
    return {
      id: `${contentId}-episode-${padSequence(episodeNumber)}`,
      episodeNumber,
      title: `第${episodeNumber}集`,
      label: `第${episodeNumber}集`,
      duration: `${42 + (episodeNumber % 6)}分钟`,
      description: '',
      cover: '',
      playable: true
    };
  });
}

/**
 * 创建播放信息。
 * 纯函数: 根据内容基础字段生成播放线路对象。
 *
 * @param {string} contentId 内容 id。
 * @param {string} contentType 内容类型。
 * @param {string} episodeId 默认播放分集 id。
 * @param {string} quality 播放清晰度。
 * @returns {object} ContentItem.playback 播放字段。
 */
function createPlaybackInfo(contentId, contentType, episodeId, quality) {
  // 类型: string。
  // 作用: 默认播放线路 id，播放页会用它初始化线路高亮。
  const defaultSourceId = `${contentId}-line-01`;

  // 返回值类型: object。
  // 作用: 生成播放页可读取的 mock 播放信息。
  return {
    defaultSourceId,
    sources: [
      {
        id: defaultSourceId,
        name: 'Mock 线路一',
        type: 'mp4',
        url: `/media/demo/${contentType}/${contentId}.mp4`,
        quality,
        available: true,
        episodeId
      }
    ],
    headers: {
      referer: '',
      userAgent: ''
    },
    sourcePlayUrl: ''
  };
}

/**
 * 创建电影 ContentItem。
 * 纯函数: 根据序号生成稳定电影对象。
 *
 * @param {number} index 从 1 开始的电影序号。
 * @returns {object} 电影 ContentItem。
 */
function createMovieItem(index) {
  // 类型: string。
  // 作用: 电影内容 id，页面路由和页面数据块都引用该字段。
  const contentId = `movie-${padSequence(index)}`;

  // 类型: string。
  // 作用: 电影标题，来自标题种子数组。
  const title = MOVIE_TITLE_SEEDS[index - 1] || `电影样片 ${index}`;

  // 类型: Array<string>。
  // 作用: 当前电影的类型组合，用于卡片、筛选和搜索。
  const genres = pickByIndex(GENRE_GROUPS, index);

  // 类型: string。
  // 作用: 当前电影地区，用于卡片和后续筛选。
  const area = pickByIndex(AREA_SEEDS, index);

  // 类型: string。
  // 作用: 当前电影清晰度，用于 VideoCard 左上角状态字段。
  const quality = pickByIndex(QUALITY_SEEDS, index);

  // 类型: string。
  // 作用: 当前电影片长，VideoCard 会格式化为播放总时长。
  const duration = `${96 + (index % 38)}分钟`;

  // 类型: Array<object>。
  // 作用: 电影正片分集列表，供详情页和播放页读取。
  const episodes = createMovieEpisode(contentId, duration);

  // 返回值类型: object。
  // 作用: 完整电影 ContentItem，覆盖首页、目录、搜索、详情和播放所需字段。
  return {
    id: contentId,
    sourceId: MOCK_SOURCE_ID,
    sourceName: MOCK_SOURCE_NAME,
    type: 'movie',
    title,
    originalTitle: index <= HOME_BANNER_COUNT ? `${title} / Mock Original ${index}` : '',
    aliases: index % 5 === 0 ? [`${title} 别名`] : [],
    poster: '',
    cover: '',
    description: `${genres[0]}片，围绕${title}展开的一段人物选择和事件追踪。`,
    year: String(2026 - ((index - 1) % 4)),
    area,
    language: index % 3 === 0 ? '英语' : '国语',
    genres,
    tags: [quality, ...genres],
    displayTags: pickByIndex(DISPLAY_TAG_GROUPS, index),
    score: Number((9.2 - ((index - 1) % 16) * 0.1).toFixed(1)),
    quality,
    rank: index,
    badge: quality,
    detail: {
      fullDescription: `${title}是一部用于 当前项目 阶段目录、详情和播放链路验证的 mock 电影，字段覆盖标题、简介、演员、年份、地区、类型、播放入口和排行榜展示标签。`,
      directors: [`导演 ${padSequence(index)}`],
      writers: [`编剧 ${padSequence(index)}`],
      actors: [`演员 ${index}A`, `演员 ${index}B`, `演员 ${index}C`],
      releaseDate: `${2026 - ((index - 1) % 4)}-${String((index % 12) + 1).padStart(2, '0')}-12`,
      updateTime: '',
      status: '已上映',
      screenshots: [],
      trailerUrl: ''
    },
    movie: {
      duration
    },
    tv: {
      totalEpisodes: null,
      latestEpisode: null,
      updateStatus: '',
      season: ''
    },
    episodes,
    playback: createPlaybackInfo(contentId, 'movie', episodes[0].id, quality),
    source: createSourceInfo(contentId)
  };
}

/**
 * 创建电视剧 ContentItem。
 * 纯函数: 根据序号生成稳定电视剧对象。
 *
 * @param {number} index 从 1 开始的电视剧序号。
 * @returns {object} 电视剧 ContentItem。
 */
function createTvItem(index) {
  // 类型: string。
  // 作用: 电视剧内容 id，页面路由和页面数据块都引用该字段。
  const contentId = `tv-${padSequence(index)}`;

  // 类型: string。
  // 作用: 电视剧标题，来自标题种子数组。
  const title = TV_TITLE_SEEDS[index - 1] || `电视剧样片 ${index}`;

  // 类型: Array<string>。
  // 作用: 当前电视剧的类型组合，用于卡片、筛选和搜索。
  const genres = pickByIndex(GENRE_GROUPS, index + 2);

  // 类型: string。
  // 作用: 当前电视剧地区，用于卡片和后续筛选。
  const area = pickByIndex(AREA_SEEDS, index + 1);

  // 类型: number。
  // 作用: 当前电视剧总集数，VideoCard 左上角状态字段会读取该值。
  const totalEpisodes = 12 + (index % 25);

  // 类型: number。
  // 作用: 当前电视剧已更新集数，奇数条模拟连载，偶数条模拟完结。
  const latestEpisode = index % 2 === 0 ? totalEpisodes : Math.max(1, totalEpisodes - (index % 6));

  // 类型: string。
  // 作用: 当前电视剧更新状态，作为卡片和榜单状态字段来源。
  const updateStatus = latestEpisode >= totalEpisodes ? `全${totalEpisodes}集` : `更新至${latestEpisode}集`;

  // 类型: string。
  // 作用: 当前电视剧播放清晰度，用于播放线路质量字段。
  const quality = pickByIndex(QUALITY_SEEDS, index + 1);

  // 类型: Array<object>。
  // 作用: 电视剧分集列表，供详情页和播放页读取。
  const episodes = createTvEpisodes(contentId, totalEpisodes);

  // 返回值类型: object。
  // 作用: 完整电视剧 ContentItem，覆盖首页、目录、搜索、详情和播放所需字段。
  return {
    id: contentId,
    sourceId: MOCK_SOURCE_ID,
    sourceName: MOCK_SOURCE_NAME,
    type: 'tv',
    title,
    originalTitle: index <= HOME_BANNER_COUNT ? `${title} / Mock Series ${index}` : '',
    aliases: index % 6 === 0 ? [`${title} 特别篇`] : [],
    poster: '',
    cover: '',
    description: `${genres[0]}剧，讲述${title}中的人物关系、阶段任务和长期冲突。`,
    year: String(2026 - ((index - 1) % 4)),
    area,
    language: index % 4 === 0 ? '韩语' : '国语',
    genres,
    tags: [updateStatus, ...genres],
    displayTags: pickByIndex(DISPLAY_TAG_GROUPS, index + 1),
    score: Number((9.1 - ((index - 1) % 15) * 0.1).toFixed(1)),
    quality,
    rank: index,
    badge: updateStatus,
    detail: {
      fullDescription: `${title}是一部用于 当前项目 阶段目录、详情和播放链路验证的 mock 电视剧，字段覆盖剧集状态、分集、简介、演员和播放线路。`,
      directors: [`导演 T${padSequence(index)}`],
      writers: [`编剧 T${padSequence(index)}`],
      actors: [`演员 T${index}A`, `演员 T${index}B`, `演员 T${index}C`],
      releaseDate: `${2026 - ((index - 1) % 4)}-${String((index % 12) + 1).padStart(2, '0')}-08`,
      updateTime: '',
      status: latestEpisode >= totalEpisodes ? '已完结' : '连载中',
      screenshots: [],
      trailerUrl: ''
    },
    movie: {
      duration: ''
    },
    tv: {
      totalEpisodes,
      latestEpisode,
      updateStatus,
      season: '第一季'
    },
    episodes,
    playback: createPlaybackInfo(contentId, 'tv', episodes[0].id, quality),
    source: createSourceInfo(contentId)
  };
}

/**
 * 创建统一内容对象池。
 * 纯函数: 生成新的内容对象集合，不读取或修改外部运行态 store。
 *
 * @returns {object} 以 contentId 为键的 ContentItem 对象池。
 */
function createContentItems() {
  // 类型: Array<object>。
  // 作用: 生成电影内容列表，数量满足电影页双页数据要求。
  const movieItems = Array.from({ length: MOVIE_TOTAL_COUNT }, (unusedValue, itemIndex) => createMovieItem(itemIndex + 1));

  // 类型: Array<object>。
  // 作用: 生成电视剧内容列表，数量满足电视剧页双页数据要求。
  const tvItems = Array.from({ length: TV_TOTAL_COUNT }, (unusedValue, itemIndex) => createTvItem(itemIndex + 1));

  // 返回值类型: object。
  // 作用: 把数组转换成以 id 为键的内容池，provider 后续按 id 读取内容对象。
  return [...movieItems, ...tvItems].reduce((contentMap, item) => {
    // 副作用: 写入当前 reduce 累积对象。
    // 影响范围: 仅影响本次 createContentItems 返回的局部 contentMap。
    contentMap[item.id] = item;

    // 返回值类型: object。
    // 作用: 返回累积对象供下一轮 reduce 使用。
    return contentMap;
  }, {});
}

/**
 * 创建内容 id 引用列表。
 * 纯函数: 根据前缀和数量生成稳定 id 数组。
 *
 * @param {string} prefix 内容 id 前缀，例如 movie 或 tv。
 * @param {number} total 需要生成的数量。
 * @returns {Array<string>} 内容 id 列表。
 */
function createIdList(prefix, total) {
  // 返回值类型: Array<string>。
  // 作用: 生成页面数据块引用，provider 根据这些 id 回到 contentItems 取对象。
  return Array.from({ length: total }, (unusedValue, itemIndex) => `${prefix}-${padSequence(itemIndex + 1)}`);
}

/**
 * 创建完整 mock 数据源对象。
 * 纯函数: 组装 source、contentItems 和 pages，不读取外部运行态。
 *
 * @returns {object} mock 数据源完整对象。
 */
function createMockSourceData() {
  // 类型: Array<string>。
  // 作用: 电影页完整内容引用，数量为 48。
  const movieIds = createIdList('movie', MOVIE_TOTAL_COUNT);

  // 类型: Array<string>。
  // 作用: 电视剧页完整内容引用，数量为 48。
  const tvIds = createIdList('tv', TV_TOTAL_COUNT);

  // 返回值类型: object。
  // 作用: 集中保存 mock 数据源信息、统一内容对象池和页面数据块引用关系。
  return {
    source: {
      id: MOCK_SOURCE_ID,
      name: MOCK_SOURCE_NAME,
      domain: 'com.mock1',
      enabled: true
    },
    contentItems: createContentItems(),
    pages: {
      home: {
        banners: [...movieIds.slice(0, 3), ...tvIds.slice(0, HOME_BANNER_COUNT - 3)],
        hotMovies: movieIds.slice(0, HOME_CARD_COUNT),
        hotTv: tvIds.slice(0, HOME_CARD_COUNT),
        movieRanking: movieIds.slice(0, HOME_RANKING_COUNT),
        tvRanking: tvIds.slice(0, HOME_RANKING_COUNT)
      },
      movie: movieIds,
      tv: tvIds,
      search: [...movieIds, ...tvIds]
    }
  };
}

// 类型: object。
// 作用: 集中保存 mock 数据源信息、统一内容对象池和页面数据块引用关系。
// 字段: source，object，mock 数据源基础信息，后续可写入 SiteContentStore.sources。
// 字段: contentItems，object，以 contentId 为键的 ContentItem 数据池，避免同一内容在多个页面重复定义。
// 字段: pages，object，页面数据块引用关系，provider 根据 pageKey/moduleKey 从这里读取内容 id 列表。
export const mockSourceData = createMockSourceData();
