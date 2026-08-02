/*
  response-fixtures.js 模块说明

  - 文件职责:
      提供 MockNetworkAdapter 唯一读取的四源模拟网络原始响应。
      为 system-source-1、system-source-3、system-source-2、system-source-4 分别提供独立 catalog 和 health 精确路由。
      A 协议使用 site/entries 嵌套字段，B 协议使用 station/data.videos 与 vod 字段，Provider 数据集负责后续标准化。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      JSON_RESPONSE_HEADERS: object，模拟 JSON 响应统一头部。
      PROTOCOL_A_SOURCE_FIXTURES: Array<object>，system-source-1 与 system-source-3 的原始响应配置。
      PROTOCOL_B_SOURCE_FIXTURES: Array<object>，system-source-2 与 system-source-4 的原始响应配置。
      PROTOCOL_ROUTE_BUILDERS: object，protocolKey 到 catalog/health body 构建器的冻结映射。
      mockNetworkResponseFixtures: Array<object>，四源八条精确模拟路由。

  - 模块级变量:
      无

  - 模块级辅助函数:
      freezeJsonValue(value)
          - params:
              -- value: *，待递归冻结的严格 JSON Value。
          - return:
              *，原值的深冻结结果。
          - description:
              防止默认 fixture 在 Adapter 构造前被模块调用方篡改。
      createContentSeed(id, type, title, year, area, genres, score, quality, rank, badge, totalEpisodes)
          - params:
              -- id: string，源内内容 id。
              -- type: string，movie 或 tv。
              -- title: string，可辨认内容标题。
              -- year: string，内容年份。
              -- area: string，内容地区。
              -- genres: Array<string>，内容类型集合。
              -- score: number，内容评分。
              -- quality: string，内容清晰度。
              -- rank: number，内容目录排名。
              -- badge: string，内容展示角标。
              -- totalEpisodes: number，电视剧总集数；电影传 0。
          - return:
              object，供协议构建器消费的冻结内容种子。
          - description:
              集中声明可辨认内容，避免在原始协议对象中复制公共测试值。
      createSourceFixtureConfig(sourceId, protocolKey, name, domain, generatedAt, checkedAt, items)
          - params:
              -- sourceId: string，真实数据源 id。
              -- protocolKey: string，受审 A/B 协议标识。
              -- name: string，原始站点名称。
              -- domain: string，原始站点域名。
              -- generatedAt: string，目录生成时间。
              -- checkedAt: string，健康检查时间。
              -- items: Array<object>，当前源内容种子。
          - return:
              object，冻结源级 fixture 配置。
          - description:
              只保存身份与内容输入，不生成标准 ContentItem。
      createEpisodeSeeds(seed)
          - params:
              -- seed: object，当前内容种子。
          - return:
              Array<object>，协议构建器共用的分集语义种子。
          - description:
              电影生成正片，电视剧生成前三个可播放分集。
      createProtocolARawItem(seed, sourceConfig)
          - params:
              -- seed: object，当前内容种子。
              -- sourceConfig: object，当前源站配置。
          - return:
              object，A 协议嵌套原始内容条目。
          - description:
              生成 contentKey/media/artwork 等 A 协议字段。
      createProtocolBRawItem(seed, sourceConfig)
          - params:
              -- seed: object，当前内容种子。
              -- sourceConfig: object，当前源站配置。
          - return:
              object，B 协议 vod 原始内容条目。
          - description:
              生成 vod_*、分隔文本和数字文本等 B 协议字段。
      createProtocolACatalogBody(sourceConfig)
          - params:
              -- sourceConfig: object，当前 A 协议源配置。
          - return:
              object，A 协议目录原始 body。
          - description:
              组装 site/entries 目录外壳。
      createProtocolAHealthBody(sourceConfig)
          - params:
              -- sourceConfig: object，当前 A 协议源配置。
          - return:
              object，A 协议健康原始 body。
          - description:
              组装 service/state 健康外壳。
      createProtocolBCatalogBody(sourceConfig)
          - params:
              -- sourceConfig: object，当前 B 协议源配置。
          - return:
              object，B 协议目录原始 body。
          - description:
              组装 station/data.videos 目录外壳。
      createProtocolBHealthBody(sourceConfig)
          - params:
              -- sourceConfig: object，当前 B 协议源配置。
          - return:
              object，B 协议健康原始 body。
          - description:
              组装 node/online 健康外壳。
      createResponseFixture(sourceId, routeName, body)
          - params:
              -- sourceId: string，当前精确路由身份。
              -- routeName: string，catalog 或 health 路径。
              -- body: object，当前协议原始响应体。
          - return:
              object，MockNetworkAdapter 可索引的标准 fixture 路由。
          - description:
              统一八条路由的网络外壳，不改变原始 body 协议。
      createSourceRoutes(sourceConfig)
          - params:
              -- sourceConfig: object，当前源级 fixture 配置。
          - return:
              Array<object>，当前源 catalog 和 health 两条路由。
          - description:
              仅按 protocolKey 选择受审 body 构建器，不按 sourceId 拼标准响应。

  - 模块级类:
      无

  - 对外导出:
      mockNetworkResponseFixtures: Array<object>，只允许 MockNetworkAdapter 生产源码导入的八条冻结路由。
*/

