# Web Video Player

## 项目简介

- Web Video Player 是一个面向多数据源影视内容的在线视频内容聚合播放器。

- 项目基于 Vue 2、Vite、Fastify 和 Undici 构建，当前版本已经形成从页面、SourceRuntime、SourceContext Shell、ProxyClient 到后端无状态代理的统一请求链。

- 项目通过统一的页面入口、组件结构和数据样板，为首页推荐、目录浏览、搜索结果、详情展示、播放界面、个人中心和设置页提供连贯的前端体验。

- 项目目标是提供清晰的视频内容浏览、详情查看和播放入口组织能力，让不同来源的数据可以在统一页面结构中展示。

- 项目本身不提供任何媒体资源，也不存储任何媒体资源。数据源由使用者自行配置，项目只负责内容聚合展示和前端交互组织。

## 项目目标

项目最终由前端应用、数据源 Provider、后端无状态代理和外部数据源四个部分组成，并通过标准请求、标准响应、代理请求和外部响应形成双向数据流。

- **前端应用**：负责页面展示、用户交互、数据源定义管理和本地运行态数据管理。SourceManager 通过 Repository 读取数据源包、定义、偏好和私有空间，再向页面提供轻量状态投影。
- **数据源 Provider**：负责识别前端请求，并根据请求内容构造外部数据源请求、解析响应、清洗字段和生成前端可识别的数据对象。Provider 只能通过当前来源绑定的 SourceContext 使用受控网络、私有空间、挑战、日志和生命周期能力。
- **后端无状态代理**：负责受控网络转发。它接收前端 ProxyClient 提交的代理信封，校验目标地址、DNS、IP、请求头、响应大小和重定向，再把外部响应返回前端。后端不解析业务字段，不保存用户状态，也不提供媒体资源。
- **外部数据源**：由使用者自行配置或导入，是项目聚合展示的数据来源。项目本身不提供资源，也不存储资源，只通过数据源 Provider 和后端代理完成内容请求、解析和聚合展示。

```text
目标请求过程
• 前端应用
  Obj[App.vue / HomeView / MovieView / TVView / SearchResultView / DetailView / PlayerView]
  负责页面展示、用户交互，并按当前页面或模块需求组织统一请求
│
│ action[requestSourceData(...) / requestSourceFilterMeta(...)]
│        页面根据当前内容区块或筛选区块发起统一内容请求或筛选元数据请求
│
▼
• 标准请求对象
  Obj[SourceDataRequest / SourceFilterMetaRequest]
  声明目标数据源、目标页面、目标模块以及请求参数，作为前端和数据源适配层之间的统一请求结构
│
│ data[sourceId / pageKey / moduleKey / params]
│      数据源标识 / 页面标识 / 模块标识 / 请求参数集合
│
▼
• 数据源适配层
  Obj[sourceDataService.js / sourceFilterService.js / mockSourceProvider.js / mockFilterMetaProxy.js]
  负责识别项目标准请求、定位数据源适配器，并把统一请求转换成可执行的数据源请求
│
│ action[构造代理请求]
│        按目标数据源能力构造后端可转发的外部请求
│
▼
• 后端无状态代理
  校验目标地址、DNS、IP、请求头、容量和重定向，并执行单次无状态转发
│
│ data[url / method / headers / body]
│      请求地址 / 请求方法 / 请求头 / 请求体
│
▼
• 外部数据源
  用户自行配置或导入的数据来源
```

```text
目标响应过程
• 外部数据源
  返回原始外部响应内容
│
│ data[HTML / JSON / Text]
│      HTML 文件 / JSON 文件 / 纯文本文件
│
▼
• 后端无状态代理
  返回受协议约束的状态、响应头、最终地址和响应正文
│
│ data[HTML / JSON / Text]
│      HTML 文件 / JSON 文件 / 纯文本文件
│
▼
• 数据源适配层
  Obj[sourceDataService.js / sourceFilterService.js / mockSourceProvider.js / mockFilterMetaProxy.js]
  负责解析原始外部响应，并组装前端可消费的统一响应结构
│
│ data[items / item / pagination / meta / groups / request / updatedAt]
│      内容列表 / 单内容对象 / 分页信息 / 响应附加信息 / 筛选分组 / 原始请求回填 / 最后更新时间
│
▼
• 标准响应对象
  Obj[SourceDataResponse / SourceFilterMetaResponse]
  数据源适配层返回给前端页面和 store 的统一响应结构
│
│ data[items / item / pagination / meta / groups / request / updatedAt]
│      内容列表 / 单内容对象 / 分页信息 / 响应附加信息 / 筛选分组 / 原始请求回填 / 最后更新时间
│
▼
• 前端应用
  Obj[siteContentStore / siteFilterStore / HomeView / MovieView / TVView / SearchResultView / DetailView / PlayerView]
  接收统一响应并写入运行态 store，再由页面和组件消费结果完成渲染
```

