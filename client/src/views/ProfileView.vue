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
          │  │  └─ {VideoCard.profile-history-card} 循环渲染筛选后的播放历史
          │  ├─ [if shouldShowHistoryPagination]
          │  │  └─ {CatalogPagination} 渲染播放历史分页
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
             │  └─ {VideoCard.profile-favorite-card} 循环渲染筛选后的收藏卡片
             ├─ [if shouldShowFavoritePagination]
             │  └─ {CatalogPagination} 渲染收藏分页
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
                @click="handleHistoryFilterChange(option.value)"
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
            <!--
              [DEFAULT] ele(VideoCard.profile-history-card)
              - condition:
                  默认渲染。
                  paginatedHistoryList 每一项都会使用统一 VideoCard 展示，历史列表额外显示删除按钮。
              - type:
                  自定义组件
                  相对位置: ../components/common/VideoCard.vue
              - description:
                  播放历史视频卡片。
                  复用全站统一视频卡片结构，避免个人中心维护第二套视频卡片。
              - params:
                  -- video：播放历史整理后的 ContentItem 兼容对象。
                  -- favorite：播放历史记录当前项目使用占位收藏状态。
                  -- playback：播放历史固定生成的已播放占位状态。
                  -- showDelete：固定为 true，显示历史记录删除按钮。
              - events:
                  @toggle-favorite
                      - description:
                          用户点击卡片右上角收藏按钮时触发。
                          当前项目只保留事件入口，后续接入收藏状态仓库。
                      - methods:
                          handleToggleFavorite(item)
                              -- item：当前播放历史视频对象。
                  @delete
                      - description:
                          用户点击卡片右上角删除按钮时触发。
                          用于删除当前播放历史记录。
                      - methods:
                          removeHistoryItem(item)
                              -- item：当前播放历史视频对象。
            -->
            <VideoCard
              v-for="item in paginatedHistoryList"
              :key="item.recordId || item.id"
              class="profile-history-card"
              :video="item"
              :favorite="item.favorite"
              :playback="item.playback"
              show-delete
              @toggle-favorite="handleToggleFavorite"
              @delete="removeHistoryItem"
            />
          </div>

          <!--
            [IF shouldShowHistoryPagination] ele(CatalogPagination.profile-history-pagination)
            - condition:
                shouldShowHistoryPagination 为 true 时渲染。
                当前历史筛选结果超过 18 条，需要分页展示。
            - type:
                自定义组件
                相对位置: ../components/catalog/CatalogPagination.vue
            - description:
                播放历史分页组件。
                复用目录页分页组件，让个人中心历史记录按每页 12 条切换。
            - params:
                -- historyPagination：播放历史当前分页对象。
            - events:
                @change-page
                    - description:
                        用户点击上一页或下一页时触发。
                        用于切换播放历史当前页码。
                    - methods:
                        handleHistoryPageChange(payload)
                            -- payload：分页组件派发的目标页码对象。
          -->
          <CatalogPagination
            v-if="shouldShowHistoryPagination"
            :pagination="historyPagination"
            @change-page="handleHistoryPageChange"
          />

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
                @click="handleFavoriteFilterChange(option.value)"
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
            <!--
              [DEFAULT] ele(VideoCard.profile-favorite-card)
              - condition:
                  默认渲染。
                  paginatedFavoriteList 每一项都会使用统一 VideoCard 展示，收藏列表只显示收藏切换按钮。
              - type:
                  自定义组件
                  相对位置: ../components/common/VideoCard.vue
              - description:
                  收藏视频卡片。
                  复用全站统一视频卡片结构，收藏状态当前项目使用已收藏占位。
              - params:
                  -- video：收藏记录整理后的 ContentItem 兼容对象。
                  -- favorite：收藏列表固定传入 true，表示当前条目来自收藏集合。
              - events:
                  @toggle-favorite
                      - description:
                          用户点击收藏按钮时触发。
                          当前项目只保留事件入口，后续接入收藏状态仓库后再真正切换收藏。
                      - methods:
                          handleToggleFavorite(item)
                              -- item：当前收藏视频对象。
            -->
            <VideoCard
              v-for="item in paginatedFavoriteList"
              :key="item.recordId || item.id"
              class="profile-favorite-card"
              :video="item"
              :favorite="true"
              @toggle-favorite="handleToggleFavorite"
            />
          </div>

          <!--
            [IF shouldShowFavoritePagination] ele(CatalogPagination.profile-favorite-pagination)
            - condition:
                shouldShowFavoritePagination 为 true 时渲染。
                当前收藏筛选结果超过 18 条，需要分页展示。
            - type:
                自定义组件
                相对位置: ../components/catalog/CatalogPagination.vue
            - description:
                收藏列表分页组件。
                复用目录页分页组件，让个人中心收藏记录按每页 12 条切换。
            - params:
                -- favoritePagination：收藏列表当前分页对象。
            - events:
                @change-page
                    - description:
                        用户点击上一页或下一页时触发。
                        用于切换收藏列表当前页码。
                    - methods:
                        handleFavoritePageChange(payload)
                            -- payload：分页组件派发的目标页码对象。
          -->
          <CatalogPagination
            v-if="shouldShowFavoritePagination"
            :pagination="favoritePagination"
            @change-page="handleFavoritePageChange"
          />

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
// 导入来源: ../components/common/VideoCard.vue。
// 导入内容: VideoCard 统一视频卡片组件。
// 文件作用: 用于让播放历史和收藏记录复用全站统一视频卡片布局。
import VideoCard from '../components/common/VideoCard.vue';