// 类型: object。
// 作用: 标识八条模拟响应 body 都是 JSON；Adapter 会复制为隔离响应头。
const JSON_RESPONSE_HEADERS = Object.freeze({
  // 类型: string。
  // 作用: 告诉 Provider 当前原始 body 使用 UTF-8 JSON 结构。
  'content-type': 'application/json; charset=utf-8'
});

/**
 * 递归冻结 fixture 严格 JSON Value。
 * 副作用: 只冻结模块初始化时新创建的对象和数组，不写应用状态或外部存储。
 * 成功路径: 所有嵌套对象和数组均不可变并返回原根值。
 *
 * @param {*} value 待冻结严格 JSON Value。
 * @returns {*} 深冻结后的原值。
 */
function freezeJsonValue(value) {
  // 条件分支: 当前值是尚未冻结的对象或数组时进入。
  // 执行内容: 先冻结全部子值，再冻结当前容器，防止嵌套字段被替换。
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    // 循环类型: Reflect.ownKeys 与 Array.prototype.forEach。
    // 初始值: 当前容器第一项自有字段。
    // 终止条件: 全部子值完成递归冻结。
    // 循环作用: 数组索引和普通对象字段使用同一冻结规则。
    Reflect.ownKeys(value).forEach(key => freezeJsonValue(value[key]));
    Object.freeze(value);
  }

  return value;
}

/**
 * 创建协议无关的内容语义种子。
 * 纯函数: 返回新的冻结对象，不生成 ContentItem 或协议 body。
 *
 * @param {string} id 源内内容 id。
 * @param {string} type movie 或 tv。
 * @param {string} title 可辨认内容标题。
 * @param {string} year 内容年份。
 * @param {string} area 内容地区。
 * @param {Array<string>} genres 内容类型集合。
 * @param {number} score 内容评分。
 * @param {string} quality 内容清晰度。
 * @param {number} rank 内容目录排名。
 * @param {string} badge 内容展示角标。
 * @param {number} totalEpisodes 电视剧总集数；电影传 0。
 * @returns {object} 冻结内容种子。
 */
function createContentSeed(
  id,
  type,
  title,
  year,
  area,
  genres,
  score,
  quality,
  rank,
  badge,
  totalEpisodes
) {
  return Object.freeze({
    id,
    type,
    title,
    year,
    area,
    genres: Object.freeze([...genres]),
    score,
    quality,
    rank,
    badge,
    totalEpisodes
  });
}

