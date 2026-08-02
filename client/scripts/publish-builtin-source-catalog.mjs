/*
  publish-builtin-source-catalog.mjs 模块说明

  - 文件职责:
      在 Provider 源码和测试稳定后，以一次文件替换发布下一条内置目录身份。
      把当前冻结发布身份作为前驱，在内存中计算候选 revision、版本、发布时间和真实保存图指纹，避免开发服务器观察到同一 revision 的分步改写。

  - 导入库及文件汇总(6 条，内置 2 条，第三方 0 条，自定义 4 条):
      readFile/writeFile/rename/unlink: 内置模块，读取输入并以同目录临时文件替换正式目录。
      fileURLToPath: 内置模块，把模块 URL 转换为 Windows 安全路径。
      当前目录发布常量: 自定义配置，提供本次发布的不可复用基线和上一已曝光身份。
      两个 sourceManifest: 自定义数据，提供候选 Provider Definition 身份。
      createBuiltinSourceRepositorySeeds/createBuiltinSourceCatalogFingerprint: 自定义数据，生成候选保存图和唯一指纹。

  - 模块级常量:
      CATALOG_FILE_URL: URL，正式内置目录源码地址。
      PROVIDER_FILE_INPUTS: Array<object>，两个 Provider manifest 与原文件地址。
      RELEASE_SCHEMA_VERSION: string，上一发布与当前发布共用的身份结构版本。

  - 模块级变量:
      无

  - 模块级辅助函数:
      incrementCatalogVersion(version): 递增目录可读版本的 minor 段。
      replaceExactlyOnce(source, pattern, replacement, label): 保证每个发布字段只替换一次。
      createCandidateCatalog(): 从当前两个 Provider 原文件建立冻结候选目录。
      resolvePreviousRelease(): 区分正常发布与同 revision 恢复场景的真实上一发布。
      updateCatalogSource(source, release): 生成只包含目标发布事实的完整目录文本。
      publishBuiltinSourceCatalog(): 校验当前发布并以一次文件替换提交下一发布。

  - 模块级类:
      无

  - 对外导出:
      无；仅由 npm run release:builtin-sources 作为维护命令执行。
*/

// 导入边界: 发布命令不导入 builtinSourceCatalog；该对象会实时读取待发布 Provider，不能代表修改前的冻结发布保存图。
import {
  // 导入来源: node:fs/promises。
  // 导入内容: readFile 内置异步文件读取函数。
  // 文件作用: 读取 Provider 原文件和正式目录源码。
  readFile,
  // 导入来源: node:fs/promises。
  // 导入内容: rename 内置文件替换函数。
  // 文件作用: 候选文本完整写入后，以一次同目录重命名提交正式目录。
  rename,
  // 导入来源: node:fs/promises。
  // 导入内容: unlink 内置文件删除函数。
  // 文件作用: 发布失败时清理尚未采用的临时文件。
  unlink,
  // 导入来源: node:fs/promises。
  // 导入内容: writeFile 内置异步文件写入函数。
  // 文件作用: 把完整候选目录写入同目录临时文件。
  writeFile
} from 'node:fs/promises';

import {
  // 导入来源: node:url。
  // 导入内容: fileURLToPath 内置 URL 转路径函数。
  // 文件作用: 解析正式目录与 Provider 的本机绝对路径。
  fileURLToPath
} from 'node:url';

import {
  // 导入来源: ../src/data/settings/builtin-source-catalog.js。
  // 导入内容: BUILTIN_SOURCE_CATALOG_FINGERPRINT 当前冻结指纹。
  // 文件作用: 把当前冻结指纹登记为下一 revision 的紧邻发布前驱，不用修改后的 Provider 反算旧发布。
  BUILTIN_SOURCE_CATALOG_FINGERPRINT,
  // 导入来源: ../src/data/settings/builtin-source-catalog.js。
  // 导入内容: BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE 上一已曝光发布。
  // 文件作用: 同 revision 恢复时保留真实浏览器前驱，不把中间重算值写成历史。
  BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE,
  // 导入来源: ../src/data/settings/builtin-source-catalog.js。
  // 导入内容: BUILTIN_SOURCE_CATALOG_RELEASED_AT 当前发布时间。
  // 文件作用: 正常发布时登记当前发布为下一次升级的紧邻前驱。
  BUILTIN_SOURCE_CATALOG_RELEASED_AT,
  // 导入来源: ../src/data/settings/builtin-source-catalog.js。
  // 导入内容: BUILTIN_SOURCE_CATALOG_REVISION 当前目录序号。
  // 文件作用: 每次命令只生成严格更大的下一序号。
  BUILTIN_SOURCE_CATALOG_REVISION,
  // 导入来源: ../src/data/settings/builtin-source-catalog.js。
  // 导入内容: BUILTIN_SOURCE_CATALOG_VERSION 当前可读版本。
  // 文件作用: 生成下一条目录可读版本。
  BUILTIN_SOURCE_CATALOG_VERSION
} from '../src/data/settings/builtin-source-catalog.js';

