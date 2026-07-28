/*
  main.js 模块说明

  - 文件职责:
      配置 Vue 2 与 Element UI，并创建 v5 前端应用根实例。
      在挂载页面前建立唯一 SourceManagementRuntime 状态订阅和共享初始化链。
      初始化失败时记录 store 错误并使用完整空投影继续挂载，不回退旧数据源 mock。

  - 导入库及文件汇总(8 条，内置 0 条，第三方 3 条，自定义 5 条):
      Vue: 第三方库，创建 Vue 2 根实例并注册插件。
      ElementUI: 第三方库，提供全局界面组件和指令。
      element-ui/lib/theme-chalk/index.css: 第三方样式，提供 Element UI 默认视觉。
      App: 自定义根组件，承载全站路由视图。
      router: 自定义路由实例，管理全站页面导航。
      sourceManagementRuntimeInstance: 自定义应用单例，提供唯一设置管理订阅和初始化 Promise。
      settingsStore: 自定义响应式 store，采用完整 SourceManager 投影并记录初始化失败。
      ./assets/theme.css: 自定义样式，提供项目主题和全局视觉覆盖。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      initializeSettingsSourceManagement(): 先订阅完整投影，再执行唯一 Runtime 初始化并收敛失败。
      mountApplication(): 创建并挂载 Vue 根实例。

  - 模块级类:
      无

  - 对外导出:
      无，当前文件通过 Runtime 初始化、状态订阅和 Vue 挂载产生应用级副作用。
*/

// 导入来源: vue。
// 导入内容: Vue 2 构造函数。
// 文件作用: 注册 Element UI 并创建应用根实例。
import Vue from 'vue';

// 导入来源: element-ui。
// 导入内容: ElementUI 组件库插件。
// 文件作用: 全局注册按钮、弹窗、加载、空状态等基础组件和指令。
import ElementUI from 'element-ui';

// 导入来源: element-ui/lib/theme-chalk/index.css。
// 导入内容: Element UI 默认样式。
// 文件作用: 保证全局组件在项目主题覆盖前具有完整基础视觉。
import 'element-ui/lib/theme-chalk/index.css';

// 导入来源: ./App.vue。
// 导入内容: App 应用根组件。
// 文件作用: 作为 Vue 根实例的唯一渲染入口。
import App from './App.vue';

// 导入来源: ./router/index.js。
// 导入内容: router 全站 Vue Router 实例。
// 文件作用: 把首页、目录、搜索、详情、播放、个人中心和设置映射到 URL。
import router from './router';

// 导入来源: ./runtime/sourceRuntimeInstance.js。
// 导入内容: sourceManagementRuntimeInstance 应用唯一设置管理门面。
// 文件作用: 在页面挂载前注册 SourceManager 投影订阅并复用 Bundle 单一初始化 Promise。
import { sourceManagementRuntimeInstance } from './runtime/sourceRuntimeInstance.js';

// 导入来源: ./store/settingsStore.js。
// 导入内容: settingsStore 设置页响应式投影门面。
// 文件作用: 一次性采用 Runtime 发布投影，并记录初始化开始或失败状态。
import { settingsStore } from './store/settingsStore.js';

// 导入来源: ./assets/theme.css。
// 导入内容: 项目全站主题样式。
// 文件作用: 在组件库基础样式之后应用项目颜色、背景和通用视觉覆盖。
import './assets/theme.css';

// 副作用: 全局注册 Element UI；全部 Vue 组件可以直接使用其组件、服务和指令。
Vue.use(ElementUI);

// 类型: boolean。
// 作用: false 关闭 Vue 生产环境提示，避免无关信息污染应用控制台。
Vue.config.productionTip = false;

/**
 * 建立设置数据源管理的唯一启动链。
 * 副作用: 先向唯一 SourceManager 注册一个应用生命周期订阅，再调用共享 Runtime 初始化 Promise。
 * 成功路径: 每次发布都由 settingsStore 完整替换页面投影，初始化完成后函数 resolve。
 * 失败路径: 订阅、投影采用或 Runtime 初始化失败时恢复完整空投影并记录安全错误摘要；函数收敛后仍允许应用挂载。
 * 资源边界: 订阅与应用模块生命周期一致，页面路由切换不取消；浏览器刷新会统一释放模块和监听器。
 *
 * @returns {Promise<void>} 初始化成功或失败状态已经写入 store 后兑现。
 */
async function initializeSettingsSourceManagement() {
  // 副作用: 在订阅和初始化前清空旧失败及局部投影，标记共享启动链正在执行。
  settingsStore.beginSourceManagerInitialization();

  // 类型: Error|null。
  // 作用: 捕获 SourceManager 为隔离监听器吞掉的 store 投影采用错误，使启动链仍能失败关闭。
  let projectionAdoptionError = null;

  try {
    // 副作用: 初始化前注册唯一应用订阅，保证 SourceManager 首份稳定投影和后续过渡投影都不会丢失。
    // 资源释放: 监听器与根应用同生命周期，不在路由卸载时取消。
    sourceManagementRuntimeInstance.subscribe((sourceManagerState) => {
      try {
        // 副作用: 只调用 store 完整替换入口，不逐字段合并，也不写回 Repository。
        settingsStore.replaceSourceManagerState(sourceManagerState);
      } catch (error) {
        // 副作用范围: 只记录本次启动链的投影采用错误；SourceManager 仍按监听器隔离规则完成自身事务。
        projectionAdoptionError = error;
        throw error;
      }
    });

    // 异步调用: 复用 Runtime Bundle 的单一初始化 Promise。
    // resolve: SourceManager 已发布首份稳定投影；reject: 进入下方完整空投影失败关闭。
    await sourceManagementRuntimeInstance.initialize();

    // 条件分支: SourceManager 初始化成功但订阅采用投影曾失败时进入。
    // 执行内容: 把监听器隔离错误重新纳入应用启动失败关闭，避免停留在 initializing 状态。
    if (projectionAdoptionError) {
      throw projectionAdoptionError;
    }
  } catch (error) {
    // 副作用: 初始化失败只记录安全摘要并恢复完整空投影，不回退旧模拟状态或创建第二 Runtime。
    settingsStore.failSourceManagerInitialization(error);
  }
}

/**
 * 创建并挂载 Vue 根应用。
 * 副作用: 创建一个 Vue 根实例，把 App 渲染到 index.html 的 #app 节点并接入全站 router。
 * 成功路径: 返回已挂载 Vue 实例。
 * 失败路径: 根组件、路由或 DOM 挂载失败时错误原样传播给浏览器运行环境。
 *
 * @returns {Vue} 已挂载的 Vue 根实例。
 */
function mountApplication() {
  // 返回值类型: Vue。
  // 作用: 根实例只在数据源管理初始化成功或失败已经明确收敛后创建。
  return new Vue({
    // 类型: object；来源: ./router；作用: 给全部组件注入 $router 和 $route。
    router,

    /**
     * 渲染应用根组件。
     * 纯函数: 只根据 App 组件创建虚拟节点，不修改数据源状态或路由。
     *
     * @param {Function} createElement Vue 2 虚拟节点工厂。
     * @returns {object} App 根虚拟节点。
     */
    render(createElement) {
      return createElement(App);
    }
  }).$mount('#app');
}

// 异步调用: 完成唯一设置管理初始化收敛后再挂载应用，确保设置容器创建时已经看到稳定投影或明确空状态。
initializeSettingsSourceManagement().then(mountApplication);
