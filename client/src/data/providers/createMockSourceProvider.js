/*
  createMockSourceProvider.js 模块说明

  - 文件职责:
      使用项目内受审 A/B 数据集创建统一可信模拟 SourceProvider。
      通过 SourceContext 获取模拟网络、私有缓存、挑战和生命周期能力，并返回标准内容、筛选和健康结果。
      提供只认识受审 sourceId 映射的可信 Provider 工厂，不读取或执行 SourcePackage.scriptContent。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      mockProtocolADataSets: 自定义数据，A 协议受审数据集集合。
      mockProtocolBDataSets: 自定义数据，B 协议受审数据集集合。
      createListSourceDataResponse、createItemSourceDataResponse: 自定义工具函数，创建标准内容响应。
      createSourceFilterMetaResponse: 自定义工具函数，创建标准筛选元数据响应。
      SOURCE_NETWORK_METHOD、SOURCE_NETWORK_POLICY: 自定义配置，提供网络方法和容量边界。

  - 模块级常量:
      MOCK_SOURCE_PROVIDER_KEY: string，可信模拟 Provider 工厂注册键。
      MOCK_SOURCE_IDS: Array<string>，必须由受审数据集完整覆盖的数据源身份。
      MOCK_DATA_SET_FIELDS: Array<string>，单个数据集精确字段集合。
      MOCK_PROVIDER_OPTION_FIELDS: Array<string>，Provider 创建选项精确字段集合。
      MOCK_FACTORY_CREATE_OPTION_FIELDS: Array<string>，工厂创建选项精确字段集合。
      MOCK_SOURCE_CAPABILITY_KEYS: Array<string>，Definition 必须声明的页面能力。
      MOCK_SOURCE_PAGE: object，内容请求页面名称枚举。
      MOCK_SOURCE_PAGE_CAPABILITY: object，标准页面键到 Definition 能力键的冻结映射。
      MOCK_SOURCE_HOME_MODULE: object，首页区域名称枚举。
      MOCK_SOURCE_PROVIDER_PHASE: object，Provider 私有生命周期枚举。
      MOCK_SOURCE_NETWORK_OPERATION: object，模拟网络调用名称与请求 id 后缀。
      MOCK_SOURCE_NETWORK_REQUEST_POLICY: object，Provider 网络超时和响应容量策略。
      MOCK_SOURCE_HTTP_STATUS: object，模拟网络成功状态码边界。
      MOCK_SOURCE_RESPONSE_STATUS: object，标准成功响应状态。
      MOCK_SOURCE_FILTER: object，筛选字段、标签和值枚举。
      MOCK_SOURCE_SORT: object，目录排序枚举。
      MOCK_SOURCE_CACHE: object，小型结构化诊断缓存键和能力名。
      MOCK_SOURCE_CHALLENGE: object，网络挑战检测和占位请求常量。
      AUDITED_DATA_SET_BY_SOURCE_ID: object，sourceId 到冻结受审数据集的私有映射。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertObject(value, fieldName): Function，校验非数组对象。
      assertExactFields(value, fields, fieldName): Function，校验精确自有字段。
      assertNonEmptyString(value, fieldName): Function，校验非空字符串。
      normalizeDataSet(dataSet, fieldName): Function，校验并冻结单个受审数据集。
      validateDataSetCollection(dataSetCollection, fieldName): Function，校验键控冻结数据集对象。
      createAuditedDataSetMap(dataSets): Function，建立四源私有冻结映射。
      normalizeCapabilities(capabilities): Function，校验六类页面能力。
      normalizeProviderOptions(options): Function，校验 Provider 与数据集身份。
      createNetworkRequest(sourceId, operation, url): Function，创建 ABI 2.0 原始运输网络请求。
      decodeJsonResponseBody(body): Function，在 Provider 内把原始字节解码为 JSON 业务值。
      assertSuccessfulNetworkResponse(response, operation): Function，校验网络成功状态。
      normalizeCatalog(catalog, sourceId): Function，校验标准目录解码结果。
      createCountMap(values): Function，统计筛选字段数量。
      createFilterOptions(values, totalCount, order): Function，创建标准筛选项。
      createFilterGroups(items): Function，统计类型、地区和年份筛选组。
      filterCatalogItems(items, request): Function，执行稳定通用筛选和排序。
      selectListCandidates(items, request): Function，选择首页、目录或搜索候选。
      findCatalogItem(items, request): Function，定位详情或播放内容。
      createNetworkChallenge(sourceId, response): Function，把挑战状态响应转换为标准挑战。
      createMockSourceProviderFactoryDataSet(sourceId): Function，读取工厂私有受审数据集。

  - 模块级类:
      无

  - 对外导出:
      MOCK_SOURCE_PROVIDER_KEY: string，可信模拟 Provider 工厂注册键。
      createMockSourceProvider(options): Function，创建独立统一模拟 Provider。
      createMockSourceProviderFactory(): Function，创建冻结可信工厂。
*/

// 导入来源: ./mock-provider-data/source-a.data.js。
// 导入内容: mockProtocolADataSets A 协议受审数据集集合。
// 文件作用: 为 system-source-1 和 system-source-3 提供精确端点与解码器。
import { mockProtocolADataSets } from './mock-provider-data/source-a.data.js';

// 导入来源: ./mock-provider-data/source-b.data.js。
// 导入内容: mockProtocolBDataSets B 协议受审数据集集合。
// 文件作用: 为 system-source-2 和 system-source-4 提供不同原始协议的精确端点与解码器。
import { mockProtocolBDataSets } from './mock-provider-data/source-b.data.js';

import {
  // 导入来源: ../../utils/sourceDataResponse.js。
  // 导入内容: createItemSourceDataResponse 单内容响应创建函数。
  // 文件作用: 包装 detail 和 player 的标准 SourceDataResponse。
  createItemSourceDataResponse,

  // 导入来源: ../../utils/sourceDataResponse.js。
  // 导入内容: createListSourceDataResponse 列表响应创建函数。
  // 文件作用: 包装首页、目录和搜索的标准 SourceDataResponse。
  createListSourceDataResponse
} from '../../utils/sourceDataResponse.js';

// 导入来源: ../../utils/sourceFilterMetaResponse.js。
// 导入内容: createSourceFilterMetaResponse 筛选元数据响应创建函数。
// 文件作用: 把同一目录统计结果包装为标准 SourceFilterMetaResponse。
import { createSourceFilterMetaResponse } from '../../utils/sourceFilterMetaResponse.js';

import {
  // 导入来源: ../../runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_METHOD 标准网络方法枚举。
  // 文件作用: Provider 只创建 Shell 支持的 GET 请求。
  SOURCE_NETWORK_METHOD,

  // 导入来源: ../../runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_POLICY 网络容量边界。
  // 文件作用: Provider 的集中请求策略保持在 Shell 允许范围内。
  SOURCE_NETWORK_POLICY
} from '../../runtime/source-shell/source-shell.config.js';

// 类型: string。
// 作用: 项目内可信模拟 Provider 工厂唯一注册键，必须与 Package 和 Definition.providerKey 一致。
export const MOCK_SOURCE_PROVIDER_KEY = 'mock-source-provider';

// 类型: Array<string>。
// 作用: 固定本阶段必须由 A/B 受审数据集完整覆盖的四个演示 sourceId。
const MOCK_SOURCE_IDS = Object.freeze([
  'system-source-1',
  'system-source-3',
  'system-source-2',
  'system-source-4'
]);

// 类型: Array<string>。
// 作用: 固定 ProviderDataSet 精确字段，拒绝 fixture、store 或页面对象混入工厂映射。
const MOCK_DATA_SET_FIELDS = Object.freeze([
  'sourceId',
  'protocolKey',
  'catalogUrl',
  'healthUrl',
  'decodeCatalog',
  'decodeHealth'
]);

// 类型: Array<string>。
// 作用: createMockSourceProvider 只接收 Definition 和单个受审数据集。
const MOCK_PROVIDER_OPTION_FIELDS = Object.freeze([
  'definition',
  'dataSet'
]);

// 类型: Array<string>。
// 作用: 可信工厂 create 只接收 Host 提供的隔离 Definition。
const MOCK_FACTORY_CREATE_OPTION_FIELDS = Object.freeze([
  'definition'
]);

// 类型: Array<string>。
// 作用: 固定 SourceDefinition.capabilities 六类页面能力，Provider 不接受缺失或模糊 Boolean。
const MOCK_SOURCE_CAPABILITY_KEYS = Object.freeze([
  'home',
  'movie',
  'tv',
  'search',
  'detail',
  'play'
]);

// 类型: object。
// 作用: 集中声明 Provider 支持的标准内容页面名称，避免业务分支散落裸字符串。
const MOCK_SOURCE_PAGE = Object.freeze({
  home: 'home',
  movie: 'movie',
  tv: 'tv',
  search: 'search',
  detail: 'detail',
  player: 'player'
});

// 类型: object。
// 作用: 显式连接标准请求 pageKey 与既有 Definition.capabilities 字段；播放页使用 player 请求但读取 play 能力，避免两份契约被错误合并。
const MOCK_SOURCE_PAGE_CAPABILITY = Object.freeze({
  home: 'home',
  movie: 'movie',
  tv: 'tv',
  search: 'search',
  detail: 'detail',
  player: 'play'
});

