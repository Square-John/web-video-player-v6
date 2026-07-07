<template>
  <!--
    VideoCard 组件渲染树

    {article.video-card}
    ├─ {div.video-card__cover}
    │  └─ [if video.remark]
    │     └─ {span.video-card__badge} 封面角标
    └─ {div.video-card__body}
       ├─ {h3.video-card__title} 视频标题
       └─ {p.video-card__meta} 年份和评分组成的辅助说明
  -->
  <!--
    视频卡片。
    作用：在首页内容区中展示单个视频条目的基础视觉结构。
  -->
  <article class="video-card">
    <!-- 封面区域，使用色块保留真实封面的比例和空间。 -->
    <div class="video-card__cover">
      <!-- 封面标签，显示更新状态、清晰度或推荐类型。 -->
      <span v-if="video.remark" class="video-card__badge">{{ video.remark }}</span>
    </div>

    <!-- 文本区域，承载卡片标题和辅助说明。 -->
    <div class="video-card__body">
      <!-- 卡片标题，是用户扫读卡片时最先看到的信息。 -->
      <h3 class="video-card__title">{{ video.title }}</h3>

      <!-- 卡片辅助说明，用来展示年份、评分或简介兜底内容。 -->
      <p class="video-card__meta">{{ cardMeta }}</p>
    </div>
  </article>
</template>

<script>
export default {
  // 组件名称用于在调试工具和报错信息中识别视频卡片组件。
  name: 'VideoCard',

  // props 接收父组件传入的单个视频展示对象。
  props: {
    // video 驱动卡片中的封面标签、标题和辅助说明。
    video: {
      type: Object,
      required: true
    }
  },

  computed: {
    // cardMeta 把年份、评分和简介整理成卡片辅助说明。
    cardMeta() {
      const yearText = this.video.year || '年份未知';
      const ratingText = this.video.rating ? `${this.video.rating} 分` : '暂无评分';

      return `${yearText} · ${ratingText}`;
    }
  }
};
</script>

<style scoped>
/*
  视频卡片整体容器。
  对应 template 中的 `.video-card`，负责包裹封面和文字说明。
*/
.video-card {
  /* 使用白色背景，让卡片从页面浅灰背景中分离出来。 */
  background: #ffffff;

  /* 使用边框明确卡片边界，保证浅色背景下仍然清楚。 */
  border: 1px solid #e6eaf0;

  /* 让卡片边角稍微柔和，同时保持内容型产品的克制感。 */
  border-radius: 8px;

  /* 隐藏封面区域溢出的内容，保证圆角边界完整。 */
  overflow: hidden;

  /* 轻量阴影让卡片和背景形成层次。 */
  box-shadow: 0 12px 28px rgba(24, 34, 53, 0.06);
}

/*
  封面区域。
  对应 template 中的 `.video-card__cover`，用于模拟视频封面展示位。
*/
.video-card__cover {
  /* 固定封面比例，保证多张卡片在网格中高度一致。 */
  aspect-ratio: 3 / 4;

  /* 让封面标签可以定位到右下角。 */
  position: relative;

  /* 使用分层渐变模拟封面视觉，避免当前页面显得空白。 */
  background:
    linear-gradient(145deg, rgba(49, 95, 202, 0.24), rgba(31, 41, 55, 0.18)),
    linear-gradient(180deg, #dbe5f6 0%, #eef2f8 100%);
}

/*
  封面标签。
  对应 template 中的 `.video-card__badge`，显示卡片上的辅助状态。
*/
.video-card__badge {
  /* 贴近封面右下角，符合常见视频卡片信息层级。 */
  position: absolute;

  /* 控制标签距离封面右侧的位置。 */
  right: 10px;

  /* 控制标签距离封面底部的位置。 */
  bottom: 10px;

  /* 给标签文字留出内部空间，提升可读性。 */
  padding: 4px 8px;

  /* 使用深色半透明背景，保证标签在浅色封面上可读。 */
  background: rgba(24, 34, 53, 0.82);

  /* 标签文字使用白色，提高对比度。 */
  color: #ffffff;

  /* 缩小标签字号，保持辅助信息层级。 */
  font-size: 12px;

  /* 使用圆角让标签视觉更轻。 */
  border-radius: 999px;
}

/*
  卡片文字区域。
  对应 template 中的 `.video-card__body`，承载标题和辅助说明。
*/
.video-card__body {
  /* 给文字区域留出内边距，避免文字贴边。 */
  padding: 12px 14px 14px;
}

/*
  卡片标题。
  对应 template 中的 `.video-card__title`，展示视频主要名称。
*/
.video-card__title {
  /* 清掉标题默认外边距，统一由组件自己控制间距。 */
  margin: 0;

  /* 设置卡片标题字号，保证网格中信息密度合适。 */
  font-size: 15px;

  /* 使用较粗字重突出标题。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  卡片辅助说明。
  对应 template 中的 `.video-card__meta`，展示年份、类型或更新状态。
*/
.video-card__meta {
  /* 控制辅助说明和标题之间的距离。 */
  margin: 8px 0 0;

  /* 使用较小字号，保持辅助信息层级。 */
  font-size: 13px;

  /* 设置舒适行高，避免文字拥挤。 */
  line-height: 1.5;

  /* 使用中性色，弱化辅助说明。 */
  color: #667085;
}
</style>
