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
    │      展示页面标题、Mock 边界和检测、恢复、导入操作。
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
    │      使用 Chip 展示已启用数量、当前默认源和全部缓存占用。
    │  - params:
    │      -- summary、defaultSourceName、totalCacheText：共享状态摘要。
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
    │      接收文件、在线地址或粘贴文本 Mock 导入输入。
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
        -- managerState：响应式 Mock 内存状态。
    - events:
        无
  -->
  <section class="source-management">
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
          {{ moduleDefinition.description }} 当前操作只保存在 Mock 内存中。
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
          用三个 Chip 展示共享数据源状态摘要。
      - params:
          -- summary.enabledCount、summary.totalCount、defaultSourceName、totalCacheText：摘要字段。
      - events:
          无
    -->
    <dl class="source-management__summary theme-surface">
      <div class="source-management__summary-item">
        <dt>已启用</dt>
        <dd><el-tag size="small" effect="plain" type="success">{{ summary.enabledCount }} / {{ summary.totalCount }}</el-tag></dd>
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
          三种 Mock 导入方式对话框。
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
      编排数据源筛选、摘要、批量选择、导入、检测、授权、默认源交接、删除和恢复流程。
      通过 settingsService 操作唯一共享状态，并将页面加载周期的显示顺序与权威记录分离。

  - 导入库及文件汇总(9 条，内置 0 条，第三方 0 条，自定义 9 条):
      SourceList、SourceImportDialog、SourceAuthorizationDialog、SourceDisableDialog、SourceDeleteDialog、RestoreSystemSourcesDialog: 自定义组件，组成数据源列表和确认流程。
      SETTINGS_MODULE_ID、SETTINGS_MODULES、SETTINGS_ROUTE_NAME: 自定义配置，提供设置模块定义和路由名称。
      SOURCE_KIND_FILTER、authorizeSource、checkAllSources、clearAllSourceCache、deleteSources、downloadSourceScripts、getRemovedSystemSources、getSourceKindCounts、getSourceManagerState、getSourceRecord、getSourceRecords、getSourceSummary、importCustomSource、requiresSourceAuthorization、restoreSystemSources、setDefaultSource、setSourceEnabled: 自定义服务，统一读写数据源共享状态。
      SOURCE_KIND_FILTER_DEFINITIONS、formatCacheBytes: 自定义工具，提供筛选定义和缓存格式化。

  - 模块级常量:
      FILTER_EMPTY_TEXT: object，三种来源筛选对应的空状态说明。
      DEFAULT_SOURCE_HANDOFF_ACTION: object，默认源交接完成后允许继续执行的动作枚举。
      MESSAGE_BOX_OPTIONS: object，页面确认框统一按钮和视觉配置。

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

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceManagementPanel: 当前文件公开的组件或模块能力。
*/

// 导入来源: ./SourceList.vue。
// 导入内容: SourceList 数据源列表组件。
// 文件作用: 展示加载周期内顺序稳定的列表并接收全部行级意图。

import SourceList from './SourceList.vue';
// 导入来源: ./SourceImportDialog.vue。
// 导入内容: SourceImportDialog 数据源导入对话框。
// 文件作用: 接收三种 Mock 导入输入。

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
  // 文件作用: 根据对话框输入创建 Mock 记录。
  importCustomSource,
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
 * 排序规则: 页面加载时的默认源放在第一项，其余记录保持权威数组相对顺序。
 *
 * @param {Array<object>} records 页面加载时全部可见数据源记录。
 * @param {string} defaultSourceId 页面加载时的默认数据源 id。
 * @returns {Array<string>} 当前页面加载周期使用的数据源显示 id 顺序。
 * 纯函数: createSourceDisplayOrder 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
