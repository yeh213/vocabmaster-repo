import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Element Plus 元件由 vite.config.js 的 unplugin-vue-components 按需載入。
// ElMessage / ElMessageBox 是在 script 裡直接 import 的，樣式需手動引入。
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import './style.css'
import App from './App.vue'
import router from './router.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
