/*
  pageRequestStateSelectors.js 模块说明

  - 文件职责:
      把一个或多个 PageBucket.transaction 投影为页面统一请求展示状态。
      供首页、电影页、电视剧页和搜索页区分加载、成功内容、成功空结果与失败，不保存第二份请求状态。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SITE_CONTENT_REQUEST_STATUS: 自定义枚举，提供 PageBucket 请求事务允许的四种底层状态。

  - 模块级常量:
      PAGE_REQUEST_VIEW_STATUS: object，页面请求展示层允许的五种状态。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeRequestEntries(requestEntries)
          - params:
              -- requestEntries: Array<object>，页面读取的请求事务条目候选。
          - return:
              Array<object>，包含稳定 key 和 transaction 的有效条目。
          - description:
              过滤异常条目并保留页面区域身份，供单桶和首页多桶使用同一投影算法。
      readTransactionSourceId(transaction)
          - params:
              -- transaction: object，当前 PageBucket 请求事务。
          - return:
              string，当前请求实际源或显式意图源。
          - description:
              只从事务读取当前请求身份，避免错误状态回退最后成功桶来源。
      readTransactionErrorMessage(transaction)
          - params:
              -- transaction: object，失败 PageBucket 请求事务。
          - return:
              string，稳定用户错误说明或空字符串。
          - description:
              只读取 Store 已收敛的安全错误文案，不解释 Provider 或站点业务。

  - 模块级类:
      无

  - 对外导出:
      PAGE_REQUEST_VIEW_STATUS: object，页面请求展示状态枚举。
      createPageRequestViewState: Function，从请求事务和可见条目数创建只读页面状态。
*/

// 导入来源: ../store/siteContentStore.js。
// 导入内容: SITE_CONTENT_REQUEST_STATUS 页面桶请求事务状态枚举。
// 文件作用: 把 Store 的 idle/loading/success/error 映射为统一页面展示状态。
import { SITE_CONTENT_REQUEST_STATUS } from '../store/siteContentStore.js';

// 类型: object。
// 作用: 冻结页面展示层允许的请求状态；页面不得用本地 Boolean 组合扩张状态语义。
export const PAGE_REQUEST_VIEW_STATUS = Object.freeze({
  // 类型: string；作用: 当前页面没有有效请求意图或页面桶尚未开始请求。
  idle: 'idle',
  // 类型: string；作用: 至少一个当前请求仍在等待 Runtime 或 Provider 结果。
  loading: 'loading',
  // 类型: string；作用: 当前请求已经成功且至少有一条可见内容。
  ready: 'ready',
  // 类型: string；作用: 当前请求已经成功但没有可见内容，页面可以展示业务空态。
  empty: 'empty',
  // 类型: string；作用: 至少一个当前请求失败且没有仍在执行的同页请求。
  error: 'error'
});

/**
 * 标准化页面请求事务条目。
 * 纯函数: 只读取 requestEntries，返回新数组和新条目对象，不修改 PageBucket.transaction。
 * 失败路径: 非数组、非对象或没有 transaction 的条目被过滤，调用方最终得到 idle 状态。
 *
 * @param {*} requestEntries 页面请求事务条目候选。
 * @returns {Array<object>} 有效请求事务条目。
 * @returns {string} return[].key 页面区域稳定键，单桶页面允许为空字符串。
 * @returns {object} return[].transaction PageBucket 事务隔离快照。
 */
function normalizeRequestEntries(requestEntries) {
  // 类型: Array<object>；作用: 非数组输入按空集合处理，让页面状态失败关闭到 idle。
  const safeEntries = Array.isArray(requestEntries) ? requestEntries : [];

  // 循环类型: Array.prototype.filter + map。
  // 循环作用: 只保留具有事务对象的条目，并隔离页面区域键与事务顶层引用。
  return safeEntries
    .filter((entry) => entry
      && typeof entry === 'object'
      && !Array.isArray(entry)
      && entry.transaction
      && typeof entry.transaction === 'object'
      && !Array.isArray(entry.transaction))
    .map((entry) => ({
      // 类型: string；作用: 保留首页模块键或单桶页面标识，失败列表据此指出受影响区域。
      key: typeof entry.key === 'string' ? entry.key : '',
      // 类型: object；作用: 创建浅层隔离事务，选择器不会向 Store 写回页面展示字段。
      transaction: { ...entry.transaction }
    }));
}

