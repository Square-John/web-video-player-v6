/*
  project-attribution.config.js 模块说明

  - 文件职责:
      集中声明关于页面使用的项目定位、MIT 许可证和主要直接开源项目清单。
      组件只消费冻结展示配置；package.json 依赖一致性由测试核对，不在模板运行时读取工程文件。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      PROJECT_LINKS: 自定义配置，提供项目仓库和 MIT 官方说明入口。

  - 模块级常量:
      PROJECT_DEPENDENCY_CATEGORY: Readonly<object>，关于页开源项目分组枚举。
      PROJECT_ATTRIBUTION: Readonly<object>，项目定位、许可证和开源项目展示事实。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createOpenSourceProject(definition): 冻结单个开源项目及其 package 名称集合。

  - 模块级类:
      无

  - 对外导出:
      PROJECT_DEPENDENCY_CATEGORY: object，供关于组件稳定分组开源项目。
      PROJECT_ATTRIBUTION: object，供关于组件展示项目与第三方开源事实。
*/

import {
  // 导入来源: ./project-links.config.js。
  // 导入内容: PROJECT_LINKS 项目公开链接。
  // 文件作用: 许可证和项目仓库只引用统一入口，不在本清单复制 URL。
  PROJECT_LINKS
} from './project-links.config.js';

// 类型: Readonly<object>。
// 作用: 固定开源项目在关于页的前端、后端和构建分组，避免组件按自由文案判断类别。
export const PROJECT_DEPENDENCY_CATEGORY = Object.freeze({
  // 类型: string；作用: 标识浏览器运行和前端交互直接使用的开源项目。
  frontend: 'frontend',
  // 类型: string；作用: 标识后端代理运行时直接使用的开源项目。
  backend: 'backend',
  // 类型: string；作用: 标识生产构建使用但不进入浏览器运行包的开源项目。
  build: 'build'
});

/**
 * 冻结单个开源项目展示定义及其 package 名称集合。
 * 纯函数: 不修改候选对象，只创建独立冻结数组和浅层冻结展示对象。
 * 成功路径: 返回关于页可以直接消费的稳定项目条目。
 * 失败路径: 本文件只传入受审静态配置；依赖、URL 和许可证漂移由 source-attribution 测试失败关闭。
 *
 * @param {object} definition 开源项目展示定义。
 * @param {string} definition.id 页面循环使用的稳定项目标识。
 * @param {string} definition.name 项目用户可读名称。
 * @param {Array<string>} definition.packageNames 当前项目对应的直接 package 名称。
 * @param {string} definition.category 前端、后端或构建分组。
 * @param {string} definition.license SPDX 许可证标识。
 * @param {string} definition.projectUrl 项目官方站点或官方仓库。
 * @param {string} definition.description 当前项目在播放器中的用途说明。
 * @returns {Readonly<object>} 深至 packageNames 的冻结展示条目。
 */
function createOpenSourceProject(definition) {
  return Object.freeze({
    ...definition,
    packageNames: Object.freeze([...definition.packageNames])
  });
}

