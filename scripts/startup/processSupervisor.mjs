/*
  processSupervisor.mjs 模块说明

  - 文件职责:
      统一管理开发阶段 frontend、backend 和 all 三种子进程目标的创建、输出、就绪通知、失败联动和信号关闭。
      供根 project.mjs 调用；本模块不读取配置文件、不解析页面业务、不参与生产静态文件部署。

  - 导入库及文件汇总(5 条，内置 5 条，第三方 0 条，自定义 0 条):
      node:child_process#spawn: 以不经过 shell 的方式创建 Vite 和 Node 开发子进程，也用于打开默认浏览器。
      node:path#join: 由仓库根目录生成 client/server 工作目录和 Vite 脚本路径。
      node:process#process: 读取当前 Node 执行路径、标准输入输出、平台和终止信号。
      node:readline/promises#createInterface: 在交互终端读取手动启动目标。
      node:util#stripVTControlCharacters: 去除 Vite 彩色输出控制码后执行稳定就绪匹配。

  - 模块级常量:
      MANUAL_TARGET_CHOICES: ReadonlyArray<object>，手动菜单的稳定编号、目标和值班说明。
      DEVELOPMENT_TARGETS: ReadonlyArray<string>，编排器允许的 frontend、backend、all 目标。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createManualTargetPrompt(input, output): 创建一次手动目标询问并返回标准目标。
      resolveStartupTarget(options): 根据显式目标、配置模式或交互选择返回启动目标。
      createProcessDefinitions(target, repositoryRoot): 创建不经过 shell 的开发子进程定义。
      createFrontendBrowserUrl(frontendConfig): 由前端开发端口生成浏览器访问地址。
      openUrlInDefaultBrowser(url): 调用操作系统默认浏览器，不影响开发进程生命周期。
      runDevelopmentProcesses(options): 启动并监督目标子进程直到正常关闭或失败退出。

  - 模块级类:
      无

  - 对外导出:
      DEVELOPMENT_TARGETS: ReadonlyArray<string>，命令解析和测试共用的目标集合。
      resolveStartupTarget: async function，解析 configured/manual/显式目标。
      createProcessDefinitions: function，生成开发子进程定义。
      createFrontendBrowserUrl: function，生成前端浏览器访问地址。
      runDevelopmentProcesses: function，运行统一开发进程会话。
*/

// 导入来源: node:child_process；导入内容: spawn 内置进程创建函数；文件作用: 不经过 shell 创建开发服务和系统浏览器进程。
import { spawn } from 'node:child_process';
// 导入来源: node:path；导入内容: join 内置路径函数；文件作用: 从仓库根定位 client、server 和 Vite 入口。
import { join } from 'node:path';
// 导入来源: node:process；导入内容: process 内置进程对象；文件作用: 读取 Node 执行路径、终端流、平台和信号监听。
import process from 'node:process';
// 导入来源: node:readline/promises；导入内容: createInterface 内置交互接口工厂；文件作用: manual 模式读取一次用户目标选择。
import { createInterface } from 'node:readline/promises';
// 导入来源: node:util；导入内容: stripVTControlCharacters 内置文本函数；文件作用: 保留原彩色输出同时为就绪判断提供无控制码文本。
import { stripVTControlCharacters } from 'node:util';

// 类型: ReadonlyArray<object>；来源: 开发启动配置契约；作用: 把手动输入编号映射为稳定进程目标，不让菜单文本成为业务状态。
const MANUAL_TARGET_CHOICES = Object.freeze([
  Object.freeze({ number: '1', target: 'frontend', label: '只启动前端' }),
  Object.freeze({ number: '2', target: 'backend', label: '只启动后端' }),
  Object.freeze({ number: '3', target: 'all', label: '启动前端和后端' })
]);

// 类型: ReadonlyArray<string>；来源: ProjectConfig.startup.target；作用: 限制开发编排器只能启动三种正式目标组合。
export const DEVELOPMENT_TARGETS = Object.freeze(['frontend', 'backend', 'all']);

