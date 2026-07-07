<template>
  <!--
    SourceSwitchTabs 组件渲染树

    [DEFAULT] ele(section.source-switch-tabs)
    │  - condition:
    │      默认渲染。
    │      父页面引入组件后展示顶部数据源静态 tab 区域。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      数据源切换根容器。
    │      承载横向数据源 tab 列表，并在静态页面静态布局中展示当前默认选中源。
    │  - params:
    │      -- ariaLabel：数据源 tab 区域的可访问性名称。
    │      -- visibleSources：经过 enabled 过滤后的可展示数据源列表。
    │  - events: 无
    │
    ├─ [DEFAULT] ele(div.source-switch-tabs__scroller)
    │  - condition:
    │      默认渲染。
    │      用于承载横向滚动的数据源 tab。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      数据源横向滚动容器。
    │      当数据源数量增加或屏幕宽度不足时允许横向滚动，避免撑破页面。
    │  - params:
    │      -- visibleSources：用于循环渲染静态 tab。
    │  - events: 无
    │
    └─ [DEFAULT] ele(span.source-switch-tabs__item)
       - condition:
           visibleSources 循环渲染时默认生成。
           每个可用数据源对应一个静态 tab。
       - type:
           原生标签
           标签名称: span
       - description:
           数据源 tab 条目。
           展示数据源名称、域名和状态点；当前版本只做静态展示，不绑定点击切换。
       - params:
           -- source：当前循环的数据源对象。
           -- activeSourceId：当前默认选中的数据源 id。
       - events: 无
  -->
  <!--
    [DEFAULT] ele(section.source-switch-tabs)
    - condition:
        默认渲染。
        父页面引入组件后展示顶部数据源静态 tab 区域。
    - type:
        原生标签
        标签名称: section
    - description:
        数据源切换根容器。
        承载横向数据源 tab 列表，并在静态页面静态布局中展示当前默认选中源。
    - params:
        -- ariaLabel：数据源 tab 区域的可访问性名称。
        -- visibleSources：经过 enabled 过滤后的可展示数据源列表。
    - events: 无
  -->
  <section class="source-switch-tabs" :aria-label="ariaLabel">
    <!--
      [DEFAULT] ele(div.source-switch-tabs__scroller)
      - condition:
          默认渲染。
          用于承载横向滚动的数据源 tab。
      - type:
          原生标签
          标签名称: div
      - description:
          数据源横向滚动容器。
          当数据源数量增加或屏幕宽度不足时允许横向滚动，避免撑破页面。
      - params:
          -- visibleSources：用于循环渲染静态 tab。
      - events: 无
    -->
    <div class="source-switch-tabs__scroller" role="tablist">
      <!--
        [DEFAULT] ele(span.source-switch-tabs__item)
        - condition:
            visibleSources 循环渲染时默认生成。
            每个可用数据源对应一个静态 tab。
        - type:
            原生标签
            标签名称: span
        - description:
            数据源 tab 条目。
            展示数据源名称、域名和状态点；当前版本只做静态展示，不绑定点击切换。
        - params:
            -- source：当前循环的数据源对象。
            -- activeSourceId：当前默认选中的数据源 id。
        - events: 无
      -->
      <span
        v-for="source in visibleSources"
        :key="source.id"
        class="source-switch-tabs__item"
        :class="{ 'source-switch-tabs__item--active': source.id === activeSourceId }"
        role="tab"
        :aria-selected="source.id === activeSourceId ? 'true' : 'false'"
      >
        <span class="source-switch-tabs__text">
          <span class="source-switch-tabs__name">{{ source.name }}</span>
          <span class="source-switch-tabs__domain">· {{ source.domain }}</span>
        </span>
        <span
          class="source-switch-tabs__status-dot"
          :class="`source-switch-tabs__status-dot--${source.status || 'unknown'}`"
          :aria-label="getStatusLabel(source.status)"
        ></span>
      </span>
    </div>
  </section>
</template>

