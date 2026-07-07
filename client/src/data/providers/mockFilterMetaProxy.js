/*
  mockFilterMetaProxy.js 模块说明

  - 文件职责:
      提供 当前项目 筛选元数据主干在 mock 阶段的中间代理。
      接收 SourceFilterMetaRequest，向 mock 内容 provider 请求当前页面全部候选内容，统计类型、地区、年份等字段后返回标准 SourceFilterMetaResponse。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      mockSourceData: 自定义数据，提供当前 mock 数据源基础信息。
      getMockListPageCandidates: 自定义服务，读取指定列表页面的完整候选内容数组。
      createSourceFilterMetaResponse: 自定义工具函数，创建标准筛选元数据响应对象。

  - 模块级常量:
      SUPPORTED_FILTER_PAGE_KEYS: Array<string>，当前支持动态筛选元数据的页面名称。
      SORT_FILTER_GROUP: object，固定排序筛选组定义。
      mockFilterMetaProxy: object，mock 阶段筛选元数据 provider。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createCountMap(values)
          - params:
              -- values: Array<string>，候选字段数组。
          - return:
              Map<string, number>，字段值和出现次数映射。
          - description:
              为类型、地区和年份统计每个字段的内容数量。
      createAllOption(totalCount)
          - params:
              -- totalCount: number，当前候选内容总数。
          - return:
              object，筛选组中的“全部”选项。
          - description:
              统一生成 count 和默认值都稳定的全部选项。
      createOptionList(countMap, transformer)
          - params:
              -- countMap: Map<string, number>，字段值统计映射。
              -- transformer: Function，单个字段值转换函数。
          - return:
              Array<object>，排序后的筛选项数组。
          - description:
              把字段统计映射转成标准筛选项数组。
      createGenreGroup(items)
          - params:
              -- items: Array<object>，当前页面候选内容数组。
          - return:
              object，类型筛选组。
          - description:
              从候选内容的 genres 字段中统计电影或电视剧类型筛选项。
      createAreaGroup(items)
          - params:
              -- items: Array<object>，当前页面候选内容数组。
          - return:
              object，地区筛选组。
          - description:
              从候选内容的 area 字段中统计地区筛选项。
      createYearGroup(items)
          - params:
              -- items: Array<object>，当前页面候选内容数组。
          - return:
              object，年份筛选组。
          - description:
              从候选内容的 year 字段中统计年份筛选项。
      createGroupsByPageKey(pageKey, items)
          - params:
              -- pageKey: string，当前请求页面。
              -- items: Array<object>，当前页面候选内容数组。
          - return:
              Array<object>，筛选组数组。
          - description:
              根据页面类型组合需要返回的筛选组。

  - 模块级类:
      无

  - 对外导出:
      mockFilterMetaProxy: object，mock 阶段筛选元数据 provider。
*/

// 导入来源: ../mock-source.mock。
// 导入内容: mockSourceData mock 数据源完整数据对象。
// 文件作用: 用于读取当前 mock 数据源基础信息，保持 provider id 和 sourceId 一致。
import { mockSourceData } from '../mock-source.mock.js';

// 导入来源: ./mockSourceProvider。
// 导入内容: getMockListPageCandidates 列表页面完整候选读取函数。
// 文件作用: mock 筛选元数据代理通过它拿到电影页、电视剧页或搜索页的全量候选内容。
import { getMockListPageCandidates } from './mockSourceProvider.js';

// 导入来源: ../../utils/sourceFilterMetaResponse。
// 导入内容: createSourceFilterMetaResponse 筛选元数据响应创建函数。
// 文件作用: 把字段统计结果整理成标准 SourceFilterMetaResponse。
import { createSourceFilterMetaResponse } from '../../utils/sourceFilterMetaResponse.js';

// 类型: Array<string>。
// 作用: 当前支持动态筛选元数据的页面清单，先覆盖 movie、tv 和 search。
const SUPPORTED_FILTER_PAGE_KEYS = ['movie', 'tv', 'search'];

// 类型: object。
// 作用: 排序筛选组不是从内容字段统计出来的，而是由程序定义的固定规则组选项。
const SORT_FILTER_GROUP = {
  name: 'sort',
  label: '排序',
  options: [
    { label: '最新', value: 'latest', count: 0, active: false },
    { label: '最热', value: 'hot', count: 0, active: false },
    { label: '评分', value: 'score', count: 0, active: false }
  ]
};

/**
 * 统计字段值数量。
 * 纯函数: 只根据 values 创建新的 Map，不修改输入数组。
 *
 * @param {Array<string>} values 候选字段数组。
 * @returns {Map<string, number>} 字段值和出现次数映射。
 */
