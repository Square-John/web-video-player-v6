<template>
  <!--
    SourceGeneralSettings 组件渲染树

    [DEFAULT] ele(section.source-general-settings.theme-surface)
    │  - condition:
    │      默认渲染。
    │      SourceDetailView 找到数据源记录后把当前组件放在基本信息下方。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      普通数据源设置面板。
    │      为未来非敏感设置 Schema 保留稳定组件边界，本阶段只展示真实空状态。
    │  - params:
    │      -- schema：来源于 SourceRecord.definition.settingsSchema，当前 mock 统一为空数组。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(h2.source-general-settings__title)
    │  - condition:
    │      默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: h2
    │  - description:
    │      数据源设置区标题。
    │      建立与基本信息、缓存空间和数据源操作一致的详情区块层级。
    │  - params:
    │      无
    │  - events:
    │      无
    │
    └─ [DEFAULT] ele(el-empty.source-general-settings__empty)
       - condition:
           默认渲染。
           schema 为空时不生成伪造输入框、开关或默认值。
       - type:
           第三方组件
           组件库: Element UI
           组件名称: el-empty
       - description:
           普通设置空状态。
           明确提示当前数据源暂时没有可配置内容。
       - params:
           -- emptyImageSize：来源于 EMPTY_IMAGE_SIZE，控制空状态插图尺寸。
       - events:
           无
  -->
  <!--
    [DEFAULT] ele(section.source-general-settings.theme-surface)
    - condition:
        默认渲染。
        数据源详情记录存在时由 SourceDetailView 渲染。
    - type:
        原生标签
        标签名称: section
    - description:
        普通数据源设置面板根容器。
        本阶段只承载区块标题和真实空状态。
    - params:
        -- schema：未来普通非敏感设置定义，当前为空数组。
    - events:
        无
  -->
  <section class="source-general-settings theme-surface">
    <!--
      [DEFAULT] ele(h2.source-general-settings__title)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: h2
      - description:
          数据源设置区标题。
          标识当前面板未来只承载普通非敏感设置。
      - params:
          无
      - events:
          无
    -->
    <h2 class="source-general-settings__title">数据源设置</h2>
    <!--
      [DEFAULT] ele(el-empty.source-general-settings__empty)
      - condition:
          默认渲染。
          本阶段不根据预留 schema 生成未经产品确认的控件。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-empty
      - description:
          普通设置空状态。
          提示当前没有普通非敏感配置内容。
      - params:
          -- emptyImageSize：统一空状态插图尺寸。
      - events:
          无
    -->
    <el-empty
      class="source-general-settings__empty"
      description="该数据源暂时没有可配置内容"
      :image-size="emptyImageSize"
    />
  </section>
</template>

<script>
/*
  SourceGeneralSettings.vue 模块说明

  - 文件职责:
      承载数据源普通非敏感设置的扩展边界，并在当前无字段时展示真实空状态。
      只读取 settingsSchema，不渲染请求头、凭证、会话或验证配置。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      EMPTY_IMAGE_SIZE: number，普通设置空状态插图尺寸。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceGeneralSettings: 当前文件公开的组件或模块能力。
*/

// 类型: number。
// 作用: 统一控制详情页普通设置空状态插图尺寸，避免模板直接使用魔法数字。

const EMPTY_IMAGE_SIZE = 82;

export default {
  // 组件名称: SourceGeneralSettings。
  // 作用: 供 Vue Devtools、递归组件识别和运行时报错定位使用。
  name: 'SourceGeneralSettings',

  props: {
    // 类型: Array<object>。
    // 来源: SourceDetailView 传入的 SourceRecord.definition.settingsSchema。
    // 作用: 为未来普通非敏感设置渲染保留稳定输入边界。
    // 当前表现: 数组为空时继续显示真实空状态，不生成伪造控件。
    schema: {
      type: Array,

      /**
       * 创建 schema 属性的独立默认值。
       *
       * @returns {Array<object>} 空的普通设置字段定义列表。
       * 纯函数: 每次调用都返回新数组，不修改数据源设置定义或父组件状态。
       */
      default() {
        return [];
      }
    }
  },

  computed: {
    /**
     * 读取普通设置空状态插图尺寸。
     * 数据来源: 模块级 EMPTY_IMAGE_SIZE 常量。
     * 该计算属性只向模板暴露集中尺寸，不修改 props 或组件状态。
     *
     * @returns {number} Element UI el-empty 使用的 image-size 数值。
 * 纯函数: emptyImageSize 只读取输入参数或组件只读状态，并返回对应派生结果，不修改响应式状态或外部存储。
 */
    emptyImageSize() {
      // 返回值类型: number。
      // 作用: 让模板不直接使用数字字面值，并保持详情空状态尺寸稳定。
      return EMPTY_IMAGE_SIZE;
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 普通设置面板 `.source-general-settings`。
  样式作用:
  提供详情区块统一留白和最低可读高度。
  保证空状态不会因内容较少被压缩成过薄区域。
*/
.source-general-settings {
  /* 设置面板内部安全留白。 */
  padding: 22px;
  /* 保证空状态不被压缩成过薄区域。 */
  min-height: 250px;
}

/*
  作用容器: 普通设置区标题 `.source-general-settings__title`。
  样式作用:
  建立详情区块标题层级。
  与基本信息、缓存空间和数据源操作标题保持一致。
*/
.source-general-settings__title {
  /* 清除标题默认外边距。 */
  margin: 0;
  /* 使用详情区块标题字号。 */
  font-size: 18px;
  /* 使用主题主文本色。 */
  color: var(--text-primary);
}

/*
  响应式断点: max-width 640px。
  断点来源: 与设置导航手机选择器和详情页手机布局保持一致。
  作用范围: 手机普通设置面板。
  样式作用:
  收紧面板留白和空态高度。
  给手机详情页保留更多横向内容空间。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机普通设置面板 `.source-general-settings`。
    样式作用:
    提升窄屏内容可用宽度。
    降低空内容区在手机上的垂直占用。
  */
  .source-general-settings {
    /* 缩小手机面板内边距。 */
    padding: 17px 14px;
    /* 降低手机空状态最低高度。 */
    min-height: 220px;
  }
}
</style>
