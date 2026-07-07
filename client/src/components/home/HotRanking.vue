<template>
  <!--
    HotRanking 首页排行榜组件渲染树

    {div.ranking-wrapper}
    ├─ {h3.ranking-title} 榜单标题
    ├─ [if hasItems]
    │  └─ {ul.ranking-list}
    │     └─ {li.ranking-item} 循环渲染 displayItems
    │        ├─ {div.ranking-index-wrap}
    │        │  └─ {span.ranking-index} 排名数字
    │        └─ {div.ranking-info}
    │           ├─ {div.ranking-name-row}
    │           │  ├─ {span.ranking-name} 标题
    │           │  └─ [if index < 3] {span.ranking-hot-badge} HOT 标签
    │           └─ {span.ranking-meta} 榜单辅助信息
    └─ [else]
       └─ {el-empty} 榜单空状态
  -->
  <div class="ranking-wrapper">
    <!-- 榜单标题，通常显示“电影排行榜”或“电视剧排行榜”。 -->
    <h3 class="ranking-title">{{ title }}</h3>

    <!-- 有榜单数据时渲染排行列表。 -->
    <ul v-if="hasItems" class="ranking-list">
      <!-- 单条排行项，前三名会得到更明显的样式。 -->
      <li
        v-for="(item, index) in displayItems"
        :key="item.id || item.title || index"
        class="ranking-item"
        :class="getRankingRowClassList(index)">
        <!-- 左侧排名数字区域。 -->
        <div class="ranking-index-wrap">
          <span class="ranking-index" :class="'rank-' + (index + 1)">
            {{ item.rank || index + 1 }}
          </span>
        </div>

        <!-- 右侧标题、HOT 标签和辅助信息区域。 -->
        <div class="ranking-info">
          <div class="ranking-name-row">
            <span class="ranking-name">{{ item.title || '未命名内容' }}</span>
            <span
              v-if="index < 3"
              class="ranking-hot-badge"
              :class="'hot-badge-' + (index + 1)">
              HOT
            </span>
          </div>

          <span class="ranking-meta" :class="{ 'is-empty': !getMetaText(item) }">
            {{ getMetaText(item) || '暂无' }}
          </span>
        </div>
      </li>
    </ul>

    <!-- 没有榜单数据时，右侧榜单区域也保留空状态。 -->
    <el-empty
      v-else
      class="ranking-empty"
      description="暂无榜单数据" />
  </div>
</template>

<script>
/**
 * 首页排行榜组件。
 *
 * 组件定位：
 * - 接收父组件传入的标题和排行数据
 * - 负责把榜单渲染成 参考布局 风格的右侧排行榜
 * - 当前版本不做路由跳转，只保留可点击视觉和排行展示结构
 */
export default {
  name: 'HotRanking',

  props: {
    // title 渲染在排行榜顶部，用于区分电影排行榜或电视剧排行榜。
    title: {
      type: String,
      required: true
    },

    // items 是完整榜单数据，组件内部会截断前 20 条展示。
    items: {
      type: Array,
      required: true
    }
  },

  computed: {
    /**
     * 是否有榜单数据。
     *
     * @returns {boolean} 有榜单条目时返回 true。
     */
    hasItems() {
      return this.displayItems.length > 0;
    },

    /**
     * 首页实际展示的榜单条目。
     *
     * @returns {Array<object>} 最多 20 条榜单数据。
     */
    displayItems() {
      // 首页侧栏不适合无限拉长，所以最多展示前 20 条。
      return Array.isArray(this.items) ? this.items.filter(Boolean).slice(0, 20) : [];
    }
  },

  methods: {
    /**
     * 读取榜单辅助信息。
     *
     * @param {object} item 当前榜单条目。
     * @returns {string} 榜单右侧辅助文案。
     */
    getMetaText(item) {
      // 当前版本 mock 里用 meta，后续真实源也可能提供 remark、rating 或 year。
      return item.meta || item.remark || item.rating || item.year || '';
    },

    /**
     * 根据排名计算当前排行行的 class 列表。
     *
     * @param {number} index 当前条目下标，从 0 开始。
     * @returns {Array<string|object>} Vue class 绑定列表。
     */
    getRankingRowClassList(index) {
      return [
        // 前三名统一增加基础强调类，影响整行背景和 HOT 标签视觉。
        { 'top-three': index < 3 },

        // 前三名分别生成 rank-row-1、rank-row-2、rank-row-3。
        index < 3 ? 'rank-row-' + (index + 1) : '',

        // 第一、二、三名逐级缩进，形成 参考布局 排行榜的阶梯效果。
        index === 0 ? 'rank-step-1' : '',
        index === 1 ? 'rank-step-2' : '',
        index === 2 ? 'rank-step-3' : '',

        // 第四名以后统一缩进，和前三名区分开。
        index >= 3 ? 'rank-step-rest' : ''
      ];
    }
  }
};
</script>

