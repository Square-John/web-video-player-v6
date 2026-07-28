/*
  sourceRepositoryValidators.js 模块说明

  - 文件职责:
      集中校验数据源 Repository 接受的严格 JSON Value、动态键和领域保存对象。
      供 Memory Repository 和种子转换器复用，避免每个仓库分别维护字段规则。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      AUTHORIZATION_STATUS: 自定义配置，限定授权状态枚举。
      IMPORT_METHOD: 自定义配置，限定数据源导入方式枚举。
      SOURCE_KIND: 自定义配置，限定系统源和自定义源枚举。
      SourceRepositoryValidationError: 自定义错误，统一报告校验失败。

  - 模块级常量:
      SOURCE_CAPABILITY_KEYS: Array<string>，SourceDefinition 必须完整声明的六类页面能力。
      UNSAFE_RECORD_KEYS: Set<string>，禁止作为 sourceId 或 Storage key 的原型敏感键。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertString(value, fieldName): 校验字符串但允许空字符串。
      assertBoolean(value, fieldName): 校验严格 Boolean。
      assertEnumValue(value, enumObject, fieldName): 校验集中枚举值。
      assertExactObjectKeys(value, expectedKeys, fieldName): 校验对象字段集合与冻结契约一致。
      validateStrictJsonValue(value, fieldName, ancestors): 递归校验严格 JSON Value。
      validateStrictJsonArray(value, fieldName, ancestors): 校验无稀疏项和附加属性的数组。
      validateStrictJsonObject(value, fieldName, ancestors): 校验无访问器和隐藏字段的普通对象。

  - 模块级类:
      无

  - 对外导出:
      SOURCE_CAPABILITY_KEYS: Array<string>，Definition 页面能力字段清单。
      assertNonEmptyString: Function，校验非空字符串。
      assertPlainObject: Function，校验原型安全的普通对象。
      assertSafeRecordKey: Function，校验动态记录键。
      assertSerializableJsonValue: Function，校验不会被 JSON 序列化静默改写的值。
      validateSourceAuthorization: Function，校验完整授权快照。
      validateSourcePackage: Function，校验 SourcePackage。
      validateSourceDefinition: Function，校验 SourceDefinition。
      validateSourcePreferences: Function，校验 SourcePreferences。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 数据源授权状态枚举。
  // 文件作用: 阻止 Repository 保存页面无法识别的授权状态。
  AUTHORIZATION_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 保证 Definition.importMethod 只使用已冻结的四种导入方式。
  IMPORT_METHOD,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 保证 Definition.sourceKind 只区分系统源和自定义源。
  SOURCE_KIND
} from '../../config/source-manager.config.js';

import {
  // 导入来源: ./sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryValidationError Repository 校验错误类。
  // 文件作用: 所有非法输入统一抛出可被 SourceManager 和其他领域调用方识别的错误。
  SourceRepositoryValidationError
} from './sourceRepositoryErrors.js';

// 类型: Array<string>。
// 作用: 固定数据源必须声明的六类页面能力；缺失或额外字段都需要先更新正式契约。
export const SOURCE_CAPABILITY_KEYS = Object.freeze([
  'home',
  'movie',
  'tv',
  'search',
  'detail',
  'play'
]);

// 类型: Set<string>。
// 作用: 拒绝普通对象原型链中的敏感名称，防止旧对象适配器或未来序列化层误触原型行为。
const UNSAFE_RECORD_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype'
]);

/**
 * 校验字符串值。
 * 纯函数: 不修改输入；允许空字符串，用于 description、remoteUrl 和未授权快照字段。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {string} 原始字符串。
 * @throws {SourceRepositoryValidationError} 当 value 不是字符串时抛出。
 */
function assertString(value, fieldName) {
  // 条件分支: 输入不是字符串时进入。
  // 执行内容: 抛出领域校验错误，阻止 JSON 强制转换掩盖字段类型问题。
  if (typeof value !== 'string') {
    throw new SourceRepositoryValidationError(`${fieldName} 必须是字符串`);
  }

  // 返回值类型: string。
  // 作用: 返回已经验证的原始值，方便领域校验器继续组合字段规则。
  return value;
}

/**
 * 校验非空字符串。
 * 纯函数: 不修改输入；首尾全为空白的字符串视为无效。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {string} 原始非空字符串。
 * @throws {SourceRepositoryValidationError} 当 value 不是非空字符串时抛出。
 */