/**
 * 读取请求事务代表的当前数据源身份。
 * 纯函数: 只读取 transaction，不查询最后成功桶、Manager 或页面状态。
 * 兜底策略: 优先使用 Runtime 已解析源，解析前回退调用方显式源，两者都缺失时返回空字符串。
 *
 * @param {object} transaction PageBucket 请求事务。
 * @returns {string} 当前请求数据源身份或空字符串。
 */
function readTransactionSourceId(transaction) {
  // 类型: string；作用: Runtime 完成身份解析后由事务记录真实 Provider 身份。
  const resolvedSourceId = typeof transaction?.resolvedSourceId === 'string'
    ? transaction.resolvedSourceId.trim()
    : '';
  // 类型: string；作用: 身份解析前或失败时保留页面显式提交的数据源意图。
  const requestedSourceId = typeof transaction?.requestedSourceId === 'string'
    ? transaction.requestedSourceId.trim()
    : '';
  return resolvedSourceId || requestedSourceId;
}

/**
 * 读取失败事务的安全错误说明。
 * 纯函数: 只读取 Store 已标准化的 transaction.error.message，不解析错误码或站点响应。
 * 兜底策略: 错误对象或 message 缺失时返回空字符串，由页面状态使用统一通用说明。
 *
 * @param {object} transaction 失败 PageBucket 请求事务。
 * @returns {string} 清理首尾空白后的错误说明或空字符串。
 */
function readTransactionErrorMessage(transaction) {
  return typeof transaction?.error?.message === 'string'
    ? transaction.error.message.trim()
    : '';
}

/**
 * 从一个或多个 PageBucket 事务创建统一页面请求展示状态。
 * 纯函数: 只读取 options、事务快照和可见条目数量，不修改 Store、页面、Router 或 Provider。
 * 单桶规则: success 根据 visibleItemCount 投影为 ready 或 empty；error 与业务空结果严格分离。
 * 多桶规则: 首页任一 loading 时保持 loading；全部收敛后任一 error 进入 error，同时保留已成功模块的可见内容。
 * 失败路径: 没有请求意图或没有有效事务时返回 idle；错误文案缺失时使用调用方提供的通用说明。
 *
 * @param {object} options 页面状态投影参数。
 * @param {Array<object>} options.requestEntries 请求事务条目集合。
 * @param {number} options.visibleItemCount 当前 selector 实际返回的可见内容总数。
 * @param {boolean} options.hasRequestIntent true 表示当前 URL 需要请求；false 表示搜索等页面处于输入引导态。
 * @param {string} options.fallbackErrorMessage Store 没有安全 message 时使用的通用错误说明。
 * @returns {Readonly<object>} 页面统一请求展示状态。
 * @returns {string} return.status idle、loading、ready、empty 或 error。
 * @returns {boolean} return.loading true 表示至少一个事务正在请求，false 表示没有在途请求。
 * @returns {boolean} return.hasError true 表示至少一个事务失败，false 表示当前没有失败事务。
 * @returns {boolean} return.hasVisibleContent true 表示 selector 当前仍返回内容，false 表示内容为空或被 stale 隐藏。
 * @returns {boolean} return.isBlockingLoading true 表示加载中且没有可见旧内容，需要显示占位反馈。
 * @returns {boolean} return.canRetry true 表示失败已收敛且没有在途请求，可以提交原位重试。
 * @returns {string} return.errorMessage 当前第一条安全错误说明或通用兜底。
 * @returns {string} return.sourceId 当前 loading/error/success 事务代表的数据源身份。
 * @returns {Array<string>} return.failedKeys 失败的首页模块或单桶区域键。
 */
