<template>
  <!--
    DetailView 页面渲染树

    {div.detail-view}
    ├─ [if hasVideo] 详情内容分支
    │  ├─ {section.detail-view__hero}
    │  │  ├─ {div.detail-view__cover} 视频封面占位
    │  │  └─ {div.detail-view__main}
    │  │     ├─ {p.detail-view__eyebrow} 视频类型和年份
    │  │     ├─ {h1.detail-view__title} 视频标题
    │  │     ├─ {div.detail-view__meta-row} 评分、地区、语言、更新状态
    │  │     ├─ {p.detail-view__summary} 视频简介
    │  │     ├─ {div.detail-view__source} 来源状态
    │  │     └─ {button.detail-view__primary-action} 播放入口按钮
    │  ├─ {section.detail-view__info-panel}
    │  │  ├─ {div.detail-view__info-block} 题材标签
    │  │  ├─ {div.detail-view__info-block} 导演列表
    │  │  └─ {div.detail-view__info-block} 演员列表
    │  └─ {section.detail-view__episodes}
    │     ├─ {header.detail-view__section-header} 分集标题
    │     ├─ [if hasEpisodes]
    │     │  └─ {div.detail-view__episode-grid}
    │     │     └─ {button.detail-view__episode} 循环渲染 episodes 分集按钮
    │     └─ [else]
    │        └─ {div.detail-view__empty} 暂无分集状态
    └─ [else] 详情空状态分支
       └─ {div.detail-view__empty}
          ├─ {h2.detail-view__empty-title} 空状态标题
          └─ {p.detail-view__empty-text} 空状态说明
  -->
  <!--
    详情页。
    作用：展示单个视频的完整信息、来源状态和分集入口。
  -->
  <div class="detail-view">
    <!-- 有视频详情数据时渲染完整详情内容。 -->
    <template v-if="hasVideo">
      <!-- 详情头部，集中展示封面、标题、简介和主要操作。 -->
      <section class="detail-view__hero">
        <!-- 封面区域，当前用占位视觉保留真实封面空间。 -->
        <div class="detail-view__cover">
          <!-- 更新状态或清晰度标签，没有 remark 时不渲染。 -->
          <span v-if="video.remark" class="detail-view__cover-badge">{{ video.remark }}</span>
        </div>

        <!-- 视频主要信息区域，位于封面右侧。 -->
        <div class="detail-view__main">
          <!-- 页面短标签，展示类型、年份和首播日期。 -->
          <p class="detail-view__eyebrow">{{ videoEyebrow }}</p>

          <!-- 视频标题，是详情页最重要的信息。 -->
          <h1 class="detail-view__title">{{ video.title }}</h1>

          <!-- 元信息行，用于快速扫读评分、地区、语言和别名。 -->
          <div class="detail-view__meta-row">
            <span v-for="item in videoMetaItems" :key="item" class="detail-view__meta-item">
              {{ item }}
            </span>
          </div>

          <!-- 视频简介，没有简介时显示统一占位文本。 -->
          <p class="detail-view__summary">{{ displaySummary }}</p>

          <!-- 来源状态，帮助用户知道当前详情数据来自哪里。 -->
          <div class="detail-view__source">
            <span class="detail-view__source-label">来源</span>
            <strong class="detail-view__source-name">{{ sourceName }}</strong>
            <span class="detail-view__source-message">{{ sourceMessage }}</span>
          </div>

          <!-- 播放入口按钮，当前先展示页面入口形态。 -->
          <button type="button" class="detail-view__primary-action">
            播放选中分集
          </button>
        </div>
      </section>

      <!-- 信息标签区，展示题材、导演和演员。 -->
      <section class="detail-view__info-panel" aria-label="视频信息">
        <!-- 题材标签区，genreList 为空时显示暂无。 -->
        <div class="detail-view__info-block">
          <h2 class="detail-view__info-title">题材</h2>
          <p class="detail-view__info-text">{{ genreText }}</p>
        </div>

        <!-- 导演列表区，directorList 为空时显示暂无。 -->
        <div class="detail-view__info-block">
          <h2 class="detail-view__info-title">导演</h2>
          <p class="detail-view__info-text">{{ directorText }}</p>
        </div>

        <!-- 演员列表区，actorList 为空时显示暂无。 -->
        <div class="detail-view__info-block">
          <h2 class="detail-view__info-title">演员</h2>
          <p class="detail-view__info-text">{{ actorText }}</p>
        </div>
      </section>

      <!-- 分集区，展示可选择的播放入口。 -->
      <section class="detail-view__episodes" aria-label="分集列表">
        <!-- 分集区头部，说明当前分集数量。 -->
        <header class="detail-view__section-header">
          <h2 class="detail-view__section-title">分集</h2>
          <span class="detail-view__section-count">{{ episodeCountText }}</span>
        </header>

        <!-- 有分集数据时渲染分集按钮网格。 -->
        <div v-if="hasEpisodes" class="detail-view__episode-grid">
          <!-- 每个按钮使用 label 展示，value 留给后续播放请求使用。 -->
          <button
            v-for="episode in episodes"
            :key="episode.id || episode.value"
            type="button"
            class="detail-view__episode"
            :class="{ 'detail-view__episode--active': episode.active }"
          >
            <span class="detail-view__episode-label">{{ episode.label }}</span>
            <span class="detail-view__episode-title">{{ episode.title || episode.remark || '可播放' }}</span>
          </button>
        </div>

        <!-- episodes 为空时，分集区保留空状态。 -->
        <div v-else class="detail-view__empty">
          <h2 class="detail-view__empty-title">暂无分集</h2>
          <p class="detail-view__empty-text">当前详情数据没有提供可展示的分集列表。</p>
        </div>
      </section>
    </template>

    <!-- video 为 null 时，显示整页详情空状态。 -->
    <div v-else class="detail-view__empty detail-view__empty--page">
      <h2 class="detail-view__empty-title">暂无详情</h2>
      <p class="detail-view__empty-text">当前没有可展示的视频详情数据。</p>
    </div>
  </div>
