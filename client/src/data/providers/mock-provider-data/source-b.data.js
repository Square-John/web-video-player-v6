/*
  source-b.data.js 模块说明

  - 文件职责:
      定义 mock-protocol-b 原始目录和健康响应的受审解码规则。
      向可信模拟 Provider 工厂提供 system-source-2、system-source-4 两个独立数据集描述。
      把 B 协议 vod 字段、分隔字符串和数字文本清洗为标准对象，不读取 fixture 或应用状态。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PROTOCOL_B_KEY: string，B 协议数据集统一协议标识。
      PROTOCOL_B_DATA_SET_CONFIGS: Array<object>，system-source-2 与 system-source-4 的身份和精确端点配置。
      mockProtocolBDataSets: object，按真实 sourceId 暴露的冻结 B 协议数据集集合。

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
              拒绝数组、null 和复杂实例进入 B 协议解码链。
      assertSourceIdentity(actualSourceId, expectedSourceId, fieldName)
          - params:
              -- actualSourceId: *，原始响应声明的数据源 id。
              -- expectedSourceId: *，调用方要求解码的数据源 id。
              -- fieldName: string，错误定位字段名。
          - return:
              string，已验证的数据源 id。
          - description:
              保证数据集、请求和 B 协议响应身份一致。
      splitTextList(value)
          - params:
              -- value: *，竖线分隔字符串候选。
          - return:
              Array<string>，隔离且去除空白项的字符串数组。
          - description:
              清洗 B 协议别名、类型、标签、主创和剧照字段。
      parseNullableNumber(value)
          - params:
              -- value: *，数字或数字文本候选。
          - return:
              number|null，有限数字或 null。
          - description:
              把 B 协议评分和排名文本转换为标准可空数字。
      createProtocolBEpisodes(rawEpisodes)
          - params:
              -- rawEpisodes: *，B 协议分集数组候选。
          - return:
              Array<object>，完整标准分集对象数组。
          - description:
              转换 vod 分集字段并保持引用隔离。
      createProtocolBPlayback(rawItem)
          - params:
              -- rawItem: object，当前 B 协议内容条目。
          - return:
              object，完整标准播放信息。
          - description:
              把 vod_play 线路转换为播放页字段。
      createProtocolBContentItem(rawItem, context)
          - params:
              -- rawItem: object，单条 B 协议内容。
              -- context: object，当前源身份、站点信息和抓取时间。
          - return:
              object，完整标准 ContentItem。
          - description:
              清洗全部 vod 字段且不保留源站对象引用。
      decodeProtocolBCatalog(rawBody, sourceId)
          - params:
              -- rawBody: object，MockNetworkAdapter 返回的 B 协议目录 body。
              -- sourceId: string，当前数据集真实 id。
          - return:
              object，精确包含 sourceId 与完整 ContentItem items 的隔离目录。
          - description:
              使用同一 B 协议规则解码 system-source-2 和 system-source-4，不按 sourceId 分支。
      decodeProtocolBHealth(rawBody, sourceId)
          - params:
              -- rawBody: object，MockNetworkAdapter 返回的 B 协议健康 body。
              -- sourceId: string，当前数据集真实 id。
          - return:
              object，精确标准健康结果。
          - description:
              校验节点身份并把 online 标记映射为标准健康状态。
      createProtocolBDataSet(config)
          - params:
              -- config: object，单个数据源身份与端点配置。
          - return:
              object，精确六字段冻结数据集。
          - description:
              复用同一 B 协议解码器创建独立数据集。

  - 模块级类:
      无

  - 对外导出:
      mockProtocolBDataSets: object，包含 system-source-2、system-source-4 的冻结 B 协议数据集。
*/

// 类型: string。
// 作用: 标识当前两个数据集共同使用 B 协议字段解码规则，不表达具体 sourceId。
const PROTOCOL_B_KEY = 'mock-protocol-b';

// 类型: Array<object>。
// 作用: 为两个真实 sourceId 声明各自 catalog 和 health 精确地址，不让 Provider 猜测端点。
const PROTOCOL_B_DATA_SET_CONFIGS = Object.freeze([
  Object.freeze({
    sourceId: 'system-source-2',
    catalogUrl: 'https://mock-source.local/system-source-2/catalog',
    healthUrl: 'https://mock-source.local/system-source-2/health'
  }),
  Object.freeze({
    sourceId: 'system-source-4',
    catalogUrl: 'https://mock-source.local/system-source-4/catalog',
    healthUrl: 'https://mock-source.local/system-source-4/health'
  })
]);

