/*
  router/routes.js 模块说明

  - 文件职责:
      集中声明应用正式路由和设置模块嵌套路由派生规则。
      通过 meta.nav 为顶部导航提供唯一入口数据，并保持设置、详情和播放子路由高亮归属。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      设置模块配置，自定义配置，提供模块定义、渲染类型、命名路由和路径枚举。

  - 模块级常量:
      ROUTE_COMPONENT_LOADERS: Readonly<object>，一级路由和设置子页的动态组件加载器。
      routes: Array<object>，Vue Router 原生路由表，同时通过 meta.nav 承载顶部导航展示规则。
      SETTINGS_RENDERER_COMPONENTS: object，设置 renderer 到动态页面加载器的映射。
      SETTINGS_CHILD_PATH_PREFIX: string，设置子路由完整路径前缀。
      settingsModuleRoutes: Array<object>，由 SETTINGS_MODULES 派生的普通设置子路由。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createSettingsModuleRoute(moduleDefinition): object，把单个设置模块定义转换为 Vue Router 子路由。
      resolveSettingsChildPath(routePath): string，把完整设置路径转换为父路由 children 使用的相对路径。

  - 模块级类:
      无

  - 对外导出:
      routes: Array<object>，Vue Router 正式路由表。
*/

import {
  // 导入来源: ../config/settings-module.config。
  // 导入内容: SETTINGS_MODULE_ID 设置模块标识枚举。
  // 文件作用: 给数据源详情路由声明所属设置模块。
  SETTINGS_MODULE_ID,
  // 导入来源: ../config/settings-module.config。
  // 导入内容: SETTINGS_MODULES 设置模块定义数组。
  // 文件作用: 派生普通设置子路由，避免重复维护标题和路径。
  SETTINGS_MODULES,
  // 导入来源: ../config/settings-module.config。
  // 导入内容: SETTINGS_RENDERER 设置模块渲染类型枚举。
  // 文件作用: 把模块定义映射到四个真实设置页面组件。
  SETTINGS_RENDERER,
  // 导入来源: ../config/settings-module.config。
  // 导入内容: SETTINGS_ROUTE_NAME 设置模块命名路由枚举。
  // 文件作用: 声明父路由、子路由、重定向和顶部导航归属。
  SETTINGS_ROUTE_NAME,
  // 导入来源: ../config/settings-module.config。
  // 导入内容: SETTINGS_ROUTE_PATH 设置模块路径枚举。
  // 文件作用: 声明设置父路径和数据源详情动态路径。
  SETTINGS_ROUTE_PATH
} from '../config/settings-module.config';

