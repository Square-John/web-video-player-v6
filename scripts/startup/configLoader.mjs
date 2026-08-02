/*
  configLoader.mjs 模块说明

  - 文件职责:
      从根目录固定路径加载三份用户运行配置，并通过同一契约生成不可变配置集合。
      供开发编排、前端构建和发布事实检查复用；不提供环境变量、源码默认值或备用路径。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      projectConfigCandidate: 自定义配置，本地开发启动选择候选。
      frontendConfigCandidate: 自定义配置，前端运行、开发服务和构建候选。
      backendConfigCandidate: 自定义配置，后端监听、CORS和限制候选。
      validateProjectConfig、validateFrontendConfig、validateBackendConfig: 自定义契约，校验并冻结三份候选。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      loadApplicationConfigs: function，返回三份已经严格校验的不可变配置。
*/

// 导入来源: ../../config/project.config.js；导入内容: 项目配置候选；文件作用: 提供开发启动默认选择。
import projectConfigCandidate from '../../config/project.config.js';
// 导入来源: ../../config/frontend.config.js；导入内容: 前端配置候选；文件作用: 提供公开运行、Vite 和构建字段。
import frontendConfigCandidate from '../../config/frontend.config.js';
// 导入来源: ../../config/backend.config.js；导入内容: 后端配置候选；文件作用: 提供监听、CORS和收紧限制。
import backendConfigCandidate from '../../config/backend.config.js';
// 导入来源: ./configContracts.mjs；导入内容: 三个配置校验器；文件作用: 在调用方产生副作用前建立严格冻结投影。
import {
  validateBackendConfig,
  validateFrontendConfig,
  validateProjectConfig
} from './configContracts.mjs';

/**
 * 加载并校验根目录三份运行配置。
 * 纯函数: 配置模块已由 ESM 加载，本函数只读取候选并返回新冻结投影；不修改文件、环境或进程。
 * 成功路径: 三份配置全部通过后一次性返回，不暴露部分成功集合。
 * 失败路径: 任一配置非法时同步抛 ApplicationConfigError，调用方不得启动服务或构建。
 *
 * @returns {Readonly<object>} 包含 project、frontend 和 backend 的不可变配置集合。
 * @throws {ApplicationConfigError} 任一配置不满足当前契约时抛出。
 */
export function loadApplicationConfigs() {
  return Object.freeze({
    project: validateProjectConfig(projectConfigCandidate),
    frontend: validateFrontendConfig(frontendConfigCandidate),
    backend: validateBackendConfig(backendConfigCandidate)
  });
}
