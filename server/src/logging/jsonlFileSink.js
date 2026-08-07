/*
  jsonlFileSink.js 模块说明

  - 文件职责:
      把达到阈值的统一事件按 JSONL 顺序写入当前日志文件，并在追加前按 UTF-8 字节执行有限编号轮转。
      每个实例只操作配置基名及其已知编号历史；首次文件故障后报告一次并停用，不影响其他 sink 或代理结果。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:buffer#Buffer: 计算格式化 JSONL 的真实 UTF-8 字节数。
      node:fs/promises: 创建目录、打开、统计、重命名和删除受控日志文件。
      node:path: 组合已解析绝对目录与安全基名，并验证目录边界。
      ./logEvent.js#getLogEventLevel、isLogLevelEnabled 与 ./logFormatters.js#formatJsonLogEvent: 复用终态级别和完整 JSON 语义。

  - 模块级常量:
      FILE_OPEN_MODE: string，当前文件追加打开模式。
      TEXT_ENCODING: string，JSONL 固定 UTF-8 编码。
      MISSING_FILE_ERROR_CODE: string，轮转时允许忽略的文件不存在错误码。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createJsonlFileSink(options): 创建单 FIFO 文件输出端。

  - 模块级类:
      无

  - 对外导出:
      createJsonlFileSink: function，后端日志组合根使用的 JSONL 文件 sink 工厂。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 计算每行追加前的真实 UTF-8 容量。
import { Buffer } from 'node:buffer';
// 导入来源: node:fs/promises；导入内容: mkdir、open、rename、stat、unlink；文件作用: 只管理配置基名对应当前和编号历史文件。
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises';
// 导入来源: node:path；导入内容: basename、isAbsolute、join；文件作用: 要求组合根交付绝对目录并防止基名包含路径。
import { basename, isAbsolute, join } from 'node:path';
// 导入来源: ./logEvent.js；导入内容: getLogEventLevel、isLogLevelEnabled；文件作用: 与 console sink 共用终态级别和阈值语义。
import { getLogEventLevel, isLogLevelEnabled } from './logEvent.js';
// 导入来源: ./logFormatters.js；导入内容: formatJsonLogEvent；文件作用: 文件始终保存统一事件全部允许字段。
import { formatJsonLogEvent } from './logFormatters.js';

// 类型: string；来源: Node FileHandle open 模式；作用: 当前文件只追加，不覆盖启动前已经存在的合法 JSONL。
const FILE_OPEN_MODE = 'a';

// 类型: string；作用: JSONL 写入和容量计算都使用 UTF-8，避免字符数与字节数漂移。
const TEXT_ENCODING = 'utf8';

// 类型: string；来源: Node 文件系统错误码；作用: 历史槽不存在是正常轮转状态，其他错误必须停用 sink。
const MISSING_FILE_ERROR_CODE = 'ENOENT';

/**
 * 创建单 FIFO JSONL 文件 sink。
 * 调用方: 后端日志组合根和文件轮转测试。
 * 状态所有权: 持有一个 Promise 队列、当前 FileHandle/字节数、接收/启用状态和一次性故障标记。
 * 状态释放: close 停止接收、等待队列、关闭句柄；文件故障也关闭句柄并永久停用。
 * 失败路径: 配置非法同步抛 TypeError；运行文件错误通过 onFailure 报告一次并由队列吸收。
 *
 * @param {object} options 文件配置和生命周期回调。
 * @param {string} options.directory 已由组合根解析的绝对日志目录。
 * @param {string} options.baseName 单一安全文件基名。
 * @param {string} options.minimumLevel 最低文件保存级别。
 * @param {number} options.maximumFileBytes 单文件 UTF-8 字节上限。
 * @param {number} options.maximumFiles 当前与历史文件总数。
 * @param {Function} options.onFailure 首次故障稳定原因回调。
 * @param {Function} [options.onRotated] 成功轮转回调。
 * @returns {Readonly<{write: Function, close: Function, isEnabled: Function}>} 冻结文件 sink。
 * @throws {TypeError} 配置不能形成有限安全文件集合时抛出。
 */
