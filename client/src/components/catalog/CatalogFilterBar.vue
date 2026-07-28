<template>
  <!--
    CatalogFilterBar 组件渲染树

    [DEFAULT] ele(section.catalog-filter.theme-surface)
    │  - condition:
    │      默认渲染。
    │      目录页需要在标题区下方展示动态筛选入口时挂载当前筛选栏组件。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      目录筛选栏根容器。
    │      承载筛选标题、重置按钮和按组分类的动态筛选项列表。
    │  - params:
    │      -- title：筛选栏标题。
    │      -- hint：筛选栏说明文案。
    │      -- filters：父页面传入的动态筛选组数组。
    │  - events: 无
    │
    ├─ [DEFAULT] ele(div.catalog-filter-head)
    │  - condition:
    │      默认渲染。
    │      筛选栏头部始终显示标题说明和重置入口。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      筛选栏头部。
    │      左侧展示标题和说明，右侧展示重置筛选按钮。
    │  - params: 无
    │  - events: 无
    │
    ├─ [DEFAULT] ele(div.catalog-filter-body)
    │  - condition:
    │      默认渲染。
    │      filters 有数据时循环渲染所有筛选组；为空时 body 保持空结构。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      筛选内容区。
    │      负责把数据源返回的筛选元数据按组渲染成筛选按钮。
    │  - params:
    │      -- filters：当前页面筛选组数组。
    │  - events: 无
  -->
  <!--
    目录筛选栏。
    作用：展示目录页顶部的筛选入口，使用分组面板组织筛选条件。
  -->
  <section class="catalog-filter theme-surface">
    <!--
      筛选面板头部。
      渲染位置：筛选面板顶部。
      页面作用：显示筛选标题和重置按钮占位，保持筛选区的操作层级清晰。
    -->
    <div class="catalog-filter-head">
      <div class="catalog-filter-heading">
        <h2 class="catalog-filter-title">{{ title }}</h2>
        <span class="catalog-filter-subtitle">{{ hint }}</span>
      </div>

      <!--
        [DEFAULT] ele(el-button.catalog-filter-reset)
        - condition:
            默认渲染。
            当前筛选栏始终展示重置筛选入口；没有已选筛选条件时按钮禁用。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            重置筛选按钮。
            用户点击后向父页面派发 reset-filters 事件，由父页面恢复默认筛选状态。
        - params:
            -- resetDisabled：父页面传入的重置禁用状态。
        - events:
            @click
                - description:
                    用户点击重置筛选按钮时触发。
                    disabled 为 true 时 Element UI 会阻止点击。
                - methods:
                    handleResetFilters()
                        -- 无参数：组件内部只派发 reset-filters 事件。
      -->
      <el-button
        class="catalog-filter-reset"
        size="mini"
        plain
        :disabled="resetDisabled"
        @click="handleResetFilters">
        重置筛选
      </el-button>
    </div>

    <!--
      筛选内容区。
      渲染位置：筛选面板头部下方。
      使用数据：filters 中的每一组筛选项。
    -->
    <div class="catalog-filter-body">
      <!-- 单行筛选项，左侧是筛选维度，右侧是该维度的可选项。 -->
      <div v-for="group in filters" :key="group.name || group.label" class="filter-row">
        <div class="filter-label">{{ group.label }}</div>

        <!-- 筛选项容器，选项过多时自动换行。 -->
        <div class="filter-options">
          <!--
            [DEFAULT] ele(el-button.filter-chip)
            - condition:
                默认渲染。
                当前筛选组中的每个筛选项都会生成一个筛选按钮。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-button
            - description:
                单个筛选项按钮。
                根据 option.active 高亮当前已选项，点击后把筛选组名和值抛给父页面。
            - params:
                -- group.name：当前筛选组唯一标识。
                -- option.label：筛选项展示文案。
                -- option.value：筛选项值。
                -- option.active：筛选项当前激活状态。
            - events:
                @click
                    - description:
                        用户点击筛选项按钮时触发。
                        已激活项再次点击时不重复派发筛选变化事件。
                    - methods:
                        handleSelectOption(group.name, option)
                            -- group.name：当前筛选组机器名。
                            -- option：当前筛选项对象。
          -->
          <el-button
            v-for="option in group.options"
            :key="option.value"
            size="mini"
            native-type="button"
            class="filter-chip"
            :class="{ active: option.active }"
            :plain="!option.active"
            @click="handleSelectOption(group.name, option)"
          >
            {{ option.label }}
          </el-button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
