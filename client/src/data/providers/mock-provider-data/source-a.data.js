/*
  source-a.data.js 模块说明

  - 文件职责:
      定义 mock-protocol-a 原始目录和健康响应的受审解码规则。
      向可信模拟 Provider 工厂提供 system-source-1、system-source-3 两个独立数据集描述。
      解码器只把注入的原始响应转换为标准领域对象，不读取 fixture、Provider、Repository、store 或页面状态。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PROTOCOL_A_KEY: string，A 协议数据集统一协议标识。
      PROTOCOL_A_HEALTH_STATUS: object，原始健康状态到标准健康状态的冻结映射。
      PROTOCOL_A_DATA_SET_CONFIGS: Array<object>，system-source-1 与 system-source-3 的身份和精确端点配置。
      mockProtocolADataSets: object，按真实 sourceId 暴露的冻结 A 协议数据集集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertPlainRecord(value, fieldName)
          - params:
              -- value: *，待验证的协议对象。
              -- fieldName: string，错误定位字段名。
          - return:
              void，对象有效时结束。
          - description:
              拒绝数组、null 和复杂实例进入协议解码链。
      assertSourceIdentity(actualSourceId, expectedSourceId, fieldName)
          - params:
              -- actualSourceId: *，原始响应声明的数据源 id。
              -- expectedSourceId: *，调用方要求解码的数据源 id。
              -- fieldName: string，错误定位字段名。
          - return:
              string，已验证的数据源 id。
          - description:
              保证请求、数据集和原始响应使用同一真实身份。
      toStringArray(value)
          - params:
              -- value: *，原始字符串数组候选。
          - return:
              Array<string>，隔离且去除空白项的字符串数组。
          - description:
              统一处理别名、标签、主创和剧照字段。
      createProtocolAEpisodes(rawEpisodes)
          - params:
              -- rawEpisodes: *，A 协议分集数组候选。
          - return:
              Array<object>，完整标准分集对象数组。
          - description:
              把嵌套 A 协议分集字段转换为页面可消费结构。
      createProtocolAPlayback(rawItem)
          - params:
              -- rawItem: object，当前 A 协议内容条目。
          - return:
              object，完整标准播放信息。
          - description:
              把 A 协议线路数组转换为播放页字段并保持引用隔离。
      createProtocolAContentItem(rawItem, context)
          - params:
              -- rawItem: object，单条 A 协议内容。
              -- context: object，当前源身份、站点信息和抓取时间。
          - return:
              object，完整标准 ContentItem。
          - description:
              清洗全部原始字段且不保留源站对象引用。
      decodeProtocolACatalog(rawBody, sourceId)
          - params:
              -- rawBody: object，MockNetworkAdapter 返回的 A 协议目录 body。
              -- sourceId: string，当前数据集真实 id。
          - return:
              object，精确包含 sourceId 与完整 ContentItem items 的隔离目录。
          - description:
              使用一套 A 协议规则解码 system-source-1 和 system-source-3，不按 sourceId 分支。
      decodeProtocolAHealth(rawBody, sourceId)
          - params:
              -- rawBody: object，MockNetworkAdapter 返回的 A 协议健康 body。
              -- sourceId: string，当前数据集真实 id。
          - return:
              object，精确标准健康结果。
          - description:
              校验响应身份并把 A 协议状态映射为标准健康状态。
      createProtocolADataSet(config)
          - params:
              -- config: object，单个数据源身份与端点配置。
          - return:
              object，精确六字段冻结数据集。
          - description:
              复用同一协议解码器创建独立数据集。

  - 模块级类:
      无

  - 对外导出:
      mockProtocolADataSets: object，包含 system-source-1、system-source-3 的冻结 A 协议数据集。
*/

// 类型: string。
// 作用: 标识当前两个数据集共同使用 A 协议字段解码规则，不表达具体 sourceId。
const PROTOCOL_A_KEY = 'mock-protocol-a';

// 类型: object。
// 作用: 把 A 协议服务状态转换为标准健康状态，未知状态由解码器明确拒绝。
const PROTOCOL_A_HEALTH_STATUS = Object.freeze({
  // 类型: string。
  // 作用: 原始服务 up 时返回标准 normal，允许 SourceManager 记录当前源可用。
  up: 'normal',

  // 类型: string。
  // 作用: 原始服务 down 时返回标准 unavailable，调用方同时消费不可用原因。
  down: 'unavailable'
});

