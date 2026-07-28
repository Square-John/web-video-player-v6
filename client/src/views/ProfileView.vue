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
          │  │  └─ {UserVideoCard.profile-history-card} 循环渲染筛选后的播放历史
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
             │  └─ {UserVideoCard.profile-favorite-card} 循环渲染筛选后的收藏卡片
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

            <!-- 清空历史通过 userContentService 先提交 IndexedDB，成功后统一更新列表投影。 -->
            <el-button size="small" @click="clearHistory">清空历史</el-button>
          </div>

          <!--
            历史卡片网格。
            数据来源：`filteredHistoryList`。
            页面作用：使用统一海报卡片展示播放历史。
          -->
          <div class="profile-grid" data-testid="profile-history-grid">
            <!--
              [DEFAULT] ele(UserVideoCard.profile-history-card)
              - condition:
                  默认渲染。
                  paginatedHistoryList 每一项都会使用带用户状态的统一卡片展示，历史列表额外显示删除按钮。
              - type:
                  自定义组件
                  相对位置: ../components/common/UserVideoCard.vue
              - description:
                  播放历史视频卡片。
                  复用全站统一视频卡片结构，并通过容器组件接入收藏和播放状态。
              - params:
                  -- video：播放历史引用补全后的纯 ContentItem 展示对象。
                  -- playback：当前历史记录自身的分集、进度和最近播放时间。
                  -- preferProvidedPlayback：固定为 true，阻止内容级最近记录覆盖当前历史。
                  -- showDelete：固定为 true，显示历史记录删除按钮。
                  -- navigationTarget：当前历史记录生成的精确播放页目标。
              - events:
                  @toggle-favorite
                      - description:
                          用户点击卡片右上角收藏按钮时触发。
                          UserVideoCard 内部等待收藏持久化成功后触发，本页只负责页码收口。
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
            <UserVideoCard
              v-for="item in paginatedHistoryList"
              :key="item.recordId || item.video.id"
              class="profile-history-card"
              :video="item.video"
              :playback="item.playback"
              :navigation-target="item.navigationTarget"
              show-source-status
              :source-available="item.sourceAvailable"
              :source-status-text="item.sourceStatusText"
              prefer-provided-playback
              show-delete
              @toggle-favorite="handleToggleFavorite"
              @delete="removeHistoryItem(item)"
            />
          </div>

          <!--
            [IF shouldShowHistoryPagination] ele(CatalogPagination.profile-history-pagination)
            - condition:
                shouldShowHistoryPagination 为 true 时渲染。
                当前历史筛选结果超过 12 条，需要分页展示。
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

            <!-- 清空收藏通过 userContentService 先提交 IndexedDB，成功后统一更新列表投影。 -->
            <el-button size="small" @click="clearFavorites">清空收藏</el-button>
          </div>

          <!--
            收藏卡片网格。
            数据来源：`filteredFavoriteList`。
            页面作用：用海报卡片展示收藏内容，并在卡片右上角提供删除入口。
          -->
          <div class="profile-grid" data-testid="profile-favorites-grid">
            <!--
              [DEFAULT] ele(UserVideoCard.profile-favorite-card)
              - condition:
                  默认渲染。
                  paginatedFavoriteList 每一项都会使用带用户状态的统一卡片展示，收藏列表只显示收藏切换按钮。
              - type:
                  自定义组件
                  相对位置: ../components/common/UserVideoCard.vue
              - description:
                  收藏视频卡片。
                  复用全站统一视频卡片结构，并通过容器组件读取收藏状态。
              - params:
                  -- video：收藏记录整理后的 ContentItem 兼容对象。
              - events:
                  @toggle-favorite
                      - description:
                          用户点击收藏按钮时触发。
                          UserVideoCard 内部等待收藏持久化成功后触发，本页只负责收藏列表页码收口。
                      - methods:
                          handleToggleFavorite(item)
                              -- item：当前收藏视频对象。
            -->
            <UserVideoCard
              v-for="item in paginatedFavoriteList"
              :key="item.recordId || item.id"
              class="profile-favorite-card"
              :video="item"
              :navigation-target="item.navigationTarget"
              show-source-status
              :source-available="item.sourceAvailable"
              :source-status-text="item.sourceStatusText"
              @toggle-favorite="handleToggleFavorite"
            />
          </div>

          <!--
            [IF shouldShowFavoritePagination] ele(CatalogPagination.profile-favorite-pagination)
            - condition:
                shouldShowFavoritePagination 为 true 时渲染。
                当前收藏筛选结果超过 12 条，需要分页展示。
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
/*
  ProfileView.vue 模块说明

  - 文件职责:
      渲染个人中心用户资料、播放历史和收藏列表，并直接从持久化 ContentCardSnapshot 恢复卡片。
      根据 SourceManager 权威状态显示来源可用点；失效记录进入带恢复键的搜索链，用户内容写入继续委托统一 service。

  - 导入库及文件汇总(9 条，内置 0 条，第三方 0 条，自定义 9 条):
      UserVideoCard: 自定义组件，渲染带用户状态的视频卡片。
      CatalogPagination: 自定义组件，渲染个人中心历史和收藏分页。
      getUserContentUser/getFavoriteRecordsForDisplay/getPlayHistoryRecordsForDisplay: 自定义 selector，读取用户内容运行态。
      clearFavoriteRecords/clearPlayHistory/removePlayHistory: 自定义服务，提交用户内容 Repository 后更新响应式投影。
      buildContentKey: 自定义工具函数，生成内容实体共享池 key。
      createHistoryPlaybackNavigationTarget: 自定义服务，根据单条历史记录生成精确播放路由目标。
      createContentItemFromSnapshot: 自定义快照服务，从用户记录恢复标准卡片字段。
      userContentRecoveryService exports: 自定义恢复门面，判断来源状态并创建失效记录搜索目标。
      USER_CONTENT_RECOVERY_KIND: 自定义配置，区分收藏与历史恢复键。

  - 模块级常量:
      PROFILE_PAGE_SIZE: number，个人中心历史和收藏每页展示数量。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      ProfileView: Vue page component，供 profile 路由展示用户内容状态。
*/
// 导入来源: ../components/common/UserVideoCard.vue。
// 导入内容: UserVideoCard 带用户状态的视频卡片容器。
// 文件作用: 用于让播放历史和收藏记录复用全站统一视频卡片布局，并统一接入收藏和播放状态。
import UserVideoCard from '../components/common/UserVideoCard.vue';

