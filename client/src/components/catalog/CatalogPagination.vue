<template>
  <!--
    CatalogPagination 组件渲染树

    {nav.catalog-pagination}
    ├─ {el-button.pagination-btn} 上一页
    ├─ {span.pagination-current} 当前页 / 总页数
    └─ {el-button.pagination-btn} 下一页
  -->
  <!--
    目录分页栏。
    作用：展示目录页或搜索页底部分页状态，视觉上回归 参考布局 的分页按钮结构。
  -->
  <nav class="catalog-pagination" aria-label="内容分页">
    <!-- 上一页按钮，当前只根据 hasPrev 显示禁用状态。 -->
    <el-button
      class="pagination-btn kind-prev"
      native-type="button"
      :disabled="!pagination.hasPrev">
      上一页
    </el-button>

    <!-- 当前分页状态，展示当前页和总页数。 -->
    <span class="pagination-current">
      第 {{ pagination.currentPage }} 页 / 共 {{ pagination.totalPages }} 页
    </span>

    <!-- 下一页按钮，当前只根据 hasNext 显示禁用状态。 -->
    <el-button
      class="pagination-btn kind-next"
      native-type="button"
      :disabled="!pagination.hasNext">
      下一页
    </el-button>
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
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin: 32px 0 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
}

/*
  通用分页按钮。
  对应 template 中的 `.pagination-btn`，上一页和下一页都复用它。
*/
.pagination-btn {
  min-width: 78px;
  height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.04);
}

/*
  当前页静态标签。
  对应 template 中 `.pagination-current`。
*/
.pagination-current {
  min-width: 128px;
  height: 40px;
  padding: 0 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 38px;
  text-align: center;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.04);
}

/*
  手机宽度下分页按钮收窄。
  触发条件：屏幕宽度不超过 640px。
*/
@media (max-width: 640px) {
  .pagination-btn {
    min-width: 68px;
    height: 38px;
    padding: 0 12px;
  }

  .pagination-current {
    min-width: 112px;
    height: 38px;
    line-height: 36px;
  }
}
</style>