// 类型: Array<object>。
// 作用: 为两个真实 sourceId 声明各自 catalog 和 health 精确地址，不让 Provider 拼接或猜测端点。
const PROTOCOL_A_DATA_SET_CONFIGS = Object.freeze([
  Object.freeze({
    sourceId: 'system-source-1',
    catalogUrl: 'https://mock-source.local/system-source-1/catalog',
    healthUrl: 'https://mock-source.local/system-source-1/health'
  }),
  Object.freeze({
    sourceId: 'system-source-3',
    catalogUrl: 'https://mock-source.local/system-source-3/catalog',
    healthUrl: 'https://mock-source.local/system-source-3/health'
  })
]);

/**
 * 校验 A 协议对象是普通记录。
 * 纯函数: 只读取候选值的类型和原型，不修改输入。
 * 失败路径: null、数组或复杂实例会抛出 TypeError。
 *
 * @param {*} value 待验证协议对象。
 * @param {string} fieldName 错误定位字段名。
 * @returns {void} 对象有效时结束。
 * @throws {TypeError} 当候选值不是普通对象时抛出。
 */
function assertPlainRecord(value, fieldName) {
  // 类型: object|null。
  // 作用: 读取候选对象原型，只有 Object.prototype 或 null 原型属于可审原始记录。
  const prototype = value && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;

  // 条件分支: 候选为空、数组或原型不属于普通记录时进入。
  // 执行内容: 抛出稳定类型错误，阻止复杂对象越过解码边界。
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (prototype !== Object.prototype && prototype !== null)) {
    throw new TypeError(`${fieldName} 必须是普通对象`);
  }
}

/**
 * 校验响应身份与调用方 sourceId 一致。
 * 纯函数: 只比较两个字符串，不修改输入。
 * 失败路径: 空身份或身份不一致时抛出 TypeError。
 *
 * @param {*} actualSourceId 原始响应声明的数据源 id。
 * @param {*} expectedSourceId 调用方要求解码的数据源 id。
 * @param {string} fieldName 错误定位字段名。
 * @returns {string} 已验证的数据源 id。
 * @throws {TypeError} 当身份为空或不一致时抛出。
 */
function assertSourceIdentity(actualSourceId, expectedSourceId, fieldName) {
  // 条件分支: 调用方身份不是非空字符串时进入。
  // 执行内容: 拒绝在没有明确数据集身份时解码响应。
  if (typeof expectedSourceId !== 'string' || expectedSourceId.trim() === '') {
    throw new TypeError('sourceId 必须是非空字符串');
  }

  // 条件分支: 响应身份不是字符串或与调用方身份不一致时进入。
  // 执行内容: 拒绝跨源响应被当前 Provider 采用。
  if (actualSourceId !== expectedSourceId) {
    throw new TypeError(`${fieldName} 与 sourceId 不一致`);
  }

  return expectedSourceId;
}

/**
 * 创建隔离字符串数组。
 * 纯函数: 返回新数组，不修改原数组。
 * 兜底策略: 非数组输入返回空数组，非字符串和空白条目被丢弃。
 *
 * @param {*} value 原始字符串数组候选。
 * @returns {Array<string>} 清理后的隔离字符串数组。
 */
function toStringArray(value) {
  // 条件分支: 原始值不是数组时进入。
  // 执行内容: 返回稳定空数组，让完整 ContentItem 保持数组字段类型。
  if (!Array.isArray(value)) {
    return [];
  }

  // 循环类型: Array.prototype.filter 与 map。
  // 初始值: 原始数组第一项。
  // 终止条件: 全部条目完成字符串和空白检查。
  // 循环作用: 删除非法条目并创建不共享原数组的字符串集合。
  return value
    .filter(item => typeof item === 'string' && item.trim() !== '')
    .map(item => item.trim());
}

/**
 * 转换 A 协议分集数组。
 * 纯函数: 返回全新分集对象，不修改或保留原始条目引用。
 * 失败路径: 分集容器或条目结构非法时抛出 TypeError。
 *
 * @param {*} rawEpisodes A 协议分集数组候选。
 * @returns {Array<object>} 完整标准分集对象数组。
 * @throws {TypeError} 当分集结构不符合受审协议时抛出。
 */
