// 引入 Vue 2 主库，后面通过 new Vue() 创建整个前端应用实例。
import Vue from 'vue';

// 引入 Element UI 组件库，页面中的按钮、加载遮罩、空状态等基础控件都来自这里。
import ElementUI from 'element-ui';

// 先引入 Element UI 官方样式，保证 el-button、el-empty、v-loading 等组件有默认外观。
import 'element-ui/lib/theme-chalk/index.css';

// 引入根组件。App.vue 是整个前端应用的最外层组件。
import App from './App.vue';

// 再引入全站主题样式，用项目自己的颜色、背景和通用外观覆盖组件库默认视觉。
import './assets/theme.css';

// 最后引入内容区块样式，首页和目录页会复用这些区块标题、网格和侧栏规则。
import './assets/section.css';

// 全局注册 Element UI，注册后所有 Vue 组件都能直接使用 el-button、el-empty、v-loading 等能力。
Vue.use(ElementUI);

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
