import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
      setDevToken(res.data.dev_reset_token ?? null);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Please enter a valid email address.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-enter min-h-screen bg-transparent flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative transition-colors duration-200">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center items-center gap-3">
          <img src="/logo.svg" alt="ArogyaNova Logo" className="w-10 h-10 float" />
          <span className="text-2xl font-bold tracking-tight text-gradient">ArogyaNova</span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="card p-8 shadow-card-lg">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-text dark:text-white">Forgot your password?</h2>
          </div>
          <p className="text-sm text-text-secondary dark:text-slate-400 mb-6">
            Enter the email you registered with and we'll send you a link to set a new password.
          </p>

          {message ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm text-text dark:text-slate-100">
                {message}
              </div>
              {devToken && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Development mode</p>
                  <p className="text-amber-800/90 dark:text-amber-200/80 mb-3">
                    No email server is configured, so here is the link that would have been emailed:
                  </p>
                  <Link
                    to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                    className="btn-primary w-full justify-center py-2"
                  >
                    Open reset link
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-2.5 text-text-light dark:text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input pl-10"
                  />
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-2.5">
                {isLoading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-xs">
            <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
