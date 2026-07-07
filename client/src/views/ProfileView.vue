<template>
  <!--
    ProfileView 页面渲染树

    {div.theme-page.profile-view}
    ├─ {section.theme-page-header.profile-header}
    │  ├─ {h1.theme-page-title}
    │  │  └─ 显示“个人中心”页面标题
    │  └─ {p.theme-page-desc}
    │     └─ 说明本页用于查看播放历史与收藏内容
    │
    ├─ [if hasUser] 用户卡片分支
    │  └─ {section.user-card}
    │     ├─ {div.user-avatar}
    │     │  └─ 显示用户名首字
    │     └─ {div.user-meta}
    │        ├─ {h2.user-name}
    │        │  └─ 显示当前用户名称
    │        ├─ {p.user-date}
    │        │  └─ 显示当前用户数据保存状态
    │        └─ {div.user-tags}
    │           ├─ {el-tag} 用户角色
    │           ├─ {el-tag} 播放历史数量
    │           └─ {el-tag} 收藏数量
    │
    └─ {section.profile-panel.theme-surface}
       └─ {el-tabs} [v-model="activeTab"]
          ├─ {el-tab-pane} [name="history"] 播放历史标签页
          │  ├─ [if hasPlayHistory] 历史工具栏分支
          │  │  └─ {div.profile-toolbar}
          │  │     ├─ {div.profile-filters}
          │  │     │  └─ {button.filter-chip} 循环渲染完成度筛选
          │  │     └─ {el-button} 清空历史按钮
          │  ├─ {div.profile-grid}
          │  │  └─ {article.profile-media-card} 循环渲染筛选后的播放历史
          │  └─ [if !filteredHistoryList.length]
          │     └─ {el-empty} 显示历史空状态
          │
          └─ {el-tab-pane} [name="favorites"] 我的收藏标签页
             ├─ [if hasFavorites] 收藏工具栏分支
             │  └─ {div.profile-toolbar}
             │     ├─ {div.profile-filters}
             │     │  └─ {button.filter-chip} 循环渲染完成度筛选
             │     └─ {el-button} 清空收藏按钮
             ├─ {div.profile-grid}
             │  └─ {div.fav-item} 循环渲染筛选后的收藏卡片
             │     ├─ {article.profile-media-card}
             │     └─ {el-button.fav-remove} 删除单条收藏
             └─ [if !filteredFavoriteList.length]
                └─ {el-empty} 显示收藏空状态
  -->
  <!-- 个人中心页面根容器，负责承载用户卡片、播放历史和收藏列表。 -->
  <div class="theme-page profile-view">
    <!-- 页面标题区，和其他页面保持统一标题层级。 -->
    <section class="theme-page-header profile-header">
      <h1 class="theme-page-title">个人中心</h1>
      <p class="theme-page-desc">查看播放历史与收藏内容。</p>
    </section>

    <!--
      用户信息卡片。
      渲染条件：`hasUser` 为 true。
      数据来源：`user`、`historyCountText`、`favoriteCountText`。
      页面作用：在历史和收藏列表上方确认当前数据所属用户。
    -->
    <section v-if="hasUser" class="user-card">
      <!-- 用户头像占位，使用用户名首字母形成轻量身份显示。 -->
      <div class="user-avatar">{{ userInitial }}</div>

      <!-- 用户信息文本区域，展示用户名、保存状态和数量标签。 -->
      <div class="user-meta">
        <h2 class="user-name">{{ user.name }}</h2>
        <p class="user-date">{{ userStatusText }}，{{ user.message || '当前数据保存在本地浏览器中。' }}</p>

        <!-- 用户标签行，集中展示角色、历史数量和收藏数量。 -->
        <div class="user-tags">
          <el-tag size="small" effect="plain">{{ userRoleText }}</el-tag>
          <el-tag size="small" effect="plain">{{ historyCountText }}</el-tag>
          <el-tag size="small" effect="plain">{{ favoriteCountText }}</el-tag>
        </div>
      </div>
    </section>

    <!--
      个人中心主面板。
      页面位置：用户卡片下方。
      页面作用：使用 Element UI tabs 把播放历史和收藏列表分开。
    -->
    <section class="profile-panel theme-surface">
      <el-tabs v-model="activeTab">
        <!-- 播放历史标签页，负责展示最近观看记录。 -->
        <el-tab-pane label="播放历史" name="history">
          <!--
            历史工具栏。
            渲染条件：原始播放历史列表有内容。
            交互：筛选按钮改变 `activeHistoryFilter`，清空按钮调用 `clearHistory`。
          -->
          <div v-if="hasPlayHistory" class="profile-toolbar">
            <div class="profile-filters">
              <!-- 完成度筛选只影响页面当前展示，不改变原始播放历史数据。 -->
              <button
                v-for="option in filterOptions"
                :key="'history-' + option.value"
                type="button"
                :class="['filter-chip', { active: activeHistoryFilter === option.value }]"
                @click="activeHistoryFilter = option.value"
              >
                {{ option.label }}
              </button>
            </div>

            <!-- 清空历史只清空当前页面状态，后续接入真实存储时再同步持久化层。 -->
            <el-button size="small" @click="clearHistory">清空历史</el-button>
          </div>

          <!--
            历史卡片网格。
            数据来源：`filteredHistoryList`。
            页面作用：使用统一海报卡片展示播放历史。
          -->
          <div class="profile-grid" data-testid="profile-history-grid">
            <article
              v-for="item in filteredHistoryList"
              :key="item.id"
              class="profile-media-card"
              role="button"
              tabindex="0"
              @click="openDetailPage(item)"
              @keydown.enter="openDetailPage(item)"
              @keydown.space.prevent="openDetailPage(item)"
            >
              <!-- 海报区域，包含封面、占位图和顶部角标。 -->
              <div class="profile-media-card__cover">
                <img v-if="item.cover" :src="item.cover" :alt="item.title || '播放历史封面'">
                <span v-else class="profile-media-card__fallback">{{ item.fallbackInitial }}</span>
                <span v-if="item.badgeText" class="profile-media-card__badge">{{ item.badgeText }}</span>
              </div>

              <!-- 卡片正文，按“标题、元信息、播放状态”顺序展示。 -->
              <div class="profile-media-card__body">
                <h3 class="profile-media-card__title">{{ item.title }}</h3>
                <div class="profile-media-card__meta">
                  <span>{{ item.yearText }}</span>
                  <span>{{ item.ratingText }}</span>
                </div>
                <div class="profile-media-card__divider"></div>
                <div class="profile-media-card__activity">
                  <span>{{ item.activityLabel }}</span>
                  <strong>{{ item.statusText }}</strong>
                </div>
                <div class="profile-media-card__activity">
                  <span>最近观看</span>
                  <span>{{ item.activityText }}</span>
                </div>
              </div>
            </article>
          </div>

          <!-- 历史空状态，区分完全没有历史和当前筛选下没有结果。 -->
          <el-empty v-if="!filteredHistoryList.length" :description="historyEmptyText" />
        </el-tab-pane>

        <!-- 我的收藏标签页，负责展示用户保存的视频。 -->
        <el-tab-pane label="我的收藏" name="favorites">
          <!--
            收藏工具栏。
            渲染条件：原始收藏列表有内容。
            交互：筛选按钮改变 `activeFavoriteFilter`，清空按钮调用 `clearFavorites`。
          -->
          <div v-if="hasFavorites" class="profile-toolbar">
            <div class="profile-filters">
              <!-- 收藏筛选和历史筛选共用同一组选项，保持两个标签页操作一致。 -->
              <button
                v-for="option in filterOptions"
                :key="'favorite-' + option.value"
                type="button"
                :class="['filter-chip', { active: activeFavoriteFilter === option.value }]"
                @click="activeFavoriteFilter = option.value"
              >
                {{ option.label }}
              </button>
            </div>

            <!-- 清空收藏只清空当前页面状态，后续接入真实存储时再同步持久化层。 -->
            <el-button size="small" @click="clearFavorites">清空收藏</el-button>
          </div>

          <!--
            收藏卡片网格。
            数据来源：`filteredFavoriteList`。
            页面作用：用海报卡片展示收藏内容，并在卡片右上角提供删除入口。
          -->
          <div class="profile-grid" data-testid="profile-favorites-grid">
            <div
              v-for="item in filteredFavoriteList"
              :key="item.id"
              class="fav-item"
            >
              <article
                class="profile-media-card"
                role="button"
                tabindex="0"
                @click="openDetailPage(item)"
                @keydown.enter="openDetailPage(item)"
                @keydown.space.prevent="openDetailPage(item)"
              >
                <!-- 收藏封面区域，显示真实封面或标题首字占位。 -->
                <div class="profile-media-card__cover">
                  <img v-if="item.cover" :src="item.cover" :alt="item.title || '收藏封面'">
                  <span v-else class="profile-media-card__fallback">{{ item.fallbackInitial }}</span>
                  <span v-if="item.badgeText" class="profile-media-card__badge">{{ item.badgeText }}</span>
                </div>

                <!-- 收藏卡片正文，展示标题、年份、评分和收藏状态。 -->
                <div class="profile-media-card__body">
                  <h3 class="profile-media-card__title">{{ item.title }}</h3>
                  <div class="profile-media-card__meta">
                    <span>{{ item.yearText }}</span>
                    <span>{{ item.ratingText }}</span>
                  </div>
                  <div class="profile-media-card__divider"></div>
                  <div class="profile-media-card__activity">
                    <span>{{ item.activityLabel }}</span>
                    <strong>{{ item.statusText }}</strong>
                  </div>
                  <div class="profile-media-card__activity">
                    <span>收藏来源</span>
                    <span>{{ item.sourceText }}</span>
                  </div>
                </div>
              </article>

              <!-- 删除单条收藏，按钮覆盖在卡片右上角。 -->
              <el-button
                class="fav-remove"
                type="danger"
                size="mini"
                icon="el-icon-close"
                @click.stop="removeFromFavorites(item.id)"
              />
            </div>
          </div>

          <!-- 收藏空状态，区分完全没有收藏和当前筛选下没有结果。 -->
          <el-empty v-if="!filteredFavoriteList.length" :description="favoriteEmptyText" />
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script>
/**
 * 个人中心页。
 *
 * 页面职责：
 * 1. 展示当前用户的本地资料状态
 * 2. 使用卡片网格展示播放历史
 * 3. 使用卡片网格展示我的收藏
 * 4. 提供播放历史和收藏列表的简单完成度筛选
 */
