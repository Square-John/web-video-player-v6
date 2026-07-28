<template>
  <!--
    VideoCard 组件渲染树

    [DEFAULT] ele(el-card.video-card)
    │  - condition:
    │      默认渲染。
    │      当父组件传入单个 ContentItem 视频对象时展示全站统一视频卡片。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-card
    │  - description:
    │      视频卡片根容器。
    │      使用封面区和正文区组成固定比例卡片，正文固定为五行信息结构。
    │  - params:
    │      -- video：父组件传入的统一 ContentItem 视频对象。
    │      -- favorite：父组件传入的收藏状态，控制收藏按钮高亮。
    │      -- playback：父组件或 UserVideoCard 传入的播放状态对象，用于展示已播放、正在播放和进度。
    │      -- showDelete：父组件传入的删除按钮开关，只用于播放历史等内部记录场景。
    │      -- navigationTarget：父组件可选传入的 Vue Router 目标；缺失时按 ContentItem 进入详情页。
    │  - events:
    │      @click.native
    │          - description:
    │              用户点击卡片主体时触发。
    │              操作按钮会阻止冒泡，避免同时进入详情页。
    │          - methods:
    │              openDetailPage()
    │
    │  ├─ [DEFAULT] ele(div.video-card__poster)
    │  │  - condition:
    │  │      默认渲染。
    │  │      封面区始终存在，用于展示海报、占位图、顶部 1-2 字段位和右下角评分。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: div
    │  │  - description:
    │  │      视频封面区。
    │  │      维持全站统一海报比例，并在顶部覆盖状态字段和操作按钮，在右下角覆盖评分。
    │  │  - params:
    │  │      -- displayCover：当前视频可用海报地址。
    │  │      -- statusBadgeText：电影清晰度或电视剧剧集字段。
    │  │      -- displayScore：当前视频评分展示文本。
    │  │      -- favorite：当前视频是否已收藏。
    │  │      -- showDelete：是否显示删除操作按钮。
    │  │  - events: 无
    │  │
    │  └─ [DEFAULT] ele(div.video-card__body)
    │     - condition:
    │         默认渲染。
    │         用于展示正文信息字段，包括标题、类型、元信息、数据源和播放状态。
    │     - type:
    │         原生标签
    │         标签名称: div
    │     - description:
    │         视频信息区。
    │         五行正文使用“左字段 + 中间弹性空白 + 右字段”的响应式 flex 布局。
    │         最近播放时间缺失时仍保留不可见语义占位行，保证不同用户状态下卡片等高。
    │     - params:
    │         -- displayTitle：视频标题兜底文本。
    │         -- typeBadgeText：电影或电视剧类型标识。
    │         -- displayMetaText：年份、地区和影视类型合成文本。
    │         -- sourceText：数据源展示文本。
    │         -- currentEpisodeText：电视剧已播放时的当前集文本。
    │         -- playbackStatusText：播放状态文本。
    │         -- recentPlayedAtText：最近播放时间文本。
    │         -- playbackTimeText：播放时间进度文本。
    │     - events: 无
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
      [DEFAULT] ele(div.video-card__poster)
      - condition:
          默认渲染。
          所有视频卡片都展示封面区，缺少封面时展示标题首字占位。
      - type:
          原生标签
          标签名称: div
      - description:
          统一海报区。
          承载左上角双 chip 角标、右上角操作区和海报主体。
      - params:
          -- hasCover：是否存在 poster 或 cover 图片地址。
          -- displayCover：当前使用的图片地址。
          -- fallbackInitial：无图占位时显示的标题首字。
      - events: 无
    -->
    <div class="video-card__poster">
      <!-- 有图片时优先显示 poster 或 cover，图片失败后隐藏并保留占位底色。 -->
      <img
        v-if="hasCover"
        class="video-card__cover"
        :src="displayCover"
        :alt="displayTitle"
        @error="handleCoverError" />

      <!-- 没有图片时显示标题首字，保证卡片封面区不空白。 -->
      <span v-else class="video-card__fallback">{{ fallbackInitial }}</span>

      <!--
        [DEFAULT] ele(div.video-card__top-row)
        - condition:
            默认渲染。
            所有视频卡片都在封面顶部展示字段 1、弹性空白和字段 2。
        - type:
            原生标签
            标签名称: div
        - description:
            封面顶部字段行。
            字段 1 显示电影清晰度或电视剧剧集状态，字段 2 显示收藏和可选删除操作。
        - params:
            -- statusBadgeText：清晰度、总集数或更新状态文案。
            -- favorite：当前视频是否已收藏。
            -- showDelete：是否显示删除按钮。
        - events:
            @click
                - description:
                    用户点击收藏或删除按钮时触发。
                    按钮会阻止事件冒泡，避免同时进入详情页。
                - methods:
                    handleToggleFavorite()
                    handleDelete()
      -->
      <div class="video-card__top-row">
        <span
          class="video-card__field video-card__field--top-status"
          :class="{ 'is-empty': !statusBadgeText }">
          {{ statusBadgeText }}
        </span>

        <span class="video-card__row-spacer"></span>

        <button
          type="button"
          class="video-card__action"
          :class="{ 'is-active': favorite }"
          :aria-label="favorite ? '取消收藏' : '收藏视频'"
          @click.stop="handleToggleFavorite"
          @keydown.stop>
          <i :class="favorite ? 'el-icon-star-on' : 'el-icon-star-off'"></i>
        </button>

        <button
          v-if="showDelete"
          type="button"
          class="video-card__action video-card__action--danger"
          aria-label="删除播放历史"
          @click.stop="handleDelete"
          @keydown.stop>
          <i class="el-icon-close"></i>
        </button>
      </div>

      <!--
        [IF hasScore] ele(span.video-card__poster-score)
        - condition:
            当当前视频存在评分时渲染。
            评分从正文元信息行移动到封面右下角，避免挤压年份、地区和影视类型。
        - type:
            原生标签
            标签名称: span
        - description:
            封面评分标识。
            在海报右下角展示评分，让评分保持醒目，同时释放正文元信息行宽度。
        - params:
            -- displayScore：当前视频评分展示文本。
        - events: 无
      -->
      <span v-if="hasScore" class="video-card__poster-score">
        <i class="el-icon-star-on"></i>
        {{ displayScore }}
      </span>
    </div>

    <!--
      [DEFAULT] ele(div.video-card__body)
      - condition:
          默认渲染。
          封面下方始终展示统一信息区。
      - type:
          原生标签
          标签名称: div
      - description:
          卡片正文区。
          固定展示标题、基础元信息、数据源、最近播放和播放状态五行结构。
      - params:
          -- displayTitle：视频标题兜底文本。
          -- displayMetaText：年份、地区和类型合成文本。
          -- sourceText：数据源展示文本。
          -- typeBadgeText：电影或电视剧类型标识。
          -- playbackStatusText：播放状态文本。
          -- recentPlayedAtText：最近播放时间文本。
          -- playbackTimeText：播放时间进度文本。
      - events: 无
    -->
    <div class="video-card__body">
      <!--
        [DEFAULT] ele(div.video-card__title-row)
        - condition:
            默认渲染。
            字段 3 和字段 4 都属于卡片主识别信息。
        - type:
            原生标签
            标签名称: div
        - description:
            标题字段行。
            左侧 50% 展示标题，右侧 30% 展示电影或电视剧类型标识。
        - params:
            -- displayTitle：视频标题。
            -- typeBadgeText：电影或电视剧类型标识。
        - events: 无
      -->
      <div class="video-card__info-row video-card__title-row">
        <h3 class="video-card__title">{{ displayTitle }}</h3>
        <span class="video-card__row-spacer"></span>
        <span class="video-card__field video-card__field--content-type">{{ typeBadgeText }}</span>
      </div>

      <!--
        [DEFAULT] ele(div.video-card__meta-row)
        - condition:
            默认渲染。
            字段 5 独占正文第二行。
        - type:
            原生标签
            标签名称: div
        - description:
            元信息字段行。
            年份、地区和影视类型独占整行，减少正文信息被评分挤压导致显示不全。
        - params:
            -- displayMetaText：年份、地区和影视类型合成文本。
        - events: 无
      -->
      <div class="video-card__info-row video-card__meta-row">
        <span class="video-card__meta-text">{{ displayMetaText }}</span>
      </div>

      <!--
        [DEFAULT] ele(div.video-card__source-row)
        - condition:
            默认渲染。
            字段 8 只有电视剧且存在播放记录当前集时展示。
        - type:
            原生标签
            标签名称: div
        - description:
            来源字段行。
            左侧 50% 展示数据源，右侧 35% 展示电视剧当前播放集。
        - params:
            -- sourceText：数据源展示文本。
            -- currentEpisodeText：电视剧当前播放集文本。
        - events: 无
      -->
      <div class="video-card__info-row video-card__source-row">
        <span class="video-card__field video-card__field--source" :title="sourceText">
          {{ sourceText }}
        </span>
        <span class="video-card__row-spacer"></span>
        <span
          v-if="currentEpisodeText"
          class="video-card__field video-card__field--episode"
          :title="currentEpisodeText">
          {{ currentEpisodeText }}
        </span>
      </div>

      <!--
        [DEFAULT] ele(div.video-card__recent-row)
        - condition:
            默认渲染，保证所有卡片正文都具有相同的五行 DOM 结构。
            没有最近播放时间时增加 is-empty 状态并隐藏整行可见内容，但继续保留真实行高。
        - type:
            原生标签
            标签名称: div
        - description:
            最近播放时间字段行。
            展示当前内容最近一次播放时间，用于个人中心、列表页和详情联动后的状态扫读。
            空状态通过 aria-hidden 从可访问性树中隐藏，避免读取没有业务意义的占位内容。
        - params:
            -- recentPlayedAtText：最近播放时间短文本。
        - events: 无
      -->
      <div
        class="video-card__info-row video-card__recent-row"
        :class="{ 'is-empty': !hasRecentPlayedAtText }"
        :aria-hidden="hasRecentPlayedAtText ? 'false' : 'true'">
        <span class="video-card__recent-label">最近播放</span>
        <span class="video-card__row-spacer"></span>
        <span class="video-card__recent-time">{{ recentPlayedAtText }}</span>
      </div>

      <!--
        [DEFAULT] ele(div.video-card__progress-row)
        - condition:
            默认渲染。
            播放状态和播放时间始终作为最后一行展示。
        - type:
            原生标签
            标签名称: div
        - description:
            播放进度字段行。
            左侧状态按真实文本自然占宽，右侧时间按内容获得必要宽度并靠右展示。
        - params:
            -- playbackStatusText：播放状态文本。
            -- playbackTimeText：播放时间进度文本。
        - events: 无
      -->
      <div class="video-card__info-row video-card__progress-row">
        <span class="video-card__progress-label">{{ playbackStatusText }}</span>
        <span class="video-card__row-spacer"></span>
        <span class="video-card__progress-time">{{ playbackTimeText }}</span>
      </div>
    </div>
  </el-card>