// 类型: Readonly<object>。
// 作用: 集中保存普通路由和设置子页的动态 import；同一页面复用同一函数身份，路由命中前不进入应用首包。
// 字段: home/movie/tv/search/detail/profile/settings，Function，分别加载对应一级页面；reject 时由 Vue Router 保留导航失败。
// 字段: sourceManagement/sourceDetail/playbackSettings/homeDisplaySettings/shortcutSettings，Function，分别加载对应设置工作区页面。
const ROUTE_COMPONENT_LOADERS = Object.freeze({
  /**
   * 首页路由首次命中时加载 HomeView。
   * 副作用: 触发 Vite 动态模块请求；成功返回页面模块，失败时 Promise reject 并拒绝当前导航。
   * @returns {Promise<object>} HomeView 异步模块。
   */
  home: () => import('../views/HomeView.vue'),
  /**
   * 电影路由首次命中时加载 MovieView。
   * 副作用: 触发目录页面块请求；成功后由 KeepAlive 保留实例，失败时拒绝当前导航。
   * @returns {Promise<object>} MovieView 异步模块。
   */
  movie: () => import('../views/MovieView.vue'),
  /**
   * 电视剧路由首次命中时加载 TVView。
   * 副作用: 触发目录页面块请求；成功后由 KeepAlive 保留实例，失败时拒绝当前导航。
   * @returns {Promise<object>} TVView 异步模块。
   */
  tv: () => import('../views/TVView.vue'),
  /**
   * 搜索路由首次命中时加载 SearchResultView。
   * 副作用: 触发搜索页面块请求；成功返回页面模块，失败时拒绝当前导航。
   * @returns {Promise<object>} SearchResultView 异步模块。
   */
  search: () => import('../views/SearchResultView.vue'),
  /**
   * 为无身份和严格详情路由加载同一个 DetailView。
   * 副作用: 首次调用触发详情页面块请求；成功返回共享模块，失败时拒绝当前导航。
   * @returns {Promise<object>} DetailView 异步模块。
   */
  detail: () => import('../views/DetailView.vue'),
  /**
   * 个人中心首次命中时加载 ProfileView。
   * 副作用: 触发用户内容页面块请求；成功返回页面模块，失败时拒绝当前导航。
   * @returns {Promise<object>} ProfileView 异步模块。
   */
  profile: () => import('../views/ProfileView.vue'),
  /**
   * 设置入口首次命中时加载 SettingsView 外壳。
   * 副作用: 触发设置外壳页面块请求；成功返回页面模块，失败时拒绝当前导航。
   * @returns {Promise<object>} SettingsView 异步模块。
   */
  settings: () => import('../views/SettingsView.vue'),
  /**
   * 数据源管理子路由命中时加载 SourceManagementPanel。
   * 副作用: 触发数据源管理页面块请求；成功返回组件模块，失败时拒绝当前子路由导航。
   * @returns {Promise<object>} SourceManagementPanel 异步模块。
   */
  sourceManagement: () => import('../components/settings/SourceManagementPanel.vue'),
  /**
   * 数据源详情子路由命中时加载 SourceDetailView。
   * 副作用: 触发数据源详情页面块请求；成功返回页面模块，失败时拒绝当前子路由导航。
   * @returns {Promise<object>} SourceDetailView 异步模块。
   */
  sourceDetail: () => import('../views/SourceDetailView.vue'),
  /**
   * 播放设置子路由命中时加载 PlaybackSettingsPanel。
   * 副作用: 触发播放设置页面块请求；成功返回组件模块，失败时拒绝当前子路由导航。
   * @returns {Promise<object>} PlaybackSettingsPanel 异步模块。
   */
  playbackSettings: () => import('../components/settings/PlaybackSettingsPanel.vue'),
  /**
   * 界面设置子路由命中时加载 HomeDisplaySettingsPanel。
   * 副作用: 触发界面设置页面块请求；成功返回组件模块，失败时拒绝当前子路由导航。
   * @returns {Promise<object>} HomeDisplaySettingsPanel 异步模块。
   */
  homeDisplaySettings: () => import('../components/settings/HomeDisplaySettingsPanel.vue'),
  /**
   * 快捷键设置子路由命中时加载 ShortcutSettingsPanel。
   * 副作用: 触发快捷键设置页面块请求；成功返回组件模块，失败时拒绝当前子路由导航。
   * @returns {Promise<object>} ShortcutSettingsPanel 异步模块。
   */
  shortcutSettings: () => import('../components/settings/ShortcutSettingsPanel.vue')
});

// 类型: object。
// 作用: 把设置模块 renderer 映射到真实页面动态加载器；配置只负责导航，组件负责各自领域交互。
const SETTINGS_RENDERER_COMPONENTS = Object.freeze({
  // 类型: Function；作用: 数据源管理 renderer 命中后加载专用列表和操作页面。
  [SETTINGS_RENDERER.sourceManagement]: ROUTE_COMPONENT_LOADERS.sourceManagement,
  // 类型: Function；作用: 播放设置 renderer 命中后加载用户恢复策略页面。
  [SETTINGS_RENDERER.playback]: ROUTE_COMPONENT_LOADERS.playbackSettings,
  // 类型: Function；作用: 界面设置 renderer 命中后加载首页展示偏好页面。
  [SETTINGS_RENDERER.homeDisplay]: ROUTE_COMPONENT_LOADERS.homeDisplaySettings,
  // 类型: Function；作用: 快捷键 renderer 命中后加载项目命令绑定页面。
  [SETTINGS_RENDERER.shortcuts]: ROUTE_COMPONENT_LOADERS.shortcutSettings
});

// 类型: string。
// 作用: 定义设置完整路径转换为相对子路由时需要移除的统一前缀，避免在函数内使用路径长度魔法数字。
const SETTINGS_CHILD_PATH_PREFIX = `${SETTINGS_ROUTE_PATH.root}/`;

