<template>
  <!--
    SourceList 组件渲染树

    [DEFAULT] ele(section.source-list.theme-surface)
    │  - condition:
    │      数据源管理主页面默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      承载单行数据源表头、记录行或当前分类空状态。
    │  - params:
    │      -- records、defaultSourceId、selectedSourceIds、emptyDescription：由 SourceManagementPanel 传入。
    │  - events:
    │      @toggle-select-all、@toggle-select、@set-default、@toggle-source、@reset-source、@delete-source、@open-detail 向父页面透传列表交互。
    │
    ├─ [IF records.length] ele(div.source-list__content)
    │  - condition:
    │      当前来源筛选至少存在一条可见记录时渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      组合桌面表头和循环生成的 SourceListRow。
    │  - params:
    │      -- records：当前筛选记录数组。
    │  - events:
    │      无
    │
    │  ├─ [DEFAULT] ele(div.source-list__header)
    │  │  - condition:
    │  │      有记录时渲染，由 CSS 在手机隐藏。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: div
    │  │  - description:
    │  │      使用与列表行一致的响应式列定义展示全选入口和字段名称。
    │  │  - params:
    │  │      无
    │  │  - events:
    │  │      无
    │  │
    │  └─ [DEFAULT] ele(SourceListRow)
    │     - condition:
    │         records 每个条目循环渲染一行。
    │     - type:
    │         自定义组件
    │         相对位置: ./SourceListRow.vue
    │     - description:
    │         展示单条记录并发出选择、默认源、启停、重置、删除和详情事件。
    │     - params:
    │         -- record、isDefault、selected：当前记录、默认源和选择派生结果。
    │     - events:
    │         @toggle-select、@set-default、@toggle-source、@reset-source、@delete-source、@open-detail 透传给 SourceManagementPanel。
    │
    └─ [ELSE] ele(el-empty)
       - condition:
           当前来源筛选没有可见记录时渲染。
       - type:
           第三方组件
           组件库: Element UI
           组件名称: el-empty
       - description:
           展示当前分类对应的可操作空状态说明。
       - params:
           -- emptyDescription、emptyImageSize：空状态文案和集中尺寸。
       - events:
           无
  -->
  <!--
    [DEFAULT] ele(section.source-list.theme-surface)
    - condition:
        数据源管理主页面默认渲染。
    - type:
        原生标签
        标签名称: section
    - description:
        单行数据源列表边界容器。
    - params:
        -- records、defaultSourceId、selectedSourceIds、emptyDescription：由父页面传入。
    - events:
        @open-detail
            - description:
                行组件请求打开详情时触发，并原样透传数据源 id。
            - methods:
                $emit('open-detail', $event)
                    -- $event：SourceListRow 发出的数据源 id。
        @toggle-source
            - description:
                行组件请求切换启用状态时触发，并原样透传切换参数。
            - methods:
                $emit('toggle-source', $event)
                    -- $event：SourceListRow 发出的 sourceId 与 enabled 对象。
        @toggle-select-all
            - description:
                用户点击表头全选框时触发，提交当前筛选全部可见 id 和目标选择状态。
            - methods:
                toggleSelectAll(selected)
                    -- selected：当前筛选目标全选状态。
        @toggle-select
            - description:
                行组件选择状态变化时触发并透传给父页面。
            - methods:
                $emit('toggle-select', $event)
                    -- $event：sourceId 与 selected 对象。
        @set-default
            - description:
                行组件请求设置默认源时触发并透传数据源 id。
            - methods:
                $emit('set-default', $event)
                    -- $event：目标数据源 id。
        @reset-source
            - description:
                行组件请求重置全部缓存时触发并透传数据源 id。
            - methods:
                $emit('reset-source', $event)
                    -- $event：目标数据源 id。
        @delete-source
            - description:
                行组件请求删除时触发并透传数据源 id。
            - methods:
                $emit('delete-source', $event)
                    -- $event：目标数据源 id。
  -->
  <section class="source-list theme-surface" aria-label="数据源列表">
    <!--
      [IF records.length] ele(div.source-list__content)
      - condition:
          当前分类存在记录时渲染。
      - type:
          原生标签
          标签名称: div
      - description:
          组合响应式表头和单行记录。
      - params:
          -- records：当前分类记录数组。
      - events:
          无
    -->
    <div v-if="records.length" class="source-list__content">
      <!--
        [DEFAULT] ele(div.source-list__header)
        - condition:
            有记录时渲染，由 CSS 在手机隐藏。
        - type:
            原生标签
            标签名称: div
        - description:
            展示字段名称，并与 SourceListRow 使用相同列规则。
        - params:
            无
        - events:
            无
      -->
      <div class="source-list__header">
        <!--
          [DEFAULT] ele(el-checkbox.source-list__select-all)
          - condition:
              当前筛选存在可见记录时默认渲染。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-checkbox
          - description:
              当前筛选全选框，完整选中时勾选，部分选中时显示半选状态。
          - params:
              -- allVisibleSelected：当前筛选是否全部选中。
              -- partiallyVisibleSelected：当前筛选是否部分选中。
          - events:
              @change
                  - description:
                      用户切换当前筛选全选状态时触发。
                  - methods:
                      toggleSelectAll(selected)
                          -- selected：目标全选状态。
        -->
        <el-checkbox
          class="source-list__select-all"
          :value="allVisibleSelected"
          :indeterminate="partiallyVisibleSelected"
          aria-label="选择当前分类全部数据源"
          @change="toggleSelectAll"
        />
        <!--
          [DEFAULT] ele(span.source-list__header-name)
          - condition:
              有记录且桌面或平板表头可见时渲染。
          - type:
              原生标签
              标签名称: span
          - description:
              数据源名称列表头，与列表行名称列对齐。
          - params:
              无
          - events:
              无
        -->
        <span class="source-list__header-name">数据源</span>
        <!--
          [DEFAULT] ele(span.source-list__header-kind)
          - condition:
              有记录且桌面或平板表头可见时渲染。
          - type:
              原生标签
              标签名称: span
          - description:
              数据源类型列表头；其余静态表头使用同一数据来源和无事件边界。
          - params:
              无
          - events:
              无
        -->
        <span class="source-list__header-kind">类型</span>
        <!--
          [DEFAULT] ele(span.source-list__header-version)
          - condition:
              有记录且桌面表头可见时渲染，平板和手机由 CSS 隐藏。
          - type:
              原生标签
              标签名称: span
          - description:
              脚本版本列表头，与桌面版本 Chip 列对齐。
          - params:
              无
          - events:
              无
        -->
        <span class="source-list__header-version">版本</span>
        <!--
          [DEFAULT] ele(span.source-list__header-status)
          - condition:
              有记录且桌面或平板表头可见时渲染。
          - type:
              原生标签
              标签名称: span
          - description:
              运行状态列表头，与状态 Chip 列对齐。
          - params:
              无
          - events:
              无
        -->
        <span class="source-list__header-status">状态</span>
        <!--
          [DEFAULT] ele(span.source-list__header-default)
          - condition:
              有记录且桌面或平板表头可见时渲染。
          - type:
              原生标签
              标签名称: span
          - description:
              默认源互斥开关列表头。
          - params:
              无
          - events:
              无
        -->
        <span class="source-list__header-default">默认源</span>
        <!--
          [DEFAULT] ele(span.source-list__header-enabled)
          - condition:
              有记录且桌面或平板表头可见时渲染。
          - type:
              原生标签
              标签名称: span
          - description:
              数据源启用开关列表头。
          - params:
              无
          - events:
              无
        -->
        <span class="source-list__header-enabled">启用</span>
        <!--
          [DEFAULT] ele(span.source-list__header-actions)
          - condition:
              有记录且桌面或平板表头可见时渲染。
          - type:
              原生标签
              标签名称: span
          - description:
              行尾重置和删除快捷操作列表头。
          - params:
              无
          - events:
              无
        -->
        <span class="source-list__header-actions">操作</span>
        <!--
          [DEFAULT] ele(span.source-list__header-arrow)
          - condition:
              有记录且桌面表头可见时渲染，窄视口由 CSS 隐藏。
          - type:
              原生标签
              标签名称: span
          - description:
              详情箭头占位表头，使前八列与列表行保持对齐。
          - params:
              无
          - events:
              无
        -->
        <span class="source-list__header-arrow" aria-hidden="true"></span>
      </div>

      <!--
        [DEFAULT] ele(SourceListRow)
        - condition:
            records 每个条目循环渲染一行。
        - type:
            自定义组件
            相对位置: ./SourceListRow.vue
        - description:
            展示单条记录并把行交互透传给父页面。
        - params:
            -- record：当前记录；-- isDefault：当前记录是否为默认源；-- selected：当前记录是否被选中。
        - events:
            @open-detail
                - description:
                    行组件请求打开详情时触发，并向上透传数据源 id。
                - methods:
                    $emit('open-detail', $event)
                        -- $event：当前数据源 id。
            @toggle-source
                - description:
                    行组件请求切换启用状态时触发，并向上透传切换参数。
                - methods:
                    $emit('toggle-source', $event)
                        -- $event：sourceId 与 enabled 对象。
            @toggle-select
                - description:
                    行选择框变化时触发，并向上透传 sourceId 和目标选择状态。
                - methods:
                    $emit('toggle-select', $event)
                        -- $event：sourceId 与 selected 对象。
            @set-default
                - description:
                    行默认源开关打开时触发，并向上透传数据源 id。
                - methods:
                    $emit('set-default', $event)
                        -- $event：目标数据源 id。
            @reset-source
                - description:
                    行重置按钮点击时触发，并向上透传数据源 id。
                - methods:
                    $emit('reset-source', $event)
                        -- $event：目标数据源 id。
            @delete-source
                - description:
                    行删除按钮点击时触发，并向上透传数据源 id。
                - methods:
                    $emit('delete-source', $event)
                        -- $event：目标数据源 id。
      -->
      <SourceListRow
        v-for="record in records"
        :key="record.definition.id"
        :record="record"
        :is-default="record.definition.id === defaultSourceId"
        :selected="selectedSourceIdSet.has(record.definition.id)"
        @toggle-select="$emit('toggle-select', $event)"
        @set-default="$emit('set-default', $event)"
        @open-detail="$emit('open-detail', $event)"
        @toggle-source="$emit('toggle-source', $event)"
        @reset-source="$emit('reset-source', $event)"
        @delete-source="$emit('delete-source', $event)"
      />
    </div>

    <!--
      [ELSE] ele(el-empty.source-list__empty)
      - condition:
          当前来源筛选没有记录时渲染。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-empty
      - description:
          使用父页面提供的分类说明引导用户导入或恢复数据源。
      - params:
          -- emptyDescription、emptyImageSize：空状态文案和插图尺寸。
      - events:
          无
    -->
    <el-empty
      v-else
      class="source-list__empty"
      :description="emptyDescription"
      :image-size="emptyImageSize"
    />
  </section>
