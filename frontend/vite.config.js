import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    // Element Plus 按需載入：只打包模板裡用到的元件與其樣式（含 v-loading）
    Components({
      resolvers: [ElementPlusResolver()],
      dts: false,
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
    watch: {
      ignored: ['**/public/vocab-data.json'],
    },
  },
})
