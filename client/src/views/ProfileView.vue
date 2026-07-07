<template>
  <!--
    ProfileView 页面渲染树

    {div.profile-view}
    ├─ {section.profile-view__user-card}
    │  ├─ {div.profile-view__avatar} 用户头像占位
    │  └─ {div.profile-view__user-info}
    │     ├─ [if hasUser] 用户名称、角色、状态和说明
    │     └─ [else] 游客空状态说明
    ├─ {section.profile-view__content-grid}
    │  ├─ {article.profile-view__panel} 播放历史分区
    │  │  ├─ {header.profile-view__panel-header} 分区标题和数量
    │  │  ├─ [if hasPlayHistory]
    │  │  │  └─ {article.profile-view__history-item} 循环渲染播放历史
    │  │  └─ [else]
    │  │     └─ {div.profile-view__empty} 播放历史空状态
    │  └─ {article.profile-view__panel} 收藏列表分区
    │     ├─ {header.profile-view__panel-header} 分区标题和数量
    │     ├─ [if hasFavorites]
    │     │  └─ {article.profile-view__favorite-item} 循环渲染收藏条目
    │     └─ [else]
    │        └─ {div.profile-view__empty} 收藏列表空状态
    └─ {section.profile-view__actions}
       ├─ {header.profile-view__panel-header} 本地数据标题
       ├─ [if hasLocalActions]
       │  └─ {button.profile-view__action-button} 循环渲染本地数据操作入口
       └─ [else]
          └─ {div.profile-view__empty} 本地操作空状态
  -->
  <!--
    个人中心页。
    作用：展示当前用户状态、播放历史、收藏列表和本地数据操作入口。
  -->
  <div class="profile-view">
    <!-- 用户信息卡，位于个人中心页面顶部。 -->
    <section class="profile-view__user-card">
      <!-- 用户头像占位，当前使用名称首字母或游客标识展示。 -->
      <div class="profile-view__avatar" aria-hidden="true">{{ userInitial }}</div>

      <!-- 用户文字信息区域。 -->
      <div class="profile-view__user-info">
        <!-- 有用户对象时展示名称、角色、状态和说明。 -->
        <template v-if="hasUser">
          <p class="profile-view__eyebrow">{{ userRoleText }}</p>
          <h1 class="profile-view__title">{{ user.name }}</h1>
          <div class="profile-view__meta-row">
            <span class="profile-view__meta-item">{{ userStatusText }}</span>
            <span class="profile-view__meta-item">{{ historyCountText }}</span>
            <span class="profile-view__meta-item">{{ favoriteCountText }}</span>
          </div>
          <p class="profile-view__message">{{ user.message || '暂无用户说明。' }}</p>
        </template>

        <!-- 没有用户对象时展示整块用户信息空状态。 -->
        <template v-else>
          <p class="profile-view__eyebrow">游客状态</p>
          <h1 class="profile-view__title">暂无用户信息</h1>
          <p class="profile-view__message">当前没有可展示的用户资料。</p>
        </template>
      </div>
    </section>

    <!-- 播放历史和收藏列表双栏内容区。 -->
    <section class="profile-view__content-grid">
      <!-- 播放历史分区，展示最近继续观看入口。 -->
      <article class="profile-view__panel">
        <!-- 播放历史分区标题，右侧显示当前条目数量。 -->
        <header class="profile-view__panel-header">
          <h2 class="profile-view__panel-title">播放历史</h2>
          <span class="profile-view__panel-count">{{ historyCountText }}</span>
        </header>

        <!-- 有播放历史时渲染历史条目列表。 -->
        <div v-if="hasPlayHistory" class="profile-view__list">
          <!-- 播放历史条目，episodeLabel 用于显示，episodeValue 留给后续播放参数。 -->
          <article
            v-for="item in playHistory"
            :key="item.id || item.videoId"
            class="profile-view__history-item"
          >
            <!-- 历史条目封面占位。 -->
            <div class="profile-view__poster" aria-hidden="true"></div>

            <!-- 历史条目的标题、分集和进度。 -->
            <div class="profile-view__item-main">
              <h3 class="profile-view__item-title">{{ item.title || '未命名视频' }}</h3>
              <p class="profile-view__item-text">{{ formatHistoryText(item) }}</p>
              <p class="profile-view__item-meta">{{ item.updatedAt || '暂无观看时间' }}</p>
            </div>

            <!-- 继续播放按钮，当前先保留按钮形态。 -->
            <button type="button" class="profile-view__small-button">继续播放</button>
          </article>
        </div>

        <!-- playHistory 为空时，播放历史分区保留空状态。 -->
        <div v-else class="profile-view__empty">
          <h3 class="profile-view__empty-title">暂无播放历史</h3>
          <p class="profile-view__empty-text">看过的内容会显示在这里。</p>
        </div>
      </article>

      <!-- 收藏列表分区，展示用户保存的视频。 -->
      <article class="profile-view__panel">
        <!-- 收藏分区标题，右侧显示当前收藏数量。 -->
        <header class="profile-view__panel-header">
          <h2 class="profile-view__panel-title">我的收藏</h2>
          <span class="profile-view__panel-count">{{ favoriteCountText }}</span>
        </header>

        <!-- 有收藏数据时渲染收藏条目列表。 -->
        <div v-if="hasFavorites" class="profile-view__list">
          <!-- 收藏条目，videoId 后续用于跳转详情页。 -->
          <article
            v-for="item in favorites"
            :key="item.id || item.videoId"
            class="profile-view__favorite-item"
          >
            <!-- 收藏条目封面占位。 -->
            <div class="profile-view__poster" aria-hidden="true"></div>

            <!-- 收藏条目的标题、摘要和元信息。 -->
            <div class="profile-view__item-main">
              <h3 class="profile-view__item-title">{{ item.title || '未命名视频' }}</h3>
              <p class="profile-view__item-text">{{ item.summary || '暂无简介。' }}</p>
              <p class="profile-view__item-meta">{{ formatFavoriteMeta(item) }}</p>
            </div>

            <!-- 查看详情按钮，当前先保留按钮形态。 -->
            <button type="button" class="profile-view__small-button">查看详情</button>
          </article>
        </div>

        <!-- favorites 为空时，收藏分区保留空状态。 -->
        <div v-else class="profile-view__empty">
          <h3 class="profile-view__empty-title">暂无收藏</h3>
          <p class="profile-view__empty-text">收藏的视频会显示在这里。</p>
        </div>
      </article>
    </section>

    <!-- 本地数据操作区，展示清理历史、清理收藏等入口。 -->
    <section class="profile-view__actions">
      <!-- 本地数据操作区标题。 -->
      <header class="profile-view__panel-header">
        <div>
          <h2 class="profile-view__panel-title">本地数据</h2>
          <p class="profile-view__panel-desc">管理当前浏览器内保存的个人数据。</p>
        </div>
      </header>

      <!-- 有操作定义时渲染操作按钮。 -->
      <div v-if="hasLocalActions" class="profile-view__action-grid">
        <!-- 本地操作按钮，danger 为 true 时显示风险操作样式。 -->
        <button
          v-for="action in localActions"
          :key="action.id"
          type="button"
          class="profile-view__action-button"
          :class="{ 'profile-view__action-button--danger': action.danger }"
        >
          <strong class="profile-view__action-label">{{ action.label }}</strong>
          <span class="profile-view__action-desc">{{ action.description }}</span>
        </button>
      </div>

      <!-- localActions 为空时，操作区保留空状态。 -->
      <div v-else class="profile-view__empty">
        <h3 class="profile-view__empty-title">暂无本地操作</h3>
        <p class="profile-view__empty-text">当前没有可执行的本地数据操作。</p>
      </div>
    </section>
  </div>
