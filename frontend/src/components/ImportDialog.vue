<template>
  <el-dialog
    v-model="visible"
    title="📥 匯入單字檔"
    :width="'min(820px, 96vw)'"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <!-- 步驟 1：選檔 -->
    <div v-if="step === 'pick'">
      <p class="hint">支援兩種格式：</p>
      <ul class="hint-list">
        <li>
          <b>CSV</b>（Excel / Google 試算表另存）：欄位
          <code>word, part_of_speech, definition, example, example_zh</code>，
          只有 <code>word</code>、<code>definition</code> 必填。
          同一個字有多個詞性就寫多列；同詞性多個意思用 <code>;</code> 分隔。
        </li>
        <li><b>JSON</b>：vocab-data.json 格式（<code>{ "words": [...] }</code>），會保留複習紀錄。</li>
      </ul>
      <p class="hint">已存在的單字會自動略過，不會覆蓋。</p>

      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <el-button type="primary" @click="fileInput?.click()">選擇檔案…</el-button>
        <el-button @click="downloadTemplate">下載 CSV 範本</el-button>
      </div>
      <input ref="fileInput" type="file" accept=".csv,.json,.txt" style="display:none" @change="onFile" />
      <el-alert v-if="fatal" :title="fatal" type="error" show-icon :closable="false" style="margin-top:14px" />
    </div>

    <!-- 步驟 2：預覽 -->
    <div v-else-if="step === 'preview'">
      <div class="summary">
        <span class="file-name">{{ fileName }}</span>
        <el-tag type="success">新增 {{ counts.new }}</el-tag>
        <el-tag type="info">已存在，略過 {{ counts.exists }}</el-tag>
        <el-tag v-if="counts.error" type="danger">有問題 {{ counts.error }}</el-tag>
      </div>

      <el-radio-group v-model="filter" size="small" style="margin-bottom:10px">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="new">新增</el-radio-button>
        <el-radio-button value="exists">已存在</el-radio-button>
        <el-radio-button value="error">有問題</el-radio-button>
      </el-radio-group>

      <el-table :data="shownRows" size="small" max-height="360" :row-class-name="rowClass">
        <el-table-column prop="line" label="列" width="64" />
        <el-table-column prop="word" label="單字" width="140" />
        <el-table-column prop="part_of_speech" label="詞性" width="80" />
        <el-table-column prop="definition" label="中文釋義" min-width="140" />
        <el-table-column label="例句" min-width="180">
          <template #default="{ row }">
            <span class="example">{{ row.example }}</span>
          </template>
        </el-table-column>
        <el-table-column label="狀態" width="150">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'new'" type="success" size="small">新增</el-tag>
            <el-tag v-else-if="row.status === 'exists'" type="info" size="small">已存在，略過</el-tag>
            <span v-else class="err-text">{{ row.error }}</span>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="shownRows.length === 0" class="hint" style="text-align:center">沒有符合的項目</p>

      <div class="deck-row">
        <span>放進單字集：</span>
        <el-select v-model="deckChoice" style="width:180px">
          <el-option label="未分類" :value="NONE" />
          <el-option v-for="d in decksStore.decks" :key="d.id" :label="d.name" :value="d.id" />
          <el-option label="＋ 新建單字集…" :value="NEW" />
        </el-select>
        <el-input
          v-if="deckChoice === NEW"
          v-model="newDeckName"
          placeholder="新單字集名稱"
          style="width:180px"
        />
      </div>
      <p v-if="counts.error" class="hint">有問題的項目不會匯入；修正檔案後可以重新選擇。</p>
    </div>

    <!-- 步驟 3：完成 -->
    <div v-else style="text-align:center;padding:16px 0">
      <div style="font-size:40px;margin-bottom:10px">✅</div>
      <p style="font-size:16px">已匯入 <b>{{ result.inserted }}</b> 個單字</p>
      <p v-if="result.skipped" class="hint">另有 {{ result.skipped }} 個在寫入時發現已存在，已略過</p>
    </div>

    <template #footer>
      <template v-if="step === 'pick'">
        <el-button @click="visible = false">取消</el-button>
      </template>
      <template v-else-if="step === 'preview'">
        <el-button @click="reset">重新選擇檔案</el-button>
        <el-button @click="visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="importing"
          :disabled="counts.new === 0 || (deckChoice === NEW && !newDeckName.trim())"
          @click="doImport"
        >匯入 {{ counts.new }} 個單字</el-button>
      </template>
      <template v-else>
        <el-button type="primary" @click="visible = false">完成</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useWordsStore } from '../stores/words.js'
