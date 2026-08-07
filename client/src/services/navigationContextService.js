/*
  navigationContextService.js 模块说明

  - 文件职责:
      保存搜索结果、详情和正在播放三个动态导航上下文的唯一内存投影。
      负责上下文注册、按拥有地址清理、固定导航回退位置和订阅通知。
      不读取 Router、ContentItem、Store、播放器实例或 Provider；调用方提交的标准对象由服务统一校验。

  - 持久化边界:
      所有状态只属于当前 App 会话，不写 IndexedDB、localStorage、sessionStorage 或 Router query。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 1 条，自定义 0 条):
      Vue: 第三方库，用于让服务状态在 Vue 组件 computed 中保持响应式。

  - 模块级常量:
      NAVIGATION_CONTEXT_KEY: Readonly<object>，动态上下文允许的 key。
      NAVIGATION_CONTEXT_ROUTE_NAME: Readonly<object>，上下文对应的一级路由名称。
      FIXED_ROUTE_NAMES: Readonly<Set<string>>，可作为关闭回退目标的固定路由名称。

  - 模块级辅助函数:
      normalizeText(value): 把输入标准化成安全单行文本。
      createEmptyState(): 创建新的完整导航上下文投影。
      normalizeContext(value): 校验并隔离单个上下文对象。
      cloneSnapshot(state): 为订阅者生成隔离快照。

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      createNavigationContextService(options): 创建隔离的导航上下文服务，供单元测试使用。
      navigationContextService: 应用唯一导航上下文服务。
      getNavigationContextState/subscribeNavigationContext/registerNavigationContext/removeNavigationContext/
      rememberFixedNavigation/resolveNavigationFallback: 应用服务门面函数。
*/

// 导入来源: vue。
// 导入内容: Vue 构造函数。
// 文件作用: 使用 Vue.observable 让内存服务状态可以被 AppNavbar 和页面 computed 追踪。
import Vue from 'vue';

// 类型: Readonly<object>。
// 作用: 限制动态导航上下文的身份集合，避免页面自行增加没有关闭和回退语义的入口。
export const NAVIGATION_CONTEXT_KEY = Object.freeze({
  // 类型: string；作用: 搜索关键词上下文的唯一身份。
  search: 'search',
  // 类型: string；作用: 详情内容上下文的唯一身份。
  detail: 'detail',
  // 类型: string；作用: 正在播放内容上下文的唯一身份。
  player: 'player'
});

// 类型: Readonly<object>。
// 作用: 把动态上下文绑定到已有一级路由身份，避免 AppNavbar 重新猜测参数路由归属。
export const NAVIGATION_CONTEXT_ROUTE_NAME = Object.freeze({
  // 类型: string；作用: 搜索上下文归属的一级路由名称。
  search: 'search',
  // 类型: string；作用: 详情上下文归属的一级路由名称。
  detail: 'detail-entry',
  // 类型: string；作用: 播放上下文归属的一级路由名称。
  player: 'player-entry'
});

// 类型: Readonly<Set<string>>。
// 作用: 关闭动态上下文后只允许回退到这些固定页面，不回退到空参数详情或播放入口。
const FIXED_ROUTE_NAMES = new Set(['home', 'movie', 'tv', 'profile', 'settings']);

/**
 * 标准化导航服务文本。
 * 纯函数: 不访问 Vue、Router 或浏览器，只把输入收敛为无换行单行文本。
 * 失败路径: 非字符串输入返回空字符串，调用方再按字段契约拒绝无效值。
 *
 * @param {*} value 可能来自路由、ContentItem 或搜索 query 的文本输入。
 * @returns {string} 清理后的单行文本。
 */
