/*
  github-pages-artifact.mjs 模块说明

  - 文件职责:
      把已经通过 Vite 构建的 client/dist 整理为可由 GitHub Pages 发布的静态产物。
      只在 dist 内写入部署运行配置、history 路由回退入口和 .nojekyll，不修改根前端配置或应用源码。

  - 导入库及文件汇总(5 条，内置 3 条，第三方 0 条，自定义 2 条):
      existsSync/readFileSync/writeFileSync: 内置模块，检查、读取和写入生产静态产物。
      dirname/resolve: 内置模块，根据脚本位置和调用参数解析稳定绝对路径。
      fileURLToPath: 内置模块，把当前模块 URL 转换为本机文件路径。
      FRONTEND_CONFIG_SOURCE: 自定义配置，提供当前构建采用的唯一前端配置候选。
      validateFrontendConfig: 自定义契约函数，严格校验源码配置和部署后端 origin。

  - 模块级常量:
      CLIENT_ROOT: string，当前前端工程绝对路径。
      DEFAULT_DISTRIBUTION_ROOT: string，命令行默认处理的 client/dist 绝对路径。
      FRONTEND_CONFIG_ASSET_PATH: string，构建和部署共用的公开配置相对路径。
      INDEX_FILE_NAME: string，Vite 生产主入口文件名。
      FALLBACK_FILE_NAME: string，GitHub Pages history 路由回退文件名。
      NOJEKYLL_FILE_NAME: string，禁止 Pages 交给 Jekyll 二次处理的标记文件名。
      FRONTEND_CONFIG_GLOBAL_KEY: string，浏览器启动屏障读取完整前端配置的全局键。
      BACKEND_ORIGIN_OPTION: string，命令行唯一允许的部署地址参数名。
      FRONTEND_CONFIG: Readonly<object>，通过完整契约的仓库前端配置。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertExistingFile(filePath, description): 确认必需构建文件存在。
      serializeJavaScriptValue(value): 生成可安全嵌入模块脚本的 JavaScript 值文本。
      createDeploymentFrontendConfig(frontendConfig, backendOrigin): 建立只替换运行时后端地址的冻结部署配置。
      renderFrontendConfigScript(frontendConfig): 生成浏览器可直接加载的部署配置模块。
      assertBuiltConfigReference(indexSource, basePath): 核对构建入口采用当前基础路径。
      parseCliArguments(args): 解析唯一受支持的命令行参数。
      prepareGitHubPagesArtifact(options): 校验并原地整理 Pages 发布产物。
      runCli(args): 执行命令行准备流程并输出稳定摘要。
      isDirectExecution(): 判断当前模块是否由 Node 直接运行。

  - 模块级类:
      无

  - 对外导出:
      createDeploymentFrontendConfig: Function，供测试验证部署配置投影不修改源码候选。
      prepareGitHubPagesArtifact: Function，供测试和发布工具整理指定 dist。
*/

import {
  // 导入来源: node:fs；导入内容: existsSync；文件作用: 在写入前确认 dist 和必需构建文件真实存在。
  existsSync,
  // 导入来源: node:fs；导入内容: readFileSync；文件作用: 读取构建入口、配置资产和写入后的验收文本。
  readFileSync,
  // 导入来源: node:fs；导入内容: writeFileSync；文件作用: 写入部署配置、404 回退和 .nojekyll 标记。
  writeFileSync
} from 'node:fs';

import {
  // 导入来源: node:path；导入内容: dirname；文件作用: 从当前脚本文件定位 client 根目录。
  dirname,
  // 导入来源: node:path；导入内容: resolve；文件作用: 规范化 dist 和产物文件绝对路径。
  resolve
} from 'node:path';

// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 把当前 ES module 地址转换为 Windows 和 POSIX 可用路径。
import { fileURLToPath } from 'node:url';

// 导入来源: ../../config/frontend.config.js；导入内容: FRONTEND_CONFIG_SOURCE；文件作用: 提供当前 Vite 构建采用的唯一前端配置事实。
import FRONTEND_CONFIG_SOURCE from '../../config/frontend.config.js';

