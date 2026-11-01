import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Search, User as UserIcon, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Badge from '../ui/Badge';

export default function TopBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

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
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-bold text-text">{getPageTitle(location.pathname)}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Badge */}
        {user?.role && <Badge status={user.role} size="sm" />}

        {/* Notifications Icon Button */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg text-text-secondary hover:bg-background hover:text-text transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
        </button>

        {/* User Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-background transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
              {user?.first_name?.[0]}
              {user?.last_name?.[0]}
            </div>
            <div className="hidden sm:block text-xs">
              <p className="font-semibold text-text leading-tight">{user?.first_name}</p>
              <p className="text-text-secondary capitalize">{user?.role}</p>
            </div>
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-52 bg-white rounded-card shadow-card-lg border border-border py-1.5 z-50 animate-slide-in"
              onMouseLeave={() => setShowUserMenu(false)}
            >
              <div className="px-4 py-2 border-b border-border">
                <p className="text-xs font-semibold text-text truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[11px] text-text-secondary truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-text-secondary hover:bg-background hover:text-text text-left"
              >
                <UserIcon className="w-4 h-4" />
                Profile Settings
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-error hover:bg-rose-50 text-left"
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
