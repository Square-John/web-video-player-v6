<template>
  <!--
    SourceImportDialog 组件渲染树

    [DEFAULT] ele(el-dialog.source-import-dialog)
    │  - condition: 组件始终挂载；visible=true 时由 Element UI 显示。
    │  - type: 第三方组件 Element UI el-dialog。
    │  - description: 承载三入口输入、静态预检和用户信任确认，不保存共享数据源状态。
    │  - params: dialogTitle、dialogWidth、visible。
    │  - events: @close 调用 closeDialog()。
    │
    ├─ [IF dialogPhase === dialogPhases.input] ele(el-form.source-import-dialog__form)
    │  - condition: 当前处于原始载荷输入阶段。
    │  - type: 第三方组件 Element UI el-form。
    │  - description: 收集文件、HTTPS 地址或粘贴文本，不收集 manifest 字段。
    │  - params: form、importMethods、acceptedFileTypes、scriptTextareaRows。
    │  - events: 文件 @change 调用 readSelectedFile(event)。
    │
    ├─ [ELSE] ele(section.source-import-dialog__preview)
    │  - condition: 静态预检成功并进入信任确认阶段。
    │  - type: 原生 section。
    │  - description: 展示 manifest、来源、容量、SHA-256、执行风险和启用决定。
    │  - params: preview、previewCapabilities、riskAccepted、enableAfterImport。
    │  - events: checkbox 和 switch 只修改当前弹窗局部决定。
    │
    └─ [DEFAULT] ele(span.dialog-footer.source-import-dialog__footer)
       - condition: 默认渲染，根据 dialogPhase 切换操作集合。
       - type: 原生 span。
       - description: 输入阶段执行预检，确认阶段允许返回修改或提交信任决定。
       - params: canPreview、canConfirmImport、previewPending、footerControlKeys。
       - events: @click 调用 closeDialog()、previewSource()、returnToInput() 或 confirmImport()。
  -->
  <!--
    [DEFAULT] ele(el-dialog.source-import-dialog)
    - condition: visible 为 true 时显示，false 时保持挂载但隐藏。
    - type: 第三方组件 Element UI el-dialog。
    - description: 数据源单文件导入与信任确认边界。
    - params: dialogTitle 提供当前阶段标题；dialogWidth 约束响应式宽度；visible 来自父页面。
    - events: @close 调用 closeDialog()，只通知父页面关闭。
  -->
  <el-dialog
    class="source-import-dialog"
    :title="dialogTitle"
    :visible="visible"
    :width="dialogWidth"
    :close-on-click-modal="false"
    @close="closeDialog"
  >
    <!--
      [IF dialogPhase === dialogPhases.input] ele(el-form.source-import-dialog__form)
      - condition: 当前尚未取得有效静态预览时渲染。
      - type: 第三方组件 Element UI el-form。
      - description: 只收集三入口载荷来源，不允许用户填写名称、版本或 Provider 身份。
      - params: form 保存 importMethod、remoteUrl、originalFileName 和 scriptContent。
      - events: 文件输入 @change 调用 readSelectedFile(event)。
    -->
    <el-form
      v-if="dialogPhase === dialogPhases.input"
      class="source-import-dialog__form"
      label-position="top"
    >
      <!--
        [DEFAULT] ele(el-form-item.source-import-dialog__method-field)
        - condition: 输入阶段默认渲染。
        - type: 第三方组件 Element UI el-form-item。
        - description: 在文件、在线地址和粘贴文本三个载荷读取入口间互斥切换。
        - params: form.importMethod 与 importMethods。
        - events: el-radio-group 双向更新 form.importMethod。
      -->
      <el-form-item class="source-import-dialog__method-field" label="导入方式">
        <el-radio-group v-model="form.importMethod" class="source-import-dialog__method-group">
          <el-radio-button :label="importMethods.file">文件导入</el-radio-button>
          <el-radio-button :label="importMethods.remote">在线地址</el-radio-button>
          <el-radio-button :label="importMethods.text">粘贴文本</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!--
        [IF form.importMethod === importMethods.file] ele(el-form-item.source-import-dialog__file-field)
        - condition: 用户选择文件导入时渲染。
        - type: 第三方组件 Element UI el-form-item。
        - description: 在浏览器内读取一份用户选择的 JavaScript 单文件文本。
        - params: acceptedFileTypes 限制默认文件筛选；form.originalFileName 展示当前文件名。
        - events: 原生 @change 调用 readSelectedFile(event)。
      -->
      <el-form-item
        v-if="form.importMethod === importMethods.file"
        class="source-import-dialog__file-field"
        label="脚本文件"
        required
      >
        <input
          :key="fileInputRevision"
          class="source-import-dialog__file"
          type="file"
          :accept="acceptedFileTypes"
          @change="readSelectedFile"
        >
        <p v-if="form.originalFileName" class="source-import-dialog__hint">
          已选择：{{ form.originalFileName }}
        </p>
      </el-form-item>

      <!--
        [IF form.importMethod === importMethods.remote] ele(el-form-item.source-import-dialog__remote-field)
        - condition: 用户选择在线地址导入时渲染。
        - type: 第三方组件 Element UI el-form-item。
        - description: 收集由受控 NetworkAdapter 读取的 HTTPS 单文件地址。
        - params: form.remoteUrl 保存远程脚本原地址。
        - events: el-input 双向更新 form.remoteUrl。
      -->
      <el-form-item
        v-if="form.importMethod === importMethods.remote"
        class="source-import-dialog__remote-field"
        label="HTTPS 脚本地址"
        required
      >
        <el-input
          v-model.trim="form.remoteUrl"
          class="source-import-dialog__remote-input"
          placeholder="https://example.com/source.js"
        />
      </el-form-item>

      <!--
        [IF form.importMethod === importMethods.text] ele(el-form-item.source-import-dialog__text-field)
        - condition: 用户选择粘贴文本导入时渲染。
        - type: 第三方组件 Element UI el-form-item。
        - description: 收集一份完整自包含 ES module 文本。
        - params: form.scriptContent 保存局部脚本文本；scriptTextareaRows 控制输入区高度。
        - events: el-input 双向更新 form.scriptContent。
      -->
      <el-form-item
        v-if="form.importMethod === importMethods.text"
        class="source-import-dialog__text-field"
        label="数据源脚本"
        required
      >
        <el-input
          v-model="form.scriptContent"
          class="source-import-dialog__text-input"
          type="textarea"
          :rows="scriptTextareaRows"
          placeholder="粘贴完整的单文件 JavaScript Provider"
        />
      </el-form-item>

      <!--
        [DEFAULT] ele(el-alert.source-import-dialog__persistence-alert)
        - condition: 输入阶段默认渲染。
        - type: 第三方组件 Element UI el-alert。
        - description: 说明脚本与授权结果的浏览器本地保存生命周期，并强调预检不会执行脚本。
        - params: 固定信息提示，不包含脚本或运行状态。
        - events: 无。
      -->
      <el-alert
        class="source-import-dialog__persistence-alert"
        title="导入后的脚本与授权结果保存在浏览器本地；预检只检查结构，不会执行脚本。"
        type="info"
        :closable="false"
        show-icon
      />
    </el-form>

    <!--
      [ELSE] ele(section.source-import-dialog__preview)
      - condition: 静态预检成功后渲染，替换输入表单。
      - type: 原生 section。
      - description: 展示不含脚本文本和可执行引用的信任前预览。
      - params: preview 由 Runtime 静态预检返回；两个 Boolean 只记录本次用户决定。
      - events: checkbox 和 switch 更新 riskAccepted、enableAfterImport。
    -->
    <section v-else class="source-import-dialog__preview">
      <header class="source-import-dialog__preview-header">
        <div class="source-import-dialog__preview-heading">
          <h2>{{ previewDisplayName }}</h2>
          <p>{{ preview.manifest.description }}</p>
        </div>
        <el-tag size="small" effect="plain">{{ preview.manifest.version }}</el-tag>
      </header>

      <dl class="source-import-dialog__preview-details">
        <div class="source-import-dialog__preview-row">
          <dt>数据源 ID</dt>
          <dd>{{ preview.manifest.id }}</dd>
        </div>
        <div class="source-import-dialog__preview-row">
          <dt>Provider</dt>
          <dd>{{ preview.manifest.providerKey }}</dd>
        </div>
        <div class="source-import-dialog__preview-row">
          <dt>导入来源</dt>
          <dd>{{ previewSourceLabel }}</dd>
        </div>
        <div class="source-import-dialog__preview-row">
          <dt>脚本大小</dt>
          <dd>{{ previewScriptSize }}</dd>
        </div>
        <div class="source-import-dialog__preview-row source-import-dialog__preview-row--stacked">
          <dt>页面能力</dt>
          <dd class="source-import-dialog__tag-list">
            <el-tag
              v-for="capability in previewCapabilities"
              :key="capability.key"
              size="small"
              effect="plain"
              :type="capability.enabled ? 'success' : 'info'"
            >
              {{ capability.label }} · {{ capability.enabled ? '支持' : '不支持' }}
            </el-tag>
          </dd>
        </div>
        <div class="source-import-dialog__preview-row source-import-dialog__preview-row--stacked">
          <dt>允许访问主机</dt>
          <dd class="source-import-dialog__tag-list">
            <el-tag
              v-for="networkHost in preview.manifest.networkHosts"
              :key="networkHost"
              size="small"
              effect="plain"
            >
              {{ networkHost }}
            </el-tag>
          </dd>
        </div>
        <div class="source-import-dialog__preview-row source-import-dialog__preview-row--stacked">
          <dt>SHA-256</dt>
          <dd class="source-import-dialog__hash">{{ preview.integrity.scriptHash }}</dd>
        </div>
      </dl>

      <el-alert
        class="source-import-dialog__risk-alert"
        :title="preview.executionRisk"
        type="warning"
        :closable="false"
        show-icon
      />

      <div class="source-import-dialog__decision-list">
        <el-checkbox v-model="riskAccepted" class="source-import-dialog__risk-confirmation">
          我已核对脚本来源，并接受上述运行风险
        </el-checkbox>
        <div class="source-import-dialog__enable-decision">
          <span>导入后启用</span>
          <el-switch
            v-model="enableAfterImport"
            active-text="启用"
            inactive-text="保持关闭"
          />
        </div>
      </div>
    </section>

    <!--
      [DEFAULT] ele(span.dialog-footer.source-import-dialog__footer)
      - condition: 默认渲染；内部按钮按 dialogPhase 互斥展示。
      - type: 原生 span。
      - description: 输入阶段执行静态预检，确认阶段返回修改或提交当前信任决定。
      - params: canPreview、canConfirmImport、previewPending；footerControlKeys 为互斥阶段按钮提供独立渲染身份。
      - events: 按钮调用 closeDialog()、previewSource()、returnToInput() 或 confirmImport()。
    -->
    <span slot="footer" class="dialog-footer source-import-dialog__footer">
      <el-button
        v-if="dialogPhase === dialogPhases.input"
        :key="footerControlKeys.inputCancel"
        @click="closeDialog"
      >
        取消
      </el-button>
      <el-button
        v-if="dialogPhase === dialogPhases.input"
        :key="footerControlKeys.inputPreview"
        type="primary"
        :loading="previewPending"
        :disabled="!canPreview"
        @click="previewSource"
      >
        预检脚本
      </el-button>
      <el-button
        v-if="dialogPhase === dialogPhases.preview"
        :key="footerControlKeys.previewBack"
        @click="returnToInput"
      >
        返回修改
      </el-button>
      <el-button
        v-if="dialogPhase === dialogPhases.preview"
        :key="footerControlKeys.previewConfirm"
        type="primary"
        :disabled="!canConfirmImport"
        @click="confirmImport"
      >
        确认导入
      </el-button>
    </span>
  </el-dialog>
