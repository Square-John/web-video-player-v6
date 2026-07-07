# Web Video Player

## 项目简介

- Web Video Player 是一个面向多数据源影视内容的在线视频内容聚合播放器。

- 项目前端基于 Vue 2 和 Vite 构建，当前版本重点完成前端页面结构、基础组件拆分和页面级演示数据组织。

- 项目通过统一的页面入口、组件结构和数据样板，为首页推荐、目录浏览、搜索结果、详情展示、播放界面、个人中心和设置页提供完整的前端骨架。

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

当前已实现部分进一步完成静态布局调整和视觉优化。

- **全局布局更稳定**：导航、页脚和主体内容区形成统一宽度关系。
- **首页区块更清晰**：首页轮播、热门电影、热门电视剧和排行榜区域形成稳定展示结构。
- **卡片和排行榜对齐**：首页卡片网格和排行榜通过布局关系保持视觉对齐。

```text
静态布局优化调整
└─ 全局布局
   ├─ 顶部导航 AppNavBar
   ├─ 主体内容区
   │  ├─ 顶部数据源切换栏 SourceSwitchTabs
   │  ├─ 首页 HomeView
   │  │  ├─ 轮播区 HomeCarousel
   │  │  ├─ 热门电影区 HotMovieSection
   │  │  │  ├─ 卡片网格
   │  │  │  └─ 右侧排行榜
   │  │  ├─ 热门电视剧区 HotTVSection
   │  │  │  ├─ 卡片网格
   │  │  │  └─ 右侧排行榜
   │  │  └─ 区块留白与对齐关系
   │  ├─ 电影页 MovieView
   │  ├─ 电视剧页 TVView
   │  ├─ 搜索页 SearchView
   │  ├─ 详情页 DetailView
   │  ├─ 播放页 PlayerView
   │  ├─ 个人中心 Profile
   │  └─ 设置页 Settings
   └─ 底部页脚 AppFooter
```

## 数据字段规范
- **[examples > page-home.example.js](examples/page-home.example.js)**
  - 内容： 首页静态数据样板，包含轮播图、热门电影、热门电视剧和排行榜字段。
  - 作用： 说明首页多个内容分区的数据输入结构。
  - 用途： 供维护首页组件字段、调整首页区块和接入首页数据时参考。

- **[examples > page-movie.example.js](examples/page-movie.example.js)**
  - 内容： 电影页静态数据样板，包含筛选项、电影列表和分页字段。
  - 作用： 说明电影目录页在静态展示阶段需要的数据形态。
  - 用途： 供维护电影页筛选栏、目录网格和分页区域时参考。

- **[examples > page-tv.example.js](examples/page-tv.example.js)**
  - 内容： 电视剧页静态数据样板，包含筛选项、剧集列表和分页字段。
  - 作用： 说明电视剧目录页在静态展示阶段需要的数据形态。
  - 用途： 供维护电视剧页筛选栏、目录网格和分页区域时参考。

- **[examples > page-search.example.js](examples/page-search.example.js)**
  - 内容： 搜索页静态数据样板，包含搜索关键词、结果列表和分页字段。
  - 作用： 说明搜索结果页的输入关键词和结果展示字段。
  - 用途： 供维护搜索页结果列表和后续接入搜索数据时参考。

- **[examples > page-detail.example.js](examples/page-detail.example.js)**
  - 内容： 详情页静态数据样板，包含视频基础信息、简介、演职员信息和选集字段。
  - 作用： 说明详情页头图区和选集区需要的字段结构。
  - 用途： 供维护详情页展示字段和播放入口字段时参考。

- **[examples > page-player.example.js](examples/page-player.example.js)**
  - 内容： 播放页静态数据样板，包含当前播放内容、播放地址、播放列表和播放器状态字段。
  - 作用： 说明播放页播放器区域和播放列表区域的数据形态。
  - 用途： 供维护播放器布局、播放列表和播放状态字段时参考。

- **[examples > page-profile.example.js](examples/page-profile.example.js)**
  - 内容： 个人中心静态数据样板，包含用户信息、播放历史和收藏记录字段。
  - 作用： 说明个人中心中用户状态和用户内容列表的展示字段。
  - 用途： 供维护个人中心列表卡片和用户信息区域时参考。

- **[examples > page-settings.example.js](examples/page-settings.example.js)**
  - 内容： 设置页静态数据样板，包含应用设置、数据源列表、快捷键设置和本地状态操作字段。
  - 作用： 说明设置页各配置区域的字段结构。
  - 用途： 供维护设置页配置面板和数据源管理区域时参考。

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