</template>

<script>
// 个人中心页本地数据，记录用户信息、播放历史、收藏列表和本地操作入口。
import { profilePageData } from '../data/page-profile.mock';

export default {
  // 组件名称用于在调试工具和报错信息中识别个人中心页。
  name: 'ProfileView',

  data() {
    return {
      // user 驱动顶部用户信息卡；为 null 时显示用户信息空状态。
      user: this.asObjectOrNull(profilePageData.user),

      // playHistory 驱动播放历史分区；数组为空时该分区显示暂无播放历史。
      playHistory: this.asList(profilePageData.playHistory),

      // favorites 驱动收藏列表分区；数组为空时该分区显示暂无收藏。
      favorites: this.asList(profilePageData.favorites),

      // localActions 驱动本地数据操作区；数组为空时该分区显示暂无操作。
      localActions: this.asList(profilePageData.localActions)
    };
  },

  computed: {
    // hasUser 表示页面顶部是否有用户资料可以展示。
    hasUser() {
      return Boolean(this.user);
    },

    // hasPlayHistory 表示播放历史分区是否有条目可以渲染。
    hasPlayHistory() {
      return this.playHistory.length > 0;
    },

    // hasFavorites 表示收藏列表分区是否有条目可以渲染。
    hasFavorites() {
      return this.favorites.length > 0;
    },

    // hasLocalActions 表示本地数据操作区是否有按钮可以渲染。
    hasLocalActions() {
      return this.localActions.length > 0;
    },

    // userInitial 表示头像占位中展示的文字。
    userInitial() {
      if (!this.user || !this.user.name) {
        return '客';
      }

      return this.user.name.slice(0, 1);
    },

    // userRoleText 表示用户信息卡上方展示的角色文本。
    userRoleText() {
      if (!this.user || !this.user.role) {
        return '游客状态';
      }

      return this.user.role === 'guest' ? '游客状态' : this.user.role;
    },

    // userStatusText 表示用户信息卡元信息中展示的数据状态。
    userStatusText() {
      if (!this.user || !this.user.status) {
        return '状态未知';
      }

      return this.user.status === 'local' ? '本地数据' : this.user.status;
    },

    // historyCountText 表示用户信息卡和播放历史标题处展示的历史数量。
    historyCountText() {
      return `${this.playHistory.length} 条历史`;
    },

    // favoriteCountText 表示用户信息卡和收藏标题处展示的收藏数量。
    favoriteCountText() {
      return `${this.favorites.length} 个收藏`;
    }
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * @param {*} value 可能来自个人中心数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      return Array.isArray(value) ? value : [];
    },

    /**
     * 把对象数据整理成对象或 null。
     *
     * @param {*} value 可能来自个人中心数据文件的对象值。
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
     * 生成播放历史条目说明。
     *
     * @param {Object} item 单条播放历史数据。
     * @returns {string} 分集、进度和来源拼接后的展示文本。
     */
    formatHistoryText(item) {
      // episodeLabel 用于页面显示，episodeValue 保留给后续播放参数，不直接显示。
      const episodeText = item.episodeLabel || '暂无分集';

      // progressText 表示用户上次看到哪里，没有时给出统一占位。
      const progressText = item.progressText || '暂无进度';

      // sourceId 帮助后续追踪历史来源，没有时不参与拼接。
      const sourceText = item.sourceId ? `来源：${item.sourceId}` : '';

      return [episodeText, progressText, sourceText].filter(Boolean).join(' · ');
    },

    /**
     * 生成收藏条目元信息。
     *
     * @param {Object} item 单条收藏数据。
     * @returns {string} 年份、评分和来源拼接后的展示文本。
     */
    formatFavoriteMeta(item) {
      // 年份、评分和来源都是辅助信息，缺失时自动过滤掉。
      const parts = [
        item.year,
        item.rating ? `${item.rating} 分` : '',
        item.sourceId ? `来源：${item.sourceId}` : ''
      ];

      return parts.filter(Boolean).join(' · ') || '暂无补充信息';
    }
  }
};
</script>

