/*
  check-builtin-source-catalog.mjs 模块说明

  - 文件职责:
      只读核对当前物理 Provider 原文、系统保存图和冻结内置目录发布身份完全一致。
      供生产构建与公开部署在发布前拒绝遗漏 revision、version 或 fingerprint 的中间状态。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      assertBuiltinSourceCatalogReleaseIntegrity: 自定义目录断言，复用浏览器启动前的唯一完整性规则。

  - 模块级常量:
      release: Readonly<object>，已经通过真实目录指纹核对的当前发布身份。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      无；由 package script 直接执行并通过进程退出状态表达结果。
*/

// 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: 生产目录完整性断言；文件作用: 与浏览器启动采用同一真实计算链。
import { assertBuiltinSourceCatalogReleaseIntegrity } from '../src/data/settings/source-repository.seed.js';

// 类型: Readonly<object>；作用: 保存已经通过真实 Provider 原文和冻结发布指纹核对的当前目录身份。
const release = assertBuiltinSourceCatalogReleaseIntegrity();

// 诊断输出: 只公开目录发布身份，不输出 Provider 脚本文本、用户数据或私有状态。
console.log(JSON.stringify({
  revision: release.revision,
  version: release.version,
  fingerprint: release.fingerprint
}));
