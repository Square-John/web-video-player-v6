<template>
  <!--
    CatalogFilterBar 组件渲染树

    {section.catalog-filter}
    ├─ {header.catalog-filter__header}
    │  ├─ {h2.catalog-filter__title} 筛选区标题
    │  └─ {p.catalog-filter__hint} 筛选区说明
    └─ {div.catalog-filter__groups}
       └─ {div.catalog-filter__group} 循环渲染每一组筛选项
          ├─ {span.catalog-filter__group-title} 筛选组名称
          └─ {button.catalog-filter__option} 循环渲染当前组的筛选按钮
  -->
  <!--
    目录筛选栏。
    作用：展示目录页顶部的筛选入口，具体筛选行为留到字段确认后再完善。
  -->
  <section class="catalog-filter">
    <!-- 筛选栏头部，说明当前区域用途。 -->
    <header class="catalog-filter__header">
      <h2 class="catalog-filter__title">电影筛选</h2>
      <p class="catalog-filter__hint">按类型、地区和年份快速缩小浏览范围</p>
    </header>

    <!-- 筛选组容器，逐组展示筛选项。 -->
    <div class="catalog-filter__groups">
      <!-- 单个筛选组，包含组名和一组可选项。 -->
      <div v-for="group in filters" :key="group.name" class="catalog-filter__group">
        <!-- 筛选组名称，例如类型、地区或年份。 -->
        <span class="catalog-filter__group-title">{{ group.label }}</span>

        <!-- 筛选按钮列表，当前只展示静态选中态。 -->
        <div class="catalog-filter__options">
          <!-- 单个筛选按钮，active 字段用于显示当前默认项。 -->
          <button
            v-for="option in group.options"
            :key="option.value"
            type="button"
            class="catalog-filter__option"
            :class="{ 'catalog-filter__option--active': option.active }"
          >
            {{ option.label }}
          </button>
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
  对应 template 中的 `.catalog-filter`，位于目录页标题区下方。
*/
.catalog-filter {
  /* 使用白色背景，把筛选栏从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用边框明确筛选栏边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和首页模块一致的圆角。 */
  border-radius: 8px;

  /* 给筛选栏内部留出空间，避免内容贴边。 */
  padding: 22px 24px;

  /* 控制筛选栏和下方主体内容之间的距离。 */
  margin-bottom: 24px;
}

/*
  筛选栏头部。
  对应 template 中的 `.catalog-filter__header`，展示标题和说明。
*/
.catalog-filter__header {
  /* 控制头部和筛选组之间的距离。 */
  margin-bottom: 18px;
}

/*
  筛选栏标题。
  对应 template 中的 `.catalog-filter__title`。
*/
.catalog-filter__title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用二级标题大小，保证筛选区标题清晰。 */
  font-size: 20px;

  /* 使用较粗字重突出区域标题。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  筛选栏说明。
  对应 template 中的 `.catalog-filter__hint`。
*/
.catalog-filter__hint {
  /* 控制说明文字和标题之间的距离。 */
  margin: 8px 0 0;

  /* 使用正文偏小字号，保持辅助层级。 */
  font-size: 14px;

  /* 使用中性色弱化说明文字。 */
  color: #667085;
}

/*
  筛选组列表。
  对应 template 中的 `.catalog-filter__groups`，包裹全部筛选组。
*/
.catalog-filter__groups {
  /* 使用纵向 flex，让多组筛选项从上到下排列。 */
  display: flex;

  /* 筛选组之间保留距离，避免信息挤在一起。 */
  flex-direction: column;

  /* 控制不同筛选组之间的间距。 */
  gap: 14px;
}

/*
  单个筛选组。
  对应 template 中的 `.catalog-filter__group`。
*/
.catalog-filter__group {
  /* 使用 flex 让组名和选项列表横向排列。 */
  display: flex;

  /* 让组名和按钮在垂直方向顶部对齐。 */
  align-items: flex-start;

  /* 控制组名和选项列表之间的距离。 */
  gap: 18px;
}

/*
  筛选组名称。
  对应 template 中的 `.catalog-filter__group-title`。
*/
.catalog-filter__group-title {
  /* 固定组名宽度，让不同筛选组的按钮起点对齐。 */
  width: 54px;

  /* 防止组名被压缩，保持布局稳定。 */
  flex: 0 0 auto;

  /* 使用中等字重，让组名比普通选项更醒目。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  筛选按钮容器。
  对应 template 中的 `.catalog-filter__options`。
*/
.catalog-filter__options {
  /* 使用 flex 让筛选按钮横向排列。 */
  display: flex;

  /* 允许按钮在窄屏或按钮较多时自动换行。 */
  flex-wrap: wrap;

  /* 控制按钮之间的横向和纵向距离。 */
  gap: 10px;
}

/*
  单个筛选按钮。
  对应 template 中的 `.catalog-filter__option`。
*/
.catalog-filter__option {
  /* 清掉浏览器默认按钮背景。 */
  background: #f4f7fb;

  /* 使用浅色边框，让按钮边界清晰但不沉重。 */
  border: 1px solid #e2e8f0;

  /* 给按钮留出点击区域。 */
  padding: 6px 12px;

  /* 使用胶囊圆角，让筛选项更像标签。 */
  border-radius: 999px;

  /* 使用正文偏小字号，保持筛选区紧凑。 */
  font-size: 14px;

  /* 使用中性色文字。 */
  color: #5d6678;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;
}

/*
  当前选中的筛选按钮。
  对应 template 中的 `.catalog-filter__option--active`，由 option.active 控制。
*/
.catalog-filter__option--active {
  /* 使用蓝色背景表达当前选中状态。 */
  background: #315fca;

  /* 边框颜色跟随背景，让选中按钮更完整。 */
  border-color: #315fca;

  /* 选中状态使用白色文字，提高对比度。 */
  color: #ffffff;
}
</style>
