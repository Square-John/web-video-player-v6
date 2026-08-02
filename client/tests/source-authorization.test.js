/*
  source-authorization.test.js 模块说明

  - 文件职责:
      使用 Node 内置测试能力验证数据源授权指纹、快照和 mock 状态不变量。
      由 npm run build 在 Vite 构建前执行，阻止授权状态矛盾进入生产包。

  - 导入库及文件汇总(8 条，内置 2 条，第三方 0 条，自定义 6 条):
      assert: 内置模块，提供严格断言能力。
      test: 内置模块，注册 Node 测试用例。
      AUTHORIZATION_STATUS、SOURCE_KIND: 自定义配置，提供测试期望使用的领域枚举。
      sourceManagerMock: 自定义数据，提供全部数据源初始化记录。
      SOURCE_AUTHORIZATION_REASON、createSourceAuthorizationState、createSourceScriptHash、evaluateSourceAuthorization、normalizeSourceScriptContent、reconcileSourceManagerAuthorizationState: 自定义工具函数，提供被测授权能力。

  - 模块级常量:
      AUTHORIZED_AT: string，测试授权快照使用的固定时间。
      BASE_DEFINITION: object，授权纯函数测试使用的基础脚本定义。

  - 模块级变量:
      无

  - 模块级辅助函数:
      cloneSerializableValue(value)
          - params:
              -- value: any，可 JSON 序列化测试输入。
          - return:
              any，与输入结构一致的深拷贝。
          - description:
              隔离测试变更和共享 mock 导出对象。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言对象。
// 文件作用: 比较授权结果、哈希和 mock 不变量。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 声明构建前执行的授权一致性测试用例。
import test from 'node:test';

import {
  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 运行授权状态枚举。
  // 文件作用: 构造测试授权意图并检查 mock 原始状态。
  AUTHORIZATION_STATUS,
  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 只对自定义脚本执行用户授权不变量检查。
  SOURCE_KIND
} from '../src/config/source-manager.config.js';

import {
  // 导入来源: ../src/data/settings/source-manager.mock.js。
  // 导入内容: sourceManagerMock 数据源管理初始化数据。
  // 文件作用: 检查全部已授权、已启用和默认源记录的一致性。
  sourceManagerMock
} from '../src/data/settings/source-manager.mock.js';

import {
  // 导入来源: ../src/utils/sourceAuthorization.js。
  // 导入内容: SOURCE_AUTHORIZATION_REASON 授权判断原因枚举。
  // 文件作用: 精确检查版本变化和脚本文本变化分支。
  SOURCE_AUTHORIZATION_REASON,
  // 导入来源: ../src/utils/sourceAuthorization.js。
  // 导入内容: createSourceAuthorizationState 授权状态构造函数。
  // 文件作用: 验证已授权快照自动读取当前 definition。
  createSourceAuthorizationState,
  // 导入来源: ../src/utils/sourceAuthorization.js。
  // 导入内容: createSourceScriptHash 脚本内容指纹函数。
  // 文件作用: 验证相同文本确定性和不同文本变化检测。
  createSourceScriptHash,
  // 导入来源: ../src/utils/sourceAuthorization.js。
  // 导入内容: evaluateSourceAuthorization 授权有效性评估函数。
  // 文件作用: 验证页面、service 和 store 依赖的统一授权结论。
  evaluateSourceAuthorization,
  // 导入来源: ../src/utils/sourceAuthorization.js。
  // 导入内容: normalizeSourceScriptContent 脚本文本规范化函数。
  // 文件作用: 验证跨平台换行符不会制造无意义授权失效。
  normalizeSourceScriptContent,
  // 导入来源: ../src/utils/sourceAuthorization.js。
  // 导入内容: reconcileSourceManagerAuthorizationState 授权状态收敛函数。
  // 文件作用: 验证失效的已启用默认自定义源会按失败关闭规则处理。
  reconcileSourceManagerAuthorizationState
} from '../src/utils/sourceAuthorization.js';

// 类型: string。
// 作用: 给授权快照测试提供固定时间，避免当前时间导致断言不稳定。
const AUTHORIZED_AT = '2026-07-14T00:00:00.000Z';

// 类型: object。
// 作用: 提供授权纯函数测试使用的稳定自定义脚本定义。
// 字段: sourceKind，string，指定为自定义源以启用用户授权边界。
// 字段: version，string，作为授权版本快照和版本变化基线。
// 字段: scriptContent，string，作为授权内容指纹基线。
const BASE_DEFINITION = Object.freeze({
  // 类型: string；作用: 标识测试目标需要用户授权。
  sourceKind: SOURCE_KIND.custom,
  // 类型: string；作用: 提供授权快照的当前脚本版本。
  version: 'v1.0.0',
  // 类型: string；作用: 提供授权快照的当前脚本文本。
  scriptContent: "export default { id: 'authorization-test', version: 'v1.0.0' };"
});

/**
 * 深拷贝可序列化测试数据。
 * 纯函数: 返回新引用，不修改输入值。
 * 使用边界: 当前测试对象只包含 JSON 支持的普通字段。
 *
 * @param {*} value 需要复制的测试数据。
 * @returns {*} 与输入结构一致且引用隔离的深拷贝。
 */
