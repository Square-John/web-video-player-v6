/*
  route-shell.integration.test.js 模块说明

  - 文件职责:
      验证全站一级导航、动态路由、按需 UI 注册、目录共用控制器、常驻播放宿主、KeepAlive、标题和交互语义保持结构一致。
      测试读取真实源码文本并检查公共壳的架构不变量，不启动 Vue、浏览器、Provider、Store 或网络服务。

  - 导入库及文件汇总(4 条，内置 3 条，第三方 0 条，自定义 1 条):
      node:assert/strict: Node 内置严格断言库，验证路由壳源码不变量。
      node:fs: Node 内置文件读取库，读取仓库内真实路由和壳源码。
      node:test: Node 内置测试注册器，提供结构回归测试。
      createDocumentTitle: 自定义标题纯函数，验证静态页面和严格内容标题格式。

  - 模块级常量:
      PROJECT_ROOT: string，当前测试文件向上两级得到的客户端根目录。
      ROUTES_SOURCE: string，真实 routes.js 源码。
      APP_SOURCE: string，真实 App.vue 源码，用于验证唯一常驻 PlayerView 和普通路由出口。
      NAVBAR_SOURCE: string，真实 AppNavbar.vue 源码。
      ROUTER_SOURCE: string，真实 router/index.js 源码。
      SETTINGS_SOURCE: string，真实 SettingsView.vue 源码。
      HOME_SOURCE: string，真实 HomeView.vue 源码。
      DETAIL_SOURCE: string，真实 DetailView.vue 源码。
      PLAYER_SOURCE: string，真实 PlayerView.vue 源码。
      VIDEO_CARD_SOURCE: string，真实 VideoCard.vue 源码。
      SOURCE_LIST_ROW_SOURCE: string，真实 SourceListRow.vue 源码。
      MAIN_SOURCE: string，真实 main.js 源码。
      PROJECT_ELEMENT_UI_PLUGIN_SOURCE: string，项目 Element UI 按需注册插件源码。
      PROJECT_EMPTY_STATE_SOURCE: string，项目级空状态组件源码。
      MOVIE_SOURCE: string，真实 MovieView.vue 源码。
      TV_SOURCE: string，真实 TVView.vue 源码。
      CATALOG_PAGE_CONTROLLER_SOURCE: string，电影和电视剧共用目录控制器源码。

  - 模块级变量:
      无

  - 模块级辅助函数:
      readProjectSource(relativePath): 读取客户端项目内源码文本。

  - 模块级类:
      无

  - 对外导出:
      无，测试通过 node:test 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言门面。
// 文件作用: 验证导航项数量、KeepAlive 出口和会话钩子结构。
import assert from 'node:assert/strict';

// 导入来源: node:fs。
// 导入内容: readFileSync 文件读取函数。
// 文件作用: 读取当前仓库真实路由和页面壳源码，避免测试夹具脱离实现。
import { readFileSync } from 'node:fs';

// 导入来源: node:test。
// 导入内容: test 测试注册函数。
// 文件作用: 注册路由壳结构回归用例。
import test from 'node:test';

// 导入来源: ../src/services/documentTitleService.js。
// 导入内容: createDocumentTitle 统一浏览器标题纯函数。
// 文件作用: 直接验证标题格式，不依赖浏览器 document 或 Router 实例。
import { createDocumentTitle } from '../src/services/documentTitleService.js';

// 类型: string；作用: 当前测试位于 client/tests 下，向上一级得到客户端项目根目录。
const PROJECT_ROOT = new URL('../', import.meta.url);

/**
 * 读取客户端项目内的真实源码文本。
 * 纯函数: 只按固定项目根读取文件，不修改源码或测试状态。
 * 成功路径: 返回 UTF-8 源码正文。
 * 失败路径: 文件不存在或无法读取时由 fs 原样抛出，测试立即失败。
 *
 * @param {string} relativePath 相对于 client 根目录的源码路径。
 * @returns {string} 源码正文。
 * @throws {Error} 文件读取失败时抛出。
 */
function readProjectSource(relativePath) {
  // 类型: URL；作用: 根据测试文件位置解析客户端内源码的绝对 URL。
  const sourceUrl = new URL(relativePath, PROJECT_ROOT);
  return readFileSync(sourceUrl, 'utf8');
}

