<template>
  <el-dialog v-model="visible" title="🤖 AI 設定" width="460px" @close="reset">
    <el-form label-width="100px">
      <el-form-item label="Gemini API Key">
        <el-input
          v-model="localKey"
          :type="showKey ? 'text' : 'password'"
          placeholder="AIza..."
          autocomplete="off"
        >
          <template #suffix>
            <el-icon style="cursor:pointer" @click="showKey = !showKey">
              <View v-if="!showKey" />
              <Hide v-else />
            </el-icon>
          </template>
        </el-input>
        <div style="color:#909399;font-size:12px;margin-top:4px">
          Key 僅儲存於本機 localStorage，不會傳送至任何伺服器
        </div>
      </el-form-item>

      <el-form-item label="模型">
        <el-select v-model="localModel" style="width:100%">
          <el-option
            v-for="m in GEMINI_MODELS"
            :key="m.id"
            :label="m.label"
            :value="m.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSave">儲存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Hide } from '@element-plus/icons-vue'
import { useAISettingsStore, GEMINI_MODELS } from '../stores/aiSettings.js'

const visible = defineModel({ type: Boolean, default: false })

const ai = useAISettingsStore()
const localKey   = ref('')
const localModel = ref('gemini-3.7-flash')
const showKey    = ref(false)

watch(visible, (v) => {
  if (v) {
    localKey.value   = ai.apiKey
    localModel.value = ai.model
    showKey.value    = false
  }
})

function reset() {
  showKey.value = false
}

function handleSave() {
  ai.save(localKey.value.trim(), localModel.value)
  visible.value = false
  ElMessage.success(localKey.value.trim() ? '✅ AI 設定已儲存' : '已清除 AI 設定')
}
</script>
