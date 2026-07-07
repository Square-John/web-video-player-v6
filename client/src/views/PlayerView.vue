<template>
  <!--
    PlayerView 页面渲染树

    {div.player-view}
    ├─ [if hasVideo] 播放内容分支
    │  ├─ {section.player-view__stage}
    │  │  ├─ {div.player-view__screen}
    │  │  │  ├─ [if isPlayReady] 播放占位区，显示播放类型和直连状态
    │  │  │  ├─ [else if isPlayError] 播放失败提示
    │  │  │  └─ [else if isPlayUnsupported] 不支持提示
    │  │  └─ {aside.player-view__side}
    │  │     ├─ {h1.player-view__title} 视频标题
    │  │     ├─ {p.player-view__episode} 当前分集
    │  │     ├─ {div.player-view__status-list} 播放状态、播放类型、直连标识和来源状态
    │  │     └─ {div.player-view__actions} 返回详情和重新加载按钮
    │  └─ {section.player-view__episodes}
    │     ├─ {header.player-view__section-header} 分集区标题
    │     ├─ [if hasEpisodes]
    │     │  └─ {button.player-view__episode-button} 循环渲染 episodes 分集按钮
    │     └─ [else]
    │        └─ {div.player-view__empty} 暂无分集状态
    └─ [else] 播放页空状态分支
       └─ {div.player-view__empty}
          ├─ {h2.player-view__empty-title} 空状态标题
          └─ {p.player-view__empty-text} 空状态说明
  -->
  <!--
    播放页。
    作用：展示播放器区域、当前播放信息、播放状态和分集切换入口。
  -->
  <div class="player-view">
    <!-- 有视频信息时渲染播放页主体内容。 -->
    <template v-if="hasVideo">
      <!-- 播放舞台区，左侧是播放器区域，右侧是当前播放信息。 -->
      <section class="player-view__stage">
        <!-- 播放器区域，当前先展示播放状态，不接真实 video 标签。 -->
        <div class="player-view__screen">
          <!-- 播放地址准备好时显示播放占位信息。 -->
          <div v-if="isPlayReady" class="player-view__screen-state">
            <p class="player-view__screen-label">播放地址已准备</p>
            <h2 class="player-view__screen-title">{{ playTypeText }}</h2>
            <p class="player-view__screen-text">{{ directPlayText }}</p>
          </div>

          <!-- 播放状态为 error 时显示失败提示。 -->
          <div v-else-if="isPlayError" class="player-view__screen-state">
            <p class="player-view__screen-label">播放失败</p>
            <h2 class="player-view__screen-title">暂时无法播放</h2>
            <p class="player-view__screen-text">{{ playMessage }}</p>
          </div>

          <!-- 播放状态为 unsupported 时显示不支持提示。 -->
          <div v-else-if="isPlayUnsupported" class="player-view__screen-state">
            <p class="player-view__screen-label">不支持播放</p>
            <h2 class="player-view__screen-title">该地址暂不支持直连播放</h2>
            <p class="player-view__screen-text">{{ playMessage }}</p>
          </div>

          <!-- 其他状态显示通用等待提示。 -->
          <div v-else class="player-view__screen-state">
            <p class="player-view__screen-label">准备播放</p>
            <h2 class="player-view__screen-title">正在等待播放信息</h2>
            <p class="player-view__screen-text">{{ playMessage }}</p>
          </div>
        </div>

        <!-- 当前播放信息侧栏，展示标题、分集和播放来源。 -->
        <aside class="player-view__side">
          <!-- 当前视频标题。 -->
          <h1 class="player-view__title">{{ video.title }}</h1>

          <!-- 当前分集展示文本。 -->
          <p class="player-view__episode">{{ currentEpisodeText }}</p>

          <!-- 播放状态列表，集中展示播放页关键状态。 -->
          <div class="player-view__status-list">
            <!-- 播放状态。 -->
            <div class="player-view__status-item">
              <span class="player-view__status-label">播放状态</span>
              <strong class="player-view__status-value">{{ playStatusText }}</strong>
            </div>

            <!-- 播放类型。 -->
            <div class="player-view__status-item">
              <span class="player-view__status-label">播放类型</span>
              <strong class="player-view__status-value">{{ playTypeText }}</strong>
            </div>

            <!-- 直连状态。 -->
            <div class="player-view__status-item">
              <span class="player-view__status-label">直连播放</span>
              <strong class="player-view__status-value">{{ directPlayText }}</strong>
            </div>

            <!-- 来源状态。 -->
            <div class="player-view__status-item">
              <span class="player-view__status-label">来源</span>
              <strong class="player-view__status-value">{{ sourceName }}</strong>
            </div>
          </div>

          <!-- 播放页辅助操作区，当前先展示按钮形态。 -->
          <div class="player-view__actions">
            <button type="button" class="player-view__button player-view__button--primary">
              返回详情
            </button>
            <button type="button" class="player-view__button">
              重新加载
            </button>
          </div>
        </aside>
      </section>

      <!-- 分集切换区，展示同一视频的其他分集入口。 -->
      <section class="player-view__episodes" aria-label="分集切换">
        <!-- 分集区头部，说明当前分集数量。 -->
        <header class="player-view__section-header">
          <h2 class="player-view__section-title">分集切换</h2>
          <span class="player-view__section-count">{{ episodeCountText }}</span>
        </header>

        <!-- 有分集数据时渲染分集按钮。 -->
        <div v-if="hasEpisodes" class="player-view__episode-grid">
          <!-- 每个按钮使用 label 展示，value 留给后续播放请求使用。 -->
          <button
            v-for="episode in episodes"
            :key="episode.id || episode.value"
            type="button"
            class="player-view__episode-button"
            :class="{ 'player-view__episode-button--active': episode.active }"
          >
            <span class="player-view__episode-label">{{ episode.label }}</span>
            <span class="player-view__episode-title">{{ episode.title || episode.remark || '可播放' }}</span>
          </button>
        </div>

        <!-- episodes 为空时，分集区保留空状态。 -->
        <div v-else class="player-view__empty">
          <h2 class="player-view__empty-title">暂无分集</h2>
          <p class="player-view__empty-text">当前播放数据没有提供可切换的分集。</p>
        </div>
      </section>
    </template>

    <!-- video 为 null 时，显示整页播放空状态。 -->
    <div v-else class="player-view__empty player-view__empty--page">
      <h2 class="player-view__empty-title">暂无播放信息</h2>
      <p class="player-view__empty-text">当前没有可展示的播放数据。</p>
    </div>
  </div>
