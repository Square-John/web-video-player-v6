<template>
  <!--
    SettingsView 页面渲染树

    {div.theme-page.settings-container}
    └─ {el-collapse.settings-collapse} [v-model="activePanels"]
       ├─ {el-collapse-item name="sources"}
       │  └─ 数据源管理面板
       │     ├─ (collapse title)
       │     │  └─ {span.section-title} 显示“数据源管理”
       │     ├─ {p.panel-intro}
       │     │  └─ 说明数据源影响搜索、首页、电影和电视剧数据
       │     ├─ (manager-toolbar)
       │     │  ├─ (manager-kind-tabs) 系统源 / 自定义源
       │     │  ├─ (manager-summary) 已启用源 / 搜索缓存 / 页面缓存
       │     │  └─ (manager-actions) 检测 / 清缓存 / 导入
       │     ├─ [if hasSources]
       │     │  └─ {article.source-row} 循环渲染数据源行列表
       │     └─ [else]
       │        └─ {el-empty} 显示暂无数据源
       │
       └─ {el-collapse-item name="shortcuts"}
          └─ 快捷键操作面板
             ├─ (collapse title)
             │  └─ {span.section-title} 显示“快捷键操作”
             ├─ {p.panel-intro}
             │  └─ 说明快捷键影响首页轮播和播放页键盘行为
             └─ {section.shortcut-section.theme-surface}
                ├─ (shortcut-grid)
                │  ├─ (shortcut-item) 启用快捷键
                │  ├─ (shortcut-item) 首页轮播键盘控制
                │  ├─ (shortcut-item) 播放页键盘控制
                │  └─ (shortcut-item.shortcut-item-wide) 播放页快进快退步长
                ├─ (shortcut-tips)
                │  └─ 显示当前快捷键速查标签
                └─ (section-actions)
                   └─ {el-button} 恢复默认快捷键
  -->
  <!-- 设置页根容器，负责承载数据源管理和快捷键设置两个折叠面板。 -->
  <div class="theme-page settings-container">
    <!--
      设置页主体折叠面板。
      `activePanels` 控制当前展开的数据源管理和快捷键操作面板。
    -->
    <el-collapse v-model="activePanels" class="settings-collapse">
      <!-- 数据源管理面板，回归原设置页第一块折叠区域。 -->
      <el-collapse-item name="sources" data-testid="settings-sources-panel">
        <!-- 折叠标题插槽，使用带蓝色竖线的分区标题。 -->
        <template slot="title">
          <div class="collapse-title-wrap">
            <span class="section-title">数据源管理</span>
          </div>
        </template>

        <!-- 数据源管理说明。 -->
        <p class="panel-intro">集中管理搜索、首页、电影和电视剧的数据源。</p>

        <!--
          统一源管理内容区。
          结构严格贴近原设置页：顶部工具栏 + 纵向数据源行列表。
        -->
        <section class="theme-surface unified-source-manager">
          <!--
            顶部工具栏。
            左侧是系统源 / 自定义源切换，中间是统计摘要，右侧是批量操作。
          -->
          <div class="manager-toolbar">
            <div class="manager-toolbar-block manager-toolbar-left">
              <el-tabs value="system" class="manager-kind-tabs">
                <el-tab-pane name="system">
                  <span slot="label" class="manager-kind-label">
                    <span>系统源</span>
                    <span class="kind-tab-badge">{{ systemSourceCount }}</span>
                    <span v-if="enabledSourceCount > 0" class="kind-tab-dot"></span>
                  </span>
                </el-tab-pane>
                <el-tab-pane name="custom">
                  <span slot="label" class="manager-kind-label">
                    <span>自定义源</span>
                    <span class="kind-tab-badge">0</span>
                  </span>
                </el-tab-pane>
              </el-tabs>
            </div>

            <div class="manager-summary manager-toolbar-block manager-toolbar-center">
              <div class="summary-chip">
                <span class="summary-label">已启用源</span>
                <span class="summary-value">{{ enabledSourceCount }} 条</span>
              </div>
              <div class="summary-chip">
                <span class="summary-label">搜索缓存</span>
                <span class="summary-value">{{ searchCacheCount }} 条</span>
              </div>
              <div class="summary-chip">
                <span class="summary-label">页面缓存</span>
                <span class="summary-value">{{ pageCacheCount }} 条</span>
              </div>
            </div>

            <div class="manager-actions manager-toolbar-block manager-toolbar-right">
              <el-button size="small" :loading="checkingAllSources" @click="checkAllSources">
                检测全部已启用源
              </el-button>
              <el-button size="small" @click="clearAllCache">清空全部缓存</el-button>
              <el-button type="primary" size="small" icon="el-icon-plus">导入数据源</el-button>
            </div>
          </div>

          <!-- 有数据源时按原设置页的统一源行展示。 -->
          <div v-if="hasSources" class="source-list">
            <article
              v-for="source in sources"
              :key="source.id"
              class="source-row"
              :class="{ 'source-row--disabled': !source.enabled }"
            >
              <div class="source-main">
                <div class="source-name-row">
                  <span class="source-name">{{ source.name || '未命名数据源' }} · {{ source.domain || '暂无域名' }}</span>
                  <span class="source-type public">系统</span>
                </div>
                <div class="source-desc">{{ source.message || '暂无状态说明。' }}</div>
                <div class="capability-list">
                  <span
                    v-for="capability in getVisibleCapabilityItems(source.capabilities)"
                    :key="`${source.id}-${capability.name}`"
                    class="capability-chip"
                    :class="capability.enabled ? 'enabled' : 'missing'"
                  >
                    <span class="capability-name">{{ capability.label }}</span>
                    <span class="capability-dot"></span>
                  </span>
                </div>
              </div>

              <div class="source-version">{{ source.version || 'v1.0.0' }}</div>

              <div class="source-actions">
                <el-button size="mini">检测</el-button>
                <el-button size="mini" @click="resetProxySession">重置会话</el-button>
                <el-button size="mini" :disabled="source.isDefault">
                  {{ source.isDefault ? '当前主用' : '设为主用' }}
                </el-button>
                <el-switch :value="source.enabled" disabled />
              </div>
            </article>
          </div>

          <!-- 没有数据源时显示空状态。 -->
          <el-empty v-else description="暂无数据源" />
        </section>
      </el-collapse-item>

      <!-- 快捷键操作面板，回归原设置页第二块折叠区域。 -->
      <el-collapse-item name="shortcuts" data-testid="settings-shortcuts-panel">
        <!-- 折叠标题插槽，和数据源管理保持同一标题样式。 -->
        <template slot="title">
          <div class="collapse-title-wrap">
            <span class="section-title">快捷键操作</span>
          </div>
        </template>

        <!-- 快捷键面板说明。 -->
        <p class="panel-intro">控制首页轮播与播放页的键盘操作行为，并保存为默认偏好。</p>

        <!-- 快捷键设置卡片，结构和原设置页保持一致。 -->
        <section class="shortcut-section theme-surface">
          <div class="shortcut-grid">
            <!-- 总开关配置项。 -->
            <div class="shortcut-item">
              <div class="shortcut-meta">
                <div class="shortcut-name">启用快捷键</div>
                <div class="shortcut-desc">关闭后，首页轮播和播放页的键盘快捷操作都会停用。</div>
              </div>
              <el-switch
                :value="shortcuts.enabled"
                @change="updateShortcut('enabled', $event)"
              />
            </div>

            <!-- 首页轮播快捷键开关。 -->
            <div class="shortcut-item">
              <div class="shortcut-meta">
                <div class="shortcut-name">首页轮播键盘控制</div>
                <div class="shortcut-desc">首页支持 Left / Up 上一张，Right / Down 下一张。</div>
              </div>
              <el-switch
                :disabled="!shortcuts.enabled"
                :value="shortcuts.homeCarouselNavigation"
                @change="updateShortcut('homeCarouselNavigation', $event)"
              />
            </div>

            <!-- 播放页快捷键开关。 -->
            <div class="shortcut-item">
              <div class="shortcut-meta">
                <div class="shortcut-name">播放页键盘控制</div>
                <div class="shortcut-desc">播放页支持 Space / K 播放暂停，M 静音，F 全屏。</div>
              </div>
              <el-switch
                :disabled="!shortcuts.enabled"
                :value="shortcuts.playerKeyboardControl"
                @change="updateShortcut('playerKeyboardControl', $event)"
              />
            </div>

            <!-- 播放页快进快退步长。 -->
            <div class="shortcut-item shortcut-item-wide">
              <div class="shortcut-meta">
                <div class="shortcut-name">播放页快进快退步长</div>
                <div class="shortcut-desc">控制播放页左右方向键每次跳转的秒数。</div>
              </div>

              <div class="seek-setting">
                <el-input-number
                  :disabled="!shortcuts.enabled || !shortcuts.playerKeyboardControl"
                  :min="3"
                  :max="30"
                  :step="1"
                  size="small"
                  :value="shortcuts.playerSeekSeconds"
                  @change="updateShortcut('playerSeekSeconds', $event || 5)"
                />
                <span class="seek-unit">秒</span>
              </div>
            </div>
          </div>

          <!-- 当前快捷键速查区。 -->
          <div class="shortcut-tips">
            <div class="tip-title">当前快捷键</div>
            <div class="tip-list">
              <span
                v-for="tip in shortcutTips"
                :key="tip"
                class="tip-chip"
              >
                {{ tip }}
              </span>
            </div>
          </div>

          <!-- 快捷键面板底部操作。 -->
          <div class="section-actions">
            <el-button size="small" @click="resetShortcuts">恢复默认快捷键</el-button>
          </div>
        </section>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script>
