/*
  projectElementUiPlugin.js 模块说明

  - 文件职责:
      集中注册项目模板真实使用的 Element UI 组件、Loading 指令和消息服务。
      取代 element-ui 全量插件安装，避免未使用组件进入应用首包，同时保留现有全局模板与实例 API。

  - 导入库及文件汇总(23 条，内置 0 条，第三方 22 条，自定义 1 条):
      ElAlert、ElButton、ElCard、ElCheckbox、ElCheckboxGroup、ElDialog、ElForm、ElFormItem、ElInput、ElInputNumber、ElOption、ElRadioButton、ElRadioGroup、ElSelect、ElSwitch、ElTabPane、ElTabs、ElTag: 第三方组件，覆盖当前模板实际使用的 Element UI 标签。
      Loading: 第三方插件，提供 v-loading 指令和 $loading 服务。
      Message: 第三方服务，提供 $message 用户反馈。
      MessageBox: 第三方服务，提供 $msgbox、$alert、$confirm 和 $prompt 交互。
      element-ui/lib/theme-chalk/index.css: 第三方样式，保持现有 Element UI 组件视觉和项目主题覆盖基线。
      ProjectEmptyState: 自定义组件，以 ElEmpty 名称提供无重复 SVG 标识的项目空状态。

  - 模块级常量:
      ELEMENT_UI_COMPONENTS: ReadonlyArray<object>，当前项目允许全局注册的 Element UI 组件白名单。
      ProjectElementUiPlugin: Readonly<object>，供应用入口通过 Vue.use 安装的项目 UI 插件。

  - 模块级变量:
      无

  - 模块级辅助函数:
      installProjectElementUi(VueConstructor): void，注册白名单组件、加载指令、消息服务和项目空状态。

  - 模块级类:
      无

  - 对外导出:
      ProjectElementUiPlugin: default Readonly<object>，应用入口使用的按需 Element UI 安装插件。
*/

// 导入来源: element-ui/lib/alert.js；导入内容: ElAlert 第三方组件；文件作用: 渲染设置和状态提示。
import ElAlert from 'element-ui/lib/alert.js';
// 导入来源: element-ui/lib/button.js；导入内容: ElButton 第三方组件；文件作用: 渲染全站命令按钮。
import ElButton from 'element-ui/lib/button.js';
// 导入来源: element-ui/lib/card.js；导入内容: ElCard 第三方组件；文件作用: 渲染设置内容框架。
import ElCard from 'element-ui/lib/card.js';
// 导入来源: element-ui/lib/checkbox.js；导入内容: ElCheckbox 第三方组件；文件作用: 渲染单项数据源选择。
import ElCheckbox from 'element-ui/lib/checkbox.js';
// 导入来源: element-ui/lib/checkbox-group.js；导入内容: ElCheckboxGroup 第三方组件；文件作用: 管理批量选择值。
import ElCheckboxGroup from 'element-ui/lib/checkbox-group.js';
// 导入来源: element-ui/lib/dialog.js；导入内容: ElDialog 第三方组件；文件作用: 渲染数据源和挑战交互弹窗。
import ElDialog from 'element-ui/lib/dialog.js';
// 导入来源: element-ui/lib/form.js；导入内容: ElForm 第三方组件；文件作用: 组织设置输入字段。
import ElForm from 'element-ui/lib/form.js';
// 导入来源: element-ui/lib/form-item.js；导入内容: ElFormItem 第三方组件；文件作用: 提供设置字段标签与校验布局。
import ElFormItem from 'element-ui/lib/form-item.js';
// 导入来源: element-ui/lib/input.js；导入内容: ElInput 第三方组件；文件作用: 接收搜索、导入和挑战文本。
import ElInput from 'element-ui/lib/input.js';
// 导入来源: element-ui/lib/input-number.js；导入内容: ElInputNumber 第三方组件；文件作用: 编辑数值型播放和界面设置。
import ElInputNumber from 'element-ui/lib/input-number.js';
// 导入来源: element-ui/lib/option.js；导入内容: ElOption 第三方组件；文件作用: 渲染 ElSelect 候选项。
import ElOption from 'element-ui/lib/option.js';
// 导入来源: element-ui/lib/radio-button.js；导入内容: ElRadioButton 第三方组件；文件作用: 渲染互斥设置选项。
import ElRadioButton from 'element-ui/lib/radio-button.js';
// 导入来源: element-ui/lib/radio-group.js；导入内容: ElRadioGroup 第三方组件；文件作用: 管理互斥设置值。
import ElRadioGroup from 'element-ui/lib/radio-group.js';
// 导入来源: element-ui/lib/select.js；导入内容: ElSelect 第三方组件；文件作用: 渲染设置和移动端选择器。
import ElSelect from 'element-ui/lib/select.js';
// 导入来源: element-ui/lib/switch.js；导入内容: ElSwitch 第三方组件；文件作用: 渲染启用和默认源开关。
import ElSwitch from 'element-ui/lib/switch.js';
// 导入来源: element-ui/lib/tab-pane.js；导入内容: ElTabPane 第三方组件；文件作用: 渲染个人中心分页签内容。
import ElTabPane from 'element-ui/lib/tab-pane.js';
// 导入来源: element-ui/lib/tabs.js；导入内容: ElTabs 第三方组件；文件作用: 管理个人中心标签页。
import ElTabs from 'element-ui/lib/tabs.js';
// 导入来源: element-ui/lib/tag.js；导入内容: ElTag 第三方组件；文件作用: 渲染状态、类型和版本 Chip。
import ElTag from 'element-ui/lib/tag.js';
// 导入来源: element-ui/lib/loading.js；导入内容: Loading 第三方插件；文件作用: 提供 v-loading 和实例加载服务。
import Loading from 'element-ui/lib/loading.js';
// 导入来源: element-ui/lib/message.js；导入内容: Message 第三方服务；文件作用: 提供成功、警告和失败反馈。
import Message from 'element-ui/lib/message.js';
// 导入来源: element-ui/lib/message-box.js；导入内容: MessageBox 第三方服务；文件作用: 提供确认与输入对话框。
import MessageBox from 'element-ui/lib/message-box.js';
// 导入来源: element-ui/lib/theme-chalk/index.css；导入内容: Element UI 完整基础样式；文件作用: 保持当前组件视觉并让 theme.css 继续统一覆盖。
import 'element-ui/lib/theme-chalk/index.css';

