<template>
  <!--
    SourceDetailView 页面渲染树

    [IF record] ele(article.source-detail)
    │  - condition:
    │      路由 sourceId 能匹配当前可见数据源时渲染。
    │  - type:
    │      原生标签
    │      标签名称: article
    │  - description:
    │      数据源独立详情页，组合字段展示、设置、缓存和操作流程。
    │  - params:
    │      -- record：共享 SourceManagerState 中唯一匹配记录。
    │      -- operationPending：异步详情事务执行期间显示页面级加载门禁。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(header.source-detail__header)
    │  - condition:
    │      record 存在时默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: header
    │  - description:
    │      提供返回入口、名称、描述和核心操作。
    │  - params:
    │      -- action 状态均从 record 派生。
    │  - events:
    │      @click 调用检测、更新、默认源、导出和授权方法。
    │
    ├─ [IF isUnavailable] ele(el-alert)
    │  - condition:
    │      已启用且 Provider 未就绪或健康状态为 unavailable 时渲染。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-alert
    │  - description:
    │      展示不可用原因，不新增额外健康状态。
    │  - params:
    │      -- unavailableReason：统一展示工具返回的 Provider 或健康不可用原因。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(SourceBasicInfo)
    │  - condition:
    │      record 存在时默认渲染。
    │  - type:
    │      自定义组件
    │      相对位置: ../components/settings/SourceBasicInfo.vue
    │  - description:
    │      展示当前数据源基本字段、在线信息和页面能力。
    │  - params:
    │      -- record：当前共享数据源记录。
    │      -- isDefault：当前记录是否为默认源。
    │      -- authorizationStatus：统一授权评估得到的有效展示状态。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(SourceGeneralSettings)
    │  - condition:
    │      record 存在时默认渲染。
    │  - type:
    │      自定义组件
    │      相对位置: ../components/settings/SourceGeneralSettings.vue
    │  - description:
    │      展示普通非敏感设置边界和当前真实空状态。
    │  - params:
    │      -- schema：当前数据源预留设置定义数组。
    │  - events:
    │      无
    │
    ├─ [DEFAULT] ele(SourceCacheSection)
    │  - condition:
    │      record 存在时默认渲染。
    │  - type:
    │      自定义组件
    │      相对位置: ../components/settings/SourceCacheSection.vue
    │  - description:
    │      展示两级缓存占用并发出清理意图。
    │  - params:
    │      -- record：当前共享数据源记录。
    │  - events:
    │      @clear-temporary
    │          - description:
    │              用户请求清理临时缓存时触发。
    │          - methods:
    │              handleClearTemporaryCache()
    │      @clear-all
    │          - description:
    │              用户请求清理全部缓存时触发。
    │          - methods:
    │              handleClearAllCache()
    │
    ├─ [DEFAULT] ele(section.source-detail__danger-zone)
    │  - condition:
    │      record 存在时默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      数据源操作区，集中展示导出、授权和删除入口。
    │  - params:
    │      -- isCustomSource：控制授权相关按钮。
    │      -- requiresAuthorization：控制授权或撤销授权分支。
    │  - events:
    │      无
    │
    └─ [DEFAULT] ele(operation-dialogs)
       - condition:
           对应弹窗局部状态为 true 时由组件显示。
       - type:
           自定义组件组
           相对位置: ../components/settings/
       - description:
           承载授权、删除和默认源交接确认流程。
       - params:
           -- record：当前数据源记录。
           -- fallbackRecords：默认源交接候选记录。
       - events:
           @confirm
               - description:
                   用户完成对应确认流程时触发。
               - methods:
                   confirmAuthorization(sourceId)
                   confirmDelete(sourceId)
                   confirmDefaultSourceTransition(payload)

    [ELSE] ele(section.source-detail-not-found.theme-surface)
       - condition:
           sourceId 不存在或系统源已经被软删除时渲染。
       - type:
           原生标签
           标签名称: section
       - description:
           显示未找到状态并提供返回数据源列表入口。
       - params:
           -- operationPending：删除后路由切换前保持加载门禁，其他时间为 false。
       - events:
           @click 调用 returnToSourceList()。
  -->
  <!--
    [IF record] ele(article.source-detail)
    - condition:
        路由 sourceId 匹配当前可见数据源记录时渲染。
    - type:
        原生标签
        标签名称: article
    - description:
        数据源详情页根容器，组合信息、缓存、操作和确认流程。
    - params:
        -- record：从共享状态实时匹配的当前记录。
        -- operationPending：true阻止重复设置操作并显示加载反馈，false恢复详情交互。
    - events:
        无
  -->
  <article v-if="record" v-loading="operationPending" class="source-detail">
    <!--
      [DEFAULT] ele(header.source-detail__header)
      - condition:
          record 存在时默认渲染。
      - type:
          原生标签
          标签名称: header
      - description:
          展示返回入口、数据源名称说明和上下文操作。
      - params:
          -- record.definition：名称、描述、版本和导入方式来源。
      - events:
          无
    -->
    <header class="source-detail__header">
      <!--
        [DEFAULT] ele(button.source-detail__back)
        - condition:
            record 存在时默认渲染。
        - type:
            原生标签
            标签名称: button
        - description:
            返回数据源列表入口，不修改当前记录状态。
        - params:
            无
        - events:
            @click
                - description:
                    用户点击返回入口时触发。
                - methods:
                    returnToSourceList()
      -->
      <button type="button" class="source-detail__back" @click="returnToSourceList">
        ← 返回数据源列表
      </button>
      <!--
        [DEFAULT] ele(div.source-detail__heading-row)
        - condition:
            record 存在时默认渲染。
        - type:
            原生标签
            标签名称: div
        - description:
            详情标题和主要操作布局容器，桌面分列、窄屏纵向排列。
        - params:
            -- record.definition：提供名称和描述。
            -- action computed：控制按钮条件和加载状态。
        - events:
            无
      -->
      <div class="source-detail__heading-row">
        <!--
          [DEFAULT] ele(div.source-detail__heading)
          - condition:
              record 存在时默认渲染。
          - type:
              原生标签
              标签名称: div
          - description:
              数据源标题文本列，展示当前记录名称和能力说明。
          - params:
              -- displaySourceName：由完整名称统一适配得到的详情页短标题。
              -- record.definition.description：详情页说明。
          - events:
              无
        -->
        <div class="source-detail__heading">
          <h1>{{ displaySourceName }}</h1>
          <p>{{ record.definition.description }}</p>
        </div>
        <!--
          [DEFAULT] ele(div.source-detail__primary-actions)
          - condition:
              record 存在时默认渲染。
          - type:
              原生标签
              标签名称: div
          - description:
              数据源主要操作组，承载检测、设为默认和在线更新入口。
          - params:
              -- isChecking：检测按钮加载状态。
              -- canSetDefault：设为默认按钮显示条件。
              -- isRemoteSource：更新检查按钮显示条件。
          - events:
              无
        -->
        <div class="source-detail__primary-actions" aria-label="数据源主要操作">
          <!--
            [DEFAULT] ele(el-button.source-detail__check)
            - condition:
                默认渲染；isChecking 为 true 时显示加载状态，不可运行时禁用。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-button
            - description:
                单源检测按钮，请求 service 更新当前记录健康状态。
            - params:
                -- isChecking：按钮加载状态。
                -- isRunnable：按钮是否允许提交健康检测。
            - events:
                @click
                    - description:
                        用户点击检测时触发。
                    - methods:
                        handleCheckSource()
          -->
          <el-button
            class="source-detail__check"
            :loading="isChecking"
            :disabled="!isRunnable"
            @click="handleCheckSource"
          >
            检测
          </el-button>
          <!--
            [IF canSetDefault] ele(el-button.source-detail__set-default)
            - condition:
                当前记录具备全局可运行资格且尚非默认源时渲染。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-button
            - description:
                设为默认按钮，把当前记录 id 写入共享 defaultSourceId。
            - params:
                无
            - events:
                @click
                    - description:
                        用户点击设为默认时触发。
                    - methods:
                        handleSetDefault()
          -->
          <el-button
            v-if="canSetDefault"
            class="source-detail__set-default"
            type="primary"
            plain
            @click="handleSetDefault"
          >
            设为默认
          </el-button>
          <!--
            [IF isRemoteSource] ele(el-button.source-detail__check-update)
            - condition:
                当前记录通过在线地址导入时渲染。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-button
            - description:
                在线更新检查按钮，读取 mock 远程版本场景。
            - params:
                -- record.runtime.checkingUpdate：按钮加载状态。
            - events:
                @click
                    - description:
                        用户点击检查更新时触发。
                    - methods:
                        handleCheckUpdate()
          -->
          <el-button
            v-if="isRemoteSource"
            class="source-detail__check-update"
            :loading="record.runtime.checkingUpdate"
            @click="handleCheckUpdate"
          >
            检查更新
          </el-button>
          <!--
            [IF record.runtime.updateAvailable] ele(el-button.source-detail__apply-update)
            - condition:
                更新检查发现可用版本时渲染。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-button
            - description:
                应用更新按钮，显示可用版本并遵守默认源和重新授权边界。
            - params:
                -- record.runtime.availableVersion：按钮展示的目标版本。
                -- record.runtime.checkingUpdate：按钮加载状态。
            - events:
                @click
                    - description:
                        用户点击应用更新时触发。
                    - methods:
                        handleApplyUpdate()
          -->
          <el-button
            v-if="record.runtime.updateAvailable"
            class="source-detail__apply-update"
            type="primary"
            :loading="record.runtime.checkingUpdate"
            @click="handleApplyUpdate"
          >
            更新到 {{ record.runtime.availableVersion }}
          </el-button>
        </div>
      </div>
    </header>

    <!--
      [IF isUnavailable] ele(el-alert)
      - condition:
          当前数据源已启用且 Provider 未就绪或健康状态为 unavailable 时渲染。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-alert
      - description:
          展示最近不可用原因，便于用户决定是否重新检测或停用。
      - params:
          -- unavailableReason：统一展示工具返回的 Provider 或健康不可用原因。
      - events:
          无
    -->
    <el-alert
      v-if="isUnavailable"
      :title="unavailableReason"
      type="error"
      :closable="false"
      show-icon
    />

    <!--
      [DEFAULT] ele(SourceBasicInfo)
      - condition:
          record 存在时默认渲染。
      - type:
          自定义组件
          相对位置: ../components/settings/SourceBasicInfo.vue
      - description:
          展示当前数据源基本字段、在线信息和页面能力。
      - params:
          -- record：当前共享数据源记录。
          -- isDefault：当前记录是否为默认源。
          -- authorizationStatus：统一授权评估得到的有效展示状态。
      - events:
          无
    -->
    <SourceBasicInfo
      :record="record"
      :is-default="isDefaultSource"
      :authorization-status="authorizationState.effectiveStatus"
    />

    <!--
      [DEFAULT] ele(SourceGeneralSettings)
      - condition:
          record 存在时默认渲染。
      - type:
          自定义组件
          相对位置: ../components/settings/SourceGeneralSettings.vue
      - description:
          展示普通非敏感设置边界和当前真实空状态。
      - params:
          -- schema：record.definition.settingsSchema 预留设置定义数组。
      - events:
          无
    -->
    <SourceGeneralSettings :schema="record.definition.settingsSchema" />

    <!--
      [DEFAULT] ele(SourceCacheSection)
      - condition:
          record 存在时默认渲染。
      - type:
          自定义组件
          相对位置: ../components/settings/SourceCacheSection.vue
      - description:
          展示两级缓存并把清理意图交回详情页。
      - params:
          -- record：当前共享记录。
      - events:
          @clear-temporary
              - description:
                  用户请求清理可重新生成临时缓存时触发。
              - methods:
                  handleClearTemporaryCache()
          @clear-all
              - description:
                  用户请求清理全部运行缓存时触发，并先显示确认。
              - methods:
                  handleClearAllCache()
    -->
    <SourceCacheSection
      :record="record"
      @clear-temporary="handleClearTemporaryCache"
      @clear-all="handleClearAllCache"
    />

    <!--
      [DEFAULT] ele(section.source-detail__danger-zone)
      - condition:
          record 存在时默认渲染。
      - type:
          原生标签
          标签名称: section
      - description:
          集中展示脚本导出、用户运行授权和删除操作。
      - params:
          -- isCustomSource、requiresAuthorization：从当前记录派生。
      - events:
          @click 调用导出、授权、撤销授权或打开删除确认。
    -->
    <section class="source-detail__danger-zone theme-surface">
      <!--
        [DEFAULT] ele(div.source-detail__danger-copy)
        - condition:
            record 存在时默认渲染。
        - type:
            原生标签
            标签名称: div
        - description:
            数据源操作说明区，解释导出和删除不会包含缓存或个人数据。
        - params:
            无
        - events:
            无
      -->
      <div class="source-detail__danger-copy">
        <h2>数据源操作</h2>
        <p>导出只包含数据源脚本；删除和授权操作不会导出任何缓存或个人数据。</p>
      </div>
      <!--
        [DEFAULT] ele(div.source-detail__secondary-actions)
        - condition:
            record 存在时默认渲染。
        - type:
            原生标签
            标签名称: div
        - description:
            数据源次要操作组，承载导出、授权、撤销授权和删除入口。
        - params:
            -- isCustomSource：控制授权相关按钮。
            -- requiresAuthorization：切换授权与撤销授权分支。
        - events:
            无
      -->
      <div class="source-detail__secondary-actions">
        <!--
          [DEFAULT] ele(el-button.source-detail__export)
          - condition:
              默认渲染。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-button
          - description:
              脚本导出按钮，只下载当前数据源脚本文本。
          - params:
              无
          - events:
              @click
                  - description:
                      用户点击导出时触发。
                  - methods:
                      handleExportScript()
        -->
        <el-button class="source-detail__export" @click="handleExportScript">导出数据源脚本</el-button>
        <!--
          [IF isCustomSource && requiresAuthorization] ele(el-button.source-detail__authorize)
          - condition:
              当前记录是需要用户确认风险的自定义脚本时渲染。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-button
          - description:
              授权并启用入口，只打开风险确认弹窗。
          - params:
              无
          - events:
              @click
                  - description:
                      用户点击授权入口时显示 SourceAuthorizationDialog。
                  - methods:
                      authorizationDialogVisible = true
        -->
        <el-button
          v-if="isCustomSource && requiresAuthorization"
          class="source-detail__authorize"
          type="primary"
          plain
          @click="authorizationDialogVisible = true"
        >
          授权并启用
        </el-button>
        <!--
          [IF isCustomSource && !requiresAuthorization] ele(el-button.source-detail__revoke)
          - condition:
              当前记录是已经获得运行授权的自定义脚本时渲染。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-button
          - description:
              撤销运行授权入口，默认源先交接，其他记录先二次确认。
          - params:
              无
          - events:
              @click
                  - description:
                      用户点击撤销运行授权时触发。
                  - methods:
                      handleRevokeAuthorization()
        -->
        <el-button
          v-if="isCustomSource && !requiresAuthorization"
          class="source-detail__revoke"
          @click="handleRevokeAuthorization"
        >
          撤销运行授权
        </el-button>
        <!--
          [DEFAULT] ele(el-button.source-detail__delete)
          - condition:
              默认渲染。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-button
          - description:
              删除入口，只打开 SourceDeleteDialog，不直接删除记录。
          - params:
              无
          - events:
              @click
                  - description:
                      用户点击删除时显示确认弹窗。
                  - methods:
                      deleteDialogVisible = true
        -->
        <el-button class="source-detail__delete" type="danger" plain @click="deleteDialogVisible = true">
          删除数据源
        </el-button>
      </div>
    </section>

    <!--
      [IF authorizationDialogVisible] ele(SourceAuthorizationDialog)
      - condition:
          自定义脚本等待用户授权且 authorizationDialogVisible 为 true 时显示。
      - type:
          自定义组件
          相对位置: ../components/settings/SourceAuthorizationDialog.vue
      - description:
          展示无沙盒风险，并在用户确认后提交授权和启用意图。
      - params:
          -- record：当前等待授权的数据源记录。
      - events:
          @confirm
              - description:
                  用户主动确认脚本运行风险时触发。
              - methods:
                  confirmAuthorization(sourceId)
                      -- sourceId：当前数据源唯一标识。
    -->
    <SourceAuthorizationDialog
      :visible.sync="authorizationDialogVisible"
      :record="record"
      @confirm="confirmAuthorization"
    />

    <!--
      [IF deleteDialogVisible] ele(SourceDeleteDialog)
      - condition:
          用户点击删除且 deleteDialogVisible 为 true 时显示。
      - type:
          自定义组件
          相对位置: ../components/settings/SourceDeleteDialog.vue
      - description:
          解释系统源软删除和自定义源实际删除结果，并收集确认。
      - params:
          -- record：当前等待删除的数据源记录。
      - events:
          @confirm
              - description:
                  用户确认删除当前数据源时触发。
              - methods:
                  confirmDelete(sourceId)
                      -- sourceId：等待删除的数据源唯一标识。
    -->
    <SourceDeleteDialog
      :visible.sync="deleteDialogVisible"
      :record="record"
      @confirm="confirmDelete"
    />

    <!--
      [IF defaultSourceDialogVisible] ele(SourceDisableDialog)
      - condition:
          更新、撤销授权或删除当前默认源前显示。
      - type:
          自定义组件
          相对位置: ../components/settings/SourceDisableDialog.vue
      - description:
          统一要求用户选择新默认源，或明确接受无默认源状态。
      - params:
          -- record：当前默认源记录。
          -- fallbackRecords：其他已启用数据源。
          -- operationDescription、confirmLabel：当前待执行操作的用户说明。
      - events:
          @confirm
              - description:
                  用户完成默认源选择或确认无默认源结果时触发。
              - methods:
                  confirmDefaultSourceTransition(payload)
                      -- payload：当前数据源 id 和候选默认源 id。
    -->
    <SourceDisableDialog
      :visible.sync="defaultSourceDialogVisible"
      :record="record"
      :fallback-records="fallbackRecords"
      :operation-description="defaultSourceOperationDescription"
      :confirm-label="defaultSourceOperationConfirmLabel"
      @confirm="confirmDefaultSourceTransition"
    />
  </article>

  <!--
    [ELSE] ele(section.source-detail-not-found.theme-surface)
    - condition:
        当前路由 sourceId 没有匹配可见记录时渲染。
    - type:
        原生标签
        标签名称: section
    - description:
        防止直接访问无效或已删除 id 时出现空白页面。
    - params:
        -- emptyImageSize：集中定义的空状态插图尺寸。
        -- operationPending：删除成功到路由返回之间保持加载反馈。
    - events:
        @click 调用 returnToSourceList()。
  -->
  <section v-else v-loading="operationPending" class="source-detail-not-found theme-surface">
    <!--
      [DEFAULT] ele(el-empty.source-detail-not-found__empty)
      - condition:
          record 不存在后默认渲染。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-empty
      - description:
          无效数据源详情空状态，说明当前 sourceId 没有可见记录。
      - params:
          -- emptyImageSize：统一空状态插图尺寸。
      - events:
          无
    -->
    <el-empty class="source-detail-not-found__empty" description="未找到该数据源" :image-size="emptyImageSize" />
    <!--
      [DEFAULT] ele(el-button.source-detail-not-found__back)
      - condition:
          record 不存在后默认渲染。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-button
      - description:
          无效详情返回按钮，引导用户回到可见数据源列表。
      - params:
          无
      - events:
          @click
              - description:
                  用户点击返回列表时触发。
              - methods:
                  returnToSourceList()
    -->
    <el-button class="source-detail-not-found__back" type="primary" @click="returnToSourceList">返回数据源列表</el-button>
  </section>
