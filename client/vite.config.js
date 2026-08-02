/*
  vite.config.js 模块说明

  - 文件职责:
      定义 Vite 本地开发和生产构建配置。
      从根 frontend.config.js 读取开发监听与构建路径，并在开发和生产中原样交付公开配置资产。
      只输出 config/frontend.config.js，不把项目配置或后端配置暴露到 dist。

  - 导入库及文件汇总(7 条，内置 3 条，第三方 2 条，自定义 2 条):
      readFileSync: 内置模块，读取公开配置原文供开发响应与生产构建输出。
      dirname / resolve: 内置模块，建立与当前工作目录无关的根配置绝对路径。
      fileURLToPath: 内置模块，把当前配置模块 URL 转为本机路径。
      defineConfig: 第三方库，提供 Vite 配置对象包装能力。
      vue2: 第三方库，让 Vite 支持 Vue 2 单文件组件编译。
      FRONTEND_CONFIG_SOURCE: 自定义配置，当前唯一前端配置事实。
      validateFrontendConfig: 自定义契约函数，在 Vite 产生副作用前严格校验配置。

  - 模块级常量:
      CLIENT_ROOT: string，当前 client 目录绝对路径。
      FRONTEND_CONFIG_FILE: string，根前端配置绝对路径。
      FRONTEND_CONFIG_ASSET_PATH: string，开发与生产配置资产统一相对路径。
      FRONTEND_CONFIG: Readonly<object>，通过完整契约的前端配置。
      FRONTEND_CONFIG_PUBLIC_PATH: string，包含 build.basePath 的浏览器请求路径。
      DEVELOPMENT_SERVER: Readonly<object>，从前端配置读取的 Vite 开发服务参数。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createFrontendConfigAssetPlugin(): 用同一根文件提供开发响应并生成生产配置资产。

  - 模块级类:
      无

  - 对外导出:
      viteConfig: object，Vite 开发和构建配置。
*/

// 导入来源: node:fs；导入内容: readFileSync；文件作用: 在请求或构建时读取根前端配置原文。
import { readFileSync } from 'node:fs';

import {
  // 导入来源: node:path；导入内容: dirname；文件作用: 获取当前 Vite 配置模块目录。
  dirname,
  // 导入来源: node:path；导入内容: resolve；文件作用: 组合根前端配置的绝对路径。
  resolve
} from 'node:path';

// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 把当前模块 URL 转换为 Windows 可用路径。
import { fileURLToPath } from 'node:url';

// 导入来源: vite；导入内容: defineConfig；文件作用: 包装当前 Vite 配置对象。
import { defineConfig } from 'vite';

// 导入来源: @vitejs/plugin-vue2；导入内容: vue2；文件作用: 让 Vite 编译 Vue 2 单文件组件。
import vue2 from '@vitejs/plugin-vue2';

// 导入来源: ../config/frontend.config.js；导入内容: FRONTEND_CONFIG_SOURCE；文件作用: 为 Vite 提供唯一前端配置来源。
import FRONTEND_CONFIG_SOURCE from '../config/frontend.config.js';

// 导入来源: ../scripts/startup/configContracts.mjs；导入内容: validateFrontendConfig；文件作用: 在服务或构建启动前拒绝非法配置。
import { validateFrontendConfig } from '../scripts/startup/configContracts.mjs';

// 类型: string；作用: 当前 Vite 配置模块所在 client 目录的绝对路径。
const CLIENT_ROOT = dirname(fileURLToPath(import.meta.url));

// 类型: string；作用: 根 frontend.config.js 的绝对路径；读取它不会把另外两份根配置带入前端产物。
const FRONTEND_CONFIG_FILE = resolve(CLIENT_ROOT, '..', 'config', 'frontend.config.js');

// 类型: string；作用: 配置脚本在开发服务和生产 dist 中的统一公开相对路径。
const FRONTEND_CONFIG_ASSET_PATH = 'config/frontend.config.js';

// 类型: Readonly<object>；作用: 通过完整契约后的前端配置，Vite 后续只读取所属分区。
const FRONTEND_CONFIG = validateFrontendConfig(FRONTEND_CONFIG_SOURCE);

// 类型: string；作用: 与 build.basePath 组合为浏览器实际请求路径，开发中只拦截这一项公开资产。
const FRONTEND_CONFIG_PUBLIC_PATH = `${FRONTEND_CONFIG.build.basePath}${FRONTEND_CONFIG_ASSET_PATH}`;

