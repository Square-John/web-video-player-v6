/*
  main.js 模块说明

  - 文件职责:
      先采用外部 FrontendRuntimeConfig，再动态加载 Vue、IndexedDB、SourceRuntime 和 Provider 依赖。
      配置成功后建立唯一 SourceManagementRuntime 状态订阅和共享初始化链，并创建 Web Video Player 根实例。
      配置失败时使用原生 DOM 展示独立故障；业务初始化失败时挂载 Vue 安全故障视图，不回退旧数据或默认地址。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      initializeFrontendRuntimeConfig: 自定义配置屏障，在任何业务模块加载前采用唯一运行时配置。

  - 模块级常量:
      APPLICATION_STARTUP_FAILURE_CODE: string，未知启动失败的稳定兜底码。
      APPLICATION_STARTUP_FAILURE_MESSAGE: string，未知启动失败的安全用户说明。
      FRONTEND_CONFIG_FAILURE_CODE: string，外部前端配置失败的稳定页面错误码。
      FRONTEND_CONFIG_FAILURE_MESSAGE: string，外部前端配置失败的用户处理建议。

  - 模块级变量:
      Vue / App / StartupFailureView / ProjectElementUiPlugin / router: 配置通过后动态采用的 Vue 应用依赖。
      sourceManagementRuntimeInstance / settingsStore: 配置通过后动态采用的数据源管理依赖。
      initializeUserContent / initializeShortcutSettings / initializeHomeDisplaySettings: 配置通过后的持久化初始化函数。
      BROWSER_PERSISTENCE_ERROR_CODE / PERSISTENCE_STARTUP_MESSAGES: 动态采用的错误码与安全提示映射。

  - 模块级辅助函数:
      loadApplicationModules(): 在配置屏障通过后一次加载并采用全部应用依赖。
      mountFrontendConfigFailure(error): 配置失败时用原生 DOM 展示独立故障，不加载 Vue。
      initializeSettingsSourceManagement(): 先订阅完整投影，再执行唯一 Runtime 初始化并收敛失败。
      initializeApplicationState(): 按 Source Runtime、用户内容、快捷键设置顺序完成应用状态初始化。
      startInitialSourceHealthChecks(): 根应用挂载后非阻塞检测全部已启用可运行数据源。
      createStartupFailureDiagnostic(error): 在开发环境生成不包含保存数据的错误包装链摘要。
      reportStartupFailureDiagnostic(error): 仅在开发环境向控制台报告安全诊断摘要。
      createStartupFailureViewModel(error): 把稳定错误分类转换为安全故障视图模型。
      mountApplication(): 创建并挂载 Vue 根实例。
      mountStartupFailure(error): 正常 App 未挂载时创建独立故障根实例。

  - 模块级类:
      无

  - 对外导出:
      无，当前文件通过 Runtime 初始化、状态订阅和 Vue 挂载产生应用级副作用。
*/

// 导入来源: ./config/frontendRuntimeConfig.js。
// 导入内容: initializeFrontendRuntimeConfig。
// 文件作用: 在动态加载任何业务依赖前采用外部公开配置并建立唯一运行投影。
import { initializeFrontendRuntimeConfig } from './config/frontendRuntimeConfig.js';

// 类型: Function|undefined；作用: 配置屏障通过后保存 Vue 2 构造函数；undefined 表示业务模块尚未加载。
let Vue;
// 类型: object|undefined；作用: 保存动态加载的应用根组件。
let App;
// 类型: object|undefined；作用: 保存动态加载的业务启动故障组件。
let StartupFailureView;
// 类型: object|undefined；作用: 保存动态加载的项目 Element UI 插件。
let ProjectElementUiPlugin;
// 类型: object|undefined；作用: 保存动态加载的全站路由实例。
let router;
// 类型: Readonly<object>|undefined；作用: 保存动态加载的唯一数据源管理 Runtime 门面。
let sourceManagementRuntimeInstance;
// 类型: object|undefined；作用: 保存动态加载的设置页响应式投影门面。
let settingsStore;
// 类型: Function|undefined；作用: 保存动态加载的用户内容初始化函数。
let initializeUserContent;
// 类型: Function|undefined；作用: 保存动态加载的快捷键设置初始化函数。
let initializeShortcutSettings;
// 类型: Function|undefined；作用: 保存动态加载的首页展示设置初始化函数。
let initializeHomeDisplaySettings;
// 类型: Readonly<object>|undefined；作用: 保存动态加载的浏览器持久化稳定错误码。
let BROWSER_PERSISTENCE_ERROR_CODE;
// 类型: Readonly<object>；作用: 业务模块加载后建立持久化错误码到安全用户说明的映射。
let PERSISTENCE_STARTUP_MESSAGES = Object.freeze({});

