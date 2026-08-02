/*
  release-facts.test.js 模块说明

  - 文件职责:
      验证发布事实检查器能够采用当前源码，并稳定拒绝 README 中的 Provider、数据库、代理协议和开发端口漂移。
      测试只在内存修改 README 夹具，不改写真实文档、配置、Provider 或 Git 状态。

  - 导入库及文件汇总(6 条，内置 5 条，第三方 0 条，自定义 1 条):
      assert: Node 内置严格断言模块，用于验证事实和问题文本。
      readFileSync: Node 内置文件读取函数，用于读取当前 README 作为合法基线夹具。
      dirname/resolve: Node 内置路径函数，用于从测试文件定位仓库根目录。
      test: Node 内置测试函数，用于声明独立发布事实用例。
      fileURLToPath: Node 内置 URL 函数，用于把 import.meta.url 转换为文件路径。
      release facts functions: 自定义工程脚本导出，用于收集事实、生成 Markdown 和返回检查问题。

  - 模块级常量:
      repositoryRoot: string，当前 Git 仓库绝对根目录。
      readmePath: string，根 README 绝对路径。

  - 模块级变量:
      无

  - 模块级辅助函数:
      readCurrentReadme(): 读取真实 README UTF-8 文本作为测试基线。
      replaceRequired(source, expected, replacement): 只替换第一处必需文本，夹具失配时立即失败。
      assertHasIssue(issues, expectedText): 断言问题数组包含指定高信号文本。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 node:test 执行并通过断言表达结果。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 内置严格断言对象。
// 文件作用: 验证发布事实、Markdown 区块和稳定错误文本。
import assert from 'node:assert/strict';

// 导入来源: node:fs。
// 导入内容: readFileSync 内置文件读取函数。
// 文件作用: 读取当前 README，测试不维护第二份合法文档夹具。
import { readFileSync } from 'node:fs';

import {
  // 导入来源: node:path。
  // 导入内容: dirname 内置路径函数。
  // 文件作用: 从当前测试文件绝对路径定位 client/tests 目录。
  dirname,

  // 导入来源: node:path。
  // 导入内容: resolve 内置路径函数。
  // 文件作用: 生成仓库根目录和 README 绝对路径。
  resolve
} from 'node:path';

// 导入来源: node:test。
// 导入内容: test 内置测试声明函数。
// 文件作用: 注册可以由 npm 领域测试运行的发布事实用例。
import test from 'node:test';

// 导入来源: node:url。
// 导入内容: fileURLToPath 内置 URL 转换函数。
// 文件作用: 把 import.meta.url 转换为当前 Windows 文件路径。
import { fileURLToPath } from 'node:url';

import {
  // 导入来源: ../scripts/release-facts.mjs。
  // 导入内容: collectReleaseFactIssues 发布事实问题收集函数。
  // 文件作用: 对真实 README 和内存反例执行与工程闸门相同的检查。
  collectReleaseFactIssues,

  // 导入来源: ../scripts/release-facts.mjs。
  // 导入内容: collectReleaseFacts 权威事实收集函数。
  // 文件作用: 从当前源码取得测试替换所需真实值，不在测试中硬编码版本。
  collectReleaseFacts,

  // 导入来源: ../scripts/release-facts.mjs。
  // 导入内容: createReleaseFactsMarkdown Markdown 生成函数。
  // 文件作用: 证明当前 README 包含由同一事实生成的完整唯一区块。
  createReleaseFactsMarkdown
} from '../scripts/release-facts.mjs';

// 类型: string。
// 作用: 当前测试文件所在目录，作为定位仓库根目录的稳定基准。
const testDirectory = dirname(fileURLToPath(import.meta.url));

// 类型: string。
// 作用: 当前 Git 仓库绝对根目录；发布事实检查不依赖测试进程 cwd。
const repositoryRoot = resolve(testDirectory, '..', '..');

// 类型: string。
// 作用: 根 README 绝对路径，全部用例共用同一合法基线文本。
const readmePath = resolve(repositoryRoot, 'README.md');

/**
 * 读取当前 README。
 * 副作用: 同步读取一个本地 UTF-8 文档；不修改文件。
 * 成功路径: 返回真实 README 文本。
 * 失败路径: 文件缺失或不可读时抛出原始错误并使测试失败。
 *
 * @returns {string} 当前 README UTF-8 文本。
 * @throws {Error} README 无法读取时抛出。
 */
