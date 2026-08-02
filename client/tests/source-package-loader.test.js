/*
  source-package-loader.test.js 模块说明

  - 文件职责:
      验证单文件 Provider 三入口读取、静态预检、用户信任、模块结果和 ProviderFactory 严格边界。
      使用真实读取器、Acorn 解析器与加载器，执行阶段注入冻结假端口，避免 Node 不支持 blob: module 干扰领域断言。

  - 导入库及文件汇总(9 条，内置 3 条，第三方 1 条，自定义 5 条):
      assert: 内置断言，验证值、错误、引用和调用次数。
      readFileSync: 内置文件读取，载入语言无关 manifest 契约向量。
      test: 内置测试注册，组织确定性用例。
      utf8ToBytes: 第三方 UTF-8 工具，构造精确 1 MiB 边界脚本。
      createSourcePackageInputReader: 自定义读取器，验证 file/remote/text 共同载荷。
      createSourcePackageManifestParser: 自定义预检器，验证 AST 和 manifest 边界。
      createSourcePackageLoader: 自定义加载器，验证信任后执行与工厂 ABI。
      SOURCE_PACKAGE_ERROR_CODE、SOURCE_PACKAGE_POLICY: 自定义配置，复用错误和容量边界。
      createSourceScriptHash: 自定义授权工具，为已保存 Package 生成真实 SHA-256。

  - 模块级常量:
      IMPORTED_AT: string，测试预检和加载共同 UTC 时间。
      BASE_MANIFEST: object，合法单文件 manifest 基准。
      BASE_SCRIPT: string，与基准 manifest 对应的合法单文件模块文本。

  - 模块级变量:
      无

  - 模块级辅助函数:
      clone(value): 创建严格 JSON 副本。
      deepFreezeJson(value): 冻结运行时 manifest 测试对象树。
      createManifest(patch): 创建浅层字段变体。
      createModuleScript(manifest, extraSource): 创建可供 Acorn 预检的单文件模块文本。
      createInput(importMethod, scriptContent, options): 创建精确四字段入口输入。
      createLoaderHarness(options): 创建真实读取/预检与可控执行组合。

  - 模块级类:
      无

  - 对外导出:
      无
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言集合。
// 文件作用: 验证 SHA-256、预览、错误分类、工厂门面和副作用次数。
import assert from 'node:assert/strict';

// 导入来源: node:fs。
// 导入内容: readFileSync 同步文本读取函数。
// 文件作用: 加载 contracts/v1 下正式 manifest 合法与非法向量。
import { readFileSync } from 'node:fs';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册离线确定性单文件加载用例。
import test from 'node:test';

// 导入来源: @noble/hashes/utils。
// 导入内容: utf8ToBytes UTF-8 编码函数。
// 文件作用: 依据生产同一字节语义构造精确容量边界。
import { utf8ToBytes } from '@noble/hashes/utils';

// 导入来源: ../src/runtime/source-package/sourcePackageInputReader.js。
// 导入内容: createSourcePackageInputReader 三入口读取器工厂。
// 文件作用: 使用可控 NetworkAdapter 验证来源输入、远程响应和共同载荷。
import { createSourcePackageInputReader } from '../src/runtime/source-package/sourcePackageInputReader.js';

// 导入来源: ../src/runtime/source-package/sourcePackageManifestParser.js。
// 导入内容: createSourcePackageManifestParser Acorn 静态预检器工厂。
// 文件作用: 用户信任前验证模块语法、禁用能力和 manifest 向量。
import { createSourcePackageManifestParser } from '../src/runtime/source-package/sourcePackageManifestParser.js';

// 导入来源: ../src/runtime/source-package/sourcePackageLoader.js。
// 导入内容: createSourcePackageLoader 两阶段加载器工厂。
// 文件作用: 验证确认哈希、运行时命名空间和 ProviderFactory 支持边界。
import { createSourcePackageLoader } from '../src/runtime/source-package/sourcePackageLoader.js';

// 导入来源: ../src/utils/sourceAuthorization.js；导入内容: createSourceScriptHash；文件作用: 构造已保存 Package 真实脚本指纹。
import { createSourceScriptHash } from '../src/utils/sourceAuthorization.js';

import {
  // 导入来源: ../src/runtime/source-package/sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_ERROR_CODE 稳定错误码。
  // 文件作用: 断言失败分类而不解析中文 message。
  SOURCE_PACKAGE_ERROR_CODE,

  // 导入来源: ../src/runtime/source-package/sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_POLICY 统一容量与 SHA-256 策略。
  // 文件作用: 构造精确 1 MiB 边界并核对算法名称。
  SOURCE_PACKAGE_POLICY
} from '../src/runtime/source-package/sourcePackage.config.js';

// 类型: string。
// 作用: 所有测试载荷使用同一可逆 UTC 时间，身份和哈希断言不依赖系统时钟。
const IMPORTED_AT = '2026-07-19T00:00:00.000Z';

// 类型: object。
// 作用: 提供合法单文件 manifest 基准，字段和 Provider ABI 2.0.0 精确一致。
const BASE_MANIFEST = Object.freeze({
  schemaVersion: '1.0.0',
  providerApiVersion: '2.0.0',
  id: 'source.com.example',
  name: '示例 Provider',
  description: '用于验证三入口和加载边界。',
  version: '1.0.0',
  providerKey: 'source.com.example.provider',
  capabilities: Object.freeze({
    home: true,
    movie: true,
    tv: true,
    search: true,
    detail: true,
    play: true
  }),
  settingsSchema: Object.freeze([]),
  networkHosts: Object.freeze(['example.com'])
});

/**
 * 创建严格 JSON 测试副本。
 * 纯函数: 返回新值，不修改输入。
 *
 * @param {*} value JSON Value。
 * @returns {*} 隔离副本。
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 递归冻结一个严格 JSON 测试对象。
 * 副作用: 只冻结当前函数收到的隔离树，不修改 BASE_MANIFEST。
 *
 * @param {*} value JSON Value。
 * @returns {*} 同一冻结值。
 */