// 类型: Readonly<object>；作用: 只把 developmentServer 分区交给 Vite，不从命令行或源码常量补默认值。
const DEVELOPMENT_SERVER = Object.freeze({
  // 类型: string；来源: FRONTEND_CONFIG.developmentServer.host；作用: 监听配置声明的双栈或指定地址。
  host: FRONTEND_CONFIG.developmentServer.host,
  // 类型: number；来源: FRONTEND_CONFIG.developmentServer.port；作用: 使用配置声明的开发端口。
  port: FRONTEND_CONFIG.developmentServer.port,
  // 类型: boolean；来源: FRONTEND_CONFIG.developmentServer.strictPort；true 端口占用时失败，false 才允许 Vite 漂移。
  strictPort: FRONTEND_CONFIG.developmentServer.strictPort
});

/**
 * 创建前端公开配置资产插件。
 * 副作用: 开发请求读取根配置原文并写入 HTTP 响应，生产构建把同一原文发射到固定 dist 路径。
 * 成功路径: 浏览器先获得可修改的 config/frontend.config.js，再加载主应用；构建不会生成带哈希副本。
 * 失败路径: 文件读取失败交给 Vite 错误边界，构建或开发请求不会伪造空配置继续运行。
 *
 * @returns {Readonly<object>} Vite 配置插件。
 */
function createFrontendConfigAssetPlugin() {
  return {
    // 类型: string；作用: 在 Vite 日志和插件排序中稳定标识当前配置资产职责。
    name: 'wvp-frontend-config-asset',

    // 类型: object；作用: 在 Vite 完成主入口转换后注入外部配置标签，避免 Rollup 把它当成待打包入口或删除。
    transformIndexHtml: {
      order: 'post',

      /**
       * 把外部配置脚本放到最终 HTML 的 head 最前面。
       * 纯函数: 返回 Vite HTML 标签描述，不读取或修改源码文件。
       * 成功路径: 开发和生产 HTML 都先执行公开配置，再执行 Vite 生成的主入口脚本。
       * 失败路径: 路径来自已校验 FrontendConfig，不提供备用 URL 或内联配置。
       *
       * @returns {ReadonlyArray<object>} Vite 要注入的唯一配置脚本标签。
       */
      handler() {
        return [{
          tag: 'script',
          attrs: {
            type: 'module',
            src: FRONTEND_CONFIG_PUBLIC_PATH
          },
          injectTo: 'head-prepend'
        }];
      }
    },

    /**
     * 注册开发配置资产中间件。
     * 副作用: 向 Vite 中间件栈追加一个精确路径处理器；不监听新端口或改写其他响应。
     * 失败路径: 配置文件无法读取时把错误交给 Vite，不返回空脚本。
     *
     * @param {object} server Vite 开发服务器实例。
     * @returns {void} 注册完成后无返回值。
     */
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        // 类型: URL；作用: 去除查询参数后精确比较公开配置路径，避免误拦截相似资源。
        const requestUrl = new URL(request.url || '/', 'http://localhost');
        // 条件分支: 当前请求不是公开配置资产时进入；执行内容: 完整交还 Vite 后续中间件。
        if (requestUrl.pathname !== FRONTEND_CONFIG_PUBLIC_PATH) {
          next();
          return;
        }

        try {
          // 类型: string；作用: 每次请求读取根配置原文，让开发时修改 runtime 字段后刷新即可采用。
          const source = readFileSync(FRONTEND_CONFIG_FILE, 'utf8');
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(source);
        } catch (error) {
          // 失败传播: 交给 Vite 统一错误处理，不返回空脚本掩盖配置缺失。
          next(error);
        }
      });
    },

    /**
     * 向生产构建发射公开前端配置原文。
     * 副作用: 在当前 Rollup 输出中新增 config/frontend.config.js；不修改根配置文件。
     * 失败路径: 配置读取失败时构建直接失败，不生成缺少运行配置的 dist。
     *
     * @returns {void} 资产由 Rollup 输出阶段持有。
     */
    generateBundle() {
      // 类型: string；作用: 保留配置注释和部署时可编辑结构，不经过打包、压缩或内容哈希。
      const source = readFileSync(FRONTEND_CONFIG_FILE, 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: FRONTEND_CONFIG_ASSET_PATH,
        source
      });
    }
  };
}

export default defineConfig({
  // 类型: string；来源: FRONTEND_CONFIG.build.basePath；作用: 让 HTML 与资源路径符合部署静态基础路径。
  base: FRONTEND_CONFIG.build.basePath,

  // 插件顺序: 先编译 Vue 2，再由配置资产插件服务和发射唯一公开配置文件。
  plugins: [vue2(), createFrontendConfigAssetPlugin()],

  // 本地开发服务器配置: 读取唯一前端配置，不能分别启动 IPv4/IPv6 实例形成状态分叉。
  server: {
    ...DEVELOPMENT_SERVER
  }
});
