/*
  check-release-facts.mjs 模块说明

  - 文件职责:
      为仓库根级发布验证提供独立的发布事实命令行入口。
      调用 release-facts.mjs 的只读检查能力，并用标准输出和进程退出码表达结果，不复制事实收集规则。

  - 导入库及文件汇总(3 条，内置 2 条，第三方 0 条，自定义 1 条):
      dirname/resolve: Node 内置路径函数，用于从当前脚本定位 Git 仓库根目录。
      fileURLToPath: Node 内置 URL 函数，用于把 import.meta.url 转换为本机文件路径。
      collectReleaseFactIssues: 自定义发布事实检查函数，用于返回 README 与权威源码的全部漂移问题。

  - 模块级常量:
      repositoryRoot: string，当前 Git 仓库绝对根目录。
      issues: Array<string>，本次只读发布事实检查返回的问题集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      无；由 npm run check:release-facts 直接执行并通过进程退出码表达结果。
*/

import {
  // 导入来源: node:path。
  // 导入内容: dirname 内置路径函数。
  // 文件作用: 从当前脚本路径取得 client/scripts 目录。
  dirname,

  // 导入来源: node:path。
  // 导入内容: resolve 内置路径函数。
  // 文件作用: 由 client/scripts 向上两级定位仓库根目录。
  resolve
} from 'node:path';

// 导入来源: node:url。
// 导入内容: fileURLToPath 内置 URL 转换函数。
// 文件作用: 把当前 ES module URL 转换为 Windows 或 POSIX 文件路径。
import { fileURLToPath } from 'node:url';

// 导入来源: ./release-facts.mjs。
// 导入内容: collectReleaseFactIssues 发布事实问题收集函数。
// 文件作用: 复用客户端工程闸门已经采用的唯一事实检查实现。
import { collectReleaseFactIssues } from './release-facts.mjs';

// 类型: string。
// 作用: 保存 Git 仓库绝对根目录，命令从根目录或 client 目录执行都会读取同一组权威文件。
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// 异步调用: 读取根 README、三份 package 身份及现有 Provider、数据库、设置、代理和端口权威源码。
// resolve: 返回零项或多项稳定问题。
// reject: collectReleaseFactIssues 会把预期读取失败收敛为问题数组；不可预期模块错误仍使命令失败。
// 类型: Array<string>；作用: 决定当前发布候选能否继续进入双端构建。
const issues = await collectReleaseFactIssues({ repositoryRoot });

// 条件分支: 至少存在一项发布事实问题时进入。
// 执行内容: 输出全部问题并设置非零退出码，使根级 && 命令立即停止。
if (issues.length > 0) {
  // 副作用: 向标准错误输出失败标题。
  // 影响范围: 当前 npm 命令日志，不写入文件或修改发布事实。
  console.error('发布事实检查失败：');

  // 循环类型: Array.prototype.forEach。
  // 初始值: 第一项发布事实问题。
  // 终止条件: 全部去重问题输出完成。
  // 循环作用: 给维护者显示每个需要同步的事实或文档位置。
  issues.forEach((issue) => {
    // 副作用: 向标准错误输出单项问题。
    // 影响范围: 当前命令日志，不改变后续检查输入。
    console.error(`- ${issue}`);
  });

  // 副作用: 把当前 Node 进程退出码设置为 1。
  // 影响范围: 根级 verify:release 不再运行客户端和服务端构建。
  process.exitCode = 1;
} else {
  // 副作用: 向标准输出报告发布事实检查通过。
  // 影响范围: 当前命令日志；根级验证随后继续执行两端原有 build。
  console.log('发布事实检查通过：README 与当前项目、Provider、数据库、设置、代理和端口权威源码一致。');
}