// 导入来源: ../components/catalog/CatalogPagination.vue。
// 导入内容: CatalogPagination 通用分页组件。
// 文件作用: 用于让个人中心播放历史和收藏记录按每页 12 条展示。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';

// 导入来源: ../data/page-profile.mock。
// 导入内容: profilePageData 个人中心 mock 数据。
// 文件作用: 提供用户资料、播放历史和收藏列表的静态阶段数据。
import { profilePageData } from '../data/page-profile.mock';

// 类型: number。
// 作用: 个人中心播放历史和收藏记录每页展示数量，和 page-profile.mock.js 的双倍数据准备规则保持一致。
const PROFILE_PAGE_SIZE = 12;

export default {
  // 组件名称用于在 Vue 调试工具中识别当前页面。
  name: 'ProfileView',

  /*
    components 注册当前页面模板中使用的自定义组件。
    注册名必须和 template 标签名、顶部渲染树 ele(...) 名称保持一致。
  */
  components: {
    // 组件: VideoCard 统一视频卡片组件。
    // 作用: 渲染播放历史和收藏列表中的单个视频条目。
    VideoCard,

    // 组件: CatalogPagination 通用分页组件。
    // 作用: 渲染播放历史和收藏列表底部分页入口。
    CatalogPagination
  },

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

      // 播放历史当前页码；影响 `paginatedHistoryList`。
      activeHistoryPage: 1,

      // 收藏列表当前页码；影响 `paginatedFavoriteList`。
      activeFavoritePage: 1,

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
     * 当前页播放历史列表。
     * 来源: filteredHistoryList 和 activeHistoryPage。
     * 执行内容: 按每页 12 条截取当前页，避免 24 条历史一次性全部渲染。
     *
     * @returns {Array<Object>} 当前页播放历史卡片列表。
     */
    paginatedHistoryList() {
      // 返回值类型: Array<object>。
      // 作用: 只把当前页历史记录交给 VideoCard 渲染，保证个人中心历史页一页 18 个。
      return this.getPageItems(this.filteredHistoryList, this.historyPagination.page, this.historyPagination.pageSize);
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
     * 当前页收藏列表。
     * 来源: filteredFavoriteList 和 activeFavoritePage。
     * 执行内容: 按每页 12 条截取当前页，避免 24 条收藏一次性全部渲染。
     *
     * @returns {Array<Object>} 当前页收藏卡片列表。
     */
    paginatedFavoriteList() {
      // 返回值类型: Array<object>。
      // 作用: 只把当前页收藏记录交给 VideoCard 渲染，保证个人中心收藏页一页 18 个。
      return this.getPageItems(this.filteredFavoriteList, this.favoritePagination.page, this.favoritePagination.pageSize);
    },

    /**
     * 播放历史分页对象。
     * 来源: filteredHistoryList.length 和 activeHistoryPage。
     * 执行内容: 生成 CatalogPagination 可读取的标准 pagination 对象。
     *
     * @returns {Object} 播放历史标准分页对象。
     */
    historyPagination() {
      // 返回值类型: object。
      // 作用: 让个人中心历史列表复用目录分页组件，而不是维护第二套分页结构。
      return this.createLocalPagination(this.filteredHistoryList.length, this.activeHistoryPage);
    },

    /**
     * 收藏列表分页对象。
     * 来源: filteredFavoriteList.length 和 activeFavoritePage。
     * 执行内容: 生成 CatalogPagination 可读取的标准 pagination 对象。
     *
     * @returns {Object} 收藏列表标准分页对象。
     */
    favoritePagination() {
      // 返回值类型: object。
      // 作用: 让个人中心收藏列表复用目录分页组件，而不是维护第二套分页结构。
      return this.createLocalPagination(this.filteredFavoriteList.length, this.activeFavoritePage);
    },

    /**
     * 播放历史是否显示分页。
     *
     * @returns {boolean} 历史记录超过一页时返回 true。
     */
    shouldShowHistoryPagination() {
      // 返回值类型: boolean。
      // 作用: 只有筛选后历史记录超过 18 条时显示分页，避免单页数据出现多余控件。
      return this.historyPagination.totalPages > 1;
    },

    /**
     * 收藏列表是否显示分页。
     *
     * @returns {boolean} 收藏记录超过一页时返回 true。
     */
    shouldShowFavoritePagination() {
      // 返回值类型: boolean。
      // 作用: 只有筛选后收藏记录超过 18 条时显示分页，避免单页数据出现多余控件。
      return this.favoritePagination.totalPages > 1;
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
     * 把播放历史整理成 VideoCard 可直接消费的 ContentItem 兼容对象。
     * 播放历史属于已经播放过的内部记录，因此当前项目固定生成已播放占位状态。
     *
     * @param {Object} item 单条播放历史数据。
     * @returns {Object} 统一视频卡片展示对象。
     * @returns {string} return.recordId 播放历史记录 id，用于删除历史记录。
     * @returns {string} return.id 视频 id，用于 VideoCard 跳转详情页。
     * @returns {string} return.sourceId 数据源 id，用于详情页保持来源上下文。
     */
    normalizeHistoryItem(item) {
      // 类型: object。
      // 作用: item 缺失时使用空对象兜底，避免读取字段时报错。
      const historyItem = item || {};

      // 类型: object。
      // 作用: 保存历史记录里可能已经带入的 movie 字段，用于补齐片长。
      const movie = historyItem.movie || {};

      // 类型: object。
      // 作用: 保存历史记录里可能已经带入的 tv 字段，用于补齐集数状态。
      const tv = historyItem.tv || {};

      // 类型: boolean。
      // 作用: 历史数据带有 episodeLabel 或 episodeValue 时，优先按电视剧卡片处理。
      const looksLikeTv = Boolean(historyItem.episodeLabel || historyItem.episodeValue || tv.updateStatus);

      // 类型: string。
      // 作用: 缺少 type 时根据历史记录是否带分集信息推断基础类型。
      const contentType = historyItem.type || (looksLikeTv ? 'tv' : 'movie');

      // 类型: string|number。
      // 作用: 电视剧播放历史右侧 chip 需要当前集数，优先读结构化字段，再从 episodeLabel 推导。
      const currentEpisode = historyItem.currentEpisode || this.extractEpisodeNumber(historyItem.episodeLabel) || 1;

      // 类型: string。
      // 作用: 播放历史进度时间优先读结构化字段，再从 progressText 推导，最后用固定占位值。
      const playedTimeText = historyItem.playedTimeText || this.extractProgressTime(historyItem.progressText) || '12:30';

      // 类型: string。
      // 作用: 总时长优先读取内部播放字段，其次读取分集或电影时长，缺失时由 VideoCard 不显示总时长。
      const totalTimeText = historyItem.totalTimeText || historyItem.episodeDuration || movie.duration || historyItem.duration || '';

      // 返回值类型: object。
      // 作用: 返回 VideoCard 可直接渲染的统一字段结构。
      return {
        // 类型: string。
        // 作用: 保存播放历史记录 id，删除历史记录时按这个字段过滤原始列表。
        recordId: historyItem.id || historyItem.videoId,

        // 类型: string。
        // 作用: 保存真实视频 id，VideoCard 点击卡片时用它进入详情页。
        id: historyItem.videoId || historyItem.id,

        // 类型: string。
        // 作用: 保存数据源 id，详情页请求和卡片数据源展示都会读取该字段。
        sourceId: historyItem.sourceId || '',

        // 类型: string。
        // 作用: 保存数据源名称，缺失时 VideoCard 会用 sourceId 兜底。
        sourceName: historyItem.sourceName || '',

        // 类型: string。
        // 作用: 标记当前内容是电影还是电视剧，影响左上角主角标逻辑。
        type: contentType,

        // 类型: string。
        // 作用: 视频标题，驱动 VideoCard 标题和无图占位首字。
        title: historyItem.title || '未命名视频',

        // 类型: string。
        // 作用: 竖版海报地址，优先供 VideoCard 封面区使用。
        poster: historyItem.poster || '',

        // 类型: string。
        // 作用: 通用封面地址，poster 缺失时供 VideoCard 兜底。
        cover: historyItem.cover || '',

        // 类型: string|number。
        // 作用: 年份字段，VideoCard 会尽力放入“年份 / 地区 / 类型”元信息。
        year: historyItem.year || '',

        // 类型: string。
        // 作用: 地区字段，VideoCard 会尽力放入基础元信息。
        area: historyItem.area || '',

        // 类型: Array<string>。
        // 作用: 类型字段，VideoCard 只读取第一项作为卡片类型展示。
        genres: Array.isArray(historyItem.genres) ? historyItem.genres : [],

        // 类型: string|number。
        // 作用: 评分字段，缺失时 VideoCard 不渲染评分。
        score: historyItem.score || historyItem.rating || '',

        // 类型: string。
        // 作用: 清晰度字段，电影卡片左上角主角标优先读取该字段。
        quality: historyItem.quality || historyItem.qualityText || '',

        // 类型: string。
        // 作用: 通用短标签，清晰度或集数字段缺失时作为角标兜底。
        badge: historyItem.badge || historyItem.badgeText || '',

        // 类型: object。
        // 作用: 电影专属字段，当前项目主要给 VideoCard 读取总时长占位。
        movie: {
          // 类型: string|number。
          // 作用: 电影总时长，VideoCard 用于展示“00:00/总时长”。
          duration: movie.duration || historyItem.duration || ''
        },

        // 类型: object。
        // 作用: 电视剧专属字段，当前项目主要给 VideoCard 读取集数状态角标。
        tv: {
          // 类型: string。
          // 作用: 电视剧更新或当前分集状态，VideoCard 左上角主角标优先读取。
          updateStatus: tv.updateStatus || historyItem.updateStatus || historyItem.episodeLabel || '',

          // 类型: string|number。
          // 作用: 电视剧总集数，updateStatus 缺失时用于推导“全 xx 集”。
          totalEpisodes: tv.totalEpisodes || historyItem.totalEpisodes || ''
        },

        // 类型: boolean。
        // 作用: 当前项目保留收藏状态占位，后续接入内部收藏状态仓库。
        favorite: Boolean(historyItem.favorite),

        // 类型: object。
        // 作用: 播放历史固定生成已播放占位状态，保证统一 VideoCard 在历史页展示应有字段。
        playback: {
          // 类型: boolean。
          // 作用: 播放历史天然属于已播放记录，扩展行 2 应显示“已播放”。
          played: true,

          // 类型: string|number。
          // 作用: 电视剧播放历史显示当前播放集 chip，电影会被 VideoCard 自动忽略。
          currentEpisode,

          // 类型: string。
          // 作用: 已播放时间占位，后续由内部播放状态仓库提供真实值。
          playedTimeText,

          // 类型: string。
          // 作用: 总时长占位，有值时扩展行 2 显示“已播放时间/总时长”。
          totalTimeText
        },

        // 类型: boolean。
        // 作用: 播放历史筛选使用，true 进入“已看完”，false 进入“未看完”。
        completed: Boolean(historyItem.completed)
      };
    },

    /**
     * 把收藏数据整理成 VideoCard 可直接消费的 ContentItem 兼容对象。
     * 收藏列表里的卡片默认以已收藏状态展示，之后可接真实收藏切换逻辑。
     *
     * @param {Object} item 单条收藏数据。
     * @returns {Object} 统一视频卡片展示对象。
     * @returns {string} return.recordId 收藏记录 id，用于后续内部收藏状态操作。
     * @returns {string} return.id 视频 id，用于 VideoCard 跳转详情页。
     * @returns {boolean} return.favorite 收藏列表固定为 true。
     */
    normalizeFavoriteItem(item) {
      // 类型: object。
      // 作用: item 缺失时使用空对象兜底，避免读取字段时报错。
      const favoriteItem = item || {};

      // 类型: object。
      // 作用: 保存收藏记录里可能已经带入的 movie 字段，用于补齐片长。
      const movie = favoriteItem.movie || {};

      // 类型: object。
      // 作用: 保存收藏记录里可能已经带入的 tv 字段，用于补齐集数状态。
      const tv = favoriteItem.tv || {};

      // 返回值类型: object。
      // 作用: 返回 VideoCard 可直接渲染的统一字段结构。
      return {
        // 类型: string。
        // 作用: 保存收藏记录 id，后续接收藏状态仓库时可用于定位记录。
        recordId: favoriteItem.id || favoriteItem.videoId,

        // 类型: string。
        // 作用: 保存真实视频 id，VideoCard 点击卡片时用它进入详情页。
        id: favoriteItem.videoId || favoriteItem.id,

        // 类型: string。
        // 作用: 保存数据源 id，详情页请求和卡片数据源展示都会读取该字段。
        sourceId: favoriteItem.sourceId || '',

        // 类型: string。
        // 作用: 保存数据源名称，缺失时 VideoCard 会用 sourceId 兜底。
        sourceName: favoriteItem.sourceName || '',

        // 类型: string。
        // 作用: 标记当前内容是电影还是电视剧，缺失时按电影处理。
        type: favoriteItem.type || 'movie',

        // 类型: string。
        // 作用: 视频标题，驱动 VideoCard 标题和无图占位首字。
        title: favoriteItem.title || '未命名视频',

        // 类型: string。
        // 作用: 竖版海报地址，优先供 VideoCard 封面区使用。
        poster: favoriteItem.poster || '',

        // 类型: string。
        // 作用: 通用封面地址，poster 缺失时供 VideoCard 兜底。
        cover: favoriteItem.cover || '',

        // 类型: string|number。
        // 作用: 年份字段，VideoCard 会尽力放入“年份 / 地区 / 类型”元信息。
        year: favoriteItem.year || '',

        // 类型: string。
        // 作用: 地区字段，VideoCard 会尽力放入基础元信息。
        area: favoriteItem.area || '',

        // 类型: Array<string>。
        // 作用: 类型字段，VideoCard 只读取第一项作为卡片类型展示。
        genres: Array.isArray(favoriteItem.genres) ? favoriteItem.genres : [],

        // 类型: string|number。
        // 作用: 评分字段，缺失时 VideoCard 不渲染评分。
        score: favoriteItem.score || favoriteItem.rating || '',

        // 类型: string。
        // 作用: 清晰度字段，电影卡片左上角主角标优先读取该字段。
        quality: favoriteItem.quality || favoriteItem.qualityText || '',

        // 类型: string。
        // 作用: 通用短标签，清晰度或集数字段缺失时作为角标兜底。
        badge: favoriteItem.badge || favoriteItem.badgeText || '',

        // 类型: object。
        // 作用: 电影专属字段，当前项目主要给 VideoCard 读取总时长占位。
        movie: {
          // 类型: string|number。
          // 作用: 电影总时长，VideoCard 用于展示“00:00/总时长”。
          duration: movie.duration || favoriteItem.duration || ''
        },

        // 类型: object。
        // 作用: 电视剧专属字段，当前项目主要给 VideoCard 读取集数状态角标。
        tv: {
          // 类型: string。
          // 作用: 电视剧更新状态，VideoCard 左上角主角标优先读取。
          updateStatus: tv.updateStatus || favoriteItem.updateStatus || '',

          // 类型: string|number。
          // 作用: 电视剧总集数，updateStatus 缺失时用于推导“全 xx 集”。
          totalEpisodes: tv.totalEpisodes || favoriteItem.totalEpisodes || ''
        },

        // 类型: boolean。
        // 作用: 收藏列表当前项目固定显示已收藏状态。
        favorite: true,

        // 类型: object。
        // 作用: 收藏记录没有播放状态时按未播放占位，保持和其它页面 VideoCard 布局一致。
        playback: {
          // 类型: boolean。
          // 作用: 收藏列表当前 mock 没有播放状态，默认显示从未播放。
          played: Boolean(favoriteItem.played),

          // 类型: string。
          // 作用: 未播放状态下使用 00:00 占位。
          playedTimeText: favoriteItem.playedTimeText || '00:00',

          // 类型: string。
          // 作用: 总时长有值时显示“00:00/总时长”，缺失时只显示 00:00。
          totalTimeText: favoriteItem.totalTimeText || movie.duration || favoriteItem.duration || ''
        },

        // 类型: boolean。
        // 作用: 收藏列表筛选使用，true 进入“已看完”，false 进入“未看完”。
        completed: Boolean(favoriteItem.completed)
      };
    },

    /**
     * 从分集文案中提取集数。
     * 用于当前项目给播放历史生成“正在播放第几集”的占位 chip。
     *
     * @param {string} episodeText 分集文案，例如“第 3 集”。
     * @returns {number|string} 提取到的集数；没有集数时返回空字符串。
     */
    extractEpisodeNumber(episodeText) {
      // 条件分支: 分集文案为空时进入。
      // 执行内容: 返回空字符串，让调用方决定是否使用默认集数。
      if (!episodeText) {
        return '';
      }

      // 类型: RegExpMatchArray|null。
      // 作用: 从中文分集文案里提取第一个数字。
      const match = String(episodeText).match(/\d+/);

      // 返回值类型: number|string。
      // 作用: 提取成功时返回数字，失败时返回空字符串。
      return match ? Number(match[0]) : '';
    },

    /**
     * 从播放进度文案中提取时间。
     * 用于当前项目把“看到 12:30”转换成 VideoCard 的已播放时间。
     *
     * @param {string} progressText 播放进度文案。
     * @returns {string} HH:mm 或 mm:ss 形式时间；没有时间时返回空字符串。
     */
    extractProgressTime(progressText) {
      // 条件分支: 播放进度文案为空时进入。
      // 执行内容: 返回空字符串，让调用方使用固定占位。
      if (!progressText) {
        return '';
      }

      // 类型: RegExpMatchArray|null。
      // 作用: 匹配进度文案中的时间片段。
      const match = String(progressText).match(/\d{1,2}:\d{2}/);

      // 返回值类型: string。
      // 作用: 提取成功时返回时间片段，失败时返回空字符串。
      return match ? match[0] : '';
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
     * 创建本地分页对象。
     * 纯函数: 只根据总数和当前页返回分页对象，不修改列表数据。
     *
     * @param {number} total 当前筛选结果总条数。
     * @param {number} currentPage 当前页面记录的页码。
     * @returns {Object} CatalogPagination 可读取的标准分页对象。
     * @returns {number} return.page 当前有效页码。
     * @returns {number} return.pageSize 每页数量。
     * @returns {number} return.total 当前筛选结果总数。
     * @returns {number} return.totalPages 当前筛选结果总页数。
     * @returns {boolean} return.hasMore 是否还有下一页。
     */
    createLocalPagination(total, currentPage) {
      // 类型: number。
      // 作用: total 只接受非负数字，异常值统一按 0 处理。
      const safeTotal = Number.isFinite(Number(total)) && Number(total) > 0 ? Math.floor(Number(total)) : 0;

      // 类型: number。
      // 作用: 根据个人中心每页 12 条计算总页数，空列表时总页数为 0。
      const totalPages = safeTotal > 0 ? Math.ceil(safeTotal / PROFILE_PAGE_SIZE) : 0;

      // 类型: number。
      // 作用: 把当前页码限制在有效范围内，删除记录或切换筛选后不会越界。
      const safePage = Math.min(Math.max(Number(currentPage) || 1, 1), totalPages || 1);

      // 返回值类型: object。
      // 作用: 返回和 siteContentStore PageBucket.pagination 同形状的本地分页对象。
      return {
        page: safePage,
        pageSize: PROFILE_PAGE_SIZE,
        total: safeTotal,
        totalPages,
        hasMore: totalPages > 0 && safePage < totalPages
      };
    },

    /**
     * 截取当前页列表。
     * 纯函数: 只读取传入数组和分页数字，不修改原数组。
     *
     * @param {Array<Object>} list 完整筛选结果列表。
     * @param {number} page 当前页码。
     * @param {number} pageSize 每页数量。
     * @returns {Array<Object>} 当前页列表。
     */
    getPageItems(list, page, pageSize) {
      // 类型: Array<object>。
      // 作用: 非数组兜底为空数组，避免 slice 调用异常。
      const safeList = Array.isArray(list) ? list : [];

      // 类型: number。
      // 作用: 当前页起始下标，第一页从 0 开始。
      const startIndex = (page - 1) * pageSize;

      // 类型: number。
      // 作用: 当前页结束下标，slice 不包含该下标。
      const endIndex = startIndex + pageSize;

      // 返回值类型: Array<object>。
      // 作用: 返回当前页数据，供 template 渲染 VideoCard。
      return safeList.slice(startIndex, endIndex);
    },

    /**
     * 切换播放历史筛选条件。
     * 副作用: 更新 activeHistoryFilter，并把历史分页重置到第一页。
     *
     * @param {string} filterValue 用户点击的历史筛选值。
     * @returns {void} 只更新当前页面本地状态。
     */
    handleHistoryFilterChange(filterValue) {
      // 副作用: 保存新的历史筛选条件。
      // 影响范围: filteredHistoryList 和 paginatedHistoryList 会重新计算。
      this.activeHistoryFilter = filterValue;

      // 副作用: 筛选变化后回到第一页，避免当前页码超过新筛选结果页数。
      this.activeHistoryPage = 1;
    },

    /**
     * 切换收藏筛选条件。
     * 副作用: 更新 activeFavoriteFilter，并把收藏分页重置到第一页。
     *
     * @param {string} filterValue 用户点击的收藏筛选值。
     * @returns {void} 只更新当前页面本地状态。
     */
    handleFavoriteFilterChange(filterValue) {
      // 副作用: 保存新的收藏筛选条件。
      // 影响范围: filteredFavoriteList 和 paginatedFavoriteList 会重新计算。
      this.activeFavoriteFilter = filterValue;

      // 副作用: 筛选变化后回到第一页，避免当前页码超过新筛选结果页数。
      this.activeFavoritePage = 1;
    },

    /**
     * 切换播放历史页码。
     * 触发来源: CatalogPagination 的 change-page 事件。
     *
     * @param {Object} payload 分页组件事件参数。
     * @param {number} payload.page 目标页码。
     * @returns {void} 只更新播放历史当前页码。
     */
    handleHistoryPageChange(payload) {
      // 类型: number。
      // 作用: 从分页事件中读取目标页码。
      const targetPage = payload && payload.page ? Number(payload.page) : 1;

      // 副作用: 写入播放历史页码，paginatedHistoryList 会随之重新截取。
      this.activeHistoryPage = targetPage;
    },

    /**
     * 切换收藏列表页码。
     * 触发来源: CatalogPagination 的 change-page 事件。
     *
     * @param {Object} payload 分页组件事件参数。
     * @param {number} payload.page 目标页码。
     * @returns {void} 只更新收藏当前页码。
     */
    handleFavoritePageChange(payload) {
      // 类型: number。
      // 作用: 从分页事件中读取目标页码。
      const targetPage = payload && payload.page ? Number(payload.page) : 1;

      // 副作用: 写入收藏页码，paginatedFavoriteList 会随之重新截取。
      this.activeFavoritePage = targetPage;
    },

    /**
     * 响应统一视频卡片的收藏切换事件。
     * 当前项目收藏状态仍属于内部状态占位，先保留统一事件入口。
     *
     * @param {Object} item 触发收藏切换的视频卡片对象。
     * @returns {void} 当前项目不修改数据，后续接入收藏状态仓库。
     */
    handleToggleFavorite(item) {
      // 参数类型: object。
      // 作用: item 是 VideoCard 传出的当前视频对象，后续会用于定位收藏状态。
      const targetItem = item || {};

      // 当前项目不写入收藏状态，只保留事件入口，避免页面没有响应方法时报错。
      void targetItem;
    },

    /**
     * 清空当前页面播放历史。
     *
     * @returns {void}
     */
    clearHistory() {
      // 当前项目先更新页面状态；后续接入存储层时再同步清理持久化数据。
      this.playHistory = [];

      // 清空历史后重置页码，避免页面继续停留在不存在的第二页。
      this.activeHistoryPage = 1;
    },

    /**
     * 清空当前页面收藏列表。
     *
     * @returns {void}
     */
    clearFavorites() {
      // 当前项目先更新页面状态；后续接入存储层时再同步清理持久化数据。
      this.favorites = [];

      // 清空收藏后重置页码，避免页面继续停留在不存在的第二页。
      this.activeFavoritePage = 1;
    },

    /**
     * 删除单条播放历史。
     * 触发来源: VideoCard 的 @delete 事件。
     *
     * @param {Object} item 播放历史卡片对象。
     * @returns {void} 删除当前页面中的对应播放历史记录。
     */
    removeHistoryItem(item) {
      // 类型: string。
      // 作用: recordId 来自 normalizeHistoryItem，用于匹配 playHistory 原始记录 id。
      const recordId = item && item.recordId ? item.recordId : '';

      // 条件分支: recordId 为空时进入。
      // 执行内容: 直接返回，避免误删其它历史记录。
      if (!recordId) {
        return;
      }

      // 执行内容: 根据历史记录 id 过滤当前页面播放历史列表。
      this.playHistory = this.playHistory.filter(historyItem => historyItem.id !== recordId);

      // 删除历史后页码可能越界，按最新分页对象回写有效页码。
      this.activeHistoryPage = this.historyPagination.page;
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
  内部直接渲染统一 VideoCard，不再维护个人中心专用海报卡片。
*/
.profile-grid {
  /* 使用 Grid 自动排布卡片。 */
  display: grid;

  /*
    桌面端固定 6 列。
    首页左侧视频区来自同一套 6 列栅格里的 4 列，所以个人中心单列宽度会和首页卡片一致。
  */
  grid-template-columns: repeat(var(--page-grid-columns), minmax(0, 1fr));

  /* 控制卡片之间的横向和纵向间距，跟页面统一栅格一致。 */
  gap: var(--page-grid-gap);

  /* 顶部留一点空间，让卡片和工具栏之间不贴。 */
  padding-top: 6px;
}

/*
  平板宽度下的卡片网格。
  触发条件：视口宽度不超过 900px。
  调整原因：桌面卡片宽度在平板宽度下可能导致列数过少。
*/
@media (max-width: 900px) {
  .profile-grid {
    /*
        平板端从桌面 6 列收为 3 列。
      这样卡片不会被压得过窄，也能保持统一海报比例。
    */
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .user-card {
    /* 手机上用户卡改为纵向排列，避免用户说明区域过窄。 */
    flex-direction: column;

    /* 用户卡内容在窄屏下左对齐，保持阅读顺序。 */
    align-items: flex-start;
  }
}
</style>
