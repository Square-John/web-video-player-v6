/*
  system-source-1.js 模块说明

  - 文件职责:
      提供可通过文件、文本或远程地址导入的单文件系统演示 Provider。
      通过 Host 注入的 SourceContext 接受生命周期管理，并返回标准内容、筛选、健康与挑战结果。
      本文件不访问全局网络、DOM、store、Repository、浏览器存储或其他 Provider。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      sourceManifest: object，单文件 Provider 的静态身份、版本、能力和网络主机声明。
      PROVIDER_PHASE: object，Provider 实例生命周期枚举。
      DEMO_TIMESTAMP: string，系统演示响应使用的稳定时间。
      DEMO_CONTENT: object，当前数据源交付的标准电影内容。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createContentItem(sourceId): 创建当前来源的独立标准内容对象。
      createDataResponse(request): 按页面类型创建标准内容响应。
      createFilterResponse(request): 创建电影或电视剧目录筛选响应。
      createProvider(definition): 创建独立生命周期 Provider 实例。

  - 模块级类:
      无

  - 对外导出:
      sourceManifest: object，供单文件加载器在执行前静态预检。
      createProviderFactory: Function，创建只支持当前 manifest 身份的 Provider 工厂。
*/

// 类型: object。
// 作用: 静态声明系统数据源1的 ABI、身份、显示信息、页面能力和允许网络主机。
export const sourceManifest = Object.freeze({
  schemaVersion: '1.0.0',
  providerApiVersion: '2.0.0',
  id: 'source.system.1',
  name: '系统数据源1',
  description: '提供离线标准内容和完整单文件 Provider 生命周期的系统演示数据源。',
  version: '2.0.0',
  providerKey: 'source.system.1.provider',
  capabilities: {
    home: true,
    movie: true,
    tv: true,
    search: true,
    detail: true,
    play: true
  },
  settingsSchema: [],
  networkHosts: ['system-source-1.invalid']
});

// 类型: object。
// 作用: 约束单个 Provider 实例的生命周期顺序，业务方法只允许在 running 阶段执行。
const PROVIDER_PHASE = Object.freeze({
  created: 'created',
  initialized: 'initialized',
  running: 'running',
  stopped: 'stopped',
  disposed: 'disposed'
});

// 类型: string。
// 作用: 给离线演示响应提供稳定时间，避免无网络数据在重复导入时产生无意义差异。
const DEMO_TIMESTAMP = '2026-01-01T00:00:00.000Z';

// 类型: object。
// 作用: 保存当前脚本交付的标准电影事实，创建响应时会复制为独立对象并补齐 sourceId。
const DEMO_CONTENT = Object.freeze({
  id: 'system-source-1-movie-001',
  type: 'movie',
  title: '演示影片一',
  originalTitle: 'System Demo Movie One',
  aliases: [],
  poster: '',
  cover: '',
  description: '用于验证单文件 Provider 导入、运行和展示链路的离线演示内容。',
  year: '2026',
  area: '演示区域',
  language: '国语',
  genres: ['剧情'],
  tags: ['系统演示'],
  score: 8.1,
  quality: 'HD',
  rank: 1,
  badge: 'HD'
});

/**
 * 创建当前来源的标准内容对象。
 * 纯函数: 只读取冻结演示事实并创建新对象，不修改模块级常量或外部状态。
 * 成功路径: 返回包含详情、电影字段、分集、播放线路和来源信息的完整对象。
 * 失败路径: sourceId 为空时仍使用 manifest id，避免生成无来源内容。
 *
 * @param {string} sourceId Host Definition 提供的数据源身份。
 * @returns {object} 可由页面内容 store 消费的标准电影对象。
 */
function createContentItem(sourceId) {
  // 类型: string。
  // 作用: 优先采用 Host Definition 身份，缺失时回退静态 manifest 身份。
  const effectiveSourceId = sourceId || sourceManifest.id;

  // 返回值类型: object。
  // 作用: 返回完整且无共享嵌套引用的 ContentItem。
  return {
    ...DEMO_CONTENT,
    sourceId: effectiveSourceId,
    aliases: [...DEMO_CONTENT.aliases],
    genres: [...DEMO_CONTENT.genres],
    tags: [...DEMO_CONTENT.tags],
    detail: {
      fullDescription: DEMO_CONTENT.description,
      directors: ['演示导演'],
      writers: ['演示编剧'],
      actors: ['演示演员'],
      releaseDate: '2026-01-01',
      updateTime: '2026-01-01',
      status: '已发布',
      screenshots: [],
      trailerUrl: ''
    },
    movie: {
      duration: '90分钟'
    },
    tv: {
      totalEpisodes: null,
      latestEpisode: null,
      updateStatus: '',
      season: ''
    },
    episodes: [{
      id: 'system-source-1-movie-001-main',
      episodeNumber: 1,
      title: '正片',
      label: '正片',
      duration: '90分钟',
      description: '',
      cover: '',
      playable: true
    }],
    playback: {
      defaultSourceId: 'system-source-1-line-1',
      sources: [{
        id: 'system-source-1-line-1',
        name: '演示线路一',
        type: 'mp4',
        url: '',
        quality: 'HD',
        available: false,
        episodeId: 'system-source-1-movie-001-main'
      }],
      headers: {
        referer: '',
        userAgent: ''
      },
      sourcePlayUrl: ''
    },
    source: {
      name: sourceManifest.name,
      domain: sourceManifest.networkHosts[0],
      rawId: DEMO_CONTENT.id,
      sourceDetailUrl: '',
      rawData: null,
      fetchedAt: DEMO_TIMESTAMP
    }
  };
}

