<template>
  <!--
    SourceAttributionList 组件渲染树

    [DEFAULT] ele(section.source-attribution-list)
    ├─ [IF entries.length] ele(div.source-attribution-list__items)
    │  └─ [FOR entry] ele(article.source-attribution-list__item)
    │     ├─ ele(header) 展示数据源脚本名称和版本
    │     ├─ ele(dl) 展示源站名称/域名、作者、可选导入方式和原站地址
    │     └─ [IF entry.description] ele(p) 展示 Provider 非空说明
    └─ [ELSE] ele(el-empty) 展示当前来源列表为空
  -->
  <!--
    [DEFAULT] ele(section.source-attribution-list)
    - condition: 默认渲染。
    - type: 原生标签 section。
    - description: 只读署名条目容器，不提供数据源管理操作。
    - params: entries、showImportMethod 和 emptyDescription 来自父设置模块。
    - events: 无。
  -->
  <section class="source-attribution-list" aria-live="polite">
    <!--
      [IF entries.length] ele(div.source-attribution-list__items)
      - condition: 至少存在一条指定 sourceKind 的署名记录时渲染。
      - type: 原生标签 div。
      - description: 按 SourceManager 权威顺序排列全部条目。
      - params: entries 为通用服务生成的冻结数组。
      - events: 无。
    -->
    <div v-if="entries.length" class="source-attribution-list__items">
      <!--
        [FOR entry] ele(article.source-attribution-list__item)
        - condition: 对 entries 中每条记录循环渲染。
        - type: 原生标签 article。
        - description: 展示一条数据源脚本声明信息。
        - params: entry.id 作为稳定 key，其他字段只用于展示。
        - events: 无。
      -->
      <article
        v-for="entry in entries"
        :key="entry.id"
        class="source-attribution-list__item">
        <header class="source-attribution-list__header">
          <strong class="source-attribution-list__name">{{ entry.name }}</strong>
          <span class="source-attribution-list__version">v{{ entry.version }}</span>
        </header>

        <dl class="source-attribution-list__metadata">
          <div class="source-attribution-list__metadata-row">
            <dt>源站名称</dt>
            <dd>{{ entry.siteName }}</dd>
          </div>
          <div class="source-attribution-list__metadata-row">
            <dt>源站域名</dt>
            <dd>
              <span v-if="entry.siteDomain" class="source-attribution-list__domain">
                {{ entry.siteDomain }}
              </span>
              <span v-else class="source-attribution-list__missing-link">未提供源站域名</span>
            </dd>
          </div>
          <div class="source-attribution-list__metadata-row">
            <dt>脚本作者</dt>
            <dd>{{ entry.authorName }}</dd>
          </div>
          <div
            v-if="showImportMethod"
            class="source-attribution-list__metadata-row">
            <dt>导入方式</dt>
            <dd>{{ entry.importMethodLabel }}</dd>
          </div>
          <div class="source-attribution-list__metadata-row">
            <dt>原站地址</dt>
            <dd>
              <!-- 空 siteUrl 不创建 href，避免无效链接获得焦点或触发当前页跳转。 -->
              <a
                v-if="entry.siteUrl"
                class="source-attribution-list__link"
                :href="entry.siteUrl"
                :target="externalLinkAttributes.target"
                :rel="externalLinkAttributes.rel">
                访问原站
                <i class="el-icon-top-right" aria-hidden="true"></i>
              </a>
              <span v-else class="source-attribution-list__missing-link">未提供原站地址</span>
            </dd>
          </div>
        </dl>

        <p v-if="entry.description" class="source-attribution-list__description">
          {{ entry.description }}
        </p>
      </article>
    </div>

    <!--
      [ELSE] ele(el-empty.source-attribution-list__empty)
      - condition: 当前来源类型没有任何署名记录时渲染。
      - type: 第三方组件 Element UI el-empty。
      - description: 使用父模块提供的准确空状态，不猜测记录缺失原因。
      - params: description 和 image-size。
      - events: 无。
    -->
    <el-empty
      v-else
      class="source-attribution-list__empty"
      :description="emptyDescription"
      :image-size="emptyImageSize" />
  </section>
</template>

<script>
/*
  SourceAttributionList.vue 模块说明

  - 文件职责:
      统一渲染系统源和自定义源的脚本、源站、作者和地址只读声明条目。
      组件不读取 Store、不区分具体站点，也不提供数据源管理命令。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      EXTERNAL_LINK_ATTRIBUTES: 自定义配置，提供统一外链 target 和 rel。

  - 模块级常量:
      ATTRIBUTION_EMPTY_IMAGE_SIZE: number，Element UI 空状态插图尺寸。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceAttributionList: Vue component，供两个设置声明页面复用字段布局。
*/

import {
  // 导入来源: ../../config/project-links.config.js。
  // 导入内容: EXTERNAL_LINK_ATTRIBUTES 外链安全属性。
  // 文件作用: 让每条原站链接使用统一新窗口和隔离策略。
  EXTERNAL_LINK_ATTRIBUTES
} from '../../config/project-links.config.js';

