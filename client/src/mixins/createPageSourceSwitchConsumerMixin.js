/*
  createPageSourceSwitchConsumerMixin.js 模块说明

  - 文件职责:
      为首页、电影、电视剧和搜索页提供统一的 SourceManager 活动源变更消费生命周期。
      KeepAlive 页面可见时调用页面既有 handleSourceSwitched，隐藏时不后台请求，重新激活后补处理最新活动源。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      getActivePageSourceId: 自定义页面源服务函数，读取 Manager 当前 activeSourceId 或尚未建立时的 defaultSourceId。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      createPageSourceSwitchConsumerMixin: Function，按一级页面路由名创建 Vue KeepAlive 切源响应 mixin。
*/

// 导入来源: ../services/sourcePageService.js。
// 导入内容: getActivePageSourceId 当前有效活动源读取函数。
// 文件作用: 只消费 settingsStore 中 Manager 已提交身份，不订阅第二事件源或内容 store。
import { getActivePageSourceId } from '../services/sourcePageService.js';

/**
 * 创建单个内容页使用的活动源切换响应 mixin。
 * 纯函数: 只规范化固定一级路由名称并返回 Vue 选项对象，不读取 Router、Manager 或页面实例。
 * 成功路径: 活动页面在 Manager 身份变化后调用自身 handleSourceSwitched；隐藏页面在下次 activated 补调用。
 * 失败路径: 路由名为空时立即抛 TypeError；页面刷新拒绝且没有更新身份被消费时恢复上一次身份，允许后续激活重试。
 *
 * @param {string} pageRouteName 当前内容页的一级命名路由，例如 home、movie、tv 或 search。
 * @returns {object} 可放入 Vue 组件 mixins 数组的活动源响应选项。
 * @throws {TypeError} pageRouteName 不是非空字符串时抛出。
 */
