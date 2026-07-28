<template>
  <!--
    SourceBasicInfo 组件渲染树

    [DEFAULT] ele(section.source-basic-info.theme-surface)
    │  - condition:
    │      record 存在时由详情页渲染。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      展示数据源身份、导入、运行、能力及在线更新信息。
    │  - params:
    │      -- record：共享 SourceManagerState 中的数据源记录。
    │      -- isDefault：当前记录是否为默认数据源。
    │      -- authorizationStatus：当前版本和脚本文本对应的有效授权状态。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(dl.source-basic-info__grid)
    │  - condition:
    │      默认渲染，并循环 basicFields。
    │  - type:
    │      原生标签
    │      标签名称: dl
    │  - description:
    │      使用字段定义数组统一渲染基本信息。
    │  - params:
    │      -- basicFields：当前记录派生的标签和值。
    │  - events:
    │      无
    │
    ├─ [IF isRemoteSource] ele(div.source-basic-info__remote)
    │  - condition:
    │      importMethod 为 remote 时渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      展示在线地址和远程版本检查结果，不与本地更新时间混淆。
    │  - params:
    │      -- remoteFields：在线导入专属字段。
    │  - events:
    │      无
    │
    └─ [DEFAULT] ele(div.source-basic-info__capabilities)
       - condition:
           默认渲染；能力为空时显示明确空文案。
       - type:
           原生标签
           标签名称: div
       - description:
           展示当前脚本声明支持的页面能力。
       - params:
           -- enabledCapabilities：统一能力定义筛选结果。
       - events:
           无
  -->
  <!--
    [DEFAULT] ele(section.source-basic-info.theme-surface)
    - condition:
        record 存在时由数据源详情页渲染。
    - type:
        原生标签
        标签名称: section
    - description:
        数据源基本信息面板根容器，组合通用字段、在线字段和页面能力。
    - params:
        -- record：父级传入的共享数据源记录。
        -- isDefault：当前记录是否为默认数据源。
        -- authorizationStatus：父级统一授权评估得到的有效展示状态。
    - events:
        无
  -->
  <section class="source-basic-info theme-surface">
    <!--
      [DEFAULT] ele(h2.source-basic-info__title)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: h2
      - description:
          基本信息区标题，建立详情区块层级。
      - params:
          无
      - events:
          无
    -->
    <h2 class="source-basic-info__title">基本信息</h2>

    <!--
      [DEFAULT] ele(dl.source-basic-info__grid)
      - condition:
          默认渲染，并循环 basicFields。
      - type:
          原生标签
          标签名称: dl
      - description:
          每个字段条目展示一个稳定标签和当前共享状态值。
      - params:
          -- basicFields：由 record、isDefault 和 authorizationStatus 派生的字段数组。
      - events:
          无
    -->
    <dl class="source-basic-info__grid">
      <!--
        [DEFAULT] ele(div.source-basic-info__field)
        - condition:
            对 basicFields 中每条字段定义循环渲染。
        - type:
            原生标签
            标签名称: div
        - description:
            单个基本信息字段，组合字段名称、值和可选状态样式类。
        - params:
            -- field.key：字段唯一标识，用作 v-for key。
            -- field.label：字段展示名称。
            -- field.value：字段展示值。
            -- field.valueClass：运行状态字段可选样式类。
        - events:
            无
      -->
      <div v-for="field in basicFields" :key="field.key" class="source-basic-info__field">
        <dt>{{ field.label }}</dt>
        <dd :class="field.valueClass">{{ field.value }}</dd>
      </div>
    </dl>

    <!--
      [IF isRemoteSource] ele(div.source-basic-info__remote)
      - condition:
          当前记录通过在线地址导入时渲染。
      - type:
          原生标签
          标签名称: div
      - description:
          独立展示在线版本字段，避免与本地脚本更新时间混淆。
      - params:
          -- remoteFields：在线地址、更新状态和远程时间字段。
      - events:
          无
    -->
    <div v-if="isRemoteSource" class="source-basic-info__remote">
      <!--
        [DEFAULT] ele(h3.source-basic-info__remote-title)
        - condition:
            isRemoteSource 为 true 后默认渲染。
        - type:
            原生标签
            标签名称: h3
        - description:
            在线导入与更新子区标题，用于区分远程字段和本地脚本字段。
        - params:
            无
        - events:
            无
      -->
      <h3 class="source-basic-info__remote-title">在线导入与更新</h3>
      <!--
        [DEFAULT] ele(dl.source-basic-info__grid)
        - condition:
            isRemoteSource 为 true 后默认渲染，并循环 remoteFields。
        - type:
            原生标签
            标签名称: dl
        - description:
            在线导入专属字段列表，展示地址、版本和检查时间。
        - params:
            -- remoteFields：由当前记录远程状态派生的字段数组。
        - events:
            无
      -->
      <dl class="source-basic-info__grid">
        <!--
          [DEFAULT] ele(div.source-basic-info__field)
          - condition:
              对 remoteFields 中每条在线字段定义循环渲染。
          - type:
              原生标签
              标签名称: div
          - description:
              单个在线信息字段，按标签和值展示远程状态。
          - params:
              -- field.key：字段唯一标识。
              -- field.label：字段展示名称。
              -- field.value：格式化后的远程字段值。
          - events:
              无
        -->
        <div v-for="field in remoteFields" :key="field.key" class="source-basic-info__field">
          <dt>{{ field.label }}</dt>
          <dd>{{ field.value }}</dd>
        </div>
      </dl>
    </div>

    <!--
      [DEFAULT] ele(div.source-basic-info__capabilities)
      - condition:
          默认渲染；能力数组为空时显示“暂未声明页面能力”。
      - type:
          原生标签
          标签名称: div
      - description:
          展示脚本契约声明的可用页面能力。
      - params:
          -- enabledCapabilities：settingsService 按统一定义筛选的能力数组。
      - events:
          无
    -->
    <div class="source-basic-info__capabilities">
      <!--
        [DEFAULT] ele(h3.source-basic-info__capabilities-title)
        - condition:
            默认渲染。
        - type:
            原生标签
            标签名称: h3
        - description:
            页面能力子区标题，标明下方内容来自脚本契约声明。
        - params:
            无
        - events:
            无
      -->
      <h3 class="source-basic-info__capabilities-title">页面能力</h3>
      <!--
        [IF enabledCapabilities.length] ele(div.source-basic-info__capability-list)
        - condition:
            enabledCapabilities 至少包含一项已启用能力时渲染。
        - type:
            原生标签
            标签名称: div
        - description:
            页面能力 chip 列表，按统一能力顺序展示当前脚本支持项。
        - params:
            -- enabledCapabilities：service 筛选后的已启用能力定义数组。
        - events:
            无
      -->
      <div v-if="enabledCapabilities.length" class="source-basic-info__capability-list">
        <!--
          [DEFAULT] ele(span.source-basic-info__capability)
          - condition:
              对 enabledCapabilities 中每项能力循环渲染。
          - type:
              原生标签
              标签名称: span
          - description:
              单个页面能力 chip，展示能力名称。
          - params:
              -- capability.key：能力唯一标识。
              -- capability.label：能力展示名称。
          - events:
              无
        -->
        <span
          v-for="capability in enabledCapabilities"
          :key="capability.key"
          class="source-basic-info__capability"
        >
          {{ capability.label }}
        </span>
      </div>
      <!--
        [ELSE] ele(p.source-basic-info__empty)
        - condition:
            enabledCapabilities 为空，没有已声明页面能力时渲染。
        - type:
            原生标签
            标签名称: p
        - description:
            页面能力空状态，避免空白区域被误解为加载失败。
        - params:
            无
        - events:
            无
      -->
      <p v-else class="source-basic-info__empty">暂未声明页面能力</p>
    </div>
  </section>
