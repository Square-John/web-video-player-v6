<!--
  PlayCatalogSelector.vue 文件说明

  - 文件职责:
      使用同一模板展示线路总数下拉、当前浏览线路状态和该线路的电影入口或电视剧选集。
      供 DetailView 宽内容区与 PlayerView 右侧窄栏复用，通过组件自身容器宽度调整布局。

  - 页面作用:
      让用户先浏览线路，再选择该线路真实提供的逻辑剧集。
      组件只发出 line-change 和 episode-select 意图，不修改 Router、Store、历史或播放器实例。

  - 数据来源:
      playCatalog、browsedLineId、selectedEpisodeId、pending 和可选媒体可达投影均由详情或播放宿主传入。
      目录读取只调用 playCatalogSelectionService 的通用精确身份函数。

  - 交互影响:
      线路菜单选择发出稳定 lineId；剧集按钮选择发出 lineId、episodeId 和展示序号。
      不可用线路或不可播放剧集保持可见但禁用；只有播放宿主开启可达展示时才渲染当前会话真实媒体三态。

  - 维护边界:
      禁止加入 sourceId、域名、源站选择器、媒体 URL、请求流程或页面类型分支。
      禁止为详情和播放创建第二套模板、脚本测宽、固定按钮宽度或持久化浏览状态。

  - 组件依赖:
      getPlayCatalogLines/findPlayCatalogLine: 通用目录读取函数，用于过滤无身份线路并精确定位浏览线路。

  - 组件状态:
      无持久状态；原生 details 的 open 只属于浏览器控件瞬时交互。

  - 对外接口:
      props: playCatalog、browsedLineId、selectedEpisodeId、pending、showReachabilityStatus、lineReachabilityStatuses、episodeReachabilityStatuses。
      emits: line-change、episode-select。
-->

