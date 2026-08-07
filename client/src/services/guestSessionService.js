/*
  guestSessionService.js 模块说明

  - 文件职责:
      提供当前版本仅用于界面验证的 guest 模拟登录会话。
      只维护 anonymous/authenticated 展示状态，不连接后端，不创建账号，也不改变 guest-user 用户内容身份。

  - 持久化边界:
      状态只保存在 Vue 内存投影，刷新后恢复 anonymous；不写任何浏览器存储。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 1 条，自定义 0 条):
      Vue: 第三方库，提供登录导航状态响应式投影。

  - 模块级常量:
      GUEST_SESSION_STATUS: Readonly<object>，模拟会话状态枚举。
      GUEST_USERNAME: string，唯一允许的模拟用户名。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createAnonymousSession(): 创建完整未登录投影。
      createGuestSessionService(): 创建隔离响应式会话和登录/退出命令。

  - 模块级类:
      无

  - 对外导出:
      createGuestSessionService: 隔离模拟会话服务工厂，供单元测试使用。
      guestSessionService: 应用唯一会话门面。
      getGuestSessionState/loginGuest/logoutGuest: 会话状态读取和命令。
*/

// 导入来源: vue。
// 导入内容: Vue 构造函数。
// 文件作用: 建立只属于当前 App 会话的响应式登录状态。
import Vue from 'vue';

// 类型: Readonly<object>。
// 作用: 限制模拟登录只存在未登录和已认证两种展示状态。
export const GUEST_SESSION_STATUS = Object.freeze({
  // 类型: string；作用: 未登录时导航显示“登录”按钮。
  anonymous: 'anonymous',
  // 类型: string；作用: 使用 guest 登录成功后导航显示游客用户菜单。
  authenticated: 'authenticated'
});

// 类型: string。
// 作用: 当前版本允许的模拟用户名；它不等于持久化 UserContentState.user.id 的生成逻辑。
export const GUEST_USERNAME = 'guest';

/**
 * 创建未登录的完整会话投影。
 * 纯函数: 每次返回新对象，不读取或清理用户内容。
 *
 * @returns {{status: string, username: string}} 未登录会话。
 */
function createAnonymousSession() {
  return {
    // 类型: string；作用: 未登录状态控制导航只显示登录按钮。
    status: GUEST_SESSION_STATUS.anonymous,
    // 类型: string；作用: 未登录不在导航投影中暴露用户名。
    username: ''
  };
}

/**
 * 创建隔离 guest 模拟会话服务。
 * 副作用: 创建一个 Vue 响应式内存投影；不访问 Router、Repository 或浏览器存储。
 *
 * @returns {object} 包含 getState、login 和 logout 的冻结会话门面。
 */
export function createGuestSessionService() {
  // 类型: object；作用: 当前服务实例的 Vue 响应式内存会话，初始固定为 anonymous。
  const sessionState = Vue.observable(createAnonymousSession());

  /**
   * 读取当前 guest 模拟会话。
   * 纯函数: 返回 Vue 响应式状态引用，不进入 Repository 或浏览器存储。
   *
   * @returns {{status: string, username: string}} 当前会话投影。
   */
  function getState() {
    return sessionState;
  }

  /**
   * 使用 guest 凭据登录模拟会话。
   * 副作用: 成功时只替换内存展示状态，不创建或修改用户内容记录。
   * 失败路径: 用户名不是 guest 或密码非空时返回 false，保持原会话状态。
   *
   * @param {{username?: string, password?: string}} credentials 登录输入。
   * @returns {boolean} true 表示模拟登录成功，false 表示凭据不符合当前版本说明。
   */
  function login(credentials) {
    // 类型: string；作用: 读取并清理登录弹窗提交的用户名。
    const username = typeof credentials?.username === 'string' ? credentials.username.trim() : '';
    // 类型: string；作用: 读取密码原文，guest 模拟登录要求密码为空字符串。
    const password = typeof credentials?.password === 'string' ? credentials.password : '';

    // 条件分支: 用户名或密码不符合当前版本 guest 规则时进入。
    // 执行内容: 拒绝登录并保留原 anonymous/authenticated 状态。
    if (username !== GUEST_USERNAME || password !== '') {
      return false;
    }

    // 副作用: 只替换导航所需内存投影，不复制、不迁移、不清理 guest-user 数据。
    sessionState.status = GUEST_SESSION_STATUS.authenticated;
    sessionState.username = GUEST_USERNAME;
    return true;
  }

  /**
   * 退出 guest 模拟会话。
   * 副作用: 只恢复未登录导航展示，不清除历史、收藏、设置或 currentPlaying。
   *
   * @returns {void} 内存会话恢复 anonymous 后结束。
   */
  function logout() {
    // 类型: object；作用: 创建完整未登录投影，避免只改 status 留下旧 username。
    const anonymousSession = createAnonymousSession();
    sessionState.status = anonymousSession.status;
    sessionState.username = anonymousSession.username;
  }

  return Object.freeze({ getState, login, logout });
}

// 类型: object；作用: 应用唯一模拟会话公开门面，不暴露可写 state 对象替换能力。
export const guestSessionService = createGuestSessionService();

/**
 * 读取应用 guest 模拟会话。
 * 纯函数: 委托唯一服务，不创建页面影子状态。
 *
 * @returns {{status: string, username: string}} 当前会话。
 */
export function getGuestSessionState() {
  return guestSessionService.getState();
}

/**
 * 提交 guest 模拟登录。
 * 副作用: 委托唯一服务更新内存会话。
 *
 * @param {{username?: string, password?: string}} credentials 登录输入。
 * @returns {boolean} 是否登录成功。
 */
export function loginGuest(credentials) {
  return guestSessionService.login(credentials);
}

/**
 * 退出 guest 模拟登录。
 * 副作用: 委托唯一服务恢复 anonymous，不影响用户内容。
 *
 * @returns {void} 退出完成后结束。
 */
export function logoutGuest() {
  guestSessionService.logout();
}