</template>

<script>
/*
  SourceBasicInfo.vue 模块说明

  - 文件职责:
      展示数据源身份、用户启用意愿、当前可运行状态、授权、在线更新和页面能力字段。
      组件只派生详情字段，不修改 SourceManagerState 或发起数据源操作。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      settingsService exports: 提供来源类型、在线导入枚举和能力筛选。
      settingsDisplay exports: 提供统一文案、状态和时间格式化。
  - 模块级常量:
      AVAILABLE_UPDATE_TEXT: string，在线源存在新版本时显示的状态文案。
      LATEST_UPDATE_TEXT: string，在线源没有新版本时显示的状态文案。
      SOURCE_ENABLED_TEXT: string，用户启用意愿为 true 时的展示文案。
      SOURCE_DISABLED_TEXT: string，用户启用意愿为 false 时的展示文案。
      EMPTY_STATUS_REASON_TEXT: string，当前状态无需错误说明时的展示文案。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      默认 Vue 组件配置: object，供 SourceDetailView 渲染数据源基本信息。
*/
import {
  // 导入来源: ../../services/settingsService。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 判断当前记录是否通过在线地址导入。
  IMPORT_METHOD,

  // 导入来源: ../../services/settingsService。
  // 导入内容: getEnabledCapabilities 页面能力筛选函数。
  // 文件作用: 按统一能力定义筛选当前脚本已启用的能力。
  getEnabledCapabilities
} from '../../services/settingsService';