</template>

<script>
/*
  SourceDetailView.vue 模块说明

  - 文件职责:
      渲染单个数据源详情、状态、更新、授权、缓存和删除操作，并编排默认源交接。
      页面只维护弹窗和异步门禁，领域事务、Host补偿和投影发布由settingsService下层负责。

  - 导入库及文件汇总(10 条，内置 0 条，第三方 0 条，自定义 10 条):
      SourceBasicInfo: 展示数据源基本信息和在线字段。
      SourceGeneralSettings: 展示普通设置真实空态。
      SourceCacheSection: 展示并发出两级缓存清理意图。
      SourceAuthorizationDialog: 用户自主管理自定义脚本运行授权。
      SourceDeleteDialog: 区分系统源软删除和自定义源删除。
      SourceDisableDialog: 默认源更新、撤销授权或删除前完成用户可控交接。
      SETTINGS_ROUTE_NAME: 提供返回列表命名路由。
      settingsService exports: 操作共享 SourceManagerState，并提供 IMPORT_METHOD、SOURCE_KIND、HEALTH_STATUS 等状态枚举。
      getSourceRuntimeStatusReason: 统一读取 Provider 或健康不可用原因。

  - 模块级常量:
      EMPTY_IMAGE_SIZE: number，无效详情空状态插图尺寸。
      DEFAULT_SOURCE_ACTION: object，需要先完成默认源交接的详情操作枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      默认Vue组件配置: object，供数据源详情命名路由渲染。
*/
// 导入来源: ../components/settings/SourceBasicInfo.vue。
// 导入内容: SourceBasicInfo 基本信息组件。
// 文件作用: 展示当前数据源身份、运行状态、在线字段和页面能力。
import SourceBasicInfo from '../components/settings/SourceBasicInfo.vue';
// 导入来源: ../components/settings/SourceGeneralSettings.vue。
// 导入内容: SourceGeneralSettings 普通设置组件。
// 文件作用: 展示预留设置边界和当前真实空状态。
import SourceGeneralSettings from '../components/settings/SourceGeneralSettings.vue';
// 导入来源: ../components/settings/SourceCacheSection.vue。
// 导入内容: SourceCacheSection 缓存空间组件。
// 文件作用: 展示两级缓存占用并接收清理意图。
import SourceCacheSection from '../components/settings/SourceCacheSection.vue';
// 导入来源: ../components/settings/SourceAuthorizationDialog.vue。
// 导入内容: SourceAuthorizationDialog 授权弹窗组件。
// 文件作用: 让用户确认自定义脚本风险并提交授权。
import SourceAuthorizationDialog from '../components/settings/SourceAuthorizationDialog.vue';
// 导入来源: ../components/settings/SourceDeleteDialog.vue。
// 导入内容: SourceDeleteDialog 删除确认组件。
// 文件作用: 解释系统源软删除和自定义源实际删除结果。
import SourceDeleteDialog from '../components/settings/SourceDeleteDialog.vue';
// 导入来源: ../components/settings/SourceDisableDialog.vue。
// 导入内容: SourceDisableDialog 默认源交接组件。
// 文件作用: 更新、撤销授权或删除默认源前完成候选源选择。
import SourceDisableDialog from '../components/settings/SourceDisableDialog.vue';