/**
 * 校验 B 协议对象是普通记录。
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

  // 条件分支: 响应身份与调用方身份不一致时进入。
  // 执行内容: 拒绝跨源响应被当前 Provider 采用。
  if (actualSourceId !== expectedSourceId) {
    throw new TypeError(`${fieldName} 与 sourceId 不一致`);
  }

  return expectedSourceId;
}

/**
 * 拆分 B 协议竖线文本列表。
 * 纯函数: 返回新数组，不修改原始字符串。
 * 兜底策略: 非字符串或空字符串返回空数组。
 *
 * @param {*} value 竖线分隔字符串候选。
 * @returns {Array<string>} 清理后的隔离字符串数组。
 */
function splitTextList(value) {
  // 条件分支: 原始值不是字符串或只有空白时进入。
  // 执行内容: 返回稳定空数组，让完整 ContentItem 保持数组字段类型。
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  // 循环类型: String.split、map 与 filter。
  // 初始值: 第一个竖线分隔片段。
  // 终止条件: 全部片段完成首尾空白和空值处理。
  // 循环作用: 把 B 协议压缩文本转换为不共享引用的标准数组。
  return value.split('|').map(item => item.trim()).filter(Boolean);
}

/**
 * 把数字候选转换为标准可空数字。
 * 纯函数: 不修改输入。
 * 兜底策略: 空字符串、null 和非有限数字返回 null。
 *
 * @param {*} value 数字或数字文本候选。
 * @returns {number|null} 有限数字或 null。
 */
