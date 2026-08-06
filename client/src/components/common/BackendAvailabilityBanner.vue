<template>
  <!--
    后端基础设施状态栏。
    作用: 在 AppNavbar 下方、当前路由主体上方展示全局后端健康状态。
    idle/available: 不渲染，避免长期占用页面空间。
    checking: 渲染蓝色窄栏，说明远程请求正在建立基础设施连接。
    unavailable: 渲染错误栏和显式重试按钮，不影响本地历史、收藏和设置。
  -->
  <section
    v-if="isVisible"
    :class="['backend-availability-banner', 'backend-availability-banner--' + snapshot.status]"
    :aria-live="ariaLive"
    role="status"
  >
    <!-- 当前状态图标只表达基础设施状态，不复用 Provider 数据源状态点。 -->
    <i
      :class="['backend-availability-banner__icon', statusIcon]"
      aria-hidden="true"
    />

    <!-- 状态文案只来自固定安全映射，不展示底层异常、URL、Provider 或上游信息。 -->
    <span class="backend-availability-banner__message">{{ statusMessage }}</span>

    <!-- unavailable 才显示显式重试，checking 期间不重复发起健康请求。 -->
    <button
      v-if="isUnavailable"
      class="backend-availability-banner__retry"
      type="button"
      :disabled="isChecking"
      @click="retryAvailability"
    >
      重试
    </button>
  </section>
</template>

<script>
/*
  BackendAvailabilityBanner.vue 模块说明

  - 文件职责:
      订阅应用唯一 BackendAvailabilityRuntime，并在 App Shell 的固定位置投影 checking/unavailable 状态。
      组件不创建第二套状态、不访问 Provider/Store/Repository、不弹消息框，也不保存健康结果。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      backendInfrastructure.config.js#BACKEND_INFRASTRUCTURE_CONFIG、BACKEND_INFRASTRUCTURE_STATUS: 提供固定状态和安全文案。
      backendAvailabilityService.js#backendAvailabilityService: 提供共享快照、订阅和显式重试。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      BackendAvailabilityBanner: Vue 组件配置，由 App.vue 唯一挂载。
*/

import {
  // 导入来源: ../../runtime/backend-infrastructure/backendInfrastructure.config.js；导入内容: 状态配置和四态枚举；文件作用: 统一状态分支与用户文案。
  BACKEND_INFRASTRUCTURE_CONFIG,

  // 导入来源: ../../runtime/backend-infrastructure/backendInfrastructure.config.js；导入内容: BACKEND_INFRASTRUCTURE_STATUS 四态枚举；文件作用: 控制 checking/unavailable 分支。
  BACKEND_INFRASTRUCTURE_STATUS
} from '../../runtime/backend-infrastructure/backendInfrastructure.config.js';

// 导入来源: ../../runtime/backend-infrastructure/backendAvailabilityService.js；导入内容: 产品健康状态协调器；文件作用: 订阅和重试同一全局后端状态。
import { backendAvailabilityService } from '../../runtime/backend-infrastructure/backendAvailabilityService.js';

