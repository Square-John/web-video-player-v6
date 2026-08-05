<template>
  <!--
    AboutProjectPanel 组件渲染树

    [DEFAULT] ele(section.about-project)
    ├─ [DEFAULT] ele(header.about-project__intro)
    │  ├─ [DEFAULT] ele(div.about-project__identity)
    │  └─ [DEFAULT] ele(nav.about-project__actions)
    ├─ [DEFAULT] ele(section.about-project__section)
    └─ [DEFAULT] ele(section.about-project__section)
       └─ [DEFAULT] ele(section.about-project__dependency-group)
          └─ [DEFAULT] ele(a.about-project__dependency)
  -->
  <!--
    [DEFAULT] ele(section.about-project)
    - condition: 关于设置子路由激活时渲染。
    - type: 原生标签 section。
    - description: 展示项目定位、权利边界、许可证和主要开源项目，不读取运行态或保存用户数据。
    - params: 无。
    - events: 无。
  -->
  <section class="about-project">
    <!--
      [DEFAULT] ele(header.about-project__intro)
      - condition: 默认渲染。
      - type: 原生标签 header。
      - description: 以项目名称为首要信息，并集中提供仓库与问题反馈入口。
      - params: 无。
      - events: 无。
    -->
    <header class="about-project__intro">
      <div class="about-project__identity">
        <p class="about-project__eyebrow">开源播放框架</p>
        <h2>{{ project.projectName }}</h2>
        <p class="about-project__description">{{ project.projectDescription }}</p>
        <p class="about-project__boundary">{{ project.mediaBoundary }}</p>
      </div>

      <nav class="about-project__actions" aria-label="项目外部入口">
        <a
          :href="project.repositoryUrl"
          :target="externalLinkAttributes.target"
          :rel="externalLinkAttributes.rel">
          <i class="el-icon-link" aria-hidden="true"></i>
          <span>项目仓库</span>
        </a>
        <a
          :href="projectLinks.issueTrackerUrl"
          :target="externalLinkAttributes.target"
          :rel="externalLinkAttributes.rel">
          <i class="el-icon-chat-line-square" aria-hidden="true"></i>
          <span>问题反馈</span>
        </a>
      </nav>
    </header>

    <!--
      [DEFAULT] ele(section.about-project__section)
      - condition: 默认渲染。
      - type: 原生标签 section。
      - description: 解释项目自身 MIT 授权及其不覆盖的第三方内容边界。
      - params: 无。
      - events: 无。
    -->
    <section class="about-project__section" aria-labelledby="about-license-title">
      <div class="about-project__section-heading">
        <div>
          <p class="about-project__section-kicker">项目许可证</p>
          <h3 id="about-license-title">{{ project.license.name }}</h3>
        </div>
        <a
          class="about-project__license-link"
          :href="project.license.url"
          :target="externalLinkAttributes.target"
          :rel="externalLinkAttributes.rel">
          查看许可证说明
          <i class="el-icon-top-right" aria-hidden="true"></i>
        </a>
      </div>
      <p>{{ project.license.description }}</p>
      <p class="about-project__secondary-text">
        MIT License 仅适用于本项目拥有版权的源码和文档，不覆盖外部媒体、源站内容、商标、第三方 Provider 脚本或第三方开源项目。
      </p>
    </section>

    <!--
      [DEFAULT] ele(section.about-project__section)
      - condition: 默认渲染；集中配置始终提供经过测试核对的依赖清单。
      - type: 原生标签 section。
      - description: 按前端、后端和构建职责分组致谢主要直接开源项目。
      - params: 无。
      - events: 无。
    -->
    <section class="about-project__section" aria-labelledby="about-open-source-title">
      <div class="about-project__section-heading">
        <div>
          <p class="about-project__section-kicker">第三方项目</p>
          <h3 id="about-open-source-title">开源项目致谢</h3>
        </div>
      </div>
      <p class="about-project__secondary-text">
        感谢下列项目提供的基础能力。每个项目继续遵守其自身许可证，项目名称可打开相应官方站点或官方仓库。
      </p>

      <div class="about-project__dependency-groups">
        <!--
          [DEFAULT] ele(section.about-project__dependency-group)
          - condition: dependencyGroups 中对应类别存在时循环渲染。
          - type: 原生标签 section。
          - description: 展示一个职责类别及该类别下的全部主要直接依赖。
          - params: group，来自集中依赖配置的分组投影。
          - events: 无。
        -->
        <section
          v-for="group in dependencyGroups"
          :key="group.id"
          class="about-project__dependency-group">
          <div class="about-project__group-heading">
            <h4>{{ group.title }}</h4>
            <span>{{ group.items.length }} 项</span>
          </div>

          <div class="about-project__dependency-list">
            <!--
              [DEFAULT] ele(a.about-project__dependency)
              - condition: 当前分组的 items 条目循环渲染。
              - type: 原生标签 a。
              - description: 展示项目名称、package、许可证和用途，并链接到集中配置的官方入口。
              - params: dependency，来自 PROJECT_ATTRIBUTION.openSourceProjects。
              - events: 浏览器按安全外链属性在新标签页打开官方入口。
            -->
            <a
              v-for="dependency in group.items"
              :key="dependency.id"
              class="about-project__dependency"
              :href="dependency.projectUrl"
              :target="externalLinkAttributes.target"
              :rel="externalLinkAttributes.rel">
              <span class="about-project__dependency-main">
                <strong>{{ dependency.name }}</strong>
                <small>{{ dependency.packageNames.join(' / ') }}</small>
              </span>
              <span class="about-project__dependency-description">{{ dependency.description }}</span>
              <span class="about-project__license-badge">{{ dependency.license }}</span>
              <i class="el-icon-top-right" aria-hidden="true"></i>
            </a>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>