export function createJsonlFileSink({
  directory,
  baseName,
  minimumLevel,
  maximumFileBytes,
  maximumFiles,
  onFailure,
  onRotated = () => {}
}) {
  if (typeof directory !== 'string'
    || !isAbsolute(directory)
    || typeof baseName !== 'string'
    || basename(baseName) !== baseName
    || !Number.isSafeInteger(maximumFileBytes)
    || maximumFileBytes <= 0
    || !Number.isSafeInteger(maximumFiles)
    || maximumFiles < 2
    || typeof onFailure !== 'function'
    || typeof onRotated !== 'function') {
    throw new TypeError('createJsonlFileSink 需要绝对目录、安全基名、有限轮转配置和生命周期回调');
  }
  // 启动校验: minimumLevel 必须在首个文件副作用前确认，未知值不能静默丢日志。
  isLogLevelEnabled('debug', minimumLevel);

  // 类型: string；作用: 当前 JSONL 文件固定路径，历史文件只通过 historyPath 生成。
  const currentPath = join(directory, baseName);
  // 类型: number；作用: maximumFiles 包含当前文件，因此编号历史最大索引少一。
  const maximumHistoryIndex = maximumFiles - 1;
  // 类型: FileHandle|null；生命周期: 首次写入初始化至轮转/关闭/故障；作用: 串行追加当前文件。
  let fileHandle = null;
  // 类型: number；生命周期: 当前文件；作用: 每次追加前判断下一行是否需要轮转。
  let currentFileBytes = 0;
  // 类型: boolean；生命周期: 当前 sink；作用: 文件故障后阻止全部后续文件操作。
  let enabled = true;
  // 类型: boolean；生命周期: 当前 sink；作用: close 开始后拒绝新事件入队，但已入队任务继续排空。
  let accepting = true;
  // 类型: boolean；生命周期: 当前 sink；作用: onFailure 整个生命周期最多调用一次。
  let failureReported = false;
  // 类型: Promise<void>；生命周期: 当前 sink；作用: 所有初始化、轮转、追加和关闭前任务按调用顺序串行。
  let queue = Promise.resolve();

  /**
   * 生成一个已知编号历史文件路径。
   * 调用方: rotate。
   * 纯函数: 只组合当前绝对目录、基名和受限整数，不访问文件系统。
   * 失败路径: index 只由内部 1..maximumHistoryIndex 循环提供。
   *
   * @param {number} index 历史文件编号。
   * @returns {string} baseName.index 的绝对路径。
   */
  function historyPath(index) {
    return join(directory, `${baseName}.${index}`);
  }

  /**
   * 忽略指定路径不存在，保留其他文件系统错误。
   * 调用方: rotate 删除最旧和移动可能不存在的历史槽。
   * 副作用: 等待传入文件操作 Promise。
   * 失败路径: ENOENT 返回 false，其他错误原样 reject 并触发 sink 故障关闭。
   *
   * @param {Promise<unknown>} operation 当前 unlink 或 rename 操作。
   * @returns {Promise<boolean>} true 表示操作完成，false 表示源文件不存在。
   */
  async function allowMissing(operation) {
    try {
      await operation;
      return true;
    } catch (error) {
      if (error?.code === MISSING_FILE_ERROR_CODE) return false;
      throw error;
    }
  }

  /**
   * 关闭并清空当前 FileHandle。
   * 调用方: rotate、disable 和 close。
   * 副作用: 等待句柄关闭并设置 fileHandle=null。
   * 失败路径: close 异常向调用方保留，由当前队列统一停用 sink。
   *
   * @returns {Promise<void>} 没有句柄或关闭完成后结束。
   */
  async function closeCurrentHandle() {
    if (fileHandle === null) return;
    const handle = fileHandle;
    fileHandle = null;
    await handle.close();
  }

  /**
   * 报告一次文件故障并永久停用 sink。
   * 调用方: 队列 catch 和 close 失败边界。
   * 副作用: enabled/accepting 设为 false，尽力关闭句柄并调用一次 onFailure。
   * 失败路径: 句柄关闭或 onFailure 异常被吸收，不能产生未处理 reject 或影响代理。
   *
   * @param {string} reason 不含路径、Error 或堆栈的稳定原因。
   * @returns {Promise<void>} 清理和一次性通知处理完成后结束。
   */
  async function disable(reason) {
    enabled = false;
    accepting = false;
    try {
      await closeCurrentHandle();
    } catch {
      // 故障关闭: 主文件错误已经确定，句柄关闭错误不能形成第二故障事件。
    }
    if (!failureReported) {
      failureReported = true;
      try {
        onFailure(reason);
      } catch {
        // 回调边界: console/日志中心故障不能让文件队列 reject 或改变业务结果。
      }
    }
  }

  /**
   * 首次写入时创建目录、读取当前大小并打开追加句柄。
   * 调用方: appendLine 的 FIFO 任务。
   * 副作用: 创建配置目录并只统计/打开 currentPath；不扫描目录或读取其他文件。
   * 失败路径: mkdir/stat/open 错误向队列抛出并停用 sink。
   *
   * @returns {Promise<void>} 当前句柄和字节数准备完成后结束。
   */
  async function ensureInitialized() {
    if (fileHandle !== null) return;
    await mkdir(directory, { recursive: true });
    try {
      const fileStats = await stat(currentPath);
      currentFileBytes = fileStats.size;
    } catch (error) {
      if (error?.code !== MISSING_FILE_ERROR_CODE) throw error;
      currentFileBytes = 0;
    }
    fileHandle = await open(currentPath, FILE_OPEN_MODE);
  }

  /**
   * 把当前文件移到 1 号历史并顺序后移已有历史。
   * 调用方: appendLine 在下一行会超过单文件上限时。
   * 副作用: 关闭句柄、删除最旧、从大到小移动已知编号、移动当前文件并重新打开空当前文件。
   * 失败路径: ENOENT 槽位正常跳过，其他文件错误向队列抛出并停用 sink。
   *
   * @returns {Promise<void>} 新空当前文件准备完成后结束。
   */
  async function rotate() {
    await closeCurrentHandle();
    await allowMissing(unlink(historyPath(maximumHistoryIndex)));
    for (let index = maximumHistoryIndex - 1; index >= 1; index -= 1) {
      await allowMissing(rename(historyPath(index), historyPath(index + 1)));
    }
    await allowMissing(rename(currentPath, historyPath(1)));
    fileHandle = await open(currentPath, FILE_OPEN_MODE);
    currentFileBytes = 0;
  }

  /**
   * 在当前 FIFO 中追加一行，必要时先轮转。
   * 调用方: write 入队任务。
   * 副作用: 初始化目录/句柄、轮转受控文件并向当前文件追加 UTF-8 文本。
   * 失败路径: 单行超过上限或任一文件操作失败时抛出，由队列 catch 停用 sink。
   *
   * @param {string} line 已包含一个行终止符的完整 JSONL 文本。
   * @param {number} lineBytes line 的 UTF-8 字节数。
   * @returns {Promise<void>} 当前行成功落盘后结束。
   */
  async function appendLine(line, lineBytes) {
    if (!enabled) return;
    if (lineBytes > maximumFileBytes) {
      throw new RangeError('单条 JSONL 事件超过文件容量上限');
    }
    await ensureInitialized();
    if (currentFileBytes + lineBytes > maximumFileBytes) {
      await rotate();
      try {
        // 轮转通知只携带有限文件数量，不携带目录、路径或错误对象。
        onRotated(Object.freeze({ maximumFiles }));
      } catch {
        // 观察边界: 轮转已经成功，通知回调异常不能把健康文件 sink 错误停用。
      }
    }
    await fileHandle.appendFile(line, { encoding: TEXT_ENCODING });
    currentFileBytes += lineBytes;
  }

  /**
   * 把事件加入单一文件写入队列。
   * 调用方: logCenter.dispatch。
   * 副作用: 达到阈值时格式化完整 JSONL 并扩展 queue；不等待磁盘，不阻塞代理返回。
   * 成功路径: 成功入队返回 true；低于阈值、已停用或关闭中返回 false。
   * 失败路径: 格式化异常同步停用并返回 false；异步文件异常在队列 catch 中一次性报告。
   *
   * @param {Readonly<object>} event 统一日志事件。
   * @returns {boolean} 当前事件是否成功进入 FIFO。
   */
  function write(event) {
    if (!enabled || !accepting) return false;
    let line;
    try {
      if (!isLogLevelEnabled(getLogEventLevel(event), minimumLevel)) return false;
      line = `${formatJsonLogEvent(event)}\n`;
    } catch {
      void disable('format_failed');
      return false;
    }
    const lineBytes = Buffer.byteLength(line, TEXT_ENCODING);
    // 队列边界: catch 返回 disable Promise，因此 queue 始终收束为 fulfilled，不产生未处理 reject。
    queue = queue.then(() => appendLine(line, lineBytes)).catch(() => disable('write_failed'));
    return true;
  }

  /**
   * 停止接收并排空文件队列。
   * 调用方: logCenter.close。
   * 副作用: accepting=false，等待全部已入队行，最后关闭当前句柄。
   * 失败路径: 队列已经吸收写入失败；最终 close 失败调用一次 disable 并被吸收。
   *
   * @returns {Promise<void>} 队列和句柄全部收束后结束。
   */
  async function close() {
    if (!accepting && fileHandle === null) {
      await queue;
      return;
    }
    accepting = false;
    await queue;
    try {
      await closeCurrentHandle();
    } catch {
      await disable('close_failed');
    }
  }

  return Object.freeze({ write, close, isEnabled: () => enabled });
}
