/*
  sourcePackageManifestParser.js 模块说明

  - 文件职责:
      使用 Acorn 在用户信任前静态解析单文件 ES module，提取并严格校验 sourceManifest。
      拒绝 import、re-export、dynamic import、default export、额外导出、计算 manifest 和越权全局能力。
      返回不含脚本文本和可执行引用的 SourceImportPreview；本模块不执行模块、不注册工厂或写 Repository。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 2 条，自定义 3 条):
      parse: 第三方 Acorn 解析器，把规范化文本转换为 ESTree AST。
      utf8ToBytes: 第三方 @noble/hashes 工具，生成预览中的 UTF-8 字节数。
      cloneSerializableValue: 自定义工具，隔离 manifest 和预览 JSON 值。
      sourcePackage 配置: 自定义边界，提供版本、字段、导出、能力、禁用全局和错误阶段。
      SourcePackageLoadError: 自定义错误，统一 parse/validate 失败字段。

  - 模块级常量:
      SOURCE_MANIFEST_DECLARATION_NAME: string，静态 manifest 导出名称。
      SOURCE_FACTORY_DECLARATION_NAME: string，工厂创建函数导出名称。
      SOURCE_ID_PATTERN: RegExp，source. 小写 ASCII 命名空间规则。
      NETWORK_HOST_PATTERN: RegExp，小写 DNS 主机名规则。
      FORBIDDEN_MODULE_NODE_TYPES: Set<string>，模块级禁用语法节点。
      SOURCE_PACKAGE_MANIFEST_PARSER_PUBLIC_METHODS: Array<string>，解析端口公开方法。
      SOURCE_IMPORT_EXECUTION_RISK: string，无沙盒同页执行风险文案。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createParserError(options): 创建 parse 或 validate 稳定错误。
      getStaticPropertyKey(property, fieldName): 读取 JSON 对象静态键。
      extractStaticJsonValue(node, fieldName): 从 AST 提取严格 JSON 字面量。
      findManifestDeclaration(program): 定位两个精确导出并提取 manifest AST。
      isIdentifierReference(parent, propertyName): 判断 Identifier 是否表示运行时能力引用。
      assertSafeModuleAst(program): 遍历 AST 并拒绝禁用模块语法和全局能力。
      assertExactFields(value, fields, fieldName): 校验普通对象精确字段。
      assertNonEmptyString(value, fieldName): 校验 manifest 非空文本。
      validateCapabilities(capabilities): 校验六类 Boolean 能力。
      validateNetworkHosts(networkHosts): 校验小写精确 DNS host 集合。
      validateSourceManifest(manifest): 校验 manifest 完整协议。
      deepFreezeJson(value): 冻结隔离 JSON 树。
      createSourcePackageManifestParser(): 创建只公开 inspect 的预检端口。

  - 模块级类:
      无

  - 对外导出:
      createSourcePackageManifestParser(): Function，创建信任前静态预检器。
*/

// 导入来源: acorn，第三方 ESTree 解析器。
// 导入内容: parse JavaScript 解析函数。
// 文件作用: 信任前只把规范化单文件文本转换成 AST，不执行任何模块语句。
import { parse } from 'acorn';

// 导入来源: @noble/hashes/utils，第三方字节工具。
// 导入内容: utf8ToBytes UTF-8 编码函数。
// 文件作用: 从已经规范化的同一脚本文本生成预览字节数。
import { utf8ToBytes } from '@noble/hashes/utils';

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON 隔离工具。
// 文件作用: manifest 与预览不保留 AST、载荷或调用方对象引用。
import { cloneSerializableValue } from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_MANIFEST_CAPABILITY_FIELDS 六类能力键。
  // 文件作用: capabilities 必须完整且不能额外扩展页面能力。
  SOURCE_MANIFEST_CAPABILITY_FIELDS,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_MANIFEST_FIELDS manifest 顶层字段。
  // 文件作用: 静态声明必须完整且拒绝未知字段。
  SOURCE_MANIFEST_FIELDS,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_ERROR_CODE 稳定错误码。
  // 文件作用: 区分语法解析、模块结构和 manifest 失败。
  SOURCE_PACKAGE_ERROR_CODE,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_FORBIDDEN_GLOBALS 禁用全局名称。
  // 文件作用: 无沙盒阶段信任前拒绝直接网络、DOM、存储和动态代码能力。
  SOURCE_PACKAGE_FORBIDDEN_GLOBALS,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_LOAD_STAGE 加载阶段。
  // 文件作用: 错误明确发生在 parse 或 validate。
  SOURCE_PACKAGE_LOAD_STAGE,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_MODULE_EXPORTS 精确导出集合。
  // 文件作用: 模块只允许 sourceManifest 和 createProviderFactory。
  SOURCE_PACKAGE_MODULE_EXPORTS,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_POLICY 版本与编码策略。
  // 文件作用: manifest schema 和 Provider ABI 必须匹配当前宿主。
  SOURCE_PACKAGE_POLICY
} from './sourcePackage.config.js';

