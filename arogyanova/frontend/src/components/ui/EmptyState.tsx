import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="card p-12 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <p className="text-sm text-text-secondary max-w-sm mt-1 mb-6">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-primary text-sm">
          {actionText}
        </button>
      )}
    </div>
  );
}