function createCountMap(values) {
  // 类型: Map<string, number>。
  // 作用: 保存字段值和数量统计结果。
  const countMap = new Map();

  // 条件分支: 输入不是数组时进入。
  // 执行内容: 直接返回空映射，让调用方按空筛选组处理。
  if (!Array.isArray(values)) {
    return countMap;
  }

  // 遍历字段数组，把每个非空字段的数量累加到映射中。
  values.forEach((value) => {
    // 类型: string。
    // 作用: 统一去掉首尾空白，避免同名字段因空格差异分裂成两项。
    const normalizedValue = String(value || '').trim();

    // 条件分支: 字段值为空时进入。
    // 执行内容: 跳过空值，不生成空白筛选按钮。
    if (!normalizedValue) {
      return;
    }

    // 类型: number。
    // 作用: 读取当前字段值已累计的数量，没有时从 0 开始。
    const currentCount = countMap.get(normalizedValue) || 0;

    // 副作用: 更新当前字段值的数量统计。
    countMap.set(normalizedValue, currentCount + 1);
  });

  // 返回值类型: Map<string, number>。
  // 作用: 返回字段值统计映射，供筛选组选项生成逻辑使用。
  return countMap;
}

/**
 * 创建“全部”筛选项。
 * 纯函数: 只根据 totalCount 创建新对象。
 *
 * @param {number} totalCount 当前候选内容总数。
 * @returns {object} 筛选组中的全部选项。
 */
function createAllOption(totalCount) {
  // 返回值类型: object。
  // 作用: 统一为每个筛选组补齐“全部”项，且默认处于激活状态。
  return {
    label: '全部',
    value: 'all',
    count: totalCount,
    active: false
  };
}

/**
 * 把数量映射转成筛选项数组。
 * 纯函数: 只读取 countMap 和 transformer，不修改映射。
 *
 * @param {Map<string, number>} countMap 字段值统计映射。
 * @param {Function} transformer 单个字段值转换函数。
 * @returns {Array<object>} 筛选项数组。
 */
function createOptionList(countMap, transformer) {
  // 类型: Array<[string, number]>。
  // 作用: 把数量映射转成可排序的键值对数组。
  const entryList = Array.from(countMap.entries());

  // 类型: Array<[string, number]>。
  // 作用: 按数量降序、名称升序排序，让出现更多的筛选项排在前面。
  const sortedEntries = entryList.sort((previousEntry, nextEntry) => {
    if (nextEntry[1] !== previousEntry[1]) {
      return nextEntry[1] - previousEntry[1];
    }

    return previousEntry[0].localeCompare(nextEntry[0], 'zh-Hans-CN');
  });

  // 返回值类型: Array<object>。
  // 作用: 把统计结果转换成 CatalogFilterBar 可直接渲染的标准筛选项。
  return sortedEntries.map(([value, count]) => transformer(value, count));
}

/**
 * 创建类型筛选组。
 * 纯函数: 只根据 items 创建新对象，不修改内容对象。
 *
 * @param {Array<object>} items 当前页面候选内容数组。
 * @returns {object} 类型筛选组。
 */
function createGenreGroup(items) {
  // 类型: Array<object>。
  // 作用: 非数组兜底为空数组，避免 flatMap 调用异常。
  const safeItems = Array.isArray(items) ? items : [];

  // 类型: Array<string>。
  // 作用: 收集候选内容中的所有类型值，供后续统计按钮数量。
  const genreValues = safeItems.flatMap(item => Array.isArray(item.genres) ? item.genres : []);

  // 类型: Map<string, number>。
  // 作用: 统计每个类型值出现的次数。
  const countMap = createCountMap(genreValues);

  // 返回值类型: object。
  // 作用: 返回标准类型筛选组，当前电影页和电视剧页都会读取这一组。
  return {
    name: 'genre',
    label: '类型',
    options: [
      createAllOption(safeItems.length),
      ...createOptionList(countMap, (value, count) => ({
        label: value,
        value,
        count,
        active: false
      }))
    ]
  };
}

/**
 * 创建地区筛选组。
 * 纯函数: 只根据 items 创建新对象，不修改内容对象。
 *
 * @param {Array<object>} items 当前页面候选内容数组。
 * @returns {object} 地区筛选组。
 */
function createAreaGroup(items) {
  // 类型: Array<object>。
  // 作用: 非数组兜底为空数组，避免 map 调用异常。
  const safeItems = Array.isArray(items) ? items : [];

  // 类型: Array<string>。
  // 作用: 收集候选内容中的地区值，供后续统计按钮数量。
  const areaValues = safeItems.map(item => item.area);

  // 类型: Map<string, number>。
  // 作用: 统计每个地区值出现的次数。
  const countMap = createCountMap(areaValues);

  // 返回值类型: object。
  // 作用: 返回标准地区筛选组，供电影页或电视剧页渲染。
  return {
    name: 'area',
    label: '地区',
    options: [
      createAllOption(safeItems.length),
      ...createOptionList(countMap, (value, count) => ({
        label: value,
        value,
        count,
        active: false
      }))
    ]
  };
}

