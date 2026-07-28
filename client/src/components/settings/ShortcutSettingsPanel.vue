<template>
  <!--
    ShortcutSettingsPanel 组件渲染树

    [DEFAULT] ele(section.shortcut-settings)
    │  - condition: 快捷键设置子路由激活时默认渲染。
    │  - type: 原生标签 section。
    │  - description: 编辑并保存项目播放器快捷键偏好。
    │  - params: draftPreferences 来自 shortcutSettingsStore.preferences 的页面草稿。
    │  - events: 无。
    │
    ├─ [DEFAULT] ele(header.shortcut-settings__header)
    │  - condition: 默认渲染。
    │  - type: 原生标签 header。
    │  - description: 展示快捷键设置模块标题。
    │  - params: 无。
    │  - events: 无。
    │
    ├─ [IF errorMessage] ele(el-alert)
    │  - condition: 当前捕获、校验或保存失败时渲染。
    │  - type: 第三方组件 Element UI el-alert。
    │  - description: 展示安全错误说明。
    │  - params: errorMessage 提供标题。
    │  - events: 无。
    │
    ├─ [FOR binding in draftPreferences.bindings] ele(div.shortcut-settings__row)
    │  - condition: 每条项目快捷键绑定渲染一行；空数组时列表为空。
    │  - type: 原生标签 div、button 与第三方组件 Element UI el-switch。
    │  - description: 展示命令、当前组合键、按键捕获入口和启用状态。
    │  - params: binding.action 作为稳定 key；binding 字段提供显示和编辑值。
    │  - events: click/keydown 捕获键位；el-switch v-model 更新 enabled 草稿。
    │
    └─ [DEFAULT] ele(footer.shortcut-settings__actions)
       - condition: 默认渲染。
       - type: 原生标签 footer 与第三方组件 Element UI el-button。
       - description: 提供恢复默认与保存命令。
       - params: saving 控制禁用与加载状态。
       - events: click 调用 restoreDefaults() 或 saveSettings()。
  -->
  <!--
    [DEFAULT] ele(section.shortcut-settings)
    - condition: 快捷键设置子路由激活时默认渲染。
    - type: 原生标签 section。
    - description: 展示项目快捷键绑定和保存命令。
    - params: 无。
    - events: 无。
  -->
  <section class="shortcut-settings">
    <!--
      [DEFAULT] ele(header.shortcut-settings__header)
      - condition: 默认渲染。
      - type: 原生标签 header。
      - description: 展示快捷键设置页面标题。
      - params: 无。
      - events: 无。
    -->
    <header class="shortcut-settings__header">
      <h1 class="shortcut-settings__title">快捷键设置</h1>
    </header>

    <!--
      [IF errorMessage] ele(el-alert)
      - condition: 当前交互存在安全错误说明时渲染。
      - type: 第三方组件 Element UI el-alert。
      - description: 展示捕获、冲突校验或持久化失败结果。
      - params: title 读取 errorMessage；type=error；closable=false。
      - events: 无。
    -->
    <el-alert
      v-if="errorMessage"
      class="shortcut-settings__error"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon />

    <!--
      [FOR binding in draftPreferences.bindings] ele(div.shortcut-settings__row)
      - condition: 每条项目快捷键绑定渲染一行；空数组时不渲染行。
      - type: 原生标签 div、button 与第三方组件 Element UI el-switch。
      - description: 编辑当前命令的组合键和启用状态。
      - params: action 作为 key；key/modifiers/enabled 提供当前草稿。
      - events: button click/keydown 捕获按键；el-switch v-model 更新 enabled。
    -->
    <div class="shortcut-settings__list">
      <div
        v-for="binding in draftPreferences.bindings"
        :key="binding.action"
        class="shortcut-settings__row">
        <span class="shortcut-settings__action">{{ actionLabel(binding.action) }}</span>
        <kbd class="shortcut-settings__key">{{ bindingLabel(binding) }}</kbd>
        <button
          class="shortcut-settings__capture"
          type="button"
          :disabled="saving"
          @click="beginCapture(binding.action)"
          @keydown.prevent.stop="captureShortcut($event, binding)">
          <i :class="capturingAction === binding.action ? 'el-icon-edit' : 'el-icon-setting'" aria-hidden="true"></i>
          {{ capturingAction === binding.action ? '等待按键' : '修改' }}
        </button>
        <el-switch
          v-model="binding.enabled"
          :disabled="saving"
          active-text="启用"
          inactive-text="关闭" />
      </div>
    </div>

    <!--
      [DEFAULT] ele(footer.shortcut-settings__actions)
      - condition: 默认渲染。
      - type: 原生标签 footer 与第三方组件 Element UI el-button。
      - description: 提供恢复默认和保存两个明确命令。
      - params: saving 控制禁用与加载状态。
      - events: click 调用 restoreDefaults() 或 saveSettings()。
    -->
    <footer class="shortcut-settings__actions">
      <el-button
        icon="el-icon-refresh-left"
        :disabled="saving"
        @click="restoreDefaults">
        恢复默认
      </el-button>
      <el-button
        type="primary"
        icon="el-icon-check"
        :loading="saving"
        @click="saveSettings">
        保存
      </el-button>
    </footer>
  </section>