// 导入来源: ../../scripts/startup/configContracts.mjs；导入内容: validateFrontendConfig；文件作用: 在修改 dist 前拒绝非法源码配置和部署 origin。
import { validateFrontendConfig } from '../../scripts/startup/configContracts.mjs';

// 类型: string；作用: 当前 client 工程绝对路径，默认发布目录从这里派生而不依赖执行 cwd。
const CLIENT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 类型: string；作用: 命令行模式默认处理 Vite 已生成的 client/dist，不创建第二个发布目录。
const DEFAULT_DISTRIBUTION_ROOT = resolve(CLIENT_ROOT, 'dist');

// 类型: string；作用: 生产构建与 Pages 部署共用同一公开运行配置位置。
const FRONTEND_CONFIG_ASSET_PATH = 'config/frontend.config.js';

// 类型: string；作用: 标识 Vite 生产入口，Pages 的 404 回退必须复制该文件的精确字节。
const INDEX_FILE_NAME = 'index.html';

// 类型: string；作用: GitHub Pages 未命中深层 history 地址时返回同一应用入口。
const FALLBACK_FILE_NAME = '404.html';

// 类型: string；作用: 阻止 GitHub Pages 对 Vite 静态产物执行 Jekyll 过滤。
const NOJEKYLL_FILE_NAME = '.nojekyll';

// 类型: string；来源: FrontendConfig 浏览器启动契约；作用: 让部署配置脚本发布到应用唯一读取入口。
const FRONTEND_CONFIG_GLOBAL_KEY = '__WVP_FRONTEND_CONFIG__';

// 类型: string；作用: 命令行只接受显式后端 origin，不读取环境变量或生成隐藏部署默认值。
const BACKEND_ORIGIN_OPTION = '--backend-origin';

// 类型: Readonly<object>；作用: 在任何文件副作用前严格校验仓库当前前端配置。
const FRONTEND_CONFIG = validateFrontendConfig(FRONTEND_CONFIG_SOURCE);

/**
 * 确认必需构建文件存在。
 * 副作用: 只读取文件系统元数据，不创建或修改文件。
 * 失败路径: 路径不存在时抛 Error，阻止把空目录伪装成可发布产物。
 *
 * @param {string} filePath 必需文件绝对路径。
 * @param {string} description 文件职责说明。
 * @returns {void} 文件存在时无返回值。
 * @throws {Error} 文件不存在时抛出稳定错误。
 */
function assertExistingFile(filePath, description) {
  // 条件分支: 必需构建文件不存在时进入；执行内容: 抛出包含职责和路径的错误并停止发布准备。
  if (!existsSync(filePath)) {
    throw new Error(`GitHub Pages 发布产物缺失: ${description} -> ${filePath}`);
  }
}

/**
 * 生成可安全嵌入 JavaScript 模块的值文本。
 * 纯函数: 相同结构化输入始终返回相同文本，不读取或修改外部状态。
 * 安全边界: 转义 HTML 起始字符和 JavaScript 行分隔符，避免公开配置值提前结束脚本语义。
 *
 * @param {*} value 已通过 FrontendConfig 契约的结构化值。
 * @returns {string} 适合写入模块脚本的 JavaScript 值文本。
 */
