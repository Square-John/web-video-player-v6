// 引入 Vue 2 主库，后面通过 new Vue() 创建整个前端应用实例。
import Vue from 'vue';

// 引入根组件。App.vue 是整个前端应用的最外层组件。
import App from './App.vue';

// 关闭生产环境提示，保持浏览器控制台输出更简洁。
Vue.config.productionTip = false;

// 创建 Vue 根实例。
// 这里先挂载 App 根组件，后续新增能力时再把路由、状态管理等配置接入根实例。
new Vue({
  // render 是 Vue 2 的渲染入口。
  // createElement 用来把 App 组件转换成浏览器可以渲染的虚拟节点。
  render(createElement) {
    return createElement(App);
  }

  // 把 Vue 应用挂载到 index.html 里的 <div id="app"></div>。
}).$mount('#app');
