<!--
  AppNavbarItem.vue 组件说明

  [ROOT] ele(div.app-navbar-item)
  - condition:
      AppNavbar 传入一个固定导航项或动态上下文项时渲染。
  - type:
      原生 div，组合导航命令与可选关闭命令。
  - description:
      为桌面导航、移动第二行和移动抽屉提供同一视觉标签与交互语义。
      动态关闭按钮保持独立命令，但绝对定位在标签内部右侧，不形成独立全高区域。
  - params:
      -- item：标准导航展示项。
      -- activePage：当前一级路由身份。
      -- scrollOnOverflow：是否允许当前标签在真实溢出时滚动。
      -- stacked：是否位于纵向抽屉，用于把同一组边界从竖线切换为横线。
  - events:
      -- navigate：点击标签主区域时携带 item 发出。
      -- close：点击动态关闭图标时携带 item 发出。

  [ROOT]
  ├─ [DEFAULT] ele(button.app-navbar-item__main)
  │  - description: 导航到当前项目标地址，承载唯一文字视口。
  │  - events: @click -> emitNavigation()。
  │  └─ [DEFAULT] ele(span.app-navbar-item__label-viewport)
  │     └─ [DEFAULT] ele(span.app-navbar-item__label-track)
  │        - condition: 只有真实溢出时增加滚动类。
  └─ [IF item.isContext] ele(button.app-navbar-item__close)
     - description: 关闭当前动态上下文，不触发主导航命令。
     - events: @click.stop -> emitClose()。
-->
<template>
  <div
    class="app-navbar-item"
    :class="{
      'app-navbar-item--active': isActive,
      'app-navbar-item--context': item.isContext,
      'app-navbar-item--player': scrollOnOverflow,
      'app-navbar-item--group-start': item.startsGroup,
      'app-navbar-item--stacked': stacked
    }"
  >
    <button
      type="button"
      class="app-navbar-item__main"
      :aria-current="isActive ? 'page' : null"
      @click="emitNavigation"
    >
      <span ref="labelViewport" class="app-navbar-item__label-viewport">
        <span
          ref="labelTrack"
          class="app-navbar-item__label-track"
          :class="{ 'app-navbar-item__label-track--overflowing': isLabelOverflowing }"
          :style="labelTrackStyle"
        >{{ item.label }}</span>
      </span>
    </button>

    <button
      v-if="item.isContext"
      type="button"
      class="app-navbar-item__close"
      :aria-label="`关闭${item.label}`"
      @click.stop="emitClose"
    >
      <i class="el-icon-close app-navbar-item__close-icon" aria-hidden="true"></i>
    </button>
  </div>
</template>

<script>
/*
  AppNavbarItem.vue 模块说明

  - 文件职责:
      渲染统一导航标签，保持导航与关闭命令语义独立但视觉一体。
      通过真实 DOM 宽度判断播放标题是否溢出，只在需要时发布滚动距离和动画状态。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      AppNavbarItem Vue 组件，供 AppNavbar 的桌面和移动导航列表共同复用。
*/

