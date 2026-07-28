/*
  mockSourceUpdatePort.js 模块说明

  - 文件职责:
      把深冻结 sourceUpdateMock 暴露为 SourceManager 和 SourceManagementRuntime 共用的只读更新端口。
      check 只返回标准检测结果，getUpdateCandidate 只在用户确认应用更新后返回完整受审候选。
      本模块不访问真实网络、不写 Repository、Manager、Host、store 或页面，也不执行候选 scriptContent。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      IMPORT_METHOD: 自定义配置，更新端口只接受 remote SourceRecord。
      sourceUpdateMock: 自定义数据，提供确定性检测结果和完整受审候选。
      cloneSerializableValue: 自定义工具，为每次调用返回独立严格 JSON 副本。
      SourceManagement errors: 自定义错误，区分记录/夹具校验失败和候选未命中。

  - 模块级常量:
      SOURCE_UPDATE_CHECK_RESULT_FIELDS: Array<string>，标准更新检测结果字段。
      SOURCE_UPDATE_CANDIDATE_FIELDS: Array<string>，标准受审候选字段。
      SOURCE_UPDATE_PORT_PUBLIC_METHODS: Array<string>，更新端口公开方法顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      cloneFixtureValue(value, fieldName): 隔离夹具输出并转换校验错误。
      normalizeSourceRecord(sourceRecord): 校验并隔离远程 SourceRecord。
      validateCheckResult(result, fieldName): 校验标准检测结果四字段和条件关系。
      validateUpdateCandidate(candidate, sourceId): 校验候选两字段和目标身份。

  - 模块级类:
      无

  - 对外导出:
      createMockSourceUpdatePort: Function，创建冻结 check/getUpdateCandidate 只读端口。
*/

// 导入来源: ../../config/source-manager.config.js。
// 导入内容: IMPORT_METHOD 数据源导入方式枚举。
// 文件作用: 只有 remote 记录允许执行在线更新检测和候选读取。
import { IMPORT_METHOD } from '../../config/source-manager.config.js';

// 导入来源: ../../data/settings/source-update.mock.js。
// 导入内容: sourceUpdateMock 深冻结模拟更新夹具。
// 文件作用: 作为当前端口唯一检测和候选数据来源，不回退旧 sourceOperationScenarios。
import { sourceUpdateMock } from '../../data/settings/source-update.mock.js';

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON 隔离工具。
// 文件作用: 每个调用方获得新副本，不能修改深冻结夹具或影响其他调用。
import { cloneSerializableValue } from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ./sourceManagementErrors.js。
  // 导入内容: SourceManagementNotFoundError 更新候选未命中错误。
  // 文件作用: 没有受审候选时明确失败，不生成临时候选或回退其他 sourceId。
  SourceManagementNotFoundError,

  // 导入来源: ./sourceManagementErrors.js。
  // 导入内容: SourceManagementValidationError 端口输入和夹具校验错误。
  // 文件作用: 把非远程记录、损坏结果和候选身份断裂转换为稳定管理错误。
  SourceManagementValidationError
} from './sourceManagementErrors.js';

// 类型: Array<string>。
// 作用: 固定 SourceUpdateCheckResult 四字段，阻止脚本文本或候选对象在检测阶段泄漏。
const SOURCE_UPDATE_CHECK_RESULT_FIELDS = Object.freeze([
  'updateAvailable',
  'availableVersion',
  'availableVersionUpdatedAt',
  'checkedAt'
]);

// 类型: Array<string>。
// 作用: 固定用户确认后候选只包含完整 SourcePackage 和 SourceDefinition。
const SOURCE_UPDATE_CANDIDATE_FIELDS = Object.freeze([
  'sourcePackage',
  'sourceDefinition'
]);

// 类型: Array<string>。
// 作用: 固定端口只公开检测与候选读取两方法，防止夹具引用泄漏。
const SOURCE_UPDATE_PORT_PUBLIC_METHODS = Object.freeze([
  'check',
  'getUpdateCandidate'
]);