// 导入来源: ./sourcePackageErrors.js。
// 导入内容: SourcePackageLoadError 稳定加载错误。
// 文件作用: AST 和 manifest 拒绝统一返回安全四字段错误。
import { SourcePackageLoadError } from './sourcePackageErrors.js';

// 类型: string。
// 作用: 固定静态 manifest 导出名称，不能用别名或重新导出表达。
const SOURCE_MANIFEST_DECLARATION_NAME = 'sourceManifest';

// 类型: string。
// 作用: 固定工厂创建函数导出名称，实际函数只在用户确认后调用。
const SOURCE_FACTORY_DECLARATION_NAME = 'createProviderFactory';

// 类型: RegExp。
// 作用: sourceId 必须以 source. 开头，并由小写 ASCII 字母、数字、点和连字符构成稳定命名空间。
const SOURCE_ID_PATTERN = /^source\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

// 类型: RegExp。
// 作用: networkHosts 只接受小写 DNS 名称，不允许协议、端口、路径、通配符、IP 或空标签。
const NETWORK_HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// 类型: Set<string>。
// 作用: 这些节点会引入外部模块或绕过单文件自包含边界，必须在信任前失败。
const FORBIDDEN_MODULE_NODE_TYPES = new Set([
  'ImportDeclaration',
  'ImportExpression',
  'ExportAllDeclaration',
  'ExportDefaultDeclaration'
]);

// 类型: Array<string>。
// 作用: 静态预检端口只公开 inspect，不暴露 AST、遍历器或校验辅助函数。
const SOURCE_PACKAGE_MANIFEST_PARSER_PUBLIC_METHODS = Object.freeze(['inspect']);

// 类型: string。
// 作用: 明确静态预检不是安全审计，用户信任后脚本与当前应用运行在同一前端上下文。
const SOURCE_IMPORT_EXECUTION_RISK = '用户确认后脚本将在当前前端上下文执行，静态检查不代表安全审计。';

/**
 * 创建 AST 解析或 manifest 校验错误。
 * 纯函数: 不保存 AST、脚本文本或 Acorn 原始异常。
 *
 * @param {object} options 安全错误字段。
 * @param {string} options.code 稳定错误码。
 * @param {string} options.stage parse 或 validate。
 * @param {string} options.message 用户可读说明。
 * @param {string} options.field 最小字段路径。
 * @returns {SourcePackageLoadError} 安全加载错误。
 */
function createParserError({ code, stage, message, field = '' }) {
  return new SourcePackageLoadError({ code, stage, message, field });
}

/**
 * 读取对象属性的静态 JSON 键。
 * 纯函数: 不求值 AST 表达式。
 * 失败路径: 计算属性、方法、getter/setter、spread 或非字符串键抛 manifest 错误。
 *
 * @param {object} property ESTree Property 节点。
 * @param {string} fieldName 当前对象字段路径。
 * @returns {string} 静态属性名。
 */
