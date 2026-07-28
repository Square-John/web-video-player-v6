<template>
  <!--
    SourceListRow 组件渲染树

    [DEFAULT] ele(div.source-list-row)
    │  - condition:
    │      SourceList 循环到当前 record 时默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      单行数据源入口；整行只负责进入详情，内部选择、开关和操作按钮停止冒泡。
    │  - params:
    │      -- record：当前数据源记录。
    │      -- selected：当前行是否处于批量选择状态。
    │      -- isDefault：当前行是否为唯一默认数据源。
    │  - events:
    │      @click、@keydown.enter
    │          - description:
    │              用户点击行空白区域或按 Enter 时进入当前数据源详情。
    │          - methods:
    │              openDetail()
    │
    ├─ [DEFAULT] ele(el-checkbox.source-list-row__selection)
    │  - condition:
    │      当前行默认渲染。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-checkbox
    │  - description:
    │      控制当前数据源是否进入页面局部批量选择集合。
    │  - params:
    │      -- selected：父组件传入的当前行选择状态。
    │  - events:
    │      @change
    │          - description:
    │              用户勾选或取消当前数据源时触发。
    │          - methods:
    │              toggleSelection(selected)
    │                  -- selected：目标选择状态。
    │
    ├─ [DEFAULT] ele(div.source-list-row__name)
    │  - condition:
    │      当前行默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      展示数据源名称和不可用原因；手机视口同时承载类型、版本和状态 Chip。
    │  - params:
    │      -- record.definition.name、sourceKindText、record.definition.version、statusText、statusReason：展示字段。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(el-tag.source-list-row__kind)
    │  - condition:
    │      桌面和平板默认显示，手机由 CSS 隐藏并使用名称列内的紧凑副本。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-tag
    │  - description:
    │      以 Chip 形式展示系统源或自定义源类型。
    │  - params:
    │      -- sourceKindText、sourceKindTagType：类型文案和视觉类型。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(el-tag.source-list-row__version)
    │  - condition:
    │      桌面默认显示，窄视口由 CSS 隐藏并使用名称列内的紧凑副本。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-tag
    │  - description:
    │      以 Chip 形式展示当前本地脚本版本。
    │  - params:
    │      -- record.definition.version：当前脚本版本。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(el-tag.source-list-row__status)
    │  - condition:
    │      桌面和平板默认显示，手机由 CSS 隐藏并使用名称列内的紧凑副本。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-tag
    │  - description:
    │      以 Chip 形式展示启停优先的运行状态。
    │  - params:
    │      -- statusText、statusTagType：状态文案和视觉类型。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(el-switch.source-list-row__default-switch)
    │  - condition:
    │      当前行默认渲染；当前默认源或未启用源保持禁用。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-switch
    │  - description:
    │      打开其他已启用数据源时请求完成互斥默认源切换。
    │  - params:
    │      -- isDefault：当前唯一默认源状态。
    │      -- defaultSwitchDisabled：是否禁止当前行发起默认源切换。
    │  - events:
    │      @change
    │          - description:
    │              用户打开非默认且已启用数据源的默认源开关时触发。
    │          - methods:
    │              setAsDefault(enabled)
    │                  -- enabled：开关目标状态，仅 true 会向上提交。
    │
    ├─ [DEFAULT] ele(el-switch.source-list-row__enabled-switch)
    │  - condition:
    │      当前行默认渲染。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-switch
    │  - description:
    │      请求启用或关闭当前数据源；关闭默认源时由父页面启动交接流程。
    │  - params:
    │      -- record.runtime.enabled：当前启用状态。
    │  - events:
    │      @change
    │          - description:
    │              用户切换数据源启用状态时触发。
    │          - methods:
    │              toggleSource(enabled)
    │                  -- enabled：目标启用状态。
    │
    ├─ [DEFAULT] ele(div.source-list-row__actions)
    │  - condition:
    │      当前行默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      行尾快捷操作区，提供全部缓存重置和删除入口。
    │  - params:
    │      -- record.definition.id、record.definition.name：操作目标和无障碍名称。
    │  - events:
    │      @click
    │          - description:
    │              用户点击重置或删除按钮时触发对应父级流程。
    │          - methods:
    │              resetSource()
    │              deleteSource()
    │
    └─ [DEFAULT] ele(span.source-list-row__arrow)
       - condition:
           桌面默认渲染，窄视口由 CSS 隐藏。
       - type:
           原生标签
           标签名称: span
       - description:
           提示整行可以进入独立数据源详情页。
       - params:
           无
       - events:
           无
  -->
  <!--
    [DEFAULT] ele(div.source-list-row)
    - condition:
        SourceList 循环到当前 record 时默认渲染。
    - type:
        原生标签
        标签名称: div
    - description:
        数据源单行根节点；响应式列由 SourceList 父容器统一提供。
    - params:
        -- record、selected、isDefault：当前记录、选择状态和默认源状态。
    - events:
        @click、@keydown.enter
            - description:
                点击行空白区域或键盘 Enter 时进入详情。
            - methods:
                openDetail()
  -->
  <div
    class="source-list-row"
    role="button"
    tabindex="0"
    :aria-label="`查看数据源 ${record.definition.name} 的详情`"
    @click="openDetail"
    @keydown.enter.prevent="openDetail"
  >
    <!--
      [DEFAULT] ele(el-checkbox.source-list-row__selection)
      - condition:
          当前行默认渲染。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-checkbox
      - description:
          当前行批量选择入口；点击和键盘事件不会触发详情导航。
      - params:
          -- selected：父级维护的当前行选择状态。
      - events:
          @change
              - description:
                  选择状态变化时通知父级合并页面局部选择集合。
              - methods:
                  toggleSelection(selected)
                      -- selected：目标选择状态。
    -->
    <el-checkbox
      class="source-list-row__selection"
      :value="selected"
      :aria-label="`选择数据源 ${record.definition.name}`"
      @click.native.stop
      @keydown.native.stop
      @change="toggleSelection"
    />

    <!--
      [DEFAULT] ele(div.source-list-row__name)
      - condition:
          当前行默认渲染。
      - type:
          原生标签
          标签名称: div
      - description:
          显示名称和不可用原因；手机视口在同一列追加紧凑 Chip，避免列表横向溢出。
      - params:
          -- record.definition.name、sourceKindText、record.definition.version、statusText、statusReason：展示字段。
      - events:
          无
    -->
    <div class="source-list-row__name" :title="record.definition.name">
      <span class="source-list-row__name-text">{{ record.definition.name }}</span>
      <span class="source-list-row__mobile-meta" aria-hidden="true">
        <el-tag size="mini" effect="plain" :type="sourceKindTagType">{{ sourceKindText }}</el-tag>
        <el-tag size="mini" effect="plain" type="info">{{ record.definition.version }}</el-tag>
        <el-tag size="mini" effect="plain" :type="statusTagType">{{ statusText }}</el-tag>
      </span>
      <!--
        [IF statusReason] ele(span.source-list-row__status-reason)
        - condition:
            当前记录已启用但 Provider 未就绪，或最近健康检测不可用时渲染。
        - type:
            原生标签
            标签名称: span
        - description:
            直接解释不可用原因，避免用户把启用意愿误解为脚本已经可以运行。
        - params:
            -- statusReason：统一展示工具按 Provider 原因优先级派生的说明。
        - events:
            无
      -->
      <span v-if="statusReason" class="source-list-row__status-reason" :title="statusReason">
        {{ statusReason }}
      </span>
    </div>

    <!--
      [DEFAULT] ele(el-tag.source-list-row__kind)
      - condition:
          桌面和平板默认显示，手机视口由 CSS 隐藏。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-tag
      - description:
          数据源类型 Chip。
      - params:
          -- sourceKindText、sourceKindTagType：类型文案和视觉类型。
      - events:
          无
    -->
    <el-tag class="source-list-row__kind" size="mini" effect="plain" :type="sourceKindTagType">
      {{ sourceKindText }}
    </el-tag>
    <!--
      [DEFAULT] ele(el-tag.source-list-row__version)
      - condition:
          桌面默认显示，平板和手机由 CSS 隐藏。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-tag
      - description:
          当前脚本版本 Chip。
      - params:
          -- record.definition.version：版本文案。
      - events:
          无
    -->
    <el-tag class="source-list-row__version" size="mini" effect="plain" type="info">
      {{ record.definition.version }}
    </el-tag>
    <!--
      [DEFAULT] ele(el-tag.source-list-row__status)
      - condition:
          桌面和平板默认显示，手机视口由 CSS 隐藏。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-tag
      - description:
          启停优先的运行状态 Chip。
      - params:
          -- statusText、statusTagType：状态文案和视觉类型。
      - events:
          无
    -->
    <el-tag class="source-list-row__status" size="mini" effect="plain" :type="statusTagType">
      {{ statusText }}
    </el-tag>

    <!--
      [DEFAULT] ele(span.source-list-row__default-switch)
      - condition:
          当前行默认渲染。
      - type:
          原生标签
          标签名称: span
      - description:
          隔离默认源开关事件，避免点击开关进入详情。
      - params:
          -- isDefault、defaultSwitchDisabled：开关值和禁用状态。
      - events:
          @click、@keydown
              - description:
                  阻止内部交互冒泡到行详情入口。
              - methods:
                  stopPropagation
    -->
    <span class="source-list-row__default-switch" @click.stop @keydown.stop>
      <el-switch
        :value="isDefault"
        :disabled="defaultSwitchDisabled"
        :aria-label="defaultSwitchLabel"
        @change="setAsDefault"
      />
    </span>

    <!--
      [DEFAULT] ele(span.source-list-row__enabled-switch)
      - condition:
          当前行默认渲染。
      - type:
          原生标签
          标签名称: span
      - description:
          隔离启用开关事件，避免点击开关进入详情。
      - params:
          -- record.runtime.enabled：当前启用状态。
      - events:
          @click、@keydown
              - description:
                  阻止内部交互冒泡到行详情入口。
              - methods:
                  stopPropagation
    -->
    <span class="source-list-row__enabled-switch" @click.stop @keydown.stop>
      <el-switch
        :value="record.runtime.enabled"
        :aria-label="enabledSwitchLabel"
        @change="toggleSource"
      />
    </span>

    <!--
      [DEFAULT] ele(div.source-list-row__actions)
      - condition:
          当前行默认渲染。
      - type:
          原生标签
          标签名称: div
      - description:
          重置全部缓存和删除数据源的行尾快捷操作区。
      - params:
          -- record.definition.name：按钮无障碍文案目标。
      - events:
          @click、@keydown
              - description:
                  阻止操作按钮触发详情导航。
              - methods:
                  stopPropagation
    -->
    <div class="source-list-row__actions" @click.stop @keydown.stop>
      <el-button
        class="source-list-row__action source-list-row__action--reset"
        type="text"
        size="mini"
        icon="el-icon-refresh"
        :title="`重置 ${record.definition.name} 的全部缓存`"
        :aria-label="`重置 ${record.definition.name} 的全部缓存`"
        @click="resetSource"
      >
        <span class="source-list-row__action-text">重置</span>
      </el-button>
      <el-button
        class="source-list-row__action source-list-row__action--delete"
        type="text"
        size="mini"
        icon="el-icon-delete"
        :title="`删除数据源 ${record.definition.name}`"
        :aria-label="`删除数据源 ${record.definition.name}`"
        @click="deleteSource"
      >
        <span class="source-list-row__action-text">删除</span>
      </el-button>
    </div>

    <!--
      [DEFAULT] ele(span.source-list-row__arrow)
      - condition:
          桌面默认显示，窄视口由 CSS 隐藏。
      - type:
          原生标签
          标签名称: span
      - description:
          详情导航方向提示，不参与交互。
      - params:
          无
      - events:
          无
    -->
    <span class="source-list-row__arrow" aria-hidden="true">›</span>
  </div>
