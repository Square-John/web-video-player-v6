<template>
  <!--
    SourceDeleteDialog 组件渲染树

    [DEFAULT] ele(el-dialog.source-delete-dialog)
    │  - condition:
    │      默认渲染。
    │      visible 为 true 时显示删除确认弹窗，false 时隐藏弹窗。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-dialog
    │  - description:
    │      数据源删除确认弹窗。
    │      根据 sourceKind 解释系统源软删除和自定义源实际删除的不同影响。
    │  - params:
    │      -- visible：来源于 SourceDetailView，控制弹窗显示状态。
    │      -- dialogWidth：来源于 SETTINGS_DIALOG_WIDTH.standard，控制响应式宽度。
    │  - events:
    │      @close
    │          - description:
    │              Element UI 请求关闭弹窗时触发。
    │              只隐藏弹窗，不删除数据源。
    │          - methods:
    │              closeDialog()
    │
    ├─ [IF record] ele(div.source-delete-dialog__content)
    │  - condition:
    │      record 存在，表示详情页已经指定等待删除的数据源时渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      删除确认内容区。
    │      展示目标名称和按 sourceKind 派生的删除影响说明。
    │  - params:
    │      -- record.definition.name：等待删除的数据源名称。
    │      -- deleteDescription：系统源或自定义源对应的删除说明。
    │  - events:
    │      无
    │
    └─ [DEFAULT] ele(span.dialog-footer)
       │  - condition:
       │      默认渲染。
       │  - type:
       │      原生标签
       │      标签名称: span
       │  - description:
       │      删除弹窗底部操作区。
       │      承载取消和删除两个按钮。
       │  - params:
       │      无
       │  - events:
       │      无
       │
       ├─ [DEFAULT] ele(el-button.source-delete-dialog__cancel)
       │  - condition:
       │      默认渲染。
       │  - type:
       │      第三方组件
       │      组件库: Element UI
       │      组件名称: el-button
       │  - description:
       │      删除取消按钮。
       │      关闭弹窗且不修改数据源状态。
       │  - params:
       │      无
       │  - events:
       │      @click
       │          - description:
       │              用户点击“取消”时触发。
       │          - methods:
       │              closeDialog()
       │
       └─ [DEFAULT] ele(el-button.source-delete-dialog__confirm)
          - condition:
              默认渲染。
              record 缺失时方法内部阻止发送确认事件。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-button
          - description:
              删除确认按钮。
              发出 sourceId，实际删除和默认源交接由 SourceDetailView 协调。
          - params:
              无
          - events:
              @click
                  - description:
                      用户点击“删除”时触发。
                  - methods:
                      confirmDelete()
  -->
  <!--
    [DEFAULT] ele(el-dialog.source-delete-dialog)
    - condition:
        默认渲染。
        visible 为 true 时显示弹窗，false 时隐藏弹窗。
    - type:
        第三方组件
        组件库: Element UI
        组件名称: el-dialog
    - description:
        数据源删除确认弹窗根节点。
        组合删除影响说明和底部操作区。
    - params:
        -- visible：父页面控制的弹窗显示状态。
        -- dialogWidth：统一响应式弹窗宽度。
    - events:
        @close
            - description:
                Element UI 请求关闭弹窗时触发。
            - methods:
                closeDialog()
  -->
  <el-dialog
    class="source-delete-dialog"
    title="删除数据源"
    :visible="visible"
    :width="dialogWidth"
    :close-on-click-modal="false"
    @close="closeDialog"
  >
    <!--
      [IF record] ele(div.source-delete-dialog__content)
      - condition:
          record 存在时渲染删除目标和影响说明。
      - type:
          原生标签
          标签名称: div
      - description:
          删除确认内容区。
          展示目标名称和按数据源类型派生的删除结果。
      - params:
          -- record.definition.name：等待删除的数据源名称。
          -- deleteDescription：当前删除影响说明。
      - events:
          无
    -->
    <div v-if="record" class="source-delete-dialog__content">
      <!--
        [DEFAULT] ele(p.source-delete-dialog__title)
        - condition:
            record 存在时跟随内容区渲染。
        - type:
            原生标签
            标签名称: p
        - description:
            删除目标确认标题。
            显示 record.definition.name，帮助用户确认操作对象。
        - params:
            -- record.definition.name：等待删除的数据源名称。
        - events:
            无
      -->
      <p class="source-delete-dialog__title">确定删除“{{ record.definition.name }}”吗？</p>
      <!--
        [DEFAULT] ele(p.source-delete-dialog__description)
        - condition:
            record 存在时跟随内容区渲染。
        - type:
            原生标签
            标签名称: p
        - description:
            删除影响说明。
            根据 sourceKind 区分可恢复软删除和不可恢复的自定义源删除。
        - params:
            -- deleteDescription：当前记录对应的删除说明。
        - events:
            无
      -->
      <p class="source-delete-dialog__description">{{ deleteDescription }}</p>
    </div>

    <!--
      [DEFAULT] ele(span.dialog-footer)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: span
      - description:
          删除弹窗底部操作区。
          承载取消和删除确认按钮。
      - params:
          无
      - events:
          无
    -->
    <span slot="footer" class="dialog-footer">
      <!--
        [DEFAULT] ele(el-button.source-delete-dialog__cancel)
        - condition:
            默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            删除取消按钮。
            点击后关闭弹窗且不修改共享状态。
        - params:
            无
        - events:
            @click
                - description:
                    用户点击“取消”时触发。
                - methods:
                    closeDialog()
      -->
      <el-button class="source-delete-dialog__cancel" @click="closeDialog">取消</el-button>
      <!--
        [DEFAULT] ele(el-button.source-delete-dialog__confirm)
        - condition:
            默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            删除确认按钮。
            点击后把 sourceId 交给详情页协调删除。
        - params:
            无
        - events:
            @click
                - description:
                    用户点击“删除”时触发。
                - methods:
                    confirmDelete()
      -->
      <el-button class="source-delete-dialog__confirm" type="danger" @click="confirmDelete">删除</el-button>
    </span>
  </el-dialog>
