<template>
  <!--
    [DEFAULT] ele(startup-failure-root)
    │  - condition: Source 或 UserContent 持久化初始化失败且正常 App 未挂载时渲染。
    │  - type: 原生 main 标签，当前组件根节点。
    │  - description: 提供独立、可访问且不会伪装业务就绪的启动失败页面。
    │  - params: errorCode 与 message 由 main.js 从稳定错误分类生成，不接收原始 cause。
    │  - events: 无。
    └─ [DEFAULT] ele(startup-failure-content)
       │  - condition: 根节点渲染时始终显示。
       │  - type: 原生 section 标签。
       │  - description: 约束故障说明宽度并组织图标、标题、说明、错误码和恢复命令。
       │  - params: 无。
       │  - events: 无。
       ├─ [DEFAULT] ele(startup-failure-icon)
       │  - condition: 内容区渲染时始终显示。
       │  - type: 原生 span 标签，使用 Element UI 警告图标类。
       │  - description: 以非文本装饰强化当前页面是启动失败状态。
       │  - params: aria-hidden=true，避免屏幕阅读器重复播报视觉图标。
       │  - events: 无。
       ├─ [DEFAULT] ele(startup-failure-title)
       │  - condition: 内容区渲染时始终显示。
       │  - type: 原生 h1 标签。
       │  - description: 明确应用未完成本地数据初始化。
       │  - params: 无。
       │  - events: 无。
       ├─ [DEFAULT] ele(startup-failure-message)
       │  - condition: 内容区渲染时始终显示。
       │  - type: 原生 p 标签。
       │  - description: 展示与稳定错误码对应的安全处理建议。
       │  - params: message 来自父级，不展示原始异常文本。
       │  - events: 无。
       ├─ [DEFAULT] ele(startup-failure-code)
       │  - condition: 内容区渲染时始终显示。
       │  - type: 原生 code 标签。
       │  - description: 展示可用于定位问题的稳定应用错误码。
       │  - params: errorCode 来自父级。
       │  - events: 无。
       └─ [DEFAULT] ele(startup-failure-reload)
          - condition: 内容区渲染时始终显示。
          - type: 第三方 el-button 组件，来源 element-ui 全局注册。
          - description: 让用户在关闭阻塞页面或释放空间后显式重新执行完整启动链。
          - params: type=primary；icon=el-icon-refresh。
          - events: @click 调用 handleReload() 重新加载当前页面。
  -->
  <!--
    [DEFAULT] ele(startup-failure-root)
    - condition: Source 或 UserContent 持久化初始化失败且正常 App 未挂载时渲染。
    - type: 原生 main 标签，当前组件根节点。
    - description: 提供独立、可访问且不会伪装业务就绪的启动失败页面。
    - params: errorCode 与 message 由 main.js 从稳定错误分类生成，不接收原始 cause。
    - events: 无。
  -->
  <main
    class="startup-failure"
    role="alert"
    aria-live="assertive"
  >
    <!--
      [DEFAULT] ele(startup-failure-content)
      - condition: 根节点渲染时始终显示。
      - type: 原生 section 标签。
      - description: 约束故障说明宽度并组织图标、标题、说明、错误码和恢复命令。
      - params: 无。
      - events: 无。
    -->
    <section class="startup-failure__content">
      <!--
        [DEFAULT] ele(startup-failure-icon)
        - condition: 内容区渲染时始终显示。
        - type: 原生 span 标签，使用 Element UI 警告图标类。
        - description: 以非文本装饰强化当前页面是启动失败状态。
        - params: aria-hidden=true，避免屏幕阅读器重复播报视觉图标。
        - events: 无。
      -->
      <span
        class="startup-failure__icon el-icon-warning-outline"
        aria-hidden="true"
      ></span>

      <!--
        [DEFAULT] ele(startup-failure-title)
        - condition: 内容区渲染时始终显示。
        - type: 原生 h1 标签。
        - description: 明确应用未完成本地数据初始化。
        - params: 无。
        - events: 无。
      -->
      <h1 class="startup-failure__title">本地数据初始化失败</h1>

      <!--
        [DEFAULT] ele(startup-failure-message)
        - condition: 内容区渲染时始终显示。
        - type: 原生 p 标签。
        - description: 展示与稳定错误码对应的安全处理建议。
        - params: message 来自父级，不展示原始异常文本。
        - events: 无。
      -->
      <p class="startup-failure__message">{{ message }}</p>

      <!--
        [DEFAULT] ele(startup-failure-code)
        - condition: 内容区渲染时始终显示。
        - type: 原生 code 标签。
        - description: 展示可用于定位问题的稳定应用错误码。
        - params: errorCode 来自父级。
        - events: 无。
      -->
      <code class="startup-failure__code">{{ errorCode }}</code>

      <!--
        [DEFAULT] ele(startup-failure-reload)
        - condition: 内容区渲染时始终显示。
        - type: 第三方 el-button 组件，来源 element-ui 全局注册。
        - description: 让用户在关闭阻塞页面或释放空间后显式重新执行完整启动链。
        - params: type=primary；icon=el-icon-refresh。
        - events: @click 调用 handleReload() 重新加载当前页面。
      -->
      <el-button
        class="startup-failure__reload"
        type="primary"
        icon="el-icon-refresh"
        @click="handleReload"
      >
        重新加载
      </el-button>
    </section>
  </main>
