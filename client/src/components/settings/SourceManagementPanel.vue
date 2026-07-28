<template>
  <!--
    SourceManagementPanel 组件渲染树

    [DEFAULT] ele(section.source-management)
    │  - condition:
    │      进入设置页数据源管理子路由时默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      数据源管理主页面；组合页面说明、全局操作、摘要 Chip、筛选、批量操作、列表和确认对话框。
    │  - params:
    │      -- moduleDefinition、managerState、summary：设置模块配置和共享内存状态派生数据。
    │      -- operationPending：异步设置事务执行期间显示页面级加载门禁。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(header.source-management__header)
    │  - condition:
    │      页面默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: header
    │  - description:
    │      展示页面标题、内存存储边界和检测、恢复、导入操作。
    │  - params:
    │      -- moduleDefinition、managerState.checkingAll、removedSystemSources：标题和按钮状态。
    │  - events:
    │      @click
    │          - description:
    │              用户点击全局操作按钮时触发检测、恢复或导入流程。
    │          - methods:
    │              handleCheckAll()
    │
    ├─ [DEFAULT] ele(dl.source-management__summary)
    │  - condition:
    │      页面默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: dl
    │  - description:
    │      使用 Chip 分别展示用户启用数量、可运行数量、当前默认源和全部缓存占用。
    │  - params:
    │      -- summary.enabledCount、summary.runnableCount、summary.totalCount、defaultSourceName、totalCacheText：共享状态摘要。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(div.source-management__toolbar)
    │  - condition:
    │      页面默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      左侧切换全部、系统源和自定义源，右侧显示选择数量并执行批量导出或删除。
    │  - params:
    │      -- filterDefinitions、activeSourceKind、sourceKindCounts、selectedCount：筛选与选择状态。
    │  - events:
    │      @click
    │          - description:
    │              用户切换来源筛选或触发批量操作时执行。
    │          - methods:
    │              selectSourceKind(sourceKindFilter)
    │              handleBatchExport()
    │              handleBatchDelete()
    │
    ├─ [DEFAULT] ele(SourceList)
    │  - condition:
    │      页面默认渲染；无记录时组件内部显示分类空状态。
    │  - type:
    │      自定义组件
    │      相对位置: ./SourceList.vue
    │  - description:
    │      展示加载周期内顺序稳定的单行列表，并承接选择、互斥默认源、启停、重置、删除和详情事件。
    │  - params:
    │      -- filteredRecords、managerState.defaultSourceId、selectedSourceIds、emptyDescription：列表输入。
    │  - events:
    │      @toggle-select-all、@toggle-select、@set-default、@toggle-source、@reset-source、@delete-source、@open-detail
    │          - description:
    │              SourceList 发出对应行或批量交互时由当前页面统一编排业务流程。
    │          - methods:
    │              toggleSelectAll(payload)
    │              toggleSourceSelection(payload)
    │              handleSetDefaultFromList(sourceId)
    │              handleToggleSource(payload)
    │              handleResetSource(sourceId)
    │              handleDeleteSource(sourceId)
    │              openSourceDetail(sourceId)
    │
    ├─ [DEFAULT] ele(SourceImportDialog)
    │  - condition:
    │      组件默认挂载；importDialogVisible 为 true 时显示。
    │  - type:
    │      自定义组件
    │      相对位置: ./SourceImportDialog.vue
    │  - description:
    │      接收三入口输入、静态预览后的 SHA-256 信任和启用决定。
    │  - params:
    │      -- importDialogVisible：弹窗可见状态。
    │  - events:
    │      @confirm
    │          - description:
    │              用户提交合法导入输入时创建自定义数据源记录。
    │          - methods:
    │              handleImport(input)
    │
    ├─ [DEFAULT] ele(SourceAuthorizationDialog)
    │  - condition:
    │      组件默认挂载；authorizationDialogVisible 为 true 时显示。
    │  - type:
    │      自定义组件
    │      相对位置: ./SourceAuthorizationDialog.vue
    │  - description:
    │      在启用待授权自定义脚本前要求用户确认运行风险。
    │  - params:
    │      -- pendingAuthorizationRecord：等待授权记录。
    │  - events:
    │      @confirm
    │          - description:
    │              用户确认脚本授权后继续启用。
    │          - methods:
    │              confirmAuthorization(sourceId)
    │
    ├─ [DEFAULT] ele(SourceDisableDialog)
    │  - condition:
    │      组件默认挂载；disableDialogVisible 为 true 时显示。
    │  - type:
    │      自定义组件
    │      相对位置: ./SourceDisableDialog.vue
    │  - description:
    │      在关闭或删除默认源前完成用户可控的默认源交接。
    │  - params:
    │      -- pendingDisableRecord、fallbackRecords、handoffOperationDescription、handoffConfirmLabel：交接上下文。
    │  - events:
    │      @confirm
    │          - description:
    │              用户选择新默认源或接受无默认源后继续原操作。
    │          - methods:
    │              confirmDefaultSourceHandoff(payload)
    │
    ├─ [DEFAULT] ele(SourceDeleteDialog)
    │  - condition:
    │      组件默认挂载；deleteDialogVisible 为 true 时显示。
    │  - type:
    │      自定义组件
    │      相对位置: ./SourceDeleteDialog.vue
    │  - description:
    │      确认列表单条删除，并说明系统源软删除或自定义源实际删除差异。
    │  - params:
    │      -- pendingSingleDeleteRecord：等待单条删除记录。
    │  - events:
    │      @confirm
    │          - description:
    │              用户确认单条删除后执行删除或启动默认源交接。
    │          - methods:
    │              confirmSingleDelete(sourceId)
    │
    └─ [DEFAULT] ele(RestoreSystemSourcesDialog)
       - condition:
           组件默认挂载；restoreDialogVisible 为 true 时显示。
       - type:
           自定义组件
           相对位置: ./RestoreSystemSourcesDialog.vue
       - description:
           选择恢复已软删除的系统数据源。
       - params:
           -- removedSystemSources：当前可恢复系统源记录。
       - events:
           @confirm
               - description:
                   用户确认恢复选择时移除对应软删除标识。
               - methods:
                   confirmRestore(sourceIds)
  -->
  <!--
    [DEFAULT] ele(section.source-management)
    - condition:
        进入数据源管理路由时默认渲染。
    - type:
        原生标签
        标签名称: section
    - description:
        数据源管理页面根容器，所有业务状态通过 settingsService 统一读写。
    - params:
        -- managerState：响应式 SourceManagerState 投影。
        -- operationPending：true 阻止重复设置操作并显示加载反馈，false 恢复页面交互。
    - events:
        无
  -->
  <section v-loading="operationPending" class="source-management">
    <!--
      [DEFAULT] ele(header.source-management__header)
      - condition:
          页面默认渲染。
      - type:
          原生标签
          标签名称: header
      - description:
          组合页面说明与全局数据源操作。
      - params:
          -- moduleDefinition、managerState.checkingAll、removedSystemSources：标题、说明和按钮状态。
      - events:
          无
    -->
    <header class="source-management__header">
      <div class="source-management__heading">
        <h1 class="source-management__title">{{ moduleDefinition.title }}</h1>
        <p class="source-management__description">
          {{ moduleDefinition.description }} 当前操作只保存在浏览器内存中。
        </p>
      </div>
      <div class="source-management__actions" aria-label="数据源管理操作">
        <el-button :loading="managerState.checkingAll" @click="handleCheckAll">检测全部</el-button>
        <el-button :disabled="!removedSystemSources.length" @click="restoreDialogVisible = true">
          恢复系统源
        </el-button>
        <el-button type="primary" @click="importDialogVisible = true">导入数据源</el-button>
      </div>
    </header>

    <!--
      [DEFAULT] ele(dl.source-management__summary)
      - condition:
          页面默认渲染。
      - type:
          原生标签
          标签名称: dl
      - description:
          用四个 Chip 区分用户启用意愿、真实可运行数量、默认源和缓存摘要。
      - params:
          -- summary.enabledCount、summary.runnableCount、summary.totalCount、defaultSourceName、totalCacheText：摘要字段。
      - events:
          无
    -->
    <dl class="source-management__summary theme-surface">
      <div class="source-management__summary-item">
        <dt>已启用</dt>
        <dd><el-tag size="small" effect="plain" type="success">{{ summary.enabledCount }} / {{ summary.totalCount }}</el-tag></dd>
      </div>
      <div class="source-management__summary-item">
        <dt>可运行</dt>
        <dd><el-tag size="small" effect="plain" type="success">{{ summary.runnableCount }} / {{ summary.totalCount }}</el-tag></dd>
      </div>
      <div class="source-management__summary-item">
        <dt>当前默认数据源</dt>
        <dd><el-tag size="small" effect="plain">{{ defaultSourceName }}</el-tag></dd>
      </div>
      <div class="source-management__summary-item">
        <dt>全部数据源缓存</dt>
        <dd><el-tag size="small" effect="plain" type="info">{{ totalCacheText }}</el-tag></dd>
      </div>
    </dl>

    <!--
      [DEFAULT] ele(div.source-management__toolbar)
      - condition:
          页面默认渲染。
      - type:
          原生标签
          标签名称: div
      - description:
          组合来源筛选和批量操作，选择状态跨筛选保留。
      - params:
          -- filterDefinitions、activeSourceKind、sourceKindCounts、selectedCount：筛选和选择数据。
      - events:
          无
    -->
    <div class="source-management__toolbar">
      <div class="source-management__filters" aria-label="按数据源类型筛选">
        <button
          v-for="filterDefinition in filterDefinitions"
          :key="filterDefinition.key"
          type="button"
          class="source-management__filter"
          :class="{ 'source-management__filter--active': activeSourceKind === filterDefinition.key }"
          :aria-pressed="activeSourceKind === filterDefinition.key"
          @click="selectSourceKind(filterDefinition.key)"
        >
          <span>{{ filterDefinition.label }}</span>
          <span class="source-management__filter-count">{{ sourceKindCounts[filterDefinition.key] }}</span>
        </button>
      </div>
      <div class="source-management__batch-actions" aria-label="数据源批量操作">
        <el-tag class="source-management__selected-count" size="small" effect="plain" type="info">
          已选择 {{ selectedCount }} 项
        </el-tag>
        <el-button size="small" :disabled="!selectedCount" @click="handleBatchExport">批量导出</el-button>
        <el-button size="small" type="danger" plain :disabled="!selectedCount" @click="handleBatchDelete">
          批量删除
        </el-button>
      </div>
    </div>

    <!--
      [DEFAULT] ele(SourceList)
      - condition:
          页面默认渲染；空分类由组件内部显示空状态。
      - type:
          自定义组件
          相对位置: ./SourceList.vue
      - description:
          数据源单行列表和全部行级操作入口。
      - params:
          -- filteredRecords、managerState.defaultSourceId、selectedSourceIds、emptyDescription：列表输入。
      - events:
          @toggle-select-all、@toggle-select、@set-default、@toggle-source、@reset-source、@delete-source、@open-detail
              - description:
                  列表发出用户意图后交给当前页面编排。
              - methods:
                  toggleSelectAll(payload)
                  toggleSourceSelection(payload)
                  handleSetDefaultFromList(sourceId)
                  handleToggleSource(payload)
                  handleResetSource(sourceId)
                  handleDeleteSource(sourceId)
                  openSourceDetail(sourceId)
    -->
    <SourceList
      :records="filteredRecords"
      :default-source-id="managerState.defaultSourceId"
      :selected-source-ids="selectedSourceIds"
      :empty-description="emptyDescription"
      @toggle-select-all="toggleSelectAll"
      @toggle-select="toggleSourceSelection"
      @set-default="handleSetDefaultFromList"
      @toggle-source="handleToggleSource"
      @reset-source="handleResetSource"
      @delete-source="handleDeleteSource"
      @open-detail="openSourceDetail"
    />

    <!--
      [DEFAULT] ele(SourceImportDialog)
      - condition:
          默认挂载；importDialogVisible 为 true 时显示。
      - type:
          自定义组件
          相对位置: ./SourceImportDialog.vue
      - description:
          三入口静态预检与信任确认对话框。
      - params:
          -- importDialogVisible：可见状态。
      - events:
          @confirm
              - description:
                  用户提交导入数据时创建记录。
              - methods:
                  handleImport(input)
    -->
    <SourceImportDialog :visible.sync="importDialogVisible" @confirm="handleImport" />

    <!--
      [DEFAULT] ele(SourceAuthorizationDialog)
      - condition:
          默认挂载；authorizationDialogVisible 为 true 时显示。
      - type:
          自定义组件
          相对位置: ./SourceAuthorizationDialog.vue
      - description:
          自定义脚本运行风险确认对话框。
      - params:
          -- pendingAuthorizationRecord：待授权记录。
      - events:
          @confirm
              - description:
                  用户确认授权时继续启用。
              - methods:
                  confirmAuthorization(sourceId)
    -->
    <SourceAuthorizationDialog
      :visible.sync="authorizationDialogVisible"
      :record="pendingAuthorizationRecord"
      @confirm="confirmAuthorization"
    />

    <!--
      [DEFAULT] ele(SourceDisableDialog)
      - condition:
          默认挂载；disableDialogVisible 为 true 时显示。
      - type:
          自定义组件
          相对位置: ./SourceDisableDialog.vue
      - description:
          关闭或删除默认源前的统一交接对话框。
      - params:
          -- pendingDisableRecord、fallbackRecords、handoffOperationDescription、handoffConfirmLabel：交接上下文。
      - events:
          @confirm
              - description:
                  交接完成后继续原启停或删除事务。
              - methods:
                  confirmDefaultSourceHandoff(payload)
    -->
    <SourceDisableDialog
      :visible.sync="disableDialogVisible"
      :record="pendingDisableRecord"
      :fallback-records="fallbackRecords"
      :operation-description="handoffOperationDescription"
      :confirm-label="handoffConfirmLabel"
      @confirm="confirmDefaultSourceHandoff"
    />

    <!--
      [DEFAULT] ele(SourceDeleteDialog)
      - condition:
          默认挂载；deleteDialogVisible 为 true 时显示。
      - type:
          自定义组件
          相对位置: ./SourceDeleteDialog.vue
      - description:
          列表单条删除确认对话框。
      - params:
          -- pendingSingleDeleteRecord：等待删除记录。
      - events:
          @confirm
              - description:
                  用户确认后执行删除或默认源交接。
              - methods:
                  confirmSingleDelete(sourceId)
    -->
    <SourceDeleteDialog
      :visible.sync="deleteDialogVisible"
      :record="pendingSingleDeleteRecord"
      @confirm="confirmSingleDelete"
    />

    <!--
      [DEFAULT] ele(RestoreSystemSourcesDialog)
      - condition:
          默认挂载；restoreDialogVisible 为 true 时显示。
      - type:
          自定义组件
          相对位置: ./RestoreSystemSourcesDialog.vue
      - description:
          已软删除系统源恢复对话框。
      - params:
          -- removedSystemSources：可恢复记录。
      - events:
          @confirm
              - description:
                  用户提交恢复 id 时恢复系统源。
              - methods:
                  confirmRestore(sourceIds)
    -->
    <RestoreSystemSourcesDialog
      :visible.sync="restoreDialogVisible"
      :records="removedSystemSources"
      @confirm="confirmRestore"
    />
  </section>