// 设置页本地数据，提供数据源列表和快捷键默认配置。
import { settingsPageData } from '../data/page-settings.mock';

export default {
  // 组件名称用于在 Vue 调试工具中识别当前页面。
  name: 'SettingsView',

  /**
   * 设置页本地状态。
   *
   * @returns {Object} 设置页折叠面板、数据源和快捷键配置状态。
   */
  data() {
    return {
      // activePanels 控制 Element Collapse 默认展开哪些面板。
      // `sources` 是数据源管理，`shortcuts` 是快捷键操作。
      activePanels: ['sources', 'shortcuts'],

      // checkingAllSources 控制顶部“检测全部数据源”按钮的 loading 状态。
      checkingAllSources: false,

      // sources 驱动数据源管理表格；数组为空时显示数据源空状态。
      sources: this.asList(settingsPageData.sources),

      // shortcuts 驱动快捷键操作面板中的开关和数字输入框。
      shortcuts: this.asObjectOrFallback(settingsPageData.shortcuts, this.getDefaultShortcuts())
    };
  },

  computed: {
    /**
     * 是否存在数据源。
     *
     * @returns {boolean} 数据源列表非空时返回 true。
     */
    hasSources() {
      return this.sources.length > 0;
    },

    /**
     * 系统源数量。
     *
     * @returns {number} 当前内置系统源数量。
     */
    systemSourceCount() {
      return this.sources.length;
    },

    /**
     * 已启用数据源数量。
     *
     * @returns {number} enabled 为 true 的数据源数量。
     */
    enabledSourceCount() {
      return this.sources.filter(source => source.enabled).length;
    },

    /**
     * 搜索缓存数量。
     *
     * @returns {number} 当前静态页用于展示的搜索缓存数量。
     */
    searchCacheCount() {
      // 当前版本使用本地数据模拟缓存数量，后续接入真实源管理后再读取缓存仓库。
      return settingsPageData.cacheSummary.search || 0;
    },

    /**
     * 页面缓存数量。
     *
     * @returns {number} 当前静态页用于展示的页面缓存数量。
     */
    pageCacheCount() {
      // 当前版本使用本地数据模拟缓存数量，后续接入真实源管理后再读取缓存仓库。
      return settingsPageData.cacheSummary.page || 0;
    },

    /**
     * 快捷键速查标签。
     *
     * @returns {Array<string>} 页面底部快捷键说明标签列表。
     */
    shortcutTips() {
      return [
        '首页: Left / Up',
        '首页: Right / Down',
        '播放: Space / K',
        '播放: M',
        '播放: F',
        '播放: Left / Right'
      ];
    }
  },

  methods: {
    /**
     * 把数据整理成数组。
     *
     * @param {*} value 可能来自设置页数据文件的任意值。
     * @returns {Array} 数组原样返回，其他值返回空数组。
     */
    asList(value) {
      // 表格和 v-for 只能安全处理数组；异常值统一兜底为空列表。
      return Array.isArray(value) ? value : [];
    },

    /**
     * 把数据整理成普通对象，失败时返回兜底对象。
     *
     * @param {*} value 可能来自设置页数据文件的任意值。
     * @param {Object} fallback 默认对象。
     * @returns {Object} 可安全读取的普通对象。
     */
    asObjectOrFallback(value, fallback) {
      // null、基础类型和数组都不能作为设置对象读取。
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...fallback };
      }

      // 用 fallback 补齐缺失字段，避免 template 读取 undefined。
      return {
        ...fallback,
        ...value
      };
    },

    /**
     * 获取快捷键默认配置。
     *
     * @returns {Object} 默认快捷键配置对象。
     */
    getDefaultShortcuts() {
      return {
        // 总快捷键开关。
        enabled: true,
        // 首页轮播左右切换快捷键。
        homeCarouselNavigation: true,
        // 播放页键盘控制。
        playerKeyboardControl: true,
        // 播放页左右方向键跳转秒数。
        playerSeekSeconds: 5
      };
    },

    /**
     * 修改单个快捷键字段。
     *
     * @param {string} key 要修改的快捷键字段名。
     * @param {*} value 新字段值。
     * @returns {void}
     */
    updateShortcut(key, value) {
      // 使用新对象替换，保证 Vue 2 能稳定触发响应式更新。
      this.shortcuts = {
        ...this.shortcuts,
        [key]: value
      };
    },

    /**
     * 恢复默认快捷键配置。
     *
     * @returns {void}
     */
    resetShortcuts() {
      // 直接回到本页定义的默认值。
      this.shortcuts = this.getDefaultShortcuts();

      // 给用户一个明确反馈。
      this.$message.success('已恢复默认快捷键设置');
    },

    /**
     * 模拟检测全部数据源。
     *
     * @returns {void}
     */
    checkAllSources() {
      // 当前版本只做静态页面，按钮点击后短暂显示 loading。
      this.checkingAllSources = true;

      // 用短延时模拟检测过程，避免按钮点击后没有任何反馈。
      window.setTimeout(() => {
        this.checkingAllSources = false;
        this.$message.success('全部数据源检测完成');
      }, 450);
    },

    /**
     * 重置源站会话状态。
     *
     * @returns {void}
     */
    resetProxySession() {
      // 当前版本只保留页面操作反馈，后续接入真实状态管理时再清理具体存储。
      this.$message.success('已重置源站会话');
    },

    /**
     * 清空全部缓存。
     *
     * @returns {void}
     */
    clearAllCache() {
      // 当前版本只保留操作反馈，后续接入真实缓存模块后再清理搜索和页面缓存。
      this.$message.success('已清空全部缓存');
    },

    /**
     * 把页面能力开关表转换成标签数组。
     *
     * @param {Object} capabilities 数据源页面能力开关表。
     * @returns {Array<Object>} 页面能力标签列表。
     */
    getCapabilityItems(capabilities) {
      // 固定能力展示顺序，避免不同数据源能力标签顺序跳动。
      const capabilityLabels = [
        { name: 'home', label: '首页' },
        { name: 'movie', label: '电影' },
        { name: 'tv', label: '电视剧' },
        { name: 'search', label: '搜索' },
        { name: 'detail', label: '详情' },
        { name: 'play', label: '播放' }
      ];

      // 没有能力对象时按全部不支持处理。
      const safeCapabilities = this.asObjectOrFallback(capabilities, {});

      // 转换成 template 可以直接 v-for 渲染的数组。
      return capabilityLabels.map((item) => ({
        // name 用于 key 和读取原能力字段。
        name: item.name,
        // label 是页面展示文本。
        label: item.label,
        // enabled 决定标签是否高亮。
        enabled: Boolean(safeCapabilities[item.name])
      }));
    },

    /**
     * 获取设置页源卡片需要展示的页面能力。
     *
     * @param {Object} capabilities 数据源页面能力开关表。
     * @returns {Array<Object>} 只包含搜索、首页、电影和电视剧的能力标签。
     */
    getVisibleCapabilityItems(capabilities) {
      // 图中源卡片只展示四个主要入口：搜索、首页、电影、电视剧。
      return this.getCapabilityItems(capabilities)
        .filter(item => ['search', 'home', 'movie', 'tv'].includes(item.name));
    }
  }
};
</script>

