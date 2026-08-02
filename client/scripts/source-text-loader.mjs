/*
  source-text-loader.mjs 模块说明

  - 文件职责:
      为 Node 自动测试补齐 Vite ?raw 本地文件导入语义。
      只把显式带 ?raw 的 file URL 转换为默认字符串导出，其余模块委托 Node 默认加载器。
      保证产品种子测试读取真实 datasource 原文件，不生成或维护第二份脚本副本。

  - 导入库及文件汇总(2 条，内置 2 条，第三方 0 条，自定义 0 条):
      readFile: Node 文件系统 Promise API，读取 ?raw 指向的同一物理脚本。
      fileURLToPath: Node URL 工具，把去除 query 后的 file URL 转换为本机路径。

  - 模块级常量:
      RAW_SOURCE_QUERY: string，当前加载器唯一接受的查询标记。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      load: Function，Node ESM 加载钩子。
*/

// 导入来源: node:fs/promises。
// 导入内容: readFile 异步文件读取函数。
// 文件作用: 以 UTF-8 读取 ?raw 指向的真实数据源脚本正文。
import { readFile } from 'node:fs/promises';

// 导入来源: node:url。
// 导入内容: fileURLToPath 文件 URL 转本机路径函数。
// 文件作用: 安全处理 Windows 路径、空格和非 ASCII 目录，不手工拼接文件名。
import { fileURLToPath } from 'node:url';

// 类型: string。
// 作用: 只识别与 Vite 一致的 raw 查询参数，普通 JS、JSON 和依赖模块不会进入文件文本分支。
const RAW_SOURCE_QUERY = '?raw';

/**
 * 加载一个 Node ESM 模块。
 * 文件副作用: 仅当 URL 是带 ?raw 的本地 file URL 时读取该文件一次。
 * 成功路径: raw 文件返回只含默认字符串导出的 ESM 源码；其他 URL 完整委托 nextLoad。
 * 失败路径: 非 file raw URL 或文件读取失败时抛出原生错误，测试不能回退空文本或生成 stub。
 *
 * @param {string} url Node 已解析的模块 URL。
 * @param {object} context Node 传入的加载上下文，普通模块原样转交。
 * @param {Function} nextLoad Node 默认或下一层加载器。
 * @returns {Promise<object>} Node ESM loader 结果。
 */
export async function load(url, context, nextLoad) {
  // 类型: URL。
  // 作用: 使用结构化 URL 判断协议和精确 query，避免字符串截断 Windows 路径。
  const moduleUrl = new URL(url);

  // 条件分支: 当前模块不是本地 ?raw 文件时进入。
  // 执行内容: 完整委托 Node 默认加载器，不改变普通项目模块和依赖行为。
  if (moduleUrl.protocol !== 'file:' || moduleUrl.search !== RAW_SOURCE_QUERY) {
    return nextLoad(url, context);
  }

  // 状态变化: 只从副本移除 query，保留原 pathname、编码和 hash 语义。
  moduleUrl.search = '';

  // 类型: string。
  // 作用: 读取同一物理数据源文件的 UTF-8 原文；换行规范化仍由正式授权工具负责。
  const scriptContent = await readFile(fileURLToPath(moduleUrl), 'utf8');

  // 返回值类型: object。
  // 作用: 让 Node 把 JSON 转义后的文本作为普通 ESM 默认导出，语义与 Vite ?raw 一致。
  return {
    format: 'module',
    shortCircuit: true,
    source: `export default ${JSON.stringify(scriptContent)};`
  };
}