function getStaticPropertyKey(property, fieldName) {
  // 条件分支: 节点不是普通 init Property 或使用计算、方法、简写时进入。
  // 执行内容: 拒绝需要执行才能确定键值的 manifest 表达式。
  if (!property
    || property.type !== 'Property'
    || property.kind !== 'init'
    || property.computed
    || property.method
    || property.shorthand) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: 'sourceManifest 只能使用静态 JSON 属性。',
      field: fieldName
    });
  }

  // 条件分支: 属性键是普通标识符时进入。
  // 执行内容: 返回其静态名称，不读取任何作用域值。
  if (property.key.type === 'Identifier') return property.key.name;

  // 条件分支: 属性键是字符串字面量时进入。
  // 执行内容: 返回字符串值；数字、正则或其他字面量均拒绝。
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }

  throw createParserError({
    code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
    stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
    message: 'sourceManifest 属性名必须是静态字符串。',
    field: fieldName
  });
}

/**
 * 从 ESTree 节点提取严格 JSON Value。
 * 纯函数: 只递归读取 Literal、ArrayExpression 和 ObjectExpression，不执行表达式。
 * 失败路径: 函数、调用、模板、标识符、spread、数组空洞或危险键抛 manifest 错误。
 *
 * @param {object} node ESTree 值节点。
 * @param {string} fieldName 当前 manifest 字段路径。
 * @returns {*} 隔离 JSON Value。
 */
function extractStaticJsonValue(node, fieldName) {
  // 条件分支: 当前节点是 JSON 接受的字符串、数字、Boolean 或 null 字面量时进入。
  // 执行内容: 原样返回值；RegExp 与 bigint 不属于严格 JSON。
  if (node?.type === 'Literal'
    && (node.value === null
      || typeof node.value === 'string'
      || typeof node.value === 'number'
      || typeof node.value === 'boolean')
    && !node.regex
    && typeof node.bigint === 'undefined') {
    return node.value;
  }

  // 条件分支: 当前节点是数组字面量时进入。
  // 执行内容: 按原顺序递归提取全部非空元素，顺序保持业务语义。
  if (node?.type === 'ArrayExpression') {
    // 条件分支: 数组包含空洞或 spread 时进入。
    // 执行内容: 拒绝运行时展开和 JSON 无法精确表达的稀疏数组。
    if (node.elements.some(element => !element || element.type === 'SpreadElement')) {
      throw createParserError({
        code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
        message: 'sourceManifest 数组不能包含空项或展开语法。',
        field: fieldName
      });
    }

    return node.elements.map((element, index) => extractStaticJsonValue(
      element,
      `${fieldName}[${index}]`
    ));
  }

  // 条件分支: 当前节点是对象字面量时进入。
  // 执行内容: 逐项提取静态键值并拒绝重复或原型敏感键。
  if (node?.type === 'ObjectExpression') {
    // 类型: object。
    // 作用: 使用无原型临时容器阻止 __proto__ 等键改变提取器行为。
    const result = Object.create(null);

    // 循环类型: for...of。
    // 初始值: 对象第一项属性。
    // 终止条件: 全部属性完成静态键和值提取。
    // 循环作用: 保持声明顺序并建立严格 JSON 对象。
    for (const property of node.properties) {
      // 类型: string。
      // 作用: 读取当前属性静态键，并作为后续错误路径。
      const propertyKey = getStaticPropertyKey(property, fieldName);

      // 条件分支: 属性键危险或在同一对象重复时进入。
      // 执行内容: 拒绝原型污染和后写覆盖语义。
      if (['__proto__', 'constructor', 'prototype'].includes(propertyKey)
        || Object.hasOwn(result, propertyKey)) {
        throw createParserError({
          code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
          stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
          message: 'sourceManifest 包含危险或重复属性。',
          field: `${fieldName}.${propertyKey}`
        });
      }

      result[propertyKey] = extractStaticJsonValue(property.value, `${fieldName}.${propertyKey}`);
    }

    return { ...result };
  }

  throw createParserError({
    code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
    stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
    message: 'sourceManifest 必须是静态 JSON 字面量。',
    field: fieldName
  });
}

/**
 * 定位两个精确导出并取得 Object.freeze manifest 值节点。
 * 纯函数: 只读取 Program.body，不调用工厂或求值 manifest。
 * 失败路径: 导出来源、额外导出、声明形式或 Object.freeze 形状不符合契约时抛 module 错误。
 *
 * @param {object} program Acorn Program AST。
 * @returns {object} sourceManifest ObjectExpression 节点。
 */
