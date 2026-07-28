<template>
  <!--
    DetailView 页面渲染树

    {div.theme-page.detail-view} [v-loading="loading"]
    ├─ [if hasVideo] 详情内容分支
    │  └─ {div.detail-shell}
    │     ├─ {section.detail-hero.theme-surface}
    │     │  ├─ {div.detail-poster}
    │     │  │  ├─ [if video.cover] {img}
    │     │  │  │  └─ 显示视频封面图
    │     │  │  └─ [else] (detail-poster-fallback)
    │     │  │     └─ 没有封面时显示标题前两个字作为占位
    │     │  │
    │     │  └─ {div.detail-main}
    │     │     ├─ (detail-kicker)
    │     │     │  └─ 显示来源、年份、地区和评分标签
    │     │     ├─ {h1.detail-title}
    │     │     │  └─ 显示视频标题
    │     │     ├─ [if displayAlias] (detail-alias)
    │     │     │  └─ 显示视频别名
    │     │     ├─ (detail-meta-line)
    │     │     │  └─ 紧凑显示主演等核心信息
    │     │     ├─ (detail-summary)
    │     │     │  └─ 显示简介，没有简介时显示固定占位
    │     │     └─ (detail-actions)
    │     │        ├─ {el-button}
    │     │        │  - 点击调用 playSelectedEpisode
    │     │        │  - 跳转到带 sourceId/videoId、分集 query 和 autoplay 意图的播放页
    │     │        └─ {el-button}
    │     │           - 点击调用 handleToggleFavorite
    │     │           - 通过 userContentService 写入收藏状态
    │     │
    │     └─ {section.detail-episodes.theme-surface}
    │        ├─ (detail-section-head)
    │        │  └─ 显示“选集播放”标题和说明
    │        ├─ [if hasEpisodes] (episode-list)
    │        │  └─ {button.episode-chip} 按内容宽度循环渲染分集按钮和可选真实辅助信息
    │        └─ [else] {el-empty}
    │           └─ 没有分集时显示分集空状态
    │
    └─ [else] 整页空状态分支
       └─ {el-empty.detail-page-empty}
          - video 为空时显示
          - 表示当前没有可展示的详情数据
  -->
  <!--
    详情页。
    作用：展示单个视频的封面、核心信息、简介和分集入口。
  -->
  <div class="theme-page detail-view" v-loading="loading">
    <!-- 有视频详情数据时渲染完整详情内容。 -->
    <div v-if="hasVideo" class="detail-shell">
      <!--
        详情头图区。
        渲染位置：详情页顶部。
        使用数据：video、source、selectedEpisode。
        页面作用：按稳定详情层次展示封面、标题、简介和主播放按钮。
      -->
      <section class="detail-hero theme-surface">
        <!--
          海报区域。
          条件逻辑：有 video.cover 显示图片，没有封面时显示标题占位。
        -->
        <div class="detail-poster" :class="{ empty: !posterImage }">
          <!-- 真实封面图，优先读取统一内容对象的 cover，再回退到 poster。 -->
          <img v-if="posterImage" :src="posterImage" :alt="video.title">

          <!-- 无封面占位，避免详情页左侧区域空白。 -->
          <div v-else class="detail-poster-fallback">{{ posterFallback }}</div>

          <!-- 更新状态角标，通常用于展示“更新至几集”或清晰度信息。 -->
          <span v-if="posterBadge" class="detail-poster-badge">{{ posterBadge }}</span>
        </div>

        <!--
          详情正文区。
          渲染位置：海报右侧。
          页面作用：集中展示标签、标题、核心元信息、简介和播放按钮。
        -->
        <div class="detail-main">
          <!--
            顶部标签区。
            使用数据：sourceName、video.year、video.area、displayRating。
            页面作用：使用紧凑标签只保留核心扫读信息。
          -->
          <div class="detail-kicker">
            <el-tag class="detail-tag kind-source" size="small" effect="plain">{{ sourceName }}</el-tag>
            <el-tag v-if="video.year" class="detail-tag" size="small" effect="plain">{{ video.year }}</el-tag>
            <el-tag v-if="video.area" class="detail-tag" size="small" effect="plain">{{ video.area }}</el-tag>
            <el-tag class="detail-tag kind-rating" size="small" effect="plain">
              <i v-if="hasRating" class="el-icon-star-on"></i>
              {{ displayRating }}
            </el-tag>
          </div>

          <!-- 视频标题，作为详情页主标题。 -->
          <h1 class="detail-title">{{ video.title }}</h1>

          <!-- 视频别名，有别名字段时才显示。 -->
          <p v-if="displayAlias" class="detail-alias">{{ displayAlias }}</p>

          <!--
            核心元信息行。
            使用紧凑元信息行，把主演作为详情页主信息展示。
          -->
          <div class="detail-meta-line">
            <span class="detail-label">主演</span>
            <span class="detail-value">{{ actorText }}</span>
          </div>

          <!-- 简介区，没有简介时显示统一占位文案。 -->
          <p class="detail-summary">{{ displaySummary }}</p>

          <!--
            操作区。
            当前阶段点击播放入口会跳转到带 sourceId/videoId、分集 query 和 autoplay 意图的播放页。
            收藏按钮会写入用户内容状态，并和列表页卡片收藏状态联动。
          -->
          <div class="detail-actions">
            <el-button
              type="primary"
              icon="el-icon-video-play"
              :disabled="!selectedEpisode"
              @click="playSelectedEpisode">
              {{ selectedEpisode ? '播放 ' + selectedEpisode.label : '暂无可播放分集' }}
            </el-button>
            <el-button
              :type="isFavorite ? 'primary' : 'default'"
              :icon="favoriteButtonIcon"
              @click="handleToggleFavorite">
              {{ favoriteButtonText }}
            </el-button>
          </div>
        </div>
      </section>

      <!--
        分集区。
        渲染位置：详情头图区下方。
        使用数据：episodes、selectedEpisodeId。
        页面作用：展示可选择的分集入口。
      -->
      <section class="detail-episodes theme-surface" aria-label="分集列表">
        <!-- 分集区标题和说明。 -->
        <div class="detail-section-head">
          <div>
            <h2 class="detail-section-title">选集播放</h2>
            <p class="detail-section-desc">支持按线路切换并从指定集数进入播放页</p>
          </div>
        </div>

        <!-- 有分集时按真实内容宽度渲染可换行按钮列表。 -->
        <div v-if="hasEpisodes" class="episode-list">
          <button
            v-for="episode in episodes"
            :key="episode.id || episode.value"
            type="button"
            class="episode-chip"
            :class="{ active: episode.id === selectedEpisodeId }"
            @click="selectEpisode(episode)"
          >
            <span class="episode-label">{{ episode.label }}</span>
            <span v-if="getEpisodeSecondaryText(episode)" class="episode-title">
              {{ getEpisodeSecondaryText(episode) }}
            </span>
          </button>
        </div>

        <!-- 没有分集时显示局部空状态，避免分集区塌陷。 -->
        <el-empty v-else description="当前详情没有可展示的分集" />
      </section>
    </div>

    <!-- video 为空时显示整页空状态。 -->
    <el-empty
      v-else
      class="detail-page-empty theme-surface"
      :description="loadError || '当前没有可展示的视频详情数据'"
    />
  </div>