<script>
/*
  AboutProjectPanel.vue 模块说明

  - 文件职责:
      展示项目定位、媒体资源边界、公开入口、MIT 许可证和主要直接开源项目。
      供设置页关于子路由消费集中项目署名配置，不读取工程文件、Store 或持久化数据。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      PROJECT_ATTRIBUTION: 自定义配置，提供项目定位、许可证和主要开源项目事实。
      PROJECT_DEPENDENCY_CATEGORY: 自定义配置，提供依赖职责分组枚举。
      PROJECT_LINKS: 自定义配置，提供项目问题反馈入口。
      EXTERNAL_LINK_ATTRIBUTES: 自定义配置，提供外链隔离属性。

  - 模块级常量:
      DEPENDENCY_GROUP_DEFINITIONS: ReadonlyArray<object>，关于页依赖分组顺序和用户可读名称。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      AboutProjectPanel: Vue component，供关于设置路由展示项目公开信息。
*/

import {
  // 导入来源: ../../config/project-attribution.config.js；导入内容: PROJECT_ATTRIBUTION；文件作用: 提供页面全部项目和依赖事实。
  PROJECT_ATTRIBUTION,
  // 导入来源: ../../config/project-attribution.config.js；导入内容: PROJECT_DEPENDENCY_CATEGORY；文件作用: 使用稳定类别筛选依赖。
  PROJECT_DEPENDENCY_CATEGORY
} from '../../config/project-attribution.config.js';

import {
  // 导入来源: ../../config/project-links.config.js；导入内容: EXTERNAL_LINK_ATTRIBUTES；文件作用: 统一全部外链安全属性。
  EXTERNAL_LINK_ATTRIBUTES,
  // 导入来源: ../../config/project-links.config.js；导入内容: PROJECT_LINKS；文件作用: 提供问题反馈入口。
  PROJECT_LINKS
} from '../../config/project-links.config.js';

// 类型: ReadonlyArray<Readonly<object>>。
// 作用: 固定关于页依赖分组顺序和展示名称；依赖条目本身仍只来自集中项目署名配置。
const DEPENDENCY_GROUP_DEFINITIONS = Object.freeze([
  Object.freeze({ id: PROJECT_DEPENDENCY_CATEGORY.frontend, title: '前端运行依赖' }),
  Object.freeze({ id: PROJECT_DEPENDENCY_CATEGORY.backend, title: '后端运行依赖' }),
  Object.freeze({ id: PROJECT_DEPENDENCY_CATEGORY.build, title: '生产构建工具' })
]);