/**
 * 创建年份筛选组。
 * 纯函数: 只根据 items 创建新对象，不修改内容对象。
 *
 * @param {Array<object>} items 当前页面候选内容数组。
 * @returns {object} 年份筛选组。
 */
function createYearGroup(items) {
  // 类型: Array<object>。
  // 作用: 非数组兜底为空数组，避免 map 调用异常。
  const safeItems = Array.isArray(items) ? items : [];

  // 类型: Array<string>。
  // 作用: 收集候选内容中的年份值，供后续统计按钮数量。
  const yearValues = safeItems.map(item => item.year);

  // 类型: Map<string, number>。
  // 作用: 统计每个年份值出现的次数。
  const countMap = createCountMap(yearValues);

  // 类型: Array<[string, number]>。
  // 作用: 把映射转成数组并按年份降序排列，让最近年份排在前面。
  const sortedEntries = Array.from(countMap.entries()).sort((previousEntry, nextEntry) => Number(nextEntry[0]) - Number(previousEntry[0]));

  // 返回值类型: object。
  // 作用: 返回标准年份筛选组，供电影页或电视剧页渲染。
  return {
    name: 'year',
    label: '年份',
    options: [
      createAllOption(safeItems.length),
      ...sortedEntries.map(([value, count]) => ({
        label: value,
        value,
        count,
        active: false
      }))
    ]
  };
}

/**
 * 根据页面创建筛选组数组。
 * 纯函数: 只根据 pageKey 和 items 返回新数组，不修改输入内容。
 *
 * @param {string} pageKey 当前请求页面。
 * @param {Array<object>} items 当前页面候选内容数组。
 * @returns {Array<object>} 筛选组数组。
 */
function createGroupsByPageKey(pageKey, items) {
  // 条件分支: pageKey 不在支持列表中时进入。
  // 执行内容: 返回空数组，让调用方把错误留给上层校验。
  if (!SUPPORTED_FILTER_PAGE_KEYS.includes(pageKey)) {
    return [];
  }

  // 返回值类型: Array<object>。
  // 作用: 当前项目统一返回类型、地区、年份和排序四组筛选元数据。
  return [
    createGenreGroup(items),
    createAreaGroup(items),
    createYearGroup(items),
    {
      ...SORT_FILTER_GROUP,
      options: SORT_FILTER_GROUP.options.map(option => ({
        ...option
      }))
    }
  ];
}

// 类型: object。
// 作用: mock 阶段筛选元数据 provider，模拟外部数据源脚本直接返回筛选分类字段。
export const mockFilterMetaProxy = {
  // 类型: string。
  // 作用: provider 唯一标识，应和 mock 数据源 id 保持一致。
  id: mockSourceData.source.id,

  // 类型: string。
  // 作用: provider 展示名称，便于调试当前筛选元数据来源。
  name: `${mockSourceData.source.name}-filter-meta`,

  /**
   * 根据标准请求返回标准筛选元数据响应。
   * 纯函数: 当前 mock 代理只读取本地数据并返回响应，不发起网络请求。
   *
   * @param {object} request 标准 SourceFilterMetaRequest。
   * @param {string} request.sourceId 请求目标数据源 id。
   * @param {string} request.pageKey 请求目标页面。
   * @returns {Promise<object>} 标准 SourceFilterMetaResponse。
   * @throws {Error} 当 pageKey 不受支持时抛出。
   */
  async fetchFilterMeta(request) {
    // 类型: object。
    // 作用: request 不是对象时使用空对象兜底，错误路径会给出清晰未实现提示。
    const safeRequest = request && typeof request === 'object' ? request : {};

    // 类型: string。
    // 作用: 当前筛选元数据目标页面。
    const pageKey = safeRequest.pageKey || '';

    // 条件分支: pageKey 不在支持列表中时进入。
    // 执行内容: 抛出错误，提示当前 mock 代理尚未实现该页面筛选元数据。
    if (!SUPPORTED_FILTER_PAGE_KEYS.includes(pageKey)) {
      throw new Error(`mock 筛选元数据页面未实现: ${pageKey || 'unknown'}`);
    }

    // 类型: Array<object>。
    // 作用: 读取当前页面完整候选内容列表，供统计动态筛选字段使用。
    const items = getMockListPageCandidates(pageKey);

    // 类型: Array<object>。
    // 作用: 根据页面候选内容生成动态筛选组。
    const groups = createGroupsByPageKey(pageKey, items);

    // 返回值类型: object。
    // 作用: 返回标准筛选元数据响应，后续由 sourceFilterService 写入 siteFilterStore。
    return createSourceFilterMetaResponse({
      request: safeRequest,
      groups,
      message: `mock ${pageKey} 筛选元数据已返回`
    });
  }
};

// 导出类型: default object。
// 导出内容: mock 阶段筛选元数据 provider。
// 外部调用方: sourceFilterService。
// 使用场景: mock 阶段把内容候选统计成 CatalogFilterBar 需要的动态筛选字段。
export default mockFilterMetaProxy;
