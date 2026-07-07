/*
  source-switch.mock.js 模块说明

  - 文件职责:
      提供公开演示环境顶部数据源切换 tab 的公共 mock 数据。
      供首页、电影页、电视剧页和搜索页渲染统一的数据源入口。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      sourceSwitchData: object，顶部数据源切换 tab 的演示数据对象。
*/

// 类型: object。
// 作用: 保存顶部数据源 tab 的默认选中源和可展示数据源列表。
// 字段: activeSourceId，string，当前默认高亮的数据源 id。
// 字段: sources，Array<object>，用于渲染首页、电影页、电视剧页和搜索页顶部数据源 tab。
export const sourceSwitchData = {
  // 类型: string。
  // 作用: 默认高亮模拟源1，和当前公开演示数据源保持一致。
  activeSourceId: 'mock1',

  // 类型: Array<object>。
  // 作用: 顶部数据源 tab 列表，当前公开项目只保留一个占位演示源。
  // 条目字段: id，string，数据源唯一标识，用于 activeSourceId 匹配高亮项。
  // 条目字段: name，string，数据源显示名称，用于 tab 主文案。
  // 条目字段: domain，string，数据源域名或接口标识，用于 tab 次级文案。
  // 条目字段: enabled，boolean，是否启用；true 表示当前源可展示和请求。
  // 条目字段: status，string，源状态机器字段，当前 ready 用于渲染绿色状态点。
  // 条目字段: capabilities，object，源支持的页面能力，用于按页面筛选可用源。
  sources: [
    {
      // 类型: string。
      // 作用: 模拟源1唯一标识，页面请求和数据源切换都使用该值。
      id: 'mock1',

      // 类型: string。
      // 作用: 模拟源1展示名称，用于顶部数据源 tab。
      name: '模拟源1',

      // 类型: string。
      // 作用: 模拟源1域名标识，用于辅助用户识别当前来源。
      domain: 'com.mock1',

      // 类型: boolean。
      // 作用: 控制该源是否在顶部数据源 tab 中展示。
      // true: 当前公开演示展示该源。
      // false: 接入源管理后可隐藏或禁用该源。
      enabled: true,

      // 类型: string。
      // 作用: 标记当前源处于可用状态，驱动 tab 右侧绿色状态点。
      status: 'ready',

      // 类型: object。
      // 作用: 描述该源支持哪些页面能力，供页面按能力读取数据源列表。
      capabilities: {
        // 类型: boolean。
        // 作用: true 表示该源支持首页数据。
        home: true,

        // 类型: boolean。
        // 作用: true 表示该源支持电影页数据。
        movie: true,

        // 类型: boolean。
        // 作用: true 表示该源支持电视剧页数据。
        tv: true,

        // 类型: boolean。
        // 作用: true 表示该源支持搜索页数据。
        search: true
      }
    }
  ]
};
