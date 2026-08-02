/*
  application-config-contracts.test.js 模块说明

  - 文件职责:
      验证三份根配置当前正例、严格字段、版本、URL、端口、来源和限制失败规则。
      测试只使用内存候选，不修改正式配置或启动前后端进程。

  - 导入库及文件汇总(6 条，内置 2 条，第三方 0 条，自定义 4 条):
      assert: 内置模块，验证冻结投影和稳定错误。
      test: 内置模块，注册配置契约测试。
      PROJECT_CONFIG: 自定义配置，当前项目正例。
      FRONTEND_CONFIG: 自定义配置，当前前端正例。
      BACKEND_CONFIG: 自定义配置，当前后端正例。
      ApplicationConfigError、三个校验器和 createFrontendRuntimeConfig: 自定义契约，执行完整配置与浏览器运行投影断言。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      cloneConfig(value): 生成可修改的结构化测试候选。
      assertConfigError(callback, path): 核对稳定错误类型和字段路径。

  - 模块级类:
      无

  - 对外导出:
      无，由 node --test 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证配置投影、冻结状态和失败类型。
import assert from 'node:assert/strict';
// 导入来源: node:test；导入内容: test；文件作用: 注册无文件写入的配置契约用例。
import test from 'node:test';
// 导入来源: ../config/project.config.js；导入内容: 当前项目配置；文件作用: 证明仓库默认配置符合契约。
import PROJECT_CONFIG from '../config/project.config.js';
// 导入来源: ../config/frontend.config.js；导入内容: 当前前端配置；文件作用: 证明公开、开发和构建分区符合契约。
import FRONTEND_CONFIG from '../config/frontend.config.js';
// 导入来源: ../config/backend.config.js；导入内容: 当前后端配置；文件作用: 证明监听、CORS和限制结构符合契约。
import BACKEND_CONFIG from '../config/backend.config.js';
// 导入来源: ../scripts/startup/configContracts.mjs；导入内容: 稳定错误和三配置校验器；文件作用: 执行正反契约断言。
import {
  ApplicationConfigError,
  createFrontendRuntimeConfig,
  validateBackendConfig,
  validateFrontendConfig,
  validateProjectConfig
} from '../scripts/startup/configContracts.mjs';

/**
 * 生成可修改的结构化测试配置。
 * 纯函数: 使用 structuredClone 返回独立副本，不修改正式冻结配置。
 *
 * @param {*} value 当前正式或测试配置。
 * @returns {*} 与输入结构等价的独立可修改副本。
 */
function cloneConfig(value) {
  return structuredClone(value);
}

/**
 * 核对回调抛出指定字段的稳定配置错误。
 * 纯函数: 只执行回调并读取异常类型、code 和 path；副作用取决于回调，本文件只传纯校验器。
 * 失败路径: 回调未抛错或错误身份不一致时由 assert 抛 AssertionError。
 *
 * @param {Function} callback 应失败的同步配置校验调用。
 * @param {string} path 期望失败字段路径。
 * @returns {void} 错误完全匹配时无返回值。
 */
function assertConfigError(callback, path) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof ApplicationConfigError, true);
    assert.equal(error.code, 'APPLICATION_CONFIG_INVALID');
    assert.equal(error.path, path);
    return true;
  });
}