function findManifestDeclaration(program) {
  // 类型: Array<object>。
  // 作用: 收集全部 named export，后续精确验证两个声明和禁止带来源再导出。
  const exportDeclarations = program.body.filter(node => node.type === 'ExportNamedDeclaration');

  // 条件分支: named export 数量不是两个时进入。
  // 执行内容: 拒绝缺少导出、额外导出和 export list 兼容入口。
  if (exportDeclarations.length !== SOURCE_PACKAGE_MODULE_EXPORTS.length) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: '数据源模块必须且只能导出 sourceManifest 和 createProviderFactory。',
      field: 'module.exports'
    });
  }

  // 条件分支: 任一 named export 携带来源或 specifier 列表时进入。
  // 执行内容: 只接受直接声明，不接受 re-export、别名或声明后集中导出。
  if (exportDeclarations.some(node => node.source !== null || node.specifiers.length > 0 || !node.declaration)) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: '数据源模块导出必须使用两个直接声明。',
      field: 'module.exports'
    });
  }

  // 类型: object|undefined。
  // 作用: 定位 export const sourceManifest 声明，不按导出顺序猜测对象。
  const manifestExport = exportDeclarations.find((node) => {
    // 类型: object。
    // 作用: 读取当前 named export 的直接声明，判断是否为精确 manifest 形式。
    const declaration = node.declaration;
    return declaration.type === 'VariableDeclaration'
      && declaration.kind === 'const'
      && declaration.declarations.length === 1
      && declaration.declarations[0].id.type === 'Identifier'
      && declaration.declarations[0].id.name === SOURCE_MANIFEST_DECLARATION_NAME;
  });

  // 类型: object|undefined。
  // 作用: 定位 export function createProviderFactory 直接函数声明。
  const factoryExport = exportDeclarations.find((node) => {
    // 类型: object。
    // 作用: 读取当前 named export 的直接声明，判断是否为精确工厂函数形式。
    const declaration = node.declaration;
    return declaration.type === 'FunctionDeclaration'
      && declaration.id?.name === SOURCE_FACTORY_DECLARATION_NAME;
  });

  // 条件分支: 任一精确声明缺失时进入。
  // 执行内容: 拒绝箭头别名、var/let、匿名函数或其他导出形式。
  if (!manifestExport || !factoryExport) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: '数据源模块导出声明形式无效。',
      field: 'module.exports'
    });
  }

  // 类型: object|null。
  // 作用: 读取 sourceManifest 唯一声明的初始化表达式，验证精确 Object.freeze 调用。
  const initializer = manifestExport.declaration.declarations[0].init;

  // 条件分支: 初始化不是 Object.freeze(<one ObjectExpression>) 时进入。
  // 执行内容: 拒绝变量引用、函数结果、条件表达式或多参数调用。
  if (!initializer
    || initializer.type !== 'CallExpression'
    || initializer.optional
    || initializer.arguments.length !== 1
    || initializer.arguments[0].type !== 'ObjectExpression'
    || initializer.callee.type !== 'MemberExpression'
    || initializer.callee.computed
    || initializer.callee.object.type !== 'Identifier'
    || initializer.callee.object.name !== 'Object'
    || initializer.callee.property.type !== 'Identifier'
    || initializer.callee.property.name !== 'freeze') {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: 'sourceManifest 必须使用 Object.freeze 包裹静态对象字面量。',
      field: 'sourceManifest'
    });
  }

  return initializer.arguments[0];
}

/**
 * 判断 Identifier 是否表示运行时值引用。
 * 纯函数: 只根据父节点和属性位置排除非计算属性键、标签及 import/export 声明名。
 *
 * @param {object|null} parent Identifier 父节点。
 * @param {string} propertyName Identifier 在父节点中的字段名。
 * @returns {boolean} true 表示应执行禁用全局名称检查。
 */
function isIdentifierReference(parent, propertyName) {
  // 条件分支: 根节点或声明名称位置没有运行时读取语义时进入。
  // 执行内容: 返回 false；声明成禁用名称仍会在其后引用时被发现。
  if (!parent || ['id', 'label'].includes(propertyName)) return false;

  // 条件分支: Identifier 是非计算成员属性名时进入。
  // 执行内容: `context.fetch` 只描述对象字段，不等于读取全局 fetch。
  if (parent.type === 'MemberExpression' && propertyName === 'property' && !parent.computed) return false;

  // 条件分支: Identifier 是非计算对象属性键时进入。
  // 执行内容: 字段名不作为全局能力引用；简写属性会通过 value 位置遍历。
  if (parent.type === 'Property' && propertyName === 'key' && !parent.computed) return false;

  return true;
}

