<template>
  <!--
    SettingsEmptyPanel 组件渲染树

    [DEFAULT] ele(section.settings-empty-panel.theme-surface)
    │  - condition:
    │      默认渲染。
    │      播放设置、快捷键设置或全局配置子路由命中时作为工作区主体显示。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      普通设置模块空内容面板。
    │      根据设置模块配置展示真实标题和空状态，不生成未经确认的设置字段。
    │  - params:
    │      -- moduleId：由设置子路由 props 传入，用于定位 SETTINGS_MODULES 中的模块定义。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(header.settings-empty-panel__header)
    │  │  - condition:
    │  │      默认渲染。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: header
    │  │  - description:
    │  │      空模块标题区域。
    │  │      只承载当前设置模块名称，与空状态说明分隔。
    │  │  - params:
    │  │      无
    │  │  - events:
    │  │      无
    │  │
    │  └─ [DEFAULT] ele(h1.settings-empty-panel__title)
    │     - condition:
    │         默认渲染。
    │     - type:
    │         原生标签
    │         标签名称: h1
    │     - description:
    │         设置模块主标题。
    │         展示 moduleDefinition.title，保证导航和页面标题来自同一配置。
    │     - params:
    │         -- moduleDefinition.title：当前设置模块用户可读名称。
    │     - events:
    │         无
    │
    └─ [DEFAULT] ele(el-empty.settings-empty-panel__empty)
       - condition:
           默认渲染。
           普通设置模块没有可用配置字段时展示空状态。
       - type:
           第三方组件
           组件库: Element UI
           组件名称: el-empty
       - description:
           普通设置模块空状态。
           展示模块配置说明，说明缺失时使用 DEFAULT_EMPTY_DESCRIPTION。
       - params:
           -- moduleDefinition.description：当前模块配置中的空内容说明。
           -- defaultDescription：模块说明为空时使用的兜底文案。
           -- emptyImageSize：统一空状态插图尺寸。
       - events:
           无
  -->
  <!--
    [DEFAULT] ele(section.settings-empty-panel.theme-surface)
    - condition:
        默认渲染。
    - type:
        原生标签
        标签名称: section
    - description:
        普通设置模块空内容面板根容器。
        组合模块标题和 Element UI 空状态。
    - params:
        -- moduleId：路由传入的设置模块标识。
    - events:
        无
  -->
  <section class="settings-empty-panel theme-surface">
    <!--
      [DEFAULT] ele(header.settings-empty-panel__header)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: header
      - description:
          空模块标题区域。
          与下方空状态通过底边框建立层级。
      - params:
          无
      - events:
          无
    -->
    <header class="settings-empty-panel__header">
      <!--
        [DEFAULT] ele(h1.settings-empty-panel__title)
        - condition:
            默认渲染。
        - type:
            原生标签
            标签名称: h1
        - description:
            设置模块主标题。
            展示统一配置中的当前模块名称。
        - params:
            -- moduleDefinition.title：当前设置模块标题。
        - events:
            无
      -->
      <h1 class="settings-empty-panel__title">{{ moduleDefinition.title }}</h1>
    </header>

    <!--
      [DEFAULT] ele(el-empty.settings-empty-panel__empty)
      - condition:
          默认渲染。
          当前模块没有真实配置字段时展示说明。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-empty
      - description:
          普通设置模块空状态。
          不创建伪造开关、输入框或默认值。
      - params:
          -- moduleDefinition.description：统一配置中的模块说明。
          -- defaultDescription：说明缺失时的兜底文案。
          -- emptyImageSize：统一插图尺寸。
      - events:
          无
    -->
    <el-empty
      class="settings-empty-panel__empty"
      :description="moduleDefinition.description || defaultDescription"
      :image-size="emptyImageSize"
    />
  </section>
</template>

<script>
/*
  SettingsEmptyPanel.vue 模块说明

  - 文件职责:
      为尚未开放具体配置的设置模块展示统一标题、说明和空内容状态。
      只消费路由模块 id 与集中配置，不创建虚构设置字段或保存页面状态。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SETTINGS_MODULES: 自定义配置，提供空模块标题和说明。

  - 模块级常量:
      DEFAULT_EMPTY_DESCRIPTION: string，空模块缺失说明时的兜底文案。
      EMPTY_IMAGE_SIZE: number，Element UI 空状态插图尺寸。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SettingsEmptyPanel: 当前文件公开的组件或模块能力。
*/

import {
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_MODULES 设置模块定义数组。
  // 文件作用: 根据 moduleId 读取真实模块标题和空内容说明。
  SETTINGS_MODULES
} from '../../config/settings-module.config';

// 类型: string。
// 作用: 模块配置缺失说明时提供稳定用户文案。

const DEFAULT_EMPTY_DESCRIPTION = '暂无可配置内容';

// 类型: number。
// 作用: 统一三个空模块的插图尺寸，避免模板散落魔法数字。

const EMPTY_IMAGE_SIZE = 112;

