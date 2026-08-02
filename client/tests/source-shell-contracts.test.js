/*
  source-shell-contracts.test.js 模块说明

  - 文件职责:
      验证 Source Shell 枚举、策略、错误和共享验证器的精确输入、容量、中止及引用隔离契约。

  - 导入库及文件汇总(5 条，内置 2 条，第三方 0 条，自定义 3 条):
      assert: 内置模块，执行严格结构、错误和引用隔离断言。
      test: 内置模块，注册 Node 领域测试。
      Shell config 导出: 自定义配置，验证枚举和策略冻结。
      Shell error 导出: 自定义错误，验证稳定 code 与 cause。
      Shell validator 导出: 自定义验证器，验证网络、挑战、日志和中止边界。

  - 模块级常量:
      SHELL_TEST_SOURCE_ID: string，测试 SourceContext 绑定数据源 id。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createNetworkRequest(overrides): Function，创建完整标准网络请求。
      createChallenge(overrides): Function，创建完整标准挑战输入。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 比较枚举、规范化结果、引用隔离和稳定错误。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册 Source Shell 契约测试。
import test from 'node:test';

import {
  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_CHALLENGE_STATUS 挑战结果枚举。
  // 文件作用: 验证步骤 5 不提前提供 resolved。
  SOURCE_CHALLENGE_STATUS,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_LOG_LEVEL 日志级别枚举。
  // 文件作用: 验证 SourceLogger 公开级别稳定。
  SOURCE_LOG_LEVEL,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_LOGGER_POLICY 日志容量策略。
  // 文件作用: 构造消息和 details 超限输入。
  SOURCE_LOGGER_POLICY,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_METHOD 网络方法枚举。
  // 文件作用: 创建合法 GET/POST 请求并验证集合冻结。
  SOURCE_NETWORK_METHOD,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_POLICY 网络容量策略。
  // 文件作用: 构造 timeout、响应大小和请求体边界输入。
  SOURCE_NETWORK_POLICY,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_BODY_ENCODING 请求体运输编码枚举。
  // 文件作用: 创建合法 none/utf8/base64 请求并拒绝未知编码。
  SOURCE_NETWORK_BODY_ENCODING,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_SENSITIVE_KEYS 敏感键集合。
  // 文件作用: 验证配置冻结且包含网络和日志关键敏感字段。
  SOURCE_SENSITIVE_KEYS
} from '../src/runtime/source-shell/source-shell.config.js';

import {
  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SOURCE_SHELL_ERROR_CODE Shell 错误码。
  // 文件作用: 断言错误 code 不依赖文案。
  SOURCE_SHELL_ERROR_CODE,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellAbortedError 生命周期中止错误。
  // 文件作用: 验证 aborted 门禁。
  SourceShellAbortedError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellLimitError 容量超限错误。
  // 文件作用: 验证 URL、body、timeout 和日志容量分类。
  SourceShellLimitError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellOperationError 操作错误。
  // 文件作用: 验证原始基础设施 cause 保留。
  SourceShellOperationError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellValidationError 输入契约错误。
  // 文件作用: 验证字段、类型、跨源和危险键拒绝。
  SourceShellValidationError
} from '../src/runtime/source-shell/sourceShellErrors.js';

import {
  // 导入来源: ../src/runtime/source-shell/sourceShellValidators.js。
  // 导入内容: assertAbortSignal AbortSignal 结构校验。
  // 文件作用: 拒绝普通对象伪造生命周期信号。
  assertAbortSignal,

  // 导入来源: ../src/runtime/source-shell/sourceShellValidators.js。
  // 导入内容: assertExactArgumentCount 精确参数数量校验。
  // 文件作用: 验证未来 Storage 门面拒绝额外 sourceId。
  assertExactArgumentCount,

  // 导入来源: ../src/runtime/source-shell/sourceShellValidators.js。
  // 导入内容: assertNotAborted 中止门禁。
  // 文件作用: 验证中止后能力调用使用稳定 aborted 错误。
  assertNotAborted,

  // 导入来源: ../src/runtime/source-shell/sourceShellValidators.js。
  // 导入内容: normalizeSourceChallenge 挑战规范化函数。
  // 文件作用: 验证 sourceId、ISO 时间和 fields 引用隔离。
  normalizeSourceChallenge,

  // 导入来源: ../src/runtime/source-shell/sourceShellValidators.js。
  // 导入内容: normalizeSourceLogInput 日志输入规范化函数。
  // 文件作用: 验证消息和详情容量及引用隔离。
  normalizeSourceLogInput,

  // 导入来源: ../src/runtime/source-shell/sourceShellValidators.js。
  // 导入内容: normalizeSourceNetworkRequest 网络请求规范化函数。
  // 文件作用: 验证精确字段、身份、方法、URL、容量和引用隔离。
  normalizeSourceNetworkRequest,

  // 导入来源: ../src/runtime/source-shell/sourceShellValidators.js。
  // 导入内容: normalizeSourceShellId 安全 sourceId 校验。
  // 文件作用: 验证危险动态键拒绝。
  normalizeSourceShellId
} from '../src/runtime/source-shell/sourceShellValidators.js';

// 类型: string。
// 作用: 全部 Shell 契约测试使用的绑定 sourceId，避免跨测试散落身份字符串。
const SHELL_TEST_SOURCE_ID = 'system-source-1';

/**
 * 创建完整标准网络请求。
 * 纯函数: 返回新对象和新 headers/body，不与 overrides 之外的测试共享引用。
 *
 * @param {object} overrides 需要覆盖的请求字段。
 * @returns {object} 完整 SourceNetworkRequest 候选。
 * @returns {string} return.sourceId 请求所属数据源身份。
 * @returns {string} return.requestId 请求和响应关联标识。
 * @returns {string} return.url 待规范化 HTTPS 地址。
 * @returns {string} return.method GET/POST 方法候选。
 * @returns {Array<object>} return.headers 有序多值请求头候选。
 * @returns {object} return.body 请求体运输描述候选。
 * @returns {number} return.timeout 超时毫秒候选。
 * @returns {number} return.maxResponseBytes 响应字节上限候选。
 */
