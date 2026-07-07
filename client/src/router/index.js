/*
  router/index.js 模块说明

  - 导入库及文件汇总(3 条，内置 0 条，第三方 2 条，自定义 1 条):
      Vue，第三方库，提供 Vue 2 应用构造函数和插件注册能力。
      VueRouter，第三方库，提供 Vue 2 单页应用路由能力。
      routes，自定义路由表，提供全站页面路由规则。

  - 模块级常量:
      router: VueRouter，全站路由实例，导出给 main.js 挂载到 Vue 根实例。

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

// 类型: Vue 插件注册语句。
// 作用: 让 Vue 2 应用启用 vue-router，后续组件可以使用 <router-view /> 和路由实例方法。
Vue.use(VueRouter);

/**
 * 创建路由滚动行为。
 *
 * @param {object} to 即将进入的目标路由。
 * @param {object} from 当前即将离开的来源路由。
 * @param {{ x: number, y: number } | null | undefined} savedPosition 浏览器前进或后退时保存的历史滚动位置。
 * @returns {{ x: number, y: number }} 返回 vue-router 使用的滚动位置对象。
 */
function createScrollBehavior(to, from, savedPosition) {
  // 如果存在 savedPosition，说明本次路由切换来自浏览器前进或后退，优先恢复历史滚动位置。
  if (savedPosition) {
    return savedPosition;
  }

  // 普通导航点击或代码跳转进入新页面时，统一回到页面左上角，避免从上一页中段位置进入新页面。
  return {
    x: 0,
    y: 0
  };
}

// 类型: VueRouter。
// 作用: 创建全站路由实例，使用 history 模式让浏览器地址保持正式页面路径。
const router = new VueRouter({
  // 使用 history 模式，避免 URL 中出现 `#`，更贴近常规站点路径。
  mode: 'history',

  // 注入 routes.js 维护的标准 Vue Router 路由表。
  routes,

  // 统一处理路由切换后的滚动位置。
  scrollBehavior: createScrollBehavior
});

// 导出路由实例，main.js 会把它挂到 Vue 根实例上。
export default router;
