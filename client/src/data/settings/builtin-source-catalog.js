/*
  builtin-source-catalog.js 模块说明

  - 文件职责:
      从两个 datasource 单文件取得静态 manifest 和完整 raw 文本，建立产品内置系统源的唯一只读发布目录。
      目录只供 Repository 种子消费；运行工厂必须由保存脚本经过统一 Loader、Registry 和 Host 创建。
      模块加载时只复核发布身份与脚本文本，禁止重新引入系统源静态工厂旁路。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      两个 sourceManifest: 自定义数据源模块，提供内置发布身份。
      两个 ?raw scriptContent: 自定义数据源原文件文本，提供 SourcePackage 导出和完整性事实。

  - 模块级常量:
      BUILTIN_SOURCE_CATALOG_REVISION: number，内置目录独立发布序号。
      BUILTIN_SOURCE_CATALOG_VERSION: string，内置目录面向发布记录的版本。
      BUILTIN_SOURCE_CATALOG_FINGERPRINT: string，当前发布冻结的 Package 与 Definition 指纹。
      BUILTIN_SOURCE_CATALOG_RELEASED_AT: string，当前双源内置目录发布时间。
      BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE: object，紧邻上一条已曝光发布身份，供原子发布和升级回归使用。
      BUILTIN_SOURCE_ENTRY_FIELDS: Array<string>，目录条目的精确字段集合。
      builtinSourceCatalog: Array<object>，两条内置系统源的只读目录。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createBuiltinSourceEntry(manifest, scriptContent): 校验并冻结单条内置源发布事实。

  - 模块级类:
      无

  - 对外导出:
      BUILTIN_SOURCE_CATALOG_REVISION: number，启动对账判断新旧发布的单调事实。
      BUILTIN_SOURCE_CATALOG_VERSION: string，启动对账和诊断使用的发布版本。
      BUILTIN_SOURCE_CATALOG_FINGERPRINT: string，启动前核对公开目录内容的冻结发布指纹。
      BUILTIN_SOURCE_CATALOG_RELEASED_AT: string，Definition 导入与更新时间来源。
      BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE: object，发布工具和紧邻版本测试使用的上一发布身份。
      builtinSourceCatalog: Array<object>，种子生成器的唯一产品输入。
*/

// 导入来源: ../../../../datasource/system-source-1.js?raw。
// 导入内容: systemSource1ScriptContent 完整原文件文本。
// 文件作用: 写入 系统数据源1 SourcePackage 并计算与导出共用的脚本指纹。
import systemSource1ScriptContent from '../../../../datasource/system-source-1.js?raw';
import {
  // 导入来源: ../../../../datasource/system-source-1.js。
  // 导入内容: sourceManifest。
  // 文件作用: 生成 系统数据源1 Definition 并与 raw 文本保持同文件发布关系。
  sourceManifest as systemSource1Manifest
} from '../../../../datasource/system-source-1.js';

// 导入来源: ../../../../datasource/system-source-4.js?raw。
// 导入内容: systemSource4ScriptContent 完整原文件文本。
// 文件作用: 写入 系统数据源4 SourcePackage 并计算与导出共用的脚本指纹。
import systemSource4ScriptContent from '../../../../datasource/system-source-4.js?raw';
import {
  // 导入来源: ../../../../datasource/system-source-4.js。
  // 导入内容: sourceManifest。
  // 文件作用: 生成 系统数据源4 Definition 并与 raw 文本保持同文件发布关系。
  sourceManifest as systemSource4Manifest
} from '../../../../datasource/system-source-4.js';

// 类型: number；作用: 内置目录发布的单调整数序号；Provider 内容更新只增加该值，不再提高 IndexedDB schema version。
export const BUILTIN_SOURCE_CATALOG_REVISION = 7;

// 类型: string；作用: 当前内置目录面向发布记录和诊断的语义版本，不承担数据库结构迁移职责。
export const BUILTIN_SOURCE_CATALOG_VERSION = '2.21.0';

