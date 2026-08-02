/*
  check-production-artifact.mjs 模块说明

  - 文件职责:
      检查已经完成 Vite 构建的 client/dist 是否保留前端外部运行配置资产，
      并确认配置脚本先于主应用脚本加载且没有把项目级或后端配置发布到浏览器。
      该模块只验证生产输出，不启动服务、不执行 Vue、不读取 Provider 和不修改构建产物。

  - 导入库及文件汇总(4 条，内置 3 条，第三方 0 条，自定义 1 条):
      existsSync/readFileSync: Node 内置文件读取函数，用于检查产物文件存在和读取文本。
      dirname/resolve: Node 内置路径函数，用于从当前脚本定位仓库根目录和 client/dist。
      fileURLToPath: Node 内置 URL 函数，用于把当前模块地址转换为本机文件路径。
      FRONTEND_CONFIG: 自定义根配置，用于派生生产 HTML 中配置脚本的真实公开路径。

  - 模块级常量:
      repositoryRoot: string，当前仓库绝对根目录。
      clientRoot: string，前端工程绝对目录。
      distributionRoot: string，Vite 生产产物绝对目录。
      frontendConfigSourcePath: string，根前端配置权威原文路径。
      frontendConfigAssetPath: string，产物中必须存在的公开配置相对路径。
      frontendConfigPublicPath: string，结合 build.basePath 后的浏览器配置脚本地址。

  - 模块级变量:
      issues: Array<string>，当前产物检查发现的问题集合。

  - 模块级辅助函数:
      normalizeText(text): 统一换行，避免平台换行差异制造误报。
      readRequiredFile(filePath, description): 读取必需产物，缺失时记录稳定问题。
      checkIndexLoadOrder(indexSource, assetPath): 检查外部配置脚本位于主应用脚本之前。
      checkFrontendConfigAsset(): 检查配置资产与根配置原文一致且不发布其他根配置。

  - 模块级类:
      无

  - 对外导出:
      无；由 npm run check:production-artifact 直接执行并以退出码表达结果。
*/

import {
  // 导入来源: node:fs；导入内容: existsSync；文件作用: 判断生产产物和越权配置文件是否存在。
  existsSync,

  // 导入来源: node:fs；导入内容: readFileSync；文件作用: 读取根配置、dist 入口和公开配置资产文本。
  readFileSync
} from 'node:fs';

import {
  // 导入来源: node:path；导入内容: dirname；文件作用: 从当前脚本地址取得 client/scripts 目录。
  dirname,

  // 导入来源: node:path；导入内容: resolve；文件作用: 定位仓库根目录、根配置和前端生产产物。
  resolve
} from 'node:path';

// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 把当前 ES module 地址转换为本机文件路径。
import { fileURLToPath } from 'node:url';

// 导入来源: ../../config/frontend.config.js；导入内容: FRONTEND_CONFIG；文件作用: 按权威 build.basePath 检查生产 HTML 配置脚本地址。
import FRONTEND_CONFIG from '../../config/frontend.config.js';

// 类型: string；作用: 当前 client/scripts 目录的绝对路径，避免检查依赖执行 cwd。
const scriptsDirectory = dirname(fileURLToPath(import.meta.url));

// 类型: string；作用: 当前 Git 仓库根目录，配置权威文件和构建产物均从这里解析。
const repositoryRoot = resolve(scriptsDirectory, '..', '..');

// 类型: string；作用: 前端工程根目录，生产产物固定位于其 dist 子目录。
const clientRoot = resolve(repositoryRoot, 'client');

// 类型: string；作用: Vite 生产输出目录，检查只读取已生成文件，不负责触发构建。
const distributionRoot = resolve(clientRoot, 'dist');

// 类型: string；作用: 根 frontend.config.js 的权威原文路径，用于确认产物没有第二份配置内容。
const frontendConfigSourcePath = resolve(repositoryRoot, 'config', 'frontend.config.js');

// 类型: string；作用: 前端配置在 dist 中的固定公开路径，与 Vite 插件输出位置保持一致。
const frontendConfigAssetPath = 'config/frontend.config.js';

// 类型: string；来源: FRONTEND_CONFIG.build.basePath 与固定配置资产路径；作用: 表达构建后 HTML 应加载的真实公开 URL。
const frontendConfigPublicPath = `${FRONTEND_CONFIG.build.basePath}${frontendConfigAssetPath}`;

// 类型: Array<string>；作用: 收集所有产物问题，最后一次性输出而不是首个失败后隐藏其他缺口。
const issues = [];

/**
 * 统一文本换行。
 * 纯函数: 相同输入始终返回相同 LF 文本，不读取或修改文件。
 * 兜底策略: 非字符串输入转换为空字符串，让调用方报告缺失内容。
 *
 * @param {unknown} text 原始文件文本。
 * @returns {string} 使用 LF 换行的文本。
 */
function normalizeText(text) {
  // 返回值类型: string；作用: 消除 Windows 与 POSIX 换行差异，只比较配置内容本身。
  return typeof text === 'string' ? text.replace(/\r\n?/gu, '\n') : '';
}

