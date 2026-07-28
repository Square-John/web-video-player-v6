# Web Video Player

## 项目简介

- Web Video Player 是一个面向多数据源影视内容的在线视频内容聚合播放器。

- 项目前端基于 Vue 2 和 Vite 构建，当前版本重点完善用户内容交互、恢复播放语义和多设备响应式布局。

- 项目通过统一的页面入口、组件结构和数据样板，为首页推荐、目录浏览、搜索结果、详情展示、播放界面、个人中心和设置页提供连贯的前端体验。

- 项目目标是提供清晰的视频内容浏览、详情查看和播放入口组织能力，让不同来源的数据可以在统一页面结构中展示。

- 项目本身不提供任何媒体资源，也不存储任何媒体资源。数据源由使用者自行配置，项目只负责内容聚合展示和前端交互组织。

## 项目目标

项目最终由前端应用、数据源 Provider、后端无状态代理和外部数据源四个部分组成，并通过标准请求、标准响应、代理请求和外部响应形成双向数据流。

- **前端应用**：负责页面展示、用户交互和本地运行态数据管理。页面根据用户操作组织请求参数，接收数据源 Provider 返回的数据，并将内容渲染到对应页面和组件中。
- **数据源 Provider**：负责识别前端请求，并根据请求内容构造外部数据源请求、解析响应、清洗字段和生成前端可识别的数据对象。Provider 是外部数据进入项目的业务适配层。
- **后端无状态代理**：负责受控网络转发。它接收数据源 Provider 发起的代理请求，校验目标地址，请求外部数据源，并把外部响应返回给 Provider。后端不解析业务字段，不保存用户状态，也不提供媒体资源。
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
  当前公开仓库尚未落地实现，目标职责是校验目标地址并转发外部请求
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
  当前公开仓库尚未落地实现，目标职责是把外部原始响应原样返回给数据源适配层
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

当前已实现部分完成用户内容状态联动，并完善主要页面在桌面、平板和手机视口下的布局表现。

- **用户内容 store**：收藏记录、播放历史和当前播放状态独立保存，只保存内容引用和播放进度。
- **内容补全服务**：个人中心根据用户记录中的内容引用，从内容共享池读取或按需请求完整内容对象。
- **用户状态卡片**：UserVideoCard 在统一卡片外层注入收藏状态、播放进度和当前播放状态。
- **页面联动闭环**：详情页和播放页可以切换收藏，播放页写入历史和当前播放，个人中心同步读取并管理这些状态。
- **恢复播放体验**：播放页根据历史进度区分从头开始、继续播放和接近结尾提示，并在切换分集时同步当前历史状态。
- **个人中心体验**：收藏与历史支持筛选、删除、取消收藏、空状态和分页回退，操作后列表状态保持同步。
- **响应式页面外壳**：导航、轮播、目录网格、视频卡片、排行榜、详情页、播放页、个人中心和设置页共享明确的桌面、平板与手机布局边界。
- **移动端导航**：窄屏下使用可展开的导航和搜索入口，避免页面入口因空间不足被裁切。
- **播放页布局**：播放器、视频信息、线路和分集区域根据视口重新排列，移动端优先展示播放区域和主要操作。

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