export function createPageRequestViewState(options = {}) {
  // 类型: boolean；作用: false 表示当前 URL 没有请求意图，旧桶事务不得投影到当前页面。
  const hasRequestIntent = options.hasRequestIntent !== false;
  // 类型: Array<object>；作用: 过滤异常条目，后续状态统计只处理正式事务对象。
  const requestEntries = normalizeRequestEntries(options.requestEntries);
  // 类型: number；作用: 把异常数量收敛为零，只允许非负有限整数参与 ready/empty 判断。
  const visibleItemCount = Number.isFinite(Number(options.visibleItemCount))
    ? Math.max(0, Math.floor(Number(options.visibleItemCount)))
    : 0;
  // 类型: boolean；作用: 标记 selector 当前是否仍有可展示内容，和 Store stale 规则保持一致。
  const hasVisibleContent = visibleItemCount > 0;
  // 类型: string；作用: 为缺少稳定 message 的通用运行失败提供用户说明，不包含站点业务。
  const fallbackErrorMessage = typeof options.fallbackErrorMessage === 'string'
    && options.fallbackErrorMessage.trim()
    ? options.fallbackErrorMessage.trim()
    : '内容请求失败，请稍后重试。';

  // 条件分支: 当前 URL 没有请求意图或没有可读事务时进入。
  // 执行内容: 返回冻结 idle 投影，旧搜索桶或异常页面状态不会泄漏到当前页面。
  if (!hasRequestIntent || requestEntries.length === 0) {
    return Object.freeze({
      status: PAGE_REQUEST_VIEW_STATUS.idle,
      loading: false,
      hasError: false,
      hasVisibleContent: false,
      isBlockingLoading: false,
      canRetry: false,
      errorMessage: '',
      sourceId: '',
      failedKeys: Object.freeze([])
    });
  }

  // 类型: Array<object>；作用: 保存仍在等待结果的事务条目，决定页面加载和重复操作门禁。
  const loadingEntries = requestEntries.filter(({ transaction }) => {
    return transaction.status === SITE_CONTENT_REQUEST_STATUS.loading;
  });
  // 类型: Array<object>；作用: 保存已经失败的事务条目，驱动错误反馈和原位重试入口。
  const errorEntries = requestEntries.filter(({ transaction }) => {
    return transaction.status === SITE_CONTENT_REQUEST_STATUS.error;
  });
  // 类型: Array<object>；作用: 保存成功事务条目，全部无内容时才能解释为业务空结果。
  const successEntries = requestEntries.filter(({ transaction }) => {
    return transaction.status === SITE_CONTENT_REQUEST_STATUS.success;
  });
  // 类型: boolean；作用: 任一当前页面事务在途时保持加载反馈。
  const loading = loadingEntries.length > 0;
  // 类型: boolean；作用: 任一当前页面事务失败时展示错误说明，即使首页其他模块已成功。
  const hasError = errorEntries.length > 0;

  // 类型: string；作用: 按 loading、error、success、idle 顺序确定页面主状态，避免并发首页过早显示完成。
  let status = PAGE_REQUEST_VIEW_STATUS.idle;
  // 条件分支: 至少一个页面事务仍在执行时进入；执行内容: 保持 loading，避免并发首页过早显示完成或错误终态。
  if (loading) {
    status = PAGE_REQUEST_VIEW_STATUS.loading;
  }
  // 条件分支: 所有请求都已收敛且至少一个事务失败时进入；执行内容: 使用 error 区分失败与业务空结果。
  if (!loading && hasError) {
    status = PAGE_REQUEST_VIEW_STATUS.error;
  }
  // 条件分支: 没有加载和失败且至少一个事务成功时进入；执行内容: 按实际可见内容区分 ready 与 empty。
  if (!loading && !hasError && successEntries.length > 0) {
    status = hasVisibleContent
      ? PAGE_REQUEST_VIEW_STATUS.ready
      : PAGE_REQUEST_VIEW_STATUS.empty;
  }

  // 类型: object|null；作用: 优先使用当前失败事务说明错误源，其次使用在途或成功事务说明当前页面源。
  const primaryEntry = errorEntries[0]
    || loadingEntries[0]
    || successEntries[0]
    || requestEntries[0]
    || null;
  // 类型: string；作用: 只从当前事务读取请求源，禁止错误状态回退最后成功桶来源。
  const sourceId = primaryEntry ? readTransactionSourceId(primaryEntry.transaction) : '';
  // 类型: string；作用: 使用第一条安全错误说明，首页其他失败区域通过 failedKeys 保留诊断范围。
  const errorMessage = hasError
    ? readTransactionErrorMessage(errorEntries[0].transaction) || fallbackErrorMessage
    : '';
  // 类型: Array<string>；作用: 保留失败区域身份，页面可以说明首页部分模块失败而不解释站点业务。
  const failedKeys = errorEntries.map(({ key }) => key);

  return Object.freeze({
    status,
    loading,
    hasError,
    hasVisibleContent,
    isBlockingLoading: loading && !hasVisibleContent,
    canRetry: hasError && !loading,
    errorMessage,
    sourceId,
    failedKeys: Object.freeze(failedKeys)
  });
}
