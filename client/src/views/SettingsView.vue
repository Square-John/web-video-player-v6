<template>
  <!--
    SettingsView 页面渲染树

    {div.settings-view}
    ├─ {section.settings-view__hero}
    │  ├─ {p.settings-view__eyebrow} 页面短标签
    │  ├─ {h1.settings-view__title} 页面标题
    │  └─ {p.settings-view__summary} 页面说明
    ├─ {section.settings-view__panel} 基础设置分区
    │  ├─ {header.settings-view__panel-header} 分区标题和说明
    │  ├─ [if hasAppSettings]
    │  │  └─ {div.settings-view__setting-list} 循环渲染基础设置项
    │  └─ [else]
    │     └─ {div.settings-view__empty} 基础设置空状态
    ├─ {section.settings-view__panel} 数据源列表分区
    │  ├─ {header.settings-view__panel-header} 分区标题和数量
    │  ├─ [if hasSources]
    │  │  └─ {article.settings-view__source-card} 循环渲染数据源卡片
    │  └─ [else]
    │     └─ {div.settings-view__empty} 数据源空状态
    └─ {section.settings-view__panel} 本地状态操作分区
       ├─ {header.settings-view__panel-header} 分区标题和说明
       ├─ [if hasLocalStateActions]
       │  └─ {button.settings-view__action-button} 循环渲染本地状态操作
       └─ [else]
          └─ {div.settings-view__empty} 本地操作空状态
  -->
  <!--
    设置页。
    作用：展示应用基础设置、数据源状态和本地状态操作入口。
  -->
  <div class="settings-view">
    <!-- 页面头部说明区，帮助用户识别当前页面用途。 -->
    <section class="settings-view__hero">
      <p class="settings-view__eyebrow">应用设置</p>
      <h1 class="settings-view__title">设置</h1>
      <p class="settings-view__summary">
        管理默认数据源、直连播放策略、源显示规则和本地状态操作。
      </p>
    </section>

    <!-- 基础设置分区，展示当前应用级设置。 -->
    <section class="settings-view__panel" aria-label="基础设置">
      <!-- 基础设置分区标题。 -->
      <header class="settings-view__panel-header">
        <div>
          <h2 class="settings-view__panel-title">基础设置</h2>
          <p class="settings-view__panel-desc">这些字段后续会影响数据源选择和播放策略。</p>
        </div>
      </header>

      <!-- 有 appSettings 数据时渲染设置项列表。 -->
      <div v-if="hasAppSettings" class="settings-view__setting-list">
        <!-- 默认源设置项，显示后续默认选择的数据源 id。 -->
        <div class="settings-view__setting-item">
          <span class="settings-view__setting-label">默认数据源</span>
          <strong class="settings-view__setting-value">{{ defaultSourceText }}</strong>
        </div>

        <!-- 直连播放策略设置项，决定后续播放页是否坚持直链播放。 -->
        <div class="settings-view__setting-item">
          <span class="settings-view__setting-label">仅直链播放</span>
          <strong class="settings-view__setting-value">{{ directPlayOnlyText }}</strong>
        </div>

        <!-- 不支持源显示设置项，决定后续源列表是否显示 unsupported 源。 -->
        <div class="settings-view__setting-item">
          <span class="settings-view__setting-label">显示不支持源</span>
          <strong class="settings-view__setting-value">{{ showUnsupportedText }}</strong>
        </div>

        <!-- 源检测模式设置项，决定后续健康检查由用户触发还是自动触发。 -->
        <div class="settings-view__setting-item">
          <span class="settings-view__setting-label">源检测模式</span>
          <strong class="settings-view__setting-value">{{ sourceCheckModeText }}</strong>
        </div>
      </div>

      <!-- appSettings 为 null 时，基础设置分区保留空状态。 -->
      <div v-else class="settings-view__empty">
        <h3 class="settings-view__empty-title">暂无基础设置</h3>
        <p class="settings-view__empty-text">当前没有可展示的应用设置。</p>
      </div>
    </section>

    <!-- 数据源列表分区，展示每个源是否启用、是否默认，以及支持哪些页面。 -->
    <section class="settings-view__panel" aria-label="数据源列表">
      <!-- 数据源分区标题，右侧显示当前数据源数量。 -->
      <header class="settings-view__panel-header">
        <div>
          <h2 class="settings-view__panel-title">数据源</h2>
          <p class="settings-view__panel-desc">数据源脚本后续负责返回各页面需要的字段。</p>
        </div>
        <span class="settings-view__panel-count">{{ sourceCountText }}</span>
      </header>

      <!-- 有数据源时渲染数据源卡片网格。 -->
      <div v-if="hasSources" class="settings-view__source-grid">
        <!-- 单个数据源卡片，展示源名称、检测状态、启用情况和页面支持情况。 -->
        <article
          v-for="source in sources"
          :key="source.id"
          class="settings-view__source-card"
        >
          <!-- 数据源卡片头部，展示源名称和状态标签。 -->
          <header class="settings-view__source-header">
            <div>
              <h3 class="settings-view__source-name">{{ source.name || '未命名数据源' }}</h3>
              <p class="settings-view__source-domain">{{ source.domain || '暂无域名' }}</p>
            </div>
            <span class="settings-view__source-status">{{ formatSourceStatus(source.status) }}</span>
          </header>

          <!-- 数据源状态说明。 -->
          <p class="settings-view__source-message">{{ source.message || '暂无状态说明。' }}</p>

          <!-- 数据源基础状态标签，展示启用和默认源信息。 -->
          <div class="settings-view__tag-row">
            <span class="settings-view__tag">{{ formatEnabledText(source.enabled) }}</span>
            <span class="settings-view__tag">{{ formatDefaultText(source.isDefault) }}</span>
          </div>

          <!-- 数据源页面支持列表，展示该源能给哪些页面提供数据。 -->
          <div class="settings-view__capability-list">
            <!-- 每个标签都来自 source.capabilities，例如 home: true 表示支持首页数据。 -->
            <span
              v-for="capability in getCapabilityItems(source.capabilities)"
              :key="`${source.id}-${capability.name}`"
              class="settings-view__capability"
              :class="{ 'settings-view__capability--active': capability.enabled }"
            >
              {{ capability.label }}
            </span>
          </div>

          <!-- 数据源操作按钮，当前先保留按钮形态。 -->
          <div class="settings-view__source-actions">
            <button type="button" class="settings-view__small-button">检测</button>
            <button type="button" class="settings-view__small-button">设为默认</button>
          </div>
        </article>
      </div>

      <!-- sources 为空时，数据源分区保留空状态。 -->
      <div v-else class="settings-view__empty">
        <h3 class="settings-view__empty-title">暂无数据源</h3>
        <p class="settings-view__empty-text">后续导入的数据源会显示在这里。</p>
      </div>
    </section>

    <!-- 本地状态操作分区，展示清理源状态、播放状态和设置状态的入口。 -->
    <section class="settings-view__panel" aria-label="本地状态操作">
      <!-- 本地状态操作分区标题。 -->
      <header class="settings-view__panel-header">
        <div>
          <h2 class="settings-view__panel-title">本地状态</h2>
          <p class="settings-view__panel-desc">这些操作只影响当前浏览器内保存的状态。</p>
        </div>
      </header>

      <!-- 有本地状态操作时渲染操作按钮。 -->
      <div v-if="hasLocalStateActions" class="settings-view__action-grid">
        <!-- 本地状态操作按钮，danger 为 true 时显示风险样式。 -->
        <button
          v-for="action in localStateActions"
          :key="action.id"
          type="button"
          class="settings-view__action-button"
          :class="{ 'settings-view__action-button--danger': action.danger }"
        >
          <strong class="settings-view__action-label">{{ action.label }}</strong>
          <span class="settings-view__action-desc">{{ action.description }}</span>
        </button>
      </div>

      <!-- localStateActions 为空时，操作区保留空状态。 -->
      <div v-else class="settings-view__empty">
        <h3 class="settings-view__empty-title">暂无本地操作</h3>
        <p class="settings-view__empty-text">当前没有可展示的本地状态操作。</p>
      </div>
    </section>
  </div>
