import MyHealthProfile from '../components/settings/MyHealthProfile';
import React, { useState } from 'react';
import { Settings, Lock, User, Shield, Key, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import Badge from '../components/ui/Badge';

export default function SettingsPage() {
  const { user } = useAuth();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Preference state

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error('Please enter all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }

    try {
      setIsChangingPass(true);
      await authService.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text dark:text-white">Account Settings</h2>
        <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
          Manage your personal profile, credentials, and notification preferences
        </p>
      </div>

      {/* Profile Overview */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text dark:text-white flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Profile Information
        </h3>

        <div className="flex items-center gap-4 border-b border-border dark:border-[#24352C] pb-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center font-bold text-xl">
            {user?.first_name?.[0]}
            {user?.last_name?.[0]}
          </div>
          <div>
            <h4 className="font-bold text-base text-text dark:text-white">
              {user?.first_name} {user?.last_name}
            </h4>
            <p className="text-xs text-text-secondary dark:text-slate-400">{user?.email}</p>
            <div className="mt-1.5">
              {user?.role && <Badge status={user.role} size="sm" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-text-secondary dark:text-slate-400">
          <div>
            <span className="text-text-light dark:text-slate-500 block">Account Role</span>
            <span className="font-semibold text-text dark:text-white capitalize">{user?.role}</span>
          </div>
          <div>
            <span className="text-text-light dark:text-slate-500 block">Member Since</span>
            <span className="font-semibold text-text dark:text-white">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
            </span>
          </div>
        </div>
      </div>

      {user?.role === 'patient' && user?.id && <MyHealthProfile userId={user.id} />}

      {/* Change Password Form */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text dark:text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" /> Security &amp; Password
        </h3>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md text-xs">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input text-xs"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="label">New Password (Min. 8 characters)</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input text-xs"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input text-xs"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isChangingPass}
            className="btn-primary text-xs"
          >
            {isChangingPass ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
