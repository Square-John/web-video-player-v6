/*
  sourceRepositoryUtils.js 模块说明

  - 文件职责:
      提供 Repository 共用的无损隔离复制、分区校验、真实容量计算和包引用工具。
      严格输入校验委托 sourceRepositoryValidators.js，本文件不再用 JSON 序列化结果猜测输入是否合法。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      SourceRepositoryValidationError: 自定义错误，统一报告不可序列化和参数校验失败。
      assertNonEmptyString: 自定义校验函数，校验 sourceId 等必填字符串。
      assertSerializableJsonValue: 自定义校验函数，复制前拒绝 JSON 会静默改写的值。

  - 模块级常量:
      SOURCE_STORAGE_PARTITION: object，私有空间五分区枚举。
      SOURCE_RUNTIME_STORAGE_PARTITIONS: Array<string>，全部缓存清理目标分区。
      SOURCE_TEMPORARY_STORAGE_PARTITIONS: Array<string>，临时缓存清理目标分区。
      PACKAGE_REF_PREFIX: string，Memory 包引用前缀。

  - 模块级变量:
      无

  - 模块级辅助函数:
      cloneSerializableValue(value, fieldName): 校验并复制严格 JSON Value。
      assertSourceStoragePartition(partition): 校验私有空间五分区。
      getSerializableByteLength(value): 计算严格 JSON Value 字节数。
      createSourcePackageRef(sourceId): 创建稳定包引用。

  - 模块级类:
      无

  - 对外导出:
      SOURCE_STORAGE_PARTITION: object，私有空间五分区枚举。
      SOURCE_RUNTIME_STORAGE_PARTITIONS: Array<string>，全部缓存清理分区。
      SOURCE_TEMPORARY_STORAGE_PARTITIONS: Array<string>，临时缓存清理分区。
      cloneSerializableValue: Function，严格 JSON Value 无损隔离复制。
      assertSourceStoragePartition: Function，私有空间分区校验。
      getSerializableByteLength: Function，严格 JSON Value UTF-8 容量计算。
      createSourcePackageRef: Function，稳定 SourcePackage 引用生成。
*/

import {
  // 导入来源: ./sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryValidationError 校验错误类。
  // 文件作用: 所有基础校验失败统一抛出可识别领域错误。
  SourceRepositoryValidationError
} from './sourceRepositoryErrors.js';

import {
  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: assertNonEmptyString 非空字符串校验函数。
  // 文件作用: 创建 packageRef 时验证 sourceId，并兼容现有 Repository 导入路径。
  assertNonEmptyString,

  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: assertSerializableJsonValue 严格 JSON Value 校验函数。
  // 文件作用: 深拷贝和容量计算前阻止字段被 JSON 静默删除或转换。
  assertSerializableJsonValue
} from './sourceRepositoryValidators.js';

// 类型: object。
// 作用: 固定私有空间五个分区，Repository 不接受额外魔法字符串。
export const SOURCE_STORAGE_PARTITION = Object.freeze({
  // 类型: string；作用: 普通非敏感设置值分区，两级缓存清理均保留。
  settings: 'settings',
  // 类型: string；作用: Cookie、Token 等敏感运行凭据分区。
  credentials: 'credentials',
  // 类型: string；作用: 验证和连续请求临时上下文分区。
  session: 'session',
  // 类型: string；作用: 可重新生成的内容和解析缓存分区。
  cache: 'cache',
  // 类型: string；作用: 有上限的检查与错误摘要分区。
  diagnostics: 'diagnostics'
});

// 类型: Array<string>。
// 作用: 定义设置页“清理全部缓存”删除的四个运行分区，明确保留 settings。
export const SOURCE_RUNTIME_STORAGE_PARTITIONS = Object.freeze([
  SOURCE_STORAGE_PARTITION.credentials,
  SOURCE_STORAGE_PARTITION.session,
  SOURCE_STORAGE_PARTITION.cache,
  SOURCE_STORAGE_PARTITION.diagnostics
]);

