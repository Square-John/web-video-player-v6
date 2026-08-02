/*
  proxy-request-contract.test.js 模块说明

  - 文件职责:
      使用 contracts/v2 语言无关向量验证 ProxyRequestEnvelope 精确校验、原始运输、部署上限和稳定错误语义。
      本测试只调用纯校验和错误映射，不执行 DNS、上游连接或任何真实网络访问。

  - 导入库及文件汇总(9 条，内置 5 条，第三方 0 条，自定义 4 条):
      node:assert/strict: 比较校验结果、冻结状态和稳定错误字段。
      node:fs#readFileSync: 读取根目录 contracts/v2 JSON 向量。
      node:path: 计算仓库根目录和向量绝对路径。
      node:test#test: 注册相互隔离的 Node.js 测试用例。
      node:url#fileURLToPath: 将测试模块 URL 转换为文件系统路径。
      ../src/config/proxyPolicy.js: 创建默认和收紧后的代理策略。
      ../src/contracts/proxyProtocol.js#PROXY_ERROR_DEFINITIONS: 核对错误向量与生产映射一致。
      ../src/errors/proxyError.js: 构造并序列化全部稳定代理错误。
      ../src/validation/proxyRequestValidator.js#validateProxyRequestEnvelope: 执行网络前精确请求门禁。

  - 模块级常量:
      REPOSITORY_ROOT: string，当前测试文件推导的仓库根目录。
      CONTRACT_DIRECTORY: string，contracts/v2 向量目录。
      VALID_REQUEST_VECTORS: object，合法请求向量集合。
      INVALID_REQUEST_VECTORS: object，非法请求与期望错误集合。
      ERROR_VECTORS: object，全部冻结错误状态和 retryable 语义。

  - 模块级变量:
      无

  - 模块级辅助函数:
      loadContractVector(fileName): 读取并解析指定 JSON 向量。
      createPatchedRequest(baseRequest, patch): 生成与向量对象隔离的单用例请求。

  - 模块级类:
      无

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert 默认对象；文件作用: 验证协议结果、错误与冻结边界。
import assert from 'node:assert/strict';
// 导入来源: node:fs；导入内容: readFileSync；文件作用: 同步读取语言无关契约向量。
import { readFileSync } from 'node:fs';
// 导入来源: node:path；导入内容: dirname、join、resolve；文件作用: 从测试目录定位仓库根 contracts/v2。
import { dirname, join, resolve } from 'node:path';
// 导入来源: node:test；导入内容: test；文件作用: 注册协议单元测试和逐向量子用例。
import test from 'node:test';
// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 将 import.meta.url 转换为测试文件绝对路径。
import { fileURLToPath } from 'node:url';
// 导入来源: ../src/config/proxyPolicy.js；导入内容: HARD_LIMITS、createProxyPolicy、proxyPolicy；文件作用: 验证默认上限与部署收紧规则。
import { HARD_LIMITS, createProxyPolicy, proxyPolicy } from '../src/config/proxyPolicy.js';
// 导入来源: ../src/contracts/proxyProtocol.js；导入内容: PROXY_ERROR_DEFINITIONS；文件作用: 与错误 JSON 向量逐项核对。
import { PROXY_ERROR_DEFINITIONS } from '../src/contracts/proxyProtocol.js';
// 导入来源: ../src/errors/proxyError.js；导入内容: ProxyError、createProxyErrorEnvelope；文件作用: 验证固定错误码和安全响应外壳。
import { ProxyError, createProxyErrorEnvelope } from '../src/errors/proxyError.js';
// 导入来源: ../src/validation/proxyRequestValidator.js；导入内容: validateProxyRequestEnvelope；文件作用: 执行全部请求向量的网络前校验。
import { validateProxyRequestEnvelope } from '../src/validation/proxyRequestValidator.js';

// 类型: string；来源: 当前测试目录向上两级；作用: 定位前后端共享的根契约目录。
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// 类型: string；来源: 仓库根与冻结目录名；作用: 所有测试从同一语言无关向量读取输入。
const CONTRACT_DIRECTORY = join(REPOSITORY_ROOT, 'contracts', 'v2');

/**
 * 读取并解析一个契约 JSON 向量。
 * 调用方: 模块级三组向量初始化。
 * 副作用: 同步读取指定 contracts/v2 文件；不修改向量或源码。
 * 失败路径: 文件缺失、无法读取或 JSON 非法时保留原始异常并阻断测试加载。
 *
 * @param {string} fileName contracts/v2 内的固定文件名。
 * @returns {object} 解析后的向量根对象。
 */
