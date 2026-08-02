<template>
  <!--
    PlayerView 页面渲染树

    [DEFAULT] ele(div.player-view)
    │  - condition: 默认渲染。
    │  - type: 原生标签，标签名称: div
    │  - description: 播放页根容器，承载加载遮罩、双列播放内容或整页空状态。
    │  - params: -- loading：true 显示加载遮罩，false 展示页面内容。
    │  - events: 无
    │
    ├─ [IF hasVideo] ele(div.player-shell)
    │  │  - condition: 当前 player 数据桶存在可展示 ContentItem 时渲染。
    │  │  - type: 原生标签，标签名称: div
    │  │  - description: 桌面建立左右独立纵向布局，平板和手机切换为播放器优先单列布局。
    │  │  - params: 无
    │  │  - events: 无
    │  ├─ [DEFAULT] ele(div.player-main-column)
    │  │  │  - condition: 有播放内容时默认渲染。
    │  │  │  - type: 原生标签，标签名称: div
    │  │  │  - description: 桌面独立排列内容信息和播放器；移动端把播放器调整到信息之前。
    │  │  │  - params: 无
    │  │  │  - events: 无
    │  │  ├─ [DEFAULT] ele(section.player-meta-panel)
    │  │  │     - condition: 有播放内容时默认渲染。
    │  │  │     - type: 原生标签，标签名称: section
    │  │  │     - description: 展示紧邻的标题与类型、上下文 Chip、最终切换结果和右下角收藏状态。
    │  │  │     - params: -- video.title；-- contentTypeText；-- sourceName；-- playingLineName；-- catalogOutcome。
    │  │  │     - events: @click -> handleToggleFavorite()
    │  │  └─ [DEFAULT] ele(section.player-surface)
    │  │        - condition: 有播放内容时默认渲染。
    │  │        - type: 原生标签，标签名称: section
    │  │        - description: 播放器舞台，承载动态加载的 XgplayerMediaPlayer 或无线路空状态。
    │  │        - params: -- adoptedMedia；-- mediaSessionContext；-- mediaResumeState；-- mediaStartTime；-- mediaPoster；-- shortcutPreferences。
    │  │        - events: @session-event -> handleMediaSessionEvent()；@session-finalize -> handleMediaSessionFinalization()；@shortcut-command -> handlePlaybackShortcutCommand()。
    │  └─ [DEFAULT] ele(aside.player-side-column)
    │     │  - condition: 有播放内容时默认渲染。
    │     │  - type: 原生标签，标签名称: aside
    │     │  - description: 桌面独立排列线路列表和分集列表，移动端接在主播放列之后。
    │     │  - params: 无
    │     │  - events: 无
    │     └─ [DEFAULT] com(PlayCatalogSelector)
    │     │     - condition: 有播放内容时默认渲染。
    │     │     - type: 原生标签，标签名称: section
    │           - description: 使用共享 PlayCatalogSelector 展示浏览线路和该线路真实选集。
    │           - params: -- playCatalog；-- browsedLineId；-- playingLineId；-- handoffPending。
    │           - events: @line-change -> handleBrowsedLineChange；@episode-select -> handleEpisodeSelection
    └─ [ELSE] ele(div.player-page-empty)
       - condition: 当前没有可展示 ContentItem 时渲染。
       - type: 原生 div，内部使用 Element UI el-empty 和恢复按钮。
       - description: 展示播放地址解析、请求错误、播放一级入口或无播放信息，并提供可执行恢复动作。
       - params: -- emptyStateDescription；-- showPlayerRecoveryActions；-- showPlayerRetryAction。
       - events: @click -> retryPlayerContent()/navigateToSearch()/navigateToHome()。
  -->
  <!--
    [DEFAULT] ele(div.player-view)
    - condition: 默认渲染。
    - type: 原生标签，标签名称: div
    - description: 在 App.vue 固定播放外壳中管理桌面一屏和移动端内部滚动。
    - params: -- loading：播放页请求状态。
    - events: 无
  -->
  <div
    class="player-view"
    v-loading="loading && !hasVideo"
    element-loading-text="正在解析播放地址">
    <!--
      [IF hasVideo] ele(div.player-shell)
      - condition: 当前 player 数据桶存在可展示 ContentItem 时渲染。
      - type: 原生标签，标签名称: div
      - description: 使用左右独立列完成桌面参考布局，并在平板和手机重排为播放器优先单列。
      - params: 无
      - events: 无
    -->
    <div v-if="hasVideo" class="player-shell">
      <!--
        [DEFAULT] ele(div.player-main-column)
        - condition: 有播放内容时默认渲染。
        - type: 原生标签，标签名称: div
        - description: 桌面独立管理内容信息和播放器高度；平板和手机在本列内把播放器调整到最前面。
        - params: 无
        - events: 无
      -->
      <div class="player-main-column">
        <!--
          [DEFAULT] ele(section.player-meta-panel)
          - condition: 有播放内容时默认渲染。
          - type: 原生标签，标签名称: section
          - description: 展示紧邻的标题与类型、数据来源 Chip、当前线路 Chip 和右下角收藏状态。
          - params: -- video.title；-- contentTypeText；-- sourceName；-- playingLineName；-- isFavorite。
          - events: 无
        -->
        <section class="player-meta-panel" aria-labelledby="player-content-title">
          <!--
            [DEFAULT] ele(div.player-meta-identity)
            - condition: 内容信息面板渲染时默认显示。
            - type: 原生标签，标签名称: div
            - description: 组合视频标题和内容类型，形成当前播放内容的主身份信息。
            - params: -- video.title；-- contentTypeText。
            - events: 无
          -->
          <div class="player-meta-identity">
            <h1 id="player-content-title" class="player-title">{{ video.title }}</h1>
            <span class="player-type-badge">{{ contentTypeText }}</span>
          </div>

          <!--
            [DEFAULT] ele(div.player-meta-context)
            - condition: 内容信息面板渲染时默认显示。
            - type: 原生标签，标签名称: div
            - description: 以两个 Chip 展示数据来源和当前实际激活线路，并在同行右端展示最后一次切换终态。
            - params: -- sourceName；-- playingLineName；-- catalogOutcome。
            - events: 无
          -->
          <div class="player-meta-context">
            <span class="player-context-chip">数据源：{{ sourceName }}</span>
            <span class="player-context-chip">当前线路：{{ playingLineName }}</span>
            <!-- 最终结果属于实际播放器上下文；候选解析期间保持空白，不在选集组件中生成提示框。 -->
            <p
              v-if="catalogOutcome.message"
              class="player-catalog-outcome"
              :class="'is-' + catalogOutcome.kind"
              role="status"
              aria-live="polite"
            >
              {{ catalogOutcome.message }}
            </p>
          </div>

          <!--
            [DEFAULT] ele(el-button.player-favorite-button)
            - condition: 内容信息面板渲染时默认显示。
            - type: 第三方组件，组件库: Element UI，组件名称: el-button
            - description: 切换当前内容收藏状态，固定在信息面板内容之后的右下角。
            - params: -- type：收藏状态按钮类型；-- icon：收藏状态图标。
            - events: @click -> handleToggleFavorite()
          -->
          <el-button
            class="player-favorite-button"
            size="small"
            :type="isFavorite ? 'primary' : 'default'"
            :icon="favoriteButtonIcon"
            round
            @click="handleToggleFavorite">
            {{ favoriteButtonText }}
          </el-button>
        </section>

        <!--
          [DEFAULT] ele(section.player-surface)
          - condition: 有播放内容时默认渲染。
          - type: 原生标签，标签名称: section
          - description: 播放器舞台；平板和手机中通过列内重排成为播放页内容区第一个模块。
          - params: -- adoptedMedia；-- mediaSessionContext；-- mediaResumeState；-- mediaStartTime；-- mediaPoster；-- shortcutPreferences。
          - events: @session-event -> handleMediaSessionEvent()；@session-finalize -> handleMediaSessionFinalization()；@shortcut-command -> handlePlaybackShortcutCommand()。
        -->
        <section class="player-surface" aria-label="播放器">
          <!--
            [IF adoptedMedia && mediaResumeState.isResolved] com(XgplayerMediaPlayer)
            - condition: 当前内容存在已经通过候选校验并正式采用的直连媒体，且恢复选择已经完成时渲染。
            - type: 自定义组件，组件名称: XgplayerMediaPlayer。
            - description: 动态加载 xgplayer/HLS，拥有播放器实例并发布稳定媒体会话。
            - params: -- source；-- sessionContext；-- mediaResumeState.autoplay；-- mediaStartTime；-- poster；-- shortcutPreferences。
            - events: @session-event；@session-finalize；@shortcut-command。
          -->
          <XgplayerMediaPlayer
            v-if="adoptedMedia && mediaResumeState.isResolved"
            :key="mediaSessionKey"
            :source="adoptedMedia"
            :session-context="mediaSessionContext"
            :autoplay="mediaResumeState.autoplay"
            :start-time="mediaStartTime"
            :poster="mediaPoster"
            :shortcut-preferences="shortcutPreferences"
            @session-event="handleMediaSessionEvent"
            @session-finalize="handleMediaSessionFinalization"
            @shortcut-command="handlePlaybackShortcutCommand" />
          <!--
            [ELSE-IF adoptedMedia] ele(el-empty.player-media-empty)
            - condition: 存在已采用媒体但近尾恢复选择尚未完成时渲染。
            - type: 第三方组件，Element UI el-empty。
            - description: 保持播放器舞台稳定并提示恢复决策正在完成。
            - params: description 为准备提示；image-size 控制空状态图示尺寸。
            - events: 无，选择由 Element MessageBox 承载。
          -->
          <el-empty
            v-else-if="adoptedMedia"
            class="player-media-empty"
            description="正在准备播放恢复"
            :image-size="68" />
          <!--
            [ELSE] ele(el-empty.player-media-empty)
            - condition: 当前内容没有任何播放线路时渲染。
            - type: 第三方组件，Element UI el-empty。
            - description: 保持稳定舞台尺寸并明确没有可播放线路。
            - params: description 为无线路说明；image-size 控制空状态图示尺寸。
            - events: 无。
          -->
          <el-empty v-else class="player-media-empty" description="当前内容没有可用播放线路" :image-size="68" />
        </section>
      </div>

      <!-- 播放侧栏复用详情页同一目录组件，只协调浏览线路和候选媒体意图。 -->
      <aside class="player-side-column" aria-label="播放操作">
        <PlayCatalogSelector
          class="player-catalog-panel"
          :play-catalog="playCatalog"
          :browsed-line-id="browsedLineId"
          :selected-episode-id="browsedSelectedEpisodeId"
          :pending="handoffPending"
          @line-change="handleBrowsedLineChange"
          @episode-select="handleEpisodeSelection"
        />
      </aside>
    </div>

    <!--
      [ELSE] ele(div.player-page-empty)
      - condition: 当前没有可展示 ContentItem 时渲染。
      - type: 原生 div，内部使用 Element UI el-empty 和恢复按钮。
      - description: 播放页整页状态；一级入口不请求 Provider，严格请求失败可以原位重试。
      - params: -- emptyStateDescription；-- showPlayerRecoveryActions；-- showPlayerRetryAction。
      - events: @click -> retryPlayerContent()/navigateToSearch()/navigateToHome()。
    -->
    <div v-else class="player-page-empty">
      <el-empty :description="emptyStateDescription" />
      <!-- 播放入口和失败播放请求都提供页面内恢复动作，避免公开播放路由成为死端。 -->
      <div v-if="showPlayerRecoveryActions" class="player-empty-actions">
        <el-button
          v-if="showPlayerRetryAction"
          type="primary"
          icon="el-icon-refresh"
          @click="retryPlayerContent">
          重新加载
        </el-button>
        <el-button icon="el-icon-search" @click="navigateToSearch">去搜索</el-button>
        <el-button icon="el-icon-s-home" @click="navigateToHome">返回首页</el-button>
      </div>
    </div>
  </div>
</template>

<script>
/*
  PlayerView.vue 模块说明

  - 文件职责:
      作为 App 生命周期内唯一常驻播放宿主，渲染统一播放器页面，并让内容请求、路由上下文、真实媒体会话、收藏和历史保持同一身份。
      普通路由切换只隐藏本组件根元素，不暂停、销毁、重新请求或重新计算当前媒体会话。
      线路和剧集选择先形成候选媒体，成功前保持旧播放器；浏览线路只属于页面会话，实际播放事实由已采用媒体和 Router 表达。

  - 导入库及文件汇总(17 条，内置 0 条，第三方 0 条，自定义 17 条):
      requestSourceData: 自定义服务，请求播放页 player 数据桶并写入全站内容 store。
      getCurrentContentItem: 自定义 selector，从唯一内容实体 Store 读取当前标准对象。
      getContentUserStatus、getHistoryRecord: 自定义 selector，提供收藏状态和当前分集历史记录。
      toggleFavorite、getPlaybackResumeDecision、updateCurrentPlaying、upsertPlayHistory: 自定义服务，写入收藏、计算恢复策略并提供唯一用户播放状态写端口。
      createPlayerRouteContext、createPlayerNavigationTarget: 自定义服务，冻结活动播放路由请求身份并构造可刷新路由目标。
      createMediaPlaybackProgressService: 自定义服务，把稳定媒体事件协调为检查点和最终用户内容提交。
      MEDIA_PLAYBACK_PHASE、MEDIA_RESUME_SELECTION、PLAYBACK_SHORTCUT_ACTION: 自定义配置，提供稳定会话阶段、近尾选择和页面快捷键命令。
      shortcutSettingsStore: 自定义设置 Store，提供 Repository 已提交的快捷键偏好。
      XgplayerMediaPlayer: 自定义组件，动态创建真实 MP4/HLS 播放器并发布稳定事件。
      PlayCatalogSelector: 自定义组件，复用详情页同一播放目录 DOM。
      playCatalogSelectionService exports: 自定义纯服务，精确读取目录并决定浏览、缺集或候选解析。
      normalizeMediaPlaybackMedia: 自定义校验器，候选直连媒体通过后才允许采用。
      createRouteRequestGuard: 自定义路由请求守卫，阻止失活播放页响应其他页面路由变化。
      applyDocumentTitle: 自定义标题服务，只允许当前播放路由采用静态或严格内容标题。
      userContentRecoveryService exports: 自定义恢复门面，把稳定用户记录键解析为当前目录目标，并在媒体验证后提交重绑定。

  - 模块级常量:
      EPISODE_NAVIGATION_DIRECTION: object，上一集和下一集相对方向。
      PLAYER_PAGE_KEY: string，播放页统一 Provider 请求键。
      PLAY_CATALOG_OUTCOME_KIND: Readonly<object>，播放切换成功与失败终态枚举。
      PLAY_CATALOG_OUTCOME_MESSAGE: Readonly<object>，播放切换失败安全文案。

  - 模块级辅助函数:
      createIdleMediaPlaybackSession(): 创建未绑定内容的初始媒体会话。
      createPendingMediaResumeState(): 创建等待恢复决策的页面会话状态。
      createResolvedMediaResumeState(startSeconds, autoplay): 创建已完成恢复决策的页面会话状态。
      createPlayerRequestParams(context): 从必填内容身份和实际 query 构造无 undefined 的 Provider 请求参数。
      resolveEpisodeIndex(episode): 读取标准逻辑剧集序号。
      normalizePlaybackCandidate(response, target): 严格采用内容、目录、线路、剧集和直连媒体。
      createPlayCatalogOutcome(kind, message): 创建受限且不可变的播放切换终态。
      resolvePlayCatalogFailureOutcome(decision): 把通用选择失败转换为失败终态。
      createPlayCatalogSuccessOutcome(line, episode): 在媒体采用完成后创建成功终态。

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      PlayerView: Vue page component，供 player 路由展示和恢复播放上下文。
*/

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 播放页进入时请求 player 数据桶，候选通过严格校验后才进入已采用内容状态。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../store/siteContentStore.js。
// 导入内容: getCurrentContentItem 单内容桶 selector。
// 文件作用: 播放页继续从唯一实体 Store 读取标准 ContentItem，不建立页面内容副本。
import { getCurrentContentItem } from '../store/siteContentStore.js';

import {
  // 导入来源: ../selectors/userContentSelectors。
  // 导入内容: getContentUserStatus 用户内容状态 selector。
  // 文件作用: 播放页读取当前内容是否收藏、是否正在播放和最近播放历史。
  getContentUserStatus,

  // 导入来源: ../selectors/userContentSelectors。
  // 导入内容: getHistoryRecord 当前电影或电视剧单集历史 selector。
  // 文件作用: 播放页按当前分集读取恢复播放策略需要的历史记录。
  getHistoryRecord
} from '../selectors/userContentSelectors.js';

import {
  // 导入来源: ../services/userContentService。
  // 导入内容: toggleFavorite 收藏切换服务。
  // 文件作用: 播放页收藏按钮等待 Repository 提交后读取统一用户内容投影。
  toggleFavorite,

  // 导入来源: ../services/userContentService。
  // 导入内容: getPlaybackResumeDecision 恢复播放策略函数。
  // 文件作用: 播放页根据历史记录判断从头播放、恢复播放或提示重播。
  getPlaybackResumeDecision,

  // 导入来源: ../services/userContentService。
  // 导入内容: updateCurrentPlaying 当前会话写端口。
  // 文件作用: 由媒体进度协调器更新或清空不持久化的 currentPlaying。
  updateCurrentPlaying,

  // 导入来源: ../services/userContentService。
  // 导入内容: upsertPlayHistory 长期历史写端口。
  // 文件作用: 由媒体进度协调器在检查点和最终事件提交 IndexedDB 历史。
  upsertPlayHistory,

  // 导入来源: ../services/userContentService。
  // 导入内容: rebindUserContent 内容身份重绑定命令。
  // 文件作用: Provider 返回规范内容 id 后，把旧路由身份对应的历史和收藏原子迁移到规范身份。
  rebindUserContent
} from '../services/userContentService.js';

// 导入来源: ../config/user-content.config.js。
// 导入内容: USER_CONTENT_RECOVERY_KIND.history 历史身份重绑定类型。
// 文件作用: 复用用户内容领域已冻结的双仓迁移类型，不在播放页手写业务字符串。
import { USER_CONTENT_RECOVERY_KIND } from '../config/user-content.config.js';

