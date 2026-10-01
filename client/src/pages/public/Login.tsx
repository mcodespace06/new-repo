import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LoginProps {
  onSuccess?: () => void;
  onNavigateToRegister: () => void;
}

export default function Login({ onSuccess, onNavigateToRegister }: LoginProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed.');
      }

      login(data.token, data.user);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-sky-700 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
        <p className="text-xs text-slate-500 mt-1">Sign in with your verified campus credentials</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLoginSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Username or College Email</label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or enrollment email"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 mt-2 flex items-center justify-center gap-1.5"
        >
          {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
        </button>

        <div className="text-center pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Don't have a verified account?{' '}
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-sky-700 hover:underline font-semibold"
            >
              Verify & Register here
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}