/**
 * 遍历 AST 并拒绝模块外部依赖和越权全局能力。
 * 纯函数: 不修改 AST；使用显式堆栈避免对大脚本递归调用栈失控。
 * 失败路径: 禁用节点、带来源 named export 或禁用全局引用抛 module 错误。
 *
 * @param {object} program Acorn Program AST。
 * @returns {void} 全部节点安全通过时结束。
 */
function assertSafeModuleAst(program) {
  // 类型: Array<object>。
  // 作用: 保存待检查节点、父节点和属性位置；先入后出顺序不改变校验结果。
  const pendingNodes = [{ node: program, parent: null, propertyName: '' }];

  // 循环类型: while 显式 AST 遍历。
  // 初始值: Program 根节点。
  // 终止条件: 所有可遍历子节点已弹出并检查。
  // 循环作用: 覆盖文件内辅助函数和工厂函数体，不只检查顶层导出。
  while (pendingNodes.length > 0) {
    // 类型: object。
    // 作用: 取出当前待检查节点及其语义位置。
    const { node, parent, propertyName } = pendingNodes.pop();

    // 条件分支: 当前节点属于 import、dynamic import、export all 或 default export 时进入。
    // 执行内容: 在用户信任前拒绝单文件外部依赖和额外导出入口。
    if (FORBIDDEN_MODULE_NODE_TYPES.has(node.type)) {
      throw createParserError({
        code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
        message: '数据源模块包含禁止的导入或导出语法。',
        field: 'module'
      });
    }

    // 条件分支: named export 携带 source 时进入。
    // 执行内容: 拒绝 export { value } from 或其他再导出形式。
    if (node.type === 'ExportNamedDeclaration' && node.source !== null) {
      throw createParserError({
        code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
        message: '数据源模块不能从其他文件重新导出。',
        field: 'module.exports'
      });
    }

    // 条件分支: 当前 Identifier 是运行时引用且名称属于禁用全局时进入。
    // 执行内容: 强制 Provider 后续只通过 SourceContext 使用网络、存储和挑战能力。
    if (node.type === 'Identifier'
      && isIdentifierReference(parent, propertyName)
      && SOURCE_PACKAGE_FORBIDDEN_GLOBALS.includes(node.name)) {
      throw createParserError({
        code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
        message: `数据源模块不能直接使用全局能力 ${node.name}。`,
        field: 'module'
      });
    }

    // 循环类型: Object.entries。
    // 初始值: 当前 ESTree 节点第一个字段。
    // 终止条件: 全部对象或节点数组子项加入待检查堆栈。
    // 循环作用: 使用结构遍历覆盖 Acorn 当前语法节点，不依赖另一套 walker 版本。
    Object.entries(node).forEach(([childPropertyName, childValue]) => {
      // 条件分支: 位置信息、原始字面量或空值不属于 AST 子节点时进入。
      // 执行内容: 跳过标量，避免把 location 对象误当节点。
      if (!childValue || ['start', 'end', 'loc', 'raw'].includes(childPropertyName)) return;

      // 条件分支: 当前字段是 AST 节点数组时进入。
      // 执行内容: 只加入具有字符串 type 的真实子节点。
      if (Array.isArray(childValue)) {
        childValue.forEach((childNode) => {
          // 条件分支: 数组元素是具有字符串 type 的 ESTree 节点时进入。
          // 执行内容: 加入待检查堆栈；空节点和普通数据对象不参与遍历。
          if (childNode && typeof childNode.type === 'string') {
            pendingNodes.push({ node: childNode, parent: node, propertyName: childPropertyName });
          }
        });
        return;
      }

      // 条件分支: 当前字段是单个 ESTree 子节点时进入。
      // 执行内容: 加入堆栈并保留父节点和属性位置。
      if (typeof childValue === 'object' && typeof childValue.type === 'string') {
        pendingNodes.push({ node: childValue, parent: node, propertyName: childPropertyName });
      }
    });
  }
}

