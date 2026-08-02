/*
  source-challenge-coordinator.test.js 模块说明

  - 文件职责:
      验证全局挑战协调器的无消费者结果、FIFO、跨源隔离、字段提交、取消和 AbortSignal 清理。
      通过正式 SourceChallengePort 进入协调器，证明 Provider 只使用 SourceContext 对应请求边界。

  - 导入库及文件汇总(7 条，内置 2 条，第三方 1 条，自定义 4 条):
      assert: 内置模块，执行状态、顺序、字段和错误断言。
      test: 内置模块，注册 Node 领域测试。
      Vue: 第三方 Vue 2 运行时，复现组件表单被观察后增加不可枚举元数据的真实边界。
      SOURCE_CHALLENGE_STATUS: 自定义配置，提供三种稳定挑战结果。
      createSourceChallengeCoordinator: 自定义工厂，创建被测 FIFO 和权限分离端口。
      createSourceChallengePort: 自定义 Shell 工厂，规范化挑战并绑定 sourceId/signal。
      createSourceChallengeService: 自定义交互 service 工厂，隔离页面响应式输入后提交协调器。

  - 模块级常量:
      PRIMARY_SOURCE_ID: string，第一个测试数据源身份。
      SECONDARY_SOURCE_ID: string，第二个并发测试数据源身份。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createChallenge(sourceId, challengeId): Function，创建完整标准挑战候选。
      flushMicrotasks(): Function，让 Promise 采用结果完成而不使用固定等待。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 比较挑战结果、发布顺序和失败类型。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册协调器领域测试并隔离每个实例状态。
import test from 'node:test';

// 导入来源: vue。
// 导入内容: Vue 2 默认运行时对象。
// 文件作用: 使用真实 Vue.observable 生成与根级挑战组件一致的响应式表单元数据。
import Vue from 'vue';

// 导入来源: ../src/runtime/source-shell/source-shell.config.js。
// 导入内容: SOURCE_CHALLENGE_STATUS 挑战状态枚举。
// 文件作用: 断言 resolved、cancelled 和 unsupported，不解析文案。
import { SOURCE_CHALLENGE_STATUS } from '../src/runtime/source-shell/source-shell.config.js';

// 导入来源: ../src/runtime/source-challenge/sourceChallengeCoordinator.js。
// 导入内容: createSourceChallengeCoordinator 被测协调器工厂。
// 文件作用: 每个测试创建独立队列、监听器和端口。
import { createSourceChallengeCoordinator } from '../src/runtime/source-challenge/sourceChallengeCoordinator.js';

// 导入来源: ../src/runtime/source-shell/sourceChallengePort.js。
// 导入内容: createSourceChallengePort 正式 Shell 挑战端口工厂。
// 文件作用: 测试请求必须先经过身份和字段规范化再进入协调器。
import { createSourceChallengePort } from '../src/runtime/source-shell/sourceChallengePort.js';

// 导入来源: ../src/services/sourceChallengeService.js。
// 导入内容: createSourceChallengeService 挑战交互服务工厂。
// 文件作用: 把真实 Vue 表单通过正式页面 service 边界提交给协调器。
import { createSourceChallengeService } from '../src/services/sourceChallengeService.js';

// 类型: string。
// 作用: 标识第一个活动挑战所属数据源。
const PRIMARY_SOURCE_ID = 'system-source-1';
// 类型: string。
// 作用: 标识等待队列中第二个挑战所属数据源。
const SECONDARY_SOURCE_ID = 'system-source-2';

/**
 * 创建完整标准挑战候选。
 * 纯函数: 返回新对象和新字段数组，不修改参数或共享状态。
 * 成功路径: 生成一个必填 code 字段且无到期时间的 captcha 挑战。
 * 失败路径: 测试只传入安全身份，非法字段由具体断言局部覆盖。
 *
 * @param {string} sourceId 当前挑战数据源身份。
 * @param {string} challengeId 当前挑战关联标识。
 * @returns {object} SourceChallenge 候选。
 */
function createChallenge(sourceId, challengeId) {
  return {
    challengeId,
    sourceId,
    type: 'captcha',
    title: '请输入验证码',
    image: '',
    fields: [{
      name: 'code',
      type: 'text',
      label: '验证码',
      required: true,
      placeholder: '请输入验证码'
    }],
    expiresAt: '',
    contextKey: 'captcha-session'
  };
}