</template>

<script>
/*
  SourceManagementPanel.vue 模块说明

  - 文件职责:
      组合数据源管理列表、筛选、批量操作和确认流程，并把用户意图委托settingsService。
      页面只维护选择、弹窗、显示顺序和异步门禁，不复制SourceManager领域状态或补偿逻辑。

  - 导入库及文件汇总(9 条，内置 0 条，第三方 0 条，自定义 9 条):
      SourceList、SourceImportDialog、SourceAuthorizationDialog、SourceDisableDialog、SourceDeleteDialog、RestoreSystemSourcesDialog: 自定义组件，组成数据源列表和确认流程。
      SETTINGS_MODULE_ID、SETTINGS_MODULES、SETTINGS_ROUTE_NAME: 自定义配置，提供设置模块定义和路由名称。
      SOURCE_KIND_FILTER、authorizeSource、checkAllSources、clearAllSourceCache、deleteSources、downloadSourceScripts、getRemovedSystemSources、getSourceKindCounts、getSourceManagerState、getSourceRecord、getSourceRecords、getSourceSummary、importCustomSource、isSourceRecordRunnable、requiresSourceAuthorization、restoreSystemSources、setDefaultSource、setSourceEnabled: 自定义服务，统一读写数据源共享状态。
      SOURCE_KIND_FILTER_DEFINITIONS、formatCacheBytes: 自定义工具，提供筛选定义和缓存格式化。

  - 模块级常量:
      FILTER_EMPTY_TEXT: object，三种来源筛选对应的空状态说明。
      DEFAULT_SOURCE_HANDOFF_ACTION: object，默认源交接完成后允许继续执行的动作枚举。
      MESSAGE_BOX_OPTIONS: object，页面确认框统一按钮和视觉配置。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createSourceDisplayOrder(records, defaultSourceId)
          - params:
              -- records: Array<object>，页面加载时全部可见数据源记录。
              -- defaultSourceId: string，页面加载时的默认数据源 id。
          - return:
              Array<string>，默认源优先且其余记录保持原顺序的显示 id 快照。
          - description:
              只在页面加载时生成显示顺序，后续默认源切换不重排当前列表。
      sortRecordsByDisplayOrder(records, sourceDisplayOrderIds)
          - params:
              -- records: Array<object>，当前来源筛选可见记录。
              -- sourceDisplayOrderIds: Array<string>，页面加载时生成的显示顺序快照。
          - return:
              Array<object>，按快照排序且新记录稳定追加的展示记录。
          - description:
              让全部、系统源和自定义源共享同一加载周期行序。

  - 模块级类:
      无

  - 对外导出:
      默认Vue组件配置: object，供设置路由渲染数据源管理页面。
*/

// 导入来源: ./SourceList.vue。
// 导入内容: SourceList 数据源列表组件。
// 文件作用: 展示加载周期内顺序稳定的列表并接收全部行级意图。
import SourceList from './SourceList.vue';
// 导入来源: ./SourceImportDialog.vue。
// 导入内容: SourceImportDialog 数据源导入对话框。
// 文件作用: 在弹窗局部完成三入口输入、静态预览和信任确认。
import SourceImportDialog from './SourceImportDialog.vue';
// 导入来源: ./SourceAuthorizationDialog.vue。
// 导入内容: SourceAuthorizationDialog 运行授权对话框。
// 文件作用: 在启用自定义脚本前获取用户确认。
import SourceAuthorizationDialog from './SourceAuthorizationDialog.vue';
// 导入来源: ./SourceDisableDialog.vue。
// 导入内容: SourceDisableDialog 默认源交接对话框。
// 文件作用: 在关闭或删除默认源前完成用户选择。
import SourceDisableDialog from './SourceDisableDialog.vue';
// 导入来源: ./SourceDeleteDialog.vue。
// 导入内容: SourceDeleteDialog 单项删除确认对话框。
// 文件作用: 说明系统源和自定义源删除差异并获取确认。
import SourceDeleteDialog from './SourceDeleteDialog.vue';
// 导入来源: ./RestoreSystemSourcesDialog.vue。
// 导入内容: RestoreSystemSourcesDialog 系统源恢复对话框。
// 文件作用: 选择恢复软删除系统源。
import RestoreSystemSourcesDialog from './RestoreSystemSourcesDialog.vue';