function createProtocolAEpisodes(rawEpisodes) {
  // 条件分支: 分集值不是数组时进入。
  // 执行内容: 拒绝产生字段类型不稳定的 ContentItem。
  if (!Array.isArray(rawEpisodes)) {
    throw new TypeError('protocolA.item.episodes 必须是数组');
  }

  // 循环类型: Array.prototype.map。
  // 初始值: 第一条 A 协议分集。
  // 终止条件: 全部分集转换完成。
  // 循环作用: 只采用标准分集字段并创建隔离结果。
  return rawEpisodes.map((rawEpisode, index) => {
    assertPlainRecord(rawEpisode, `protocolA.item.episodes[${index}]`);

    return {
      id: String(rawEpisode.episodeKey || ''),
      episodeNumber: Number.isSafeInteger(rawEpisode.sequence) ? rawEpisode.sequence : null,
      title: typeof rawEpisode.name === 'string' ? rawEpisode.name : '',
      label: typeof rawEpisode.label === 'string' ? rawEpisode.label : '',
      duration: typeof rawEpisode.runtime === 'string' ? rawEpisode.runtime : '',
      description: typeof rawEpisode.summary === 'string' ? rawEpisode.summary : '',
      cover: typeof rawEpisode.image === 'string' ? rawEpisode.image : '',
      playable: rawEpisode.access === 'playable'
    };
  });
}

/**
 * 转换 A 协议播放信息。
 * 纯函数: 返回全新播放对象和线路数组，不保留原始引用。
 * 失败路径: 线路容器或线路条目非法时抛出 TypeError。
 *
 * @param {object} rawItem 当前 A 协议内容条目。
 * @returns {object} 完整标准播放信息。
 * @throws {TypeError} 当播放线路不符合受审协议时抛出。
 */
function createProtocolAPlayback(rawItem) {
  // 类型: Array<*>。
  // 作用: 读取 A 协议线路数组；缺失时使用空数组保持播放字段完整。
  const rawStreams = Array.isArray(rawItem.streams) ? rawItem.streams : [];

  // 循环类型: Array.prototype.map。
  // 初始值: 第一条 A 协议播放线路。
  // 终止条件: 全部线路转换完成。
  // 循环作用: 裁剪原始字段并生成标准播放线路。
  const sources = rawStreams.map((rawStream, index) => {
    assertPlainRecord(rawStream, `protocolA.item.streams[${index}]`);

    return {
      id: String(rawStream.streamKey || ''),
      name: typeof rawStream.label === 'string' ? rawStream.label : '',
      type: rawStream.format === 'm3u8' || rawStream.format === 'hls'
        ? 'hls'
        : (rawStream.format === 'mp4' ? 'mp4' : 'unknown'),
      url: typeof rawStream.address === 'string' ? rawStream.address : '',
      quality: typeof rawStream.resolution === 'string' ? rawStream.resolution : '',
      // 边界: mock 与真实 Provider 都只声明浏览器直连媒体，不提供后端媒体代理分支。
      deliveryMode: 'direct',
      available: rawStream.state === 'ready',
      // 作用: 不可用线路必须携带可展示原因；可用线路保持空字符串。
      unavailableReason: rawStream.state === 'ready' ? '' : '模拟线路当前不可用',
      episodeId: typeof rawStream.episodeKey === 'string' ? rawStream.episodeKey : ''
    };
  });

  // 类型: string。
  // 作用: 优先使用原始默认线路；缺失时选择第一条标准线路，完全无线路时为空字符串。
  const defaultSourceId = typeof rawItem.defaultStreamKey === 'string'
    ? rawItem.defaultStreamKey
    : (sources[0]?.id || '');

  return {
    defaultSourceId,
    sources
  };
}

/**
 * 把单条 A 协议内容转换为完整标准 ContentItem。
 * 纯函数: 只读取原始条目和上下文，返回全新嵌套对象。
 * 失败路径: 原始条目或关键 id/type/title 字段非法时抛出 TypeError。
 *
 * @param {object} rawItem 单条 A 协议内容。
 * @param {object} context 当前源身份、站点信息和抓取时间。
 * @param {string} context.sourceId 当前真实数据源 id。
 * @param {string} context.sourceName 当前数据源显示名称。
 * @param {string} context.sourceDomain 当前数据源域名。
 * @param {string} context.fetchedAt 当前原始目录抓取时间。
 * @returns {object} 完整标准 ContentItem。
 * @throws {TypeError} 当条目不能形成标准内容身份时抛出。
 */
