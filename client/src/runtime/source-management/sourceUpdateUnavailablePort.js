/*
  sourceUpdateUnavailablePort.js 模块说明

  - 文件职责:
      为尚未接入真实在线更新服务的应用组合提供明确失败关闭端口。
      保持 SourceManager 和 SourceManagementRuntime 所需的 check/getUpdateCandidate 形状。
      禁止生产 Runtime 回退模拟更新夹具或伪造“没有更新”的成功结果。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SourceManagementOperationError: 自定义错误，标识在线更新能力未配置的稳定操作失败。

  - 模块级常量:
      SOURCE_UPDATE_UNAVAILABLE_MESSAGE: string，未配置在线更新服务的统一诊断消息。
      SOURCE_UPDATE_PORT_PUBLIC_METHODS: ReadonlyArray<string>，失败关闭端口的公开方法顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createUnavailableError(): 创建保留原始原因的稳定设置管理操作错误。

  - 模块级类:
      无

  - 对外导出:
      createSourceUpdateUnavailablePort: Function，创建冻结且始终明确失败的更新端口。
*/

// 导入来源: ./sourceManagementErrors.js。
// 导入内容: SourceManagementOperationError 设置管理操作错误。
// 文件作用: 未配置真实在线更新服务时返回稳定错误，不伪造成功结果或读取测试夹具。
import { SourceManagementOperationError } from './sourceManagementErrors.js';

// 类型: string。
// 作用: 集中保存未配置在线更新服务的诊断文本，两个端口方法使用同一失败语义。
const SOURCE_UPDATE_UNAVAILABLE_MESSAGE = '当前应用未配置在线数据源更新服务';

// 类型: ReadonlyArray<string>。
// 作用: 固定更新端口公开方法顺序，防止组合时遗漏能力或泄漏内部状态。
const SOURCE_UPDATE_PORT_PUBLIC_METHODS = Object.freeze([
  'check',
  'getUpdateCandidate'
]);

/**
 * 创建在线更新能力不可用错误。
 * 纯函数: 每次返回独立错误链，不读取 SourceRecord、网络、Repository 或页面状态。
 * 成功路径: 无；本函数只为失败关闭端口构造稳定错误。
 * 失败路径: 返回的错误由调用端口抛出，调用方可以通过稳定 code 识别操作失败。
 *
 * @returns {SourceManagementOperationError} 在线更新能力未配置错误。
 */
function createUnavailableError() {
  // 类型: Error。
  // 作用: 保存最底层能力缺失原因，使 SourceManagementOperationError 的 cause 链完整可诊断。
  const cause = new Error(SOURCE_UPDATE_UNAVAILABLE_MESSAGE);
  return new SourceManagementOperationError(SOURCE_UPDATE_UNAVAILABLE_MESSAGE, cause);
}

/**
 * 创建在线更新失败关闭端口。
 * 副作用: 只创建并冻结两个异步方法，不访问网络、测试夹具、Repository、Manager、Host 或页面。
 * 成功路径: 返回满足 SourceUpdatePort 形状的冻结对象，允许应用基础设施完整组合。
 * 失败路径: check 和 getUpdateCandidate 均明确拒绝，禁止把能力缺失解释为“没有更新”。
 *
 * @returns {Readonly<{ check: Function, getUpdateCandidate: Function }>} 失败关闭更新端口。
 */
export function createSourceUpdateUnavailablePort() {
  /**
   * 拒绝在线更新检测。
   * 副作用: 不读取传入记录，不写 checking 状态以外的领域数据；状态复位由 SourceManager 负责。
   * 成功路径: 当前实现不存在成功路径。
   * 失败路径: 始终抛稳定设置管理操作错误。
   *
   * @returns {Promise<never>} 当前端口不会成功返回。
   * @throws {SourceManagementOperationError} 在线更新服务未配置。
   */
  async function check() {
    throw createUnavailableError();
  }

  /**
   * 拒绝读取在线更新候选。
   * 副作用: 不读取传入记录，不构造 Package/Definition，也不修改 Manager 或 Host。
   * 成功路径: 当前实现不存在成功路径。
   * 失败路径: 始终抛稳定设置管理操作错误。
   *
   * @returns {Promise<never>} 当前端口不会成功返回。
   * @throws {SourceManagementOperationError} 在线更新服务未配置。
   */
  async function getUpdateCandidate() {
    throw createUnavailableError();
  }

  // 类型: object。
  // 作用: 汇总 SourceUpdatePort 的精确两方法公开门面，不暴露消息常量或错误工厂。
  const sourceUpdatePort = { check, getUpdateCandidate };

  // 条件分支: 公开方法数量、名称或顺序偏离冻结契约时进入。
  // 执行内容: 在端口进入 Runtime 前停止，避免返回半完成失败关闭实现。
  if (Object.keys(sourceUpdatePort).length !== SOURCE_UPDATE_PORT_PUBLIC_METHODS.length
    || Object.keys(sourceUpdatePort).some(
      (methodName, index) => methodName !== SOURCE_UPDATE_PORT_PUBLIC_METHODS[index]
    )) {
    throw new TypeError('SourceUpdateUnavailablePort 公开方法顺序无效');
  }

  return Object.freeze(sourceUpdatePort);
}
