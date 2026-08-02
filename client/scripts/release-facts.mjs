/*
  release-facts.mjs 模块说明

  - 文件职责:
      从项目现有权威源码和根/客户端/服务端 package.json 收集 1.0 当前发布事实，并核对 README 的唯一发布事实区块及重复版本声明。
      供客户端工程闸门和发布事实测试共同使用；本模块只读文件和模块导出，不生成第二份版本配置或修改文档。

  - 导入库及文件汇总(4 条，内置 3 条，第三方 1 条，自定义 0 条):
      readFileSync: Node 内置文件读取函数，用于读取 JSON、README 和内置目录源码。
      dirname/relative/resolve: Node 内置路径函数，用于把内置目录 import 解析为受控仓库路径。
      pathToFileURL: Node 内置 URL 函数，用于按真实文件路径加载无浏览器副作用的权威配置模块。
      parse: Acorn 第三方 AST 解析函数，用于读取内置目录的静态发布常量和 Provider 文件清单。

  - 模块级常量:
      README_RELEASE_FACTS_MARKER: Readonly<object>，README 唯一发布事实区块的起止标记。
      RELEASE_FACT_SOURCE_PATH: Readonly<object>，发布事实权威源码的仓库相对路径。
      CATALOG_RELEASE_EXPORTS: ReadonlyArray<string>，内置目录必须静态导出的四个发布身份字段。
      SEMANTIC_VERSION_PATTERN_SOURCE: string，README 重复版本声明检查使用的三段版本捕获表达式。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeText(text): 统一换行，避免 Windows 与 Git 换行差异制造文档误报。
      readJsonFile(repositoryRoot, filePath): 严格读取并解析仓库 JSON 文件。
      importRepositoryModule(repositoryRoot, filePath): 按仓库路径加载权威 ES module。
      readStaticCatalogFacts(source): 从内置目录 AST 读取四个静态发布常量。
      readCatalogProviderPaths(source, catalogPath, repositoryRoot): 从目录 import 声明派生当前 Provider 单文件路径。
      assertSingleValue(values, fieldName): 要求多个 Provider 对公共版本只有一个值。
      escapeMarkdownCell(value): 转义发布事实表格中的竖线。
      escapeRegularExpression(value): 转义动态文件名，供重复声明检查使用。
      createDevelopmentUrls(port): 生成 README 展示的三个本机开发地址。
      collectDuplicateDeclarationIssues(readmeWithoutBlock, facts): 检查发布事实区块外的陈旧版本声明。

  - 模块级类:
      无

  - 对外导出:
      collectReleaseFacts: async function，从权威源码返回冻结发布事实对象。
      createReleaseFactsMarkdown: function，把发布事实生成 README 唯一区块。
      collectReleaseFactIssues: async function，返回工程闸门可以直接合并的发布事实问题数组。
*/

// 导入来源: node:fs。
// 导入内容: readFileSync 内置文件读取函数。
// 文件作用: 同步读取体积受控的项目配置、README 和目录源码，不写入任何文件。
import { readFileSync } from 'node:fs';

import {
  // 导入来源: node:path。
  // 导入内容: dirname 内置路径函数。
  // 文件作用: 以 builtin-source-catalog.js 所在目录解析相对 Provider import。
  dirname,

  // 导入来源: node:path。
  // 导入内容: relative 内置路径函数。
  // 文件作用: 把绝对 Provider 路径恢复为稳定仓库相对路径并执行目录边界检查。
  relative,

  // 导入来源: node:path。
  // 导入内容: resolve 内置路径函数。
  // 文件作用: 统一把仓库相对路径转换为可读取或导入的绝对路径。
  resolve
} from 'node:path';

// 导入来源: node:url。
// 导入内容: pathToFileURL 内置 URL 转换函数。
// 文件作用: 将绝对文件路径转换为 Node ESM 动态导入地址。
import { pathToFileURL } from 'node:url';

// 导入来源: acorn。
// 导入内容: parse JavaScript AST 解析函数。
// 文件作用: 结构化读取内置目录的 export 与 import，不用正则猜测 JavaScript 语法。
import { parse } from 'acorn';

// 类型: Readonly<object>。
// 作用: 冻结 README 机器校验区块的唯一边界；区块外可以写说明，但不能再维护另一份当前版本表。
// 字段: start，string，发布事实区块开始标记。
// 字段: end，string，发布事实区块结束标记。
const README_RELEASE_FACTS_MARKER = Object.freeze({
  // 类型: string；作用: 让检查器精确定位发布事实区块起点，用户不可见。
  start: '<!-- release-facts:start -->',
  // 类型: string；作用: 让检查器精确定位发布事实区块终点，用户不可见。
  end: '<!-- release-facts:end -->'
});

