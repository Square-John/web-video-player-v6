/*
  source-display-name.test.js 模块说明

  - 文件职责:
      验证全站数据源显示名称适配器的长度、Unicode、空值和完整名称隔离边界。
      测试只调用纯函数，不访问 Provider、Runtime、Repository、浏览器或真实网络。

  - 导入库及文件汇总(3 条，内置 2 条，第三方 0 条，自定义 1 条):
      node:assert/strict: Node 内置断言库，用于验证显示规则不变量。
      node:test: Node 内置测试运行器，用于隔离执行每个显示边界场景。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      无；测试文件只由 npm 测试脚本执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 比较显示文本、Unicode 长度和兜底结果。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test 测试定义函数。
// 文件作用: 隔离执行每个数据源显示边界场景。
import test from 'node:test';

import {
  // 导入来源: ../src/utils/sourceDisplayName.js。
  // 导入内容: SOURCE_DISPLAY_NAME_MAX_LENGTH 显示边界常量。
  // 文件作用: 锁定用户界面最大字符数。
  SOURCE_DISPLAY_NAME_MAX_LENGTH,
  // 导入来源: ../src/utils/sourceDisplayName.js。
  // 导入内容: formatSourceDisplayName 统一显示适配函数。
  // 文件作用: 验证所有页面共享同一截取入口。
  formatSourceDisplayName
} from '../src/utils/sourceDisplayName.js';

// 测试目的: Provider 遵守长度约束时，显示名称保持完整且不被无意义改写。
test('数据源显示名称在边界内保持原文', () => {
  assert.equal(formatSourceDisplayName('系统数据源1'), '系统数据源1');
  assert.equal(formatSourceDisplayName('十个字符数据源名称'), '十个字符数据源名称');
});

// 测试目的: Provider 名称超长时，所有用户界面只能得到统一边界内的前十个 Unicode 字符。
test('数据源显示名称超长时截取前十个 Unicode 字符', () => {
  // 类型: string；作用: 模拟超过十个字符且混合中文与英文的 Provider 完整名称。
  const sourceName = '超长数据源名称ABCDEFGHIJKLMN';
  // 类型: string；作用: 保存统一适配器返回的短名称，用于核对内容和字符数。
  const displayName = formatSourceDisplayName(sourceName);

  assert.equal(displayName, '超长数据源名称ABC');
  assert.equal(Array.from(displayName).length, SOURCE_DISPLAY_NAME_MAX_LENGTH);
});

// 测试目的: emoji 由多个 UTF-16 单元组成时，截取不能产生半个字符或乱码。
test('数据源显示名称按 Unicode 码点截取 emoji', () => {
  // 类型: string；作用: 保存包含多字节 emoji 的适配结果，验证不会截断 UTF-16 半代理对。
  const displayName = formatSourceDisplayName('源😀😀😀😀😀😀😀😀😀😀😀😀');

  assert.equal(displayName, '源😀😀😀😀😀😀😀😀😀');
  assert.equal(Array.from(displayName).length, SOURCE_DISPLAY_NAME_MAX_LENGTH);
});

// 测试目的: 缺失名称时，显示层可以用 sourceId 或稳定占位文本继续完成渲染，不把空值显示给用户。
test('数据源显示名称缺失时使用安全兜底', () => {
  assert.equal(formatSourceDisplayName('', 'source-with-long-id'), 'source-wit');
  assert.equal(formatSourceDisplayName(null, ''), '当前数据源');
  assert.equal(formatSourceDisplayName({ name: 'invalid' }, 123), '当前数据源');
});
