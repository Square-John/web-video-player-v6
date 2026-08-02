/*
  source-manager.mock.js 模块说明

  - 文件职责:
      提供设置页数据源管理的同构 mock 初始化数据和可重复操作场景。
      供 settingsStore 深拷贝初始化，页面和组件不得直接修改本文件导出对象。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      AUTHORIZATION_STATUS: 自定义配置，提供 mock 授权意图受控枚举。
      createSourceAuthorizationState: 自定义工具函数，根据当前脚本定义生成授权快照。
      normalizeSourceScriptContent: 自定义工具函数，统一 mock 脚本文本换行符。

  - 模块级常量:
      sourceManagerMock: object，数据源管理初始状态。
      sourceOperationScenarios: object，健康检查和在线更新模拟结果。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createMockSourceRecord(recordInput)
          - params:
              -- recordInput: object，数据源定义、运行态、授权意图和缓存输入。
          - return:
              object，脚本文本和授权快照已经统一的数据源记录。
          - description:
              让 mock 只声明授权意图，禁止手写授权版本和内容指纹。

  - 模块级类:
      无

  - 对外导出:
      sourceManagerMock: object，设置页数据源管理初始状态。
      sourceOperationScenarios: object，数据源操作模拟场景。
*/

import {
  // 导入来源: ../../config/source-manager.config。
  // 导入内容: AUTHORIZATION_STATUS 运行授权状态枚举。
  // 文件作用: 声明 mock 记录是已授权、等待授权或已撤销状态。
  AUTHORIZATION_STATUS
} from '../../config/source-manager.config.js';

import {
  // 导入来源: ../../utils/sourceAuthorization。
  // 导入内容: createSourceAuthorizationState 授权状态构造函数。
  // 文件作用: 根据当前 definition 自动生成授权版本和脚本内容指纹。
  createSourceAuthorizationState,
  // 导入来源: ../../utils/sourceAuthorization。
  // 导入内容: normalizeSourceScriptContent 脚本文本规范化函数。
  // 文件作用: 让 mock 保存文本和授权哈希使用同一份规范化内容。
  normalizeSourceScriptContent
} from '../../utils/sourceAuthorization.js';

/**
 * 创建一条授权字段与当前脚本定义同源的数据源 mock 记录。
 * 输入边界: authorization 只声明 status、authorizedAt 和可选历史快照，已授权版本和哈希由函数生成。
 *
 * @param {object} recordInput 数据源记录输入。
 * @param {object} recordInput.definition 数据源脚本定义和页面能力。
 * @param {object} recordInput.runtime 数据源启停、健康和更新运行态。
 * @param {object} recordInput.authorization 用户授权意图或历史授权状态。
 * @param {object} recordInput.cache 数据源临时缓存和全部缓存摘要。
 * @returns {object} 可以写入 SourceManagerState 的完整数据源记录。
 * @returns {object} return.definition 规范化脚本文本后的数据源定义。
 * @returns {object} return.runtime 原始 mock 运行态。
 * @returns {object} return.authorization 与当前 definition 同源生成的授权状态。
 * @returns {object} return.cache 原始 mock 缓存摘要。
 * 纯函数: createMockSourceRecord 只读取输入参数或组件只读状态，并返回该字段对应的派生结果，不修改响应式状态或外部存储。
 */
function createMockSourceRecord(recordInput) {
  // 类型: object。
  // 作用: 复制定义并统一脚本文本换行符，保证保存文本、导出文本和授权指纹使用相同内容。
  const definition = {
    ...recordInput.definition,
    // 类型: string。
    // 作用: 保存规范化脚本文本，后续授权、更新和导出均以该字段为唯一内容来源。
    scriptContent: normalizeSourceScriptContent(recordInput.definition.scriptContent)
  };

  // 返回值类型: object。
  // 作用: 自动补齐完整授权快照，mock 调用处不再保存可漂移的哈希字面量。
  return {
    ...recordInput,
    definition,
    authorization: createSourceAuthorizationState(definition, recordInput.authorization)
  };
}