function deepFreezeJson(value) {
  // 条件分支: 当前值是非 null 对象或数组时进入。
  // 执行内容: 先冻结全部子值，再冻结当前容器。
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreezeJson);
    Object.freeze(value);
  }
  return value;
}

/**
 * 创建一个合法基准上的浅层 manifest 变体。
 * 纯函数: 返回新对象，嵌套 patch 由调用用例显式提供完整值。
 *
 * @param {object} patch 顶层字段覆盖。
 * @returns {object} 新 manifest 候选。
 */
function createManifest(patch = {}) {
  return { ...clone(BASE_MANIFEST), ...clone(patch) };
}

/**
 * 创建静态可提取的单文件 Provider ES module 文本。
 * 纯函数: 只序列化 manifest 和附加源码，不执行模块。
 *
 * @param {object} manifest 待写入 sourceManifest 的严格 JSON 对象。
 * @param {string} extraSource 工厂导出后的可选测试源码。
 * @returns {string} 自包含 JavaScript module 文本。
 */
function createModuleScript(manifest, extraSource = '') {
  return `export const sourceManifest = Object.freeze(${JSON.stringify(manifest)});\n`
    + 'export function createProviderFactory() { return {}; }\n'
    + extraSource;
}

// 类型: string。
// 作用: 合法基准脚本供三入口、容量和两阶段加载用例复用。
const BASE_SCRIPT = createModuleScript(BASE_MANIFEST);

/**
 * 创建读取器接受的精确四字段入口输入。
 * 纯函数: 根据入口填充对应来源字段，不保留 options 引用。
 *
 * @param {string} importMethod file、remote 或 text。
 * @param {string} scriptContent 本地入口正文；remote 传空字符串。
 * @param {object} options 可选来源字段。
 * @param {string} options.remoteUrl 远程 HTTPS 地址。
 * @param {string} options.originalFileName 本地原文件名。
 * @returns {object} 精确四字段输入。
 */
function createInput(importMethod, scriptContent, options = {}) {
  return {
    importMethod,
    remoteUrl: options.remoteUrl || '',
    originalFileName: options.originalFileName || '',
    scriptContent
  };
}

