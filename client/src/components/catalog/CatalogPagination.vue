<template>
  <!--
    CatalogPagination 组件渲染树

    [DEFAULT] ele(nav.catalog-pagination)
    │  - condition:
    │      默认渲染。
    │      父页面在需要分页时才挂载本组件。
    │  - type:
    │      原生标签
    │      标签名称: nav
    │  - description:
    │      目录分页栏。
    │      统一承载目录页、搜索页和个人中心列表的分页切换。
    │  - params:
    │      -- pagination：标准分页对象，提供当前页、总页数和下一页状态。
    │  - events:
    │      @change-page
    │          - description:
    │              当用户点击上一页、下一页或输入跳转页码时触发。
    │              父页面收到目标页码后刷新远程数据或切换本地分页。
    │          - methods:
    │              handleChangePage(targetPage)
    │                  -- targetPage：用户希望切换到的目标页码。
    │
    ├─ [DEFAULT] ele(el-button.pagination-btn.kind-prev)
    │  - condition:
    │      默认渲染。
    │      没有上一页时通过 disabled 禁用。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-button
    │  - description:
    │      上一页按钮。
    │      点击后请求当前页的前一页。
    │  - params:
    │      -- canGoPrevPage：是否允许向前翻页。
    │  - events:
    │      @click
    │          - description:
    │              用户点击上一页按钮时触发。
    │              disabled 为 true 时 Element UI 会阻止点击。
    │          - methods:
    │              handleChangePage(displayPage - 1)
    │                  -- displayPage - 1：上一页目标页码。
    │
    ├─ [DEFAULT] ele(span.pagination-current)
    │  - condition:
    │      默认渲染。
    │      总页数存在时显示 当前页/总页数；总页数不存在时只显示当前页。
    │  - type:
    │      原生标签
    │      标签名称: span
    │  - description:
    │      当前页状态框。
    │      只展示页码，不允许聚焦输入，也不显示文本输入光标。
    │  - params:
    │      -- currentPageText：当前页状态展示文案。
    │  - events: 无
    │
    ├─ [DEFAULT] ele(el-button.pagination-btn.kind-next)
    │  - condition:
    │      默认渲染。
    │      没有下一页时通过 disabled 禁用。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-button
    │  - description:
    │      下一页按钮。
    │      点击后请求当前页的后一页。
    │  - params:
    │      -- canGoNextPage：是否允许向后翻页。
    │  - events:
    │      @click
    │          - description:
    │              用户点击下一页按钮时触发。
    │              disabled 为 true 时 Element UI 会阻止点击。
    │          - methods:
    │              handleChangePage(displayPage + 1)
    │                  -- displayPage + 1：下一页目标页码。
    │
    └─ [DEFAULT] ele(label.pagination-jump)
       - condition:
           默认渲染。
           始终提供页码直达入口。
       - type:
           原生标签
           标签名称: label
       - description:
           跳页输入区。
           用户输入页码后按回车或让输入框失焦，即可派发 change-page。
           输入框右侧展示“页”字，明确输入内容的单位。
       - params:
           -- jumpPageInput：用户输入的目标页码文本。
       - events:
           @keyup.enter
               - description:
                   用户在跳页输入框按下回车时触发。
                   用于立即跳转到输入页码。
               - methods:
                   handleJumpPage()
                       -- 无参数：方法内部读取 jumpPageInput。
           @blur
               - description:
                   用户输入页码后离开输入框时触发。
                   用于让鼠标点击页面其他位置时也能完成跳页。
               - methods:
                   handleJumpPage()
                       -- 无参数：方法内部读取 jumpPageInput。
  -->
  <!--
    目录分页栏。
    作用：展示目录页或搜索页底部分页状态，视觉上采用紧凑的分页按钮结构。
  -->
  <nav class="catalog-pagination" aria-label="内容分页">
    <!--
      [DEFAULT] ele(el-button.pagination-btn.kind-prev)
      - condition:
          默认渲染。
          没有上一页时通过 disabled 禁用。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-button
      - description:
          上一页按钮。
          用户点击后把目标页码派发给父页面，由父页面请求或截取上一页数据。
      - params:
          -- canGoPrevPage：是否允许向前翻页。
          -- displayPage：当前页码，用于计算目标页码。
      - events:
          @click
              - description:
                  用户点击上一页按钮时触发。
                  disabled 为 true 时 Element UI 会阻止点击。
              - methods:
                  handleChangePage(displayPage - 1)
                      -- displayPage - 1：上一页目标页码。
    -->
    <el-button
      class="pagination-btn kind-prev"
      native-type="button"
      :disabled="!canGoPrevPage"
      @click="handleChangePage(displayPage - 1)">
      上一页
    </el-button>

    <!--
      [DEFAULT] ele(span.pagination-current)
      - condition:
          默认渲染。
          当前页状态始终显示，总页数没有有效值时不展示总页数。
      - type:
          原生标签
          标签名称: span
      - description:
          当前页状态框。
          只展示页码，不作为输入控件，也不允许出现输入光标。
      - params:
          -- currentPageText：由 displayPage 和 totalPages 派生的展示文案。
      - events: 无
    -->
    <span class="pagination-current" aria-live="polite">
      {{ currentPageText }}
    </span>

    <!--
      [DEFAULT] ele(el-button.pagination-btn.kind-next)
      - condition:
          默认渲染。
          没有下一页时通过 disabled 禁用。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-button
      - description:
          下一页按钮。
          用户点击后把目标页码派发给父页面，由父页面请求或截取下一页数据。
      - params:
          -- canGoNextPage：是否允许向后翻页。
          -- displayPage：当前页码，用于计算目标页码。
      - events:
          @click
              - description:
                  用户点击下一页按钮时触发。
                  disabled 为 true 时 Element UI 会阻止点击。
              - methods:
                  handleChangePage(displayPage + 1)
                      -- displayPage + 1：下一页目标页码。
    -->
    <el-button
      class="pagination-btn kind-next"
      native-type="button"
      :disabled="!canGoNextPage"
      @click="handleChangePage(displayPage + 1)">
      下一页
    </el-button>

    <!--
      [DEFAULT] ele(label.pagination-jump)
      - condition:
          默认渲染。
          所有分页场景统一展示跳页入口。
      - type:
          原生标签
          标签名称: label
      - description:
          跳页输入区。
          用户可以输入目标页码，通过回车或失焦触发分页跳转。
          输入框右侧固定展示“页”字，减少用户理解成本。
      - params:
          -- jumpPageInput：输入框当前文本值。
          -- jumpInputPlaceholder：输入框占位文案。
      - events:
          @keyup.enter
              - description:
                  用户在页码输入框内按下回车时触发。
                  用于立即执行页码跳转。
              - methods:
                  handleJumpPage()
                      -- 无参数：方法内部读取 jumpPageInput。
          @blur
              - description:
                  用户输入页码后离开输入框时触发。
                  用于提交输入框内的目标页码。
              - methods:
                  handleJumpPage()
                      -- 无参数：方法内部读取 jumpPageInput。
    -->
    <label class="pagination-jump">
      <span class="pagination-jump-label">跳转到</span>
      <input
        v-model.trim="jumpPageInput"
        class="pagination-jump-input"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        :placeholder="jumpInputPlaceholder"
        aria-label="跳转到指定页码"
        @mousedown.prevent="handleJumpInputPointerDown"
        @focus="handleJumpInputFocus"
        @click="handleJumpInputFocus"
        @keyup.enter="handleJumpPage"
        @blur="handleJumpPage"
      />
      <span class="pagination-jump-unit">页</span>
    </label>
  </nav>
