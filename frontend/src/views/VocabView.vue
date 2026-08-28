<template>
  <el-container style="height:100vh">
    <NavSidebar />
    <el-container>
      <el-header style="display:flex;align-items:center;justify-content:space-between;padding:0 20px">
        <div style="display:flex;align-items:center;gap:12px">
          <el-button v-if="activeDeck" text @click="activeDeck = null">
            <el-icon><ArrowLeft /></el-icon> 返回
          </el-button>
          <span style="font-size:18px;font-weight:bold">
            {{ activeDeck ? deckObj?.name : '單字' }}
          </span>
        </div>
        <div style="display:flex;gap:8px">
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

          <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
            <el-input v-model="search" placeholder="搜尋..." style="width:200px" clearable />
            <span style="color:#999;font-size:13px">共 {{ filtered.length }} 字</span>
          </div>

          <el-table :data="filtered" v-loading="wordsStore.loading" stripe @selection-change="selected = $event">
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

          <div v-if="selected.length > 0" style="margin-top:12px;display:flex;align-items:center;gap:8px">
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
    <el-form :model="form" label-width="80px">
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
    @done="wordsStore.fetchAll()"
  />

  <!-- 首次匯入 -->
  <el-dialog v-model="showImport" title="☁️ 首次匯入" width="420px">
    <p>將 vocab-data.json 的 1500 個單字批次上傳，並指定到單字集。</p>
    <el-form style="margin-top:12px" label-width="80px">
      <el-form-item label="單字集">
        <el-select v-model="importDeckId" placeholder="選擇單字集（選填）" clearable style="width:200px">
          <el-option v-for="d in decksStore.decks" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showImport = false">取消</el-button>
      <el-button type="primary" :loading="importing" @click="doImport">開始匯入</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import NavSidebar from '../components/NavSidebar.vue'
import ReviewDialog from '../components/ReviewDialog.vue'
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
const importing = ref(false)
const importDeckId = ref('')
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

async function enterDeck(deckId) {
  activeDeck.value = deckId
  search.value = ''
  filterGroup.value = ''
  await wordsStore.fetchAll()
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

async function remove(id) {
  await ElMessageBox.confirm('確定刪除這個單字？', '刪除', { type: 'warning' })
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
  await ElMessageBox.confirm('刪除後，該單字集內的單字會變成未分類。確定刪除？', '刪除單字集', { type: 'warning' })
  await decksStore.removeDeck(id)
  ElMessage.success('已刪除')
}

async function doImport() {
  importing.value = true
  try {
    const res = await fetch('/vocab-data.json')
    const data = await res.json()
    const all = data.words.map(w => ({ ...w, deck_id: importDeckId.value || null }))
    const CHUNK = 200
    let total = 0
    for (let i = 0; i < all.length; i += CHUNK) {
      const result = await wordsStore.importWords(all.slice(i, i + CHUNK))
      total += result.inserted
    }
    await decksStore.fetchAll()
    ElMessage.success(`匯入完成，共 ${total} 筆`)
    showImport.value = false
    wordsStore.fetchAll()
  } catch (e) {
    ElMessage.error('匯入失敗：' + e.message)
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  await decksStore.fetchAll()
  await wordsStore.fetchAll()
})
</script>

<style scoped>
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
</style>
