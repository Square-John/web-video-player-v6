/*
  proxy-executor.test.js 模块说明

  - 文件职责:
      使用受控解析器和单跳传输端口验证 ProxyExecutor 的原始响应、重定向、容量、媒体、超时和中止事务。
      测试走真实请求校验、头体运输和响应流编码，但不建立 TLS、不解析真实 DNS，也不访问公网。

  - 导入库及文件汇总(10 条，内置 6 条，第三方 0 条，自定义 4 条):
      node:assert/strict: 核对协议外壳、调用顺序、资源释放和固定错误码。
      node:fs#readFileSync: 读取请求与响应语言无关向量。
      node:path: 从测试文件定位仓库根 contracts/v2。
      node:stream#Readable: 创建可逐块消费和销毁的受控上游 body。
      node:test#test: 注册隔离执行事务用例。
      node:url#fileURLToPath: 把测试模块 URL 转为文件路径。
      ../src/config/proxyPolicy.js#proxyPolicy: 提供与生产一致的集中限制。
      ../src/errors/proxyError.js#ProxyError: 验证代理失败只依赖固定 code。
      ../src/proxy/proxyExecutor.js#createProxyExecutor: 创建待验证的真实事务编排器。
      ../src/validation/proxyRequestValidator.js#validateProxyRequestEnvelope: 生成执行器唯一允许消费的冻结输入。

  - 模块级常量:
      CONTRACT_DIRECTORY: string，共享语言无关向量目录。
      VALID_REQUEST_VECTORS: object，合法请求夹具集合。
      VALID_RESPONSE_VECTORS: object，合法响应期望集合。
      PUBLIC_TEST_ADDRESS: Readonly<object>，受控解析端口使用的公网单播连接描述。

  - 模块级变量:
      无

  - 模块级辅助函数:
      loadContractVector(fileName): 读取并解析共享 JSON 向量。
      findRequestVector(name): 返回指定合法请求的隔离副本。
      findResponseVector(name): 返回指定响应期望的隔离副本。
      createMemoryBody(chunks): 创建按给定字节块输出的 Readable。
      createValidatedRequest(options): 基于合法向量生成真实校验结果。
      createExecutorScenario(responses): 创建记录解析、传输、释放和日志事实的执行器场景。
      getRequestHeaderValues(headers, name): 按顺序读取当前跳请求头值。
      assertProxyErrorCode(error, code): 核对固定 ProxyError code。

  - 模块级类:
      无

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证执行结果、错误和调用事实。
import assert from 'node:assert/strict';
// 导入来源: node:fs；导入内容: readFileSync；文件作用: 读取根目录共享请求与响应向量。
import { readFileSync } from 'node:fs';
// 导入来源: node:path；导入内容: dirname、join、resolve；文件作用: 从 server/tests 定位 contracts/v2。
import { dirname, join, resolve } from 'node:path';
// 导入来源: node:stream；导入内容: Readable；文件作用: 构造真实异步可迭代 body 并支持超限销毁。
import { Readable } from 'node:stream';
// 导入来源: node:test；导入内容: test；文件作用: 注册相互隔离的异步事务测试。
import test from 'node:test';
// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 把 import.meta.url 转为测试目录路径。
import { fileURLToPath } from 'node:url';
// 导入来源: ../src/config/proxyPolicy.js；导入内容: proxyPolicy；文件作用: 请求校验和执行器共享生产限制形状。
import { proxyPolicy } from '../src/config/proxyPolicy.js';
// 导入来源: ../src/errors/proxyError.js；导入内容: ProxyError；文件作用: 确认失败归一到冻结代理错误。
import { ProxyError } from '../src/errors/proxyError.js';
// 导入来源: ../src/proxy/proxyExecutor.js；导入内容: createProxyExecutor；文件作用: 创建真实安全事务编排器。
import { createProxyExecutor } from '../src/proxy/proxyExecutor.js';
// 导入来源: ../src/validation/proxyRequestValidator.js；导入内容: validateProxyRequestEnvelope；文件作用: 使用真实网络前门禁生成执行输入。
import { validateProxyRequestEnvelope } from '../src/validation/proxyRequestValidator.js';

// 类型: string；来源: 当前测试目录向上两级；作用: 定位前后端共享语言无关协议向量。
const CONTRACT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'v2');

/**
 * 读取并解析一个共享契约向量。
 * 调用方: 模块级请求和响应向量初始化。
 * 副作用: 同步读取指定 JSON 文件；不修改向量。
 * 失败路径: 文件缺失、无法读取或 JSON 非法时保留原始异常并阻断测试加载。
 *
 * @param {string} fileName contracts/v2 内固定文件名。
 * @returns {object} 解析后的向量根对象。
 */
