/*
  sourceAuthorization.js 模块说明

  - 文件职责:
      提供数据源脚本文本规范化、内容指纹、授权快照创建和有效性评估能力。
      本模块不读取 Vue、store、DOM 或浏览器状态，供 mock、store、service 和 Node 测试共同使用。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      AUTHORIZATION_STATUS、SOURCE_KIND: 自定义配置，提供授权状态和数据源类型枚举。

  - 模块级常量:
      SOURCE_SCRIPT_HASH_OFFSET_BASIS: number，FNV-1a 32 位初始偏移量。
      SOURCE_SCRIPT_HASH_PRIME: number，FNV-1a 32 位乘数。
      SOURCE_SCRIPT_HASH_RADIX: number，内容指纹输出进制。
      SOURCE_SCRIPT_HASH_LENGTH: number，内容指纹固定长度。
      SOURCE_AUTHORIZATION_REASON: object，授权有效性判断原因枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SOURCE_AUTHORIZATION_REASON: object，授权有效性判断原因枚举。
      normalizeSourceScriptContent(scriptContent): Function，统一脚本文本换行符。
      createSourceScriptHash(scriptContent): Function，生成稳定脚本内容指纹。
      createSourceAuthorizationState(definition, authorizationInput): Function，根据脚本定义创建完整授权状态。
      evaluateSourceAuthorization(record): Function，返回页面和 service 共同使用的有效授权结果。
      reconcileSourceManagerAuthorizationState(sourceManagerState): Function，收敛装载状态中的授权、启用和默认源不变量。
*/

import {
  // 导入来源: ../config/source-manager.config。
  // 导入内容: AUTHORIZATION_STATUS 运行授权状态枚举。
  // 文件作用: 创建和评估授权状态时避免使用散落字符串。
  AUTHORIZATION_STATUS,
  // 导入来源: ../config/source-manager.config。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 系统源跳过用户自定义脚本授权校验，自定义源执行完整快照比较。
  SOURCE_KIND
} from '../config/source-manager.config.js';

// 类型: number。
// 作用: FNV-1a 32 位算法标准初始偏移量，用于生成稳定但不代表安全认证的内容指纹。
const SOURCE_SCRIPT_HASH_OFFSET_BASIS = 2166136261;

// 类型: number。
// 作用: FNV-1a 32 位算法标准乘数，保证字符内容和顺序共同影响指纹结果。
const SOURCE_SCRIPT_HASH_PRIME = 16777619;

// 类型: number。
// 作用: 把无符号 32 位结果转换为紧凑十六进制文本。
const SOURCE_SCRIPT_HASH_RADIX = 16;

// 类型: number。
// 作用: 把内容指纹固定为八位文本，便于状态比较和测试诊断。
const SOURCE_SCRIPT_HASH_LENGTH = 8;

// 类型: object。
// 作用: 说明授权有效或失效的具体原因，供初始化收敛、测试和后续诊断统一判断。
export const SOURCE_AUTHORIZATION_REASON = Object.freeze({
  // 类型: string；作用: 系统源不需要进入用户自定义脚本授权流程。
  systemSource: 'system-source',
  // 类型: string；作用: 自定义脚本授权快照与当前版本和内容完全一致。
  valid: 'valid',
  // 类型: string；作用: 当前记录没有可以评估的授权结构。
  missingAuthorization: 'missing-authorization',
  // 类型: string；作用: 用户尚未授权或已经主动撤销授权。
  statusNotAuthorized: 'status-not-authorized',
  // 类型: string；作用: 当前脚本版本和授权时版本不同。
  versionChanged: 'version-changed',
  // 类型: string；作用: 当前脚本文本和授权时内容指纹不同。
  scriptChanged: 'script-changed'
});

/**
 * 规范化数据源脚本文本。
 * 纯函数: 相同输入始终返回相同字符串，不修改外部状态。
 * 规范化边界: 只统一 Windows 和旧 Mac 换行符，不 trim、不改写其他字符，避免改变脚本语义。
 *
 * @param {*} scriptContent 数据源脚本文本；非字符串输入收敛为空字符串。
 * @returns {string} 使用 LF 换行符的稳定脚本文本。
 */
export function normalizeSourceScriptContent(scriptContent) {
  // 类型: string。
  // 作用: 把非字符串输入收敛为空字符串，保证后续替换和哈希循环具有稳定边界。
  const safeScriptContent = typeof scriptContent === 'string' ? scriptContent : '';

  // 返回值类型: string。
  // 作用: 统一跨平台换行符，让同一脚本通过文件、远程或文本导入时获得一致指纹。
  return safeScriptContent.replace(/\r\n?/g, '\n');
}