// 导入来源: ../services/playerNavigationService.js。
// 导入内容: createPlayerRouteContext 活动播放路由上下文工厂、createPlayerNavigationTarget 播放页路由目标构造函数。
// 文件作用: 常驻宿主只采用请求守卫确认的播放 URL；分集和线路点击仍由统一服务更新正式 query。
import {
  createPlayerRouteContext,
  createPlayerNavigationTarget
} from '../services/playerNavigationService.js';

// 导入来源: ../services/mediaPlaybackProgressService.js。
// 导入内容: createMediaPlaybackProgressService 页面级进度协调器工厂。
// 文件作用: 统一消费稳定媒体事件并调用 userContentService 窄写端口，不在页面散落检查点状态。
import { createMediaPlaybackProgressService } from '../services/mediaPlaybackProgressService.js';

import {
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_PLAYBACK_PHASE；文件作用: 判断真实播放阶段和初始化会话。
  MEDIA_PLAYBACK_PHASE,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_RESUME_SELECTION；文件作用: 解释近尾恢复弹窗的两个用户决定。
  MEDIA_RESUME_SELECTION,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_ACTION；文件作用: 处理上一集/下一集页面命令。
  PLAYBACK_SHORTCUT_ACTION
} from '../config/mediaPlayback.config.js';

// 导入来源: ../store/shortcutSettingsStore.js。
// 导入内容: shortcutSettingsStore 快捷键设置响应式投影。
// 文件作用: 把启动链恢复且 Repository 已提交的偏好传给播放器适配层，不创建页面默认值。
import { shortcutSettingsStore } from '../store/shortcutSettingsStore.js';

// 导入来源: ../components/player/XgplayerMediaPlayer.vue。
// 导入内容: XgplayerMediaPlayer 真实播放器适配组件。
// 文件作用: 播放页只传已采用直连媒体和会话身份并消费稳定事件，不接触 xgplayer 私有实例。
import XgplayerMediaPlayer from '../components/player/XgplayerMediaPlayer.vue';

// 导入来源: ../components/playback/PlayCatalogSelector.vue。
// 导入内容: PlayCatalogSelector 共享播放目录组件。
// 文件作用: 播放侧栏与详情页复用同一线路下拉、浏览线路状态和选集按钮树。
import PlayCatalogSelector from '../components/playback/PlayCatalogSelector.vue';

import {
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: PLAY_CATALOG_SELECTION_KIND；文件作用: 把选择失败转换为稳定提示。
  PLAY_CATALOG_SELECTION_KIND,
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: findPlayCatalogLine；文件作用: 按稳定 id 读取浏览或播放线路。
  findPlayCatalogLine,
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: findPlayCatalogEpisode；文件作用: 按逻辑 id 精确读取线路剧集。
  findPlayCatalogEpisode,
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: decideBrowsedLineChange；文件作用: 判断切换浏览线路后能否自动解析同集媒体。
  decideBrowsedLineChange,
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: decideManualEpisodeSelection；文件作用: 校验用户明确选择的线路和逻辑剧集。
  decideManualEpisodeSelection
} from '../services/playCatalogSelectionService.js';

// 导入来源: ../utils/mediaPlaybackValidators.js。
// 导入内容: normalizeMediaPlaybackMedia 直连媒体严格校验器。
// 文件作用: Provider 候选响应只有通过 playback.media 契约后才允许进入正式交接。
import { normalizeMediaPlaybackMedia } from '../utils/mediaPlaybackValidators.js';

// 导入来源: ../utils/sourceDisplayName.js。
// 导入内容: formatSourceDisplayName 数据源显示名称适配函数。
// 文件作用: 让播放上下文来源 Chip 遵守全站十个 Unicode 字符显示边界。
import { formatSourceDisplayName } from '../utils/sourceDisplayName.js';

// 导入来源: ../router/routeRequestState.js。
// 导入内容: createRouteRequestGuard KeepAlive 请求身份守卫。
// 文件作用: 播放页只处理 player-entry/player 的新 fullPath，普通离开和返回不重置播放器。
import { createRouteRequestGuard } from '../router/routeRequestState.js';

// 导入来源: ../services/documentTitleService.js。
// 导入内容: applyDocumentTitle 统一浏览器标题采用函数。
// 文件作用: 常驻播放宿主只在当前可见播放路由补充严格内容标题，普通页面标题继续由 Router 独占。
import { applyDocumentTitle } from '../services/documentTitleService.js';

import {
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: USER_CONTENT_RECOVERY_QUERY；文件作用: 识别稳定用户记录恢复入口而不散落 query 字符串。
  USER_CONTENT_RECOVERY_QUERY,
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: getUserContentRecoveryContext；文件作用: 按稳定记录键回读当前收藏或历史及关联历史。
  getUserContentRecoveryContext,
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: resolveUserContentRecoveryPlaybackTarget；文件作用: 用当前详情目录精确映射旧逻辑剧集和线路。
  resolveUserContentRecoveryPlaybackTarget,
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: commitUserContentRecovery；文件作用: 媒体候选验证成功后原子迁移历史和关联收藏。
  commitUserContentRecovery
} from '../services/userContentRecoveryService.js';

// 类型: object。
// 作用: 集中定义快捷键上一集/下一集相对偏移，避免页面方法散落方向魔法数字。
const EPISODE_NAVIGATION_DIRECTION = Object.freeze({
  previous: -1,
  next: 1
});

// 类型: string。
// 作用: 播放页所有 Provider 请求使用同一标准 pageKey，避免候选和首次加载出现两套请求目标。
const PLAYER_PAGE_KEY = 'player';

// 类型: Readonly<object>。
// 作用: 限制播放目录切换结果只使用成功或失败终态，候选解析过程不建立可见状态。
const PLAY_CATALOG_OUTCOME_KIND = Object.freeze({
  // 类型: string；作用: 表示目标媒体已经完成采用并成为当前实际播放事实。
  success: 'success',
  // 类型: string；作用: 表示本次切换已经失败且旧播放事实保持不变。
  error: 'error'
});

// 类型: Readonly<object>。
// 作用: 集中保存切换失败终态的安全文案，页面不展示 Provider 原始异常或媒体地址。
const PLAY_CATALOG_OUTCOME_MESSAGE = Object.freeze({
  // 类型: string；作用: 目标线路缺少当前逻辑剧集时要求用户明确选择其它条目。
  missingEpisode: '新线路没有当前剧集，请手动选择可播放剧集。',
  // 类型: string；作用: 目标线路显式不可用时说明不会发起候选媒体请求。
  unavailableLine: '当前线路不可用，请选择其他线路。',
  // 类型: string；作用: 目标剧集显式不可播放时保持旧媒体并要求重新选择。
  unplayableEpisode: '当前选集不可播放，请选择其他选集。',
  // 类型: string；作用: Provider 请求、媒体校验、进度提交或路由采用失败时使用统一安全说明。
  handoffFailed: '切换失败，已保持当前播放。'
});

/**
 * 创建未绑定内容的初始媒体会话。
 * 纯函数: 每次返回新对象，不读取 store、Router 或播放器。
 *
 * @returns {object} 满足 MediaPlaybackSessionState 字段契约的 idle 状态。
 */
function createIdleMediaPlaybackSession() {
  return {
    phase: MEDIA_PLAYBACK_PHASE.idle,
    sourceId: '',
    contentId: '',
    episodeId: '',
    episodeIndex: null,
    playbackSourceId: '',
    playedSeconds: 0,
    durationSeconds: null,
    bufferedSeconds: null,
    errorCode: '',
    errorMessage: ''
  };
}

/**
 * 从真实播放路由上下文构造 Provider 请求参数。
 * 纯函数: 每次返回新普通对象，不读取 Vue、Router、store 或 Provider，也不修改输入。
 * 成功路径: 始终保留 contentId/autoplay，并只在 query 值有效时加入 episodeId、episodeIndex 和 playbackSourceId。
 * 失败路径: contentId 缺失由调用方在调用本函数前失败关闭；无效可选字段直接省略，不使用 undefined 占位。
 *
 * @param {object} context 当前路由标准化后的播放上下文。
 * @param {string} context.contentId 路由必填真实内容 id。
 * @param {boolean} context.autoplay 自动播放意图；true 请求自动开始，false 等待用户操作。
 * @param {string} context.episodeId 可选分集 id，空字符串表示未指定。
 * @param {number|null} context.episodeIndex 可选正整数分集序号，null 表示未指定。
 * @param {string} context.playbackSourceId 可选线路 id，空字符串表示由 Provider 返回默认线路。
 * @returns {object} 严格 JSON 且不含 undefined 的 SourceDataRequest.params。
 */
function createPlayerRequestParams(context) {
  // 类型: object；作用: 建立 Provider 必须接收的内容身份与明确自动播放意图。
  const requestParams = {
    contentId: context.contentId,
    autoplay: context.autoplay
  };

  // 条件分支: 路由 query 提供非空分集 id 时进入。
  // 执行内容: 把分集身份加入请求；空值保持字段缺席，不传 undefined。
  if (context.episodeId) requestParams.episodeId = context.episodeId;
  // 条件分支: 路由 query 提供正整数分集序号时进入。
  // 执行内容: 把序号加入请求，非法值保持字段缺席并由内容身份继续定位。
  if (Number.isInteger(context.episodeIndex) && context.episodeIndex > 0) {
    requestParams.episodeIndex = context.episodeIndex;
  }
  // 条件分支: 路由 query 提供非空播放线路 id 时进入。
  // 执行内容: 把线路偏好加入请求；未指定时让 Provider 返回并选择默认线路。
  if (context.playbackSourceId) requestParams.playbackSourceId = context.playbackSourceId;

  return requestParams;
}

/**
 * 读取逻辑剧集的结构化序号。
 * 纯函数: 只接受契约中的 episodeNumber，不使用数组位置、旧 index 别名或标题猜测。
 * 失败路径: 电影正片和缺少正整数序号的条目返回 null。
 *
 * @param {object|null} episode PlayCatalogEpisode。
 * @returns {number|null} 正整数剧集序号或 null。
 */
function resolveEpisodeIndex(episode) {
  // 类型: number；作用: 只把标准 episodeNumber 转换为数字候选。
  const episodeIndex = Number(episode?.episodeNumber);
  // 返回值类型: number|null；作用: 非正整数保持未知语义，不用显示位置补齐历史身份。
  return Number.isInteger(episodeIndex) && episodeIndex > 0 ? episodeIndex : null;
}

/**
 * 严格采用 Provider 返回的播放候选。
 * 纯函数: 只读取标准响应并返回隔离结果，不写 Store、Router、历史或播放器状态。
 * 成功路径: 内容、线路和逻辑剧集身份与请求完全一致，且 playback.media 通过直连媒体校验。
 * 失败路径: 任一身份缺失、错位、缺集、不可播放或媒体无效时抛出安全错误，禁止采用近似结果。
 *
 * @param {object} response SourceDataResponse 候选。
 * @param {object} target 本次播放请求的精确目标。
 * @param {string} target.sourceId 数据源 id。
 * @param {string} target.contentId 内容 id。
 * @param {string} target.lineId 线路 id。
 * @param {string} target.episodeId 逻辑剧集 id。
 * @returns {Readonly<object>} 已验证内容、目录、线路、剧集和直连媒体。
 * @throws {Error} 候选不满足身份或媒体契约时抛出。
 */
function normalizePlaybackCandidate(response, target) {
  // 类型: object|null；作用: 只接受标准响应 item，空值进入统一候选失败路径。
  const contentItem = response?.item && typeof response.item === 'object' && !Array.isArray(response.item)
    ? response.item
    : null;
  // 条件分支: 响应内容身份与请求不完全一致时进入；执行内容: 拒绝跨源或相邻内容冒充目标。
  if (!contentItem || contentItem.sourceId !== target.sourceId || contentItem.id !== target.contentId) {
    throw new Error('播放候选内容身份不匹配');
  }

  // 类型: object|null；作用: 读取 Provider 为本次请求最终解析出的线路、逻辑剧集和媒体。
  const playback = contentItem.playback && typeof contentItem.playback === 'object'
    && !Array.isArray(contentItem.playback)
    ? contentItem.playback
    : null;
  // 条件分支: 已解析播放身份与请求目标不完全一致时进入；执行内容: 禁止 Provider 默认线路覆盖用户选择。
  if (!playback || playback.lineId !== target.lineId || playback.episodeId !== target.episodeId) {
    throw new Error('播放候选线路或剧集身份不匹配');
  }

  // 类型: object|null；作用: 从同一响应目录精确定位目标线路，禁止使用旧页面目录或数组位置补偿。
  const line = findPlayCatalogLine(contentItem.playCatalog, target.lineId);
  // 类型: object|null；作用: 从目标线路精确定位同一逻辑剧集。
  const episode = findPlayCatalogEpisode(line, target.episodeId);
  // 条件分支: 目录缺少目标、线路不可用或剧集不可播放时进入；执行内容: 拒绝直连媒体脱离目录单独采用。
  if (!line || !episode || line.available === false || episode.playable === false) {
    throw new Error('播放候选不属于可用目录条目');
  }

  // 类型: Readonly<object>；作用: 严格采用唯一 playback.media，额外线路字段不会进入播放器适配层。
  const media = normalizeMediaPlaybackMedia(playback.media);
  // 返回值类型: Readonly<object>；作用: 把一次候选交接所需事实冻结在同一结果中。
  return Object.freeze({ contentItem, line, episode, media });
}

/**
 * 创建播放目录切换终态。
 * 纯函数: 只接受受限 kind 和非空安全文案；解析期间或无结果时返回空终态。
 * 失败路径: kind 非 success/error 或文案为空时返回空对象，避免模板生成过程提示。
 *
 * @param {string} kind PLAY_CATALOG_OUTCOME_KIND 中的终态类型。
 * @param {string} message 面向用户的安全结果文案。
 * @returns {Readonly<object>} 只包含 kind/message 的不可变页面运行态。
 */
function createPlayCatalogOutcome(kind = '', message = '') {
  // 类型: string；作用: 只接受冻结枚举中的终态，任意其它值都不能形成可见 CSS 状态。
  const normalizedKind = Object.values(PLAY_CATALOG_OUTCOME_KIND).includes(kind) ? kind : '';
  // 类型: string；作用: 清理用户可见结果，非字符串和空文案不能生成占位区域。
  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  // 条件分支: 任一终态字段无效时进入；执行内容: 返回无结果状态供新切换过程使用。
  if (!normalizedKind || !normalizedMessage) return Object.freeze({ kind: '', message: '' });

  // 返回值类型: Readonly<object>；作用: 让模板只读取一次完整终态，避免 kind 和 message 分步更新。
  return Object.freeze({ kind: normalizedKind, message: normalizedMessage });
}

/**
 * 把目录选择失败转换为播放器终态。
 * 纯函数: 只读取通用选择结果，不解释 Provider 错误或站点业务。
 *
 * @param {object} decision playCatalogSelectionService 返回的冻结结果。
 * @returns {Readonly<object>} 缺集、不可用或不可播放失败终态；其他结果返回空终态。
 */
function resolvePlayCatalogFailureOutcome(decision) {
  // 条件分支: 目标线路缺少当前逻辑剧集时进入；执行内容: 发布需要用户手动选集的最终结果。
  if (decision?.kind === PLAY_CATALOG_SELECTION_KIND.missingEpisode) {
    return createPlayCatalogOutcome(PLAY_CATALOG_OUTCOME_KIND.error, PLAY_CATALOG_OUTCOME_MESSAGE.missingEpisode);
  }
  // 条件分支: 线路显式不可用时进入；执行内容: 发布线路级失败终态。
  if (decision?.kind === PLAY_CATALOG_SELECTION_KIND.unavailableLine) {
    return createPlayCatalogOutcome(PLAY_CATALOG_OUTCOME_KIND.error, PLAY_CATALOG_OUTCOME_MESSAGE.unavailableLine);
  }
  // 条件分支: 剧集显式不可播放时进入；执行内容: 发布条目级失败终态。
  if (decision?.kind === PLAY_CATALOG_SELECTION_KIND.unplayableEpisode) {
    return createPlayCatalogOutcome(PLAY_CATALOG_OUTCOME_KIND.error, PLAY_CATALOG_OUTCOME_MESSAGE.unplayableEpisode);
  }
  // 返回值类型: Readonly<object>；作用: 正常、只浏览或无效目标不制造虚假切换结果。
  return createPlayCatalogOutcome();
}

/**
 * 创建媒体已经采用后的成功终态。
 * 纯函数: 只读取标准线路和剧集展示字段，不修改目录对象。
 * 失败路径: 展示字段缺失时使用通用目标名称，不暴露 Provider 私有定位值。
 *
 * @param {object} line 已成功采用媒体所属 PlayCatalogLine。
 * @param {object} episode 已成功采用的 PlayCatalogEpisode。
 * @returns {Readonly<object>} 包含线路和选集名称的成功终态。
 */
function createPlayCatalogSuccessOutcome(line, episode) {
  // 类型: string；作用: 优先使用线路名称，缺失时使用通用文案而不是输出不透明线路 id。
  const lineName = typeof line?.name === 'string' && line.name.trim() ? line.name.trim() : '目标线路';
  // 类型: string；作用: 优先使用按钮 label，其次标题；缺失时不拼接空选集片段。
  const episodeName = typeof episode?.label === 'string' && episode.label.trim()
    ? episode.label.trim()
    : (typeof episode?.title === 'string' ? episode.title.trim() : '');
  // 类型: string；作用: 组合本次已经采用的用户可见目标，成功文案与实际线路事实同时更新。
  const targetName = episodeName ? `${lineName} · ${episodeName}` : lineName;
  // 返回值类型: Readonly<object>；作用: 只在媒体采用完成后发布成功，不参与候选解析过程。
  return createPlayCatalogOutcome(PLAY_CATALOG_OUTCOME_KIND.success, `切换成功：${targetName}`);
}

/**
 * 创建等待恢复决策的媒体页面状态。
 * 纯函数: 返回新对象，不读取历史、Router 或播放器。
 *
 * @returns {object} isResolved=false、零秒和关闭自动播放的等待状态。
 */