function parseNullableNumber(value) {
  // 条件分支: 候选为空字符串、null 或 undefined 时进入。
  // 执行内容: 返回 null，避免 Number('') 产生错误的零值。
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  // 类型: number。
  // 作用: 把 B 协议数字文本转换为 JavaScript 数字供标准字段使用。
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

/**
 * 转换 B 协议分集数组。
 * 纯函数: 返回全新分集对象，不修改或保留原始条目引用。
 * 失败路径: 分集容器或条目结构非法时抛出 TypeError。
 *
 * @param {*} rawEpisodes B 协议分集数组候选。
 * @returns {Array<object>} 完整标准分集对象数组。
 * @throws {TypeError} 当分集结构不符合受审协议时抛出。
 */
function createProtocolBEpisodes(rawEpisodes) {
  // 条件分支: 分集值不是数组时进入。
  // 执行内容: 拒绝产生字段类型不稳定的 ContentItem。
  if (!Array.isArray(rawEpisodes)) {
    throw new TypeError('protocolB.vod_episodes 必须是数组');
  }

  // 循环类型: Array.prototype.map。
  // 初始值: 第一条 B 协议分集。
  // 终止条件: 全部分集转换完成。
  // 循环作用: 只采用标准分集字段并创建隔离结果。
  return rawEpisodes.map((rawEpisode, index) => {
    assertPlainRecord(rawEpisode, `protocolB.vod_episodes[${index}]`);

    return {
      id: String(rawEpisode.ep_id || ''),
      episodeNumber: Number.isSafeInteger(rawEpisode.ep_no) ? rawEpisode.ep_no : null,
      title: typeof rawEpisode.ep_name === 'string' ? rawEpisode.ep_name : '',
      label: typeof rawEpisode.ep_label === 'string' ? rawEpisode.ep_label : '',
      duration: typeof rawEpisode.ep_runtime === 'string' ? rawEpisode.ep_runtime : '',
      description: typeof rawEpisode.ep_blurb === 'string' ? rawEpisode.ep_blurb : '',
      cover: typeof rawEpisode.ep_pic === 'string' ? rawEpisode.ep_pic : '',
      playable: rawEpisode.ep_state === 1
    };
  });
}

/**
 * 转换 B 协议播放信息。
 * 纯函数: 返回全新播放对象和线路数组，不保留原始引用。
 * 失败路径: 线路容器或线路条目非法时抛出 TypeError。
 *
 * @param {object} rawItem 当前 B 协议内容条目。
 * @returns {object} 完整标准播放信息。
 * @throws {TypeError} 当播放线路不符合受审协议时抛出。
 */
function createProtocolBPlayback(rawItem) {
  // 类型: Array<*>。
  // 作用: 读取 B 协议线路数组；缺失时使用空数组保持播放字段完整。
  const rawPlaySources = Array.isArray(rawItem.vod_play) ? rawItem.vod_play : [];

  // 循环类型: Array.prototype.map。
  // 初始值: 第一条 B 协议播放线路。
  // 终止条件: 全部线路转换完成。
  // 循环作用: 裁剪 vod 字段并生成标准播放线路。
  const sources = rawPlaySources.map((rawSource, index) => {
    assertPlainRecord(rawSource, `protocolB.vod_play[${index}]`);

    return {
      id: String(rawSource.line_id || ''),
      name: typeof rawSource.line_name === 'string' ? rawSource.line_name : '',
      type: rawSource.line_type === 'm3u8' || rawSource.line_type === 'hls'
        ? 'hls'
        : (rawSource.line_type === 'mp4' ? 'mp4' : 'unknown'),
      url: typeof rawSource.line_url === 'string' ? rawSource.line_url : '',
      quality: typeof rawSource.line_quality === 'string' ? rawSource.line_quality : '',
      // 边界: mock 与真实 Provider 都只声明浏览器直连媒体，不提供后端媒体代理分支。
      deliveryMode: 'direct',
      available: rawSource.line_state === 1,
      // 作用: 不可用线路必须携带可展示原因；可用线路保持空字符串。
      unavailableReason: rawSource.line_state === 1 ? '' : '模拟线路当前不可用',
      episodeId: typeof rawSource.line_episode === 'string' ? rawSource.line_episode : ''
    };
  });

  return {
    defaultSourceId: typeof rawItem.vod_default_line === 'string'
      ? rawItem.vod_default_line
      : (sources[0]?.id || ''),
    sources
  };
}

/**
 * 把单条 B 协议内容转换为完整标准 ContentItem。
 * 纯函数: 只读取 vod 条目和上下文，返回全新嵌套对象。
 * 失败路径: 原始条目或关键 id/type/title 字段非法时抛出 TypeError。
 *
 * @param {object} rawItem 单条 B 协议内容。
 * @param {object} context 当前源身份、站点信息和抓取时间。
 * @param {string} context.sourceId 当前真实数据源 id。
 * @param {string} context.sourceName 当前数据源显示名称。
 * @param {string} context.sourceDomain 当前数据源域名。
 * @param {string} context.fetchedAt 当前原始目录抓取时间。
 * @returns {object} 完整标准 ContentItem。
 * @throws {TypeError} 当条目不能形成标准内容身份时抛出。
 */
function createProtocolBContentItem(rawItem, context) {
  assertPlainRecord(rawItem, 'protocolB.vod');

  // 条件分支: 内容 id、类型或标题不是非空字符串时进入。
  // 执行内容: 拒绝生成无法跨页面定位和展示的 ContentItem。
  if (typeof rawItem.vod_id !== 'string' || rawItem.vod_id.trim() === ''
    || !['movie', 'tv'].includes(rawItem.vod_kind)
    || typeof rawItem.vod_name !== 'string' || rawItem.vod_name.trim() === '') {
    throw new TypeError('protocolB.vod 缺少有效 vod_id、vod_kind 或 vod_name');
  }

  // 类型: Array<object>。
  // 作用: 先转换 B 协议分集，供完整 ContentItem.episodes 使用。
  const episodes = createProtocolBEpisodes(rawItem.vod_episodes);

  // 类型: number|null。
  // 作用: 把 B 协议总集数文本转换为可空安全整数，非法值不进入标准字段。
  const totalEpisodesValue = parseNullableNumber(rawItem.vod_total);

  // 类型: number|null。
  // 作用: 把 B 协议最新集数文本转换为可空安全整数，非法值不进入标准字段。
  const latestEpisodeValue = parseNullableNumber(rawItem.vod_serial);

  return {
    id: rawItem.vod_id,
    sourceId: context.sourceId,
    sourceName: context.sourceName,
    type: rawItem.vod_kind,
    title: rawItem.vod_name,
    originalTitle: typeof rawItem.vod_en === 'string' ? rawItem.vod_en : '',
    aliases: splitTextList(rawItem.vod_alias),
    poster: typeof rawItem.vod_pic === 'string' ? rawItem.vod_pic : '',
    cover: typeof rawItem.vod_cover === 'string' ? rawItem.vod_cover : '',
    description: typeof rawItem.vod_blurb === 'string' ? rawItem.vod_blurb : '',
    year: typeof rawItem.vod_year === 'string' ? rawItem.vod_year : '',
    area: typeof rawItem.vod_area === 'string' ? rawItem.vod_area : '',
    language: typeof rawItem.vod_lang === 'string' ? rawItem.vod_lang : '',
    genres: splitTextList(rawItem.type_name),
    tags: splitTextList(rawItem.vod_keywords),
    displayTags: splitTextList(rawItem.vod_marks),
    score: parseNullableNumber(rawItem.vod_score),
    quality: typeof rawItem.vod_quality === 'string' ? rawItem.vod_quality : '',
    rank: parseNullableNumber(rawItem.vod_rank),
    badge: typeof rawItem.vod_badge === 'string' ? rawItem.vod_badge : '',
    detail: {
      fullDescription: typeof rawItem.vod_content === 'string' ? rawItem.vod_content : '',
      directors: splitTextList(rawItem.vod_director),
      writers: splitTextList(rawItem.vod_writer),
      actors: splitTextList(rawItem.vod_actor),
      releaseDate: typeof rawItem.vod_pubdate === 'string' ? rawItem.vod_pubdate : '',
      updateTime: typeof rawItem.vod_time === 'string' ? rawItem.vod_time : '',
      status: typeof rawItem.vod_status === 'string' ? rawItem.vod_status : '',
      screenshots: splitTextList(rawItem.vod_screens),
      trailerUrl: typeof rawItem.vod_trailer === 'string' ? rawItem.vod_trailer : ''
    },
    movie: {
      duration: rawItem.vod_kind === 'movie' && typeof rawItem.vod_duration === 'string'
        ? rawItem.vod_duration
        : ''
    },
    tv: {
      totalEpisodes: rawItem.vod_kind === 'tv' && Number.isSafeInteger(totalEpisodesValue)
        ? totalEpisodesValue
        : null,
      latestEpisode: rawItem.vod_kind === 'tv' && Number.isSafeInteger(latestEpisodeValue)
        ? latestEpisodeValue
        : null,
      updateStatus: rawItem.vod_kind === 'tv' && typeof rawItem.vod_remarks === 'string'
        ? rawItem.vod_remarks
        : '',
      season: rawItem.vod_kind === 'tv' && typeof rawItem.vod_season === 'string'
        ? rawItem.vod_season
        : ''
    },
    episodes,
    playback: createProtocolBPlayback(rawItem),
    source: {
      name: context.sourceName,
      domain: context.sourceDomain,
      rawId: rawItem.vod_id,
      sourceDetailUrl: typeof rawItem.vod_detail_url === 'string' ? rawItem.vod_detail_url : '',
      rawData: null,
      fetchedAt: context.fetchedAt
    }
  };
}

/**
 * 解码 B 协议目录响应。
 * 纯函数: 每次调用都创建新的根对象、items 数组和全部嵌套 ContentItem。
 * 成功路径: 返回精确 `{ sourceId, items }`。
 * 失败路径: 状态码、身份、站点、时间或视频容器不符合协议时抛出 TypeError。
 *
 * @param {object} rawBody MockNetworkAdapter 返回的 B 协议目录 body。
 * @param {string} sourceId 当前数据集真实 id。
 * @returns {{sourceId: string, items: Array<object>}} 隔离标准目录。
 * @throws {TypeError} 当原始目录不符合受审 B 协议时抛出。
 */
function decodeProtocolBCatalog(rawBody, sourceId) {
  assertPlainRecord(rawBody, 'protocolB.catalog');
  assertPlainRecord(rawBody.station, 'protocolB.catalog.station');
  assertPlainRecord(rawBody.data, 'protocolB.catalog.data');
  assertSourceIdentity(rawBody.station.key, sourceId, 'protocolB.catalog.station.key');

  // 条件分支: code、站点、服务器时间或 videos 容器不符合 B 协议时进入。
  // 执行内容: 拒绝用默认值掩盖失败响应或损坏外壳。
  if (rawBody.code !== 0
    || typeof rawBody.station.label !== 'string'
    || typeof rawBody.station.host !== 'string'
    || typeof rawBody.server_time !== 'string'
    || !Array.isArray(rawBody.data.videos)) {
    throw new TypeError('protocolB.catalog 外壳不符合协议');
  }

  // 类型: object。
  // 作用: 保存当前解码共享身份和站点字段，条目转换只读该隔离上下文。
  const context = {
    sourceId,
    sourceName: rawBody.station.label,
    sourceDomain: rawBody.station.host,
    fetchedAt: rawBody.server_time
  };

  // 循环类型: Array.prototype.map。
  // 初始值: 第一条 B 协议 vod 内容。
  // 终止条件: 全部原始内容转换为完整 ContentItem。
  // 循环作用: 不保留 videos 或 vod 条目引用，返回隔离标准目录。
  const items = rawBody.data.videos.map(rawItem => createProtocolBContentItem(rawItem, context));

  return { sourceId, items };
}

/**
 * 解码 B 协议健康响应。
 * 纯函数: 只读取当前响应并返回精确三字段新对象。
 * 成功路径: online 1/0 分别映射为 normal/unavailable。
 * 失败路径: code、身份、online、时间或原因字段不符合协议时抛出 TypeError。
 *
 * @param {object} rawBody MockNetworkAdapter 返回的 B 协议健康 body。
 * @param {string} sourceId 当前数据集真实 id。
 * @returns {{healthStatus: string, checkedAt: string, unavailableReason: string}} 标准健康结果。
 * @throws {TypeError} 当原始健康响应不符合受审 B 协议时抛出。
 */
function decodeProtocolBHealth(rawBody, sourceId) {
  assertPlainRecord(rawBody, 'protocolB.health');
  assertPlainRecord(rawBody.node, 'protocolB.health.node');
  assertSourceIdentity(rawBody.node.key, sourceId, 'protocolB.health.node.key');

  // 条件分支: code、online 标记、时间或原因不符合 B 协议时进入。
  // 执行内容: 拒绝形成无法解释的健康结果。
  if (rawBody.code !== 0
    || ![0, 1].includes(rawBody.node.online)
    || typeof rawBody.timestamp !== 'string'
    || typeof rawBody.node.message !== 'string') {
    throw new TypeError('protocolB.health 外壳不符合协议');
  }

  // 类型: string。
  // 作用: online 为 1 表示标准 normal，0 表示 unavailable；该映射与 sourceId 无关。
  const healthStatus = rawBody.node.online === 1 ? 'normal' : 'unavailable';

  return {
    healthStatus,
    checkedAt: rawBody.timestamp,
    unavailableReason: healthStatus === 'normal' ? '' : rawBody.node.message
  };
}

/**
 * 创建单个 B 协议数据集。
 * 纯函数: 返回精确六字段冻结对象，不修改配置。
 *
 * @param {object} config 数据源身份与端点配置。
 * @param {string} config.sourceId 真实数据源 id。
 * @param {string} config.catalogUrl 独立目录精确地址。
 * @param {string} config.healthUrl 独立健康精确地址。
 * @returns {object} 精确六字段冻结数据集。
 */
function createProtocolBDataSet(config) {
  return Object.freeze({
    sourceId: config.sourceId,
    protocolKey: PROTOCOL_B_KEY,
    catalogUrl: config.catalogUrl,
    healthUrl: config.healthUrl,
    decodeCatalog: decodeProtocolBCatalog,
    decodeHealth: decodeProtocolBHealth
  });
}

// 类型: object。
// 作用: 按真实 sourceId 提供 system-source-2 与 system-source-4 数据集；两个条目复用协议解码器但拥有独立端点。
export const mockProtocolBDataSets = Object.freeze(Object.fromEntries(
  // 循环类型: Array.prototype.map。
  // 初始值: system-source-2 数据集配置。
  // 终止条件: 两个 B 协议配置全部转换完成。
  // 循环作用: 以 sourceId 建立冻结工厂查找表，不在解码器中添加身份分支。
  PROTOCOL_B_DATA_SET_CONFIGS.map(config => [config.sourceId, createProtocolBDataSet(config)])
));
