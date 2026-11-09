import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api.js'

// 依英文字母排序，不分大小寫（與後端 ORDER BY word COLLATE NOCASE 一致）
function byWord(a, b) {
  const x = (a.word ?? '').toLowerCase()
  const y = (b.word ?? '').toLowerCase()
  return x < y ? -1 : x > y ? 1 : 0
}

export const useWordsStore = defineStore('words', () => {
  const words = ref([])
  const loading = ref(false)

  async function fetchAll(params = {}) {
    loading.value = true
    try {
      const qs = new URLSearchParams(params).toString()
      const list = await api.get('/api/words' + (qs ? '?' + qs : ''))
      words.value = list.sort(byWord)
    } finally {
      loading.value = false
    }
  }

  async function addWord(data) {
    const w = await api.post('/api/words', data)
    words.value.push(w)
    words.value.sort(byWord)
    return w
  }

  async function editWord(id, data) {
    const w = await api.put(`/api/words/${id}`, data)
    const i = words.value.findIndex(x => x.id === id)
    if (i !== -1) words.value[i] = w
    words.value.sort(byWord)
    return w
  }

  async function removeWord(id) {
    await api.delete(`/api/words/${id}`)
    words.value = words.value.filter(x => x.id !== id)
  }

  async function review(id, quality) {
    const w = await api.post(`/api/words/${id}/review`, { quality })
    const i = words.value.findIndex(x => x.id === id)
    if (i !== -1) words.value[i] = w
    return w
  }

  // 回傳 { inserted, skipped }；deckId 為 null 代表未分類
  async function importWords(wordsArr, deckId = null) {
    return api.post('/api/words/import', { words: wordsArr, deck_id: deckId })
  }

  return { words, loading, fetchAll, addWord, editWord, removeWord, review, importWords }
})
