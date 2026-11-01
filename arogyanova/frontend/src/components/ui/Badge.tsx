import React from 'react';
import type { PrescriptionStatus } from '../../types';

interface BadgeProps {
  status: PrescriptionStatus | string;
  size?: 'sm' | 'md';
}

export default function Badge({ status, size = 'md' }: BadgeProps) {
  const normalized = status.toLowerCase();

  const getStyle = () => {
    switch (normalized) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'draft':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'expired':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'doctor':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'patient':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pharmacist':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'administrator':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border capitalize ${getStyle()} ${px}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {status}
    </span>
  );
}