export default {
  // 组件名称: SettingsEmptyPanel。
  // 作用: 供 Vue Devtools、递归组件识别和运行时报错定位使用。
  name: 'SettingsEmptyPanel',

  props: {
    // 类型: string。
    // 来源: 设置空模块路由 props。
    // 作用: 从统一模块配置中定位当前标题和说明。
    // 影响: 值变化会重新计算 moduleDefinition，并更新标题和空状态文案。
    moduleId: {
      type: String,
      required: true
    }
  },

  computed: {
    /**
     * 读取当前空模块定义。
     * 数据来源: SETTINGS_MODULES。
     * 该计算属性只查找冻结配置，不修改模块数组或路由状态。
     *
     * @returns {object} 当前模块定义；未匹配时返回稳定兜底对象。
     * @returns {string} return.title 页面主标题。
     * @returns {string} return.description 空状态说明。
     * 纯函数: moduleDefinition 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    moduleDefinition() {
      // 类型: object|undefined。
      // 作用: 查找 route props 对应设置模块。
      // 循环类型: Array.prototype.find。
      // 初始值: SETTINGS_MODULES 第一条模块定义。
      // 终止条件: 找到 id 与 moduleId 相同的模块，或全部模块检查完成。
      // 循环作用: 使用路由传入的 moduleId 定位当前页面展示配置。
      // 类型: object|undefined。
      // 作用: 保存与当前路由 moduleId 匹配的设置模块定义。

      const matchedModule = SETTINGS_MODULES.find(moduleDefinition => moduleDefinition.id === this.moduleId);

      // 返回值类型: object。
      // 作用: 保证模板始终可以安全读取 title 和 description。
      // 条件分支: matchedModule 存在时返回真实冻结配置，否则返回只用于防止渲染报错的兜底对象。
      return matchedModule || { title: '设置', description: DEFAULT_EMPTY_DESCRIPTION };
    },

    /**
     * 读取默认空内容文案。
     * 数据来源: 模块级 DEFAULT_EMPTY_DESCRIPTION 常量。
     * 该计算属性只向模板暴露兜底文案，不修改模块配置。
     *
     * @returns {string} 空模块兜底说明。
     * 纯函数: defaultDescription 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    defaultDescription() {
      // 返回值类型: string。
      // 作用: moduleDefinition.description 为空时避免 el-empty 展示空白说明。
      return DEFAULT_EMPTY_DESCRIPTION;
    },

    /**
     * 读取空状态插图尺寸。
     * 数据来源: 模块级 EMPTY_IMAGE_SIZE 常量。
     * 该计算属性只向模板暴露集中尺寸，不修改组件状态。
     *
     * @returns {number} Element UI el-empty image-size。
 * 纯函数: emptyImageSize 只读取输入参数或组件只读状态，并返回对应派生结果，不修改响应式状态或外部存储。
 */
    emptyImageSize() {
      // 返回值类型: number。
      // 作用: 给三个普通设置空模块提供一致插图尺寸。
      return EMPTY_IMAGE_SIZE;
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 空设置模块面板 `.settings-empty-panel`。
  样式作用:
  提供统一内容留白和稳定空态高度。
  让播放设置、快捷键设置和全局配置保持一致页面结构。
*/
.settings-empty-panel {
  /* 给标题和空状态提供舒适内部空间。 */
  padding: 24px;

  /* 保证空内容模块在普通桌面具有稳定可见高度。 */
  min-height: 420px;
}

/*
  作用容器: 空模块标题区 `.settings-empty-panel__header`。
  样式作用:
  使用底边界分隔模块标题和空状态说明。
  保持标题区域与数据源管理页面的信息层级一致。
*/
.settings-empty-panel__header {
  /* 用底部分隔线区分标题和空状态主体。 */
  padding-bottom: 18px;

  /* 标题下方边框保持设置模块结构清晰。 */
  border-bottom: 1px solid var(--border-color);
}

/*
  作用容器: 空模块主标题 `.settings-empty-panel__title`。
  样式作用:
  展示配置文件提供的当前设置模块名称。
  建立普通设置页面最高文本层级。
*/
.settings-empty-panel__title {
  /* 清除标题默认外边距，交给面板布局控制。 */
  margin: 0;

  /* 标题使用设置页主层级字号。 */
  font-size: 24px;

  /* 标题加粗提高模块识别度。 */
  font-weight: 700;

  /* 使用全局主文字色。 */
  color: var(--text-primary);
}

/*
  响应式断点: max-width 640px。
  断点来源: 与 SettingsNavigation 手机选择器和设置外壳手机布局保持一致。
  作用范围: 手机空设置模块。
  样式作用:
  收紧面板留白和最低高度。
  降低没有设置内容时的无效滚动距离。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机空设置模块面板 `.settings-empty-panel`。
    样式作用:
    提升窄屏可用宽度并保持适量空态高度。
    不改变标题和空状态的渲染顺序。
  */
  .settings-empty-panel {
    /* 手机收紧空内容面板内边距。 */
    padding: 18px 14px;

    /* 手机降低空内容最小高度，避免空页面滚动距离过长。 */
    min-height: 340px;
  }
}
</style>