</template>

<script>
/*
  ShortcutSettingsPanel.vue 模块说明

  - 文件职责:
      把已持久化 ShortcutPreferences 映射为命令列表、键位捕获和启用开关。
      页面只维护表单草稿，保存、冲突校验和 Repository 提交由 shortcutSettingsService 负责。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      PLAYBACK_SHORTCUT_MODIFIER: 自定义配置，生成标准修饰符字段。
      shortcutSettingsStore: 自定义设置 store，提供已提交偏好与保存状态。
      shortcutSettingsService exports: 自定义设置 service，保存偏好或恢复默认。

  - 模块级常量:
      SHORTCUT_ACTION_LABELS: Readonly<object>，项目命令用户可读名称。
      SHORTCUT_MODIFIER_LABELS: Readonly<object>，修饰符显示名称。
      SHORTCUT_KEY_LABELS: Readonly<object>，常用 KeyboardEvent.code 显示名称。
      MODIFIER_ONLY_CODES: Readonly<Array<string>>，不能单独保存为动作键的 code。
      SHORTCUT_CAPTURE_ERROR_MESSAGE: string，修饰键单独捕获时的安全说明。
      SHORTCUT_SAVE_ERROR_MESSAGE: string，未知保存失败时的安全说明。

  - 模块级变量:
      无

  - 模块级辅助函数:
      cloneShortcutPreferences(preferences): 创建可编辑偏好副本。
      readEventModifiers(event): 从 KeyboardEvent 生成标准修饰符数组。

  - 模块级类:
      无

  - 对外导出:
      Vue 组件配置: 供设置路由渲染快捷键设置面板。
*/

// 导入来源: ../../config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_MODIFIER；文件作用: 按正式枚举生成捕获修饰符。
import { PLAYBACK_SHORTCUT_MODIFIER } from '../../config/mediaPlayback.config.js';

// 导入来源: ../../store/shortcutSettingsStore.js；导入内容: shortcutSettingsStore；文件作用: 读取已提交偏好、保存状态和安全错误。
import { shortcutSettingsStore } from '../../store/shortcutSettingsStore.js';

import {
  // 导入来源: ../../services/shortcutSettingsService.js；导入内容: saveShortcutPreferences；文件作用: 校验并提交完整页面草稿。
  saveShortcutPreferences,
  // 导入来源: ../../services/shortcutSettingsService.js；导入内容: restoreDefaultShortcutPreferences；文件作用: 通过同一 FIFO 保存默认偏好。
  restoreDefaultShortcutPreferences
} from '../../services/shortcutSettingsService.js';

// 类型: Readonly<object>；作用: 把项目播放器命令映射为设置页可读名称，不改变保存 action。
const SHORTCUT_ACTION_LABELS = Object.freeze({
  togglePlay: '播放 / 暂停',
  seekBackward: '后退',
  seekForward: '前进',
  toggleMute: '静音',
  toggleFullscreen: '全屏',
  previousEpisode: '上一集',
  nextEpisode: '下一集'
});

// 类型: Readonly<object>；作用: 把标准修饰符枚举映射为平台中立显示文本。
const SHORTCUT_MODIFIER_LABELS = Object.freeze({
  alt: 'Alt',
  control: 'Ctrl',
  meta: 'Meta',
  shift: 'Shift'
});

// 类型: Readonly<object>；作用: 为常用 KeyboardEvent.code 提供紧凑显示，未知 code 保留原值。
const SHORTCUT_KEY_LABELS = Object.freeze({
  Space: '空格',
  ArrowLeft: '左方向',
  ArrowRight: '右方向',
  BracketLeft: '[',
  BracketRight: ']'
});