<style scoped>
/*
  设置页最外层容器。
  对应 template 根节点 `.theme-page.settings-container`。
  作用是给设置页顶部留出一点空间。
*/
.settings-container {
  /* 设置页主体宽度靠近原页面，让数据源卡片有足够横向空间。 */
  max-width: 1720px;

  /* 宽屏下保持居中，避免内容贴住浏览器两侧。 */
  margin: 0 auto;

  /* 顶部留白对应导航栏下方的页面间距。 */
  padding: 22px 28px 48px;
}

/*
  Element Collapse 外层默认边框。
  对应 template 中 `.settings-collapse` 内部的 Element UI 折叠面板。
*/
.settings-collapse :deep(.el-collapse) {
  /* 去掉默认边框，让折叠面板融入项目自己的主题线条。 */
  border: none;
}

/*
  设置页折叠面板整体。
  对应 template 中 `.settings-collapse`。
  作用是形成原设置页那种大面积白色管理面板。
*/
.settings-collapse {
  /* 白色背景对应原设置页的数据源管理大面板。 */
  background: #ffffff;

  /* 浅边框让面板从浅灰页面背景中分出来。 */
  border: 1px solid rgba(226, 232, 240, 0.9);

  /* 不使用明显圆角，贴近原页面的大面板外观。 */
  border-radius: 0;

  /* 大面板底部阴影保持非常轻，避免变成浮夸卡片。 */
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.05);
}