// 导出类型: default Vue component options；调用方: 设置动态路由；使用场景: 关于页面。
export default {
  // 类型: string；作用: 供 Vue Devtools 和路由错误识别关于模块。
  name: 'AboutProjectPanel',

  computed: {
    /**
     * 读取冻结的项目署名事实。
     * 数据来源: project-attribution.config.js；组件不读取 package.json、网络或 Store。
     * 纯函数: 返回冻结配置引用，不修改项目公开信息。
     *
     * @returns {Readonly<object>} 项目名称、定位、媒体边界、许可证和依赖清单。
     */
    project() {
      return PROJECT_ATTRIBUTION;
    },

    /**
     * 读取集中项目链接。
     * 数据来源: project-links.config.js；组件不自行拼接仓库或问题地址。
     * 纯函数: 返回冻结配置引用，不触发浏览器导航。
     *
     * @returns {Readonly<object>} 项目仓库、问题和许可证入口。
     */
    projectLinks() {
      return PROJECT_LINKS;
    },

    /**
     * 读取统一外链安全属性。
     * 纯函数: 返回冻结配置引用，模板负责绑定 target 和 rel。
     *
     * @returns {Readonly<object>} 外链 target 和 rel 属性。
     */
    externalLinkAttributes() {
      return EXTERNAL_LINK_ATTRIBUTES;
    },

    /**
     * 按稳定职责类别投影开源项目。
     * 数据来源: PROJECT_ATTRIBUTION.openSourceProjects 和本组件只负责布局的分组定义。
     * 纯函数: filter 创建展示数组，不修改冻结配置或依赖条目。
     *
     * @returns {Array<object>} 按前端、后端和构建顺序排列的依赖分组。
     */
    dependencyGroups() {
      return DEPENDENCY_GROUP_DEFINITIONS.map(group => ({
        ...group,
        items: this.project.openSourceProjects.filter(dependency => dependency.category === group.id)
      }));
    }
  }
};
</script>

<style scoped>
/* 作用容器: 关于页面根区域；建立无嵌套卡片的纵向信息结构并允许长链接收缩。 */
.about-project {
  display: grid;
  gap: 32px;
  min-width: 0;
}

/* 作用容器: 项目定位首区；在宽工作区并排放置身份说明和外部入口。 */
.about-project__intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: 24px;
  align-items: start;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--border-color);
}

/* 作用容器: 项目身份文本列；限制段落宽度以维持舒适阅读行长。 */
.about-project__identity {
  max-width: 760px;
  min-width: 0;
}

/* 作用容器: 项目类别眉题；使用主题强调色建立首区信息层级。 */
.about-project__eyebrow,
.about-project__section-kicker {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
}

/* 作用容器: 项目正式名称；使用设置工作区内适度标题尺度，不形成营销式巨型标题。 */
.about-project__identity h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 26px;
  line-height: 1.25;
}

/* 作用容器: 项目定位说明；提供名称下方的主要产品描述。 */
.about-project__description {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.7;
}

/* 作用容器: 媒体权利边界；与主要描述拉开轻量距离并降低视觉层级。 */
.about-project__boundary {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
}

/* 作用容器: 项目仓库与反馈入口；使用自然宽度命令链接并保持键盘焦点空间。 */
.about-project__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* 作用容器: 单个项目外链；提供轻量边框和图标以表达明确命令。 */
.about-project__actions a {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  text-decoration: none;
}

/* 作用容器: 项目外链悬停和键盘焦点状态；用主题色反馈可操作性。 */
.about-project__actions a:hover,
.about-project__actions a:focus-visible,
.about-project__license-link:hover,
.about-project__license-link:focus-visible {
  border-color: var(--accent);
  color: var(--accent);
}

/* 作用容器: 许可证与依赖两个正文区；通过分隔线建立信息分区而不包装浮动卡片。 */
.about-project__section {
  min-width: 0;
}

/* 作用容器: 非首个正文区；使用顶部边线与留白分隔许可证和开源项目。 */
.about-project__section + .about-project__section {
  padding-top: 28px;
  border-top: 1px solid var(--border-color);
}

/* 作用容器: 正文区标题行；让标题与可选操作分别靠两侧排列。 */
.about-project__section-heading {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

/* 作用容器: 正文区标题；使用紧凑设置面板标题尺度。 */
.about-project__section-heading h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 19px;
  line-height: 1.4;
}

/* 作用容器: 正文区普通段落；限定信息宽度并保持可读行距。 */
.about-project__section > p {
  max-width: 860px;
  margin: 12px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.75;
}

