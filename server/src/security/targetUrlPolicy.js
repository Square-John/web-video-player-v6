/*
  targetUrlPolicy.js 模块说明

  - 文件职责:
      集中解析初始目标和重定向目标的 HTTPS URL 安全规则，保证两条路径使用同一协议、凭据、片段和长度边界。
      初始输入缺陷映射为协议校验错误；上游 Location 违反边界映射为目标禁止，供校验器与转发事务共同调用。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      ../errors/proxyError.js#ProxyError: 使用冻结错误码表达初始字段缺陷和重定向安全失败。

  - 模块级常量:
      INITIAL_TARGET_ERROR_CODE: string，初始 ProxyRequestEnvelope URL 的固定错误码。
      REDIRECT_TARGET_ERROR_CODE: string，上游重定向 URL 的固定错误码。

  - 模块级变量:
      无

  - 模块级辅助函数:
      failTarget(errorCode, reason): 抛出不回显 URL 的稳定目标错误。
      parseAndValidateTargetUrl(value, limits, errorCode, baseUrl): 解析并执行共享 HTTPS 安全规则。
      normalizeInitialTargetUrl(value, limits): 校验初始绝对 URL。
      resolveRedirectTargetUrl(location, currentUrl, limits): 解析相对 Location 并重新执行全部 URL 规则。

  - 模块级类:
      无

  - 对外导出:
      normalizeInitialTargetUrl: function，请求校验器规范化初始目标。
      resolveRedirectTargetUrl: function，代理执行器逐跳规范化重定向目标。
*/

// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 将 URL 缺陷映射为冻结协议错误。
import { ProxyError } from '../errors/proxyError.js';

// 类型: string；来源: 公共协议请求字段语义；作用: 初始 URL 无效属于客户端 ProxyRequestEnvelope 校验失败。
const INITIAL_TARGET_ERROR_CODE = 'PROXY_VALIDATION_ERROR';

// 类型: string；来源: 公共协议重定向安全语义；作用: 上游 Location 越过目标边界属于代理目标禁止。
const REDIRECT_TARGET_ERROR_CODE = 'PROXY_TARGET_FORBIDDEN';

/**
 * 抛出不包含 URL、凭据或解析细节的目标错误。
 * 调用方: parseAndValidateTargetUrl。
 * 副作用: 终止当前 URL 处理；不解析 DNS、不记录日志。
 * 失败路径: 始终抛出指定冻结错误码，details 只包含稳定字段和原因。
 *
 * @param {string} errorCode 初始校验或重定向目标的冻结错误码。
 * @param {string} reason 不包含输入原值的稳定失败原因。
 * @returns {never} 本函数不会正常返回。
 * @throws {ProxyError} 固定目标错误。
 */
function failTarget(errorCode, reason) {
  throw new ProxyError(errorCode, { details: { field: 'target.url', reason } });
}

/**
 * 解析 URL 并执行共享 HTTPS、长度、凭据和片段规则。
 * 调用方: normalizeInitialTargetUrl 和 resolveRedirectTargetUrl。
 * 副作用: 创建临时 URL 对象；不执行 DNS、连接或重定向请求。
 * 失败路径: 类型、解析、协议、凭据、片段或长度不合法时抛出调用路径指定的 ProxyError。
 *
 * @param {unknown} value 初始绝对 URL 或 Location 候选文本。
 * @param {Readonly<object>} limits 当前部署目标 URL 字符上限。
 * @param {string} errorCode 当前调用路径使用的冻结错误码。
 * @param {URL|undefined} baseUrl 相对重定向解析基准；初始目标不提供。
 * @returns {URL} 通过全部文本级安全规则的新 URL 对象。
 * @throws {ProxyError} URL 不满足冻结 HTTPS 边界时抛出。
 */
function parseAndValidateTargetUrl(value, limits, errorCode, baseUrl) {
  if (typeof value !== 'string' || value.length === 0) {
    failTarget(errorCode, 'must_be_non_empty_string');
  }

  if (value.length > limits.targetUrlCharacters) {
    failTarget(errorCode, 'exceeds_character_limit');
  }

  // 类型: URL；来源: 标准 URL 解析器；作用: 初始地址要求绝对，Location 允许相对当前最终地址。
  let parsedUrl;

  try {
    parsedUrl = baseUrl === undefined ? new URL(value) : new URL(value, baseUrl);
  } catch {
    // 错误转换: URL 解析异常不回显目标原文，避免凭据或内部地址进入错误响应。
    failTarget(errorCode, 'must_be_valid_url');
  }

  // 安全边界: Proxy Protocol 2.0.0 只允许 HTTPS；部署配置不得放宽为 HTTP。
  if (parsedUrl.protocol !== 'https:') {
    failTarget(errorCode, 'https_required');
  }

  if (parsedUrl.username !== '' || parsedUrl.password !== '') {
    failTarget(errorCode, 'embedded_credentials_forbidden');
  }

  if (parsedUrl.hash !== '') {
    failTarget(errorCode, 'fragment_forbidden');
  }

  // 条件分支: 相对 Location 解析后的规范化绝对地址也必须满足部署字符上限。
  if (parsedUrl.href.length > limits.targetUrlCharacters) {
    failTarget(errorCode, 'normalized_url_exceeds_character_limit');
  }

  return parsedUrl;
}

/**
 * 校验并规范化 ProxyRequestEnvelope 初始目标 URL。
 * 调用方: proxyRequestValidator.validateTarget。
 * 副作用: 创建新 URL 对象后只返回规范化 href 字符串，不保存解析状态。
 * 失败路径: URL 规则不满足时抛 PROXY_VALIDATION_ERROR，阻止进入 DNS 解析。
 *
 * @param {unknown} value target.url 原始候选值。
 * @param {Readonly<object>} limits 当前部署 URL 容量策略。
 * @returns {string} 规范化 HTTPS 绝对地址。
 * @throws {ProxyError} 初始 URL 不满足协议时抛出。
 */
export function normalizeInitialTargetUrl(value, limits) {
  return parseAndValidateTargetUrl(value, limits, INITIAL_TARGET_ERROR_CODE).href;
}

/**
 * 解析上游 Location 并重新执行完整 URL 安全规则。
 * 调用方: proxyExecutor 的每个重定向响应。
 * 副作用: 创建新 URL 对象；不沿用上一跳 DNS 结果，也不直接发起下一跳。
 * 失败路径: Location 缺失、非法、非 HTTPS、带凭据/片段或超长时抛 PROXY_TARGET_FORBIDDEN。
 *
 * @param {unknown} location 上游响应 Location 候选值。
 * @param {string} currentUrl 当前已验证跳的规范化 URL。
 * @param {Readonly<object>} limits 当前部署 URL 容量策略。
 * @returns {string} 下一跳规范化 HTTPS 绝对地址。
 * @throws {ProxyError} 重定向目标违反安全边界时抛出。
 */
export function resolveRedirectTargetUrl(location, currentUrl, limits) {
  // 类型: URL；来源: 当前已验证跳；作用: 只作为相对 Location 的标准解析基准。
  const baseUrl = new URL(currentUrl);
  return parseAndValidateTargetUrl(location, limits, REDIRECT_TARGET_ERROR_CODE, baseUrl).href;
}