export function assertNonEmptyString(value, fieldName) {
  // 类型: string。
  // 作用: 先完成字符串类型校验，避免直接调用非字符串的 trim 方法。
  const stringValue = assertString(value, fieldName);

  // 条件分支: 字符串只包含空白字符时进入。
  // 执行内容: 拒绝无法稳定充当 id、引用、版本或枚举的空值。
  if (!stringValue.trim()) {
    throw new SourceRepositoryValidationError(`${fieldName} 必须是非空字符串`);
  }

  // 返回值类型: string。
  // 作用: 保留调用方原始字符串，不擅自 trim 或改变持久化内容。
  return stringValue;
}

/**
 * 校验严格 Boolean。
 * 纯函数: 不执行 Boolean 强制转换，避免字符串 false 被错误保存为 true。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {boolean} 原始 Boolean。
 * @returns {true} true 表示调用方明确声明能力可用或用户希望启用数据源。
 * @returns {false} false 表示调用方明确声明能力不可用或用户希望关闭数据源。
 * @throws {SourceRepositoryValidationError} 当 value 不是 Boolean 时抛出。
 */
function assertBoolean(value, fieldName) {
  // 条件分支: 输入不是严格 Boolean 时进入。
  // 执行内容: 拒绝 0、1 和字符串等模糊表示，保持保存契约唯一。
  if (typeof value !== 'boolean') {
    throw new SourceRepositoryValidationError(`${fieldName} 必须是 boolean`);
  }

  // 返回值类型: boolean。
  // 作用: 返回原始明确决定，不进行真值转换。
  return value;
}

/**
 * 校验普通对象。
 * 纯函数: 不修改输入；只接受 Object.prototype 原型，拒绝数组、Date、Map、Set 和自定义类实例。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {object} 原始普通对象。
 * @throws {SourceRepositoryValidationError} 当 value 不是原型安全的普通对象时抛出。
 */
export function assertPlainObject(value, fieldName) {
  // 类型: object|null。
  // 作用: 读取对象原型，用于区分普通 JSON 对象和具有自定义行为的复杂实例。
  const prototype = value && typeof value === 'object'
    ? Object.getPrototypeOf(value)
    : null;

  // 条件分支: 输入为空、数组、非对象或原型不是 Object.prototype 时进入。
  // 执行内容: 拒绝 JSON 序列化会改写语义的复杂对象。
  if (!value
    || typeof value !== 'object'
    || Array.isArray(value)
    || prototype !== Object.prototype) {
    throw new SourceRepositoryValidationError(`${fieldName} 必须是普通对象`);
  }

  // 返回值类型: object。
  // 作用: 返回已经验证的普通对象，不创建替代引用或修改原型。
  return value;
}

/**
 * 校验动态记录键。
 * 纯函数: 不修改输入；拒绝原型敏感名称，后续改用 Map 后仍保留稳定跨适配器规则。
 *
 * @param {*} key 待校验的 sourceId、Storage key 或其他动态记录键。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {string} 原始安全键。
 * @throws {SourceRepositoryValidationError} 当 key 为空或命中原型敏感名称时抛出。
 */
export function assertSafeRecordKey(key, fieldName) {
  // 类型: string。
  // 作用: 先保证动态键是稳定非空字符串。
  const safeKey = assertNonEmptyString(key, fieldName);

  // 条件分支: 动态键命中原型敏感名称时进入。
  // 执行内容: 明确拒绝跨普通对象、JSON 和 Map 适配器都容易误用的保留键。
  if (UNSAFE_RECORD_KEYS.has(safeKey)) {
    throw new SourceRepositoryValidationError(`${fieldName} 不能使用保留键: ${safeKey}`);
  }

  // 返回值类型: string。
  // 作用: 返回已经通过安全边界检查的原始键。
  return safeKey;
}

/**
 * 校验枚举字段。
 * 纯函数: 只读取枚举对象，不修改输入。
 *
 * @param {*} value 待校验枚举值。
 * @param {object} enumObject 允许值的集中枚举对象。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {string} 已验证的枚举字符串。
 * @throws {SourceRepositoryValidationError} 当 value 不在 enumObject 中时抛出。
 */