/**
 * 隔离模拟夹具值。
 * 纯函数: 返回严格 JSON 副本，不修改深冻结夹具。
 * 失败路径: 夹具出现不可序列化值时抛管理 validation 并保留 cause。
 *
 * @param {*} value 夹具值候选。
 * @param {string} fieldName 诊断字段名。
 * @returns {*} 严格 JSON 隔离副本。
 */
function cloneFixtureValue(value, fieldName) {
  try {
    return cloneSerializableValue(value, fieldName);
  } catch (error) {
    throw new SourceManagementValidationError(`${fieldName} 不是有效模拟更新数据`, {
      cause: error
    });
  }
}

/**
 * 校验并隔离更新端口 SourceRecord 输入。
 * 纯函数: 只返回严格 JSON 副本，不修改 SourceManager 投影。
 * 失败路径: 非对象、缺 Definition/id 或非 remote 导入时抛管理 validation。
 *
 * @param {*} sourceRecord SourceManager 隔离记录候选。
 * @returns {object} 具有远程 Definition 的隔离 SourceRecord。
 */
function normalizeSourceRecord(sourceRecord) {
  // 类型: object。
  // 作用: 保存 SourceRecord 严格 JSON 副本，端口异步边界不继续读取调用方引用。
  const safeRecord = cloneFixtureValue(sourceRecord, 'sourceUpdatePort.sourceRecord');

  // 条件分支: 记录、Definition 或 sourceId 结构无效时进入。
  // 执行内容: 在读取夹具前拒绝半完成投影或根级 id 别名。
  if (!safeRecord || typeof safeRecord !== 'object' || Array.isArray(safeRecord)
    || !safeRecord.definition || typeof safeRecord.definition !== 'object'
    || Array.isArray(safeRecord.definition)
    || typeof safeRecord.definition.id !== 'string'
    || safeRecord.definition.id.trim() === '') {
    throw new SourceManagementValidationError('sourceUpdatePort.sourceRecord 结构无效');
  }

  // 条件分支: 目标不是远程导入源时进入。
  // 执行内容: 拒绝文件、文本和 builtin 记录使用在线更新端口。
  if (safeRecord.definition.importMethod !== IMPORT_METHOD.remote) {
    throw new SourceManagementValidationError('只有 remote 数据源支持在线更新端口');
  }

  return safeRecord;
}

/**
 * 校验标准更新检测结果。
 * 纯函数: 返回原隔离对象，不修改字段。
 * 失败路径: 字段集合、Boolean、字符串或 updateAvailable 条件关系不符合契约时抛管理 validation。
 *
 * @param {*} result 检测结果候选。
 * @param {string} fieldName 诊断字段名。
 * @returns {object} 字段完整的 SourceUpdateCheckResult。
 */
function validateCheckResult(result, fieldName) {
  // 条件分支: 结果不是普通对象时进入。
  // 执行内容: 拒绝数组、null 和标量。
  if (!result || typeof result !== 'object' || Array.isArray(result)
    || Object.getPrototypeOf(result) !== Object.prototype) {
    throw new SourceManagementValidationError(`${fieldName} 必须是普通对象`);
  }

  // 类型: Array<string>。
  // 作用: 保存真实结果字段，执行精确四字段集合校验。
  const actualFields = Object.keys(result);

  // 条件分支: 字段数量、名称或 updateAvailable 类型无效时进入。
  // 执行内容: 拒绝候选脚本、额外状态和模糊 Boolean 进入 SourceManager。
  if (actualFields.length !== SOURCE_UPDATE_CHECK_RESULT_FIELDS.length
    || SOURCE_UPDATE_CHECK_RESULT_FIELDS.some(field => !actualFields.includes(field))
    || typeof result.updateAvailable !== 'boolean') {
    throw new SourceManagementValidationError(`${fieldName} 字段集合或 Boolean 无效`);
  }

  // 类型: Array<string>。
  // 作用: 固定三个文本字段，检查版本、在线时间和检测时间没有对象或缺失值。
  const stringFields = [
    'availableVersion',
    'availableVersionUpdatedAt',
    'checkedAt'
  ];

  // 条件分支: 任一文本字段不是字符串或 checkedAt 为空时进入。
  // 执行内容: 拒绝不完整检测结果进入 Manager 过渡态收敛。
  if (stringFields.some(field => typeof result[field] !== 'string')
    || result.checkedAt === '') {
    throw new SourceManagementValidationError(`${fieldName} 文本字段无效`);
  }

  // 条件分支: 有更新却缺版本/版本时间，或无更新仍携带版本信息时进入。
  // 执行内容: 保持 Boolean 与三个展示字段只有一种解释。
  if ((result.updateAvailable
    && (!result.availableVersion || !result.availableVersionUpdatedAt))
    || (!result.updateAvailable
      && (result.availableVersion !== '' || result.availableVersionUpdatedAt !== ''))) {
    throw new SourceManagementValidationError(`${fieldName} 条件字段不一致`);
  }

  return result;
}