/*
  折叠面板内容包裹层。
  对应 Element UI 生成的 `.el-collapse-item__wrap`。
*/
.settings-collapse :deep(.el-collapse-item__wrap) {
  /* 不使用 Element UI 默认分隔线，避免和标题行边框重复。 */
  border-bottom: none;

  /* 保持透明背景，让父级页面背景露出来。 */
  background: transparent;
}

/*
  折叠面板标题行。
  对应数据源管理和快捷键操作两个 `{el-collapse-item}` 的头部。
*/
.settings-collapse :deep(.el-collapse-item__header) {
  /* 让标题文字和右侧箭头在同一行。 */
  display: flex;

  /* 标题行内容垂直居中。 */
  align-items: center;

  /* 给标题行设置更高的点击和阅读区域，贴近原面板头部高度。 */
  min-height: 92px;

  /* 允许标题行根据内容自动增高。 */
  height: auto;

  /* 标题行多行时使用正常行高。 */
  line-height: 1.4;

  /* 左右内边距让标题和下方内容起点对齐。 */
  padding: 18px 26px;

  /* 用主题边框色形成两个设置区之间的分隔。 */
  border-bottom: 1px solid var(--border-color);

  /* 透明背景避免覆盖页面整体背景。 */
  background: transparent;
}

/*
  折叠面板标题和箭头的鼠标行为。
  对应 Element UI 标题区域及其内部文字、箭头。
*/
.settings-collapse :deep(.el-collapse-item__header),
.settings-collapse :deep(.el-collapse-item__header *),
.settings-collapse :deep(.el-collapse-item__arrow) {
  /* 鼠标变成手型，提示用户标题整行可点击展开或收起。 */
  cursor: pointer !important;

  /* 避免用户快速点击折叠标题时误选中文字。 */
  user-select: none;
}

/*
  折叠面板内容区。
  对应 Element UI 生成的 `.el-collapse-item__content`。
*/
.settings-collapse :deep(.el-collapse-item__content) {
  /* 内容区不再额外撑开顶部，交给工具条和列表自己控制。 */
  padding: 0 0 6px;
}

/*
  设置页内所有 Element UI 按钮。
  包括顶部按钮、表格按钮和恢复默认按钮。
*/
.settings-container :deep(.el-button) {
  /* 圆角按钮和原设置页控件风格保持一致。 */
  border-radius: 12px !important;
}

/*
  Element Switch 开关轨道。
  对应数据源表格和快捷键区域内的开关。
*/
.settings-container :deep(.el-switch__core) {
  /* 轨道使用胶囊圆角，符合开关控件的常见视觉。 */
  border-radius: 999px !important;
}

/*
  Element Switch 开关圆点。
  对应开关轨道里的滑块。
*/
.settings-container :deep(.el-switch__button) {
  /* 滑块保持正圆。 */
  border-radius: 50% !important;
}

/*
  Element 输入框内部。
  当前主要影响“播放页快进快退步长”的数字输入框。
*/
.settings-container :deep(.el-input__inner) {
  /* 输入框圆角和按钮圆角统一。 */
  border-radius: 10px !important;
}

/*
  Element 数字输入框整体。
  对应 template 中的 `{el-input-number}`。
*/
.settings-container :deep(.el-input-number) {
  /* 外层圆角让数字输入框像一个完整控件。 */
  border-radius: 12px;

  /* 裁掉内部加减按钮溢出的直角。 */
  overflow: hidden;
}

/*
  折叠面板标题内容包裹层。
  对应 template 中两个 `slot="title"` 里的 `.collapse-title-wrap`。
*/
.collapse-title-wrap {
  /* 标题文字和左侧竖线保持一行。 */
  display: flex;

  /* 标题在折叠标题行内垂直居中。 */
  align-items: center;

  /* 允许标题在小屏下收缩。 */
  min-width: 0;

  /* 给标题内容左右一点空间，避免贴着折叠面板边界。 */
  padding: 0 4px;
}

/*
  面板说明文字。
  对应两个折叠面板标题下面的 `.panel-intro`。
*/
.panel-intro {
  /* 上边不需要额外距离，底部和真实内容之间留 12px。 */
  margin: 0;

  /* 左右内边距和折叠标题保持一致。 */
  padding: 0 26px 18px;

  /* 说明文字比正文略小，降低视觉权重。 */
  font-size: 13px;

  /* 行高放宽，避免说明文案显得拥挤。 */
  line-height: 1.7;

  /* 使用弱化文字色，表示它是辅助说明。 */
  color: var(--text-muted);
}

/*
  分区标题样式。
  `.section-title` 用在折叠面板标题。
*/
.section-title {
  /* inline-flex 方便标题文字和左侧竖线一起排版。 */
  display: inline-flex;

  /* 标题文字和左侧竖线垂直居中。 */
  align-items: center;

  /* 最小高度保证标题点击和阅读区域不太窄。 */
  min-height: 22px;

  /* 左侧留出距离，避免文字贴着蓝色竖线。 */
  padding-left: 14px;

  /* 蓝色竖线是设置区标题的视觉标识。 */
  border-left: 4px solid var(--accent);

  /* 主分区标题字号。 */
  font-size: 18px;

  /* 加粗提升标题层级。 */
  font-weight: 700;

  /* 使用主文字色，保证标题清晰。 */
  color: var(--text-primary);

  /* 防止标题在折叠头里拆成两行。 */
  white-space: nowrap;
}

/*
  统一源管理面板外层。
  对应 template 中 `.unified-source-manager`。
  作用是把数据源工具条和数据源列表包成一个完整管理区。
*/
.unified-source-manager {
  /* 和上方说明文字拉开距离。 */
  margin-top: 18px;

  /* 给工具条和源列表留出内边距，避免内容贴边。 */
  padding: 20px 22px 22px;

  /* 让 padding 算进宽度，避免管理区在父容器里横向溢出。 */
  box-sizing: border-box;
}

