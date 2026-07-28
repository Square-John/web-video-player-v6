<template>
  <!--
    CatalogGrid 组件渲染树

    [DEFAULT] ele(section.catalog-grid-wrap)
    │  - condition:
    │      默认渲染。
    │      目录页、电视剧页和搜索页进入主体卡片区时展示。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      目录主体展示区。
    │      根据 items 是否有内容切换卡片网格或空状态。
    │  - params:
    │      -- items：父组件传入的当前页 ContentItem 列表。
    │      -- emptyDescription：空状态说明文案。
    │  - events: 无
    │
    ├─ [IF hasItems] ele(div.catalog-grid)
    │  - condition:
    │      items 数组存在内容时渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      视频卡片网格。
    │      使用全局响应式内容卡片列数承载 UserVideoCard 卡片。
    │  - params:
    │      -- items：用于 v-for 循环的当前页视频列表。
    │  - events: 无
    │
    └─ [ELSE] ele(el-empty.catalog-grid-empty)
       - condition:
           hasItems 不成立时渲染。
       - type:
           第三方组件
           组件库: Element UI
           组件名称: el-empty
       - description:
           主体空状态。
           保持目录主体区域高度，避免列表为空时页面塌陷。
       - params:
           -- emptyDescription：由 emptyTitle 和 emptyText 合成的说明文案。
       - events: 无
  -->
  <!--
    目录主体展示区。
    作用：展示目录页或搜索页的卡片列表，没数据时显示 Element UI 主体空状态。
  -->
  <section class="catalog-grid-wrap">
    <!-- items 有内容时渲染卡片网格。 -->
    <div v-if="hasItems" class="catalog-grid">
      <!--
        循环渲染视频卡片。
        外层 catalog-card-cell 负责把电影、电视剧、搜索页的卡片坑位固定到首页卡片同款宽度。
      -->
      <div
        v-for="item in items"
        :key="item.id || item.title"
        class="catalog-card-cell"
      >
        <!--
          UserVideoCard 负责给纯展示卡片注入收藏和播放状态。
          卡片宽度由全局 --content-card-grid-columns 决定，组件自身只负责填满所在列。
        -->
        <UserVideoCard
          :video="item"
        />
      </div>
    </div>

    <!-- items 为空时，展示主体区域空状态。 -->
    <el-empty
      v-else
      class="catalog-grid-empty"
      :description="emptyDescription" />
  </section>
</template>

<script>
/*
  CatalogGrid.vue 模块说明

  - 文件职责:
      渲染目录内容网格与无数据时的空状态。
      把父页面提供的 ContentItem 列表交给 UserVideoCard，不解释数据源业务。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      UserVideoCard: 自定义组件，渲染带用户收藏和播放状态的视频卡片。

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      CatalogGrid: Vue 业务组件，供目录和搜索类页面复用卡片网格。
*/

// 导入来源: ../common/UserVideoCard.vue。
// 导入内容: UserVideoCard 带用户状态的视频卡片容器。
// 文件作用: 用于给目录页、电视剧页和搜索页卡片统一注入收藏和播放状态。
import UserVideoCard from '../common/UserVideoCard.vue';

export default {
  // 组件名称用于在调试工具和报错信息中识别目录主体展示区。
  name: 'CatalogGrid',

  // 注册当前模板中使用的视频卡片组件。
  components: {
    // 组件: UserVideoCard 带用户状态的视频卡片容器。
    // 作用: 渲染目录主体区域中的单个视频条目，并接入收藏和播放状态。
    UserVideoCard
  },

  props: {
    // items 是主体卡片列表，会直接决定网格区渲染卡片还是空状态。
    items: {
      type: Array,
      required: true
    },

    // emptyTitle 是主体区空状态标题，方便不同页面复用同一个网格组件。
    emptyTitle: {
      type: String,
      default: '暂无可展示内容'
    },

    // emptyText 是主体区空状态说明，父组件可以根据页面语义传入不同文案。
    emptyText: {
      type: String,
      default: '当前列表没有数据。'
    }
  },

  computed: {
    /**
     * 主体区是否有内容卡片可以渲染。
     *
     * @returns {boolean} 有卡片数据时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasItems() {
      return this.items.length > 0;
    },

    /**
     * Element UI 空状态说明文案。
     *
     * @returns {string} 合并后的空状态标题和说明。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    emptyDescription() {
      // el-empty 只有 description 一个主文案入口，这里把标题和说明合成一句。
      return `${this.emptyTitle}，${this.emptyText}`;
    }
  }
};
</script>

<style scoped>
/*
  作用容器: `.catalog-grid-wrap`。
  样式作用:
  目录主体展示区外层容器。
  对应 template 中的 `.catalog-grid-wrap`，位于筛选栏和分页之间。
*/
.catalog-grid-wrap {
  /* 控制主体区和分页之间的距离。 */
  margin-bottom: 26px;
}

/*
  作用容器: `.catalog-grid`。
  样式作用:
  视频卡片网格。
  对应 template 中的 `.catalog-grid`，内部循环渲染多个 UserVideoCard。
*/
.catalog-grid {
  /* 使用 CSS Grid 管理视频卡片列表。 */
  display: grid;

  /*
    使用全局响应式内容卡片列数。
    theme.css 按 6 / 4 / 3 / 2 列统一切换，目录组件不再维护重复断点。
  */
  grid-template-columns: repeat(var(--content-card-grid-columns), minmax(0, 1fr));

  /* 控制卡片之间的横向和纵向间距，使用全站页面栅格统一间距。 */
  gap: var(--page-grid-gap);

  /* 卡片顶部对齐，避免内容高度不同导致同一行错位。 */
  align-items: start;
}

/*
  作用容器: `.catalog-card-cell`。
  样式作用:
  目录页单张卡片外层单元格。
  对应 template 中 `.catalog-card-cell`，内部包着一个 UserVideoCard。
  作用是让电影、电视剧、搜索页的每个卡片都安放在当前响应式栅格的一个列位里。
*/
.catalog-card-cell {
  /* 允许内部标题、角标等长内容被省略，而不是撑开当前栅格列。 */
  min-width: 0;
}

/*
  作用容器: `.catalog-grid-empty`。
  样式作用:
  主体区空状态。
  对应 template 中的 `.catalog-grid-empty`，在 items 为空时显示。
*/
.catalog-grid-empty {
  /* 主体区空状态需要比普通卡片更高，避免页面中间区域塌陷。 */
  min-height: 360px;

  /* 使用虚线边框提示这里是主体内容占位。 */
  border: 1px dashed var(--border-strong);

  /* 当前项目卡片风格偏直角，目录空状态也保持直角。 */
  border-radius: 0;

  /* 使用半透明白色背景，和 theme-surface 风格保持一致。 */
  background: rgba(255, 255, 255, 0.58);
}

</style>
