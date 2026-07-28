<template>
  <!--
    SettingsNavigation 组件渲染树

    [DEFAULT] ele(aside.settings-navigation.theme-surface)
    │  - condition:
    │      默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: aside
    │  - description:
    │      设置模块导航根容器，桌面和平板使用按钮组，手机使用选择器。
    │  - params:
    │      -- modules：可见设置模块定义数组。
    │      -- activeModuleId：当前路由对应的设置模块 id。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(div.settings-navigation__desktop)
    │  - condition:
    │      默认渲染，由 CSS 在手机断点隐藏。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      桌面和平板模块按钮组，按 modules 顺序生成导航入口。
    │  - params:
    │      -- modules：设置模块定义数组。
    │  - events:
    │      无
    │  │
    │  └─ [DEFAULT] ele(button.settings-navigation__item)
    │     - condition:
    │         对 modules 中每条模块定义循环渲染。
    │     - type:
    │         原生标签
    │         标签名称: button
    │     - description:
    │         单个设置模块入口，展示标题并根据 activeModuleId 标记当前项。
    │     - params:
    │         -- moduleDefinition.id：模块唯一标识和激活态比较值。
    │         -- moduleDefinition.title：模块入口展示名称。
    │         -- moduleDefinition.routeName：点击后跳转的命名路由。
    │     - events:
    │         @click
    │             - description:
    │                 用户点击模块入口时触发，用于切换设置子路由。
    │             - methods:
    │                 navigateToModule(moduleDefinition.routeName)
    │                     -- moduleDefinition.routeName：目标设置模块命名路由。
    │
    └─ [DEFAULT] ele(el-select.settings-navigation__mobile)
       - condition:
           默认渲染，由 CSS 只在手机断点显示。
       - type:
           第三方组件
           组件库: Element UI
           组件名称: el-select
       - description:
           手机设置模块选择器，避免多个横向入口在窄屏相互挤压。
       - params:
           -- selectedRouteName：当前选中的模块入口路由名称。
           -- modules：用于生成选项的模块定义数组。
       - events:
           @change
               - description:
                   用户选择另一个模块时触发，用于切换设置子路由。
               - methods:
                   navigateToModule(routeName)
                       -- routeName：用户选择的目标命名路由。
  -->
  <!--
    [DEFAULT] ele(aside.settings-navigation.theme-surface)
    - condition:
        默认渲染。
    - type:
        原生标签
        标签名称: aside
    - description:
        设置模块导航根容器，向不同屏幕提供同一份模块入口。
    - params:
        -- modules：可见设置模块定义数组。
    - events:
        无
  -->
  <aside class="settings-navigation theme-surface" aria-label="设置模块导航">
    <!--
      [DEFAULT] ele(div.settings-navigation__desktop)
      - condition:
          默认渲染，由 CSS 在手机断点隐藏。
      - type:
          原生标签
          标签名称: div
      - description:
          桌面和平板模块按钮组，循环生成全部可见设置入口。
      - params:
          -- modules：可见设置模块定义数组。
      - events:
          无
    -->
    <div class="settings-navigation__desktop">
      <!--
        [DEFAULT] ele(button.settings-navigation__item)
        - condition:
            对 modules 中每条模块定义循环渲染。
        - type:
            原生标签
            标签名称: button
        - description:
            单个设置模块入口，点击后切换命名路由。
        - params:
            -- moduleDefinition.id：激活态比较值和 v-for key。
            -- moduleDefinition.title：入口展示名称。
            -- moduleDefinition.routeName：目标命名路由。
        - events:
            @click
                - description:
                    用户点击模块入口时触发。
                - methods:
                    navigateToModule(moduleDefinition.routeName)
                        -- moduleDefinition.routeName：目标设置模块命名路由。
      -->
      <button
        v-for="moduleDefinition in modules"
        :key="moduleDefinition.id"
        type="button"
        class="settings-navigation__item"
        :class="{ 'settings-navigation__item--active': moduleDefinition.id === activeModuleId }"
        :aria-current="moduleDefinition.id === activeModuleId ? 'page' : null"
        @click="navigateToModule(moduleDefinition.routeName)"
      >
        <span class="settings-navigation__item-title">{{ moduleDefinition.title }}</span>
      </button>
    </div>

    <!--
      [DEFAULT] ele(el-select.settings-navigation__mobile)
      - condition:
          默认渲染，由 CSS 只在手机断点显示。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-select
      - description:
          手机设置模块选择器，避免多个横向入口相互挤压。
      - params:
          -- selectedRouteName：当前设置模块入口路由名称。
      - events:
          @change
              - description:
                  用户选择新模块时触发。
              - methods:
                  navigateToModule(routeName)
                      -- routeName：用户选择的目标命名路由。
    -->
    <el-select
      v-model="selectedRouteName"
      class="settings-navigation__mobile"
      aria-label="选择设置模块"
      @change="navigateToModule"
    >
      <!--
        [DEFAULT] ele(el-option.settings-navigation__mobile-option)
        - condition:
            对 modules 中每条模块定义循环渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-option
        - description:
            单个手机模块选项，显示模块标题并提交命名路由。
        - params:
            -- moduleDefinition.id：选项唯一键。
            -- moduleDefinition.title：选项展示名称。
            -- moduleDefinition.routeName：选项值和目标命名路由。
        - events:
            无
      -->
      <el-option
        v-for="moduleDefinition in modules"
        class="settings-navigation__mobile-option"
        :key="`mobile-${moduleDefinition.id}`"
        :label="moduleDefinition.title"
        :value="moduleDefinition.routeName"
      />
    </el-select>
  </aside>