/**
 * 创建标准内容响应。
 * 纯函数: 只读取请求和冻结演示事实，不请求网络、不写存储也不修改请求对象。
 * 成功路径: 列表页面返回一条 items，详情和播放页返回同一条 item。
 * 失败路径: 未知页面返回 empty 列表响应，不伪造未声明页面能力。
 *
 * @param {object} request Host 交付的标准 SourceDataRequest。
 * @returns {object} 标准 SourceDataResponse。
 */
function createDataResponse(request) {
  // 类型: object。
  // 作用: 非对象请求使用空对象，让响应仍保持稳定字段并由 Host 执行最终校验。
  const safeRequest = request && typeof request === 'object' ? request : {};

  // 类型: object。
  // 作用: 创建当前请求独立内容对象，避免不同调用共享嵌套状态。
  const item = createContentItem(safeRequest.sourceId);

  // 类型: boolean。
  // 作用: 详情页和播放页消费单内容字段，其余已声明页面消费列表字段。
  const isItemPage = safeRequest.pageKey === 'detail' || safeRequest.pageKey === 'player';

  // 类型: boolean。
  // 作用: 限定首页、目录和搜索四类列表页面，未知页面不会获得演示条目。
  const isListPage = ['home', 'movie', 'tv', 'search'].includes(safeRequest.pageKey);

  // 返回值类型: object。
  // 作用: 返回字段完整、来源一致且可由 SourceRuntime 采纳的标准响应。
  return {
    sourceId: safeRequest.sourceId || sourceManifest.id,
    pageKey: safeRequest.pageKey || '',
    moduleKey: safeRequest.moduleKey || '',
    request: {
      sourceId: safeRequest.sourceId || sourceManifest.id,
      pageKey: safeRequest.pageKey || '',
      moduleKey: safeRequest.moduleKey || '',
      params: safeRequest.params && typeof safeRequest.params === 'object'
        ? { ...safeRequest.params }
        : {}
    },
    pagination: isItemPage ? null : {
      page: 1,
      pageSize: 1,
      total: isListPage ? 1 : 0,
      totalPages: isListPage ? 1 : 0,
      hasMore: false
    },
    items: isListPage ? [item] : [],
    item: isItemPage ? item : null,
    meta: {
      status: isItemPage || isListPage ? 'ready' : 'empty',
      message: isItemPage || isListPage ? '' : '当前页面不在演示范围内',
      fetchedAt: DEMO_TIMESTAMP
    }
  };
}

/**
 * 创建目录筛选响应。
 * 纯函数: 不读取 Provider 状态或外部数据，只根据请求页面生成独立筛选数组。
 * 成功路径: movie 和 tv 返回类型筛选组。
 * 失败路径: 其他页面返回空 groups，让 Host 或页面按能力边界处理。
 *
 * @param {object} request Host 交付的标准 SourceFilterMetaRequest。
 * @returns {object} 标准 SourceFilterMetaResponse。
 */
function createFilterResponse(request) {
  // 类型: object。
  // 作用: 非对象请求使用空对象，避免属性读取抛出非领域异常。
  const safeRequest = request && typeof request === 'object' ? request : {};

  // 类型: boolean。
  // 作用: 只有正式目录页可以获得筛选组。
  const supported = safeRequest.pageKey === 'movie' || safeRequest.pageKey === 'tv';

  // 返回值类型: object。
  // 作用: 返回来源、页面、请求、筛选组和元信息完整的标准响应。
  return {
    sourceId: safeRequest.sourceId || sourceManifest.id,
    pageKey: safeRequest.pageKey || '',
    request: {
      sourceId: safeRequest.sourceId || sourceManifest.id,
      pageKey: safeRequest.pageKey || '',
      params: safeRequest.params && typeof safeRequest.params === 'object'
        ? { ...safeRequest.params }
        : {}
    },
    groups: supported ? [{
      name: 'type',
      label: '类型',
      options: [{ label: '全部', value: '', count: 1, active: true }]
    }] : [],
    meta: {
      status: supported ? 'ready' : 'empty',
      message: supported ? '' : '当前页面不提供筛选字段',
      fetchedAt: DEMO_TIMESTAMP
    }
  };
}

