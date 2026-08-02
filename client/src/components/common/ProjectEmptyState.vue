<template>
  <!--
    ProjectEmptyState 组件渲染树

    [DEFAULT] ele(div.el-empty.project-empty-state)
    ├─ [DEFAULT] ele(div.el-empty__image)
    │  - condition: 始终渲染；image 非空时显示调用方图片，否则显示无 SVG 标识的 Element 图标字体。
    │  - type: 原生 div。
    │  - description: 保持 Element UI 空状态图像区域 API 与布局类名，同时消除默认 SVG 重复 ID。
    │  - params: -- image；-- imageSize。
    │  - events: 图片禁止拖动，无业务事件。
    ├─ [DEFAULT] ele(div.el-empty__description)
    │  - condition: 始终渲染；description slot 优先，否则显示 emptyDescription。
    │  - type: 原生 div。
    │  - description: 展示调用方提供的空状态说明。
    │  - params: -- description；-- $slots.description。
    │  - events: 无
    └─ [IF $slots.default] ele(div.el-empty__bottom)
       - condition: 调用方提供默认 slot 时渲染。
       - type: 原生 div。
       - description: 承载空状态下的恢复按钮或其它明确动作。
       - params: -- $slots.default。
       - events: 由 slot 内容自行拥有。
  -->
  <div class="el-empty project-empty-state">
    <div class="el-empty__image project-empty-state__image" :style="imageStyle">
      <img
        v-if="image"
        class="project-empty-state__custom-image"
        :src="image"
        alt=""
        draggable="false" />
      <i v-else class="el-icon-receiving project-empty-state__icon" aria-hidden="true"></i>
    </div>
    <div class="el-empty__description">
      <slot v-if="$slots.description" name="description"></slot>
      <p v-else>{{ emptyDescription }}</p>
    </div>
    <div v-if="$slots.default" class="el-empty__bottom">
      <slot></slot>
    </div>
  </div>
</template>

<script>
/*
  ProjectEmptyState.vue 模块说明

  - 文件职责:
      提供项目统一空状态渲染器，兼容当前使用的 Element UI ElEmpty 输入和 slot。
      默认使用 Element 图标字体替代带固定内部 ID 的 SVG，使 KeepAlive 多页面空状态保持唯一 HTML 标识。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      DEFAULT_EMPTY_DESCRIPTION: string，调用方没有说明时使用的普通用户空状态文案。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      ProjectEmptyState: Vue component，由 main.js 在 Element UI 安装后注册为全局 ElEmpty 渲染器。
*/

// 类型: string。
// 作用: 调用方未提供 description 或命名 slot 时显示稳定空状态说明。
const DEFAULT_EMPTY_DESCRIPTION = '暂无数据';

export default {
  // 类型: string；作用: 供 Vue Devtools 识别项目空状态适配器，main.js 另以 ElEmpty 全局别名注册。
  name: 'ProjectEmptyState',

  props: {
    // 类型: string。
    // 来源: 现有 el-empty image 属性。
    // 作用: 非空时继续渲染调用方提供的位图或资源地址；为空时使用项目图标字体。
    image: {
      type: String,
      default: ''
    },

    // 类型: number。
    // 来源: 现有 el-empty image-size 属性。
    // 作用: 控制空状态图像区域宽高；缺失时由组件 CSS 使用稳定默认尺寸。
    imageSize: {
      type: Number,
      default: 0
    },

    // 类型: string。
    // 来源: 现有 el-empty description 属性。
    // 作用: 提供当前业务空状态说明；命名 description slot 存在时只作为后备值。
    description: {
      type: String,
      default: ''
    }
  },

  computed: {
    /**
     * 生成最终空状态说明。
     * 纯函数: 只读取 description，不访问 DOM 或修改调用方数据。
     *
     * @returns {string} 调用方说明或项目默认说明。
     */
    emptyDescription() {
      return this.description || DEFAULT_EMPTY_DESCRIPTION;
    },

    /**
     * 生成图像区域尺寸样式。
     * 纯函数: 只读取 imageSize；无有效尺寸时返回空对象并使用 CSS 默认值。
     *
     * @returns {object} Vue style 绑定对象。
     */
    imageStyle() {
      // 条件分支: imageSize 不是正有限数时进入。执行内容: 返回空样式并使用组件默认尺寸。
      if (!Number.isFinite(this.imageSize) || this.imageSize <= 0) {
        return {};
      }
      // 类型: string；作用: 把数字尺寸转换为 CSS 长度，同步控制宽高避免图标区域变形。
      const size = `${this.imageSize}px`;
      return {
        width: size,
        height: size
      };
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 项目空状态图像区 `.project-empty-state__image`。
  样式作用: 在没有 imageSize 时提供稳定尺寸，并居中自定义图片或图标字体。
*/
.project-empty-state__image {
  /* 没有 imageSize 时使用 Element UI 空状态的稳定默认宽度。 */
  width: 96px;
  /* 默认高度与宽度一致，避免字体图标区域变形。 */
  height: 96px;
  /* 使用弹性布局统一居中调用方图片和默认字体图标。 */
  display: flex;
  /* 让图片或图标沿交叉轴保持垂直居中。 */
  align-items: center;
  /* 让图片或图标沿主轴保持水平居中。 */
  justify-content: center;
}

/*
  作用容器: 调用方自定义空状态图片 `.project-empty-state__custom-image`。
  样式作用: 在图像区域内等比完整展示，不裁切业务图片。
*/
.project-empty-state__custom-image {
  /* 自定义图片占满调用方指定或默认图像区域宽度。 */
  width: 100%;
  /* 自定义图片占满图像区域高度并交给 object-fit 保持比例。 */
  height: 100%;
  /* 完整展示自定义图片，不裁切业务提供的空状态资源。 */
  object-fit: contain;
  /* 使用块级图片消除行内基线空隙。 */
  display: block;
}

/*
  作用容器: 默认空状态图标 `.project-empty-state__icon`。
  样式作用: 使用 Element UI 字体图标提供无内部 SVG ID 的中性占位图示。
*/
.project-empty-state__icon {
  /* 使用主题弱文字色，让默认图示不抢空状态说明的视觉层级。 */
  color: var(--text-muted);
  /* 使用与默认图像区域匹配的图标字号，保持既有空状态占位密度。 */
  font-size: 48px;
  /* 使用单位行高避免字体自身行盒撑大图像区域。 */
  line-height: 1;
  /* 轻微降低默认图标不透明度，让它保持中性辅助状态。 */
  opacity: .72;
}
</style>