import {
  // 导入来源: ../config/settings-module.config。
  // 导入内容: SETTINGS_ROUTE_NAME 设置模块路由名称枚举。
  // 文件作用: 返回数据源列表时使用统一命名路由。
  SETTINGS_ROUTE_NAME
} from '../config/settings-module.config';

import {
  // 导入来源: ../services/settingsService。
  // 导入内容: HEALTH_STATUS 健康状态枚举。
  // 文件作用: 判断检测中和不可用状态。
  HEALTH_STATUS,
  // 导入来源: ../services/settingsService。
  // 导入内容: IMPORT_METHOD 导入方式枚举。
  // 文件作用: 判断是否显示在线更新操作。
  IMPORT_METHOD,
  // 导入来源: ../services/settingsService。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 区分自定义源和系统源流程。
  SOURCE_KIND,
  // 导入来源: ../services/settingsService。
  // 导入内容: SOURCE_KIND_FILTER 来源筛选枚举。
  // 文件作用: 查询全部可见记录及候选源。
  SOURCE_KIND_FILTER,
  // 导入来源: ../services/settingsService。
  // 导入内容: applySourceUpdate 更新应用函数。
  // 文件作用: 提交在线脚本模拟更新事务。
  applySourceUpdate,
  // 导入来源: ../services/settingsService。
  // 导入内容: authorizeSource 授权函数。
  // 文件作用: 原子保存用户授权并启用当前自定义源。
  authorizeSource,
  // 导入来源: ../services/settingsService。
  // 导入内容: checkSource 单源检测函数。
  // 文件作用: 执行当前记录模拟健康检测。
  checkSource,
  // 导入来源: ../services/settingsService。
  // 导入内容: checkSourceUpdate 更新检查函数。
  // 文件作用: 检查远程导入脚本可用版本。
  checkSourceUpdate,
  // 导入来源: ../services/settingsService。
  // 导入内容: clearAllSourceCache 全部缓存清理函数。
  // 文件作用: 清理当前源全部运行缓存。
  clearAllSourceCache,
  // 导入来源: ../services/settingsService。
  // 导入内容: clearTemporarySourceCache 临时缓存清理函数。
  // 文件作用: 清理当前源可重新生成缓存。
  clearTemporarySourceCache,
  // 导入来源: ../services/settingsService。
  // 导入内容: deleteSource 删除函数。
  // 文件作用: 原子交接并软删除系统源或实际删除自定义源。
  deleteSource,
  // 导入来源: ../services/settingsService。
  // 导入内容: downloadSourceScript 脚本导出函数。
  // 文件作用: 下载当前源脚本且不包含缓存。
  downloadSourceScript,
  // 导入来源: ../services/settingsService。
  // 导入内容: getSourceManagerState 共享状态读取函数。
  // 文件作用: 判断当前默认源。
  getSourceManagerState,
  // 导入来源: ../services/settingsService。
  // 导入内容: getSourceAuthorizationState 有效授权读取函数。
  // 文件作用: 统一详情文案、按钮和启用判断。
  getSourceAuthorizationState,
  // 导入来源: ../services/settingsService。
  // 导入内容: getSourceRecords 可见记录查询函数。
  // 文件作用: 匹配路由记录和候选默认源。
  getSourceRecords,
  // 导入来源: ../services/settingsService。
  // 导入内容: isSourceRecordRunnable 全局可运行资格函数。
  // 文件作用: 统一详情检测、默认源按钮和交接候选资格。
  isSourceRecordRunnable,
  // 导入来源: ../services/settingsService。
  // 导入内容: revokeSourceAuthorization 撤销授权函数。
  // 文件作用: 原子交接、撤销授权并关闭自定义源。
  revokeSourceAuthorization,
  // 导入来源: ../services/settingsService。
  // 导入内容: setDefaultSource 默认源设置函数。
  // 文件作用: 设置默认源或等待更新前的用户交接选择。
  setDefaultSource
} from '../services/settingsService';

