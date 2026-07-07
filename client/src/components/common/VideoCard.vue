<template>
  <!--
    VideoCard 视频卡片组件渲染树

    {el-card.video-card}
    ├─ {div.cover-wrap}
    │  ├─ [if hasCover] {img.video-cover} 视频封面
    │  ├─ [else] {div.video-cover.video-cover-fallback} 封面占位
    │  └─ [if cornerBadgeText] {div.corner-badge} 封面角标
    └─ {div.card-body}
       ├─ {h3.video-title} 视频标题
       └─ {div.video-meta}
          ├─ {span.year} 年份
          └─ {span.rating} 评分
  -->
  <el-card
    class="video-card"
    shadow="hover"
    :body-style="{ padding: '0px' }">
    <!--
      封面区域。
      渲染位置：卡片上半部分。
      使用数据：`video.cover` 和 `cornerBadgeText`。
      页面作用：提供和 参考布局 一致的海报比例，让首页卡片区域整齐排列。
    -->
    <div class="cover-wrap">
      <!-- 有封面时渲染真实图片。 -->
      <img
        v-if="hasCover"
        class="video-cover"
        :src="video.cover"
        :alt="video.title || '视频封面'"
        @error="handleCoverError" />

      <!-- 没有封面时渲染渐变占位，避免卡片上半部分空白。 -->
      <div v-else class="video-cover video-cover-fallback">
        <span class="video-cover-fallback-text">{{ fallbackInitial }}</span>
      </div>

      <!-- 封面角标，显示更新状态、清晰度或推荐标签。 -->
      <div v-if="cornerBadgeText" class="corner-badge">{{ cornerBadgeText }}</div>
    </div>

    <!--
      卡片正文区域。
      渲染位置：封面下方。
      使用数据：标题、年份、评分。
      页面作用：让用户快速扫读视频名称和基础信息。
    -->
    <div class="card-body">
      <h3 class="video-title">{{ video.title || '未命名内容' }}</h3>

      <div class="video-meta">
        <span class="year" :class="{ 'is-empty': !video.year }">{{ displayYear }}</span>
        <span class="rating" :class="{ 'is-empty': !video.rating }">
          <i v-if="video.rating" class="el-icon-star-on"></i>
          {{ displayRating }}
        </span>
      </div>
    </div>
  </el-card>
</template>

<script>
/**
 * 通用视频卡片组件。
 *
 * 组件定位：
 * - 首页、目录页、搜索页都可以复用的视频展示单元
 * - 当前版本只负责展示，不做路由跳转
 * - 使用 Element UI 的 el-card 作为外壳，视觉上向 参考布局 卡片回归
 */
export default {
  name: 'VideoCard',

  props: {
    // video 是单个视频展示对象。
    // 页面影响：驱动封面、角标、标题、年份和评分。
    video: {
      type: Object,
      required: true
    }
  },

  computed: {
    /**
     * 是否存在可用封面。
     *
     * @returns {boolean} 有封面地址时返回 true。
     */
    hasCover() {
      return Boolean(this.video && this.video.cover);
    },

    /**
     * 封面角标文案。
     *
     * @returns {string} 角标文案。
     */
    cornerBadgeText() {
      // 首页 mock 里主要使用 remark，后续源脚本也可以用 episode 作为兜底。
      return (this.video && (this.video.remark || this.video.episode)) || '';
    },

    /**
     * 年份展示文本。
     *
     * @returns {string} 年份或暂无。
     */
    displayYear() {
      return (this.video && this.video.year) || '暂无';
    },

    /**
     * 评分展示文本。
     *
     * @returns {string} 评分或暂无。
     */
    displayRating() {
      return (this.video && this.video.rating) || '暂无';
    },

    /**
     * 封面占位首字。
     *
     * @returns {string} 标题首字或默认占位字。
     */
    fallbackInitial() {
      const title = this.video && this.video.title ? String(this.video.title).trim() : '';
      return title ? title.slice(0, 1) : '影';
    }
  },

  methods: {
    /**
     * 封面加载失败时隐藏图片。
     *
     * @param {Event} event 图片加载错误事件。
     * @returns {void}
     */
    handleCoverError(event) {
      // 静态阶段允许封面为空或失效；图片失败后隐藏它，保留卡片其它信息。
      event.target.style.display = 'none';
    }
  }
};
</script>

<style scoped>
/*
  视频卡片外层。
  对应 template 根节点 `{el-card.video-card}`。
*/
.video-card {
  border-radius: 6px;
  overflow: hidden;
  cursor: default;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 14px 28px rgba(15, 23, 42, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.78) inset;
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
}

/* 鼠标悬停时卡片轻微上浮，保留 参考布局 的卡片反馈。 */
.video-card:hover {
  transform: translateY(-6px);
  border-color: rgba(91, 140, 255, 0.28);
  box-shadow:
    0 20px 36px rgba(15, 23, 42, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.86) inset;
}

/*
  封面外层定位容器。
  对应 template 中 `.cover-wrap`，给角标提供定位参照。
*/
.cover-wrap {
  position: relative;
}

/* 视频封面图和封面占位的共用样式。 */
.video-cover {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  display: block;
  background: #eef2f7;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

/* 没有封面时的渐变占位。 */
.video-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 25% 20%, rgba(91, 140, 255, 0.2), transparent 34%),
    linear-gradient(145deg, #e8eef7 0%, #cfd9e8 100%);
}

/* 封面占位文字，使用标题首字提升识别度。 */
.video-cover-fallback-text {
  font-size: 42px;
  font-weight: 800;
  color: rgba(71, 85, 105, 0.42);
}

/* 封面左上角角标。 */
.corner-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  max-width: calc(100% - 20px);
  padding: 0 8px;
  border-radius: 6px;
  background: rgba(38, 55, 88, 0.86);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  backdrop-filter: blur(6px);
}

/* 卡片正文区域，承载标题、年份和评分。 */
.card-body {
  background: rgba(255, 255, 255, 0.98);
  padding: 12px 14px 14px;
}

/* 视频标题，固定单行并在过长时省略。 */
.video-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0 0 6px;
}

/* 年份和评分元信息行。 */
.video-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted);
}

/* 年份缺失时显示弱提示色。 */
.year.is-empty {
  color: #a1abbb;
}

/* 评分文字使用暖色，符合用户对评分信息的预期。 */
.rating {
  color: #d78b18;
}

/* 评分缺失时显示弱提示色。 */
.rating.is-empty {
  color: #a1abbb;
}

/* 星标和评分数字之间留出细小间距。 */
.rating i {
  margin-right: 2px;
}
</style>