// 类型: object。
// 作用: 集中声明首页五个标准区域及其内容类型和排名行为。
const MOCK_SOURCE_HOME_MODULE = Object.freeze({
  banners: Object.freeze({ key: 'banners', type: '', ranked: false }),
  hotMovies: Object.freeze({ key: 'hotMovies', type: 'movie', ranked: false }),
  hotTv: Object.freeze({ key: 'hotTv', type: 'tv', ranked: false }),
  movieRanking: Object.freeze({ key: 'movieRanking', type: 'movie', ranked: true }),
  tvRanking: Object.freeze({ key: 'tvRanking', type: 'tv', ranked: true })
});

// 类型: object。
// 作用: 定义单个 Provider 私有生命周期；业务方法只允许在 running 阶段执行。
const MOCK_SOURCE_PROVIDER_PHASE = Object.freeze({
  created: 'created',
  initialized: 'initialized',
  running: 'running',
  stopped: 'stopped',
  disposed: 'disposed'
});

// 类型: object。
// 作用: 集中定义两类网络调用能力名和请求 id 后缀，网络请求不在方法中拼写散落常量。
const MOCK_SOURCE_NETWORK_OPERATION = Object.freeze({
  catalog: Object.freeze({ capability: 'catalog', requestIdSuffix: 'catalog-request' }),
  health: Object.freeze({ capability: 'health', requestIdSuffix: 'health-request' })
});

// 类型: object。
// 作用: 集中定义 Provider 网络请求策略，值保持在 Source Shell 冻结边界内。
const MOCK_SOURCE_NETWORK_REQUEST_POLICY = Object.freeze({
  timeout: SOURCE_NETWORK_POLICY.maxTimeoutMs,
  maxResponseBytes: SOURCE_NETWORK_POLICY.maxResponseBytes,
  method: SOURCE_NETWORK_METHOD.get
});

// 类型: object。
// 作用: 集中定义成功 HTTP 状态码闭区间，目录和健康响应不散落魔法数字。
const MOCK_SOURCE_HTTP_STATUS = Object.freeze({
  successMinimum: 200,
  successMaximum: 299
});

// 类型: object。
// 作用: 集中定义 Provider 创建标准成功响应使用的状态值。
const MOCK_SOURCE_RESPONSE_STATUS = Object.freeze({
  ready: 'ready'
});

// 类型: object。
// 作用: 集中定义动态筛选组名称、标签和全部选项值。
const MOCK_SOURCE_FILTER = Object.freeze({
  allValue: 'all',
  genre: Object.freeze({ name: 'genre', label: '类型' }),
  area: Object.freeze({ name: 'area', label: '地区' }),
  year: Object.freeze({ name: 'year', label: '年份' })
});

// 类型: object。
// 作用: 集中定义目录页支持的稳定排序值。
const MOCK_SOURCE_SORT = Object.freeze({
  latest: 'latest',
  hot: 'hot',
  score: 'score'
});

// 类型: object。
// 作用: 集中定义 cache 分区使用的小型诊断键和能力名，不保存原始目录或大响应。
const MOCK_SOURCE_CACHE = Object.freeze({
  contentKey: 'provider-content-diagnostic',
  filterKey: 'provider-filter-diagnostic',
  contentCapability: 'fetchData',
  filterCapability: 'fetchFilterMeta'
});

// 类型: object。
// 作用: 集中定义可识别网络挑战状态和标准字段声明，测试可验证真实 resolved/cancelled 边界。
const MOCK_SOURCE_CHALLENGE = Object.freeze({
  statusCodes: Object.freeze([401, 403]),
  challengeIdSuffix: 'network-challenge',
  type: 'source-authentication',
  title: '',
  image: '',
  fields: Object.freeze([Object.freeze({
    name: 'code',
    type: 'text',
    label: '验证信息',
    required: true,
    placeholder: '请输入验证信息'
  })]),
  expiresAt: '',
  contextKey: 'provider-network-challenge'
});

/**
 * 校验值是非数组对象。
 * 纯函数: 只检查输入类型，不修改对象。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 错误定位名称。
 * @returns {object} 已确认的对象原引用。
 * @throws {TypeError} 当值不是非数组对象时抛出。
 */
function assertObject(value, fieldName) {
  // 条件分支: value 为空、不是对象或是数组时进入。
  // 执行内容: 抛出类型错误，避免后续字段读取产生模糊异常。
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${fieldName} 必须是对象`);
  }

  return value;
}

/**
 * 校验对象字段与固定集合完全一致。
 * 纯函数: 只读取全部自有键，不修改输入。
 *
 * @param {object} value 已确认对象。
 * @param {Array<string>} fields 允许且必需的字段集合。
 * @param {string} fieldName 错误定位名称。
 * @returns {object} 字段精确的原对象。
 * @throws {TypeError} 当字段缺失、额外或包含 Symbol 时抛出。
 */
function assertExactFields(value, fields, fieldName) {
  // 类型: Array<string|symbol>。
  // 作用: 读取不可枚举和 Symbol 字段，防止隐藏能力绕过边界。
  const actualFields = Reflect.ownKeys(value);

  // 类型: boolean。
  // 作用: 判断字段数量和成员是否与契约完全一致。
  const hasExactFields = actualFields.length === fields.length
    && fields.every(field => actualFields.includes(field));

  // 条件分支: 字段集合不精确时进入。
  // 执行内容: 拒绝缺失能力和额外依赖。
  if (!hasExactFields) {
    throw new TypeError(`${fieldName} 字段必须完整且不能包含额外字段`);
  }

  return value;
}

/**
 * 校验非空字符串。
 * 纯函数: 返回去除首尾空白后的新字符串，不修改输入。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 错误定位名称。
 * @returns {string} 非空字符串。
 * @throws {TypeError} 当输入不是字符串或只有空白时抛出。
 */
function assertNonEmptyString(value, fieldName) {
  // 条件分支: value 不是字符串时进入。
  // 执行内容: 拒绝隐式字符串转换。
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} 必须是非空字符串`);
  }

  // 类型: string。
  // 作用: 去除首尾空白，避免身份和端点出现视觉相同的不同值。
  const normalizedValue = value.trim();

  // 条件分支: 规范化后为空时进入。
  // 执行内容: 拒绝无法定位身份或端点的空值。
  if (!normalizedValue) {
    throw new TypeError(`${fieldName} 必须是非空字符串`);
  }

  return normalizedValue;
}

/**
 * 校验并冻结单个受审数据集。
 * 纯函数: 返回新的冻结描述对象，不修改数据集输入。
 *
 * @param {*} dataSet 数据集候选。
 * @param {string} fieldName 错误定位名称。
 * @returns {object} 精确字段、HTTPS 端点和可调用解码器组成的冻结数据集。
 * @throws {TypeError} 当字段、身份、协议、端点或解码器不符合契约时抛出。
 */
function normalizeDataSet(dataSet, fieldName) {
  // 类型: object。
  // 作用: 确认数据集根对象并执行精确字段校验。
  const safeDataSet = assertExactFields(
    assertObject(dataSet, fieldName),
    MOCK_DATA_SET_FIELDS,
    fieldName
  );

  // 类型: string。
  // 作用: 保存受审数据集真实 sourceId。
  const sourceId = assertNonEmptyString(safeDataSet.sourceId, `${fieldName}.sourceId`);

  // 条件分支: sourceId 不属于四个冻结身份时进入。
  // 执行内容: 阻止未登记数据集进入可信工厂。
  if (!MOCK_SOURCE_IDS.includes(sourceId)) {
    throw new TypeError(`${fieldName}.sourceId 不属于受审数据源`);
  }

  // 类型: string。
  // 作用: 保存 A/B 受审原始协议标识，Provider 不根据 sourceId 推断字段。
  const protocolKey = assertNonEmptyString(safeDataSet.protocolKey, `${fieldName}.protocolKey`);

  // 类型: URL。
  // 作用: 解析完整目录精确 HTTPS 地址。
  const catalogUrl = new URL(assertNonEmptyString(safeDataSet.catalogUrl, `${fieldName}.catalogUrl`));

  // 类型: URL。
  // 作用: 解析健康检查精确 HTTPS 地址。
  const healthUrl = new URL(assertNonEmptyString(safeDataSet.healthUrl, `${fieldName}.healthUrl`));

  // 条件分支: 任一端点不是 HTTPS 或携带凭据时进入。
  // 执行内容: 保持与 Source Shell 网络安全边界一致。
  if (catalogUrl.protocol !== 'https:'
    || healthUrl.protocol !== 'https:'
    || catalogUrl.username
    || catalogUrl.password
    || healthUrl.username
    || healthUrl.password) {
    throw new TypeError(`${fieldName} 端点必须是无凭据 HTTPS 地址`);
  }

  // 条件分支: 任一解码器不是函数时进入。
  // 执行内容: 阻止运行时才出现缺失协议实现。
  if (typeof safeDataSet.decodeCatalog !== 'function'
    || typeof safeDataSet.decodeHealth !== 'function') {
    throw new TypeError(`${fieldName} 解码器必须是函数`);
  }

  // 返回值类型: object。
  // 作用: 返回只含受审描述和捕获函数引用的冻结数据集。
  return Object.freeze({
    sourceId,
    protocolKey,
    catalogUrl: catalogUrl.href,
    healthUrl: healthUrl.href,
    decodeCatalog: safeDataSet.decodeCatalog,
    decodeHealth: safeDataSet.decodeHealth
  });
}

