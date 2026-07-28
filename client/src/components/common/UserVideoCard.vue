<template>
  <!--
    UserVideoCard 组件渲染树

    [DEFAULT] ele(UserVideoCard)
    │  - condition:
    │      默认渲染。
    │      当首页、目录页、搜索页或个人中心传入单个 ContentItem 时展示带用户状态的视频卡片。
    │  - type:
    │      自定义组件
    │      相对位置: ./UserVideoCard.vue
    │  - description:
    │      用户状态视频卡片容器。
    │      从用户内容 selector 读取收藏和播放状态，再把结果传给纯展示 VideoCard。
    │  - params:
    │      -- video：父组件传入的统一 ContentItem 视频对象。
    │      -- favorite：父组件传入的收藏状态兜底，用于收藏列表等已经知道收藏语义的场景。
    │      -- playback：父组件传入的播放状态兜底，用于历史列表等已经知道播放语义的场景。
    │      -- preferProvidedPlayback：是否优先展示当前记录 playback，而不是同内容最近记录。
    │      -- showDelete：父组件传入的删除按钮开关，用于播放历史等内部记录场景。
    │      -- navigationTarget：父组件传入的可选 Vue Router 目标，独立于 ContentItem。
    │  - events:
    │      @toggle-favorite
    │          - description:
    │              用户点击 VideoCard 收藏按钮时触发。
    │              容器先写入 userContentStore，再把结果向父组件透出。
    │          - methods:
    │              handleToggleFavorite(item)
    │                  -- item：VideoCard 抛出的当前视频对象。
    │      @delete
    │          - description:
    │              用户点击 VideoCard 删除按钮时触发。
    │              容器不直接删除历史，只把事件继续交给上层列表处理。
    │          - methods:
    │              handleDelete(item)
    │                  -- item：VideoCard 抛出的当前视频对象。
  -->
  <!--
    [DEFAULT] ele(VideoCard.user-video-card)
    - condition:
        默认渲染。
        UserVideoCard 只负责注入用户状态，真实卡片 DOM 继续由 VideoCard 统一渲染。
    - type:
        自定义组件
        相对位置: ./VideoCard.vue
    - description:
        统一视频卡片展示组件。
        接收容器整理后的收藏状态和播放状态，保持展示层不直接依赖用户内容 store。
    - params:
        -- video：父组件传入的统一 ContentItem 视频对象。
        -- favorite：displayFavorite 计算出的最终收藏状态。
        -- playback：displayPlayback 计算出的最终播放状态。
        -- showDelete：是否显示删除按钮。
        -- navigationTarget：当前卡片可选的显式路由目标。
    - events:
        @toggle-favorite
            - description:
                用户点击收藏按钮时触发。
                用于把收藏切换交给 userContentService 写入运行时用户内容状态。
            - methods:
                handleToggleFavorite(item)
                    -- item：当前视频对象。
        @delete
            - description:
                用户点击删除按钮时触发。
                用于让个人中心历史列表等上层组件删除对应记录。
            - methods:
                handleDelete(item)
                    -- item：当前视频对象。
  -->
  <VideoCard
    class="user-video-card"
    :video="video"
    :favorite="displayFavorite"
    :playback="displayPlayback"
    :show-delete="showDelete"
    :navigation-target="navigationTarget"
    @toggle-favorite="handleToggleFavorite"
    @delete="handleDelete"
  />
</template>

<script>
/*
  UserVideoCard.vue 模块说明

  - 文件职责:
      从用户内容 selector 读取内容级状态，并按父组件语义选择记录级播放状态和可选导航目标。
      把整理后的 props 交给纯展示 VideoCard，收藏写入仍统一委托 userContentService。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      VideoCard: 自定义组件，负责渲染全站统一视频卡片。
      getContentUserStatus: 自定义 selector，读取当前 ContentItem 的收藏、播放和正在播放状态。
      toggleFavorite: 自定义服务，写入或删除当前内容的收藏记录。

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      UserVideoCard: Vue component，供内容列表和个人中心注入统一用户收藏、播放与导航状态。
*/