// 类型: Readonly<object>。
// 作用: 集中登记当前发布事实的权威源码位置；值只指向已有真相源，不保存任何版本值。
// 字段: rootPackage/clientPackage/serverPackage，string，根级发布身份与前后端项目版本来源。
// 字段: builtinCatalog，string，内置目录发布身份与 Provider 清单来源。
// 字段: browserPersistence/settingsModules，string，数据库和设置模块来源。
// 字段: frontendConfig/backendConfig/proxyClient/viteConfig/proxyProtocol/proxyPolicy，string，前后端运行配置与公共协议来源。
const RELEASE_FACT_SOURCE_PATH = Object.freeze({
  // 类型: string；作用: 读取仓库根级统一发布版本。
  rootPackage: 'package.json',
  // 类型: string；作用: 读取客户端 package 版本。
  clientPackage: 'client/package.json',
  // 类型: string；作用: 读取服务端 package 版本。
  serverPackage: 'server/package.json',
  // 类型: string；作用: 读取内置目录 revision、version、fingerprint 和当前 Provider import。
  builtinCatalog: 'client/src/data/settings/builtin-source-catalog.js',
  // 类型: string；作用: 读取 IndexedDB 当前整数 schema version。
  browserPersistence: 'client/src/repositories/persistence/browserPersistence.config.js',
  // 类型: string；作用: 读取设置导航中真实可见模块。
  settingsModules: 'client/src/config/settings-module.config.js',
  // 类型: string；作用: 读取外部公开运行时后端 origin、开发监听和构建路径的唯一前端配置。
  frontendConfig: 'config/frontend.config.js',
  // 类型: string；作用: 读取后端监听、CORS 和可收紧限制的唯一部署配置。
  backendConfig: 'config/backend.config.js',
  // 类型: string；作用: 读取前端代理协议入口，不再从该模块读取部署地址。
  proxyClient: 'client/src/runtime/source-network/proxyClient.config.js',
  // 类型: string；作用: 读取 Vite 双栈监听和固定开发端口。
  viteConfig: 'client/vite.config.js',
  // 类型: string；作用: 读取后端冻结 Proxy Protocol 版本与路由。
  proxyProtocol: 'server/src/contracts/proxyProtocol.js',
  // 类型: string；作用: 读取后端配置到完整运行策略的唯一映射和安全硬上限。
  proxyPolicy: 'server/src/config/proxyPolicy.js',
  // 类型: string；作用: 读取并校验根 README 当前发布事实声明。
  readme: 'README.md'
});

// 类型: ReadonlyArray<string>。
// 作用: 固定内置目录必须以静态字面量导出的发布身份字段，避免检查器执行含 ?raw 的 Vite 专用模块。
const CATALOG_RELEASE_EXPORTS = Object.freeze([
  'BUILTIN_SOURCE_CATALOG_REVISION',
  'BUILTIN_SOURCE_CATALOG_VERSION',
  'BUILTIN_SOURCE_CATALOG_FINGERPRINT',
  'BUILTIN_SOURCE_CATALOG_RELEASED_AT'
]);

// 类型: string。
// 作用: 捕获 README 中三段数字语义版本；只检查显示声明，不负责判断依赖兼容。
const SEMANTIC_VERSION_PATTERN_SOURCE = '(\\d+\\.\\d+\\.\\d+)';

/**
 * 统一文本换行。
 * 纯函数: 相同输入始终返回相同 LF 文本，不读取或修改文件。
 * 兜底策略: 非字符串输入转换为空字符串，让调用方输出明确缺失问题。
 *
 * @param {unknown} text 原始文件或测试夹具文本。
 * @returns {string} 使用 LF 换行的文本。
 */
function normalizeText(text) {
  // 返回值类型: string。
  // 作用: 消除 CRLF 与 LF 差异，发布事实内容本身仍要求精确一致。
  return typeof text === 'string' ? text.replace(/\r\n?/gu, '\n') : '';
}

/**
 * 读取并解析仓库 JSON 文件。
 * 副作用: 同步读取本地文件；不修改文件、缓存或进程环境。
 * 成功路径: 返回 JSON.parse 生成的独立对象。
 * 失败路径: 文件缺失或 JSON 无效时抛出原始错误，由发布事实检查转换为工程问题。
 *
 * @param {string} repositoryRoot Git 仓库绝对根目录。
 * @param {string} filePath JSON 文件仓库相对路径。
 * @returns {object} 解析后的 JSON 对象。
 * @throws {Error} 文件读取或 JSON 解析失败时抛出。
 */
function readJsonFile(repositoryRoot, filePath) {
  // 类型: string；作用: 读取 UTF-8 JSON 原文，保留 JSON.parse 的严格语法失败。
  const source = readFileSync(resolve(repositoryRoot, filePath), 'utf8');

  // 返回值类型: object；作用: 返回结构化配置，调用方不通过正则读取 package 字段。
  return JSON.parse(source);
}

/**
 * 加载仓库内权威 ES module。
 * 副作用: 触发目标配置模块的正常顶层初始化；只允许加载计划登记的无页面、无数据库、无网络副作用模块。
 * 成功路径: 返回模块命名空间对象。
 * 失败路径: 模块缺失、语法错误或配置初始化失败时 reject，由工程闸门失败关闭。
 *
 * @param {string} repositoryRoot Git 仓库绝对根目录。
 * @param {string} filePath ES module 仓库相对路径。
 * @returns {Promise<object>} 目标模块命名空间。
 * @throws {Error} 模块无法加载时抛出。
 */
async function importRepositoryModule(repositoryRoot, filePath) {
  // 类型: string；作用: 生成 Node 可加载的 file URL，不拼接脚本内容或使用 eval。
  const moduleUrl = pathToFileURL(resolve(repositoryRoot, filePath)).href;

  // 返回值类型: Promise<object>；作用: 把权威命名导出交给事实收集器读取。
  return import(moduleUrl);
}

/**
 * 从内置目录 AST 读取静态发布常量。
 * 纯函数: 只解析传入源码，不执行目录模块、Provider 或 Vite raw loader。
 * 成功路径: 返回四个必需导出的字面量值。
 * 失败路径: 导出缺失、重复或不是 string/number 字面量时抛 TypeError。
 *
 * @param {string} source builtin-source-catalog.js UTF-8 源码。
 * @returns {object} 内置目录静态发布身份。
 * @returns {number} return.BUILTIN_SOURCE_CATALOG_REVISION 单调目录 revision。
 * @returns {string} return.BUILTIN_SOURCE_CATALOG_VERSION 可读目录版本。
 * @returns {string} return.BUILTIN_SOURCE_CATALOG_FINGERPRINT 冻结目录指纹。
 * @returns {string} return.BUILTIN_SOURCE_CATALOG_RELEASED_AT 目录发布时间。
 * @throws {TypeError} 目录导出不满足静态发布事实边界时抛出。
 */
