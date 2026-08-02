/*
  route-session-history.test.js 模块说明

  - 文件职责:
      验证 RouteSessionHistory 的标签页地址、滚动位置、一级路由白名单、刷新恢复和失败回退边界。
      测试只使用注入的 Storage-like 夹具，不启动 Vue、Vue Router、Provider、Store 或浏览器页面。

  - 导入库及文件汇总(3 条，内置 2 条，第三方 0 条，自定义 1 条):
      node:assert/strict: Node 内置严格断言库，验证返回值和隔离快照。
      node:test: Node 内置测试注册器，提供同步测试用例。
      routeSessionHistory: 自定义标签页路由历史适配器，提供工厂和唯一存储键。

  - 模块级常量:
      NAV_ROUTE_NAMES: Array<string>，测试用一级路由白名单。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createStorageFixture(): 创建可观察且可复用的 Storage-like 夹具。
      createRoute(name, fullPath, topNavName): 创建最小 Vue Router 路由对象。

  - 模块级类:
      无

  - 对外导出:
      无，测试通过 node:test 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言门面。
// 文件作用: 验证路由地址、滚动坐标、失败回退和存储隔离。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test 测试注册函数。
// 文件作用: 注册相互隔离的路由会话适配器用例。
import test from 'node:test';

import {
  // 导入来源: ../src/router/routeSessionHistory.js。
  // 导入内容: createRouteSessionHistory 标签页路由历史工厂。
  // 文件作用: 创建不依赖浏览器全局对象的被测适配器。
  createRouteSessionHistory,
  // 导入来源: ../src/router/routeSessionHistory.js。
  // 导入内容: ROUTE_SESSION_HISTORY_KEY 唯一会话键。
  // 文件作用: 验证所有读写都收敛到同一标签页保存位置。
  ROUTE_SESSION_HISTORY_KEY
} from '../src/router/routeSessionHistory.js';

// 类型: Array<string>；作用: 锁定当前正式一级入口白名单，详情和播放严格路由通过 meta.topNavName 归属其中。
const NAV_ROUTE_NAMES = ['home', 'detail-entry', 'player-entry', 'settings'];

/**
 * 创建测试专用 Storage-like 夹具。
 * 纯函数: 每次调用建立独立 Map，不读取真实浏览器或其他用例状态。
 * 成功路径: 返回完整 getItem/setItem/removeItem 窄接口和可观察的 values。
 * 失败路径: 当前内存夹具不抛出预期异常。
 *
 * @returns {object} 当前用例隔离的存储夹具。
 * @returns {Map<string,string>} return.values 当前键值保存。
 * @returns {object} return.storage 被测工厂注入的 Storage-like 对象。
 */
function createStorageFixture() {
  // 类型: Map<string,string>；作用: 观察适配器是否只写入声明的唯一会话键。
  const values = new Map();

  return {
    values,
    storage: {
      /**
       * 读取当前用例保存的键。
       * 副作用: 只读取隔离 Map，不修改其他用例状态。
       *
       * @param {string} key 会话键。
       * @returns {string|null} 保存文本或 Storage API 约定的 null。
       */
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      /**
       * 写入当前用例保存的键。
       * 副作用: 覆盖隔离 Map 中的同名键。
       *
       * @param {string} key 会话键。
       * @param {*} value Storage API 写入值。
       * @returns {void} 写入完成后结束。
       */
      setItem(key, value) {
        values.set(key, String(value));
      },
      /**
       * 清理当前用例保存的键。
       * 副作用: 幂等删除隔离 Map 中的同名键。
       *
       * @param {string} key 会话键。
       * @returns {void} 清理完成后结束。
       */
      removeItem(key) {
        values.delete(key);
      }
    }
  };
}

/**
 * 创建 RouteSessionHistory 可识别的最小路由对象。
 * 纯函数: 只组合输入，不访问 Router 或会话存储。
 *
 * @param {string} name 路由名称。
 * @param {string} fullPath 完整站内路径。
 * @param {string} [topNavName] 一级入口归属名称。
 * @returns {object} 最小 Vue Router 路由对象。
 */
function createRoute(name, fullPath, topNavName) {
  return {
    name,
    fullPath,
    meta: topNavName ? { topNavName } : {}
  };
}