<script>
/*
  SourceSwitchTabs script 模块说明

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级辅助函数:
      无
*/

export default {
  // 组件名称用于在 Vue Devtools 和父页面 components 注册项中识别顶部数据源静态 tab。
  name: 'SourceSwitchTabs',

  props: {
    // 类型: Array<object>。
    // 来源: 父页面从 source-switch.mock.js 传入。
    // 作用: 渲染顶部数据源 tab 列表。
    // 条目字段: id，string，数据源唯一标识，用于匹配 activeSourceId。
    // 条目字段: name，string，数据源展示名称，用于 tab 主文案。
    // 条目字段: domain，string，数据源域名标识，用于 tab 次级文案。
    // 条目字段: enabled，boolean，控制该源是否出现在静态 tab 列表。
    // 条目字段: status，string，控制数据源状态点颜色和可访问性说明。
    sources: {
      type: Array,
      default() {
        // 返回值类型: Array<object>。
        // 作用: props 缺失时提供空数组，避免 visibleSources 计算时报错。
        return [];
      }
    },

    // 类型: string。
    // 来源: 父页面从 source-switch.mock.js 传入。
    // 作用: 控制哪个数据源 tab 展示为静态选中态。
    activeSourceId: {
      type: String,
      default: ''
    },

    // 类型: string。
    // 来源: 父页面按当前页面语义传入。
    // 作用: 给 section 提供可访问性名称，便于辅助技术识别该区域。
    ariaLabel: {
      type: String,
      default: '数据源切换'
    }
  },

  computed: {
    /**
     * 计算当前需要展示的数据源列表。
     * 静态页面只做静态布局展示，不触发外部数据源筛选请求。
     * 该计算属性只过滤 enabled 为 false 的源，不修改 props 或外部数据。
     *
     * @returns {Array<object>} 可展示的数据源列表。
     * @returns {string} return[].id 数据源唯一标识，用于静态选中态匹配。
     * @returns {string} return[].name 数据源展示名称，用于 tab 主文案。
     * @returns {string} return[].domain 数据源域名标识，用于 tab 次级文案。
     */
    visibleSources() {
      // 类型: Array<object>。
      // 作用: 只保留 enabled 不为 false 的源，保证静态 tab 列表不展示显式禁用源。
      return this.sources.filter(source => source && source.enabled !== false);
    }
  },

  methods: {
    /**
     * 读取数据源状态点的可访问性说明。
     * 触发来源: template 渲染每个 source-switch-tabs__status-dot 时调用。
     * 执行内容: 将 status 机器字段转换成屏幕阅读器可理解的中文说明。
     *
     * @param {string} status 数据源状态机器字段。
     * @returns {string} 数据源状态的中文说明。
     */
    getStatusLabel(status) {
      // 条件分支: ready 表示当前静态源处于可用状态。
      // 作用: 给状态点提供“数据源可用”的辅助说明。
      if (status === 'ready') {
        return '数据源可用';
      }

      // 返回值类型: string。
      // 作用: 对未知状态提供兜底说明，避免 aria-label 为空。
      return '数据源状态未知';
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 数据源切换根容器 `.source-switch-tabs`。
  样式作用:
  在页面标题或首页轮播之前建立独立的数据源切换区域。
  让 tab 列表和下方页面内容保持稳定间距。
  只负责静态布局，不表达真实请求状态。
*/
.source-switch-tabs {
  /* 设置数据源切换区和下方内容之间的间距，让缩小后的 tab 不贴住轮播、筛选或搜索面板。 */
  margin: 0 0 24px;
}

/*
  作用容器: 数据源 tab 横向滚动容器 `.source-switch-tabs__scroller`。
  样式作用:
  横向排列所有数据源 tab。
  数据源数量增加时允许横向滚动。
  隐藏默认滚动条，让区域更接近参考图中的胶囊列表。
*/
.source-switch-tabs__scroller {
  /* 使用 flex 横向排列每一个数据源 tab。 */
  display: flex;

  /* 让数据源 tab 垂直居中，避免状态点和文字上下错位。 */
  align-items: center;

  /* 设置 tab 之间的横向间距，缩小 25% 后仍保持每个数据源胶囊有独立边界。 */
  gap: 9px;

  /* 横向溢出时允许滚动，避免小屏或源数量增加时撑破页面。 */
  overflow-x: auto;

  /* 底部留 2px，避免某些浏览器横向滚动区域裁切 tab 阴影或边框。 */
  padding: 0 0 2px;

  /* 使用平滑触摸滚动，让移动端横向浏览数据源更自然。 */
  -webkit-overflow-scrolling: touch;

  /* 隐藏 Firefox 默认滚动条，保持顶部 tab 区域视觉干净。 */
  scrollbar-width: none;
}

/*
  作用容器: WebKit 浏览器中的数据源滚动条伪元素。
  样式作用:
  隐藏横向滚动条。
  保持数据源 tab 区域和参考图一样简洁。
*/
.source-switch-tabs__scroller::-webkit-scrollbar {
  /* 隐藏 WebKit 滚动条，避免横向滚动条占据 tab 下方空间。 */
  display: none;
}

/*
  作用容器: 单个数据源 tab `.source-switch-tabs__item`。
  样式作用:
  展示数据源名称、域名和状态点。
  使用浅色胶囊形态贴近参考图。
  当前版本不绑定点击事件，只表达静态选中态。
*/
.source-switch-tabs__item {
  /* 使用 inline-flex 让 tab 可以根据文字宽度自然撑开。 */
  display: inline-flex;

  /* 垂直居中文本和状态点。 */
  align-items: center;

  /* 设置文本和状态点之间的距离，避免缩小后的状态点贴住域名。 */
  gap: 8px;

  /* 禁止 tab 被 flex 容器压缩，保证源名称和域名可读。 */
  flex: 0 0 auto;

  /* 设置静态 tab 的最小高度，比原始方案缩小约 25%，降低顶部区域占用。 */
  min-height: 36px;

  /* 设置左右内边距，比原始方案缩小约 25%，让整体 tab 视觉更轻。 */
  padding: 0 15px;

  /* 设置浅色半透明背景，让 tab 从页面背景中独立出来。 */
  background: rgba(255, 255, 255, 0.78);

  /* 设置浅边框，明确每个数据源 tab 的边界。 */
  border: 1px solid rgba(214, 222, 234, 0.86);

  /* 设置胶囊圆角，贴近参考图中的 pill tab 风格。 */
  border-radius: 999px;

  /* 设置柔和阴影，让 tab 在浅色页面背景上保持轻微层级。 */
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);

  /* 设置默认文字颜色，保证未选中源名称可读但不抢选中态权重。 */
  color: var(--text-secondary);

  /* 阻止用户选中 tab 文案，让静态 tab 区域看起来更像控件。 */
  user-select: none;

  /* 设置缩小后的 tab 字号，让整体尺寸和高度保持一致。 */
  font-size: 13px;
}

/*
  作用容器: 当前静态选中的数据源 tab `.source-switch-tabs__item--active`。
  样式作用:
  强化默认数据源的高亮状态。
  让用户进入页面后能立即识别当前内容默认对应哪个源。
  和普通数据源 tab 形成清晰视觉层级。
*/
.source-switch-tabs__item--active {
  /* 设置选中 tab 的浅蓝背景，表达当前源处于默认选中状态。 */
  background: rgba(91, 140, 255, 0.12);

  /* 设置选中 tab 的蓝色边框，让当前源边界更清楚。 */
  border-color: rgba(91, 140, 255, 0.34);

  /* 设置选中 tab 的文字颜色，让源名称和域名比普通 tab 更醒目。 */
  color: var(--accent-strong);

  /* 设置选中 tab 阴影，让当前源在 tab 列表中略微浮起。 */
  box-shadow: 0 12px 28px rgba(79, 127, 255, 0.14);
}

/*
  作用容器: 数据源 tab 文本容器 `.source-switch-tabs__text`。
  样式作用:
  横向排列源名称和域名。
  保证长域名在小屏下不会把 tab 撑得过宽。
*/
.source-switch-tabs__text {
  /* 使用 inline-flex 横向排列名称和域名。 */
  display: inline-flex;

  /* 让名称和域名垂直居中。 */
  align-items: center;

  /* 限制单个 tab 文本最大宽度，避免缩小后的长域名挤占整行空间。 */
  max-width: min(210px, 58vw);

  /* 隐藏超出最大宽度的文本，为省略号提供条件。 */
  overflow: hidden;
}

/*
  作用容器: 数据源名称 `.source-switch-tabs__name`。
  样式作用:
  作为 tab 内最重要的可读文本。
  在源名称和域名之间建立主次层级。
*/
.source-switch-tabs__name {
  /* 设置名称字重，让源名称比域名更突出。 */
  font-weight: 600;

  /* 保持名称不换行，避免单个 tab 高度被撑开。 */
  white-space: nowrap;
}

/*
  作用容器: 数据源域名 `.source-switch-tabs__domain`。
  样式作用:
  给用户提供源域名或接口标识。
  作为次级信息弱化展示。
*/
.source-switch-tabs__domain {
  /* 设置域名左侧轻微留白，避免点号和源名称贴得过紧。 */
  margin-left: 2px;

  /* 设置域名文本不换行，保持 tab 胶囊高度稳定。 */
  white-space: nowrap;

  /* 超出最大宽度时使用省略号，避免长域名撑破 tab。 */
  text-overflow: ellipsis;

  /* 配合 text-overflow 隐藏溢出文本。 */
  overflow: hidden;

  /* 弱化域名透明度，让源名称保持主视觉。 */
  opacity: 0.82;
}

/*
  作用容器: 数据源状态点 `.source-switch-tabs__status-dot`。
  样式作用:
  在 tab 右侧提供源状态视觉反馈。
  当前版本只表达 mock 源 ready 状态，不代表真实健康检查。
*/
.source-switch-tabs__status-dot {
  /* 固定状态点宽度，比原始方案缩小约 25%，保证右侧状态反馈不显得过重。 */
  width: 8px;

  /* 固定状态点高度，和宽度一起形成缩小后的圆点。 */
  height: 8px;

  /* 禁止状态点被压缩，避免小屏下圆点变形。 */
  flex: 0 0 auto;

  /* 圆角设置为 50%，让状态点呈现圆形。 */
  border-radius: 50%;

  /* 默认状态使用弱色，避免未知状态误导用户。 */
  background: var(--border-strong);
}

/*
  作用容器: ready 状态的数据源点 `.source-switch-tabs__status-dot--ready`。
  样式作用:
  用绿色表达当前 mock 源处于可用状态。
  和设置页中的成功态颜色保持一致。
*/
.source-switch-tabs__status-dot--ready {
  /* 设置 ready 状态点为成功色，让可用状态一眼可见。 */
  background: var(--success);

  /* 增加绿色柔和外光，缩小后仍保留在线状态点的可见性。 */
  box-shadow: 0 0 0 3px rgba(56, 180, 139, 0.12);
}

/*
  作用容器: 小屏下的数据源切换区域。
  样式作用:
  收紧 tab 间距和内边距。
  给手机端内容区域留出更多横向空间。
*/
@media (max-width: 640px) {
  .source-switch-tabs {
    /* 缩小移动端数据源区和下方内容之间的间距，降低首屏纵向占用。 */
    margin-bottom: 18px;
  }

  .source-switch-tabs__scroller {
    /* 缩小移动端 tab 横向间距，让首屏可以露出更多数据源入口。 */
    gap: 8px;
  }

  .source-switch-tabs__item {
    /* 缩小移动端 tab 左右内边距，让长域名仍有显示空间。 */
    padding: 0 12px;

    /* 降低移动端 tab 高度，减少顶部区域占用。 */
    min-height: 34px;
  }
}
</style>