function normalizeText(value) {
  // 条件分支: 输入不是字符串时进入。
  // 执行内容: 返回空字符串，禁止对象或数字隐式转换成导航展示和身份。
  if (typeof value !== 'string') {
    return '';
  }

  // 返回值类型: string；作用: 清理换行和首尾空白，防止导航标签破坏布局或 aria 文案。
  return value.replace(/[\r\n\t]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

/**
 * 创建完整的导航上下文初始状态。
 * 纯函数: 每次返回新数组和新标量，不共享测试或应用实例的可变引用。
 *
 * @returns {{contexts: Array<object>, recentFixedRouteName: string}} 空导航上下文状态。
 */
function createEmptyState() {
  return {
    // 类型: Array<object>；作用: 保存当前有效的动态导航上下文。
    contexts: [],
    // 类型: string；作用: 应用首次启动时使用首页作为稳定回退页。
    recentFixedRouteName: 'home'
  };
}

/**
 * 校验并隔离一个导航上下文。
 * 纯函数: 不修改输入对象，不读取页面或业务 Store。
 * 成功路径: 返回字段完整的冻结上下文对象。
 * 失败路径: 缺少标准身份、地址或展示标题时返回 null，不注册无效上下文。
 *
 * @param {*} value 页面提交的导航上下文候选。
 * @returns {Readonly<object>|null} 合法上下文或 null。
 */
function normalizeContext(value) {
  // 条件分支: 输入不是普通对象时进入。
  // 执行内容: 拒绝 null、数组和带有不可预测原型的页面对象。
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  // 类型: string；作用: 读取上下文唯一 key，供后续白名单和替换逻辑使用。
  const key = normalizeText(value.key);
  // 条件分支: key 不属于三个正式上下文时进入。
  // 执行内容: 拒绝页面自行创建动态导航入口。
  if (!Object.values(NAVIGATION_CONTEXT_KEY).includes(key)) {
    return null;
  }

  // 类型: string；作用: 读取路由归属名称，保证上下文导航仍连接既有 Router 语义。
  const navRouteName = normalizeText(value.navRouteName);
  // 类型: string；作用: 读取已经清理过的导航标签。
  const label = normalizeText(value.label);
  // 类型: string；作用: 读取当前有效的完整路由地址。
  const fullPath = normalizeText(value.fullPath);
  // 类型: string；作用: 读取搜索关键词或内容标题。
  const title = normalizeText(value.title);
  // 类型: string；作用: 读取详情/播放来源身份，搜索上下文保持空值。
  const sourceId = normalizeText(value.sourceId);
  // 类型: string；作用: 读取详情/播放内容身份，搜索上下文保持空值。
  const contentId = normalizeText(value.contentId);

  // 条件分支: 任何通用字段缺失时进入。
  // 执行内容: 不让 AppNavbar 渲染无法导航或无法关闭的标签。
  if (!navRouteName || !label || !fullPath || !title) {
    return null;
  }

  // 条件分支: 详情或播放缺少内容身份时进入。
  // 执行内容: 让媒体不可达与内容身份缺失明确区分。
  if ((key === NAVIGATION_CONTEXT_KEY.detail || key === NAVIGATION_CONTEXT_KEY.player)
    && (!sourceId || !contentId)) {
    return null;
  }

  // 条件分支: 搜索上下文携带业务内容身份时进入。
  // 执行内容: 保持搜索标签只表达关键词，防止跨页内容字段污染搜索上下文。
  if (key === NAVIGATION_CONTEXT_KEY.search && (sourceId || contentId)) {
    return null;
  }

  // 返回值类型: Readonly<object>；作用: 给服务状态和订阅者提供隔离的标准对象。
  return Object.freeze({ key, navRouteName, label, fullPath, title, sourceId, contentId });
}

/**
 * 创建订阅者可安全读取的状态快照。
 * 纯函数: 只复制顶层、上下文数组和上下文字段，不暴露服务内部对象引用。
 *
 * @param {{contexts: Array<object>, recentFixedRouteName: string}} state 服务内部状态。
 * @returns {{contexts: Array<object>, recentFixedRouteName: string}} 隔离状态快照。
 */
function cloneSnapshot(state) {
  return Object.freeze({
    // 类型: Array<object>；作用: 复制上下文，防止订阅者修改服务内部数组。
    contexts: state.contexts.map(context => Object.freeze({ ...context })),
    // 类型: string；作用: 复制最近固定回退身份。
    recentFixedRouteName: state.recentFixedRouteName
  });
}

/**
 * 创建隔离的导航上下文服务。
 * 副作用: 创建一个 Vue 响应式内存状态，不接触浏览器存储、Router 或业务数据。
 *
 * @returns {object} 导航上下文服务公开门面。
 */
export function createNavigationContextService() {
  // 类型: object；作用: 保存当前 App 会话的唯一动态导航投影。
  const state = Vue.observable(createEmptyState());
  // 类型: Set<Function>；作用: 保存外部订阅者，通知异常不能中断状态采用。
  const listeners = new Set();

  /**
   * 通知状态订阅者。
   * 副作用: 同步交付隔离快照；单个监听器异常不会影响其它监听器。
   *
   * @returns {void} 所有监听器通知完成后结束。
   */
  function notify() {
    // 类型: Readonly<object>；作用: 本次发布的隔离状态，避免监听器读取内部引用。
    const snapshot = cloneSnapshot(state);
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // 失败处理: 订阅者错误不回滚已采用的导航状态，也不阻断其它组件收到更新。
      }
    });
  }

  return Object.freeze({
    /**
     * 读取响应式导航状态。
     * 纯函数: 返回服务内部 Vue observable 引用，Vue computed 读取字段后自动建立依赖。
     *
     * @returns {{contexts: Array<object>, recentFixedRouteName: string}} 当前响应式投影。
     */
    getState() {
      return state;
    },

    /**
     * 订阅导航上下文发布。
     * 副作用: 立即交付当前快照；返回幂等取消函数。
     *
     * @param {Function} listener 接收隔离导航快照的监听器。
     * @returns {Function} 取消订阅函数。
     */
    subscribe(listener) {
      // 条件分支: listener 不是函数时进入。
      // 执行内容: 在写入订阅集合前拒绝无法调用的监听器。
      if (typeof listener !== 'function') {
        throw new TypeError('navigationContextService listener 必须是函数');
      }
      listeners.add(listener);
      listener(cloneSnapshot(state));
      return () => listeners.delete(listener);
    },

    /**
     * 注册或替换动态导航上下文。
     * 副作用: 同 key 的旧上下文被完整替换，并向订阅者发布新快照。
     *
     * @param {object} context 页面提交的标准上下文对象。
     * @returns {Readonly<object>} 已采用上下文。
     * @throws {TypeError} 上下文不符合正式契约时抛出。
     */
    register(context) {
      // 类型: Readonly<object>|null；作用: 保存经过完整契约校验的隔离上下文。
      const normalizedContext = normalizeContext(context);
      // 条件分支: 页面提交对象不符合导航上下文契约时进入。
      // 执行内容: 抛出类型错误并保留现有服务状态。
      if (!normalizedContext) {
        throw new TypeError('navigationContextService context 不符合契约');
      }

      // 类型: Array<object>；作用: 移除同 key 旧上下文，为原子追加当前对象准备新数组。
      const remaining = state.contexts.filter(item => item.key !== normalizedContext.key);
      state.contexts = [...remaining, normalizedContext];
      notify();
      return normalizedContext;
    },

    /**
     * 移除动态导航上下文。
     * 副作用: 只有 key 匹配且 ownerFullPath 为空或与当前上下文一致时才移除。
     *
     * @param {string} key 要移除的上下文身份。
     * @param {string} [ownerFullPath] 页面拥有地址，防止旧页面销毁删除新页面上下文。
     * @returns {boolean} true 表示实际移除，false 表示没有匹配或所有权不符。
     */
    remove(key, ownerFullPath = '') {
      // 类型: string；作用: 标准化调用方提交的上下文身份。
      const normalizedKey = normalizeText(key);
      // 类型: object|undefined；作用: 定位当前服务中同 key 的唯一上下文。
      const currentContext = state.contexts.find(item => item.key === normalizedKey);
      // 条件分支: 当前不存在同 key 上下文，或页面拥有地址与当前上下文不一致时进入。
      // 执行内容: 保留现有状态并返回 false，防止旧组件销毁删除新页面上下文。
      if (!currentContext || (ownerFullPath && currentContext.fullPath !== normalizeText(ownerFullPath))) {
        return false;
      }

      state.contexts = state.contexts.filter(item => item.key !== normalizedKey);
      notify();
      return true;
    },

    /**
     * 记录最近成功进入的固定导航。
     * 副作用: 只更新内存回退身份，不写 sessionStorage；非法路由不会覆盖现有值。
     *
     * @param {string} routeName 固定一级路由名称。
     * @returns {string} 已采用的固定路由名称。
     */
    rememberFixedRoute(routeName) {
      // 类型: string；作用: 标准化 Router 成功采用的固定导航名称。
      const normalizedRouteName = normalizeText(routeName);
      // 条件分支: 路由不属于正式固定导航集合时进入。
      // 执行内容: 保留现有回退目标，避免动态或设置子路由覆盖固定身份。
      if (!FIXED_ROUTE_NAMES.has(normalizedRouteName)) {
        return state.recentFixedRouteName;
      }

      // 条件分支: 新固定路由与最近记录不同时进入。
      // 执行内容: 更新唯一内存身份并发布订阅通知。
      if (state.recentFixedRouteName !== normalizedRouteName) {
        state.recentFixedRouteName = normalizedRouteName;
        notify();
      }
      return state.recentFixedRouteName;
    },

    /**
     * 解析关闭上下文后的固定回退地址。
     * 纯函数: 只读取当前内存上下文和最近固定路由，不执行 Router 或媒体命令。
     *
     * @param {string} key 要关闭的上下文身份。
     * @returns {string} 关闭后优先采用的 fullPath；没有上下文时返回空字符串。
     */
    resolveFallback(key) {
      // 类型: string；作用: 标准化待关闭上下文身份，供确定性回退分支比较。
      const normalizedKey = normalizeText(key);
      // 条件分支: 关闭详情上下文时进入。
      // 执行内容: 优先返回仍有效的搜索地址，否则返回最近固定页面路径。
      if (normalizedKey === NAVIGATION_CONTEXT_KEY.detail) {
        // 类型: object|undefined；作用: 保存仍有效的搜索上下文，供详情关闭后恢复反向链路。
        const searchContext = state.contexts.find(item => item.key === NAVIGATION_CONTEXT_KEY.search);
        return searchContext?.fullPath || `/${state.recentFixedRouteName === 'home' ? '' : state.recentFixedRouteName}`;
      }

      // 条件分支: 关闭播放上下文时进入。
      // 执行内容: 优先返回对应详情地址，否则返回最近固定页面路径。
      if (normalizedKey === NAVIGATION_CONTEXT_KEY.player) {
        // 类型: object|undefined；作用: 保存仍有效详情上下文，供播放器完整关闭后恢复内容页。
        const detailContext = state.contexts.find(item => item.key === NAVIGATION_CONTEXT_KEY.detail);
        return detailContext?.fullPath || `/${state.recentFixedRouteName === 'home' ? '' : state.recentFixedRouteName}`;
      }

      return `/${state.recentFixedRouteName === 'home' ? '' : state.recentFixedRouteName}`;
    },

    /**
     * 清空当前服务上下文。
     * 副作用: 只用于应用测试隔离或完整 App 会话销毁，不执行持久化清理。
     *
     * @returns {void} 状态回到完整空投影。
     */
    clear() {
      // 类型: object；作用: 创建全新空状态，避免测试或销毁流程复用旧数组引用。
      const emptyState = createEmptyState();
      state.contexts = emptyState.contexts;
      state.recentFixedRouteName = emptyState.recentFixedRouteName;
      notify();
    }
  });
}

