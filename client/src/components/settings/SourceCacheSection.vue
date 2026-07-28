<template>
  <!--
    SourceCacheSection 组件渲染树

    [DEFAULT] ele(section.source-cache.theme-surface)
    │  - condition:
    │      数据源详情存在时默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      数据源缓存空间面板。
    │      展示两级缓存占用，并提供两种边界明确的清理操作。
    │  - params:
    │      -- record：共享 SourceManagerState 中的数据源记录，提供两级缓存字节数。
    │  - events:
    │      @clear-temporary
    │          - description:
    │              用户点击“清理临时缓存”且按钮可用时触发。
    │              请求父页面清理可重新生成的内容和日志等临时缓存。
    │          - methods:
    │              $emit('clear-temporary')
    │                  -- 无参数。
    │      @clear-all
    │          - description:
    │              用户点击“清理全部缓存”且按钮可用时触发。
    │              请求父页面确认后清理当前数据源全部运行缓存。
    │          - methods:
    │              $emit('clear-all')
    │                  -- 无参数。
    │
    ├─ [DEFAULT] ele(dl.source-cache__metrics)
    │  - condition:
    │      默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: dl
    │  - description:
    │      缓存容量摘要区。
    │      展示临时缓存和全部缓存的格式化占用量。
    │  - params:
    │      -- temporaryCacheText：由临时缓存字节数格式化得到的展示文本。
    │      -- totalCacheText：由全部缓存字节数格式化得到的展示文本。
    │  - events:
    │      无
    │
    └─ [DEFAULT] ele(div.source-cache__actions)
       - condition:
           默认渲染；对应缓存占用为零时按钮保持禁用。
       - type:
           原生标签
           标签名称: div
       - description:
           缓存清理操作区。
           只发出清理意图，实际共享状态修改由详情页调用 service 完成。
       - params:
           -- hasTemporaryCache：控制临时缓存清理按钮是否可用。
           -- hasAnyCache：控制全部缓存清理按钮是否可用。
       - events:
           无
  -->
  <!--
    [DEFAULT] ele(section.source-cache.theme-surface)
    - condition:
        数据源详情存在时默认渲染。
    - type:
        原生标签
        标签名称: section
    - description:
        数据源缓存空间面板根容器。
        组合缓存边界说明、容量摘要和清理操作。
    - params:
        -- record：父级传入的数据源记录，提供缓存状态。
    - events:
        @clear-temporary
            - description:
                用户请求清理临时缓存时触发。
            - methods:
                $emit('clear-temporary')
                    -- 无参数。
        @clear-all
            - description:
                用户请求清理全部缓存时触发。
            - methods:
                $emit('clear-all')
                    -- 无参数。
  -->
  <section class="source-cache theme-surface">
    <!--
      [DEFAULT] ele(h2.source-cache__title)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: h2
      - description:
          缓存空间区标题，建立详情区块层级。
      - params:
          无
      - events:
          无
    -->
    <h2 class="source-cache__title">缓存空间</h2>
    <!--
      [DEFAULT] ele(p.source-cache__description)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: p
      - description:
          缓存清理边界说明，解释两种操作清除和保留的内容。
      - params:
          无
      - events:
          无
    -->
    <p class="source-cache__description">
      临时缓存可重新生成；全部缓存还包含验证上下文等运行数据，但不会删除脚本、基本信息、启用状态和运行授权。
    </p>

    <!--
      [DEFAULT] ele(dl.source-cache__metrics)
      - condition:
          默认渲染。
      - type:
          原生标签
          标签名称: dl
      - description:
          缓存容量摘要区。
          从 record.cache 读取两级容量并使用公共函数格式化。
      - params:
          -- temporaryCacheText：临时缓存格式化文本。
          -- totalCacheText：全部缓存格式化文本。
      - events:
          无
    -->
    <dl class="source-cache__metrics">
      <!--
        [DEFAULT] ele(div.source-cache__metric.source-cache__metric--temporary)
        - condition:
            默认渲染。
        - type:
            原生标签
            标签名称: div
        - description:
            临时缓存容量项，展示可重新生成缓存的格式化占用量。
        - params:
            -- temporaryCacheText：临时缓存格式化容量。
        - events:
            无
      -->
      <div class="source-cache__metric source-cache__metric--temporary">
        <dt>临时缓存占用</dt>
        <dd>{{ temporaryCacheText }}</dd>
      </div>
      <!--
        [DEFAULT] ele(div.source-cache__metric.source-cache__metric--total)
        - condition:
            默认渲染。
        - type:
            原生标签
            标签名称: div
        - description:
            全部缓存容量项，展示当前数据源所有运行缓存占用量。
        - params:
            -- totalCacheText：全部缓存格式化容量。
        - events:
            无
      -->
      <div class="source-cache__metric source-cache__metric--total">
        <dt>全部缓存占用</dt>
        <dd>{{ totalCacheText }}</dd>
      </div>
    </dl>

    <!--
      [DEFAULT] ele(div.source-cache__actions)
      - condition:
          默认渲染；缓存为零时对应按钮禁用。
      - type:
          原生标签
          标签名称: div
      - description:
          缓存清理操作区。
          把用户清理意图交给详情页，组件不直接修改共享状态。
      - params:
          -- hasTemporaryCache：控制临时缓存按钮禁用状态。
          -- hasAnyCache：控制全部缓存按钮禁用状态。
      - events:
          无
    -->
    <div class="source-cache__actions">
      <!--
        [DEFAULT] ele(el-button.source-cache__clear-temporary)
        - condition:
            默认渲染；hasTemporaryCache 为 false 时禁用。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            临时缓存清理按钮，把可重新生成缓存的清理意图交给父页面。
        - params:
            -- hasTemporaryCache：取反后控制 disabled 状态。
        - events:
            @click
                - description:
                    用户点击可用按钮时触发，请求父页面清理临时缓存。
                - methods:
                    $emit('clear-temporary')
                        -- 无参数。
      -->
      <el-button
        class="source-cache__clear-temporary"
        :disabled="!hasTemporaryCache"
        @click="$emit('clear-temporary')"
      >
        清理临时缓存
      </el-button>
      <!--
        [DEFAULT] ele(el-button.source-cache__clear-all)
        - condition:
            默认渲染；hasAnyCache 为 false 时禁用。
        - type:
            第三方组件
            组件库: Element UI
            组件名称: el-button
        - description:
            全部缓存清理按钮，把包含验证上下文在内的清理意图交给父页面确认。
        - params:
            -- hasAnyCache：取反后控制 disabled 状态。
        - events:
            @click
                - description:
                    用户点击可用按钮时触发，请求父页面清理全部运行缓存。
                - methods:
                    $emit('clear-all')
                        -- 无参数。
      -->
      <el-button
        class="source-cache__clear-all"
        type="danger"
        plain
        :disabled="!hasAnyCache"
        @click="$emit('clear-all')"
      >
        清理全部缓存
      </el-button>
    </div>
  </section>