export default {
  // 组件名称: 用于 Vue 调试工具和错误堆栈定位统一导航标签。
  name: 'AppNavbarItem',

  props: {
    // 类型: object；必填: 是；作用: 提供 key、label、navRouteName、routeLocation 和 isContext 等标准导航字段。
    item: {
      type: Object,
      required: true
    },

    // 类型: string；必填: 是；作用: 与 item.navRouteName 比较并表达当前页面高亮状态。
    activePage: {
      type: String,
      required: true
    },

    // 类型: boolean；默认值: false；true 允许真实溢出标题滚动，false 保持静态单行；当前仅播放标签传 true。
    scrollOnOverflow: {
      type: Boolean,
      default: false
    },

    // 类型: boolean；默认值: false；true 表示抽屉纵向排列，组边界改用横向分隔；false 使用横向导航竖线。
    stacked: {
      type: Boolean,
      default: false
    }
  },

  /**
   * 创建当前导航项的局部溢出测量状态。
   * 副作用: 无；每个组件实例获得独立状态对象。
   *
   * @returns {object} 初始静止状态和零像素溢出距离。
   */
  data() {
    return {
      // 类型: boolean；作用: 标识标题完整宽度是否大于当前文字视口，只有 true 才挂载滚动动画。
      isLabelOverflowing: false,
      // 类型: number；单位: CSS px；作用: 保存标题超出视口的准确距离，动画只移动这段差值。
      labelOverflowDistance: 0
    };
  },

  computed: {
    /**
     * 判断当前导航项是否为活动页面。
     * 纯函数: 只比较标准路由身份，不修改标签状态。
     *
     * @returns {boolean} true 表示当前项应高亮，false 表示普通状态。
     */
    isActive() {
      return this.item.navRouteName === this.activePage;
    },

    /**
     * 生成标题滚动距离样式变量。
     * 纯函数: 只读取已经测量的像素差并返回新对象，不直接写 DOM。
     *
     * @returns {object} 供 CSS 动画读取的自定义属性对象。
     */
    labelTrackStyle() {
      return {
        '--app-navbar-title-overflow-distance': `${this.labelOverflowDistance}px`
      };
    }
  },

  watch: {
    /**
     * 响应导航标题变化。
     * 副作用: 在当前 Vue DOM 提交后重新测量文字，不沿用旧标题距离。
     * 失败路径: 组件销毁或测量节点缺失时由统一测量函数归零。
     *
     * @returns {void} 测量结果异步写入局部响应式状态。
     */
    'item.label'() {
      this.scheduleLabelMeasurement();
    },

    /**
     * 响应条件滚动开关变化。
     * 副作用: 在当前 Vue DOM 提交后重新采用静止或真实溢出状态。
     * 失败路径: 开关关闭或测量节点缺失时由统一测量函数清除旧动画状态。
     *
     * @returns {void} 测量结果异步写入局部响应式状态。
     */
    scrollOnOverflow() {
      this.scheduleLabelMeasurement();
    }
  },

  /**
   * Vue mounted 生命周期。
   * 副作用: 初次测量文字并在浏览器支持时订阅文字视口尺寸变化。
   * 成功路径: 播放标签随容器尺寸变化更新溢出状态，普通标签保持静止。
   * 失败路径: ResizeObserver 不可用时保留初次测量，不注册轮询或全局监听兜底。
   *
   * @returns {void} 订阅引用保存在组件实例私有字段中。
   */
  mounted() {
    this.scheduleLabelMeasurement();
    // 条件分支: 浏览器提供标准 ResizeObserver 且存在文字视口时进入。
    // 执行内容: 订阅当前局部元素尺寸，不建立窗口级监听或固定等待。
    if (typeof ResizeObserver === 'function' && this.$refs.labelViewport) {
      // 类型: ResizeObserver；作用: 容器宽度变化后重新计算真实标题溢出距离。
      this._labelResizeObserver = new ResizeObserver(() => {
        this.measureLabelOverflow();
      });
      this._labelResizeObserver.observe(this.$refs.labelViewport);
    }
  },

  /**
   * Vue beforeDestroy 生命周期。
   * 副作用: 释放局部 ResizeObserver，避免导航项销毁后继续持有 DOM 和组件实例。
   *
   * @returns {void} 清理完成后不保留外部监听。
   */
  beforeDestroy() {
    this._labelResizeObserver?.disconnect();
    this._labelResizeObserver = null;
  },

  methods: {
    /**
     * 在当前 Vue DOM 更新完成后测量标题。
     * 副作用: 向当前组件微任务队列登记一次 nextTick 回调，不创建计时器。
     * 成功路径: 新标题和新宽度已经提交后调用唯一测量函数。
     * 失败路径: 组件在回调前销毁时 Vue 不再执行无效实例更新。
     *
     * @returns {void} 测量结果由组件响应式状态表达。
     */
    scheduleLabelMeasurement() {
      this.$nextTick(() => {
        this.measureLabelOverflow();
      });
    },

    /**
     * 测量标题是否真实溢出当前文字视口。
     * 副作用: 更新当前组件的 isLabelOverflowing 和 labelOverflowDistance；不修改元素内联尺寸。
     * 成功路径: 仅 scrollOnOverflow 为 true 且完整文字更宽时发布准确差值。
     * 失败路径: 普通标签、缺失 DOM 或未溢出时统一归零并保持静止。
     *
     * @returns {void} 当前测量结果写入响应式状态。
     */
    measureLabelOverflow() {
      // 类型: HTMLElement|undefined；作用: 读取允许裁切的文字可视区域。
      const viewport = this.$refs.labelViewport;
      // 类型: HTMLElement|undefined；作用: 读取完整单行文字的实际宽度。
      const track = this.$refs.labelTrack;
      // 条件分支: 当前标签不允许滚动或任一测量节点缺失时进入。
      // 执行内容: 清除旧滚动状态，避免复用组件时短标签继续动画。
      if (!this.scrollOnOverflow || !viewport || !track) {
        this.isLabelOverflowing = false;
        this.labelOverflowDistance = 0;
        return;
      }

      // 类型: number；单位: CSS px；作用: 计算完整文字超出可视区域的真实距离，小于等于零表示无需滚动。
      const overflowDistance = Math.ceil(track.scrollWidth - viewport.clientWidth);
      // 类型: boolean；作用: 只有正差值表示存在真实横向溢出。
      const isOverflowing = overflowDistance > 0;
      this.isLabelOverflowing = isOverflowing;
      this.labelOverflowDistance = isOverflowing ? overflowDistance : 0;
    },

    /**
     * 发布导航命令。
     * 副作用: 向父组件发送当前 item；不直接调用 Router 或关闭抽屉。
     *
     * @returns {void} 父组件接管实际导航流程。
     */
    emitNavigation() {
      this.$emit('navigate', this.item);
    },

    /**
     * 发布动态上下文关闭命令。
     * 副作用: 向父组件发送当前 item；模板 stop 已阻止事件冒泡到导航按钮。
     *
     * @returns {void} 父组件接管播放关闭或普通上下文清理。
     */
    emitClose() {
      this.$emit('close', this.item);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 单个统一导航标签根节点。
  样式作用: 让导航主命令与关闭图标共享一个连续视觉表面。
*/
.app-navbar-item {
  /* 为内部关闭图标建立定位上下文。 */
  position: relative;
  /* 每个入口作为导航行内稳定项目。 */
  display: inline-flex;
  /* 移动第二行使用共享行高，抽屉和桌面由父级布局覆盖根高度。 */
  height: var(--app-navbar-secondary-row-height);
  /* 防止长标题突破父级可用宽度。 */
  min-width: 0;
  /* 导航项目按自身内容宽度排列。 */
  flex: 0 0 auto;
  /* 使用克制圆角表达一个标签。 */
  border-radius: 5px;
  /* 主按钮背景和关闭图标保持在同一轮廓内。 */
  overflow: hidden;
  /* 把可选组边界和内边距纳入导航项稳定尺寸。 */
  box-sizing: border-box;
}

/*
  作用容器: 横向导航中新分组首项 `.app-navbar-item--group-start`。
  样式作用: 由展示模型标注固定入口与可关闭上下文的真实边界，不依赖项目固定位置或 DOM 结构猜测。
*/
.app-navbar-item--group-start {
  /* 与前一组保持可扫描间距，分隔线不会贴住相邻文字。 */
  margin-left: 8px;
  /* 在当前项左侧保留分隔线后的呼吸空间。 */
  padding-left: 8px;
  /* 使用克制竖线区分固定入口和可关闭上下文。 */
  border-left: 1px solid rgba(255, 255, 255, 0.18);
}

/*
  作用容器: 抽屉纵向排列中新分组首项。
  样式作用: 把同一 startsGroup 元数据转换为横向分隔，不建立第二套抽屉分组数组。
*/
.app-navbar-item--stacked.app-navbar-item--group-start {
  /* 纵向列表不保留横向导航的左侧外间距。 */
  margin-left: 0;
  /* 用顶部间距把横向分隔线和上一组项目分开。 */
  margin-top: 10px;
  /* 纵向列表不需要为左侧竖线保留空间。 */
  padding-left: 0;
  /* 清除横向模式的竖线。 */
  border-left: 0;
  /* 抽屉使用横向分隔线表达可关闭与固定导航两组。 */
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}

/*
  作用容器: 当前活动导航标签。
  样式作用: 用同一连续背景覆盖文字和右侧关闭图标区域。
*/
.app-navbar-item--active {
  /* 使用深浅差异强化当前页面状态。 */
  background: rgba(0, 0, 0, 0.22);
}

/*
  作用容器: 固定宽度播放导航标签。
  样式作用: 标题变化不推动后续桌面入口，宽度来自父导航命名令牌。
*/
.app-navbar-item--player {
  /* 使用唯一布局令牌控制播放标签宽度。 */
  width: var(--app-navbar-player-item-width);
}

/*
  作用容器: 导航主命令。
  样式作用: 承担完整标签点击面积和文字可视区域，动态项为内部关闭图标预留空间。
*/
.app-navbar-item__main {
  /* 填满当前标签可用宽度。 */
  width: 100%;
  /* 填满当前标签行高，桌面和移动不产生短胶囊。 */
  height: 100%;
  /* 允许固定项目按文字自然占宽。 */
  min-width: 0;
  /* 清除原生边框。 */
  border: 0;
  /* 默认不增加第二层表面。 */
  background: transparent;
  /* 提供导航行的稳定点击面积。 */
  padding: 10px 12px;
  /* 使用浅色导航文字。 */
  color: #dbe4ef;
  /* 使用紧凑导航字号。 */
  font-size: 15px;
  /* 使用中等字重提高扫描效率。 */
  font-weight: 600;
  /* 继承项目字体。 */
  font-family: inherit;
  /* 导航标签保持单行。 */
  white-space: nowrap;
  /* 移动抽屉按阅读起点对齐。 */
  text-align: left;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
  /* 只过渡颜色和背景，不改变尺寸。 */
  transition: color 0.18s ease, background-color 0.18s ease;
}

/*
  作用容器: 动态导航主命令。
  样式作用: 在同一标签内部为右侧关闭图标保留命中空间。
*/
.app-navbar-item--context .app-navbar-item__main {
  /* 关闭图标绝对定位在右侧，该内边距防止文字被遮挡。 */
  padding-right: var(--app-navbar-context-close-space);
}

/*
  作用容器: 导航主命令悬停状态。
  样式作用: 轻量提高当前标签表面对比度。
*/
.app-navbar-item__main:hover {
  /* 提高悬停文字亮度。 */
  color: #ffffff;
  /* 使用半透明背景表达命令可点击。 */
  background: rgba(255, 255, 255, 0.08);
}

/*
  作用容器: 活动导航主命令。
  样式作用: 使用暖色文字与统一根背景共同表达当前页面。
*/
.app-navbar-item--active .app-navbar-item__main {
  /* 使用暖色强调当前入口。 */
  color: #f3c45d;
}

/*
  作用容器: 导航主命令键盘焦点。
  样式作用: 提供不依赖鼠标和颜色的明确位置反馈。
*/
.app-navbar-item__main:focus-visible {
  /* 使用主题强调色绘制可见轮廓。 */
  outline: 2px solid var(--accent);
  /* 把焦点轮廓收在当前标签附近。 */
  outline-offset: -2px;
}

/*
  作用容器: 标题可视区域。
  样式作用: 裁切完整标题轨道，只让真实溢出部分参与滚动。
*/
.app-navbar-item__label-viewport {
  /* 作为可测量块级视口。 */
  display: block;
  /* 允许父按钮压缩到剩余空间。 */
  min-width: 0;
  /* 防止轨道超出标签视觉边界。 */
  overflow: hidden;
}

/*
  作用容器: 标题完整文字轨道。
  样式作用: 保留单行自然宽度，为溢出测量提供真实 scrollWidth。
*/
.app-navbar-item__label-track {
  /* 使用行内块参与 transform 动画。 */
  display: inline-block;
  /* 完整宽度由标题文字决定。 */
  width: max-content;
  /* 标题保持单行。 */
  white-space: nowrap;
}

/*
  作用容器: 真实溢出的播放标题轨道。
  样式作用: 只移动测量得到的差值，短标题不会获得该类。
*/
.app-navbar-item__label-track--overflowing {
  /* 使用父导航令牌控制滚动节奏，并在起止位置间往返。 */
  animation: app-navbar-item-title-scroll var(--app-navbar-title-scroll-duration) ease-in-out infinite alternate;
}

/*
  作用容器: 动态上下文关闭图标。
  样式作用: 保持独立命令语义，但视觉上位于同一标签内部右侧且不形成全高分区。
*/
.app-navbar-item__close {
  /* 在同一标签内覆盖右侧命中区域。 */
  position: absolute;
  /* 与标签右侧保持紧凑间距。 */
  right: 4px;
  /* 放到标签垂直中心。 */
  top: 50%;
  /* 使用图标命令的稳定方形命中宽度。 */
  width: var(--app-navbar-context-close-size);
  /* 使用图标命令的稳定方形命中高度。 */
  height: var(--app-navbar-context-close-size);
  /* 使用 Flex 对齐图标字形，不依赖图标字体基线。 */
  display: inline-flex;
  /* 让关闭图标在命中区内水平居中。 */
  justify-content: center;
  /* 让关闭图标在命中区内垂直居中。 */
  align-items: center;
  /* 清除按钮内部默认间距，命中区由稳定宽高负责。 */
  padding: 0;
  /* 精确校正垂直中心。 */
  transform: translateY(-50%);
  /* 清除原生边框，避免形成独立容器轮廓。 */
  border: 0;
  /* 默认完全透明，背景由统一标签承担。 */
  background: transparent;
  /* 使用辅助浅色图标。 */
  color: #aeb9cc;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
  /* Bootstrap btn-close 同类控件使用透明度表达弱化层级，默认不画边界。 */
  opacity: 0.72;
  /* 只过渡图标颜色和透明度，不生成独立背景块或圆环。 */
  transition: color 0.18s ease, opacity 0.18s ease;
}

/*
  作用容器: 动态关闭图标悬停。
  样式作用: 仅提高图标对比度，不创建边框、圆环、阴影或独立背景。
*/
.app-navbar-item__close:hover {
  /* 使用白色提高当前关闭命令对比度。 */
  color: #ffffff;
  /* 悬停时显示完整图标强度。 */
  opacity: 1;
}

/*
  作用容器: 动态关闭图标键盘焦点。
  样式作用: 使用克制方形内轮廓保持无障碍可见性，鼠标 hover 不触发该状态。
*/
.app-navbar-item__close:focus-visible {
  /* 使用白色提高键盘焦点图标对比度。 */
  color: #ffffff;
  /* 键盘焦点显示完整图标强度。 */
  opacity: 1;
  /* 清除浏览器形状不一致的默认轮廓。 */
  outline: none;
  /* 使用非圆形内轮廓表达键盘位置，不改变按钮尺寸。 */
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42);
  /* 使用项目克制圆角，避免形成截图中的圆形圈。 */
  border-radius: 3px;
}

/*
  作用容器: Element UI 关闭图标字形。
  样式作用: 清除图标字体行盒基线偏移，保证 X 在稳定方形命中区内视觉居中。
*/
.app-navbar-item__close-icon {
  /* 使用块级字形消除行内基线底部空隙。 */
  display: block;
  /* 关闭图标使用稳定紧凑尺寸。 */
  font-size: 15px;
  /* 行盒与字形使用一倍高度，Flex 可以准确居中。 */
  line-height: 1;
}

/*
  动画: 播放标题真实溢出距离滚动。
  作用: 从标题起点移动到测量差值终点，不使用百分比猜测。
*/
@keyframes app-navbar-item-title-scroll {
  from {
    /* 初始显示标题起点。 */
    transform: translateX(0);
  }
  to {
    /* 末端只移动超出视口的准确像素差。 */
    transform: translateX(calc(-1 * var(--app-navbar-title-overflow-distance)));
  }
}

/*
  断点: 1200px 及以上桌面完整导航。
  影响范围: 统一导航项主命令。
  布局变化: 使用全高、紧凑横向内边距和居中文字；移动抽屉不受影响。
*/
@media (min-width: 1200px) {
  .app-navbar-item__main {
    /* 桌面使用稳定横向密度。 */
    padding: 0 clamp(6px, 0.65vw, 10px);
    /* 桌面导航文字水平居中。 */
    text-align: center;
    /* 全高导航不需要局部圆角。 */
    border-radius: 0;
  }
}

/*
  媒体偏好: 用户要求减少动态效果。
  影响范围: 真实溢出的播放标题。
  行为变化: 禁用往返动画，保留裁切边界和完整 title 无障碍名称。
*/
@media (prefers-reduced-motion: reduce) {
  .app-navbar-item__label-track--overflowing {
    /* 尊重系统减少动态效果设置。 */
    animation: none;
  }
}
</style>
