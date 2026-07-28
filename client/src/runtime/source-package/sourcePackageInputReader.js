/*
  sourcePackageInputReader.js 模块说明

  - 文件职责:
      把文件已读文本、HTTPS 远程地址和粘贴文本统一转换为 SourcePackagePayload。
      集中执行精确输入、UTF-8 字节、LF、非空、1 MiB、来源元信息、远程响应和 SHA-256 校验。
      本模块不解析或执行 JavaScript，不注册工厂、不写 Repository，也不读取页面或 store。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 1 条，自定义 5 条):
      utf8ToBytes: 第三方 @noble/hashes 工具，按 UTF-8 计算规范化文本字节数。
      IMPORT_METHOD: 自定义配置，限定文件、远程和文本三种入口。
      assertExactObjectKeys、assertPlainObject: 自定义 Repository 校验，拒绝未知输入字段和异常原型。
      createSourceScriptHash、normalizeSourceScriptContent: 自定义授权工具，统一 LF 和 SHA-256。
      sourcePackage 配置与错误: 自定义运行边界，提供容量、远程策略、阶段和稳定错误。

  - 模块级常量:
      SOURCE_PACKAGE_INPUT_FIELDS: Array<string>，三入口共同输入精确字段。
      SOURCE_PACKAGE_INPUT_READER_PUBLIC_METHODS: Array<string>，读取器公开方法集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createInputError(options): 创建读取或规范化阶段稳定错误。
      normalizeRemoteUrl(importMethod, remoteUrl): 校验来源方式与 HTTPS 地址关系。
      normalizeOriginalFileName(importMethod, originalFileName): 校验文件名只属于文件入口。
      normalizeLocalScriptContent(importMethod, scriptContent): 校验本地入口文本与远程空值。
      normalizePayload(input, importedAt, scriptContent): 生成共同载荷并执行容量和 SHA-256。
      validateRemoteResponse(response): 校验远程状态、媒体类型和文本正文。
      createSourcePackageInputReader(options): 创建绑定唯一 NetworkAdapter 的读取端口。

  - 模块级类:
      无

  - 对外导出:
      createSourcePackageInputReader(options): Function，创建只公开 read 的三入口共同读取器。
*/

// 导入来源: @noble/hashes/utils，第三方字节工具。
// 导入内容: utf8ToBytes UTF-8 编码函数。
// 文件作用: 依据公共协议以真实 UTF-8 字节数执行 1 MiB 容量门禁。
import { utf8ToBytes } from '@noble/hashes/utils';

// 导入来源: ../../config/source-manager.config.js。
// 导入内容: IMPORT_METHOD 导入方式枚举。
// 文件作用: 精确区分 file、remote 和 text，不接受 builtin 或临时别名。
import { IMPORT_METHOD } from '../../config/source-manager.config.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertExactObjectKeys 精确字段校验函数。
  // 文件作用: 拒绝名称、版本、信任或页面状态混入原始读取输入。
  assertExactObjectKeys,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 普通对象校验函数。
  // 文件作用: 在字段读取前拒绝数组、类实例和异常原型。
  assertPlainObject
} from '../../repositories/source/sourceRepositoryValidators.js';

import {
  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: createSourceScriptHash 统一 SHA-256 计算函数。
  // 文件作用: 载荷完整性与 Repository 和授权快照使用同一实现。
  createSourceScriptHash,

  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: normalizeSourceScriptContent LF 规范化函数。
  // 文件作用: 三入口相同文本生成逐字一致的保存与执行内容。
  normalizeSourceScriptContent
} from '../../utils/sourceAuthorization.js';

import {
  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_ERROR_CODE 稳定错误码枚举。
  // 文件作用: 区分输入、容量和远程读取失败。
  SOURCE_PACKAGE_ERROR_CODE,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_LOAD_STAGE 加载阶段枚举。
  // 文件作用: 错误明确发生在 read 或 normalize 阶段。
  SOURCE_PACKAGE_LOAD_STAGE,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_POLICY 共同读取策略。
  // 文件作用: 提供版本、编码、容量、超时、请求身份和 SHA-256 名称。
  SOURCE_PACKAGE_POLICY,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_REMOTE_CONTENT_TYPES 允许媒体类型。
  // 文件作用: 远程响应必须明确是 JavaScript 或文本，不能把二进制当脚本。
  SOURCE_PACKAGE_REMOTE_CONTENT_TYPES
} from './sourcePackage.config.js';