/*
  数据源顶部工具栏。
  对应 template 中 `.manager-toolbar`。
  作用是把左侧分类、中间统计、右侧操作分成三列。
*/
.manager-toolbar {
  /* 使用 grid 固定左中右三块，比普通文档流更接近原设置页。 */
  display: grid;

  /* 左右列占剩余空间，中间统计按内容宽度居中。 */
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);

  /* 三块内容垂直居中。 */
  align-items: center;

  /* 三块之间留出横向距离。 */
  gap: 18px;

  /* 工具栏和下方源列表之间留出距离。 */
  margin-bottom: 18px;
}

/*
  工具栏通用块。
  对应 `.manager-toolbar-left`、`.manager-toolbar-center`、`.manager-toolbar-right`。
*/
.manager-toolbar-block {
  /* 允许 grid 子项收缩，避免按钮或文字把页面撑出横向滚动。 */
  min-width: 0;
}

/*
  工具栏左侧分类区。
  对应 template 中 `.manager-toolbar-left`。
*/
.manager-toolbar-left {
  /* 分类 tabs 靠左显示。 */
  justify-self: start;
}

/*
  工具栏中间统计区。
  对应 template 中 `.manager-toolbar-center`。
*/
.manager-toolbar-center {
  /* 统计胶囊保持在工具栏中间。 */
  justify-self: center;
}

/*
  工具栏右侧操作区。
  对应 template 中 `.manager-toolbar-right`。
*/
.manager-toolbar-right {
  /* 操作按钮组靠右显示。 */
  justify-self: end;
}

/*
  数据源分类 tabs。
  对应 template 中 `.manager-kind-tabs`。
*/
.manager-kind-tabs {
  /* 给“系统源 / 自定义源”保留足够宽度，避免两项挤在一起。 */
  min-width: 280px;
}

/*
  Element tabs 头部。
  对应 `.manager-kind-tabs` 内部生成的 `.el-tabs__header`。
*/
:deep(.manager-kind-tabs .el-tabs__header) {
  /* 去掉 Element UI 默认下外边距，让 tabs 和工具栏同高。 */
  margin: 0;
}

/*
  Element tabs 内容区。
  当前 tabs 只作为分类切换按钮使用，不需要渲染内容区域。
*/
:deep(.manager-kind-tabs .el-tabs__content) {
  /* 隐藏内容区，避免空内容撑高工具栏。 */
  display: none;
}

/*
  Element tabs 底部分隔线。
  对应 `.manager-kind-tabs .el-tabs__nav-wrap::after`。
*/
:deep(.manager-kind-tabs .el-tabs__nav-wrap::after) {
  /* 保留 tabs 下方细线，形成原设置页的切换条视觉。 */
  display: block !important;

  /* 使用全局边框色。 */
  background-color: var(--border-color) !important;
}

/*
  Element tabs 激活条。
  对应 `.manager-kind-tabs .el-tabs__active-bar`。
*/
:deep(.manager-kind-tabs .el-tabs__active-bar) {
  /* 强制显示激活条，标识当前分类。 */
  display: block !important;

  /* 激活条使用主题蓝色。 */
  background-color: var(--accent) !important;
}

/*
  Element tabs 单项。
  对应 `.manager-kind-tabs .el-tabs__item`。
*/
:deep(.manager-kind-tabs .el-tabs__item) {
  /* 固定高度让 tabs 和右侧按钮更齐。 */
  height: 40px !important;

  /* 行高等于高度，让文字垂直居中。 */
  line-height: 40px !important;

  /* 左右内边距控制可点击区域。 */
  padding: 0 20px !important;

  /* 清掉默认边框。 */
  border: none !important;

  /* 清掉默认背景。 */
  background: transparent !important;

  /* 未激活状态使用弱化文字色。 */
  color: var(--text-muted) !important;
}

/*
  tabs hover 和激活状态。
  触发条件：鼠标悬停或当前 tab 被选中。
*/
:deep(.manager-kind-tabs .el-tabs__item:hover),
:deep(.manager-kind-tabs .el-tabs__item.is-active) {
  /* hover 和当前项都使用主题色。 */
  color: var(--accent) !important;
}

/*
  tab 自定义 label。
  对应 template 中 `.manager-kind-label`。
*/
.manager-kind-label {
  /* 让文字、数量徽标和状态点横向排列。 */
  display: inline-flex;

  /* 三个元素垂直居中。 */
  align-items: center;

  /* 元素之间留出距离。 */
  gap: 6px;
}

/*
  分类数量徽标。
  对应 template 中 `.kind-tab-badge`。
*/
.kind-tab-badge {
  /* 数字居中显示。 */
  display: inline-flex;

  /* 垂直居中。 */
  align-items: center;

  /* 水平居中。 */
  justify-content: center;

  /* 一位数也保持小圆底。 */
  min-width: 18px;

  /* 固定高度和 tab 文字对齐。 */
  height: 18px;

  /* 兼容两位数。 */
  padding: 0 5px;

  /* 圆形或胶囊形状。 */
  border-radius: 999px;

  /* 小字号适合徽标。 */
  font-size: 11px;

  /* 数字加粗。 */
  font-weight: 600;

  /* 弱化文字色。 */
  color: var(--text-muted);

  /* 浅灰背景把数量和 tab 文字区分开。 */
  background: #f1f4f9;
}

/*
  分类启用状态点。
  对应 template 中 `.kind-tab-dot`。
*/
.kind-tab-dot {
  /* 固定宽度形成圆点。 */
  width: 8px;

  /* 固定高度形成圆点。 */
  height: 8px;

  /* 圆形状态点。 */
  border-radius: 50%;

  /* 绿色表示当前分类下存在启用源。 */
  background: var(--success);
}