<template>
  <!-- 统一目录根容器建立容器查询边界，宿主只决定可用宽度。 -->
  <section
    class="play-catalog-selector"
    aria-labelledby="play-catalog-selector-title"
    :aria-busy="pending ? 'true' : 'false'"
  >
    <!-- 标题行在宽容器保持一行，窄侧栏按自身宽度自然换行。 -->
    <header class="play-catalog-selector__header">
      <!-- 功能标题属于详情和播放共用真实内容，不是重复页面标题。 -->
      <h2 id="play-catalog-selector-title" class="play-catalog-selector__title">选集播放</h2>

      <!-- 控件组同时提供线路列表入口和当前浏览线路回显。 -->
      <div class="play-catalog-selector__controls">
        <!-- 原生 details 提供键盘可达下拉，不引入页面级菜单状态。 -->
        <details
          ref="lineMenu"
          class="play-catalog-selector__line-menu"
          @focusout="handleLineMenuFocusOut"
          @keydown.esc.prevent="closeLineMenu"
        >
          <!-- summary 显示真实线路总数，展开后保留统一按钮树。 -->
          <summary class="play-catalog-selector__line-trigger">
            <span>线路列表（{{ lines.length }}）</span>
            <i class="el-icon-arrow-down" aria-hidden="true"></i>
          </summary>

          <!-- 线路候选菜单按 Provider 目录顺序显示，不隐藏不可用线路。 -->
          <div class="play-catalog-selector__line-options" role="listbox" aria-label="播放线路">
            <button
              v-for="line in lines"
              :key="line.id"
              class="play-catalog-selector__line-option"
              :class="{ 'is-selected': line.id === currentLineId }"
              type="button"
              role="option"
              :disabled="pending"
              :aria-selected="line.id === currentLineId ? 'true' : 'false'"
              :title="line.available === false ? line.unavailableReason : ''"
              @click="selectLine(line)"
            >
              <!-- 播放页显式开启后才显示真实媒体三态；详情页和未知状态不渲染状态点。 -->
              <span
                v-if="lineReachabilityStatus(line)"
                class="play-catalog-selector__status-dot"
                :class="reachabilityStatusClass(lineReachabilityStatus(line))"
                aria-hidden="true"
              ></span>
              <span class="play-catalog-selector__line-name">{{ line.name || line.id }}</span>
              <span v-if="lineReachabilityStatus(line)" class="play-catalog-selector__sr-only">
                {{ reachabilityStatusText(lineReachabilityStatus(line)) }}
              </span>
            </button>
          </div>
        </details>

        <!-- Chip 只回显当前浏览线路，播放页顶部另行显示实际 playingLineId。 -->
        <span
          v-if="currentLine"
          class="play-catalog-selector__current-line"
          :title="currentLine.available === false ? currentLine.unavailableReason : ''"
        >
          <span
            v-if="lineReachabilityStatus(currentLine)"
            class="play-catalog-selector__status-dot"
            :class="reachabilityStatusClass(lineReachabilityStatus(currentLine))"
            aria-hidden="true"
          ></span>
          <span class="play-catalog-selector__current-name">{{ currentLine.name || currentLine.id }}</span>
          <span class="play-catalog-selector__sr-only">
            当前浏览线路<span v-if="lineReachabilityStatus(currentLine)">，{{ reachabilityStatusText(lineReachabilityStatus(currentLine)) }}</span>
          </span>
        </span>
      </div>
    </header>

    <!-- 当前线路有条目时渲染自然宽度按钮；电影通常只有一个入口。 -->
    <div v-if="episodes.length" class="play-catalog-selector__episodes" role="list" aria-label="选集列表">
      <button
        v-for="(episode, index) in episodes"
        :key="episode.id"
        class="play-catalog-selector__episode"
        :class="{ 'is-selected': episode.id === selectedEpisodeId }"
        type="button"
        role="listitem"
        :disabled="pending || currentLine.available === false || episode.playable === false"
        :aria-current="episode.id === selectedEpisodeId ? 'true' : null"
        @click="selectEpisode(episode, index)"
      >
        <!-- 分集状态只读取当前浏览线路的精确 lineId + episodeId 会话结果。 -->
        <span
          v-if="episodeReachabilityStatus(episode)"
          class="play-catalog-selector__status-dot"
          :class="reachabilityStatusClass(episodeReachabilityStatus(episode))"
          aria-hidden="true"
        ></span>
        <span>{{ episode.label || episode.title || episode.id }}</span>
        <span v-if="episodeReachabilityStatus(episode)" class="play-catalog-selector__sr-only">
          {{ reachabilityStatusText(episodeReachabilityStatus(episode)) }}
        </span>
      </button>
    </div>

    <!-- 空目录或空线路使用同一紧凑空态，不生成虚假正片或默认集。 -->
    <div v-else class="play-catalog-selector__empty" role="status">
      当前线路暂无可选内容
    </div>
  </section>
</template>

<script>
/*
  PlayCatalogSelector.vue 模块说明

  - 文件职责:
      定义详情页和播放页共用的播放目录组件逻辑。
      根据 ContentItem.playCatalog 渲染线路下拉、浏览线路状态和该线路自己的选集。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      getPlayCatalogLines、findPlayCatalogLine: 自定义服务函数，读取合法线路并按线路 id 精确定位当前浏览线路。
      MEDIA_REACHABILITY_STATUS: 自定义配置，限制播放页媒体状态为 checking/available/unavailable。

  - 模块级常量:
      MEDIA_REACHABILITY_STATUS_TEXT: Readonly<object>，三态到无障碍中文说明的映射。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      PlayCatalogSelector: default Vue component options，向详情和播放宿主发出线路与选集意图。
*/

// 导入来源: ../../services/playCatalogSelectionService.js。
// 导入内容: getPlayCatalogLines 与 findPlayCatalogLine 自定义服务函数。
// 文件作用: 读取合法线路并按稳定 id 精确定位当前浏览线路。
import {
  getPlayCatalogLines,
  findPlayCatalogLine
} from '../../services/playCatalogSelectionService.js';

// 导入来源: ../../config/mediaPlayback.config.js。
// 导入内容: MEDIA_REACHABILITY_STATUS 播放媒体三态枚举。
// 文件作用: 校验播放宿主传入的运行态，未知值不生成状态点或 CSS class。
import { MEDIA_REACHABILITY_STATUS } from '../../config/mediaPlayback.config.js';