</template>

<script>
/*
  CatalogPagination.vue 模块说明

  - 文件职责:
      渲染上一页、下一页、页码窗口和指定页跳转入口。
      只根据标准 pagination 属性派生显示状态并发布页码事件，不发起数据请求。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      CatalogPagination: Vue 通用组件，供目录、搜索和个人中心列表共享分页交互。
*/

export default {
  // 组件名称用于在调试工具和报错信息中识别目录分页组件。
  name: 'CatalogPagination',

  props: {
    // 类型: object。
    // 来源: 父页面传入的标准 pagination prop；目录页和搜索页通常由 getPagePagination(pageKey) selector 获取，个人中心由页面本地分页状态生成。
    // 作用: 保存标准分页信息，驱动当前页、总页数和下一页禁用态。
    // 字段: page，number，当前页码。
    // 字段: pageSize，number，每页数量。
    // 字段: total，number，当前查询总条数。
    // 字段: totalPages，number，当前查询总页数。
    // 字段: hasMore，boolean，是否还有下一页。
    // true: 下一页按钮可用。
    // false: 下一页按钮禁用。
    pagination: {
      type: Object,
      required: true
    }
  },

  /**
   * 创建分页组件的本地输入状态。
   * 纯函数: 每个组件实例都返回新对象，不修改父级 pagination 属性。
   *
   * @returns {object} 分页组件本地状态。
   * @returns {string} return.jumpPageInput 用户在跳页输入框中编辑的文本。
   */
  data() {
    return {
      // 类型: string。
      // 初始值: 空字符串，表示用户尚未输入跳转页码。
      // 作用: 保存跳页输入框的临时文本；该字段只属于分页组件内部 UI 状态，不写入全站数据对象。
      jumpPageInput: ''
    };
  },

  computed: {
    /**
     * 当前页码。
     * 来源: 标准 pagination.page。
     * 兜底策略: page 缺失或非法时显示第 1 页。
     *
     * @returns {number} 当前页码。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    displayPage() {
      // 类型: number。
      // 作用: 把标准 pagination.page 转成数字，避免字符串页码影响比较逻辑。
      const page = Number(this.pagination.page || 1);

      // 返回值类型: number。
      // 作用: page 是有效正数时返回 page，否则回到第一页。
      return Number.isFinite(page) && page > 0 ? page : 1;
    },

    /**
     * 总页数。
     * 来源: 标准 pagination.totalPages。
     * 兜底策略: totalPages 缺失或非法时显示 0。
     *
     * @returns {number} 总页数。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    totalPages() {
      // 类型: number。
      // 作用: 把标准 pagination.totalPages 转成数字，方便模板稳定展示。
      const totalPages = Number(this.pagination.totalPages || 0);

      // 返回值类型: number。
      // 作用: totalPages 是有效非负数时返回 totalPages，否则返回 0。
      return Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 0;
    },

    /**
     * 是否存在有效总页数。
     * 来源: 标准 pagination.totalPages。
     * 用途: 控制当前页状态是否展示 `/总页数`，以及跳页输入是否需要限制最大页码。
     *
     * @returns {boolean} 总页数大于 0 时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasKnownTotalPages() {
      // 返回值类型: boolean。
      // 作用: totalPages 大于 0 说明数据源提供了可展示、可校验的总页数。
      return this.totalPages > 0;
    },

    /**
     * 当前页状态展示文案。
     * 来源: displayPage 和 totalPages。
     * 规则: 有总页数时显示 当前页/总页数；没有总页数时只显示当前页。
     *
     * @returns {string} 当前页状态文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    currentPageText() {
      // 条件分支: 已知总页数时进入。
      // 执行内容: 展示当前页和总页数，形成紧凑的分页状态。
      if (this.hasKnownTotalPages) {
        return `${this.displayPage}/${this.totalPages}`;
      }

      // 返回值类型: string。
      // 作用: 总页数未知时只展示当前页，避免出现 1/0 这种误导文案。
      return `${this.displayPage}`;
    },

    /**
     * 跳页输入框占位文案。
     * 来源: displayPage。
     * 用途: 让用户知道当前可输入页码。
     *
     * @returns {string} 跳页输入框占位文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    jumpInputPlaceholder() {
      // 返回值类型: string。
      // 作用: 使用当前页码作为占位，避免输入框空白时显得没有语义。
      return `${this.displayPage}`;
    },

    /**
     * 是否存在上一页。
     * 来源: 标准 pagination.page。
     *
     * @returns {boolean} 当前页大于 1 时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    canGoPrevPage() {
      // 返回值类型: boolean。
      // 作用: 当前页大于第一页时允许上一页按钮处于可用状态。
      return this.displayPage > 1;
    },

    /**
     * 是否存在下一页。
     * 来源: 标准 pagination.hasMore。
     *
     * @returns {boolean} 还有下一页时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    canGoNextPage() {
      // 返回值类型: boolean。
      // 作用: hasMore 为 true 时允许下一页按钮处于可用状态。
      return Boolean(this.pagination.hasMore);
    }
  },

  methods: {
    /**
     * 规范化目标页码。
     * 调用位置: 上一页、下一页和跳页输入。
     * 执行内容: 把任意输入转换成有效正整数；已知总页数时把页码限制在最后一页以内。
     * 无效输入: 返回 null，让调用方阻止分页事件。
     *
     * @param {*} value 用户输入或按钮计算出的目标页码。
     * @returns {number|null} 可用于派发 change-page 的目标页码；输入无效时返回 null。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    normalizeTargetPage(value) {
      // 类型: number。
      // 作用: 将输入值转换为数字，统一处理字符串页码和按钮计算页码。
      const rawPage = Number(value);

      // 条件分支: 输入值不是有效数字或小于第一页时进入。
      // 执行内容: 返回 null，避免父页面收到非法页码或意外跳回第一页。
      if (!Number.isFinite(rawPage) || rawPage < 1) {
        return null;
      }

      // 类型: number。
      // 作用: 页码只接受整数，小数输入向下取整。
      const integerPage = Math.floor(rawPage);

      // 条件分支: 数据源提供了有效总页数时进入。
      // 执行内容: 限制目标页码不能超过最后一页。
      if (this.hasKnownTotalPages) {
        return Math.min(integerPage, this.totalPages);
      }

      // 返回值类型: number。
      // 作用: 总页数未知时只保证页码为正整数，不额外限制上限。
      return integerPage;
    },

    /**
     * 派发分页切换事件。
     * 触发来源: 上一页和下一页按钮的 click 事件。
     * 执行内容: 根据目标页码和当前分页边界判断是否允许切换，允许时向父组件派发 change-page。
     *
     * @param {number} targetPage 用户希望切换到的目标页码。
     * @returns {void} 该方法只派发组件事件，不直接修改分页数据。
     * 副作用: 发布 change-page 事件，把规范化目标页码交给父页面重新请求列表。
     */
    handleChangePage(targetPage) {
      // 类型: number|null。
      // 作用: 把按钮或输入框传入的页码统一转换成可请求的目标页码；无效输入返回 null。
      const nextPage = this.normalizeTargetPage(targetPage);

      // 条件分支: 目标页码不是有效正数时进入。
      // 执行内容: 直接退出，避免向父组件派发无效页码。
      if (!Number.isFinite(nextPage) || nextPage < 1) {
        return;
      }

      // 条件分支: 目标页码等于当前页时进入。
      // 执行内容: 直接退出，避免重复请求当前页。
      if (nextPage === this.displayPage) {
        return;
      }

      // 条件分支: 目标页码小于当前页但没有上一页时进入。
      // 执行内容: 阻止越界向前翻页。
      if (nextPage < this.displayPage && !this.canGoPrevPage) {
        return;
      }

      // 条件分支: 目标页码大于当前页但没有下一页时进入。
      // 执行内容: 阻止越界向后翻页。
      if (nextPage > this.displayPage && !this.canGoNextPage) {
        return;
      }

      // 事件: change-page。
      // 参数: object，包含 page 目标页码，父页面据此刷新当前列表或切换本地分页。
      this.$emit('change-page', {
        page: nextPage
      });
    },

    /**
     * 处理跳页输入。
     * 触发来源: 跳页输入框的 keyup.enter 和 blur 事件。
     * 执行内容: 根据输入文本派发 change-page，成功处理后清空输入框。
     *
     * @returns {void} 该方法只触发分页切换，不返回业务数据。
     * 副作用: 校验跳页输入、发布 change-page 事件并清空 jumpPageInput。
     */
    handleJumpPage() {
      // 条件分支: 用户没有输入内容时进入。
      // 执行内容: 不触发分页事件，避免失焦时重复刷新当前页。
      if (!this.jumpPageInput) {
        return;
      }

      // 类型: number|null。
      // 作用: 把输入框文本整理成目标页码，已知总页数时会自动限制到最后一页。
      const targetPage = this.normalizeTargetPage(this.jumpPageInput);

      // 类型: string。
      // 作用: 提交后清空输入框，让下一次跳页输入有明确的空状态。
      this.jumpPageInput = '';

      // 条件分支: 输入内容不是有效页码时进入。
      // 执行内容: 不派发分页事件，避免用户输错时误跳页面。
      if (!Number.isFinite(targetPage)) {
        return;
      }

      // 执行内容: 复用统一分页派发方法，保持跳页和上一页/下一页使用同一事件链路。
      this.handleChangePage(targetPage);
    },

    /**
     * 处理跳页输入框聚焦。
     * 触发来源: 跳页输入框的 focus 和 click 事件。
     * 执行内容: 输入框为空时先写入当前页码，再将输入光标移动到数字末尾。
     * 放置原因: placeholder 不是真实文本，空输入框聚焦时光标会压在居中的 placeholder 上。
     *
     * @param {FocusEvent|MouseEvent} event 输入框聚焦或点击事件。
     * @returns {void} 该方法只调整输入框光标位置，不修改分页数据。
     * 副作用: 调用输入元素 select()，让键盘用户聚焦后可直接替换页码。
     */
    handleJumpInputFocus(event) {
      // 类型: HTMLInputElement|null。
      // 作用: 从事件中读取当前输入框元素，用于设置文本光标位置。
      const inputElement = event && event.target ? event.target : null;

      // 条件分支: 当前事件来源不是有效输入框时进入。
      // 执行内容: 直接退出，避免调用不存在的 selection API。
      if (!inputElement || typeof inputElement.setSelectionRange !== 'function') {
        return;
      }

      // 条件分支: 输入框当前没有真实输入值时进入。
      // 执行内容: 写入当前页码，让用户看到的数字成为真实文本，光标才能放到数字后面。
      if (!this.jumpPageInput) {
        this.jumpPageInput = `${this.displayPage}`;
      }

      // 异步队列: 等浏览器完成本次点击默认光标定位后，再把光标统一移动到文本末尾。
      this.$nextTick(() => {
        // 类型: number。
        // 作用: 当前输入框文本长度，用于把输入光标放到最后一个字符后面。
        const valueLength = inputElement.value.length;

        // 执行内容: 将光标开始和结束位置都设置到文本末尾，避免数字和输入光标重叠。
        inputElement.setSelectionRange(valueLength, valueLength);
      });
    },

    /**
     * 处理跳页输入框鼠标按下。
     * 触发来源: 跳页输入框的 mousedown 事件。
     * 执行内容: 阻止浏览器把光标放到输入框点击位置，并统一交给 handleJumpInputFocus 放到数字末尾。
     *
     * @param {MouseEvent} event 输入框鼠标按下事件。
     * @returns {void} 该方法只控制输入框聚焦和光标位置。
     * 副作用: 阻止指针按下的默认光标定位，并选择跳页输入框全部文本。
     */
    handleJumpInputPointerDown(event) {
      // 类型: HTMLInputElement|null。
      // 作用: 从鼠标事件中读取输入框元素，用于主动聚焦并设置光标。
      const inputElement = event && event.target ? event.target : null;

      // 条件分支: 当前事件来源不是有效输入框时进入。
      // 执行内容: 直接退出，避免调用不存在的 focus API。
      if (!inputElement || typeof inputElement.focus !== 'function') {
        return;
      }

      // 执行内容: 主动聚焦输入框，配合 mousedown.prevent 避免浏览器把光标压到居中文本位置。
      inputElement.focus();

      // 执行内容: 复用聚焦处理，把当前页码写入真实 value 并把光标放到数字末尾。
      this.handleJumpInputFocus(event);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 分页栏整体容器 `.catalog-pagination`。
  样式作用:
  统一电影页、电视剧页、搜索页和个人中心的分页布局。
  让上一页、当前页、下一页和跳页输入按水平顺序排列。
  在小宽度区域允许横向滚动，避免挤压分页控件文字。
*/
.catalog-pagination {
  /* 使用 flex 横向排列分页控件，保证视觉顺序和模板顺序一致。 */
  display: flex;

  /* 禁止分页控件自动换行，窄屏时交给横向滚动处理。 */
  flex-wrap: nowrap;

  /* 让分页控件默认居中显示，适配目录页和个人中心列表底部。 */
  justify-content: center;

  /* 让按钮、状态框和输入框在交叉轴上垂直居中。 */
  align-items: center;

  /* 设置分页控件之间的横向间距，避免按钮和输入框贴在一起。 */
  gap: 10px;

  /* 设置分页栏和上方列表之间的距离，同时保留下方轻量留白。 */
  margin: 32px 0 8px;

  /* 窄屏或父容器较窄时允许横向滚动，避免控件被压缩变形。 */
  overflow-x: auto;

  /* 禁止分页栏出现纵向滚动条。 */
  overflow-y: hidden;

  /* 给横向滚动条和控件底部留出距离，避免滚动条贴住按钮。 */
  padding-bottom: 4px;
}

/*
  作用容器: 通用分页按钮 `.pagination-btn`。
  样式作用:
  统一上一页和下一页按钮尺寸。
  让分页按钮在不同页面底部保持稳定点击区域。
*/
.pagination-btn {
  /* 设置按钮最小宽度，保证“上一页”和“下一页”不会过窄。 */
  min-width: 78px;

  /* 设置按钮高度，和当前页状态框、跳页输入框保持一致。 */
  height: 40px;

  /* 设置按钮左右内边距，让文字和按钮边缘保持舒适距离。 */
  padding: 0 16px;

  /* 设置按钮圆角，贴合当前项目卡片和筛选按钮的轻圆角风格。 */
  border-radius: 12px;

  /* 设置按钮字号，让分页操作比卡片正文略小但仍清晰可点。 */
  font-size: 14px;

  /* 设置按钮字重，让分页按钮在底部工具区保持可识别。 */
  font-weight: 500;

  /* 设置轻量阴影，让按钮在浅色页面底上有细微层级。 */
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.04);
}

/*
  作用容器: 当前页状态框 `.pagination-current`。
  样式作用:
  展示当前页和总页数。
  明确它是只读状态，不是可聚焦输入框。
*/
.pagination-current {
  /* 收紧状态框宽度，让页码状态不再过宽。 */
  width: 72px;

  /* 让 width 包含内边距和边框，保证状态框视觉宽度按设定值收窄。 */
  box-sizing: border-box;

  /* 设置状态框高度，与分页按钮和跳页输入框保持一致。 */
  height: 40px;

  /* 设置横向内边距，让页码文字不贴边。 */
  padding: 0 16px;

  /* 设置边框，让状态框和跳页输入框形成同一类信息控件。 */
  border: 1px solid var(--border-color);

  /* 设置圆角，让状态框视觉上和分页按钮保持统一。 */
  border-radius: 12px;

  /* 设置状态框背景，保证浅色页面中页码区域清晰可读。 */
  background: rgba(255, 255, 255, 0.94);

  /* 设置状态文字颜色，让页码信息低于主按钮但仍可读。 */
  color: var(--text-secondary);

  /* 设置状态文字字号，和分页按钮文字保持一致。 */
  font-size: 14px;

  /* 设置行高，让单行页码在固定高度状态框中垂直居中。 */
  line-height: 38px;

  /* 设置页码居中对齐，避免不同位数文本偏向一侧。 */
  text-align: center;

  /* 禁止用户选中页码文字，强化当前区域的只读状态。 */
  user-select: none;

  /* 使用普通鼠标指针，避免状态框看起来像输入控件。 */
  cursor: default;

  /* 设置轻量阴影，让状态框和按钮在同一视觉层级。 */
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.04);
}

/*
  作用容器: 跳页输入区 `.pagination-jump`。
  样式作用:
  把“跳转到”和页码输入框组成一个完整控件。
  保证跳页入口和前后翻页按钮在同一行。
  在输入框右侧展示页码单位，明确输入内容含义。
*/
.pagination-jump {
  /* 使用 flex 横向排列标签文字和输入框。 */
  display: flex;

  /* 让标签文字和输入框在高度方向上居中。 */
  align-items: center;

  /* 设置标签文字和输入框之间的距离。 */
  gap: 8px;

  /* 防止跳页控件被压缩换行，窄屏时由分页栏横向滚动承载。 */
  flex: 0 0 auto;
}

/*
  作用容器: 跳页文字标签 `.pagination-jump-label`。
  样式作用:
  标识右侧输入框的用途。
  保持辅助文字弱于按钮和页码状态。
*/
.pagination-jump-label {
  /* 设置跳页标签字号，和分页按钮文字保持一致。 */
  font-size: 14px;

  /* 设置跳页标签文字颜色，让它作为辅助说明存在。 */
  color: var(--text-secondary);

  /* 禁止选中标签文字，避免连续点击时出现多余文本选区。 */
  user-select: none;
}

/*
  作用容器: 跳页单位文字 `.pagination-jump-unit`。
  样式作用:
  标识输入框中的数字代表页码。
  让跳页区域文案形成“跳转到 2 页”的完整语义。
*/
.pagination-jump-unit {
  /* 设置页码单位字号，和分页按钮文字保持一致。 */
  font-size: 14px;

  /* 设置页码单位字重，让“页”字在输入框右侧清晰可辨。 */
  font-weight: 600;

  /* 设置页码单位颜色，和“跳转到”辅助文字保持一致。 */
  color: var(--text-secondary);

  /* 禁止选中单位文字，避免连续操作分页时出现文本选区。 */
  user-select: none;
}

/*
  作用容器: 跳页输入框 `.pagination-jump-input`。
  样式作用:
  承载用户输入的目标页码。
  和当前页状态框保持视觉一致，但保留输入能力。
*/
.pagination-jump-input {
  /* 收紧输入框视觉宽度，避免跳页区域过重。 */
  width: 48px;

  /* 让 width 包含内边距和边框，保证输入框实际视觉宽度按设定值收窄。 */
  box-sizing: border-box;

  /* 设置输入框高度，与按钮和当前页状态框保持一致。 */
  height: 40px;

  /* 设置输入框横向内边距，保证居中数字仍有基础呼吸空间。 */
  padding: 0 6px;

  /* 设置输入框边框，和当前页状态框保持统一。 */
  border: 1px solid var(--border-color);

  /* 设置输入框圆角，和分页其他控件保持一致。 */
  border-radius: 12px;

  /* 设置输入框背景，保证用户可输入区域清晰可见。 */
  background: rgba(255, 255, 255, 0.94);

  /* 设置输入数字颜色，保证页码输入有足够可读性。 */
  color: var(--text-primary);

  /* 设置输入框字号，和分页按钮文字保持一致。 */
  font-size: 14px;

  /* 设置输入框字重，让数字比辅助标签更清晰。 */
  font-weight: 500;

  /* 设置输入框文字居中，让短页码在输入框内保持稳定视觉中心。 */
  text-align: center;

  /* 去掉浏览器默认轮廓，改用 focus-visible 中的项目风格。 */
  outline: none;

  /* 设置轻量阴影，让输入框和分页按钮处于同一层级。 */
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.04);
}