</template>

<script>
// 播放页静态数据，记录视频信息、当前分集、播放状态、分集列表和来源状态。
import { playerPageData } from '../data/page-player.mock';

export default {
  // 组件名称用于在调试工具和报错信息中识别播放页。
  name: 'PlayerView',

  data() {
    return {
      // video 驱动播放页标题和基础信息区；为 null 时显示播放页空状态。
      video: this.asObjectOrNull(playerPageData.video),

      // currentEpisode 驱动当前分集展示；为 null 时显示暂无当前分集。
      currentEpisode: this.asObjectOrNull(playerPageData.currentEpisode),

      // play 驱动播放器区域和播放状态列表；为 null 时显示等待播放信息。
      play: this.asObjectOrNull(playerPageData.play),

      // episodes 驱动分集切换区；数组为空时分集区显示暂无分集。
      episodes: this.asList(playerPageData.episodes),

      // source 驱动来源状态展示；为 null 时显示暂无来源。
      source: this.asObjectOrNull(playerPageData.source)
    };
  },

  computed: {
    // hasVideo 表示播放页是否有主体视频信息可以渲染。
    hasVideo() {
      return Boolean(this.video);
    },

    // hasEpisodes 表示分集切换区是否有分集按钮可以渲染。
    hasEpisodes() {
      return this.episodes.length > 0;
    },

    // isPlayReady 表示播放地址已准备好，可以展示播放占位区。
    isPlayReady() {
      return this.play && this.play.status === 'ready' && Boolean(this.play.url);
    },

    // isPlayError 表示播放状态为失败。
    isPlayError() {
      return this.play && this.play.status === 'error';
    },

    // isPlayUnsupported 表示当前播放地址不支持直连播放。
    isPlayUnsupported() {
      return this.play && this.play.status === 'unsupported';
    },

    // currentEpisodeText 表示侧栏中展示的当前分集信息。
    currentEpisodeText() {
      if (!this.currentEpisode) {
        return '暂无当前分集';
      }

      return this.currentEpisode.title
        ? `${this.currentEpisode.label} · ${this.currentEpisode.title}`
        : this.currentEpisode.label;
    },

    // playStatusText 表示侧栏中展示的播放状态。
    playStatusText() {
      return this.play ? this.play.status || 'unknown' : 'unknown';
    },

    // playTypeText 表示侧栏和播放占位区展示的播放类型。
    playTypeText() {
      return this.play ? this.play.type || 'unknown' : 'unknown';
    },

    // playMessage 表示播放器区域展示的提示信息。
    playMessage() {
      return this.play ? this.play.message || '暂无播放提示。' : '暂无播放信息。';
    },

    // directPlayText 表示当前播放地址是否为浏览器直连地址。
    directPlayText() {
      if (!this.play) {
        return '未知';
      }

      return this.play.isDirect ? '是' : '否';
    },

    // sourceName 表示来源状态区展示的来源名称。
    sourceName() {
      return this.source ? this.source.sourceName || '未命名来源' : '暂无来源';
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
     * @param {*} value 可能来自播放页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      return Array.isArray(value) ? value : [];
    },

    /**
     * 把对象数据整理成对象或 null。
     *
     * @param {*} value 可能来自播放页数据文件的对象值。
     * @returns {Object|null} 有效对象原样返回，其他值统一转成 null。
     */
    asObjectOrNull(value) {
      // 数组不能作为普通对象使用，所以这里需要额外排除数组。
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      return value;
    }
  }
};
</script>

