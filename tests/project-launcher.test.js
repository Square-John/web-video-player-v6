/*
  project-launcher.test.js 模块说明

  - 文件职责:
      验证根开发编排器的目标选择、子进程定义、浏览器打开策略和失败联动生命周期。
      测试只使用内存配置、事件替身和 PassThrough 流，不启动真实 Vite、Node 服务或系统浏览器。

  - 导入库及文件汇总(8 条，内置 5 条，第三方 0 条，自定义 3 条):
      node:assert/strict: 验证目标、命令、错误和生命周期结果。
      node:events#EventEmitter: 创建可控 ChildProcess 事件替身。
      node:stream#PassThrough: 提供不访问终端的 stdout/stderr 流替身。
      node:test#test: 注册独立根启动器测试用例。
      node:url#fileURLToPath: 把测试目录 URL 转换为跨平台仓库路径。
      ../config/project.config.js: 提供当前项目启动配置正例。
      ../config/frontend.config.js: 提供当前前端开发端口和完整配置正例。
      ../scripts/startup/processSupervisor.mjs: 提供目标解析、定义、浏览器和进程监督能力。

  - 模块级常量:
      REPOSITORY_ROOT: string，测试使用的仓库根目录。
      PROJECT_CONFIG_CANDIDATE: Readonly<object>，当前项目配置正例。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createFakeChild(): 创建可触发 close 的子进程替身。
      createTestConfigs(): 创建关闭浏览器后的测试配置投影。

  - 模块级类:
      无

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证根启动器的稳定结果和错误边界。
import assert from 'node:assert/strict';
// 导入来源: node:events；导入内容: EventEmitter；文件作用: 创建可控的子进程生命周期事件替身。
import { EventEmitter } from 'node:events';
// 导入来源: node:stream；导入内容: PassThrough；文件作用: 为监督器提供可写入和可结束的输出流。
import { PassThrough } from 'node:stream';
// 导入来源: node:test；导入内容: test；文件作用: 注册异步目标和失败联动测试。
import test from 'node:test';
// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 把相对测试 URL 转换为 Windows、macOS 和 Linux 可用路径。
import { fileURLToPath } from 'node:url';
// 导入来源: ../config/frontend.config.js；导入内容: FRONTEND_CONFIG；文件作用: 测试浏览器地址和监督器前端就绪端口不复制固定值。
import FRONTEND_CONFIG from '../config/frontend.config.js';
// 导入来源: ../config/project.config.js；导入内容: PROJECT_CONFIG；文件作用: 提供配置选择模式和联合失败策略正例。
import PROJECT_CONFIG from '../config/project.config.js';
// 导入来源: ../scripts/startup/processSupervisor.mjs；导入内容: 根开发监督器函数；文件作用: 验证统一目标与生命周期入口。
import {
  createFrontendBrowserUrl,
  createProcessDefinitions,
  openUrlInDefaultBrowser,
  resolveStartupTarget,
  runDevelopmentProcesses
} from '../scripts/startup/processSupervisor.mjs';

// 类型: string；来源: 当前测试文件目录向上一级；作用: 验证子进程定义使用根目录派生的 client/server 工作目录。
const REPOSITORY_ROOT = fileURLToPath(new URL('../', import.meta.url));

// 类型: Readonly<object>；来源: 根配置模块；作用: 验证 resolveStartupTarget 不复制第二份项目启动配置。
const PROJECT_CONFIG_CANDIDATE = PROJECT_CONFIG;

/**
 * 创建可触发 close 的 ChildProcess 事件替身。
 * 调用方: runDevelopmentProcesses 生命周期测试的 spawnProcess 替身。
 * 副作用: 创建两个内存 PassThrough 流；kill 调用只触发内存 close 事件，不建立进程或端口。
 * 成功路径: 返回具备 stdout、stderr、once、kill 和 unref 接口的测试替身。
 * 失败路径: 无；测试调用方负责决定何时触发 close。
 *
 * @returns {EventEmitter} 可被监督器消费的内存子进程替身。
 */