/*
  作用容器: 跳页输入框聚焦状态 `.pagination-jump-input:focus-visible`。
  样式作用:
  给键盘或鼠标聚焦输入框时提供明确反馈。
  使用项目主色强调当前可输入区域。
*/
.pagination-jump-input:focus-visible {
  /* 设置聚焦边框颜色，让当前输入框比普通状态更醒目。 */
  border-color: #4f7cff;

  /* 设置聚焦阴影，提示用户正在编辑目标页码。 */
  box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.16);
}

/*
  响应式断点: (max-width: 640px)。
  作用范围: 当前样式块内在该媒体条件下命中的页面或组件元素。
  样式作用:
  作用容器: 手机宽度下的分页栏。
  样式作用:
  收紧分页控件尺寸，减少移动端横向滚动距离。
  保持所有分页能力完整可用。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机宽度下的分页按钮 `.pagination-btn`。
    样式作用:
    缩小按钮宽度和高度。
    保持上一页、下一页仍有足够点击区域。
  */
  .pagination-btn {
    /* 缩小手机端分页按钮最小宽度，减少横向空间占用。 */
    min-width: 68px;

    /* 缩小手机端分页按钮高度，贴合移动端紧凑布局。 */
    height: 38px;

    /* 缩小手机端按钮内边距，避免分页栏过宽。 */
    padding: 0 12px;
  }

  /*
    作用容器: 手机宽度下的当前页状态框 `.pagination-current`。
    样式作用:
    缩小状态框尺寸。
    保持当前页信息仍然稳定居中展示。
  */
  .pagination-current {
    /* 缩小手机端当前页状态框宽度，让分页栏更紧凑。 */
    width: 64px;

    /* 缩小手机端当前页状态框高度。 */
    height: 38px;

    /* 调整手机端状态框行高，让页码仍然垂直居中。 */
    line-height: 36px;
  }

  /*
    作用容器: 手机宽度下的跳页输入框 `.pagination-jump-input`。
    样式作用:
    缩小跳页输入框尺寸。
    减少分页栏在小屏上的横向占用。
  */
  .pagination-jump-input {
    /* 缩小手机端跳页输入框宽度，仍可显示常见页码。 */
    width: 44px;

    /* 缩小手机端跳页输入框高度，与按钮保持一致。 */
    height: 38px;
  }
}
</style>