import {
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_MODULE_ID 设置模块标识。
  // 文件作用: 定位数据源管理模块定义。
  SETTINGS_MODULE_ID,
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_MODULES 设置模块配置数组。
  // 文件作用: 读取数据源管理标题和说明。
  SETTINGS_MODULES,
  // 导入来源: ../../config/settings-module.config。
  // 导入内容: SETTINGS_ROUTE_NAME 设置路由名称。
  // 文件作用: 进入独立数据源详情路由。
  SETTINGS_ROUTE_NAME
} from '../../config/settings-module.config';

import {
  // 导入来源: ../../services/settingsService。
  // 导入内容: SOURCE_KIND_FILTER 来源筛选枚举。
  // 文件作用: 初始化筛选并读取对应记录。
  SOURCE_KIND_FILTER,
  // 导入来源: ../../services/settingsService。
  // 导入内容: authorizeSource 脚本授权服务。
  // 文件作用: 用户确认后写入自定义脚本授权状态。
  authorizeSource,
  // 导入来源: ../../services/settingsService。
  // 导入内容: checkAllSources 全部检测服务。
  // 文件作用: 执行已启用数据源 Mock 健康检测。
  checkAllSources,
  // 导入来源: ../../services/settingsService。
  // 导入内容: clearAllSourceCache 全部缓存清理服务。
  // 文件作用: 行内重置确认后清空目标缓存摘要。
  clearAllSourceCache,
  // 导入来源: ../../services/settingsService。
  // 导入内容: deleteSources 批量删除事务。
  // 文件作用: 统一执行系统软删除、自定义源删除和默认源安全回退。
  deleteSources,
  // 导入来源: ../../services/settingsService。
  // 导入内容: downloadSourceScripts 批量脚本包下载服务。
  // 文件作用: 将所选脚本导出为一个最小 JSON 包。
  downloadSourceScripts,
  // 导入来源: ../../services/settingsService。
  // 导入内容: getRemovedSystemSources 已软删除系统源查询。
  // 文件作用: 驱动恢复按钮和恢复对话框。
  getRemovedSystemSources,
  // 导入来源: ../../services/settingsService。
  // 导入内容: getSourceKindCounts 来源数量查询。
  // 文件作用: 展示筛选按钮数量。
  getSourceKindCounts,
  // 导入来源: ../../services/settingsService。
  // 导入内容: getSourceManagerState 共享状态查询。
  // 文件作用: 建立页面响应式状态依赖。
  getSourceManagerState,
  // 导入来源: ../../services/settingsService。
  // 导入内容: getSourceRecord 单条记录查询。
  // 文件作用: 定位授权、交接、删除和选择记录。
  getSourceRecord,
  // 导入来源: ../../services/settingsService。
  // 导入内容: getSourceRecords 可见记录查询。
  // 文件作用: 按筛选返回权威记录，页面再按加载时顺序快照排列。
  getSourceRecords,
  // 导入来源: ../../services/settingsService。
  // 导入内容: getSourceSummary 摘要查询。
  // 文件作用: 驱动顶部三个摘要 Chip。
  getSourceSummary,
  // 导入来源: ../../services/settingsService。
  // 导入内容: importCustomSource 自定义源导入服务。
  // 文件作用: 提交已确认 SHA-256 的真实动态 Provider 导入请求。
  importCustomSource,
  // 导入来源: ../../services/settingsService。
  // 导入内容: isSourceRecordRunnable 全局可运行资格函数。
  // 文件作用: 默认源交接候选与摘要、列表开关和领域门禁保持一致。
  isSourceRecordRunnable,
  // 导入来源: ../../services/settingsService。
  // 导入内容: requiresSourceAuthorization 授权判断函数。
  // 文件作用: 启用前决定是否先显示风险确认。
  requiresSourceAuthorization,
  // 导入来源: ../../services/settingsService。
  // 导入内容: restoreSystemSources 系统源恢复服务。
  // 文件作用: 恢复用户选择的软删除系统源。
  restoreSystemSources,
  // 导入来源: ../../services/settingsService。
  // 导入内容: setDefaultSource 默认源设置服务。
  // 文件作用: 完成列表互斥默认源切换和交接选择。
  setDefaultSource,
  // 导入来源: ../../services/settingsService。
  // 导入内容: setSourceEnabled 启停服务。
  // 文件作用: 写入授权和交接完成后的启停状态。
  setSourceEnabled
} from '../../services/settingsService';

import {
  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: SOURCE_KIND_FILTER_DEFINITIONS 来源筛选定义。
  // 文件作用: 统一筛选顺序和文案。
  SOURCE_KIND_FILTER_DEFINITIONS,
  // 导入来源: ../../utils/settingsDisplay。
  // 导入内容: formatCacheBytes 缓存格式化函数。
  // 文件作用: 将摘要字节数转换为用户可读 Chip 文案。
  formatCacheBytes
} from '../../utils/settingsDisplay';

// 类型: object。
// 作用: 为三种来源筛选提供可操作空状态，不在模板散落条件文案。
// 字段: all、system、custom，string，对应筛选无记录时的下一步提示。
const FILTER_EMPTY_TEXT = Object.freeze({
  [SOURCE_KIND_FILTER.all]: '暂无数据源，请导入一个自定义数据源',
  [SOURCE_KIND_FILTER.system]: '暂无系统源，可使用“恢复系统源”找回已删除内容',
  [SOURCE_KIND_FILTER.custom]: '暂无自定义源，可通过文件、在线地址或文本导入'
});

// 类型: object。
// 作用: 标识默认源交接完成后继续关闭单源或删除整批，避免散落动作魔法字符串。
// 字段: disableSource，string，交接后关闭当前默认源。
// 字段: deleteSources，string，交接后删除 pendingDeleteSourceIds 整批记录。
const DEFAULT_SOURCE_HANDOFF_ACTION = Object.freeze({
  disableSource: 'disable-source',
  deleteSources: 'delete-sources'
});

// 类型: object。
// 作用: 统一缓存重置和批量删除确认框的按钮与警示视觉。
// 字段: confirmButtonText、cancelButtonText、type，string，Element UI MessageBox 配置。
const MESSAGE_BOX_OPTIONS = Object.freeze({
  confirmButtonText: '确认',
  cancelButtonText: '取消',
  type: 'warning'
});

/**
 * 创建数据源列表显示顺序快照。
 * 纯函数: 返回新 id 数组，不修改 records 或默认源状态。
 * 排序规则: 页面加载时的默认源放在第一项，其余记录保持权威数组相对顺序。
 *
 * @param {Array<object>} records 页面加载时全部可见数据源记录。
 * @param {string} defaultSourceId 页面加载时的默认数据源 id。
 * @returns {Array<string>} 当前页面加载周期使用的数据源显示 id 顺序。
 */
function createSourceDisplayOrder(records, defaultSourceId) {
  // 类型: object|undefined。
  // 作用: 定位页面加载时默认源，决定是否需要放到显示顺序第一项。
  const defaultRecord = records.find(record => record.definition.id === defaultSourceId);

  // 循环类型: Array.prototype.filter + map。
  // 初始值: records 第一条记录。
  // 终止条件: 所有加载时可见记录完成默认源比较和 id 提取。
  // 循环作用: 保留非默认源的权威相对顺序。
  const remainingSourceIds = records
    .filter(record => record.definition.id !== defaultSourceId)
    .map(record => record.definition.id);

  // 条件分支: 页面加载时默认源不在当前可见记录中。
  // 执行内容: 直接返回全部非默认记录 id，避免插入不存在的顺序项。
  if (!defaultRecord) return remainingSourceIds;

  // 返回值类型: Array<string>。
  // 作用: 固定本次页面加载周期的默认源优先显示顺序。
  return [defaultRecord.definition.id, ...remainingSourceIds];
}

/**
 * 按页面加载时快照排列当前筛选记录。
 * 纯函数: 返回新数组，不修改 records 或 sourceDisplayOrderIds。
 * 新记录策略: 页面打开后导入或恢复的记录没有快照位置，按权威数组顺序稳定追加。
 *
 * @param {Array<object>} records 当前来源筛选可见数据源记录。
 * @param {Array<string>} sourceDisplayOrderIds 页面加载时生成的显示顺序快照。
 * @returns {Array<object>} 当前加载周期顺序稳定的展示记录。
 */