/**
 * 把完整设置路径转换为 SettingsView children 使用的相对路径。
 * 纯函数: 不修改输入；路径不属于设置根路径时原样返回，避免生成错误截断结果。
 *
 * @param {string} routePath 设置模块或详情完整浏览器路径。
 * @returns {string} 相对于 `/settings` 父路由的子路径。
 */
function resolveSettingsChildPath(routePath) {
  // 条件分支: 输入以统一设置前缀开头时进入。
  // 执行内容: 移除父路径前缀，确保子路由明确渲染到 SettingsView 的 router-view。
  if (routePath.startsWith(SETTINGS_CHILD_PATH_PREFIX)) {
    return routePath.slice(SETTINGS_CHILD_PATH_PREFIX.length);
  }

  // 返回值类型: string。
  // 作用: 非设置路径保持原样，避免静默截断造成无法诊断的路由。
  return routePath;
}

/**
 * 根据设置模块定义创建 Vue Router 子路由。
 * 纯函数: 相同模块定义返回结构一致的路由对象，不修改 SETTINGS_MODULES。
 * 路由 props 边界: 四个专用页面直接读取各自 Store 或 Service，不注入通用字段对象。
 * 失败路径: renderer 未注册时抛出配置错误，阻止可点击半成品静默进入生产路由。
 *
 * @param {object} moduleDefinition SettingsModuleDefinition 设置模块定义。
 * @returns {object} 可以放入 SettingsView children 的 Vue Router 路由规则。
 */
function createSettingsModuleRoute(moduleDefinition) {
  // 类型: Function。
  // 作用: 根据 renderer 找到真实页面动态加载器；没有映射表示模块定义与发布能力不一致。
  const routeComponent = SETTINGS_RENDERER_COMPONENTS[moduleDefinition.renderer];
  // 条件分支: 配置声明了没有真实页面实现的 renderer 时进入；执行内容: 启动失败关闭，不暴露伪设置入口。
  if (!routeComponent) {
    throw new Error(`未注册设置模块渲染器: ${moduleDefinition.renderer}`);
  }

  // 返回值类型: object。
  // 作用: 路由名称、路径、标题和导航激活态全部直接读取唯一模块配置。
  return {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: resolveSettingsChildPath(moduleDefinition.routePath),
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: moduleDefinition.routeName,
    // 类型: Function。
    // 作用: 路由命中后加载并交给 router-view 渲染的异步页面组件。
    component: routeComponent,
    // 类型: boolean。
    // 作用: 四个真实设置页面只消费各自领域接口，不接收路由生成的通用 props。
    props: false,
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: moduleDefinition.title,
      // 类型: string。
      // 作用: 声明设置子路由归属设置顶部导航入口。
      topNavName: SETTINGS_ROUTE_NAME.root,
      // 类型: string。
      // 作用: 声明当前子路由所属设置模块，用于设置导航激活态。
      settingsModuleId: moduleDefinition.id,
      // 类型: string。
      // 作用: 声明详情等子路由对应的设置模块入口路由。
      settingsRouteName: moduleDefinition.routeName
    }
  };
}

// 类型: Array<object>。
// 作用: 把 SETTINGS_MODULES 定义一次性转换为设置外壳子路由，不在 routes 数组手工重复字段。
const settingsModuleRoutes = SETTINGS_MODULES.map(createSettingsModuleRoute);

