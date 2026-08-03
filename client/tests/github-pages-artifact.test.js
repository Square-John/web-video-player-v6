/*
  github-pages-artifact.test.js 模块说明

  - 文件职责:
      验证 GitHub Pages 产物准备器在临时目录中生成部署运行配置、history 回退和 .nojekyll。
      测试不修改正式 config/frontend.config.js、client/dist、Provider、浏览器存储或远程部署状态。

  - 导入库及文件汇总(7 条，内置 5 条，第三方 0 条，自定义 2 条):
      assert: 内置模块，核对产物文本、配置投影和失败边界。
      mkdirSync/mkdtempSync/readFileSync/rmSync/writeFileSync: 内置模块，建立并清理隔离临时 dist。
      tmpdir: 内置模块，提供当前系统临时目录。
      resolve: 内置模块，组合临时产物路径。
      afterEach/test: 内置模块，注册用例和统一清理钩子。
      FRONTEND_CONFIG: 自定义配置，提供仓库当前前端配置形状。
      createDeploymentFrontendConfig/prepareGitHubPagesArtifact: 自定义发布工具，建立部署投影并整理静态产物。

  - 模块级常量:
      TEMPORARY_ROOTS: Set<string>，当前用例创建且待清理的临时目录集合。
      TEST_BACKEND_ORIGIN: string，Pages 产物测试使用的 HTTPS 后端 origin。
      TEST_BASE_PATH: string，仓库子路径部署测试使用的构建基础路径。
      FRONTEND_CONFIG_ASSET_PATH: string，临时构建配置资产相对路径。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createFrontendConfigCandidate(basePath): 建立不修改正式配置的构建候选。
      createArtifactFixture(frontendConfig, referencedBasePath): 建立最小可发布临时 dist。
      importGeneratedConfig(source): 从生成文本加载 ES module 并返回 default 配置。

  - 模块级类:
      无

  - 对外导出:
      无，由 node --test 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证生成产物和失败错误。
import assert from 'node:assert/strict';

import {
  // 导入来源: node:fs；导入内容: mkdirSync；文件作用: 建立临时 dist/config 目录。
  mkdirSync,
  // 导入来源: node:fs；导入内容: mkdtempSync；文件作用: 为每个测试建立隔离临时根目录。
  mkdtempSync,
  // 导入来源: node:fs；导入内容: readFileSync；文件作用: 读取准备后的配置、404 和 .nojekyll。
  readFileSync,
  // 导入来源: node:fs；导入内容: rmSync；文件作用: 用例结束后删除本测试创建的临时目录。
  rmSync,
  // 导入来源: node:fs；导入内容: writeFileSync；文件作用: 写入最小 Vite 入口和占位配置资产。
  writeFileSync
} from 'node:fs';

// 导入来源: node:os；导入内容: tmpdir；文件作用: 把测试产物限制在系统临时目录。
import { tmpdir } from 'node:os';

// 导入来源: node:path；导入内容: resolve；文件作用: 组合临时 dist 内的稳定文件路径。
import { resolve } from 'node:path';

// 导入来源: node:test；导入内容: afterEach 和 test；文件作用: 注册测试并在每个用例后清理临时目录。
import { afterEach, test } from 'node:test';

// 导入来源: ../../config/frontend.config.js；导入内容: FRONTEND_CONFIG；文件作用: 证明部署投影保持正式配置全部既有字段。
import FRONTEND_CONFIG from '../../config/frontend.config.js';

// 导入来源: ../scripts/github-pages-artifact.mjs；导入内容: 部署配置和产物准备函数；文件作用: 执行待验证的唯一 Pages 产物整理实现。
import {
  createDeploymentFrontendConfig,
  prepareGitHubPagesArtifact
} from '../scripts/github-pages-artifact.mjs';

// 类型: Set<string>；作用: 记录当前用例创建的隔离目录，统一清理且不触碰项目正式 dist。
const TEMPORARY_ROOTS = new Set();

// 类型: string；作用: 模拟公开 Render HTTPS 服务，验证生成配置精确采用工作流输入。
const TEST_BACKEND_ORIGIN = 'https://api.example.com';

// 类型: string；作用: 模拟 GitHub Pages 仓库子路径，验证 Vite 路径与发布准备保持一致。
const TEST_BASE_PATH = '/web-video-player-test/';

// 类型: string；作用: 与 Vite 和发布准备器约定的公开运行配置位置保持一致。
const FRONTEND_CONFIG_ASSET_PATH = 'config/frontend.config.js';

/**
 * 建立可修改的前端配置测试候选。
 * 纯函数: 结构化复制正式冻结配置并只替换测试构建基础路径，不修改导入对象。
 *
 * @param {string} basePath 当前测试模拟的 Vite 构建基础路径。
 * @returns {object} 与 FrontendConfig 契约等价的独立候选。
 */