// 类型: object；作用: 应用唯一导航上下文服务，所有页面和 AppNavbar 共享同一内存状态。
export const navigationContextService = createNavigationContextService();

/**
 * 读取应用导航上下文状态。
 * 纯函数: 委托唯一服务，不创建第二份页面状态。
 *
 * @returns {{contexts: Array<object>, recentFixedRouteName: string}} 当前导航状态。
 */
export function getNavigationContextState() {
  return navigationContextService.getState();
}

/**
 * 订阅应用导航上下文状态。
 * 副作用: 委托唯一服务并返回幂等取消函数。
 *
 * @param {Function} listener 导航状态监听器。
 * @returns {Function} 取消订阅函数。
 */
export function subscribeNavigationContext(listener) {
  return navigationContextService.subscribe(listener);
}

/**
 * 注册应用动态导航上下文。
 * 副作用: 委托唯一服务采用上下文并发布状态。
 *
 * @param {object} context 页面提交的标准上下文。
 * @returns {Readonly<object>} 已采用上下文。
 */
export function registerNavigationContext(context) {
  return navigationContextService.register(context);
}

/**
 * 移除应用动态导航上下文。
 * 副作用: 委托唯一服务按 key 和可选拥有地址清理状态。
 *
 * @param {string} key 上下文身份。
 * @param {string} [ownerFullPath] 页面拥有地址。
 * @returns {boolean} 是否实际移除。
 */
export function removeNavigationContext(key, ownerFullPath) {
  return navigationContextService.remove(key, ownerFullPath);
}

/**
 * 记录最近固定导航。
 * 副作用: 委托唯一服务更新内存回退身份。
 *
 * @param {string} routeName 固定导航路由名称。
 * @returns {string} 已采用固定路由名称。
 */
export function rememberFixedNavigation(routeName) {
  return navigationContextService.rememberFixedRoute(routeName);
}

/**
 * 解析动态上下文关闭后的回退地址。
 * 纯函数: 委托唯一服务读取当前上下文和固定回退身份。
 *
 * @param {string} key 上下文身份。
 * @returns {string} 目标完整路径。
 */
export function resolveNavigationFallback(key) {
  return navigationContextService.resolveFallback(key);
}