function assertEnumValue(value, enumObject, fieldName) {
  // 类型: string。
  // 作用: 先校验枚举输入是非空字符串，再检查允许值集合。
  const enumValue = assertNonEmptyString(value, fieldName);

  // 条件分支: 集中枚举不包含输入值时进入。
  // 执行内容: 阻止页面、Repository 和未来持久化层出现同义或未知状态。
  if (!Object.values(enumObject).includes(enumValue)) {
    throw new SourceRepositoryValidationError(`${fieldName} 不是受支持的枚举值: ${enumValue}`);
  }

  // 返回值类型: string。
  // 作用: 返回已验证的领域枚举值。
  return enumValue;
}

/**
 * 校验对象只包含冻结契约声明的字段。
 * 纯函数: 不修改对象或字段数组；缺失字段由后续具体字段校验报告，当前函数只拒绝未声明字段。
 *
 * @param {object} value 待检查普通对象。
 * @param {Array<string>} expectedKeys 当前契约允许的字段名。
 * @param {string} fieldName 错误信息中的对象路径。
 * @returns {object} 原始对象。
 * @throws {SourceRepositoryValidationError} 当对象包含未声明字段时抛出。
 */
function assertExactObjectKeys(value, expectedKeys, fieldName) {
  // 类型: Array<string>。
  // 作用: 找出当前契约没有声明的自有可枚举字段，防止保存态悄悄扩展影子数据。
  const unknownKeys = Object.keys(value).filter((objectKey) => {
    return !expectedKeys.includes(objectKey);
  });

  // 条件分支: 对象包含一个或多个未声明字段时进入。
  // 执行内容: 要求调用方先更新正式契约和 Schema，再保存新字段。
  if (unknownKeys.length > 0) {
    throw new SourceRepositoryValidationError(
      `${fieldName} 包含未定义字段: ${unknownKeys.join(', ')}`
    );
  }

  // 返回值类型: object。
  // 作用: 返回字段集合符合当前冻结契约的原始对象。
  return value;
}

/**
 * 递归校验严格 JSON Value。
 * 纯函数: 不修改输入；ancestors 只跟踪当前递归路径并在返回前恢复。
 * 失败策略: 拒绝 JSON.stringify 会删除、转换、调用访问器或改变实例语义的值。
 *
 * @param {*} value 当前递归值。
 * @param {string} fieldName 当前值字段路径。
 * @param {WeakSet<object>} ancestors 当前递归祖先集合，用于检测循环引用。
 * @returns {*} 原始严格 JSON Value。
 * @throws {SourceRepositoryValidationError} 当值不是严格 JSON Value 时抛出。
 */
function validateStrictJsonValue(value, fieldName, ancestors) {
  // 条件分支: null、字符串或 Boolean 时进入。
  // 执行内容: 这些类型可以无损进入 JSON，直接返回原值。
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  // 条件分支: 数字时进入。
  // 执行内容: 只接受有限数字，拒绝 JSON 会转换为 null 的 NaN 和 Infinity。
  if (typeof value === 'number') {
    // 条件分支: 数字不是有限值或是 JSON 无法保留符号语义的负零时进入。
    // 执行内容: 抛出领域校验错误，阻止序列化静默改变保存值。
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new SourceRepositoryValidationError(`${fieldName} 必须是可无损 JSON 保存的有限数字`);
    }
    return value;
  }

  // 条件分支: 数组时进入。
  // 执行内容: 交给数组专用校验，检查稀疏项、附加字段、访问器和循环引用。
  if (Array.isArray(value)) {
    return validateStrictJsonArray(value, fieldName, ancestors);
  }

  // 条件分支: 普通对象时进入。
  // 执行内容: 交给对象专用校验，检查原型、属性描述符、Symbol 和循环引用。
  if (value && typeof value === 'object') {
    return validateStrictJsonObject(value, fieldName, ancestors);
  }

  // 错误类型: SourceRepositoryValidationError。
  // 作用: 明确拒绝 undefined、函数、Symbol 和 BigInt，防止 JSON 静默删除或直接抛原生异常。
  throw new SourceRepositoryValidationError(`${fieldName} 不是严格 JSON Value`);
}

/**
 * 校验严格 JSON 数组。
 * 纯函数: 不修改数组；拒绝稀疏项、附加属性、Symbol、访问器和循环引用。
 *
 * @param {Array<*>} value 待校验数组。
 * @param {string} fieldName 数组字段路径。
 * @param {WeakSet<object>} ancestors 当前递归祖先集合。
 * @returns {Array<*>} 原始数组。
 * @throws {SourceRepositoryValidationError} 当数组会被 JSON 静默改写时抛出。
 */