/**
 * 在交互终端读取一次手动启动目标。
 * 调用方: resolveStartupTarget 的 manual 分支。
 * 副作用: 读取 stdin、向 stdout 输出菜单并创建/关闭 readline 接口；不启动子进程。
 * 成功路径: 用户输入 1/2/3 时返回对应标准目标。
 * 失败路径: 输入不是菜单编号、输入流关闭或 readline 失败时抛 Error。
 *
 * @param {NodeJS.ReadableStream} input 交互输入流。
 * @param {NodeJS.WritableStream} output 交互输出流。
 * @returns {Promise<string>} frontend、backend 或 all 目标。
 * @throws {Error} 手动输入缺失或不属于菜单编号时抛出。
 */
async function createManualTargetPrompt(input, output) {
  // 类型: ReadlineInterface；来源: node:readline/promises；作用: 管理一次性用户输入和资源关闭。
  const readline = createInterface({ input, output });
  try {
    // 副作用: 向当前终端输出目标菜单；影响范围: 当前开发启动命令的交互提示。
    output.write(`${MANUAL_TARGET_CHOICES.map(choice => `${choice.number}. ${choice.label}`).join('\n')}\n`);
    // 类型: string；作用: 保存用户对启动目标菜单的一次原始输入，供精确编号匹配。
    const answer = await readline.question('请选择启动目标: ');
    // 类型: object|undefined；作用: 找到用户编号对应的标准进程目标。
    const choice = MANUAL_TARGET_CHOICES.find(item => item.number === answer.trim());
    // 条件分支: 输入没有匹配任一冻结菜单编号时进入；执行内容: 明确失败，不猜测文字或使用默认目标。
    if (!choice) {
      throw new Error('启动目标必须选择 1、2 或 3');
    }

    return choice.target;
  } finally {
    // 资源清理: 无论输入成功或失败都关闭 readline，避免终端句柄阻止进程退出。
    readline.close();
  }
}

/**
 * 根据显式命令目标或 ProjectConfig 解析本次开发启动目标。
 * 调用方: 根 scripts/project.mjs。
 * 副作用: 仅在 manual 且没有显式目标时读取交互终端；configured 和显式目标不等待输入。
 * 成功路径: 返回 frontend、backend 或 all。
 * 失败路径: 目标未知、配置选择模式非法或 manual 运行在非交互终端时抛 Error。
 *
 * @param {object} options 目标解析选项。
 * @param {Readonly<object>} options.projectConfig 已通过契约校验的项目配置。
 * @param {string} [options.explicitTarget] dev:frontend 等显式命令目标。
 * @param {NodeJS.ReadableStream} [options.input=process.stdin] 手动选择输入流。
 * @param {NodeJS.WritableStream} [options.output=process.stdout] 手动选择输出流。
 * @returns {Promise<string>} 本次开发会话目标。
 * @throws {Error} 目标或交互条件不满足时抛出。
 */
export async function resolveStartupTarget({ projectConfig, explicitTarget, input = process.stdin, output = process.stdout }) {
  // 条件分支: 显式命令目标存在时进入；执行内容: 使用命令本身表达的目标，不重复询问配置菜单。
  if (explicitTarget !== undefined) {
    // 条件分支: 显式值不属于正式目标集合时进入；执行内容: 在启动子进程前拒绝未知命令映射。
    if (!DEVELOPMENT_TARGETS.includes(explicitTarget)) {
      throw new Error(`未知开发启动目标: ${explicitTarget}`);
    }

    return explicitTarget;
  }

  // 类型: string；来源: 已校验 ProjectConfig.startup；作用: 决定本次 dev 命令走配置目标还是交互菜单。
  const { selectionMode, target } = projectConfig.startup;
  // 条件分支: ProjectConfig 选择 configured 时进入；执行内容: 直接返回已经过契约校验的 target。
  if (selectionMode === 'configured') {
    return target;
  }

  // 条件分支: manual 在非交互终端执行时进入；执行内容: 明确失败而不是挂起等待不存在的用户输入。
  if (!input.isTTY || !output.isTTY) {
    throw new Error('启动配置为 manual，但当前终端不是交互终端；请使用 dev:frontend、dev:backend、dev:all 或改为 configured');
  }

  return createManualTargetPrompt(input, output);
}

/**
 * 创建开发目标对应的子进程定义。
 * 纯函数: 只组合输入配置和仓库路径，不创建进程或读取环境。
 * 成功路径: 返回 frontend、backend 或 all 的完整命令、参数和工作目录。
 * 失败路径: 目标未知时抛 Error；调用方应在任何 spawn 前停止。
 *
 * @param {string} target frontend、backend 或 all。
 * @param {string} repositoryRoot Git 仓库绝对根目录。
 * @returns {Array<object>} 子进程定义数组，数组顺序决定 all 的启动顺序。
 * @throws {Error} target 不属于 DEVELOPMENT_TARGETS 时抛出。
 */