function serializeJavaScriptValue(value) {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

/**
 * 建立 GitHub Pages 使用的完整前端配置。
 * 纯函数: 结构化复制源码候选，只替换 runtime.backendOrigin，再通过唯一完整契约返回新冻结投影。
 * 成功路径: 保留 schemaVersion、开发服务和构建基础路径，只采用显式 HTTPS 后端 origin。
 * 失败路径: 源码配置、候选 origin 或最终字段不符合契约时抛配置错误；HTTP origin 额外失败关闭以避免 Pages 混合内容。
 *
 * @param {object} frontendConfig 源码完整前端配置候选。
 * @param {string} backendOrigin 发布工作流显式提供的后端 origin。
 * @returns {Readonly<object>} 与源码配置分离的完整冻结部署配置。
 * @throws {Error} origin 不是 HTTPS 或完整配置校验失败时抛出。
 */
export function createDeploymentFrontendConfig(frontendConfig, backendOrigin) {
  // 类型: object；作用: 复制所有配置分区，确保部署准备不改写冻结源码对象或调用方测试候选。
  const deploymentCandidate = structuredClone(frontendConfig);
  deploymentCandidate.runtime.backendOrigin = backendOrigin;

  // 类型: Readonly<object>；作用: 复用应用唯一配置契约规范化 origin、基础路径和全部精确字段。
  const deploymentConfig = validateFrontendConfig(deploymentCandidate);
  // 类型: URL；作用: 在纯 origin 已通过通用校验后核对 Pages 所需 HTTPS 协议。
  const backendUrl = new URL(deploymentConfig.runtime.backendOrigin);

  // 条件分支: 部署后端不是 HTTPS 时进入；执行内容: 阻止 GitHub Pages 产生浏览器混合内容请求。
  if (backendUrl.protocol !== 'https:') {
    throw new Error('GitHub Pages 部署后端 origin 必须使用 HTTPS');
  }

  return deploymentConfig;
}

/**
 * 生成浏览器可直接加载的完整前端配置模块。
 * 纯函数: 只读取已经校验的配置投影并返回确定文本。
 * 成功路径: 脚本深层冻结三个分区、发布唯一全局键并保留 default export 供独立检查使用。
 * 失败路径: 调用方必须先通过 createDeploymentFrontendConfig；本函数不猜测或补齐字段。
 *
 * @param {Readonly<object>} frontendConfig 已校验的完整部署配置。
 * @returns {string} 可写入 dist/config/frontend.config.js 的 ES module 文本。
 */
function renderFrontendConfigScript(frontendConfig) {
  // 类型: string；作用: 使用显式冻结结构保持根配置与部署配置相同的浏览器只读语义。
  return `/* GitHub Pages deployment artifact: generated from the validated root FrontendConfig. */
const FRONTEND_CONFIG_GLOBAL_KEY = ${serializeJavaScriptValue(FRONTEND_CONFIG_GLOBAL_KEY)};
const FRONTEND_CONFIG = Object.freeze({
  schemaVersion: ${serializeJavaScriptValue(frontendConfig.schemaVersion)},
  runtime: Object.freeze({
    backendOrigin: ${serializeJavaScriptValue(frontendConfig.runtime.backendOrigin)}
  }),
  developmentServer: Object.freeze({
    host: ${serializeJavaScriptValue(frontendConfig.developmentServer.host)},
    port: ${serializeJavaScriptValue(frontendConfig.developmentServer.port)},
    strictPort: ${serializeJavaScriptValue(frontendConfig.developmentServer.strictPort)}
  }),
  build: Object.freeze({
    basePath: ${serializeJavaScriptValue(frontendConfig.build.basePath)}
  })
});

if (typeof document !== 'undefined') {
  globalThis[FRONTEND_CONFIG_GLOBAL_KEY] = FRONTEND_CONFIG;
}

export default FRONTEND_CONFIG;
`;
}

/**
 * 核对 Vite 入口已经采用当前部署基础路径。
 * 纯函数: 只检查 index 文本，不写文件。
 * 成功路径: HTML 精确引用 basePath 下的外部配置资产，证明资源构建和部署目录属于同一子路径。
 * 失败路径: 引用缺失时抛 Error；脚本不会靠重写 HTML 掩盖错误构建。
 *
 * @param {string} indexSource 已构建 index.html 文本。
 * @param {string} basePath 已校验的部署构建基础路径。
 * @returns {void} 引用一致时无返回值。
 * @throws {Error} 构建入口与基础路径不一致时抛出。
 */
function assertBuiltConfigReference(indexSource, basePath) {
  // 类型: string；作用: 组合当前构建必须写入 HTML 的配置脚本公开地址。
  const expectedPublicPath = `${basePath}${FRONTEND_CONFIG_ASSET_PATH}`;

  // 条件分支: index 没有引用当前基础路径下的配置资产时进入；执行内容: 拒绝通过改写产物掩盖错误构建。
  if (!indexSource.includes(`src="${expectedPublicPath}"`)) {
    throw new Error(`GitHub Pages 构建基础路径不一致: index.html 未引用 ${expectedPublicPath}`);
  }
}

/**
 * 解析发布准备命令行参数。
 * 纯函数: 只读取传入参数数组，不访问 process.env 或文件系统。
 * 成功路径: 返回唯一显式 backendOrigin。
 * 失败路径: 参数缺失、多余或顺序错误时抛 Error，禁止隐式部署默认值。
 *
 * @param {ReadonlyArray<string>} args process.argv 中脚本路径之后的参数。
 * @returns {Readonly<object>} 命令行部署参数。
 * @returns {string} return.backendOrigin GitHub Pages 前端调用的 HTTPS 后端 origin。
 * @throws {Error} 参数结构不精确时抛出。
 */
function parseCliArguments(args) {
  // 条件分支: 参数数量、名称或后端地址值不完整时进入；执行内容: 输出唯一合法调用格式并阻止隐式默认值。
  if (args.length !== 2 || args[0] !== BACKEND_ORIGIN_OPTION || !args[1]) {
    throw new Error(`用法: npm --prefix client run prepare:github-pages -- ${BACKEND_ORIGIN_OPTION} <https-origin>`);
  }

  return Object.freeze({ backendOrigin: args[1] });
}

/**
 * 整理指定 GitHub Pages 发布目录。
 * 副作用: 在 distributionRoot 内覆盖公开前端配置，复制 index.html 为 404.html，并写入空 .nojekyll。
 * 成功路径: 写入后重新读取并核对三项产物，返回冻结摘要供工作流记录。
 * 失败路径: dist、index、构建配置资产、基础路径或后端 origin 无效时在首次写入前抛错；写入验收失败时抛错阻止上传。
 * 边界: 不修改根配置、源码、Provider、持久化数据或 distributionRoot 以外文件。
 *
 * @param {object} options 发布准备参数。
 * @param {string} options.distributionRoot 已完成 Vite 构建的 dist 目录。
 * @param {string} options.backendOrigin 生产后端 HTTPS origin。
 * @param {object} [options.frontendConfig=FRONTEND_CONFIG] 当前构建采用的完整前端配置，测试可传等价候选。
 * @returns {Readonly<object>} 已写入产物的路径和部署事实摘要。
 * @throws {Error} 输入、构建产物或写入后验收不满足发布契约时抛出。
 */
export function prepareGitHubPagesArtifact({
  distributionRoot,
  backendOrigin,
  frontendConfig = FRONTEND_CONFIG
}) {
  // 条件分支: 调用方没有提供可定位的发布目录时进入；执行内容: 在任何文件写入前失败关闭。
  if (typeof distributionRoot !== 'string' || distributionRoot.trim() === '') {
    throw new Error('GitHub Pages 发布目录必须是非空路径');
  }

  // 类型: string；作用: 规范化调用方目录，确保后续三个写入目标属于同一明确 dist。
  const resolvedDistributionRoot = resolve(distributionRoot);
  // 类型: string；作用: Vite 主入口绝对路径，也是 404 回退内容唯一来源。
  const indexPath = resolve(resolvedDistributionRoot, INDEX_FILE_NAME);
  // 类型: string；作用: Vite 已生成配置资产绝对路径，准备器只覆盖现有正式构建资产。
  const frontendConfigPath = resolve(resolvedDistributionRoot, FRONTEND_CONFIG_ASSET_PATH);
  // 类型: string；作用: GitHub Pages history 路由回退入口绝对路径。
  const fallbackPath = resolve(resolvedDistributionRoot, FALLBACK_FILE_NAME);
  // 类型: string；作用: GitHub Pages 禁用 Jekyll 的空标记绝对路径。
  const noJekyllPath = resolve(resolvedDistributionRoot, NOJEKYLL_FILE_NAME);

  assertExistingFile(indexPath, INDEX_FILE_NAME);
  assertExistingFile(frontendConfigPath, FRONTEND_CONFIG_ASSET_PATH);

  // 类型: string；作用: 复制前先保存 Vite 入口精确文本，并用于基础路径断言。
  const indexSource = readFileSync(indexPath, 'utf8');
  // 类型: Readonly<object>；作用: 保留构建字段并只替换显式运行地址的完整部署配置。
  const deploymentConfig = createDeploymentFrontendConfig(frontendConfig, backendOrigin);
  assertBuiltConfigReference(indexSource, deploymentConfig.build.basePath);

  // 类型: string；作用: 在全部输入检查通过后生成唯一部署配置文本。
  const deploymentConfigSource = renderFrontendConfigScript(deploymentConfig);
  writeFileSync(frontendConfigPath, deploymentConfigSource, 'utf8');
  writeFileSync(fallbackPath, indexSource, 'utf8');
  writeFileSync(noJekyllPath, '', 'utf8');

  // 条件分支: 任一写入结果与当前已校验输入不一致时进入；执行内容: 阻止上传不完整 Pages 产物。
  if (readFileSync(frontendConfigPath, 'utf8') !== deploymentConfigSource
    || readFileSync(fallbackPath, 'utf8') !== indexSource
    || readFileSync(noJekyllPath, 'utf8') !== '') {
    throw new Error('GitHub Pages 发布产物写入后验收失败');
  }

  return Object.freeze({
    distributionRoot: resolvedDistributionRoot,
    frontendConfigPath,
    fallbackPath,
    noJekyllPath,
    backendOrigin: deploymentConfig.runtime.backendOrigin,
    basePath: deploymentConfig.build.basePath
  });
}

/**
 * 执行命令行 GitHub Pages 产物准备流程。
 * 副作用: 解析 process 参数对应的部署地址并修改默认 client/dist，成功后输出部署摘要。
 * 成功路径: 三项产物通过写后验收并输出 basePath 和 backendOrigin。
 * 失败路径: 由直接执行边界捕获并设置非零退出码，不上传半通过产物。
 *
 * @param {ReadonlyArray<string>} args 脚本命令行参数。
 * @returns {void} 结果通过文件副作用和标准输出表达。
 */
function runCli(args) {
  // 类型: Readonly<object>；作用: 保存唯一受支持的显式部署输入。
  const options = parseCliArguments(args);
  // 类型: Readonly<object>；作用: 保存写入后验收摘要供工作流日志核对。
  const result = prepareGitHubPagesArtifact({
    distributionRoot: DEFAULT_DISTRIBUTION_ROOT,
    backendOrigin: options.backendOrigin
  });

  console.log(`GitHub Pages 发布产物准备完成: basePath=${result.basePath}, backendOrigin=${result.backendOrigin}`);
}

/**
 * 判断当前模块是否由 Node 直接执行。
 * 纯函数: 只比较模块路径和 process.argv 脚本路径，不读取环境变量或文件内容。
 * 兜底策略: 测试导入或缺少 argv[1] 时返回 false，避免导入阶段修改 dist。
 *
 * @returns {boolean} true 表示应执行 CLI，false 表示当前模块仅被导入。
 */
function isDirectExecution() {
  return Boolean(process.argv[1]
    && fileURLToPath(import.meta.url) === resolve(process.argv[1]));
}

// 条件分支: 当前文件由 Node 命令直接执行时进入；执行内容: 运行 CLI 并把全部发布准备失败转换为非零退出码，测试导入不产生副作用。
if (isDirectExecution()) {
  // 异常边界: CLI 输入、构建检查或文件写入失败时统一输出错误并设置非零退出码。
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    // 失败传播: 输出稳定错误并设置非零退出码，GitHub Actions 不会上传未通过契约的产物。
    console.error(`GitHub Pages 发布产物准备失败: ${error.message}`);
    process.exitCode = 1;
  }
}