function validateStrictJsonArray(value, fieldName, ancestors) {
  // 条件分支: 当前数组已经位于递归祖先链时进入。
  // 执行内容: 拒绝循环引用，避免 JSON.stringify 抛出不可控原生错误。
  if (ancestors.has(value)) {
    throw new SourceRepositoryValidationError(`${fieldName} 不能包含循环引用`);
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取数组全部自有键，确认只有 length 和有效索引参与保存。
  const ownKeys = Reflect.ownKeys(value);

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 拒绝 Symbol 和非索引附加属性，防止 JSON 静默丢弃数组元数据。
  ownKeys.forEach((propertyKey) => {
    // 条件分支: 当前自有键是数组内置 length 时进入。
    // 执行内容: 跳过 length，后续只验证实际索引属性。
    if (propertyKey === 'length') return;

    // 条件分支: 当前键不是合法数组索引字符串或索引超出数组长度时进入。
    // 执行内容: 拒绝 JSON 会忽略的 Symbol、附加字段和越界索引。
    if (typeof propertyKey !== 'string'
      || !/^(0|[1-9]\d*)$/.test(propertyKey)
      || Number(propertyKey) >= value.length) {
      throw new SourceRepositoryValidationError(`${fieldName} 不能包含非索引附加属性`);
    }
  });

  // 副作用范围: 只向当前递归祖先 WeakSet 加入本数组，函数返回前会删除。
  ancestors.add(value);

  // 循环类型: for 索引循环。
  // 初始值: itemIndex = 0。
  // 终止条件: itemIndex 达到数组 length。
  // 循环作用: 校验数组无空洞、无访问器，并递归验证每个条目。
  for (let itemIndex = 0; itemIndex < value.length; itemIndex += 1) {
    // 类型: PropertyDescriptor|undefined。
    // 作用: 直接读取索引属性描述符，避免访问 getter 产生未声明副作用。
    const descriptor = Object.getOwnPropertyDescriptor(value, String(itemIndex));

    // 条件分支: 索引缺失、不可枚举或由访问器而非数据值提供时进入。
    // 执行内容: 清理递归祖先标记并拒绝会被 JSON 改写的数组项。
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      ancestors.delete(value);
      throw new SourceRepositoryValidationError(`${fieldName}[${itemIndex}] 必须是可枚举数据项`);
    }

    validateStrictJsonValue(descriptor.value, `${fieldName}[${itemIndex}]`, ancestors);
  }

  // 副作用清理: 当前数组校验完成后移出祖先集合，允许非循环的共享引用在其他分支再次出现。
  ancestors.delete(value);

  // 返回值类型: Array<*>。
  // 作用: 返回已确认可无损 JSON 序列化的原始数组。
  return value;
}

/**
 * 校验严格 JSON 普通对象。
 * 纯函数: 不修改对象；拒绝复杂原型、Symbol、隐藏属性、访问器和循环引用。
 *
 * @param {object} value 待校验对象。
 * @param {string} fieldName 对象字段路径。
 * @param {WeakSet<object>} ancestors 当前递归祖先集合。
 * @returns {object} 原始普通对象。
 * @throws {SourceRepositoryValidationError} 当对象会被 JSON 静默改写时抛出。
 */
