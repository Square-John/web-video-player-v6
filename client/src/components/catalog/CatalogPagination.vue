<template>
  <!--
    CatalogPagination 组件渲染树

    {nav.catalog-pagination}
    ├─ {el-button.pagination-btn} 上一页
    ├─ {span.pagination-current} 当前页 / 总页数，读取标准 pagination.page / totalPages
    └─ {el-button.pagination-btn} 下一页
  -->
  <!--
    目录分页栏。
    作用：展示目录页或搜索页底部分页状态，视觉上回归 参考版本 的分页按钮结构。
  -->
  <nav class="catalog-pagination" aria-label="内容分页">
    <!-- 上一页按钮，根据标准 pagination.page 推导禁用状态。 -->
    <el-button
      class="pagination-btn kind-prev"
      native-type="button"
      :disabled="!canGoPrevPage">
      上一页
    </el-button>

    <!-- 当前分页状态，展示标准 pagination 中的当前页和总页数。 -->
    <span class="pagination-current">
      第 {{ displayPage }} 页 / 共 {{ totalPages }} 页
    </span>

    <!-- 下一页按钮，根据标准 pagination.hasMore 显示禁用状态。 -->
    <el-button
      class="pagination-btn kind-next"
      native-type="button"
      :disabled="!canGoNextPage">
      下一页
    </el-button>
  </nav>
</template>

<script>
/*
  CatalogPagination script 模块说明

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级辅助函数:
      无
*/

export default {
  // 组件名称用于在调试工具和报错信息中识别目录分页组件。
  name: 'CatalogPagination',

  props: {
    // 类型: object。
    // 来源: siteContentStore.pages[pageKey].pagination。
    // 作用: 保存标准 PageBucket.pagination 分页信息，驱动当前页、总页数和下一页禁用态。
    // 字段: page，number，当前页码。
    // 字段: pageSize，number，每页数量。
    // 字段: total，number，当前查询总条数。
    // 字段: totalPages，number，当前查询总页数。
    // 字段: hasMore，boolean，是否还有下一页。
    // true: 下一页按钮可用。
    // false: 下一页按钮禁用。
    pagination: {
      type: Object,
      required: true
    }
  },

  computed: {
    /**
     * 当前页码。
     * 来源: 标准 pagination.page。
     * 兜底策略: page 缺失或非法时显示第 1 页。
     *
     * @returns {number} 当前页码。
     */
    displayPage() {
      // 类型: number。
      // 作用: 把标准 pagination.page 转成数字，避免字符串页码影响比较逻辑。
      const page = Number(this.pagination.page || 1);

      // 返回值类型: number。
      // 作用: page 是有效正数时返回 page，否则回到第一页。
      return Number.isFinite(page) && page > 0 ? page : 1;
    },

    /**
     * 总页数。
     * 来源: 标准 pagination.totalPages。
     * 兜底策略: totalPages 缺失或非法时显示 0。
     *
     * @returns {number} 总页数。
     */
    totalPages() {
      // 类型: number。
      // 作用: 把标准 pagination.totalPages 转成数字，方便模板稳定展示。
      const totalPages = Number(this.pagination.totalPages || 0);

      // 返回值类型: number。
      // 作用: totalPages 是有效非负数时返回 totalPages，否则返回 0。
      return Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 0;
    },

    /**
     * 是否存在上一页。
     * 来源: 标准 pagination.page。
     *
     * @returns {boolean} 当前页大于 1 时返回 true。
     */
    canGoPrevPage() {
      // 返回值类型: boolean。
      // 作用: 当前页大于第一页时允许上一页按钮处于可用状态。
      return this.displayPage > 1;
    },

    /**
     * 是否存在下一页。
     * 来源: 标准 pagination.hasMore。
     *
     * @returns {boolean} 还有下一页时返回 true。
     */
    canGoNextPage() {
      // 返回值类型: boolean。
      // 作用: hasMore 为 true 时允许下一页按钮处于可用状态。
      return Boolean(this.pagination.hasMore);
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