</template>

<script>
// 详情页静态数据，记录视频详情、分集列表和来源状态的当前数据结构。
import { detailPageData } from '../data/page-detail.mock';

export default {
  // 组件名称用于在调试工具和报错信息中识别详情页。
  name: 'DetailView',

  data() {
    return {
      // video 驱动详情头部、简介和信息标签区；为 null 时显示详情空状态。
      video: this.asObjectOrNull(detailPageData.video),

      // episodes 驱动分集区；数组为空时分集区显示暂无分集。
      episodes: this.asList(detailPageData.episodes),

      // source 驱动来源状态区域；为 null 时显示暂无来源。
      source: this.asObjectOrNull(detailPageData.source)
    };
  },

  computed: {
    // hasVideo 表示详情页是否有主体视频信息可以渲染。
    hasVideo() {
      return Boolean(this.video);
    },

    // hasEpisodes 表示分集区是否有分集按钮可以渲染。
    hasEpisodes() {
      return this.episodes.length > 0;
    },

    // videoEyebrow 把类型、年份和首播日期组合成标题上方的短信息。
    videoEyebrow() {
      return this.joinTextParts([this.video.type, this.video.year, this.video.releaseDate], ' · ');
    },

    // videoMetaItems 生成详情页元信息标签，模板会循环渲染成多个小标签。
    videoMetaItems() {
      return [
        this.video.rating ? `${this.video.rating} 分` : '',
        this.video.region,
        this.video.language,
        this.video.alias
      ].filter(Boolean);
    },

    // displaySummary 表示详情页简介区域最终展示的文本。
    displaySummary() {
      return this.video.summary || '暂无简介。';
    },

    // sourceName 表示来源状态区展示的来源名称。
    sourceName() {
      return this.source ? this.source.sourceName || '未命名来源' : '暂无来源';
    },

    // sourceMessage 表示来源状态区展示的补充说明。
    sourceMessage() {
      return this.source ? this.source.message || '暂无来源说明。' : '当前详情没有来源信息。';
    },

    // genreText 表示题材区域最终展示的文本。
    genreText() {
      return this.joinTextParts(this.video.genreList, ' / ') || '暂无题材信息';
    },

    // directorText 表示导演区域最终展示的文本。
    directorText() {
      return this.joinTextParts(this.video.directorList, ' / ') || '暂无导演信息';
    },

    // actorText 表示演员区域最终展示的文本。
    actorText() {
      return this.joinTextParts(this.video.actorList, ' / ') || '暂无演员信息';
    },

    // episodeCountText 表示分集区头部展示的分集数量。
    episodeCountText() {
      return `${this.episodes.length} 个分集`;
    }
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * @param {*} value 可能来自详情页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      return Array.isArray(value) ? value : [];
    },

    /**
     * 把对象数据整理成对象或 null。
     *
     * @param {*} value 可能来自详情页数据文件的对象值。
     * @returns {Object|null} 有效对象原样返回，其他值统一转成 null。
     */
    asObjectOrNull(value) {
      // 数组不能作为普通对象使用，所以这里需要额外排除数组。
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      return value;
    },

    /**
     * 拼接文本数组。
     *
     * @param {Array} parts 需要拼接的文本片段。
     * @param {string} separator 片段之间使用的分隔符。
     * @returns {string} 过滤空值后的拼接文本。
     */
    joinTextParts(parts, separator) {
      // 只允许数组进入拼接流程，避免传入异常值导致页面报错。
      if (!Array.isArray(parts)) {
        return '';
      }

      // 过滤空字符串和空值，避免页面出现多余分隔符。
      return parts.filter(Boolean).join(separator);
    }
  }
};
</script>