</template>

<script>
// 设置页本地数据，记录应用设置、数据源列表和本地状态操作入口。
import { settingsPageData } from '../data/page-settings.mock';

export default {
  // 组件名称用于在调试工具和报错信息中识别设置页。
  name: 'SettingsView',

  data() {
    return {
      // appSettings 驱动基础设置区；为 null 时该分区显示暂无基础设置。
      appSettings: this.asObjectOrNull(settingsPageData.appSettings),

      // sources 驱动数据源列表区；数组为空时该分区显示暂无数据源。
      sources: this.asList(settingsPageData.sources),

      // localStateActions 驱动本地状态操作区；数组为空时该分区显示暂无操作。
      localStateActions: this.asList(settingsPageData.localStateActions)
    };
  },

  computed: {
    // hasAppSettings 控制基础设置区是否展示四个设置项，还是展示暂无基础设置。
    hasAppSettings() {
      return Boolean(this.appSettings);
    },

    // hasSources 控制数据源列表区是否展示源卡片网格，还是展示暂无数据源。
    hasSources() {
      return this.sources.length > 0;
    },

    // hasLocalStateActions 控制本地状态区是否展示操作按钮，还是展示暂无操作。
    hasLocalStateActions() {
      return this.localStateActions.length > 0;
    },

    // defaultSourceText 显示在“默认数据源”这一项里。
    defaultSourceText() {
      // 没有 defaultSourceId 时给页面一个明确占位，避免设置值位置空着。
      return this.appSettings.defaultSourceId || '暂未设置';
    },

    // directPlayOnlyText 显示在“仅直链播放”这一项里。
    directPlayOnlyText() {
      // directPlayOnly 是布尔值，页面上需要转换成用户能直接读懂的文字。
      return this.appSettings.directPlayOnly ? '开启' : '关闭';
    },

    // showUnsupportedText 显示在“显示不支持源”这一项里。
    showUnsupportedText() {
      // showUnsupportedSources 是布尔值，页面上用“显示 / 隐藏”表达列表策略。
      return this.appSettings.showUnsupportedSources ? '显示' : '隐藏';
    },

    // sourceCheckModeText 显示在“源检测模式”这一项里。
    sourceCheckModeText() {
      // modeTextMap 把保存用的英文值转换成页面展示用中文。
      const modeTextMap = {
        manual: '手动检测',
        session: '每次会话检测'
      };

      // 未收录的模式统一显示“未设置”，避免把内部字段原样暴露到页面。
      return modeTextMap[this.appSettings.sourceCheckMode] || '未设置';
    },

    // sourceCountText 显示在数据源分区标题右侧。
    sourceCountText() {
      // sources 已经在 data 中整理成数组，所以这里可以直接读取 length。
      return `${this.sources.length} 个数据源`;
    }
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * @param {*} value 可能来自设置页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      // 页面循环渲染只能安全处理数组；不是数组就让对应分区进入空状态。
      return Array.isArray(value) ? value : [];
    },

    /**
     * 把普通字段集合整理成可读取的设置数据。
     *
     * @param {*} value 可能来自设置页数据文件的字段集合。
     * @returns {Object|null} 可读取字段集合原样返回，其他值统一转成 null。
     */
    asObjectOrNull(value) {
      // 空值、基础类型和数组都不能按 key 读取，所以统一当作没有数据。
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      // 走到这里说明 value 是普通字段集合，可以被 computed 和 template 安全读取。
      return value;
    },

    /**
     * 把数据源启用开关转换成页面文字。
     *
     * @param {boolean} enabled 数据源是否启用。
     * @returns {string} 展示在数据源卡片上的启用状态文本。
     */
    formatEnabledText(enabled) {
      // enabled 是保存用布尔值，标签区需要展示成“已启用 / 已停用”。
      return enabled ? '已启用' : '已停用';
    },

    /**
     * 把默认源开关转换成页面文字。
     *
     * @param {boolean} isDefault 数据源是否为默认源。
     * @returns {string} 展示在数据源卡片上的默认源状态文本。
     */
    formatDefaultText(isDefault) {
      // isDefault 为 true 时说明后续默认优先使用这个源。
      return isDefault ? '默认源' : '非默认';
    },

    /**
     * 把数据源检测状态转换成页面文字。
     *
     * @param {string} status 数据源检测状态，例如 ready、loading、error、unsupported。
     * @returns {string} 展示在数据源卡片右上角的状态文本。
     */
    formatSourceStatus(status) {
      // statusTextMap 把保存用英文状态转换成页面右上角的中文状态标签。
      const statusTextMap = {
        ready: '可用',
        loading: '检测中',
        error: '异常',
        unsupported: '不支持'
      };

      // 如果后续出现新状态但这里还没适配，先显示“未知”兜底。
      return statusTextMap[status] || '未知';
    },

    /**
     * 把“这个源支持哪些页面”的开关表转换成页面标签列表。
     *
     * @param {Object} capabilities 数据源页面能力开关表，例如 home、movie、tv、search、detail、play。
     * @returns {Array} 页面标签数组，每一项包含页面名、页面显示文本和是否支持。
     */
    getCapabilityItems(capabilities) {
      // capabilityLabels 固定页面标签展示顺序，避免不同源显示顺序不一致。
      const capabilityLabels = [
        { name: 'home', label: '首页' },
        { name: 'movie', label: '电影' },
        { name: 'tv', label: '电视剧' },
        { name: 'search', label: '搜索' },
        { name: 'detail', label: '详情' },
        { name: 'play', label: '播放' }
      ];

      // 没有页面能力开关表时，全部能力按不支持展示。
      const safeCapabilities = this.asObjectOrNull(capabilities) || {};

      // 把 { home: true } 这种字段表转换成 template 方便 v-for 渲染的数组。
      return capabilityLabels.map((item) => ({
        // name 保留原始字段名，用来生成 key，也用来读取 safeCapabilities。
        name: item.name,

        // label 是页面标签显示的中文。
        label: item.label,

        // enabled 决定标签是否加高亮样式。
        enabled: Boolean(safeCapabilities[item.name])
      }));
    }
  }
};
</script>

