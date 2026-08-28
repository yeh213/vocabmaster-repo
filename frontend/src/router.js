import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth.js'

const routes = [
  { path: '/login', component: () => import('./views/LoginView.vue') },
  { path: '/', redirect: '/vocab' },
  { path: '/vocab', component: () => import('./views/VocabView.vue'), meta: { requiresAuth: true } },
  { path: '/quiz', component: () => import('./views/QuizView.vue'), meta: { requiresAuth: true } },
  { path: '/notes', component: () => import('./views/NotesView.vue'), meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.token) return '/login'
})

export default router
