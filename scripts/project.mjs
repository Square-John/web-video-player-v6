/*
  project.mjs 模块说明

  - 文件职责:
      提供根目录开发启动入口，把 dev、dev:frontend、dev:backend 和 dev:all 统一映射到配置加载与进程监督流程。
      供根 package.json 调用；不承担生产前端静态部署，也不读取环境变量或修改前后端业务代码。

  - 导入库及文件汇总(5 条，内置 3 条，第三方 0 条，自定义 2 条):
      node:path#dirname/resolve: 由当前脚本位置推导仓库根目录，避免依赖调用者工作目录。
      node:url#fileURLToPath: 把当前模块 URL 转换为本机路径。
      ./startup/configLoader.mjs#loadApplicationConfigs: 加载并校验三份根运行配置。
      ./startup/processSupervisor.mjs: 解析启动目标并监督开发子进程生命周期。

  - 模块级常量:
      COMMAND_TARGETS: Readonly<object>，显式根命令到开发目标的唯一映射。
      REPOSITORY_ROOT: string，当前 Git 仓库绝对根目录。

  - 模块级变量:
      无

  - 模块级辅助函数:
      parseCommand(command): 把命令行词转换为显式开发目标或配置选择模式。
      main(argv): 加载配置、解析目标并启动统一开发会话。

  - 模块级类:
      无

  - 对外导出:
      无；由根 package.json 的 dev 系列命令直接执行。
*/

import {
  // 导入来源: node:path；导入内容: dirname 内置路径函数；文件作用: 取得当前 scripts 目录。
  dirname,
  // 导入来源: node:path；导入内容: resolve 内置路径函数；文件作用: 从脚本目录生成仓库绝对根目录。
  resolve
} from 'node:path';
// 导入来源: node:url；导入内容: fileURLToPath 内置 URL 函数；文件作用: 把 import.meta.url 转换为可供 path 使用的本机路径。
import { fileURLToPath } from 'node:url';
// 导入来源: node:process；导入内容: process 内置进程对象；文件作用: 读取命令参数、直接执行身份和最终退出码。
import process from 'node:process';
// 导入来源: ./startup/configLoader.mjs；导入内容: loadApplicationConfigs 自定义加载器；文件作用: 在任何进程副作用前校验根目录三份配置。
import { loadApplicationConfigs } from './startup/configLoader.mjs';
import {
  // 导入来源: ./startup/processSupervisor.mjs；导入内容: runDevelopmentProcesses 自定义监督器；文件作用: 启动并收束目标开发进程会话。
  runDevelopmentProcesses,
  // 导入来源: ./startup/processSupervisor.mjs；导入内容: resolveStartupTarget 自定义目标解析器；文件作用: 统一显式命令和 ProjectConfig 选择模式。
  resolveStartupTarget
} from './startup/processSupervisor.mjs';

// 类型: string；来源: 当前脚本路径；作用: 无论用户从仓库根或其他目录执行，子进程都使用同一个仓库根目录。
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 类型: Readonly<object>；来源: 根 package.json scripts；作用: 让显式命令绕过 manual 菜单但仍复用同一配置和监督器。
const COMMAND_TARGETS = Object.freeze({
  dev: undefined,
  'dev:frontend': 'frontend',
  'dev:backend': 'backend',
  'dev:all': 'all'
});

/**
 * 把一个根开发命令转换为显式目标或配置选择标记。
 * 纯函数: 只读取命令映射，不读取文件或进程环境。
 * 成功路径: 返回显式目标，dev 返回 undefined 以继续使用 ProjectConfig。
 * 失败路径: 未知命令抛 Error，调用方不启动任何子进程。
 *
 * @param {string} command 根 package.json 传入的命令词。
 * @returns {string|undefined} frontend、backend、all 或 undefined。
 * @throws {Error} command 不属于 COMMAND_TARGETS 时抛出。
 */
function parseCommand(command) {
  // 条件分支: 命令不属于根 package.json 登记集合时进入；执行内容: 在配置读取和子进程创建前明确失败。
  if (!Object.hasOwn(COMMAND_TARGETS, command)) {
    throw new Error(`未知开发命令: ${command}`);
  }

  return COMMAND_TARGETS[command];
}

/**
 * 加载配置并启动开发进程会话。
 * 调用方: 文件底部直接执行分支。
 * 副作用: 读取三份根配置并创建 Vite/Node 开发子进程，直到用户信号或子进程退出。
 * 成功路径: 目标会话正常关闭后 resolve。
 * 失败路径: 配置非法、命令未知、manual 非交互或子进程失败时 reject，并以非零码结束。
 *
 * @param {ReadonlyArray<string>} argv 不含 node 和脚本路径的命令参数。
 * @returns {Promise<void>} 开发会话关闭后完成。
 * @throws {Error} 配置、命令或进程监督失败时抛出。
 */
export async function main(argv = process.argv.slice(2)) {
  // 类型: string；来源: 命令行参数；作用: 只接受一个根开发命令，避免未声明参数改变启动语义。
  const command = argv[0] ?? 'dev';
  // 条件分支: 调用方传入第二个或更多参数时进入；执行内容: 拒绝未声明参数，保持命令语义唯一。
  if (argv.length > 1) {
    throw new Error('开发启动命令只接受一个目标参数');
  }
  // 类型: string|undefined；作用: 保留显式命令目标，dev 则交给 ProjectConfig 的 configured/manual 决策。
  const explicitTarget = parseCommand(command);
  // 类型: Readonly<object>；来源: 根 config/ 三文件；作用: 在创建任一子进程前一次性完成严格配置校验。
  const configs = loadApplicationConfigs();
  // 类型: string；作用: 保存显式命令或 ProjectConfig 最终决定的标准开发目标。
  // 异步调用: 解析显式目标或执行配置要求的 manual/configured 选择。
  // resolve: 返回本次会话的 frontend/backend/all 目标。
  // reject: 目标未知、配置 manual 且终端非交互或输入失败时阻断启动。
  const target = await resolveStartupTarget({
    projectConfig: configs.project,
    explicitTarget
  });

  // 异步调用: 创建并监督开发子进程，实际生命周期交给子进程退出和当前进程信号。
  // resolve: 所有目标结束或收到关闭信号后完成。
  // reject: 任一启动失败或按配置启用的失败联动发生时抛错。
  await runDevelopmentProcesses({
    target,
    configs,
    repositoryRoot: REPOSITORY_ROOT
  });
}

// 类型: boolean；作用: true 表示当前文件由 Node 直接执行，import 测试不会意外启动开发服务。
const isDirectExecution = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1];

// 条件分支: 当前模块是命令行直接入口时进入；执行内容: 运行主流程并把未处理失败转换为非零退出码。
if (isDirectExecution) {
  main().catch((error) => {
    // 失败转换: 根入口只输出稳定摘要，避免把内部子进程对象或配置候选泄露到启动日志。
    process.stderr.write(`项目启动失败: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