<style scoped>
/*
  设置页整体容器。
  对应 template 中的 `.settings-view`，负责包裹设置页全部分区。
*/
.settings-view {
  /* 限制页面最大宽度，保证宽屏下内容不会过度拉伸。 */
  max-width: 1180px;

  /* 让设置页在主体区域中水平居中。 */
  width: 100%;

  /* 给页面上下留出空间，避免内容贴近导航栏和页脚。 */
  padding: 36px 32px 48px;

  /* 让 padding 计入宽度，避免横向溢出。 */
  box-sizing: border-box;
}

/*
  页面头部说明区。
  对应 template 中的 `.settings-view__hero`，展示页面标题和说明。
*/
.settings-view__hero {
  /* 控制头部说明区和下方设置面板之间的距离。 */
  margin-bottom: 22px;
}

/*
  页面短标签。
  对应 template 中的 `.settings-view__eyebrow`。
*/
.settings-view__eyebrow {
  /* 清掉段落默认外边距。 */
  margin: 0 0 8px;

  /* 使用较小字号形成辅助层级。 */
  font-size: 13px;

  /* 使用较粗字重让短标签清晰可见。 */
  font-weight: 700;

  /* 使用主题蓝色。 */
  color: #315fca;
}

/*
  页面标题。
  对应 template 中的 `.settings-view__title`。
*/
.settings-view__title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用大字号作为页面主标题。 */
  font-size: 34px;

  /* 使用紧凑行高，保证标题换行后稳定。 */
  line-height: 1.18;

  /* 使用较粗字重突出标题。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  页面说明。
  对应 template 中的 `.settings-view__summary`。
*/
.settings-view__summary {
  /* 控制说明和标题之间的距离。 */
  margin: 12px 0 0;

  /* 使用正文大小，保证说明易读。 */
  font-size: 15px;

  /* 设置舒适行高，适合较长说明。 */
  line-height: 1.7;

  /* 使用中性色，让说明处于辅助层级。 */
  color: #5d6678;
}