// 导入来源: ./sourcePackageErrors.js。
// 导入内容: SourcePackageLoadError 稳定加载错误。
// 文件作用: 输入和远程失败只向上层公开安全四字段分类。
import { SourcePackageLoadError } from './sourcePackageErrors.js';

// 类型: Array<string>。
// 作用: 三入口只提交来源、远程地址、原文件名和文本，不接收页面填写的 manifest 字段。
const SOURCE_PACKAGE_INPUT_FIELDS = Object.freeze([
  'importMethod',
  'remoteUrl',
  'originalFileName',
  'scriptContent'
]);

// 类型: Array<string>。
// 作用: 读取端口只公开 read，不泄漏 NetworkAdapter、请求序号或规范化辅助函数。
const SOURCE_PACKAGE_INPUT_READER_PUBLIC_METHODS = Object.freeze(['read']);

/**
 * 创建输入读取或规范化错误。
 * 纯函数: 不保留原始输入、响应或底层异常。
 *
 * @param {object} options 安全错误字段。
 * @param {string} options.code 稳定错误码。
 * @param {string} options.stage read 或 normalize 阶段。
 * @param {string} options.message 用户可读说明。
 * @param {string} options.field 最小字段路径。
 * @returns {SourcePackageLoadError} 安全加载错误。
 */
function createInputError({ code, stage, message, field = '' }) {
  return new SourcePackageLoadError({ code, stage, message, field });
}

/**
 * 校验导入方式和远程地址的一一关系。
 * 纯函数: 只使用标准 URL 解析，不发起网络请求。
 * 成功路径: remote 返回无凭据、无片段的 HTTPS 原地址；其他入口返回空字符串。
 * 失败路径: 来源方式未知、地址缺失、协议越界或非远程携带地址时抛稳定错误。
 *
 * @param {*} importMethod 导入方式候选。
 * @param {*} remoteUrl 远程地址候选。
 * @returns {string} 可保存远程地址或空字符串。
 */
function normalizeRemoteUrl(importMethod, remoteUrl) {
  // 条件分支: 导入方式不属于三个用户入口时进入。
  // 执行内容: 拒绝 builtin 和未知别名进入单文件用户导入链。
  if (![IMPORT_METHOD.file, IMPORT_METHOD.remote, IMPORT_METHOD.text].includes(importMethod)) {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.read,
      message: '导入方式只允许文件、在线地址或粘贴文本。',
      field: 'importMethod'
    });
  }

  // 条件分支: 当前不是远程导入时进入。
  // 执行内容: 只接受明确空地址，避免一份载荷同时表达两个来源。
  if (importMethod !== IMPORT_METHOD.remote) {
    // 条件分支: 文件或文本入口仍携带非空远程地址时进入。
    // 执行内容: 拒绝双来源输入，不让页面预览与保存来源产生分歧。
    if (remoteUrl !== '') {
      throw createInputError({
        code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.read,
        message: '非在线导入不能携带远程地址。',
        field: 'remoteUrl'
      });
    }
    return '';
  }

  // 条件分支: 远程地址不是非空字符串时进入。
  // 执行内容: 在创建 URL 前给出稳定字段错误。
  if (typeof remoteUrl !== 'string' || remoteUrl.trim() === '') {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.remote,
      stage: SOURCE_PACKAGE_LOAD_STAGE.read,
      message: '在线导入必须提供 HTTPS 地址。',
      field: 'remoteUrl'
    });
  }

  // 类型: URL|undefined。
  // 作用: 保存标准解析结果，后续校验协议、凭据和片段。
  let parsedUrl;
  try {
    parsedUrl = new URL(remoteUrl);
  } catch (error) {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.remote,
      stage: SOURCE_PACKAGE_LOAD_STAGE.read,
      message: '在线导入地址格式无效。',
      field: 'remoteUrl'
    });
  }

  // 条件分支: 地址不是 HTTPS、携带凭据或片段时进入。
  // 执行内容: 远程读取失败关闭，不把敏感凭据或非请求片段保存到 Definition。
  if (parsedUrl.protocol !== SOURCE_PACKAGE_POLICY.remoteProtocol
    || parsedUrl.username !== ''
    || parsedUrl.password !== ''
    || parsedUrl.hash !== '') {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.remote,
      stage: SOURCE_PACKAGE_LOAD_STAGE.read,
      message: '在线导入只允许不含凭据和片段的 HTTPS 地址。',
      field: 'remoteUrl'
    });
  }

  return parsedUrl.href;
}

