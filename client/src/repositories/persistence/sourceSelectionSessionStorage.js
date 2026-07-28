/*
  sourceSelectionSessionStorage.js 模块说明

  - 文件职责:
      提供当前浏览器标签页内活动数据源身份的最小 Storage-like 适配器。
      由 sourceRuntimeInstance.js 在组合根注入 window.sessionStorage；本模块不读取浏览器全局对象，
      不访问 SourceManager、Store、Provider、Repository 保存图或 IndexedDB。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_SELECTION_SESSION_KEY: string，活动数据源身份在当前标签页会话中的唯一键。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertStorageLike(storage): 校验调用方提供的窄存储依赖。

  - 模块级类:
      无

  - 对外导出:
      SOURCE_SELECTION_SESSION_KEY: 会话键名，供测试和组合根复用同一事实。
      createSourceSelectionSessionStorage: 创建注入式会话适配器，提供读取、保存和清理三个动作。
*/

// 类型: string。
// 作用: 固定当前标签页活动源的唯一保存键，避免与用户长期设置或数据源私有空间混用。
export const SOURCE_SELECTION_SESSION_KEY = 'wvp.active-source-id';

/**
 * 校验会话存储依赖是否提供当前适配器所需的窄接口。
 * 纯函数: 只读取方法类型，不调用存储、不修改输入对象。
 * 成功路径: 返回原始 Storage-like 对象，供工厂建立闭包。
 * 失败路径: 缺少任一方法时抛出 TypeError，禁止创建半可用适配器。
 *
 * @param {*} storage 由组合根或测试注入的 Storage-like 对象。
 * @returns {object} 通过接口校验的存储对象。
 * @throws {TypeError} storage 不是对象或缺少 getItem/setItem/removeItem 时抛出。
 */
function assertStorageLike(storage) {
  // 条件分支: 输入不是对象、函数或 null 时进入。
  // 执行内容: 阻止后续方法读取触发隐式异常。
  if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) {
    throw new TypeError('source selection session storage 必须是对象');
  }

  // 条件分支: 任何存储方法缺失或类型不正确时进入。
  // 执行内容: 保持读写和清理能力成套存在。
  if (typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function'
    || typeof storage.removeItem !== 'function') {
    throw new TypeError('source selection session storage 接口不完整');
  }

  return storage;
}

/**
 * 创建活动数据源的标签页会话存储适配器。
 * 调用方: sourceRuntimeInstance.js 组合根和不依赖浏览器的单元测试。
 * 副作用: 返回的方法会调用注入存储的读写接口；本工厂创建时不访问存储。
 * 成功路径: 读取返回字符串或空字符串，保存写入非空身份，空身份执行清理。
 * 失败路径: 注入接口不完整时同步抛出；底层 Storage 异常原样传播给组合根决定是否失败关闭。
 * 生命周期: 会话键只存在当前浏览器标签页，标签页结束后由浏览器清理，不进入长期数据库。
 *
 * @param {object} options 工厂选项。
 * @param {object} options.storage Storage-like 依赖，必须提供 getItem/setItem/removeItem。
 * @returns {Readonly<object>} 活动源会话适配器。
 * @returns {Function} return.loadActiveSourceId 读取当前标签页保存的活动源身份。
 * @returns {Function} return.saveActiveSourceId 保存或清理当前标签页活动源身份。
 * @returns {Function} return.clearActiveSourceId 移除当前标签页活动源身份。
 */
export function createSourceSelectionSessionStorage(options = {}) {
  // 类型: object；作用: 保存通过窄接口校验的存储依赖，不创建内存、localStorage 或 IndexedDB 回退。
  const storage = assertStorageLike(options.storage);

  return Object.freeze({
    /**
     * 读取当前标签页保存的活动数据源身份。
     * 副作用: 只读取注入存储，不验证数据源是否存在或可执行；有效性由 SourceManager 投影裁决。
     * 成功路径: 存在键时返回 Storage API 的字符串值，否则返回空字符串。
     * 失败路径: 底层存储异常原样抛出，调用方不得改用其他存储实现。
     *
     * @returns {string} 当前标签页的活动源身份，缺失时为空字符串。
     */
    loadActiveSourceId() {
      // 类型: string|null；作用: 读取唯一会话键，null 表示标签页尚未选择过活动源。
      const storedSourceId = storage.getItem(SOURCE_SELECTION_SESSION_KEY);
      return typeof storedSourceId === 'string' ? storedSourceId : '';
    },

    /**
     * 保存当前标签页的活动数据源身份。
     * 副作用: 写入当前标签页 sessionStorage；不会写 IndexedDB、Provider 私有空间或页面 store。
     * 成功路径: 非空字符串写入唯一键，空字符串委托清理方法，避免保存空身份。
     * 失败路径: Storage API 拒绝时原样抛出，调用方保持 Runtime 领域状态并记录基础设施问题。
     *
     * @param {string} sourceId SourceManager 投影已经确认的活动源身份；空字符串表示清除。
     * @returns {void} 写入或清理完成后结束。
     * @throws {TypeError} sourceId 不是字符串时抛出。
     */
    saveActiveSourceId(sourceId) {
      // 条件分支: 非字符串值进入时失败关闭。
      // 执行内容: 避免把对象强制转换为不可追踪的会话身份。
      if (typeof sourceId !== 'string') {
        throw new TypeError('active source id 必须是字符串');
      }

      // 条件分支: 空身份表示 Manager 没有有效活动源时进入。
      // 执行内容: 执行同一键的清理而不是写空值。
      if (sourceId === '') {
        this.clearActiveSourceId();
        return;
      }

      // 副作用: 只写当前标签页会话键；真实可选性和授权仍由 Runtime 完整投影负责。
      storage.setItem(SOURCE_SELECTION_SESSION_KEY, sourceId);
    },

    /**
     * 清理当前标签页的活动数据源身份。
     * 副作用: 移除唯一 sessionStorage 键；不触碰任何长期保存数据和 Provider 私有空间。
     * 成功路径: 键不存在时 Storage API 仍按幂等清理完成。
     * 失败路径: Storage API 拒绝时原样抛出。
     *
     * @returns {void} 清理完成后结束。
     */
    clearActiveSourceId() {
      // 副作用: 清理当前会话值，使下一次 Manager 初始化回到 defaultSourceId 解析路径。
      storage.removeItem(SOURCE_SELECTION_SESSION_KEY);
    }
  });
}
