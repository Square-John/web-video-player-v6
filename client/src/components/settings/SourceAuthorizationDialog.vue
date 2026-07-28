<template>
  <!--
    SourceAuthorizationDialog 组件渲染树

    [DEFAULT] ele(el-dialog.source-authorization-dialog-shell)
    │  - condition:
    │      默认渲染；visible 为 true 时由 Element UI 展示弹窗内容。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-dialog
    │  - description:
    │      自定义数据源授权弹窗。
    │      在无沙盒阶段向用户说明脚本运行风险，并让用户自主决定是否授权启用。
    │  - params:
    │      -- visible：父组件传入的可见状态，控制弹窗显示和隐藏。
    │      -- dialogWidth：根据统一配置取得的响应式宽度。
    │  - events:
    │      @close
    │          - description:
    │              当用户点击关闭图标、取消按钮或其他合法关闭入口时触发。
    │              用于通知父组件收起当前授权弹窗。
    │          - methods:
    │              closeDialog()
    │                  -- 无参数。
    │
    ├─ [IF record] ele(div.source-authorization-dialog)
    │  - condition:
    │      record 存在时渲染，避免待授权记录缺失时读取 definition 导致异常。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      授权说明内容区。
    │      展示脚本名称、导入来源、版本、无沙盒风险和用户确认项。
    │  - params:
    │      -- record.definition：待授权数据源定义，提供名称、版本和导入方式。
    │      -- importMethodText：由导入方式派生的用户可读文案。
    │      -- accepted：用户是否已主动确认风险的局部状态。
    │  - events:
    │      无
    │  │
    │  ├─ [DEFAULT] ele(p.source-authorization-dialog__lead)
    │  │  - condition:
    │  │      record 存在后默认渲染。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: p
    │  │  - description:
    │  │      授权说明首段。
    │  │      标明当前脚本名称和项目尚未提供脚本沙盒隔离的事实。
    │  │  - params:
    │  │      -- record.definition.name：待授权数据源名称。
    │  │  - events:
    │  │      无
    │  │
    │  ├─ [DEFAULT] ele(p.source-authorization-dialog__warning)
    │  │  - condition:
    │  │      record 存在后默认渲染。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: p
    │  │  - description:
    │  │      脚本风险提示。
    │  │      提醒用户只授权自己编写或确认来源可信的脚本。
    │  │  - params:
    │  │      无
    │  │  - events:
    │  │      无
    │  │
    │  ├─ [DEFAULT] ele(dl.source-authorization-dialog__meta)
    │  │  - condition:
    │  │      record 存在后默认渲染。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: dl
    │  │  - description:
    │  │      脚本元信息列表。
    │  │      展示脚本导入来源和版本，辅助用户核对待授权对象。
    │  │  - params:
    │  │      -- importMethodText：脚本导入方式的展示文案。
    │  │      -- record.definition.version：待授权脚本版本。
    │  │  - events:
    │  │      无
    │  │
    │  └─ [DEFAULT] ele(el-checkbox.source-authorization-dialog__acceptance)
    │     - condition:
    │         record 存在后默认渲染。
    │     - type:
    │         第三方组件
    │         组件库: Element UI
    │         组件名称: el-checkbox
    │     - description:
    │         用户风险确认项。
    │         把用户主动选择同步到 accepted，并据此控制授权按钮是否可用。
    │     - params:
    │         -- accepted：双向绑定的风险确认状态。
    │     - events:
    │         无
    │
    └─ [DEFAULT] ele(span.dialog-footer)
       - condition:
           默认渲染。
       - type:
           原生标签
           标签名称: span
       - description:
           授权弹窗操作区。
           提供取消和授权并启用操作，未确认风险时禁用授权按钮。
       - params:
           -- accepted：控制授权并启用按钮的禁用状态。
       - events:
           无
  -->
  <!--
    [DEFAULT] ele(el-dialog.source-authorization-dialog-shell)
    - condition:
        默认渲染；visible 为 true 时由 Element UI 展示弹窗内容。
    - type:
        第三方组件
        组件库: Element UI
        组件名称: el-dialog
    - description:
        自定义数据源授权弹窗。
        承载风险说明、确认项和授权操作，并通过事件把用户决定交给父组件处理。
    - params:
        -- visible：父组件传入的弹窗可见状态。
        -- dialogWidth：统一配置提供的响应式弹窗宽度。
    - events:
        @close
            - description:
                用户关闭弹窗时触发，用于同步父组件的 visible 状态。
            - methods:
                closeDialog()
                    -- 无参数。
  -->
  <el-dialog
    class="source-authorization-dialog-shell"
    title="启用自定义数据源"
    :visible="visible"
    :width="dialogWidth"
    :close-on-click-modal="false"
    @close="closeDialog"
  >
    <!--
      [IF record] ele(div.source-authorization-dialog)
      - condition:
          record 存在时渲染，保证模板只读取有效的数据源定义。
      - type:
          原生标签
          标签名称: div
      - description:
          授权说明内容区。
          汇总脚本身份、风险信息、元信息和用户风险确认项。
      - params:
          -- record.definition：待授权数据源定义。
          -- importMethodText：当前导入方式的展示文案。
          -- accepted：用户风险确认状态。
      - events:
          无
    -->
    <div v-if="record" class="source-authorization-dialog">
      <!--
        [DEFAULT] ele(p.source-authorization-dialog__lead)
        - condition:
            record 存在后默认渲染。
        - type:
            原生标签
            标签名称: p
        - description:
            授权说明首段，标明目标脚本和当前无沙盒隔离的事实。
        - params:
            -- record.definition.name：待授权数据源名称。
        - events:
            无
      -->
      <p class="source-authorization-dialog__lead">
        “{{ record.definition.name }}”包含可执行脚本，当前版本未提供脚本沙盒隔离。
      </p>
      <!--
        [DEFAULT] ele(p.source-authorization-dialog__warning)
        - condition:
            record 存在后默认渲染。
        - type:
            原生标签
            标签名称: p
        - description:
            脚本风险提示，说明用户应自行判断脚本来源是否可信。
        - params:
            无
        - events:
            无
      -->
      <p class="source-authorization-dialog__warning">
        请只启用你自己编写或确认来源可信的脚本。项目无法替你判断第三方脚本是否安全。
      </p>
      <!--
        [DEFAULT] ele(dl.source-authorization-dialog__meta)
        - condition:
            record 存在后默认渲染。
        - type:
            原生标签
            标签名称: dl
        - description:
            脚本元信息列表，展示导入方式和版本供用户核对。
        - params:
            -- importMethodText：当前脚本导入方式文案。
            -- record.definition.version：当前脚本版本。
        - events:
            无
      -->
      <dl class="source-authorization-dialog__meta">
        <dt>脚本来源</dt>
        <dd>{{ importMethodText }}</dd>
        <dt>脚本版本</dt>
        <dd>{{ record.definition.version }}</dd>
      </dl>
      <!--
        [DEFAULT] ele(el-checkbox.source-authorization-dialog__acceptance)
        - condition:
            record 存在后默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-checkbox
        - description:
            用户风险确认项，把用户选择同步为授权按钮的可用条件。
        - params:
            -- accepted：双向绑定的风险确认状态。
        - events:
            无
      -->
      <el-checkbox v-model="accepted" class="source-authorization-dialog__acceptance">
        我已了解风险，并决定授权运行该脚本
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
          授权弹窗操作区，提供取消和授权并启用入口。
      - params:
          -- accepted：控制授权按钮是否禁用。
      - events:
          无
    -->
    <span slot="footer" class="dialog-footer">
      <!--
        [DEFAULT] ele(el-button.source-authorization-dialog__cancel)
        - condition:
            默认渲染。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            取消按钮，不写入授权状态并关闭弹窗。
        - params:
            无
        - events:
            @click
                - description:
                    用户点击取消按钮时触发，用于放弃本次授权并收起弹窗。
                - methods:
                    closeDialog()
                        -- 无参数。
      -->
      <el-button class="source-authorization-dialog__cancel" @click="closeDialog">取消</el-button>
      <!--
        [DEFAULT] ele(el-button.source-authorization-dialog__confirm)
        - condition:
            默认渲染；accepted 为 false 时保持禁用。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            授权并启用按钮，在用户确认风险后提交当前数据源标识。
        - params:
            -- accepted：取反后绑定 disabled，防止未确认风险时提交授权。
        - events:
            @click
                - description:
                    用户确认风险并点击按钮时触发，用于提交当前数据源授权。
                - methods:
                    confirmAuthorization()
                        -- 无参数。
      -->
      <el-button
        class="source-authorization-dialog__confirm"
        type="primary"
        :disabled="!accepted"
        @click="confirmAuthorization"
      >
        授权并启用
      </el-button>
    </span>
  </el-dialog>
