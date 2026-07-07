<template>
  <!--
    CatalogFilterBar 组件渲染树

    [DEFAULT] ele(section.catalog-filter.theme-surface)
    │  - condition:
    │      默认渲染。
    │      目录页需要在标题区下方展示动态筛选入口时挂载当前筛选栏组件。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      目录筛选栏根容器。
    │      承载筛选标题、重置按钮和按组分类的动态筛选项列表。
    │  - params:
    │      -- title：筛选栏标题。
    │      -- hint：筛选栏说明文案。
    │      -- filters：父页面传入的动态筛选组数组。
    │  - events: 无
    │
    ├─ [DEFAULT] ele(div.catalog-filter-head)
    │  - condition:
    │      默认渲染。
    │      筛选栏头部始终显示标题说明和重置入口。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      筛选栏头部。
    │      左侧展示标题和说明，右侧展示重置筛选按钮。
    │  - params: 无
    │  - events: 无
    │
    ├─ [DEFAULT] ele(div.catalog-filter-body)
    │  - condition:
    │      默认渲染。
    │      filters 有数据时循环渲染所有筛选组；为空时 body 保持空结构。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      筛选内容区。
    │      负责把数据源返回的筛选元数据按组渲染成筛选按钮。
    │  - params:
    │      -- filters：当前页面筛选组数组。
    │  - events: 无
  -->
  <!--
    目录筛选栏。
    作用：展示目录页顶部的筛选入口，视觉上回归 当前布局 的筛选面板结构。
  -->
  <section class="catalog-filter theme-surface">
    <!--
      筛选面板头部。
      渲染位置：筛选面板顶部。
      页面作用：显示筛选标题和重置按钮占位，让目录页筛选区更接近 当前布局。
    -->
    <div class="catalog-filter-head">
      <div class="catalog-filter-heading">
        <h2 class="catalog-filter-title">{{ title }}</h2>
        <span class="catalog-filter-subtitle">{{ hint }}</span>
      </div>

      <!--
        [DEFAULT] ele(el-button.catalog-filter-reset)
        - condition:
            默认渲染。
            当前筛选栏始终展示重置筛选入口；没有已选筛选条件时按钮禁用。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            重置筛选按钮。
            用户点击后向父页面派发 reset-filters 事件，由父页面恢复默认筛选状态。
        - params:
            -- resetDisabled：父页面传入的重置禁用状态。
        - events:
            @click
                - description:
                    用户点击重置筛选按钮时触发。
                    disabled 为 true 时 Element UI 会阻止点击。
                - methods:
                    handleResetFilters()
                        -- 无参数：组件内部只派发 reset-filters 事件。
      -->
      <el-button
        class="catalog-filter-reset"
        size="mini"
        plain
        :disabled="resetDisabled"
        @click="handleResetFilters">
        重置筛选
      </el-button>
    </div>

    <!--
      筛选内容区。
      渲染位置：筛选面板头部下方。
      使用数据：filters 中的每一组筛选项。
    -->
    <div class="catalog-filter-body">
      <!-- 单行筛选项，左侧是筛选维度，右侧是该维度的可选项。 -->
      <div v-for="group in filters" :key="group.name || group.label" class="filter-row">
        <div class="filter-label">{{ group.label }}</div>

        <!-- 筛选项容器，选项过多时自动换行。 -->
        <div class="filter-options">
          <!--
            [DEFAULT] ele(el-button.filter-chip)
            - condition:
                默认渲染。
                当前筛选组中的每个筛选项都会生成一个筛选按钮。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-button
            - description:
                单个筛选项按钮。
                根据 option.active 高亮当前已选项，点击后把筛选组名和值抛给父页面。
            - params:
                -- group.name：当前筛选组唯一标识。
                -- option.label：筛选项展示文案。
                -- option.value：筛选项值。
                -- option.active：筛选项当前激活状态。
            - events:
                @click
                    - description:
                        用户点击筛选项按钮时触发。
                        已激活项再次点击时不重复派发筛选变化事件。
                    - methods:
                        handleSelectOption(group.name, option)
                            -- group.name：当前筛选组机器名。
                            -- option：当前筛选项对象。
          -->
          <el-button
            v-for="option in group.options"
            :key="option.value"
            size="mini"
            native-type="button"
            class="filter-chip"
            :class="{ active: option.active }"
            :plain="!option.active"
            @click="handleSelectOption(group.name, option)"
          >
            {{ option.label }}
          </el-button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
/*
  CatalogFilterBar script 模块说明

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级辅助函数:
      无
*/