export function createPageSourceSwitchConsumerMixin(pageRouteName) {
  // 类型: string。
  // 作用: 固定当前 mixin 只为哪一个一级路由消费活动源变化，避免隐藏 KeepAlive 页面后台刷新。
  const normalizedPageRouteName = typeof pageRouteName === 'string'
    ? pageRouteName.trim()
    : '';

  // 条件分支: 调用方没有提供真实一级路由名时进入。
  // 执行内容: 在模块组合阶段失败关闭，避免运行时把任意路由误判为活动页面。
  if (!normalizedPageRouteName) {
    throw new TypeError('页面切源响应器必须提供非空一级路由名');
  }

  return {
    /**
     * 创建当前页面独立的切源消费游标。
     * 副作用: 初始身份同步读取 Manager 当前投影；不写 Manager、内容 store 或 Router。
     *
     * @returns {object} 当前 KeepAlive 页面局部消费状态。
     */
    data() {
      return {
        // 类型: string；来源: Manager 当前活动源；作用: 记录本页面最后已消费身份，不作为全局当前源权威。
        sourceSwitchConsumedSourceId: getActivePageSourceId(),
        // 类型: boolean；true 表示当前 KeepAlive 页面正在展示，false 表示隐藏且不能后台请求。
        sourceSwitchConsumerActive: false
      };
    },

    computed: {
      /**
       * 读取 SourceManager 当前已提交活动源。
       * 纯函数: 委托页面源服务读取响应式 settingsStore，不访问内容桶或组件局部候选。
       *
       * @returns {string} 当前 activeSourceId，尚未建立时为 defaultSourceId，再缺失时为空字符串。
       */
      sourceSwitchActiveSourceId() {
        return getActivePageSourceId();
      },

      /**
       * 判断当前全局路由是否仍归属本 mixin 对应页面。
       * 纯函数: 只比较 Vue Router 当前命名路由和工厂冻结的一级路由名。
       *
       * @returns {boolean} true 表示当前页面可消费刷新，false 表示缓存页面处于后台。
       */
      sourceSwitchConsumerRouteActive() {
        return this.$route.name === normalizedPageRouteName;
      }
    },

    watch: {
      /**
       * 观察 Manager 已提交活动源变化。
       * 来源: settingsStore.sourceManager.activeSourceId/defaultSourceId 响应式投影。
       * 副作用: 仅当前 KeepAlive 页面可见且路由匹配时调用统一消费方法。
       * 成功路径: 活动页面完成本轮刷新，隐藏页面保持消费游标等待 activated。
       * 失败路径: 页面刷新拒绝时由 consumePageSourceSwitch 恢复旧游标，不回滚 Manager。
       *
       * @param {string} nextSourceId 最新活动源身份。
       * @returns {Promise<void>} 本轮页面刷新消费收敛后完成。
       */
      async sourceSwitchActiveSourceId(nextSourceId) {
        // 条件分支: 页面已隐藏或 Router 已切到其他一级页面时进入。
        // 执行内容: 不更新消费游标，让下次 activated 发现差异后补刷新。
        if (!this.sourceSwitchConsumerActive || !this.sourceSwitchConsumerRouteActive) {
          return;
        }

        await this.consumePageSourceSwitch(nextSourceId);
      }
    },

    /**
     * Vue activated 生命周期。
     * 执行时机: KeepAlive 页面首次显示或从其他路由返回。
     * 副作用: 标记页面可消费，并在活动源已变化时调用页面既有刷新入口。
     * 成功路径: 身份相同立即结束，身份变化时完成页面补刷新。
       * 失败路径: 页面刷新拒绝时消费方法只在本轮仍为最新身份时恢复旧游标，当前页面保持既有错误投影。
     *
     * @returns {Promise<void>} 需要补刷新时等待页面处理完成，否则立即结束。
     */
    async activated() {
      // 副作用: 当前页面进入前台后允许响应 Manager 身份变化。
      this.sourceSwitchConsumerActive = true;
      // 异步边界: 初次身份一致时方法立即结束；后台切源后返回时补处理最新身份。
      await this.consumePageSourceSwitch(this.sourceSwitchActiveSourceId);
    },

    /**
     * Vue deactivated 生命周期。
     * 执行时机: 当前 KeepAlive 页面被其他普通路由替换但实例继续缓存。
     * 副作用: 关闭后台刷新资格，不清空内容、筛选或最后消费身份。
     *
     * @returns {void} 局部可见性更新后结束。
     */
    deactivated() {
      // 副作用: 隐藏页面继续保留 UI 历史，但后续活动源变化只留待重新激活处理。
      this.sourceSwitchConsumerActive = false;
    },

    methods: {
      /**
       * 消费一份 Manager 已提交活动源并调用页面既有刷新方法。
       * 副作用: 先推进本页面消费游标，再调用 handleSourceSwitched；最新刷新失败时恢复旧游标供后续激活重试。
       * 成功路径: 首页、目录或搜索页按自身方法完成新源请求。
       * 失败路径: 页面缺少处理方法时恢复旧游标并安全结束；处理方法拒绝时仅在游标仍属于本轮时恢复，避免旧失败覆盖更新切源。
       *
       * @param {string} nextSourceId 待消费的 Manager 当前活动源身份。
       * @returns {Promise<void>} 页面刷新成功、无需处理或失败恢复后完成。
       */
      async consumePageSourceSwitch(nextSourceId) {
        // 条件分支: 身份为空或已被当前页面消费时进入。
        // 执行内容: 不重复调用页面刷新，初次 activated 不制造第二次首屏请求。
        if (!nextSourceId || nextSourceId === this.sourceSwitchConsumedSourceId) {
          return;
        }

        // 类型: string。
        // 作用: 保存本轮开始前消费游标，刷新失败时恢复以允许后续激活重试。
        const previousConsumedSourceId = this.sourceSwitchConsumedSourceId;
        // 副作用: 在调用页面方法前采用本轮身份，快速连续切源不会重复消费同一个 Manager 值。
        this.sourceSwitchConsumedSourceId = nextSourceId;

        // 条件分支: 页面没有实现正式 handleSourceSwitched 接口时进入。
        // 执行内容: 恢复旧游标并结束，不猜测首页、目录或搜索刷新语义。
        if (typeof this.handleSourceSwitched !== 'function') {
          this.sourceSwitchConsumedSourceId = previousConsumedSourceId;
          return;
        }

        try {
          // 异步调用: 由具体页面保留首页五桶、目录筛选或搜索 URL 的原有刷新语义。
          await this.handleSourceSwitched();
        } catch (error) {
          // 条件分支: 失败收敛时消费游标仍指向本轮身份，期间没有更新活动源被消费时进入。
          // 执行内容: 只恢复页面局部旧游标供后续激活重试，不回滚 Manager 或覆盖更新切源游标。
          if (this.sourceSwitchConsumedSourceId === nextSourceId) {
            this.sourceSwitchConsumedSourceId = previousConsumedSourceId;
          }
        }
      }
    }
  };
}