// 类型: string；作用: 保存真实路由表源码供全部路由壳断言复用。
const ROUTES_SOURCE = readProjectSource('src/router/routes.js');
// 类型: string；作用: 保存根应用源码，锁定唯一常驻播放宿主和普通路由 KeepAlive 出口。
const APP_SOURCE = readProjectSource('src/App.vue');
// 类型: string；作用: 保存顶部导航源码，锁定会话地址解析入口。
const NAVBAR_SOURCE = readProjectSource('src/components/layout/AppNavbar.vue');
// 类型: string；作用: 保存 Router 组合根源码，锁定前后置会话钩子和滚动恢复。
const ROUTER_SOURCE = readProjectSource('src/router/index.js');
// 类型: string；作用: 保存设置外壳源码，锁定嵌套路由缓存出口。
const SETTINGS_SOURCE = readProjectSource('src/views/SettingsView.vue');
// 类型: string；作用: 保存首页源码，验证导航已经承担页面身份后不再重复渲染“首页”主标题。
const HOME_SOURCE = readProjectSource('src/views/HomeView.vue');
// 类型: string；作用: 保存详情页源码，验证内容和空状态互斥 h1 及动态标题门禁。
const DETAIL_SOURCE = readProjectSource('src/views/DetailView.vue');
// 类型: string；作用: 保存常驻播放页源码，验证互斥 h1 和后台标题写入门禁。
const PLAYER_SOURCE = readProjectSource('src/views/PlayerView.vue');
// 类型: string；作用: 保存视频卡片源码，验证真实主按钮与同级辅助操作结构。
const VIDEO_CARD_SOURCE = readProjectSource('src/components/common/VideoCard.vue');
// 类型: string；作用: 保存数据源记录行源码，验证详情按钮与复选框、开关和命令保持同级。
const SOURCE_LIST_ROW_SOURCE = readProjectSource('src/components/settings/SourceListRow.vue');
// 类型: string；作用: 保存应用入口源码，验证只安装项目按需 UI 插件。
const MAIN_SOURCE = readProjectSource('src/main.js');
// 类型: string；作用: 保存项目 UI 插件源码，验证组件白名单、Loading、消息服务和项目空状态统一注册。
const PROJECT_ELEMENT_UI_PLUGIN_SOURCE = readProjectSource('src/plugins/projectElementUiPlugin.js');
// 类型: string；作用: 保存项目空状态组件源码，验证默认图示不生成重复 SVG 标识。
const PROJECT_EMPTY_STATE_SOURCE = readProjectSource('src/components/common/ProjectEmptyState.vue');
// 类型: string；作用: 保存电影页源码，验证页面只保留配置、模板和通用控制器接入。
const MOVIE_SOURCE = readProjectSource('src/views/MovieView.vue');
// 类型: string；作用: 保存电视剧页源码，验证页面只保留配置、模板和通用控制器接入。
const TV_SOURCE = readProjectSource('src/views/TVView.vue');
// 类型: string；作用: 保存目录控制器源码，验证 URL、筛选、分页、切源和请求事务只有一份实现。
const CATALOG_PAGE_CONTROLLER_SOURCE = readProjectSource('src/controllers/catalogPageController.js');

// 测试目的: 八个正式一级入口必须全部存在，详情/播放严格路由不能让导航项回归隐藏状态。
test('路由表公开全部八个一级导航入口', () => {
  // 类型: Array<string>；作用: 读取用户必须能从顶部进入的正式导航标签。
  const expectedLabels = ['首页', '电影', '电视剧', '搜索', '详情', '播放', '个人中心', '设置'];

  // 断言作用: 每个正式入口都必须出现在真实 routes.js 导航配置中。
  expectedLabels.forEach((label) => {
    assert.match(ROUTES_SOURCE, new RegExp(`label: '${label}'`, 'u'));
  });
  // 断言作用: 导航配置不再通过 visible 字段提供擅自隐藏入口的分支。
  assert.doesNotMatch(ROUTES_SOURCE, /meta\.nav\.visible|visible:\s*true/u);
  // 断言作用: 详情必须同时提供无身份入口和严格参数路由，入口点击才有安全空状态。
  assert.match(ROUTES_SOURCE, /path: '\/detail'[\s\S]*?name: 'detail-entry'/u);
  assert.match(ROUTES_SOURCE, /path: '\/detail\/:sourceId\/:videoId'[\s\S]*?name: 'detail'/u);
  // 断言作用: 严格详情和严格播放只能通过 topNavName 归属对应一级入口，不复制第二个导航项。
  assert.match(ROUTES_SOURCE, /topNavName: 'detail-entry'/u);
  assert.match(ROUTES_SOURCE, /topNavName: 'player-entry'/u);
});

