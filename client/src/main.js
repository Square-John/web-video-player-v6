// 引入 Vue 2 主库，后面通过 new Vue() 创建整个前端应用实例。
import Vue from 'vue';

// 引入 Element UI 组件库，页面中的按钮、加载遮罩、空状态等基础控件都来自这里。
import ElementUI from 'element-ui';

// 先引入 Element UI 官方样式，保证 el-button、el-empty、v-loading 等组件有默认外观。
import 'element-ui/lib/theme-chalk/index.css';

// 引入根组件。App.vue 是整个前端应用的最外层组件。
import App from './App.vue';

// 引入正式路由实例，负责把首页、电影、电视剧、搜索、详情、播放、个人中心和设置映射到 URL。
import router from './router';

// 再引入全站主题样式，用项目自己的颜色、背景和通用外观覆盖组件库默认视觉。
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

  // render 是 Vue 2 的渲染入口。
  // createElement 用来把 App 组件转换成浏览器可以渲染的虚拟节点。
  render(createElement) {
    return createElement(App);
  }

  // 把 Vue 应用挂载到 index.html 里的 <div id="app"></div>。
}).$mount('#app');