/**
 * 校验原文件名只属于文件入口。
 * 纯函数: 不读取文件系统或 File 对象，只返回本次预览使用的字符串。
 *
 * @param {string} importMethod 已校验导入方式。
 * @param {*} originalFileName 原文件名候选。
 * @returns {string} 文件预览名称或空字符串。
 */
function normalizeOriginalFileName(importMethod, originalFileName) {
  // 条件分支: 文件入口必须提供可见文件名时进入校验。
  // 执行内容: 保留用户选择的 basename 文本，但不把它映射到保存对象。
  if (importMethod === IMPORT_METHOD.file) {
    // 条件分支: 文件名不是非空字符串时进入。
    // 执行内容: 拒绝无法供用户核对来源的文件载荷。
    if (typeof originalFileName !== 'string' || originalFileName.trim() === '') {
      throw createInputError({
        code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.read,
        message: '文件导入必须提供原文件名。',
        field: 'originalFileName'
      });
    }
    return originalFileName;
  }

  // 条件分支: 远程或文本入口携带文件名时进入。
  // 执行内容: 拒绝来源元信息混用，避免预览误导用户。
  if (originalFileName !== '') {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.read,
      message: '非文件导入不能携带原文件名。',
      field: 'originalFileName'
    });
  }

  return '';
}

/**
 * 校验本地入口文本和远程入口空值。
 * 纯函数: 不规范化内容，规范化和容量检查统一由 normalizePayload 完成。
 *
 * @param {string} importMethod 已校验导入方式。
 * @param {*} scriptContent 脚本文本候选。
 * @returns {string} 本地脚本文本或远程入口空字符串。
 */
function normalizeLocalScriptContent(importMethod, scriptContent) {
  // 条件分支: scriptContent 不是字符串时进入。
  // 执行内容: 拒绝 File、Blob、对象和数组绕过统一文本边界。
  if (typeof scriptContent !== 'string') {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.parse,
      stage: SOURCE_PACKAGE_LOAD_STAGE.read,
      message: '数据源脚本必须读取为 UTF-8 文本。',
      field: 'scriptContent'
    });
  }

  // 条件分支: 远程入口同时携带本地文本时进入。
  // 执行内容: 禁止页面提交另一份文本让预览与远程来源脱节。
  if (importMethod === IMPORT_METHOD.remote && scriptContent !== '') {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.remote,
      stage: SOURCE_PACKAGE_LOAD_STAGE.read,
      message: '在线导入的脚本文本只能由受控网络读取。',
      field: 'scriptContent'
    });
  }

  return scriptContent;
}

/**
 * 规范化脚本文本并创建三入口共同载荷。
 * 纯函数: 返回新冻结对象，不修改输入或执行脚本。
 * 失败路径: 空文本、超出 1 MiB 或 importedAt 非标准 UTC 时间时抛稳定错误。
 *
 * @param {object} input 已校验来源元信息。
 * @param {string} importedAt Runtime 在意图取得执行权后生成的 UTC ISO 时间。
 * @param {string} scriptContent 本地输入或受控远程响应正文。
 * @returns {object} 冻结 SourcePackagePayload。
 */
function normalizePayload(input, importedAt, scriptContent) {
  // 条件分支: importedAt 不是可逆标准 UTC ISO 时间时进入。
  // 执行内容: 拒绝本地时区和模糊时间文本进入 Definition。
  if (typeof importedAt !== 'string'
    || !Number.isFinite(Date.parse(importedAt))
    || new Date(Date.parse(importedAt)).toISOString() !== importedAt) {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.normalize,
      message: '导入时间必须是标准 UTC ISO 时间。',
      field: 'importedAt'
    });
  }

  // 类型: string。
  // 作用: 将三入口文本统一为 LF，后续 AST、哈希、保存和执行使用同一份内容。
  const normalizedScriptContent = normalizeSourceScriptContent(scriptContent);

  // 条件分支: 规范化文本只包含空白时进入。
  // 执行内容: 在 AST 解析前返回明确空载荷错误。
  if (normalizedScriptContent.trim() === '') {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.parse,
      stage: SOURCE_PACKAGE_LOAD_STAGE.normalize,
      message: '数据源脚本文本不能为空。',
      field: 'scriptContent'
    });
  }

  // 类型: number。
  // 作用: 使用 UTF-8 字节而非 JS 字符长度执行跨语言容量门禁。
  const scriptBytes = utf8ToBytes(normalizedScriptContent).length;

  // 条件分支: 规范化脚本超过公共协议 1 MiB 上限时进入。
  // 执行内容: 在解析和执行前失败，避免大载荷占用 AST 和模块资源。
  if (scriptBytes > SOURCE_PACKAGE_POLICY.maxScriptBytes) {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.tooLarge,
      stage: SOURCE_PACKAGE_LOAD_STAGE.normalize,
      message: '数据源脚本超过 1 MiB 上限。',
      field: 'scriptContent'
    });
  }

  return Object.freeze({
    importMethod: input.importMethod,
    scriptContent: normalizedScriptContent,
    remoteUrl: input.remoteUrl,
    originalFileName: input.originalFileName,
    importedAt,
    integrity: Object.freeze({
      algorithm: SOURCE_PACKAGE_POLICY.integrityAlgorithm,
      scriptHash: createSourceScriptHash(normalizedScriptContent)
    })
  });
}

