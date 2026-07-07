<template>
  <!--
    HotMovieSection 首页热门电影区块渲染树

    {section.section-wrapper}
    ├─ {div.section-head}
    │  ├─ {h2.section-title} 热门电影标题
    │  └─ {button.section-more-link} 更多入口占位
    └─ {div.section-body}
       ├─ {div.section-grid}
       │  ├─ [if hasMovies]
       │  │  └─ {VideoCard} 循环渲染 displayMovies，最多显示 8 张
       │  └─ [else]
       │     └─ {el-empty} 电影卡片分区空状态
       └─ {aside.section-aside}
          └─ {div.ranking-panel-shell}
             └─ {HotRanking} 渲染 movieRanking、刷新入口和榜单空状态
  -->
  <section class="section-wrapper">
    <!--
      热门电影标题栏。
      渲染位置：电影区块顶部。
      页面作用：标识当前区块内容，并保留后续跳转电影页的“更多”入口位置。
    -->
    <div class="section-head">
      <h2 class="section-title">热门电影</h2>
      <button class="section-more-link" type="button">更多</button>
    </div>

    <!--
      热门电影主体。
      左侧卡片网格读取 movies，右侧排行榜读取 ranking。
      两侧都独立处理空状态，保证局部无数据时页面结构不乱。
    -->
    <div class="section-body">
      <!-- 有电影数据时渲染视频卡片网格。 -->
      <div v-if="hasMovies" class="section-grid">
        <div v-for="movie in displayMovies" :key="movie.id || movie.title" class="card-cell">
          <VideoCard :video="movie" />
        </div>
      </div>

      <!-- 没有电影数据时，电影卡片分区显示 Element UI 空状态。 -->
      <el-empty
        v-else
        class="section-empty"
        description="当前热门电影模块没有数据" />

      <!-- 右侧电影榜单，榜单组件内部会继续判断 ranking 是否为空。 -->
      <aside class="section-aside">
        <!--
          排行榜内层壳。
          父级 section-aside 继续占 2 个页面格栅，壳层按 5 份取右侧 4 份，也就是 1.6 个格栅。
          壳层右对齐，让排行榜右侧继续贴合页面内容右边界。
        -->
        <div class="ranking-panel-shell">
          <HotRanking
            title="电影排行榜"
            ranking-key="movieRanking"
            :items="ranking"
            :refreshing="rankingRefreshing"
            @refresh-ranking="handleRefreshRanking"
            @open-more-ranking="handleOpenMoreRanking" />
        </div>
      </aside>
    </div>
  </section>
</template>

<script>
// 通用视频卡片组件，渲染在热门电影左侧网格中。
import VideoCard from '../common/VideoCard.vue';

// 首页排行榜组件，渲染在热门电影右侧侧栏中。
import HotRanking from './HotRanking.vue';

/**
 * 首页热门电影区块。
 *
 * 组件定位：
 * - 只负责展示首页电影列表和电影排行榜
 * - 不请求数据，不保存数据，也不决定数据来源
 * - 左侧固定展示最多 8 张卡片，形成两行四列的首页区块
 */