/**
 * 创建源级 fixture 配置。
 * 纯函数: 返回新的冻结对象和 items 数组，不生成网络路由。
 *
 * @param {string} sourceId 真实数据源 id。
 * @param {string} protocolKey 受审协议标识。
 * @param {string} name 原始站点名称。
 * @param {string} domain 原始站点域名。
 * @param {string} generatedAt 目录生成时间。
 * @param {string} checkedAt 健康检查时间。
 * @param {Array<object>} items 当前源内容种子。
 * @returns {object} 冻结源级 fixture 配置。
 */
function createSourceFixtureConfig(
  sourceId,
  protocolKey,
  name,
  domain,
  generatedAt,
  checkedAt,
  items
) {
  return Object.freeze({
    sourceId,
    protocolKey,
    name,
    domain,
    generatedAt,
    checkedAt,
    items: Object.freeze([...items])
  });
}

// 类型: Array<object>。
// 作用: 定义 system-source-1 与 system-source-3 的可辨认 A 协议内容和固定响应时间；每个源拥有独立身份与端点。
const PROTOCOL_A_SOURCE_FIXTURES = Object.freeze([
  createSourceFixtureConfig(
    'system-source-1',
    'mock-protocol-a',
    '系统数据源1',
    'system-source-1.invalid',
    '2026-07-16T08:00:00.000Z',
    '2026-07-16T08:01:00.000Z',
    [
      createContentSeed('system-source-1-movie-001', 'movie', '雾港回声', '2025', '中国大陆', ['悬疑', '剧情'], 8.6, '4K', 1, '高分', 0),
      createContentSeed('system-source-1-tv-001', 'tv', '星桥来信', '2026', '中国大陆', ['都市', '生活'], 8.2, '1080P', 2, '热播', 12)
    ]
  ),
  createSourceFixtureConfig(
    'system-source-3',
    'mock-protocol-a',
    '系统数据源3',
    'system-source-3.invalid',
    '2026-07-16T08:10:00.000Z',
    '2026-07-16T08:11:00.000Z',
    [
      createContentSeed('system-source-3-movie-001', 'movie', '石屋谜案', '2024', '英国', ['悬疑', '犯罪'], 8.1, 'HD', 1, '精选', 0),
      createContentSeed('system-source-3-tv-001', 'tv', '山谷信号', '2025', '法国', ['科幻', '冒险'], 7.9, '1080P', 2, '连载', 10)
    ]
  )
]);

// 类型: Array<object>。
// 作用: 定义 system-source-2 与 system-source-4 的可辨认 B 协议内容和固定响应时间；字段最终由 vod 协议构建器压缩。
const PROTOCOL_B_SOURCE_FIXTURES = Object.freeze([
  createSourceFixtureConfig(
    'system-source-2',
    'mock-protocol-b',
    '系统数据源2',
    'system-source-2.invalid',
    '2026-07-16T08:20:00.000Z',
    '2026-07-16T08:21:00.000Z',
    [
      createContentSeed('system-source-2-movie-101', 'movie', '风筝档案', '2023', '中国香港', ['动作', '犯罪'], 7.8, '高清', 1, '动作', 0),
      createContentSeed('system-source-2-tv-101', 'tv', '潮汐警局', '2025', '韩国', ['悬疑', '职场'], 8.4, '1080P', 2, '热播', 16)
    ]
  ),
  createSourceFixtureConfig(
    'system-source-4',
    'mock-protocol-b',
    '系统数据源4',
    'system-source-4.invalid',
    '2026-07-16T08:30:00.000Z',
    '2026-07-16T08:31:00.000Z',
    [
      createContentSeed('system-source-4-movie-201', 'movie', '镜面旅程', '2026', '美国', ['科幻', '剧情'], 8.8, '4K', 1, '新片', 0),
      createContentSeed('system-source-4-tv-201', 'tv', '云端追踪', '2024', '日本', ['冒险', '悬疑'], 8, 'HD', 2, '完结', 8)
    ]
  )
]);

