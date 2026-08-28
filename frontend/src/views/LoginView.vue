<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <h2>VocabMaster</h2>
      <p>請輸入存取 Token</p>
      <el-input
        v-model="token"
        placeholder="Bearer token"
        show-password
        @keyup.enter="submit"
      />
      <el-button type="primary" style="margin-top:16px;width:100%" @click="submit">
        進入
      </el-button>
      <p v-if="error" style="color:red;margin-top:8px">{{ error }}</p>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { api } from '../api.js'

const token = ref('')
const error = ref('')
const router = useRouter()
const auth = useAuthStore()

async function submit() {
  error.value = ''
  auth.login(token.value)
  try {
    await api.get('/api/ping')
    router.push('/vocab')
  } catch {
    auth.logout()
    error.value = 'Token 錯誤，請重新輸入'
  }
}
</script>

<style scoped>
.login-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f0f2f5;
}
.login-card {
  width: 360px;
  text-align: center;
}
h2 { margin-bottom: 8px; }
p { color: #666; margin-bottom: 16px; }
</style>
