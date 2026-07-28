<template>
  <!--
    RestoreSystemSourcesDialog 组件渲染树

    [DEFAULT] ele(el-dialog.restore-system-sources-dialog)
    │  - condition:
    │      默认渲染。
    │      visible 为 true 时由 Element UI 显示弹窗内容，false 时保留组件但隐藏弹窗。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-dialog
    │  - description:
    │      恢复系统源对话框。
    │      承载已软删除系统源选择、空状态和恢复确认操作。
    │  - params:
    │      -- visible：来源于 SourceManagementPanel，控制弹窗显示状态。
    │      -- dialogWidth：来源于 SETTINGS_DIALOG_WIDTH.standard，控制桌面最大宽度和手机安全边距。
    │  - events:
    │      @close
    │          - description:
    │              用户点击关闭图标、取消按钮或由 Element UI 结束弹窗时触发。
    │              只通知父页面隐藏弹窗，不修改系统源恢复状态。
    │          - methods:
    │              closeDialog()
    │
    ├─ [IF records.length] ele(el-checkbox-group.restore-system-dialog__list)
    │  │  - condition:
    │  │      records 至少包含一条已软删除系统源记录时渲染。
    │  │  - type:
    │  │      第三方组件
    │  │      组件库: Element UI
    │  │      组件名称: el-checkbox-group
    │  │  - description:
    │  │      已删除系统源选择组。
    │  │      通过 selectedSourceIds 保存用户准备恢复的数据源 id。
    │  │  - params:
    │  │      -- records：来源于 SourceManagementPanel 的已软删除系统源记录数组。
    │  │      -- selectedSourceIds：组件局部选择结果，通过 v-model 双向绑定。
    │  │  - events:
    │  │      无
    │  │
    │  └─ [DEFAULT] ele(el-checkbox.restore-system-dialog__item)
    │     - condition:
    │         records 中每一条 record 循环渲染一个复选项。
    │     - type:
    │         第三方组件
    │         组件库: Element UI
    │         组件名称: el-checkbox
    │     - description:
    │         单个已删除系统源选项。
    │         展示数据源名称和版本，并使用 definition.id 作为选择值。
    │     - params:
    │         -- record.definition.id：系统源唯一标识，用于恢复 service 定位记录。
    │         -- record.definition.name：系统源名称，用于选项文案。
    │         -- record.definition.version：系统源脚本版本，用于辅助用户识别。
    │     - events:
    │         无
    │
    ├─ [ELSE] ele(el-empty.restore-system-dialog__empty)
    │  - condition:
    │      records 为空，表示当前没有已软删除系统源时渲染。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-empty
    │  - description:
    │      系统源恢复空状态。
    │      明确提示所有系统源均已存在，避免弹窗主体显示空白。
    │  - params:
    │      -- emptyImageSize：由 EMPTY_IMAGE_SIZE 派生的插图尺寸。
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
       │      恢复弹窗底部操作区。
       │      承载关闭按钮和条件显示的恢复按钮。
       │  - params:
       │      无
       │  - events:
       │      无
       │
       ├─ [DEFAULT] ele(el-button.restore-system-dialog__close)
       │  - condition:
       │      默认渲染。
       │  - type:
       │      第三方组件
       │      组件库: Element UI
       │      组件名称: el-button
       │  - description:
       │      恢复弹窗关闭按钮。
       │      允许用户退出恢复流程且不修改共享状态。
       │  - params:
       │      无
       │  - events:
       │      @click
       │          - description:
       │              用户点击“关闭”时触发。
       │          - methods:
       │              closeDialog()
       │
       └─ [IF records.length] ele(el-button.restore-system-dialog__confirm)
          - condition:
              records 至少包含一条可恢复系统源时渲染。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-button
          - description:
              恢复所选确认按钮。
              selectedSourceIds 为空时禁用，避免发送空恢复请求。
          - params:
              -- selectedSourceIds.length：控制按钮禁用状态。
          - events:
              @click
                  - description:
                      用户点击“恢复所选”且按钮可用时触发。
                  - methods:
                      confirmRestore()
  -->
  <!--
    [DEFAULT] ele(el-dialog.restore-system-sources-dialog)
    - condition:
        默认渲染。
        visible 为 true 时显示弹窗，false 时隐藏弹窗。
    - type:
        第三方组件
        组件库: Element UI
        组件名称: el-dialog
    - description:
        恢复系统源对话框根节点。
        组合选择列表、空状态和底部操作区。
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
    class="restore-system-sources-dialog"
    title="恢复系统源"
    :visible="visible"
    :width="dialogWidth"
    :close-on-click-modal="false"
    @close="closeDialog"
  >
    <!--
      [IF records.length] ele(el-checkbox-group.restore-system-dialog__list)
      - condition:
          records 至少包含一条已软删除系统源记录时渲染。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-checkbox-group
      - description:
          已删除系统源选择组。
          通过 v-model 保存用户准备恢复的系统源 id。
      - params:
          -- records：已软删除系统源记录数组。
          -- selectedSourceIds：当前勾选的系统源 id 数组。
      - events:
          无
    -->
    <el-checkbox-group v-if="records.length" v-model="selectedSourceIds" class="restore-system-dialog__list">
      <!--
        [DEFAULT] ele(el-checkbox.restore-system-dialog__item)
        - condition:
            records 中每一条 record 循环渲染一个复选项。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-checkbox
        - description:
            单个已删除系统源选项。
            展示名称和版本，并把 definition.id 写入 selectedSourceIds。
        - params:
            -- record.definition.id：系统源唯一标识和复选项值。
            -- record.definition.name：系统源名称。
            -- record.definition.version：系统源脚本版本。
        - events:
            无
      -->
      <el-checkbox
        v-for="record in records"
        :key="record.definition.id"
        :label="record.definition.id"
      >
        {{ record.definition.name }} · {{ record.definition.version }}
      </el-checkbox>
    </el-checkbox-group>

    <!--
      [ELSE] ele(el-empty.restore-system-dialog__empty)
      - condition:
          records 为空时渲染，作为前一选择组的兜底分支。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-empty
      - description:
          系统源恢复空状态。
          提示当前没有需要恢复的系统源。
      - params:
          -- emptyImageSize：统一空状态插图尺寸。
      - events:
          无
    -->
    <el-empty
      v-else
      class="restore-system-dialog__empty"
      description="所有系统源均已存在"
      :image-size="emptyImageSize"
    />

    <!--
      [DEFAULT] ele(span.dialog-footer)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: span
      - description:
          恢复弹窗底部操作区。
          提供关闭和恢复所选两个操作入口。
      - params:
          -- records.length：决定恢复按钮是否渲染。
          -- selectedSourceIds.length：决定恢复按钮是否禁用。
      - events:
          @click
              - description:
                  用户点击底部按钮时触发关闭或恢复操作。
              - methods:
                  closeDialog()
                  confirmRestore()
    -->
    <span slot="footer" class="dialog-footer">
      <!--
        [DEFAULT] ele(el-button.restore-system-dialog__close)
        - condition:
            默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            恢复弹窗关闭按钮。
            点击后退出恢复流程且不修改系统源状态。
        - params:
            无
        - events:
            @click
                - description:
                    用户点击“关闭”时触发。
                - methods:
                    closeDialog()
      -->
      <el-button class="restore-system-dialog__close" @click="closeDialog">关闭</el-button>
      <!--
        [IF records.length] ele(el-button.restore-system-dialog__confirm)
        - condition:
            records 至少包含一条可恢复系统源时渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            恢复所选确认按钮。
            selectedSourceIds 为空时保持禁用。
        - params:
            -- selectedSourceIds.length：控制按钮禁用状态。
        - events:
            @click
                - description:
                    用户点击按钮且至少选择一个系统源时触发。
                - methods:
                    confirmRestore()
      -->
      <el-button
        v-if="records.length"
        class="restore-system-dialog__confirm"
        type="primary"
        :disabled="!selectedSourceIds.length"
        @click="confirmRestore"
      >
        恢复所选
      </el-button>
    </span>
  </el-dialog>