// 导入来源: ../utils/settingsDisplay。
// 导入内容: getSourceRuntimeStatusReason 状态原因函数。
// 文件作用: 警示区与基本信息使用同一 Provider 优先原因。
import { getSourceRuntimeStatusReason } from '../utils/settingsDisplay';

// 导入来源: ../utils/sourceDisplayName.js。
// 导入内容: formatSourceDisplayName 数据源显示名称适配函数。
// 文件作用: 让数据源详情标题遵守全站十个 Unicode 字符显示边界，同时保留完整 record 供身份字段展示。
import { formatSourceDisplayName } from '../utils/sourceDisplayName.js';

// 类型: number。
// 作用: 统一无效详情空状态插图尺寸，避免模板使用魔法数字。
const EMPTY_IMAGE_SIZE = 104;

// 类型: object。
// 作用: 标识需要先完成默认源交接的详情操作，避免使用布尔组合判断待继续动作。
const DEFAULT_SOURCE_ACTION = Object.freeze({
  // 类型: string。
  // 作用: 标识默认源交接完成后继续应用脚本更新。
  update: 'update',
  // 类型: string。
  // 作用: 标识默认源交接完成后继续撤销运行授权。
  revokeAuthorization: 'revoke-authorization',
  // 类型: string。
  // 作用: 标识默认源交接完成后继续删除数据源。
  deleteSource: 'delete-source'
});