/**
 * 创建独立 Provider 实例。
 * 副作用: 返回的生命周期方法会保存 Host 注入的 SourceContext 和当前阶段。
 * 成功路径: 实例按 initialize、start、业务调用、stop、dispose 顺序受管运行。
 * 失败路径: 跨源 Context 或错误生命周期顺序抛出 Error，并保持原阶段不变。
 *
 * @param {object} definition Host 已校验的 SourceDefinition。
 * @returns {object} 完整 SourceProvider 实例。
 */
function createProvider(definition) {
  // 类型: string。
  // 作用: 保存当前实例唯一数据源身份，所有响应必须回填该值。
  const sourceId = definition.id;

  // 类型: string。
  // 作用: 保存当前生命周期阶段，阻止停止后继续调用业务方法。
  let phase = PROVIDER_PHASE.created;

  // 类型: object|null。
  // 作用: 保存 Host 唯一注入的 SourceContext，dispose 时清除引用。
  let sourceContext = null;

  /**
   * 要求 Provider 已处于运行状态。
   * 纯函数: 只读取当前阶段和 Context，不修改实例状态。
   * 成功路径: 状态有效时返回当前 SourceContext。
   * 失败路径: 未运行或 Context 缺失时抛 Error。
   *
   * @param {string} operation 当前业务操作名称。
   * @returns {object} Host 注入的 SourceContext。
   */
  function requireRunningContext(operation) {
    // 条件分支: 当前实例未运行或 Context 已释放时进入。
    // 执行内容: 拒绝业务调用，避免绕过 Host 生命周期门禁。
    if (phase !== PROVIDER_PHASE.running || !sourceContext) {
      throw new Error(`系统演示 Provider 无法执行 ${operation}`);
    }
    return sourceContext;
  }

  // 返回值类型: object。
  // 作用: 返回冻结 Provider 门面，Host 不能替换生命周期或业务方法。
  return Object.freeze({
    id: sourceId,

    /**
     * 采用 Host SourceContext。
     * 副作用: 保存唯一 Context，并把阶段从 created 改为 initialized。
     * 成功路径: 同源 Context 首次采用后完成。
     * 失败路径: 重复初始化或跨源 Context 抛 Error。
     *
     * @param {object} context Host 注入的冻结 SourceContext。
     * @returns {Promise<void>} 初始化完成 Promise。
     */
    initialize(context) {
      // 条件分支: 生命周期、Context 或来源身份不符合要求时进入。
      // 执行内容: 拒绝替换能力容器或跨源使用 Context。
      if (phase !== PROVIDER_PHASE.created || !context || context.sourceId !== sourceId) {
        throw new Error('系统演示 Provider 初始化上下文无效');
      }
      sourceContext = context;
      phase = PROVIDER_PHASE.initialized;
      return Promise.resolve();
    },

    /**
     * 启动 Provider。
     * 副作用: 把生命周期从 initialized 改为 running。
     * 成功路径: 初始化完成后进入可调用状态。
     * 失败路径: 未初始化或重复启动时抛 Error。
     *
     * @returns {Promise<void>} 启动完成 Promise。
     */
    start() {
      // 条件分支: 当前阶段不是 initialized 时进入。
      // 执行内容: 拒绝越过初始化或重复启动。
      if (phase !== PROVIDER_PHASE.initialized) {
        throw new Error('系统演示 Provider 启动顺序无效');
      }
      phase = PROVIDER_PHASE.running;
      return Promise.resolve();
    },

    /**
     * 返回标准内容数据。
     * 副作用: 只读取实例生命周期，不请求网络或修改 SourceContext 私有空间。
     * 成功路径: 运行阶段返回标准内容响应。
     * 失败路径: 未运行时抛 Error。
     *
     * @param {object} request 标准 SourceDataRequest。
     * @returns {Promise<object>} 标准 SourceDataResponse。
     */
    async fetchData(request) {
      requireRunningContext('fetchData');
      return createDataResponse(request);
    },

    /**
     * 返回标准筛选元数据。
     * 副作用: 只读取实例生命周期，不请求网络或写入私有空间。
     * 成功路径: 运行阶段返回标准筛选响应。
     * 失败路径: 未运行时抛 Error。
     *
     * @param {object} request 标准 SourceFilterMetaRequest。
     * @returns {Promise<object>} 标准 SourceFilterMetaResponse。
     */
    async fetchFilterMeta(request) {
      requireRunningContext('fetchFilterMeta');
      return createFilterResponse(request);
    },

    /**
     * 返回当前 Provider 健康状态。
     * 副作用: 只读取生命周期，不访问网络或保存状态。
     * 成功路径: 运行阶段返回 normal。
     * 失败路径: 未运行时抛 Error。
     *
     * @returns {Promise<object>} 标准 SourceHealthCheckResult。
     */
    async checkHealth() {
      requireRunningContext('checkHealth');
      return {
        healthStatus: 'normal',
        checkedAt: DEMO_TIMESTAMP,
        unavailableReason: ''
      };
    },

    /**
     * 检测网络挑战。
     * 纯函数: 系统演示 Provider 不请求外部站点，固定返回 null。
     * 成功路径: 返回 null 表示当前响应没有挑战。
     * 失败路径: 无。
     *
     * @param {*} response 网络响应候选。
     * @returns {Promise<null>} 当前演示源没有挑战。
     */
    async detectChallenge() {
      return null;
    },

    /**
     * 继续挑战流程。
     * 副作用: 只验证生命周期，不读取页面或建立第二份会话状态。
     * 成功路径: 运行阶段原样返回协调器提交结果。
     * 失败路径: 未运行时抛 Error。
     *
     * @param {*} challengeInput 全局挑战协调器提交结果。
     * @returns {Promise<*>} 原样返回的挑战结果。
     */
    async continueChallenge(challengeInput) {
      requireRunningContext('continueChallenge');
      return challengeInput;
    },

    /**
     * 停止 Provider。
     * 副作用: 把 running 收敛为 stopped；Host signal 负责中止在途请求。
     * 成功路径: running 和 stopped 均可幂等完成。
     * 失败路径: 尚未启动时抛 Error，disposed 状态直接完成。
     *
     * @returns {Promise<void>} 停止完成 Promise。
     */
    stop() {
      // 条件分支: 实例已经永久释放时进入。
      // 执行内容: 幂等完成，不恢复 Context。
      if (phase === PROVIDER_PHASE.disposed) return Promise.resolve();

      // 条件分支: 当前阶段既不是 running 也不是 stopped 时进入。
      // 执行内容: 拒绝尚未启动的错误停止顺序。
      if (phase !== PROVIDER_PHASE.running && phase !== PROVIDER_PHASE.stopped) {
        throw new Error('系统演示 Provider 停止顺序无效');
      }
      phase = PROVIDER_PHASE.stopped;
      return Promise.resolve();
    },

    /**
     * 永久释放 Provider。
     * 副作用: 清除 SourceContext 并把实例标记为 disposed。
     * 成功路径: 任意已创建实例均可幂等释放。
     * 失败路径: 无。
     *
     * @returns {Promise<void>} 释放完成 Promise。
     */
    dispose() {
      sourceContext = null;
      phase = PROVIDER_PHASE.disposed;
      return Promise.resolve();
    }
  });
}