</template>

<script>
/*
  SourceImportDialog.vue 模块说明

  - 文件职责:
      管理数据源三入口输入、信任前静态预检和本次用户风险决定。
      组件只保留弹窗局部脚本文本与预览，不保存 SourceManagerState、manifest 影子副本或 Repository 对象。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      IMPORT_METHOD、previewCustomSourceImport: 自定义设置服务，提供导入枚举和唯一预检入口。
      SETTINGS_DIALOG_WIDTH: 自定义配置，提供响应式导入弹窗宽度。
      CAPABILITY_DEFINITIONS: 自定义展示配置，按统一顺序显示 manifest 页面能力。
      formatSourceDisplayName: 自定义显示适配器，限制导入预览名称长度。

  - 模块级常量:
      ACCEPTED_FILE_TYPES: string，文件选择器允许扩展名。
      SCRIPT_TEXTAREA_ROWS: number，粘贴脚本文本框行数。
      IMPORT_DIALOG_PHASE: object，输入和预览两阶段枚举。
      IMPORT_FOOTER_CONTROL_KEY: object，四个互斥阶段按钮的稳定渲染身份。
      IMPORT_METHOD_LABEL: object，三种导入方式展示文案。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDefaultForm(): 创建四字段三入口输入。

  - 模块级类:
      无

  - 对外导出:
      默认 Vue 组件配置: object，供 SourceManagementPanel 渲染数据源导入弹窗。
*/