// 导入来源: ../components/catalog/CatalogPagination.vue。
// 导入内容: CatalogPagination 通用分页组件。
// 文件作用: 用于让个人中心播放历史和收藏记录按每页 12 条展示。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';

import {
  // 导入来源: ../selectors/userContentSelectors。
  // 导入内容: getUserContentUser 用户资料 selector。
  // 文件作用: 个人中心顶部用户卡片从用户内容 store 读取运行时状态。
  getUserContentUser,

  // 导入来源: ../selectors/userContentSelectors。
  // 导入内容: getFavoriteRecordsForDisplay 收藏列表 selector。
  // 文件作用: 收藏标签页按“最近播放优先，否则收藏时间”读取收藏记录。
  getFavoriteRecordsForDisplay,

  // 导入来源: ../selectors/userContentSelectors。
  // 导入内容: getPlayHistoryRecordsForDisplay 播放历史 selector。
  // 文件作用: 播放历史标签页按最近播放时间读取历史记录。
  getPlayHistoryRecordsForDisplay
} from '../selectors/userContentSelectors.js';

import {
  // 导入来源: ../services/userContentService。
  // 导入内容: clearFavorites 清空收藏服务。
  // 文件作用: 个人中心清空收藏时先提交 Repository，再由 service 更新 userContentStore。
  clearFavorites as clearFavoriteRecords,

  // 导入来源: ../services/userContentService。
  // 导入内容: clearPlayHistory 清空播放历史服务。
  // 文件作用: 个人中心清空历史时先提交 Repository，再由 service 更新 userContentStore。
  clearPlayHistory,

  // 导入来源: ../services/userContentService。
  // 导入内容: removePlayHistory 删除单条播放历史服务。
  // 文件作用: 播放历史卡片删除按钮按 historyKey 删除运行时历史记录。
  removePlayHistory
} from '../services/userContentService.js';

// 导入来源: ../utils/contentKeys。
// 导入内容: buildContentKey 内容实体 key 生成函数。
// 文件作用: 个人中心本地补全映射使用同一套 sourceId + contentId key。
import { buildContentKey } from '../utils/contentKeys.js';

// 导入来源: ../services/playerNavigationService.js。
// 导入内容: createHistoryPlaybackNavigationTarget 历史记录播放导航目标构造函数。
// 文件作用: 个人中心按当前 historyKey 对应记录生成分集、线路和自动播放上下文，不读取同内容最新记录。
import { createHistoryPlaybackNavigationTarget } from '../services/playerNavigationService.js';

// 导入来源: ../services/userContentSnapshotService.js；导入内容: createContentItemFromSnapshot；文件作用: 不请求 Provider 即可恢复完整卡片。
import { createContentItemFromSnapshot } from '../services/userContentSnapshotService.js';

import {
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: getUserContentSourceStatus；文件作用: 为个人中心状态点派生可用性。
  getUserContentSourceStatus,
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: createUserContentRecoverySearchTarget；文件作用: 为失效记录创建重新搜索目标。
  createUserContentRecoverySearchTarget
} from '../services/userContentRecoveryService.js';

// 导入来源: ../config/user-content.config.js；导入内容: USER_CONTENT_RECOVERY_KIND；文件作用: 生成收藏或历史恢复目标。
import { USER_CONTENT_RECOVERY_KIND } from '../config/user-content.config.js';

// 类型: number。
// 作用: 个人中心播放历史和收藏记录每页展示数量，和全站卡片分页策略保持一致。
const PROFILE_PAGE_SIZE = 12;

