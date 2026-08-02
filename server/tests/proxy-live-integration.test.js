/*
  proxy-live-integration.test.js 模块说明

  - 文件职责:
      在独立 Node.js 子进程中运行真实 localhost TLS、Undici 和 Fastify 集成回归，并管理测试 CA 临时信任文件。
      父测试只负责进程隔离、结果核对和 finally 清理；生产进程不会读取测试证书或关闭 TLS 校验。

  - 导入库及文件汇总(9 条，内置 8 条，第三方 0 条，自定义 1 条):
      node:assert/strict: 核对子进程退出状态和完整场景结果。
      node:child_process#spawn: 使用参数数组派生带 NODE_EXTRA_CA_CERTS 的独立 Node.js 进程。
      node:fs/promises: 创建临时目录、写入 CA 副本并逐项删除临时产物。
      node:os#tmpdir: 把临时信任文件限制在系统临时目录。
      node:path: 定位子进程脚本和临时 CA 文件。
      node:process#process: 复用当前 Node.js 可执行文件和环境。
      node:test#test: 注册带总安全上限的真实服务集成用例。
      node:url#fileURLToPath: 从当前测试模块定位 helper。
      ./fixtures/localTlsCredentials.js#LOCAL_TLS_CERTIFICATE_PEM: 写入子进程启动时读取的测试 CA 副本。

  - 模块级常量:
      CURRENT_DIRECTORY: string，当前测试文件目录。
      CHILD_SCRIPT: string，真实服务集成子进程入口。
      TEMPORARY_CA_FILE_NAME: string，系统临时目录中的测试 CA 文件名。
      EXPECTED_SCENARIOS: ReadonlyArray<string>，步骤 3 必须完成的真实运行场景。
      CHILD_PROCESS_TIMEOUT_MS: number，先于父测试触发并终止异常子进程的上限。
      TEST_TIMEOUT_MS: number，父测试和全部子服务的最终退出上限。

  - 模块级变量:
      无

  - 模块级辅助函数:
      runChildProcess(caFilePath): 派生受信任测试 CA 的 Node.js 子进程并收集结果。
      removeTemporaryCa(tempDirectory, caFilePath): 逐项删除 CA 文件和已知空目录。

  - 模块级类:
      无

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证子进程和场景结果。
import assert from 'node:assert/strict';
// 导入来源: node:child_process；导入内容: spawn；文件作用: 派生隔离测试 CA 信任上下文。
import { spawn } from 'node:child_process';
// 导入来源: node:fs/promises；导入内容: mkdtemp、rmdir、unlink、writeFile；文件作用: 管理唯一临时 CA 文件及目录。
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
// 导入来源: node:os；导入内容: tmpdir；文件作用: 把证书副本写到操作系统临时根目录。
import { tmpdir } from 'node:os';
// 导入来源: node:path；导入内容: dirname、join；文件作用: 定位 helper 并构造临时路径。
import { dirname, join } from 'node:path';
// 导入来源: node:process；导入内容: process；文件作用: 使用当前 Node.js 二进制和继承后的安全环境。
import process from 'node:process';
// 导入来源: node:test；导入内容: test；文件作用: 注册真实本地服务集成用例和总超时。
import test from 'node:test';
// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 把 import.meta.url 转为当前测试目录。
import { fileURLToPath } from 'node:url';
// 导入来源: ./fixtures/localTlsCredentials.js；导入内容: LOCAL_TLS_CERTIFICATE_PEM；文件作用: 创建子进程只读测试 CA 副本。
import { LOCAL_TLS_CERTIFICATE_PEM } from './fixtures/localTlsCredentials.js';

// 类型: string；来源: 当前测试模块 URL；作用: 定位 helpers 子目录而不依赖进程启动目录。
const CURRENT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
// 类型: string；来源: 当前测试目录；作用: 派生执行真实 TLS 和 Fastify 检查的子进程脚本。
const CHILD_SCRIPT = join(CURRENT_DIRECTORY, 'helpers', 'runProxyLiveIntegration.js');
// 类型: string；来源: 测试临时产物约定；作用: finally 精确删除唯一 CA 文件，不递归清理未知路径。
const TEMPORARY_CA_FILE_NAME = 'localhost-test-ca.pem';
// 类型: ReadonlyArray<string>；来源: 后端步骤 3 验收；作用: 防止子进程静默跳过任一真实运行场景。
const EXPECTED_SCENARIOS = Object.freeze([
  'pinned-tls-sni',
  'redirect-revalidation',
  'raw-invalid-json',
  'stateless-cookie',
  'response-limit-release',
  'media-release',
  'timeout-release',
  'client-response-disconnect-abort'
]);
// 单位: 毫秒；来源: 父测试总预算；作用: 先终止异常子进程，为 finally 删除临时 CA 预留时间。
const CHILD_PROCESS_TIMEOUT_MS = 12000;
// 单位: 毫秒；来源: 步骤 3 本地集成测试预算；作用: 子进程或资源清理悬挂时由 node:test 强制失败。
const TEST_TIMEOUT_MS = 15000;

/**
 * 派生带测试 CA 信任的独立 Node.js 进程。
 * 调用方: 唯一真实服务集成测试。
 * 副作用: 创建一个子进程并收集 stdout/stderr；不使用 shell，不修改父进程 TLS 信任。
 * 成功路径: 子进程退出后返回退出码、信号和文本输出。
 * 失败路径: 进程无法创建时 reject；非零退出由调用方连同 stderr 断言失败。
 *
 * @param {string} caFilePath 当前测试创建的 CA 证书绝对路径。
 * @param {AbortSignal} signal 子进程执行安全上限；触发时 spawn 终止子进程。
 * @returns {Promise<{ code: number|null, signal: NodeJS.Signals|null, stdout: string, stderr: string }>} 子进程结果。
 */