/**
 * 让当前 Promise 队列完成已经排定的结果采用。
 * 副作用: 只排入一个微任务，不创建定时器或固定等待。
 * 成功路径: 调用方 await 后可读取前一个 resolve 触发的结果。
 * 失败路径: Promise.resolve 不拒绝。
 *
 * @returns {Promise<void>} 当前微任务检查点。
 */
async function flushMicrotasks() {
  await Promise.resolve();
}

// 测试目的: 没有根级交互消费者时必须立即返回 unsupported，不能让 Provider 永久等待。
test('挑战协调器在无消费者时返回 unsupported', async () => {
  // 类型: object。
  // 作用: 创建空监听器协调器和正式请求端口。
  const coordinator = createSourceChallengeCoordinator();
  // 类型: AbortController。
  // 作用: 提供未中止 Host signal。
  const controller = new AbortController();
  // 类型: object。
  // 作用: 绑定第一数据源、signal 和协调器请求窄端口。
  const challengePort = createSourceChallengePort({
    sourceId: PRIMARY_SOURCE_ID,
    signal: controller.signal,
    requestPort: coordinator.requestPort
  });

  // 类型: object。
  // 作用: 保存无消费者请求的立即完成结果。
  const result = await challengePort.request(createChallenge(PRIMARY_SOURCE_ID, 'challenge-none'));

  // 断言作用: 结果保持精确四字段、同一 challengeId、空 values 和 unsupported 状态。
  assert.deepEqual(Object.keys(result), ['status', 'challengeId', 'values', 'message']);
  assert.equal(result.status, SOURCE_CHALLENGE_STATUS.unsupported);
  assert.equal(result.challengeId, 'challenge-none');
  assert.deepEqual(result.values, {});
  coordinator.dispose();
});

// 测试目的: 两个数据源并发挑战按 FIFO 展示，提交和取消只完成各自原 Promise。
test('挑战协调器按 FIFO 隔离 resolved 与 cancelled', async () => {
  // 类型: object。
  // 作用: 创建当前用例独立协调器，状态不会泄漏到其他测试。
  const coordinator = createSourceChallengeCoordinator();
  // 类型: Array<string|null>。
  // 作用: 按同步发布时间记录活动 challengeId 和空状态。
  const published = [];
  // 副作用: 注册唯一根级消费者并记录活动 challengeId 或 null 的发布顺序。
  // 类型: Function。
  // 作用: 保存当前页面订阅的幂等取消句柄。
  const unsubscribe = coordinator.interactionPort.subscribe((challenge) => {
    published.push(challenge ? challenge.challengeId : null);
  });

  // 类型: AbortController。
  // 作用: 控制第一个活动挑战的 Host 生命周期。
  const primaryController = new AbortController();
  // 类型: AbortController。
  // 作用: 控制第二个等待挑战的 Host 生命周期。
  const secondaryController = new AbortController();
  // 类型: object。
  // 作用: 创建第一数据源正式挑战端口。
  const primaryPort = createSourceChallengePort({
    sourceId: PRIMARY_SOURCE_ID,
    signal: primaryController.signal,
    requestPort: coordinator.requestPort
  });
  // 类型: object。
  // 作用: 创建第二数据源正式挑战端口。
  const secondaryPort = createSourceChallengePort({
    sourceId: SECONDARY_SOURCE_ID,
    signal: secondaryController.signal,
    requestPort: coordinator.requestPort
  });

  // 类型: Promise<object>。
  // 作用: 保存第一个活动挑战等待结果。
  const primaryPromise = primaryPort.request(createChallenge(PRIMARY_SOURCE_ID, 'challenge-a'));
  // 类型: Promise<object>。
  // 作用: 保存第二个排队挑战等待结果。
  const secondaryPromise = secondaryPort.request(createChallenge(SECONDARY_SOURCE_ID, 'challenge-b'));

  // 断言作用: 初始 null 后只发布第一个挑战，第二项尚未提前展示。
  assert.deepEqual(published, [null, 'challenge-a']);

  // 类型: object。
  // 作用: 提交第一个挑战合法输入并推进第二项。
  const submitted = coordinator.interactionPort.resolve('challenge-a', { code: '4821' });
  // 类型: object。
  // 作用: 保存第一 Provider Promise 收到的同一 resolved 结果。
  const primaryResult = await primaryPromise;
  assert.equal(submitted.status, SOURCE_CHALLENGE_STATUS.resolved);
  assert.equal(primaryResult.status, SOURCE_CHALLENGE_STATUS.resolved);
  assert.deepEqual(primaryResult.values, { code: '4821' });
  assert.deepEqual(published, [null, 'challenge-a', 'challenge-b']);

  // 类型: object。
  // 作用: 取消第二个活动挑战并让队列发布空状态。
  const cancelled = coordinator.interactionPort.cancel('challenge-b');
  // 类型: object。
  // 作用: 保存第二 Provider Promise 收到的同一 cancelled 结果。
  const secondaryResult = await secondaryPromise;
  assert.equal(cancelled.status, SOURCE_CHALLENGE_STATUS.cancelled);
  assert.equal(secondaryResult.status, SOURCE_CHALLENGE_STATUS.cancelled);
  assert.deepEqual(published, [null, 'challenge-a', 'challenge-b', null]);

  unsubscribe();
  coordinator.dispose();
});