// 类型: string；作用: 未知 Runtime、Repository 或渲染初始化失败使用的稳定应用级错误码。
const APPLICATION_STARTUP_FAILURE_CODE = 'APPLICATION_STARTUP_FAILED';

// 类型: string；作用: 未识别错误不展示内部异常，只提示用户重新加载或检查浏览器存储。
const APPLICATION_STARTUP_FAILURE_MESSAGE = '应用无法读取本地数据，请检查浏览器存储状态后重新加载。';

// 类型: string；作用: 外部 frontend.config.js 缺失、语法失败或契约不兼容时展示的稳定错误码。
const FRONTEND_CONFIG_FAILURE_CODE = 'FRONTEND_CONFIG_INVALID';

// 类型: string；作用: 配置启动失败时给用户的可执行建议，不泄漏路径、堆栈或配置候选。
const FRONTEND_CONFIG_FAILURE_MESSAGE = '前端运行配置缺失或无效，请检查 config/frontend.config.js 后重新加载。';

/**
 * 在业务依赖加载后建立持久化错误安全提示映射。
 * 纯函数: 只读取动态加载的稳定错误码对象并返回冻结文案映射，不访问保存数据或浏览器状态。
 * 成功路径: 所有已知持久化错误码均获得用户可执行提示。
 * 失败路径: 模块错误码不完整时由属性访问失败阻止应用继续采用半成品映射。
 *
 * @returns {Readonly<object>} 持久化错误码到安全用户说明的冻结映射。
 */
function createPersistenceStartupMessages() {
  return Object.freeze({
    // 字段类型: string；作用: 浏览器不支持 IndexedDB 时明确需要更换或升级浏览器。
    [BROWSER_PERSISTENCE_ERROR_CODE.unsupported]: '当前浏览器不支持本地数据库，请升级浏览器或使用支持 IndexedDB 的浏览器。',
    // 字段类型: string；作用: 旧页面连接阻塞升级时提示关闭其他同站页面后显式重载。
    [BROWSER_PERSISTENCE_ERROR_CODE.blocked]: '另一个页面正在占用旧版本本地数据库，请关闭其他本项目页面后重新加载。',
    // 字段类型: string；作用: 浏览器异常终止连接时提示重新建立完整应用会话。
    [BROWSER_PERSISTENCE_ERROR_CODE.terminated]: '浏览器已终止本地数据库连接，请重新加载页面建立新的应用会话。',
    // 字段类型: string；作用: schema 迁移失败时阻止用户误以为页面已经采用旧数据。
    [BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed]: '本地数据库升级未完成，原有数据已保留；请重新加载，问题持续时再检查浏览器存储。',
    // 字段类型: string；作用: 首次空库种子事务失败时说明应用没有采用部分初始化数据。
    [BROWSER_PERSISTENCE_ERROR_CODE.seedFailed]: '本地数据库首次初始化未完成，应用没有采用部分数据；请重新加载后重试。',
    // 字段类型: string；作用: 配额不足时指导用户先释放站点存储空间再重试。
    [BROWSER_PERSISTENCE_ERROR_CODE.quotaExceeded]: '浏览器分配给本站的存储空间不足，请释放站点存储空间后重新加载。',
    // 字段类型: string；作用: 保存图损坏时明确停止启动且没有自动清库。
    [BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted]: '本地保存数据无法通过完整性校验，应用已停止启动且不会自动删除原数据。',
    // 字段类型: string；作用: 普通读取事务失败时提示重新建立会话，同时保留原始本地数据。
    [BROWSER_PERSISTENCE_ERROR_CODE.operationFailed]: '本地数据库读取未完成，原有数据保持不变；请重新加载页面后重试。'
  });
}

