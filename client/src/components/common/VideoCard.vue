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
          └─ {span.score} 评分，读取 ContentItem.score
  -->
  <el-card
    class="video-card"
    shadow="hover"
    role="button"
    tabindex="0"
    :body-style="{ padding: '0px' }"
    @click.native="openDetailPage"
    @keydown.native.enter="openDetailPage"
    @keydown.native.space.prevent="openDetailPage">
    <!--
      封面区域。
      渲染位置：卡片上半部分。
      使用数据：`video.cover`、`video.poster` 和 `cornerBadgeText`。
      页面作用：提供统一海报比例，让首页、目录页和搜索页卡片整齐排列。
    -->
    <div class="cover-wrap">
      <!-- 有封面时渲染真实图片。 -->
      <img
        v-if="hasCover"
        class="video-cover"
        :src="displayCover"
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
      使用数据：ContentItem.title、year 和 score。
      页面作用：让用户快速扫读视频名称和基础信息。
    -->
    <div class="card-body">
      <h3 class="video-title">{{ video.title || '未命名内容' }}</h3>

      <div class="video-meta">
        <span class="year" :class="{ 'is-empty': !video.year }">{{ displayYear }}</span>
        <span class="score" :class="{ 'is-empty': !hasScore }">
          <i v-if="hasScore" class="el-icon-star-on"></i>
          {{ displayScore }}
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
 * - 点击后进入详情页，并把 sourceId/videoId 写入 detail 路由参数
 * - 直接读取统一 ContentItem 字段，不在页面层依赖旧展示适配字段
 * - 使用 Element UI 的 el-card 作为外壳，保证各页面卡片视觉一致
 */