// 类型: Readonly<object>。
// 作用: 把播放页媒体三态转换为屏幕阅读器可理解的中文说明，视觉仍只使用颜色点。
const MEDIA_REACHABILITY_STATUS_TEXT = Object.freeze({
  [MEDIA_REACHABILITY_STATUS.checking]: '正在检测',
  [MEDIA_REACHABILITY_STATUS.available]: '可用',
  [MEDIA_REACHABILITY_STATUS.unavailable]: '不可用'
});

// 导出类型: default Vue component options。
// 导出内容: PlayCatalogSelector 统一播放目录组件。
// 外部调用方: DetailView.vue 与 PlayerView.vue。
// 使用场景: 详情宽容器和播放右侧窄栏复用同一线路下拉及选集按钮树。
export default {
  // 类型: string；作用: 提供稳定组件名，供 Vue Devtools 和 KeepAlive 诊断。
  name: 'PlayCatalogSelector',

  // 类型: object；作用: 声明宿主提供的标准目录、浏览身份、选中身份和候选交互锁。
  props: {
    // 类型: object|null；作用: ContentItem.playCatalog 唯一目录；null 表示当前内容尚未提供目录。
    playCatalog: {
      type: Object,
      default: null
    },
    // 类型: string；作用: 当前选集列表所属线路 id，不表示播放器已经采用该线路。
    browsedLineId: {
      type: String,
      default: ''
    },
    // 类型: string；作用: 当前需要高亮的逻辑剧集 id；目标线路缺集时为空字符串。
    selectedEpisodeId: {
      type: String,
      default: ''
    },
    // 类型: boolean；true 表示候选媒体正在解析并禁用重复选集命令，false 表示允许操作。
    pending: {
      type: Boolean,
      default: false
    },
    // 类型: boolean；true 表示播放页展示会话级媒体红蓝绿，false 表示详情页只罗列目录且不显示任何可达状态。
    showReachabilityStatus: {
      type: Boolean,
      default: false
    },
    // 类型: boolean；true 允许显示当前线路分集三态，false 让详情页只显示线路状态。
    showEpisodeReachabilityStatus: {
      type: Boolean,
      default: true
    },
    // 类型: object；作用: 播放宿主按 lineId 提供 checking/available/unavailable；详情页和未知线路使用空对象。
    lineReachabilityStatuses: {
      type: Object,
      /**
       * 创建隔离的空线路状态投影。
       * 纯函数: 每个组件实例返回新对象，不共享宿主状态。
       *
       * @returns {object} 空 lineId 状态映射。
       */
      default() {
        return {};
      }
    },
    // 类型: object；作用: 播放宿主按 lineId -> episodeId 提供精确三态；不存在的条目不显示状态点。
    episodeReachabilityStatuses: {
      type: Object,
      /**
       * 创建隔离的空分集状态投影。
       * 纯函数: 每个组件实例返回新对象，不共享嵌套线路状态。
       *
       * @returns {object} 空 lineId -> episodeId 状态映射。
       */
      default() {
        return {};
      }
    }
  },

  // 类型: object；作用: 从 props 派生合法线路、当前线路和当前线路真实选集，不保存副本。
  computed: {
    /**
     * 读取标准目录中的合法线路。
     * 纯函数: 不修改 playCatalog，服务返回新的数组外壳。
     *
     * @returns {Array<object>} 保留 Provider 顺序的线路列表。
     */
    lines() {
      // 返回值类型: Array<object>；作用: 给线路菜单和数量回显使用同一集合。
      return getPlayCatalogLines(this.playCatalog);
    },

    /**
     * 读取当前浏览线路 id。
     * 纯函数: 优先使用宿主明确身份；身份失效时只显示目录首项，不向宿主反向写入。
     *
     * @returns {string} 当前可渲染线路 id；空目录返回空字符串。
     */
    currentLineId() {
      // 类型: object|null；作用: 检查宿主身份是否仍属于当前目录。
      const explicitLine = findPlayCatalogLine(this.playCatalog, this.browsedLineId);
      // 返回值类型: string；作用: 有效身份优先，否则只使用首项作为无副作用显示后备。
      return explicitLine?.id || this.lines[0]?.id || '';
    },

    /**
     * 读取当前浏览线路对象。
     * 纯函数: 只按 currentLineId 精确读取，不修改目录。
     *
     * @returns {object|null} 当前线路或 null。
     */
    currentLine() {
      // 返回值类型: object|null；作用: 统一驱动 Chip、状态点、选集和禁用状态。
      return findPlayCatalogLine(this.playCatalog, this.currentLineId);
    },

    /**
     * 读取当前线路自己的选集。
     * 纯函数: 过滤无身份条目但不改变 Provider 排序，不跨线路补集。
     *
     * @returns {Array<object>} 当前线路合法 PlayCatalogEpisode 列表。
     */
    episodes() {
      // 条件分支: 当前线路没有标准数组时进入；执行内容: 返回空态所需空集合。
      if (!Array.isArray(this.currentLine?.episodes)) return [];
      // 返回值类型: Array<object>；作用: 排除空对象和空身份，防止按钮 key 与事件目标不稳定。
      return this.currentLine.episodes.filter(episode => episode
        && typeof episode === 'object'
        && !Array.isArray(episode)
        && typeof episode.id === 'string'
        && Boolean(episode.id.trim()));
    }
  },

  // 类型: object；作用: 提供线路菜单关闭、线路意图和剧集意图三个局部交互方法。
  methods: {
    /**
     * 校验媒体可达状态。
     * 纯函数: 只接受冻结三态，未知、空值或详情页关闭状态返回空字符串。
     *
     * @param {*} status 播放宿主传入的状态候选。
     * @returns {string} 合法三态或空字符串。
     */
    normalizeReachabilityStatus(status) {
      // 条件分支: 当前宿主没有开启播放媒体状态时进入；执行内容: 详情页完全隐藏状态。
      if (!this.showReachabilityStatus) return '';
      // 返回值类型: string；作用: 只允许 checking/available/unavailable 形成状态点。
      return Object.values(MEDIA_REACHABILITY_STATUS).includes(status) ? status : '';
    },

    /**
     * 读取一条线路的会话级媒体状态。
     * 纯函数: 优先读取播放页真实代表目标结果；结构显式不可用时可直接显示红色，其他未知状态不显示。
     *
     * @param {object|null} line 当前目录线路。
     * @returns {string} 合法三态或空字符串。
     */
    lineReachabilityStatus(line) {
      // 类型: string；作用: 按稳定线路 id 读取播放页运行态，空身份不能命中对象动态键。
      const lineId = typeof line?.id === 'string' ? line.id : '';
      // 类型: string；作用: 校验宿主显式状态，非法值保持未知。
      const explicitStatus = lineId
        ? this.normalizeReachabilityStatus(this.lineReachabilityStatuses[lineId])
        : '';
      // 条件分支: 当前线路已有真实 checking/available/unavailable 时进入；执行内容: 直接采用该状态。
      if (explicitStatus) return explicitStatus;
      // 返回值类型: string；作用: Provider 明确不可请求时显示红色；其余未检测线路不伪装为绿色。
      return this.showReachabilityStatus && line?.available === false
        ? MEDIA_REACHABILITY_STATUS.unavailable
        : '';
    },

    /**
     * 读取当前浏览线路中一个逻辑剧集的精确媒体状态。
     * 纯函数: 只读取 lineId -> episodeId 运行态；未探测条目保持无状态点。
     *
     * @param {object|null} episode 当前目录剧集。
     * @returns {string} 合法三态或空字符串。
     */
    episodeReachabilityStatus(episode) {
      // 条件分支: 宿主明确关闭分集媒体状态时进入；执行内容: 不显示显式结果或结构 playable 结果。
      if (!this.showEpisodeReachabilityStatus) return '';
      // 类型: string；作用: 当前浏览线路身份决定嵌套状态分区，避免不同线路同一 episodeId 共享结果。
      const lineId = this.currentLineId;
      // 类型: string；作用: 只接受标准逻辑剧集 id，空身份不读取动态键。
      const episodeId = typeof episode?.id === 'string' ? episode.id : '';
      // 类型: string；作用: 校验播放宿主为精确线路剧集提供的真实状态。
      const explicitStatus = lineId && episodeId
        ? this.normalizeReachabilityStatus(this.episodeReachabilityStatuses[lineId]?.[episodeId])
        : '';
      // 条件分支: 当前精确媒体已有真实三态时进入；执行内容: 直接采用该状态。
      if (explicitStatus) return explicitStatus;
      // 返回值类型: string；作用: Provider 明确不可请求的分集显示红色；未检测 playable 分集不显示绿色。
      return this.showReachabilityStatus && episode?.playable === false
        ? MEDIA_REACHABILITY_STATUS.unavailable
        : '';
    },

    /**
     * 创建媒体状态点 CSS class。
     * 纯函数: 合法三态返回固定 is-*，未知值返回空字符串。
     *
     * @param {*} status 媒体状态候选。
     * @returns {string} 状态样式类或空字符串。
     */
    reachabilityStatusClass(status) {
      // 类型: string；作用: 再次校验模板调用输入，避免任意字符串进入 class。
      const normalizedStatus = this.normalizeReachabilityStatus(status);
      return normalizedStatus ? `is-${normalizedStatus}` : '';
    },

    /**
     * 创建媒体状态无障碍文案。
     * 纯函数: 合法三态读取固定中文映射，未知值返回空字符串。
     *
     * @param {*} status 媒体状态候选。
     * @returns {string} 正在检测、可用、不可用或空字符串。
     */
    reachabilityStatusText(status) {
      // 类型: string；作用: 校验后读取冻结文案，详情页关闭状态始终为空。
      const normalizedStatus = this.normalizeReachabilityStatus(status);
      return MEDIA_REACHABILITY_STATUS_TEXT[normalizedStatus] || '';
    },

    /**
     * 关闭原生线路下拉。
     * 副作用: 只修改当前 details DOM 的 open 属性，不写 Vue 业务状态。
     * 失败路径: ref 尚未挂载时直接返回。
     *
     * @returns {void} 无业务返回值。
     */
    closeLineMenu() {
      // 条件分支: details 已挂载时进入；执行内容: 收起当前组件自己的菜单。
      if (this.$refs.lineMenu) this.$refs.lineMenu.open = false;
    },

    /**
     * 焦点离开整棵线路菜单时收起下拉。
     * 副作用: 可能关闭当前 details，不注册 document 全局监听。
     *
     * @param {FocusEvent} event 原生 focusout 事件。
     * @returns {void} 无业务返回值。
     */
    handleLineMenuFocusOut(event) {
      // 类型: Node|null；作用: 保存下一个获得焦点的节点，null 表示焦点离开文档或不可识别。
      const nextTarget = event.relatedTarget;
      // 条件分支: 下一个焦点仍在当前 details 内时进入；执行内容: 保持菜单打开供键盘继续选择。
      if (nextTarget && event.currentTarget.contains(nextTarget)) return;
      // 副作用: 焦点离开组件后关闭菜单，避免下拉遮挡后续内容。
      this.closeLineMenu();
    },

    /**
     * 向宿主提交浏览线路意图。
     * 副作用: 发出 line-change 并关闭菜单；不修改媒体、路由或历史。
     * 失败路径: 线路对象或 id 无效时不发事件。
     *
     * @param {object} line 用户点击的 PlayCatalogLine。
     * @returns {void} 结果通过 Vue 事件交给宿主。
     */
    selectLine(line) {
      // 条件分支: 线路身份无效时进入；执行内容: 关闭菜单并拒绝不稳定事件。
      if (!line || typeof line.id !== 'string' || !line.id.trim()) {
        this.closeLineMenu();
        return;
      }
      // 副作用: 提交稳定线路 id；宿主使用纯选择服务决定只浏览、缺集或候选解析。
      this.$emit('line-change', line.id);
      // 副作用: 用户完成一次选择后关闭线路菜单。
      this.closeLineMenu();
    },

    /**
     * 向宿主提交当前浏览线路中的手动选集意图。
     * 副作用: 发出 episode-select，不直接请求 Provider 或创建历史。
     * 失败路径: 当前线路或逻辑剧集身份无效时不发事件。
     *
     * @param {object} episode 用户点击的 PlayCatalogEpisode。
     * @param {number} index 剧集在当前线路中的零基显示位置。
     * @returns {void} 结果通过 Vue 事件交给宿主。
     */
    selectEpisode(episode, index) {
      // 条件分支: 当前线路或剧集身份无效时进入；执行内容: 拒绝构造不完整媒体目标。
      if (!this.currentLineId || !episode || typeof episode.id !== 'string' || !episode.id.trim()) return;
      // 副作用: 提交结构化目标；episodeIndex 只表达一基显示序号，不参与逻辑同集匹配。
      this.$emit('episode-select', {
        lineId: this.currentLineId,
        episodeId: episode.id,
        episodeIndex: index + 1,
        episode
      });
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 统一播放目录根容器。
  样式作用:
  建立组件自身宽度查询边界，详情与播放宿主只控制外部可用宽度。
  让标题、线路控件和选集严格按内容高度从顶部排列，不被满高播放侧栏拉伸。
*/
.play-catalog-selector {
  container-type: inline-size;
  min-width: 0;
  display: grid;
  grid-template-rows: max-content max-content;
  align-content: start;
  gap: 16px;
  color: var(--play-catalog-text-color, var(--text-primary));
}

/* 标题和线路控件默认在宽容器同一行，两侧按内容自然占宽。 */
.play-catalog-selector__header {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* 功能标题使用紧凑面板字号，不使用页面级大标题。 */
.play-catalog-selector__title {
  min-width: max-content;
  margin: 0;
  font-size: 18px;
  line-height: 1.3;
  letter-spacing: 0;
  /* 使用宿主可覆盖的标题色；详情页默认沿用正文色，深色播放页只覆盖这一视觉语义。 */
  color: var(--play-catalog-title-color, var(--play-catalog-text-color, var(--text-primary)));
}

/* 线路下拉和当前浏览 Chip 允许在窄容器换行但不挤压名称。 */
.play-catalog-selector__controls {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

/* 原生 details 作为下拉定位上下文，不绘制额外卡片外壳。 */
.play-catalog-selector__line-menu {
  position: relative;
}

/* 下拉触发器使用紧凑命令尺寸和熟悉箭头，不显示浏览器默认三角。 */
.play-catalog-selector__line-trigger {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 6px 10px;
  border: 1px solid var(--play-catalog-control-border, var(--border-color));
  border-radius: 6px;
  background: var(--play-catalog-control-background, var(--surface));
  color: var(--play-catalog-text-color, var(--text-primary));
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

/* 隐藏 Chromium 和 Safari 默认 disclosure 标记，保留项目箭头。 */
.play-catalog-selector__line-trigger::-webkit-details-marker {
  display: none;
}

/* 打开菜单时旋转同一个箭头，避免新增文字状态。 */
.play-catalog-selector__line-menu[open] .play-catalog-selector__line-trigger .el-icon-arrow-down {
  transform: rotate(180deg);
}

/* 箭头只做短促状态转换，不改变触发器尺寸。 */
.play-catalog-selector__line-trigger .el-icon-arrow-down {
  transition: transform 160ms ease;
}

/* 线路候选在触发器下方形成有界菜单，长列表通过菜单自身滚动。 */
.play-catalog-selector__line-options {
  position: absolute;
  z-index: 12;
  top: calc(100% + 6px);
  right: 0;
  width: max-content;
  min-width: 180px;
  max-width: min(320px, 80cqi);
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--play-catalog-control-border, var(--border-color));
  border-radius: 6px;
  background: var(--play-catalog-control-background, var(--surface));
  box-shadow: var(--play-catalog-menu-shadow, var(--shadow-soft));
}

/* 每条线路使用单行按钮，状态点、名称和选中背景保持稳定。 */
.play-catalog-selector__line-option {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--play-catalog-text-color, var(--text-primary));
  text-align: left;
  cursor: pointer;
}

/* 鼠标和键盘焦点使用同一中性强调，不改变按钮布局。 */
.play-catalog-selector__line-option:hover,
.play-catalog-selector__line-option:focus-visible,
.play-catalog-selector__line-option.is-selected {
  background: var(--play-catalog-control-background-muted, var(--surface-muted));
  outline: none;
}

/* 候选交接期间线路按钮保持可读但不接受第二次命令，不显示额外过程文案。 */
.play-catalog-selector__line-option:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

/* 线路名称允许省略过长显示文本，完整内容仍由按钮 title 和数据对象保留。 */
.play-catalog-selector__line-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 当前浏览线路 Chip 采用自然宽度，状态点和名称不使用固定百分比。 */
.play-catalog-selector__current-line {
  max-width: 220px;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 9px;
  border: 1px solid var(--play-catalog-control-border, var(--border-color));
  border-radius: 999px;
  background: var(--play-catalog-control-background-muted, var(--surface-muted));
  color: var(--play-catalog-text-color, var(--text-primary));
  font-size: 12px;
  line-height: 1.2;
}

/* Chip 名称在极长 Provider 文案下省略，防止反向撑宽侧栏。 */
.play-catalog-selector__current-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 状态点使用固定圆形尺寸，只表达播放页当前会话的真实媒体三态。 */
.play-catalog-selector__status-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
}

/* 可用状态采用项目成功色。 */
.play-catalog-selector__status-dot.is-available {
  background: var(--success);
}

/* 检测中状态采用稳定蓝色，等待串行队列和正在准备共用该语义。 */
.play-catalog-selector__status-dot.is-checking {
  background: #3b82f6;
}

/* 不可用状态采用项目危险色。 */
.play-catalog-selector__status-dot.is-unavailable {
  background: var(--danger);
}

/* 选集按钮从左上角按内容自然撑宽并连续换行，不消费侧栏虚构剩余高度。 */
.play-catalog-selector__episodes {
  min-width: 0;
  display: flex;
  align-items: center;
  align-content: flex-start;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 9px 8px;
}

/* 选集按钮保持稳定点击高度和自然内容宽度，统一普通、悬停与选中视觉层级。 */
.play-catalog-selector__episode {
  min-width: 52px;
  min-height: 36px;
  max-width: 100%;
  padding: 7px 12px;
  border: 1px solid var(--play-catalog-control-border, var(--border-color));
  border-radius: 6px;
  background: var(--play-catalog-control-background-muted, var(--surface-muted));
  color: var(--play-catalog-text-color, var(--text-primary));
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
  cursor: pointer;

  /* 让可选状态点、分集文字和无障碍隐藏文本共享稳定横向对齐。 */
  display: inline-flex;

  /* 垂直居中状态点与一至两行分集文案。 */
  align-items: center;

  /* 保留状态点和分集名称之间的紧凑间距。 */
  gap: 7px;
}

/* 鼠标悬停和键盘焦点只强化背景与边框，不改变按钮尺寸或选集排列。 */
.play-catalog-selector__episode:hover:not(:disabled),
.play-catalog-selector__episode:focus-visible {
  border-color: var(--play-catalog-accent-color, var(--accent));
  background: var(--play-catalog-accent-background, var(--accent-soft));
  outline: none;
}

/* 选中剧集使用主题强调色，保持按钮尺寸不发生变化。 */
.play-catalog-selector__episode.is-selected {
  border-color: var(--play-catalog-accent-color, var(--accent));
  background: var(--play-catalog-accent-background, var(--accent-soft));
  color: var(--play-catalog-selected-text-color, var(--accent));
}

/* 不可播放或候选处理中禁用按钮并保留可读文字。 */
.play-catalog-selector__episode:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* 空线路使用低强调文字并保留稳定最小高度。 */
.play-catalog-selector__empty {
  min-height: 44px;
  display: flex;
  align-items: center;
  color: var(--play-catalog-muted-color, var(--text-muted));
  font-size: 13px;
}

/* 屏幕阅读器文本保持语义可读但不占据视觉布局。 */
.play-catalog-selector__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/*
  作用容器: 宽度不超过 460px 的播放目录组件。
  样式作用:
  让播放侧栏和窄详情区域把标题、控件和菜单改为自身宽度内的纵向流。
*/
@container (max-width: 460px) {
  /* 窄容器标题行改为纵向排列，不依赖页面或视口类型。 */
  .play-catalog-selector__header {
    align-items: stretch;
    flex-direction: column;
    gap: 9px;
  }

  /* 窄容器控件从左侧开始并允许完整换行。 */
  .play-catalog-selector__controls {
    justify-content: flex-start;
  }

  /* 窄容器菜单从左边缘展开，宽度受组件自身限制。 */
  .play-catalog-selector__line-options {
    right: auto;
    left: 0;
    max-width: 100cqi;
  }
}
</style>