function readStaticCatalogFacts(source) {
  // 类型: object；作用: 使用 Acorn module 模式解析真实目录源码，语法异常直接失败。
  const syntaxTree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  // 类型: Map<string, string|number>；作用: 收集目标命名导出并检查重复。
  const values = new Map();

  // 循环类型: for...of。
  // 初始值: Program.body 第一条顶层语句。
  // 终止条件: 所有顶层语句检查完成。
  // 循环作用: 只读取 export const 的字面量初始化，不解释函数、raw import 或目录条目业务。
  for (const statement of syntaxTree.body) {
    // 条件分支: 当前语句不是具名变量导出时进入。
    // 执行内容: 跳过 import、函数和普通声明，它们不属于发布身份。
    if (statement.type !== 'ExportNamedDeclaration'
      || statement.declaration?.type !== 'VariableDeclaration') {
      continue;
    }

    // 循环类型: for...of。
    // 初始值: 当前 export const 的第一项 declarator。
    // 终止条件: 当前变量声明全部检查完成。
    // 循环作用: 找到四个冻结发布常量并保存字面量。
    for (const declaration of statement.declaration.declarations) {
      // 类型: string|undefined；作用: 只接受简单标识符导出，不解析解构或计算名称。
      const exportName = declaration.id?.type === 'Identifier' ? declaration.id.name : undefined;

      // 条件分支: 当前导出不属于发布身份时进入；执行内容: 继续检查下一声明。
      if (!CATALOG_RELEASE_EXPORTS.includes(exportName)) continue;

      // 条件分支: 导出重复或初始化不是 string/number Literal 时进入。
      // 执行内容: 拒绝运行时计算、别名和第二份身份，保证检查器读到稳定源码事实。
      if (values.has(exportName)
        || declaration.init?.type !== 'Literal'
        || !['string', 'number'].includes(typeof declaration.init.value)) {
        throw new TypeError(`内置目录发布字段必须是唯一静态字面量: ${exportName}`);
      }

      // 执行内容: 保存当前字面量，完成后统一检查四字段是否齐全。
      values.set(exportName, declaration.init.value);
    }
  }

  // 循环类型: for...of。
  // 初始值: 第一项必需目录发布导出名。
  // 终止条件: 四个导出名全部核对完成。
  // 循环作用: 禁止 README 检查在目录身份不完整时使用默认值继续通过。
  for (const exportName of CATALOG_RELEASE_EXPORTS) {
    // 条件分支: 当前必需字段没有出现在静态导出中时进入。
    // 执行内容: 抛出明确错误，要求先修复权威目录。
    if (!values.has(exportName)) {
      throw new TypeError(`内置目录缺少发布字段: ${exportName}`);
    }
  }

  // 返回值类型: object。
  // 作用: 把 Map 转为冻结普通对象，供 Markdown 生成和检查复用。
  return Object.freeze(Object.fromEntries(values));
}

/**
 * 从内置目录 import 声明派生当前 Provider 单文件路径。
 * 纯函数: 只解析传入源码和路径，不加载 Provider 或修改目录。
 * 成功路径: 返回去重且保持首次 import 顺序的 datasource/*.js 仓库路径。
 * 失败路径: 没有 Provider、路径逃出仓库或 import 不位于 datasource 时抛 TypeError。
 *
 * @param {string} source builtin-source-catalog.js UTF-8 源码。
 * @param {string} catalogPath 目录文件仓库相对路径。
 * @param {string} repositoryRoot Git 仓库绝对根目录。
 * @returns {Array<string>} 当前目录引用的 Provider 单文件仓库路径。
 * @throws {TypeError} 目录没有合法 Provider import 时抛出。
 */
function readCatalogProviderPaths(source, catalogPath, repositoryRoot) {
  // 类型: object；作用: 用 module AST 读取 import source，避免注释和字符串中的假路径进入清单。
  const syntaxTree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  // 类型: string；作用: 作为相对 import 的唯一解析基准。
  const catalogDirectory = dirname(resolve(repositoryRoot, catalogPath));
  // 类型: Array<string>；作用: 保持目录首次 import 顺序，README 表格顺序不靠对象枚举猜测。
  const providerPaths = [];

  // 循环类型: for...of。
  // 初始值: Program.body 第一条顶层语句。
  // 终止条件: 所有顶层语句检查完成。
  // 循环作用: 收集目录实际 import 的 datasource JavaScript，raw 与普通 import 只保留一份。
  for (const statement of syntaxTree.body) {
    // 条件分支: 当前语句不是字符串 import 时进入；执行内容: 跳过非依赖声明。
    if (statement.type !== 'ImportDeclaration' || typeof statement.source?.value !== 'string') continue;

    // 类型: string；作用: 去掉 Vite ?raw 查询，让普通 manifest import 和 raw 文本 import 指向同一 Provider 文件。
    const importPath = statement.source.value.replace(/\?raw$/u, '');

    // 条件分支: 当前 import 不是 JavaScript 文件时进入；执行内容: 跳过未来非 Provider 资源。
    if (!importPath.endsWith('.js')) continue;

    // 类型: string；作用: 把目录相对 import 规范化为仓库相对正斜杠路径。
    const repositoryPath = relative(repositoryRoot, resolve(catalogDirectory, importPath)).replace(/\\/gu, '/');

    // 条件分支: 路径逃出仓库或不属于 datasource 目录时进入。
    // 执行内容: 拒绝把普通客户端模块误认为可发布 Provider。
    if (repositoryPath.startsWith('../') || !repositoryPath.startsWith('datasource/')) {
      throw new TypeError(`内置目录 Provider import 越界: ${statement.source.value}`);
    }

    // 条件分支: 当前 Provider 路径第一次出现时进入。
    // 执行内容: 保存一条，raw 与 manifest 双 import 不产生重复 README 行。
    if (!providerPaths.includes(repositoryPath)) providerPaths.push(repositoryPath);
  }

  // 条件分支: 内置目录没有任何 Provider 单文件时进入。
  // 执行内容: 失败关闭，不生成“0 条 Provider”的伪发布说明。
  if (providerPaths.length === 0) {
    throw new TypeError('内置目录没有声明 Provider 单文件');
  }

  // 返回值类型: Array<string>；作用: 返回独立数组，调用方可以异步加载但不能修改内部解析状态。
  return providerPaths;
}