</template>

<script>
/*
  StartupFailureView.vue 模块说明

  - 文件职责:
      在正常 App 因持久化初始化失败而不允许挂载时展示专用恢复界面。
      只消费 main.js 生成的安全错误码与用户说明，不访问 Repository、store、路由或原始 cause。

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
      StartupFailureView Vue 组件配置，供 main.js 在启动失败分支挂载。
*/

// 导出类型: Vue 组件配置对象。
// 导出内容: 启动失败提示、稳定错误码和显式重新加载命令。
// 调用方: main.js 的 mountStartupFailure(error) 失败收敛入口。
export default {
  // 类型: string；作用: 为 Vue Devtools 和运行时诊断提供稳定组件名称。
  name: 'StartupFailureView',

  // 类型: object；来源: main.js render props；作用: 只接收安全错误模型，不接收原始 Error。
  props: {
    // 类型: string；来源: main.js createStartupFailureViewModel(error)。
    // 默认值: APPLICATION_STARTUP_FAILED；页面影响: 展示稳定诊断码，不泄漏 cause。
    errorCode: {
      type: String,
      default: 'APPLICATION_STARTUP_FAILED'
    },
    // 类型: string；来源: main.js 按稳定错误码选择的用户可读处理建议。
    // 默认值: 通用重新加载建议；页面影响: 指导用户处理阻塞、容量或不支持场景。
    message: {
      type: String,
      default: '应用无法读取本地数据，请处理浏览器存储问题后重新加载。'
    }
  },

  // 类型: object；作用: 保存唯一用户恢复命令，不承担初始化重试或数据库状态。
  methods: {
    /**
     * 重新加载当前浏览器页面。
     * 触发来源: 用户点击“重新加载”按钮。
     * 副作用: 调用 window.location.reload()，释放当前模块图并重新执行完整启动链。
     * 成功路径: 浏览器开始页面导航，当前 Vue 实例随页面卸载释放。
     * 失败路径: 浏览器拒绝导航时保持当前失败页面，不修改数据库或 store。
     *
     * @returns {void}
     */
    handleReload() {
      // 浏览器副作用: 只执行标准页面重载，不在旧门面上隐式重试数据库初始化。
      window.location.reload();
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 启动失败根区域 `.startup-failure`。
  样式作用:
  占满首屏并建立居中布局，使正常 App 未挂载时仍有稳定、可读的故障反馈。
*/
.startup-failure {
  /* 使用 Border Box 让视口内边距计入稳定最小高度。 */
  box-sizing: border-box;

  /* 至少覆盖当前视口，避免失败说明只占页面顶部一小块。 */
  min-height: 100vh;

  /* 使用 Grid 把唯一内容区同时沿水平和垂直方向居中。 */
  display: grid;

  /* 让内容区处于可视区域中心，不依赖绝对定位或层级覆盖。 */
  place-items: center;

  /* 为窄屏和浏览器安全边缘保留稳定可读空间。 */
  padding: 32px 20px;

  /* 沿用应用全局浅色背景，表明这是同一产品的系统状态。 */
  background: var(--app-bg);

  /* 使用全局主文本色保证标题和说明具备一致对比度。 */
  color: var(--text-primary);
}

/*
  作用容器: 故障内容区 `.startup-failure__content`。
  样式作用:
  使用单列流和固定最大可读宽度组织信息，不绘制卡片或制造第二层应用外壳。
*/
.startup-failure__content {
  /* 允许内容在父级可用宽度内收缩，避免稳定错误码造成横向溢出。 */
  width: min(100%, 560px);

  /* 使用 Flex 单列组织图标、文本、错误码和命令。 */
  display: flex;

  /* 让全部故障元素按阅读顺序垂直排列。 */
  flex-direction: column;

  /* 让内容和命令保持统一水平中心。 */
  align-items: center;

  /* 居中正文，便于短说明在各视口快速扫描。 */
  text-align: center;
}

/*
  作用容器: 警告图标 `.startup-failure__icon`。
  样式作用:
  使用项目危险色标识启动失败，与主操作按钮形成明确的双色情绪层级。
*/
.startup-failure__icon {
  /* 使用固定图标尺寸提供清晰状态信号，不随视口宽度缩放。 */
  font-size: 48px;

  /* 使用全局危险色表达失败状态。 */
  color: var(--danger);
}

/*
  作用容器: 故障主标题 `.startup-failure__title`。
  样式作用:
  建立紧凑页面标题层级，并与上方图标保持稳定间距。
*/
.startup-failure__title {
  /* 与警告图标保持明确分组距离。 */
  margin: 20px 0 0;

  /* 使用页面级而非英雄级字号，避免故障界面夸张占屏。 */
  font-size: 28px;

  /* 提供中文标题稳定行高，换行时不遮挡说明。 */
  line-height: 1.35;

  /* 使用中等加粗建立标题优先级。 */
  font-weight: 600;

  /* 按项目要求保持自然字距。 */
  letter-spacing: 0;
}

/*
  作用容器: 用户处理说明 `.startup-failure__message`。
  样式作用:
  以次级文本层级承载针对性建议，并允许长句自然换行。
*/
.startup-failure__message {
  /* 与标题建立正文分组距离。 */
  margin: 16px 0 0;

  /* 使用正文可读字号，兼顾桌面和手机。 */
  font-size: 16px;

  /* 增加多行说明间距，避免中文长句拥挤。 */
  line-height: 1.7;

  /* 使用次级文本色降低与主标题的视觉竞争。 */
  color: var(--text-secondary);
}

/*
  作用容器: 稳定错误码 `.startup-failure__code`。
  样式作用:
  把诊断标识与用户说明区分，同时保证长错误码在手机端可换行。
*/
.startup-failure__code {
  /* 与说明文本保持独立诊断分组距离。 */
  margin-top: 14px;

  /* 为错误码提供紧凑但可点击选择的内边距。 */
  padding: 6px 10px;

  /* 使用柔和金色背景区分诊断信息，不重复主按钮蓝色。 */
  background: var(--gold-soft);

  /* 使用小圆角保持紧凑代码标签形态。 */
  border-radius: 6px;

  /* 使用固定等宽字号提升错误码字符辨识度。 */
  font-size: 13px;

  /* 保持错误码自然字距。 */
  letter-spacing: 0;

  /* 允许超长稳定错误码在窄屏按字符换行。 */
  overflow-wrap: anywhere;
}

/*
  作用容器: 重新加载按钮 `.startup-failure__reload`。
  样式作用:
  与错误码保持明确操作距离，并提供稳定最小点击宽度。
*/
.startup-failure__reload {
  /* 让主命令与诊断信息形成清晰分组。 */
  margin-top: 24px;

  /* 提供稳定点击目标宽度，按钮文字变化不会造成布局跳动。 */
  min-width: 132px;
}

/*
  适配目标: 宽度不超过 480px 的手机视口。
  影响组件: 启动失败根区域和标题。
  布局变化: 收紧页面边距与标题字号，保持无横向溢出和首屏可读。
*/
@media (max-width: 480px) {
  /*
    作用容器: 手机启动失败根区域 `.startup-failure`。
    样式作用: 收紧窄屏内边距，为长错误说明保留更多可用宽度。
  */
  .startup-failure {
    /* 手机使用更紧凑的首屏安全边距。 */
    padding: 24px 16px;
  }

  /*
    作用容器: 手机故障标题 `.startup-failure__title`。
    样式作用: 使用固定较小字号，避免中文标题在 390px 视口形成不必要的三行。
  */
  .startup-failure__title {
    /* 手机保持页面标题层级，同时避免按视口连续缩放。 */
    font-size: 24px;
  }
}
</style>