export function createProcessDefinitions(target, repositoryRoot) {
  // 条件分支: 调用方传入未知目标时进入；执行内容: 不创建部分进程定义并立即失败。
  if (!DEVELOPMENT_TARGETS.includes(target)) {
    throw new Error(`未知开发启动目标: ${target}`);
  }

  // 类型: object；作用: 定义 Vite 开发进程，配置由 client/vite.config.js 从根 FrontendConfig 读取。
  const frontend = Object.freeze({
    target: 'frontend',
    label: 'frontend',
    command: process.execPath,
    args: Object.freeze([join('node_modules', 'vite', 'bin', 'vite.js')]),
    cwd: join(repositoryRoot, 'client')
  });
  // 类型: object；作用: 定义 Node watch 后端进程，监听和 CORS 由根 BackendConfig 经 ProxyPolicy 读取。
  const backend = Object.freeze({
    target: 'backend',
    label: 'backend',
    command: process.execPath,
    args: Object.freeze(['--watch', 'src/index.js']),
    cwd: join(repositoryRoot, 'server')
  });

  return target === 'all' ? [frontend, backend] : [target === 'frontend' ? frontend : backend];
}

/**
 * 由前端开发配置生成默认浏览器访问地址。
 * 纯函数: 只读取已校验端口，不访问网络或修改浏览器。
 * 成功路径: 返回 localhost 根地址，适用于 ::、0.0.0.0 和常规本机开发监听。
 * 失败路径: 缺失或非法端口由调用方配置契约先行阻止。
 *
 * @param {Readonly<object>} frontendConfig 已通过 FrontendConfig 契约校验的前端配置。
 * @returns {string} 本机前端开发地址。
 */
export function createFrontendBrowserUrl(frontendConfig) {
  return `http://localhost:${frontendConfig.developmentServer.port}/`;
}

/**
 * 使用操作系统默认浏览器打开地址。
 * 调用方: runDevelopmentProcesses 的前端就绪回调。
 * 副作用: 启动一个脱离当前会话的系统浏览器进程；不改变开发子进程生命周期。
 * 失败路径: 操作系统不支持默认浏览器命令时抛 Error，开发服务仍保持运行。
 *
 * @param {string} url 已由前端配置端口生成的本机 URL。
 * @param {object} [runtime] 测试运行时替换项。
 * @param {NodeJS.Platform} [runtime.platform=process.platform] 操作系统平台。
 * @param {Function} [runtime.spawnProcess=spawn] 进程创建函数。
 * @returns {void} 浏览器进程提交后立即返回。
 * @throws {Error} 不支持当前平台时抛出。
 */
export function openUrlInDefaultBrowser(url, { platform = process.platform, spawnProcess = spawn } = {}) {
  // 类型: object|null；作用: 根据操作系统选择无 shell 的默认浏览器命令及参数，未知平台保持 null。
  const browserCommand = platform === 'win32'
    ? { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] }
    : platform === 'darwin'
      ? { command: 'open', args: [url] }
      : platform === 'linux'
        ? { command: 'xdg-open', args: [url] }
        : null;

  // 条件分支: 当前平台没有登记安全的默认浏览器命令时进入；执行内容: 抛错并由开发监督器降级为只输出地址。
  if (!browserCommand) {
    throw new Error(`当前平台不支持自动打开浏览器: ${platform}`);
  }

  // 类型: ChildProcess；作用: 让操作系统异步处理 URL，忽略浏览器输出并脱离开发监督会话。
  const browserProcess = spawnProcess(browserCommand.command, browserCommand.args, {
    detached: true,
    stdio: 'ignore'
  });
  browserProcess.unref?.();
}