<style scoped>
/*
  个人中心整体容器。
  对应 template 中的 `.profile-view`，负责包裹用户卡、播放历史、收藏和本地操作区。
*/
.profile-view {
  /* 限制页面最大宽度，保证宽屏下内容不会过度拉伸。 */
  max-width: 1180px;

  /* 让个人中心页面在主体区域中水平居中。 */
  width: 100%;

  /* 给页面上下留出空间，避免内容贴近导航栏和页脚。 */
  padding: 36px 32px 48px;

  /* 让 padding 计入宽度，避免横向溢出。 */
  box-sizing: border-box;
}

/*
  用户信息卡。
  对应 template 中的 `.profile-view__user-card`，展示头像、名称和用户状态。
*/
.profile-view__user-card {
  /* 使用 flex 让头像和用户信息横向排列。 */
  display: flex;

  /* 垂直方向让头像和文字顶部对齐。 */
  align-items: flex-start;

  /* 控制头像和文字信息之间的距离。 */
  gap: 22px;

  /* 使用白色背景，让用户卡从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用浅色边框明确卡片边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和其他页面卡片一致的圆角。 */
  border-radius: 8px;

  /* 给用户卡内部留出空间。 */
  padding: 24px;

  /* 控制用户卡和下方内容网格之间的距离。 */
  margin-bottom: 22px;
}