function loadContractVector(fileName) {
  return JSON.parse(readFileSync(join(CONTRACT_DIRECTORY, fileName), 'utf8'));
}

// 类型: object；来源: proxy-request.valid.json；作用: 每个场景从已冻结合法组合生成隔离请求。
const VALID_REQUEST_VECTORS = loadContractVector('proxy-request.valid.json');

// 类型: object；来源: proxy-response.valid.json；作用: 执行器输出直接与语言无关成功外壳比较。
const VALID_RESPONSE_VECTORS = loadContractVector('proxy-response.valid.json');

// 类型: Readonly<object>；来源: 公网单播测试样例；作用: 受控解析端口只表达已审连接候选，不建立真实连接。
const PUBLIC_TEST_ADDRESS = Object.freeze({ address: '93.184.216.34', family: 4 });

/**
 * 返回指定合法请求向量的隔离副本。
 * 调用方: createValidatedRequest。
 * 副作用: 无；structuredClone 防止测试修改共享向量。
 * 失败路径: 名称不存在时抛 Error 暴露夹具缺失。
 *
 * @param {string} name proxy-request.valid.json 案例名。
 * @returns {object} 隔离请求对象。
 * @throws {Error} 找不到案例时抛出。
 */
function findRequestVector(name) {
  const vector = VALID_REQUEST_VECTORS.cases.find((candidate) => candidate.name === name);
  if (!vector) {
    throw new Error(`缺少请求向量: ${name}`);
  }
  return structuredClone(vector.request);
}

/**
 * 返回指定合法响应向量的隔离副本。
 * 调用方: 响应向量循环测试。
 * 副作用: 无；structuredClone 防止断言修改共享期望。
 * 失败路径: 名称不存在时抛 Error 暴露夹具缺失。
 *
 * @param {string} name proxy-response.valid.json 案例名。
 * @returns {object} 隔离响应外壳。
 * @throws {Error} 找不到案例时抛出。
 */
function findResponseVector(name) {
  const vector = VALID_RESPONSE_VECTORS.cases.find((candidate) => candidate.name === name);
  if (!vector) {
    throw new Error(`缺少响应向量: ${name}`);
  }
  return structuredClone(vector.response);
}

/**
 * 创建一个按顺序输出指定字节块的上游响应流。
 * 调用方: createExecutorScenario。
 * 副作用: 创建 Readable；消费、销毁和释放由真实响应编码器与执行器负责。
 * 失败路径: Buffer.from 无法转换夹具值时抛出并暴露测试数据缺陷。
 *
 * @param {ReadonlyArray<string|Uint8Array>} chunks 依次输出的 UTF-8 文本或字节块。
 * @returns {Readable} 可异步迭代并支持 destroy 的响应 body。
 */
function createMemoryBody(chunks) {
  return Readable.from(chunks.map((chunk) => (typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : Buffer.from(chunk))));
}

/**
 * 基于合法请求向量创建真实校验结果。
 * 调用方: 本文件所有执行器用例。
 * 副作用: 无；只修改隔离请求并调用生产校验器。
 * 失败路径: patch 使请求非法时保留 ProxyError 并让用例失败。
 *
 * @param {object} options 请求场景。
 * @param {string} [options.vectorName='https-get-with-ordered-headers'] 基础合法向量名。
 * @param {object} [options.patch={}] 顶层覆盖字段。
 * @param {object} [options.target] 可选完整 target 覆盖。
 * @param {object} [options.headers] 可选完整 headers 覆盖。
 * @returns {Readonly<object>} validateProxyRequestEnvelope 冻结结果。
 */
