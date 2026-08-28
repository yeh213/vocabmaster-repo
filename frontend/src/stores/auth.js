import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('api_token') ?? '')
  const isLoggedIn = computed(() => token.value.length > 0)

  function login(t) {
    token.value = t
    localStorage.setItem('api_token', t)
  }

  function logout() {
    token.value = ''
    localStorage.removeItem('api_token')
  }

  return { token, isLoggedIn, login, logout }
})