/**
 * 校验受控网络返回的远程脚本响应。
 * 纯函数: 只读取隔离 SourceNetworkResponse，不修改响应或保存正文。
 * 成功路径: 2xx、允许媒体类型和字符串 body 返回原正文。
 * 失败路径: 上游状态、媒体类型或正文不符合边界时抛 remote 错误。
 *
 * @param {*} response SourceNetworkResponse 候选。
 * @returns {string} 远程 UTF-8 脚本文本。
 */
function validateRemoteResponse(response) {
  // 条件分支: 响应缺失、状态不是 2xx 或 body 不是文本时进入。
  // 执行内容: 远程入口不把上游错误页或对象响应交给 AST。
  if (!response
    || typeof response !== 'object'
    || !Number.isInteger(response.status)
    || response.status < 200
    || response.status >= 300
    || typeof response.body !== 'string') {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.remote,
      stage: SOURCE_PACKAGE_LOAD_STAGE.read,
      message: '在线数据源脚本读取失败。',
      field: 'remoteUrl'
    });
  }

  // 类型: string。
  // 作用: 从隔离小写响应头读取媒体类型，并移除 charset 等参数后比较。
  const contentType = typeof response.headers?.['content-type'] === 'string'
    ? response.headers['content-type'].split(';', 1)[0].trim().toLowerCase()
    : '';

  // 条件分支: 远程响应未声明允许的 JavaScript 或文本媒体类型时进入。
  // 执行内容: 拒绝 HTML、JSON、二进制和缺失类型响应被当作可执行模块。
  if (!SOURCE_PACKAGE_REMOTE_CONTENT_TYPES.includes(contentType)) {
    throw createInputError({
      code: SOURCE_PACKAGE_ERROR_CODE.remote,
      stage: SOURCE_PACKAGE_LOAD_STAGE.read,
      message: '在线地址没有返回允许的 JavaScript 或文本类型。',
      field: 'remoteUrl'
    });
  }

  return response.body;
}

/**
 * 创建绑定唯一 NetworkAdapter 的三入口读取端口。
 * 副作用: 每个实例维护远程请求单调序号；remote 调用适配器一次，file/text 不访问网络。
 * 失败路径: 依赖或输入非法时抛 SourcePackageLoadError；网络异常转换为安全 remote 错误。
 *
 * @param {object} options 读取器依赖。
 * @param {object} options.networkAdapter 冻结且只公开 request 的统一网络适配器。
 * @returns {object} 只公开 read(input, importedAt) 的冻结端口。
 */
