import React, { useEffect, useState } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'primary' | 'secondary' | 'warning' | 'success';
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  color = 'primary',
}: StatCardProps) {
  const colorMap = {
    primary: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-300/10 dark:text-emerald-300',
    secondary: 'bg-sky-50 text-sky-600 dark:bg-sky-300/10 dark:text-sky-300',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-300/10 dark:text-amber-200',
    success: 'bg-violet-50 text-violet-500 dark:bg-violet-300/10 dark:text-violet-300',
  };

  // Count-up animation for numeric values (e.g. "94%" counts 0 → 94)
  const match = String(value).match(/^(\d+(?:\.\d+)?)(.*)$/);
  const target = match ? parseFloat(match[1]) : null;
  const suffix = match ? match[2] : '';
  const [shown, setShown] = useState(target === null ? 0 : 0);
  useEffect(() => {
    if (target === null) return;
    let frame = 0;
    const frames = 40;
    const id = setInterval(() => {
      frame++;
      setShown(target * (1 - Math.pow(1 - frame / frames, 3)));
      if (frame >= frames) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target]);
  const display = target === null ? value : `${Number.isInteger(target) ? Math.round(shown) : shown.toFixed(1)}${suffix}`;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-secondary dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-text dark:text-white mt-1">{display}</h3>
          {subtitle && <p className="text-xs text-text-light dark:text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-xs font-medium ${trendUp ? 'text-success dark:text-emerald-400' : 'text-error dark:text-rose-400'}`}>
                {trend}
              </span>
            </div>
          )}
        </div>
        <div className={`icon-tile p-3 rounded-xl ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