function validateStrictJsonObject(value, fieldName, ancestors) {
  assertPlainObject(value, fieldName);

  // 条件分支: 当前对象已经位于递归祖先链时进入。
  // 执行内容: 拒绝循环引用，保持错误类型和字段路径稳定。
  if (ancestors.has(value)) {
    throw new SourceRepositoryValidationError(`${fieldName} 不能包含循环引用`);
  }

  // 类型: Array<symbol>。
  // 作用: JSON 会忽略 Symbol 键，因此任何 Symbol 属性都必须提前拒绝。
  const symbolKeys = Object.getOwnPropertySymbols(value);

  // 条件分支: 普通对象包含至少一个 Symbol 自有属性时进入。
  // 执行内容: 拒绝 JSON 会静默忽略的对象字段。
  if (symbolKeys.length > 0) {
    throw new SourceRepositoryValidationError(`${fieldName} 不能包含 Symbol 属性`);
  }

  // 副作用范围: 只向当前递归祖先 WeakSet 加入本对象，函数返回前会删除。
  ancestors.add(value);

  // 类型: Record<string, PropertyDescriptor>。
  // 作用: 读取全部自有字符串属性，包括 JSON 会忽略的隐藏属性和访问器。
  const descriptors = Object.getOwnPropertyDescriptors(value);

  // 循环类型: Object.entries。
  // 循环作用: 校验每个字段可枚举、是数据属性，并递归验证字段值。
  Object.entries(descriptors).forEach(([propertyKey, descriptor]) => {
    // 条件分支: 当前字段不可枚举或由访问器而非数据值提供时进入。
    // 执行内容: 清理递归祖先标记并拒绝会被 JSON 忽略或触发副作用的属性。
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      ancestors.delete(value);
      throw new SourceRepositoryValidationError(`${fieldName}.${propertyKey} 必须是可枚举数据属性`);
    }

    validateStrictJsonValue(descriptor.value, `${fieldName}.${propertyKey}`, ancestors);
  });

  // 副作用清理: 当前对象校验完成后移出祖先集合，避免把共享但非循环引用误判为循环。
  ancestors.delete(value);

  // 返回值类型: object。
  // 作用: 返回已确认可无损 JSON 序列化的原始对象。
  return value;
}

/**
 * 校验严格 JSON Value。
 * 纯函数: 不修改输入；相同输入结构始终得到相同结果或同类校验错误。
 * 失败策略: 拒绝 JSON 序列化会删除字段、转换值、调用访问器或改变实例语义的输入。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 错误信息中的根字段名。
 * @returns {*} 原始严格 JSON Value。
 * @throws {SourceRepositoryValidationError} 当 value 不能无损进入 JSON 保存边界时抛出。
 */
export function assertSerializableJsonValue(value, fieldName = 'value') {
  // 类型: WeakSet<object>。
  // 作用: 只在本次递归调用中记录祖先链，用于定位循环引用，不保留模块级状态。
  const ancestors = new WeakSet();

  // 返回值类型: *。
  // 作用: 返回原始已验证值，让复制、容量和领域校验继续使用同一输入。
  return validateStrictJsonValue(value, fieldName, ancestors);
}

/**
 * 校验数据源授权快照。
 * 纯函数: 不修改授权对象；authorized 状态要求时间、版本和脚本哈希全部存在。
 *
 * @param {object} authorization 待保存授权快照。
 * @param {string} fieldName 授权对象字段路径。
 * @returns {object} 原始已验证授权对象。
 * @throws {SourceRepositoryValidationError} 当状态或快照字段不符合契约时抛出。
 */
export function validateSourceAuthorization(authorization, fieldName = 'authorization') {
  assertSerializableJsonValue(authorization, fieldName);
  assertPlainObject(authorization, fieldName);
  assertExactObjectKeys(
    authorization,
    ['status', 'authorizedAt', 'authorizedVersion', 'authorizedScriptHash'],
    fieldName
  );
  assertEnumValue(authorization.status, AUTHORIZATION_STATUS, `${fieldName}.status`);
  assertString(authorization.authorizedAt, `${fieldName}.authorizedAt`);
  assertString(authorization.authorizedVersion, `${fieldName}.authorizedVersion`);
  assertString(authorization.authorizedScriptHash, `${fieldName}.authorizedScriptHash`);

  // 条件分支: 用户状态明确为已授权时进入。
  // 执行内容: 要求当前授权快照具备时间、版本和内容指纹，避免保存无法验证的 authorized 状态。
  if (authorization.status === AUTHORIZATION_STATUS.authorized) {
    assertNonEmptyString(authorization.authorizedAt, `${fieldName}.authorizedAt`);
    assertNonEmptyString(authorization.authorizedVersion, `${fieldName}.authorizedVersion`);
    assertNonEmptyString(authorization.authorizedScriptHash, `${fieldName}.authorizedScriptHash`);
  }

  // 返回值类型: object。
  // 作用: 返回原始授权快照，由 Repository 在校验后执行隔离复制。
  return authorization;
}

/**
 * 校验 SourcePackage 保存对象。
 * 纯函数: 不修改脚本包；只校验单对象字段，跨 Definition 引用一致性由事务层处理。
 *
 * @param {object} sourcePackage 待保存脚本包。
 * @returns {object} 原始已验证 SourcePackage。
 * @throws {SourceRepositoryValidationError} 当包字段、完整性或脚本文本不符合契约时抛出。
 */