// 类型: Readonly<Array<string>>；作用: 排除只能作为 modifiers 保存的物理按键 code，冻结数组阻止运行时增删规则。
const MODIFIER_ONLY_CODES = Object.freeze([
  'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight',
  'MetaLeft', 'MetaRight', 'ShiftLeft', 'ShiftRight'
]);

// 类型: string；作用: 用户只按修饰键时保持捕获状态并提示需要完整组合键。
const SHORTCUT_CAPTURE_ERROR_MESSAGE = '请按下一个非修饰键作为快捷键。';

// 类型: string；作用: service 或 Repository 未提供安全说明时使用统一保存失败反馈。
const SHORTCUT_SAVE_ERROR_MESSAGE = '快捷键设置保存失败，请检查按键冲突后重试。';

/**
 * 创建快捷键设置表单副本。
 * 纯函数: 复制顶层对象、绑定数组和修饰符数组，不保留 store 引用。
 * 失败路径: 偏好尚未初始化时返回稳定空绑定集合，正常应用挂载前已由启动链采用真实偏好。
 *
 * @param {object|null} preferences 已提交快捷键偏好。
 * @returns {object} 可编辑 ShortcutPreferences。
 */
function cloneShortcutPreferences(preferences) {
  // 类型: object；作用: 未初始化时只提供空表单结构，不创建默认保存事实。
  const sourcePreferences = preferences || { schemaVersion: '', bindings: [] };
  return {
    schemaVersion: sourcePreferences.schemaVersion,
    bindings: sourcePreferences.bindings.map(binding => ({
      action: binding.action,
      key: binding.key,
      modifiers: [...binding.modifiers],
      enabled: binding.enabled
    }))
  };
}

/**
 * 从浏览器按键事件读取标准修饰符。
 * 纯函数: 返回按固定顺序排列的新数组，不保留 KeyboardEvent。
 *
 * @param {KeyboardEvent} event 捕获按钮收到的按键事件。
 * @returns {Array<string>} 当前激活修饰符枚举。
 */
function readEventModifiers(event) {
  return [
    event.altKey ? PLAYBACK_SHORTCUT_MODIFIER.alt : '',
    event.ctrlKey ? PLAYBACK_SHORTCUT_MODIFIER.control : '',
    event.metaKey ? PLAYBACK_SHORTCUT_MODIFIER.meta : '',
    event.shiftKey ? PLAYBACK_SHORTCUT_MODIFIER.shift : ''
  ].filter(Boolean);
}