## 已实现功能说明

当前已实现部分完成用户内容状态联动、多设备响应式布局，并接通页面、统一 SourceRuntime、浏览器持久化、前端 ProxyClient、后端无状态代理和单文件 Provider 导入运行链。

- **用户内容 store**：收藏记录、播放历史和当前播放状态独立保存，只保存内容引用和播放进度。
- **内容补全服务**：个人中心根据用户记录中的内容引用，从内容共享池读取或按需请求完整内容对象。
- **用户状态卡片**：UserVideoCard 在统一卡片外层注入收藏状态、播放进度和当前播放状态。
- **页面联动闭环**：详情页和播放页可以切换收藏，播放页写入历史和当前播放，个人中心同步读取并管理这些状态。
- **恢复播放体验**：播放页根据历史进度区分从头开始、继续播放和接近结尾提示，并在切换分集时同步当前历史状态。
- **个人中心体验**：收藏与历史支持筛选、删除、取消收藏、空状态和分页回退，操作后列表状态保持同步。
- **响应式页面外壳**：导航、轮播、目录网格、视频卡片、排行榜、详情页、播放页、个人中心和设置页共享明确的桌面、平板与手机布局边界。
- **移动端导航**：窄屏下使用可展开的导航和搜索入口，避免页面入口因空间不足被裁切。
- **播放页布局**：播放器、视频信息、线路和分集区域根据视口重新排列，移动端优先展示播放区域和主要操作。
- **设置模块路由**：设置页使用独立模块导航组织数据源管理、播放设置、快捷键设置和全局配置，未配置模块显示统一空状态。
- **数据源列表管理**：支持按系统源和自定义源筛选、启停、默认源切换、单项删除、批量删除、批量导出和系统源恢复。
- **数据源导入与授权**：提供文件、在线地址和粘贴文本三种导入入口，自定义脚本启用前由用户确认运行授权，脚本内容变化后需要重新确认。
- **单文件脚本读取**：文件与粘贴入口读取本地文本，远程入口只接受 HTTPS 地址并在容量和超时边界内获取脚本，三种入口最终交付同一种脚本文本。
- **导入前静态预检**：加载器使用 JavaScript 语法树检查模块导出、顶层语句和受限全局引用，在用户授权前拒绝不符合单文件 ABI 的脚本。
- **动态 Provider 注册**：用户确认后执行已经预检的同一脚本文本，将脚本工厂注册到应用级执行 Host；更新、删除或失败回滚时同步替换或移除对应工厂。
- **挑战交互协调**：Provider 通过 SourceContext 报告需要用户处理的挑战，全局协调器保证同一时刻只展示一个挑战窗口，并把提交、取消和超时结果返回原调用。
- **数据源详情**：独立详情页展示基本信息、能力范围、更新状态、普通设置和缓存占用，并提供临时缓存与全部缓存清理入口。
- **数据源 Repository**：数据源脚本包、数据源定义、用户偏好和按来源隔离的私有空间分别由独立 Repository 管理，页面不直接持有保存对象。
- **IndexedDB 统一数据库**：浏览器使用一个版本化数据库保存数据源包、定义、偏好、来源私有空间、用户收藏、播放历史和应用设置，避免不同保存域各自建立数据库。
- **持久化数据源仓库**：IndexedDB Repository 保持与 Memory Repository 相同的领域接口和事务边界，Runtime 可以在不改变页面调用方式的前提下从浏览器恢复保存图。
- **用户内容持久化**：收藏与播放历史通过独立用户内容 Repository 写入数据库，Store 只保存当前运行态投影，刷新页面后能够重新加载已保存记录。
- **动态 Provider 恢复**：启动协调器先读取已授权的自定义脚本包并恢复对应 ProviderFactory，再开放数据源运行链；单个损坏脚本会被隔离并以启动失败状态报告。
- **启动失败边界**：数据库升级、持久仓库初始化或脚本恢复失败时进入统一启动失败页面，应用不会静默回退到另一份内存状态。
- **事务协调**：Unit of Work 为跨 Repository 写入提供提交、冲突检测和失败回滚边界，避免包、定义与偏好只更新一部分。
- **领域状态投影**：SourceManager 从 Repository 保存图组装轻量状态，统一判断包完整性、授权有效性、默认源、活动源和软隐藏状态。
- **数据源领域操作**：启停、默认源交接、授权、撤销授权、导入、更新、删除、导出、健康检测和缓存清理通过同一领域服务串行执行。
- **SourceContext Shell**：向 Provider 提供按 sourceId 隔离的网络、私有空间、挑战、日志和中止信号，Provider 无需接触页面、store 或 Repository。
- **Provider 工厂注册表**：ExecutionHost 根据 Definition 的 providerKey 选择受信工厂，并在创建前复查 Package、Definition、授权和运行状态。
- **受管生命周期**：Provider 的启动、调用、停止和失败状态由 ExecutionHost 统一协调，新调用和停止操作不会交错破坏实例状态。
- **系统演示 Provider**：四条系统数据源通过两套独立协议数据集验证同一 Shell 与 Host 可以承载不同解析规则，而公共页面不增加来源分支。
- **统一内容运行链**：内容与筛选服务共同调用应用级 SourceRuntime，成功响应再进入内容 store 和筛选 store，旧页面私有 Provider 注册表已经移除。
- **活动源统一切换**：首页、电影、电视剧和搜索页的数据源导航读取 SourceManager 权威投影，切换成功后再采用新来源并刷新当前页面内容。
- **Provider 就绪门禁**：页面只展示已启用、授权有效且 Provider 可运行的数据源；未解析自定义脚本和结构损坏记录不会进入内容请求链。
- **设置页 Runtime**：启停、默认源、授权、撤销授权、检测、更新、导入、删除、恢复、导出和缓存清理都委托 SourceManagementRuntime，不再直接修改页面状态副本。
- **响应采纳边界**：来源响应只有在请求身份仍与当前活动源一致时才写入内容或筛选 store，过期切换结果不会覆盖新页面状态。
- **统一导航上下文**：卡片详情跳转、播放跳转和个人中心内容补全都携带稳定 sourceId，页面之间不再通过显示名称猜测来源。
- **前端 ProxyClient**：把 SourceContext 的受控网络请求转换为版本化代理信封，统一处理超时、中止、HTTP 错误、响应结构和正文解码。
- **网络适配工厂**：开发演示网络和真实代理网络使用同一 SourceContext 接口，Runtime 通过明确模式选择适配器，Provider 不感知运输实现。
- **无状态代理协议**：前后端共享目标、方法、请求头、请求体、超时、重定向、响应类型和容量上限语义，协议错误使用稳定错误码返回。
- **目标安全门禁**：代理在连接前解析目标域名并拒绝本机、内网、保留地址和不受支持协议；重定向后的每个目标都会重新执行同一安全检查。
- **原始运输边界**：代理只负责 HTTP 搬运、响应头裁剪和正文编码，不识别 Provider 的内容字段、Cookie 业务含义或页面状态。

