import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Stethoscope, User, Pill } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

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
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center items-center gap-3">
          <img src="/logo.svg" alt="ArogyaNova Logo" className="w-10 h-10" />
          <span className="text-2xl font-bold text-text tracking-tight">ArogyaNova</span>
        </div>
        <p className="mt-2 text-xs font-medium text-text-secondary">
          Healthcare, reimagined through innovation
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="card p-8 shadow-card-lg">
          <h2 className="text-xl font-bold text-text mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-2.5 text-text-light" />
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
                <Lock className="w-5 h-5 absolute left-3 top-2.5 text-text-light" />
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
                  className="absolute right-3 top-2.5 text-text-light hover:text-text"
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
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              One-Click Demo Roles (For Evaluation)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('dr.sharma@arogyanova.dev', 'Demo@Doctor123')}
                className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-teal-50 hover:border-teal-200 text-left transition-colors"
              >
                <Stethoscope className="w-4 h-4 text-primary shrink-0" />
                <div className="text-[11px] overflow-hidden">
                  <p className="font-semibold text-text truncate">Doctor</p>
                  <p className="text-text-secondary truncate">Dr. Priya Sharma</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('patient.ravi@arogyanova.dev', 'Demo@Patient123')}
                className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-blue-50 hover:border-blue-200 text-left transition-colors"
              >
                <User className="w-4 h-4 text-secondary shrink-0" />
                <div className="text-[11px] overflow-hidden">
                  <p className="font-semibold text-text truncate">Patient</p>
                  <p className="text-text-secondary truncate">Ravi Verma</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('pharma.anil@arogyanova.dev', 'Demo@Pharma123')}
                className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-purple-50 hover:border-purple-200 text-left transition-colors"
              >
                <Pill className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="text-[11px] overflow-hidden">
                  <p className="font-semibold text-text truncate">Pharmacist</p>
                  <p className="text-text-secondary truncate">Anil Menon</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('admin@arogyanova.dev', 'Demo@Admin123')}
                className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-indigo-50 hover:border-indigo-200 text-left transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="text-[11px] overflow-hidden">
                  <p className="font-semibold text-text truncate">Admin</p>
                  <p className="text-text-secondary truncate">Arjun Kumar</p>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-text-secondary">
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