// 测试目的: Vue 响应式元数据必须在统一 service 边界隔离，真实越界字段仍由 Shell 拒绝。
test('挑战 service 隔离 Vue 响应式元数据并保留严格字段校验', async () => {
  // 类型: object。
  // 作用: 创建当前页面边界用例独立协调器，避免复用应用单例或其他用例队列。
  const coordinator = createSourceChallengeCoordinator();
  // 类型: object。
  // 作用: 注入真实协调器交互端口，测试 service 到原 Provider Promise 的完整链路。
  const challengeService = createSourceChallengeService(coordinator.interactionPort);
  // 类型: Function。
  // 作用: 建立根级交互消费者，使挑战请求进入活动状态；用例结束时释放。
  const unsubscribe = challengeService.subscribe(() => {});
  // 类型: AbortController。
  // 作用: 为当前 Provider 请求提供可释放 Host 生命周期。
  const controller = new AbortController();
  // 类型: object。
  // 作用: 绑定 系统数据源1 身份、signal 和协调请求端口，模拟 Provider 真实 challenge.request。
  const challengePort = createSourceChallengePort({
    sourceId: PRIMARY_SOURCE_ID,
    signal: controller.signal,
    requestPort: coordinator.requestPort
  });

  // 类型: Promise<object>。
  // 作用: 保存第一项 Provider 等待结果，service 提交后应恢复为 resolved。
  const resolvedPromise = challengePort.request(createChallenge(PRIMARY_SOURCE_ID, 'challenge-vue-observer'));
  // 类型: object。
  // 作用: 使用项目真实 Vue 2 创建与组件 data 一致的响应式表单容器。
  const observedFormState = Vue.observable({ values: { code: '5948' } });

  // 断言作用: 用例必须真实复现 Vue 2 在字段对象上写入不可枚举 __ob__，不能用手工假对象替代根因。
  assert.deepEqual(Reflect.ownKeys(observedFormState.values), ['code', '__ob__']);
  // 类型: object。
  // 作用: 保存 service 经普通 DTO 提交后同步返回的 resolved 结果。
  const submitted = challengeService.resolve('challenge-vue-observer', observedFormState.values);
  // 类型: object。
  // 作用: 保存原 Provider Promise 收到的同一标准结果。
  const resolvedResult = await resolvedPromise;

  // 断言作用: 框架元数据没有越过页面边界，结果只保留 Provider 声明的 code。
  assert.deepEqual(submitted.values, { code: '5948' });
  assert.deepEqual(resolvedResult.values, { code: '5948' });
  assert.equal(Object.hasOwn(resolvedResult.values, '__ob__'), false);

  // 类型: Promise<object>。
  // 作用: 保存第二项 Provider 等待结果，非法提交后必须保持活动并允许修正。
  const strictPromise = challengePort.request(createChallenge(PRIMARY_SOURCE_ID, 'challenge-vue-strict'));
  // 类型: object。
  // 作用: 生成带真实可枚举越界 token 的响应式表单，证明 service 不会静默吞字段。
  const observedInvalidState = Vue.observable({ values: { code: '1234', token: 'forbidden' } });

  // 断言作用: 只有不可枚举框架元数据被隔离；可枚举 token 仍到达 Shell 并被严格拒绝。
  assert.throws(
    () => challengeService.resolve('challenge-vue-strict', observedInvalidState.values),
    /包含未声明字段/
  );

  // 类型: object。
  // 作用: 创建不含越界字段的新响应式表单，验证前一次失败没有完成或污染活动挑战。
  const observedCorrectedState = Vue.observable({ values: { code: '1234' } });
  challengeService.resolve('challenge-vue-strict', observedCorrectedState.values);
  // 类型: object。
  // 作用: 保存修正后 Provider Promise 的最终 resolved 结果。
  const strictResult = await strictPromise;
  assert.deepEqual(strictResult.values, { code: '1234' });

  unsubscribe();
  coordinator.dispose();
});

