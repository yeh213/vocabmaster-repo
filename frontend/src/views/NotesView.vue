<template>
  <el-container style="height:100vh">
    <NavSidebar />
    <el-container>
      <el-aside width="260px" style="border-right:1px solid #eee;overflow-y:auto">
        <div style="padding:12px;display:flex;gap:8px">
          <el-button type="primary" size="small" @click="openAdd" style="flex:1">+ 新增</el-button>
          <el-button size="small" @click="showImport = true">匯入 .md</el-button>
        </div>
        <el-menu :default-active="activeId" @select="selectNote">
          <el-menu-item v-for="n in store.notes" :key="n.id" :index="n.id">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              {{ n.title || '（無標題）' }}
            </span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header style="display:flex;align-items:center;justify-content:space-between" v-if="current">
          <el-input v-model="current.title" placeholder="標題" style="width:300px" @change="save" />
          <el-button type="danger" size="small" @click="remove(current.id)">刪除</el-button>
        </el-header>
        <el-main v-if="current">
          <el-tabs v-model="tab">
            <el-tab-pane label="編輯" name="edit">
              <el-input
                v-model="current.content"
                type="textarea"
                :rows="20"
                placeholder="Markdown 內容..."
                @change="save"
              />
            </el-tab-pane>
            <el-tab-pane label="預覽" name="preview">
              <div class="md-preview" v-html="rendered" />
            </el-tab-pane>
          </el-tabs>
        </el-main>
        <el-main v-else style="display:flex;align-items:center;justify-content:center;color:#999">
          選擇一則筆記，或新增筆記
        </el-main>
      </el-container>
    </el-container>
  </el-container>

  <!-- 匯入 .md -->
  <el-dialog v-model="showImport" title="匯入 .md 檔" width="400px">
    <input type="file" accept=".md" @change="pickMd" ref="fileInput" />
    <template #footer>
      <el-button @click="showImport = false">取消</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MarkdownIt from 'markdown-it'
import NavSidebar from '../components/NavSidebar.vue'
import { useNotesStore } from '../stores/notes.js'

const md = new MarkdownIt()
const store = useNotesStore()
const activeId = ref('')
const current = ref(null)
const tab = ref('edit')
const showImport = ref(false)

const rendered = computed(() => current.value ? md.render(current.value.content || '') : '')

function selectNote(id) {
  activeId.value = id
  current.value = { ...store.notes.find(n => n.id === id) }
}

async function openAdd() {
  const n = await store.addNote({ title: '新筆記', content: '' })
  selectNote(n.id)
}

async function save() {
  if (!current.value) return
  await store.editNote(current.value.id, { title: current.value.title, content: current.value.content })
}

async function remove(id) {
  await ElMessageBox.confirm('確定刪除？', '刪除', { type: 'warning' })
  await store.removeNote(id)
  current.value = null
  activeId.value = ''
  ElMessage.success('已刪除')
}

async function pickMd(e) {
  const file = e.target.files[0]
  if (!file) return
  const content = await file.text()
  const title = file.name.replace(/\.md$/, '')
  await store.importMd(title, content)
  showImport.value = false
  ElMessage.success(`已匯入：${title}`)
}

onMounted(() => store.fetchAll())
</script>

<style scoped>
.md-preview { padding: 8px; line-height: 1.8; }
.md-preview :deep(h1), .md-preview :deep(h2), .md-preview :deep(h3) { margin: 16px 0 8px; }
.md-preview :deep(code) { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
.md-preview :deep(pre) { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
</style>
