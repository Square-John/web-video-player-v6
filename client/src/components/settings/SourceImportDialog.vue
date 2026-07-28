<template>
  <!--
    SourceImportDialog 组件渲染树

    [DEFAULT] ele(el-dialog.source-import-dialog)
    │  - condition:
    │      visible 为 true 时由 Element UI 显示。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-dialog
    │  - description:
    │      收集文件、在线地址或粘贴文本三种 mock 导入输入。
    │  - params:
    │      -- form、importMethods、dialogWidth：局部表单、导入枚举和响应式宽度。
    │  - events:
    │      @close 调用 closeDialog()。
    │
    ├─ [DEFAULT] ele(el-form)
    │  - condition:
    │      默认渲染。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-form
    │  - description:
    │      展示导入方式、名称、版本和按方式变化的脚本输入。
    │  - params:
    │      -- form：组件局部导入表单。
    │  - events:
    │      文件 input change 调用 readSelectedFile(event)。
    │
    └─ [DEFAULT] ele(span.dialog-footer)
       - condition:
           默认渲染。
       - type:
           原生标签
           标签名称: span
       - description:
           提供取消和确认导入操作，输入不完整时禁用确认。
       - params:
           -- canSubmit 控制确认按钮。
       - events:
           @click 调用 closeDialog() 或 confirmImport()。
  -->
  <!--
    [DEFAULT] ele(el-dialog.source-import-dialog)
    - condition:
        默认渲染；visible 为 true 时显示导入表单。
    - type:
        第三方组件
        组件库: Element UI
        组件名称: el-dialog
    - description:
        数据源导入弹窗，承载三种导入方式的局部表单和确认操作。
    - params:
        -- visible：父页面控制的弹窗可见状态。
        -- dialogWidth：统一配置提供的响应式宽度。
    - events:
        @close
            - description:
                Element UI 请求关闭弹窗时触发。
            - methods:
                closeDialog()
  -->
  <el-dialog
    class="source-import-dialog"
    title="导入数据源"
    :visible="visible"
    :width="dialogWidth"
    :close-on-click-modal="false"
    @close="closeDialog"
  >
    <!--
      [DEFAULT] ele(el-form.source-import-dialog__form)
      - condition:
          默认渲染。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-form
      - description:
          数据源导入表单，组合公共字段和按导入方式切换的脚本输入。
      - params:
          -- form：组件局部导入表单对象。
      - events:
          无
    -->
    <el-form class="source-import-dialog__form" label-position="top">
      <!--
        [DEFAULT] ele(el-form-item.source-import-dialog__method-field)
        - condition:
            默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-form-item
        - description:
            导入方式字段，在文件、在线地址和粘贴文本之间切换。
        - params:
            -- form.importMethod：当前选择的导入方式。
            -- importMethods：三种合法导入方式枚举。
        - events:
            无
      -->
      <el-form-item class="source-import-dialog__method-field" label="导入方式">
        <!--
          [DEFAULT] ele(el-radio-group.source-import-dialog__method-group)
          - condition:
              导入方式字段渲染后默认显示。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-radio-group
          - description:
              导入方式单选组，把用户选择同步到 form.importMethod。
          - params:
              -- form.importMethod：当前导入方式。
          - events:
              无
        -->
        <el-radio-group v-model="form.importMethod" class="source-import-dialog__method-group">
          <!--
            [DEFAULT] ele(el-radio-button.source-import-dialog__method-option.file)
            - condition:
                导入方式单选组渲染后默认显示。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-radio-button
            - description:
                文件导入选项，选择后显示本地脚本文件字段。
            - params:
                -- importMethods.file：文件导入枚举值。
            - events:
                无
          -->
          <el-radio-button class="source-import-dialog__method-option" :label="importMethods.file">文件导入</el-radio-button>
          <!--
            [DEFAULT] ele(el-radio-button.source-import-dialog__method-option.remote)
            - condition:
                导入方式单选组渲染后默认显示。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-radio-button
            - description:
                在线地址导入选项，选择后显示 remoteUrl 字段。
            - params:
                -- importMethods.remote：在线导入枚举值。
            - events:
                无
          -->
          <el-radio-button class="source-import-dialog__method-option" :label="importMethods.remote">在线地址</el-radio-button>
          <!--
            [DEFAULT] ele(el-radio-button.source-import-dialog__method-option.text)
            - condition:
                导入方式单选组渲染后默认显示。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-radio-button
            - description:
                粘贴文本导入选项，选择后显示脚本文本字段。
            - params:
                -- importMethods.text：粘贴文本导入枚举值。
            - events:
                无
          -->
          <el-radio-button class="source-import-dialog__method-option" :label="importMethods.text">粘贴文本</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!--
        [DEFAULT] ele(el-form-item.source-import-dialog__name-field)
        - condition:
            默认渲染，所有导入方式都要求填写数据源名称。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-form-item
        - description:
            数据源名称字段，把用户输入同步到 form.name。
        - params:
            -- form.name：数据源展示名称，最长 40 个字符。
        - events:
            无
      -->
      <el-form-item class="source-import-dialog__name-field" label="数据源名称" required>
        <!--
          [DEFAULT] ele(el-input.source-import-dialog__name-input)
          - condition:
              名称字段渲染后默认显示。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-input
          - description:
              数据源名称输入框，去除首尾空白并限制为 40 个字符。
          - params:
              -- form.name：双向绑定的数据源名称。
          - events:
              无
        -->
        <el-input v-model.trim="form.name" class="source-import-dialog__name-input" maxlength="40" show-word-limit />
      </el-form-item>

      <!--
        [DEFAULT] ele(el-form-item.source-import-dialog__version-field)
        - condition:
            默认渲染，所有导入方式都可以填写脚本版本。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-form-item
        - description:
            脚本版本字段，把用户输入同步到 form.version。
        - params:
            -- form.version：新数据源定义使用的脚本版本。
        - events:
            无
      -->
      <el-form-item class="source-import-dialog__version-field" label="脚本版本">
        <!--
          [DEFAULT] ele(el-input.source-import-dialog__version-input)
          - condition:
              版本字段渲染后默认显示。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-input
          - description:
              脚本版本输入框，保存新数据源定义的初始版本。
          - params:
              -- form.version：双向绑定的脚本版本。
          - events:
              无
        -->
        <el-input v-model.trim="form.version" class="source-import-dialog__version-input" placeholder="例如 v1.0.0" />
      </el-form-item>

      <!--
        [IF form.importMethod === importMethods.file] ele(el-form-item.source-import-dialog__file-field)
        - condition:
            当前选择文件导入方式时渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-form-item
        - description:
            本地脚本文件字段，通过 FileReader 把用户选择的文件读取为文本。
        - params:
            -- acceptedFileTypes：原生文件输入允许的扩展名。
            -- selectedFileName：读取成功前用于展示用户选择的文件名。
        - events:
            @change
                - description:
                    用户选择本地文件后触发。
                - methods:
                    readSelectedFile(event)
                        -- event：原生文件输入 change 事件。
      -->
      <el-form-item v-if="form.importMethod === importMethods.file" class="source-import-dialog__file-field" label="脚本文件" required>
        <!--
          [DEFAULT] ele(input.source-import-dialog__file)
          - condition:
              文件导入字段渲染后默认显示。
          - type:
              原生标签
              标签名称: input
          - description:
              本地脚本文件选择器，限制默认可选扩展名并触发 FileReader。
          - params:
              -- acceptedFileTypes：允许选择的文件扩展名。
          - events:
              @change
                  - description:
                      用户选择文件时触发。
                  - methods:
                      readSelectedFile(event)
                          -- event：原生 change 事件。
        -->
        <input class="source-import-dialog__file" type="file" :accept="acceptedFileTypes" @change="readSelectedFile" />
        <!--
          [IF selectedFileName] ele(p.source-import-dialog__hint)
          - condition:
              用户已经选择有效文件并保存文件名时渲染。
          - type:
              原生标签
              标签名称: p
          - description:
              已选择文件提示，帮助用户核对本次导入对象。
          - params:
              -- selectedFileName：当前选择的本地文件名。
          - events:
              无
        -->
        <p v-if="selectedFileName" class="source-import-dialog__hint">已选择：{{ selectedFileName }}</p>
      </el-form-item>

      <!--
        [IF form.importMethod === importMethods.remote] ele(el-form-item.source-import-dialog__remote-field)
        - condition:
            当前选择在线地址导入方式时渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-form-item
        - description:
            在线导入地址字段，把用户输入同步到 form.remoteUrl。
        - params:
            -- form.remoteUrl：数据源脚本在线地址。
        - events:
            无
      -->
      <el-form-item v-if="form.importMethod === importMethods.remote" class="source-import-dialog__remote-field" label="在线导入地址" required>
        <!--
          [DEFAULT] ele(el-input.source-import-dialog__remote-input)
          - condition:
              在线地址字段渲染后默认显示。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-input
          - description:
              在线脚本地址输入框，把去除首尾空白的地址写入表单。
          - params:
              -- form.remoteUrl：双向绑定的在线导入地址。
          - events:
              无
        -->
        <el-input v-model.trim="form.remoteUrl" class="source-import-dialog__remote-input" placeholder="https://example.com/source.js" />
      </el-form-item>

      <!--
        [IF form.importMethod === importMethods.text] ele(el-form-item.source-import-dialog__text-field)
        - condition:
            当前选择粘贴文本导入方式时渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-form-item
        - description:
            脚本文本字段，把用户输入同步到 form.scriptContent。
        - params:
            -- form.scriptContent：用户粘贴的数据源脚本文本。
            -- scriptTextareaRows：文本框可见行数。
        - events:
            无
      -->
      <el-form-item v-if="form.importMethod === importMethods.text" class="source-import-dialog__text-field" label="数据源脚本" required>
        <!--
          [DEFAULT] ele(el-input.source-import-dialog__text-input)
          - condition:
              粘贴文本字段渲染后默认显示。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-input
          - description:
              多行脚本文本输入框，把用户粘贴内容写入表单。
          - params:
              -- form.scriptContent：双向绑定的脚本文本。
              -- scriptTextareaRows：可见文本行数。
          - events:
              无
        -->
        <el-input v-model="form.scriptContent" class="source-import-dialog__text-input" type="textarea" :rows="scriptTextareaRows" />
      </el-form-item>

      <!--
        [DEFAULT] ele(el-alert.source-import-dialog__mock-alert)
        - condition:
            默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-alert
        - description:
            Mock 阶段边界提示，说明导入状态刷新页面后恢复初始数据。
        - params:
            无
        - events:
            无
      -->
      <el-alert
        class="source-import-dialog__mock-alert"
        title="当前导入只写入 Mock 内存状态，刷新页面后恢复初始数据。"
        type="info"
        :closable="false"
        show-icon
      />
    </el-form>

    <!--
      [DEFAULT] ele(span.dialog-footer.source-import-dialog__footer)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: span
      - description:
          导入弹窗操作区，承载取消和确认导入按钮。
      - params:
          -- canSubmit：控制确认导入按钮是否可用。
      - events:
          无
    -->
    <span slot="footer" class="dialog-footer source-import-dialog__footer">
      <!--
        [DEFAULT] ele(el-button.source-import-dialog__cancel)
        - condition:
            默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            取消按钮，只关闭弹窗且不提交表单。
        - params:
            无
        - events:
            @click
                - description:
                    用户点击取消时触发。
                - methods:
                    closeDialog()
      -->
      <el-button class="source-import-dialog__cancel" @click="closeDialog">取消</el-button>
      <!--
        [DEFAULT] ele(el-button.source-import-dialog__confirm)
        - condition:
            默认渲染；canSubmit 为 false 时保持禁用。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            确认导入按钮，提交表单浅拷贝并关闭弹窗。
        - params:
            -- canSubmit：取反后控制 disabled 状态。
        - events:
            @click
                - description:
                    用户满足必填条件并点击确认时触发。
                - methods:
                    confirmImport()
      -->
      <el-button class="source-import-dialog__confirm" type="primary" :disabled="!canSubmit" @click="confirmImport">确认导入</el-button>
    </span>
  </el-dialog>