/**
 * 校验按 sourceId 建键的数据集导出对象。
 * 纯函数: 只读取冻结普通对象、键和数据集身份，返回原对象供 Object.values 合并。
 * 失败路径: 对象未冻结、原型异常、键不可枚举或键与 dataSet.sourceId 不一致时抛出。
 *
 * @param {*} dataSetCollection A/B 协议按 sourceId 建键的数据集候选对象。
 * @param {string} fieldName 错误定位名称。
 * @returns {object} 已确认的冻结普通对象原引用。
 * @throws {TypeError} 当集合结构、冻结状态、键或数据集身份不符合契约时抛出。
 */
function validateDataSetCollection(dataSetCollection, fieldName) {
  // 类型: object。
  // 作用: 确认协议数据集集合不是数组或空值。
  const safeCollection = assertObject(dataSetCollection, fieldName);

  // 条件分支: 集合不是冻结普通对象时进入。
  // 执行内容: 拒绝运行期增删映射或使用自定义原型提供隐藏身份逻辑。
  if (!Object.isFrozen(safeCollection)
    || Object.getPrototypeOf(safeCollection) !== Object.prototype) {
    throw new TypeError(`${fieldName} 必须是冻结普通对象`);
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取全部自有键，确保 Object.values 不会漏掉 Symbol 或不可枚举数据集。
  const ownKeys = Reflect.ownKeys(safeCollection);

  // 条件分支: 集合为空、存在 Symbol 或不可枚举键时进入。
  // 执行内容: 保证后续 Object.values 精确覆盖每个已审身份。
  if (ownKeys.length === 0
    || ownKeys.some(key => typeof key !== 'string')
    || Object.keys(safeCollection).length !== ownKeys.length) {
    throw new TypeError(`${fieldName} 必须只包含可枚举 sourceId 字符串键`);
  }

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 逐项核对映射键和数据集声明身份，工厂不从位置或协议猜测 sourceId。
  ownKeys.forEach((sourceIdKey) => {
    // 类型: string。
    // 作用: 校验键本身非空且没有首尾空白形成视觉别名。
    const normalizedSourceIdKey = assertNonEmptyString(
      sourceIdKey,
      `${fieldName} sourceId key`
    );

    // 类型: object。
    // 作用: 确认当前键对应值可读取 dataSet.sourceId。
    const dataSet = assertObject(safeCollection[sourceIdKey], `${fieldName}.${sourceIdKey}`);

    // 条件分支: 键被规范化后变化或与数据集声明身份不一致时进入。
    // 执行内容: 拒绝别名、错挂和由工厂猜测身份的映射。
    if (normalizedSourceIdKey !== sourceIdKey || dataSet.sourceId !== sourceIdKey) {
      throw new TypeError(`${fieldName}.${sourceIdKey} 的 key 必须与 dataSet.sourceId 一致`);
    }
  });

  return safeCollection;
}

/**
 * 建立四源私有冻结数据集映射。
 * 纯函数: 返回冻结普通对象，不修改 Object.values 合并结果或数据集。
 *
 * @param {Array<object>} dataSets A/B 键控对象通过 Object.values 合并的数据集集合。
 * @returns {object} sourceId 到冻结数据集的无额外项映射。
 * @throws {TypeError} 当集合、数据集、身份覆盖或重复项不符合契约时抛出。
 */
function createAuditedDataSetMap(dataSets) {
  // 条件分支: 合并数据集不是数组时进入。
  // 执行内容: 拒绝对象值被隐式迭代或静默忽略。
  if (!Array.isArray(dataSets)) {
    throw new TypeError('mock Provider 数据集集合必须是数组');
  }

  // 类型: object。
  // 作用: 使用无原型局部对象收集受审 sourceId，完成后再转换为冻结普通对象。
  const dataSetBySourceId = Object.create(null);

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 逐项验证数据集并拒绝重复 sourceId 覆盖。
  dataSets.forEach((dataSet, index) => {
    // 类型: object。
    // 作用: 保存当前标准冻结数据集。
    const normalizedDataSet = normalizeDataSet(dataSet, `mockDataSets[${index}]`);

    // 条件分支: 当前 sourceId 已经存在时进入。
    // 执行内容: 拒绝 A/B 文件相互覆盖受审数据集。
    if (Object.hasOwn(dataSetBySourceId, normalizedDataSet.sourceId)) {
      throw new TypeError(`mock Provider 数据集重复: ${normalizedDataSet.sourceId}`);
    }

    // 副作用范围: 只写函数局部映射，后续不会再修改。
    dataSetBySourceId[normalizedDataSet.sourceId] = normalizedDataSet;
  });

  // 类型: Array<string>。
  // 作用: 找出四个冻结身份中没有对应数据集的成员。
  const missingSourceIds = MOCK_SOURCE_IDS.filter(sourceId => (
    !Object.hasOwn(dataSetBySourceId, sourceId)
  ));

  // 条件分支: 存在缺失源或数据集数量不是四项时进入。
  // 执行内容: 拒绝部分可用工厂和未登记额外数据集。
  if (missingSourceIds.length > 0 || Object.keys(dataSetBySourceId).length !== MOCK_SOURCE_IDS.length) {
    throw new TypeError(`mock Provider 数据集覆盖不完整: ${missingSourceIds.join(', ')}`);
  }

  // 返回值类型: object。
  // 作用: 返回冻结普通对象，工厂只读该私有映射且不暴露引用。
  return Object.freeze({ ...dataSetBySourceId });
}

/**
 * 校验并隔离 Definition 页面能力。
 * 纯函数: 返回冻结新对象，不修改 Definition.capabilities。
 *
 * @param {*} capabilities 页面能力候选。
 * @returns {object} 六个严格 Boolean 页面能力。
 * @throws {TypeError} 当字段或 Boolean 不符合契约时抛出。
 */
function normalizeCapabilities(capabilities) {
  // 类型: object。
  // 作用: 确认能力对象精确包含六类页面键。
  const safeCapabilities = assertExactFields(
    assertObject(capabilities, 'definition.capabilities'),
    MOCK_SOURCE_CAPABILITY_KEYS,
    'definition.capabilities'
  );

  // 类型: object。
  // 作用: 收集冻结能力副本，Provider 不保存可变 Definition 引用。
  const normalizedCapabilities = {};

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 要求每个页面能力都是严格 Boolean 并复制值。
  MOCK_SOURCE_CAPABILITY_KEYS.forEach((capability) => {
    // 条件分支: 当前能力不是 Boolean 时进入。
    // 执行内容: 拒绝 truthy 字符串或数字绕过能力门禁。
    if (typeof safeCapabilities[capability] !== 'boolean') {
      throw new TypeError(`definition.capabilities.${capability} 必须是 boolean`);
    }

    normalizedCapabilities[capability] = safeCapabilities[capability];
  });

  return Object.freeze(normalizedCapabilities);
}

/**
 * 校验 Provider 创建选项并提取最小 Definition 投影。
 * 纯函数: 返回冻结新对象，不保存完整 Definition 或 options 引用。
 *
 * @param {*} options Provider 创建选项。
 * @returns {object} sourceId、sourceName、能力和冻结数据集。
 * @throws {TypeError} 当选项、Definition、身份或数据集不一致时抛出。
 */
function normalizeProviderOptions(options) {
  // 类型: object。
  // 作用: Provider 只接受 Definition 和 dataSet 两项依赖。
  const safeOptions = assertExactFields(
    assertObject(options, 'mockSourceProvider options'),
    MOCK_PROVIDER_OPTION_FIELDS,
    'mockSourceProvider options'
  );

  // 类型: object。
  // 作用: 读取 Host 提供的隔离 Definition；只消费身份、名称和页面能力。
  const definition = assertObject(safeOptions.definition, 'definition');

  // 类型: string。
  // 作用: 保存 Provider、Context、请求、响应和内容条目共用的真实 sourceId。
  const sourceId = assertNonEmptyString(definition.id, 'definition.id');

  // 类型: string。
  // 作用: 保存 ContentItem.sourceName 使用的展示名称；缺失时使用真实 sourceId。
  const sourceName = typeof definition.name === 'string' && definition.name.trim()
    ? definition.name.trim()
    : sourceId;

  // 类型: object。
  // 作用: 保存不共享 Definition 引用的六类页面能力。
  const capabilities = normalizeCapabilities(definition.capabilities);

  // 类型: object。
  // 作用: 校验并冻结调用方提供的受审数据集描述。
  const dataSet = normalizeDataSet(safeOptions.dataSet, 'dataSet');

  // 条件分支: Definition 与数据集身份不一致时进入。
  // 执行内容: 阻止通过其他 sourceId 的端点和解码器创建 Provider。
  if (dataSet.sourceId !== sourceId) {
    throw new TypeError('definition.id 与 dataSet.sourceId 不一致');
  }

  return Object.freeze({ sourceId, sourceName, capabilities, dataSet });
}

/**
 * 创建标准 SourceNetworkRequest。
 * 纯函数: 只根据集中配置和当前端点返回新冻结对象。
 *
 * @param {string} sourceId 当前 Provider 真实身份。
 * @param {object} operation MOCK_SOURCE_NETWORK_OPERATION 成员。
 * @param {string} url 当前受审数据集精确端点。
 * @returns {object} SourceContext.network.request 可消费的精确 ABI 2.0 请求。
 */
function createNetworkRequest(sourceId, operation, url) {
  return Object.freeze({
    sourceId,
    requestId: `${sourceId}:${operation.requestIdSuffix}`,
    url,
    method: MOCK_SOURCE_NETWORK_REQUEST_POLICY.method,
    headers: Object.freeze([]),
    body: Object.freeze({ encoding: 'none', data: null }),
    timeout: MOCK_SOURCE_NETWORK_REQUEST_POLICY.timeout,
    maxResponseBytes: MOCK_SOURCE_NETWORK_REQUEST_POLICY.maxResponseBytes
  });
}

/**
 * 在 Provider 内把网络原始字节解码为 JSON 业务值。
 * 纯函数: 只读取 ArrayBuffer 并创建解析结果，不由 Shell、ProxyClient 或后端解释正文。
 * 成功路径: UTF-8 文本解析为数据集解码器可消费的 JSON Value。
 * 失败路径: 非 ArrayBuffer、非法 UTF-8 或非法 JSON 直接抛出，保留源站业务失败语义。
 *
 * @param {ArrayBuffer} body SourceContext.network 返回的原始响应字节。
 * @returns {*} Provider 业务解码器使用的 JSON Value。
 * @throws {TypeError|SyntaxError} 响应字节或 JSON 业务正文非法时抛出。
 */
function decodeJsonResponseBody(body) {
  // 条件分支: Adapter 越界返回业务对象或文本时进入。
  // 执行内容: 失败关闭，防止 Mock 通道重新形成隐式解码旁路。
  if (!(body instanceof ArrayBuffer)) {
    throw new TypeError('Provider 网络响应必须是 ArrayBuffer');
  }
  return JSON.parse(new TextDecoder().decode(body));
}

/**
 * 校验模拟网络响应处于成功状态。
 * 纯函数: 只读取响应状态，不修改响应对象。
 *
 * @param {*} response SourceNetworkResponse 候选。
 * @param {object} operation 当前网络能力配置。
 * @returns {object} 已确认的网络响应原引用。
 * @throws {TypeError} 当响应结构或状态类型无效时抛出。
 * @throws {Error} 当网络状态不属于 2xx 时抛出。
 */
function assertSuccessfulNetworkResponse(response, operation) {
  // 类型: object。
  // 作用: 确认响应可读取状态和 body。
  const safeResponse = assertObject(response, `${operation.capability} response`);

  // 条件分支: status 不是安全整数时进入。
  // 执行内容: 拒绝解码结构损坏的网络响应。
  if (!Number.isSafeInteger(safeResponse.status)) {
    throw new TypeError(`${operation.capability} response.status 必须是安全整数`);
  }

  // 条件分支: status 不属于 2xx 时进入。
  // 执行内容: 阻止错误页面或挑战响应进入目录/健康解码器。
  if (safeResponse.status < MOCK_SOURCE_HTTP_STATUS.successMinimum
    || safeResponse.status > MOCK_SOURCE_HTTP_STATUS.successMaximum) {
    throw new Error(`${operation.capability} 网络请求失败: ${safeResponse.status}`);
  }

  return safeResponse;
}

/**
 * 校验数据集目录解码结果。
 * 纯函数: 返回冻结浅层目录和新数组，不修改解码结果。
 *
 * @param {*} catalog decodeCatalog 返回候选。
 * @param {string} sourceId 当前 Provider 真实身份。
 * @returns {object} 精确 sourceId 和 items 的冻结标准目录。
 * @throws {TypeError} 当字段、身份或 items 不符合契约时抛出。
 */
function normalizeCatalog(catalog, sourceId) {
  // 类型: object。
  // 作用: 标准目录只允许 sourceId 和 items 两项字段。
  const safeCatalog = assertExactFields(
    assertObject(catalog, 'decodedCatalog'),
    ['sourceId', 'items'],
    'decodedCatalog'
  );

  // 条件分支: 目录身份与 Provider 不一致时进入。
  // 执行内容: 阻止解码器返回其他源内容。
  if (safeCatalog.sourceId !== sourceId) {
    throw new TypeError('decodedCatalog.sourceId 与 Provider 不一致');
  }

  // 条件分支: items 不是数组时进入。
  // 执行内容: 拒绝无法执行筛选、分页和单项定位的目录。
  if (!Array.isArray(safeCatalog.items)) {
    throw new TypeError('decodedCatalog.items 必须是数组');
  }

  // 类型: Array<object>。
  // 作用: 校验每条 ContentItem 最小身份并复制数组引用。
  const items = safeCatalog.items.map((item, index) => {
    // 类型: object。
    // 作用: 确认当前内容条目可读取标准字段。
    const safeItem = assertObject(item, `decodedCatalog.items[${index}]`);

    // 条件分支: 最小 ContentItem 字段或 sourceId 不符合契约时进入。
    // 执行内容: 阻止损坏条目进入标准响应。
    if (typeof safeItem.id !== 'string'
      || !safeItem.id.trim()
      || safeItem.sourceId !== sourceId
      || !['movie', 'tv'].includes(safeItem.type)
      || typeof safeItem.title !== 'string'
      || !safeItem.title.trim()) {
      throw new TypeError(`decodedCatalog.items[${index}] 不符合 ContentItem 最小契约`);
    }

    return safeItem;
  });

  return Object.freeze({ sourceId, items: Object.freeze([...items]) });
}

/**
 * 统计非空字符串值数量。
 * 纯函数: 返回新 Map，不修改输入数组。
 *
 * @param {Array<*>} values 待统计字段值。
 * @returns {Map<string, number>} 规范化值到出现次数映射。
 */
function createCountMap(values) {
  // 类型: Map<string, number>。
  // 作用: 保存筛选值及其候选内容数量。
  const countByValue = new Map();

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 只统计非空字符串值并累加数量。
  values.forEach((value) => {
    // 类型: string。
    // 作用: 规范化可展示筛选文本，非字符串按空值跳过。
    const normalizedValue = typeof value === 'string' ? value.trim() : '';

    // 条件分支: 当前值为空时进入。
    // 执行内容: 不生成空白筛选按钮。
    if (!normalizedValue) {
      return;
    }

    // 类型: number。
    // 作用: 读取当前值已有数量，没有时从零开始。
    const currentCount = countByValue.get(normalizedValue) || 0;
    countByValue.set(normalizedValue, currentCount + 1);
  });

  return countByValue;
}

/**
 * 创建包含“全部”的标准筛选项。
 * 纯函数: 只读取字段值并返回新对象数组。
 *
 * @param {Array<*>} values 待统计字段值。
 * @param {number} totalCount 当前页面候选内容总数。
 * @param {string} order count 或 year 排序方式。
 * @returns {Array<object>} 标准筛选项数组。
 */
function createFilterOptions(values, totalCount, order) {
  // 类型: Map<string, number>。
  // 作用: 统计每个类型、地区或年份值出现数量。
  const countByValue = createCountMap(values);

  // 类型: Array<Array<*>>。
  // 作用: 把映射转换成可稳定排序的键值对。
  const sortedEntries = [...countByValue.entries()].sort((previousEntry, nextEntry) => {
    // 条件分支: 年份组使用数字年份降序时进入。
    // 执行内容: 最近年份优先展示。
    if (order === MOCK_SOURCE_FILTER.year.name) {
      return Number(nextEntry[0]) - Number(previousEntry[0]);
    }

    // 条件分支: 数量不相同时进入。
    // 执行内容: 候选更多的筛选项优先展示。
    if (nextEntry[1] !== previousEntry[1]) {
      return nextEntry[1] - previousEntry[1];
    }

    // 返回值类型: number。
    // 作用: 数量相同时按值排序，保证重复请求顺序稳定。
    return previousEntry[0].localeCompare(nextEntry[0]);
  });

  return [
    {
      label: '全部',
      value: MOCK_SOURCE_FILTER.allValue,
      count: totalCount,
      active: false
    },
    ...sortedEntries.map(([value, count]) => ({
      label: value,
      value,
      count,
      active: false
    }))
  ];
}

/**
 * 从同一标准目录统计电影或电视剧筛选组。
 * 纯函数: 返回新组和选项数组，不修改 ContentItem。
 *
 * @param {Array<object>} items 当前页面同类型候选内容。
 * @returns {Array<object>} 类型、地区和年份三个标准筛选组。
 */
function createFilterGroups(items) {
  // 类型: Array<string>。
  // 作用: 展开全部 ContentItem.genres 供类型选项统计。
  const genres = items.flatMap(item => (
    Array.isArray(item.genres) ? item.genres : []
  ));

  return [
    {
      name: MOCK_SOURCE_FILTER.genre.name,
      label: MOCK_SOURCE_FILTER.genre.label,
      options: createFilterOptions(genres, items.length, MOCK_SOURCE_FILTER.genre.name)
    },
    {
      name: MOCK_SOURCE_FILTER.area.name,
      label: MOCK_SOURCE_FILTER.area.label,
      options: createFilterOptions(
        items.map(item => item.area),
        items.length,
        MOCK_SOURCE_FILTER.area.name
      )
    },
    {
      name: MOCK_SOURCE_FILTER.year.name,
      label: MOCK_SOURCE_FILTER.year.label,
      options: createFilterOptions(
        items.map(item => item.year),
        items.length,
        MOCK_SOURCE_FILTER.year.name
      )
    }
  ];
}

/**
 * 对标准目录执行通用字段筛选和稳定排序。
 * 纯函数: 复制数组后筛选和排序，不修改目录或 ContentItem。
 *
 * @param {Array<object>} items 标准目录候选。
 * @param {object} request SourceDataRequest。
 * @returns {Array<object>} 筛选和排序后的候选数组。
 */
function filterCatalogItems(items, request) {
  // 类型: object。
  // 作用: params 缺失时使用空对象，保持筛选入口可预测。
  const params = request.params && typeof request.params === 'object'
    ? request.params
    : {};

  // 类型: string。
  // 作用: 保存标准化分类值；all 或空值不参与过滤。
  const category = typeof params.category === 'string' ? params.category.trim() : '';

  // 类型: string。
  // 作用: 保存标准化类型值；all 或空值不参与过滤。
  const genre = typeof params.genre === 'string' ? params.genre.trim() : '';

  // 类型: string。
  // 作用: 保存标准化地区值；all 或空值不参与过滤。
  const area = typeof params.area === 'string' ? params.area.trim() : '';

  // 类型: string。
  // 作用: 保存标准化年份值；all 或空值不参与过滤。
  const year = typeof params.year === 'string' ? params.year.trim() : '';

  // 类型: string。
  // 作用: 保存标准化搜索关键词，搜索页按通用可检索字段匹配。
  const keyword = typeof params.keyword === 'string'
    ? params.keyword.trim().toLowerCase()
    : '';

  // 类型: string。
  // 作用: 保存排序值，非法或缺失时使用 latest。
  const sort = Object.values(MOCK_SOURCE_SORT).includes(params.sort)
    ? params.sort
    : MOCK_SOURCE_SORT.latest;

  // 类型: Array<object>。
  // 作用: 复制候选数组，后续排序不会修改标准目录顺序。
  let filteredItems = [...items];

  // 条件分支: category 是有效筛选值时进入。
  // 执行内容: 按内容 type、genres 或 tags 进行通用分类匹配。
  if (category && category !== MOCK_SOURCE_FILTER.allValue) {
    filteredItems = filteredItems.filter(item => (
      item.type === category
      || (Array.isArray(item.genres) && item.genres.includes(category))
      || (Array.isArray(item.tags) && item.tags.includes(category))
    ));
  }

  // 条件分支: genre 是有效筛选值时进入。
  // 执行内容: 只保留 genres 包含目标值的内容。
  if (genre && genre !== MOCK_SOURCE_FILTER.allValue) {
    filteredItems = filteredItems.filter(item => (
      Array.isArray(item.genres) && item.genres.includes(genre)
    ));
  }

  // 条件分支: area 是有效筛选值时进入。
  // 执行内容: 只保留地区精确匹配内容。
  if (area && area !== MOCK_SOURCE_FILTER.allValue) {
    filteredItems = filteredItems.filter(item => item.area === area);
  }

  // 条件分支: year 是有效筛选值时进入。
  // 执行内容: 只保留年份文本精确匹配内容。
  if (year && year !== MOCK_SOURCE_FILTER.allValue) {
    filteredItems = filteredItems.filter(item => String(item.year || '') === year);
  }

  // 条件分支: keyword 非空时进入。
  // 执行内容: 在标题、简介、年份、地区、类型和标签中执行大小写无关包含匹配。
  if (keyword) {
    filteredItems = filteredItems.filter((item) => {
      // 类型: string。
      // 作用: 拼接当前 ContentItem 可搜索字段，不修改原始对象。
      const searchableText = [
        item.title,
        item.originalTitle,
        item.description,
        item.year,
        item.area,
        item.language,
        item.type,
        ...(Array.isArray(item.aliases) ? item.aliases : []),
        ...(Array.isArray(item.genres) ? item.genres : []),
        ...(Array.isArray(item.tags) ? item.tags : []),
        ...(Array.isArray(item.displayTags) ? item.displayTags : [])
      ].join(' ').toLowerCase();

      return searchableText.includes(keyword);
    });
  }

  // 返回值类型: Array<object>。
  // 作用: 按冻结排序值和 id 兜底顺序返回稳定新数组。
  return filteredItems.sort((previousItem, nextItem) => {
    // 条件分支: score 排序时进入。
    // 执行内容: 按评分从高到低排列。
    if (sort === MOCK_SOURCE_SORT.score) {
      // 类型: number。
      // 作用: 保存评分差，非数字评分按零处理。
      const scoreDifference = Number(nextItem.score || 0) - Number(previousItem.score || 0);

      // 条件分支: 两项评分不相同时进入。
      // 执行内容: 直接采用评分顺序。
      if (scoreDifference !== 0) {
        return scoreDifference;
      }
    }

    // 条件分支: hot 排序时进入。
    // 执行内容: 带“热”展示标签的内容优先，再按评分排列。
    if (sort === MOCK_SOURCE_SORT.hot) {
      // 类型: number。
      // 作用: 前一项是否含“热”标签的数字权重。
      const previousHot = Array.isArray(previousItem.displayTags)
        && previousItem.displayTags.includes('热') ? 1 : 0;

      // 类型: number。
      // 作用: 后一项是否含“热”标签的数字权重。
      const nextHot = Array.isArray(nextItem.displayTags)
        && nextItem.displayTags.includes('热') ? 1 : 0;

      // 条件分支: 热门权重不相同时进入。
      // 执行内容: 热门内容排在普通内容前。
      if (nextHot !== previousHot) {
        return nextHot - previousHot;
      }
    }

    // 类型: number。
    // 作用: 默认 latest 和其他排序并列时按年份从新到旧排列。
    const yearDifference = Number(nextItem.year || 0) - Number(previousItem.year || 0);

    // 条件分支: 年份不相同时进入。
    // 执行内容: 采用年份顺序。
    if (yearDifference !== 0) {
      return yearDifference;
    }

    return previousItem.id.localeCompare(nextItem.id);
  });
}

/**
 * 选择首页、目录或搜索列表候选。
 * 纯函数: 返回新数组和必要排名对象，不修改标准目录。
 *
 * @param {Array<object>} items 标准目录内容。
 * @param {object} request SourceDataRequest。
 * @returns {Array<object>} 当前页面和区域候选内容。
 * @throws {Error} 当页面或首页区域不受支持时抛出。
 */
function selectListCandidates(items, request) {
  // 类型: Array<object>。
  // 作用: 保存进入通用筛选前的页面类型候选。
  let pageItems;

  // 条件分支: 首页请求时进入。
  // 执行内容: 根据冻结区域配置选择电影、电视剧或混合候选。
  if (request.pageKey === MOCK_SOURCE_PAGE.home) {
    // 类型: object|null。
    // 作用: 定位首页区域配置；未知 moduleKey 明确失败。
    const moduleConfig = Object.values(MOCK_SOURCE_HOME_MODULE).find(config => (
      config.key === request.moduleKey
    )) || null;

    // 条件分支: 首页区域没有冻结配置时进入。
    // 执行内容: 拒绝把全部目录误写入未知页面桶。
    if (!moduleConfig) {
      throw new Error(`模拟 Provider 首页区域不受支持: ${request.moduleKey || 'unknown'}`);
    }

    pageItems = moduleConfig.type
      ? items.filter(item => item.type === moduleConfig.type)
      : [...items];

    // 类型: object。
    // 作用: 排行榜强制使用 score 排序；其他首页区域保留调用方筛选参数。
    const normalizedRequest = moduleConfig.ranked
      ? { ...request, params: { ...(request.params || {}), sort: MOCK_SOURCE_SORT.score } }
      : request;

    // 类型: Array<object>。
    // 作用: 使用统一筛选排序后得到当前首页区域候选。
    const filteredItems = filterCatalogItems(pageItems, normalizedRequest);

    // 条件分支: 当前区域是排行榜时进入。
    // 执行内容: 返回补齐稳定 rank 的新 ContentItem 对象。
    if (moduleConfig.ranked) {
      return filteredItems.map((item, index) => ({ ...item, rank: index + 1 }));
    }

    return filteredItems;
  }

  // 条件分支: 电影或电视剧目录请求时进入。
  // 执行内容: 先按标准 type 限定页面候选。
  if (request.pageKey === MOCK_SOURCE_PAGE.movie || request.pageKey === MOCK_SOURCE_PAGE.tv) {
    pageItems = items.filter(item => item.type === request.pageKey);
    return filterCatalogItems(pageItems, request);
  }

  // 条件分支: 搜索请求时进入。
  // 执行内容: 允许电影和电视剧混排并使用通用关键词过滤。
  if (request.pageKey === MOCK_SOURCE_PAGE.search) {
    return filterCatalogItems(items, request);
  }

  throw new Error(`模拟 Provider 列表页面不受支持: ${request.pageKey || 'unknown'}`);
}

/**
 * 定位详情或播放请求目标内容。
 * 纯函数: 只读取目录和 request.params，不修改 ContentItem。
 *
 * @param {Array<object>} items 标准目录内容。
 * @param {object} request SourceDataRequest。
 * @returns {object|null} 匹配 ContentItem；未命中返回 null。
 */
function findCatalogItem(items, request) {
  // 类型: object。
  // 作用: params 缺失时使用空对象，未提供 contentId 会得到 null。
  const params = request.params && typeof request.params === 'object'
    ? request.params
    : {};

  // 类型: string。
  // 作用: 保存详情或播放目标 id，拒绝隐式转换对象。
  const contentId = typeof params.contentId === 'string' ? params.contentId.trim() : '';

  return items.find(item => item.id === contentId) || null;
}

/**
 * 把受支持网络挑战状态转换为标准 SourceChallenge。
 * 纯函数: 只读取响应 status/requestId 并返回冻结挑战；非挑战状态返回 null。
 *
 * @param {string} sourceId 当前 Provider 真实身份。
 * @param {*} response SourceNetworkResponse 候选。
 * @returns {object|null} 标准 SourceChallenge 或 null。
 */
function createNetworkChallenge(sourceId, response) {
  // 条件分支: 响应不存在、状态不是安全整数或不属于挑战状态时进入。
  // 执行内容: 明确返回 null，不伪造挑战。
  if (!response
    || !Number.isSafeInteger(response.status)
    || !MOCK_SOURCE_CHALLENGE.statusCodes.includes(response.status)) {
    return null;
  }

  return Object.freeze({
    challengeId: `${sourceId}:${MOCK_SOURCE_CHALLENGE.challengeIdSuffix}`,
    sourceId,
    type: MOCK_SOURCE_CHALLENGE.type,
    title: MOCK_SOURCE_CHALLENGE.title,
    image: MOCK_SOURCE_CHALLENGE.image,
    fields: MOCK_SOURCE_CHALLENGE.fields,
    expiresAt: MOCK_SOURCE_CHALLENGE.expiresAt,
    contextKey: MOCK_SOURCE_CHALLENGE.contextKey
  });
}

// 类型: object。
// 作用: 校验 A/B 键控冻结对象后通过 Object.values 合并，并建立精确覆盖四个演示 sourceId 的私有映射。
const AUDITED_DATA_SET_BY_SOURCE_ID = createAuditedDataSetMap([
  ...Object.values(validateDataSetCollection(mockProtocolADataSets, 'mockProtocolADataSets')),
  ...Object.values(validateDataSetCollection(mockProtocolBDataSets, 'mockProtocolBDataSets'))
]);

/**
 * 从工厂私有映射读取受审数据集。
 * 纯函数: 只读取冻结映射，不推断协议或创建兼容别名。
 *
 * @param {*} sourceId Definition.id 候选。
 * @returns {object|null} 匹配冻结数据集；未受审时返回 null。
 */
function createMockSourceProviderFactoryDataSet(sourceId) {
  // 条件分支: sourceId 不是非空字符串或映射未命中时进入。
  // 执行内容: 返回 null，让 supports/create 使用明确门禁结果。
  if (typeof sourceId !== 'string' || !Object.hasOwn(AUDITED_DATA_SET_BY_SOURCE_ID, sourceId)) {
    return null;
  }

  return AUDITED_DATA_SET_BY_SOURCE_ID[sourceId];
}

/**
 * 创建一个独立可信模拟 SourceProvider。
 * 状态副作用: 闭包保存一次性 Context 和私有生命周期；不写 Repository、store 或页面。
 * 网络副作用: 内容、筛选和健康只通过 SourceContext.network 请求受审端点。
 * 存储副作用: 内容和筛选成功后仅向当前 Context cache 分区写小型结构化诊断值。
 * 成功路径: 返回 Host 契约要求的冻结十字段 Provider。
 * 失败路径: 创建输入、生命周期、能力、网络、解码、缓存或挑战失败时明确抛错。
 *
 * @param {object} options Provider 创建选项。
 * @param {object} options.definition SourceDefinition 隔离副本。
 * @param {object} options.dataSet 当前 sourceId 受审数据集。
 * @returns {object} 独立冻结 SourceProvider。
 */
export function createMockSourceProvider(options) {
  // 类型: object。
  // 作用: 保存与调用方引用隔离的最小 Provider 配置。
  const providerOptions = normalizeProviderOptions(options);

  // 类型: string。
  // 作用: 保存当前 Provider 私有生命周期阶段。
  let phase = MOCK_SOURCE_PROVIDER_PHASE.created;

  // 类型: object|null。
  // 作用: 保存 initialize 唯一采用的冻结 SourceContext；dispose 后清空引用。
  let context = null;

  /**
   * 要求 Provider 尚未永久释放。
   * 纯函数: 只读取闭包 phase。
   *
   * @param {string} operationName 当前方法名。
   * @returns {void} 未释放时不返回业务值。
   * @throws {Error} 当 Provider 已 disposed 时抛出。
   */
  function assertNotDisposed(operationName) {
    // 条件分支: 当前实例已永久释放时进入。
    // 执行内容: 拒绝全部后续方法调用。
    if (phase === MOCK_SOURCE_PROVIDER_PHASE.disposed) {
      throw new Error(`模拟 Provider 已释放，不能执行 ${operationName}`);
    }
  }

  /**
   * 要求 Provider 已运行且生命周期未中止。
   * 纯函数: 只读取闭包 phase、Context 和 AbortSignal。
   *
   * @param {string} operationName 当前业务方法名。
   * @returns {object} 当前唯一 SourceContext。
   * @throws {Error} 当阶段不是 running、Context 缺失或 signal 已中止时抛出。
   */
  function requireRunningContext(operationName) {
    assertNotDisposed(operationName);

    // 条件分支: Provider 不是 running 或 Context 缺失时进入。
    // 执行内容: 强制 initialize → start → 业务调用顺序。
    if (phase !== MOCK_SOURCE_PROVIDER_PHASE.running || !context) {
      throw new Error(`模拟 Provider 尚未运行，不能执行 ${operationName}`);
    }

    // 条件分支: Host 已中止共享 signal 时进入。
    // 执行内容: 拒绝停止后的新业务调用和候选结果。
    if (context.signal.aborted) {
      throw new Error(`模拟 Provider 生命周期已中止: ${operationName}`);
    }

    return context;
  }

  /**
   * 校验请求身份、页面和能力。
   * 纯函数: 只读取请求和冻结能力，不修改输入。
   *
   * @param {*} request SourceDataRequest 或 SourceFilterMetaRequest 候选。
   * @param {boolean} filterRequest true 表示筛选元数据请求，false 表示内容请求。
   * @returns {object} 已确认请求原引用。
   * @throws {TypeError} 当请求、身份、页面、params 或能力不符合契约时抛出。
   */
  function validateBusinessRequest(request, filterRequest) {
    // 类型: object。
    // 作用: 确认请求根对象可读取标准字段。
    const safeRequest = assertObject(request, 'provider request');

    // 条件分支: 请求 sourceId 与 Provider 真实身份不一致时进入。
    // 执行内容: 阻止跨源请求借当前 Context 获取数据。
    if (safeRequest.sourceId !== providerOptions.sourceId) {
      throw new TypeError('provider request.sourceId 与 Provider 不一致');
    }

    // 类型: string|undefined。
    // 作用: 把标准请求页面键映射为 Definition 能力字段，播放页固定从 player 映射到 play。
    const capabilityKey = MOCK_SOURCE_PAGE_CAPABILITY[safeRequest.pageKey];

    // 条件分支: pageKey 没有标准页面到能力字段映射时进入。
    // 执行内容: 拒绝未知页面，不能用 Definition 其他 Boolean 字段扩张 Provider 能力。
    if (!capabilityKey) {
      throw new TypeError(`provider request.pageKey 不受支持: ${safeRequest.pageKey || 'unknown'}`);
    }

    // 条件分支: Definition 没有启用当前页面能力时进入。
    // 执行内容: 使用映射后的正式能力键检查，Provider 不用数据存在性或同名猜测绕过声明。
    if (providerOptions.capabilities[capabilityKey] !== true) {
      throw new Error(`数据源未声明页面能力: ${safeRequest.pageKey}`);
    }

    // 条件分支: params 不是非数组对象时进入。
    // 执行内容: 保持响应 request 回填和筛选逻辑字段稳定。
    if (!safeRequest.params || typeof safeRequest.params !== 'object' || Array.isArray(safeRequest.params)) {
      throw new TypeError('provider request.params 必须是对象');
    }

    // 条件分支: 筛选请求不是 movie/tv，或内容请求缺少 moduleKey 字符串时进入。
    // 执行内容: 分别保持 SourceFilterMetaRequest 和 SourceDataRequest 边界。
    if (filterRequest
      ? ![MOCK_SOURCE_PAGE.movie, MOCK_SOURCE_PAGE.tv].includes(safeRequest.pageKey)
      : typeof safeRequest.moduleKey !== 'string') {
      throw new TypeError('provider request 不符合当前业务方法契约');
    }

    return safeRequest;
  }

  /**
   * 请求并解码当前 Provider 完整标准目录。
   * 网络副作用: 只调用当前 Context.network.request(dataSet.catalogUrl)。
   * 成功路径: 返回 sourceId 和 items 精确字段标准目录。
   * 失败路径: 网络状态、解码器或目录契约异常时抛出且不写缓存。
   *
   * @param {object} activeContext 当前 running SourceContext。
   * @returns {Promise<object>} 标准冻结目录。
   */
  async function requestCatalog(activeContext) {
    // 类型: object。
    // 作用: 创建集中策略和精确受审 URL 的 catalog 网络请求。
    const networkRequest = createNetworkRequest(
      providerOptions.sourceId,
      MOCK_SOURCE_NETWORK_OPERATION.catalog,
      providerOptions.dataSet.catalogUrl
    );

    // 类型: object。
    // 作用: 保存 Adapter 返回的隔离原始响应。
    const response = await activeContext.network.request(networkRequest);

    // 类型: object|null。
    // 作用: 保存从当前网络状态识别出的标准挑战；普通响应得到 null。
    const challenge = createNetworkChallenge(providerOptions.sourceId, response);

    // 条件分支: 响应是挑战状态时进入。
    // 执行内容: 只通过 Context.challenge 返回 unsupported/cancelled，再拒绝把响应送入目录解码器。
    if (challenge) {
      await activeContext.challenge.request(challenge);
      throw new Error(`catalog 网络请求需要未解决挑战: ${response.status}`);
    }

    // 类型: object。
    // 作用: 确认成功状态后才允许协议解码器读取 raw body。
    const successfulResponse = assertSuccessfulNetworkResponse(
      response,
      MOCK_SOURCE_NETWORK_OPERATION.catalog
    );

    // 类型: object。
    // 作用: 使用数据集显式解码器清洗 A/B 原始协议，不在 Provider 按 sourceId 分支解析字段。
    const decodedCatalog = providerOptions.dataSet.decodeCatalog(
      decodeJsonResponseBody(successfulResponse.body),
      providerOptions.sourceId
    );

    return normalizeCatalog(decodedCatalog, providerOptions.sourceId);
  }

  /**
   * 写入当前源 cache 分区的小型结构化诊断值。
   * 存储副作用: 只调用绑定 sourceId 的 context.storage.cache.set，不保存目录、响应 body 或敏感值。
   * 成功路径: 返回 Repository/门面隔离后的诊断值。
   * 失败路径: Storage 失败原样抛出，业务响应不被伪装为完整成功。
   *
   * @param {object} activeContext 当前 running SourceContext。
   * @param {string} key 冻结诊断键。
   * @param {string} capability 业务能力名。
   * @param {object} request 当前业务请求。
   * @param {number} itemCount 当前候选或筛选内容数量。
   * @returns {Promise<object>} 保存后的结构化诊断值。
   */
  async function saveCacheDiagnostic(activeContext, key, capability, request, itemCount) {
    return activeContext.storage.cache.set(key, {
      capability,
      pageKey: request.pageKey,
      moduleKey: typeof request.moduleKey === 'string' ? request.moduleKey : '',
      itemCount
    });
  }

  // 返回值类型: object。
  // 作用: 返回 Host 精确契约要求的冻结 Provider，私有状态只能通过闭包访问。
  return Object.freeze({
    // 类型: string。
    // 作用: Provider 唯一真实 sourceId，与 Definition、Context、请求和响应一致。
    id: providerOptions.sourceId,

    /**
     * 一次性采用冻结 SourceContext。
     * 状态副作用: created 成功转换为 initialized，并保存唯一 Context 引用。
     * 成功路径: Context 字段、冻结状态和 sourceId 一致时完成。
     * 失败路径: 重复初始化、Context 不完整、未冻结或身份不一致时抛出。
     *
     * @param {*} sourceContext Host 创建的冻结 SourceContext。
     * @returns {Promise<void>} 初始化完成后结束。
     */
    async initialize(sourceContext) {
      assertNotDisposed('initialize');

      // 条件分支: 当前阶段不是 created 时进入。
      // 执行内容: 同一实例不能重复采用或更换 Context。
      if (phase !== MOCK_SOURCE_PROVIDER_PHASE.created) {
        throw new Error('模拟 Provider 只能初始化一次');
      }

      // 类型: object。
      // 作用: 确认 Context 根对象及六项受控能力存在。
      const safeContext = assertExactFields(
        assertObject(sourceContext, 'sourceContext'),
        ['sourceId', 'network', 'storage', 'challenge', 'logger', 'signal'],
        'sourceContext'
      );

      // 条件分支: Context 未冻结或身份不一致时进入。
      // 执行内容: 拒绝可替换工具箱和跨源能力。
      if (!Object.isFrozen(safeContext) || safeContext.sourceId !== providerOptions.sourceId) {
        throw new TypeError('sourceContext 必须冻结且 sourceId 与 Provider 一致');
      }

      // 条件分支: 受控能力方法或 signal 结构不完整时进入。
      // 执行内容: 在采用 Context 前拒绝半完成工具箱。
      if (typeof safeContext.network?.request !== 'function'
        || typeof safeContext.storage?.cache?.set !== 'function'
        || typeof safeContext.challenge?.request !== 'function'
        || typeof safeContext.logger?.info !== 'function'
        || typeof safeContext.signal?.aborted !== 'boolean') {
        throw new TypeError('sourceContext 受控能力不完整');
      }

      context = safeContext;
      phase = MOCK_SOURCE_PROVIDER_PHASE.initialized;
    },

    /**
     * 把 initialized Provider 转入 running。
     * 状态副作用: 成功后允许业务方法通过唯一 Context 调用能力。
     * 成功路径: Context signal 未中止时进入 running。
     * 失败路径: 未初始化、重复启动、停止后启动或 signal 中止时抛出。
     *
     * @returns {Promise<void>} 启动完成后结束。
     */
    async start() {
      assertNotDisposed('start');

      // 条件分支: 当前阶段不是 initialized 时进入。
      // 执行内容: 强制 initialize 后只启动一次。
      if (phase !== MOCK_SOURCE_PROVIDER_PHASE.initialized) {
        throw new Error('模拟 Provider 必须在 initialize 后启动一次');
      }

      // 条件分支: Context 已被 Host 中止时进入。
      // 执行内容: 不允许中止生命周期进入 running。
      if (context.signal.aborted) {
        throw new Error('模拟 Provider 启动前生命周期已中止');
      }

      phase = MOCK_SOURCE_PROVIDER_PHASE.running;
      context.logger.info('模拟 Provider 已启动', {
        sourceId: providerOptions.sourceId,
        protocolKey: providerOptions.dataSet.protocolKey
      });
    },

    /**
     * 请求并返回标准内容响应。
     * 网络副作用: 每次只通过 context.network 请求同一受审 catalogUrl。
     * 存储副作用: 响应创建后写入小型 content 诊断值，不缓存目录或大响应。
     * 成功路径: 支持首页、电影、电视剧、搜索、详情和播放请求。
     * 失败路径: 生命周期、能力、请求、网络、解码或缓存失败时抛出。
     *
     * @param {*} request SourceDataRequest 候选。
     * @returns {Promise<object>} 标准 SourceDataResponse。
     */
    async fetchData(request) {
      // 类型: object。
      // 作用: 获取当前 running Context 并阻止停止/释放后业务调用。
      const activeContext = requireRunningContext(MOCK_SOURCE_CACHE.contentCapability);

      // 类型: object。
      // 作用: 校验内容请求身份、页面能力、moduleKey 和 params。
      const safeRequest = validateBusinessRequest(request, false);

      // 类型: object。
      // 作用: 从当前源受审端点和解码器获得标准完整目录。
      const catalog = await requestCatalog(activeContext);

      // 类型: object。
      // 作用: 保存列表或单内容标准响应候选。
      let response;

      // 条件分支: detail 或 player 单内容请求时进入。
      // 执行内容: 按 contentId 定位单项并使用单内容响应工具包装。
      if ([MOCK_SOURCE_PAGE.detail, MOCK_SOURCE_PAGE.player].includes(safeRequest.pageKey)) {
        // 类型: object|null。
        // 作用: 保存当前详情或播放目标内容；未命中时响应工具返回 empty。
        const item = findCatalogItem(catalog.items, safeRequest);

        response = createItemSourceDataResponse({
          request: safeRequest,
          item,
          status: MOCK_SOURCE_RESPONSE_STATUS.ready,
          message: `${providerOptions.sourceName} ${safeRequest.pageKey} 内容已返回`
        });
      } else {
        // 类型: Array<object>。
        // 作用: 选择并通用筛选当前列表页面候选，分页由标准响应工具统一执行。
        const candidates = selectListCandidates(catalog.items, safeRequest);

        response = createListSourceDataResponse({
          request: safeRequest,
          items: candidates,
          status: MOCK_SOURCE_RESPONSE_STATUS.ready,
          message: `${providerOptions.sourceName} ${safeRequest.pageKey} 内容已返回`
        });
      }

      // 执行内容: 只保存本次返回条目数量和页面定位，不写原始 body 或完整响应。
      await saveCacheDiagnostic(
        activeContext,
        MOCK_SOURCE_CACHE.contentKey,
        MOCK_SOURCE_CACHE.contentCapability,
        safeRequest,
        response.items.length + (response.item ? 1 : 0)
      );

      return response;
    },

    /**
     * 从同一标准目录统计并返回筛选元数据。
     * 网络副作用: 只通过 context.network 请求与内容相同的 catalogUrl。
     * 存储副作用: 成功后写入小型 filter 诊断值，不建立第二 Provider 或目录缓存。
     * 成功路径: movie/tv 返回类型、地区和年份筛选组。
     * 失败路径: 生命周期、能力、请求、网络、解码或缓存失败时抛出。
     *
     * @param {*} request SourceFilterMetaRequest 候选。
     * @returns {Promise<object>} 标准 SourceFilterMetaResponse。
     */
    async fetchFilterMeta(request) {
      // 类型: object。
      // 作用: 获取当前 running Context 并阻止停止/释放后筛选调用。
      const activeContext = requireRunningContext(MOCK_SOURCE_CACHE.filterCapability);

      // 类型: object。
      // 作用: 校验筛选请求身份、movie/tv 页面、能力和 params。
      const safeRequest = validateBusinessRequest(request, true);

      // 类型: object。
      // 作用: 从与内容请求相同的受审端点获得完整标准目录。
      const catalog = await requestCatalog(activeContext);

      // 类型: Array<object>。
      // 作用: 只使用当前 movie/tv 类型候选统计筛选字段。
      const items = catalog.items.filter(item => item.type === safeRequest.pageKey);

      // 类型: Array<object>。
      // 作用: 从标准 ContentItem.genres/area/year 生成三个筛选组。
      const groups = createFilterGroups(items);

      // 类型: object。
      // 作用: 使用统一响应工具包装筛选请求回填、组和元信息。
      const response = createSourceFilterMetaResponse({
        request: safeRequest,
        groups,
        status: MOCK_SOURCE_RESPONSE_STATUS.ready,
        message: `${providerOptions.sourceName} ${safeRequest.pageKey} 筛选元数据已返回`
      });

      // 执行内容: 保存当前目录候选数量和筛选能力名，不保存 groups 或目录 body。
      await saveCacheDiagnostic(
        activeContext,
        MOCK_SOURCE_CACHE.filterKey,
        MOCK_SOURCE_CACHE.filterCapability,
        safeRequest,
        items.length
      );

      return response;
    },

    /**
     * 请求并解码当前数据源健康结果。
     * 网络副作用: 只通过 context.network 请求 dataSet.healthUrl。
     * 成功路径: 返回数据集解码器创建的标准 SourceHealthCheckResult。
     * 失败路径: 生命周期、网络状态或解码器失败时抛出。
     *
     * @returns {Promise<object>} 标准健康检测结果。
     */
    async checkHealth() {
      // 类型: object。
      // 作用: 获取当前 running Context 并阻止停止/释放后检测。
      const activeContext = requireRunningContext(MOCK_SOURCE_NETWORK_OPERATION.health.capability);

      // 类型: object。
      // 作用: 创建集中策略和精确受审 URL 的健康网络请求。
      const networkRequest = createNetworkRequest(
        providerOptions.sourceId,
        MOCK_SOURCE_NETWORK_OPERATION.health,
        providerOptions.dataSet.healthUrl
      );

      // 类型: object。
      // 作用: 保存 Adapter 返回的隔离健康原始响应。
      const response = await activeContext.network.request(networkRequest);

      // 类型: object|null。
      // 作用: 识别标准网络挑战；非挑战状态返回 null。
      const challenge = createNetworkChallenge(providerOptions.sourceId, response);

      // 条件分支: 健康响应需要挑战时进入。
      // 执行内容: 只通过 Context.challenge 返回占位结果并拒绝伪造健康成功。
      if (challenge) {
        await activeContext.challenge.request(challenge);
        throw new Error(`health 网络请求需要未解决挑战: ${response.status}`);
      }

      // 类型: object。
      // 作用: 只把成功响应 body 交给当前数据集健康解码器。
      const successfulResponse = assertSuccessfulNetworkResponse(
        response,
        MOCK_SOURCE_NETWORK_OPERATION.health
      );

      return providerOptions.dataSet.decodeHealth(
        decodeJsonResponseBody(successfulResponse.body),
        providerOptions.sourceId
      );
    },

    /**
     * 检测网络响应是否包含当前阶段可表达的挑战。
     * 挑战副作用: 命中 401/403 时只调用 context.challenge.request 获取 unsupported/cancelled 占位结果。
     * 成功路径: 非挑战响应返回 null；挑战响应返回标准 SourceChallenge，不伪造 resolved。
     * 失败路径: Provider 未运行或 Context challenge 拒绝输入时抛出。
     *
     * @param {*} response SourceNetworkResponse 候选。
     * @returns {Promise<object|null>} 标准 SourceChallenge 或 null。
     */
    async detectChallenge(response) {
      // 类型: object。
      // 作用: 获取当前 running Context，停止后不能继续挑战流程。
      const activeContext = requireRunningContext('detectChallenge');

      // 类型: object|null。
      // 作用: 只把冻结状态码转换为标准挑战，其他响应明确返回 null。
      const challenge = createNetworkChallenge(providerOptions.sourceId, response);

      // 条件分支: 没有挑战时进入。
      // 执行内容: 不调用 Context challenge，也不伪造对象。
      if (!challenge) {
        return null;
      }

      // 执行内容: 通过 Context 边界取得 unsupported/cancelled 结果；当前阶段不会产生 resolved。
      await activeContext.challenge.request(challenge);
      return challenge;
    },

    /**
     * 通过 Context 挑战边界继续当前挑战。
     * 挑战副作用: 只委托 context.challenge.request，不读取页面表单、全局状态或私有 Repository。
     * 成功路径: 返回 unsupported 或 cancelled 标准占位结果。
     * 失败路径: Provider 未运行或挑战输入不符合 Shell 契约时抛出。
     *
     * @param {*} challengeInput 标准 SourceChallenge 候选。
     * @returns {Promise<object>} SourceChallengeResult 占位结果。
     */
    async continueChallenge(challengeInput) {
      // 类型: object。
      // 作用: 获取当前 running Context，挑战续接不能绕过生命周期。
      const activeContext = requireRunningContext('continueChallenge');
      return activeContext.challenge.request(challengeInput);
    },

    /**
     * 停止 Provider 业务能力。
     * 状态副作用: 任意未释放阶段收敛为 stopped；重复 stop 幂等完成。
     * 成功路径: 停止后所有业务和挑战方法立即拒绝。
     * 失败路径: disposed 实例不能再次停止。
     *
     * @returns {Promise<void>} 停止完成后结束。
     */
    async stop() {
      assertNotDisposed('stop');

      // 条件分支: 已 stopped 时进入。
      // 执行内容: 幂等完成，不改变 Context 或创建新状态。
      if (phase === MOCK_SOURCE_PROVIDER_PHASE.stopped) {
        return;
      }

      phase = MOCK_SOURCE_PROVIDER_PHASE.stopped;
    },

    /**
     * 永久释放 Provider 私有引用。
     * 状态副作用: 清空 Context 并进入 disposed，后续全部方法永久失效。
     * 成功路径: 重复 dispose 幂等完成。
     * 失败路径: 当前实现只释放内存引用，不执行外部资源操作。
     *
     * @returns {Promise<void>} 释放完成后结束。
     */
    async dispose() {
      // 条件分支: 已 disposed 时进入。
      // 执行内容: 幂等完成，不恢复 Context 或生命周期。
      if (phase === MOCK_SOURCE_PROVIDER_PHASE.disposed) {
        return;
      }

      context = null;
      phase = MOCK_SOURCE_PROVIDER_PHASE.disposed;
    }
  });
}

/**
 * 创建项目内可信模拟 Provider 工厂。
 * 纯函数: 返回只含 providerKey、supports 和 create 的冻结新对象。
 * 映射边界: supports 只判断 Definition.id 是否存在于私有受审映射。
 * 创建边界: create 内部定位数据集并调用 createMockSourceProvider，不读取 scriptContent。
 *
 * @returns {object} ProviderFactoryRegistry 可注册的冻结可信工厂。
 */
export function createMockSourceProviderFactory() {
  return Object.freeze({
    // 类型: string。
    // 作用: 工厂唯一注册键，与四个系统源 Definition.providerKey 一致。
    providerKey: MOCK_SOURCE_PROVIDER_KEY,

    /**
     * 判断 Definition 是否具有项目内受审数据集。
     * 纯函数: 只读取 definition.id 和私有冻结映射，不校验来源类型、不推断协议、不创建 Provider。
     *
     * @param {*} definition SourceDefinition 候选。
     * @returns {boolean} true 表示 id 已受审；false 表示输入或映射未命中。
     */
    supports(definition) {
      // 返回值类型: boolean。
      // 作用: 只以受审 sourceId 映射决定支持结果。
      return Boolean(
        definition
        && typeof definition === 'object'
        && !Array.isArray(definition)
        && createMockSourceProviderFactoryDataSet(definition.id)
      );
    },

    /**
     * 根据隔离 Definition 创建独立 Provider。
     * 纯函数: 除创建 Provider 闭包外不修改外部状态；不读取脚本文本、Repository 或 Context。
     * 成功路径: Definition.id 命中受审映射时返回冻结 Provider。
     * 失败路径: options 字段、Definition 或数据集未命中时抛出。
     *
     * @param {*} options 工厂创建选项。
     * @returns {object} 独立统一模拟 SourceProvider。
     */
    create(options) {
      // 类型: object。
      // 作用: 工厂只接受 Host 提供的 Definition，不接受 dataSet 或脚本文本。
      const safeOptions = assertExactFields(
        assertObject(options, 'mockSourceProviderFactory options'),
        MOCK_FACTORY_CREATE_OPTION_FIELDS,
        'mockSourceProviderFactory options'
      );

      // 类型: object。
      // 作用: 确认 Definition 可读取受审 sourceId；其他字段由 Provider 创建边界校验。
      const definition = assertObject(safeOptions.definition, 'definition');

      // 类型: object|null。
      // 作用: 从工厂私有冻结映射定位当前 Definition 唯一数据集。
      const dataSet = createMockSourceProviderFactoryDataSet(definition.id);

      // 条件分支: Definition.id 没有受审数据集时进入。
      // 执行内容: 明确拒绝未知源和 unresolved 自定义脚本。
      if (!dataSet) {
        throw new Error(`模拟 Provider 缺少受审数据集: ${definition.id || 'unknown'}`);
      }

      return createMockSourceProvider({ definition, dataSet });
    }
  });
}