function createNetworkRequest(overrides = {}) {
  return {
    // 类型: string。
    // 作用: 默认与测试 Context 绑定身份一致，跨源用例通过 overrides 替换。
    sourceId: SHELL_TEST_SOURCE_ID,

    // 类型: string。
    // 作用: 提供稳定请求关联标识，验证器必须按值保留。
    requestId: 'shell-request-001',

    // 类型: string。
    // 作用: 提供合法 HTTPS 地址，协议和长度用例通过 overrides 替换。
    url: 'https://invalid/api/content',

    // 类型: string。
    // 作用: 默认使用允许携带 JSON body 的 POST 方法。
    method: SOURCE_NETWORK_METHOD.post,

    // 类型: object。
    // 作用: 提供待小写规范化的普通请求头对象。
    headers: [{ name: 'x-source-client', value: 'web-video-player' }],

    // 类型: object。
    // 作用: 提供已由 Provider 序列化的 UTF-8 请求体。
    body: { encoding: SOURCE_NETWORK_BODY_ENCODING.utf8, data: '{"page":1}' },

    // 类型: number。
    // 作用: 提供集中策略范围内的合法超时毫秒数。
    timeout: 5000,

    // 类型: number。
    // 作用: 提供集中策略范围内的 1 MiB 响应上限。
    maxResponseBytes: 1048576,

    // 展开来源: 当前测试传入的局部请求字段。
    // 作用: 只改变目标用例所需条件，保持其他请求字段完整。
    ...overrides
  };
}

/**
 * 创建完整标准挑战输入。
 * 纯函数: 返回新对象和新 fields 数组，不修改 overrides。
 *
 * @param {object} overrides 需要覆盖的挑战字段。
 * @returns {object} 完整 SourceChallenge 候选。
 * @returns {string} return.challengeId 挑战请求关联标识。
 * @returns {string} return.sourceId 挑战所属数据源身份。
 * @returns {string} return.type 挑战类型候选。
 * @returns {string} return.title 未来弹窗标题候选。
 * @returns {string} return.image 挑战图片地址占位。
 * @returns {Array<object>} return.fields 挑战输入字段声明。
 * @returns {string} return.expiresAt 标准 ISO 到期时间候选。
 * @returns {string} return.contextKey 私有空间续接键候选。
 */
