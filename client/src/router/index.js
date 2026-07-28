/*
router/index.js 模块说明

  - 文件职责:
      创建 Vue Router 全站实例，注册正式路由表，并连接当前标签页路由历史适配器。
      负责导航滚动恢复、来源位置记录和成功路由地址登记，不保存页面响应或用户长期数据。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 2 条，自定义 2 条):
      Vue，第三方库，提供 Vue 2 应用构造函数和插件注册能力。
      VueRouter，第三方库，提供 Vue 2 单页应用路由能力。
      routes，自定义路由表，提供全站页面路由规则。
      createRouteSessionHistory，自定义标签页路由历史工厂，保存最近地址和滚动位置。

  - 模块级常量:
      NAV_ROUTE_NAMES: Array<string>，由 meta.nav 派生的一级入口白名单。

  - 模块级变量:
      routeSessionHistory: Readonly<object>，当前标签页路由历史门面。
      router: VueRouter，全站路由实例，导出给 main.js 挂载到 Vue 根实例。

  - 模块级类:
      无

  - 模块级辅助函数:
      createScrollBehavior(to, from, savedPosition)
          - params:
              -- to : Route，即将进入的目标路由。
              -- from : Route，当前即将离开的来源路由。
              -- savedPosition : Object | null，浏览器前进/后退时保存的历史滚动位置。
          - return:
              Object，vue-router 使用的滚动位置对象。
          - description:
              定义路由切换后的滚动位置策略。
              如果存在 savedPosition，说明用户通过浏览器前进或后退触发路由切换，优先恢复历史滚动位置。
              如果不存在 savedPosition，说明用户通过导航点击或代码跳转进入新页面，统一回到页面左上角。

  - 对外导出:
      routeSessionHistory: 当前标签页路由历史门面，供 AppNavbar 恢复一级入口最近地址。
      router: VueRouter 全站实例，供 main.js 和应用组件执行正式路由导航。
*/

// 导入来源: vue。
// 导入内容: Vue 构造函数。
// 文件作用: 用于注册 VueRouter 插件，让所有组件都可以访问 this.$router 和 this.$route。
import Vue from 'vue';

// 导入来源: vue-router。
// 导入内容: VueRouter 路由插件。
// 文件作用: 提供 history 路由、命名路由和 router-view 渲染能力。
import VueRouter from 'vue-router';

// 导入来源: ./routes。
// 导入内容: routes 标准 Vue Router 路由表。
// 文件作用: 为 VueRouter 实例提供全站页面路径、命名路由、页面组件和路由 meta 配置。
import { routes } from './routes';

// 导入来源: ./routeSessionHistory.js。
// 导入内容: createRouteSessionHistory 标签页路由历史工厂。
// 文件作用: 为顶部导航和 Router 滚动行为提供同一份当前标签页会话门面。
import { createRouteSessionHistory } from './routeSessionHistory.js';

// 类型: Vue 插件注册语句。
// 作用: 让 Vue 2 应用启用 vue-router，后续组件可以使用 <router-view /> 和路由实例方法。
Vue.use(VueRouter);

/**
 * 创建路由滚动行为。
 * 纯函数: 只读取目标/来源路由、浏览器历史位置和标签页会话适配器，不发起页面请求或修改路由。
 * 成功路径: 优先恢复浏览器 savedPosition，其次恢复同一 fullPath 的标签页滚动位置，最后回到页面顶部。
 * 失败路径: 没有任何历史位置时返回页面顶部，保证滚动行为稳定。
 *
 * @param {object} to 即将进入的目标路由。
 * @param {object} from 当前即将离开的来源路由。
 * @param {{ x: number, y: number } | null | undefined} savedPosition 浏览器前进或后退时保存的历史滚动位置。
 * @returns {{ x: number, y: number }} 返回 vue-router 使用的滚动位置对象。
 */
function createScrollBehavior(to, from, savedPosition) {
  // 条件分支: Vue Router 提供浏览器前进/后退的 savedPosition 时进入。
  // 执行内容: 优先采用浏览器原生历史坐标，避免应用会话记录覆盖用户明确的后退位置。
  if (savedPosition) {
    return savedPosition;
  }

  // 类型: object|null；作用: 读取当前标签页同一完整地址离开前保存的滚动位置。
  const sessionPosition = routeSessionHistory.loadScrollPosition(to);

  // 条件分支: 目标地址存在匹配滚动历史时进入。
  // 执行内容: 恢复缓存页面离开时的阅读位置，不触发页面数据请求。
  if (sessionPosition) {
    return sessionPosition;
  }

  // 普通导航点击或代码跳转进入新页面时，统一回到页面左上角，避免从上一页中段位置进入新页面。
  return {
    x: 0,
    y: 0
  };
}

// 类型: Array<string>；作用: 从显式 meta.nav 声明派生一级入口白名单，不在会话模块复制路由名称。
const NAV_ROUTE_NAMES = routes
  .filter(route => route && route.meta && route.meta.nav && route.name)
  .map(route => route.name);

// 类型: Readonly<object>；作用: 统一保存当前标签页各一级入口最近 fullPath 和滚动位置。
export const routeSessionHistory = createRouteSessionHistory({
  // 副作用: 只在 Router 组合根注入当前标签页 sessionStorage，适配器不直接读取浏览器全局对象。
  storage: window.sessionStorage,
  navRouteNames: NAV_ROUTE_NAMES
});

// 类型: VueRouter。
// 作用: 创建全站路由实例，使用 history 模式让浏览器地址保持正式页面路径。
const router = new VueRouter({
  // 使用 history 模式，避免 URL 中出现 `#`，更贴近后续真实站点路径。
  mode: 'history',

  // 注入 routes.js 维护的标准 Vue Router 路由表。
  routes,

  // 统一处理路由切换后的滚动位置。
  scrollBehavior: createScrollBehavior
});

// 路由离开前记录当前窗口位置；该动作只更新标签页路由历史，不修改页面响应或长期保存对象。
router.beforeEach((to, from, next) => {
  // 条件分支: Router 已经存在真实来源路由时进入。
  // 执行内容: 保存来源页面离开前滚动位置，目标页面继续由 scrollBehavior 决定恢复位置。
  if (from && from.name) {
    routeSessionHistory.rememberScrollPosition(from, {
      x: window.scrollX,
      y: window.scrollY
    });
  }

  // 调用来源: Vue Router 全局前置守卫；作用: 不阻塞当前导航事务。
  next();
});

// 路由成功采用后登记所属一级入口的最近完整地址，失败导航不会污染会话历史。
router.afterEach((to) => {
  routeSessionHistory.rememberRoute(to);
});

// 导出路由实例，main.js 会把它挂到 Vue 根实例上。
export default router;
