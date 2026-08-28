import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api.js'

export const useWordsStore = defineStore('words', () => {
  const words = ref([])
  const loading = ref(false)

  async function fetchAll(params = {}) {
    loading.value = true
    try {
      const qs = new URLSearchParams(params).toString()
      words.value = await api.get('/api/words' + (qs ? '?' + qs : ''))
    } finally {
      loading.value = false
    }
  }

  async function addWord(data) {
    const w = await api.post('/api/words', data)
    words.value.push(w)
    return w
  }

  async function editWord(id, data) {
    const w = await api.put(`/api/words/${id}`, data)
    const i = words.value.findIndex(x => x.id === id)
    if (i !== -1) words.value[i] = w
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

  async function importWords(wordsArr) {
    return api.post('/api/words/import', { words: wordsArr })
  }

  return { words, loading, fetchAll, addWord, editWord, removeWord, review, importWords }
})