/**
 * 校验普通对象精确字段集合。
 * 纯函数: 不修改对象或字段数组。
 * 失败路径: 非普通对象、Symbol、缺失或额外字段抛 manifest 错误。
 *
 * @param {*} value 对象候选。
 * @param {Array<string>} fields 允许且必需字段。
 * @param {string} fieldName 错误路径。
 * @returns {object} 原已验证对象。
 */
function assertExactFields(value, fields, fieldName) {
  // 条件分支: 候选不是原型安全普通对象时进入。
  // 执行内容: 拒绝数组、null 和复杂实例。
  if (!value
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: `${fieldName} 必须是普通对象。`,
      field: fieldName
    });
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取全部自有键，Symbol 也不能绕过精确字段门禁。
  const actualFields = Reflect.ownKeys(value);

  // 条件分支: 数量不同、存在 Symbol、缺失字段或额外字段时进入。
  // 执行内容: 拒绝隐式默认和向后兼容字段。
  if (actualFields.length !== fields.length
    || actualFields.some(field => typeof field !== 'string' || !fields.includes(field))) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: `${fieldName} 字段集合无效。`,
      field: fieldName
    });
  }

  return value;
}

/**
 * 校验 manifest 非空字符串字段。
 * 纯函数: 不 trim 或改写保存文本。
 *
 * @param {*} value 字符串候选。
 * @param {string} fieldName 错误字段路径。
 * @returns {string} 原非空字符串。
 */
function assertNonEmptyString(value, fieldName) {
  // 条件分支: 候选不是字符串或只含空白时进入。
  // 执行内容: 拒绝无法稳定展示或参与身份比较的值。
  if (typeof value !== 'string' || value.trim() === '') {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: `${fieldName} 必须是非空字符串。`,
      field: fieldName
    });
  }

  return value;
}

/**
 * 校验六类页面能力完整使用 Boolean。
 * 纯函数: 不修改 capabilities。
 *
 * @param {*} capabilities 能力对象候选。
 * @returns {object} 原已验证能力对象。
 */
function validateCapabilities(capabilities) {
  // 类型: object。
  // 作用: 保存字段完整的能力对象，后续只检查六项值类型。
  const safeCapabilities = assertExactFields(
    capabilities,
    SOURCE_MANIFEST_CAPABILITY_FIELDS,
    'sourceManifest.capabilities'
  );

  // 类型: string|undefined。
  // 作用: 定位第一项非严格 Boolean 能力，给出稳定字段路径。
  const invalidCapability = SOURCE_MANIFEST_CAPABILITY_FIELDS.find(
    capability => typeof safeCapabilities[capability] !== 'boolean'
  );

  // 条件分支: 任一能力不是严格 Boolean 时进入。
  // 执行内容: 不把 truthy 字符串或缺失值转换为支持状态。
  if (invalidCapability) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: 'sourceManifest.capabilities 必须全部使用 Boolean。',
      field: `sourceManifest.capabilities.${invalidCapability}`
    });
  }

  return safeCapabilities;
}

/**
 * 校验 Provider 声明的最小目标 host 集合。
 * 纯函数: 不解析或授权 URL，不修改数组顺序。
 * 失败路径: 空数组、非字符串、大小写、协议、端口、路径、IP、通配符或重复 host 抛 manifest 错误。
 *
 * @param {*} networkHosts host 数组候选。
 * @returns {Array<string>} 原已验证 host 数组。
 */