/*
  通用设置面板。
  对应 template 中的 `.settings-view__panel`，用于基础设置、数据源和本地状态分区。
*/
.settings-view__panel {
  /* 使用白色背景，让面板从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用浅色边框明确面板边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和其他页面卡片一致的圆角。 */
  border-radius: 8px;

  /* 给面板内部留出空间。 */
  padding: 20px;

  /* 控制多个面板之间的垂直距离。 */
  margin-bottom: 22px;
}

/*
  面板头部。
  对应 template 中的 `.settings-view__panel-header`，展示标题、说明和数量。
*/
.settings-view__panel-header {
  /* 使用 flex 让标题说明和右侧数量在同一行。 */
  display: flex;

  /* 让标题说明靠左，数量靠右。 */
  justify-content: space-between;

  /* 垂直方向居中标题和数量。 */
  align-items: center;

  /* 控制面板头部和内容之间的距离。 */
  margin-bottom: 16px;

  /* 控制标题说明和数量之间的间距。 */
  gap: 12px;
}

/*
  面板标题。
  对应 template 中的 `.settings-view__panel-title`。
*/
.settings-view__panel-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用中等字号，适合作为设置分区标题。 */
  font-size: 20px;

  /* 使用较粗字重突出分区标题。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  面板说明。
  对应 template 中的 `.settings-view__panel-desc`。
*/
.settings-view__panel-desc {
  /* 控制说明和标题之间的距离。 */
  margin: 6px 0 0;

  /* 使用正文偏小字号，保持说明层级。 */
  font-size: 14px;

  /* 使用中性色显示说明。 */
  color: #667085;
}

