/*
  navigationContextRestoreService.js 模块说明

  - 文件职责:
      根据当前 Vue Router 地址和标签页保存的动态一级入口地址重建导航上下文。
      供 App 根组件在 AppNavbar 与异步页面创建前恢复搜索、详情和播放导航，并在严格路由变化后同步当前目标。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      navigationContextService exports: 自定义导航服务，提供正式 key、一级路由归属和上下文注册能力。
      getContentRouteShell: 自定义页面壳 selector，按严格内容身份读取已水合标题。

  - 模块级常量:
      RESTORABLE_NAV_ROUTE_NAMES: ReadonlyArray<string>，允许从路由会话恢复的三个动态一级入口。
      DETAIL_PENDING_TITLE: string，详情实体尚未水合时的稳定导航标题。
      PLAYER_PENDING_TITLE: string，播放实体尚未水合时的稳定导航标题。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeText(value): 把路由字段收敛为去首尾空白字符串。
      createNavigationContextFromRoute(route): 从已解析 Route 和页面壳创建标准动态上下文。

  - 模块级类:
      无

  - 对外导出:
      synchronizeNavigationContextForRoute: Function，为一个当前严格路由注册或更新动态上下文。
      restoreNavigationContexts: Function，恢复标签页历史上下文并用当前路由覆盖同 key 旧地址。
*/

import {
  // 导入来源: ./navigationContextService.js；导入内容: NAVIGATION_CONTEXT_KEY；文件作用: 使用正式动态上下文身份。
  NAVIGATION_CONTEXT_KEY,
  // 导入来源: ./navigationContextService.js；导入内容: NAVIGATION_CONTEXT_ROUTE_NAME；文件作用: 绑定动态上下文对应一级入口。
  NAVIGATION_CONTEXT_ROUTE_NAME,
  // 导入来源: ./navigationContextService.js；导入内容: registerNavigationContext；文件作用: 原子注册或替换恢复上下文。
  registerNavigationContext
} from './navigationContextService.js';

// 导入来源: ./contentRouteShellService.js。
// 导入内容: getContentRouteShell 严格内容页面壳 selector。
// 文件作用: 恢复详情或播放导航时优先采用已水合 ContentItem 标题。
import { getContentRouteShell } from './contentRouteShellService.js';

// 类型: ReadonlyArray<string>；作用: 路由会话只向恢复器交付三个动态一级入口，固定导航继续由 routes 派生。
const RESTORABLE_NAV_ROUTE_NAMES = Object.freeze([
  NAVIGATION_CONTEXT_ROUTE_NAME.search,
  NAVIGATION_CONTEXT_ROUTE_NAME.detail,
  NAVIGATION_CONTEXT_ROUTE_NAME.player
]);

// 类型: string；作用: 直接详情 URL 尚无可用实体时仍让首屏导航拥有稳定文案。
const DETAIL_PENDING_TITLE = '正在加载详情';

// 类型: string；作用: 直接播放 URL 尚无可用实体时仍让首屏导航拥有稳定文案。
const PLAYER_PENDING_TITLE = '正在准备播放';

/**
 * 标准化导航恢复文本。
 * 纯函数: 字符串去首尾空白，其他输入返回空字符串。
 *
 * @param {*} value 路由参数、query 或内容标题候选。
 * @returns {string} 可参与身份判断的文本。
 */
function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 从一个已解析路由创建标准动态导航上下文。
 * 纯函数: 读取共享实体池但不修改 Router、Store 或路由会话；返回对象由导航服务再次校验和隔离。
 * 成功路径: 有效搜索关键词、严格详情或严格播放返回上下文。
 * 失败路径: 空入口、固定路由或身份不完整时返回 null。
 *
 * @param {*} route Vue Router 已解析 Route。
 * @returns {object|null} 标准动态导航上下文或 null。
 */
function createNavigationContextFromRoute(route) {
  // 类型: string；作用: 标准化当前已解析路由名称，供动态入口分流判断。
  const routeName = normalizeText(route?.name);
  // 类型: string；作用: 标准化导航上下文最终跳转和会话覆盖使用的完整地址。
  const fullPath = normalizeText(route?.fullPath);
  // 条件分支: 当前路由没有可恢复完整地址时进入；执行内容: 拒绝创建无法导航的动态上下文。
  if (!fullPath) return null;

  // 条件分支: 当前是搜索结果路由时进入；执行内容: 按关键词创建搜索动态导航上下文。
  if (routeName === 'search') {
    // 类型: string；作用: 标准化 URL 中作为搜索页面事实的关键词。
    const keyword = normalizeText(route?.query?.keyword);
    // 条件分支: 搜索路由没有有效关键词时进入；执行内容: 不恢复没有结果语义的搜索入口。
    if (!keyword) return null;
    return {
      key: NAVIGATION_CONTEXT_KEY.search,
      navRouteName: NAVIGATION_CONTEXT_ROUTE_NAME.search,
      label: '搜索结果',
      fullPath,
      title: keyword,
      sourceId: '',
      contentId: ''
    };
  }

  // 条件分支: 当前既不是详情也不是播放路由时进入；执行内容: 固定导航不创建动态上下文。
  if (routeName !== 'detail' && routeName !== 'player') return null;
  // 类型: string；作用: 标准化严格内容路由的数据源身份。
  const sourceId = normalizeText(route?.params?.sourceId);
  // 类型: string；作用: 标准化严格内容路由的视频身份。
  const contentId = normalizeText(route?.params?.videoId);
  // 条件分支: 严格内容身份任一缺失时进入；执行内容: 拒绝创建不能唯一定位内容的导航上下文。
  if (!sourceId || !contentId) return null;
  // 类型: string；作用: 从共享页面壳读取已水合标题，尚未水合时保留空值供稳定加载标题接管。
  const contentTitle = normalizeText(getContentRouteShell(sourceId, contentId)?.title);

  // 条件分支: 当前是严格详情路由时进入；执行内容: 创建详情入口并在无实体时显示稳定加载标题。
  if (routeName === 'detail') {
    // 类型: string；作用: 决定详情导航展示已水合内容标题或加载占位标题。
    const title = contentTitle || DETAIL_PENDING_TITLE;
    return {
      key: NAVIGATION_CONTEXT_KEY.detail,
      navRouteName: NAVIGATION_CONTEXT_ROUTE_NAME.detail,
      label: '详情',
      fullPath,
      title,
      sourceId,
      contentId
    };
  }

  // 类型: string；作用: 决定播放导航展示已水合内容标题或准备播放占位标题。
  const title = contentTitle || PLAYER_PENDING_TITLE;
  return {
    key: NAVIGATION_CONTEXT_KEY.player,
    navRouteName: NAVIGATION_CONTEXT_ROUTE_NAME.player,
    label: `正在播放:${title}`,
    fullPath,
    title,
    sourceId,
    contentId
  };
}