function cloneSerializableValue(value) {
  // 返回值类型: any。
  // 作用: 通过 JSON 往返复制普通对象，防止测试修改共享 mock。
  return JSON.parse(JSON.stringify(value));
}

// 测试目的: 相同脚本文本和等价换行符必须生成同一内容指纹。
test('脚本内容指纹保持确定性并统一跨平台换行符', () => {
  // 类型: string。
  // 作用: 提供 Windows 换行脚本文本，验证规范化边界。
  const windowsScript = 'const first = 1;\r\nconst second = 2;\r\n';

  // 类型: string。
  // 作用: 提供语义相同的 LF 换行脚本文本作为比较基线。
  const unixScript = 'const first = 1;\nconst second = 2;\n';

  // 断言: 文本规范化必须把两种换行形式收敛为完全相同的保存内容。
  assert.equal(normalizeSourceScriptContent(windowsScript), unixScript);
  // 断言: 等价规范化文本必须生成相同授权内容指纹。
  assert.equal(createSourceScriptHash(windowsScript), createSourceScriptHash(unixScript));
  // 断言: 真实字符变化必须改变内容指纹，保证同版本脚本变更可以被识别。
  assert.notEqual(createSourceScriptHash(unixScript), createSourceScriptHash(`${unixScript}// changed`));
});

// 测试目的: 已授权状态必须从当前 definition 自动捕获版本和内容指纹。
test('授权快照由当前脚本定义自动生成', () => {
  // 类型: object。
  // 作用: 使用统一构造函数创建用户确认后的完整授权状态。
  const authorization = createSourceAuthorizationState(BASE_DEFINITION, {
    // 类型: string；作用: 声明本次测试模拟用户确认授权。
    status: AUTHORIZATION_STATUS.authorized,
    // 类型: string；作用: 提供稳定授权时间供断言。
    authorizedAt: AUTHORIZED_AT
  });

  // 断言: 授权版本必须直接来自当前 definition，不能由调用方重复手写。
  assert.equal(authorization.authorizedVersion, BASE_DEFINITION.version);
  // 断言: 授权内容指纹必须直接来自当前 scriptContent。
  assert.equal(authorization.authorizedScriptHash, createSourceScriptHash(BASE_DEFINITION.scriptContent));
});

// 测试目的: 版本或脚本文本任一变化都必须使旧授权失效。
test('授权有效性同时约束版本和脚本文本', () => {
  // 类型: object。
  // 作用: 创建当前版本和文本对应的有效授权快照。
  const authorization = createSourceAuthorizationState(BASE_DEFINITION, {
    status: AUTHORIZATION_STATUS.authorized,
    authorizedAt: AUTHORIZED_AT
  });

  // 类型: object。
  // 作用: 建立初始有效记录，作为两个失效分支的共同基线。
  const validRecord = { definition: { ...BASE_DEFINITION }, authorization };

  // 断言: 状态、版本和内容指纹一致时必须判定为有效授权。
  assert.equal(evaluateSourceAuthorization(validRecord).isAuthorized, true);

  // 类型: object。
  // 作用: 只改变版本，验证旧版本授权不能继续运行新版本脚本。
  const versionChangedRecord = cloneSerializableValue(validRecord);
  versionChangedRecord.definition.version = 'v1.1.0';
  // 断言: 版本变化必须返回统一 versionChanged 原因并要求重新授权。
  assert.equal(evaluateSourceAuthorization(versionChangedRecord).reason, SOURCE_AUTHORIZATION_REASON.versionChanged);

  // 类型: object。
  // 作用: 保持版本不变但改变脚本文本，验证同版本内容变化仍会失效。
  const scriptChangedRecord = cloneSerializableValue(validRecord);
  scriptChangedRecord.definition.scriptContent += '\n// changed';
  // 断言: 内容变化必须返回统一 scriptChanged 原因并要求重新授权。
  assert.equal(evaluateSourceAuthorization(scriptChangedRecord).reason, SOURCE_AUTHORIZATION_REASON.scriptChanged);
});