import { useDecksStore } from '../stores/decks.js'
import { parseImportFile, CSV_TEMPLATE } from '../utils/importParser.js'

const props = defineProps({
  modelValue: Boolean,
  // 目前所在的單字集：deck id、'none'（未分類）或 null（首頁）
  defaultDeckId: { type: String, default: null },
})
const emit = defineEmits(['update:modelValue', 'done'])

const NONE = '__none__'
const NEW = '__new__'
const CHUNK = 200

const wordsStore = useWordsStore()
const decksStore = useDecksStore()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const fileInput = ref(null)
const step = ref('pick')
const fileName = ref('')
const items = ref([])
const fatal = ref('')
const filter = ref('all')
const deckChoice = ref(NONE)
const newDeckName = ref('')
const importing = ref(false)
const result = ref({ inserted: 0, skipped: 0 })

watch(() => props.modelValue, async v => {
  if (!v) return
  reset()
  const id = props.defaultDeckId
  deckChoice.value = id && id !== 'none' ? id : NONE
  // 比對重複需要完整單字清單
  if (wordsStore.words.length === 0) await wordsStore.fetchAll()
})

const existing = computed(() => new Set(wordsStore.words.map(w => (w.word ?? '').toLowerCase())))

const rows = computed(() => items.value.map(it => ({
  ...it,
  status: it.error ? 'error' : existing.value.has(it.key) ? 'exists' : 'new',
})))

const counts = computed(() => {
  const c = { new: 0, exists: 0, error: 0 }
  for (const r of rows.value) c[r.status]++
  return c
})

const shownRows = computed(() =>
  filter.value === 'all' ? rows.value : rows.value.filter(r => r.status === filter.value)
)

function rowClass({ row }) {
  return row.status === 'error' ? 'row-error' : row.status === 'exists' ? 'row-exists' : ''
}

function reset() {
  step.value = 'pick'
  fileName.value = ''
  items.value = []
  fatal.value = ''
  filter.value = 'all'
  newDeckName.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  fatal.value = ''
  try {
    const parsed = parseImportFile(file.name, await file.arrayBuffer())
    if (parsed.fatal) {
      fatal.value = parsed.fatal
      e.target.value = ''
      return
    }
    fileName.value = file.name
    items.value = parsed.items
    filter.value = parsed.items.some(i => i.error) ? 'error' : 'all'
    step.value = 'preview'
  } catch (err) {
    fatal.value = '讀取檔案失敗：' + err.message
    e.target.value = ''
  }
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'vocab-template.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function doImport() {
  importing.value = true
  try {
    let deckId = null
    if (deckChoice.value === NEW) {
      deckId = (await decksStore.addDeck(newDeckName.value.trim())).id
    } else if (deckChoice.value !== NONE) {
      deckId = deckChoice.value
    }

    const payloads = rows.value.filter(r => r.status === 'new').map(r => r.payload)
    let inserted = 0
    let skipped = 0
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const res = await wordsStore.importWords(payloads.slice(i, i + CHUNK), deckId)
      inserted += res.inserted ?? 0
      skipped += res.skipped ?? 0
    }
    result.value = { inserted, skipped }
    step.value = 'done'
    await Promise.all([wordsStore.fetchAll(), decksStore.fetchAll()])
    emit('done')
  } catch (err) {
    ElMessage.error('匯入失敗：' + err.message)
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.hint { color: #606266; font-size: 13px; margin: 6px 0; }
.hint-list { color: #606266; font-size: 13px; padding-left: 20px; line-height: 1.7; margin: 4px 0; }
.hint-list code, .hint code { background: #f4f4f5; padding: 0 4px; border-radius: 3px; font-size: 12px; }
.summary { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.file-name { font-weight: 600; margin-right: 4px; word-break: break-all; }
.example { white-space: pre-line; font-size: 12px; color: #606266; }
.err-text { color: #f56c6c; font-size: 12px; }
.deck-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
:deep(.row-error) { --el-table-tr-bg-color: #fef0f0; }
:deep(.row-exists) { color: #a8abb2; }
</style>