// 类型: number。
// 作用: 控制无记录时 Element UI 空状态插图大小，避免模板使用无语义数字。
const ATTRIBUTION_EMPTY_IMAGE_SIZE = 88;

// 导出类型: default Vue component options。
// 外部调用方: SystemSourceCreditsPanel 和 CustomSourceListPanel。
// 使用场景: 渲染来源类型已经由父模块确定的只读署名列表。
export default {
  // 类型: string；作用: 供 Vue Devtools 和错误堆栈识别共享署名列表。
  name: 'SourceAttributionList',

  props: {
    // 类型: Array<object>；来源: sourceAttributionService；作用: 驱动只读条目循环。
    entries: {
      type: Array,
      /**
       * 创建独立空条目数组。
       * 纯函数: 每个组件实例获得新的数组，不共享可变默认值。
       *
       * @returns {Array<object>} 默认空署名列表。
       */
      default() {
        return [];
      }
    },
    // 类型: boolean；true 展示导入方式，false 隐藏该行；系统源页面使用 false，自定义源页面使用 true。
    showImportMethod: {
      type: Boolean,
      default: false
    },
    // 类型: string；来源: 父模块；作用: 解释当前来源类型列表为空，不在共享组件猜测原因。
    emptyDescription: {
      type: String,
      default: '暂无数据源声明信息'
    }
  },

  computed: {
    /**
     * 读取统一外链属性。
     * 纯函数: 返回冻结配置引用，不修改链接策略。
     *
     * @returns {Readonly<object>} 包含 target 和 rel 的外链属性。
     */
    externalLinkAttributes() {
      return EXTERNAL_LINK_ATTRIBUTES;
    },

    /**
     * 读取空状态插图尺寸。
     * 纯函数: 返回模块常量，不读取视口或 DOM。
     *
     * @returns {number} Element UI el-empty 插图尺寸。
     */
    emptyImageSize() {
      return ATTRIBUTION_EMPTY_IMAGE_SIZE;
    }
  }
};
</script>

<style scoped>
/* 作用容器: 署名列表根容器；保持工作区透明，不制造嵌套页面卡片。 */
.source-attribution-list {
  min-width: 0;
}

/* 作用容器: 条目集合；使用单列分隔列表承载长度不确定的声明信息。 */
.source-attribution-list__items {
  border-top: 1px solid var(--border-color);
}

/* 作用容器: 单条署名记录；稳定纵向留白并以底部分隔线区分相邻脚本。 */
.source-attribution-list__item {
  padding: 20px 2px;
  border-bottom: 1px solid var(--border-color);
}

/* 作用容器: 条目标题行；允许窄屏换行，避免长名称和版本互相挤压。 */
.source-attribution-list__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

/* 作用容器: 数据源脚本名称；使用正文级强调，不在设置工作区制造英雄字号。 */
.source-attribution-list__name {
  min-width: 0;
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* 作用容器: 版本文案；保持次级视觉权重并阻止版本号断行。 */
.source-attribution-list__version {
  flex: 0 0 auto;
  color: var(--text-secondary);
  font-size: 13px;
}

/* 作用容器: 元信息集合；在标题后提供紧凑的字段扫描区。 */
.source-attribution-list__metadata {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
}

/* 作用容器: 单个元信息字段；标签列稳定对齐，值列允许收缩。 */
.source-attribution-list__metadata-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 12px;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

/* 作用容器: 元信息标签；使用次级颜色降低重复标签权重。 */
.source-attribution-list__metadata-row dt {
  color: var(--text-secondary);
}

/* 作用容器: 元信息值；清除描述列表默认边距并支持长文本断行。 */
.source-attribution-list__metadata-row dd {
  min-width: 0;
  margin: 0;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

/* 作用容器: 源站域名值；使用等宽字体帮助用户辨认域名边界，同时允许长域名安全换行。 */
.source-attribution-list__domain {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  overflow-wrap: anywhere;
}

/* 作用容器: 原站外链；使用主题强调色表达可操作性。 */
.source-attribution-list__link {
  color: var(--accent);
  text-decoration: none;
}

/* 作用容器: 原站外链悬停与键盘焦点；提供清晰下划线反馈。 */
.source-attribution-list__link:hover,
.source-attribution-list__link:focus-visible {
  text-decoration: underline;
}

/* 作用容器: 缺失原站地址文案；明确不可操作状态。 */
.source-attribution-list__missing-link {
  color: var(--text-secondary);
}

/* 作用容器: Provider 说明；只在非空时出现并限制阅读宽度。 */
.source-attribution-list__description {
  max-width: 72ch;
  margin: 14px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

/* 作用容器: 空状态；提供适量纵向空间而不撑高整个设置页。 */
.source-attribution-list__empty {
  padding: 32px 0;
}

/* 响应式断点: 手机；元信息改为单列，避免标签列挤压可读内容。 */
@media (max-width: 640px) {
  .source-attribution-list__metadata-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
}
</style>