export function validateSourcePackage(sourcePackage) {
  assertSerializableJsonValue(sourcePackage, 'sourcePackage');
  assertPlainObject(sourcePackage, 'sourcePackage');
  assertExactObjectKeys(
    sourcePackage,
    ['packageRef', 'schemaVersion', 'sourceId', 'providerKey', 'scriptContent', 'integrity'],
    'sourcePackage'
  );
  assertNonEmptyString(sourcePackage.packageRef, 'sourcePackage.packageRef');
  assertNonEmptyString(sourcePackage.schemaVersion, 'sourcePackage.schemaVersion');
  assertSafeRecordKey(sourcePackage.sourceId, 'sourcePackage.sourceId');
  assertNonEmptyString(sourcePackage.providerKey, 'sourcePackage.providerKey');
  assertString(sourcePackage.scriptContent, 'sourcePackage.scriptContent');
  assertPlainObject(sourcePackage.integrity, 'sourcePackage.integrity');
  assertExactObjectKeys(
    sourcePackage.integrity,
    ['algorithm', 'scriptHash'],
    'sourcePackage.integrity'
  );
  assertNonEmptyString(sourcePackage.integrity.algorithm, 'sourcePackage.integrity.algorithm');
  assertNonEmptyString(sourcePackage.integrity.scriptHash, 'sourcePackage.integrity.scriptHash');

  // 返回值类型: object。
  // 作用: 返回原始已验证脚本包，由 Package Repository 负责隔离和保存。
  return sourcePackage;
}

/**
 * 校验 SourceDefinition 保存对象。
 * 纯函数: 不修改 Definition；严格执行字段、枚举、能力和普通设置 Schema 契约。
 *
 * @param {object} sourceDefinition 待保存数据源定义。
 * @returns {object} 原始已验证 SourceDefinition。
 * @throws {SourceRepositoryValidationError} 当任一字段不符合冻结契约时抛出。
 */
export function validateSourceDefinition(sourceDefinition) {
  assertSerializableJsonValue(sourceDefinition, 'sourceDefinition');
  assertPlainObject(sourceDefinition, 'sourceDefinition');
  assertExactObjectKeys(
    sourceDefinition,
    [
      'schemaVersion',
      'id',
      'name',
      'description',
      'sourceKind',
      'version',
      'providerKey',
      'packageRef',
      'importMethod',
      'remoteUrl',
      'importedAt',
      'lastUpdatedAt',
      'capabilities',
      'settingsSchema'
    ],
    'sourceDefinition'
  );
  assertNonEmptyString(sourceDefinition.schemaVersion, 'sourceDefinition.schemaVersion');
  assertSafeRecordKey(sourceDefinition.id, 'sourceDefinition.id');
  assertNonEmptyString(sourceDefinition.name, 'sourceDefinition.name');
  assertString(sourceDefinition.description, 'sourceDefinition.description');
  assertEnumValue(sourceDefinition.sourceKind, SOURCE_KIND, 'sourceDefinition.sourceKind');
  assertNonEmptyString(sourceDefinition.version, 'sourceDefinition.version');
  assertNonEmptyString(sourceDefinition.providerKey, 'sourceDefinition.providerKey');
  assertNonEmptyString(sourceDefinition.packageRef, 'sourceDefinition.packageRef');
  assertEnumValue(sourceDefinition.importMethod, IMPORT_METHOD, 'sourceDefinition.importMethod');
  assertString(sourceDefinition.remoteUrl, 'sourceDefinition.remoteUrl');
  assertNonEmptyString(sourceDefinition.importedAt, 'sourceDefinition.importedAt');
  assertNonEmptyString(sourceDefinition.lastUpdatedAt, 'sourceDefinition.lastUpdatedAt');
  assertPlainObject(sourceDefinition.capabilities, 'sourceDefinition.capabilities');

  // 类型: Array<string>。
  // 作用: 找出正式六类页面能力之外的字段，防止未更新契约就扩展运行能力。
  const unknownCapabilityKeys = Object.keys(sourceDefinition.capabilities).filter((capabilityKey) => {
    return !SOURCE_CAPABILITY_KEYS.includes(capabilityKey);
  });

  // 条件分支: capabilities 包含正式六类页面能力之外的字段时进入。
  // 执行内容: 拒绝未同步契约的能力扩展，避免运行层静默接受未知开关。
  if (unknownCapabilityKeys.length > 0) {
    throw new SourceRepositoryValidationError(
      `sourceDefinition.capabilities 包含未定义能力: ${unknownCapabilityKeys.join(', ')}`
    );
  }

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 要求六类能力全部存在并使用严格 Boolean，避免缺失字段被误判为关闭。
  SOURCE_CAPABILITY_KEYS.forEach((capabilityKey) => {
    assertBoolean(
      sourceDefinition.capabilities[capabilityKey],
      `sourceDefinition.capabilities.${capabilityKey}`
    );
  });

  // 条件分支: settingsSchema 不是数组时进入。
  // 执行内容: 拒绝无法作为普通设置声明列表消费的结构。
  if (!Array.isArray(sourceDefinition.settingsSchema)) {
    throw new SourceRepositoryValidationError('sourceDefinition.settingsSchema 必须是数组');
  }

  // 返回值类型: object。
  // 作用: 返回原始已验证 Definition，由 Definition Repository 负责隔离和保存。
  return sourceDefinition;
}

