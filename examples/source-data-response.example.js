/*
  source-data-response.example.js 样板文件说明

  - 文件职责:
      展示 provider 返回给 sourceDataService 的标准响应结构。
      供数据源 provider、服务层和页面数据桶对齐响应字段。

  - 样板范围:
      列表型响应。
      单内容响应。
*/

// 类型: object。
// 作用: 列表型标准响应样板，适用于首页模块、电影页、电视剧页和搜索页。
// 字段: sourceId，string，响应所属数据源。
// 字段: pageKey，string，响应所属页面。
// 字段: moduleKey，string，响应所属页面模块。
// 字段: request，object，原始标准请求回填，用于刷新和调试。
// 字段: pagination，object，分页信息。
// 字段: items，Array<object>，当前页内容列表。
// 字段: item，null，列表型响应不使用单内容字段。
// 字段: meta，object，响应状态、说明和请求时间。
export const listSourceDataResponseExample = {
  sourceId: 'mock1',
  pageKey: 'movie',
  moduleKey: '',
  request: {
    sourceId: 'mock1',
    pageKey: 'movie',
    moduleKey: '',
    params: {
      page: 1,
      pageSize: 20
    }
  },
  pagination: {
    page: 1,
    pageSize: 20,
    total: 5,
    totalPages: 1,
    hasMore: false
  },
  items: [],
  item: null,
  meta: {
    status: 'ready',
    message: '模拟源1列表数据已返回',
    fetchedAt: '2026-07-07T00:00:00.000Z'
  }
};

// 类型: object。
// 作用: 单内容标准响应样板，适用于详情页和播放页。
export const itemSourceDataResponseExample = {
  sourceId: 'mock1',
  pageKey: 'detail',
  moduleKey: '',
  request: {
    sourceId: 'mock1',
    pageKey: 'detail',
    moduleKey: '',
    params: {
      contentId: 'movie-001'
    }
  },
  pagination: null,
  items: [],
  item: null,
  meta: {
    status: 'ready',
    message: '模拟源1详情数据已返回',
    fetchedAt: '2026-07-07T00:00:00.000Z'
  }
};