function validateNetworkHosts(networkHosts) {
  // 条件分支: 候选不是非空数组时进入。
  // 执行内容: 真实 Provider 必须显式声明至少一个信息请求目标 host。
  if (!Array.isArray(networkHosts) || networkHosts.length === 0) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: 'sourceManifest.networkHosts 必须是非空数组。',
      field: 'sourceManifest.networkHosts'
    });
  }

  // 类型: Set<string>。
  // 作用: 在保持原数组顺序的同时检测重复精确 host。
  const uniqueHosts = new Set();

  // 循环类型: for...of。
  // 初始值: networkHosts 第一项。
  // 终止条件: 全部 host 完成格式和重复校验。
  // 循环作用: 阻止协议、端口、路径、IP、通配符或视觉大小写别名进入权限声明。
  for (const host of networkHosts) {
    // 条件分支: host 不匹配小写 DNS 规则或已经出现时进入。
    // 执行内容: 以整个 host 集合为失败字段，页面不使用索引猜测授权差异。
    if (typeof host !== 'string'
      || host !== host.toLowerCase()
      || !NETWORK_HOST_PATTERN.test(host)
      || uniqueHosts.has(host)) {
      throw createParserError({
        code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
        message: 'sourceManifest.networkHosts 只能包含不重复的小写精确 DNS 主机名。',
        field: 'sourceManifest.networkHosts'
      });
    }

    uniqueHosts.add(host);
  }

  return networkHosts;
}

/**
 * 校验静态 sourceManifest 完整协议。
 * 纯函数: 返回隔离普通对象，不修改 AST 提取结果。
 * 失败路径: 字段、版本、身份、能力、设置或 host 违反冻结协议时抛 manifest 错误。
 *
 * @param {*} manifest manifest JSON 候选。
 * @returns {object} 隔离且字段完整的 sourceManifest。
 */
function validateSourceManifest(manifest) {
  // 类型: object。
  // 作用: 保存严格 JSON 隔离且顶层字段完整的 manifest，后续身份校验不读取 AST 对象。
  const safeManifest = assertExactFields(
    cloneSerializableValue(manifest, 'sourceManifest'),
    SOURCE_MANIFEST_FIELDS,
    'sourceManifest'
  );

  // 条件分支: manifest schema 不是当前精确结构版本时进入。
  // 执行内容: 未知结构失败关闭，不建立字段兼容默认值。
  if (safeManifest.schemaVersion !== SOURCE_PACKAGE_POLICY.schemaVersion) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: 'sourceManifest.schemaVersion 不受支持。',
      field: 'sourceManifest.schemaVersion'
    });
  }
  // 条件分支: Provider ABI 不是 Host 唯一支持的 2.0.0 时进入。
  // 执行内容: 在模块执行前失败，禁止未知未来 ABI 工厂进入注册表。
  if (!SOURCE_PACKAGE_POLICY.supportedProviderApiVersions.includes(
    safeManifest.providerApiVersion
  )) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: 'sourceManifest.providerApiVersion 不受支持。',
      field: 'sourceManifest.providerApiVersion'
    });
  }

  assertNonEmptyString(safeManifest.id, 'sourceManifest.id');
  assertNonEmptyString(safeManifest.name, 'sourceManifest.name');
  assertNonEmptyString(safeManifest.description, 'sourceManifest.description');
  assertNonEmptyString(safeManifest.version, 'sourceManifest.version');
  assertNonEmptyString(safeManifest.providerKey, 'sourceManifest.providerKey');

  // 条件分支: id 不是 source. 小写 ASCII 命名空间时进入。
  // 执行内容: 拒绝 URL、路径、空白和视觉兼容别名。
  if (!SOURCE_ID_PATTERN.test(safeManifest.id)) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: 'sourceManifest.id 必须是 source. 开头的小写 ASCII 命名空间。',
      field: 'sourceManifest.id'
    });
  }

  // 条件分支: providerKey 不是由 id 唯一派生的键时进入。
  // 执行内容: 禁止页面覆盖、别名和一个工厂多重身份。
  if (safeManifest.providerKey !== `${safeManifest.id}.provider`) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: 'sourceManifest.providerKey 必须由 id 唯一派生。',
      field: 'sourceManifest.providerKey'
    });
  }

  validateCapabilities(safeManifest.capabilities);

  // 条件分支: settingsSchema 不是数组时进入。
  // 执行内容: 当前只允许严格 JSON 设置声明数组，不接受对象、函数或组件回调。
  if (!Array.isArray(safeManifest.settingsSchema)) {
    throw createParserError({
      code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
      message: 'sourceManifest.settingsSchema 必须是数组。',
      field: 'sourceManifest.settingsSchema'
    });
  }

  validateNetworkHosts(safeManifest.networkHosts);
  return safeManifest;
}

