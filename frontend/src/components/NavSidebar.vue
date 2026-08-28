<template>
  <el-aside width="200px" class="sidebar">
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
    </el-menu>

    <div class="ai-panel">
      <div class="ai-label">🤖 Gemini API Key</div>
      <div class="ai-key-row">
        <input
          v-model="localKey"
          :type="showKey ? 'text' : 'password'"
          placeholder=""
          class="ai-input"
          @change="handleSave"
        />
        <button class="ai-eye" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
      </div>

      <div class="ai-label" style="margin-top:10px">模型</div>
      <select v-model="localModel" class="ai-select" @change="handleSave">
        <option v-for="m in GEMINI_MODELS" :key="m.id" :value="m.id">{{ m.id }}</option>
      </select>

      <div v-if="saved" class="ai-saved">✓ 已儲存</div>
    </div>

    <div class="bottom">
      <el-button text @click="auth.logout(); router.push('/login')">登出</el-button>
    </div>
  </el-aside>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useAISettingsStore, GEMINI_MODELS } from '../stores/aiSettings.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ai = useAISettingsStore()

const localKey   = ref(ai.apiKey)
const localModel = ref(ai.model)
const showKey    = ref(false)
const saved      = ref(false)

let saveTimer = null
function handleSave() {
  ai.save(localKey.value.trim(), localModel.value)
  saved.value = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { saved.value = false }, 2000)
}
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
  border-right: 1px solid #e4e7ed;
}

.logo {
  padding: 20px 16px;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.ai-panel {
  padding: 14px 12px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}

.ai-label {
  font-size: 11px;
  color: #909399;
  margin-bottom: 5px;
  font-weight: 500;
}

.ai-key-row {
  display: flex;
  gap: 4px;
}

.ai-input {
  flex: 1;
  width: 0;
  padding: 5px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
  color: #303133;
}
.ai-input:focus { border-color: #409eff; }

.ai-eye {
  padding: 0 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
}
.ai-eye:hover { background: #f5f7fa; }

.ai-select {
  width: 100%;
  padding: 5px 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
  color: #303133;
  cursor: pointer;
  background: #fff;
}
.ai-select:focus { border-color: #409eff; }

.ai-saved {
  color: #67c23a;
  font-size: 11px;
  margin-top: 5px;
}

.bottom {
  margin-top: auto;
  padding: 16px;
  text-align: center;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}
</style>
