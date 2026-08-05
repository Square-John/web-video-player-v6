/*
  sourceAttribution.js 模块说明

  - 文件职责:
      统一规范 Provider manifest 和 SourceDefinition 使用的作者、原站地址及署名展示字段。
      为静态 manifest 预检、运行时 manifest 对账、Repository 校验和设置页投影提供同一份纯函数规则。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SOURCE_ATTRIBUTION_POLICY: 自定义配置，提供作者缺省值、空地址和允许协议。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeSourceAttribution: 规范作者和原站地址，返回完整署名字段。
      assertValidSourceSiteUrl: 校验已声明的原站地址可以安全交给外链按钮。
      createSourceSiteDisplay: 把已保存地址投影为页面可用地址和域名，意外非法值关闭展示。

  - 模块级类:
      无

  - 对外导出:
      normalizeSourceAttribution: Function，生成完整的 authorName/siteUrl 标准字段。
      assertValidSourceSiteUrl: Function，校验 SourceDefinition 原站地址。
      createSourceSiteDisplay: Function，为只读声明页面生成安全地址和域名字段。
*/

import {
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: SOURCE_ATTRIBUTION_POLICY 署名字段规范。
  // 文件作用: 让静态预检、保存校验和页面投影共用缺省作者与安全协议。
  SOURCE_ATTRIBUTION_POLICY
} from '../config/source-manager.config.js';

/**
 * 校验可作为原站外链的 HTTPS 地址。
 * 纯函数: 只读取字符串并创建临时 URL 解析对象，不发起网络请求、不修改输入。
 * 成功路径: 空字符串表示 Provider 未提供地址；合法 HTTPS 地址按原始文本返回。
 * 失败路径: 非字符串、协议不匹配、用户名或密码存在时抛出 TypeError。
 *
 * @param {*} siteUrl 原站地址候选值。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {string} 已校验的原站地址；未声明时返回空字符串。
 * @throws {TypeError} 当地址不是空字符串或安全 HTTPS URL 时抛出。
 */
export function assertValidSourceSiteUrl(siteUrl, fieldName = 'siteUrl') {
  // 条件分支: 地址缺失或只包含空白时进入。
  // 执行内容: 统一收敛为无外链的空值，不让页面创建空 href。
  if (siteUrl === undefined || siteUrl === null || (typeof siteUrl === 'string' && !siteUrl.trim())) {
    return SOURCE_ATTRIBUTION_POLICY.emptySiteUrl;
  }

  // 条件分支: 地址不是字符串时进入。
  // 执行内容: 拒绝对象、数组和 URL 实例等非 manifest 保存类型。
  if (typeof siteUrl !== 'string') {
    throw new TypeError(`${fieldName} 必须是字符串`);
  }

  // 类型: string；作用: 去除 Provider 配置文件中地址两侧的无效空白，保持保存值可比较。
  const normalizedSiteUrl = siteUrl.trim();
  // 类型: URL|undefined；作用: 保存标准 URL 解析结果，供协议、凭据和主机名安全检查复用。
  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedSiteUrl);
  } catch {
    throw new TypeError(`${fieldName} 必须是合法 HTTPS URL`);
  }

  // 条件分支: 地址不是 HTTPS 或携带账号密码时进入。
  // 执行内容: 拒绝可执行协议和把凭据带入外链导航的地址。
  if (parsedUrl.protocol !== SOURCE_ATTRIBUTION_POLICY.siteUrlProtocol
    || parsedUrl.username
    || parsedUrl.password
    || !parsedUrl.hostname) {
    throw new TypeError(`${fieldName} 必须是无凭据的 HTTPS URL`);
  }

  return normalizedSiteUrl;
}

