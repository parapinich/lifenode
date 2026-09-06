import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create<{ theme: 'light' | 'dark'; toggle: () => void }>()(
  persist((set) => ({ theme: 'light', toggle: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })) }), { name: 'lifenode-theme' })
)
