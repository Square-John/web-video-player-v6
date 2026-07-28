<template>
  <!--
    SourceChallengeDialog 组件渲染树

    [DEFAULT] ele(el-dialog.source-challenge-dialog)
    │  - condition: 根组件始终挂载；visible 由当前活动 challenge 是否存在决定。
    │  - type: 第三方组件，来源 element-ui ElDialog。
    │  - description: 全局承载 Provider 人工验证码、登录或同意输入，不识别具体站点。
    │  - params: visible 控制显示；dialogTitle 来自挑战标题；before-close 把遮罩和关闭按钮统一转换为取消。
    │  - events: before-close 调用 handleDialogClose(done)。
    │
    ├─ [IF challenge.image] ele(img.source-challenge-dialog__image)
    │  - condition: 当前挑战提供经过 Shell 校验的安全图片地址时渲染。
    │  - type: 原生标签 img。
    │  - description: 展示验证码或挑战说明图片。
    │  - params: src 来自 challenge.image；alt 使用 dialogTitle。
    │  - events: 无。
    │
    ├─ [IF challenge] ele(el-form.source-challenge-dialog__form)
    │  - condition: 存在活动挑战时渲染。
    │  - type: 第三方组件，来源 element-ui ElForm。
    │  - description: 按通用 fields 顺序渲染用户输入，不接受 Provider 自定义组件。
    │  - params: model 为当前组件局部 formValues。
    │  - events: submit.prevent 调用 handleSubmit()。
    │  │
    │  └─ [FOR field in challenge.fields] ele(el-form-item)
    │     - condition: 对每个标准字段声明渲染一次。
    │     - type: 第三方组件，来源 element-ui ElFormItem。
    │     - description: 提供字段标签、必填提示和输入容器。
    │     - params: key/name/label/required 来自冻结字段声明。
    │     - events: 无。
    │        └─ [DEFAULT] ele(el-input)
    │           - condition: 字段项存在时默认渲染。
    │           - type: 第三方组件，来源 element-ui ElInput。
    │           - description: 收集 text 或 password 字符串。
    │           - params: value 来自 formValues[field.name]；type 和 placeholder 来自字段声明。
    │           - events: input 调用 handleFieldInput(field.name, value)。
    │
    └─ [DEFAULT] ele(div.source-challenge-dialog__actions)
       - condition: 弹窗渲染时默认显示。
       - type: 原生标签 div。
       - description: 提供取消和提交两个明确命令。
       - params: submitting 控制按钮禁用和提交加载态。
       - events: 取消调用 handleCancel()；提交调用 handleSubmit()。
  -->
  <!--
    [DEFAULT] ele(el-dialog.source-challenge-dialog)
    - condition: 根组件始终挂载；visible 由活动挑战决定。
    - type: 第三方组件，来源 element-ui ElDialog。
    - description: 应用唯一人工挑战弹窗，关闭动作统一回传 cancelled。
    - params: dialogTitle、visible、before-close 和响应式宽度共同控制展示。
    - events: before-close 调用 handleDialogClose(done)。
  -->
  <el-dialog
    class="source-challenge-dialog"
    :title="dialogTitle"
    :visible="visible"
    :before-close="handleDialogClose"
    :close-on-press-escape="!submitting"
    :close-on-click-modal="!submitting"
    :show-close="!submitting"
    width="min(92vw, 440px)"
    append-to-body
  >
    <!--
      [IF challenge.image] ele(img.source-challenge-dialog__image)
      - condition: Shell 已验证 challenge.image 非空且协议安全时渲染。
      - type: 原生标签 img。
      - description: 展示当前挑战图片并限制在弹窗内容宽度内。
      - params: src 来自 challenge.image；alt 来自 dialogTitle。
      - events: 无。
    -->
    <img
      v-if="challenge && challenge.image"
      class="source-challenge-dialog__image"
      :src="challenge.image"
      :alt="dialogTitle"
    >

    <!--
      [IF challenge] ele(el-form.source-challenge-dialog__form)
      - condition: 存在活动挑战时渲染字段列表。
      - type: 第三方组件，来源 element-ui ElForm。
      - description: 按字段契约顺序收集局部输入，不保存到 store 或 Repository。
      - params: model 使用 formValues；label-position 在窄弹窗中保持顶部标签。
      - events: submit.prevent 调用 handleSubmit()。
    -->
    <el-form
      v-if="challenge"
      class="source-challenge-dialog__form"
      :model="formValues"
      label-position="top"
      @submit.native.prevent="handleSubmit"
    >
      <!--
        [FOR field in challenge.fields] ele(el-form-item)
        - condition: challenge.fields 非空数组中的每个标准字段渲染一次；空数组已被 Shell 拒绝。
        - type: 第三方组件，来源 element-ui ElFormItem。
        - description: 显示字段标签和必填语义。
        - params: key/name 使用安全唯一 field.name；label/required 来自字段声明。
        - events: 无。
      -->
      <el-form-item
        v-for="field in challenge.fields"
        :key="field.name"
        :label="field.label || field.name"
        :required="field.required"
      >
        <!--
          [DEFAULT] ele(el-input)
          - condition: 每个受支持 text/password 字段默认渲染。
          - type: 第三方组件，来源 element-ui ElInput。
          - description: 收集当前字段字符串并保持输入仅存在组件局部状态。
          - params: type/placeholder 来自字段声明；value 来自 formValues 对应键。
          - events: input 调用 handleFieldInput(field.name, value)。
        -->
        <el-input
          :value="formValues[field.name]"
          :type="field.type"
          :placeholder="field.placeholder"
          :disabled="submitting"
          autocomplete="off"
          @input="handleFieldInput(field.name, $event)"
        />
      </el-form-item>
    </el-form>

    <!--
      [DEFAULT] ele(div.source-challenge-dialog__actions)
      - condition: 弹窗内容默认渲染操作区。
      - type: 原生标签 div。
      - description: 提供取消和提交命令，不展示内部 challengeId 或续接键。
      - params: submitting 控制两个按钮的禁用和加载状态。
      - events: 取消调用 handleCancel()；提交调用 handleSubmit()。
    -->
    <div class="source-challenge-dialog__actions">
      <el-button :disabled="submitting" @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
    </div>
  </el-dialog>