// 导入来源: ./VideoCard.vue。
// 导入内容: VideoCard 纯展示视频卡片组件。
// 文件作用: UserVideoCard 把用户状态整理成 props 后交给它渲染。
import VideoCard from './VideoCard.vue';

// 导入来源: ../../selectors/userContentSelectors。
// 导入内容: getContentUserStatus 用户内容状态 selector。
// 文件作用: 用于读取当前内容是否收藏、最近播放记录和当前播放状态。
import { getContentUserStatus } from '../../selectors/userContentSelectors.js';

// 导入来源: ../../services/userContentService。
// 导入内容: toggleFavorite 收藏切换服务。
// 文件作用: 用户点击收藏按钮时写入 userContentStore 内存状态。
import { toggleFavorite } from '../../services/userContentService.js';

export default {
  // 组件名称用于在 Vue 调试工具中识别带用户状态的统一视频卡片容器。
  name: 'UserVideoCard',

  /*
    components 注册当前组件模板中使用的自定义组件。
    注册名必须和 template 标签名、顶部渲染树 ele(...) 名称保持一致。
  */
  components: {
    // 组件: VideoCard 纯展示卡片。
    // 作用: 渲染封面、标题、元信息、收藏按钮和播放状态文本。
    VideoCard
  },

  props: {
    // 类型: object。
    // 来源: 父组件传入的统一 ContentItem。
    // 作用: 用于读取用户内容状态，并继续传给 VideoCard 渲染内容信息。
    // 字段: id，string，内容 id，用于收藏和播放历史匹配。
    // 字段: sourceId，string，数据源 id，用于和 id 一起生成内容引用 key。
    video: {
      type: Object,
      required: true
    },

    // 类型: boolean。
    // 来源: 父组件在收藏列表等明确收藏语义场景下传入。
    // 作用: 在用户内容 selector 尚未命中时提供视觉兜底，避免明确收藏列表显示成未收藏。
    // true: 当 store 没有本地点击结果时把卡片显示为已收藏。
    // false: 不提供收藏兜底，完全以用户内容 selector 为准。
    favorite: {
      type: Boolean,
      default: false
    },

    // 类型: object|null。
    // 来源: 父组件在播放历史等明确播放语义场景下传入。
    // 作用: 在用户内容 selector 尚未命中时提供播放状态兜底，保证历史列表仍能展示进度。
    // 字段: played，boolean，是否已播放。
    // 字段: currentEpisode，string|number，电视剧当前播放集。
    // 字段: playedTimeText，string，已播放时间文本。
    // 字段: totalTimeText，string，总时长文本。
    playback: {
      type: Object,
      default: null
    },

    // 类型: boolean。
    // 来源: 父组件按列表记录语义传入；个人中心播放历史固定为 true，普通内容列表使用默认 false。
    // 作用: 决定 displayPlayback 是优先采用当前记录，还是优先采用同内容最近播放记录。
    // true: 当前 playback 记录是权威，保持多分集历史各自的 episode/progress。
    // false: 使用用户内容 selector 的内容级最近记录，适合首页、目录、搜索和收藏卡片。
    preferProvidedPlayback: {
      type: Boolean,
      default: false
    },

    // 类型: boolean。
    // 来源: 父组件根据列表语义传入。
    // 作用: 控制 VideoCard 是否显示删除按钮。
    // true: 播放历史等内部记录列表显示删除按钮。
    // false: 首页、目录页、搜索页和收藏列表只显示收藏按钮。
    showDelete: {
      type: Boolean,
      default: false
    },

    // 类型: object|null。
    // 来源: 父组件根据当前列表交互语义生成；历史记录目标由 playerNavigationService 创建。
    // 作用: 透传给 VideoCard 执行导航，保持路由字段与 ContentItem 分离。
    // null: VideoCard 使用默认详情导航。
    // object: VideoCard 使用当前显式 Vue Router 目标。
    navigationTarget: {
      type: Object,
      default: null
    }
  },

  /**
   * UserVideoCard 本地状态。
   * 纯函数: 每个组件实例返回独立收藏视觉覆盖状态，不读取或修改外部 store。
   *
   * @returns {object} 收藏点击后的本地视觉覆盖状态。
   */
  data() {
    return {
      // 类型: boolean|null。
      // 初始值: null 表示没有本地覆盖，优先使用 selector 和父组件 props 兜底。
      // 作用: 兼容收藏列表传入 favorite=true 的场景，点击取消收藏后可以立即把当前卡片视觉更新为未收藏。
      localFavoriteOverride: null
    };
  },

  computed: {
    /**
     * 当前内容的用户状态聚合。
     * 数据来源: userContentStore，经 getContentUserStatus selector 读取。
     * 纯函数: 只通过 selector 读取当前 ContentItem 状态，不修改用户内容 store。
     *
     * @returns {object} 当前内容收藏、最近播放和正在播放状态。
     * @returns {boolean} return.favorite 当前内容是否已收藏。
     * @returns {object|null} return.latestPlaybackRecord 当前内容最近播放记录。
     * @returns {boolean} return.isPlaying 当前内容是否正在播放。
     */
    userStatus() {
      // 返回值类型: object。
      // 作用: 通过 selector 读取用户状态，避免组件直接访问 userContentStore 内部结构。
      return getContentUserStatus(this.video);
    },

    /**
     * VideoCard 最终收藏状态。
     * 优先级: 本地点击结果 > 用户内容 selector > 父组件语义兜底 props。
     * 纯函数: 只读取本地覆盖、selector 和 favorite prop 并返回布尔值。
     *
     * @returns {boolean} true 表示显示已收藏按钮状态。
     */
    displayFavorite() {
      // 条件分支: 当前卡片本轮生命周期内已经点击过收藏按钮时进入。
      // 执行内容: 使用本地覆盖状态，避免父组件 favorite 兜底值挡住当前点击后的视觉反馈。
      if (this.localFavoriteOverride !== null) {
        return this.localFavoriteOverride;
      }

      // 条件分支: 用户内容状态已经命中收藏时进入。
      // 执行内容: 使用全局用户内容状态，保证首页、电影页、电视剧页和搜索页联动。
      if (this.userStatus.favorite) {
        return true;
      }

      // 返回值类型: boolean。
      // 作用: 用户状态没有命中时，允许父组件按列表语义继续传入收藏兜底。
      return Boolean(this.favorite);
    },

    /**
     * VideoCard 最终播放状态。
     * 历史列表优先使用父组件当前记录；普通列表优先使用用户内容 selector 的最近播放记录。
     * 纯函数: 只读取 props 和 selector 聚合，并返回新的历史展示对象或既有 playback 引用。
     *
     * @returns {object|null} VideoCard 可消费的播放状态对象。
     * @returns {boolean} return.played 是否已经播放。
     * @returns {boolean} return.playing 是否当前正在播放。
     * @returns {number|string} return.currentEpisode 电视剧最近播放集数。
     * @returns {string} return.playedTimeText 已播放时间文本。
     * @returns {string} return.totalTimeText 总时长文本。
     */
    displayPlayback() {
      // 条件分支: 父组件明确要求当前 playback 记录优先且记录存在时进入。
      // 执行内容: 直接按当前记录构造展示状态，避免同电视剧最新分集覆盖其它分集历史。
      if (this.preferProvidedPlayback && this.playback) {
        return this.createPlaybackDisplayState(
          this.playback,
          Boolean(this.playback.playing)
        );
      }

      // 类型: object|null。
      // 作用: 读取当前内容最近一次播放记录，电影按整部内容，电视剧按最近播放分集。
      const latestRecord = this.userStatus.latestPlaybackRecord;

      // 条件分支: 用户内容状态中存在播放记录时进入。
      // 执行内容: 把用户内容历史记录转换成 VideoCard 已有 playback prop 结构。
      if (latestRecord) {
        return this.createPlaybackDisplayState(latestRecord, this.userStatus.isPlaying);
      }

      // 返回值类型: object|null。
      // 作用: 没有用户播放记录时使用父组件 playback 兜底；普通页面未传入时保持 null。
      return this.playback || null;
    }
  },

  methods: {
    /**
     * 把播放记录转换为 VideoCard 展示状态。
     * 纯函数: 只读取 record 和 playing，不修改 props、selector 结果或用户内容 store。
     * 调用方: displayPlayback 的记录级优先分支和内容级最近记录分支。
     * 失败路径: 缺失秒数、分集或时间字段时分别返回空文本，不伪造历史身份。
     *
     * @param {object} record 当前历史记录或父组件播放状态对象。
     * @param {boolean} playing 当前记录是否应展示为正在播放。
     * @returns {object} VideoCard 可消费的播放展示状态。
     * @returns {boolean} return.played 当前记录是否已播放。
     * @returns {boolean} return.playing 当前记录是否正在播放。
     * @returns {string|number} return.currentEpisode 当前记录分集序号。
     * @returns {string} return.playedTimeText 已播放时间。
     * @returns {string} return.totalTimeText 总时长。
     * @returns {string} return.recentPlayedAtText 最近播放时间。
     */
    createPlaybackDisplayState(record, playing) {
      // 类型: object。
      // 作用: 异常记录使用空对象兜底，所有展示字段按缺失语义返回空值。
      const safeRecord = record && typeof record === 'object' ? record : {};

      // 返回值类型: object。
      // 作用: 创建独立展示对象，避免 VideoCard 或当前组件改写用户历史记录。
      return {
        // 类型: boolean。
        // 作用: 只有显式 played=false 表示未播放；真实历史记录没有该字段时天然视为已播放。
        played: safeRecord.played !== false,

        // 类型: boolean。
        // 作用: true 显示正在播放，false 保持当前记录的普通历史状态。
        playing: Boolean(playing),

        // 类型: string|number。
        // 作用: 优先保留父组件已整理值，否则使用历史记录 episodeIndex。
        currentEpisode: safeRecord.currentEpisode || safeRecord.episodeIndex || '',

        // 类型: string。
        // 作用: 优先保留父组件展示文本，否则把历史秒数转换为卡片时钟文本。
        playedTimeText: safeRecord.playedTimeText || this.formatSecondsToClock(safeRecord.playedSeconds),

        // 类型: string。
        // 作用: 优先保留父组件展示文本，否则把历史总秒数转换为卡片时钟文本。
        totalTimeText: safeRecord.totalTimeText
          || (safeRecord.durationSeconds ? this.formatSecondsToClock(safeRecord.durationSeconds) : ''),

        // 类型: string。
        // 作用: 优先保留父组件展示文本，否则把历史 ISO 时间转换为短时间文本。
        recentPlayedAtText: safeRecord.recentPlayedAtText
          || this.formatDisplayDateTime(safeRecord.lastPlayedAt)
      };
    },

    /**
     * 把秒数格式化为时钟文本。
     * 有小时位时返回 HH:mm:ss，没有小时位时返回 mm:ss。
     * 纯函数: 只读取 totalSeconds，不修改组件或全局状态。
     *
     * @param {number|string} totalSeconds 总秒数。
     * @returns {string} 格式化后的时间文本。
     */
    formatSecondsToClock(totalSeconds) {
      // 类型: number。
      // 作用: 将外部秒数字段转成数字，异常或负数按 0 秒处理。
      const safeSeconds = Number(totalSeconds) > 0 ? Number(totalSeconds) : 0;

      // 类型: number。
      // 作用: 计算完整小时数，用于决定是否展示小时位。
      const hours = Math.floor(safeSeconds / 3600);

      // 类型: number。
      // 作用: 计算去掉小时后的完整分钟数。
      const minutes = Math.floor((safeSeconds % 3600) / 60);

      // 类型: number。
      // 作用: 计算剩余秒数。
      const seconds = safeSeconds % 60;

      // 类型: string。
      // 作用: 分钟位补齐两位，保证不同记录的时间文本对齐。
      const minuteText = String(minutes).padStart(2, '0');

      // 类型: string。
      // 作用: 秒位补齐两位，保证播放时间格式稳定。
      const secondText = String(seconds).padStart(2, '0');

      // 条件分支: 存在小时位时进入。
      // 执行内容: 返回 HH:mm:ss，适配长电影和长播放记录。
      if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${minuteText}:${secondText}`;
      }

      // 返回值类型: string。
      // 作用: 没有小时位时返回 mm:ss，避免短内容前面多一个 00 小时。
      return `${minuteText}:${secondText}`;
    },

    /**
     * 格式化最近播放时间。
     * 纯函数: 只读取 dateText，不修改组件或全局状态。
     * 兜底策略: 时间为空或无法解析时返回空字符串。
     *
     * @param {string} dateText ISO 时间文本。
     * @returns {string} 适合卡片展示的最近播放时间。
     */
    formatDisplayDateTime(dateText) {
      // 类型: number。
      // 作用: 把 ISO 时间转成时间戳，异常时间会得到 NaN。
      const timestamp = Date.parse(dateText || '');

      // 条件分支: 时间无法解析时进入。
      // 执行内容: 返回空字符串，让展示组件可以隐藏最近播放时间。
      if (!Number.isFinite(timestamp)) {
        return '';
      }

      // 类型: Date。
      // 作用: 用合法时间戳创建日期对象，提取月日和时分。
      const date = new Date(timestamp);

      // 类型: string。
      // 作用: 月份补齐两位，形成稳定短日期。
      const monthText = String(date.getMonth() + 1).padStart(2, '0');

      // 类型: string。
      // 作用: 日期补齐两位，形成稳定短日期。
      const dayText = String(date.getDate()).padStart(2, '0');

      // 类型: string。
      // 作用: 小时补齐两位，形成稳定时间文本。
      const hourText = String(date.getHours()).padStart(2, '0');

      // 类型: string。
      // 作用: 分钟补齐两位，形成稳定时间文本。
      const minuteText = String(date.getMinutes()).padStart(2, '0');

      // 返回值类型: string。
      // 作用: 返回短格式最近播放时间，避免挤压 VideoCard 字段位。
      return `${monthText}-${dayText} ${hourText}:${minuteText}`;
    },

    /**
     * 切换当前视频收藏状态。
     * 触发来源: VideoCard 的 @toggle-favorite 事件。
     * 副作用: 调用 userContentService.toggleFavorite 写入 userContentStore。
     *
     * @param {object} item VideoCard 抛出的当前视频对象。
     * @returns {void} 该方法写入用户状态并向父组件透传结果。
     */
    handleToggleFavorite(item) {
      // 类型: object。
      // 作用: 优先使用 VideoCard 抛出的对象，缺失时回退到当前 props.video。
      const targetItem = item || this.video;

      // 类型: object。
      // 作用: 写入或删除收藏记录，并获得切换后的收藏状态。
      const result = toggleFavorite(targetItem);

      // 副作用: 写入本地覆盖状态，保证父组件 favorite 兜底值不会挡住当前点击后的视觉反馈。
      this.localFavoriteOverride = Boolean(result.favorite);

      // 事件: toggle-favorite。
      // 作用: 继续通知父组件当前卡片发生收藏切换，便于个人中心后续同步列表删除或统计。
      // 参数: targetItem，object，当前视频对象。
      // 参数: result，object，收藏切换结果。
      this.$emit('toggle-favorite', targetItem, result);
    },

    /**
     * 向父组件透传删除事件。
     * 触发来源: VideoCard 的 @delete 事件。
     * 当前容器不直接删除记录，避免把历史列表删除策略写进通用卡片容器。
     * 副作用: 派发 delete 组件事件，不直接修改播放历史数组。
     *
     * @param {object} item VideoCard 抛出的当前视频对象。
     * @returns {void} 只向父组件派发 delete 事件。
     */
    handleDelete(item) {
      // 类型: object。
      // 作用: 优先使用 VideoCard 抛出的对象，缺失时回退到当前 props.video。
      const targetItem = item || this.video;

      // 事件: delete。
      // 作用: 把删除请求交给个人中心历史列表等父级组件处理。
      // 参数: targetItem，object，当前视频对象。
      this.$emit('delete', targetItem);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 用户状态视频卡片根组件 `.user-video-card`。
  样式作用:
  保持容器组件和原 VideoCard 一样填满父级栅格。
  避免新增状态容器后影响首页、目录页、搜索页和个人中心现有网格布局。
*/
.user-video-card {
  /* 设置状态容器宽度填满父级卡片坑位，保持原 VideoCard 的响应式布局能力。 */
  width: 100%;
}
</style>