function createFrontendConfigCandidate(basePath) {
  // 类型: object；作用: 保存独立配置候选，后续准备器可再次复制而不污染正式配置。
  const candidate = structuredClone(FRONTEND_CONFIG);
  candidate.build.basePath = basePath;
  return candidate;
}

/**
 * 建立最小 GitHub Pages 构建产物夹具。
 * 副作用: 在系统临时目录创建 dist、index.html 和构建配置占位文件，并登记清理路径。
 * 成功路径: 返回临时 dist 和入口原文，供准备器执行真实文件读写。
 * 失败路径: 临时目录或文件系统写入失败时由 Node 原样抛错，测试立即失败。
 *
 * @param {object} frontendConfig 当前测试构建使用的完整前端配置。
 * @param {string} referencedBasePath index.html 实际引用配置资产的基础路径。
 * @returns {Readonly<object>} 临时产物路径和原始入口文本。
 * @returns {string} return.distributionRoot 临时 dist 绝对路径。
 * @returns {string} return.indexSource 准备前 index.html 精确文本。
 */
function createArtifactFixture(frontendConfig, referencedBasePath = frontendConfig.build.basePath) {
  // 类型: string；作用: 当前测试唯一临时根目录，前缀方便失败后人工识别来源。
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'wvp-pages-artifact-'));
  TEMPORARY_ROOTS.add(temporaryRoot);
  // 类型: string；作用: 模拟 client/dist，准备器所有写入都限制在该目录。
  const distributionRoot = resolve(temporaryRoot, 'dist');
  // 类型: string；作用: 模拟 Vite 已生成的公开配置目录。
  const configRoot = resolve(distributionRoot, 'config');
  mkdirSync(configRoot, { recursive: true });

  // 类型: string；作用: 同时包含外部配置和主应用脚本，模拟 Vite 生产入口加载顺序。
  const indexSource = `<!doctype html><html><head><script type="module" src="${referencedBasePath}${FRONTEND_CONFIG_ASSET_PATH}"></script><script type="module" src="${referencedBasePath}assets/main.js"></script></head><body><div id="app"></div></body></html>`;
  writeFileSync(resolve(distributionRoot, 'index.html'), indexSource, 'utf8');
  writeFileSync(resolve(distributionRoot, FRONTEND_CONFIG_ASSET_PATH), '/* vite build placeholder */\n', 'utf8');

  return Object.freeze({ distributionRoot, indexSource });
}

/**
 * 从生成文本加载部署配置 ES module。
 * 副作用: 使用 Node data URL 模块加载器执行生成模块；模块在无 document 环境不发布浏览器全局。
 * 成功路径: 返回生成脚本的 default FrontendConfig，可核对结构和值。
 * 失败路径: 生成文本不是合法 ES module 时 import 拒绝，测试直接失败。
 *
 * @param {string} source 生成的公开前端配置脚本文本。
 * @returns {Promise<Readonly<object>>} 生成模块默认导出的完整前端配置。
 */