</template>

<script>
/*
  SourceDeleteDialog.vue 模块说明

  - 文件职责:
      展示单条数据源删除确认，并解释系统源软删除与自定义源实际删除差异。
      只回传确认或取消事件，不直接删除记录、缓存或脚本。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      SOURCE_KIND: 自定义配置，区分系统软删除和自定义实际删除。
      SETTINGS_DIALOG_WIDTH: 自定义配置，提供响应式标准弹窗宽度。

  - 模块级常量:
      SYSTEM_DELETE_DESCRIPTION: string，系统源删除说明。
      CUSTOM_DELETE_DESCRIPTION: string，自定义源删除说明。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceDeleteDialog: 当前文件公开的组件或模块能力。
*/

import {
  // 导入来源: ../../services/settingsService。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 根据类型显示对应删除后果，不在模板硬编码 system 字符串。
  SOURCE_KIND
} from '../../services/settingsService';

import {
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_DIALOG_WIDTH 设置模块弹窗宽度配置。
  // 文件作用: 给删除确认弹窗提供桌面最大宽度和手机安全边距。
  SETTINGS_DIALOG_WIDTH
} from '../../config/settings-module.config';

// 类型: string。
// 作用: 告诉用户系统源删除只是从列表隐藏并可以恢复。

const SYSTEM_DELETE_DESCRIPTION = '删除后该系统源将从列表中隐藏，内置脚本仍保存在应用中，可以通过“恢复系统源”重新恢复。';

// 类型: string。
// 作用: 告诉用户自定义源删除会移除脚本和缓存，重新使用必须再次导入。

const CUSTOM_DELETE_DESCRIPTION = '删除后将移除该自定义脚本和对应缓存，重新使用时需要再次导入。';