import {
  // 导入来源: ../src/data/settings/source-repository.seed.js。
  // 导入内容: createBuiltinSourceCatalogFingerprint 正式目录指纹函数。
  // 文件作用: 当前发布与候选发布使用同一生产哈希算法。
  createBuiltinSourceCatalogFingerprint,
  // 导入来源: ../src/data/settings/source-repository.seed.js。
  // 导入内容: createBuiltinSourceRepositorySeeds 正式保存图生成器。
  // 文件作用: 在内存中用候选发布时间生成 Package、Definition 和授权事实。
  createBuiltinSourceRepositorySeeds
} from '../src/data/settings/source-repository.seed.js';

import {
  // 导入来源: ../../datasource/system-source-1.js。
  // 导入内容: sourceManifest。
  // 文件作用: 为系统 Provider 1 候选原文件提供冻结 Definition 身份。
  sourceManifest as systemSource1Manifest
} from '../../datasource/system-source-1.js';

import {
  // 导入来源: ../../datasource/system-source-4.js。
  // 导入内容: sourceManifest。
  // 文件作用: 为系统 Provider 4 候选原文件提供冻结 Definition 身份。
  sourceManifest as systemSource4Manifest
} from '../../datasource/system-source-4.js';

// 类型: URL；作用: 唯一允许被当前命令替换的正式内置目录文件。
const CATALOG_FILE_URL = new URL('../src/data/settings/builtin-source-catalog.js', import.meta.url);
// 类型: ReadonlyArray<Readonly<object>>；作用: 固定两个 Provider manifest 与物理原文件的有序候选输入。
// 条目字段: manifest，Readonly<object>，Provider 导出的冻结发布身份。
// 条目字段: fileUrl，URL，对应单文件源码地址。
const PROVIDER_FILE_INPUTS = Object.freeze([
  Object.freeze({ manifest: systemSource1Manifest, fileUrl: new URL('../../datasource/system-source-1.js', import.meta.url) }),
  Object.freeze({ manifest: systemSource4Manifest, fileUrl: new URL('../../datasource/system-source-4.js', import.meta.url) })
]);
// 类型: string；作用: 当前目录发布对象结构版本；候选和上一发布必须保持一致。
const RELEASE_SCHEMA_VERSION = '1.0.0';

/**
 * 递增内置目录可读版本。
 * 纯函数: 只接受三段十进制语义版本，并递增 minor、归零 patch。
 * 成功路径: `2.28.0` 返回 `2.29.0`。
 * 失败路径: 非三段非负整数版本抛 TypeError，不猜测其他版本策略。
 *
 * @param {*} version 当前目录版本。
 * @returns {string} 下一目录版本。
 * @throws {TypeError} 当前版本不符合三段整数结构时抛出。
 */
function incrementCatalogVersion(version) {
  // 类型: RegExpMatchArray|null；作用: 只接收完整三段整数，不允许预发布或构建后缀静默丢失。
  const match = typeof version === 'string' ? /^(\d+)\.(\d+)\.(\d+)$/u.exec(version) : null;
  // 条件分支: 当前版本不能形成明确下一 minor 时进入；执行内容: 停止发布而不是生成错误版本。
  if (!match) throw new TypeError('内置目录版本必须是三段整数语义版本');
  return `${match[1]}.${Number.parseInt(match[2], 10) + 1}.0`;
}

/**
 * 在完整目录文本中精确替换一项发布事实。
 * 纯函数: 不写文件；只有正则恰好命中一次时返回新文本。
 * 成功路径: 返回替换后的完整独立字符串。
 * 失败路径: 零次或多次命中抛 Error，禁止对结构漂移文件做部分更新。
 *
 * @param {string} source 正式目录完整源码。
 * @param {RegExp} pattern 只允许命中一次的发布字段模式。
 * @param {string} replacement 新发布字段完整文本。
 * @param {string} label 失败诊断使用的字段名称。
 * @returns {string} 完成单项替换的新目录源码。
 * @throws {Error} 模式命中数量不是一时抛出。
 */
