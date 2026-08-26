<template>
  <!--
    SourceImage 组件渲染树

    └─ [IF renderedSource] ele(img.source-image)
       - condition:
           原始图片 URL 尚未失败，或受控运输已经生成临时 Blob URL 时渲染。
           无地址、兜底请求中和最终失败时不渲染，让父容器原有占位自然可见。
       - type:
           原生标签
           标签名称: img
       - description:
           先直接嵌入标准 poster/cover；浏览器报错后只执行一次受控运输兜底。
       - params:
           -- renderedSource：当前原始 URL 或临时 Blob URL。
           -- alt：父组件提供的替代文本。
           -- $attrs：父组件传入的非业务图片属性。
       - events:
           @load
               - description: 当前图片真实完成解码时通知父组件。
               - methods: handleImageLoad()
           @error
               - description: 原始地址失败时启动兜底，Blob 地址失败时收敛为空。
               - methods: handleImageError()
  -->
  <img
    v-if="renderedSource"
    v-bind="$attrs"
    class="source-image"
    :src="renderedSource"
    :alt="alt"
    @load="handleImageLoad"
    @error="handleImageError" />
</template>

<script>
/*
  SourceImage.vue 模块说明

  - 文件职责:
      统一拥有 poster/cover 的直接加载、单次受控兜底和 Object URL 生命周期。
      父组件继续只提供标准 URL 与 sourceId，不识别代理、Blob 或站点差异。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      sourceImageService.js#sourceImageService: 获取并释放临时图片 URL 租约。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeText(value): 将 prop 候选收敛为去除首尾空白的字符串。

  - 模块级类:
      无

  - 组件状态:
      renderedSource: string，当前 img 使用的原始或 Blob URL；空字符串表示显示父级占位。
      fallbackAttempted: boolean，true 表示当前 sourceId+src 已执行兜底，false 表示仍允许一次兜底。

  - 对外导出:
      SourceImage: Vue component，供卡片、轮播和详情海报复用统一图片失败处理。
*/

// 导入来源: ../../services/sourceImageService.js。
// 导入内容: sourceImageService 临时图片 URL 租约服务。
// 文件作用: 原始 img 报错后通过唯一受控运输获取字节，并在组件生命周期内释放 Blob URL。
import { sourceImageService } from '../../services/sourceImageService.js';

/**
 * 把组件输入收敛为文本。
 * 纯函数: 相同输入返回相同字符串，不修改 prop。
 *
 * @param {*} value 待规范化值。
 * @returns {string} 去除首尾空白的字符串；非字符串返回空字符串。
 */
