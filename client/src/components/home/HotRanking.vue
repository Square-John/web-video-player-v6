<template>
  <!--
    HotRanking 组件渲染树

    {section.hot-ranking}
    ├─ {h3.hot-ranking__title}
    │  └─ 榜单标题，由父组件传入 title
    ├─ [if hasItems]
    │  └─ {ol.hot-ranking__list}
    │     └─ {li.hot-ranking__item} 循环渲染 items 榜单条目
    └─ [else]
       └─ {div.hot-ranking__empty}
          └─ {p.hot-ranking__empty-text} 榜单空状态提示
  -->
  <!--
    首页榜单组件。
    作用：展示一组有顺序的热门内容。
  -->
  <section class="hot-ranking">
    <!-- 榜单标题，说明当前榜单类型。 -->
    <h3 class="hot-ranking__title">{{ title }}</h3>

    <!-- 榜单列表，items 有内容时使用自定义序号展示排名关系。 -->
    <ol v-if="hasItems" class="hot-ranking__list">
      <!-- 单条榜单内容，展示排名、标题和辅助说明。 -->
      <li v-for="(item, index) in items" :key="item.id || item.title" class="hot-ranking__item">
        <!-- 排名数字，帮助用户快速扫读热度顺序。 -->
        <span class="hot-ranking__index">{{ item.rank || index + 1 }}</span>

        <!-- 榜单内容主体，包含标题和辅助说明。 -->
        <span class="hot-ranking__content">
          <span class="hot-ranking__name">{{ item.title }}</span>
          <span class="hot-ranking__meta">{{ item.meta }}</span>
        </span>
      </li>
    </ol>

    <!-- 榜单空状态，items 没有内容时保留榜单区域占位。 -->
    <div v-else class="hot-ranking__empty">
      <p class="hot-ranking__empty-text">暂无可展示内容</p>
    </div>
  </section>
</template>

<script>
export default {
  // 组件名称用于在调试工具和报错信息中识别榜单组件。
  name: 'HotRanking',

  // props 接收父组件传入的榜单标题和榜单内容。
  props: {
    // title 显示在榜单顶部，用于说明当前榜单类别。
    title: {
      type: String,
      required: true
    },

    // items 是榜单条目列表，数组为空时模板会渲染榜单空状态。
    items: {
      type: Array,
      required: true
    }
  },

  computed: {
    // hasItems 表示榜单是否有真实条目可以渲染。
    hasItems() {
      return this.items.length > 0;
    }
  }
};
</script>

<style scoped>
/*
  榜单整体容器。
  对应 template 中的 `.hot-ranking`，用于包裹标题和有序列表。
*/
.hot-ranking {
  /* 使用白色背景，让榜单形成独立内容块。 */
  background: #ffffff;

  /* 使用边框明确榜单区域边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和首页其他卡片一致的圆角。 */
  border-radius: 8px;

  /* 给榜单内容留出内部空间。 */
  padding: 20px;
}

/*
  榜单标题。
  对应 template 中的 `.hot-ranking__title`，展示榜单名称。
*/
.hot-ranking__title {
  /* 清掉标题默认外边距，统一由组件控制间距。 */
  margin: 0 0 16px;

  /* 使用中等字号，让榜单标题清晰但不过度突出。 */
  font-size: 18px;

  /* 使用较粗字重增强标题识别度。 */
  font-weight: 700;

  /* 使用深色文字保证标题可读性。 */
  color: #182235;
}

/*
  榜单列表。
  对应 template 中的 `.hot-ranking__list`，承载全部排名条目。
*/
.hot-ranking__list {
  /* 清掉 ol 默认外边距，避免榜单位置偏移。 */
  margin: 0;

  /* 清掉 ol 默认内边距，改用自定义序号布局。 */
  padding: 0;

  /* 取消浏览器默认序号，使用 `.hot-ranking__index` 自定义排名展示。 */
  list-style: none;
}

/*
  榜单空状态容器。
  对应 template 中的 `.hot-ranking__empty`，在 items 为空时显示。
*/
.hot-ranking__empty {
  /* 使用虚线边框提示榜单区域当前只是占位。 */
  border: 1px dashed #d6deea;

  /* 保持和榜单外层一致的圆角语言。 */
  border-radius: 8px;

  /* 给空榜单留出高度，避免右侧区域因为没数据而塌陷。 */
  min-height: 160px;

  /* 使用 flex 居中空状态文字。 */
  display: flex;

  /* 水平方向居中。 */
  align-items: center;

  /* 垂直方向居中。 */
  justify-content: center;

  /* 给空状态内部留出安全空间。 */
  padding: 20px;
}

/*
  榜单空状态文字。
  对应 template 中的 `.hot-ranking__empty-text`。
*/
.hot-ranking__empty-text {
  /* 清掉段落默认外边距，保证居中效果准确。 */
  margin: 0;

  /* 使用正文偏小字号，保持空状态提示克制。 */
  font-size: 14px;

  /* 使用中性色弱化空状态提示。 */
  color: #667085;
}

/*
  单条榜单项。
  对应 template 中的 `.hot-ranking__item`，展示排名和内容。
*/
.hot-ranking__item {
  /* 使用 flex 让排名数字和文字内容横向排列。 */
  display: flex;

  /* 让排名数字和文字顶部对齐。 */
  align-items: flex-start;

  /* 控制排名数字和文字之间的距离。 */
  gap: 12px;

  /* 给相邻榜单项留出距离。 */
  padding: 12px 0;

  /* 使用底部分割线增强列表层次。 */
  border-bottom: 1px solid #eef2f6;
}

/*
  最后一条榜单项。
  对应最后一个 `.hot-ranking__item`，去掉底部分割线。
*/
.hot-ranking__item:last-child {
  /* 避免列表底部出现多余边线。 */
  border-bottom: 0;
}

/*
  榜单排名数字。
  对应 template 中的 `.hot-ranking__index`，显示从 1 开始的排名。
*/
.hot-ranking__index {
  /* 固定宽度，保证不同位数排名对齐。 */
  width: 24px;

  /* 使用较粗字重突出排名。 */
  font-weight: 700;

  /* 使用蓝色强调榜单序号。 */
  color: #315fca;
}

/*
  榜单内容主体。
  对应 template 中的 `.hot-ranking__content`，包含标题和辅助说明。
*/
.hot-ranking__content {
  /* 使用 flex 让标题和说明上下排列。 */
  display: flex;

  /* 让标题和说明垂直排列。 */
  flex-direction: column;

  /* 控制标题和说明之间的距离。 */
  gap: 4px;
}

/*
  榜单条目名称。
  对应 template 中的 `.hot-ranking__name`，展示内容标题。
*/
.hot-ranking__name {
  /* 使用正文级字号，保证榜单紧凑可读。 */
  font-size: 15px;

  /* 使用较粗字重增强条目名称识别度。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  榜单辅助说明。
  对应 template 中的 `.hot-ranking__meta`，展示年份、类型等补充信息。
*/
.hot-ranking__meta {
  /* 使用较小字号保持辅助层级。 */
  font-size: 13px;

  /* 使用中性色弱化说明文字。 */
  color: #667085;
}
</style>