/* 作用容器: 许可证辅助说明和依赖引导；降低权利边界与说明文字层级。 */
.about-project__section > .about-project__secondary-text {
  color: var(--text-muted);
  font-size: 13px;
}

/* 作用容器: MIT 许可证外链；保持自然宽度并提供图标方向提示。 */
.about-project__license-link {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  flex: none;
  padding: 7px 0;
  border-bottom: 1px solid transparent;
  color: var(--text-secondary);
  font-size: 13px;
  text-decoration: none;
}

/* 作用容器: 三类依赖分组集合；让分组在文档流中连续展示而不嵌套卡片。 */
.about-project__dependency-groups {
  display: grid;
  gap: 26px;
  margin-top: 24px;
}

/* 作用容器: 单个依赖职责分组；允许内部列表在工作区宽度内收缩。 */
.about-project__dependency-group {
  min-width: 0;
}

/* 作用容器: 依赖分组标题；并排展示类别名称和条目计数。 */
.about-project__group-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

/* 作用容器: 依赖类别名称；使用正文层级标题避免与页面主标题竞争。 */
.about-project__group-heading h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.5;
}

/* 作用容器: 依赖条目计数；使用弱化文本辅助扫描列表规模。 */
.about-project__group-heading span {
  color: var(--text-muted);
  font-size: 12px;
}

/* 作用容器: 单组依赖列表；通过上下边线形成连续列表边界。 */
.about-project__dependency-list {
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

/* 作用容器: 单个开源项目条目；建立名称、用途、许可证和外链图标的稳定网格。 */
.about-project__dependency {
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) minmax(220px, 1.5fr) max-content max-content;
  gap: 16px;
  align-items: center;
  min-width: 0;
  padding: 13px 4px;
  color: inherit;
  text-decoration: none;
}

/* 作用容器: 相邻开源项目条目；使用细线保持行间识别而不制造独立卡片。 */
.about-project__dependency + .about-project__dependency {
  border-top: 1px solid var(--border-color);
}

/* 作用容器: 开源项目条目悬停和键盘焦点；用浅色背景确认当前可点击行。 */
.about-project__dependency:hover,
.about-project__dependency:focus-visible {
  background: var(--surface-muted);
}

/* 作用容器: 开源项目名称和 package 列；纵向组合用户名称与工程标识。 */
.about-project__dependency-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 作用容器: 开源项目名称；突出当前条目的主要识别文本。 */
.about-project__dependency-main strong {
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
}

/* 作用容器: package 名称集合；使用等宽字体帮助开发者识别真实依赖。 */
.about-project__dependency-main small {
  overflow-wrap: anywhere;
  margin-top: 2px;
  color: var(--text-muted);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.5;
}

/* 作用容器: 开源项目用途说明；允许长文本自然换行且不撑宽网格。 */
.about-project__dependency-description {
  min-width: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

/* 作用容器: 第三方项目许可证标识；使用紧凑中性 badge 辅助快速扫描。 */
.about-project__license-badge {
  padding: 3px 7px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

/* 作用容器: 平板宽度下的关于页；让依赖用途列移到第二行并保留清晰扫描顺序。 */
@media (max-width: 900px) {
  .about-project__dependency {
    grid-template-columns: minmax(0, 1fr) max-content max-content;
  }

  .about-project__dependency-description {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

/* 作用容器: 手机宽度下的关于页；把首区和操作改为纵向并让依赖元信息自然换行。 */
@media (max-width: 640px) {
  .about-project {
    gap: 26px;
  }

  .about-project__intro {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    padding-bottom: 22px;
  }

  .about-project__actions {
    justify-content: flex-start;
  }

  .about-project__section-heading {
    flex-direction: column;
    gap: 8px;
  }

  .about-project__dependency {
    grid-template-columns: minmax(0, 1fr) max-content;
    gap: 8px 12px;
    padding: 13px 2px;
  }

  .about-project__dependency-description {
    grid-column: 1 / -1;
    grid-row: auto;
  }

  .about-project__license-badge {
    grid-column: 2;
    grid-row: 1;
  }

  .about-project__dependency > .el-icon-top-right {
    grid-column: 2;
    grid-row: 2;
    justify-self: end;
  }
}
</style>