/*
  头像占位。
  对应 template 中的 `.profile-view__avatar`，显示用户名首字或游客标识。
*/
.profile-view__avatar {
  /* 固定头像宽度，保证用户卡左侧区域稳定。 */
  width: 76px;

  /* 固定头像高度，形成正方形头像容器。 */
  height: 76px;

  /* 使用圆形头像视觉。 */
  border-radius: 50%;

  /* 使用渐变背景，让占位头像有明确视觉层级。 */
  background: linear-gradient(145deg, #315fca, #6b8cff);

  /* 使用白色文字保证头像文字可读。 */
  color: #ffffff;

  /* 使用较大字号突出头像文字。 */
  font-size: 28px;

  /* 使用较粗字重，让头像文字更清晰。 */
  font-weight: 700;

  /* 使用 flex 居中头像文字。 */
  display: flex;

  /* 水平方向居中头像文字。 */
  align-items: center;

  /* 垂直方向居中头像文字。 */
  justify-content: center;

  /* 禁止头像被右侧文字挤压变形。 */
  flex: 0 0 auto;
}

/*
  用户文字信息区域。
  对应 template 中的 `.profile-view__user-info`，位于头像右侧。
*/
.profile-view__user-info {
  /* 允许用户信息占据头像右侧剩余宽度。 */
  flex: 1;

  /* 防止长文本撑破 flex 容器。 */
  min-width: 0;
}

/*
  用户角色短标签。
  对应 template 中的 `.profile-view__eyebrow`，展示游客状态或角色文本。
*/
.profile-view__eyebrow {
  /* 清掉段落默认外边距。 */
  margin: 0 0 8px;

  /* 使用较小字号形成辅助信息层级。 */
  font-size: 13px;

  /* 使用较粗字重让短标签清晰可见。 */
  font-weight: 700;

  /* 使用蓝色和页面主题保持一致。 */
  color: #315fca;
}

/*
  用户名称标题。
  对应 template 中的 `.profile-view__title`，展示当前用户名称或空状态标题。
*/
.profile-view__title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用较大字号，让用户名成为用户卡视觉重点。 */
  font-size: 34px;

  /* 使用紧凑行高，保证长用户名换行后仍然稳定。 */
  line-height: 1.18;

  /* 使用较粗字重突出用户名。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  用户信息标签行。
  对应 template 中的 `.profile-view__meta-row`，展示状态、历史数量和收藏数量。
*/
.profile-view__meta-row {
  /* 使用 flex 让多个标签横向排列。 */
  display: flex;

  /* 允许标签换行，避免窄屏下挤出容器。 */
  flex-wrap: wrap;

  /* 控制标签之间的距离。 */
  gap: 8px;

  /* 控制标签行和用户名之间的距离。 */
  margin-top: 14px;
}

/*
  单个用户信息标签。
  对应 template 中的 `.profile-view__meta-item`。
*/
.profile-view__meta-item {
  /* 使用浅色背景形成轻量标签。 */
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
  用户说明文本。
  对应 template 中的 `.profile-view__message`。
*/
.profile-view__message {
  /* 控制说明和标签之间的距离。 */
  margin: 14px 0 0;

  /* 使用正文大小，保证说明文字易读。 */
  font-size: 15px;

  /* 使用舒适行高，适合较长说明。 */
  line-height: 1.7;

  /* 使用中性色，让说明处于辅助层级。 */
  color: #5d6678;
}

/*
  播放历史和收藏双栏容器。
  对应 template 中的 `.profile-view__content-grid`。
*/
.profile-view__content-grid {
  /* 使用 grid 管理双栏布局。 */
  display: grid;

  /* 两列平均分配空间，保证播放历史和收藏列表权重一致。 */
  grid-template-columns: repeat(2, minmax(0, 1fr));

  /* 控制两个分区之间的距离。 */
  gap: 22px;

  /* 控制双栏内容和下方本地操作区之间的距离。 */
  margin-bottom: 22px;
}

/*
  通用内容面板。
  对应 template 中的 `.profile-view__panel`，用于播放历史和收藏列表。
*/
.profile-view__panel {
  /* 使用白色背景，让面板从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用浅色边框明确面板边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和其他内容卡片一致的圆角。 */
  border-radius: 8px;

  /* 给面板内部留出空间。 */
  padding: 20px;
}

/*
  面板头部。
  对应 template 中的 `.profile-view__panel-header`，展示标题和数量。
*/
.profile-view__panel-header {
  /* 使用 flex 让标题和数量位于同一行。 */
  display: flex;

  /* 让标题靠左、数量靠右。 */
  justify-content: space-between;

  /* 垂直方向居中标题和数量。 */
  align-items: center;

  /* 控制面板头部和列表内容之间的距离。 */
  margin-bottom: 16px;

  /* 控制标题和数量之间的最小间距。 */
  gap: 12px;
}

/*
  面板标题。
  对应 template 中的 `.profile-view__panel-title`。
*/
.profile-view__panel-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用中等字号，适合作为分区标题。 */
  font-size: 20px;

  /* 使用较粗字重突出分区标题。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  面板数量标签。
  对应 template 中的 `.profile-view__panel-count`。
*/
.profile-view__panel-count {
  /* 缩小字号，让数量作为辅助信息展示。 */
  font-size: 13px;

  /* 使用中性色，避免数量抢过标题。 */
  color: #667085;
}

/*
  本地数据说明文本。
  对应 template 中的 `.profile-view__panel-desc`。
*/
.profile-view__panel-desc {
  /* 控制说明和标题之间的距离。 */
  margin: 6px 0 0;

  /* 使用正文偏小字号，保持说明层级。 */
  font-size: 14px;

  /* 使用中性色显示说明。 */
  color: #667085;
}

/*
  列表容器。
  对应 template 中的 `.profile-view__list`，包裹播放历史和收藏条目。
*/
.profile-view__list {
  /* 使用纵向 flex 让条目从上到下排列。 */
  display: flex;

  /* 主轴改为纵向。 */
  flex-direction: column;

  /* 控制条目之间的距离。 */
  gap: 12px;
}

/*
  播放历史条目。
  对应 template 中的 `.profile-view__history-item`。
*/
.profile-view__history-item,
.profile-view__favorite-item {
  /* 使用 flex 让封面、文字和按钮横向排列。 */
  display: flex;

  /* 让条目内容顶部对齐。 */
  align-items: flex-start;

  /* 控制封面、文字和按钮之间的距离。 */
  gap: 12px;

  /* 给条目内部留出空间。 */
  padding: 12px;

  /* 使用浅色背景区分单条记录。 */
  background: #f8fafc;

  /* 使用浅色边框明确条目边界。 */
  border: 1px solid #e6eaf0;

  /* 保持条目圆角和页面卡片一致。 */
  border-radius: 8px;
}

/*
  条目封面占位。
  对应 template 中的 `.profile-view__poster`。
*/
.profile-view__poster {
  /* 固定封面宽度，保证列表条目左侧稳定。 */
  width: 54px;

  /* 固定封面高度，形成竖版封面比例。 */
  height: 72px;

  /* 使用渐变模拟封面占位。 */
  background:
    linear-gradient(145deg, rgba(49, 95, 202, 0.22), rgba(31, 41, 55, 0.12)),
    linear-gradient(180deg, #dbe5f6 0%, #eef2f8 100%);

  /* 保持封面和条目统一圆角。 */
  border-radius: 6px;

  /* 禁止封面被文字区域挤压变形。 */
  flex: 0 0 auto;
}

/*
  条目主要文字区域。
  对应 template 中的 `.profile-view__item-main`。
*/
.profile-view__item-main {
  /* 允许文字区域占据封面和按钮之间的剩余空间。 */
  flex: 1;

  /* 防止长标题撑破条目布局。 */
  min-width: 0;
}

/*
  条目标题。
  对应 template 中的 `.profile-view__item-title`。
*/
.profile-view__item-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用列表标题字号，保证条目标题清晰。 */
  font-size: 16px;

  /* 使用较粗字重突出视频名称。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  条目说明。
  对应 template 中的 `.profile-view__item-text`。
*/
.profile-view__item-text {
  /* 控制说明和标题之间的距离。 */
  margin: 6px 0 0;

  /* 使用正文偏小字号，适合列表内容。 */
  font-size: 14px;

  /* 设置行高，保证多行说明可读。 */
  line-height: 1.6;

  /* 使用中性色，让说明处于辅助层级。 */
  color: #5d6678;
}

/*
  条目元信息。
  对应 template 中的 `.profile-view__item-meta`。
*/
.profile-view__item-meta {
  /* 控制元信息和说明之间的距离。 */
  margin: 6px 0 0;

  /* 使用更小字号，表示更新时间或补充信息。 */
  font-size: 12px;

  /* 使用浅灰文字降低视觉重量。 */
  color: #8a94a6;
}

/*
  小按钮。
  对应 template 中的 `.profile-view__small-button`，用于继续播放和查看详情。
*/
.profile-view__small-button {
  /* 使用白色背景，让按钮在浅色条目上可见。 */
  background: #ffffff;

  /* 使用主题蓝边框，提示这是可点击操作。 */
  border: 1px solid #c8d6ff;

  /* 使用主题蓝文字，和边框保持一致。 */
  color: #315fca;

  /* 给按钮留出点击区域。 */
  padding: 7px 10px;

  /* 保持按钮圆角和页面风格一致。 */
  border-radius: 6px;

  /* 缩小字号，让按钮适配列表条目。 */
  font-size: 13px;

  /* 使用较粗字重，提高按钮识别度。 */
  font-weight: 700;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;

  /* 禁止按钮被文字挤压换行。 */
  flex: 0 0 auto;
}

/*
  本地数据操作区。
  对应 template 中的 `.profile-view__actions`。
*/
.profile-view__actions {
  /* 使用白色背景，让操作区从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用浅色边框明确操作区边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和其他内容面板一致的圆角。 */
  border-radius: 8px;

  /* 给操作区内部留出空间。 */
  padding: 20px;
}

/*
  本地操作按钮网格。
  对应 template 中的 `.profile-view__action-grid`。
*/
.profile-view__action-grid {
  /* 使用 grid 让操作按钮按列排列。 */
  display: grid;

  /* 每列最小 220px，空间不足时自动减少列数。 */
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

  /* 控制操作按钮之间的距离。 */
  gap: 12px;
}

/*
  本地操作按钮。
  对应 template 中的 `.profile-view__action-button`。
*/
.profile-view__action-button {
  /* 左对齐按钮内容，让标题和说明像信息卡一样阅读。 */
  text-align: left;

  /* 使用白色背景，保持普通操作按钮视觉克制。 */
  background: #ffffff;

  /* 使用浅色边框明确按钮边界。 */
  border: 1px solid #e6eaf0;

  /* 保持按钮圆角和页面卡片一致。 */
  border-radius: 8px;

  /* 给按钮内部留出空间。 */
  padding: 14px;

  /* 使用纵向 flex 让标题和说明上下排列。 */
  display: flex;

  /* 主轴改为纵向。 */
  flex-direction: column;

  /* 控制标题和说明之间的距离。 */
  gap: 6px;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;
}

/*
  风险操作按钮。
  对应 template 中的 `.profile-view__action-button--danger`，由 action.danger 控制。
*/
.profile-view__action-button--danger {
  /* 使用浅红背景提示这是更敏感的本地数据操作。 */
  background: #fff5f5;

  /* 使用浅红边框和普通操作区分。 */
  border-color: #ffd1d1;
}

/*
  操作按钮标题。
  对应 template 中的 `.profile-view__action-label`。
*/
.profile-view__action-label {
  /* 使用深色文字突出操作名称。 */
  color: #182235;

  /* 使用正文大小，保证按钮标题清晰。 */
  font-size: 15px;
}

/*
  操作按钮说明。
  对应 template 中的 `.profile-view__action-desc`。
*/
.profile-view__action-desc {
  /* 使用较小字号显示操作说明。 */
  font-size: 13px;

  /* 设置行高，保证说明换行后可读。 */
  line-height: 1.6;

  /* 使用中性色，保持说明辅助层级。 */
  color: #667085;
}

/*
  分区空状态。
  对应 template 中的 `.profile-view__empty`，用于历史、收藏和本地操作为空的情况。
*/
.profile-view__empty {
  /* 使用虚线边框提示这是暂无数据区域。 */
  border: 1px dashed #cad3e1;

  /* 使用浅色背景，让空状态不显得突兀。 */
  background: #f8fafc;

  /* 保持和内容面板一致的圆角。 */
  border-radius: 8px;

  /* 给空状态内部留出空间。 */
  padding: 24px;

  /* 空状态文字居中显示。 */
  text-align: center;
}

/*
  空状态标题。
  对应 template 中的 `.profile-view__empty-title`。
*/
.profile-view__empty-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用中等字号，让空状态标题清晰。 */
  font-size: 18px;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  空状态说明。
  对应 template 中的 `.profile-view__empty-text`。
*/
.profile-view__empty-text {
  /* 控制说明和标题之间的距离。 */
  margin: 8px 0 0;

  /* 使用正文偏小字号，保持说明层级。 */
  font-size: 14px;

  /* 使用中性色显示说明。 */
  color: #667085;
}

/*
  窄屏布局。
  触发条件：屏幕宽度不超过 900px。
  调整后：播放历史和收藏从双栏改为单栏，避免内容被挤压。
*/
@media (max-width: 900px) {
  .profile-view__content-grid {
    /* 从双栏改成单栏，让列表在窄屏下有足够横向空间。 */
    grid-template-columns: 1fr;
  }
}

/*
  手机布局。
  触发条件：屏幕宽度不超过 640px。
  调整后：用户卡和条目从横向布局改为更适合小屏的结构。
*/
@media (max-width: 640px) {
  .profile-view {
    /* 缩小页面左右留白，适配手机宽度。 */
    padding: 24px 16px 36px;
  }

  .profile-view__user-card {
    /* 手机上头像和用户信息改为纵向排列，避免右侧文字过窄。 */
    flex-direction: column;
  }

  .profile-view__history-item,
  .profile-view__favorite-item {
    /* 手机上条目允许换行，让按钮移动到下一行。 */
    flex-wrap: wrap;
  }

  .profile-view__small-button {
    /* 手机上按钮占满整行，提高点击面积。 */
    width: 100%;
  }
}
</style>