/**
 * 创建真实读取器、真实解析器和可控模块执行器组成的加载环境。
 * 副作用: 每个环境保存局部网络请求和执行文本数组；不访问真实网络、Blob、DOM 或 Repository。
 * 成功路径: 返回 loader、reader、parser、观测数组和可替换运行时命名空间工厂。
 * 失败路径: 生产端口构造依赖无效时同步抛错。
 *
 * @param {object} options 环境选项。
 * @param {string} options.remoteScript 远程 NetworkAdapter 返回正文。
 * @param {string} options.remoteContentType 远程响应媒体类型。
 * @param {Function} options.createNamespace 根据脚本文本创建模块命名空间。
 * @returns {object} loader、reader、parser、networkRequests 和 executedScripts。
 */
function createLoaderHarness({
  remoteScript = BASE_SCRIPT,
  remoteContentType = 'text/javascript; charset=utf-8',
  createNamespace = () => {
    // 类型: object。
    // 作用: 返回与 BASE_MANIFEST 一致的冻结运行时模块命名空间。
    const runtimeManifest = deepFreezeJson(clone(BASE_MANIFEST));
    return {
      sourceManifest: runtimeManifest,
      /**
       * 创建合法测试 ProviderFactory。
       * 纯函数: 返回新普通对象，不修改 manifest。
       * @returns {object} 精确三字段工厂。
       */
      createProviderFactory() {
        return {
          providerKey: runtimeManifest.providerKey,
          /**
           * 判断 Definition 是否属于当前测试源。
           * 纯函数: 只比较 id。
           * @param {object} definition 测试 Definition。
           * @returns {boolean} id 一致时为 true。
           */
          supports(definition) {
            return definition.id === runtimeManifest.id;
          },
          /**
           * 创建占位 Provider 结果。
           * 纯函数: 返回新空对象，加载器当前不调用该方法。
           * @returns {object} 空 Provider 候选。
           */
          create() {
            return {};
          }
        };
      }
    };
  }
} = {}) {
  // 类型: Array<object>。
  // 作用: 保存远程读取器提交的标准请求副本，验证入口不直接 import URL。
  const networkRequests = [];
  // 类型: Array<string>。
  // 作用: 保存执行器收到的规范化脚本文本，证明信任前和哈希变化时不执行。
  const executedScripts = [];

  // 类型: object。
  // 作用: 冻结单方法 NetworkAdapter，只返回当前测试配置的文本响应。
  const networkAdapter = Object.freeze({
    /**
     * 返回确定性远程脚本文本响应。
     * 副作用: 记录请求副本，不访问真实网络。
     * 成功路径: resolve 当前媒体类型和正文；失败路径: 当前夹具不注入失败。
     * @param {object} request 标准网络请求。
     * @returns {Promise<object>} 原始 UTF-8 字节响应。
     */
    async request(request) {
      networkRequests.push(clone(request));
      return {
        status: 200,
        headers: [{ name: 'content-type', value: remoteContentType }],
        body: new TextEncoder().encode(remoteScript).buffer
      };
    }
  });

  // 类型: object。
  // 作用: 使用真实三入口读取器验证共同载荷和远程边界。
  const reader = createSourcePackageInputReader({ networkAdapter });
  // 类型: object。
  // 作用: 使用真实 Acorn 解析器验证信任前静态规则。
  const parser = createSourcePackageManifestParser();
  // 类型: object。
  // 作用: 冻结单方法执行端口，只记录调用并返回受控命名空间。
  const executor = Object.freeze({
    /**
     * 模拟信任后模块执行。
     * 副作用: 记录脚本文本并调用当前命名空间工厂。
     * 成功路径: resolve 受控命名空间；失败路径: createNamespace 抛错时 reject。
     * @param {string} scriptContent 已确认脚本文本。
     * @returns {Promise<object>} 模块命名空间。
     */
    async execute(scriptContent) {
      executedScripts.push(scriptContent);
      return createNamespace(scriptContent);
    }
  });
  // 类型: object。
  // 作用: 组合真实 reader/parser 与可控 executor，覆盖正式 preview/load 行为。
  const loader = createSourcePackageLoader({
    inputReader: reader,
    manifestParser: parser,
    moduleExecutor: executor
  });

  return { loader, reader, parser, networkRequests, executedScripts };
}