function createPendingMediaResumeState() {
  return {
    // 类型: boolean；true 允许创建播放器，false 保持舞台等待恢复选择；由 loadPlayerContent 采用决策后修改。
    isResolved: false,
    // 类型: number；作用: 等待期间不向尚未创建的播放器提供历史秒数。
    startSeconds: 0,
    // 类型: boolean；true 创建后自动播放，false 等待用户播放；等待阶段固定为 false。
    autoplay: false
  };
}

/**
 * 创建已完成恢复决策的媒体页面状态。
 * 纯函数: 返回新对象并把非法秒数收敛为零，不修改历史或路由。
 *
 * @param {number} startSeconds 用户选择和恢复策略共同确定的起播秒数。
 * @param {boolean} autoplay true 允许创建后自动播放，false 只准备媒体。
 * @returns {object} 播放器可直接消费的当前会话恢复状态。
 */
function createResolvedMediaResumeState(startSeconds, autoplay) {
  return {
    // 类型: boolean；true 表示近尾选择或普通恢复已经完成，允许挂载播放器。
    isResolved: true,
    // 类型: number；作用: 使用非负有限历史秒数，非法输入从头开始。
    startSeconds: Number.isFinite(Number(startSeconds)) && Number(startSeconds) > 0
      ? Number(startSeconds)
      : 0,
    // 类型: boolean；true 继承路由自动播放意图，false 保持手动播放。
    autoplay: Boolean(autoplay)
  };
}