/**
 * 创建内容分集语义种子。
 * 纯函数: 返回新数组和对象，不修改内容种子。
 * 兜底策略: 电影固定生成一条正片；电视剧最多生成前三集，至少生成一集。
 *
 * @param {object} seed 当前内容种子。
 * @returns {Array<object>} 分集语义种子。
 */
function createEpisodeSeeds(seed) {
  // 类型: number。
  // 作用: 电影使用一条正片，电视剧使用总集数和三之间较小值，避免 fixture 无意义膨胀。
  const episodeCount = seed.type === 'movie' ? 1 : Math.max(1, Math.min(seed.totalEpisodes, 3));

  // 循环类型: Array.from。
  // 初始值: 序号 1。
  // 终止条件: 达到当前内容受审分集数量。
  // 循环作用: 创建协议构建器可以改名的分集语义对象。
  return Array.from({ length: episodeCount }, (_, index) => {
    // 类型: number。
    // 作用: 把零基索引转换为页面和原始协议都使用的一基分集序号。
    const sequence = index + 1;

    return {
      id: seed.type === 'movie' ? `${seed.id}-feature` : `${seed.id}-ep-${sequence}`,
      sequence,
      title: seed.type === 'movie' ? '正片' : `第 ${sequence} 集`,
      label: seed.type === 'movie' ? '正片' : `第${sequence}集`,
      duration: seed.type === 'movie' ? '118分钟' : '45分钟',
      description: `${seed.title}${seed.type === 'movie' ? '正片' : `第 ${sequence} 集`}模拟简介`,
      playable: true
    };
  });
}

/**
 * 创建 A 协议原始内容条目。
 * 纯函数: 返回新的 site/entries 条目，不保留内容种子数组引用。
 *
 * @param {object} seed 当前内容种子。
 * @param {object} sourceConfig 当前源站配置。
 * @returns {object} A 协议嵌套原始内容条目。
 */
function createProtocolARawItem(seed, sourceConfig) {
  // 类型: Array<object>。
  // 作用: 生成协议无关分集语义，随后映射为 A 协议 episodeKey 等字段。
  const episodeSeeds = createEpisodeSeeds(seed);

  // 类型: string。
  // 作用: 保存第一条分集 id，给默认线路和播放页地址建立稳定关联。
  const firstEpisodeId = episodeSeeds[0].id;

  return {
    contentKey: seed.id,
    mediaType: seed.type,
    headline: seed.title,
    originalHeadline: `${seed.title} Original`,
    alternateNames: [`${seed.title} 别名`],
    artwork: {
      portrait: `https://images.mock-source.local/${sourceConfig.sourceId}/${seed.id}-poster.jpg`,
      landscape: `https://images.mock-source.local/${sourceConfig.sourceId}/${seed.id}-cover.jpg`
    },
    synopsis: `${seed.title} 的 A 协议短简介。`,
    synopsisFull: `${seed.title} 的 A 协议完整简介，用于详情页验证完整标准字段。`,
    release: {
      year: seed.year,
      region: seed.area,
      language: '普通话',
      date: `${seed.year}-01-16`
    },
    taxonomy: {
      genres: [...seed.genres],
      tags: ['A协议', seed.type === 'movie' ? '电影' : '剧集'],
      displayMarks: [seed.badge]
    },
    metrics: {
      rating: seed.score,
      rank: seed.rank
    },
    media: {
      quality: seed.quality,
      badge: seed.badge,
      duration: seed.type === 'movie' ? '118分钟' : '',
      totalEpisodes: seed.type === 'tv' ? seed.totalEpisodes : null,
      latestEpisode: seed.type === 'tv' ? Math.min(seed.totalEpisodes, 3) : null,
      updateStatus: seed.type === 'tv' ? `更新至${Math.min(seed.totalEpisodes, 3)}集` : '',
      season: seed.type === 'tv' ? '第1季' : '',
      status: seed.type === 'tv' ? '连载中' : '已上映'
    },
    credits: {
      directors: [`${sourceConfig.name} 导演`],
      writers: [`${sourceConfig.name} 编剧`],
      actors: [`${seed.title} 演员甲`, `${seed.title} 演员乙`]
    },
    gallery: [`https://images.mock-source.local/${sourceConfig.sourceId}/${seed.id}-scene.jpg`],
    trailer: `https://media.mock-source.local/${sourceConfig.sourceId}/${seed.id}-trailer.mp4`,
    episodes: episodeSeeds.map(episode => ({
      episodeKey: episode.id,
      sequence: episode.sequence,
      name: episode.title,
      label: episode.label,
      runtime: episode.duration,
      summary: episode.description,
      image: `https://images.mock-source.local/${sourceConfig.sourceId}/${episode.id}.jpg`,
      access: episode.playable ? 'playable' : 'locked'
    })),
    streams: [{
      streamKey: `${seed.id}-line-main`,
      label: 'A 协议主线路',
      format: 'm3u8',
      address: `https://media.mock-source.local/${sourceConfig.sourceId}/${firstEpisodeId}.m3u8`,
      resolution: seed.quality,
      state: 'ready',
      episodeKey: firstEpisodeId
    }],
    defaultStreamKey: `${seed.id}-line-main`,
    playbackHeaders: {
      referer: `https://${sourceConfig.domain}/`,
      userAgent: 'MockProtocolA/1.0'
    },
    playPage: `https://${sourceConfig.domain}/play/${seed.id}`,
    detailPage: `https://${sourceConfig.domain}/detail/${seed.id}`,
    updatedAt: sourceConfig.generatedAt
  };
}