test('文件、文本和远程入口对同一规范化脚本生成相同 SHA-256', async () => {
  // 类型: object。
  // 作用: 远程正文使用 LF，文件正文使用 CRLF，验证共同读取器统一换行和身份。
  const harness = createLoaderHarness({ remoteScript: BASE_SCRIPT });
  // 类型: string。
  // 作用: 构造语义相同的 Windows 文件换行文本。
  const crlfScript = BASE_SCRIPT.replaceAll('\n', '\r\n');

  // 类型: object。
  // 作用: 保存文件入口预览，原文件名只用于预览。
  const filePreview = await harness.loader.preview(
    createInput('file', crlfScript, { originalFileName: 'source.js' }),
    IMPORTED_AT
  );
  // 类型: object。
  // 作用: 保存粘贴文本入口预览。
  const textPreview = await harness.loader.preview(createInput('text', BASE_SCRIPT), IMPORTED_AT);
  // 类型: object。
  // 作用: 保存 HTTPS 远程入口预览。
  const remotePreview = await harness.loader.preview(
    createInput('remote', '', { remoteUrl: 'https://example.com/source.js' }),
    IMPORTED_AT
  );

  assert.equal(filePreview.integrity.algorithm, SOURCE_PACKAGE_POLICY.integrityAlgorithm);
  assert.equal(filePreview.integrity.scriptHash.length, 64);
  assert.equal(filePreview.integrity.scriptHash, textPreview.integrity.scriptHash);
  assert.equal(textPreview.integrity.scriptHash, remotePreview.integrity.scriptHash);
  assert.equal(harness.networkRequests.length, 1);
  assert.equal(harness.networkRequests[0].url, 'https://example.com/source.js');
  assert.equal(harness.executedScripts.length, 0);
});

test('预检和确认哈希变化都不会执行脚本，只有匹配确认才进入执行器', async () => {
  // 类型: object。
  // 作用: 保存可观察执行次数的两阶段加载环境。
  const harness = createLoaderHarness();
  // 类型: object。
  // 作用: 取得用户信任前预览和当前 SHA-256。
  const preview = await harness.loader.preview(createInput('text', BASE_SCRIPT), IMPORTED_AT);
  assert.equal(harness.executedScripts.length, 0);

  await assert.rejects(
    harness.loader.load(createInput('text', BASE_SCRIPT), {
      trustedScriptHash: '0'.repeat(64),
      enableAfterImport: false
    }, IMPORTED_AT),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.trustRequired
  );
  assert.equal(harness.executedScripts.length, 0);

  // 类型: object。
  // 作用: 保存确认值匹配后返回的载荷、manifest 和冻结工厂。
  const loaded = await harness.loader.load(createInput('text', BASE_SCRIPT), {
    trustedScriptHash: preview.integrity.scriptHash,
    enableAfterImport: false
  }, IMPORTED_AT);
  assert.equal(harness.executedScripts.length, 1);
  assert.equal(loaded.providerFactory.providerKey, BASE_MANIFEST.providerKey);
  assert.equal(Object.isFrozen(loaded.providerFactory), true);

  // 类型: object。
  // 作用: 构造由同一 manifest 映射的最小 Definition，验证 supports 明确 true。
  const definition = { id: BASE_MANIFEST.id };
  assert.doesNotThrow(() => harness.loader.assertFactorySupports(loaded.providerFactory, definition));
});

test('Acorn 预检拒绝外部依赖、额外导出、动态导入和越权全局', async () => {
  // 类型: object。
  // 作用: 使用真实读取器和 parser，不需要执行器参与。
  const harness = createLoaderHarness();
  // 类型: Array<string>。
  // 作用: 每条源码分别触发冻结模块或全局能力禁用规则。
  const invalidScripts = [
    `import value from './other.js';\n${BASE_SCRIPT}`,
    `export { value } from './other.js';\n${BASE_SCRIPT}`,
    `${BASE_SCRIPT}\nexport default {};`,
    `${BASE_SCRIPT}\nexport const extra = true;`,
    `${BASE_SCRIPT}\nasync function loadOther() { return import('./other.js'); }`,
    `${BASE_SCRIPT}\nfunction requestNow() { return fetch('https://example.com'); }`
  ];

  // 循环类型: for...of。
  // 初始值: 第一条非法脚本。
  // 终止条件: 全部禁用语法均被 parser 拒绝。
  // 循环作用: 证明三入口不会因语法形式不同绕过同一静态边界。
  for (const invalidScript of invalidScripts) {
    await assert.rejects(
      harness.loader.preview(createInput('text', invalidScript), IMPORTED_AT),
      error => [
        SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
        SOURCE_PACKAGE_ERROR_CODE.manifestInvalid
      ].includes(error.code)
    );
  }
  assert.equal(harness.executedScripts.length, 0);
});