function replaceExactlyOnce(source, pattern, replacement, label) {
  // 类型: Array<RegExpMatchArray>；作用: 在写文件前证明当前结构只有一个目标字段。
  const matches = [...source.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
  // 条件分支: 字段缺失或重复时进入；执行内容: 拒绝继续，避免发布文本只更新一部分。
  if (matches.length !== 1) throw new Error(`内置目录发布字段数量无效: ${label}`);
  return source.replace(pattern, replacement);
}

/**
 * 从两个 Provider 物理原文件创建候选内置目录。
 * 文件读取副作用: 并发读取两个 UTF-8 单文件，不执行 Provider 或访问网络。
 * 成功路径: 返回顺序、条目和 manifest 全部冻结的候选目录。
 * 失败路径: 文件读取失败或空文本由 fs 或正式种子校验继续抛出。
 *
 * @returns {Promise<ReadonlyArray<Readonly<object>>>} 候选目录。
 */
async function createCandidateCatalog() {
  // 类型: Array<string>；作用: 保存与 manifest 顺序一致的 Provider 原文件文本。
  const scriptContents = await Promise.all(PROVIDER_FILE_INPUTS.map((input) => {
    return readFile(fileURLToPath(input.fileUrl), 'utf8');
  }));
  return Object.freeze(PROVIDER_FILE_INPUTS.map((input, index) => Object.freeze({
    manifest: input.manifest,
    scriptContent: scriptContents[index]
  })));
}

/**
 * 决定下一发布记录的紧邻前驱。
 * 纯函数: 正常情况下采用当前发布；当前 revision 已被不同指纹曝光时保留已登记前驱。
 * 成功路径: 返回冻结四字段发布身份，且 revision 不高于当前目录。
 * 失败路径: 上一发布高于当前目录或结构无效时抛 Error。
 *
 * @returns {Readonly<object>} 下一发布应记录的上一条真实身份。
 * @throws {Error} 发布序号或结构不能形成单调链时抛出。
 */
function resolvePreviousRelease() {
  // 条件分支: 上一已曝光记录高于当前源码声明时进入；执行内容: 拒绝从倒退状态继续发布。
  if (!BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE
    || BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE.schemaVersion !== RELEASE_SCHEMA_VERSION
    || !Number.isSafeInteger(BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE.revision)
    || BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE.revision > BUILTIN_SOURCE_CATALOG_REVISION) {
    throw new Error('内置目录上一发布身份无效');
  }
  // 条件分支: 当前 revision 曾在浏览器采用不同指纹时进入；执行内容: 保留已曝光身份作为真实前驱。
  if (BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE.revision === BUILTIN_SOURCE_CATALOG_REVISION
    && BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE.fingerprint !== BUILTIN_SOURCE_CATALOG_FINGERPRINT) {
    return BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE;
  }
  return Object.freeze({
    schemaVersion: RELEASE_SCHEMA_VERSION,
    revision: BUILTIN_SOURCE_CATALOG_REVISION,
    version: BUILTIN_SOURCE_CATALOG_VERSION,
    fingerprint: BUILTIN_SOURCE_CATALOG_FINGERPRINT
  });
}

/**
 * 把候选发布身份写入完整目录源码字符串。
 * 纯函数: 逐项精确替换上一发布和当前发布字段，不读取或写入文件。
 * 成功路径: 返回所有发布字段一致的新源码。
 * 失败路径: 任一字段缺失或重复时由 replaceExactlyOnce 抛错，调用方不会提交文件。
 *
 * @param {string} source 当前正式目录源码。
 * @param {object} release 新旧发布身份集合。
 * @param {object} release.previous 上一条真实发布身份。
 * @param {number} release.revision 新发布序号。
 * @param {string} release.version 新可读版本。
 * @param {string} release.fingerprint 新保存图指纹。
 * @param {string} release.releasedAt 新统一发布时间。
 * @returns {string} 完整候选目录源码。
 */
function updateCatalogSource(source, release) {
  // 类型: string；作用: 按固定顺序累积精确替换结果，任一步失败都不会写正式文件。
  let updatedSource = source;
  updatedSource = replaceExactlyOnce(
    updatedSource,
    /export const BUILTIN_SOURCE_CATALOG_REVISION = \d+;/u,
    `export const BUILTIN_SOURCE_CATALOG_REVISION = ${release.revision};`,
    'revision'
  );
  updatedSource = replaceExactlyOnce(
    updatedSource,
    /export const BUILTIN_SOURCE_CATALOG_VERSION = '[^']+';/u,
    `export const BUILTIN_SOURCE_CATALOG_VERSION = '${release.version}';`,
    'version'
  );
  updatedSource = replaceExactlyOnce(
    updatedSource,
    /export const BUILTIN_SOURCE_CATALOG_FINGERPRINT = '[a-f\d]{64}';/u,
    `export const BUILTIN_SOURCE_CATALOG_FINGERPRINT = '${release.fingerprint}';`,
    'fingerprint'
  );
  updatedSource = replaceExactlyOnce(
    updatedSource,
    /export const BUILTIN_SOURCE_CATALOG_RELEASED_AT = '[^']+';/u,
    `export const BUILTIN_SOURCE_CATALOG_RELEASED_AT = '${release.releasedAt}';`,
    'releasedAt'
  );
  updatedSource = replaceExactlyOnce(
    updatedSource,
    /export const BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE = Object\.freeze\(\{[\s\S]*?\n\}\);/u,
    [
      'export const BUILTIN_SOURCE_CATALOG_PREVIOUS_RELEASE = Object.freeze({',
      `  schemaVersion: '${release.previous.schemaVersion}',`,
      `  revision: ${release.previous.revision},`,
      `  version: '${release.previous.version}',`,
      `  fingerprint: '${release.previous.fingerprint}'`,
      '});'
    ].join('\n'),
    'previousRelease'
  );
  // 替换作用: 注释中的 revision 数字与新发布同步，避免维护说明继续指向旧序号。
  updatedSource = replaceExactlyOnce(
    updatedSource,
    /\/\/ 作用: 冻结 revision=\d+ 对应的 Package 完整性与 Definition 发布事实；真实目录再次变化时必须重新计算指纹。/u,
    `// 作用: 冻结 revision=${release.revision} 对应的 Package 完整性与 Definition 发布事实；真实目录再次变化时必须重新计算指纹。`,
    'revisionComment'
  );
  return updatedSource;
}

