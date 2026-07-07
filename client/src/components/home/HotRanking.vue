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
    │           └─ {span.ranking-meta} 榜单辅助信息，读取 ContentItem.genres、score、year
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
        role="button"
        tabindex="0"
        :class="getRankingRowClassList(index)"
        @click="openDetailPage(item)"
        @keydown.enter="openDetailPage(item)"
        @keydown.space.prevent="openDetailPage(item)">
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
 * - 负责把榜单渲染成首页右侧的紧凑排行榜
 * - 直接读取统一 ContentItem 字段，不依赖页面层补充 meta、remark 或 rating
 * - 点击榜单条目后进入对应详情页
 */
export default {
  name: 'HotRanking',

  props: {
    // title 渲染在排行榜顶部，用于区分电影排行榜或电视剧排行榜。
    title: {
      type: String,
      required: true
    },

    // items 是完整榜单 ContentItem 列表，组件内部会截断前 20 条展示。
    // 字段: id，string，内容唯一标识，用于详情页跳转。
    // 字段: sourceId，string，内容所属数据源，用于详情页请求保持来源一致。
    // 字段: title，string，内容标题，用于榜单主标题。
    // 字段: rank，number，榜单排名，缺失时使用列表下标补齐。
    // 字段: genres，Array<string>，内容类型，用于榜单辅助信息。
    // 字段: score，number|string，内容评分，用于榜单辅助信息。
    // 字段: year，string|number，内容年份，评分缺失时用于辅助信息兜底。
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
      // 首页侧栏保留完整榜单承载能力，所以最多展示前 20 条。
      return Array.isArray(this.items) ? this.items.filter(Boolean).slice(0, 20) : [];
    }
  },

  methods: {
    /**
     * 打开当前榜单条目详情页。
     *
     * @param {object} item 当前榜单条目。
     * @returns {void} 通过 vue-router 跳转到 detail 命名路由。
     */
    openDetailPage(item) {
      // 榜单条目必须有 id 和 sourceId 才能构造详情页目标。
      if (!item || !item.id || !item.sourceId) {
        return;
      }

      // 使用 detail 命名路由跳转，保持和视频卡片、轮播图一致的详情入口。
      this.$router.push({
        name: 'detail',
        params: {
          sourceId: item.sourceId,
          videoId: item.id
        }
      }).catch((error) => {
        // 重复点击当前榜单目标时忽略重复导航错误。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    },

    /**
     * 读取榜单辅助信息。
     * 使用字段: ContentItem.genres、ContentItem.score、ContentItem.year、ContentItem.type。
     * 纯函数: 只读取当前榜单条目，不修改组件状态。
     *
     * @param {object} item 当前榜单条目。
     * @returns {string} 榜单右侧辅助文案。
     */
    getMetaText(item) {
      // 类型: object。
      // 作用: item 缺失时使用空对象兜底，避免读取字段时报错。
      const contentItem = item || {};

      // 类型: string。
      // 作用: 读取统一 ContentItem 的第一个类型标签，用于榜单辅助文案左侧。
      const genre = Array.isArray(contentItem.genres) && contentItem.genres.length ? contentItem.genres[0] : '';

      // 类型: string。
      // 作用: 当 genres 缺失时，根据统一 ContentItem.type 给出基础内容类型。
      const contentTypeText = contentItem.type === 'tv' ? '电视剧' : '电影';

      // 类型: boolean。
      // 作用: 判断 score 是否由数据源提供，0 分也算有效评分，不能被普通 truthy 判断吞掉。
      const hasScore = contentItem.score !== null && contentItem.score !== undefined && contentItem.score !== '';

      // 类型: string|number。
      // 作用: 评分存在时优先展示 score；评分缺失时用 year 兜底，避免榜单右侧完全空白。
      const scoreOrYear = hasScore ? contentItem.score : contentItem.year || '';

      // 类型: string。
      // 作用: 优先使用细分类 genre；缺失时使用电影/电视剧基础类型。
      const categoryText = genre || contentTypeText;

      // 条件分支: 评分或年份存在时进入。
      // 执行内容: 组合成“类型 · 评分/年份”的紧凑榜单文案。
      if (scoreOrYear) {
        return `${categoryText} · ${scoreOrYear}`;
      }

      // 返回值类型: string。
      // 作用: 评分和年份都缺失时至少返回内容类型，让榜单辅助信息仍有可读文案。
      return categoryText;
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

        // 第一、二、三名逐级缩进，形成排行榜的阶梯效果。
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
  /* 半透明白底和首页浅色背景区分开。 */
  background: rgba(255, 255, 255, 0.82);

  /* 边框勾出排行榜独立面板。 */
  border: 1px solid var(--border-color);

  /* 首页排行榜保持直角，和卡片区形成清楚的模块边界。 */
  border-radius: 0;

  /* 内边距控制标题和排行行距离面板边缘的空间。 */
  padding: 18px;

  /* 阴影让排行榜从页面背景中轻微浮起。 */
  box-shadow: var(--shadow-soft);

  /* 毛玻璃让白底面板和背景更柔和地融合。 */
  backdrop-filter: blur(14px);

  /* 宽度填满右侧榜单列。 */
  width: 100%;

  /* 高度跟随 `.section-aside`，和左侧两行卡片总高度对齐。 */
  height: 100%;

  /* 允许内部列表在固定高度里正确收缩。 */
  min-height: 0;

  /* 使用纵向 flex，让标题固定、列表占用剩余高度。 */
  display: flex;

  /* 标题在上，列表在下。 */
  flex-direction: column;
}

/* 排行榜标题，用下边线和列表内容分隔。 */
.ranking-title {
  /* 榜单标题比普通卡片标题略大，方便识别右侧模块。 */
  font-size: 20px;

  /* 加粗突出榜单类型。 */
  font-weight: 700;

  /* 使用主文字色保证标题清楚。 */
  color: var(--text-primary);

  /* 清掉默认标题外边距，只保留底部距离。 */
  margin: 0 0 12px;

  /* 标题下方留出分隔线空间。 */
  padding-bottom: 10px;

  /* 分隔线把标题和列表分开。 */
  border-bottom: 1px solid var(--border-color);

  /* 标题固定高度，不参与下方列表滚动。 */
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
  cursor: pointer;
  border-bottom: 1px solid #edf1f6;
  border-radius: 0;
  transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  overflow: hidden;
}

/* 最后一条不需要底部分割线。 */
.ranking-item:last-child {
  border-bottom: none;
}

/* hover 时行背景变浅，提供可点击视觉反馈。 */
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

/* 右侧辅助信息，显示 ContentItem.genres、score 或 year 推导出的榜单文案。 */
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