import {
  // 导入来源: ../../services/settingsService.js。
  // 导入内容: IMPORT_METHOD 三种导入方式枚举。
  // 文件作用: 表单分支和提交值不使用自由字符串。
  IMPORT_METHOD,

  // 导入来源: ../../services/settingsService.js。
  // 导入内容: previewCustomSourceImport 设置页预检服务。
  // 文件作用: 输入阶段只通过 Runtime 加载边界取得无脚本文本预览。
  previewCustomSourceImport
} from '../../services/settingsService.js';

// 导入来源: ../../config/settings-module.config.js。
// 导入内容: SETTINGS_DIALOG_WIDTH 设置模块弹窗宽度。
// 文件作用: 使用统一响应式宽度，不在组件散落视口尺寸。
import { SETTINGS_DIALOG_WIDTH } from '../../config/settings-module.config.js';

// 导入来源: ../../utils/settingsDisplay.js。
// 导入内容: CAPABILITY_DEFINITIONS 页面能力展示定义。
// 文件作用: 预览和数据源详情使用相同能力键顺序与文案。
import { CAPABILITY_DEFINITIONS } from '../../utils/settingsDisplay.js';

// 导入来源: ../../utils/sourceDisplayName.js。
// 导入内容: formatSourceDisplayName 数据源显示名称适配函数。
// 文件作用: 让信任确认阶段的 manifest 名称遵守全站十个 Unicode 字符显示边界。
import { formatSourceDisplayName } from '../../utils/sourceDisplayName.js';

// 类型: string。
// 作用: 文件入口默认筛选 JavaScript 模块与允许用户保存脚本的纯文本文件。
const ACCEPTED_FILE_TYPES = '.js,.mjs,.txt';

// 类型: number。
// 作用: 控制粘贴脚本输入区可见行数，避免弹窗初始高度挤压操作区。
const SCRIPT_TEXTAREA_ROWS = 10;

// 类型: object。
// 作用: 固定导入交互只有输入和预览两个阶段，不从按钮文案或 Boolean 反推状态。
const IMPORT_DIALOG_PHASE = Object.freeze({
  // 类型: string；作用: 显示三入口原始载荷表单。
  input: 'input',
  // 类型: string；作用: 显示静态 manifest、风险和启用决定。
  preview: 'preview'
});