/**
 * 生成数据源脚本文本的稳定 32 位 FNV-1a 内容指纹。
 * 纯函数: 相同规范化脚本文本始终返回相同结果，不读取或修改外部状态。
 * 安全边界: 该指纹只用于检测 mock 和运行态脚本是否变化，不代表脚本安全认证或密码学证明。
 *
 * @param {*} scriptContent 需要生成内容指纹的数据源脚本文本。
 * @returns {string} 固定八位小写十六进制内容指纹。
 */
export function createSourceScriptHash(scriptContent) {
  // 类型: string。
  // 作用: 使用统一换行规则整理脚本文本，避免平台换行差异制造无意义授权失效。
  const normalizedScriptContent = normalizeSourceScriptContent(scriptContent);

  // 类型: number。
  // 初始值: FNV-1a 32 位标准偏移量。
  // 作用: 在循环中累计全部 UTF-16 代码单元形成的内容指纹。
  let hashValue = SOURCE_SCRIPT_HASH_OFFSET_BASIS;

  // 循环类型: for 索引循环。
  // 初始值: scriptIndex = 0，从脚本文本第一个代码单元开始。
  // 终止条件: scriptIndex 达到规范化脚本文本长度。
  // 迭代规则: 每次递增 1，处理下一个代码单元。
  // 循环作用: 把每个字符及其顺序混合进 32 位内容指纹。
  for (let scriptIndex = 0; scriptIndex < normalizedScriptContent.length; scriptIndex += 1) {
    // 执行内容: 把当前代码单元异或进累计值，让字符变化直接影响最终结果。
    hashValue ^= normalizedScriptContent.charCodeAt(scriptIndex);

    // 执行内容: 使用稳定 32 位整数乘法并转换为无符号结果，保持浏览器和 Node 计算一致。
    hashValue = Math.imul(hashValue, SOURCE_SCRIPT_HASH_PRIME) >>> 0;
  }

  // 返回值类型: string。
  // 作用: 返回固定长度十六进制文本，供授权快照保存和有效性比较。
  return hashValue.toString(SOURCE_SCRIPT_HASH_RADIX).padStart(SOURCE_SCRIPT_HASH_LENGTH, '0');
}

/**
 * 根据当前脚本定义创建完整授权状态。
 * 纯函数: 返回新对象，不修改 definition 或 authorizationInput。
 * 已授权状态自动捕获当前版本和内容指纹；等待或撤销状态保留传入的历史快照字段。
 *
 * @param {object} definition 数据源脚本定义。
 * @param {string} definition.version 当前脚本版本，用于创建授权版本快照。
 * @param {string} definition.scriptContent 当前脚本文本，用于创建授权内容指纹。
 * @param {object} authorizationInput 授权意图或历史授权数据。
 * @param {string} authorizationInput.status 授权状态，只允许 authorized、pending 或 revoked。
 * @param {string} authorizationInput.authorizedAt 最近一次用户确认授权时间。
 * @param {string} authorizationInput.authorizedVersion 非已授权状态可保留的历史授权版本。
 * @param {string} authorizationInput.authorizedScriptHash 非已授权状态可保留的历史授权内容指纹。
 * @returns {object} 完整授权状态对象。
 * @returns {string} return.status 当前授权状态。
 * @returns {string} return.authorizedAt 最近一次用户确认授权时间。
 * @returns {string} return.authorizedVersion 授权时脚本版本快照。
 * @returns {string} return.authorizedScriptHash 授权时脚本内容指纹快照。
 */