/**
 * 在运行时配置屏障通过后加载全部业务依赖。
 * 副作用: 动态求值 Vue、路由、Runtime、IndexedDB Repository、服务和全局主题；只执行一次并在调用方等待。
 * 成功路径: 返回值无意义，但所有模块变量都指向本次页面唯一应用依赖。
 * 失败路径: 任一模块语法、依赖或初始化失败向启动入口传播，不能回退静态 import、Mock 或旧代理地址。
 *
 * @returns {Promise<void>} 全部业务依赖加载完成时兑现。
 */
async function loadApplicationModules() {
  // 类型: Array<object>; 作用: 保存按固定顺序对应的动态模块结果，Promise.all 任一失败会整体拒绝。
  const modules = await Promise.all([
    import('vue'),
    import('./App.vue'),
    import('./components/common/StartupFailureView.vue'),
    import('./plugins/projectElementUiPlugin.js'),
    import('./router'),
    import('./runtime/sourceRuntimeInstance.js'),
    import('./store/settingsStore.js'),
    import('./services/userContentService.js'),
    import('./services/shortcutSettingsService.js'),
    import('./services/homeDisplaySettingsService.js'),
    import('./repositories/persistence/browserPersistenceErrors.js'),
    import('./assets/theme.css')
  ]);

  // 类型: object；作用: 采用 Vue 模块默认导出，后续挂载和故障组件共用同一构造函数。
  Vue = modules[0].default;
  // 类型: object；作用: 采用应用根组件，业务路由最终由它渲染。
  App = modules[1].default;
  // 类型: object；作用: 采用 Vue 启动故障组件，保存层失败时展示稳定用户提示。
  StartupFailureView = modules[2].default;
  // 类型: object；作用: 采用项目 Element UI 插件，注册当前模板实际使用的组件能力。
  ProjectElementUiPlugin = modules[3].default;
  // 类型: object；作用: 采用全站 Router 实例，供正常根实例使用。
  router = modules[4].default;
  // 类型: Readonly<object>；作用: 采用唯一 SourceManagementRuntime 门面。
  ({ sourceManagementRuntimeInstance } = modules[5]);
  // 类型: object；作用: 采用设置页响应式投影门面。
  ({ settingsStore } = modules[6]);
  // 类型: Function；作用: 采用用户内容 IndexedDB 初始化函数。
  ({ initializeUserContent } = modules[7]);
  // 类型: Function；作用: 采用快捷键 IndexedDB 初始化函数。
  ({ initializeShortcutSettings } = modules[8]);
  // 类型: Function；作用: 采用首页展示偏好 IndexedDB 初始化函数。
  ({ initializeHomeDisplaySettings } = modules[9]);
  // 类型: Readonly<object>；作用: 采用持久化稳定错误码集合。
  ({ BROWSER_PERSISTENCE_ERROR_CODE } = modules[10]);
  PERSISTENCE_STARTUP_MESSAGES = createPersistenceStartupMessages();

  // 副作用: 只在配置和全部业务模块成功加载后安装 UI 插件并关闭 Vue 生产提示。
  Vue.use(ProjectElementUiPlugin);
  Vue.config.productionTip = false;
}

/**
 * 展示外部前端配置启动故障。
 * 副作用: 只使用原生 DOM 替换 #app 内容、更新页面标题并绑定一次重新加载按钮；不加载 Vue、路由、IndexedDB 或 Runtime。
 * 成功路径: 用户看到稳定错误码、配置文件位置和重新加载操作。
 * 失败路径: #app 缺失时抛出 Error 交给浏览器；原始配置候选、堆栈和内部对象不会写入页面。
 *
 * @param {*} error 配置读取或完整契约校验的失败原因，仅用于开发控制台安全摘要。
 * @returns {HTMLElement} 已挂载到 #app 的故障主区域。
 */
