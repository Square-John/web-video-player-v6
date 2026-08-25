/*
  routeSessionHistory.js 模块说明

  - 文件职责:
      保存当前浏览器标签页中各一级导航最近访问的完整路由和离开时滚动位置。
      本模块只操作调用方注入的 Storage-like 依赖，不读取 window、Router、Store、IndexedDB 或页面响应。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      ROUTE_SESSION_HISTORY_KEY: string，标签页路由历史唯一存储键。
      ROUTE_SESSION_HISTORY_VERSION: number，会话快照结构版本。
      DEFAULT_SCROLL_POSITION: object，无可用历史时使用的页面顶部坐标。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertStorageLike(storage): 校验注入存储的最小接口。
      createEmptySnapshot(): 创建当前结构版本的空会话快照。
      normalizeNavRouteNames(navRouteNames): 校验并冻结允许保存的一级路由名称集合。
      normalizeFullPath(value): 接受站内绝对路径并拒绝外部地址。
      normalizeScrollPosition(position): 把滚动坐标转换为非负整数或页面顶部。
      normalizeSnapshot(value, navRouteNameSet): 校验并隔离存储中的会话快照。
      resolveRouteNavName(route): 从 topNavName 或当前路由名解析一级入口身份。

  - 模块级类:
      无

  - 对外导出:
      ROUTE_SESSION_HISTORY_KEY: 供测试和契约复用唯一存储键。
      createRouteSessionHistory: 创建标签页路由历史适配器。
*/

// 类型: string；作用: 当前标签页路由地址和滚动位置共用的唯一 sessionStorage 键。
export const ROUTE_SESSION_HISTORY_KEY = 'wvp.route-session-history.v1';

// 类型: number；作用: 标识当前 JSON 快照结构，未知版本会失败关闭并回到静态路由。
const ROUTE_SESSION_HISTORY_VERSION = 1;

// 类型: Readonly<object>；作用: 没有匹配滚动历史时让 Vue Router 回到页面左上角。
const DEFAULT_SCROLL_POSITION = Object.freeze({ x: 0, y: 0 });

/**
 * 校验标签页存储依赖是否提供当前适配器需要的窄接口。
 * 纯函数: 只读取方法类型，不调用存储或修改输入。
 * 成功路径: 返回原始 Storage-like 对象供闭包使用。
 * 失败路径: 依赖缺失或接口不完整时抛出 TypeError，禁止创建半可用适配器。
 *
 * @param {*} storage 由 Router 组合根或测试注入的 Storage-like 对象。
 * @returns {object} 通过校验的存储依赖。
 * @throws {TypeError} storage 缺少 getItem、setItem 或 removeItem 时抛出。
 */
function assertStorageLike(storage) {
  // 条件分支: storage 不是可调用接口所属的对象或函数时进入。
  // 执行内容: 立即失败，避免后续读取产生不稳定原生异常。
  if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) {
    throw new TypeError('route session history storage 必须是对象');
  }

  // 条件分支: 任一最小 Storage API 缺失时进入。
  // 执行内容: 拒绝创建只能读不能写或无法清理的会话适配器。
  if (typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function'
    || typeof storage.removeItem !== 'function') {
    throw new TypeError('route session history storage 接口不完整');
  }

  return storage;
}

/**
 * 创建当前结构版本的空路由会话快照。
 * 纯函数: 每次返回新的 entries 对象，不共享可变引用。
 *
 * @returns {object} 空会话快照。
 */
function createEmptySnapshot() {
  return {
    version: ROUTE_SESSION_HISTORY_VERSION,
    entries: {}
  };
}

/**
 * 校验一级导航名称数组并转换为集合。
 * 纯函数: 不修改输入数组。
 * 成功路径: 返回只包含非空唯一字符串的 Set。
 * 失败路径: 输入不是数组、存在空值或重复名称时抛出 TypeError。
 *
 * @param {*} navRouteNames 允许保存历史的一级命名路由数组。
 * @returns {Set<string>} 一级命名路由集合。
 * @throws {TypeError} 名称数组不满足唯一非空字符串约束时抛出。
 */
