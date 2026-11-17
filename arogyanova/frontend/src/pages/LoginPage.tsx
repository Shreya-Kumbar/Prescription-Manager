import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, Eye, EyeOff, Info, ShieldCheck, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

const DEMO_ACCOUNTS = [
  { label: 'Doctor', email: 'dr.sharma@arogyanova.dev', password: 'Demo@Doctor123' },
  { label: 'Patient', email: 'patient.ravi@arogyanova.dev', password: 'Demo@Patient123' },
  { label: 'Pharmacist', email: 'pharma.anil@arogyanova.dev', password: 'Demo@Pharma123' },
  { label: 'Admin', email: 'admin@arogyanova.dev', password: 'Demo@Admin123' },
];

const FEATURES = [
  { icon: Sparkles, label: 'AI interaction check' },
  { icon: ShieldCheck, label: 'RBAC security' },
  { icon: CalendarCheck, label: 'Dose tracking' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const location = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup'>(location.pathname === '/register' ? 'signup' : 'signin');
  const [reg, setReg] = useState({ first_name: '', last_name: '', email: '', password: '', date_of_birth: '', phone: '' });
  const setR = (k: keyof typeof reg) => (e: React.ChangeEvent<HTMLInputElement>) => setReg({ ...reg, [k]: e.target.value });

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m);
    window.history.replaceState(null, '', m === 'signup' ? '/register' : '/login');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await authService.register({
        ...reg,
        role: 'patient', // public sign-up is for patients only
        date_of_birth: reg.date_of_birth || undefined,
      } as any);
      toast.success('Account created. Sign in to continue.');
      setEmail(reg.email);
      setPassword('');
      setReg({ first_name: '', last_name: '', email: '', password: '', date_of_birth: '', phone: '' });
      switchMode('signin');
    } catch (err: any) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : 'Could not create the account. Check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Enter your email and password.');
      return;
    }
    try {
      setIsLoading(true);
      await login(email, password);
      toast.success('Welcome back to ArogyaNova');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (a: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(a.email);
    setPassword(a.password);
    setPicked(a.label);
  };

  return (
    <div className="login-bg relative min-h-screen lg:h-screen overflow-x-hidden lg:overflow-hidden text-white">
      {/* soft glows + faint grid */}
      <div className="login-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
      <div className="login-glow login-glow-1" aria-hidden="true" />
      <div className="login-glow login-glow-2" aria-hidden="true" />

      <div className="relative z-10 min-h-screen lg:h-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 pt-10 lg:pt-12 pb-6 flex flex-col">
        {/* Brand */}
        <div className="flex items-center gap-3 login-rise">
          <img src="/logo.svg" alt="ArogyaNova" className="w-9 h-9 float" />
          <span className="text-2xl font-bold tracking-tight">ArogyaNova</span>
        </div>

        <div className="flex-1 min-h-0 grid lg:grid-cols-2 gap-10 items-center py-6">
          {/* Hero (left) */}
          <div className="hidden lg:block">
            <span className="login-rise inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 border border-white/15" style={{ animationDelay: '0.05s' }}>
              <span className="dot-live w-2 h-2 rounded-full bg-emerald-300" /> AI-powered prescription safety
            </span>
            <h1 className="login-rise mt-5 text-5xl xl:text-6xl font-extrabold leading-[1.05] tracking-tight" style={{ animationDelay: '0.12s' }}>
              Prescribe, track<br />and heal <span className="text-[#A8DCC0]">safely.</span>
            </h1>
            <p className="login-rise mt-5 max-w-md text-base xl:text-lg text-emerald-50/75 leading-relaxed" style={{ animationDelay: '0.2s' }}>
              Digital prescriptions with drug-interaction warnings, automatic dose schedules and adherence
              tracking for doctors, patients and pharmacists.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {FEATURES.map(({ icon: Icon, label }, i) => (
                <div
                  key={label}
                  className="login-rise login-tile w-40 rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur px-4 py-4"
                  style={{ animationDelay: `${0.28 + i * 0.08}s` }}
                >
                  <Icon className="w-6 h-6 text-[#A8DCC0]" />
                  <p className="mt-3 text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sign-in card (right) */}
          <div className="login-rise w-full max-w-md lg:justify-self-end" style={{ animationDelay: '0.15s' }}>
            <div className="login-card rounded-[28px] p-7 sm:p-8 text-[#13261D]">
              <div key={mode} className="card-swap">
                {mode === 'signin' ? (
                  <>
              <h2 className="text-3xl font-extrabold tracking-tight">Welcome back!</h2>
              <p className="mt-1 text-sm text-[#4E6358]">Sign in to your ArogyaNova account</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setPicked(null); }}
                    placeholder="you@hospital.com"
                    className="login-input"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold" htmlFor="password">Password</label>
                    <Link to="/forgot-password" className="text-xs font-semibold text-[#2F7D57] hover:underline">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setPicked(null); }}
                      className="login-input pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7F74] hover:text-[#13261D]"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="login-btn w-full">
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-[#4E6358]">
                No account? <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-[#2F7D57] hover:underline">Create one</button>
              </p>

              <div className="mt-5 rounded-2xl bg-white/60 border border-white/70 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-[#2F7D57]">
                  <Info className="w-4 h-4" /> Demo accounts (click to fill)
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DEMO_ACCOUNTS.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => fillDemo(a)}
                      className={`demo-chip ${picked === a.label ? 'demo-chip-on' : ''}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
                  </>
                ) : (
                  <>
              <h2 className="text-3xl font-extrabold tracking-tight">Create account</h2>
              <p className="mt-1 text-sm text-[#4E6358]">Patient sign-up. Staff accounts are created by your admin.</p>

              <form onSubmit={handleRegister} className="mt-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="first_name">First name</label>
                    <input id="first_name" required value={reg.first_name} onChange={setR('first_name')} className="login-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="last_name">Last name</label>
                    <input id="last_name" required value={reg.last_name} onChange={setR('last_name')} className="login-input" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="reg_email">Email</label>
                  <input id="reg_email" type="email" required value={reg.email} onChange={setR('email')} placeholder="you@example.com" className="login-input" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="reg_password">Password</label>
                  <div className="relative">
                    <input id="reg_password" type={showPassword ? 'text' : 'password'} required minLength={8} value={reg.password} onChange={setR('password')} placeholder="8+ chars, upper, lower, number" className="login-input pr-11" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7F74] hover:text-[#13261D]">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="dob">Date of birth</label>
                    <input id="dob" type="date" value={reg.date_of_birth} onChange={setR('date_of_birth')} className="login-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="phone">Phone</label>
                    <input id="phone" type="tel" value={reg.phone} onChange={setR('phone')} placeholder="+91 98765 43210" className="login-input" />
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="login-btn w-full">
                  {isLoading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-[#4E6358]">
                Already have an account? <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-[#2F7D57] hover:underline">Sign in</button>
              </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-emerald-50/60 login-rise" style={{ animationDelay: '0.5s' }}>
          Object-Oriented Methodologies Project · 2026
        </p>
      </div>
    </div>
  );
}
