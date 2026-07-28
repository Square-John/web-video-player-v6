<template>
  <!--
    SourceDisableDialog 组件渲染树

    [DEFAULT] ele(el-dialog.source-disable-dialog)
    │  - condition:
    │      默认渲染；visible 为 true 时由 Element UI 显示弹窗。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-dialog
    │  - description:
    │      默认数据源交接弹窗。
    │      在更新、撤销授权、关闭或删除默认源前完成用户可控的默认源交接。
    │  - params:
    │      -- visible：父页面传入的弹窗可见状态。
    │      -- dialogWidth：统一配置提供的响应式弹窗宽度。
    │  - events:
    │      @close
    │          - description:
    │              Element UI 请求关闭弹窗时触发，只收起弹窗而不执行原操作。
    │          - methods:
    │              closeDialog()
    │
    ├─ [IF fallbackRecords.length] ele(el-select.source-disable-dialog__select)
    │  - condition:
    │      fallbackRecords 存在候选记录时渲染。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-select
    │  - description:
    │      新默认数据源选择器。
    │      让用户明确选择原操作完成后接替当前默认源的记录。
    │  - params:
    │      -- fallbackSourceId：用户当前选中的候选数据源 id。
    │      -- fallbackRecords：父页面提供的其他已启用数据源记录。
    │  - events:
    │      无
    │
    ├─ [ELSE] ele(el-checkbox.source-disable-dialog__accept-empty)
    │  - condition:
    │      fallbackRecords 为空，没有其他已启用数据源可接替时渲染。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-checkbox
    │  - description:
    │      无默认源风险确认项。
    │      要求用户明确接受原操作完成后应用进入无默认数据源状态。
    │  - params:
    │      -- acceptedNoSource：用户是否接受无默认源结果。
    │  - events:
    │      无
    │
    └─ [DEFAULT] ele(span.dialog-footer)
       - condition:
           默认渲染。
       - type:
           原生标签
           标签名称: span
       - description:
           默认源交接操作区。
           提供取消和继续操作，未满足交接条件时禁用确认按钮。
       - params:
           -- canConfirm：控制继续按钮是否可用。
           -- confirmLabel：说明交接完成后继续执行的原操作。
       - events:
           无
  -->
  <!--
    [DEFAULT] ele(el-dialog.source-disable-dialog)
    - condition:
        默认渲染；visible 为 true 时显示弹窗。
    - type:
        第三方组件
        组件库: Element UI
        组件名称: el-dialog
    - description:
        默认数据源交接弹窗根节点，组合操作说明、交接选择和底部操作区。
    - params:
        -- visible：父页面控制的弹窗可见状态。
        -- dialogWidth：统一响应式弹窗宽度。
    - events:
        @close
            - description:
                Element UI 请求关闭弹窗时触发。
            - methods:
                closeDialog()
  -->
  <el-dialog
    class="source-disable-dialog"
    title="调整默认数据源"
    :visible="visible"
    :width="dialogWidth"
    :close-on-click-modal="false"
    @close="closeDialog"
  >
    <!--
      [IF record] ele(div.source-disable-dialog__content)
      - condition:
          record 存在，表示父页面已指定等待交接的默认数据源时渲染。
      - type:
          原生标签
          标签名称: div
      - description:
          默认源交接内容区，展示操作原因并根据候选记录提供选择或风险确认。
      - params:
          -- record.definition.name：当前默认数据源名称。
          -- operationDescription：父页面传入的原操作影响说明。
      - events:
          无
    -->
    <div v-if="record" class="source-disable-dialog__content">
      <!--
        [DEFAULT] ele(p.source-disable-dialog__description)
        - condition:
            record 存在后默认渲染。
        - type:
            原生标签
            标签名称: p
        - description:
            默认源交接说明，标明当前默认源和完成交接后继续执行的操作。
        - params:
            -- record.definition.name：当前默认源名称。
            -- operationDescription：当前待继续操作说明。
        - events:
            无
      -->
      <p class="source-disable-dialog__description">
        “{{ record.definition.name }}”当前是默认数据源。{{ operationDescription }}
      </p>

      <!--
        [IF fallbackRecords.length] ele(div.source-disable-dialog__field)
        - condition:
            存在其他已启用数据源可作为默认源候选时渲染。
        - type:
            原生标签
            标签名称: div
        - description:
            新默认源字段容器，组合字段标签和候选选择器。
        - params:
            -- fallbackRecords：其他已启用数据源记录。
            -- fallbackSourceId：当前选择的候选数据源 id。
        - events:
            无
      -->
      <div v-if="fallbackRecords.length" class="source-disable-dialog__field">
        <!--
          [DEFAULT] ele(label.source-disable-dialog__label)
          - condition:
              候选字段容器渲染后默认显示。
          - type:
              原生标签
              标签名称: label
          - description:
              新默认数据源字段标签，说明下方选择器用途。
          - params:
              无
          - events:
              无
        -->
        <label class="source-disable-dialog__label">新的默认数据源</label>
        <!--
          [DEFAULT] ele(el-select.source-disable-dialog__select)
          - condition:
              fallbackRecords 存在候选记录时渲染。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-select
          - description:
              新默认源选择器，把用户选项同步到 fallbackSourceId。
          - params:
              -- fallbackSourceId：双向绑定的候选数据源 id。
              -- fallbackRecords：用于生成选项的候选记录数组。
          - events:
              无
        -->
        <el-select v-model="fallbackSourceId" class="source-disable-dialog__select">
          <!--
            [DEFAULT] ele(el-option.source-disable-dialog__option)
            - condition:
                对 fallbackRecords 中每条候选记录循环渲染。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-option
            - description:
                单个新默认源候选项，显示名称并提交其唯一标识。
            - params:
                -- fallbackRecord.definition.id：选项键和值。
                -- fallbackRecord.definition.name：选项展示名称。
            - events:
                无
          -->
          <el-option
            v-for="fallbackRecord in fallbackRecords"
            class="source-disable-dialog__option"
            :key="fallbackRecord.definition.id"
            :label="fallbackRecord.definition.name"
            :value="fallbackRecord.definition.id"
          />
        </el-select>
      </div>

      <!--
        [ELSE] ele(el-checkbox.source-disable-dialog__accept-empty)
        - condition:
            fallbackRecords 为空、没有其他默认源候选时渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-checkbox
        - description:
            无默认源确认项，要求用户主动接受继续操作后的应用状态。
        - params:
            -- acceptedNoSource：双向绑定的用户确认状态。
        - events:
            无
      -->
      <el-checkbox
        v-else
        v-model="acceptedNoSource"
        class="source-disable-dialog__accept-empty"
      >
        我确认继续后应用将进入无可用默认数据源状态
      </el-checkbox>
    </div>

    <!--
      [DEFAULT] ele(span.dialog-footer)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: span
      - description:
          默认源交接底部操作区，承载取消和继续按钮。
      - params:
          -- canConfirm：控制继续按钮是否禁用。
          -- confirmLabel：继续按钮展示文案。
      - events:
          无
    -->
    <span slot="footer" class="dialog-footer">
      <!--
        [DEFAULT] ele(el-button.source-disable-dialog__cancel)
        - condition:
            默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            取消按钮，只关闭弹窗而不继续原操作。
        - params:
            无
        - events:
            @click
                - description:
                    用户点击取消时触发。
                - methods:
                    closeDialog()
      -->
      <el-button class="source-disable-dialog__cancel" @click="closeDialog">取消</el-button>
      <!--
        [DEFAULT] ele(el-button.source-disable-dialog__confirm)
        - condition:
            默认渲染；canConfirm 为 false 时保持禁用。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            继续按钮，把当前默认源和候选源标识交给父页面继续原操作。
        - params:
            -- canConfirm：取反后控制 disabled 状态。
            -- confirmLabel：父页面提供的操作文案。
        - events:
            @click
                - description:
                    用户满足交接条件并点击继续时触发。
                - methods:
                    confirmDisable()
      -->
      <el-button
        class="source-disable-dialog__confirm"
        type="primary"
        :disabled="!canConfirm"
        @click="confirmDisable"
      >
        {{ confirmLabel }}
      </el-button>
    </span>
  </el-dialog>