// 类型: object。
// 作用: 为输入与确认阶段的同类型 Element UI 按钮提供互斥渲染身份，避免 Vue 复用组件实例后保留上一阶段的 disabled 状态。
const IMPORT_FOOTER_CONTROL_KEY = Object.freeze({
  // 类型: string；作用: 标识输入阶段取消按钮。
  inputCancel: 'source-import-input-cancel',
  // 类型: string；作用: 标识输入阶段静态预检按钮。
  inputPreview: 'source-import-input-preview',
  // 类型: string；作用: 标识确认阶段返回修改按钮。
  previewBack: 'source-import-preview-back',
  // 类型: string；作用: 标识确认阶段正式导入按钮。
  previewConfirm: 'source-import-preview-confirm'
});

// 类型: object。
// 作用: 把导入枚举映射为预览来源文案，模板不散落条件三目。
const IMPORT_METHOD_LABEL = Object.freeze({
  // 类型: string；作用: 文件入口来源标签。
  [IMPORT_METHOD.file]: '本地文件',
  // 类型: string；作用: HTTPS 远程入口来源标签。
  [IMPORT_METHOD.remote]: '在线地址',
  // 类型: string；作用: 粘贴文本入口来源标签。
  [IMPORT_METHOD.text]: '粘贴文本'
});

/**
 * 创建三入口共同输入默认值。
 * 纯函数: 每次返回新的四字段普通对象，不共享脚本文本引用。
 *
 * @returns {object} importMethod、remoteUrl、originalFileName 和 scriptContent。
 */
function createDefaultForm() {
  return {
    // 类型: string；作用: 首次打开默认显示文件入口。
    importMethod: IMPORT_METHOD.file,
    // 类型: string；作用: remote 入口保存用户输入的 HTTPS 地址，其他入口保持空。
    remoteUrl: '',
    // 类型: string；作用: file 入口保存浏览器返回的原文件名，其他入口保持空。
    originalFileName: '',
    // 类型: string；作用: file/text 入口保存局部脚本文本，remote 入口保持空。
    scriptContent: ''
  };
}

