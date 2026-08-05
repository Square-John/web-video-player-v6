<template>
  <!--
    SystemSourceCreditsPanel 组件渲染树

    [DEFAULT] ele(section.system-source-credits)
    ├─ ele(div.system-source-credits__notice) 展示感谢、权利归属和侵权处理边界
    └─ ele(SourceAttributionList) 展示全部系统源声明
  -->
  <!--
    [DEFAULT] ele(section.system-source-credits)
    - condition: 系统源致谢声明设置子路由激活时渲染。
    - type: 原生标签 section。
    - description: 组合系统源说明和只读署名列表，不重复模块标题。
    - params: 无。
    - events: 无。
  -->
  <section class="system-source-credits">
    <div class="system-source-credits__notice" role="note">
      <p>本项目及相应的脚本仅供技术交流和学习演示使用，各位用户及开发者长期使用请前往源站点支持使用。本项目仅为播放框架，如要长期使用请自备播放源。</p>
      <p>感谢以下站点及 Provider 脚本作者为项目体验提供公开信息来源。</p>
      <p>本项目不存储、上传或分发源站媒体，相关内容及权利归原站和权利人所有。</p>
      <p>
        如相关脚本或外部链接侵犯您的权益，请通过
        <a
          :href="issueTrackerUrl"
          :target="externalLinkAttributes.target"
          :rel="externalLinkAttributes.rel">项目问题入口</a>
        联系；核实后可移除对应内置 Provider 脚本或外部链接。
      </p>
    </div>

    <SourceAttributionList
      :entries="entries"
      empty-description="当前没有系统源声明信息" />
  </section>
</template>

<script>
/*
  SystemSourceCreditsPanel.vue 模块说明

  - 文件职责:
      展示系统内置 Provider 的感谢、权利边界、联系入口和标准署名列表。
      页面只读取 SourceManager 投影，不提供系统源管理、健康或更新操作。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      SourceAttributionList: 自定义组件，渲染统一署名字段。
      PROJECT_LINKS: 自定义配置，提供公开问题联系入口。
      EXTERNAL_LINK_ATTRIBUTES: 自定义配置，提供外链安全属性。
      SOURCE_KIND 与 getSourceAttributionEntries: 自定义配置和服务，读取系统源条目。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SystemSourceCreditsPanel: Vue component，供系统源致谢声明设置路由渲染。
*/

// 导入来源: ./SourceAttributionList.vue；导入内容: SourceAttributionList；文件作用: 复用标准署名条目布局。
import SourceAttributionList from './SourceAttributionList.vue';

import {
  // 导入来源: ../../config/project-links.config.js；导入内容: EXTERNAL_LINK_ATTRIBUTES；文件作用: 统一联系外链属性。
  EXTERNAL_LINK_ATTRIBUTES,
  // 导入来源: ../../config/project-links.config.js；导入内容: PROJECT_LINKS；文件作用: 读取集中项目问题入口。
  PROJECT_LINKS
} from '../../config/project-links.config.js';

import {
  // 导入来源: ../../config/source-manager.config.js；导入内容: SOURCE_KIND；文件作用: 固定查询 system 记录。
  SOURCE_KIND
} from '../../config/source-manager.config.js';

// 导入来源: ../../services/sourceAttributionService.js；导入内容: getSourceAttributionEntries；文件作用: 从响应式 Store 投影系统源声明。
import { getSourceAttributionEntries } from '../../services/sourceAttributionService.js';

// 导出类型: default Vue component options；调用方: 设置动态路由；使用场景: 系统源致谢声明页面。
export default {
  // 类型: string；作用: 供 Vue Devtools 和路由错误识别系统源致谢模块。
  name: 'SystemSourceCreditsPanel',

  components: {
    // 组件: SourceAttributionList；作用: 渲染系统源标准字段，不在本页面重复条目模板。
    SourceAttributionList
  },

  computed: {
    /**
     * 读取当前系统源署名条目。
     * 数据来源: settingsStore.sourceManager.records，经通用服务按 system 过滤。
     * 纯函数: 只读取响应式投影，不修改系统源软隐藏、启停或管理状态。
     *
     * @returns {ReadonlyArray<object>} 当前系统源声明列表。
     */
    entries() {
      return getSourceAttributionEntries(SOURCE_KIND.system);
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
/* 作用容器: 系统源致谢页面；使用稳定纵向节奏组合说明和列表。 */
.system-source-credits {
  display: grid;
  gap: 24px;
  min-width: 0;
}

/* 作用容器: 权利与联系说明；使用浅色整块提示，不把页面区段包装成浮动卡片。 */
.system-source-credits__notice {
  padding: 16px 18px;
  border-left: 3px solid var(--accent);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.75;
}

/* 作用容器: 说明段落；消除浏览器默认不一致边距。 */
.system-source-credits__notice p {
  margin: 0;
}

/* 作用容器: 相邻说明段落；建立紧凑但可辨的行距。 */
.system-source-credits__notice p + p {
  margin-top: 6px;
}

/* 作用容器: 项目联系链接；使用主题色表达可操作入口。 */
.system-source-credits__notice a {
  color: var(--accent);
}
</style>
