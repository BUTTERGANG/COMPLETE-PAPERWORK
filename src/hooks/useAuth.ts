import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const userId = useAuthStore((s) => s.userId);
  const userName = useAuthStore((s) => s.userName);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);
  const init = useAuthStore((s) => s.init);
  return { userId, userName, loading, signOut, init };
}