<style scoped>
/*
  播放页整体容器。
  对应 template 中的 `.player-view`，负责包裹播放页全部区域。
*/
.player-view {
  /* 限制页面最大宽度，保证宽屏下内容不会过度拉伸。 */
  max-width: 1180px;

  /* 让播放页在主体区域中水平居中。 */
  width: 100%;

  /* 给页面上下留出空间，避免内容贴近导航栏和页脚。 */
  padding: 36px 32px 48px;

  /* 让 padding 计入宽度，避免横向溢出。 */
  box-sizing: border-box;
}

/*
  播放舞台区。
  对应 template 中的 `.player-view__stage`，左侧播放器，右侧播放信息。
*/
.player-view__stage {
  /* 使用两列布局组织播放器和侧栏信息。 */
  display: grid;

  /* 左侧播放器占主要宽度，右侧侧栏固定最小宽度。 */
  grid-template-columns: minmax(0, 1fr) 320px;

  /* 控制播放器和侧栏之间的距离。 */
  gap: 22px;

  /* 控制播放舞台和分集区之间的距离。 */
  margin-bottom: 22px;
}

/*
  播放器区域。
  对应 template 中的 `.player-view__screen`，当前用于展示播放状态占位。
*/
.player-view__screen {
  /* 使用深色背景模拟播放器画布。 */
  background: #111827;

  /* 固定播放器比例，保持视频区域稳定。 */
  aspect-ratio: 16 / 9;

  /* 使用圆角让播放器区域和页面其他卡片保持一致。 */
  border-radius: 8px;

  /* 隐藏溢出内容，保证圆角边界完整。 */
  overflow: hidden;

  /* 使用 flex 让播放状态内容居中。 */
  display: flex;

  /* 水平方向居中。 */
  align-items: center;

  /* 垂直方向居中。 */
  justify-content: center;

  /* 给播放器内部留出安全空间。 */
  padding: 32px;

  /* 让 padding 计入尺寸，避免播放器区域溢出。 */
  box-sizing: border-box;
}

/*
  播放器状态内容。
  对应 template 中的 `.player-view__screen-state`。
*/
.player-view__screen-state {
  /* 播放状态文字居中显示。 */
  text-align: center;

  /* 限制状态文案宽度，避免长文本铺满播放器。 */
  max-width: 520px;
}

/*
  播放器状态短标签。
  对应 template 中的 `.player-view__screen-label`。
*/
.player-view__screen-label {
  /* 清掉段落默认外边距。 */
  margin: 0 0 10px;

  /* 使用较小字号形成辅助层级。 */
  font-size: 13px;

  /* 使用较粗字重让状态标签清晰可见。 */
  font-weight: 700;

  /* 使用浅蓝色，让标签在深色播放器背景上可读。 */
  color: #93c5fd;
}

