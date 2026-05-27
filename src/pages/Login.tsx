import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { HeadphonesIcon, AlertCircleIcon } from '../components/icons/Icons';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Replit Auth handles authentication externally.
      // Simply re-initializing the auth store will detect the Replit session.
      const { init } = useAuthStore.getState();
      await init();
      const { userId } = useAuthStore.getState();
      if (!userId) {
        throw new Error('Authentication failed. Please ensure you are signed in to Replit.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 bg-base">
      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-5">
            <HeadphonesIcon size={30} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">DJ Ops</h1>
          <p className="text-sm text-text-tertiary mt-1.5">Event management made simple</p>
        </div>

        {/* Replit Auth — user signs in via Replit's identity provider */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-center text-sm text-text-tertiary">
            Sign in with your Replit account to manage your DJ events.
          </p>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-danger/10 border border-danger/20">
              <AlertCircleIcon size={16} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Sign in with Replit'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