/*
  CatalogFilterBar.vue 模块说明

  - 文件职责:
      渲染目录页分组筛选条件和重置入口。
      只接收父页面整理的筛选结构并发布选择事件，不请求或保存目录数据。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      CatalogFilterBar: Vue 业务组件，供电影页和电视剧页复用筛选交互。
*/

export default {
  // 组件名称用于在调试工具和报错信息中识别目录筛选栏。
  name: 'CatalogFilterBar',

  props: {
    // title 渲染在筛选面板头部左侧。
    // 页面影响：让同一个筛选组件可用于电影、电视剧等目录页面。
    title: {
      type: String,
      default: '目录筛选'
    },

    // hint 渲染在标题旁边，说明当前筛选区的用途。
    hint: {
      type: String,
      default: ''
    },

    // filters 由目录页传入，用来驱动筛选组和筛选按钮渲染。
    filters: {
      type: Array,
      required: true
    },

    // resetDisabled 控制重置按钮是否禁用。
    // true: 当前没有已选筛选条件，重置按钮禁用。
    // false: 当前存在非默认筛选条件，允许触发重置事件。
    resetDisabled: {
      type: Boolean,
      default: false
    }
  },

  methods: {
    /**
     * 处理筛选项点击。
     * 副作用: 向父页面派发 change-filter 事件。
     *
     * @param {string} groupName 当前筛选组机器名。
     * @param {object} option 当前筛选项对象。
     * @returns {void} 该方法只派发组件事件，不直接修改父页面筛选状态。
     */
    handleSelectOption(groupName, option) {
      // 类型: object。
      // 作用: option 不是对象时使用空对象兜底，避免读取字段时报错。
      const safeOption = option && typeof option === 'object' ? option : {};

      // 条件分支: 筛选组名缺失时进入。
      // 执行内容: 直接退出，避免派发无法被父页面识别的筛选事件。
      if (!groupName) {
        return;
      }

      // 条件分支: 当前筛选项已经是激活态时进入。
      // 执行内容: 不重复派发事件，避免父页面发起无意义的重复请求。
      if (safeOption.active) {
        return;
      }

      // 事件: change-filter。
      // 参数: object，包含筛选组名和筛选项值，父页面据此更新筛选状态并重新请求内容。
      this.$emit('change-filter', {
        groupName,
        optionValue: safeOption.value
      });
    },

    /**
     * 处理重置筛选点击。
     * 副作用: 向父页面派发 reset-filters 事件。
     *
     * @returns {void} 该方法只派发组件事件，不直接修改父页面筛选状态。
     */
    handleResetFilters() {
      // 条件分支: 当前重置按钮禁用时进入。
      // 执行内容: 直接退出，避免重复派发重置事件。
      if (this.resetDisabled) {
        return;
      }

      // 事件: reset-filters。
      // 作用: 通知父页面恢复默认筛选状态，并重新请求第一页内容。
      this.$emit('reset-filters');
    }
  }
};
</script>

<style scoped>
/*
  作用容器: `.catalog-filter`。
  样式作用:
  目录筛选栏整体容器。
  对应 template 中的 `.catalog-filter.theme-surface`，位于目录页标题区下方。
*/
.catalog-filter {
  /* 给筛选栏内部留出空间，避免内容贴边。 */
  padding: 22px 24px 24px;

  /* 控制筛选栏和下方主体内容之间的距离。 */
  margin-bottom: 24px;
}

/*
  作用容器: `.catalog-filter-head`。
  样式作用:
  筛选栏头部。
  对应 template 中的 `.catalog-filter-head`，展示标题、说明和重置按钮。
*/
.catalog-filter-head {
  /* 使用 flex 让标题组合在左，重置按钮在右。 */
  display: flex;

  /* 标题区和按钮区左右分布。 */
  justify-content: space-between;

  /* 标题和按钮底部对齐，视觉更稳定。 */
  align-items: flex-end;

  /* 窄屏换行前保留缓冲。 */
  gap: 16px;

  /* 和具体筛选行之间留出分隔距离。 */
  padding-bottom: 16px;

  /* 用细线分隔筛选标题区和筛选项。 */
  border-bottom: 1px solid var(--border-color);

  /* 控制头部和筛选内容之间的距离。 */
  margin-bottom: 18px;
}

/*
  作用容器: `.catalog-filter-heading`。
  样式作用:
  筛选标题组合。
  对应 template 中的 `.catalog-filter-heading`。
*/
.catalog-filter-heading {
  /* 主标题和副标题横向排列。 */
  display: flex;

  /* 使用 baseline 让不同字号文字基线对齐。 */
  align-items: baseline;

  /* 主标题和说明之间留出距离。 */
  gap: 12px;
}

