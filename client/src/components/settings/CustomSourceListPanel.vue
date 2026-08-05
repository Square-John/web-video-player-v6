<template>
  <!--
    CustomSourceListPanel 组件渲染树

    [DEFAULT] ele(section.custom-source-list-panel)
    ├─ ele(div.custom-source-list-panel__notice) 展示自定义源免责声明
    └─ ele(SourceAttributionList) 展示自定义源声明和导入方式
  -->
  <!--
    [DEFAULT] ele(section.custom-source-list-panel)
    - condition: 自定义源列表责任声明设置子路由激活时渲染。
    - type: 原生标签 section。
    - description: 组合用户导入责任说明和当前自定义源只读列表。
    - params: 无。
    - events: 无。
  -->
  <section class="custom-source-list-panel">
    <div class="custom-source-list-panel__notice" role="note">
      <p>以下脚本由用户自行导入并决定是否授权运行，不是项目提供的系统数据源。</p>
      <p>项目不提供、维护或审核这些脚本及其内容；相关风险由脚本提供者和使用者自行承担。</p>
      <p>本页只读展示当前自定义源声明；导入、授权、启停、删除和更新仍在数据源管理中完成。</p>
      <p>
        如需报告项目自身问题，请使用
        <a
          :href="issueTrackerUrl"
          :target="externalLinkAttributes.target"
          :rel="externalLinkAttributes.rel">项目问题入口</a>。
      </p>
    </div>

    <SourceAttributionList
      :entries="entries"
      :show-import-method="true"
      empty-description="当前没有用户导入的自定义源" />
  </section>
</template>

<script>
/*
  CustomSourceListPanel.vue 模块说明

  - 文件职责:
      展示自定义 Provider 的导入责任说明、联系入口和标准只读声明信息。
      页面不提供脚本导入、授权、启停、删除或更新操作，这些能力继续属于数据源管理。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      SourceAttributionList: 自定义组件，渲染统一声明字段和导入方式。
      PROJECT_LINKS: 自定义配置，提供公开问题联系入口。
      EXTERNAL_LINK_ATTRIBUTES: 自定义配置，提供外链安全属性。
      SOURCE_KIND 与 getSourceAttributionEntries: 自定义配置和服务，读取自定义源条目。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      CustomSourceListPanel: Vue component，供自定义源列表责任声明设置路由渲染。
*/

// 导入来源: ./SourceAttributionList.vue；导入内容: SourceAttributionList；文件作用: 复用标准声明字段布局。
import SourceAttributionList from './SourceAttributionList.vue';

import {
  // 导入来源: ../../config/project-links.config.js；导入内容: EXTERNAL_LINK_ATTRIBUTES；文件作用: 统一联系外链属性。
  EXTERNAL_LINK_ATTRIBUTES,
  // 导入来源: ../../config/project-links.config.js；导入内容: PROJECT_LINKS；文件作用: 读取集中项目问题入口。
  PROJECT_LINKS
} from '../../config/project-links.config.js';

import {
  // 导入来源: ../../config/source-manager.config.js；导入内容: SOURCE_KIND；文件作用: 固定查询 custom 记录。
  SOURCE_KIND
} from '../../config/source-manager.config.js';

// 导入来源: ../../services/sourceAttributionService.js；导入内容: getSourceAttributionEntries；文件作用: 从响应式 Store 投影自定义源声明。
import { getSourceAttributionEntries } from '../../services/sourceAttributionService.js';

// 导出类型: default Vue component options；调用方: 设置动态路由；使用场景: 自定义源列表责任声明页面。
export default {
  // 类型: string；作用: 供 Vue Devtools 和路由错误识别自定义源列表模块。
  name: 'CustomSourceListPanel',

  components: {
    // 组件: SourceAttributionList；作用: 渲染自定义源标准字段，不在本页面重复条目模板。
    SourceAttributionList
  },

  computed: {
    /**
     * 读取当前自定义源声明条目。
     * 数据来源: settingsStore.sourceManager.records，经通用服务按 custom 过滤。
     * 纯函数: 只读取响应式投影，不修改用户授权、启停、导入或删除状态。
     *
     * @returns {ReadonlyArray<object>} 当前自定义源声明列表。
     */
    entries() {
      return getSourceAttributionEntries(SOURCE_KIND.custom);
    },

    /**
     * 读取集中配置的项目问题入口。
     * 纯函数: 返回冻结配置字符串，不修改浏览器地址。
     *
     * @returns {string} 项目公开问题入口地址。
     */
    issueTrackerUrl() {
      return PROJECT_LINKS.issueTrackerUrl;
    },

    /**
     * 读取联系外链安全属性。
     * 纯函数: 返回冻结配置引用，不修改外链策略。
     *
     * @returns {Readonly<object>} 联系外链统一 target 和 rel。
     */
    externalLinkAttributes() {
      return EXTERNAL_LINK_ATTRIBUTES;
    }
  }
};
</script>

<style scoped>
/* 作用容器: 自定义源声明页面；使用稳定纵向节奏组合免责声明和列表。 */
.custom-source-list-panel {
  display: grid;
  gap: 24px;
  min-width: 0;
}

/* 作用容器: 自定义源免责声明；使用中性背景保持严肃、清晰且不抢夺列表注意力。 */
.custom-source-list-panel__notice {
  padding: 16px 18px;
  border-left: 3px solid var(--warning);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.75;
}

/* 作用容器: 免责声明段落；清除浏览器默认边距。 */
.custom-source-list-panel__notice p {
  margin: 0;
}

/* 作用容器: 相邻免责声明段落；提供紧凑的阅读分隔。 */
.custom-source-list-panel__notice p + p {
  margin-top: 6px;
}

/* 作用容器: 项目联系链接；使用主题强调色表达可操作入口。 */
.custom-source-list-panel__notice a {
  color: var(--accent);
}
</style>