function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export default {
  name: 'SourceImage',
  inheritAttrs: false,

  props: {
    // 类型: string；来源: 标准 ContentItem.sourceId；作用: 绑定兜底运输审计身份，不决定站点分支。
    sourceId: { type: String, required: true },
    // 类型: string；来源: 标准 ContentItem.poster/cover；作用: 首次直接加载，失败后原样交给受控运输。
    src: { type: String, default: '' },
    // 类型: string；来源: 父组件可见标题；作用: 保持图片可访问替代文本。
    alt: { type: String, default: '' }
  },

  /**
   * 创建当前图片实例的响应式状态。
   * 纯函数: 不访问网络或浏览器 URL API；实际资源引用保存在非响应式实例字段中。
   *
   * @returns {{renderedSource: string, fallbackAttempted: boolean}} 图片展示状态。
   */
  data() {
    return {
      // 类型: string；作用: 保存当前 img 使用的原始 URL 或临时 Blob URL，空值让父容器显示既有占位。
      renderedSource: normalizeText(this.src),
      // true: 当前输入已经执行过受控兜底，后续错误直接终止；false: 原始 URL 仍允许一次兜底。
      fallbackAttempted: false
    };
  },

  /**
   * 初始化图片实例持有的非响应式资源引用。
   * 执行时机: Vue 实例创建完成且尚未挂载真实图片节点。
   * 副作用: 建立代次、中止控制器和 Blob 租约的唯一实例所有权。
   *
   * @returns {void} 实例资源槽初始化完成后结束。
   */
  created() {
    // 类型: number；作用: 每次输入变化和销毁递增，阻止迟到租约覆盖新图片。
    this._sourceImageGeneration = 0;
    // 类型: AbortController|null；作用: 中止当前图片兜底请求，不影响其它组件或后端共享健康检查。
    this._sourceImageAbortController = null;
    // 类型: Readonly<object>|null；作用: 保存当前 Blob URL 的唯一释放权。
    this._sourceImageLease = null;
  },

  /**
   * 在组件销毁前释放图片运输和临时 URL。
   * 执行时机: Vue 即将移除当前组件及其图片节点。
   * 副作用: 中止在途请求并撤销 Blob URL，避免资源跨路由泄漏。
   *
   * @returns {void} 当前组件外部资源释放完成后结束。
   */
  beforeDestroy() {
    // 生命周期清理: 销毁后中止在途请求并撤销当前 Blob URL，避免跨路由资源泄漏。
    this.releaseCurrentAsset();
  },

  watch: {
    /**
     * 原始图片地址变化时开始新代次。
     * 副作用: 释放旧请求和 Blob URL，并让新地址重新从浏览器直接加载开始。
     *
     * @param {string} nextSource 新 poster/cover 地址。
     * @returns {void} 状态同步完成后结束。
     */
    src(nextSource) {
      this.resetForInput(nextSource);
    },

    /**
     * 图片所属 sourceId 变化时重启同一 URL 的运输身份。
     * 副作用: 释放旧源租约，避免复用错误的请求审计身份。
     *
     * @returns {void} 新代次初始化完成后结束。
     */
    sourceId() {
      this.resetForInput(this.src);
    }
  },

  methods: {
    /**
     * 释放当前图片请求和临时 URL。
     * 副作用: 中止在途运输、撤销 Object URL 并提升代次；调用幂等。
     *
     * @returns {void} 当前组件不再持有外部图片资源。
     */
    releaseCurrentAsset() {
      this._sourceImageGeneration = Number(this._sourceImageGeneration || 0) + 1;
      this._sourceImageAbortController?.abort();
      this._sourceImageAbortController = null;
      this._sourceImageLease?.release();
      this._sourceImageLease = null;
    },

    /**
     * 为新的 sourceId+src 输入恢复直接加载状态。
     * 副作用: 先释放旧资源，再更新 renderedSource 和兜底标记。
     *
     * @param {*} nextSource 新图片 URL 候选。
     * @returns {void} 输入状态采用完成后结束。
     */
    resetForInput(nextSource) {
      this.releaseCurrentAsset();
      this.fallbackAttempted = false;
      this.renderedSource = normalizeText(nextSource);
    },

    /**
     * 转发图片真实加载成功事件。
     * 副作用: 向父组件发布 load；不修改 ContentItem 或外部状态。
     *
     * @param {Event} event 浏览器 img load 事件。
     * @returns {void} 事件发布后结束。
     */
    handleImageLoad(event) {
      this.$emit('load', event);
    },

    /**
     * 处理原始图片或 Blob 图片加载失败。
     * 副作用: 原始地址首次失败时请求一个临时图片租约；第二次失败时清空节点并通知父组件。
     * 成功路径: 当前代次采用 Blob URL；失败路径: 释放迟到租约并显示父级已有占位。
     *
     * @param {Event} event 浏览器 img error 事件。
     * @returns {Promise<void>} 当前错误处理收敛后完成。
     */
    async handleImageError(event) {
      // 类型: string；作用: 保存当前标准 ContentItem 的原始 poster/cover，供本代次运输和一致性复核。
      const originalSource = normalizeText(this.src);
      // 类型: string；作用: 保存当前图片所属数据源身份，只用于受控网络审计与 SourceContext 绑定。
      const sourceId = normalizeText(this.sourceId);
      // 条件分支: 当前输入已经尝试兜底，或缺少图片 URL/sourceId 时进入。
      // 执行内容: 收敛为最终占位并通知父组件，不重复请求或伪造成功结果。
      if (this.fallbackAttempted || !originalSource || !sourceId) {
        this.renderedSource = '';
        this._sourceImageLease?.release();
        this._sourceImageLease = null;
        this.$emit('terminal-error', event);
        return;
      }

      this.fallbackAttempted = true;
      this.renderedSource = '';
      // 类型: number；作用: 为本次异步兜底分配新代次，阻止旧请求覆盖后续 src 或 sourceId。
      const generation = Number(this._sourceImageGeneration || 0) + 1;
      this._sourceImageGeneration = generation;
      // 类型: AbortController；作用: 允许输入变化或组件销毁时只中止当前图片兜底请求。
      const controller = new AbortController();
      this._sourceImageAbortController = controller;

      try {
        // 类型: Readonly<{url: string, release: Function}>；作用: 持有本次图片 Blob URL 及唯一幂等释放权。
        const lease = await sourceImageService.acquire({
          sourceId,
          url: originalSource,
          signal: controller.signal
        });
        // 条件分支: 请求返回时组件代次、图片 URL 或 sourceId 已变化时进入。
        // 执行内容: 立即释放迟到租约，禁止旧图片覆盖当前输入。
        if (generation !== this._sourceImageGeneration
          || normalizeText(this.src) !== originalSource
          || normalizeText(this.sourceId) !== sourceId) {
          lease.release();
          return;
        }
        this._sourceImageAbortController = null;
        this._sourceImageLease = lease;
        this.renderedSource = lease.url;
      } catch (error) {
        // 条件分支: 当前失败属于已经失效的旧代次时进入。
        // 执行内容: 直接结束，避免旧失败覆盖新输入或重复发送终态事件。
        if (generation !== this._sourceImageGeneration) return;
        this._sourceImageAbortController = null;
        this.renderedSource = '';
        this.$emit('terminal-error', error);
      }
    }
  }
};
</script>

