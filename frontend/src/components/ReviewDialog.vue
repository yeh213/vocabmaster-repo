<template>
  <el-dialog
    v-model="visible"
    :title="phase === 'settings' ? '打字練習' : phase === 'summary' ? '練習結果' : modeTitle"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <!-- 設定頁 -->
    <div v-if="phase === 'settings'" class="settings-panel">
      <div class="settings-group">
        <div class="settings-label">作答方向</div>
        <div class="dir-opts">
          <div class="dir-opt" :class="{ active: dir === 'zh2en' }" @click="dir = 'zh2en'">
            <div class="opt-title">看中文，打英文</div>
            <div class="opt-desc">認識並拼寫單字</div>
          </div>
          <div class="dir-opt" :class="{ active: dir === 'en2zh' }" @click="dir = 'en2zh'">
            <div class="opt-title">看英文，打中文</div>
            <div class="opt-desc">加強釋義記憶</div>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-label">提示設定</div>
        <label class="check-row">
          <el-checkbox v-model="showAnswer" />
          <div>
            <div>顯示答案</div>
            <div class="opt-desc">練習模式：答案可見，不計入 SM-2</div>
          </div>
        </label>
        <label class="check-row" style="margin-top:12px">
          <el-checkbox v-model="showExample" />
          <div>顯示例句</div>
        </label>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="startPractice">開始 →</el-button>
      </div>
    </div>

    <!-- 完成摘要 -->
    <div v-else-if="phase === 'summary'" style="text-align:center;padding:20px 0">
      <div style="font-size:44px;margin-bottom:12px">
        {{ showAnswer ? '📖' : (accuracy === 100 ? '🏆' : accuracy >= 70 ? '🎉' : '📚') }}
      </div>
      <h3 style="margin-bottom:20px">{{ showAnswer ? '練習完成！' : '測驗完成！' }}</h3>
      <div style="display:flex;justify-content:center;gap:40px;margin-bottom:28px">
        <div>
          <div class="stat-num" style="color:#409eff">{{ total }}</div>
          <div class="stat-label">已練習</div>
        </div>
        <div>
          <div class="stat-num" style="color:#67c23a">{{ correctCount }}</div>
          <div class="stat-label">答對</div>
        </div>
        <div>
          <div class="stat-num" style="color:#e6a23c">{{ accuracy }}%</div>
          <div class="stat-label">正確率</div>
        </div>
      </div>
      <el-button @click="visible = false">完成</el-button>
      <el-button type="primary" style="margin-left:12px" @click="restart">再練一次</el-button>
    </div>

    <!-- 練習主體 -->
    <div v-else>
      <div class="progress-text">{{ currentIdx + 1 }} / {{ queue.length }}</div>
      <el-progress :percentage="Math.round(currentIdx / queue.length * 100)" :show-text="false" style="margin-bottom:14px" />

      <div v-if="showAnswer" style="text-align:center;margin-bottom:8px">
        <el-tag type="primary" size="small">練習模式</el-tag>
      </div>

      <div class="type-card">
        <!-- 看中文打英文 -->
        <template v-if="dir === 'zh2en'">
          <div class="card-definition">{{ current.definition }}</div>
          <div v-if="current.part_of_speech" class="card-pos">{{ current.part_of_speech }}</div>
          <div v-if="showAnswer" class="answer-hint">
            <span class="hint-label">英文：</span>
            <strong style="letter-spacing:.08em;font-size:18px">{{ current.word }}</strong>
          </div>
        </template>
        <!-- 看英文打中文 -->
        <template v-else>
          <div class="card-word">{{ current.word }}</div>
          <div v-if="current.part_of_speech" class="card-pos">{{ current.part_of_speech }}</div>
          <div v-if="showAnswer" class="answer-hint">
            <span class="hint-label">中文：</span>
            <strong>{{ current.definition }}</strong>
          </div>
        </template>
        <!-- 例句 -->
        <div v-if="showExample && current.example" class="card-example">
          {{ current.example }}
        </div>
      </div>

      <!-- 輸入區 -->
      <div v-if="result === null" style="margin-top:20px">
        <el-input
          ref="inputRef"
          v-model="typed"
          :placeholder="dir === 'zh2en' ? '輸入英文單字...' : '輸入中文釋義...'"
          size="large"
          @keyup.enter="checkAnswer"
        />
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:center">
          <el-button @click="skipWord">跳過</el-button>
          <el-button type="primary" @click="checkAnswer">確認</el-button>
        </div>
      </div>

      <!-- 結果回饋 -->
      <div v-else style="text-align:center;margin-top:20px">
        <div v-if="result === 'correct'" style="color:#67c23a;font-size:20px">✅ 答對了！</div>
        <div v-else>
          <div style="color:#f56c6c;font-size:20px">❌ 答錯了</div>
          <div style="margin-top:8px;color:#606266">
            正確答案：<strong>{{ dir === 'zh2en' ? current.word : current.definition }}</strong>
          </div>
        </div>
        <el-button type="primary" style="margin-top:16px" @click="advance">繼續 →</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useWordsStore } from '../stores/words.js'