/**
 * 读取必需生产文件。
 * 副作用: 同步读取一个产物文件；不写文件、不启动服务。
 * 成功路径: 返回 UTF-8 文本。
 * 失败路径: 文件不存在或不可读时追加问题并返回空文本。
 *
 * @param {string} filePath 产物绝对路径。
 * @param {string} description 供用户理解的文件职责。
 * @returns {string} 文件文本或缺失时的空文本。
 */
function readRequiredFile(filePath, description) {
  // 条件分支: 目标产物不存在时进入；执行内容: 记录缺失，避免后续读取抛出不清晰错误。
  if (!existsSync(filePath)) {
    issues.push(`生产前端产物缺失: ${description} -> ${filePath}`);
    return '';
  }

  try {
    // 返回值类型: string；作用: 读取构建后的公开文本，供顺序和原文检查使用。
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    // 失败传播: 把文件系统错误收敛为当前文件的发布问题，不伪造可用产物。
    issues.push(`生产前端产物不可读: ${description} -> ${error.message}`);
    return '';
  }
}

/**
 * 检查 HTML 中外部配置脚本先于主应用脚本加载。
 * 纯函数: 只读取已构建 index 文本和公开资产路径。
 * 成功路径: 配置标签和主入口标签均存在且配置标签位于前面。
 * 失败路径: 任一标签缺失或顺序错误时追加问题，防止应用在配置屏障前初始化。
 *
 * @param {string} indexSource client/dist/index.html 文本。
 * @param {string} publicPath 配置脚本浏览器公开路径。
 * @returns {void} 检查结果写入模块级 issues。
 */
function checkIndexLoadOrder(indexSource, publicPath) {
  // 类型: number；作用: 定位外部配置脚本标签，缺失时为 -1 并由后续条件拒绝。
  const configIndex = indexSource.indexOf(`src="${publicPath}"`);
  // 类型: number；作用: 定位 Vite 主入口脚本，确保它不能先于配置屏障执行。
  const mainScriptIndex = indexSource.indexOf('<script type="module"', configIndex + 1);

  // 条件分支: 配置脚本没有被注入时进入；执行内容: 阻止没有运行时配置的静态产物发布。
  if (configIndex < 0) {
    issues.push(`生产前端入口缺少外部配置脚本: ${publicPath}`);
    return;
  }

  // 条件分支: 主入口脚本缺失或出现在配置脚本之前时进入；执行内容: 阻止启动顺序漂移。
  if (mainScriptIndex < 0 || mainScriptIndex < configIndex) {
    issues.push('生产前端入口必须先加载 frontend.config.js 再加载主应用脚本');
  }
}

/**
 * 检查配置资产与发布边界。
 * 副作用: 读取根配置和 dist 文件，向 issues 追加问题；不修改任一文件。
 * 成功路径: 配置资产与根文件原文一致，且 dist 没有项目级或后端配置文件。
 * 失败路径: 原文漂移或越权发布时追加明确问题。
 *
 * @returns {void} 检查结果写入模块级 issues。
 */
function checkFrontendConfigAsset() {
  // 类型: string；作用: 读取根配置原文作为唯一比较基准，不从构建产物反推事实。
  const source = readRequiredFile(frontendConfigSourcePath, '根 frontend.config.js');
  // 类型: string；作用: 读取 dist 中公开配置脚本，确认部署后可修改的文件确实存在。
  const asset = readRequiredFile(resolve(distributionRoot, frontendConfigAssetPath), 'dist 外部前端配置');

  // 条件分支: 根配置和产物原文不同且两者都可读时进入；执行内容: 阻止静态部署携带过期配置。
  if (source && asset && normalizeText(source) !== normalizeText(asset)) {
    issues.push('生产前端配置资产与根 config/frontend.config.js 原文不一致');
  }

  // 循环类型: for...of；初始值: 不得公开的根级或后端配置路径；终止条件: 全部越权路径检查完成。
  // 循环作用: 防止构建配置插件意外把非 runtime 配置带进浏览器。
  for (const forbiddenPath of ['config/project.config.js', 'config/backend.config.js']) {
    // 条件分支: dist 存在越权配置文件时进入；执行内容: 记录发布边界破坏。
    if (existsSync(resolve(distributionRoot, forbiddenPath))) {
      issues.push(`生产前端产物越权包含配置: ${forbiddenPath}`);
    }
  }
}

// 类型: string；作用: 读取主入口文本，供外部配置加载顺序检查使用。
const indexSource = readRequiredFile(resolve(distributionRoot, 'index.html'), 'dist/index.html');

// 条件分支: index 可读时进入；执行内容: 检查配置屏障先于主应用脚本，缺失时已由读取函数报告。
if (indexSource) {
  checkIndexLoadOrder(indexSource, frontendConfigPublicPath);
}

// 执行内容: 核对配置资产原文和不可公开配置边界。
checkFrontendConfigAsset();

// 条件分支: 发现至少一项产物问题时进入；执行内容: 输出全部问题并阻止发布验证继续。
if (issues.length > 0) {
  console.error('生产前端产物检查失败：');
  issues.forEach((issue) => {
    console.error(`- ${issue}`);
  });
  process.exitCode = 1;
} else {
  // 副作用: 输出稳定成功摘要；不修改构建产物或项目配置。
  console.log('生产前端产物检查通过：配置资产、加载顺序和公开边界均符合当前交付契约。');
}
