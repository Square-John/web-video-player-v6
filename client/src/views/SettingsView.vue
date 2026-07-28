<template>
  <!--
    SettingsView 页面渲染树

    [DEFAULT] ele(div.theme-page.settings-view)
    │  - condition:
    │      默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      设置页根容器。
    │      负责组合设置模块导航和当前子路由工作区，不保存数据源业务状态。
    │  - params:
    │      无
    │  - events:
    │      无
    │
    └─ [DEFAULT] ele(div.settings-view__layout)
       │  - condition:
       │      默认渲染，由 CSS 在桌面使用侧栏、平板和手机改为纵向布局。
       │  - type:
       │      原生标签
       │      标签名称: div
       │  - description:
       │      设置页响应式布局容器。
       │  - params:
       │      无
       │  - events:
       │      无
       │
       ├─ [DEFAULT] ele(SettingsNavigation)
       │  - condition:
       │      默认渲染，并读取 visibleSettingsModules 生成四个设置模块入口。
       │  - type:
       │      自定义组件
       │      相对位置: ../components/settings/SettingsNavigation.vue
       │  - description:
       │      设置模块导航。
       │      桌面显示侧栏，平板显示顶部导航，手机显示模块选择器。
       │  - params:
       │      -- modules：配置文件中 visible 为 true 的设置模块定义。
       │  - events:
       │      无
       │
       └─ [DEFAULT] ele(main.settings-view__workspace)
          - condition:
              默认渲染。
          - type:
              原生标签
              标签名称: main
          - description:
              设置模块工作区。
              由嵌套路由渲染数据源列表、数据源详情或统一空内容。
          - params:
              无
          - events:
              无
  -->
  <!--
    [DEFAULT] ele(div.theme-page.settings-view)
    - condition:
        默认渲染。
    - type:
        原生标签
        标签名称: div
    - description:
        设置页根容器，组合响应式模块导航和嵌套路由工作区。
    - params:
        无
    - events:
        无
  -->
  <div class="theme-page settings-view">
    <!--
      [DEFAULT] ele(div.settings-view__layout)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: div
      - description:
          设置页导航和工作区布局容器。
      - params:
          无
      - events:
          无
    -->
    <div class="settings-view__layout">
      <!--
        [DEFAULT] ele(SettingsNavigation)
        - condition:
            默认渲染。
        - type:
            自定义组件
            相对位置: ../components/settings/SettingsNavigation.vue
        - description:
            读取统一模块配置生成响应式导航。
        - params:
            -- modules：当前可见设置模块数组。
        - events:
            无
      -->
      <SettingsNavigation :modules="visibleSettingsModules" />

      <!--
        [DEFAULT] ele(main.settings-view__workspace)
        - condition:
            默认渲染。
        - type:
            原生标签
            标签名称: main
        - description:
            设置模块嵌套路由出口。
        - params:
            无
        - events:
            无
      -->
      <main class="settings-view__workspace">
        <!--
          [DEFAULT] ele(router-view.settings-view__router-view)
          - condition:
              默认渲染，由当前设置子路由决定实际页面组件。
          - type:
              第三方组件
              组件库: Vue Router
              组件名称: router-view
          - description:
              设置模块嵌套路由缓存出口，保留数据源列表、详情和其他设置模块实例。
          - params:
              -- $route.name：设置子页面缓存身份。
          - events:
              无
        -->
        <!--
          设置子路由 KeepAlive；切换到其他设置模块不会销毁当前表单、列表滚动或详情草稿。
          浏览器刷新会重建设置子页面，并由当前 URL 决定重新进入哪个设置模块。
        -->
        <keep-alive>
          <router-view :key="$route.name" />
        </keep-alive>
      </main>
    </div>
  </div>
</template>

<script>
/*
  SettingsView.vue 模块说明

  - 文件职责:
      组合设置模块导航和嵌套路由缓存出口。
      只负责设置外壳布局与模块配置派生，不保存数据源或各设置模块业务状态。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      SettingsNavigation: 自定义组件，渲染设置模块导航。
      SETTINGS_MODULES: 自定义配置，提供设置模块唯一入口清单。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SettingsView: Vue component，供 settings 父路由渲染设置外壳。
*/

// 导入来源: ../components/settings/SettingsNavigation.vue。
// 导入内容: SettingsNavigation 设置模块导航组件。
// 文件作用: 在设置页外壳中渲染桌面、平板和手机导航。
import SettingsNavigation from '../components/settings/SettingsNavigation.vue';