function createFakeChild() {
  // 类型: EventEmitter；作用: 保存 stdout/stderr 流和 close 事件，模拟 ChildProcess 生命周期。
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = (signal) => {
    child.killed = true;
    queueMicrotask(() => {
      child.stdout.end();
      child.stderr.end();
      child.emit('close', null, signal);
    });
    return true;
  };
  child.unref = () => {};
  return child;
}

/**
 * 创建不自动打开浏览器的测试配置。
 * 纯函数: 使用 structuredClone 复制当前正式配置，只在内存中关闭浏览器选项。
 *
 * @returns {Readonly<object>} 适用于进程监督器测试的配置对象。
 */
function createTestConfigs() {
  // 类型: object；作用: 保存当前测试使用的项目启动选项和最小前端端口配置。
  const configs = {
    project: structuredClone(PROJECT_CONFIG_CANDIDATE),
    frontend: structuredClone(FRONTEND_CONFIG)
  };
  configs.project.startup.openBrowser = false;
  return configs;
}

test('显式目标优先于配置模式，configured 使用配置目标', async () => {
  // 类型: object；作用: 构造 configured/backend 配置，分别验证显式覆盖和配置直取。
  const configuredProject = structuredClone(PROJECT_CONFIG_CANDIDATE);
  configuredProject.startup.selectionMode = 'configured';
  configuredProject.startup.target = 'backend';

  assert.equal(await resolveStartupTarget({
    projectConfig: configuredProject,
    explicitTarget: 'frontend'
  }), 'frontend');
  assert.equal(await resolveStartupTarget({ projectConfig: configuredProject }), 'backend');
});

test('manual 在非交互输入流中明确失败', async () => {
  // 类型: object；作用: 构造 manual 项目配置，触发非 TTY 失败边界。
  const manualProject = structuredClone(PROJECT_CONFIG_CANDIDATE);
  manualProject.startup.selectionMode = 'manual';
  // 类型: PassThrough；作用: 模拟 isTTY 缺失的非交互标准输入。
  const input = new PassThrough();
  // 类型: PassThrough；作用: 模拟 isTTY 缺失的非交互标准输出。
  const output = new PassThrough();

  await assert.rejects(
    () => resolveStartupTarget({ projectConfig: manualProject, input, output }),
    /manual.*不是交互终端/u
  );
});

test('三种目标生成正确的无 shell 子进程定义', () => {
  // 类型: Array<object>；作用: 验证 all 同时包含前端和后端定义且顺序稳定。
  const allDefinitions = createProcessDefinitions('all', REPOSITORY_ROOT);
  // 类型: Array<object>；作用: 验证 frontend 只包含 Vite 定义。
  const frontendDefinitions = createProcessDefinitions('frontend', REPOSITORY_ROOT);
  // 类型: Array<object>；作用: 验证 backend 只包含 Node watch 定义。
  const backendDefinitions = createProcessDefinitions('backend', REPOSITORY_ROOT);

  assert.deepEqual(allDefinitions.map(definition => definition.target), ['frontend', 'backend']);
  assert.match(frontendDefinitions[0].args[0], /node_modules[\\/]vite[\\/]bin[\\/]vite\.js$/u);
  assert.deepEqual(backendDefinitions[0].args, ['--watch', 'src/index.js']);
  assert.throws(() => createProcessDefinitions('unknown', REPOSITORY_ROOT), /未知开发启动目标/u);
});

test('浏览器地址和平台命令由配置端口决定', () => {
  // 类型: string；作用: 使用当前根 FrontendConfig 生成测试期望地址，不复制开发端口。
  const browserUrl = `http://localhost:${FRONTEND_CONFIG.developmentServer.port}/`;
  assert.equal(createFrontendBrowserUrl(FRONTEND_CONFIG), browserUrl);
  // 类型: Array<object>；作用: 捕获默认浏览器命令、参数和 detached 选项，不启动真实程序。
  const calls = [];
  openUrlInDefaultBrowser(browserUrl, {
    platform: 'win32',
    /**
     * 捕获 Windows 默认浏览器进程创建请求。
     * 副作用: 向当前测试 calls 数组追加一次调用，不创建系统进程。
     *
     * @param {string} command 浏览器打开命令。
     * @param {Array<string>} args 命令参数。
     * @param {object} options detached 与 stdio 选项。
     * @returns {EventEmitter} 带 unref 接口的子进程替身。
     */
    spawnProcess: (command, args, options) => {
      calls.push({ command, args, options });
      return createFakeChild();
    }
  });
  assert.deepEqual(calls[0].args, ['url.dll,FileProtocolHandler', browserUrl]);
  assert.equal(calls[0].options.detached, true);
});

