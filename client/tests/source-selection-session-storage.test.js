/*
  source-selection-session-storage.test.js 模块说明

  - 文件职责:
      验证活动数据源标签页会话适配器的唯一键、注入式存储边界、读写清理语义和非法依赖拒绝。
      测试不启动 Vue、SourceManager、IndexedDB、浏览器页面或 Provider，确保适配器本身不携带领域判断。

  - 导入库及文件汇总(3 条，内置 2 条，第三方 0 条，自定义 1 条):
      node:assert/strict: Node 内置严格断言库，验证返回值、保存键和失败路径。
      node:test: Node 内置测试注册器，提供同步用例注册。
      sourceSelectionSessionStorage: 自定义会话适配器，提供被测工厂和唯一键。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      createStorageFixture(): 创建隔离的 Storage-like 测试夹具。

  - 模块级类:
      无

  - 对外导出:
      无，测试通过 node:test 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言门面。
// 文件作用: 验证返回值、保存键、清理结果和同步异常。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test 测试注册函数。
// 文件作用: 注册相互隔离的会话适配器测试用例。
import test from 'node:test';

import {
  // 导入来源: ../src/repositories/persistence/sourceSelectionSessionStorage.js。
  // 导入内容: createSourceSelectionSessionStorage 注入式适配器工厂。
  // 文件作用: 使用测试 Storage-like 夹具创建被测适配器。
  createSourceSelectionSessionStorage,
  // 导入来源: ../src/repositories/persistence/sourceSelectionSessionStorage.js。
  // 导入内容: SOURCE_SELECTION_SESSION_KEY 唯一会话键。
  // 文件作用: 检查所有操作都使用同一保存位置。
  SOURCE_SELECTION_SESSION_KEY
} from '../src/repositories/persistence/sourceSelectionSessionStorage.js';

/**
 * 创建一次测试专用 Storage-like 夹具。
 * 纯函数: 每次调用创建独立 Map，不读取文件、浏览器或其他用例状态。
 * 成功路径: 返回实现适配器三项窄接口的对象和内部 map 观察口。
 * 失败路径: 本函数无异步操作和预期异常。
 *
 * @returns {object} Storage-like 夹具及其测试观察 Map。
 * @returns {object} return.storage 被测适配器注入的存储对象。
 * @returns {Map<string,string>} return.values 当前用例的键值保存。
 */
function createStorageFixture() {
  // 类型: Map<string,string>；作用: 让测试可以观察适配器是否只读写声明的会话键。
  const values = new Map();

  return {
    values,
    storage: {
      /**
       * 读取当前夹具中的指定键。
       * 副作用: 只读取当前夹具 Map，不共享或修改其他用例数据。
       * 成功路径: 键存在时返回保存值，不存在时模拟 Storage API 返回 null。
       * 失败路径: 当前内存夹具不抛出预期异常。
       *
       * @param {string} key 适配器请求的存储键。
       * @returns {string|null} 已保存字符串或 null。
       */
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      /**
       * 写入当前夹具中的指定键值。
       * 副作用: 把 Storage API 的字符串值写入当前用例 Map。
       * 成功路径: 覆盖同名键并结束。
       * 失败路径: 当前内存夹具不抛出预期异常。
       *
       * @param {string} key 适配器声明的存储键。
       * @param {*} value 适配器提交的值，按 Storage API 语义转换为字符串。
       * @returns {void} 写入完成后结束。
       */
      setItem(key, value) {
        values.set(key, String(value));
      },
      /**
       * 删除当前夹具中的指定键。
       * 副作用: 幂等删除当前用例 Map 中的键。
       * 成功路径: 键存在或不存在都安全结束。
       * 失败路径: 当前内存夹具不抛出预期异常。
       *
       * @param {string} key 适配器请求清理的存储键。
       * @returns {void} 清理完成后结束。
       */
      removeItem(key) {
        values.delete(key);
      }
    }
  };
}

// 测试目的: 保存、读取和清理必须只影响当前标签页的唯一活动源键，不产生第二保存位置。
test('活动源会话适配器使用唯一键完成读写清理', () => {
  // 类型: object；作用: 保存当前用例隔离的 Storage-like 依赖和 Map 观察口。
  const fixture = createStorageFixture();
  // 类型: Readonly<object>；作用: 保存使用当前夹具创建的被测会话适配器。
  const sessionStorage = createSourceSelectionSessionStorage({ storage: fixture.storage });

  // 断言: 空夹具返回空身份，表示新标签页尚未产生用户选择。
  assert.equal(sessionStorage.loadActiveSourceId(), '');

  sessionStorage.saveActiveSourceId('source-a');

  // 断言: 保存后只能从相同唯一键读回原字符串，其他键不应被创建。
  assert.equal(sessionStorage.loadActiveSourceId(), 'source-a');
  assert.deepEqual([...fixture.values.keys()], [SOURCE_SELECTION_SESSION_KEY]);

  sessionStorage.saveActiveSourceId('');

  // 断言: 空身份采用清理语义，下一次读取回到无活动源而不是保存空字符串。
  assert.equal(sessionStorage.loadActiveSourceId(), '');
  assert.equal(fixture.values.has(SOURCE_SELECTION_SESSION_KEY), false);
});

// 测试目的: 适配器必须拒绝不完整的存储依赖，防止运行时出现半可用的读写边界。
test('活动源会话适配器拒绝不完整存储接口和非字符串身份', () => {
  // 断言: 创建阶段缺少任一 Storage API 时立即失败，不偷偷切换 Memory 或其他实现。
  assert.throws(
    () => createSourceSelectionSessionStorage({ storage: {} }),
    /接口不完整/u
  );

  // 类型: object；作用: 保存非法身份断言使用的独立 Storage-like 夹具。
  const fixture = createStorageFixture();
  // 类型: Readonly<object>；作用: 保存接口完整的被测适配器，用于隔离验证身份类型失败。
  const sessionStorage = createSourceSelectionSessionStorage({ storage: fixture.storage });

  // 断言: 非字符串身份不能进入会话键，避免对象强制转换产生不可预测的恢复结果。
  assert.throws(
    () => sessionStorage.saveActiveSourceId(null),
    /必须是字符串/u
  );
});
