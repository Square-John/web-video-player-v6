/*
  source-challenge-logger.test.js 模块说明

  - 文件职责:
      验证 SourceChallengePort 的占位状态、身份、signal 和精确参数边界。
      验证 SourceLoggerController 的权限分离、递归脱敏、容量、深冻结快照、有界淘汰和清理能力。

  - 导入库及文件汇总(6 条，内置 2 条，第三方 0 条，自定义 4 条):
      assert: 内置模块，执行结构、状态、脱敏、冻结和错误断言。
      test: 内置模块，注册 Node 领域测试。
      Shell config: 自定义配置，提供挑战状态、日志级别和容量上限。
      Shell errors: 自定义错误，验证 validation 和 limit 分类。
      createSourceChallengePort: 自定义挑战端口工厂，被测对象。
      createSourceLoggerController: 自定义日志控制器工厂，被测对象。

  - 模块级常量:
      CHALLENGE_LOGGER_TEST_SOURCE_ID: string，挑战和日志测试绑定数据源 id。
      LOGGER_REDACTION_EXPANSION_ENTRY_COUNT: number，构造脱敏后容量扩张边界的敏感条目数量。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createChallenge(overrides): Function，创建完整 SourceChallenge 候选。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 比较挑战结果、日志条目、冻结状态和稳定错误。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册 challenge 和 logger 领域测试。
import test from 'node:test';

import {
  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_CHALLENGE_STATUS 挑战状态枚举。
  // 文件作用: 断言端口只返回 unsupported 或 cancelled。
  SOURCE_CHALLENGE_STATUS,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_LOG_LEVEL 日志级别枚举。
  // 文件作用: 断言四个写方法生成对应稳定 level。
  SOURCE_LOG_LEVEL,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_LOGGER_POLICY 日志容量策略。
  // 文件作用: 构造消息、details 和条数上限测试输入。
  SOURCE_LOGGER_POLICY
} from '../src/runtime/source-shell/source-shell.config.js';

import {
  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellLimitError 日志容量超限错误。
  // 文件作用: 验证消息和 details 超限不会截断写入。
  SourceShellLimitError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellValidationError Shell 输入错误。
  // 文件作用: 验证挑战跨源、额外参数和 Logger 参数错误。
  SourceShellValidationError
} from '../src/runtime/source-shell/sourceShellErrors.js';

// 导入来源: ../src/runtime/source-shell/sourceChallengePort.js。
// 导入内容: createSourceChallengePort 挑战端口工厂。
// 文件作用: 创建绑定 sourceId/signal 的被测占位端口。
import { createSourceChallengePort } from '../src/runtime/source-shell/sourceChallengePort.js';

// 导入来源: ../src/runtime/source-shell/sourceLogger.js。
// 导入内容: createSourceLoggerController 日志控制器工厂。
// 文件作用: 创建 Provider 只写和 Host 读取/清理权限分离的被测控制器。
import { createSourceLoggerController } from '../src/runtime/source-shell/sourceLogger.js';

// 类型: string。
// 作用: 挑战端口和 Logger Controller 共用绑定身份，跨源用例使用其他 id。
const CHALLENGE_LOGGER_TEST_SOURCE_ID = 'system-source-1';

// 类型: number。
// 作用: 构造脱敏前低于上限、替换为 `[REDACTED]` 后超过上限的敏感短值数组，验证最终落盘容量门禁。
const LOGGER_REDACTION_EXPANSION_ENTRY_COUNT = 800;

/**
 * 创建完整 SourceChallenge 候选。
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
    // 作用: 提供稳定请求关联标识，结果必须原样回填。
    challengeId: 'challenge-5d-001',

    // 类型: string。
    // 作用: 默认与端口绑定身份一致，跨源用例通过 overrides 替换。
    sourceId: CHALLENGE_LOGGER_TEST_SOURCE_ID,

    // 类型: string。
    // 作用: 提供非空验证码类型，端口不解释页面交互。
    type: 'captcha',

    // 类型: string。
    // 作用: 提供未来统一挑战界面标题候选。
    title: '请输入验证码',

    // 类型: string。
    // 作用: 空字符串表示当前测试挑战没有图片。
    image: '',

    // 类型: Array<object>。
    // 作用: 提供待严格 JSON 校验和引用隔离的输入字段声明。
    fields: [{
      // 类型: string。
      // 作用: 未来挑战输入结果使用的验证码字段键。
      name: 'code',

      // 类型: string。
      // 作用: 未来 UI 使用普通文本输入控件承载该字段。
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
    // 作用: 提供标准 UTC ISO 到期时间。
    expiresAt: '2026-07-16T08:00:00.000Z',

    // 类型: string。
    // 作用: 提供 Provider 私有空间中的最小续接键。
    contextKey: 'challenge-session',

    // 展开来源: 当前测试传入的局部挑战字段。
    // 作用: 只改变目标用例条件，保持其他精确字段完整。
    ...overrides
  };
}

// 测试目的: 未中止挑战返回 unsupported 冻结结果，端口公开组合身份和同一 signal。
test('SourceChallengePort 返回冻结 unsupported 占位结果', async () => {
  // 类型: AbortController。
  // 作用: 提供未中止真实 signal，端口应返回 unsupported。
  const controller = new AbortController();

  // 类型: object。
  // 作用: 创建绑定测试 sourceId 和当前 signal 的冻结端口。
  const port = createSourceChallengePort({
    // 类型: string。
    // 作用: 绑定挑战端口唯一数据源身份。
    sourceId: CHALLENGE_LOGGER_TEST_SOURCE_ID,

    // 类型: AbortSignal。
    // 作用: 绑定挑战端口生命周期，供 SourceContext 后续做同一引用校验。
    signal: controller.signal
  });

  // 类型: object。
  // 作用: 保存未中止挑战的标准占位结果。
  const result = await port.request(createChallenge());

  // 断言作用: 端口根对象冻结，并准确公开绑定身份、同一 signal 和 request。
  assert.equal(Object.isFrozen(port), true);
  assert.equal(port.sourceId, CHALLENGE_LOGGER_TEST_SOURCE_ID);
  assert.equal(port.signal, controller.signal);
  assert.equal(typeof port.request, 'function');

  // 断言作用: 未中止挑战返回精确四字段 unsupported 结果，不伪造用户 values。
  assert.deepEqual(Object.keys(result), ['status', 'challengeId', 'values', 'message']);
  assert.equal(result.status, SOURCE_CHALLENGE_STATUS.unsupported);
  assert.equal(result.challengeId, 'challenge-5d-001');
  assert.deepEqual(result.values, {});
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.values), true);
});

// 测试目的: 已中止挑战返回 cancelled，跨源、额外参数和非法 signal 必须稳定拒绝。
test('SourceChallengePort 遵守 cancelled 和精确身份参数边界', async () => {
  // 类型: AbortController。
  // 作用: 创建后立即中止，挑战端口必须返回 cancelled 而不是 unsupported。
  const controller = new AbortController();
  controller.abort();

  // 类型: object。
  // 作用: 创建绑定已中止 signal 的挑战端口。
  const port = createSourceChallengePort({
    // 类型: string。
    // 作用: 绑定端口唯一身份。
    sourceId: CHALLENGE_LOGGER_TEST_SOURCE_ID,

    // 类型: AbortSignal。
    // 作用: 提供已中止生命周期状态。
    signal: controller.signal
  });

  // 类型: object。
  // 作用: 保存已中止挑战的 cancelled 结果。
  const cancelled = await port.request(createChallenge());

  // 断言作用: 已中止生命周期只返回 cancelled，仍回填同一挑战 id。
  assert.equal(cancelled.status, SOURCE_CHALLENGE_STATUS.cancelled);
  assert.equal(cancelled.challengeId, 'challenge-5d-001');

  // 断言作用: 跨源挑战和额外第二参数均返回 validation，不能覆盖端口闭包身份。
  await assert.rejects(
    port.request(createChallenge({ sourceId: 'system-source-2' })),
    SourceShellValidationError
  );
  await assert.rejects(
    port.request(createChallenge(), { sourceId: 'system-source-2' }),
    SourceShellValidationError
  );

  // 断言作用: 普通对象不能伪装 AbortSignal，非法依赖在端口创建阶段失败。
  assert.throws(() => createSourceChallengePort({
    sourceId: CHALLENGE_LOGGER_TEST_SOURCE_ID,
    signal: { aborted: false }
  }), SourceShellValidationError);
});

// 测试目的: Logger 自动附带 sourceId，递归脱敏不同命名风格，并返回深冻结隔离快照。
test('SourceLoggerController 递归脱敏并隔离深冻结日志快照', () => {
  // 类型: object。
  // 作用: 创建绑定测试 sourceId 的 Logger Controller。
  const controller = createSourceLoggerController({
    // 类型: string。
    // 作用: 所有日志条目必须自动附带该身份。
    sourceId: CHALLENGE_LOGGER_TEST_SOURCE_ID
  });

  // 类型: object。
  // 作用: 保存包含多层、多命名风格敏感字段和一个安全字段的调用方详情。
  const details = {
    // 类型: string。
    // 作用: 大小写请求头形式，日志中必须被替换。
    Authorization: 'Bearer secret',

    // 类型: object。
    // 作用: 验证 camelCase、snake_case、kebab-case 和普通 Cookie 的递归脱敏。
    nested: {
      // 类型: string。
      // 作用: camelCase 访问令牌，规范化后必须命中 access-token。
      accessToken: 'access-secret',

      // 类型: string。
      // 作用: snake_case 刷新令牌，规范化后必须命中 refresh-token。
      refresh_token: 'refresh-secret',

      // 类型: string。
      // 作用: camelCase API 密钥，规范化后必须命中 api-key。
      apiKey: 'api-secret',

      // 类型: string。
      // 作用: 普通 Cookie 键，日志中必须被替换。
      cookie: 'session-secret',

      // 类型: string。
      // 作用: 非敏感诊断字段，脱敏后必须保留原值。
      safe: 'visible'
    },

    // 类型: Array<object>。
    // 作用: 验证数组成员内的 password 也会递归脱敏。
    list: [{
      // 类型: string。
      // 作用: 数组成员敏感密码，日志中必须被替换。
      password: 'password-secret'
    }]
  };

  // 执行内容: 通过 Provider 可见 info 方法写入一条包含敏感字段的日志。
  controller.logger.info('请求开始', details);

  // 副作用范围: 只修改调用方原 details，内部日志必须保持写入时的隔离安全值。
  details.nested.safe = 'changed';

  // 类型: Array<object>。
  // 作用: 保存 Host 可见的第一份深冻结隔离快照。
  const entries = controller.getEntries();

  // 断言作用: Controller、logger 和快照均冻结；Provider logger 不包含读取或清理方法。
  assert.equal(Object.isFrozen(controller), true);
  assert.equal(Object.isFrozen(controller.logger), true);
  assert.deepEqual(Object.keys(controller.logger), ['debug', 'info', 'warn', 'error']);
  assert.equal(Object.isFrozen(entries), true);
  assert.equal(Object.isFrozen(entries[0]), true);
  assert.equal(Object.isFrozen(entries[0].details.nested), true);

  // 断言作用: 条目只含正式四字段，自动 sourceId 和 info level 正确。
  assert.deepEqual(Object.keys(entries[0]), ['sourceId', 'level', 'message', 'details']);
  assert.equal(entries[0].sourceId, CHALLENGE_LOGGER_TEST_SOURCE_ID);
  assert.equal(entries[0].level, SOURCE_LOG_LEVEL.info);
  assert.equal(entries[0].message, '请求开始');

  // 断言作用: 大小写、camelCase、snake_case、kebab 配置和数组嵌套敏感值全部替换，安全值保持写入时内容。
  assert.equal(entries[0].details.Authorization, '[REDACTED]');
  assert.equal(entries[0].details.nested.accessToken, '[REDACTED]');
  assert.equal(entries[0].details.nested.refresh_token, '[REDACTED]');
  assert.equal(entries[0].details.nested.apiKey, '[REDACTED]');
  assert.equal(entries[0].details.nested.cookie, '[REDACTED]');
  assert.equal(entries[0].details.nested.safe, 'visible');
  assert.equal(entries[0].details.list[0].password, '[REDACTED]');

  // 断言作用: 深冻结快照拒绝调用方篡改，第二次读取仍返回未污染的独立内容。
  assert.throws(() => {
    entries[0].details.nested.safe = 'tampered';
  }, TypeError);
  assert.equal(controller.getEntries()[0].details.nested.safe, 'visible');
});

// 测试目的: Logger 只保留最新最大条数，clear 返回真实数量，非法参数和容量输入不写入。
test('SourceLoggerController 执行有界淘汰清理和容量门禁', () => {
  // 类型: object。
  // 作用: 创建独立 Logger Controller 供容量和清理测试。
  const controller = createSourceLoggerController({
    // 类型: string。
    // 作用: 所有容量测试日志自动附带同一身份。
    sourceId: CHALLENGE_LOGGER_TEST_SOURCE_ID
  });

  // 循环类型: for 数值递增循环。
  // 初始值: index = 0。
  // 终止条件: 写入 maxEntries + 2 条日志。
  // 循环作用: 触发两次最旧条目淘汰并保留稳定顺序。
  for (let index = 0; index < SOURCE_LOGGER_POLICY.maxEntries + 2; index += 1) {
    // 执行内容: 写入当前 index 对应 debug 日志，details 保留同一序号供顺序断言。
    controller.logger.debug(`entry-${index}`, {
      // 类型: number。
      // 作用: 标识写入顺序，淘汰后第一条应从 2 开始。
      index
    });
  }

  // 类型: Array<object>。
  // 作用: 保存超过上限后的有界日志快照。
  const boundedEntries = controller.getEntries();

  // 断言作用: 数组只保留 maxEntries 条，最早两条已淘汰且最后一条仍在。
  assert.equal(boundedEntries.length, SOURCE_LOGGER_POLICY.maxEntries);
  assert.equal(boundedEntries[0].message, 'entry-2');
  assert.equal(boundedEntries.at(-1).message, `entry-${SOURCE_LOGGER_POLICY.maxEntries + 1}`);

  // 断言作用: Logger 写方法和 Host 读取/清理方法都拒绝额外或缺失参数。
  assert.throws(() => controller.logger.info('missing-details'), SourceShellValidationError);
  assert.throws(() => controller.getEntries('extra'), SourceShellValidationError);
  assert.throws(() => controller.clear('extra'), SourceShellValidationError);

  // 断言作用: 超长消息和超大 details 返回 limit，不能截断后写入或改变当前条数。
  assert.throws(() => controller.logger.warn(
    'x'.repeat(SOURCE_LOGGER_POLICY.maxMessageLength + 1),
    {}
  ), SourceShellLimitError);
  assert.throws(() => controller.logger.error('details-too-large', {
    // 类型: string。
    // 作用: 构造超过 details 字节上限的非敏感值，验证原始容量门禁。
    value: 'x'.repeat(SOURCE_LOGGER_POLICY.maxDetailsBytes + 1)
  }), SourceShellLimitError);

  // 类型: object。
  // 作用: 构造大量空 token；原始 JSON 低于容量上限，脱敏替换文本扩张后超过最终保存上限。
  const redactionExpansionDetails = {
    // 类型: Array<object>。
    // 作用: 每项使用同一敏感键和短空值，隔离“脱敏后扩张”而不是原始输入已超限的失败条件。
    values: Array.from(
      { length: LOGGER_REDACTION_EXPANSION_ENTRY_COUNT },
      () => ({ token: '' })
    )
  };

  // 断言作用: 原始 details 可通过输入门禁，但脱敏后的最终值超限时必须拒绝写入，不能突破真实内存策略。
  assert.throws(
    () => controller.logger.error('redaction-expansion', redactionExpansionDetails),
    SourceShellLimitError
  );

  // 断言作用: 三种容量失败都发生在 entries 修改前，已有有界日志条数保持不变。
  assert.equal(controller.getEntries().length, SOURCE_LOGGER_POLICY.maxEntries);

  // 类型: number。
  // 作用: 保存 clear 返回的清理前真实日志数量。
  const clearedCount = controller.clear();

  // 断言作用: clear 返回上限条数，随后读取为空；再次清理返回零。
  assert.equal(clearedCount, SOURCE_LOGGER_POLICY.maxEntries);
  assert.deepEqual(controller.getEntries(), []);
  assert.equal(controller.clear(), 0);
});
