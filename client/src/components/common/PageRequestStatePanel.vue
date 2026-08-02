<template>
  <!--
    PageRequestStatePanel 组件渲染树

    [IF isVisible] ele(aside.page-request-state)
    │  - condition:
    │      当前页面请求存在失败，或正在首次加载且没有可见旧内容时渲染。
    │  - type:
    │      原生标签
    │      标签名称: aside
    │  - description:
    │      页面请求状态反馈容器。
    │      把四个内容页共用的失败、加载和原位重试交互收敛为同一组件。
    │  - params:
    │      -- state：pageRequestStateSelectors 生成的只读页面状态。
    │      -- loadingText/errorTitle/retryLabel：调用页面提供的用户文案。
    │  - events:
    │      无
    │
    ├─ [IF state.hasError] ele(template.error-feedback)
    │  │  - condition:
    │  │      当前一个或多个 PageBucket 事务处于 error 时渲染。
    │  │  - type:
    │  │      Vue template 条件分支
    │  │  - description:
    │  │      组合安全错误说明、并发收敛提示和原位重试命令。
    │  │  - params:
    │  │      -- state.errorMessage：Store 已标准化的错误说明。
    │  │      -- state.canRetry：全部请求收敛后才允许重试。
    │  │  - events:
    │  │      无
    │  ├─ [DEFAULT] ele(el-alert.page-request-state__alert)
    │  └─ [DEFAULT] ele(div.page-request-state__actions)
    │
    └─ [ELSE] ele(div.page-request-state__loading)
       - condition:
           没有失败但正在首次加载且没有可见内容时渲染。
       - type:
           原生标签
           标签名称: div
       - description:
           展示稳定加载提示，避免内容请求期间短暂出现业务空结果。
       - params:
           -- loadingText：当前页面加载说明。
       - events:
           无
  -->
  <!--
    [IF isVisible] ele(aside.page-request-state)
    - condition:
        失败反馈或无内容首次加载需要占据页面内容区时渲染。
    - type:
        原生标签
        标签名称: aside
    - description:
        请求状态反馈容器。
        使用 aria-live 让加载和失败变化可以被辅助技术感知。
    - params:
        -- aria-live：polite，避免状态更新打断用户当前操作。
    - events:
        无
  -->
  <aside
    v-if="isVisible"
    class="page-request-state"
    aria-live="polite"
  >
    <!--
      [IF state.hasError] ele(template.error-feedback)
      - condition:
          页面状态包含一个或多个失败事务时渲染。
      - type:
          Vue template 条件分支
      - description:
          展示错误原因和重试入口；首页部分区域成功时不会移除已成功内容。
      - params:
          -- errorTitle/errorMessage：标题和 Store 安全文案。
          -- canRetry/loading：控制重试按钮是否可执行。
      - events:
          无
    -->
    <template v-if="state.hasError">
      <!--
        [DEFAULT] ele(el-alert.page-request-state__alert)
        - condition:
            错误反馈分支进入后默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-alert
        - description:
            展示通用页面错误标题和 Store 已标准化的安全错误说明。
        - params:
            -- title：调用页面提供的错误标题。
            -- description：state.errorMessage。
            -- closable：false，错误只由成功重试或新请求状态替换。
            -- showIcon：显示错误图标加强状态识别。
        - events:
            无
      -->
      <el-alert
        class="page-request-state__alert"
        type="error"
        :title="errorTitle"
        :description="state.errorMessage"
        :closable="false"
        show-icon
      />

      <!--
        [DEFAULT] ele(div.page-request-state__actions)
        - condition:
            错误反馈分支进入后默认渲染。
        - type:
            原生标签
            标签名称: div
        - description:
            承载并发收敛说明和原位重试按钮。
            重试只发送命令，完整 URL 与请求参数仍由父页面构造。
        - params:
            -- state.loading：仍有同页事务执行时显示等待说明。
        - events:
            无
      -->
      <div class="page-request-state__actions">
        <!--
          [IF state.loading] ele(span.page-request-state__pending)
          - condition:
              首页等多桶页面已有失败但其他桶仍在请求时渲染。
          - type:
              原生标签
              标签名称: span
          - description:
              说明当前仍在等待其他区域收敛，避免用户误以为重试按钮失效。
          - params:
              -- loadingText：当前页面加载说明。
          - events:
              无
        -->
        <span
          v-if="state.loading"
          class="page-request-state__pending"
        >
          {{ loadingText }}
        </span>

        <!--
          [DEFAULT] ele(el-button.page-request-state__retry)
          - condition:
              错误反馈分支进入后默认渲染；在途请求尚未收敛时保持禁用。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-button
          - description:
              提交页面级原位重试命令。
              组件不保存 URL、筛选、关键词、页码或数据源身份。
          - params:
              -- disabled：state.canRetry 为 false 时阻止重复命令。
              -- loading：state.loading 为 true 时展示处理中状态。
              -- icon：使用 Element UI 刷新图标。
          - events:
              @click
                  - description:
                      用户点击且当前状态允许重试时触发。
                      只通知父页面复用当前完整请求事实。
                  - methods:
                      handleRetry()
        -->
        <el-button
          class="page-request-state__retry"
          type="primary"
          size="small"
          icon="el-icon-refresh-right"
          :disabled="!state.canRetry"
          :loading="state.loading"
          @click="handleRetry"
        >
          {{ retryLabel }}
        </el-button>
      </div>
    </template>

    <!--
      [ELSE] ele(div.page-request-state__loading)
      - condition:
          没有错误且 state.isBlockingLoading 为 true 时渲染。
      - type:
          原生标签
          标签名称: div
      - description:
          显示首次请求加载提示，阻止业务空态在请求完成前闪现。
      - params:
          -- loadingText：调用页面提供的加载说明。
      - events:
          无
    -->
    <div
      v-else
      class="page-request-state__loading"
      role="status"
    >
      <!--
        [DEFAULT] ele(i.el-icon-loading)
        - condition:
            首次加载反馈分支进入后默认渲染。
        - type:
            原生标签
            标签名称: i
        - description:
            使用 Element UI 图标字体显示加载旋转标识。
        - params:
            -- aria-hidden：true，文字已经完整表达加载状态。
        - events:
            无
      -->
      <i class="el-icon-loading" aria-hidden="true"></i>
      <!--
        [DEFAULT] ele(span.page-request-state__loading-text)
        - condition:
            首次加载反馈分支进入后默认渲染。
        - type:
            原生标签
            标签名称: span
        - description:
            展示当前页面请求加载说明。
        - params:
            -- loadingText：父页面传入的用户文案。
        - events:
            无
      -->
      <span class="page-request-state__loading-text">{{ loadingText }}</span>
    </div>
  </aside>