function normalizeNavRouteNames(navRouteNames) {
  // 条件分支: 调用方没有提供数组或数组为空时进入。
  // 执行内容: 拒绝创建无法识别任何一级路由的适配器。
  if (!Array.isArray(navRouteNames) || navRouteNames.length === 0) {
    throw new TypeError('navRouteNames 必须是非空数组');
  }

  // 类型: Array<string>；作用: 清理路由名称并保留原配置顺序供重复检查。
  const normalizedNames = navRouteNames.map((routeName) => {
    // 条件分支: 名称不是非空字符串时进入。
    // 执行内容: 拒绝把隐式转换值用作会话对象动态键。
    if (typeof routeName !== 'string' || routeName.trim() === '') {
      throw new TypeError('一级导航路由名称必须是非空字符串');
    }
    return routeName.trim();
  });

  // 类型: Set<string>；作用: 既用于运行时白名单判断，也用于验证配置没有重复入口。
  const routeNameSet = new Set(normalizedNames);

  // 条件分支: Set 数量小于输入数量时进入。
  // 执行内容: 拒绝重复一级身份，防止两个按钮争用同一历史槽位。
  if (routeNameSet.size !== normalizedNames.length) {
    throw new TypeError('一级导航路由名称不能重复');
  }

  return routeNameSet;
}

/**
 * 标准化可以交给 Vue Router 的站内完整路径。
 * 纯函数: 不解析或重写 query 与 hash。
 * 成功路径: 以单斜杠开头且不以双斜杠开头的文本原样返回。
 * 失败路径: 外部地址、协议相对地址和空值返回空字符串。
 *
 * @param {*} value 候选 fullPath。
 * @returns {string} 安全站内路径或空字符串。
 */
function normalizeFullPath(value) {
  // 条件分支: 输入不是字符串时进入。
  // 执行内容: 返回空路径，不执行隐式字符串转换。
  if (typeof value !== 'string') {
    return '';
  }

  // 类型: string；作用: 去掉存储污染产生的两端空白，路由内部编码保持原样。
  const normalizedPath = value.trim();

  // 返回值类型: string；作用: 只接受当前站点根路径，阻止会话值构造外部导航。
  return normalizedPath.startsWith('/') && !normalizedPath.startsWith('//')
    ? normalizedPath
    : '';
}

/**
 * 标准化路由滚动位置。
 * 纯函数: 不读取 window，不修改调用方对象。
 * 成功路径: 有限非负坐标向下取整后返回新对象。
 * 失败路径: 非法坐标返回页面顶部。
 *
 * @param {*} position 候选滚动位置。
 * @returns {{x: number, y: number}} 可交给 Vue Router 的滚动坐标。
 */
function normalizeScrollPosition(position) {
  // 类型: number；作用: 将候选横向坐标转换为数字用于有限值和范围校验。
  const x = Number(position && position.x);
  // 类型: number；作用: 将候选纵向坐标转换为数字用于有限值和范围校验。
  const y = Number(position && position.y);

  // 条件分支: 任一坐标不是非负有限数时进入。
  // 执行内容: 使用页面顶部，避免异常会话值让 Router 滚动失败。
  if (!Number.isFinite(x) || x < 0 || !Number.isFinite(y) || y < 0) {
    return { ...DEFAULT_SCROLL_POSITION };
  }

  return {
    x: Math.floor(x),
    y: Math.floor(y)
  };
}

/**
 * 校验存储读取的路由会话快照。
 * 纯函数: 返回新的对象和条目，不把存储解析引用暴露给调用方。
 * 成功路径: 只采用当前版本、白名单一级路由和安全站内路径。
 * 失败路径: 根结构或版本无效时返回空快照；非法单项被忽略。
 *
 * @param {*} value JSON 解析后的候选快照。
 * @param {Set<string>} navRouteNameSet 允许采用的一级路由名称集合。
 * @returns {object} 当前结构版本的隔离会话快照。
 */