async function importGeneratedConfig(source) {
  // 类型: string；作用: 把 UTF-8 模块文本编码为不依赖临时 package type 的 ESM data URL。
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
  // 类型: object；作用: 保存 Node 解析并执行生成配置模块后返回的模块命名空间。
  // 异步调用: 让 Node 解析并执行生成配置模块。
  // resolve: 返回模块命名空间，其中 default 是生成的 FrontendConfig。
  // reject: 文本语法或导出错误时由 import 原样拒绝。
  const moduleNamespace = await import(moduleUrl);
  return moduleNamespace.default;
}

// 副作用: 每个用例结束后删除本文件登记的全部临时目录，不访问仓库正式 dist。
afterEach(() => {
  // 循环类型: for...of；初始值: 当前登记的第一个临时根；终止条件: 全部临时根清理完成。
  // 循环作用: 即使用例断言失败，也不把测试产物留在系统临时目录。
  for (const temporaryRoot of TEMPORARY_ROOTS) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  TEMPORARY_ROOTS.clear();
});

// 测试目的: 仓库子路径构建必须生成可执行部署配置、精确 404 回退和空 .nojekyll。
test('准备仓库子路径 GitHub Pages 产物', async () => {
  // 类型: object；作用: 模拟公开仓库构建配置，不修改 v5 根配置的 / 基础路径。
  const frontendConfig = createFrontendConfigCandidate(TEST_BASE_PATH);
  // 类型: Readonly<object>；作用: 建立与候选基础路径一致的最小 Vite 产物。
  const fixture = createArtifactFixture(frontendConfig);
  // 类型: Readonly<object>；作用: 执行真实产物整理并保存写入摘要。
  const result = prepareGitHubPagesArtifact({
    distributionRoot: fixture.distributionRoot,
    backendOrigin: TEST_BACKEND_ORIGIN,
    frontendConfig
  });

  // 类型: string；作用: 读取生成部署配置，验证语法和公开运行值。
  const configSource = readFileSync(result.frontendConfigPath, 'utf8');
  // 类型: Readonly<object>；作用: 执行生成模块，证明浏览器可加载语法和完整字段结构。
  const generatedConfig = await importGeneratedConfig(configSource);

  assert.equal(result.basePath, TEST_BASE_PATH);
  assert.equal(result.backendOrigin, TEST_BACKEND_ORIGIN);
  assert.equal(generatedConfig.runtime.backendOrigin, TEST_BACKEND_ORIGIN);
  assert.equal(generatedConfig.build.basePath, TEST_BASE_PATH);
  assert.equal(Object.isFrozen(generatedConfig), true);
  assert.equal(readFileSync(result.fallbackPath, 'utf8'), fixture.indexSource);
  assert.equal(readFileSync(result.noJekyllPath, 'utf8'), '');
});

// 测试目的: 部署配置投影只能替换后端 origin，且不得修改正式或调用方配置对象。
test('部署配置保持源码候选不变', () => {
  // 类型: object；作用: 保存调用前配置候选。
  const frontendConfig = createFrontendConfigCandidate(TEST_BASE_PATH);
  // 类型: object；作用: 保存调用前精确副本，调用后用于深比较。
  const originalSnapshot = structuredClone(frontendConfig);
  // 类型: Readonly<object>；作用: 建立独立部署配置并验证字段保持。
  const deploymentConfig = createDeploymentFrontendConfig(frontendConfig, TEST_BACKEND_ORIGIN);

  assert.deepEqual(frontendConfig, originalSnapshot);
  assert.equal(FRONTEND_CONFIG.runtime.backendOrigin, 'http://localhost:3000');
  assert.equal(deploymentConfig.runtime.backendOrigin, TEST_BACKEND_ORIGIN);
  assert.deepEqual(deploymentConfig.developmentServer, originalSnapshot.developmentServer);
  assert.deepEqual(deploymentConfig.build, originalSnapshot.build);
});