function createValidatedRequest({ vectorName = 'https-get-with-ordered-headers', patch = {}, target, headers } = {}) {
  const request = findRequestVector(vectorName);
  Object.assign(request, structuredClone(patch));
  if (target) {
    request.target = structuredClone(target);
  }
  if (headers) {
    request.headers = structuredClone(headers);
  }
  return validateProxyRequestEnvelope(request, proxyPolicy);
}

/**
 * 创建使用受控解析和传输端口的 ProxyExecutor 场景。
 * 调用方: 响应、重定向和失败测试。
 * 状态所有权: responses 队列、解析/请求/释放/日志记录只属于当前场景对象。
 * 状态释放: 每个上游响应的 release 由真实执行器 finally 调用，记录次数供断言。
 * 失败路径: 响应队列耗尽时抛 Error，由执行器失败关闭并让测试暴露夹具缺失。
 *
 * @param {ReadonlyArray<object>} responses 按调用顺序提供的受控单跳响应描述。
 * @returns {Readonly<object>} execute 与四类调用事实数组。
 */
function createExecutorScenario(responses) {
  // 类型: Array<object>；生命周期: 当前场景；作用: 每次 requestUpstream shift 一个隔离响应描述。
  const responseQueue = responses.map((response) => structuredClone(response));
  // 类型: Array<string>；生命周期: 当前场景；作用: 证明初始与每次重定向都重新调用解析器。
  const resolvedUrls = [];
  // 类型: Array<object>；生命周期: 当前场景；作用: 检查每跳方法、头、body、signal 和 URL。
  const upstreamCalls = [];
  // 类型: Array<number>；生命周期: 当前场景；作用: 每次 release 追加当前跳序号，证明 finally 清理完整。
  const releasedHops = [];
  // 类型: Array<object>；生命周期: 当前场景；作用: 记录成功/失败摘要字段且不写 stdout。
  const auditEvents = [];
  const targetResolver = Object.freeze({
    // 回调: 返回受控公网描述但不建立连接；每次调用保留 URL 顺序供重定向复查断言。
    resolveTarget: async (url, signal) => {
      signal.throwIfAborted();
      resolvedUrls.push(url);
      const parsedUrl = new URL(url);
      return Object.freeze({
        url: parsedUrl.href,
        hostname: parsedUrl.hostname,
        addresses: Object.freeze([PUBLIC_TEST_ADDRESS])
      });
    }
  });
  const upstreamTransport = Object.freeze({
    // 回调: 不访问网络，返回真实 Readable 与幂等 release，其他参数由生产执行器构造。
    requestUpstream: async (requestOptions) => {
      const response = responseQueue.shift();
      if (!response) {
        throw new Error('受控上游响应队列已耗尽');
      }

      upstreamCalls.push(requestOptions);
      const hopIndex = upstreamCalls.length;
      const body = createMemoryBody(response.chunks ?? []);
      let released = false;
      return Object.freeze({
        statusCode: response.statusCode,
        statusText: response.statusText,
        rawHeaders: response.rawHeaders ?? [],
        body,
        // 回调: 模拟传输层 release；首次调用销毁未消费 body 并记录跳号，后续调用无操作。
        release: async () => {
          if (released) {
            return;
          }
          released = true;
          if (body.destroyed !== true) {
            body.destroy();
          }
          releasedHops.push(hopIndex);
        }
      });
    }
  });
  const auditLogger = Object.freeze({
    // 回调: 保存允许字段供断言，不序列化 URL、头或 body。
    recordSuccess: (summary) => auditEvents.push({ type: 'success', ...summary }),
    // 回调: 保存固定 errorCode 供断言，不保存 Error 或 details。
    recordFailure: (summary) => auditEvents.push({ type: 'failure', ...summary })
  });
  const execute = createProxyExecutor({ policy: proxyPolicy, targetResolver, upstreamTransport, auditLogger });

  return Object.freeze({ execute, resolvedUrls, upstreamCalls, releasedHops, auditEvents });
}