export function createSourceAuthorizationState(definition, authorizationInput = {}) {
  // 类型: string。
  // 作用: 只接受三个受控状态，未知输入收敛为等待授权，避免生成无法展示的授权记录。
  const status = Object.values(AUTHORIZATION_STATUS).includes(authorizationInput.status)
    ? authorizationInput.status
    : AUTHORIZATION_STATUS.pending;

  // 类型: boolean。
  // 作用: 判断是否需要从当前脚本定义自动生成有效授权快照。
  const isAuthorized = status === AUTHORIZATION_STATUS.authorized;

  // 返回值类型: object。
  // 作用: 已授权时只从当前 definition 派生版本和哈希，禁止 mock 或调用方手写重复真相。
  return {
    // 类型: string；作用: 保存用户授权决定，驱动有效性评估和页面操作入口。
    status,
    // 类型: string；作用: 保存最近一次用户确认时间，没有确认记录时使用空字符串。
    authorizedAt: authorizationInput.authorizedAt || '',
    // 三目条件: isAuthorized 是否为 true。
    // true 分支: 捕获当前脚本版本作为本次授权快照。
    // false 分支: 保留历史授权版本，首次待授权时为空字符串。
    authorizedVersion: isAuthorized ? (definition.version || '') : (authorizationInput.authorizedVersion || ''),
    // 三目条件: isAuthorized 是否为 true。
    // true 分支: 从当前脚本文本生成本次授权内容指纹，消除手写哈希漂移。
    // false 分支: 保留历史授权指纹，首次待授权时为空字符串。
    authorizedScriptHash: isAuthorized
      ? createSourceScriptHash(definition.scriptContent)
      : (authorizationInput.authorizedScriptHash || '')
  };
}

/**
 * 评估一条数据源记录的有效运行授权。
 * 纯函数: 只读取记录并返回派生结果，不修改授权、启用或默认源状态。
 * 页面展示、启用校验、store 初始化和自动测试必须消费该结果，不能分别重写判断条件。
 *
 * @param {object|null} record 数据源管理记录。
 * @param {object} record.definition 数据源脚本定义。
 * @param {string} record.definition.sourceKind 系统源或自定义源类型。
 * @param {string} record.definition.version 当前脚本版本。
 * @param {string} record.definition.scriptContent 当前脚本文本。
 * @param {object} record.authorization 用户授权状态和历史快照。
 * @returns {object} 有效授权评估结果。
 * @returns {string} return.effectiveStatus 页面和操作应采用的有效授权状态。
 * @returns {boolean} return.isAuthorized 当前记录是否具备有效运行授权。
 * @returns {boolean} return.requiresAuthorization 启用前是否必须重新确认风险。
 * @returns {string} return.reason 当前结果对应的统一原因枚举。
 * @returns {string} return.currentScriptHash 当前脚本文本内容指纹。
 */
export function evaluateSourceAuthorization(record) {
  // 类型: object。
  // 作用: 给空记录提供稳定定义对象，避免详情路由失效时读取嵌套字段报错。
  const definition = record && record.definition ? record.definition : {};

  // 类型: object|null。
  // 作用: 读取保存态授权记录；缺失时由后续分支统一收敛为等待授权。
  const authorization = record && record.authorization ? record.authorization : null;

  // 类型: string。
  // 作用: 无论授权是否有效都计算当前脚本指纹，供诊断和测试指出内容变化。
  const currentScriptHash = createSourceScriptHash(definition.scriptContent);

  // 条件分支: 当前记录是系统源时进入。
  // 执行内容: 返回系统内置授权结果，不要求用户重复确认随应用提供的脚本。
  if (definition.sourceKind === SOURCE_KIND.system) {
    return {
      effectiveStatus: AUTHORIZATION_STATUS.authorized,
      isAuthorized: true,
      requiresAuthorization: false,
      reason: SOURCE_AUTHORIZATION_REASON.systemSource,
      currentScriptHash
    };
  }

  // 条件分支: 授权对象缺失时进入。
  // 执行内容: 按等待授权处理，阻止损坏记录被直接启用。
  if (!authorization) {
    return {
      effectiveStatus: AUTHORIZATION_STATUS.pending,
      isAuthorized: false,
      requiresAuthorization: true,
      reason: SOURCE_AUTHORIZATION_REASON.missingAuthorization,
      currentScriptHash
    };
  }

  // 条件分支: 用户状态不是 authorized 时进入。
  // 执行内容: 保留 pending 或 revoked 展示语义，同时要求启用前重新确认。
  if (authorization.status !== AUTHORIZATION_STATUS.authorized) {
    return {
      effectiveStatus: authorization.status === AUTHORIZATION_STATUS.revoked
        ? AUTHORIZATION_STATUS.revoked
        : AUTHORIZATION_STATUS.pending,
      isAuthorized: false,
      requiresAuthorization: true,
      reason: SOURCE_AUTHORIZATION_REASON.statusNotAuthorized,
      currentScriptHash
    };
  }

  // 条件分支: 授权版本和当前脚本版本不一致时进入。
  // 执行内容: 有效状态收敛为等待授权，防止先前脚本授权继续启用已变更脚本。
  if (authorization.authorizedVersion !== definition.version) {
    return {
      effectiveStatus: AUTHORIZATION_STATUS.pending,
      isAuthorized: false,
      requiresAuthorization: true,
      reason: SOURCE_AUTHORIZATION_REASON.versionChanged,
      currentScriptHash
    };
  }

  // 条件分支: 授权内容指纹和当前脚本文本不一致时进入。
  // 执行内容: 有效状态收敛为等待授权，覆盖同版本脚本文本变化场景。
  if (authorization.authorizedScriptHash !== currentScriptHash) {
    return {
      effectiveStatus: AUTHORIZATION_STATUS.pending,
      isAuthorized: false,
      requiresAuthorization: true,
      reason: SOURCE_AUTHORIZATION_REASON.scriptChanged,
      currentScriptHash
    };
  }

  // 返回值类型: object。
  // 作用: 当前授权状态、版本和内容指纹全部一致，允许页面显示撤销授权并允许启用。
  return {
    effectiveStatus: AUTHORIZATION_STATUS.authorized,
    isAuthorized: true,
    requiresAuthorization: false,
    reason: SOURCE_AUTHORIZATION_REASON.valid,
    currentScriptHash
  };
}