// 类型: Array<object>。
// 作用: 集中声明当前 v5 静态页面的正式路由表，并通过 meta.nav 提供顶部导航派生数据。
// 字段: path，string，浏览器地址栏中展示的路径。
// 字段: name，string，命名路由标识，供导航栏和代码跳转使用。
// 字段: component，Function，普通路由命中后动态加载并由 <router-view /> 渲染；播放路由省略该字段并由 App 常驻 PlayerView 消费 URL。
// 字段: meta.title，string，页面标题，用于后续浏览器标题、面包屑或页面标题展示。
// 字段: meta.nav，object，顶部导航配置；存在即表示该路由必须生成顶部导航入口。
// 字段: meta.nav.key，string，导航项唯一标识，用于 v-for 渲染稳定识别。
// 字段: meta.nav.label，string，导航按钮展示文案；当前保留与 title 的重复，确保导航语义独立。
// 字段: meta.nav.order，number，顶部导航排序值，数字越小越靠前。
// 字段: meta.topNavName，string，上下文路由归属的一级导航名称；缺失时使用自身 name。
// 字段: meta.playerLayout，boolean，true 表示 App.vue 显示常驻 PlayerView 并暂停普通 router-view 输出，false 或缺失使用普通文档流。
export const routes = [
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: '/',
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: 'home',
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: ROUTE_COMPONENT_LOADERS.home,
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: '首页',
      // 类型: object。
      // 作用: 顶部导航展示定义；不存在时该路由不生成独立顶部入口。
      nav: {
        // 类型: string。
        // 作用: 顶部导航项唯一标识，用于循环 key 和激活态比较。
        key: 'home',
        // 类型: string。
        // 作用: 顶部导航按钮展示文案。
        label: '首页',
        // 类型: number。
        // 作用: 顶部导航排序值，数字越小越靠前。
        order: 10
      }
    }
  },
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: '/movie',
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: 'movie',
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: ROUTE_COMPONENT_LOADERS.movie,
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: '电影',
      // 类型: object。
      // 作用: 顶部导航展示定义；不存在时该路由不生成独立顶部入口。
      nav: {
        // 类型: string。
        // 作用: 顶部导航项唯一标识，用于循环 key 和激活态比较。
        key: 'movie',
        // 类型: string。
        // 作用: 顶部导航按钮展示文案。
        label: '电影',
        // 类型: number。
        // 作用: 顶部导航排序值，数字越小越靠前。
        order: 20
      }
    }
  },
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: '/tv',
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: 'tv',
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: ROUTE_COMPONENT_LOADERS.tv,
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: '电视剧',
      // 类型: object。
      // 作用: 顶部导航展示定义；不存在时该路由不生成独立顶部入口。
      nav: {
        // 类型: string。
        // 作用: 顶部导航项唯一标识，用于循环 key 和激活态比较。
        key: 'tv',
        // 类型: string。
        // 作用: 顶部导航按钮展示文案。
        label: '电视剧',
        // 类型: number。
        // 作用: 顶部导航排序值，数字越小越靠前。
        order: 30
      }
    }
  },
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: '/search',
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: 'search',
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: ROUTE_COMPONENT_LOADERS.search,
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: '搜索',
      // 类型: object。
      // 作用: 顶部导航展示定义；不存在时该路由不生成独立顶部入口。
      nav: {
        // 类型: string。
        // 作用: 顶部导航项唯一标识，用于循环 key 和激活态比较。
        key: 'search',
        // 类型: string。
        // 作用: 顶部导航按钮展示文案。
        label: '搜索',
        // 类型: number。
        // 作用: 顶部导航排序值，数字越小越靠前。
        order: 40
      }
    }
  },
  {
    // 类型: string。
    // 作用: 提供详情一级导航没有历史地址时的无身份入口。
    path: '/detail',
    // 类型: string。
    // 作用: 详情一级导航命名路由，也是严格详情路由的顶部导航归属。
    name: 'detail-entry',
    // 类型: Vue component。
    // 作用: 复用 DetailView，在缺少身份时展示明确空状态且不请求 Provider。
    component: ROUTE_COMPONENT_LOADERS.detail,
    // 类型: object。
    // 作用: 声明详情一级入口标题和导航位置。
    meta: {
      // 类型: string。
      // 作用: 详情一级入口页面标题。
      title: '详情',
      // 类型: object。
      // 作用: 让详情入口始终参与顶部导航派生。
      nav: {
        // 类型: string。
        // 作用: v-for 稳定键和详情历史槽位身份。
        key: 'detail',
        // 类型: string。
        // 作用: 顶部导航按钮展示文案。
        label: '详情',
        // 类型: number。
        // 作用: 详情位于搜索之后、播放之前。
        order: 50
      }
    }
  },
  {
    // 类型: string。
    // 作用: 只有 URL 携带完整 sourceId 和 videoId 时才请求真实详情。
    path: '/detail/:sourceId/:videoId',
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: 'detail',
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: ROUTE_COMPONENT_LOADERS.detail,
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 严格详情页面标题。
      title: '详情',
      // 类型: string。
      // 作用: 让真实详情地址归属详情一级导航，顶部入口可恢复最近严格地址。
      topNavName: 'detail-entry'
    }
  },
  {
    // 类型: string。
    // 作用: 提供不携带内容身份的播放一级入口，只展示有意空状态。
    path: '/player',
    // 类型: string。
    // 作用: 播放一级入口命名路由，也是严格播放路由的顶部导航归属。
    name: 'player-entry',
    // 类型: object。
    // 作用: 声明标题、播放器根布局和一级导航配置。
    meta: {
      // 类型: string；作用: 播放一级入口页面标题。
      title: '播放',
      // 类型: boolean；true 使用播放器一屏外壳，false 不适用；当前入口固定为 true。
      playerLayout: true,
      // 类型: object；作用: 让播放入口参与全站一级导航派生。
      nav: {
        // 类型: string；作用: 一级导航循环稳定键。
        key: 'player',
        // 类型: string；作用: 一级导航展示文案。
        label: '播放',
        // 类型: number；作用: 排在详情之后、个人中心之前。
        order: 60
      }
    }
  },
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: '/player/:sourceId/:videoId',
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: 'player',
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 严格真实播放页面标题。
      title: '播放页',
      // 类型: string；作用: 让真实播放 URL 继续高亮不携带身份的播放一级入口。
      topNavName: 'player-entry',
      // 类型: boolean；true 使用播放器一屏外壳，false 不适用；真实播放固定为 true。
      playerLayout: true
    }
  },
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: '/profile',
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: 'profile',
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: ROUTE_COMPONENT_LOADERS.profile,
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: '个人中心',
      // 类型: object。
      // 作用: 顶部导航展示定义；不存在时该路由不生成独立顶部入口。
      nav: {
        // 类型: string。
        // 作用: 顶部导航项唯一标识，用于循环 key 和激活态比较。
        key: 'profile',
        // 类型: string。
        // 作用: 顶部导航按钮展示文案。
        label: '个人中心',
        // 类型: number。
        // 作用: 顶部导航排序值，数字越小越靠前。
        order: 70
      }
    }
  },
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: SETTINGS_ROUTE_PATH.root,
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: SETTINGS_ROUTE_NAME.root,
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: ROUTE_COMPONENT_LOADERS.settings,
    // 类型: object。
    // 作用: 当前路由命中后使用命名路由执行重定向。
    redirect: {
      // 类型: string。
      // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
      name: SETTINGS_ROUTE_NAME.sources
    },
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: '设置',
      // 类型: object。
      // 作用: 顶部导航展示定义；不存在时该路由不生成独立顶部入口。
      nav: {
        // 类型: string。
        // 作用: 顶部导航项唯一标识，用于循环 key 和激活态比较。
        key: 'settings',
        // 类型: string。
        // 作用: 顶部导航按钮展示文案。
        label: '设置',
        // 类型: number。
        // 作用: 顶部导航排序值，数字越小越靠前。
        order: 80
      }
    },
    // 类型: Array<object>。
    // 作用: SettingsView 嵌套路由数组，渲染到设置工作区 router-view。
    children: [
      ...settingsModuleRoutes,
      {
        // 类型: string。
        // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
        path: resolveSettingsChildPath(SETTINGS_ROUTE_PATH.sourceDetail),
        // 类型: string。
        // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
        name: SETTINGS_ROUTE_NAME.sourceDetail,
        // 类型: Vue component。
        // 作用: 路由命中后由 router-view 渲染的页面组件。
        component: ROUTE_COMPONENT_LOADERS.sourceDetail,
        // 类型: object。
        // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
        meta: {
          // 类型: string。
          // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
          title: '数据源详情',
          // 类型: string。
          // 作用: 声明设置子路由归属设置顶部导航入口。
          topNavName: SETTINGS_ROUTE_NAME.root,
          // 类型: string。
          // 作用: 声明当前子路由所属设置模块，用于设置导航激活态。
          settingsModuleId: SETTINGS_MODULE_ID.sources,
          // 类型: string。
          // 作用: 声明详情等子路由对应的设置模块入口路由。
          settingsRouteName: SETTINGS_ROUTE_NAME.sources
        }
      }
    ]
  },
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: '*',
    // 类型: object。
    // 作用: 当前路由命中后使用命名路由执行重定向。
    redirect: {
      // 类型: string。
      // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
      name: 'home'
    },
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: '未知页面'
    }
  }
];
