<template>
  <!--
    CatalogPagination 组件渲染树

    {nav.catalog-pagination}
    ├─ {button.catalog-pagination__button} 上一页
    ├─ {span.catalog-pagination__status} 当前页 / 总页数
    └─ {button.catalog-pagination__button} 下一页
  -->
  <!--
    目录分页栏。
    作用：展示目录页或搜索页底部分页状态，具体分页行为留到字段确认后再完善。
  -->
  <nav class="catalog-pagination" aria-label="内容分页">
    <!-- 上一页按钮，当前只根据 hasPrev 显示禁用状态。 -->
    <button type="button" class="catalog-pagination__button" :disabled="!pagination.hasPrev">
      上一页
    </button>

    <!-- 当前分页状态，展示当前页和总页数。 -->
    <span class="catalog-pagination__status">
      第 {{ pagination.currentPage }} 页 / 共 {{ pagination.totalPages }} 页
    </span>

    <!-- 下一页按钮，当前只根据 hasNext 显示禁用状态。 -->
    <button type="button" class="catalog-pagination__button" :disabled="!pagination.hasNext">
      下一页
    </button>
  </nav>
</template>

<script>
export default {
  // 组件名称用于在调试工具和报错信息中识别目录分页组件。
  name: 'CatalogPagination',

  props: {
    // pagination 保存当前分页信息，父组件没有传入时不会渲染本组件。
    pagination: {
      type: Object,
      required: true
    }
  }
};
</script>

<style scoped>
/*
  分页栏整体容器。
  对应 template 中的 `.catalog-pagination`，位于主体列表下方。
*/
.catalog-pagination {
  /* 使用 flex 让上一页、状态文本、下一页横向排列。 */
  display: flex;

  /* 让分页内容水平居中，保持页面底部视觉稳定。 */
  justify-content: center;

  /* 垂直方向居中按钮和页码文字。 */
  align-items: center;

  /* 控制分页元素之间的距离。 */
  gap: 14px;
}

/*
  分页按钮。
  对应 template 中的 `.catalog-pagination__button`。
*/
.catalog-pagination__button {
  /* 使用白色背景，让按钮和页面背景区分开。 */
  background: #ffffff;

  /* 使用浅色边框保持按钮边界清晰。 */
  border: 1px solid #d6deea;

  /* 给按钮留出稳定点击区域。 */
  padding: 8px 16px;

  /* 使用小圆角，和内容型界面保持一致。 */
  border-radius: 8px;

  /* 设置按钮文字大小。 */
  font-size: 14px;

  /* 使用深色文字保证可读性。 */
  color: #182235;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;
}

/*
  禁用分页按钮。
  对应 template 中按钮的 disabled 状态。
*/
.catalog-pagination__button:disabled {
  /* 禁用按钮使用浅背景，降低视觉权重。 */
  background: #eef2f6;

  /* 禁用按钮文字变浅，提示不可点击。 */
  color: #98a2b3;

  /* 禁用状态下取消点击手势。 */
  cursor: not-allowed;
}

/*
  分页状态文字。
  对应 template 中的 `.catalog-pagination__status`。
*/
.catalog-pagination__status {
  /* 使用正文偏小字号，保持分页区域紧凑。 */
  font-size: 14px;

  /* 使用中性色，不让页码比页面主体更抢眼。 */
  color: #667085;
}
</style>