test('正式 manifest 合法与非法向量均由同一静态解析器采用', async () => {
  // 类型: object。
  // 作用: 读取公共协议合法向量，测试代码不复制全部正式案例。
  const validVectors = JSON.parse(readFileSync(
    new URL('../../contracts/v2/provider-manifest.valid.json', import.meta.url),
    'utf8'
  ));
  // 类型: object。
  // 作用: 读取公共协议非法向量及其稳定 code/field 期望。
  const invalidVectors = JSON.parse(readFileSync(
    new URL('../../contracts/v2/provider-manifest.invalid.json', import.meta.url),
    'utf8'
  ));
  // 类型: object。
  // 作用: 使用真实 reader/parser 对全部语言无关向量执行相同入口。
  const harness = createLoaderHarness();

  // 循环类型: for...of。
  // 初始值: 第一条合法 manifest。
  // 终止条件: 全部合法向量均生成 readyForTrust 预览。
  // 循环作用: 证明静态解析器接受冻结公共协议的全部合法结构。
  for (const vector of validVectors.cases) {
    // 类型: object。
    // 作用: 保存当前合法向量预览，核对真实身份未被转换。
    const preview = await harness.loader.preview(
      createInput('text', createModuleScript(vector.manifest)),
      IMPORTED_AT
    );
    assert.equal(preview.readyForTrust, true);
    assert.equal(preview.manifest.id, vector.manifest.id);
  }

  // 循环类型: for...of。
  // 初始值: 第一条非法 manifest patch。
  // 终止条件: 全部非法向量均返回约定 code 和 field。
  // 循环作用: 防止实现与跨语言契约向量发生静默漂移。
  for (const vector of invalidVectors.cases) {
    // 类型: object。
    // 作用: 在正式 baseManifest 上应用当前顶层非法 patch。
    const invalidManifest = {
      ...clone(invalidVectors.baseManifest),
      ...clone(vector.patch)
    };
    await assert.rejects(
      harness.loader.preview(
        createInput('text', createModuleScript(invalidManifest)),
        IMPORTED_AT
      ),
      error => error.code === vector.expected.code && error.field === vector.expected.field
    );
  }
});

test('共同读取器执行精确 1 MiB、HTTPS 和远程媒体类型边界', async () => {
  // 类型: object。
  // 作用: 使用真实读取器验证容量和协议，不需要解析补齐空白后的脚本。
  const harness = createLoaderHarness();
  // 类型: number。
  // 作用: 计算合法基准脚本真实 UTF-8 字节数，生成精确剩余容量。
  const baseBytes = utf8ToBytes(BASE_SCRIPT).length;
  // 类型: string。
  // 作用: 通过 ASCII 空格把合法脚本补齐到精确 1 MiB。
  const exactLimitScript = BASE_SCRIPT + ' '.repeat(
    SOURCE_PACKAGE_POLICY.maxScriptBytes - baseBytes
  );

  // 类型: object。
  // 作用: 读取精确上限载荷，证明边界采用小于等于语义。
  const exactPayload = await harness.reader.read(
    createInput('text', exactLimitScript),
    IMPORTED_AT
  );
  assert.equal(utf8ToBytes(exactPayload.scriptContent).length, SOURCE_PACKAGE_POLICY.maxScriptBytes);

  await assert.rejects(
    harness.reader.read(createInput('text', `${exactLimitScript} `), IMPORTED_AT),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.tooLarge
  );
  await assert.rejects(
    harness.reader.read(
      createInput('remote', '', { remoteUrl: 'http://example.com/source.js' }),
      IMPORTED_AT
    ),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.remote
  );

  // 类型: object。
  // 作用: 配置 HTML 媒体类型响应，证明远程正文不能仅凭内容看似 JavaScript 被接受。
  const htmlHarness = createLoaderHarness({ remoteContentType: 'text/html' });
  await assert.rejects(
    htmlHarness.reader.read(
      createInput('remote', '', { remoteUrl: 'https://example.com/source.js' }),
      IMPORTED_AT
    ),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.remote
  );
});