// 测试目的: 播放器必须常驻 App，普通根路由和设置嵌套路由继续分别由 KeepAlive 保存页面实例。
test('应用壳常驻播放器并缓存普通路由和设置子路由实例', () => {
  // 类型: Array<string>；作用: 统计实际模板中的 PlayerView 元素，排除顶部渲染树注释文本。
  const persistentPlayerElements = APP_SOURCE.match(/<PlayerView\s+v-show="isPlayerPage"\s*\/>/gu) || [];
  // 断言作用: App 必须只挂载一个使用 v-show 的 PlayerView；普通路由不能创建第二媒体实例。
  assert.equal(persistentPlayerElements.length, 1);
  // 断言作用: 普通 router-view 仅在非播放路由渲染并继续使用 routeCacheKey 缓存。
  assert.match(APP_SOURCE, /<keep-alive>[\s\S]*?<router-view v-if="!isPlayerPage" :key="routeCacheKey" \/>[\s\S]*?<\/keep-alive>/u);
  assert.match(APP_SOURCE, /routeCacheKey\(\)/u);
  // 断言作用: 播放路由不能再从路由表导入或绑定 PlayerView，否则会与常驻宿主形成双实例。
  assert.doesNotMatch(ROUTES_SOURCE, /import\s+PlayerView|component:\s*PlayerView/u);
  // 断言作用: SettingsView 必须单独缓存嵌套路由，否则切换设置模块仍会销毁表单和列表状态。
  assert.match(SETTINGS_SOURCE, /<keep-alive>[\s\S]*?<router-view :key="\$route\.name" \/>[\s\S]*?<\/keep-alive>/u);
});