export default {
  // 类型: string；作用: 供 Vue Devtools 和错误堆栈识别导入弹窗。
  name: 'SourceImportDialog',

  props: {
    // 类型: boolean；来源: SourceManagementPanel。
    // true 显示并开始一轮全新导入；false 隐藏且不提交任何状态。
    visible: { type: Boolean, default: false }
  },

  /**
   * 创建弹窗局部输入、预览和用户决定状态。
   * 副作用: 仅创建当前组件响应式字段，不读取或修改共享数据源状态。
   *
   * @returns {object} 当前弹窗局部状态。
   */
  data() {
    return {
      // 类型: object；来源: createDefaultForm；作用: 只保存当前弹窗四字段原始输入。
      form: createDefaultForm(),
      // 类型: string；来源: IMPORT_DIALOG_PHASE；作用: 控制输入或预览渲染分支。
      dialogPhase: IMPORT_DIALOG_PHASE.input,
      // 类型: object|null；来源: Runtime 静态预检；作用: 只保存无脚本文本信任预览。
      preview: null,
      // 类型: boolean；true 表示预检网络/解析尚未收敛，false 允许再次发起；只由 previewSource 修改。
      previewPending: false,
      // 类型: boolean；true 表示用户接受本次预览指纹对应风险，false 禁止正式导入；只由 checkbox 修改。
      riskAccepted: false,
      // 类型: boolean；true 要求导入后立即启用，false 保持关闭；只由 switch 修改。
      enableAfterImport: false,
      // 类型: number；来源: 每次打开递增；作用: 强制原生 file input 丢弃上轮文件选择。
      fileInputRevision: 0,
      // 类型: object；作用: 模板使用冻结导入方式枚举。
      importMethods: IMPORT_METHOD,
      // 类型: object；作用: 模板使用冻结两阶段枚举。
      dialogPhases: IMPORT_DIALOG_PHASE,
      // 类型: object；作用: 模板为四个互斥阶段按钮绑定稳定且互不相同的 Vue 渲染身份。
      footerControlKeys: IMPORT_FOOTER_CONTROL_KEY,
      // 类型: string；作用: 原生文件输入 accept 属性。
      acceptedFileTypes: ACCEPTED_FILE_TYPES,
      // 类型: number；作用: Element UI textarea 可见行数。
      scriptTextareaRows: SCRIPT_TEXTAREA_ROWS
    };
  },

  computed: {
    /**
     * 派生静态预检结果的用户界面短名称。
     * 纯函数: 不修改 preview.manifest 完整名称，只返回确认页展示文本。
     *
     * @returns {string} 十个 Unicode 字符以内的数据源名称。
     */
    previewDisplayName() {
      return formatSourceDisplayName(this.preview?.manifest?.name, this.preview?.manifest?.id);
    },

    /**
     * 读取当前阶段弹窗标题。
     * 纯函数: 只依赖 dialogPhase，不修改局部状态。
     *
     * @returns {string} 输入阶段或信任确认阶段标题。
     */
    dialogTitle() {
      return this.dialogPhase === IMPORT_DIALOG_PHASE.input
        ? '导入数据源'
        : '确认数据源';
    },

    /**
     * 读取导入弹窗响应式宽度。
     * 纯函数: 只读取 SETTINGS_DIALOG_WIDTH.importSource。
     *
     * @returns {string} Element UI el-dialog 宽度。
     */
    dialogWidth() {
      return SETTINGS_DIALOG_WIDTH.importSource;
    },

    /**
     * 判断当前入口是否具备预检所需载荷。
     * 纯函数: 不规范化或修改文本，最终容量、协议和语法仍由 Runtime 校验。
     *
     * @returns {boolean} true 允许发起预检，false 禁用按钮。
     */
    canPreview() {
      // 条件分支: 文件入口只有 FileReader 已返回非空文本时允许预检。
      // 执行内容: 同时要求原文件名和已读取正文存在，避免提交空文件。
      if (this.form.importMethod === IMPORT_METHOD.file) {
        return Boolean(this.form.originalFileName && this.form.scriptContent.trim());
      }

      // 条件分支: 远程入口只要求地址非空；HTTPS、容量和响应类型由读取器校验。
      // 执行内容: 返回地址存在状态，不在组件复制 URL 协议规则。
      if (this.form.importMethod === IMPORT_METHOD.remote) {
        return Boolean(this.form.remoteUrl);
      }

      // 条件分支: 文本入口要求去空白后仍有脚本文本。
      // 执行内容: 返回正文存在状态，语法与容量继续交给 Runtime。
      if (this.form.importMethod === IMPORT_METHOD.text) {
        return Boolean(this.form.scriptContent.trim());
      }

      // 返回值类型: boolean；作用: 未知枚举失败关闭。
      return false;
    },

    /**
     * 判断用户是否可以提交当前预览。
     * 纯函数: 只采用 Runtime readyForTrust 和用户 checkbox 决定，不把启用开关当作信任。
     *
     * @returns {boolean} true 允许正式导入，false 禁止执行脚本。
     */
    canConfirmImport() {
      return Boolean(
        this.preview
        && this.preview.readyForTrust === true
        && this.riskAccepted === true
      );
    },

    /**
     * 按统一能力定义生成预览 Chip。
     * 纯函数: 不修改 manifest.capabilities 或展示定义。
     *
     * @returns {Array<object>} key、label 和 enabled 的稳定顺序数组。
     */
    previewCapabilities() {
      // 条件分支: 尚未取得预览时进入。
      // 执行内容: 返回空列表，模板不访问不存在的 manifest。
      if (!this.preview) return [];
      return CAPABILITY_DEFINITIONS.map(capability => ({
        key: capability.key,
        label: capability.label,
        enabled: this.preview.manifest.capabilities[capability.key] === true
      }));
    },

    /**
     * 生成用户可识别的预览来源说明。
     * 纯函数: 来源标签来自枚举映射，文件名和 URL 来自无脚本文本预览。
     *
     * @returns {string} 来源方式及其定位信息。
     */
    previewSourceLabel() {
      // 条件分支: 尚未取得预览时进入。
      // 执行内容: 返回空文本，避免读取来源字段。
      if (!this.preview) return '';
      // 类型: string。
      // 作用: 保存冻结枚举对应来源文案，未知方式失败关闭为空文本。
      const methodLabel = IMPORT_METHOD_LABEL[this.preview.importMethod] || '';
      // 类型: string。
      // 作用: 文件优先显示文件名，远程显示 URL，文本入口保持空定位信息。
      const sourceLocation = this.preview.originalFileName || this.preview.remoteUrl;
      return sourceLocation ? `${methodLabel} · ${sourceLocation}` : methodLabel;
    },

    /**
     * 格式化预览脚本 UTF-8 字节数。
     * 纯函数: 不执行容量换算或改变 Runtime 的 1 MiB 校验语义。
     *
     * @returns {string} 带千位分隔的字节文本。
     */
    previewScriptSize() {
      return this.preview ? `${this.preview.scriptBytes.toLocaleString('zh-CN')} B` : '';
    }
  },

  watch: {
    /**
     * 在每次打开时重建完整局部导入会话。
     * 副作用: 清空脚本文本、预览和用户决定，并递增 file input 渲染代次。
     * false 分支: 关闭动画期间保留当前节点，不额外修改状态。
     *
     * @param {boolean} visible 新可见状态。
     * @returns {void} 状态重置完成后结束。
     */
    visible(visible) {
      // 条件分支: 弹窗正在关闭时进入。
      // 执行内容: 保留关闭动画节点，下一次打开再统一重建局部会话。
      if (!visible) return;
      this.form = createDefaultForm();
      this.dialogPhase = IMPORT_DIALOG_PHASE.input;
      this.preview = null;
      this.previewPending = false;
      this.riskAccepted = false;
      this.enableAfterImport = false;
      this.fileInputRevision += 1;
    }
  },

  methods: {
    /**
     * 创建交给 service 的四字段原始输入。
     * 纯函数: 复制当前四字段表单，不返回响应式 form 引用；入口互斥字段由 settingsService 唯一规范化。
     *
     * @returns {object} importMethod、remoteUrl、originalFileName 和 scriptContent。
     */
    createImportInput() {
      // 返回值类型: object。
      // 作用: 返回与响应式 form 隔离的浅层四字段输入，所有字段均为标量字符串。
      return {
        importMethod: this.form.importMethod,
        remoteUrl: this.form.remoteUrl,
        originalFileName: this.form.originalFileName,
        scriptContent: this.form.scriptContent
      };
    },

    /**
     * 关闭导入弹窗。
     * 触发来源: el-dialog close 或输入阶段取消按钮。
     * 副作用: 发出 update:visible(false)，不提交脚本、预览或用户决定。
     *
     * @returns {void} 关闭意图通过事件交给父页面。
     */
    closeDialog() {
      this.$emit('update:visible', false);
    },

    /**
     * 读取用户选择的本地脚本文件。
     * 副作用: 使用 FileReader 在浏览器内读取文本并写入当前局部表单。
     * 成功路径: 保存原文件名和字符串正文。
     * 失败路径: 清空两个文件字段并显示用户错误，不发起预检。
     *
     * @param {Event} event 原生 file input change 事件。
     * @returns {void} 异步结果由 FileReader 回调采用。
     */
    readSelectedFile(event) {
      // 类型: File|null。
      // 作用: 保存用户明确选择的第一份本地文件；没有选择时为 null。
      const file = event.target.files && event.target.files.length > 0
        ? event.target.files[0]
        : null;
      // 条件分支: 本次 change 没有有效文件时进入。
      // 执行内容: 保持现有表单，不创建 FileReader。
      if (!file) return;

      // 类型: FileReader；作用: 只在当前浏览器读取用户文件，不上传或持久化。
      const reader = new FileReader();
      reader.onload = () => {
        // 条件分支: 浏览器必须返回字符串文本；其他结果失败关闭为不可预检状态。
        this.form.scriptContent = typeof reader.result === 'string' ? reader.result : '';
        this.form.originalFileName = this.form.scriptContent ? file.name : '';
      };
      reader.onerror = () => {
        this.form.originalFileName = '';
        this.form.scriptContent = '';
        this.$message.error('读取脚本文件失败');
      };
      // 异步调用: 浏览器按文本读取；编码、LF 和容量仍由 SourcePackageInputReader 统一规范化。
      reader.readAsText(file);
    },

    /**
     * 对当前原始输入执行信任前静态预检。
     * 触发来源: 输入阶段“预检脚本”按钮。
     * 副作用: remote 入口可能发起受控网络请求；成功只保存无脚本文本预览。
     * 成功路径: 采用预览并进入风险确认阶段。
     * 失败路径: 显示稳定加载错误并停留输入阶段，finally 恢复按钮状态。
     *
     * @returns {Promise<void>} 预检请求和局部状态采用完成后兑现。
     */
    async previewSource() {
      // 条件分支: 当前载荷不完整或已有预检正在执行时进入。
      // 执行内容: 不发起重复 Runtime 意图。
      if (!this.canPreview || this.previewPending) return;
      this.previewPending = true;
      try {
        // 类型: object。
        // 作用: 保存 service 返回的无脚本文本静态预览，用户确认前不执行模块。
        const preview = await previewCustomSourceImport(this.createImportInput());
        this.preview = preview;
        this.riskAccepted = false;
        this.enableAfterImport = false;
        this.dialogPhase = IMPORT_DIALOG_PHASE.preview;
      } catch (error) {
        // 展示边界: 只显示加载器安全 message；未知错误使用固定文案，不读取 cause 或 stack。
        this.$message.error(error && error.message ? error.message : '数据源脚本预检失败');
      } finally {
        // 状态收敛: 无论成功或失败都允许用户修改输入后重新预检。
        this.previewPending = false;
      }
    },

    /**
     * 从预览阶段返回原始输入阶段。
     * 副作用: 清除旧预览和风险决定，但保留用户输入供修改。
     *
     * @returns {void} 局部阶段切换完成后结束。
     */
    returnToInput() {
      this.dialogPhase = IMPORT_DIALOG_PHASE.input;
      this.preview = null;
      this.riskAccepted = false;
      this.enableAfterImport = false;
    },

    /**
     * 提交当前预览对应的正式导入请求。
     * 触发来源: 用户接受风险后点击“确认导入”。
     * 副作用: 发出原始输入和精确 trustDecision；父页面调用 Runtime 重新读取和核对 SHA-256。
     * 失败路径: 预览或风险确认失效时保持弹窗，不发出事件。
     *
     * @returns {void} 导入请求通过 confirm 事件交给父页面。
     */
    confirmImport() {
      // 条件分支: 预览失效或用户尚未接受风险时进入。
      // 执行内容: 保持弹窗并禁止正式加载执行。
      if (!this.canConfirmImport) return;
      this.$emit('confirm', {
        input: this.createImportInput(),
        trustDecision: {
          trustedScriptHash: this.preview.integrity.scriptHash,
          enableAfterImport: this.enableAfterImport
        }
      });
      this.closeDialog();
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 数据源导入弹窗 `.source-import-dialog`。
  样式作用: 集中定义当前组件内部间距、字号、行高和标签列尺寸，子区域不重复维护数值。
*/
.source-import-dialog {
  /* 类型: length；作用: 标题与说明等紧邻内容的最小间距。 */
  --source-import-gap-xs: 6px;
  /* 类型: length；作用: 文件提示与紧凑 Chip 集合间距。 */
  --source-import-gap-sm: 8px;
  /* 类型: length；作用: 字段列、决定行和标题区标准间距。 */
  --source-import-gap-md: 12px;
  /* 类型: length；作用: 预览主要语义区域纵向间距。 */
  --source-import-gap-lg: 16px;
  /* 类型: length；作用: 桌面详情字段名固定扫描宽度。 */
  --source-import-label-width: 108px;
  /* 类型: length；作用: 详情行上下内边距。 */
  --source-import-row-padding: 10px;
  /* 类型: length；作用: 弹窗区块标题字号。 */
  --source-import-heading-size: 18px;
  /* 类型: length；作用: 预览详情和说明正文辅助字号。 */
  --source-import-body-size: 13px;
  /* 类型: length；作用: 文件选择提示的弱信息字号。 */
  --source-import-hint-size: 12px;
  /* 类型: number；作用: 多行 manifest 说明的稳定可读行高。 */
  --source-import-description-line-height: 1.6;
}

/*
  作用容器: 导入方式单选组 `.source-import-dialog__method-group`。
  样式作用: 让三个互斥入口在窄弹窗中允许换行，避免文字溢出。
*/
.source-import-dialog__method-group {
  /* 使用弹性布局保持入口按钮在同一操作组内。 */
  display: flex;
  /* 窄宽度下允许按钮换行，不横向撑破弹窗。 */
  flex-wrap: wrap;
}

/*
  作用容器: 原生脚本文件选择器 `.source-import-dialog__file`。
  样式作用: 使用完整表单宽度展示文件控件和文件名。
*/
.source-import-dialog__file {
  /* 使用块级布局避免与后续文件名同行。 */
  display: block;
  /* 让浏览器文件控件使用完整字段宽度。 */
  width: 100%;
  /* 使用主题次级文本色保持表单层级。 */
  color: var(--text-secondary);
}

/*
  作用容器: 已选文件提示 `.source-import-dialog__hint`。
  样式作用: 在文件控件下方显示当前读取对象，不抢占主要标签层级。
*/
.source-import-dialog__hint {
  /* 仅在文件控件下方保留轻量间距。 */
  margin: var(--source-import-gap-sm) 0 0;
  /* 使用主题弱文本色表达辅助信息。 */
  color: var(--text-muted);
  /* 使用辅助信息字号控制视觉层级。 */
  font-size: var(--source-import-hint-size);
}

/*
  作用容器: 预览根区域 `.source-import-dialog__preview`。
  样式作用: 使用纵向间距组织身份、详情、风险和决定区域，不创建嵌套卡片。
*/
.source-import-dialog__preview {
  /* 使用 Grid 建立稳定纵向信息流。 */
  display: grid;
  /* 使用项目间距令牌分隔四个语义区域。 */
  gap: var(--source-import-gap-lg);
}

/*
  作用容器: 预览标题区 `.source-import-dialog__preview-header`。
  样式作用: 让名称说明占据剩余空间，版本 Chip 保持右侧可扫描位置。
*/
.source-import-dialog__preview-header {
  /* 使用弹性布局组合标题与版本。 */
  display: flex;
  /* 在主轴两端放置说明和版本。 */
  justify-content: space-between;
  /* 从顶部对齐，长说明换行时版本位置稳定。 */
  align-items: flex-start;
  /* 使用项目间距令牌避免标题贴近版本。 */
  gap: var(--source-import-gap-md);
}

/*
  作用容器: 预览标题文字区 `.source-import-dialog__preview-heading`。
  样式作用: 允许标题和说明在 Flex 容器内正常收缩换行。
*/
.source-import-dialog__preview-heading {
  /* 允许长名称在可用宽度内收缩，不推开版本标签。 */
  min-width: 0;
}

/*
  作用容器: 预览主标题 `.source-import-dialog__preview-heading h2`。
  样式作用: 使用弹窗内部标题尺度，不采用页面英雄字号。
*/
.source-import-dialog__preview-heading h2 {
  /* 清除浏览器默认外边距，间距由父 Grid 统一控制。 */
  margin: 0;
  /* 使用紧凑区块标题字号。 */
  font-size: var(--source-import-heading-size);
  /* 保持标准字距，不通过负字距压缩标题。 */
  letter-spacing: 0;
  /* 允许超长单词或标识在弹窗内换行。 */
  overflow-wrap: anywhere;
}

/*
  作用容器: 预览说明 `.source-import-dialog__preview-heading p`。
  样式作用: 在标题下以次级文本呈现 manifest 描述。
*/
.source-import-dialog__preview-heading p {
  /* 在标题下方保留轻量间距并清除其他默认外边距。 */
  margin: var(--source-import-gap-xs) 0 0;
  /* 使用主题次级文本色降低说明层级。 */
  color: var(--text-secondary);
  /* 使用正文辅助字号保持可读性。 */
  font-size: var(--source-import-body-size);
  /* 使用稳定行高支持多行说明。 */
  line-height: var(--source-import-description-line-height);
}

/*
  作用容器: 预览详情列表 `.source-import-dialog__preview-details`。
  样式作用: 使用分隔线组织可扫描字段，不把每个字段做成卡片。
*/
.source-import-dialog__preview-details {
  /* 清除描述列表默认外边距。 */
  margin: 0;
  /* 使用主题边框建立详情区上下边界。 */
  border-top: 1px solid var(--border-color);
}

/*
  作用容器: 单条详情 `.source-import-dialog__preview-row`。
  样式作用: 使用固定标签列与自适应内容列对齐身份和来源字段。
*/
.source-import-dialog__preview-row {
  /* 使用 Grid 固定标签列并让内容列占据剩余宽度。 */
  display: grid;
  /* 标签宽度保持扫描对齐，内容允许收缩。 */
  grid-template-columns: var(--source-import-label-width) minmax(0, 1fr);
  /* 使用项目间距令牌分隔标签与内容。 */
  gap: var(--source-import-gap-md);
  /* 为每条字段提供稳定纵向点击和阅读空间。 */
  padding: var(--source-import-row-padding) 0;
  /* 使用主题边框分隔相邻字段。 */
  border-bottom: 1px solid var(--border-color);
}

/*
  作用容器: 详情标签 `.source-import-dialog__preview-row dt`。
  样式作用: 以次级文本标识字段名称。
*/
.source-import-dialog__preview-row dt {
  /* 使用主题次级文本色区分字段名与值。 */
  color: var(--text-secondary);
  /* 使用稳定正文辅助字号。 */
  font-size: var(--source-import-body-size);
}

/*
  作用容器: 详情内容 `.source-import-dialog__preview-row dd`。
  样式作用: 清除默认缩进并允许 URL、ID 和 ProviderKey 安全换行。
*/
.source-import-dialog__preview-row dd {
  /* 清除描述列表默认左外边距。 */
  margin: 0;
  /* 使用主要文本色突出真实值。 */
  color: var(--text-primary);
  /* 使用稳定正文辅助字号。 */
  font-size: var(--source-import-body-size);
  /* 允许长身份和 URL 在内容列内换行。 */
  overflow-wrap: anywhere;
}

/*
  作用容器: Chip 集合 `.source-import-dialog__tag-list`。
  样式作用: 让能力和 host 标签按可用宽度换行且间距稳定。
*/
.source-import-dialog__tag-list {
  /* 使用弹性布局排列数量变化的标签。 */
  display: flex;
  /* 窄弹窗允许标签换行，不产生横向滚动。 */
  flex-wrap: wrap;
  /* 使用项目紧凑间距令牌分隔标签。 */
  gap: var(--source-import-gap-sm);
}

/*
  作用容器: SHA-256 文本 `.source-import-dialog__hash`。
  样式作用: 使用等宽字体并允许摘要按任意位置换行，保持字符可核对。
*/
.source-import-dialog__hash {
  /* 使用系统等宽字体增强摘要字符对齐。 */
  font-family: Consolas, "Courier New", monospace;
  /* 允许 64 位摘要在手机宽度内换行。 */
  overflow-wrap: anywhere;
}

/*
  作用容器: 用户决定区 `.source-import-dialog__decision-list`。
  样式作用: 将风险确认与启用选择分行组织，保持操作含义清楚。
*/
.source-import-dialog__decision-list {
  /* 使用 Grid 建立两行稳定决定布局。 */
  display: grid;
  /* 使用项目间距令牌分隔两项决定。 */
  gap: var(--source-import-gap-md);
}

/*
  作用容器: 启用决定行 `.source-import-dialog__enable-decision`。
  样式作用: 左侧显示设置名称，右侧使用 Switch 表达导入后启停二选一。
*/
.source-import-dialog__enable-decision {
  /* 使用弹性布局组织标签与二元开关。 */
  display: flex;
  /* 把设置名称和开关分置两端。 */
  justify-content: space-between;
  /* 垂直居中标签与 Element UI Switch。 */
  align-items: center;
  /* 使用项目间距令牌避免窄宽度内容相贴。 */
  gap: var(--source-import-gap-md);
}

/*
  作用容器: 手机视口下的导入预览。
  样式作用: 把详情改为单列，避免固定标签列挤压长地址和 SHA-256。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机详情行 `.source-import-dialog__preview-row`。
    样式作用: 标签和值改为上下排列，保留完整可读宽度。
  */
  .source-import-dialog__preview-row {
    /* 使用单列网格让字段名和值依次换行。 */
    grid-template-columns: minmax(0, 1fr);
    /* 缩小同一字段内部间距，保持弹窗信息密度。 */
    gap: var(--source-import-gap-xs);
  }

  /*
    作用容器: 手机预览标题区 `.source-import-dialog__preview-header`。
    样式作用: 名称和版本上下排列，避免长名称与版本相互挤压。
  */
  .source-import-dialog__preview-header {
    /* 将标题和版本改为纵向布局。 */
    flex-direction: column;
  }

  /*
    作用容器: 手机启用决定行 `.source-import-dialog__enable-decision`。
    样式作用: 设置名称与开关上下排列，防止 Switch 文案溢出。
  */
  .source-import-dialog__enable-decision {
    /* 将设置名称和开关改为纵向布局。 */
    flex-direction: column;
    /* 左对齐两项内容，保持自然阅读顺序。 */
    align-items: flex-start;
  }
}
</style>