function createChallenge(overrides = {}) {
  return {
    // 类型: string。
    // 作用: 提供稳定挑战请求标识，供未来结果关联。
    challengeId: 'challenge-001',

    // 类型: string。
    // 作用: 默认与测试 Context 身份一致，跨源用例通过 overrides 替换。
    sourceId: SHELL_TEST_SOURCE_ID,

    // 类型: string。
    // 作用: 提供非空验证码挑战类型，验证器不解释页面交互。
    type: 'captcha',

    // 类型: string。
    // 作用: 提供未来挑战弹窗可使用的标题文本。
    title: '请输入验证码',

    // 类型: string。
    // 作用: 使用空字符串表示当前挑战没有图片地址。
    image: '',

    // 类型: Array<object>。
    // 作用: 提供待严格 JSON 校验和隔离的验证码字段声明。
    fields: [{
      // 类型: string。
      // 作用: 标识未来挑战输入结果中的验证码字段键。
      name: 'code',

      // 类型: string。
      // 作用: 标识根级 UI 使用普通文本输入控件承载该字段。
      type: 'text',

      // 类型: string。
      // 作用: 提供根级挑战弹窗显示的字段名称。
      label: '验证码',

      // 类型: boolean。
      // 作用: true 要求用户提交非空字符串后才能产生 resolved 结果。
      required: true,

      // 类型: string。
      // 作用: 提供输入框为空时的用户提示。
      placeholder: '请输入验证码'
    }],

    // 类型: string。
    // 作用: 提供标准 UTC ISO 到期时间，非法时间用例通过 overrides 替换。
    expiresAt: '2026-07-16T02:00:00.000Z',

    // 类型: string。
    // 作用: 提供 Provider 私有空间中的最小会话续接键。
    contextKey: 'challenge-session',

    // 展开来源: 当前测试传入的局部挑战字段。
    // 作用: 只改变目标用例条件，保持其余精确字段完整。
    ...overrides
  };
}

// 测试目的: Shell 枚举、策略和错误码必须冻结且只包含正式契约允许值。
test('Source Shell 枚举策略和错误码完整且被冻结', () => {
  // 断言作用: 四组枚举只包含正式契约允许值，不加入隐式方法、响应、挑战或日志状态。
  assert.deepEqual(Object.values(SOURCE_NETWORK_METHOD), ['GET', 'POST']);
  assert.deepEqual(Object.values(SOURCE_NETWORK_BODY_ENCODING), ['none', 'utf8', 'base64']);
  assert.deepEqual(Object.values(SOURCE_CHALLENGE_STATUS), ['resolved', 'unsupported', 'cancelled']);
  assert.deepEqual(Object.values(SOURCE_LOG_LEVEL), ['debug', 'info', 'warn', 'error']);

  // 断言作用: 枚举、策略和敏感键集合全部冻结，调用方不能在运行时改变全局安全边界。
  assert.equal(Object.isFrozen(SOURCE_NETWORK_METHOD), true);
  assert.equal(Object.isFrozen(SOURCE_NETWORK_POLICY), true);
  assert.equal(Object.isFrozen(SOURCE_LOGGER_POLICY), true);
  assert.equal(Object.isFrozen(SOURCE_SENSITIVE_KEYS), true);

  // 断言作用: 六类错误码数量和值均唯一，调用方可以稳定依赖 code 而不是中文 message。
  assert.equal(Object.values(SOURCE_SHELL_ERROR_CODE).length, 6);
  assert.equal(new Set(Object.values(SOURCE_SHELL_ERROR_CODE)).size, 6);

  // 断言作用: 敏感键至少覆盖认证头和会话 Cookie，后续 Logger 脱敏不能遗漏核心凭据。
  assert.equal(SOURCE_SENSITIVE_KEYS.includes('authorization'), true);
  assert.equal(SOURCE_SENSITIVE_KEYS.includes('cookie'), true);
});

// 测试目的: Shell operation 错误必须保留原始基础设施 cause，并使用稳定 code。
test('Source Shell 错误类型保留稳定 code 和 cause', () => {
  // 类型: Error。
  // 作用: 模拟未来 Repository 或适配器底层失败。
  const cause = new Error('shell dependency failed');

  // 类型: SourceShellOperationError。
  // 作用: 包装原始失败，调用方可以沿 cause 链诊断。
  const error = new SourceShellOperationError('Shell 操作失败', cause);

  // 断言作用: operation 错误同时保留稳定 code、原始 cause 和具体子类名称。
  assert.equal(error.code, SOURCE_SHELL_ERROR_CODE.operation);
  assert.equal(error.cause, cause);
  assert.equal(error.name, 'SourceShellOperationError');
});