/**
 * 按顺序读取当前上游跳的指定请求头值。
 * 调用方: 重定向测试核对同源保留和跨源凭证删除。
 * 副作用: 无；返回新数组，不修改执行器记录的冻结头条目。
 * 失败路径: 无；不存在时返回空数组。
 *
 * @param {ReadonlyArray<Readonly<{ name: string, value: string }>>} headers 当前跳请求头。
 * @param {string} name 待查询头名称。
 * @returns {Array<string>} 与运输顺序一致的全部值。
 */
function getRequestHeaderValues(headers, name) {
  const normalizedName = name.toLowerCase();
  return headers.filter((header) => header.name === normalizedName).map((header) => header.value);
}

/**
 * 确认执行失败是指定固定代理错误。
 * 调用方: assert.rejects 回调。
 * 副作用: 无；只读取异常类型和 code。
 * 失败路径: 不一致时由 assert 抛 AssertionError。
 *
 * @param {unknown} error 当前 reject 原因。
 * @param {string} code 期望冻结错误码。
 * @returns {true} 供 assert.rejects 判定。
 */
function assertProxyErrorCode(error, code) {
  assert.equal(error instanceof ProxyError, true);
  assert.equal(error.code, code);
  return true;
}

// 响应契约: JSON 外观字节、重复头、上游 503 和空正文必须生成与 Proxy 2.0 向量完全相同的外壳。
test('ProxyExecutor 生成全部合法响应向量', async () => {
  const cases = [
    {
      responseName: 'raw-json-looking-bytes-with-duplicate-headers',
      requestOptions: {
        patch: { requestId: 'response-json-looking' },
        target: { url: 'https://example.com/resource', method: 'GET' }
      },
      upstream: {
        statusCode: 200,
        statusText: 'OK',
        rawHeaders: [
          'content-type', 'application/json',
          'set-cookie', 'a=1; Path=/',
          'set-cookie', 'b=2; Path=/'
        ],
        chunks: ['{"ok":true}']
      }
    },
    {
      responseName: 'html-upstream-503-is-successful-transport',
      requestOptions: {
        patch: { requestId: 'response-html-503' },
        target: { url: 'https://example.com/resource', method: 'GET' }
      },
      upstream: {
        statusCode: 503,
        statusText: 'Service Unavailable',
        rawHeaders: ['content-type', 'text/html; charset=utf-8'],
        chunks: ['<html>error</html>']
      }
    },
    {
      responseName: 'empty-upstream-body',
      requestOptions: {
        patch: { requestId: 'response-empty' },
        target: { url: 'https://example.com/empty', method: 'GET' }
      },
      upstream: {
        statusCode: 204,
        statusText: 'No Content',
        rawHeaders: [],
        chunks: []
      }
    }
  ];

  for (const testCase of cases) {
    const scenario = createExecutorScenario([testCase.upstream]);
    const validatedRequest = createValidatedRequest(testCase.requestOptions);
    const response = await scenario.execute(validatedRequest, Object.freeze({ signal: new AbortController().signal }));

    assert.deepEqual(response, findResponseVector(testCase.responseName));
    assert.equal(Object.isFrozen(response), true);
    assert.deepEqual(scenario.releasedHops, [1]);
    assert.equal(scenario.auditEvents[0].type, 'success');
  }
});

