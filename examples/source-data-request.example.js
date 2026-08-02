/*
  source-data-request.example.js 样板文件说明

  - 文件职责:
      展示页面请求 provider 时使用的标准请求结构。
      供页面、服务层和数据源 provider 对齐请求字段。

  - 样板范围:
      首页模块请求。
      目录列表请求。
      单内容请求。
*/

// 类型: object。
// 作用: 标准数据请求对象，页面通过该对象声明需要哪个数据源、哪个页面、哪个模块和哪些参数。
// 字段: sourceId，string，目标数据源唯一标识。
// 字段: pageKey，string，目标页面标识，例如 home、movie、tv、search、detail、player。
// 字段: moduleKey，string，页面模块标识；首页需要填写，单列表页和单内容页可为空。
// 字段: params，object，请求参数集合，常见字段包括 page、pageSize、keyword、contentId、episodeId。
export const sourceDataRequestExample = {
  sourceId: 'system-source-1',
  pageKey: 'home',
  moduleKey: 'hotMovies',
  params: {
    page: 1,
    pageSize: 10
  }
};

// 类型: object。
// 作用: 详情页或播放页的单内容请求样板。
export const singleContentRequestExample = {
  sourceId: 'system-source-1',
  pageKey: 'detail',
  moduleKey: '',
  params: {
    contentId: 'movie-001'
  }
};