export default {
  // 组件名称: SourceDeleteDialog。
  // 作用: 供 Vue Devtools、递归组件识别和运行时报错定位使用。
  name: 'SourceDeleteDialog',

  props: {
    // 类型: boolean。
    // 来源: SourceDetailView 的 deleteDialogVisible。
    // 作用: 控制删除确认弹窗显示状态。
    // true: 显示目标名称、删除影响和操作按钮。
    // false: 隐藏弹窗，不修改数据源状态。
    visible: { type: Boolean, default: false },
    // 类型: object|null。
    // 来源: SourceDetailView 从 SourceManagerState 派生的当前详情记录。
    // 作用: 提供删除目标名称、类型和 sourceId。
    // 字段: definition.id，string，交给详情页和 deleteSource() 定位删除记录。
    // 字段: definition.name，string，展示在删除确认标题中。
    // 字段: definition.sourceKind，string，决定展示系统源或自定义源删除说明。
    record: { type: Object, default: null }
  },

  computed: {
    /**
     * 读取删除确认弹窗响应式宽度。
     * 数据来源: SETTINGS_DIALOG_WIDTH.standard。
     * 该计算属性只读取冻结配置，不修改组件或共享状态。
     *
     * @returns {string} 桌面最大 520px、手机保留两侧安全边距的 CSS width 值。
     * 纯函数: dialogWidth 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    dialogWidth() {
      // 返回值类型: string。
      // 作用: 避免固定宽度在手机视口产生横向溢出。
      return SETTINGS_DIALOG_WIDTH.standard;
    },

    /**
     * 计算当前数据源删除说明。
     * 数据来源: record.definition.sourceKind 和两个模块级说明常量。
     * 该计算属性只派生用户文案，不修改 record 或共享状态。
     *
     * @returns {string} 系统软删除或自定义实际删除说明。
     * 纯函数: deleteDescription 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    deleteDescription() {
      // 条件分支: record 为空，表示弹窗尚未获得删除目标时进入。
      // 执行内容: 返回空字符串，避免模板读取空引用或展示错误说明。

      if (!this.record) return '';

      // 三目条件: 当前记录是否为系统源。
      // true 分支: 返回系统源软删除和可恢复说明。
      // false 分支: 返回自定义源脚本及缓存实际删除说明。
      return this.record.definition.sourceKind === SOURCE_KIND.system
        ? SYSTEM_DELETE_DESCRIPTION
        : CUSTOM_DELETE_DESCRIPTION;
    }
  },

  methods: {
    /**
     * 关闭删除确认弹窗。
     * 触发来源: el-dialog @close 或“取消”按钮。
     *
     * @returns {void} 不返回业务数据，也不删除数据源。
     * 副作用: closeDialog 会关闭当前交互并清理临时状态，并同步相关组件状态、路由或对外事件。
     */
    closeDialog() {
      // 事件: update:visible。
      // 参数: false，boolean，通知详情页隐藏删除弹窗。
      this.$emit('update:visible', false);
    },

    /**
     * 确认删除当前数据源。
     * 触发来源: 用户点击“删除”按钮。
     *
     * @returns {void} 删除目标通过事件参数传递，不直接返回结果。
 * 副作用: confirmDelete 会删除目标记录，并同步相关组件状态、路由或对外事件。
 */
    confirmDelete() {
      // 条件分支: record 为空，表示没有有效删除目标时进入。
      // 执行内容: 直接退出，避免发送 undefined sourceId。

      if (!this.record) return;

      // 事件: confirm。
      // 参数: definition.id，string，等待删除的数据源唯一标识。
      // 影响范围: SourceDetailView 接收后处理默认源交接并调用 deleteSource()。
      this.$emit('confirm', this.record.definition.id);

      // 执行内容: 确认事件发出后关闭弹窗，结束本次删除确认交互。
      this.closeDialog();
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 删除目标标题 `.source-delete-dialog__title`。
  样式作用:
  强化当前将被删除的数据源名称。
  与下方删除影响说明建立清晰层级。
*/
.source-delete-dialog__title {
  /* 清除段落默认外边距并保留下方说明间距。 */
  margin: 0 0 10px;
  /* 使用主题主文本色。 */
  color: var(--text-primary);
  /* 使用半粗字重突出删除目标。 */
  font-weight: 600;
}

/*
  作用容器: 删除影响说明 `.source-delete-dialog__description`。
  样式作用:
  解释系统源软删除或自定义源实际删除结果。
  使用次级视觉层级但保持多行可读性。
*/
.source-delete-dialog__description {
  /* 清除段落默认外边距。 */
  margin: 0;
  /* 使用主题次级文本色。 */
  color: var(--text-secondary);
  /* 增加行高，提升长说明可读性。 */
  line-height: 1.7;
}
</style>