// 类型: object。
// 作用: 设置页数据源管理初始状态，覆盖系统源、自定义源、关闭、不可用和在线更新场景。
export const sourceManagerMock = {
  // 类型: string。
  // 作用: 初始默认数据源 id，影响列表默认标识和详情默认源判断。
  defaultSourceId: 'system-source-1',
  // 类型: Array<string>。
  // 作用: 初始软删除系统源 id 数组，影响列表排除和恢复弹窗候选。
  removedSystemSourceIds: ['system-source-5'],
  // 类型: boolean。
  // 作用: 批量检测运行状态，true 驱动检测全部按钮加载，false 表示空闲。
  checkingAll: false,
  // 类型: Array<object>。
  // 作用: 数据源管理记录数组，作为列表、详情、摘要和操作流程的唯一初始数据。
  records: [
    createMockSourceRecord({
      // 类型: object。
      // 作用: 当前记录的数据源定义，提供脚本身份、导入信息和页面能力。
      definition: {
        // 类型: string。
        // 作用: 数据源契约版本，供脚本导入兼容性校验识别。
        schemaVersion: '1.0.0',
        // 类型: string。
        // 作用: 数据源唯一标识，用于路由、默认源、操作场景和记录查询。
        id: 'system-source-1',
        // 类型: string。
        // 作用: 数据源用户名称，展示在列表、详情和确认弹窗。
        name: '系统数据源1',
        // 类型: string。
        // 作用: 数据源能力或 mock 场景说明，展示在详情页标题区。
        description: '系统内置数据源，支持首页、电影、电视剧、搜索、详情和播放信息。',
        // 类型: string。
        // 作用: 数据源来源类型，决定系统软删除或自定义脚本流程。
        sourceKind: 'system',
        // 类型: string。
        // 作用: 当前本地脚本版本，展示在列表和详情并参与授权版本记录。
        version: 'v1.0.0',
        // 类型: string。
        // 作用: 数据源导入方式，决定在线更新字段和详情文案。
        importMethod: 'builtin',
        // 类型: string。
        // 作用: 在线导入地址，仅 remote 数据源在详情中展示。
        remoteUrl: '',
        // 类型: string。
        // 作用: 首次导入 ISO 时间，展示在基本信息区。
        importedAt: '2026-07-01T08:00:00.000Z',
        // 类型: string。
        // 作用: 本地脚本最后更新 ISO 时间，展示在基本信息区。
        lastUpdatedAt: '2026-07-01T08:00:00.000Z',
        // 类型: object。
        // 作用: 页面能力布尔映射，决定详情页能力 chip。
        capabilities: {
          // 类型: boolean。
          // 作用: 是否提供首页数据能力，true 展示首页能力，false 不展示。
          home: true,
          // 类型: boolean。
          // 作用: 是否提供电影页数据能力，true 展示电影能力，false 不展示。
          movie: true,
          // 类型: boolean。
          // 作用: 是否提供电视剧页数据能力，true 展示电视剧能力，false 不展示。
          tv: true,
          // 类型: boolean。
          // 作用: 是否提供搜索数据能力，true 展示搜索能力，false 不展示。
          search: true,
          // 类型: boolean。
          // 作用: 是否提供详情数据能力，true 展示详情能力，false 不展示。
          detail: true,
          // 类型: boolean。
          // 作用: 是否提供播放数据能力，true 展示播放能力，false 不展示。
          play: true
        },
        // 类型: Array<object>。
        // 作用: 普通非敏感设置字段定义，当前为空并触发真实空状态。
        settingsSchema: [],
        // 类型: object。
        // 作用: 普通设置当前值，当前为空且未进入页面渲染。
        settingsValues: {},
        // 类型: string。
        // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
        scriptContent: "export default { id: 'system-source-1', name: '系统数据源1', version: 'v1.0.0' };"
      },
      // 类型: object。
      // 作用: 当前记录运行状态，提供启停、健康和在线更新信息。
      runtime: {
        // 类型: boolean。
        // 作用: 数据源启用状态，true 可参与默认源和检测，false 显示已关闭。
        enabled: true,
        // 类型: string。
        // 作用: 三态健康值，驱动正常、检测中或不可用文案和样式。
        healthStatus: 'normal',
        // 类型: string。
        // 作用: 最近一次健康检测 ISO 时间，展示在基本信息区。
        lastCheckedAt: '2026-07-12T12:20:00.000Z',
        // 类型: string。
        // 作用: 最近不可用原因，仅已启用且不可用时展示。
        lastUnavailableReason: '',
        // 类型: boolean。
        // 作用: 在线更新检查状态，true 驱动更新按钮加载，false 表示空闲。
        checkingUpdate: false,
        // 类型: boolean。
        // 作用: 是否存在可用在线版本，true 显示应用更新入口。
        updateAvailable: false,
        // 类型: string。
        // 作用: 在线可用版本号，更新按钮和基本信息区使用。
        availableVersion: '',
        // 类型: string。
        // 作用: 在线版本发布时间，展示在远程信息区。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 最近一次在线更新检查时间，展示在远程信息区。
        lastUpdateCheckedAt: ''
      },
      // 类型: object。
      // 作用: 脚本运行授权状态，限制自定义脚本启用并记录用户决定。
      authorization: {
        // 类型: string。
        // 作用: 脚本运行授权状态，区分已授权、等待授权和已撤销。
        status: AUTHORIZATION_STATUS.authorized,
        // 类型: string。
        // 作用: 用户确认运行授权的 ISO 时间，空值表示尚未授权。
        authorizedAt: '2026-07-01T08:00:00.000Z',
        // 已授权版本和内容指纹由 createMockSourceRecord 根据当前 definition 自动生成。
      },
      // 类型: object。
      // 作用: 当前数据源运行缓存占用，供详情展示和两级清理。
      cache: {
        // 类型: number。
        // 作用: 可重新生成临时缓存字节数，控制临时清理按钮。
        temporaryCacheBytes: 2516582,
        // 类型: number。
        // 作用: 全部运行缓存字节数，控制全部清理按钮并参与摘要。
        totalCacheBytes: 2936012
      }
    }),
    createMockSourceRecord({
      // 类型: object。
      // 作用: 当前记录的数据源定义，提供脚本身份、导入信息和页面能力。
      definition: {
        // 类型: string。
        // 作用: 数据源契约版本，供脚本导入兼容性校验识别。
        schemaVersion: '1.0.0',
        // 类型: string。
        // 作用: 数据源唯一标识，用于路由、默认源、操作场景和记录查询。
        id: 'system-source-2',
        // 类型: string。
        // 作用: 数据源用户名称，展示在列表、详情和确认弹窗。
        name: '系统数据源2',
        // 类型: string。
        // 作用: 数据源能力或 mock 场景说明，展示在详情页标题区。
        description: '系统内置数据源，当前 mock 场景用于演示不可用状态和重新检测。',
        // 类型: string。
        // 作用: 数据源来源类型，决定系统软删除或自定义脚本流程。
        sourceKind: 'system',
        // 类型: string。
        // 作用: 当前本地脚本版本，展示在列表和详情并参与授权版本记录。
        version: 'v1.0.0',
        // 类型: string。
        // 作用: 数据源导入方式，决定在线更新字段和详情文案。
        importMethod: 'builtin',
        // 类型: string。
        // 作用: 在线导入地址，仅 remote 数据源在详情中展示。
        remoteUrl: '',
        // 类型: string。
        // 作用: 首次导入 ISO 时间，展示在基本信息区。
        importedAt: '2026-07-01T08:00:00.000Z',
        // 类型: string。
        // 作用: 本地脚本最后更新 ISO 时间，展示在基本信息区。
        lastUpdatedAt: '2026-07-01T08:00:00.000Z',
        // 类型: object。
        // 作用: 页面能力布尔映射，决定详情页能力 chip。
        capabilities: {
          // 类型: boolean。
          // 作用: 是否提供首页数据能力，true 展示首页能力，false 不展示。
          home: true,
          // 类型: boolean。
          // 作用: 是否提供电影页数据能力，true 展示电影能力，false 不展示。
          movie: true,
          // 类型: boolean。
          // 作用: 是否提供电视剧页数据能力，true 展示电视剧能力，false 不展示。
          tv: true,
          // 类型: boolean。
          // 作用: 是否提供搜索数据能力，true 展示搜索能力，false 不展示。
          search: true,
          // 类型: boolean。
          // 作用: 是否提供详情数据能力，true 展示详情能力，false 不展示。
          detail: true,
          // 类型: boolean。
          // 作用: 是否提供播放数据能力，true 展示播放能力，false 不展示。
          play: true
        },
        // 类型: Array<object>。
        // 作用: 普通非敏感设置字段定义，当前为空并触发真实空状态。
        settingsSchema: [],
        // 类型: object。
        // 作用: 普通设置当前值，当前为空且未进入页面渲染。
        settingsValues: {},
        // 类型: string。
        // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
        scriptContent: "export default { id: 'system-source-2', name: '系统数据源2', version: 'v1.0.0' };"
      },
      // 类型: object。
      // 作用: 当前记录运行状态，提供启停、健康和在线更新信息。
      runtime: {
        // 类型: boolean。
        // 作用: 数据源启用状态，true 可参与默认源和检测，false 显示已关闭。
        enabled: true,
        // 类型: string。
        // 作用: 三态健康值，驱动正常、检测中或不可用文案和样式。
        healthStatus: 'unavailable',
        // 类型: string。
        // 作用: 最近一次健康检测 ISO 时间，展示在基本信息区。
        lastCheckedAt: '2026-07-12T12:25:00.000Z',
        // 类型: string。
        // 作用: 最近不可用原因，仅已启用且不可用时展示。
        lastUnavailableReason: '模拟检测请求超时。',
        // 类型: boolean。
        // 作用: 在线更新检查状态，true 驱动更新按钮加载，false 表示空闲。
        checkingUpdate: false,
        // 类型: boolean。
        // 作用: 是否存在可用在线版本，true 显示应用更新入口。
        updateAvailable: false,
        // 类型: string。
        // 作用: 在线可用版本号，更新按钮和基本信息区使用。
        availableVersion: '',
        // 类型: string。
        // 作用: 在线版本发布时间，展示在远程信息区。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 最近一次在线更新检查时间，展示在远程信息区。
        lastUpdateCheckedAt: ''
      },
      // 类型: object。
      // 作用: 脚本运行授权状态，限制自定义脚本启用并记录用户决定。
      authorization: {
        // 类型: string。
        // 作用: 脚本运行授权状态，区分已授权、等待授权和已撤销。
        status: AUTHORIZATION_STATUS.authorized,
        // 类型: string。
        // 作用: 用户确认运行授权的 ISO 时间，空值表示尚未授权。
        authorizedAt: '2026-07-01T08:00:00.000Z',
        // 已授权版本和内容指纹由 createMockSourceRecord 根据当前 definition 自动生成。
      },
      // 类型: object。
      // 作用: 当前数据源运行缓存占用，供详情展示和两级清理。
      cache: {
        // 类型: number。
        // 作用: 可重新生成临时缓存字节数，控制临时清理按钮。
        temporaryCacheBytes: 1887436,
        // 类型: number。
        // 作用: 全部运行缓存字节数，控制全部清理按钮并参与摘要。
        totalCacheBytes: 2097152
      }
    }),
    createMockSourceRecord({
      // 类型: object。
      // 作用: 当前记录的数据源定义，提供脚本身份、导入信息和页面能力。
      definition: {
        // 类型: string。
        // 作用: 数据源契约版本，供脚本导入兼容性校验识别。
        schemaVersion: '1.0.0',
        // 类型: string。
        // 作用: 数据源唯一标识，用于路由、默认源、操作场景和记录查询。
        id: 'system-source-3',
        // 类型: string。
        // 作用: 数据源用户名称，展示在列表、详情和确认弹窗。
        name: '系统数据源3',
        // 类型: string。
        // 作用: 数据源能力或 mock 场景说明，展示在详情页标题区。
        description: '系统内置数据源，当前 mock 场景用于演示关闭状态。',
        // 类型: string。
        // 作用: 数据源来源类型，决定系统软删除或自定义脚本流程。
        sourceKind: 'system',
        // 类型: string。
        // 作用: 当前本地脚本版本，展示在列表和详情并参与授权版本记录。
        version: 'v1.0.0',
        // 类型: string。
        // 作用: 数据源导入方式，决定在线更新字段和详情文案。
        importMethod: 'builtin',
        // 类型: string。
        // 作用: 在线导入地址，仅 remote 数据源在详情中展示。
        remoteUrl: '',
        // 类型: string。
        // 作用: 首次导入 ISO 时间，展示在基本信息区。
        importedAt: '2026-07-01T08:00:00.000Z',
        // 类型: string。
        // 作用: 本地脚本最后更新 ISO 时间，展示在基本信息区。
        lastUpdatedAt: '2026-07-01T08:00:00.000Z',
        // 类型: object。
        // 作用: 页面能力布尔映射，决定详情页能力 chip。
        capabilities: {
          // 类型: boolean。
          // 作用: 是否提供首页数据能力，true 展示首页能力，false 不展示。
          home: true,
          // 类型: boolean。
          // 作用: 是否提供电影页数据能力，true 展示电影能力，false 不展示。
          movie: true,
          // 类型: boolean。
          // 作用: 是否提供电视剧页数据能力，true 展示电视剧能力，false 不展示。
          tv: true,
          // 类型: boolean。
          // 作用: 是否提供搜索数据能力，true 展示搜索能力，false 不展示。
          search: true,
          // 类型: boolean。
          // 作用: 是否提供详情数据能力，true 展示详情能力，false 不展示。
          detail: true,
          // 类型: boolean。
          // 作用: 是否提供播放数据能力，true 展示播放能力，false 不展示。
          play: true
        },
        // 类型: Array<object>。
        // 作用: 普通非敏感设置字段定义，当前为空并触发真实空状态。
        settingsSchema: [],
        // 类型: object。
        // 作用: 普通设置当前值，当前为空且未进入页面渲染。
        settingsValues: {},
        // 类型: string。
        // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
        scriptContent: "export default { id: 'system-source-3', name: '系统数据源3', version: 'v1.0.0' };"
      },
      // 类型: object。
      // 作用: 当前记录运行状态，提供启停、健康和在线更新信息。
      runtime: {
        // 类型: boolean。
        // 作用: 数据源启用状态，true 可参与默认源和检测，false 显示已关闭。
        enabled: false,
        // 类型: string。
        // 作用: 三态健康值，驱动正常、检测中或不可用文案和样式。
        healthStatus: 'normal',
        // 类型: string。
        // 作用: 最近一次健康检测 ISO 时间，展示在基本信息区。
        lastCheckedAt: '2026-07-10T09:00:00.000Z',
        // 类型: string。
        // 作用: 最近不可用原因，仅已启用且不可用时展示。
        lastUnavailableReason: '',
        // 类型: boolean。
        // 作用: 在线更新检查状态，true 驱动更新按钮加载，false 表示空闲。
        checkingUpdate: false,
        // 类型: boolean。
        // 作用: 是否存在可用在线版本，true 显示应用更新入口。
        updateAvailable: false,
        // 类型: string。
        // 作用: 在线可用版本号，更新按钮和基本信息区使用。
        availableVersion: '',
        // 类型: string。
        // 作用: 在线版本发布时间，展示在远程信息区。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 最近一次在线更新检查时间，展示在远程信息区。
        lastUpdateCheckedAt: ''
      },
      // 类型: object。
      // 作用: 脚本运行授权状态，限制自定义脚本启用并记录用户决定。
      authorization: {
        // 类型: string。
        // 作用: 脚本运行授权状态，区分已授权、等待授权和已撤销。
        status: AUTHORIZATION_STATUS.authorized,
        // 类型: string。
        // 作用: 用户确认运行授权的 ISO 时间，空值表示尚未授权。
        authorizedAt: '2026-07-01T08:00:00.000Z',
        // 已授权版本和内容指纹由 createMockSourceRecord 根据当前 definition 自动生成。
      },
      // 类型: object。
      // 作用: 当前数据源运行缓存占用，供详情展示和两级清理。
      cache: {
        // 类型: number。
        // 作用: 可重新生成临时缓存字节数，控制临时清理按钮。
        temporaryCacheBytes: 1048576,
        // 类型: number。
        // 作用: 全部运行缓存字节数，控制全部清理按钮并参与摘要。
        totalCacheBytes: 1258291
      }
    }),
    createMockSourceRecord({
      // 类型: object。
      // 作用: 当前记录的数据源定义，提供脚本身份、导入信息和页面能力。
      definition: {
        // 类型: string。
        // 作用: 数据源契约版本，供脚本导入兼容性校验识别。
        schemaVersion: '1.0.0',
        // 类型: string。
        // 作用: 数据源唯一标识，用于路由、默认源、操作场景和记录查询。
        id: 'system-source-4',
        // 类型: string。
        // 作用: 数据源用户名称，展示在列表、详情和确认弹窗。
        name: '系统数据源4',
        // 类型: string。
        // 作用: 数据源能力或 mock 场景说明，展示在详情页标题区。
        description: '系统内置数据源，支持完整页面能力。',
        // 类型: string。
        // 作用: 数据源来源类型，决定系统软删除或自定义脚本流程。
        sourceKind: 'system',
        // 类型: string。
        // 作用: 当前本地脚本版本，展示在列表和详情并参与授权版本记录。
        version: 'v1.0.0',
        // 类型: string。
        // 作用: 数据源导入方式，决定在线更新字段和详情文案。
        importMethod: 'builtin',
        // 类型: string。
        // 作用: 在线导入地址，仅 remote 数据源在详情中展示。
        remoteUrl: '',
        // 类型: string。
        // 作用: 首次导入 ISO 时间，展示在基本信息区。
        importedAt: '2026-07-01T08:00:00.000Z',
        // 类型: string。
        // 作用: 本地脚本最后更新 ISO 时间，展示在基本信息区。
        lastUpdatedAt: '2026-07-01T08:00:00.000Z',
        // 类型: object。
        // 作用: 页面能力布尔映射，决定详情页能力 chip。
        capabilities: {
          // 类型: boolean。
          // 作用: 是否提供首页数据能力，true 展示首页能力，false 不展示。
          home: true,
          // 类型: boolean。
          // 作用: 是否提供电影页数据能力，true 展示电影能力，false 不展示。
          movie: true,
          // 类型: boolean。
          // 作用: 是否提供电视剧页数据能力，true 展示电视剧能力，false 不展示。
          tv: true,
          // 类型: boolean。
          // 作用: 是否提供搜索数据能力，true 展示搜索能力，false 不展示。
          search: true,
          // 类型: boolean。
          // 作用: 是否提供详情数据能力，true 展示详情能力，false 不展示。
          detail: true,
          // 类型: boolean。
          // 作用: 是否提供播放数据能力，true 展示播放能力，false 不展示。
          play: true
        },
        // 类型: Array<object>。
        // 作用: 普通非敏感设置字段定义，当前为空并触发真实空状态。
        settingsSchema: [],
        // 类型: object。
        // 作用: 普通设置当前值，当前为空且未进入页面渲染。
        settingsValues: {},
        // 类型: string。
        // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
        scriptContent: "export default { id: 'system-source-4', name: '系统数据源4', version: 'v1.0.0' };"
      },
      // 类型: object。
      // 作用: 当前记录运行状态，提供启停、健康和在线更新信息。
      runtime: {
        // 类型: boolean。
        // 作用: 数据源启用状态，true 可参与默认源和检测，false 显示已关闭。
        enabled: true,
        // 类型: string。
        // 作用: 三态健康值，驱动正常、检测中或不可用文案和样式。
        healthStatus: 'normal',
        // 类型: string。
        // 作用: 最近一次健康检测 ISO 时间，展示在基本信息区。
        lastCheckedAt: '2026-07-12T12:30:00.000Z',
        // 类型: string。
        // 作用: 最近不可用原因，仅已启用且不可用时展示。
        lastUnavailableReason: '',
        // 类型: boolean。
        // 作用: 在线更新检查状态，true 驱动更新按钮加载，false 表示空闲。
        checkingUpdate: false,
        // 类型: boolean。
        // 作用: 是否存在可用在线版本，true 显示应用更新入口。
        updateAvailable: false,
        // 类型: string。
        // 作用: 在线可用版本号，更新按钮和基本信息区使用。
        availableVersion: '',
        // 类型: string。
        // 作用: 在线版本发布时间，展示在远程信息区。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 最近一次在线更新检查时间，展示在远程信息区。
        lastUpdateCheckedAt: ''
      },
      // 类型: object。
      // 作用: 脚本运行授权状态，限制自定义脚本启用并记录用户决定。
      authorization: {
        // 类型: string。
        // 作用: 脚本运行授权状态，区分已授权、等待授权和已撤销。
        status: AUTHORIZATION_STATUS.authorized,
        // 类型: string。
        // 作用: 用户确认运行授权的 ISO 时间，空值表示尚未授权。
        authorizedAt: '2026-07-01T08:00:00.000Z',
        // 已授权版本和内容指纹由 createMockSourceRecord 根据当前 definition 自动生成。
      },
      // 类型: object。
      // 作用: 当前数据源运行缓存占用，供详情展示和两级清理。
      cache: {
        // 类型: number。
        // 作用: 可重新生成临时缓存字节数，控制临时清理按钮。
        temporaryCacheBytes: 1572864,
        // 类型: number。
        // 作用: 全部运行缓存字节数，控制全部清理按钮并参与摘要。
        totalCacheBytes: 1782579
      }
    }),
    createMockSourceRecord({
      // 类型: object。
      // 作用: 当前记录的数据源定义，提供脚本身份、导入信息和页面能力。
      definition: {
        // 类型: string。
        // 作用: 数据源契约版本，供脚本导入兼容性校验识别。
        schemaVersion: '1.0.0',
        // 类型: string。
        // 作用: 数据源唯一标识，用于路由、默认源、操作场景和记录查询。
        id: 'custom-online-demo',
        // 类型: string。
        // 作用: 数据源用户名称，展示在列表、详情和确认弹窗。
        name: '自定义数据源1',
        // 类型: string。
        // 作用: 数据源能力或 mock 场景说明，展示在详情页标题区。
        description: '用户在线导入的数据源，当前 mock 场景用于演示运行授权和在线更新。',
        // 类型: string。
        // 作用: 数据源来源类型，决定系统软删除或自定义脚本流程。
        sourceKind: 'custom',
        // 类型: string。
        // 作用: 当前本地脚本版本，展示在列表和详情并参与授权版本记录。
        version: 'v1.2.0',
        // 类型: string。
        // 作用: 数据源导入方式，决定在线更新字段和详情文案。
        importMethod: 'remote',
        // 类型: string。
        // 作用: 在线导入地址，仅 remote 数据源在详情中展示。
        remoteUrl: 'https://example.com/source-demo.js',
        // 类型: string。
        // 作用: 首次导入 ISO 时间，展示在基本信息区。
        importedAt: '2026-07-08T09:30:00.000Z',
        // 类型: string。
        // 作用: 本地脚本最后更新 ISO 时间，展示在基本信息区。
        lastUpdatedAt: '2026-07-10T10:00:00.000Z',
        // 类型: object。
        // 作用: 页面能力布尔映射，决定详情页能力 chip。
        capabilities: {
          // 类型: boolean。
          // 作用: 是否提供首页数据能力，true 展示首页能力，false 不展示。
          home: true,
          // 类型: boolean。
          // 作用: 是否提供电影页数据能力，true 展示电影能力，false 不展示。
          movie: true,
          // 类型: boolean。
          // 作用: 是否提供电视剧页数据能力，true 展示电视剧能力，false 不展示。
          tv: false,
          // 类型: boolean。
          // 作用: 是否提供搜索数据能力，true 展示搜索能力，false 不展示。
          search: true,
          // 类型: boolean。
          // 作用: 是否提供详情数据能力，true 展示详情能力，false 不展示。
          detail: true,
          // 类型: boolean。
          // 作用: 是否提供播放数据能力，true 展示播放能力，false 不展示。
          play: true
        },
        // 类型: Array<object>。
        // 作用: 普通非敏感设置字段定义，当前为空并触发真实空状态。
        settingsSchema: [],
        // 类型: object。
        // 作用: 普通设置当前值，当前为空且未进入页面渲染。
        settingsValues: {},
        // 类型: string。
        // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
        scriptContent: "export default { id: 'custom-online-demo', name: '自定义数据源1', version: 'v1.2.0' };"
      },
      // 类型: object。
      // 作用: 当前记录运行状态，提供启停、健康和在线更新信息。
      runtime: {
        // 类型: boolean。
        // 作用: 数据源启用状态，true 可参与默认源和检测，false 显示已关闭。
        enabled: false,
        // 类型: string。
        // 作用: 三态健康值，驱动正常、检测中或不可用文案和样式。
        healthStatus: 'normal',
        // 类型: string。
        // 作用: 最近一次健康检测 ISO 时间，展示在基本信息区。
        lastCheckedAt: '2026-07-10T10:05:00.000Z',
        // 类型: string。
        // 作用: 最近不可用原因，仅已启用且不可用时展示。
        lastUnavailableReason: '',
        // 类型: boolean。
        // 作用: 在线更新检查状态，true 驱动更新按钮加载，false 表示空闲。
        checkingUpdate: false,
        // 类型: boolean。
        // 作用: 是否存在可用在线版本，true 显示应用更新入口。
        updateAvailable: true,
        // 类型: string。
        // 作用: 在线可用版本号，更新按钮和基本信息区使用。
        availableVersion: 'v1.3.0',
        // 类型: string。
        // 作用: 在线版本发布时间，展示在远程信息区。
        availableVersionUpdatedAt: '2026-07-12T08:00:00.000Z',
        // 类型: string。
        // 作用: 最近一次在线更新检查时间，展示在远程信息区。
        lastUpdateCheckedAt: '2026-07-12T09:00:00.000Z'
      },
      // 类型: object。
      // 作用: 脚本运行授权状态，限制自定义脚本启用并记录用户决定。
      authorization: {
        // 类型: string。
        // 作用: 脚本运行授权状态，区分已授权、等待授权和已撤销。
        status: AUTHORIZATION_STATUS.pending,
        // 类型: string。
        // 作用: 用户确认运行授权的 ISO 时间，空值表示尚未授权。
        authorizedAt: '',
        // 首次待授权没有历史快照，完整空字段由 createMockSourceRecord 自动补齐。
      },
      // 类型: object。
      // 作用: 当前数据源运行缓存占用，供详情展示和两级清理。
      cache: {
        // 类型: number。
        // 作用: 可重新生成临时缓存字节数，控制临时清理按钮。
        temporaryCacheBytes: 734003,
        // 类型: number。
        // 作用: 全部运行缓存字节数，控制全部清理按钮并参与摘要。
        totalCacheBytes: 943718
      }
    }),
    // 场景: 在线导入、已授权、已启用且当前没有可用更新的数据源。
    createMockSourceRecord({
      // 类型: object。
      // 作用: 当前记录的数据源定义，提供脚本身份、导入信息和页面能力。
      definition: {
        // 类型: string。
        // 作用: 数据源契约版本，供脚本导入兼容性校验识别。
        schemaVersion: '1.0.0',
        // 类型: string。
        // 作用: 数据源唯一标识，用于路由、默认源、操作场景和记录查询。
        id: 'custom-online-latest',
        // 类型: string。
        // 作用: 数据源用户名称，展示在列表、详情和确认弹窗。
        name: '自定义数据源2',
        // 类型: string。
        // 作用: 数据源能力或 mock 场景说明，展示在详情页标题区。
        description: '用户在线导入的数据源，当前 mock 场景用于演示已授权运行和最新版本状态。',
        // 类型: string。
        // 作用: 数据源来源类型，决定系统软删除或自定义脚本流程。
        sourceKind: 'custom',
        // 类型: string。
        // 作用: 当前本地脚本版本，展示在列表和详情并参与授权版本记录。
        version: 'v2.0.0',
        // 类型: string。
        // 作用: 数据源导入方式，决定在线更新字段和详情文案。
        importMethod: 'remote',
        // 类型: string。
        // 作用: 在线导入地址，仅 remote 数据源在详情中展示。
        remoteUrl: 'https://example.com/source-latest.js',
        // 类型: string。
        // 作用: 首次导入 ISO 时间，展示在基本信息区。
        importedAt: '2026-07-06T08:30:00.000Z',
        // 类型: string。
        // 作用: 本地脚本最后更新 ISO 时间，展示在基本信息区。
        lastUpdatedAt: '2026-07-11T09:00:00.000Z',
        // 类型: object。
        // 作用: 页面能力布尔映射，决定详情页能力 chip。
        capabilities: {
          // 类型: boolean。
          // 作用: 是否提供首页数据能力，true 展示首页能力，false 不展示。
          home: true,
          // 类型: boolean。
          // 作用: 是否提供电影页数据能力，true 展示电影能力，false 不展示。
          movie: true,
          // 类型: boolean。
          // 作用: 是否提供电视剧页数据能力，true 展示电视剧能力，false 不展示。
          tv: true,
          // 类型: boolean。
          // 作用: 是否提供搜索数据能力，true 展示搜索能力，false 不展示。
          search: true,
          // 类型: boolean。
          // 作用: 是否提供详情数据能力，true 展示详情能力，false 不展示。
          detail: true,
          // 类型: boolean。
          // 作用: 是否提供播放数据能力，true 展示播放能力，false 不展示。
          play: true
        },
        // 类型: Array<object>。
        // 作用: 普通非敏感设置字段定义，当前为空并触发真实空状态。
        settingsSchema: [],
        // 类型: object。
        // 作用: 普通设置当前值，当前为空且未进入页面渲染。
        settingsValues: {},
        // 类型: string。
        // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
        scriptContent: "export default { id: 'custom-online-latest', name: '自定义数据源2', version: 'v2.0.0' };"
      },
      // 类型: object。
      // 作用: 当前记录运行状态，提供启停、健康和在线更新信息。
      runtime: {
        // 类型: boolean。
        // 作用: 数据源启用状态，true 可参与默认源和检测，false 显示已关闭。
        enabled: true,
        // 类型: string。
        // 作用: 三态健康值，驱动正常、检测中或不可用文案和样式。
        healthStatus: 'normal',
        // 类型: string。
        // 作用: 最近一次健康检测 ISO 时间，展示在基本信息区。
        lastCheckedAt: '2026-07-12T10:00:00.000Z',
        // 类型: string。
        // 作用: 最近不可用原因，仅已启用且不可用时展示。
        lastUnavailableReason: '',
        // 类型: boolean。
        // 作用: 在线更新检查状态，true 驱动更新按钮加载，false 表示空闲。
        checkingUpdate: false,
        // 类型: boolean。
        // 作用: 是否存在可用在线版本，true 显示应用更新入口。
        updateAvailable: false,
        // 类型: string。
        // 作用: 在线可用版本号，更新按钮和基本信息区使用。
        availableVersion: '',
        // 类型: string。
        // 作用: 在线版本发布时间，展示在远程信息区。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 最近一次在线更新检查时间，展示在远程信息区。
        lastUpdateCheckedAt: '2026-07-12T10:05:00.000Z'
      },
      // 类型: object。
      // 作用: 脚本运行授权状态，限制自定义脚本启用并记录用户决定。
      authorization: {
        // 类型: string。
        // 作用: 脚本运行授权状态，区分已授权、等待授权和已撤销。
        status: AUTHORIZATION_STATUS.authorized,
        // 类型: string。
        // 作用: 用户确认运行授权的 ISO 时间，空值表示尚未授权。
        authorizedAt: '2026-07-11T09:05:00.000Z',
        // 已授权版本和内容指纹由 createMockSourceRecord 根据当前 definition 自动生成。
      },
      // 类型: object。
      // 作用: 当前数据源运行缓存占用，供详情展示和两级清理。
      cache: {
        // 类型: number。
        // 作用: 可重新生成临时缓存字节数，控制临时清理按钮。
        temporaryCacheBytes: 524288,
        // 类型: number。
        // 作用: 全部运行缓存字节数，控制全部清理按钮并参与摘要。
        totalCacheBytes: 786432
      }
    }),
    // 场景: 文件导入、已授权但当前关闭的数据源。
    createMockSourceRecord({
      // 类型: object。
      // 作用: 当前记录的数据源定义，提供脚本身份、导入信息和页面能力。
      definition: {
        // 类型: string。
        // 作用: 数据源契约版本，供脚本导入兼容性校验识别。
        schemaVersion: '1.0.0',
        // 类型: string。
        // 作用: 数据源唯一标识，用于路由、默认源、操作场景和记录查询。
        id: 'custom-file-demo',
        // 类型: string。
        // 作用: 数据源用户名称，展示在列表、详情和确认弹窗。
        name: '自定义数据源3',
        // 类型: string。
        // 作用: 数据源能力或 mock 场景说明，展示在详情页标题区。
        description: '用户通过本地文件导入的数据源，用于验证非在线来源字段和授权状态。',
        // 类型: string。
        // 作用: 数据源来源类型，决定系统软删除或自定义脚本流程。
        sourceKind: 'custom',
        // 类型: string。
        // 作用: 当前本地脚本版本，展示在列表和详情并参与授权版本记录。
        version: 'v1.1.0',
        // 类型: string。
        // 作用: 数据源导入方式，决定在线更新字段和详情文案。
        importMethod: 'file',
        // 类型: string。
        // 作用: 在线导入地址，仅 remote 数据源在详情中展示。
        remoteUrl: '',
        // 类型: string。
        // 作用: 首次导入 ISO 时间，展示在基本信息区。
        importedAt: '2026-07-09T07:20:00.000Z',
        // 类型: string。
        // 作用: 本地脚本最后更新 ISO 时间，展示在基本信息区。
        lastUpdatedAt: '2026-07-09T07:20:00.000Z',
        // 类型: object。
        // 作用: 页面能力布尔映射，决定详情页能力 chip。
        capabilities: {
          // 类型: boolean。
          // 作用: 是否提供首页数据能力，true 展示首页能力，false 不展示。
          home: true,
          // 类型: boolean。
          // 作用: 是否提供电影页数据能力，true 展示电影能力，false 不展示。
          movie: true,
          // 类型: boolean。
          // 作用: 是否提供电视剧页数据能力，true 展示电视剧能力，false 不展示。
          tv: false,
          // 类型: boolean。
          // 作用: 是否提供搜索数据能力，true 展示搜索能力，false 不展示。
          search: true,
          // 类型: boolean。
          // 作用: 是否提供详情数据能力，true 展示详情能力，false 不展示。
          detail: true,
          // 类型: boolean。
          // 作用: 是否提供播放数据能力，true 展示播放能力，false 不展示。
          play: true
        },
        // 类型: Array<object>。
        // 作用: 普通非敏感设置字段定义，当前为空并触发真实空状态。
        settingsSchema: [],
        // 类型: object。
        // 作用: 普通设置当前值，当前为空且未进入页面渲染。
        settingsValues: {},
        // 类型: string。
        // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
        scriptContent: "export default { id: 'custom-file-demo', name: '自定义数据源3', version: 'v1.1.0' };"
      },
      // 类型: object。
      // 作用: 当前记录运行状态，提供启停、健康和在线更新信息。
      runtime: {
        // 类型: boolean。
        // 作用: 数据源启用状态，true 可参与默认源和检测，false 显示已关闭。
        enabled: false,
        // 类型: string。
        // 作用: 三态健康值，驱动正常、检测中或不可用文案和样式。
        healthStatus: 'normal',
        // 类型: string。
        // 作用: 最近一次健康检测 ISO 时间，展示在基本信息区。
        lastCheckedAt: '2026-07-09T07:25:00.000Z',
        // 类型: string。
        // 作用: 最近不可用原因，仅已启用且不可用时展示。
        lastUnavailableReason: '',
        // 类型: boolean。
        // 作用: 在线更新检查状态，true 驱动更新按钮加载，false 表示空闲。
        checkingUpdate: false,
        // 类型: boolean。
        // 作用: 是否存在可用在线版本，true 显示应用更新入口。
        updateAvailable: false,
        // 类型: string。
        // 作用: 在线可用版本号，更新按钮和基本信息区使用。
        availableVersion: '',
        // 类型: string。
        // 作用: 在线版本发布时间，展示在远程信息区。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 最近一次在线更新检查时间，展示在远程信息区。
        lastUpdateCheckedAt: ''
      },
      // 类型: object。
      // 作用: 脚本运行授权状态，限制自定义脚本启用并记录用户决定。
      authorization: {
        // 类型: string。
        // 作用: 脚本运行授权状态，区分已授权、等待授权和已撤销。
        status: AUTHORIZATION_STATUS.authorized,
        // 类型: string。
        // 作用: 用户确认运行授权的 ISO 时间，空值表示尚未授权。
        authorizedAt: '2026-07-09T07:22:00.000Z',
        // 已授权版本和内容指纹由 createMockSourceRecord 根据当前 definition 自动生成。
      },
      // 类型: object。
      // 作用: 当前数据源运行缓存占用，供详情展示和两级清理。
      cache: {
        // 类型: number。
        // 作用: 可重新生成临时缓存字节数，控制临时清理按钮。
        temporaryCacheBytes: 262144,
        // 类型: number。
        // 作用: 全部运行缓存字节数，控制全部清理按钮并参与摘要。
        totalCacheBytes: 393216
      }
    }),
    // 场景: 粘贴文本导入且尚未授权的数据源。
    createMockSourceRecord({
      // 类型: object。
      // 作用: 当前记录的数据源定义，提供脚本身份、导入信息和页面能力。
      definition: {
        // 类型: string。
        // 作用: 数据源契约版本，供脚本导入兼容性校验识别。
        schemaVersion: '1.0.0',
        // 类型: string。
        // 作用: 数据源唯一标识，用于路由、默认源、操作场景和记录查询。
        id: 'custom-text-demo',
        // 类型: string。
        // 作用: 数据源用户名称，展示在列表、详情和确认弹窗。
        name: '自定义数据源4',
        // 类型: string。
        // 作用: 数据源能力或 mock 场景说明，展示在详情页标题区。
        description: '用户通过粘贴脚本文本导入的数据源，用于验证首次启用授权流程。',
        // 类型: string。
        // 作用: 数据源来源类型，决定系统软删除或自定义脚本流程。
        sourceKind: 'custom',
        // 类型: string。
        // 作用: 当前本地脚本版本，展示在列表和详情并参与授权版本记录。
        version: 'v1.0.0',
        // 类型: string。
        // 作用: 数据源导入方式，决定在线更新字段和详情文案。
        importMethod: 'text',
        // 类型: string。
        // 作用: 在线导入地址，仅 remote 数据源在详情中展示。
        remoteUrl: '',
        // 类型: string。
        // 作用: 首次导入 ISO 时间，展示在基本信息区。
        importedAt: '2026-07-10T11:10:00.000Z',
        // 类型: string。
        // 作用: 本地脚本最后更新 ISO 时间，展示在基本信息区。
        lastUpdatedAt: '2026-07-10T11:10:00.000Z',
        // 类型: object。
        // 作用: 页面能力布尔映射，决定详情页能力 chip。
        capabilities: {
          // 类型: boolean。
          // 作用: 是否提供首页数据能力，true 展示首页能力，false 不展示。
          home: false,
          // 类型: boolean。
          // 作用: 是否提供电影页数据能力，true 展示电影能力，false 不展示。
          movie: true,
          // 类型: boolean。
          // 作用: 是否提供电视剧页数据能力，true 展示电视剧能力，false 不展示。
          tv: true,
          // 类型: boolean。
          // 作用: 是否提供搜索数据能力，true 展示搜索能力，false 不展示。
          search: true,
          // 类型: boolean。
          // 作用: 是否提供详情数据能力，true 展示详情能力，false 不展示。
          detail: true,
          // 类型: boolean。
          // 作用: 是否提供播放数据能力，true 展示播放能力，false 不展示。
          play: true
        },
        // 类型: Array<object>。
        // 作用: 普通非敏感设置字段定义，当前为空并触发真实空状态。
        settingsSchema: [],
        // 类型: object。
        // 作用: 普通设置当前值，当前为空且未进入页面渲染。
        settingsValues: {},
        // 类型: string。
        // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
        scriptContent: "export default { id: 'custom-text-demo', name: '自定义数据源4', version: 'v1.0.0' };"
      },
      // 类型: object。
      // 作用: 当前记录运行状态，提供启停、健康和在线更新信息。
      runtime: {
        // 类型: boolean。
        // 作用: 数据源启用状态，true 可参与默认源和检测，false 显示已关闭。
        enabled: false,
        // 类型: string。
        // 作用: 三态健康值，驱动正常、检测中或不可用文案和样式。
        healthStatus: 'normal',
        // 类型: string。
        // 作用: 最近一次健康检测 ISO 时间，展示在基本信息区。
        lastCheckedAt: '',
        // 类型: string。
        // 作用: 最近不可用原因，仅已启用且不可用时展示。
        lastUnavailableReason: '',
        // 类型: boolean。
        // 作用: 在线更新检查状态，true 驱动更新按钮加载，false 表示空闲。
        checkingUpdate: false,
        // 类型: boolean。
        // 作用: 是否存在可用在线版本，true 显示应用更新入口。
        updateAvailable: false,
        // 类型: string。
        // 作用: 在线可用版本号，更新按钮和基本信息区使用。
        availableVersion: '',
        // 类型: string。
        // 作用: 在线版本发布时间，展示在远程信息区。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 最近一次在线更新检查时间，展示在远程信息区。
        lastUpdateCheckedAt: ''
      },
      // 类型: object。
      // 作用: 脚本运行授权状态，限制自定义脚本启用并记录用户决定。
      authorization: {
        // 类型: string。
        // 作用: 脚本运行授权状态，区分已授权、等待授权和已撤销。
        status: AUTHORIZATION_STATUS.pending,
        // 类型: string。
        // 作用: 用户确认运行授权的 ISO 时间，空值表示尚未授权。
        authorizedAt: '',
        // 首次待授权没有历史快照，完整空字段由 createMockSourceRecord 自动补齐。
      },
      // 类型: object。
      // 作用: 当前数据源运行缓存占用，供详情展示和两级清理。
      cache: {
        // 类型: number。
        // 作用: 可重新生成临时缓存字节数，控制临时清理按钮。
        temporaryCacheBytes: 0,
        // 类型: number。
        // 作用: 全部运行缓存字节数，控制全部清理按钮并参与摘要。
        totalCacheBytes: 0
      }
    }),
    // 场景: 已软删除的系统源；默认不显示在列表，只出现在恢复系统源对话框。
    createMockSourceRecord({
      // 类型: object。
      // 作用: 当前记录的数据源定义，提供脚本身份、导入信息和页面能力。
      definition: {
        // 类型: string。
        // 作用: 数据源契约版本，供脚本导入兼容性校验识别。
        schemaVersion: '1.0.0',
        // 类型: string。
        // 作用: 数据源唯一标识，用于路由、默认源、操作场景和记录查询。
        id: 'system-source-5',
        // 类型: string。
        // 作用: 数据源用户名称，展示在列表、详情和确认弹窗。
        name: '系统数据源5',
        // 类型: string。
        // 作用: 数据源能力或 mock 场景说明，展示在详情页标题区。
        description: '系统内置备用数据源，用于验证软删除和恢复流程。',
        // 类型: string。
        // 作用: 数据源来源类型，决定系统软删除或自定义脚本流程。
        sourceKind: 'system',
        // 类型: string。
        // 作用: 当前本地脚本版本，展示在列表和详情并参与授权版本记录。
        version: 'v1.0.0',
        // 类型: string。
        // 作用: 数据源导入方式，决定在线更新字段和详情文案。
        importMethod: 'builtin',
        // 类型: string。
        // 作用: 在线导入地址，仅 remote 数据源在详情中展示。
        remoteUrl: '',
        // 类型: string。
        // 作用: 首次导入 ISO 时间，展示在基本信息区。
        importedAt: '2026-07-01T08:00:00.000Z',
        // 类型: string。
        // 作用: 本地脚本最后更新 ISO 时间，展示在基本信息区。
        lastUpdatedAt: '2026-07-01T08:00:00.000Z',
        // 类型: object。
        // 作用: 页面能力布尔映射，决定详情页能力 chip。
        capabilities: {
          // 类型: boolean。
          // 作用: 是否提供首页数据能力，true 展示首页能力，false 不展示。
          home: true,
          // 类型: boolean。
          // 作用: 是否提供电影页数据能力，true 展示电影能力，false 不展示。
          movie: true,
          // 类型: boolean。
          // 作用: 是否提供电视剧页数据能力，true 展示电视剧能力，false 不展示。
          tv: true,
          // 类型: boolean。
          // 作用: 是否提供搜索数据能力，true 展示搜索能力，false 不展示。
          search: true,
          // 类型: boolean。
          // 作用: 是否提供详情数据能力，true 展示详情能力，false 不展示。
          detail: true,
          // 类型: boolean。
          // 作用: 是否提供播放数据能力，true 展示播放能力，false 不展示。
          play: true
        },
        // 类型: Array<object>。
        // 作用: 普通非敏感设置字段定义，当前为空并触发真实空状态。
        settingsSchema: [],
        // 类型: object。
        // 作用: 普通设置当前值，当前为空且未进入页面渲染。
        settingsValues: {},
        // 类型: string。
        // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
        scriptContent: "export default { id: 'system-source-5', name: '系统数据源5', version: 'v1.0.0' };"
      },
      // 类型: object。
      // 作用: 当前记录运行状态，提供启停、健康和在线更新信息。
      runtime: {
        // 类型: boolean。
        // 作用: 数据源启用状态，true 可参与默认源和检测，false 显示已关闭。
        enabled: false,
        // 类型: string。
        // 作用: 三态健康值，驱动正常、检测中或不可用文案和样式。
        healthStatus: 'normal',
        // 类型: string。
        // 作用: 最近一次健康检测 ISO 时间，展示在基本信息区。
        lastCheckedAt: '2026-07-08T08:00:00.000Z',
        // 类型: string。
        // 作用: 最近不可用原因，仅已启用且不可用时展示。
        lastUnavailableReason: '',
        // 类型: boolean。
        // 作用: 在线更新检查状态，true 驱动更新按钮加载，false 表示空闲。
        checkingUpdate: false,
        // 类型: boolean。
        // 作用: 是否存在可用在线版本，true 显示应用更新入口。
        updateAvailable: false,
        // 类型: string。
        // 作用: 在线可用版本号，更新按钮和基本信息区使用。
        availableVersion: '',
        // 类型: string。
        // 作用: 在线版本发布时间，展示在远程信息区。
        availableVersionUpdatedAt: '',
        // 类型: string。
        // 作用: 最近一次在线更新检查时间，展示在远程信息区。
        lastUpdateCheckedAt: ''
      },
      // 类型: object。
      // 作用: 脚本运行授权状态，限制自定义脚本启用并记录用户决定。
      authorization: {
        // 类型: string。
        // 作用: 脚本运行授权状态，区分已授权、等待授权和已撤销。
        status: AUTHORIZATION_STATUS.authorized,
        // 类型: string。
        // 作用: 用户确认运行授权的 ISO 时间，空值表示尚未授权。
        authorizedAt: '2026-07-01T08:00:00.000Z',
        // 已授权版本和内容指纹由 createMockSourceRecord 根据当前 definition 自动生成。
      },
      // 类型: object。
      // 作用: 当前数据源运行缓存占用，供详情展示和两级清理。
      cache: {
        // 类型: number。
        // 作用: 可重新生成临时缓存字节数，控制临时清理按钮。
        temporaryCacheBytes: 0,
        // 类型: number。
        // 作用: 全部运行缓存字节数，控制全部清理按钮并参与摘要。
        totalCacheBytes: 0
      }
    })
  ]
};