</template>

<script>
/*
  DetailView.vue 模块说明

  - 文件职责:
      渲染统一 ContentItem 详情、分集选择和播放入口。
      收藏操作通过 userContentService 等待 Repository 提交，页面只读取 selector 投影。

  - 导入库及文件汇总(8 条，内置 0 条，第三方 0 条，自定义 8 条):
      requestSourceData: 自定义服务，请求详情页 detail 数据桶并写入内容共享池。
      getCurrentContentItem: 自定义 selector，读取详情页当前内容。
      getContentUserStatus: 自定义 selector，读取当前内容收藏和播放状态。
      toggleFavorite: 自定义服务，切换当前内容收藏状态。
      createContentPlaybackNavigationTarget: 自定义服务，根据当前 ContentItem 和选中分集创建统一播放器目标。
      createRouteRequestGuard: 自定义路由请求守卫，阻止失活详情页响应其他页面路由变化。
      userContentRecoveryService exports: 自定义恢复门面，读取恢复记录、匹配分集并在播放前提交重绑定。

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      DetailView: Vue component，供 detail 路由展示单个内容详情和用户收藏状态。
*/

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 详情页进入时请求 detail 数据桶，并把响应写入 detail.currentKey，页面通过 getCurrentContentItem('detail') 读取。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../store/siteContentStore.js。
// 导入内容: getCurrentContentItem 单内容桶 selector。
// 文件作用: 详情页通过 selector 从 detail.currentKey 解析完整 ContentItem。
import { getCurrentContentItem } from '../store/siteContentStore.js';

// 导入来源: ../selectors/userContentSelectors。
// 导入内容: getContentUserStatus 用户内容状态 selector。
// 文件作用: 用于让详情页读取当前内容收藏状态，并和列表页卡片保持同步。
import { getContentUserStatus } from '../selectors/userContentSelectors.js';

// 导入来源: ../services/userContentService。
// 导入内容: toggleFavorite 收藏切换服务。
// 文件作用: 让详情页收藏按钮等待 Repository 提交并采用统一用户内容投影。
import { toggleFavorite } from '../services/userContentService.js';

// 导入来源: ../services/playerNavigationService.js。
// 导入内容: createContentPlaybackNavigationTarget 内容播放目标构造函数。
// 文件作用: 详情页只提交当前内容、选中分集和自动播放意图，不在页面中复制播放器 params/query 规则。
import { createContentPlaybackNavigationTarget } from '../services/playerNavigationService.js';

// 导入来源: ../utils/sourceDisplayName.js。
// 导入内容: formatSourceDisplayName 数据源显示名称适配函数。
// 文件作用: 让详情页来源标签遵守全站十个 Unicode 字符显示边界。
import { formatSourceDisplayName } from '../utils/sourceDisplayName.js';

// 导入来源: ../router/routeRequestState.js。
// 导入内容: createRouteRequestGuard KeepAlive 请求身份守卫。
// 文件作用: 详情页只处理 detail-entry/detail 的新 fullPath，普通离开和返回不重复请求。
import { createRouteRequestGuard } from '../router/routeRequestState.js';

import {
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: getUserContentRecoveryContext；文件作用: 从当前 query 读取原用户记录。
  getUserContentRecoveryContext,
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: findUserContentRecoveryEpisode；文件作用: 详情加载后按历史定位器选择替代分集。
  findUserContentRecoveryEpisode,
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: commitUserContentRecovery；文件作用: 用户点击播放时原子重绑定收藏和历史。
  commitUserContentRecovery
} from '../services/userContentRecoveryService.js';

