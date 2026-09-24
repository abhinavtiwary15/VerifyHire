// apps/web/lib/auth-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: { id: string; email: string; role: string } | null
  organization: { id: string; name: string; plan: string; screeningsUsed: number; screeningLimit: number } | null
  setAuth: (data: { accessToken: string; refreshToken: string; user: any; organization: any }) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      organization: null,
      setAuth: (data) => set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
        organization: data.organization,
      }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null, organization: null }),
      isAuthenticated: () => !!get().accessToken,
    }),
    { name: 'verifyhire-auth' }
  )
)