// 个人中心页面数据，提供用户资料、播放历史和收藏列表。
import { profilePageData } from '../data/page-profile.mock';

export default {
  // 组件名称用于在 Vue 调试工具中识别当前页面。
  name: 'ProfileView',

  /**
   * 个人中心页面本地状态。
   *
   * @returns {Object} 页面渲染所需的用户资料、列表数据和筛选状态。
   */
  data() {
    return {
      // 当前激活的标签页。
      // 渲染位置：`el-tabs v-model="activeTab"`。
      activeTab: 'history',

      // user 驱动顶部用户信息卡；为 null 时不渲染用户卡片。
      user: this.asObjectOrNull(profilePageData.user),

      // playHistory 驱动播放历史标签页；数组为空时显示历史空状态。
      playHistory: this.asList(profilePageData.playHistory),

      // favorites 驱动我的收藏标签页；数组为空时显示收藏空状态。
      favorites: this.asList(profilePageData.favorites),

      // 播放历史当前筛选值；影响 `filteredHistoryList`。
      activeHistoryFilter: 'all',

      // 收藏列表当前筛选值；影响 `filteredFavoriteList`。
      activeFavoriteFilter: 'all',

      // 完成度筛选按钮配置；同时渲染在播放历史和我的收藏工具栏中。
      filterOptions: [
        // 全部：不按完成度过滤。
        { label: '全部', value: 'all' },
        // 未看完：展示未标记为 completed 的记录。
        { label: '未看完', value: 'in-progress' },
        // 已看完：展示标记为 completed 的记录。
        { label: '已看完', value: 'completed' }
      ]
    };
  },

  computed: {
    /**
     * 是否存在用户资料。
     *
     * @returns {boolean} 有用户对象时返回 true。
     */
    hasUser() {
      return Boolean(this.user);
    },

    /**
     * 播放历史原始列表是否有内容。
     *
     * @returns {boolean} 原始播放历史非空时返回 true。
     */
    hasPlayHistory() {
      return this.playHistory.length > 0;
    },

    /**
     * 收藏原始列表是否有内容。
     *
     * @returns {boolean} 原始收藏列表非空时返回 true。
     */
    hasFavorites() {
      return this.favorites.length > 0;
    },

    /**
     * 用户头像中显示的文字。
     *
     * @returns {string} 用户名首字或游客标识。
     */
    userInitial() {
      // 没有用户资料或用户名时显示“客”。
      if (!this.user || !this.user.name) {
        return '客';
      }

      // 只取第一个字符，避免头像区域被长用户名撑开。
      return this.user.name.slice(0, 1);
    },

    /**
     * 用户角色展示文本。
     *
     * @returns {string} 用户卡片里的角色标签文本。
     */
    userRoleText() {
      // role 为空时按游客处理。
      if (!this.user || !this.user.role) {
        return '游客状态';
      }

      // guest 是数据字段值，页面上转换为中文说明。
      return this.user.role === 'guest' ? '游客状态' : this.user.role;
    },

    /**
     * 用户数据状态文本。
     *
     * @returns {string} 用户卡片里的数据状态说明。
     */
    userStatusText() {
      // status 为空时给出兜底说明。
      if (!this.user || !this.user.status) {
        return '状态未知';
      }

      // local 表示数据保存在当前浏览器。
      return this.user.status === 'local' ? '本地数据' : this.user.status;
    },

    /**
     * 播放历史数量文本。
     *
     * @returns {string} 用户卡片和工具栏使用的历史数量说明。
     */
    historyCountText() {
      return `${this.playHistory.length} 条历史`;
    },

    /**
     * 收藏数量文本。
     *
     * @returns {string} 用户卡片和工具栏使用的收藏数量说明。
     */
    favoriteCountText() {
      return `${this.favorites.length} 个收藏`;
    },

    /**
     * 格式化后的播放历史列表。
     *
     * @returns {Array<Object>} 可以直接渲染成个人中心海报卡片的历史数据。
     */
    historyCardList() {
      return this.playHistory.map(item => this.normalizeHistoryItem(item));
    },

    /**
     * 格式化后的收藏列表。
     *
     * @returns {Array<Object>} 可以直接渲染成个人中心海报卡片的收藏数据。
     */
    favoriteCardList() {
      return this.favorites.map(item => this.normalizeFavoriteItem(item));
    },

    /**
     * 应用筛选后的播放历史列表。
     *
     * @returns {Array<Object>} 当前播放历史筛选结果。
     */
    filteredHistoryList() {
      return this.applyProgressFilter(this.historyCardList, this.activeHistoryFilter);
    },

    /**
     * 应用筛选后的收藏列表。
     *
     * @returns {Array<Object>} 当前收藏筛选结果。
     */
    filteredFavoriteList() {
      return this.applyProgressFilter(this.favoriteCardList, this.activeFavoriteFilter);
    },

    /**
     * 播放历史空状态文案。
     *
     * @returns {string} 历史标签页空状态描述。
     */
    historyEmptyText() {
      return this.playHistory.length ? '当前筛选下暂无记录' : '暂无播放历史';
    },

    /**
     * 收藏空状态文案。
     *
     * @returns {string} 收藏标签页空状态描述。
     */
    favoriteEmptyText() {
      return this.favorites.length ? '当前筛选下暂无收藏' : '暂无收藏';
    }
  },

  methods: {
    /**
     * 把数据整理成数组。
     *
     * @param {*} value 可能来自个人中心数据文件的任意值。
     * @returns {Array} 数组原样返回，其他值返回空数组。
     */
    asList(value) {
      // 页面列表只能遍历数组；异常值统一兜底，避免 template 报错。
      return Array.isArray(value) ? value : [];
    },

    /**
     * 把数据整理成普通对象或 null。
     *
     * @param {*} value 可能来自个人中心数据文件的任意值。
     * @returns {Object|null} 普通对象原样返回，其他值返回 null。
     */
    asObjectOrNull(value) {
      // null、非对象和数组都不能作为用户资料对象使用。
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      return value;
    },

    /**
     * 把播放历史整理成个人中心海报卡片可用结构。
     *
     * @param {Object} item 单条播放历史数据。
     * @returns {Object} 视频卡片展示对象。
     */
    normalizeHistoryItem(item) {
      return {
        // id 用于 v-for key；没有 id 时使用 videoId 兜底。
        id: item.id || item.videoId,
        // videoId 用于跳转详情页。
        videoId: item.videoId,
        // sourceId 用于跳转详情页时确定目标数据源。
        sourceId: item.sourceId || '',
        // title 驱动卡片标题。
        title: item.title || '未命名视频',
        // cover 驱动卡片封面；为空时显示标题首字占位。
        cover: item.cover || '',
        // fallbackInitial 是封面缺失时显示的大字。
        fallbackInitial: this.getTitleInitial(item.title),
        // badgeText 显示在封面左上角，只放清晰度或简短标签，避免长进度文本撑出封面。
        badgeText: this.pickQualityText(item),
        // yearText 显示在标题下方左侧；历史记录没有明确年份时按卡片规范显示“暂无”。
        yearText: item.year || '暂无',
        // ratingText 显示在标题下方右侧，历史记录没有评分时显示“暂无”。
        ratingText: '暂无',
        // activityLabel 显示在分隔线下方左侧第一行，优先放清晰度，其次放分集。
        activityLabel: this.pickQualityText(item) || item.episodeLabel || '暂无',
        // statusText 显示在分隔线下方右侧第一行。
        statusText: item.completed ? '已看完' : '未开始',
        // activityText 显示最近观看时间，需要压缩成短文本，避免右侧日期换行。
        activityText: this.formatShortDateTime(item.updatedAt),
        // completed 用于完成度筛选；没有明确字段时默认按未看完处理。
        completed: Boolean(item.completed),
        // updatedAt 保留给后续排序或详情展示扩展。
        updatedAt: item.updatedAt || ''
      };
    },

    /**
     * 把收藏数据整理成个人中心海报卡片可用结构。
     *
     * @param {Object} item 单条收藏数据。
     * @returns {Object} 视频卡片展示对象。
     */
    normalizeFavoriteItem(item) {
      return {
        // id 用于 v-for key；没有 id 时使用 videoId 兜底。
        id: item.id || item.videoId,
        // videoId 用于跳转详情页。
        videoId: item.videoId,
        // sourceId 用于跳转详情页时确定目标数据源。
        sourceId: item.sourceId || '',
        // title 驱动卡片标题。
        title: item.title || '未命名视频',
        // cover 驱动卡片封面。
        cover: item.cover || '',
        // fallbackInitial 是封面缺失时显示的大字。
        fallbackInitial: this.getTitleInitial(item.title),
        // badgeText 显示在封面左上角，只放清晰度或简短标签，避免来源 id 撑满封面。
        badgeText: this.pickQualityText(item),
        // yearText 显示在标题下方左侧。
        yearText: item.year || '暂无',
        // ratingText 显示在标题下方右侧。
        ratingText: item.rating || '暂无',
        // activityLabel 显示在分隔线下方左侧第一行，和历史卡片保持同一信息层级。
        activityLabel: this.pickQualityText(item) || '暂无',
        // statusText 显示在分隔线下方右侧第一行。
        statusText: item.completed ? '已看完' : '未开始',
        // sourceText 显示收藏来源，需要压缩为短文本，避免源 id 过长导致卡片文字溢出。
        sourceText: this.formatSourceName(item.sourceName || item.sourceId),
        // summary 保留给后续详情扩展。
        summary: item.summary || '',
        // completed 用于完成度筛选；没有明确字段时默认按未看完处理。
        completed: Boolean(item.completed)
      };
    },

    /**
     * 从视频数据里挑选适合放在封面角标的短标签。
     *
     * @param {Object} item 单条播放历史或收藏数据。
     * @returns {string} 清晰度、语言或短备注；没有可用短标签时返回空字符串。
     */
    pickQualityText(item) {
      // 清晰度、语言和更新备注都适合放在海报角标里，优先使用这些短字段。
      const qualityText = item.quality || item.qualityText || item.remark || item.badgeText;

      // 如果数据源没有提供短标签，就返回空字符串，封面角标会直接不渲染。
      return String(qualityText || '').trim();
    },

    /**
     * 把来源字段压缩成卡片可读短文本。
     *
     * @param {string} sourceText 数据源名称或数据源 id。
     * @returns {string} 适合放在卡片右侧的小段文本。
     */
    formatSourceName(sourceText) {
      // 来源为空时显示暂无，不把空白位置留给用户猜。
      if (!sourceText) {
        return '暂无';
      }

      // 真实项目里 sourceId 可能是 mock1 这类机器字段，卡片里只保留短名称。
      return String(sourceText).replace(/-demo$/i, '').replace(/-/g, ' ').trim() || '暂无';
    },

    /**
     * 把完整时间压缩成卡片右侧可读的短时间。
     *
     * @param {string} dateText 完整时间文本。
     * @returns {string} 今天的记录显示“今天 HH:mm”，其他记录显示“MM-DD HH:mm”。
     */
    formatShortDateTime(dateText) {
      // 没有时间时直接显示暂无，避免卡片右侧出现空白。
      if (!dateText) {
        return '暂无';
      }

      // 只接受“YYYY-MM-DD HH:mm”这种稳定格式，其他格式保守截断到 10 个字符。
      const match = String(dateText).match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/);
      if (!match) {
        return String(dateText).slice(0, 10);
      }

      // month、day 和 time 组合成短格式，比完整日期更适合卡片右侧。
      const [, year, month, day, time = ''] = match;

      // 浏览器当天日期用于判断是否显示“今天”。
      const today = new Date();
      const currentYear = String(today.getFullYear());
      const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
      const currentDay = String(today.getDate()).padStart(2, '0');

      // 同一天的记录更适合显示“今天 HH:mm”，用户能一眼理解时间距离。
      if (year === currentYear && month === currentMonth && day === currentDay) {
        return time ? `今天 ${time}` : '今天';
      }

      // 非当天记录保留月日和时间，既清楚又不容易换行。
      return time ? `${month}-${day} ${time}` : `${month}-${day}`;
    },

    /**
     * 获取标题首字。
     *
     * @param {string} title 视频标题。
     * @returns {string} 标题首字；没有标题时返回“影”。
     */
    getTitleInitial(title) {
      // 标题为空时用“影”兜底，让封面占位不显得空。
      if (!title) {
        return '影';
      }

      // 只取一个字符，避免占位封面里的文字过长。
      return String(title).trim().slice(0, 1) || '影';
    },

    /**
     * 按完成度筛选列表。
     *
     * @param {Array<Object>} list 待筛选的视频卡片列表。
     * @param {string} mode 当前筛选模式。
     * @returns {Array<Object>} 筛选后的列表。
     */
    applyProgressFilter(list, mode) {
      // 已看完：只保留 completed 为 true 的条目。
      if (mode === 'completed') {
        return list.filter(item => item.completed);
      }

      // 未看完：只保留没有完成标记的条目。
      if (mode === 'in-progress') {
        return list.filter(item => !item.completed);
      }

      // 全部：不做过滤。
      return list;
    },

    /**
     * 打开个人中心卡片对应的详情页。
     *
     * @param {Object} item 播放历史或收藏卡片数据。
     * @returns {void} 通过 vue-router 跳转到 detail 命名路由。
     */
    openDetailPage(item) {
      // 个人中心卡片必须同时带 videoId 和 sourceId，才能进入明确目标详情页。
      if (!item || !item.videoId || !item.sourceId) {
        return;
      }

      // 跳转详情页时保留来源和视频 id，后续真实详情请求可以直接读取路由参数。
      this.$router.push({
        name: 'detail',
        params: {
          sourceId: item.sourceId,
          videoId: item.videoId
        }
      }).catch((error) => {
        // 重复点击当前卡片时忽略 Vue Router 3 的重复导航错误。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    },

    /**
     * 清空当前页面播放历史。
     *
     * @returns {void}
     */
    clearHistory() {
      // 当前版本先更新页面状态；后续接入存储层时再同步清理持久化数据。
      this.playHistory = [];
    },

    /**
     * 清空当前页面收藏列表。
     *
     * @returns {void}
     */
    clearFavorites() {
      // 当前版本先更新页面状态；后续接入存储层时再同步清理持久化数据。
      this.favorites = [];
    },

    /**
     * 删除单条收藏。
     *
     * @param {string} id 收藏记录 id。
     * @returns {void}
     */
    removeFromFavorites(id) {
      // 根据收藏 id 过滤掉被删除的条目，页面会自动重新渲染收藏网格。
      this.favorites = this.favorites.filter(item => item.id !== id);
    }
  }
};
</script>

<style scoped>
/*
  个人中心最外层容器。
  对应 template 根节点 `.theme-page.profile-view`。
  作用是承接页面标题、用户卡片和 tabs 主面板。
*/
.profile-view {
  /* 顶部留白让页面标题和全局导航之间不贴得太近。 */
  padding-top: 8px;
}

/*
  个人中心头部。
  对应 template 中 `.theme-page-header.profile-header`。
  作用是和下方用户卡片或主内容面板拉开距离。
*/
.profile-header {
  /* 底部固定留白，让标题区和用户卡片之间层次更清楚。 */
  margin-bottom: 20px;
}

/*
  登录用户信息卡片。
  对应 template 中 `[if hasUser]` 的 `.user-card`。
  内部包含头像首字母、用户名、数据状态和数量标签。
*/
.user-card {
  /* 头像和文字横向排列，形成顶部用户信息卡结构。 */
  display: flex;

  /* 头像和文字在垂直方向居中。 */
  align-items: center;

  /* 控制头像和用户信息之间的距离。 */
  gap: 18px;

  /* 内边距让卡片内容不贴边。 */
  padding: 24px 26px;

  /* 用户卡片和下方 tabs 面板之间留出距离。 */
  margin-bottom: 20px;

  /*
    渐变背景让用户卡片和普通内容面板区分开。
    径向蓝色光斑用于突出用户身份区域。
  */
  background:
    radial-gradient(circle at top left, rgba(91, 140, 255, 0.22), transparent 34%),
    linear-gradient(135deg, #172133 0%, #202c42 100%);

  /* 保持直角风格，和项目当前 UI 收束方向一致。 */
  border-radius: 0;

  /* 深色背景上使用白色文字。 */
  color: #fff;

  /* 阴影让用户卡片从页面背景中浮出来。 */
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16);
}

/*
  用户头像占位块。
  对应 template 中 `.user-avatar`。
  页面作用：当前页面没有头像上传，直接用用户名首字母作为身份标识。
*/
.user-avatar {
  /* 固定宽度保证头像区域稳定。 */
  width: 60px;

  /* 固定高度和宽度一致，形成正方形头像块。 */
  height: 60px;

  /* 保持直角头像风格。 */
  border-radius: 0;

  /* 半透明白底让头像块从深色卡片中分出来。 */
  background: rgba(255, 255, 255, 0.16);

  /* 使用 flex 居中首字母。 */
  display: flex;

  /* 首字母垂直居中。 */
  align-items: center;

  /* 首字母水平居中。 */
  justify-content: center;

  /* 首字母字号较大，保证头像识别度。 */
  font-size: 24px;

  /* 加粗让首字母在深色背景上更稳。 */
  font-weight: 700;

  /* 防止头像在窄屏下被压缩变形。 */
  flex-shrink: 0;
}

/*
  用户信息文本容器。
  对应 template 中 `.user-meta`。
  作用是承载用户名、说明和标签行。
*/
.user-meta {
  /* 占据头像右侧剩余空间。 */
  flex: 1;

  /* 防止长用户名或说明撑破 flex 容器。 */
  min-width: 0;
}

/*
  用户名标题。
  对应 template 中 `.user-name`。
*/
.user-name {
  /* 用户名比保存状态更重要，字号更大。 */
  font-size: 22px;

  /* 加粗强调当前用户身份。 */
  font-weight: 700;

  /* 去掉默认标题 margin，并只保留和说明之间的小间距。 */
  margin: 0 0 4px;
}

/*
  用户数据状态说明。
  对应 template 中 `.user-date`。
*/
.user-date {
  /* 说明是辅助信息，字号小于用户名。 */
  font-size: 13px;

  /* 透明度降低，形成次级信息层级。 */
  opacity: 0.74;

  /* 去掉段落默认 margin，避免卡片内部间距失控。 */
  margin: 0;
}

/*
  用户数量标签行。
  对应 template 中 `.user-tags`。
  作用是展示角色、历史数量和收藏数量。
*/
.user-tags {
  /* 多个标签横向排列。 */
  display: flex;

  /* 标签在窄屏下可以换行。 */
  flex-wrap: wrap;

  /* 控制标签之间的距离。 */
  gap: 8px;

  /* 标签行和状态说明之间留出距离。 */
  margin-top: 12px;
}

/*
  个人中心内容面板。
  对应 template 中 `.profile-panel.theme-surface`。
  内部承载 Element Tabs、筛选工具栏、历史网格和收藏网格。
*/
.profile-panel {
  /* 面板内边距让 tabs 和列表内容不贴边。 */
  padding: 18px 22px 22px;
}

/*
  标签页工具栏。
  对应历史和收藏标签页里的 `.profile-toolbar`。
  内部左侧是完成度筛选，右侧是清空按钮。
*/
.profile-toolbar {
  /* 筛选按钮组和清空按钮横向排列。 */
  display: flex;

  /* 两侧控件垂直居中。 */
  align-items: center;

  /* 左右两块分散到两端。 */
  justify-content: space-between;

  /* 窄屏换行时保留间距。 */
  gap: 12px;

  /* 按钮较多或屏幕窄时允许换行。 */
  flex-wrap: wrap;

  /* 工具栏和下方卡片网格之间拉开距离。 */
  margin-bottom: 14px;
}

/*
  完成度筛选按钮组。
  对应 template 中 `.profile-filters`。
  历史和收藏两个标签页共用。
*/
.profile-filters {
  /* 多个筛选按钮横向排列。 */
  display: flex;

  /* 按钮在垂直方向居中。 */
  align-items: center;

  /* 控制筛选按钮之间的距离。 */
  gap: 8px;

  /* 小屏下允许筛选按钮换行。 */
  flex-wrap: wrap;
}

/*
  单个完成度筛选按钮。
  对应 template 中 `v-for="option in filterOptions"` 的 `.filter-chip`。
  点击后改变 `activeHistoryFilter` 或 `activeFavoriteFilter`。
*/
.filter-chip {
  /* 清除浏览器默认按钮外观。 */
  appearance: none;

  /* 默认边框给按钮边界。 */
  border: 1px solid var(--border-color);

  /* 浅色背景让按钮在白色面板中有轻微层次。 */
  background: rgba(255, 255, 255, 0.86);

  /* 默认文字使用次级色，未选中状态不抢眼。 */
  color: var(--text-secondary);

  /* 固定高度让三个筛选按钮整齐。 */
  height: 30px;

  /* 左右内边距适配“未看完”“已看完”等文字。 */
  padding: 0 12px;

  /* 胶囊圆角表示这是可切换筛选条件。 */
  border-radius: 999px;

  /* 筛选按钮字号小于正文。 */
  font-size: 12px;

  /* 单行按钮不需要额外行高。 */
  line-height: 1;

  /* 鼠标手型提示可以点击筛选。 */
  cursor: pointer;

  /* hover 和 active 状态平滑变化。 */
  transition: all 0.18s ease;
}

/*
  筛选按钮 hover 状态。
  触发条件：鼠标移入筛选按钮。
  页面作用：提示用户该筛选项可点击。
*/
.filter-chip:hover {
  /* hover 时文字切到主题色。 */
  color: var(--accent);

  /* hover 时边框也切到主题色透明版本。 */
  border-color: rgba(91, 140, 255, 0.26);

  /* 浅主题背景提供轻微反馈。 */
  background: rgba(91, 140, 255, 0.06);
}

/*
  当前激活的筛选按钮。
  对应 template 中 `:class="{ active: activeHistoryFilter === option.value }"`。
*/
.filter-chip.active {
  /* active 状态文字使用主题色。 */
  color: var(--accent);

  /* active 状态边框更明显。 */
  border-color: rgba(91, 140, 255, 0.28);

  /* active 状态使用浅主题背景，和普通 hover 区分。 */
  background: rgba(91, 140, 255, 0.1);

  /* 内阴影增强选中边界，但不改变按钮尺寸。 */
  box-shadow: inset 0 0 0 1px rgba(91, 140, 255, 0.06);
}

/*
  历史和收藏卡片网格。
  对应 template 中两个 `.profile-grid`。
  内部渲染个人中心专用海报卡片，收藏页外层还包一层 `.fav-item`。
*/
.profile-grid {
  /* 使用 Grid 自动排布卡片。 */
  display: grid;

  /*
    桌面端固定 7 列。
    首页左侧视频区来自同一套 7 列栅格里的 5 列，所以个人中心单列宽度会和首页卡片一致。
  */
  grid-template-columns: repeat(var(--page-grid-columns), minmax(0, 1fr));

  /* 控制卡片之间的横向和纵向间距，跟页面统一栅格一致。 */
  gap: var(--page-grid-gap);

  /* 顶部留一点空间，让卡片和工具栏之间不贴。 */
  padding-top: 6px;
}

/*
  个人中心海报卡片。
  对应 template 中 `.profile-media-card`。
  作用是展示播放历史和收藏里的“海报 + 标题 + 元信息 + 活动信息”卡片。
*/
.profile-media-card {
  /*
    个人中心卡片填满所在栅格列。
    真实宽度由 profile-grid 的 7 列栅格决定，不再在卡片自身写死宽度。
  */
  width: 100%;

  /* 允许标题、角标、时间等长文本在列内省略，不能反向撑开列宽。 */
  min-width: 0;

  /* 取消固定最大宽度，避免和 7 列栅格规则打架。 */
  max-width: none;

  /* 白色背景让卡片正文和页面底色区分开。 */
  background: #ffffff;

  /* 和通用视频卡片一样使用纵向 flex，保证封面和正文组合高度一致。 */
  display: flex;

  /* 封面在上，正文在下。 */
  flex-direction: column;

  /* 浅色边框勾出卡片轮廓。 */
  border: 1px solid rgba(148, 163, 184, 0.24);

  /* 小圆角让卡片边缘保持克制，不使用过大的圆角。 */
  border-radius: 6px;

  /* 裁掉封面和角标可能溢出的部分。 */
  overflow: hidden;

  /* 阴影保持克制，只让卡片从白色面板里轻微浮出。 */
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);

  /* 历史和收藏卡片可以进入详情页，所以使用手型指针提示可点击。 */
  cursor: pointer;
}

/*
  播放历史列表里的直接卡片项。
  对应 template 中 `data-testid="profile-history-grid"` 内部的 `.profile-media-card`。
  作用是让历史卡片占位和收藏卡片占位都严格使用首页卡片宽度。
*/
.profile-grid > .profile-media-card {
  /* 历史列表没有 fav-item 外层，所以这里直接让卡片填满自己的 grid 列。 */
  width: 100%;

  /* 不额外限制最大宽度，统一交给 7 列栅格控制。 */
  max-width: none;
}

/*
  卡片封面区。
  对应 template 中 `.profile-media-card__cover`。
  作用是展示真实海报，缺失海报时展示渐变占位。
*/
.profile-media-card__cover {
  /* 作为角标的定位参照。 */
  position: relative;

  /* 宽度跟随卡片列宽。 */
  width: 100%;

  /* 固定 2:3 竖版海报比例，保持视频海报常见观感。 */
  aspect-ratio: 2 / 3;

  /* 无封面时用浅蓝灰渐变补齐海报区域。 */
  background:
    radial-gradient(circle at 24% 18%, rgba(91, 140, 255, 0.18), transparent 34%),
    linear-gradient(145deg, #e8eef7 0%, #cfd9e8 100%);

  /* 居中显示标题首字占位。 */
  display: flex;

  /* 垂直方向居中占位字。 */
  align-items: center;

  /* 水平方向居中占位字。 */
  justify-content: center;

  /* 封面底部边框把图片和正文分开。 */
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

/*
  真实封面图片。
  对应 `.profile-media-card__cover img`。
*/
.profile-media-card__cover img {
  /* 图片宽度填满封面区。 */
  width: 100%;

  /* 图片高度填满封面区。 */
  height: 100%;

  /* 保持比例并裁切多余部分，避免图片变形。 */
  object-fit: cover;

  /* 图片作为块级元素，避免底部出现行内空隙。 */
  display: block;
}

/*
  封面占位首字。
  对应 template 中 `.profile-media-card__fallback`。
*/
.profile-media-card__fallback {
  /* 大字号让缺省封面也能快速识别视频标题首字。 */
  font-size: 44px;

  /* 加粗后在浅色占位背景上更明显。 */
  font-weight: 800;

  /* 使用低饱和灰蓝色，避免占位字太刺眼。 */
  color: rgba(71, 85, 105, 0.42);
}

/*
  封面角标。
  对应 template 中 `.profile-media-card__badge`。
  作用是显示当前分集、观看进度或来源信息。
*/
.profile-media-card__badge {
  /* 角标固定在封面左上角。 */
  position: absolute;

  /* 距离顶部 14px，让角标和海报边缘之间留出稳定空隙。 */
  top: 14px;

  /* 距离左侧 14px，和顶部留白保持一致。 */
  left: 14px;

  /* 角标浮在封面图上方。 */
  z-index: 2;

  /* 让角标文字垂直居中。 */
  display: inline-flex;

  /* 垂直方向居中角标文字。 */
  align-items: center;

  /* 角标高度使用全站视频卡片统一变量，保证各页面角标一致。 */
  min-height: var(--video-card-badge-height);

  /* 限制最大宽度，避免异常长文本撑出封面。 */
  max-width: calc(100% - 28px);

  /* 左右内边距让角标形成清楚的标签块。 */
  padding: 0 14px;

  /* 圆角略大，让角标更接近按钮式标签。 */
  border-radius: 8px;

  /* 深色半透明背景保证压在图片上也能读清。 */
  background: rgba(38, 55, 88, 0.88);

  /* 角标文字使用白色。 */
  color: #ffffff;

  /* 角标字号使用全站视频卡片统一变量，避免各页面忽大忽小。 */
  font-size: var(--video-card-badge-size);

  /* 加粗让角标信息更清晰。 */
  font-weight: 700;

  /* 禁止角标文字换行。 */
  white-space: nowrap;

  /* 超长角标隐藏溢出部分。 */
  overflow: hidden;

  /* 超长角标用省略号收尾。 */
  text-overflow: ellipsis;
}

/*
  卡片正文。
  对应 template 中 `.profile-media-card__body`。
  作用是展示标题、年份评分和播放活动信息。
*/
.profile-media-card__body {
  /* 卡片正文保持白底，和浅色页面背景分开。 */
  background: #ffffff;

  /* 正文高度和通用视频卡片一致，个人中心不能因为字段更多而撑高卡片。 */
  height: var(--video-card-body-height);

  /* 固定高度下把 padding 计算进正文高度，避免额外撑高。 */
  box-sizing: border-box;

  /* 个人中心字段更多，所以正文内边距比通用卡片略紧凑。 */
  padding: 10px 14px 11px;
}

/*
  卡片标题。
  对应 template 中 `.profile-media-card__title`。
*/
.profile-media-card__title {
  /* 清掉标题默认外边距，只保留很小的底部距离。 */
  margin: 0 0 4px;

  /* 个人中心卡片信息更多，标题比通用卡片略小，避免撑高正文。 */
  font-size: 16px;

  /* 固定行高，保证标题占用高度可控。 */
  line-height: 1.25;

  /* 加粗突出视频名称。 */
  font-weight: 700;

  /* 使用主文字色保证标题可读。 */
  color: var(--text-primary);

  /* 长标题单行省略，避免卡片高度被撑乱。 */
  white-space: nowrap;

  /* 超出标题宽度时隐藏。 */
  overflow: hidden;

  /* 超出部分用省略号表示。 */
  text-overflow: ellipsis;
}

/*
  标题下方年份和评分行。
  对应 template 中 `.profile-media-card__meta`。
*/
.profile-media-card__meta {
  /* 左右两侧分别放年份和评分。 */
  display: flex;

  /* 年份靠左，评分靠右。 */
  justify-content: space-between;

  /* 垂直方向居中。 */
  align-items: center;

  /* 个人中心元信息比通用卡片略小，给下方播放状态留空间。 */
  font-size: 12px;

  /* 固定行高，减少不同字体渲染造成的高度波动。 */
  line-height: 1.25;

  /* 使用次级文字色。 */
  color: var(--text-muted);
}

/*
  卡片内部分隔线。
  对应 template 中 `.profile-media-card__divider`。
  作用是分隔基础信息和播放活动信息。
*/
.profile-media-card__divider {
  /* 分隔线宽度占满正文区域。 */
  width: 100%;

  /* 线条高度 1px，保持轻量。 */
  height: 1px;

  /* 使用浅色边界线。 */
  background: rgba(148, 163, 184, 0.22);

  /* 分隔线压缩上下留白，保证整张卡片高度和首页一致。 */
  margin: 6px 0 5px;
}

/*
  活动信息行。
  对应 template 中 `.profile-media-card__activity`。
  作用是展示分集、播放状态、最近观看和收藏来源。
*/
.profile-media-card__activity {
  /* 左右两端排布标签和值。 */
  display: flex;

  /* 左侧说明靠左，右侧状态靠右。 */
  justify-content: space-between;

  /* 垂直方向居中。 */
  align-items: center;

  /* 左右文本之间留出间距，避免两侧内容贴在一起。 */
  gap: 8px;

  /* 播放状态字段更多，所以字号比普通卡片元信息略小。 */
  font-size: 12px;

  /* 固定行高，让两行活动信息能稳定放进固定正文高度里。 */
  line-height: 1.25;

  /* 使用次级文字色。 */
  color: var(--text-secondary);
}

/*
  第二行活动信息。
  通过相邻选择器控制和上一行之间的距离。
*/
.profile-media-card__activity + .profile-media-card__activity {
  /* 两行之间留出较小间距，形成紧凑的信息组。 */
  margin-top: 3px;
}

/*
  活动信息左侧说明。
  对应底部两行中的左侧文本，例如“HD国语”和“最近观看”。
*/
.profile-media-card__activity span:first-child {
  /* 左侧说明保持自己的内容宽度，不被右侧时间挤压换行。 */
  flex: 0 0 auto;
}

/*
  活动信息右侧普通值。
  对应最近观看时间和收藏来源。
*/
.profile-media-card__activity span:last-child {
  /* 右侧值占用剩余空间，并允许省略号生效。 */
  min-width: 0;

  /* 右侧值靠右，和状态值保持同一视觉位置。 */
  text-align: right;

  /* 时间或来源保持单行，避免出现用户截图里的竖向换行。 */
  white-space: nowrap;

  /* 超出可用宽度时隐藏多余内容。 */
  overflow: hidden;

  /* 超出内容用省略号结尾，保证卡片高度稳定。 */
  text-overflow: ellipsis;
}

/*
  活动信息右侧强调值。
  对应 template 中 `.profile-media-card__activity strong`。
*/
.profile-media-card__activity strong {
  /* 状态值使用较粗字重。 */
  font-weight: 700;

  /* 使用深色文字强调状态。 */
  color: var(--text-primary);

  /* 状态文本固定单行，避免“未开始”这类短词被挤压。 */
  white-space: nowrap;
}

/*
  单个收藏项外层。
  对应收藏标签页中 `v-for="item in filteredFavoriteList"` 的 `.fav-item`。
  作用是给右上角删除按钮提供定位上下文。
*/
.fav-item {
  /* 删除按钮使用 absolute 定位，需要这里作为参照。 */
  position: relative;

  /* 收藏外层填满当前栅格列，内部卡片也跟随这个列宽。 */
  width: 100%;

  /* 不额外限制最大宽度，统一交给 7 列栅格控制。 */
  max-width: none;

  /* 允许窄屏媒体查询接管宽度时正常压缩。 */
  min-width: 0;
}

/*
  单条收藏删除按钮。
  对应 template 中 `.fav-remove`。
  点击后调用 `removeFromFavorites(item.id)`。
*/
.fav-remove {
  /* 覆盖在收藏卡片右上角。 */
  position: absolute;

  /* 距离卡片顶部 8px，避免贴边。 */
  top: 8px;

  /* 距离卡片右侧 8px，形成稳定角标位置。 */
  right: 8px;

  /* 高于海报卡片内容层，保证按钮可点击。 */
  z-index: 2;

  /* 删除按钮做成小方块，减少遮挡封面。 */
  width: 22px;

  /* 高度和宽度一致。 */
  height: 22px;

  /* 清除 Element Button 默认内边距，图标居中。 */
  padding: 0;

  /* 保持直角风格。 */
  border-radius: 0;

  /* 图标字号略大于按钮，保证可见。 */
  font-size: 14px;

  /* 单行高度避免图标上下偏移。 */
  line-height: 1;
}

/*
  平板宽度下的卡片网格。
  触发条件：视口宽度不超过 900px。
  调整原因：桌面卡片宽度在平板宽度下可能导致列数过少。
*/
@media (max-width: 900px) {
  .profile-grid {
    /*
        平板端从 7 列收为 3 列。
      这样卡片不会被压得过窄，也能保持统一海报比例。
    */
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .profile-media-card {
    /* 平板端改为跟随三列 grid，不再使用桌面固定宽度。 */
    width: 100%;

    /* 允许卡片随屏幕宽度压缩。 */
    min-width: 0;

    /* 取消桌面最大宽度，避免三列布局出现横向溢出。 */
    max-width: none;
  }

  .fav-item {
    /* 平板端收藏外层跟随三列 grid，不再使用桌面固定宽度。 */
    width: 100%;

    /* 取消桌面最大宽度，避免收藏外层比 grid 列更宽。 */
    max-width: none;
  }

  .profile-grid > .profile-media-card {
    /* 平板端历史卡片也跟随三列 grid，和收藏外层保持一致。 */
    width: 100%;

    /* 取消桌面最大宽度，避免历史卡片横向溢出。 */
    max-width: none;
  }
}

/*
  手机端个人中心布局。
  触发条件：视口宽度不超过 640px。
  调整目标：减少面板内边距，并让卡片固定成两列，保证浏览效率和点击面积。
*/
@media (max-width: 640px) {
  .profile-panel {
    /* 手机端收紧内容面板内边距，把更多横向空间留给视频卡片。 */
    padding: 16px 14px 18px;
  }

  .profile-grid {
    /*
      手机端卡片固定为两列。
      两列比单列更省空间，也比三列更适合点击。
    */
    grid-template-columns: repeat(2, minmax(0, 1fr));

    /* 手机端缩小卡片间距，给海报宽度让出更多空间。 */
    gap: 14px;
  }

  .profile-media-card__body {
    /* 窄屏下继续保持固定正文高度，只进一步收紧内部留白。 */
    padding: 8px 10px 9px;
  }

  .profile-media-card__title {
    /* 手机端标题继续缩小，保证个人中心多字段仍放在固定卡片高度内。 */
    font-size: 14px;
  }

  .profile-media-card__meta,
  .profile-media-card__activity {
    /* 手机端辅助信息继续压缩，避免卡片被撑高。 */
    font-size: 11px;
  }

  .profile-media-card__badge {
    /* 手机端角标缩小，避免覆盖太多海报内容。 */
    min-height: 28px;

    /* 手机端角标左右留白减少。 */
    padding: 0 10px;

    /* 手机端角标字号随卡片宽度收敛。 */
    font-size: 13px;
  }

  .user-card {
    /* 手机上用户卡改为纵向排列，避免用户说明区域过窄。 */
    flex-direction: column;

    /* 用户卡内容在窄屏下左对齐，保持阅读顺序。 */
    align-items: flex-start;
  }
}
</style>