// 类型: Array<string>。
// 作用: 定义设置页“清理临时缓存”删除的可重新生成分区。
export const SOURCE_TEMPORARY_STORAGE_PARTITIONS = Object.freeze([
  SOURCE_STORAGE_PARTITION.cache,
  SOURCE_STORAGE_PARTITION.diagnostics
]);

// 类型: string。
// 作用: 统一根据 sourceId 创建 Memory Repository 稳定包引用。
const PACKAGE_REF_PREFIX = 'source-package::';

/**
 * 深拷贝严格 JSON Value。
 * 纯函数: 返回与输入引用完全隔离的新值，不修改输入。
 * 失败路径: 严格校验拒绝静默丢字段、特殊数字、复杂实例、访问器和循环引用。
 *
 * @param {*} value 待复制值。
 * @param {string} fieldName 错误信息中的字段名。
 * @returns {*} 与输入结构一致的隔离副本。
 * @throws {SourceRepositoryValidationError} 当输入无法稳定 JSON 序列化时抛出。
 */
export function cloneSerializableValue(value, fieldName = 'value') {
  // 执行内容: 在序列化前递归校验严格 JSON Value。
  // 成功结果: value 可以无损进入当前 JSON 保存边界。
  // 失败结果: 抛 SourceRepositoryValidationError，不执行序列化和复制。
  assertSerializableJsonValue(value, fieldName);

  try {
    // 类型: string。
    // 作用: 严格校验通过后使用 JSON 文本创建完全隔离的新对象图。
    const serializedValue = JSON.stringify(value);

    // 返回值类型: *。
    // 作用: 返回与输入字段值一致但引用完全隔离的副本。
    return JSON.parse(serializedValue);
  } catch (error) {
    // 异常来源: 内存不足或运行时 JSON 实现异常；输入结构问题已由严格校验器提前处理。
    // 处理策略: 包装成统一领域错误并保留 cause，调用方不会收到不稳定原生异常。
    throw new SourceRepositoryValidationError(`${fieldName} 无法完成 JSON 隔离复制`, { cause: error });
  }
}

/**
 * 校验私有空间分区。
 * 纯函数: 不修改输入。
 *
 * @param {*} partition 待校验分区名。
 * @returns {string} 受支持分区名。
 * @throws {SourceRepositoryValidationError} 当分区不在五分区枚举中时抛出。
 */
export function assertSourceStoragePartition(partition) {
  // 条件分支: 输入不在固定五分区枚举中时进入。
  // 执行内容: 阻止调用方用散落字符串创建未定义存储边界。
  if (!Object.values(SOURCE_STORAGE_PARTITION).includes(partition)) {
    throw new SourceRepositoryValidationError(`不支持的数据源存储分区: ${String(partition)}`);
  }

  // 返回值类型: string。
  // 作用: 返回已经验证的分区名称，供 Repository 继续定位命名空间。
  return partition;
}

/**
 * 计算可序列化值的 UTF-8 字节数。
 * 纯函数: 不修改输入；容量口径与 Repository 实际 JSON 保存边界一致。
 *
 * @param {*} value 待计算值。
 * @returns {number} JSON 文本 UTF-8 字节数。
 */
export function getSerializableByteLength(value) {
  // 类型: string。
  // 作用: 先完成严格校验和隔离复制，再生成与 Repository 保存口径一致的 JSON 文本。
  const serializedValue = JSON.stringify(cloneSerializableValue(value));

  // 返回值类型: number。
  // 作用: 返回 UTF-8 字节数，供五分区 usage 和设置页缓存摘要派生。
  return new TextEncoder().encode(serializedValue).byteLength;
}

/**
 * 根据 sourceId 创建稳定 packageRef。
 * 纯函数: 相同 sourceId 始终返回相同引用。
 *
 * @param {string} sourceId 数据源唯一标识。
 * @returns {string} Memory Repository 包引用。
 */
export function createSourcePackageRef(sourceId) {
  // 返回值类型: string。
  // 作用: 使用统一前缀和已验证 sourceId 创建稳定 Repository 引用。
  return `${PACKAGE_REF_PREFIX}${assertNonEmptyString(sourceId, 'sourceId')}`;
}