// 测试目的: 非法提交保持原事务可修正，Host 中止只取消目标排队项并清理监听器。
test('挑战协调器拒绝非法输入并按 signal 取消目标事务', async () => {
  // 类型: object。
  // 作用: 创建当前错误与中止用例独立协调器。
  const coordinator = createSourceChallengeCoordinator();
  // 类型: Array<string|null>。
  // 作用: 记录活动挑战发布，证明等待项中止不改变当前 UI。
  const published = [];
  // 类型: Function。
  // 作用: 保存当前根级消费者订阅取消句柄。
  const unsubscribe = coordinator.interactionPort.subscribe((challenge) => {
    published.push(challenge ? challenge.challengeId : null);
  });
  // 类型: AbortController。
  // 作用: 控制保持活动的第一挑战生命周期。
  const primaryController = new AbortController();
  // 类型: AbortController。
  // 作用: 控制将在等待队列中中止的第二挑战生命周期。
  const secondaryController = new AbortController();
  // 类型: object。
  // 作用: 创建第一数据源正式挑战端口。
  const primaryPort = createSourceChallengePort({
    sourceId: PRIMARY_SOURCE_ID,
    signal: primaryController.signal,
    requestPort: coordinator.requestPort
  });
  // 类型: object。
  // 作用: 创建第二数据源正式挑战端口。
  const secondaryPort = createSourceChallengePort({
    sourceId: SECONDARY_SOURCE_ID,
    signal: secondaryController.signal,
    requestPort: coordinator.requestPort
  });

  // 类型: Promise<object>。
  // 作用: 保存第一活动挑战等待结果。
  const primaryPromise = primaryPort.request(createChallenge(PRIMARY_SOURCE_ID, 'challenge-required'));
  // 类型: Promise<object>。
  // 作用: 保存第二排队挑战等待结果。
  const secondaryPromise = secondaryPort.request(createChallenge(SECONDARY_SOURCE_ID, 'challenge-abort'));

  // 断言作用: 空必填值和额外字段均同步拒绝，活动挑战没有被错误完成或推进。
  assert.throws(() => coordinator.interactionPort.resolve('challenge-required', { code: '   ' }));
  assert.throws(() => coordinator.interactionPort.resolve(
    'challenge-required',
    { code: '1234', token: 'forbidden' }
  ));
  assert.deepEqual(published, [null, 'challenge-required']);

  // 副作用: 中止第二个等待项；它必须直接完成 cancelled，不影响第一个活动项。
  secondaryController.abort();
  // 类型: object。
  // 作用: 保存第二等待项因 Host 中止得到的 cancelled 结果。
  const secondaryResult = await secondaryPromise;
  assert.equal(secondaryResult.status, SOURCE_CHALLENGE_STATUS.cancelled);
  assert.deepEqual(published, [null, 'challenge-required']);

  coordinator.interactionPort.resolve('challenge-required', { code: '1234' });
  // 类型: object。
  // 作用: 保存第一活动项修正输入后得到的 resolved 结果。
  const primaryResult = await primaryPromise;
  assert.equal(primaryResult.status, SOURCE_CHALLENGE_STATUS.resolved);
  await flushMicrotasks();
  assert.equal(published.at(-1), null);

  unsubscribe();
  coordinator.dispose();
});