export default {
  name: 'HotMovieSection',

  components: {
    // VideoCard 负责单张电影卡片的封面、标题和元信息。
    VideoCard,

    // HotRanking 负责右侧电影排行榜。
    HotRanking
  },

  props: {
    // movies 驱动左侧热门电影卡片网格。
    // 渲染位置：`.section-grid` 内部的 VideoCard 列表。
    movies: {
      type: Array,
      required: true
    },

    // ranking 驱动右侧电影排行榜。
    // 渲染位置：`HotRanking :items="ranking"`。
    ranking: {
      type: Array,
      required: true
    },

    // rankingRefreshing 控制右侧电影排行榜刷新按钮状态。
    // true: 当前电影排行榜正在重新请求数据，刷新按钮禁用并显示刷新中。
    // false: 当前电影排行榜可以触发局部刷新。
    rankingRefreshing: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    /**
     * 左侧电影卡片区是否有数据。
     *
     * @returns {boolean} 有电影数据时返回 true。
     */
    hasMovies() {
      return this.displayMovies.length > 0;
    },

    /**
     * 首页实际展示的电影卡片。
     *
     * @returns {Array<object>} 最多 8 条电影数据，用于固定两行四列。
     */
    displayMovies() {
      // 首页卡片区只承担概览职责，8 条数据刚好组成两行四列，多出来的数据留给电影页列表承接。
      return Array.isArray(this.movies) ? this.movies.filter(Boolean).slice(0, 8) : [];
    }
  },

  methods: {
    /**
     * 向首页页面层转发电影排行榜刷新事件。
     * 触发来源: HotRanking 的 @refresh-ranking 事件。
     * 执行内容: 不在展示组件内请求数据，只把 rankingKey 继续抛给 HomeView。
     *
     * @param {string} rankingKey 需要刷新的首页排行榜数据桶名称。
     * @returns {void} 该方法只触发组件事件，不返回业务数据。
     */
    handleRefreshRanking(rankingKey) {
      // 事件: refresh-ranking。
      // 作用: 通知 HomeView 重新请求 movieRanking 数据桶。
      // 参数: rankingKey，string，当前需要刷新的排行榜数据桶。
      this.$emit('refresh-ranking', rankingKey);
    },

    /**
     * 向首页页面层转发电影排行榜查看更多事件。
     * 触发来源: HotRanking 的 @open-more-ranking 事件。
     * 执行内容: 不在区块组件内直接操作路由，只把 rankingKey 继续抛给 HomeView。
     *
     * @param {string} rankingKey 需要查看更多内容的首页排行榜数据桶名称。
     * @returns {void} 该方法只触发组件事件，不返回业务数据。
     */
    handleOpenMoreRanking(rankingKey) {
      // 事件: open-more-ranking。
      // 作用: 通知 HomeView 按 movieRanking 跳转到电影承接页面。
      // 参数: rankingKey，string，当前点击查看更多的排行榜数据桶。
      this.$emit('open-more-ranking', rankingKey);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 热门电影区块外层容器 `.section-wrapper`。
  样式作用:
  控制热门电影区块和下一个首页区块之间的垂直距离。
*/
.section-wrapper {
  /* 设置热门电影区块底部间距，让热门电影和热门电视剧区块不会贴在一起。 */
  margin-bottom: 36px;
}

/*
  作用容器: 热门电影标题栏 `.section-head`。
  样式作用:
  将左侧区块标题和右侧更多入口排成一行。
  保持标题和操作入口垂直居中。
  给标题和更多入口之间保留挤压缓冲。
*/
.section-head {
  /* 设置标题栏为 flex 横向布局，让标题和更多入口左右排列。 */
  display: flex;

  /* 设置标题和更多入口垂直居中，避免两者基线明显错位。 */
  align-items: center;

  /* 设置标题靠左、更多入口靠右，形成标准区块头部布局。 */
  justify-content: space-between;

  /* 设置标题和更多入口之间的最小间距，避免标题较长时贴住右侧入口。 */
  gap: 16px;

  /* 设置标题栏和下方卡片内容之间的距离。 */
  margin-bottom: 18px;
}

/*
  作用容器: 热门电影标题 `.section-title`。
  样式作用:
  强化热门电影区块标题层级。
  使用左侧强调线标记首页内容区块起点。
*/
.section-title {
  /* 设置区块标题字号，让热门电影标题明显高于卡片标题。 */
  font-size: 22px;

  /* 设置区块标题加粗，强化内容区块起点。 */
  font-weight: 700;

  /* 设置区块标题颜色为主文字色，保证浅色页面背景上的可读性。 */
  color: var(--text-primary);

  /* 清除标题默认底部外边距，避免标题栏高度被浏览器默认样式撑开。 */
  margin-bottom: 0;

  /* 设置标题文字左侧留白，让标题和蓝色竖线之间有呼吸空间。 */
  padding-left: 14px;

  /* 设置标题左侧强调线，用于统一首页区块标题视觉。 */
  border-left: 4px solid var(--accent);
}

/*
  作用容器: 热门电影更多入口 `.section-more-link`。
  样式作用:
  作为热门电影区块右侧的更多入口占位。
  保持次级操作视觉，不抢区块标题层级。
*/
.section-more-link {
  /* 设置更多入口为 inline-flex，方便文字和伪元素箭头垂直居中。 */
  display: inline-flex;

  /* 设置更多入口内部文字和箭头垂直居中。 */
  align-items: center;

  /* 禁止更多入口被标题挤压变形，保持自身内容宽度。 */
  flex: 0 0 auto;

  /* 设置更多入口字号低于区块标题，表达次级操作层级。 */
  font-size: 14px;

  /* 设置更多入口默认颜色为弱提示色，避免抢热门电影标题层级。 */
  color: var(--text-muted);

  /* 清除按钮默认背景，让更多入口更像轻量文本操作。 */
  background: transparent;

  /* 清除按钮默认边框，避免更多入口像主操作按钮。 */
  border: 0;

  /* 清除按钮默认内边距，让它和文本入口视觉一致。 */
  padding: 0;

  /* 鼠标移入时显示可点击状态，为后续跳转电影页预留交互反馈。 */
  cursor: pointer;

  /* 清除文本下划线，让更多入口贴近站内操作风格。 */
  text-decoration: none;

  /* 设置颜色过渡，让 hover 状态切换更柔和。 */
  transition: color 0.18s ease;
}

/*
  作用容器: 热门电影更多入口箭头 `.section-more-link::after`。
  样式作用:
  在更多入口文字后追加轻量箭头。
  不引入额外图标组件也能表达可进入更多内容。
*/
.section-more-link::after {
  /* 设置伪元素内容为右箭头符号，提示更多入口可继续进入。 */
  content: '>';

  /* 设置箭头和文字之间的距离，避免两个字符贴在一起。 */
  margin-left: 4px;

  /* 设置箭头字号略小于文字，让箭头保持辅助层级。 */
  font-size: 12px;
}

/*
  作用容器: 热门电影更多入口悬停态 `.section-more-link:hover`。
  样式作用:
  提示用户当前更多入口可以点击。
  使用主题强调色和默认弱提示色形成状态差异。
*/
.section-more-link:hover {
  /* 设置更多入口悬停时变为主题蓝色，让用户感知可交互状态。 */
  color: var(--accent);
}

/*
  作用容器: 热门电影主体布局 `.section-body`。
  样式作用:
  建立左侧四列电影卡片和右侧电影排行榜的 6 列布局。
  通过 CSS Grid 的行高拉伸，让右侧排行榜跟随左侧两行电影卡片真实高度。
  让电影排行榜贴合主体栅格最右列，右侧留白统一交给页面容器处理。
*/
.section-body {
  /* 设置热门电影主体为 CSS Grid，用 6 列承载左侧卡片区和右侧排行榜。 */
  display: grid;

  /* 设置热门电影主体拆成 6 等份，左侧电影卡片占 4 列，右侧排行榜占 2 列。 */
  grid-template-columns: repeat(var(--page-grid-columns), minmax(0, 1fr));

  /* 设置卡片区和排行榜之间、卡片之间使用统一页面栅格间距。 */
  gap: var(--page-grid-gap);

  /* 把主体布局尺寸按边框盒计算，避免后续新增内边距或边框时撑出横向滚动。 */
  box-sizing: border-box;

  /* 设置 grid 子项按当前行真实高度拉伸，让电影排行榜和左侧两行卡片底部自然对齐。 */
  align-items: stretch;
}

/*
  作用容器: 热门电影卡片网格 `.section-grid`。
  样式作用:
  把热门电影卡片固定为每行四张。
  和右侧排行榜共同构成首页热门电影双栏区块。
*/
.section-grid {
  /* 设置电影卡片区内部为 grid，方便把 8 张卡片排成两行四列。 */
  display: grid;

  /* 设置电影卡片区占据首页 6 列栅格中的前 4 列。 */
  grid-column: span 4;

  /* 设置电影卡片区内部为 4 列，让热门电影首屏形成两行四列。 */
  grid-template-columns: repeat(4, minmax(0, 1fr));

  /* 设置电影卡片之间的横向和纵向距离，保持和页面栅格统一。 */
  gap: var(--page-grid-gap);

  /* 允许电影卡片网格收缩，避免长标题或角标把首页横向撑宽。 */
  min-width: 0;

  /* 设置多行电影卡片从顶部开始堆叠，不因右侧排行榜高度产生拉散。 */
  align-content: start;
}

/*
  作用容器: 热门电影右侧排行榜列 `.section-aside`。
  样式作用:
  承载电影排行榜组件。
  跟随 CSS Grid 行高拉伸到左侧两行电影卡片的真实高度。
  隔离排行榜内容自身高度，避免右侧榜单反过来撑高整行。
  让排行榜内部列表在固定高度内滚动。
*/
.section-aside {
  /* 设置电影排行榜列占据首页 6 列栅格中的最后 2 列。 */
  grid-column: span 2;

  /* 允许电影排行榜列收缩，避免榜单标题或条目撑破右侧列宽。 */
  min-width: 0;

  /* 清除浏览器默认最小高度影响，让内部排行榜能在固定高度内滚动。 */
  min-height: 0;

  /* 让电影排行榜列跟随 grid 当前行高度拉伸，不再用固定或推导高度。 */
  align-self: stretch;

  /* 隔离电影排行榜内容尺寸贡献，让 grid 行高只由左侧两行电影卡片决定。 */
  contain: size;

  /* 裁掉排行榜面板外部溢出，内部列表可见条数由 HotRanking 根据高度计算。 */
  overflow: hidden;

  /* 设置排行榜列为 flex 容器，让内层壳可以在 2 格父容器中右对齐。 */
  display: flex;

  /* 设置内层排行榜壳贴向右侧，让榜单右边界继续对齐页面内容右边界。 */
  justify-content: flex-end;
}

/*
  作用容器: 热门电影排行榜内层壳 `.ranking-panel-shell`。
  样式作用:
  在 2 个格栅宽度的父容器内，把实际排行榜面板收窄到 1.6 个格栅。
  通过右对齐保留页面右侧边界一致性。
  把视觉收窄职责放在壳层，避免 HotRanking 组件知道首页布局细节。
*/
.ranking-panel-shell {
  /* 设置排行榜实际宽度为父容器 80%，即 2 格中的 1.6 格。 */
  width: 80%;

  /* 允许排行榜壳在父容器中收缩，避免长榜单内容撑破右侧区域。 */
  min-width: 0;

  /* 设置壳层高度填满右侧父容器，保证榜单底部仍和两行卡片对齐。 */
  height: 100%;

  /* 设置壳层为 flex，让 HotRanking 根节点自然填满壳层。 */
  display: flex;
}

/*
  作用容器: 热门电影单个卡片单元 `.card-cell`。
  样式作用:
  包裹单张 VideoCard。
  兜底限制长标题或角标不把当前栅格列撑宽。
*/
.card-cell {
  /* 允许单个电影卡片单元在栅格内收缩，保护四列布局宽度稳定。 */
  min-width: 0;
}

/*
  电影卡片分区空状态。
  对应 template 中 `{el-empty.section-empty}`，只在 movies 为空时显示。
*/
.section-empty {
  /* 保持和两行四列卡片区接近的高度，避免只有榜单时左侧塌陷。 */
  min-height: 330px;

  /* 使用通用面板背景，让空状态看起来仍是一个内容分区。 */
  background: var(--surface-soft);

  /* 用虚线边框表达“这里是可填充内容区”。 */
  border: 1px dashed var(--border-color);
}

/*
  响应式断点: max-width 900px。
  作用范围: 平板和窄屏桌面下的热门电影区块。
  样式作用:
  把左侧卡片和右侧排行榜改成上下堆叠。
  取消右侧排行榜额外呼吸间隙，避免移动端内容变窄。
*/
@media (max-width: 900px) {
  /*
    作用容器: 平板宽度下的热门电影主体 `.section-body`。
    样式作用:
    将双栏布局改为单列上下布局。
    保证电影卡片区和排行榜都能获得完整行宽。
  */
  .section-body {
    /* 设置热门电影主体为单列布局，让卡片区在上、排行榜在下。 */
    grid-template-columns: 1fr;

    /* 移除右侧呼吸间隙，避免排行榜在单列布局下被额外压窄。 */
    padding-right: 0;
  }

  /*
    作用容器: 平板宽度下的热门电影卡片网格 `.section-grid`。
    样式作用:
    让电影卡片区占满整行。
    把桌面四列卡片收为三列，保证卡片宽度可读。
  */
  .section-grid {
    /* 设置电影卡片区占满单列布局整行。 */
    grid-column: 1 / -1;

    /* 设置平板端电影卡片为三列，避免卡片过窄。 */
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  /*
    作用容器: 平板宽度下的热门电影排行榜列 `.section-aside`。
    样式作用:
    让排行榜排到电影卡片区下方并占满整行。
    恢复自动高度，避免移动端固定高度限制排行榜展示。
  */
  .section-aside {
    /* 设置电影排行榜列占满整行，跟随卡片区下方展示。 */
    grid-column: 1 / -1;

    /* 恢复排行榜列自动高度，让榜单内容在窄屏下自然展开。 */
    height: auto;

    /* 恢复普通块级布局，减少窄屏下不必要的 flex 高度约束。 */
    display: block;
  }

  /*
    作用容器: 平板宽度下的热门电影排行榜内层壳 `.ranking-panel-shell`。
    样式作用:
    单列布局下取消 1.5 格收窄。
    让排行榜在卡片区下方占满可用宽度。
  */
  .ranking-panel-shell {
    /* 设置窄屏下排行榜壳占满整行，避免右侧对齐逻辑造成无意义留白。 */
    width: 100%;
  }
}

/*
  响应式断点: max-width 640px。
  作用范围: 手机宽度下的热门电影区块。
  样式作用:
  收紧标题栏间距。
  降低更多入口字号。
  把电影卡片网格调整为两列。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机宽度下的热门电影标题栏 `.section-head`。
    样式作用:
    缩小标题和更多入口之间的基础间距。
    给窄屏标题保留更多可用宽度。
  */
  .section-head {
    /* 设置手机端标题栏间距更紧凑，避免更多入口挤出屏幕。 */
    gap: 12px;
  }

  /*
    作用容器: 手机宽度下的热门电影更多入口 `.section-more-link`。
    样式作用:
    降低右侧更多入口字号。
    给左侧热门电影标题让出更多空间。
  */
  .section-more-link {
    /* 设置手机端更多入口字号更小，降低标题栏横向压力。 */
    font-size: 13px;
  }

  /*
    作用容器: 手机宽度下的热门电影卡片网格 `.section-grid`。
    样式作用:
    把电影卡片改为两列布局。
    保证手机端卡片既不太窄，也不浪费横向空间。
  */
  .section-grid {
    /* 设置手机端电影卡片为两列布局。 */
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