/**
 * 校验受审更新候选和目标身份。
 * 纯函数: 返回原隔离候选，不修改 Package 或 Definition。
 * 失败路径: 字段、对象或 sourceId 不一致时抛管理 validation。
 *
 * @param {*} candidate 更新候选。
 * @param {string} sourceId 当前 SourceRecord 真实身份。
 * @returns {object} 字段完整且同源的候选。
 */
function validateUpdateCandidate(candidate, sourceId) {
  // 条件分支: 候选不是普通对象时进入。
  // 执行内容: 拒绝数组、null、类实例和标量。
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
    || Object.getPrototypeOf(candidate) !== Object.prototype) {
    throw new SourceManagementValidationError('sourceUpdateCandidate 必须是普通对象');
  }

  // 类型: Array<string>。
  // 作用: 保存候选真实字段，执行 Package/Definition 精确两字段校验。
  const actualFields = Object.keys(candidate);

  // 条件分支: 候选缺少固定字段或携带额外字段时进入。
  // 执行内容: 拒绝 handoff、页面状态和脚本执行能力混入端口返回。
  if (actualFields.length !== SOURCE_UPDATE_CANDIDATE_FIELDS.length
    || SOURCE_UPDATE_CANDIDATE_FIELDS.some(field => !actualFields.includes(field))) {
    throw new SourceManagementValidationError('sourceUpdateCandidate 字段集合无效');
  }

  // 条件分支: Package 或 Definition 不是普通对象时进入。
  // 执行内容: 拒绝半完成候选，完整字段细节继续由输入适配器和 Manager 双重校验。
  if (!candidate.sourcePackage || typeof candidate.sourcePackage !== 'object'
    || Array.isArray(candidate.sourcePackage)
    || !candidate.sourceDefinition || typeof candidate.sourceDefinition !== 'object'
    || Array.isArray(candidate.sourceDefinition)) {
    throw new SourceManagementValidationError('sourceUpdateCandidate 包定义结构无效');
  }

  // 条件分支: 候选包或定义不是当前真实 sourceId 时进入。
  // 执行内容: 拒绝一个在线地址返回其他源候选，禁止隐式改名或跨源更新。
  if (candidate.sourcePackage.sourceId !== sourceId
    || candidate.sourceDefinition.id !== sourceId) {
    throw new SourceManagementValidationError('sourceUpdateCandidate 与目标 sourceId 不一致');
  }

  return candidate;
}

/**
 * 创建只读模拟更新端口。
 * 副作用: 只创建冻结两方法门面，不读取系统时间、不启动网络或修改夹具。
 * 成功路径: check 返回独立检测副本；getUpdateCandidate 返回独立完整候选副本。
 *
 * @returns {object} 冻结 MockSourceUpdatePort。
 */
