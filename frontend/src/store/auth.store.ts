import { create } from 'zustand';
import { CurrentUser } from '../types/user';

type SessionStatus = 'restoring' | 'signed-in' | 'signed-out';

interface AuthState {
  status: SessionStatus;
  user: CurrentUser | null;
  /** Kept in memory only; the long-lived refresh token lives in an httpOnly cookie. */
  accessToken: string | null;
  setSession: (accessToken: string, user: CurrentUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'restoring',
  user: null,
  accessToken: null,
  setSession: (accessToken, user) => set({ status: 'signed-in', accessToken, user }),
  clearSession: () => set({ status: 'signed-out', accessToken: null, user: null }),
}));