/**
 * 递归冻结隔离 JSON 值。
 * 副作用: 只冻结当前函数收到的隔离对象树，不修改 AST 或调用方对象。
 *
 * @param {*} value JSON Value。
 * @returns {*} 同一深度冻结值。
 */
function deepFreezeJson(value) {
  // 条件分支: 当前值是非 null 对象或数组时进入。
  // 执行内容: 先冻结全部子值，再冻结当前容器。
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreezeJson);
    Object.freeze(value);
  }
  return value;
}

/**
 * 创建信任前静态预检端口。
 * 副作用: 只创建冻结单方法门面，不保存 AST 或脚本文本。
 *
 * @returns {object} 只公开 inspect(payload) 的冻结预检器。
 */
export function createSourcePackageManifestParser() {
  /**
   * 静态检查 SourcePackagePayload 并生成预览。
   * 纯函数: 不执行模块、工厂或任意 AST 表达式；返回值不含 scriptContent。
   * 成功路径: 返回深冻结 manifest 和 SourceImportPreview。
   * 失败路径: Acorn 语法、模块边界、禁用全局或 manifest 契约失败抛稳定错误。
   *
   * @param {object} payload SourcePackageInputReader 输出的冻结载荷。
   * @returns {object} manifest 与 preview 冻结结果。
   */
  function inspect(payload) {
    // 条件分支: 载荷缺失或脚本文本不是字符串时进入。
    // 执行内容: 在调用 Acorn 前给出稳定字段错误。
    if (!payload || typeof payload !== 'object' || typeof payload.scriptContent !== 'string') {
      throw createParserError({
        code: SOURCE_PACKAGE_ERROR_CODE.parse,
        stage: SOURCE_PACKAGE_LOAD_STAGE.parse,
        message: '数据源脚本载荷无效。',
        field: 'scriptContent'
      });
    }

    // 类型: object|undefined。
    // 作用: 保存 Acorn Program AST；只在当前调用栈中存在，不进入返回值或模块状态。
    let program;
    try {
      program = parse(payload.scriptContent, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        allowHashBang: false
      });
    } catch (error) {
      throw createParserError({
        code: SOURCE_PACKAGE_ERROR_CODE.parse,
        stage: SOURCE_PACKAGE_LOAD_STAGE.parse,
        message: '数据源脚本不是有效的单文件 ES module。',
        field: 'scriptContent'
      });
    }

    assertSafeModuleAst(program);

    // 类型: object。
    // 作用: 定位精确 Object.freeze 声明并取得其静态对象字面量。
    const manifestNode = findManifestDeclaration(program);
    // 类型: object。
    // 作用: 静态提取、严格验证并深冻结 manifest 隔离副本。
    const manifest = deepFreezeJson(validateSourceManifest(
      extractStaticJsonValue(manifestNode, 'sourceManifest')
    ));

    // 类型: object。
    // 作用: 只返回用户信任判断需要的身份、来源、容量、哈希、能力和 host，不携带脚本文本或 AST。
    const preview = deepFreezeJson({
      manifest: cloneSerializableValue(manifest, 'sourceImportPreview.manifest'),
      importMethod: payload.importMethod,
      remoteUrl: payload.remoteUrl,
      originalFileName: payload.originalFileName,
      scriptBytes: utf8ToBytes(payload.scriptContent).length,
      integrity: cloneSerializableValue(payload.integrity, 'sourceImportPreview.integrity'),
      readyForTrust: true,
      executionRisk: SOURCE_IMPORT_EXECUTION_RISK
    });

    return Object.freeze({ manifest, preview });
  }

  // 类型: object。
  // 作用: 返回不持有 AST 或脚本文本状态的冻结单方法端口。
  const parser = Object.freeze({ inspect });

  // 条件分支: 公开方法数量或顺序不符合冻结端口时进入。
  // 执行内容: 构造阶段失败，阻止内部提取器泄漏。
  if (Object.keys(parser).length !== SOURCE_PACKAGE_MANIFEST_PARSER_PUBLIC_METHODS.length
    || Object.keys(parser).some(
      (methodName, index) => methodName !== SOURCE_PACKAGE_MANIFEST_PARSER_PUBLIC_METHODS[index]
    )) {
    throw new TypeError('SourcePackageManifestParser 公开方法无效');
  }

  return parser;
}