/**
 * 创建当前单文件 Provider 工厂。
 * 纯函数: 只创建冻结工厂门面，不初始化 Provider、不访问网络也不修改外部状态。
 * 成功路径: supports 精确匹配 manifest 身份，create 返回独立 Provider。
 * 失败路径: Definition 不匹配时 supports 返回 false，create 抛 Error。
 *
 * @returns {object} 只支持当前 manifest 的 ProviderFactory。
 */
export function createProviderFactory() {
  // 返回值类型: object。
  // 作用: 返回冻结工厂，动态注册后不能替换身份判断或实例创建逻辑。
  return Object.freeze({
    providerKey: sourceManifest.providerKey,

    /**
     * 判断 Definition 是否属于当前工厂。
     * 纯函数: 只比较 id 和 providerKey，不创建实例或访问网络。
     * 成功路径: 两个身份字段均匹配时返回 true。
     * 失败路径: 候选缺失或字段不匹配时返回 false。
     *
     * @param {*} definition SourceDefinition 候选。
     * @returns {boolean} 当前工厂是否支持该 Definition。
     */
    supports(definition) {
      return Boolean(definition
        && definition.id === sourceManifest.id
        && definition.providerKey === sourceManifest.providerKey);
    },

    /**
     * 创建独立 Provider。
     * 副作用: 只创建新的闭包状态，不初始化 Context 或请求网络。
     * 成功路径: Definition 身份匹配时返回 Provider。
     * 失败路径: Definition 不匹配时抛 Error。
     *
     * @param {object} options Host 工厂创建参数。
     * @param {object} options.definition SourceDefinition 隔离副本。
     * @returns {object} 新 Provider 实例。
     */
    create({ definition }) {
      // 条件分支: Definition 身份或工厂键不匹配当前 manifest 时进入。
      // 执行内容: 拒绝一个单文件工厂创建其他数据源实例。
      if (!definition
        || definition.id !== sourceManifest.id
        || definition.providerKey !== sourceManifest.providerKey) {
        throw new Error('系统演示 Provider 定义不受支持');
      }
      return createProvider(definition);
    }
  });
}
