import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api.js'

export const useQuizzesStore = defineStore('quizzes', () => {
  const quizzes = ref([])
  const loading = ref(false)

  async function fetchAll(params = {}) {
    loading.value = true
    try {
      const qs = new URLSearchParams(params).toString()
      quizzes.value = await api.get('/api/quizzes' + (qs ? '?' + qs : ''))
    } finally {
      loading.value = false
    }
  }

  async function addQuiz(data) {
    const q = await api.post('/api/quizzes', data)
    quizzes.value.unshift(q)
    return q
  }

  async function editQuiz(id, data) {
    const q = await api.put(`/api/quizzes/${id}`, data)
    const i = quizzes.value.findIndex(x => x.id === id)
    if (i !== -1) quizzes.value[i] = q
    return q
  }

  async function removeQuiz(id) {
    await api.delete(`/api/quizzes/${id}`)
    quizzes.value = quizzes.value.filter(x => x.id !== id)
  }

  return { quizzes, loading, fetchAll, addQuiz, editQuiz, removeQuiz }
})