// 测试目的: 装载到 store 前必须失败关闭无效的已启用默认自定义源。
test('初始化收敛会关闭失效自定义源并清空默认源', () => {
  // 类型: object。
  // 作用: 创建当前版本和脚本文本对应的初始有效授权快照。
  const authorization = createSourceAuthorizationState(BASE_DEFINITION, {
    status: AUTHORIZATION_STATUS.authorized,
    authorizedAt: AUTHORIZED_AT
  });

  // 类型: object。
  // 作用: 模拟 Repository 返回脚本文本已变化但仍声称已授权、已启用且是默认源的损坏状态。
  const sourceManagerState = {
    defaultSourceId: 'authorization-test',
    records: [{
      definition: {
        ...BASE_DEFINITION,
        id: 'authorization-test',
        scriptContent: `${BASE_DEFINITION.scriptContent}\n// repository changed`
      },
      runtime: { enabled: true },
      authorization
    }]
  };

  // 副作用: 执行和 settingsStore 初始化相同的失败关闭收敛规则。
  reconcileSourceManagerAuthorizationState(sourceManagerState);

  // 类型: object。
  // 作用: 读取收敛后的唯一记录，检查授权和启用状态。
  const reconciledRecord = sourceManagerState.records[0];

  // 断言: 失效的 authorized 保存态必须转为等待重新授权。
  assert.equal(reconciledRecord.authorization.status, AUTHORIZATION_STATUS.pending);
  // 断言: 没有有效授权的自定义源必须关闭。
  assert.equal(reconciledRecord.runtime.enabled, false);
  // 断言: 失效记录不能继续作为默认源，也不能由程序静默指定其他源。
  assert.equal(sourceManagerState.defaultSourceId, '');
});

// 测试目的: 全部 mock 记录必须满足授权、启用和默认源强制不变量。
test('数据源 mock 满足授权和默认源不变量', () => {
  // 循环类型: Array.prototype.forEach。
  // 初始值: sourceManagerMock.records 第一条记录。
  // 终止条件: 所有 mock 记录检查完成。
  // 循环作用: 防止脚本名称、版本或文本调整后遗漏授权快照同步。
  sourceManagerMock.records.forEach((record) => {
    // 类型: object。
    // 作用: 使用页面和 service 同一规则评估当前 mock 授权。
    const authorizationState = evaluateSourceAuthorization(record);

    // 条件分支: 当前记录原始状态是 authorized 时进入。
    // 执行内容: 要求其版本和内容快照必须真实有效，禁止保存矛盾授权状态。
    if (record.authorization.status === AUTHORIZATION_STATUS.authorized) {
      assert.equal(authorizationState.isAuthorized, true, `${record.definition.name} 的已授权快照与当前脚本不一致`);
    }

    // 条件分支: 当前记录是已启用自定义源时进入。
    // 执行内容: 要求它必须具备有效用户授权，禁止未授权脚本参与运行。
    if (record.definition.sourceKind === SOURCE_KIND.custom && record.runtime.enabled) {
      assert.equal(authorizationState.isAuthorized, true, `${record.definition.name} 已启用但没有当前脚本有效授权`);
    }
  });

  // 类型: object|undefined。
  // 作用: 定位初始默认源，验证默认引用、启用状态和授权状态完整性。
  const defaultSource = sourceManagerMock.records
    .find(record => record.definition.id === sourceManagerMock.defaultSourceId);

  // 断言: 初始默认源 id 必须指向真实记录。
  assert.ok(defaultSource, '初始默认数据源不存在');
  // 断言: 初始默认源必须处于启用状态。
  assert.equal(defaultSource.runtime.enabled, true, '初始默认数据源没有启用');
  // 断言: 初始默认源必须通过统一有效授权评估。
  assert.equal(evaluateSourceAuthorization(defaultSource).isAuthorized, true, '初始默认数据源授权无效');
});