// 测试目的: Pages 发布不能采用 HTTP、带路径或缺失的后端地址。
test('拒绝无效或非 HTTPS 部署后端 origin', () => {
  // 类型: object；作用: 所有失败候选共用同一合法基础配置，确保错误只来自后端 origin。
  const frontendConfig = createFrontendConfigCandidate(TEST_BASE_PATH);

  assert.throws(
    () => createDeploymentFrontendConfig(frontendConfig, 'http://api.example.com'),
    /必须使用 HTTPS/u
  );
  assert.throws(
    () => createDeploymentFrontendConfig(frontendConfig, 'https://api.example.com/proxy'),
    /无路径、无凭据/u
  );
  assert.throws(
    () => createDeploymentFrontendConfig(frontendConfig, ''),
    /非空字符串/u
  );
});

// 测试目的: index.html 引用错误基础路径时必须在覆盖构建配置前失败关闭。
test('拒绝与构建配置不一致的入口基础路径', () => {
  // 类型: object；作用: 声明当前发布应使用的仓库子路径。
  const frontendConfig = createFrontendConfigCandidate(TEST_BASE_PATH);
  // 类型: Readonly<object>；作用: 故意建立引用另一个路径的入口反例。
  const fixture = createArtifactFixture(frontendConfig, '/wrong-repository/');
  // 类型: string；作用: 保存准备前占位配置，证明失败不会覆盖已有构建资产。
  const originalConfigSource = readFileSync(
    resolve(fixture.distributionRoot, FRONTEND_CONFIG_ASSET_PATH),
    'utf8'
  );

  assert.throws(
    () => prepareGitHubPagesArtifact({
      distributionRoot: fixture.distributionRoot,
      backendOrigin: TEST_BACKEND_ORIGIN,
      frontendConfig
    }),
    /构建基础路径不一致/u
  );
  assert.equal(
    readFileSync(resolve(fixture.distributionRoot, FRONTEND_CONFIG_ASSET_PATH), 'utf8'),
    originalConfigSource
  );
});

// 测试目的: 产物准备重复执行必须得到相同配置、404 和标记，不累计部署状态。
test('重复准备同一 Pages 产物保持幂等', () => {
  // 类型: object；作用: 提供同一次构建采用的完整配置。
  const frontendConfig = createFrontendConfigCandidate(TEST_BASE_PATH);
  // 类型: Readonly<object>；作用: 建立只被当前用例操作的临时 dist。
  const fixture = createArtifactFixture(frontendConfig);
  // 类型: object；作用: 两次调用使用完全相同的显式输入。
  const options = {
    distributionRoot: fixture.distributionRoot,
    backendOrigin: TEST_BACKEND_ORIGIN,
    frontendConfig
  };

  // 类型: Readonly<object>；作用: 保存首次写入路径摘要。
  const firstResult = prepareGitHubPagesArtifact(options);
  // 类型: object；作用: 保存首次生成的三项精确文本。
  const firstSnapshot = {
    config: readFileSync(firstResult.frontendConfigPath, 'utf8'),
    fallback: readFileSync(firstResult.fallbackPath, 'utf8'),
    noJekyll: readFileSync(firstResult.noJekyllPath, 'utf8')
  };
  // 类型: Readonly<object>；作用: 第二次执行同一准备流程，验证不会依赖首次隐藏状态。
  const secondResult = prepareGitHubPagesArtifact(options);

  assert.equal(readFileSync(secondResult.frontendConfigPath, 'utf8'), firstSnapshot.config);
  assert.equal(readFileSync(secondResult.fallbackPath, 'utf8'), firstSnapshot.fallback);
  assert.equal(readFileSync(secondResult.noJekyllPath, 'utf8'), firstSnapshot.noJekyll);
});

// 测试目的: 缺少真实 Vite 构建入口或配置资产时不能创建看似可发布的 Pages 文件。
test('拒绝缺失构建文件的发布目录', () => {
  // 类型: string；作用: 建立没有 dist 构建文件的临时目录反例。
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'wvp-pages-missing-'));
  TEMPORARY_ROOTS.add(temporaryRoot);

  assert.throws(
    () => prepareGitHubPagesArtifact({
      distributionRoot: temporaryRoot,
      backendOrigin: TEST_BACKEND_ORIGIN,
      frontendConfig: createFrontendConfigCandidate(TEST_BASE_PATH)
    }),
    /发布产物缺失/u
  );
});
