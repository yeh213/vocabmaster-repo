<template>
  <el-container class="app-shell">
    <NavSidebar />
    <el-container class="app-content">
      <el-header class="page-header">
        <div class="title-row">
          <el-button v-if="activeDeck" text @click="activeDeck = null">
            <el-icon><ArrowLeft /></el-icon> 返回
          </el-button>
          <span class="page-title">
            {{ activeDeck ? deckObj?.name : '單字' }}
          </span>
        </div>
        <div class="header-actions">
          <el-button @click="showImport = true">📥 匯入檔案</el-button>
          <template v-if="!activeDeck">
            <el-button @click="showDeckMgr = true">管理單字集</el-button>
          </template>
          <template v-else>
            <el-button type="primary" @click="openAdd">+ 新增單字</el-button>
          </template>
        </div>
      </el-header>

      <el-main>
        <!-- 單字集卡片列表 -->
        <template v-if="!activeDeck">
          <div class="deck-grid">
            <div
              v-for="d in decksStore.decks"
              :key="d.id"
              class="deck-card"
              @click="enterDeck(d.id)"
            >
              <div class="deck-name">{{ d.name }}</div>
              <div class="deck-count">{{ d.word_count }} 個單字</div>
            </div>
            <div class="deck-card deck-uncategorized" @click="enterDeck('none')">
              <div class="deck-name">未分類</div>
              <div class="deck-count">{{ uncategorizedCount }} 個單字</div>
            </div>
          </div>
        </template>

        <!-- 單字列表 -->
        <template v-else>
          <!-- 練習模式列 -->
          <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
            <el-button :disabled="deckWords.length === 0" @click="startReview()">
              ⌨️ 打字練習
            </el-button>
          </div>

          <!-- A-Z 標籤列 -->
          <div class="az-tabs">
            <button
              class="az-btn"
              :class="{ active: filterGroup === '' }"
              @click="filterGroup = ''"
            >全部</button>
            <button
              v-for="g in groups"
              :key="g"
              class="az-btn"
              :class="{ active: filterGroup === g, empty: !groupCount[g] }"
              @click="filterGroup = g"
            >{{ g.toUpperCase() }}</button>
          </div>

          <div class="search-row">
            <el-input v-model="search" placeholder="搜尋..." class="search-input" clearable />
            <span style="color:#999;font-size:13px;white-space:nowrap">共 {{ filtered.length }} 字</span>
          </div>

          <!-- 手機：卡片清單 -->
          <div v-if="isMobile" v-loading="wordsStore.loading" class="word-cards">
            <div v-for="w in pagedWords" :key="w.id" class="word-card">
              <el-checkbox :model-value="selectedIds.has(w.id)" @change="toggleSelect(w)" />
              <div class="wc-body">
                <div class="wc-top">
                  <span class="wc-word">{{ w.word }}</span>
                  <span v-if="w.part_of_speech" class="wc-pos">{{ w.part_of_speech }}</span>
                  <el-tag :type="statusType(w)" size="small" class="wc-tag">{{ statusLabel(w) }}</el-tag>
                </div>
                <div class="wc-def">{{ w.definition }}</div>
                <div class="wc-actions">
                  <el-button size="small" @click="openEdit(w)">編輯</el-button>
                  <el-button size="small" type="danger" plain @click="remove(w.id)">刪除</el-button>
                </div>
              </div>
            </div>
            <p v-if="!wordsStore.loading && pagedWords.length === 0" class="empty-text">沒有單字</p>
          </div>

          <!-- 桌機：表格 -->
          <el-table v-else :data="pagedWords" row-key="id" v-loading="wordsStore.loading" stripe @selection-change="selected = $event">
            <el-table-column type="selection" width="44" />
            <el-table-column prop="word" label="單字" width="160" />
            <el-table-column prop="part_of_speech" label="詞性" width="80" />
            <el-table-column prop="definition" label="中文釋義" />
            <el-table-column label="狀態" width="90">
              <template #default="{ row }">
                <el-tag :type="statusType(row)" size="small">{{ statusLabel(row) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="openEdit(row)">編輯</el-button>
                <el-button size="small" type="danger" @click="remove(row.id)">刪除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分頁：一次只畫 PAGE_SIZE 列，避免 1500 列一次渲染造成手機卡頓 -->
          <el-pagination
            v-if="filtered.length > PAGE_SIZE"
            v-model:current-page="page"
            :page-size="PAGE_SIZE"
            :total="filtered.length"
            :pager-count="5"
            layout="prev, pager, next"
            size="small"
            background
            style="margin-top:12px;justify-content:center"
          />

          <div v-if="selected.length > 0" style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:13px">已選 {{ selected.length }} 字，移動到：</span>
            <el-select v-model="batchDeck" placeholder="選擇單字集" clearable style="width:150px">
              <el-option label="（移除分類）" :value="null" />
              <el-option v-for="d in decksStore.decks" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
            <el-button type="primary" size="small" @click="batchAssign">套用</el-button>
          </div>
        </template>
      </el-main>
    </el-container>
  </el-container>

  <!-- 新增/編輯 Dialog -->
  <el-dialog v-model="showForm" :title="editId ? '編輯單字' : '新增單字'" width="500px">
    <el-form :model="form" label-width="80px" :label-position="isMobile ? 'top' : 'right'">
      <el-form-item label="英文單字">
        <el-input v-model="form.word" />
      </el-form-item>
      <el-form-item label="詞性">
        <el-input v-model="form.part_of_speech" placeholder="adj.;n." />
      </el-form-item>
      <el-form-item label="中文釋義">
        <el-input v-model="form.definition" />
      </el-form-item>
      <el-form-item label="例句">
        <el-input v-model="form.example" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="字首分類">
        <el-tag>{{ groupPreview }}</el-tag>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showForm = false">取消</el-button>
      <el-button type="primary" @click="save">儲存</el-button>
    </template>
  </el-dialog>

  <!-- 管理單字集 -->
  <el-dialog v-model="showDeckMgr" title="管理單字集" width="420px">
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <el-input v-model="newDeckName" placeholder="新單字集名稱" @keyup.enter="addDeck" />
      <el-button type="primary" @click="addDeck">新增</el-button>
    </div>
    <el-table :data="decksStore.decks" size="small">
      <el-table-column label="名稱">
        <template #default="{ row }">
          <el-input v-if="editingDeck === row.id" v-model="editDeckName" size="small" @keyup.enter="saveDeck(row.id)" />
          <span v-else>{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="word_count" label="單字數" width="70" />
      <el-table-column label="操作" width="140">
        <template #default="{ row }">
          <template v-if="editingDeck === row.id">
            <el-button size="small" type="primary" @click="saveDeck(row.id)">存</el-button>
            <el-button size="small" @click="editingDeck = null">取消</el-button>
          </template>
          <template v-else>
            <el-button size="small" @click="startEditDeck(row)">改名</el-button>
            <el-button size="small" type="danger" @click="removeDeck(row.id)">刪除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <!-- 複習 Dialog -->
  <ReviewDialog
    v-model="showReview"
    :words="reviewWords"
  />

  <!-- 匯入檔案 -->
  <ImportDialog v-model="showImport" :default-deck-id="activeDeck" />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useIsMobile } from '../composables/useIsMobile.js'
import NavSidebar from '../components/NavSidebar.vue'
import ReviewDialog from '../components/ReviewDialog.vue'
import ImportDialog from '../components/ImportDialog.vue'
import { useWordsStore } from '../stores/words.js'
import { useDecksStore } from '../stores/decks.js'

const wordsStore = useWordsStore()
const decksStore = useDecksStore()

const activeDeck = ref(null)
const search = ref('')
const filterGroup = ref('')
const selected = ref([])
const batchDeck = ref(null)
const showForm = ref(false)
const showImport = ref(false)
const showDeckMgr = ref(false)
const editId = ref(null)
const form = ref({ word: '', part_of_speech: '', definition: '', example: '' })
const newDeckName = ref('')
const editingDeck = ref(null)
const editDeckName = ref('')

const groups = 'abcdefghijklmnopqrstuvwxyz'.split('')

const showReview = ref(false)
const reviewWords = ref([])

const deckWords = computed(() =>
  wordsStore.words.filter(w =>
    activeDeck.value === 'none' ? !w.deck_id : w.deck_id === activeDeck.value
  )
)

const groupCount = computed(() => {
  const counts = {}
  for (const g of groups) counts[g] = 0
  for (const w of deckWords.value) {
    const l = (w.word ?? '').charAt(0).toLowerCase()
    if (counts[l] !== undefined) counts[l]++
  }
  return counts
})

function startReview() {
  if (deckWords.value.length === 0) {
    ElMessage.info('沒有可複習的單字')
    return
  }
  reviewWords.value = deckWords.value
  showReview.value = true
}

const deckObj = computed(() => decksStore.decks.find(d => d.id === activeDeck.value))

const uncategorizedCount = computed(() => wordsStore.words.filter(w => !w.deck_id).length)

const groupPreview = computed(() => {
  const l = (form.value.word ?? '').charAt(0).toLowerCase()
  return /^[a-z]$/.test(l) ? `letter-${l}` : '—'
})

const filtered = computed(() => {
  return wordsStore.words.filter(w => {
    const matchDeck = activeDeck.value === 'none' ? !w.deck_id : w.deck_id === activeDeck.value
    const matchSearch = !search.value ||
      w.word.toLowerCase().includes(search.value.toLowerCase()) ||
      (w.definition ?? '').includes(search.value)
    const matchGroup = !filterGroup.value || w.group_id === `letter-${filterGroup.value}`
    return matchDeck && matchSearch && matchGroup
  })
})

const PAGE_SIZE = 50
const page = ref(1)
const pagedWords = computed(() =>
  filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
)
watch([search, filterGroup, activeDeck], () => { page.value = 1 })

// 手機卡片的勾選（桌機由 el-table 管理）；換頁時只保留目前頁面上的勾選，與表格行為一致
const isMobile = useIsMobile()
const selectedIds = computed(() => new Set(selected.value.map(w => w.id)))
function toggleSelect(w) {
  selected.value = selectedIds.value.has(w.id)
    ? selected.value.filter(s => s.id !== w.id)
    : [...selected.value, w]
}
watch(pagedWords, list => {
  if (!isMobile.value) return
  const ids = new Set(list.map(w => w.id))
  selected.value = selected.value.filter(s => ids.has(s.id))
})

// 單字已在 onMounted 全部載入，切換單字集不必重抓（約 1 MB）
async function enterDeck(deckId) {
  activeDeck.value = deckId
  search.value = ''
  filterGroup.value = ''
  if (wordsStore.words.length === 0) await wordsStore.fetchAll()
}

function statusLabel(row) {
  if (!row.last_reviewed) return '新增'
  if (row.interval >= 21) return '已熟練'
  return '學習中'
}
function statusType(row) {
  if (!row.last_reviewed) return 'info'
  if (row.interval >= 21) return 'success'
  return 'warning'
}

function openAdd() {
  editId.value = null
  form.value = { word: '', part_of_speech: '', definition: '', example: '' }
  showForm.value = true
}
function openEdit(row) {
  editId.value = row.id
  form.value = { word: row.word, part_of_speech: row.part_of_speech, definition: row.definition, example: row.example }
  showForm.value = true
}

async function save() {
  if (!form.value.word) return ElMessage.warning('請填寫英文單字')
  try {
    const data = { ...form.value, deck_id: activeDeck.value === 'none' ? null : activeDeck.value }
    if (editId.value) await wordsStore.editWord(editId.value, data)
    else await wordsStore.addWord(data)
    showForm.value = false
    ElMessage.success('已儲存')
  } catch (e) {
    ElMessage.error('儲存失敗：' + e.message)
  }
}

// ElMessageBox.confirm 在按「取消」時會 reject，視為正常操作
function confirmed(promise) {
  return promise.then(() => true, () => false)
}

async function remove(id) {
  if (!await confirmed(ElMessageBox.confirm('確定刪除這個單字？', '刪除', { type: 'warning' }))) return
  await wordsStore.removeWord(id)
  ElMessage.success('已刪除')
}

async function batchAssign() {
  const ids = selected.value.map(w => w.id)
  await decksStore.assignDeck(batchDeck.value, ids)
  await wordsStore.fetchAll()
  await decksStore.fetchAll()
  selected.value = []
  ElMessage.success('已更新')
}

async function addDeck() {
  if (!newDeckName.value.trim()) return
  await decksStore.addDeck(newDeckName.value.trim())
  newDeckName.value = ''
}
function startEditDeck(row) {
  editingDeck.value = row.id
  editDeckName.value = row.name
}
async function saveDeck(id) {
  await decksStore.renameDeck(id, editDeckName.value)
  editingDeck.value = null
}
async function removeDeck(id) {
  if (!await confirmed(ElMessageBox.confirm('刪除後，該單字集內的單字會變成未分類。確定刪除？', '刪除單字集', { type: 'warning' }))) return
  await decksStore.removeDeck(id)
  ElMessage.success('已刪除')
}

onMounted(async () => {
  await decksStore.fetchAll()
  await wordsStore.fetchAll()
})
</script>

<style scoped>
.app-shell { height: 100vh; height: 100dvh; }
.app-content { min-width: 0; min-height: 0; }
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 20px;
}
.title-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.page-title {
  font-size: 18px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.header-actions .el-button + .el-button { margin-left: 0; }
.search-row { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.search-input { width: 200px; }

/* 手機卡片清單 */
.word-cards { display: flex; flex-direction: column; gap: 8px; min-height: 80px; }
.word-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px 12px;
}
.wc-body { flex: 1; min-width: 0; }
.wc-top { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.wc-word { font-size: 17px; font-weight: 600; color: #303133; word-break: break-word; }
.wc-pos { font-size: 12px; color: #909399; }
.wc-tag { margin-left: auto; }
.wc-def { font-size: 14px; color: #606266; margin-top: 4px; line-height: 1.5; word-break: break-word; }
.wc-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; }
.wc-actions .el-button + .el-button { margin-left: 0; }
.empty-text { text-align: center; color: #909399; padding: 24px 0; }

.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  padding: 8px 0;
}
.deck-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 24px 20px;
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.deck-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-color: #409eff;
}
.deck-name {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
}
.deck-count {
  color: #909399;
  font-size: 13px;
}
.deck-uncategorized .deck-name {
  color: #909399;
}

.az-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}
.az-btn {
  padding: 3px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  transition: all 0.15s;
}
.az-btn:hover {
  border-color: #409eff;
  color: #409eff;
}
.az-btn.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
.az-btn.empty {
  color: #c0c4cc;
  border-color: #e9e9eb;
}

/* 手機：必須放在最後，才能覆蓋上面的基本樣式 */
@media (max-width: 768px) {
  .app-shell { flex-direction: column; }
  .page-header {
    height: auto;
    flex-wrap: wrap;
    padding: 8px 12px;
  }
  .header-actions .el-button { padding: 8px 10px; }
  :deep(.el-main) { padding: 12px; }
  .deck-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .deck-card { padding: 16px 14px; }
  .deck-name { font-size: 16px; }
  .search-input { flex: 1; width: auto; }

  /* A–Z 改成單列橫向捲動 */
  .az-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
  }
  .az-tabs::-webkit-scrollbar { display: none; }
  .az-btn { flex-shrink: 0; padding: 6px 11px; font-size: 14px; }
}
</style>