/**
 * 校验 SourcePreferences 保存对象。
 * 纯函数: 不修改偏好；校验默认源、软隐藏列表、每源 enabled 和授权快照。
 *
 * @param {object} sourcePreferences 待保存数据源偏好。
 * @returns {object} 原始已验证 SourcePreferences。
 * @throws {SourceRepositoryValidationError} 当全局或每源偏好不符合契约时抛出。
 */
export function validateSourcePreferences(sourcePreferences) {
  assertSerializableJsonValue(sourcePreferences, 'sourcePreferences');
  assertPlainObject(sourcePreferences, 'sourcePreferences');
  assertExactObjectKeys(
    sourcePreferences,
    ['schemaVersion', 'defaultSourceId', 'removedSystemSourceIds', 'sourceStates'],
    'sourcePreferences'
  );
  assertNonEmptyString(sourcePreferences.schemaVersion, 'sourcePreferences.schemaVersion');
  assertString(sourcePreferences.defaultSourceId, 'sourcePreferences.defaultSourceId');

  // 条件分支: defaultSourceId 非空时进入。
  // 执行内容: 校验默认源 id 不使用保留动态键；是否存在和可用由 SourceManager 负责。
  if (sourcePreferences.defaultSourceId) {
    assertSafeRecordKey(sourcePreferences.defaultSourceId, 'sourcePreferences.defaultSourceId');
  }

  // 条件分支: removedSystemSourceIds 不是数组时进入。
  // 执行内容: 拒绝无法按顺序保存系统源软隐藏选择的结构。
  if (!Array.isArray(sourcePreferences.removedSystemSourceIds)) {
    throw new SourceRepositoryValidationError('sourcePreferences.removedSystemSourceIds 必须是数组');
  }

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 校验每个软隐藏系统源 id 都是安全动态键。
  sourcePreferences.removedSystemSourceIds.forEach((sourceId, sourceIndex) => {
    assertSafeRecordKey(sourceId, `sourcePreferences.removedSystemSourceIds[${sourceIndex}]`);
  });

  assertPlainObject(sourcePreferences.sourceStates, 'sourcePreferences.sourceStates');

  // 循环类型: Object.entries。
  // 循环作用: 校验每个 sourceId 对应的用户启用决定和授权快照。
  Object.entries(sourcePreferences.sourceStates).forEach(([sourceId, sourceState]) => {
    assertSafeRecordKey(sourceId, 'sourcePreferences.sourceStates sourceId');
    assertPlainObject(sourceState, `sourcePreferences.sourceStates.${sourceId}`);
    assertExactObjectKeys(
      sourceState,
      ['enabled', 'authorization'],
      `sourcePreferences.sourceStates.${sourceId}`
    );
    assertBoolean(sourceState.enabled, `sourcePreferences.sourceStates.${sourceId}.enabled`);
    validateSourceAuthorization(
      sourceState.authorization,
      `sourcePreferences.sourceStates.${sourceId}.authorization`
    );
  });

  // 返回值类型: object。
  // 作用: 返回原始已验证偏好，由 Definition Repository 负责隔离和保存。
  return sourcePreferences;
}