/*
  播放器状态标题。
  对应 template 中的 `.player-view__screen-title`。
*/
.player-view__screen-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用较大字号，让播放状态成为播放器区域视觉重点。 */
  font-size: 32px;

  /* 使用紧凑行高，保证多行标题稳定。 */
  line-height: 1.2;

  /* 使用白色文字，提高深色背景上的可读性。 */
  color: #ffffff;
}

/*
  播放器状态说明。
  对应 template 中的 `.player-view__screen-text`。
*/
.player-view__screen-text {
  /* 控制说明和标题之间的距离。 */
  margin: 12px 0 0;

  /* 使用正文大小，保证提示易读。 */
  font-size: 15px;

  /* 设置舒适行高，适合多行说明。 */
  line-height: 1.7;

  /* 使用浅灰色文字，保持辅助层级。 */
  color: #d1d5db;
}

/*
  播放信息侧栏。
  对应 template 中的 `.player-view__side`，展示标题、分集和状态。
*/
.player-view__side {
  /* 使用白色背景，让侧栏从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用浅色边框明确侧栏边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和页面其他内容区一致的圆角。 */
  border-radius: 8px;

  /* 给侧栏内部留出空间。 */
  padding: 20px;

  /* 让标题、状态和按钮纵向排列。 */
  display: flex;

  /* 主轴改为纵向。 */
  flex-direction: column;
}

/*
  当前视频标题。
  对应 template 中的 `.player-view__title`。
*/
.player-view__title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用较大字号突出当前视频。 */
  font-size: 26px;

  /* 使用紧凑行高，保证标题换行后仍然稳定。 */
  line-height: 1.25;

  /* 使用较粗字重突出标题。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  当前分集文本。
  对应 template 中的 `.player-view__episode`。
*/
.player-view__episode {
  /* 控制分集文本和标题之间的距离。 */
  margin: 10px 0 0;

  /* 使用正文大小，保持当前分集信息易读。 */
  font-size: 15px;

  /* 使用中性色，让分集处于辅助层级。 */
  color: #667085;
}

/*
  播放状态列表。
  对应 template 中的 `.player-view__status-list`。
*/
.player-view__status-list {
  /* 控制状态列表和分集文本之间的距离。 */
  margin-top: 20px;

  /* 使用纵向排列，让状态项一行一个。 */
  display: grid;

  /* 控制状态项之间的距离。 */
  gap: 10px;
}

/*
  单个状态项。
  对应 template 中的 `.player-view__status-item`。
*/
.player-view__status-item {
  /* 使用浅色背景突出状态区域。 */
  background: #f8fafc;

  /* 使用浅色边框明确状态项边界。 */
  border: 1px solid #e6eaf0;

  /* 保持状态项圆角。 */
  border-radius: 8px;

  /* 给状态项内部留出空间。 */
  padding: 12px;
}

/*
  状态标签。
  对应 template 中的 `.player-view__status-label`。
*/
.player-view__status-label {
  /* 独占一行，和下方状态值形成上下结构。 */
  display: block;

  /* 控制标签和状态值之间的距离。 */
  margin-bottom: 5px;

  /* 使用较小字号形成辅助层级。 */
  font-size: 13px;

  /* 使用中性色，避免标签比状态值更抢眼。 */
  color: #667085;
}