export default {
  // 类型: string。
  // 作用: 声明组件调试名称，供 Vue Devtools、路由错误和堆栈识别详情页。
  name: 'SourceDetailView',

  /*
    components 注册详情展示、缓存和确认流程组件。
    注册名与 template 标签名及顶部渲染树 ele(...) 标识保持一致。
  */
  components: {
    // 组件: SourceBasicInfo；作用: 展示基本信息和在线字段。
    SourceBasicInfo,
    // 组件: SourceGeneralSettings；作用: 展示普通设置真实空状态。
    SourceGeneralSettings,
    // 组件: SourceCacheSection；作用: 展示缓存并发出清理意图。
    SourceCacheSection,
    // 组件: SourceAuthorizationDialog；作用: 收集自定义脚本运行授权。
    SourceAuthorizationDialog,
    // 组件: SourceDeleteDialog；作用: 确认系统源或自定义源删除。
    SourceDeleteDialog,
    // 组件: SourceDisableDialog；作用: 完成默认源交接。
    SourceDisableDialog
  },

  /**
   * 创建详情页局部流程状态。
   * 只保存弹窗可见状态和待继续动作，不复制数据源业务记录。
   * 副作用: Vue实例创建时生成页面局部响应式状态，不修改领域投影。
   *
   * @returns {object} 详情页局部对话框状态。
   * @returns {boolean} return.authorizationDialogVisible 授权弹窗可见状态。
   * @returns {boolean} return.deleteDialogVisible 删除弹窗可见状态。
   * @returns {boolean} return.defaultSourceDialogVisible 默认源交接弹窗可见状态。
   * @returns {string} return.pendingDefaultSourceAction 交接完成后待继续动作。
   * @returns {boolean} return.operationPending true表示一个详情设置事务尚未收敛，false允许继续交互。
   */
  data() {
    return {
      // 类型: boolean。
      // 初始值: false；true 显示自定义脚本授权弹窗，false 隐藏。
      authorizationDialogVisible: false,
      // 类型: boolean。
      // 初始值: false；true 显示数据源删除确认，false 隐藏。
      deleteDialogVisible: false,
      // 类型: boolean。
      // 初始值: false；true 显示默认源交接弹窗，false 隐藏。
      defaultSourceDialogVisible: false,
      // 类型: string。
      // 初始值: 空字符串，表示没有等待继续的默认源操作。
      // 作用: 保存默认源交接完成后要继续的更新、撤销授权或删除动作。
      pendingDefaultSourceAction: '',
      // 类型: boolean。
      // 初始值: false；true显示页面级加载门禁并阻止重复操作，false恢复详情交互。
      operationPending: false
    };
  },

  computed: {
    /**
     * 计算当前路由对应的可见数据源记录。
     * 数据来源: route.params.sourceId 和 settingsService 可见记录数组。
     * 软删除系统源不会匹配，未找到时返回 null 并触发详情空状态。
     * 副作用: 无，只从路由和当前投影定位记录。
     *
     * @returns {object|null} 当前数据源记录或 null。
     */
    record() {
      // 类型: string。
      // 作用: 读取路由中的数据源 id，作为共享记录匹配条件。
      const sourceId = this.$route.params.sourceId;

      // 循环类型: Array.prototype.find。
      // 初始值: 全部可见记录中的第一条。
      // 终止条件: 找到 id 匹配记录，或全部记录检查完成。
      // 循环作用: 使用共享状态实时解析详情目标，不保存记录副本。
      return getSourceRecords(SOURCE_KIND_FILTER.all)
        .find(record => record.definition.id === sourceId) || null;
    },

    /**
     * 派生详情页标题使用的数据源短名称。
     * 纯函数: 只读取共享 record.definition.name，不修改详情记录或路由。
     * 失败路径: record 尚未匹配时返回稳定占位文案。
     *
     * @returns {string} 十个 Unicode 字符以内的数据源显示名称。
     */
    displaySourceName() {
      return formatSourceDisplayName(this.record?.definition?.name, this.record?.definition?.id);
    },

    /**
     * 判断当前记录是否为共享默认源。
     * 数据来源: record.definition.id 和 SourceManagerState.defaultSourceId。
     * true 影响默认源按钮和更新、撤销授权、删除前置交接流程。
     * 副作用: 无，只返回布尔派生值。
     *
     * @returns {boolean} 当前记录是否为默认源。
     */
    isDefaultSource() {
      return Boolean(this.record && getSourceManagerState().defaultSourceId === this.record.definition.id);
    },

    /**
     * 判断当前记录是否为自定义数据源。
     * 数据来源: record.definition.sourceKind。
     * true 启用授权和更新后重新授权边界，false 使用系统源流程。
     * 副作用: 无，只返回布尔派生值。
     *
     * @returns {boolean} 当前记录是否为用户导入脚本。
     */
    isCustomSource() {
      return Boolean(this.record && this.record.definition.sourceKind === SOURCE_KIND.custom);
    },

    /**
     * 读取当前数据源的有效运行授权状态。
     * 数据来源: 当前共享 record 和 settingsService 统一授权评估规则。
     * 该对象同时驱动基本信息文案和授权操作分支，不修改共享状态。
     * 副作用: 无，只读取统一授权评估结果。
     *
     * @returns {object} 当前记录有效授权评估结果。
     * @returns {string} return.effectiveStatus 页面应展示的授权状态。
     * @returns {boolean} return.requiresAuthorization 是否需要用户重新确认风险。
     */
    authorizationState() {
      // 返回值类型: object。
      // 作用: 使用 service 唯一授权读取入口，避免组件分别比较原始状态、版本和脚本哈希。
      return getSourceAuthorizationState(this.record);
    },

    /**
     * 判断当前记录是否通过在线地址导入。
     * 数据来源: record.definition.importMethod。
     * true 显示检查更新和应用更新入口，false 隐藏远程专属操作。
     * 副作用: 无，只返回布尔派生值。
     *
     * @returns {boolean} 当前记录是否为 remote 导入方式。
     */
    isRemoteSource() {
      return Boolean(this.record && this.record.definition.importMethod === IMPORT_METHOD.remote);
    },

    /**
     * 判断当前记录是否正在健康检测。
     * 数据来源: record.runtime.healthStatus。
     * true 驱动检测按钮加载状态，false 展示普通按钮状态。
     * 副作用: 无，只返回布尔派生值。
     *
     * @returns {boolean} 当前记录是否处于 checking 状态。
     */
    isChecking() {
      return Boolean(this.record && this.record.runtime.healthStatus === HEALTH_STATUS.checking);
    },

    /**
     * 判断当前记录是否具备全局可运行资格。
     * 数据来源: 当前 record 和 settingsService 统一启用、授权、Provider 就绪门禁。
     * true 允许检测和成为默认源，false 只保留管理、启停、授权和缓存操作。
     * 副作用: 无，只派生详情操作资格。
     *
     * @returns {boolean} 当前记录是否可以进入运行类操作。
     */
    isRunnable() {
      return isSourceRecordRunnable(this.record);
    },

    /**
     * 判断是否需要展示不可用原因提示。
     * 数据来源: record.runtime.enabled 和统一状态原因。
     * 已启用但 Provider 未就绪或健康检测不可用时返回 true，关闭状态不重复展示警告。
     * 副作用: 无，只返回布尔派生值。
     *
     * @returns {boolean} 是否展示不可用提示。
     */
    isUnavailable() {
      return Boolean(this.record && getSourceRuntimeStatusReason(this.record));
    },

    /**
     * 计算当前数据源不可用原因。
     * 数据来源: 统一展示工具中的 Provider 就绪原因和健康检测原因优先级。
     * Provider 未就绪时不会回退到历史健康原因，避免把缺少脚本执行能力解释成网络检测失败。
     * 副作用: 无，只返回真实或兜底展示文本。
     *
     * @returns {string} 当前 Provider 或健康不可用原因；其他状态返回空字符串。
     */
    unavailableReason() {
      return getSourceRuntimeStatusReason(this.record);
    },

    /**
     * 判断当前记录是否允许设为默认源。
     * 数据来源: isRunnable 和 isDefaultSource。
     * 只有通过全局可运行门禁且尚非默认源的记录返回 true。
     * 副作用: 无，只返回按钮可用性布尔值。
     *
     * @returns {boolean} “设为默认”按钮是否可用。
     */
    canSetDefault() {
      return this.isRunnable && !this.isDefaultSource;
    },

    /**
     * 计算默认源交接候选记录。
     * 数据来源: 全部可见记录和当前 record。
     * 排除当前记录与不可运行记录，保证候选源可立即接替。
     * 副作用: 无，只创建候选记录新数组。
     *
     * @returns {Array<object>} 其他具备全局可运行资格的可见数据源记录。
     */
    fallbackRecords() {
      // 条件分支: 当前路由没有匹配记录时进入。
      // 执行内容: 返回空数组，交接弹窗将要求用户确认无默认源结果。
      if (!this.record) return [];

      // 循环类型: Array.prototype.filter。
      // 初始值: 全部可见记录中的第一条。
      // 终止条件: 全部记录检查完成。
      // 循环作用: 生成排除当前记录的全局可运行候选源。
      return getSourceRecords(SOURCE_KIND_FILTER.all).filter((candidateRecord) => {
        // 返回值类型: boolean。
        // 作用: 只有 id 不同且通过启用、授权与 Provider 就绪门禁的记录进入候选数组。
        return candidateRecord.definition.id !== this.record.definition.id
          && isSourceRecordRunnable(candidateRecord);
      });
    },

    /**
     * 计算默认源交接原因说明。
     * 数据来源: pendingDefaultSourceAction 和本地动作说明映射。
     * 不同后续动作展示真实影响，未知动作使用通用交接说明。
     * 副作用: 无，只创建局部映射并返回文案。
     *
     * @returns {string} 默认源交接弹窗操作说明。
     */
    defaultSourceOperationDescription() {
      // 类型: object。
      // 作用: 将待继续动作映射为用户可理解的交接原因。
      const descriptions = {
        // 更新会重新授权并暂时关闭当前自定义源。
        [DEFAULT_SOURCE_ACTION.update]: '脚本更新后需要重新授权并暂时关闭，继续前需要选择新的默认数据源。',
        // 撤销授权会同步关闭当前自定义源。
        [DEFAULT_SOURCE_ACTION.revokeAuthorization]: '撤销授权会同时关闭该数据源，继续前需要选择新的默认数据源。',
        // 删除会移除或隐藏当前默认源。
        [DEFAULT_SOURCE_ACTION.deleteSource]: '删除该数据源前需要选择新的默认数据源。'
      };
      // 条件分支: 映射中存在待继续动作时返回专用说明，否则返回通用说明。
      return descriptions[this.pendingDefaultSourceAction] || '继续操作前需要选择新的默认数据源。';
    },

    /**
     * 计算默认源交接确认按钮文案。
     * 数据来源: pendingDefaultSourceAction 和本地按钮文案映射。
     * 文案明确交接完成后执行的动作，未知动作使用“继续”。
     * 副作用: 无，只创建局部映射并返回按钮文案。
     *
     * @returns {string} 默认源交接确认按钮文案。
     */
    defaultSourceOperationConfirmLabel() {
      // 类型: object。
      // 作用: 将待继续动作映射为明确的确认按钮文案。
      const labels = {
        // 默认源交接后应用在线脚本更新。
        [DEFAULT_SOURCE_ACTION.update]: '切换并更新',
        // 默认源交接后撤销自定义脚本授权。
        [DEFAULT_SOURCE_ACTION.revokeAuthorization]: '切换并撤销授权',
        // 默认源交接后删除当前数据源。
        [DEFAULT_SOURCE_ACTION.deleteSource]: '切换并删除'
      };
      // 条件分支: 映射中存在待继续动作时返回专用文案，否则返回“继续”。
      return labels[this.pendingDefaultSourceAction] || '继续';
    },

    /**
     * 判断当前记录是否需要运行授权。
     * 数据来源: 当前 record 和 settingsService 授权规则。
     * true 显示授权入口，false 表示当前记录无需或已经获得授权。
     * 副作用: 无，只复用统一授权派生结果。
     *
     * @returns {boolean} 是否需要用户确认脚本运行风险。
     */
    requiresAuthorization() {
      // 返回值类型: boolean。
      // 作用: 直接复用 authorizationState，保证授权按钮和基本信息展示来自同一评估结果。
      return this.authorizationState.requiresAuthorization;
    },

    /**
     * 读取无效详情空状态插图尺寸。
     * 数据来源: 模块级 EMPTY_IMAGE_SIZE 常量。
     * 该计算属性只向模板暴露集中尺寸，不修改页面状态。
     * 副作用: 无，只返回集中尺寸常量。
     *
     * @returns {number} Element UI el-empty image-size。
     */
    emptyImageSize() {
      // 返回值类型: number。
      // 作用: 避免模板直接使用魔法数字，并统一无效详情视觉。
      return EMPTY_IMAGE_SIZE;
    }
  },

  methods: {
    /**
     * 执行一个详情设置异步操作并统一收敛交互状态。
     * 调用方: 本详情容器所有会触发settingsService副作用的方法。
     * 副作用: operationPending为true时显示Element UI加载门禁，finally始终恢复为false。
     * 成功路径: 等待Runtime事务、Host补偿和投影发布完成后返回结果。
     * 失败路径: 显示用户动作上下文和Error摘要，返回未完成结果且不显示成功反馈。
     *
     * @param {Function} operation 无参数异步操作，返回settingsService Promise。
     * @param {string} failureMessage 当前用户动作失败时的上下文文案。
     * @returns {Promise<{completed: boolean, result: *}>} 操作是否成功收敛及其返回值。
     */
    async executeSettingsOperation(operation, failureMessage) {
      // 条件分支: 已有详情事务尚未收敛时拒绝重复提交。
      // 执行内容: 返回未完成结果，不覆盖当前loading生命周期。
      if (this.operationPending) return { completed: false, result: null };

      // 页面局部副作用: 打开根容器加载门禁，阻止并发用户意图。
      this.operationPending = true;
      try {
        // 类型: *。
        // 作用: 保存service在Runtime和投影完整收敛后的业务返回值。
        const result = await operation();
        return { completed: true, result };
      } catch (error) {
        // 类型: string。
        // 作用: 只采用标准Error消息补充上下文，未知拒绝值不直接渲染到页面。
        const errorDetail = error instanceof Error && error.message ? `：${error.message}` : '';
        this.$message.error(`${failureMessage}${errorDetail}`);
        return { completed: false, result: null };
      } finally {
        // finally副作用: 成功或失败后都恢复页面交互，避免永久loading。
        this.operationPending = false;
      }
    },

    /**
     * 返回数据源列表页。
     * 触发来源: 详情页返回按钮或删除完成后的收口流程。
     * 副作用: 通过 vue-router 跳转到统一数据源列表命名路由。
     *
     * @returns {void} 该方法只触发路由导航。
     */
    returnToSourceList() {
      // 副作用: 更新浏览器地址和设置工作区内容为数据源列表。
      this.$router.push({ name: SETTINGS_ROUTE_NAME.sources });
    },

    /**
     * 检测当前数据源健康状态。
     * 触发来源: 用户点击“检测”按钮。
     * 副作用: 通过service提交检测并显示成功或错误反馈。
     * 成功路径: 等待 service 完成 mock 检测后显示成功消息。
     * 失败路径: 执行器显示错误并恢复loading，不显示成功。
     *
     * @returns {Promise<void>} 检测完成后兑现，不返回业务数据。
     */
    async handleCheckSource() {
      // 类型: {completed: boolean, result: object|null}。
      // 作用: 保存单源检测事务是否完成及最终记录。
      const operationResult = await this.executeSettingsOperation(
        () => checkSource(this.record.definition.id),
        '数据源检测失败'
      );
      // 条件分支: 检测和投影发布成功时进入。
      // 执行内容: 显示成功；失败时沿用执行器错误反馈。
      if (operationResult.completed) this.$message.success('数据源检测完成');
    },

    /**
     * 把当前已启用数据源设为默认源。
     * 触发来源: 用户点击可用的“设为默认”按钮。
     * 副作用: service 更新共享 defaultSourceId 并显示成功消息。
     * 成功路径: Runtime完成且目标可选时显示成功。
     * 失败路径: 执行器显示错误；目标不可选时不误报成功。
     *
     * @returns {Promise<void>} 默认源事务和反馈收敛后兑现。
     */
    async handleSetDefault() {
      // 类型: {completed: boolean, result: boolean|null}。
      // 作用: 保存默认源事务完成状态和目标可选结果。
      const operationResult = await this.executeSettingsOperation(
        () => setDefaultSource(this.record.definition.id),
        '默认数据源设置失败'
      );
      // 条件分支: Runtime成功且service确认目标已成为默认源时进入。
      // 执行内容: 显示成功；其他路径不误报。
      if (operationResult.completed && operationResult.result) {
        this.$message.success('已设为默认数据源');
      }
    },

    /**
     * 检查在线导入脚本是否存在更新。
     * 触发来源: 用户点击远程源“检查更新”按钮。
     * 副作用: 通过service提交更新检测，并根据最终投影显示反馈。
     * 成功路径: 等待 mock 检查完成，并按 updateAvailable 显示结果。
     * 失败路径: 执行器显示错误并恢复loading，不读取过渡状态。
     *
     * @returns {Promise<void>} 更新检查完成后兑现。
     */
    async handleCheckUpdate() {
      // 类型: {completed: boolean, result: object|null}。
      // 作用: 保存更新检测是否完成和最终记录。
      const operationResult = await this.executeSettingsOperation(
        () => checkSourceUpdate(this.record.definition.id),
        '数据源更新检查失败'
      );
      // 条件分支: 检测失败时退出。
      // 执行内容: 不读取可能仍在变化的runtime，也不显示成功。
      if (!operationResult.completed) return;
      // 三目条件: 更新后的 runtime.updateAvailable 是否为 true。
      // true 分支: 提示发现可用更新。
      // false 分支: 提示当前已经是最新版本。
      this.$message.success(this.record.runtime.updateAvailable ? '发现可用更新' : '当前已是最新版本');
    },

    /**
     * 协调在线脚本更新流程。
     * 自定义默认源更新前先打开默认源交接；其他记录直接执行更新。
     * 触发来源: 用户点击“应用更新”按钮。
     * 副作用: 打开默认源交接弹窗，或直接提交更新流程。
     * 成功路径: 交接分支保存动作，普通分支等待更新完成。
     * 失败路径: 更新失败由统一执行器反馈并恢复loading。
     *
     * @returns {Promise<void>} 直接更新路径完成后兑现；交接路径提前结束。
     */
    async handleApplyUpdate() {
      // 条件分支: 当前记录同时是自定义源和默认源时进入。
      // 执行内容: 打开默认源交接弹窗，避免更新后重新授权导致默认源突然关闭。
      if (this.isCustomSource && this.isDefaultSource) {
        this.openDefaultSourceTransition(DEFAULT_SOURCE_ACTION.update);
        return;
      }
      await this.performApplyUpdate();
    },

    /**
     * 执行已满足默认源边界的脚本更新。
     * 触发来源: 普通更新路径或默认源交接完成后的继续动作。
     * 副作用: 可先等待用户选择的默认源切换，再通过service提交更新并显示反馈。
     * 成功路径: service 应用 mock 更新并按数据源类型显示结果。
     * 失败路径: 默认源候选不可用或更新失败由执行器显示错误。
     *
     * @param {string|undefined} fallbackSourceId 默认源更新前的用户接替选择；无交接流程时省略。
     * @returns {Promise<void>} 默认源交接和更新事务完成后兑现。
     */
    async performApplyUpdate(fallbackSourceId) {
      // 类型: {completed: boolean, result: object|null}。
      // 作用: 保存可选默认源切换和更新应用整条页面流程的完成结果。
      const operationResult = await this.executeSettingsOperation(async () => {
        // 条件分支: 交接弹窗提供了非空候选源时进入。
        // 执行内容: 先等待用户选择生效，再提交会让当前自定义默认源失效的更新。
        if (fallbackSourceId) {
          // 类型: boolean。
          // 作用: 保存用户选择的接替源是否仍然有效启用。
          const changed = await setDefaultSource(fallbackSourceId);
          // 条件分支: 候选在用户确认后已经不可用时失败关闭。
          // 执行内容: 抛出明确错误，不继续更新当前默认源。
          if (!changed) throw new Error('用户选择的新默认数据源当前不可用');
        }
        return applySourceUpdate(this.record.definition.id);
      }, '数据源更新应用失败');
      // 条件分支: 默认源交接或更新应用失败时退出。
      // 执行内容: 不显示脚本更新成功反馈。
      if (!operationResult.completed) return;

      // 三目条件: 当前记录是否为自定义源。
      // true 分支: 提示脚本内容变化后需要重新授权才能启用。
      // false 分支: 提示系统数据源脚本已经更新。
      this.$message.success(
        this.isCustomSource
          ? '脚本已更新；内容发生变化，需要重新授权后才能启用'
          : '数据源脚本已更新'
      );
    },

    /**
     * 导出当前数据源脚本。
     * 触发来源: 用户点击“导出脚本”按钮。
     * 副作用: service 触发浏览器下载，只包含脚本，不包含缓存和个人数据。
     * 成功路径: Runtime读取并触发下载后显示成功。
     * 失败路径: 执行器显示错误；目标失效时不误报成功。
     *
     * @returns {Promise<void>} Runtime读取和浏览器下载完成后兑现。
     */
    async handleExportScript() {
      // 类型: {completed: boolean, result: boolean|null}。
      // 作用: 保存脚本读取和浏览器下载是否完成。
      const operationResult = await this.executeSettingsOperation(
        () => downloadSourceScript(this.record.definition.id),
        '数据源脚本导出失败'
      );
      // 条件分支: 下载流程完成且目标脚本存在时进入。
      // 执行内容: 显示成功；其他路径不误报。
      if (operationResult.completed && operationResult.result) {
        this.$message.success('数据源脚本已导出');
      }
    },

    /**
     * 确认当前自定义数据源运行授权。
     * 触发来源: SourceAuthorizationDialog 的 confirm 事件。
     * 副作用: 通过service原子写入授权和启用状态，并显示反馈。
     * 成功路径: Runtime授权、启用和Host补偿完整收敛后显示成功。
     * 失败路径: 执行器显示错误，不显示成功。
     *
     * @param {string} sourceId 用户确认授权的数据源 id。
     * @returns {Promise<void>} 原子授权启用事务完成后兑现。
     */
    async confirmAuthorization(sourceId) {
      // 类型: {completed: boolean, result: object|null}。
      // 作用: 保存原子授权启用事务完成结果。
      const operationResult = await this.executeSettingsOperation(
        () => authorizeSource(sourceId, true),
        '自定义数据源授权启用失败'
      );
      // 条件分支: 授权和启用完整成功时进入。
      // 执行内容: 显示成功；失败反馈由执行器负责。
      if (operationResult.completed) this.$message.success('已授权并启用该自定义数据源');
    },

    /**
     * 协调撤销自定义脚本运行授权流程。
     * 默认源先完成交接，其他记录显示二次确认后撤销授权并同步关闭。
     * 用户取消属于正常退出，其他异常继续抛出。
     * 副作用: 打开交接或确认弹窗，确认后通过service提交撤销事务。
     * 成功路径: 默认源进入交接；普通源确认后等待撤销并显示成功。
     * 失败路径: 用户取消正常退出，Runtime失败由执行器显示错误。
     *
     * @returns {Promise<void>} 确认流程结束后兑现。
     */
    async handleRevokeAuthorization() {
      // 条件分支: 当前记录是默认源时进入。
      // 执行内容: 先打开默认源交接弹窗，不直接撤销授权。
      if (this.isDefaultSource) {
        this.openDefaultSourceTransition(DEFAULT_SOURCE_ACTION.revokeAuthorization);
        return;
      }

      try {
        // 异步交互: 等待用户确认撤销授权会同步关闭数据源的影响。
        await this.$confirm(
          '撤销授权后，该自定义数据源会同时关闭；以后重新启用时需要再次确认风险。',
          '撤销运行授权',
          { type: 'warning', confirmButtonText: '撤销授权', cancelButtonText: '取消' }
        );
        // 类型: {completed: boolean, result: boolean|null}。
        // 作用: 保存撤销授权和关闭事务是否完整收敛。
        const operationResult = await this.executeSettingsOperation(
          () => revokeSourceAuthorization(this.record.definition.id),
          '运行授权撤销失败'
        );
        // 条件分支: 撤销授权事务成功时进入。
        // 执行内容: 显示成功；失败时只保留执行器错误反馈。
        if (operationResult.completed) this.$message.success('已撤销运行授权并关闭数据源');
      } catch (action) {
        // 用户取消确认时不修改共享状态；Element UI 使用 cancel 或 close 表示正常退出。
        // 条件分支: action 不是 cancel 或 close 时继续抛出真实异常。
        // 执行内容: 保留非取消异常给Vue错误链，正常取消不显示错误。
        if (action !== 'cancel' && action !== 'close') throw action;
      }
    },

    /**
     * 清理当前数据源临时缓存。
     * 触发来源: SourceCacheSection 的 clear-temporary 事件。
     * 副作用: service 清理可重新生成缓存并显示成功消息，保留其他运行数据。
     * 成功路径: 缓存事务和Host恢复完成后显示成功。
     * 失败路径: 执行器显示错误并恢复loading。
     *
     * @returns {Promise<void>} 临时缓存事务和反馈收敛后兑现。
     */
    async handleClearTemporaryCache() {
      // 类型: {completed: boolean, result: boolean|null}。
      // 作用: 保存临时缓存清理事务完成结果。
      const operationResult = await this.executeSettingsOperation(
        () => clearTemporarySourceCache(this.record.definition.id),
        '临时缓存清理失败'
      );
      // 条件分支: 缓存清理成功时进入。
      // 执行内容: 显示成功；失败反馈由执行器负责。
      if (operationResult.completed) this.$message.success('临时缓存已清理');
    },

    /**
     * 清理当前数据源全部运行缓存。
     * 触发来源: SourceCacheSection 的 clear-all 事件。
     * 用户确认后清理请求头、Cookie、Token、会话和验证上下文等缓存。
     * 用户取消属于正常退出，其他异常继续抛出。
     * 副作用: 打开确认框，确认后通过service清理全部运行缓存并显示反馈。
     * 成功路径: 清理和Host恢复完成后显示成功。
     * 失败路径: 用户取消正常退出，Runtime失败由执行器显示错误。
     *
     * @returns {Promise<void>} 确认和清理流程结束后兑现。
     */
    async handleClearAllCache() {
      try {
        // 异步交互: 等待用户确认全部缓存清理边界和后续可能重新验证的影响。
        await this.$confirm(
          '该操作会清理请求头运行数据、Cookie、Token、会话和验证上下文等全部缓存，后续请求可能需要重新验证。数据源脚本、基本信息、启用状态、默认源和运行授权会保留。',
          '清理全部缓存',
          { type: 'warning', confirmButtonText: '清理全部缓存', cancelButtonText: '取消' }
        );
        // 类型: {completed: boolean, result: boolean|null}。
        // 作用: 保存全部缓存清理和Host恢复是否完成。
        const operationResult = await this.executeSettingsOperation(
          () => clearAllSourceCache(this.record.definition.id),
          '全部缓存清理失败'
        );
        // 条件分支: 全部缓存清理成功时进入。
        // 执行内容: 显示成功；失败时沿用执行器反馈。
        if (operationResult.completed) this.$message.success('全部缓存已清理');
      } catch (action) {
        // 用户取消确认时不执行缓存清理，也不把正常取消显示为错误。
        // 条件分支: action 不是 cancel 或 close 时继续抛出真实异常。
        // 执行内容: 保留非取消异常给Vue错误链，正常取消不显示错误。
        if (action !== 'cancel' && action !== 'close') throw action;
      }
    },

    /**
     * 协调当前数据源删除流程。
     * 默认源删除前先完成交接，其他记录直接执行已经确认的删除。
     * 触发来源: SourceDeleteDialog 的 confirm 事件。
     * 副作用: 打开默认源交接弹窗，或等待统一删除事务完成。
     * 成功路径: 默认源保存待处理动作；普通源删除后返回列表。
     * 失败路径: 删除失败由执行器反馈并保留详情页面。
     *
     * @param {string} sourceId 用户确认删除的数据源 id。
     * @returns {Promise<void>} 交接弹窗打开或删除事务完成后兑现。
     */
    async confirmDelete(sourceId) {
      // 条件分支: 当前记录是默认源时进入。
      // 执行内容: 保存删除动作并打开交接弹窗，不提前删除。
      if (this.isDefaultSource) {
        this.openDefaultSourceTransition(DEFAULT_SOURCE_ACTION.deleteSource);
        return;
      }
      await this.performDelete(sourceId);
    },

    /**
     * 执行已完成全部前置确认的数据源删除。
     * 系统源执行可恢复软删除，自定义源执行脚本和缓存实际删除。
     * 删除后显示对应消息并返回列表页。
     * 副作用: 通过service提交删除；成功后显示反馈并执行路由导航。
     * 成功路径: Runtime删除和交接完成后返回列表。
     * 失败路径: 执行器显示错误并保留当前详情。
     *
     * @param {string} sourceId 已完成全部前置确认的数据源 id。
     * @param {string|undefined} fallbackSourceId 删除默认源时的用户接替选择；空字符串表示接受无默认源。
     * @returns {Promise<void>} 删除事务、反馈和路由导航完成后兑现。
     */
    async performDelete(sourceId, fallbackSourceId) {
      // 类型: boolean。
      // 作用: 在删除前保存来源类型，供记录移除后生成正确反馈文案。
      const wasSystemSource = this.record.definition.sourceKind === SOURCE_KIND.system;
      // 类型: {completed: boolean, result: boolean|null}。
      // 作用: 保存删除和默认源交接事务是否成功完成。
      const operationResult = await this.executeSettingsOperation(
        () => deleteSource(sourceId, fallbackSourceId),
        '数据源删除失败'
      );
      // 条件分支: Runtime失败或目标已经失效时退出。
      // 执行内容: 不显示成功，也不离开当前详情。
      if (!operationResult.completed || !operationResult.result) return;
      this.$message.success(wasSystemSource ? '系统源已隐藏，可在列表页恢复' : '自定义数据源已删除');
      this.returnToSourceList();
    },

    /**
     * 打开默认源交接流程。
     * 保存交接完成后待继续的动作，并显示 SourceDisableDialog。
     * 触发来源: 默认源更新、撤销授权或删除分支。
     * 副作用: 更新pendingDefaultSourceAction并显示交接弹窗。
     *
     * @param {string} actionName 默认源交接后要继续执行的动作标识。
     * @returns {void} 该方法只修改详情页局部流程状态。
     */
    openDefaultSourceTransition(actionName) {
      // 类型: string。
      // 作用: 保存交接完成后待继续动作，驱动弹窗说明、按钮文案和确认分支。
      this.pendingDefaultSourceAction = actionName;
      // 类型: boolean。
      // 作用: 显示默认源交接弹窗，等待用户选择候选源或确认无默认源结果。
      this.defaultSourceDialogVisible = true;
    },

    /**
     * 完成用户明确选择的默认源交接，并继续原更新、撤销授权或删除动作。
     * 撤销和删除把候选源交给同一Runtime事务；更新按冻结接口等待默认源切换后再应用候选。
     * 未知或已清空动作不会执行额外业务修改。
     * 副作用: 执行对应异步流程，finally清空待处理动作并关闭交接弹窗。
     * 成功路径: 更新、撤销或删除分支分别等待最终结果。
     * 失败路径: 执行器显示错误，finally仍恢复交接局部状态。
     *
     * @param {{ sourceId: string, fallbackSourceId: string }} payload 默认源交接结果。
     * @returns {Promise<void>} 等待可能存在的 mock 更新完成。
     */
    async confirmDefaultSourceTransition(payload) {
      // 类型: string。
      // 作用: 保存本次待继续动作，避免清空局部状态后丢失分支依据。
      const pendingAction = this.pendingDefaultSourceAction;
      try {
        // 条件分支: pendingAction为update时进入。
        // 执行内容: 等待用户选择的默认源切换和脚本更新完成。
        if (pendingAction === DEFAULT_SOURCE_ACTION.update) {
          await this.performApplyUpdate(payload.fallbackSourceId);
          return;
        }

        // 条件分支: pendingAction为revokeAuthorization时进入。
        // 执行内容: 把replace或clear交接与撤销授权作为同一Runtime事务提交。
        if (pendingAction === DEFAULT_SOURCE_ACTION.revokeAuthorization) {
          // 类型: {completed: boolean, result: boolean|null}。
          // 作用: 保存原子默认源交接和授权撤销事务结果。
          const operationResult = await this.executeSettingsOperation(
            () => revokeSourceAuthorization(payload.sourceId, payload.fallbackSourceId),
            '运行授权撤销失败'
          );
          // 条件分支: 撤销和交接完整成功时进入。
          // 执行内容: 显示成功；失败时沿用执行器反馈。
          if (operationResult.completed) this.$message.success('已撤销运行授权并关闭数据源');
          return;
        }

        // 条件分支: pendingAction为deleteSource时进入。
        // 执行内容: 把用户交接选择交给原子删除事务，并在成功后返回列表。
        if (pendingAction === DEFAULT_SOURCE_ACTION.deleteSource) {
          await this.performDelete(payload.sourceId, payload.fallbackSourceId);
        }
      } finally {
        // finally副作用: 无论后续动作成功或失败都清除交接状态，避免重复执行旧意图。
        this.pendingDefaultSourceAction = '';
        this.defaultSourceDialogVisible = false;
      }
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 数据源详情根容器 `.source-detail`。
  样式作用:
  纵向组合标题、信息、设置、缓存和操作区。
*/
.source-detail {
  /* 使用纵向 Grid 统一详情区块间距。 */
  display: grid;
  /* 设置详情业务区之间的稳定距离。 */
  gap: 16px;
  /* 允许详情页在设置工作区中收缩。 */
  min-width: 0;
}

/*
  作用容器: 详情页顶部 `.source-detail__header`。
  样式作用:
  纵向排列返回入口和标题操作行。
*/
.source-detail__header {
  /* 使用纵向 Grid 组织返回和标题内容。 */
  display: grid;
  /* 设置两行之间的距离。 */
  gap: 12px;
}

/*
  作用容器: 返回列表按钮 `.source-detail__back`。
  样式作用:
  提供轻量文字式层级返回入口。
*/
.source-detail__back {
  /* 按内容宽度显示，不占满工作区。 */
  width: fit-content;
  /* 移除原生按钮边框。 */
  border: 0;
  /* 使用透明背景保持文字入口视觉。 */
  background: transparent;
  /* 清除额外内边距。 */
  padding: 0;
  /* 使用强调色表示可跳转。 */
  color: var(--accent);
  /* 提示入口可点击。 */
  cursor: pointer;
}

/*
  作用容器: 键盘聚焦返回按钮。
  样式作用:
  向键盘用户显示焦点位置。
*/
.source-detail__back:focus-visible {
  /* 使用主题色焦点轮廓。 */
  outline: 2px solid var(--accent);
  /* 让轮廓与文字保持间距。 */
  outline-offset: 3px;
}

/*
  作用容器: 标题和主要操作行。
  样式作用:
  桌面端分列排列，操作空间不足时换行。
*/
.source-detail__heading-row {
  /* 使用弹性布局组合标题和操作。 */
  display: flex;
  /* 两组内容分别靠两端。 */
  justify-content: space-between;
  /* 顶部对齐标题和操作。 */
  align-items: flex-start;
  /* 保留内容间距。 */
  gap: 16px;
}

/*
  作用容器: 详情标题文本列。
  样式作用:
  允许名称和描述使用主要剩余宽度。
*/
.source-detail__heading {
  /* 占据标题行主要剩余空间。 */
  flex: 1;
  /* 允许长名称在工作区内换行。 */
  min-width: 0;
}

/*
  作用容器: 数据源名称标题。
  样式作用:
  建立详情页最高文本层级。
*/
.source-detail__heading h1 {
  /* 清除标题默认外边距。 */
  margin: 0;
  /* 使用页面标题字号。 */
  font-size: 24px;
  /* 使用主题主文本色。 */
  color: var(--text-primary);
}

/*
  作用容器: 数据源描述。
  样式作用:
  在名称下解释脚本定位和 mock 场景。
*/
.source-detail__heading p {
  /* 在标题下方保留轻量间距。 */
  margin: 7px 0 0;
  /* 使用弱文本色降低描述层级。 */
  color: var(--text-muted);
  /* 提升多行描述可读性。 */
  line-height: 1.65;
}

/*
  作用容器: 详情主要操作组。
  样式作用:
  横向排列检测、默认源和更新操作并允许换行。
*/
.source-detail__primary-actions,
.source-detail__secondary-actions {
  /* 使用弹性布局排列按钮。 */
  display: flex;
  /* 空间不足时允许换行。 */
  flex-wrap: wrap;
  /* 设置按钮间距。 */
  gap: 8px;
  /* 桌面端操作靠右排列。 */
  justify-content: flex-end;
}

/*
  作用容器: 两组操作中的 Element UI 按钮。
  样式作用:
  移除第三方相邻按钮默认边距，统一使用 gap。
*/
.source-detail__primary-actions > .el-button,
.source-detail__secondary-actions > .el-button {
  /* 清除 Element UI 相邻按钮左外边距。 */
  margin-left: 0;
}

/*
  作用容器: 数据源操作区 `.source-detail__danger-zone`。
  样式作用:
  组合操作说明和导出、授权、删除按钮。
*/
.source-detail__danger-zone {
  /* 使用弹性布局分隔说明和操作组。 */
  display: flex;
  /* 两组内容分别靠两端。 */
  justify-content: space-between;
  /* 顶部对齐内容。 */
  align-items: flex-start;
  /* 设置两组内容间距。 */
  gap: 18px;
  /* 设置面板安全留白。 */
  padding: 22px;
}

/*
  作用容器: 数据源操作区标题。
  样式作用:
  建立详情区块标题层级。
*/
.source-detail__danger-zone h2 {
  /* 清除标题默认外边距。 */
  margin: 0;
  /* 使用详情区块标题字号。 */
  font-size: 18px;
  /* 使用主题主文本色。 */
  color: var(--text-primary);
}

/*
  作用容器: 数据源操作边界说明。
  样式作用:
  解释导出和删除不会包含个人缓存。
*/
.source-detail__danger-zone p {
  /* 在标题下方保留说明间距。 */
  margin: 8px 0 0;
  /* 使用弱文本色。 */
  color: var(--text-muted);
  /* 提升多行说明可读性。 */
  line-height: 1.65;
}

/*
  作用容器: 无效详情状态 `.source-detail-not-found`。
  样式作用:
  居中展示未找到说明和返回入口。
*/
.source-detail-not-found {
  /* 使用纵向弹性布局组织空状态和按钮。 */
  display: flex;
  /* 让内容从上到下排列。 */
  flex-direction: column;
  /* 水平居中空状态和按钮。 */
  align-items: center;
  /* 设置面板安全留白。 */
  padding: 28px;
  /* 保证无效详情不会压缩成过薄区域。 */
  min-height: 360px;
}

/*
  作用容器: 平板和窄桌面。
  响应式断点: max-width 900px。
  样式作用:
  标题操作与底部操作改为纵向排列。
*/
@media (max-width: 900px) {
  /*
    作用容器: 平板标题操作行和数据源操作区。
    样式作用:
    解除横向空间竞争。
  */
  .source-detail__heading-row,
  .source-detail__danger-zone {
    /* 改为纵向排列。 */
    flex-direction: column;
  }

  /*
    作用容器: 平板操作组。
    样式作用:
    从工作区左侧开始排列按钮。
  */
  .source-detail__primary-actions,
  .source-detail__secondary-actions {
    /* 平板操作入口左对齐。 */
    justify-content: flex-start;
  }
}

/*
  作用容器: 手机。
  响应式断点: max-width 640px。
  样式作用:
  收紧详情标题和操作区并让重要按钮保持可触达。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机详情页根容器。
    样式作用:
    收紧纵向模块距离。
  */
  .source-detail {
    /* 使用更紧凑的手机模块间距。 */
    gap: 12px;
  }

  /*
    作用容器: 手机数据源名称。
    样式作用:
    减小标题高度并保持可读性。
  */
  .source-detail__heading h1 {
    /* 使用手机页面标题字号。 */
    font-size: 21px;
  }

  /*
    作用容器: 手机主要操作组和次要操作组。
    样式作用:
    让按钮使用完整可用宽度。
  */
  .source-detail__primary-actions,
  .source-detail__secondary-actions {
    /* 操作组占满详情宽度。 */
    width: 100%;
  }

  /*
    作用容器: 手机详情操作按钮。
    样式作用:
    每个操作占满一行，避免文案挤压。
  */
  .source-detail__primary-actions > .el-button,
  .source-detail__secondary-actions > .el-button {
    /* 手机操作按钮使用完整宽度。 */
    width: 100%;
  }

  /*
    作用容器: 手机数据源操作面板。
    样式作用:
    提升窄屏可用宽度。
  */
  .source-detail__danger-zone {
    /* 缩小手机面板内边距。 */
    padding: 17px 14px;
  }
}
</style>