function readCurrentReadme() {
  // 返回值类型: string；作用: 每个用例获得独立字符串并在内存构造反例。
  return readFileSync(readmePath, 'utf8');
}

/**
 * 替换一处测试必需文本。
 * 纯函数: 不修改原字符串或真实文件。
 * 成功路径: expected 存在时只替换第一处并返回新字符串。
 * 失败路径: expected 缺失时断言失败，防止反例没有真正改变输入却误报测试通过。
 *
 * @param {string} source 原始 README 文本。
 * @param {string} expected 必须存在的当前事实片段。
 * @param {string} replacement 构造漂移使用的替代片段。
 * @returns {string} 只替换第一处后的新文本。
 */
function replaceRequired(source, expected, replacement) {
  // 条件分支: 当前 README 不包含预期事实片段时进入。
  // 执行内容: 立即失败，要求先更新用例定位而不是让空替换伪造反例。
  assert.ok(source.includes(expected), `README 缺少测试目标: ${expected}`);

  // 返回值类型: string；作用: String.replace 只替换第一处字符串匹配，其他事实保持合法。
  return source.replace(expected, replacement);
}

/**
 * 断言问题数组包含指定文本。
 * 纯函数: 不修改问题数组。
 *
 * @param {Array<string>} issues 发布事实检查结果。
 * @param {string} expectedText 预期问题包含的稳定文本。
 * @returns {void} 断言函数不返回业务数据。
 */
function assertHasIssue(issues, expectedText) {
  // 执行内容: 至少一项问题必须包含预期文本；失败时输出完整问题数组辅助定位。
  assert.ok(
    issues.some(issue => issue.includes(expectedText)),
    `缺少预期问题 ${expectedText}: ${JSON.stringify(issues)}`
  );
}

/**
 * 用例: 当前源码与 README 发布事实完全一致。
 * 副作用: 只读取仓库文件和加载纯配置模块。
 * 成功路径: 问题数组为空，生成区块只在 README 出现一次。
 * 失败路径: 任一权威值或 README 漂移时断言失败。
 */
test('当前 README 采用全部权威发布事实', async () => {
  // 异步调用: 收集当前项目发布事实。
  // resolve: 返回冻结事实对象。
  // reject: 权威配置损坏时直接使当前用例失败。
  // 类型: Readonly<object>；作用: 生成当前唯一 README 区块。
  const facts = await collectReleaseFacts({ repositoryRoot });
  // 类型: string；作用: 当前真实 README 文本。
  const readme = readCurrentReadme();
  // 类型: string；作用: 根据事实生成的精确区块，不在测试维护版本副本。
  const expectedBlock = createReleaseFactsMarkdown(facts);
  // 异步调用: 使用生产检查入口核对真实 README。
  // resolve: 返回空数组表示全部事实与重复声明边界通过。
  // reject: collectReleaseFactIssues 自身收敛读取异常，不应 reject。
  // 类型: Array<string>；作用: 保存生产检查结果。
  const issues = await collectReleaseFactIssues({ repositoryRoot, readmeSource: readme });

  // 执行内容: 当前 README 必须包含完整生成区块，不能只包含若干相同数字。
  assert.ok(readme.replace(/\r\n?/gu, '\n').includes(expectedBlock));
  // 执行内容: 当前合法基线不得产生任何发布事实问题。
  assert.deepEqual(issues, []);
});

/**
 * 用例: Provider 脚本版本重复声明漂移时失败。
 * 副作用: 只读取文件并在内存追加一行错误说明。
 * 成功路径: 检查器返回包含脚本名的 Provider 版本过期问题。
 */
