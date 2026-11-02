import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, Stethoscope, Pill } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<'patient' | 'doctor' | 'pharmacist'>('patient');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      await authService.register({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role,
        license_number: role !== 'patient' ? licenseNumber : undefined,
        specialization: role === 'doctor' ? specialization : undefined,
        date_of_birth: role === 'patient' && dateOfBirth ? dateOfBirth : undefined,
        phone,
      });

      toast.success('Registration successful! Please sign in with your credentials.');
      navigate('/login');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Registration failed. Please check your details.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
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
          Join the intelligent prescription platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <div className="card p-8 shadow-card-lg">
          <h2 className="text-xl font-bold text-text dark:text-white mb-4">Create your account</h2>

          {/* Role Selection Tabs */}
          <div className="mb-6">
            <label className="label">I am joining as a:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole('patient')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-colors ${
                  role === 'patient'
                    ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20 dark:text-teal-400 font-semibold'
                    : 'border-border dark:border-[#233044] text-text-secondary dark:text-slate-300 hover:bg-background dark:hover:bg-slate-800'
                }`}
              >
                <User className="w-5 h-5 mb-1" />
                Patient
              </button>
              <button
                type="button"
                onClick={() => setRole('doctor')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-colors ${
                  role === 'doctor'
                    ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20 dark:text-teal-400 font-semibold'
                    : 'border-border dark:border-[#233044] text-text-secondary dark:text-slate-300 hover:bg-background dark:hover:bg-slate-800'
                }`}
              >
                <Stethoscope className="w-5 h-5 mb-1" />
                Doctor
              </button>
              <button
                type="button"
                onClick={() => setRole('pharmacist')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-colors ${
                  role === 'pharmacist'
                    ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20 dark:text-teal-400 font-semibold'
                    : 'border-border dark:border-[#233044] text-text-secondary dark:text-slate-300 hover:bg-background dark:hover:bg-slate-800'
                }`}
              >
                <Pill className="w-5 h-5 mb-1" />
                Pharmacist
              </button>
            </div>
            <p className="text-[11px] text-text-light dark:text-slate-400 mt-1.5">
              * Note: Administrator accounts require internal provisioning.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input"
                  placeholder="e.g. Rahul"
                />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input"
                  placeholder="e.g. Verma"
                />
              </div>
            </div>

            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@domain.com"
              />
            </div>

            <div>
              <label className="label">Password (Min. 8 characters)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••••••"
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

            {/* Role-Specific Fields */}
            {role !== 'patient' && (
              <div>
                <label className="label">Professional License Number</label>
                <input
                  type="text"
                  required
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="input"
                  placeholder={role === 'doctor' ? 'e.g. MCI-2024-9988' : 'e.g. PH-2024-7766'}
                />
              </div>
            )}

            {role === 'doctor' && (
              <div>
                <label className="label">Specialization</label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="input"
                  placeholder="e.g. Cardiology, General Medicine"
                />
              </div>
            )}

            {role === 'patient' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                    placeholder="+91-9876543210"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {isLoading ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-text-secondary dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary dark:text-teal-400 hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