function createSourceDisplayOrder(records, defaultSourceId) {
  // 类型: object|undefined。
  // 作用: 定位页面加载时默认源，决定是否需要放到显示顺序第一项。

  const defaultRecord = records.find(record => record.definition.id === defaultSourceId);

  // 循环类型: Array.prototype.filter + map。
  // 初始值: records 第一条记录。
  // 终止条件: 所有加载时可见记录完成默认源比较和 id 提取。
  // 循环作用: 保留非默认源的权威相对顺序。
  // 类型: Array<string>。
  // 作用: 保存非默认源 id，并保留它们在权威记录数组中的相对顺序。

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
 * 新记录策略: 页面打开后导入或恢复的记录没有快照位置，按权威数组顺序稳定追加。
 *
 * @param {Array<object>} records 当前来源筛选可见数据源记录。
 * @param {Array<string>} sourceDisplayOrderIds 页面加载时生成的显示顺序快照。
 * @returns {Array<object>} 当前加载周期顺序稳定的展示记录。
 * 纯函数: sortRecordsByDisplayOrder 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
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
    // 组件: 导入对话框；作用: 创建自定义 Mock 数据源。
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
   * 纯函数: data 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
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
      pendingHandoffAction: ''
    };
  },

  /**
   * 在数据源管理页面创建时固定本次显示顺序。
   * 数据来源: settingsService 当前全部可见记录和当前默认源 id。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   * 副作用: 把首次派生的显示顺序写入 sourceDisplayOrderIds，后续默认源切换不重排当前列表。
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
     *
     * @returns {object} 数据源设置模块标题和说明配置。
     * 纯函数: moduleDefinition 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    moduleDefinition() {
      return SETTINGS_MODULES.find(moduleItem => moduleItem.id === SETTINGS_MODULE_ID.sources);
    },

    /**
     * 读取唯一响应式数据源管理状态。
     * 数据来源: settingsService 对 settingsStore 的受控读取接口。
     *
     * @returns {object} settingsStore 中唯一响应式数据源管理状态。
     * 纯函数: managerState 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    managerState() {
      return getSourceManagerState();
    },

    /**
     * 读取来源筛选定义。
     * 数据来源: settingsDisplay 的统一展示配置。
     *
     * @returns {Array<object>} 全部、系统源和自定义源固定筛选定义。
     * 纯函数: filterDefinitions 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    filterDefinitions() {
      return SOURCE_KIND_FILTER_DEFINITIONS;
    },

    /**
     * 读取当前筛选展示记录。
     * 数据来源: activeSourceKind、settingsService 共享状态和 sourceDisplayOrderIds 加载快照。
     * 默认源切换只改变状态，不改变当前页面加载周期的记录位置。
     *
     * @returns {Array<object>} 当前筛选可见且按加载快照稳定排列的数据源记录。
     * 纯函数: filteredRecords 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
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
     *
     * @returns {object} 三种来源筛选对应的当前可见数量。
     * 纯函数: sourceKindCounts 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    sourceKindCounts() {
      return getSourceKindCounts();
    },

    /**
     * 读取数据源管理摘要。
     * 数据来源: settingsService 对共享状态的集中聚合。
     *
     * @returns {object} 已启用数量、总数、默认源和缓存摘要。
     * 纯函数: summary 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    summary() {
      return getSourceSummary();
    },

    /**
     * 读取当前默认源名称。
     * 数据来源: summary.defaultSource。
     *
     * @returns {string} 当前默认源名称；没有默认源时返回明确空状态。
     * 纯函数: defaultSourceName 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    defaultSourceName() {
      return this.summary.defaultSource ? this.summary.defaultSource.definition.name : '暂未设置';
    },

    /**
     * 格式化全部数据源缓存摘要。
     * 数据来源: summary.totalCacheBytes。
     *
     * @returns {string} 全部数据源缓存用户可读容量。
     * 纯函数: totalCacheText 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    totalCacheText() {
      return formatCacheBytes(this.summary.totalCacheBytes);
    },

    /**
     * 读取当前筛选空状态说明。
     * 数据来源: activeSourceKind 和 FILTER_EMPTY_TEXT。
     *
     * @returns {string} 当前筛选无记录时的下一步说明。
     * 纯函数: emptyDescription 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    emptyDescription() {
      return FILTER_EMPTY_TEXT[this.activeSourceKind] || FILTER_EMPTY_TEXT[SOURCE_KIND_FILTER.all];
    },

    /**
     * 计算页面当前选择数量。
     * 数据来源: selectedSourceIds 页面局部状态。
     *
     * @returns {number} 页面跨筛选选择的数据源数量。
     * 纯函数: selectedCount 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    selectedCount() {
      return this.selectedSourceIds.length;
    },

    /**
     * 读取当前仍存在的所选记录。
     * 数据来源: selectedSourceIds 和 settingsService 共享状态。
     *
     * @returns {Array<object>} 去除已删除或失效 id 后的所选记录。
     * 纯函数: selectedRecords 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    selectedRecords() {
      return this.selectedSourceIds
        .map(sourceId => getSourceRecord(sourceId))
        .filter(record => Boolean(record));
    },

    /**
     * 读取等待授权的数据源记录。
     * 数据来源: pendingAuthorizationSourceId 和共享记录集合。
     *
     * @returns {object|null} 当前等待授权的数据源记录。
     * 纯函数: pendingAuthorizationRecord 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    pendingAuthorizationRecord() {
      return getSourceRecord(this.pendingAuthorizationSourceId);
    },

    /**
     * 读取等待默认源交接的数据源记录。
     * 数据来源: pendingDisableSourceId 和共享记录集合。
     *
     * @returns {object|null} 当前等待默认源交接的记录。
     * 纯函数: pendingDisableRecord 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    pendingDisableRecord() {
      return getSourceRecord(this.pendingDisableSourceId);
    },

    /**
     * 读取等待单条删除确认的数据源记录。
     * 数据来源: pendingSingleDeleteSourceId 和共享记录集合。
     *
     * @returns {object|null} 当前等待单条删除确认的数据源记录。
     * 纯函数: pendingSingleDeleteRecord 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    pendingSingleDeleteRecord() {
      return getSourceRecord(this.pendingSingleDeleteSourceId);
    },

    /**
     * 计算默认源交接候选记录。
     * 批量删除时排除整批待删除 id，关闭单源时只排除当前默认源。
     *
     * @returns {Array<object>} 仍启用且不属于当前操作目标的候选源。
     * 纯函数: fallbackRecords 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    fallbackRecords() {
      // 类型: Array<string>。
      // 作用: 保存本次交接需要排除的数据源 id，避免原默认源或整批待删除源成为接替候选。
      const excludedSourceIds = this.pendingHandoffAction === DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources
        ? this.pendingDeleteSourceIds
        : [this.pendingDisableSourceId];
      // 类型: Set<string>。
      // 作用: 保存交接候选排除集合，供候选筛选执行稳定查找。

      const excludedSourceIdSet = new Set(excludedSourceIds);
      return getSourceRecords(SOURCE_KIND_FILTER.all).filter((record) => {
        return !excludedSourceIdSet.has(record.definition.id) && record.runtime.enabled;
      });
    },

    /**
     * 读取已软删除系统源记录。
     * 数据来源: settingsService 对 removedSystemSourceIds 的派生查询。
     *
     * @returns {Array<object>} 当前可通过恢复对话框找回的系统源记录。
     * 纯函数: removedSystemSources 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    removedSystemSources() {
      return getRemovedSystemSources();
    },

    /**
     * 读取默认源交接操作说明。
     * 数据来源: pendingHandoffAction 页面局部动作枚举。
     *
     * @returns {string} 默认源交接弹窗针对当前动作的说明。
     * 纯函数: handoffOperationDescription 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    handoffOperationDescription() {
      return this.pendingHandoffAction === DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources
        ? '删除范围包含当前默认源，继续前需要选择新的默认数据源。'
        : '关闭该数据源前需要选择新的默认数据源。';
    },

    /**
     * 读取默认源交接确认按钮文案。
     * 数据来源: pendingHandoffAction 页面局部动作枚举。
     *
     * @returns {string} 默认源交接确认按钮针对当前动作的文案。
     * 纯函数: handoffConfirmLabel 只读取输入参数或组件只读状态并返回派生结果，不修改响应式状态或外部存储。
 */
    handoffConfirmLabel() {
      return this.pendingHandoffAction === DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources
        ? '继续删除'
        : '关闭数据源';
    }
  },

  methods: {
    /**
     * 切换当前来源筛选。
     * 选择状态不随筛选清空，使用户可以跨分类组合批量操作目标。
     *
     * @param {string} sourceKindFilter 目标来源筛选值。
     * @returns {void} 只修改页面局部筛选状态。
     * 副作用: selectSourceKind 会应用用户选择，并同步相关组件状态、路由或对外事件。
 */
    selectSourceKind(sourceKindFilter) {
      this.activeSourceKind = sourceKindFilter;
    },

    /**
     * 合并单条数据源选择状态。
     *
     * @param {object} payload 选择事件参数。
     * @param {string} payload.sourceId 目标数据源 id。
     * @param {boolean} payload.selected true 加入选择，false 移出选择。
     * @returns {void} 更新页面局部选择数组。
     * 副作用: 覆盖页面局部 selectedSourceIds，不修改数据源共享记录。
 */
    toggleSourceSelection(payload) {
      // 类型: Set<string>。
      // 作用: 把当前选择数组转换为集合，合并单行选择时保持 id 唯一。
      const selectedSourceIdSet = new Set(this.selectedSourceIds);

      // 条件分支: 当前行被选中时加入集合，否则从集合移除。
      // 执行内容: 合并这一行的最新选择状态，并在分支后统一回写数组。
      if (payload.selected) selectedSourceIdSet.add(payload.sourceId);
      else selectedSourceIdSet.delete(payload.sourceId);
      this.selectedSourceIds = Array.from(selectedSourceIdSet);
    },

    /**
     * 合并当前筛选全选状态。
     * 未显示筛选中的既有选择保持不变。
     *
     * @param {object} payload 全选事件参数。
     * @param {Array<string>} payload.sourceIds 当前筛选可见 id。
     * @param {boolean} payload.selected true 全选当前筛选，false 取消当前筛选。
     * @returns {void} 更新页面局部选择数组。
     * 副作用: 合并当前筛选选择后覆盖页面局部 selectedSourceIds，不修改数据源共享记录。
 */
    toggleSelectAll(payload) {
      // 类型: Set<string>。
      // 作用: 保存全部筛选范围的现有选择，便于只增删当前可见记录。
      const selectedSourceIdSet = new Set(this.selectedSourceIds);
      payload.sourceIds.forEach((sourceId) => {
        // 条件分支: 当前筛选执行全选时加入 id，否则移除该筛选内的 id。
        // 执行内容: 只更新当前可见记录，保留其他筛选下已经选择的记录。
        if (payload.selected) selectedSourceIdSet.add(sourceId);
        else selectedSourceIdSet.delete(sourceId);
      });
      this.selectedSourceIds = Array.from(selectedSourceIdSet);
    },

    /**
     * 打开数据源详情路由。
     *
     * @param {string} sourceId 目标数据源 id。
     * @returns {void} 通过 Vue Router 执行页面导航。
     * 副作用: openSourceDetail 会打开目标页面或弹窗，并同步相关组件状态、路由或对外事件。
 */
    openSourceDetail(sourceId) {
      this.$router.push({ name: SETTINGS_ROUTE_NAME.sourceDetail, params: { sourceId } });
    },

    /**
     * 从列表快速设置默认源。
     * 成功后只更新默认源开关和摘要；当前页面列表位置保持不变，下一次页面加载再生成新顺序。
     *
     * @param {string} sourceId 目标已启用数据源 id。
     * @returns {void} 通过 service 修改唯一默认源状态。
     * 副作用: 调用 service 更新 defaultSourceId，并通过消息组件反馈成功或失败。
 */
    handleSetDefaultFromList(sourceId) {
      // 类型: boolean。
      // 作用: 保存默认源切换是否成功，用于决定反馈文案和是否结束流程。
      const changed = setDefaultSource(sourceId);

      // 条件分支: 目标源未启用或不存在，默认源切换未成功时进入。
      // 执行内容: 显示先启用提示并停止成功反馈。
      if (!changed) {
        this.$message.warning('请先启用该数据源，再设置为默认源');
        return;
      }
      this.$message.success('默认数据源已切换，当前列表顺序保持不变');
    },

    /**
     * 处理列表启停意图。
     * 待授权自定义源先进入授权弹窗；关闭默认源先进入交接弹窗；其他记录直接写入启停状态。
     *
     * @param {object} payload 启停参数。
     * @param {string} payload.sourceId 数据源 id。
     * @param {boolean} payload.enabled 目标启用状态。
     * @returns {void} 根据边界启动对应流程。
     * 副作用: handleToggleSource 会切换对应状态，并同步相关组件状态、路由或对外事件。
 */
    handleToggleSource(payload) {
      // 类型: object|null。
      // 作用: 定位本次启停目标，后续授权和默认源交接均以该权威记录判断。
      const record = getSourceRecord(payload.sourceId);

      // 条件分支: 目标数据源已不存在时进入。
      // 执行内容: 忽略过期列表事件，不修改任何共享状态。
      if (!record) return;

      // 条件分支: 用户准备启用一条尚未获得当前脚本授权的数据源时进入。
      // 执行内容: 保存待授权 id 并打开风险确认弹窗，暂不启用记录。
      if (payload.enabled && requiresSourceAuthorization(record)) {
        this.pendingAuthorizationSourceId = payload.sourceId;
        this.authorizationDialogVisible = true;
        return;
      }

      // 条件分支: 用户准备关闭当前默认源时进入。
      // 执行内容: 打开默认源交接弹窗，交接完成前不关闭原默认源。
      if (!payload.enabled && this.managerState.defaultSourceId === payload.sourceId) {
        this.pendingDisableSourceId = payload.sourceId;
        this.pendingHandoffAction = DEFAULT_SOURCE_HANDOFF_ACTION.disableSource;
        this.disableDialogVisible = true;
        return;
      }
      setSourceEnabled(payload.sourceId, payload.enabled);
      this.$message.success(payload.enabled ? '数据源已启用' : '数据源已关闭');
    },

    /**
     * 完成自定义脚本授权并启用数据源。
     *
     * @param {string} sourceId 用户确认授权的数据源 id。
     * @returns {void} 更新授权和启用共享状态。
     * 副作用: confirmAuthorization 会更新脚本授权，并同步相关组件状态、路由或对外事件。
 */
    confirmAuthorization(sourceId) {
      authorizeSource(sourceId);
      setSourceEnabled(sourceId, true);
      this.pendingAuthorizationSourceId = '';
      this.$message.success('已授权并启用该自定义数据源');
    },

    /**
     * 完成默认源交接并继续原操作。
     * 删除动作执行整批事务；关闭动作只关闭弹窗指定默认源。
     *
     * @param {object} payload 交接参数。
     * @param {string} payload.sourceId 原默认源 id。
     * @param {string} payload.fallbackSourceId 用户选择的新默认源 id；无候选时为空。
     * @returns {void} 完成交接和待执行动作。
     * 副作用: 更新默认源后继续待执行的关闭或批量删除操作，并清理交接状态。
 */
    confirmDefaultSourceHandoff(payload) {
      // 条件分支: 用户选择了有效接替源时进入。
      // 执行内容: 先完成默认源交接，再继续关闭或删除原默认源。
      if (payload.fallbackSourceId) setDefaultSource(payload.fallbackSourceId);

      // 条件分支: 当前交接来自整批删除操作时进入。
      // 执行内容: 在新默认源生效后继续统一批量删除事务，并结束当前交接流程。
      if (this.pendingHandoffAction === DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources) {
        this.performDeleteSources(this.pendingDeleteSourceIds);
        return;
      }
      setSourceEnabled(payload.sourceId, false);
      this.resetHandoffState();
      this.$message.success('数据源已关闭');
    },

    /**
     * 清空默认源交接页面局部状态。
     *
     * @returns {void} 不修改共享数据源记录。
     * 副作用: resetHandoffState 会恢复对应状态，并同步相关组件状态、路由或对外事件。
 */
    resetHandoffState() {
      this.pendingDisableSourceId = '';
      this.pendingDeleteSourceIds = [];
      this.pendingHandoffAction = '';
    },

    /**
     * 执行全部已启用数据源 Mock 检测。
     *
     * @returns {Promise<void>} 检测完成后显示成功反馈。
     * 副作用: handleCheckAll 会检测目标状态，并同步相关组件状态、路由或对外事件。
     * 成功路径: handleCheckAll 完成检测目标状态后同步成功结果。
     * 失败路径: 检测服务拒绝时 Promise 继续向调用方抛出，服务自身负责恢复 checkingAll 状态。
 */
    async handleCheckAll() {
      await checkAllSources();
      this.$message.success('已完成全部已启用数据源检测');
    },

    /**
     * 导入自定义 Mock 数据源并切换到自定义源筛选。
     *
     * @param {object} input 导入对话框标准输入。
     * @returns {void} 通过 service 创建记录并显示反馈。
     * 副作用: handleImport 会导入数据源脚本，并同步相关组件状态、路由或对外事件。
 */
    handleImport(input) {
      // 类型: object。
      // 作用: 保存 service 创建的自定义源记录，用于反馈正式名称并切换列表筛选。
      const importedRecord = importCustomSource(input);
      this.activeSourceKind = SOURCE_KIND_FILTER.custom;
      this.$message.success(`已导入“${importedRecord.definition.name}”，启用前需要确认运行授权`);
    },

    /**
     * 批量导出所选数据源脚本。
     * 导出包只包含结构版本、导出时间和每条脚本最小身份、版本与内容。
     *
     * @returns {void} 浏览器下载由 service 触发。
     * 副作用: handleBatchExport 会导出数据源脚本，并同步相关组件状态、路由或对外事件。
 */
    handleBatchExport() {
      // 类型: number。
      // 作用: 保存本次实际写入导出包的数据源数量，用于区分成功与无有效选择。
      const exportedCount = downloadSourceScripts(this.selectedSourceIds);

      // 条件分支: 当前选择没有任何仍存在的数据源时进入。
      // 执行内容: 显示选择提示，不报告导出成功。
      if (!exportedCount) {
        this.$message.warning('请选择仍然存在的数据源后再导出');
        return;
      }
      this.$message.success(`已导出 ${exportedCount} 个数据源脚本`);
    },

    /**
     * 确认批量删除所选数据源。
     * 包含默认源时确认后进入默认源交接，不包含时直接执行统一批量事务。
     *
     * @returns {Promise<void>} 用户确认或取消后完成；取消不修改任何状态。
     * 副作用: handleBatchDelete 会删除目标记录，并同步相关组件状态、路由或对外事件。
     * 成功路径: handleBatchDelete 完成删除目标记录后同步成功结果。
     * 失败路径: 用户取消确认时正常返回且不修改记录；确认组件的其他异常继续由调用链处理。
 */
    async handleBatchDelete() {
      // 类型: Array<string>。
      // 作用: 从仍存在的已选记录提取本次批量删除 id，排除过期选择。
      const sourceIds = this.selectedRecords.map(record => record.definition.id);

      // 条件分支: 当前没有任何仍存在的删除目标时进入。
      // 执行内容: 显示选择提示并停止确认流程。
      if (!sourceIds.length) {
        this.$message.warning('请选择仍然存在的数据源后再删除');
        return;
      }
      try {
        await this.$confirm(`确定删除已选择的 ${sourceIds.length} 个数据源吗？`, '批量删除数据源', MESSAGE_BOX_OPTIONS);
      } catch (error) {
        return;
      }
      this.startDeleteFlow(sourceIds);
    },

    /**
     * 打开列表单条删除确认弹窗。
     *
     * @param {string} sourceId 待删除数据源 id。
     * @returns {void} 只设置页面局部弹窗状态。
     * 副作用: handleDeleteSource 会删除目标记录，并同步相关组件状态、路由或对外事件。
 */
    handleDeleteSource(sourceId) {
      this.pendingSingleDeleteSourceId = sourceId;
      this.deleteDialogVisible = true;
    },

    /**
     * 继续已确认的单条删除流程。
     *
     * @param {string} sourceId 用户确认删除的数据源 id。
     * @returns {void} 根据默认源边界执行删除或交接。
     * 副作用: confirmSingleDelete 会删除目标记录，并同步相关组件状态、路由或对外事件。
 */
    confirmSingleDelete(sourceId) {
      this.pendingSingleDeleteSourceId = '';
      this.startDeleteFlow([sourceId]);
    },

    /**
     * 按默认源边界启动删除流程。
     *
     * @param {Array<string>} sourceIds 已经获得用户确认的删除 id。
     * @returns {void} 打开交接弹窗或直接执行批量事务。
     * 副作用: startDeleteFlow 会删除目标记录，并同步相关组件状态、路由或对外事件。
 */
    startDeleteFlow(sourceIds) {
      // 类型: boolean。
      // 作用: 标记本批删除是否包含当前默认源，决定是否先执行默认源交接。
      const containsDefaultSource = sourceIds.includes(this.managerState.defaultSourceId);

      // 条件分支: 删除范围包含当前默认源时进入。
      // 执行内容: 保存整批删除上下文并打开交接弹窗，暂不删除任何记录。
      if (containsDefaultSource) {
        this.pendingDeleteSourceIds = sourceIds.slice();
        this.pendingDisableSourceId = this.managerState.defaultSourceId;
        this.pendingHandoffAction = DEFAULT_SOURCE_HANDOFF_ACTION.deleteSources;
        this.disableDialogVisible = true;
        return;
      }
      this.performDeleteSources(sourceIds);
    },

    /**
     * 执行统一批量删除事务并清理页面选择状态。
     *
     * @param {Array<string>} sourceIds 待删除数据源 id。
     * @returns {void} 通过 service 修改共享状态并显示准确数量反馈。
     * 副作用: performDeleteSources 会删除目标记录，并同步相关组件状态、路由或对外事件。
 */
    performDeleteSources(sourceIds) {
      // 类型: object。
      // 作用: 保存统一删除事务的数量结果，用于清理页面选择并生成反馈。
      const deleteResult = deleteSources(sourceIds);

      // 类型: Set<string>。
      // 作用: 保存本次删除 id 集合，用于同步移除页面批量选择状态。
      const deletedSourceIdSet = new Set(sourceIds);
      this.selectedSourceIds = this.selectedSourceIds
        .filter(sourceId => !deletedSourceIdSet.has(sourceId));
      this.pendingSingleDeleteSourceId = '';
      this.resetHandoffState();
      this.$message.success(`已删除 ${deleteResult.deletedCount} 个数据源`);
    },

    /**
     * 确认重置单个数据源全部缓存。
     * 清理不修改脚本、授权、启用状态或默认源。
     *
     * @param {string} sourceId 待重置缓存的数据源 id。
     * @returns {Promise<void>} 用户确认或取消后完成。
     * 副作用: handleResetSource 会恢复对应状态，并同步相关组件状态、路由或对外事件。
     * 成功路径: handleResetSource 完成恢复对应状态后同步成功结果。
     * 失败路径: 目标不存在或用户取消确认时正常返回且不清理缓存。
 */
    async handleResetSource(sourceId) {
      // 类型: object|null。
      // 作用: 定位待清空缓存的数据源记录，用于确认框显示正式名称。
      const record = getSourceRecord(sourceId);

      // 条件分支: 目标记录已不存在时进入。
      // 执行内容: 结束重置流程，避免打开没有目标名称的确认框。
      if (!record) return;
      try {
        await this.$confirm(`确定清空“${record.definition.name}”的全部缓存吗？`, '重置数据源缓存', MESSAGE_BOX_OPTIONS);
      } catch (error) {
        return;
      }
      clearAllSourceCache(sourceId);
      this.$message.success('数据源全部缓存已清空');
    },

    /**
     * 恢复用户选择的系统源。
     *
     * @param {Array<string>} sourceIds 待恢复系统源 id。
     * @returns {void} 通过 service 移除软删除标识。
 * 副作用: confirmRestore 会恢复系统数据源，并同步相关组件状态、路由或对外事件。
 */
    confirmRestore(sourceIds) {
      // 类型: number。
      // 作用: 保存实际从软删除集合恢复的系统源数量，用于用户反馈。
      const restoredCount = restoreSystemSources(sourceIds);
      this.$message.success(`已恢复 ${restoredCount} 个系统源`);
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
  三列展示启用数量、默认源和缓存 Chip。
*/
.source-management__summary {
  /* 使用三列等宽网格。 */
  display: grid;
  /* 每项允许收缩，防止默认源名称撑出页面。 */
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

  响应式断点: (max-width: 900px)。
  作用范围: 响应范围: 最大 900px 的平板和窄桌面。
  样式作用:
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

  响应式断点: (max-width: 640px)。
  作用范围: 响应范围: 最大 640px 的手机视口。
  样式作用:
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
    让三个按钮平均占用整行。
  */
  .source-management__actions {
    /* 占满内容宽度。 */
    width: 100%;
  }

  /*
    作用容器: 手机全局操作按钮。
    样式作用:
    平均分配按钮宽度并消除 Element UI 相邻按钮默认外边距。
  */
  .source-management__actions > .el-button {
    /* 每个按钮平分可用空间。 */
    flex: 1;
    /* 清除 Element UI 相邻按钮左外边距。 */
    margin-left: 0;
    /* 缩小右内边距，避免短按钮拥挤。 */
    padding-right: 8px;
    /* 缩小左内边距，避免短按钮拥挤。 */
    padding-left: 8px;
  }

  /*
    作用容器: 手机摘要面板。
    样式作用:
    将三列改为三行键值结构。
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
