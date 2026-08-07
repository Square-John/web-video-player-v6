<template>
  <!--
    GuestLoginDialog 登录弹窗
    作用：只提供当前版本 guest 模拟登录入口；注册标签明确禁用，不连接真实认证系统。
  -->
  <el-dialog
    title="欢迎使用"
    :visible="visible"
    width="min(420px, calc(100vw - 32px))"
    append-to-body
    @close="handleClose"
  >
    <!-- 顶部说明固定告知当前版本的可用模拟凭据。 -->
    <p class="guest-login-dialog__hint">当前版本请使用用户名 guest，密码留空登录。</p>

    <el-tabs v-model="activeTab" stretch>
      <!-- 当前版本唯一可操作的登录标签。 -->
      <el-tab-pane label="登录" name="login">
        <form class="guest-login-dialog__form" @submit.prevent="handleSubmit">
          <el-input
            v-model.trim="username"
            autocomplete="username"
            placeholder="请输入用户名"
            aria-label="用户名"
          />
          <el-input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            aria-label="密码"
            @keyup.enter.native="handleSubmit"
          />
          <p v-if="errorMessage" class="guest-login-dialog__error" role="alert">{{ errorMessage }}</p>
          <el-button type="primary" native-type="submit" :loading="submitting">登录</el-button>
        </form>
      </el-tab-pane>
      <!-- 注册能力尚未实现，禁用切换避免用户进入无效页面。 -->
      <el-tab-pane label="注册·暂未开放" name="register" disabled></el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script>
/*
  GuestLoginDialog.vue 模块说明

  - 文件职责:
      展示 guest 模拟登录说明、输入表单和禁用注册标签。
      成功后只发出 login-success，父级负责关闭弹窗和更新导航；组件不读取用户内容 Store。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      loginGuest: 自定义模拟会话命令，验证 guest 用户名和空密码并更新唯一内存状态。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      GuestLoginDialog: Vue component，供 AppNavbar 渲染模拟登录弹窗。
*/

// 导入来源: ../../services/guestSessionService.js。
// 导入内容: loginGuest 模拟登录命令。
// 文件作用: 表单提交后只更新应用唯一内存会话，不创建组件私有认证状态。
import { loginGuest } from '../../services/guestSessionService.js';

export default {
  // 组件名称：GuestLoginDialog；用途：导航登录按钮打开的 guest 模拟登录弹窗。
  name: 'GuestLoginDialog',

  props: {
    // 类型: boolean；来源: AppNavbar；true 显示弹窗，false 隐藏弹窗。
    visible: {
      type: Boolean,
      default: false
    }
  },

  /**
   * 创建登录弹窗局部表单状态。
   * 纯函数: 每个组件实例返回独立输入、错误和提交状态，不读取用户内容或浏览器存储。
   *
   * @returns {object} guest 登录表单局部状态。
   */
  data() {
    return {
      // 类型: string；作用: 登录弹窗当前 tab，注册 tab 固定禁用。
      activeTab: 'login',
      // 类型: string；作用: 保存输入用户名，默认符合当前版本 guest 说明。
      username: 'guest',
      // 类型: string；作用: 保存空密码输入，提交时必须保持空字符串。
      password: '',
      // 类型: string；作用: 保存当前版本可读登录失败说明。
      errorMessage: '',
      // 类型: boolean；作用: 防止重复提交模拟登录命令。
      submitting: false
    };
  },

  methods: {
    /**
     * 关闭登录弹窗。
     * 副作用: 通知父级隐藏弹窗并清理当前表单错误。
     *
     * @returns {void} 关闭事件发出后结束。
     */
    handleClose() {
      this.errorMessage = '';
      this.$emit('close');
    },

    /**
     * 提交 guest 模拟登录。
     * 副作用: 委托 guestSessionService 校验；成功发出 login-success，失败只显示错误不改状态。
     *
     * @returns {void} 当前同步登录命令完成后结束。
     */
    handleSubmit() {
      // 条件分支: 已经在提交时进入。
      // 执行内容: 阻止重复事件创建多个会话结果。
      if (this.submitting) return;

      // 副作用: 开始当前表单同步提交，按钮进入 loading 状态。
      this.submitting = true;
      // 类型: boolean；作用: 读取服务对 guest 用户名和空密码的正式判定结果。
      const accepted = loginGuest({ username: this.username, password: this.password });
      // 副作用: 同步命令已完成，恢复按钮交互。
      this.submitting = false;

      // 条件分支: 凭据通过当前版本 guest 规则时进入。
      // 执行内容: 清理错误并通知父级收起弹窗。
      if (accepted) {
        this.errorMessage = '';
        this.$emit('login-success');
        return;
      }

      // 副作用: 保存安全文案，不暴露服务内部异常或用户内容状态。
      this.errorMessage = '当前版本仅支持用户名 guest 且密码留空。';
    }
  }
};
</script>

<style scoped>
/* 登录弹窗提示说明，保持辅助层级并与现有主题色一致。 */
.guest-login-dialog__hint {
  margin: 0 0 16px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
}

/* 登录表单纵向排列输入、错误和提交按钮。 */
.guest-login-dialog__form {
  display: grid;
  gap: 12px;
}

/* 登录失败说明使用主题错误色，但不展示内部错误对象。 */
.guest-login-dialog__error {
  margin: 0;
  color: #b42318;
  font-size: 13px;
  line-height: 1.5;
}
</style>