test('运行时模块额外导出、manifest 变化、工厂字段和 supports 均失败关闭', async () => {
  // 类型: object。
  // 作用: 取得同一合法脚本预览哈希，后续四种运行时失败共享用户确认值。
  const baselineHarness = createLoaderHarness();
  // 类型: object。
  // 作用: 保存合法预览，用于每个独立加载器的信任决定。
  const preview = await baselineHarness.loader.preview(createInput('text', BASE_SCRIPT), IMPORTED_AT);
  // 类型: object。
  // 作用: 冻结用户确认和关闭决定，四个失败用例不修改该对象。
  const trustDecision = {
    trustedScriptHash: preview.integrity.scriptHash,
    enableAfterImport: false
  };

  // 类型: object。
  // 作用: 返回第三个运行时导出，验证命名空间精确集合。
  const extraExportHarness = createLoaderHarness({
    /**
     * 创建包含额外导出的非法命名空间。
     * 纯函数: 返回新测试对象。
     * @returns {object} 三导出命名空间。
     */
    createNamespace() {
      return {
        sourceManifest: deepFreezeJson(clone(BASE_MANIFEST)),
        /**
         * 创建空工厂候选。
         * 纯函数: 返回新空对象；命名空间门禁会先失败。
         * @returns {object} 空对象。
         */
        createProviderFactory() { return {}; },
        extra: true
      };
    }
  });
  await assert.rejects(
    extraExportHarness.loader.load(createInput('text', BASE_SCRIPT), trustDecision, IMPORTED_AT),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.moduleInvalid
  );

  // 类型: object。
  // 作用: 运行时把业务版本改为 2.0.0，验证执行前后 manifest 必须逐字段一致。
  const changedManifestHarness = createLoaderHarness({
    /**
     * 创建 manifest 已变化的非法命名空间。
     * 纯函数: 返回新冻结测试对象。
     * @returns {object} 两导出命名空间。
     */
    createNamespace() {
      return {
        sourceManifest: deepFreezeJson(createManifest({ version: '2.0.0' })),
        /**
         * 创建空工厂候选。
         * 纯函数: 返回新空对象；manifest 门禁会先失败。
         * @returns {object} 空对象。
         */
        createProviderFactory() { return {}; }
      };
    }
  });
  await assert.rejects(
    changedManifestHarness.loader.load(createInput('text', BASE_SCRIPT), trustDecision, IMPORTED_AT),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.moduleInvalid
  );

  // 类型: object。
  // 作用: 工厂返回额外字段，验证注册前 ABI 精确门禁。
  const extraFactoryFieldHarness = createLoaderHarness({
    /**
     * 创建工厂字段越界的命名空间。
     * 纯函数: 返回新测试对象。
     * @returns {object} 两导出命名空间。
     */
    createNamespace() {
      return {
        sourceManifest: deepFreezeJson(clone(BASE_MANIFEST)),
        /**
         * 创建含额外字段的非法工厂。
         * 纯函数: 返回新普通对象。
         * @returns {object} 四字段工厂。
         */
        createProviderFactory() {
          return {
            providerKey: BASE_MANIFEST.providerKey,
            /**
             * 返回支持结果。
             * 纯函数: 不读取输入。
             * @returns {boolean} 固定 true。
             */
            supports() { return true; },
            /**
             * 创建空 Provider 候选。
             * 纯函数: 返回新空对象。
             * @returns {object} 空对象。
             */
            create() { return {}; },
            extra: true
          };
        }
      };
    }
  });
  await assert.rejects(
    extraFactoryFieldHarness.loader.load(createInput('text', BASE_SCRIPT), trustDecision, IMPORTED_AT),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.factoryInvalid
  );

  // 类型: object。
  // 作用: 工厂结构合法但明确不支持 Definition，验证 supports 必须严格 true。
  const unsupportedHarness = createLoaderHarness({
    /**
     * 创建 supports=false 的合法结构命名空间。
     * 纯函数: 返回新测试对象。
     * @returns {object} 两导出命名空间。
     */
    createNamespace() {
      return {
        sourceManifest: deepFreezeJson(clone(BASE_MANIFEST)),
        /**
         * 创建明确不支持当前 Definition 的工厂。
         * 纯函数: 返回新普通对象。
         * @returns {object} 精确三字段工厂。
         */
        createProviderFactory() {
          return {
            providerKey: BASE_MANIFEST.providerKey,
            /**
             * 拒绝 Definition。
             * 纯函数: 不读取输入。
             * @returns {boolean} 固定 false。
             */
            supports() { return false; },
            /**
             * 创建空 Provider 候选。
             * 纯函数: 返回新空对象，当前用例不会调用。
             * @returns {object} 空对象。
             */
            create() { return {}; }
          };
        }
      };
    }
  });
  // 类型: object。
  // 作用: 保存结构合法的工厂门面，supports 结果在独立复核阶段失败。
  const unsupportedLoaded = await unsupportedHarness.loader.load(
    createInput('text', BASE_SCRIPT),
    trustDecision,
    IMPORTED_AT
  );
  assert.throws(
    () => unsupportedHarness.loader.assertFactorySupports(
      unsupportedLoaded.providerFactory,
      { id: BASE_MANIFEST.id }
    ),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.factoryInvalid
  );
});