// 类型: Readonly<object>。
// 作用: 保存关于页唯一项目定位、许可证和主要直接依赖展示事实；测试工具依赖不进入该列表。
export const PROJECT_ATTRIBUTION = Object.freeze({
  // 类型: string；作用: 关于页使用的项目正式名称，不从仓库目录名或 package private 名称推断。
  projectName: 'Web Video Player',
  // 类型: string；作用: 说明项目只提供多数据源内容展示和播放框架，不把外部媒体归为项目资产。
  projectDescription: '一个支持可插拔 Provider 的多数据源视频内容展示与播放框架。',
  // 类型: string；作用: 明确项目不提供、不存储、不上传也不分发外部媒体资源。
  mediaBoundary: '本项目不提供、不存储、不上传或分发媒体资源，外部内容及权利归相应站点和权利人所有。',
  // 类型: string；作用: 关于页“项目源码”入口，统一指向正式公开仓库。
  repositoryUrl: PROJECT_LINKS.repositoryUrl,
  // 类型: Readonly<object>；作用: 集中表达项目自身许可证，不把第三方依赖授权并入 MIT 声明。
  license: Object.freeze({
    // 类型: string；作用: 关于页展示的许可证正式名称。
    name: 'MIT License',
    // 类型: string；作用: 文档和第三方声明使用的标准许可证标识。
    identifier: 'MIT',
    // 类型: string；作用: 简要说明本项目源码授权范围，不替代根 LICENSE 完整正文。
    description: '允许在保留版权和许可声明的前提下使用、复制、修改、合并、发布和分发本项目源码。',
    // 类型: string；作用: 浏览器可访问的 MIT 官方说明入口；根 LICENSE 保存完整授权正文。
    url: PROJECT_LINKS.licenseUrl
  }),
  // 类型: ReadonlyArray<Readonly<object>>；作用: 关于页按当前顺序展示前端、后端和构建开源项目。
  openSourceProjects: Object.freeze([
    createOpenSourceProject({ id: 'vue', name: 'Vue.js', packageNames: ['vue'], category: PROJECT_DEPENDENCY_CATEGORY.frontend, license: 'MIT', projectUrl: 'https://v2.vuejs.org/', description: '提供前端组件、响应式状态和页面渲染基础。' }),
    createOpenSourceProject({ id: 'vue-router', name: 'Vue Router', packageNames: ['vue-router'], category: PROJECT_DEPENDENCY_CATEGORY.frontend, license: 'MIT', projectUrl: 'https://v3.router.vuejs.org/', description: '提供前端命名路由和页面导航能力。' }),
    createOpenSourceProject({ id: 'element-ui', name: 'Element UI', packageNames: ['element-ui'], category: PROJECT_DEPENDENCY_CATEGORY.frontend, license: 'MIT', projectUrl: 'https://element.eleme.io/', description: '提供设置表单、反馈和基础交互组件。' }),
    createOpenSourceProject({ id: 'idb', name: 'idb', packageNames: ['idb'], category: PROJECT_DEPENDENCY_CATEGORY.frontend, license: 'ISC', projectUrl: 'https://github.com/jakearchibald/idb', description: '提供 IndexedDB Promise 封装和事务访问基础。' }),
    createOpenSourceProject({ id: 'core-js', name: 'core-js', packageNames: ['core-js'], category: PROJECT_DEPENDENCY_CATEGORY.frontend, license: 'MIT', projectUrl: 'https://core-js.io/', description: '提供浏览器 JavaScript 标准能力兼容支持。' }),
    createOpenSourceProject({ id: 'acorn', name: 'Acorn', packageNames: ['acorn'], category: PROJECT_DEPENDENCY_CATEGORY.frontend, license: 'MIT', projectUrl: 'https://github.com/acornjs/acorn', description: '提供 Provider 单文件模块的静态 JavaScript 语法解析。' }),
    createOpenSourceProject({ id: 'noble-hashes', name: 'Noble Hashes', packageNames: ['@noble/hashes'], category: PROJECT_DEPENDENCY_CATEGORY.frontend, license: 'MIT', projectUrl: 'https://github.com/paulmillr/noble-hashes', description: '提供浏览器端脚本文本和内容身份哈希能力。' }),
    createOpenSourceProject({ id: 'xgplayer', name: 'XGPlayer', packageNames: ['xgplayer', 'xgplayer-hls'], category: PROJECT_DEPENDENCY_CATEGORY.frontend, license: 'MIT', projectUrl: 'https://github.com/bytedance/xgplayer', description: '提供 MP4 与 HLS 媒体播放界面和适配能力。' }),
    createOpenSourceProject({ id: 'fastify', name: 'Fastify', packageNames: ['fastify'], category: PROJECT_DEPENDENCY_CATEGORY.backend, license: 'MIT', projectUrl: 'https://fastify.dev/', description: '提供后端 HTTP 服务、路由和生命周期基础。' }),
    createOpenSourceProject({ id: 'fastify-cors', name: '@fastify/cors', packageNames: ['@fastify/cors'], category: PROJECT_DEPENDENCY_CATEGORY.backend, license: 'MIT', projectUrl: 'https://github.com/fastify/fastify-cors', description: '提供后端浏览器来源准入和 CORS 预检处理。' }),
    createOpenSourceProject({ id: 'ipaddr', name: 'ipaddr.js', packageNames: ['ipaddr.js'], category: PROJECT_DEPENDENCY_CATEGORY.backend, license: 'MIT', projectUrl: 'https://github.com/whitequark/ipaddr.js', description: '提供代理目标 IP 分类和网络安全判断。' }),
    createOpenSourceProject({ id: 'undici', name: 'Undici', packageNames: ['undici'], category: PROJECT_DEPENDENCY_CATEGORY.backend, license: 'MIT', projectUrl: 'https://undici.nodejs.org/', description: '提供后端受控 HTTPS 上游连接和响应流处理。' }),
    createOpenSourceProject({ id: 'vite', name: 'Vite', packageNames: ['vite'], category: PROJECT_DEPENDENCY_CATEGORY.build, license: 'MIT', projectUrl: 'https://vite.dev/', description: '提供前端开发服务和生产静态资源构建。' }),
    createOpenSourceProject({ id: 'vite-plugin-vue2', name: '@vitejs/plugin-vue2', packageNames: ['@vitejs/plugin-vue2'], category: PROJECT_DEPENDENCY_CATEGORY.build, license: 'MIT', projectUrl: 'https://github.com/vitejs/vite-plugin-vue2', description: '提供 Vite 对 Vue 2 单文件组件的编译支持。' }),
    createOpenSourceProject({ id: 'postcss', name: 'PostCSS', packageNames: ['postcss'], category: PROJECT_DEPENDENCY_CATEGORY.build, license: 'MIT', projectUrl: 'https://postcss.org/', description: '提供生产样式处理和构建期 CSS 转换基础。' })
  ])
});