</template>

<script>
/*
  SourceImportDialog.vue 模块说明

  - 文件职责:
      提供文件、在线地址和粘贴文本三种脚本导入表单，并统一生成标准导入输入。
      只读取用户选择的脚本文本和地址，创建记录及授权状态由 settingsService 负责。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      IMPORT_METHOD: 自定义配置，提供三种允许导入方式。
      SETTINGS_DIALOG_WIDTH: 自定义配置，提供响应式导入表单宽度。

  - 模块级常量:
      ACCEPTED_FILE_TYPES: string，文件选择器允许扩展名。
      SCRIPT_TEXTAREA_ROWS: number，粘贴脚本文本框行数。
      DEFAULT_FORM: object，导入表单默认值。

  - 模块级辅助函数:
      createDefaultForm()
          - params:
              无
          - return: object，新的导入表单对象。
          - description:
              避免多次打开对话框复用旧对象引用。

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceImportDialog: 当前文件公开的组件或模块能力。
*/

import {
  // 导入来源: ../../services/settingsService。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 表单条件分支和提交值使用统一枚举，不散落魔法字符串。
  IMPORT_METHOD
} from '../../services/settingsService';

import {
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_DIALOG_WIDTH 设置模块弹窗宽度配置。
  // 文件作用: 给导入表单提供统一响应式宽度。
  SETTINGS_DIALOG_WIDTH
} from '../../config/settings-module.config';