// 类型: object。
// 作用: 为健康检查和在线更新提供稳定 mock 结果，避免 service 按数据源 id 编写业务硬编码分支。
// 字段: health，object，按 sourceId 提供检测结果和不可用原因。
// 字段: updates，object，按 sourceId 提供在线版本检查结果。
export const sourceOperationScenarios = {
  // 类型: object。
  // 作用: 按 sourceId 保存下一次 mock 健康检测结果，供 checkSource 和 checkAllSources 查询。
  health: {
    // 以下每个条目类型均为 object；status 提供三态检测结果，reason 提供不可用原因。
    // 模拟数据源 01 检测结果保持正常。
    'system-source-1': { status: 'normal', reason: '' },
    // 模拟数据源 02 检测结果保持不可用，用于验证错误原因展示。
    'system-source-2': { status: 'unavailable', reason: '模拟检测请求超时。' },
    // 模拟数据源 03 重新检测结果为正常。
    'system-source-3': { status: 'normal', reason: '' },
    // 模拟数据源 04 检测结果保持正常。
    'system-source-4': { status: 'normal', reason: '' },
    // 模拟数据源 05 检测结果为正常。
    'custom-online-demo': { status: 'normal', reason: '' },
    // 模拟数据源 06 检测结果为正常。
    'custom-online-latest': { status: 'normal', reason: '' },
    // 模拟数据源 07 检测结果为正常。
    'custom-file-demo': { status: 'normal', reason: '' },
    // 模拟数据源 08 检测结果为正常。
    'custom-text-demo': { status: 'normal', reason: '' },
    // 已软删除模拟数据源 09 保留正常检测场景，恢复后可继续使用。
    'system-source-5': { status: 'normal', reason: '' }
  },
  // 类型: object。
  // 作用: 按远程 sourceId 保存 mock 在线版本检查结果和可替换脚本文本。
  updates: {
    // 类型: object。
    // 作用: 模拟数据源 05 存在 v1.3.0 更新，用于验证检查和应用更新流程。
    'custom-online-demo': {
      // 类型: boolean；true 表示检查后应显示应用更新入口。
      available: true,
      // 类型: string。
      // 作用: 远程可用版本号，检查完成后写入 runtime.availableVersion。
      version: 'v1.3.0',
      // 类型: string；作用: 远程版本发布时间，写入 runtime.availableVersionUpdatedAt。
      updatedAt: '2026-07-12T08:00:00.000Z',
      // 类型: string。
      // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
      scriptContent: "export default { id: 'custom-online-demo', name: '自定义数据源1', version: 'v1.3.0' };"
    },
    // 类型: object。
    // 作用: 模拟数据源 06 没有可用更新，用于验证“当前已是最新版本”分支。
    'custom-online-latest': {
      // 类型: boolean；false 表示检查后不显示应用更新入口。
      available: false,
      // 类型: string。
      // 作用: 没有远程可用版本时保持空字符串。
      version: '',
      // 类型: string；作用: 没有远程版本时保持空字符串。
      updatedAt: '',
      // 类型: string。
      // 作用: 可导出和可更新的数据源脚本文本，不包含缓存或个人数据。
      scriptContent: ''
    }
  }
};