</template>

<script>
/*
  SourceListRow.vue 模块说明

  - 文件职责:
      渲染单条数据源管理记录，并把选择、默认源、启停、缓存重置、删除和详情意图上抛给父组件。
      组件只派生展示和操作资格，不修改 SourceManagerState 或直接调用 Runtime。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      isSourceRecordRunnable: 自定义设置服务函数，统一判断默认源所需的全局可运行资格。
      SOURCE_KIND_TEXT: 自定义配置，把数据源类型转换成用户文案。
      getSourceRuntimeStatusKey: 自定义工具函数，读取启停优先的状态样式键。
      getSourceRuntimeStatusReason: 自定义工具函数，读取 Provider 或健康不可用原因。
      getSourceRuntimeStatusText: 自定义工具函数，读取启停优先的状态文案。

  - 模块级常量:
      SOURCE_KIND_TAG_TYPE: object，数据源类型对应的 Element UI Chip 视觉类型。
      SOURCE_STATUS_TAG_TYPE: object，运行状态对应的 Element UI Chip 视觉类型。
      FALLBACK_TAG_TYPE: string，未知状态使用的中性 Chip 类型。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      默认 Vue 组件配置: object，供 SourceList 循环渲染每条数据源记录。
*/

// 导入来源: ../../services/settingsService。
// 导入内容: isSourceRecordRunnable 全局可运行资格函数。
// 文件作用: 默认源开关与 service、摘要和交接候选使用同一资格规则。
import { isSourceRecordRunnable } from '../../services/settingsService';