</template>

<script>
/*
  RestoreSystemSourcesDialog.vue 模块说明

  - 文件职责:
      展示已软删除系统源的多选恢复确认流程，并维护弹窗内的临时选择。
      只通过 confirm 事件提交待恢复 id，不直接修改系统源记录或软删除集合。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SETTINGS_DIALOG_WIDTH: 自定义配置，提供响应式标准弹窗宽度。

  - 模块级常量:
      EMPTY_IMAGE_SIZE: number，无已删除系统源时的插图尺寸。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      RestoreSystemSourcesDialog: 当前文件公开的组件或模块能力。
*/

import {
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_DIALOG_WIDTH 设置模块弹窗宽度配置。
  // 文件作用: 给恢复系统源弹窗提供桌面最大宽度和手机安全边距。
  SETTINGS_DIALOG_WIDTH
} from '../../config/settings-module.config';

// 类型: number。
// 作用: 控制没有已删除系统源时 el-empty 的插图尺寸，避免模板直接使用魔法数字。

const EMPTY_IMAGE_SIZE = 88;

export default {
  // 组件名称: RestoreSystemSourcesDialog。
  // 作用: 供 Vue Devtools、递归组件识别和运行时报错定位使用。
  name: 'RestoreSystemSourcesDialog',

  props: {
    // 类型: boolean。
    // 来源: SourceManagementPanel 的 restoreDialogVisible。
    // 作用: 控制 Element UI 恢复弹窗显示状态。
    // true: 显示恢复弹窗和当前已删除系统源。
    // false: 隐藏弹窗，不修改 records 或共享状态。
    visible: { type: Boolean, default: false },

    // 类型: Array<object>。
    // 来源: SourceManagementPanel 通过 getRemovedSystemSources() 派生。
    // 作用: 生成可恢复系统源复选项；为空时显示“所有系统源均已存在”。
    // 条目字段: definition.id，string，系统源唯一标识，用于恢复 service 定位记录。
    // 条目字段: definition.name，string，系统源名称，用于复选项展示。
    // 条目字段: definition.version，string，系统源版本，用于辅助用户识别。
    records: {
      type: Array,

      /**
       * 创建 records 属性的独立默认值。
       *
       * @returns {Array<object>} 空的可恢复系统源列表。
       * 纯函数: 每次调用都返回新数组，不修改父组件数据或共享状态。
       */
      default() {
        return [];
      }
    }
  },

  /**
   * 创建恢复弹窗局部选择状态。
   * 数据来源: 初始为空数组；弹窗每次打开时由 visible 监听器根据 records 重置。
   * 维护边界: 只保存复选项选择结果，不复制或修改系统源业务记录。
   *
   * @returns {object} 恢复弹窗局部响应式状态。
   * @returns {Array<string>} return.selectedSourceIds 用户准备恢复的系统源 id 数组。
   * 纯函数: data 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
  data() {
    return {
      // 类型: Array<string>。
      // 作用: 保存用户选择恢复的系统源 id，每次打开重新选择全部已删除项。
      selectedSourceIds: []
    };
  },

  computed: {
    /**
     * 读取恢复弹窗响应式宽度。
     * 数据来源: settings-module.config.js 的 SETTINGS_DIALOG_WIDTH.standard。
     * 该计算属性只读取冻结配置，不修改组件状态或全局主题。
     *
     * @returns {string} 桌面最大 520px、手机保留两侧安全边距的 CSS width 值。
     * 纯函数: dialogWidth 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    dialogWidth() {
      // 返回值类型: string。
      // 作用: 传给 el-dialog width，避免固定宽度在手机视口产生横向溢出。
      return SETTINGS_DIALOG_WIDTH.standard;
    },

    /**
     * 读取恢复空状态插图尺寸。
     * 数据来源: 模块级 EMPTY_IMAGE_SIZE 常量。
     * 该计算属性只向模板暴露集中尺寸，不修改任何状态。
     *
     * @returns {number} Element UI el-empty 的 image-size 数值。
     * 纯函数: emptyImageSize 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    emptyImageSize() {
      // 返回值类型: number。
      // 作用: 给无可恢复系统源分支提供稳定插图尺寸。
      return EMPTY_IMAGE_SIZE;
    }
  },

  watch: {
    /**
     * 监听恢复弹窗显示状态。
     * 触发来源: 父页面通过 `.sync` 更新 visible。
     * 执行内容: 每次打开时默认选中 records 中全部已删除系统源；关闭时保持当前局部值且不执行恢复。
     *
     * @param {boolean} visible 新的弹窗显示状态。
     * @returns {void} 只重置 selectedSourceIds，不返回业务数据。
     * 副作用: 弹窗打开时覆盖 selectedSourceIds，使当前全部可恢复系统源默认选中。
 */
    visible(visible) {
      // 条件分支: visible 为 false，表示弹窗正在关闭时进入。
      // 执行内容: 直接退出，不在关闭阶段覆盖用户最后一次选择，也不修改共享状态。

      if (!visible) return;

      // 循环类型: Array.prototype.map。
      // 初始值: records 第一条已删除系统源记录。
      // 终止条件: records 所有记录都读取完成。
      // 循环作用: 提取 definition.id，让弹窗打开时默认勾选全部可恢复系统源。
      this.selectedSourceIds = this.records.map(record => record.definition.id);
    }
  },

  methods: {
    /**
     * 关闭恢复系统源弹窗。
     * 触发来源: el-dialog @close 或底部“关闭”按钮。
     *
     * @returns {void} 不返回业务数据，也不修改系统源记录。
     * 副作用: closeDialog 会关闭当前交互并清理临时状态，并同步相关组件状态、路由或对外事件。
     */
    closeDialog() {
      // 事件: update:visible。
      // 参数: false，boolean，通知父页面把 restoreDialogVisible 更新为 false。
      // 影响范围: 只隐藏当前弹窗，不调用 restoreSystemSources()。
      this.$emit('update:visible', false);
    },

    /**
     * 确认恢复用户勾选的系统源。
     * 触发来源: 底部“恢复所选”按钮。
     *
     * @returns {void} 不直接返回恢复数量，结果通过组件事件交给父页面。
 * 副作用: confirmRestore 会恢复系统数据源，并同步相关组件状态、路由或对外事件。
 */
    confirmRestore() {
      // 条件分支: selectedSourceIds 为空时进入。
      // 执行内容: 直接退出，防止发送没有恢复目标的确认事件。

      if (!this.selectedSourceIds.length) return;

      // 事件: confirm。
      // 参数: Array<string>，当前选择 id 的浅拷贝，避免父页面持有组件内部数组引用。
      // 影响范围: SourceManagementPanel 接收后调用 restoreSystemSources(sourceIds)。
      this.$emit('confirm', this.selectedSourceIds.slice());

      // 执行内容: 确认事件发出后关闭弹窗，结束本次恢复交互。
      this.closeDialog();
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 已删除系统源选择组 `.restore-system-dialog__list`。
  样式作用:
  使用单列网格排列可恢复系统源。
  通过统一间距避免多个复选项视觉拥挤。
*/
.restore-system-dialog__list {
  /* 使用 Grid 让每个系统源复选项独占一行。 */
  display: grid;
  /* 设置相邻复选项之间的垂直距离。 */
  gap: 12px;
}
</style>