// 导入来源: ../components/common/ProjectEmptyState.vue；导入内容: ProjectEmptyState 自定义组件；文件作用: 以 ElEmpty 名称替换带重复 SVG 标识的默认空状态。
import ProjectEmptyState from '../components/common/ProjectEmptyState.vue';

// 类型: ReadonlyArray<object>。
// 作用: 声明当前源码模板真实消费的 Element UI 组件白名单，新增标签必须在代码审查后显式加入。
const ELEMENT_UI_COMPONENTS = Object.freeze([
  ElAlert,
  ElButton,
  ElCard,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTag
]);

/**
 * 安装项目实际使用的 Element UI 能力。
 * 副作用: 向传入 Vue 构造函数注册白名单组件、v-loading 指令和五个实例消息方法。
 * 成功路径: 现有模板标签、v-loading、$message 和 $confirm 等调用保持原 API。
 * 失败路径: Vue.use 传入无 component/use/prototype 能力的对象时保留原生 TypeError 并阻止应用挂载。
 * 维护边界: 只负责 UI 库注册，不初始化 Router、Store、Runtime 或页面业务。
 *
 * @param {object} VueConstructor Vue 2 构造函数，由应用入口的 Vue.use 注入。
 * @returns {void} 注册结果通过 Vue 全局组件、指令和 prototype 方法表达。
 */
function installProjectElementUi(VueConstructor) {
  // 循环类型: for...of；初始值: 白名单首个组件；终止条件: 全部真实使用组件完成注册；作用: 避免安装 Element UI 未使用模块。
  for (const component of ELEMENT_UI_COMPONENTS) {
    // 副作用: 使用组件自身稳定 name 全局注册，现有 kebab-case 模板标签无需改名。
    VueConstructor.component(component.name, component);
  }

  // 副作用: 以全局 ElEmpty 名称注册项目适配器；现有 description、image、image-size 和 slot 调用保持。
  VueConstructor.component('ElEmpty', ProjectEmptyState);
  // 副作用: 安装 Loading 插件提供 v-loading 指令及 $loading；不安装 Element UI 全量组件集合。
  VueConstructor.use(Loading);
  // 副作用: 注册轻量消息服务，保持业务组件现有 this.$message 调用入口。
  VueConstructor.prototype.$message = Message;
  // 副作用: 注册消息框总入口，保持需要完整配置的 this.$msgbox 调用能力。
  VueConstructor.prototype.$msgbox = MessageBox;
  // 副作用: 注册提示对话框方法，保持 Element UI 全量插件原有实例 API。
  VueConstructor.prototype.$alert = MessageBox.alert;
  // 副作用: 注册确认对话框方法，供删除、清理和播放器恢复决策继续使用。
  VueConstructor.prototype.$confirm = MessageBox.confirm;
  // 副作用: 注册输入对话框方法，保持未来已存在调用契约而不安装全量插件。
  VueConstructor.prototype.$prompt = MessageBox.prompt;
}

// 类型: Readonly<object>。
// 作用: 暴露符合 Vue.use 约定的单一项目 UI 插件，应用入口无需知道组件白名单和服务挂载细节。
const ProjectElementUiPlugin = Object.freeze({
  // 类型: Function；作用: Vue.use 调用时执行唯一按需注册流程。
  install: installProjectElementUi
});

// 导出类型: default Readonly<object>。
// 导出内容: ProjectElementUiPlugin 项目 Element UI 按需安装插件。
// 外部调用方: client/src/main.js。
// 使用场景: 应用启动时在创建根实例前注册当前真实使用的 UI 能力。
export default ProjectElementUiPlugin;