import {
  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: AUTHORIZATION_STATUS_TEXT 授权状态文案映射。
  // 文件作用: 把内部授权状态转换成基本信息区展示文案。
  AUTHORIZATION_STATUS_TEXT,

  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: IMPORT_METHOD_TEXT 导入方式文案映射。
  // 文件作用: 把内部导入方式转换成用户可读文本。
  IMPORT_METHOD_TEXT,

  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: SOURCE_KIND_TEXT 数据源类型文案映射。
  // 文件作用: 把系统源和自定义源枚举转换成展示文本。
  SOURCE_KIND_TEXT,

  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: formatSettingsDate 设置时间格式化函数。
  // 文件作用: 统一格式化导入、更新和检测时间。
  formatSettingsDate,

  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: getSourceRuntimeStatusKey 运行状态键函数。
  // 文件作用: 生成状态文字使用的 CSS 修饰类。
  getSourceRuntimeStatusKey,

  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: getSourceRuntimeStatusReason 状态原因函数。
  // 文件作用: 详情字段优先展示 Provider 未就绪原因，再展示健康检测失败原因。
  getSourceRuntimeStatusReason,

  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: getSourceRuntimeStatusText 运行状态文案函数。
  // 文件作用: 生成正常、检测中、不可用或已关闭的用户文案。
  getSourceRuntimeStatusText
} from '../../utils/settingsDisplay';

// 类型: string。
// 作用: 在线源存在新版本时显示统一状态文案，影响 remoteFields 更新状态字段。
const AVAILABLE_UPDATE_TEXT = '发现可用更新';

// 类型: string。
// 作用: 在线源未发现新版本时显示统一状态文案，影响 remoteFields 更新状态字段。
const LATEST_UPDATE_TEXT = '当前已是最新版本';

// 类型: string。
// 作用: 明确表达用户已允许当前记录参与运行，不暗示 Provider 已经可以执行。
const SOURCE_ENABLED_TEXT = '已启用';

// 类型: string。
// 作用: 明确表达用户已关闭当前记录，和健康不可用状态分离。
const SOURCE_DISABLED_TEXT = '已关闭';