import {
  // 导入来源: ../config/settings-module.config。
  // 导入内容: SETTINGS_MODULES 设置模块配置数组。
  // 文件作用: 给导航提供唯一模块入口，不在页面重复硬编码设置模块。
  SETTINGS_MODULES
} from '../config/settings-module.config';

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools、路由错误和堆栈识别设置页外壳。
  name: 'SettingsView',

  /*
    components 注册设置页模板使用的导航组件。
    注册名与 template 标签名和顶部渲染树 ele(...) 标识保持一致。
  */
  components: {
    // 组件: SettingsNavigation 设置模块导航。
    // 作用: 在桌面、平板和手机展示同一份设置模块入口。
    SettingsNavigation
  },

  computed: {
    /**
     * 计算设置页可见模块。
     * 数据来源: settings-module.config.js 的 SETTINGS_MODULES。
     * 纯函数: 只过滤和排序冻结配置，不修改模块定义、Router 或页面状态。
     * 失败路径: 配置为空时返回空数组，导航组件不猜测模块。
     *
     * @returns {Array<object>} 按 order 升序排列的可见设置模块。
     * @returns {string} return[].id 设置模块唯一标识。
     * @returns {string} return[].title 设置导航展示名称。
     * @returns {string} return[].routeName 设置模块命名路由。
     * @returns {number} return[].order 设置模块排序值。
     */
    visibleSettingsModules() {
      // 循环类型: Array.prototype.filter + slice + sort。
      // 初始值: SETTINGS_MODULES 第一项。
      // 终止条件: 所有设置模块完成可见性过滤和顺序比较。
      // 循环作用: 给导航提供稳定顺序，避免直接修改冻结配置数组。
      return SETTINGS_MODULES
        .filter(moduleDefinition => moduleDefinition.visible)
        .slice()
        .sort((leftModule, rightModule) => leftModule.order - rightModule.order);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 设置页根容器 `.settings-view`。
  样式作用:
  继承通用页面宽度并给设置模块外壳提供上下留白。
  不承担具体数据源列表和详情样式。
*/
.settings-view {
  /* 设置页顶部留出和其他普通页面一致的视觉距离。 */
  padding-top: 22px;

  /* 设置页底部保留足够空间，避免工作区紧贴应用页脚。 */
  padding-bottom: 48px;
}

/*
  作用容器: 设置页布局容器 `.settings-view__layout`。
  样式作用:
  桌面端建立固定导航列和自适应工作区。
  允许工作区内容收缩，避免单行数据源列表撑出页面。
*/
.settings-view__layout {
  /* 使用 CSS Grid 明确区分设置导航和模块工作区。 */
  display: grid;

  /* 导航保持稳定可读宽度，工作区使用剩余空间。 */
  grid-template-columns: minmax(200px, 220px) minmax(0, 1fr);

  /* 导航和工作区之间保留清晰但不过大的间距。 */
  gap: 20px;

  /* 让导航和工作区从顶部对齐。 */
  align-items: start;
}

/*
  作用容器: 设置模块工作区 `.settings-view__workspace`。
  样式作用:
  允许嵌套路由页面在 Grid 中正确收缩。
  避免单行列表的固定列把整个设置页撑出视口。
*/
.settings-view__workspace {
  /* 允许 Grid 子项小于内容固有宽度。 */
  min-width: 0;
}

/*
  响应式断点: max-width 1100px。
  作用范围: 平板和中等宽度桌面。
  样式作用:
  把设置侧栏切换为工作区上方导航。
  在单行数据源列表出现空间竞争前释放完整横向宽度。
*/
@media (max-width: 1100px) {
  /*
    作用容器: 中等宽度下的设置页布局 `.settings-view__layout`。
    样式作用:
    把双列布局切换为单列，让导航和工作区从上到下排列。
  */
  .settings-view__layout {
    /* 平板使用单列结构，导航由子组件改为顶部模式。 */
    grid-template-columns: minmax(0, 1fr);

    /* 收紧导航和工作区之间的垂直距离。 */
    gap: 14px;
  }
}

/*
  响应式断点: max-width 640px。
  作用范围: 手机设备。
  样式作用:
  收紧设置页纵向留白，让模块选择器和内容更接近首屏。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机设置页根容器 `.settings-view`。
    样式作用:
    调整手机页面顶部和底部留白，降低空内容占用。
  */
  .settings-view {
    /* 手机减小顶部留白，让设置模块选择器更早出现。 */
    padding-top: 14px;

    /* 手机保留适量底部留白，避免内容紧贴页脚。 */
    padding-bottom: 28px;
  }
}
</style>
