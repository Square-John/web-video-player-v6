<template>
  <!--
    HomeDisplaySettingsPanel 组件渲染树

    [DEFAULT] ele(section.home-display-settings)
    │  - condition: 界面设置子路由激活时默认渲染。
    │  - type: 原生标签 section。
    │  - description: 编辑首页轮播展示数量并提交持久化设置。
    │  - params: draftPreferences 来自已提交 HomeDisplayPreferences 的页面草稿。
    │  - events: 无。
    ├─ [DEFAULT] ele(header.home-display-settings__header)
    ├─ [IF errorMessage] ele(el-alert.home-display-settings__error)
    ├─ [DEFAULT] ele(div.home-display-settings__field)
    │  └─ [DEFAULT] ele(el-input-number.home-display-settings__input)
    └─ [DEFAULT] ele(footer.home-display-settings__actions)
       ├─ [DEFAULT] ele(el-button) 恢复默认
       └─ [DEFAULT] ele(el-button) 保存
  -->
  <!--
    [DEFAULT] ele(section.home-display-settings)
    - condition: 界面设置子路由激活时默认渲染。
    - type: 原生标签 section。
    - description: 组织标题、错误、轮播数量字段和保存命令。
    - params: 无。
    - events: 无。
  -->
  <section class="home-display-settings">
    <!--
      [DEFAULT] ele(header.home-display-settings__header)
      - condition: 默认渲染。
      - type: 原生标签 header。
      - description: 展示界面设置模块标题。
      - params: 无。
      - events: 无。
    -->
    <header class="home-display-settings__header">
      <h1 class="home-display-settings__title">界面设置</h1>
    </header>

    <!--
      [IF errorMessage] ele(el-alert.home-display-settings__error)
      - condition: Service 发布安全错误说明时渲染。
      - type: 第三方组件 Element UI el-alert。
      - description: 展示本次校验或持久化失败结果。
      - params: title 读取 errorMessage；type=error；closable=false。
      - events: 无。
    -->
    <el-alert
      v-if="errorMessage"
      class="home-display-settings__error"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon />

    <!--
      [DEFAULT] ele(div.home-display-settings__field)
      - condition: 默认渲染。
      - type: 原生标签 div 与第三方组件 Element UI el-input-number。
      - description: 编辑首页轮播实际允许展示的条目数量。
      - params: min/max/step 来自 HOME_CAROUSEL_ITEM_LIMIT；v-model 只修改页面草稿。
      - events: el-input-number input 更新 draftPreferences.carouselItemLimit。
    -->
    <div class="home-display-settings__field">
      <div class="home-display-settings__field-copy">
        <label class="home-display-settings__label" for="home-carousel-item-limit">
          首页轮播数量
        </label>
        <span class="home-display-settings__hint">最多展示 {{ carouselLimits.maximum }} 条</span>
      </div>
      <el-input-number
        id="home-carousel-item-limit"
        v-model="draftPreferences.carouselItemLimit"
        class="home-display-settings__input"
        :min="carouselLimits.minimum"
        :max="carouselLimits.maximum"
        :step="carouselLimits.step"
        :precision="0"
        controls-position="right"
        :disabled="saving" />
    </div>

    <!--
      [DEFAULT] ele(footer.home-display-settings__actions)
      - condition: 默认渲染。
      - type: 原生标签 footer 与第三方组件 Element UI el-button。
      - description: 提供恢复默认和保存两个明确命令。
      - params: saving 控制禁用与加载状态。
      - events: click 调用 restoreDefaults() 或 saveSettings()。
    -->
    <footer class="home-display-settings__actions">
      <el-button
        icon="el-icon-refresh-left"
        :disabled="saving"
        @click="restoreDefaults">
        恢复默认
      </el-button>
      <el-button
        type="primary"
        icon="el-icon-check"
        :loading="saving"
        @click="saveSettings">
        保存
      </el-button>
    </footer>
  </section>
</template>

<script>
/*
  HomeDisplaySettingsPanel.vue 模块说明

  - 文件职责:
      把已持久化 HomeDisplayPreferences 映射为首页轮播数量表单。
      页面只维护草稿，校验、FIFO 和 IndexedDB 提交由 HomeDisplaySettingsService 负责。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      homeDisplay.config exports: 自定义配置，提供数量边界和默认偏好。
      homeDisplaySettingsStore: 自定义 Store，提供已提交偏好、保存状态和安全错误。
      homeDisplaySettingsService exports: 自定义 Service，保存完整偏好或恢复默认。

  - 模块级常量:
      HOME_DISPLAY_SETTINGS_SAVE_ERROR_MESSAGE: string，未知页面保存失败的安全说明。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDraftPreferences(preferences): 创建可编辑展示偏好副本。

  - 模块级类:
      无

  - 对外导出:
      Vue 组件配置: 供设置路由渲染界面设置面板。
*/