function normalizeSnapshot(value, navRouteNameSet) {
  // 条件分支: 根结构、版本或 entries 不符合当前契约时进入。
  // 执行内容: 整体回到空快照，不猜测旧结构或建立兼容别名。
  if (!value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.version !== ROUTE_SESSION_HISTORY_VERSION
    || !value.entries
    || typeof value.entries !== 'object'
    || Array.isArray(value.entries)) {
    return createEmptySnapshot();
  }

  // 类型: object；作用: 收集通过白名单、路径和滚动校验的隔离条目。
  const entries = {};

  // 循环类型: for...of；顺序: 按当前正式一级路由配置检查，不信任存储动态键顺序。
  for (const routeName of navRouteNameSet) {
    // 类型: object|undefined；作用: 读取当前一级路由候选历史条目。
    const entry = value.entries[routeName];
    // 类型: string；作用: 校验条目只能恢复当前站点内部完整路径。
    const fullPath = normalizeFullPath(entry && entry.fullPath);

    // 条件分支: 当前一级路由没有安全路径时进入。
    // 执行内容: 忽略单项，其他合法入口继续恢复。
    if (!fullPath) {
      continue;
    }

    entries[routeName] = {
      fullPath,
      scroll: normalizeScrollPosition(entry.scroll)
    };
  }

  return {
    version: ROUTE_SESSION_HISTORY_VERSION,
    entries
  };
}

/**
 * 从 Vue Router 路由对象解析所属一级导航身份。
 * 纯函数: 优先使用 meta.topNavName，普通一级页面使用自身 name。
 * 失败路径: 路由结构不完整时返回空字符串。
 *
 * @param {*} route Vue Router 当前或来源路由。
 * @returns {string} 一级命名路由或空字符串。
 */
function resolveRouteNavName(route) {
  // 类型: string；作用: 严格详情、播放和设置子路由通过 topNavName 归属对应一级入口。
  const topNavName = route && route.meta && typeof route.meta.topNavName === 'string'
    ? route.meta.topNavName
    : '';

  // 返回值类型: string；作用: 上下文归属优先，普通一级路由回退自身命名路由。
  return topNavName || (route && typeof route.name === 'string' ? route.name : '');
}

/**
 * 创建当前标签页的一级路由历史适配器。
 * 调用方: router/index.js 组合根和独立单元测试。
 * 副作用: 公开方法读写注入的 sessionStorage；不使用 Memory、localStorage 或 IndexedDB 回退。
 * 成功路径: 保存最近站内 fullPath 和离开时滚动坐标，供导航与 scrollBehavior 恢复。
 * 失败路径: Storage 读取、解析或写入失败时返回静态导航/顶部坐标，不中断基本路由能力。
 *
 * @param {object} options 工厂选项。
 * @param {object} options.storage Storage-like 标签页存储依赖。
 * @param {Array<string>} options.navRouteNames 正式一级命名路由白名单。
 * @returns {Readonly<object>} 路由会话历史适配器。
 */
