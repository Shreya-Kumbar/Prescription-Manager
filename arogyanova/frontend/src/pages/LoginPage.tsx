import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Stethoscope, User, Pill } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      await login(email, password);
      toast.success('Welcome back to ArogyaNova!');
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Invalid email or password.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-background dark:bg-[#0B132B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative transition-colors duration-200">
      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center items-center gap-3">
          <img src="/logo.svg" alt="ArogyaNova Logo" className="w-10 h-10" />
          <span className="text-2xl font-bold text-text dark:text-white tracking-tight">ArogyaNova</span>
        </div>
        <p className="mt-2 text-xs font-medium text-text-secondary dark:text-slate-400">
          Healthcare, reimagined through innovation
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="card p-8 shadow-card-lg">
          <h2 className="text-xl font-bold text-text dark:text-white mb-6">Sign in to your account</h2>

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
                  placeholder="doctor@arogyanova.dev"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-2.5 text-text-light dark:text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="input pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-text-light dark:text-slate-400 hover:text-text dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Credentials Panel */}
          <div className="mt-6 pt-6 border-t border-border dark:border-[#233044]">
            <p className="text-xs font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wider mb-3">
              One-Click Demo Roles (For Evaluation)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('dr.sharma@arogyanova.dev', 'Demo@Doctor123')}
                className="flex items-center gap-2 p-2 rounded-lg border border-border dark:border-[#233044] hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-200 dark:hover:border-teal-800/60 text-left transition-colors"
              >
                <Stethoscope className="w-4 h-4 text-primary shrink-0" />
                <div className="text-[11px] overflow-hidden">
                  <p className="font-semibold text-text dark:text-slate-100 truncate">Doctor</p>
                  <p className="text-text-secondary dark:text-slate-400 truncate">Dr. Priya Sharma</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('patient.ravi@arogyanova.dev', 'Demo@Patient123')}
                className="flex items-center gap-2 p-2 rounded-lg border border-border dark:border-[#233044] hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-200 dark:hover:border-blue-800/60 text-left transition-colors"
              >
                <User className="w-4 h-4 text-secondary shrink-0" />
                <div className="text-[11px] overflow-hidden">
                  <p className="font-semibold text-text dark:text-slate-100 truncate">Patient</p>
                  <p className="text-text-secondary dark:text-slate-400 truncate">Ravi Verma</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('pharma.anil@arogyanova.dev', 'Demo@Pharma123')}
                className="flex items-center gap-2 p-2 rounded-lg border border-border dark:border-[#233044] hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-200 dark:hover:border-purple-800/60 text-left transition-colors"
              >
                <Pill className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <div className="text-[11px] overflow-hidden">
                  <p className="font-semibold text-text dark:text-slate-100 truncate">Pharmacist</p>
                  <p className="text-text-secondary dark:text-slate-400 truncate">Anil Menon</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('admin@arogyanova.dev', 'Demo@Admin123')}
                className="flex items-center gap-2 p-2 rounded-lg border border-border dark:border-[#233044] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-200 dark:hover:border-indigo-800/60 text-left transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="text-[11px] overflow-hidden">
                  <p className="font-semibold text-text dark:text-slate-100 truncate">Admin</p>
                  <p className="text-text-secondary dark:text-slate-400 truncate">Arjun Kumar</p>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-text-secondary dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