</template>

<script>
/*
  SourceList.vue 模块说明

  - 文件职责:
      渲染数据源管理表头和记录列表，并把批量选择及单行操作意图透传给 SourceManagementPanel。
      统一定义桌面、平板和手机的父子网格列，避免表头与 SourceListRow 分别维护响应式结构。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SourceListRow: 自定义组件，渲染单条响应式数据源列表行。

  - 模块级常量:
      EMPTY_IMAGE_SIZE: number，数据源分类空状态插图尺寸。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceList: Vue component，展示当前分类数据源列表并透传管理操作。
*/

// 导入来源: ./SourceListRow.vue。
// 导入内容: SourceListRow 单行数据源组件。
// 文件作用: 按 records 循环渲染数据源字段、选择、默认源、启停和行尾操作。
import SourceListRow from './SourceListRow.vue';

// 类型: number。
// 作用: 统一数据源分类空状态插图尺寸，避免模板使用魔法数字。
const EMPTY_IMAGE_SIZE = 96;

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools 和错误堆栈识别数据源列表。
  name: 'SourceList',

  components: {
    // 组件: SourceListRow 单行数据源组件。
    // 作用: 循环展示每条数据源记录，并把详情和启停意图交给当前列表透传。
    SourceListRow
  },

  props: {
    // 类型: Array<object>。
    // 来源: SourceManagementPanel 按来源分类派生。
    // 作用: 驱动单行列表；为空时显示当前分类空状态。
    // 条目字段: definition.id，string，用作列表行 key 并判断默认源。
    records: {
      type: Array,
      /**
       * 创建缺省记录数组。
       * 纯函数: 每个组件实例返回独立数组，不读取或修改 SourceManagerState。
       *
       * @returns {Array<object>} 空数据源记录数组。
       */
      default() {
        return [];
      }
    },

    // 类型: string。
    // 来源: SourceManagerState.defaultSourceId。
    // 作用: 派生每行默认源状态。
    defaultSourceId: {
      type: String,
      default: ''
    },

    // 类型: string。
    // 来源: SourceManagementPanel 根据来源分类生成。
    // 作用: 当前分类没有记录时给用户明确下一步提示。
    emptyDescription: {
      type: String,
      default: '暂无数据源'
    },

    // 类型: Array<string>。
    // 来源: SourceManagementPanel 页面局部选择状态。
    // 作用: 派生当前筛选全选、半选和每行选中状态，不写入 SourceManagerState。
    selectedSourceIds: {
      type: Array,
      /**
       * 创建缺省选择数组。
       * 纯函数: 每个组件实例返回独立数组，不共享父页面选择状态。
       *
       * @returns {Array<string>} 空数据源 id 数组。
       */
      default() {
        return [];
      }
    }
  },

  computed: {
    /**
     * 计算当前筛选可见数据源 id。
     * 数据来源: records。
     * 纯函数: 只派生全选事件参数，不修改记录或父级选择状态。
     *
     * @returns {Array<string>} 当前筛选全部可见数据源 id。
     */
    visibleSourceIds() {
      // 循环类型: Array.prototype.map。
      // 初始值: records 第一条记录。
      // 终止条件: 所有当前筛选记录完成 id 提取。
      // 循环作用: 给全选事件提供当前筛选稳定 id 数组。
      return this.records.map(record => record.definition.id);
    },

    /**
     * 把父级选择 id 转换为集合。
     * 数据来源: selectedSourceIds。
     * 纯函数: 只优化模板行选中判断，不修改父级数组。
     *
     * @returns {Set<string>} 当前全部已选择数据源 id 集合。
     */
    selectedSourceIdSet() {
      // 返回值类型: Set<string>。
      // 作用: 让每行 selected 判断和全选计算使用统一快速查找来源。
      return new Set(this.selectedSourceIds);
    },

    /**
     * 判断当前筛选是否全部选中。
     * 数据来源: visibleSourceIds 和 selectedSourceIdSet。
     * true 让表头全选框保持勾选，false 表示仍有未选记录。
     * 纯函数: 只比较当前可见 id 与选择集合，不修改选择状态。
     *
     * @returns {boolean} 当前筛选是否全部选中。
     */
    allVisibleSelected() {
      // 条件分支: 当前筛选没有记录时进入。执行内容: 返回 false，避免空列表显示全选。
      if (!this.visibleSourceIds.length) return false;

      // 循环类型: Array.prototype.every。
      // 初始值: visibleSourceIds 第一项。
      // 终止条件: 发现首个未选 id 或全部 id 检查完成。
      // 循环作用: 判断当前筛选是否全部包含在父级选择集合中。
      return this.visibleSourceIds.every(sourceId => this.selectedSourceIdSet.has(sourceId));
    },

    /**
     * 判断当前筛选是否部分选中。
     * 数据来源: visibleSourceIds、selectedSourceIdSet 和 allVisibleSelected。
     * true 让 Element UI 全选框显示半选状态。
     * 纯函数: 只比较可见 id 与选择集合，不修改表头或父页面状态。
     *
     * @returns {boolean} 当前筛选是否部分选中。
     */
    partiallyVisibleSelected() {
      // 循环类型: Array.prototype.some。
      // 初始值: visibleSourceIds 第一项。
      // 终止条件: 发现首个已选 id 或全部 id 检查完成。
      // 循环作用: 判断当前筛选是否至少包含一个已选记录。
      const hasSelectedRecord = this.visibleSourceIds
        .some(sourceId => this.selectedSourceIdSet.has(sourceId));

      // 返回值类型: boolean。
      // 作用: 至少一项已选且没有全部选中时显示半选状态。
      return hasSelectedRecord && !this.allVisibleSelected;
    },
    /**
     * 读取分类空状态插图尺寸。
     * 数据来源: 模块级 EMPTY_IMAGE_SIZE 常量。
     * 纯函数: 只向模板暴露集中尺寸，不修改列表或父级状态。
     *
     * @returns {number} Element UI el-empty image-size。
     */
    emptyImageSize() {
      // 返回值类型: number。
      // 作用: 给 Element UI 空状态提供统一插图尺寸，避免模板使用魔法数字。
      return EMPTY_IMAGE_SIZE;
    }
  },

  methods: {
    /**
     * 通知父组件切换当前筛选全选状态。
     * 触发来源: 表头 el-checkbox 的 change 事件。
     * 副作用: 发出当前筛选全部 id 和目标选择状态，父组件负责合并跨筛选选择。
     *
     * @param {boolean} selected 当前筛选目标全选状态。
     * @returns {void} 该方法只发出组件事件，不直接修改 props。
     */
    toggleSelectAll(selected) {
      // 事件: toggle-select-all。
      // 作用: 把当前筛选可见 id 和目标状态交给 SourceManagementPanel 统一维护。
      this.$emit('toggle-select-all', {
        // 类型: Array<string>。
        // 作用: 当前筛选全部可见数据源 id。
        sourceIds: this.visibleSourceIds,
        // 类型: boolean。
        // 作用: true 选择当前筛选全部记录，false 取消当前筛选全部记录。
        selected
      });
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 数据源列表面板 `.source-list`。
  样式作用:
  定义表头和子组件列表行共享的响应式列、间距和内边距令牌。
  裁剪面板圆角之外的行背景，保持连续单行列表边界。
*/
.source-list {
  /* 类型: grid-template；作用: 定义桌面选择、名称、三个 Chip、两个开关、操作和详情九列结构。 */
  --source-list-columns: 36px minmax(160px, 1fr) 88px 80px 88px 70px 64px 116px 18px;
  /* 类型: length；作用: 定义桌面表头和列表行共用列间距。 */
  --source-list-column-gap: 8px;
  /* 类型: spacing；作用: 定义桌面表头和列表行共用水平内边距。 */
  --source-list-inline-padding: 0 16px;
  /* 裁剪列表行悬停背景，避免超出 theme-surface 圆角。 */
  overflow: hidden;
}

/*
  作用容器: 数据源列表真实内容 `.source-list__content`。
  样式作用:
  允许连续单行内容在设置工作区内收缩。
*/
.source-list__content {
  /* 允许 Grid 内容小于固有宽度，避免列表撑出设置页。 */
  min-width: 0;
}

/*
  作用容器: 桌面数据源表头 `.source-list__header`。
  样式作用:
  使用父容器共享令牌与 SourceListRow 保持逐列对齐。
  以弱表面和小字号说明每列字段含义。
*/
.source-list__header {
  /* 使用 CSS Grid 建立与列表行一致的列结构。 */
  display: grid;
  /* 读取父容器响应式列令牌，避免表头和列表行维护重复数值。 */
  grid-template-columns: var(--source-list-columns);
  /* 垂直居中每个表头字段。 */
  align-items: center;
  /* 读取父容器共享列间距。 */
  gap: var(--source-list-column-gap);
  /* 设置紧凑但可读的表头高度。 */
  min-height: 42px;
  /* 读取父容器共享水平内边距。 */
  padding: var(--source-list-inline-padding);
  /* 使用主题边框分隔表头和第一条记录。 */
  border-bottom: 1px solid var(--border-color);
  /* 使用主题弱表面色建立表头层级。 */
  background: var(--surface-muted);
  /* 使用主题弱文本色降低表头权重。 */
  color: var(--text-muted);
  /* 使用辅助字号显示字段名称。 */
  font-size: 12px;
}

/*
  响应式断点: max-width 900px。
  作用范围: 平板数据源列表。
  样式作用:
  隐藏版本和详情箭头，并统一修改父级列令牌，让表头和列表行同步切换为七列。
*/
@media (max-width: 900px) {
  /*
    作用容器: 平板数据源列表面板。
    样式作用:
    统一覆盖子树共享列和间距令牌。
  */
  .source-list {
    /* 类型: grid-template；作用: 定义隐藏版本和箭头后的平板七列结构。 */
    --source-list-columns: 32px minmax(140px, 1fr) 80px 82px 64px 60px 108px;
    /* 类型: length；作用: 收紧平板列间距，保留名称可读宽度。 */
    --source-list-column-gap: 8px;
  }

  /*
    作用容器: 平板版本表头。
    样式作用:
    与 SourceListRow 同步隐藏版本字段。
  */
  .source-list__header-version {
    /* 隐藏平板版本列，把空间让给名称和状态。 */
    display: none;
  }

  /*
    作用容器: 平板详情箭头表头 `.source-list__header-arrow`。
    样式作用:
    与 SourceListRow 同步隐藏详情箭头，把空间让给双开关和行尾操作。
  */
  .source-list__header-arrow {
    /* 平板隐藏详情箭头表头。 */
    display: none;
  }
}

/*
  响应式断点: max-width 640px。
  作用范围: 手机数据源列表。
  样式作用:
  定义手机身份、开关和命令三层共用的三列令牌并隐藏桌面表头。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机数据源列表面板。
    样式作用:
    统一覆盖子列表行的三层三列结构和紧凑间距。
  */
  .source-list {
    /* 类型: grid-template；作用: 选择列固定，两个等分内容列承载身份、双开关和整行命令。 */
    --source-list-columns: 28px minmax(0, 1fr) minmax(0, 1fr);
    /* 类型: length；作用: 设置手机紧凑列间距。 */
    --source-list-column-gap: 6px;
    /* 类型: spacing；作用: 设置手机列表行水平安全边距。 */
    --source-list-inline-padding: 0 10px;
  }

  /*
    作用容器: 手机数据源表头。
    样式作用:
    隐藏无法与五列紧凑内容一一对齐的桌面表头。
  */
  .source-list__header {
    /* 手机不显示独立表头。 */
    display: none;
  }
}
</style>