/*
  作用容器: `.catalog-filter-title`。
  样式作用:
  筛选栏标题。
  对应 template 中的 `.catalog-filter-title`。
*/
.catalog-filter-title {
  /* 固定主标题的自然宽度，避免较长辅助说明在手机端反向挤压标题并触发中文换行。 */
  flex: 0 0 auto;

  /* 保持“电影筛选”和“电视剧筛选”为单行完整标题，稳定筛选区主信息层级。 */
  white-space: nowrap;

  /* 清除标题元素默认外边距，避免标题自然宽度之外产生不可控占位。 */
  margin: 0;

  /* 给标题左侧强调线和文字之间保留稳定间距，维持筛选区视觉层级。 */
  padding-left: 14px;

  /* 使用主题色左边线标识筛选区主标题，帮助用户快速定位筛选入口。 */
  border-left: 4px solid var(--accent);

  /* 设置主标题字号高于辅助说明，保持标题与说明之间的信息层级。 */
  font-size: 20px;

  /* 使用较高字重强化筛选区标题，同时不依赖增大宽度解决可读性。 */
  font-weight: 700;

  /* 使用主文字色保证筛选标题在浅色面板上清晰可读。 */
  color: var(--text-primary);
}

/*
  作用容器: `.catalog-filter-subtitle`。
  样式作用:
  筛选栏说明。
  对应 template 中的 `.catalog-filter-subtitle`。
*/
.catalog-filter-subtitle {
  /* 允许辅助说明容器缩小到可用剩余宽度，由说明文字承担必要的自然换行。 */
  min-width: 0;

  /* 使用小一档字号区分辅助说明与主标题，降低说明换行后的视觉重量。 */
  font-size: 13px;

  /* 使用弱化文字色表达辅助信息，避免与固定自然宽度的主标题争夺层级。 */
  color: var(--text-muted);
}

/*
  作用容器: `.catalog-filter-reset`。
  样式作用:
  重置筛选按钮。
  对应 template 中的 `.catalog-filter-reset`。
*/
.catalog-filter-reset {
  /* 不让按钮被标题挤压变形。 */
  flex: 0 0 auto;
}

/*
  作用容器: `.catalog-filter-body`。
  样式作用:
  筛选内容区。
  对应 template 中的 `.catalog-filter-body`。
*/
.catalog-filter-body {
  /* 筛选内容区不额外加背景，背景由 theme-surface 提供。 */
  background: transparent;
}

/*
  作用容器: `.filter-row`。
  样式作用:
  单行筛选项。
  对应 template 中的 `.filter-row`。
*/
.filter-row {
  /* 使用 Grid 对齐筛选标签列和选项列，保持各筛选组起点一致。 */
  display: grid;
  /* 固定标签列宽度并让选项列占据剩余空间，避免长选项挤压标签。 */
  grid-template-columns: 56px minmax(0, 1fr);
  /* 设置标签与选项之间的横向距离，保持两列信息边界清晰。 */
  gap: 14px;
  /* 让筛选标签从选项首行顶部开始对齐，多行选项不会改变标签位置。 */
  align-items: start;
  /* 分隔相邻筛选组，避免连续按钮组难以辨认。 */
  margin-bottom: 18px;
}

/*
  作用容器: `.filter-row:last-child`。
  样式作用:
  最后一行筛选项底部不再额外留白。
*/
.filter-row:last-child {
  /* 移除最后一个筛选组的底部间距，避免面板末尾产生额外空白。 */
  margin-bottom: 0;
}

/*
  作用容器: `.filter-label`。
  样式作用:
  筛选组名称。
  对应 template 中的 `.filter-label`。
*/
.filter-label {
  /* 微调筛选标签顶部位置，使文字基线与第一行按钮视觉对齐。 */
  padding-top: 6px;
  /* 保持筛选标签可读，同时弱于筛选选项文字层级。 */
  font-size: 14px;
  /* 增加标签行高，让中文标签在窄屏换行时仍易于阅读。 */
  line-height: 1.6;
  /* 使用次要文字色降低标签视觉重量，突出可点击筛选项。 */
  color: var(--text-muted);
}