// 测试目的: 顶部导航必须通过会话历史恢复最近完整地址，Router 必须登记离开位置和成功目标。
test('导航壳接入标签页路由历史和滚动恢复', () => {
  // 断言作用: 导航点击必须调用 resolveNavigationLocation，不得只 push 静态命名路由。
  assert.match(NAVBAR_SOURCE, /resolveNavigationLocation\(/u);
  // 断言作用: Router 组合根必须存在来源位置保存、目标滚动恢复和成功地址登记三条边界。
  assert.match(ROUTER_SOURCE, /router\.beforeEach\(/u);
  assert.match(ROUTER_SOURCE, /loadScrollPosition\(/u);
  assert.match(ROUTER_SOURCE, /router\.afterEach\(/u);
  // 断言作用: history 路由必须采用 Vite 的构建基路径，Pages 仓库子路径不能回退域名根目录。
  assert.match(ROUTER_SOURCE, /const ROUTER_BASE_PATH = import\.meta\.env\.BASE_URL/u);
  assert.match(ROUTER_SOURCE, /base: ROUTER_BASE_PATH/u);
});

// 测试目的: 页面与设置路由必须按命中加载，Element UI 和目录控制流不得重新整体进入应用首包或双页复制。
test('路由、界面组件和目录控制器使用受控按需边界', () => {
  // 类型: Array<string>；作用: 收集 routes.js 中全部 Vue 动态 import，证明一级页面和设置子页形成独立加载入口。
  const dynamicRouteImports = ROUTES_SOURCE.match(/\(\) => import\('[^']+\.vue'\)/gu) || [];
  // 断言作用: 七个普通页面、设置外壳和五个设置工作区共用十二个加载器，详情两条路由复用同一加载函数。
  assert.equal(dynamicRouteImports.length, 12);
  // 断言作用: 路由表不得恢复任一 Vue 页面同步 import，否则对应页面重新进入应用首包。
  assert.doesNotMatch(ROUTES_SOURCE, /^import\s+.+\.vue['"];?$/gmu);
  assert.match(ROUTES_SOURCE, /component: ROUTE_COMPONENT_LOADERS\.detail/gu);

  // 断言作用: main.js 只安装项目 UI 插件，不再导入或安装 element-ui 全量插件。
  assert.doesNotMatch(MAIN_SOURCE, /from ['"]element-ui['"]|Vue\.use\(ElementUI\)/u);
  assert.match(MAIN_SOURCE, /Vue\.use\(ProjectElementUiPlugin\)/u);
  // 断言作用: 项目 UI 插件必须按具体 lib 模块导入，并继续注册 Loading、消息框和无重复标识空状态。
  assert.match(PROJECT_ELEMENT_UI_PLUGIN_SOURCE, /element-ui\/lib\/button\.js/u);
  assert.match(PROJECT_ELEMENT_UI_PLUGIN_SOURCE, /VueConstructor\.use\(Loading\)/u);
  assert.match(PROJECT_ELEMENT_UI_PLUGIN_SOURCE, /VueConstructor\.prototype\.\$confirm = MessageBox\.confirm/u);
  assert.match(PROJECT_ELEMENT_UI_PLUGIN_SOURCE, /VueConstructor\.component\('ElEmpty', ProjectEmptyState\)/u);

  // 断言作用: 电影和电视剧页都只接入同一控制器工厂，不直接复制 Source Service、Store 或路由守卫调用链。
  assert.match(MOVIE_SOURCE, /createCatalogPageController\(\{/u);
  assert.match(TV_SOURCE, /createCatalogPageController\(\{/u);
  assert.doesNotMatch(MOVIE_SOURCE, /requestSourceData|requestSourceFilterMeta|createRouteRequestGuard/u);
  assert.doesNotMatch(TV_SOURCE, /requestSourceData|requestSourceFilterMeta|createRouteRequestGuard/u);
  assert.match(CATALOG_PAGE_CONTROLLER_SOURCE, /async handleSourceSwitched\(\)/u);
  assert.match(CATALOG_PAGE_CONTROLLER_SOURCE, /async handleFilterChange\(payload\)/u);
  assert.match(CATALOG_PAGE_CONTROLLER_SOURCE, /async handlePageChange\(payload\)/u);
});

// 测试目的: 导航、内容标题和浏览器标签页标题必须形成单一规则，静态首页不重复标题，缓存页面及后台播放器不能覆盖当前路由标题。
test('页面主标题和浏览器标题由当前可见路由统一控制', () => {
  // 类型: number；作用: 统计首页真实模板中的 h1，确认导航已表达“首页”后内容区不再重复同名标题。
  const homeHeadingCount = (HOME_SOURCE.match(/<h1(?:\s|>)/gu) || []).length;
  // 类型: number；作用: 统计详情真实内容标题，空状态不重复显示“详情”路由名称。
  const detailHeadingCount = (DETAIL_SOURCE.match(/<h1(?:\s|>)/gu) || []).length;
  // 类型: number；作用: 统计播放真实内容标题，空状态不重复显示“播放”路由名称。
  const playerHeadingCount = (PLAYER_SOURCE.match(/<h1(?:\s|>)/gu) || []).length;

  // 断言作用: 首页不渲染重复页面级标题，页面身份继续由主导航和浏览器标题表达。
  assert.equal(homeHeadingCount, 0);
  // 断言作用: 详情只把真实影片名称作为内容标题，空状态保留操作和原因但不重复路由名称。
  assert.equal(detailHeadingCount, 1);
  assert.match(DETAIL_SOURCE, /<div v-if="hasVideo"[\s\S]*?<h1 class="detail-title"[\s\S]*?<div v-else class="detail-page-empty/u);
  assert.doesNotMatch(DETAIL_SOURCE, /detail-empty-title|<div v-else class="detail-page-empty[\s\S]*?<h1/u);
  // 断言作用: 常驻播放页同样只把真实影片名称作为标题，安全空态不伪造第二个页面标题。
  assert.equal(playerHeadingCount, 1);
  assert.match(PLAYER_SOURCE, /<div v-if="hasVideo"[\s\S]*?<h1 id="player-content-title"[\s\S]*?<div v-else class="player-page-empty"/u);
  assert.doesNotMatch(PLAYER_SOURCE, /player-empty-title|<div v-else class="player-page-empty"[\s\S]*?<h1/u);

  // 断言作用: 静态页面只包含路由标题与应用名，严格内容页在最前方补充内容名称。
  assert.equal(createDocumentTitle({ meta: { title: '首页' } }), '首页 - Web Video Player');
  assert.equal(
    createDocumentTitle({ meta: { title: '详情' } }, '龙之家族'),
    '龙之家族 - 详情 - Web Video Player'
  );
  // 断言作用: Router 每次成功导航先清除旧内容标题，页面再按自己的当前路由权限补充严格内容标题。
  assert.match(ROUTER_SOURCE, /router\.afterEach\(\(to\)[\s\S]*?applyDocumentTitle\(to\)/u);
  assert.match(DETAIL_SOURCE, /DETAIL_DOCUMENT_ROUTE_NAMES[\s\S]*?documentTitleContext[\s\S]*?applyDocumentTitle\(context\.route, context\.contentTitle\)/u);
  // 断言作用: 标题上下文生产者必须复用媒体请求的唯一 URL 解析器，普通路由和非法播放 URL 都返回 null。
  assert.match(PLAYER_SOURCE, /documentTitleContext\(\)\s*\{[\s\S]*?const currentRouteContext = createPlayerRouteContext\(this\.\$route\)[\s\S]*?if \(!currentRouteContext\)[\s\S]*?return null;/u);
  // 断言作用: 只有解析后的严格 sourceId/contentId 与当前实体一致时才补充内容标题，不能采用旧媒体实体。
  assert.match(PLAYER_SOURCE, /currentRouteContext\.routeName === 'player'[\s\S]*?this\.video\.sourceId === currentRouteContext\.sourceId[\s\S]*?this\.video\.id === currentRouteContext\.contentId/u);
  // 断言作用: 标题上下文消费者只在生产者返回非空结果时调用统一标题服务，后台播放器不得覆盖 Router 标题。
  assert.match(PLAYER_SOURCE, /documentTitleContext:\s*\{[\s\S]*?immediate:\s*true[\s\S]*?handler\(context\)[\s\S]*?if \(!context\)[\s\S]*?return;[\s\S]*?applyDocumentTitle\(context\.route, context\.contentTitle\)/u);
});

// 测试目的: 整卡入口必须使用真实同级按钮，公共空状态必须避免 Element UI 默认 SVG 的重复 ID。
test('整卡交互和项目空状态保持有效语义与唯一标识', () => {
  // 断言作用: 视频卡片不再把含辅助按钮的根容器伪装成按钮，独立主按钮继续覆盖主点击区。
  assert.doesNotMatch(VIDEO_CARD_SOURCE, /class="video-card"[\s\S]{0,180}role="button"/u);
  assert.match(VIDEO_CARD_SOURCE, /<article class="video-card__article">[\s\S]*?<button[\s\S]*?class="video-card__primary-action"/u);
  // 断言作用: 数据源行不再使用 role=button，详情、选择、开关和命令通过同级元素各自处理输入。
  assert.doesNotMatch(SOURCE_LIST_ROW_SOURCE, /class="source-list-row"[\s\S]{0,180}role="button"/u);
  assert.match(SOURCE_LIST_ROW_SOURCE, /<button[\s\S]*?class="source-list-row__detail-trigger"/u);
  assert.match(SOURCE_LIST_ROW_SOURCE, /<el-checkbox[\s\S]*?<el-switch[\s\S]*?<div class="source-list-row__actions"/u);
  // 断言作用: 项目按需 UI 插件必须全局采用 ProjectEmptyState，所有既有 el-empty 自动进入同一实现。
  assert.match(PROJECT_ELEMENT_UI_PLUGIN_SOURCE, /VueConstructor\.component\('ElEmpty', ProjectEmptyState\)/u);
  // 断言作用: 默认图示使用图标字体，不生成带 id 的 SVG；调用方 image 属性继续渲染自定义图片。
  assert.doesNotMatch(PROJECT_EMPTY_STATE_SOURCE, /<svg|\sid=/u);
  assert.match(PROJECT_EMPTY_STATE_SOURCE, /<img[\s\S]*?v-if="image"[\s\S]*?el-icon-receiving/u);
});