export default {
  // 组件名称: BackendAvailabilityBanner；用途: Vue Devtools 和 App.vue 注册识别。
  name: 'BackendAvailabilityBanner',

  /**
   * 创建组件本地响应式状态。
   * 纯函数: 只读取共享协调器当前冻结快照并建立本地取消订阅字段，不触发网络。
   * 成功路径: 返回 Vue data 对象，供 template 和 computed 使用。
   * 失败路径: 协调器依赖异常时由共享服务原样抛出，组件不创建替代状态。
   *
   * @returns {object} 当前组件的响应式状态。
   */
  data() {
    return {
      // 类型: Readonly<object>；初始值: 协调器当前冻结快照；作用: 控制状态栏显示、样式和按钮。
      snapshot: backendAvailabilityService.getSnapshot(),

      // 类型: Function|null；初始值: null；作用: 保存当前组件的幂等取消订阅函数。
      unsubscribe: null
    };
  },

  computed: {
    /**
     * 判断当前状态是否需要渲染栏。
     * 纯函数: 只读取四态快照，不触发健康检查或页面副作用。
     *
     * @returns {boolean} checking/unavailable 返回 true，idle/available 返回 false。
     */
    isVisible() {
      return this.isChecking || this.isUnavailable;
    },

    /**
     * 判断当前是否正在健康检查。
     * 纯函数: 只比较共享状态枚举。
     *
     * @returns {boolean} true 禁用重复重试，false 允许当前状态的其他展示逻辑。
     */
    isChecking() {
      return this.snapshot.status === BACKEND_INFRASTRUCTURE_STATUS.checking;
    },

    /**
     * 判断当前后端是否不可用。
     * 纯函数: 只比较共享状态枚举。
     *
     * @returns {boolean} true 显示错误文案和显式重试按钮。
     */
    isUnavailable() {
      return this.snapshot.status === BACKEND_INFRASTRUCTURE_STATUS.unavailable;
    },

    /**
     * 生成当前状态的可访问性文案。
     * 纯函数: 只读取固定配置和冻结快照，不展示底层异常。
     *
     * @returns {string} 当前状态的安全用户文案。
     */
    statusMessage() {
      return this.isChecking
        ? BACKEND_INFRASTRUCTURE_CONFIG.checkingMessage
        : this.snapshot.message;
    },

    /**
     * 生成当前状态图标类。
     * 纯函数: 只把基础设施四态映射到项目已加载的图标字体类。
     *
     * @returns {string} 当前状态图标类名。
     */
    statusIcon() {
      return this.isChecking ? 'el-icon-loading' : 'el-icon-warning-outline';
    },

    /**
     * 生成 aria-live 等级。
     * 纯函数: checking 不抢占阅读器，unavailable 需要及时告知失败。
     *
     * @returns {string} polite 或 assertive。
     */
    ariaLive() {
      return this.isUnavailable ? 'assertive' : 'polite';
    }
  },

  /**
   * Vue created 生命周期。
   * 执行时机: 根组件创建 BackendAvailabilityBanner 后。
   * 执行内容: 订阅产品唯一协调器，并立即接收当前冻结快照。
   * 副作用: 登记一个内存监听器并更新当前组件 snapshot。
   * 放置原因: 组件只需要内存订阅，不依赖 DOM 或网络初始化。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   */
  created() {
    // 副作用: 订阅共享健康状态，后续状态变化只更新当前组件的冻结快照引用。
    this.unsubscribe = backendAvailabilityService.subscribe((nextSnapshot) => {
      this.snapshot = nextSnapshot;
    });
  },

  /**
   * Vue beforeDestroy 生命周期。
   * 执行时机: 根组件销毁 BackendAvailabilityBanner 前。
   * 执行内容: 取消当前组件订阅，防止旧组件继续接收状态。
   * 副作用: 从共享协调器移除当前组件监听器并清空本地取消函数。
   * 放置原因: 服务生命周期长于页面组件，必须释放组件监听器。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   */
  beforeDestroy() {
    // 条件分支: 取消订阅函数已创建时进入；执行内容: 幂等释放当前组件监听器。
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  },

  methods: {
    /**
     * 执行用户显式后端重试。
     * 触发来源: unavailable 状态栏的“重试”按钮。
     * 执行内容: 调用共享协调器 retry，不创建第二服务、不弹额外提示。
     * 副作用: 触发或复用一次后端健康 GET，并由共享订阅更新状态栏。
     * 成功路径: 健康服务完成后由订阅更新状态栏并在 available 时收起。
     * 失败路径: 服务把健康失败收敛为 unavailable，组件继续展示同一错误栏。
     *
     * @returns {Promise<void>} 健康检查完成后结束。
     */
    async retryAvailability() {
      await backendAvailabilityService.retry();
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 后端基础设施状态栏 backend-availability-banner。
  样式作用:
  让状态栏位于导航和路由主体之间的自然文档流。
  提供统一水平内边距和紧凑高度，不遮挡页面或播放器。
*/
.backend-availability-banner {
  /* 让状态内容按一行横向排列，图标、文案和重试按钮保持同一信息层级。 */
  display: flex;

  /* 让状态栏内容在垂直方向居中，避免图标与文案上下错位。 */
  align-items: center;

  /* 设置状态栏内部间距，让短文案和操作按钮保持可读距离。 */
  gap: 8px;

  /* 设置状态栏最小高度，checking/unavailable 出现时不造成页面跳动过大。 */
  min-height: 32px;

  /* 设置宽屏和窄屏统一的水平安全边距，和应用主体保持同向。 */
  padding: 4px 24px;

  /* 把内边距计入状态栏尺寸，防止按钮内容撑出横向布局。 */
  box-sizing: border-box;

  /* 使用小字号表达基础设施辅助状态，避免抢占页面内容视觉重心。 */
  font-size: 13px;
}

/*
  作用容器: checking 状态栏 backend-availability-banner--checking。
  样式作用:
  使用蓝色表达检测中。
  保持与数据源绿色/红色健康点不同的全局状态语义。
*/
.backend-availability-banner--checking {
  /* 设置蓝色文字，提示当前正在建立后端连接而非 Provider 业务状态。 */
  color: #2457a6;

  /* 设置蓝色浅背景，保持状态栏轻量并降低对页面内容的遮挡。 */
  background: #eaf2ff;
}

/*
  作用容器: unavailable 状态栏 backend-availability-banner--unavailable。
  样式作用:
  使用红色表达后端连接失败。
  让用户知道可以重试且不误认为某个数据源失效。
*/
.backend-availability-banner--unavailable {
  /* 设置红色文字，强化需要用户处理的基础设施失败。 */
  color: #a61b29;

  /* 设置红色浅背景，形成与 checking 蓝色清晰区分的失败层级。 */
  background: #fff0f1;
}

/*
  作用容器: 状态栏图标 backend-availability-banner__icon。
  样式作用:
  固定图标区域宽度。
  防止状态切换时文案起始位置横向跳动。
*/
.backend-availability-banner__icon {
  /* 设置图标固定宽度，让两种状态的文本起点保持一致。 */
  width: 16px;

  /* 设置图标固定高度，和小字号文案垂直居中。 */
  height: 16px;

  /* 让图标不参与文字压缩，窄屏仍保留状态识别。 */
  flex: 0 0 auto;
}

/*
  作用容器: 状态栏文案 backend-availability-banner__message。
  样式作用:
  允许较长失败说明在窄屏换行。
  把文案空间让给右侧显式重试按钮。
*/
.backend-availability-banner__message {
  /* 允许文案占用剩余空间，避免按钮被文字挤出可视区域。 */
  flex: 1 1 auto;

  /* 允许长文案在移动端自然换行。 */
  min-width: 0;
}

/*
  作用容器: 重试按钮 backend-availability-banner__retry。
  样式作用:
  维持轻量的文本按钮外观。
  保留键盘焦点和可点击反馈。
*/
.backend-availability-banner__retry {
  /* 让按钮只保留文字所需宽度，减少状态栏横向占用。 */
  flex: 0 0 auto;

  /* 去除浏览器默认边框，使用文字颜色表达操作层级。 */
  border: 0;

  /* 使用透明背景，让按钮融入错误状态栏而不是生成第二个卡片。 */
  background: transparent;

  /* 使用继承色保持重试操作与错误文案统一。 */
  color: inherit;

  /* 为键盘和鼠标提供明确的可操作光标。 */
  cursor: pointer;

  /* 继承项目字体，避免状态栏出现浏览器默认字体跳变。 */
  font: inherit;
}

/*
  作用容器: 重试按钮禁用态 backend-availability-banner__retry:disabled。
  样式作用:
  明确按钮当前不可重复触发。
  降低禁用操作的视觉强调。
*/
.backend-availability-banner__retry:disabled {
  /* 降低禁用按钮不透明度，提示当前检查仍在处理。 */
  opacity: 0.6;

  /* 禁用态不显示点击光标，避免用户误以为可以创建第二次检查。 */
  cursor: not-allowed;
}

/*
  作用容器: 平板和移动端状态栏 backend-availability-banner。
  样式作用:
  缩小水平边距，给窄屏内容和重试按钮保留足够宽度。
*/
@media (max-width: 768px) {
  .backend-availability-banner {
    /* 缩小移动端水平边距，避免状态文案和重试按钮发生不必要换行。 */
    padding-right: 16px;

    /* 缩小移动端左侧边距，和页面主体的安全边距保持一致。 */
    padding-left: 16px;
  }
}
</style>