function createProtocolAContentItem(rawItem, context) {
  assertPlainRecord(rawItem, 'protocolA.item');

  // 条件分支: 内容 id、类型或标题不是非空字符串时进入。
  // 执行内容: 拒绝生成无法跨页面定位和展示的 ContentItem。
  if (typeof rawItem.contentKey !== 'string' || rawItem.contentKey.trim() === ''
    || !['movie', 'tv'].includes(rawItem.mediaType)
    || typeof rawItem.headline !== 'string' || rawItem.headline.trim() === '') {
    throw new TypeError('protocolA.item 缺少有效 contentKey、mediaType 或 headline');
  }

  // 类型: Array<object>。
  // 作用: 先转换分集，供 ContentItem.episodes 与播放线路共同使用。
  const episodes = createProtocolAEpisodes(rawItem.episodes);

  return {
    id: rawItem.contentKey,
    sourceId: context.sourceId,
    sourceName: context.sourceName,
    type: rawItem.mediaType,
    title: rawItem.headline,
    originalTitle: typeof rawItem.originalHeadline === 'string' ? rawItem.originalHeadline : '',
    aliases: toStringArray(rawItem.alternateNames),
    poster: typeof rawItem.artwork?.portrait === 'string' ? rawItem.artwork.portrait : '',
    cover: typeof rawItem.artwork?.landscape === 'string' ? rawItem.artwork.landscape : '',
    description: typeof rawItem.synopsis === 'string' ? rawItem.synopsis : '',
    year: typeof rawItem.release?.year === 'string' ? rawItem.release.year : '',
    area: typeof rawItem.release?.region === 'string' ? rawItem.release.region : '',
    language: typeof rawItem.release?.language === 'string' ? rawItem.release.language : '',
    genres: toStringArray(rawItem.taxonomy?.genres),
    tags: toStringArray(rawItem.taxonomy?.tags),
    displayTags: toStringArray(rawItem.taxonomy?.displayMarks),
    score: Number.isFinite(rawItem.metrics?.rating) ? rawItem.metrics.rating : null,
    quality: typeof rawItem.media?.quality === 'string' ? rawItem.media.quality : '',
    rank: Number.isSafeInteger(rawItem.metrics?.rank) ? rawItem.metrics.rank : null,
    badge: typeof rawItem.media?.badge === 'string' ? rawItem.media.badge : '',
    detail: {
      fullDescription: typeof rawItem.synopsisFull === 'string' ? rawItem.synopsisFull : '',
      directors: toStringArray(rawItem.credits?.directors),
      writers: toStringArray(rawItem.credits?.writers),
      actors: toStringArray(rawItem.credits?.actors),
      releaseDate: typeof rawItem.release?.date === 'string' ? rawItem.release.date : '',
      updateTime: typeof rawItem.updatedAt === 'string' ? rawItem.updatedAt : '',
      status: typeof rawItem.media?.status === 'string' ? rawItem.media.status : '',
      screenshots: toStringArray(rawItem.gallery),
      trailerUrl: typeof rawItem.trailer === 'string' ? rawItem.trailer : ''
    },
    movie: {
      duration: rawItem.mediaType === 'movie' && typeof rawItem.media?.duration === 'string'
        ? rawItem.media.duration
        : ''
    },
    tv: {
      totalEpisodes: rawItem.mediaType === 'tv' && Number.isSafeInteger(rawItem.media?.totalEpisodes)
        ? rawItem.media.totalEpisodes
        : null,
      latestEpisode: rawItem.mediaType === 'tv' && Number.isSafeInteger(rawItem.media?.latestEpisode)
        ? rawItem.media.latestEpisode
        : null,
      updateStatus: rawItem.mediaType === 'tv' && typeof rawItem.media?.updateStatus === 'string'
        ? rawItem.media.updateStatus
        : '',
      season: rawItem.mediaType === 'tv' && typeof rawItem.media?.season === 'string'
        ? rawItem.media.season
        : ''
    },
    episodes,
    playback: createProtocolAPlayback(rawItem),
    source: {
      name: context.sourceName,
      domain: context.sourceDomain,
      rawId: rawItem.contentKey,
      sourceDetailUrl: typeof rawItem.detailPage === 'string' ? rawItem.detailPage : '',
      rawData: null,
      fetchedAt: context.fetchedAt
    }
  };
}

/**
 * 解码 A 协议目录响应。
 * 纯函数: 每次调用都创建新的根对象、items 数组和全部嵌套 ContentItem。
 * 成功路径: 返回精确 `{ sourceId, items }`。
 * 失败路径: 身份、站点、时间或条目容器不符合协议时抛出 TypeError。
 *
 * @param {object} rawBody MockNetworkAdapter 返回的 A 协议目录 body。
 * @param {string} sourceId 当前数据集真实 id。
 * @returns {{sourceId: string, items: Array<object>}} 隔离标准目录。
 * @throws {TypeError} 当原始目录不符合受审 A 协议时抛出。
 */