export default {
  // 组件名称用于在调试工具和报错信息中识别目录筛选栏。
  name: 'CatalogFilterBar',

  props: {
    // title 渲染在筛选面板头部左侧。
    // 页面影响：让同一个筛选组件可用于电影、电视剧等目录页面。
    title: {
      type: String,
      default: '目录筛选'
    },

    // hint 渲染在标题旁边，说明当前筛选区的用途。
    hint: {
      type: String,
      default: ''
    },

    // filters 由目录页传入，用来驱动筛选组和筛选按钮渲染。
    filters: {
      type: Array,
      required: true
    },

    // resetDisabled 控制重置按钮是否禁用。
    // true: 当前没有已选筛选条件，重置按钮禁用。
    // false: 当前存在非默认筛选条件，允许触发重置事件。
    resetDisabled: {
      type: Boolean,
      default: false
    }
  },

  methods: {
    /**
     * 处理筛选项点击。
     * 副作用: 向父页面派发 change-filter 事件。
     *
     * @param {string} groupName 当前筛选组机器名。
     * @param {object} option 当前筛选项对象。
     * @returns {void} 该方法只派发组件事件，不直接修改父页面筛选状态。
     */
    handleSelectOption(groupName, option) {
      // 类型: object。
      // 作用: option 不是对象时使用空对象兜底，避免读取字段时报错。
      const safeOption = option && typeof option === 'object' ? option : {};

      // 条件分支: 筛选组名缺失时进入。
      // 执行内容: 直接退出，避免派发无法被父页面识别的筛选事件。
      if (!groupName) {
        return;
      }

      // 条件分支: 当前筛选项已经是激活态时进入。
      // 执行内容: 不重复派发事件，避免父页面发起无意义的重复请求。
      if (safeOption.active) {
        return;
      }

      // 事件: change-filter。
      // 参数: object，包含筛选组名和筛选项值，父页面据此更新筛选状态并重新请求内容。
      this.$emit('change-filter', {
        groupName,
        optionValue: safeOption.value
      });
    },

    /**
     * 处理重置筛选点击。
     * 副作用: 向父页面派发 reset-filters 事件。
     *
     * @returns {void} 该方法只派发组件事件，不直接修改父页面筛选状态。
     */
    handleResetFilters() {
      // 条件分支: 当前重置按钮禁用时进入。
      // 执行内容: 直接退出，避免重复派发重置事件。
      if (this.resetDisabled) {
        return;
      }

      // 事件: reset-filters。
      // 作用: 通知父页面恢复默认筛选状态，并重新请求第一页内容。
      this.$emit('reset-filters');
    }
  }
};
</script>

<style scoped>
/*
  目录筛选栏整体容器。
  对应 template 中的 `.catalog-filter.theme-surface`，位于目录页标题区下方。
*/
.catalog-filter {
  /* 给筛选栏内部留出空间，避免内容贴边。 */
  padding: 22px 24px 24px;

  /* 控制筛选栏和下方主体内容之间的距离。 */
  margin-bottom: 24px;
}

/*
  筛选栏头部。
  对应 template 中的 `.catalog-filter-head`，展示标题、说明和重置按钮。
*/
.catalog-filter-head {
  /* 使用 flex 让标题组合在左，重置按钮在右。 */
  display: flex;

  /* 标题区和按钮区左右分布。 */
  justify-content: space-between;

  /* 标题和按钮底部对齐，视觉更稳定。 */
  align-items: flex-end;

  /* 窄屏换行前保留缓冲。 */
  gap: 16px;

  /* 和具体筛选行之间留出分隔距离。 */
  padding-bottom: 16px;

  /* 用细线分隔筛选标题区和筛选项。 */
  border-bottom: 1px solid var(--border-color);

  /* 控制头部和筛选内容之间的距离。 */
  margin-bottom: 18px;
}

/*
  筛选标题组合。
  对应 template 中的 `.catalog-filter-heading`。
*/
.catalog-filter-heading {
  /* 主标题和副标题横向排列。 */
  display: flex;

  /* 使用 baseline 让不同字号文字基线对齐。 */
  align-items: baseline;

  /* 主标题和说明之间留出距离。 */
  gap: 12px;
}

/*
  筛选栏标题。
  对应 template 中的 `.catalog-filter-title`。
*/
.catalog-filter-title {
  margin: 0;
  padding-left: 14px;
  border-left: 4px solid var(--accent);
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

/*
  筛选栏说明。
  对应 template 中的 `.catalog-filter-subtitle`。
*/
.catalog-filter-subtitle {
  font-size: 13px;
  color: var(--text-muted);
}

/*
  重置筛选按钮。
  对应 template 中的 `.catalog-filter-reset`。
*/
.catalog-filter-reset {
  /* 不让按钮被标题挤压变形。 */
  flex: 0 0 auto;
}

/*
  筛选内容区。
  对应 template 中的 `.catalog-filter-body`。
*/
.catalog-filter-body {
  /* 筛选内容区不额外加背景，背景由 theme-surface 提供。 */
  background: transparent;
}

/*
  单行筛选项。
  对应 template 中的 `.filter-row`。
*/
.filter-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  margin-bottom: 18px;
}

/* 最后一行筛选项底部不再额外留白。 */
.filter-row:last-child {
  margin-bottom: 0;
}

/*
  筛选组名称。
  对应 template 中的 `.filter-label`。
*/
.filter-label {
  padding-top: 6px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-muted);
}

/*
  筛选按钮容器。
  对应 template 中的 `.filter-options`。
*/
.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
}

/*
  单个筛选按钮。
  对应 template 中的 `.filter-chip`。
*/
.filter-chip {
  border-radius: 12px;
  font-size: 14px;
  line-height: 1;
  padding: 8px 14px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
  transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

/*
  当前选中的筛选按钮。
  对应 template 中的 `.filter-chip.active`，由 option.active 控制。
*/
.filter-chip.active {
  color: #ffffff;
  background: linear-gradient(135deg, #5b8cff 0%, #6b95ff 100%);
  border-color: #5b8cff;
  box-shadow: 0 10px 18px rgba(91, 140, 255, 0.16);
}

/* 鼠标悬停未选中筛选项时，使用轻微蓝色反馈。 */
.filter-chip:not(.active):hover {
  color: var(--accent);
  border-color: rgba(91, 140, 255, 0.34);
  background: rgba(91, 140, 255, 0.06);
  transform: translateY(-1px);
}

/*
  平板宽度下筛选行改成单列。
  触发条件：屏幕宽度不超过 900px。
*/
@media (max-width: 900px) {
  .filter-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .filter-label {
    padding-top: 0;
  }
}

/*
  手机宽度下筛选头部改成上下排列。
  触发条件：屏幕宽度不超过 640px。
*/
@media (max-width: 640px) {
  .catalog-filter {
    padding: 20px 18px 22px;
  }

  .catalog-filter-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