// 类型: string。
// 作用: 限制文件选择器默认展示 JavaScript、JSON 和文本脚本文件。

const ACCEPTED_FILE_TYPES = '.js,.mjs,.json,.txt';

// 类型: number。
// 作用: 控制粘贴脚本文本框可见行数，保证输入空间和弹窗高度平衡。

const SCRIPT_TEXTAREA_ROWS = 8;

/**
 * 创建导入表单默认值。
 *
 * @returns {object} 导入表单默认状态。
 * @returns {string} return.importMethod 首次打开时默认选择的文件导入方式。
 * @returns {string} return.name 用户填写的数据源名称。
 * @returns {string} return.version 用户填写的脚本版本。
 * @returns {string} return.remoteUrl 在线导入方式使用的远程地址。
 * @returns {string} return.scriptContent 文件或文本导入方式使用的脚本内容。
 * 纯函数: createDefaultForm 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
function createDefaultForm() {
  // 返回值类型: object。
  // 作用: 为每次弹窗打开创建互不共享引用的全新导入表单。
  return {
    // 类型: string。
    // 作用: 默认使用文件导入，并控制模板显示对应输入字段。
    importMethod: IMPORT_METHOD.file,
    // 类型: string。
    // 作用: 保存数据源展示名称，所有导入方式都要求填写。
    name: '',
    // 类型: string。
    // 作用: 保存脚本版本，给新建数据源定义提供初始版本。
    version: 'v1.0.0',
    // 类型: string。
    // 作用: 保存在线导入地址，只在 remote 分支提交。
    remoteUrl: '',
    // 类型: string。
    // 作用: 保存读取到或粘贴的脚本文本，只在 file 和 text 分支提交。
    scriptContent: ''
  };
}

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools 和错误堆栈识别导入弹窗。
  name: 'SourceImportDialog',

  props: {
    // 类型: boolean。
    // 来源: SourceManagementPanel 的导入弹窗状态。
    // 作用: 控制数据源导入表单是否可见。
    // true: 显示并重置导入表单。
    // false: 隐藏弹窗且不写入共享状态。
    visible: { type: Boolean, default: false }
  },

  /**
   * 创建数据源导入弹窗局部状态。
   * 表单和文件名会在每次打开弹窗时重置，枚举与尺寸常量只供模板读取。
   *
   * @returns {object} 当前组件响应式局部状态。
   * @returns {object} return.form 三种导入方式共用表单。
   * @returns {string} return.selectedFileName 当前选择的本地文件名。
   * @returns {object} return.importMethods 模板使用的导入方式枚举。
   * @returns {string} return.acceptedFileTypes 原生文件输入 accept 值。
   * @returns {number} return.scriptTextareaRows 脚本文本框可见行数。
   * 纯函数: data 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
   */
  data() {
    return {
      // 类型: object。
      // 作用: 保存三种导入方式共用表单字段。
      form: createDefaultForm(),

      // 类型: string。
      // 作用: 显示当前选择的脚本文件名；文件内容写入 form.scriptContent。
      selectedFileName: '',

      // 类型: object。
      // 作用: 给模板提供导入方式枚举，避免 template 写魔法字符串。
      importMethods: IMPORT_METHOD,

      // 类型: string。
      // 作用: 给原生文件输入提供统一 accept 值。
      acceptedFileTypes: ACCEPTED_FILE_TYPES,

      // 类型: number。
      // 作用: 给 Element UI textarea 提供集中维护的行数。
      scriptTextareaRows: SCRIPT_TEXTAREA_ROWS
    };
  },

  computed: {
    /**
     * 读取导入表单响应式宽度。
     * 数据来源: SETTINGS_DIALOG_WIDTH.importSource。
     * 该计算属性只读取统一配置，不修改表单或共享状态。
     *
     * @returns {string} Element UI el-dialog 使用的导入弹窗宽度。
     * 纯函数: dialogWidth 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    dialogWidth() {
      // 返回值类型: string。
      // 作用: 桌面提供完整输入区，并在手机保留两侧安全边距。
      return SETTINGS_DIALOG_WIDTH.importSource;
    },

    /**
     * 判断导入表单是否满足当前方式必填条件。
     * 先校验所有方式共用的名称，再按 file、remote 和 text 分支校验对应输入。
     * 该计算属性只派生按钮状态，不修改表单内容。
     *
     * @returns {boolean} true 表示允许提交，false 表示按钮禁用。
     * 纯函数: canSubmit 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    canSubmit() {
      // 条件分支: 数据源名称为空时进入。
      // 执行内容: 返回 false，所有导入方式都不能提交无名称记录。

      if (!this.form.name) return false;

      // 条件分支: 当前选择文件导入时进入。
      // 执行内容: 只有 FileReader 已写入脚本文本时允许提交。

      if (this.form.importMethod === IMPORT_METHOD.file) return Boolean(this.form.scriptContent);

      // 条件分支: 当前选择在线地址导入时进入。
      // 执行内容: 只有 remoteUrl 非空时允许提交。

      if (this.form.importMethod === IMPORT_METHOD.remote) return Boolean(this.form.remoteUrl);

      // 条件分支: 当前选择粘贴文本导入时进入。
      // 执行内容: 去除空白后仍有脚本文本才允许提交。

      if (this.form.importMethod === IMPORT_METHOD.text) return Boolean(this.form.scriptContent.trim());

      // 返回值类型: boolean。
      // 作用: 未知导入方式一律禁止提交，避免创建契约外记录。
      return false;
    }
  },

  watch: {
    /**
     * 监听导入弹窗可见状态。
     * 每次打开时创建全新表单并清除旧文件名，防止上一次输入泄漏到新流程。
     * visible 为 false 时不修改表单，关闭过程只由父组件同步可见状态。
     *
     * @param {boolean} visible 新的弹窗可见状态。
     * @returns {void} 该监听器只重置组件局部状态。
     * 副作用: 弹窗打开时创建全新导入表单并清空上一次选择的文件名。
 */
    visible(visible) {
      // 条件分支: visible 为 false，即弹窗关闭时进入。
      // 执行内容: 直接退出，不在关闭动画期间重置当前表单。

      if (!visible) return;

      // 类型: object。
      // 作用: 使用新对象重置所有导入字段，避免复用旧响应式对象引用。
      this.form = createDefaultForm();

      // 类型: string。
      // 作用: 清除上一次本地文件名，保持新导入流程界面干净。
      this.selectedFileName = '';
    }
  },

  methods: {
    /**
     * 关闭数据源导入弹窗。
     * 触发来源: el-dialog @close 或取消按钮 @click。
     *
     * @returns {void} 该方法不返回业务数据。
     * 副作用: closeDialog 会关闭当前交互并清理临时状态，并同步相关组件状态、路由或对外事件。
     */
    closeDialog() {
      // 事件: update:visible。
      // 参数: false，boolean，通知父页面隐藏导入弹窗。
      this.$emit('update:visible', false);
    },

    /**
     * 读取用户选择的本地脚本文件。
     *
     * @param {Event} event 原生文件输入 change 事件。
     * @returns {void} 读取结果通过响应式表单保存。
     * 副作用: readSelectedFile 会应用用户选择，并同步相关组件状态、路由或对外事件。
     */
    readSelectedFile(event) {
      // 类型: FileList|null。
      // 作用: 读取原生文件输入当前选择结果，作为脚本文件来源。

      const fileList = event.target.files;

      // 类型: File|null。
      // 作用: 保存用户本次选择的第一份脚本文件；没有有效文件时使用 null。
      // 三目条件: fileList 是否存在且至少包含一个文件。
      // true 分支: 读取用户选择的第一份文件。
      // false 分支: 使用 null，表示本次 change 没有有效文件。

const file = fileList && fileList.length ? fileList[0] : null;

      // 条件分支: file 为空时进入。
      // 执行内容: 直接退出，不覆盖已有表单字段。

      if (!file) return;

      // 类型: string。
      // 作用: 保存用户选择的文件名，驱动模板显示选择结果。
      this.selectedFileName = file.name;

      // 类型: FileReader。
      // 作用: 在浏览器内异步读取用户明确选择的脚本文本，不上传文件。

      const reader = new FileReader();

      // 异步成功回调: 文件读取完成时执行。
      // 执行内容: 将字符串结果写入脚本字段，非字符串结果使用空文本兜底。
      reader.onload = () => {
        // 三目条件: reader.result 是否为字符串。
        // true 分支: 保存读取到的真实脚本文本。
        // false 分支: 保存空字符串，阻止异常结果通过提交校验。
        this.form.scriptContent = typeof reader.result === 'string' ? reader.result : '';
      };

      // 异步失败回调: 浏览器读取文件失败时执行。
      // 执行内容: 清空文件状态和脚本文本，并向用户显示错误消息。
      reader.onerror = () => {
        // 类型: string。
        // 作用: 清除失败文件名，避免界面误报文件已成功选择。
        this.selectedFileName = '';
        // 类型: string。
        // 作用: 清除不完整脚本文本，确保确认按钮保持禁用。
        this.form.scriptContent = '';
        // 副作用: 通过 Element UI 全局消息提示用户文件读取失败。
        this.$message.error('读取脚本文件失败');
      };

      // 异步操作: 以文本方式开始读取用户选择的文件。
      // 成功和失败结果分别由 onload 与 onerror 回调处理。
      reader.readAsText(file);
    },

    /**
     * 确认导入当前数据源脚本。
     * 触发来源: 用户点击可用的确认导入按钮。
     *
     * @returns {void} 导入参数通过组件事件传递，不直接返回业务数据。
 * 副作用: confirmImport 会导入数据源脚本，并同步相关组件状态、路由或对外事件。
 */
    confirmImport() {
      // 条件分支: 当前表单未满足对应导入方式必填条件时进入。
      // 执行内容: 终止提交，避免绕过按钮禁用状态创建无效记录。

      if (!this.canSubmit) return;

      // 事件: confirm。
      // 参数: form 的浅拷贝，object，隔离父页面处理与当前响应式表单引用。
      this.$emit('confirm', { ...this.form });

      // 执行内容: 确认事件发出后关闭弹窗，结束本次导入交互。
      this.closeDialog();
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 原生脚本文件选择器 `.source-import-dialog__file`。
  样式作用:
  让文件输入占满表单宽度。
  使用次级文本色与 Element UI 表单视觉保持一致。
*/
.source-import-dialog__file {
  /* 使用块级布局避免文件输入与其他内容同行。 */
  display: block;
  /* 让文件选择器占满表单内容宽度。 */
  width: 100%;
  /* 使用主题次级文本色显示文件名。 */
  color: var(--text-secondary);
}

/*
  作用容器: 已选择文件提示 `.source-import-dialog__hint`。
  样式作用:
  在文件输入下方显示当前文件名。
  使用弱文本样式避免压过主要表单字段。
*/
.source-import-dialog__hint {
  /* 在文件输入下方保留轻量距离并清除其他方向默认边距。 */
  margin: 8px 0 0;
  /* 使用主题弱文本色。 */
  color: var(--text-muted);
  /* 使用辅助信息字号。 */
  font-size: 12px;
}
</style>