function decodeProtocolACatalog(rawBody, sourceId) {
  assertPlainRecord(rawBody, 'protocolA.catalog');
  assertPlainRecord(rawBody.site, 'protocolA.catalog.site');
  assertSourceIdentity(rawBody.site.id, sourceId, 'protocolA.catalog.site.id');

  // 条件分支: 目录条目、站点名称、域名或生成时间类型无效时进入。
  // 执行内容: 拒绝用默认值掩盖损坏的协议外壳。
  if (!Array.isArray(rawBody.entries)
    || typeof rawBody.site.name !== 'string'
    || typeof rawBody.site.domain !== 'string'
    || typeof rawBody.generatedAt !== 'string') {
    throw new TypeError('protocolA.catalog 外壳不符合协议');
  }

  // 类型: object。
  // 作用: 保存当前解码共享身份和站点字段，条目转换只读该隔离上下文。
  const context = {
    sourceId,
    sourceName: rawBody.site.name,
    sourceDomain: rawBody.site.domain,
    fetchedAt: rawBody.generatedAt
  };

  // 循环类型: Array.prototype.map。
  // 初始值: 第一条 A 协议内容。
  // 终止条件: 全部原始内容转换为完整 ContentItem。
  // 循环作用: 不保留 entries 或条目引用，返回隔离标准目录。
  const items = rawBody.entries.map(rawItem => createProtocolAContentItem(rawItem, context));

  return { sourceId, items };
}

/**
 * 解码 A 协议健康响应。
 * 纯函数: 只读取当前响应并返回精确三字段新对象。
 * 成功路径: up/down 分别映射为 normal/unavailable。
 * 失败路径: 身份、状态、时间或原因字段不符合协议时抛出 TypeError。
 *
 * @param {object} rawBody MockNetworkAdapter 返回的 A 协议健康 body。
 * @param {string} sourceId 当前数据集真实 id。
 * @returns {{healthStatus: string, checkedAt: string, unavailableReason: string}} 标准健康结果。
 * @throws {TypeError} 当原始健康响应不符合受审 A 协议时抛出。
 */
function decodeProtocolAHealth(rawBody, sourceId) {
  assertPlainRecord(rawBody, 'protocolA.health');
  assertPlainRecord(rawBody.service, 'protocolA.health.service');
  assertSourceIdentity(rawBody.service.source, sourceId, 'protocolA.health.service.source');

  // 类型: string|undefined。
  // 作用: 从冻结映射读取标准健康状态，避免散落同义状态字符串。
  const healthStatus = PROTOCOL_A_HEALTH_STATUS[rawBody.service.state];

  // 条件分支: 状态未知、检查时间或原因不是字符串时进入。
  // 执行内容: 拒绝形成字段不完整或无法追踪时间的健康结果。
  if (!healthStatus
    || typeof rawBody.service.checkedAt !== 'string'
    || typeof rawBody.service.reason !== 'string') {
    throw new TypeError('protocolA.health 外壳不符合协议');
  }

  return {
    healthStatus,
    checkedAt: rawBody.service.checkedAt,
    unavailableReason: healthStatus === 'normal' ? '' : rawBody.service.reason
  };
}

/**
 * 创建单个 A 协议数据集。
 * 纯函数: 返回精确六字段冻结对象，不修改配置。
 *
 * @param {object} config 数据源身份与端点配置。
 * @param {string} config.sourceId 真实数据源 id。
 * @param {string} config.catalogUrl 独立目录精确地址。
 * @param {string} config.healthUrl 独立健康精确地址。
 * @returns {object} 精确六字段冻结数据集。
 */
function createProtocolADataSet(config) {
  return Object.freeze({
    sourceId: config.sourceId,
    protocolKey: PROTOCOL_A_KEY,
    catalogUrl: config.catalogUrl,
    healthUrl: config.healthUrl,
    decodeCatalog: decodeProtocolACatalog,
    decodeHealth: decodeProtocolAHealth
  });
}

// 类型: object。
// 作用: 按真实 sourceId 提供 system-source-1 与 system-source-3 数据集；两个条目复用协议解码器但拥有独立端点。
export const mockProtocolADataSets = Object.freeze(Object.fromEntries(
  // 循环类型: Array.prototype.map。
  // 初始值: system-source-1 数据集配置。
  // 终止条件: 两个 A 协议配置全部转换完成。
  // 循环作用: 以 sourceId 建立冻结工厂查找表，不在解码器中添加身份分支。
  PROTOCOL_A_DATA_SET_CONFIGS.map(config => [config.sourceId, createProtocolADataSet(config)])
));
