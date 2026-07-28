/*
  source-update.mock.js 模块说明

  - 文件职责:
      提供 MockSourceUpdatePort 唯一读取的确定性在线更新检测结果和受审更新候选。
      使用完整 SourcePackage 与 SourceDefinition 表达候选，避免端口、Manager 或页面临时拼接保存对象。
      本文件不访问网络、不修改 Repository、SourceManagerState 或 Host，也不包含运行延时。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      IMPORT_METHOD、SOURCE_KIND: 自定义配置，候选复用正式来源类型和导入方式枚举。
      createSourceScriptHash: 自定义工具，为受审候选真实脚本文本生成一致 integrity.scriptHash。

  - 模块级常量:
      SOURCE_PACKAGE_HASH_ALGORITHM: string，脚本变化检测算法名称。
      SOURCE_SCHEMA_VERSION: string，候选 Package 与 Definition 当前结构版本。
      UNRESOLVED_CUSTOM_PROVIDER_KEY: string，候选保持的不可执行自定义 Provider 门禁。
      UPDATED_SOURCE_ID: string，存在受审候选的远程模拟源 id。
      LATEST_SOURCE_ID: string，当前已是最新版本的远程模拟源 id。
      UPDATED_PACKAGE_REF: string，更新目标稳定 Package 引用。
      UPDATED_REMOTE_URL: string，更新目标稳定远程导入地址。
      UPDATE_CHECKED_AT: string，模拟更新检测统一完成时间。
      UPDATED_VERSION_AT: string，受审候选在线版本更新时间。
      UPDATED_SCRIPT_CONTENT: string，受审候选脚本文本。
      sourceUpdateMock: object，冻结检测结果和候选映射。

  - 模块级变量:
      无

  - 模块级辅助函数:
      freezeFixture(value): 递归冻结夹具对象和数组。

  - 模块级类:
      无

  - 对外导出:
      sourceUpdateMock: object，供 MockSourceUpdatePort 只读查询的深冻结夹具。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 候选 Definition 使用正式 remote 值，不散落导入方式字符串。
  IMPORT_METHOD,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源来源类型枚举。
  // 文件作用: 候选保持 custom 类型并触发版本变化后的授权失效规则。
  SOURCE_KIND
} from '../../config/source-manager.config.js';

// 导入来源: ../../utils/sourceAuthorization.js。
// 导入内容: createSourceScriptHash 稳定脚本指纹函数。
// 文件作用: 让候选 integrity 声明始终来自同一真实脚本文本，不手写重复哈希。
import { createSourceScriptHash } from '../../utils/sourceAuthorization.js';

// 类型: string。
// 作用: 说明候选脚本使用项目现有 FNV-1a 32 位变化检测，不表示密码学签名或安全认证。
const SOURCE_PACKAGE_HASH_ALGORITHM = 'fnv1a-32';

// 类型: string。
// 作用: 固定候选 Package 与 Definition 的当前结构版本，避免两个对象各自散落版本字面值。
const SOURCE_SCHEMA_VERSION = '1.0.0';

// 类型: string。
// 作用: 保持当前自定义导入源不可执行门禁，在线更新不能自行获得受审工厂能力。
const UNRESOLVED_CUSTOM_PROVIDER_KEY = 'unresolved-custom-provider';

// 类型: string。
// 作用: 标识模拟数据源 05，检查时返回 v1.3.0 并允许读取完整候选。
const UPDATED_SOURCE_ID = 'custom-online-demo';

// 类型: string。
// 作用: 标识模拟数据源 06，检查时返回无更新且不提供更新候选。
const LATEST_SOURCE_ID = 'custom-online-latest';

// 类型: string。
// 作用: 保持模拟数据源 05 当前稳定 Package 引用，更新不是重新导入。
const UPDATED_PACKAGE_REF = 'source-package::custom-online-demo';

// 类型: string。
// 作用: 保持模拟数据源 05 首次导入远程地址，更新不能改写来源身份。
const UPDATED_REMOTE_URL = 'https://example.com/source-demo.js';

// 类型: string。
// 作用: 固定系统演示端口检测完成时间，使页面展示不依赖系统时钟或固定等待。
const UPDATE_CHECKED_AT = '2026-07-17T02:00:00.000Z';

// 类型: string。
// 作用: 固定 v1.3.0 在线版本更新时间，驱动 SourceManagerState.availableVersionUpdatedAt。
const UPDATED_VERSION_AT = '2026-07-12T08:00:00.000Z';

// 类型: string。
// 作用: 保存模拟数据源 05 的受审下一脚本文本，供 Package 指纹和最小导出验证。
const UPDATED_SCRIPT_CONTENT = "export default { id: 'custom-online-demo', name: '模拟数据源 05', version: 'v1.3.0' };";

/**
 * 递归冻结模拟更新夹具。
 * 副作用: 只冻结当前模块新建对象和数组，不修改外部输入或运行状态。
 * 成功路径: 返回原值；对象和数组的全部后代不可被端口或测试原地修改。
 *
 * @param {*} value 当前夹具节点。
 * @returns {*} 深冻结后的原节点。
 */