<style scoped>
/*
  详情页整体容器。
  对应 template 中的 `.detail-view`，负责包裹详情页全部区域。
*/
.detail-view {
  /* 限制页面最大宽度，保证宽屏下内容不会过度拉伸。 */
  max-width: 1180px;

  /* 让详情页在主体区域中水平居中。 */
  width: 100%;

  /* 给页面上下留出空间，避免内容贴近导航栏和页脚。 */
  padding: 36px 32px 48px;

  /* 让 padding 计入宽度，避免横向溢出。 */
  box-sizing: border-box;
}

/*
  详情头部区域。
  对应 template 中的 `.detail-view__hero`，展示封面和主要信息。
*/
.detail-view__hero {
  /* 使用两列布局，左侧封面，右侧详情信息。 */
  display: grid;

  /* 左侧封面固定宽度，右侧信息占据剩余空间。 */
  grid-template-columns: 260px 1fr;

  /* 控制封面和信息区之间的距离。 */
  gap: 28px;

  /* 使用白色背景，让详情头部从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用浅色边框明确详情头部边界。 */
  border: 1px solid #e6eaf0;

  /* 保持内容型页面的统一圆角。 */
  border-radius: 8px;

  /* 给详情头部内部留出空间。 */
  padding: 24px;

  /* 控制详情头部和下方信息面板之间的距离。 */
  margin-bottom: 22px;
}