function mountFrontendConfigFailure(error) {
  // 类型: HTMLElement|null；作用: 取得 index.html 唯一应用挂载节点，不创建第二页面根。
  const mountNode = document.getElementById('app');
  // 条件分支: 入口 HTML 缺少约定挂载节点时进入；执行内容: 明确抛错，不向 body 任意追加替代根。
  if (!mountNode) {
    throw new Error('前端启动故障无法找到 #app 挂载节点');
  }

  // 类型: HTMLElement；作用: 承载独立配置故障的语义主体，不依赖项目组件或样式。
  const failureView = document.createElement('main');
  failureView.setAttribute('role', 'alert');
  // 类型: HTMLHeadingElement；作用: 给配置故障提供明确可访问标题。
  const title = document.createElement('h1');
  title.textContent = '前端配置无法使用';
  // 类型: HTMLParagraphElement；作用: 展示稳定处理建议，不回显配置内容或底层异常。
  const message = document.createElement('p');
  message.textContent = FRONTEND_CONFIG_FAILURE_MESSAGE;
  // 类型: HTMLParagraphElement；作用: 展示稳定错误码，便于用户和维护者定位故障类别。
  const errorCode = document.createElement('p');
  errorCode.textContent = `错误码：${FRONTEND_CONFIG_FAILURE_CODE}`;
  // 类型: HTMLButtonElement；作用: 用户修正配置后显式重新加载完整页面启动链。
  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.textContent = '重新加载';
  reloadButton.addEventListener('click', () => window.location.reload());

  failureView.append(title, message, errorCode, reloadButton);
  mountNode.replaceChildren(failureView);
  document.title = '前端配置错误 - Web Video Player';

  // 条件分支: 当前是 Vite 开发环境时进入；执行内容: 只输出错误类型、稳定 code/path 和安全 message，不输出配置候选。
  if (import.meta.env.DEV) {
    console.error('[frontend-config-failure]', {
      name: typeof error?.name === 'string' ? error.name : 'Error',
      code: typeof error?.code === 'string' ? error.code : FRONTEND_CONFIG_FAILURE_CODE,
      path: typeof error?.path === 'string' ? error.path : '',
      message: typeof error?.message === 'string' ? error.message : FRONTEND_CONFIG_FAILURE_MESSAGE
    });
  }

  return failureView;
}

/**
 * 从标准错误包装链中查找可安全公开的持久化错误码。
 * 纯函数: 只读取 Error.code、cause 和 AggregateError.errors；不修改错误、不记录或返回 message、stack 与基础设施对象。
 * 成功路径: 广度遍历遇到首个白名单 code 时立即返回，保持最接近调用边界的稳定分类。
 * 失败路径: 输入不是对象、包装链循环或没有白名单 code 时返回空字符串。
 *
 * @param {*} error SourceRuntime、Repository、AggregateError 或任意 reject 原因。
 * @returns {string} 白名单持久化错误码；不存在时为空字符串。
 */
function findPersistenceStartupCode(error) {
  // 类型: Array<object>；作用: 保存尚未读取的标准错误节点，数组顺序保证外层错误优先。
  const pendingErrors = [error];
  // 类型: Set<object>；作用: 记录已读取引用，阻止异常 cause 或 errors 形成循环时无限遍历。
  const visitedErrors = new Set();

  // 循环条件: 包装链仍有待检查错误节点时继续。
  // 循环作用: 只沿标准 cause 和 AggregateError.errors 读取稳定 code，不解析任何内部文案。
  while (pendingErrors.length > 0) {
    // 类型: *；作用: 取得当前最外层待检查节点。
    const currentError = pendingErrors.shift();
    // 条件分支: 当前节点不是对象或已检查时进入。
    // 执行内容: 跳过不可承载标准错误字段的值和循环引用。
    if (!currentError || typeof currentError !== 'object' || visitedErrors.has(currentError)) {
      continue;
    }
    visitedErrors.add(currentError);

    // 类型: string；作用: 只读取字符串 code，其他类型不能进入页面错误投影。
    const candidateCode = typeof currentError.code === 'string' ? currentError.code : '';
    // 条件分支: 当前节点 code 位于安全提示白名单时进入。
    // 执行内容: 返回稳定分类，不继续读取更深层内部异常。
    if (Object.hasOwn(PERSISTENCE_STARTUP_MESSAGES, candidateCode)) {
      return candidateCode;
    }

    // 条件分支: 当前错误是 AggregateError 或兼容标准 errors 数组时进入。
    // 执行内容: 按数组原顺序加入待检查队列，保留多个并行失败的稳定优先级。
    if (Array.isArray(currentError.errors)) {
      pendingErrors.push(...currentError.errors);
    }
    // 条件分支: 当前错误通过标准 cause 保留了下层失败时进入。
    // 执行内容: 把 cause 加入队列，不读取其 message、stack 或私有字段。
    if (currentError.cause !== undefined) {
      pendingErrors.push(currentError.cause);
    }
  }

  return '';
}

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
 * 副作用: 先完成 SourceManager 稳定投影，再加载用户内容、快捷键和首页展示设置持久化投影。
 * 成功路径: 四个领域都已经收敛后 resolve，页面首次渲染直接读取稳定持久化状态。
 * 失败路径: 任一数据库或保存图失败时 reject 并阻止根实例挂载，不以空数组、默认键位或 mock 伪装成功。
 *
 * @returns {Promise<void>} 应用状态可供页面读取时完成。
 */