```text
数据源管理领域过程
• 设置页或应用组合入口
  提交启停、授权、导入、更新、删除、检测和缓存操作
│
│ action[SourceManager command]
│
▼
• SourceManager
  校验命令、维护操作顺序，并从保存图组装轻量运行状态
│
│ data[SourcePackage / SourceDefinition / SourcePreferences / SourceStorage]
│
▼
• Repository 与 Unit of Work
  分离保存脚本包、定义、偏好和私有空间，并为跨仓写入提供事务边界
```

```text
受管数据请求过程
• 内容页与目录页
  创建标准内容请求或筛选请求
│
│ action[SourceRuntime.fetchData(...) / SourceRuntime.fetchFilterMeta(...)]
│
▼
• SourceManager 与 ExecutionHost
  复查来源授权、启用状态、活动身份和 Provider 生命周期
│
│ action[Provider.fetchData(...) / Provider.fetchFilterMeta(...)]
│
▼
• SourceContext Shell
  只向当前 Provider 提供受控网络、私有空间、挑战、日志和中止能力
│
│ data[标准 SourceDataResponse / SourceFilterMetaResponse]
│
▼
• 内容 store 与筛选 store
  只在运行链成功返回后提交页面可消费的统一响应
```

```text
活动源切换过程
• 数据源切换导航
  展示当前可运行来源并提交用户选择
│
│ action[SourcePageService.switchActiveSource(sourceId)]
│
▼
• SourceManagementRuntime
  通过 SourceManager 校验目标来源并提交活动源事务
│
│ data[requestId / activeSourceId / sourceManagerState]
│
▼
• 当前内容页面
  只采用最新切换结果，并按新来源重新请求当前页面数据
```