/**
 * 创建 B 协议原始 vod 内容条目。
 * 纯函数: 返回新的 vod 字段对象，并把数组语义压缩为 B 协议竖线文本。
 *
 * @param {object} seed 当前内容种子。
 * @param {object} sourceConfig 当前源站配置。
 * @returns {object} B 协议 vod 原始内容条目。
 */
function createProtocolBRawItem(seed, sourceConfig) {
  // 类型: Array<object>。
  // 作用: 生成协议无关分集语义，随后映射为 B 协议 ep_* 字段。
  const episodeSeeds = createEpisodeSeeds(seed);

  // 类型: string。
  // 作用: 保存第一条分集 id，给 vod 默认线路建立稳定关联。
  const firstEpisodeId = episodeSeeds[0].id;

  return {
    vod_id: seed.id,
    vod_kind: seed.type,
    vod_name: seed.title,
    vod_en: `${seed.title} Original`,
    vod_alias: `${seed.title} 别名|${seed.title} 又名`,
    vod_pic: `https://images.mock-source.local/${sourceConfig.sourceId}/${seed.id}-poster.jpg`,
    vod_cover: `https://images.mock-source.local/${sourceConfig.sourceId}/${seed.id}-cover.jpg`,
    vod_blurb: `${seed.title} 的 B 协议短简介。`,
    vod_content: `${seed.title} 的 B 协议完整简介，用于详情页验证完整标准字段。`,
    vod_year: seed.year,
    vod_area: seed.area,
    vod_lang: '原声',
    type_name: seed.genres.join('|'),
    vod_keywords: `B协议|${seed.type === 'movie' ? '电影' : '剧集'}`,
    vod_marks: `${seed.badge}|精选`,
    vod_score: String(seed.score),
    vod_quality: seed.quality,
    vod_rank: String(seed.rank),
    vod_badge: seed.badge,
    vod_duration: seed.type === 'movie' ? '112分钟' : '',
    vod_total: seed.type === 'tv' ? String(seed.totalEpisodes) : '',
    vod_serial: seed.type === 'tv' ? String(Math.min(seed.totalEpisodes, 3)) : '',
    vod_remarks: seed.type === 'tv' ? `更新至${Math.min(seed.totalEpisodes, 3)}集` : '',
    vod_season: seed.type === 'tv' ? '第一季' : '',
    vod_pubdate: `${seed.year}-02-16`,
    vod_time: sourceConfig.generatedAt,
    vod_status: seed.type === 'tv' ? '连载中' : '已上映',
    vod_director: `${sourceConfig.name} 导演`,
    vod_writer: `${sourceConfig.name} 编剧`,
    vod_actor: `${seed.title} 演员甲|${seed.title} 演员乙`,
    vod_screens: `https://images.mock-source.local/${sourceConfig.sourceId}/${seed.id}-scene-a.jpg|https://images.mock-source.local/${sourceConfig.sourceId}/${seed.id}-scene-b.jpg`,
    vod_trailer: `https://media.mock-source.local/${sourceConfig.sourceId}/${seed.id}-trailer.mp4`,
    vod_episodes: episodeSeeds.map(episode => ({
      ep_id: episode.id,
      ep_no: episode.sequence,
      ep_name: episode.title,
      ep_label: episode.label,
      ep_runtime: episode.duration,
      ep_blurb: episode.description,
      ep_pic: `https://images.mock-source.local/${sourceConfig.sourceId}/${episode.id}.jpg`,
      ep_state: episode.playable ? 1 : 0
    })),
    vod_play: [{
      line_id: `${seed.id}-line-main`,
      line_name: 'B 协议主线路',
      line_type: 'm3u8',
      line_url: `https://media.mock-source.local/${sourceConfig.sourceId}/${firstEpisodeId}.m3u8`,
      line_quality: seed.quality,
      line_state: 1,
      line_episode: firstEpisodeId
    }],
    vod_default_line: `${seed.id}-line-main`,
    vod_headers: {
      referer: `https://${sourceConfig.domain}/`,
      user_agent: 'MockProtocolB/1.0'
    },
    vod_play_page: `https://${sourceConfig.domain}/play/${seed.id}`,
    vod_detail_url: `https://${sourceConfig.domain}/detail/${seed.id}`
  };
}