// 配置正例: 仓库三份默认配置必须全部得到深层冻结的规范投影。
test('三份根配置符合当前契约并返回冻结投影', () => {
  // 类型: Readonly<object>；作用: 验证项目启动配置能够进入编排器。
  const project = validateProjectConfig(PROJECT_CONFIG);
  // 类型: Readonly<object>；作用: 验证前端 origin、监听和构建路径能够进入 Vite 与浏览器启动屏障。
  const frontend = validateFrontendConfig(FRONTEND_CONFIG);
  // 类型: Readonly<object>；作用: 验证浏览器只采用版本和后端 origin，不泄漏开发服务或构建字段。
  const frontendRuntime = createFrontendRuntimeConfig(FRONTEND_CONFIG);
  // 类型: Readonly<object>；作用: 验证后端监听和来源能够进入 ProxyPolicy。
  const backend = validateBackendConfig(BACKEND_CONFIG);

  assert.equal(Object.isFrozen(project), true);
  assert.equal(Object.isFrozen(project.startup), true);
  assert.equal(Object.isFrozen(frontend.runtime), true);
  assert.equal(Object.isFrozen(frontend.developmentServer), true);
  assert.equal(Object.isFrozen(frontend.build), true);
  assert.deepEqual(frontendRuntime, {
    schemaVersion: FRONTEND_CONFIG.schemaVersion,
    backendOrigin: FRONTEND_CONFIG.runtime.backendOrigin
  });
  assert.equal(Object.isFrozen(frontendRuntime), true);
  assert.equal(Object.hasOwn(frontendRuntime, 'developmentServer'), false);
  assert.equal(Object.hasOwn(frontendRuntime, 'build'), false);
  assert.equal(Object.isFrozen(backend.server), true);
  assert.equal(Object.isFrozen(backend.server.allowedOrigins), true);
  assert.equal(Object.isFrozen(backend.limits), true);
});

// 严格字段: 拼写错误或未知字段不能被忽略后回退默认值。
test('配置对象拒绝未知字段和不兼容版本', () => {
  // 类型: object；作用: 添加未知顶层字段，证明项目配置使用精确键集合。
  const project = cloneConfig(PROJECT_CONFIG);
  project.unknown = true;
  assertConfigError(() => validateProjectConfig(project), 'projectConfig');

  // 类型: object；作用: 改写版本，证明前端配置不会采用不兼容字段语义。
  const frontend = cloneConfig(FRONTEND_CONFIG);
  frontend.schemaVersion = '2.0.0';
  assertConfigError(() => validateFrontendConfig(frontend), 'frontendConfig.schemaVersion');
});

// 前端边界: 运行时地址和构建路径不能携带协议外内容。
test('前端配置拒绝带路径后端地址和不可重定位构建路径', () => {
  // 类型: object；作用: 构造把代理路径混入 origin 的前端反例。
  const frontendWithPath = cloneConfig(FRONTEND_CONFIG);
  frontendWithPath.runtime.backendOrigin = 'https://api.example.com/proxy';
  assertConfigError(
    () => validateFrontendConfig(frontendWithPath),
    'frontendConfig.runtime.backendOrigin'
  );

  // 类型: object；作用: 构造缺少结尾斜杠的构建基础路径反例。
  const frontendWithInvalidBase = cloneConfig(FRONTEND_CONFIG);
  frontendWithInvalidBase.build.basePath = '/nested';
  assertConfigError(() => validateFrontendConfig(frontendWithInvalidBase), 'frontendConfig.build.basePath');
});

// 后端边界: 端口、CORS 和限制在创建 ProxyPolicy 前必须具有确定结构。
test('后端配置拒绝越界端口、重复来源和非正整数限制', () => {
  // 类型: object；作用: 构造超出 TCP 标准范围的后端监听端口反例。
  const backendWithPort = cloneConfig(BACKEND_CONFIG);
  backendWithPort.server.port = 70000;
  assertConfigError(() => validateBackendConfig(backendWithPort), 'backendConfig.server.port');

  // 类型: object；作用: 构造规范化后重复的浏览器来源反例。
  const backendWithDuplicateOrigin = cloneConfig(BACKEND_CONFIG);
  backendWithDuplicateOrigin.server.allowedOrigins.push('http://localhost:5173');
  assertConfigError(
    () => validateBackendConfig(backendWithDuplicateOrigin),
    'backendConfig.server.allowedOrigins'
  );

  // 类型: object；作用: 构造不能作为部署收紧值的零限制反例。
  const backendWithInvalidLimit = cloneConfig(BACKEND_CONFIG);
  backendWithInvalidLimit.limits.responseBytes = 0;
  assertConfigError(
    () => validateBackendConfig(backendWithInvalidLimit),
    'backendConfig.limits.responseBytes'
  );
});