/**
 * 启动并监督一个开发进程会话。
 * 调用方: 根 scripts/project.mjs。
 * 副作用: 创建 Vite/Node 子进程、转发输出、注册当前进程信号并在退出时清理子进程。
 * 成功路径: 用户收到 SIGINT/SIGTERM 或所有目标正常结束后 resolve。
 * 失败路径: 子进程启动失败、非零退出、意外信号或联动关闭失败时 reject；按 stopAllOnFailure 处理其余子进程。
 *
 * @param {object} options 进程会话选项。
 * @param {string} options.target 本次启动目标。
 * @param {Readonly<object>} options.configs 三份已校验应用配置。
 * @param {string} options.repositoryRoot Git 仓库绝对根目录。
 * @param {Function} [options.spawnProcess=spawn] 可替换子进程创建函数。
 * @param {Function} [options.openBrowser=openUrlInDefaultBrowser] 可替换浏览器打开函数。
 * @param {NodeJS.WritableStream} [options.output=process.stdout] 子进程正常输出目标。
 * @param {NodeJS.WritableStream} [options.errorOutput=process.stderr] 子进程错误输出目标。
 * @returns {Promise<void>} 进程会话关闭后完成。
 * @throws {Error} 子进程启动、退出或清理失败时抛出。
 */