/*
  顶部统计胶囊区。
  对应 template 中 `.manager-summary`。
*/
.manager-summary {
  /* 三个统计胶囊横向排列。 */
  display: flex;

  /* 垂直居中。 */
  align-items: center;

  /* 胶囊之间留出距离。 */
  gap: 10px;

  /* 桌面端保持一行，窄屏再换行。 */
  flex-wrap: nowrap;
}

/*
  单个统计胶囊。
  对应 template 中 `.summary-chip`。
*/
.summary-chip {
  /* 标签和值横向排列。 */
  display: inline-flex;

  /* 垂直居中。 */
  align-items: center;

  /* 标签和值之间留出距离。 */
  gap: 8px;

  /* 保证胶囊高度稳定。 */
  min-height: 34px;

  /* 胶囊左右留白。 */
  padding: 0 12px;

  /* 浅边框形成胶囊边界。 */
  border: 1px solid var(--border-color);

  /* 胶囊圆角。 */
  border-radius: 999px;

  /* 半透明白底贴近原页面。 */
  background: rgba(255, 255, 255, .72);
}

/*
  统计标签文字。
  对应 template 中 `.summary-label`。
*/
.summary-label {
  /* 标签字号略小，表示说明性文字。 */
  font-size: 12px;

  /* 使用弱化文字色。 */
  color: var(--text-muted);
}

/*
  统计数值文字。
  对应 template 中 `.summary-value`。
*/
.summary-value {
  /* 数值字号略大于标签。 */
  font-size: 13px;

  /* 加粗强调数量。 */
  font-weight: 600;

  /* 使用主文字色。 */
  color: var(--text-primary);
}

/*
  工具栏右侧操作按钮组。
  对应 template 中 `.manager-actions`。
*/
.manager-actions {
  /* 按钮横向排列。 */
  display: flex;

  /* 垂直居中。 */
  align-items: center;

  /* 按钮靠右。 */
  justify-content: flex-end;

  /* 按钮之间留出距离。 */
  gap: 10px;

  /* 桌面端不换行，保持原页面工具条紧凑感。 */
  flex-wrap: nowrap;
}

/*
  数据源列表。
  对应 template 中 `.source-list`。
*/
.source-list {
  /* 覆盖前面旧卡片列表的内边距，当前由 `.unified-source-manager` 统一控制。 */
  padding: 0;

  /* 用 grid 纵向管理数据源行。 */
  display: grid;

  /* 每行之间留出距离。 */
  gap: 12px;
}

/*
  单条数据源行。
  对应 template 中 `.source-row`。
*/
.source-row {
  /* 三列布局：基础信息、版本号、操作区。 */
  display: grid;

  /* 第一列自适应，版本列固定，操作列固定，贴近原设置页。 */
  grid-template-columns: minmax(0, 1fr) 78px 360px;

  /* 三列内容垂直居中。 */
  align-items: center;

  /* 列之间留出距离。 */
  gap: 16px;

  /* 行内边距让内容不贴边。 */
  padding: 14px 16px;

  /* 浅边框区分每条源。 */
  border: 1px solid var(--border-color);

  /* 圆角贴近原页面数据源行。 */
  border-radius: 16px;

  /* 浅灰底让行从白色面板中分出来。 */
  background: rgba(248, 250, 252, .72);

  /* hover 时的过渡效果。 */
  transition: background .15s, border-color .15s, transform .15s, opacity .15s;
}

/*
  数据源行 hover 状态。
  触发条件：鼠标移入 `.source-row`。
*/
.source-row:hover {
  /* hover 时背景更白，提示这一行可操作。 */
  background: rgba(255, 255, 255, .92);

  /* 边框轻微带主题色。 */
  border-color: rgba(91, 140, 255, .18);

  /* 微微上移，形成轻量反馈。 */
  transform: translateY(-1px);
}

/*
  禁用数据源行。
  对应 template 中 `.source-row--disabled`。
*/
.source-row--disabled {
  /* 禁用源整体略淡，但仍然保留可读性。 */
  opacity: .92;
}

/*
  数据源主信息列。
  对应 template 中 `.source-main`。
*/
.source-main {
  /* 允许长描述在第一列内换行，不撑破网格。 */
  min-width: 0;
}

/*
  数据源名称行。
  对应 template 中 `.source-name-row`。
*/
.source-name-row {
  /* 名称和系统标签横向排列。 */
  display: flex;

  /* 垂直居中。 */
  align-items: center;

  /* 名称和标签之间留出距离。 */
  gap: 8px;

  /* 名称过长时允许换行。 */
  flex-wrap: wrap;

  /* 和描述之间留出距离。 */
  margin-bottom: 4px;
}

/*
  数据源名称。
  对应 template 中 `.source-name`。
*/
.source-name {
  /* 名称字号略大于描述。 */
  font-size: 14px;

  /* 名称加粗作为主信息。 */
  font-weight: 600;

  /* 使用主文字色。 */
  color: var(--text-primary);
}

/*
  数据源类型标签。
  对应 template 中 `.source-type`。
*/
.source-type {
  /* 标签文字垂直居中。 */
  display: inline-flex;

  /* 垂直居中。 */
  align-items: center;

  /* 最小高度让小标签稳定。 */
  min-height: 22px;

  /* 左右内边距形成胶囊。 */
  padding: 0 8px;

  /* 胶囊圆角。 */
  border-radius: 999px;

  /* 标签字号。 */
  font-size: 11px;

  /* 加粗让系统标识清楚。 */
  font-weight: 600;
}

/*
  系统源标签。
  对应 template 中 `.source-type.public`。
*/
.source-type.public {
  /* 蓝色淡底表示系统内置。 */
  background: rgba(91, 140, 255, .1);

  /* 蓝色文字呼应主题色。 */
  color: var(--accent);
}

/*
  数据源描述。
  对应 template 中 `.source-desc`。
*/
.source-desc {
  /* 描述字号低于名称。 */
  font-size: 12px;

  /* 长说明换行时更好读。 */
  line-height: 1.6;

  /* 使用弱化文字色。 */
  color: var(--text-muted);
}