/*
  面板数量标签。
  对应 template 中的 `.settings-view__panel-count`。
*/
.settings-view__panel-count {
  /* 缩小字号，让数量作为辅助信息展示。 */
  font-size: 13px;

  /* 使用中性色，避免数量抢过标题。 */
  color: #667085;
}

/*
  基础设置列表。
  对应 template 中的 `.settings-view__setting-list`。
*/
.settings-view__setting-list {
  /* 使用 grid 让设置项自动排成多列。 */
  display: grid;

  /* 每列最小 200px，空间不足时自动减少列数。 */
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));

  /* 控制设置项之间的距离。 */
  gap: 12px;
}

/*
  单个基础设置项。
  对应 template 中的 `.settings-view__setting-item`。
*/
.settings-view__setting-item {
  /* 使用浅色背景区分单个设置项。 */
  background: #f8fafc;

  /* 使用浅色边框明确设置项边界。 */
  border: 1px solid #e6eaf0;

  /* 保持设置项圆角和页面风格一致。 */
  border-radius: 8px;

  /* 给设置项内部留出空间。 */
  padding: 14px;

  /* 使用纵向 flex 让标签和值上下排列。 */
  display: flex;

  /* 主轴改为纵向。 */
  flex-direction: column;

  /* 控制标签和值之间的距离。 */
  gap: 6px;
}

/*
  设置项标签。
  对应 template 中的 `.settings-view__setting-label`。
*/
.settings-view__setting-label {
  /* 使用较小字号显示字段名称。 */
  font-size: 13px;

  /* 使用中性色，让标签处于辅助层级。 */
  color: #667085;
}

/*
  设置项值。
  对应 template 中的 `.settings-view__setting-value`。
*/
.settings-view__setting-value {
  /* 使用正文大小展示设置值。 */
  font-size: 16px;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  数据源卡片网格。
  对应 template 中的 `.settings-view__source-grid`。
*/
.settings-view__source-grid {
  /* 使用 grid 管理多个数据源卡片。 */
  display: grid;

  /* 每列最小 280px，宽屏多列、窄屏自动减少列数。 */
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));

  /* 控制数据源卡片之间的距离。 */
  gap: 16px;
}

/*
  数据源卡片。
  对应 template 中的 `.settings-view__source-card`。
*/
.settings-view__source-card {
  /* 使用浅色背景区分单个数据源。 */
  background: #f8fafc;

  /* 使用浅色边框明确卡片边界。 */
  border: 1px solid #e6eaf0;

  /* 保持卡片圆角和页面风格一致。 */
  border-radius: 8px;

  /* 给卡片内部留出空间。 */
  padding: 16px;
}

/*
  数据源卡片头部。
  对应 template 中的 `.settings-view__source-header`，展示源名称、域名和状态。
*/
.settings-view__source-header {
  /* 使用 flex 让源信息和状态标签横向排列。 */
  display: flex;

  /* 让源信息靠左，状态标签靠右。 */
  justify-content: space-between;

  /* 顶部对齐，适配源名称换行。 */
  align-items: flex-start;

  /* 控制源信息和状态标签之间的距离。 */
  gap: 12px;
}