import {
  // 导入来源: ../../config/homeDisplay.config.js；导入内容: HOME_CAROUSEL_ITEM_LIMIT；文件作用: 约束数字输入范围和步长。
  HOME_CAROUSEL_ITEM_LIMIT,
  // 导入来源: ../../config/homeDisplay.config.js；导入内容: createDefaultHomeDisplayPreferences；文件作用: 未初始化防御和草稿默认结构。
  createDefaultHomeDisplayPreferences
} from '../../config/homeDisplay.config.js';

// 导入来源: ../../store/homeDisplaySettingsStore.js；导入内容: homeDisplaySettingsStore；文件作用: 读取已提交偏好、保存状态和错误说明。
import { homeDisplaySettingsStore } from '../../store/homeDisplaySettingsStore.js';

import {
  // 导入来源: ../../services/homeDisplaySettingsService.js；导入内容: saveHomeDisplayPreferences；文件作用: 提交完整页面草稿。
  saveHomeDisplayPreferences,
  // 导入来源: ../../services/homeDisplaySettingsService.js；导入内容: restoreDefaultHomeDisplayPreferences；文件作用: 通过同一 FIFO 保存默认偏好。
  restoreDefaultHomeDisplayPreferences
} from '../../services/homeDisplaySettingsService.js';

// 类型: string；作用: Service 没有发布安全说明时，页面显示统一保存失败反馈。
const HOME_DISPLAY_SETTINGS_SAVE_ERROR_MESSAGE = '界面设置保存失败，请稍后重试。';

/**
 * 创建首页展示偏好表单副本。
 * 纯函数: 返回新的精确对象，不保留 Store 引用。
 * 失败路径: 偏好尚未初始化时只创建默认草稿，不代表默认值已经持久化。
 *
 * @param {object|null} preferences 已提交首页展示偏好。
 * @returns {object} 可编辑 HomeDisplayPreferences 草稿。
 */
function createDraftPreferences(preferences) {
  // 类型: object；作用: 正常启动读取 Store，空投影只为组件隔离测试提供完整表单字段。
  const sourcePreferences = preferences || createDefaultHomeDisplayPreferences();
  return {
    schemaVersion: sourcePreferences.schemaVersion,
    carouselItemLimit: sourcePreferences.carouselItemLimit
  };
}