// 测试目的: 合法网络请求必须规范化 URL/header 并隔离 Provider 的 headers 和 body 引用。
test('SourceNetworkRequest 返回精确字段和隔离输入', () => {
  // 类型: object。
  // 作用: 保存调用方持有的合法网络请求对象。
  const request = createNetworkRequest({
    headers: [
      { name: 'Authorization', value: 'Bearer test' },
      { name: 'X-Trace-Id', value: 'trace-001' }
    ],
    body: { encoding: 'utf8', data: '{"filters":{"genre":"action"}}' }
  });

  // 类型: object。
  // 作用: 保存验证器返回的隔离冻结请求。
  const normalized = normalizeSourceNetworkRequest(request, SHELL_TEST_SOURCE_ID);

  // 断言作用: 规范化请求只能包含契约九字段，顺序稳定且没有保留额外输入。
  assert.deepEqual(Object.keys(normalized), [
    'sourceId',
    'requestId',
    'url',
    'method',
    'headers',
    'body',
    'timeout',
    'maxResponseBytes'
  ]);

  // 断言作用: 请求头名称统一小写，原顺序、值、根对象和 headers 均冻结。
  assert.deepEqual(normalized.headers, [
    { name: 'authorization', value: 'Bearer test' },
    { name: 'x-trace-id', value: 'trace-001' }
  ]);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.headers), true);

  // 副作用范围: 只修改调用方原请求，规范化结果必须保持不变。
  request.headers[0].value = 'changed';
  request.body.data = 'changed';

  // 断言作用: 调用方后续篡改 headers 和嵌套 body 不能穿透到规范化结果。
  assert.equal(normalized.headers[0].value, 'Bearer test');
  assert.equal(normalized.body.data, '{"filters":{"genre":"action"}}');
});

// 测试目的: 网络请求必须拒绝额外字段、跨源、危险 header、非 HTTPS、未知方法、GET body 和策略超限。
test('SourceNetworkRequest 系统拒绝非法字段和容量输入', () => {
  // 断言作用: 精确字段边界拒绝额外属性，能力模块不能静默忽略未知输入。
  assert.throws(
    () => normalizeSourceNetworkRequest({ ...createNetworkRequest(), extra: true }, SHELL_TEST_SOURCE_ID),
    SourceShellValidationError
  );

  // 断言作用: 请求 sourceId 必须与 Context 绑定身份一致，禁止跨源借用网络能力。
  assert.throws(
    () => normalizeSourceNetworkRequest(createNetworkRequest({ sourceId: 'system-source-2' }), SHELL_TEST_SOURCE_ID),
    SourceShellValidationError
  );

  // 断言作用: URL 只允许 HTTPS，明文 HTTP 不能进入 Adapter 或未来代理。
  assert.throws(
    () => normalizeSourceNetworkRequest(createNetworkRequest({ url: 'http://invalid/api' }), SHELL_TEST_SOURCE_ID),
    SourceShellValidationError
  );

  // 断言作用: 方法必须属于冻结 GET/POST 枚举，不做隐式方法扩展。
  assert.throws(
    () => normalizeSourceNetworkRequest(createNetworkRequest({ method: 'PATCH' }), SHELL_TEST_SOURCE_ID),
    SourceShellValidationError
  );

  // 断言作用: GET 不允许携带业务 body，模拟层和未来代理保持一致语义。
  assert.throws(
    () => normalizeSourceNetworkRequest(createNetworkRequest({
      method: SOURCE_NETWORK_METHOD.get,
      body: { encoding: 'utf8', data: 'invalid' }
    }), SHELL_TEST_SOURCE_ID),
    SourceShellValidationError
  );

  // 断言作用: 规范化后的危险 header 键必须被集中动态键规则拒绝。
  assert.throws(
    () => normalizeSourceNetworkRequest(createNetworkRequest({ headers: [{ name: 'bad header', value: 'unsafe' }] }), SHELL_TEST_SOURCE_ID),
    SourceShellValidationError
  );

  // 断言作用: 超过最大 timeout 的安全整数归类为 limit，而不是普通 validation。
  assert.throws(
    () => normalizeSourceNetworkRequest(createNetworkRequest({
      timeout: SOURCE_NETWORK_POLICY.maxTimeoutMs + 1
    }), SHELL_TEST_SOURCE_ID),
    SourceShellLimitError
  );

  // 断言作用: 超过集中请求体字节上限的字符串归类为 limit，不截断后继续请求。
  assert.throws(
    () => normalizeSourceNetworkRequest(createNetworkRequest({
      body: { encoding: 'utf8', data: 'x'.repeat(SOURCE_NETWORK_POLICY.maxRequestBodyBytes + 1) }
    }), SHELL_TEST_SOURCE_ID),
    SourceShellLimitError
  );

  // 断言作用: sourceId 本身复用危险动态键拒绝规则，原型敏感身份不能进入任何 Shell 能力。
  assert.throws(() => normalizeSourceShellId('__proto__'), SourceShellValidationError);
});