test('拒绝发布事实区块外的旧 Provider 版本', async () => {
  // 类型: Readonly<object>；作用: 取得当前第一条 Provider 文件名与版本，不在测试硬编码产品来源。
  const facts = await collectReleaseFacts({ repositoryRoot });
  // 类型: Readonly<object>；作用: 选择目录当前第一条 Provider 构造单一错误声明。
  const provider = facts.providers[0];
  // 类型: string；作用: 只取脚本文件名，模拟 README 常见“脚本名 + 版本”写法。
  const scriptFileName = provider.filePath.split('/').pop();
  // 类型: string；作用: 在合法 README 尾部追加旧版本，不修改机器区块。
  const invalidReadme = `${readCurrentReadme()}\n- ${scriptFileName} 0.0.0\n`;
  // 类型: Array<string>；作用: 保存反例检查结果。
  const issues = await collectReleaseFactIssues({ repositoryRoot, readmeSource: invalidReadme });

  // 执行内容: 检查器必须明确指出 Provider 版本声明过期。
  assertHasIssue(issues, 'README Provider 版本声明过期');
});

/**
 * 用例: IndexedDB 当前版本被改错时失败。
 * 副作用: 只读取文件并在内存修改事实区块。
 * 成功路径: 检查器报告机器事实区块与权威源码不一致。
 */
test('拒绝错误 IndexedDB schema', async () => {
  // 类型: Readonly<object>；作用: 取得当前数据库整数版本。
  const facts = await collectReleaseFacts({ repositoryRoot });
  // 类型: string；作用: 把表格中的当前 vN 改为 vN+1，其他区块内容保持不变。
  const invalidReadme = replaceRequired(
    readCurrentReadme(),
    `| IndexedDB schema | v${facts.browserDatabaseVersion} |`,
    `| IndexedDB schema | v${facts.browserDatabaseVersion + 1} |`
  );
  // 类型: Array<string>；作用: 保存数据库漂移检查结果。
  const issues = await collectReleaseFactIssues({ repositoryRoot, readmeSource: invalidReadme });

  // 执行内容: 事实区块任一值变化都必须阻断工程检查。
  assertHasIssue(issues, 'README 当前发布事实区块与权威源码不一致');
});

/**
 * 用例: Proxy Protocol 版本被改错时失败。
 * 副作用: 只读取文件并在内存修改事实区块。
 * 成功路径: 检查器报告机器事实区块与后端协议权威不一致。
 */
test('拒绝错误 Proxy Protocol 版本', async () => {
  // 类型: Readonly<object>；作用: 取得当前后端代理协议版本和路由。
  const facts = await collectReleaseFacts({ repositoryRoot });
  // 类型: string；作用: 只替换代理协议表格单元格，不改变 Provider ABI 的同版本文本。
  const invalidReadme = replaceRequired(
    readCurrentReadme(),
    `| Proxy Protocol / 路由 | \`${facts.proxy.protocolVersion}\` / \`${facts.proxy.requestRoute}\` |`,
    `| Proxy Protocol / 路由 | \`9.9.9\` / \`${facts.proxy.requestRoute}\` |`
  );
  // 类型: Array<string>；作用: 保存协议漂移检查结果。
  const issues = await collectReleaseFactIssues({ repositoryRoot, readmeSource: invalidReadme });

  // 执行内容: 错误协议不能被 README 或前端说明接受。
  assertHasIssue(issues, 'README 当前发布事实区块与权威源码不一致');
});

/**
 * 用例: Vite 开发端口被改错时失败。
 * 副作用: 只读取文件并在内存修改事实区块。
 * 成功路径: 检查器报告机器事实区块与 Vite 权威端口不一致。
 */
test('拒绝错误前端开发端口', async () => {
  // 类型: Readonly<object>；作用: 取得当前 Vite 固定端口。
  const facts = await collectReleaseFacts({ repositoryRoot });
  // 类型: string；作用: 选择 facts 区块第一项 localhost 地址作为单一修改目标。
  const currentUrl = `http://localhost:${facts.development.port}`;
  // 类型: string；作用: 使用相邻错误端口构造确定性反例。
  const invalidUrl = `http://localhost:${facts.development.port + 1}`;
  // 类型: string；作用: 只替换事实区块中的第一处 localhost 地址。
  const invalidReadme = replaceRequired(readCurrentReadme(), currentUrl, invalidUrl);
  // 类型: Array<string>；作用: 保存开发端口漂移检查结果。
  const issues = await collectReleaseFactIssues({ repositoryRoot, readmeSource: invalidReadme });

  // 执行内容: 错误端口必须在构建前被拒绝，避免用户按无效地址启动。
  assertHasIssue(issues, 'README 当前发布事实区块与权威源码不一致');
});