function runChildProcess(caFilePath, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CHILD_SCRIPT], {
      cwd: CURRENT_DIRECTORY,
      env: { ...process.env, NODE_EXTRA_CA_CERTS: caFilePath },
      signal,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

/**
 * 删除当前测试创建的 CA 文件和已知空目录。
 * 调用方: 集成测试 finally。
 * 副作用: 只删除 mkdtemp 返回目录中的固定文件，再删除该空目录；不递归、不扫描其他临时内容。
 * 失败路径: 文件或目录删除失败向上 reject，使临时产物泄漏阻断步骤完成。
 *
 * @param {string} tempDirectory mkdtemp 创建的唯一目录。
 * @param {string} caFilePath 该目录中的固定 CA 文件。
 * @returns {Promise<void>} 两个路径均删除后完成。
 */
async function removeTemporaryCa(tempDirectory, caFilePath) {
  try {
    await unlink(caFilePath);
  } catch (error) {
    // 清理边界: 写入 CA 之前失败时文件可能不存在；其他删除错误必须继续阻断验收。
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
  await rmdir(tempDirectory);
}

// 真实运行不变量: 测试 CA 只在子进程启动时信任，全部 TLS、资源和客户端断开场景完成后临时文件必须清理。
test('本地 TLS 上游与 Fastify 生命周期完成真实集成回归', { timeout: TEST_TIMEOUT_MS }, async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'web-video-player-proxy-'));
  const caFilePath = join(tempDirectory, TEMPORARY_CA_FILE_NAME);

  try {
    await writeFile(caFilePath, LOCAL_TLS_CERTIFICATE_PEM, { encoding: 'utf8', flag: 'wx' });
    const result = await runChildProcess(caFilePath, AbortSignal.timeout(CHILD_PROCESS_TIMEOUT_MS));

    assert.equal(result.signal, null, result.stderr);
    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(result.stdout.trim());
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.scenarios, EXPECTED_SCENARIOS);
    assert.equal(result.stderr, '');
  } finally {
    // 资源清理: 成功、断言失败或子进程失败都删除 CA 副本和已知空目录，不留下证书、日志或响应体。
    await removeTemporaryCa(tempDirectory, caFilePath);
  }
});