async function initializeApplicationState() {
  await initializeSettingsSourceManagement();
  await initializeUserContent();
  await initializeShortcutSettings();
  await initializeHomeDisplaySettings();
}

/**
 * 在应用可交互后启动一次全部已启用数据源健康检查。
 * 副作用: 通过唯一 SourceManagementRuntime 顺序调用各 Provider.checkHealth，SourceManager 发布蓝色 checking 和最终红绿状态。
 * 成功路径: 后台检查独立完成，不阻塞用户内容、设置初始化或首屏挂载。
 * 失败路径: 单源失败由 Manager 收敛；批次基础设施失败只输出开发诊断，不卸载已经挂载的应用。
 *
 * @returns {void} 后台 Promise 不进入启动屏障。
 */
function startInitialSourceHealthChecks() {
  sourceManagementRuntimeInstance.checkAllSources().catch((error) => {
    // 诊断边界: 复用安全摘要，不把 Provider 请求、响应或私有状态输出到控制台。
    reportStartupFailureDiagnostic(error);
  });
}

/**
 * 创建启动失败的开发诊断摘要。
 * 纯函数: 只读取标准 Error.name、code、message、cause 和 AggregateError.errors，不读取数据库、Store 或任意自定义保存字段。
 * 成功路径: 按外层优先顺序返回去重后的冻结错误节点数组，帮助开发者定位稳定错误包装链中的真实失败点。
 * 失败路径: 非对象 reject、循环 cause 或非字符串字段均安全跳过，不抛出第二个诊断错误。
 * 安全边界: 返回值不包含 stack、数据库记录、请求头、Cookie、Token、Provider 私有空间或用户内容。
 *
 * @param {*} error 应用挂载前初始化链的 reject 原因。
 * @returns {ReadonlyArray<Readonly<object>>} 仅包含 name、code 和 message 的安全错误节点摘要。
 */
function createStartupFailureDiagnostic(error) {
  // 类型: Array<object>；作用: 保存待展开的标准错误包装节点，保持最外层失败优先。
  const pendingErrors = [error];
  // 类型: Set<object>；作用: 阻止循环 cause 或重复 AggregateError 子项造成无限遍历。
  const visitedErrors = new Set();
  // 类型: Array<Readonly<object>>；作用: 保存可输出到开发控制台的安全字段摘要。
  const diagnosticEntries = [];

  // 循环条件: 仍有未检查的错误节点时继续；循环作用: 展开标准 cause 和 errors，不解释任何业务对象。
  while (pendingErrors.length > 0) {
    // 类型: *；作用: 取得当前最外层待检查节点。
    const currentError = pendingErrors.shift();
    // 条件分支: 节点不能承载标准错误字段或已经检查时进入；执行内容: 安全跳过。
    if (!currentError || typeof currentError !== 'object' || visitedErrors.has(currentError)) {
      continue;
    }
    visitedErrors.add(currentError);

    diagnosticEntries.push(Object.freeze({
      // 字段类型: string；作用: 标识当前包装节点的错误类型；缺失时使用 Error 兜底，不读取构造器对象。
      name: typeof currentError.name === 'string' && currentError.name ? currentError.name : 'Error',
      // 字段类型: string；作用: 保留领域稳定错误码；非字符串 code 不进入摘要。
      code: typeof currentError.code === 'string' ? currentError.code : '',
      // 字段类型: string；作用: 保留开发定位所需错误说明；非字符串 message 不进入摘要。
      message: typeof currentError.message === 'string' ? currentError.message : ''
    }));

    // 条件分支: 当前节点提供标准 errors 数组时进入；执行内容: 按原顺序继续检查并行失败。
    if (Array.isArray(currentError.errors)) pendingErrors.push(...currentError.errors);
    // 条件分支: 当前节点提供标准 cause 时进入；执行内容: 继续追踪被包装的直接根因。
    if (currentError.cause !== undefined) pendingErrors.push(currentError.cause);
  }

  return Object.freeze(diagnosticEntries);
}