</template>

<script>
/*
  SourceChallengeDialog.vue 模块说明

  - 文件职责:
      订阅应用唯一挑战交互服务，并把标准字段声明渲染为根级人工输入弹窗。
      用户输入只保存在组件局部状态，提交或取消后由协调器恢复原 Provider 请求。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      sourceChallengeService: 自定义 service，提供活动挑战订阅、提交和取消入口。

  - 模块级常量:
      DEFAULT_DIALOG_TITLE: string，挑战没有标题时的通用展示标题。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createFormValues(challenge): Function，按字段声明创建局部字符串表单。

  - 模块级类:
      无

  - 对外导出:
      SourceChallengeDialog: Vue 组件配置，供 App 根组件唯一挂载。
*/

// 导入来源: ../../services/sourceChallengeService.js。
// 导入内容: sourceChallengeService 应用挑战交互服务。
// 文件作用: 组件不直接依赖 Runtime、Provider、Context 或 Repository。
import { sourceChallengeService } from '../../services/sourceChallengeService.js';

// 类型: string。
// 作用: 当 Provider 未提供标题时保持弹窗用途清晰，不加入站点专用文案。
const DEFAULT_DIALOG_TITLE = '需要完成验证';

/**
 * 按当前挑战字段声明创建局部表单值。
 * 纯函数: 返回新普通对象，不修改冻结 challenge 或 fields。
 * 成功路径: 每个声明字段初始化为空字符串，字段顺序不影响对象语义。
 * 失败路径: challenge 为 null 时返回空对象，订阅采用过程不抛错。
 *
 * @param {object|null} challenge 当前活动 SourceChallenge。
 * @returns {object} 只含声明字段键的局部字符串表单。
 */
