/*
  routes.js 模块说明

  - 文件职责:
      集中声明应用正式路由和设置模块嵌套路由派生规则。
      通过 meta.nav 为顶部导航提供唯一入口数据，并保持设置子路由高亮归属。

  - 导入库及文件汇总(12 条，内置 0 条，第三方 0 条，自定义 12 条):
      HomeView，自定义页面组件，作为首页路由渲染内容。
      MovieView，自定义页面组件，作为电影页路由渲染内容。
      TVView，自定义页面组件，作为电视剧页路由渲染内容。
      SearchResultView，自定义页面组件，作为搜索结果页路由渲染内容。
      DetailView，自定义页面组件，作为详情页路由渲染内容。
      PlayerView，自定义页面组件，作为播放页路由渲染内容。
      ProfileView，自定义页面组件，作为个人中心页路由渲染内容。
      SettingsView，自定义页面组件，作为设置页路由渲染内容。
      SourceManagementPanel，自定义业务组件，作为数据源列表子路由渲染内容。
      SourceDetailView，自定义页面组件，作为数据源详情子路由渲染内容。
      SettingsEmptyPanel，自定义业务组件，作为普通设置空内容子路由渲染内容。
      设置模块配置，自定义配置，提供模块定义、渲染类型、命名路由和路径枚举。

  - 模块级常量:
      routes: Array<object>，Vue Router 原生路由表，同时通过 meta.nav 承载顶部导航展示规则。
      SETTINGS_RENDERER_COMPONENTS: object，设置 renderer 到真实页面组件的映射。
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

// 导入来源: 首页页面组件。
// 导入内容: HomeView。
// 文件作用: 绑定到 home 命名路由，作为根路径 `/` 的主体页面。

import HomeView from '../views/HomeView.vue';

// 导入来源: 电影页面组件。
// 导入内容: MovieView。
// 文件作用: 绑定到 movie 命名路由，作为 `/movie` 的主体页面。

import MovieView from '../views/MovieView.vue';

// 导入来源: 电视剧页面组件。
// 导入内容: TVView。
// 文件作用: 绑定到 tv 命名路由，作为 `/tv` 的主体页面。

import TVView from '../views/TVView.vue';

// 导入来源: 搜索结果页面组件。
// 导入内容: SearchResultView。
// 文件作用: 绑定到 search 命名路由，作为 `/search` 的主体页面。

import SearchResultView from '../views/SearchResultView.vue';

// 导入来源: 详情页面组件。
// 导入内容: DetailView。
// 文件作用: 绑定到 detail 命名路由，作为 `/detail/:sourceId?/:videoId?` 的主体页面。

import DetailView from '../views/DetailView.vue';

// 导入来源: 播放页面组件。
// 导入内容: PlayerView。
// 文件作用: 绑定到 player 命名路由，作为 `/player/:sourceId?/:videoId?` 的主体页面。

import PlayerView from '../views/PlayerView.vue';

// 导入来源: 个人中心页面组件。
// 导入内容: ProfileView。
// 文件作用: 绑定到 profile 命名路由，作为 `/profile` 的主体页面。

import ProfileView from '../views/ProfileView.vue';

// 导入来源: 设置页面组件。
// 导入内容: SettingsView。
// 文件作用: 绑定到 settings 命名路由，作为 `/settings` 的主体页面。

import SettingsView from '../views/SettingsView.vue';

// 导入来源: 数据源管理主页面组件。
// 导入内容: SourceManagementPanel。
// 文件作用: 绑定到 `/settings/sources` 子路由，渲染单行数据源列表和管理操作。

import SourceManagementPanel from '../components/settings/SourceManagementPanel.vue';

// 导入来源: 数据源详情页面组件。
// 导入内容: SourceDetailView。
// 文件作用: 绑定到 `/settings/sources/:sourceId` 子路由，渲染独立数据源详情。

import SourceDetailView from '../views/SourceDetailView.vue';

// 导入来源: 普通设置空内容组件。
// 导入内容: SettingsEmptyPanel。
// 文件作用: 供播放设置、快捷键设置和全局配置三个子路由复用真实空状态。

import SettingsEmptyPanel from '../components/settings/SettingsEmptyPanel.vue';

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
  // 文件作用: 把模块定义映射到专用页面或统一空内容组件。
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

// 类型: object。
// 作用: 把设置模块 renderer 映射到真实页面组件；复杂数据源模块与普通空模块保持清晰边界。
const SETTINGS_RENDERER_COMPONENTS = Object.freeze({
  // 类型: Vue component；作用: 数据源管理 renderer 使用专用列表和操作页面。
  [SETTINGS_RENDERER.sourceManagement]: SourceManagementPanel,
  // 类型: Vue component；作用: 未开放普通设置 renderer 使用统一真实空内容页面。
  [SETTINGS_RENDERER.empty]: SettingsEmptyPanel
});

// 类型: string。
// 作用: 定义设置完整路径转换为相对子路由时需要移除的统一前缀，避免在函数内使用路径长度魔法数字。
const SETTINGS_CHILD_PATH_PREFIX = `${SETTINGS_ROUTE_PATH.root}/`;

/**
 * 把完整设置路径转换为 SettingsView children 使用的相对路径。
 *
 * @param {string} routePath 设置模块或详情完整浏览器路径。
 * @returns {string} 相对于 `/settings` 父路由的子路径。
 * 纯函数: resolveSettingsChildPath 只读取输入参数或组件只读状态，并返回该字段对应的派生结果，不修改响应式状态或外部存储。
 */
