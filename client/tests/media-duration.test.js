/*
  media-duration.test.js 模块说明

  - 文件职责:
      验证共享媒体时长显示适配器的输入解析、短格式边界和失败关闭语义。
      测试不启动 Vue、播放器、Provider、Store 或浏览器，只锁定可复用的纯函数行为。

  - 导入库及文件汇总(3 条，内置 2 条，第三方 0 条，自定义 1 条):
      node:assert/strict: Node 内置严格断言库。
      node:test: Node 内置测试注册器。
      ../src/utils/mediaDuration.js: 被测时长解析和格式化适配器。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 模块级辅助函数:
      无

  - 对外导出:
      无，文件由 Node test runner 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 反证每个输入边界输出精确符合时长显示契约。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test 测试注册函数。
// 文件作用: 在不启动前端运行时的前提下验证纯函数边界。
import test from 'node:test';

// 导入来源: ../src/utils/mediaDuration.js。
// 导入内容: 时长秒数解析和短格式化函数。
// 文件作用: 锁定全站视频卡片唯一显示适配入口的行为。
import {
  formatCompactMediaDuration,
  parseMediaDurationSeconds
} from '../src/utils/mediaDuration.js';

// 测试目的: 秒数和分钟文案应统一换算为短时长，且小时边界保持三段格式。
test('媒体时长适配器输出 mm:ss 或 hh:mm:ss', () => {
  // 断言作用: 合法零秒必须显示为 00:00，区别于未知时长的空文本。
  assert.equal(formatCompactMediaDuration(0), '00:00');
  // 断言作用: 45 分钟内容必须省略 00 小时并保持两位分钟。
  assert.equal(formatCompactMediaDuration('45分钟'), '45:00');
  // 断言作用: 一小时以内的最大秒边界仍使用两段短格式。
  assert.equal(formatCompactMediaDuration(3599), '59:59');
  // 断言作用: 达到一小时后必须切换到固定三段格式。
  assert.equal(formatCompactMediaDuration(3600), '01:00:00');
  // 断言作用: 已有三段文本要规范化并保持原始总时长语义。
  assert.equal(formatCompactMediaDuration('01:02:30'), '01:02:30');
  // 断言作用: 超过 59 分钟的两段文本按累计分钟解析后输出三段格式。
  assert.equal(formatCompactMediaDuration('90:00'), '01:30:00');
});

// 测试目的: 统一适配器必须拒绝无效来源，不把错误数据渲染成看似合法的总时长。
test('媒体时长适配器对无效值失败关闭', () => {
  // 断言作用: 空值、负数、NaN 和不支持文本都代表未知时长。
  assert.equal(formatCompactMediaDuration(''), '');
  assert.equal(formatCompactMediaDuration(null), '');
  assert.equal(formatCompactMediaDuration(-1), '');
  assert.equal(formatCompactMediaDuration('未知'), '');
  assert.equal(formatCompactMediaDuration('01:60'), '');
  // 断言作用: 播放历史或 Provider 的合法输入必须仍能得到整数秒数。
  assert.equal(parseMediaDurationSeconds('45分钟'), 2700);
  assert.equal(parseMediaDurationSeconds('01:02:30'), 3750);
  assert.equal(parseMediaDurationSeconds(12.9), 12);
});
