import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const LS_KEY = 'vocabmaster_ai'

export const GEMINI_MODELS = [
  { id: 'gemini-3.7-flash',      label: 'gemini-3.7-flash（最新、強大）' },
  { id: 'gemini-3.5-flash',      label: 'gemini-3.5-flash（穩定、均衡）' },
  { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite（快速、省成本）' },
  { id: 'gemini-2.5-pro',        label: 'gemini-2.5-pro（強推理）' },
  { id: 'gemini-2.5-flash',      label: 'gemini-2.5-flash（舊版穩定）' },
]

function load() {
  try {
    const s = localStorage.getItem(LS_KEY)
    return s ? JSON.parse(s) : { apiKey: '', model: 'gemini-3.7-flash' }
  } catch {
    return { apiKey: '', model: 'gemini-3.7-flash' }
  }
}

export const useAISettingsStore = defineStore('aiSettings', () => {
  const saved = load()
  const apiKey = ref(saved.apiKey)
  const model  = ref(saved.model || 'gemini-3.7-flash')

  const hasKey = computed(() => !!apiKey.value)

  function save(key, mdl) {
    apiKey.value = key
    model.value  = mdl
    localStorage.setItem(LS_KEY, JSON.stringify({ apiKey: key, model: mdl }))
  }

  function getSettings() {
    return { apiKey: apiKey.value, model: model.value }
  }

  return { apiKey, model, hasKey, save, getSettings }
})
