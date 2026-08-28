<template>
  <el-aside width="200px">
    <div class="logo">VocabMaster</div>
    <el-menu :default-active="route.path" router>
      <el-menu-item index="/vocab">
        <el-icon><Reading /></el-icon>單字
      </el-menu-item>
      <el-menu-item index="/quiz">
        <el-icon><List /></el-icon>考題
      </el-menu-item>
      <el-menu-item index="/notes">
        <el-icon><Notebook /></el-icon>筆記
      </el-menu-item>
      <el-menu-item @click="showAI = true">
        <el-icon><Cpu /></el-icon>
        AI 設定
        <el-badge v-if="ai.hasKey" value="✓" type="success" style="margin-left:auto" />
      </el-menu-item>
    </el-menu>
    <div class="bottom">
      <el-button text @click="auth.logout(); router.push('/login')">登出</el-button>
    </div>
  </el-aside>

  <AISettingsDialog v-model="showAI" />
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useAISettingsStore } from '../stores/aiSettings.js'
import AISettingsDialog from './AISettingsDialog.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ai = useAISettingsStore()

const showAI = ref(false)
</script>

<style scoped>
.logo {
  padding: 20px 16px;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid #eee;
}
.bottom {
  position: absolute;
  bottom: 16px;
  left: 0;
  width: 100%;
  text-align: center;
}
</style>