</template>

<script>
/*
  SourceAuthorizationDialog.vue 模块说明

  - 文件职责:
      在自定义脚本启用前展示风险说明，并收集用户明确授权确认。
      只回传授权或取消意图，不自行计算脚本指纹或修改授权状态。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      IMPORT_METHOD_TEXT: 自定义配置，提供脚本导入方式文案。
      SETTINGS_DIALOG_WIDTH: 自定义配置，提供响应式免责声明弹窗宽度。

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceAuthorizationDialog: 当前文件公开的组件或模块能力。
*/

// 导入来源: ../../utils/settingsDisplay。
// 导入内容: IMPORT_METHOD_TEXT 导入方式文案映射。
// 文件作用: 授权提示使用统一用户文案，不在模板硬编码导入类型分支。

import {
  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: IMPORT_METHOD_TEXT 导入方式文案映射。
  // 文件作用: 把数据源导入类型转换成授权弹窗中的用户可读文案。
  IMPORT_METHOD_TEXT
} from '../../utils/settingsDisplay';

import {
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_DIALOG_WIDTH 设置模块弹窗宽度配置。
  // 文件作用: 为授权弹窗提供统一响应式宽度，避免组件内部硬编码尺寸。
  SETTINGS_DIALOG_WIDTH
} from '../../config/settings-module.config';

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools、错误堆栈和父组件引用时识别。
  name: 'SourceAuthorizationDialog',

  /*
    props 接收父级数据源列表页或详情页传入的授权弹窗状态。
    所有输入只用于展示和事件参数构造，组件不会直接修改父级数据源记录。
  */
  props: {
    // 类型: boolean。
    // 来源: 数据源列表页或详情页的授权流程状态。
    // 作用: 控制 Element UI 授权弹窗是否可见。
    // true: 显示授权风险说明和确认操作。
    // false: 隐藏授权弹窗。
    visible: { type: Boolean, default: false },

    // 类型: object|null。
    // 来源: 父级从共享 SourceManagerState 中选出的待授权数据源记录。
    // 作用: 提供授权弹窗展示和提交所需的脚本身份、来源及版本。
    // 字段: definition，object，当前数据源定义对象。
    // 字段: definition.id，string，确认授权时回传给父组件的数据源唯一标识。
    // 字段: definition.name，string，授权说明中展示的数据源名称。
    // 字段: definition.version，string，元信息区展示的脚本版本。
    // 字段: definition.importMethod，string，用于查询导入方式展示文案。
    record: { type: Object, default: null }
  },

  /**
   * 创建授权弹窗局部状态。
   * accepted 每次组件实例建立时从 false 开始，避免默认替用户确认脚本风险。
   *
   * @returns {object} 当前组件的响应式局部状态。
   * @returns {boolean} return.accepted 用户是否已主动确认脚本运行风险。
   * 纯函数: data 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
  data() {
    return {
      // 类型: boolean。
      // 初始值: false，弹窗首次使用时不允许直接提交授权。
      // 作用: 记录用户是否主动勾选免责声明，并控制授权按钮禁用状态。
      // true: 用户已确认风险，允许执行授权提交。
      // false: 用户尚未确认风险，授权按钮保持禁用。
      // 修改: visible 监听器会在每次打开弹窗时将该状态重置为 false。
      accepted: false
    };
  },

  computed: {
    /**
     * 读取授权弹窗响应式宽度。
     * 从 SETTINGS_DIALOG_WIDTH.authorization 读取统一配置，使设置模块弹窗宽度保持一致。
     * 该计算属性只读取配置，不修改组件状态或外部状态。
     *
     * @returns {string} Element UI el-dialog 使用的授权弹窗宽度。
     * 纯函数: dialogWidth 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    dialogWidth() {
      // 返回值类型: string。
      // 作用: 给 el-dialog 的 width 参数提供统一配置值，避免在模板中硬编码尺寸。
      return SETTINGS_DIALOG_WIDTH.authorization;
    },

    /**
     * 读取当前脚本的导入方式文案。
     * 从 record.definition.importMethod 获取导入类型，再通过 IMPORT_METHOD_TEXT 映射为用户可读文本。
     * 该计算属性只派生展示数据，不修改待授权记录或组件状态。
     *
     * @returns {string} 系统内置、文件、在线或粘贴文本文案。
     * 纯函数: importMethodText 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    importMethodText() {
      // 条件分支: record 不存在时进入。
      // 执行内容: 返回空字符串，避免模板或计算过程读取空记录的 definition 字段。

      if (!this.record) {
        // 返回值类型: string。
        // 作用: 给元信息值提供稳定空文本，等待父组件传入有效记录。
        return '';
      }

      // 类型: string。
      // 作用: 读取当前数据源定义的导入方式，用于查询统一文案映射。

      const importMethod = this.record.definition.importMethod;

      // 条件分支: IMPORT_METHOD_TEXT 中存在当前导入方式时返回对应文案，否则返回“自定义导入”。
      // 作用: 保证未知或后续扩展的导入方式仍有稳定的用户可读兜底文本。
      return IMPORT_METHOD_TEXT[importMethod] || '自定义导入';
    }
  },

  watch: {
    /**
     * 监听授权弹窗可见状态。
     * 每次打开时清除上一次勾选，保证用户针对当前脚本重新确认。
     * visible 为 false 时不修改 accepted，关闭过程只由父组件同步可见状态。
     *
     * @param {boolean} visible 新的可见状态。
     * @returns {void} 只重置组件局部确认状态。
     * 副作用: 弹窗打开时把 accepted 重置为 false，要求用户重新主动确认。
 */
    visible(visible) {
      // 条件分支: visible 为 true，即父组件要求打开授权弹窗时进入。
      // 执行内容: 清除上一次风险确认，要求用户针对当前脚本重新主动勾选。

      if (visible) {
        // 类型: boolean。
        // 作用: 将风险确认状态恢复为未确认，驱动授权按钮回到禁用状态。
        this.accepted = false;
      }
    }
  },

  methods: {
    /**
     * 关闭授权对话框。
     * 触发来源: el-dialog 的 @close 事件或取消按钮的 @click 事件。
     * 执行内容: 发出 update:visible 事件，请求父组件把授权弹窗可见状态改为 false。
     *
     * @returns {void} 通知父组件关闭，不修改脚本授权状态。
     * 副作用: closeDialog 会关闭当前交互并清理临时状态，并同步相关组件状态、路由或对外事件。
 */
    closeDialog() {
      // 事件: update:visible。
      // 作用: 使用 Vue `.sync` 约定通知父组件关闭授权弹窗。
      // 参数: false，boolean，表示弹窗应切换为隐藏状态。
      this.$emit('update:visible', false);
    },

    /**
     * 确认脚本运行授权。
     * 触发来源: 授权并启用按钮的 @click 事件。
     * 执行内容: 校验风险确认和待授权记录，向父组件提交 sourceId，然后关闭弹窗。
     *
     * @returns {void} 抛出当前 sourceId，由父组件通过 service 写入授权并启用。
 * 副作用: confirmAuthorization 会更新脚本运行授权，并同步相关组件状态、路由或对外事件。
 */
    confirmAuthorization() {
      // 条件分支: 用户未确认风险或待授权记录不存在时进入。
      // 执行内容: 终止授权提交，避免绕过确认项或传出无效数据源标识。

      if (!this.accepted || !this.record) {
        // 返回值类型: void。
        // 作用: 保持当前授权状态不变，不向父组件发送无效确认事件。
        return;
      }

      // 类型: string。
      // 作用: 读取已确认授权的数据源唯一标识，作为父组件写入授权状态的参数。

      const sourceId = this.record.definition.id;

      // 事件: confirm。
      // 作用: 通知父组件用户已确认当前脚本风险，可继续写入授权并启用数据源。
      // 参数: sourceId，string，当前待授权数据源唯一标识。
      this.$emit('confirm', sourceId);

      // 执行内容: 确认事件发出后关闭弹窗，结束本次授权交互。
      this.closeDialog();
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 授权说明首段 `.source-authorization-dialog__lead`。
  样式作用:
  说明目标脚本和当前无沙盒事实。
  与警示区保持清晰垂直节奏。
*/
.source-authorization-dialog__lead {
  /* 清除默认边距并保留下方距离。 */
  margin: 0 0 12px;
  /* 使用主题主文本色。 */
  color: var(--text-primary);
  /* 提升多行说明可读性。 */
  line-height: 1.7;
}

/*
  作用容器: 脚本风险说明 `.source-authorization-dialog__warning`。
  样式作用:
  用统一警示令牌突出用户需要自行判断脚本来源的风险。
  不把风险提示表达成系统禁止或安全认证。
*/
.source-authorization-dialog__warning {
  /* 清除默认边距并保留下方元信息距离。 */
  margin: 0 0 18px;
  /* 设置警示说明内部安全留白。 */
  padding: 12px 14px;
  /* 使用统一警示边框令牌。 */
  border: 1px solid var(--warning-border);
  /* 使用统一浅警示背景令牌。 */
  background: var(--warning-soft);
  /* 使用统一警示文字令牌。 */
  color: var(--warning);
  /* 提升多行风险说明可读性。 */
  line-height: 1.7;
}

/*
  作用容器: 脚本元信息列表 `.source-authorization-dialog__meta`。
  样式作用:
  以标签和值两列展示导入方式和脚本版本。
  允许值列收缩，避免长文本撑开弹窗。
*/
.source-authorization-dialog__meta {
  /* 使用 Grid 对齐元信息标签和值。 */
  display: grid;
  /* 标签保持稳定宽度，值列使用剩余空间。 */
  grid-template-columns: 88px minmax(0, 1fr);
  /* 设置元信息行列间距。 */
  gap: 8px 12px;
  /* 清除 dl 默认边距并保留下方确认项距离。 */
  margin: 0 0 18px;
}

/*
  作用容器: 脚本元信息标签 `.source-authorization-dialog__meta dt`。
  样式作用:
  使用弱文本色提示字段含义。
  让标签与实际元信息值形成清晰的信息层级。
*/
.source-authorization-dialog__meta dt {
  /* 使用主题弱文本色弱化字段标签，突出右侧实际数据源信息。 */
  color: var(--text-muted);
}

/*
  作用容器: 脚本元信息值 `.source-authorization-dialog__meta dd`。
  样式作用:
  清除描述列表的默认缩进。
  使用主文本色展示用户需要核对的真实字段值。
*/
.source-authorization-dialog__meta dd {
  /* 清除浏览器为 dd 添加的默认外边距，让值列与 Grid 轨道准确对齐。 */
  margin: 0;
  /* 使用主题主文本色强化脚本来源和版本等实际字段值。 */
  color: var(--text-primary);
}

/*

  响应式断点: (max-width: 640px)。
  作用范围: 作用容器: 视口宽度不超过 640px 的手机授权弹窗。
  样式作用:
  作用容器: 视口宽度不超过 640px 的手机授权弹窗。
  样式作用:
  640px 断点来源于设置模块手机布局边界。
  把元信息改为单列，避免标签和值在窄弹窗中相互挤压。

*/
@media (max-width: 640px) {
  /*
    作用容器: 手机脚本元信息列表 `.source-authorization-dialog__meta`。
    样式作用:
    把桌面两列结构调整为单列阅读顺序。
    让每个字段标签和值在窄屏中获得完整横向空间。
  */
  .source-authorization-dialog__meta {
    /* 将元信息网格切换为单列，使标签和值按文档流纵向排列。 */
    grid-template-columns: 1fr;
  }
}
</style>
