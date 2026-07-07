<template>
  <!--
    AppFooter 组件渲染树

    {footer.app-footer}
    └─ {p.app-footer__text}
       └─ 页脚应用名称说明
  -->
  <!--
    底部页脚。
    作用：放在应用最下方，承载项目基础说明。
  -->
  <footer class="app-footer">
    <!-- 页脚说明，帮助用户识别当前应用定位。 -->
    <p class="app-footer__text">Web Video Player</p>
  </footer>
</template>

<script>
export default {
  // 组件名称用于在调试工具和报错信息中识别底部页脚组件。
  name: 'AppFooter'
};
</script>

<style scoped>
/*
  页脚整体容器。
  对应 template 中的 `.app-footer`，负责页面底部的辅助信息展示。
*/
.app-footer {
  /* 使用 flex 控制页脚内容的横向布局。 */
  display: flex;

  /* 将页脚说明放在容器左侧，保持页面底部阅读起点稳定。 */
  justify-content: flex-start;

  /* 垂直方向居中页脚文字。 */
  align-items: center;

  /* 给页脚留出舒适的内边距。 */
  padding: 18px 32px;

  /* 顶部边线用于分隔主体内容和页脚。 */
  border-top: 1px solid #e6eaf0;

  /* 使用浅灰背景，让页脚区域和主体内容分开。 */
  background: #f8fafc;

  /* 统一字体，保证页脚文字和页面其他区域一致。 */
  font-family: Arial, Helvetica, sans-serif;
}

/*
  页脚普通说明文字。
  对应 template 中的 `.app-footer__text`，显示项目名称。
*/
.app-footer__text {
  /* 清掉段落默认外边距，避免页脚高度被默认样式撑大。 */
  margin: 0;

  /* 使用较小字号，让页脚保持辅助信息的视觉层级。 */
  font-size: 14px;

  /* 使用中性色，避免页脚比主体内容更抢眼。 */
  color: #667085;
}

</style>