// 测试目的: AbortSignal 和精确参数数量边界必须拒绝伪造对象、额外 sourceId 与已中止调用。
test('Shell 基础门禁校验 AbortSignal 和精确参数数量', () => {
  // 类型: AbortController。
  // 作用: 创建真实 signal 并验证中止前后分支。
  const controller = new AbortController();

  // 断言作用: 真实 signal 在中止前通过结构和采用门禁；普通对象不能伪装 AbortSignal。
  assert.equal(assertAbortSignal(controller.signal), controller.signal);
  assert.doesNotThrow(() => assertNotAborted(controller.signal, 'network.request'));
  assert.throws(() => assertAbortSignal({ aborted: false }), SourceShellValidationError);

  // 断言作用: 精确一个参数通过，夹带 sourceId 的两个参数被拒绝。
  assert.doesNotThrow(() => assertExactArgumentCount(['key'], 1, 'storage.get'));
  assert.throws(
    () => assertExactArgumentCount(['other-source', 'key'], 1, 'storage.get'),
    SourceShellValidationError
  );

  // 副作用: 把当前局部 controller 切换为 aborted，验证后续能力不能采用成功结果。
  controller.abort();

  // 断言作用: 已中止 signal 返回稳定 SourceShellAbortedError。
  assert.throws(
    () => assertNotAborted(controller.signal, 'network.request'),
    SourceShellAbortedError
  );
});

// 测试目的: 挑战必须绑定 sourceId、使用标准 ISO 时间并隔离 fields；日志输入必须受容量和引用边界约束。
test('Shell 挑战和日志输入遵守身份容量与引用隔离', () => {
  // 类型: object。
  // 作用: 保存调用方挑战对象，规范化后再修改 fields 验证隔离。
  const challenge = createChallenge();

  // 类型: object。
  // 作用: 保存精确字段和隔离 fields 的标准挑战。
  const normalizedChallenge = normalizeSourceChallenge(challenge, SHELL_TEST_SOURCE_ID);

  // 副作用范围: 只修改调用方 fields，标准挑战必须保持原值。
  challenge.fields[0].name = 'changed';

  // 断言作用: fields 深层引用与调用方隔离，标准挑战根对象冻结。
  assert.equal(normalizedChallenge.fields[0].name, 'code');
  assert.equal(Object.isFrozen(normalizedChallenge), true);

  // 断言作用: 挑战 sourceId 不一致和非法到期时间均返回稳定 validation。
  assert.throws(
    () => normalizeSourceChallenge(createChallenge({ sourceId: 'system-source-2' }), SHELL_TEST_SOURCE_ID),
    SourceShellValidationError
  );
  assert.throws(
    () => normalizeSourceChallenge(createChallenge({ expiresAt: 'invalid-date' }), SHELL_TEST_SOURCE_ID),
    SourceShellValidationError
  );

  // 类型: object。
  // 作用: 保存调用方日志详情，规范化后修改嵌套字段验证隔离。
  const details = { request: { id: 'request-001' } };

  // 类型: object。
  // 作用: 保存容量受控的日志消息和隔离详情。
  const normalizedLog = normalizeSourceLogInput('请求开始', details);

  // 副作用范围: 只修改调用方日志详情，规范化副本必须保持原值。
  details.request.id = 'changed';

  // 断言作用: 日志 details 深层引用与调用方隔离。
  assert.equal(normalizedLog.details.request.id, 'request-001');

  // 断言作用: 消息字符和 details JSON 字节超过集中上限时均返回 limit，不截断写入。
  assert.throws(
    () => normalizeSourceLogInput('x'.repeat(SOURCE_LOGGER_POLICY.maxMessageLength + 1), {}),
    SourceShellLimitError
  );
  assert.throws(
    () => normalizeSourceLogInput('详情超限', {
      value: 'x'.repeat(SOURCE_LOGGER_POLICY.maxDetailsBytes + 1)
    }),
    SourceShellLimitError
  );
});
