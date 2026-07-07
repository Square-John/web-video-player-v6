// defineConfig 用来获得 Vite 配置提示，也让配置对象结构更清晰。
import { defineConfig } from 'vite';

// 当前项目使用 Vue 2，所以这里引入 Vue 2 专用插件，让 Vite 能识别 .vue 单文件组件。
import vue2 from '@vitejs/plugin-vue2';

export default defineConfig({
  // 注册 Vue 2 插件，否则 Vite 无法正确编译 App.vue 这类 Vue 单文件组件。
  plugins: [vue2()]
});