/**
 * 发布下一条内置目录身份。
 * 文件副作用: 读取正式目录与 Provider；在同目录写一个临时文件，完整成功后以一次 rename 替换正式目录。
 * 成功路径: 当前冻结身份通过单调链复核后，提交严格递增 revision、minor 版本、统一时间和候选指纹。
 * 失败路径: 发布身份链、输入、候选计算或文件替换失败时保留原正式目录，并尽力删除临时文件。
 *
 * @returns {Promise<void>} 正式目录替换完成后结束。
 */
async function publishBuiltinSourceCatalog() {
  // 类型: ReadonlyArray<object>；作用: 保存当前 Provider 原文件形成的候选目录，不修改正式 builtinSourceCatalog。
  const candidateCatalog = await createCandidateCatalog();
  // 类型: string；作用: 当前命令唯一生成的 UTC 发布时间，同时驱动 Definition、授权和目录常量。
  const releasedAt = new Date().toISOString();
  // 类型: object；作用: 使用候选时间生成真实四类保存图，避免先改正式文件再反向求指纹。
  const candidateSeeds = createBuiltinSourceRepositorySeeds(candidateCatalog, { releasedAt });
  // 类型: string；作用: 由正式算法生成候选 Package 与 Definition 指纹。
  const fingerprint = createBuiltinSourceCatalogFingerprint(candidateSeeds);
  // 类型: object；作用: 下一发布必须严格大于当前 revision，并保留真实紧邻前驱。
  const release = Object.freeze({
    previous: resolvePreviousRelease(),
    revision: BUILTIN_SOURCE_CATALOG_REVISION + 1,
    version: incrementCatalogVersion(BUILTIN_SOURCE_CATALOG_VERSION),
    fingerprint,
    releasedAt
  });
  // 类型: string；作用: 正式目录的 Windows 绝对路径，是唯一允许替换的目标。
  const catalogPath = fileURLToPath(CATALOG_FILE_URL);
  // 类型: string；作用: 同目录临时文件，开发服务器不会把它作为正式模块导入。
  const temporaryPath = `${catalogPath}.next-${process.pid}`;
  // 类型: string；作用: 读取一次当前目录完整文本，全部候选替换在内存中完成。
  const currentSource = await readFile(catalogPath, 'utf8');
  // 类型: string；作用: 保存所有发布字段已经一致的新目录文本。
  const updatedSource = updateCatalogSource(currentSource, release);

  try {
    // 写入副作用: 只创建未被产品导入的临时文件；失败时正式目录保持原样。
    await writeFile(temporaryPath, updatedSource, 'utf8');
    // 提交副作用: 以一次同目录替换让开发服务器只观察完整的新发布身份。
    await rename(temporaryPath, catalogPath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch {
      // 清理说明: 临时文件可能尚未创建或已被 rename 消耗，原始发布失败继续向上抛出。
    }
    throw error;
  }

  // 输出内容: 给维护者报告唯一新发布事实，不打印 Provider 脚本文本或用户数据。
  console.log(JSON.stringify({
    revision: release.revision,
    version: release.version,
    fingerprint: release.fingerprint,
    releasedAt: release.releasedAt,
    previousRevision: release.previous.revision
  }, null, 2));
}

await publishBuiltinSourceCatalog();