// 原始运输不变量: 正文外观、字符编码和压缩声明都不能触发代理业务解码，返回值必须逐字节可逆。
test('非法 JSON、BOM、非 UTF-8、二进制和压缩响应保持原始字节', async () => {
  const cases = [
    { name: 'invalid-json', headers: ['content-type', 'application/json'], bytes: Buffer.from('not-json', 'utf8') },
    { name: 'utf8-bom', headers: ['content-type', 'text/plain'], bytes: Buffer.from([0xef, 0xbb, 0xbf, 0x61]) },
    { name: 'non-utf8', headers: ['content-type', 'text/plain'], bytes: Buffer.from([0xff, 0xfe, 0xfd]) },
    { name: 'binary', headers: ['content-type', 'application/octet-stream'], bytes: Buffer.from([0x00, 0x01, 0x80, 0xff]) },
    { name: 'compressed', headers: ['content-encoding', 'gzip', 'content-type', 'application/json'], bytes: Buffer.from([0x1f, 0x8b, 0x08, 0x00]) }
  ];

  for (const testCase of cases) {
    const scenario = createExecutorScenario([{
      statusCode: 200,
      statusText: 'OK',
      rawHeaders: testCase.headers,
      chunks: [testCase.bytes]
    }]);
    const request = createValidatedRequest({
      patch: { requestId: `raw-${testCase.name}` },
      target: { url: `https://example.com/${testCase.name}`, method: 'GET' }
    });
    const response = await scenario.execute(request, Object.freeze({ signal: new AbortController().signal }));

    assert.deepEqual(response.body, { encoding: 'base64', data: testCase.bytes.toString('base64') });
    assert.equal(response.meta.receivedBytes, testCase.bytes.byteLength);
    assert.deepEqual(scenario.releasedHops, [1]);
    assert.equal(scenario.auditEvents[0].type, 'success');
  }
});

// 重定向事务: POST 经 302 跨 origin 后改 GET、丢弃 body 和凭证；每跳重新解析并释放独立响应资源。
test('跨 origin 302 逐跳复查并删除 POST body 与凭证', async () => {
  const scenario = createExecutorScenario([
    {
      statusCode: 302,
      statusText: 'Found',
      rawHeaders: ['location', 'https://other.example/next'],
      chunks: ['redirect-body-must-not-be-downloaded']
    },
    {
      statusCode: 200,
      statusText: 'OK',
      rawHeaders: ['content-type', 'text/plain'],
      chunks: ['done']
    }
  ]);
  const validatedRequest = createValidatedRequest({
    vectorName: 'https-post-utf8-json-text',
    target: { url: 'https://origin.example/start', method: 'POST' },
    headers: [
      { name: 'authorization', value: 'Bearer secret' },
      { name: 'cookie', value: 'session=secret' },
      { name: 'content-type', value: 'application/json' }
    ]
  });
  const response = await scenario.execute(validatedRequest, Object.freeze({ signal: new AbortController().signal }));

  assert.deepEqual(scenario.resolvedUrls, ['https://origin.example/start', 'https://other.example/next']);
  assert.equal(scenario.upstreamCalls[0].method, 'POST');
  assert.equal(Buffer.isBuffer(scenario.upstreamCalls[0].body), true);
  assert.deepEqual(getRequestHeaderValues(scenario.upstreamCalls[0].headers, 'authorization'), ['Bearer secret']);
  assert.equal(scenario.upstreamCalls[1].method, 'GET');
  assert.equal(scenario.upstreamCalls[1].body, undefined);
  assert.deepEqual(getRequestHeaderValues(scenario.upstreamCalls[1].headers, 'authorization'), []);
  assert.deepEqual(getRequestHeaderValues(scenario.upstreamCalls[1].headers, 'cookie'), []);
  assert.deepEqual(getRequestHeaderValues(scenario.upstreamCalls[1].headers, 'content-type'), []);
  assert.deepEqual(scenario.releasedHops, [1, 2]);
  assert.equal(response.meta.redirectCount, 1);
  assert.deepEqual(response.body, { encoding: 'base64', data: Buffer.from('done', 'utf8').toString('base64') });
});

// 重定向事务: 307 同 origin 必须保留 POST 方法、同一已校验 body 和凭证，不重新编码或丢失实体。
test('同 origin 307 保留 POST 方法、body 和凭证', async () => {
  const scenario = createExecutorScenario([
    { statusCode: 307, statusText: 'Temporary Redirect', rawHeaders: ['location', '/next'], chunks: [] },
    { statusCode: 200, statusText: 'OK', rawHeaders: ['content-type', 'text/plain'], chunks: ['kept'] }
  ]);
  const validatedRequest = createValidatedRequest({
    vectorName: 'https-post-utf8-json-text',
    target: { url: 'https://origin.example/start', method: 'POST' },
    headers: [
      { name: 'authorization', value: 'Bearer secret' },
      { name: 'content-type', value: 'text/plain' }
    ]
  });
  await scenario.execute(validatedRequest, Object.freeze({ signal: new AbortController().signal }));

  assert.equal(scenario.upstreamCalls[1].method, 'POST');
  assert.equal(scenario.upstreamCalls[1].body, scenario.upstreamCalls[0].body);
  assert.deepEqual(getRequestHeaderValues(scenario.upstreamCalls[1].headers, 'authorization'), ['Bearer secret']);
  assert.deepEqual(scenario.resolvedUrls, ['https://origin.example/start', 'https://origin.example/next']);
});