function loadContractVector(fileName) {
  return JSON.parse(readFileSync(join(CONTRACT_DIRECTORY, fileName), 'utf8'));
}

/**
 * 根据非法向量的顶层 patch 创建隔离请求。
 * 调用方: 非法请求逐向量测试。
 * 副作用: 无；structuredClone 创建新对象，不修改 baseRequest 或 patch。
 * 失败路径: 向量包含不可克隆值时抛出 DataCloneError 并暴露夹具缺陷。
 *
 * @param {object} baseRequest 冻结协议的基础合法请求。
 * @param {object} patch 当前非法场景需要覆盖或新增的顶层字段。
 * @returns {object} 与向量引用隔离的测试请求。
 */
function createPatchedRequest(baseRequest, patch) {
  return Object.assign(structuredClone(baseRequest), structuredClone(patch));
}

// 类型: object；来源: proxy-request.valid.json；作用: 每个案例必须通过同一生产校验器。
const VALID_REQUEST_VECTORS = loadContractVector('proxy-request.valid.json');

// 类型: object；来源: proxy-request.invalid.json；作用: 每个案例必须在联网前得到稳定错误码和字段。
const INVALID_REQUEST_VECTORS = loadContractVector('proxy-request.invalid.json');

// 类型: object；来源: proxy-error.valid.json；作用: 防止生产错误映射偏离冻结 HTTP/retryable 语义。
const ERROR_VECTORS = loadContractVector('proxy-error.valid.json');

// 向量不变量: 所有合法 GET/POST 编码组合都必须生成冻结且与输入隔离的网络层对象。
for (const vector of VALID_REQUEST_VECTORS.cases) {
  test(`合法请求向量: ${vector.name}`, () => {
    const input = structuredClone(vector.request);
    const result = validateProxyRequestEnvelope(input, proxyPolicy);

    assert.equal(result.request.protocolVersion, '2.0.0');
    assert.equal(result.request.requestId, vector.request.requestId);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.request), true);
    assert.equal(Object.isFrozen(result.request.target), true);
    assert.equal(Object.isFrozen(result.request.headers), true);
    assert.equal(result.request.headers.every((header) => Object.isFrozen(header)), true);
    assert.equal(Object.isFrozen(result.request.body), true);
    assert.notEqual(result.request, input);
  });
}

// 向量不变量: 每个非法案例必须由生产校验器在执行端口前拒绝，程序判断只依赖 code 和稳定 field。
for (const vector of INVALID_REQUEST_VECTORS.cases) {
  test(`非法请求向量: ${vector.name}`, () => {
    const request = createPatchedRequest(INVALID_REQUEST_VECTORS.baseRequest, vector.patch);

    assert.throws(
      () => validateProxyRequestEnvelope(request, proxyPolicy),
      (error) => {
        assert.equal(error instanceof ProxyError, true);
        assert.equal(error.code, vector.expected.code);
        assert.equal(error.details.field, vector.expected.field);
        return true;
      }
    );
  });
}

