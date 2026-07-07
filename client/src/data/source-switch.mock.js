/*
  source-switch.mock.js 模块说明

  - 文件职责:
      提供静态页面顶部数据源切换 tab 的公共演示数据。
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
      sourceSwitchData: object，顶部数据源切换 tab 的静态演示数据对象。
*/

// 类型: object。
// 作用: 保存顶部数据源 tab 的默认选中源和可展示数据源列表。
// 字段: activeSourceId，string，当前静态布局默认高亮的数据源 id。
// 字段: sources，Array<object>，用于渲染首页、电影页、电视剧页和搜索页顶部数据源 tab。
export const sourceSwitchData = {
  // 类型: string。
  // 作用: 默认高亮的演示数据源标识，驱动 SourceSwitchTabs 的选中态。
  activeSourceId: 'mock1',

  // 类型: Array<object>。
  // 作用: 顶部数据源 tab 列表，当前只用于静态展示，不触发外部请求。
  // 条目字段: id，string，数据源唯一标识，用于 activeSourceId 匹配高亮项。
  // 条目字段: name，string，数据源显示名称，用于 tab 主文案。
  // 条目字段: domain，string，数据源域名或接口标识，用于 tab 次级文案。
  // 条目字段: enabled，boolean，是否启用；true 表示当前源在静态布局中可展示，false 表示可隐藏或禁用。
  // 条目字段: status，string，源状态机器字段，当前 ready 用于渲染绿色状态点。
  // 条目字段: capabilities，object，源支持的页面能力，用于后续按页面筛选可用源。
  sources: [
    {
      // 类型: string。
      // 作用: 演示数据源唯一标识，用于顶部 tab 选中态和页面来源字段保持一致。
      id: 'mock1',

      // 类型: string。
      // 作用: 演示数据源展示名称，用于顶部数据源 tab。
      name: '模拟源1',

      // 类型: string。
      // 作用: 演示数据源域名标识，用于辅助用户识别当前源。
      domain: 'com.mock1',

      // 类型: boolean。
      // 作用: 控制该源是否在顶部数据源 tab 中展示。
      // true: 当前静态布局展示该源。
      // false: 后续接设置状态后可隐藏或禁用该源。
      enabled: true,

      // 类型: string。
      // 作用: 标记当前演示源处于可用状态，驱动 tab 右侧绿色状态点。
      status: 'ready',

      // 类型: object。
      // 作用: 描述该源支持哪些页面能力，供后续按页面筛选源列表。
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
