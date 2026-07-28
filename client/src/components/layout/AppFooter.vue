<template>
  <!--
    AppFooter 全站页脚组件渲染树

    [DEFAULT] ele(footer.app-footer)
    │  - condition:
    │      默认渲染。
    │      应用外壳在非播放页和播放页都挂载页脚。
    │  - type:
    │      原生标签
    │      标签名称: footer
    │  - description:
    │      全站页脚。
    │      展示项目年份、项目名称和内容来源边界说明。
    │  - params: 无
    │  - events: 无
    │
    └─ [DEFAULT] ele(div.app-footer__content)
       - condition:
           默认渲染。
       - type:
           原生标签
           标签名称: div
       - description:
           页脚内容容器。
           居中承载版权信息和内容来源说明。
       - params: 无
       - events: 无
  -->
  <!--
    底部页脚。
    作用：放在应用最下方，承载项目名称、年份和内容来源说明。
  -->
  <footer class="app-footer">
    <!-- 页脚内容容器，负责把版权行和说明文字集中居中。 -->
    <div class="app-footer__content">
      <!-- 版权信息，作为页面底部最基础的项目识别文字。 -->
      <p class="app-footer__copyright">&copy; 2026 Web Video Player</p>

      <!-- 内容来源说明，视觉层级低于版权信息。 -->
      <p class="app-footer__disclaimer">
        本项目提供播放器、数据源管理与资源聚合能力，视频内容由用户自备数据源提供。
      </p>
    </div>
  </footer>
</template>

<script>
/*
  AppFooter.vue 模块说明

  - 文件职责:
      渲染全站底部资源边界和项目说明。
      作为纯展示页脚，不读取页面数据或发布交互事件。

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
      AppFooter: Vue 布局组件，由 App.vue 在普通页面外壳底部渲染。
*/

export default {
  // 组件名称用于在调试工具和报错信息中识别全站页脚组件。
  name: 'AppFooter'
};
</script>

<style scoped>
/*
  作用容器: `.app-footer`。
  样式作用:
  全站页脚外层。
  对应 template 根节点 `.app-footer`，负责页面底部的深色收尾区域。
*/
.app-footer {
  /* 深色渐变背景和后续导航栏回归方向保持一致，让页面有明确收尾。 */
  background: linear-gradient(135deg, #172133 0%, #202c42 100%);

  /* 页脚文字放在深色背景上，所以使用浅色作为基础文字色。 */
  color: #f8fbff;

  /* 上下内边距控制页脚高度，让文字不贴近页脚边缘。 */
  padding: 18px 0 20px;

  /* 顶部细线把页脚和上方主体内容分隔开。 */
  border-top: 1px solid rgba(255, 255, 255, 0.06);

  /* 横向占满页面，保证页脚背景完整铺开。 */
  width: 100%;
}

/*
  作用容器: `.app-footer__content`。
  样式作用:
  页脚内容容器。
  对应 template 中的 `.app-footer__content`，负责居中展示两行说明文字。
*/
.app-footer__content {
  /* 页脚文字居中，符合底部说明区域的常见阅读习惯。 */
  text-align: center;

  /* 基础字号略小于正文，避免页脚抢主体内容注意力。 */
  font-size: 13px;
}

/*
  作用容器: `.app-footer__copyright`。
  样式作用:
  版权信息。
  对应 template 中的 `.app-footer__copyright`，显示年份和项目名称。
*/
.app-footer__copyright {
  /* 清掉段落默认外边距，避免页脚高度被浏览器默认样式撑大。 */
  margin: 0;

  /* 版权行使用较亮文字，作为页脚中的主要信息。 */
  color: #f8fbff;
}

/*
  作用容器: `.app-footer__disclaimer`。
  样式作用:
  内容来源说明。
  对应 template 中的 `.app-footer__disclaimer`，显示项目能力和内容来源边界。
*/
.app-footer__disclaimer {
  /* 和版权行拉开一点距离，避免两段文字粘在一起。 */
  margin: 6px 0 0;

  /* 说明文字更小，表示它是补充信息。 */
  font-size: 11px;

  /* 半透明浅色降低视觉权重，但仍能在深色背景上读清楚。 */
  color: rgba(219, 228, 239, 0.64);
}
</style>
