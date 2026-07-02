import { create } from 'zustand'

export interface AuthUser {
  id: string
  email: string | null
  role: string
  organizationId: string | null
  organizationName: string | null
}

interface AuthState {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}))