/**
 * 收敛数据源管理状态中的自定义脚本授权不变量。
 * 副作用: 修改传入的状态对象，不读取全局 store；调用方应先完成深拷贝或 Repository 数据装载。
 * 失败关闭策略: 授权结构缺失或快照失效时关闭数据源；失效记录是默认源时清空默认源，不替用户选择其他源。
 *
 * @param {object} sourceManagerState 待收敛的数据源管理状态。
 * @param {Array<object>} sourceManagerState.records 数据源记录列表。
 * @param {string} sourceManagerState.defaultSourceId 当前默认数据源 id。
 * @returns {object} 授权、启用和默认源状态已经收敛的原状态对象。
 */
export function reconcileSourceManagerAuthorizationState(sourceManagerState) {
  // 类型: Array<object>。
  // 作用: 非数组输入收敛为空数组，避免损坏初始化数据阻断设置页创建。
  const records = Array.isArray(sourceManagerState.records) ? sourceManagerState.records : [];

  // 循环类型: Array.prototype.forEach。
  // 初始值: records 第一条数据源记录。
  // 终止条件: 全部装载记录检查完成。
  // 循环作用: 对每条自定义脚本统一执行授权结构补齐和失败关闭处理。
  records.forEach((record) => {
    // 条件分支: 当前记录不存在、缺少 definition 或不是自定义源时进入。
    // 执行内容: 跳过用户脚本授权收敛，系统源继续使用应用内置信任边界。
    if (!record || !record.definition || record.definition.sourceKind !== SOURCE_KIND.custom) return;

    // 条件分支: 自定义记录缺少 authorization 对象时进入。
    // 执行内容: 创建完整等待授权结构，避免页面和 service 读取空对象。
    if (!record.authorization) {
      record.authorization = createSourceAuthorizationState(record.definition, {
        // 类型: string。
        // 作用: 缺失授权数据按等待用户确认处理，不能默认为已经授权。
        status: AUTHORIZATION_STATUS.pending
      });
    }

    // 类型: object。
    // 作用: 使用统一版本和内容指纹规则判断当前自定义脚本是否具备有效授权。
    const authorizationState = evaluateSourceAuthorization(record);

    // 条件分支: 当前授权快照仍然有效时进入。
    // 执行内容: 保留原始授权、启用和默认源状态，不执行不必要写入。
    if (authorizationState.isAuthorized) return;

    // 条件分支: 原始状态声称已授权但版本或脚本内容已经失效时进入。
    // 执行内容: 收敛为等待授权，让保存态与页面有效状态重新一致。
    if (record.authorization.status === AUTHORIZATION_STATUS.authorized) {
      record.authorization.status = AUTHORIZATION_STATUS.pending;
    }

    // 副作用: 关闭缺少有效授权的自定义源，阻止它继续参与默认源和后续数据请求。
    record.runtime.enabled = false;

    // 条件分支: 当前失效记录同时是默认数据源时进入。
    // 执行内容: 清空默认源，让用户后续自主选择，不静默切换到其他记录。
    if (sourceManagerState.defaultSourceId === record.definition.id) {
      sourceManagerState.defaultSourceId = '';
    }
  });

  // 返回值类型: object。
  // 作用: 返回同一个已收敛对象，供 store 建立响应式状态或测试检查结果。
  return sourceManagerState;
}