/*
  能力标签列表。
  对应 template 中 `.capability-list`。
*/
.capability-list {
  /* 能力标签横向排列。 */
  display: flex;

  /* 垂直居中。 */
  align-items: center;

  /* 标签较多时允许换行。 */
  flex-wrap: wrap;

  /* 标签之间留出距离。 */
  gap: 8px;

  /* 和描述之间留出距离。 */
  margin-top: 10px;
}

/*
  单个能力标签。
  对应 template 中 `.capability-chip`。
*/
.capability-chip {
  /* 能力名称和状态点横向排列。 */
  display: inline-flex;

  /* 垂直居中。 */
  align-items: center;

  /* 名称和圆点之间留出距离。 */
  gap: 8px;

  /* 最小高度保证标签可读。 */
  min-height: 24px;

  /* 左右内边距形成胶囊。 */
  padding: 0 10px;

  /* 胶囊圆角。 */
  border-radius: 999px;

  /* 标签字号。 */
  font-size: 12px;

  /* 默认透明边框，由状态类决定颜色。 */
  border: 1px solid transparent;
}

/*
  已启用能力标签。
  对应 template 中 `.capability-chip.enabled`。
*/
.capability-chip.enabled {
  /* 绿色淡底表示能力可用。 */
  background: rgba(52, 186, 132, .12);

  /* 绿色边框和背景统一。 */
  border-color: rgba(52, 186, 132, .12);

  /* 深绿色文字保证可读。 */
  color: #14915f;
}

/*
  未接入能力标签。
  对应 template 中 `.capability-chip.missing`。
*/
.capability-chip.missing {
  /* 灰色淡底表示不可用或未接入。 */
  background: rgba(148, 163, 184, .14);

  /* 灰色边框降低视觉权重。 */
  border-color: rgba(148, 163, 184, .14);

  /* 弱化文字色。 */
  color: var(--text-muted);
}

/*
  能力名称文本。
  对应 template 中 `.capability-name`。
*/
.capability-name {
  /* 稍微加粗，让短标签更清楚。 */
  font-weight: 500;
}

/*
  能力状态圆点。
  对应 template 中 `.capability-dot`。
*/
.capability-dot {
  /* 圆点宽度。 */
  width: 8px;

  /* 圆点高度。 */
  height: 8px;

  /* 圆形。 */
  border-radius: 50%;

  /* 跟随当前能力标签文字色。 */
  background: currentColor;
}

/*
  版本号列。
  对应 template 中 `.source-version`。
*/
.source-version {
  /* 版本号在固定列中居中显示。 */
  text-align: center;

  /* 版本字号比名称小。 */
  font-size: 12px;

  /* 版本是辅助信息，使用弱化文字色。 */
  color: var(--text-muted);
}

/*
  数据源行操作区。
  对应 template 中 `.source-actions`。
*/
.source-actions {
  /* 按钮和开关横向排列。 */
  display: flex;

  /* 操作项垂直居中。 */
  align-items: center;

  /* 操作项靠右排列。 */
  justify-content: flex-end;

  /* 窄屏或按钮较多时允许换行。 */
  flex-wrap: wrap;

  /* 操作项之间留出距离。 */
  gap: 10px;
}

/*
  快捷键设置面板主体卡片。
  对应 template 中 `.shortcut-section.theme-surface`。
*/
.shortcut-section {
  /* 和上方说明文字拉开距离。 */
  margin-top: 18px;

  /* 不额外左缩进，保证快捷键内容区和设置面板内容左侧对齐。 */
  margin-left: 0;

  /* 卡片内部留白，保证开关项不贴边。 */
  padding: 20px 22px;

  /* 占满当前折叠面板内容宽度，不再人为扣除左侧空间。 */
  width: 100%;

  /* 把 padding 算进宽度，避免右侧开关和按钮横向溢出。 */
  box-sizing: border-box;

  /* 防止内部控件把整块区域横向撑出去。 */
  overflow: hidden;
}

/*
  区域底部操作栏。
  对应快捷键面板底部 `.section-actions`。
*/
.section-actions {
  /* 使用 flex 是为了后续可以继续添加多个按钮。 */
  display: flex;

  /* 当前按钮靠右，符合设置页底部操作习惯。 */
  justify-content: flex-end;

  /* 和上方快捷键速查区拉开距离。 */
  margin-top: 14px;
}

/*
  快捷键配置网格。
  对应 template 中 `.shortcut-grid`。
*/
.shortcut-grid {
  /* 用 grid 让桌面端开关项自动排成两列。 */
  display: grid;

  /* 两列等宽；minmax 避免内容过长时把列撑爆。 */
  grid-template-columns: repeat(2, minmax(0, 1fr));

  /* 控制快捷键项之间的横向和纵向间距。 */
  gap: 14px;
}

/*
  单个快捷键配置项。
  对应 template 中每一个 `.shortcut-item`。
*/
.shortcut-item {
  /* 横向排列文字和控件。 */
  display: flex;

  /* 让开关和文字在同一条中线上。 */
  align-items: center;

  /* 左侧文案靠左，右侧控件靠右。 */
  justify-content: space-between;

  /* 文案区和控件之间保持距离。 */
  gap: 18px;

  /* 给每个快捷键项内部留白，形成卡片感。 */
  padding: 16px 18px;

  /* 边框让每个配置项边界清楚。 */
  border: 1px solid var(--border-color);

  /* 圆角和设置页面控件风格保持一致。 */
  border-radius: 16px;

  /* 淡灰背景让配置项从白色面板中分出来。 */
  background: rgba(248, 250, 252, 0.72);
}

/*
  跨整行的快捷键配置项。
  对应“播放页快进快退步长”这一项。
*/
.shortcut-item-wide {
  /* 从第一列跨到最后一列，让数字输入框有足够宽度。 */
  grid-column: 1 / -1;
}

/*
  快捷键配置项左侧文案区。
  对应 `.shortcut-meta`。
*/
.shortcut-meta {
  /* 允许文案区域在小屏或长文本时收缩。 */
  min-width: 0;
}