</template>

<script>
/*
  SourceCacheSection.vue 模块说明

  - 文件职责:
      展示单个数据源的临时缓存和全部缓存占用，并提供两级清理入口。
      只发送清理意图，确认和实际缓存状态修改由详情页与 service 负责。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      formatCacheBytes: 自定义函数，统一格式化缓存容量。
  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceCacheSection: 当前文件公开的组件或模块能力。
*/

import {
  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: formatCacheBytes 缓存容量格式化函数。
  // 文件作用: 把共享状态中的缓存字节数转换为用户可读容量文本。
  formatCacheBytes
} from '../../utils/settingsDisplay';

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools 和错误堆栈识别缓存空间区。
  name: 'SourceCacheSection',

  props: {
    // 类型: object。
    // 来源: SourceDetailView 传入的共享数据源记录。
    // 作用: 提供两级缓存的唯一状态来源。
    // 字段: cache，object，当前数据源缓存状态。
    // 字段: cache.temporaryCacheBytes，number，可重新生成的临时缓存字节数。
    // 字段: cache.totalCacheBytes，number，当前数据源全部运行缓存字节数。
    record: { type: Object, required: true }
  },

  computed: {
    /**
     * 计算临时缓存的人类可读容量。
     * 数据来源: record.cache.temporaryCacheBytes。
     * 该计算属性只格式化展示文本，不修改共享缓存状态。
     *
     * @returns {string} 临时缓存格式化容量，供摘要区展示。
     * 纯函数: temporaryCacheText 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    temporaryCacheText() {
      // 返回值类型: string。
      // 作用: 给临时缓存占用字段提供统一单位和小数格式。
      return formatCacheBytes(this.record.cache.temporaryCacheBytes);
    },

    /**
     * 计算全部缓存的人类可读容量。
     * 数据来源: record.cache.totalCacheBytes。
     * 该计算属性只格式化展示文本，不修改共享缓存状态。
     *
     * @returns {string} 全部缓存格式化容量，供摘要区展示。
     * 纯函数: totalCacheText 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    totalCacheText() {
      // 返回值类型: string。
      // 作用: 给全部缓存占用字段提供统一单位和小数格式。
      return formatCacheBytes(this.record.cache.totalCacheBytes);
    },

    /**
     * 判断当前数据源是否存在临时缓存。
     * 数据来源: record.cache.temporaryCacheBytes。
     * true 允许用户请求清理临时缓存，false 禁用对应按钮。
     *
     * @returns {boolean} 是否存在大于零的临时缓存占用。
     * 纯函数: hasTemporaryCache 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    hasTemporaryCache() {
      // 返回值类型: boolean。
      // 作用: 字节数大于零时启用临时缓存清理按钮，否则保持禁用。
      return Number(this.record.cache.temporaryCacheBytes) > 0;
    },

    /**
     * 判断当前数据源是否存在任意运行缓存。
     * 数据来源: record.cache.totalCacheBytes。
     * true 允许用户请求清理全部缓存，false 禁用对应按钮。
     *
     * @returns {boolean} 是否存在大于零的全部缓存占用。
 * 纯函数: hasAnyCache 只读取输入参数或组件只读状态，并返回对应派生结果，不修改响应式状态或外部存储。
 */
    hasAnyCache() {
      // 返回值类型: boolean。
      // 作用: 字节数大于零时启用全部缓存清理按钮，否则保持禁用。
      return Number(this.record.cache.totalCacheBytes) > 0;
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 缓存空间面板 `.source-cache`。
  样式作用:
  承载缓存说明、两级容量和清理操作。
*/
.source-cache {
  /* 设置面板内部安全留白。 */
  padding: 22px;
}

/*
  作用容器: 缓存空间区标题。
  样式作用:
  建立详情区块标题层级。
*/
.source-cache h2 {
  /* 清除标题默认外边距。 */
  margin: 0;
  /* 使用详情区块标题字号。 */
  font-size: 18px;
  /* 使用主题主文本色。 */
  color: var(--text-primary);
}

/*
  作用容器: 缓存边界说明。
  样式作用:
  解释两种清理操作会保留和清除什么。
*/
.source-cache__description {
  /* 在标题下方保留说明间距。 */
  margin: 8px 0 18px;
  /* 使用弱文本色降低说明层级。 */
  color: var(--text-muted);
  /* 提升多行说明可读性。 */
  line-height: 1.7;
}

/*
  作用容器: 缓存容量区 `.source-cache__metrics`。
  样式作用:
  桌面端并排展示两级容量。
*/
.source-cache__metrics {
  /* 使用两列 Grid 平均分配容量项。 */
  display: grid;
  /* 两项容量平均占用可用宽度。 */
  grid-template-columns: repeat(2, minmax(0, 1fr));
  /* 设置容量项间距。 */
  gap: 12px;
  /* 清除 dl 默认外边距。 */
  margin: 0;
}

/*
  作用容器: 单个缓存容量项。
  样式作用:
  以轻量背景区分容量读数，不形成数据源卡片列表。
*/
.source-cache__metric {
  /* 使用纵向 Grid 排列名称和值。 */
  display: grid;
  /* 设置名称和值之间的距离。 */
  gap: 6px;
  /* 设置容量项内部留白。 */
  padding: 14px;
  /* 使用主题弱表面色区分容量读数。 */
  background: var(--surface-muted);
  /* 使用与设置模块一致的圆角。 */
  border-radius: 10px;
}

/*
  作用容器: 缓存容量名称。
  样式作用:
  使用弱文本提示当前容量层级。
*/
.source-cache__metric dt {
  /* 使用较小字号。 */
  font-size: 12px;
  /* 使用主题弱文本色。 */
  color: var(--text-muted);
}

/*
  作用容器: 缓存容量值。
  样式作用:
  强化用户需要判断的占用量。
*/
.source-cache__metric dd {
  /* 清除 dd 默认外边距。 */
  margin: 0;
  /* 使用较大字号突出容量。 */
  font-size: 18px;
  /* 使用主文本色。 */
  color: var(--text-primary);
  /* 加强容量值字重。 */
  font-weight: 700;
}

/*
  作用容器: 缓存清理操作组。
  样式作用:
  在容量读数下方排列两种边界明确的操作。
*/
.source-cache__actions {
  /* 使用弹性布局排列操作按钮。 */
  display: flex;
  /* 窄屏允许按钮换行。 */
  flex-wrap: wrap;
  /* 设置按钮间距。 */
  gap: 8px;
  /* 与容量区保留垂直距离。 */
  margin-top: 18px;
}

/*
  作用容器: 缓存操作组内 Element UI 按钮。
  样式作用:
  移除第三方相邻按钮边距，统一由 gap 控制。
*/
.source-cache__actions > .el-button {
  /* 清除 Element UI 相邻按钮默认左外边距。 */
  margin-left: 0;
}

/*

  响应式断点: (max-width: 640px)。
  作用范围: 作用容器: 手机。
  样式作用:
  作用容器: 手机。
  响应式断点: max-width 640px。
  样式作用:
  容量改为单列并让操作按钮占满宽度。

*/
@media (max-width: 640px) {
  /*
    作用容器: 手机缓存面板。
    样式作用:
    提升窄屏可用宽度。
  */
  .source-cache {
    /* 缩小手机内边距。 */
    padding: 17px 14px;
  }

  /*
    作用容器: 手机缓存容量区。
    样式作用:
    单列展示，避免容量项过窄。
  */
  .source-cache__metrics {
    /* 手机按一列排列容量。 */
    grid-template-columns: minmax(0, 1fr);
  }

  /*
    作用容器: 手机缓存操作按钮。
    样式作用:
    提供完整宽度和稳定触控面积。
  */
  .source-cache__actions > .el-button {
    /* 两个按钮分别占满一行。 */
    width: 100%;
  }
}
</style>