function resolveSettingsChildPath(routePath) {
  // 条件分支: 输入以统一设置前缀开头时移除前缀，确保子路由明确渲染到 SettingsView 的 router-view。
  // 执行内容: 返回去除 `/settings/` 前缀后的相对子路径。
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
 * 路由 props 边界: 只有统一空内容 renderer 需要 moduleId，专用数据源页面直接读取 service。
 *
 * @param {object} moduleDefinition SettingsModuleDefinition 设置模块定义。
 * @returns {object} 可以放入 SettingsView children 的 Vue Router 路由规则。
 */
function createSettingsModuleRoute(moduleDefinition) {
  // 类型: Vue component。
  // 作用: 根据 renderer 找到真实页面组件；未知 renderer 使用统一空内容避免路由崩溃。
  const routeComponent = SETTINGS_RENDERER_COMPONENTS[moduleDefinition.renderer]
    || SettingsEmptyPanel;

  // 类型: boolean|object。
  // 作用: 空内容组件接收 moduleId 查找配置；专用页面不注入无关 props。
  const routeProps = moduleDefinition.renderer === SETTINGS_RENDERER.empty
    ? { moduleId: moduleDefinition.id }
    : false;

  // 返回值类型: object。
  // 作用: 路由名称、路径、标题和导航激活态全部直接读取唯一模块配置。
  return {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: resolveSettingsChildPath(moduleDefinition.routePath),
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: moduleDefinition.routeName,
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: routeComponent,
    // 类型: boolean|object。
    // 作用: 控制是否向路由组件注入 moduleId 等明确页面参数。
    props: routeProps,
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
// 作用: 把四个 SETTINGS_MODULES 定义一次性转换为设置外壳子路由，不在 routes 数组手工重复字段。
const settingsModuleRoutes = SETTINGS_MODULES.map(createSettingsModuleRoute);

// 类型: Array<object>。
// 作用: 集中声明应用正式路由表，并通过 meta.nav 提供顶部导航派生数据。
// 字段: path，string，浏览器地址栏中展示的路径。
// 字段: name，string，命名路由标识，供导航栏和代码跳转使用。
// 字段: component，Vue component，当前路由命中后由 <router-view /> 渲染的页面组件。
// 字段: meta.title，string，页面标题，用于后续浏览器标题、面包屑或页面标题展示。
// 字段: meta.nav，object，顶部导航配置；不存在时表示该路由不参与顶部导航。
// 字段: meta.nav.key，string，导航项唯一标识，用于 v-for 渲染稳定识别。
// 字段: meta.nav.label，string，导航按钮展示文案；当前保留与 title 的重复，确保导航语义独立。
// 字段: meta.nav.visible，boolean，是否显示在顶部导航中。
// 字段: meta.nav.order，number，顶部导航排序值，数字越小越靠前。
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
    component: HomeView,
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
        // 类型: boolean。
        // 作用: true 在顶部导航显示，false 隐藏入口。
        visible: true,
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
    component: MovieView,
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
        // 类型: boolean。
        // 作用: true 在顶部导航显示，false 隐藏入口。
        visible: true,
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
    component: TVView,
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
        // 类型: boolean。
        // 作用: true 在顶部导航显示，false 隐藏入口。
        visible: true,
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
    component: SearchResultView,
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
        // 类型: boolean。
        // 作用: true 在顶部导航显示，false 隐藏入口。
        visible: true,
        // 类型: number。
        // 作用: 顶部导航排序值，数字越小越靠前。
        order: 40
      }
    }
  },
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: '/detail/:sourceId?/:videoId?',
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: 'detail',
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: DetailView,
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: '详情',
      // 类型: object。
      // 作用: 顶部导航展示定义；不存在时该路由不生成独立顶部入口。
      nav: {
        // 类型: string。
        // 作用: 顶部导航项唯一标识，用于循环 key 和激活态比较。
        key: 'detail',
        // 类型: string。
        // 作用: 顶部导航按钮展示文案。
        label: '详情',
        // 类型: boolean。
        // 作用: true 在顶部导航显示，false 隐藏入口。
        visible: true,
        // 类型: number。
        // 作用: 顶部导航排序值，数字越小越靠前。
        order: 50
      }
    }
  },
  {
    // 类型: string。
    // 作用: 浏览器匹配路径；设置 children 中使用相对父路由的路径。
    path: '/player/:sourceId?/:videoId?',
    // 类型: string。
    // 作用: 命名路由标识，供导航、重定向和代码跳转使用。
    name: 'player',
    // 类型: Vue component。
    // 作用: 路由命中后由 router-view 渲染的页面组件。
    component: PlayerView,
    // 类型: object。
    // 作用: 保存页面标题、顶部导航归属和设置模块归属等路由元信息。
    meta: {
      // 类型: string。
      // 作用: 页面或模块标题，供导航和后续页面标题能力读取。
      title: '播放页',
      // 类型: object。
      // 作用: 顶部导航展示定义；不存在时该路由不生成独立顶部入口。
      nav: {
        // 类型: string。
        // 作用: 顶部导航项唯一标识，用于循环 key 和激活态比较。
        key: 'player',
        // 类型: string。
        // 作用: 顶部导航按钮展示文案。
        label: '播放页',
        // 类型: boolean。
        // 作用: true 在顶部导航显示，false 隐藏入口。
        visible: true,
        // 类型: number。
        // 作用: 顶部导航排序值，数字越小越靠前。
        order: 60
      }
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
    component: ProfileView,
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
        // 类型: boolean。
        // 作用: true 在顶部导航显示，false 隐藏入口。
        visible: true,
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
    component: SettingsView,
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
        // 类型: boolean。
        // 作用: true 在顶部导航显示，false 隐藏入口。
        visible: true,
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
        component: SourceDetailView,
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