export function createRouteSessionHistory(options = {}) {
  // 类型: object；作用: 保存通过最小接口校验的唯一标签页存储依赖。
  const storage = assertStorageLike(options.storage);
  // 类型: Set<string>；作用: 限制可读写的一级路由动态键，防止存储污染扩张对象边界。
  const navRouteNameSet = normalizeNavRouteNames(options.navRouteNames);

  /**
   * 读取并校验当前路由会话快照。
   * 副作用: 调用注入存储 getItem；不会修改有效内容。
   * 失败路径: Storage 或 JSON 解析失败时返回空快照，不建立其他保存实现。
   *
   * @returns {object} 当前可采用会话快照。
   */
  function readSnapshot() {
    try {
      // 类型: string|null；作用: 从唯一键读取当前标签页快照文本。
      const rawValue = storage.getItem(ROUTE_SESSION_HISTORY_KEY);
      // 条件分支: 当前标签页尚未保存路由历史时进入；执行内容: 返回空快照。
      if (!rawValue) {
        return createEmptySnapshot();
      }
      return normalizeSnapshot(JSON.parse(rawValue), navRouteNameSet);
    } catch {
      // 失败补偿: 会话恢复是可选导航增强，存储不可用时只回到静态入口，不写其他存储。
      return createEmptySnapshot();
    }
  }

  /**
   * 写入完整路由会话快照。
   * 副作用: 调用注入存储 setItem 覆盖唯一键。
   * 成功路径: 返回 true 表示当前标签页已采用新快照。
   * 失败路径: Storage 拒绝时返回 false，调用方继续使用静态路由且不建立回退。
   *
   * @param {object} snapshot 已由当前适配器创建的会话快照。
   * @returns {boolean} 是否成功写入当前标签页。
   */
  function writeSnapshot(snapshot) {
    try {
      storage.setItem(ROUTE_SESSION_HISTORY_KEY, JSON.stringify(snapshot));
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({
    /**
     * 保存一次成功采用的当前路由。
     * 副作用: 把所属一级入口的最近 fullPath 写入唯一会话快照；新路径滚动位置从顶部开始。
     * 失败路径: 路由不属于正式一级入口或路径不安全时返回 false。
     *
     * @param {object} route Vue Router 成功采用的目标路由。
     * @returns {boolean} 是否成功写入会话存储。
     */
    rememberRoute(route) {
      // 类型: string；作用: 把严格路由和设置子路由归并到对应一级入口槽位。
      const navRouteName = resolveRouteNavName(route);
      // 类型: string；作用: 保存 params、query 和 hash 已编码后的完整站内路径。
      const fullPath = normalizeFullPath(route && route.fullPath);

      // 条件分支: 一级身份不在白名单或路径不安全时进入。
      // 执行内容: 拒绝写入未知路由，不影响其他会话条目。
      if (!navRouteNameSet.has(navRouteName) || !fullPath) {
        return false;
      }

      // 类型: object；作用: 读取最近有效快照后只替换当前一级入口条目。
      const snapshot = readSnapshot();
      // 类型: object|undefined；作用: 同一路径重复采用时保留离开前滚动位置。
      const previousEntry = snapshot.entries[navRouteName];

      snapshot.entries[navRouteName] = {
        fullPath,
        scroll: previousEntry && previousEntry.fullPath === fullPath
          ? normalizeScrollPosition(previousEntry.scroll)
          : { ...DEFAULT_SCROLL_POSITION }
      };

      return writeSnapshot(snapshot);
    },

    /**
     * 保存当前路由离开前的滚动位置。
     * 副作用: 只更新所属一级入口且与当前 fullPath 绑定的 scroll 字段。
     * 失败路径: 未知路由或非法路径返回 false；Storage 失败不建立其他保存位置。
     *
     * @param {object} route 即将离开的 Vue Router 路由。
     * @param {{x: number, y: number}} position 当前 window 滚动坐标。
     * @returns {boolean} 是否成功写入会话存储。
     */
    rememberScrollPosition(route, position) {
      // 类型: string；作用: 定位当前路由所属一级入口条目。
      const navRouteName = resolveRouteNavName(route);
      // 类型: string；作用: 让滚动坐标只绑定当前完整请求地址。
      const fullPath = normalizeFullPath(route && route.fullPath);

      // 条件分支: 路由不属于白名单或 fullPath 无效时进入；执行内容: 拒绝保存。
      if (!navRouteNameSet.has(navRouteName) || !fullPath) {
        return false;
      }

      // 类型: object；作用: 更新当前一级入口最近地址和离开时滚动坐标。
      const snapshot = readSnapshot();
      snapshot.entries[navRouteName] = {
        fullPath,
        scroll: normalizeScrollPosition(position)
      };
      return writeSnapshot(snapshot);
    },

    /**
     * 解析一级导航点击应采用的最近地址。
     * 副作用: 只读取注入存储。
     * 成功路径: 存在合法历史时返回 fullPath 字符串，否则返回调用方静态命名位置。
     *
     * @param {string} navRouteName 一级导航命名路由。
     * @param {object} fallbackLocation 路由表声明的静态入口位置。
     * @returns {string|object} Vue Router 可直接采用的历史路径或静态位置。
     */
    resolveNavigationLocation(navRouteName, fallbackLocation) {
      // 条件分支: 调用方请求未知一级入口时进入；执行内容: 原样返回静态位置。
      if (!navRouteNameSet.has(navRouteName)) {
        return fallbackLocation;
      }

      // 类型: object|undefined；作用: 读取当前入口最近成功采用的完整路径。
      const entry = readSnapshot().entries[navRouteName];
      return entry ? entry.fullPath : fallbackLocation;
    },

    /**
     * 读取目标路由应恢复的滚动位置。
     * 副作用: 只读取注入存储。
     * 成功路径: 当前一级入口保存的 fullPath 与目标一致时返回隔离坐标。
     * 失败路径: 没有匹配历史时返回 null，Router 使用页面顶部或浏览器 savedPosition。
     *
     * @param {object} route Vue Router 目标路由。
     * @returns {{x: number, y: number}|null} 匹配滚动位置或 null。
     */
    loadScrollPosition(route) {
      // 类型: string；作用: 定位目标路由所属一级入口。
      const navRouteName = resolveRouteNavName(route);
      // 类型: string；作用: 防止同一入口的新请求地址错误复用旧地址滚动位置。
      const fullPath = normalizeFullPath(route && route.fullPath);

      // 条件分支: 路由不属于白名单或路径无效时进入；执行内容: 返回无历史。
      if (!navRouteNameSet.has(navRouteName) || !fullPath) {
        return null;
      }

      // 类型: object|undefined；作用: 读取当前一级入口最近保存条目。
      const entry = readSnapshot().entries[navRouteName];
      // 条件分支: 最近地址与目标不一致时进入；执行内容: 不跨请求地址恢复滚动。
      if (!entry || entry.fullPath !== fullPath) {
        return null;
      }

      return normalizeScrollPosition(entry.scroll);
    },

    /**
     * 读取指定一级入口当前保存的完整地址集合。
     * 副作用: 只读取注入存储，不修改快照或 Router。
     * 成功路径: 只返回调用方请求且属于正式白名单的现有地址。
     *
     * @param {Array<string>} navRouteNames 准备恢复的一级导航身份。
     * @returns {Readonly<object>} 以一级导航身份为键的安全完整地址投影。
     */
    readNavigationLocations(navRouteNames) {
      // 类型: Array<string>；作用: 把调用方输入限制为可遍历的一级导航身份列表。
      const requestedRouteNames = Array.isArray(navRouteNames) ? navRouteNames : [];
      // 类型: object；作用: 一次读取当前标签页路由快照，保证本次投影来自同一存储版本。
      const snapshot = readSnapshot();
      // 类型: Record<string, string>；作用: 收集白名单动态入口的最近完整地址。
      const locations = {};
      requestedRouteNames.forEach((navRouteName) => {
        // 条件分支: 请求身份不属于正式一级导航白名单时进入；执行内容: 忽略未知身份，禁止从存储恢复任意路由。
        if (!navRouteNameSet.has(navRouteName)) return;
        // 类型: object|undefined；作用: 读取当前白名单入口保存的地址条目。
        const entry = snapshot.entries[navRouteName];
        // 条件分支: 当前入口存在有效保存条目时进入；执行内容: 将完整地址加入只读恢复投影。
        if (entry) locations[navRouteName] = entry.fullPath;
      });
      return Object.freeze({ ...locations });
    },

    /**
     * 删除一个一级入口的最近地址和滚动位置。
     * 副作用: 原子替换同一路由会话快照；用于显式关闭动态导航后阻止硬刷新复活旧入口。
     * 失败路径: 未知入口或存储失败返回 false，不修改其它入口。
     *
     * @param {string} navRouteName 需要忘记的一级导航身份。
     * @returns {boolean} 是否成功提交删除；条目本来不存在时也返回 true。
     */
    forgetNavigationLocation(navRouteName) {
      // 条件分支: 目标身份不属于正式一级导航白名单时进入；执行内容: 拒绝修改路由会话快照。
      if (!navRouteNameSet.has(navRouteName)) return false;
      // 类型: object；作用: 读取当前标签页路由快照，作为删除目标入口的原子写入基础。
      const snapshot = readSnapshot();
      // 条件分支: 目标入口本来就不存在时进入；执行内容: 以幂等成功结束且不产生无意义存储写入。
      if (!Object.prototype.hasOwnProperty.call(snapshot.entries, navRouteName)) return true;
      delete snapshot.entries[navRouteName];
      return writeSnapshot(snapshot);
    },

    /**
     * 清理当前标签页路由历史。
     * 副作用: 幂等移除唯一会话键，不触碰活动源键、IndexedDB 或页面 Store。
     * 失败路径: Storage 拒绝时返回 false。
     *
     * @returns {boolean} 是否成功执行存储清理。
     */
    clear() {
      try {
        storage.removeItem(ROUTE_SESSION_HISTORY_KEY);
        return true;
      } catch {
        return false;
      }
    }
  });
}