// 测试目的: 成功路由必须保存最近地址和滚动位置，重新创建适配器后仍能从同一标签页恢复。
test('路由会话保存最近一级地址和滚动位置并支持刷新恢复', () => {
  // 类型: object；作用: 建立当前用例唯一 Storage-like 依赖。
  const fixture = createStorageFixture();
  // 类型: Readonly<object>；作用: 模拟首次应用实例创建的路由会话门面。
  const firstSession = createRouteSessionHistory({
    storage: fixture.storage,
    navRouteNames: NAV_ROUTE_NAMES
  });
  // 类型: object；作用: 模拟实际详情路由，通过 topNavName 归并到 detail-entry 槽位。
  const detailRoute = createRoute(
    'detail',
    '/detail/system-source-1/movie-1?episodeId=episode-2',
    'detail-entry'
  );

  // 断言作用: 成功路由必须写入当前详情一级导航的最近完整地址。
  assert.equal(firstSession.rememberRoute(detailRoute), true);
  // 断言作用: 来源路由离开前的滚动位置必须与完整地址绑定保存。
  assert.equal(firstSession.rememberScrollPosition(detailRoute, { x: 4.8, y: 321.9 }), true);
  // 断言作用: 详情一级导航点击应恢复严格详情地址，而不是无身份入口。
  assert.equal(
    firstSession.resolveNavigationLocation('detail-entry', { name: 'detail-entry' }),
    '/detail/system-source-1/movie-1?episodeId=episode-2'
  );
  // 断言作用: 相同 fullPath 才能恢复对应滚动坐标，并且坐标向下取整。
  assert.deepEqual(firstSession.loadScrollPosition(detailRoute), { x: 4, y: 321 });
  // 断言作用: 适配器只能创建唯一会话键，不能悄悄建立第二个保存位置。
  assert.deepEqual([...fixture.values.keys()], [ROUTE_SESSION_HISTORY_KEY]);

  // 类型: Readonly<object>；作用: 模拟浏览器刷新后新建的会话适配器。
  const refreshedSession = createRouteSessionHistory({
    storage: fixture.storage,
    navRouteNames: NAV_ROUTE_NAMES
  });
  // 断言作用: sessionStorage 跨刷新保留最近详情地址和滚动位置。
  assert.equal(
    refreshedSession.resolveNavigationLocation('detail-entry', { name: 'detail-entry' }),
    '/detail/system-source-1/movie-1?episodeId=episode-2'
  );
  assert.deepEqual(refreshedSession.loadScrollPosition(detailRoute), { x: 4, y: 321 });
});

// 测试目的: 无历史、未知入口、外部地址和损坏快照必须失败关闭，不把任意文本变成站内导航。
test('路由会话对未知入口和损坏快照回退静态导航', () => {
  // 类型: object；作用: 建立独立存储夹具，避免污染成功恢复用例。
  const fixture = createStorageFixture();
  // 类型: Readonly<object>；作用: 创建白名单路由会话适配器。
  const session = createRouteSessionHistory({
    storage: fixture.storage,
    navRouteNames: NAV_ROUTE_NAMES
  });
  // 类型: object；作用: 静态入口作为没有历史时的唯一安全回退。
  const fallbackLocation = { name: 'detail-entry' };

  // 断言作用: 新标签页没有历史时必须返回路由表静态入口。
  assert.deepEqual(session.resolveNavigationLocation('detail-entry', fallbackLocation), fallbackLocation);
  // 断言作用: 未知导航身份不能读取或创建动态会话条目。
  assert.deepEqual(session.resolveNavigationLocation('unknown', fallbackLocation), fallbackLocation);
  // 断言作用: 外部地址不能写入标签页路由历史。
  assert.equal(session.rememberRoute(createRoute('detail', '//evil.example/path', 'detail-entry')), false);
  assert.equal(session.rememberRoute(createRoute('detail', 'https://evil.example/path', 'detail-entry')), false);

  // 副作用: 模拟存储中出现未知版本，验证读取不会猜测旧结构。
  fixture.values.set(ROUTE_SESSION_HISTORY_KEY, JSON.stringify({ version: 99, entries: {} }));
  // 断言作用: 损坏快照只能回退静态位置，不能阻塞基本导航。
  assert.deepEqual(session.resolveNavigationLocation('detail-entry', fallbackLocation), fallbackLocation);
  // 断言作用: 损坏快照不会产生虚假的滚动恢复。
  assert.equal(session.loadScrollPosition(createRoute('detail-entry', '/detail')), null);
});

// 测试目的: Storage 读写失败只降级会话增强，不建立内存、localStorage 或 IndexedDB 备用保存。
test('路由会话存储失败时保持静态入口和顶部位置', () => {
  // 类型: object；作用: 构造每次调用都失败的 Storage-like 依赖。
  const failingStorage = {
    /**
     * 模拟读取会话键失败。
     * 副作用: 抛出基础设施错误，不修改测试状态。
     *
     * @returns {never} 本方法不返回。
     * @throws {Error} 始终模拟 sessionStorage 不可用。
     */
    getItem() {
      throw new Error('session unavailable');
    },
    /**
     * 模拟写入会话键失败。
     * 副作用: 抛出基础设施错误，不写入备用存储。
     *
     * @returns {never} 本方法不返回。
     * @throws {Error} 始终模拟 sessionStorage 不可用。
     */
    setItem() {
      throw new Error('session unavailable');
    },
    /**
     * 模拟清理会话键失败。
     * 副作用: 抛出基础设施错误，不清理其他保存域。
     *
     * @returns {never} 本方法不返回。
     * @throws {Error} 始终模拟 sessionStorage 不可用。
     */
    removeItem() {
      throw new Error('session unavailable');
    }
  };
  // 类型: Readonly<object>；作用: 创建仅依赖失败存储的会话门面。
  const session = createRouteSessionHistory({
    storage: failingStorage,
    navRouteNames: NAV_ROUTE_NAMES
  });
  // 类型: object；作用: 静态详情入口是存储失败时的安全导航目标。
  const fallbackLocation = { name: 'detail-entry' };

  // 断言作用: 写入失败不能阻塞已经完成的 Router 导航。
  assert.equal(session.rememberRoute(createRoute('detail-entry', '/detail')), false);
  // 断言作用: 读取失败继续返回静态入口，不使用第二保存实现。
  assert.deepEqual(session.resolveNavigationLocation('detail-entry', fallbackLocation), fallbackLocation);
  // 断言作用: 读取失败不伪造滚动位置，Router 会采用页面顶部。
  assert.equal(session.loadScrollPosition(createRoute('detail-entry', '/detail')), null);
});
