import React, { useState } from 'react';
import { Settings, Lock, User, Shield, Bell, Key, Check } from 'lucide-react';
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
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [adherenceReminders, setAdherenceReminders] = useState(true);

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

        <div className="flex items-center gap-4 border-b border-border dark:border-[#233044] pb-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary dark:bg-teal-900/30 dark:text-teal-400 flex items-center justify-center font-bold text-xl">
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

      {/* Notification Preferences */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text dark:text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Notification Preferences
        </h3>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-lg border border-border dark:border-[#233044] bg-slate-50/50 dark:bg-[#0F172A] cursor-pointer">
            <div>
              <span className="font-semibold text-text dark:text-white block">Clinical Status Updates</span>
              <span className="text-text-secondary dark:text-slate-400 text-[11px]">
                Notify when a prescription is finalized, cancelled, or renewed.
              </span>
            </div>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="w-4 h-4 text-primary rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-border dark:border-[#233044] bg-slate-50/50 dark:bg-[#0F172A] cursor-pointer">
            <div>
              <span className="font-semibold text-text dark:text-white block">Medication Dosing Reminders</span>
              <span className="text-text-secondary dark:text-slate-400 text-[11px]">
                Daily prompt for scheduled doses to encourage compliance.
              </span>
            </div>
            <input
              type="checkbox"
              checked={adherenceReminders}
              onChange={(e) => setAdherenceReminders(e.target.checked)}
              className="w-4 h-4 text-primary rounded"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