export default {
  // 组件名称用于在 Vue 调试工具中识别当前页面。
  name: 'ProfileView',

  /*
    components 注册当前页面模板中使用的自定义组件。
    注册名必须和 template 标签名、顶部渲染树 ele(...) 名称保持一致。
  */
  components: {
    // 组件: UserVideoCard 带用户状态的视频卡片容器。
    // 作用: 渲染播放历史和收藏列表中的单个视频条目，并接入收藏和播放状态。
    UserVideoCard,

    // 组件: CatalogPagination 通用分页组件。
    // 作用: 渲染播放历史和收藏列表底部分页入口。
    CatalogPagination
  },

  /**
   * 个人中心页面本地状态。
   * 纯函数: 每个页面实例返回独立筛选、分页和补全映射状态，不修改用户内容 store。
   *
   * @returns {Object} 页面渲染所需的用户资料、列表数据和筛选状态。
   */
  data() {
    return {
      // 当前激活的标签页。
      // 渲染位置：`el-tabs v-model="activeTab"`。
      activeTab: 'history',

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
     * 当前用户资料。
     * 数据来源: userContentStore，经 getUserContentUser selector 读取。
     * 纯函数: 只通过 selector 读取用户资料，不修改 store。
     *
     * @returns {object|null} 当前用户资料。
     */
    user() {
      // 返回值类型: object|null。
      // 作用: 顶部用户卡片统一跟随 userContentStore 运行态。
      return getUserContentUser();
    },

    /**
     * 播放历史记录列表。
     * 数据来源: userContentStore，经 getPlayHistoryRecordsForDisplay selector 读取。
     * 纯函数: 只通过 selector 返回排序后的新数组，不修改 store。
     *
     * @returns {Array<object>} 按最近播放时间排序的播放历史记录。
     */
    playHistory() {
      // 返回值类型: Array<object>。
      // 作用: 历史标签页实时读取运行时播放历史，播放页写入后会自动更新。
      return getPlayHistoryRecordsForDisplay();
    },

    /**
     * 收藏记录列表。
     * 数据来源: userContentStore，经 getFavoriteRecordsForDisplay selector 读取。
     * 纯函数: 只通过 selector 返回排序后的新数组，不修改 store。
     *
     * @returns {Array<object>} 按收藏展示规则排序的收藏记录。
     */
    favorites() {
      // 返回值类型: Array<object>。
      // 作用: 收藏标签页实时读取运行时收藏记录，详情页和卡片点击收藏后会自动更新。
      return getFavoriteRecordsForDisplay();
    },

    /**
     * 是否存在用户资料。
     * 纯函数: 只读取 user 并返回存在性判断。
     *
     * @returns {boolean} 有用户对象时返回 true。
     */
    hasUser() {
      return Boolean(this.user);
    },

    /**
     * 播放历史原始列表是否有内容。
     * 纯函数: 只读取 playHistory.length。
     *
     * @returns {boolean} 原始播放历史非空时返回 true。
     */
    hasPlayHistory() {
      return this.playHistory.length > 0;
    },

    /**
     * 收藏原始列表是否有内容。
     * 纯函数: 只读取 favorites.length。
     *
     * @returns {boolean} 原始收藏列表非空时返回 true。
     */
    hasFavorites() {
      return this.favorites.length > 0;
    },

    /**
     * 用户头像中显示的文字。
     * 纯函数: 只读取用户名并返回首字或游客兜底。
     *
     * @returns {string} 用户名首字或游客标识。
     */
    userInitial() {
      // 条件分支: 没有用户资料或用户名时进入。
      // 执行内容: 返回“客”作为游客头像占位。
      if (!this.user || !this.user.name) {
        return '客';
      }

      // 只取第一个字符，避免头像区域被长用户名撑开。
      return this.user.name.slice(0, 1);
    },

    /**
     * 用户角色展示文本。
     * 纯函数: 只读取用户角色并返回展示文案。
     *
     * @returns {string} 用户卡片里的角色标签文本。
     */
    userRoleText() {
      // 条件分支: 用户资料或 role 为空时进入。
      // 执行内容: 返回游客状态文案。
      if (!this.user || !this.user.role) {
        return '游客状态';
      }

      // guest 是数据字段值，页面上转换为中文说明。
      return this.user.role === 'guest' ? '游客状态' : this.user.role;
    },

    /**
     * 用户数据状态文本。
     * 纯函数: 只读取用户状态并返回展示文案。
     *
     * @returns {string} 用户卡片里的数据状态说明。
     */
    userStatusText() {
      // 条件分支: 用户资料或 status 为空时进入。
      // 执行内容: 返回状态未知兜底说明。
      if (!this.user || !this.user.status) {
        return '状态未知';
      }

      // local 表示数据保存在当前浏览器。
      return this.user.status === 'local' ? '本地数据' : this.user.status;
    },

    /**
     * 播放历史数量文本。
     * 纯函数: 只读取 playHistory.length 并生成文案。
     *
     * @returns {string} 用户卡片和工具栏使用的历史数量说明。
     */
    historyCountText() {
      return `${this.playHistory.length} 条历史`;
    },

    /**
     * 收藏数量文本。
     * 纯函数: 只读取 favorites.length 并生成文案。
     *
     * @returns {string} 用户卡片和工具栏使用的收藏数量说明。
     */
    favoriteCountText() {
      return `${this.favorites.length} 个收藏`;
    },

    /**
     * 格式化后的播放历史列表。
     * 纯函数: 使用 map 返回新的记录级视图模型数组，不修改历史记录。
     *
     * @returns {Array<Object>} 可以直接渲染成个人中心海报卡片的历史数据。
     */
    historyCardList() {
      return this.playHistory.map(item => this.normalizeHistoryItem(item));
    },

    /**
     * 格式化后的收藏列表。
     * 纯函数: 使用 map 返回新的收藏卡片数组，不修改收藏记录。
     *
     * @returns {Array<Object>} 可以直接渲染成个人中心海报卡片的收藏数据。
     */
    favoriteCardList() {
      return this.favorites.map(item => this.normalizeFavoriteItem(item));
    },

    /**
     * 应用筛选后的播放历史列表。
     * 纯函数: 只按当前筛选值返回新数组或原数组引用，不修改历史记录。
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
     * 纯函数: 只读取筛选结果和分页对象并返回 slice 新数组。
     *
     * @returns {Array<Object>} 当前页播放历史卡片列表。
     */
    paginatedHistoryList() {
      // 返回值类型: Array<object>。
      // 作用: 只把当前页历史记录交给 UserVideoCard 渲染，保证个人中心历史页一页 12 个。
      return this.getPageItems(this.filteredHistoryList, this.historyPagination.page, this.historyPagination.pageSize);
    },

    /**
     * 应用筛选后的收藏列表。
     * 纯函数: 只按当前筛选值返回新数组或原数组引用，不修改收藏记录。
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
     * 纯函数: 只读取筛选结果和分页对象并返回 slice 新数组。
     *
     * @returns {Array<Object>} 当前页收藏卡片列表。
     */
    paginatedFavoriteList() {
      // 返回值类型: Array<object>。
      // 作用: 只把当前页收藏记录交给 UserVideoCard 渲染，保证个人中心收藏页一页 12 个。
      return this.getPageItems(this.filteredFavoriteList, this.favoritePagination.page, this.favoritePagination.pageSize);
    },

    /**
     * 播放历史分页对象。
     * 来源: filteredHistoryList.length 和 activeHistoryPage。
     * 执行内容: 生成 CatalogPagination 可读取的标准 pagination 对象。
     * 纯函数: 返回新分页对象，不修改页码或历史数组。
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
     * 纯函数: 返回新分页对象，不修改页码或收藏数组。
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
     * 纯函数: 只读取 historyPagination.totalPages。
     *
     * @returns {boolean} 历史记录超过一页时返回 true。
     */
    shouldShowHistoryPagination() {
      // 返回值类型: boolean。
      // 作用: 只有筛选后历史记录超过 12 条时显示分页，避免单页数据出现多余控件。
      return this.historyPagination.totalPages > 1;
    },

    /**
     * 收藏列表是否显示分页。
     * 纯函数: 只读取 favoritePagination.totalPages。
     *
     * @returns {boolean} 收藏记录超过一页时返回 true。
     */
    shouldShowFavoritePagination() {
      // 返回值类型: boolean。
      // 作用: 只有筛选后收藏记录超过 12 条时显示分页，避免单页数据出现多余控件。
      return this.favoritePagination.totalPages > 1;
    },

    /**
     * 播放历史空状态文案。
     * 纯函数: 只读取历史数量并返回对应空状态文本。
     *
     * @returns {string} 历史标签页空状态描述。
     */
    historyEmptyText() {
      return this.playHistory.length ? '当前筛选下暂无记录' : '暂无播放历史';
    },

    /**
     * 收藏空状态文案。
     * 纯函数: 只读取收藏数量并返回对应空状态文本。
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
     * 纯函数: 数组原样返回，其他输入返回新空数组。
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
     * 纯函数: 只校验 value 类型，不修改输入。
     *
     * @param {*} value 可能来自个人中心数据文件的任意值。
     * @returns {Object|null} 普通对象原样返回，其他值返回 null。
     */
    asObjectOrNull(value) {
      // 条件分支: value 为 null、非对象或数组时进入。
      // 执行内容: 返回 null，阻止异常值作为用户资料对象使用。
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      return value;
    },

    /**
     * 读取用户内容记录对应的内容实体 key。
     * 纯函数: 只读取 record，不修改页面状态。
     *
     * @param {Object} record 收藏记录或播放历史记录。
     * @returns {string} 内容实体 key，缺失关键字段时返回空字符串。
     */
    getRecordContentKey(record) {
      // 类型: object。
      // 作用: record 异常时使用空对象兜底，避免读取字段时报错。
      const safeRecord = record && typeof record === 'object' ? record : {};

      // 返回值类型: string。
      // 作用: 优先复用记录中已有 contentKey，缺失时按 sourceId + contentId 生成。
      return safeRecord.contentKey || buildContentKey(safeRecord.sourceId, safeRecord.contentId);
    },

    /**
     * 判断播放历史是否已经看完。
     * 纯函数: 只读取播放历史秒数，不修改页面状态。
     *
     * @param {Object} historyRecord 播放历史记录。
     * @returns {boolean} 距离结尾小于等于 30 秒时视为已看完。
     */
    isHistoryCompleted(historyRecord) {
      // 类型: object。
      // 作用: historyRecord 异常时使用空对象兜底。
      const safeRecord = historyRecord && typeof historyRecord === 'object' ? historyRecord : {};

      // 类型: number。
      // 作用: 已播放秒数，用于判断完成度筛选。
      const playedSeconds = Number(safeRecord.playedSeconds) || 0;

      // 类型: number。
      // 作用: 总时长秒数，缺失时无法判断完成。
      const durationSeconds = Number(safeRecord.durationSeconds) || 0;

      // 返回值类型: boolean。
      // 作用: 有总时长且接近结尾时归入“已看完”筛选。
      return durationSeconds > 0 && durationSeconds - playedSeconds <= 30;
    },

    /**
     * 把播放历史整理成记录级卡片视图模型。
     * 内容字段、用户播放状态、列表元数据和导航目标保持分离，避免把内部字段混入 ContentItem。
     * 纯函数: 只读取当前历史、已补全内容和格式化方法并返回新对象，不修改用户内容状态。
     *
     * @param {Object} item 单条播放历史数据。
     * @returns {Object} 历史卡片记录级视图模型。
     * @returns {string} return.recordId 播放历史记录 id，用于删除历史记录。
     * @returns {Object} return.video 仅包含 VideoCard 消费的 ContentItem 展示字段。
     * @returns {Object} return.playback 当前历史记录自身的播放展示字段。
     * @returns {Object|null} return.navigationTarget 当前记录精确播放路由目标。
     */
    normalizeHistoryItem(item) {
      // 类型: object。
      // 作用: item 缺失时使用空对象兜底，避免读取字段时报错。
      const historyItem = item || {};

      // 类型: object。
      // 作用: 优先从持久化快照恢复完整卡片；v24 前旧记录使用明确旧历史占位且不请求 Provider。
      const contentItem = createContentItemFromSnapshot(historyItem.contentSnapshot) || {
        id: historyItem.contentId || '',
        sourceId: historyItem.sourceId || '',
        sourceName: historyItem.sourceId || '',
        type: historyItem.type || 'movie',
        title: '旧播放记录',
        poster: '',
        cover: '',
        genres: [],
        movie: { duration: '' },
        tv: { updateStatus: '', totalEpisodes: '' }
      };
      // 类型: object；作用: 使用 SourceManager 权威状态决定个人中心状态点和点击去向。
      const sourceStatus = getUserContentSourceStatus(historyItem);

      // 类型: object。
      // 作用: 保存内容对象里的 movie 字段，用于补齐片长。
      const movie = contentItem.movie || historyItem.movie || {};

      // 类型: object。
      // 作用: 保存内容对象里的 tv 字段，用于补齐集数状态。
      const tv = contentItem.tv || historyItem.tv || {};

      // 类型: boolean。
      // 作用: 历史数据带有 episodeLabel 或 episodeValue 时，优先按电视剧卡片处理。
      const looksLikeTv = Boolean(historyItem.episodeId || historyItem.episodeIndex || tv.updateStatus);

      // 类型: string。
      // 作用: 缺少 type 时根据历史记录是否带分集信息推断基础类型。
      const contentType = contentItem.type || historyItem.type || (looksLikeTv ? 'tv' : 'movie');

      // 类型: string|number。
      // 作用: 电视剧播放历史右侧 chip 需要当前集数，优先读结构化字段，再从 episodeLabel 推导。
      const currentEpisode = historyItem.episodeIndex || historyItem.currentEpisode || this.extractEpisodeNumber(historyItem.episodeLabel) || '';

      // 类型: object。
      // 作用: 只保存 ContentItem 展示字段，不混入 recordId、playback、completed 或 navigationTarget。
      const video = {
        // 类型: string。
        // 作用: 保存真实视频 id，交给 VideoCard 识别内容和执行收藏操作。
        id: contentItem.id || historyItem.contentId || historyItem.videoId || historyItem.id,

        // 类型: string。
        // 作用: 保存数据源 id，详情页请求和卡片数据源展示都会读取该字段。
        sourceId: contentItem.sourceId || historyItem.sourceId || '',

        // 类型: string。
        // 作用: 保存数据源名称，缺失时 VideoCard 会用 sourceId 兜底。
        sourceName: contentItem.sourceName || historyItem.sourceName || '',

        // 类型: string。
        // 作用: 标记当前内容是电影还是电视剧，影响左上角主角标逻辑。
        type: contentType,

        // 类型: string。
        // 作用: 视频标题，驱动 VideoCard 标题和无图占位首字。
        title: contentItem.title || '旧播放记录',

        // 类型: string。
        // 作用: 竖版海报地址，优先供 VideoCard 封面区使用。
        poster: contentItem.poster || historyItem.poster || '',

        // 类型: string。
        // 作用: 通用封面地址，poster 缺失时供 VideoCard 兜底。
        cover: contentItem.cover || historyItem.cover || '',

        // 类型: string|number。
        // 作用: 年份字段，VideoCard 会尽力放入“年份 / 地区 / 类型”元信息。
        year: contentItem.year || historyItem.year || '',

        // 类型: string。
        // 作用: 地区字段，VideoCard 会尽力放入基础元信息。
        area: contentItem.area || historyItem.area || '',

        // 类型: Array<string>。
        // 作用: 类型字段，VideoCard 只读取第一项作为卡片类型展示。
        genres: Array.isArray(contentItem.genres) ? contentItem.genres : Array.isArray(historyItem.genres) ? historyItem.genres : [],

        // 类型: string|number。
        // 作用: 评分字段，缺失时 VideoCard 不渲染评分。
        score: contentItem.score || contentItem.rating || historyItem.score || historyItem.rating || '',

        // 类型: string。
        // 作用: 清晰度字段，电影卡片左上角主角标优先读取该字段。
        quality: contentItem.quality || contentItem.qualityText || historyItem.quality || historyItem.qualityText || '',

        // 类型: string。
        // 作用: 通用短标签，清晰度或集数字段缺失时作为角标兜底。
        badge: contentItem.badge || contentItem.badgeText || historyItem.badge || historyItem.badgeText || '',

        // 类型: object。
        // 作用: 电影专属字段，当前阶段主要给 VideoCard 读取总时长占位。
        movie: {
          // 类型: string|number。
          // 作用: 当前历史记录对应媒体总时长，VideoCard 交给共享适配器统一显示。
          duration: historyItem.episodeDuration || movie.duration || contentItem.duration || historyItem.duration || ''
        },

        // 类型: object。
        // 作用: 电视剧专属字段，当前阶段主要给 VideoCard 读取集数状态角标。
        tv: {
          // 类型: string。
          // 作用: 电视剧更新或当前分集状态，VideoCard 左上角主角标优先读取。
          updateStatus: tv.updateStatus || historyItem.updateStatus || '',

          // 类型: string|number。
          // 作用: 电视剧总集数，updateStatus 缺失时用于推导“全 xx 集”。
          totalEpisodes: tv.totalEpisodes || historyItem.totalEpisodes || ''
        }
      };

      // 返回值类型: object。
      // 作用: 返回记录级视图模型，模板将不同职责字段分别传给 UserVideoCard。
      return {
        // 类型: string。
        // 作用: 始终优先使用 historyKey 定位删除目标，同内容不同分集不会互相覆盖。
        recordId: historyItem.historyKey || historyItem.id || historyItem.contentId,

        // 类型: object。
        // 作用: 纯内容展示对象，UserVideoCard 和 VideoCard 不会看到列表内部元数据。
        video,

        // 类型: boolean。
        // 作用: 历史列表不强制收藏，真实状态继续由 UserVideoCard selector 补齐。
        favorite: false,

        // 类型: object。
        // 作用: 只描述当前 historyKey 对应记录，preferProvidedPlayback 会阻止内容级最新记录覆盖。
        playback: {
          // 类型: boolean。
          // 作用: 播放历史天然属于已播放记录，扩展行 2 应显示“已播放”。
          played: true,

          // 类型: string|number。
          // 作用: 电视剧播放历史显示当前播放集 chip，电影会被 VideoCard 自动忽略。
          currentEpisode,

          // 类型: number。
          // 作用: 当前历史记录的已播放秒数，VideoCard 只在最终显示阶段格式化。
          playedSeconds: historyItem.playedSeconds,

          // 类型: number|null。
          // 作用: 当前历史记录独立保存的总时长，不允许被 playedSeconds 覆盖。
          durationSeconds: historyItem.durationSeconds,

          // 类型: string。
          // 作用: 当前记录最近播放时间，UserVideoCard 将它转换为卡片短时间文本。
          lastPlayedAt: historyItem.lastPlayedAt || ''
        },

        // 类型: object|null。
        // 作用: 只根据当前历史记录生成播放器目标，缺失关键内容身份时返回 null 并阻止错误导航。
        navigationTarget: sourceStatus.available
          ? createHistoryPlaybackNavigationTarget(historyItem)
          : createUserContentRecoverySearchTarget(USER_CONTENT_RECOVERY_KIND.history, historyItem),

        // 类型: boolean；作用: true 显示绿色状态点，false 显示红色并使用恢复搜索目标。
        sourceAvailable: sourceStatus.available,

        // 类型: string；作用: 提供状态点 title 和无障碍说明。
        sourceStatusText: sourceStatus.statusText,

        // 类型: boolean。
        // 作用: 播放历史筛选使用，true 进入“已看完”，false 进入“未看完”。
        completed: this.isHistoryCompleted(historyItem)
      };
    },

    /**
     * 读取收藏内容对应的最近播放历史。
     * 纯函数: 只读取当前页面的 playHistory 计算属性，不修改用户内容状态。
     * 使用场景: 收藏列表完成度筛选需要复用播放历史进度，而不是把完成度写进收藏记录。
     *
     * @param {Object} item 收藏记录或 ContentItem 兼容对象。
     * @returns {Object|null} 同一内容最近播放历史；没有播放历史时返回 null。
     */
    getLatestHistoryRecordForContent(item) {
      // 类型: string。
      // 作用: 使用 sourceId + contentId 生成内容级 key，让电影和电视剧都能按同一内容聚合历史。
      const contentKey = this.getRecordContentKey(item);

      // 条件分支: 内容 key 缺失时进入。
      // 执行内容: 返回 null，避免收藏筛选误匹配其它历史记录。
      if (!contentKey) {
        return null;
      }

      // 返回值类型: object|null。
      // 作用: playHistory 已由 selector 按 lastPlayedAt 倒序排列，因此第一条命中记录就是最近播放记录。
      return this.playHistory.find(historyRecord => this.getRecordContentKey(historyRecord) === contentKey) || null;
    },

    /**
     * 把收藏数据整理成 VideoCard 可直接消费的 ContentItem 兼容对象。
     * 收藏列表里的卡片默认以已收藏状态展示，取消收藏后由 UserVideoCard 写入用户内容状态并反馈给本页收口。
     * 纯函数: 只读取收藏记录、已补全内容和最近历史并返回新对象，不修改任一 store。
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
      // 作用: 优先从持久化快照恢复完整卡片；v24 前旧记录使用明确旧收藏占位且不请求 Provider。
      const contentItem = createContentItemFromSnapshot(favoriteItem.contentSnapshot) || {
        id: favoriteItem.contentId || '',
        sourceId: favoriteItem.sourceId || '',
        sourceName: favoriteItem.sourceId || '',
        type: 'movie',
        title: '旧收藏记录',
        poster: '',
        cover: '',
        genres: [],
        movie: { duration: '' },
        tv: { updateStatus: '', totalEpisodes: '' }
      };
      // 类型: object；作用: 使用 SourceManager 权威状态决定个人中心状态点和点击去向。
      const sourceStatus = getUserContentSourceStatus(favoriteItem);

      // 类型: object。
      // 作用: 保存内容对象里的 movie 字段，用于补齐片长。
      const movie = contentItem.movie || favoriteItem.movie || {};

      // 类型: object。
      // 作用: 保存内容对象里的 tv 字段，用于补齐集数状态。
      const tv = contentItem.tv || favoriteItem.tv || {};

      // 类型: object|null。
      // 作用: 收藏记录本身不保存播放进度，完成度筛选需要从同内容的最近播放历史中读取。
      const latestHistoryRecord = this.getLatestHistoryRecordForContent(favoriteItem);

      // 返回值类型: object。
      // 作用: 返回 VideoCard 可直接渲染的统一字段结构。
      return {
        // 类型: string。
        // 作用: 保存收藏记录 id，后续接收藏状态仓库时可用于定位记录。
        recordId: favoriteItem.favoriteKey || favoriteItem.id || favoriteItem.contentId,

        // 类型: string。
        // 作用: 保存真实视频 id，VideoCard 点击卡片时用它进入详情页。
        id: contentItem.id || favoriteItem.contentId || favoriteItem.videoId || favoriteItem.id,

        // 类型: string。
        // 作用: 保存数据源 id，详情页请求和卡片数据源展示都会读取该字段。
        sourceId: contentItem.sourceId || favoriteItem.sourceId || '',

        // 类型: string。
        // 作用: 保存数据源名称，缺失时 VideoCard 会用 sourceId 兜底。
        sourceName: contentItem.sourceName || favoriteItem.sourceName || '',

        // 类型: string。
        // 作用: 标记当前内容是电影还是电视剧，缺失时按电影处理。
        type: contentItem.type || favoriteItem.type || 'movie',

        // 类型: string。
        // 作用: 视频标题，驱动 VideoCard 标题和无图占位首字。
        title: contentItem.title || '旧收藏记录',

        // 类型: string。
        // 作用: 竖版海报地址，优先供 VideoCard 封面区使用。
        poster: contentItem.poster || favoriteItem.poster || '',

        // 类型: string。
        // 作用: 通用封面地址，poster 缺失时供 VideoCard 兜底。
        cover: contentItem.cover || favoriteItem.cover || '',

        // 类型: string|number。
        // 作用: 年份字段，VideoCard 会尽力放入“年份 / 地区 / 类型”元信息。
        year: contentItem.year || favoriteItem.year || '',

        // 类型: string。
        // 作用: 地区字段，VideoCard 会尽力放入基础元信息。
        area: contentItem.area || favoriteItem.area || '',

        // 类型: Array<string>。
        // 作用: 类型字段，VideoCard 只读取第一项作为卡片类型展示。
        genres: Array.isArray(contentItem.genres) ? contentItem.genres : Array.isArray(favoriteItem.genres) ? favoriteItem.genres : [],

        // 类型: string|number。
        // 作用: 评分字段，缺失时 VideoCard 不渲染评分。
        score: contentItem.score || contentItem.rating || favoriteItem.score || favoriteItem.rating || '',

        // 类型: string。
        // 作用: 清晰度字段，电影卡片左上角主角标优先读取该字段。
        quality: contentItem.quality || contentItem.qualityText || favoriteItem.quality || favoriteItem.qualityText || '',

        // 类型: string。
        // 作用: 通用短标签，清晰度或集数字段缺失时作为角标兜底。
        badge: contentItem.badge || contentItem.badgeText || favoriteItem.badge || favoriteItem.badgeText || '',

        // 类型: object。
        // 作用: 电影专属字段，当前阶段主要给 VideoCard 读取总时长占位。
        movie: {
          // 类型: string|number。
          // 作用: 当前收藏内容的总时长事实，VideoCard 交给共享适配器统一显示。
          duration: movie.duration || contentItem.duration || favoriteItem.duration || ''
        },

        // 类型: object。
        // 作用: 电视剧专属字段，当前阶段主要给 VideoCard 读取集数状态角标。
        tv: {
          // 类型: string。
          // 作用: 电视剧更新状态，VideoCard 左上角主角标优先读取。
          updateStatus: tv.updateStatus || favoriteItem.updateStatus || '',

          // 类型: string|number。
          // 作用: 电视剧总集数，updateStatus 缺失时用于推导“全 xx 集”。
          totalEpisodes: tv.totalEpisodes || favoriteItem.totalEpisodes || ''
        },

        // 类型: boolean。
        // 作用: 收藏列表当前阶段固定显示已收藏状态。
        favorite: true,

        // 类型: object。
        // 作用: 收藏不保存播放进度；有历史时使用最近历史作为展示兜底，没有历史时使用零秒占位。
        playback: {
          // 类型: boolean。
          // 作用: 只有命中播放历史才显示已播放，避免把收藏状态误当成播放状态。
          played: Boolean(latestHistoryRecord),

          // 类型: number。
          // 作用: 优先读取同内容最近历史的进度，缺失时传零秒给 VideoCard。
          playedSeconds: latestHistoryRecord?.playedSeconds ?? 0,

          // 类型: number|null。
          // 作用: 优先传递最近历史的独立总时长，内容事实由 video.movie.duration 继续兜底。
          durationSeconds: latestHistoryRecord?.durationSeconds ?? null
        },

        // 类型: object|null；作用: 可用源使用 VideoCard 默认详情导航，失效源进入带恢复键的搜索页。
        navigationTarget: sourceStatus.available
          ? null
          : createUserContentRecoverySearchTarget(USER_CONTENT_RECOVERY_KIND.favorite, favoriteItem),

        // 类型: boolean；作用: true 显示绿色状态点，false 显示红色。
        sourceAvailable: sourceStatus.available,

        // 类型: string；作用: 为状态点提供鼠标提示和无障碍说明。
        sourceStatusText: sourceStatus.statusText,

        // 类型: boolean。
        // 作用: 收藏列表筛选使用；优先按播放历史判断完成度，避免把完成度字段写进收藏记录。
        completed: latestHistoryRecord ? this.isHistoryCompleted(latestHistoryRecord) : Boolean(favoriteItem.completed)
      };
    },

    /**
     * 从分集文案中提取集数。
     * 用于当前阶段给播放历史生成“正在播放第几集”的占位 chip。
     * 纯函数: 只读取 episodeText 并返回第一个数字或空文本。
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
     * 用于当前阶段把“看到 12:30”转换成 VideoCard 的已播放时间。
     * 纯函数: 只读取 progressText 并返回匹配时间或空文本。
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
     * 纯函数: completed 和 in-progress 返回 filter 新数组，all 返回原列表且不修改其内容。
     *
     * @param {Array<Object>} list 待筛选的视频卡片列表。
     * @param {string} mode 当前筛选模式。
     * @returns {Array<Object>} 筛选后的列表。
     */
    applyProgressFilter(list, mode) {
      // 条件分支: mode 为 completed 时进入。
      // 执行内容: 只保留 completed=true 的条目并返回新数组。
      if (mode === 'completed') {
        return list.filter(item => item.completed);
      }

      // 条件分支: mode 为 in-progress 时进入。
      // 执行内容: 只保留 completed=false 的条目并返回新数组。
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
     * 副作用: 更新 activeHistoryPage，驱动历史列表重新分页。
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
     * 副作用: 更新 activeFavoritePage，驱动收藏列表重新分页。
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
     * 收藏切换已经由 UserVideoCard 内部完成 Repository 提交和 store 采用。
     * 本方法只负责在收藏页取消收藏后把页码收回有效范围。
     * 副作用: 只调整 activeFavoritePage，不重复写收藏状态。
     *
     * @param {Object} item 触发收藏切换的视频卡片对象。
     * @returns {void} 收藏状态由子组件服务写入，本页只同步分页。
     */
    handleToggleFavorite(item) {
      // 参数类型: object。
      // 作用: item 是 UserVideoCard 传出的当前视频对象，这里保留变量便于后续按来源做提示。
      const targetItem = item || {};

      // 当前收藏事务已经由 UserVideoCard 完成，本页不重复提交，避免二次反转。
      void targetItem;

      // 副作用: 取消收藏可能导致当前页越界，按最新分页对象回写有效页码。
      this.activeFavoritePage = this.favoritePagination.page;
    },

    /**
     * 清空当前页面播放历史。
     * 副作用: 等待 userContentService 提交空历史集合，成功后把历史页码重置为第一页。
     * 成功路径: IndexedDB 与 store 均为空后更新页码。
     * 失败路径: 展示安全提示并保留旧列表和页码。
     *
     * @returns {Promise<void>} 清空事务完成或失败提示展示后结束。
     */
    async clearHistory() {
      try {
        // 异步调用: Repository 提交成功后 service 才采用空历史投影。
        await clearPlayHistory();
        // 副作用: 清空成功后重置页码，避免停留在不存在的第二页。
        this.activeHistoryPage = 1;
      } catch {
        // 失败处理: 列表和页码保持旧稳定状态，只显示安全文案。
        this.$message.error('播放历史清空失败，请稍后重试');
      }
    },

    /**
     * 清空当前页面收藏列表。
     * 副作用: 等待 userContentService 提交空收藏集合，成功后把收藏页码重置为第一页。
     * 成功路径: IndexedDB 与 store 均为空后更新页码。
     * 失败路径: 展示安全提示并保留旧列表和页码。
     *
     * @returns {Promise<void>} 清空事务完成或失败提示展示后结束。
     */
    async clearFavorites() {
      try {
        // 异步调用: Repository 提交成功后 service 才采用空收藏投影。
        await clearFavoriteRecords();
        // 副作用: 清空成功后重置页码，避免停留在不存在的第二页。
        this.activeFavoritePage = 1;
      } catch {
        // 失败处理: 列表和页码保持旧稳定状态，只显示安全文案。
        this.$message.error('收藏清空失败，请稍后重试');
      }
    },

    /**
     * 删除单条播放历史。
     * 触发来源: UserVideoCard 的 @delete 事件。
     * 副作用: 按 recordId/historyKey 提交删除后的完整历史集合，成功后收口当前页码。
     * 成功路径: Repository 与 store 均删除目标后更新页码。
     * 失败路径: 展示安全提示并保留旧记录和页码。
     *
     * @param {Object} item 播放历史卡片对象。
     * @returns {Promise<void>} 删除事务完成或失败提示展示后结束。
     */
    async removeHistoryItem(item) {
      // 类型: string。
      // 作用: recordId 来自 normalizeHistoryItem，优先等于历史记录 historyKey。
      const recordId = item && item.recordId ? item.recordId : '';

      // 条件分支: recordId 为空时进入。
      // 执行内容: 直接返回，避免误删其它历史记录。
      if (!recordId) {
        return;
      }

      try {
        // 类型: boolean；作用: 等待数据库提交并判断目标是否真实删除。
        const removed = await removePlayHistory(recordId);
        // 条件分支: 目标未命中时进入。
        // 执行内容: 保留页码，不伪造成功反馈。
        if (!removed) return;
        // 副作用: 删除成功后按最新分页对象回写有效页码。
        this.activeHistoryPage = this.historyPagination.page;
      } catch {
        // 失败处理: 历史投影保持旧值，只展示安全文案。
        this.$message.error('播放历史删除失败，请稍后重试');
      }
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
    使用全局响应式内容卡片列数。
    theme.css 按 6 / 4 / 3 / 2 列统一切换，个人中心不再维护另一套列数断点。
  */
  grid-template-columns: repeat(var(--content-card-grid-columns), minmax(0, 1fr));

  /* 控制卡片之间的横向和纵向间距，跟页面统一栅格一致。 */
  gap: var(--page-grid-gap);

  /* 顶部留一点空间，让卡片和工具栏之间不贴。 */
  padding-top: 6px;
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