// 导出类型: default Vue component options；调用方: settings 路由；使用场景: 快捷键设置子页面。
export default {
  // 类型: string；作用: 提供 Vue Devtools 和错误堆栈中的稳定组件名称。
  name: 'ShortcutSettingsPanel',

  /**
   * 创建快捷键设置页面局部状态。
   * 数据来源: shortcutSettingsStore 已提交偏好。
   * 副作用: 只创建当前组件草稿，不修改 store、播放器监听器或数据库。
   *
   * @returns {object} 页面局部状态。
   */
  data() {
    return {
      // 类型: object；来源: shortcutSettingsStore.preferences；修改入口: 捕获按钮和开关；作用: 保存前草稿。
      draftPreferences: cloneShortcutPreferences(shortcutSettingsStore.preferences),
      // 类型: string；作用: 当前等待键盘事件的 action；空字符串表示没有捕获任务。
      capturingAction: '',
      // 类型: string；作用: 当前页面捕获或保存失败说明；空字符串隐藏本地错误。
      localErrorMessage: ''
    };
  },

  computed: {
    /**
     * 读取当前保存状态。
     * 数据来源: shortcutSettingsStore.saving。
     * 纯函数: 只映射 service 状态，不修改页面草稿、Store 或浏览器状态。
     *
     * @returns {boolean} true 禁用重复操作，false 允许编辑和保存。
     */
    saving() {
      return shortcutSettingsStore.saving;
    },

    /**
     * 读取当前安全错误说明。
     * 数据来源: 页面捕获错误优先，其次为 shortcutSettingsStore 保存错误。
     * 纯函数: 不读取 Error、堆栈或 Repository 对象，也不修改页面与 Store 状态。
     *
     * @returns {string} 当前错误说明；空字符串隐藏 el-alert。
     */
    errorMessage() {
      return this.localErrorMessage || shortcutSettingsStore.errorMessage;
    }
  },

  methods: {
    /**
     * 取得项目命令显示名称。
     * 纯函数: 只读取冻结名称映射和输入，不修改组件、Store 或浏览器状态；未知 action 保留原文本，后续保存仍会被 service 校验拒绝。
     *
     * @param {string} action 项目快捷键命令。
     * @returns {string} 用户可读命令名称。
     */
    actionLabel(action) {
      return SHORTCUT_ACTION_LABELS[action] || action;
    },

    /**
     * 生成快捷键组合显示文本。
     * 纯函数: 只读取传入绑定和冻结显示映射，不修改草稿、Store 或浏览器状态。
     *
     * @param {object} binding 当前绑定草稿。
     * @returns {string} 修饰符与按键组成的显示文本。
     */
    bindingLabel(binding) {
      // 类型: Array<string>；作用: 把保存修饰符映射为用户可读文本。
      const modifierLabels = binding.modifiers.map(modifier => SHORTCUT_MODIFIER_LABELS[modifier] || modifier);
      // 类型: string；作用: 常用 code 使用紧凑名称，其他物理键保留标准 code。
      const keyLabel = SHORTCUT_KEY_LABELS[binding.key] || binding.key;
      return [...modifierLabels, keyLabel].filter(Boolean).join(' + ');
    },

    /**
     * 开始捕获指定命令的下一次按键。
     * 触发来源: 修改按钮 click。
     * 副作用: 只更新页面捕获状态和清空本地错误；按钮本身保持键盘焦点。
     *
     * @param {string} action 当前行项目命令。
     * @returns {void}
     */
    beginCapture(action) {
      this.capturingAction = action;
      this.localErrorMessage = '';
    },

    /**
     * 把按键事件写入当前绑定草稿。
     * 触发来源: 修改按钮 keydown。
     * 副作用: 更新当前行 key/modifiers 并结束捕获，不注册监听器或保存数据库。
     * 成功路径: 非修饰键生成标准 KeyboardEvent.code 与修饰符数组。
     * 失败路径: 未进入当前行捕获或只按修饰键时保持原绑定。
     *
     * @param {KeyboardEvent} event 按键捕获事件。
     * @param {object} binding 当前行可编辑绑定。
     * @returns {void}
     */
    captureShortcut(event, binding) {
      // 条件分支: 当前行不是活动捕获目标时进入；执行内容: 保留按钮普通键盘行为。
      if (this.capturingAction !== binding.action) return;
      // 条件分支: code 为空或只表示修饰键时进入；执行内容: 保持捕获并展示安全提示。
      if (!event.code || MODIFIER_ONLY_CODES.includes(event.code)) {
        this.localErrorMessage = SHORTCUT_CAPTURE_ERROR_MESSAGE;
        return;
      }
      binding.key = event.code;
      binding.modifiers = readEventModifiers(event);
      this.capturingAction = '';
      this.localErrorMessage = '';
    },

    /**
     * 保存当前快捷键草稿。
     * 触发来源: 保存按钮。
     * 副作用: 调用快捷键设置 FIFO；成功后用 Repository 已提交结果刷新草稿。
     * 成功路径: 清空捕获状态并显示成功消息。
     * 失败路径: service 校验或数据库失败时保留已提交 store 和当前草稿。
     *
     * @returns {Promise<void>} 保存事务与页面反馈收敛后完成。
     */
    async saveSettings() {
      // 条件分支: 已有保存命令执行时进入；执行内容: 拒绝重复提交。
      if (this.saving) return;
      this.localErrorMessage = '';
      try {
        // 类型: object；作用: 保存 Repository 已提交偏好，用于刷新草稿而非采用未提交候选。
        const savedPreferences = await saveShortcutPreferences(cloneShortcutPreferences(this.draftPreferences));
        this.draftPreferences = cloneShortcutPreferences(savedPreferences);
        this.capturingAction = '';
        // 副作用: 使用 Element UI 全局消息确认真实持久化成功。
        this.$message.success('快捷键设置已保存');
      } catch {
        // 失败补偿: 优先复用 service 安全错误；当前 tick 尚未发布时使用稳定兜底说明。
        this.localErrorMessage = shortcutSettingsStore.errorMessage || SHORTCUT_SAVE_ERROR_MESSAGE;
      }
    },

    /**
     * 恢复并保存项目默认快捷键。
     * 触发来源: 恢复默认按钮。
     * 副作用: 直接复用 service 默认保存命令，成功后刷新页面草稿。
     * 成功路径: 默认偏好提交后同时成为设置页和播放器的新权威。
     * 失败路径: 保留当前已提交 store 与页面草稿。
     *
     * @returns {Promise<void>} 默认偏好保存完成后结束。
     */
    async restoreDefaults() {
      // 条件分支: 已有保存命令执行时进入；执行内容: 不覆盖当前草稿。
      if (this.saving) return;
      this.localErrorMessage = '';
      try {
        // 类型: object；作用: 保存 Repository 已提交默认偏好，用于同步页面草稿。
        const savedPreferences = await restoreDefaultShortcutPreferences();
        this.draftPreferences = cloneShortcutPreferences(savedPreferences);
        this.capturingAction = '';
        // 副作用: 使用 Element UI 全局消息确认默认偏好已经持久化。
        this.$message.success('已恢复默认快捷键');
      } catch {
        // 失败补偿: 不提前覆盖草稿或 store，只展示安全说明。
        this.localErrorMessage = shortcutSettingsStore.errorMessage || SHORTCUT_SAVE_ERROR_MESSAGE;
      }
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 快捷键设置根面板。
  样式作用:
  使用全宽非卡片布局组织标题、绑定列表和操作区。
*/
.shortcut-settings {
  /* 使用纵向 Flex 保持主要区域顺序。 */
  display: flex;
  /* 让面板内容沿纵轴排列。 */
  flex-direction: column;
  /* 主要区域之间保留统一间距。 */
  gap: 20px;
  /* 面板占满设置工作区可用宽度。 */
  width: 100%;
  /* 把内边距计入宽度，避免窄屏溢出。 */
  box-sizing: border-box;
  /* 提供与其它设置模块一致的工作区留白。 */
  padding: 24px;
}

/*
  作用容器: 快捷键设置标题区。
  样式作用:
  通过底边界分隔标题与绑定列表。
*/
.shortcut-settings__header {
  /* 在标题下方保留视觉间隔。 */
  padding-bottom: 18px;
  /* 使用主题边框色分隔内容。 */
  border-bottom: 1px solid var(--border-color);
}

/*
  作用容器: 快捷键设置主标题。
  样式作用:
  使用紧凑设置模块标题层级。
*/
.shortcut-settings__title {
  /* 清除标题默认外边距。 */
  margin: 0;
  /* 使用设置页标题字号。 */
  font-size: 24px;
  /* 提高模块名称识别度。 */
  font-weight: 700;
  /* 使用全局主文字色。 */
  color: var(--text-primary);
}

/*
  作用容器: 快捷键错误条、列表和操作区。
  样式作用:
  统一限制阅读宽度并允许工作区收缩。
*/
.shortcut-settings__error,
.shortcut-settings__list,
.shortcut-settings__actions {
  /* 限制内容最大宽度，避免超宽屏行距过散。 */
  max-width: 760px;
}

/*
  作用容器: 快捷键绑定列表。
  样式作用:
  使用连续分隔行呈现设置，不创建嵌套卡片。
*/
.shortcut-settings__list {
  /* 使用单列 Grid 保持行顺序。 */
  display: grid;
  /* 使用主题边框建立列表上下边界。 */
  border-top: 1px solid var(--border-color);
}

/*
  作用容器: 单条快捷键绑定行。
  样式作用:
  对齐命令、键位、修改按钮和启用开关。
*/
.shortcut-settings__row {
  /* 使用 Grid 建立稳定四列。 */
  display: grid;
  /* 命令与键位可收缩，操作控件保持自然宽度。 */
  grid-template-columns: minmax(120px, 1fr) minmax(130px, 1fr) auto auto;
  /* 行内控件垂直居中。 */
  align-items: center;
  /* 各列保持稳定间距。 */
  gap: 14px;
  /* 提供足够的行内点击空间。 */
  padding: 14px 0;
  /* 使用主题边框分隔相邻绑定。 */
  border-bottom: 1px solid var(--border-color);
}

/*
  作用容器: 快捷键命令名称。
  样式作用:
  提供绑定行的主要阅读锚点。
*/
.shortcut-settings__action {
  /* 使用正文可读字号。 */
  font-size: 14px;
  /* 提高命令名称识别度。 */
  font-weight: 600;
  /* 使用主文字色。 */
  color: var(--text-primary);
}

/*
  作用容器: 当前组合键 kbd。
  样式作用:
  使用键盘语义元素展示保存草稿，不伪装可编辑输入。
*/
.shortcut-settings__key {
  /* 保持组合键在单行内完整显示。 */
  white-space: nowrap;
  /* 使用等宽字体增强按键识别。 */
  font-family: Consolas, monospace;
  /* 使用紧凑字号。 */
  font-size: 13px;
  /* 使用辅助文字色。 */
  color: var(--text-secondary);
}

/*
  作用容器: 按键捕获按钮。
  样式作用:
  使用熟悉设置图标和文字命令提供键位修改入口。
*/
.shortcut-settings__capture {
  /* 使用行内 Flex 对齐图标和状态文字。 */
  display: inline-flex;
  /* 图标与文字垂直居中。 */
  align-items: center;
  /* 图标与文字保持紧凑间距。 */
  gap: 6px;
  /* 提供稳定按钮高度与横向留白。 */
  padding: 8px 12px;
  /* 使用主题背景保持次级操作层级。 */
  background: var(--surface);
  /* 使用主题边框明确按钮边界。 */
  border: 1px solid var(--border-color);
  /* 使用项目紧凑圆角。 */
  border-radius: 6px;
  /* 使用主文字色。 */
  color: var(--text-primary);
  /* 使用项目继承字体。 */
  font-family: inherit;
  /* 使用紧凑按钮字号。 */
  font-size: 13px;
  /* 鼠标设备显示可点击状态。 */
  cursor: pointer;
}

/*
  作用容器: 按键捕获按钮禁用状态。
  样式作用:
  保存事务期间阻止修改草稿并提供非颜色反馈。
*/
.shortcut-settings__capture:disabled {
  /* 降低禁用按钮视觉权重。 */
  opacity: 0.55;
  /* 使用默认光标表达不可操作。 */
  cursor: default;
}

/*
  作用容器: 键盘聚焦的按键捕获按钮。
  样式作用:
  给键盘用户显示明确焦点位置。
*/
.shortcut-settings__capture:focus-visible {
  /* 使用主题强调色绘制焦点轮廓。 */
  outline: 2px solid var(--accent);
  /* 让轮廓与按钮边界保持可读距离。 */
  outline-offset: 2px;
}

/*
  作用容器: 快捷键设置操作区。
  样式作用:
  横向排列恢复默认与保存命令并靠右对齐。
*/
.shortcut-settings__actions {
  /* 使用 Flex 横向排列命令。 */
  display: flex;
  /* 把主要保存命令放在右侧。 */
  justify-content: flex-end;
  /* 按钮之间保留点击间隔。 */
  gap: 10px;
}

/*
  响应式断点: max-width 760px。
  作用范围: 平板窄端与手机快捷键面板。
  样式作用:
  把四列绑定行改为两列，确保播放器命令和控件不重叠。
*/
@media (max-width: 760px) {
  /*
    作用容器: 窄屏快捷键设置根面板。
    样式作用:
    收紧工作区留白。
  */
  .shortcut-settings {
    /* 窄屏使用更紧凑内边距。 */
    padding: 18px 14px;
  }

  /*
    作用容器: 窄屏单条快捷键绑定行。
    样式作用:
    命令和键位位于首行，修改与启用控件位于第二行。
  */
  .shortcut-settings__row {
    /* 两列结构避免操作控件互相挤压。 */
    grid-template-columns: minmax(0, 1fr) auto;
  }

  /*
    作用容器: 窄屏按键捕获按钮。
    样式作用:
    让次级命令与启用开关保持同一操作行。
  */
  .shortcut-settings__capture {
    /* 把捕获按钮放在第二行第一列。 */
    grid-column: 1;
    /* 按钮宽度仅随内容，不拉满整列。 */
    justify-self: start;
  }

  /*
    作用容器: 窄屏快捷键设置操作区。
    样式作用:
    空间不足时允许完整按钮换行。
  */
  .shortcut-settings__actions {
    /* 允许整按钮换行而不压缩文字。 */
    flex-wrap: wrap;
  }
}
</style>