function freezeFixture(value) {
  // 条件分支: 当前节点不是对象、为 null 或已经冻结时进入。
  // 执行内容: 直接返回，不对标量或已处理节点重复遍历。
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  // 循环类型: Object.values.forEach。
  // 初始值: 当前对象第一个自有可枚举字段值。
  // 终止条件: 全部后代完成递归冻结。
  // 循环作用: 保证候选的 capabilities、integrity 和 settingsSchema 也不可原地修改。
  Object.values(value).forEach(childValue => freezeFixture(childValue));

  // 返回值类型: object。
  // 作用: 冻结当前节点并返回原引用，构建完整深冻结夹具图。
  return Object.freeze(value);
}

// 类型: object。
// 作用: 保存默认无更新结果和两个远程模拟源的精确检测/候选映射；只有 MockSourceUpdatePort 应在运行链读取它。
export const sourceUpdateMock = freezeFixture({
  // 类型: object。
  // 作用: 未登记远程源使用的标准无更新结果，避免回退旧 sourceOperationScenarios 或真实网络。
  defaultCheckResult: {
    // 类型: boolean。
    // 作用: false 表示当前夹具没有该源的可用在线版本。
    updateAvailable: false,
    // 类型: string。
    // 作用: 没有更新时保持空版本，页面不显示应用更新入口。
    availableVersion: '',
    // 类型: string。
    // 作用: 没有更新时保持空在线版本时间。
    availableVersionUpdatedAt: '',
    // 类型: string。
    // 作用: 使用确定性模拟检测时间，SourceManager 写入 lastUpdateCheckedAt。
    checkedAt: UPDATE_CHECKED_AT
  },

  // 类型: object。
  // 作用: 按真实 sourceId 保存标准检测结果，端口不根据名称、URL 或来源类型模糊匹配。
  checkResultsBySourceId: {
    // 类型: object。
    // 作用: 模拟数据源 05 存在 v1.3.0 更新。
    [UPDATED_SOURCE_ID]: {
      // 类型: boolean。
      // 作用: true 表示用户可以在确认后请求受审候选。
      updateAvailable: true,
      // 类型: string。
      // 作用: 保存远程可用业务版本，供详情页显示。
      availableVersion: 'v1.3.0',
      // 类型: string。
      // 作用: 保存远程版本更新时间。
      availableVersionUpdatedAt: UPDATED_VERSION_AT,
      // 类型: string。
      // 作用: 保存本次模拟检测完成时间。
      checkedAt: UPDATE_CHECKED_AT
    },

    // 类型: object。
    // 作用: 模拟数据源 06 已是最新版本，明确没有候选。
    [LATEST_SOURCE_ID]: {
      // 类型: boolean。
      // 作用: false 表示当前不显示应用更新入口。
      updateAvailable: false,
      // 类型: string。
      // 作用: 没有更新时保持空版本。
      availableVersion: '',
      // 类型: string。
      // 作用: 没有更新时保持空在线版本时间。
      availableVersionUpdatedAt: '',
      // 类型: string。
      // 作用: 保存本次模拟检测完成时间。
      checkedAt: UPDATE_CHECKED_AT
    }
  },

  // 类型: object。
  // 作用: 按真实 sourceId 保存用户确认后才能读取的完整受审候选；检测方法不返回这里的 Package 或 Definition。
  candidatesBySourceId: {
    // 类型: object。
    // 作用: 模拟数据源 05 的 v1.3.0 完整更新候选，稳定身份字段与当前 Repository 记录一致。
    [UPDATED_SOURCE_ID]: {
      // 类型: object。
      // 作用: 保存下一脚本包，SourceManager 会再次重新计算 scriptHash。
      sourcePackage: {
        // 类型: string。
        // 作用: 保持当前稳定 Package 引用，更新不是删除加重新导入。
        packageRef: UPDATED_PACKAGE_REF,
        // 类型: string。
        // 作用: 保持当前 Package 保存结构版本。
        schemaVersion: SOURCE_SCHEMA_VERSION,
        // 类型: string。
        // 作用: 保持目标真实 sourceId。
        sourceId: UPDATED_SOURCE_ID,
        // 类型: string。
        // 作用: 保持未解析自定义 Provider 门禁，不因为更新获得执行能力。
        providerKey: UNRESOLVED_CUSTOM_PROVIDER_KEY,
        // 类型: string。
        // 作用: 保存 v1.3.0 规范化脚本文本。
        scriptContent: UPDATED_SCRIPT_CONTENT,
        // 类型: object。
        // 作用: 保存算法名称和从真实脚本文本计算的变化检测指纹。
        integrity: {
          // 类型: string。
          // 作用: 声明当前变化检测算法。
          algorithm: SOURCE_PACKAGE_HASH_ALGORITHM,
          // 类型: string。
          // 作用: 由 UPDATED_SCRIPT_CONTENT 计算，适配器和 Manager 会再次复核。
          scriptHash: createSourceScriptHash(UPDATED_SCRIPT_CONTENT)
        }
      },

      // 类型: object。
      // 作用: 保存下一可序列化定义，只改变版本、说明和最后更新时间等非稳定身份字段。
      sourceDefinition: {
        // 类型: string。
        // 作用: 保持当前 Definition 结构版本。
        schemaVersion: SOURCE_SCHEMA_VERSION,
        // 类型: string。
        // 作用: 保持目标统一身份。
        id: UPDATED_SOURCE_ID,
        // 类型: string。
        // 作用: 保持设置页用户可见名称。
        name: '模拟数据源 05',
        // 类型: string。
        // 作用: 说明当前候选用于模拟在线更新和重新授权流程。
        description: '用户在线导入的数据源，当前模拟候选用于验证在线更新和重新授权。',
        // 类型: string。
        // 作用: 保持自定义源类型，版本/脚本变化后旧授权会失效。
        sourceKind: SOURCE_KIND.custom,
        // 类型: string。
        // 作用: 保存候选唯一业务版本。
        version: 'v1.3.0',
        // 类型: string。
        // 作用: 保持未解析自定义 Provider 门禁。
        providerKey: UNRESOLVED_CUSTOM_PROVIDER_KEY,
        // 类型: string。
        // 作用: 保持当前稳定 Package 引用。
        packageRef: UPDATED_PACKAGE_REF,
        // 类型: string。
        // 作用: 保持远程导入方式，详情页继续显示更新入口。
        importMethod: IMPORT_METHOD.remote,
        // 类型: string。
        // 作用: 保持首次导入使用的远程地址。
        remoteUrl: UPDATED_REMOTE_URL,
        // 类型: string。
        // 作用: 保持首次导入时间，更新不能改写来源历史。
        importedAt: '2026-07-08T09:30:00.000Z',
        // 类型: string。
        // 作用: 使用在线版本更新时间记录本地脚本最后成功更新时间。
        lastUpdatedAt: UPDATED_VERSION_AT,
        // 类型: object。
        // 作用: 保持当前六类页面能力，不借更新扩大或缩小设置页字段。
        capabilities: {
          home: true,
          movie: true,
          tv: false,
          search: true,
          detail: true,
          play: true
        },
        // 类型: Array<object>。
        // 作用: 当前候选没有普通非敏感设置声明。
        settingsSchema: []
      }
    }
  }
});