/*
  数据源名称。
  对应 template 中的 `.settings-view__source-name`。
*/
.settings-view__source-name {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用列表标题字号，保证源名称清晰。 */
  font-size: 18px;

  /* 使用较粗字重突出源名称。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  数据源域名。
  对应 template 中的 `.settings-view__source-domain`。
*/
.settings-view__source-domain {
  /* 控制域名和源名称之间的距离。 */
  margin: 5px 0 0;

  /* 使用较小字号显示辅助信息。 */
  font-size: 13px;

  /* 使用浅灰文字降低域名视觉重量。 */
  color: #8a94a6;
}

/*
  数据源状态标签。
  对应 template 中的 `.settings-view__source-status`。
*/
.settings-view__source-status {
  /* 使用浅蓝背景形成标签形态。 */
  background: #eef3ff;

  /* 使用蓝色文字和页面主题保持一致。 */
  color: #315fca;

  /* 给状态文字留出内部空间。 */
  padding: 5px 10px;

  /* 使用胶囊圆角，适合短状态展示。 */
  border-radius: 999px;

  /* 缩小状态字号，保持辅助层级。 */
  font-size: 13px;

  /* 禁止状态标签被挤压换行。 */
  flex: 0 0 auto;
}

/*
  数据源状态说明。
  对应 template 中的 `.settings-view__source-message`。
*/
.settings-view__source-message {
  /* 控制说明和卡片头部之间的距离。 */
  margin: 12px 0 0;

  /* 使用正文偏小字号，适合卡片说明。 */
  font-size: 14px;

  /* 设置行高，保证多行说明可读。 */
  line-height: 1.6;

  /* 使用中性色，让说明处于辅助层级。 */
  color: #5d6678;
}

/*
  数据源标签行。
  对应 template 中的 `.settings-view__tag-row`，展示启用状态和默认源状态。
*/
.settings-view__tag-row {
  /* 使用 flex 让标签横向排列。 */
  display: flex;

  /* 允许标签换行，避免窄卡片中溢出。 */
  flex-wrap: wrap;

  /* 控制标签之间的距离。 */
  gap: 8px;

  /* 控制标签行和说明之间的距离。 */
  margin-top: 12px;
}

/*
  数据源状态标签。
  对应 template 中的 `.settings-view__tag`。
*/
.settings-view__tag {
  /* 使用白色背景，和卡片浅底形成轻微层次。 */
  background: #ffffff;

  /* 使用浅色边框明确标签边界。 */
  border: 1px solid #e6eaf0;

  /* 给标签文字留出内部空间。 */
  padding: 4px 8px;

  /* 使用胶囊圆角。 */
  border-radius: 999px;

  /* 使用较小字号显示标签。 */
  font-size: 12px;

  /* 使用中性色显示标签文字。 */
  color: #667085;
}

/*
  页面支持标签列表。
  对应 template 中的 `.settings-view__capability-list`，展示源支持哪些页面数据。
*/
.settings-view__capability-list {
  /* 使用 flex 让页面支持标签横向排列。 */
  display: flex;

  /* 允许页面支持标签换行。 */
  flex-wrap: wrap;

  /* 控制页面支持标签之间的距离。 */
  gap: 8px;

  /* 控制页面支持列表和状态标签之间的距离。 */
  margin-top: 14px;
}

/*
  单个页面支持标签。
  对应 template 中的 `.settings-view__capability`。
*/
.settings-view__capability {
  /* 默认使用灰色背景，表示当前页面数据未支持。 */
  background: #edf0f5;

  /* 默认使用灰色文字，降低未支持页面标签的视觉重量。 */
  color: #8a94a6;

  /* 给标签文字留出内部空间。 */
  padding: 5px 9px;

  /* 使用胶囊圆角。 */
  border-radius: 999px;

  /* 缩小字号，适合页面支持标签展示。 */
  font-size: 12px;
}

/*
  已支持页面标签。
  对应 template 中的 `.settings-view__capability--active`，由 capability.enabled 控制。
*/
.settings-view__capability--active {
  /* 使用浅蓝背景提示该页面数据可用。 */
  background: #eef3ff;

  /* 使用蓝色文字强调该页面已支持。 */
  color: #315fca;
}

/*
  数据源卡片操作区。
  对应 template 中的 `.settings-view__source-actions`。
*/
.settings-view__source-actions {
  /* 使用 flex 让按钮横向排列。 */
  display: flex;

  /* 允许按钮在窄卡片中换行。 */
  flex-wrap: wrap;

  /* 控制按钮之间的距离。 */
  gap: 8px;

  /* 控制按钮区和页面支持标签列表之间的距离。 */
  margin-top: 16px;
}

/*
  小按钮。
  对应 template 中的 `.settings-view__small-button`，用于源检测和设为默认。
*/
.settings-view__small-button {
  /* 使用白色背景，让按钮在浅色卡片上清晰可见。 */
  background: #ffffff;

  /* 使用主题蓝边框提示这是可点击操作。 */
  border: 1px solid #c8d6ff;

  /* 使用主题蓝文字，和边框保持一致。 */
  color: #315fca;

  /* 给按钮留出点击区域。 */
  padding: 7px 10px;

  /* 保持按钮圆角和页面风格一致。 */
  border-radius: 6px;

  /* 使用较小字号适配卡片操作区。 */
  font-size: 13px;

  /* 使用较粗字重，提高按钮识别度。 */
  font-weight: 700;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;
}

/*
  本地状态操作按钮网格。
  对应 template 中的 `.settings-view__action-grid`。
*/
.settings-view__action-grid {
  /* 使用 grid 让操作按钮按列排列。 */
  display: grid;

  /* 每列最小 220px，空间不足时自动减少列数。 */
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

  /* 控制操作按钮之间的距离。 */
  gap: 12px;
}

/*
  本地状态操作按钮。
  对应 template 中的 `.settings-view__action-button`。
*/
.settings-view__action-button {
  /* 左对齐按钮内容，让标题和说明像信息卡一样阅读。 */
  text-align: left;

  /* 使用白色背景，保持普通操作按钮视觉克制。 */
  background: #ffffff;

  /* 使用浅色边框明确按钮边界。 */
  border: 1px solid #e6eaf0;

  /* 保持按钮圆角和页面卡片一致。 */
  border-radius: 8px;

  /* 给按钮内部留出空间。 */
  padding: 14px;

  /* 使用纵向 flex 让标题和说明上下排列。 */
  display: flex;

  /* 主轴改为纵向。 */
  flex-direction: column;

  /* 控制标题和说明之间的距离。 */
  gap: 6px;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;
}

/*
  风险操作按钮。
  对应 template 中的 `.settings-view__action-button--danger`，由 action.danger 控制。
*/
.settings-view__action-button--danger {
  /* 使用浅红背景提示这是更敏感的本地状态操作。 */
  background: #fff5f5;

  /* 使用浅红边框和普通操作区分。 */
  border-color: #ffd1d1;
}

/*
  操作按钮标题。
  对应 template 中的 `.settings-view__action-label`。
*/
.settings-view__action-label {
  /* 使用深色文字突出操作名称。 */
  color: #182235;

  /* 使用正文大小，保证按钮标题清晰。 */
  font-size: 15px;
}

/*
  操作按钮说明。
  对应 template 中的 `.settings-view__action-desc`。
*/
.settings-view__action-desc {
  /* 使用较小字号显示操作说明。 */
  font-size: 13px;

  /* 设置行高，保证说明换行后可读。 */
  line-height: 1.6;

  /* 使用中性色，保持说明辅助层级。 */
  color: #667085;
}

/*
  分区空状态。
  对应 template 中的 `.settings-view__empty`，用于设置、数据源或操作为空的情况。
*/
.settings-view__empty {
  /* 使用虚线边框提示这是暂无数据区域。 */
  border: 1px dashed #cad3e1;

  /* 使用浅色背景，让空状态不显得突兀。 */
  background: #f8fafc;

  /* 保持和内容面板一致的圆角。 */
  border-radius: 8px;

  /* 给空状态内部留出空间。 */
  padding: 24px;

  /* 空状态文字居中显示。 */
  text-align: center;
}

/*
  空状态标题。
  对应 template 中的 `.settings-view__empty-title`。
*/
.settings-view__empty-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用中等字号，让空状态标题清晰。 */
  font-size: 18px;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  空状态说明。
  对应 template 中的 `.settings-view__empty-text`。
*/
.settings-view__empty-text {
  /* 控制说明和标题之间的距离。 */
  margin: 8px 0 0;

  /* 使用正文偏小字号，保持说明层级。 */
  font-size: 14px;

  /* 使用中性色显示说明。 */
  color: #667085;
}

/*
  手机布局。
  触发条件：屏幕宽度不超过 640px。
  调整后：设置页面左右留白变小，面板头部从横向改为纵向。
*/
@media (max-width: 640px) {
  .settings-view {
    /* 缩小页面左右留白，适配手机宽度。 */
    padding: 24px 16px 36px;
  }

  .settings-view__panel-header {
    /* 手机上标题说明和数量纵向排列，避免横向挤压。 */
    align-items: flex-start;

    /* 主轴改为纵向。 */
    flex-direction: column;
  }
}
</style>