// 类型: string。
// 作用: 冻结 revision=7 对应的 Package 完整性与 Definition 发布事实；真实目录再次变化时必须重新计算指纹。
export const BUILTIN_SOURCE_CATALOG_FINGERPRINT = '8170581ed6e08315dfb0b7a6c95b5a95111e82b414a1161ef53f1aaa57e78427';

// 类型: string。
// 作用: 记录当前两条内置脚本作为产品系统源发布的统一 ISO 时间，不从浏览器启动时间制造漂移。
export const BUILTIN_SOURCE_CATALOG_RELEASED_AT = '2026-08-02T16:54:56.098Z';

// 类型: Readonly<object>。
// 作用: 记录公开目录 revision 2 的紧邻上一发布身份，供发布工具验证连续升级链。
// 字段: schemaVersion，string，目录发布身份结构版本。
// 字段: revision，number，上一条已曝光发布的单调序号。
// 字段: version，string，上一条发布的可读版本。
// 字段: fingerprint，string，上一条发布真实 Package 与 Definition 指纹。
export const BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE = Object.freeze({
  schemaVersion: '1.0.0',
  revision: 6,
  version: '2.20.0',
  fingerprint: '5377534ede124d56f7407c1c1d2b60e517cc72818669185cf6c7965bdebe44fc'
});

// 类型: Array<string>。
// 作用: 固定目录条目只保存 manifest 和原始脚本文本两个发布事实，运行工厂不进入产品目录。
const BUILTIN_SOURCE_ENTRY_FIELDS = Object.freeze([
  'manifest',
  'scriptContent'
]);

/**
 * 创建一条内置系统源目录记录。
 * 纯函数: 不修改 manifest、脚本文本、Loader 或外部注册表。
 * 成功路径: manifest 与完整脚本文本有效时返回冻结发布记录。
 * 失败路径: 身份、脚本文本或冻结状态偏离时立即抛错，应用不采用半完成目录。
 *
 * @param {*} manifest 数据源单文件导出的冻结 sourceManifest。
 * @param {*} scriptContent 同一数据源文件由 raw 加载器读取的完整文本。
 * @returns {Readonly<object>} manifest 和 scriptContent 两字段目录记录。
 * @throws {TypeError} 当单文件不能形成完整发布目录时抛出。
 */
function createBuiltinSourceEntry(manifest, scriptContent) {
  // 条件分支: manifest 不是冻结普通对象或缺少稳定身份时进入。
  // 执行内容: 拒绝在产品目录中补造数据源名称、id 或工厂键。
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)
    || !Object.isFrozen(manifest)
    || typeof manifest.id !== 'string' || !manifest.id
    || typeof manifest.providerKey !== 'string' || !manifest.providerKey) {
    throw new TypeError('内置数据源 manifest 必须冻结并提供 id 与 providerKey');
  }

  // 条件分支: raw 文本为空时进入。
  // 执行内容: 阻止只显示 Definition、却没有可交给统一 Loader 的单文件脚本。
  if (typeof scriptContent !== 'string' || !scriptContent.trim()) {
    throw new TypeError(`内置数据源脚本无效: ${manifest.id}`);
  }

  // 类型: object。
  // 作用: 保留精确两字段，后续种子不能取得运行工厂或未声明页面状态。
  const entry = {
    manifest,
    scriptContent
  };

  // 条件分支: 维护时意外增加或遗漏目录字段时进入。
  // 执行内容: 在模块加载时失败，避免未进入契约的新事实被静默采用。
  if (Object.keys(entry).some(field => !BUILTIN_SOURCE_ENTRY_FIELDS.includes(field))
    || Object.keys(entry).length !== BUILTIN_SOURCE_ENTRY_FIELDS.length) {
    throw new TypeError('内置数据源目录字段集合无效');
  }

  return Object.freeze(entry);
}

// 类型: ReadonlyArray<Readonly<object>>。
// 作用: 保存当前产品两条内置系统源及顺序；第一条是空库和失效旧默认源的明确交接目标。
export const builtinSourceCatalog = Object.freeze([
  createBuiltinSourceEntry(systemSource1Manifest, systemSource1ScriptContent),
  createBuiltinSourceEntry(systemSource4Manifest, systemSource4ScriptContent)
]);