/*
  快捷键名称。
  对应 `.shortcut-name`。
*/
.shortcut-name {
  /* 名称使用正文偏大的字号。 */
  font-size: 15px;

  /* 加粗表示配置项主标题。 */
  font-weight: 600;

  /* 使用主文字色。 */
  color: var(--text-primary);

  /* 和下方说明拉开一点距离。 */
  margin-bottom: 4px;
}

/*
  快捷键说明文字。
  对应 `.shortcut-desc`。
*/
.shortcut-desc {
  /* 说明文字比名称小，降低视觉权重。 */
  font-size: 12px;

  /* 放宽行高，长说明换行后仍然容易读。 */
  line-height: 1.6;

  /* 使用弱化文字色。 */
  color: var(--text-muted);
}

/*
  快进快退步长输入区。
  对应 template 中 `.seek-setting`。
*/
.seek-setting {
  /* 数字输入框和单位横向排列。 */
  display: flex;

  /* 单位文字和输入框垂直居中。 */
  align-items: center;

  /* 输入框和“秒”之间留出距离。 */
  gap: 10px;

  /* 防止右侧输入区被左侧长说明压缩到不可用。 */
  flex-shrink: 0;
}

/*
  秒数单位文字。
  对应 template 中 `.seek-unit`。
*/
.seek-unit {
  /* 单位文字用较小字号。 */
  font-size: 12px;

  /* 使用弱化文字色。 */
  color: var(--text-muted);
}

/*
  快捷键速查区。
  对应 template 中 `.shortcut-tips`。
*/
.shortcut-tips {
  /* 和上方设置网格拉开距离。 */
  margin-top: 16px;

  /* 顶部内边距让分隔线和标签内容之间有空间。 */
  padding-top: 16px;

  /* 分隔线表示下面是说明区，不是可编辑配置项。 */
  border-top: 1px solid var(--border-color);
}

/*
  快捷键速查标题。
  对应 `.tip-title`。
*/
.tip-title {
  /* 标题略小，符合辅助区层级。 */
  font-size: 13px;

  /* 加粗让它和下面标签区分开。 */
  font-weight: 600;

  /* 使用次级文字色。 */
  color: var(--text-secondary);

  /* 和下面标签列表拉开距离。 */
  margin-bottom: 10px;
}

/*
  快捷键标签列表。
  对应 `.tip-list`。
*/
.tip-list {
  /* 横向排列标签。 */
  display: flex;

  /* 标签多时允许换行。 */
  flex-wrap: wrap;

  /* 控制标签之间的间距。 */
  gap: 8px;
}

/*
  单个快捷键提示标签。
  对应 `.tip-chip`。
*/
.tip-chip {
  /* inline-flex 方便标签文字垂直居中。 */
  display: inline-flex;

  /* 标签文字垂直居中。 */
  align-items: center;

  /* 固定高度让所有提示标签大小统一。 */
  height: 28px;

  /* 左右留白让短文本标签不拥挤。 */
  padding: 0 10px;

  /* 边框让标签在浅色背景上有边界。 */
  border: 1px solid var(--border-color);

  /* 胶囊圆角符合快捷键标签的视觉习惯。 */
  border-radius: 999px;

  /* 半透明白底让标签比背景略突出。 */
  background: rgba(255, 255, 255, 0.72);

  /* 标签文字比正文小一号。 */
  font-size: 12px;

  /* 使用次级文字色。 */
  color: var(--text-secondary);
}

/*
  平板和手机上的快捷键布局。
  触发条件：屏幕宽度不超过 768px。
*/
@media (max-width: 768px) {
  .manager-toolbar {
    /* 平板下工具栏从左中右三列改成单列。 */
    grid-template-columns: 1fr;

    /* 单列时每个工具块都靠左显示。 */
    justify-items: stretch;
  }

  .manager-toolbar-left,
  .manager-toolbar-center,
  .manager-toolbar-right {
    /* 覆盖桌面端左中右定位，让三块都占满宽度。 */
    justify-self: stretch;
  }

  .manager-summary {
    /* 平板下统计胶囊允许换行。 */
    flex-wrap: wrap;

    /* 单列工具栏里统计靠左排列。 */
    justify-content: flex-start;
  }

  .manager-actions {
    /* 平板下操作按钮靠左排列。 */
    justify-content: flex-start;

    /* 按钮放不下时换行。 */
    flex-wrap: wrap;
  }

  .manager-kind-tabs {
    /* 去掉桌面最小宽度，避免 tabs 在窄屏撑开页面。 */
    min-width: 0;
  }

  .source-row {
    /* 平板下数据源行从三列改成单列堆叠。 */
    grid-template-columns: minmax(0, 1fr);
  }

  .source-version {
    /* 单列时版本号跟随信息区靠左。 */
    justify-self: flex-start;

    /* 文字也靠左。 */
    text-align: left;
  }

  .source-actions {
    /* 单列时按钮从左侧开始排列。 */
    justify-content: flex-start;

    /* 操作区允许换行，避免按钮撑破源卡片。 */
    flex-wrap: wrap;
  }

  .shortcut-grid {
    /* 从桌面两列改成一列。 */
    grid-template-columns: 1fr;
  }

  .shortcut-item {
    /* 控件不再和文案中线对齐，而是按左侧开始位置排列。 */
    align-items: flex-start;

    /* 从横向排列改成纵向堆叠。 */
    flex-direction: column;
  }

  .seek-setting {
    /* 占满父容器宽度，方便输入框自然排版。 */
    width: 100%;

    /* 输入框靠左显示，和上方文案起点对齐。 */
    justify-content: flex-start;
  }

}

/*
  手机端面板内边距调整。
  触发条件：屏幕宽度不超过 640px。
*/
@media (max-width: 640px) {
  .shortcut-section {
    /* 手机上同样不额外左缩进。 */
    margin-left: 0;

    /* 宽度回到完整宽度。 */
    width: 100%;

    /* 收紧左右内边距，给文字和控件留更多可用宽度。 */
    padding: 16px 14px;
  }

  .panel-intro {
    /* 手机上说明文字也取消左侧缩进。 */
    padding-left: 0;
  }
}
</style>
