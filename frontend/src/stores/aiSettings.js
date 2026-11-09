import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const LS_KEY = 'vocabmaster_ai'

// 模型清單（2026-11-10 依 Google AI Studio 官方 models / deprecations / pricing 頁更新）
// paid: true 表示免費方案不能用
export const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash',      label: 'gemini-3.8-flash（最新、推薦）' },
  { id: 'gemini-3.6-flash',      label: 'gemini-3.6-flash（穩定、均衡）' },
  { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite（快速、省成本）' },
  { id: 'gemini-4-argon',        label: 'gemini-4-argon（最強推理，需付費）', paid: true },
]

export const DEFAULT_MODEL = 'gemini-3.8-flash'

// 已淘汰的模型 → Google 官方指定的替代模型
const RETIRED_MODELS = {
  'gemini-3.7-flash': 'gemini-3.8-flash',
  'gemini-3.5-flash': 'gemini-3.6-flash',
  'gemini-2.5-pro':   'gemini-3.8-flash',
  'gemini-2.5-flash': 'gemini-3.5-flash-lite',
}

function normalizeModel(model) {
  if (GEMINI_MODELS.some(m => m.id === model)) return model
  return RETIRED_MODELS[model] ?? DEFAULT_MODEL
}

function load() {
  try {
    const s = localStorage.getItem(LS_KEY)
    const saved = s ? JSON.parse(s) : {}
    return { apiKey: saved.apiKey ?? '', model: normalizeModel(saved.model) }
  } catch {
    return { apiKey: '', model: DEFAULT_MODEL }
  }
}

export const useAISettingsStore = defineStore('aiSettings', () => {
  const saved = load()
  const apiKey = ref(saved.apiKey)
  const model  = ref(saved.model)

  const hasKey = computed(() => !!apiKey.value)

  function save(key, mdl) {
    apiKey.value = key
    model.value  = normalizeModel(mdl)
    localStorage.setItem(LS_KEY, JSON.stringify({ apiKey: key, model: model.value }))
  }

  function getSettings() {
    return { apiKey: apiKey.value, model: model.value }
  }

  return { apiKey, model, hasKey, save, getSettings }
})