// 部署不变量: 环境只能收紧硬上限，客户端声明更大值时仍采用部署值而不是拒绝后回落到隐藏默认值。
test('部署策略只允许收紧，客户端容量只能取更小值', () => {
  const tightenedPolicy = createProxyPolicy({
    PROXY_MAX_UPSTREAM_TIMEOUT_MS: '5000',
    PROXY_MAX_RESPONSE_BYTES: '262144'
  });
  const request = structuredClone(VALID_REQUEST_VECTORS.cases[0].request);
  request.timeoutMs = HARD_LIMITS.upstreamTimeoutMs;
  request.maxResponseBytes = HARD_LIMITS.responseBytes;

  const result = validateProxyRequestEnvelope(request, tightenedPolicy);
  assert.deepEqual(result.effectiveLimits, { timeoutMs: 5000, maxResponseBytes: 262144 });
  assert.throws(
    () => createProxyPolicy({ PROXY_MAX_RESPONSE_BYTES: String(HARD_LIMITS.responseBytes + 1) }),
    RangeError
  );
});

// 跨域部署不变量: 浏览器来源必须是明确 HTTP(S) origin，默认只允许本机前端且部署覆盖不能使用通配或重复值。
test('部署策略严格解析浏览器 CORS 允许源', () => {
  // 类型: Readonly<object>；作用: 保存两个明确生产前端 origin 的部署策略。
  const configuredPolicy = createProxyPolicy({
    PROXY_ALLOWED_ORIGINS: 'https://app.example.com,http://127.0.0.1:5173'
  });

  assert.deepEqual(configuredPolicy.server.allowedOrigins, [
    'https://app.example.com',
    'http://127.0.0.1:5173'
  ]);
  assert.equal(Object.isFrozen(configuredPolicy.server.allowedOrigins), true);
  assert.deepEqual(proxyPolicy.server.allowedOrigins, [
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
    'http://localhost:5173'
  ]);
  assert.throws(
    () => createProxyPolicy({ PROXY_ALLOWED_ORIGINS: '*' }),
    RangeError
  );
  assert.throws(
    () => createProxyPolicy({ PROXY_ALLOWED_ORIGINS: 'https://app.example.com/path' }),
    RangeError
  );
  assert.throws(
    () => createProxyPolicy({ PROXY_ALLOWED_ORIGINS: 'https://app.example.com,https://app.example.com' }),
    RangeError
  );
});

// 隔离不变量: 校验后修改原始头条目不能改变执行器输入，同名头必须继续按原顺序独立存在。
test('有序重复请求头与 HTTP 输入引用隔离', () => {
  const request = structuredClone(VALID_REQUEST_VECTORS.cases.find((vector) => vector.name === 'https-get-with-ordered-headers').request);
  const result = validateProxyRequestEnvelope(request, proxyPolicy);

  request.headers[1].value = 'changed-after-validation';
  assert.deepEqual(result.request.headers, [
    { name: 'accept', value: 'application/json' },
    { name: 'cookie', value: 'a=1' },
    { name: 'cookie', value: 'b=2' }
  ]);
  assert.equal(Object.isFrozen(result.request.headers[1]), true);
});

// 错误不变量: JSON 向量、生产映射和输出外壳必须覆盖完全相同的固定错误集合。
test('全部代理错误码保持稳定 HTTP 状态、retryable 和安全外壳', () => {
  assert.deepEqual(ERROR_VECTORS.cases.map((vector) => vector.code).sort(), Object.keys(PROXY_ERROR_DEFINITIONS).sort());

  for (const vector of ERROR_VECTORS.cases) {
    const result = createProxyErrorEnvelope(new ProxyError(vector.code, { details: { field: 'test', reason: 'vector' } }), 'request-error');
    assert.equal(result.statusCode, vector.httpStatus);
    assert.equal(result.body.protocolVersion, '2.0.0');
    assert.equal(result.body.requestId, 'request-error');
    assert.equal(result.body.error.code, vector.code);
    assert.equal(result.body.error.retryable, vector.retryable);
    assert.equal(Object.hasOwn(result.body, 'stack'), false);
  }
});
