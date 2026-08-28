import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api.js'

export const useDecksStore = defineStore('decks', () => {
  const decks = ref([])

  async function fetchAll() {
    decks.value = await api.get('/api/decks')
  }

  async function addDeck(name) {
    const d = await api.post('/api/decks', { name })
    decks.value.push(d)
    return d
  }

  async function renameDeck(id, name) {
    const d = await api.put(`/api/decks/${id}`, { name })
    const i = decks.value.findIndex(x => x.id === id)
    if (i !== -1) decks.value[i] = d
    return d
  }

  async function removeDeck(id) {
    await api.delete(`/api/decks/${id}`)
    decks.value = decks.value.filter(x => x.id !== id)
  }

  async function assignDeck(deck_id, word_ids) {
    return api.post('/api/decks/assign', { deck_id, word_ids })
  }

  return { decks, fetchAll, addDeck, renameDeck, removeDeck, assignDeck }
})