/**
 * 规范 Provider manifest 的署名字段。
 * 纯函数: 不修改传入对象，只返回独立冻结的作者和原站地址字段。
 * 成功路径: 缺失作者成为“佚名”，缺失地址成为空字符串，旧 manifest 因此可以继续恢复。
 * 失败路径: 非法作者或地址异常传播给静态预检、运行时对账或 Repository 入口。
 *
 * @param {*} attribution 可能包含 authorName/siteUrl 的普通对象。
 * @param {string} fieldPrefix 错误信息中的字段前缀。
 * @returns {Readonly<object>} 完整署名字段。
 * @returns {string} return.authorName 非空作者名称。
 * @returns {string} return.siteUrl 合法 HTTPS 地址或空字符串。
 * @throws {TypeError} 当字段类型或原站地址不符合契约时抛出。
 */
export function normalizeSourceAttribution(attribution, fieldPrefix = 'sourceManifest') {
  // 条件分支: 署名输入不是普通对象时进入。
  // 执行内容: 拒绝从模块执行结果或页面响应式对象直接读取字段。
  if (!attribution
    || typeof attribution !== 'object'
    || Array.isArray(attribution)
    || Object.getPrototypeOf(attribution) !== Object.prototype) {
    throw new TypeError(`${fieldPrefix} 必须是普通对象`);
  }

  // 条件分支: 作者字段存在但不是字符串时进入。
  // 执行内容: 拒绝对象、数组和数字被静默转换成作者名称。
  if (attribution.authorName !== undefined
    && attribution.authorName !== null
    && typeof attribution.authorName !== 'string') {
    throw new TypeError(`${fieldPrefix}.authorName 必须是字符串`);
  }

  // 类型: string；作用: Provider 未填写或填写空白作者时使用平台统一名称。
  const authorName = typeof attribution.authorName === 'string' && attribution.authorName.trim()
    ? attribution.authorName.trim()
    : SOURCE_ATTRIBUTION_POLICY.anonymousAuthorName;
  // 类型: string；作用: 通过统一地址校验保留合法地址或空值。
  const siteUrl = assertValidSourceSiteUrl(
    attribution.siteUrl,
    `${fieldPrefix}.siteUrl`
  );

  return Object.freeze({ authorName, siteUrl });
}

/**
 * 把 SourceDefinition 已保存地址投影为只读页面可以安全展示的地址和域名。
 * 纯函数: 只使用正式地址校验和标准 URL 解析，不访问网络、不修改 Definition。
 * 成功路径: 合法 HTTPS 地址返回原地址和 hostname；空地址返回两个空字段。
 * 失败路径: 意外非法保存值返回两个空字段，让页面不创建 href；该防御性展示边界不替代 manifest 和 Repository 的严格失败关闭。
 *
 * @param {*} siteUrl SourceDefinition.siteUrl 候选值。
 * @returns {Readonly<{siteUrl: string, siteDomain: string}>} 页面安全站点展示字段。
 */
export function createSourceSiteDisplay(siteUrl) {
  try {
    // 类型: string；来源: SourceDefinition.siteUrl；作用: 复用唯一 HTTPS 与凭据校验，防止页面单独放宽地址边界。
    const safeSiteUrl = assertValidSourceSiteUrl(siteUrl, 'SourceDefinition.siteUrl');

    // 条件分支: Definition 明确没有提供原站地址时进入；执行内容: 返回冻结空投影，不创建空 href 或伪域名。
    if (safeSiteUrl === SOURCE_ATTRIBUTION_POLICY.emptySiteUrl) {
      return Object.freeze({ siteUrl: '', siteDomain: '' });
    }

    // 类型: URL；作用: 从已经通过安全校验的地址即时派生 hostname，不保存第二份可漂移域名。
    const parsedSiteUrl = new URL(safeSiteUrl);
    return Object.freeze({
      siteUrl: safeSiteUrl,
      siteDomain: parsedSiteUrl.hostname
    });
  } catch {
    // 防御性展示边界: 非法保存值不能产生链接；正式写入入口仍由 assertValidSourceSiteUrl 抛错阻止。
    return Object.freeze({ siteUrl: '', siteDomain: '' });
  }
}