export default {
  name: 'VideoCard',

  props: {
    // video 是单个统一 ContentItem 展示对象。
    // 页面影响：驱动封面、角标、标题、年份和评分。
    // 字段: id，string，内容唯一标识，用于详情页跳转。
    // 字段: sourceId，string，内容所属数据源，用于详情页请求保持来源一致。
    // 字段: cover/poster，string，视频封面地址，用于卡片封面。
    // 字段: badge/quality/tv.updateStatus，string，卡片角标候选字段。
    // 字段: score，number|string，内容评分，用于卡片右下角评分展示。
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
      return Boolean(this.video && (this.video.cover || this.video.poster));
    },

    /**
     * 封面展示地址。
     * 使用字段: ContentItem.cover、ContentItem.poster。
     *
     * @returns {string} 当前卡片可用封面地址。
     */
    displayCover() {
      // 类型: object。
      // 作用: video 缺失时使用空对象兜底，避免读取字段时报错。
      const video = this.video || {};

      // 返回值类型: string。
      // 作用: 优先使用横向或页面主封面 cover，缺失时使用 poster。
      return video.cover || video.poster || '';
    },

    /**
     * 封面角标文案。
     * 读取顺序: badge -> quality -> tv.updateStatus。
     * 这些字段都来自统一 ContentItem，不再依赖旧 remark 字段。
     *
     * @returns {string} 角标文案。
     */
    cornerBadgeText() {
      // 类型: object。
      // 作用: video 缺失时使用空对象兜底，避免读取嵌套字段时报错。
      const video = this.video || {};

      // 类型: object。
      // 作用: tv 字段缺失时使用空对象兜底，用于读取电视剧更新状态。
      const tv = video.tv || {};

      // 返回值类型: string。
      // 作用: 返回统一 ContentItem 里最适合作为卡片角标的字段。
      return video.badge || video.quality || tv.updateStatus || '';
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
    hasScore() {
      // 返回值类型: boolean。
      // 作用: score 为数字或非空字符串时展示星标和评分，否则展示暂无。
      return this.video && this.video.score !== null && this.video.score !== undefined && this.video.score !== '';
    },

    /**
     * 评分展示文本。
     * 使用字段: ContentItem.score。
     *
     * @returns {string|number} 评分或暂无。
     */
    displayScore() {
      // 条件分支: score 存在时进入。
      // 执行内容: 返回数据源提供或清洗后的统一评分字段。
      if (this.hasScore) {
        return this.video.score;
      }

      // 返回值类型: string。
      // 作用: 评分缺失时显示稳定兜底文案。
      return '暂无';
    },

    /**
     * 封面占位首字。
     *
     * @returns {string} 标题首字或默认占位字。
     */
    fallbackInitial() {
      // 类型: string。
      // 作用: 从统一 ContentItem.title 读取标题，缺失时使用空字符串兜底。
      const title = this.video && this.video.title ? String(this.video.title).trim() : '';

      // 返回值类型: string。
      // 作用: 有标题时返回首字作为封面占位；没有标题时返回默认“影”。
      return title ? title.slice(0, 1) : '影';
    }
  },

  methods: {
    /**
     * 打开当前视频详情页。
     *
     * @returns {void} 通过 vue-router 跳转到 detail 命名路由。
     */
    openDetailPage() {
      // video.id 是详情页定位视频的关键字段，缺失时不生成跳转，避免进入无目标详情页。
      if (!this.video || !this.video.id || !this.video.sourceId) {
        return;
      }

      // 进入详情页时同时携带 sourceId 和 videoId，让详情页能识别后续真实数据请求目标。
      this.$router.push({
        name: 'detail',
        params: {
          sourceId: this.video.sourceId,
          videoId: this.video.id
        }
      }).catch((error) => {
        // 重复点击当前卡片时忽略 Vue Router 3 的重复导航错误。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    },

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
  /* 卡片始终填满自己所在的栅格列，真正宽度由页面 7 列栅格决定。 */
  width: 100%;

  /* 允许卡片在栅格列里正常收缩，避免长标题撑开列宽。 */
  min-width: 0;

  /* 使用纵向 flex，把封面和固定高度正文组合成稳定卡片外框。 */
  display: flex;

  /* 封面在上、正文在下。 */
  flex-direction: column;

  /* 小圆角保持视频卡片边缘清楚，不过分装饰。 */
  border-radius: 6px;

  /* 裁掉封面和角标可能溢出的内容。 */
  overflow: hidden;

  /* 卡片可以进入详情页，所以使用手型指针提示可点击。 */
  cursor: pointer;

  /* 浅色边框用于区分卡片和页面背景。 */
  border: 1px solid rgba(148, 163, 184, 0.22);

  /* 卡片主体使用接近白色的底色，保持内容清楚。 */
  background: rgba(255, 255, 255, 0.96);

  /* 阴影让卡片从浅色背景里浮出来，但不做过重立体效果。 */
  box-shadow:
    0 14px 28px rgba(15, 23, 42, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.78) inset;

  /* hover 时只改变位移和阴影，避免影响卡片尺寸。 */
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
}

/* 鼠标悬停时卡片轻微上浮，提示这是可聚焦的视频条目。 */
.video-card:hover {
  /* 只做轻微上移，避免卡片动效过强。 */
  transform: translateY(-6px);

  /* hover 时边框变成浅蓝色，提示当前卡片被指向。 */
  border-color: rgba(91, 140, 255, 0.28);

  /* hover 时阴影略增强，让用户感知卡片层级变化。 */
  box-shadow:
    0 20px 36px rgba(15, 23, 42, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.86) inset;
}

/*
  封面外层定位容器。
  对应 template 中 `.cover-wrap`，给角标提供定位参照。
*/
.cover-wrap {
  /* 角标使用 absolute 定位，所以封面外层必须作为定位上下文。 */
  position: relative;
}

/* 视频封面图和封面占位的共用样式。 */
.video-cover {
  /* 封面宽度填满卡片列宽。 */
  width: 100%;

  /* 统一竖版海报比例，后续所有页面都按这个比例计算卡片高度。 */
  aspect-ratio: 2 / 3;

  /* 真实图片按比例裁切，不允许被拉伸变形。 */
  object-fit: cover;

  /* 块级显示可以去掉图片底部的行内空隙。 */
  display: block;

  /* 图片加载前或缺失时给出浅色底。 */
  background: #eef2f7;

  /* 封面和正文之间加一条浅分隔线。 */
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

/* 没有封面时的渐变占位。 */
.video-cover-fallback {
  /* 占位内容居中显示标题首字。 */
  display: flex;

  /* 垂直居中标题首字。 */
  align-items: center;

  /* 水平居中标题首字。 */
  justify-content: center;

  /* 渐变让无图卡片不显得空白。 */
  background:
    radial-gradient(circle at 25% 20%, rgba(91, 140, 255, 0.2), transparent 34%),
    linear-gradient(145deg, #e8eef7 0%, #cfd9e8 100%);
}

/* 封面占位文字，使用标题首字提升识别度。 */
.video-cover-fallback-text {
  /* 大字放在封面中央，方便扫读无图卡片。 */
  font-size: 42px;

  /* 加粗后在浅底上更容易识别。 */
  font-weight: 800;

  /* 灰蓝色降低占位文字权重，不抢标题。 */
  color: rgba(71, 85, 105, 0.42);
}

/* 封面左上角角标。 */
.corner-badge {
  /* 角标固定在封面左上角。 */
  position: absolute;

  /* 顶部留白和左侧留白保持一致。 */
  top: 12px;

  /* 左侧留白避免角标贴边。 */
  left: 12px;

  /* 角标压在封面图上方。 */
  z-index: 2;

  /* 使用 inline-flex 让短文本垂直居中。 */
  display: inline-flex;

  /* 垂直居中角标文字。 */
  align-items: center;

  /* 角标高度统一由全局变量控制。 */
  min-height: var(--video-card-badge-height);

  /* 角标不能超过封面宽度，超出部分省略。 */
  max-width: calc(100% - 24px);

  /* 左右留白让角标像一个稳定标签。 */
  padding: 0 12px;

  /* 小圆角匹配视频卡片边缘。 */
  border-radius: 8px;

  /* 深色半透明底保证压在图片上也能看清。 */
  background: rgba(38, 55, 88, 0.86);

  /* 角标文字使用白色。 */
  color: #ffffff;

  /* 角标字号统一由全局变量控制。 */
  font-size: var(--video-card-badge-size);

  /* 加粗提升标签识别度。 */
  font-weight: 700;

  /* 单行高度用于去掉多余上下空隙。 */
  line-height: 1;

  /* 阴影让角标从浅色海报里浮出来。 */
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);

  /* 角标不允许换行，否则会破坏封面布局。 */
  white-space: nowrap;

  /* 角标过长时隐藏溢出。 */
  overflow: hidden;

  /* 角标过长时用省略号收尾。 */
  text-overflow: ellipsis;

  /* 毛玻璃让角标底色和封面融合得更自然。 */
  backdrop-filter: blur(6px);
}

/* 卡片正文区域，承载标题、年份和评分。 */
.card-body {
  /* 正文区域使用接近白色的背景。 */
  background: rgba(255, 255, 255, 0.98);

  /* 正文高度固定，保证所有页面视频卡片总高度一致。 */
  height: var(--video-card-body-height);

  /* 固定高度下把 padding 计算进正文高度，避免撑高卡片。 */
  box-sizing: border-box;

  /* 正文内边距统一由全局变量控制。 */
  padding: var(--video-card-body-padding);

  /* 正文内部上下排列标题和元信息。 */
  display: flex;

  /* 让标题在上，年份评分在下。 */
  flex-direction: column;

  /* 让元信息稳定贴近正文底部。 */
  justify-content: center;
}

/* 视频标题，固定单行并在过长时省略。 */
.video-title {
  /* 标题字号统一由全局变量控制。 */
  font-size: var(--video-card-title-size);

  /* 标题加粗，形成卡片正文第一视觉层级。 */
  font-weight: 700;

  /* 标题使用主文字色。 */
  color: var(--text-primary);

  /* 标题不换行，避免卡片高度不一致。 */
  white-space: nowrap;

  /* 标题超出时隐藏。 */
  overflow: hidden;

  /* 标题超出时用省略号提示。 */
  text-overflow: ellipsis;

  /* 标题和元信息之间留出固定距离。 */
  margin: 0 0 10px;
}

/* 年份和评分元信息行。 */
.video-meta {
  /* 年份放左侧，评分放右侧。 */
  display: flex;

  /* 两端对齐，形成稳定的信息行。 */
  justify-content: space-between;

  /* 垂直居中年份和评分。 */
  align-items: center;

  /* 元信息字号统一由全局变量控制。 */
  font-size: var(--video-card-meta-size);

  /* 元信息使用弱文字色。 */
  color: var(--text-muted);
}

/* 年份缺失时显示弱提示色。 */
.year.is-empty {
  color: #a1abbb;
}

/* 评分文字使用暖色，符合用户对评分信息的预期。 */
.score {
  color: #d78b18;
}

/* 评分缺失时显示弱提示色。 */
.score.is-empty {
  color: #a1abbb;
}

/* 星标和评分数字之间留出细小间距。 */
.score i {
  margin-right: 2px;
}

</style>