/**
 * 在开发环境报告启动失败诊断摘要。
 * 副作用: 仅当 Vite DEV 为 true 时向浏览器控制台写入一次安全摘要；生产构建不输出内部错误说明。
 * 成功路径: 开发者可区分目录发布冲突、保存图损坏和基础设施失败，页面仍只接收白名单用户提示。
 * 失败路径: console.error 被宿主替换或拒绝时吞掉诊断异常，不覆盖原始启动失败。
 *
 * @param {*} error 应用挂载前初始化链的 reject 原因。
 * @returns {void} 本函数不改变故障视图或初始化 Promise。
 */
function reportStartupFailureDiagnostic(error) {
  // 条件分支: 当前不是 Vite 开发环境时进入；执行内容: 不向生产控制台输出内部错误说明。
  if (!import.meta.env.DEV) return;

  try {
    // 诊断副作用: 只输出已剥离保存数据和 stack 的冻结摘要，不输出原始 Error 对象。
    console.error(
      '[application-startup-failure]',
      JSON.stringify(createStartupFailureDiagnostic(error))
    );
  } catch {
    // 失败边界: 诊断设施不能替代或遮蔽原始故障页，控制台不可用时直接结束。
  }
}

/**
 * 把启动错误转换为可公开的故障视图模型。
 * 纯函数: 沿标准错误包装链读取稳定 code；不读取、记录或返回原始 message、stack 和 cause 内容。
 * 成功路径: 包装链包含已知持久化 code 时返回对应处理建议；其他错误返回应用级兜底模型。
 * 失败路径: 循环包装或非 Error reject 被安全收敛为应用级兜底模型，不向页面泄漏输入字段。
 *
 * @param {*} error Source Runtime、UserContent Repository 或 Vue 挂载前链路的 reject 原因。
 * @returns {Readonly<object>} 安全故障视图模型。
 * @returns {string} return.errorCode 稳定持久化码或应用兜底码。
 * @returns {string} return.message 不含内部异常内容的用户处理建议。
 */
function createStartupFailureViewModel(error) {
  // 类型: string；作用: 从 SourceRuntime 和 Repository 包装链中取得首个白名单持久化分类。
  const candidateCode = findPersistenceStartupCode(error);
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

/**
 * 启动前端应用。
 * 副作用: 依次采用外部配置、动态加载业务模块、初始化持久化状态并挂载正常或业务故障视图。
 * 成功路径: 配置、SourceRuntime、用户内容、快捷键和首页展示偏好全部就绪后挂载 App。
 * 失败路径: 配置失败停留在原生故障视图；业务初始化失败只挂载安全 Vue 故障视图，不采用默认值或 Mock。
 *
 * @returns {Promise<void>} 启动流程结束时兑现；页面视图已经挂载。
 */
async function startApplication() {
  try {
    // 启动屏障: 在任何 Vue、IndexedDB、SourceRuntime 和 Provider 动态模块求值前采用完整公开配置。
    initializeFrontendRuntimeConfig();
  } catch (error) {
    mountFrontendConfigFailure(error);
    return;
  }

  try {
    // 异步调用: 配置通过后才允许业务模块求值和创建应用组合根。
    await loadApplicationModules();
    // 异步调用: 数据源、用户内容、快捷键和首页展示设置完成后才挂载正常 App。
    await initializeApplicationState();
    mountApplication();
    // 启动顺序: 页面先使用 checking 状态完成首屏，再由后台检查逐源收敛为真实红绿结果。
    startInitialSourceHealthChecks();
  } catch (error) {
    // 诊断顺序: 先在开发环境报告安全摘要，再挂载只含白名单 code 和建议的用户故障视图。
    reportStartupFailureDiagnostic(error);
    mountStartupFailure(error);
  }
}

// 异步调用: 只启动一次当前页面生命周期；配置失败或业务失败都在上方收敛，不采用第二启动通道。
startApplication();
