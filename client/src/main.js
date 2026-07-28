/*
  main.js 模块说明

  - 文件职责:
      配置 Vue 2 与 Element UI，并创建 v5 前端应用根实例。
      在挂载页面前建立唯一 SourceManagementRuntime 状态订阅和共享初始化链。
      初始化失败时挂载独立安全故障视图，不回退旧数据源 mock、隐式重试数据库或挂载正常 App。

  - 导入库及文件汇总(11 条，内置 0 条，第三方 3 条，自定义 8 条):
      Vue: 第三方库，创建 Vue 2 根实例并注册插件。
      ElementUI: 第三方库，提供全局界面组件和指令。
      element-ui/lib/theme-chalk/index.css: 第三方样式，提供 Element UI 默认视觉。
      App: 自定义根组件，承载全站路由视图。
      StartupFailureView: 自定义故障组件，只在持久化启动失败时展示安全恢复入口。
      router: 自定义路由实例，管理全站页面导航。
      sourceManagementRuntimeInstance: 自定义应用单例，提供唯一设置管理订阅和初始化 Promise。
      settingsStore: 自定义响应式 store，采用完整 SourceManager 投影并记录初始化失败。
      initializeUserContent: 自定义服务，在挂载前加载并采用 IndexedDB 用户内容投影。
      BROWSER_PERSISTENCE_ERROR_CODE: 自定义稳定错误码，为启动故障选择安全用户说明。
      ./assets/theme.css: 自定义样式，提供项目主题和全局视觉覆盖。

  - 模块级常量:
      APPLICATION_STARTUP_FAILURE_CODE: string，未知启动失败的稳定兜底码。
      APPLICATION_STARTUP_FAILURE_MESSAGE: string，未知启动失败的安全用户说明。
      PERSISTENCE_STARTUP_MESSAGES: object，持久化稳定错误码到用户处理建议的映射。

  - 模块级变量:
      无

  - 模块级辅助函数:
      initializeSettingsSourceManagement(): 先订阅完整投影，再执行唯一 Runtime 初始化并收敛失败。
      initializeApplicationState(): 按 Source Runtime、用户内容顺序完成应用状态初始化。
      createStartupFailureViewModel(error): 把稳定错误分类转换为安全故障视图模型。
      mountApplication(): 创建并挂载 Vue 根实例。
      mountStartupFailure(error): 正常 App 未挂载时创建独立故障根实例。

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

// 导入来源: ./components/common/StartupFailureView.vue。
// 导入内容: StartupFailureView 独立启动故障组件。
// 文件作用: 持久化初始化 reject 时展示稳定错误码和显式重新加载入口。
import StartupFailureView from './components/common/StartupFailureView.vue';

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

// 导入来源: ./services/userContentService.js。
// 导入内容: initializeUserContent 用户内容启动函数。
// 文件作用: 在 Vue 根实例挂载前读取 IndexedDB 收藏、历史和恢复策略投影。
import { initializeUserContent } from './services/userContentService.js';

// 导入来源: ./repositories/persistence/browserPersistenceErrors.js。
// 导入内容: BROWSER_PERSISTENCE_ERROR_CODE 稳定持久化错误码集合。
// 文件作用: 只按稳定 code 选择用户提示，不向故障视图传递原始 message 或 cause。
import { BROWSER_PERSISTENCE_ERROR_CODE } from './repositories/persistence/browserPersistenceErrors.js';

// 导入来源: ./assets/theme.css。
// 导入内容: 项目全站主题样式。
// 文件作用: 在组件库基础样式之后应用项目颜色、背景和通用视觉覆盖。
import './assets/theme.css';

// 副作用: 全局注册 Element UI；全部 Vue 组件可以直接使用其组件、服务和指令。
Vue.use(ElementUI);

// 类型: boolean。
// 作用: false 关闭 Vue 生产环境提示，避免无关信息污染应用控制台。
Vue.config.productionTip = false;

// 类型: string；作用: 未知 Runtime、Repository 或渲染初始化失败使用的稳定应用级错误码。
const APPLICATION_STARTUP_FAILURE_CODE = 'APPLICATION_STARTUP_FAILED';

// 类型: string；作用: 未识别错误不展示内部异常，只提示用户重新加载或检查浏览器存储。
const APPLICATION_STARTUP_FAILURE_MESSAGE = '应用无法读取本地数据，请检查浏览器存储状态后重新加载。';

// 类型: Readonly<object>；作用: 把可安全公开的持久化 code 映射为用户可执行建议，不解析浏览器文案。
const PERSISTENCE_STARTUP_MESSAGES = Object.freeze({
  // 字段类型: string；作用: 浏览器不支持 IndexedDB 时明确需要更换或升级浏览器。
  [BROWSER_PERSISTENCE_ERROR_CODE.unsupported]: '当前浏览器不支持本地数据库，请升级浏览器或使用支持 IndexedDB 的浏览器。',
  // 字段类型: string；作用: 旧页面连接阻塞升级时提示关闭其他同站页面后显式重载。
  [BROWSER_PERSISTENCE_ERROR_CODE.blocked]: '另一个页面正在占用旧版本本地数据库，请关闭其他本项目页面后重新加载。',
  // 字段类型: string；作用: 浏览器异常终止连接时提示重新建立完整应用会话。
  [BROWSER_PERSISTENCE_ERROR_CODE.terminated]: '浏览器已终止本地数据库连接，请重新加载页面建立新的应用会话。',
  // 字段类型: string；作用: schema 迁移失败时阻止用户误以为页面已经采用旧数据。
  [BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed]: '本地数据库升级未完成，原有数据已保留；请重新加载，问题持续时再检查浏览器存储。',
  // 字段类型: string；作用: 配额不足时指导用户先释放站点存储空间再重试。
  [BROWSER_PERSISTENCE_ERROR_CODE.quotaExceeded]: '浏览器分配给本站的存储空间不足，请释放站点存储空间后重新加载。',
  // 字段类型: string；作用: 保存图损坏时明确停止启动且没有自动清库。
  [BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted]: '本地保存数据无法通过完整性校验，应用已停止启动且不会自动删除原数据。'
});

/**
 * 建立设置数据源管理的唯一启动链。
 * 副作用: 先向唯一 SourceManager 注册一个应用生命周期订阅，再调用共享 Runtime 初始化 Promise。
 * 成功路径: 每次发布都由 settingsStore 完整替换页面投影，初始化完成后函数 resolve。
 * 失败路径: 订阅、投影采用或 Runtime 初始化失败时恢复完整空投影、记录安全摘要并继续 reject，阻止后续用户内容初始化和页面挂载。
 * 资源边界: 订阅与应用模块生命周期一致，页面路由切换不取消；浏览器刷新会统一释放模块和监听器。
 *
 * @returns {Promise<void>} 初始化成功时兑现；失败状态写入 store 后 reject。
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
    // 副作用: 初始化失败记录安全摘要并恢复完整空投影，不回退旧模拟状态或创建第二 Runtime。
    settingsStore.failSourceManagerInitialization(error);
    // 失败传播: 阻止同一次启动继续初始化用户内容并隐式重试数据库，也不挂载伪成功页面。
    throw error;
  }
}

/**
 * 初始化 Vue 挂载前的应用状态。
 * 副作用: 先完成 SourceManager 稳定投影，再加载用户内容 Repository 并整体采用 userContentStore。
 * 成功路径: 两个领域都已经收敛后 resolve，页面首次渲染直接读取稳定持久化状态。
 * 失败路径: 用户内容数据库或保存图失败时 reject 并阻止根实例挂载，不以空数组或 mock 伪装成功。
 *
 * @returns {Promise<void>} 应用状态可供页面读取时完成。
 */