<style scoped>
/*
  排行榜外层卡片。
  对应 template 根节点 `.ranking-wrapper`，在首页电影/电视剧区右侧显示。
*/
.ranking-wrapper {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--border-color);
  border-radius: 0;
  padding: 16px;
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(14px);
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 排行榜标题，用下边线和列表内容分隔。 */
.ranking-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

/* 排行榜列表容器，条目过多时在侧栏内部滚动。 */
.ranking-list {
  list-style: none;
  padding: 0 4px 0 0;
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* 榜单空状态，items 为空时显示。 */
.ranking-empty {
  flex: 1;
  min-height: 240px;
  border: 1px dashed var(--border-color);
}

/* 单条排行行，负责展示排名数字、标题、HOT 标签和辅助信息。 */
.ranking-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 7px 8px;
  cursor: default;
  border-bottom: 1px solid #edf1f6;
  border-radius: 0;
  transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  overflow: hidden;
}

/* 最后一条不需要底部分割线。 */
.ranking-item:last-child {
  border-bottom: none;
}

/* hover 时行背景变浅，保留 参考布局 的可点击视觉反馈。 */
.ranking-item:hover {
  background: rgba(248, 250, 252, 0.92);
  transform: translateX(2px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

/* 第一名不缩进，作为排行榜阶梯起点。 */
.rank-step-1 {
  margin-left: 0;
}

/* 第二名轻微右移，制造排行层级感。 */
.rank-step-2 {
  margin-left: 8px;
}

/* 第三名继续右移一点。 */
.rank-step-3 {
  margin-left: 16px;
}

/* 第四名及以后统一右移，弱化普通排行行。 */
.rank-step-rest {
  margin-left: 24px;
}

/* 第一名整行样式。 */
.rank-row-1 {
  background: #fff4ee;
  box-shadow: inset 3px 0 0 #ec6b4b;
  border: 1px solid #ffd9cf;
}

/* 第二名整行样式。 */
.rank-row-2 {
  background: #f4f7fb;
  box-shadow: inset 3px 0 0 #7f95b6;
  border: 1px solid #dbe4f0;
}

/* 第三名整行样式。 */
.rank-row-3 {
  background: #fff7ee;
  box-shadow: inset 3px 0 0 #d49845;
  border: 1px solid #f0debd;
}

/* 排名数字外层，固定序号区域宽度。 */
.ranking-index-wrap {
  position: relative;
  margin-right: 10px;
  flex-shrink: 0;
}

/* 排名数字方块。 */
.ranking-index {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid var(--border-color);
}

/* 第一名数字颜色。 */
.rank-1 {
  color: #ffffff;
  background: #ef5b44;
  border-color: #e45a42;
}

/* 第二名数字颜色。 */
.rank-2 {
  color: #ffffff;
  background: #7c8da6;
  border-color: #73839b;
}

/* 第三名数字颜色。 */
.rank-3 {
  color: #ffffff;
  background: #c97a2b;
  border-color: #b97028;
}

/* 右侧标题和辅助信息区域。 */
.ranking-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

/* 标题和 HOT 标签同行显示。 */
.ranking-name-row {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
  flex: 1;
}

/* 榜单视频标题，空间不足时省略。 */
.ranking-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
  min-width: 0;
}

/* 前三名 HOT 标签。 */
.ranking-hot-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 16px;
  padding: 0 9px 0 8px;
  margin-left: 4px;
  border-radius: 999px 12px 999px 999px;
  color: #ffffff;
  line-height: 1;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  font-style: italic;
  transform: skewX(-8deg);
}

/* 第一名 HOT 标签颜色。 */
.hot-badge-1 {
  background: linear-gradient(90deg, #ff6f4f 0%, #ff8b2d 100%);
}

/* 第二名 HOT 标签颜色。 */
.hot-badge-2 {
  background: linear-gradient(90deg, #7e92b3 0%, #8ca4c5 100%);
}

/* 第三名 HOT 标签颜色。 */
.hot-badge-3 {
  background: linear-gradient(90deg, #d58432 0%, #e3a04f 100%);
}

/* 右侧辅助信息，显示 meta、remark、rating 或 year。 */
.ranking-meta {
  font-size: 12px;
  color: #d97706;
  white-space: nowrap;
  flex-shrink: 0;
}

/* 辅助信息缺失时显示弱提示色。 */
.ranking-meta.is-empty {
  color: #9ca3af;
}

/* 移动端取消排行榜阶梯缩进，让标题获得更多宽度。 */
@media (max-width: 768px) {
  .rank-step-2,
  .rank-step-3,
  .rank-step-rest {
    margin-left: 0;
  }

  .ranking-wrapper {
    height: auto;
  }

  .ranking-list {
    overflow: visible;
    padding-right: 0;
  }
}
</style>