/*
  封面区域。
  对应 template 中的 `.detail-view__cover`，用于保留视频封面展示位。
*/
.detail-view__cover {
  /* 固定封面比例，保证详情页封面区域稳定。 */
  aspect-ratio: 3 / 4;

  /* 让封面角标可以定位到右下角。 */
  position: relative;

  /* 使用分层渐变模拟封面视觉，避免当前页面显得空白。 */
  background:
    linear-gradient(145deg, rgba(49, 95, 202, 0.26), rgba(31, 41, 55, 0.2)),
    linear-gradient(180deg, #dbe5f6 0%, #eef2f8 100%);

  /* 保持封面圆角和页面卡片风格一致。 */
  border-radius: 8px;

  /* 隐藏超出圆角的内容。 */
  overflow: hidden;
}

/*
  封面角标。
  对应 template 中的 `.detail-view__cover-badge`，展示更新状态或清晰度。
*/
.detail-view__cover-badge {
  /* 固定到封面右下角。 */
  position: absolute;

  /* 控制角标距离封面右侧的位置。 */
  right: 12px;

  /* 控制角标距离封面底部的位置。 */
  bottom: 12px;

  /* 给角标文字留出内部空间。 */
  padding: 5px 10px;

  /* 使用深色半透明背景，保证文字在封面上可读。 */
  background: rgba(24, 34, 53, 0.82);

  /* 使用白色文字提升对比度。 */
  color: #ffffff;

  /* 缩小字号，让角标保持辅助层级。 */
  font-size: 12px;

  /* 使用胶囊圆角，让角标视觉更轻。 */
  border-radius: 999px;
}

/*
  详情主要信息区。
  对应 template 中的 `.detail-view__main`，位于封面右侧。
*/
.detail-view__main {
  /* 使用纵向排列，让标题、元信息、简介和按钮自然向下排布。 */
  display: flex;

  /* 主轴改为纵向。 */
  flex-direction: column;

  /* 让右侧信息区至少撑满封面高度，按钮可以靠近底部。 */
  min-height: 100%;
}

/*
  详情短标签。
  对应 template 中的 `.detail-view__eyebrow`，展示类型、年份和日期。
*/
.detail-view__eyebrow {
  /* 清掉段落默认外边距。 */
  margin: 0 0 10px;

  /* 使用较小字号形成辅助层级。 */
  font-size: 13px;

  /* 使用较粗字重让短标签清晰可见。 */
  font-weight: 700;

  /* 使用蓝色和页面主题保持一致。 */
  color: #315fca;
}

/*
  详情标题。
  对应 template 中的 `.detail-view__title`，展示视频名称。
*/
.detail-view__title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用较大字号，让标题成为详情页视觉重点。 */
  font-size: 36px;

  /* 使用紧凑行高，保证标题多行时仍然稳定。 */
  line-height: 1.18;

  /* 使用较粗字重突出标题。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  元信息标签行。
  对应 template 中的 `.detail-view__meta-row`，展示评分、地区、语言和别名。
*/
.detail-view__meta-row {
  /* 使用 flex 让多个标签横向排列。 */
  display: flex;

  /* 允许标签换行，避免窄屏下挤出容器。 */
  flex-wrap: wrap;

  /* 控制标签之间的距离。 */
  gap: 8px;

  /* 控制元信息和标题之间的距离。 */
  margin-top: 14px;
}

/*
  单个元信息标签。
  对应 template 中的 `.detail-view__meta-item`。
*/
.detail-view__meta-item {
  /* 使用浅色背景形成标签形态。 */
  background: #eef3ff;

  /* 使用蓝色文字和页面主题保持一致。 */
  color: #315fca;

  /* 给标签文字留出内部空间。 */
  padding: 5px 10px;

  /* 使用胶囊圆角，适合短标签展示。 */
  border-radius: 999px;

  /* 缩小标签字号，保持辅助层级。 */
  font-size: 13px;
}

/*
  视频简介。
  对应 template 中的 `.detail-view__summary`。
*/
.detail-view__summary {
  /* 控制简介和上方元信息之间的距离。 */
  margin: 18px 0 0;

  /* 限制简介宽度，避免长文本铺满整行。 */
  max-width: 720px;

  /* 使用正文大小，保证简介易读。 */
  font-size: 15px;

  /* 设置舒适行高，适合多行简介。 */
  line-height: 1.8;

  /* 使用中性色，让简介处于正文层级。 */
  color: #5d6678;
}

/*
  来源状态区域。
  对应 template 中的 `.detail-view__source`，显示来源名称和状态说明。
*/
.detail-view__source {
  /* 使用 flex 让来源标签、名称和说明横向排列。 */
  display: flex;

  /* 允许内容换行，避免来源说明过长时溢出。 */
  flex-wrap: wrap;

  /* 垂直方向居中各段文字。 */
  align-items: center;

  /* 控制各段来源文字之间的距离。 */
  gap: 8px;

  /* 控制来源区域和简介之间的距离。 */
  margin-top: 18px;

  /* 给来源区域留出内部空间。 */
  padding: 12px 14px;

  /* 使用浅色背景强调这是状态提示区域。 */
  background: #f8fafc;

  /* 使用浅色边框明确区域边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和页面卡片一致的圆角。 */
  border-radius: 8px;
}

/*
  来源标签。
  对应 template 中的 `.detail-view__source-label`。
*/
.detail-view__source-label {
  /* 缩小字号，让标签处于辅助层级。 */
  font-size: 13px;

  /* 使用中性色，避免标签抢过来源名称。 */
  color: #667085;
}

/*
  来源名称。
  对应 template 中的 `.detail-view__source-name`。
*/
.detail-view__source-name {
  /* 使用较粗字重突出来源名称。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  来源说明。
  对应 template 中的 `.detail-view__source-message`。
*/
.detail-view__source-message {
  /* 使用较小字号，让说明和来源名称区分开。 */
  font-size: 13px;

  /* 使用中性色，保持说明文字辅助层级。 */
  color: #667085;
}

/*
  主要操作按钮。
  对应 template 中的 `.detail-view__primary-action`，当前展示播放入口形态。
*/
.detail-view__primary-action {
  /* 按钮和上方来源区域之间留出距离。 */
  margin-top: 22px;

  /* 让按钮宽度贴合内容，不占满整行。 */
  align-self: flex-start;

  /* 使用蓝色背景突出主要操作。 */
  background: #315fca;

  /* 去掉默认按钮边框，统一由背景表达按钮形态。 */
  border: 0;

  /* 给按钮留出稳定点击区域。 */
  padding: 12px 22px;

  /* 使用小圆角，和其他按钮风格保持一致。 */
  border-radius: 8px;

  /* 使用白色文字，提高按钮对比度。 */
  color: #ffffff;

  /* 设置按钮文字字号。 */
  font-size: 15px;

  /* 使用较粗字重突出主操作。 */
  font-weight: 700;

  /* 使用继承字体，保证按钮文字和页面一致。 */
  font-family: inherit;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;
}

/*
  信息面板。
  对应 template 中的 `.detail-view__info-panel`，展示题材、导演和演员。
*/
.detail-view__info-panel {
  /* 使用三列网格排列三个信息块。 */
  display: grid;

  /* 三列等宽，保证信息块排列整齐。 */
  grid-template-columns: repeat(3, 1fr);

  /* 控制信息块之间的距离。 */
  gap: 14px;

  /* 控制信息面板和分集区之间的距离。 */
  margin-bottom: 22px;
}

/*
  单个信息块。
  对应 template 中的 `.detail-view__info-block`。
*/
.detail-view__info-block {
  /* 使用白色背景，让信息块从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用浅色边框明确信息块边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和详情头部一致的圆角。 */
  border-radius: 8px;

  /* 给信息块内部文字留出空间。 */
  padding: 16px;
}

/*
  信息块标题。
  对应 template 中的 `.detail-view__info-title`。
*/
.detail-view__info-title {
  /* 清掉标题默认外边距。 */
  margin: 0 0 8px;

  /* 使用较小字号形成区块标题。 */
  font-size: 14px;

  /* 使用较粗字重突出信息分类。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  信息块正文。
  对应 template 中的 `.detail-view__info-text`。
*/
.detail-view__info-text {
  /* 清掉段落默认外边距。 */
  margin: 0;

  /* 设置正文大小，保证信息可读。 */
  font-size: 14px;

  /* 设置行高，适合多人名或多标签换行。 */
  line-height: 1.7;

  /* 使用中性色，让正文处于辅助层级。 */
  color: #5d6678;
}

/*
  分集区。
  对应 template 中的 `.detail-view__episodes`，展示分集按钮或暂无分集状态。
*/
.detail-view__episodes {
  /* 使用白色背景形成独立内容区。 */
  background: #ffffff;

  /* 使用浅色边框明确分集区边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和其他内容区一致的圆角。 */
  border-radius: 8px;

  /* 给分集区内部留出空间。 */
  padding: 20px;
}

/*
  分集区头部。
  对应 template 中的 `.detail-view__section-header`。
*/
.detail-view__section-header {
  /* 使用 flex 让标题和数量在同一行排列。 */
  display: flex;

  /* 垂直方向居中标题和数量。 */
  align-items: center;

  /* 标题靠左，数量靠右。 */
  justify-content: space-between;

  /* 控制头部和分集网格之间的距离。 */
  margin-bottom: 16px;
}

/*
  分集区标题。
  对应 template 中的 `.detail-view__section-title`。
*/
.detail-view__section-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用页面区块标题字号。 */
  font-size: 22px;

  /* 使用较粗字重突出区块标题。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  分集数量文字。
  对应 template 中的 `.detail-view__section-count`。
*/
.detail-view__section-count {
  /* 使用较小字号，让数量处于辅助层级。 */
  font-size: 14px;

  /* 使用中性色，不抢标题重点。 */
  color: #667085;
}

/*
  分集按钮网格。
  对应 template 中的 `.detail-view__episode-grid`。
*/
.detail-view__episode-grid {
  /* 使用网格布局管理分集按钮。 */
  display: grid;

  /* 每个按钮最小 150px，宽屏自动增加列数。 */
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));

  /* 控制分集按钮之间的距离。 */
  gap: 12px;
}

/*
  单个分集按钮。
  对应 template 中的 `.detail-view__episode`。
*/
.detail-view__episode {
  /* 使用白色背景，让普通分集按钮保持轻量。 */
  background: #ffffff;

  /* 使用浅色边框明确按钮边界。 */
  border: 1px solid #d6deea;

  /* 使用小圆角，和页面按钮风格一致。 */
  border-radius: 8px;

  /* 让 label 和 title 上下排列。 */
  display: flex;

  /* 主轴改为纵向，适合展示分集名称和标题。 */
  flex-direction: column;

  /* 左对齐文字，方便扫读分集列表。 */
  align-items: flex-start;

  /* 控制按钮内部文字间距。 */
  gap: 4px;

  /* 给分集按钮留出点击区域。 */
  padding: 12px 14px;

  /* 使用继承字体，保持按钮文字和页面一致。 */
  font-family: inherit;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;

  /* 让按钮文本左对齐，不使用系统默认居中。 */
  text-align: left;
}

/*
  当前选中分集按钮。
  对应 template 中 `episode.active` 为 true 的按钮。
*/
.detail-view__episode--active {
  /* 使用蓝色边框提示当前选中分集。 */
  border-color: #315fca;

  /* 使用浅蓝背景，让选中态和普通态区分开。 */
  background: #eef3ff;
}

/*
  分集显示名称。
  对应 template 中的 `.detail-view__episode-label`。
*/
.detail-view__episode-label {
  /* 使用较粗字重，让分集编号更清楚。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  分集标题或状态。
  对应 template 中的 `.detail-view__episode-title`。
*/
.detail-view__episode-title {
  /* 缩小字号，作为分集辅助说明。 */
  font-size: 13px;

  /* 使用中性色，保持辅助层级。 */
  color: #667085;
}

/*
  空状态区域。
  对应 template 中的 `.detail-view__empty`，用于暂无分集或暂无详情。
*/
.detail-view__empty {
  /* 使用浅色背景和页面内容区分开。 */
  background: #f8fafc;

  /* 使用虚线边框提示这里是占位状态。 */
  border: 1px dashed #d6deea;

  /* 保持和其他内容区一致的圆角。 */
  border-radius: 8px;

  /* 给空状态内部留出空间。 */
  padding: 36px 24px;

  /* 空状态文字居中显示。 */
  text-align: center;
}

/*
  整页空状态。
  对应 template 中 `.detail-view__empty--page`，在 video 为 null 时显示。
*/
.detail-view__empty--page {
  /* 提高整页空状态高度，避免页面显得塌陷。 */
  min-height: 420px;

  /* 使用 flex 把空状态内容放在视觉中心。 */
  display: flex;

  /* 标题和说明上下排列。 */
  flex-direction: column;

  /* 水平方向居中。 */
  align-items: center;

  /* 垂直方向居中。 */
  justify-content: center;
}

/*
  空状态标题。
  对应 template 中的 `.detail-view__empty-title`。
*/
.detail-view__empty-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用区块标题字号。 */
  font-size: 22px;

  /* 使用较粗字重突出提示。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  空状态说明。
  对应 template 中的 `.detail-view__empty-text`。
*/
.detail-view__empty-text {
  /* 控制说明和标题之间的距离。 */
  margin: 10px 0 0;

  /* 使用正文大小，保证说明易读。 */
  font-size: 15px;

  /* 使用中性色，让说明处于辅助层级。 */
  color: #667085;
}

/*
  窄屏详情页布局。
  触发条件：屏幕宽度不超过 820px。
  原因：手机宽度不足以保持封面和详情信息左右两列布局。
*/
@media (max-width: 820px) {
  .detail-view {
    /* 缩小页面左右内边距，给手机内容留出更多空间。 */
    padding: 28px 18px 40px;
  }

  .detail-view__hero {
    /* 详情头部改成单列，封面在上，文字在下。 */
    grid-template-columns: 1fr;
  }

  .detail-view__cover {
    /* 限制移动端封面最大宽度，避免封面过大。 */
    max-width: 260px;
  }

  .detail-view__info-panel {
    /* 信息面板改为单列，避免三列在手机上过窄。 */
    grid-template-columns: 1fr;
  }
}
</style>
