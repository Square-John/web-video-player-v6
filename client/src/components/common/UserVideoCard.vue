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
    │      -- playback：父组件传入的播放状态兜底，用于历史列表等已经知道播放语义的场景。
    │      -- preferProvidedPlayback：是否优先展示当前记录 playback，而不是同内容最近记录。
    │      -- showDelete：父组件传入的删除按钮开关，用于播放历史等内部记录场景。
    │      -- navigationTarget：父组件传入的可选 Vue Router 目标，独立于 ContentItem。
    │  - events:
    │      @toggle-favorite
    │          - description:
    │              用户点击 VideoCard 收藏按钮时触发。
    │              容器等待 Repository 提交并由 userContentStore 采用后，再把结果向父组件透出。
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
                用于把收藏切换交给 userContentService 执行 Repository-first 持久化事务。
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
    :show-source-status="showSourceStatus"
    :source-available="sourceAvailable"
    :source-status-text="sourceStatusText"
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
// 文件作用: 用户点击收藏按钮时先提交 Repository，再由统一 store 发布结果。
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

    // 类型: object|null。
    // 来源: 父组件在播放历史等明确播放语义场景下传入。
    // 作用: 在用户内容 selector 尚未命中时提供播放状态兜底，保证历史列表仍能展示进度。
    // 字段: played，boolean，是否已播放。
    // 字段: currentEpisode，string|number，电视剧当前播放集。
    // 字段: playedSeconds，number，当前记录已播放秒数。
    // 字段: durationSeconds，number|null，当前记录独立总时长秒数。
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
    },

    // 类型: boolean；来源: 个人中心父页面；作用: 决定 VideoCard 是否显示来源状态点。
    // true: 显示状态点；false: 保持全站普通卡片默认结构。
    showSourceStatus: {
      type: Boolean,
      default: false
    },

    // 类型: boolean；来源: 个人中心通过统一恢复服务派生；作用: 透传状态点可用颜色。
    sourceAvailable: {
      type: Boolean,
      default: false
    },

    // 类型: string；来源: 个人中心统一恢复服务；作用: 透传状态点提示和无障碍名称。
    sourceStatusText: {
      type: String,
      default: ''
    }
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
     * 数据来源: 只使用 Repository 提交后 userContentStore 发布的 selector 结果。
     * 纯函数: 不保存组件级收藏影子状态，数据库提交前视觉保持原稳定值。
     *
     * @returns {boolean} true 表示显示已收藏按钮状态。
     */
    displayFavorite() {
      // 返回值类型: boolean。
      // 作用: 只反映 Repository 成功后采用的全局收藏投影。
      return Boolean(this.userStatus.favorite);
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
     * @returns {number} return.playedSeconds 已播放秒数。
     * @returns {number|null} return.durationSeconds 总时长秒数。
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
     * @returns {number} return.playedSeconds 当前记录已播放秒数。
     * @returns {number|null} return.durationSeconds 当前记录总时长秒数。
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

        // 类型: number。
        // 作用: 只传递当前历史或会话的结构化进度，最终显示由 VideoCard 统一格式化。
        playedSeconds: Number(safeRecord.playedSeconds) >= 0 ? Number(safeRecord.playedSeconds) : 0,

        // 类型: number|null。
        // 作用: 独立传递播放器或历史确认的总时长，未知时保持 null，不读取或复制已播放进度。
        durationSeconds: Number(safeRecord.durationSeconds) > 0
          ? Number(safeRecord.durationSeconds)
          : null,

        // 类型: string。
        // 作用: 优先保留父组件展示文本，否则把历史 ISO 时间转换为短时间文本。
        recentPlayedAtText: safeRecord.recentPlayedAtText
          || this.formatDisplayDateTime(safeRecord.lastPlayedAt)
      };
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
     * 副作用: 等待 userContentService 完成 Repository 事务和 store 采用，成功后透传事件。
     * 成功路径: selector 已反映新收藏状态后向父组件发送 toggle-favorite。
     * 失败路径: 展示稳定失败提示，收藏视觉保持旧投影且不向父组件报告成功。
     *
     * @param {object} item VideoCard 抛出的当前视频对象。
     * @returns {Promise<void>} 收藏事务及事件处理完成后结束。
     */
    async handleToggleFavorite(item) {
      // 类型: object。
      // 作用: 优先使用 VideoCard 抛出的对象，缺失时回退到当前 props.video。
      const targetItem = item || this.video;

      try {
        // 类型: object；作用: 等待数据库提交后取得与 store 一致的收藏切换结果。
        const result = await toggleFavorite(targetItem);
        // 事件: toggle-favorite；作用: 只在真实提交成功后通知父组件更新列表或统计。
        this.$emit('toggle-favorite', targetItem, result);
      } catch {
        // 失败处理: 不创建本地覆盖；Element UI 只展示安全文案，原始保存对象不会进入页面。
        this.$message.error('收藏状态保存失败，请稍后重试');
      }
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
