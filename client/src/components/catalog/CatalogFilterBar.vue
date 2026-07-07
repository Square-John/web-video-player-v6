<template>
  <!--
    CatalogFilterBar 组件渲染树

    {section.catalog-filter.theme-surface}
    ├─ {div.catalog-filter-head}
    │  ├─ {div.catalog-filter-heading}
    │  │  ├─ {h2.catalog-filter-title} 筛选区标题
    │  │  └─ {span.catalog-filter-subtitle} 筛选副标题
    │  └─ {el-button.catalog-filter-reset} 重置按钮占位
    └─ {div.catalog-filter-body}
       └─ {div.filter-row} 循环渲染每一组筛选项
          ├─ {div.filter-label} 筛选组名称
          └─ {div.filter-options}
             └─ {el-button.filter-chip} 循环渲染当前组的筛选项
  -->
  <!--
    目录筛选栏。
    作用：展示目录页顶部的筛选入口，视觉上回归 参考版本 的筛选面板结构。
  -->
  <section class="catalog-filter theme-surface">
    <!--
      筛选面板头部。
      渲染位置：筛选面板顶部。
      页面作用：显示筛选标题和重置按钮占位，让目录页筛选区更接近 参考版本。
    -->
    <div class="catalog-filter-head">
      <div class="catalog-filter-heading">
        <h2 class="catalog-filter-title">{{ title }}</h2>
        <span class="catalog-filter-subtitle">{{ hint }}</span>
      </div>

      <!-- 当前版本只展示重置按钮外观，具体筛选行为在数据流接入后补齐。 -->
      <el-button class="catalog-filter-reset" size="mini" plain>重置筛选</el-button>
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
          <!-- 单个筛选项，active 字段用于显示当前默认选中态。 -->
          <el-button
            v-for="option in group.options"
            :key="option.value"
            size="mini"
            native-type="button"
            class="filter-chip"
            :class="{ active: option.active }"
            :plain="!option.active"
          >
            {{ option.label }}
          </el-button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
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
