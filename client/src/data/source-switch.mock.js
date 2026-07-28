/*
  source-switch.mock.js 模块说明

  - 文件职责:
      提供阶段一静态页面顶部数据源切换 tab 的公共 mock 数据。
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
      sourceSwitchData: object，顶部数据源切换 tab 的静态数据对象。
*/

// 类型: object。
// 作用: 保存阶段一顶部数据源 tab 的默认选中源和可展示数据源列表。
// 字段: activeSourceId，string，当前静态布局默认高亮的数据源 id。
// 字段: sources，Array<object>，用于渲染首页、电影页、电视剧页和搜索页顶部数据源 tab。
export const sourceSwitchData = {
  // 类型: string。
  // 作用: 当前静态入口默认使用 Repository 的用户默认源 system-source-1，页面请求和设置页身份保持一致。
  activeSourceId: 'system-source-1',

  // 类型: Array<object>。
  // 作用: 顶部数据源 tab 列表，当前只用于静态展示，不触发真实源请求。
  // 条目字段: id，string，数据源唯一标识，用于 activeSourceId 匹配高亮项。
  // 条目字段: name，string，数据源显示名称，用于 tab 主文案。
  // 条目字段: domain，string，数据源域名或接口标识，用于 tab 次级文案。
  // 条目字段: enabled，boolean，是否启用；true 表示当前源在静态布局中可展示，false 表示后续可隐藏或禁用。
  // 条目字段: status，string，源状态机器字段，当前 ready 用于渲染绿色状态点。
  // 条目字段: capabilities，object，源支持的页面能力，用于后续真实源阶段筛选可用页面。
  sources: [
    {
      // 类型: string。
      // 作用: 系统数据源1 的真实技术 id，页面请求、Repository、Host 和 Provider 共用该身份。
      id: 'system-source-1',

      // 类型: string。
      // 作用: 与设置页一致的模拟数据源展示名称，用于顶部数据源 tab。
      name: '系统数据源1',

      // 类型: string。
      // 作用: 系统数据源1 的受审接口标识，用于辅助区分数据集。
      domain: 'system-source-1.invalid',

      // 类型: boolean。
      // 作用: 控制该源是否在顶部数据源 tab 中展示。
      // true: 当前静态布局展示该源。
      // false: 后续接设置状态后可隐藏或禁用该源。
      enabled: true,

      // 类型: string。
      // 作用: 标记当前源处于可用状态，驱动 tab 右侧绿色状态点。
      status: 'ready',

      // 类型: object。
      // 作用: 描述该源支持哪些页面能力，供后续真实源阶段按页面筛选源列表。
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
    },
    {
      // 类型: string。
      // 作用: 系统数据源2 的真实技术 id。
      id: 'system-source-2',

      // 类型: string。
      // 作用: 与设置页一致的模拟数据源展示名称，用于顶部数据源 tab。
      name: '系统数据源2',

      // 类型: string。
      // 作用: 系统数据源2 的受审接口标识，用于辅助区分数据集。
      domain: 'system-source-2.invalid',

      // 类型: boolean。
      // 作用: 控制该源是否在顶部数据源 tab 中展示。
      // true: 当前静态布局展示该源。
      // false: 后续接设置状态后可隐藏或禁用该源。
      enabled: true,

      // 类型: string。
      // 作用: 标记当前源处于可用状态，驱动 tab 右侧绿色状态点。
      status: 'ready',

      // 类型: object。
      // 作用: 描述该源支持哪些页面能力，供后续真实源阶段按页面筛选源列表。
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
    },
    {
      // 类型: string。
      // 作用: 系统数据源3 的真实技术 id。
      id: 'system-source-3',

      // 类型: string。
      // 作用: 与设置页一致的模拟数据源展示名称，用于顶部数据源 tab。
      name: '系统数据源3',

      // 类型: string。
      // 作用: 系统数据源3 的受审接口标识，用于辅助区分数据集。
      domain: 'system-source-3.invalid',

      // 类型: boolean。
      // 作用: 控制该源是否在顶部数据源 tab 中展示。
      // true: 当前静态布局展示该源。
      // false: 后续接设置状态后可隐藏或禁用该源。
      enabled: true,

      // 类型: string。
      // 作用: 标记当前源处于可用状态，驱动 tab 右侧绿色状态点。
      status: 'ready',

      // 类型: object。
      // 作用: 描述该源支持哪些页面能力，供后续真实源阶段按页面筛选源列表。
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
    },
    {
      // 类型: string。
      // 作用: 系统数据源4 的真实技术 id。
      id: 'system-source-4',

      // 类型: string。
      // 作用: 与设置页一致的模拟数据源展示名称，用于顶部数据源 tab。
      name: '系统数据源4',

      // 类型: string。
      // 作用: 系统数据源4 的受审接口标识，用于辅助区分数据集。
      domain: 'system-source-4.invalid',

      // 类型: boolean。
      // 作用: 控制该源是否在顶部数据源 tab 中展示。
      // true: 当前静态布局展示该源。
      // false: 后续接设置状态后可隐藏或禁用该源。
      enabled: true,

      // 类型: string。
      // 作用: 标记当前源处于可用状态，驱动 tab 右侧绿色状态点。
      status: 'ready',

      // 类型: object。
      // 作用: 描述该源支持哪些页面能力，供后续真实源阶段按页面筛选源列表。
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
