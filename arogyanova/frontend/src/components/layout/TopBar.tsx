import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Plus, Search, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Badge from '../ui/Badge';
import ThemeToggle from '../ui/ThemeToggle';

export default function TopBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [query, setQuery] = useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/prescriptions?search=${encodeURIComponent(q)}` : '/prescriptions');
  };

  // Derive page title from path
  const getPageTitle = (path: string) => {
    if (path.startsWith('/prescriptions/new')) return 'Create Prescription';
    if (path.startsWith('/prescriptions/')) return 'Prescription Details';
    if (path.startsWith('/patients/')) return 'Patient Details';
    const segment = path.replace('/', '').split('/')[0];
    switch (segment) {
      case 'dashboard':
        return 'Overview Dashboard';
      case 'prescriptions':
        return 'Prescription Records';
      case 'patients':
        return 'Patient Directory';
      case 'medications':
        return 'Medication Catalogue';
      case 'schedule':
        return 'Medication Schedule & Adherence';
      case 'ai-review':
        return 'AI Clinical Review & OCR';
      case 'analytics':
        return 'Analytics & Clinical Reports';
      case 'notifications':
        return 'System Notifications';
      case 'users':
        return 'User Account Administration';
      case 'settings':
        return 'Account Settings';
      default:
        return 'ArogyaNova';
    }
  };

  return (
    <header className="no-print h-16 bg-white/90 dark:bg-[#121B17]/95 backdrop-blur border-b border-border dark:border-[#24352C] flex items-center justify-between px-6 sticky top-0 z-30 transition-colors duration-200">
      <div className="min-w-0 mr-4">
        <h1 className="text-lg font-bold text-text dark:text-[#F1F5F9] truncate">{getPageTitle(location.pathname)}</h1>
      </div>

      <div className="topbar-actions flex items-center gap-3 shrink-0">
        {/* Global search */}
        <form onSubmit={submitSearch} className="topbar-search hidden md:flex items-center gap-2 h-9 w-64 px-3 rounded-lg border border-border dark:border-[#24352C] bg-slate-50/80 dark:bg-white/[0.03] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
          <Search className="w-4 h-4 text-text-light dark:text-slate-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prescriptions..."
            className="flex-1 bg-transparent text-sm text-text dark:text-slate-100 placeholder:text-text-light dark:placeholder:text-slate-500 outline-none"
          />
        </form>

        {user?.role === 'doctor' && (
          <button onClick={() => navigate('/prescriptions/new')} className="btn-primary text-sm !py-1.5 whitespace-nowrap shrink-0">
            <Plus className="w-4 h-4" /> New Prescription
          </button>
        )}

        {/* Role Badge */}
        {user?.role && <Badge status={user.role} size="sm" />}

        {/* Theme Toggle (Light / Dark) */}
        <ThemeToggle />

        {/* Notifications Icon Button */}
        <button
          onClick={() => navigate('/notifications')}
          className="bell-btn relative p-2 rounded-lg text-text-secondary dark:text-slate-300 hover:bg-background dark:hover:bg-slate-800 hover:text-text dark:hover:text-white transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="dot-live absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
        </button>

        {/* User Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="user-btn flex items-center gap-2 p-1.5 rounded-lg hover:bg-background dark:hover:bg-slate-800 transition-colors text-left"
          >
            <div className="user-avatar w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
              {user?.first_name?.[0]}
              {user?.last_name?.[0]}
            </div>
            <div className="hidden sm:block text-xs">
              <p className="font-semibold text-text dark:text-slate-100 leading-tight">{user?.first_name}</p>
              <p className="text-text-secondary dark:text-slate-400 capitalize">{user?.role}</p>
            </div>
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#16201B] rounded-card shadow-card-lg border border-border dark:border-[#24352C] py-1.5 z-50 animate-slide-in"
              onMouseLeave={() => setShowUserMenu(false)}
            >
              <div className="px-4 py-2 border-b border-border dark:border-[#24352C]">
                <p className="text-xs font-semibold text-text dark:text-slate-100 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[11px] text-text-secondary dark:text-slate-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-text-secondary dark:text-slate-300 hover:bg-background dark:hover:bg-slate-800 hover:text-text dark:hover:text-white text-left transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                Profile Settings
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-error hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