export default {
  // 组件名称用于在调试工具和报错信息中识别详情页。
  name: 'DetailView',

  /**
   * 创建详情页局部运行状态。
   * 纯函数: 每个组件实例返回独立加载、错误和分集选择状态，不读取外部 store。
   *
   * @returns {object} 详情页局部状态。
   */
  data() {
    return {
      // loading 类型: boolean。
      // loading 作用: 控制根容器 v-loading，请求详情数据时显示页面级加载遮罩。
      loading: false,

      // loadError 类型: string。
      // loadError 作用: 记录详情数据请求失败文案，失败时交给整页空状态展示。
      loadError: '',

      // selectedEpisodeId 类型: string。
      // selectedEpisodeId 作用: 表示当前选中的分集按钮，影响按钮 active 状态和播放按钮文案。
      selectedEpisodeId: ''
    };
  },

  /**
   * 启动详情页首次内容请求。
   * 生命周期时机: 组件创建后、首次渲染前执行。
   * 副作用: 调用 loadDetailContent 写入加载状态并请求 detail 数据桶。
   *
   * @returns {void} 异步请求由方法自身收敛。
   */
  created() {
    // 类型: Readonly<object>；作用: 当前 DetailView 实例独享的无身份入口和严格详情请求守卫。
    this._routeRequestGuard = createRouteRequestGuard({
      routeNames: ['detail-entry']
    });
    // 副作用: 把首次 URL 标记为已处理，返回同一 KeepAlive 详情地址时不重复请求。
    this._routeRequestGuard.markHandled(this.$route);

    // 生命周期时机: 详情页组件创建后执行。
    // 执行内容: 请求当前路由目标的详情数据，并写入统一 detail 数据桶。
    this.loadDetailContent();
  },

  watch: {
    /**
     * 监听详情页完整路由变化。
     * 执行时机: sourceId 或 videoId 等路由信息变化时触发。
     * 页面影响: 从新路由重新请求 detail.currentKey，保证卡片跳转到不同详情时内容同步刷新。
     * 副作用: 发起新的详情数据请求并更新页面加载状态。
     *
     * @returns {void} 只触发详情数据请求，不返回业务数据。
     */
    '$route.fullPath'() {
      // 条件分支: 当前路由属于其他缓存页面或详情地址已经处理过时进入。
      // 执行内容: 保留详情页现状，不在后台请求其他页面身份。
      if (!this._routeRequestGuard || !this._routeRequestGuard.shouldHandle(this.$route)) {
        return;
      }

      // 异步调用: 只有详情入口/严格详情的新 fullPath 才重新请求或采用无身份空状态。
      this.loadDetailContent();
    }
  },

  computed: {
    /**
     * 当前详情页跨源恢复上下文。
     * 纯函数: 只读取 route.query 和用户内容 selector；普通详情或记录已删除时返回 null。
     *
     * @returns {object|null} 收藏或历史恢复上下文。
     */
    recoveryContext() {
      return getUserContentRecoveryContext(this.$route.query);
    },

    /**
     * 当前详情页统一内容对象。
     * 纯函数: 只读取 detail 数据桶 selector，不修改实体池或页面状态。
     *
     * @returns {Object|null} 当前 ContentItem；尚未加载或未命中时为 null。
     */
    video() {
      // 返回值类型: Object|null。
      // 作用: 通过统一 selector 从 detail.currentKey 读取实体池中的完整 ContentItem。
      return getCurrentContentItem('detail');
    },

    /**
     * 当前视频来源对象。
     * 纯函数: 只读取当前 ContentItem.source，不修改内容对象。
     *
     * @returns {Object|null} ContentItem.source 对象；缺失时为 null。
     */
    source() {
      // source 是统一 ContentItem 的来源扩展字段，当前用于显示来源名称。
      return this.video && this.video.source ? this.video.source : null;
    },

    /**
     * 当前视频分集列表。
     * 纯函数: 只读取当前 ContentItem.episodes 并通过 asList 返回稳定数组。
     *
     * @returns {Array} ContentItem.episodes 数组；缺失时返回空数组。
     */
    episodes() {
      // episodes 是统一 ContentItem 的播放入口列表，电影通常只有一个正片分集。
      return this.asList(this.video && this.video.episodes);
    },

    /**
     * 当前详情页路由中的数据源 id。
     * 纯函数: 只读取 Vue Router params 并标准化文本。
     *
     * @returns {string} URL params 中的 sourceId，没有时返回空字符串。
     */
    routeSourceId() {
      // sourceId 来自 `/detail/:sourceId/:videoId` 必填路径，真实详情请求必须以它选择目标数据源。
      return this.asText(this.$route.params.sourceId).trim();
    },

    /**
     * 当前详情页路由中的视频 id。
     * 纯函数: 只读取 Vue Router params 并标准化文本。
     *
     * @returns {string} URL params 中的 videoId，没有时返回空字符串。
     */
    routeVideoId() {
      // videoId 来自 `/detail/:sourceId/:videoId` 必填路径，真实详情请求必须以它定位目标视频。
      return this.asText(this.$route.params.videoId).trim();
    },

    /**
     * 详情页是否具备完整请求身份。
     * 纯函数: 只读取 routeSourceId 和 routeVideoId。
     *
     * @returns {boolean} sourceId 与 videoId 都存在时返回 true，否则返回 false。
     */
    hasCompleteRouteIdentity() {
      return Boolean(this.routeSourceId && this.routeVideoId);
    },

    /**
     * 播放跳转使用的数据源 id。
     * 纯函数: 只读取当前已采用详情实体，不回退路由或活动源。
     *
     * @returns {string} 当前详情实体所属数据源 id；实体缺失时返回空字符串。
     */
    effectiveSourceId() {
      return this.video && this.video.sourceId ? this.video.sourceId : '';
    },

    /**
     * 播放跳转使用的视频 id。
     * 纯函数: 只读取当前已采用详情实体，不回退路由 Mock 或旧页面状态。
     *
     * @returns {string} 当前详情实体 id；实体缺失时返回空字符串。
     */
    effectiveVideoId() {
      return this.video && this.video.id ? this.video.id : '';
    },

    /**
     * 是否有详情主体数据。
     * 纯函数: 只验证当前实体与完整路由身份一致，不修改内容或路由。
     *
     * @returns {boolean} 当前实体 sourceId/id 与路由目标一致时返回 true。
     */
    hasVideo() {
      return Boolean(
        this.hasCompleteRouteIdentity
        && this.video
        && this.video.sourceId === this.routeSourceId
        && this.video.id === this.routeVideoId
      );
    },

    /**
     * 是否有可展示分集。
     * 纯函数: 只读取 episodes 数量。
     *
     * @returns {boolean} episodes 至少有一项时返回 true。
     */
    hasEpisodes() {
      return this.episodes.length > 0;
    },

    /**
     * 视频是否有评分。
     * 纯函数: 只读取当前内容 score。
     *
     * @returns {boolean} score 有值时返回 true。
     */
    hasRating() {
      return Boolean(this.video && this.video.score);
    },

    /**
     * 详情页海报图片。
     * 纯函数: 只按 cover/poster 优先级返回图片地址。
     *
     * 页面位置：海报区真实封面图。
     *
     * @returns {string} 优先返回 cover，没有时返回 poster。
     */
    posterImage() {
      // cover 更适合详情大图，poster 作为列表海报字段在详情页兜底使用。
      return this.video ? this.video.cover || this.video.poster || '' : '';
    },

    /**
     * 海报角标文案。
     * 纯函数: 只按 badge/quality/updateStatus 优先级返回文本。
     *
     * 页面位置：海报区右上角角标。
     *
     * @returns {string} 角标、清晰度或电视剧更新状态。
     */
    posterBadge() {
      // badge 是页面优先展示的标签，quality 和 tv.updateStatus 用于补足常见视频角标。
      return this.video ? this.video.badge || this.video.quality || (this.video.tv && this.video.tv.updateStatus) || '' : '';
    },

    /**
     * 视频别名展示文本。
     * 纯函数: 只读取 aliases 并返回新文本。
     *
     * 页面位置：标题下方别名行。
     *
     * @returns {string} aliases 数组拼接文本。
     */
    displayAlias() {
      // aliases 是统一内容对象的别名数组，过滤空值后用斜杠拼接展示。
      return this.video ? this.joinTextParts(this.video.aliases, ' / ') : '';
    },

    /**
     * 封面缺失时的占位文案。
     * 纯函数: 只读取标题并截取文本，不修改内容对象。
     *
     * 页面位置：海报区 `.detail-poster-fallback`。
     *
     * @returns {string} 视频标题前两个字。
     */
    posterFallback() {
      // 类型: string；作用: 没有标题时使用“视频”，避免封面占位空白。
      const title = this.video && this.video.title ? this.video.title : '视频';

      // 只取前两个字，保证占位文本不会撑破封面区。
      return title.slice(0, 2).toUpperCase();
    },

    /**
     * 页面展示用评分文案。
     * 纯函数: 只读取当前内容评分并返回展示文本。
     *
     * 页面位置：顶部评分标签。
     *
     * @returns {string} 有评分时返回评分，没有评分时返回“暂无评分”。
     */
    displayRating() {
      // 条件分支: 当前 video 不存在时进入。
      // 执行内容: 返回空文本，不访问评分字段。
      if (!this.video) {
        return '';
      }

      // 有 score 显示具体分数，没有 score 用稳定占位文案。
      return this.video.score ? `${this.video.score} 分` : '暂无评分';
    },

    /**
     * 视频简介最终展示文本。
     * 纯函数: 只读取详情描述字段并返回展示文本。
     *
     * 页面位置：详情正文区 `.detail-summary`。
     *
     * @returns {string} 简介或兜底文案。
     */
    displaySummary() {
      // 条件分支: 当前 video 不存在时进入。
      // 执行内容: 返回空文本，避免访问描述字段。
      if (!this.video) {
        return '';
      }

      // description 是列表和详情共用简介，detail.fullDescription 是详情页更长文案。
      return this.video.detail && this.video.detail.fullDescription
        ? this.video.detail.fullDescription
        : this.video.description || '暂无剧情简介。';
    },

    /**
     * 当前来源名称。
      * 纯函数: 读取完整 source.name 并通过共享适配器返回用户可读短名称。
     *
     * 页面位置：顶部来源标签。
     *
     * @returns {string} 来源名称或兜底文案。
     */
    sourceName() {
      // 条件分支: 当前来源存在非空 name 时进入。
      // 执行内容: 返回统一 ContentItem 的十字符以内来源名称。
      if (this.source && this.source.name) {
        return formatSourceDisplayName(this.source.name);
      }

      // 没有来源对象时给出明确占位。
      return '暂无来源';
    },

    /**
     * 演员文本。
     * 纯函数: 只读取演员数组并返回拼接文本。
     *
     * 页面位置：核心元信息行。
     *
     * @returns {string} 演员拼接文本或兜底文案。
     */
    actorText() {
      // 条件分支: 当前 video 不存在时进入。
      // 执行内容: 返回演员占位文案，保证模板稳定。
      if (!this.video) {
        return '暂无演员信息';
      }

      // detail.actors 是统一内容对象中的演员列表。
      return this.joinTextParts(this.video.detail && this.video.detail.actors, ' / ') || '暂无演员信息';
    },

    /**
     * 当前选中的分集。
     * 纯函数: 只读取分集数组和 selectedEpisodeId，不修改选择状态。
     *
     * 页面位置：播放按钮文案和分集按钮 active 状态。
     *
     * @returns {Object|null} 当前分集对象。
     */
    selectedEpisode() {
      // 类型: object|undefined；作用: 按 selectedEpisodeId 查找用户选择的分集。
      const matchedEpisode = this.episodes.find(episode => episode.id === this.selectedEpisodeId);

      // 找不到时回退到第一集，避免播放按钮没有目标。
      return matchedEpisode || this.episodes[0] || null;
    },

    /**
     * 当前详情内容的用户内容状态。
     * 数据来源: userContentStore，经 getContentUserStatus selector 读取。
     * 纯函数: 不修改用户内容投影。
     *
     * @returns {Object} 收藏、最近播放和当前播放状态聚合对象。
     */
    contentUserStatus() {
      // 返回值类型: object。
      // 作用: 详情页不直接读取 userContentStore 内部结构，统一走 selector。
      return getContentUserStatus(this.video);
    },

    /**
     * 当前详情内容是否已收藏。
     * 纯函数: 只读取 contentUserStatus.favorite。
     *
     * @returns {boolean} true 表示已收藏，false 表示未收藏。
     */
    isFavorite() {
      // 返回值类型: boolean。
      // 作用: 只使用 Repository 提交成功后 selector 发布的收藏状态，不维护页面影子值。
      return Boolean(this.contentUserStatus.favorite);
    },

    /**
     * 收藏按钮图标。
     * 纯函数: 只读取 isFavorite 并返回图标类名。
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
      // 作用: 文案跟随收藏状态变化，让用户知道再次点击会取消收藏。
      return this.isFavorite ? '已收藏' : '收藏';
    },

    /**
     * 当前选中分集在播放页 query 中使用的序号。
     * 纯函数: 只读取 selectedEpisode 并派生正整数或 null。
     *
     * @returns {number|null} 分集序号；电影或缺失时返回 null。
     */
    selectedEpisodeIndex() {
      // 类型: object|null。
      // 作用: 当前选中的分集对象，电视剧跳转播放页时用于生成历史记录 key。
      const episode = this.selectedEpisode;

      // 条件分支: 没有分集时进入。
      // 执行内容: 返回 null，让播放页按电影或默认分集处理。
      if (!episode) {
        return null;
      }

      // 类型: number。
      // 作用: 优先读取数据源清洗后的 episodeNumber，其次读取 index 字段。
      const episodeIndex = Number(episode.episodeNumber || episode.index || episode.episodeIndex);

      // 返回值类型: number|null。
      // 作用: 有效集数返回数字，异常时返回 null。
      return Number.isFinite(episodeIndex) && episodeIndex > 0 ? episodeIndex : null;
    }
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     * 纯函数: 不修改输入数组，非数组返回新的空数组。
     *
     * 调用位置：data 初始化 episodes、computed 整理演员列表。
     * 页面影响：保证分集区和演员文本永远消费数组。
     *
     * @param {*} value 可能来自详情页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      // 条件分支: 输入是真实数组时进入。
      // 执行内容: 原样返回供只读展示，不执行类型强制转换。
      if (Array.isArray(value)) {
        return value;
      }

      // 非数组统一兜底为空数组，让页面进入对应空状态。
      return [];
    },

    /**
     * 把任意值整理成字符串。
     * 纯函数: 不执行隐式字符串转换，非字符串返回空文本。
     *
     * 调用位置：routeSourceId、routeVideoId。
     * 页面影响：保证路由参数进入页面后始终以字符串形态参与展示和跳转。
     *
     * @param {*} value 可能来自路由 params 的任意值。
     * @returns {string} 字符串原样返回，其他值统一转为空字符串。
     */
    asText(value) {
      // 条件分支: 路由参数已经是字符串时进入。
      // 执行内容: 原样返回标准路径文本。
      if (typeof value === 'string') {
        return value;
      }

      // 非字符串统一转为空，避免页面展示 undefined 或 null。
      return '';
    },

    /**
     * 取得分集按钮的真实辅助信息。
     * 纯函数: 依次读取 title、description 和 duration，只返回首个非空且不与 label 重复的文本。
     * 调用位置: 选集按钮模板的条件渲染和辅助文本。
     * 页面影响: 没有真实辅助信息时不创建第二行，短标签按钮保持内容宽度和单行高度。
     *
     * @param {object|null} episode Provider 返回的标准 Episode。
     * @returns {string} 可展示辅助文本；缺失或与 label 重复时返回空字符串。
     */
    getEpisodeSecondaryText(episode) {
      // 条件分支: 分集对象缺失时进入；执行内容: 返回空文本，不渲染辅助行。
      if (!episode || typeof episode !== 'object') return '';
      // 类型: string；作用: 标准化主标签，用于排除 Provider 重复写入 title 的情况。
      const label = typeof episode.label === 'string' ? episode.label.trim() : '';
      // 类型: Array<*>；作用: 按契约展示优先级保存辅助字段候选，不制造“可播放”等页面占位数据。
      const candidates = [episode.title, episode.description, episode.duration];
      for (const candidate of candidates) {
        // 类型: string；作用: 只接受真实字符串字段并清理首尾空白。
        const text = typeof candidate === 'string' ? candidate.trim() : '';
        // 条件分支: 当前候选非空且不重复主标签时进入；执行内容: 采用为唯一辅助行。
        if (text && text !== label) return text;
      }
      return '';
    },

    /**
     * 获取默认选中分集 id。
     * 纯函数: 只读取分集列表，不修改 active 标记或页面选择状态。
     *
     * 调用位置：data 初始化 selectedEpisodeId。
     * 页面影响：进入详情页时，分集区默认选中 active 分集或第一集。
     *
     * @param {Array} episodes 分集列表。
     * @returns {string} 默认分集 id。
     */
    getDefaultEpisodeId(episodes) {
      // 类型: object|undefined；作用: 优先定位数据源声明的 active 分集。
      const activeEpisode = episodes.find(episode => episode && episode.active);

      // 类型: object|undefined；作用: 没有 active 分集时回退列表第一项。
      const fallbackEpisode = activeEpisode || episodes[0];

      // id 是按钮 active 判断的主字段，没有 id 时用 value 兜底。
      return fallbackEpisode ? fallbackEpisode.id || fallbackEpisode.value || '' : '';
    },

    /**
     * 拼接文本数组。
     * 纯函数: 返回新字符串，不修改 parts 数组。
     *
     * 调用位置：actorText。
     * 页面影响：把演员数组整理成页面可读文本。
     *
     * @param {Array} parts 需要拼接的文本片段。
     * @param {string} separator 片段之间使用的分隔符。
     * @returns {string} 过滤空值后的拼接文本。
     */
    joinTextParts(parts, separator) {
      // 条件分支: parts 不是数组时进入。
      // 执行内容: 返回空文本，避免异常值参与拼接。
      if (!Array.isArray(parts)) {
        return '';
      }

      // 过滤空字符串和空值，避免页面出现多余分隔符。
      return parts.filter(Boolean).join(separator);
    },

    /**
     * 请求详情页数据。
     *
     * 调用位置：created 生命周期、详情路由变化监听。
     * 页面影响：通过 sourceDataService 请求 detail 数据桶，成功后模板从 getCurrentContentItem('detail') 渲染。
     * 副作用: 更新 loading/loadError/selectedEpisodeId，并通过 service 提交详情响应。
     * 成功路径: 采用响应内容的默认分集并清空旧错误。
     * 失败路径: 保留安全错误文案；finally 关闭加载状态。
     *
     * @returns {Promise<void>} 请求完成后不返回业务数据。
     */
    async loadDetailContent() {
      // 条件分支: 路由缺少 sourceId 或 videoId 时进入；执行内容: 不调用 Provider，并清空页面分集选择。
      if (!this.hasCompleteRouteIdentity) {
        this.loading = false;
        this.selectedEpisodeId = '';
        this.loadError = '详情页缺少完整的数据源或内容身份，请从内容列表重新进入。';
        return;
      }

      // 副作用: 打开页面级加载状态，让用户知道详情数据正在刷新。
      this.loading = true;

      // 副作用: 清空旧错误，避免一次失败文案影响后续成功请求。
      this.loadError = '';

      try {
        // 异步请求: 让统一数据服务按 detail 页面和 contentId 请求当前内容。
        // 成功结果: response.item 会被归一化写入实体池，detail.currentKey 保存对应引用。
        // 类型: object；作用: 保存统一数据服务返回的 detail 标准响应。
        const response = await requestSourceData({
          // 类型: string。
          // 作用: 使用详情路由的必填数据源身份，不允许 service 回退活动源。
          sourceId: this.routeSourceId,

          // 类型: string。
          // 作用: 告诉 provider 当前请求详情页单内容数据桶。
          pageKey: 'detail',

          // 类型: object。
          // 作用: 单内容请求参数，contentId 由必填路由身份提供给目标 Provider。
          params: {
            contentId: this.routeVideoId
          }
        });

        // 类型: object|null。
        // 作用: 当前响应命中的详情内容，没有命中时使用 null 进入空状态。
        const responseItem = response && response.item ? response.item : null;

        // 类型: Array<object>。
        // 作用: 从响应内容中读取分集列表，用于决定默认选中哪一集。
        const nextEpisodes = this.asList(responseItem && responseItem.episodes);

        // 类型: object|null；作用: 历史恢复按冻结优先级匹配新 Provider 分集，普通详情和收藏恢复返回 null。
        const recoveryEpisode = findUserContentRecoveryEpisode(nextEpisodes, this.recoveryContext);
        // 副作用: 历史恢复优先选中匹配分集；没有确定匹配时保持 Provider active 或第一集。
        this.selectedEpisodeId = recoveryEpisode
          ? recoveryEpisode.id || recoveryEpisode.value || ''
          : this.getDefaultEpisodeId(nextEpisodes);

      } catch (error) {
        // 副作用: 保存错误文案，交给整页空状态展示。
        this.loadError = error && error.message ? error.message : '详情数据加载失败';
      } finally {
        // 副作用: 请求结束后关闭加载遮罩，无论成功失败都恢复页面交互。
        this.loading = false;
      }
    },

    /**
     * 选择分集。
     *
     * 调用位置：分集按钮点击。
     * 页面影响：更新 selectedEpisodeId，让按钮 active 状态和播放按钮文案同步变化。
     * 副作用: 有效分集会修改当前页面 selectedEpisodeId。
     *
     * @param {Object} episode 用户点击的分集对象。
     * @returns {void} 只更新页面状态，不返回业务数据。
     */
    selectEpisode(episode) {
      // 条件分支: 点击参数缺少分集对象时进入。
      // 执行内容: 保留当前选择，不写入异常 id。
      if (!episode) {
        return;
      }

      // id 是分集主标识，没有 id 时使用 value 兜底。
      this.selectedEpisodeId = episode.id || episode.value || '';
    },

    /**
     * 切换当前详情内容收藏状态。
     * 触发来源: 详情页收藏按钮点击。
     * 副作用: 等待 userContentService 完成 Repository 事务和统一 store 采用。
     * 成功路径: selector 响应式更新后按钮自动显示新状态。
     * 失败路径: 展示安全提示并保持旧按钮状态，不创建页面本地覆盖。
     *
     * @returns {Promise<void>} 收藏事务完成或失败提示展示后结束。
     */
    async handleToggleFavorite() {
      // 条件分支: 当前详情内容缺失时进入。
      // 执行内容: 不写入收藏状态，避免生成无效收藏记录。
      if (!this.video) {
        return;
      }

      try {
        // 异步调用: Repository 提交成功后 service 才采用 store；返回结果无需另存页面状态。
        await toggleFavorite(this.video);
      } catch {
        // 失败处理: 页面继续读取旧 selector 投影，只展示不含保存对象的稳定文案。
        this.$message.error('收藏状态保存失败，请稍后重试');
      }
    },

    /**
     * 播放当前选中分集。
     *
     * 调用位置：详情头图区主播放按钮。
     * 页面影响：跳转到播放页，并携带当前内容、选中分集、默认线路和自动播放意图。
     * 副作用: 恢复流程先提交用户内容双仓事务，再委托统一 service 构造目标并调用 Vue Router push。
     * 成功路径: 重绑定完成后路由 query 使用新分集身份，播放页按已迁移记录恢复原进度。
     * 失败路径: 分集、内容身份或重绑定失败时保持详情页；非重复 Router 错误继续抛出。
     *
     * @returns {Promise<void>} 重绑定和路由导航完成后结束。
     */
    async playSelectedEpisode() {
      // 条件分支: 当前没有可播放分集时进入。
      // 执行内容: 保持详情页，不构造播放路由。
      if (!this.selectedEpisode) {
        return;
      }

      // 条件分支: 数据源或内容 id 任一缺失时进入。
      // 执行内容: 保持详情页，避免生成无业务目标播放地址。
      if (!this.effectiveSourceId || !this.effectiveVideoId) {
        return;
      }

      try {
        // 类型: object|null；作用: 冻结本次点击开始时的恢复上下文，避免事务采用后 computed key 消失影响失败判断。
        const recoveryContext = this.recoveryContext;
        // 类型: object|null；作用: 普通详情返回 null，恢复详情只在双仓事务提交后返回新内容与分集身份。
        const recoveryResult = await commitUserContentRecovery(
          recoveryContext,
          this.video,
          this.selectedEpisode
        );
        // 条件分支: 当前存在恢复上下文但记录已失效或无法形成新分集身份时进入。
        // 执行内容: 保持详情页和原用户记录，不进入无法读取原进度的播放器。
        if (recoveryContext && !recoveryResult) {
          this.$message.error('历史记录无法迁移，请重新选择匹配内容');
          return;
        }
      } catch {
        // 失败处理: 原收藏和历史保持不变，不进入播放器以免丢失原进度恢复身份。
        this.$message.error('历史记录迁移失败，请稍后重试');
        return;
      }

      // 类型: string。
      // 作用: 当前分集稳定 id，交给统一导航 service 写入可刷新 query。
      const episodeId = this.selectedEpisode.id || this.selectedEpisode.value || '';

      // 类型: object|null。
      // 作用: 使用当前统一内容字段生成完整 player 目标；显式分集覆盖默认分集，默认线路仍由 service 推导。
      const target = createContentPlaybackNavigationTarget({
        ...this.video,
        sourceId: this.effectiveSourceId,
        id: this.effectiveVideoId
      }, {
        episodeId,
        episodeIndex: this.selectedEpisodeIndex,
        autoplay: true
      });

      // 条件分支: 统一 service 因内容身份无效拒绝目标时进入。
      // 执行内容: 保持详情页，不回退默认内容或保留页面私有路由算法。
      if (!target) {
        return;
      }

      // 副作用: 执行统一播放器目标；播放页从 params/query 恢复同一内容、分集和线路。
      this.$router.push(target).catch((error) => {
        // 条件分支: 路由失败不是 Vue Router 3 重复导航时进入。
        // 执行内容: 重新抛出真实导航错误；重复导航保持当前页面。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    }
  }
};
</script>

<style scoped>
/*
  详情页最外层容器。
  对应 template 根节点 `.theme-page.detail-view`。
  作用是在通用页面布局基础上，为详情页顶部留出细微距离。
*/
.detail-view {
  /* 顶部留白让详情头图区和全局导航之间不显得太贴。 */
  padding-top: 8px;
}

/*
  详情内容主体。
  对应 template 中 `[if hasVideo]` 的 `.detail-shell`。
  内部只保留详情头图区和选集播放区，避免重复展示页面主信息。
*/
.detail-shell {
  /* 使用 grid 让详情头图和选集区按上下顺序排列。 */
  display: grid;

  /* 控制详情头图和选集区之间的纵向距离。 */
  gap: 18px;
}

/*
  详情头图区。
  对应 template 中 `.detail-hero.theme-surface`。
  桌面端布局：左侧固定海报，右侧详情正文。
*/
.detail-hero {
  /* 使用 grid 明确拆成海报列和正文列。 */
  display: grid;

  /* 第一列固定 260px 给海报，第二列吃掉剩余空间。 */
  grid-template-columns: 260px minmax(0, 1fr);

  /* 控制海报和正文之间的横向距离。 */
  gap: 28px;

  /* 详情头图区保留稳定内边距，避免封面、正文和容器边界拥挤。 */
  padding: 28px;

  /* 保证头图区域最少有一定高度，避免内容少时卡片显得太扁。 */
  min-height: 420px;
}

/*
  海报容器。
  对应 template 中 `.detail-poster`。
  作用是承载封面图、封面占位和更新状态角标。
*/
.detail-poster {
  /* 让角标可以定位到海报右下角。 */
  position: relative;

  /* 固定 2:3 海报比例，避免不同源封面尺寸导致详情页跳动。 */
  aspect-ratio: 2 / 3;

  /* 限制海报高度，保持竖版封面比例并避免挤压正文。 */
  max-height: 420px;

  /* 封面图按比例裁切时，超出海报框的部分隐藏。 */
  overflow: hidden;

  /* 图片加载前的浅色底，避免空白区域太突兀。 */
  background: #eef2f7;

  /* 细边框给海报一个清晰边界。 */
  border: 1px solid rgba(148, 163, 184, 0.18);

  /* 使用小圆角维持紧凑、克制的详情视觉。 */
  border-radius: 6px;
}

/*
  真实封面图片。
  对应 template 中 `[if video.cover]` 的 `.detail-poster img`。
*/
.detail-poster img {
  /* 宽度铺满海报容器。 */
  width: 100%;

  /* 高度铺满海报容器。 */
  height: 100%;

  /* 图片按块级显示，避免行内图片底部基线空隙。 */
  display: block;

  /* 保持图片比例并裁切填满容器，避免封面被拉伸变形。 */
  object-fit: cover;
}

/*
  无封面海报状态。
  对应 template 中 `:class="{ empty: !video.cover }"`。
  出现条件：详情数据没有封面图。
*/
.detail-poster.empty {
  /* 使用 flex 居中占位文字。 */
  display: flex;

  /* 占位文字垂直居中。 */
  align-items: center;

  /* 占位文字水平居中。 */
  justify-content: center;

  /* 深色渐变让无封面状态更像正式占位。 */
  background: linear-gradient(135deg, #172133 0%, #24334d 100%);
}

/*
  无封面占位文字。
  对应 template 中 `.detail-poster-fallback`。
*/
.detail-poster-fallback {
  /* 字号较大，填补海报区域的视觉空白。 */
  font-size: 44px;

  /* 加粗让占位文字在深色背景上更稳定。 */
  font-weight: 800;

  /* 白色半透明文字避免过亮刺眼。 */
  color: rgba(255, 255, 255, 0.92);
}

/*
  海报角标。
  对应 template 中 `.detail-poster-badge`。
  出现条件：posterBadge 有值。
*/
.detail-poster-badge {
  /* 固定到海报右下角。 */
  position: absolute;

  /* 控制角标距离右侧的位置。 */
  right: 12px;

  /* 控制角标距离底部的位置。 */
  bottom: 12px;

  /* 给角标文字留出内部空间。 */
  padding: 5px 10px;

  /* 深色半透明背景保证角标在海报上可读。 */
  background: rgba(24, 34, 53, 0.82);

  /* 白色文字提高对比度。 */
  color: #fff;

  /* 缩小字号，让角标保持辅助层级。 */
  font-size: 12px;

  /* 胶囊圆角适合短状态标签。 */
  border-radius: 999px;
}

/*
  详情正文区。
  对应 template 中 `.detail-main`。
  内部从上到下排列标签、标题、主演、简介和播放按钮。
*/
.detail-main {
  /* 允许正文列在 grid 中正确缩小，避免长标题撑破布局。 */
  min-width: 0;

  /* 给正文顶部留出最小间距，避免文字紧贴容器顶边。 */
  padding-top: 4px;
}

/*
  顶部标签区。
  对应 template 中 `.detail-kicker`。
  内部显示来源、年份、地区和评分标签。
*/
.detail-kicker {
  /* 标签横向排列。 */
  display: flex;

  /* 标签在高度方向居中，避免图标和文字错位。 */
  align-items: center;

  /* 控制多个标签之间的距离。 */
  gap: 8px;

  /* 标签较多或屏幕较窄时允许换行。 */
  flex-wrap: wrap;

  /* 标签区和标题之间留出距离。 */
  margin-bottom: 18px;
}

/*
  Element UI 标签微调。
  对应 template 中多个 `.detail-tag`。
*/
.detail-tag {
  /* 统一成胶囊标签，保持详情页顶部元信息形态一致。 */
  border-radius: 999px;
}

/*
  来源标签。
  对应 template 中 `.detail-tag.kind-source`。
*/
.detail-tag.kind-source {
  /* 来源标签使用项目主题色，和普通年份、地区标签区分。 */
  color: var(--accent);

  /* 主题色浅边框让来源标签更醒目。 */
  border-color: rgba(91, 140, 255, 0.28);

  /* 浅主题背景表示它是当前页面关键状态。 */
  background: rgba(91, 140, 255, 0.08);
}

/*
  评分标签。
  对应 template 中 `.detail-tag.kind-rating`。
*/
.detail-tag.kind-rating {
  /* 评分使用暖色，符合用户对评分信息的直觉识别。 */
  color: #d97706;
}

/*
  详情主标题。
  对应 template 中 `.detail-title`。
*/
.detail-title {
  /* 去掉 h1 默认 margin，避免和自定义间距叠加。 */
  margin: 0;

  /* 使用详情页主标题层级，和区块标题保持明确区分。 */
  font-size: clamp(34px, 3.4vw, 46px);

  /* 标题行高收紧，避免多行标题显得松散。 */
  line-height: 1.12;

  /* 加粗突出视频标题。 */
  font-weight: 800;

  /* 主标题使用最高层级文字色。 */
  color: var(--text-primary);
}

/*
  视频别名。
  对应 template 中 `[if displayAlias]` 的 `.detail-alias`。
*/
.detail-alias {
  /* 控制别名和主标题之间的距离。 */
  margin: 8px 0 0;

  /* 弱文字色表示它不是主标题。 */
  color: var(--text-muted);

  /* 别名字号小于主标题。 */
  font-size: 15px;
}

/*
  核心元信息行。
  对应 template 中 `.detail-meta-line`。
  当前用于展示“主演”等详情页紧凑信息。
*/
.detail-meta-line {
  /* 使用 flex 横向排列字段名和值。 */
  display: flex;

  /* 垂直方向对齐字段名和值。 */
  align-items: center;

  /* 控制字段名和值之间的距离。 */
  gap: 22px;

  /* 控制元信息和标题之间的距离。 */
  margin-top: 24px;
}

/*
  元信息字段名。
  对应 template 中 `.detail-label`。
*/
.detail-label {
  /* 字段名使用弱文字色，避免和具体内容抢层级。 */
  color: var(--text-muted);

  /* 字段名字号略小，符合辅助标签定位。 */
  font-size: 14px;
}

/*
  元信息具体内容。
  对应 template 中 `.detail-value`。
*/
.detail-value {
  /* 内容使用次级正文色，比字段名更明显。 */
  color: var(--text-secondary);

  /* 元信息内容字号保持正文辅助层级。 */
  font-size: 14px;

  /* 行高放宽，长演员列表换行时更容易阅读。 */
  line-height: 1.8;
}

/*
  视频简介。
  对应 template 中 `.detail-summary`。
*/
.detail-summary {
  /* 控制简介和主演信息之间的距离。 */
  margin: 24px 0 0;

  /* 简介使用次级正文色，不抢标题层级。 */
  color: var(--text-secondary);

  /* 简介字号保持正文阅读大小。 */
  font-size: 15px;

  /* 行高放宽，长简介多行阅读更舒服。 */
  line-height: 1.9;

  /* 限制简介宽度，避免文字铺满整行不好读。 */
  max-width: 980px;
}

/*
  详情操作区。
  对应 template 中 `.detail-actions`。
*/
.detail-actions {
  /* 控制播放按钮和简介之间的距离，保持主要操作易于定位。 */
  margin-top: 26px;

  /* 按钮默认横向排列。 */
  display: flex;

  /* 多个按钮在高度方向居中。 */
  align-items: center;

  /* 控制操作按钮之间的距离。 */
  gap: 12px;

  /* 手机或按钮文字较长时允许换行。 */
  flex-wrap: wrap;
}

/*
  分集区外层卡片。
  对应 template 中 `.detail-episodes.theme-surface`。
*/
.detail-episodes {
  /* 给选集区内部留白，避免按钮贴住卡片边缘。 */
  padding: 28px;

  /* 为选集区保留稳定最小高度，空列表与短列表不会造成布局跳动。 */
  min-height: 160px;
}

/*
  分集区头部。
  对应 template 中 `.detail-section-head`。
*/
.detail-section-head {
  /* 标题区和下方分集内容之间留出距离。 */
  margin-bottom: 20px;
}

/*
  分集区标题。
  对应 template 中 `.detail-section-title`。
*/
.detail-section-title {
  /* 去掉 h2 默认 margin，让头部间距完全由父级控制。 */
  margin: 0;

  /* 使用区块标题字号，低于详情主标题层级。 */
  font-size: 24px;

  /* 使用主文字色，表示这是新的内容区块标题。 */
  color: var(--text-primary);
}

/*
  分集区说明文字。
  对应 template 中 `.detail-section-desc`。
*/
.detail-section-desc {
  /* 与标题保持小距离，形成标题说明组合。 */
  margin: 8px 0 0;

  /* 弱文字色表示它是辅助说明。 */
  color: var(--text-muted);

  /* 说明字号小于标题和正文。 */
  font-size: 13px;
}

/*
  分集按钮自然宽度换行列表。
  对应 template 中 `.episode-list`。
  所有视口共用同一个 Flex 流，断点只调整间距和触控尺寸。
*/
.episode-list {
  /* 使用 Flex 让每个按钮按真实内容宽度参与布局，不再拉伸为等宽列。 */
  display: flex;

  /* 当前行空间不足时自动换行，全部分集保持可见且不需要横向滚动。 */
  flex-wrap: wrap;

  /* 按钮高度不同时从行首对齐，长辅助信息不会拉乱相邻按钮的文字位置。 */
  align-items: flex-start;

  /* 控制分集按钮之间的横向和纵向间距。 */
  gap: 10px;
}

/*
  单个分集按钮。
  对应 template 中 `v-for="episode in episodes"` 的 `.episode-chip`。
*/
.episode-chip {
  /* 清除浏览器默认按钮外观，统一成项目自己的按钮样式。 */
  appearance: none;

  /* 按钮不增长也不压缩，基础宽度由真实文字和内边距共同决定。 */
  flex: 0 0 auto;

  /* 按钮宽度贴合内容；超长内容仍受父容器边界约束。 */
  width: fit-content;

  /* 单个长标签最多占满当前列表宽度，不允许撑破选集区。 */
  max-width: 100%;

  /* 最小高度满足鼠标和触屏点击面积，同时让单行短标签保持紧凑。 */
  min-height: 44px;

  /* 左右内边距照顾较长集数名称。 */
  padding: 9px 14px;

  /* 圆角略小于标签，表示它是普通分集按钮。 */
  border-radius: 8px;

  /* 边框给分集按钮明确边界。 */
  border: 1px solid rgba(148, 163, 184, 0.18);

  /* 白色半透明背景让按钮从选集区卡片中浮出来。 */
  background: rgba(255, 255, 255, 0.92);

  /* 按钮内部使用纵向排列，显示分集 label 和标题。 */
  display: flex;

  /* 分集 label 和标题上下排列。 */
  flex-direction: column;

  /* 左对齐更适合扫读长分集标题。 */
  align-items: flex-start;

  /* 控制分集 label 和标题之间的距离。 */
  gap: 4px;

  /* 鼠标手型提示可点击选择。 */
  cursor: pointer;

  /* hover 和 active 状态平滑过渡。 */
  transition: all 0.18s ease;

  /* 按钮文字左对齐，避免长标题居中后难读。 */
  text-align: left;

  /* 允许长中文、URL 式标识或无空格文本在按钮边界内换行。 */
  overflow-wrap: anywhere;

  /* 关闭按钮默认不换行行为，确保长标签完整显示。 */
  white-space: normal;
}

/*
  分集按钮 hover 和选中状态。
  hover 由鼠标移入触发，active 来自 `episode.id === selectedEpisodeId`。
*/
.episode-chip:hover,
.episode-chip.active {
  /* 文字使用主题色，提示当前按钮可交互或已选中。 */
  color: var(--accent);

  /* 边框切换为主题色透明版本，强化选中边界。 */
  border-color: rgba(91, 140, 255, 0.28);

  /* 浅主题背景表示当前分集被关注或选中。 */
  background: rgba(91, 140, 255, 0.08);

  /* 内阴影给选中态增加一点层次，但不改变按钮尺寸。 */
  box-shadow: inset 0 0 0 1px rgba(91, 140, 255, 0.06);
}

/*
  分集主标签。
  对应 template 中 `.episode-label`。
*/
.episode-label {
  /* 加粗分集编号，方便用户快速定位第几集。 */
  font-weight: 700;

  /* 使用主文字色保证可读性。 */
  color: var(--text-primary);

  /* 标签遵守按钮最大宽度，超长文本在自身内部完整换行。 */
  max-width: 100%;

  /* 主标签使用紧凑行高，单行按钮不会被无效空白撑高。 */
  line-height: 1.35;

  /* 没有自然断点的长标签仍可在容器边界内断行。 */
  overflow-wrap: anywhere;
}

/*
  分集副标题。
  对应 template 中 `.episode-title`。
*/
.episode-title {
  /* 字号小于分集编号，表示它是辅助信息。 */
  font-size: 12px;

  /* 弱文字色让副标题不抢编号层级。 */
  color: var(--text-muted);

  /* 辅助信息最多占满按钮宽度，不能反向撑破选集区。 */
  max-width: 100%;

  /* 长辅助信息允许自然换行并保持可读行距。 */
  line-height: 1.4;

  /* 无空格文本也必须在按钮边界内断行。 */
  overflow-wrap: anywhere;
}

/*
  整页空状态。
  对应 template 中 `[else]` 的 `.detail-page-empty.theme-surface`。
*/
.detail-page-empty {
  /* 提高整页空状态高度，避免页面显得塌陷。 */
  min-height: 420px;

  /* 使用 flex 让 Element UI 空状态内容居中。 */
  display: flex;

  /* 水平方向居中。 */
  align-items: center;

  /* 垂直方向居中。 */
  justify-content: center;
}

/*
  平板端详情布局。
  触发条件：视口宽度不超过 900px。
  原因：260px 海报列加正文列在平板宽度下容易挤压正文。
*/
@media (max-width: 900px) {
  .detail-hero {
    /* 改成单列后，海报在上、正文在下，阅读顺序更自然。 */
    grid-template-columns: 1fr;
  }

  .detail-poster {
    /* 单列模式下限制海报最大宽度，避免海报铺满整行。 */
    max-width: 240px;
  }

  .episode-list {
    /* 平板端缩小换行流间距，在保持自然宽度的同时提高分集浏览密度。 */
    gap: 8px;
  }
}

/*
  手机端详情布局。
  触发条件：视口宽度不超过 640px。
  调整目标：减少边距、压缩标题字号，并让分集按钮更适合窄屏。
*/
@media (max-width: 640px) {
  .detail-hero,
  .detail-episodes {
    /* 手机端收紧头图区和选集区内边距，把更多空间留给正文。 */
    padding: 16px;
  }

  .detail-title {
    /* 手机端标题字号缩小，避免长片名在窄屏下一行只有很少字。 */
    font-size: 24px;
  }

  .detail-meta-line {
    /* 手机端主演信息改成上下排列，避免字段名挤压内容。 */
    flex-direction: column;

    /* 手机端左对齐字段名和值。 */
    align-items: flex-start;

    /* 缩小字段名和值之间的间距。 */
    gap: 4px;
  }

  .episode-chip {
    /* 手机端保持至少 44px 点击高度，并略收紧横向内边距以容纳更多短分集。 */
    min-height: 44px;

    /* 内容宽度模型不变，只减少手机端按钮两侧留白。 */
    padding: 9px 12px;
  }
}
</style>