import {
  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: SOURCE_KIND_TEXT 数据源类型文案映射。
  // 文件作用: 统一列表行类型 Chip 文案。
  SOURCE_KIND_TEXT,
  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: getSourceRuntimeStatusKey 状态样式键函数。
  // 文件作用: 根据启停和健康状态选择 Chip 视觉类型。
  getSourceRuntimeStatusKey,
  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: getSourceRuntimeStatusReason 状态原因函数。
  // 文件作用: 在列表名称下解释 Provider 未就绪或健康检测失败原因。
  getSourceRuntimeStatusReason,
  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: getSourceRuntimeStatusText 状态文案函数。
  // 文件作用: 统一列表行运行状态 Chip 文案。
  getSourceRuntimeStatusText
} from '../../utils/settingsDisplay';

// 类型: object。
// 作用: 将数据源类型映射为 Element UI Chip 视觉，不在模板散落条件表达式。
// 字段: system，string，系统源使用中性信息样式。
// 字段: custom，string，自定义源使用 Element UI 默认主色样式。
const SOURCE_KIND_TAG_TYPE = Object.freeze({
  system: 'info',
  custom: ''
});

// 类型: object。
// 作用: 将统一运行状态键映射为 Element UI Chip 视觉。
// 字段: normal，string，正常状态使用成功样式。
// 字段: checking，string，检测中使用 Element UI 默认主色样式。
// 字段: unavailable，string，不可用使用危险样式。
// 字段: closed，string，关闭状态使用中性信息样式。
const SOURCE_STATUS_TAG_TYPE = Object.freeze({
  normal: 'success',
  checking: '',
  unavailable: 'danger',
  closed: 'info'
});