test('彩色 Vite 就绪行只触发一次浏览器打开', async () => {
  // 类型: object；作用: 在测试副本中开启浏览器动作，验证真实 Vite 彩色输出识别。
  const configs = createTestConfigs();
  configs.project.startup.openBrowser = true;
  // 类型: Array<string>；作用: 记录监督器提交给浏览器端口的地址及调用次数。
  const openedUrls = [];

  /**
   * 创建前端子进程替身并输出包含 ANSI 控制码的 Vite 本机地址。
   * 调用方: 当前就绪识别测试的 runDevelopmentProcesses。
   * 副作用: 安排微任务写入 stdout、结束流并触发零码 close。
   *
   * @returns {EventEmitter} 当前前端子进程替身。
   */
  function spawnFrontend() {
    // 类型: EventEmitter；作用: 保存当前就绪输出和 close 生命周期。
    const child = createFakeChild();
    queueMicrotask(() => {
      child.stdout.write(`\u001b[36mhttp://localhost:\u001b[1m${configs.frontend.developmentServer.port}\u001b[22m/\u001b[39m\n`);
      child.stdout.end();
      child.stderr.end();
      child.emit('close', 0, null);
    });
    return child;
  }

  /**
   * 记录监督器识别就绪后提交的浏览器地址。
   * 调用方: 当前测试注入的 openBrowser 端口。
   * 副作用: 向 openedUrls 追加当前地址。
   *
   * @param {string} url 当前前端开发地址。
   * @returns {void} 记录完成后返回。
   */
  function recordBrowser(url) {
    openedUrls.push(url);
  }

  await runDevelopmentProcesses({
    target: 'frontend',
    configs,
    repositoryRoot: REPOSITORY_ROOT,
    spawnProcess: spawnFrontend,
    openBrowser: recordBrowser,
    output: new PassThrough(),
    errorOutput: new PassThrough()
  });
  assert.deepEqual(openedUrls, [createFrontendBrowserUrl(configs.frontend)]);
});

test('all 目标任一子进程失败时按配置关闭另一端并 reject', async () => {
  // 类型: object；作用: 提供 stopAllOnFailure=true 且不打开浏览器的监督器配置。
  const configs = createTestConfigs();
  // 类型: Array<EventEmitter>；作用: 保存按定义顺序创建的两个子进程替身，供最终检查兄弟进程已关闭。
  const children = [];
  /**
   * 为每个开发定义创建可控子进程，并让第二个目标通过 close 事件失败。
   * 调用方: all 监督器测试传入的 spawnProcess 替换端口。
   * 类型: Function；作用: 保存测试进程创建行为并记录关闭状态。
   * 副作用: 向 children 追加替身，第二次调用安排一个微任务失败事件。
   *
   * @param {string} command Node 可执行文件路径。
   * @param {Array<string>} args 当前开发目标参数。
   * @param {object} options 当前目标工作目录和 stdio 配置。
   * @returns {EventEmitter} 当前开发目标子进程替身。
   */
  function spawnProcess(command, args, options) {
    void command;
    void args;
    void options;
    // 类型: EventEmitter；作用: 保存当前目标的可控子进程替身。
    const child = createFakeChild();
    children.push(child);
    // 条件分支: 第二个目标已经创建时进入；执行内容: 在当前同步启动循环结束后触发后端失败 close。
    if (children.length === 2) {
      queueMicrotask(() => child.emit('close', 1, null));
    }
    return child;
  }

  await assert.rejects(
    () => runDevelopmentProcesses({
      target: 'all',
      configs,
      repositoryRoot: REPOSITORY_ROOT,
      spawnProcess,
      output: new PassThrough(),
      errorOutput: new PassThrough()
    }),
    /开发进程退出/u
  );
  assert.equal(children.length, 2);
  assert.equal(children[0].killed, true);
});
