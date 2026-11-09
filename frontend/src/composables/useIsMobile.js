import { ref } from 'vue'

// 與 style.css 的 @media (max-width: 768px) 斷點一致
export const MOBILE_QUERY = '(max-width: 768px)'

const mql = typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY) : null
const isMobile = ref(mql?.matches ?? false)
mql?.addEventListener('change', e => { isMobile.value = e.matches })

// 全 app 共用同一個 ref，不需各元件自行監聽
export function useIsMobile() {
  return isMobile
}