</template>

<script>
/*
  VideoCard.vue 模块说明

  - 文件职责:
      渲染全站统一内容卡片，并接收父组件整理后的收藏、播放状态和可选导航目标。
      组件不读取用户内容 store，不把页面导航字段写入 ContentItem。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      CONTENT_TYPE_TEXT_MAP: object，用于把统一 ContentItem.type 转成人类可读类型兜底文案。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      VideoCard: Vue component，供首页、目录、搜索和个人中心的 UserVideoCard 统一渲染内容卡片。
*/

// 类型: object。
// 作用: 保存视频类型兜底文案，供卡片在 genres 缺失时仍可展示基础类型。
const CONTENT_TYPE_TEXT_MAP = {
  // 类型: string。
  // 作用: movie 类型内容在卡片元信息中的兜底类型文案。
  movie: '电影',

  // 类型: string。
  // 作用: tv 类型内容在卡片元信息中的兜底类型文案。
  tv: '电视剧',

  // 类型: string。
  // 作用: series 类型内容兼容电视剧文案，避免外部数据源使用 series 时显示空类型。
  series: '电视剧'
};

export default {
  // 组件名称用于在 Vue 调试工具中识别全站统一视频卡片。
  name: 'VideoCard',

  props: {
    // 类型: object。
    // 来源: 父组件传入的统一 ContentItem。
    // 作用: 驱动卡片封面、标题、角标、元信息、评分、数据源和详情页跳转。
    // 字段: id，string，视频唯一标识，用于详情页路由参数。
    // 字段: sourceId，string，数据源唯一标识，用于详情页保持来源上下文。
    // 字段: type，string，内容类型，用于区分电影和电视剧。
    // 字段: poster/cover，string，海报或封面地址，用于封面区展示。
    // 字段: tv.updateStatus，string，电视剧更新状态，用于左上角主角标。
    video: {
      type: Object,
      required: true
    },

    // 类型: boolean。
    // 来源: 父组件或 UserVideoCard 容器整理后的用户内容状态。
    // 作用: 控制收藏按钮是否显示为已收藏状态。
    // true: 收藏按钮高亮，表示当前视频已收藏。
    // false: 收藏按钮使用默认状态，表示当前视频未收藏。
    favorite: {
      type: Boolean,
      default: false
    },

    // 类型: object|null。
    // 来源: 父组件或 UserVideoCard 容器整理后的用户播放状态。
    // 作用: 控制扩展行 1 右侧当前集 chip，以及扩展行 2 的播放进度文本。
    // 字段: played，boolean，true 表示已播放，false 表示从未播放。
    // 字段: playing，boolean，true 表示当前内容正在播放器中播放。
    // 字段: currentEpisode，string|number，电视剧已播放时展示正在播放第几集。
    // 字段: recentPlayedAtText，string，最近播放时间短文本，存在时卡片新增最近播放行。
    // 字段: playedTimeText，string，已播放时间文本。
    // 字段: totalTimeText，string，总时长文本。
    playback: {
      type: Object,
      default: null
    },

    // 类型: boolean。
    // 来源: 父组件根据当前列表语义传入。
    // 作用: 控制是否显示删除按钮。
    // true: 显示删除按钮，适合播放历史等内部记录列表。
    // false: 不显示删除按钮，首页、目录页、搜索页和收藏页只保留收藏按钮。
    showDelete: {
      type: Boolean,
      default: false
    },

    // 类型: object|null。
    // 来源: 父组件按当前列表交互语义提供的 Vue Router 目标；播放历史由 playerNavigationService 生成。
    // 作用: 把卡片点击目标与 ContentItem 分离，避免把页面导航字段保存进外部内容契约。
    // null: 使用 video.sourceId + video.id 进入详情页。
    // object: 使用该命名路由目标进入父组件指定页面，例如精确恢复某条播放历史。
    navigationTarget: {
      type: Object,
      default: null
    }
  },

  computed: {
    /**
     * 当前视频对象兜底。
     * 该计算属性只给组件内部读取字段使用，不修改父级传入数据。
     * 纯函数: 只读取 video prop 并返回对象引用或空对象，不修改父级数据。
     *
     * @returns {Object} 当前视频对象或空对象。
     */
    normalizedVideo() {
      // 返回值类型: object。
      // 作用: 避免 video 缺失或异常时后续字段读取报错。
      return this.video || {};
    },

    /**
     * 当前视频是否为电视剧。
     * 纯函数: 只读取 normalizedVideo.type 并返回类型判断结果。
     *
     * @returns {boolean} type 为 tv 或 series 时返回 true。
     */
    isTvContent() {
      // 类型: string。
      // 作用: 统一把 type 转成小写，兼容后续数据源可能返回的大小写差异。
      const contentType = String(this.normalizedVideo.type || '').toLowerCase();

      // 返回值类型: boolean。
      // 作用: 判断当前卡片是否应该使用电视剧角标和集数展示逻辑。
      return contentType === 'tv' || contentType === 'series';
    },

    /**
     * 是否存在可展示封面。
     * 纯函数: 只读取 displayCover 并返回存在性判断。
     *
     * @returns {boolean} poster 或 cover 有值时返回 true。
     */
    hasCover() {
      // 返回值类型: boolean。
      // 作用: 控制 template 渲染真实图片还是标题首字占位。
      return Boolean(this.displayCover);
    },

    /**
     * 当前封面展示地址。
     * 卡片是竖版海报场景，因此优先读取 poster，再用 cover 兜底。
     * 纯函数: 只读取当前 ContentItem，不修改图片字段或页面状态。
     *
     * @returns {string} 当前可用海报地址。
     */
    displayCover() {
      // 类型: object。
      // 作用: 保存当前视频对象引用，减少重复访问 computed。
      const video = this.normalizedVideo;

      // 返回值类型: string。
      // 作用: 优先使用竖版 poster，缺失时使用通用 cover。
      return video.poster || video.cover || '';
    },

    /**
     * 标题展示文本。
     * 纯函数: 只读取并清理当前标题，不修改 ContentItem。
     *
     * @returns {string} 视频标题或兜底标题。
     */
    displayTitle() {
      // 类型: string。
      // 作用: 去掉标题两端空白，避免空格标题撑开卡片但不可读。
      const title = String(this.normalizedVideo.title || '').trim();

      // 返回值类型: string。
      // 作用: 标题缺失时显示稳定兜底文案。
      return title || '未命名内容';
    },

    /**
     * 封面占位首字。
     * 纯函数: 只读取 displayTitle 并截取展示字符。
     *
     * @returns {string} 标题首字或默认占位字。
     */
    fallbackInitial() {
      // 类型: string。
      // 作用: 从展示标题里取首字，让无图卡片仍可快速识别内容。
      const title = this.displayTitle;

      // 返回值类型: string。
      // 作用: 有标题时取首字，没有标题时使用“影”作为视频类占位。
      return title ? title.slice(0, 1) : '影';
    },

    /**
     * 左上角类型 chip 文本。
     * 统一显示当前视频属于电影还是电视剧。
     * 纯函数: 只读取内容类型并返回展示文案。
     *
     * @returns {string} 电影或电视剧文案。
     */
    typeBadgeText() {
      // 类型: string。
      // 作用: type 缺失时默认按电影处理，避免左上角类型 chip 空白。
      const contentType = this.isTvContent ? 'tv' : 'movie';

      // 返回值类型: string。
      // 作用: 返回用户可读的视频类型文案。
      return CONTENT_TYPE_TEXT_MAP[contentType] || '电影';
    },

    /**
     * 左上角状态 chip 文本。
     * 电影显示清晰度，电视剧显示集数或更新状态。
     * 纯函数: 只按 ContentItem 字段优先级派生状态文案。
     *
     * @returns {string} 状态 chip 文本。
     */
    statusBadgeText() {
      // 类型: object。
      // 作用: 保存当前视频对象引用，用于读取通用字段和类型字段。
      const video = this.normalizedVideo;

      // 类型: object。
      // 作用: 保存电视剧字段对象，用于读取 updateStatus 和 totalEpisodes。
      const tv = video.tv || {};

      // 条件分支: 当前内容是电视剧时进入。
      // 执行内容: 优先显示更新状态，其次显示总集数，最后使用通用 badge 或 quality。
      if (this.isTvContent) {
        return tv.updateStatus || this.totalEpisodeText || video.badge || video.quality || '';
      }

      // 返回值类型: string。
      // 作用: 电影优先显示清晰度，缺失时显示通用 badge，没有状态时不渲染第二枚 chip。
      return video.quality || video.badge || '';
    },

    /**
     * 电视剧总集数展示文本。
     * 纯函数: 只读取 tv.totalEpisodes 并派生展示文案。
     *
     * @returns {string} 全 xx 集文案或空字符串。
     */
    totalEpisodeText() {
      // 类型: object。
      // 作用: 保存电视剧字段对象，避免 tv 字段缺失时读取报错。
      const tv = this.normalizedVideo.tv || {};

      // 条件分支: totalEpisodes 有值时进入。
      // 执行内容: 转成用户可读的总集数文案。
      if (tv.totalEpisodes) {
        return `全${tv.totalEpisodes}集`;
      }

      // 返回值类型: string。
      // 作用: 没有总集数字段时不渲染集数文案。
      return '';
    },

    /**
     * 年份、地区和类型展示数组。
     * 最多返回三个字段，全部缺失时返回空数组。
     * 纯函数: 返回新数组，不修改 ContentItem.genres 或其它字段。
     *
     * @returns {Array<string>} 元信息片段数组。
     */
    displayMetaItems() {
      // 类型: object。
      // 作用: 保存当前视频对象引用，用于读取年份、地区和类型字段。
      const video = this.normalizedVideo;

      // 类型: string。
      // 作用: 取 genres 第一个元素作为卡片类型，不让长类型列表挤占正文宽度。
      const genre = Array.isArray(video.genres) && video.genres.length ? video.genres[0] : '';

      // 类型: string。
      // 作用: genres 缺失时根据 type 提供电影或电视剧兜底类型。
      const fallbackTypeText = CONTENT_TYPE_TEXT_MAP[video.type] || '';

      // 类型: Array<string|number>。
      // 作用: 按用户要求从年份、地区、类型里尽力展示最多三个字段。
      const rawItems = [video.year, video.area, genre || fallbackTypeText];

      // 返回值类型: Array<string>。
      // 作用: 去掉空值并限制最多三个，供 template 合成元信息行。
      return rawItems.filter(Boolean).map(item => String(item)).slice(0, 3);
    },

    /**
     * 年份、地区和类型合成文本。
     * 纯函数: 只连接 displayMetaItems，不修改数组或页面状态。
     *
     * @returns {string} 用斜杠分隔的元信息文本。
     */
    displayMetaText() {
      // 返回值类型: string。
      // 作用: 使用斜杠连接元信息，符合用户指定的“年份 / 地区 / 类型”布局。
      return this.displayMetaItems.join(' / ');
    },

    /**
     * 是否存在评分。
     * 纯函数: 只读取 score 并返回存在性判断。
     *
     * @returns {boolean} score 有效时返回 true。
     */
    hasScore() {
      // 类型: *。
      // 作用: score 允许数字或字符串，0 分也应该被视为有效评分。
      const score = this.normalizedVideo.score;

      // 返回值类型: boolean。
      // 作用: 只有 null、undefined 和空字符串不渲染评分。
      return score !== null && score !== undefined && score !== '';
    },

    /**
     * 评分展示文本。
     * 纯函数: 只返回当前 ContentItem.score，不修改原值。
     *
     * @returns {string|number} 评分字段原值。
     */
    displayScore() {
      // 返回值类型: string|number。
      // 作用: 评分存在时直接展示数据源清洗后的统一 score 字段。
      return this.normalizedVideo.score;
    },

    /**
     * 是否渲染基础元信息行。
     * 纯函数: 只读取派生元信息与评分存在性。
     *
     * @returns {boolean} 元信息或评分至少存在一个时返回 true。
     */
    hasMetaRow() {
      // 返回值类型: boolean。
      // 作用: 避免年份地区类型和评分都缺失时留下空行。
      return Boolean(this.displayMetaText || this.hasScore);
    },

    /**
     * 数据源展示文本。
     * 当前阶段优先读取 ContentItem.sourceName 或 sourceId，后续可接源列表名称映射。
     * 纯函数: 只读取当前内容来源字段并返回展示兜底。
     *
     * @returns {string} 数据源名称、数据源 id 或占位文案。
     */
    sourceText() {
      // 类型: object。
      // 作用: 保存当前视频对象引用，用于读取来源字段。
      const video = this.normalizedVideo;

      // 返回值类型: string。
      // 作用: sourceName 缺失时用 sourceId 兜底，再缺失时显示占位数据源。
      return video.sourceName || video.sourceId || '当前数据源';
    },

    /**
     * 标准化播放状态对象。
     * VideoCard 不直接读取用户内容 store，只消费父级传入的播放状态并整理成稳定展示字段。
     * 纯函数: 返回新的展示对象，不修改 playback prop 或 ContentItem。
     *
     * @returns {Object} 播放状态对象。
     * @returns {boolean} return.played 是否已播放。
     * @returns {string|number} return.currentEpisode 当前播放集。
     * @returns {boolean} return.playing 当前内容是否正在播放。
     * @returns {string} return.playedTimeText 已播放时间文本。
     * @returns {string} return.totalTimeText 总时长文本。
     * @returns {string} return.recentPlayedAtText 最近播放时间文本。
     */
    normalizedPlayback() {
      // 类型: object。
      // 作用: playback 缺失时使用空对象兜底，普通页面默认按未播放显示。
      const playback = this.playback || {};

      // 返回值类型: object。
      // 作用: 返回稳定播放状态对象，供扩展行 1 和扩展行 2 读取。
      return {
        // 类型: boolean。
        // 作用: true 时扩展行 2 显示已播放，false 时显示从未播放。
        played: Boolean(playback.played),

        // 类型: boolean。
        // 作用: true 时扩展行 2 显示正在播放，供播放页联动所有同内容卡片。
        playing: Boolean(playback.playing),

        // 类型: string|number。
        // 作用: 电视剧已播放时用于显示“正在播放第几集”。
        currentEpisode: playback.currentEpisode || '',

        // 类型: string。
        // 作用: 已播放时间文本，缺失时统一用 00:00 占位。
        playedTimeText: this.formatPlaybackTime(playback.playedTimeText || '00:00'),

        // 类型: string。
        // 作用: 总时长文本，优先使用内部播放状态，其次使用 ContentItem 可推导时长。
        totalTimeText: this.formatPlaybackTime(playback.totalTimeText || this.totalDurationText),

        // 类型: string。
        // 作用: 最近播放时间文本，存在时驱动正文最近播放行渲染。
        recentPlayedAtText: playback.recentPlayedAtText || ''
      };
    },

    /**
     * 是否存在最近播放时间。
     * 最近播放行始终保留，该值只控制内容可见性和 aria-hidden 语义。
     * 纯函数: 只读取 recentPlayedAtText 并返回存在性判断。
     *
     * @returns {boolean} 最近播放时间存在时返回 true。
     */
    hasRecentPlayedAtText() {
      // 返回值类型: boolean。
      // 作用: 控制最近播放行的空状态样式和可访问性语义，不改变固定五行 DOM 结构。
      return Boolean(this.recentPlayedAtText);
    },

    /**
     * 最近播放时间展示文本。
     * 该字段来自 UserVideoCard 整理后的用户播放状态，不属于外部 ContentItem 字段。
     * 纯函数: 只读取 normalizedPlayback 的展示字段。
     *
     * @returns {string} 最近播放时间短文本。
     */
    recentPlayedAtText() {
      // 返回值类型: string。
      // 作用: 统一读取标准化播放状态中的最近播放时间，缺失时返回空字符串。
      return this.normalizedPlayback.recentPlayedAtText || '';
    },

    /**
     * 当前播放集文本。
     * 只有电视剧且已经播放过，才显示右侧当前集 chip。
     * 纯函数: 只读取内容类型和播放状态并派生集数文案。
     *
     * @returns {string} 正在播放第几集文案或空字符串。
     */
    currentEpisodeText() {
      // 条件分支: 当前内容不是电视剧时进入。
      // 执行内容: 电影不显示当前集 chip，保持扩展行右侧为空。
      if (!this.isTvContent) {
        return '';
      }

      // 条件分支: 当前内容没有播放记录时进入。
      // 执行内容: 未播放电视剧不显示当前集 chip，避免误导用户。
      if (!this.normalizedPlayback.played) {
        return '';
      }

      // 类型: string|number。
      // 作用: 当前播放集来自标准化播放状态，用于电视剧卡片右侧字段位展示。
      const currentEpisode = this.normalizedPlayback.currentEpisode;

      // 条件分支: 当前集缺失时进入。
      // 执行内容: 不渲染右侧 chip，避免显示假的播放集。
      if (!currentEpisode) {
        return '';
      }

      // 返回值类型: string。
      // 作用: 使用短文案填充字段 8，避免长文本破坏 35% 字段位的扫读节奏。
      return `第${currentEpisode}集`;
    },

    /**
     * 播放进度文本中的状态前缀。
     * 纯函数: 只读取 normalizedPlayback 并返回状态文案。
     *
     * @returns {string} 正在播放、已播放或从未播放。
     */
    playbackStatusText() {
      // 条件分支: 当前内容正在播放器中播放时进入。
      // 执行内容: 优先显示“正在播放”，保证当前播放状态比历史状态更明确。
      if (this.normalizedPlayback.playing) {
        return '正在播放';
      }

      // 返回值类型: string。
      // 作用: 根据内部播放状态占位决定扩展行 2 的左侧状态文案。
      return this.normalizedPlayback.played ? '已播放' : '从未播放';
    },

    /**
     * 播放进度文本中的时间部分。
     * 纯函数: 只读取标准化时间并组合展示文本。
     *
     * @returns {string} 已播放时间和可选总时长。
     */
    playbackTimeText() {
      // 类型: string。
      // 作用: 已播放时间来自内部播放状态；未接入时使用 00:00 占位。
      const playedTimeText = this.normalizedPlayback.playedTimeText || '00:00';

      // 类型: string。
      // 作用: 总时长优先来自内部播放状态，其次来自 ContentItem 可推导时长。
      const totalTimeText = this.normalizedPlayback.totalTimeText || '';

      // 条件分支: 总时长存在时进入。
      // 执行内容: 展示“已播放时间/总时长”的完整进度结构。
      if (totalTimeText) {
        return `${playedTimeText}/${totalTimeText}`;
      }

      // 返回值类型: string。
      // 作用: 总时长缺失时只展示已播放时间，不伪造总时长。
      return playedTimeText;
    },

    /**
     * 播放进度展示文本。
     * 纯函数: 只组合状态与进度展示文本。
     *
     * @returns {string} 播放状态和进度文本。
     */
    playbackProgressText() {
      // 返回值类型: string。
      // 作用: 组合播放状态和时间，形成统一扩展行 2 文案。
      return `${this.playbackStatusText} ${this.playbackTimeText}`;
    },

    /**
     * 总时长展示文本。
     * 当前阶段尽量从 ContentItem.movie.duration 读取，后续可由播放状态覆盖。
     * 纯函数: 只读取内容时长字段并返回文本。
     *
     * @returns {string} 总时长文本或空字符串。
     */
    totalDurationText() {
      // 类型: object。
      // 作用: 保存电影字段对象，用于读取总时长。
      const movie = this.normalizedVideo.movie || {};

      // 类型: string|number。
      // 作用: 读取内容对象中已经清洗好的片长字段。
      const duration = movie.duration || this.normalizedVideo.duration || '';

      // 返回值类型: string。
      // 作用: 有总时长就展示，没有总时长就让进度行只显示当前播放时间。
      return duration ? String(duration) : '';
    },

  },

  methods: {
    /**
     * 格式化播放时间。
     * 统一把秒数、分钟文案和冒号时间整理成 HH:mm:ss 或 mm:ss。
     * 有小时位时显示小时位，没有小时位时只显示分秒位。
     * 纯函数: 只读取 value 并返回格式化文本，不修改组件状态。
     *
     * @param {string|number} value 原始时间值，可以是秒数、128分钟、45:00 或 01:20:30。
     * @returns {string} 标准化后的时间文本；无法识别时返回原始文本。
     */
    formatPlaybackTime(value) {
      // 条件分支: 时间值为空时进入。
      // 执行内容: 返回空字符串，避免进度行伪造不存在的总时长。
      if (value === null || value === undefined || value === '') {
        return '';
      }

      // 类型: string。
      // 作用: 统一把输入转成字符串，方便执行正则和分段处理。
      const rawValue = String(value).trim();

      // 条件分支: 原始值是纯数字时进入。
      // 执行内容: 按秒数处理，适配后续播放状态仓库可能存秒值的情况。
      if (/^\d+$/.test(rawValue)) {
        return this.formatSecondsToClock(Number(rawValue));
      }

      // 类型: RegExpMatchArray|null。
      // 作用: 匹配“128分钟”这类总时长文案。
      const minuteMatch = rawValue.match(/^(\d+)\s*分钟$/);

      // 条件分支: 匹配到分钟文案时进入。
      // 执行内容: 转成秒数后格式化为时分秒或分秒。
      if (minuteMatch) {
        return this.formatSecondsToClock(Number(minuteMatch[1]) * 60);
      }

      // 条件分支: 原始值已经是 mm:ss 或 HH:mm:ss 时进入。
      // 执行内容: 规范化每一段补零，并按是否有小时位决定最终格式。
      if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(rawValue)) {
        // 类型: Array<string>。
        // 作用: 拆分冒号时间，判断是两段还是三段。
        const parts = rawValue.split(':');

        // 条件分支: 三段时间进入。
        // 执行内容: 小时、分钟、秒都补齐两位。
        if (parts.length === 3) {
          return parts.map(part => String(Number(part)).padStart(2, '0')).join(':');
        }

        // 返回值类型: string。
        // 作用: 两段时间只保留分秒位，符合没有小时位时显示分秒的规则。
        return parts.map(part => String(Number(part)).padStart(2, '0')).join(':');
      }

      // 返回值类型: string。
      // 作用: 无法识别的时间格式保持原样，避免误删数据源提供的信息。
      return rawValue;
    },

    /**
     * 把秒数格式化成时钟文本。
     * 有小时位时返回 HH:mm:ss，没有小时位时返回 mm:ss。
     * 纯函数: 只读取 totalSeconds 并返回格式化文本，不修改组件状态。
     *
     * @param {number} totalSeconds 总秒数。
     * @returns {string} 格式化后的时间文本。
     */
    formatSecondsToClock(totalSeconds) {
      // 类型: number。
      // 作用: 秒数异常时按 0 处理，避免 NaN 出现在页面上。
      const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;

      // 类型: number。
      // 作用: 计算完整小时数，用于判断是否显示小时位。
      const hours = Math.floor(safeSeconds / 3600);

      // 类型: number。
      // 作用: 计算去掉小时后的分钟数。
      const minutes = Math.floor((safeSeconds % 3600) / 60);

      // 类型: number。
      // 作用: 计算剩余秒数。
      const seconds = safeSeconds % 60;

      // 类型: string。
      // 作用: 分钟位始终补齐两位，保证播放时间对齐。
      const minuteText = String(minutes).padStart(2, '0');

      // 类型: string。
      // 作用: 秒位始终补齐两位，保证播放时间对齐。
      const secondText = String(seconds).padStart(2, '0');

      // 条件分支: 存在小时位时进入。
      // 执行内容: 返回 HH:mm:ss 格式。
      if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${minuteText}:${secondText}`;
      }

      // 返回值类型: string。
      // 作用: 没有小时位时返回 mm:ss 格式。
      return `${minuteText}:${secondText}`;
    },

    /**
     * 打开当前卡片的目标页面。
     * 点击卡片主体或键盘 Enter、Space 时触发。
     * 成功路径: 父组件提供 navigationTarget 时使用显式目标；否则根据 ContentItem 身份进入详情页。
     * 失败路径: 没有显式目标且 id/sourceId 缺失时不导航；非重复路由错误继续抛给全局错误链。
     * 副作用: 调用当前 Vue Router push 改变页面路由，不修改 ContentItem、用户状态或父组件数据。
     *
     * @returns {void} 触发 Vue Router 导航后结束。
     */
    openDetailPage() {
      // 类型: object。
      // 作用: 保存当前视频对象引用，默认导航需要从中读取内容身份。
      const video = this.normalizedVideo;

      // 类型: boolean。
      // 作用: 判断父组件是否提供独立路由目标；对象字段由 Vue Router 在执行导航时校验。
      const hasCustomNavigationTarget = Boolean(
        this.navigationTarget
        && typeof this.navigationTarget === 'object'
        && !Array.isArray(this.navigationTarget)
      );

      // 条件分支: 没有显式导航目标且 ContentItem 的 id 或 sourceId 缺失时进入。
      // 执行内容: 直接返回，避免默认跳转到无法请求详情数据的页面。
      if (!hasCustomNavigationTarget && (!video.id || !video.sourceId)) {
        return;
      }

      // 类型: object。
      // 作用: 显式目标保持历史记录播放上下文；默认目标只携带详情页所需内容身份。
      const target = hasCustomNavigationTarget
        ? this.navigationTarget
        : {
          name: 'detail',
          params: {
            sourceId: video.sourceId,
            videoId: video.id
          }
        };

      // 副作用: 使用当前 Router 导航到目标页面；Promise reject 只忽略 Vue Router 的重复导航错误。
      this.$router.push(target).catch((error) => {
        // 条件分支: 重复导航错误以外的错误进入。
        // 执行内容: 抛出真实路由错误，避免吞掉非预期问题。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    },

    /**
     * 通知父组件切换收藏状态。
     * VideoCard 保持纯展示职责，不直接写入用户状态，只把当前视频对象交给上层容器处理。
     * 副作用: 派发 toggle-favorite 组件事件，不直接写用户内容 store。
     *
     * @returns {void} 通过 toggle-favorite 事件向父组件传出当前视频对象。
     */
    handleToggleFavorite() {
      // 事件: toggle-favorite。
      // 作用: 通知父组件当前视频触发了收藏切换操作。
      // 参数: normalizedVideo，object，当前视频对象。
      this.$emit('toggle-favorite', this.normalizedVideo);
    },

    /**
     * 通知父组件删除当前记录。
     * 只有 showDelete 为 true 的场景会展示删除按钮。
     * 副作用: 派发 delete 组件事件，不直接删除用户历史。
     *
     * @returns {void} 通过 delete 事件向父组件传出当前视频对象。
     */
    handleDelete() {
      // 事件: delete。
      // 作用: 通知父组件删除当前卡片对应的内部记录。
      // 参数: normalizedVideo，object，当前视频对象。
      this.$emit('delete', this.normalizedVideo);
    },

    /**
     * 封面加载失败处理。
     * 图片失败后隐藏图片节点，保留封面区背景和其它卡片信息。
     * 副作用: 仅隐藏当前触发错误的 img DOM 节点，不修改 ContentItem 封面地址。
     *
     * @param {Event} event 图片加载错误事件。
     * @returns {void} 该方法只修改当前图片节点显示状态。
     */
    handleCoverError(event) {
      // 条件分支: 事件目标存在时进入。
      // 执行内容: 隐藏失败图片，避免破图图标影响卡片视觉。
      if (event && event.target) {
        event.target.style.display = 'none';
      }
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 新版视频卡片根节点 `.video-card`。
  样式作用:
  使用共享字段位变量和自然宽度规则统一管理 VideoCard 内部信息布局。
  保持卡片宽度跟随父级栅格响应式变化，不再通过像素宽度修补字段位置。
  让固定字段继续共享比例，状态和时间按真实内容获得必要宽度。
*/
.video-card {
  /* 设置顶部字段 1 的布局占比，承载电影清晰度或电视剧剧集字段。 */
  --video-card-top-status-basis: 40%;

  /* 设置顶部单个操作按钮的布局占比，收藏和删除各自占据一份操作字段位。 */
  --video-card-top-action-basis: 20%;

  /* 设置标题字段 3 的布局占比，保证标题在正文第一行拥有主要扫读空间。 */
  --video-card-title-basis: 50%;

  /* 设置内容类型字段 4 的布局占比，用于显示电影或电视剧标识。 */
  --video-card-content-type-basis: 30%;

  /* 设置元信息字段 5 的布局占比，用于显示年份、地区和影视类型。 */
  --video-card-meta-basis: 60%;

  /* 设置数据源字段 7 的布局占比，用于显示当前内容来源。 */
  --video-card-source-basis: 50%;

  /* 设置当前集字段 8 的布局占比，用于电视剧已播放场景显示当前播放集。 */
  --video-card-episode-basis: 35%;

  /* 设置字段行之间的响应式间距，让卡片变窄时仍保留基本呼吸感。 */
  --video-card-row-gap: clamp(0.32rem, 1.4vw, 0.48rem);

  /* 设置字段位之间的响应式横向间距，避免相邻字段贴在一起。 */
  --video-card-column-gap: clamp(0.14rem, 0.8vw, 0.32rem);

  /* 设置覆盖在封面上的顶部行内边距，保证字段 1 和操作按钮不贴边。 */
  --video-card-overlay-inset: clamp(0.28rem, 1vw, 0.44rem);

  /* 设置字段标签高度，随字号和视口轻微响应，避免依赖固定像素宽度。 */
  --video-card-field-height: clamp(1.36rem, 2.4vw, 1.68rem);

  /* 设置字段标签字号，比上一版收小一档，避免字段位内文字显得拥挤。 */
  --video-card-field-font-size: clamp(0.6rem, 0.72vw, 0.7rem);

  /* 设置字段标签横向内边距，用于给省略号文本留下边界缓冲。 */
  --video-card-field-padding-x: clamp(0.38rem, 1vw, 0.58rem);

  /* 设置正文内边距，让 3-10 字段位和卡片边界保持稳定距离。 */
  --video-card-body-padding: clamp(0.72rem, 1.5vw, 0.9rem);

  /* 设置卡片填满父级栅格列，宽度由页面栅格系统统一决定。 */
  width: 100%;

  /* 允许卡片在栅格列变窄时正常收缩，不反向撑开页面布局。 */
  min-width: 0;

  /* 设置卡片为纵向弹性容器，让封面区和正文区按上下顺序排列。 */
  display: flex;

  /* 设置卡片主轴为纵向，确保封面始终位于正文上方。 */
  flex-direction: column;

  /* 设置卡片边界裁切，防止封面覆盖行和 hover 阴影内部内容溢出。 */
  overflow: hidden;
}

/*
  作用容器: 新版视频卡片封面区 `.video-card__poster`。
  样式作用:
  保持原有竖版海报比例。
  为封面顶部 1-2 字段位提供定位上下文。
  让占位图和真实图片共享同一展示面积。
*/
.video-card__poster {
  /* 设置封面区为顶部覆盖行的定位上下文。 */
  position: relative;

  /* 设置封面宽度跟随卡片宽度变化。 */
  width: 100%;

  /* 保持原有竖版海报比例，避免字段布局改动影响卡片视觉比例。 */
  aspect-ratio: 2 / 3;

  /* 设置封面区不参与 flex 收缩，保证卡片比例稳定。 */
  flex-shrink: 0;

  /* 设置封面区裁切内部图片和占位字，避免图片失败或占位内容溢出卡片边界。 */
  overflow: hidden;

  /* 设置封面占位背景，保证无图卡片仍然具有海报区域而不是白板。 */
  background:
    radial-gradient(circle at 28% 18%, rgba(91, 140, 255, 0.18), transparent 34%),
    linear-gradient(145deg, #e9eff8 0%, #cfd9e8 100%);

  /* 设置封面区为弹性容器，让无图占位首字稳定居中。 */
  display: flex;

  /* 设置封面占位首字垂直居中。 */
  align-items: center;

  /* 设置封面占位首字水平居中。 */
  justify-content: center;

  /* 设置封面和正文之间的轻量边界，恢复海报区与信息区的分隔。 */
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

/*
  作用容器: 视频卡片真实封面 `.video-card__cover`。
  样式作用:
  让真实海报填满封面区域。
  保持图片裁切比例，不因卡片宽度变化而变形。
  置于顶部字段行下方，避免遮挡字段 1 和字段 2。
*/
.video-card__cover {
  /* 设置图片定位到封面区左上角，保证覆盖完整海报区域。 */
  position: absolute;

  /* 设置图片填满封面区四边。 */
  inset: 0;

  /* 设置图片宽度填满封面区。 */
  width: 100%;

  /* 设置图片高度填满封面区。 */
  height: 100%;

  /* 设置图片按比例裁切，避免竖版海报被拉伸。 */
  object-fit: cover;

  /* 设置图片为块级元素，避免行内图片底部空隙。 */
  display: block;

  /* 设置图片层级低于顶部字段行。 */
  z-index: 1;
}

/*
  作用容器: 无图占位首字 `.video-card__fallback`。
  样式作用:
  在缺少海报时提供居中的标题首字。
  恢复封面区视觉重心，避免占位文字跑到卡片角落。
  保持占位字弱化，不抢正文标题的信息层级。
*/
.video-card__fallback {
  /* 设置占位字位于封面背景之上、顶部字段行之下。 */
  position: relative;

  /* 设置占位字层级低于顶部字段行。 */
  z-index: 1;

  /* 设置占位字字号随卡片宽度响应，保持封面视觉充实。 */
  font-size: clamp(2.4rem, 6vw, 4rem);

  /* 设置占位字字重较高，保证浅色背景上可读。 */
  font-weight: 800;

  /* 设置占位字颜色为低饱和灰蓝，避免比真实标题更抢眼。 */
  color: rgba(71, 85, 105, 0.36);

  /* 禁止占位字响应鼠标事件，避免影响卡片点击。 */
  pointer-events: none;
}

/*
  作用容器: 封面顶部字段行 `.video-card__top-row`。
  样式作用:
  承载字段 1、弹性空白和字段 2 操作按钮。
  使用 flex 百分比分区，避免固定像素宽度导致响应式失效。
  让隐藏删除按钮时中间空白自动吃掉释放出来的宽度。
*/
.video-card__top-row {
  /* 设置顶部字段行覆盖在封面上方，不影响封面比例。 */
  position: absolute;

  /* 设置顶部字段行距离封面上边和左右边的安全距离。 */
  inset: var(--video-card-overlay-inset) var(--video-card-overlay-inset) auto;

  /* 设置顶部字段行高于封面图片和占位字。 */
  z-index: 3;

  /* 设置字段 1、空白和操作按钮横向排列。 */
  display: flex;

  /* 设置顶部字段行垂直居中，保证标签和按钮在同一基线上。 */
  align-items: center;

  /* 设置顶部字段之间的细小间距，防止相邻字段贴边。 */
  gap: var(--video-card-column-gap);

  /* 默认不让整行拦截卡片点击，只让具体按钮接收点击。 */
  pointer-events: none;
}

/*
  作用容器: 通用字段标签 `.video-card__field`。
  样式作用:
  统一字段 1、4、7、8 的基础字段位能力。
  字段宽度由所在行的百分比 flex-basis 决定，内容只在字段位内部省略。
  正文中的字段 4、7、8 只显示普通文字，不再使用 chip 背景。
*/
.video-card__field {
  /* 设置字段为弹性盒，方便不同字段在自己的字段位内对齐。 */
  display: inline-flex;

  /* 设置字段文本垂直居中。 */
  align-items: center;

  /* 设置字段内部文字居中，保证所有 chip 文案在自身容器内视觉统一。 */
  justify-content: center;

  /* 允许字段位在父级 flex 行内按百分比正常收缩。 */
  min-width: 0;

  /* 设置字段标签盒模型包含内边距，避免内边距额外撑大字段位。 */
  box-sizing: border-box;

  /* 清除正文普通字段的额外内边距，让其和普通文本行保持一致。 */
  padding: 0;

  /* 设置普通字段文字颜色为次级文字色，降低正文辅助信息的视觉重量。 */
  color: var(--text-secondary);

  /* 设置字段标签字号，由卡片宽度和根字号共同决定。 */
  font-size: var(--video-card-body-meta-font-size);

  /* 设置正文普通字段字重和其它辅助信息一致，避免底部文字风格混乱。 */
  font-weight: 500;

  /* 设置字段标签行高，避免中文在小标签中上下顶边。 */
  line-height: var(--video-card-body-meta-line-height);

  /* 设置字段标签单行显示，避免换行破坏字段位高度。 */
  white-space: nowrap;

  /* 设置字段标签内容溢出时隐藏。 */
  overflow: hidden;

  /* 设置字段标签长文本使用省略号，字段整理后由数据层继续约束长度。 */
  text-overflow: ellipsis;

  /* 设置字段内部文本居中，避免左右字段位影响 chip 内部文字对齐。 */
  text-align: center;
}

/*
  作用容器: 空字段标签 `.video-card__field.is-empty`。
  样式作用:
  保留字段位占比。
  在数据缺失时隐藏视觉标签，避免空标签干扰用户。
*/
.video-card__field.is-empty {
  /* 隐藏空字段视觉内容，同时保留字段 1 的 40% 布局占位。 */
  visibility: hidden;
}

/*
  作用容器: 封面顶部状态字段 `.video-card__field--top-status`。
  样式作用:
  作为字段 1 显示电影清晰度或电视剧剧集字段。
  固定占据顶部字段行 40% 宽度。
*/
.video-card__field--top-status {
  /* 设置字段 1 占顶部字段行的 40%。 */
  flex: 0 0 var(--video-card-top-status-basis);

  /* 设置字段 1 高度为顶部控件高度，和收藏/删除按钮保持同一视觉线。 */
  height: var(--video-card-field-height);

  /* 设置字段 1 横向内边距，让清晰度或剧集字段不贴边。 */
  padding: 0 var(--video-card-field-padding-x);

  /* 设置字段 1 圆角，保留封面顶部状态控件的 chip 视觉。 */
  border-radius: 0.36rem;

  /* 设置字段 1 深色背景，保证压在封面图片上仍然清楚可读。 */
  background: rgba(38, 55, 88, 0.9);

  /* 设置字段 1 文字为白色，确保深色背景上的对比度。 */
  color: #ffffff;

  /* 设置字段 1 字号仍使用顶部控件字号，不受正文辅助文字统一规则影响。 */
  font-size: var(--video-card-field-font-size);

  /* 设置字段 1 字重保持强调，让封面顶部状态仍然易于识别。 */
  font-weight: 700;

  /* 设置字段 1 行高与顶部控件高度匹配，避免文字上下晃动。 */
  line-height: 1.2;

  /* 设置字段 1 阴影，让封面顶部状态从海报中浮出。 */
  box-shadow: 0 0.35rem 0.8rem rgba(15, 23, 42, 0.18);
}

/*
  作用容器: 字段行弹性空白 `.video-card__row-spacer`。
  样式作用:
  吃掉左右字段之间的剩余空间。
  让每一行都形成“左字段 + 中间空白 + 右字段”的稳定布局。
*/
.video-card__row-spacer {
  /* 设置空白区域占据当前行剩余宽度。 */
  flex: 1 1 auto;

  /* 设置空白区域最小宽度为 0，允许窄卡片时字段优先展示。 */
  min-width: 0;
}

/*
  作用容器: 顶部操作按钮 `.video-card__action`。
  样式作用:
  作为字段 2 的独立按钮控件。
  每个按钮固定占据顶部字段行 20%，删除按钮隐藏时自动释放空间给中间空白。
  不使用像素宽度控制按钮横向尺寸。
*/
.video-card__action {
  /* 清除浏览器默认按钮外观，让操作按钮在不同浏览器保持一致。 */
  appearance: none;

  /* 设置每个操作按钮占顶部字段行 20%。 */
  flex: 0 0 var(--video-card-top-action-basis);

  /* 设置操作按钮最小宽度为 0，避免图标按钮反向撑开字段行。 */
  min-width: 0;

  /* 设置操作按钮高度和字段标签一致，保证顶部行视觉整齐。 */
  height: var(--video-card-field-height);

  /* 清除默认内边距，让图标居中由 flex 控制。 */
  padding: 0;

  /* 设置按钮盒模型包含边框，避免边框撑大字段位。 */
  box-sizing: border-box;

  /* 设置按钮为弹性盒，方便图标居中。 */
  display: inline-flex;

  /* 设置按钮图标垂直居中。 */
  align-items: center;

  /* 设置按钮图标水平居中。 */
  justify-content: center;

  /* 设置按钮边框，保证按钮压在封面上时边界清楚。 */
  border: 1px solid rgba(255, 255, 255, 0.64);

  /* 设置按钮圆角和字段标签一致，保持顶部控件统一。 */
  border-radius: 0.36rem;

  /* 设置按钮默认背景为半透明深色，与字段标签保持同一视觉体系。 */
  background: rgba(38, 55, 88, 0.78);

  /* 设置按钮图标颜色为白色，保证封面上的可读性。 */
  color: #ffffff;

  /* 设置按钮图标字号跟随字段字号，避免按钮比字段显得突兀。 */
  font-size: var(--video-card-field-font-size);

  /* 设置鼠标手型，提示这是独立操作控件。 */
  cursor: pointer;

  /* 允许按钮接收点击事件，同时不让顶部整行拦截卡片点击。 */
  pointer-events: auto;

  /* 设置按钮状态过渡，提供轻量交互反馈。 */
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

/*
  作用容器: 顶部操作按钮 hover 状态 `.video-card__action:hover`。
  样式作用:
  给收藏和删除按钮提供可点击反馈。
  保持反馈只影响按钮本身，不改变字段位尺寸。
*/
.video-card__action:hover {
  /* 加深 hover 背景，提示当前指向的是按钮而不是整张卡片。 */
  background: rgba(15, 23, 42, 0.74);

  /* 提高 hover 边框对比度，让按钮边界更清楚。 */
  border-color: rgba(255, 255, 255, 0.88);
}

/*
  作用容器: 已收藏按钮 `.video-card__action.is-active`。
  样式作用:
  表示当前视频已处于收藏状态。
  为后续收藏状态仓库接入保留稳定视觉。
*/
.video-card__action.is-active {
  /* 设置已收藏图标为金色，符合收藏状态识别习惯。 */
  color: #ffd166;

  /* 设置已收藏边框带金色倾向，强化状态但不改变按钮尺寸。 */
  border-color: rgba(255, 209, 102, 0.76);
}

/*
  作用容器: 删除按钮 `.video-card__action--danger`。
  样式作用:
  区分删除播放历史这类危险操作。
  保持删除按钮和收藏按钮尺寸完全一致。
*/
.video-card__action--danger {
  /* 设置删除按钮背景带红色倾向，提示该按钮会移除内部记录。 */
  background: rgba(185, 28, 28, 0.66);

  /* 设置删除按钮边框为浅红色，增强危险动作识别。 */
  border-color: rgba(254, 202, 202, 0.78);
}

/*
  作用容器: 封面右下角评分 `.video-card__poster-score`。
  样式作用:
  在封面图片区展示评分，释放正文元信息行的横向空间。
  保持评分醒目但不过度遮挡海报主体。
  使用响应式定位和顶部状态同款字号，避免固定像素破坏卡片缩放。
  使用轻量半透明背景保证浅色封面和真实海报上都可读。
*/
.video-card__poster-score {
  /* 设置评分定位在封面区域内。 */
  position: absolute;

  /* 设置评分贴近封面右下角安全区。 */
  right: var(--video-card-overlay-inset);

  /* 设置评分贴近封面底部安全区。 */
  bottom: var(--video-card-overlay-inset);

  /* 设置评分层级高于封面图片和占位字。 */
  z-index: 3;

  /* 设置评分为行内弹性盒，保证星标和数字垂直居中。 */
  display: inline-flex;

  /* 设置评分内容垂直居中。 */
  align-items: center;

  /* 设置评分内容水平居中。 */
  justify-content: center;

  /* 设置评分内部间距，避免星标和数字贴在一起。 */
  gap: 0.18rem;

  /* 设置评分横向内边距，让轻量背景和文字之间保留呼吸感。 */
  padding: 0.14rem 0.36rem;

  /* 设置评分圆角较小，避免重新变成厚重 chip。 */
  border-radius: 0.28rem;

  /* 设置轻量半透明背景，保证评分在浅色封面占位上可见。 */
  background: rgba(15, 23, 42, 0.42);

  /* 设置评分文字为高对比度浅金色，保证深色半透明背景上清楚可读。 */
  color: #ffe8a3;

  /* 设置评分字号和左上角状态字段一致，让封面覆盖信息规格统一。 */
  font-size: var(--video-card-field-font-size);

  /* 设置评分字重略强调，保证数字在图片上清楚。 */
  font-weight: 700;

  /* 设置评分行高，保证小型覆盖标识高度稳定。 */
  line-height: var(--video-card-body-meta-line-height);

  /* 设置评分文本单行展示。 */
  white-space: nowrap;

  /* 禁止评分拦截卡片点击，保持点击封面进入详情。 */
  pointer-events: none;

  /* 设置轻量文字阴影，让评分在复杂海报上仍保持可读。 */
  text-shadow: 0 0.12rem 0.26rem rgba(15, 23, 42, 0.26);
}

/*
  作用容器: 封面评分星标 `.video-card__poster-score i`。
  样式作用:
  控制评分星标与数字的统一大小和对齐。
*/
.video-card__poster-score i {
  /* 设置星标字号跟随评分文字，避免图标和数字比例失衡。 */
  font-size: 1em;
}

/*
  作用容器: 新版视频卡片正文 `.video-card__body`。
  样式作用:
  承载字段 3-10。
  使用纵向 grid 管理五条固定字段行，避免通过零散 margin 拼接布局。
  让不同用户状态下的卡片拥有相同真实结构、行间距和正文高度。
*/
.video-card__body {
  /* 设置正文背景为白色，和封面区形成清楚分隔。 */
  background: rgba(255, 255, 255, 0.98);

  /* 设置正文辅助信息统一字号，除标题外的所有字段都引用这一处。 */
  --video-card-body-meta-font-size: clamp(0.68rem, 0.84vw, 0.78rem);

  /* 设置正文辅助信息统一行高，让底部几行的文字节奏一致。 */
  --video-card-body-meta-line-height: 1.25;

  /* 设置正文辅助信息统一字重，避免来源、类型、进度行视觉重量不一致。 */
  --video-card-body-meta-font-weight: 500;

  /* 设置正文内边距，给五条固定字段行提供稳定安全区。 */
  padding: var(--video-card-body-padding);

  /* 设置正文盒模型包含内边距，避免 padding 影响卡片宽度。 */
  box-sizing: border-box;

  /* 设置正文为 grid，让 3-10 字段行按稳定行距排列。 */
  display: grid;

  /* 设置五条正文字段行高度由统一文字规格决定，保证各字段纵向位置稳定。 */
  grid-template-rows: repeat(5, minmax(0, auto));

  /* 设置正文各字段行之间的纵向间距。 */
  row-gap: var(--video-card-row-gap);
}

/*
  作用容器: 正文字段行 `.video-card__info-row`。
  样式作用:
  统一字段 3-10 所在行的横向布局。
  每行采用左字段、弹性空白、右字段的 flex 分区。
*/
.video-card__info-row {
  /* 设置字段行横向排列。 */
  display: flex;

  /* 设置字段行垂直居中，保证不同字号内容位于同一基线附近。 */
  align-items: center;

  /* 设置左右字段和中间空白之间的横向间距。 */
  gap: var(--video-card-column-gap);

  /* 允许字段行在卡片列宽内收缩，不撑开父级栅格。 */
  min-width: 0;
}

/*
  作用容器: 标题文本 `.video-card__title`。
  样式作用:
  作为字段 3 展示视频标题。
  占据标题行 50%，长标题只在字段位内省略。
*/
.video-card__title {
  /* 清除 h3 默认外边距，避免标题行高度不可控。 */
  margin: 0;

  /* 设置标题字段占标题行 50%。 */
  flex: 0 0 var(--video-card-title-basis);

  /* 允许标题在 50% 字段位内收缩并显示省略号。 */
  min-width: 0;

  /* 设置标题字号略高于其它字段，形成第一信息层级。 */
  font-size: clamp(0.95rem, 1.2vw, 1.08rem);

  /* 设置标题行高，保证单行标题高度稳定。 */
  line-height: 1.25;

  /* 设置标题字重，强化视频名称。 */
  font-weight: 800;

  /* 设置标题颜色为主文字色。 */
  color: var(--text-primary);

  /* 设置标题单行展示。 */
  white-space: nowrap;

  /* 设置标题超出字段位时隐藏。 */
  overflow: hidden;

  /* 设置长标题在字段位内显示省略号。 */
  text-overflow: ellipsis;
}

/*
  作用容器: 内容类型字段 `.video-card__field--content-type`。
  样式作用:
  作为字段 4 显示电影或电视剧标识。
  占据标题行 30%，和标题字段形成清晰左右关系。
*/
.video-card__field--content-type {
  /* 设置字段 4 占标题行 30%。 */
  flex: 0 0 var(--video-card-content-type-basis);

  /* 设置字段 4 靠右对齐，保持类型文字贴向右侧信息边界。 */
  justify-content: flex-end;

  /* 设置字段 4 文本右对齐，普通文字不再呈现 chip 控件感。 */
  text-align: right;
}

/*
  作用容器: 元信息文本 `.video-card__meta-text`。
  样式作用:
  作为字段 5 展示年份、地区和影视类型。
  独占正文元信息行，减少长地区和类型被挤压省略的概率。
*/
.video-card__meta-text {
  /* 设置字段 5 独占元信息行全部宽度。 */
  flex: 1 1 100%;

  /* 允许元信息在整行宽度内正常省略。 */
  min-width: 0;

  /* 设置元信息字号引用正文辅助信息统一字号。 */
  font-size: var(--video-card-body-meta-font-size);

  /* 设置元信息行高引用正文辅助信息统一行高。 */
  line-height: var(--video-card-body-meta-line-height);

  /* 设置元信息字重引用正文辅助信息统一字重。 */
  font-weight: var(--video-card-body-meta-font-weight);

  /* 设置元信息颜色为次级文字色。 */
  color: var(--text-secondary);

  /* 设置元信息单行展示。 */
  white-space: nowrap;

  /* 设置元信息超出字段位时隐藏。 */
  overflow: hidden;

  /* 设置元信息长文本显示省略号。 */
  text-overflow: ellipsis;
}

/*
  作用容器: 数据源字段 `.video-card__field--source`。
  样式作用:
  作为字段 7 显示当前内容的数据源。
  占据来源行 50%，长来源名称只在字段位内省略。
*/
.video-card__field--source {
  /* 设置字段 7 占来源行 50%。 */
  flex: 0 0 var(--video-card-source-basis);

  /* 设置字段 7 靠左对齐，数据源作为左侧普通文字展示。 */
  justify-content: flex-start;

  /* 设置字段 7 文本左对齐，和下方播放状态形成统一左边界。 */
  text-align: left;
}

/*
  作用容器: 当前集字段 `.video-card__field--episode`。
  样式作用:
  作为字段 8 显示电视剧已播放时的当前播放集。
  占据来源行 35%，不渲染时由中间空白吃掉剩余宽度。
*/
.video-card__field--episode {
  /* 设置字段 8 占来源行 35%。 */
  flex: 0 0 var(--video-card-episode-basis);

  /* 设置字段 8 靠右对齐，当前集作为右侧普通文字展示。 */
  justify-content: flex-end;

  /* 设置字段 8 文本右对齐，避免正文右侧信息在字段位中漂浮。 */
  text-align: right;
}

/*
  作用容器: 没有最近播放时间的占位行 `.video-card__recent-row.is-empty`。
  样式作用:
  隐藏无业务内容的最近播放标签和时间，不向用户展示伪造占位文字。
  保留这一行的真实文字尺寸和网格位置，让有无播放历史的卡片保持等高并对齐后续进度行。
*/
.video-card__recent-row.is-empty {
  /* 隐藏空最近播放行的可见内容，同时保留元素尺寸和网格占位。 */
  visibility: hidden;
}

/*
  作用容器: 最近播放标签 `.video-card__recent-label`。
  样式作用:
  作为用户内容状态扩展字段显示最近播放行左侧标签。
  和播放状态字段保持同一字号、行高、自然宽度和颜色，避免卡片底部信息风格分裂。
*/
.video-card__recent-label {
  /* 设置最近播放标签按真实文本自然占宽，和下方播放状态使用同一宽度分配规则。 */
  flex: 0 0 auto;

  /* 允许最近播放标签在字段位内收缩。 */
  min-width: 0;

  /* 设置最近播放标签字号引用正文辅助信息统一字号。 */
  font-size: var(--video-card-body-meta-font-size);

  /* 设置最近播放标签行高引用正文辅助信息统一行高。 */
  line-height: var(--video-card-body-meta-line-height);

  /* 设置最近播放标签字重引用正文辅助信息统一字重。 */
  font-weight: var(--video-card-body-meta-font-weight);

  /* 设置最近播放标签颜色为次级文字色，保持它是辅助状态信息。 */
  color: var(--text-secondary);

  /* 设置最近播放标签单行显示。 */
  white-space: nowrap;

  /* 设置最近播放标签超出字段位时隐藏。 */
  overflow: hidden;

  /* 设置最近播放标签长文本显示省略号。 */
  text-overflow: ellipsis;
}

/*
  作用容器: 最近播放时间 `.video-card__recent-time`。
  样式作用:
  作为用户内容状态扩展字段显示最近播放时间。
  按真实内容获得必要宽度并靠右对齐，便于和播放进度时间一起扫读。
*/
.video-card__recent-time {
  /* 设置最近播放时间按内容获得必要宽度，并允许极窄场景在当前行内收缩。 */
  flex: 0 1 auto;

  /* 允许最近播放时间在字段位内收缩。 */
  min-width: 0;

  /* 设置最近播放时间右对齐，对齐卡片右侧信息边界。 */
  text-align: right;

  /* 设置最近播放时间数字使用等宽字形，减少日期和时分数字变化造成的视觉抖动。 */
  font-variant-numeric: tabular-nums;

  /* 设置最近播放时间字号引用正文辅助信息统一字号。 */
  font-size: var(--video-card-body-meta-font-size);

  /* 设置最近播放时间行高引用正文辅助信息统一行高。 */
  line-height: var(--video-card-body-meta-line-height);

  /* 设置最近播放时间字重引用正文辅助信息统一字重。 */
  font-weight: var(--video-card-body-meta-font-weight);

  /* 设置最近播放时间颜色为次级文字色，避免压过标题和评分。 */
  color: var(--text-secondary);

  /* 设置最近播放时间单行显示。 */
  white-space: nowrap;

  /* 设置最近播放时间超出字段位时隐藏。 */
  overflow: hidden;

  /* 设置最近播放时间长文本显示省略号。 */
  text-overflow: ellipsis;
}

/*
  作用容器: 播放状态字段 `.video-card__progress-label`。
  样式作用:
  作为字段 9 显示已播放、从未播放或正在播放。
  按真实状态文本自然占宽，避免固定百分比压缩较长状态。
*/
.video-card__progress-label {
  /* 设置字段 9 按真实状态文本自然占宽，不参与剩余空间竞争。 */
  flex: 0 0 auto;

  /* 允许播放状态在字段位内收缩。 */
  min-width: 0;

  /* 设置播放状态字号引用正文辅助信息统一字号。 */
  font-size: var(--video-card-body-meta-font-size);

  /* 设置播放状态行高引用正文辅助信息统一行高。 */
  line-height: var(--video-card-body-meta-line-height);

  /* 设置播放状态字重引用正文辅助信息统一字重。 */
  font-weight: var(--video-card-body-meta-font-weight);

  /* 设置播放状态颜色为次级文字色。 */
  color: var(--text-secondary);

  /* 设置播放状态单行显示。 */
  white-space: nowrap;

  /* 设置播放状态超出字段位时隐藏。 */
  overflow: hidden;

  /* 设置播放状态长文本显示省略号。 */
  text-overflow: ellipsis;
}

/*
  作用容器: 播放时间字段 `.video-card__progress-time`。
  样式作用:
  作为字段 10 显示已播放时间和总时长。
  按真实时间内容获得必要宽度，并靠右对齐方便扫读。
*/
.video-card__progress-time {
  /* 设置字段 10 按时间内容获得必要宽度，并允许极窄场景在当前行内收缩。 */
  flex: 0 1 auto;

  /* 允许播放时间在字段位内收缩。 */
  min-width: 0;

  /* 设置播放时间右对齐，对齐卡片右侧信息边界。 */
  text-align: right;

  /* 设置播放时间数字使用等宽字形，让播放进度变化时数字列宽保持稳定。 */
  font-variant-numeric: tabular-nums;

  /* 设置播放时间字号引用正文辅助信息统一字号。 */
  font-size: var(--video-card-body-meta-font-size);

  /* 设置播放时间行高引用正文辅助信息统一行高。 */
  line-height: var(--video-card-body-meta-line-height);

  /* 设置播放时间字重引用正文辅助信息统一字重。 */
  font-weight: var(--video-card-body-meta-font-weight);

  /* 设置播放时间颜色为次级文字色。 */
  color: var(--text-secondary);

  /* 设置播放时间单行显示。 */
  white-space: nowrap;

  /* 设置播放时间超出字段位时隐藏。 */
  overflow: hidden;

  /* 设置播放时间长文本显示省略号。 */
  text-overflow: ellipsis;
}

/*
  作用容器: 窄屏下的视频卡片 `.video-card`。
  样式作用:
  收紧字段间距和正文内边距。
  保持百分比字段位不变，确保响应式时信息结构不发生跳变。
*/
@media (max-width: 640px) {
  .video-card {
    /* 收紧移动端字段行间距，让卡片在双列或单列布局中更紧凑。 */
    --video-card-row-gap: 0.32rem;

    /* 收紧移动端字段横向间距，给字段文本保留更多可用宽度。 */
    --video-card-column-gap: 0.14rem;

    /* 收紧移动端封面顶部内边距，减少顶部字段对海报主体的遮挡。 */
    --video-card-overlay-inset: 0.28rem;

    /* 收紧移动端正文内边距，让文本字段获得更多横向空间。 */
    --video-card-body-padding: 0.64rem;
  }
}
</style>