test('已保存 Package 恢复不重新读取来源并完整复核 Definition 与 SHA-256', async () => {
  // 类型: object；作用: 使用真实预检器和可控执行器验证 Repository 恢复入口。
  const harness = createLoaderHarness();
  // 类型: object；作用: 构造只含保存字段和真实脚本指纹的自定义 Package。
  const sourcePackage = {
    packageRef: `source-package::${BASE_MANIFEST.id}`,
    schemaVersion: '1.0.0',
    sourceId: BASE_MANIFEST.id,
    providerKey: BASE_MANIFEST.providerKey,
    scriptContent: BASE_SCRIPT,
    integrity: {
      algorithm: SOURCE_PACKAGE_POLICY.integrityAlgorithm,
      scriptHash: createSourceScriptHash(BASE_SCRIPT)
    }
  };
  // 类型: object；作用: 构造 manifest 唯一映射得到的远程导入 Definition，恢复不得重新请求 remoteUrl。
  const sourceDefinition = {
    schemaVersion: '1.0.0',
    id: BASE_MANIFEST.id,
    name: BASE_MANIFEST.name,
    description: BASE_MANIFEST.description,
    sourceKind: 'custom',
    version: BASE_MANIFEST.version,
    providerKey: BASE_MANIFEST.providerKey,
    packageRef: sourcePackage.packageRef,
    importMethod: 'remote',
    remoteUrl: 'https://example.com/provider.js',
    importedAt: IMPORTED_AT,
    lastUpdatedAt: IMPORTED_AT,
    capabilities: clone(BASE_MANIFEST.capabilities),
    settingsSchema: clone(BASE_MANIFEST.settingsSchema)
  };

  // 类型: object；作用: 保存全部恢复门禁通过后的冻结工厂。
  const providerFactory = await harness.loader.restore(sourcePackage, sourceDefinition);
  assert.equal(providerFactory.providerKey, BASE_MANIFEST.providerKey);
  assert.equal(harness.networkRequests.length, 0);
  assert.deepEqual(harness.executedScripts, [BASE_SCRIPT]);

  // 类型: object；作用: 构造脚本文本未变但 Definition 版本漂移的损坏保存图。
  const mismatchedDefinition = { ...sourceDefinition, version: '2.0.0' };
  await assert.rejects(
    harness.loader.restore(sourcePackage, mismatchedDefinition),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.manifestInvalid
  );
  // 类型: object；作用: 构造声明哈希不再匹配真实文本的损坏包。
  const corruptedPackage = clone(sourcePackage);
  corruptedPackage.integrity.scriptHash = '0'.repeat(64);
  await assert.rejects(
    harness.loader.restore(corruptedPackage, sourceDefinition),
    error => error.code === SOURCE_PACKAGE_ERROR_CODE.trustRequired
  );
});