function createFormValues(challenge) {
  // 条件分支: 当前没有活动挑战时进入。
  // 执行内容: 返回空局部表单并保持弹窗关闭。
  if (!challenge) return {};

  // 返回值类型: object。
  // 作用: 根据 Shell 已验证的安全唯一字段名建立 Vue 可观察对象。
  return challenge.fields.reduce((values, field) => {
    // 副作用范围: 只写入当前新建 values，不修改 challenge 字段声明。
    values[field.name] = '';
    return values;
  }, {});
}

export default {
  // 类型: string；作用: 供 Vue Devtools 和错误堆栈识别全局挑战组件。
  name: 'SourceChallengeDialog',

  /**
   * 创建组件局部状态。
   * 副作用: 只创建当前组件实例的局部响应式初值，不订阅服务或写外部状态。
   * 每个根组件实例维护独立挑战快照、表单、提交态和取消订阅句柄。
   *
   * @returns {object} Vue 响应式 data。
   */
  data() {
    return {
      // 类型: object|null；来源: sourceChallengeService 订阅；作用: 决定弹窗和字段渲染。
      challenge: null,
      // 类型: object；来源: createFormValues；作用: 只保存当前弹窗未提交字符串。
      formValues: {},
      // 类型: boolean；false 允许输入和关闭，true 阻止重复提交与取消；由 handleSubmit 修改。
      submitting: false,
      // 类型: Function|null；来源: service.subscribe；作用: 组件销毁时释放全局订阅。
      unsubscribeChallenge: null
    };
  },

  computed: {
    /**
     * 派生弹窗显示状态。
     * 纯函数: 只读取 challenge，不修改组件或外部状态。
     *
     * @returns {boolean} true 表示存在活动挑战并显示弹窗，false 表示关闭。
     */
    visible() {
      return this.challenge !== null;
    },

    /**
     * 派生当前弹窗标题。
     * 纯函数: 只读取 challenge.title，不修改组件或外部状态。
     *
     * @returns {string} Provider 标题或通用后备标题。
     */
    dialogTitle() {
      return this.challenge?.title || DEFAULT_DIALOG_TITLE;
    }
  },

  /**
   * 组件挂载后订阅全局挑战。
   * 副作用: 注册应用生命周期交互监听器；每次发布完整替换 challenge 和局部表单。
   * 失败路径: service 拒绝订阅时异常交给 Vue 错误处理，不创建轮询或第二事件源。
   *
   * @returns {void}
   */
  mounted() {
    this.unsubscribeChallenge = sourceChallengeService.subscribe((challenge) => {
      // 副作用: 完整采用协调器冻结快照；null 关闭弹窗并清空用户输入。
      this.challenge = challenge;
      this.formValues = createFormValues(challenge);
      this.submitting = false;
    });
  },

  /**
   * 组件销毁前释放挑战订阅。
   * 副作用: 最后一个交互订阅移除时协调器把全部在途请求收敛为 cancelled。
   *
   * @returns {void}
   */
  beforeDestroy() {
    // 条件分支: 订阅句柄存在时进入。
    // 执行内容: 幂等取消并清空局部引用，避免根组件重建后残留监听器。
    if (this.unsubscribeChallenge) {
      this.unsubscribeChallenge();
      this.unsubscribeChallenge = null;
    }
  },

  methods: {
    /**
     * 更新一个字段的局部输入。
     * 触发来源: ElInput input 事件。
     * 副作用: 使用 Vue.set 更新当前局部表单；不写 store、日志或持久化空间。
     *
     * @param {string} fieldName 当前标准字段名。
     * @param {string} value ElInput 返回的字符串。
     * @returns {void}
     */
    handleFieldInput(fieldName, value) {
      this.$set(this.formValues, fieldName, value);
    },

    /**
     * 提交当前挑战表单。
     * 触发来源: 表单 submit 或主按钮点击。
     * 副作用: 短暂设置 submitting，并通过 service 兑现原 Provider Promise。
     * 成功路径: 协调器发布下一项或 null，订阅回调重置本地状态。
     * 失败路径: 字段校验错误通过 Element UI 展示，当前挑战和输入保持可修正。
     *
     * @returns {void}
     */
    handleSubmit() {
      // 条件分支: 没有挑战或正在提交时进入。
      // 执行内容: 阻止迟到点击和重复提交。
      if (!this.challenge || this.submitting) return;

      this.submitting = true;
      try {
        sourceChallengeService.resolve(this.challenge.challengeId, this.formValues);
      } catch (error) {
        // 异常来源: 字段值或挑战身份不符合协调器契约。
        // 处理策略: 保留当前输入，展示安全错误文案，不读取错误 code 之外的内部状态。
        this.$message.error(error.message || '验证信息无法提交');
        this.submitting = false;
      }
    },

    /**
     * 取消当前挑战。
     * 触发来源: 取消按钮或 ElDialog 关闭流程。
     * 副作用: 通过 service 把原 Provider Promise 收敛为 cancelled。
     * 失败路径: 迟到取消由协调器拒绝，订阅发布仍决定最终可见状态。
     *
     * @returns {void}
     */
    handleCancel() {
      // 条件分支: 没有挑战或正在提交时进入。
      // 执行内容: 不取消下一项或打断已提交事务。
      if (!this.challenge || this.submitting) return;

      try {
        sourceChallengeService.cancel(this.challenge.challengeId);
      } catch (error) {
        // 异常来源: 当前活动挑战已经由 Host 中止或其他动作完成。
        // 处理策略: 清空局部快照；协调器已经拥有最终状态，不创建补偿请求。
        this.challenge = null;
        this.formValues = {};
      }
    },

    /**
     * 把 ElDialog 关闭动作转换为正式取消。
     * 触发来源: 关闭按钮、遮罩或 Escape。
     * 副作用: 调用 handleCancel；完成后让 Element UI 结束关闭动画。
     *
     * @param {Function} done Element UI 关闭完成回调。
     * @returns {void}
     */
    handleDialogClose(done) {
      this.handleCancel();
      done();
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 挑战图片 `.source-challenge-dialog__image`。
  样式作用: 在不裁切验证码内容的前提下限制图片宽度，避免撑出弹窗。
*/
.source-challenge-dialog__image {
  /* 图片最多使用弹窗内容宽度，窄视口不会产生水平滚动。 */
  max-width: 100%;
  /* 保持原始宽高比，不把验证码拉伸变形。 */
  height: auto;
  /* 块级显示以便使用自动外边距居中。 */
  display: block;
  /* 图片在内容区水平居中，并与下方表单保持稳定间距。 */
  margin: 0 auto 16px;
}

/*
  作用容器: 挑战表单 `.source-challenge-dialog__form`。
  样式作用: 清除第三方表单默认外部间距，让操作区统一控制尾部节奏。
*/
.source-challenge-dialog__form {
  /* 表单末尾不额外增加空白，操作区负责与字段列表分隔。 */
  margin: 0;
}

/*
  作用容器: 弹窗命令区 `.source-challenge-dialog__actions`。
  样式作用: 让取消与提交按钮右对齐，并保持可扫描的按钮间距。
*/
.source-challenge-dialog__actions {
  /* 使用 Flex 组织两个命令，按钮文本变化不会改变主轴规则。 */
  display: flex;
  /* 命令靠右放置，符合确认弹窗的操作顺序。 */
  justify-content: flex-end;
  /* 使用项目常用紧凑间距分隔相邻按钮。 */
  gap: 8px;
  /* 与最后一个输入字段建立清晰的垂直分隔。 */
  margin-top: 20px;
}
</style>