</template>

<script>
/*
  SettingsNavigation.vue 模块说明

  - 文件职责:
      将同一份设置模块配置渲染为桌面侧栏、平板顶部入口和手机选择器。
      同步当前路由选中态并发起模块导航，不维护设置模块业务数据。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SETTINGS_MODULE_ID: 自定义配置，提供设置模块唯一标识枚举。
      SETTINGS_ROUTE_NAME: 自定义配置，提供设置模块命名路由枚举。

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SettingsNavigation: 当前文件公开的组件或模块能力。
*/

// 导入来源: ../../config/settings-module.config。
// 导入内容: SETTINGS_MODULE_ID 模块标识枚举和 SETTINGS_ROUTE_NAME 命名路由枚举。
// 文件作用: 设置导航与路由表共享默认数据源列表路由，不维护魔法字符串。

import {
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_MODULE_ID 设置模块标识枚举。
  // 文件作用: 为缺失 meta 的路由提供数据源管理模块兜底 id。
  SETTINGS_MODULE_ID,

  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_ROUTE_NAME 设置模块命名路由枚举。
  // 文件作用: 为详情等子路由提供数据源管理入口路由兜底。
  SETTINGS_ROUTE_NAME
} from '../../config/settings-module.config';

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools 和错误堆栈识别设置导航。
  name: 'SettingsNavigation',

  props: {
    // 类型: Array<object>。
    // 来源: SettingsView 根据 settings-module.config.js 过滤和排序后传入。
    // 作用: 生成桌面按钮和平板、手机模块入口。
    modules: {
      type: Array,

      /**
       * 创建 modules 属性的独立默认值。
       *
       * @returns {Array<object>} 空的设置模块入口列表。
       * 纯函数: 每次调用都返回新数组，不修改路由配置或父组件数据。
       */
      default() {
        return [];
      }
    }
  },

  /**
   * 创建设置导航局部状态。
   * selectedRouteName 初始值来自当前路由，用于控制手机选择器选中项。
   *
   * @returns {object} 当前组件响应式局部状态。
   * @returns {string} return.selectedRouteName 当前设置模块入口路由名称。
   * 纯函数: data 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
  data() {
    return {
      // 类型: string。
      // 初始值: 当前路由对应模块或数据源管理兜底路由。
      // 作用: 控制手机 el-select 当前选中模块。
      selectedRouteName: this.resolveSelectedRouteName()
    };
  },

  computed: {
    /**
     * 读取当前设置模块 id。
     * 数据来源: 设置子路由 meta.settingsModuleId。
     *
     * @returns {string} 当前设置模块 id；缺失时返回 sources。
     * 纯函数: activeModuleId 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    activeModuleId() {
      // 返回值类型: string。
      // 作用: 给桌面和平板导航按钮提供统一激活态。
      return this.$route.meta && this.$route.meta.settingsModuleId
        ? this.$route.meta.settingsModuleId
        : SETTINGS_MODULE_ID.sources;
    }
  },

  watch: {
    /**
     * 监听当前命名路由。
     * 当用户通过浏览器返回、前进或代码跳转改变设置模块时，同步手机选择器。
     *
     * @param {string} nextRouteName 新的命名路由名称，用于触发手机选择器同步。
     * @param {string} previousRouteName 旧的命名路由名称，用于说明监听变化来源。
     * @returns {void} 只同步组件内部选择值。
     * 副作用: 在路由名称实际变化时更新 selectedRouteName，不发起新的路由跳转。
     */
    '$route.name'(nextRouteName, previousRouteName) {
      // 条件分支: 新旧路由名称一致时进入。
      // 执行内容: 直接退出，避免重复写入手机选择器状态。

      if (nextRouteName === previousRouteName) return;

      // 类型: string。
      // 作用: 使用最新路由覆盖手机选择器，避免浏览器导航后显示旧模块。
      this.selectedRouteName = this.resolveSelectedRouteName();
    }
  },

  methods: {
    /**
     * 解析当前设置模块的导航路由名称。
     * 纯读取方法: 不执行路由跳转，只读取 route meta 和 modules。
     *
     * @returns {string} 当前设置模块入口路由名称。
     * 纯函数: resolveSelectedRouteName 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    resolveSelectedRouteName() {
      // 类型: string。
      // 作用: 读取详情页等子路由声明的模块入口路由，让手机选择器仍显示数据源管理。

      const configuredRouteName = this.$route.meta && this.$route.meta.settingsRouteName;

      // 返回值类型: string。
      // 作用: 优先返回配置入口路由，缺失时使用稳定数据源管理兜底。
      return configuredRouteName || SETTINGS_ROUTE_NAME.sources;
    },

    /**
     * 跳转到设置模块。
     * 触发来源: 桌面按钮点击或手机 el-select change 事件。
     *
     * @param {string} routeName 目标设置模块命名路由。
     * @returns {void} 只触发路由导航。
 * 副作用: navigateToModule 会完成 navigateToModule 对应处理，并同步相关组件状态、路由或对外事件。
 */
    navigateToModule(routeName) {
      // 条件分支: 目标路由为空或和当前路由相同时进入。
      // 执行内容: 直接退出，避免重复导航错误。

      if (!routeName || routeName === this.$route.name) return;

      // 副作用: 跳转到目标设置模块，浏览器地址和工作区内容同步更新。

      this.$router.push({ name: routeName }).catch((error) => {
        // 条件分支: 错误不是 Vue Router 重复导航时进入。
        // 执行内容: 继续抛出真实路由错误，避免静默失败。

        if (error && error.name !== 'NavigationDuplicated') throw error;
      });
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 设置模块导航 `.settings-navigation`。
  样式作用:
  桌面作为吸附侧栏，平板和手机由媒体查询切换为顶部导航。
*/
.settings-navigation {
  /* 桌面侧栏使用内部留白，避免按钮贴住面板边界。 */
  padding: 12px;

  /* 桌面滚动时保持导航靠近视口顶部，提高模块切换可达性。 */
  position: sticky;

  /* 吸附位置考虑应用顶部导航和普通页面上边距。 */
  top: 86px;

  /* 导航层级只需高于普通页面内容，低于弹窗遮罩。 */
  z-index: 5;
}

/*
  作用容器: 桌面和平板模块按钮容器 `.settings-navigation__desktop`。
  样式作用:
  桌面纵向排列四个模块，平板切换等宽横向结构。
*/
.settings-navigation__desktop {
  /* 桌面使用纵向排列，让四个模块形成稳定侧栏。 */
  display: grid;

  /* 模块按钮之间使用统一紧凑间距。 */
  gap: 6px;
}

/*
  作用容器: 设置模块按钮 `.settings-navigation__item`。
  样式作用:
  提供统一点击区域、文本层级和状态过渡。
*/
.settings-navigation__item {
  /* 清除原生按钮边框，交给激活态和焦点态表达层级。 */
  border: 0;

  /* 模块按钮使用透明背景融入导航面板。 */
  background: transparent;

  /* 左右留白保证文字和点击区域舒适。 */
  padding: 12px 14px;

  /* 统一模块按钮圆角，和项目普通控件保持一致。 */
  border-radius: 10px;

  /* 导航文字左对齐，方便快速纵向扫描。 */
  text-align: left;

  /* 使用次级文字色降低未选模块权重。 */
  color: var(--text-secondary);

  /* 明确按钮可点击。 */
  cursor: pointer;

  /* 只过渡颜色和背景，避免触发布局变化。 */
  transition: color var(--motion-fast), background var(--motion-fast);
}

/*
  作用容器: 当前设置模块按钮 `.settings-navigation__item--active`。
  样式作用:
  使用强调色明确当前工作区所属模块。
*/
.settings-navigation__item--active {
  /* 使用主题浅色背景标识当前模块。 */
  background: var(--accent-soft);

  /* 使用主题色强化当前模块文字。 */
  color: var(--accent);
}

/*
  作用容器: 鼠标悬停的设置模块按钮。
  样式作用:
  提示当前入口可以切换模块，并保持与激活态一致的色彩体系。
*/
.settings-navigation__item:hover {
  /* 悬停时显示轻背景，提示当前入口可点击。 */
  background: var(--accent-soft);
}

/*
  作用容器: 键盘聚焦的设置模块按钮。
  样式作用:
  向键盘用户显示当前可激活入口，不影响鼠标普通状态。
*/
.settings-navigation__item:focus-visible {
  /* 提供清晰主题色焦点轮廓。 */
  outline: 2px solid var(--accent);

  /* 让焦点轮廓和按钮边界保持距离。 */
  outline-offset: 2px;
}

/*
  作用容器: 设置模块按钮标题 `.settings-navigation__item-title`。
  样式作用:
  以中等字重保持模块名称可扫描。
*/
.settings-navigation__item-title {
  /* 设置中等字重，平衡导航可读性和工作区视觉权重。 */
  font-weight: 600;
}

/*
  作用容器: 手机设置模块选择器 `.settings-navigation__mobile`。
  样式作用:
  桌面和平板隐藏，手机替代横向按钮避免入口压缩。
*/
.settings-navigation__mobile {
  /* 桌面和平板不渲染手机选择器视觉。 */
  display: none;
}

/*

  响应式断点: (max-width: 1100px)。
  作用范围: 作用容器: 平板和中等宽度桌面。
  样式作用:
  作用容器: 平板和中等宽度桌面。
  响应式断点: max-width 1100px。
  样式作用:
  侧栏改为工作区上方四列模块导航。

*/
@media (max-width: 1100px) {
  /*
    作用容器: 平板设置导航。
    样式作用:
    取消 sticky，跟随单列设置外壳正常滚动。
  */
  .settings-navigation {
    /* 平板导航跟随页面滚动，避免占用过多固定空间。 */
    position: static;
  }

  /*
    作用容器: 平板模块按钮容器。
    样式作用:
    四个模块改为等宽横向入口。
  */
  .settings-navigation__desktop {
    /* 平板把四个模块改成等宽横向入口。 */
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  /*
    作用容器: 平板模块按钮。
    样式作用:
    居中文案形成顶部标签式导航。
  */
  .settings-navigation__item {
    /* 平板模块文字居中，形成清晰顶部导航。 */
    text-align: center;
  }
}

/*

  响应式断点: (max-width: 640px)。
  作用范围: 作用容器: 手机设置页。
  样式作用:
  作用容器: 手机设置页。
  响应式断点: max-width 640px。
  样式作用:
  隐藏四列按钮并显示完整宽度选择器。

*/
@media (max-width: 640px) {
  /*
    作用容器: 手机设置导航。
    样式作用:
    收紧外层留白。
  */
  .settings-navigation {
    /* 手机收紧模块选择器外层留白。 */
    padding: 10px;
  }

  /*
    作用容器: 手机桌面按钮组。
    样式作用:
    隐藏容易被压缩的四列入口。
  */
  .settings-navigation__desktop {
    /* 手机隐藏四个横向按钮，避免入口被压缩。 */
    display: none;
  }

  /*
    作用容器: 手机模块选择器。
    样式作用:
    使用完整宽度承载全部设置模块。
  */
  .settings-navigation__mobile {
    /* 手机显示完整宽度模块选择器。 */
    display: block;

    /* 选择器占满设置页可用宽度。 */
    width: 100%;
  }
}
</style>
