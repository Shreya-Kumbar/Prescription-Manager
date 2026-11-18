import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Pill,
  CalendarCheck,
  CalendarClock,
  Sparkles,
  UserCog,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export default function Sidebar({ isCollapsed, toggleCollapse }: SidebarProps) {
  const { user, logout } = useAuth();
  const role = user?.role;

  // Filter navigation items by role
  const navItems = [
    {
      label: 'Dashboard',
      color: '#4FA67A',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['doctor', 'patient', 'pharmacist', 'administrator', 'receptionist'],
    },
    {
      label: 'Prescriptions',
      color: '#E6B566',
      path: '/prescriptions',
      icon: FileText,
      roles: ['doctor', 'patient', 'pharmacist', 'administrator'],
    },
    {
      label: 'Patients',
      color: '#7DB9DE',
      path: '/patients',
      icon: Users,
      roles: ['doctor', 'administrator', 'receptionist'],
    },
    {
      label: 'Appointments',
      color: '#7DB9DE',
      path: '/appointments',
      icon: CalendarClock,
      roles: ['receptionist', 'doctor', 'patient', 'administrator'],
    },
    {
      label: 'Medication Catalogue',
      color: '#B7A6E0',
      path: '/medications',
      icon: Pill,
      roles: ['pharmacist', 'administrator'],
    },
    {
      label: 'Medication Schedule',
      color: '#F2A98C',
      path: '/schedule',
      icon: CalendarCheck,
      roles: ['patient'],
    },
    {
      label: 'AI Interaction Check',
      color: '#7CC4A0',
      path: '/ai-review',
      icon: Sparkles,
      roles: ['doctor', 'pharmacist'],
    },
    {
      label: 'User Management',
      color: '#B7A6E0',
      path: '/users',
      icon: UserCog,
      roles: ['administrator'],
    },
  ];

  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <aside
      className={`no-print fixed top-0 left-0 bottom-0 z-40 bg-white dark:bg-[#121B17] border-r border-border dark:border-[#24352C] transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border dark:border-[#24352C]">
        <div className="flex items-center gap-3 overflow-hidden">
          <img src="/logo.svg" alt="ArogyaNova" className="w-8 h-8 shrink-0 float" />
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-gradient">ArogyaNova</span>
              <span className="text-[10px] text-primary font-medium tracking-wide">
                PRESCRIPTION SYSTEM
              </span>
            </div>
          )}
        </div>
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-lg text-text-secondary dark:text-slate-400 hover:bg-background dark:hover:bg-slate-800 hover:text-text dark:hover:text-white transition-colors"
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
                `nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-[#1C2922] text-emerald-800 dark:text-white font-semibold'
                    : 'text-text-secondary dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] hover:text-text dark:hover:text-white'
                } ${isCollapsed ? 'justify-center' : ''}`
              }
              title={isCollapsed ? item.label : undefined}
            >
              <span
                className="nav-icon flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                style={{ backgroundColor: `${item.color}1F`, color: item.color }}
              >
                <Icon className="w-[18px] h-[18px]" />
              </span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {/* User Info Bottom */}
      <div className="p-3 border-t border-border dark:border-[#24352C] bg-slate-50/50 dark:bg-[#121B17]/60">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-[#4FA67A] text-white flex items-center justify-center font-semibold text-xs shrink-0">
            {user?.first_name?.[0]}
            {user?.last_name?.[0]}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden flex-1">
              <span className="text-xs font-semibold text-text dark:text-white truncate">
                {user?.role === 'doctor' ? `Dr. ${user?.first_name} ${user?.last_name}` : `${user?.first_name} ${user?.last_name}`}
              </span>
              <span className="text-[11px] text-text-secondary dark:text-slate-400 capitalize truncate">
                {user?.role}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={() => logout()}
              title="Sign out"
              aria-label="Sign out"
              className="group p-2 rounded-lg text-text-secondary dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-400/10 hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
            >
              <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
