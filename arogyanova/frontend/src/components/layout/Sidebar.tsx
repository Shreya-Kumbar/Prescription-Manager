import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Pill,
  CalendarCheck,
  Sparkles,
  BarChart3,
  Bell,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export default function Sidebar({ isCollapsed, toggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const role = user?.role;

  // Filter navigation items by role
  const navItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['doctor', 'patient', 'pharmacist', 'administrator'],
    },
    {
      label: 'Prescriptions',
      path: '/prescriptions',
      icon: FileText,
      roles: ['doctor', 'patient', 'pharmacist', 'administrator'],
    },
    {
      label: 'Patients',
      path: '/patients',
      icon: Users,
      roles: ['doctor', 'administrator'],
    },
    {
      label: 'Medication Catalogue',
      path: '/medications',
      icon: Pill,
      roles: ['doctor', 'pharmacist', 'administrator'],
    },
    {
      label: 'Medication Schedule',
      path: '/schedule',
      icon: CalendarCheck,
      roles: ['patient', 'doctor'],
    },
    {
      label: 'AI Clinical Review',
      path: '/ai-review',
      icon: Sparkles,
      roles: ['doctor', 'pharmacist', 'administrator'],
    },
    {
      label: 'Analytics & Reports',
      path: '/analytics',
      icon: BarChart3,
      roles: ['doctor', 'administrator'],
    },
    {
      label: 'Notifications',
      path: '/notifications',
      icon: Bell,
      roles: ['doctor', 'patient', 'pharmacist', 'administrator'],
    },
    {
      label: 'User Management',
      path: '/users',
      icon: UserCog,
      roles: ['administrator'],
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      roles: ['doctor', 'patient', 'pharmacist', 'administrator'],
    },
  ];

  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-border transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <img src="/logo.svg" alt="ArogyaNova" className="w-8 h-8 shrink-0" />
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base text-text tracking-tight">ArogyaNova</span>
              <span className="text-[10px] text-primary font-medium tracking-wide">
                PRESCRIPTION SYSTEM
              </span>
            </div>
          )}
        </div>
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-lg text-text-secondary hover:bg-background hover:text-text transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-background hover:text-text'
                } ${isCollapsed ? 'justify-center' : ''}`
              }
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {/* User Info Bottom */}
      <div className="p-3 border-t border-border bg-slate-50/50">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-xs shrink-0">
            {user?.first_name?.[0]}
            {user?.last_name?.[0]}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-semibold text-text truncate">
                {user?.role === 'doctor' ? `Dr. ${user?.first_name} ${user?.last_name}` : `${user?.first_name} ${user?.last_name}`}
              </span>
              <span className="text-[11px] text-text-secondary capitalize truncate">
                {user?.role}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