// 类型: string。
// 作用: 当前关闭、正常或检测中无需错误解释时，避免“不可用原因”字段出现空白。
const EMPTY_STATUS_REASON_TEXT = '无';

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools 和错误堆栈识别基本信息区。
  name: 'SourceBasicInfo',

  props: {
    // 类型: object。
    // 来源: SourceDetailView 传入的共享数据源记录。
    // 作用: 提供身份、导入、运行、授权、缓存和页面能力的展示数据。
    // 字段: definition，object，提供 id、类型、版本、导入方式、时间、远程地址和能力声明。
    // 字段: runtime，object，提供检测时间、更新状态和在线版本信息。
    record: { type: Object, required: true },
    // 类型: boolean。
    // 来源: SourceDetailView 根据共享 defaultSourceId 与当前记录 id 比较后传入。
    // 作用: 控制“默认数据源”字段展示值。
    // true: 展示“是”。
    // false: 展示“否”。
    isDefault: { type: Boolean, default: false },
    // 类型: string。
    // 来源: SourceDetailView 通过 settingsService 统一授权评估结果传入。
    // 作用: 展示当前版本和脚本文本真正有效的授权状态，不直接信任保存态 authorization.status。
    authorizationStatus: { type: String, default: '' }
  },

  computed: {
    /**
     * 计算数据源基本信息字段数组。
     * 数据来源: record.definition、record.runtime、authorizationStatus 和 isDefault。
     * 字段顺序在此集中维护，模板只负责循环渲染，不修改共享状态。
     * 副作用: 无，每次根据当前 props 返回新的字段定义数组。
     *
     * @returns {Array<object>} 基本信息标签和值定义。
     * @returns {string} return[].key 字段唯一标识，用作 v-for key。
     * @returns {string} return[].label 用户可读字段名称。
     * @returns {string} return[].value 经过映射或格式化的展示值。
     * @returns {string|undefined} return[].valueClass 运行状态字段使用的样式类。
     */
    basicFields() {
      // 返回值类型: Array<object>。
      // 作用: 给基本信息 dl 提供稳定顺序的字段定义，避免模板散落格式化分支。
      return [
        // 数据源唯一标识，用于用户核对脚本身份。
        { key: 'id', label: '数据源 ID', value: this.record.definition.id },
        // 数据源来源类型，未知枚举使用“数据源”兜底。
        { key: 'sourceKind', label: '来源类型', value: SOURCE_KIND_TEXT[this.record.definition.sourceKind] || '数据源' },
        // 当前本地脚本版本，用于和在线可用版本区分。
        { key: 'version', label: '当前版本', value: this.record.definition.version },
        // 数据源导入方式，未知枚举使用“其他方式”兜底。
        { key: 'importMethod', label: '导入方式', value: IMPORT_METHOD_TEXT[this.record.definition.importMethod] || '其他方式' },
        // 首次导入时间，统一格式化缺失值和时间显示。
        { key: 'importedAt', label: '导入时间', value: formatSettingsDate(this.record.definition.importedAt) },
        // 本地脚本最后更新时间，不与远程版本更新时间混淆。
        { key: 'lastUpdatedAt', label: '本地脚本最后更新', value: formatSettingsDate(this.record.definition.lastUpdatedAt) },
        // 三目条件: enabled 为 true 只表示用户允许参与运行，false 表示用户主动关闭；该字段不代替可运行判断。
        { key: 'enabledStatus', label: '启用状态', value: this.record.runtime.enabled ? SOURCE_ENABLED_TEXT : SOURCE_DISABLED_TEXT },
        // 当前运行状态按关闭、Provider 就绪和健康三态统一优先级展示，同时提供状态色修饰类。
        { key: 'runtimeStatus', label: '当前状态', value: getSourceRuntimeStatusText(this.record), valueClass: `source-basic-info__status--${getSourceRuntimeStatusKey(this.record)}` },
        // Provider 未就绪或健康检测失败时展示统一原因；其他状态明确显示“无”。
        { key: 'runtimeStatusReason', label: '不可用原因', value: getSourceRuntimeStatusReason(this.record) || EMPTY_STATUS_REASON_TEXT },
        // 最近一次健康检测时间，帮助用户判断状态新鲜度。
        { key: 'lastCheckedAt', label: '最后检测时间', value: formatSettingsDate(this.record.runtime.lastCheckedAt) },
        // 三目条件: isDefault 是否为 true；true 展示“是”，false 展示“否”。
        { key: 'defaultSource', label: '默认数据源', value: this.isDefault ? '是' : '否' },
        // 当前有效运行授权状态，未知状态使用“等待授权”兜底，不回退到可能失效的保存态状态。
        { key: 'authorization', label: '运行授权', value: AUTHORIZATION_STATUS_TEXT[this.authorizationStatus] || '等待授权' }
      ];
    },

    /**
     * 判断当前记录是否通过在线地址导入。
     * 数据来源: record.definition.importMethod。
     * true 显示在线导入和更新区，false 隐藏仅适用于远程源的字段。
     * 副作用: 无，只派生远程信息区可见性。
     *
     * @returns {boolean} 当前记录是否使用 remote 导入方式。
     */
    isRemoteSource() {
      return this.record.definition.importMethod === IMPORT_METHOD.remote;
    },

    /**
     * 计算在线导入专属字段数组。
     * 数据来源: record.definition.remoteUrl 和 record.runtime 在线更新状态。
     * 副作用: 无，只派生展示字段，不发起远程检查或修改共享状态。
     *
     * @returns {Array<object>} 在线导入专属标签和值定义。
     * @returns {string} return[].key 字段唯一标识。
     * @returns {string} return[].label 用户可读字段名称。
     * @returns {string} return[].value 格式化后的字段值。
     */
    remoteFields() {
      // 返回值类型: Array<object>。
      // 作用: 给在线导入区提供稳定字段顺序，并集中处理空值和状态文案。
      return [
        // 在线导入地址缺失时展示明确空文案。
        { key: 'remoteUrl', label: '在线导入地址', value: this.record.definition.remoteUrl || '暂无地址' },
        // 三目条件: updateAvailable 是否为 true；true 提示可更新，false 提示已是最新。
        { key: 'updateStatus', label: '更新状态', value: this.record.runtime.updateAvailable ? AVAILABLE_UPDATE_TEXT : LATEST_UPDATE_TEXT },
        // 远程可用版本缺失时说明当前没有新版本。
        { key: 'availableVersion', label: '可用版本', value: this.record.runtime.availableVersion || '暂无新版本' },
        // 远程版本更新时间，统一格式化缺失值和时间显示。
        { key: 'availableVersionUpdatedAt', label: '在线版本更新时间', value: formatSettingsDate(this.record.runtime.availableVersionUpdatedAt) },
        // 最近一次在线更新检查时间，帮助用户判断结果新鲜度。
        { key: 'lastUpdateCheckedAt', label: '最后检查更新时间', value: formatSettingsDate(this.record.runtime.lastUpdateCheckedAt) }
      ];
    },

    /**
     * 计算当前数据源已启用的页面能力。
     * 数据来源: record.definition.capabilities。
     * 通过 service 统一定义筛选，保证详情展示顺序与页面契约保持一致。
     * 副作用: 无，只返回统一能力定义的新数组。
     *
     * @returns {Array<object>} 当前脚本声明为启用的页面能力定义。
     */
    enabledCapabilities() {
      // 返回值类型: Array<object>。
      // 作用: 给能力 chip 列表提供统一筛选结果，空数组触发明确空状态。
      return getEnabledCapabilities(this.record.definition.capabilities);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 基本信息面板 `.source-basic-info`。
  样式作用:
  以连续内容面板承载身份、在线信息和页面能力。
*/
.source-basic-info {
  /* 设置面板内部安全留白。 */
  padding: 22px;
}

/*
  作用容器: 基本信息二级标题。
  样式作用:
  建立详情区块标题层级。
*/
.source-basic-info__title {
  /* 清除标题默认外边距并保留下方空间。 */
  margin: 0 0 18px;
  /* 使用详情区块标题字号。 */
  font-size: 18px;
  /* 使用主题主文本色。 */
  color: var(--text-primary);
}

/*
  作用容器: 基本信息字段网格。
  样式作用:
  桌面端两列排列字段，长值可在自身列内换行。
*/
.source-basic-info__grid {
  /* 使用两列 Grid 提升桌面信息扫描效率。 */
  display: grid;
  /* 每列允许缩小到零，避免 URL 撑破页面。 */
  grid-template-columns: repeat(2, minmax(0, 1fr));
  /* 设置字段行列间距。 */
  gap: 15px 24px;
  /* 清除 dl 默认外边距。 */
  margin: 0;
}

/*
  作用容器: 单个信息字段。
  样式作用:
  纵向排列字段名称和值。
*/
.source-basic-info__field {
  /* 使用纵向 Grid 排列 dt 和 dd。 */
  display: grid;
  /* 设置标签和值之间的距离。 */
  gap: 5px;
  /* 防止长值撑开网格列。 */
  min-width: 0;
}

/*
  作用容器: 信息字段标签。
  样式作用:
  以弱文本提示字段含义。
*/
.source-basic-info__field dt {
  /* 使用较小字号显示字段名称。 */
  font-size: 12px;
  /* 使用主题弱文本色。 */
  color: var(--text-muted);
}

/*
  作用容器: 信息字段值。
  样式作用:
  展示真实记录值并允许 URL 等长文本断行。
*/
.source-basic-info__field dd {
  /* 清除 dd 默认外边距。 */
  margin: 0;
  /* 使用主文本色。 */
  color: var(--text-primary);
  /* 允许长 URL 和 id 在自身列内安全断行。 */
  overflow-wrap: anywhere;
  /* 提升多行值的可读性。 */
  line-height: 1.55;
}

/*
  作用容器: 正常状态字段。
  样式作用:
  使用成功色表达当前数据源可用。
*/
.source-basic-info__field .source-basic-info__status--normal { color: var(--success); }
/*
  作用容器: 检测中状态字段。
  样式作用:
  使用强调色表达进行中的临时状态。
*/
.source-basic-info__field .source-basic-info__status--checking { color: var(--accent); }
/*
  作用容器: 不可用状态字段。
  样式作用:
  使用错误色提醒当前数据源不能使用。
*/
.source-basic-info__field .source-basic-info__status--unavailable { color: var(--danger); }
/*
  作用容器: 已关闭状态字段。
  样式作用:
  使用弱文本色区别于健康状态。
*/
.source-basic-info__field .source-basic-info__status--closed { color: var(--text-muted); }

/*
  作用容器: 在线导入信息区。
  样式作用:
  使用上边界与通用基本信息分区，防止时间字段语义混淆。
*/
.source-basic-info__remote,
.source-basic-info__capabilities {
  /* 与前一信息区保留垂直距离。 */
  margin-top: 22px;
  /* 使用上边框建立区块边界。 */
  border-top: 1px solid var(--border-color);
  /* 在分隔线下方保留标题空间。 */
  padding-top: 18px;
}

/*
  作用容器: 在线信息与能力三级标题。
  样式作用:
  标明当前子区内容。
*/
.source-basic-info__remote h3,
.source-basic-info__capabilities h3 {
  /* 清除默认边距并保留下方空间。 */
  margin: 0 0 14px;
  /* 使用紧凑三级标题字号。 */
  font-size: 15px;
  /* 使用主题主文本色。 */
  color: var(--text-primary);
}

/*
  作用容器: 页面能力列表。
  样式作用:
  以紧凑 chip 展示多个独立能力。
*/
.source-basic-info__capability-list {
  /* 使用弹性布局让能力按内容宽度排列。 */
  display: flex;
  /* 窄屏允许能力自然换行。 */
  flex-wrap: wrap;
  /* 设置能力 chip 间距。 */
  gap: 8px;
}

/*
  作用容器: 单个页面能力 chip。
  样式作用:
  以低噪声强调色标识脚本声明能力。
*/
.source-basic-info__capability {
  /* 设置 chip 内边距。 */
  padding: 4px 9px;
  /* 使用胶囊圆角。 */
  border-radius: 999px;
  /* 使用浅强调色背景。 */
  background: var(--accent-soft);
  /* 使用强调色文字。 */
  color: var(--accent);
  /* 使用较小字号降低视觉占用。 */
  font-size: 12px;
}

/*
  作用容器: 无页面能力说明。
  样式作用:
  避免能力区空白造成误解。
*/
.source-basic-info__empty {
  /* 清除段落默认外边距。 */
  margin: 0;
  /* 使用弱文本色。 */
  color: var(--text-muted);
}

/*
  作用容器: 手机。
  响应式断点: max-width 640px。
  样式作用:
  基本信息降为单列并收紧面板留白。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机基本信息面板。
    样式作用:
    提升窄屏可用宽度。
  */
  .source-basic-info {
    /* 缩小手机内边距。 */
    padding: 17px 14px;
  }

  /*
    作用容器: 手机字段网格。
    样式作用:
    单列展示，避免字段值过窄。
  */
  .source-basic-info__grid {
    /* 手机使用单列字段。 */
    grid-template-columns: minmax(0, 1fr);
    /* 收紧字段纵向间距。 */
    gap: 13px;
  }
}
</style>