```text
用户状态写入过程
• 详情页与播放页
  Obj[DetailView / PlayerView]
  详情页负责收藏切换与跳转播放，播放页负责收藏、播放历史和当前播放状态写入
│
│ action[toggleFavorite(...) / upsertPlayHistory(...) / updateCurrentPlaying(...)]
│        详情页和播放页在用户点击收藏、开始播放、切换分集或切换播放状态时写入用户内容运行态
│
▼
• 用户内容写入服务
  Obj[userContentService.js]
  封装收藏切换、播放历史写入、当前播放状态写入和恢复播放判断
│
│ data[favoriteRecord / historyRecord / currentPlaying]
│      收藏记录对象 / 播放历史记录对象 / 当前播放状态对象
│
▼
• 用户内容状态
  Obj[userContentStore]
  保存 favorites、history 和 currentPlaying 三类运行态用户内容状态
```

```text
用户状态补全与联动过程
• 用户内容状态
  Obj[userContentStore]
  只保存内容引用和播放进度，不直接保存完整 ContentItem
│
│ data[sourceId / contentId / contentKey / playedSeconds / episodeIndex]
│      数据源标识 / 内容标识 / 内容引用 key / 已播放秒数 / 当前分集序号
│
▼
• 内容补全服务
  Obj[contentItemResolver / resolveContentItem(...) / resolveContentItems(...)]
  优先从内容共享池读取内容实体，未命中时复用 detail 请求补全内容
│
│ action[resolveContentItem(...) / resolveContentItems(...)]
│        先查实体池命中情况，未命中时复用 detail 请求补全完整内容对象
│
▼
• 内容共享池
  Obj[siteContentStore.entities.contentItems]
  提供用户内容引用对应的完整 ContentItem，供个人中心和卡片组件复用
│
│ data[完整 ContentItem]
│      用户内容引用最终补全出来的完整视频内容对象
│
▼
• 用户状态 selector
  Obj[getContentUserStatus(...) / getFavoriteRecordsForDisplay() / getPlayHistoryRecordsForDisplay()]
  把收藏状态、播放记录和内容实体整理成页面和卡片可直接消费的数据
│
│ data[收藏状态 / 播放状态 / 最近播放记录 / 完整内容列表]
│      是否收藏 / 是否播放与播放进度 / 最近播放记录 / 页面最终展示用完整列表
│
▼
• 联动页面与卡片
  Obj[UserVideoCard.vue / ProfileView / HomeView / MovieView / TVView / SearchResultView]
  个人中心、首页、目录页和搜索页读取同一份用户状态结果，展示实时联动的收藏和播放信息
```

## 数据字段规范

项目的数据字段样板放在 `examples` 目录中。README 只保留入口说明，具体字段以样板文件为准。

- **[examples > page-home.example.js](examples/page-home.example.js)**
  - 内容： 首页字段样板。
  - 作用： 描述首页轮播、热门电影、热门电视剧、电影排行榜和电视剧排行榜的展示数据结构。
  - 用途： 适合查看首页页面模块如何消费内容列表。

- **[examples > page-movie.example.js](examples/page-movie.example.js)**
  - 内容： 电影页字段样板。
  - 作用： 描述电影列表、筛选区和分页区所需的页面数据。
  - 用途： 适合查看目录页列表数据的基础字段。

- **[examples > page-tv.example.js](examples/page-tv.example.js)**
  - 内容： 电视剧页字段样板。
  - 作用： 描述电视剧列表、更新状态、集数信息和分页区所需的数据。
  - 用途： 适合查看电视剧内容和电影内容的差异字段。

- **[examples > page-search.example.js](examples/page-search.example.js)**
  - 内容： 搜索页字段样板。
  - 作用： 描述搜索关键词、搜索结果列表和分页信息。
  - 用途： 适合查看搜索结果如何沿用统一内容对象。

- **[examples > page-detail.example.js](examples/page-detail.example.js)**
  - 内容： 详情页字段样板。
  - 作用： 描述标题、简介、演员、导演、分集、播放线路等详情数据。
  - 用途： 适合查看单内容页面需要的完整内容字段。

- **[examples > page-player.example.js](examples/page-player.example.js)**
  - 内容： 播放页字段样板。
  - 作用： 描述播放器、播放线路、当前分集和关联内容列表数据。
  - 用途： 适合查看播放页如何消费详情字段和播放字段。