/**
 * 要求多个 Provider 对一个公共版本只有唯一值。
 * 纯函数: 不修改输入集合。
 * 成功路径: 返回唯一非空字符串。
 * 失败路径: 没有值、存在空值或多个不同值时抛 TypeError。
 *
 * @param {Array<unknown>} values Provider manifest 字段值列表。
 * @param {string} fieldName 错误定位使用的公共字段名。
 * @returns {string} 唯一公共版本值。
 * @throws {TypeError} 公共版本不唯一时抛出。
 */
function assertSingleValue(values, fieldName) {
  // 类型: Set<string>；作用: 去重前先要求每项为非空字符串，避免 undefined 被转成文本后通过。
  const uniqueValues = new Set(values.filter(value => typeof value === 'string' && value.trim()));

  // 条件分支: 合法非空值数量与原数组不一致，或去重后不是一项时进入。
  // 执行内容: 抛错，README 不能用某个 Provider 的版本代表不一致目录。
  if (values.length === 0 || uniqueValues.size !== 1 || values.some(value => !uniqueValues.has(value))) {
    throw new TypeError(`当前 Provider ${fieldName} 必须完全一致`);
  }

  // 返回值类型: string；作用: 返回唯一公共版本，供发布事实表展示。
  return [...uniqueValues][0];
}

/**
 * 转义 Markdown 表格单元格。
 * 纯函数: 相同输入返回相同字符串。
 *
 * @param {unknown} value 表格展示值。
 * @returns {string} 竖线已转义的 Markdown 文本。
 */
function escapeMarkdownCell(value) {
  // 返回值类型: string；作用: 防止 Provider 名称或路径中的竖线破坏表格列结构。
  return String(value).replace(/\|/gu, '\\|');
}

/**
 * 转义动态正则文本。
 * 纯函数: 相同文本返回相同转义结果。
 *
 * @param {string} value Provider 文件名等普通文本。
 * @returns {string} 可安全嵌入 RegExp 的文本。
 */