/*
  作用容器: `.filter-options`。
  样式作用:
  筛选按钮容器。
  对应 template 中的 `.filter-options`。
*/
.filter-options {
  /* 使用 Flex 横向排列筛选按钮，允许按钮按可用宽度流动。 */
  display: flex;
  /* 允许筛选按钮换行，避免窄容器裁切后续选项。 */
  flex-wrap: wrap;
  /* 同时控制筛选按钮横向和纵向间距，保持多行按钮密度一致。 */
  gap: 10px 12px;
}

/*
  作用容器: `.filter-chip`。
  样式作用:
  单个筛选按钮。
  对应 template 中的 `.filter-chip`。
*/
.filter-chip {
  /* 给筛选按钮使用轻量圆角，和目录面板中的紧凑控件保持一致。 */
  border-radius: 12px;
  /* 控制筛选按钮文字尺寸，兼顾密度和中文可读性。 */
  font-size: 14px;
  /* 收紧单行按钮文字行高，避免按钮高度被字体默认行高撑大。 */
  line-height: 1;
  /* 建立稳定点击面积，并给不同长度选项保留水平留白。 */
  padding: 8px 14px;
  /* 用轻阴影从面板背景中分离筛选按钮，但不抢占内容卡片层级。 */
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
  /* 平滑过渡文字、边框、背景和位移变化，避免状态切换突兀。 */
  transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

/*
  作用容器: `.filter-chip.active`。
  样式作用:
  当前选中的筛选按钮。
  对应 template 中的 `.filter-chip.active`，由 option.active 控制。
*/
.filter-chip.active {
  /* 让激活筛选项在强调背景上保持足够文字对比度。 */
  color: #ffffff;
  /* 使用强调色渐变标识当前已应用的筛选条件。 */
  background: linear-gradient(135deg, #5b8cff 0%, #6b95ff 100%);
  /* 让激活按钮边框与背景主色一致，避免出现默认边框杂色。 */
  border-color: #5b8cff;
  /* 增强激活筛选项阴影，使当前条件在同组按钮中更易识别。 */
  box-shadow: 0 10px 18px rgba(91, 140, 255, 0.16);
}

/*
  作用容器: `.filter-chip:not(.active):hover`。
  样式作用:
  鼠标悬停未选中筛选项时，使用轻微蓝色反馈。
*/
.filter-chip:not(.active):hover {
  /* 悬停未激活按钮时使用强调文字色，提示该选项可以点击。 */
  color: var(--accent);
  /* 提高未激活按钮悬停边框辨识度，形成明确交互反馈。 */
  border-color: rgba(91, 140, 255, 0.34);
  /* 给悬停按钮增加浅色背景，不与激活状态的实色背景混淆。 */
  background: rgba(91, 140, 255, 0.06);
  /* 悬停时轻微上移按钮，强化可点击反馈且不改变文档流尺寸。 */
  transform: translateY(-1px);
}

/*
  响应式断点: (max-width: 900px)。
  作用范围: 当前样式块内在该媒体条件下命中的页面或组件元素。
  样式作用:
  平板宽度下筛选行改成单列。
  触发条件：屏幕宽度不超过 900px。
*/
@media (max-width: 900px) {
  /*
    作用容器: `.filter-row`。
    样式作用:
    在 `(max-width: 900px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .filter-row {
    /* 手机视口改为单列筛选组，让标签位于选项上方并释放按钮宽度。 */
    grid-template-columns: 1fr;
    /* 缩小手机端标签与选项间距，减少筛选区域纵向占用。 */
    gap: 10px;
  }

  /*
    作用容器: `.filter-label`。
    样式作用:
    在 `(max-width: 900px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .filter-label {
    /* 移除手机端标签顶部偏移，使标签在单列布局中自然对齐。 */
    padding-top: 0;
  }
}

/*
  响应式断点: (max-width: 640px)。
  作用范围: 当前样式块内在该媒体条件下命中的页面或组件元素。
  样式作用:
  手机宽度下筛选头部改成上下排列。
  触发条件：屏幕宽度不超过 640px。
*/
@media (max-width: 640px) {
  /*
    作用容器: `.catalog-filter`。
    样式作用:
    在 `(max-width: 640px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .catalog-filter {
    /* 收紧手机端筛选面板内边距，为筛选按钮保留更多横向空间。 */
    padding: 20px 18px 22px;
  }

  /*
    作用容器: `.catalog-filter-head`。
    样式作用:
    在 `(max-width: 640px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .catalog-filter-head {
    /* 手机端让筛选头部从顶部对齐，适应标题与操作换行。 */
    align-items: flex-start;
    /* 手机端将筛选标题和操作区纵向排列，避免横向空间不足。 */
    flex-direction: column;
  }
}
</style>