export function createMockSourceUpdatePort() {
  /**
   * 检查一个远程数据源的模拟在线版本。
   * 副作用: 只读取深冻结夹具并创建副本，不修改 SourceRecord 或页面状态。
   * 成功路径: 已登记源返回精确结果，未登记远程源返回标准无更新结果。
   * 失败路径: 记录不是 remote 或夹具结果损坏时抛稳定管理 validation。
   *
   * @param {*} sourceRecord SourceManager 当前隔离记录。
   * @returns {Promise<object>} SourceUpdateCheckResult 独立副本。
   */
  async function check(sourceRecord) {
    // 类型: object。
    // 作用: 保存通过 remote 门禁的隔离 SourceRecord。
    const safeRecord = normalizeSourceRecord(sourceRecord);

    // 类型: string。
    // 作用: 使用 Definition.id 作为唯一夹具查询键，不读取名称、URL 或根对象别名。
    const sourceId = safeRecord.definition.id;

    // 类型: object。
    // 作用: 保存精确源结果或正式默认无更新结果，二者都来自同一深冻结夹具。
    const fixtureResult = sourceUpdateMock.checkResultsBySourceId[sourceId]
      || sourceUpdateMock.defaultCheckResult;

    // 类型: object。
    // 作用: 为当前调用创建独立结果，监听器或 Manager 修改不会穿透夹具。
    const result = cloneFixtureValue(fixtureResult, `sourceUpdateMock.checkResults.${sourceId}`);
    return validateCheckResult(result, `sourceUpdateMock.checkResults.${sourceId}`);
  }

  /**
   * 读取用户确认后要应用的完整受审更新候选。
   * 副作用: 只读取深冻结夹具并创建副本，不修改 Manager、Host 或 Repository。
   * 成功路径: 返回与当前记录 sourceId 一致的 Package/Definition 候选。
   * 失败路径: 没有候选时抛稳定 notFound，不生成默认脚本或回退其他源。
   *
   * @param {*} sourceRecord SourceManager 当前隔离记录。
   * @returns {Promise<object>} SourceUpdateCandidate 独立副本。
   */
  async function getUpdateCandidate(sourceRecord) {
    // 类型: object。
    // 作用: 保存通过 remote 门禁的隔离 SourceRecord。
    const safeRecord = normalizeSourceRecord(sourceRecord);

    // 类型: string。
    // 作用: 使用 Definition.id 精确读取候选，不根据 availableVersion 字符串拼装对象。
    const sourceId = safeRecord.definition.id;

    // 类型: object|undefined。
    // 作用: 保存当前真实 sourceId 对应的深冻结受审候选；未登记时保持 undefined。
    const fixtureCandidate = sourceUpdateMock.candidatesBySourceId[sourceId];

    // 条件分支: 当前远程源没有受审候选时进入。
    // 执行内容: 明确失败，阻止已是最新或未知源进入 Manager.applySourceUpdate。
    if (!fixtureCandidate) {
      throw new SourceManagementNotFoundError(`数据源没有可用更新候选: ${sourceId}`);
    }

    // 类型: object。
    // 作用: 为当前调用创建独立候选，适配器和 Manager 可以安全执行后续校验。
    const candidate = cloneFixtureValue(
      fixtureCandidate,
      `sourceUpdateMock.candidates.${sourceId}`
    );
    return validateUpdateCandidate(candidate, sourceId);
  }

  // 类型: object。
  // 作用: 汇总检测和候选读取两方法，不暴露 sourceUpdateMock 或内部校验函数。
  const sourceUpdatePort = { check, getUpdateCandidate };

  // 条件分支: 公开键数量、顺序或名称与冻结契约不一致时进入。
  // 执行内容: 在返回端口前阻止遗漏方法或夹具引用泄漏。
  if (Object.keys(sourceUpdatePort).length !== SOURCE_UPDATE_PORT_PUBLIC_METHODS.length
    || Object.keys(sourceUpdatePort).some(
      (methodName, index) => methodName !== SOURCE_UPDATE_PORT_PUBLIC_METHODS[index]
    )) {
    throw new SourceManagementValidationError('MockSourceUpdatePort 公开方法顺序无效');
  }

  return Object.freeze(sourceUpdatePort);
}
