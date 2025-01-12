import { createApp } from 'vue'
import App from './App.vue'
import naive from 'naive-ui'
import './styles/index.css'
import './styles/global-overrides.css'
import router from './router'
import api from './utils/api'
import { createDiscreteApi } from 'naive-ui'

const { message } = createDiscreteApi(['message'])

const app = createApp(App)

app.config.globalProperties.$axios = api
app.config.globalProperties.$message = message

app.use(naive)
app.use(router)
app.mount('#app')