- **[examples > page-profile.example.js](examples/page-profile.example.js)**
  - 内容： 个人中心字段样板。
  - 作用： 描述播放历史、收藏记录和个人信息展示数据。
  - 用途： 适合查看用户内容列表的页面结构。

- **[examples > user-content-state.example.js](examples/user-content-state.example.js)**
  - 内容： 用户内容状态字段样板。
  - 作用： 描述收藏记录、播放历史、当前播放状态和恢复播放策略。
  - 用途： 适合查看用户行为状态如何用内容引用和播放进度联动各页面。

- **[examples > page-settings.example.js](examples/page-settings.example.js)**
  - 内容： 设置页字段样板。
  - 作用： 描述基础设置、数据源管理、缓存概览和本地状态操作数据。
  - 用途： 适合查看设置页如何展示数据源能力和本地配置。

- **[examples > content-item.example.js](examples/content-item.example.js)**
  - 内容： 通用内容对象样板。
  - 作用： 描述电影和电视剧共用的最大字段集合。
  - 用途： 适合查看外部数据接入时需要返回的单条内容结构。

- **[examples > source-data-request.example.js](examples/source-data-request.example.js)**
  - 内容： 标准请求对象样板。
  - 作用： 描述页面向 provider 请求数据时使用的 `sourceId`、`pageKey`、`moduleKey` 和 `params`。
  - 用途： 适合查看页面如何声明当前需要哪个数据桶。

- **[examples > source-data-response.example.js](examples/source-data-response.example.js)**
  - 内容： 标准响应对象样板。
  - 作用： 描述 provider 返回列表内容或单内容时的统一结构。
  - 用途： 适合查看服务层如何把响应写入内容实体池和页面引用桶。

## 项目使用流程

本节说明当前已完成的前端部分如何在本地运行。当前仓库中的前端页面、组件和本地演示数据可以直接通过 `client/` 启动查看。

### 1. 准备运行环境

运行项目前需要先准备 Node.js 和 npm。

建议环境：

```text
Node.js: 18.x 或 20.x
npm: 随 Node.js 一起安装即可
```

可以在终端中执行下面的命令检查环境是否已经安装：

```bash
node -v
npm -v
```

如果命令能正常输出版本号，说明 Node.js 和 npm 已经可用。如果提示命令不存在，需要先安装 Node.js，并重新打开终端让环境变量生效。

### 2. 进入前端目录

项目的前端代码放在 `client/` 目录下。打开终端后，先进入该目录：

```bash
cd client
```

如果是在项目根目录执行命令，完整路径关系如下：

```text
web-video-player/
+- client/
   +- package.json
   +- index.html
   +- src/
```

### 3. 安装项目依赖

第一次运行项目前，需要安装前端依赖：

```bash
npm install
```

安装完成后，`client/` 目录下会生成 `node_modules/` 文件夹。这个文件夹只用于本地运行，不需要提交到 Git 仓库。

### 4. 启动开发服务

依赖安装完成后，执行：

```bash
npm run dev
```

启动成功后，终端会输出本地访问地址。当前项目使用 Vite 默认开发端口，通常为：

```text
http://localhost:5173/
```

在浏览器中打开该地址即可查看页面。

### 5. 查看当前可用页面

前端启动后，可以通过顶部导航访问当前已完成的主要页面入口：

```text
首页
电影
电视剧
搜索
详情
播放页
个人中心
设置
```

当前页面使用本地演示数据运行，不需要额外配置数据源即可查看基础页面、目录列表、搜索结果、详情页和播放页结构。

### 6. 生产构建

如果需要检查项目是否能够正常打包，可以执行：

```bash
npm run build
```

构建成功后，产物会输出到：

```text
client/dist/
```

`dist/` 是构建产物目录，不需要提交到 Git 仓库。

### 7. 本地预览构建结果

如果需要预览生产构建后的页面，可以先执行构建，再执行：

```bash
npm run preview
```

终端会输出预览地址，在浏览器打开即可查看构建后的页面效果。

### 8. 常见问题

如果提示 `npm` 或 `node` 不是可识别命令，通常说明 Node.js 没有安装，或者安装后终端没有重新打开。

如果 `npm install` 失败，可以先删除 `client/node_modules/`，再重新执行：

```bash
npm install
```

如果启动时提示端口被占用，可以关闭占用端口的程序，或者根据 Vite 终端提示使用自动切换后的访问地址。