/**
 * 创建 A 协议目录原始响应。
 * 纯函数: 返回新的 site/entries 外壳和原始条目数组。
 *
 * @param {object} sourceConfig 当前 A 协议源配置。
 * @returns {object} A 协议目录原始 body。
 */
function createProtocolACatalogBody(sourceConfig) {
  return {
    site: {
      id: sourceConfig.sourceId,
      name: sourceConfig.name,
      domain: sourceConfig.domain
    },
    generatedAt: sourceConfig.generatedAt,
    entries: sourceConfig.items.map(seed => createProtocolARawItem(seed, sourceConfig))
  };
}

/**
 * 创建 A 协议健康原始响应。
 * 纯函数: 返回新的 service/state 外壳。
 *
 * @param {object} sourceConfig 当前 A 协议源配置。
 * @returns {object} A 协议健康原始 body。
 */
function createProtocolAHealthBody(sourceConfig) {
  return {
    service: {
      source: sourceConfig.sourceId,
      state: 'up',
      checkedAt: sourceConfig.checkedAt,
      reason: ''
    }
  };
}

/**
 * 创建 B 协议目录原始响应。
 * 纯函数: 返回新的 station/data.videos 外壳和 vod 条目数组。
 *
 * @param {object} sourceConfig 当前 B 协议源配置。
 * @returns {object} B 协议目录原始 body。
 */
function createProtocolBCatalogBody(sourceConfig) {
  return {
    code: 0,
    server_time: sourceConfig.generatedAt,
    station: {
      key: sourceConfig.sourceId,
      label: sourceConfig.name,
      host: sourceConfig.domain
    },
    data: {
      videos: sourceConfig.items.map(seed => createProtocolBRawItem(seed, sourceConfig))
    }
  };
}

/**
 * 创建 B 协议健康原始响应。
 * 纯函数: 返回新的 node/online 外壳。
 *
 * @param {object} sourceConfig 当前 B 协议源配置。
 * @returns {object} B 协议健康原始 body。
 */