export function createSourcePackageInputReader({ networkAdapter }) {
  // 条件分支: NetworkAdapter 缺失、可变、字段不精确或 request 非函数时进入。
  // 执行内容: 拒绝直接 fetch、第二适配器和运行时切换入口。
  if (!networkAdapter
    || typeof networkAdapter !== 'object'
    || !Object.isFrozen(networkAdapter)
    || Reflect.ownKeys(networkAdapter).length !== 1
    || typeof networkAdapter.request !== 'function') {
    throw new TypeError('sourcePackageInputReader.networkAdapter 必须是冻结单方法端口');
  }

  // 类型: number。
  // 作用: 生成当前读取器生命周期内稳定且可诊断的远程请求身份。
  // 初始值: 0，表示当前读取器尚未发起远程读取。
  // 修改入口: 每次 remote read 在构造请求前严格递增一次。
  // 清理入口: 读取器随 Runtime Bundle 释放，不持久化或跨 Bundle 复用。
  let remoteRequestSequence = 0;

  /**
   * 读取并规范化一次导入载荷。
   * 副作用: remote 通过唯一 NetworkAdapter 发起一次受控请求并创建短生命周期 AbortController。
   * 成功路径: 三种入口都返回同构 SourcePackagePayload。
   * 失败路径: 输入、网络、响应、空文本或容量错误使用稳定 SourcePackageLoadError。
   *
   * @param {*} input 三入口共同输入候选。
   * @param {*} importedAt Runtime 提供的标准 UTC ISO 时间。
   * @returns {Promise<object>} 冻结 SourcePackagePayload。
   */
  async function read(input, importedAt) {
    // 条件分支: 输入不是安全普通对象或字段集合不精确时进入。
    // 执行内容: 转换为稳定读取错误，不泄漏 Repository 校验异常。
    try {
      assertPlainObject(input, 'sourcePackageInput');
      assertExactObjectKeys(input, SOURCE_PACKAGE_INPUT_FIELDS, 'sourcePackageInput');
    } catch (error) {
      throw createInputError({
        code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.read,
        message: '数据源导入输入字段无效。',
        field: 'sourcePackageInput'
      });
    }

    // 类型: string。
    // 作用: 校验并保存来源对应的 HTTPS 地址或空字符串。
    const remoteUrl = normalizeRemoteUrl(input.importMethod, input.remoteUrl);
    // 类型: string。
    // 作用: 校验并保存只用于本次预览的原文件名或空字符串。
    const originalFileName = normalizeOriginalFileName(input.importMethod, input.originalFileName);
    // 类型: string。
    // 作用: 校验本地文本或远程空值，remote 稍后替换为受控响应正文。
    let scriptContent = normalizeLocalScriptContent(input.importMethod, input.scriptContent);

    // 条件分支: 当前是远程入口时进入。
    // 执行内容: 通过唯一 NetworkAdapter 读取文本，禁止 import(remoteUrl) 或直接 fetch。
    if (input.importMethod === IMPORT_METHOD.remote) {
      remoteRequestSequence += 1;

      // 类型: AbortController。
      // 作用: 为本次适配器调用提供独立生命周期信号；请求收敛后不跨调用保存。
      const controller = new AbortController();

      try {
        // 类型: object。
        // 作用: 使用固定导入诊断身份、单调请求 id、HTTPS 地址和 1 MiB 上限构造标准网络请求。
        const response = await networkAdapter.request({
          sourceId: SOURCE_PACKAGE_POLICY.remoteImportSourceId,
          requestId: `${SOURCE_PACKAGE_POLICY.remoteRequestIdPrefix}${remoteRequestSequence}`,
          url: remoteUrl,
          method: 'GET',
          headers: { accept: SOURCE_PACKAGE_REMOTE_CONTENT_TYPES.join(', ') },
          body: null,
          responseType: 'text',
          timeout: SOURCE_PACKAGE_POLICY.remoteTimeoutMs,
          maxResponseBytes: SOURCE_PACKAGE_POLICY.maxScriptBytes
        }, controller.signal);

        scriptContent = validateRemoteResponse(response);
      } catch (error) {
        // 条件分支: 响应校验已经给出稳定分类时进入。
        // 执行内容: 原样保留其安全 code、stage 和 field。
        if (error instanceof SourcePackageLoadError) throw error;

        throw createInputError({
          code: SOURCE_PACKAGE_ERROR_CODE.remote,
          stage: SOURCE_PACKAGE_LOAD_STAGE.read,
          message: '在线数据源脚本请求失败。',
          field: 'remoteUrl'
        });
      }
    }

    return normalizePayload({
      importMethod: input.importMethod,
      remoteUrl,
      originalFileName
    }, importedAt, scriptContent);
  }

  // 类型: object。
  // 作用: 冻结单方法端口，调用方不能读取或修改请求序号和 NetworkAdapter 引用。
  const reader = Object.freeze({ read });

  // 条件分支: 公开字段与冻结端口契约不一致时进入。
  // 执行内容: 构造阶段失败，避免辅助能力意外泄漏。
  if (Object.keys(reader).length !== SOURCE_PACKAGE_INPUT_READER_PUBLIC_METHODS.length
    || Object.keys(reader).some(
      (methodName, index) => methodName !== SOURCE_PACKAGE_INPUT_READER_PUBLIC_METHODS[index]
    )) {
    throw new TypeError('SourcePackageInputReader 公开方法无效');
  }

  return reader;
}