</template>

<script>
/*
  SourceDisableDialog.vue 模块说明

  - 文件职责:
      在关闭、更新或删除默认源前收集接替源选择，并处理无候选源确认。
      只维护弹窗表单并回传交接结果，不直接修改 defaultSourceId 或启停状态。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SETTINGS_DIALOG_WIDTH: 自定义配置，提供响应式标准弹窗宽度。

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceDisableDialog: 当前文件公开的组件或模块能力。
*/

import {
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_DIALOG_WIDTH 设置模块弹窗宽度配置。
  // 文件作用: 给默认源交接弹窗提供统一响应式宽度。
  SETTINGS_DIALOG_WIDTH
} from '../../config/settings-module.config';

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools 和错误堆栈识别默认源交接弹窗。
  name: 'SourceDisableDialog',

  props: {
    // 类型: boolean。
    // 来源: 数据源列表页或详情页的默认源交接流程状态。
    // 作用: 控制交接弹窗是否可见。
    // true: 显示交接说明和操作入口。
    // false: 隐藏弹窗且不继续原操作。
    visible: { type: Boolean, default: false },
    // 类型: object|null。
    // 来源: 父页面从共享 SourceManagerState 中选出的当前默认源记录。
    // 作用: 提供当前默认源名称和确认事件所需的唯一标识。
    // 字段: definition.id，string，等待继续原操作的数据源唯一标识。
    // 字段: definition.name，string，交接说明中展示的当前默认源名称。
    record: { type: Object, default: null },
    // 类型: string。
    // 来源: 父页面当前等待继续执行的关闭、更新、撤销授权或删除动作。
    // 作用: 向用户解释为什么需要先完成默认源交接。
    operationDescription: {
      type: String,
      default: '继续操作前需要选择新的默认数据源。'
    },
    // 类型: string。
    // 来源: 父页面当前等待继续执行的动作。
    // 作用: 明确交接完成后继续按钮将执行的业务操作。
    confirmLabel: {
      type: String,
      default: '继续'
    },
    // 类型: Array<object>。
    // 来源: 父页面从共享状态中筛选出的其他已启用数据源。
    // 作用: 提供可以接替当前默认源的候选记录。
    // 条目字段: definition.id，string，候选选择器选项值。
    // 条目字段: definition.name，string，候选选择器展示名称。
    fallbackRecords: {
      type: Array,

      /**
       * 创建 fallbackRecords 属性的独立默认值。
       *
       * @returns {Array<object>} 空的默认源接替候选列表。
       * 纯函数: 每次调用都返回新数组，不修改数据源记录或父组件状态。
       */
      default() {
        return [];
      }
    }
  },

  /**
   * 创建默认源交接表单的局部状态。
   * 每次弹窗打开时，visible 监听器会根据最新候选记录重新初始化这些字段。
   *
   * @returns {object} 当前组件响应式表单状态。
   * @returns {string} return.fallbackSourceId 用户选择的新默认数据源 id。
   * @returns {boolean} return.acceptedNoSource 用户是否接受无默认源结果。
   * 纯函数: data 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
  data() {
    return {
      // 类型: string。
      // 初始值: 空字符串，等待弹窗打开时从候选记录初始化。
      // 作用: 保存用户选择的新默认源 id，供确认事件回传父页面。
      fallbackSourceId: '',

      // 类型: boolean。
      // 初始值: false，不默认替用户接受无默认源状态。
      // 作用: 没有候选源时记录用户是否明确接受无默认源结果。
      // true: 允许继续原操作并进入无默认源状态。
      // false: 继续按钮保持禁用。
      acceptedNoSource: false
    };
  },

  computed: {
    /**
     * 读取默认源交接弹窗响应式宽度。
     * 数据来源: SETTINGS_DIALOG_WIDTH.standard。
     * 该计算属性只读取统一配置，不修改组件或共享状态。
     *
     * @returns {string} Element UI el-dialog 使用的标准响应式宽度。
     * 纯函数: dialogWidth 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    dialogWidth() {
      // 返回值类型: string。
      // 作用: 避免固定像素宽度在手机视口产生横向溢出。
      return SETTINGS_DIALOG_WIDTH.standard;
    },

    /**
     * 判断当前关闭操作是否允许确认。
     * 有候选源时要求选中 fallbackSourceId，没有候选源时要求 acceptedNoSource 为 true。
     * 该计算属性只派生按钮状态，不修改表单或共享状态。
     *
     * @returns {boolean} 有回退源时要求选择，无回退源时要求勾选确认。
     * 纯函数: canConfirm 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    canConfirm() {
      // 三目条件: fallbackRecords 是否包含至少一个候选记录。
      // true 分支: 只有 fallbackSourceId 非空时允许确认。
      // false 分支: 只有用户主动接受无默认源结果时允许确认。
      return this.fallbackRecords.length
        ? Boolean(this.fallbackSourceId)
        : this.acceptedNoSource;
    }
  },

  watch: {
    /**
     * 监听对话框打开状态并初始化默认源交接表单。
     * 打开时默认选择第一条候选记录；没有候选时保持空 id，并清除风险确认。
     *
     * @param {boolean} visible 新可见状态。
     * @returns {void} 只重置组件局部表单。
     * 副作用: 弹窗打开时初始化 fallbackSourceId，并清除无候选源确认状态。
 */
    visible(visible) {
      // 条件分支: visible 为 false，即弹窗正在关闭时进入。
      // 执行内容: 直接退出，关闭过程不重写当前表单值。

      if (!visible) return;

      // 三目条件: fallbackRecords 是否包含候选记录。
      // true 分支: 默认选中第一条候选记录，减少用户完成交接所需操作。
      // false 分支: 使用空字符串，表示当前没有可接替的默认源。
      this.fallbackSourceId = this.fallbackRecords.length
        ? this.fallbackRecords[0].definition.id
        : '';
      // 类型: boolean。
      // 作用: 每次打开弹窗都撤销上一次无默认源确认，要求用户针对当前操作重新决定。
      this.acceptedNoSource = false;
    }
  },

  methods: {
    /**
     * 关闭默认源交接弹窗。
     * 触发来源: el-dialog @close 或取消按钮 @click。
     *
     * @returns {void} 该方法不返回业务数据。
     * 副作用: closeDialog 会关闭当前交互并清理临时状态，并同步相关组件状态、路由或对外事件。
     */
    closeDialog() {
      // 事件: update:visible。
      // 参数: false，boolean，通知父页面隐藏交接弹窗。
      this.$emit('update:visible', false);
    },

    /**
     * 确认默认源交接并请求父页面继续原操作。
     * 触发来源: 用户点击可用的继续按钮。
     *
     * @returns {void} 交接参数通过组件事件传递，不直接返回业务数据。
 * 副作用: confirmDisable 会提交当前交互，并同步相关组件状态、路由或对外事件。
 */
    confirmDisable() {
      // 条件分支: 当前记录缺失或交接条件尚未满足时进入。
      // 执行内容: 终止确认，避免传出无效 sourceId 或绕过用户确认。

      if (!this.record || !this.canConfirm) return;

      // 事件: confirm。
      // 作用: 把当前默认源和用户选择的候选源交给父页面继续原操作。
      this.$emit('confirm', {
        // 类型: string。
        // 作用: 标识等待执行关闭、更新、撤销授权或删除的数据源。
        sourceId: this.record.definition.id,
        // 类型: string。
        // 作用: 标识接替当前默认源的候选记录；无候选源时为空字符串。
        fallbackSourceId: this.fallbackSourceId
      });

      // 执行内容: confirm 事件发出后关闭弹窗，结束本次交接流程。
      this.closeDialog();
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 默认源候选字段 `.source-disable-dialog__field`。
  样式作用:
  把新默认源选择器与上方操作原因分隔。
*/
.source-disable-dialog__field {
  /* 在操作说明下方保留字段间距。 */
  margin-top: 18px;
}

/*
  作用容器: 新默认源字段标签 `.source-disable-dialog__label`。
  样式作用:
  让字段名称独占一行并与选择器建立层级。
*/
.source-disable-dialog__label {
  /* 使用块级布局让选择器换到下一行。 */
  display: block;
  /* 在标签和选择器之间保留距离。 */
  margin-bottom: 8px;
  /* 使用主题次级文本色。 */
  color: var(--text-secondary);
}

/*
  作用容器: 新默认源选择器 `.source-disable-dialog__select`。
  样式作用:
  使用完整弹窗内容宽度展示可能较长的数据源名称。
*/
.source-disable-dialog__select {
  /* 让 Element UI 选择器占满弹窗内容区。 */
  width: 100%;
}
</style>