function escapeRegularExpression(value) {
  // 返回值类型: string；作用: 只让动态文本按字面量匹配，不改变版本捕获表达式。
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * 生成三个本机开发访问地址。
 * 纯函数: 只根据端口生成固定 IPv4、IPv6 和 localhost origin。
 *
 * @param {number} port Vite 固定开发端口。
 * @returns {ReadonlyArray<string>} 三个等价本机访问地址。
 */
function createDevelopmentUrls(port) {
  // 返回值类型: ReadonlyArray<string>；作用: README 使用与后端默认 CORS 相同的三个本机 origin。
  return Object.freeze([
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://[::1]:${port}`
  ]);
}

/**
 * 从权威源码收集当前发布事实。
 * 副作用: 读取本地文件并加载计划登记的纯配置/Provider 模块；不启动应用、网络、数据库或 Provider 实例。
 * 成功路径: 返回深层冻结的项目、Provider、目录、数据库、设置和代理事实。
 * 失败路径: 权威文件缺失、版本冲突、配置形状异常或目录越界时 reject。
 *
 * @param {object} options 收集选项。
 * @param {string} options.repositoryRoot Git 仓库绝对根目录。
 * @returns {Promise<Readonly<object>>} 当前发布事实。
 * @throws {Error} 任一权威事实无法可靠取得时抛出。
 */
export async function collectReleaseFacts({ repositoryRoot }) {
  // 条件分支: 仓库根目录不是非空字符串时进入。
  // 执行内容: 抛出参数错误，调用方不能依赖当前工作目录猜测仓库位置。
  if (typeof repositoryRoot !== 'string' || !repositoryRoot.trim()) {
    throw new TypeError('release facts 需要有效 repositoryRoot');
  }

  // 类型: object；作用: 读取仓库根级 package 当前统一发布版本。
  const rootPackage = readJsonFile(repositoryRoot, RELEASE_FACT_SOURCE_PATH.rootPackage);
  // 类型: object；作用: 读取前端 package 当前项目版本。
  const clientPackage = readJsonFile(repositoryRoot, RELEASE_FACT_SOURCE_PATH.clientPackage);
  // 类型: object；作用: 读取后端 package 当前项目版本。
  const serverPackage = readJsonFile(repositoryRoot, RELEASE_FACT_SOURCE_PATH.serverPackage);
  // 类型: string；作用: 读取不能由 Node 直接执行的 Vite raw 目录源码。
  const catalogSource = readFileSync(resolve(repositoryRoot, RELEASE_FACT_SOURCE_PATH.builtinCatalog), 'utf8');
  // 类型: object；作用: 从目录静态导出取得 revision、version、fingerprint 和发布时间。
  const catalogFacts = readStaticCatalogFacts(catalogSource);
  // 类型: Array<string>；作用: 从目录真实 import 派生 Provider 文件，不维护手工来源列表。
  const providerPaths = readCatalogProviderPaths(
    catalogSource,
    RELEASE_FACT_SOURCE_PATH.builtinCatalog,
    repositoryRoot
  );

  // 异步调用: 并发加载互不依赖的纯配置和 Provider 模块。
  // resolve: 返回九类权威模块及按目录顺序排列的 Provider 模块。
  // reject: 任一模块语法、依赖或顶层配置失败时由当前函数向上失败关闭。
  // 类型: Array<object>；作用: 按固定顺序保存权威配置模块和目录派生的 Provider 模块。
  const [
    browserPersistenceModule,
    settingsModule,
    frontendConfigModule,
    proxyClientModule,
    viteConfigModule,
    proxyProtocolModule,
    backendConfigModule,
    proxyPolicyModule,
    ...providerModules
  ] = await Promise.all([
    importRepositoryModule(repositoryRoot, RELEASE_FACT_SOURCE_PATH.browserPersistence),
    importRepositoryModule(repositoryRoot, RELEASE_FACT_SOURCE_PATH.settingsModules),
    importRepositoryModule(repositoryRoot, RELEASE_FACT_SOURCE_PATH.frontendConfig),
    importRepositoryModule(repositoryRoot, RELEASE_FACT_SOURCE_PATH.proxyClient),
    importRepositoryModule(repositoryRoot, RELEASE_FACT_SOURCE_PATH.viteConfig),
    importRepositoryModule(repositoryRoot, RELEASE_FACT_SOURCE_PATH.proxyProtocol),
    importRepositoryModule(repositoryRoot, RELEASE_FACT_SOURCE_PATH.backendConfig),
    importRepositoryModule(repositoryRoot, RELEASE_FACT_SOURCE_PATH.proxyPolicy),
    ...providerPaths.map(filePath => importRepositoryModule(repositoryRoot, filePath))
  ]);

  // 条件分支: 根级、客户端或服务端 package 版本缺失或不一致时进入。
  // 执行内容: 拒绝生成单一项目版本，根级发布入口不能掩盖任一子工程身份漂移。
  if (typeof rootPackage.version !== 'string'
    || rootPackage.version !== clientPackage.version
    || rootPackage.version !== serverPackage.version) {
    throw new TypeError('根级、客户端与服务端项目版本必须一致');
  }

  // 类型: Array<Readonly<object>>；作用: 把目录路径与同序 Provider manifest 组合为发布展示记录。
  const providers = providerModules.map((providerModule, index) => {
    // 类型: object|undefined；作用: 读取 Provider 单文件唯一静态身份，不创建 ProviderFactory。
    const manifest = providerModule.sourceManifest;

    // 条件分支: manifest 缺失、未冻结或关键身份字段无效时进入。
    // 执行内容: 拒绝把不可发布脚本写入 README 当前事实。
    if (!manifest || typeof manifest !== 'object' || !Object.isFrozen(manifest)
      || typeof manifest.id !== 'string' || !manifest.id
      || typeof manifest.name !== 'string' || !manifest.name
      || typeof manifest.version !== 'string' || !manifest.version) {
      throw new TypeError(`Provider manifest 无效: ${providerPaths[index]}`);
    }

    // 返回值类型: Readonly<object>；作用: 只保留发布说明需要的脚本路径和 manifest 身份，不泄漏工厂。
    return Object.freeze({
      // 类型: string；作用: 记录目录中的单文件路径，重复版本声明检查据此定位脚本名。
      filePath: providerPaths[index],
      // 类型: string；作用: 保留 Provider 稳定 id，供诊断区分同名脚本。
      id: manifest.id,
      // 类型: string；作用: README 展示数据源正式名称。
      name: manifest.name,
      // 类型: string；作用: README 展示当前脚本版本。
      version: manifest.version,
      // 类型: string；作用: 参与目录公共 ABI 一致性校验。
      providerApiVersion: manifest.providerApiVersion,
      // 类型: string；作用: 参与 manifest schema 一致性校验。
      schemaVersion: manifest.schemaVersion
    });
  });

  // 类型: string；作用: 要求所有当前内置 Provider 使用同一 Host ABI。
  const providerApiVersion = assertSingleValue(
    providers.map(provider => provider.providerApiVersion),
    'providerApiVersion'
  );
  // 类型: string；作用: 要求所有当前内置 Provider 使用同一 manifest schema。
  const manifestSchemaVersion = assertSingleValue(
    providers.map(provider => provider.schemaVersion),
    'schemaVersion'
  );
  // 类型: Array<object>；作用: 只采用导航中真实可见的设置模块，隐藏定义不冒充用户能力。
  const visibleSettingsModules = settingsModule.SETTINGS_MODULES
    .filter(moduleDefinition => moduleDefinition.visible)
    .slice()
    .sort((leftModule, rightModule) => leftModule.order - rightModule.order);
  // 类型: object；作用: 用根后端配置创建服务实际采用的监听、CORS 和完整有效安全限制。
  const configuredProxyPolicy = proxyPolicyModule.createProxyPolicy(backendConfigModule.default);
  // 类型: object|undefined；作用: 读取 Vite 默认导出的真实开发服务器配置。
  const developmentServer = viteConfigModule.default?.server;
  // 类型: object|undefined；作用: 读取外部公开配置的 runtime 分区，发布事实不再依赖 ProxyClient 源码默认地址。
  const frontendRuntime = frontendConfigModule.default?.runtime;

  // 条件分支: 数据库、设置、代理或 Vite 权威配置缺少发布所需形状时进入。
  // 执行内容: 失败关闭，不用 README 默认值掩盖代码配置损坏。
  if (!Number.isSafeInteger(browserPersistenceModule.BROWSER_PERSISTENCE_DATABASE_VERSION)
    || visibleSettingsModules.length === 0
    || typeof frontendRuntime?.backendOrigin !== 'string'
    || typeof proxyProtocolModule.PROXY_PROTOCOL_VERSION !== 'string'
    || typeof proxyProtocolModule.PROXY_REQUEST_ROUTE !== 'string'
    || typeof developmentServer?.host !== 'string'
    || !Number.isSafeInteger(developmentServer?.port)) {
    throw new TypeError('发布运行配置缺少稳定事实');
  }

  // 类型: Readonly<object>。
  // 作用: 形成唯一发布事实投影；每个嵌套对象和数组均冻结，文档检查不能修改权威结果。
  const facts = Object.freeze({
    // 类型: string；作用: 根级、客户端与服务端一致的 1.0 项目版本。
    projectVersion: rootPackage.version,
    // 类型: string；作用: 当前内置 Provider 共同 ABI 版本。
    providerApiVersion,
    // 类型: string；作用: 当前内置 Provider 共同 manifest schema 版本。
    manifestSchemaVersion,
    // 类型: ReadonlyArray<object>；作用: 按内置目录 import 顺序展示当前 Provider。
    providers: Object.freeze(providers),
    // 类型: Readonly<object>；作用: 保存目录独立发布身份，不与 IndexedDB schema 混用。
    builtinCatalog: Object.freeze({
      // 类型: number；作用: 当前内置目录单调 revision。
      revision: catalogFacts.BUILTIN_SOURCE_CATALOG_REVISION,
      // 类型: string；作用: 当前内置目录可读版本。
      version: catalogFacts.BUILTIN_SOURCE_CATALOG_VERSION,
      // 类型: string；作用: 当前内置目录冻结内容指纹。
      fingerprint: catalogFacts.BUILTIN_SOURCE_CATALOG_FINGERPRINT,
      // 类型: string；作用: 当前内置目录统一发布时间。
      releasedAt: catalogFacts.BUILTIN_SOURCE_CATALOG_RELEASED_AT
    }),
    // 类型: number；作用: 当前 IndexedDB 整数 schema version。
    browserDatabaseVersion: browserPersistenceModule.BROWSER_PERSISTENCE_DATABASE_VERSION,
    // 类型: ReadonlyArray<string>；作用: 当前设置导航真实可见模块标题。
    settingsModules: Object.freeze(visibleSettingsModules.map(moduleDefinition => moduleDefinition.title)),
    // 类型: Readonly<object>；作用: 保存前端、后端和协议共同运行入口事实。
    proxy: Object.freeze({
      // 类型: string；作用: 前后端冻结 Proxy Protocol 版本。
      protocolVersion: proxyProtocolModule.PROXY_PROTOCOL_VERSION,
      // 类型: string；作用: 后端唯一代理业务路由。
      requestRoute: proxyProtocolModule.PROXY_REQUEST_ROUTE,
      // 类型: string；作用: 根 frontend.config.js 当前公开运行时后端 origin。
      clientDefaultBaseUrl: frontendRuntime.backendOrigin,
      // 类型: string；作用: 根 backend.config.js 当前声明的唯一监听地址。
      serverHost: configuredProxyPolicy.server.host,
      // 类型: number；作用: 根 backend.config.js 当前声明的唯一监听端口。
      serverPort: configuredProxyPolicy.server.port,
      // 类型: ReadonlyArray<string>；作用: 根 backend.config.js 当前声明的精确浏览器 origin。
      allowedOrigins: Object.freeze([...configuredProxyPolicy.server.allowedOrigins])
    }),
    // 类型: Readonly<object>；作用: 保存 Vite 本机开发服务事实。
    development: Object.freeze({
      // 类型: string；作用: Vite 双栈监听主机。
      host: developmentServer.host,
      // 类型: number；作用: Vite strictPort 使用的固定端口。
      port: developmentServer.port,
      // 类型: ReadonlyArray<string>；作用: 用户可访问的三个等价本机地址。
      urls: createDevelopmentUrls(developmentServer.port)
    })
  });

  // 条件分支: 前端与后端协议版本或路由不一致时进入。
  // 执行内容: 拒绝 README 选择其中一方，要求先修复公共协议实现。
  if (proxyClientModule.PROXY_CLIENT_CONFIG.protocolVersion !== facts.proxy.protocolVersion
    || proxyClientModule.PROXY_CLIENT_CONFIG.requestPath !== facts.proxy.requestRoute) {
    throw new TypeError('ProxyClient 与后端代理协议事实不一致');
  }

  // 条件分支: 任一前端开发 origin 不在后端精确 CORS 列表时进入。
  // 执行内容: 拒绝本地开发必然跨域失败；后端 origin 可以指向分离部署地址，不能强制等于监听 socket。
  if (facts.development.urls.some(url => !facts.proxy.allowedOrigins.includes(url))) {
    throw new TypeError('前端开发地址未进入后端允许来源');
  }

  // 返回值类型: Readonly<object>；作用: 给 README 生成器、工程闸门和测试共享同一实时事实。
  return facts;
}

/**
 * 把当前发布事实生成 README 唯一机器校验区块。
 * 纯函数: 相同事实对象生成相同 LF Markdown，不读取文件。
 * 失败路径: 调用方传入缺失字段时由原生访问错误暴露，不使用旧版本默认值。
 *
 * @param {Readonly<object>} facts collectReleaseFacts 返回的当前事实。
 * @returns {string} 包含起止标记、标题、说明和表格的 Markdown。
 */
export function createReleaseFactsMarkdown(facts) {
  // 类型: string；作用: 把每条 Provider 的正式名称、脚本文件名和版本组合为单一表格值。
  const providerSummary = facts.providers
    .map(provider => `${escapeMarkdownCell(provider.name)}（\`${escapeMarkdownCell(provider.filePath)}\` \`${provider.version}\`）`)
    .join('、');
  // 类型: string；作用: 按设置导航顺序展示当前真实模块，不写固定“三个/四个”文本副本。
  const settingsSummary = facts.settingsModules.map(title => escapeMarkdownCell(title)).join('、');
  // 类型: string；作用: 展示三个可访问的 Vite 本机 origin。
  const developmentSummary = facts.development.urls.map(url => `\`${url}\``).join('、');

  // 类型: Array<string>；作用: 每行对应一类权威事实，保持稳定顺序便于代码审查。
  const lines = [
    README_RELEASE_FACTS_MARKER.start,
    '## 当前发布事实',
    '',
    '以下内容由工程闸门根据当前源码核对；修改 Provider、数据库、协议或运行配置后必须同步更新，不能作为第二份配置来源。',
    '',
    '| 项目事实 | 当前值 |',
    '|---|---|',
    `| 项目版本 | \`${facts.projectVersion}\` |`,
    `| 内置 Provider | ${providerSummary} |`,
    `| Provider ABI / manifest schema | \`${facts.providerApiVersion}\` / \`${facts.manifestSchemaVersion}\` |`,
    `| 内置目录发布 | revision \`${facts.builtinCatalog.revision}\`，version \`${facts.builtinCatalog.version}\` |`,
    `| IndexedDB schema | v${facts.browserDatabaseVersion} |`,
    `| 设置模块 | ${facts.settingsModules.length} 个：${settingsSummary} |`,
    `| Proxy Protocol / 路由 | \`${facts.proxy.protocolVersion}\` / \`${facts.proxy.requestRoute}\` |`,
    `| 本地代理默认地址 | \`${facts.proxy.clientDefaultBaseUrl}\` |`,
    `| 前端开发地址 | ${developmentSummary} |`,
    README_RELEASE_FACTS_MARKER.end
  ];

  // 返回值类型: string；作用: 用 LF 连接完整区块，README 自身可继续使用平台换行。
  return lines.join('\n');
}

/**
 * 检查发布事实区块外的重复版本声明。
 * 纯函数: 只读取传入文本与事实，不修改 README。
 * 成功路径: 返回空数组或只包含真实漂移问题。
 * 失败路径: 任一 Provider 文件、IndexedDB、Provider ABI 或 Proxy Protocol 重复声明为旧值时追加问题。
 *
 * @param {string} readmeWithoutBlock 已移除机器事实区块的 README 文本。
 * @param {Readonly<object>} facts 当前发布事实。
 * @returns {Array<string>} 重复声明漂移问题。
 */
function collectDuplicateDeclarationIssues(readmeWithoutBlock, facts) {
  // 类型: Array<string>；作用: 收集全部重复声明问题，避免只修第一处旧值后构建再次失败。
  const issues = [];

  // 循环类型: for...of。
  // 初始值: 当前内置目录第一条 Provider。
  // 终止条件: 所有当前 Provider 文件名检查完成。
  // 循环作用: 发现事实区块外仍以“脚本名 + 版本”维护的第二份当前版本。
  for (const provider of facts.providers) {
    // 类型: string；作用: 只取文件名，README 无需使用完整仓库路径也能被检查。
    const scriptFileName = provider.filePath.split('/').pop();
    // 类型: RegExp；作用: 捕获脚本名后紧邻的三段版本，不匹配普通架构说明。
    const versionPattern = new RegExp(
      `${escapeRegularExpression(scriptFileName)}\\s+${SEMANTIC_VERSION_PATTERN_SOURCE}`,
      'giu'
    );

    // 循环类型: String.prototype.matchAll。
    // 初始值: 第一处脚本版本声明。
    // 终止条件: README 区块外全部声明检查完成。
    // 循环作用: 任一旧值都形成精确问题，不接受“一处新、一处旧”。
    for (const match of readmeWithoutBlock.matchAll(versionPattern)) {
      // 条件分支: 捕获版本不是当前 manifest.version 时进入；执行内容: 记录脚本和实际/期望值。
      if (match[1] !== provider.version) {
        issues.push(`README Provider 版本声明过期: ${scriptFileName} ${match[1]} != ${provider.version}`);
      }
    }
  }

  // 类型: RegExp；作用: 捕获事实区块外“IndexedDB schema vN”当前版本声明。
  const databasePattern = /IndexedDB\s+schema\s+v(\d+)/giu;
  // 循环类型: String.prototype.matchAll；作用: 拒绝保留旧数据库当前版本说明。
  for (const match of readmeWithoutBlock.matchAll(databasePattern)) {
    // 条件分支: 声明整数不等于当前 schema 时进入；执行内容: 记录明确版本差异。
    if (Number(match[1]) !== facts.browserDatabaseVersion) {
      issues.push(`README IndexedDB schema 声明过期: v${match[1]} != v${facts.browserDatabaseVersion}`);
    }
  }

  // 类型: RegExp；作用: 捕获事实区块外 Provider ABI 三段版本声明。
  const providerApiPattern = new RegExp(`Provider\\s+ABI\\s+${SEMANTIC_VERSION_PATTERN_SOURCE}`, 'giu');
  // 循环类型: String.prototype.matchAll；作用: 检查全部公共 ABI 说明没有陈旧值。
  for (const match of readmeWithoutBlock.matchAll(providerApiPattern)) {
    // 条件分支: ABI 与当前 Provider 公共值不一致时进入；执行内容: 追加工程问题。
    if (match[1] !== facts.providerApiVersion) {
      issues.push(`README Provider ABI 声明过期: ${match[1]} != ${facts.providerApiVersion}`);
    }
  }

  // 类型: RegExp；作用: 捕获事实区块外 Proxy Protocol 三段版本声明。
  const proxyProtocolPattern = new RegExp(`Proxy\\s+Protocol\\s+${SEMANTIC_VERSION_PATTERN_SOURCE}`, 'giu');
  // 循环类型: String.prototype.matchAll；作用: 检查全部代理协议说明没有陈旧值。
  for (const match of readmeWithoutBlock.matchAll(proxyProtocolPattern)) {
    // 条件分支: 协议值与后端权威不一致时进入；执行内容: 追加工程问题。
    if (match[1] !== facts.proxy.protocolVersion) {
      issues.push(`README Proxy Protocol 声明过期: ${match[1]} != ${facts.proxy.protocolVersion}`);
    }
  }

  // 返回值类型: Array<string>；作用: 交给 collectReleaseFactIssues 与工程闸门统一输出。
  return issues;
}

/**
 * 收集 README 发布事实问题。
 * 副作用: 默认读取 README 和全部权威源码；传入 readmeSource 时只替换 README 输入，便于内存反例测试。
 * 成功路径: 当前事实区块精确且没有陈旧重复声明时返回空数组。
 * 失败路径: 读取失败、标记缺失/重复、区块内容漂移或重复旧版本时返回稳定问题，不直接退出进程。
 *
 * @param {object} options 检查选项。
 * @param {string} options.repositoryRoot Git 仓库绝对根目录。
 * @param {string} [options.readmeSource] 可选 README 内存夹具；省略时读取真实 README.md。
 * @returns {Promise<Array<string>>} 发布事实问题数组。
 */
export async function collectReleaseFactIssues({ repositoryRoot, readmeSource }) {
  // 类型: Array<string>；作用: 收集当前检查全部问题并供工程闸门合并去重。
  const issues = [];

  try {
    // 异步调用: 从项目权威源码收集当前事实。
    // resolve: 返回冻结事实对象。
    // reject: 进入 catch 并转换为不含堆栈的发布事实读取问题。
    // 类型: Readonly<object>；作用: 提供 README 区块和重复声明检查使用的当前权威值。
    const facts = await collectReleaseFacts({ repositoryRoot });
    // 类型: string；作用: 测试使用显式夹具，生产检查读取根 README。
    const readme = normalizeText(
      readmeSource === undefined
        ? readFileSync(resolve(repositoryRoot, RELEASE_FACT_SOURCE_PATH.readme), 'utf8')
        : readmeSource
    );
    // 类型: string；作用: 当前源码要求 README 精确包含的唯一事实区块。
    const expectedBlock = createReleaseFactsMarkdown(facts);
    // 类型: number；作用: 定位开始标记，-1 表示 README 尚未声明机器事实区块。
    const startIndex = readme.indexOf(README_RELEASE_FACTS_MARKER.start);
    // 类型: number；作用: 从开始标记之后定位对应结束标记。
    const endIndex = startIndex < 0
      ? -1
      : readme.indexOf(README_RELEASE_FACTS_MARKER.end, startIndex + README_RELEASE_FACTS_MARKER.start.length);
    // 类型: boolean；作用: 发现第二个开始或结束标记，阻止 README 维护两份“当前事实”。
    const hasDuplicateMarkers = startIndex >= 0 && endIndex >= 0 && (
      readme.indexOf(README_RELEASE_FACTS_MARKER.start, startIndex + README_RELEASE_FACTS_MARKER.start.length) >= 0
      || readme.indexOf(README_RELEASE_FACTS_MARKER.end, endIndex + README_RELEASE_FACTS_MARKER.end.length) >= 0
    );

    // 条件分支: 起止标记缺失、顺序无效或存在重复标记时进入。
    // 执行内容: 记录区块结构问题，不尝试用正文版本声明拼出事实。
    if (startIndex < 0 || endIndex < startIndex || hasDuplicateMarkers) {
      issues.push('README 当前发布事实区块缺失、顺序无效或重复');
    } else {
      // 类型: number；作用: 包含结束标记全文，精确切出当前 README 区块。
      const blockEndIndex = endIndex + README_RELEASE_FACTS_MARKER.end.length;
      // 类型: string；作用: 与源码生成区块做换行统一后的精确比较。
      const actualBlock = readme.slice(startIndex, blockEndIndex);

      // 条件分支: README 区块与当前源码生成结果不一致时进入。
      // 执行内容: 记录单项高信号问题，维护者运行测试可查看期望区块。
      if (actualBlock !== expectedBlock) {
        issues.push('README 当前发布事实区块与权威源码不一致');
      }

      // 类型: string；作用: 移除机器区块后检查其他说明是否残留旧版本副本。
      const readmeWithoutBlock = `${readme.slice(0, startIndex)}${readme.slice(blockEndIndex)}`;
      // 执行内容: 合并全部重复声明问题，避免区块正确但正文仍误导用户。
      issues.push(...collectDuplicateDeclarationIssues(readmeWithoutBlock, facts));
    }
  } catch (error) {
    // 异常来源: 文件读取、JSON/AST/模块加载、权威配置形状或版本一致性检查失败。
    // 处理策略: 只输出稳定 message，不向构建日志泄漏堆栈、Provider 脚本文本或进程环境。
    issues.push(`发布事实读取失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  // 返回值类型: Array<string>；作用: 返回去重问题，工程闸门决定进程退出码。
  return [...new Set(issues)];
}