async function initializeApplicationState() {
  await initializeSettingsSourceManagement();
  await initializeUserContent();
}

/**
 * 把启动错误转换为可公开的故障视图模型。
 * 纯函数: 只读取稳定 error.code；不读取、记录或返回原始 message、stack 和 cause。
 * 成功路径: 已知持久化 code 返回对应处理建议；其他错误返回应用级兜底模型。
 *
 * @param {*} error Source Runtime、UserContent Repository 或 Vue 挂载前链路的 reject 原因。
 * @returns {Readonly<object>} 安全故障视图模型。
 * @returns {string} return.errorCode 稳定持久化码或应用兜底码。
 * @returns {string} return.message 不含内部异常内容的用户处理建议。
 */
function createStartupFailureViewModel(error) {
  // 类型: string；作用: 只接受已存在于安全提示映射中的稳定错误码。
  const candidateCode = error && typeof error === 'object' && typeof error.code === 'string'
    ? error.code
    : '';
  // 类型: string；作用: 未知 code 统一收敛为应用级故障码，禁止把第三方错误字段直接显示到页面。
  const errorCode = Object.hasOwn(PERSISTENCE_STARTUP_MESSAGES, candidateCode)
    ? candidateCode
    : APPLICATION_STARTUP_FAILURE_CODE;

  return Object.freeze({
    errorCode,
    message: PERSISTENCE_STARTUP_MESSAGES[errorCode] || APPLICATION_STARTUP_FAILURE_MESSAGE
  });
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

/**
 * 在正常应用未挂载时创建独立启动故障根实例。
 * 副作用: 把 StartupFailureView 挂载到 index.html 的 #app；不注入 router，不读取或修改业务 store。
 * 成功路径: 页面显示稳定错误码、处理建议和重新加载命令。
 * 失败路径: Vue 无法挂载时错误继续交给浏览器运行环境；不创建第二次数据库初始化。
 *
 * @param {*} error initializeApplicationState 或 mountApplication 的 reject 原因。
 * @returns {Vue} 已挂载的故障 Vue 根实例。
 */
function mountStartupFailure(error) {
  // 类型: Readonly<object>；作用: 切断原始异常，只把白名单 code 和安全说明交给组件。
  const viewModel = createStartupFailureViewModel(error);
  // 返回值类型: Vue；作用: 当前实例只承载启动故障，不代表 Source 或 UserContent 已 ready。
  return new Vue({
    /**
     * 渲染独立启动故障组件。
     * 纯函数: 只根据冻结 viewModel 创建虚拟节点，不访问数据库、路由或 store。
     *
     * @param {Function} createElement Vue 2 虚拟节点工厂。
     * @returns {object} StartupFailureView 根虚拟节点。
     */
    render(createElement) {
      return createElement(StartupFailureView, { props: viewModel });
    }
  }).$mount('#app');
}

// 异步调用: 两个持久化领域完成后挂载正常 App；任一 reject 只挂载独立故障视图，不采用 mock 或隐式重试。
initializeApplicationState()
  .then(mountApplication)
  .catch(mountStartupFailure);