function sortRecordsByDisplayOrder(records, sourceDisplayOrderIds) {
  // 类型: Map<string, number>。
  // 作用: 把显示 id 快照转换为稳定排序索引，避免循环中反复执行 indexOf。
  const displayOrderIndex = new Map(
    sourceDisplayOrderIds.map((sourceId, index) => [sourceId, index])
  );

  // 类型: number。
  // 作用: 给快照之外的新记录提供统一基础索引，使它们排在既有记录之后。
  const appendedRecordBaseIndex = sourceDisplayOrderIds.length;

  // 循环类型: Array.prototype.map + sort + map。
  // 初始值: records 第一条记录及其权威数组索引。
  // 终止条件: 所有当前筛选记录完成排序键比较。
  // 循环作用: 已有记录按快照排列，新记录按本次 records 原顺序稳定追加。
  return records
    .map((record, originalIndex) => ({
      // 类型: object。
      // 作用: 保留当前数据源记录引用，排序完成后恢复为展示数组。
      record,
      // 类型: number。
      // 作用: 已有记录读取快照索引，新记录使用追加索引并保留权威相对顺序。
      sortIndex: displayOrderIndex.has(record.definition.id)
        ? displayOrderIndex.get(record.definition.id)
        : appendedRecordBaseIndex + originalIndex
    }))
    .sort((leftItem, rightItem) => leftItem.sortIndex - rightItem.sortIndex)
    .map(item => item.record);
}

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools 和错误堆栈识别数据源管理页。
  name: 'SourceManagementPanel',

  components: {
    // 组件: 数据源列表；作用: 展示记录和发出行级意图。
    SourceList,
    // 组件: 导入对话框；作用: 完成三入口静态预检、风险确认和正式导入请求。
    SourceImportDialog,
    // 组件: 授权对话框；作用: 获取自定义脚本运行确认。
    SourceAuthorizationDialog,
    // 组件: 默认源交接对话框；作用: 关闭或删除默认源前选择后继源。
    SourceDisableDialog,
    // 组件: 删除确认对话框；作用: 确认列表单条删除。
    SourceDeleteDialog,
    // 组件: 系统源恢复对话框；作用: 恢复软删除系统源。
    RestoreSystemSourcesDialog
  },

  /**
   * 创建数据源管理页面局部状态。
   * 选择、显示顺序、对话框和等待动作不写入 SourceManagerState，页面重建后重新初始化。
   * 副作用: Vue实例创建时生成页面局部响应式状态，不修改service或领域保存态。
   *
   * @returns {object} 页面局部响应式状态。
   * @returns {string} return.activeSourceKind 当前来源筛选。
   * @returns {Array<string>} return.selectedSourceIds 跨筛选保留的选择 id。
   * @returns {Array<string>} return.sourceDisplayOrderIds 当前页面加载周期的数据源显示顺序快照。
   * @returns {boolean} return.importDialogVisible 导入弹窗状态。
   * @returns {boolean} return.authorizationDialogVisible 授权弹窗状态。
   * @returns {boolean} return.disableDialogVisible 默认源交接弹窗状态。
   * @returns {boolean} return.deleteDialogVisible 单条删除弹窗状态。
   * @returns {boolean} return.restoreDialogVisible 系统源恢复弹窗状态。
   * @returns {string} return.pendingAuthorizationSourceId 待授权源 id。
   * @returns {string} return.pendingDisableSourceId 待交接默认源 id。
   * @returns {string} return.pendingSingleDeleteSourceId 待单条删除源 id。
   * @returns {Array<string>} return.pendingDeleteSourceIds 待批量删除 id。
   * @returns {string} return.pendingHandoffAction 交接完成后继续动作。
   * @returns {boolean} return.operationPending true 表示一个设置事务尚未收敛，false 允许发起新操作。
   */
  data() {
    return {
      activeSourceKind: SOURCE_KIND_FILTER.all,
      selectedSourceIds: [],
      sourceDisplayOrderIds: [],
      importDialogVisible: false,
      authorizationDialogVisible: false,
      disableDialogVisible: false,
      deleteDialogVisible: false,
      restoreDialogVisible: false,
      pendingAuthorizationSourceId: '',
      pendingDisableSourceId: '',
      pendingSingleDeleteSourceId: '',
      pendingDeleteSourceIds: [],
      pendingHandoffAction: '',
      operationPending: false
    };
  },

  /**
   * 在数据源管理页面创建时固定本次显示顺序。
   * 数据来源: settingsService 当前全部可见记录和当前默认源 id。
   * 副作用: 只写入 sourceDisplayOrderIds 页面局部状态，不改变 records 权威顺序。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   */
  created() {
    this.sourceDisplayOrderIds = createSourceDisplayOrder(
      getSourceRecords(SOURCE_KIND_FILTER.all),
      getSourceManagerState().defaultSourceId
    );
  },

  computed: {
    /**
     * 读取数据源设置模块定义。
     * 数据来源: SETTINGS_MODULES 和 SETTINGS_MODULE_ID.sources。
     * 副作用: 无，只读取冻结配置并返回匹配项。
     *
     * @returns {object} 数据源设置模块标题和说明配置。
     */
    moduleDefinition() {
      return SETTINGS_MODULES.find(moduleItem => moduleItem.id === SETTINGS_MODULE_ID.sources);
    },

    /**
     * 读取唯一响应式数据源管理状态。
     * 数据来源: settingsService 对 settingsStore 的受控读取接口。
     * 副作用: 无，只返回store当前完整投影供模板建立响应依赖。
     *
     * @returns {object} settingsStore 中唯一响应式数据源管理状态。
     */
    managerState() {
      return getSourceManagerState();
    },

    /**
     * 读取来源筛选定义。
     * 数据来源: settingsDisplay 的统一展示配置。
     * 副作用: 无，只返回冻结展示定义。
     *
     * @returns {Array<object>} 全部、系统源和自定义源固定筛选定义。
     */
    filterDefinitions() {
      return SOURCE_KIND_FILTER_DEFINITIONS;
    },

    /**
     * 读取当前筛选展示记录。
     * 数据来源: activeSourceKind、settingsService 共享状态和 sourceDisplayOrderIds 加载快照。
     * 默认源切换只改变状态，不改变当前页面加载周期的记录位置。
     * 副作用: 无，只创建当前筛选的排序结果数组。
     *
     * @returns {Array<object>} 当前筛选可见且按加载快照稳定排列的数据源记录。
     */
    filteredRecords() {
      return sortRecordsByDisplayOrder(
        getSourceRecords(this.activeSourceKind),
        this.sourceDisplayOrderIds
      );
    },

    /**
     * 读取来源分类数量。
     * 数据来源: settingsService 当前可见记录。
     * 副作用: 无，只从当前投影派生分类计数。
     *
     * @returns {object} 三种来源筛选对应的当前可见数量。
     */
    sourceKindCounts() {
      return getSourceKindCounts();
    },

    /**
     * 读取数据源管理摘要。
     * 数据来源: settingsService 对共享状态的集中聚合。
     * 副作用: 无，只从当前投影派生摘要对象。
     *
     * @returns {object} 已启用数量、可运行数量、总数、默认源和缓存摘要。
     */
    summary() {
      return getSourceSummary();
    },

    /**
     * 读取当前默认源名称。
     * 数据来源: summary.defaultSource。
     * 副作用: 无，只返回展示文本。
     *
     * @returns {string} 当前默认源名称；没有默认源时返回明确空状态。
     */
    defaultSourceName() {
      return this.summary.defaultSource ? this.summary.defaultSource.definition.name : '暂未设置';
    },

    /**
     * 格式化全部数据源缓存摘要。
     * 数据来源: summary.totalCacheBytes。
     * 副作用: 无，只格式化当前字节数。
     *
     * @returns {string} 全部数据源缓存用户可读容量。
     */
    totalCacheText() {
      return formatCacheBytes(this.summary.totalCacheBytes);
    },

    /**
     * 读取当前筛选空状态说明。
     * 数据来源: activeSourceKind 和 FILTER_EMPTY_TEXT。
     * 副作用: 无，只读取冻结文案映射。
     *
     * @returns {string} 当前筛选无记录时的下一步说明。
     */
    emptyDescription() {
      return FILTER_EMPTY_TEXT[this.activeSourceKind] || FILTER_EMPTY_TEXT[SOURCE_KIND_FILTER.all];
    },

    /**
     * 计算页面当前选择数量。
     * 数据来源: selectedSourceIds 页面局部状态。
     * 副作用: 无，只读取数组长度。
     *
     * @returns {number} 页面跨筛选选择的数据源数量。
     */
    selectedCount() {
      return this.selectedSourceIds.length;
    },

    /**
     * 读取当前仍存在的所选记录。
     * 数据来源: selectedSourceIds 和 settingsService 共享状态。
     * 副作用: 无，只生成剔除失效id的新数组。
     *
     * @returns {Array<object>} 去除已删除或失效 id 后的所选记录。
     */
    selectedRecords() {
      return this.selectedSourceIds
        .map(sourceId => getSourceRecord(sourceId))
        .filter(record => Boolean(record));
    },

    /**
     * 读取等待授权的数据源记录。
     * 数据来源: pendingAuthorizationSourceId 和共享记录集合。
     * 副作用: 无，只定位当前投影记录。
     *
     * @returns {object|null} 当前等待授权的数据源记录。
     */
    pendingAuthorizationRecord() {
      return getSourceRecord(this.pendingAuthorizationSourceId);
    },

    /**
     * 读取等待默认源交接的数据源记录。
     * 数据来源: pendingDisableSourceId 和共享记录集合。
     * 副作用: 无，只定位当前投影记录。
     *
     * @returns {object|null} 当前等待默认源交接的记录。
     */
    pendingDisableRecord() {
      return getSourceRecord(this.pendingDisableSourceId);
    },

    /**
     * 读取等待单条删除确认的数据源记录。
     * 数据来源: pendingSingleDeleteSourceId 和共享记录集合。
     * 副作用: 无，只定位当前投影记录。
     *
     * @returns {object|null} 当前等待单条删除确认的数据源记录。
     */
    pendingSingleDeleteRecord() {
      return getSourceRecord(this.pendingSingleDeleteSourceId);
    },

    /**
     * 计算默认源交接候选记录。
     * 批量删除时排除整批待删除 id，关闭单源时只排除当前默认源。
     * 副作用: 无，只生成当前操作允许选择的候选数组。
     *
     * @returns {Array<object>} 具备全局可运行资格且不属于当前操作目标的候选源。
     */
    fallbackRecords() {
      // 类型: Array<string>。
      // 作用: 保存当前关闭或删除动作必须排除的全部sourceId。
      const excludedSourceIds = this.pendingHandoffAction === DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources
        ? this.pendingDeleteSourceIds
        : [this.pendingDisableSourceId];
      // 类型: Set<string>。
      // 作用: 为候选过滤提供整批排除集合，避免默认源接替到本次删除目标。
      const excludedSourceIdSet = new Set(excludedSourceIds);
      return getSourceRecords(SOURCE_KIND_FILTER.all).filter((record) => {
        // 返回值类型: boolean。
        // 作用: 同时排除当前操作目标和不可运行记录，避免默认源交接采用未接入 Provider 的管理记录。
        return !excludedSourceIdSet.has(record.definition.id) && isSourceRecordRunnable(record);
      });
    },

    /**
     * 读取已软删除系统源记录。
     * 数据来源: settingsService 对 removedSystemSourceIds 的派生查询。
     * 副作用: 无，只读取当前可恢复记录数组。
     *
     * @returns {Array<object>} 当前可通过恢复对话框找回的系统源记录。
     */
    removedSystemSources() {
      return getRemovedSystemSources();
    },

    /**
     * 读取默认源交接操作说明。
     * 数据来源: pendingHandoffAction 页面局部动作枚举。
     * 副作用: 无，只返回当前动作对应文案。
     *
     * @returns {string} 默认源交接弹窗针对当前动作的说明。
     */
    handoffOperationDescription() {
      return this.pendingHandoffAction === DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources
        ? '删除范围包含当前默认源，继续前需要选择新的默认数据源。'
        : '关闭该数据源前需要选择新的默认数据源。';
    },

    /**
     * 读取默认源交接确认按钮文案。
     * 数据来源: pendingHandoffAction 页面局部动作枚举。
     * 副作用: 无，只返回当前动作对应按钮文案。
     *
     * @returns {string} 默认源交接确认按钮针对当前动作的文案。
     */
    handoffConfirmLabel() {
      return this.pendingHandoffAction === DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources
        ? '继续删除'
        : '关闭数据源';
    }
  },

  methods: {
    /**
     * 执行一个页面设置异步操作并统一收敛交互状态。
     * 调用方: 本容器所有会触发settingsService异步副作用的方法。
     * 成功路径: 等待操作完成并返回结果；失败路径: 展示业务上下文和原始错误摘要，不继续显示成功反馈。
     * 副作用: operationPending为true时页面显示Element UI加载门禁，finally始终恢复为false。
     *
     * @param {Function} operation 无参数异步操作，返回settingsService Promise。
     * @param {string} failureMessage 当前用户动作失败时的上下文文案。
     * @returns {Promise<{completed: boolean, result: *}>} completed表示操作是否成功收敛，result保存成功返回值。
     */
    async executeSettingsOperation(operation, failureMessage) {
      // 条件分支: 已有设置事务尚未收敛时拒绝重复提交。
      // 执行内容: 返回未完成结果，不创建第二个页面操作或覆盖当前loading状态。
      if (this.operationPending) return { completed: false, result: null };

      // 页面局部副作用: 打开根容器加载门禁，阻止连续点击产生并发页面意图。
      this.operationPending = true;
      try {
        // 类型: *。
        // 作用: 保存Runtime事务、Host补偿和store投影发布全部完成后的service结果。
        const result = await operation();
        return { completed: true, result };
      } catch (error) {
        // 类型: string。
        // 作用: Error提供具体领域消息时附加到用户动作上下文；未知拒绝值不直接序列化到页面。
        const errorDetail = error instanceof Error && error.message ? `：${error.message}` : '';
        this.$message.error(`${failureMessage}${errorDetail}`);
        return { completed: false, result: null };
      } finally {
        // finally副作用: 无论成功或失败都恢复交互，避免页面永久停留在loading状态。
        this.operationPending = false;
      }
    },

    /**
     * 切换当前来源筛选。
     * 选择状态不随筛选清空，使用户可以跨分类组合批量操作目标。
     * 副作用: 只更新activeSourceKind页面局部状态并触发列表重算。
     *
     * @param {string} sourceKindFilter 目标来源筛选值。
     * @returns {void} 只修改页面局部筛选状态。
     */
    selectSourceKind(sourceKindFilter) {
      this.activeSourceKind = sourceKindFilter;
    },

    /**
     * 合并单条数据源选择状态。
     * 副作用: 用新数组替换selectedSourceIds，不修改SourceManagerState。
     *
     * @param {object} payload 选择事件参数。
     * @param {string} payload.sourceId 目标数据源 id。
     * @param {boolean} payload.selected true 加入选择，false 移出选择。
     * @returns {void} 更新页面局部选择数组。
     */
    toggleSourceSelection(payload) {
      // 类型: Set<string>。
      // 作用: 从现有选择创建去重集合，供本次单项选择原子替换页面数组。
      const selectedSourceIdSet = new Set(this.selectedSourceIds);
      // 条件分支: payload.selected为true时加入目标，为false时移除目标。
      // 执行内容: 只修改局部集合，随后一次性替换selectedSourceIds。
      if (payload.selected) selectedSourceIdSet.add(payload.sourceId);
      else selectedSourceIdSet.delete(payload.sourceId);
      this.selectedSourceIds = Array.from(selectedSourceIdSet);
    },

    /**
     * 合并当前筛选全选状态。
     * 未显示筛选中的既有选择保持不变。
     * 副作用: 用新数组替换selectedSourceIds，不修改其他筛选选择。
     *
     * @param {object} payload 全选事件参数。
     * @param {Array<string>} payload.sourceIds 当前筛选可见 id。
     * @param {boolean} payload.selected true 全选当前筛选，false 取消当前筛选。
     * @returns {void} 更新页面局部选择数组。
     */
    toggleSelectAll(payload) {
      // 类型: Set<string>。
      // 作用: 保存跨筛选选择集合，让当前筛选全选不清空其他筛选结果。
      const selectedSourceIdSet = new Set(this.selectedSourceIds);
      payload.sourceIds.forEach((sourceId) => {
        // 条件分支: payload.selected为true时加入当前筛选id，为false时移除。
        // 执行内容: 逐项合并当前筛选，不触碰集合中的其他筛选id。
        if (payload.selected) selectedSourceIdSet.add(sourceId);
        else selectedSourceIdSet.delete(sourceId);
      });
      this.selectedSourceIds = Array.from(selectedSourceIdSet);
    },

    /**
     * 打开数据源详情路由。
     * 副作用: 通过Vue Router更新浏览器路由和设置工作区内容。
     *
     * @param {string} sourceId 目标数据源 id。
     * @returns {void} 通过 Vue Router 执行页面导航。
     */
    openSourceDetail(sourceId) {
      this.$router.push({ name: SETTINGS_ROUTE_NAME.sourceDetail, params: { sourceId } });
    },

    /**
     * 从列表快速设置默认源。
     * 成功后只更新默认源开关和摘要；当前页面列表位置保持不变，下一次页面加载再生成新顺序。
     * 副作用: 通过service提交默认源事务，并显示成功、警告或错误反馈。
     * 成功路径: Runtime完成后显示成功；目标不可选时显示警告。
     * 失败路径: 执行器显示错误并恢复loading，不显示成功反馈。
     *
     * @param {string} sourceId 目标已启用数据源 id。
     * @returns {Promise<void>} 默认源事务和用户反馈收敛后兑现。
     */
    async handleSetDefaultFromList(sourceId) {
      // 类型: {completed: boolean, result: boolean|null}。
      // 作用: 保存默认源事务是否完成及service返回的可选性结果。
      const operationResult = await this.executeSettingsOperation(
        () => setDefaultSource(sourceId),
        '默认数据源切换失败'
      );
      // 条件分支: Runtime事务失败或已有操作阻止本次提交时退出。
      // 执行内容: 错误已由执行器反馈，不再显示成功或警告。
      if (!operationResult.completed) return;
      // 条件分支: service确认目标不存在或未启用时进入。
      // 执行内容: 显示可操作警告，不误报默认源已切换。
      if (!operationResult.result) {
        this.$message.warning('请先启用该数据源，再设置为默认源');
        return;
      }
      this.$message.success('默认数据源已切换，当前列表顺序保持不变');
    },

    /**
     * 处理列表启停意图。
     * 待授权自定义源先进入授权弹窗；关闭默认源先进入交接弹窗；其他记录直接写入启停状态。
     * 副作用: 打开页面弹窗，或通过service提交启停事务并显示反馈。
     * 成功路径: 需要确认时保存局部流程状态，直接路径等待Runtime完成。
     * 失败路径: 记录不存在时退出；Runtime失败由执行器显示错误并恢复loading。
     *
     * @param {object} payload 启停参数。
     * @param {string} payload.sourceId 数据源 id。
     * @param {boolean} payload.enabled 目标启用状态。
     * @returns {Promise<void>} 直接启停路径完成后兑现；需要确认时只打开对应弹窗。
     */
    async handleToggleSource(payload) {
      // 类型: object|null。
      // 作用: 从当前投影定位启停目标，决定授权和默认源交接分支。
      const record = getSourceRecord(payload.sourceId);
      // 条件分支: 目标已不在当前投影时退出。
      // 执行内容: 不打开空弹窗，也不提交未知sourceId。
      if (!record) return;
      // 条件分支: 用户启用尚未获得有效授权的自定义源时进入。
      // 执行内容: 保存授权目标并打开风险确认弹窗，不提前修改领域状态。
      if (payload.enabled && requiresSourceAuthorization(record)) {
        this.pendingAuthorizationSourceId = payload.sourceId;
        this.authorizationDialogVisible = true;
        return;
      }
      // 条件分支: 用户关闭当前默认源时进入。
      // 执行内容: 保存交接动作并打开候选选择弹窗，不先切换默认源。
      if (!payload.enabled && this.managerState.defaultSourceId === payload.sourceId) {
        this.pendingDisableSourceId = payload.sourceId;
        this.pendingHandoffAction = DEFAULT_SOURCE_HANDOFF_ACTION.disableSource;
        this.disableDialogVisible = true;
        return;
      }
      // 类型: {completed: boolean, result: object|null}。
      // 作用: 保存直接启停事务结果，决定是否显示成功反馈。
      const operationResult = await this.executeSettingsOperation(
        () => setSourceEnabled(payload.sourceId, payload.enabled),
        payload.enabled ? '数据源启用失败' : '数据源关闭失败'
      );
      // 条件分支: Runtime事务未成功收敛时退出。
      // 执行内容: 保留执行器错误反馈，不显示成功。
      if (!operationResult.completed) return;
      this.$message.success(payload.enabled ? '数据源已启用' : '数据源已关闭');
    },

    /**
     * 完成自定义脚本授权并启用数据源。
     * 副作用: 通过service提交一次授权并启用事务，finally清理待授权id。
     * 成功路径: Runtime完整收敛后显示成功。
     * 失败路径: 执行器显示错误，不显示成功，finally仍恢复局部流程状态。
     *
     * @param {string} sourceId 用户确认授权的数据源 id。
     * @returns {Promise<void>} 原子授权启用事务和局部状态清理完成后兑现。
     */
    async confirmAuthorization(sourceId) {
      try {
        // 类型: {completed: boolean, result: object|null}。
        // 作用: 保存原子授权启用事务结果，决定是否显示成功反馈。
        const operationResult = await this.executeSettingsOperation(
          () => authorizeSource(sourceId, true),
          '自定义数据源授权启用失败'
        );
        // 条件分支: Runtime授权和启用完整成功时进入。
        // 执行内容: 只在最终投影收敛后显示成功反馈。
        if (operationResult.completed) {
          this.$message.success('已授权并启用该自定义数据源');
        }
      } finally {
        // finally副作用: 对话框确认后始终清空待授权id，失败时不会残留过期页面流程状态。
        this.pendingAuthorizationSourceId = '';
      }
    },

    /**
     * 完成默认源交接并继续原操作。
     * 删除动作执行整批事务；关闭动作只关闭弹窗指定默认源。
     * 副作用: 通过service提交包含replace或clear的原子事务，finally清理交接状态。
     * 成功路径: Runtime完成删除或关闭后显示对应反馈。
     * 失败路径: 执行器显示错误，不显示成功，finally仍清除过期待处理动作。
     *
     * @param {object} payload 交接参数。
     * @param {string} payload.sourceId 原默认源 id。
     * @param {string} payload.fallbackSourceId 用户选择的新默认源 id；无候选时为空。
     * @returns {Promise<void>} 默认源原子交接和待执行动作收敛后兑现。
     */
    async confirmDefaultSourceHandoff(payload) {
      try {
        // 条件分支: 待继续动作是整批删除时进入。
        // 执行内容: 将用户选择作为同一删除命令的handoff提交，不先切默认源。
        if (this.pendingHandoffAction === DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources) {
          await this.performDeleteSources(this.pendingDeleteSourceIds, payload.fallbackSourceId);
          return;
        }

        // 类型: {completed: boolean, result: object|null}。
        // 作用: 保存关闭默认源及原子交接的最终执行结果。
        const operationResult = await this.executeSettingsOperation(
          () => setSourceEnabled(payload.sourceId, false, payload.fallbackSourceId),
          '默认数据源关闭失败'
        );
        // 条件分支: 关闭和交接均成功时进入。
        // 执行内容: 显示成功；失败反馈由执行器负责。
        if (operationResult.completed) this.$message.success('数据源已关闭');
      } finally {
        // finally副作用: 原子交接成功或失败后都清理待处理动作，避免重复确认旧事务。
        this.resetHandoffState();
      }
    },

    /**
     * 清空默认源交接页面局部状态。
     * 副作用: 清空待交接id、删除集合、动作枚举并关闭交接弹窗。
     *
     * @returns {void} 不修改共享数据源记录。
     */
    resetHandoffState() {
      this.pendingDisableSourceId = '';
      this.pendingDeleteSourceIds = [];
      this.pendingHandoffAction = '';
      this.disableDialogVisible = false;
    },

    /**
     * 执行全部已启用数据源 Mock 检测。
     * 副作用: 通过service提交检测意图，并显示成功或错误反馈。
     * 成功路径: 全部检测和投影发布完成后显示成功。
     * 失败路径: 执行器显示错误并恢复loading，不显示成功。
     *
     * @returns {Promise<void>} 检测完成后显示成功反馈。
     */
    async handleCheckAll() {
      // 类型: {completed: boolean, result: Array<object>|null}。
      // 作用: 保存全量检测事务完成状态和最终启用记录结果。
      const operationResult = await this.executeSettingsOperation(
        () => checkAllSources(),
        '全部数据源检测失败'
      );
      // 条件分支: 全部检测成功收敛时进入。
      // 执行内容: 显示成功；失败时沿用执行器错误反馈。
      if (operationResult.completed) this.$message.success('已完成全部已启用数据源检测');
    },

    /**
     * 导入用户已经预检并确认信任的动态 Provider，并切换到自定义源筛选。
     * 副作用: service 重新读取、执行、注册和保存；成功后切换筛选并显示真实启用结果。
     * 成功路径: Runtime 返回新增记录后采用 manifest 名称和最终 enabled 状态生成反馈。
     * 失败路径: 执行器显示错误并保留原筛选。
     *
     * @param {object} request 导入对话框提交的原始输入和 trustDecision。
     * @returns {Promise<void>} 导入事务和反馈收敛后兑现。
     */
    async handleImport(request) {
      // 类型: {completed: boolean, result: object|null}。
      // 作用: 保存导入事务完成状态和新增SourceRecord。
      const operationResult = await this.executeSettingsOperation(
        () => importCustomSource(request),
        '数据源导入失败'
      );
      // 条件分支: 输入校验或Runtime事务失败时退出。
      // 执行内容: 保留原筛选并使用执行器错误反馈。
      if (!operationResult.completed) return;

      // 类型: object。
      // 作用: 保存Runtime最终投影中的新增记录，供筛选切换和成功文案使用。
      const importedRecord = operationResult.result;
      // 类型: string。
      // 作用: 依据 Manager 最终有效启用状态说明本次导入是否已经启动，不能从用户开关输入推断。
      const enabledMessage = importedRecord.runtime.enabled === true
        ? '并已启用'
        : '并保持关闭';
      this.activeSourceKind = SOURCE_KIND_FILTER.custom;
      this.$message.success(`已导入“${importedRecord.definition.name}”，${enabledMessage}`);
    },

    /**
     * 批量导出所选数据源脚本。
     * 导出包只包含结构版本、导出时间和每条脚本最小身份、版本与内容。
     * 副作用: service创建一次浏览器下载；页面显示成功、警告或错误反馈。
     * 成功路径: 实际导出数量大于零时显示成功，否则显示选择警告。
     * 失败路径: Runtime读取或浏览器下载失败由执行器显示错误。
     *
     * @returns {Promise<void>} Runtime读取和浏览器下载完成后兑现。
     */
    async handleBatchExport() {
      // 类型: {completed: boolean, result: number|null}。
      // 作用: 保存浏览器导出是否完成及实际脚本数量。
      const operationResult = await this.executeSettingsOperation(
        () => downloadSourceScripts(this.selectedSourceIds),
        '数据源批量导出失败'
      );
      // 条件分支: Runtime读取或浏览器下载失败时退出。
      // 执行内容: 不显示成功或选择警告，保留执行器错误反馈。
      if (!operationResult.completed) return;

      // 类型: number。
      // 作用: 保存实际进入下载包的脚本数量，生成准确用户反馈。
      const exportedCount = operationResult.result;
      // 条件分支: 当前选择已经全部失效，没有可导出脚本时进入。
      // 执行内容: 显示选择警告，不误报导出成功。
      if (!exportedCount) {
        this.$message.warning('请选择仍然存在的数据源后再导出');
        return;
      }
      this.$message.success(`已导出 ${exportedCount} 个数据源脚本`);
    },

    /**
     * 确认批量删除所选数据源。
     * 包含默认源时确认后进入默认源交接，不包含时直接执行统一批量事务。
     * 副作用: 打开Element UI确认框，确认后进入删除或交接流程。
     * 成功路径: 用户确认后等待后续流程；取消时不修改状态。
     * 失败路径: 确认框取消按正常退出处理，删除失败由后续执行器反馈。
     *
     * @returns {Promise<void>} 用户确认或取消后完成；取消不修改任何状态。
     */
    async handleBatchDelete() {
      // 类型: Array<string>。
      // 作用: 从当前仍存在的选择记录提取本次确认和事务使用的稳定id集合。
      const sourceIds = this.selectedRecords.map(record => record.definition.id);
      // 条件分支: 当前没有任何有效选择时进入。
      // 执行内容: 显示警告并停止，不打开空删除确认框。
      if (!sourceIds.length) {
        this.$message.warning('请选择仍然存在的数据源后再删除');
        return;
      }
      try {
        await this.$confirm(`确定删除已选择的 ${sourceIds.length} 个数据源吗？`, '批量删除数据源', MESSAGE_BOX_OPTIONS);
      } catch (error) {
        return;
      }
      await this.startDeleteFlow(sourceIds);
    },

    /**
     * 打开列表单条删除确认弹窗。
     * 副作用: 保存待删除id并显示SourceDeleteDialog。
     *
     * @param {string} sourceId 待删除数据源 id。
     * @returns {void} 只设置页面局部弹窗状态。
     */
    handleDeleteSource(sourceId) {
      this.pendingSingleDeleteSourceId = sourceId;
      this.deleteDialogVisible = true;
    },

    /**
     * 继续已确认的单条删除流程。
     * 副作用: 进入删除或交接流程，finally清空单条待删除id。
     * 成功路径: 后续流程打开交接弹窗或完成删除事务。
     * 失败路径: 执行器显示错误，finally仍清除过期弹窗目标。
     *
     * @param {string} sourceId 用户确认删除的数据源 id。
     * @returns {Promise<void>} 删除流程进入交接或完成事务后兑现。
     */
    async confirmSingleDelete(sourceId) {
      try {
        await this.startDeleteFlow([sourceId]);
      } finally {
        // finally副作用: 单条确认弹窗关闭后清空目标，避免失败后详情指向过期记录。
        this.pendingSingleDeleteSourceId = '';
      }
    },

    /**
     * 按默认源边界启动删除流程。
     * 副作用: 包含默认源时保存交接状态，否则调用统一删除事务。
     * 成功路径: 打开交接弹窗或等待删除完成。
     * 失败路径: 直接删除失败由执行器反馈；本方法不复制补偿。
     *
     * @param {Array<string>} sourceIds 已经获得用户确认的删除 id。
     * @returns {Promise<void>} 打开交接弹窗时立即兑现，直接删除时等待事务完成。
     */
    async startDeleteFlow(sourceIds) {
      // 类型: boolean。
      // 作用: 标识整批目标是否包含当前默认源，决定是否需要用户明确交接。
      const containsDefaultSource = sourceIds.includes(this.managerState.defaultSourceId);
      // 条件分支: 删除集合包含当前默认源时进入。
      // 执行内容: 保存整批目标并打开交接弹窗，不提前执行删除。
      if (containsDefaultSource) {
        this.pendingDeleteSourceIds = sourceIds.slice();
        this.pendingDisableSourceId = this.managerState.defaultSourceId;
        this.pendingHandoffAction = DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources;
        this.disableDialogVisible = true;
        return;
      }
      await this.performDeleteSources(sourceIds);
    },

    /**
     * 执行统一批量删除事务并清理页面选择状态。
     * 副作用: 通过service提交原子删除；成功后移除选择并显示反馈。
     * 成功路径: Runtime完成后只清理真实目标选择。
     * 失败路径: 执行器显示错误并保留选择，便于用户重试。
     *
     * @param {Array<string>} sourceIds 待删除数据源 id。
     * @param {string|undefined} fallbackSourceId 包含默认源时的用户接替选择；空字符串表示接受无默认源。
     * @returns {Promise<void>} Runtime删除事务、选择清理和反馈完成后兑现。
     */
    async performDeleteSources(sourceIds, fallbackSourceId) {
      // 类型: {completed: boolean, result: object|null}。
      // 作用: 保存原子删除和默认源交接事务的最终计数结果。
      const operationResult = await this.executeSettingsOperation(
        () => deleteSources(sourceIds, fallbackSourceId),
        '数据源删除失败'
      );
      // 条件分支: Runtime删除或Host补偿失败时退出。
      // 执行内容: 保留选择供重试，不显示成功。
      if (!operationResult.completed) return;

      // 类型: Set<string>。
      // 作用: 只在Runtime成功后移除已删除选择，失败时保留选择供用户重试。
      const deletedSourceIdSet = new Set(sourceIds);
      this.selectedSourceIds = this.selectedSourceIds
        .filter(sourceId => !deletedSourceIdSet.has(sourceId));
      this.$message.success(`已删除 ${operationResult.result.deletedCount} 个数据源`);
    },

    /**
     * 确认重置单个数据源全部缓存。
     * 清理不修改脚本、授权、启用状态或默认源。
     * 副作用: 打开确认框，确认后通过service清理全部运行缓存并显示反馈。
     * 成功路径: Runtime清理和Host恢复完成后显示成功。
     * 失败路径: 用户取消时退出；Runtime失败由执行器显示错误。
     *
     * @param {string} sourceId 待重置缓存的数据源 id。
     * @returns {Promise<void>} 用户确认或取消后完成。
     */
    async handleResetSource(sourceId) {
      // 类型: object|null。
      // 作用: 定位当前重置目标并读取确认框展示名称。
      const record = getSourceRecord(sourceId);
      // 条件分支: 目标已不存在时退出。
      // 执行内容: 不打开确认框，也不创建未知缓存空间。
      if (!record) return;
      try {
        await this.$confirm(`确定清空“${record.definition.name}”的全部缓存吗？`, '重置数据源缓存', MESSAGE_BOX_OPTIONS);
      } catch (error) {
        return;
      }
      // 类型: {completed: boolean, result: boolean|null}。
      // 作用: 保存全部缓存清理和Host恢复是否成功完成。
      const operationResult = await this.executeSettingsOperation(
        () => clearAllSourceCache(sourceId),
        '数据源缓存重置失败'
      );
      // 条件分支: 清理事务成功时进入。
      // 执行内容: 显示成功；失败时只保留执行器错误反馈。
      if (operationResult.completed) this.$message.success('数据源全部缓存已清空');
    },

    /**
     * 恢复用户选择的系统源。
     * 副作用: 通过service恢复软隐藏记录并显示反馈。
     * 成功路径: Runtime完成后显示实际恢复数量。
     * 失败路径: 执行器显示错误并恢复loading。
     *
     * @param {Array<string>} sourceIds 待恢复系统源 id。
     * @returns {Promise<void>} 恢复事务和反馈收敛后兑现。
     */
    async confirmRestore(sourceIds) {
      // 类型: {completed: boolean, result: number|null}。
      // 作用: 保存系统源恢复事务状态和实际恢复数量。
      const operationResult = await this.executeSettingsOperation(
        () => restoreSystemSources(sourceIds),
        '系统数据源恢复失败'
      );
      // 条件分支: Runtime恢复和可信Host收敛成功时进入。
      // 执行内容: 显示实际恢复数量；失败时不显示成功。
      if (operationResult.completed) {
        this.$message.success(`已恢复 ${operationResult.result} 个系统源`);
      }
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 数据源管理页面 `.source-management`。
  样式作用:
  以统一垂直节奏排列标题、摘要、工具栏和列表。
*/
.source-management {
  /* 使用网格建立稳定纵向结构。 */
  display: grid;
  /* 统一页面主要区块间距。 */
  gap: 16px;
  /* 允许内部列表在设置工作区内收缩。 */
  min-width: 0;
}

/*
  作用容器: 页面头部 `.source-management__header`。
  样式作用:
  桌面并排放置说明和全局操作。
*/
.source-management__header {
  /* 使用弹性布局组织左右区域。 */
  display: flex;
  /* 将全局操作推到右侧。 */
  justify-content: space-between;
  /* 从顶部对齐多行说明与按钮。 */
  align-items: flex-start;
  /* 保留说明与操作之间的间距。 */
  gap: 16px;
}

/*
  作用容器: 页面标题说明区 `.source-management__heading`。
  样式作用:
  占用剩余宽度并允许长说明收缩。
*/
.source-management__heading {
  /* 占用按钮之外剩余空间。 */
  flex: 1;
  /* 允许长文本在容器内换行。 */
  min-width: 0;
}

/*
  作用容器: 页面主标题 `.source-management__title`。
  样式作用:
  建立数据源管理页面最高文字层级。
*/
.source-management__title {
  /* 清除标题默认外边距。 */
  margin: 0;
  /* 使用页面级标题字号。 */
  font-size: 24px;
  /* 强化页面标题。 */
  font-weight: 700;
  /* 使用主题主文本色。 */
  color: var(--text-primary);
}

/*
  作用容器: 页面说明 `.source-management__description`。
  样式作用:
  说明管理能力和 Mock 内存边界。
*/
.source-management__description {
  /* 在标题下方保留说明间距。 */
  margin: 8px 0 0;
  /* 使用弱文本色降低说明层级。 */
  color: var(--text-muted);
  /* 提高多行说明可读性。 */
  line-height: 1.7;
}

/*
  作用容器: 全局操作区 `.source-management__actions`。
  样式作用:
  桌面靠右排列检测、恢复和导入按钮，空间不足时换行。
*/
.source-management__actions {
  /* 使用弹性布局排列按钮。 */
  display: flex;
  /* 允许窄宽度自然换行。 */
  flex-wrap: wrap;
  /* 统一按钮间距。 */
  gap: 8px;
  /* 桌面靠右对齐操作。 */
  justify-content: flex-end;
}

/*
  作用容器: 摘要面板 `.source-management__summary`。
  样式作用:
  四列展示启用数量、可运行数量、默认源和缓存 Chip。
*/
.source-management__summary {
  /* 使用四列等宽网格。 */
  display: grid;
  /* 每项允许收缩，防止默认源名称撑出页面。 */
  grid-template-columns: repeat(4, minmax(0, 1fr));
  /* 清除 dl 默认外边距。 */
  margin: 0;
  /* 提供摘要面板内边距。 */
  padding: 16px 18px;
}

/*
  作用容器: 单个摘要项 `.source-management__summary-item`。
  样式作用:
  纵向排列字段名称和 Chip，并用边框分隔相邻摘要。
*/
.source-management__summary-item {
  /* 使用网格建立标签和 Chip 两行结构。 */
  display: grid;
  /* 保留标签与 Chip 间距。 */
  gap: 6px;
  /* 保留分隔线两侧空间。 */
  padding: 0 18px;
  /* 分隔相邻摘要项。 */
  border-right: 1px solid var(--border-color);
  /* 允许 Chip 在当前列内收缩。 */
  min-width: 0;
}

/*
  作用容器: 第一个摘要项。
  样式作用:
  与面板左内边距对齐。
*/
.source-management__summary-item:first-child {
  /* 清除重复左内边距。 */
  padding-left: 0;
}

/*
  作用容器: 最后一个摘要项。
  样式作用:
  移除末尾分隔线并与面板右侧对齐。
*/
.source-management__summary-item:last-child {
  /* 末项不绘制右分隔线。 */
  border-right: 0;
  /* 清除重复右内边距。 */
  padding-right: 0;
}

/*
  作用容器: 摘要字段名称。
  样式作用:
  使用小号弱文本说明 Chip 含义。
*/
.source-management__summary-item dt {
  /* 使用辅助字号。 */
  font-size: 12px;
  /* 使用主题弱文本色。 */
  color: var(--text-muted);
}

/*
  作用容器: 摘要字段值。
  样式作用:
  清除默认边距并限制长 Chip 不溢出。
*/
.source-management__summary-item dd {
  /* 清除 dd 默认外边距。 */
  margin: 0;
  /* 隐藏超出摘要列的内容。 */
  overflow: hidden;
}

/*
  作用容器: 摘要字段内 Element UI Chip。
  样式作用:
  限制长默认源名称并显示省略号。
*/
.source-management__summary-item dd > .el-tag {
  /* 不超过当前摘要列宽。 */
  max-width: 100%;
  /* 隐藏 Chip 内超长文字。 */
  overflow: hidden;
  /* 使用省略号表示剩余内容。 */
  text-overflow: ellipsis;
}

/*
  作用容器: 筛选与批量工具栏 `.source-management__toolbar`。
  样式作用:
  桌面左右排列筛选和批量操作，空间不足时自然换行。
*/
.source-management__toolbar {
  /* 使用弹性布局建立左右工具区。 */
  display: flex;
  /* 左右区分别贴近两侧。 */
  justify-content: space-between;
  /* 让不同高度控件垂直居中。 */
  align-items: center;
  /* 允许窄宽度换行。 */
  flex-wrap: wrap;
  /* 保留左右区换行后的间距。 */
  gap: 10px;
}

/*
  作用容器: 来源筛选区 `.source-management__filters`。
  样式作用:
  并排展示全部、系统源和自定义源切换。
*/
.source-management__filters {
  /* 使用弹性布局排列筛选按钮。 */
  display: flex;
  /* 允许极窄视口换行。 */
  flex-wrap: wrap;
  /* 统一筛选按钮间距。 */
  gap: 8px;
}

/*
  作用容器: 来源筛选按钮 `.source-management__filter`。
  样式作用:
  使用紧凑胶囊入口展示筛选名称和数量。
*/
.source-management__filter {
  /* 使用行内弹性布局排列文案和数量。 */
  display: inline-flex;
  /* 垂直居中筛选内容。 */
  align-items: center;
  /* 保留文案和数量间距。 */
  gap: 7px;
  /* 使用主题边框定义按钮边界。 */
  border: 1px solid var(--border-color);
  /* 使用主题表面背景。 */
  background: var(--surface);
  /* 提供紧凑点击区域。 */
  padding: 8px 13px;
  /* 使用柔和圆角与设置页控件一致。 */
  border-radius: 9px;
  /* 使用主题次级文本色。 */
  color: var(--text-secondary);
  /* 提示按钮可点击。 */
  cursor: pointer;
}

/*
  作用容器: 当前激活来源筛选。
  样式作用:
  使用主题强调色说明当前列表范围。
*/
.source-management__filter--active {
  /* 强调当前筛选边框。 */
  border-color: var(--accent);
  /* 使用主题弱强调背景。 */
  background: var(--accent-soft);
  /* 使用主题强调文字色。 */
  color: var(--accent);
}

/*
  作用容器: 键盘聚焦来源筛选。
  样式作用:
  提供可见焦点反馈。
*/
.source-management__filter:focus-visible {
  /* 使用主题强调焦点轮廓。 */
  outline: 2px solid var(--accent);
  /* 保留轮廓和按钮边界距离。 */
  outline-offset: 2px;
}

/*
  作用容器: 筛选数量 `.source-management__filter-count`。
  样式作用:
  降低数量相对筛选名称的视觉层级。
*/
.source-management__filter-count {
  /* 使用辅助字号。 */
  font-size: 12px;
  /* 通过透明度降低数字层级。 */
  opacity: .76;
}

/*
  作用容器: 批量操作区 `.source-management__batch-actions`。
  样式作用:
  靠右排列选择数量 Chip、批量导出和批量删除。
*/
.source-management__batch-actions {
  /* 使用弹性布局排列批量控件。 */
  display: flex;
  /* 让控件垂直居中。 */
  align-items: center;
  /* 允许手机视口自然换行。 */
  flex-wrap: wrap;
  /* 统一批量控件间距。 */
  gap: 8px;
}

/*
  响应范围: 最大 900px 的平板和窄桌面。
  样式作用:
  将页面说明和全局操作改为上下排列。
*/
@media (max-width: 900px) {
  /*
    作用容器: 平板页面头部。
    样式作用:
    避免长说明和三个全局按钮互相挤压。
  */
  .source-management__header {
    /* 将左右布局改为纵向。 */
    flex-direction: column;
  }

  /*
    作用容器: 平板全局操作区。
    样式作用:
    操作按钮从内容左侧开始排列。
  */
  .source-management__actions {
    /* 与页面文本左边缘对齐。 */
    justify-content: flex-start;
  }
}

/*
  响应范围: 最大 640px 的手机视口。
  样式作用:
  压缩页面节奏、纵向展示摘要，并让筛选与批量操作各占一行。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机数据源管理页面。
    样式作用:
    使用更紧凑的主要区块间距。
  */
  .source-management {
    /* 缩小手机纵向区块间距。 */
    gap: 12px;
  }

  /*
    作用容器: 手机页面标题。
    样式作用:
    降低标题字号以适配窄视口。
  */
  .source-management__title {
    /* 使用手机页面标题字号。 */
    font-size: 21px;
  }

  /*
    作用容器: 手机全局操作区。
    样式作用:
    使用两列网格稳定分配三个按钮，避免按钮固有内容宽度撑出视口。
  */
  .source-management__actions {
    /* 将手机操作区切换为两列网格，不继承桌面的弹性压缩规则。 */
    display: grid;
    /* 两列允许内容收缩，前两个次级操作保持同一行。 */
    grid-template-columns: repeat(2, minmax(0, 1fr));
    /* 占满内容宽度。 */
    width: 100%;
  }

  /*
    作用容器: 手机全局操作按钮。
    样式作用:
    让按钮服从所在网格列宽并消除 Element UI 相邻按钮默认外边距。
  */
  .source-management__actions > .el-button {
    /* 填满所在网格单元，保持两列按钮边界整齐。 */
    width: 100%;
    /* 清除 Element UI 相邻按钮左外边距。 */
    margin-left: 0;
  }

  /*
    作用容器: 手机全局操作区最后一个主按钮。
    样式作用:
    让导入入口独占第二行，保持主要操作完整可读且不制造第三个窄列。
  */
  .source-management__actions > .el-button:last-child {
    /* 横跨两列并使用操作区完整宽度。 */
    grid-column: 1 / -1;
  }

  /*
    作用容器: 手机摘要面板。
    样式作用:
    将四列改为四行键值结构。
  */
  .source-management__summary {
    /* 使用单列摘要布局。 */
    grid-template-columns: minmax(0, 1fr);
    /* 缩小手机面板上下内边距。 */
    padding: 4px 14px;
  }

  /*
    作用容器: 手机单个摘要项。
    样式作用:
    左侧字段名、右侧 Chip，并用横线分隔。
  */
  .source-management__summary-item {
    /* 使用键值两列布局。 */
    grid-template-columns: minmax(0, 1fr) auto;
    /* 垂直居中字段名和 Chip。 */
    align-items: center;
    /* 使用手机纵向内边距。 */
    padding: 11px 0;
    /* 移除桌面右分隔线。 */
    border-right: 0;
    /* 添加手机横向分隔线。 */
    border-bottom: 1px solid var(--border-color);
  }

  /*
    作用容器: 手机最后一个摘要项。
    样式作用:
    移除面板末尾多余分隔线。
  */
  .source-management__summary-item:last-child {
    /* 末项不绘制底部分隔线。 */
    border-bottom: 0;
  }

  /*
    作用容器: 手机筛选与批量工具栏。
    样式作用:
    强制两个工具区分别占用完整一行。
  */
  .source-management__toolbar {
    /* 使用纵向排列避免批量按钮挤压筛选。 */
    flex-direction: column;
    /* 两个工具区从左边缘对齐。 */
    align-items: stretch;
  }

  /*
    作用容器: 手机来源筛选和批量操作区。
    样式作用:
    让两个区域都使用完整内容宽度。
  */
  .source-management__filters,
  .source-management__batch-actions {
    /* 占满工具栏宽度。 */
    width: 100%;
  }

  /*
    作用容器: 手机批量操作区。
    样式作用:
    让选择数量在左，操作按钮紧随其后并可换行。
  */
  .source-management__batch-actions {
    /* 从左侧开始排列批量控件。 */
    justify-content: flex-start;
  }
}
</style>