// 响应失败: 容量和通用媒体类型属于代理运输边界，必须销毁当前流并返回各自稳定错误码。
test('容量和媒体响应按固定错误码失败关闭', async () => {
  const cases = [
    {
      request: createValidatedRequest({ patch: { maxResponseBytes: 3 } }),
      upstream: { statusCode: 200, statusText: 'OK', rawHeaders: ['content-length', '4'], chunks: ['abcd'] },
      expectedCode: 'PROXY_RESPONSE_TOO_LARGE'
    },
    {
      request: createValidatedRequest(),
      upstream: { statusCode: 200, statusText: 'OK', rawHeaders: ['content-type', 'video/mp4'], chunks: [Uint8Array.from([1])] },
      expectedCode: 'PROXY_TARGET_FORBIDDEN'
    }
  ];

  for (const testCase of cases) {
    const scenario = createExecutorScenario([testCase.upstream]);
    await assert.rejects(
      () => scenario.execute(testCase.request, Object.freeze({ signal: new AbortController().signal })),
      (error) => assertProxyErrorCode(error, testCase.expectedCode)
    );
    assert.deepEqual(scenario.releasedHops, [1]);
    assert.equal(scenario.auditEvents[0].type, 'failure');
    assert.equal(scenario.auditEvents[0].errorCode, testCase.expectedCode);
  }
});

// 取消边界: 已中止客户端不能进入解析器；总 timeout 覆盖 DNS 等待并稳定映射为上游超时。
test('客户端中止和总事务超时使用不同固定错误码', async () => {
  const abortedScenario = createExecutorScenario([]);
  const abortedController = new AbortController();
  abortedController.abort();
  await assert.rejects(
    () => abortedScenario.execute(createValidatedRequest(), Object.freeze({ signal: abortedController.signal })),
    (error) => assertProxyErrorCode(error, 'PROXY_REQUEST_ABORTED')
  );
  assert.deepEqual(abortedScenario.resolvedUrls, []);

  const timeoutAuditEvents = [];
  const waitingResolver = Object.freeze({
    // 回调: 不使用固定等待；只在生产 AbortSignal.timeout 中止时 reject 其 reason。
    resolveTarget: async (url, signal) => {
      void url;
      return new Promise((resolve, reject) => {
        void resolve;
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
  });
  const timeoutExecutor = createProxyExecutor({
    policy: proxyPolicy,
    targetResolver: waitingResolver,
    // 回调: 若总超时没有在解析阶段生效则立即暴露错误，绝不执行真实网络。
    upstreamTransport: Object.freeze({ requestUpstream: async () => { throw new Error('不应进入传输'); } }),
    auditLogger: Object.freeze({
      // 回调: 超时用例不允许成功，空实现不会写 stdout 或保存状态。
      recordSuccess: () => {},
      // 回调: 只保存固定失败摘要供 errorCode 断言。
      recordFailure: (summary) => timeoutAuditEvents.push(summary)
    })
  });
  const timeoutRequest = createValidatedRequest({ patch: { timeoutMs: 5 } });
  await assert.rejects(
    () => timeoutExecutor(timeoutRequest, Object.freeze({ signal: new AbortController().signal })),
    (error) => assertProxyErrorCode(error, 'PROXY_UPSTREAM_TIMEOUT')
  );
  assert.equal(timeoutAuditEvents[0].errorCode, 'PROXY_UPSTREAM_TIMEOUT');
});
