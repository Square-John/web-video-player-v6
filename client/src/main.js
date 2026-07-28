/*
  main.js 模块说明

  - 文件职责:
      创建 Web Video Player 前端应用的 Vue 根实例。
      注册 Element UI、接入 Vue Router，并把 App.vue 挂载到 index.html 的 #app 节点。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 3 条，自定义 3 条):
      Vue: 第三方库，用于创建 Vue 2 根实例。
      ElementUI: 第三方库，用于注册 Element UI 全局组件和指令。
      element-ui/lib/theme-chalk/index.css: 第三方样式，提供 Element UI 默认视觉。
      App: 自定义组件，应用根组件。
      router: 自定义路由，管理全站页面跳转。
      ./assets/theme.css: 自定义样式，提供全站主题和通用视觉覆盖。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      无，当前文件通过创建 Vue 根实例产生应用挂载副作用。
*/

// 导入来源: vue。
// 导入内容: Vue 2 构造函数。
// 文件作用: 安装全局插件并创建应用根实例。
import Vue from 'vue';

// 导入来源: element-ui。
// 导入内容: ElementUI 全局组件库插件。
// 文件作用: 注册按钮、输入、加载、空状态和指令等全局能力。
import ElementUI from 'element-ui';

// 导入来源: element-ui/lib/theme-chalk/index.css。
// 导入内容: Element UI 默认 Theme Chalk 样式。
// 文件作用: 在项目主题覆盖前为 Element UI 组件提供基础视觉。
import 'element-ui/lib/theme-chalk/index.css';

// 导入来源: ./App.vue。
// 导入内容: App 根组件。
// 文件作用: 组合导航、路由页面出口和页脚。
import App from './App.vue';

// 导入来源: ./router。
// 导入内容: router 全站 Vue Router 实例。
// 文件作用: 把页面组件映射到 URL，并向组件注入 $router 和 $route。
import router from './router';

// 导入来源: ./assets/theme.css。
// 导入内容: 全站主题与通用布局样式。
// 文件作用: 在第三方样式之后建立项目设计令牌和必要覆盖。
import './assets/theme.css';

// 全局注册 Element UI，注册后所有 Vue 组件都能直接使用 el-button、el-empty、v-loading 等能力。
Vue.use(ElementUI);

// 关闭生产环境提示，保持浏览器控制台输出更简洁。
Vue.config.productionTip = false;

// 创建 Vue 根实例。
// 这里挂载 App 根组件，并接入 vue-router，让 App.vue 内部的 router-view 渲染当前页面。
new Vue({
  // router 是全站路由实例，注入后所有组件都能通过 this.$router 和 this.$route 访问路由能力。
  router,

  /**
   * 创建 Vue 根实例的 App 虚拟节点。
   * 纯函数: 只把 App 组件交给 Vue 提供的 createElement，不直接操作 DOM 或全局状态。
   *
   * @param {Function} createElement Vue 2 虚拟节点工厂函数。
   * @returns {object} 包含 App 根组件的 Vue 虚拟节点。
   */
  render(createElement) {
    // 返回值类型: object。
    // 作用: 返回 App 根节点，供 Vue 后续 patch 到 #app 挂载容器。
    return createElement(App);
  }

  // 把 Vue 应用挂载到 index.html 里的 <div id="app"></div>。
}).$mount('#app');