export function runDevelopmentProcesses({ target, configs, repositoryRoot, spawnProcess = spawn, openBrowser = openUrlInDefaultBrowser, output = process.stdout, errorOutput = process.stderr }) {
  // 类型: Array<object>；作用: 保存本次目标需要启动的完整子进程定义，创建任何进程前已全部校验。
  const definitions = createProcessDefinitions(target, repositoryRoot);
  // 类型: Map<string, object>；作用: 按目标保存子进程、关闭 Promise 和退出状态，供联动关闭统一管理。
  const children = new Map();
  // 类型: boolean；作用: true 表示监督器已经开始有意关闭，子进程 close 不再被误判为新故障。
  let isStopping = false;
  // 类型: boolean；作用: true 表示会话 Promise 已完成，后到事件不能二次 resolve 或 reject。
  let isSettled = false;
  // 类型: boolean；作用: true 表示前端已出现一次配置端口就绪行，防止重复打开浏览器。
  let frontendReady = false;
  // 类型: Error|null；作用: 保存本次会话第一项失败，后续清理错误不能覆盖根因。
  let firstFailure = null;
  // 类型: Promise<void>|null；作用: 复用唯一子进程关闭事务，避免信号与失败路径并发执行两次 kill。
  let stopPromise = null;
  // 类型: Function|undefined；作用: 保存统一会话 Promise 的成功完成端口。
  let resolveSession;
  // 类型: Function|undefined；作用: 保存统一会话 Promise 的失败完成端口。
  let rejectSession;

  // 类型: Promise<void>；作用: 连接子进程 exit/error 和当前进程终止信号，作为统一会话完成端口。
  const session = new Promise((resolve, reject) => {
    resolveSession = resolve;
    rejectSession = reject;
  });

  /**
   * 转发一个子进程输出流并按完整行触发可选就绪检查。
   * 调用方: runDevelopmentProcesses 的 startChild。
   * 类型: Function；作用: 保存当前会话使用的流转发回调。
   * 副作用: 监听输入流 data/end 并向指定 writer 写入带目标前缀的文本。
   *
   * @param {NodeJS.ReadableStream|null} stream 子进程 stdout 或 stderr。
   * @param {string} label 当前子进程显示标签。
   * @param {NodeJS.WritableStream} writer 输出目标。
   * @param {Function} [onLine] 完整行观察回调。
   * @returns {void} 注册监听后立即返回。
   */
  function relay(stream, label, writer, onLine) {
    // 条件分支: 子进程没有创建对应 pipe 时进入；执行内容: 跳过当前流，不影响其他生命周期事件。
    if (!stream) return;
    stream.setEncoding?.('utf8');
    // 类型: string；作用: 保存尚未遇到换行的尾部片段，避免数据块边界撕裂日志行和就绪地址。
    let pending = '';
    stream.on('data', (chunk) => {
      pending += String(chunk);
      // 类型: Array<string>；作用: 提取当前累计文本中的全部完整行，最后一项继续作为未完成尾部。
      const lines = pending.split(/\r?\n/u);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        writer.write(`[${label}] ${line}\n`);
        // 类型: string；作用: 删除 Vite 颜色控制码，使配置端口判断不受终端渲染格式影响。
        const plainLine = stripVTControlCharacters(line);
        onLine?.(plainLine);
      }
    });
    stream.on('end', () => {
      // 条件分支: 流结束时仍有未换行尾部时进入；执行内容: 最后转发一次，避免丢失错误摘要。
      if (pending !== '') {
        writer.write(`[${label}] ${pending}\n`);
        onLine?.(stripVTControlCharacters(pending));
      }
    });
  }

  /**
   * 请求全部尚未结束的开发子进程关闭，并等待真实 close 事件。
   * 调用方: handleExit、handleSignal 和启动异常处理。
   * 类型: Function；作用: 保存当前会话唯一关闭事务函数。
   * 副作用: 首次调用向存活子进程发送指定信号；并发调用复用同一个关闭 Promise。
   * 成功路径: 全部存活子进程触发 close 后 resolve。
   * 失败路径: 子进程无法结束或关闭 Promise 失败时 reject。
   *
   * @param {NodeJS.Signals} [signal='SIGTERM'] 子进程关闭信号。
   * @returns {Promise<void>} 全部当前子进程触发 close 后完成。
   */
  async function stopChildren(signal = 'SIGTERM') {
    // 条件分支: 已存在关闭事务时进入；执行内容: 返回同一 Promise，不重复发送终止信号。
    if (stopPromise) return stopPromise;
    isStopping = true;
    // 类型: Array<Promise<object>>；作用: 收集全部存活子进程 close Promise，形成一次原子关闭等待。
    const closes = [];
    for (const state of children.values()) {
      // 条件分支: 当前子进程尚未 close 时进入；执行内容: 发送信号并等待其真实资源关闭事件。
      if (!state.exited) {
        state.child.kill(signal);
        closes.push(state.closePromise);
      }
    }
    stopPromise = Promise.all(closes).then(() => undefined);
    return stopPromise;
  }

  /**
   * 根据一个子进程 close 结果决定继续等待、联动关闭或完成会话。
   * 调用方: startChild 注册的 ChildProcess close 监听。
   * 类型: Function；作用: 保存单个子进程关闭结果的会话协调回调。
   * 副作用: 更新当前 state，必要时关闭兄弟进程并 resolve/reject 会话 Promise。
   * 成功路径: 用户关闭、全部目标正常结束或失败联动完成后完成处理。
   * 失败路径: 子进程异常退出时记录根因并按 stopAllOnFailure 关闭其余目标。
   *
   * @param {object} state 当前子进程监督状态。
   * @param {number|null} code 子进程退出码。
   * @param {NodeJS.Signals|null} signal 子进程退出信号。
   * @returns {Promise<void>} 当前 close 处理和必要清理完成后 resolve。
   */
  async function handleExit(state, code, signal) {
    state.exited = true;
    // 条件分支: 当前 close 来自有意关闭或会话已经完成时进入；执行内容: 只记录状态，不抢占发起关闭路径的最终结果。
    if (isStopping || isSettled) {
      return;
    }

    // 类型: boolean；作用: 只有单目标进程以零码自然结束才算正常完成；联合会话任一端提前结束都视为失去完整性。
    const isCleanSingleExit = children.size === 1 && code === 0 && signal === null && !firstFailure;
    // 类型: Error|null；作用: 优先保留 spawn 错误，否则把非正常或联合提前退出转换为稳定会话错误。
    const failure = firstFailure ?? (isCleanSingleExit
      ? null
      : new Error(`[${state.definition.label}] 开发进程退出: code=${code ?? 'null'}, signal=${signal ?? 'none'}`));
    // 条件分支: 当前 close 首次形成失败时进入；执行内容: 保存根因供最终 reject 和并发信号路径复用。
    if (failure && !firstFailure) firstFailure = failure;

    // 条件分支: 当前会话失败且配置要求联动关闭时进入；执行内容: 等待其余子进程关闭后以第一失败结束会话。
    if (failure && configs.project.startup.stopAllOnFailure) {
      await stopChildren();
      // 条件分支: 关闭期间没有其他路径先完成会话时进入；执行内容: 用原始第一失败 reject。
      if (!isSettled) {
        isSettled = true;
        rejectSession(firstFailure);
      }
      return;
    }

    // 条件分支: 所有目标都已结束时进入；执行内容: 有失败则 reject，否则正常 resolve。
    if ([...children.values()].every(item => item.exited)) {
      isSettled = true;
      // 条件分支: 会话保存过任一失败时进入；执行内容: 以第一失败结束，避免最后一个零码退出掩盖前序错误。
      if (firstFailure) rejectSession(firstFailure);
      else resolveSession();
    }
  }

  /**
   * 创建一个定义对应的子进程并注册输出、错误和 close 生命周期。
   * 调用方: runDevelopmentProcesses 的定义循环。
   * 类型: Function；作用: 保存当前目标的子进程创建和监听注册回调。
   * 副作用: 调用 spawnProcess、写入 children，并注册流和 ChildProcess 事件监听。
   *
   * @param {Readonly<object>} definition 当前子进程定义。
   * @returns {void} 子进程注册完成后立即返回。
   */
  function startChild(definition) {
    // 类型: ChildProcess；作用: 保存当前 Vite 或 Node watch 子进程实例，供输出和关闭监督使用。
    const child = spawnProcess(definition.command, definition.args, {
      cwd: definition.cwd,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    // 类型: object；作用: 保存当前子进程定义、关闭状态和唯一 close Promise。
    const state = {
      child,
      definition,
      exited: false,
      closePromise: new Promise((resolve) => {
        child.once('close', (code, signal) => resolve({ code, signal }));
      })
    };
    children.set(definition.target, state);
    relay(child.stdout, definition.label, output, (line) => {
      // 条件分支: 当前是前端首个包含配置端口的完整输出行时进入；执行内容: 标记就绪并按项目配置尝试打开浏览器。
      if (definition.target === 'frontend'
        && !frontendReady
        && line.includes(`:${configs.frontend.developmentServer.port}`)) {
        frontendReady = true;
        // 条件分支: ProjectConfig.openBrowser 为 true 时进入；执行内容: 仅调用系统浏览器端口，不改变子进程状态。
        if (configs.project.startup.openBrowser) {
          try {
            openBrowser(createFrontendBrowserUrl(configs.frontend));
          } catch (error) {
            errorOutput.write(`自动打开浏览器失败: ${error instanceof Error ? error.message : String(error)}\n`);
          }
        }
      }
    });
    relay(child.stderr, definition.label, errorOutput);
    child.once('error', (error) => {
      // 条件分支: 当前 spawn 错误是会话第一失败时进入；执行内容: 保存错误并等待随后 close 统一处理联动退出。
      // 条件分支: 尚未记录更早失败时进入；执行内容: 保存当前 spawn 错误作为会话根因。
      if (!firstFailure) firstFailure = error;
    });
    child.once('close', (code, signal) => {
      void handleExit(state, code, signal);
    });
  }

  /**
   * 处理当前进程关闭信号并等待全部开发子进程释放。
   * 调用方: 当前进程 SIGINT/SIGTERM 监听。
   * 类型: Function；作用: 保存用户关闭意图的异步会话处理回调。
   * 副作用: 调用唯一 stopChildren 事务并完成会话 Promise。
   *
   * @param {NodeJS.Signals} signal 当前收到的 SIGINT 或 SIGTERM。
   * @returns {void} 异步清理通过会话 Promise 表达结果。
   */
  function handleSignal(signal) {
    void stopChildren(signal).then(() => {
      // 条件分支: 会话尚未被失败路径完成时进入；执行内容: 有根因则 reject，否则按用户信号正常 resolve。
      if (!isSettled) {
        isSettled = true;
        // 条件分支: 失败路径已保存根因时进入；执行内容: 保留失败结果，不把信号清理误报为成功。
        if (firstFailure) rejectSession(firstFailure);
        else resolveSession();
      }
    }).catch(rejectSession);
  }

  // 类型: Function；作用: 固定 SIGINT 参数并保留可移除的监听函数引用。
  const handleSigint = handleSignal.bind(null, 'SIGINT');
  // 类型: Function；作用: 固定 SIGTERM 参数并保留可移除的监听函数引用。
  const handleSigterm = handleSignal.bind(null, 'SIGTERM');
  process.once('SIGINT', handleSigint);
  process.once('SIGTERM', handleSigterm);
  try {
    for (const definition of definitions) startChild(definition);
  } catch (error) {
    firstFailure = error;
    void stopChildren().then(() => rejectSession(firstFailure));
  }

  return session.finally(() => {
    process.removeListener('SIGINT', handleSigint);
    process.removeListener('SIGTERM', handleSigterm);
  });
}
