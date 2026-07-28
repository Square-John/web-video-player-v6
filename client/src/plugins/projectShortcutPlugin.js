/*
  projectShortcutPlugin.js 模块说明

  - 文件职责:
      创建继承当前动态加载 xgplayer BasePlugin 的项目快捷键插件类。
      插件只在播放器 root 生命周期内监听键盘事件，并把项目绑定交给 playbackShortcutService 匹配和执行。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      playbackShortcutService exports: 自定义服务，提供偏好校验、事件排除、绑定匹配和命令执行。

  - 模块级常量:
      PROJECT_SHORTCUT_PLUGIN_NAME: string，xgplayer 插件注册名。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无，插件类由 createProjectShortcutPlugin 结合动态 BasePlugin 创建。

  - 对外导出:
      createProjectShortcutPlugin: Function，返回 xgplayer 可注册的项目快捷键插件类。
*/

import {
  // 导入来源: ../services/playbackShortcutService.js；导入内容: executePlaybackShortcutAction；文件作用: 执行项目命令。
  executePlaybackShortcutAction,
  // 导入来源: ../services/playbackShortcutService.js；导入内容: findPlaybackShortcutBinding；文件作用: 匹配当前 KeyboardEvent。
  findPlaybackShortcutBinding,
  // 导入来源: ../services/playbackShortcutService.js；导入内容: normalizePlaybackShortcutPreferences；文件作用: 注册前严格校验配置。
  normalizePlaybackShortcutPreferences,
  // 导入来源: ../services/playbackShortcutService.js；导入内容: shouldIgnorePlaybackShortcut；文件作用: 排除输入区域和输入法组合。
  shouldIgnorePlaybackShortcut
} from '../services/playbackShortcutService.js';

// 类型: string。
// 作用: xgplayer 通过该名称读取 projectShortcut 配置并管理唯一插件实例。
const PROJECT_SHORTCUT_PLUGIN_NAME = 'projectShortcut';

/**
 * 创建项目快捷键插件类。
 * 纯函数: 只基于调用方传入的 BasePlugin 定义类，不导入 xgplayer，保证播放器依赖仍可动态分包。
 * 成功路径: 返回具备 afterCreate、keydown 和 destroy 生命周期的插件类。
 * 失败路径: BasePlugin 不是构造函数时抛 TypeError，适配组件转换为初始化失败。
 *
 * @param {Function} BasePlugin 动态加载 xgplayer 导出的插件基类。
 * @returns {Function} xgplayer 可注册插件类。
 * @throws {TypeError} BasePlugin 无效时抛出。
 */
export function createProjectShortcutPlugin(BasePlugin) {
  // 条件分支: 动态模块没有提供可继承的 BasePlugin 时进入；执行内容: 立即失败并交给适配层转换稳定初始化错误。
  if (typeof BasePlugin !== 'function') {
    throw new TypeError('xgplayer BasePlugin 不可用');
  }

  /**
   * 项目快捷键插件。
   * 状态所有权: preferences、onPageCommand 和 keydown 处理器只属于当前 xgplayer 实例。
   * 资源边界: afterCreate 绑定 root keydown，destroy 必须移除同一处理器。
   */
  return class ProjectShortcutPlugin extends BasePlugin {
    /**
     * xgplayer 插件注册名称。
     * 纯函数: 不修改实例或播放器。
     *
     * @returns {string} projectShortcut。
     */
    static get pluginName() {
      return PROJECT_SHORTCUT_PLUGIN_NAME;
    }

    /**
     * 创建后采用项目偏好并绑定键盘事件。
     * 副作用: 读取 player root、设置可聚焦属性并注册 keydown 监听。
     * 成功路径: 配置通过校验后当前 root 可以执行项目命令。
     * 失败路径: 偏好非法时抛校验错误，xgplayer 初始化失败关闭。
     *
     * @returns {void} 监听保存在实例字段中等待 destroy 清理。
     */
    afterCreate() {
      this.preferences = normalizePlaybackShortcutPreferences(this.config.preferences);
      this.onPageCommand = typeof this.config.onPageCommand === 'function' ? this.config.onPageCommand : null;
      this.handleKeydown = this.handleKeydown.bind(this);
      // 条件分支: xgplayer 已创建可用 root 时进入；执行内容: 让根节点可聚焦并只在该实例范围绑定按键。
      if (this.player?.root) {
        this.player.root.setAttribute('tabindex', '0');
        this.player.root.addEventListener('keydown', this.handleKeydown);
      }
    }

    /**
     * 处理播放器 root 键盘事件。
     * 副作用: 命令执行成功时调用 preventDefault/stopPropagation，并可能修改播放器或触发页面命令。
     * 成功路径: 非输入区域且命中启用绑定时执行一次项目命令。
     * 失败路径: 输入区域、未命中绑定或命令不支持时保持浏览器默认行为。
     *
     * @param {KeyboardEvent} event 当前 root 键盘事件。
     * @returns {void} 结果通过播放器或页面副作用表达。
     */
    handleKeydown(event) {
      // 条件分支: 按键来自输入区域或输入法组合时进入；执行内容: 保留控件默认行为并停止命令匹配。
      if (shouldIgnorePlaybackShortcut(event)) {
        return;
      }
      // 类型: object|null；作用: 保存当前事件命中的唯一启用绑定，未命中时不拦截浏览器行为。
      const binding = findPlaybackShortcutBinding(this.preferences, event);
      // 条件分支: 当前事件没有项目绑定时进入；执行内容: 保留默认行为并结束处理。
      if (!binding) {
        return;
      }
      // 类型: boolean；作用: 记录播放器或页面是否接受命令，只有接受后才阻止默认行为和冒泡。
      const handled = executePlaybackShortcutAction(this.player, binding.action, this.onPageCommand);
      // 条件分支: 命令已被项目层接受时进入；执行内容: 防止同一按键继续触发浏览器或外层页面动作。
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    /**
     * 释放快捷键插件资源。
     * 副作用: 从当前播放器 root 移除 keydown 监听并清空闭包引用。
     * 成功路径: 可重复调用；root 或处理器缺失时只清空状态。
     *
     * @returns {void} 清理完成后实例不再响应按键。
     */
    destroy() {
      // 条件分支: 当前实例曾在有效 root 上绑定处理器时进入；执行内容: 精确移除同一个 keydown 引用。
      if (this.player?.root && this.handleKeydown) {
        this.player.root.removeEventListener('keydown', this.handleKeydown);
      }
      this.preferences = null;
      this.onPageCommand = null;
      this.handleKeydown = null;
    }
  };
}