function createProtocolBHealthBody(sourceConfig) {
  return {
    code: 0,
    timestamp: sourceConfig.checkedAt,
    node: {
      key: sourceConfig.sourceId,
      online: 1,
      message: ''
    }
  };
}

// 类型: object。
// 作用: 只按 protocolKey 选择原始 body 构建规则，sourceId 不参与协议分支判断。
const PROTOCOL_ROUTE_BUILDERS = Object.freeze({
  // 类型: object。
  // 作用: 为 mock-protocol-a 配置 site/entries 和 service/state 两类原始外壳。
  'mock-protocol-a': Object.freeze({
    catalog: createProtocolACatalogBody,
    health: createProtocolAHealthBody
  }),

  // 类型: object。
  // 作用: 为 mock-protocol-b 配置 station/data.videos 和 node/online 两类原始外壳。
  'mock-protocol-b': Object.freeze({
    catalog: createProtocolBCatalogBody,
    health: createProtocolBHealthBody
  })
});

/**
 * 创建一条 MockNetworkAdapter 精确路由。
 * 纯函数: 返回新的网络外壳，不修改或标准化原始 body。
 *
 * @param {string} sourceId 当前精确路由身份。
 * @param {string} routeName catalog 或 health 路径。
 * @param {object} body 当前协议原始响应体。
 * @returns {object} 可进入 Adapter 索引的响应 fixture。
 */
function createResponseFixture(sourceId, routeName, body) {
  // 类型: string。
  // 作用: 根据已审 sourceId 和固定路由名创建唯一 HTTPS 地址。
  const url = `https://mock-source.local/${sourceId}/${routeName}`;

  return {
    sourceId,
    method: 'GET',
    url,
    status: 200,
    statusText: 'OK',
    headers: { ...JSON_RESPONSE_HEADERS },
    body,
    responseUrl: url
  };
}

/**
 * 创建单个源的目录和健康路由。
 * 纯函数: 只按 protocolKey 选择受审构建器，不根据 sourceId 改变字段协议。
 * 失败路径: 未登记 protocolKey 时抛出 TypeError，避免生成未知结构。
 *
 * @param {object} sourceConfig 当前源级 fixture 配置。
 * @returns {Array<object>} 当前源 catalog 和 health 两条路由。
 * @throws {TypeError} 当 protocolKey 没有受审构建器时抛出。
 */
function createSourceRoutes(sourceConfig) {
  // 类型: object|undefined。
  // 作用: 从冻结协议映射读取目录和健康 body 构建器，选择依据不包含 sourceId。
  const routeBuilders = PROTOCOL_ROUTE_BUILDERS[sourceConfig.protocolKey];

  // 条件分支: 当前 protocolKey 没有登记受审构建器时进入。
  // 执行内容: 阻止未知协议产生可被 Adapter 命中的路由。
  if (!routeBuilders) {
    throw new TypeError(`未登记模拟响应协议: ${sourceConfig.protocolKey}`);
  }

  return [
    createResponseFixture(
      sourceConfig.sourceId,
      'catalog',
      routeBuilders.catalog(sourceConfig)
    ),
    createResponseFixture(
      sourceConfig.sourceId,
      'health',
      routeBuilders.health(sourceConfig)
    )
  ];
}

// 类型: Array<object>。
// 作用: 汇总四个真实 sourceId 各自 catalog/health 共八条精确路由，并深冻结全部原始 body。
export const mockNetworkResponseFixtures = freezeJsonValue([
  // 循环类型: Array.prototype.flatMap。
  // 初始值: system-source-1 A 协议源配置。
  // 终止条件: A/B 四个源都生成目录和健康路由。
  // 循环作用: 统一生成八条路由，不保留旧 content/status 兼容地址。
  ...[...PROTOCOL_A_SOURCE_FIXTURES, ...PROTOCOL_B_SOURCE_FIXTURES]
    .flatMap(sourceConfig => createSourceRoutes(sourceConfig))
]);
