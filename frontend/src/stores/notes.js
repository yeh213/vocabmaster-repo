import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api.js'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      notes.value = await api.get('/api/notes')
    } finally {
      loading.value = false
    }
  }

  async function addNote(data) {
    const n = await api.post('/api/notes', data)
    notes.value.unshift(n)
    return n
  }

  async function editNote(id, data) {
    const n = await api.put(`/api/notes/${id}`, data)
    const i = notes.value.findIndex(x => x.id === id)
    if (i !== -1) notes.value[i] = n
    return n
  }

  async function removeNote(id) {
    await api.delete(`/api/notes/${id}`)
    notes.value = notes.value.filter(x => x.id !== id)
  }

  async function importMd(title, content) {
    const n = await api.post('/api/notes/import', { title, content })
    notes.value.unshift(n)
    return n
  }

  return { notes, loading, fetchAll, addNote, editNote, removeNote, importMd }
})