/*
  状态值。
  对应 template 中的 `.player-view__status-value`。
*/
.player-view__status-value {
  /* 独占一行，保证状态值清楚。 */
  display: block;

  /* 使用较粗字重突出状态值。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  辅助操作区。
  对应 template 中的 `.player-view__actions`，展示返回详情和重新加载按钮。
*/
.player-view__actions {
  /* 操作按钮和状态列表之间留出距离。 */
  margin-top: 20px;

  /* 使用 flex 让按钮横向排列。 */
  display: flex;

  /* 控制按钮之间的距离。 */
  gap: 10px;

  /* 允许按钮在窄宽度下换行。 */
  flex-wrap: wrap;
}

/*
  普通操作按钮。
  对应 template 中的 `.player-view__button`。
*/
.player-view__button {
  /* 使用白色背景，让普通按钮保持轻量。 */
  background: #ffffff;

  /* 使用浅色边框明确按钮边界。 */
  border: 1px solid #d6deea;

  /* 给按钮留出稳定点击区域。 */
  padding: 10px 14px;

  /* 使用小圆角，和其他按钮保持一致。 */
  border-radius: 8px;

  /* 使用深色文字保证可读性。 */
  color: #182235;

  /* 设置按钮文字大小。 */
  font-size: 14px;

  /* 使用较粗字重提升按钮辨识度。 */
  font-weight: 700;

  /* 使用继承字体，保证按钮文字风格统一。 */
  font-family: inherit;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;
}

/*
  主要操作按钮。
  对应 template 中的 `.player-view__button--primary`。
*/
.player-view__button--primary {
  /* 使用蓝色背景突出主要操作。 */
  background: #315fca;

  /* 主按钮使用同色边框，避免边缘出现杂色。 */
  border-color: #315fca;

  /* 主按钮文字使用白色，提高对比度。 */
  color: #ffffff;
}

/*
  分集切换区。
  对应 template 中的 `.player-view__episodes`。
*/
.player-view__episodes {
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
  对应 template 中的 `.player-view__section-header`。
*/
.player-view__section-header {
  /* 使用 flex 让标题和数量在同一行排列。 */
  display: flex;

  /* 垂直方向居中标题和数量。 */
  align-items: center;

  /* 标题靠左，数量靠右。 */
  justify-content: space-between;

  /* 控制头部和分集按钮之间的距离。 */
  margin-bottom: 16px;
}

/*
  分集区标题。
  对应 template 中的 `.player-view__section-title`。
*/
.player-view__section-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用区块标题字号。 */
  font-size: 22px;

  /* 使用较粗字重突出区块标题。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  分集数量文字。
  对应 template 中的 `.player-view__section-count`。
*/
.player-view__section-count {
  /* 使用较小字号，让数量处于辅助层级。 */
  font-size: 14px;

  /* 使用中性色，不抢标题重点。 */
  color: #667085;
}

/*
  分集按钮网格。
  对应 template 中的 `.player-view__episode-grid`。
*/
.player-view__episode-grid {
  /* 使用网格布局管理分集按钮。 */
  display: grid;

  /* 每个按钮最小 150px，宽屏自动增加列数。 */
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));

  /* 控制分集按钮之间的距离。 */
  gap: 12px;
}

/*
  单个分集按钮。
  对应 template 中的 `.player-view__episode-button`。
*/
.player-view__episode-button {
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
.player-view__episode-button--active {
  /* 使用蓝色边框提示当前播放分集。 */
  border-color: #315fca;

  /* 使用浅蓝背景，让选中态和普通态区分开。 */
  background: #eef3ff;
}

/*
  分集显示名称。
  对应 template 中的 `.player-view__episode-label`。
*/
.player-view__episode-label {
  /* 使用较粗字重，让分集编号更清楚。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  分集标题或状态。
  对应 template 中的 `.player-view__episode-title`。
*/
.player-view__episode-title {
  /* 缩小字号，作为分集辅助说明。 */
  font-size: 13px;

  /* 使用中性色，保持辅助层级。 */
  color: #667085;
}

/*
  空状态区域。
  对应 template 中的 `.player-view__empty`，用于暂无分集或暂无播放信息。
*/
.player-view__empty {
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
  对应 template 中 `.player-view__empty--page`，在 video 为 null 时显示。
*/
.player-view__empty--page {
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
  对应 template 中的 `.player-view__empty-title`。
*/
.player-view__empty-title {
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
  对应 template 中的 `.player-view__empty-text`。
*/
.player-view__empty-text {
  /* 控制说明和标题之间的距离。 */
  margin: 10px 0 0;

  /* 使用正文大小，保证说明易读。 */
  font-size: 15px;

  /* 使用中性色，让说明处于辅助层级。 */
  color: #667085;
}

/*
  窄屏播放页布局。
  触发条件：屏幕宽度不超过 900px。
  原因：手机或窄屏下无法稳定保持播放器和侧栏左右两列。
*/
@media (max-width: 900px) {
  .player-view {
    /* 缩小页面左右内边距，给窄屏内容留出更多空间。 */
    padding: 28px 18px 40px;
  }

  .player-view__stage {
    /* 播放器和侧栏改成上下排列，避免侧栏挤压播放器。 */
    grid-template-columns: 1fr;
  }
}
</style>