const props = defineProps({
  modelValue: Boolean,
  words: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'done'])

const wordsStore = useWordsStore()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

// 設定
const dir = ref('zh2en')
const showAnswer = ref(false)
const showExample = ref(true)

const phase = ref('settings')
const queue = ref([])
const currentIdx = ref(0)
const typed = ref('')
const result = ref(null)
const total = ref(0)
const correctCount = ref(0)
const inputRef = ref(null)
let advanceTimer = null

const current = computed(() => queue.value[currentIdx.value] ?? {})
const accuracy = computed(() =>
  total.value ? Math.round(correctCount.value / total.value * 100) : 0
)
const modeTitle = computed(() => {
  if (dir.value === 'zh2en') return showAnswer.value ? '拼寫練習' : '拼寫測驗'
  return showAnswer.value ? '釋義練習' : '釋義測驗'
})

watch(() => props.modelValue, v => { if (v) phase.value = 'settings' })
onUnmounted(() => clearTimeout(advanceTimer))

function startPractice() {
  queue.value = [...props.words].sort(() => Math.random() - 0.5)
  currentIdx.value = 0
  typed.value = ''
  result.value = null
  total.value = 0
  correctCount.value = 0
  phase.value = 'review'
  nextTick(() => inputRef.value?.focus())
}

function advance() {
  clearTimeout(advanceTimer)
  if (currentIdx.value + 1 >= queue.value.length) {
    phase.value = 'summary'
    emit('done')
  } else {
    currentIdx.value++
    typed.value = ''
    result.value = null
    nextTick(() => inputRef.value?.focus())
  }
}

async function checkAnswer() {
  if (result.value !== null) return
  const answer = typed.value.trim().toLowerCase()
  let ok = false

  if (dir.value === 'zh2en') {
    ok = answer === (current.value.word ?? '').toLowerCase()
  } else {
    const defs = (current.value.definition ?? '').split(/[;；、]/).map(s => s.trim()).filter(Boolean)
    ok = answer.length >= 1 && defs.some(d => d.toLowerCase() === answer)
  }

  total.value++
  if (ok) {
    correctCount.value++
    result.value = 'correct'
    if (!showAnswer.value) await wordsStore.review(current.value.id, 5)
    advanceTimer = setTimeout(() => advance(), 900)
  } else {
    result.value = 'wrong'
    if (!showAnswer.value) await wordsStore.review(current.value.id, 1)
  }
}

async function skipWord() {
  if (result.value !== null) return
  total.value++
  result.value = 'wrong'
  if (!showAnswer.value) await wordsStore.review(current.value.id, 1)
}

function restart() {
  phase.value = 'settings'
}
</script>

<style scoped>
/* 設定頁 */
.settings-panel { padding: 4px 0; }
.settings-group { margin-bottom: 22px; }
.settings-label { font-weight: 600; margin-bottom: 10px; font-size: 15px; color: #303133; }
.dir-opts { display: flex; gap: 10px; }
.dir-opt {
  flex: 1;
  padding: 12px 14px;
  border: 2px solid #dcdfe6;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.dir-opt:hover { border-color: #409eff; }
.dir-opt.active { border-color: #409eff; background: #ecf5ff; color: #1a56db; }
.opt-title { font-weight: 600; font-size: 14px; }
.opt-desc { font-size: 12px; color: #909399; margin-top: 3px; }
.check-row { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }

/* 練習卡片 */
.progress-text { text-align: center; color: #909399; font-size: 13px; margin-bottom: 8px; }
.type-card {
  background: #f5f7fa;
  border-radius: 12px;
  padding: 24px 20px;
  text-align: center;
}
.card-definition { font-size: 20px; font-weight: bold; color: #303133; }
.card-word { font-size: 24px; font-weight: bold; letter-spacing: .06em; color: #303133; }
.card-pos { font-size: 13px; color: #909399; margin-top: 6px; }
.card-example {
  font-size: 13px;
  color: #606266;
  font-style: italic;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
  text-align: left;
}
.answer-hint {
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
  border-radius: 8px;
  padding: 8px 14px;
  margin-top: 14px;
  color: #1a56db;
}
.hint-label { font-size: 13px; color: #409eff; margin-right: 6px; }

/* 結果 */
.stat-num { font-size: 36px; font-weight: bold; }
.stat-label { color: #909399; margin-top: 6px; font-size: 13px; }
</style>