// 导出类型: default Vue component options；调用方: settings 路由；使用场景: 界面设置子页面。
export default {
  // 类型: string；作用: 在 Vue Devtools 和错误堆栈中识别界面设置组件。
  name: 'HomeDisplaySettingsPanel',

  /**
   * 创建页面局部草稿。
   * 纯函数: 每个组件实例获得独立偏好对象，不修改 Store。
   *
   * @returns {object} 草稿和页面局部错误状态。
   */
  data() {
    return {
      // 类型: object；来源: 已提交展示偏好；修改入口: 数字输入和 Store 同步；影响轮播数量保存候选。
      draftPreferences: createDraftPreferences(homeDisplaySettingsStore.preferences),
      // 类型: string；来源: 当前页面捕获异常；空字符串隐藏页面级错误。
      localErrorMessage: ''
    };
  },

  computed: {
    /**
     * 读取冻结轮播数量边界。
     * 纯函数: 不复制或修改配置，模板只读取 minimum、maximum 和 step。
     *
     * @returns {Readonly<object>} 轮播数量输入约束。
     */
    carouselLimits() {
      return HOME_CAROUSEL_ITEM_LIMIT;
    },

    /**
     * 读取已提交轮播数量。
     * 纯函数: 只读取响应式 Store，供 watcher 在提交成功后刷新草稿。
     *
     * @returns {number|null} 已提交数量或初始化前空值。
     */
    committedCarouselItemLimit() {
      return homeDisplaySettingsStore.preferences?.carouselItemLimit ?? null;
    },

    /**
     * 读取保存进行中状态。
     * 纯函数: true 禁用输入和重复命令，false 允许编辑；状态只由 Service FIFO 修改。
     *
     * @returns {boolean} 当前是否存在未收敛保存命令。
     */
    saving() {
      return homeDisplaySettingsStore.saving;
    },

    /**
     * 选择页面需要展示的安全错误。
     * 纯函数: 页面捕获错误优先，其次使用 Service 发布说明，不读取原始异常。
     *
     * @returns {string} 用户可见错误说明或空字符串。
     */
    errorMessage() {
      return this.localErrorMessage || homeDisplaySettingsStore.errorMessage;
    }
  },

  watch: {
    /**
     * 在 Repository 提交结果被 Store 采用后同步表单草稿。
     * 副作用: 只替换当前组件 draftPreferences，不写回 Service 或数据库。
     * immediate: 首次创建时确保草稿与启动恢复结果一致。
     *
     * @param {number|null} carouselItemLimit 最新已提交轮播数量。
     * @returns {void}
     */
    committedCarouselItemLimit: {
      immediate: true,
      /**
       * 采用最新已提交数量。
       * 副作用: 替换页面草稿并清除页面局部错误，不写入 Store 或数据库。
       *
       * @param {number|null} carouselItemLimit 最新已提交轮播数量。
       * @returns {void}
       */
      handler(carouselItemLimit) {
        // 条件分支: Store 尚未采用持久化偏好时进入；执行内容: 保留现有草稿，不制造保存事实。
        if (carouselItemLimit === null) return;
        this.draftPreferences = createDraftPreferences(homeDisplaySettingsStore.preferences);
        this.localErrorMessage = '';
      }
    }
  },

  methods: {
    /**
     * 保存当前首页展示偏好草稿。
     * 触发来源: 保存按钮。
     * 副作用: 调用 Service FIFO；Repository 提交成功后 Store watcher 刷新草稿并显示成功消息。
     * 成功路径: 已提交偏好被 Store 采用，并展示保存成功消息。
     * 失败路径: 保留草稿和旧 Store 投影，只显示安全错误。
     *
     * @returns {Promise<void>} 保存与页面反馈收敛后完成。
     */
    async saveSettings() {
      // 条件分支: 已有保存命令执行时进入；执行内容: 拒绝重复提交同一草稿。
      if (this.saving) return;
      this.localErrorMessage = '';
      try {
        await saveHomeDisplayPreferences({
          schemaVersion: this.draftPreferences.schemaVersion,
          carouselItemLimit: this.draftPreferences.carouselItemLimit
        });
        // 副作用: 使用 Element UI 全局消息确认真实持久化成功。
        this.$message.success('界面设置已保存');
      } catch {
        // 条件分支: Service 未提供安全错误说明时进入；执行内容: 使用页面兜底且不覆盖草稿和已提交 Store。
        if (!homeDisplaySettingsStore.errorMessage) {
          this.localErrorMessage = HOME_DISPLAY_SETTINGS_SAVE_ERROR_MESSAGE;
        }
      }
    },

    /**
     * 恢复并保存默认首页展示偏好。
     * 触发来源: 恢复默认按钮。
     * 副作用: 复用 Service 同一 FIFO，成功后由 Store watcher 更新草稿。
     * 成功路径: 默认偏好提交后被 Store 采用，并展示恢复成功消息。
     * 失败路径: 保留当前草稿和旧 Store 投影，只显示安全错误。
     *
     * @returns {Promise<void>} 默认偏好保存与页面反馈收敛后完成。
     */
    async restoreDefaults() {
      // 条件分支: 已有保存命令执行时进入；执行内容: 不修改当前草稿。
      if (this.saving) return;
      this.localErrorMessage = '';
      try {
        await restoreDefaultHomeDisplayPreferences();
        // 副作用: 使用 Element UI 全局消息确认默认值已经真实持久化。
        this.$message.success('界面设置已恢复默认');
      } catch {
        // 条件分支: Service 未提供安全错误说明时进入；执行内容: 使用页面兜底且不展示原始异常。
        if (!homeDisplaySettingsStore.errorMessage) {
          this.localErrorMessage = HOME_DISPLAY_SETTINGS_SAVE_ERROR_MESSAGE;
        }
      }
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 界面设置根面板 `.home-display-settings`。
  样式作用:
  使用全宽非卡片布局组织标题、字段和操作区。
*/
.home-display-settings {
  /* 使用纵向布局维持标题、错误、字段和操作顺序。 */
  display: flex;
  /* 主区域沿纵轴排列。 */
  flex-direction: column;
  /* 各区域使用统一设置页间距。 */
  gap: 20px;
  /* 面板占满设置工作区。 */
  width: 100%;
  /* 内边距计入宽度，避免窄屏溢出。 */
  box-sizing: border-box;
  /* 与其他真实设置模块保持一致留白。 */
  padding: 24px;
}

/*
  作用容器: 界面设置标题区 `.home-display-settings__header`。
  样式作用:
  用底边界分隔模块标题和表单内容。
*/
.home-display-settings__header {
  /* 标题下方保留视觉间隔。 */
  padding-bottom: 18px;
  /* 使用主题边框形成轻量分区。 */
  border-bottom: 1px solid var(--border-color);
}

/*
  作用容器: 界面设置主标题 `.home-display-settings__title`。
  样式作用:
  使用紧凑设置模块标题层级。
*/
.home-display-settings__title {
  /* 清除浏览器标题默认外边距。 */
  margin: 0;
  /* 与其他设置模块使用相同字号。 */
  font-size: 24px;
  /* 强化模块名称识别。 */
  font-weight: 700;
  /* 使用全局主文字色。 */
  color: var(--text-primary);
}

/*
  作用容器: 错误、字段和操作区。
  样式作用:
  统一限制阅读宽度，避免超宽屏拉散设置关系。
*/
.home-display-settings__error,
.home-display-settings__field,
.home-display-settings__actions {
  /* 限制设置内容最大阅读宽度。 */
  max-width: 680px;
}

/*
  作用容器: 轮播数量字段 `.home-display-settings__field`。
  样式作用:
  在桌面横向对齐说明与数字输入，尺寸由工作区约束。
*/
.home-display-settings__field {
  /* 使用 Grid 建立说明和输入两列。 */
  display: grid;
  /* 左列弹性承载文案，右列保持控件可读宽度。 */
  grid-template-columns: minmax(0, 1fr) minmax(160px, 220px);
  /* 字段内容垂直居中。 */
  align-items: center;
  /* 文案和输入之间保留操作间隔。 */
  gap: 20px;
}

/*
  作用容器: 字段文案 `.home-display-settings__field-copy`。
  样式作用:
  让标签与范围说明形成清晰纵向层级。
*/
.home-display-settings__field-copy {
  /* 使用纵向 Flex 排列标签和提示。 */
  display: flex;
  /* 文案沿纵轴排列。 */
  flex-direction: column;
  /* 标签和提示使用紧凑间距。 */
  gap: 6px;
  /* 允许长文本在 Grid 中收缩换行。 */
  min-width: 0;
}

/*
  作用容器: 首页轮播数量标签 `.home-display-settings__label`。
  样式作用:
  提高设置字段名称可读性。
*/
.home-display-settings__label {
  /* 使用正文可读字号。 */
  font-size: 14px;
  /* 标签高于辅助说明的视觉权重。 */
  font-weight: 600;
  /* 使用主文字色。 */
  color: var(--text-primary);
}

/*
  作用容器: 轮播数量范围说明 `.home-display-settings__hint`。
  样式作用:
  补充最大值信息但不抢夺标签层级。
*/
.home-display-settings__hint {
  /* 使用紧凑辅助字号。 */
  font-size: 13px;
  /* 使用次级文字色降低视觉重量。 */
  color: var(--text-secondary);
}

/*
  作用容器: Element UI 数字输入 `.home-display-settings__input`。
  样式作用:
  在字段列内占满稳定宽度，避免控件随数值变化。
*/
.home-display-settings__input {
  /* 控件占满 Grid 第二列。 */
  width: 100%;
}

/*
  作用容器: 界面设置操作区 `.home-display-settings__actions`。
  样式作用:
  横向排列恢复默认与保存命令并靠右对齐。
*/
.home-display-settings__actions {
  /* 使用 Flex 横向排列按钮。 */
  display: flex;
  /* 主要保存命令位于右侧。 */
  justify-content: flex-end;
  /* 按钮之间保留点击间隔。 */
  gap: 10px;
}

/*
  响应式断点: max-width 640px。
  作用范围: 手机界面设置面板。
  样式作用:
  收紧页面留白并把字段改为纵向结构。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机界面设置根面板。
    样式作用:
    提升窄屏工作区可用宽度。
  */
  .home-display-settings {
    /* 手机使用更紧凑的页面内边距。 */
    padding: 18px 14px;
  }

  /*
    作用容器: 手机轮播数量字段。
    样式作用:
    文案和数字输入上下排列，避免横向挤压。
  */
  .home-display-settings__field {
    /* 单列结构让输入占满可用宽度。 */
    grid-template-columns: minmax(0, 1fr);
    /* 收紧文案与输入的纵向距离。 */
    gap: 12px;
  }

  /*
    作用容器: 手机界面设置操作区。
    样式作用:
    允许完整按钮在空间不足时换行。
  */
  .home-display-settings__actions {
    /* 手机允许整按钮换行，禁止文字挤出按钮。 */
    flex-wrap: wrap;
  }
}
</style>
