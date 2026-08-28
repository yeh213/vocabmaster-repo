import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
for (const [name, comp] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, comp)
}
app.mount('#app')