/**
 * 为一个当前严格路由注册或更新动态导航上下文。
 * 副作用: 合法上下文通过导航服务按 key 原子替换；固定或空入口保持现有后台上下文。
 *
 * @param {*} route Vue Router 当前 Route。
 * @returns {object|null} 已注册上下文或 null。
 */
export function synchronizeNavigationContextForRoute(route) {
  // 类型: object|null；作用: 将当前严格路由转换为导航服务可注册的标准上下文。
  const context = createNavigationContextFromRoute(route);
  return context ? registerNavigationContext(context) : null;
}

/**
 * 恢复当前标签页动态导航上下文。
 * 副作用: 读取路由会话保存地址，使用 Router 解析后逐项注册；最后以当前严格 Route 覆盖同 key 旧地址。
 * 成功路径: 保存的有效搜索、详情、播放上下文和当前直接 URL 在 App 子组件创建前恢复。
 * 失败路径: 单个旧地址无法解析或不再满足严格契约时忽略该项，其它上下文继续恢复。
 *
 * @param {object} options 恢复依赖。
 * @param {object} options.router Vue Router 实例，提供 resolve。
 * @param {object} options.routeSessionHistory 路由会话门面，提供 readNavigationLocations。
 * @param {object} options.currentRoute 当前已经解析的 Route。
 * @returns {ReadonlyArray<object>} 本次成功注册的上下文快照。
 * @throws {TypeError} Router 或路由会话接口缺失时抛出。
 */
export function restoreNavigationContexts({ router, routeSessionHistory, currentRoute } = {}) {
  // 条件分支: Router 没有提供正式地址解析接口时进入；执行内容: 抛出配置错误并阻止不可信历史地址恢复。
  if (!router || typeof router.resolve !== 'function') {
    throw new TypeError('导航恢复需要 Vue Router resolve 接口');
  }
  // 条件分支: 路由会话门面没有批量读取接口时进入；执行内容: 抛出配置错误并阻止构造不完整恢复结果。
  if (!routeSessionHistory || typeof routeSessionHistory.readNavigationLocations !== 'function') {
    throw new TypeError('导航恢复需要路由会话读取接口');
  }

  // 类型: Array<object>；作用: 按动态入口收集本次成功注册的导航上下文。
  const restoredContexts = [];
  // 类型: Readonly<Record<string, string>>；作用: 一次读取搜索、详情和播放后台入口的最近完整地址。
  const savedLocations = routeSessionHistory.readNavigationLocations(RESTORABLE_NAV_ROUTE_NAMES);
  RESTORABLE_NAV_ROUTE_NAMES.forEach((navRouteName) => {
    // 类型: string；作用: 标准化当前动态入口保存地址，拒绝空值进入 Router 解析。
    const fullPath = normalizeText(savedLocations[navRouteName]);
    // 条件分支: 当前动态入口没有保存地址时进入；执行内容: 跳过该入口并继续恢复其它入口。
    if (!fullPath) return;
    try {
      // 类型: object|null；作用: 解析并注册当前历史地址对应的标准动态导航上下文。
      const restoredContext = synchronizeNavigationContextForRoute(router.resolve(fullPath).route);
      // 条件分支: 历史地址仍满足当前动态上下文契约时进入；执行内容: 记录成功恢复结果。
      if (restoredContext) restoredContexts.push(restoredContext);
    } catch {
      // 单个历史地址失效只关闭该上下文恢复，当前 URL 和其它上下文仍继续处理。
    }
  });

  // 类型: object|null；作用: 注册当前浏览器地址，并准备覆盖同类后台历史地址。
  const currentContext = synchronizeNavigationContextForRoute(currentRoute);
  // 条件分支: 当前地址属于有效动态入口时进入；执行内容: 让当前地址覆盖同 key 历史上下文或补充为新入口。
  if (currentContext) {
    // 类型: number；作用: 定位已经从会话历史恢复的同类动态导航上下文。
    const existingIndex = restoredContexts.findIndex(context => context.key === currentContext.key);
    // 条件分支: 已存在同 key 历史上下文时进入；执行内容: 用当前浏览器地址和标题原位替换旧入口。
    if (existingIndex >= 0) restoredContexts.splice(existingIndex, 1, currentContext);
    else restoredContexts.push(currentContext);
  }
  return Object.freeze(restoredContexts.map(context => Object.freeze({ ...context })));
}