// 类型: string。
// 作用: 类型或状态值不在映射中时使用中性 Chip，保证页面不会出现无样式字段。
const FALLBACK_TAG_TYPE = 'info';

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools 和错误堆栈识别列表行。
  name: 'SourceListRow',

  props: {
    // 类型: object。
    // 来源: SourceList 当前循环条目。
    // 作用: 提供名称、类型、版本、运行态和操作目标 id。
    // 字段: definition，object，脚本定义和展示元信息。
    // 字段: runtime，object，启用和健康运行态。
    record: {
      type: Object,
      required: true
    },

    // 类型: boolean。
    // 来源: SourceList 根据 defaultSourceId 派生。
    // 作用: 控制互斥默认源开关。
    // true: 当前行是唯一默认源，开关开启且不可单独关闭。
    // false: 当前行不是默认源，已启用时允许切换为默认源。
    isDefault: {
      type: Boolean,
      default: false
    },

    // 类型: boolean。
    // 来源: SourceList 页面局部选择集合。
    // 作用: 控制当前行批量选择框。
    // true: 当前记录进入批量导出或删除目标。
    // false: 当前记录不参与批量操作。
    selected: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    /**
     * 读取数据源类型文案。
     * 数据来源: record.definition.sourceKind 和 SOURCE_KIND_TEXT。
     * 副作用: 无，只派生展示文本，不修改记录。
     *
     * @returns {string} 系统源、自定义源或稳定兜底文案。
     */
    sourceKindText() {
      return SOURCE_KIND_TEXT[this.record.definition.sourceKind] || '数据源';
    },

    /**
     * 读取数据源类型 Chip 视觉类型。
     * 数据来源: record.definition.sourceKind 和 SOURCE_KIND_TAG_TYPE。
     * 副作用: 无，只返回 Element UI 视觉枚举。
     *
     * @returns {string} Element UI el-tag type 值。
     */
    sourceKindTagType() {
      return SOURCE_KIND_TAG_TYPE[this.record.definition.sourceKind] || FALLBACK_TAG_TYPE;
    },

    /**
     * 读取启停优先的运行状态文案。
     * 数据来源: 当前 record，由统一展示工具判断关闭或健康状态。
     * 副作用: 无，只派生状态文本。
     *
     * @returns {string} 已关闭、正常、检测中或不可用文案。
     */
    statusText() {
      return getSourceRuntimeStatusText(this.record);
    },

    /**
     * 读取运行状态 Chip 视觉类型。
     * 数据来源: getSourceRuntimeStatusKey 的统一状态键。
     * 副作用: 无，只派生 Chip 视觉类型。
     *
     * @returns {string} Element UI el-tag type 值。
     */
    statusTagType() {
      // 类型: string；作用: 保存统一展示工具返回的关闭或健康状态键。
      const statusKey = getSourceRuntimeStatusKey(this.record);
      return SOURCE_STATUS_TAG_TYPE[statusKey] || FALLBACK_TAG_TYPE;
    },

    /**
     * 读取当前不可用状态的解释原因。
     * 数据来源: 当前 record，由统一展示工具优先读取 Provider 就绪原因，再读取健康检测原因。
     * 副作用: 无，只派生列表辅助说明文本。
     *
     * @returns {string} 不可用原因；关闭、正常或检测中返回空字符串。
     */
    statusReason() {
      return getSourceRuntimeStatusReason(this.record);
    },

    /**
     * 判断默认源开关是否禁用。
     * 当前默认源不能通过自身开关关闭；未通过全局可运行门禁的记录不能成为默认源。
     * 副作用: 无，只派生开关可操作性。
     *
     * @returns {boolean} true 禁止切换，false 允许设为默认源。
     */
    defaultSwitchDisabled() {
      return this.isDefault || !isSourceRecordRunnable(this.record);
    },

    /**
     * 生成默认源开关无障碍说明。
     * 数据来源: isDefault、统一可运行资格、statusReason 和数据源名称。
     * 副作用: 无，只返回当前状态对应的说明。
     *
     * @returns {string} 解释当前开关状态和可执行动作的文案。
     */
    defaultSwitchLabel() {
      // 条件分支: 当前记录已经是默认源时进入。
      // 执行内容: 说明当前互斥开关不能直接关闭。
      if (this.isDefault) return `${this.record.definition.name} 当前是默认数据源`;
      // 条件分支: 用户没有启用当前记录时进入。
      // 执行内容: 说明未启用记录不具备默认源资格。
      if (!this.record.runtime.enabled) return `${this.record.definition.name} 未启用，不能设为默认数据源`;
      // 条件分支: 记录已启用但授权或 Provider 就绪门禁未通过时进入。
      // 执行内容: 返回统一不可运行原因，避免只显示不可操作而不解释。
      if (!isSourceRecordRunnable(this.record)) {
        return `${this.record.definition.name} 当前不可运行，不能设为默认数据源：${this.statusReason}`;
      }
      return `将 ${this.record.definition.name} 设为默认数据源`;
    },

    /**
     * 生成启用开关无障碍说明。
     * 数据来源: record.runtime.enabled 和数据源名称。
     * 副作用: 无，只派生当前开关动作说明。
     *
     * @returns {string} 当前切换动作说明。
     */
    enabledSwitchLabel() {
      return `${this.record.runtime.enabled ? '关闭' : '启用'}数据源 ${this.record.definition.name}`;
    }
  },

  methods: {
    /**
     * 请求打开当前数据源详情。
     * 触发来源: 行根节点 click 或 Enter。
     * 副作用: 发出 open-detail 事件，路由跳转由父页面完成。
     *
     * @returns {void} 通过事件传递数据源 id。
     */
    openDetail() {
      this.$emit('open-detail', this.record.definition.id);
    },

    /**
     * 请求切换当前行批量选择状态。
     * 触发来源: 行首选择框 change。
     * 副作用: 发出 toggle-select 事件，不直接修改父级数组。
     *
     * @param {boolean} selected 目标选择状态。
     * @returns {void} 通过事件传递选择意图。
     */
    toggleSelection(selected) {
      this.$emit('toggle-select', {
        sourceId: this.record.definition.id,
        selected
      });
    },

    /**
     * 请求把当前已启用数据源设为默认源。
     * 触发来源: 默认源开关 change。
     * 边界: 只接受打开意图；当前默认源的关闭由禁用状态阻止。
     * 副作用: 资格通过时发出 set-default 事件，不直接修改共享状态。
     *
     * @param {boolean} enabled 默认源开关目标状态。
     * @returns {void} 通过事件传递目标数据源 id。
     */
    setAsDefault(enabled) {
      // 条件分支: 开关不是打开意图或当前记录资格不可用时进入。
      // 执行内容: 不向父组件提交无效默认源切换。
      if (!enabled || this.defaultSwitchDisabled) return;
      this.$emit('set-default', this.record.definition.id);
    },

    /**
     * 请求切换当前数据源启用状态。
     * 触发来源: 启用开关 change。
     * 副作用: 发出 toggle-source 事件，授权和默认源交接由父页面处理。
     *
     * @param {boolean} enabled 目标启用状态。
     * @returns {void} 通过事件传递启停意图。
     */
    toggleSource(enabled) {
      this.$emit('toggle-source', {
        sourceId: this.record.definition.id,
        enabled
      });
    },

    /**
     * 请求重置当前数据源全部缓存。
     * 触发来源: 行尾重置按钮 click。
     * 副作用: 发出 reset-source 事件，确认和 service 修改由父页面完成。
     *
     * @returns {void} 通过事件传递数据源 id。
     */
    resetSource() {
      this.$emit('reset-source', this.record.definition.id);
    },

    /**
     * 请求删除当前数据源。
     * 触发来源: 行尾删除按钮 click。
     * 副作用: 发出 delete-source 事件，删除确认和默认源交接由父页面完成。
     *
     * @returns {void} 通过事件传递数据源 id。
     */
    deleteSource() {
      this.$emit('delete-source', this.record.definition.id);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 数据源列表行 `.source-list-row`。
  样式作用:
  复用 SourceList 提供的列令牌排列选择、字段 Chip、两个开关、操作区和详情箭头。
  保持整行详情入口与内部控件具有清晰交互边界。
*/
.source-list-row {
  /* 使用网格对齐父级表头列。 */
  display: grid;
  /* 读取父级统一列结构，避免表头和记录分别维护宽度。 */
  grid-template-columns: var(--source-list-columns);
  /* 让所有字段和控件垂直居中。 */
  align-items: center;
  /* 读取父级统一列间距。 */
  gap: var(--source-list-column-gap);
  /* 保证桌面单行触控与阅读高度。 */
  min-height: 62px;
  /* 读取父级统一水平内边距。 */
  padding: var(--source-list-inline-padding);
  /* 分隔连续数据源记录。 */
  border-bottom: 1px solid var(--border-color);
  /* 使用主题次级文本色承载非标题字段。 */
  color: var(--text-secondary);
  /* 提示整行空白区域可以进入详情。 */
  cursor: pointer;
  /* 平滑处理悬停背景变化。 */
  transition: background var(--motion-fast);
}

/*
  作用容器: 数据源列表行悬停状态。
  样式作用:
  提示当前整行是可进入详情的交互目标。
*/
.source-list-row:hover {
  /* 使用主题强调弱背景，不引入本地颜色。 */
  background: var(--accent-soft);
}

/*
  作用容器: 键盘聚焦的数据源列表行。
  样式作用:
  为 Enter 进入详情提供明确焦点反馈。
*/
.source-list-row:focus-visible {
  /* 使用主题强调色绘制焦点轮廓。 */
  outline: 2px solid var(--accent);
  /* 将轮廓收进列表边界，避免被父容器裁切。 */
  outline-offset: -2px;
}

/*
  作用容器: 行首选择框 `.source-list-row__selection`。
  样式作用:
  在选择列中央对齐批量选择入口。
*/
.source-list-row__selection {
  /* 在固定选择列中水平居中。 */
  justify-self: center;
}

/*
  作用容器: 数据源名称列 `.source-list-row__name`。
  样式作用:
  允许长名称收缩；手机视口可在名称下方追加紧凑元信息。
*/
.source-list-row__name {
  /* 使用网格组织名称和手机元信息。 */
  display: grid;
  /* 保留名称与手机 Chip 之间的小间距。 */
  gap: 5px;
  /* 允许名称列小于文本固有宽度。 */
  min-width: 0;
  /* 使用主题主文本色强化名称。 */
  color: var(--text-primary);
  /* 强化数据源主名称层级。 */
  font-weight: 600;
}

/*
  作用容器: 数据源名称文本 `.source-list-row__name-text`。
  样式作用:
  在单行列表内安全截断超长名称。
*/
.source-list-row__name-text {
  /* 隐藏超出名称列的文字。 */
  overflow: hidden;
  /* 使用省略号说明名称仍有剩余内容。 */
  text-overflow: ellipsis;
  /* 保持桌面名称单行。 */
  white-space: nowrap;
}

/*
  作用容器: 手机元信息 `.source-list-row__mobile-meta`。
  样式作用:
  桌面和平板隐藏，手机以紧凑 Chip 补充类型、版本和状态。
*/
.source-list-row__mobile-meta {
  /* 默认不重复展示桌面独立字段。 */
  display: none;
}

/*
  作用容器: 数据源不可用原因 `.source-list-row__status-reason`。
  样式作用:
  在名称下显示单行辅助说明，完整内容保留在 title 中且不改变其他记录行结构。
*/
.source-list-row__status-reason {
  /* 使用主题危险色明确当前记录不能参与运行。 */
  color: var(--danger);
  /* 使用辅助字号降低原因相对名称的层级。 */
  font-size: 12px;
  /* 使用普通字重避免与主名称竞争。 */
  font-weight: 400;
  /* 隐藏超出名称列的原因文本。 */
  overflow: hidden;
  /* 使用省略号提示存在完整原因。 */
  text-overflow: ellipsis;
  /* 保持列表原因单行，避免个别长原因显著拉高行高。 */
  white-space: nowrap;
}

/*
  作用容器: 桌面类型、版本和状态 Chip。
  样式作用:
  统一约束 Chip 不撑开网格列。
*/
.source-list-row__kind,
.source-list-row__version,
.source-list-row__status {
  /* 在字段列起点对齐 Chip。 */
  justify-self: start;
  /* 限制 Chip 不超过当前字段列。 */
  max-width: 100%;
  /* 防止 Chip 文案换行破坏单行结构。 */
  white-space: nowrap;
}

/*
  作用容器: 默认源和启用开关列。
  样式作用:
  将两个互不替代的开关稳定居中，并保留事件隔离边界。
*/
.source-list-row__default-switch,
.source-list-row__enabled-switch {
  /* 使用行内弹性容器包裹 Element UI 开关。 */
  display: inline-flex;
  /* 开关在固定列中水平居中。 */
  justify-content: center;
  /* 开关在当前行中垂直居中。 */
  align-items: center;
}

/*
  作用容器: 行尾操作区 `.source-list-row__actions`。
  样式作用:
  并排展示重置和删除，保持操作位于列表末尾且不触发详情导航。
*/
.source-list-row__actions {
  /* 使用弹性布局排列两个操作。 */
  display: flex;
  /* 在操作列中靠右排列。 */
  justify-content: flex-end;
  /* 保持按钮垂直居中。 */
  align-items: center;
  /* 限制内容不撑出操作列。 */
  min-width: 0;
}

/*
  作用容器: 行尾单个操作按钮。
  样式作用:
  缩小 Element UI 默认按钮间距，使两个操作适配稳定操作列。
*/
.source-list-row__action {
  /* 清除文本按钮额外外边距。 */
  margin: 0;
  /* 使用紧凑水平内边距。 */
  padding-right: 5px;
  /* 使用紧凑水平内边距。 */
  padding-left: 5px;
}

/*
  作用容器: 删除操作按钮。
  样式作用:
  使用主题危险色区分不可逆或软删除动作。
*/
.source-list-row__action--delete {
  /* 使用全局危险色，不声明本地硬编码颜色。 */
  color: var(--danger);
}

/*
  作用容器: 详情箭头 `.source-list-row__arrow`。
  样式作用:
  以弱视觉提示整行详情导航方向。
*/
.source-list-row__arrow {
  /* 使用主题弱文本色降低装饰层级。 */
  color: var(--text-muted);
  /* 放大箭头以提高可见性。 */
  font-size: 22px;
  /* 在末列右对齐。 */
  text-align: right;
}

/*
  响应范围: 最大 900px 的平板和窄桌面。
  样式作用:
  与 SourceList 的七列结构同步隐藏版本和详情箭头。
*/
@media (max-width: 900px) {
  /*
    作用容器: 平板版本 Chip 和详情箭头。
    样式作用:
    移除父级网格已经删除的两个字段。
  */
  .source-list-row__version,
  .source-list-row__arrow {
    /* 不参与平板七列布局。 */
    display: none;
  }
}

/*
  响应范围: 最大 640px 的手机视口。
  样式作用:
  使用五列结构，名称列承担三项紧凑元信息，行尾操作只保留图标。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机数据源列表行。
    样式作用:
    提供容纳双层名称信息的最小高度和紧凑字号。
  */
  .source-list-row {
    /* 为名称和三枚 Chip 保留双层高度。 */
    min-height: 70px;
    /* 降低辅助字段字号。 */
    font-size: 12px;
  }

  /*
    作用容器: 手机独立类型、版本和状态列。
    样式作用:
    移除父级手机网格不再包含的独立列。
  */
  .source-list-row__kind,
  .source-list-row__version,
  .source-list-row__status {
    /* 手机改由名称列内紧凑副本展示。 */
    display: none;
  }

  /*
    作用容器: 手机名称列元信息。
    样式作用:
    在名称下方显示类型、版本和状态 Chip，并允许必要时换行。
  */
  .source-list-row__mobile-meta {
    /* 启用紧凑 Chip 弹性布局。 */
    display: flex;
    /* 允许极窄名称列在 Chip 之间换行。 */
    flex-wrap: wrap;
    /* 保留 Chip 之间的视觉间距。 */
    gap: 3px;
  }

  /*
    作用容器: 手机操作按钮文字。
    样式作用:
    只保留图标和无障碍标签，压缩行尾操作宽度。
  */
  .source-list-row__action-text {
    /* 图标已经表达操作，文字在手机隐藏。 */
    display: none;
  }

  /*
    作用容器: 手机行尾操作按钮。
    样式作用:
    使用紧凑图标点击区适配五列布局。
  */
  .source-list-row__action {
    /* 采用对称紧凑内边距。 */
    padding: 5px 4px;
  }
}
</style>