export default {
  // 组件名称用于在调试工具和报错信息中识别播放页。
  name: 'PlayerView',

  // 组件注册: XgplayerMediaPlayer 拥有唯一媒体实例，PlayCatalogSelector 提供详情和播放共用目录 DOM。
  components: {
    XgplayerMediaPlayer,
    PlayCatalogSelector
  },

  /**
   * 创建播放器页面本地运行状态。
   * 纯函数: 每个页面实例返回独立加载、错误和播放会话状态，不读取或写入外部 store。
   *
   * @returns {object} 播放器页面本地运行状态。
   */
  data() {
    return {
      // loading 类型: boolean。
      // loading 作用: 控制根容器 v-loading，请求播放页数据时显示页面级加载遮罩。
      loading: false,

      // loadError 类型: string。
      // loadError 作用: 记录播放页数据请求失败文案，失败时交给整页空状态展示。
      loadError: '',

      // 类型: object。
      // 作用: 保存 XgplayerMediaPlayer 最新稳定会话；只属于当前组件运行态，不进入 IndexedDB。
      mediaSessionState: createIdleMediaPlaybackSession(),

      // 类型: object。
      // 作用: 保存当前页面恢复选择结果；只控制播放器何时创建、起播秒数和 autoplay，不写入 Router 或历史。
      mediaResumeState: createPendingMediaResumeState(),

      // 类型: Readonly<object>|null。
      // 作用: 保存请求守卫最后采用的真实 player/player-entry 路由上下文；普通路由切换不会覆盖活动分集、线路或自动播放意图。
      playerRouteContext: null,

      // 类型: Readonly<object>|null。
      // 作用: 保存已经通过 playback.media 严格校验的直连媒体；候选请求期间保持旧引用。
      adoptedMedia: null,

      // 类型: object|null。
      // 作用: 保存实际播放媒体对应的逻辑剧集；历史、快捷键和会话身份只读取该对象。
      adoptedEpisode: null,

      // 类型: string。
      // 作用: 共享目录组件当前展示哪条线路的选集；允许与 playingLineId 暂时不同，不进入 Router 或持久化。
      browsedLineId: '',

      // 类型: string。
      // 作用: 当前已成功采用媒体所属线路 id；候选成功并完成交接前保持旧值。
      playingLineId: '',

      // 类型: boolean。
      // true: 候选 Provider 请求、恢复决策、旧进度提交或路由采用尚未结束，目录选集按钮不可重复提交。
      // false: 当前没有媒体交接事务，用户可以继续选择线路或剧集。
      handoffPending: false,

      // 类型: Readonly<object>。
      // 作用: 保存最后一次用户切换完成后的 success/error 终态；空对象表示无结果或候选仍在解析。
      catalogOutcome: createPlayCatalogOutcome()
    };
  },

  /**
   * Vue created 生命周期。
   * 副作用: 组件创建后请求当前路由播放内容，并由内容 service 写入 player 数据桶。
   * 成功路径: 页面从统一 store 读取 ContentItem 并按路由恢复分集、线路和自动播放。
   * 失败路径: loadPlayerContent 把错误收敛到 loadError，不生成伪造播放内容。
   *
   * @returns {void} 生命周期只触发异步加载，不返回业务数据。
   */
  created() {
    // 类型: Readonly<object>；作用: 当前 PlayerView 实例独享的播放入口和严格播放请求守卫。
    this._routeRequestGuard = createRouteRequestGuard({
      routeNames: ['player-entry']
    });
    // 类型: MediaPlaybackProgressService。
    // 作用: 当前 PlayerView 独享的进度协调器，只通过 userContentService 两个窄端口写会话和历史。
    this._mediaPlaybackProgressService = createMediaPlaybackProgressService({
      updateCurrentPlaying,
      upsertPlayHistory
    });

    // 类型: boolean。
    // true: 本轮持久化失败已经向用户提示，后续连续失败不重复弹出。
    // false: 尚无失败或后续事务已经恢复成功，可以在新失败时提示。
    this._mediaPersistenceFailureActive = false;

    // 类型: number；生命周期: 当前页面实例；作用: 让旧内容请求或恢复弹窗结果不能覆盖新路由状态。
    this._playerLoadGeneration = 0;

    // 类型: number；生命周期: 当前页面实例；作用: 让较早候选请求不能覆盖用户最后一次明确选择。
    this._mediaHandoffGeneration = 0;

    // 类型: string；生命周期: 当前页面实例；作用: 标记正式交接正在写入的目标 fullPath，路由 watcher 只采用上下文而不重复请求。
    this._internalRouteFullPath = '';

    // 类型: boolean；生命周期: 当前页面实例；作用: 旧进度开始最终提交后拒绝普通旧媒体事件重新建立协调会话。
    this._isMediaHandoffCommitting = false;

    // 条件分支: App 首次挂载常驻宿主时当前 URL 已经属于播放入口或严格播放地址时进入。
    // 执行内容: 采用首个播放请求身份并加载内容；普通路由冷启动只建立空宿主，不请求 Provider。
    if (this._routeRequestGuard.shouldHandle(this.$route)) {
      // 状态交接: 只有请求守卫确认的新播放 URL 可以替换常驻宿主的活动路由上下文。
      this.playerRouteContext = createPlayerRouteContext(this.$route);
      this.loadPlayerContent(this.playerRouteContext);
    }
  },

  /**
   * Vue beforeDestroy 生命周期。
   * 执行时机: 只有整个 App 真正销毁时触发；普通路由切换只改变 v-show，不进入本生命周期。
   * 副作用: 使仍在等待的内容/恢复流程失效；子播放器随后在自身 beforeDestroy 发布最终快照。
   * 成功路径: 不抢先重置进度协调器，保证子组件释放前真实秒数仍可被采用。
   *
   * @returns {void} 页面销毁继续同步完成。
   */
  beforeDestroy() {
    // 副作用: 提升请求代次，旧异步恢复选择返回后不能再挂载播放器。
    this._playerLoadGeneration = Number(this._playerLoadGeneration || 0) + 1;
    // 副作用: 提升候选代次，页面销毁后任何线路或选集请求都不能再采用媒体或路由。
    this._mediaHandoffGeneration = Number(this._mediaHandoffGeneration || 0) + 1;
  },

  /**
   * Vue destroyed 生命周期。
   * 执行时机: 常驻播放宿主随整个 App 销毁后触发；普通路由切换不清空 currentPlaying。
   * 副作用: 子播放器全部释放后对进度协调器执行幂等兜底终结，清空可能残留的 currentPlaying。
   * 成功路径: 子组件已通过 session-finalize 提交时不产生重复历史；没有子组件时只释放空状态。
   * 失败路径: 最终历史 reject 由统一观察方法提示，最近已提交投影保持不变。
   *
   * @returns {void} 页面销毁已经完成，不等待数据库阻塞卸载。
   */
  destroyed() {
    this.finalizeMediaPlaybackProgress();
  },

  watch: {
    /**
     * 监听当前可见播放路由及其严格内容标题。
     * 执行时机: 首次创建、进入或返回播放页、播放 URL 变化、匹配内容标题采用时触发。
     * 副作用: 通过统一标题服务写入 document.title；常驻宿主处于普通路由后台时不写入。
     *
     * @param {object|null} context 当前播放标题上下文，null 表示播放器不是当前页面。
     * @returns {void} 标题采用或后台跳过后结束。
     */
    documentTitleContext: {
      // 类型: boolean；true 在常驻宿主创建时立即判断标题权限，false 会遗漏播放页冷启动静态标题。
      immediate: true,
      /**
       * 采用当前播放标题上下文。
       * 副作用: 只在 context 非空时调用统一标题服务写入 document.title。
       * 失败路径: 播放器位于普通路由后台时保持 Router 当前标题，不写入旧媒体名称。
       *
       * @param {object|null} context 当前播放标题上下文。
       * @returns {void} 标题采用或后台跳过后结束。
       */
      handler(context) {
        // 条件分支: 常驻播放宿主当前隐藏在普通路由后台时进入；执行内容: 保留 Router 已采用的页面标题。
        if (!context) {
          return;
        }
        // 副作用: 当前播放路由采用统一格式标题；服务负责浏览器缺失时安全降级。
        applyDocumentTitle(context.route, context.contentTitle);
      }
    },

    /**
     * 监听全局完整路由变化。
     * 执行时机: 常驻宿主存活期间任意路由变化都会触发，只有新的播放请求身份会继续处理。
     * 页面影响: 从新路由重新请求 player.currentKey，保证详情页跳转到不同视频时播放页同步刷新。
     * 副作用: 重置旧媒体会话并按新 fullPath 触发内容请求；子组件 key 变化负责释放旧播放器。
     *
     * @returns {void} 只触发播放页数据请求，不返回业务数据。
     */
    '$route.fullPath'() {
      // 条件分支: 当前路由属于普通页面或播放地址已经处理过时进入。
      // 执行内容: 保留常驻播放器、媒体 DOM、实时 currentTime 和进度事件，不执行任何后台补偿。
      if (!this._routeRequestGuard || !this._routeRequestGuard.shouldHandle(this.$route)) {
        return;
      }

      // 类型: Readonly<object>|null；作用: 从刚被守卫接受的真实播放 URL 创建新媒体请求上下文。
      const nextPlayerRouteContext = createPlayerRouteContext(this.$route);
      // 条件分支: 播放路由结构与严格身份不满足契约时进入。
      // 执行内容: 保留当前稳定媒体会话，不使用非法地址清空分集、线路或播放状态。
      if (!nextPlayerRouteContext) {
        return;
      }

      // 条件分支: 当前地址正由已验证候选的正式交接写入时进入。
      // 执行内容: 只采用真实路由上下文，不重新请求 Provider，也不提前清理已采用媒体。
      if (nextPlayerRouteContext.fullPath === this._internalRouteFullPath) {
        this.playerRouteContext = nextPlayerRouteContext;
        return;
      }

      // 副作用: 外部播放地址让所有旧候选失效；当前媒体继续保留到新候选验证和历史提交成功。
      this._mediaHandoffGeneration = Number(this._mediaHandoffGeneration || 0) + 1;
      this.handoffPending = false;
      this.catalogOutcome = createPlayCatalogOutcome();

      // 副作用: 按新地址请求播放候选；只有 loadPlayerContent 成功采用后才替换 playerRouteContext 和媒体。
      this.loadPlayerContent(nextPlayerRouteContext);
    }
  },

  computed: {
    /**
     * 当前已提交的项目快捷键偏好。
     * 数据来源: shortcutSettingsStore.preferences，由应用挂载前初始化并在保存事务提交后整体替换。
     * 纯函数: 只读取响应式 Store 投影，不修改设置、播放器或浏览器监听器。
     *
     * @returns {object|null} 完整 ShortcutPreferences；启动失败时应用不会挂载本页面。
     */
    shortcutPreferences() {
      return shortcutSettingsStore.preferences;
    },

    /**
     * 当前播放页统一内容对象。
     * 纯函数: 只通过内容 selector 读取 player.currentKey 对应 ContentItem。
     *
     * @returns {Object|null} 当前 ContentItem；尚未加载或未命中时为 null。
     */
    video() {
      // 返回值类型: Object|null。
      // 作用: 始终从唯一实体 Store 读取 player.currentKey 对应 ContentItem，页面不保存第二内容权威。
      return getCurrentContentItem('player');
    },

    /**
     * 当前视频来源对象。
     * 纯函数: 只读取 video.source 并返回对象或 null。
     *
     * @returns {Object|null} ContentItem.source 对象；缺失时为 null。
     */
    source() {
      // source 是统一 ContentItem 的来源扩展字段，当前用于显示来源名称。
      return this.video && this.video.source ? this.video.source : null;
    },

    /**
     * 当前已采用内容的统一播放目录。
     * 纯函数: 只读取 ContentItem.playCatalog，不从 playback 或旧平铺字段重建目录。
     *
     * @returns {object|null} 标准播放目录或 null。
     */
    playCatalog() {
      // 返回值类型: object|null；作用: 共享组件和选择服务消费同一目录引用。
      return this.video?.playCatalog && typeof this.video.playCatalog === 'object'
        ? this.video.playCatalog
        : null;
    },

    /**
     * 活动播放上下文是否为不携带内容身份的一级入口。
     * 纯函数: 只读取请求守卫已采用的 playerRouteContext，不读取当前普通路由或修改媒体状态。
     * 成功路径: `/player` 对应 player-entry 时返回 true。
     * 失败路径: 严格播放路由和其他路由返回 false。
     *
     * @returns {boolean} true 表示只展示播放空状态，false 表示按严格身份加载内容。
     */
    isPlayerEntry() {
      // 返回值类型: boolean；作用: 把已采用的可发现一级入口和严格播放请求明确分离。
      return this.playerRouteContext?.routeName === 'player-entry';
    },

    /**
     * 活动播放路由上下文中的数据源 id。
     * 纯函数: 只读取请求守卫已采用的 playerRouteContext.sourceId。
     *
     * @returns {string} URL params 中的 sourceId，没有时返回空字符串。
     */
    routeSourceId() {
      // sourceId 来自最后一次被守卫采用的严格播放路径，普通路由 params 不会覆盖它。
      return this.asText(this.playerRouteContext?.sourceId).trim();
    },

    /**
     * 活动播放路由上下文中的内容 id。
     * 纯函数: 只读取请求守卫已采用的 playerRouteContext.contentId。
     *
     * @returns {string} URL params 中的 videoId，没有时返回空字符串。
     */
    routeVideoId() {
      // contentId 来自最后一次严格播放路径的 videoId，普通路由 params 不会覆盖它。
      return this.asText(this.playerRouteContext?.contentId).trim();
    },

    /**
     * 活动播放路由上下文中的分集 id。
     * 纯函数: 只读取请求守卫已采用的 playerRouteContext.episodeId。
     *
     * @returns {string} episodeId query 文本。
     */
    routeEpisodeId() {
      // 返回值类型: string。
      // 作用: 保留详情页或历史进入播放页时的目标分集，普通页面 query 不会清空它。
      return this.asText(this.playerRouteContext?.episodeId).trim();
    },

    /**
     * 活动播放路由上下文中的分集序号。
     * 纯函数: 只读取已经标准化的 playerRouteContext.episodeIndex。
     *
     * @returns {number|null} episodeIndex query 数字。
     */
    routeEpisodeIndex() {
      // 类型: number。
      // 作用: 已采用播放上下文中的 episodeIndex 用于 episodeId 缺失时兜底定位历史记录。
      const episodeIndex = Number(this.playerRouteContext?.episodeIndex);

      // 返回值类型: number|null。
      // 作用: 有效集数返回数字，异常时返回 null。
      return Number.isFinite(episodeIndex) && episodeIndex > 0 ? episodeIndex : null;
    },

    /**
     * 活动播放路由上下文中的线路 id。
     * 纯函数: 只读取请求守卫已采用的 playerRouteContext.playbackSourceId。
     *
     * @returns {string} playbackSourceId query 文本。
     */
    routePlaybackSourceId() {
      // 返回值类型: string。
      // 作用: 保留用户最后采用的播放线路，普通路由 query 不会使其回退 Provider 默认线路。
      return this.asText(this.playerRouteContext?.playbackSourceId).trim();
    },

    /**
     * 活动播放上下文是否要求自动开始播放。
     * 纯函数: 只读取 createPlayerRouteContext 已标准化的 autoplay。
     *
     * @returns {boolean} true 表示由详情页播放入口带入，应自动写入 currentPlaying 和播放历史。
     */
    routeShouldAutoPlay() {
      // 返回值类型: boolean。
      // 作用: true 继承播放 URL 的明确意图，false 表示一级入口或手动播放；普通路由不改变该值。
      return this.playerRouteContext?.autoplay === true;
    },

    /**
     * 是否有播放页主体视频信息。
     * 纯函数: 只读取 isPlayerEntry、当前路由身份和 video，不修改旧数据桶或路由状态。
     * 成功路径: 严格播放路由存在同 sourceId/contentId 的 ContentItem 时返回 true。
     * 失败路径: 播放一级入口或旧桶身份不匹配时返回 false，避免失败期间显示上一次播放内容。
     *
     * @returns {boolean} 当前实体与严格播放路由身份一致时返回 true。
     */
    hasVideo() {
      // 返回值类型: boolean；作用: 只有内容、媒体、逻辑剧集和播放线路已经共同采用后才渲染播放主体。
      return Boolean(this.video && this.adoptedMedia && this.adoptedEpisode && this.playingLineId);
    },

    /**
     * 当前播放页允许采用的浏览器标题上下文。
     * 纯函数: 通过统一播放路由解析器读取当前真实 Route，并读取内容实体；不修改活动播放上下文、媒体会话或 document。
     * 成功路径: 播放入口返回静态标题上下文；严格播放只在实体身份匹配当前 URL 时携带视频标题。
     * 失败路径: 普通路由或非法播放 URL 返回 null；旧媒体实体与新 URL 不一致时只返回静态标题。
     *
     * @returns {Readonly<object>|null} 当前 Route 与可选内容标题，或后台状态 null。
     */
    documentTitleContext() {
      // 类型: Readonly<object>|null；作用: 通过媒体请求共用解析器读取当前 URL，避免标题逻辑再次解释 params/query。
      const currentRouteContext = createPlayerRouteContext(this.$route);
      // 条件分支: 当前地址是普通路由或非法播放 URL 时进入；执行内容: 关闭后台播放器标题写入权限。
      if (!currentRouteContext) {
        return null;
      }

      // 类型: boolean；作用: 证明当前实体属于当前严格播放 URL，不让旧媒体标题在新请求窗口短暂冒充。
      const hasCurrentRouteVideo = Boolean(
        currentRouteContext.routeName === 'player'
        && this.video
        && this.video.sourceId === currentRouteContext.sourceId
        && this.video.id === currentRouteContext.contentId
      );

      return Object.freeze({
        // 类型: object；作用: 保留当前真实 Route，统一服务从中读取 meta.title。
        route: this.$route,
        // 类型: string；作用: 严格身份匹配时补充内容标题，入口、加载和身份切换阶段保持空字符串。
        contentTitle: hasCurrentRouteVideo
          ? this.asText(this.video && this.video.title).trim()
          : ''
      });
    },

    /**
     * 计算播放页整页空状态说明。
     * 纯函数: 只读取路由类型和本次请求错误，不修改页面或领域状态。
     * 成功路径: 一级入口展示未选择内容说明，请求失败展示真实安全错误。
     * 失败路径: 没有错误和内容时返回稳定无内容说明。
     *
     * @returns {string} 当前整页空状态文案。
     */
    emptyStateDescription() {
      // 条件分支: 当前 URL 是不携带内容身份的播放一级入口时进入。
      // 执行内容: 显示有意空状态，不把缺少 params 表达成请求错误。
      if (this.isPlayerEntry) {
        return '当前没有选中的播放内容';
      }

      // 条件分支: 严格播放请求仍在解析 Provider 返回内容时进入；执行内容: 让请求阶段区别于无内容空态。
      if (this.loading) {
        return '正在解析播放地址';
      }

      return this.loadError || '当前没有可展示的播放信息';
    },

    /**
     * 播放空状态是否显示恢复动作。
     * 纯函数: 只读取入口类型、加载状态和错误文案，不修改播放器或 Router。
     *
     * @returns {boolean} 一级播放入口或严格播放请求失败时返回 true。
     */
    showPlayerRecoveryActions() {
      return this.isPlayerEntry || (Boolean(this.loadError) && !this.loading);
    },

    /**
     * 严格播放请求是否显示重试动作。
     * 纯函数: 只读取当前路由身份、错误和加载状态。
     *
     * @returns {boolean} 当前严格播放请求已失败时返回 true。
     */
    showPlayerRetryAction() {
      return !this.isPlayerEntry
        && Boolean(this.routeSourceId && this.routeVideoId)
        && Boolean(this.loadError)
        && !this.loading;
    },

    /**
     * 当前播放内容的中文类型。
     * 数据来源: ContentItem.type，字段契约当前固定为 movie 或 tv。
     * 页面位置: 内容信息面板中的 .player-type-badge。
     * 维护边界: 只派生展示文案，不修改 ContentItem。
     * 纯函数: 只读取 ContentItem.type 并返回展示文案。
     *
     * @returns {string} movie 返回“电影”，tv 返回“电视剧”，其它值返回原文本或“视频”。
     */
    contentTypeText() {
      // 类型: string。
      // 作用: 规范 ContentItem.type，供类型映射分支比较。
      const contentType = this.asText(this.video && this.video.type).trim().toLowerCase();

      // 条件分支: 当前内容类型为 movie 时进入。
      // 执行内容: 返回用户可读的电影类型文案。
      if (contentType === 'movie') {
        return '电影';
      }

      // 条件分支: 当前内容类型为 tv 时进入。
      // 执行内容: 返回用户可读的电视剧类型文案。
      if (contentType === 'tv') {
        return '电视剧';
      }

      // 非标准类型保留原文本，缺失时使用“视频”兜底。
      return contentType || '视频';
    },

    /**
     * 当前实际播放线路的剧集列表。
     * 纯函数: 只从 playCatalog 按 playingLineId 精确读取，不使用浏览线路或跨线路补集。
     *
     * @returns {Array<object>} 当前播放线路的标准逻辑剧集列表。
     */
    playingEpisodes() {
      // 类型: object|null；作用: 读取已经成功采用媒体所属线路。
      const line = findPlayCatalogLine(this.playCatalog, this.playingLineId);
      // 返回值类型: Array<object>；作用: 无有效数组时返回空集合供快捷键边界判断。
      return Array.isArray(line?.episodes) ? line.episodes : [];
    },

    /**
     * 当前选中分集 id。
     * 路由 query 是可刷新播放上下文事实；无有效 query 时按第一条可播放分集兜底。
     * 纯函数: 只读取 episodes 和 route query，不修改路由、内容或用户状态。
     *
     * @returns {string} 当前有效分集 id；没有分集时返回空字符串。
     */
    playingEpisodeId() {
      // 返回值类型: string；作用: 只回显已经随媒体成功采用的逻辑身份。
      return this.adoptedEpisode?.id || '';
    },

    /**
     * 当前选中的分集。
     * 纯函数: 只从共享目录按逻辑剧集身份派生浏览线路的高亮项，不修改目录。
     * 页面位置：分集按钮 active 状态、播放线路匹配和历史恢复。
     *
     * @returns {Object|null} 当前分集对象。
     */
    browsedSelectedEpisodeId() {
      // 类型: object|null；作用: 精确读取共享组件当前展示的线路。
      const line = findPlayCatalogLine(this.playCatalog, this.browsedLineId);
      // 类型: object|null；作用: 只有浏览线路包含当前实际播放逻辑剧集时才显示选中态，缺集时保持空值。
      const episode = findPlayCatalogEpisode(line, this.playingEpisodeId);
      // 返回值类型: string；作用: 候选成功前不提前高亮其他逻辑剧集。
      return episode?.id || '';
    },

    /**
     * 当前选中分集序号。
     * 纯函数: 只读取已经采用的逻辑剧集并返回标准 episodeNumber 或 null。
     *
     * @returns {number|null} 电视剧分集序号；电影或缺失时返回 null。
     */
    playingEpisodeIndex() {
      // 返回值类型: number|null；作用: 统一只读取 PlayCatalogEpisode.episodeNumber，不采用旧字段或数组位置。
      return resolveEpisodeIndex(this.adoptedEpisode);
    },

    /**
     * 当前内容的全部播放线路。
     *
     * 页面位置：顶部线路切换区。
     * 纯函数: 只读取 playCatalog 并精确返回当前浏览线路。
     *
     * @returns {object|null} 当前浏览线路。
     */
    browsedLine() {
      // 返回值类型: object|null；作用: 浏览线路只控制共享目录内容，不代表播放器已经切换。
      return findPlayCatalogLine(this.playCatalog, this.browsedLineId);
    },

    /**
     * 当前激活播放线路 id。
     * 纯函数: 只读取 playCatalog 和已采用线路 id，不修改目录或路由。
     *
     * @returns {string} 当前线路 id；没有线路时返回空字符串。
     */
    playingLine() {
      // 返回值类型: object|null；作用: 顶部 Chip 和会话上下文只读取已经正式采用的线路。
      return findPlayCatalogLine(this.playCatalog, this.playingLineId);
    },

    /**
     * 当前激活线路的用户可读名称。
     * 数据来源: playCatalog 和 playingLineId，线路名称只来自已采用目录线路。
     * 页面位置: 内容信息面板中的“当前线路”字段。
     * 维护边界: 只派生展示文本，不保存第二份线路状态，也不修改线路选择逻辑。
     * 纯函数: 只读取当前线路和按钮视图并返回名称。
     *
     * @returns {string} 当前线路名称；没有可用线路时返回明确占位文案。
     */
    playingLineName() {
      // 返回值类型: string；作用: 顶部只回显实际播放线路，浏览线路变化不会提前覆盖该文案。
      return this.playingLine?.name || this.playingLine?.id || '暂无可用线路';
    },

    /**
     * 当前来源名称。
     *
     * 页面位置：内容信息面板的数据源文字。
      * 纯函数: 读取完整 ContentItem.source.name 并通过共享适配器返回展示短名称。
     *
     * @returns {string} 来源名称或占位文案。
     */
    sourceName() {
      // 条件分支: 统一 ContentItem.source.name 存在时进入。
      // 执行内容: 返回十字符以内的用户可读来源名称。
      if (this.source && this.source.name) {
        return formatSourceDisplayName(this.source.name);
      }

      // 没有来源对象时给出明确占位。
      return '暂无来源';
    },

    /**
     * 当前播放内容的用户状态聚合。
     * 纯函数: 只通过 selector 读取当前 ContentItem 的用户状态。
     *
     * @returns {object} 收藏、最近播放和当前播放状态。
     */
    contentUserStatus() {
      // 返回值类型: object。
      // 作用: 播放页不直接读取 userContentStore 内部结构，统一通过 selector 获取用户状态。
      return getContentUserStatus(this.video);
    },

    /**
     * 播放页收藏按钮状态。
     * 纯函数: 只读取 Repository 提交后 selector 发布的收藏状态。
     *
     * @returns {boolean} true 表示当前内容已收藏。
     */
    isFavorite() {
      // 返回值类型: boolean。
      // 作用: 使用唯一用户内容投影驱动按钮，不维护页面收藏影子状态。
      return Boolean(this.contentUserStatus.favorite);
    },

    /**
     * 收藏按钮图标。
     * 纯函数: 只读取 isFavorite 并返回 Element UI 图标类名。
     *
     * @returns {string} Element UI 图标类名。
     */
    favoriteButtonIcon() {
      // 返回值类型: string。
      // 作用: 已收藏显示实心星标，未收藏显示空心星标。
      return this.isFavorite ? 'el-icon-star-on' : 'el-icon-star-off';
    },

    /**
     * 收藏按钮文案。
     * 纯函数: 只读取 isFavorite 并返回按钮文本。
     *
     * @returns {string} 收藏按钮当前状态文案。
     */
    favoriteButtonText() {
      // 返回值类型: string。
      // 作用: 文案跟随收藏状态变化，让用户知道当前收藏状态。
      return this.isFavorite ? '已收藏' : '收藏';
    },

    /**
     * 当前媒体组件会话 key。
     * 纯函数: 只读取内容、分集和线路身份；任一身份变化都会让 Vue 销毁旧播放器组件。
     *
     * @returns {string} 当前媒体会话身份。
     */
    mediaSessionKey() {
      return [
        this.video?.sourceId || '',
        this.video?.id || '',
        this.playingEpisodeId || '',
        this.playingLineId || '',
        this.adoptedMedia?.type || '',
        this.adoptedMedia?.url || ''
      ].join('::');
    },

    /**
     * 传给播放器适配组件的内容上下文。
     * 纯函数: 返回新对象，只含稳定身份，不包含媒体 URL、Router 或用户历史对象。
     *
     * @returns {object} 当前 source/content/episode/line 身份。
     */
    mediaSessionContext() {
      return {
        sourceId: this.video?.sourceId || this.routeSourceId || '',
        contentId: this.video?.id || this.routeVideoId || '',
        episodeId: this.playingEpisodeId,
        episodeIndex: this.playingEpisodeIndex,
        playbackSourceId: this.playingLineId
      };
    },

    /**
     * 传给媒体进度协调器的用户内容上下文。
     * 纯函数: 从当前 ContentItem、分集和线路派生历史上下文，不包含 URL、Router 或播放器实例。
     *
     * @returns {object} source/content/type/episode/line 用户内容写入身份。
     */
    mediaProgressContext() {
      return {
        sourceId: this.video?.sourceId || this.routeSourceId || '',
        contentId: this.video?.id || this.routeVideoId || '',
        type: this.video?.type || '',
        episodeId: this.playingEpisodeId,
        episodeIndex: this.playingEpisodeIndex,
        playbackSourceId: this.playingLineId,
        // 类型: object|null；作用: 用户内容服务从当前标准对象生成完整卡片快照，不保存页面或路由字段。
        contentItem: this.video || null,
        // 类型: object|null；作用: 用户内容服务从当前分集生成跨源 EpisodeLocator，电影可为 null。
        episode: this.adoptedEpisode || null
      };
    },

    /**
     * 真实播放器初始 seek 秒数。
     * 纯函数: 只读取本次页面已经完成的恢复选择；无历史、近头或选择重播返回 0。
     *
     * @returns {number} 非负起播秒数。
     */
    mediaStartTime() {
      return this.mediaResumeState.startSeconds;
    },

    /**
     * 真实播放器海报地址。
     * 纯函数: 优先读取横向 cover，缺失时使用 poster，不修改 ContentItem。
     *
     * @returns {string} 海报 URL 或空字符串。
     */
    mediaPoster() {
      return this.video?.cover || this.video?.poster || '';
    },

    /**
     * 当前媒体是否处于应跨切换继续播放的阶段。
     * 纯函数: 只读取媒体会话 phase。
     *
     * @returns {boolean} playing 或 buffering 时为 true。
     */
    isMediaActivelyPlaying() {
      return [MEDIA_PLAYBACK_PHASE.playing, MEDIA_PLAYBACK_PHASE.buffering]
        .includes(this.mediaSessionState.phase);
    }
  },

  methods: {
    /**
     * 把任意值整理成字符串。
     *
     * 调用位置：routeSourceId、routeVideoId。
     * 页面影响：保证路由参数进入页面后始终以字符串形态参与展示。
     * 纯函数: 字符串原样返回，其他输入返回空文本。
     *
     * @param {*} value 可能来自路由 params 的任意值。
     * @returns {string} 字符串原样返回，其他值统一转为空字符串。
     */
    asText(value) {
      // 条件分支: value 是字符串时进入。
      // 执行内容: 原样返回路由文本。
      if (typeof value === 'string') {
        return value;
      }

      // 非字符串统一转为空，避免页面展示 undefined 或 null。
      return '';
    },

    /**
     * 为目标逻辑剧集计算播放恢复位置。
     * 副作用: 近尾记录会打开一次用户选择对话框；不写 Router、媒体、currentPlaying 或历史。
     * 成功路径: 返回恢复秒数和自动播放意图；取消/关闭近尾对话框按继续最后位置处理。
     * 失败路径: 代次失效时返回 null，调用方必须丢弃候选，不采用旧异步结果。
     *
     * @param {object} contentItem 候选 ContentItem。
     * @param {object} episode 候选逻辑剧集。
     * @param {boolean} autoplay 当前播放目标是否要求自动播放。
     * @param {number} generation 当前候选代次。
     * @returns {Promise<object|null>} 已解析恢复状态或 null。
     */
    async resolveResumeStateForTarget(contentItem, episode, autoplay, generation) {
      // 类型: object|null；作用: 按候选内容和标准逻辑剧集读取同一历史；新键未命中时只允许可靠旧 URL 身份恢复。
      const historyRecord = getHistoryRecord({
        sourceId: contentItem?.sourceId || '',
        contentId: contentItem?.id || '',
        type: contentItem?.type || '',
        episodeId: episode?.id || '',
        episodeIndex: resolveEpisodeIndex(episode),
        episode
      });
      // 类型: object；作用: 由用户内容 service 决定从头、恢复或近尾提示，不在页面复制阈值。
      const decision = getPlaybackResumeDecision(historyRecord) || {};
      // 类型: string；作用: 近尾提示默认表达重新播放，取消和关闭转为继续历史位置。
      let selection = MEDIA_RESUME_SELECTION.restart;

      // 条件分支: 当前历史不需要近尾确认时进入；执行内容: 直接采用 service 给出的秒数。
      if (!decision.shouldPromptReplay) {
        return createResolvedMediaResumeState(decision.startSeconds, autoplay);
      }

      try {
        // 异步交互: 候选媒体尚未正式采用时询问近尾恢复，旧媒体仍保持播放。
        await this.$confirm(
          '上次播放已经接近结尾，请选择重新播放或继续最后位置。',
          '播放恢复',
          {
            confirmButtonText: '重新播放',
            cancelButtonText: '继续播放',
            type: 'info',
            closeOnClickModal: false,
            distinguishCancelAndClose: true
          }
        );
      } catch {
        // 用户决定: 取消按钮和关闭操作都表示继续最后位置，不把正常选择当成失败。
        selection = MEDIA_RESUME_SELECTION.continue;
      }

      // 条件分支: 等待对话框期间候选已经被新选择或页面销毁取代时进入；执行内容: 丢弃本次恢复结果。
      if (generation !== this._mediaHandoffGeneration && this.adoptedMedia) {
        return null;
      }
      // 类型: number；作用: restart 使用 0，continue 使用历史已校验秒数。
      const startSeconds = selection === MEDIA_RESUME_SELECTION.restart ? 0 : decision.startSeconds;
      return createResolvedMediaResumeState(startSeconds, autoplay);
    },

    /**
     * 请求播放页数据。
     *
     * 调用位置：created 生命周期、播放路由变化监听。
     * 页面影响：通过 sourceDataService 请求 player 数据桶，成功后严格采用候选才驱动模板。
     * 副作用: 更新 loading/loadError/收藏覆盖/播放会话状态，并由内容 service 提交 player 数据桶。
     * 成功路径: 统一内容响应采用后按当前路由处理自动播放和历史恢复。
     * 失败路径: 捕获请求错误写入 loadError，保留页面空状态并关闭 loading。
     *
     * @returns {Promise<void>} 请求完成后不返回业务数据。
     */
    /**
     * 采用已经完成两阶段校验的播放候选。
     * 副作用: 同步替换当前播放内容、媒体、线路、逻辑剧集和恢复状态；调用前旧历史必须已经提交完成。
     * 成功路径: Vue 下一次渲染只创建候选媒体实例，目录浏览线路跟随已采用目录初始化。
     * 失败路径: 候选校验不在本方法内重复，调用方必须只传 normalizePlaybackCandidate 的结果。
     *
     * @param {object} candidate normalizePlaybackCandidate 返回的冻结候选。
     * @param {object} resumeState 已完成用户恢复选择的媒体页面状态。
     * @returns {void} 采用状态通过 Vue 响应式字段生效。
     */
    adoptPlaybackCandidate(candidate, resumeState) {
      // 副作用: 直连媒体、逻辑剧集和线路共同成为播放器事实；完整 ContentItem 继续由唯一 Store 提供。
      this.adoptedMedia = candidate.media;
      this.adoptedEpisode = candidate.episode;
      this.playingLineId = candidate.line.id;
      // 副作用: 初次采用或候选成功后，目录先展示真实播放线路，用户随后可以独立浏览其他线路。
      this.browsedLineId = candidate.line.id;
      this.mediaSessionState = createIdleMediaPlaybackSession();
      this.mediaResumeState = resumeState;
      // 状态交接: 新媒体事实已经全部采用，后续新组件事件可以进入进度协调器。
      this._isMediaHandoffCommitting = false;
    },

    /**
     * 在替换媒体前完成旧媒体最后一次历史提交。
     * 副作用: 通过唯一进度协调器 finalization 提交 currentPlaying 清理和最后历史，随后协调器释放当前会话。
     * 成功路径: 没有需要写入的会话也视为可交接；持久化 Promise resolve 后返回 true。
     * 失败路径: 不采用候选，保留旧媒体和播放身份，并通过统一失败提示报告错误。
     *
     * @returns {Promise<boolean>} 旧会话是否可以进入媒体替换阶段。
     */
    async finalizeForMediaHandoff() {
      try {
        // 状态交接: 从最终快照提交开始拒绝旧播放器普通事件重新建立已经关闭的进度会话。
        this._isMediaHandoffCommitting = true;
        // 类型: Promise<Array<*>>|null；作用: 使用当前最新稳定会话封存旧历史，服务内部立即关闭旧活动身份。
        const operation = this._mediaPlaybackProgressService.finalize(this.mediaSessionState);
        // 条件分支: 本次旧会话没有触发长期历史事务时进入；执行内容: 直接允许候选交接。
        if (!operation || typeof operation.then !== 'function') {
          return true;
        }
        await operation;
        this._mediaPersistenceFailureActive = false;
        return true;
      } catch (error) {
        // 失败补偿: 候选不会采用，恢复旧播放器事件进入同一进度协调器。
        this._isMediaHandoffCommitting = false;
        // 失败处理: 统一报告持久化错误，候选调用方据此保持旧媒体和旧播放身份。
        this.reportMediaPersistenceFailure(error);
        return false;
      }
    },

    /**
     * 请求播放页数据并按两阶段规则采用媒体。
     * 副作用: 请求 Provider、读取用户恢复状态、等待旧进度提交并在成功时替换 Router 和播放器状态。
     * 成功路径: 普通地址直接请求媒体；稳定记录入口先解析当前详情目录，再验证媒体、迁移用户记录并正式采用。
     * 失败路径: 候选失败保持已采用媒体、线路、路由和历史；没有旧媒体时只展示安全空状态。
     *
     * @param {object|null} routeContext 请求守卫或候选交接提供的播放路由上下文。
     * @returns {Promise<boolean>} true 表示新媒体已采用，false 表示空入口、过期或失败并保持原状态。
     */
    async loadPlayerContent(routeContext = this.playerRouteContext) {
      // 类型: number；作用: 为一次首屏或外部播放地址请求分配代次，较早响应不能覆盖最新请求。
      const generation = Number(this._playerLoadGeneration || 0) + 1;
      this._playerLoadGeneration = generation;

      // 条件分支: 当前请求是无内容的播放一级入口时进入；执行内容: 只展示空入口，不请求 Provider。
      if (routeContext?.routeName === 'player-entry') {
        // 条件分支: 一级入口前仍有实际媒体时进入；执行内容: 先等待最后进度提交，再释放播放事实。
        if (this.adoptedMedia) {
          // 类型: boolean；作用: 防止入口切换在历史保存失败时直接丢弃当前媒体会话。
          const finalized = await this.finalizeForMediaHandoff();
          // 条件分支: 保存失败或请求已过期时进入；执行内容: 保留当前媒体事实，不继续清空入口状态。
          if (!finalized || generation !== this._playerLoadGeneration) {
            this._isMediaHandoffCommitting = false;
            return false;
          }
        }
        this.loading = false;
        this.loadError = '';
        this.playerRouteContext = routeContext;
        this.adoptedMedia = null;
        this.adoptedEpisode = null;
        this.browsedLineId = '';
        this.playingLineId = '';
        this.catalogOutcome = createPlayCatalogOutcome();
        this.mediaSessionState = createIdleMediaPlaybackSession();
        this.mediaResumeState = createPendingMediaResumeState();
        this._isMediaHandoffCommitting = false;
        return false;
      }

      // 条件分支: 严格播放身份缺失时进入；执行内容: 失败关闭，不回退默认源或旧 query。
      if (!routeContext?.sourceId || !routeContext?.contentId) {
        // 条件分支: 当前没有旧媒体时进入；执行内容: 保存空入口错误供整页空状态展示。
        if (generation === this._playerLoadGeneration && !this.adoptedMedia) {
          this.loadError = '播放地址缺少数据源或内容身份';
        }
        return false;
      }

      // 副作用: 只有没有已采用媒体时才展示页面级加载遮罩，候选交接期间旧播放器保持可见可播。
      this.loading = !this.adoptedMedia;
      this.loadError = '';

      try {
        // 类型: boolean；作用: 任一稳定恢复 query 出现都要求完整解析，残缺或失效键不能降级成普通 player 请求。
        const hasRecoveryQuery = Boolean(
          routeContext.query?.[USER_CONTENT_RECOVERY_QUERY.kind]
          || routeContext.query?.[USER_CONTENT_RECOVERY_QUERY.key]
        );
        // 类型: object|null；作用: 从稳定记录键读取当前用户记录；普通播放地址保持 null。
        const recoveryContext = getUserContentRecoveryContext(routeContext.query);
        // 条件分支: URL 声明恢复但用户记录不存在、类型错误或键残缺时进入；执行内容: 不向 Provider 发送没有当前目录目标的请求。
        if (hasRecoveryQuery && !recoveryContext) {
          throw new Error('播放历史或收藏记录已经失效，请返回个人中心重新选择');
        }
        // 类型: Readonly<object>；作用: 普通请求沿用入口上下文，恢复请求随后替换为当前目录解析出的规范线路和分集上下文。
        let requestRouteContext = routeContext;

        // 条件分支: 个人中心可用源历史或带历史收藏进入时执行；执行内容: 先读取当前 detail.playCatalog，不使用持久化旧线路请求 player。
        if (recoveryContext) {
          // 异步请求: 当前 Provider 根据稳定 sourceId/contentId 返回最新详情和播放目录，不携带旧 episodeId/playbackSourceId。
          // 类型: object；作用: 保存当前详情响应，后续只读取标准 item 和 playCatalog 执行恢复映射。
          const detailResponse = await requestSourceData({
            sourceId: routeContext.sourceId,
            pageKey: 'detail',
            params: { contentId: routeContext.contentId }
          });
          // 条件分支: 详情请求已被更晚播放地址取代时进入；执行内容: 丢弃当前解析，不迁移用户记录。
          if (generation !== this._playerLoadGeneration) return false;
          // 类型: Readonly<object>|null；作用: 先按旧逻辑 id、再按 EpisodeLocator 精确选择当前目录线路和剧集。
          const resolvedRecovery = resolveUserContentRecoveryPlaybackTarget(
            detailResponse?.item,
            recoveryContext,
            routeContext.query
          );
          // 条件分支: 当前目录无法唯一定位原分集或没有可用线路时进入；执行内容: 保留原历史/收藏且不误播。
          if (!resolvedRecovery) {
            throw new Error('当前数据源无法准确定位原播放内容，请从详情页手动选择');
          }
          // 类型: Readonly<object>|null；作用: Router 解析服务生成的规范目标，恢复键已经从最终 query 删除。
          requestRouteContext = createPlayerRouteContext(this.$router.resolve(resolvedRecovery.target)?.route);
          // 条件分支: 规范目标无法形成严格播放器上下文时进入；执行内容: 不发起半完整媒体请求。
          if (!requestRouteContext) throw new Error('播放恢复目标无法解析');
        }

        // 类型: object；作用: 使用候选路由中的精确内容、分集和线路身份构造 Provider 参数。
        const requestParams = createPlayerRequestParams({
          contentId: requestRouteContext.contentId,
          autoplay: requestRouteContext.autoplay,
          episodeId: requestRouteContext.episodeId,
          episodeIndex: requestRouteContext.episodeIndex,
          playbackSourceId: requestRouteContext.playbackSourceId
        });
        // 异步请求: Provider 返回完整 ContentItem，响应先进入统一 Store，再由本页严格验证 playback。
        // 类型: object；作用: 保存 Provider 返回的标准响应，后续只使用其 item 生成候选。
        const response = await requestSourceData({
          sourceId: requestRouteContext.sourceId,
          pageKey: PLAYER_PAGE_KEY,
          params: requestParams
        });
        // 条件分支: 请求已被更晚路由取代时进入；执行内容: 丢弃当前候选，不改变播放器或路由。
        if (generation !== this._playerLoadGeneration) return false;

        // 类型: object；作用: 保存 Provider 为本次请求最终解析的播放身份。
        const responsePlayback = response?.item?.playback || {};
        // 类型: object；作用: 绑定请求内容和最终线路/剧集身份，供候选校验器执行精确比较。
        const target = {
          sourceId: requestRouteContext.sourceId,
          // 类型: string；作用: Provider 返回的标准 id 可以纠正旧搜索资源身份，后续历史和刷新路由统一使用该 id。
          contentId: response?.item?.id || requestRouteContext.contentId,
          lineId: responsePlayback.lineId || requestRouteContext.playbackSourceId,
          episodeId: responsePlayback.episodeId || requestRouteContext.episodeId
        };
        // 类型: Readonly<object>；作用: 严格校验内容、目录、线路、剧集和直连媒体，失败不替换旧媒体。
        const candidate = normalizePlaybackCandidate(response, target);
        // 类型: object|null；作用: 读取旧路由身份对应的精确历史，只有 Provider 返回了不同规范 id 时才进入迁移。
        const legacyHistoryRecord = !recoveryContext && candidate.contentItem.id !== requestRouteContext.contentId
          ? getHistoryRecord({
            sourceId: requestRouteContext.sourceId,
            contentId: requestRouteContext.contentId,
            type: candidate.contentItem.type,
            episodeId: requestRouteContext.episodeId,
            episodeIndex: requestRouteContext.episodeIndex,
            episode: candidate.episode
          })
          : null;
        // 条件分支: Provider 返回了规范 id 且旧历史存在时进入；执行内容: 在恢复位置计算前原子迁移历史/收藏，避免先按新键从头播放。
        if (legacyHistoryRecord && legacyHistoryRecord.contentId !== candidate.contentItem.id) {
          await rebindUserContent({
            recoveryKind: USER_CONTENT_RECOVERY_KIND.history,
            recoveryKey: legacyHistoryRecord.historyKey,
            contentItem: candidate.contentItem,
            episode: candidate.episode
          });
        }
        // 条件分支: 当前候选来自稳定用户记录恢复入口时进入；执行内容: 只在媒体和目录均通过校验后原子重绑定原记录。
        if (recoveryContext) {
          // 类型: object|null；作用: 成功结果证明收藏/历史已经采用当前内容与分集身份；null 表示原记录消失或事务拒绝。
          const recoveryResult = await commitUserContentRecovery(
            recoveryContext,
            candidate.contentItem,
            candidate.episode
          );
          // 条件分支: 用户记录未能完成双仓提交时进入；执行内容: 保持原播放器且不采用新路由和媒体。
          if (!recoveryResult) throw new Error('播放历史或收藏记录迁移失败');
        }
        // 类型: object|null；作用: 把 Provider 最终采用的线路和逻辑剧集写入可刷新播放 URL。
        const adoptedTarget = createPlayerNavigationTarget({
          sourceId: candidate.contentItem.sourceId,
          contentId: candidate.contentItem.id,
          episodeId: candidate.episode.id,
          episodeIndex: resolveEpisodeIndex(candidate.episode),
          playbackSourceId: candidate.line.id,
          autoplay: requestRouteContext.autoplay === true
        }, requestRouteContext.query || {});
        // 条件分支: 最终身份无法构造严格播放器目标时进入；执行内容: 拒绝采用没有刷新事实的媒体。
        if (!adoptedTarget) throw new Error('已采用播放身份无法生成刷新地址');
        // 类型: object|null；作用: 使用 Router 解析最终地址，避免手工拼接 query 造成身份漂移。
        const adoptedRouteContext = createPlayerRouteContext(this.$router.resolve(adoptedTarget)?.route);
        // 条件分支: Router 无法解析最终地址时进入；执行内容: 候选保持失败，不替换旧媒体。
        if (!adoptedRouteContext) throw new Error('已采用播放身份无法解析路由');
        // 类型: object|null；作用: 计算当前候选逻辑剧集的恢复位置，近尾提示期间旧媒体继续存在。
        const resumeState = await this.resolveResumeStateForTarget(
          candidate.contentItem,
          candidate.episode,
          requestRouteContext.autoplay,
          this._mediaHandoffGeneration
        );
        // 条件分支: 当前页已被更晚候选取代或用户取消恢复决策时进入；执行内容: 保持旧媒体和历史。
        if (!resumeState || generation !== this._playerLoadGeneration) return false;

        // 条件分支: 已存在旧媒体时进入；执行内容: 先封存其最后稳定会话并等待真实持久化事务完成。
        if (this.adoptedMedia) {
          // 类型: boolean；作用: 表示旧媒体历史是否已经完成交接，失败时禁止替换当前播放器。
          const finalized = await this.finalizeForMediaHandoff();
          // 条件分支: 旧历史提交失败时进入；执行内容: 中止采用候选，旧媒体和已采用身份继续保留。
          if (!finalized || generation !== this._playerLoadGeneration) {
            this._isMediaHandoffCommitting = false;
            return false;
          }
        }

        // 异步副作用: 先把成功候选写入可刷新 Router；路由 watcher 会识别该内部 fullPath 并只采用上下文。
        await this.commitAdoptedRoute(adoptedRouteContext);
        // 副作用: 候选已经通过身份、媒体、恢复和旧历史交接，现可一次性采用内容和媒体事实。
        this.adoptPlaybackCandidate(candidate, resumeState);
        // 副作用: 当前严格路由成为已采用播放事实，后续普通页面切换不再参与播放器计算。
        return true;
      } catch (error) {
        // 失败补偿: 路由或媒体采用没有完成时恢复旧播放器事件处理，旧媒体继续维护自己的历史。
        this._isMediaHandoffCommitting = false;
        // 条件分支: 没有旧媒体时进入；执行内容: 写入整页安全错误并保持空播放器。
        if (generation === this._playerLoadGeneration && !this.adoptedMedia) {
          this.loadError = error?.message || '播放数据加载失败';
        }
        return false;
      } finally {
        // 条件分支: 当前请求仍是最新代次时进入；执行内容: 关闭页面级 loading，不影响候选状态的安全提示。
        if (generation === this._playerLoadGeneration) {
          this.loading = false;
        }
      }
    },

    /**
     * 重试当前严格播放请求。
     * 副作用: 复用当前已采用的播放路由身份重新请求 Provider，不清空历史或创建备用播放器。
     * 失败路径: 一级播放入口没有内容身份时保持空状态，不发起请求。
     *
     * @returns {Promise<void>} 当前播放请求完成后结束。
     */
    retryPlayerContent() {
      // 条件分支: 当前是无身份播放入口时进入；执行内容: 保持入口动作，不构造无目标请求。
      if (this.isPlayerEntry) {
        return Promise.resolve();
      }
      return this.loadPlayerContent();
    },

    /**
     * 从播放空状态进入搜索页。
     * 副作用: 只调用 Vue Router，不触碰播放会话或用户内容。
     *
     * @returns {Promise<void>} 导航完成后结束。
     */
    navigateToSearch() {
      return this.navigateFromEmptyState({ name: 'search' });
    },

    /**
     * 从播放空状态返回首页。
     * 副作用: 只调用 Vue Router，不停止常驻播放器已有会话。
     *
     * @returns {Promise<void>} 导航完成后结束。
     */
    navigateToHome() {
      return this.navigateFromEmptyState({ name: 'home' });
    },

    /**
     * 执行播放空状态导航。
     * 副作用: 调用 Vue Router push；重复导航忽略，其他错误继续抛出。
     *
     * @param {object} target Vue Router 命名导航目标。
     * @returns {Promise<void>} 导航完成后结束。
     */
    navigateFromEmptyState(target) {
      return this.$router.push(target).catch((error) => {
        // 条件分支: Router 报告目标与当前地址重复时进入；执行内容: 把正常重复点击收敛为已完成。
        if (error && error.name === 'NavigationDuplicated') {
          return undefined;
        }
        throw error;
      });
    },

    /**
     * 提交已经验证的播放路由目标。
     * 副作用: 只在候选成功路径调用 Router replace；内部 fullPath 被守卫识别后不会再次请求 Provider。
     * 成功路径: 当前地址更新为分集、线路和自动播放意图对应的严格播放地址。
     * 失败路径: Router 错误抛回候选流程，调用方保持旧媒体和旧路由事实。
     *
     * @param {object} routeContext 已验证候选对应的标准播放路由上下文。
     * @returns {Promise<void>} Router 采用完成后结束。
     */
    async commitAdoptedRoute(routeContext) {
      // 类型: object|null；作用: 使用已标准化上下文构造可刷新目标，不重新解释 Provider 字段。
      const target = createPlayerNavigationTarget({
        sourceId: routeContext?.sourceId || '',
        contentId: routeContext?.contentId || '',
        episodeId: routeContext?.episodeId || '',
        episodeIndex: routeContext?.episodeIndex,
        playbackSourceId: routeContext?.playbackSourceId || '',
        autoplay: routeContext?.autoplay === true
      }, routeContext?.query || {});
      // 条件分支: 目标无法构造时进入；执行内容: 失败关闭，不把无身份 URL 写入 Router。
      if (!target) throw new Error('已采用播放路由目标无效');

      // 类型: object；作用: 从 Router 解析结果取得最终 fullPath 和标准 route 对象，避免手工拼接 URL。
      const resolvedRoute = this.$router.resolve(target)?.route;
      // 条件分支: Router 无法解析目标时进入；执行内容: 让候选流程保持旧媒体。
      if (!resolvedRoute) throw new Error('已采用播放路由无法解析');
      // 类型: string；作用: 标记本次内部交接地址，watcher 只采用上下文而跳过重复 Provider 请求。
      this._internalRouteFullPath = resolvedRoute.fullPath;

      try {
        // 条件分支: 目标已经是当前地址时进入；执行内容: 不产生重复导航，直接采用标准上下文。
        if (resolvedRoute.fullPath !== this.$route.fullPath) {
          await this.$router.replace(target);
        }
        // 状态交接: Router 成功后由同一解析器创建实际活动上下文，供刷新和普通路由隔离使用。
        this.playerRouteContext = createPlayerRouteContext(resolvedRoute);
      } finally {
        // 清理内部标记，后续真实外部播放地址仍然按正常请求守卫处理。
        this._internalRouteFullPath = '';
      }
    },

    /**
     * 请求并交接共享目录选择的候选媒体。
     * 副作用: 只更新候选 pending；Provider 响应成功前不改播放线路、路由或历史，也不显示过程提示。
     * 成功路径: 交给 loadPlayerContent 执行媒体校验、恢复、旧进度封存、路由提交和新媒体采用，再发布成功终态。
     * 失败路径: 旧播放器和 playingLineId 保持，交接结束后发布失败终态。
     *
     * @param {object} line 目标播放线路。
     * @param {object} episode 目标逻辑剧集。
     * @param {boolean} autoplay 是否继承自动播放意图。
     * @returns {Promise<void>} 候选交接完成后结束。
     */
    async requestMediaHandoff(line, episode, autoplay) {
      // 条件分支: 线路、剧集或当前内容身份缺失时进入；执行内容: 不发起无法归属的 Provider 请求。
      if (!line?.id || !episode?.id || !this.video?.sourceId || !this.video?.id) return;
      // 类型: number；作用: 让本次用户明确选择成为唯一可采用候选代次。
      const handoffGeneration = Number(this._mediaHandoffGeneration || 0) + 1;
      this._mediaHandoffGeneration = handoffGeneration;
      this.handoffPending = true;
      // 状态交接: 新切换开始时清除上一终态；解析期间模板保持空白，只通过 pending 禁止重复命令。
      this.catalogOutcome = createPlayCatalogOutcome();

      try {
        // 类型: object|null；作用: 从标准目录剧集序号构造可刷新候选目标。
        const target = createPlayerNavigationTarget({
          sourceId: this.video.sourceId,
          contentId: this.video.id,
          episodeId: episode.id,
          episodeIndex: resolveEpisodeIndex(episode),
          playbackSourceId: line.id,
          autoplay: Boolean(autoplay)
        }, this.playerRouteContext?.query || {});
        // 条件分支: 统一导航服务拒绝目标时进入；执行内容: 保持旧媒体并结束 pending。
        if (!target) {
          this.catalogOutcome = createPlayCatalogOutcome(
            PLAY_CATALOG_OUTCOME_KIND.error,
            PLAY_CATALOG_OUTCOME_MESSAGE.handoffFailed
          );
          return;
        }
        // 类型: object；作用: Router 解析目标后交给统一请求流程，不手工拼接 fullPath 或查询字符串。
        const routeContext = createPlayerRouteContext(this.$router.resolve(target)?.route);
        // 条件分支: 路由上下文无效时进入；执行内容: 不请求 Provider。
        if (!routeContext) {
          this.catalogOutcome = createPlayCatalogOutcome(
            PLAY_CATALOG_OUTCOME_KIND.error,
            PLAY_CATALOG_OUTCOME_MESSAGE.handoffFailed
          );
          return;
        }
        // 类型: boolean；作用: 区分真实采用成功与旧媒体仍存在的失败结果，终态只能在请求结束后发布。
        const adopted = await this.loadPlayerContent(routeContext);
        // 条件分支: 本次仍是最后一次选择时进入；执行内容: 根据真实采用结果一次性发布成功或失败终态。
        if (handoffGeneration === this._mediaHandoffGeneration) {
          this.catalogOutcome = adopted
            ? createPlayCatalogSuccessOutcome(line, episode)
            : createPlayCatalogOutcome(
              PLAY_CATALOG_OUTCOME_KIND.error,
              PLAY_CATALOG_OUTCOME_MESSAGE.handoffFailed
            );
        }
      } finally {
        // 条件分支: 当前组件仍属于本次候选代次时进入；执行内容: 解除候选禁用，终态保持到下一次用户切换。
        if (handoffGeneration === this._mediaHandoffGeneration) {
          this.handoffPending = false;
        }
      }
    },

    /**
     * 处理共享目录发出的浏览线路意图。
     * 副作用: 立即更新浏览线路；只有目标线路精确包含当前逻辑剧集时才启动候选媒体交接。
     * 成功路径: 同集候选成功后自动切线；缺集、不可用或失败时旧媒体、播放线路和历史保持。
     * 失败路径: 无效目标不改变任何页面状态。
     *
     * @param {string} lineId 用户选择的线路 id。
     * @returns {Promise<void>} 浏览决策和可选候选交接完成后结束。
     */
    async handleBrowsedLineChange(lineId) {
      // 条件分支: 当前已有候选交接时进入；执行内容: 拒绝并发选择，避免多个结果争夺同一播放器。
      if (this.handoffPending) return;
      // 类型: Readonly<object>；作用: 按稳定线路 id 判断浏览、缺集和同集候选决策。
      const decision = decideBrowsedLineChange(this.playCatalog, {
        lineId,
        playingEpisodeId: this.playingEpisodeId
      });
      // 状态交接: 每次明确线路命令先清空旧终态；纯决策同步结束后再决定是否发布失败结果。
      this.catalogOutcome = createPlayCatalogOutcome();
      // 条件分支: 线路身份无效时进入；执行内容: 保留当前浏览线路和实际播放状态并发布失败终态。
      if (!decision.line) {
        this.catalogOutcome = createPlayCatalogOutcome(
          PLAY_CATALOG_OUTCOME_KIND.error,
          PLAY_CATALOG_OUTCOME_MESSAGE.handoffFailed
        );
        return;
      }

      this.browsedLineId = decision.line.id;
      // 条件分支: 目标不能自动解析当前同集时进入；执行内容: 只展示目标目录并发布已经完成的失败终态。
      if (!decision.shouldResolveMedia) {
        this.catalogOutcome = resolvePlayCatalogFailureOutcome(decision);
        return;
      }
      await this.requestMediaHandoff(
        decision.line,
        decision.episode,
        this.isMediaActivelyPlaying || this.routeShouldAutoPlay
      );
    },

    /**
     * 处理共享目录发出的手动选集意图。
     * 副作用: 先验证用户明确目标，再按候选请求、旧历史提交和新媒体采用顺序执行。
     * 成功路径: 已有该集历史时恢复该集进度，没有历史时从头创建新会话；线路 Chip 只在成功采用后更新。
     * 失败路径: 旧播放器、旧路由、旧线路和旧历史保持不变。
     *
     * @param {object} target 共享目录发出的线路和逻辑剧集目标。
     * @returns {Promise<void>} 候选交接完成后结束。
     */
    async handleEpisodeSelection(target) {
      // 条件分支: 当前已有交接或目标缺失时进入；执行内容: 忽略重复或不完整的用户意图。
      if (this.handoffPending || !target) return;
      // 类型: Readonly<object>；作用: 只信任组件事件中的稳定身份，再由服务读取目录真实对象。
      const decision = decideManualEpisodeSelection(this.playCatalog, {
        lineId: target.lineId,
        episodeId: target.episodeId
      });
      // 状态交接: 每次明确选集命令先清空旧终态，候选请求期间不显示过程信息。
      this.catalogOutcome = createPlayCatalogOutcome();
      // 条件分支: 目标无法进入候选媒体解析时进入；执行内容: 发布失败终态并保持旧媒体。
      if (!decision.shouldResolveMedia || !decision.line || !decision.episode) {
        this.catalogOutcome = resolvePlayCatalogFailureOutcome(decision);
        // 条件分支: 选择服务返回无效目标等没有专属文案的失败时进入；执行内容: 发布统一交接失败终态。
        if (!this.catalogOutcome.message) {
          this.catalogOutcome = createPlayCatalogOutcome(
            PLAY_CATALOG_OUTCOME_KIND.error,
            PLAY_CATALOG_OUTCOME_MESSAGE.handoffFailed
          );
        }
        return;
      }
      this.browsedLineId = decision.line.id;
      await this.requestMediaHandoff(decision.line, decision.episode, true);
    },

    /**
     * 切换当前播放内容收藏状态。
     * 触发来源: 播放页右侧收藏按钮点击。
     * 副作用: 等待 userContentService 完成 Repository 收藏事务和统一 store 采用。
     * 成功路径: selector 响应式更新后按钮自动显示新状态。
     * 失败路径: 展示安全提示并保持旧按钮状态，不创建页面本地覆盖。
     *
     * @returns {Promise<void>} 收藏事务完成或失败提示展示后结束。
     */
    async handleToggleFavorite() {
      // 条件分支: 当前播放内容缺失时进入。
      // 执行内容: 不写入收藏状态，避免生成无效收藏记录。
      if (!this.video) {
        return;
      }

      try {
        // 异步调用: Repository 提交成功后 service 才采用 store；结果无需另存页面状态。
        await toggleFavorite(this.video);
      } catch {
        // 失败处理: 页面继续读取旧 selector 投影，只展示安全文案。
        this.$message.error('收藏状态保存失败，请稍后重试');
      }
    },

    /**
     * 采用播放器适配组件发布的稳定媒体会话。
     * 触发来源: XgplayerMediaPlayer session-event。
     * 副作用: 替换页面运行态，并交给媒体进度协调器更新 currentPlaying 或按检查点提交历史。
     * 失败路径: 空输入回退 idle；协调错误或历史事务失败通过统一提示收敛，最近已提交历史保持不变。
     *
     * @param {object|null} session MediaPlaybackSessionState。
     * @returns {void} 状态通过 Vue 响应式投影更新。
     */
    handleMediaSessionEvent(session) {
      // 条件分支: 候选已进入旧进度最终提交窗口时进入；执行内容: 拒绝旧播放器普通事件重新打开已关闭会话。
      if (this._isMediaHandoffCommitting) return;
      // 条件分支: 子组件没有提供对象时进入。
      // 执行内容: 采用新的 idle 对象，不保留旧播放阶段。
      if (!session || typeof session !== 'object' || Array.isArray(session)) {
        this.mediaSessionState = createIdleMediaPlaybackSession();
        return;
      }

      // 条件分支: 会话身份不属于当前已经采用的内容、剧集或线路时进入；执行内容: 丢弃旧组件迟到事件。
      if (session.sourceId !== this.video?.sourceId
        || session.contentId !== this.video?.id
        || session.episodeId !== this.playingEpisodeId
        || session.playbackSourceId !== this.playingLineId) {
        return;
      }

      // 副作用: 采用子组件已经冻结和校验的稳定会话；不保存 xgplayer 实例。
      this.mediaSessionState = session;

      try {
        // 类型: Promise<Array<*>>|null；作用: 保存本次媒体事件可能触发的历史事务，页面只观察结果而不建立补写队列。
        const operation = this._mediaPlaybackProgressService.handleSession(
          session,
          this.mediaProgressContext
        );
        this.trackMediaPersistenceOperation(operation);
      } catch (error) {
        // 失败处理: 同步身份或契约错误使用同一持久化失败入口提示，不修改已提交历史。
        this.reportMediaPersistenceFailure(error);
      }
    },

    /**
     * 处理播放器实例释放前的最终媒体快照。
     * 触发来源: XgplayerMediaPlayer session-finalize。
     * 副作用: 使用更接近销毁时刻的真实秒数强制最终提交并清空 currentPlaying。
     * 失败路径: 已由路由 watcher 终结的会话幂等忽略；同步校验或异步保存失败走统一提示。
     *
     * @param {object} session 释放前 MediaPlaybackSessionState。
     * @returns {void} 最终事务由观察方法异步收敛。
     */
    handleMediaSessionFinalization(session) {
      try {
        // 类型: Promise<Array<*>>|null；作用: 保存适配组件最终快照触发的历史事务。
        const operation = this._mediaPlaybackProgressService.finalize(session);
        this.trackMediaPersistenceOperation(operation);
      } catch (error) {
        // 失败处理: 最终快照校验失败时保留最近已提交历史并提示一次。
        this.reportMediaPersistenceFailure(error);
      }
    },

    /**
     * 终结进度协调器当前会话。
     * 触发来源: 严格播放身份变化后的媒体交接，以及常驻 PlayerView 随 App 真正销毁。
     * 副作用: 对已实际播放会话强制 paused 最终提交并立即清空 currentPlaying。
     * 失败路径: 没有活动会话时幂等返回；保存失败走统一提示，不阻塞路由或卸载。
     *
     * @returns {void} 最终事务由观察方法异步收敛。
     */
    finalizeMediaPlaybackProgress() {
      // 条件分支: created 尚未建立协调器时进入；执行内容: 幂等结束，不清理未知页面状态。
      if (!this._mediaPlaybackProgressService) {
        return;
      }
      try {
        // 类型: Promise<Array<*>>|null；作用: 保存当前协调器可能触发的最终历史事务。
        const operation = this._mediaPlaybackProgressService.finalize();
        this.trackMediaPersistenceOperation(operation);
      } catch (error) {
        // 失败处理: 同步最终提交错误交给统一一次性提示。
        this.reportMediaPersistenceFailure(error);
      }
    },

    /**
     * 观察媒体历史事务结果。
     * 副作用: 成功后复位失败提示闸门；失败时报告一次，不创建重试、轮询或第二写队列。
     * 成功路径: Promise resolve 后允许未来独立失败再次提示。
     * 失败路径: Promise reject 交给 reportMediaPersistenceFailure，Repository/store 保持最近已提交历史。
     *
     * @param {Promise<*>|null} operation 进度协调器返回的真实历史事务或空操作。
     * @returns {void} 结果通过页面提示闸门表达。
     */
    trackMediaPersistenceOperation(operation) {
      // 条件分支: 当前媒体事件没有触发长期历史事务时进入；执行内容: 不创建无意义 Promise 链。
      if (!operation || typeof operation.then !== 'function') {
        return;
      }
      operation.then(() => {
        // 副作用: 新历史事务成功后关闭连续失败状态，未来独立失败可以重新提示用户。
        this._mediaPersistenceFailureActive = false;
      }).catch((error) => {
        // 失败处理: 只观察 userContentService 返回结果，不自行补写失败检查点。
        this.reportMediaPersistenceFailure(error);
      });
    },

    /**
     * 收敛媒体进度保存失败。
     * 副作用: 每段连续失败只展示一次 Element 消息，并保持失败闸门直到后续真实事务成功。
     *
     * @param {Error|*} error 协调校验或历史事务错误，仅用于开发控制台诊断。
     * @returns {void} 不修改媒体会话或用户内容投影。
     */
    reportMediaPersistenceFailure(error) {
      // 条件分支: 当前连续失败已经提示过时进入；执行内容: 避免每个后续检查点重复打扰用户。
      if (this._mediaPersistenceFailureActive) {
        return;
      }
      this._mediaPersistenceFailureActive = true;
      // 诊断副作用: 控制台保留原始错误供本地排查，页面消息不暴露数据库内部细节。
      console.error('媒体播放进度保存失败', error);
      this.$message.error('播放进度保存失败，最近一次已保存记录不受影响');
    },

    /**
     * 处理播放器插件发出的页面级快捷键命令。
     * 触发来源: ProjectShortcutPlugin previousEpisode/nextEpisode。
     * 副作用: 委托 selectRelativeEpisode 生成新的播放器路由，不直接修改分集选中状态。
     * 失败路径: 未知命令忽略，避免第三方插件扩张页面能力。
     *
     * @param {string} action PLAYBACK_SHORTCUT_ACTION 命令。
     * @returns {void} 导航 Promise 由既有选择方法收敛。
     */
    handlePlaybackShortcutCommand(action) {
      // 条件分支: 命令是上一集时进入。
      // 执行内容: 使用集中负方向选择当前分集前一项。
      if (action === PLAYBACK_SHORTCUT_ACTION.previousEpisode) {
        this.selectRelativeEpisode(EPISODE_NAVIGATION_DIRECTION.previous);
        return;
      }

      // 条件分支: 命令是下一集时进入。
      // 执行内容: 使用集中正方向选择当前分集后一项。
      if (action === PLAYBACK_SHORTCUT_ACTION.nextEpisode) {
        this.selectRelativeEpisode(EPISODE_NAVIGATION_DIRECTION.next);
      }
    },

    /**
     * 按相对方向选择分集。
     * 副作用: 命中相邻分集时委托 selectEpisode 执行 Router replace；不写本地选中状态。
     * 成功路径: 当前分集和目标下标都有效时切换。
     * 失败路径: 单集、边界外或当前分集无法定位时返回 false Promise。
     *
     * @param {number} direction EPISODE_NAVIGATION_DIRECTION 偏移。
     * @returns {Promise<boolean>} 路由发生替换时为 true，否则为 false。
     */
    selectRelativeEpisode(direction) {
      // 类型: number。
      // 作用: 按当前实际播放线路的逻辑剧集 id 定位当前数组下标，快捷键不跨浏览线路猜测。
      const currentIndex = this.playingEpisodes.findIndex((episode) => episode?.id === this.playingEpisodeId);

      // 类型: number。
      // 作用: 计算目标分集下标；方向只由集中常量传入。
      const targetIndex = currentIndex + direction;

      // 条件分支: 当前分集未命中或目标超出列表边界时进入。
      // 执行内容: 返回 false，不循环跳集，也不选择不存在的分集。
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= this.playingEpisodes.length) {
        return Promise.resolve(false);
      }

      // 返回值类型: Promise<boolean>。
      // 作用: 复用现有分集选择和统一路由构造链。
      return this.handleEpisodeSelection({
        lineId: this.playingLineId,
        episodeId: this.playingEpisodes[targetIndex]?.id
      });
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 播放页根容器 .player-view。
  样式作用:
  桌面占满 App.vue 播放主体并关闭页面级滚动。
  移动端由媒体查询恢复内部纵向滚动。
*/
.player-view {
  /* 占满播放主体宽度。 */
  width: 100%;
  /* 占满导航和页脚之间的高度。 */
  height: 100%;
  /* 允许左右两列在紧凑桌面横向收缩。 */
  min-width: 0;
  /* 允许两个独立纵向布局在固定播放外壳中收缩。 */
  min-height: 0;
  /* 把内边距纳入尺寸计算。 */
  box-sizing: border-box;
  /* 桌面只允许右侧线路和分集列表内部滚动。 */
  overflow: hidden;
  /* 使用播放页深色背景。 */
  background: linear-gradient(180deg, #111c2e 0%, #101827 100%);
  /* 提供紧凑桌面安全距离。 */
  padding: 18px 24px;
  /* 深色页面使用浅色文字。 */
  color: #f8fafc;
}

/*
  作用容器: 播放页双列外壳 .player-shell。
  样式作用:
  桌面只负责划分左侧主播放列和右侧操作列。
  让两列分别管理自己的纵向行高，避免顶部区域互相绑定。
*/
.player-shell {
  /* 使用 Grid 建立两个职责独立的桌面列。 */
  display: grid;
  /* 左列消费剩余空间，右列按视口在 320px 到 520px 之间响应式变化。 */
  grid-template-columns: minmax(0, 1fr) clamp(320px, 30vw, 520px);
  /* 设置左右列间距，保持播放器和操作面板边界清晰。 */
  gap: 24px;
  /* 占满播放页可用高度。 */
  height: 100%;
  /* 允许左右列收缩。 */
  min-width: 0;
  /* 允许两列内部的剩余高度轨道收缩。 */
  min-height: 0;
}

/*
  作用容器: 左侧主播放列 .player-main-column。
  样式作用:
  桌面独立排列内容信息和播放器。
  让播放器消费信息面板之外的全部剩余高度，不受右侧线路区域高度影响。
*/
.player-main-column {
  /* 使用独立 Grid 管理左列两块内容。 */
  display: grid;
  /* 内容信息按自身高度生成，播放器消费剩余高度。 */
  grid-template-rows: max-content minmax(0, 1fr);
  /* 明确桌面左列顺序，供移动端在同一容器内安全重排。 */
  grid-template-areas: "meta" "player";
  /* 保持信息面板和播放器之间的纵向分隔。 */
  gap: 16px;
  /* 允许左列随父级轨道横向收缩。 */
  min-width: 0;
  /* 允许播放器轨道在固定视口高度中收缩。 */
  min-height: 0;
}

/*
  作用容器: 右侧播放操作列 .player-side-column。
  样式作用:
  桌面独立排列线路列表和分集列表。
  使用相对高度分配保持两个操作区同时可见，并让各自列表独立滚动。
*/
.player-side-column {
  /* 使用独立 Grid 管理共享播放目录组件。 */
  display: grid;
  /* 共享目录消费右侧全部可用高度，线路和选集由同一组件内部自然排版。 */
  grid-template-rows: minmax(0, 1fr);
  /* 保留组件与播放列之间的稳定距离。 */
  gap: 0;
  /* 允许右列随响应式宽度轨道收缩。 */
  min-width: 0;
  /* 允许两个列表在固定视口高度中建立内部滚动。 */
  min-height: 0;
}

/*
  作用容器: 播放器舞台 .player-surface。
  样式作用:
  桌面填满左下区域，移动端移动到页面最上方。
*/
.player-surface {
  /* 放入左侧主播放列的 player 区域。 */
  grid-area: player;
  /* 填满所在区域宽度。 */
  width: 100%;
  /* 桌面填满第二行高度。 */
  height: 100%;
  /* 允许随剩余高度收缩。 */
  min-height: 0;
  /* 允许横向收缩。 */
  min-width: 0;
  /* 使用 flex 居中播放状态。 */
  display: flex;
  /* 垂直居中。 */
  align-items: center;
  /* 水平居中。 */
  justify-content: center;
  /* 使用播放器黑色背景。 */
  background: #05070b;
  /* 使用弱边框区分舞台。 */
  border: 1px solid rgba(148, 163, 184, .14);
  /* 裁切未来播放器画面溢出。 */
  overflow: hidden;
}

/*
  作用容器: 无播放线路空状态 .player-media-empty。
  样式作用: 填满稳定播放器舞台，不因数据为空改变左右列尺寸。
*/
.player-media-empty {
  /* 填满播放器舞台宽度。 */
  width: 100%;
  /* 填满播放器舞台高度。 */
  height: 100%;
}

/*
  作用容器: 内容信息面板 .player-meta-panel。
  样式作用:
  在左列顶部组织内容身份、播放上下文和收藏操作。
  通过命名区域保证长标题和来源文本不会挤出收藏按钮。
*/
.player-meta-panel {
  /* 放入左侧主播放列的 meta 区域。 */
  grid-area: meta;
  /* 使用 Grid 让身份与上下文位于左侧、收藏操作稳定停靠右侧。 */
  display: grid;
  /* 左列允许文本收缩，右列只占收藏按钮实际宽度。 */
  grid-template-columns: minmax(0, 1fr) auto;
  /* 身份区域占满首行，上下文位于左下，收藏操作固定在右下。 */
  grid-template-areas: "identity identity" "context favorite";
  /* 让第二行上下文 Chip 和收藏按钮沿信息框底部对齐。 */
  align-items: end;
  /* 设置身份、上下文和收藏之间的行列间距。 */
  gap: 12px 20px;
  /* 提供面板内边距。 */
  padding: 16px 18px;
  /* 使用统一深色面板底。 */
  background: rgba(9, 15, 26, .82);
  /* 使用弱边框。 */
  border: 1px solid rgba(148, 163, 184, .16);
  /* 允许左侧文本轨道随主播放列收缩。 */
  min-width: 0;
}

/*
  作用容器: 内容身份区域 .player-meta-identity。
  样式作用:
  横向排列视频标题和内容类型。
  空间不足时允许类型标签换到标题下一行，不反向撑宽主播放列。
*/
.player-meta-identity {
  /* 放入内容信息面板的身份区域。 */
  grid-area: identity;
  /* 使用 flex 横向组织标题和类型标签。 */
  display: flex;
  /* 按文本基线对齐两种字号。 */
  align-items: baseline;
  /* 允许标题过长时把类型标签换到下一行。 */
  flex-wrap: wrap;
  /* 保持标题和类型之间的横向与纵向间距。 */
  gap: 8px 12px;
  /* 允许内容身份区域横向收缩。 */
  min-width: 0;
}

/*
  作用容器: 视频标题 .player-title。
  样式作用:
  强化当前播放内容名称，并允许长标题在身份区域安全断行。
*/
.player-title {
  /* 清除标题默认边距。 */
  margin: 0;
  /* 使用响应式标题字号。 */
  font-size: clamp(22px, 2vw, 30px);
  /* 控制长标题行高。 */
  line-height: 1.18;
  /* 加粗内容名称。 */
  font-weight: 750;
  /* 使用浅色标题。 */
  color: #f8fafc;
  /* 只按标题真实内容和可用宽度伸缩，让类型标签紧接标题而不是停靠右侧。 */
  flex: 0 1 auto;
  /* 清除最小内容宽度。 */
  min-width: 0;
  /* 允许长标题安全断行。 */
  overflow-wrap: anywhere;
}

/*
  作用容器: 内容类型标签 .player-type-badge。
  样式作用:
  用稳定标签区分电影和电视剧，不参与标题宽度压缩。
*/
.player-type-badge {
  /* 使用内联 flex 居中文字。 */
  display: inline-flex;
  /* 垂直居中类型文字。 */
  align-items: center;
  /* 保持类型标签高度。 */
  min-height: 28px;
  /* 提供标签横向留白。 */
  padding: 0 10px;
  /* 使用主题蓝背景。 */
  background: rgba(91, 140, 255, .16);
  /* 使用主题蓝边框。 */
  border: 1px solid rgba(91, 140, 255, .3);
  /* 使用轻微圆角。 */
  border-radius: 6px;
  /* 使用浅蓝文字。 */
  color: #c9d8ff;
  /* 使用辅助字号。 */
  font-size: 13px;
  /* 保持类型自身宽度。 */
  flex: 0 0 auto;
  /* 禁止类型换行。 */
  white-space: nowrap;
}

/*
  作用容器: 播放上下文区域 .player-meta-context。
  样式作用:
  展示当前数据源、实际激活线路名称和最后一次切换终态。
  让 Chip 保持左侧内容流，最终结果在同一行剩余空间中右对齐。
*/
.player-meta-context {
  /* 放入内容信息面板的上下文区域。 */
  grid-area: context;
  /* 使用 flex 横向排列数据源和当前线路。 */
  display: flex;
  /* 让不同长度的上下文字段按首行垂直居中。 */
  align-items: center;
  /* 空间不足时允许字段换到下一行。 */
  flex-wrap: wrap;
  /* 保持 Chip 与最终结果之间的紧凑间距。 */
  gap: 8px 12px;
  /* 允许上下文区域随主播放列收缩。 */
  min-width: 0;
}

/*
  作用容器: 播放上下文 Chip .player-context-chip。
  样式作用:
  把数据源和当前线路显示为可扫描的胶囊标签。
  长文本在 Chip 边界内省略，避免反向撑宽内容信息面板。
*/
.player-context-chip {
  /* 使用内联 flex 垂直居中 Chip 文本。 */
  display: inline-flex;
  /* 垂直居中数据源或当前线路文案。 */
  align-items: center;
  /* 允许 Chip 在信息面板宽度不足时收缩。 */
  flex: 0 1 auto;
  /* 清除文本默认最小内容宽度，允许 Chip 安全收缩。 */
  min-width: 0;
  /* 限制 Chip 不超过上下文区域宽度。 */
  max-width: 100%;
  /* 保持紧凑 Chip 高度，避免信息框重新变得臃肿。 */
  min-height: 26px;
  /* 提供胶囊标签所需的横向安全留白。 */
  padding: 0 9px;
  /* 使用低饱和蓝色背景区分普通说明文本。 */
  background: rgba(91, 140, 255, .12);
  /* 使用弱蓝色边框强化 Chip 边界。 */
  border: 1px solid rgba(91, 140, 255, .24);
  /* 使用胶囊圆角形成上下文字段标签。 */
  border-radius: 999px;
  /* 使用浅蓝灰颜色降低上下文相对标题的视觉层级。 */
  color: #b9c8de;
  /* 使用紧凑辅助字号保持信息框密度。 */
  font-size: 13px;
  /* 隐藏超过 Chip 最大宽度的长上下文文案。 */
  overflow: hidden;
  /* 使用省略号提示数据源或线路名称被截断。 */
  text-overflow: ellipsis;
  /* 保持单个 Chip 文案单行，稳定上下文行高度。 */
  white-space: nowrap;
  /* 把内边距与边框纳入 Chip 高度和宽度计算。 */
  box-sizing: border-box;
}

/*
  作用容器: 收藏操作 .player-favorite-button。
  样式作用:
  桌面固定在内容信息面板右侧并跨越两行信息。
  保持按钮完整触控宽度，不被标题或来源文本压缩。
*/
.player-favorite-button {
  /* 放入内容信息面板的收藏区域。 */
  grid-area: favorite;
  /* 保持按钮自身宽度，不拉伸填满右侧轨道。 */
  justify-self: end;
  /* 沿信息面板第二行底部对齐，形成右下角收藏操作。 */
  align-self: end;
}

/*
  作用容器: 播放线路面板 .player-lines-panel。
  样式作用:
  桌面位于右侧操作列顶部并独立管理线路列表滚动。
  固定标题与线路网格职责，避免线路数量改变播放器布局。
*/
.player-lines-panel {
  /* 放入右侧操作列的 lines 区域。 */
  grid-area: lines;
  /* 使用 flex 纵向组织区域标题和线路网格。 */
  display: flex;
  /* 让标题和线路列表从上到下排列。 */
  flex-direction: column;
  /* 保持区域标题和线路网格之间的距离。 */
  gap: 14px;
  /* 提供面板内边距。 */
  padding: 16px;
  /* 把内边距纳入右侧操作列的轨道高度。 */
  box-sizing: border-box;
  /* 使用统一深色面板底。 */
  background: rgba(9, 15, 26, .82);
  /* 使用弱边框。 */
  border: 1px solid rgba(148, 163, 184, .16);
  /* 允许横向收缩。 */
  min-width: 0;
  /* 允许线路网格在固定右侧轨道中建立内部滚动。 */
  min-height: 0;
}

/*
  作用容器: 线路和分集共用列表 .player-option-grid。
  样式作用:
  桌面按按钮内容自然宽度从左上角换行排列，完整显示不同长度的线路和分集名称。
  列表超出面板高度时各自在所属面板内部滚动，不反向改变右侧操作列宽度。
*/
.player-option-grid {
  /* 使用可换行 Flex 为不同内容长度的线路和分集建立同一排列体系。 */
  display: flex;
  /* 当前行空间不足时换到下一行，所有选项仍可在面板内访问。 */
  flex-wrap: wrap;
  /* 从面板左上角开始排列选项行，不把少量选项拉到面板中部。 */
  align-content: start;
  /* 让内容宽度按钮从左侧开始，不均摊面板剩余宽度。 */
  justify-content: start;
  /* 使用统一紧凑间距组织线路和分集按钮。 */
  gap: 8px;
  /* 消费标题之外的可用高度。 */
  flex: 1 1 auto;
  /* 允许共用网格随右侧操作列横向收缩。 */
  min-width: 0;
  /* 允许共用网格在固定面板轨道中纵向收缩。 */
  min-height: 0;
  /* 选项过多时只滚动当前所属列表，不推动相邻面板。 */
  overflow-y: auto;
  /* 给内部滚动条预留轻微距离，避免贴住按钮。 */
  padding-right: 2px;
}

/*
  作用容器: 线路和分集共用按钮 .player-option-chip。
  样式作用:
  统一两类按钮的默认背景、边框、字号、圆角和文本处理。
  长线路或分集名称在按钮边界内省略，不反向撑宽操作面板。
*/
.player-option-chip {
  /* 清除平台默认外观。 */
  appearance: none;
  /* 桌面按完整文字和内边距生成自然宽度，不再由固定轨道裁切内容。 */
  width: auto;
  /* 桌面保持统一 32px 紧凑行高，换行只增加列表行数。 */
  height: 32px;
  /* 允许极窄面板或异常长名称收缩到所属面板边界内。 */
  min-width: 0;
  /* 阻止异常长名称反向撑宽固定桌面操作列。 */
  max-width: 100%;
  /* 清除反向最小高度，严格服从共用按钮高度。 */
  min-height: 0;
  /* 提供稳定横向留白，让不同长度文字形成可辨认的自然宽度按钮。 */
  padding: 0 10px;
  /* 使用分集按钮的蓝色默认背景作为两类选项共同视觉。 */
  background: rgba(30, 58, 112, .55);
  /* 使用主题蓝弱边框统一两类选项轮廓。 */
  border: 1px solid rgba(91, 140, 255, .26);
  /* 使用缩小后的轻量圆角匹配 32px 桌面按钮高度。 */
  border-radius: 6px;
  /* 使用浅色文字保证深蓝背景上的可读性。 */
  color: #e5edff;
  /* 桌面统一使用比原按钮小一号的 12px 字体。 */
  font-size: 12px;
  /* 使用较粗字重强化紧凑按钮的可识别性。 */
  font-weight: 700;
  /* 使用 flex 同时居中线路和分集文字。 */
  display: flex;
  /* 水平居中选项文字。 */
  justify-content: center;
  /* 垂直居中选项文字。 */
  align-items: center;
  /* 隐藏超出按钮宽度的选项名称。 */
  overflow: hidden;
  /* 使用省略号提示线路或分集名称被截断。 */
  text-overflow: ellipsis;
  /* 保持选项名称单行，稳定共用按钮行高。 */
  white-space: nowrap;
  /* 提示按钮可点击。 */
  cursor: pointer;
  /* 把内边距和边框纳入按钮自然尺寸。 */
  box-sizing: border-box;
}

/*
  作用容器: 当前激活选项按钮 .player-option-chip.active。
  样式作用:
  使用同一主题蓝强调当前线路或当前分集。
  消除线路暖色和分集蓝色两套激活视觉之间的差异。
*/
.player-option-chip.active {
  /* 使用亮蓝色激活背景统一线路和分集选中态。 */
  background: rgba(59, 99, 180, .76);
  /* 增强激活边框，清晰区分当前选项和普通选项。 */
  border-color: rgba(91, 140, 255, .56);
  /* 使用浅色激活文字保证选中状态可读性。 */
  color: #f8fafc;
  /* 使用轻量内阴影强化激活按钮边界。 */
  box-shadow: inset 0 0 0 1px rgba(91, 140, 255, .1);
}

/*
  作用容器: 分集面板 .playlist-panel。
  样式作用:
  桌面填满右侧操作列下方轨道并独立管理分集滚动。
  移动端随页面内容自然展开，避免嵌套滚动影响触控操作。
*/
.playlist-panel {
  /* 放入右侧操作列的 playlist 区域。 */
  grid-area: playlist;
  /* 纵向组织标题和列表。 */
  display: flex;
  /* 设置内容纵向排列。 */
  flex-direction: column;
  /* 保持标题与列表间距。 */
  gap: 14px;
  /* 填满右侧操作列下方轨道。 */
  height: 100%;
  /* 允许随右侧下方轨道收缩。 */
  min-height: 0;
  /* 允许右列收缩。 */
  min-width: 0;
  /* 提供面板内边距。 */
  padding: 16px;
  /* 把内边距纳入尺寸。 */
  box-sizing: border-box;
  /* 使用统一面板背景。 */
  background: rgba(9, 15, 26, .82);
  /* 使用弱边框。 */
  border: 1px solid rgba(148, 163, 184, .16);
}

/*
  作用容器: 线路和分集区域标题 .player-panel-title。
  样式作用:
  统一右侧两个操作面板的标题层级和视觉基线。
  保持标题自身高度稳定，不参与列表内部滚动。
*/
.player-panel-title {
  /* 清除标题元素浏览器默认外边距。 */
  margin: 0;
  /* 使用统一操作区域标题字号。 */
  font-size: 19px;
  /* 使用较粗字重强化线路和分集区域边界。 */
  font-weight: 720;
  /* 使用浅色标题保证深色面板可读性。 */
  color: #f8fafc;
}

/*
  作用容器: 分集局部空状态 .playlist-empty。
  样式作用:
  在没有分集数据时消费面板剩余高度，并允许固定桌面轨道安全收缩。
*/
.playlist-empty {
  /* 消费标题之外的剩余高度。 */
  flex: 1 1 auto;
  /* 允许空状态收缩。 */
  min-height: 0;
}

/*
  作用容器: 播放页整页空状态 .player-page-empty。
  样式作用:
  在请求失败或没有播放内容时填满播放主体，并保持深色页面视觉。
*/
.player-page-empty {
  /* 占满播放页高度。 */
  height: 100%;
  /* 避免固定高度撑出外壳。 */
  min-height: 0;
  /* 使用深色空状态背景。 */
  background: rgba(9, 15, 26, .82);
  /* 使用弱边框。 */
  border: 1px solid rgba(148, 163, 184, .14);

  /* 让空状态说明和恢复动作在固定播放外壳内垂直居中。 */
  display: flex;

  /* 空状态内容按阅读顺序纵向排列。 */
  flex-direction: column;

  /* 为说明和操作区保留稳定间距。 */
  gap: 8px;

  /* 水平居中不改变播放器外壳的宽度分配。 */
  align-items: center;

  /* 让 Element UI 空状态本身位于可用播放舞台中央。 */
  justify-content: center;
}

/*
  作用容器: 播放目录最终切换结果 `.player-catalog-outcome`。
  样式作用:
  只显示已经完成的成功或失败结果，并在当前实际线路同行右端对齐。
  文案宽度不足时允许换行，不挤压数据源和线路 Chip，也不占据选集目录空间。
*/
.player-catalog-outcome {
  /* 清除段落默认外边距，并用自动左边距消费上下文行剩余空间。 */
  margin: 0 0 0 auto;
  /* 使用内联 Flex 让状态点和结果文案保持同一阅读基线。 */
  display: inline-flex;
  /* 让状态点与多行文案的首行垂直居中。 */
  align-items: center;
  /* 保留状态点与文案之间的稳定间距。 */
  gap: 7px;
  /* 限制结果不超过上下文区域，长文案在自身边界内换行。 */
  max-width: min(360px, 100%);
  /* 使用辅助字号，不抢夺视频标题和实际线路的视觉层级。 */
  font-size: 13px;
  /* 使用紧凑行高承载可能换行的失败说明。 */
  line-height: 1.4;
  /* 让结果文案在右侧区域保持右对齐。 */
  text-align: right;
}

/* 最终结果状态点使用固定圆形，不依赖文字字符模拟图标。 */
.player-catalog-outcome::before {
  /* 生成只承担视觉状态的空内容，真实结果仍由文本和 role=status 表达。 */
  content: '';
  /* 固定状态点尺寸，成功和失败切换时不改变信息行高度。 */
  width: 7px;
  /* 固定状态点尺寸，保持圆形比例。 */
  height: 7px;
  /* 阻止状态点被长文案压缩。 */
  flex: 0 0 7px;
  /* 使用圆形表达终态，不生成额外文字标签。 */
  border-radius: 50%;
}

/* 成功终态使用项目成功色，表示目标线路和选集已经成为实际播放事实。 */
.player-catalog-outcome.is-success {
  /* 使用浅绿色文字在深色信息面板中保持清晰但不过度抢眼。 */
  color: #86efac;
}

/* 成功终态状态点使用更高饱和成功色，便于快速扫描结果。 */
.player-catalog-outcome.is-success::before {
  /* 用绿色状态点表达实际采用成功。 */
  background: #22c55e;
}

/* 失败终态使用项目危险色，表示旧播放保持且本次目标未采用。 */
.player-catalog-outcome.is-error {
  /* 使用浅红色文字保证深色背景可读性。 */
  color: #fca5a5;
}

/* 失败终态状态点使用红色，不额外增加提示框或图标按钮。 */
.player-catalog-outcome.is-error::before {
  /* 用红色状态点表达本次切换失败。 */
  background: #ef4444;
}

/*
  作用容器: 播放侧栏中的共享目录宿主 .player-catalog-panel。
  样式作用:
  提供播放页侧栏背景、边界和独立滚动空间。
  不复制 PlayCatalogSelector 内部线路、状态和选集布局。
*/
.player-catalog-panel {
  /* 向共享目录组件提供深色播放宿主的标题色，不穿透或复制组件内部选择器。 */
  --play-catalog-title-color: #f8fafc;
  /* 向共享组件提供播放侧栏深色控件底色，详情页继续使用默认浅色变量。 */
  --play-catalog-control-background: rgba(18, 29, 47, .98);
  /* 向共享组件提供普通选集和当前线路的弱深色底，避免出现突兀白色按钮。 */
  --play-catalog-control-background-muted: rgba(31, 47, 72, .82);
  /* 向共享组件提供深色侧栏弱边框，统一下拉、Chip 和选集轮廓。 */
  --play-catalog-control-border: rgba(148, 163, 184, .28);
  /* 向共享组件提供主要浅色文字，保证线路与选集在深色侧栏可读。 */
  --play-catalog-text-color: #e5edff;
  /* 向共享组件提供空态辅助文字，降低相对标题的视觉层级。 */
  --play-catalog-muted-color: #94a3b8;
  /* 向共享组件提供统一蓝色强调边框。 */
  --play-catalog-accent-color: #5b8cff;
  /* 向共享组件提供选中和悬停的低饱和蓝色底。 */
  --play-catalog-accent-background: rgba(59, 99, 180, .42);
  /* 向共享组件提供选中项浅色文字，避免蓝底上的蓝字对比不足。 */
  --play-catalog-selected-text-color: #f8fafc;
  /* 向共享组件提供只作用于线路菜单的深色阴影。 */
  --play-catalog-menu-shadow: 0 14px 30px rgba(0, 0, 0, .28);
  /* 允许共享目录随右侧响应式轨道横向收缩。 */
  min-width: 0;
  /* 允许目录在桌面固定播放高度内建立自己的滚动区域。 */
  min-height: 0;
  /* 目录条目超出播放侧栏高度时只滚动当前目录，不推动播放器舞台。 */
  overflow-y: auto;
  /* 提供播放侧栏统一安全留白，不修改共享组件内部控件间距。 */
  padding: 16px;
  /* 使用弱边框分隔目录与播放器，不形成第二层嵌套卡片。 */
  border: 1px solid rgba(148, 163, 184, .16);
  /* 使用播放页统一深色面板背景承载共享组件。 */
  background: rgba(9, 15, 26, .82);
}

/*
  播放空状态操作区。
  对应 template 中 `.player-empty-actions`。
  作用：为无身份入口和失败请求提供清晰的导航或重试动作。
*/
.player-empty-actions {
  /* 多按钮在移动端允许换行，不压缩按钮文本。 */
  display: flex;

  /* 保留动作之间的稳定间距。 */
  gap: 8px;

  /* 受限宽度下按内容自然换行。 */
  flex-wrap: wrap;

  /* 操作区保持在空状态中心线。 */
  justify-content: center;
}

/*
  响应式断点: 961px 至 1280px。
  断点来源: 播放页右侧操作列的最小可读按钮宽度。
  作用范围: 紧凑桌面和小尺寸桌面窗口。
  样式作用:
  保持桌面左右双列结构并收窄操作列。
  线路和分集继续使用共用固定紧凑轨道自动填充，不在断点内维护第二套列数。
*/
@media (min-width: 961px) and (max-width: 1280px) {
  /*
    作用容器: 紧凑桌面播放页外壳 .player-shell。
    样式作用:
    限制右侧操作列最大宽度，为左侧播放器保留可用画面宽度。
  */
  .player-shell {
    /* 让右侧操作列在 320px 到 360px 之间响应式变化。 */
    grid-template-columns: minmax(0, 1fr) clamp(320px, 32vw, 360px);
    /* 收紧紧凑桌面的左右列间距，避免播放器被间距过度挤压。 */
    gap: 18px;
  }

}

/*
  响应式条件: 桌面宽度且视口高度不超过 720px。
  断点来源: 低高度笔记本和桌面分屏窗口的一屏可用空间。
  作用范围: 仍保持双列结构的低高度桌面。
  样式作用:
  统一收紧页面、面板和模块间距，不改变模块职责、顺序或滚动边界。
*/
@media (min-width: 961px) and (max-height: 720px) {
  /*
    作用容器: 低高度桌面播放页 .player-view。
    样式作用:
    减少页面安全边距，把更多视口高度留给播放器和操作列表。
  */
  .player-view {
    /* 使用低高度桌面的紧凑内边距。 */
    padding: 12px 18px;
  }

  /*
    作用容器: 低高度桌面播放页外壳 .player-shell。
    样式作用:
    收紧左右列间距，提升可用画面面积。
  */
  .player-shell {
    /* 减少低高度桌面的左右列分隔距离。 */
    gap: 18px;
  }

  /*
    作用容器: 低高度桌面的左右独立纵向列。
    样式作用:
    收紧列内面板距离，不改变各列独立行高职责。
  */
  .player-main-column,
  .player-side-column {
    /* 减少低高度桌面的列内纵向间距。 */
    gap: 10px;
  }

  /*
    作用容器: 低高度桌面内容信息面板 .player-meta-panel。
    样式作用:
    收紧信息面板留白和字段距离，为播放器释放高度。
  */
  .player-meta-panel {
    /* 使用更紧凑的低高度桌面内边距。 */
    padding: 10px 14px;
    /* 减少身份、上下文与收藏操作之间的距离。 */
    gap: 8px 16px;
  }

  /*
    作用容器: 低高度桌面的线路和分集面板。
    样式作用:
    收紧操作面板留白，保留更多列表可见行。
  */
  .player-catalog-panel {
    /* 使用低高度桌面的紧凑面板内边距。 */
    padding: 12px;
    /* 减少区域标题和按钮网格之间的距离。 */
    gap: 10px;
  }
}

/*
  响应式断点: max-width 960px。
  断点来源: 播放页专用结构断点。
  作用范围: 平板、窄屏窗口和手机。
  样式作用:
  改为播放器、信息、线路、分集顺序，并恢复页面内部单一纵向滚动。
*/
@media (max-width: 960px) {
  /*
    作用容器: 平板和手机播放页 .player-view。
    样式作用:
    允许访问播放器下方的信息与操作区域，并提供平板安全边距。
  */
  .player-view {
    /* 恢复播放页内部纵向滚动，承载单列自然内容高度。 */
    overflow-y: auto;
    /* 使用平板安全边距，避免内容贴近视口边缘。 */
    padding: 18px 20px;
  }

  /*
    作用容器: 平板和手机播放页外壳 .player-shell。
    样式作用:
    把桌面双列切换为单列，主播放列和右侧操作列按 DOM 顺序纵向排列。
  */
  .player-shell {
    /* 平板和手机只使用一列可收缩轨道。 */
    grid-template-columns: minmax(0, 1fr);
    /* 设置主播放列和操作列之间的纵向距离。 */
    gap: 16px;
    /* 高度由播放器、信息、线路和分集内容自然决定。 */
    height: auto;
    /* 内容较少时仍覆盖播放主体可用高度。 */
    min-height: 100%;
  }

  /*
    作用容器: 平板和手机左侧主播放列 .player-main-column。
    样式作用:
    在同一组真实节点内把播放器调整到内容信息之前。
  */
  .player-main-column {
    /* 播放器和信息面板都按自身内容高度生成。 */
    grid-template-rows: auto auto;
    /* 明确播放器优先顺序，满足进入播放页先看到播放器的要求。 */
    grid-template-areas: "player" "meta";
    /* 设置播放器和信息面板之间的纵向距离。 */
    gap: 16px;
  }

  /*
    作用容器: 平板和手机右侧操作列 .player-side-column。
    样式作用:
    取消桌面固定比例轨道，让线路和分集面板随内容自然展开。
  */
  .player-side-column {
    /* 共享目录组件按自身内容高度生成。 */
    grid-template-rows: auto;
    /* 单一目录组件不需要内部轨道间距。 */
    gap: 0;
  }

  /*
    作用容器: 平板和手机播放器舞台 .player-surface。
    样式作用:
    取消桌面剩余高度职责，使用稳定视频比例展示播放器。
  */
  .player-surface {
    /* 由宽高比决定播放器自然高度。 */
    height: auto;
    /* 使用标准 16:9 视频比例。 */
    aspect-ratio: 16 / 9;
  }

  /*
    作用容器: 平板和手机的线路与分集面板。
    样式作用:
    取消桌面固定轨道高度，让面板加入页面单一纵向滚动链。
  */
  .player-catalog-panel {
    /* 面板高度由标题和按钮网格自然决定。 */
    height: auto;
    /* 取消桌面轨道对面板最小高度的约束。 */
    min-height: 0;
  }

  /*
    作用容器: 平板和手机的共用选项网格 .player-option-grid。
    样式作用:
    使用 174px 最小轨道形成三至四列，按钮高度调整为 36px，并取消列表自身滚动。
  */
  .player-option-grid {
    /* 平板恢复稳定 Grid 轨道，触控按钮按可用宽度形成整齐列。 */
    display: grid;
    /* 根据可用宽度自动形成三至四列，641px 仍可容纳三列。 */
    grid-template-columns: repeat(auto-fill, minmax(174px, 1fr));
    /* 平板按钮使用 36px 行高，在紧凑视觉和触控可用性之间平衡。 */
    grid-auto-rows: 36px;
    /* 按按钮内容自然展开，不消费虚构剩余高度。 */
    flex: 0 0 auto;
    /* 取消桌面内部滚动，统一由播放页承担纵向滚动。 */
    overflow-y: visible;
    /* 取消桌面滚动条预留距离。 */
    padding-right: 0;
  }

  /*
    作用容器: 平板和手机共用选项按钮 .player-option-chip。
    样式作用:
    填满响应式 Grid 单元，触控设备继续使用稳定等宽按钮而不是桌面自然宽度。
  */
  .player-option-chip {
    /* 填满平板和手机当前网格轨道宽度。 */
    width: 100%;
    /* 填满当前响应式网格定义的触控行高。 */
    height: 100%;
  }
}

/*
  响应式断点: max-width 640px。
  断点来源: 当前阶段统一手机断点。
  作用范围: 手机和更窄视口。
  样式作用:
  保持播放器优先，收紧密度并固定线路和分集为两列。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机播放页 .player-view。
    样式作用:
    使用紧凑安全边距，为播放器和两列按钮保留宽度。
  */
  .player-view {
    /* 使用手机紧凑内边距。 */
    padding: 14px;
  }

  /*
    作用容器: 手机播放页的外壳与两个内部列。
    样式作用:
    统一缩小模块间距，保持整页纵向节奏一致。
  */
  .player-shell,
  .player-main-column,
  .player-side-column {
    /* 使用手机统一模块间距。 */
    gap: 14px;
  }

  /*
    作用容器: 手机内容信息面板 .player-meta-panel。
    样式作用:
    把身份、上下文和收藏拆成三行，避免横向挤压并让收藏停靠右下角。
  */
  .player-meta-panel {
    /* 手机信息面板只使用一个可收缩内容列。 */
    grid-template-columns: minmax(0, 1fr);
    /* 身份、上下文和收藏依次纵向排列。 */
    grid-template-areas: "identity" "context" "favorite";
    /* 让每一行按自身区域控制左右对齐。 */
    align-items: start;
    /* 收紧手机信息面板内部距离。 */
    gap: 12px;
    /* 使用手机面板内边距。 */
    padding: 14px;
  }

  /*
    作用容器: 手机视频标题 .player-title。
    样式作用:
    使用手机可读字号；标题继续按真实内容宽度伸缩，让类型紧接标题。
  */
  .player-title {
    /* 使用手机标题字号。 */
    font-size: 24px;
  }

  /*
    作用容器: 手机播放上下文 .player-meta-context。
    样式作用:
    数据源和当前线路纵向排列，避免长字段互相挤压。
  */
  .player-meta-context {
    /* 把数据源和当前线路改为纵向排列。 */
    flex-direction: column;
    /* 让两个 Chip 从左侧对齐并保持自身内容宽度。 */
    align-items: flex-start;
    /* 收紧两个上下文字段之间的距离。 */
    gap: 6px;
  }

  /*
    作用容器: 手机播放切换终态 `.player-catalog-outcome`。
    样式作用:
    让结果独占上下文区域一行并保持右对齐，不与纵向 Chip 争抢宽度。
  */
  .player-catalog-outcome {
    /* 让结果占满手机上下文区域，右对齐拥有稳定参照宽度。 */
    width: 100%;
    /* 清除桌面自动左边距，手机由完整行宽和末端对齐控制位置。 */
    margin-left: 0;
    /* 把状态点和文案推到上下文区域右侧。 */
    justify-content: flex-end;
    /* 手机结果允许使用上下文区域完整宽度。 */
    max-width: 100%;
  }

  /*
    作用容器: 手机收藏按钮 .player-favorite-button。
    样式作用:
    在独立行保持自身宽度并停靠信息面板右下角，不横向拉伸。
  */
  .player-favorite-button {
    /* 将收藏按钮对齐到信息面板右侧，形成移动端右下角操作。 */
    justify-self: end;
  }

  /*
    作用容器: 手机线路和分集面板。
    样式作用:
    收紧面板留白，为两列按钮提供足够宽度。
  */
  .player-catalog-panel {
    /* 使用手机操作面板内边距。 */
    padding: 14px;
  }

  /*
    作用容器: 手机共用选项网格 .player-option-grid。
    样式作用:
    固定为两列可收缩轨道，并把触控高度设置为 40px。
  */
  .player-option-grid {
    /* 手机固定两列，320px 视口仍保留稳定按钮宽度。 */
    grid-template-columns: repeat(2, minmax(0, 1fr));
    /* 手机使用 40px 行高，保持统一视觉同时避免 32px 触控区域过小。 */
    grid-auto-rows: 40px;
  }
}
</style>
