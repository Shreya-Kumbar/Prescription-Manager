import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import ThemeToggle from '../components/ui/ThemeToggle';

const rules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'A number', test: (p: string) => /\d/.test(p) },
];

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const allRulesPass = rules.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesPass) {
      toast.error('Password does not meet the requirements.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.post('/auth/reset-password', { token, new_password: password });
      toast.success(res.data.message);
      navigate('/login');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not reset password. Please request a new link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-[#0B132B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative transition-colors duration-200">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center items-center gap-3">
          <img src="/logo.svg" alt="ArogyaNova Logo" className="w-10 h-10" />
          <span className="text-2xl font-bold text-text dark:text-white tracking-tight">ArogyaNova</span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="card p-8 shadow-card-lg">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-text dark:text-white">Set a new password</h2>
          </div>

          {!token ? (
            <p className="text-sm text-text-secondary dark:text-slate-400">
              This reset link is missing its token.{' '}
              <Link to="/forgot-password" className="font-semibold text-primary hover:underline">Request a new link</Link>.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-2.5 text-text-light dark:text-slate-500" />
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-2.5 text-text-light dark:text-slate-400 hover:text-text dark:hover:text-white"
                  >
                    {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
                  {rules.map((r) => (
                    <li key={r.label} className={r.test(password) ? 'text-teal-600 dark:text-teal-400' : 'text-text-light dark:text-slate-500'}>
                      {r.test(password) ? '✓' : '•'} {r.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-2.5 text-text-light dark:text-slate-500" />
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-2.5">
                {isLoading ? 'Saving...' : 'Reset password'}
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