</template>

<script>
/*
  PageRequestStatePanel.vue 模块说明

  - 文件职责:
      展示页面请求的阻塞加载、失败原因和原位重试入口。
      供首页、电影页、电视剧页和搜索页复用，不读取 Store、Router、Runtime 或 Provider。

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
      PageRequestStatePanel: Vue component，统一页面请求反馈组件。
*/

export default {
  // 类型: string；作用: 在 Vue 调试工具和错误信息中识别统一页面请求反馈组件。
  name: 'PageRequestStatePanel',

  // 类型: object；作用: 声明父页面传入的只读状态和用户文案，组件不读取 Store、Router 或 Runtime。
  props: {
    // 类型: object。
    // 来源: pageRequestStateSelectors.createPageRequestViewState 返回值。
    // 作用: 决定是否显示加载、错误和重试入口。
    // 字段: hasError，boolean，true 显示错误说明，false 不显示错误分支。
    // 字段: loading，boolean，true 表示仍有同页事务执行，false 表示请求已经收敛。
    // 字段: isBlockingLoading，boolean，true 表示加载中且没有可见内容。
    // 字段: canRetry，boolean，true 允许发送重试事件，false 阻止重复操作。
    // 字段: errorMessage，string，Store 已标准化的安全错误说明。
    state: {
      type: Object,
      required: true
    },

    // 类型: string。
    // 来源: 父页面按自身内容区域传入。
    // 作用: 说明当前正在读取哪类页面内容。
    loadingText: {
      type: String,
      default: '正在读取内容'
    },

    // 类型: string。
    // 来源: 父页面按自身业务语义传入。
    // 作用: 作为错误提示标题，不包含 Provider 或站点内部信息。
    errorTitle: {
      type: String,
      default: '内容请求失败'
    },

    // 类型: string。
    // 来源: 父页面传入或使用通用默认值。
    // 作用: 显示在原位重试按钮中。
    retryLabel: {
      type: String,
      default: '重新请求'
    }
  },

  computed: {
    /**
     * 判断统一反馈面板是否需要渲染。
     * 纯函数: 只读取只读 state，不修改组件、页面或 Store。
     * 显示规则: 任一失败需要反馈；没有可见内容的首次加载需要占位；已有内容的普通刷新只使用页面 loading 遮罩。
     *
     * @returns {boolean} true 渲染反馈面板，false 保持页面现有内容布局。
     */
    isVisible() {
      // 返回值类型: boolean；作用: 只显示用户需要理解或操作的失败与阻塞加载状态。
      return this.state.hasError === true || this.state.isBlockingLoading === true;
    }
  },

  methods: {
    /**
     * 向父页面提交原位重试命令。
     * 触发来源: 反馈面板重试按钮 click 事件。
     * 副作用: 只派发 retry 组件事件，不读取或修改 URL、请求参数、Store 和 Runtime。
     * 成功路径: state.canRetry 为 true 时父页面收到一次命令并复用自己的完整请求事实。
     * 失败路径: 请求仍在执行或状态不允许重试时直接返回，不派发事件。
     *
     * @returns {void} 方法只派发组件事件，不返回业务数据。
     */
    handleRetry() {
      // 条件分支: 当前页面事务尚未全部收敛或没有失败时进入；执行内容: 阻止重复重试命令。
      if (this.state.canRetry !== true) {
        return;
      }

      // 事件: retry。
      // 作用: 通知父页面按当前 URL、筛选、关键词、页码和活动源重新提交同一页面请求。
      // 参数: 无，避免反馈组件拥有或复制页面请求事实。
      this.$emit('retry');
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 页面请求反馈根容器 `.page-request-state`。
  样式作用:
  在数据源切换区和主体内容之间建立稳定反馈区域。
  使用项目现有面板颜色和边界，让错误与加载状态融入普通内容页。
*/
.page-request-state {
  /* 让反馈区域占满当前页面内容宽度，错误说明和操作不会被压缩到局部列。 */
  width: 100%;

  /* 在反馈内部为提示和操作建立纵向布局。 */
  display: flex;

  /* 让提示说明和操作区从上到下排列。 */
  flex-direction: column;

  /* 分隔错误说明和重试操作，避免按钮紧贴提示正文。 */
  gap: 12px;

  /* 给反馈区域提供紧凑内边距，同时保持桌面和手机可读。 */
  padding: 16px;

  /* 使用柔和表面色承载请求状态，不与视频卡片争夺视觉层级。 */
  background: var(--surface-soft);

  /* 使用项目通用边线明确反馈区域边界。 */
  border: 1px solid var(--border-color);

  /* 使用项目紧凑卡片圆角上限，保持反馈和设置控件风格一致。 */
  border-radius: 6px;
}

/*
  作用容器: 错误提示组件 `.page-request-state__alert`。
  样式作用:
  让 Element UI 提示框在父反馈容器内完整占宽。
*/
.page-request-state__alert {
  /* 让错误标题和说明使用反馈容器全部可用宽度。 */
  width: 100%;
}

/*
  作用容器: 请求反馈操作区 `.page-request-state__actions`。
  样式作用:
  横向排列并发等待说明和重试按钮。
  在窄宽度下允许自然换行，避免按钮挤压错误文案。
*/
.page-request-state__actions {
  /* 使用弹性布局组织说明和操作按钮。 */
  display: flex;

  /* 让说明和按钮在同一行空间不足时自然换行。 */
  flex-wrap: wrap;

  /* 让并发等待说明和操作按钮在交叉轴保持垂直居中。 */
  align-items: center;

  /* 把重试操作推到可用行末，等待说明保留在左侧。 */
  justify-content: flex-end;

  /* 给换行后的说明和按钮提供稳定间距。 */
  gap: 10px;
}

/*
  作用容器: 多桶仍在收敛的提示 `.page-request-state__pending`。
  样式作用:
  用辅助文字解释重试按钮暂时不可用的原因。
*/
.page-request-state__pending {
  /* 使用剩余宽度承载加载说明，按钮保持自然宽度。 */
  flex: 1 1 220px;

  /* 使用辅助字号降低并发说明的视觉权重。 */
  font-size: 13px;

  /* 使用弱文字色区分主要错误说明。 */
  color: var(--text-muted);
}

/*
  作用容器: 原位重试按钮 `.page-request-state__retry`。
  样式作用:
  保持命令按钮自然宽度，避免文案长度改变反馈区域布局。
*/
.page-request-state__retry {
  /* 阻止按钮被弹性布局压窄，保证图标和重试文案完整可读。 */
  flex: 0 0 auto;
}

/*
  作用容器: 首次请求加载反馈 `.page-request-state__loading`。
  样式作用:
  在没有旧内容时提供稳定最小高度和居中加载说明。
  防止 CatalogGrid 业务空态在真实请求完成前闪现。
*/
.page-request-state__loading {
  /* 建立水平布局，让加载图标和说明文字并排显示。 */
  display: flex;

  /* 让图标和文字在反馈区域中水平居中。 */
  justify-content: center;

  /* 让图标和文字在交叉轴对齐。 */
  align-items: center;

  /* 分隔加载图标和说明文字。 */
  gap: 10px;

  /* 提供稳定占位高度，避免请求开始和完成时主体布局突然跳动。 */
  min-height: 120px;

  /* 使用正文辅助色，让加载说明清晰但不过度强调。 */
  color: var(--text-secondary);
}

/*
  作用容器: 首次加载说明 `.page-request-state__loading-text`。
  样式作用:
  保持加载文案为普通正文密度，在各页面使用统一字号。
*/
.page-request-state__loading-text {
  /* 使用紧凑正文字号，和页面状态行保持一致。 */
  font-size: 14px;
}
</style>
